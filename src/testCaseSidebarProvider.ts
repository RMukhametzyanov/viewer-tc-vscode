import * as vscode from 'vscode';
import { URL } from 'url';
import { TestCaseRenderer } from './testCaseRenderer';
import { SettingsProvider } from './settingsProvider';

interface TestCase {
    id: string;
    name: string;
    description: string;
    preconditions: string;
    expectedResult: string;
    epic: string;
    feature: string;
    story: string;
    component: string;
    testLayer: string;
    severity: string;
    priority: string;
    environment: string;
    browser: string;
    owner: string;
    author: string;
    reviewer: string;
    testCaseId: string;
    issueLinks: string;
    testCaseLinks: string;
    tags: string;
    status: string;
    testType: string;
    steps: TestStep[];
    createdAt?: number;
    updatedAt?: number;
    notes?: any;
}

interface TestStep {
    id: string;
    name: string;
    description: string;
    expectedResult: string;
    status: string;
    bugLink: string;
    skipReason: string;
    attachments: string;
}

export class TestCaseSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'testCaseViewer.sidebar';

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
                case 'updateName':
                    await this._updateFieldInFile('name', message.value);
                    return;
                case 'updateTestType':
                    await this._updateFieldInFile('testType', message.value);
                    return;
                case 'updateStatus':
                    await this._updateFieldInFile('status', message.value);
                    return;
                case 'updateField':
                    await this._updateFieldInFile(message.field, message.value);
                    return;
                case 'updateStep':
                    await this._updateStepFieldInFile(message.stepId, message.field, message.value);
                    return;
                case 'stepAction':
                    await this._handleStepAction(message.action, message.stepId);
                    return;
                case 'addTag':
                    await SettingsProvider.addTag(message.tag);
                    return;
                case 'addReview':
                    await this._addReview(message.stepId, message.comment);
                    return;
                case 'updateReviewStatus':
                    await this._updateReviewStatus(message.reviewId, message.status);
                    return;
                case 'deleteReview':
                    console.log('Received deleteReview message:', message);
                    if (!message.reviewId) {
                        vscode.window.showErrorMessage('Ошибка: reviewId не передан в сообщении');
                        return;
                    }
                    await this._deleteReview(message.reviewId);
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

        // Initial update
        updateWebview();

        // Clean up
        webviewView.onDidDispose(() => {
            changeActiveEditor.dispose();
            changeDocument.dispose();
        });
    }

    private async _updateFieldInFile(field: string, value: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            return;
        }

        try {
            const document = activeEditor.document;
            const content = JSON.parse(document.getText());
            
            // Update field
            content[field] = value;

            // Format JSON
            const newContent = JSON.stringify(content, null, 4);
            
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

    private async _updateStepFieldInFile(stepId: string, field: string, value: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            return;
        }

        try {
            const document = activeEditor.document;
            const content = JSON.parse(document.getText());
            
            // Find step by ID
            if (content.steps && Array.isArray(content.steps)) {
                const step = content.steps.find((s: any) => s.id === stepId);
                if (step) {
                    // Update step field
                    step[field] = value;

                    // Format JSON
                    const newContent = JSON.stringify(content, null, 4);
                    
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
                }
            }
        } catch (error) {
            this._isUpdatingFromFile = false;
            vscode.window.showErrorMessage(`Ошибка при обновлении шага: ${error}`);
        }
    }

    private async _handleStepAction(action: string, stepId: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            return;
        }

        try {
            const document = activeEditor.document;
            const content = JSON.parse(document.getText());
            
            if (!content.steps || !Array.isArray(content.steps)) {
                return;
            }

            const stepIndex = content.steps.findIndex((s: any) => s.id === stepId);
            if (stepIndex === -1) {
                return;
            }

            let newSteps = [...content.steps];

            switch (action) {
                case 'move-up':
                    if (stepIndex > 0) {
                        [newSteps[stepIndex - 1], newSteps[stepIndex]] = [newSteps[stepIndex], newSteps[stepIndex - 1]];
                    }
                    break;
                case 'move-down':
                    if (stepIndex < newSteps.length - 1) {
                        [newSteps[stepIndex], newSteps[stepIndex + 1]] = [newSteps[stepIndex + 1], newSteps[stepIndex]];
                    }
                    break;
                case 'add-above': {
                    const newStep: TestStep = {
                        id: Date.now().toString(),
                        name: `Шаг ${newSteps.length + 1}`,
                        description: '',
                        expectedResult: '',
                        status: '',
                        bugLink: '',
                        skipReason: '',
                        attachments: ''
                    };
                    newSteps.splice(stepIndex, 0, newStep);
                    break;
                }
                case 'add-below': {
                    const newStep: TestStep = {
                        id: Date.now().toString(),
                        name: `Шаг ${newSteps.length + 1}`,
                        description: '',
                        expectedResult: '',
                        status: '',
                        bugLink: '',
                        skipReason: '',
                        attachments: ''
                    };
                    newSteps.splice(stepIndex + 1, 0, newStep);
                    break;
                }
                case 'delete':
                    newSteps.splice(stepIndex, 1);
                    break;
            }

            content.steps = newSteps;

            // Format JSON
            const newContent = JSON.stringify(content, null, 4);
            
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
            vscode.window.showErrorMessage(`Ошибка при выполнении действия с шагом: ${error}`);
        }
    }

    private generateReviewId(): string {
        // Generate GUID v4
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private async _addReview(stepId: string, comment: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            return;
        }

        try {
            const document = activeEditor.document;
            const content = JSON.parse(document.getText());
            
            // Initialize notes as array if not exists
            if (!content.notes) {
                content.notes = [];
            }
            if (!Array.isArray(content.notes)) {
                // If notes is an object (old format), convert to array
                content.notes = [];
            }
            
            // Find step number
            const stepIndex = content.steps.findIndex((s: any) => s.id === stepId);
            const stepNumber = stepIndex >= 0 ? stepIndex + 1 : 1;
            
            // Get current user (from settings or default)
            const testers = SettingsProvider.getTesters();
            const currentUser = testers.length > 0 ? testers[0] : 'Unknown';
            
            // Create review
            const review = {
                id: this.generateReviewId(),
                stepId: stepId,
                stepNumber: stepNumber,
                author: currentUser,
                createdAt: Date.now(),
                comment: comment,
                status: 'open'
            };
            
            content.notes.push(review);
            content.updatedAt = Date.now();
            
            const newContent = JSON.stringify(content, null, 4);
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
            vscode.window.showErrorMessage(`Ошибка при добавлении комментария: ${error}`);
        }
    }

    private async _updateReviewStatus(reviewId: string, status: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            return;
        }

        try {
            const document = activeEditor.document;
            const content = JSON.parse(document.getText());
            
            if (!content.notes || !Array.isArray(content.notes)) {
                return;
            }
            
            const review = content.notes.find((r: any) => r.id === reviewId);
            if (!review) {
                return;
            }
            
            review.status = status;
            
            if (status === 'resolved' || status === 'fixed') {
                review.resolvedAt = Date.now();
                const testers = SettingsProvider.getTesters();
                review.resolvedBy = testers.length > 0 ? testers[0] : 'Unknown';
            } else {
                review.resolvedAt = undefined;
                review.resolvedBy = undefined;
            }
            
            content.updatedAt = Date.now();
            
            const newContent = JSON.stringify(content, null, 4);
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
            vscode.window.showErrorMessage(`Ошибка при обновлении статуса комментария: ${error}`);
        }
    }

    private async _deleteReview(reviewId: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            vscode.window.showWarningMessage('Откройте JSON файл тест-кейса для удаления комментария');
            return;
        }

        try {
            const document = activeEditor.document;
            const content = JSON.parse(document.getText());
            
            if (!content.notes || !Array.isArray(content.notes)) {
                vscode.window.showWarningMessage('Комментарии не найдены');
                return;
            }
            
            // Find index of review to delete (same approach as step deletion)
            const reviewIndex = content.notes.findIndex((r: any) => String(r.id) === String(reviewId));
            if (reviewIndex === -1) {
                vscode.window.showWarningMessage(`Комментарий с ID "${reviewId}" не найден. Всего комментариев: ${content.notes.length}`);
                return;
            }
            
            // Create copy and remove review (same approach as step deletion)
            let newNotes = [...content.notes];
            newNotes.splice(reviewIndex, 1);
            content.notes = newNotes;
            
            content.updatedAt = Date.now();
            
            // Format JSON
            const newContent = JSON.stringify(content, null, 4);
            
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
            vscode.window.showErrorMessage(`Ошибка при удалении комментария: ${error}`);
        }
    }

    public updateContent() {
        if (!this._view) {
            return;
        }

        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            this._view.webview.html = this._getEmptyHtml();
            return;
        }

        try {
            const content = JSON.parse(activeEditor.document.getText());
            const documentUri = activeEditor.document.uri.toString();
            
            // Check if it's a test case
            if (content.id && content.name && Array.isArray(content.steps)) {
                const testers = SettingsProvider.getTesters();
                const tags = SettingsProvider.getTags();
                this._view.webview.html = TestCaseRenderer.render(content, documentUri, testers, tags);
            } else {
                this._view.webview.html = this._getEmptyHtml('Этот файл не является тест-кейсом');
            }
        } catch (error) {
            this._view.webview.html = this._getEmptyHtml('Не удалось прочитать тест-кейс. Убедитесь, что файл содержит валидный JSON.');
        }
    }

    private _getEmptyHtml(message?: string): string {
        const defaultMessage = 'Откройте JSON файл с тест-кейсом для просмотра';
        return `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Test Case Viewer</title>
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
