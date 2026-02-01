import * as vscode from 'vscode';
import { TestCaseRenderer } from './testCaseRenderer';

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

export class TestCasePreviewProvider {
    private previewPanels: Map<string, vscode.WebviewPanel> = new Map();

    constructor(private context: vscode.ExtensionContext) {}

    public openPreview(document: vscode.TextDocument) {
        const uri = document.uri.toString();
        
        // Reuse existing panel if available
        let panel = this.previewPanels.get(uri);
        
        if (panel) {
            panel.reveal();
            this.updatePreview(panel, document);
            return;
        }

        // Create new panel - open beside the active editor
        // Find the column where the document is currently open
        let targetColumn = vscode.ViewColumn.Beside;
        const visibleEditors = vscode.window.visibleTextEditors;
        for (const editor of visibleEditors) {
            if (editor.document.uri.toString() === uri && editor.viewColumn !== undefined) {
                // Open in the next column after the editor
                targetColumn = editor.viewColumn === vscode.ViewColumn.One 
                    ? vscode.ViewColumn.Two 
                    : editor.viewColumn === vscode.ViewColumn.Two
                    ? vscode.ViewColumn.Three
                    : vscode.ViewColumn.Beside;
                break;
            }
        }

        panel = vscode.window.createWebviewPanel(
            'testCasePreview',
            `Test Case Viewer: ${vscode.workspace.asRelativePath(document.uri)}`,
            targetColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
            }
        );

        this.previewPanels.set(uri, panel);
        this.updatePreview(panel, document);

        // Update when document changes
        const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === uri) {
                this.updatePreview(panel!, e.document);
            }
        });

        // Clean up when panel is closed
        panel.onDidDispose(() => {
            changeSubscription.dispose();
            this.previewPanels.delete(uri);
        });
    }

    private updatePreview(panel: vscode.WebviewPanel, document: vscode.TextDocument) {
        let testCase: TestCase;
        try {
            testCase = JSON.parse(document.getText());
        } catch (error) {
            panel.webview.html = TestCaseRenderer.getErrorHtml('Ошибка парсинга JSON. Убедитесь, что файл содержит валидный JSON.');
            return;
        }

        panel.webview.html = TestCaseRenderer.render(testCase);
    }
}
