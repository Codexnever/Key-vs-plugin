import * as vscode from 'vscode';
import { scanForApiKeys, replaceAllApiKeys } from './scanner';
export function activate(context: vscode.ExtensionContext) {
    console.log('KeyGuardian extension is now active!');

    // Register the scan command
    let scanCommand = vscode.commands.registerCommand('keyguardian.scan', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            scanForApiKeys(editor.document);
        } else {
            vscode.window.showInformationMessage('No active editor found');
        }
    });

    // Register the replace command
    let replaceCommand = vscode.commands.registerCommand('keyguardian.replaceAll', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            replaceAllApiKeys(editor.document);
        } else {
            vscode.window.showInformationMessage('No active editor found');
        }
    });

    // Auto-scan on document changes
    let changeSubscription = vscode.workspace.onDidChangeTextDocument(event => {
        scanForApiKeys(event.document);
    });

    context.subscriptions.push(scanCommand, replaceCommand, changeSubscription);
}

export function deactivate() {}