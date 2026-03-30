# Архитектура проекта Test Case Viewer

## Обзор

Расширение визуализирует и редактирует тест-кейсы в формате Markdown через webview в боковой панели VS Code.

## Ключевые компоненты

### `src/extension.ts`

- Точка входа расширения
- Регистрация провайдеров и команд
- Активация на `onLanguage:markdown`

### `src/markdownTestCaseSidebarProvider.ts`

- Реализует `vscode.WebviewViewProvider` для `markdownTestCaseViewer.sidebar`
- Слушает:
  - `onDidChangeActiveTextEditor`
  - `onDidChangeTextDocument`
  - `onDidChangeVisibility` webview
- Читает активный `.md`, парсит его и обновляет HTML webview
- Обрабатывает сообщения из webview (изменение полей, шагов, комментариев, вложений, запуск команд)

### `src/markdownTestCaseRenderer.ts`

- Генерация HTML/CSS/JS интерфейса webview
- Рендер секций тест-кейса (метаданные, шаги, теги, комментарии, вложения)
- Верхняя панель действий со шторкой (expand/collapse)
- Локальное состояние UI (например, `showStatusColumn`, состояние шторки)

### `src/markdownTestCaseParser.ts`

- Парсинг markdown-документа в структуру данных
- Обратная сериализация структуры обратно в markdown

### `src/testCaseTreeViewProvider.ts`

- Построение дерева тест-кейсов из `*.md` workspace
- Фильтрация, drag&drop перемещение, контекстные команды

## Поток данных

1. Пользователь открывает markdown-файл.
2. Sidebar provider парсит содержимое через parser.
3. Renderer строит webview HTML.
4. Пользователь редактирует данные в webview.
5. Webview отправляет message в provider.
6. Provider обновляет markdown через parser+serialize и сохраняет файл.
7. При сохранении/изменении UI синхронизируется повторным `updateContent()`.

## Хранение состояния

- Часть состояния хранится в `globalState` расширения (например, collapse секций).
- Часть состояния хранится в `localStorage` webview (видимость колонок, состояние шторки).

## Внешние точки интеграции

- Команды VS Code (`vscode.commands.executeCommand`)
- Файловая система workspace (`vscode.workspace.fs`, `fs`)
- Опциональная генерация отчетов (HTML/Allure) через соответствующие провайдеры/команды

