import * as vscode from 'vscode';
import { isApiKey, detectService } from './utils';

// Store detected API keys for hover functionality
const detectedApiKeys = new Map<string, vscode.Range[]>();

// Create a decoration type for API keys
const apiKeyDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
    border: '1px solid red',
    borderRadius: '3px',
    after: {
        contentText: ' 🔑',
        color: 'red'
    }
});

export function scanForApiKeys(document: vscode.TextDocument) {
    const text = document.getText();
    const apiKeyRegex = /(sk_live_[0-9a-zA-Z]{24})|(AKIA[0-9A-Z]{16})/g; // Stripe & AWS pattern
    
    let match;
    const docKey = document.uri.toString();
    const ranges: vscode.Range[] = [];
    const replacements: { range: vscode.Range; replacement: string }[] = [];
    
    // Reset detected keys for this document
    detectedApiKeys.set(docKey, []);
    
    while ((match = apiKeyRegex.exec(text)) !== null) {
        const detectedKey = match[0];
        const range = new vscode.Range(
            document.positionAt(match.index),
            document.positionAt(match.index + detectedKey.length)
        );
        
        const serviceName = detectService(detectedKey);
        const replacement = `KeyGuardian.getToken('${serviceName}')`;
        
        replacements.push({ range, replacement });
        ranges.push(range);
        
        // Store the range for hover provider
        const docRanges = detectedApiKeys.get(docKey) || [];
        docRanges.push(range);
        detectedApiKeys.set(docKey, docRanges);
    }
    
    // Update decorations
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === document) {
        editor.setDecorations(apiKeyDecorationType, ranges);
    }
    
    return replacements;
}

export function replaceAllApiKeys(document: vscode.TextDocument) {
    const replacements = getReplacements(document);
    
    if (replacements.length > 0) {
        performReplacements(document, replacements);
        vscode.window.showInformationMessage(`${replacements.length} API keys replaced with KeyGuardian tokens`);
    } else {
        vscode.window.showInformationMessage('No API keys found to replace');
    }
}

// Get replacements without showing warnings
function getReplacements(document: vscode.TextDocument) {
    const text = document.getText();
    const apiKeyRegex = /(sk_live_[0-9a-zA-Z]{24})|(AKIA[0-9A-Z]{16})/g;
    
    let match;
    const replacements: { range: vscode.Range; replacement: string }[] = [];
    
    while ((match = apiKeyRegex.exec(text)) !== null) {
        const detectedKey = match[0];
        const range = new vscode.Range(
            document.positionAt(match.index),
            document.positionAt(match.index + detectedKey.length)
        );
        
        const serviceName = detectService(detectedKey);
        const replacement = `KeyGuardian.getToken('${serviceName}')`;
        
        replacements.push({ range, replacement });
    }
    
    return replacements;
}

function performReplacements(document: vscode.TextDocument, replacements: { range: vscode.Range; replacement: string }[]) {
    const edit = new vscode.WorkspaceEdit();
    
    replacements.forEach(({ range, replacement }) => {
        edit.replace(document.uri, range, replacement);
    });
    
    vscode.workspace.applyEdit(edit);
}

export function registerHoverProvider(context: vscode.ExtensionContext) {
    const hoverProvider = vscode.languages.registerHoverProvider('*', {
        provideHover(document, position) {
            const docKey = document.uri.toString();
            const ranges = detectedApiKeys.get(docKey) || [];
            
            // Check if position is in any of the detected API key ranges
            const foundRange = ranges.find(range => range.contains(position));
            if (foundRange) {
                const key = document.getText(foundRange);
                const serviceName = detectService(key);
                
                const content = new vscode.MarkdownString();
                content.isTrusted = true;
                content.supportHtml = true;
                
                content.appendMarkdown(`**API Key Detected!**\n\nThis appears to be a ${serviceName} API key.\n\n`);
                content.appendMarkdown(`[Replace with Token](command:keyguardian.replaceKey?${encodeURIComponent(JSON.stringify({
                    uri: document.uri.toString(),
                    range: {
                        start: { line: foundRange.start.line, character: foundRange.start.character },
                        end: { line: foundRange.end.line, character: foundRange.end.character }
                    }
                }))})`);
                
                return new vscode.Hover(content, foundRange);
            }
            
            return null;
        }
    });
    
    context.subscriptions.push(hoverProvider);
}

export function registerReplaceKeyCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('keyguardian.replaceKey', (args) => {
        const { uri, range } = args;
        const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri);
        
        if (document) {
            const vscodeRange = new vscode.Range(
                new vscode.Position(range.start.line, range.start.character),
                new vscode.Position(range.end.line, range.end.character)
            );
            
            const key = document.getText(vscodeRange);
            const serviceName = detectService(key);
            const replacement = `KeyGuardian.getToken('${serviceName}')`;
            
            const edit = new vscode.WorkspaceEdit();
            edit.replace(vscode.Uri.parse(uri), vscodeRange, replacement);
            vscode.workspace.applyEdit(edit).then(success => {
                if (success) {
                    vscode.window.showInformationMessage(`API key replaced with KeyGuardian token`);
                }
            });
        }
    });
    
    context.subscriptions.push(command);
}