import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import JSON5 from 'json5';
import test from 'ava';

const typeTestDir = path.dirname( fileURLToPath( import.meta.url ) );

function getTSConfig() {
	return JSON5.parse( fs.readFileSync( path.join( typeTestDir, 'tsconfig.json' ), { encoding: 'utf8' } ) );
}

const tsConfig = getTSConfig();

function execTypeTest( fileName ) {
	const cliParams = tsConfigToCliParams( tsConfig );
	execSync( `npx tsc --ignoreConfig ${cliParams.join( ' ' )} ${fileName}`, {
		cwd: typeTestDir,
		encoding: 'utf8'
	} );
}

function tsConfigToCliParams( config ) {
	const params = [];
	if ( config.compilerOptions ) {
		for ( const [ key, value ] of Object.entries( config.compilerOptions ) ) {
			const serializedValue = Array.isArray( value ) ? value.join( ',' ) : value;
			params.push( `--${key}`, serializedValue );
		}
	}

	return params;
}

/**
 * @param {string} fileName
 * @param {RegExp} expectedError
 */
function typeTest( fileName, expectedError = null ) {
	const testFunc = () => execTypeTest( fileName );
	test( fileName, t => {
		if ( expectedError === null ) {
			t.notThrows( testFunc );
			return;
		}
		/**
		 *
		 */
		const error = t.throws( testFunc );
		t.regex( error.stdout, expectedError );
	}
	);
}

typeTest( 'valid-configs.ts' );
typeTest( 'complete-release-it-config.ts' );
typeTest( 'invalid-configs/in-object-without-file.ts',
	/Type '\{ search: string; \}' is not assignable to type 'string \| InputOptions \| null \| undefined'.\n *Property 'file' is missing in type '\{ search: string; \}' but required in type 'InputOptions'/ );
typeTest( 'invalid-configs/out-object-without-file.ts',
	/error TS2322: Type '\{ search: string; \}' is not assignable to type 'string \| \(string \| OutputOptions\)\[\] \| OutputOptions \| null \| undefined/ );
typeTest( 'invalid-configs/invalid-global-strict-mode.ts',
	/error TS2322: Type '"error"' is not assignable to type 'StrictMode \| null \| undefined'/ );
typeTest( 'invalid-configs/invalid-global-encoding.ts',
	/error TS2322: Type '"unknown-encoding"' is not assignable to type 'BufferEncoding \| null \| undefined'/ );
