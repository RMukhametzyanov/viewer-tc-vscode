# Архитектура проекта Test Case Viewer

## Обзор

Test Case Viewer - это расширение для Visual Studio Code, которое предоставляет удобный просмотр тест-кейсов в формате JSON через отдельную панель в sidebar.

## Основные компоненты

### 1. Extension Entry Point (`src/extension.ts`)
- Точка входа расширения
- Регистрирует `TestCaseSidebarProvider` как WebviewView provider
- Активируется при открытии JSON файлов

### 2. Sidebar Provider (`src/testCaseSidebarProvider.ts`)
- Реализует `vscode.WebviewViewProvider`
- Управляет жизненным циклом sidebar панели
- Отслеживает изменения активного редактора
- Автоматически обновляет содержимое при:
  - Переключении между файлами
  - Изменении содержимого JSON файла

**Ключевые методы:**
- `resolveWebviewView()` - создает и настраивает webview
- `updateContent()` - обновляет содержимое панели на основе активного редактора

### 3. Renderer (`src/testCaseRenderer.ts`)
- Статический класс для рендеринга HTML
- Парсит описание тест-кейса (извлекает проект, тест-план, тест-сьют)
- Форматирует даты
- Генерирует HTML с CSS стилями VSCode

**Ключевые методы:**
- `parseDescription()` - парсит строку описания на компоненты
- `render()` - генерирует HTML для отображения тест-кейса
- `renderSteps()` - генерирует HTML для шагов тестирования
- `getErrorHtml()` - генерирует HTML для ошибок

### 4. Legacy компоненты (не используются)
- `src/testCaseEditor.ts` - Custom Editor (не используется в текущей версии)
- `src/testCasePreview.ts` - Webview Panel provider (не используется в текущей версии)

## Поток данных

```
1. Пользователь открывает JSON файл с тест-кейсом
   ↓
2. VSCode активирует расширение (onLanguage:json)
   ↓
3. Extension регистрирует Sidebar Provider
   ↓
4. Sidebar Provider отслеживает активный редактор
   ↓
5. При изменении активного редактора:
   - Проверяет, является ли файл тест-кейсом (id, name, steps)
   - Парсит JSON
   - Вызывает TestCaseRenderer.render()
   - Обновляет HTML в webview
```

## Структура данных тест-кейса

```typescript
interface TestCase {
    id: string;
    name: string;
    description: string;  // Многострочный текст с метаданными
    status: string;
    testType: string;
    priority: string;
    severity: string;
    testLayer: string;
    owner: string;
    author: string;
    reviewer: string;
    steps: TestStep[];
    // ... другие поля
}

interface TestStep {
    id: string;
    name: string;
    description: string;
    expectedResult: string;
    status: string;
    skipReason?: string;
    // ... другие поля
}
```

## Парсинг описания

Описание тест-кейса содержит структурированную информацию в формате:
```
Проект: <название> (ID: <id>)
Тест-план: <название> (ID: <id>)
Тест-сьют: <название> (ID: <id>)
Приоритет: <значение>
Статус автоматизации: <статус>
Дата изменения статуса: <дата>
```

`TestCaseRenderer.parseDescription()` извлекает эти данные в объект `ParsedDescription`.

## UI/UX

- Панель находится в отдельном контейнере в Activity Bar
- Использует CSS переменные VSCode для темизации
- Автоматически адаптируется к темной/светлой теме
- Поддерживает скроллинг для длинного контента
- Показывает пустое состояние, когда нет открытого тест-кейса

## Конфигурация (package.json)

- **viewsContainers**: Создает новый контейнер в Activity Bar
- **views**: Регистрирует webview панель в контейнере
- **activationEvents**: Активируется при открытии JSON файлов

