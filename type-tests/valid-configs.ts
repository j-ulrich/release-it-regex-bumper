import { replace } from "xregexp";
import type { Configuration } from "../index.js";

const tests = {
	emptyConfig: {},
	inputFileOnly: {
		in: "version.txt"
	},
	outputFileOnly: {
		out: "version.txt"
	},
	inputAndOutputFiles: {
		in: "version.txt",
		out: "version.txt"
	},
	inputWithSearchString: {
		in: {
			file: "version.txt",
			search: "\\d+\\.\\d+\\.\\d+",
		},
	},
	inputWithSearchObject: {
		in: {
			file: "version.txt",
			search: {
				pattern: "\\d+\\.\\d+\\.\\d+",
				flags: "igm",
				versionCaptureGroup: 0
			}
		},
	},
	allInputOptions: {
		in: {
			file: "version.txt",
			search: "version:\\s*(\\d+\\.\\d+\\.\\d+)",
			encoding: "utf8",
		}
	},
	outputWithSearchString: {
		out: {
			file: "version.txt",
			search: "\\d+\\.\\d+\\.\\d+",
		},
	},
	outputWithSearchObject: {
		out: {
			search: "foo",
			file: "my-file.txt",
		}
	},
	outputWithSearchObjectAndReplace: {
		out: {
			search: "foo",
			replace: "bar",
			file: "my-file.txt",
		}
	},
	outputWithMultipleFiles: {
		out: {
			files: ["file1.txt", "file2.txt"],
			search: "foo",
		}
	},
	multipleOutputConfigs: {
		out: [
			{
				file: "file1.txt",
				search: "foo",
			},
			{
				files: ["file2.txt", "file3.txt"],
				search: "bar",
			},
			"file4.txt",
			{
				files: ["file5.txt", "file6.txt"],
				replace: "baz"
			}
		]
	},
	allOutputOptions: {
		out: {
			file: "version.txt",
			search: "version:\\s*(\\d+\\.\\d+\\.\\d+)",
			replace: "version: {{version}}",
			encoding: "utf8",
			strict: "errorIfNoMatch"
		}
	},
	globalSearchString: {
		search: "<version>"
	},
	globalSearchObject: {
		search: {
			pattern: "<version>",
			flags: "igm"
		}
	},
	globalReplace: {
		replace: "{{version}}"
	},
	globalEncoding: {
		encoding: "utf8"
	},
	globalStrictMode: {
		strict: "errorIfNoMatch"
	}
} satisfies Record<string, Configuration>;