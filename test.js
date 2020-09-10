const fs = require( 'fs' );
const moment = require( 'moment' );
const crypto = require( 'crypto' );
const assert = require( 'assert' ).strict;
const test = require( 'bron' );
const mockFs = require( 'mock-fs' );
const rewiremock = require( 'rewiremock/node' );
const { factory, runTasks } = require( 'release-it/test/util' );
const semver = require( 'semver' );
const releaseItVersion = semver.parse( require( 'release-it/package.json' ).version );
const PluginWithoutDiff = rewiremock.proxy ( () => require( '.' ), mock => {
	return {
		'diff': mock.with( null )
	};
} );
const Plugin = require( '.' );

const namespace = '@j-ulrich/release-it-regex-bumper';

const readFile = ( file, encoding ) => fs.readFileSync( file ).toString( encoding );
const writeFile = ( file, content, encoding ) => fs.writeFileSync( file, content, { encoding } );

mockFs();

const setupTestDir = () => {
	const dirName = 'testDir_' + crypto.randomBytes( 4 ).readUInt32LE( 0 );
	fs.mkdirSync( dirName );
	writeFile( dirName + '/versions.txt', 'some: 1.0.0\nthis: 1.0.1\nother: 2.0.0\n' );
	writeFile( dirName + '/VERSION', '1.0.1' );
	writeFile( dirName + '/copyright.txt', 'Copyright (c) 2019 Foo Bar' );
	writeFile( dirName + '/unrelated.txt',  'nothing to see here.' );
	return dirName;
};

const it = ( description, testFunc ) => {
	test( description, () => {
		const testDir = setupTestDir();
		const result = testFunc( testDir );
		return result;
	} );
};


const setupPlugin = ( pluginOptions, generalOptions, pluginModule = Plugin ) => {
	const options = Object.assign( { [namespace]: pluginOptions }, generalOptions );
	let container = {};
	const plugin = factory( pluginModule, { namespace, options, container } );
	return { plugin, container };
};

const assertLogMessage = ( logType, messageRegEx, failMessage ) => {
	assert( logType.args.findIndex( args => messageRegEx.test( args[ 0 ] ) ) > -1, failMessage );
};


//####### GetLatestVersion (Input) Tests #######

it( 'should throw if in file is not specified', async () => {
	const pluginOptions = { in: {} };
	const { plugin } = setupPlugin( pluginOptions );
	await assert.rejects( plugin.getLatestVersion(), Error );
} );

it( 'should throw if in file cannot be read', async () => {
	const pluginOptions = { in: 'file_which_does_not_exist.txt' };
	const { plugin } = setupPlugin( pluginOptions );
	await assert.rejects( plugin.getLatestVersion(), Error );
} );

it( 'should throw if version cannot be extracted', async ( testDir ) => {
	const pluginOptions = { in: testDir+'/unrelated.txt' };
	const { plugin } = setupPlugin( pluginOptions );
	await assert.rejects( plugin.getLatestVersion(), err => {
		assert( /could not extract version/i.test( err.message ) );
		return true;
	} );
} );

const testGetLatestVersion = async ( pluginOptions, expectedVersion ) => {
	const { plugin } = setupPlugin( pluginOptions );
	const actualVersion = await plugin.getLatestVersion();
	assert.equal( actualVersion, expectedVersion );
};

it( 'should return latest version from file', async ( testDir ) => {
	const options = { in: testDir+'/versions.txt' };
	await testGetLatestVersion( options, '1.0.0' );
});

it( 'should return latest version from file using custom pattern', async ( testDir ) => {
	const options = { in: { file: testDir+'/versions.txt', search: 'this: ([0-9.]+)' } };
	await testGetLatestVersion( options, '1.0.1' );
});

it( 'should return latest version from file using custom pattern with null version capture group', async ( testDir ) => {
	const options = { in: { file: testDir+'/versions.txt', search: { pattern: 'this: ([0-9.]+)', versionCaptureGroup: null } } };
	await testGetLatestVersion( options, '1.0.1' );
});

