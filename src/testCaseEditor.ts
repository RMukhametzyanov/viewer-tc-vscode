import * as vscode from 'vscode';
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

export class TestCaseEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new TestCaseEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            'testCaseViewer.testCase',
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        );
        return providerRegistration;
    }

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
        };

        const updateWebview = () => {
            webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);
        };

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'updateField':
                    await this._updateFieldInFile(document, message.field, message.value);
                    updateWebview();
                    return;
                case 'addTag':
                    await SettingsProvider.addTag(message.tag);
                    return;
                case 'addReview':
                    await this._addReview(document, message.stepId, message.comment);
                    updateWebview();
                    return;
                case 'updateReviewStatus':
                    await this._updateReviewStatus(document, message.reviewId, message.status);
                    updateWebview();
                    return;
                case 'deleteReview':
                    await this._deleteReview(document, message.reviewId);
                    // The onDidChangeTextDocument handler will automatically update the webview
                    // But we also manually update after a short delay to ensure it refreshes
                    setTimeout(() => {
                        updateWebview();
                    }, 200);
                    return;
                case 'openStatistics':
                    await vscode.commands.executeCommand('testCaseViewer.showStatistics');
                    return;
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        updateWebview();
    }

    private async _updateFieldInFile(document: vscode.TextDocument, field: string, value: string): Promise<void> {
        try {
            const content = JSON.parse(document.getText());
            content[field] = value;
            if (field === 'updatedAt' || !content.updatedAt) {
                content.updatedAt = Date.now();
            }

            const newContent = JSON.stringify(content, null, 4);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            edit.replace(document.uri, fullRange, newContent);
            await vscode.workspace.applyEdit(edit);
            await document.save();
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при обновлении файла: ${error}`);
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

    private async _addReview(document: vscode.TextDocument, stepId: string, comment: string): Promise<void> {
        try {
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
                createdAt: Date.now(),
                comment: comment,
                status: 'open' as const
            };
            
            content.notes.push(review);
            content.updatedAt = Date.now();
            
            const newContent = JSON.stringify(content, null, 4);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            edit.replace(document.uri, fullRange, newContent);
            await vscode.workspace.applyEdit(edit);
            await document.save();
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при добавлении комментария: ${error}`);
        }
    }

    private async _updateReviewStatus(document: vscode.TextDocument, reviewId: string, status: string): Promise<void> {
        try {
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
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            edit.replace(document.uri, fullRange, newContent);
            await vscode.workspace.applyEdit(edit);
            await document.save();
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при обновлении статуса комментария: ${error}`);
        }
    }

    private async _deleteReview(document: vscode.TextDocument, reviewId: string): Promise<void> {
        try {
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
            
            const newContent = JSON.stringify(content, null, 4);
            const edit = new vscode.WorkspaceEdit();
            const documentText = document.getText();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(documentText.length)
            );
            edit.replace(document.uri, fullRange, newContent);
            await vscode.workspace.applyEdit(edit);
            await document.save();
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при удалении комментария: ${error}`);
        }
    }


    private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
        let testCase: TestCase;
        try {
            testCase = JSON.parse(document.getText());
        } catch (error) {
            return TestCaseRenderer.getErrorHtml('Ошибка парсинга JSON. Убедитесь, что файл содержит валидный JSON.');
        }

        const testers = SettingsProvider.getTesters();
        const tags = SettingsProvider.getTags();
        return TestCaseRenderer.render(testCase, undefined, testers, tags);
    }
}
