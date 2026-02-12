import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MarkdownTestCaseParser, MarkdownTestCase } from './markdownTestCaseParser';

interface TestCaseData {
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
    name: string;
    path: string;
    filePath?: string;
    relativePath?: string;
    data?: TestCaseData;
    children: TestCaseNode[];
}

export class TestCaseTreeItem extends vscode.TreeItem {
    public readonly status: 'passed' | 'failed' | 'skipped' | null = null;
    
    constructor(
        public readonly node: TestCaseNode,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(node.name, collapsibleState);
        
        // Вычисляем статус для папок и тест-кейсов
        this.status = this.calculateNodeStatus(node);
        
        if (node.type === 'folder') {
            // Для папок используем стандартную иконку папки VS Code
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'testCaseFolder';
            
            // Добавляем цветной индикатор статуса для папок
            if (this.status) {
                this.description = this.getStatusIndicator(this.status);
            }
        } else {
            // Для тест-кейсов используем стандартную иконку markdown файла VS Code
            // Используем resourceUri, чтобы VS Code автоматически определил иконку по расширению .md
            if (node.filePath) {
                this.resourceUri = vscode.Uri.file(node.filePath);
            } else {
                this.iconPath = new vscode.ThemeIcon('markdown');
            }
            this.contextValue = 'testCase';
            this.command = {
                command: 'testCaseViewer.openTestCase',
                title: 'Открыть тест-кейс',
                arguments: [node.filePath]
            };
            
            // Добавляем tooltip с информацией о тест-кейсе
            if (node.data) {
                const tooltipParts: string[] = [];
                if (node.data.author) tooltipParts.push(`Автор: ${node.data.author}`);
                if (node.data.owner) tooltipParts.push(`Владелец: ${node.data.owner}`);
                if (node.data.status) tooltipParts.push(`Статус: ${node.data.status}`);
                if (node.data.testType) tooltipParts.push(`Тип: ${node.data.testType}`);
                this.tooltip = tooltipParts.join('\n') || node.name;
            }
            
            // Добавляем цветной индикатор статуса для тест-кейсов
            if (this.status) {
                this.description = this.getStatusIndicator(this.status);
            }
        }
    }
    
    private calculateNodeStatus(node: TestCaseNode): 'passed' | 'failed' | 'skipped' | null {
        if (node.type === 'testcase' && node.data && node.data.steps) {
            const steps = node.data.steps;
            const hasFailed = steps.some(step => step.status === 'failed');
            const hasSkipped = steps.some(step => step.status === 'skipped');
            const allPassed = steps.every(step => step.status === 'passed');
            
            if (hasFailed) return 'failed';
            if (hasSkipped) return 'skipped';
            if (allPassed) return 'passed';
        } else if (node.type === 'folder') {
            // Для папок вычисляем статус на основе детей
            let hasFailed = false;
            let hasSkipped = false;
            let hasPassed = false;
            let hasAnyChild = false;
            
            const checkChildren = (children: TestCaseNode[]) => {
                for (const child of children) {
                    if (child.type === 'testcase') {
                        hasAnyChild = true;
                        const childStatus = this.calculateNodeStatus(child);
                        if (childStatus === 'failed') hasFailed = true;
                        else if (childStatus === 'skipped') hasSkipped = true;
                        else if (childStatus === 'passed') hasPassed = true;
                    } else if (child.type === 'folder') {
                        checkChildren(child.children);
                    }
                }
            };
            
            checkChildren(node.children);
            
            if (!hasAnyChild) return null;
            if (hasFailed) return 'failed';
            if (hasSkipped) return 'skipped';
            if (hasPassed && !hasFailed && !hasSkipped) return 'passed';
        }
        return null;
    }
    
    private getStatusIndicator(status: 'passed' | 'failed' | 'skipped'): string {
        // Используем цветные символы для индикаторов статуса
        // Цвета соответствуют HTML отчету: зеленый #28a745, красный #dc3545, серый #9e9e9e
        // VS Code будет отображать их, но цвета нужно будет добавить через CSS или использовать эмодзи
        if (status === 'passed') return '✓'; // Зеленая галочка
        if (status === 'failed') return '✗'; // Красный крестик
        if (status === 'skipped') return '⊘'; // Серый кружок с линией
        return '';
    }
    
}

