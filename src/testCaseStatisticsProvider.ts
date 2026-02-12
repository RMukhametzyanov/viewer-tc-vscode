import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownTestCaseParser } from './markdownTestCaseParser';

interface TestCaseData {
    id: string;
    name: string;
    author: string;
    owner: string;
    reviewer: string;
    status: string;
    testType: string;
    epic: string;
    feature: string;
    story: string;
    tags: string;
    filePath: string;
}

interface Statistics {
    total: number;
    byAuthor: { [key: string]: number };
    byOwner: { [key: string]: number };
    byStatus: { [key: string]: number };
    byTestType: { [key: string]: number };
    byEpic: { [key: string]: number };
    byFeature: { [key: string]: number };
    byStory: { [key: string]: number };
    testCases: TestCaseData[];
}

export class TestCaseStatisticsProvider {
    private static _statistics: Statistics | null = null;
    private static _onDidChangeStatistics = new vscode.EventEmitter<void>();
    public static readonly onDidChangeStatistics = this._onDidChangeStatistics.event;

    public static async collectStatistics(filters?: {
        author?: string;
        owner?: string;
        status?: string;
        testType?: string;
        epic?: string;
        feature?: string;
        story?: string;
        tags?: string;
    }): Promise<Statistics> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return this.getEmptyStatistics();
        }

        const files = await vscode.workspace.findFiles('**/*.md');
        const testCases: TestCaseData[] = [];

        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const contentStr = content.toString();
                
                // Парсим markdown файл
                const mdCase = MarkdownTestCaseParser.parse(contentStr);
                
                // Проверяем, что это тест-кейс (есть заголовок и шаги)
                if (mdCase.title && mdCase.steps && mdCase.steps.length > 0) {
                    const testCase: TestCaseData = {
                        id: mdCase.metadata.id || '',
                        name: mdCase.title || path.basename(file.fsPath, '.md'),
                        author: mdCase.metadata.author || '',
                        owner: mdCase.metadata.owner || '',
                        reviewer: '', // reviewer не хранится в metadata
                        status: mdCase.metadata.status || '',
                        testType: mdCase.metadata.testType || '',
                        epic: mdCase.epicFeatureStory?.epic || '',
                        feature: mdCase.epicFeatureStory?.feature || '',
                        story: mdCase.epicFeatureStory?.story || '',
                        tags: (mdCase.tags || []).join(', '),
                        filePath: file.fsPath
                    };

                    // Применяем фильтры
                    if (filters) {
                        if (filters.author && testCase.author !== filters.author) continue;
                        if (filters.owner && testCase.owner !== filters.owner) continue;
                        if (filters.status && testCase.status !== filters.status) continue;
                        if (filters.testType && testCase.testType !== filters.testType) continue;
                        if (filters.epic && testCase.epic !== filters.epic) continue;
                        if (filters.feature && testCase.feature !== filters.feature) continue;
                        if (filters.story && testCase.story !== filters.story) continue;
                        if (filters.tags) {
                            const nodeTags = (testCase.tags || '').split(',').map(t => t.trim());
                            if (!nodeTags.includes(filters.tags)) continue;
                        }
                    }

                    testCases.push(testCase);
                }
            } catch (e) {
                // Пропустить невалидные MD файлы
                console.log(`Skipping file ${file.fsPath}: ${e}`);
            }
        }

        // Собираем статистику
        const statistics: Statistics = {
            total: testCases.length,
            byAuthor: {},
            byOwner: {},
            byStatus: {},
            byTestType: {},
            byEpic: {},
            byFeature: {},
            byStory: {},
            testCases: testCases
        };

        for (const testCase of testCases) {
            // По авторам
            if (testCase.author) {
                statistics.byAuthor[testCase.author] = (statistics.byAuthor[testCase.author] || 0) + 1;
            }

            // По владельцам
            if (testCase.owner) {
                statistics.byOwner[testCase.owner] = (statistics.byOwner[testCase.owner] || 0) + 1;
            }

            // По статусам
            if (testCase.status) {
                statistics.byStatus[testCase.status] = (statistics.byStatus[testCase.status] || 0) + 1;
            }

            // По типам тестов
            if (testCase.testType) {
                statistics.byTestType[testCase.testType] = (statistics.byTestType[testCase.testType] || 0) + 1;
            }

            // По эпикам
            if (testCase.epic) {
                statistics.byEpic[testCase.epic] = (statistics.byEpic[testCase.epic] || 0) + 1;
            }

            // По фичам
            if (testCase.feature) {
                statistics.byFeature[testCase.feature] = (statistics.byFeature[testCase.feature] || 0) + 1;
            }

            // По стори
            if (testCase.story) {
                statistics.byStory[testCase.story] = (statistics.byStory[testCase.story] || 0) + 1;
            }
        }

        this._statistics = statistics;
        this._onDidChangeStatistics.fire();
        return statistics;
    }

    public static getEmptyStatistics(): Statistics {
        return {
            total: 0,
            byAuthor: {},
            byOwner: {},
            byStatus: {},
            byTestType: {},
            byEpic: {},
            byFeature: {},
            byStory: {},
            testCases: []
        };
    }

    public static getStatistics(): Statistics | null {
        return this._statistics;
    }

    public static refresh(): void {
        this._statistics = null;
        this._onDidChangeStatistics.fire();
    }
}

