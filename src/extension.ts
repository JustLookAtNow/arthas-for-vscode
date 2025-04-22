import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 激活扩展
export function activate(context: vscode.ExtensionContext) {
    // 注册watch命令
    let watchDisposable = vscode.commands.registerCommand('arthas-for-vscode.copyWatchCommand', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        // 确保是 Java 文件
        if (editor.document.languageId !== 'java') {
            vscode.window.showErrorMessage('Not a Java file');
            return;
        }

        try {
            // 从Java语言服务获取方法信息
            const methodInfo = await getMethodInfoFromJavaExtension(editor);

            if (!methodInfo) {
                vscode.window.showErrorMessage('Cannot recognize method. Please make sure the cursor is inside a method or on a method name, and Java extension is installed');
                return;
            }

            // 构建 Arthas watch 命令
            const watchCommand = `watch ${methodInfo.fullClassName} ${methodInfo.methodName} '{params,returnObj,throwExp}'  -n 5  -x 3`;

            // 复制到剪贴板
            await vscode.env.clipboard.writeText(watchCommand);
            vscode.window.showInformationMessage(`Arthas watch command copied: ${watchCommand}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    });

    // 注册jad命令
    let jadDisposable = vscode.commands.registerCommand('arthas-for-vscode.copyJadCommand', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        // 确保是 Java 文件
        if (editor.document.languageId !== 'java') {
            vscode.window.showErrorMessage('Not a Java file');
            return;
        }

        try {
            // 获取当前类的全限定名
            const fullClassName = await getFullClassName(editor.document);
            if (!fullClassName) {
                vscode.window.showErrorMessage('Cannot recognize class name. Please make sure this is a valid Java class file');
                return;
            }

            // 构建 Arthas jad 命令
            const jadCommand = `jad ${fullClassName}`;

            // 复制到剪贴板
            await vscode.env.clipboard.writeText(jadCommand);
            vscode.window.showInformationMessage(`Arthas jad command copied: ${jadCommand}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    });

    context.subscriptions.push(watchDisposable, jadDisposable);
}

// 从Java语言服务获取方法信息
async function getMethodInfoFromJavaExtension(editor: vscode.TextEditor): Promise<{ fullClassName: string, methodName: string } | null> {
    try {
        // 检查Java语言扩展是否激活
        const javaExt = vscode.extensions.getExtension('redhat.java');
        if (!javaExt) {
            vscode.window.showErrorMessage('Java extension (Language Support for Java by Red Hat) is not installed. Please install it first');
            return null;
        }

        if (!javaExt.isActive) {
            // 如果扩展未激活，尝试激活它
            try {
                await javaExt.activate();
            } catch (error) {
                console.error('Failed to activate Java extension:', error);
                return null;
            }
        }

        // 获取当前光标位置
        const position = editor.selection.active;
        const document = editor.document;

        // 优化调用顺序，先使用能识别方法调用的函数
        // 1. 首先尝试定义提供器（最适合识别方法调用）
        let result = await tryGetMethodInfoFromDefinitionProvider(document, position);
        if (result) {
            return result;
        }

        // 2. 尝试从悬停提供器获取信息（对于方法调用很有效）
        result = await tryGetMethodInfoFromHoverProvider(document, position);
        if (result) {
            return result;
        }

        // 3. 尝试使用Java类型信息
        result = await tryGetMethodInfoFromTypeHierarchy(document, position);
        if (result) {
            return result;
        }

        // 4. 最后才尝试文档符号（通常只能识别方法定义而非调用）
        result = await tryGetMethodInfoFromDocumentSymbols(document, position);
        if (result) {
            return result;
        }

        return null;
    } catch (error) {
        console.error('Error getting Java language service information:', error);
        return null;
    }
}

// 从文档符号获取方法信息
async function tryGetMethodInfoFromDocumentSymbols(document: vscode.TextDocument, position: vscode.Position): Promise<{ fullClassName: string, methodName: string } | null> {
    try {
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
        console.error('Failed to get method information from document symbols:', error);
        return null;
    }
}

// 从定义提供器获取方法信息
async function tryGetMethodInfoFromDefinitionProvider(document: vscode.TextDocument, position: vscode.Position): Promise<{ fullClassName: string, methodName: string } | null> {
    try {
        // 首先尝试在当前位置检测是否是一个方法调用
        const line = document.lineAt(position.line).text;
        const cursorPosition = position.character;

        // 查找光标前后位置的方法调用 - 如 xxx.methodName(...)
        const methodCallBeforeCursor = line.substring(0, cursorPosition).match(/([a-zA-Z0-9_$]+)(?:\s*\((?:[^()]|\([^()]*\))*)?$/);
        const methodCallAfterCursor = line.substring(cursorPosition).match(/^(?:[^()]|\([^()]*\))*\)/);

        // 如果光标位于方法调用内
        const isInMethodCall = methodCallBeforeCursor && methodCallAfterCursor;

        // 识别常见的Map方法调用模式
        if (isInMethodCall && methodCallBeforeCursor) {
            const methodName = methodCallBeforeCursor[1];
            if (['put', 'get', 'remove', 'containsKey', 'entrySet', 'keySet', 'values', 'putAll', 'putIfAbsent'].includes(methodName)) {
                // 获取代码上下文，查找是否在操作Map对象
                const lineText = document.lineAt(position.line).text;
                const mapVariableMatch = lineText.match(/(\w+)\s*\.\s*${methodName}/);

                // 查找变量声明以确认是否为Map
                if (mapVariableMatch) {
                    const variableName = mapVariableMatch[1];
                    // 在文件中查找该变量的声明
                    const fileText = document.getText();
                    const mapDeclarationRegex = new RegExp(`(Map|HashMap|TreeMap|LinkedHashMap|ConcurrentHashMap)<.*>\\s+${variableName}\\s*=`, 'i');
                    if (fileText.match(mapDeclarationRegex)) {
                        return {
                            fullClassName: 'java.util.HashMap',
                            methodName
                        };
                    }
                }

                // 通用检测：在当前代码行，检查常见Map方法组合
                if (/\.(put|get|remove|containsKey)\s*\(/.test(lineText) &&
                    !/(String|StringBuilder|List|Set|Collection|Queue|Deque|Array)\.(put|get|remove|containsKey)\s*\(/.test(lineText)) {
                    return {
                        fullClassName: 'java.util.HashMap',
                        methodName
                    };
                }
            }
        }

        // 获取方法调用的定义位置
        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            document.uri,
            position
        );

        if (definitions && definitions.length > 0) {
            // 获取目标文档（可能是其他类）
            const targetUri = definitions[0].uri;
            const targetPosition = definitions[0].range.start;

            // 针对Map接口方法的特殊处理
            if (targetUri.fsPath.includes('Map.java') ||
                targetUri.fsPath.includes('HashMap.java') ||
                targetUri.fsPath.includes('AbstractMap.java')) {

                if (isInMethodCall && methodCallBeforeCursor) {
                    return {
                        fullClassName: 'java.util.HashMap',
                        methodName: methodCallBeforeCursor[1]
                    };
                }
            }

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

                    // 如果是Map接口的方法，使用HashMap作为类名
                    if (targetUri.fsPath.includes('Map.java') ||
                        targetUri.fsPath.includes('HashMap.java') ||
                        targetUri.fsPath.includes('AbstractMap.java')) {
                        return {
                            fullClassName: 'java.util.HashMap',
                            methodName
                        };
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

            // 如果无法从符号获取，尝试从文件名和位置推断
            const fileName = path.basename(targetUri.fsPath, '.java');
            // 修复Map.java或HashMap.java的特殊处理
            if (fileName === 'Map' || fileName === 'HashMap' || fileName === 'AbstractMap') {
                if (isInMethodCall && methodCallBeforeCursor) {
                    return {
                        fullClassName: 'java.util.HashMap',
                        methodName: methodCallBeforeCursor[1]
                    };
                }
            }

            // 尝试从当前行获取方法名
            const targetLine = (await targetDocument.getText(new vscode.Range(
                targetPosition.line, 0,
                targetPosition.line, 1000
            ))).trim();

            const methodMatch = targetLine.match(/(?:public|private|protected)?\s+\w+\s+(\w+)\s*\(/);
            if (methodMatch) {
                const methodName = methodMatch[1];
                const packageMatch = targetDocument.getText().match(/package\s+([\w.]+)\s*;/);
                if (packageMatch) {
                    // 修复Map接口的特殊处理
                    if (fileName === 'Map' || fileName === 'HashMap' || fileName === 'AbstractMap') {
                        return {
                            fullClassName: 'java.util.HashMap',
                            methodName
                        };
                    }

                    return {
                        fullClassName: `${packageMatch[1]}.${fileName}`,
                        methodName
                    };
                }
            }
        }

        // 如果使用定义提供器失败，但确实处于方法调用中，尝试直接从当前行提取信息
        if (isInMethodCall && methodCallBeforeCursor) {
            const methodName = methodCallBeforeCursor[1];

            // 对于Map方法的特殊处理
            if (['put', 'get', 'remove', 'containsKey', 'putAll', 'putIfAbsent', 'size', 'isEmpty', 'clear', 'entrySet', 'keySet', 'values'].includes(methodName)) {
                const lineText = document.lineAt(position.line).text;
                // 如果调用了这些方法，很有可能是Map接口
                if (!/(String|StringBuilder|List|Set|Collection|Queue|Deque|Array)\.(put|get|remove|containsKey)\s*\(/.test(lineText)) {
                    return {
                        fullClassName: 'java.util.HashMap',
                        methodName
                    };
                }
            }

            // 尝试从代码上下文推断类名
            // 1. 检查是否有明确的类引用，如 SomeClass.methodName
            const classMethodPattern = new RegExp(`([A-Za-z0-9_$.]+)\\.${methodName}\\s*\\(`);
            const classMatch = line.match(classMethodPattern);

            if (classMatch && classMatch[1]) {
                // 可能是静态方法调用或者有变量引用
                const className = classMatch[1];

                // 检查是不是一个已知的Java类或接口
                // 优先处理Map等常见集合接口
                if (/Map|HashMap|TreeMap|ConcurrentHashMap|LinkedHashMap/.test(className)) {
                    return {
                        fullClassName: 'java.util.HashMap',
                        methodName
                    };
                } else if (/List|ArrayList|LinkedList/.test(className)) {
                    return {
                        fullClassName: 'java.util.List',
                        methodName
                    };
                } else if (/Set|HashSet|TreeSet/.test(className)) {
                    return {
                        fullClassName: 'java.util.Set',
                        methodName
                    };
                }

                // 尝试在当前文件中找到变量定义
                const importMatches = Array.from(document.getText().matchAll(/import\s+([\w.]+)\.([^;]+);/g));
                for (const importMatch of importMatches) {
                    if (importMatch[2] === className || importMatch[2] === '*') {
                        // 可能找到了类的导入
                        const possibleClassName = `${importMatch[1]}.${className}`;
                        return {
                            fullClassName: possibleClassName,
                            methodName
                        };
                    }
                }
            }

            // 2. 对于this.method()调用，使用当前类
            if (line.includes('this.' + methodName)) {
                const currentClassName = await getFullClassName(document);
                if (currentClassName) {
                    return {
                        fullClassName: currentClassName,
                        methodName
                    };
                }
            }
        }

        return null;
    } catch (error) {
        console.error('Failed to get method information from definition provider:', error);
        return null;
    }
}

// 尝试使用Java类型层次结构（安全地调用，避免错误）
async function tryGetMethodInfoFromTypeHierarchy(document: vscode.TextDocument, position: vscode.Position): Promise<{ fullClassName: string, methodName: string } | null> {
    try {
        // 使用try-catch包裹可能会失败的命令调用
        let typeInfo: any[] | undefined;
        try {
            typeInfo = await vscode.commands.executeCommand<any[]>(
                'java.execute.workspaceCommand',
                'java.execute.resolveTypeHierarchy',
                document.uri.toString(),
                position.line,
                position.character
            );
        } catch (error) {
            // 这个命令可能不存在或失败，静默忽略并继续其他方法
            console.log('Type hierarchy resolution failed (can be ignored):', error);
            return null;
        }

        if (!typeInfo || typeInfo.length === 0) {
            return null;
        }

        // 尝试从类型信息中提取类名
        let fullClassName = '';
        for (const info of typeInfo) {
            if (info.fullyQualifiedName) {
                fullClassName = info.fullyQualifiedName;
                break;
            }
        }

        if (!fullClassName) {
            return null;
        }

        // 尝试从当前位置或周围文本获取方法名
        const line = document.lineAt(position.line).text;
        const methodNameMatch = line.match(/\b(\w+)\s*\(/);

        if (methodNameMatch) {
            return {
                fullClassName,
                methodName: methodNameMatch[1]
            };
        }

        return null;
    } catch (error) {
        console.error('Failed to get method information from type hierarchy:', error);
        return null;
    }
}

// 从悬停提供器获取方法信息
async function tryGetMethodInfoFromHoverProvider(document: vscode.TextDocument, position: vscode.Position): Promise<{ fullClassName: string, methodName: string } | null> {
    try {
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

            // 对Map/HashMap的特殊处理
            if (hoverText.includes('Map') || hoverText.includes('HashMap') || hoverText.includes('java.util.Map')) {
                const mapMethodMatch = hoverText.match(/(get|put|remove|containsKey|entrySet|keySet|values|size|isEmpty|clear|putAll|putIfAbsent)\s*\(/);
                if (mapMethodMatch) {
                    return {
                        fullClassName: 'java.util.HashMap',
                        methodName: mapMethodMatch[1]
                    };
                }
            }

            // 特殊处理Lombok生成的方法
            if (hoverText.includes('lombok.') || hoverText.includes('@Getter') || hoverText.includes('@Setter')) {
                // 检测是否为getter/setter方法
                const methodMatch = hoverText.match(/([a-zA-Z0-9_$]+)\s*\(/);
                if (methodMatch) {
                    const methodName = methodMatch[1];
                    // 获取当前类名
                    const fullClassName = await getFullClassName(document);
                    if (fullClassName) {
                        return {
                            fullClassName,
                            methodName
                        };
                    }
                }
            }

            // 常规方法提取
            const methodMatch = hoverText.match(/([a-zA-Z0-9_$]+)\s*\(/);
            const classMatch = hoverText.match(/([a-zA-Z0-9_$.]+)\.([a-zA-Z0-9_$]+)\s*\(/);

            if (methodMatch) {
                let methodName = methodMatch[1];
                let fullClassName = '';

                if (classMatch && classMatch[1]) {
                    fullClassName = classMatch[1];
                } else {
                    // 如果找不到类名，使用当前文档的类名
                    fullClassName = await getFullClassName(document) || '';
                }

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
        console.error('Failed to get method information from hover provider:', error);
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