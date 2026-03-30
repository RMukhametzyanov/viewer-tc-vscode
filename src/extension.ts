import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MarkdownTestCaseSidebarProvider } from './markdownTestCaseSidebarProvider';
import { SettingsProvider } from './settingsProvider';
import { TestCaseRunnerProvider } from './testCaseRunnerProvider';
import { TestCaseTreeViewProvider, TestCaseTreeItem } from './testCaseTreeViewProvider';
import { TestCaseStatisticsPanel } from './testCaseStatisticsPanel';
import { generateHtmlReport } from './htmlReportGenerator';
import { generateAllureReport } from './allureReportGenerator';

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function createNewTestCase(context: vscode.ExtensionContext, folderPath?: string): Promise<string | undefined> {
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
    
    if (folderPath) {
        // Если указан путь папки из дерева, создаем там
        const workspacePath = workspaceFolders[0].uri.fsPath;
        filePath = path.join(workspacePath, folderPath, `${fileName}.md`);
    } else {
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
        // Создаем директорию, если она не существует
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, markdownContent, 'utf8');
        
        // Open the new file
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(document);
        
        vscode.window.showInformationMessage(`Тест-кейс "${fileName}.md" успешно создан`);
        
        // Возвращаем путь к созданному файлу
        return filePath;
    } catch (error) {
        vscode.window.showErrorMessage(`Ошибка при создании файла: ${error}`);
        return undefined;
    }
}