it( 'should return latest version from file using custom pattern with null flags', async ( testDir ) => {
	const options = { in: { file: testDir+'/versions.txt', search: { pattern: 'this: ([0-9.]+)', flags: null } } };
	await testGetLatestVersion( options, '1.0.1' );
});

it( 'should return latest version from file using null search', async ( testDir ) => {
	const options = { in: { file: testDir+'/versions.txt', search: null } };
	await testGetLatestVersion( options, '1.0.0' );
});

it( 'should return latest version from file using custom pattern with named capturing group', async ( testDir ) => {
	const options = { in: { file: testDir+'/versions.txt', search: '(this): (?<version>[0-9.]+)' } };
	await testGetLatestVersion( options, '1.0.1' );
});

it( 'should return latest version from file using custom pattern with multiple capturing groups', async ( testDir ) => {
	const options = { in: { file: testDir+'/versions.txt', search: { pattern: '(this): ([0-9.]+)', versionCaptureGroup: 2 } } };
	await testGetLatestVersion( options, '1.0.1' );
});

it( 'should return latest version from file using custom pattern and versionCaptureGroup 0', async ( testDir ) => {
	const options = { in: { file: testDir+'/versions.txt', search: { pattern: '([0-9]+)\.([0-9]+)\.([0-9]+)', versionCaptureGroup: 0 } } };
	await testGetLatestVersion( options, '1.0.0' );
});

it( 'should return latest version from file using custom pattern and named versionCaptureGroup', async ( testDir ) => {
	const options = { in: { file: testDir+'/versions.txt', search: { pattern: '(this): (?<special>[0-9.]+)', versionCaptureGroup: 'special' } } };
	await testGetLatestVersion( options, '1.0.1' );
});

it( 'should return latest version from file using custom pattern with flags', async ( testDir ) => {
	const options = { in: { file: testDir+'/versions.txt', search: { pattern: 'THIS: ([0-9.]+)', flags: 'i' } } };
	await testGetLatestVersion( options, '1.0.1' );
});

it( 'should return latest version from file using global pattern with flags', async ( testDir ) => {
	const options = { search: { pattern: 'THIS: ([0-9.]+)', flags: 'i' }, in: testDir+'/versions.txt' };
	await testGetLatestVersion( options, '1.0.1' );
});

it( 'should return latest version from file with given encoding', async ( testDir ) => {
	writeFile( testDir+'/version.txt', '1.0.1', 'ucs2' );
	const options = { in: { file: testDir+'/version.txt', encoding: 'ucs2' } };
	await testGetLatestVersion( options, '1.0.1' );
});


//####### Bump (Output) Tests #######

it( 'should write version to file', async ( testDir ) => {
	const pluginOptions = { out: testDir+'/versions.txt' };
	const { plugin } = setupPlugin( pluginOptions );
	await plugin.bump( '1.2.3' );
	assert.equal( readFile( testDir+'/versions.txt' ), 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
} );

it( 'should write version to file using null search and replace', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', search: null, replace: null } };
	const { plugin } = setupPlugin( pluginOptions );
	await plugin.bump( '1.2.3' );
	assert.equal( readFile( testDir+'/versions.txt' ), 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
} );

it( 'should throw if out file cannot be read', async () => {
	const pluginOptions = { out: 'file_which_does_not_exist.txt' };
	const { plugin } = setupPlugin( pluginOptions );
	await assert.rejects( plugin.bump( '1.2.3' ), Error );
} );

it( 'should warn if out file did not change', async ( testDir ) => {
	const pluginOptions = { out: testDir+'/unrelated.txt' };
	const { plugin, container } = setupPlugin( pluginOptions );
	await assert.doesNotReject( plugin.bump( '1.2.3' ) );
	assert.equal( readFile( testDir+'/unrelated.txt' ), 'nothing to see here.' );
	assert( container.log.warn.called, 'No warning was logged' );
	assertLogMessage( container.log.warn, /\/unrelated\.txt" did not change/, 'warning regarding unchanged file was not logged' );
} );

const testBump = async ( testDir, pluginOptions, expectedContent, newVersion='1.2.3' ) => {
	const { plugin } = setupPlugin( pluginOptions );
	await plugin.bump( newVersion );
	assert.equal( readFile( testDir+'/versions.txt' ), expectedContent );
};

const testBumpThisVersion = async ( testDir, pluginOptions ) => {
	await testBump( testDir, pluginOptions, 'some: 1.0.0\nthis: 1.2.3\nother: 2.0.0\n' );
};

it( 'should write version to file using custom pattern', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', search: '(?<=this: )([0-9.]+)' } };
	await testBumpThisVersion( testDir, pluginOptions );
} );

it( 'should write version to file using custom pattern with flags', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', search: { pattern: '(?<=THIS: )([0-9.]+)', flags: 'i' } } };
	await testBumpThisVersion( testDir, pluginOptions );
} );

