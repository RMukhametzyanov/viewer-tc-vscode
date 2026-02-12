import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TestCaseSidebarProvider } from './testCaseSidebarProvider';
import { MarkdownTestCaseSidebarProvider } from './markdownTestCaseSidebarProvider';
import { SettingsProvider } from './settingsProvider';
import { TestCaseRunnerProvider } from './testCaseRunnerProvider';

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function createNewTestCase(context: vscode.ExtensionContext) {
    // Get the workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Откройте рабочую папку для создания тест-кейса');
        return;
    }

    // Ask for file name
    const fileName = await vscode.window.showInputBox({
        prompt: 'Введите имя файла (без расширения .md)',
        placeHolder: 'Новый тест-кейс',
        value: 'Новый тест-кейс'
    });

    if (!fileName) {
        return;
    }

    // Generate ID
    const testCaseId = generateUUID();

    // Create markdown test case structure
    const markdownContent = `# ${fileName}

## Метаданные
| Поле | Значение |
|------|----------|
| **ID** | ${testCaseId} |
| **Автор** | |
| **Исполнитель** | |
| **Статус** | Готов|
| **Тип теста** | Ручной|

## Связи

## Epic/Feature/Story
| Поле | Значение |
|------|----------|
| **Epic** | |
| **Feature** | |
| **Story** | |

## Теги (tags)

## Описание (description)

## Предусловия (preconditions)

## Шаги тестирования
| Шаг |  Действие  |           ОР          |Статус |
|-----|------------|-----------------------|-------|
| 1   |            |                       |       |

## Комментарии

| № |  Комментарий  |  Статус  |
|---|------------|------------|

`;

    // Determine file path
    let filePath: string;
    const activeEditor = vscode.window.activeTextEditor;
    
    if (activeEditor && activeEditor.document.uri.scheme === 'file') {
        // If there's an active file, create in the same directory
        const activeFilePath = activeEditor.document.uri.fsPath;
        const activeDir = path.dirname(activeFilePath);
        filePath = path.join(activeDir, `${fileName}.md`);
    } else {
        // Otherwise, create in the workspace root
        filePath = path.join(workspaceFolders[0].uri.fsPath, `${fileName}.md`);
    }

    // Check if file already exists
    if (fs.existsSync(filePath)) {
        const overwrite = await vscode.window.showWarningMessage(
            `Файл ${fileName}.md уже существует. Перезаписать?`,
            'Да',
            'Нет'
        );
        if (overwrite !== 'Да') {
            return;
        }
    }

    // Write file
    try {
        fs.writeFileSync(filePath, markdownContent, 'utf8');
        
        // Open the new file
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(document);
        
        vscode.window.showInformationMessage(`Тест-кейс "${fileName}.md" успешно создан`);
    } catch (error) {
        vscode.window.showErrorMessage(`Ошибка при создании файла: ${error}`);
    }
}

export async function activate(context: vscode.ExtensionContext) {
    // Initialize settings provider
    await SettingsProvider.initialize(context);
    
    // Register sidebar provider for JSON test cases
    const sidebarProvider = new TestCaseSidebarProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TestCaseSidebarProvider.viewType,
            sidebarProvider
        )
    );

    // Register sidebar provider for Markdown test cases
    const markdownSidebarProvider = new MarkdownTestCaseSidebarProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            MarkdownTestCaseSidebarProvider.viewType,
            markdownSidebarProvider
        )
    );

    // Initialize runner provider
    const runnerProvider = new TestCaseRunnerProvider();
    
    // Сохраняем провайдер для остановки сервера при деактивации
    context.subscriptions.push({
        dispose: () => {
            runnerProvider.stopLocalServer();
        }
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.openSettings', () => {
            SettingsProvider.openSettings(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.refresh', () => {
            // Trigger sidebar refresh
            sidebarProvider.updateContent();
            markdownSidebarProvider.updateContent();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.createNewTestCase', () => {
            createNewTestCase(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.createStandaloneHtml', () => {
            runnerProvider.createStandaloneHtml();
        })
    );
}

export function deactivate() {
    // Остановка локального сервера при деактивации расширения
    // runnerProvider будет доступен через контекст, если нужно
}
