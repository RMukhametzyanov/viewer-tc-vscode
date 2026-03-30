# Документация Test Case Viewer

Актуальная документация по расширению (Markdown test-case viewer/editor для VS Code).

## Навигация

- [USER_GUIDE.md](./USER_GUIDE.md) - установка и работа пользователя
- [DEVELOPMENT.md](./DEVELOPMENT.md) - запуск проекта, разработка, отладка
- [ARCHITECTURE.md](./ARCHITECTURE.md) - архитектура, компоненты, поток данных
- [API.md](./API.md) - команды расширения, настройки, контракт Markdown

## Что важно знать

- Расширение работает с файлами `*.md` (не JSON).
- Основной UI - webview в боковой панели `markdownTestCaseViewer.sidebar`.
- Источник данных - активный markdown-документ в редакторе.
- Дерево тест-кейсов строится из markdown-файлов workspace.

