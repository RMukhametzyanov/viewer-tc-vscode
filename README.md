# Test Case Viewer

VS Code расширение для просмотра и редактирования тест-кейсов в формате **Markdown** (`.md`).

## Что умеет

- Viewer-панель в Activity Bar (webview) с редактированием полей тест-кейса
- Верхняя панель действий в формате "шторки" (развернуть/свернуть)
- Дерево тест-кейсов по папкам рабочей области
- Фильтры в дереве: `owner`, `reviewer`, `status`, `testType`, `tags`, статус комментариев
- Drag&Drop перемещение файлов/папок в дереве
- Вложения в `_attachment/` рядом с тест-кейсом
- Генерация HTML-отчета и Allure-отчета (через команды панели)

## Быстрый старт

### Пользователь (VSIX)

Подробно: `docs/USER_GUIDE.md`.

### Разработчик

```bash
npm install
npm run compile
```

Далее нажмите `F5` в VS Code и в окне Extension Development Host откройте `.md` тест-кейс.

## Упаковка VSIX

```bash
npm install -g @vscode/vsce
vsce package
```

## Документация

- `docs/README.md` - индекс документации
- `docs/USER_GUIDE.md` - руководство пользователя
- `docs/DEVELOPMENT.md` - разработка и отладка
- `docs/ARCHITECTURE.md` - архитектура и поток данных
- `docs/API.md` - ключевые команды, конфигурация и контракты

## Лицензия

MIT
