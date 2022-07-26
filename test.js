/* eslint-disable max-len */
import fs from 'fs';
import _ from 'lodash';
import * as dateFns from 'date-fns';
import test from 'ava';
import * as temp from 'temp';
import { factory, runTasks } from 'release-it/test/util/index.js';
import path from 'path';
import * as testdouble from 'testdouble';

const namespace = '@j-ulrich/release-it-regex-bumper';

temp.track();

const readFile = ( file, encoding ) => fs.readFileSync( file ).toString( encoding );
const writeFile = ( file, content, encoding ) => fs.writeFileSync( file, content, { encoding } );


const setupTestDir = () => {
	const dirName = temp.mkdirSync()
		.split( path.sep )
		.join( path.posix.sep );
	writeFile( dirName + '/versions.txt', 'some: 1.0.0\nthis: 1.0.1\nother: 2.0.0\n' );
	writeFile( dirName + '/VERSION', '1.0.1' );
	writeFile( dirName + '/copyright.txt', 'Copyright (c) 2019 Foo Bar' );
	writeFile( dirName + '/unrelated.txt', 'nothing to see here.' );
	return dirName;
};

const suitePrefixes = [];

const describe = ( description, suiteFunc ) => {
	suitePrefixes.push( description );
	suiteFunc();
	suitePrefixes.pop();
};


const it = ( description, testFunc, options = {} ) => {
	const suitePrefix = suitePrefixes.length > 0 ? suitePrefixes.join( ' ' ) + ' ' : '';

	options.only = _.isNil( options.only ) ? false : options.only;
	options.skip = _.isNil( options.skip ) ? false : options.skip;

	const avaTestFunc = options.only ? test.only : options.skip ? test.skip : test;

	avaTestFunc( `${suitePrefix}${description}`, async ( t ) => {
		const testDir = setupTestDir();
		try {
			const result = await testFunc( t, testDir );
			return result;
		}
		catch ( e ) {
			if ( e instanceof SkipException ) {
				console.warn( `⚠️  Skipped test '${description}'\n   Reason: ${e.message}\n   ${e.stack}` );
				return null;
			}
			throw e;
		}
		finally {
			testdouble.reset();
		}
	} );
};

// eslint-disable-next-line no-unused-vars
const skip = ( message ) => {
	const skippedFunctionStackIndex = 2;
	const stackEntry = new Error().stack.split( '\n' )[ skippedFunctionStackIndex ]; // eslint-disable-line security/detect-object-injection
	throw new SkipException( message, stackEntry );
};

class SkipException {
	constructor( message, stack ) {
		this.message = message;
		this.stack = stack;
	}
}


const setupPlugin = async ( pluginOptions, generalOptions ) => {
	const options = Object.assign( { [namespace]: pluginOptions }, generalOptions );
	const container = {};

	const pluginModule = await import( './index.js' );

	const plugin = factory( pluginModule.default, { namespace, options, container } );
	return { plugin, container };
};

const assertLogMessage = ( t, logType, messageRegEx, failMessage ) => {
	if ( _.isNil( failMessage ) ) {
		failMessage = 'Log output did not match ' + messageRegEx;
	}
	t.assert( logType.args.findIndex( args => messageRegEx.test( args[ 0 ] ) ) > -1, failMessage );
};


//####### GetLatestVersion (Input) Tests #######