export async function activate(context: vscode.ExtensionContext) {
    // Initialize settings provider
    await SettingsProvider.initialize(context);
    
    // Register sidebar provider for Markdown test cases
    const markdownSidebarProvider = new MarkdownTestCaseSidebarProvider(context.extensionUri, context);
    
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
            markdownSidebarProvider.updateContent();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.createStandaloneHtml', () => {
            runnerProvider.createStandaloneHtml();
        })
    );

    // Register tree view provider with drag and drop support
    const treeViewProvider = new TestCaseTreeViewProvider(context.extensionUri);
    const treeView = vscode.window.createTreeView('testCaseViewer.tree', {
        treeDataProvider: treeViewProvider,
        dragAndDropController: treeViewProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);
    
    // Подписываемся на изменения фильтров для обновления заголовка
    context.subscriptions.push(
        treeViewProvider.onDidChangeFilters(() => {
            updateTreeViewTitle(treeView, treeViewProvider);
        })
    );
    
    // Инициализируем заголовок при старте
    updateTreeViewTitle(treeView, treeViewProvider);
    
    // Сохраняем ссылку на treeView для доступа к выбранным элементам
    const treeViewRef = treeView;
    
    // Функция для поиска и фокусировки на файле в дереве
    async function revealFileInTree(filePath: string): Promise<void> {
        // Находим элемент в дереве по пути к файлу
        const findItem = async (items: TestCaseTreeItem[]): Promise<TestCaseTreeItem | undefined> => {
            for (const item of items) {
                if (item.node.type === 'testcase' && item.node.filePath === filePath) {
                    return item;
                }
                if (item.node.type === 'folder' && item.node.children.length > 0) {
                    // Раскрываем папку, чтобы получить дочерние элементы
                    const children = await treeViewProvider.getChildren(item);
                    const found = await findItem(children);
                    if (found) {
                        return found;
                    }
                }
            }
            return undefined;
        };
        
        // Получаем корневые элементы
        const rootItems = await treeViewProvider.getChildren(undefined);
        const foundItem = await findItem(rootItems);
        
        if (foundItem) {
            // Раскрываем родительские папки и фокусируемся на элементе
            await treeView.reveal(foundItem, { select: true, focus: true, expand: 2 });
        }
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.createNewTestCase', async (item?: TestCaseTreeItem) => {
            let folderPath: string | undefined;
            if (item && item.node.type === 'folder') {
                folderPath = item.node.path;
            } else if (item && item.node.type === 'testcase' && item.node.relativePath) {
                // Если выбран тест-кейс, создаем в той же папке
                const pathParts = item.node.relativePath.split(/[/\\]/);
                if (pathParts.length > 1) {
                    pathParts.pop(); // Убираем имя файла
                    folderPath = pathParts.join('/');
                }
            }
            const createdFilePath = await createNewTestCase(context, folderPath);
            
            if (createdFilePath) {
                // Обновляем дерево
                treeViewProvider.refresh();
                
                // Ждем немного, чтобы дерево обновилось, затем находим и фокусируемся на новом файле
                setTimeout(async () => {
                    await revealFileInTree(createdFilePath);
                }, 300);
            }
        })
    );

    // Register tree view commands
    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.openTestCase', (filePath: string) => {
            if (filePath) {
                vscode.workspace.openTextDocument(vscode.Uri.file(filePath)).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.refreshTree', () => {
            treeViewProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.showFilters', () => {
            showFiltersPanel(context, treeViewProvider, treeView);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.clearFilters', async () => {
            treeViewProvider.clearFilters();
            updateTreeViewTitle(treeView, treeViewProvider);
            // Принудительно обновляем дерево через команду обновления
            await vscode.commands.executeCommand('testCaseViewer.refreshTree');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.deleteTestCase', async (item?: TestCaseTreeItem) => {
            // Если команда вызвана через горячую клавишу, получаем выбранный элемент из tree view
            if (!item) {
                const selection = treeViewRef.selection;
                if (selection && selection.length > 0) {
                    item = selection[0];
                } else {
                    return;
                }
            }
            
            if (!item) {
                return;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return;
            }

            let itemName: string;
            let itemPath: string;
            let isFolder = false;

            if (item.node.type === 'testcase' && item.node.filePath) {
                // Удаление файла
                itemName = path.basename(item.node.filePath);
                itemPath = item.node.filePath;
            } else if (item.node.type === 'folder') {
                // Удаление папки
                isFolder = true;
                itemName = item.node.name;
                const workspacePath = workspaceFolders[0].uri.fsPath;
                itemPath = path.join(workspacePath, item.node.path);
            } else {
                return;
            }

            const confirmMessage = isFolder 
                ? `Вы уверены, что хотите удалить папку "${itemName}" и все её содержимое?`
                : `Вы уверены, что хотите удалить файл "${itemName}"?`;
            
            const confirm = await vscode.window.showWarningMessage(
                confirmMessage,
                { modal: true },
                'Да',
                'Нет'
            );

            if (confirm === 'Да') {
                try {
                    const uri = vscode.Uri.file(itemPath);
                    const stat = await vscode.workspace.fs.stat(uri);
                    
                    if (stat.type === vscode.FileType.Directory) {
                        // Удаление папки рекурсивно
                        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
                        vscode.window.showInformationMessage(`Папка "${itemName}" успешно удалена`);
                    } else {
                        // Удаление файла
                        await vscode.workspace.fs.delete(uri, { useTrash: true });
                        vscode.window.showInformationMessage(`Файл "${itemName}" успешно удален`);
                    }
                    treeViewProvider.refresh();
                } catch (error) {
                    vscode.window.showErrorMessage(`Ошибка при удалении: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.showStatistics', () => {
            TestCaseStatisticsPanel.createOrShow(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.openSidebar', async () => {
            // Открываем боковую панель вьювера
            // Используем команду для открытия view контейнера
            try {
                await vscode.commands.executeCommand('workbench.view.extension.testCaseViewer');
            } catch (error) {
                // Если команда не работает, пробуем альтернативный способ
                await vscode.commands.executeCommand('workbench.view.testCaseViewer');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.generateReport', async () => {
            try {
                // Получаем текущую ветку Git
                const workspaceFolders = vscode.workspace.workspaceFolders;
                let branch = 'unknown';
                
                if (workspaceFolders && workspaceFolders.length > 0) {
                    try {
                        const gitExtension = vscode.extensions.getExtension('vscode.git');
                        if (gitExtension && gitExtension.isActive) {
                            const git = gitExtension.exports.getAPI(1);
                            const repository = git.getRepository(workspaceFolders[0].uri);
                            if (repository) {
                                branch = repository.state.HEAD?.name || 'unknown';
                            }
                        }
                    } catch (e) {
                        // Fallback к команде git
                        try {
                            const { execSync } = require('child_process');
                            branch = execSync('git branch --show-current', { 
                                cwd: workspaceFolders[0].uri.fsPath,
                                encoding: 'utf8'
                            }).trim() || 'unknown';
                        } catch (e) {
                            branch = 'unknown';
                        }
                    }
                }
                
                // Показываем модальное окно с подтверждением (принудительно открывается)
                const confirmed = await vscode.window.showWarningMessage(
                    `Сгенерировать отчет о прогоне на ветке: ${branch}?`,
                    { modal: true },
                    'Да',
                    'Нет'
                );
                
                if (confirmed !== 'Да') {
                    return; // Пользователь отменил
                }
                
                // Получаем название проекта из настроек (если есть)
                const config = vscode.workspace.getConfiguration('testCaseViewer');
                const projectName = config.get<string>('projectName', '');
                
                // Показываем индикатор прогресса
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Генерация отчета о прогоне',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Загрузка тест-кейсов...' });
                    
                    const reportDir = await generateHtmlReport(undefined, projectName);
                    
                    if (reportDir) {
                        progress.report({ increment: 100, message: 'Отчет сгенерирован' });
                        
                        vscode.window.showInformationMessage(
                            `HTML отчет успешно сгенерирован в папке: ${path.basename(reportDir.fsPath)}`,
                            'Открыть папку'
                        ).then(selection => {
                            if (selection === 'Открыть папку') {
                                vscode.commands.executeCommand('revealFileInOS', reportDir);
                            }
                        });
                    } else {
                        vscode.window.showErrorMessage('Не удалось сгенерировать отчет');
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка при генерации отчета: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.generateAllure', async () => {
            try {
                // Показываем индикатор прогресса
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Генерация Allure отчета',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Загрузка тест-кейсов...' });
                    
                    const allureDir = await generateAllureReport();
                    
                    if (allureDir) {
                        progress.report({ increment: 100, message: 'Allure JSON файлы сгенерированы' });
                    } else {
                        vscode.window.showErrorMessage('Не удалось сгенерировать Allure отчет');
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка при генерации Allure отчета: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('testCaseViewer.createFolder', async (item?: TestCaseTreeItem) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('Откройте рабочую папку для создания папки');
                return;
            }

            // Определяем путь, где создавать папку
            let targetPath: string;
            if (item && item.node.type === 'folder') {
                // Если выбрана папка, создаем внутри неё
                const workspacePath = workspaceFolders[0].uri.fsPath;
                targetPath = path.join(workspacePath, item.node.path);
            } else if (item && item.node.type === 'testcase' && item.node.relativePath) {
                // Если выбран файл, создаем в той же папке
                const workspacePath = workspaceFolders[0].uri.fsPath;
                const pathParts = item.node.relativePath.split(/[/\\]/);
                pathParts.pop(); // Убираем имя файла
                if (pathParts.length > 0) {
                    targetPath = path.join(workspacePath, ...pathParts);
                } else {
                    targetPath = workspacePath;
                }
            } else {
                // Создаем в корне проекта
                targetPath = workspaceFolders[0].uri.fsPath;
            }

            // Запрашиваем имя папки
            const folderName = await vscode.window.showInputBox({
                prompt: 'Введите имя папки',
                placeHolder: 'Новая папка',
                value: 'Новая папка',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Имя папки не может быть пустым';
                    }
                    // Проверяем на недопустимые символы
                    const invalidChars = /[<>:"/\\|?*]/;
                    if (invalidChars.test(value)) {
                        return 'Имя папки содержит недопустимые символы';
                    }
                    return null;
                }
            });

            if (!folderName) {
                return;
            }

            const newFolderPath = path.join(targetPath, folderName);

            // Проверяем, существует ли уже такая папка
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(newFolderPath));
                vscode.window.showErrorMessage(`Папка "${folderName}" уже существует`);
                return;
            } catch {
                // Папка не существует, можно создавать
            }

            try {
                // Создаем папку
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(newFolderPath));
                vscode.window.showInformationMessage(`Папка "${folderName}" успешно создана`);
                treeViewProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка при создании папки: ${error}`);
            }
        })
    );
}

