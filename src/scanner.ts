import * as vscode from 'vscode';
import { isApiKey } from './utils';

export function scanForApiKeys(document: vscode.TextDocument) {
    const text = document.getText();
    const apiKeyRegex = /(sk_live_[0-9a-zA-Z]{24})|(AKIA[0-9A-Z]{16})/g; // Stripe & AWS pattern
    console.log("KeyGuardian Extension: Debugging here...");

    let match;
    while ((match = apiKeyRegex.exec(text)) !== null) {
        const range = new vscode.Range(
            document.positionAt(match.index),
            document.positionAt(match.index + match[0].length)
        );

        vscode.window.showWarningMessage(`⚠️ Potential API Key detected: ${match[0]}`);

        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 0, 0, 0.3)'
        });

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(decorationType, [range]);
        }
    }
}
