# API и контракты расширения

Этот документ описывает публичные точки интеграции проекта: команды, настройки и формат markdown.

## Команды VS Code

Основные команды (из `package.json` и `extension.ts`):

- `testCaseViewer.openSettings`
- `testCaseViewer.createNewTestCase`
- `testCaseViewer.createStandaloneHtml` (запуск прогона/раннера)
- `testCaseViewer.openTestCase`
- `testCaseViewer.refreshTree`
- `testCaseViewer.showFilters`
- `testCaseViewer.clearFilters`
- `testCaseViewer.deleteTestCase`
- `testCaseViewer.createFolder`
- `testCaseViewer.showStatistics`
- `testCaseViewer.generateReport`
- `testCaseViewer.generateAllure`

## Настройки

- `testCaseViewer.showStatusColumn: boolean`  
  Показывать/скрывать колонку статуса в таблице шагов.

## Webview message API

Webview (`markdownTestCaseRenderer.ts`) отправляет сообщения в провайдер (`markdownTestCaseSidebarProvider.ts`).

Ключевые команды сообщений:

- `updateField`
- `updateMetadata`
- `updateStep`
- `reorderSteps`
- `addStep`
- `deleteStep`
- `updateComment`
- `addComment`
- `openFile`
- `addAttachedDocument`
- `removeAttachedDocument`
- `selectFileToAttach`
- `handleDroppedFile`
- `removeLink`
- `openStatistics`
- `generateReport`
- `generateAllure`
- `refresh`

## Контракт markdown тест-кейса

Ожидается markdown с заголовком и секциями вида:

- `## Метаданные`
- `## Описание (description)`
- `## Предусловия (preconditions)`
- `## Шаги тестирования`
- дополнительные секции (`## Теги`, `## Вложения`, `## Комментарии`, `## Связи`)

Для попадания в дерево тест-кейсов файл обычно должен содержать:

- заголовок `# ...`
- шаги тестирования (`steps.length > 0` после парсинга)

## Основные типы (внутренние)

- `MarkdownTestCase` и связанные сущности - `src/markdownTestCaseParser.ts`
- Древовидные узлы `TestCaseNode` - `src/testCaseTreeViewProvider.ts`
- Типы для рендера/редактирования шагов и комментариев - `src/markdownTestCaseRenderer.ts`, `src/markdownTestCaseSidebarProvider.ts`

