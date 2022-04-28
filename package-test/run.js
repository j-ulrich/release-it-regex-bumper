/* eslint-disable security/detect-child-process */

import * as temp from 'temp';
import { execSync } from 'child_process';
import { dirname, join as pathJoin } from 'path';
import { copyFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );

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
	exec( `npm install "${pathJoin( __dirname, '..' )}"` );
	exec( 'npx release-it --dry-run --no.git --no.npm --ci' );
}

function copyTestPackageFile( fileName ) {
	copyFileSync( pathJoin( __dirname, fileName ), pathJoin( tempDir, fileName ) );
}

function exec( command ) {
	console.log( '>', command );
	execSync( command, { stdio: 'inherit' } );
}

try {
	main();
}
finally {
	// Ensure we "leave" the tempDir. Else it cannot be deleted.
	process.chdir( originalCwd );
}

