import * as vscode from 'vscode';
import { MarkdownTestCaseParser, MarkdownTestCase } from './markdownTestCaseParser';
import { MarkdownTestCaseRenderer } from './markdownTestCaseRenderer';
import { SettingsProvider } from './settingsProvider';

export class MarkdownTestCaseSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'markdownTestCaseViewer.sidebar';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

    private _isUpdatingFromFile = false;
    private _lastUpdateTime = 0;

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'updateField':
                    await this._updateFieldInFile(message.field, message.value);
                    return;
                case 'updateMetadata':
                    await this._updateMetadataInFile(message.field, message.value);
                    return;
                case 'updateStep':
                    await this._updateStepInFile(message.stepIndex, message.field, message.value);
                    return;
            }
        });

        // Track if user is editing in webview
        let isUserEditing = false;
        
        // Listen for focus state from webview
        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.command === 'focusState') {
                isUserEditing = message.hasFocus;
            }
        });

        // Update when active editor changes
        const updateWebview = () => {
            if (this._view && !this._isUpdatingFromFile && !isUserEditing) {
                this.updateContent();
            }
        };

        // Listen for editor changes
        const changeActiveEditor = vscode.window.onDidChangeActiveTextEditor(updateWebview);
        const changeDocument = vscode.workspace.onDidChangeTextDocument((e) => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.uri.toString() === e.document.uri.toString()) {
                // Skip if change was made by us (within last 500ms) or user is editing
                const now = Date.now();
                if (!this._isUpdatingFromFile && !isUserEditing && (now - this._lastUpdateTime > 500)) {
                    updateWebview();
                }
            }
        });

        // Initial update with small delay to ensure editor is ready
        setTimeout(() => {
            updateWebview();
        }, 100);

        // Also update when webview becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                updateWebview();
            }
        });

        // Clean up
        webviewView.onDidDispose(() => {
            changeActiveEditor.dispose();
            changeDocument.dispose();
        });
    }

    private async _updateFieldInFile(field: string, value: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return;
        }
        
        const isMarkdown = activeEditor.document.languageId === 'markdown' || 
                          activeEditor.document.fileName.endsWith('.md') ||
                          activeEditor.document.fileName.endsWith('.markdown');
        
        if (!isMarkdown) {
            return;
        }

        try {
            const document = activeEditor.document;
            const content = document.getText();
            const testCase = MarkdownTestCaseParser.parse(content);
            
            // Update field based on field name
            if (field === 'title') {
                testCase.title = value;
            } else if (field === 'description') {
                testCase.description = value;
            } else if (field === 'preconditions') {
                testCase.preconditions = value;
            } else if (field === 'tags') {
                testCase.tags = value.split(',').map(t => t.trim()).filter(t => t.length > 0);
            } else if (field.startsWith('link-')) {
                const index = parseInt(field.split('-')[1]);
                if (!testCase.links) {
                    testCase.links = [];
                }
                while (testCase.links.length <= index) {
                    testCase.links.push('');
                }
                testCase.links[index] = value;
            } else if (field.startsWith('comment-')) {
                const index = parseInt(field.split('-')[1]);
                if (!testCase.comments) {
                    testCase.comments = [];
                }
                while (testCase.comments.length <= index) {
                    testCase.comments.push('');
                }
                testCase.comments[index] = value;
            } else if (field === 'epic') {
                testCase.epicFeatureStory.epic = value;
            } else if (field === 'feature') {
                testCase.epicFeatureStory.feature = value;
            } else if (field === 'story') {
                testCase.epicFeatureStory.story = value;
            }

            // Serialize back to markdown
            const newContent = MarkdownTestCaseParser.serialize(testCase);
            
            // Update file
            this._isUpdatingFromFile = true;
            this._lastUpdateTime = Date.now();
            
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            edit.replace(document.uri, fullRange, newContent);
            
            await vscode.workspace.applyEdit(edit);
            await document.save();
            
            // Small delay to let file update, then refresh webview
            setTimeout(() => {
                this._isUpdatingFromFile = false;
                this.updateContent();
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при обновлении файла: ${error}`);
        }
    }

    private async _updateMetadataInFile(field: string, value: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return;
        }
        
        const isMarkdown = activeEditor.document.languageId === 'markdown' || 
                          activeEditor.document.fileName.endsWith('.md') ||
                          activeEditor.document.fileName.endsWith('.markdown');
        
        if (!isMarkdown) {
            return;
        }

        try {
            const document = activeEditor.document;
            const content = document.getText();
            const testCase = MarkdownTestCaseParser.parse(content);
            
            // Update metadata field
            if (field === 'status') {
                testCase.metadata.status = value;
            } else if (field === 'testType') {
                testCase.metadata.testType = value;
            } else if (field === 'owner') {
                testCase.metadata.owner = value;
            } else if (field === 'author') {
                testCase.metadata.author = value;
            }

            // Serialize back to markdown
            const newContent = MarkdownTestCaseParser.serialize(testCase);
            
            // Update file
            this._isUpdatingFromFile = true;
            this._lastUpdateTime = Date.now();
            
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            edit.replace(document.uri, fullRange, newContent);
            
            await vscode.workspace.applyEdit(edit);
            await document.save();
            
            // Small delay to let file update, then refresh webview
            setTimeout(() => {
                this._isUpdatingFromFile = false;
                this.updateContent();
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при обновлении метаданных: ${error}`);
        }
    }

    private async _updateStepInFile(stepIndex: number, field: string, value: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return;
        }
        
        const isMarkdown = activeEditor.document.languageId === 'markdown' || 
                          activeEditor.document.fileName.endsWith('.md') ||
                          activeEditor.document.fileName.endsWith('.markdown');
        
        if (!isMarkdown) {
            return;
        }

        try {
            const document = activeEditor.document;
            const content = document.getText();
            const testCase = MarkdownTestCaseParser.parse(content);
            
            // Update step field
            if (testCase.steps && testCase.steps[stepIndex]) {
                const step = testCase.steps[stepIndex];
                if (field === 'action') {
                    step.action = value;
                } else if (field === 'expectedResult') {
                    step.expectedResult = value;
                } else if (field === 'attachments') {
                    step.attachments = value;
                } else if (field === 'status') {
                    step.status = value;
                }
            }

            // Serialize back to markdown
            const newContent = MarkdownTestCaseParser.serialize(testCase);
            
            // Update file
            this._isUpdatingFromFile = true;
            this._lastUpdateTime = Date.now();
            
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            edit.replace(document.uri, fullRange, newContent);
            
            await vscode.workspace.applyEdit(edit);
            await document.save();
            
            // Small delay to let file update, then refresh webview
            setTimeout(() => {
                this._isUpdatingFromFile = false;
                this.updateContent();
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при обновлении шага: ${error}`);
        }
    }

    public updateContent() {
        if (!this._view) {
            return;
        }

        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor) {
            this._view.webview.html = this._getEmptyHtml();
            return;
        }

        // Check if file is markdown by languageId or extension
        const isMarkdown = activeEditor.document.languageId === 'markdown' || 
                          activeEditor.document.fileName.endsWith('.md') ||
                          activeEditor.document.fileName.endsWith('.markdown');
        
        if (!isMarkdown) {
            this._view.webview.html = this._getEmptyHtml();
            return;
        }

        try {
            const content = activeEditor.document.getText();
            const testCase = MarkdownTestCaseParser.parse(content);
            const documentUri = activeEditor.document.uri.toString();
            
            // Check if it's a markdown test case - if it has any sections or title, show it
            // Even if empty, we should show the structure
            const hasContent = testCase.title || 
                               Object.keys(testCase.metadata).length > 0 ||
                               testCase.steps.length > 0 ||
                               testCase.description ||
                               testCase.preconditions ||
                               (testCase.tags && testCase.tags.length > 0) ||
                               (testCase.links && testCase.links.length > 0) ||
                               (testCase.comments && testCase.comments.length > 0) ||
                               Object.keys(testCase.epicFeatureStory).length > 0;
            
            if (hasContent || content.includes('## Метаданные') || content.includes('## Шаги тестирования')) {
                const testers = SettingsProvider.getTesters();
                this._view.webview.html = MarkdownTestCaseRenderer.render(testCase, documentUri, testers);
            } else {
                this._view.webview.html = this._getEmptyHtml('Этот файл не является тест-кейсом в формате markdown');
            }
        } catch (error) {
            console.error('Error parsing markdown test case:', error);
            this._view.webview.html = this._getEmptyHtml(`Не удалось прочитать тест-кейс: ${error}`);
        }
    }

    private _getEmptyHtml(message?: string): string {
        const defaultMessage = 'Откройте markdown файл с тест-кейсом для просмотра';
        return `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Markdown Test Case Viewer</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        text-align: center;
                    }
                    .empty-message {
                        color: var(--vscode-descriptionForeground);
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="empty-message">${message || defaultMessage}</div>
            </body>
            </html>
        `;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return this._getEmptyHtml();
    }
}

