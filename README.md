# Arthas for VSCode

VSCode extension for quickly copying Arthas watch commands.

[中文文档](./README-cn.md)

## Installation

There are two installation methods:

1. Install from VSCode Marketplace
   - Visit the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=JustLookAtNow.arthas-for-vscode)
   - Or search directly for `JustLookAtNow.arthas-for-vscode` in VSCode extensions

2. Manual Installation
   - Download the latest .vsix file from the [Release](https://github.com/JustLookAtNow/arthas-for-vscode/releases) page
   - Install it in VSCode by selecting "Install from VSIX"

## Features

In Java files, when right-clicking on a method name or within a method body, you can copy the corresponding Arthas watch command through the context menu.

## Usage

1. Open a Java file
2. You can use the extension in three ways:
   - Select a method name, then right-click and choose "Copy Arthas watch command"
   - Place the cursor on the method declaration line, then right-click and choose "Copy Arthas watch command"
   - Place the cursor anywhere within the method body, then right-click and choose "Copy Arthas watch command"
3. The command will be copied to your clipboard in the format:
   ```
   watch fully.qualified.ClassName methodName '{params,returnObj,throwExp}' -n 5 -x 3
   ```

## Requirements

- VSCode 1.96.0 or higher

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Package
npm run vscode:prepublish
```

## Publishing

```bash
# Install vsce
npm install -g vsce

# Package
vsce package

# Publish
vsce publish
``` 