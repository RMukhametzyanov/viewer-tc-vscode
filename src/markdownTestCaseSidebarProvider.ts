import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MarkdownTestCaseParser, MarkdownTestCase, MarkdownComment } from './markdownTestCaseParser';
import { MarkdownTestCaseRenderer } from './markdownTestCaseRenderer';
import { SettingsProvider } from './settingsProvider';

export class MarkdownTestCaseSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'markdownTestCaseViewer.sidebar';

    private _view?: vscode.WebviewView;
    private _focusedElementInfo: { id: string; selectionStart?: number; selectionEnd?: number } | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
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
                case 'reorderSteps':
                    await this._reorderStepsInFile(message.fromIndex, message.toIndex);
                    return;
                case 'addStep':
                    await this._addStepInFile(message.afterIndex);
                    return;
                case 'deleteStep':
                    await this._deleteStepInFile(message.stepIndex);
                    return;
                case 'updateComment':
                    await this._updateCommentInFile(message.commentIndex, message.field, message.value);
                    return;
                case 'addComment':
                    await this._addCommentInFile(message.comment);
                    return;
                case 'addTag':
                    await SettingsProvider.addTag(message.tag);
                    return;
                case 'openFile':
                    await this._openFile(message.relativePath);
                    return;
                case 'addAttachedDocument':
                    await this._addAttachedDocument(message.relativePath, message.displayName);
                    return;
                case 'removeAttachedDocument':
                    await this._removeAttachedDocument(message.index);
                    return;
                case 'selectFileToAttach':
                    await this._selectFileToAttach();
                    return;
                case 'handleDroppedFile':
                    await this._handleDroppedFile(message.fileName, message.fileData, message.fileSize, message.fileType);
                    return;
                case 'removeLink':
                    await this._removeLink(message.index);
                    return;
                case 'executeCommand':
                    await vscode.commands.executeCommand(message.commandId);
                    return;
                case 'openStatistics':
                    await vscode.commands.executeCommand('testCaseViewer.showStatistics');
                    return;
                case 'saveCollapseState':
                    // Сохраняем состояние сворачивания блоков в глобальное хранилище
                    await this._context.globalState.update('descriptionCollapsed', message.descriptionCollapsed);
                    await this._context.globalState.update('preconditionsCollapsed', message.preconditionsCollapsed);
                    return;
            }
        });

        // Track if user is editing in webview
        let isUserEditing = false;
        
        // Listen for focus state from webview
        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.command === 'focusState') {
                isUserEditing = message.hasFocus;
            } else if (message.command === 'saveFocusState') {
                // Save focus information before update
                this._focusedElementInfo = message.focusInfo;
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
                // Remove leading " - " if present (from new link format)
                const cleanValue = value.replace(/^\s*-\s*/, '').trim();
                
                // Only add if value is not empty
                if (cleanValue) {
                    while (testCase.links.length <= index) {
                        testCase.links.push('');
                    }
                    testCase.links[index] = cleanValue;
                } else {
                    // Remove empty links at the end
                    while (testCase.links.length > 0 && testCase.links[testCase.links.length - 1] === '') {
                        testCase.links.pop();
                    }
                }
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
                this.updateContent(true);
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
                this.updateContent(true);
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
                } else if (field === 'reason') {
                    step.reason = value;
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
                this.updateContent(true);
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при обновлении шага: ${error}`);
        }
    }

    private async _reorderStepsInFile(fromIndex: number, toIndex: number) {
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
            
            // Reorder steps
            if (testCase.steps && testCase.steps.length > 0) {
                if (fromIndex >= 0 && fromIndex < testCase.steps.length &&
                    toIndex >= 0 && toIndex < testCase.steps.length) {
                    const steps = [...testCase.steps];
                    const [movedStep] = steps.splice(fromIndex, 1);
                    steps.splice(toIndex, 0, movedStep);
                    
                    // Update step numbers
                    steps.forEach((step, index) => {
                        step.stepNumber = index + 1;
                    });
                    
                    testCase.steps = steps;
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
                this.updateContent(true);
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при переупорядочивании шагов: ${error}`);
        }
    }

    private async _updateCommentInFile(commentIndex: number, field: string, value: string) {
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
            
            // Update comment field
            if (testCase.comments && testCase.comments[commentIndex]) {
                const comment = testCase.comments[commentIndex];
                if (field === 'comment') {
                    comment.comment = value;
                } else if (field === 'status') {
                    comment.status = value;
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
                this.updateContent(true);
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при обновлении комментария: ${error}`);
        }
    }

    private async _addCommentInFile(commentText: string) {
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
            
            // Create new comment
            if (!testCase.comments) {
                testCase.comments = [];
            }
            
            const newComment: MarkdownComment = {
                number: testCase.comments.length + 1,
                comment: commentText,
                status: 'OPEN'
            };
            
            testCase.comments.push(newComment);

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
                this.updateContent(true);
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при добавлении комментария: ${error}`);
        }
    }

    private async _addStepInFile(afterIndex: number) {
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
            
            // Create new empty step
            const newStep = {
                stepNumber: 0, // Will be recalculated
                action: '',
                expectedResult: '',
                attachments: '',
                status: ''
            };
            
            // Add step after the specified index
            if (!testCase.steps) {
                testCase.steps = [];
            }
            
            const insertIndex = afterIndex + 1;
            testCase.steps.splice(insertIndex, 0, newStep);
            
            // Update step numbers
            testCase.steps.forEach((step, index) => {
                step.stepNumber = index + 1;
            });

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
                this.updateContent(true);
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при добавлении шага: ${error}`);
        }
    }

    private async _deleteStepInFile(stepIndex: number) {
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
            
            // Delete step
            if (testCase.steps && testCase.steps.length > stepIndex) {
                testCase.steps.splice(stepIndex, 1);
                
                // Update step numbers
                testCase.steps.forEach((step, index) => {
                    step.stepNumber = index + 1;
                });
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
                this.updateContent(true);
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при удалении шага: ${error}`);
        }
    }

    public updateContent(restoreFocus: boolean = false) {
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
            // Ensure steps is always an array
            if (!testCase.steps) {
                testCase.steps = [];
            }
            
            const hasContent = testCase.title || 
                               Object.keys(testCase.metadata).length > 0 ||
                               (testCase.steps && testCase.steps.length > 0) ||
                               testCase.description ||
                               testCase.preconditions ||
                               (testCase.tags && testCase.tags.length > 0) ||
                               (testCase.links && testCase.links.length > 0) ||
                               (testCase.attachedDocuments && testCase.attachedDocuments.length > 0) ||
                               (testCase.comments && testCase.comments.length > 0) ||
                               Object.keys(testCase.epicFeatureStory).length > 0;
            
            if (hasContent || content.includes('## Метаданные') || content.includes('## Шаги тестирования')) {
                const testers = SettingsProvider.getTesters();
                const tags = SettingsProvider.getTags();
                const showStatusColumn = vscode.workspace.getConfiguration('testCaseViewer').get<boolean>('showStatusColumn', true);
                
                // Get focus info if we need to restore it
                const focusInfo = restoreFocus ? this._focusedElementInfo : null;
                
                // Get saved collapse state
                const descriptionCollapsed = this._context.globalState.get<boolean>('descriptionCollapsed', true);
                const preconditionsCollapsed = this._context.globalState.get<boolean>('preconditionsCollapsed', true);
                
                this._view.webview.html = MarkdownTestCaseRenderer.render(
                    testCase, 
                    documentUri, 
                    testers, 
                    tags, 
                    showStatusColumn, 
                    focusInfo,
                    descriptionCollapsed,
                    preconditionsCollapsed
                );
                
                // Clear focus info after using it
                if (restoreFocus) {
                    this._focusedElementInfo = null;
                }
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
        const showStatusColumn = vscode.workspace.getConfiguration('testCaseViewer').get<boolean>('showStatusColumn', true);
        
        return `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Markdown Test Case Viewer</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    html {
                        height: 100%;
                        overflow: auto;
                    }
                    
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 24px;
                        line-height: 1.5;
                        margin: 0;
                        height: auto;
                        overflow: visible;
                    }
                    
                    .viewer-top-header {
                        position: sticky;
                        top: 0;
                        background-color: var(--vscode-editor-background);
                        padding: 12px 24px;
                        margin: -24px -24px 24px -24px;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        gap: 8px;
                        z-index: 100;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }

                    .viewer-header-button {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        background: transparent;
                        border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
                        color: var(--vscode-foreground);
                        cursor: pointer;
                        font-size: 13px;
                        padding: 6px 12px;
                        border-radius: 3px;
                        transition: background-color 0.2s, border-color 0.2s;
                        gap: 6px;
                    }

                    .viewer-header-button:hover {
                        background-color: var(--vscode-list-hoverBackground);
                        border-color: var(--vscode-focusBorder);
                    }

                    .viewer-header-button:active {
                        background-color: var(--vscode-list-activeSelectionBackground);
                    }

                    .viewer-header-button.active {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border-color: var(--vscode-button-background);
                    }

                    .viewer-header-button.active:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }

                    .viewer-header-button-icon {
                        font-size: 16px;
                        line-height: 1;
                    }
                    
                    .empty-message {
                        color: var(--vscode-descriptionForeground);
                        font-size: 14px;
                        text-align: center;
                        padding: 40px 20px;
                    }
                </style>
            </head>
            <body>
                <div class="viewer-top-header">
                    <button class="viewer-header-button" id="run-tests-button" title="Запустить прогон тестов">
                        <span class="viewer-header-button-icon">▶</span>
                        <span>Запуск тест-кейсов</span>
                    </button>
                    <button class="viewer-header-button" id="statistics-button" title="Открыть статистику">
                        <span class="viewer-header-button-icon">📊</span>
                        <span>Статистика</span>
                    </button>
                    <button class="viewer-header-button" id="settings-button" title="Открыть настройки">
                        <span class="viewer-header-button-icon">⚙️</span>
                        <span>Настройки</span>
                    </button>
                    <button class="viewer-header-button ${showStatusColumn ? 'active' : ''}" id="show-status-button" title="Показать/скрыть колонку статуса">
                        <span class="viewer-header-button-icon">✓</span>
                        <span>Показать статус</span>
                    </button>
                </div>
                <div class="empty-message">${message || defaultMessage}</div>
                <script>
                    (function() {
                        const vscode = acquireVsCodeApi();

                        // Header button handlers
                        const runTestsButton = document.getElementById('run-tests-button');
                        const statisticsButton = document.getElementById('statistics-button');
                        const settingsButton = document.getElementById('settings-button');
                        const showStatusButton = document.getElementById('show-status-button');

                        if (runTestsButton) {
                            runTestsButton.addEventListener('click', function() {
                                vscode.postMessage({
                                    command: 'executeCommand',
                                    commandId: 'testCaseViewer.createStandaloneHtml'
                                });
                            });
                        }

                        if (statisticsButton) {
                            statisticsButton.addEventListener('click', function() {
                                vscode.postMessage({
                                    command: 'openStatistics'
                                });
                            });
                        }

                        if (settingsButton) {
                            settingsButton.addEventListener('click', function() {
                                vscode.postMessage({
                                    command: 'executeCommand',
                                    commandId: 'testCaseViewer.openSettings'
                                });
                            });
                        }

                        // Toggle status column visibility
                        if (showStatusButton) {
                            // Load saved state from localStorage
                            const savedState = localStorage.getItem('showStatusColumn');
                            let isStatusColumnVisible = savedState !== null ? savedState === 'true' : ${showStatusColumn ? 'true' : 'false'};
                            
                            // Update button state on load
                            if (isStatusColumnVisible) {
                                showStatusButton.classList.add('active');
                            } else {
                                showStatusButton.classList.remove('active');
                            }
                            
                            // Toggle on button click
                            showStatusButton.addEventListener('click', function() {
                                isStatusColumnVisible = !isStatusColumnVisible;
                                if (isStatusColumnVisible) {
                                    showStatusButton.classList.add('active');
                                } else {
                                    showStatusButton.classList.remove('active');
                                }
                                // Save state to localStorage
                                localStorage.setItem('showStatusColumn', isStatusColumnVisible.toString());
                            });
                        }
                    })();
                </script>
            </body>
            </html>
        `;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return this._getEmptyHtml();
    }

    private async _openFile(relativePath: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return;
        }

        try {
            // Получаем URI текущего файла тест-кейса
            const currentFileUri = activeEditor.document.uri;
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFileUri);
            
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Не удалось определить рабочую папку');
                return;
            }

            // Строим абсолютный путь к файлу
            const targetUri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
            
            // Проверяем существование файла
            try {
                await vscode.workspace.fs.stat(targetUri);
            } catch {
                vscode.window.showErrorMessage(`Файл не найден: ${relativePath}`);
                return;
            }

            // Открываем файл
            const document = await vscode.workspace.openTextDocument(targetUri);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при открытии файла: ${error}`);
        }
    }

    private async _addAttachedDocument(relativePath: string, displayName: string) {
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
            
            if (!testCase.attachedDocuments) {
                testCase.attachedDocuments = [];
            }
            
            // Добавляем в формате [Название](относительный/путь)
            const linkMarkdown = `[${displayName}](${relativePath})`;
            testCase.attachedDocuments.push(linkMarkdown);

            const newContent = MarkdownTestCaseParser.serialize(testCase);
            
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
            
            setTimeout(() => {
                this._isUpdatingFromFile = false;
                this.updateContent();
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при добавлении файла: ${error}`);
        }
    }

    private async _removeAttachedDocument(index: number) {
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
            
            if (testCase.attachedDocuments && testCase.attachedDocuments.length > index) {
                // Получаем информацию о файле перед удалением из списка
                const attachmentToRemove = testCase.attachedDocuments[index];
                
                // Парсим путь к файлу из markdown формата [Название](путь)
                const match = attachmentToRemove.match(/\[([^\]]+)\]\(([^)]+)\)/);
                const fileName = match ? match[1] : 'файл';
                
                // Запрашиваем подтверждение
                const confirm = await vscode.window.showWarningMessage(
                    `Вы уверены, что хотите удалить вложение "${fileName}"? Файл будет удален из папки _attachment.`,
                    { modal: true },
                    'Да',
                    'Нет'
                );
                
                if (confirm !== 'Да') {
                    return;
                }
                
                if (match && match[2]) {
                    const relativePath = match[2];
                    const testCaseFilePath = document.uri.fsPath;
                    const testCaseDir = path.dirname(testCaseFilePath);
                    
                    // Вычисляем абсолютный путь к файлу
                    const attachmentFilePath = path.resolve(testCaseDir, relativePath);
                    
                    // Удаляем физический файл, если он существует
                    if (fs.existsSync(attachmentFilePath)) {
                        try {
                            fs.unlinkSync(attachmentFilePath);
                        } catch (fileError) {
                            // Если не удалось удалить файл, продолжаем удаление из markdown
                            vscode.window.showWarningMessage(`Не удалось удалить файл: ${attachmentFilePath}. Ссылка будет удалена из тест-кейса.`);
                        }
                    }
                }
                
                // Удаляем из списка вложений
                testCase.attachedDocuments.splice(index, 1);
            }

            const newContent = MarkdownTestCaseParser.serialize(testCase);
            
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
            
            setTimeout(() => {
                this._isUpdatingFromFile = false;
                this.updateContent();
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при удалении файла: ${error}`);
        }
    }

    private async _selectFileToAttach() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('Откройте файл тест-кейса для добавления вложения');
            return;
        }

        const isMarkdown = activeEditor.document.languageId === 'markdown' || 
                          activeEditor.document.fileName.endsWith('.md') ||
                          activeEditor.document.fileName.endsWith('.markdown');
        
        if (!isMarkdown) {
            vscode.window.showErrorMessage('Откройте файл тест-кейса для добавления вложения');
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Не удалось определить рабочую папку');
            return;
        }

        // Показываем диалог выбора файла
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Выбрать файл',
            defaultUri: workspaceFolder.uri
        });

        if (fileUri && fileUri[0]) {
            try {
                const document = activeEditor.document;
                const testCaseFilePath = document.uri.fsPath;
                const testCaseDir = path.dirname(testCaseFilePath);
                
                const selectedUri = fileUri[0];
                const sourceFilePath = selectedUri.fsPath;
                const fileName = path.basename(sourceFilePath);
                
                // Создаем папку _attachment если её нет
                const attachmentDir = path.join(testCaseDir, '_attachment');
                if (!fs.existsSync(attachmentDir)) {
                    fs.mkdirSync(attachmentDir, { recursive: true });
                }
                
                // Санитизируем имя файла (убираем недопустимые символы)
                const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
                
                // Проверяем, существует ли файл с таким именем
                let targetFileName = sanitizedFileName;
                let targetFilePath = path.join(attachmentDir, targetFileName);
                let counter = 1;
                
                // Если файл существует, добавляем номер
                while (fs.existsSync(targetFilePath)) {
                    const fileExtension = path.extname(sanitizedFileName);
                    const baseFileName = path.basename(sanitizedFileName, fileExtension);
                    targetFileName = `${baseFileName}_${counter}${fileExtension}`;
                    targetFilePath = path.join(attachmentDir, targetFileName);
                    counter++;
                }
                
                // Копируем файл
                fs.copyFileSync(sourceFilePath, targetFilePath);
                
                // Вычисляем относительный путь от тест-кейса к файлу
                const relativePath = path.relative(testCaseDir, targetFilePath);
                // Нормализуем путь для использования в markdown (используем прямые слеши)
                const normalizedRelativePath = relativePath.replace(/\\/g, '/');
                
                // Добавляем ссылку в тест-кейс (используем оригинальное имя для отображения)
                await this._addAttachedDocument(normalizedRelativePath, fileName);
                
                vscode.window.showInformationMessage(`Файл "${fileName}" успешно добавлен в вложения`);
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка при добавлении файла: ${error}`);
            }
        }
    }

    private async _handleDroppedFile(fileName: string, fileData: string, fileSize: number, fileType: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('Откройте файл тест-кейса для добавления вложения');
            return;
        }
        
        const isMarkdown = activeEditor.document.languageId === 'markdown' || 
                          activeEditor.document.fileName.endsWith('.md') ||
                          activeEditor.document.fileName.endsWith('.markdown');
        
        if (!isMarkdown) {
            vscode.window.showErrorMessage('Откройте файл тест-кейса для добавления вложения');
            return;
        }

        try {
            const document = activeEditor.document;
            const testCaseFilePath = document.uri.fsPath;
            const testCaseDir = path.dirname(testCaseFilePath);
            
            // Создаем папку _attachment если её нет
            const attachmentDir = path.join(testCaseDir, '_attachment');
            if (!fs.existsSync(attachmentDir)) {
                fs.mkdirSync(attachmentDir, { recursive: true });
            }
            
            // Санитизируем имя файла (убираем недопустимые символы)
            const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
            
            // Проверяем, существует ли файл с таким именем
            let targetFileName = sanitizedFileName;
            let targetFilePath = path.join(attachmentDir, targetFileName);
            let counter = 1;
            
            // Если файл существует, добавляем номер
            while (fs.existsSync(targetFilePath)) {
                const fileExtension = path.extname(sanitizedFileName);
                const baseFileName = path.basename(sanitizedFileName, fileExtension);
                targetFileName = `${baseFileName}_${counter}${fileExtension}`;
                targetFilePath = path.join(attachmentDir, targetFileName);
                counter++;
            }
            
            // Декодируем base64 данные
            // fileData приходит в формате "data:type;base64,base64data"
            const base64Match = fileData.match(/^data:.*?;base64,(.+)$/);
            if (!base64Match || !base64Match[1]) {
                throw new Error('Неверный формат данных файла');
            }
            
            const base64Data = base64Match[1];
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Записываем файл
            fs.writeFileSync(targetFilePath, buffer);
            
            // Вычисляем относительный путь от тест-кейса к файлу
            const relativePath = path.relative(testCaseDir, targetFilePath);
            // Нормализуем путь для использования в markdown (используем прямые слеши)
            const normalizedRelativePath = relativePath.replace(/\\/g, '/');
            
            // Добавляем ссылку в тест-кейс (используем оригинальное имя для отображения)
            await this._addAttachedDocument(normalizedRelativePath, fileName);
            
            vscode.window.showInformationMessage(`Файл "${fileName}" успешно добавлен в вложения`);
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при добавлении файла: ${error}`);
        }
    }

    private async _removeLink(index: number) {
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
            
            if (testCase.links && testCase.links.length > index) {
                // Удаляем связь из списка
                testCase.links.splice(index, 1);
            }

            const newContent = MarkdownTestCaseParser.serialize(testCase);
            
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
            
            setTimeout(() => {
                this._isUpdatingFromFile = false;
                this.updateContent();
            }, 200);
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при удалении связи: ${error}`);
        }
    }
}

