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

// Function to replace a single API key at a specific position
export function replaceApiKeyAtPosition(document: vscode.TextDocument, position: vscode.Position) {
    const docKey = document.uri.toString();
    const ranges = detectedApiKeys.get(docKey) || [];
    
    // Find the range containing the position
    const foundRange = ranges.find(range => range.contains(position));
    
    if (foundRange) {
        const key = document.getText(foundRange);
        const serviceName = detectService(key);
        const replacement = `KeyGuardian.getToken('${serviceName}')`;
        
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, foundRange, replacement);
        
        vscode.workspace.applyEdit(edit).then(success => {
            if (success) {
                vscode.window.showInformationMessage(`API key replaced with KeyGuardian token`);
            } else {
                vscode.window.showErrorMessage(`Failed to replace API key`);
            }
        });
        
        return true;
    }
    
    return false;
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
                
                // Create a command URI with a stringified JSON payload
                const commandArgs = {
                    documentUri: document.uri.toString(),
                    line: foundRange.start.line,
                    character: foundRange.start.character
                };
                
                // Use a simpler command URI structure
                content.appendMarkdown(`[Replace with Token](command:keyguardian.replaceKey?${encodeURIComponent(JSON.stringify(commandArgs))})`);
                
                return new vscode.Hover(content, foundRange);
            }
            
            return null;
        }
    });
    
    context.subscriptions.push(hoverProvider);
}

export function registerReplaceKeyCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('keyguardian.replaceKey', (args) => {
        console.log('Replace key command triggered with args:', args);
        
        try {
            // Parse the JSON string if it's a string
            const params = typeof args === 'string' ? JSON.parse(args) : args;
            
            // Extract parameters from the arguments
            const { documentUri, line, character } = params;
            
            // Find the document
            const documentUriObj = vscode.Uri.parse(documentUri);
            const documents = vscode.workspace.textDocuments;
            const document = documents.find(doc => doc.uri.toString() === documentUri);
            
            if (document) {
                // Create a position object from the line and character
                const position = new vscode.Position(line, character);
                
                // Replace the API key at the position
                const replaced = replaceApiKeyAtPosition(document, position);
                
                if (!replaced) {
                    vscode.window.showErrorMessage('Failed to locate API key at the specified position');
                    console.error('Failed to locate API key at position:', position);
                }
            } else {
                vscode.window.showErrorMessage(`Document not found: ${documentUri}`);
                console.error('Document not found:', documentUri);
                console.log('Available documents:', documents.map(d => d.uri.toString()));
            }
        } catch (error) {
            console.error('Error in replaceKey command:', error);
            vscode.window.showErrorMessage(`Error replacing API key: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    
    context.subscriptions.push(command);
}