function escapeHtml(text: string): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Функция для обновления заголовка дерева с индикатором фильтров
// В VS Code нет прямого API для изменения title дерева после создания,
// но мы можем использовать эту функцию для логирования или других целей
function updateTreeViewTitle(treeView: vscode.TreeView<TestCaseTreeItem>, treeProvider: TestCaseTreeViewProvider): void {
    const filters = treeProvider.getFilters();
    const activeFiltersCount = Object.values(filters).filter(v => v).length;
    
    // В VS Code нет прямого способа изменить title дерева после создания,
    // но можно использовать эту функцию для других целей (например, логирование)
    // Индикатор фильтров будет показываться в QuickPick и в сообщениях
}

async function showQuickPickFilters(treeProvider: TestCaseTreeViewProvider, treeView: vscode.TreeView<TestCaseTreeItem>): Promise<void> {
    const fieldLabels: { [key: string]: string } = {
        owner: 'Владелец',
        reviewer: 'Ревьювер',
        testType: 'Тип теста',
        status: 'Статус',
        tags: 'Теги'
    };
    
    // Цикл для настройки нескольких фильтров подряд
    while (true) {
        const currentFilters = treeProvider.getFilters();
        const activeFiltersCount = Object.values(currentFilters).filter(v => v).length;
        
        // Создаем список опций для выбора поля
        const fieldOptions: vscode.QuickPickItem[] = Object.keys(fieldLabels).map(key => {
            const currentValue = currentFilters[key as keyof typeof currentFilters];
            const label = currentValue 
                ? `$(filter) ${fieldLabels[key]}: ${currentValue}` 
                : fieldLabels[key];
            return {
                label: label,
                description: currentValue ? 'Текущий фильтр' : '',
                detail: currentValue ? `Нажмите для изменения или удаления` : 'Нажмите для выбора значения',
                picked: !!currentValue
            };
        });
        
        // Добавляем разделитель
        fieldOptions.push(
            { 
                label: '',
                kind: vscode.QuickPickItemKind.Separator
            }
        );
        
        // Добавляем специальные опции
        fieldOptions.push(
            { 
                label: '$(clear-all) Сбросить все фильтры', 
                description: activeFiltersCount > 0 ? `Активных фильтров: ${activeFiltersCount}` : 'Нет активных фильтров',
                detail: activeFiltersCount > 0 ? 'Удалить все примененные фильтры' : ''
            },
            { 
                label: '$(info) Показать активные фильтры', 
                description: activeFiltersCount > 0 ? Object.entries(currentFilters)
                    .filter(([_, v]) => v)
                    .map(([k, v]) => `${fieldLabels[k]}: ${v}`)
                    .join(', ') : 'Нет активных фильтров'
            },
            { 
                label: '$(check) Готово', 
                description: activeFiltersCount > 0 ? `Применить ${activeFiltersCount} фильтр(ов) и закрыть` : 'Закрыть без фильтров',
                detail: 'Завершить настройку фильтров'
            }
        );
        
        const selectedField = await vscode.window.showQuickPick(fieldOptions, {
            placeHolder: activeFiltersCount > 0 
                ? `Выберите поле для фильтрации (активных: ${activeFiltersCount})`
                : 'Выберите поле для фильтрации',
            ignoreFocusOut: true
        });
        
        if (!selectedField) {
            // Пользователь нажал Escape - закрываем окно
            return;
        }
        
        // Проверяем, выбрана ли опция "Готово"
        if (selectedField.label.includes('Готово')) {
            // Применяем фильтры и закрываем
            treeProvider.setFilters(currentFilters);
            updateTreeViewTitle(treeView, treeProvider);
            await vscode.commands.executeCommand('testCaseViewer.refreshTree');
            return;
        }
    
        // Обработка специальных опций
        if (selectedField.label.includes('Сбросить все фильтры')) {
            // Очищаем фильтры
            treeProvider.clearFilters();
            updateTreeViewTitle(treeView, treeProvider);
            
            // Небольшая задержка для гарантии обновления
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Принудительно обновляем дерево - используем несколько способов для надежности
            treeProvider.refresh();
            // Также вызываем команду обновления
            await vscode.commands.executeCommand('testCaseViewer.refreshTree');
            
            // Проверяем, что фильтры действительно очищены
            const filtersAfterClear = treeProvider.getFilters();
            const stillActive = Object.values(filtersAfterClear).filter(v => v).length;
            
            if (stillActive === 0) {
                vscode.window.showInformationMessage('Все фильтры сброшены');
            } else {
                vscode.window.showWarningMessage(`Фильтры не были полностью сброшены. Осталось активных: ${stillActive}`);
            }
            // Продолжаем цикл, чтобы пользователь мог настроить новые фильтры
            continue;
        }
        
        if (selectedField.label.includes('Показать активные фильтры')) {
            if (activeFiltersCount === 0) {
                vscode.window.showInformationMessage('Нет активных фильтров');
            } else {
                const filtersList = Object.entries(currentFilters)
                    .filter(([_, v]) => v)
                    .map(([k, v]) => `${fieldLabels[k]}: ${v}`)
                    .join('\n');
                vscode.window.showInformationMessage(`Активные фильтры:\n${filtersList}`);
            }
            // Продолжаем цикл, чтобы пользователь мог настроить фильтры
            continue;
        }
    
        // Определяем выбранное поле
        const selectedFieldKey = Object.keys(fieldLabels).find(key => 
            selectedField.label.includes(fieldLabels[key]) && !selectedField.label.includes('Сбросить') && !selectedField.label.includes('Показать') && !selectedField.label.includes('Готово')
        );
        
        if (!selectedFieldKey) {
            // Если не нашли поле, продолжаем цикл
            continue;
        }
        
        // Получаем уникальные значения для выбранного поля
        let values: string[] = [];
        if (selectedFieldKey === 'tags') {
            values = await treeProvider.getUniqueTags();
        } else {
            // Используем тип из фильтров провайдера
            type FilterKey = 'owner' | 'reviewer' | 'testType' | 'status';
            values = await treeProvider.getUniqueValues(selectedFieldKey as FilterKey);
        }
        
        if (values.length === 0) {
            vscode.window.showWarningMessage(`Нет доступных значений для поля "${fieldLabels[selectedFieldKey]}"`);
            // Продолжаем цикл, чтобы пользователь мог выбрать другое поле
            continue;
        }
        
        // Создаем опции для выбора значения
        const valueOptions: vscode.QuickPickItem[] = [
            {
                label: '$(clear) Убрать фильтр',
                description: currentFilters[selectedFieldKey as keyof typeof currentFilters] 
                    ? `Текущее значение: ${currentFilters[selectedFieldKey as keyof typeof currentFilters]}`
                    : '',
                detail: 'Удалить фильтр по этому полю'
            },
            ...values.map(value => ({
                label: value,
                description: value === currentFilters[selectedFieldKey as keyof typeof currentFilters] ? 'Текущее значение' : '',
                picked: value === currentFilters[selectedFieldKey as keyof typeof currentFilters]
            }))
        ];
        
        const selectedValue = await vscode.window.showQuickPick(valueOptions, {
            placeHolder: `Выберите значение для "${fieldLabels[selectedFieldKey]}"`,
            ignoreFocusOut: true
        });
        
        if (!selectedValue) {
            // Пользователь отменил выбор значения - возвращаемся к выбору поля
            continue;
        }
        
        // Применяем фильтр (но не обновляем дерево сразу, только в конце)
        const newFilters = { ...currentFilters };
        
        if (selectedValue.label.includes('Убрать фильтр')) {
            delete newFilters[selectedFieldKey as keyof typeof newFilters];
        } else {
            newFilters[selectedFieldKey as keyof typeof newFilters] = selectedValue.label;
        }
        
        // Сохраняем фильтры временно (без обновления дерева)
        treeProvider.setFilters(newFilters);
        updateTreeViewTitle(treeView, treeProvider);
        
        // Показываем краткое сообщение о применении фильтра
        const activeCount = Object.values(newFilters).filter(v => v).length;
        // Не показываем сообщение каждый раз, чтобы не мешать пользователю
        // vscode.window.showInformationMessage(`Фильтр "${fieldLabels[selectedFieldKey]}" применен (всего: ${activeCount})`);
        
        // Продолжаем цикл, чтобы пользователь мог настроить еще фильтры
        // Дерево обновится автоматически при выходе из цикла (когда выберут "Готово")
    }
}

