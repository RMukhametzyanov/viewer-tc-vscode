import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MarkdownTestCaseParser, MarkdownTestCase, MarkdownTestStep } from './markdownTestCaseParser';

/**
 * Получить текущую Git ветку
 */
async function getCurrentBranch(): Promise<string> {
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
 * Генерирует UUID для allure результатов
 */
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Преобразует статус шага в статус allure
 */
function mapStepStatusToAllure(status?: string): 'passed' | 'failed' | 'skipped' | 'broken' {
    if (!status) {
        return 'skipped';
    }
    const normalized = status.toLowerCase().trim();
    if (normalized === 'passed') {
        return 'passed';
    } else if (normalized === 'failed') {
        return 'failed';
    } else if (normalized === 'skipped') {
        return 'skipped';
    }
    return 'broken';
}

/**
 * Преобразует тест-кейс в формат allure result
 */
function convertTestCaseToAllureResult(
    testCase: MarkdownTestCase,
    filePath: string,
    startTime: number
): any {
    const testCaseId = testCase.metadata.id || generateUUID();
    const testName = testCase.title || 'Unnamed Test Case';
    const steps = testCase.steps || [];
    
    // Определяем общий статус тест-кейса
    let overallStatus: 'passed' | 'failed' | 'skipped' | 'broken' = 'passed';
    let statusMessage = '';
    const stepResults: any[] = [];
    
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepStatus = mapStepStatusToAllure(step.status);
        
        // Если хотя бы один шаг failed, весь тест failed
        if (stepStatus === 'failed') {
            overallStatus = 'failed';
            if (step.reason) {
                statusMessage = step.reason;
            }
        } else if (stepStatus === 'skipped' && overallStatus === 'passed') {
            overallStatus = 'skipped';
        } else if (stepStatus === 'broken' && overallStatus === 'passed') {
            overallStatus = 'broken';
        }
        
        // Создаем результат шага
        const stepStartTime = startTime + i * 1000;
        const stepStopTime = startTime + (i + 1) * 1000;
        
        const stepResult: any = {
            name: `Step ${step.stepNumber}: ${step.action || 'No action'}`,
            status: stepStatus,
            stage: 'finished',
            start: stepStartTime,
            stop: stepStopTime,
            steps: []
        };
        
        // Добавляем описание с ожидаемым результатом
        if (step.expectedResult) {
            stepResult.description = `Expected Result: ${step.expectedResult}`;
        }
        
        // Добавляем детали статуса для failed/skipped
        if ((step.status === 'failed' || step.status === 'skipped') && step.reason) {
            stepResult.statusDetails = {
                message: step.reason,
                trace: step.reason
            };
        }
        
        stepResults.push(stepResult);
    }
    
    // Если нет шагов, статус skipped
    if (steps.length === 0) {
        overallStatus = 'skipped';
    }
    
    // Формируем labels для allure
    const labels: any[] = [
        { name: 'suite', value: testCase.epicFeatureStory.epic || 'Default Suite' },
        { name: 'testClass', value: testCase.epicFeatureStory.feature || 'Default Feature' },
        { name: 'testMethod', value: testName }
    ];
    
    // Добавляем теги
    if (testCase.tags && testCase.tags.length > 0) {
        testCase.tags.forEach(tag => {
            labels.push({ name: 'tag', value: tag });
        });
    }
    
    // Добавляем owner
    if (testCase.metadata.owner) {
        labels.push({ name: 'owner', value: testCase.metadata.owner });
    }
    
    // Добавляем owner (исполнитель) как as_id
    if (testCase.metadata.owner) {
        labels.push({ name: 'as_id', value: testCase.metadata.owner });
    }
    
    // Добавляем test type
    if (testCase.metadata.testType) {
        labels.push({ name: 'testType', value: testCase.metadata.testType });
    }
    
    // Формируем allure result
    const allureResult: any = {
        uuid: generateUUID(),
        historyId: testCaseId,
        fullName: testName,
        labels: labels,
        links: [],
        name: testName,
        status: overallStatus,
        statusDetails: statusMessage ? {
            message: statusMessage,
            trace: statusMessage
        } : undefined,
        stage: 'finished',
        description: testCase.description || '',
        start: startTime,
        stop: startTime + steps.length * 1000,
        steps: stepResults,
        attachments: []
    };
    
    // Добавляем параметры из metadata
    const parameters: any[] = [];
    if (testCase.metadata.id) {
        parameters.push({
            name: 'ID',
            value: testCase.metadata.id
        });
    }
    if (testCase.metadata.status) {
        parameters.push({
            name: 'Status',
            value: testCase.metadata.status
        });
    }
    if (parameters.length > 0) {
        allureResult.parameters = parameters;
    }
    
    // Добавляем links
    if (testCase.links && testCase.links.length > 0) {
        testCase.links.forEach(link => {
            const linkMatch = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                allureResult.links.push({
                    name: linkMatch[1],
                    url: linkMatch[2],
                    type: 'tms'
                });
            } else {
                allureResult.links.push({
                    name: link,
                    url: link,
                    type: 'custom'
                });
            }
        });
    }
    
    return allureResult;
}

