
import { readFile as fsReadFile, writeFile as fsWriteFile } from 'fs';
import { strict as assert } from 'assert';
import { promisify } from 'util';
import glob from 'fast-glob';
import chalk from 'chalk';
import _ from 'lodash';
import XRegExp from 'xregexp';
import semver from 'semver';
import { Plugin } from 'release-it';
import { format as dateFormat, formatISO as dateFormatISO } from 'date-fns';


const readFile = promisify( fsReadFile );
const writeFile = promisify( fsWriteFile );

const semanticVersionRegex = XRegExp(
	// eslint-disable-next-line security/detect-unsafe-regex
	/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?/
);
const placeholderRegex = XRegExp( '\\{\\{(?<placeholder>(?:[a-z][a-z0-9_]*|\\{))(?::(?<format>.*))?\\}\\}', 'ig' );

const prereleasePrefix = '-';
const buildPrefix = '+';

const StrictMode = {
	Off: 'off',
	Warn: 'warn',
	Error: 'error',
};

const defaultEncoding = 'utf-8';
const defaultSearchRegex = XRegExp( '{{semver}}' );
const defaultVersionCaptureGroup = null;
const defaultReplace = '{{version}}';
const defaultStrictMode = true;


export default class RegExBumper extends Plugin {

	constructor( ...args ) {
		super( ...args );
		this.setContext( { executionTime: new Date() } );
	}

	async getLatestVersion() {

		const { in: inOptions, search: globalSearchOptions, encoding: globalEncoding } = this.options;
		if ( _.isNil( inOptions ) ) {
			return undefined;
		}

		const context = Object.assign( {}, this.getContext(), this.config.contextOptions );

		const {
			searchRegex: globalSearchRegex,
			flags: globalSearchFlags,
			versionCaptureGroup: globalVersionCaptureGroup,
		} = parseSearchOptions( globalSearchOptions );
		const { file, encoding, searchRegex, flags: searchFlags, versionCaptureGroup } = parseInOptions( inOptions );

		const effectiveEncoding = firstNotNil( encoding, globalEncoding, defaultEncoding );
		const fileContent = await readFile( file, { encoding: effectiveEncoding } );
		const effectiveSearchRegex = mergeSearchRegExes(
			[ searchRegex, globalSearchRegex, defaultSearchRegex ],
			[ searchFlags, globalSearchFlags ]
		);
		const replacedSearchRegex = prepareSearch( effectiveSearchRegex, context );
		const version = await extractVersion(
			fileContent,
			replacedSearchRegex,
			firstNotNil( versionCaptureGroup, globalVersionCaptureGroup, defaultVersionCaptureGroup )
		);
		return version;
	}

