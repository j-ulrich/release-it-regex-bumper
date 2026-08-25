import { ObjectEncodingOptions as NodeEncodingOptions } from "node:fs";

export interface InputSearchOptions {
	pattern: string;
	flags?: null | string;
	versionCaptureGroup?: null | number | string;
}

export interface InputOptions {
	file: string;
	search?: null | string | InputSearchOptions;
	encoding?: NodeEncodingOptions["encoding"];
}

export interface OutputSearchOptions {
	pattern: string;
	flags?: null | string;
}

export type StrictMode = boolean | 'off' | 'warn' | 'errorIfNoMatch' | 'errorIfNoChange';


export interface CommonOutputOptions {
	encoding?: NodeEncodingOptions["encoding"];
	search?: null | string | OutputSearchOptions;
	replace?: null | string;
	strict?: null | StrictMode;
}

export type OutputOptionsSingleFile = CommonOutputOptions & {
	file: string;
};

export type OutputOptionsMultipleFiles = CommonOutputOptions & {
	files: string | string[];
	file?: null | string;
};

export type OutputOptions = OutputOptionsSingleFile | OutputOptionsMultipleFiles;

export interface Configuration {
	in?: null | string | InputOptions;
	out?: null | string | OutputOptions | Array<string | OutputOptions>;
	search?: string | InputSearchOptions & OutputSearchOptions;
	replace?: null | string;
	encoding?: null | NodeEncodingOptions["encoding"];
	strict?: null | StrictMode;
}

export default class RegExBumper {
	constructor({ namespace, options, container }: { namespace: string; options: object; container: object });
	getLatestVersion(): Promise<string>;
	bump(version): Promise<void>;
}
