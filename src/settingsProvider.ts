import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SettingsProvider {
    private static _configPath: string | undefined;
    private static _testers: string[] = [];
    private static _llmHost: string = '';

    public static async openSettings(context: vscode.ExtensionContext) {
        const panel = vscode.window.createWebviewPanel(
            'testCaseViewerSettings',
            'Test Case Viewer Settings',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        // Load saved config path
        const configPath = context.workspaceState.get<string>('configPath') || '';
        this._configPath = configPath;
        await this._loadConfig(configPath);

        // Load saved LLM host
        const llmHost = context.workspaceState.get<string>('llmHost') || '';
        this._llmHost = llmHost;

        panel.webview.html = this._getHtmlForWebview(panel.webview, configPath, llmHost);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'selectConfigFile':
                    const fileUri = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'JSON files': ['json']
                        },
                        openLabel: 'Select Config File'
                    });

                    if (fileUri && fileUri[0]) {
                        const selectedPath = fileUri[0].fsPath;
                        context.workspaceState.update('configPath', selectedPath);
                        this._configPath = selectedPath;
                        await this._loadConfig(selectedPath);
                        panel.webview.postMessage({
                            command: 'configPathUpdated',
                            path: selectedPath
                        });
                        // Notify sidebar to refresh
                        vscode.commands.executeCommand('testCaseViewer.refresh');
                    }
                    return;
                case 'removeConfigFile':
                    context.workspaceState.update('configPath', undefined);
                    this._configPath = undefined;
                    this._testers = [];
                    panel.webview.postMessage({
                        command: 'configPathUpdated',
                        path: ''
                    });
                    vscode.commands.executeCommand('testCaseViewer.refresh');
                    return;
                case 'updateLlmHost':
                    const host = message.host || '';
                    context.workspaceState.update('llmHost', host);
                    this._llmHost = host;
                    panel.webview.postMessage({
                        command: 'llmHostUpdated',
                        host: host
                    });
                    vscode.commands.executeCommand('testCaseViewer.refresh');
                    return;
            }
        });
    }

    private static async _loadConfig(configPath: string): Promise<void> {
        if (!configPath || !fs.existsSync(configPath)) {
            this._testers = [];
            return;
        }

        try {
            const content = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(content);
            this._testers = config.TESTERS || [];
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при чтении конфигурационного файла: ${error}`);
            this._testers = [];
        }
    }

    public static getTesters(): string[] {
        return [...this._testers];
    }

    public static getLlmHost(): string {
        return this._llmHost;
    }

    public static async initialize(context: vscode.ExtensionContext): Promise<void> {
        const configPath = context.workspaceState.get<string>('configPath');
        if (configPath) {
            this._configPath = configPath;
            await this._loadConfig(configPath);
        }
        
        const llmHost = context.workspaceState.get<string>('llmHost') || '';
        this._llmHost = llmHost;
    }

    private static _getHtmlForWebview(webview: vscode.Webview, configPath: string, llmHost: string): string {
        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Case Viewer Settings</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .setting-item {
            margin-bottom: 20px;
        }
        .setting-label {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
        .setting-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        .setting-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .config-path {
            flex: 1;
            padding: 6px 8px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: 13px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 14px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .testers-list {
            margin-top: 12px;
            padding: 12px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
        }
        .testers-list-title {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
        .testers-list-item {
            font-size: 13px;
            color: var(--vscode-foreground);
            padding: 4px 0;
        }
    </style>
</head>
<body>
    <h1>Настройки Test Case Viewer</h1>
    
    <div class="setting-item">
        <div class="setting-label">Конфигурационный файл</div>
        <div class="setting-description">
            Укажите путь к JSON файлу с конфигурацией. Файл должен содержать массив TESTERS с именами тестировщиков.
        </div>
        <div class="setting-controls">
            <input type="text" class="config-path" id="config-path" value="${this._escapeHtml(configPath)}" readonly />
            <button id="select-config-btn">Выбрать файл</button>
            ${configPath ? '<button class="secondary" id="remove-config-btn">Удалить</button>' : ''}
        </div>
        ${configPath && this._testers.length > 0 ? `
        <div class="testers-list">
            <div class="testers-list-title">Найденные тестировщики:</div>
            ${this._testers.map(tester => `<div class="testers-list-item">${this._escapeHtml(tester)}</div>`).join('')}
        </div>
        ` : ''}
    </div>
    
    <div class="setting-item">
        <div class="setting-label">LLM Хост</div>
        <div class="setting-description">
            Укажите адрес LLM сервера (например: http://localhost:8000)
        </div>
        <div class="setting-controls">
            <input type="text" class="config-path" id="llm-host" value="${this._escapeHtml(llmHost)}" placeholder="http://localhost:8000" />
            <button id="save-llm-host-btn">Сохранить</button>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        const selectBtn = document.getElementById('select-config-btn');
        const removeBtn = document.getElementById('remove-config-btn');
        const saveLlmHostBtn = document.getElementById('save-llm-host-btn');
        const llmHostInput = document.getElementById('llm-host');
        
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'selectConfigFile' });
            });
        }
        
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'removeConfigFile' });
            });
        }
        
        if (saveLlmHostBtn && llmHostInput) {
            saveLlmHostBtn.addEventListener('click', () => {
                const host = llmHostInput.value.trim();
                vscode.postMessage({ command: 'updateLlmHost', host: host });
            });
            
            llmHostInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const host = llmHostInput.value.trim();
                    vscode.postMessage({ command: 'updateLlmHost', host: host });
                }
            });
        }
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'configPathUpdated') {
                const pathInput = document.getElementById('config-path');
                if (pathInput) {
                    pathInput.value = message.path || '';
                }
                // Reload page to show updated testers list
                if (message.path) {
                    setTimeout(() => location.reload(), 100);
                } else {
                    location.reload();
                }
            }
            if (message.command === 'llmHostUpdated') {
                const hostInput = document.getElementById('llm-host');
                if (hostInput) {
                    hostInput.value = message.host || '';
                }
            }
        });
    </script>
</body>
</html>`;
    }

    private static _escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

