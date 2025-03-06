import * as vscode from 'vscode';
import { scanForApiKeys, replaceAllApiKeys, registerHoverProvider, registerReplaceKeyCommand } from './scanner';

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

    // Register the hover provider
    registerHoverProvider(context);
    
    // Register the replace key commands
    registerReplaceKeyCommand(context);

    // Auto-scan on document changes (using a debounced approach to improve performance)
    let timeout: NodeJS.Timeout | undefined = undefined;
    let changeSubscription = vscode.workspace.onDidChangeTextDocument(event => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            scanForApiKeys(event.document);
        }, 500); // Debounce for 500ms
    });
    
    // Also scan on open documents
    let openSubscription = vscode.workspace.onDidOpenTextDocument(document => {
        scanForApiKeys(document);
    });
    
    // Scan active editor when editor changes
    let editorSubscription = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            scanForApiKeys(editor.document);
        }
    });

    // Scan currently open documents on extension activation
    vscode.workspace.textDocuments.forEach(document => {
        scanForApiKeys(document);
    });

    context.subscriptions.push(
        scanCommand, 
        replaceCommand, 
        changeSubscription, 
        openSubscription,
        editorSubscription
    );
}

export function deactivate() {}