it( 'should write version to file using global pattern', async ( testDir ) => {
	const pluginOptions = { search: '(?<=this: )([0-9.]+)', out: { file: testDir+'/versions.txt' } };
	await testBumpThisVersion( testDir, pluginOptions );
} );

it( 'should write version to file using global pattern with flags', async ( testDir ) => {
	const pluginOptions = { search: { pattern: '(?<=THIS: )([0-9.]+)', flags: 'i' }, out: testDir+'/versions.txt' };
	await testBumpThisVersion( testDir, pluginOptions );
} );

it( 'should write version to file using global pattern and global replace', async ( testDir ) => {
	const pluginOptions = { search: '(this:) ([0-9.]+)', replace: '$1 {{version}}', out: testDir+'/versions.txt' };
	await testBumpThisVersion( testDir, pluginOptions );
} );

it( 'should write version to file using custom pattern and custom replace', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', search: 'this: [0-9.]+', replace: 'this: {{version}}' } };
	await testBumpThisVersion( testDir, pluginOptions );
} );

it( 'should write version to file using custom pattern and custom replace with capturing group', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', search: '(this:) [0-9.]+', replace: '$1 {{version}}' } };
	await testBumpThisVersion( testDir, pluginOptions );
} );

it( 'should write version to file using custom pattern and custom replace with named capturing group', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', search: '(?<prefix>this:) [0-9.]+', replace: '${prefix} {{version}}' } };
	await testBumpThisVersion( testDir, pluginOptions );
} );

it( 'should write version to all matches in file', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', search: { pattern: '([0-9.]+)', flags: 'g' } } };
	await testBump( testDir, pluginOptions, 'some: 1.2.3\nthis: 1.2.3\nother: 1.2.3\n' );
} );

it( 'should write version to different matches in same file', async ( testDir ) => {
	const pluginOptions = { out: [ { file: testDir+'/versions.txt', search: '(?<=this: )([0-9.]+)' }, { file: testDir+'/versions.txt', search: '(?<=other: )([0-9.]+)' } ] };
	await testBump( testDir, pluginOptions, 'some: 1.0.0\nthis: 1.2.3\nother: 1.2.3\n' );
} );

