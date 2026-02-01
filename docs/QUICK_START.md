# Быстрый старт для разработчиков

## Что это за проект?

**Test Case Viewer** - расширение VSCode, которое показывает тест-кейсы в JSON формате в удобной панели sidebar. Панель автоматически обновляется при переключении между файлами.

## Ключевые файлы (что где находится)

```
src/
├── extension.ts              ← Точка входа, регистрация провайдеров (20 строк)
├── testCaseSidebarProvider.ts ← Логика панели, отслеживание изменений (120 строк)
└── testCaseRenderer.ts       ← Генерация HTML из данных (400+ строк)
```

## Как это работает (в 3 шагах)

1. **Пользователь открывает JSON файл** → VSCode активирует расширение
2. **Sidebar Provider отслеживает активный редактор** → При переключении файла проверяет, тест-кейс ли это
3. **Renderer генерирует HTML** → Отображает в панели sidebar

## Основные компоненты

### 1. Extension (`extension.ts`)
- Регистрирует `TestCaseSidebarProvider`
- Всего ~10 строк кода

### 2. Sidebar Provider (`testCaseSidebarProvider.ts`)
- Создает webview панель
- Отслеживает `onDidChangeActiveTextEditor` и `onDidChangeTextDocument`
- Вызывает `updateContent()` при изменениях
- Проверяет наличие полей `id`, `name`, `steps` для определения тест-кейса

### 3. Renderer (`testCaseRenderer.ts`)
- Статический класс, без состояния
- `parseDescription()` - парсит строку описания
- `render()` - генерирует HTML
- Использует CSS переменные VSCode для темизации

## Формат данных

Тест-кейс должен иметь:
- `id: string`
- `name: string`
- `steps: TestStep[]` (массив)

Описание парсится из строки формата:
```
Проект: название (ID: id)
Тест-план: название (ID: id)
...
```

## Типичные задачи

### Добавить новое поле в отображение
1. Убедитесь, что поле есть в `TestCase` интерфейсе
2. Добавьте HTML в `TestCaseRenderer.render()`
3. Добавьте стили при необходимости

### Изменить парсинг описания
1. Обновите `TestCaseRenderer.parseDescription()`
2. Добавьте поле в `ParsedDescription`
3. Обновите отображение в `render()`

### Отладить проблему
1. Откройте Developer Tools для webview (Ctrl+Shift+P → "Developer: Open Webview Developer Tools")
2. Проверьте логи в консоли
3. Убедитесь, что JSON валидный и содержит нужные поля

## Команды

```bash
npm install      # Установка зависимостей
npm run compile  # Компиляция TypeScript
npm run watch    # Режим наблюдения (автокомпиляция)
```

## Запуск

1. Нажмите F5 в VSCode
2. Откроется новое окно "Extension Development Host"
3. Откройте JSON файл с тест-кейсом
4. Откройте панель "Test Case Viewer" в Activity Bar

## Полезные ссылки

- [ARCHITECTURE.md](./ARCHITECTURE.md) - детальная архитектура
- [DEVELOPMENT.md](./DEVELOPMENT.md) - полное руководство по разработке
- [API.md](./API.md) - все интерфейсы и методы