	async bump( version ) {
		const {
			out: outOptions,
			search: globalSearchOptions,
			replace: globalReplace,
			encoding: globalEncoding,
			strict: globalStrict,
		} = this.options;
		const { isDryRun } = this.config;
		if ( _.isNil( outOptions ) ) {
			return;
		}
		const context = Object.assign( {}, this.getContext(), this.config.contextOptions );
		if ( !context.version ) {
			context.version = version;
		}

		const { searchRegex: globalSearchRegex, flags: globalSearchFlags } = parseSearchOptions.call(
			this,
			globalSearchOptions
		);
		const expandedOutOptions = await expandOutOptionFiles.call( this, parseOutOptions.call( this, outOptions ) );

		/* eslint-disable no-await-in-loop */
		for ( const outOption of expandedOutOptions ) {
			const { files, encoding, searchRegex, flags: searchFlags, replace, strict } = outOption;

			const effectiveEncoding = firstNotNil( encoding, globalEncoding, defaultEncoding );
			const effectiveSearchRegex = mergeSearchRegExes(
				[ searchRegex, globalSearchRegex, defaultSearchRegex ],
				[ searchFlags, globalSearchFlags ]
			);
			const effectiveReplacement = firstNotNil( replace, globalReplace, defaultReplace );
			const effectiveStrictMode = firstNotNil( strict, globalStrict, defaultStrictMode );

			const replacedSearchRegex = prepareSearch( effectiveSearchRegex, context );

			for ( const file of files ) {

				this.log.info( `Updating version in ${file}` );

				const fileContent = await readFile( file, { encoding: effectiveEncoding } );

				if ( isDryRun ) {
					await this.loadDiff();
					const processedFileContent = replaceVersion( fileContent, replacedSearchRegex,
					                                             effectiveReplacement, context );
					this.evaluateFileChanges( fileContent, processedFileContent,
					                          replacedSearchRegex, effectiveStrictMode, file );
					if ( this.diff ) {
						await this.diffAndReport( fileContent, processedFileContent, effectiveStrictMode, file );
						continue;
					}
					await this.searchAndReport( fileContent, replacedSearchRegex );
					continue;
				}

				const processedFileContent = replaceVersion(
					fileContent,
					replacedSearchRegex,
					effectiveReplacement,
					context
				);

				if ( this.evaluateFileChanges( fileContent, processedFileContent,
					                           replacedSearchRegex, effectiveStrictMode, file ) ) {
					await writeFile( file, processedFileContent, effectiveEncoding );
				}
			}
		}
		/* eslint-enable no-await-in-loop */
	}

	async loadDiff() {
		if ( this.diff ) {
			return;
		}
		try {
			const diff = await import( 'diff' );
			if ( !diff || !diff.structuredPatch ) {
				throw new Error( 'diff module no available' );
			}
			this.diff = diff;
		}
		catch ( e ) {
			this.log.info( 'Optional "diff" package not available' );
			this.log.verbose( 'Exception was:', e );
		}
	}

	diffAndReport( oldContent, newContent, filePath ) {
		const { isDryRun } = this.config;
		const diffResult = this.diff.structuredPatch( filePath, filePath, oldContent, newContent, undefined, undefined,
			{
				context: 0,
			}
		);

		diffResult.hunks.forEach( ( hunk ) => {
			this.log.exec(
				`Replacing at line ${hunk.oldStart}:\n` +
					hunk.lines
						.map( ( line ) => {
							const lineText = '\t' + line;
							if ( line.startsWith( '-' ) ) {
								return chalk.red( lineText );
							}
							if ( line.startsWith( '+' ) ) {
								return chalk.green( lineText );
							}
							return lineText;
						} )
						.join( '\n' ),
				{ isDryRun }
			);
		} );
	}

	searchAndReport( content, searchRegex ) {
		const { isDryRun } = this.config;
		const lineCounter = new LineCounter( content );
		XRegExp.forEach( content, searchRegex, ( match ) => {
			const matchText = match[0];
			const matchIndex = searchRegex.lastIndex - matchText.length;
			this.log.exec(
				`Replacing match at line ${lineCounter.lineOfIndex( matchIndex )}, ` +
					`column ${lineCounter.columnOfIndex( matchIndex )}:\n\t` +
					matchText,
				{ isDryRun }
			);
		} );
	}

	evaluateFileChanges( originalFileContent, processedFileContent, searchRegex, strictMode, filePath ) {
		const fileChanged = originalFileContent !== processedFileContent;
		if ( fileChanged ) {
			return fileChanged;
		}
		if ( strictMode && strictMode !== StrictMode.Off ) {
			const match = XRegExp.match( originalFileContent, searchRegex, 'one' );
			if ( match === null ) {
				const message = `No matches found in file "${filePath}"!`;
				if ( strictMode === StrictMode.Error ) {
					throw new Error( message );
				}
				this.log.warn( message );
				return fileChanged;
			}
		}
		this.warnNoFileChange( filePath );
		return fileChanged;
	}

