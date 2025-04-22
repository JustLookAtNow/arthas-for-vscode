import * as path from 'path';
import * as vscode from 'vscode';
import { runTests } from 'vscode-test';

async function main() {
    try {
        // 扩展开发根路径
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // 测试文件所在路径
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // 下载并运行 VS Code 测试环境
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main(); 