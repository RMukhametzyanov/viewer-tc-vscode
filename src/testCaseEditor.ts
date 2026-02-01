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

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        updateWebview();
    }


    private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
        let testCase: TestCase;
        try {
            testCase = JSON.parse(document.getText());
        } catch (error) {
            return TestCaseRenderer.getErrorHtml('Ошибка парсинга JSON. Убедитесь, что файл содержит валидный JSON.');
        }

        return TestCaseRenderer.render(testCase);
    }
}
