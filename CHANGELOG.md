# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-08

### Added
- **MelScript CLI**: Support for running `.mel` files in the terminal via Node.js (`bin/mel.js`) or standalone executable (`mel.exe`).
- **Web Support**: Full support for running MelScript in browsers using `<mel>` tags or via the `melscript.js` library.
- **VS Code Extension**: Syntax highlighting, snippets, and integrated Webview runner (`tooling/vscode-melscript`).
- **Installer**: Windows Installer (`setup.exe`) generated via Inno Setup, including PATH configuration and file associations.
- **Documentation**: Comprehensive README.md and example files.
- **Standard Library**: Core modules including IO, Math, Canvas (2D/WebGL), Audio, and DOM manipulation.

### Fixed
- Syntax highlighting issues in HTML files.
- Webview execution output capture.
- Node.js compatibility for web-specific modules (Canvas, Audio, UI excluded/stubbed in Node build).
