# release-it RegEx Bumper #

> Regular expression based version read/write plugin for release-it

This [release-it](https://github.com/release-it/release-it) plugin reads and/or writes versions using regular expressions.

When reading, the regular expression is used to find and extract the current version from a file.

When writing, the regular expressions are used to find the places where the new version is inserted. In fact, it is possible 
to insert more than just the new version. See the configuration options below for details.


# Installation #

```
npm install --save-dev @j-ulrich/release-it-regex-bumper
```


# Usage #

To use the RegEx Bumper, configure it in the `plugins` object of the [release-it configuration](https://github.com/release-it/release-it#configuration).

For example:

```json
"plugins": {
	"@j-ulrich/release-it-regex-bumper": {
		"in": "path/to/versionfile.txt",
		"out": [
			"path/to/versionfile.txt",
			{
				"file": "README.md",
				"pattern": "Version \\d+\\.\\d+\\.\\d+",
				"replace": "Version {{version}}"
			}
		]
	}
}
```

## Regular Expressions ##

RegEx bumper uses [XRegExp](http://xregexp.com). This means that the `search` and `replace` options can make use of the extended features of XRegExp like backreferences to named capturing groups, the `s` flag etc.

Since the plugin's configuration is written in JSON format, remember to properly escape backslashes inside the regular expression patterns as needed in JSON strings (double the backslashes). So for example, the pattern `\d+` needs to be written as `"\\d+"` inside JSON.


## Confuguration Options ##

> `in`

**Type:** `string|object`    
**Default:** `null`

The `in` option defines where and how to read the current version. If this option is defined and not `null`, the version from this file will take precedence over the `version` from `package.json`
or the latest Git tag (which release-it uses by default).

If `in` is a string, it is interpreted as the path to the file where the current version is read from. The global `search` pattern is then used to find the version in the file.

If `in` is an object, it takes the following properties:

> `in.file`

**Type:** `string`

Path to the file where the current version is read from.

> `in.encoding`

**Type:** `string`
**Default:** `null`

Encoding to be used when reading `in.file`. The supported encodings are the ones supported by Node's `fs` module.    
If this option is `null` or not defined, the global `encoding` option is used.

> `in.search`

**Type:** `string|object`
**Default:** `null`

Defines the regular expression to find the version inside the `in.file`.    
If this option is `null` or not defined, the global `search` option is used.

If `in.search` is a string, it is interpreted as the regular expression pattern.

If `in.search` is an object, it takes the following properties:

> `in.search.pattern`

**Type:** `string`

The regular expression pattern to find the version inside `in.file`.

> `in.search.flags`

**Type:** `string`    
**Default:** `null`

The flags for the regular expression `in.search.pattern`.

> `in.search.versionCaptureGroup`

**Type:** `integer|string`    
**Default:** `null`

Defines the capture group from the `in.search.pattern` which matches the version. If the `in.search.pattern` contains multiple (named) capturing groups, use this property to define which group should be used as version. If `in.search.pattern` does not contain any capturing groups, this property is ignored and the whole match is used as version.

If this option is `null` or not defined, the global `search.versionCaptureGroup` is used.


> `out`

**Type:** `string|object|array<string|object>`    
**Default:** `null`

The `out` option defines where and how to write the new version. If defined and not `null`, the version information will be written to the matches of the regular expressions in the specified file(s).

If `out` is an array, the entries are processed one after another and each entry is treated like described below when `out` itself is a string or an object.

If `out` is a string, it is interpreted as the path to the file where the new version is written to. The global `search` and `replace` options are used in this case to find and replace the version information.

If `out` is an object, it takes the following properties:


> `out.file`

**Type:** `string`

The path to the file where the new version is written to.

The `out.file` option is parsed with [fast-glob](https://github.com/mrmlnc/fast-glob), so glob patterns can be used to match multiple files to write to:

```json
"plugins": {
	"@j-ulrich/release-it-regex-bumper": {
		"out": {
			"file": "dist/*.json",
			"search": "\"version\":\\s*\"([0-9.]+)\"",
			"replace": "\"version\": \"{{version}}\""
		}
	}
}
```

> `out.encoding`

**Type:** `string`
**Default:** `null`

Encoding to be used when reading and writing `out.file`. The supported encodings are the ones supported by Node's `fs` module.    
If this option is `null` or not defined, the global `encoding` option is used.

> `out.search`

**Type:** `string|object`
**Default:** `null`

Defines the regular expression to find the text which is replaced with the new version inside `out.file`.    
If this option is `null` or not defined, the global `search` option is used.

If `out.search` is a string, it is interpreted as the regular expression pattern.

If `out.search` is an object, it takes the following properties:

> `out.search.pattern`

**Type:** `string`

The regular expression pattern to find the text to be replaced with the new version inside `out.file`.

> `out.search.flags`

**Type:** `string`    
**Default:** `null`

The flags for the regular expression `out.search.pattern`.

> `out.replace`

**Type:** `string`
**Default:** `null`

The template string which replaces the matches of `out.search` inside `out.file`.
If this option is `null` or not defined, the global `replace` option is used.

The template string can reference capturing groups from `out.search` with the syntax `$n` where `n` is the number of the referenced capturing group or with `${n}` where `n` is the name or number of a capturing group. For the complete syntax see [the documentation of XRegExp](http://xregexp.com/syntax/#replacementText).

The template string also supports a set of placeholders:

- `{{version}}` is replaced with the new version.
- `{{latestVersion}}` is replaced with the current version, that is the version before the increase.
- `{{latestTag}}` is replaced with the current VCS tag.
- `{{now}}` is replaced with the current timestamp in ISO 8601 format.
- `{{now:<format>}}` is replaced with the current timestamp in a format specified by the `<format>` parameter. The supported format syntax can be found in the [moment.js format](https://momentjs.com/docs/#/displaying/) documentation. Example: `{{now:YYYY-MM-DD}}`

The placeholders are replaced before the template string is used in the search and replace and thus before the capturing group references are replaced.

> `search`

**Type:** `string|object`
**Default:** An object with the default values as described below.

Defines the default regular expression to be used when no `in.search` or `out.search` is given.

If this option is not defined or set to `null`, the default value is used.

If `search` is a string, it is interpreted as the regular expression pattern.

If `search` is an object, it takes the following properties:

> `search.pattern`

**Type:** `string`
**Default:** A pattern matching versions according to the semantic version specification.

The default regular expression pattern which is used when `in.search.pattern` or `out.search.pattern` is `null` or not defined.

> `search.flags`

**Type:** `string`    
**Default:** `null`

The flags for the regular expression `search.pattern`.

> `search.versionCaptureGroup`

**Type:** `integer|string`    
**Default:** `1`

Defines the default capture group which is used when `in.search.versionCaptureGroup` is `null` or not defined.

Note that this property applies only when `search` is used for reading the current version and has no effect when writing the new version.

If this option is not defined or set to `null`, the default value is used.

> `replace`

**Type:** `string`
**Default:** `"{{version}}"`

The default template string used when `out.replace` is `null` or not defined.
See `out.replace` for more information.

If this option is not defined or set to `null`, the default value is used.


# License #

Copyright (c) 2020 Jochen Ulrich

Licensed under [MIT license](LICENSE).
