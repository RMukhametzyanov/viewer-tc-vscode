import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
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

interface TestCaseNode {
    type: 'folder' | 'testcase';
    name: string;  // Для папки - имя папки, для тест-кейса - name из JSON
    path: string;
    filePath?: string;  // Полный путь к файлу (только для testcase)
    relativePath?: string;
    data?: TestCase;  // JSON данные тест-кейса (только для testcase)
    children: TestCaseNode[];
}

export class TestCaseRunnerProvider {
    private _testCases: Map<string, TestCaseNode> = new Map();
    private _server: any = null;
    private _serverPort: number = 0;
    private _workspacePath: string = '';

    /**
     * Получить текущую Git ветку
     */
    private async getCurrentBranch(): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return 'unknown';
        }

        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension && gitExtension.isActive) {
                const git = gitExtension.exports.getAPI(1);
                const repository = git.getRepository(workspaceFolders[0].uri);
                if (repository) {
                    return repository.state.HEAD?.name || 'unknown';
                }
            }
        } catch (e) {
            // Fallback к команде git
        }

        // Fallback: выполнить git команду
        try {
            const { execSync } = require('child_process');
            const branch = execSync('git branch --show-current', { 
                cwd: workspaceFolders[0].uri.fsPath,
                encoding: 'utf8'
            }).trim();
            return branch || 'unknown';
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * Запуск локального HTTP сервера
     */
    private async startLocalServer(workspacePath: string): Promise<number> {
        // Если сервер уже запущен, возвращаем его порт
        if (this._server && this._serverPort > 0) {
            return this._serverPort;
        }

        this._workspacePath = workspacePath;
        const http = require('http');
        const url = require('url');

        return new Promise((resolve, reject) => {
            this._server = http.createServer((req: any, res: any) => {
                this.handleServerRequest(req, res);
            });

            // Слушаем на localhost, порт 0 = автоматический выбор свободного порта
            this._server.listen(0, 'localhost', () => {
                const address = this._server.address();
                if (address && typeof address === 'object') {
                    this._serverPort = address.port;
                    console.log(`Test Case Runner server started on http://localhost:${this._serverPort}`);
                    resolve(this._serverPort);
                } else {
                    reject(new Error('Failed to get server port'));
                }
            });

            this._server.on('error', (err: any) => {
                console.error('Server error:', err);
                reject(err);
            });
        });
    }

    /**
     * Обработка HTTP запросов от браузера
     */
    private handleServerRequest(req: any, res: any): void {
        // CORS headers для работы из браузера
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = require('url').parse(req.url, true);

        if (req.method === 'GET' && parsedUrl.pathname === '/api/status') {
            // Проверка статуса сервера
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                status: 'running',
                port: this._serverPort 
            }));
            return;
        }

        if (req.method === 'POST' && parsedUrl.pathname === '/api/addSkipReason') {
            // Обработка добавления пользовательской причины пропуска
            let body = '';
            req.on('data', (chunk: any) => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { reason } = data;

                    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing or invalid reason' }));
                        return;
                    }

                    // Добавляем причину через SettingsProvider
                    SettingsProvider.addSkipReason(reason.trim()).then(() => {
                        // Возвращаем обновленный список причин
                        const skipReasons = SettingsProvider.getSkipReasons();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: true, 
                            skipReasons: skipReasons 
                        }));
                    }).catch((error: any) => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: error.message }));
                    });
                } catch (error: any) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message }));
                }
            });
            return;
        }

        if (req.method === 'POST' && parsedUrl.pathname === '/api/update') {
            // Обработка сохранения файла
            let body = '';
            req.on('data', (chunk: any) => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { filePath, content } = data;

                    if (!filePath || !content) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing filePath or content' }));
                        return;
                    }

                    // Безопасность: проверяем, что путь относительный и не содержит ..
                    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
                    const fullPath = path.isAbsolute(safePath) 
                        ? safePath 
                        : path.join(this._workspacePath, safePath);

                    // Проверяем, что файл находится внутри workspace
                    if (!fullPath.startsWith(this._workspacePath)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Access denied: file outside workspace' }));
                        return;
                    }

                    // Обновляем updatedAt
                    if (content && typeof content === 'object') {
                        content.updatedAt = Date.now();
                    }

                    // Сохраняем файл
                    fs.writeFileSync(fullPath, JSON.stringify(content, null, 4), 'utf8');

                    // Обновляем данные в дереве
                    this._testCases.forEach(node => {
                        if (node.type === 'testcase' && node.filePath === fullPath) {
                            node.data = content;
                        }
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'File saved successfully' }));
                } catch (error: any) {
                    console.error('Error saving file:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message || String(error) }));
                }
            });
            return;
        }

        if (req.method === 'POST' && parsedUrl.pathname === '/api/addSkipReason') {
            // Обработка добавления пользовательской причины пропуска
            let body = '';
            req.on('data', (chunk: any) => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { reason } = data;

                    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing or invalid reason' }));
                        return;
                    }

                    // Добавляем причину через SettingsProvider
                    SettingsProvider.addSkipReason(reason.trim()).then(() => {
                        // Возвращаем обновленный список причин
                        const skipReasons = SettingsProvider.getSkipReasons();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: true, 
                            skipReasons: skipReasons 
                        }));
                    }).catch((error: any) => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: error.message }));
                    });
                } catch (error: any) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message }));
                }
            });
            return;
        }

        // Если запрос не обработан
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Not found' }));
    }

    /**
     * Остановка локального сервера (публичный метод для вызова из extension.ts)
     */
    public stopLocalServer(): void {
        if (this._server) {
            this._server.close(() => {
                console.log('Test Case Runner server stopped');
            });
            this._server = null;
            this._serverPort = 0;
            this._workspacePath = '';
        }
    }

    /**
     * Сканировать репозиторий и построить дерево тест-кейсов
     */
    private async scanTestCases(): Promise<Map<string, TestCaseNode>> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return new Map();
        }

        const files = await vscode.workspace.findFiles('**/*.json');
        const tree = new Map<string, TestCaseNode>();
        const rootNode: TestCaseNode = {
            type: 'folder',
            name: 'Root',
            path: '',
            children: []
        };
        tree.set('', rootNode);

        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const json = JSON.parse(content.toString());

                // Проверяем, что это тест-кейс
                if (json.id && json.name && Array.isArray(json.steps)) {
                    const relativePath = vscode.workspace.asRelativePath(file);
                    const pathParts = relativePath.split(/[/\\]/);
                    
                    // Строим дерево по папкам
                    let currentPath = '';
                    let currentNode = rootNode;
                    
                    // Проходим по всем папкам в пути
                    for (let i = 0; i < pathParts.length - 1; i++) {
                        const folder = pathParts[i];
                        const folderPath = currentPath ? `${currentPath}/${folder}` : folder;
                        
                        // Ищем существующую папку среди детей
                        let folderNode = currentNode.children.find(
                            child => child.type === 'folder' && child.name === folder
                        );
                        
                        if (!folderNode) {
                            // Создаем новую папку
                            folderNode = {
                                type: 'folder',
                                name: folder,
                                path: folderPath,
                                children: []
                            };
                            currentNode.children.push(folderNode);
                            tree.set(folderPath, folderNode);
                        }
                        
                        currentNode = folderNode;
                        currentPath = folderPath;
                    }
                    
                    // Добавляем тест-кейс с именем из JSON
                    const testCaseNode: TestCaseNode = {
                        type: 'testcase',
                        name: json.name || path.basename(file.fsPath, '.json'),  // Используем name из JSON
                        path: relativePath,
                        filePath: file.fsPath,
                        relativePath: relativePath,
                        data: json as TestCase,
                        children: []
                    };
                    
                    currentNode.children.push(testCaseNode);
                }
            } catch (e) {
                // Пропустить невалидные JSON
                console.log(`Skipping file ${file.fsPath}: ${e}`);
            }
        }

        // Сортируем дерево: сначала папки, потом тест-кейсы
        const sortNode = (node: TestCaseNode) => {
            node.children.sort((a, b) => {
                if (a.type === 'folder' && b.type === 'testcase') return -1;
                if (a.type === 'testcase' && b.type === 'folder') return 1;
                return a.name.localeCompare(b.name);
            });
            node.children.forEach(child => {
                if (child.type === 'folder') {
                    sortNode(child);
                }
            });
        };
        sortNode(rootNode);

        this._testCases = tree;
        return tree;
    }

    /**
     * Экранирование HTML
     */
    private escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Рендеринг дерева в HTML
     */
    private renderTreeHtml(nodes: TestCaseNode[], level: number = 0): string {
        return nodes.map(node => {
            if (node.type === 'folder') {
                const indent = level * 5; // Отступ 5px на каждый уровень
                return `
                    <div class="tree-folder" style="padding-left: ${indent}px;">
                        <div class="tree-folder-header" data-path="${this.escapeHtml(node.path)}">
                            <span class="tree-folder-icon">📁</span>
                            <span class="tree-folder-name">${this.escapeHtml(node.name)}</span>
                            <span class="tree-folder-toggle">▼</span>
                        </div>
                        <div class="tree-folder-children" data-path="${this.escapeHtml(node.path)}">
                            ${this.renderTreeHtml(node.children, level + 1)}
                        </div>
                    </div>
                `;
            } else {
                const indent = level * 5; // Отступ 5px на каждый уровень
                const isSelected = false; // Выбор определяется в браузере через JavaScript
                const author = node.data?.author || '';
                const owner = node.data?.owner || '';
                const reviewer = node.data?.reviewer || '';
                const testType = node.data?.testType || '';
                const status = node.data?.status || '';
                const epic = node.data?.epic || '';
                const feature = node.data?.feature || '';
                const story = node.data?.story || '';
                const tags = node.data?.tags || '';
                return `
                    <div class="tree-testcase ${isSelected ? 'selected' : ''}" 
                         style="padding-left: ${indent}px;"
                         data-file-path="${this.escapeHtml(node.filePath || '')}"
                         data-author="${this.escapeHtml(author)}"
                         data-owner="${this.escapeHtml(owner)}"
                         data-reviewer="${this.escapeHtml(reviewer)}"
                         data-test-type="${this.escapeHtml(testType)}"
                         data-status="${this.escapeHtml(status)}"
                         data-epic="${this.escapeHtml(epic)}"
                         data-feature="${this.escapeHtml(feature)}"
                         data-story="${this.escapeHtml(story)}"
                         data-tags="${this.escapeHtml(tags)}">
                        <span class="tree-testcase-icon">📄</span>
                        <span class="tree-testcase-name" title="${this.escapeHtml(node.name)}">${this.escapeHtml(node.name)}</span>
                    </div>
                `;
            }
        }).join('');
    }

    /**
     * Генерация HTML для раннера
     */

    /**
     * Генерация автономного HTML файла для браузера
     */
    private generateStandaloneHtml(testCases: Map<string, TestCaseNode>, branch: string, serverPort: number): string {
        const rootNode = testCases.get('');
        if (!rootNode) {
            return '<html><body>Тест-кейсы не найдены</body></html>';
        }

        // Собираем все данные тест-кейсов в JSON
        // Используем относительные пути как ключи для удобства
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : '';
        
        const testCasesData: any = {};
        const filePathMap: any = {}; // Маппинг относительных путей к полным
        
        const collectTestCases = (node: TestCaseNode) => {
            if (node.type === 'testcase' && node.filePath && node.data) {
                const relativePath = node.relativePath || path.relative(workspacePath, node.filePath);
                testCasesData[relativePath] = node.data;
                filePathMap[relativePath] = node.filePath; // Сохраняем полный путь для скачивания
            }
            node.children.forEach(child => collectTestCases(child));
        };
        collectTestCases(rootNode);
        
        // При первой генерации проверяем bugLink и выставляем статус failed если bugLink заполнен
        Object.values(testCasesData).forEach((testCase: any) => {
            if (testCase.steps && Array.isArray(testCase.steps)) {
                testCase.steps.forEach((step: any) => {
                    if (step.bugLink && step.bugLink.trim() !== '' && step.status !== 'failed') {
                        step.status = 'failed';
                    }
                });
            }
        });

        const treeHtml = rootNode ? this.renderTreeHtml(rootNode.children) : '<div>Тест-кейсы не найдены</div>';
        
        // Получаем теги и тестеров из конфига
        const configTags = SettingsProvider.getTags();
        const testers = SettingsProvider.getTesters();
        const skipReasons = SettingsProvider.getSkipReasons();

        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Case Runner</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f5f5f5;
            --bg-tertiary: #fafafa;
            --text-primary: #333;
            --text-secondary: #666;
            --border-color: #e0e0e0;
            --accent-color: #0066cc;
            --accent-hover: #0052a3;
            --selected-bg: #0066cc;
            --selected-text: #ffffff;
            --hover-bg: #e8e8e8;
        }
        
        body.dark-theme {
            --bg-primary: #1e1e1e;
            --bg-secondary: #252526;
            --bg-tertiary: #2d2d30;
            --text-primary: #cccccc;
            --text-secondary: #858585;
            --border-color: #3e3e42;
            --accent-color: #007acc;
            --accent-hover: #005a9e;
            --selected-bg: #007acc;
            --selected-text: #ffffff;
            --hover-bg: #2a2d2e;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: var(--text-primary);
            background-color: var(--bg-primary);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
            transition: background-color 0.3s, color 0.3s;
        }
        
        .runner-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            background-color: var(--bg-secondary);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }
        
        .runner-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
        }
        
        .runner-branch {
            font-size: 12px;
            color: var(--text-secondary);
        }
        
        .theme-toggle {
            margin-left: 12px;
            padding: 4px 8px;
            background-color: var(--accent-color);
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .theme-toggle:hover {
            background-color: var(--accent-hover);
        }
        
        .filter-section {
            padding: 6px 10px;
            border-bottom: 1px solid var(--border-color);
            background-color: var(--bg-secondary);
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
            max-height: 80px;
            overflow-y: auto;
        }
        
        .filter-group {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
        }
        
        .filter-label {
            font-size: 10px;
            color: var(--text-secondary);
            white-space: nowrap;
        }
        
        .filter-select {
            padding: 2px 5px;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 2px;
            font-size: 10px;
            cursor: pointer;
            min-width: 80px;
            max-width: 120px;
        }
        
        .filter-reset-btn {
            padding: 4px 10px;
            background-color: var(--accent-color);
            color: white;
            border: none;
            border-radius: 2px;
            font-size: 10px;
            cursor: pointer;
            font-weight: 500;
            margin-left: auto;
            flex-shrink: 0;
        }
        
        .filter-reset-btn:hover {
            background-color: var(--accent-hover);
        }
        
        .runner-content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        
        .runner-tree {
            width: 300px;
            min-width: 200px;
            max-width: 600px;
            border-right: 1px solid var(--border-color);
            background-color: var(--bg-tertiary);
            overflow-y: auto;
            overflow-x: hidden;
            flex-shrink: 0;
            padding: 4px;
            position: relative;
        }
        
        .tree-resizer {
            position: absolute;
            top: 0;
            right: 0;
            width: 4px;
            height: 100%;
            cursor: col-resize;
            background-color: transparent;
            z-index: 10;
        }
        
        .tree-resizer:hover {
            background-color: var(--accent-color);
        }
        
        .tree-resizer.resizing {
            background-color: var(--accent-color);
        }
        
        .runner-main {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            background-color: var(--bg-primary);
        }
        
        .status-buttons {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        
        .status-btn {
            padding: 4px 8px;
            border: 1px solid var(--border-color);
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 500;
            transition: all 0.2s;
            background-color: var(--bg-secondary);
            color: var(--text-primary);
        }
        
        .status-btn:hover {
            opacity: 0.8;
            transform: translateY(-1px);
        }
        
        .status-btn.active {
            border-width: 2px;
            font-weight: 600;
        }
        
        .status-btn.pending {
            background-color: #ffc107;
            color: #000;
            border-color: #ffc107;
        }
        
        .status-btn.passed {
            background-color: #28a745;
            color: #fff;
            border-color: #28a745;
        }
        
        .status-btn.failed {
            background-color: #dc3545;
            color: #fff;
            border-color: #dc3545;
        }
        
        .status-btn.skipped {
            background-color: #ff9800;
            color: #fff;
            border-color: #ff9800;
        }
        
        .status-btn-icon {
            width: 24px;
            height: 24px;
            padding: 0;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            background-color: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        }
        
        .status-btn-icon svg {
            width: 18px;
            height: 18px;
            display: block;
        }
        
        .status-btn-icon:hover {
            opacity: 0.8;
            transform: scale(1.1);
        }
        
        /* Неактивное состояние - только цветной контур */
        .status-btn-icon.passed {
            background-color: transparent;
        }
        
        .status-btn-icon.failed {
            background-color: transparent;
        }
        
        .status-btn-icon.skipped {
            background-color: transparent;
        }
        
        /* Активное состояние - цветной фон с белым контуром иконки */
        .status-btn-icon.passed.active {
            background-color: #28a745;
        }
        
        .status-btn-icon.failed.active {
            background-color: #dc3545;
        }
        
        .status-btn-icon.skipped.active {
            background-color: #9e9e9e;
        }
        
        .test-case-meta {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 16px;
            padding: 12px;
            background-color: var(--bg-secondary);
            border-radius: 4px;
        }
        
        .meta-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .meta-label {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
        }
        
        .meta-value {
            font-size: 13px;
            color: var(--text-primary);
            font-weight: 500;
        }
        
        .tree-folder {
            user-select: none;
        }
        
        .tree-folder.hidden {
            display: none;
        }
        
        .tree-folder-header {
            display: flex;
            align-items: center;
            padding: 2px 4px;
            cursor: pointer;
            transition: background-color 0.2s;
            border-radius: 3px;
        }
        
        .tree-folder-header:hover {
            background-color: var(--hover-bg);
        }
        
        .tree-folder-icon {
            margin-right: 4px;
            font-size: 12px;
        }
        
        .tree-folder-name {
            flex: 1;
            font-size: 12px;
            color: var(--text-primary);
            font-weight: 500;
        }
        
        .tree-folder-toggle {
            font-size: 10px;
            color: var(--text-secondary);
            transition: transform 0.2s;
        }
        
        .tree-folder-header.collapsed .tree-folder-toggle {
            transform: rotate(-90deg);
        }
        
        .tree-folder-children {
            display: block;
        }
        
        .tree-folder-children.collapsed {
            display: none;
        }
        
        .tree-testcase {
            display: flex;
            align-items: center;
            padding: 2px 4px;
            cursor: pointer;
            transition: background-color 0.2s;
            user-select: none;
            border-radius: 3px;
        }
        
        .tree-testcase:hover {
            background-color: var(--hover-bg);
        }
        
        .tree-testcase.selected {
            background-color: var(--selected-bg);
            color: var(--selected-text);
        }
        
        .tree-testcase.hidden {
            display: none;
        }
        
        .tree-testcase-icon {
            margin-right: 4px;
            font-size: 12px;
        }
        
        .tree-testcase-name {
            flex: 1;
            font-size: 12px;
            color: inherit;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .context-menu {
            position: fixed;
            background-color: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 3px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            min-width: 150px;
            padding: 4px 0;
            display: none;
        }
        
        .context-menu.visible {
            display: block;
        }
        
        .context-menu-item {
            padding: 6px 12px;
            font-size: 12px;
            color: var(--text-primary);
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .context-menu-item:hover {
            background-color: var(--hover-bg);
        }
        
        .empty-content {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-secondary);
            font-size: 14px;
        }
        
        .download-section {
            padding: 12px 16px;
            border-top: 1px solid var(--border-color);
            background-color: var(--bg-secondary);
            display: flex;
            gap: 8px;
            flex-shrink: 0;
        }
        
        .download-btn {
            padding: 6px 12px;
            background-color: var(--accent-color);
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        
        .download-btn:hover {
            background-color: var(--accent-hover);
        }
        
        .download-btn:disabled {
            background-color: var(--text-secondary);
            cursor: not-allowed;
            opacity: 0.5;
        }
        
        textarea, input, select {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
        }
        
        textarea:focus, input:focus, select:focus {
            outline: 1px solid var(--accent-color);
            outline-offset: -1px;
        }
        
        .step-buglink:invalid {
            border-color: #dc3545;
        }
        
        .step-buglink:invalid:focus {
            outline-color: #dc3545;
        }
        
        .step-buglink-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }
        
        .step-buglink-clear {
            position: absolute;
            right: 6px;
            width: 18px;
            height: 18px;
            padding: 0;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            line-height: 1;
            transition: color 0.2s;
        }
        
        .step-buglink-clear:hover {
            color: var(--text-primary);
        }
        
        .step-buglink {
            padding-right: 28px;
        }
        
        .step-header-runner {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .step-number-runner {
            font-size: 12px;
            font-weight: 600;
            color: #4a9eff;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .step-status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
        }
        
        .step-status-badge.skipped {
            background-color: rgba(204, 153, 0, 0.2);
            color: #cc9900;
        }
        
        .step-status-badge.passed {
            background-color: rgba(0, 122, 204, 0.2);
            color: #007acc;
        }
        
        .step-status-badge.failed {
            background-color: rgba(204, 0, 0, 0.2);
            color: #cc0000;
        }
        
        .step-reason {
            margin-top: 8px;
            font-size: 11px;
            color: var(--text-secondary);
            font-style: italic;
        }
        
        .step-reason-editable {
            margin-top: 8px;
            font-size: 11px;
            color: var(--text-secondary);
            font-style: italic;
        }
        
        .step-reason-editable input {
            width: 100%;
            padding: 4px 6px;
            border: 1px solid transparent;
            border-radius: 2px;
            background-color: transparent;
            color: var(--text-secondary);
            font-size: 11px;
            font-style: italic;
            font-family: inherit;
        }
        
        .step-reason-editable input:hover {
            border-color: var(--border-color);
        }
        
        .step-reason-editable input:focus {
            border-color: var(--accent-color);
            outline: none;
            background-color: var(--bg-primary);
        }
        
        .step-reason-editable input.required-field {
            border: 2px solid #dc3545;
            border-radius: 2px;
            background-color: var(--bg-primary);
        }
        
        .step-reason-editable input.required-field:focus {
            border-color: #dc3545;
            outline: 1px solid #dc3545;
            outline-offset: -1px;
        }
        
        .step-reason-editable input.required-field:valid {
            border-color: var(--border-color);
        }
        
        .step-expected-box {
            border: 1px solid #4a9eff;
            border-radius: 2px;
            padding: 8px;
            margin-top: 6px;
            background-color: var(--bg-primary);
        }
        
        .step-expected-label {
            font-weight: 600;
            font-size: 11px;
            color: var(--text-primary);
            margin-bottom: 4px;
        }
        
        .viewer-header {
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .viewer-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 6px;
            background: transparent;
            border: none;
            padding: 0;
            width: 100%;
            font-family: inherit;
        }
        
        .viewer-title:focus {
            outline: 1px solid var(--accent-color);
            outline-offset: 1px;
            border-radius: 2px;
        }
        
        .viewer-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: 8px;
        }
        
        .viewer-meta-item {
            display: flex;
            align-items: center;
            gap: 3px;
        }
        
        .viewer-meta-label {
            color: var(--text-secondary);
            opacity: 0.7;
        }
        
        .viewer-meta-select {
            background: transparent;
            border: none;
            color: var(--text-primary);
            font-size: 11px;
            padding: 0;
            margin: 0;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
        }
        
        .viewer-meta-select:hover {
            opacity: 0.8;
        }
        
        .viewer-meta-select:focus {
            outline: 1px solid var(--accent-color);
            outline-offset: 1px;
            border-radius: 2px;
        }
        
        .viewer-section-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 6px;
            margin-top: 12px;
        }
        
        .viewer-section-title:first-of-type {
            margin-top: 0;
        }
        
        .viewer-description {
            margin-bottom: 12px;
            padding: 10px;
            background-color: var(--bg-secondary);
            border-radius: 3px;
            font-size: 12px;
            color: var(--text-primary);
            white-space: pre-wrap;
            line-height: 1.5;
            border: 1px solid var(--border-color);
            width: 100%;
            min-height: 60px;
            resize: vertical;
            font-family: inherit;
            box-sizing: border-box;
        }
        
        .viewer-description:focus {
            outline: 1px solid var(--accent-color);
            outline-offset: -1px;
        }
    </style>
</head>
<body>
    <div class="runner-header">
        <div class="runner-title">Test Case Runner</div>
        <div style="display: flex; align-items: center; gap: 12px;">
            <div class="runner-branch" id="branch-info">Ветка: ${this.escapeHtml(branch)}</div>
            <button class="theme-toggle" id="theme-toggle">🌙 Темная тема</button>
        </div>
    </div>
    <div class="filter-section">
        <div class="filter-group">
            <span class="filter-label">Автор:</span>
            <select class="filter-select" id="filter-author">
                <option value="">Все</option>
            </select>
        </div>
        <div class="filter-group">
            <span class="filter-label">Владелец:</span>
            <select class="filter-select" id="filter-owner">
                <option value="">Все</option>
            </select>
        </div>
        <div class="filter-group">
            <span class="filter-label">Ревьювер:</span>
            <select class="filter-select" id="filter-reviewer">
                <option value="">Все</option>
            </select>
        </div>
        <div class="filter-group">
            <span class="filter-label">Тип теста:</span>
            <select class="filter-select" id="filter-test-type">
                <option value="">Все</option>
            </select>
        </div>
        <div class="filter-group">
            <span class="filter-label">Статус:</span>
            <select class="filter-select" id="filter-status">
                <option value="">Все</option>
            </select>
        </div>
        <div class="filter-group">
            <span class="filter-label">Эпик:</span>
            <select class="filter-select" id="filter-epic">
                <option value="">Все</option>
            </select>
        </div>
        <div class="filter-group">
            <span class="filter-label">Фича:</span>
            <select class="filter-select" id="filter-feature">
                <option value="">Все</option>
            </select>
        </div>
        <div class="filter-group">
            <span class="filter-label">Стори:</span>
            <select class="filter-select" id="filter-story">
                <option value="">Все</option>
            </select>
        </div>
        <div class="filter-group">
            <span class="filter-label">Теги:</span>
            <select class="filter-select" id="filter-tags">
                <option value="">Все</option>
            </select>
        </div>
        <button class="filter-reset-btn" id="filter-reset-btn">Сбросить фильтры</button>
    </div>
    <div class="runner-content">
        <div class="runner-tree" id="test-case-tree">
            ${treeHtml}
            <div class="tree-resizer" id="tree-resizer"></div>
        </div>
        <div class="runner-main" id="test-case-content">
            <div class="empty-content">Выберите тест-кейс из дерева</div>
        </div>
    </div>
    <div class="download-section">
        <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
            <span id="server-status" style="font-size: 12px; color: var(--text-secondary);">Сервер: проверка...</span>
        </div>
        <button class="download-btn" id="save-all-btn">Сохранить все изменения</button>
        <button class="download-btn" id="save-selected-btn" disabled>Сохранить выбранный</button>
    </div>
    <div class="context-menu" id="context-menu">
        <div class="context-menu-item" id="context-menu-all-passed">Все пройдено</div>
    </div>
    <script>
        (function() {
            // Настройки сервера
            const SERVER_PORT = ${serverPort};
            const SERVER_URL = 'http://localhost:' + SERVER_PORT;
            
            // Данные тест-кейсов
            const testCasesData = ${JSON.stringify(testCasesData)};
            const filePathMap = ${JSON.stringify(filePathMap || {})};
            const configTags = ${JSON.stringify(configTags || [])};
            const testers = ${JSON.stringify(testers || [])};
            const skipReasons = ${JSON.stringify(skipReasons || [])};
            let currentFilePath = null;
            let modifiedFiles = new Set();
            
            // Проверка статуса сервера
            function checkServerStatus() {
                fetch(SERVER_URL + '/api/status')
                    .then(response => response.json())
                    .then(data => {
                        const statusEl = document.getElementById('server-status');
                        if (data.success) {
                            statusEl.textContent = 'Сервер: подключен (порт ' + SERVER_PORT + ')';
                            statusEl.style.color = '#28a745';
                        } else {
                            statusEl.textContent = 'Сервер: недоступен';
                            statusEl.style.color = '#dc3545';
                        }
                    })
                    .catch(error => {
                        const statusEl = document.getElementById('server-status');
                        statusEl.textContent = 'Сервер: недоступен';
                        statusEl.style.color = '#dc3545';
                    });
            }
            
            // Проверяем статус при загрузке и периодически
            checkServerStatus();
            setInterval(checkServerStatus, 5000);
            
            // Переключение темы
            const themeToggle = document.getElementById('theme-toggle');
            const isDarkTheme = localStorage.getItem('testCaseRunnerTheme') === 'dark';
            if (isDarkTheme) {
                document.body.classList.add('dark-theme');
                themeToggle.textContent = '☀️ Светлая тема';
            }
            
            themeToggle.addEventListener('click', function() {
                document.body.classList.toggle('dark-theme');
                const isDark = document.body.classList.contains('dark-theme');
                localStorage.setItem('testCaseRunnerTheme', isDark ? 'dark' : 'light');
                themeToggle.textContent = isDark ? '☀️ Светлая тема' : '🌙 Темная тема';
            });
            
            // Инициализация фильтров
            const authors = new Set();
            const owners = new Set();
            const reviewers = new Set();
            const testTypes = new Set();
            const statuses = new Set();
            const epics = new Set();
            const features = new Set();
            const stories = new Set();
            const tagsSet = new Set();
            
            Object.values(testCasesData).forEach(tc => {
                if (tc.author) authors.add(tc.author);
                if (tc.owner) owners.add(tc.owner);
                if (tc.reviewer) reviewers.add(tc.reviewer);
                if (tc.testType) testTypes.add(tc.testType);
                if (tc.status) statuses.add(tc.status);
                if (tc.epic) epics.add(tc.epic);
                if (tc.feature) features.add(tc.feature);
                if (tc.story) stories.add(tc.story);
                // Теги могут быть строкой с разделителями или массивом
                if (tc.tags) {
                    if (typeof tc.tags === 'string') {
                        tc.tags.split(',').forEach(tag => {
                            const trimmedTag = tag.trim();
                            if (trimmedTag) tagsSet.add(trimmedTag);
                        });
                    } else if (Array.isArray(tc.tags)) {
                        tc.tags.forEach(tag => {
                            if (tag) tagsSet.add(tag);
                        });
                    }
                }
            });
            
            // Добавляем теги из конфига
            if (configTags && Array.isArray(configTags)) {
                configTags.forEach(tag => {
                    if (tag) tagsSet.add(tag);
                });
            }
            
            const authorSelect = document.getElementById('filter-author');
            const ownerSelect = document.getElementById('filter-owner');
            const reviewerSelect = document.getElementById('filter-reviewer');
            const testTypeSelect = document.getElementById('filter-test-type');
            const statusSelect = document.getElementById('filter-status');
            const epicSelect = document.getElementById('filter-epic');
            const featureSelect = document.getElementById('filter-feature');
            const storySelect = document.getElementById('filter-story');
            const tagsSelect = document.getElementById('filter-tags');
            
            // Заполнение выпадающих списков
            Array.from(authors).sort().forEach(author => {
                const option = document.createElement('option');
                option.value = author;
                option.textContent = author;
                authorSelect.appendChild(option);
            });
            
            Array.from(owners).sort().forEach(owner => {
                const option = document.createElement('option');
                option.value = owner;
                option.textContent = owner;
                ownerSelect.appendChild(option);
            });
            
            Array.from(reviewers).sort().forEach(reviewer => {
                const option = document.createElement('option');
                option.value = reviewer;
                option.textContent = reviewer;
                reviewerSelect.appendChild(option);
            });
            
            Array.from(testTypes).sort().forEach(testType => {
                const option = document.createElement('option');
                option.value = testType;
                option.textContent = testType;
                testTypeSelect.appendChild(option);
            });
            
            Array.from(statuses).sort().forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                statusSelect.appendChild(option);
            });
            
            Array.from(epics).sort().forEach(epic => {
                const option = document.createElement('option');
                option.value = epic;
                option.textContent = epic;
                epicSelect.appendChild(option);
            });
            
            Array.from(features).sort().forEach(feature => {
                const option = document.createElement('option');
                option.value = feature;
                option.textContent = feature;
                featureSelect.appendChild(option);
            });
            
            Array.from(stories).sort().forEach(story => {
                const option = document.createElement('option');
                option.value = story;
                option.textContent = story;
                storySelect.appendChild(option);
            });
            
            Array.from(tagsSet).sort().forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagsSelect.appendChild(option);
            });
            
            // Функция фильтрации дерева
            function filterTree() {
                const selectedAuthor = authorSelect.value;
                const selectedOwner = ownerSelect.value;
                const selectedReviewer = reviewerSelect.value;
                const selectedTestType = testTypeSelect.value;
                const selectedStatus = statusSelect.value;
                const selectedEpic = epicSelect.value;
                const selectedFeature = featureSelect.value;
                const selectedStory = storySelect.value;
                const selectedTag = tagsSelect.value;
                
                // Проверяем, есть ли активные фильтры
                const hasActiveFilters = selectedAuthor || selectedOwner || selectedReviewer || 
                                       selectedTestType || selectedStatus || selectedEpic || 
                                       selectedFeature || selectedStory || selectedTag;
                
                // Если фильтров нет, показываем все элементы
                if (!hasActiveFilters) {
                    document.querySelectorAll('.tree-testcase, .tree-folder').forEach(el => {
                        el.classList.remove('hidden');
                    });
                    return;
                }
                
                // Сначала фильтруем тест-кейсы
                document.querySelectorAll('.tree-testcase').forEach(testCaseEl => {
                    const author = testCaseEl.getAttribute('data-author') || '';
                    const owner = testCaseEl.getAttribute('data-owner') || '';
                    const reviewer = testCaseEl.getAttribute('data-reviewer') || '';
                    const testType = testCaseEl.getAttribute('data-test-type') || '';
                    const status = testCaseEl.getAttribute('data-status') || '';
                    const epic = testCaseEl.getAttribute('data-epic') || '';
                    const feature = testCaseEl.getAttribute('data-feature') || '';
                    const story = testCaseEl.getAttribute('data-story') || '';
                    const tags = testCaseEl.getAttribute('data-tags') || '';
                    
                    const matchAuthor = !selectedAuthor || author === selectedAuthor;
                    const matchOwner = !selectedOwner || owner === selectedOwner;
                    const matchReviewer = !selectedReviewer || reviewer === selectedReviewer;
                    const matchTestType = !selectedTestType || testType === selectedTestType;
                    const matchStatus = !selectedStatus || status === selectedStatus;
                    const matchEpic = !selectedEpic || epic === selectedEpic;
                    const matchFeature = !selectedFeature || feature === selectedFeature;
                    const matchStory = !selectedStory || story === selectedStory;
                    // Для тегов проверяем, содержит ли строка выбранный тег
                    const matchTags = !selectedTag || (tags && tags.split(',').some(t => t.trim() === selectedTag));
                    
                    if (matchAuthor && matchOwner && matchReviewer && matchTestType && 
                        matchStatus && matchEpic && matchFeature && matchStory && matchTags) {
                        testCaseEl.classList.remove('hidden');
                    } else {
                        testCaseEl.classList.add('hidden');
                    }
                });
                
                // Затем скрываем папки, в которых нет видимых элементов
                // Используем несколько проходов, пока не перестанут скрываться папки
                // Это гарантирует, что все пустые папки будут скрыты, включая родительские
                let changed = true;
                let iterations = 0;
                const maxIterations = 20; // Защита от бесконечного цикла
                
                while (changed && iterations < maxIterations) {
                    changed = false;
                    iterations++;
                    
                    // Получаем все папки (включая скрытые, чтобы они могли быть показаны обратно)
                    const allFolders = Array.from(document.querySelectorAll('.tree-folder'));
                    
                    allFolders.forEach(folderEl => {
                        const childrenContainer = folderEl.querySelector('.tree-folder-children');
                        if (!childrenContainer) return;
                        
                        // Проверяем, есть ли видимые дочерние элементы (папки или тест-кейсы)
                        const visibleChildren = Array.from(childrenContainer.children).filter(child => {
                            return !child.classList.contains('hidden') && 
                                   (child.classList.contains('tree-testcase') || child.classList.contains('tree-folder'));
                        });
                        
                        if (visibleChildren.length === 0) {
                            // Скрываем папку, если она еще не скрыта
                            if (!folderEl.classList.contains('hidden')) {
                                folderEl.classList.add('hidden');
                                changed = true;
                            }
                        } else {
                            // Показываем папку, если она была скрыта
                            if (folderEl.classList.contains('hidden')) {
                                folderEl.classList.remove('hidden');
                                changed = true;
                            }
                        }
                    });
                }
            }
            
            // Добавляем обработчики для всех фильтров
            authorSelect.addEventListener('change', filterTree);
            ownerSelect.addEventListener('change', filterTree);
            reviewerSelect.addEventListener('change', filterTree);
            testTypeSelect.addEventListener('change', filterTree);
            statusSelect.addEventListener('change', filterTree);
            epicSelect.addEventListener('change', filterTree);
            featureSelect.addEventListener('change', filterTree);
            storySelect.addEventListener('change', filterTree);
            tagsSelect.addEventListener('change', filterTree);
            
            // Кнопка сброса фильтров
            const resetBtn = document.getElementById('filter-reset-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', function() {
                    // Сбрасываем все фильтры в значение "Все" (пустое значение)
                    authorSelect.value = '';
                    ownerSelect.value = '';
                    reviewerSelect.value = '';
                    testTypeSelect.value = '';
                    statusSelect.value = '';
                    epicSelect.value = '';
                    featureSelect.value = '';
                    storySelect.value = '';
                    tagsSelect.value = '';
                    
                    // Применяем фильтрацию (которая покажет все элементы)
                    filterTree();
                });
            }
            
            // Изменение ширины боковой панели
            const treePanel = document.getElementById('test-case-tree');
            const resizer = document.getElementById('tree-resizer');
            let isResizing = false;
            let startX = 0;
            let startWidth = 0;
            
            if (resizer && treePanel) {
                resizer.addEventListener('mousedown', function(e) {
                    isResizing = true;
                    startX = e.clientX;
                    startWidth = treePanel.offsetWidth;
                    resizer.classList.add('resizing');
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                    e.preventDefault();
                });
                
                document.addEventListener('mousemove', function(e) {
                    if (!isResizing) return;
                    
                    const diff = e.clientX - startX;
                    const newWidth = startWidth + diff;
                    const minWidth = 200;
                    const maxWidth = 600;
                    
                    if (newWidth >= minWidth && newWidth <= maxWidth) {
                        treePanel.style.width = newWidth + 'px';
                    }
                });
                
                document.addEventListener('mouseup', function() {
                    if (isResizing) {
                        isResizing = false;
                        resizer.classList.remove('resizing');
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';
                        
                        // Сохраняем ширину в localStorage
                        localStorage.setItem('testCaseRunnerTreeWidth', treePanel.style.width);
                    }
                });
                
                // Восстанавливаем сохраненную ширину
                const savedWidth = localStorage.getItem('testCaseRunnerTreeWidth');
                if (savedWidth) {
                    treePanel.style.width = savedWidth;
                }
            }
            
            // Обработка клика на папку
            document.addEventListener('click', function(e) {
                const folderHeader = e.target.closest('.tree-folder-header');
                if (folderHeader) {
                    const path = folderHeader.getAttribute('data-path');
                    const children = document.querySelector(\`.tree-folder-children[data-path="\${path}"]\`);
                    if (children) {
                        const isCollapsed = children.classList.contains('collapsed');
                        if (isCollapsed) {
                            children.classList.remove('collapsed');
                            folderHeader.classList.remove('collapsed');
                        } else {
                            children.classList.add('collapsed');
                            folderHeader.classList.add('collapsed');
                        }
                    }
                }
            });
            
            // Обработка клика на тест-кейс
            document.addEventListener('click', async function(e) {
                const testCase = e.target.closest('.tree-testcase');
                if (testCase) {
                    const fullPath = testCase.getAttribute('data-file-path');
                    // Находим относительный путь
                    let relativePath = null;
                    for (const [relPath, fullPathValue] of Object.entries(filePathMap)) {
                        if (fullPathValue === fullPath) {
                            relativePath = relPath;
                            break;
                        }
                    }
                    // Если не нашли, пробуем использовать полный путь как ключ
                    if (!relativePath && testCasesData[fullPath]) {
                        relativePath = fullPath;
                    }
                    
                    if (relativePath && testCasesData[relativePath]) {
                        // Если есть текущий открытый файл, проверяем валидацию и сохраняем
                        if (currentFilePath && currentFilePath !== relativePath) {
                            const currentContent = testCasesData[currentFilePath];
                            if (currentContent) {
                                // Валидация обязательных полей
                                const validation = validateFailedSteps(currentContent);
                                if (!validation.valid) {
                                    showNotification(validation.message, 'error');
                                    return; // Не переключаемся, если валидация не прошла
                                }
                                
                                // Если есть изменения, сохраняем автоматически
                                if (modifiedFiles.has(currentFilePath)) {
                                    currentContent.updatedAt = Date.now();
                                    const success = await saveFile(currentFilePath, currentContent);
                                    if (success) {
                                        modifiedFiles.delete(currentFilePath);
                                        showNotification('Файл автоматически сохранен: ' + currentFilePath, 'success');
                                    } else {
                                        showNotification('Ошибка при автосохранении. Переключение отменено.', 'error');
                                        return; // Не переключаемся, если не удалось сохранить
                                    }
                                }
                            }
                        }
                        
                        // Убираем выделение со всех
                        document.querySelectorAll('.tree-testcase').forEach(tc => {
                            tc.classList.remove('selected');
                        });
                        // Выделяем текущий
                        testCase.classList.add('selected');
                        
                        currentFilePath = relativePath;
                        const saveSelectedBtn = document.getElementById('save-selected-btn');
                        if (saveSelectedBtn) {
                            saveSelectedBtn.disabled = modifiedFiles.has(relativePath) ? false : true;
                        }
                        const saveAllBtn = document.getElementById('save-all-btn');
                        if (saveAllBtn) {
                            saveAllBtn.disabled = modifiedFiles.size === 0;
                        }
                        
                        // Загружаем содержимое
                        loadTestCaseContent(testCasesData[relativePath], relativePath);
                    }
                }
                
                // Скрываем контекстное меню при клике вне его
                const contextMenu = document.getElementById('context-menu');
                if (contextMenu && !contextMenu.contains(e.target)) {
                    contextMenu.classList.remove('visible');
                }
            });
            
            // Обработка правого клика на тест-кейс (контекстное меню)
            let contextMenuTargetPath = null;
            document.addEventListener('contextmenu', function(e) {
                const testCase = e.target.closest('.tree-testcase');
                if (testCase) {
                    e.preventDefault();
                    const fullPath = testCase.getAttribute('data-file-path');
                    // Находим относительный путь
                    let relativePath = null;
                    for (const [relPath, fullPathValue] of Object.entries(filePathMap)) {
                        if (fullPathValue === fullPath) {
                            relativePath = relPath;
                            break;
                        }
                    }
                    if (!relativePath && testCasesData[fullPath]) {
                        relativePath = fullPath;
                    }
                    
                    if (relativePath && testCasesData[relativePath]) {
                        contextMenuTargetPath = relativePath;
                        const contextMenu = document.getElementById('context-menu');
                        if (contextMenu) {
                            contextMenu.style.left = e.pageX + 'px';
                            contextMenu.style.top = e.pageY + 'px';
                            contextMenu.classList.add('visible');
                        }
                    }
                } else {
                    // Скрываем меню при правом клике вне тест-кейса
                    const contextMenu = document.getElementById('context-menu');
                    if (contextMenu) {
                        contextMenu.classList.remove('visible');
                    }
                }
            });
            
            // Обработчик пункта "Все пройдено"
            const allPassedMenuItem = document.getElementById('context-menu-all-passed');
            if (allPassedMenuItem) {
                allPassedMenuItem.addEventListener('click', function() {
                    if (contextMenuTargetPath && testCasesData[contextMenuTargetPath]) {
                        const testCase = testCasesData[contextMenuTargetPath];
                        if (testCase.steps && Array.isArray(testCase.steps)) {
                            // Устанавливаем статус "passed" для всех шагов
                            testCase.steps.forEach(step => {
                                step.status = 'passed';
                            });
                            
                            // Помечаем файл как измененный
                            if (contextMenuTargetPath) {
                                modifiedFiles.add(contextMenuTargetPath);
                                document.getElementById('save-selected-btn').disabled = false;
                                document.getElementById('save-all-btn').disabled = false;
                            }
                            
                            // Если этот тест-кейс сейчас открыт, обновляем его отображение
                            if (currentFilePath === contextMenuTargetPath) {
                                loadTestCaseContent(testCase, contextMenuTargetPath);
                            }
                            
                            // Скрываем меню
                            const contextMenu = document.getElementById('context-menu');
                            if (contextMenu) {
                                contextMenu.classList.remove('visible');
                            }
                            
                            showNotification('Все шаги помечены как пройденные', 'success');
                        }
                    }
                });
            }
            
            // Функция загрузки содержимого тест-кейса
            function loadTestCaseContent(testCase, relativePath) {
                const contentDiv = document.getElementById('test-case-content');
                if (!contentDiv) return;
                
                // Рендеринг тест-кейса как в плагине
                const testersOptions = testers && testers.length > 0 ? testers.map(t => 
                    \`<option value="\${escapeHtml(t)}" \${testCase.owner === t ? 'selected' : ''}>\${escapeHtml(t)}</option>\`
                ).join('') : '';
                
                const authorOptions = testers && testers.length > 0 ? testers.map(t => 
                    \`<option value="\${escapeHtml(t)}" \${testCase.author === t ? 'selected' : ''}>\${escapeHtml(t)}</option>\`
                ).join('') : '';
                
                const reviewerOptions = testers && testers.length > 0 ? testers.map(t => 
                    \`<option value="\${escapeHtml(t)}" \${testCase.reviewer === t ? 'selected' : ''}>\${escapeHtml(t)}</option>\`
                ).join('') : '';
                
                let html = \`
                    <div>
                        <div class="viewer-header">
                            <input 
                                type="text" 
                                class="viewer-title" 
                                id="test-case-name" 
                                value="\${escapeHtml(testCase.name || '')}"
                                data-field="name"
                            />
                            <div class="viewer-meta">
                                <div class="viewer-meta-item">
                                    <span class="viewer-meta-label">ID:</span>
                                    <span>\${escapeHtml(testCase.id || '')}</span>
                                </div>
                                <div class="viewer-meta-item">
                                    <span class="viewer-meta-label">Статус:</span>
                                    <select 
                                        class="viewer-meta-select" 
                                        id="test-case-status" 
                                        data-field="status"
                                    >
                                        <option value="Draft" \${testCase.status === 'Draft' ? 'selected' : ''}>Draft</option>
                                        <option value="Design" \${testCase.status === 'Design' ? 'selected' : ''}>Design</option>
                                        <option value="Review" \${testCase.status === 'Review' ? 'selected' : ''}>Review</option>
                                        <option value="Done" \${testCase.status === 'Done' ? 'selected' : ''}>Done</option>
                                    </select>
                                </div>
                                <div class="viewer-meta-item">
                                    <span class="viewer-meta-label">Тип:</span>
                                    <select 
                                        class="viewer-meta-select" 
                                        id="test-case-type" 
                                        data-field="testType"
                                    >
                                        <option value="Manual" \${testCase.testType === 'Manual' || testCase.testType === 'manual' ? 'selected' : ''}>Manual</option>
                                        <option value="Hybrid" \${testCase.testType === 'Hybrid' || testCase.testType === 'hybrid' ? 'selected' : ''}>Hybrid</option>
                                        <option value="Automated" \${testCase.testType === 'Automated' || testCase.testType === 'automated' ? 'selected' : ''}>Automated</option>
                                    </select>
                                </div>
                                <div class="viewer-meta-item">
                                    <span class="viewer-meta-label">Владелец:</span>
                                    \${testers && testers.length > 0 ? \`
                                    <select 
                                        class="viewer-meta-select" 
                                        id="test-case-owner" 
                                        data-field="owner"
                                    >
                                        <option value="">-- Выберите --</option>
                                        \${testersOptions}
                                    </select>
                                    \` : \`
                                    <span>\${escapeHtml(testCase.owner || '')}</span>
                                    \`}
                                </div>
                                <div class="viewer-meta-item">
                                    <span class="viewer-meta-label">Автор:</span>
                                    \${testers && testers.length > 0 ? \`
                                    <select 
                                        class="viewer-meta-select" 
                                        id="test-case-author" 
                                        data-field="author"
                                    >
                                        <option value="">-- Выберите --</option>
                                        \${authorOptions}
                                    </select>
                                    \` : \`
                                    <span>\${escapeHtml(testCase.author || '')}</span>
                                    \`}
                                </div>
                                <div class="viewer-meta-item">
                                    <span class="viewer-meta-label">Ревьювер:</span>
                                    \${testers && testers.length > 0 ? \`
                                    <select 
                                        class="viewer-meta-select" 
                                        id="test-case-reviewer" 
                                        data-field="reviewer"
                                    >
                                        <option value="">-- Выберите --</option>
                                        \${reviewerOptions}
                                    </select>
                                    \` : \`
                                    <span>\${escapeHtml(testCase.reviewer || '')}</span>
                                    \`}
                                </div>
                            </div>
                        </div>
                        
                        <div class="viewer-section-title">Описание</div>
                        <textarea 
                            class="viewer-description" 
                            id="test-case-description" 
                            data-field="description"
                            placeholder="Описание тест-кейса"
                        >\${escapeHtml(testCase.description || '')}</textarea>
                        
                        <div class="viewer-section-title">Шаги тестирования</div>
                        <div id="test-steps"></div>
                    </div>
                \`;
                
                contentDiv.innerHTML = html;
                
                // Рендерим шаги
                const stepsDiv = document.getElementById('test-steps');
                if (stepsDiv && testCase.steps) {
                    // При первой генерации проверяем bugLink и выставляем статус failed если bugLink заполнен
                    testCase.steps.forEach(step => {
                        if (step.bugLink && step.bugLink.trim() !== '' && step.status !== 'failed') {
                            step.status = 'failed';
                        }
                    });
                    
                    // Функция для генерации SVG иконки
                    function getStatusIcon(type, isActive) {
                        // Для неактивных иконок: fill="none", stroke цветной (зеленый/красный/серый) - только контур
                        // Для активных иконок: fill="none", stroke белый - белый контур на цветном фоне кнопки
                        const fillColor = 'none';
                        let strokeColor;
                        if (isActive) {
                            strokeColor = '#ffffff'; // Белый контур для активных
                        } else {
                            // Цветной контур для неактивных
                            strokeColor = type === 'passed' ? '#28a745' : type === 'failed' ? '#dc3545' : '#9e9e9e';
                        }
                        const strokeWidth = '2';
                        
                        if (type === 'passed') {
                            return \`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="\${fillColor}" stroke="\${strokeColor}" stroke-width="\${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>\`;
                        } else if (type === 'failed') {
                            return \`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="\${fillColor}" stroke="\${strokeColor}" stroke-width="\${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>\`;
                        } else if (type === 'skipped') {
                            return \`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="\${fillColor}" stroke="\${strokeColor}" stroke-width="\${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>\`;
                        }
                        return '';
                    }
                    
                    stepsDiv.innerHTML = testCase.steps.map((step, index) => {
                        const status = step.status || 'pending';
                        return \`
                        <div style="margin-bottom: 10px; padding: 8px; background-color: var(--bg-secondary); border-radius: 3px; border-left: 2px solid var(--accent-color);">
                            <div class="step-header-runner">
                                <div class="step-number-runner">
                                    ШАГ \${index + 1}
                                </div>
                                <div class="status-buttons" style="display: flex; gap: 4px; align-items: center;">
                                    <button class="status-btn-icon passed \${status === 'passed' ? 'active' : ''}" data-step-id="\${step.id}" data-status="passed" title="Passed">\${getStatusIcon('passed', status === 'passed')}</button>
                                    <button class="status-btn-icon failed \${status === 'failed' ? 'active' : ''}" data-step-id="\${step.id}" data-status="failed" title="Failed">\${getStatusIcon('failed', status === 'failed')}</button>
                                    <button class="status-btn-icon skipped \${status === 'skipped' ? 'active' : ''}" data-step-id="\${step.id}" data-status="skipped" title="Skipped">\${getStatusIcon('skipped', status === 'skipped')}</button>
                                </div>
                            </div>
                            <textarea 
                                class="step-description auto-resize" 
                                data-step-id="\${step.id}" 
                                style="width: 100%; min-height: 45px; padding: 6px; border: 1px solid var(--border-color); border-radius: 2px; font-family: inherit; font-size: 11px; margin-bottom: 8px; background-color: var(--bg-primary); color: var(--text-primary); resize: none; overflow: hidden;"
                                placeholder="Описание шага"
                            >\${escapeHtml(step.description || '')}</textarea>
                            <div class="step-expected-box">
                                <div class="step-expected-label">ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:</div>
                                <textarea 
                                    class="step-expected auto-resize" 
                                    data-step-id="\${step.id}" 
                                    style="width: 100%; min-height: 45px; padding: 6px; border: none; border-radius: 0; font-family: inherit; font-size: 11px; background-color: transparent; color: var(--text-primary); resize: none; overflow: hidden;"
                                    placeholder="Ожидаемый результат"
                                >\${escapeHtml(step.expectedResult || '')}</textarea>
                            </div>
                            \${status === 'failed' ? \`
                            <div class="step-reason-editable">
                                Причина провала: <input type="text" class="step-buglink required-field" data-step-id="\${step.id}" value="\${escapeHtml(step.bugLink || '')}" placeholder="Укажите причину неудачного выполнения шага" required style="width: calc(100% - 120px); padding: 4px 6px; font-size: 11px; font-family: inherit; font-style: italic; margin-left: 4px; color: var(--text-primary);" />
                            </div>
                            \` : ''}
                            \${status === 'skipped' ? \`
                            <div class="step-reason-editable">
                                Причина пропуска: 
                                <input 
                                    type="text" 
                                    class="step-skip-reason-input required-field" 
                                    data-step-id="\${step.id}" 
                                    list="skip-reasons-\${step.id}"
                                    value="\${escapeHtml(step.skipReason || '')}" 
                                    placeholder="Выберите причину или введите свою" 
                                    required
                                    style="width: calc(100% - 120px); padding: 4px 6px; font-size: 11px; font-family: inherit; font-style: italic; margin-left: 4px; color: var(--text-primary);" 
                                />
                                <datalist id="skip-reasons-\${step.id}">
                                    \${skipReasons.map(reason => \`
                                        <option value="\${escapeHtml(reason)}">\${escapeHtml(reason)}</option>
                                    \`).join('')}
                                </datalist>
                            </div>
                            \` : ''}
                        </div>
                    \`;
                    }).join('');
                    
                    // Функция для автоматического изменения высоты textarea
                    function autoResizeTextarea(textarea) {
                        // Сбрасываем высоту, чтобы получить правильный scrollHeight
                        textarea.style.height = 'auto';
                        // Устанавливаем высоту на основе содержимого
                        textarea.style.height = textarea.scrollHeight + 'px';
                    }
                    
                    // Применяем автоизменение высоты ко всем textarea при загрузке
                    document.querySelectorAll('.auto-resize').forEach(textarea => {
                        autoResizeTextarea(textarea);
                    });
                    
                    // Добавляем обработчики изменений для textarea
                    document.querySelectorAll('.step-description, .step-expected').forEach(el => {
                        // Автоматическое изменение высоты при вводе
                        el.addEventListener('input', function() {
                            autoResizeTextarea(this);
                        });
                        
                        // Сохранение изменений
                        el.addEventListener('change', function() {
                            const stepId = this.getAttribute('data-step-id');
                            const field = this.classList.contains('step-description') ? 'description' : 'expectedResult';
                            const value = this.value;
                            
                            const step = testCase.steps.find(s => s.id === stepId);
                            if (step) {
                                step[field] = value;
                                if (currentFilePath) {
                                    modifiedFiles.add(currentFilePath);
                                    document.getElementById('save-selected-btn').disabled = false;
                                    document.getElementById('save-all-btn').disabled = false;
                                }
                            }
                        });
                    });
                    
                    // Обработчики кнопок статусов шагов
                    document.querySelectorAll('.status-btn-icon[data-step-id]').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const stepId = this.getAttribute('data-step-id');
                            const newStatus = this.getAttribute('data-status');
                            
                            const step = testCase.steps.find(s => s.id === stepId);
                            if (step) {
                                step.status = newStatus;
                                
                                // Обновляем все кнопки статусов для этого шага
                                const stepButtons = document.querySelectorAll(\`.status-btn-icon[data-step-id="\${stepId}"]\`);
                                stepButtons.forEach(b => {
                                    b.classList.remove('active');
                                    const buttonStatus = b.getAttribute('data-status');
                                    const isActive = buttonStatus === newStatus;
                                    // Обновляем SVG иконку
                                    b.innerHTML = getStatusIcon(buttonStatus, isActive);
                                    if (isActive) {
                                        b.classList.add('active');
                                    }
                                });
                                
                                // Находим карточку шага
                                const stepCard = this.closest('div[style*="margin-bottom: 10px"]');
                                if (stepCard) {
                                    // Находим оба контейнера (для failed и skipped)
                                    const allReasonContainers = stepCard.querySelectorAll('.step-reason-editable');
                                    let bugLinkContainer = null;
                                    let skipReasonContainer = null;
                                    
                                    allReasonContainers.forEach(container => {
                                        if (container.querySelector('.step-buglink')) {
                                            bugLinkContainer = container;
                                        }
                                        if (container.querySelector('.step-skip-reason-input')) {
                                            skipReasonContainer = container;
                                        }
                                    });
                                    
                                    if (newStatus === 'failed') {
                                        // Очищаем skipReason при переключении на failed
                                        step.skipReason = '';
                                        
                                        // Скрываем контейнер причины пропуска
                                        if (skipReasonContainer) {
                                            skipReasonContainer.style.display = 'none';
                                        }
                                        
                                        // Сохраняем оригинальное значение bugLink из файла (если есть)
                                        const originalBugLink = step.bugLink || '';
                                        
                                        // Показываем поле причины провала
                                        if (!bugLinkContainer) {
                                            // Создаем контейнер для причины провала
                                            const expectedBox = stepCard.querySelector('.step-expected-box');
                                            if (expectedBox) {
                                                bugLinkContainer = document.createElement('div');
                                                bugLinkContainer.className = 'step-reason-editable';
                                                bugLinkContainer.innerHTML = \`
                                                    Причина провала: <input type="text" class="step-buglink required-field" data-step-id="\${stepId}" value="\${escapeHtml(originalBugLink)}" placeholder="Укажите причину неудачного выполнения шага" required style="width: calc(100% - 120px); padding: 4px 6px; font-size: 11px; font-family: inherit; font-style: italic; margin-left: 4px; color: var(--text-primary);" />
                                                \`;
                                                expectedBox.parentNode.insertBefore(bugLinkContainer, expectedBox.nextSibling);
                                                
                                                // Добавляем обработчик для нового поля
                                                const newBugLinkInput = bugLinkContainer.querySelector('.step-buglink');
                                                if (newBugLinkInput) {
                                                    newBugLinkInput.addEventListener('change', function() {
                                                        step.bugLink = this.value;
                                                        if (currentFilePath) {
                                                            modifiedFiles.add(currentFilePath);
                                                            document.getElementById('save-selected-btn').disabled = false;
                                                            document.getElementById('save-all-btn').disabled = false;
                                                        }
                                                    });
                                                    
                                                    // Устанавливаем фокус только если поле пустое
                                                    if (!originalBugLink) {
                                                        setTimeout(() => {
                                                            newBugLinkInput.focus();
                                                        }, 100);
                                                    }
                                                }
                                            }
                                        } else {
                                            // Поле уже существует - используем значение из step, не очищаем
                                            bugLinkContainer.style.display = 'block';
                                            const bugInput = bugLinkContainer.querySelector('.step-buglink');
                                            if (bugInput) {
                                                // Синхронизируем значение из step с полем ввода
                                                bugInput.value = originalBugLink || '';
                                                // Устанавливаем фокус только если поле пустое
                                                if (!originalBugLink) {
                                                    setTimeout(() => {
                                                        bugInput.focus();
                                                    }, 100);
                                                }
                                            }
                                        }
                                        // Сохраняем значение bugLink (не очищаем, если оно было)
                                        if (!step.bugLink && originalBugLink) {
                                            step.bugLink = originalBugLink;
                                        }
                                    } else if (newStatus === 'skipped') {
                                        // Очищаем bugLink при переключении на skipped
                                        step.bugLink = '';
                                        
                                        // Скрываем контейнер причины провала
                                        if (bugLinkContainer) {
                                            bugLinkContainer.style.display = 'none';
                                        }
                                        
                                        // Сохраняем оригинальное значение skipReason из файла (если есть)
                                        const originalSkipReason = step.skipReason || '';
                                        
                                        // Показываем поле причины пропуска
                                        if (!skipReasonContainer) {
                                            // Создаем контейнер для причины пропуска
                                            const expectedBox = stepCard.querySelector('.step-expected-box');
                                            if (expectedBox) {
                                                skipReasonContainer = document.createElement('div');
                                                skipReasonContainer.className = 'step-reason-editable';
                                                const datalistId = 'skip-reasons-' + stepId;
                                                skipReasonContainer.innerHTML = \`
                                                    Причина пропуска: 
                                                    <input 
                                                        type="text" 
                                                        class="step-skip-reason-input required-field" 
                                                        data-step-id="\${stepId}" 
                                                        list="\${datalistId}"
                                                        value="\${escapeHtml(originalSkipReason)}" 
                                                        placeholder="Выберите причину или введите свою" 
                                                        required
                                                        style="width: calc(100% - 120px); padding: 4px 6px; font-size: 11px; font-family: inherit; font-style: italic; margin-left: 4px; color: var(--text-primary);" 
                                                    />
                                                    <datalist id="\${datalistId}">
                                                        \${skipReasons.map(reason => \`
                                                            <option value="\${escapeHtml(reason)}">\${escapeHtml(reason)}</option>
                                                        \`).join('')}
                                                    </datalist>
                                                \`;
                                                expectedBox.parentNode.insertBefore(skipReasonContainer, expectedBox.nextSibling);
                                                
                                                // Добавляем обработчики для нового поля
                                                setupSkipReasonHandlers(skipReasonContainer, stepId);
                                                
                                                // Устанавливаем фокус только если поле пустое
                                                const newSkipInput = skipReasonContainer.querySelector('.step-skip-reason-input');
                                                if (newSkipInput && !originalSkipReason) {
                                                    setTimeout(() => {
                                                        newSkipInput.focus();
                                                    }, 100);
                                                }
                                            }
                                        } else {
                                            // Поле уже существует - используем значение из step, не очищаем
                                            skipReasonContainer.style.display = 'block';
                                            const skipInput = skipReasonContainer.querySelector('.step-skip-reason-input');
                                            if (skipInput) {
                                                // Синхронизируем значение из step с полем ввода
                                                skipInput.value = originalSkipReason || '';
                                                // Устанавливаем фокус только если поле пустое
                                                if (!originalSkipReason) {
                                                    setTimeout(() => {
                                                        skipInput.focus();
                                                    }, 100);
                                                }
                                            }
                                        }
                                        // Сохраняем значение skipReason (не очищаем, если оно было)
                                        if (!step.skipReason && originalSkipReason) {
                                            step.skipReason = originalSkipReason;
                                        }
                                    } else {
                                        // Скрываем оба поля при выборе другого статуса
                                        if (bugLinkContainer) {
                                            bugLinkContainer.style.display = 'none';
                                        }
                                        if (skipReasonContainer) {
                                            skipReasonContainer.style.display = 'none';
                                        }
                                        // Очищаем оба поля
                                        step.bugLink = '';
                                        step.skipReason = '';
                                    }
                                }
                                
                                if (currentFilePath) {
                                    modifiedFiles.add(currentFilePath);
                                    document.getElementById('save-selected-btn').disabled = false;
                                    document.getElementById('save-all-btn').disabled = false;
                                }
                            }
                        });
                    });
                    
                    // Обработчики для полей bugLink (если они уже есть в DOM)
                    document.querySelectorAll('.step-buglink').forEach(input => {
                        input.addEventListener('change', function() {
                            const stepId = this.getAttribute('data-step-id');
                            const step = testCase.steps.find(s => s.id === stepId);
                            if (step) {
                                step.bugLink = this.value;
                                if (currentFilePath) {
                                    modifiedFiles.add(currentFilePath);
                                    document.getElementById('save-selected-btn').disabled = false;
                                    document.getElementById('save-all-btn').disabled = false;
                                }
                            }
                        });
                    });
                    
                    // Функция для настройки обработчиков причины пропуска
                    function setupSkipReasonHandlers(container, stepId) {
                        const input = container.querySelector('.step-skip-reason-input');
                        const datalist = container.querySelector('datalist');
                        const step = testCase.steps.find(s => s.id === stepId);
                        
                        if (input) {
                            input.addEventListener('change', async function() {
                                const reason = this.value.trim();
                                if (step) {
                                    if (reason) {
                                        step.skipReason = reason;
                                        
                                        // Проверяем, является ли причина пользовательской (не в списке дефолтных)
                                        const isCustomReason = !skipReasons.includes(reason);
                                        
                                        // Сохраняем пользовательскую причину в config.json через сервер
                                        if (isCustomReason) {
                                            try {
                                                const response = await fetch(SERVER_URL + '/api/addSkipReason', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                    },
                                                    body: JSON.stringify({
                                                        reason: reason
                                                    })
                                                });
                                                
                                                if (response.ok) {
                                                    // Обновляем список причин в datalist
                                                    const result = await response.json();
                                                    if (result.skipReasons && datalist) {
                                                        // Обновляем datalist
                                                        datalist.innerHTML = result.skipReasons.map(r => 
                                                            \`<option value="\${escapeHtml(r)}">\${escapeHtml(r)}</option>\`
                                                        ).join('');
                                                        // Обновляем глобальный список
                                                        skipReasons.length = 0;
                                                        skipReasons.push(...result.skipReasons);
                                                    }
                                                }
                                            } catch (error) {
                                                console.error('Ошибка при сохранении причины пропуска:', error);
                                            }
                                        }
                                        
                                        if (currentFilePath) {
                                            modifiedFiles.add(currentFilePath);
                                            document.getElementById('save-selected-btn').disabled = false;
                                            document.getElementById('save-all-btn').disabled = false;
                                        }
                                    } else {
                                        step.skipReason = '';
                                        if (currentFilePath) {
                                            modifiedFiles.add(currentFilePath);
                                            document.getElementById('save-selected-btn').disabled = false;
                                            document.getElementById('save-all-btn').disabled = false;
                                        }
                                    }
                                }
                            });
                        }
                    }
                    
                    // Обработчики для полей причины пропуска (если они уже есть в DOM)
                    document.querySelectorAll('.step-skip-reason-input').forEach(input => {
                        const stepId = input.getAttribute('data-step-id');
                        const container = input.closest('.step-reason-editable');
                        if (container) {
                            setupSkipReasonHandlers(container, stepId);
                        }
                    });
                }
                
                // Обработчики для всех полей метаданных
                const nameInput = document.getElementById('test-case-name');
                if (nameInput) {
                    nameInput.addEventListener('change', function() {
                        testCase.name = this.value;
                        if (currentFilePath) {
                            modifiedFiles.add(currentFilePath);
                            document.getElementById('save-selected-btn').disabled = false;
                            document.getElementById('save-all-btn').disabled = false;
                        }
                    });
                }
                
                const statusSelect = document.getElementById('test-case-status');
                if (statusSelect) {
                    statusSelect.addEventListener('change', function() {
                        testCase.status = this.value;
                        if (currentFilePath) {
                            modifiedFiles.add(currentFilePath);
                            document.getElementById('save-selected-btn').disabled = false;
                            document.getElementById('save-all-btn').disabled = false;
                        }
                    });
                }
                
                const typeSelect = document.getElementById('test-case-type');
                if (typeSelect) {
                    typeSelect.addEventListener('change', function() {
                        testCase.testType = this.value;
                        if (currentFilePath) {
                            modifiedFiles.add(currentFilePath);
                            document.getElementById('save-selected-btn').disabled = false;
                            document.getElementById('save-all-btn').disabled = false;
                        }
                    });
                }
                
                const ownerSelect = document.getElementById('test-case-owner');
                if (ownerSelect) {
                    ownerSelect.addEventListener('change', function() {
                        testCase.owner = this.value;
                        if (currentFilePath) {
                            modifiedFiles.add(currentFilePath);
                            document.getElementById('save-selected-btn').disabled = false;
                            document.getElementById('save-all-btn').disabled = false;
                        }
                    });
                }
                
                const authorSelect = document.getElementById('test-case-author');
                if (authorSelect) {
                    authorSelect.addEventListener('change', function() {
                        testCase.author = this.value;
                        if (currentFilePath) {
                            modifiedFiles.add(currentFilePath);
                            document.getElementById('save-selected-btn').disabled = false;
                            document.getElementById('save-all-btn').disabled = false;
                        }
                    });
                }
                
                const reviewerSelect = document.getElementById('test-case-reviewer');
                if (reviewerSelect) {
                    reviewerSelect.addEventListener('change', function() {
                        testCase.reviewer = this.value;
                        if (currentFilePath) {
                            modifiedFiles.add(currentFilePath);
                            document.getElementById('save-selected-btn').disabled = false;
                            document.getElementById('save-all-btn').disabled = false;
                        }
                    });
                }
                
                // Обработчик изменения описания
                const descTextarea = document.getElementById('test-case-description');
                if (descTextarea) {
                    descTextarea.addEventListener('change', function() {
                        testCase.description = this.value;
                        if (currentFilePath) {
                            modifiedFiles.add(currentFilePath);
                            document.getElementById('save-selected-btn').disabled = false;
                            document.getElementById('save-all-btn').disabled = false;
                        }
                    });
                }
            }
            
            // Функция экранирования HTML
            function escapeHtml(text) {
                if (!text) return '';
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            // Функция сохранения файла через сервер
            async function saveFile(relativePath, content) {
                try {
                    const response = await fetch(SERVER_URL + '/api/update', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            filePath: relativePath,
                            content: content
                        })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        showNotification('Файл сохранен: ' + relativePath, 'success');
                        return true;
                    } else {
                        showNotification('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'), 'error');
                        return false;
                    }
                } catch (error) {
                    showNotification('Ошибка сети. Убедитесь, что сервер запущен.', 'error');
                    console.error('Save error:', error);
                    return false;
                }
            }
            
            // Функция показа уведомлений
            function showNotification(message, type) {
                // Создаем элемент уведомления
                const notification = document.createElement('div');
                let bgColor = '#dc3545'; // По умолчанию красный (ошибка)
                if (type === 'success') {
                    bgColor = '#28a745';
                } else if (type === 'info') {
                    bgColor = '#17a2b8';
                }
                
                notification.style.cssText = \`
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 16px;
                    background-color: \${bgColor};
                    color: white;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    z-index: 10000;
                    font-size: 13px;
                    max-width: 300px;
                \`;
                notification.textContent = message;
                document.body.appendChild(notification);
                
                // Удаляем через 3 секунды
                setTimeout(() => {
                    notification.style.opacity = '0';
                    notification.style.transition = 'opacity 0.3s';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }, 3000);
            }
            
            // Функция валидации шагов с failed статусом
            function validateFailedSteps(content) {
                if (!content.steps || !Array.isArray(content.steps)) {
                    return { valid: true, message: '' };
                }
                
                const failedStepsWithoutBugLink = content.steps.filter(step => 
                    step.status === 'failed' && (!step.bugLink || step.bugLink.trim() === '')
                );
                
                const skippedStepsWithoutReason = content.steps.filter(step => 
                    step.status === 'skipped' && (!step.skipReason || step.skipReason.trim() === '')
                );
                
                const errors = [];
                if (failedStepsWithoutBugLink.length > 0) {
                    errors.push(\`Для шагов со статусом "Failed" необходимо указать причину. Найдено шагов без причины: \${failedStepsWithoutBugLink.length}\`);
                }
                
                if (skippedStepsWithoutReason.length > 0) {
                    errors.push(\`Для шагов со статусом "Skipped" необходимо указать причину. Найдено шагов без причины: \${skippedStepsWithoutReason.length}\`);
                }
                
                if (errors.length > 0) {
                    return { 
                        valid: false, 
                        message: errors.join('\\n') 
                    };
                }
                
                return { valid: true, message: '' };
            }
            
            // Функция сохранения текущего файла (используется для кнопки и хоткея)
            async function saveCurrentFile() {
                if (currentFilePath && testCasesData[currentFilePath]) {
                    const content = testCasesData[currentFilePath];
                    
                    // Валидация перед сохранением
                    const validation = validateFailedSteps(content);
                    if (!validation.valid) {
                        showNotification(validation.message, 'error');
                        return false;
                    }
                    
                    content.updatedAt = Date.now();
                    const success = await saveFile(currentFilePath, content);
                    if (success) {
                        modifiedFiles.delete(currentFilePath);
                        const saveSelectedBtn = document.getElementById('save-selected-btn');
                        if (saveSelectedBtn) {
                            saveSelectedBtn.disabled = modifiedFiles.size === 0 && !currentFilePath;
                        }
                        const saveAllBtn = document.getElementById('save-all-btn');
                        if (saveAllBtn) {
                            saveAllBtn.disabled = modifiedFiles.size === 0;
                        }
                        return true;
                    }
                    return false;
                }
                return false;
            }
            
            // Сохранить выбранный файл
            document.getElementById('save-selected-btn').addEventListener('click', async function() {
                await saveCurrentFile();
            });
            
            // Горячая клавиша Ctrl+S (или Cmd+S на macOS) для быстрого сохранения
            // Используем capture: true для перехвата события до того, как браузер его обработает
            document.addEventListener('keydown', async function(e) {
                // Проверяем комбинацию: Ctrl+S (Windows/Linux) или Cmd+S (macOS)
                // metaKey - это Cmd на macOS, ctrlKey - это Ctrl на Windows/Linux
                if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                    // Всегда предотвращаем стандартное сохранение страницы браузером
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    // Сохраняем текущий файл
                    await saveCurrentFile();
                }
            }, true); // true = capture phase, перехватываем событие до того, как оно достигнет целевого элемента
            
            // Сохранить все измененные файлы
            document.getElementById('save-all-btn').addEventListener('click', async function() {
                if (modifiedFiles.size === 0) {
                    showNotification('Нет измененных файлов для сохранения', 'error');
                    return;
                }
                
                // Валидация всех файлов перед сохранением
                const filesToSave = Array.from(modifiedFiles);
                const validationErrors = [];
                
                for (const relativePath of filesToSave) {
                    if (testCasesData[relativePath]) {
                        const validation = validateFailedSteps(testCasesData[relativePath]);
                        if (!validation.valid) {
                            validationErrors.push(relativePath + ': ' + validation.message);
                        }
                    }
                }
                
                if (validationErrors.length > 0) {
                    showNotification('Ошибки валидации:\\n' + validationErrors.join('\\n'), 'error');
                    return;
                }
                
                this.disabled = true;
                this.textContent = 'Сохранение...';
                
                let saved = 0;
                let failed = 0;
                
                for (const relativePath of filesToSave) {
                    if (testCasesData[relativePath]) {
                        const content = testCasesData[relativePath];
                        content.updatedAt = Date.now();
                        const success = await saveFile(relativePath, content);
                        if (success) {
                            saved++;
                            modifiedFiles.delete(relativePath);
                        } else {
                            failed++;
                        }
                    }
                }
                
                this.disabled = false;
                this.textContent = 'Сохранить все изменения';
                
                if (failed === 0) {
                    showNotification(\`Успешно сохранено файлов: \${saved}\`, 'success');
                } else {
                    showNotification(\`Сохранено: \${saved}, Ошибок: \${failed}\`, 'error');
                }
            });
        })();
    </script>
</body>
</html>`;
    }

    /**
     * Создать автономный HTML файл для браузера
     */
    async createStandaloneHtml() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Откройте рабочую папку для создания HTML файла');
            return;
        }

        // 1. Проверка ветки
        const branch = await this.getCurrentBranch();
        const confirmed = await vscode.window.showInformationMessage(
            `Создать HTML файл раннера на ветке: ${branch}?`,
            'Да', 'Нет'
        );
        
        if (confirmed !== 'Да') {
            return;
        }

        // 2. Сканирование файлов и запуск сервера
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Сканирование тест-кейсов и запуск сервера...',
            cancellable: false
        }, async (progress) => {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            
            // 2.1. Запускаем локальный сервер
            progress.report({ increment: 0, message: 'Запуск локального сервера...' });
            let serverPort: number;
            try {
                serverPort = await this.startLocalServer(workspacePath);
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка при запуске сервера: ${error}`);
                return;
            }
            
            // 2.2. Сканируем тест-кейсы
            progress.report({ increment: 50, message: 'Сканирование тест-кейсов...' });
            const testCases = await this.scanTestCases();
            
            // 3. Генерация HTML с адресом сервера
            progress.report({ increment: 80, message: 'Генерация HTML...' });
            const html = this.generateStandaloneHtml(testCases, branch, serverPort);
            
            // 4. Сохранение файла
            const htmlPath = path.join(workspacePath, 'test-case-runner.html');
            
            try {
                fs.writeFileSync(htmlPath, html, 'utf8');
                
                // 5. Открытие в браузере
                const { exec } = require('child_process');
                const platform = process.platform;
                let command: string;
                
                if (platform === 'win32') {
                    command = `start "" "${htmlPath}"`;
                } else if (platform === 'darwin') {
                    command = `open "${htmlPath}"`;
                } else {
                    command = `xdg-open "${htmlPath}"`;
                }
                
                exec(command, (error: any) => {
                    if (error) {
                        vscode.window.showWarningMessage(
                            `HTML файл создан: ${htmlPath}, но не удалось открыть в браузере. Откройте файл вручную.`
                        );
                    }
                });
                
                vscode.window.showInformationMessage(
                    `HTML файл создан: ${htmlPath}. Сервер запущен на порту ${serverPort}.`,
                    'Открыть файл в редакторе'
                ).then(selection => {
                    if (selection === 'Открыть файл в редакторе') {
                        vscode.window.showTextDocument(vscode.Uri.file(htmlPath));
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка при создании HTML файла: ${error}`);
            }
        });
    }

}

