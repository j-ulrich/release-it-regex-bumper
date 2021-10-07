const fs = require( 'fs' );
const assert = require( 'assert' ).strict;
const util = require( 'util' );
const glob = require( 'fast-glob' );
const chalk = require( 'chalk' );
const _ = require( 'lodash' );
const XRegExp = require( 'xregexp' );
const semver = require( 'semver' );
const { Plugin } = require( 'release-it' );
const dateFormat = require( 'date-fns/format' );
const dateFormatIso = require( 'date-fns/formatISO' );
const diff = optionalRequire( 'diff' );


const readFile = util.promisify( fs.readFile );
const writeFile = util.promisify( fs.writeFile );


const defaultEncoding = 'utf-8';
const semanticVersionRegex = XRegExp( /(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?/ );
const defaultSearchRegex = semanticVersionRegex;
const defaultVersionCaptureGroup = null;
const defaultReplace = '{{version}}';
const placeholderRegex = XRegExp( /\{\{(?<placeholder>(?:[a-z][a-z0-9_]*|\{))(?::(?<format>.*))?\}\}/ig );


const prereleasePrefix = '-';
const buildPrefix = '+';


class RegExBumper extends Plugin {

	constructor(...args) {
		super(...args);
		this.setContext({executionTime: new Date()});
	}

	async getLatestVersion() {

		const { in: inOptions, search: globalSearchOptions, encoding: globalEncoding } = this.options;
		if ( _.isNil( inOptions ) ) {
			return;
		}

		const context = Object.assign( {}, this.getContext(), this.config.contextOptions );

		const { searchRegex: globalSearchRegex, flags: globalSearchFlags, versionCaptureGroup: globalVersionCaptureGroup } = parseSearchOptions.call( this, globalSearchOptions );
		const { file, encoding, searchRegex, flags: searchFlags, versionCaptureGroup } = parseInOptions.call( this, inOptions );

		const effectiveEncoding = firstNotNil( encoding, globalEncoding, defaultEncoding );
		const fileContent = await readFile( file, { encoding: effectiveEncoding } );
		const effectiveSearchRegex = mergeSearchRegExes( [searchRegex, globalSearchRegex, defaultSearchRegex], [searchFlags, globalSearchFlags] );
		const replacedSearchRegex = prepareSearch( effectiveSearchRegex, context );
		const version = await extractVersion.call( this, fileContent, replacedSearchRegex,
			firstNotNil( versionCaptureGroup, globalVersionCaptureGroup, defaultVersionCaptureGroup ) );
		return version;
	}


	async bump( version ) {

		const { out: outOptions, search: globalSearchOptions, replace: globalReplace, encoding: globalEncoding } = this.options;
		const { isDryRun } = this.config;
		if ( _.isNil( outOptions ) ) {
			return;
		}
		const context = Object.assign( {}, this.getContext(), this.config.contextOptions );
		if ( !context.version ) {
			context.version = version;
		}

		const { searchRegex: globalSearchRegex, flags: globalSearchFlags } = parseSearchOptions.call( this, globalSearchOptions );
		const expandedOutOptions = await expandOutOptionFiles.call( this, parseOutOptions.call( this, outOptions ) );

		for ( const outOptions of expandedOutOptions ) {

			const { files, encoding, searchRegex, flags: searchFlags, replace } = outOptions;

			const effectiveEncoding = firstNotNil( encoding, globalEncoding, defaultEncoding );
			const effectiveSearchRegex = mergeSearchRegExes( [searchRegex, globalSearchRegex, defaultSearchRegex], [searchFlags, globalSearchFlags] );
			const effectiveReplacement = firstNotNil( replace, globalReplace, defaultReplace );

			const replacedSearchRegex = prepareSearch( effectiveSearchRegex, context );

			for ( const file of files ) {

				this.log.info( `Updating version in ${file}` );

				const fileContent = await readFile( file, { encoding: effectiveEncoding } );

				if ( isDryRun ) {
					loadDiff.call( this );
					if ( this.diff ) {
						const processedFileContent = replaceVersion.call( this, fileContent, replacedSearchRegex, effectiveReplacement, context );
						await diffAndReport.call( this, fileContent, processedFileContent, file );
						continue;
					}
					await searchAndReport.call( this, fileContent, replacedSearchRegex, file );
					continue;
				}

				const processedFileContent = replaceVersion.call( this, fileContent, replacedSearchRegex, effectiveReplacement, context );

				if ( processedFileContent == fileContent ) {
					warnNoFileChange.call( this, file );
				}
				else {
					await writeFile( file, processedFileContent, effectiveEncoding );
				}
			}
		}
	}

}

function parseInOptions( options ) {
	if ( _.isString( options ) ) {
		const file = options;
		const encoding = null;
		const searchRegex = null;
		const versionCaptureGroup = null;
		return { file, encoding, searchRegex, versionCaptureGroup };
	}
	const { file, encoding } = options;
	const { searchRegex, flags, versionCaptureGroup } = parseSearchOptions( options.search );
	if ( !file ) {
		throw new Error( 'Missing "file" property in "in" options' );
	}
	return { file, encoding, searchRegex, flags, versionCaptureGroup };
}

function parseSearchOptions( options ) {
	if ( _.isNil( options ) ) {
		return {};
	}
	if ( _.isString( options ) ) {
		const searchRegex = XRegExp( options );
		const versionCaptureGroup = null;
		return { searchRegex, versionCaptureGroup };
	}
	const { pattern, flags, versionCaptureGroup } = options;
	const searchRegex = _.isNil(pattern) ? pattern : XRegExp( pattern, _.isNull( flags ) ? undefined : flags );
	return { searchRegex, flags, versionCaptureGroup };
}

function extractVersion( content, versionRegex, versionCaptureGroup ) {
	const match = XRegExp.exec( content, versionRegex );
	if ( !match ) {
		throw new Error( 'Could not extract version from file' );
	}
	if ( !_.isNil( versionCaptureGroup ) ) {
		if( match.hasOwnProperty( versionCaptureGroup ) ) {
			return match[ versionCaptureGroup ];
		}
	}
	else {
		if ( match.hasOwnProperty( 'version' ) ) {
			return match[ 'version' ];
		}
		if ( match.hasOwnProperty( 1 ) ) {
			return match[ 1 ];
		}
	}

	return match[ 0 ];
}

function parseOutOptions( options ) {
	return _.castArray( options ).map( options => {
		if ( _.isString( options ) ) {
			return {
				files: [ options ],
				encoding: null,
				searchRegex: null,
				replace: null,
			};
		}
		const { encoding, replace } = options;
		const { searchRegex, flags } = parseSearchOptions( options.search );
		const files = options.files ? _.castArray( options.files ) : [];
		if( options.file ) {
			files.unshift( options.file );
		}
		return { files, encoding, searchRegex, flags, replace };
	} );
}

async function expandOutOptionFiles( options ) {
	for ( const option of options ) {
		let expandedFiles = [];
		for ( const file of option.files ) {
			if ( glob.isDynamicPattern( file ) ) {
				expandedFiles = expandedFiles.concat( glob.sync( file, { onlyFiles: true, unique: true } ) );
			}
			else {
				expandedFiles.push( file );
			}
		}
		option.files = expandedFiles;
	}

	return options;
}

function loadDiff() {
	if ( !diff || diff instanceof Error ) {
		this.log.info( 'Optional "diff" package not available' );
		this.log.verbose( 'Exception was:', diff );
	}
	this.diff = diff;
}

function diffAndReport( oldContent, newContent, filePath ) {
	const { isDryRun } = this.config;
	const diffResult = this.diff.structuredPatch( filePath, filePath, oldContent, newContent, undefined, undefined, { context: 0 } );

	if ( _.isEmpty( diffResult.hunks ) ) {
		warnNoFileChange.call( this, filePath );
	}
	diffResult.hunks.forEach( hunk => {
		this.log.exec( `Replacing at line ${hunk.oldStart}:\n` + hunk.lines.map( line => {
			const lineText = '\t' + line;
			if ( line.startsWith( '-' ) ) {
				return chalk.red( lineText );
			}
			if ( line.startsWith( '+' ) ) {
				return chalk.green( lineText );
			}
			return lineText;
		} ).join( '\n' ), { isDryRun } );
	} );

}

function searchAndReport( content, searchRegex, filePath ) {
	const { isDryRun } = this.config;
	let foundMatch = false;
	const lineCounter = new LineCounter( content );
	XRegExp.forEach( content, searchRegex, ( match ) => {
		const matchText = match[ 0 ];
		const matchIndex = searchRegex.lastIndex - matchText.length;
		this.log.exec( `Replacing match at line ${lineCounter.lineOfIndex( matchIndex )}, column ${lineCounter.columnOfIndex( matchIndex )}:\n\t` + matchText, { isDryRun } );
		foundMatch = true;
	} );
	if ( !foundMatch ) {
		warnNoFileChange.call( this, filePath );
	}
}

function warnNoFileChange( filePath ) {
	this.log.warn( `File "${filePath}" did not change!` );
}

function mergeSearchRegExes( regExCandidates, flagCandidates ) {
	const searchRegEx = firstNotNil( ...regExCandidates );
	const flags = firstNotNil( ...flagCandidates );
	return XRegExp( searchRegEx.xregexp.source || searchRegEx.source, flags );
}

function prepareSearch( searchRegEx, context ) {
	const pattern = searchRegEx.xregexp.source || searchRegEx.source;
	const placeholderMap = {
		'now': ( format ) => {
			if( _.isNil( format ) ) {
				throw new Error( 'Missing required parameter "format" for placeholder {{now}}' );
			}
			return XRegExp.escape( dateFormat( context.executionTime, format ) );
		},
		'semver': `${semanticVersionRegex.xregexp.source || semanticVersionRegex.source}`
	};
	const parsedVer = semver.parse( context.latestVersion );
	if( parsedVer ) {
		Object.assign( placeholderMap, {
			'version': XRegExp.escape( parsedVer.raw ),
			'major': parsedVer.major,
			'minor': parsedVer.minor,
			'patch': parsedVer.patch,
			'prerelease': XRegExp.escape( parsedVer.prerelease.join( '.' ) ),
			'prefixedPrerelease': parsedVer.prerelease.length > 0 ? XRegExp.escape( prereleasePrefix + parsedVer.prerelease.join( '.' ) ) : "",
			'build': XRegExp.escape( parsedVer.build.join( '.' ) ),
			'prefixedBuild': parsedVer.build.length > 0 ? XRegExp.escape( buildPrefix + parsedVer.build.join( '.' ) ) : "",
			'versionWithoutBuild': XRegExp.escape( parsedVer.version ),
			'versionWithoutPrerelease': XRegExp.escape( `${parsedVer.major}.${parsedVer.minor}.${parsedVer.patch}` ),

		} );
	}
	if ( context.latestTag ) {
		Object.assign( placeholderMap, { 'tag': XRegExp.escape( context.latestTag ) } );
	}

	if ( context.version ) {
		Object.assign( placeholderMap, { 'newVersion': XRegExp.escape( context.version ) } );
	}

	for( const placeholder of Object.keys( placeholderMap ) ) {
		const replacement = placeholderMap[ placeholder ];
		if( _.isFunction( replacement ) ) {
			placeholderMap[ placeholder ] = ( ...args ) => {
				return wrapInRegexGroup( replacement( ...args ) );
			};
			continue;
		}
		placeholderMap[ placeholder ] = wrapInRegexGroup( replacement );
	}
	const replacedPattern = replacePlaceholders( pattern, placeholderMap );
	return XRegExp( replacedPattern, searchRegEx.xregexp.flags || undefined );
}

function wrapInRegexGroup( pattern ) {
	return  `(?:${pattern})`;
}

function replaceVersion( content, searchRegex, replace, context ) {
	const processedReplace = prepareReplacement.call( this, replace, context );
	const processedContent = XRegExp.replace( content, searchRegex, processedReplace );
	return processedContent;
}

function prepareReplacement( replace, context ) {
	const parsedVer = semver.parse( context.version );
	const placeholderMap = {
		'version': parsedVer.raw,
		'major': parsedVer.major,
		'minor': parsedVer.minor,
		'patch': parsedVer.patch,
		'prerelease': parsedVer.prerelease.join( '.' ),
		'prefixedPrerelease': parsedVer.prerelease.length > 0 ? prereleasePrefix + parsedVer.prerelease.join( '.' ) : '',
		'build': parsedVer.build.join( '.' ),
		'prefixedBuild': parsedVer.build.length > 0 ? buildPrefix + parsedVer.build.join( '.' ) : '',
		'versionWithoutBuild': parsedVer.version,
		'versionWithoutPrerelease': `${parsedVer.major}.${parsedVer.minor}.${parsedVer.patch}`,
		'latestVersion': context.latestVersion || '',
		'latestTag': context.latestTag || '',
		'now': ( format ) => {
			if( _.isNil( format ) ) {
				return dateFormatIso( context.executionTime );
			}
			return dateFormat( context.executionTime, format );
		}
	};
	return replacePlaceholders( replace, placeholderMap );
}

function replacePlaceholders( template, placeholderMap ) {
	placeholderMap = Object.assign( {}, placeholderMap, { '{': '{' } );
	return XRegExp.replace( template, placeholderRegex, ( match, placeholder, format ) => {
		if ( !placeholderMap.hasOwnProperty( placeholder ) ) {
			throw new Error( `Unknown placeholder encountered: '${placeholder}'` );
		}
		const replacement = placeholderMap[ placeholder ];
		if ( _.isFunction( replacement ) ) {
			if ( _.isString( format ) ) {
				return replacement( format );
			}
			return replacement();
		}
		return replacement;
	} );
}


function optionalRequire( packageName ) {
	try {
		return require( packageName );
	}
	catch ( ex ) {
		return ex;
	}
}

function firstNotNil( ...args ) {
	return args.find( ele => !_.isNil( ele ) );
}

class LineCounter {
	constructor( text ) {
		let index = 0;
		this.lineEndIndex = text.split( '\n' ).map( line => {
			index += line.length + 1;
			return index;
		} );
	}

	lineOfIndex( index ) {
		const arrayIndex = this.lineEndIndex.findIndex( lineEndIndex => ( index <= lineEndIndex ) );
		assert( arrayIndex >= 0 );
		return arrayIndex + 1;
	}

	columnOfIndex( index ) {
		const line = this.lineOfIndex( index );
		assert( line >= 1 );
		if ( line === 1 ) {
			return index;
		}
		const previousLineEndIndex = this.lineEndIndex[ line - 2 ];
		return index - previousLineEndIndex;
	}
}

module.exports = RegExBumper;