it( 'should write version to multiple files', async ( testDir ) => {
	const pluginOptions = { out: [ testDir+'/versions.txt', testDir+'/VERSION' ] };
	await testBump( testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
	assert.equal( readFile( testDir+'/VERSION' ), '1.2.3' );
} );

it( 'should write version to multiple files using glob pattern', async ( testDir ) => {
	writeFile( testDir + '/version.txt', '1.0.1' );
	const pluginOptions = { out: [ testDir+'/version*.txt', testDir+'/VERSION' ] };
	await testBump( testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
	assert.equal( readFile( testDir+'/version.txt' ), '1.2.3' );
	assert.equal( readFile( testDir+'/VERSION' ), '1.2.3' );
} );

it( 'should write version to multiple files using same options', async ( testDir ) => {
	const pluginOptions = { out: { files: [ testDir+'/versions.txt', testDir+'/VERSION' ], replace: '{{version}}-dev' } };
	await testBump( testDir, pluginOptions, 'some: 1.2.3-dev\nthis: 1.0.1\nother: 2.0.0\n' );
	assert.equal( readFile( testDir+'/VERSION' ), '1.2.3-dev' );
} );

it( 'should write version to multiple files using glob pattern and same options', async ( testDir ) => {
	writeFile( testDir + '/version.txt', '1.0.1' );
	const pluginOptions = { out: { files: [ testDir+'/version*.txt', testDir+'/VERSION' ], replace: '{{version}}-dev' } };
	await testBump( testDir, pluginOptions, 'some: 1.2.3-dev\nthis: 1.0.1\nother: 2.0.0\n' );
	assert.equal( readFile( testDir+'/version.txt' ), '1.2.3-dev' );
	assert.equal( readFile( testDir+'/VERSION' ), '1.2.3-dev' );
} );

it( 'should write version to out.file and out.files', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', files: testDir+'/VERSION' } };
	await testBump( testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
	assert.equal( readFile( testDir+'/VERSION' ), '1.2.3' );
} );

it( 'should write version to out.file if out.files is null', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', files: null } };
	await testBump( testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
} );

it( 'should write version to out.files if out.file is null', async ( testDir ) => {
	const pluginOptions = { out: { file: null, files: testDir+'/versions.txt' } };
	await testBump( testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n' );
} );

it( 'should write version to multiple files using different patterns', async ( testDir ) => {
	const pluginOptions = { out: [ { file: testDir+'/versions.txt', search: '(?<=this: )([0-9.]+)' }, testDir+'/VERSION' ] };
	await testBump( testDir, pluginOptions, 'some: 1.0.0\nthis: 1.2.3\nother: 2.0.0\n' );
	assert.equal( readFile( testDir+'/VERSION' ), '1.2.3' );
} );

it( 'should write date to file', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/copyright.txt', search: '\\d{4}', replace: '{{now}}' } };
	const { plugin } = setupPlugin( pluginOptions );
	await plugin.bump( '1.2.3' );
	const fileContent = await readFile( testDir+'/copyright.txt' );
	const fileContentMatch = /^Copyright \(c\) (.+) Foo Bar$/.exec( fileContent );
	assert( fileContentMatch );
	assert( fileContentMatch[ 1 ] );
	const date = moment( fileContentMatch[ 1 ] );
	assert( date.isValid() );
	assert( moment().diff( date, 'seconds' ) < 5 );
} );

it( 'should write date to file using format', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/copyright.txt', search: '\\d{4}', replace: '{{now:YYYY}}' } };
	const { plugin } = setupPlugin( pluginOptions );
	await plugin.bump( '1.2.3' );
	assert.equal( readFile( testDir+'/copyright.txt' ), `Copyright (c) ${moment().format( 'YYYY' )} Foo Bar` );
} );

it( 'should write main version placeholders to file', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', replace: '{{major}}.{{minor}}.{{patch}}' } };
	await testBump( testDir, pluginOptions, 'some: 1.2.3\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
} );

it( 'should write secondary version placeholders to file', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', replace: '-{{prerelease}}+{{build}}' } };
	await testBump( testDir, pluginOptions, 'some: -alpha.1+build.17\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
} );

it( 'should write custom version placeholders to file', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', replace: '{{versionWithoutPrerelease}}/{{versionWithoutBuild}}' } };
	await testBump( testDir, pluginOptions, 'some: 1.2.3/1.2.3-alpha.1\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
} );

it( 'should write literal curly brace to file', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', replace: '{{{}}{foo}}' } };
	await testBump( testDir, pluginOptions, 'some: {{foo}}\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
} );

it( 'should write literal curly brace to file', async ( testDir ) => {
	const pluginOptions = { out: { file: testDir+'/versions.txt', replace: '{{{}}{foo}}' } };
	await testBump( testDir, pluginOptions, 'some: {{foo}}\nthis: 1.0.1\nother: 2.0.0\n', '1.2.3-alpha.1+build.17' );
} );

it( 'should write version to file with given encoding', async ( testDir ) => {
	writeFile( testDir+'/version.txt', '1.0.1', 'ucs2' );
	const pluginOptions = { out: { file: testDir+'/version.txt', encoding: 'ucs2' } };
	const { plugin } = setupPlugin( pluginOptions );
	await plugin.bump( '1.2.3' );
	assert.equal( readFile( testDir+'/version.txt', 'ucs2' ), '1.2.3' );
} );

const testDryRunBump = async ( testDir, pluginOptions ) => {
	const { plugin, container } = setupPlugin( pluginOptions, { 'dry-run': true } );
	await assert.doesNotReject( plugin.bump( '1.2.3' ) );
	assert.equal( readFile( testDir+'/versions.txt' ), 'some: 1.0.0\nthis: 1.0.1\nother: 2.0.0\n' );
	assert.equal( readFile( testDir+'/VERSION' ), '1.0.1' );
	assert.equal( readFile( testDir+'/unrelated.txt' ), 'nothing to see here.' );
	return container;
};

it( 'should not write in dry run', async ( testDir ) => {
	const pluginOptions = { out: testDir+'/versions.txt' };
	const container = await testDryRunBump( testDir, pluginOptions );
	assert( !container.log.warn.called, `Unexpected warnings: ${container.log.warn.args}` );
	assert( container.log.exec.called, 'no diff was logged' );
	assertLogMessage( container.log.exec, /-some: 1\.0\.0/ );
	assertLogMessage( container.log.exec, /\+some: 1\.2\.3/ );
} );

it( 'should report all changes in dry run', async ( testDir ) => {
	const pluginOptions = { search: { pattern: '([0-9.]+)', flags: 'g' }, out: [ testDir+'/versions.txt', testDir+'/VERSION' ] };
	const container = await testDryRunBump( testDir, pluginOptions );
	assert( container.log.exec.called, 'no diff was logged' );
	assertLogMessage( container.log.info, /Updating .*\/versions.txt/ );
	assertLogMessage( container.log.exec, /-some: 1\.0\.0/ );
	assertLogMessage( container.log.exec, /\+some: 1\.2\.3/ );
	assertLogMessage( container.log.exec, /-this: 1\.0\.1/ );
	assertLogMessage( container.log.exec, /\+this: 1\.2\.3/ );
	assertLogMessage( container.log.exec, /-other: 2\.0\.0/ );
	assertLogMessage( container.log.exec, /\+other: 1\.2\.3/ );
	assertLogMessage( container.log.info, /Updating .*\/VERSION/ );
	assertLogMessage( container.log.exec, /-1\.0\.1/ );
	assertLogMessage( container.log.exec, /\+1\.2\.3/ );
} );

it( 'should warn in dry run if out file would not change', async ( testDir ) => {
	const pluginOptions = { out: testDir+'/unrelated.txt' };
	const container = await testDryRunBump( testDir, pluginOptions );
	assert( container.log.warn.called, 'no warnings were logged' );
	assertLogMessage( container.log.warn, /\/unrelated\.txt" did not change/, 'warning regarding unchanged file was not logged' );
} );

it( 'should report all changes in dry run without diff', async ( testDir ) => {
	const pluginOptions = { search: { pattern: '([0-9.]+)', flags: 'g' }, out: [ testDir+'/versions.txt', testDir+'/VERSION' ] };
	const { plugin, container } = setupPlugin( pluginOptions, { 'dry-run': true }, PluginWithoutDiff );
	await plugin.bump( '1.2.3' );
	assert.equal( readFile( testDir+'/versions.txt' ), 'some: 1.0.0\nthis: 1.0.1\nother: 2.0.0\n' );
	assert.equal( readFile( testDir+'/VERSION' ), '1.0.1' );
	assert( container.log.exec.called, 'no diff was logged' );
	assertLogMessage( container.log.info, /Updating .*\/versions.txt/ );
	assertLogMessage( container.log.exec, /.*line 1[\s\S]*1\.0\.0/ );
	assertLogMessage( container.log.exec, /.*line 2[\s\S]*1\.0\.1/ );
	assertLogMessage( container.log.exec, /.*line 3[\s\S]*2\.0\.0/ );
	assertLogMessage( container.log.info, /Updating .*\/VERSION/ );
	assertLogMessage( container.log.exec, /.*line 1[\s\S]*1\.0\.1/ );
} );

it( 'should warn in dry run without diff if out file would not change', async ( testDir ) => {
	const pluginOptions = { out: testDir+'/unrelated.txt' };
	const { plugin, container } = setupPlugin( pluginOptions, { 'dry-run': true }, PluginWithoutDiff );
	await assert.doesNotReject( plugin.bump( '1.2.3' ) );
	assert.equal( readFile( testDir+'/unrelated.txt' ), 'nothing to see here.' );
	assert( container.log.warn.called, 'no warnings were logged' );
	assertLogMessage( container.log.warn, /\/unrelated\.txt" did not change/, 'warning regarding unchanged file was not logged' );
} );


//####### End-to-End Tests #######

const runPlugin = pluginOptions => {
	const { plugin } = setupPlugin( pluginOptions );
	return runTasks( plugin );
};

it( 'should not throw if nothing is configured', async () => {
	const pluginOptions = {};
	await assert.doesNotReject( runPlugin( pluginOptions ) );
} );

it( 'should not throw if in and out is null', async () => {
	const pluginOptions = { in: null, out: null };
	await assert.doesNotReject( runPlugin( pluginOptions ) );
} );

it( 'should read and write same file', async ( testDir ) => {
	const pluginOptions = { in: testDir+'/VERSION', out: testDir+'/VERSION' };
	await runPlugin( pluginOptions );
	assert.equal( readFile( testDir+'/VERSION' ), '1.0.2' );
} );

it( 'should read and write different files', async ( testDir ) => {
	const pluginOptions = { in: testDir+'/VERSION', out: testDir+'/versions.txt' };
	await runPlugin( pluginOptions );
	assert.equal( readFile( testDir+'/VERSION' ), '1.0.1' );
	assert.equal( readFile( testDir+'/versions.txt' ), 'some: 1.0.2\nthis: 1.0.1\nother: 2.0.0\n' );
} );

it( 'should read and write multiple files', async ( testDir ) => {
	const pluginOptions = { in: testDir+'/VERSION', out: [ testDir+'/VERSION', { file: testDir+'/versions.txt', search: 'this: [0-9.]+', replace: 'this: {{version}}' } ] };
	await runPlugin( pluginOptions );
	assert.equal( readFile( testDir+'/VERSION' ), '1.0.2' );
	assert.equal( readFile( testDir+'/versions.txt' ), 'some: 1.0.0\nthis: 1.0.2\nother: 2.0.0\n' );
} );

it( 'should write latest version to file', async ( testDir ) => {
	const pluginOptions = { in: testDir+'/VERSION', out: { file: testDir+'/versions.txt', replace: '{{latestVersion}}' } };
	await runPlugin( pluginOptions );
	assert.equal( readFile( testDir+'/versions.txt' ), 'some: 1.0.1\nthis: 1.0.1\nother: 2.0.0\n' );
} );

it( 'should write latest tag to file', async ( testDir ) => {
	if( semver.lt( releaseItVersion, '13.5.8' ) ) {
		return 'Skipped because `latestTag` is not available in tests before release-it 13.5.8';
	}
	const pluginOptions = { in: testDir+'/VERSION', out: { file: testDir+'/versions.txt', replace: '{{latestTag}}' } };
	await runPlugin( pluginOptions );
	assert.equal( readFile( testDir+'/versions.txt' ), 'some: 1.0.1\nthis: 1.0.1\nother: 2.0.0\n' );
} );
