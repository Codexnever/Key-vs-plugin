import * as vscode from 'vscode';
import { scanForApiKeys } from './scanner';

export function activate(context: vscode.ExtensionContext) {
    console.log('KeyGuardian extension is now active!');

    let disposable = vscode.workspace.onDidChangeTextDocument(event => {
        scanForApiKeys(event.document);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