// Старая функция (оставляем для обратной совместимости, но не используем)
async function showFiltersPanel(context: vscode.ExtensionContext, treeProvider: TestCaseTreeViewProvider, treeView: vscode.TreeView<TestCaseTreeItem>) {
    const panel = vscode.window.createWebviewPanel(
        'testCaseFilters',
        'Фильтры дерева объектов',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Получаем текущие фильтры
    const currentFilters = treeProvider.getFilters();

    // Получаем уникальные значения для фильтров
    const owners = await treeProvider.getUniqueValues('owner');
    const testTypes = await treeProvider.getUniqueValues('testType');
    const statuses = await treeProvider.getUniqueValues('status');
    const tags = await treeProvider.getUniqueTags();

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Фильтры</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .filter-group {
            margin-bottom: 16px;
        }
        .filter-label {
            display: block;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
            text-transform: uppercase;
        }
        .filter-select {
            width: 100%;
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 6px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            cursor: pointer;
        }
        .filter-select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        .filter-reset-btn {
            width: 100%;
            margin-top: 16px;
            padding: 8px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 2px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        }
        .filter-reset-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="filter-group">
        <label class="filter-label">Исполнитель:</label>
        <select class="filter-select" id="filter-owner">
            <option value="">Все</option>
            ${owners.map(o => `<option value="${escapeHtml(o)}" ${currentFilters.owner === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
        </select>
    </div>
    <div class="filter-group">
        <label class="filter-label">Тип теста:</label>
        <select class="filter-select" id="filter-test-type">
            <option value="">Все</option>
            ${testTypes.map(t => `<option value="${escapeHtml(t)}" ${currentFilters.testType === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
        </select>
    </div>
    <div class="filter-group">
        <label class="filter-label">Статус:</label>
        <select class="filter-select" id="filter-status">
            <option value="">Все</option>
            ${statuses.map(s => `<option value="${escapeHtml(s)}" ${currentFilters.status === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
    </div>
    <div class="filter-group">
        <label class="filter-label">Теги:</label>
        <select class="filter-select" id="filter-tags">
            <option value="">Все</option>
            ${tags.map(t => `<option value="${escapeHtml(t)}" ${currentFilters.tags === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
        </select>
    </div>
    <div class="filter-group">
        <label class="filter-label">Статус комментариев:</label>
        <select class="filter-select" id="filter-comment-status">
            <option value="">Все</option>
            <option value="OPEN" ${currentFilters.commentStatus === 'OPEN' ? 'selected' : ''}>OPEN</option>
            <option value="CLOSED" ${currentFilters.commentStatus === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
            <option value="FIXED" ${currentFilters.commentStatus === 'FIXED' ? 'selected' : ''}>FIXED</option>
        </select>
    </div>
    <button class="filter-reset-btn" id="filter-reset-btn">Сбросить фильтры</button>
    <script>
        const vscode = acquireVsCodeApi();
        
        const ownerSelect = document.getElementById('filter-owner');
        const testTypeSelect = document.getElementById('filter-test-type');
        const statusSelect = document.getElementById('filter-status');
        const tagsSelect = document.getElementById('filter-tags');
        const commentStatusSelect = document.getElementById('filter-comment-status');
        const resetBtn = document.getElementById('filter-reset-btn');
        
        function applyFilters() {
            const filters = {
                owner: ownerSelect.value || undefined,
                testType: testTypeSelect.value || undefined,
                status: statusSelect.value || undefined,
                tags: tagsSelect.value || undefined,
                commentStatus: commentStatusSelect.value || undefined
            };
            
            vscode.postMessage({
                command: 'applyFilters',
                filters: filters
            });
        }
        
        ownerSelect.addEventListener('change', applyFilters);
        testTypeSelect.addEventListener('change', applyFilters);
        statusSelect.addEventListener('change', applyFilters);
        tagsSelect.addEventListener('change', applyFilters);
        commentStatusSelect.addEventListener('change', applyFilters);
        
        resetBtn.addEventListener('click', () => {
            ownerSelect.value = '';
            testTypeSelect.value = '';
            statusSelect.value = '';
            tagsSelect.value = '';
            commentStatusSelect.value = '';
            applyFilters();
        });
    </script>
</body>
</html>`;

    panel.webview.html = html;

    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'applyFilters') {
            treeProvider.setFilters(message.filters);
            updateTreeViewTitle(treeView, treeProvider);
            await vscode.commands.executeCommand('testCaseViewer.refreshTree');
        }
    });
}

export function deactivate() {
    // Остановка локального сервера при деактивации расширения
    // runnerProvider будет доступен через контекст, если нужно
}
