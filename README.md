# release-it RegEx Bumper #

> Regular expression based version read/write plugin for release-it

![CI](https://github.com/j-ulrich/release-it-regex-bumper/workflows/CI/badge.svg)
[![Test Coverage](https://app.codacy.com/project/badge/Coverage/bf3c6e8740a9472b9acd7dac231adf4e)](https://www.codacy.com/manual/j-ulrich/release-it-regex-bumper?utm_source=github.com&utm_medium=referral&utm_content=j-ulrich/release-it-regex-bumper&utm_campaign=Badge_Coverage)
[![Code Quality](https://app.codacy.com/project/badge/Grade/bf3c6e8740a9472b9acd7dac231adf4e)](https://www.codacy.com/manual/j-ulrich/release-it-regex-bumper?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=j-ulrich/release-it-regex-bumper&amp;utm_campaign=Badge_Grade)

This [release-it](https://github.com/release-it/release-it) plugin reads and/or writes versions
using regular expressions.

When reading, the regular expression is used to find and extract the current version from a file.

When writing, the regular expressions are used to find the places where the new version is inserted.
In fact, it is possible to insert more than just the new version. See the configuration options
below for details.


# Installation #

> ⚠️ **Note:**  
> Version 4.x of release-it-regex-bumper requires version 15.x or later of release-it.
> When you are using release-it version 14.x or earlier, then use release-it-regex-bumper version 3.x or earlier.

```
npm install --save-dev @j-ulrich/release-it-regex-bumper
```


# Usage #

To use the RegEx Bumper, configure it in the `plugins` object of the [release-it
configuration](https://github.com/release-it/release-it#configuration).

For example:

```json
{
    "plugins": {
        "@j-ulrich/release-it-regex-bumper": {
            "in": "path/to/version_file.txt",
            "out": [
                "path/to/version_file.txt",
                {
                    "file": "README.md",
                    "search": "Version \\d+\\.\\d+\\.\\d+",
                    "replace": "Version {{versionWithoutPrerelease}}"
                }
            ]
        }
    }
}
```

For a more complex example, see [.release-it.json](.release-it.json).


## Regular Expressions ##

RegEx bumper uses [XRegExp](http://xregexp.com). This means that the `search` and `replace` options
can make use of the extended features of XRegExp like backreferences to named capturing groups, the
`s` flag etc.

Since the plugin's configuration is written in JSON format, remember to properly escape backslashes
inside the regular expression patterns as needed in JSON strings (double the backslashes). So for
example, the pattern `\d+` needs to be written as `"\\d+"` inside JSON.


## Configuration Options ##

> ℹ️ **Note:**    
> Options without a default value are required.

### `in` ###

**Type:** `string|object`    
**Default:** `null`

The `in` option defines where and how to read the current version. If this option is defined and not
`null`, the version from this file will take precedence over the `version` from `package.json` or
the latest Git tag (which release-it uses by default).

If `in` is a string, it is interpreted as the path to the file where the current version is read
from. The [global `search`](#search) pattern is then used to find the version in the file.

If `in` is an object, it takes the following properties:

### `in.file` ###

**Type:** `string`

Path to the file where the current version is read from.

### `in.encoding` ###

**Type:** `string`    
**Default:** `null`

Encoding to be used when reading `in.file`. The supported encodings are the ones supported by Node's
`fs` module.
If this option is `null` or not defined, the [global `encoding`](#encoding) option is used.

### `in.search` ###

**Type:** `string|object`    
**Default:** `null`

Defines the regular expression to find the version inside the `in.file`.
If this option is `null` or not defined, the [global `search`](#search) option is used.

If `in.search` is a string, it is interpreted as the regular expression pattern.

If `in.search` is an object, it takes the following properties:

### `in.search.pattern` ###

**Type:** `string`

The regular expression pattern template to find the version inside `in.file`.

Capturing groups can be used to extract the version from a part of the whole match. See the
documentation of the configuration option `in.search.versionCaptureGroup` for a description of the
handling of capturing groups.

The `in.search.pattern` also supports a set of placeholders (since version 3.0.0):

- `{{semver}}` is matching any version string complying to the semantic versioning specification (meaning at least
  "major.minor.patch").
- `{{now:<format>}}` is matching the current timestamp in a format specified by the `<format>` parameter.
  The supported format syntax can be found in the [date-fns format](https://date-fns.org/v2.8.0/docs/format)
  documentation.    
  Example: `{{now:yyyy-MM-dd}}`
- `{{{}}` is matching a literal `{`. This can be used to match a literal placeholder.    
  For example: `{{{}}{foo}}` is matching `{{foo}}`

> ℹ️ **Note:**    
> All the placeholders are contained in a non-capturing group (`(?:...)`) so they behave like "atomic" constructs.

### `in.search.flags` ###

**Type:** `string`    
**Default:** `null`

The flags for the regular expression `in.search.pattern`.

If this option is `null` or not defined, the [global `search.flags`](#searchflags) are used.

### `in.search.versionCaptureGroup` ###

**Type:** `integer|string`    
**Default:** `null`

Defines the capture group from the `in.search.pattern` which matches the version. If the
`in.search.pattern` contains (named) capturing groups, use this option to define which
group matches the version. If `in.search.pattern` does not contain a capturing group with the
name or index defined by this option, this option is ignored and the whole match is used as version.

If this option is `null` or not defined, the
[global `search.versionCaptureGroup`](#searchversioncapturegroup) is used.

If both, this option and the [global `search.versionCaptureGroup`](#searchversioncapturegroup) are
`null` (the default), then the capturing group with name `version` is used if it exists. Else the
capturing group with index 1 is used if it exists. Else the whole match is used.


### `out` ###

**Type:** `string|object|array<string|object>`    
**Default:** `null`

The `out` option defines where and how to write the new version. If defined and not `null`, the
version information will be written to the matches of the regular expressions in the specified
file(s).

If `out` is an array, the entries are processed one after another and each entry is treated like
described below when `out` itself is a string or an object.

If `out` is a string, it is interpreted as the path to the file where the new version is written to.
The [global `search`](#search) and [`replace`](#replace) options are used in this case to find and
replace the version information.

If `out` is an object, it takes the following properties:


### `out.file` ###

**Type:** `string`    
**Default:** `null` but either this option or `out.files` (or both) must contain a value

The path to the file where the new version is written to.

The `out.file` option is parsed with [fast-glob](https://github.com/mrmlnc/fast-glob), so glob
patterns can be used to match multiple files to write to:

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

If both, this option and `out.files` are given, both are processed.

### `out.files` ###

**Type:** `string|array<string>`    
**Default:** `null` but either this option or `out.file` (or both) must contain a value    
**Since:** 1.1.0

A path or an array of paths to files where the new version is written to. This option behaves the
same as the `out.file` option but allows specifying multiple files or patterns. Accordingly, the
entries are also parsed with [fast-glob](https://github.com/mrmlnc/fast-glob):

```json
"plugins": {
    "@j-ulrich/release-it-regex-bumper": {
        "out": {
            "files": [ "**/*.json", "**/*.yml" ],
            "search": "\"version\":\\s*\"([0-9.]+)\"",
            "replace": "\"version\": \"{{version}}\""
        }
    }
}
```

If both, this option and `out.file` are given, both are processed.

### `out.encoding` ###

**Type:** `string`    
**Default:** `null`

Encoding to be used when reading and writing `out.file`. The supported encodings are the ones
supported by Node's `fs` module.
If this option is `null` or not defined, the [global `encoding`](#encoding) option is used.

### `out.search` ###

**Type:** `string|object`    
**Default:** `null`

Defines the regular expression to find the text which is replaced with the new version inside
`out.file`.
If this option is `null` or not defined, the [global `search`](#search) is used.

If `out.search` is a string, it is interpreted as the regular expression pattern.

If `out.search` is an object, it takes the following properties:

### `out.search.pattern` ###

**Type:** `string`

The regular expression pattern template to find the text to be replaced with the new version inside
`out.file`.

In contrast to `in.search.pattern`, capturing groups are not treated special in this pattern. So
`out.replace` always replaces the *whole* match.

If this option is `null` or not defined, the [global `search`](#search) resp.
[global `search.pattern`](#searchpattern) is used.

The `out.search.pattern` also supports a set of placeholders (since version 3.0.0):

- `{{version}}` is matching the current version (before the increment).
- `{{major}}` is matching the major part of the current version.
- `{{minor}}` is matching the minor part of the current version.
- `{{patch}}` is matching the patch part of the current version.
- `{{prerelease}}` is matching the prerelease part of the current version. If the version does
  not have a prerelease part, it is omitted (matching empty string).
- `{{prefixedPrerelease}}` is matching a dash ('-') followed by the prerelease part of the current version. If the
  version does not have a prerelease part, it is omitted (matching empty string).
- `{{build}}` is matching the build part of the current version. If the version does not have a
  build part, it is omitted (matching empty string).
- `{{prefixedBuild}}` is matching a plus ('+') followed by the build part of the current version. If the version
  does not have a build part, it is omitted (matching empty string).
- `{{versionWithoutBuild}}` is matching the current version without the build part.
- `{{versionWithoutPrerelease}}` is matching the current version without the prerelease and build parts.
- `{{tag}}` is matching the current VCS tag (before the bump).
- `{{newVersion}}` is matching the new version (after the increment).
- `{{semver}}` is matching any version string complying to the semantic versioning specification (meaning at least
  "major.minor.patch").
- `{{now:<format>}}` is matching the current timestamp in a format specified by the `<format>` parameter.
  The supported format syntax can be found in the [date-fns format](https://date-fns.org/v2.8.0/docs/format)
  documentation.    
  Example: `{{now:yyyy-MM-dd}}`
- `{{{}}` is matching a literal `{`. This can be used to match a literal placeholder.    
  For example: `{{{}}{foo}}` is matching `{{foo}}`

> ℹ️ **Note:**    
> All the placeholders are contained in a non-capturing group (`(?:...)`) so they behave like "atomic" constructs.

### `out.search.flags` ###

**Type:** `string`    
**Default:** `null`

The flags for the regular expression `out.search.pattern`.

If this option is `null` or not defined, the [global `search.flags`](#searchflags) are used.

### `out.replace` ###

**Type:** `string`    
**Default:** `null`

The template string which replaces the matches of `out.search` inside `out.file`. If this option is
`null` or not defined, the [global `replace`](#replace) option is used.

The template string can reference capturing groups from `out.search` with the syntax `$n` where `n`
is the number of the referenced capturing group or with `${n}` where `n` is the name or number of a
capturing group. For the complete syntax see [the documentation of
XRegExp](http://xregexp.com/syntax/#replacementText).

The template string also supports a set of placeholders:

- `{{version}}` is replaced by the new version.
- `{{major}}` is replaced by the major part of the new version.    
  Since: 1.2.0
- `{{minor}}` is replaced by the minor part of the new version.    
  Since: 1.2.0
- `{{patch}}` is replaced by the patch part of the new version.    
  Since: 1.2.0
- `{{prerelease}}` is replaced by the prerelease part of the new version or an empty string if the version does not
  have a prerelease part.    
  Since: 1.2.0
- `{{prefixedPrerelease}}` is replaced by a dash ('-') followed by the prerelease part of the new version or and empty
  string if the version does not have a prerelease part.    
  Since: 3.0.0
- `{{build}}` is replaced by the build part of the new version or an empty string if the version does not have a
  build part.    
  Since: 1.2.0
- `{{prefixedBuild}}` is replaced by a plus ('+') followed by the build part of the new version or an empty string
  if the version does not have a build part.    
  Since: 3.0.0
- `{{versionWithoutBuild}}` is replaced by the new version without the build part.    
  Since: 1.2.0
- `{{versionWithoutPrerelease}}` is replaced by the new version without the prerelease and build
  parts.    
  Since: 1.2.0
- `{{latestVersion}}` is replaced by the current version, that is the version before the increase.
- `{{latestTag}}` is replaced by the current VCS tag.
- `{{now}}` is replaced by the current timestamp in ISO 8601 format.
- `{{now:<format>}}` is replaced by the current timestamp in a format specified by the `<format>`
  parameter. The supported format syntax can be found in the [date-fns
  format](https://date-fns.org/v2.8.0/docs/format) documentation.    
  Example: `{{now:yyyy-MM-dd}}`
- `{{{}}` is replaced by a literal `{`. This can be used to write a literal placeholder.    
  For example: `{{{}}{foo}}` is replaced by `{{foo}}`    
  Since: 1.2.0

The placeholders are replaced before the template string is used in the search and replace and thus
before the capturing group references are replaced.

### `search` ###

**Type:** `string|object`    
**Default:** An object with the default values as described below.

Defines the default regular expression to be used when no `in.search` or `out.search` is given.

If this option is not defined or set to `null`, the default value is used.

If `search` is a string, it is interpreted as the regular expression pattern.

If `search` is an object, it takes the following properties:

### `search.pattern` ###

**Type:** `string`    
**Default:** `"{{semver}}"`

The default regular expression pattern template which is used when `in.search.pattern` or
`out.search.pattern` is `null` or not defined. See [`in.search.pattern`](#insearchpattern) and
[`out.search.pattern`](#outsearchpattern) for more information.

> ⚠️ **Warning:**    
> Note that the global `search.pattern` is used for both `in.search.pattern` and `out.search.pattern` unless
> overridden explicitly. But `in.search.pattern` does not support all the placeholders of `out.search.pattern` and
> using unsupported placeholders raises an error.

If this option is not defined or set to `null`, the default value is used.

### `search.flags` ###

**Type:** `string`    
**Default:** `null`

The default flags for the search pattern which are used when `in.search.flags` or
`out.search.flags` are `null` or not defined.

### `search.versionCaptureGroup` ###

**Type:** `integer|string`    
**Default:** `null`

Defines the default capture group which is used when `in.search.versionCaptureGroup` is `null` or
not defined.

Note that this property applies only when `search` is used for reading the current version and has
no effect when writing the new version.

### `replace` ###

**Type:** `string`    
**Default:** `"{{version}}"`

The default template string used when `out.replace` is `null` or not defined. See `out.replace` for
more information.

If this option is not defined or set to `null`, the default value is used.

### `encoding` ###

**Type:** `string`    
**Default:** `"utf-8"`

The default encoding used when `in.encoding` or `out.encoding` is `null` or not defined. The supported
encodings are the ones supported by Node's `fs` module.

If this option is not defined or set to `null`, the default value is used.


# License #

Copyright (c) 2020-2021 Jochen Ulrich

Licensed under [MIT license](LICENSE).