/**
 * Генерирует allure JSON файлы для всех тест-кейсов
 */
export async function generateAllureReport(): Promise<vscode.Uri | null> {
    try {
        // Определяем рабочую папку
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Не найдена рабочая папка');
            return null;
        }

        const workspaceFolder = workspaceFolders[0];
        const workspacePath = workspaceFolder.uri.fsPath;

        // Получаем текущую ветку Git
        const branch = await getCurrentBranch();

        // Создаем папку _releases в workspace
        const releasesDir = path.join(workspacePath, '_releases');
        if (!fs.existsSync(releasesDir)) {
            fs.mkdirSync(releasesDir, { recursive: true });
        }

        // Создаем подпапку с названием ветки
        const branchDir = path.join(releasesDir, branch);
        if (!fs.existsSync(branchDir)) {
            fs.mkdirSync(branchDir, { recursive: true });
        }

        // Получаем текущую дату в формате YYYY_mm_dd
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}_${month}_${day}`;

        // Создаем папку allure_YYYY_mm_dd
        const allureDir = path.join(branchDir, `allure_${dateStr}`);
        if (!fs.existsSync(allureDir)) {
            fs.mkdirSync(allureDir, { recursive: true });
        }

        // Загружаем все тест-кейсы
        const files = await vscode.workspace.findFiles('**/*.md');
        const testCases: { case: MarkdownTestCase; filePath: string }[] = [];

        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const contentStr = content.toString();
                const testCase = MarkdownTestCaseParser.parse(contentStr);
                
                // Проверяем, что это тест-кейс (есть заголовок или шаги)
                if (testCase.title || (testCase.steps && testCase.steps.length > 0)) {
                    testCases.push({
                        case: testCase,
                        filePath: file.fsPath
                    });
                }
            } catch (e) {
                // Пропустить невалидные MD файлы
                console.log(`Skipping file ${file.fsPath}: ${e}`);
            }
        }

        if (testCases.length === 0) {
            vscode.window.showWarningMessage('Не найдено тест-кейсов для генерации Allure отчета');
            return null;
        }

        // Генерируем JSON файлы для каждого тест-кейса
        const baseTime = Date.now();
        let fileIndex = 0;

        for (const { case: testCase, filePath } of testCases) {
            const allureResult = convertTestCaseToAllureResult(testCase, filePath, baseTime + fileIndex * 100);
            
            // Генерируем имя файла на основе UUID результата (стандартный формат Allure)
            const jsonFileName = `${allureResult.uuid}-result.json`;
            const jsonFilePath = path.join(allureDir, jsonFileName);
            
            // Записываем JSON файл
            fs.writeFileSync(jsonFilePath, JSON.stringify(allureResult, null, 2), 'utf-8');
            fileIndex++;
        }

        vscode.window.showInformationMessage(
            `Allure JSON файлы успешно сгенерированы: ${testCases.length} файлов в папке allure_${dateStr}`,
            'Открыть папку'
        ).then(selection => {
            if (selection === 'Открыть папку') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(allureDir));
            }
        });

        return vscode.Uri.file(allureDir);
    } catch (error) {
        vscode.window.showErrorMessage(`Ошибка при генерации Allure отчета: ${error}`);
        return null;
    }
}

