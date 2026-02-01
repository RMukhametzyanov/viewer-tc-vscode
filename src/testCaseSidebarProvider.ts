import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
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

        // Load saved chat state after a short delay to ensure webview is ready
        setTimeout(() => {
            this._loadChatState(webviewView.webview);
        }, 100);

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
                case 'sendChatMessage':
                    await this._sendChatMessage(webviewView.webview, message.message, message.model, message.history || []);
                    return;
                case 'executeFileAction':
                    await this._executeFileAction(message.action, message.data);
                    return;
                case 'createTestCaseFromJson':
                    await this._createTestCaseFromJson(message.testCaseJson);
                    return;
                case 'saveChatModel':
                    await this._saveChatModel(message.model);
                    return;
                case 'saveChatHistory':
                    await this._saveChatHistory(message.history);
                    return;
                case 'loadChatState':
                    await this._loadChatState(webviewView.webview);
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

    private async _sendChatMessage(webview: vscode.Webview, message: string, model: string, history: any[]): Promise<void> {
        const llmHost = SettingsProvider.getLlmHost();
        
        if (!llmHost || llmHost.trim() === '') {
            webview.postMessage({
                command: 'chatResponse',
                content: '',
                error: 'LLM хост не настроен. Укажите хост в настройках.',
                userMessage: message
            });
            return;
        }

        if (!model || model.trim() === '') {
            webview.postMessage({
                command: 'chatResponse',
                content: '',
                error: 'Модель не выбрана.',
                userMessage: message
            });
            return;
        }

        try {
            // Parse URL
            let url: URL;
            try {
                url = new URL(llmHost);
            } catch {
                url = new URL(llmHost.startsWith('http://') || llmHost.startsWith('https://') ? llmHost : `http://${llmHost}`);
            }

            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;

            // Get current file context
            const fileContext = this._getCurrentFileContext();

            // Build messages array from history and current message
            const messages: any[] = [];
            
            // Add system message for test case generation context
            let systemMessage = 'Ты помощник для создания и редактирования тест-кейсов. Помогай пользователю создавать качественные тест-кейсы, описывай шаги тестирования, ожидаемые результаты и предусловия.\n\n';
            systemMessage += 'ВАЖНО: Ты можешь работать с файлами напрямую! Если пользователь просит создать, изменить или обновить тест-кейс, ОБЯЗАТЕЛЬНО используй команды для работы с файлами.\n\n';
            systemMessage += 'Доступные команды (всегда используй JSON формат):\n';
            systemMessage += '1. Создать новый файл: {"action": "create_file", "fileName": "имя_файла.json", "content": {...полная структура тест-кейса...}}\n';
            systemMessage += '2. Обновить текущий открытый файл: {"action": "update_file", "content": {...полная обновленная структура тест-кейса...}}\n';
            systemMessage += '3. Создать новый файл на основе текущего: {"action": "create_file_from_current", "fileName": "имя_файла.json", "modifications": {...только измененные поля...}}\n\n';
            systemMessage += 'ФОРМАТ ОТВЕТА:\n';
            systemMessage += '1. Сначала напиши обычный текстовый ответ пользователю\n';
            systemMessage += '2. Затем, если нужно выполнить действие с файлом, добавь блок:\n';
            systemMessage += '<file_actions>\n';
            systemMessage += '[{"action": "...", ...}]\n';
            systemMessage += '</file_actions>\n\n';
            systemMessage += 'ПРИМЕРЫ:\n';
            systemMessage += '- Пользователь: "Создай тест-кейс для логина"\n';
            systemMessage += '- Твой ответ: "Создаю тест-кейс для проверки логина...\n<file_actions>\n[{"action": "create_file", "fileName": "login_test.json", "content": {...}}]\n</file_actions>"\n\n';
            systemMessage += '- Пользователь: "Добавь еще один шаг в текущий тест-кейс"\n';
            systemMessage += '- Твой ответ: "Добавляю шаг...\n<file_actions>\n[{"action": "update_file", "content": {...обновленный тест-кейс с новым шагом...}}]\n</file_actions>"\n';
            
            if (fileContext) {
                systemMessage += `\nТекущий открытый файл: ${fileContext.fileName}\n`;
                systemMessage += `Содержимое файла:\n${JSON.stringify(fileContext.content, null, 2)}\n`;
            }
            
            messages.push({
                role: 'system',
                content: systemMessage
            });
            
            // Add history
            if (history && Array.isArray(history)) {
                messages.push(...history);
            }
            
            // Add current user message
            messages.push({
                role: 'user',
                content: message
            });

            // Prepare request body (OpenAI-compatible format)
            const requestBody = JSON.stringify({
                model: model,
                messages: messages,
                stream: false
            });

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: '/v1/chat/completions',
                method: 'POST',
                timeout: 60000, // 60 second timeout
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                    'User-Agent': 'VSCode-TestCaseViewer'
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

                req.write(requestBody);
                req.end();
            });

            if (response.statusCode && response.statusCode === 200) {
                try {
                    const jsonData = JSON.parse(response.data);
                    
                    // Extract content from OpenAI-compatible response
                    let content = '';
                    if (jsonData.choices && jsonData.choices.length > 0) {
                        const choice = jsonData.choices[0];
                        if (choice.message && choice.message.content) {
                            content = choice.message.content;
                        }
                    }
                    
                    if (!content && jsonData.content) {
                        content = jsonData.content;
                    }
                    
                    if (!content) {
                        throw new Error('Неожиданный формат ответа от LLM');
                    }

                    // Extract file actions from response
                    const fileActions = this._extractFileActions(content);
                    const cleanContent = this._removeFileActionsBlock(content);

                    webview.postMessage({
                        command: 'chatResponse',
                        content: cleanContent,
                        error: undefined,
                        userMessage: message,
                        fileActions: fileActions
                    });
                } catch (parseError) {
                    webview.postMessage({
                        command: 'chatResponse',
                        content: '',
                        error: `Ошибка при разборе ответа: ${parseError}`,
                        userMessage: message
                    });
                }
            } else {
                const statusCode = response.statusCode || 0;
                webview.postMessage({
                    command: 'chatResponse',
                    content: '',
                    error: `LLM сервер вернул статус ${statusCode}: ${response.data}`,
                    userMessage: message
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            webview.postMessage({
                command: 'chatResponse',
                content: '',
                error: `Ошибка при отправке сообщения: ${errorMessage}`,
                userMessage: message
            });
        }
    }

    private _getCurrentFileContext(): { fileName: string; content: any } | null {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            return null;
        }

        try {
            const content = JSON.parse(activeEditor.document.getText());
            const fileName = activeEditor.document.fileName.split(/[/\\]/).pop() || 'unknown.json';
            
            // Check if it's a test case
            if (content.id && content.name && Array.isArray(content.steps)) {
                return {
                    fileName: fileName,
                    content: content
                };
            }
        } catch (error) {
            // Not a valid JSON or test case
        }

        return null;
    }

    private _extractFileActions(content: string): any[] {
        const actions: any[] = [];
        
        // Look for <file_actions>...</file_actions> block
        const startMarker = '<file_actions>';
        const endMarker = '</file_actions>';
        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);
        
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            const actionsBlock = content.substring(startIndex + startMarker.length, endIndex).trim();
            
            try {
                // Try to parse as JSON array
                const parsed = JSON.parse(actionsBlock);
                if (Array.isArray(parsed)) {
                    return parsed;
                } else if (typeof parsed === 'object') {
                    // Single action object
                    return [parsed];
                }
            } catch (e) {
                // Try to find JSON objects in the block
                const jsonMatch = actionsBlock.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        return Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e2) {
                        // Not valid JSON
                    }
                }
            }
        }
        
        return actions;
    }

    private _removeFileActionsBlock(content: string): string {
        const startMarker = '<file_actions>';
        const endMarker = '</file_actions>';
        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);
        
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            return content.substring(0, startIndex).trim() + content.substring(endIndex + endMarker.length).trim();
        }
        
        return content;
    }

    private async _executeFileAction(action: string, data: any): Promise<void> {
        try {
            switch (action) {
                case 'create_file':
                    await this._createFileFromAction(data.fileName, data.content);
                    break;
                case 'update_file':
                    await this._updateCurrentFile(data.content);
                    break;
                case 'create_file_from_current':
                    await this._createFileFromCurrent(data.fileName, data.modifications);
                    break;
                default:
                    vscode.window.showErrorMessage(`Неизвестное действие: ${action}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Ошибка при выполнении действия: ${errorMessage}`);
        }
    }

    private async _createFileFromAction(fileName: string, content: any): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Откройте рабочую папку для создания тест-кейса');
            return;
        }

        // Normalize test case
        const testCase = this._normalizeTestCase(content);
        
        // Clean file name
        let cleanFileName = fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
        if (!cleanFileName.endsWith('.json')) {
            cleanFileName += '.json';
        }

        // Determine file path
        let filePath: string;
        const activeEditor = vscode.window.activeTextEditor;
        
        if (activeEditor && activeEditor.document.uri.scheme === 'file') {
            const activeFilePath = activeEditor.document.uri.fsPath;
            const activeDir = path.dirname(activeFilePath);
            filePath = path.join(activeDir, cleanFileName);
        } else {
            filePath = path.join(workspaceFolders[0].uri.fsPath, cleanFileName);
        }

        // Check if file already exists
        if (fs.existsSync(filePath)) {
            const overwrite = await vscode.window.showWarningMessage(
                `Файл ${cleanFileName} уже существует. Перезаписать?`,
                'Да',
                'Нет'
            );
            if (overwrite !== 'Да') {
                return;
            }
        }

        // Write file
        const fileContent = JSON.stringify(testCase, null, 4);
        fs.writeFileSync(filePath, fileContent, 'utf8');
        
        // Open the new file
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(document);
        
        vscode.window.showInformationMessage(`Тест-кейс "${cleanFileName}" успешно создан`);
    }

    private async _updateCurrentFile(content: any): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            vscode.window.showErrorMessage('Откройте JSON файл с тест-кейсом для обновления');
            return;
        }

        try {
            // Normalize test case
            const testCase = this._normalizeTestCase(content);
            
            // Preserve original IDs and timestamps if they exist
            const originalContent = JSON.parse(activeEditor.document.getText());
            if (originalContent.id) {
                testCase.id = originalContent.id;
            }
            if (originalContent.createdAt) {
                testCase.createdAt = originalContent.createdAt;
            }
            testCase.updatedAt = Date.now();
            
            // Preserve step IDs if they match
            if (originalContent.steps && Array.isArray(originalContent.steps) && testCase.steps) {
                testCase.steps.forEach((newStep: any, index: number) => {
                    if (originalContent.steps[index] && originalContent.steps[index].id) {
                        newStep.id = originalContent.steps[index].id;
                    }
                });
            }

            // Format JSON
            const newContent = JSON.stringify(testCase, null, 4);
            
            // Update file
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                activeEditor.document.positionAt(0),
                activeEditor.document.positionAt(activeEditor.document.getText().length)
            );
            edit.replace(activeEditor.document.uri, fullRange, newContent);
            
            await vscode.workspace.applyEdit(edit);
            await activeEditor.document.save();
            
            vscode.window.showInformationMessage('Тест-кейс успешно обновлен');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Ошибка при обновлении файла: ${errorMessage}`);
        }
    }

    private async _createFileFromCurrent(fileName: string, modifications: any): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'json') {
            vscode.window.showErrorMessage('Откройте JSON файл с тест-кейсом');
            return;
        }

        try {
            const originalContent = JSON.parse(activeEditor.document.getText());
            
            // Apply modifications
            const newContent = { ...originalContent };
            Object.keys(modifications).forEach(key => {
                if (key === 'steps' && Array.isArray(modifications[key])) {
                    newContent.steps = modifications[key];
                } else {
                    newContent[key] = modifications[key];
                }
            });
            
            // Normalize
            const testCase = this._normalizeTestCase(newContent);
            
            // Generate new ID and update timestamps
            const generateUUID = () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            };
            
            testCase.id = generateUUID();
            testCase.createdAt = Date.now();
            testCase.updatedAt = Date.now();
            
            // Generate new IDs for steps
            testCase.steps.forEach((step: any) => {
                step.id = generateUUID();
            });

            // Create new file
            await this._createFileFromAction(fileName, testCase);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Ошибка при создании файла: ${errorMessage}`);
        }
    }

    private async _createTestCaseFromJson(testCaseJson: any): Promise<void> {
        // Get the workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Откройте рабочую папку для создания тест-кейса');
            return;
        }

        try {
            // Ensure test case has required structure
            const testCase = this._normalizeTestCase(testCaseJson);
            
            // Get file name from test case or ask user
            let fileName = testCase.name || 'Новый тест-кейс';
            // Clean file name (remove invalid characters)
            fileName = fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
            if (!fileName) {
                fileName = 'Новый тест-кейс';
            }

            // Determine file path
            let filePath: string;
            const activeEditor = vscode.window.activeTextEditor;
            
            if (activeEditor && activeEditor.document.uri.scheme === 'file') {
                // If there's an active file, create in the same directory
                const activeFilePath = activeEditor.document.uri.fsPath;
                const activeDir = path.dirname(activeFilePath);
                filePath = path.join(activeDir, `${fileName}.json`);
            } else {
                // Otherwise, create in the workspace root
                filePath = path.join(workspaceFolders[0].uri.fsPath, `${fileName}.json`);
            }

            // Check if file already exists
            if (fs.existsSync(filePath)) {
                const overwrite = await vscode.window.showWarningMessage(
                    `Файл ${fileName}.json уже существует. Перезаписать?`,
                    'Да',
                    'Нет'
                );
                if (overwrite !== 'Да') {
                    return;
                }
            }

            // Write file
            const content = JSON.stringify(testCase, null, 4);
            fs.writeFileSync(filePath, content, 'utf8');
            
            // Open the new file
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document);
            
            vscode.window.showInformationMessage(`Тест-кейс "${fileName}.json" успешно создан`);
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при создании тест-кейса: ${error}`);
        }
    }

    private _normalizeTestCase(testCaseJson: any): any {
        // Generate UUID function (same as in extension.ts)
        const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        const now = Date.now();
        
        // Ensure required fields exist
        const normalized: any = {
            id: testCaseJson.id || generateUUID(),
            name: testCaseJson.name || 'Новый тест-кейс',
            description: testCaseJson.description || '',
            preconditions: testCaseJson.preconditions || '',
            expectedResult: testCaseJson.expectedResult || '',
            epic: testCaseJson.epic || '',
            feature: testCaseJson.feature || '',
            story: testCaseJson.story || '',
            component: testCaseJson.component || '',
            testLayer: testCaseJson.testLayer || 'E2E',
            severity: testCaseJson.severity || 'NORMAL',
            priority: testCaseJson.priority || 'MEDIUM',
            environment: testCaseJson.environment || '',
            browser: testCaseJson.browser || '',
            owner: testCaseJson.owner || '',
            author: testCaseJson.author || '',
            reviewer: testCaseJson.reviewer || '',
            testCaseId: testCaseJson.testCaseId || '',
            issueLinks: testCaseJson.issueLinks || '',
            testCaseLinks: testCaseJson.testCaseLinks || '',
            tags: testCaseJson.tags || '',
            status: testCaseJson.status || 'Draft',
            testType: testCaseJson.testType || 'Manual',
            createdAt: testCaseJson.createdAt || now,
            updatedAt: testCaseJson.updatedAt || now,
            notes: testCaseJson.notes || {}
        };

        // Normalize steps
        if (testCaseJson.steps && Array.isArray(testCaseJson.steps) && testCaseJson.steps.length > 0) {
            normalized.steps = testCaseJson.steps.map((step: any, index: number) => ({
                id: step.id || generateUUID(),
                name: step.name || `Шаг ${index + 1}`,
                description: step.description || '',
                expectedResult: step.expectedResult || '',
                status: step.status || 'pending',
                bugLink: step.bugLink || '',
                skipReason: step.skipReason || '',
                attachments: step.attachments || ''
            }));
        } else {
            // If no steps, create at least one empty step
            normalized.steps = [{
                id: generateUUID(),
                name: 'Шаг 1',
                description: '',
                expectedResult: '',
                status: 'pending',
                bugLink: '',
                skipReason: '',
                attachments: ''
            }];
        }

        return normalized;
    }

    private async _saveChatModel(model: string): Promise<void> {
        if (this._context) {
            await this._context.workspaceState.update('chatModel', model);
        }
    }

    private async _saveChatHistory(history: any[]): Promise<void> {
        if (this._context) {
            await this._context.workspaceState.update('chatHistory', history);
        }
    }

    private async _loadChatState(webview: vscode.Webview): Promise<void> {
        if (!this._context) {
            return;
        }

        const savedModel = this._context.workspaceState.get<string>('chatModel', '');
        const savedHistory = this._context.workspaceState.get<any[]>('chatHistory', []);

        webview.postMessage({
            command: 'chatStateLoaded',
            model: savedModel,
            history: savedHistory
        });
    }
}