export class TestCaseTreeViewProvider implements vscode.TreeDataProvider<TestCaseTreeItem>, vscode.TreeDragAndDropController<TestCaseTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TestCaseTreeItem | undefined | null | void> = new vscode.EventEmitter<TestCaseTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TestCaseTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    
    private _onDidChangeFilters: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeFilters: vscode.Event<void> = this._onDidChangeFilters.event;
    
    private _testCases: Map<string, TestCaseNode> = new Map();
    private _extensionUri: vscode.Uri;
    private _treeMode: 'file' | 'epic-feature-story' = 'file';
    private _filters: {
        author?: string;
        owner?: string;
        reviewer?: string;
        testType?: string;
        status?: string;
        epic?: string;
        feature?: string;
        story?: string;
        tags?: string;
    } = {};
    
    // Drag and Drop MIME types
    dragMimeTypes = ['application/vnd.code.tree.testCaseViewer'];
    dropMimeTypes = ['application/vnd.code.tree.testCaseViewer'];
    
    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
        // Слушаем изменения файлов для автоматического обновления дерева
        vscode.workspace.onDidSaveTextDocument(() => {
            this.refresh();
        });
        
        vscode.workspace.onDidCreateFiles(() => {
            this.refresh();
        });
        
        vscode.workspace.onDidDeleteFiles(() => {
            this.refresh();
        });
    }
    
    refresh(): void {
        // Очищаем кэш дерева при обновлении, чтобы пересканировать при следующем запросе
        this._testCases.clear();
        // Обновляем все дерево - fire(undefined) обновляет весь корневой уровень
        this._onDidChangeTreeData.fire(undefined);
    }
    
    getTreeMode(): 'file' | 'epic-feature-story' {
        return this._treeMode;
    }
    
    setTreeMode(mode: 'file' | 'epic-feature-story'): void {
        if (this._treeMode !== mode) {
            this._treeMode = mode;
            // Очищаем кэш и обновляем дерево
            this._testCases.clear();
            this._onDidChangeTreeData.fire(undefined);
        }
    }
    
    setFilters(filters: typeof this._filters): void {
        this._filters = filters;
        this._onDidChangeFilters.fire();
        // Принудительно обновляем дерево при изменении фильтров
        this._testCases.clear();
        // Обновляем все дерево - fire(undefined) обновляет весь корневой уровень
        this._onDidChangeTreeData.fire(undefined);
    }
    
    getFilters(): typeof this._filters {
        return { ...this._filters };
    }
    
    clearFilters(): void {
        this._filters = {};
        this._onDidChangeFilters.fire();
        // Принудительно обновляем дерево при сбросе фильтров
        this._testCases.clear();
        // Обновляем все дерево - fire(undefined) обновляет весь корневой уровень
        this._onDidChangeTreeData.fire(undefined);
    }
    
    getTreeItem(element: TestCaseTreeItem): vscode.TreeItem {
        return element;
    }
    
    async getChildren(element?: TestCaseTreeItem): Promise<TestCaseTreeItem[]> {
        if (!element) {
            // Корневой уровень - всегда строим полное дерево сразу
            await this.scanTestCases();
            const rootNode = this._testCases.get('');
            if (!rootNode) {
                return [];
            }
            // Все папки свернуты по умолчанию
            return this.getFilteredChildren(rootNode.children).map(child => 
                new TestCaseTreeItem(
                    child,
                    child.type === 'folder' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
                )
            );
        }
        
        // Дочерние элементы - используем уже построенное полное дерево
        const children = this.getFilteredChildren(element.node.children);
        // Все папки свернуты по умолчанию
        return children.map(child => 
            new TestCaseTreeItem(
                child,
                child.type === 'folder' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            )
        );
    }
    
    private getFilteredChildren(children: TestCaseNode[]): TestCaseNode[] {
        if (!this.hasActiveFilters()) {
            return children;
        }
        
        return children.filter(node => {
            if (node.type === 'folder') {
                // Для папок проверяем, есть ли внутри подходящие тест-кейсы
                const hasMatchingChildren = this.hasMatchingDescendants(node);
                return hasMatchingChildren;
            } else {
                // Для тест-кейсов применяем фильтры
                return this.matchesFilters(node);
            }
        });
    }
    
    private hasMatchingDescendants(node: TestCaseNode): boolean {
        if (node.type === 'testcase') {
            return this.matchesFilters(node);
        }
        
        // Для папок проверяем рекурсивно
        return node.children.some(child => this.hasMatchingDescendants(child));
    }
    
    private matchesFilters(node: TestCaseNode): boolean {
        if (node.type !== 'testcase' || !node.data) {
            return false;
        }
        
        const data = node.data;
        
        if (this._filters.author && data.author !== this._filters.author) {
            return false;
        }
        if (this._filters.owner && data.owner !== this._filters.owner) {
            return false;
        }
        if (this._filters.reviewer && data.reviewer !== this._filters.reviewer) {
            return false;
        }
        if (this._filters.testType && data.testType !== this._filters.testType) {
            return false;
        }
        if (this._filters.status && data.status !== this._filters.status) {
            return false;
        }
        if (this._filters.epic && data.epic !== this._filters.epic) {
            return false;
        }
        if (this._filters.feature && data.feature !== this._filters.feature) {
            return false;
        }
        if (this._filters.story && data.story !== this._filters.story) {
            return false;
        }
        if (this._filters.tags) {
            const nodeTags = (data.tags || '').split(',').map(t => t.trim());
            if (!nodeTags.includes(this._filters.tags)) {
                return false;
            }
        }
        
        return true;
    }
    
    private hasActiveFilters(): boolean {
        return !!(
            this._filters.author ||
            this._filters.owner ||
            this._filters.reviewer ||
            this._filters.testType ||
            this._filters.status ||
            this._filters.epic ||
            this._filters.feature ||
            this._filters.story ||
            this._filters.tags
        );
    }
    
    private async scanTestCases(): Promise<void> {
        if (this._treeMode === 'epic-feature-story') {
            await this.buildEpicFeatureStoryTree();
        } else {
            await this.buildFileTree();
        }
    }
    
    private async buildFileTree(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this._testCases = new Map();
            return;
        }
        
        const files = await vscode.workspace.findFiles('**/*.md');
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
                const contentStr = content.toString();
                
                // Парсим markdown файл
                const mdCase = MarkdownTestCaseParser.parse(contentStr);
                
                // Проверяем, что это тест-кейс (есть заголовок и шаги)
                if (mdCase.title && mdCase.steps && mdCase.steps.length > 0) {
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
                    
                    // Преобразуем MarkdownTestCase в TestCaseData
                    const testCase = this.convertMarkdownToTestCase(mdCase, file.fsPath);
                    
                    // Добавляем тест-кейс с именем из заголовка (#)
                    const testCaseNode: TestCaseNode = {
                        type: 'testcase',
                        name: mdCase.title || path.basename(file.fsPath, '.md'),
                        path: relativePath,
                        filePath: file.fsPath,
                        relativePath: relativePath,
                        data: testCase,
                        children: []
                    };
                    
                    currentNode.children.push(testCaseNode);
                }
            } catch (e) {
                // Пропустить невалидные MD файлы
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
    }
    
    private async buildEpicFeatureStoryTree(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this._testCases = new Map();
            return;
        }
        
        const files = await vscode.workspace.findFiles('**/*.md');
        const tree = new Map<string, TestCaseNode>();
        const rootNode: TestCaseNode = {
            type: 'folder',
            name: 'Root',
            path: '',
            children: []
        };
        tree.set('', rootNode);
        
        // Структура для хранения дерева: Epic -> Feature -> Story -> TestCases
        interface EpicNode {
            name: string;
            features: Map<string, FeatureNode>;
        }
        
        interface FeatureNode {
            name: string;
            stories: Map<string, StoryNode>;
        }
        
        interface StoryNode {
            name: string;
            testCases: TestCaseNode[];
        }
        
        const epics = new Map<string, EpicNode>();
        const testCasesWithoutEpic = new Map<string, TestCaseNode>(); // Feature -> TestCases (без Epic)
        const testCasesWithoutFeature = new Map<string, TestCaseNode>(); // Story -> TestCases (без Epic и Feature)
        const testCasesWithoutStory: TestCaseNode[] = []; // TestCases без Epic, Feature, Story
        
        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const contentStr = content.toString();
                
                // Парсим markdown файл
                const mdCase = MarkdownTestCaseParser.parse(contentStr);
                
                // Проверяем, что это тест-кейс (есть заголовок и шаги)
                if (mdCase.title && mdCase.steps && mdCase.steps.length > 0) {
                    const relativePath = vscode.workspace.asRelativePath(file);
                    
                    // Преобразуем MarkdownTestCase в TestCaseData
                    const testCase = this.convertMarkdownToTestCase(mdCase, file.fsPath);
                    
                    // Добавляем тест-кейс с именем из заголовка (#)
                    const testCaseNode: TestCaseNode = {
                        type: 'testcase',
                        name: mdCase.title || path.basename(file.fsPath, '.md'),
                        path: relativePath,
                        filePath: file.fsPath,
                        relativePath: relativePath,
                        data: testCase,
                        children: []
                    };
                    
                    const epic = (testCase.epic || '').trim();
                    const feature = (testCase.feature || '').trim();
                    const story = (testCase.story || '').trim();
                    
                    // Строим дерево по структуре Epic -> Feature -> Story -> TestCases
                    if (epic) {
                        // Есть Epic
                        if (!epics.has(epic)) {
                            epics.set(epic, {
                                name: epic,
                                features: new Map()
                            });
                        }
                        
                        const epicNode = epics.get(epic)!;
                        
                        if (feature) {
                            // Есть Epic и Feature
                            if (!epicNode.features.has(feature)) {
                                epicNode.features.set(feature, {
                                    name: feature,
                                    stories: new Map()
                                });
                            }
                            
                            const featureNode = epicNode.features.get(feature)!;
                            
                            if (story) {
                                // Есть Epic, Feature и Story
                                if (!featureNode.stories.has(story)) {
                                    featureNode.stories.set(story, {
                                        name: story,
                                        testCases: []
                                    });
                                }
                                
                                featureNode.stories.get(story)!.testCases.push(testCaseNode);
                            } else {
                                // Есть Epic и Feature, но нет Story - добавляем напрямую в Feature
                                if (!featureNode.stories.has('')) {
                                    featureNode.stories.set('', {
                                        name: '',
                                        testCases: []
                                    });
                                }
                                featureNode.stories.get('')!.testCases.push(testCaseNode);
                            }
                        } else {
                            // Есть Epic, но нет Feature - добавляем напрямую в Epic
                            if (!epicNode.features.has('')) {
                                epicNode.features.set('', {
                                    name: '',
                                    stories: new Map()
                                });
                            }
                            
                            const featureNode = epicNode.features.get('')!;
                            
                            if (story) {
                                // Есть Epic и Story, но нет Feature
                                if (!featureNode.stories.has(story)) {
                                    featureNode.stories.set(story, {
                                        name: story,
                                        testCases: []
                                    });
                                }
                                featureNode.stories.get(story)!.testCases.push(testCaseNode);
                            } else {
                                // Только Epic
                                if (!featureNode.stories.has('')) {
                                    featureNode.stories.set('', {
                                        name: '',
                                        testCases: []
                                    });
                                }
                                featureNode.stories.get('')!.testCases.push(testCaseNode);
                            }
                        }
                    } else if (feature) {
                        // Нет Epic, но есть Feature
                        if (!testCasesWithoutEpic.has(feature)) {
                            testCasesWithoutEpic.set(feature, {
                                type: 'folder',
                                name: feature,
                                path: `feature:${feature}`,
                                children: []
                            });
                        }
                        
                        const featureNode = testCasesWithoutEpic.get(feature)!;
                        
                        if (story) {
                            // Есть Feature и Story, но нет Epic
                            let storyNode = featureNode.children.find(
                                child => child.type === 'folder' && child.name === story
                            );
                            
                            if (!storyNode) {
                                storyNode = {
                                    type: 'folder',
                                    name: story,
                                    path: `feature:${feature}/story:${story}`,
                                    children: []
                                };
                                featureNode.children.push(storyNode);
                            }
                            
                            storyNode.children.push(testCaseNode);
                        } else {
                            // Только Feature
                            featureNode.children.push(testCaseNode);
                        }
                    } else if (story) {
                        // Нет Epic и Feature, но есть Story
                        if (!testCasesWithoutFeature.has(story)) {
                            testCasesWithoutFeature.set(story, {
                                type: 'folder',
                                name: story,
                                path: `story:${story}`,
                                children: []
                            });
                        }
                        
                        testCasesWithoutFeature.get(story)!.children.push(testCaseNode);
                    } else {
                        // Нет Epic, Feature и Story - добавляем в корень
                        testCasesWithoutStory.push(testCaseNode);
                    }
                }
            } catch (e) {
                // Пропустить невалидные MD файлы
                console.log(`Skipping file ${file.fsPath}: ${e}`);
            }
        }
        
        // Строим дерево из структуры данных
        // Сначала добавляем Epics
        const sortedEpics = Array.from(epics.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [epicName, epicNode] of sortedEpics) {
            const epicFolder: TestCaseNode = {
                type: 'folder',
                name: epicName,
                path: `epic:${epicName}`,
                children: []
            };
            
            // Добавляем Features внутри Epic
            const sortedFeatures = Array.from(epicNode.features.entries()).sort((a, b) => {
                if (a[0] === '' && b[0] !== '') return 1;
                if (a[0] !== '' && b[0] === '') return -1;
                return a[0].localeCompare(b[0]);
            });
            
            for (const [featureName, featureNode] of sortedFeatures) {
                if (featureName) {
                    // Есть название Feature
                    const featureFolder: TestCaseNode = {
                        type: 'folder',
                        name: featureName,
                        path: `epic:${epicName}/feature:${featureName}`,
                        children: []
                    };
                    
                    // Добавляем Stories внутри Feature
                    const sortedStories = Array.from(featureNode.stories.entries()).sort((a, b) => {
                        if (a[0] === '' && b[0] !== '') return 1;
                        if (a[0] !== '' && b[0] === '') return -1;
                        return a[0].localeCompare(b[0]);
                    });
                    
                    for (const [storyName, storyNode] of sortedStories) {
                        if (storyName) {
                            // Есть название Story
                            const storyFolder: TestCaseNode = {
                                type: 'folder',
                                name: storyName,
                                path: `epic:${epicName}/feature:${featureName}/story:${storyName}`,
                                children: storyNode.testCases
                            };
                            featureFolder.children.push(storyFolder);
                        } else {
                            // Нет названия Story - добавляем тест-кейсы напрямую в Feature
                            featureFolder.children.push(...storyNode.testCases);
                        }
                    }
                    
                    epicFolder.children.push(featureFolder);
                } else {
                    // Нет названия Feature - добавляем Stories напрямую в Epic
                    const sortedStories = Array.from(featureNode.stories.entries()).sort((a, b) => {
                        if (a[0] === '' && b[0] !== '') return 1;
                        if (a[0] !== '' && b[0] === '') return -1;
                        return a[0].localeCompare(b[0]);
                    });
                    
                    for (const [storyName, storyNode] of sortedStories) {
                        if (storyName) {
                            // Есть название Story
                            const storyFolder: TestCaseNode = {
                                type: 'folder',
                                name: storyName,
                                path: `epic:${epicName}/story:${storyName}`,
                                children: storyNode.testCases
                            };
                            epicFolder.children.push(storyFolder);
                        } else {
                            // Нет названия Story - добавляем тест-кейсы напрямую в Epic
                            epicFolder.children.push(...storyNode.testCases);
                        }
                    }
                }
            }
            
            rootNode.children.push(epicFolder);
        }
        
        // Добавляем Features без Epic
        const sortedFeaturesWithoutEpic = Array.from(testCasesWithoutEpic.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [featureName, featureNode] of sortedFeaturesWithoutEpic) {
            rootNode.children.push(featureNode);
        }
        
        // Добавляем Stories без Epic и Feature
        const sortedStoriesWithoutFeature = Array.from(testCasesWithoutFeature.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [storyName, storyNode] of sortedStoriesWithoutFeature) {
            rootNode.children.push(storyNode);
        }
        
        // Добавляем тест-кейсы без Epic, Feature и Story
        rootNode.children.push(...testCasesWithoutStory);
        
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
    }
    
    private convertMarkdownToTestCase(mdCase: MarkdownTestCase, filePath: string): TestCaseData {
        const testCase: TestCaseData = {
            id: mdCase.metadata.id || '',
            name: mdCase.title || path.basename(filePath, '.md'),
            description: mdCase.description || '',
            preconditions: mdCase.preconditions || '',
            expectedResult: '',
            epic: mdCase.epicFeatureStory.epic || '',
            feature: mdCase.epicFeatureStory.feature || '',
            story: mdCase.epicFeatureStory.story || '',
            component: '',
            testLayer: '',
            severity: '',
            priority: '',
            environment: '',
            browser: '',
            owner: mdCase.metadata.owner || '',
            author: mdCase.metadata.author || '',
            reviewer: '',
            testCaseId: mdCase.metadata.id || '',
            issueLinks: mdCase.links?.join('\n') || '',
            testCaseLinks: '',
            tags: mdCase.tags?.join(', ') || '',
            status: mdCase.metadata.status || '',
            testType: mdCase.metadata.testType || '',
            steps: mdCase.steps.map((step, index) => ({
                id: String(step.stepNumber || index + 1),
                name: `Шаг ${step.stepNumber || index + 1}`,
                description: step.action || '',
                expectedResult: step.expectedResult || '',
                status: step.status || '',
                bugLink: step.status?.toLowerCase() === 'failed' ? (step.reason || '') : '',
                skipReason: step.status?.toLowerCase() === 'skipped' ? (step.reason || '') : '',
                attachments: step.attachments || ''
            })),
            createdAt: undefined,
            updatedAt: undefined,
            notes: undefined
        };
        return testCase;
    }
    
    // Методы для получения уникальных значений для фильтров
    async getUniqueValues(field: keyof TestCaseData): Promise<string[]> {
        await this.scanTestCases();
        const values = new Set<string>();
        
        const collectValues = (node: TestCaseNode) => {
            if (node.type === 'testcase' && node.data) {
                const value = node.data[field];
                if (value && typeof value === 'string' && value.trim()) {
                    values.add(value.trim());
                }
            }
            node.children.forEach(child => collectValues(child));
        };
        
        const rootNode = this._testCases.get('');
        if (rootNode) {
            collectValues(rootNode);
        }
        
        return Array.from(values).sort();
    }
    
    // Специальный метод для получения уникальных тегов (теги разделены запятыми)
    async getUniqueTags(): Promise<string[]> {
        await this.scanTestCases();
        const values = new Set<string>();
        
        const collectTags = (node: TestCaseNode) => {
            if (node.type === 'testcase' && node.data && node.data.tags) {
                const tags = node.data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
                tags.forEach(tag => values.add(tag));
            }
            node.children.forEach(child => collectTags(child));
        };
        
        const rootNode = this._testCases.get('');
        if (rootNode) {
            collectTags(rootNode);
        }
        
        return Array.from(values).sort();
    }
    
    // Drag and Drop implementation
    handleDrag(source: readonly TestCaseTreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        // Сохраняем данные о перетаскиваемых элементах
        const items = source.map(item => ({
            type: item.node.type,
            filePath: item.node.filePath,
            relativePath: item.node.relativePath,
            path: item.node.path
        }));
        
        dataTransfer.set('application/vnd.code.tree.testCaseViewer', new vscode.DataTransferItem(JSON.stringify(items)));
    }
    
    async handleDrop(target: TestCaseTreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        const transferItem = dataTransfer.get('application/vnd.code.tree.testCaseViewer');
        if (!transferItem) {
            return;
        }
        
        const items: Array<{ type: string; filePath?: string; relativePath?: string; path: string }> = JSON.parse(await transferItem.asString());
        
        if (items.length === 0) {
            return;
        }
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }
        
        const workspacePath = workspaceFolders[0].uri.fsPath;
        
        // Определяем целевую папку
        let targetFolderPath: string;
        if (!target) {
            // Перетаскивание в корень
            targetFolderPath = workspacePath;
        } else if (target.node.type === 'folder') {
            // Перетаскивание в папку
            targetFolderPath = path.join(workspacePath, target.node.path);
        } else if (target.node.type === 'testcase' && target.node.relativePath) {
            // Перетаскивание на файл - создаем в той же папке
            const pathParts = target.node.relativePath.split(/[/\\]/);
            pathParts.pop(); // Убираем имя файла
            if (pathParts.length > 0) {
                targetFolderPath = path.join(workspacePath, ...pathParts);
            } else {
                targetFolderPath = workspacePath;
            }
        } else {
            return;
        }
        
        // Перемещаем файлы
        for (const item of items) {
            if (item.type === 'testcase' && item.filePath) {
                try {
                    const sourcePath = item.filePath;
                    const fileName = path.basename(sourcePath);
                    const targetPath = path.join(targetFolderPath, fileName);
                    
                    // Проверяем, не перемещаем ли файл в то же место
                    if (sourcePath === targetPath) {
                        continue;
                    }
                    
                    // Проверяем, существует ли файл с таким именем в целевой папке
                    try {
                        await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
                        const overwrite = await vscode.window.showWarningMessage(
                            `Файл "${fileName}" уже существует в целевой папке. Перезаписать?`,
                            { modal: true },
                            'Да',
                            'Нет'
                        );
                        if (overwrite !== 'Да') {
                            continue;
                        }
                    } catch {
                        // Файл не существует, можно перемещать
                    }
                    
                    // Создаем целевую папку, если она не существует
                    try {
                        await vscode.workspace.fs.stat(vscode.Uri.file(targetFolderPath));
                    } catch {
                        await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetFolderPath));
                    }
                    
                    // Перемещаем файл
                    await vscode.workspace.fs.rename(
                        vscode.Uri.file(sourcePath),
                        vscode.Uri.file(targetPath),
                        { overwrite: true }
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(`Ошибка при перемещении файла: ${error}`);
                }
            } else if (item.type === 'folder') {
                // Перемещение папки
                const sourcePath = path.join(workspacePath, item.path);
                const folderName = path.basename(sourcePath);
                const targetPath = path.join(targetFolderPath, folderName);
                
                // Проверяем, не перемещаем ли папку в то же место или в саму себя
                if (sourcePath === targetPath || targetPath.startsWith(sourcePath + path.sep)) {
                    vscode.window.showWarningMessage('Нельзя переместить папку в саму себя');
                    continue;
                }
                
                // Проверяем, существует ли папка с таким именем в целевой папке
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
                    const overwrite = await vscode.window.showWarningMessage(
                        `Папка "${folderName}" уже существует в целевой папке. Перезаписать?`,
                        { modal: true },
                        'Да',
                        'Нет'
                    );
                    if (overwrite !== 'Да') {
                        continue;
                    }
                } catch {
                    // Папка не существует, можно перемещать
                }
                
                try {
                    // Создаем целевую папку, если она не существует
                    try {
                        await vscode.workspace.fs.stat(vscode.Uri.file(targetFolderPath));
                    } catch {
                        await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetFolderPath));
                    }
                    
                    // Перемещаем папку
                    await vscode.workspace.fs.rename(
                        vscode.Uri.file(sourcePath),
                        vscode.Uri.file(targetPath),
                        { overwrite: true }
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(`Ошибка при перемещении папки: ${error}`);
                }
            }
        }
        
        // Обновляем дерево после перемещения
        this.refresh();
    }
}

