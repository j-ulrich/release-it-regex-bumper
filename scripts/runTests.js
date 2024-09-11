import * as process from 'process';
import * as childProcess from 'child_process';
import * as os from 'os';
import chalk from 'chalk';

const nodeVersion = process.versions.node.split( /[.+-]/ ).map( section => {
	const numericSection = parseInt( section, 10 );
	if ( isNaN( numericSection ) || String( numericSection ) !== section ) {
		return section;
	}
	return numericSection;
} );

let executable = 'node';

const parameters = [
	'./node_modules/ava/entrypoints/cli.mjs',
	'--serial' // Needed because the module mocking (`testdouble.replaceEsm()`) cannot run in parallel
];

const minimumVersionForRegisterSupport = {
	major: 20,
	minor: 6
};

if ( nodeVersion[0] < minimumVersionForRegisterSupport.major ||
	( nodeVersion[0] === minimumVersionForRegisterSupport.major &&
		nodeVersion[1] < minimumVersionForRegisterSupport.minor ) ) {
	// testDouble uses 'register()' if available
	// in older versions of Node, we need to configure it as loader
	parameters.unshift( '--experimental-loader=testdouble' );
}

if ( process.argv.indexOf( '--coverage' ) > 0 ) {
	executable = 'npx';
	if ( os.type().startsWith( 'Windows' ) ) {
		executable = 'npx.cmd';
	}
	parameters.unshift( 'c8', 'node' );
}

console.info( 'Starting tests...' );
console.debug( chalk.dim( '  Command line: ', executable, parameters.join( ' ' ) ) );
console.info( '' );

const result = childProcess.spawnSync( executable, parameters, {
	encoding: 'utf-8',
	stdio: 'inherit',
	shell: true, // needed for npx.cmd
	windowsHide: true,
} );

if ( result.error ) {
	console.error( 'Tests failed with error:', result.error );
}
process.exit( result.status );
