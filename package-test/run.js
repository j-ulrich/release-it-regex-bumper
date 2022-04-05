'use strict';

const temp = require( 'temp' );
const childProcess = require( 'child_process' );
const path = require( 'path' );
const fs = require( 'fs' );

const originalCwd = process.cwd();
temp.track();
const tempDir = temp.mkdirSync();

function main() {

	process.chdir( tempDir );
	console.info( 'Running in directory', tempDir );

	copyTestPackageFile( 'package.json' );
	copyTestPackageFile( '.release-it.json' );
	copyTestPackageFile( 'version.txt' );

	exec( 'npm install' );
	exec( `npm install "${path.join( __dirname, '..' )}"` );
	exec( 'npx release-it --dry-run --no.git --no.npm --ci' );
}

function copyTestPackageFile( fileName ) {
	fs.copyFileSync( path.join( __dirname, fileName ), path.join( tempDir, fileName ) );
}

function exec( command ) {
	console.log( '>', command );
	childProcess.execSync( command, { stdio: 'inherit' } );
}

try {
	main();
}
finally {
	// Ensure we "leave" the tempDir. Else it cannot be deleted.
	process.chdir( originalCwd );
}

