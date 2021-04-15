# Changelog #
This is the changelog of the release-it-regex-bumper plugin.

This project adheres to [Semantic Versioning](https://semver.org).
This changelog follows the [Keep a Changelog](https://keepachangelog.com) format.


---


## Unreleased ##

### Fixed ###
- [#2] Declares release-it as a peerDependency instead of a regular dependency.


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



[1.2.4]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.4
[1.2.3]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.3
[1.2.2]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.2
[1.2.1]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.1
[1.2.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.2.0
[1.1.1]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.1.1
[1.1.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.1.0
[1.0.0]: https://github.com/j-ulrich/release-it-regex-bumper/releases/tag/1.0.0
