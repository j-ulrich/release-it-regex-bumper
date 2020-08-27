const fs = require( 'fs' );
const assert = require( 'assert' ).strict;
const util = require( 'util' );
const glob = require( 'fast-glob' );
const chalk = require( 'chalk' );
const _ = require( 'lodash' );
const XRegExp = require( 'xregexp' );
const { Plugin } = require( 'release-it' );
const moment = require( 'moment' );
const diff = optionalRequire( 'diff' );


const readFile = util.promisify( fs.readFile );
const writeFile = util.promisify( fs.writeFile );


const defaultEncoding = 'utf-8';
const defaultSearchRegex = XRegExp( /(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?/ );
const defaultVersionCaptureGroup = null;
const defaultReplace = '{{version}}';



class RegExBumper extends Plugin {
	
	async getLatestVersion() {

		const { in: inOptions, search: globalSearchOptions, encoding: globalEncoding } = this.options;
		if ( _.isNil( inOptions ) ) {
			return;
		}
		
		const { searchRegex: globalSearchRegex, versionCaptureGroup: globalVersionCaptureGroup } = parseSearchOptions.call( this, globalSearchOptions );
		const { file, encoding, searchRegex, versionCaptureGroup } = parseInOptions.call( this, inOptions );
		
		const effectiveEncoding = firstNotNil( encoding, globalEncoding, defaultEncoding );
		const fileContent = await readFile( file, { encoding: effectiveEncoding } );
		const version = await extractVersion.call( this, fileContent, firstNotNil( searchRegex, globalSearchRegex, defaultSearchRegex ),
			firstNotNil( versionCaptureGroup, globalVersionCaptureGroup, defaultVersionCaptureGroup ) );
		return version;
	}


	async bump( version ) {
		
		const { out: outOptions, search: globalSearchOptions, replace: globalReplace, encoding: globalEncoding } = this.options;
		const { isDryRun } = this.global;
		if ( _.isNil( outOptions ) ) {
			return;
		}
		const context = Object.assign( {}, this.config.contextOptions );
		if ( !context.version ) {
			context.version = version;
		}

		const { searchRegex: globalSearchRegex } = parseSearchOptions.call( this, globalSearchOptions );
		const expandedOutOptions = await expandOutOptions.call( this, parseOutOptions.call( this, outOptions ) );
	
		for ( const outOptions of expandedOutOptions ) {
			
			const { file, encoding, searchRegex, replace } = outOptions;
			
			this.log.info( `Updating version in ${file}` );
			
			const effectiveEncoding = firstNotNil( encoding, globalEncoding, defaultEncoding );
			const effectiveSearchRegex = firstNotNil( searchRegex, globalSearchRegex, defaultSearchRegex );
			const effectiveReplacement = firstNotNil( replace, globalReplace, defaultReplace );
			
			const fileContent = await readFile( file, { encoding: effectiveEncoding } );
			
			if ( isDryRun ) {
				loadDiff.call( this );
				if ( this.diff ) {
					const processedFileContent = replaceVersion.call( this, fileContent, effectiveSearchRegex, effectiveReplacement, context );
					await diffAndReport.call( this, fileContent, processedFileContent, file );
					continue;
				}
				await searchAndReport.call( this, fileContent, effectiveSearchRegex, file );
				continue;
			}
			
			const processedFileContent = replaceVersion.call( this, fileContent, effectiveSearchRegex, effectiveReplacement, context );
			
			if ( processedFileContent == fileContent ) {
				warnNoFileChange.call( this, file );
			} 
			await writeFile( file, processedFileContent, effectiveEncoding );
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
	const { searchRegex, versionCaptureGroup } = parseSearchOptions( options.search );
	if ( !file ) {
		throw new Error( 'Missing "file" property in "in" options' );
	}
	return { file, encoding, searchRegex, versionCaptureGroup };
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
	const searchRegex = XRegExp( pattern, _.isNull( flags ) ? undefined : flags );
	return { searchRegex, versionCaptureGroup };
};

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
};

function parseOutOptions( options ) {
	return _.castArray( options ).map( options => {
		if ( _.isString( options ) ) {
			return {
				file: options,
				encoding: null,
				searchRegex: null,
				replace: null,
			};
		}
		const { file, encoding, replace } = options;
		const { searchRegex } = parseSearchOptions( options.search );
		return { file, encoding, searchRegex, replace };
	} );
};

async function expandOutOptions( options ) {
	const expandedOptions = [];
	for ( const option of options ) {
		if ( glob.isDynamicPattern( option.file ) ) {
			const files = glob.sync( option.file, { onlyFiles: true, unique: true } );
			for ( const file of files ) {
				expandedOptions.push( Object.assign( {}, option, { file } ) );
			}
		}
		else {
			expandedOptions.push( option );
		}
	}
	return expandedOptions;
};

function loadDiff() {
	if ( !diff || diff instanceof Error ) {
		this.log.info( 'Optional "diff" package not available' );
		this.log.verbose( 'Exception was:', diff );
	}
	this.diff = diff;
}

function diffAndReport( oldContent, newContent, filePath ) {
	const { isDryRun } = this.global;
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
	
};

function searchAndReport( content, searchRegex, filePath ) {
	const { isDryRun } = this.global;
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
};

function warnNoFileChange( filePath ) {
	this.log.warn( `File "${filePath}" did not change!` );
}

function replaceVersion( content, searchRegex, replace, context ) {
	const processedReplace = prepareReplacement.call( this, replace, context );
	const processedContent = XRegExp.replace( content, searchRegex, processedReplace );
	return processedContent;
};

function prepareReplacement( replace, context ) {
	const placeholderRegex = XRegExp( /\{\{(?<placeholder>[a-z][a-z0-9_]*)(?::(?<format>.*))?\}\}/ig );
	const now = moment();
	const placeholderMap = {
		'version': context.version,
		'latestVersion': context.latestVersion,
		'latestTag': context.latestTag,
		'now': ( format ) => {
			return now.format( format );
		}
	};
	return XRegExp.replace( replace, placeholderRegex, ( match, placeholder, format ) => {
		const placeholderReplace = placeholderMap[ placeholder ];
		if ( _.isFunction( placeholderReplace ) ) {
			if ( _.isString( format ) ) {
				return placeholderReplace( format );
			}
			return placeholderReplace();
		}
		return placeholderReplace;
	} );
};


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
		if ( line == 1 ) {
			return index;
		}
		const previousLineEndIndex = this.lineEndIndex[ line - 2 ];
		return index - previousLineEndIndex;
	}
}

module.exports = RegExBumper;
