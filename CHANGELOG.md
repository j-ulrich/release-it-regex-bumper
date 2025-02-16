# Changelog #
This is the changelog of the release-it-regex-bumper plugin.

This project adheres to [Semantic Versioning](https://semver.org).
This changelog follows the [Keep a Changelog](https://keepachangelog.com) format.

---

## [Unreleased]

### Security ###
- Update dependencies to remove vulnerability.


---


## [5.2.0] - 2025-01-09

### Added ###
- [[#14]] Support for release-it version 18.x.

### Fixed ###
- Running the tests with Node.js version 22 or later.


---


## [5.1.0] - 2023-11-23 ##

### Added ###
- [[#11]] Support for release-it version 17.x.


---


## [5.0.0] - 2023-07-20 ##
Support for release-it 16.x.

### Changed ###

#### Breaking Changes ####
- [[#9]] Increased peer dependency to release-it to version 16.x


---


## [4.1.1] - 2022-07-26 ##

### Fixed ###
- Running tests with release-it 15.1.3 or later.

### Security ###
- Update dependencies to remove several vulnerabilities.


---


## [4.1.0] - 2022-05-04 ##

### Added ###
- Support for diff version 5

### Changed ###
- Updated dependencies to new major versions:
  - Chalk version 5
  - XRegExp version 5


---


## [4.0.0] - 2022-05-03 ##
Support for release-it 15.x.

### Changed ###

#### Breaking Changes ####
- [[#6]] Switched to ESModules to support release-it 15.x.
  This removes support for release-it < 15 and Node.js < 14.9.
  When using release-it 14.x or earlier, use release-it-regex-bumper 3.x or earlier.

### Security ###
- Updated node-fetch dependency to remove vulnerability CVE-2022-0235 and GHSA-64g7-mvw6-v9qj.


---


## [3.0.2] - 2022-04-06 ##

### Changed ###
- Removed unnecessary files from npm package.

### Security ###
- Updated dev dependencies to remove vulnerabilities CVE-2022-0235, CVE-2021-44906 and GHSA-64g7-mvw6-v9qj.


---


## [3.0.1] - 2021-10-26 ##

### Changed ###
- Updated dev dependencies to be able to test against Node.js 16.x.

### Fixed ###
- Several code quality issues.
- Improved documentation and added missing documentation.


---


## [3.0.0] - 2021-10-08 ##

### Added ###
- Support for placeholders in the search patterns.
  ⚠️ Note that this is a potential **breaking change**. See below for details.

### Changed ###
- It is now possible to set just the `search.flags` or `search.pattern` in the global `search` options, in
  `out.search` options and `in.search` options. The other property is then using its default value.

#### Breaking Changes ####
- Patterns like `{{version}}` in the search pattern were previously matching literally but now they have a special
  meaning (see documentation of `in.search.pattern` and `out.search.pattern`). Use `{{{}}` to insert a curly brace in
  the pattern to avoid the interpretation as placeholder. For example, use `{{{}}{version}}` to match `{{version}}`
  literally.


---


## [2.0.0] - 2021-04-22 ##

### Changed ###

#### Breaking Changes ####
- [[#1]] Replaced Moment.js with date-fns. This means the format syntax for the date/time formatting has changed.
  See https://date-fns.org/v2.8.0/docs/format for the new syntax.    
  ⚠️ Especially note that the year and day patterns now use lower case letters (for example `yyyy` and `dd`).
  See also https://git.io/fxCyr.


---


## [1.2.6] - 2021-04-22 ##

### Fixed ###
- Version declaration of release-it peerDependency was too strict since older versions are supported as well.


---


## [1.2.5] - 2021-04-16 ##

### Fixed ###
- [[#2]] Declared release-it as a peerDependency instead of a regular dependency.


---


## [1.2.4] - 2021-04-07 ##

### Fixed ###
- Reverted unnecessary increase of dependency requirements in package.json.


---


## [1.2.3] - 2021-04-07 ##

### Security ###
- Updated dependencies to remove vulnerability CVE-2020-28498.


---


## [1.2.2] - 2021-04-07 ##

### Security ###
- Updated dependencies to remove vulnerability CVE-2020-7774.


---


## [1.2.1] - 2020-01-29 ##

### Fixed ###
- Missing documentation of global `encoding` option.
- Error in the example in the documentation.

### Security ###
- Updated dependencies to remove low severity vulnerability CVE-2020-7788.


---


## [1.2.0] - 2020-09-10 ##

### Added ###
- Placeholders `{{major}}`, `{{minor}}`, `{{patch}}`, `{{prerelease}}`, `{{build}}`,
  `{{versionWithoutBuild}}`, `{{versionWithoutPrerelease}}` and `{{{}}`.

### Fixed ###
- Set maximum supported release-it version.


---


## [1.1.1] - 2020-09-03 ##

### Fixed ###
- Incompatibility with release-it 14.x due to removed `global` property.


---


## [1.1.0] - 2020-09-02 ##

### Added ###
- `out.files` option


---


## [1.0.0] - 2020-08-28 ##
Initial release.



[5.2.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/5.2.0
[5.1.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/5.1.0
[5.0.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/5.0.0
[4.1.1]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/4.1.1
[4.1.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/4.1.0
[4.0.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/4.0.0
[3.0.2]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/3.0.2
[3.0.1]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/3.0.1
[3.0.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/3.0.0
[2.0.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/2.0.0
[1.2.6]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.6
[1.2.5]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.5
[1.2.4]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.4
[1.2.3]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.3
[1.2.2]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.2
[1.2.1]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.1
[1.2.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.0
[1.1.1]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.1.1
[1.1.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.1.0
[1.0.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.0.0

[#11]: https://github.com/j-ulrich/release-it-regex-bumper/issues/11
[#9]: https://github.com/j-ulrich/release-it-regex-bumper/issues/9
[#6]: https://github.com/j-ulrich/release-it-regex-bumper/issues/6
[#2]: https://github.com/j-ulrich/release-it-regex-bumper/issues/2
[#1]: https://github.com/j-ulrich/release-it-regex-bumper/issues/1

<!--lint ignore no-unused-definitions-->

[unreleased]: https://github.com/j-ulrich/release-it-regex-bumper/compare/5.2.0...main
