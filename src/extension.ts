import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 激活扩展
export function activate(context: vscode.ExtensionContext) {
    // 注册命令
    let disposable = vscode.commands.registerCommand('arthas-for-vscode.copyWatchCommand', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('没有打开的编辑器');
            return;
        }

        // 确保是 Java 文件
        if (editor.document.languageId !== 'java') {
            vscode.window.showErrorMessage('不是 Java 文件');
            return;
        }

        try {
            // 从Java语言服务获取方法信息
            const methodInfo = await getMethodInfoFromJavaExtension(editor);

            if (!methodInfo) {
                vscode.window.showErrorMessage('无法识别方法，请确保光标位于方法内部或方法名上，且已安装Java扩展');
                return;
            }

            // 构建 Arthas watch 命令
            const watchCommand = `watch ${methodInfo.fullClassName} ${methodInfo.methodName} '{params,returnObj,throwExp}'  -n 5  -x 3`;

            // 复制到剪贴板
            await vscode.env.clipboard.writeText(watchCommand);
            vscode.window.showInformationMessage(`Arthas watch 命令已复制: ${watchCommand}`);
        } catch (error) {
            vscode.window.showErrorMessage(`错误: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

// 从Java语言服务获取方法信息
async function getMethodInfoFromJavaExtension(editor: vscode.TextEditor): Promise<{ fullClassName: string, methodName: string } | null> {
    try {
        // 检查Java语言扩展是否激活
        const javaExt = vscode.extensions.getExtension('redhat.java');
        if (!javaExt) {
            vscode.window.showErrorMessage('未安装Java扩展（Language Support for Java by Red Hat），请先安装该扩展');
            return null;
        }

        if (!javaExt.isActive) {
            // 如果扩展未激活，尝试激活它
            try {
                await javaExt.activate();
            } catch (error) {
                console.error('激活Java扩展失败:', error);
                return null;
            }
        }

        // 获取当前光标位置
        const position = editor.selection.active;
        const document = editor.document;

        // 尝试获取Java符号信息
        try {
            // 获取位置的定义
            const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                document.uri,
                position
            );

            if (definitions && definitions.length > 0) {
                // 获取目标文档（可能是其他类）
                const targetUri = definitions[0].uri;
                const targetPosition = definitions[0].range.start;

                // 打开目标文档以获取内容（不显示给用户）
                const targetDocument = await vscode.workspace.openTextDocument(targetUri);

                // 获取符号信息
                const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                    'vscode.executeDocumentSymbolProvider',
                    targetUri
                );

                if (symbols && symbols.length > 0) {
                    // 查找与定义位置匹配的方法符号
                    const methodSymbol = findSymbolAtPosition(symbols, targetPosition);
                    if (methodSymbol &&
                        (methodSymbol.kind === vscode.SymbolKind.Method ||
                            methodSymbol.kind === vscode.SymbolKind.Function ||
                            methodSymbol.kind === vscode.SymbolKind.Constructor)) {

                        // 提取简单方法名（去掉括号和参数）
                        let methodName = methodSymbol.name;
                        if (methodName.includes('(')) {
                            methodName = methodName.substring(0, methodName.indexOf('('));
                        }

                        // 获取目标文件的类的完整路径
                        const fullClassName = await getFullClassName(targetDocument);
                        if (fullClassName) {
                            return {
                                fullClassName,
                                methodName
                            };
                        }
                    }
                }
            }

            // 如果上面的方法失败，尝试使用Java类型信息
            const typeInfo = await vscode.commands.executeCommand<any[]>(
                'java.execute.workspaceCommand',
                'java.execute.resolveTypeHierarchy',
                document.uri.toString(),
                position.line,
                position.character
            );

            if (typeInfo && typeInfo.length > 0) {
                // 尝试提取方法名和类名
                const hoveredInfo = await vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    document.uri,
                    position
                );

                if (hoveredInfo && hoveredInfo.length > 0) {
                    const hoverText = hoveredInfo[0].contents.map(content => {
                        if (typeof content === 'string') {
                            return content;
                        } else {
                            return content.value;
                        }
                    }).join('\n');

                    // 从悬停信息中提取方法名和类名
                    const methodMatch = hoverText.match(/([a-zA-Z0-9_$]+)\s*\(/);
                    const classMatch = hoverText.match(/([a-zA-Z0-9_$.]+)\.([a-zA-Z0-9_$]+)\s*\(/);

                    if (methodMatch) {
                        let methodName = methodMatch[1];
                        let fullClassName = '';

                        if (classMatch && classMatch[1]) {
                            fullClassName = classMatch[1];
                        } else {
                            // 尝试从typeInfo中获取类名
                            for (const info of typeInfo) {
                                if (info.fullyQualifiedName) {
                                    fullClassName = info.fullyQualifiedName;
                                    break;
                                }
                            }

                            // 如果还是没有找到，使用当前文档的类名
                            if (!fullClassName) {
                                const currentClassName = await getFullClassName(document);
                                if (currentClassName) {
                                    fullClassName = currentClassName;
                                }
                            }
                        }

                        if (fullClassName) {
                            return {
                                fullClassName,
                                methodName
                            };
                        }
                    }
                }
            }

            // 如果上面的方法都失败，尝试使用文档符号提供器作为回退方法
            const docSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (docSymbols && docSymbols.length > 0) {
                const methodSymbol = findSymbolAtPosition(docSymbols, position);
                if (methodSymbol &&
                    (methodSymbol.kind === vscode.SymbolKind.Method ||
                        methodSymbol.kind === vscode.SymbolKind.Function ||
                        methodSymbol.kind === vscode.SymbolKind.Constructor)) {

                    // 提取简单方法名（去掉括号和参数）
                    let methodName = methodSymbol.name;
                    if (methodName.includes('(')) {
                        methodName = methodName.substring(0, methodName.indexOf('('));
                    }

                    // 获取类的完整路径
                    const fullClassName = await getFullClassName(document);
                    if (fullClassName) {
                        return {
                            fullClassName,
                            methodName
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('获取Java符号信息失败:', error);
            return null;
        }
    } catch (error) {
        console.error('获取Java语言服务信息时出错:', error);
        return null;
    }
}

// 递归查找光标所在的符号
function findSymbolAtPosition(
    symbols: vscode.DocumentSymbol[],
    position: vscode.Position
): vscode.DocumentSymbol | null {
    for (const symbol of symbols) {
        // 检查光标是否在当前符号范围内
        if (symbol.range.contains(position)) {
            // 如果是方法，直接返回
            if (symbol.kind === vscode.SymbolKind.Method ||
                symbol.kind === vscode.SymbolKind.Function ||
                symbol.kind === vscode.SymbolKind.Constructor) {
                return symbol;
            }

            // 如果有子符号，递归查找
            if (symbol.children && symbol.children.length > 0) {
                const childMethod = findSymbolAtPosition(symbol.children, position);
                if (childMethod) {
                    return childMethod;
                }
            }
        }
    }
    return null;
}

// 从文件内容中获取类的完整路径
async function getFullClassName(document: vscode.TextDocument): Promise<string | null> {
    const text = document.getText();

    // 获取包名
    const packageMatch = text.match(/package\s+([\w.]+)\s*;/);
    if (!packageMatch) {
        return null;
    }
    const packageName = packageMatch[1];

    // 获取类名
    // 支持普通类和内部类
    const classMatches = Array.from(text.matchAll(/class\s+(\w+)(?:\s+extends|\s+implements|\s*\{|\s*$)/g));
    if (classMatches.length === 0) {
        return null;
    }

    // 默认使用第一个匹配到的类名（通常是文件的主类）
    const className = classMatches[0][1];

    return `${packageName}.${className}`;
}

// 停用扩展
export function deactivate() { } 