	warnNoFileChange( filePath ) {
		this.log.warn( `File "${filePath}" did not change!` );
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
		throw new Error( "Missing 'file' property in 'in' options" );
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
	const searchRegex = _.isNil( pattern ) ? pattern : XRegExp( pattern, _.isNull( flags ) ? undefined : flags );
	return { searchRegex, flags, versionCaptureGroup };
}

function extractVersion( content, versionRegex, versionCaptureGroup ) {
	const match = XRegExp.exec( content, versionRegex );
	if ( !match ) {
		throw new Error( 'Could not extract version from file' );
	}
	if ( !_.isNil( versionCaptureGroup ) ) {
		if ( typeof versionCaptureGroup === 'number' && hasOwnProperty( match, versionCaptureGroup ) ) {
			// object injection mitigated by checking hasOwnProperty()
			// eslint-disable-next-line security/detect-object-injection
			return match[versionCaptureGroup];
		}
		if ( match.groups && hasOwnProperty( match.groups, versionCaptureGroup ) ) {
			// object injection mitigated by checking hasOwnProperty()
			// eslint-disable-next-line security/detect-object-injection
			return match.groups[versionCaptureGroup];
		}
	}
	else {
		if ( match.groups && hasOwnProperty( match.groups, 'version' ) ) {
			return match.groups.version;
		}
		if ( hasOwnProperty( match, 1 ) ) {
			return match[1];
		}
	}

	return match[0];
}

function hasOwnProperty( obj, prop ) {
	return Object.prototype.hasOwnProperty.call( obj, prop );
}

function parseOutOptions( options ) {
	return _.castArray( options ).map( ( option ) => {
		if ( _.isString( option ) ) {
			return {
				files: [ option ],
				encoding: null,
				searchRegex: null,
				replace: null,
			};
		}
		const { encoding, replace, strict } = option;
		const { searchRegex, flags } = parseSearchOptions( option.search );
		const files = option.files ? _.castArray( option.files ) : [];
		if ( option.file ) {
			files.unshift( option.file );
		}
		return { files, encoding, searchRegex, flags, replace, strict };
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

function mergeSearchRegExes( regExCandidates, flagCandidates ) {
	const searchRegEx = firstNotNil( ...regExCandidates );
	const flags = firstNotNil( ...flagCandidates );
	return XRegExp( searchRegEx.xregexp.source, flags );
}

function prepareSearch( searchRegEx, context ) {
	const pattern = searchRegEx.xregexp.source;
	const placeholderMap = {
		now: ( format ) => {
			if ( _.isNil( format ) ) {
				throw new Error( "Missing required parameter 'format' for placeholder {{now}}" );
			}
			return XRegExp.escape( dateFormat( context.executionTime, format ) );
		},
		semver: `${semanticVersionRegex.xregexp.source || semanticVersionRegex.source}`,
	};
	const parsedVer = semver.parse( context.latestVersion );
	if ( parsedVer ) {
		Object.assign( placeholderMap, {
			version: XRegExp.escape( parsedVer.raw ),
			major: parsedVer.major,
			minor: parsedVer.minor,
			patch: parsedVer.patch,
			prerelease: XRegExp.escape( parsedVer.prerelease.join( '.' ) ),
			prefixedPrerelease:
				parsedVer.prerelease.length > 0
					? XRegExp.escape( prereleasePrefix + parsedVer.prerelease.join( '.' ) )
					: '',
			build: XRegExp.escape( parsedVer.build.join( '.' ) ),
			prefixedBuild:
				parsedVer.build.length > 0 ? XRegExp.escape( buildPrefix + parsedVer.build.join( '.' ) ) : '',
			versionWithoutBuild: XRegExp.escape( parsedVer.version ),
			versionWithoutPrerelease: XRegExp.escape( `${parsedVer.major}.${parsedVer.minor}.${parsedVer.patch}` ),
		} );
	}
	if ( context.latestTag ) {
		Object.assign( placeholderMap, { tag: XRegExp.escape( context.latestTag ) } );
	}

	if ( context.version ) {
		Object.assign( placeholderMap, { newVersion: XRegExp.escape( context.version ) } );
	}

	wrapSearchPatternPlaceholders( placeholderMap );
	const replacedPattern = replacePlaceholders( pattern, placeholderMap );
	return XRegExp( replacedPattern, searchRegEx.xregexp.flags || undefined );
}

function wrapSearchPatternPlaceholders( placeholderMap ) {
	for ( const placeholder of Object.keys( placeholderMap ) ) {
		// object injection mitigated for placeholderMap since placeholder is from Object.keys( placeholderMap )
		// eslint-disable-next-line security/detect-object-injection
		const replacement = placeholderMap[ placeholder ];
		if ( _.isFunction( replacement ) ) {
			// eslint-disable-next-line security/detect-object-injection
			placeholderMap[ placeholder ] = ( ...args ) => {
				return wrapInRegexGroup( replacement( ...args ) );
			};
			continue;
		}
		// eslint-disable-next-line security/detect-object-injection
		placeholderMap[ placeholder ] = wrapInRegexGroup( replacement );
	}
}

function wrapInRegexGroup( pattern ) {
	return `(?:${pattern})`;
}

function replaceVersion( content, searchRegex, replace, context ) {
	const processedReplace = prepareReplacement( replace, context );
	const processedContent = XRegExp.replace( content, searchRegex, processedReplace );
	return processedContent;
}

function prepareReplacement( replace, context ) {
	const parsedVer = semver.parse( context.version );
	const placeholderMap = {
		version: parsedVer.raw,
		major: parsedVer.major,
		minor: parsedVer.minor,
		patch: parsedVer.patch,
		prerelease: parsedVer.prerelease.join( '.' ),
		prefixedPrerelease:
			parsedVer.prerelease.length > 0 ? prereleasePrefix + parsedVer.prerelease.join( '.' ) : '',
		build: parsedVer.build.join( '.' ),
		prefixedBuild: parsedVer.build.length > 0 ? buildPrefix + parsedVer.build.join( '.' ) : '',
		versionWithoutBuild: parsedVer.version,
		versionWithoutPrerelease: `${parsedVer.major}.${parsedVer.minor}.${parsedVer.patch}`,
		latestVersion: context.latestVersion || '',
		latestTag: context.latestTag || '',
		now: ( format ) => {
			if ( _.isNil( format ) ) {
				return dateFormatISO( context.executionTime );
			}
			return dateFormat( context.executionTime, format );
		},
	};
	return replacePlaceholders( replace, placeholderMap );
}

function replacePlaceholders( template, placeholderMap ) {
	placeholderMap = Object.assign( {}, placeholderMap, { '{': '{' } );
	return XRegExp.replace( template, placeholderRegex, ( match, placeholder, format ) => {
		if ( !hasOwnProperty( placeholderMap, placeholder ) ) {
			throw new Error( `Unknown placeholder encountered: {{${placeholder}}}` );
		}
		// object injection mitigated by checking hasOwnProperty()
		// eslint-disable-next-line security/detect-object-injection
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

function firstNotNil( ...args ) {
	return args.find( ( ele ) => !_.isNil( ele ) );
}

class LineCounter {
	constructor( text ) {
		let index = 0;
		this.lineEndIndex = text.split( '\n' ).map( ( line ) => {
			index += line.length + 1;
			return index;
		} );
	}

	lineOfIndex( index ) {
		// eslint-disable-next-line no-extra-parens
		const arrayIndex = this.lineEndIndex.findIndex( ( lineEndIndex ) => index <= lineEndIndex );
		assert( arrayIndex >= 0 );
		return arrayIndex + 1;
	}

	columnOfIndex( index ) {
		const lineNumber = this.lineOfIndex( index );
		assert( lineNumber >= 1 );
		if ( lineNumber === 1 ) {
			return index;
		}
		const previousLineNumber = lineNumber - 1;
		const previousLineEndIndex = this.lineEndIndex[ previousLineNumber - 1 ];
		return index - previousLineEndIndex;
	}
}

