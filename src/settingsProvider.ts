import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SettingsProvider {
    private static _configPath: string | undefined;
    private static _testers: string[] = [];

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

        panel.webview.html = this._getHtmlForWebview(panel.webview, configPath);

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
                        // Update webview HTML with new data
                        panel.webview.html = this._getHtmlForWebview(panel.webview, selectedPath);
                        // Notify sidebar to refresh
                        vscode.commands.executeCommand('testCaseViewer.refresh');
                    }
                    return;
                case 'removeConfigFile':
                    context.workspaceState.update('configPath', undefined);
                    this._configPath = undefined;
                    this._testers = [];
                    // Update webview HTML with new data
                    panel.webview.html = this._getHtmlForWebview(panel.webview, '');
                    vscode.commands.executeCommand('testCaseViewer.refresh');
                    return;
                case 'synchronizeTags':
                    await this._synchronizeTags(context, panel);
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

    public static getConfigPath(): string | undefined {
        return this._configPath;
    }


    public static async initialize(context: vscode.ExtensionContext): Promise<void> {
        const configPath = context.workspaceState.get<string>('configPath');
        if (configPath) {
            this._configPath = configPath;
            await this._loadConfig(configPath);
        }
        
    }

    private static async _synchronizeTags(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Откройте рабочую папку для синхронизации тегов');
            panel.webview.postMessage({
                command: 'tagsSyncStatus',
                status: 'error',
                message: 'Откройте рабочую папку для синхронизации тегов'
            });
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const configPath = path.join(workspaceRoot, 'config.json');

        try {
            panel.webview.postMessage({
                command: 'tagsSyncStatus',
                status: 'progress',
                message: 'Сканирование файлов...'
            });

            // Scan all JSON and Markdown files in the repository
            const tags = new Set<string>();
            await this._scanJsonFilesForTags(workspaceRoot, tags);
            await this._scanMarkdownFilesForTags(workspaceRoot, tags);

            // Convert Set to sorted array
            const tagsArray = Array.from(tags).sort();

            // Read existing config or create new one
            let config: any = {};
            if (fs.existsSync(configPath)) {
                try {
                    const content = fs.readFileSync(configPath, 'utf8');
                    config = JSON.parse(content);
                } catch (error) {
                    vscode.window.showWarningMessage(`Ошибка при чтении config.json: ${error}. Будет создан новый файл.`);
                }
            }

            // Update TAGS in config
            config.TAGS = tagsArray;

            // Write config back
            const configContent = JSON.stringify(config, null, 4);
            fs.writeFileSync(configPath, configContent, 'utf8');

            vscode.window.showInformationMessage(`Синхронизация завершена. Найдено тегов: ${tagsArray.length}`);
            panel.webview.postMessage({
                command: 'tagsSyncStatus',
                status: 'success',
                message: `Синхронизация завершена. Найдено тегов: ${tagsArray.length}`,
                tagsCount: tagsArray.length
            });
        } catch (error) {
            const errorMessage = `Ошибка при синхронизации тегов: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
            panel.webview.postMessage({
                command: 'tagsSyncStatus',
                status: 'error',
                message: errorMessage
            });
        }
    }

    private static async _scanJsonFilesForTags(rootPath: string, tagsSet: Set<string>): Promise<void> {
        const files = fs.readdirSync(rootPath, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(rootPath, file.name);

            // Skip node_modules, .git, and other common directories
            if (file.isDirectory()) {
                if (file.name === 'node_modules' || file.name === '.git' || file.name === 'out' || file.name === '.vscode') {
                    continue;
                }
                await this._scanJsonFilesForTags(fullPath, tagsSet);
            } else if (file.isFile() && file.name.endsWith('.json')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const json = JSON.parse(content);

                    // Extract tags from the JSON object
                    if (json.tags) {
                        if (typeof json.tags === 'string') {
                            // If tags is a string, split by comma and trim
                            const tagList = json.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
                            tagList.forEach((tag: string) => tagsSet.add(tag));
                        } else if (Array.isArray(json.tags)) {
                            // If tags is an array
                            json.tags.forEach((tag: string) => {
                                if (typeof tag === 'string' && tag.trim().length > 0) {
                                    tagsSet.add(tag.trim());
                                }
                            });
                        }
                    }
                } catch (error) {
                    // Skip files that can't be parsed as JSON
                    continue;
                }
            }
        }
    }

    private static async _scanMarkdownFilesForTags(rootPath: string, tagsSet: Set<string>): Promise<void> {
        const files = fs.readdirSync(rootPath, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(rootPath, file.name);

            // Skip node_modules, .git, and other common directories
            if (file.isDirectory()) {
                if (file.name === 'node_modules' || file.name === '.git' || file.name === 'out' || file.name === '.vscode') {
                    continue;
                }
                await this._scanMarkdownFilesForTags(fullPath, tagsSet);
            } else if (file.isFile() && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const lines = content.split('\n');

                    let currentSection = '';
                    let inTagsSection = false;

                    // Find the "## Теги (tags)" section using similar logic to MarkdownTestCaseParser
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();

                        // Check for headers
                        if (line.startsWith('##')) {
                            const headerText = line.replace(/^##\s*/, '').trim();
                            currentSection = headerText;
                            
                            // Check if this is the tags section
                            if (headerText === 'Теги (tags)' || headerText === 'Теги') {
                                inTagsSection = true;
                                continue;
                            } else {
                                // If we were in tags section and hit another header, stop processing tags
                                if (inTagsSection) {
                                    break;
                                }
                                inTagsSection = false;
                                continue;
                            }
                        }

                        // Process lines in tags section
                        if (inTagsSection && line.length > 0) {
                            // Parse tags (comma-separated) - same logic as MarkdownTestCaseParser
                            const tags = line.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                            tags.forEach(tag => tagsSet.add(tag));
                        }
                    }
                } catch (error) {
                    // Skip files that can't be read
                    continue;
                }
            }
        }
    }

    public static getTags(): string[] {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const configPath = path.join(workspaceRoot, 'config.json');

        if (!fs.existsSync(configPath)) {
            return [];
        }

        try {
            const content = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(content);
            return config.TAGS || [];
        } catch (error) {
            return [];
        }
    }

    public static async addTag(tag: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const configPath = path.join(workspaceRoot, 'config.json');

        let config: any = {};
        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, 'utf8');
                config = JSON.parse(content);
            } catch (error) {
                // If config is invalid, create new one
            }
        }

        if (!config.TAGS) {
            config.TAGS = [];
        }

        // Add tag if it doesn't exist
        if (!config.TAGS.includes(tag)) {
            config.TAGS.push(tag);
            config.TAGS.sort();
        }

        // Write config back
        const configContent = JSON.stringify(config, null, 4);
        fs.writeFileSync(configPath, configContent, 'utf8');
    }

    // Дефолтные причины пропуска (зашиты в коде, нельзя удалять)
    private static readonly DEFAULT_SKIP_REASONS = [
        'Функционал не реализован (test_first)',
        'Принято решение не проверять.',
        'Автотесты.',
        'Нагрузочное тестирование.'
    ];

    public static getSkipReasons(): string[] {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [...this.DEFAULT_SKIP_REASONS];
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const configPath = path.join(workspaceRoot, 'config.json');

        if (!fs.existsSync(configPath)) {
            return [...this.DEFAULT_SKIP_REASONS];
        }

        try {
            const content = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(content);
            const customReasons = config.SKIP_REASON || [];
            
            // Объединяем дефолтные и пользовательские причины
            // Дефолтные всегда идут первыми
            const allReasons = [...this.DEFAULT_SKIP_REASONS];
            
            // Добавляем пользовательские причины, которых нет в дефолтных
            customReasons.forEach((reason: string) => {
                if (reason && !this.DEFAULT_SKIP_REASONS.includes(reason)) {
                    allReasons.push(reason);
                }
            });
            
            return allReasons;
        } catch (error) {
            return [...this.DEFAULT_SKIP_REASONS];
        }
    }

    public static async addSkipReason(reason: string): Promise<void> {
        if (!reason || reason.trim() === '') {
            return;
        }

        // Не добавляем дефолтные причины
        if (this.DEFAULT_SKIP_REASONS.includes(reason)) {
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const configPath = path.join(workspaceRoot, 'config.json');

        let config: any = {};
        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, 'utf8');
                config = JSON.parse(content);
            } catch (error) {
                // If config is invalid, create new one
            }
        }

        if (!config.SKIP_REASON) {
            config.SKIP_REASON = [];
        }

        // Add reason if it doesn't exist
        if (!config.SKIP_REASON.includes(reason)) {
            config.SKIP_REASON.push(reason);
            config.SKIP_REASON.sort();
        }

        // Write config back
        const configContent = JSON.stringify(config, null, 4);
        fs.writeFileSync(configPath, configContent, 'utf8');
    }

    private static _getHtmlForWebview(webview: vscode.Webview, configPath: string): string {
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
        <div class="setting-label">Теги</div>
        <div class="setting-description">
            Синхронизировать теги из всех JSON и Markdown файлов в репозитории и сохранить их в config.json
        </div>
        <div class="setting-controls">
            <button id="sync-tags-btn">Синхронизировать теги</button>
        </div>
        <div id="tags-sync-status" style="margin-top: 8px; font-size: 12px; color: var(--vscode-descriptionForeground); display: none;"></div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        const selectBtn = document.getElementById('select-config-btn');
        const removeBtn = document.getElementById('remove-config-btn');
        const syncTagsBtn = document.getElementById('sync-tags-btn');
        const tagsSyncStatus = document.getElementById('tags-sync-status');
        
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
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'tagsSyncStatus') {
                if (tagsSyncStatus) {
                    tagsSyncStatus.style.display = 'block';
                    if (message.status === 'progress') {
                        tagsSyncStatus.textContent = message.message || 'Синхронизация...';
                        tagsSyncStatus.style.color = 'var(--vscode-descriptionForeground)';
                    } else if (message.status === 'success') {
                        tagsSyncStatus.textContent = message.message || 'Синхронизация завершена';
                        tagsSyncStatus.style.color = 'var(--vscode-textLink-foreground)';
                    } else if (message.status === 'error') {
                        tagsSyncStatus.textContent = message.message || 'Ошибка синхронизации';
                        tagsSyncStatus.style.color = 'var(--vscode-errorForeground)';
                    }
                }
            }
        });
        
        if (syncTagsBtn) {
            syncTagsBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'synchronizeTags' });
            });
        }
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

