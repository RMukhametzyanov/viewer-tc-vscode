# Документация проекта Test Case Viewer

## Навигация по документации

- **[QUICK_START.md](./QUICK_START.md)** ⚡ - Быстрый старт для разработчиков (начните отсюда!)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура проекта, компоненты, поток данных
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Руководство по разработке, отладка, тестирование
- [API.md](./API.md) - API документация, интерфейсы, методы
- [CONTINUE_INSTALLATION.md](./CONTINUE_INSTALLATION.md) - Подключение локального LLM к Continue

## Краткое описание проекта

**Test Case Viewer** - расширение для VSCode, которое отображает тест-кейсы в формате JSON в удобном читаемом виде через отдельную панель в sidebar.

### Основные возможности

- ✅ Отдельная панель в Activity Bar
- ✅ Автоматическое отображение активного тест-кейса
- ✅ Автоматическое обновление при изменении файла
- ✅ Парсинг структурированного описания
- ✅ Отображение шагов тестирования
- ✅ Поддержка темной и светлой темы VSCode

### Технологии

- TypeScript
- VSCode Extension API
- Webview API

### Структура проекта

```
src/
├── extension.ts              # Точка входа
├── testCaseSidebarProvider.ts # Провайдер панели
└── testCaseRenderer.ts        # Рендеринг HTML
```

### Быстрый старт

```bash
npm install
npm run compile
# Нажмите F5 в VSCode для запуска
```

### Формат тест-кейса

Расширение ожидает JSON файлы со следующей структурой:

```json
{
    "id": "278512",
    "name": "Название тест-кейса",
    "description": "Проект: ...\nТест-план: ...\nТест-сьют: ...",
    "status": "Done",
    "testType": "automated",
    "steps": [...]
}
```

### Как работает

1. Пользователь открывает JSON файл с тест-кейсом
2. Расширение активируется (onLanguage:json)
3. Sidebar Provider отслеживает активный редактор
4. При обнаружении тест-кейса (проверка полей id, name, steps) отображает его в панели
5. При изменении файла панель автоматически обновляется

### Основные компоненты

1. **Extension** - регистрация провайдеров
2. **Sidebar Provider** - управление панелью, отслеживание изменений
3. **Renderer** - генерация HTML из данных тест-кейса

### Полезные ссылки

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)

