# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.4] - 2026-09-26

Maintenance release: tooling, build and release process updates. No changes to
the public API.

### Added

- `bin/build-info.json` is written by every build and ships in the package. It
  records the Emscripten version, build profile (`dev`/`prod`), git commit and
  whether the working tree had uncommitted changes (`dirty`).
- `.emscripten-version` pins the Emscripten version used for local builds, CI
  and releases (currently `6.0.10`). `make` warns when the installed `emcc`
  does not match.
- `npm run release -- <patch|minor|major|x.y.z>` (`scripts/release.sh`) checks
  for a clean tree, the pinned `emcc` and a changelog entry, then tags,
  publishes, pushes and creates the GitHub release.

### Changed

- The WASM binary is now built with Emscripten 6.0.10. The version used for
  earlier releases was not recorded.
- CI workflows install the pinned Emscripten version instead of `latest`.
- Plain `make` now runs a dev build; before, it only removed `bin/`.
- README documents the Homebrew and emsdk install paths and the release process.

- Upgraded development dependencies:
  - `typescript` `^5.9.3` → `^7.0.2`
  - `eslint` `^9.39.4` → `^10.11.0`
  - `@eslint/js` `^9.39.1` → `^10.0.1`
  - `eslint-config-prettier` `^9.1.0` → `^10.1.8`
  - `globals` `^16.4.0` → `^17.12.0`
  - `@types/node` `^24.7.2` → `^26.6.3`
  - `prettier` `^3.8.1` → `^3.9.9`
- Updated the demo pages deployment workflow (`deploy-demo-pages.yml`) to run on Node 24.

[0.0.4]: https://github.com/nhebling/dcraw-wasm/compare/0.0.3...0.0.4