describe( 'GetLatestVersion (Input)', () => {

	describe( 'error handling', () => {

		it( 'should throw if in file is not specified', async ( t ) => {
			const pluginOptions = { in: {} };
			const { plugin } = await setupPlugin( pluginOptions );
			await t.throwsAsync( async () => {
				await plugin.getLatestVersion();
			}, { message: "Missing 'file' property in 'in' options" } );
		} );

		it( 'should throw if in file cannot be read', async ( t ) => {
			const pluginOptions = { in: 'file_which_does_not_exist.txt' };
			const { plugin } = await setupPlugin( pluginOptions );
			await t.throwsAsync( async () => {
				await plugin.getLatestVersion();
			} );
		} );

		it( 'should throw if version cannot be extracted', async ( t, testDir ) => {
			const pluginOptions = { in: testDir + '/unrelated.txt' };
			const { plugin } = await setupPlugin( pluginOptions );
			await t.throwsAsync( async () => {
				await plugin.getLatestVersion();
			}, { message: /could not extract version/i } );
		} );

	} );

	const testGetLatestVersion = async ( t, pluginOptions, expectedVersion ) => {
		const { plugin } = await setupPlugin( pluginOptions );
		const actualVersion = await plugin.getLatestVersion();
		t.deepEqual( actualVersion, expectedVersion );
	};

	it( 'should return latest version from file', async ( t, testDir ) => {
		const options = { in: testDir + '/versions.txt' };
		await testGetLatestVersion( t, options, '1.0.0' );
	} );

	it( 'should return latest version from file using custom pattern', async ( t, testDir ) => {
		const options = { in: { file: testDir + '/versions.txt', search: 'this: ([0-9.]+)' } };
		await testGetLatestVersion( t, options, '1.0.1' );
	} );

	it( 'should return latest version from file using custom pattern with null version capture group', async ( t, testDir ) => {
		const options = { in: { file: testDir + '/versions.txt', search: { pattern: 'this: ([0-9.]+)', versionCaptureGroup: null } } };
		await testGetLatestVersion( t, options, '1.0.1' );
	} );

	it( 'should return latest version from file using custom pattern with null flags', async ( t, testDir ) => {
		const options = { in: { file: testDir + '/versions.txt', search: { pattern: 'this: ([0-9.]+)', flags: null } } };
		await testGetLatestVersion( t, options, '1.0.1' );
	} );

	it( 'should return latest version from file using null search', async ( t, testDir ) => {
		const options = { in: { file: testDir + '/versions.txt', search: null } };
		await testGetLatestVersion( t, options, '1.0.0' );
	} );

	it( 'should return latest version from file using custom pattern with named capturing group', async ( t, testDir ) => {
		const options = { in: { file: testDir + '/versions.txt', search: '(this): (?<version>[0-9.]+)' } };
		await testGetLatestVersion( t, options, '1.0.1' );
	} );

	it( 'should return latest version from file using custom pattern with multiple capturing groups', async ( t, testDir ) => {
		const options = { in: { file: testDir + '/versions.txt', search: { pattern: '(this): ([0-9.]+)', versionCaptureGroup: 2 } } };
		await testGetLatestVersion( t, options, '1.0.1' );
	} );

	it( 'should return latest version from file using custom pattern and versionCaptureGroup 0', async ( t, testDir ) => {
		const options = { in: { file: testDir + '/versions.txt', search: { pattern: '([0-9]+)\\.([0-9]+)\\.([0-9]+)', versionCaptureGroup: 0 } } };
		await testGetLatestVersion( t, options, '1.0.0' );
	} );

	it( 'should return latest version from file using custom pattern and named versionCaptureGroup', async ( t, testDir ) => {
		const options = { in: { file: testDir + '/versions.txt', search: { pattern: '(this): (?<special>[0-9.]+)', versionCaptureGroup: 'special' } } };
		await testGetLatestVersion( t, options, '1.0.1' );
	} );

	it( 'should return latest version from file using custom pattern with flags', async ( t, testDir ) => {
		const options = { in: { file: testDir + '/versions.txt', search: { pattern: 'THIS: ([0-9.]+)', flags: 'i' } } };
		await testGetLatestVersion( t, options, '1.0.1' );
	} );

	it( 'should return latest version from file using global pattern with flags', async ( t, testDir ) => {
		const options = { search: { pattern: 'THIS: ([0-9.]+)', flags: 'i' }, in: testDir + '/versions.txt' };
		await testGetLatestVersion( t, options, '1.0.1' );
	} );

	it( 'should return latest version from file with given encoding', async ( t, testDir ) => {
		writeFile( testDir + '/version.txt', '1.0.1', 'ucs2' );
		const options = { in: { file: testDir + '/version.txt', encoding: 'ucs2' } };
		await testGetLatestVersion( t, options, '1.0.1' );
	} );

	describe( 'search placeholders', () => {

		it( 'should find the current date', async ( t, testDir ) => {
			writeFile( testDir + '/version.txt', `1.0.1 - [${dateFns.format( new Date(), 'yyyy-MM-dd' )}]` );
			const options = { in: { file: testDir + '/version.txt', search: '([0-9.]+) - \\[{{now:yyyy-MM-dd}}\\]' } };
			await testGetLatestVersion( t, options, '1.0.1' );
		} );

		it( 'should find a semantic version', async ( t, testDir ) => {
			writeFile( testDir + '/version.txt', '2.2 - 1.0.1' );
			const options = { in: { file: testDir + '/version.txt', search: '{{semver}}' } };
			await testGetLatestVersion( t, options, '1.0.1' );
		} );

		it( 'should find a literal placeholder', async ( t, testDir ) => {
			writeFile( testDir + '/version.txt', '{{foo}} - 1.0.1' );
			const options = { in: { file: testDir + '/version.txt', search: '{{{}}{foo}} - ([0-9.]+)' } };
			await testGetLatestVersion( t, options, '1.0.1' );
		} );

		it( 'should throw if there are unknown placeholders', async ( t, testDir ) => {
			const options = { in: { file: testDir + '/versions.txt', search: '{{version}}' } };
			await t.throwsAsync( async () => {
				await testGetLatestVersion( t, options, '1.0.1' );
			}, { message: 'Unknown placeholder encountered: {{version}}' } );
		} );

		it( 'should throw if there are malicious placeholders', async ( t, testDir ) => {
			const options = { in: { file: testDir + '/versions.txt', search: '{{constructor}}' } };
			await t.throwsAsync( async () => {
				await testGetLatestVersion( t, options, '1.0.1' );
			}, { message: 'Unknown placeholder encountered: {{constructor}}' } );
		} );

		it( 'should throw if the format is missing in "now" placeholder', async ( t, testDir ) => {
			const options = { in: { file: testDir + '/versions.txt', search: '{{now}}' } };
			await t.throwsAsync( async () => {
				await testGetLatestVersion( t, options, '1.0.1' );
			}, { message: "Missing required parameter 'format' for placeholder {{now}}" } );
		} );

	} );

} );



