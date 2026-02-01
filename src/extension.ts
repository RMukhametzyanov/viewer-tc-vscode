import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TestCaseSidebarProvider } from './testCaseSidebarProvider';
import { SettingsProvider } from './settingsProvider';

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
        prompt: 'Введите имя файла (без расширения .json)',
        placeHolder: 'Новый тест-кейс',
        value: 'Новый тест-кейс'
    });

    if (!fileName) {
        return;
    }

    // Generate IDs and timestamps
    const testCaseId = generateUUID();
    const stepId = generateUUID();
    const now = Date.now();

    // Create test case structure
    const testCase = {
        "id": testCaseId,
        "name": fileName,
        "description": "",
        "preconditions": "",
        "expectedResult": "",
        "epic": "",
        "feature": "",
        "story": "",
        "component": "",
        "testLayer": "E2E",
        "severity": "NORMAL",
        "priority": "MEDIUM",
        "environment": "",
        "browser": "",
        "owner": "",
        "author": "",
        "reviewer": "",
        "testCaseId": "",
        "issueLinks": "",
        "testCaseLinks": "",
        "tags": "",
        "status": "Draft",
        "testType": "Manual",
        "steps": [
            {
                "id": stepId,
                "name": "Шаг 1",
                "description": "",
                "expectedResult": "",
                "status": "pending",
                "bugLink": "",
                "skipReason": "",
                "attachments": ""
            }
        ],
        "createdAt": now,
        "updatedAt": now,
        "notes": {}
    };

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
    try {
        const content = JSON.stringify(testCase, null, 4);
        fs.writeFileSync(filePath, content, 'utf8');
        
        // Open the new file
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(document);
        
        vscode.window.showInformationMessage(`Тест-кейс "${fileName}.json" успешно создан`);
    } catch (error) {
        vscode.window.showErrorMessage(`Ошибка при создании файла: ${error}`);
    }
}

export async function activate(context: vscode.ExtensionContext) {
    // Initialize settings provider
    await SettingsProvider.initialize(context);
    
    // Register sidebar provider
    const sidebarProvider = new TestCaseSidebarProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TestCaseSidebarProvider.viewType,
            sidebarProvider
        )
    );

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
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.createNewTestCase', () => {
            createNewTestCase(context);
        })
    );
}

export function deactivate() {}
