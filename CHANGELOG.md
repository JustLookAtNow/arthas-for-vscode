# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-04-22

### Added

- Added "Copy Arthas jad command" functionality to quickly copy decompile command for current class
- Optimized menu structure with "Copy Arthas command" hierarchical menu containing watch and jad subcommands

## [1.0.2] - 2025-04-10

### Added

- Added icon

## [1.0.1] - 2025-04-10

### Improved

- Added support for Lombok-generated getter and setter methods
- Fixed method recognition issues for HashMap and other collection classes
- Enhanced the accuracy of method call recognition

## [1.0.0] - 2025-04-09

### Added

- Initial version released
- Added "Copy Arthas watch command" option to the context menu
- Supports three usage methods:
  - Select a method name, then right-click and choose "Copy Arthas watch command"
  - Place cursor on the method declaration line, then right-click and choose "Copy Arthas watch command"
  - Place cursor anywhere within the method body, then right-click and choose "Copy Arthas watch command" 