//####### Bump (Output) Tests #######

describe( 'Bump (Output)', () => {

	const testBump = async ( t, testDir, pluginOptions, expectedContent, newVersion = '1.2.3' ) => {
		const { plugin } = await setupPlugin( pluginOptions );
		await plugin.bump( newVersion );
		t.deepEqual( readFile( testDir + '/versions.txt' ), expectedContent );
	};

	it( 'should write version to file', async ( t, testDir ) => {
		const pluginOptions = { out: testDir + '/versions.txt' };
		await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
	} );

	it( 'should write version to file using null search and replace', async ( t, testDir ) => {
		const pluginOptions = { out: { file: testDir + '/versions.txt', search: null, replace: null } };
		await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
	} );

	it( 'should throw if out file cannot be read', async ( t ) => {
		const pluginOptions = { out: 'file_which_does_not_exist.txt' };
		const { plugin } = await setupPlugin( pluginOptions );
		await t.throwsAsync( async () => {
			await plugin.bump( '1.2.3' );
		} );
	} );

	it( 'should warn if out file did not change', async ( t, testDir ) => {
		const pluginOptions = { out: testDir + '/unrelated.txt' };
		const { plugin, container } = await setupPlugin( pluginOptions );
		await t.notThrowsAsync( async () => {
			await plugin.bump( '1.2.3' );
		} );
		t.deepEqual( readFile( testDir + '/unrelated.txt' ), 'nothing to see here.' );
		t.assert( container.log.warn.called, 'No warning was logged' );
		assertLogMessage( t, container.log.warn, /\/unrelated\.txt" did not change/, 'warning regarding unchanged file was not logged' );
	} );


	const testBumpThisVersion = async ( t, testDir, pluginOptions ) => {
		await testBump( t, testDir, pluginOptions, 'some: 1.0.0\nthis: 1.2.3\nother: 2.0.0\n' );
	};

	describe( 'global options', () => {

		it( 'should replace matches using global search pattern and overridden search flags', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', search: { flags: 'g' } } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.2.3\nother: 1.2.3\n' );
		} );

		it( 'should replace matches using global search flags', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt' }, search: { flags: 'g' } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.2.3\nother: 1.2.3\n' );
		} );

		it( 'should replace matches using overridden search flags', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', search: { flags: '' } }, search: { flags: 'g' } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
		} );

		it( 'should write version to file using global pattern', async ( t, testDir ) => {
			const pluginOptions = { search: '(?<=this: )([0-9.]+)', out: { file: testDir + '/versions.txt' } };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should write version to file using global pattern with flags', async ( t, testDir ) => {
			const pluginOptions = { search: { pattern: '(?<=THIS: )([0-9.]+)', flags: 'i' }, out: testDir + '/versions.txt' };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should write version to file using global pattern and global replace', async ( t, testDir ) => {
			const pluginOptions = { search: '(this:) ([0-9.]+)', replace: '$1 {{version}}', out: testDir + '/versions.txt' };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

	} );

	describe( 'out options', () => {

		it( 'should write version to file using custom pattern', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', search: '(?<=this: )([0-9.]+)' } };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should write version to file using custom pattern with flags', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', search: { pattern: '(?<=THIS: )([0-9.]+)', flags: 'i' } } };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should write version to file using custom pattern and custom replace', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', search: 'this: [0-9.]+', replace: 'this: {{version}}' } };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should write version to file using custom pattern and custom replace with capturing group', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', search: '(this:) [0-9.]+', replace: '$1 {{version}}' } };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should write version to file using custom pattern and custom replace with named capturing group', async ( t, testDir ) => {
			// eslint-disable-next-line no-template-curly-in-string
			const pluginOptions = { out: { file: testDir + '/versions.txt', search: '(?<prefix>this:) [0-9.]+', replace: '${prefix} {{version}}' } };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should write version to all matches in file', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', search: { pattern: '([0-9.]+)', flags: 'g' } } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.2.3\nother: 1.2.3\n' );
		} );

		it( 'should write version to different matches in same file', async ( t, testDir ) => {
			const pluginOptions = { out: [ { file: testDir + '/versions.txt', search: '(?<=this: )([0-9.]+)' }, { file: testDir + '/versions.txt', search: '(?<=other: )([0-9.]+)' } ] };
			await testBump( t, testDir, pluginOptions, 'some: 1.0.0\nthis: 1.2.3\nother: 1.2.3\n' );
		} );

		it( 'should write version to multiple files', async ( t, testDir ) => {
			const pluginOptions = { out: [ testDir + '/versions.txt', testDir + '/VERSION' ] };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
			t.deepEqual( readFile( testDir + '/VERSION' ), '1.2.3' );
		} );

		it( 'should write version to multiple files using glob pattern', async ( t, testDir ) => {
			writeFile( testDir + '/version.txt', '1.0.1' );
			const pluginOptions = { out: [ testDir + '/version*.txt', testDir + '/VERSION' ] };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
			t.deepEqual( readFile( testDir + '/version.txt' ), '1.2.3' );
			t.deepEqual( readFile( testDir + '/VERSION' ), '1.2.3' );
		} );

		it( 'should write version to multiple files using same options', async ( t, testDir ) => {
			const pluginOptions = { out: { files: [ testDir + '/versions.txt', testDir + '/VERSION' ], replace: '{{version}}-dev' } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3-dev\nthis: 1.0.1\nother: 2.0.0\n' );
			t.deepEqual( readFile( testDir + '/VERSION' ), '1.2.3-dev' );
		} );

		it( 'should write version to multiple files using glob pattern and same options', async ( t, testDir ) => {
			writeFile( testDir + '/version.txt', '1.0.1' );
			const pluginOptions = { out: { files: [ testDir + '/version*.txt', testDir + '/VERSION' ], replace: '{{version}}-dev' } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3-dev\nthis: 1.0.1\nother: 2.0.0\n' );
			t.deepEqual( readFile( testDir + '/version.txt' ), '1.2.3-dev' );
			t.deepEqual( readFile( testDir + '/VERSION' ), '1.2.3-dev' );
		} );

		it( 'should write version to out.file and out.files', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', files: testDir + '/VERSION' } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
			t.deepEqual( readFile( testDir + '/VERSION' ), '1.2.3' );
		} );

		it( 'should write version to out.file if out.files is null', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', files: null } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
		} );

		it( 'should write version to out.files if out.file is null', async ( t, testDir ) => {
			const pluginOptions = { out: { file: null, files: testDir + '/versions.txt' } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
		} );

		it( 'should write version to multiple files using different patterns', async ( t, testDir ) => {
			const pluginOptions = { out: [ { file: testDir + '/versions.txt', search: '(?<=this: )([0-9.]+)' }, testDir + '/VERSION' ] };
			await testBump( t, testDir, pluginOptions, 'some: 1.0.0\nthis: 1.2.3\nother: 2.0.0\n' );
			t.deepEqual( readFile( testDir + '/VERSION' ), '1.2.3' );
		} );

	} );

	describe( 'search placeholders', () => {

		it( 'should find the current version', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1', out: { file: testDir + '/versions.txt', search: '(?<=this: ){{version}}' } };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should find main version parts', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1', out: { file: testDir + '/versions.txt', search: '{{major}}\\.{{minor}}\\.{{patch}}' } };
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should find secondary version parts', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1-alpha.3+build.12', out: { file: testDir + '/versions.txt',
				search: '{{major}}\\.{{minor}}\\.{{patch}}-{{prerelease}}\\+{{build}}' } };
			writeFile( testDir + '/versions.txt', `some: 1.0.0\nthis: ${pluginOptions.latestVersion}\nother: 2.0.0\n` );
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should find prefixed secondary version parts', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1-alpha.3+build.12', out: { file: testDir + '/versions.txt',
				search: '{{major}}\\.{{minor}}\\.{{patch}}{{prefixedPrerelease}}{{prefixedBuild}}' } };
			writeFile( testDir + '/versions.txt', `some: 1.0.0\nthis: ${pluginOptions.latestVersion}\nother: 2.0.0\n` );
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should find custom version representations', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1-alpha.3+build.12', out: { file: testDir + '/versions.txt',
				search: '{{versionWithoutPrerelease}}/{{versionWithoutBuild}}' } };
			writeFile( testDir + '/versions.txt', 'some: 1.0.0\nthis: 1.0.1/1.0.1-alpha.3\nother: 2.0.0\n' );
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should find a literal placeholder', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1', out: { file: testDir + '/versions.txt',
				search: '{{{}}{placeholder}}' } };
			writeFile( testDir + '/versions.txt', 'some: 1.0.0\nthis: {{placeholder}}\nother: 2.0.0\n' );
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should find the current date', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1', out: { file: testDir + '/versions.txt',
				search: '{{now:yyyy-MM-dd}}' } };
			writeFile( testDir + '/versions.txt', `some: 1.0.0\nthis: ${dateFns.format( new Date(), 'yyyy-MM-dd' )}\nother: 2.0.0\n` );
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should find a semantic version', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1', out: { file: testDir + '/versions.txt', search: '{{semver}}' } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
		} );

		it( 'should find the new version', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1', out: { file: testDir + '/versions.txt',
				search: '{{newVersion}}' } };
			writeFile( testDir + '/versions.txt', 'some: 1.0.0\nthis: 1.2.3\nother: 2.0.0\n' );
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

		it( 'should find the tag', async ( t, testDir ) => {
			const pluginOptions = { latestVersion: '1.0.1', latestTag: 'foo', out: { file: testDir + '/versions.txt',
				search: '{{tag}}' } };
			writeFile( testDir + '/versions.txt', 'some: 1.0.0\nthis: foo\nother: 2.0.0\n' );
			await testBumpThisVersion( t, testDir, pluginOptions );
		} );

	} );

	describe( 'replace placeholders', () => {

		it( 'should write date to file', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/copyright.txt', search: '\\d{4}', replace: '{{now}}' } };
			const { plugin } = await setupPlugin( pluginOptions );
			const beforeTime = new Date();
			await plugin.bump( '1.2.3' );
			const afterTime = new Date();
			const fileContent = await readFile( testDir + '/copyright.txt' );
			const fileContentMatch = /^Copyright \(c\) (.+) Foo Bar$/.exec( fileContent );
			t.assert( fileContentMatch );
			t.assert( fileContentMatch[ 1 ] );
			const parsedDate = dateFns.parseISO( fileContentMatch[ 1 ] );
			t.assert( dateFns.isValid( parsedDate ) );
			t.assert( dateFns.differenceInSeconds( beforeTime, parsedDate ) <= 1 );
			t.assert( dateFns.differenceInSeconds( parsedDate, afterTime ) <= 1 );
		} );

		it( 'should write date to file using format', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/copyright.txt', search: '\\d{4}', replace: '{{now:yyyy}}' } };
			const { plugin } = await setupPlugin( pluginOptions );
			await plugin.bump( '1.2.3' );
			t.deepEqual( readFile( testDir + '/copyright.txt' ), `Copyright (c) ${dateFns.format( new Date(), 'yyyy' )} Foo Bar` );
		} );

		it( 'should throw when using Moment.js date format', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/copyright.txt', search: '\\d{4}', replace: '{{now:YYYY}}' } };
			const { plugin } = await setupPlugin( pluginOptions );
			await t.throwsAsync( async () => {
				await plugin.bump( '1.2.3' );
			}, { instanceOf: RangeError } );
		} );

		it( 'should write main version placeholders to file', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', replace: '{{major}}.{{minor}}.{{patch}}' } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
		} );

		it( 'should write secondary version placeholders to file', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', replace: '-{{prerelease}}+{{build}}' } };
			await testBump( t, testDir, pluginOptions, 'some: -alpha.1+build.17\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
		} );

		it( 'should write prefixed secondary version placeholders to file', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', replace: '{{prefixedPrerelease}}{{prefixedBuild}}' } };
			await testBump( t, testDir, pluginOptions, 'some: -alpha.1+build.17\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
		} );

		it( 'should write custom version placeholders to file', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', replace: '{{versionWithoutPrerelease}}/{{versionWithoutBuild}}' } };
			await testBump( t, testDir, pluginOptions, 'some: 1.2.3/1.2.3-alpha.1\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
		} );

		it( 'should write empty strings for empty placeholders to file', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', replace: '-{{prerelease}}+{{build}}/{{prefixedPrerelease}}{{prefixedBuild}}' } };
			await testBump( t, testDir, pluginOptions, 'some: -+/\nthis: 1.0.1\nother: 2.0.0\n' );
		} );

		it( 'should throw if there are unknown placeholders', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', replace: '{{foo}}.{{bar}}' } };
			const { plugin } = await setupPlugin( pluginOptions );
			await t.throwsAsync( async () => {
				await plugin.bump( '1.2.3' );
			}, { message: 'Unknown placeholder encountered: {{foo}}' } );
		} );

		it( 'should throw if there are malicious placeholders', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', replace: '{{constructor}}' } };
			const { plugin } = await setupPlugin( pluginOptions );
			await t.throwsAsync( async () => {
				await plugin.bump( '1.2.3' );
			}, { message: 'Unknown placeholder encountered: {{constructor}}' } );
		} );

		it( 'should write literal curly brace to file', async ( t, testDir ) => {
			const pluginOptions = { out: { file: testDir + '/versions.txt', replace: '{{{}}{foo}}' } };
			await testBump( t, testDir, pluginOptions, 'some: {{foo}}\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
		} );

	} );

	describe( 'encoding option', () => {

		it( 'should write version to file with given encoding', async ( t, testDir ) => {
			writeFile( testDir + '/version.txt', '1.0.1', 'ucs2' );
			const pluginOptions = { out: { file: testDir + '/version.txt', encoding: 'ucs2' } };
			const { plugin } = await setupPlugin( pluginOptions );
			await plugin.bump( '1.2.3' );
			t.deepEqual( readFile( testDir + '/version.txt', 'ucs2' ), '1.2.3' );
		} );

	} );

	describe( 'dry run', () => {

		const testDryRunBump = async ( t, testDir, pluginOptions ) => {
			const { plugin, container } = await setupPlugin( pluginOptions, { 'dry-run': true } );
			await t.notThrowsAsync( async () => {
				await plugin.bump( '1.2.3' );
			} );
			t.deepEqual( readFile( testDir + '/versions.txt' ), 'some: 1.0.0\nthis: 1.0.1\nother: 2.0.0\n' );
			t.deepEqual( readFile( testDir + '/VERSION' ), '1.0.1' );
			t.deepEqual( readFile( testDir + '/unrelated.txt' ), 'nothing to see here.' );
			return container;
		};

		it( 'should not write', async ( t, testDir ) => {
			const pluginOptions = { out: testDir + '/versions.txt' };
			const container = await testDryRunBump( t, testDir, pluginOptions );
			t.assert( !container.log.warn.called, `Unexpected warnings: ${container.log.warn.args}` );
			t.assert( container.log.exec.called, 'no diff was logged' );
			assertLogMessage( t, container.log.exec, /-some: 1\.0\.0/ );
			assertLogMessage( t, container.log.exec, /\+some: 1\.2\.3/ );
		} );

		it( 'should report all changes', async ( t, testDir ) => {
			const pluginOptions = { search: { pattern: '([0-9.]+)', flags: 'g' }, out: [ testDir + '/versions.txt', testDir + '/VERSION' ] };
			const container = await testDryRunBump( t, testDir, pluginOptions );
			t.assert( container.log.exec.called, 'no diff was logged' );
			assertLogMessage( t, container.log.info, /Updating .*\/versions.txt/ );
			assertLogMessage( t, container.log.exec, /-some: 1\.0\.0/ );
			assertLogMessage( t, container.log.exec, /\+some: 1\.2\.3/ );
			assertLogMessage( t, container.log.exec, /-this: 1\.0\.1/ );
			assertLogMessage( t, container.log.exec, /\+this: 1\.2\.3/ );
			assertLogMessage( t, container.log.exec, /-other: 2\.0\.0/ );
			assertLogMessage( t, container.log.exec, /\+other: 1\.2\.3/ );
			assertLogMessage( t, container.log.info, /Updating .*\/VERSION/ );
			assertLogMessage( t, container.log.exec, /-1\.0\.1/ );
			assertLogMessage( t, container.log.exec, /\+1\.2\.3/ );
		} );

		it( 'should warn in dry run if out file would not change', async ( t, testDir ) => {
			const pluginOptions = { out: testDir + '/unrelated.txt' };
			const container = await testDryRunBump( t, testDir, pluginOptions );
			t.assert( container.log.warn.called, 'no warnings were logged' );
			assertLogMessage( t, container.log.warn, /\/unrelated\.txt" did not change/, 'warning regarding unchanged file was not logged' );
		} );

		it( 'should report all changes in dry run without diff', async ( t, testDir ) => {
			const pluginOptions = { search: { pattern: '([0-9.]+)', flags: 'g' }, out: [ testDir + '/versions.txt', testDir + '/VERSION' ] };
			testdouble.replaceEsm( 'diff', null, null );
			const { plugin, container } = await setupPlugin( pluginOptions, { 'dry-run': true } );
			await plugin.bump( '1.2.3' );
			t.deepEqual( readFile( testDir + '/versions.txt' ), 'some: 1.0.0\nthis: 1.0.1\nother: 2.0.0\n' );
			t.deepEqual( readFile( testDir + '/VERSION' ), '1.0.1' );
			t.assert( container.log.exec.called, 'no diff was logged' );
			assertLogMessage( t, container.log.info, /Updating .*\/versions.txt/ );
			assertLogMessage( t, container.log.exec, /.*line 1[\s\S]*1\.0\.0/ );
			assertLogMessage( t, container.log.exec, /.*line 2[\s\S]*1\.0\.1/ );
			assertLogMessage( t, container.log.exec, /.*line 3[\s\S]*2\.0\.0/ );
			assertLogMessage( t, container.log.info, /Updating .*\/VERSION/ );
			assertLogMessage( t, container.log.exec, /.*line 1[\s\S]*1\.0\.1/ );
		} );

		it( 'should warn in dry run without diff if out file would not change', async ( t, testDir ) => {
			const pluginOptions = { out: testDir + '/unrelated.txt' };
			testdouble.replaceEsm( 'diff', null, null );
			const container = await testDryRunBump( t, testDir, pluginOptions );
			t.assert( container.log.warn.called, 'no warnings were logged' );
			assertLogMessage( t, container.log.warn, /\/unrelated\.txt" did not change/, 'warning regarding unchanged file was not logged' );
		} );

	} );

} );


