# Руководство по разработке

## Локальный запуск

```bash
npm install
npm run compile
```

Для непрерывной компиляции:

```bash
npm run watch
```

Запуск расширения в dev-режиме:

1. Откройте проект в VS Code.
2. Нажмите `F5` (Extension Development Host).
3. В новом окне откройте markdown тест-кейс, например `example/example_md.md`.
4. Откройте activity bar контейнер `Test Case Viewer`.

## Актуальная структура

```text
src/
  extension.ts
  markdownTestCaseSidebarProvider.ts
  markdownTestCaseRenderer.ts
  markdownTestCaseParser.ts
  testCaseTreeViewProvider.ts
  testCaseRunnerProvider.ts
  testCaseStatisticsProvider.ts
```

## Основные сценарии разработки

### Изменение UI webview

- HTML/CSS/JS: `src/markdownTestCaseRenderer.ts`
- Взаимодействие с VS Code API и сохранение в файл: `src/markdownTestCaseSidebarProvider.ts`

### Изменение формата markdown

- Парсинг/сериализация: `src/markdownTestCaseParser.ts`
- После изменений формата нужно проверять совместимость с существующими `.md` файлами.

### Изменение дерева тест-кейсов

- Провайдер дерева: `src/testCaseTreeViewProvider.ts`
- Команды фильтрации/обновления/удаления регистрируются в `src/extension.ts`.

## Отладка

- Логи расширения: `Help -> Toggle Developer Tools` и Output/Debug Console.
- Логи webview: `Developer: Open Webview Developer Tools`.
- Если webview не обновляется, сначала проверьте обработчики `onDidChangeActiveTextEditor` и `onDidChangeTextDocument`.

## Базовый чек-лист перед PR

- `npm run compile` проходит без ошибок.
- Вручную проверены:
  - открытие `.md` тест-кейса;
  - редактирование в viewer и сохранение в файл;
  - дерево тест-кейсов и фильтры;
  - кнопки верхней панели (включая шторку).

