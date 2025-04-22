import * as assert from 'assert';
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('JustLookAtNow.arthas-for-vscode'));
    });

    test('Should register all commands', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('arthas-for-vscode.copyWatchCommand'));
        assert.ok(commands.includes('arthas-for-vscode.copyJadCommand'));
    });
}); 