describe( 'End-to-End', () => {

	const runPlugin = async pluginOptions => {
		const { plugin } = await setupPlugin( pluginOptions );
		return runTasks( plugin );
	};

	it( 'should not throw if nothing is configured', async ( t ) => {
		const pluginOptions = {};
		await t.notThrowsAsync( async () => {
			await runPlugin( pluginOptions );
		} );
	} );

	it( 'should not throw if in and out is null', async ( t ) => {
		const pluginOptions = { in: null, out: null };
		await t.notThrowsAsync( async () => {
			await runPlugin( pluginOptions );
		} );
	} );

	it( 'should read and write same file', async ( t, testDir ) => {
		const pluginOptions = { in: testDir + '/VERSION', out: testDir + '/VERSION' };
		await runPlugin( pluginOptions );
		t.deepEqual( readFile( testDir + '/VERSION' ), '1.0.2' );
	} );

	it( 'should read and write different files', async ( t, testDir ) => {
		const pluginOptions = { in: testDir + '/VERSION', out: testDir + '/versions.txt' };
		await runPlugin( pluginOptions );
		t.deepEqual( readFile( testDir + '/VERSION' ), '1.0.1' );
		t.deepEqual( readFile( testDir + '/versions.txt' ), 'some: 1.0.2\nthis: 1.0.1\nother: 2.0.0\n' );
	} );

	it( 'should read and write multiple files', async ( t, testDir ) => {
		const pluginOptions = { in: testDir + '/VERSION', out: [ testDir + '/VERSION', { file: testDir + '/versions.txt', search: 'this: [0-9.]+', replace: 'this: {{version}}' } ] };
		await runPlugin( pluginOptions );
		t.deepEqual( readFile( testDir + '/VERSION' ), '1.0.2' );
		t.deepEqual( readFile( testDir + '/versions.txt' ), 'some: 1.0.0\nthis: 1.0.2\nother: 2.0.0\n' );
	} );

	it( 'should write latest version to file', async ( t, testDir ) => {
		const pluginOptions = { in: testDir + '/VERSION', out: { file: testDir + '/versions.txt', replace: '{{latestVersion}}' } };
		await runPlugin( pluginOptions );
		t.deepEqual( readFile( testDir + '/versions.txt' ), 'some: 1.0.1\nthis: 1.0.1\nother: 2.0.0\n' );
	} );

	it( 'should write latest tag to file', async ( t, testDir ) => {
		const pluginOptions = { in: testDir + '/VERSION', out: { file: testDir + '/versions.txt', replace: '{{latestTag}}' } };
		const { plugin } = await setupPlugin( pluginOptions, { latestTag: '1.0.1' } );
		await runTasks( plugin );
		t.deepEqual( readFile( testDir + '/versions.txt' ), 'some: 1.0.1\nthis: 1.0.1\nother: 2.0.0\n' );
	} );

	it( 'should replace the current version', async ( t, testDir ) => {
		const pluginOptions = { in: testDir + '/VERSION', out: { file: testDir + '/versions.txt', search: '{{version}}' } };
		await runPlugin( pluginOptions );
		t.deepEqual( readFile( testDir + '/versions.txt' ), 'some: 1.0.0\nthis: 1.0.2\nother: 2.0.0\n' );
	} );

} );
