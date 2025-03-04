import * as vscode from 'vscode';
import { isApiKey, detectService } from './utils';

export function scanForApiKeys(document: vscode.TextDocument) {
    const text = document.getText();
    const apiKeyRegex = /(sk_live_[0-9a-zA-Z]{24})|(AKIA[0-9A-Z]{16})/g; // Stripe & AWS pattern
    
    let match;
    const replacements: { range: vscode.Range; replacement: string }[] = [];
    
    while ((match = apiKeyRegex.exec(text)) !== null) {
        const detectedKey = match[0];
        const range = new vscode.Range(
            document.positionAt(match.index),
            document.positionAt(match.index + detectedKey.length)
        );
        
        const serviceName = detectService(detectedKey);
        const replacement = `KeyGuardian.getToken('${detectService(detectedKey)}')`;
        
        replacements.push({ range, replacement });
        
        // Highlight the API key
        highlightApiKey(range);
        
        // Show warning with replacement action buttons
        vscode.window.showWarningMessage(
            `⚠️ API Key detected for ${serviceName}`, 
            'Replace with token', 
            'Ignore'
        ).then(selection => {
            if (selection === 'Replace with token') {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    editor.edit(editBuilder => {
                        editBuilder.replace(range, replacement);
                    }).then(success => {
                        if (success) {
                            vscode.window.showInformationMessage(`API key replaced with KeyGuardian token`);
                        }
                    });
                }
            }
        });
    }
    
    return replacements;
}


export function replaceAllApiKeys(document: vscode.TextDocument) {
    const replacements = scanForApiKeys(document);
    console.log(replacements)
    if (replacements.length > 0) {
        performReplacements(document, replacements);
        vscode.window.showInformationMessage(`${replacements.length} API keys replaced with KeyGuardian tokens`);
    } else {
        vscode.window.showInformationMessage('No API keys found to replace');
    }
}

function performReplacements(document: vscode.TextDocument, replacements: { range: vscode.Range; replacement: string }[]) {
    const edit = new vscode.WorkspaceEdit();
    
    replacements.forEach(({ range, replacement }) => {
        edit.replace(document.uri, range, replacement);
    });
    
    vscode.workspace.applyEdit(edit);
}

function highlightApiKey(range: vscode.Range) {
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 0, 0, 0.3)',
        border: '1px solid red',
        borderRadius: '3px',
        after: {
            contentText: ' 🔑',
            color: 'red'
        }
    });

    const editor = vscode.window.activeTextEditor;
    if (editor) {
        // Make sure we're only decorating exactly the API key and nothing else
        editor.setDecorations(decorationType, [range]);
        
        // Store the decoration to be able to remove it later if needed
        setTimeout(() => {
            editor.setDecorations(decorationType, []);
        }, 10000); // Remove decoration after 10 seconds
    }
}