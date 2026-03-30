# API Документация

## Интерфейсы

### TestCase
Основной интерфейс тест-кейса.

```typescript
interface TestCase {
    id: string;                    // Уникальный идентификатор
    name: string;                  // Название тест-кейса
    description: string;           // Многострочное описание с метаданными
    preconditions: string;          // Предусловия
    expectedResult: string;        // Ожидаемый результат
    component: string;              // Компонент
    testLayer: string;             // Слой тестирования (E2E, Unit, etc.)
    severity: string;               // Серьезность (NORMAL, HIGH, etc.)
    priority: string;              // Приоритет (1, 2, 3, etc.)
    environment: string;          // Окружение
    browser: string;               // Браузер
    owner: string;                 // Владелец
    author: string;                // Автор
    reviewer: string;              // Ревьюер
    testCaseId: string;           // ID тест-кейса (дубликат id)
    issueLinks: string;            // Ссылки на issues
    testCaseLinks: string;        // Ссылки на другие тест-кейсы
    tags: string;                 // Теги
    status: string;               // Статус (Done, In Progress, To Do)
    testType: string;             // Тип теста (automated, manual)
    steps: TestStep[];            // Массив шагов тестирования
    createdAt?: number;           // Timestamp создания
    updatedAt?: number;           // Timestamp обновления
    notes?: any;                  // Заметки
}
```

### TestStep
Интерфейс шага тестирования.

```typescript
interface TestStep {
    id: string;                    // ID шага
    name: string;                  // Название шага
    description: string;          // Описание шага
    expectedResult: string;        // Ожидаемый результат
    status: string;               // Статус (skipped, passed, failed)
    bugLink: string;              // Ссылка на баг
    skipReason: string;           // Причина пропуска
    attachments: string;         // Вложения
}
```

### ParsedDescription
Результат парсинга поля `description`.

```typescript
interface ParsedDescription {
    project?: string;              // Проект
    testPlan?: string;             // Тест-план
    testSuite?: string;            // Тест-сьют
    priority?: string;             // Приоритет
    automationStatus?: string;     // Статус автоматизации
    statusChangeDate?: string;     // Дата изменения статуса
}
```

## Классы

### TestCaseSidebarProvider
Провайдер для sidebar панели.

```typescript
class TestCaseSidebarProvider implements vscode.WebviewViewProvider {
    static readonly viewType = 'testCaseViewer.sidebar';
    
    constructor(extensionUri: vscode.Uri);
    
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void;
    
    updateContent(): void;
}
```

**Методы:**

- `resolveWebviewView()` - вызывается VSCode при создании панели
- `updateContent()` - обновляет содержимое панели на основе активного редактора

### TestCaseRenderer
Статический класс для рендеринга HTML.

```typescript
class TestCaseRenderer {
    static parseDescription(description: string): ParsedDescription;
    static formatDate(dateString: string): string;
    static getStatusLabel(status: string): string;
    static escapeHtml(text: string): string;
    static renderSteps(steps: TestStep[]): string;
    static getErrorHtml(message: string): string;
    static render(testCase: TestCase): string;
}
```

**Методы:**

- `parseDescription(description: string)` - парсит строку описания
  - Возвращает: `ParsedDescription`
  - Извлекает: Проект, Тест-план, Тест-сьют, Приоритет, Статус автоматизации, Дата

- `formatDate(dateString: string)` - форматирует дату
  - Возвращает: отформатированную строку даты в формате ru-RU
  - Обрабатывает ISO даты

- `getStatusLabel(status: string)` - переводит статус на русский
  - Возвращает: локализованную строку статуса

- `escapeHtml(text: string)` - экранирует HTML символы
  - Возвращает: безопасную строку для вставки в HTML

- `renderSteps(steps: TestStep[])` - генерирует HTML для шагов
  - Возвращает: HTML строку с шагами тестирования

- `getErrorHtml(message: string)` - генерирует HTML для ошибки
  - Возвращает: HTML страницу с сообщением об ошибке

- `render(testCase: TestCase)` - генерирует полный HTML для тест-кейса
  - Возвращает: полную HTML страницу с отформатированным тест-кейсом

## События VSCode

Расширение подписывается на следующие события:

- `vscode.window.onDidChangeActiveTextEditor` - изменение активного редактора
- `vscode.workspace.onDidChangeTextDocument` - изменение содержимого документа

## CSS переменные VSCode

Используемые CSS переменные для темизации:

- `--vscode-font-family` - шрифт
- `--vscode-foreground` - основной цвет текста
- `--vscode-editor-background` - фон редактора
- `--vscode-descriptionForeground` - цвет описания
- `--vscode-textLink-foreground` - цвет ссылок
- `--vscode-panel-border` - цвет границ панели
- `--vscode-dropdown-background` - фон dropdown
- `--vscode-dropdown-foreground` - цвет текста dropdown
- `--vscode-dropdown-border` - граница dropdown
- `--vscode-editor-inactiveSelectionBackground` - фон неактивного выделения
- `--vscode-textBlockQuote-background` - фон цитаты
- `--vscode-textBlockQuote-border` - граница цитаты
- `--vscode-inputValidation-warningBackground` - фон предупреждения
- `--vscode-inputValidation-warningForeground` - цвет текста предупреждения
- `--vscode-inputValidation-infoBackground` - фон информации
- `--vscode-inputValidation-infoForeground` - цвет текста информации
- `--vscode-inputValidation-errorBackground` - фон ошибки
- `--vscode-inputValidation-errorForeground` - цвет текста ошибки

