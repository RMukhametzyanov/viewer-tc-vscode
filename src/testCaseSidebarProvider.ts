import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
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
                case 'checkLlmConnection':
                    await this._checkLlmConnection(webviewView.webview);
                    return;
                case 'getLlmModels':
                    await this._getLlmModels(webviewView.webview);
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
                this._view.webview.html = TestCaseRenderer.render(content, documentUri, testers);
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

    private async _checkLlmConnection(webview: vscode.Webview): Promise<void> {
        const llmHost = SettingsProvider.getLlmHost();
        
        if (!llmHost || llmHost.trim() === '') {
            webview.postMessage({
                command: 'llmConnectionStatus',
                connected: false,
                statusText: 'LLM хост не настроен. Укажите хост в настройках.'
            });
            return;
        }

        try {
            // Parse URL
            let url: URL;
            try {
                url = new URL(llmHost);
            } catch {
                // If no protocol, try adding http://
                url = new URL(llmHost.startsWith('http://') || llmHost.startsWith('https://') ? llmHost : `http://${llmHost}`);
            }

            // Determine if HTTPS or HTTP
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;

            // Create request options
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname || '/',
                method: 'GET',
                timeout: 5000, // 5 second timeout
                headers: {
                    'User-Agent': 'VSCode-TestCaseViewer'
                }
            };

            // Make request
            const isConnected = await new Promise<boolean>((resolve) => {
                const req = client.request(options, (res) => {
                    // Any 2xx or 3xx status means server is reachable
                    resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400);
                    res.on('data', () => {}); // Consume response
                    res.on('end', () => {});
                });

                req.on('error', () => {
                    resolve(false);
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve(false);
                });

                req.end();
            });

            // Send status back to webview
            webview.postMessage({
                command: 'llmConnectionStatus',
                connected: isConnected,
                statusText: isConnected 
                    ? `Подключено к ${llmHost}` 
                    : `Не удалось подключиться к ${llmHost}`
            });
        } catch (error) {
            webview.postMessage({
                command: 'llmConnectionStatus',
                connected: false,
                statusText: `Ошибка при проверке подключения: ${error}`
            });
        }
    }

    private _parseModelsPayload(payload: any): string[] {
        if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
            // If payload is a dict/object
            if (Array.isArray(payload.data)) {
                // Check data array
                return payload.data
                    .filter((item: any) => typeof item === 'object' && item !== null)
                    .map((item: any) => item.id || item.name)
                    .filter((value: any) => value !== undefined && value !== null)
                    .map((value: any) => String(value));
            }
            if (Array.isArray(payload.models)) {
                // Check models array (can be strings or objects)
                return payload.models
                    .filter((item: any) => item !== null && item !== undefined)
                    .map((item: any) => {
                        if (typeof item === 'string') {
                            return item;
                        }
                        if (typeof item === 'object') {
                            return item.id || item.name;
                        }
                        return String(item);
                    })
                    .filter((value: any) => value !== undefined && value !== null)
                    .map((value: any) => String(value));
            }
        }
        if (Array.isArray(payload)) {
            // If payload is an array
            return payload
                .filter((item: any) => typeof item === 'object' && item !== null)
                .map((item: any) => item.id || item.name)
                .filter((value: any) => value !== undefined && value !== null)
                .map((value: any) => String(value));
        }
        return [];
    }

    private async _getLlmModels(webview: vscode.Webview): Promise<void> {
        const llmHost = SettingsProvider.getLlmHost();
        
        if (!llmHost || llmHost.trim() === '') {
            webview.postMessage({
                command: 'llmModelsList',
                models: [],
                error: 'LLM хост не настроен. Укажите хост в настройках.'
            });
            return;
        }

        // Model endpoints to try (same as in Python code)
        const modelEndpoints = [
            '/models',
            '/v1/models',
            '/api/models',
            '/api/tags'
        ];

        const base = llmHost.trim().replace(/\/+$/, ''); // Remove trailing slashes
        let lastError: Error | null = null;
        let parsedModels: string[] = [];

        for (const endpoint of modelEndpoints) {
            const fullUrl = base + endpoint;
            
            try {
                // Parse URL
                let url: URL;
                try {
                    url = new URL(fullUrl);
                } catch {
                    // If no protocol, try adding http://
                    url = new URL(fullUrl.startsWith('http://') || fullUrl.startsWith('https://') ? fullUrl : `http://${fullUrl}`);
                }

                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;

                const options = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname,
                    method: 'GET',
                    timeout: 10000, // 10 second timeout
                    headers: {
                        'User-Agent': 'VSCode-TestCaseViewer',
                        'Accept': 'application/json'
                    }
                };

                const response = await new Promise<{ statusCode?: number; data: string }>((resolve, reject) => {
                    const req = client.request(options, (res) => {
                        let data = '';
                        
                        res.on('data', (chunk) => {
                            data += chunk;
                        });
                        
                        res.on('end', () => {
                            resolve({ statusCode: res.statusCode, data: data });
                        });
                    });

                    req.on('error', (error) => {
                        reject(error);
                    });

                    req.on('timeout', () => {
                        req.destroy();
                        reject(new Error('Request timeout'));
                    });

                    req.end();
                });

                if (response.statusCode && response.statusCode === 200) {
                    try {
                        const jsonData = JSON.parse(response.data);
                        const models = this._parseModelsPayload(jsonData);
                        
                        if (models.length > 0) {
                            parsedModels = models;
                            break; // Success, exit loop
                        }
                        
                        lastError = new Error(`Эндпойнт ${fullUrl} вернул неожиданный формат: ${JSON.stringify(jsonData)}`);
                    } catch (parseError) {
                        lastError = new Error(`Не удалось распарсить JSON от ${fullUrl}: ${parseError}`);
                        continue;
                    }
                } else {
                    const statusCode = response.statusCode || 0;
                    lastError = new Error(`Хост ${fullUrl} вернул статус ${statusCode}: ${response.data}`);
                    continue;
                }
            } catch (error) {
                if (error instanceof Error) {
                    lastError = new Error(`Не удалось выполнить запрос к ${fullUrl}: ${error.message}`);
                } else {
                    lastError = new Error(`Не удалось выполнить запрос к ${fullUrl}: ${String(error)}`);
                }
                continue;
            }
        }

        if (parsedModels.length > 0) {
            webview.postMessage({
                command: 'llmModelsList',
                models: parsedModels,
                error: undefined
            });
        } else {
            webview.postMessage({
                command: 'llmModelsList',
                models: [],
                error: lastError ? lastError.message : 'Не удалось получить список моделей: попытки всех эндпойнтов завершились без результата.'
            });
        }
    }
}
