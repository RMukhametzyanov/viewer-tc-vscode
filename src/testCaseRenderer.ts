interface TestCase {
    id: string;
    name: string;
    description: string;
    preconditions: string;
    expectedResult: string;
    epic: string;
    feature: string;
    story: string;
    component: string;
    testLayer: string;
    severity: string;
    priority: string;
    environment: string;
    browser: string;
    owner: string;
    author: string;
    reviewer: string;
    testCaseId: string;
    issueLinks: string;
    testCaseLinks: string;
    tags: string;
    status: string;
    testType: string;
    steps: TestStep[];
    createdAt?: number;
    updatedAt?: number;
    notes?: any;
}

interface TestStep {
    id: string;
    name: string;
    description: string;
    expectedResult: string;
    status: string;
    bugLink: string;
    skipReason: string;
    attachments: string;
}

interface ParsedDescription {
    project?: string;
    testPlan?: string;
    testSuite?: string;
    priority?: string;
    automationStatus?: string;
    statusChangeDate?: string;
}

export class TestCaseRenderer {
    static parseDescription(description: string): ParsedDescription {
        const parsed: ParsedDescription = {};
        const lines = description.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('Проект:')) {
                parsed.project = line.replace('Проект:', '').trim();
            } else if (line.startsWith('Тест-план:')) {
                parsed.testPlan = line.replace('Тест-план:', '').trim();
            } else if (line.startsWith('Тест-сьют:')) {
                parsed.testSuite = line.replace('Тест-сьют:', '').trim();
            } else if (line.startsWith('Приоритет:')) {
                parsed.priority = line.replace('Приоритет:', '').trim();
            } else if (line.startsWith('Статус автоматизации:')) {
                parsed.automationStatus = line.replace('Статус автоматизации:', '').trim();
            } else if (line.startsWith('Дата изменения статуса:')) {
                parsed.statusChangeDate = line.replace('Дата изменения статуса:', '').trim();
            }
        }
        
        return parsed;
    }

    static formatDate(dateString: string): string {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('ru-RU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
        } catch {
            return dateString;
        }
    }

    static getStatusLabel(status: string): string {
        const labels: { [key: string]: string } = {
            'Done': 'Выполнен',
            'In Progress': 'В работе',
            'To Do': 'К выполнению',
            'skipped': 'Пропущен',
            'passed': 'Пройден',
            'failed': 'Провален',
        };
        return labels[status] || status;
    }

    static escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static renderSteps(steps: TestStep[]): string {
        if (!steps || steps.length === 0) {
            return '<div class="empty">Нет шагов тестирования</div>';
        }

        return steps.map((step, index) => {
            const statusClass = step.status === 'skipped' ? 'skipped' : 
                               step.status === 'passed' ? 'passed' : 
                               step.status === 'failed' ? 'failed' : '';
            const isFirst = index === 0;
            const isLast = index === steps.length - 1;
            const stepNumber = index + 1;
            
            return `
                <div class="step" data-step-id="${this.escapeHtml(step.id || '')}" data-step-index="${index}">
                    <div class="step-header">
                        <div class="step-number">
                            Шаг ${stepNumber}
                            ${step.status ? `<span class="step-status ${statusClass}">${this.getStatusLabel(step.status)}</span>` : ''}
                        </div>
                        <div class="step-actions">
                            <button class="step-action-btn" data-action="move-up" data-step-id="${this.escapeHtml(step.id || '')}" ${isFirst ? 'disabled' : ''} title="Переместить выше">↑</button>
                            <button class="step-action-btn" data-action="move-down" data-step-id="${this.escapeHtml(step.id || '')}" ${isLast ? 'disabled' : ''} title="Переместить ниже">↓</button>
                            <button class="step-action-btn" data-action="add-above" data-step-id="${this.escapeHtml(step.id || '')}" title="Добавить шаг выше">+↑</button>
                            <button class="step-action-btn" data-action="add-below" data-step-id="${this.escapeHtml(step.id || '')}" title="Добавить шаг ниже">+↓</button>
                            <button class="step-action-btn step-action-btn-danger" data-action="delete" data-step-id="${this.escapeHtml(step.id || '')}" title="Удалить шаг">×</button>
                        </div>
                    </div>
                    <textarea 
                        class="step-description-editable" 
                        data-step-id="${this.escapeHtml(step.id || '')}"
                        data-field="description"
                        placeholder="Описание шага"
                    >${this.escapeHtml(step.description || '')}</textarea>
                    <div class="step-expected">
                        <div class="step-expected-label">Ожидаемый результат:</div>
                        <textarea 
                            class="step-expected-value-editable" 
                            data-step-id="${this.escapeHtml(step.id || '')}"
                            data-field="expectedResult"
                            placeholder="Ожидаемый результат"
                        >${this.escapeHtml(step.expectedResult || '')}</textarea>
                    </div>
                    ${step.skipReason ? `
                    <div class="step-skip-reason">Причина пропуска: ${this.escapeHtml(step.skipReason)}</div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    static getErrorHtml(message: string): string {
        return `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Test Case Viewer</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    .error {
                        color: var(--vscode-errorForeground);
                    }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>Ошибка</h2>
                    <p>${this.escapeHtml(message)}</p>
                </div>
            </body>
            </html>
        `;
    }

    static render(testCase: TestCase, documentUri?: string, testers?: string[]): string {
        const stepsHtml = this.renderSteps(testCase.steps || []);

        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Case Viewer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html {
            height: 100%;
            overflow: auto;
        }
        
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 24px;
            line-height: 1.5;
            margin: 0;
            transition: transform 0.1s ease;
            min-height: 100%;
            transform-origin: top left;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 20px;
        }
        
        .tab {
            padding: 8px 16px;
            cursor: pointer;
            border: none;
            background: transparent;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease;
        }
        
        .tab:hover {
            color: var(--vscode-foreground);
        }
        
        .tab.active {
            color: var(--vscode-textLink-foreground);
            border-bottom-color: var(--vscode-textLink-foreground);
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .section {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px 16px 0 16px;
            margin-bottom: 20px;
        }
        
        .section:has(.section-content:not(.collapsed)) {
            padding-bottom: 16px;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--vscode-textLink-foreground);
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
        }
        
        .section-title-collapsible {
            cursor: pointer;
        }
        
        .section-toggle {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-left: 8px;
            transition: transform 0.2s ease;
        }
        
        .section-toggle.collapsed {
            transform: rotate(-90deg);
        }
        
        .section-content {
            overflow: hidden;
            transition: max-height 0.3s ease, opacity 0.3s ease, padding-top 0.3s ease, padding-bottom 0.3s ease;
            padding-top: 0;
            padding-bottom: 0;
        }
        
        .section-content.collapsed {
            max-height: 0 !important;
            opacity: 0;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
        }
        
        .info-grid {
            display: flex;
            flex-direction: column;
        }
        
        .info-item {
            display: flex;
            flex-direction: row;
            align-items: baseline;
            margin-bottom: 8px;
        }
        
        .info-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            font-weight: 500;
            margin-right: 8px;
            flex-shrink: 0;
        }
        
        .info-value {
            font-size: 14px;
            color: var(--vscode-foreground);
            font-weight: 500;
            flex: 1;
        }
        
        .info-value-editable {
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            flex: 1;
            width: 100%;
        }
        
        .info-value-editable:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .info-value-select {
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            flex: 1;
            width: 100%;
            cursor: pointer;
        }
        
        .info-value-select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .description-item {
            display: flex;
            flex-direction: row;
            align-items: baseline;
            margin-bottom: 8px;
        }
        
        .description-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            font-weight: 500;
            margin-right: 8px;
            flex-shrink: 0;
        }
        
        .description-value {
            font-size: 14px;
            color: var(--vscode-foreground);
            flex: 1;
        }
        
        .description-editable {
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            width: 100%;
            min-height: 80px;
            resize: vertical;
            white-space: pre-wrap;
            overflow: hidden;
            box-sizing: border-box;
        }
        
        .description-editable:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        /* Minimalist styles for Viewer tab */
        .viewer-header {
            margin-bottom: 32px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .viewer-title {
            font-size: 24px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 8px;
        }
        
        .viewer-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            margin-top: 12px;
        }
        
        .viewer-meta-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .viewer-meta-label {
            color: var(--vscode-descriptionForeground);
            opacity: 0.7;
        }
        
        .viewer-meta-select {
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            font-size: 13px;
            padding: 0;
            margin: 0;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
        }
        
        .viewer-meta-select:hover {
            opacity: 0.8;
        }
        
        .viewer-meta-select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
            border-radius: 2px;
        }
        
        /* Стили для опций в выпадающем списке - темная тема */
        .viewer-meta-select option {
            background-color: var(--vscode-dropdown-background) !important;
            color: var(--vscode-dropdown-foreground) !important;
        }
        
        /* Для WebKit браузеров (Chrome, Edge) */
        .viewer-meta-select::-webkit-list-button {
            background-color: var(--vscode-dropdown-background);
        }
        
        /* Для Firefox */
        .viewer-meta-select::-moz-list-box {
            background-color: var(--vscode-dropdown-background);
        }
        
        .viewer-title {
            background: transparent;
            border: none;
            padding: 0;
            width: 100%;
            font-size: 24px;
            font-weight: 600;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
        }
        
        .viewer-title:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
            border-radius: 2px;
        }
        
        .viewer-section-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 8px;
            margin-top: 16px;
        }
        
        .viewer-section-title:first-of-type {
            margin-top: 0;
        }
        
        .viewer-description {
            margin-bottom: 16px;
            padding: 16px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            font-size: 14px;
            color: var(--vscode-foreground);
            white-space: pre-wrap;
            line-height: 1.6;
            border: none;
            width: 100%;
            min-height: 80px;
            resize: vertical;
            font-family: var(--vscode-font-family);
        }
        
        .viewer-description:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .viewer-steps {
            margin-top: 16px;
        }
        
        .viewer-steps-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 20px;
        }
        
        .steps-container {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }
        
        .step {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-left: 2px solid var(--vscode-textLink-foreground);
            padding: 16px;
            border-radius: 4px;
        }
        
        .step-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .step-number {
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .step-actions {
            display: flex;
            gap: 4px;
        }
        
        .step-action-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            padding: 4px 8px;
            border-radius: 2px;
            font-size: 12px;
            cursor: pointer;
            font-weight: 500;
            min-width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .step-action-btn:hover:not(:disabled) {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .step-action-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .step-action-btn-danger {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border-color: var(--vscode-inputValidation-errorBorder);
        }
        
        .step-action-btn-danger:hover:not(:disabled) {
            background-color: var(--vscode-inputValidation-errorBackground);
            opacity: 0.8;
        }
        
        .step-name {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .step-status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
            margin-left: 8px;
        }
        
        .step-status.skipped {
            background-color: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
        }
        
        .step-status.passed {
            background-color: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
        }
        
        .step-status.failed {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }
        
        .step-description {
            margin-bottom: 12px;
            color: var(--vscode-foreground);
            white-space: pre-wrap;
        }
        
        .step-description-editable {
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            width: 100%;
            min-height: 40px;
            resize: none;
            white-space: pre-wrap;
            overflow: hidden;
            box-sizing: border-box;
            margin-bottom: 12px;
        }
        
        .step-description-editable:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .step-expected {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 13px;
        }
        
        .step-expected-label {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
            margin-bottom: 4px;
        }
        
        .step-expected-value {
            font-size: 14px;
            color: var(--vscode-foreground);
            white-space: pre-wrap;
        }
        
        .step-expected-value-editable {
            font-size: 13px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            width: 100%;
            min-height: 40px;
            resize: none;
            white-space: pre-wrap;
            overflow: hidden;
            box-sizing: border-box;
        }
        
        .step-expected-value-editable:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .step-skip-reason {
            margin-top: 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .empty {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .llm-status-indicator {
            transition: background-color 0.3s ease;
        }
        
        .llm-status-indicator.connected {
            background-color: #4ec9b0 !important;
            box-shadow: 0 0 8px rgba(78, 201, 176, 0.5);
        }
        
        .llm-status-indicator.disconnected {
            background-color: #f48771 !important;
            box-shadow: 0 0 8px rgba(244, 135, 113, 0.5);
        }
        
        .llm-refresh-btn:hover {
            background-color: var(--vscode-button-hoverBackground) !important;
            border-radius: 4px;
        }
        
        .llm-refresh-btn:active {
            transform: rotate(180deg);
            transition: transform 0.3s ease;
        }
        
        .llm-models-btn:hover {
            background-color: var(--vscode-button-hoverBackground) !important;
        }
        
        .llm-models-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .llm-models-item {
            padding: 6px 8px;
            margin: 4px 0;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            font-size: 13px;
        }
        
        .llm-models-loading {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .llm-models-error {
            color: var(--vscode-errorForeground);
        }
        
        /* Chat styles - Cursor-like design */
        .tab-content[data-tab="chat"].active {
            display: flex;
            flex-direction: column;
            height: 100%;
            position: relative;
            overflow: hidden;
            background-color: var(--vscode-editor-background);
        }
        
        .chat-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            position: relative;
        }
        
        .chat-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            flex-shrink: 0;
        }
        
        .chat-header-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .chat-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .chat-header-button {
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            opacity: 0.7;
            transition: opacity 0.2s ease, background-color 0.2s ease;
        }
        
        .chat-header-button:hover {
            opacity: 1;
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 0;
            display: flex;
            flex-direction: column;
            min-height: 0;
            scroll-behavior: smooth;
        }
        
        .chat-message {
            display: flex;
            flex-direction: column;
            padding: 16px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            transition: background-color 0.15s ease;
        }
        
        .chat-message:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .chat-message.user {
            background-color: var(--vscode-editor-background);
        }
        
        .chat-message.assistant {
            background-color: var(--vscode-editor-background);
        }
        
        .chat-message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        
        .chat-message-role {
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .chat-message-role-icon {
            width: 20px;
            height: 20px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
        }
        
        .chat-message.user .chat-message-role-icon {
            background-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
        }
        
        .chat-message.assistant .chat-message-role-icon {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .chat-message-content {
            font-size: 13px;
            line-height: 1.6;
            color: var(--vscode-foreground);
            white-space: pre-wrap;
            word-wrap: break-word;
            padding-left: 28px;
        }
        
        .chat-input-container {
            position: sticky;
            bottom: 0;
            background-color: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            padding: 12px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex-shrink: 0;
            z-index: 10;
        }
        
        .chat-input-top-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        
        .chat-model-select {
            flex-shrink: 0;
            font-size: 12px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 8px;
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            cursor: pointer;
            height: 24px;
        }
        
        .chat-model-select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .chat-input-row {
            display: flex;
            gap: 8px;
            align-items: flex-end;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 8px;
            transition: border-color 0.2s ease;
        }
        
        .chat-input-row:focus-within {
            border-color: var(--vscode-focusBorder);
        }
        
        .chat-input-wrapper {
            flex: 1;
            position: relative;
            display: flex;
            align-items: flex-end;
        }
        
        .chat-input {
            width: 100%;
            min-height: 24px;
            max-height: 200px;
            font-size: 13px;
            color: var(--vscode-foreground);
            background-color: transparent;
            border: none;
            padding: 0;
            border-radius: 0;
            font-family: var(--vscode-font-family);
            resize: none;
            overflow-y: auto;
            line-height: 1.5;
            outline: none;
        }
        
        .chat-send-button {
            flex-shrink: 0;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s ease, opacity 0.2s ease;
        }
        
        .chat-send-button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .chat-send-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        
        .chat-loading {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
            padding: 8px 16px;
        }
        
        .chat-loading-dots {
            display: inline-flex;
            gap: 4px;
        }
        
        .chat-loading-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: var(--vscode-descriptionForeground);
            animation: chat-loading-pulse 1.4s ease-in-out infinite;
        }
        
        .chat-loading-dot:nth-child(2) {
            animation-delay: 0.2s;
        }
        
        .chat-loading-dot:nth-child(3) {
            animation-delay: 0.4s;
        }
        
        @keyframes chat-loading-pulse {
            0%, 80%, 100% {
                opacity: 0.3;
                transform: scale(0.8);
            }
            40% {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        .chat-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
            padding: 40px 20px;
            text-align: center;
        }
        
        .chat-empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        .chat-empty-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 8px;
        }
        
        .chat-empty-description {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            max-width: 400px;
        }
        
        .chat-message-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            padding-left: 28px;
            flex-wrap: wrap;
        }
        
        .chat-action-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        
        .chat-action-button:hover:not(:disabled) {
            background-color: var(--vscode-button-secondaryHoverBackground);
            border-color: var(--vscode-button-hoverBorder);
        }
        
        .chat-action-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="tabs">
            <button class="tab active" data-tab="viewer">Viewer</button>
            <button class="tab" data-tab="chat">Chat</button>
            <button class="tab" data-tab="llm">LLM</button>
        </div>
        
        <div class="tab-content active" data-tab="viewer">
            <div class="viewer-header">
                <input 
                    type="text" 
                    class="viewer-title" 
                    id="test-case-name" 
                    value="${this.escapeHtml(testCase.name || '')}"
                    data-field="name"
                />
                <div class="viewer-meta">
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">ID:</span>
                        <span>${this.escapeHtml(testCase.id || '')}</span>
                    </div>
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">Статус:</span>
                        <select 
                            class="viewer-meta-select" 
                            id="test-case-status" 
                            data-field="status"
                        >
                            <option value="Draft" ${testCase.status === 'Draft' ? 'selected' : ''}>Draft</option>
                            <option value="Design" ${testCase.status === 'Design' ? 'selected' : ''}>Design</option>
                            <option value="Review" ${testCase.status === 'Review' ? 'selected' : ''}>Review</option>
                            <option value="Done" ${testCase.status === 'Done' ? 'selected' : ''}>Done</option>
                        </select>
                    </div>
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">Тип:</span>
                        <select 
                            class="viewer-meta-select" 
                            id="test-case-type" 
                            data-field="testType"
                        >
                            <option value="Manual" ${testCase.testType === 'Manual' || testCase.testType === 'manual' ? 'selected' : ''}>Manual</option>
                            <option value="Hybrid" ${testCase.testType === 'Hybrid' || testCase.testType === 'hybrid' ? 'selected' : ''}>Hybrid</option>
                            <option value="Automated" ${testCase.testType === 'Automated' || testCase.testType === 'automated' ? 'selected' : ''}>Automated</option>
                        </select>
                    </div>
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">Владелец:</span>
                        ${testers && testers.length > 0 ? `
                        <select 
                            class="viewer-meta-select" 
                            id="test-case-owner" 
                            data-field="owner"
                        >
                            <option value="">-- Выберите --</option>
                            ${testers.map(tester => `<option value="${this.escapeHtml(tester)}" ${testCase.owner === tester ? 'selected' : ''}>${this.escapeHtml(tester)}</option>`).join('')}
                        </select>
                        ` : `
                        <span>${this.escapeHtml(testCase.owner || '')}</span>
                        `}
                    </div>
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">Автор:</span>
                        ${testers && testers.length > 0 ? `
                        <select 
                            class="viewer-meta-select" 
                            id="test-case-author" 
                            data-field="author"
                        >
                            <option value="">-- Выберите --</option>
                            ${testers.map(tester => `<option value="${this.escapeHtml(tester)}" ${testCase.author === tester ? 'selected' : ''}>${this.escapeHtml(tester)}</option>`).join('')}
                        </select>
                        ` : `
                        <span>${this.escapeHtml(testCase.author || '')}</span>
                        `}
                    </div>
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">Ревьювер:</span>
                        ${testers && testers.length > 0 ? `
                        <select 
                            class="viewer-meta-select" 
                            id="test-case-reviewer" 
                            data-field="reviewer"
                        >
                            <option value="">-- Выберите --</option>
                            ${testers.map(tester => `<option value="${this.escapeHtml(tester)}" ${testCase.reviewer === tester ? 'selected' : ''}>${this.escapeHtml(tester)}</option>`).join('')}
                        </select>
                        ` : `
                        <span>${this.escapeHtml(testCase.reviewer || '')}</span>
                        `}
                    </div>
                </div>
            </div>
            
            <div class="viewer-section-title">Описание</div>
            <textarea 
                class="viewer-description" 
                id="test-case-description" 
                data-field="description"
                placeholder="Описание тест-кейса"
            >${this.escapeHtml(testCase.description || '')}</textarea>
            
            <div class="viewer-section-title">Предусловие</div>
            <textarea 
                class="viewer-description" 
                id="test-case-preconditions" 
                data-field="preconditions"
                placeholder="Предусловия для выполнения тест-кейса"
            >${this.escapeHtml(testCase.preconditions || '')}</textarea>
            
            <div class="viewer-steps">
                <div class="viewer-steps-title">Шаги тестирования</div>
                <div class="steps-container">
                    ${stepsHtml || '<div class="empty">Нет шагов тестирования</div>'}
                </div>
            </div>
        </div>
        
        <div class="tab-content" data-tab="chat">
            <div class="chat-container">
                <div class="chat-header">
                    <div class="chat-header-title">
                        <span>💬</span>
                        <span>Чат LLM для тест-кейсов</span>
                    </div>
                    <div class="chat-header-actions">
                        <button class="chat-header-button" id="chat-new-button" title="Новый чат">➕</button>
                        <button class="chat-header-button" id="chat-menu-button" title="Меню">⋯</button>
                    </div>
                </div>
                <div class="chat-messages" id="chat-messages">
                    <div class="chat-empty">
                        <div class="chat-empty-icon">💬</div>
                        <div class="chat-empty-title">Начните новый диалог</div>
                        <div class="chat-empty-description">Задайте вопрос или попросите создать тест-кейс. LLM поможет вам с созданием и редактированием тест-кейсов.</div>
                    </div>
                </div>
                <div class="chat-input-container">
                    <div class="chat-input-top-row">
                        <select class="chat-model-select" id="chat-model-select">
                            <option value="">Выберите модель...</option>
                        </select>
                    </div>
                    <div class="chat-input-row">
                        <div class="chat-input-wrapper">
                            <textarea 
                                class="chat-input" 
                                id="chat-input" 
                                placeholder="Введите сообщение..."
                                rows="1"
                            ></textarea>
                        </div>
                        <button class="chat-send-button" id="chat-send-button" disabled>Отправить</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="tab-content" data-tab="llm">
            <div class="section">
                <div class="section-title" style="display: flex; align-items: center; justify-content: space-between;">
                    <span>LLM</span>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div id="llm-status" class="llm-status-indicator" style="width: 12px; height: 12px; border-radius: 50%; background-color: var(--vscode-descriptionForeground);" title="Статус подключения"></div>
                        <button id="llm-refresh-btn" class="llm-refresh-btn" title="Обновить статус подключения" style="background: transparent; border: none; cursor: pointer; color: var(--vscode-foreground); padding: 4px 8px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 16px;">🔄</span>
                        </button>
                    </div>
                </div>
                <div style="padding: 20px; color: var(--vscode-descriptionForeground);">
                    <div id="llm-status-text" style="margin-bottom: 12px;">Проверка подключения...</div>
                    <div style="font-size: 12px; margin-bottom: 16px;">Используйте иконку обновления для проверки подключения к LLM серверу</div>
                    <button id="llm-models-btn" class="llm-models-btn" style="background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">
                        Список моделей
                    </button>
                    <div id="llm-models-list" style="margin-top: 16px; display: none;">
                        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--vscode-foreground);">Доступные модели:</div>
                        <div id="llm-models-content" style="color: var(--vscode-foreground);"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            let zoomLevel = 1;
            const minZoom = 0.5;
            const maxZoom = 3;
            const zoomStep = 0.1;
            
            // Zoom handling
            document.addEventListener('wheel', function(e) {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    
                    const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
                    zoomLevel = Math.max(minZoom, Math.min(maxZoom, zoomLevel + delta));
                    
                    document.body.style.transform = 'scale(' + zoomLevel + ')';
                    document.body.style.transformOrigin = '0 0';
                    document.body.style.width = (100 / zoomLevel) + '%';
                }
            }, { passive: false });
            
            // Track focused element to prevent updates while editing
            let focusedElement = null;
            
            // Save focus state
            document.addEventListener('focusin', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                    focusedElement = e.target;
                    vscode.postMessage({ command: 'focusState', hasFocus: true });
                }
            });
            
            document.addEventListener('focusout', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                    focusedElement = null;
                    vscode.postMessage({ command: 'focusState', hasFocus: false });
                }
            });
            
            // Respond to focus check
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'checkFocus') {
                    const hasFocus = document.activeElement && 
                        (document.activeElement.tagName === 'INPUT' || 
                         document.activeElement.tagName === 'TEXTAREA' || 
                         document.activeElement.tagName === 'SELECT');
                    vscode.postMessage({ command: 'focusState', hasFocus: hasFocus });
                }
            });
            
            // Handle name field editing
            const nameInput = document.getElementById('test-case-name');
            if (nameInput) {
                nameInput.addEventListener('blur', function(e) {
                    const value = e.target.value;
                    vscode.postMessage({
                        command: 'updateName',
                        value: value
                    });
                });
            }
            
            // Handle test type dropdown
            const testTypeSelect = document.getElementById('test-case-type');
            if (testTypeSelect) {
                let isUpdating = false;
                
                testTypeSelect.addEventListener('change', function(e) {
                    if (!isUpdating) {
                        isUpdating = true;
                        const value = e.target.value;
                        vscode.postMessage({
                            command: 'updateTestType',
                            value: value
                        });
                        
                        // Reset flag after a delay
                        setTimeout(() => {
                            isUpdating = false;
                        }, 500);
                    }
                });
            }
            
            // Handle status dropdown
            const statusSelect = document.getElementById('test-case-status');
            if (statusSelect) {
                let isUpdating = false;
                
                statusSelect.addEventListener('change', function(e) {
                    if (!isUpdating) {
                        isUpdating = true;
                        const value = e.target.value;
                        vscode.postMessage({
                            command: 'updateStatus',
                            value: value
                        });
                        
                        // Reset flag after a delay
                        setTimeout(() => {
                            isUpdating = false;
                        }, 500);
                    }
                });
            }
            
            // Handle owner, author, reviewer dropdowns
            const testerSelects = document.querySelectorAll('#test-case-owner, #test-case-author, #test-case-reviewer');
            testerSelects.forEach(select => {
                let isUpdating = false;
                
                select.addEventListener('change', function(e) {
                    if (!isUpdating) {
                        isUpdating = true;
                        const field = e.target.getAttribute('data-field');
                        const value = e.target.value;
                        vscode.postMessage({
                            command: 'updateField',
                            field: field,
                            value: value
                        });
                        
                        // Reset flag after a delay
                        setTimeout(() => {
                            isUpdating = false;
                        }, 500);
                    }
                });
            });
            
            // Auto-resize textarea function
            function autoResizeTextarea(textarea) {
                textarea.style.height = 'auto';
                const scrollHeight = textarea.scrollHeight;
                const minHeight = 40;
                textarea.style.height = Math.max(minHeight, scrollHeight) + 'px';
            }
            
            // Handle epic, feature, story input fields
            const epicFeatureStoryInputs = document.querySelectorAll('#test-case-epic, #test-case-feature, #test-case-story');
            epicFeatureStoryInputs.forEach(input => {
                input.addEventListener('blur', function(e) {
                    const field = e.target.getAttribute('data-field');
                    const value = e.target.value;
                    vscode.postMessage({
                        command: 'updateField',
                        field: field,
                        value: value
                    });
                });
            });
            
            // Handle description and preconditions textarea fields
            const descriptionTextareas = document.querySelectorAll('#test-case-description, #test-case-preconditions');
            descriptionTextareas.forEach(textarea => {
                // Set initial height
                autoResizeTextarea(textarea);
                
                // Auto-resize on input (but don't update file)
                textarea.addEventListener('input', function(e) {
                    autoResizeTextarea(e.target);
                });
                
                // Update file only on blur
                textarea.addEventListener('blur', function(e) {
                    const field = e.target.getAttribute('data-field');
                    const value = e.target.value;
                    vscode.postMessage({
                        command: 'updateField',
                        field: field,
                        value: value
                    });
                });
            });
            
            // Handle step fields editing
            const stepTextareas = document.querySelectorAll('.step-description-editable, .step-expected-value-editable');
            stepTextareas.forEach(textarea => {
                // Set initial height
                autoResizeTextarea(textarea);
                
                // Auto-resize on input (but don't update file)
                textarea.addEventListener('input', function(e) {
                    autoResizeTextarea(e.target);
                });
                
                // Update file only on blur
                textarea.addEventListener('blur', function(e) {
                    const stepId = e.target.getAttribute('data-step-id');
                    const field = e.target.getAttribute('data-field');
                    const value = e.target.value;
                    vscode.postMessage({
                        command: 'updateStep',
                        stepId: stepId,
                        field: field,
                        value: value
                    });
                });
            });
            
            // Handle step action buttons
            const stepActionButtons = document.querySelectorAll('.step-action-btn');
            stepActionButtons.forEach(button => {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    const action = e.target.getAttribute('data-action');
                    const stepId = e.target.getAttribute('data-step-id');
                    
                    if (action && stepId) {
                        vscode.postMessage({
                            command: 'stepAction',
                            action: action,
                            stepId: stepId
                        });
                    }
                });
            });
            
            // Handle section collapsing
            const collapsibleSections = document.querySelectorAll('.section-title-collapsible');
            collapsibleSections.forEach(title => {
                title.addEventListener('click', function(e) {
                    const sectionId = title.getAttribute('data-section');
                    const content = document.querySelector('.section-content[data-section="' + sectionId + '"]');
                    const toggle = title.querySelector('.section-toggle');
                    
                    if (content && toggle) {
                        const isCollapsed = content.classList.contains('collapsed');
                        
                        if (isCollapsed) {
                            // Expand
                            content.classList.remove('collapsed');
                            toggle.classList.remove('collapsed');
                            // Temporarily remove max-height to get actual height
                            content.style.maxHeight = 'none';
                            const height = content.scrollHeight;
                            content.style.maxHeight = '0px';
                            // Force reflow
                            content.offsetHeight;
                            // Set to actual height for animation
                            content.style.maxHeight = height + 'px';
                            // Update section padding
                            const section = content.closest('.section');
                            if (section) {
                                section.style.paddingBottom = '16px';
                            }
                            // After animation, remove max-height constraint
                            setTimeout(() => {
                                if (!content.classList.contains('collapsed')) {
                                    content.style.maxHeight = 'none';
                                }
                            }, 300);
                        } else {
                            // Collapse
                            content.style.maxHeight = content.scrollHeight + 'px';
                            // Force reflow
                            content.offsetHeight;
                            content.classList.add('collapsed');
                            toggle.classList.add('collapsed');
                            content.style.maxHeight = '0px';
                            // Update section padding
                            const section = content.closest('.section');
                            if (section) {
                                section.style.paddingBottom = '0px';
                            }
                        }
                    }
                });
            });
            
            // Initialize section heights
            const sectionContents = document.querySelectorAll('.section-content');
            sectionContents.forEach(content => {
                if (!content.classList.contains('collapsed')) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            });
            
            // Handle tab switching
            const tabs = document.querySelectorAll('.tab');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => {
                tab.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const targetTab = this.getAttribute('data-tab');
                    if (!targetTab) return;
                    
                    // Remove active class from all tabs and contents
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));
                    
                    // Add active class to clicked tab and corresponding content
                    this.classList.add('active');
                    const targetContent = document.querySelector('.tab-content[data-tab="' + targetTab + '"]');
                    if (targetContent) {
                        targetContent.classList.add('active');
                    }
                });
            });
            
            // Handle LLM refresh button
            const llmRefreshBtn = document.getElementById('llm-refresh-btn');
            const llmStatusIndicator = document.getElementById('llm-status');
            const llmStatusText = document.getElementById('llm-status-text');
            
            if (llmRefreshBtn) {
                llmRefreshBtn.addEventListener('click', function() {
                    vscode.postMessage({ command: 'checkLlmConnection' });
                });
            }
            
            // Handle LLM models button
            const llmModelsBtn = document.getElementById('llm-models-btn');
            const llmModelsList = document.getElementById('llm-models-list');
            const llmModelsContent = document.getElementById('llm-models-content');
            
            if (llmModelsBtn) {
                llmModelsBtn.addEventListener('click', function() {
                    if (llmModelsBtn.disabled) return;
                    
                    llmModelsBtn.disabled = true;
                    if (llmModelsContent) {
                        llmModelsContent.innerHTML = '<div class="llm-models-loading">Загрузка моделей...</div>';
                        llmModelsList.style.display = 'block';
                    }
                    
                    vscode.postMessage({ command: 'getLlmModels' });
                });
            }
            
            // Handle LLM connection status updates
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'llmConnectionStatus') {
                    const isConnected = message.connected;
                    const statusText = message.statusText || '';
                    
                    if (llmStatusIndicator) {
                        llmStatusIndicator.classList.remove('connected', 'disconnected');
                        if (isConnected) {
                            llmStatusIndicator.classList.add('connected');
                        } else {
                            llmStatusIndicator.classList.add('disconnected');
                        }
                    }
                    
                    if (llmStatusText) {
                        llmStatusText.textContent = statusText;
                    }
                }
                
                if (message.command === 'llmModelsList') {
                    if (llmModelsBtn) {
                        llmModelsBtn.disabled = false;
                    }
                    
                    if (llmModelsContent) {
                        if (message.error) {
                            const errorText = String(message.error).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                            llmModelsContent.innerHTML = '<div class="llm-models-error">Ошибка: ' + errorText + '</div>';
                        } else if (message.models && message.models.length > 0) {
                            const modelsHtml = message.models.map(function(model) {
                                const modelText = String(model).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                                return '<div class="llm-models-item">' + modelText + '</div>';
                            }).join('');
                            llmModelsContent.innerHTML = modelsHtml;
                        } else {
                            llmModelsContent.innerHTML = '<div class="llm-models-loading">Модели не найдены</div>';
                        }
                    }
                    
                    if (llmModelsList) {
                        llmModelsList.style.display = 'block';
                    }
                }
            });
            
            // Check connection status when LLM tab is opened
            const llmTab = document.querySelector('.tab[data-tab="llm"]');
            if (llmTab) {
                llmTab.addEventListener('click', function() {
                    setTimeout(() => {
                        vscode.postMessage({ command: 'checkLlmConnection' });
                    }, 100);
                });
            }
            
            // Initial status check if LLM tab is already active (shouldn't happen, but just in case)
            const activeLlmTab = document.querySelector('.tab[data-tab="llm"].active');
            if (activeLlmTab) {
                setTimeout(() => {
                    vscode.postMessage({ command: 'checkLlmConnection' });
                }, 200);
            }
            
            // Chat functionality
            const chatMessages = document.getElementById('chat-messages');
            const chatInput = document.getElementById('chat-input');
            const chatSendButton = document.getElementById('chat-send-button');
            const chatModelSelect = document.getElementById('chat-model-select');
            
            let chatHistory = [];
            
            // Auto-resize textarea
            if (chatInput) {
                chatInput.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
                    
                    // Enable/disable send button
                    if (chatSendButton) {
                        chatSendButton.disabled = !this.value.trim() || !chatModelSelect.value;
                    }
                });
                
                // Handle Enter key (Shift+Enter for new line, Enter to send)
                chatInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (chatSendButton && !chatSendButton.disabled) {
                            chatSendButton.click();
                        }
                    }
                });
            }
            
            // Load models when chat tab is opened
            const chatTab = document.querySelector('.tab[data-tab="chat"]');
            if (chatTab) {
                chatTab.addEventListener('click', function() {
                    setTimeout(() => {
                        vscode.postMessage({ command: 'getLlmModels' });
                    }, 100);
                });
            }
            
            // Handle new chat button
            const chatNewButton = document.getElementById('chat-new-button');
            if (chatNewButton) {
                chatNewButton.addEventListener('click', function() {
                    if (chatMessages) {
                        chatMessages.innerHTML = '<div class="chat-empty"><div class="chat-empty-icon">💬</div><div class="chat-empty-title">Начните новый диалог</div><div class="chat-empty-description">Задайте вопрос или попросите создать тест-кейс. LLM поможет вам с созданием и редактированием тест-кейсов.</div></div>';
                        chatHistory = [];
                        
                        // Clear saved history
                        vscode.postMessage({
                            command: 'saveChatHistory',
                            history: []
                        });
                    }
                });
            }
            
            // Handle menu button (placeholder)
            const chatMenuButton = document.getElementById('chat-menu-button');
            if (chatMenuButton) {
                chatMenuButton.addEventListener('click', function() {
                    // TODO: Add menu functionality
                });
            }
            
            // Handle model selection change
            if (chatModelSelect) {
                chatModelSelect.addEventListener('change', function() {
                    const selectedModel = this.value;
                    if (chatSendButton && chatInput) {
                        chatSendButton.disabled = !chatInput.value.trim() || !selectedModel;
                    }
                    // Save selected model
                    if (selectedModel) {
                        vscode.postMessage({
                            command: 'saveChatModel',
                            model: selectedModel
                        });
                    }
                });
            }
            
            // Handle send button
            if (chatSendButton) {
                chatSendButton.addEventListener('click', function() {
                    if (this.disabled) return;
                    
                    const message = chatInput.value.trim();
                    const model = chatModelSelect.value;
                    
                    if (!message || !model) return;
                    
                    // Add user message to chat
                    addChatMessage('user', message);
                    
                    // Add to history immediately
                    chatHistory.push({ role: 'user', content: message });
                    
                    // Save history
                    vscode.postMessage({
                        command: 'saveChatHistory',
                        history: chatHistory
                    });
                    
                    // Clear input
                    chatInput.value = '';
                    chatInput.style.height = 'auto';
                    this.disabled = true;
                    
                    // Show loading indicator
                    const loadingId = addChatMessage('assistant', '', true);
                    
                    // Send message to extension
                    vscode.postMessage({
                        command: 'sendChatMessage',
                        message: message,
                        model: model,
                        history: chatHistory
                    });
                });
            }
            
            function addChatMessage(role, content, isLoading = false, testCaseJson = null, fileActions = null) {
                if (!chatMessages) return null;
                
                // Remove empty message if exists
                const emptyMessage = chatMessages.querySelector('.chat-empty');
                if (emptyMessage) {
                    emptyMessage.remove();
                }
                
                const messageId = 'msg-' + Date.now();
                const messageDiv = document.createElement('div');
                messageDiv.className = 'chat-message ' + role;
                messageDiv.id = messageId;
                
                // Create message header
                const headerDiv = document.createElement('div');
                headerDiv.className = 'chat-message-header';
                
                const iconDiv = document.createElement('div');
                iconDiv.className = 'chat-message-role-icon';
                iconDiv.textContent = role === 'user' ? 'U' : 'AI';
                
                const roleDiv = document.createElement('div');
                roleDiv.className = 'chat-message-role';
                roleDiv.textContent = role === 'user' ? 'Вы' : 'Ассистент';
                
                headerDiv.appendChild(iconDiv);
                headerDiv.appendChild(roleDiv);
                
                // Create message content
                const contentDiv = document.createElement('div');
                contentDiv.className = 'chat-message-content';
                
                if (isLoading) {
                    contentDiv.innerHTML = '<div class="chat-loading"><span>Генерация ответа</span><div class="chat-loading-dots"><span class="chat-loading-dot"></span><span class="chat-loading-dot"></span><span class="chat-loading-dot"></span></div></div>';
                } else {
                    contentDiv.textContent = content;
                }
                
                messageDiv.appendChild(headerDiv);
                messageDiv.appendChild(contentDiv);
                
                // Add action buttons
                if (role === 'assistant' && !isLoading) {
                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'chat-message-actions';
                    
                    // Add create test case button if JSON is detected
                    if (testCaseJson) {
                        const createButton = document.createElement('button');
                        createButton.className = 'chat-action-button';
                        createButton.textContent = 'Создать тест-кейс';
                        createButton.setAttribute('data-test-case-json', JSON.stringify(testCaseJson));
                        createButton.addEventListener('click', function() {
                            const jsonData = this.getAttribute('data-test-case-json');
                            if (jsonData) {
                                vscode.postMessage({
                                    command: 'createTestCaseFromJson',
                                    testCaseJson: JSON.parse(jsonData)
                                });
                            }
                        });
                        actionsDiv.appendChild(createButton);
                    }
                    
                    // Add file action buttons if LLM provided actions
                    if (fileActions && Array.isArray(fileActions) && fileActions.length > 0) {
                        fileActions.forEach(function(action) {
                            if (action.action === 'create_file') {
                                const createFileButton = document.createElement('button');
                                createFileButton.className = 'chat-action-button';
                                createFileButton.textContent = 'Создать файл: ' + (action.fileName || 'новый_файл.json');
                                createFileButton.addEventListener('click', function() {
                                    vscode.postMessage({
                                        command: 'executeFileAction',
                                        action: action.action,
                                        data: action
                                    });
                                });
                                actionsDiv.appendChild(createFileButton);
                            } else if (action.action === 'update_file') {
                                const updateFileButton = document.createElement('button');
                                updateFileButton.className = 'chat-action-button';
                                updateFileButton.textContent = 'Обновить текущий файл';
                                updateFileButton.addEventListener('click', function() {
                                    vscode.postMessage({
                                        command: 'executeFileAction',
                                        action: action.action,
                                        data: action
                                    });
                                });
                                actionsDiv.appendChild(updateFileButton);
                            } else if (action.action === 'create_file_from_current') {
                                const createFromCurrentButton = document.createElement('button');
                                createFromCurrentButton.className = 'chat-action-button';
                                createFromCurrentButton.textContent = 'Создать файл: ' + (action.fileName || 'новый_файл.json');
                                createFromCurrentButton.addEventListener('click', function() {
                                    vscode.postMessage({
                                        command: 'executeFileAction',
                                        action: action.action,
                                        data: action
                                    });
                                });
                                actionsDiv.appendChild(createFromCurrentButton);
                            }
                        });
                    }
                    
                    if (actionsDiv.children.length > 0) {
                        messageDiv.appendChild(actionsDiv);
                    }
                }
                
                chatMessages.appendChild(messageDiv);
                
                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                return messageId;
            }
            
            function extractTestCaseJson(text) {
                // Try to find JSON in the text (between code blocks or just JSON object)
                // Look for code block with json marker
                const backtick = String.fromCharCode(96);
                const codeBlockMarker = backtick + backtick + backtick;
                const codeBlockStart = text.indexOf(codeBlockMarker + 'json');
                if (codeBlockStart !== -1) {
                    const codeBlockEnd = text.indexOf(codeBlockMarker, codeBlockStart + 7);
                    if (codeBlockEnd !== -1) {
                        const jsonText = text.substring(codeBlockStart + 7, codeBlockEnd).trim();
                        try {
                            return JSON.parse(jsonText);
                        } catch (e) {
                            // Not valid JSON
                        }
                    }
                }
                
                // Try to find JSON object directly - look for opening brace
                const firstBrace = text.indexOf('{');
                if (firstBrace !== -1) {
                    // Try to find matching closing brace
                    let braceCount = 0;
                    let jsonEnd = -1;
                    for (let i = firstBrace; i < text.length; i++) {
                        if (text[i] === '{') braceCount++;
                        if (text[i] === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                jsonEnd = i;
                                break;
                            }
                        }
                    }
                    
                    if (jsonEnd !== -1) {
                        try {
                            const jsonText = text.substring(firstBrace, jsonEnd + 1);
                            const parsed = JSON.parse(jsonText);
                            // Check if it looks like a test case
                            if (parsed.id && parsed.name && Array.isArray(parsed.steps)) {
                                return parsed;
                            }
                        } catch (e) {
                            // Not valid JSON
                        }
                    }
                }
                
                return null;
            }
            
            function updateChatMessage(messageId, content, testCaseJson = null, fileActions = null) {
                const messageDiv = document.getElementById(messageId);
                if (messageDiv) {
                    const contentDiv = messageDiv.querySelector('.chat-message-content');
                    if (contentDiv) {
                        // Remove loading indicator if exists
                        const loading = contentDiv.querySelector('.chat-loading');
                        if (loading) {
                            contentDiv.innerHTML = '';
                        }
                        contentDiv.textContent = content;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                    
                    // Remove existing actions
                    const existingActions = messageDiv.querySelector('.chat-message-actions');
                    if (existingActions) {
                        existingActions.remove();
                    }
                    
                    // Add new action buttons
                    if (testCaseJson || (fileActions && fileActions.length > 0)) {
                        const actionsDiv = document.createElement('div');
                        actionsDiv.className = 'chat-message-actions';
                        
                        // Add create test case button if JSON is detected
                        if (testCaseJson) {
                            const createButton = document.createElement('button');
                            createButton.className = 'chat-action-button';
                            createButton.textContent = 'Создать тест-кейс';
                            createButton.setAttribute('data-test-case-json', JSON.stringify(testCaseJson));
                            createButton.addEventListener('click', function() {
                                const jsonData = this.getAttribute('data-test-case-json');
                                if (jsonData) {
                                    vscode.postMessage({
                                        command: 'createTestCaseFromJson',
                                        testCaseJson: JSON.parse(jsonData)
                                    });
                                }
                            });
                            actionsDiv.appendChild(createButton);
                        }
                        
                        // Add file action buttons if LLM provided actions
                        if (fileActions && Array.isArray(fileActions) && fileActions.length > 0) {
                            fileActions.forEach(function(action) {
                                if (action.action === 'create_file') {
                                    const createFileButton = document.createElement('button');
                                    createFileButton.className = 'chat-action-button';
                                    createFileButton.textContent = 'Создать файл: ' + (action.fileName || 'новый_файл.json');
                                    createFileButton.addEventListener('click', function() {
                                        vscode.postMessage({
                                            command: 'executeFileAction',
                                            action: action.action,
                                            data: action
                                        });
                                    });
                                    actionsDiv.appendChild(createFileButton);
                                } else if (action.action === 'update_file') {
                                    const updateFileButton = document.createElement('button');
                                    updateFileButton.className = 'chat-action-button';
                                    updateFileButton.textContent = 'Обновить текущий файл';
                                    updateFileButton.addEventListener('click', function() {
                                        vscode.postMessage({
                                            command: 'executeFileAction',
                                            action: action.action,
                                            data: action
                                        });
                                    });
                                    actionsDiv.appendChild(updateFileButton);
                                } else if (action.action === 'create_file_from_current') {
                                    const createFromCurrentButton = document.createElement('button');
                                    createFromCurrentButton.className = 'chat-action-button';
                                    createFromCurrentButton.textContent = 'Создать файл: ' + (action.fileName || 'новый_файл.json');
                                    createFromCurrentButton.addEventListener('click', function() {
                                        vscode.postMessage({
                                            command: 'executeFileAction',
                                            action: action.action,
                                            data: action
                                        });
                                    });
                                    actionsDiv.appendChild(createFromCurrentButton);
                                }
                            });
                        }
                        
                        if (actionsDiv.children.length > 0) {
                            messageDiv.appendChild(actionsDiv);
                        }
                    }
                }
            }
            
            // Handle chat messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                
                if (message.command === 'chatResponse') {
                    const loadingMessage = chatMessages.querySelector('.chat-message.assistant .chat-loading');
                    let testCaseJson = null;
                    
                    if (message.content && !message.error) {
                        testCaseJson = extractTestCaseJson(message.content);
                    }
                    
                    if (loadingMessage) {
                        const messageDiv = loadingMessage.closest('.chat-message');
                        if (messageDiv) {
                            const messageId = messageDiv.id;
                            if (message.error) {
                                updateChatMessage(messageId, 'Ошибка: ' + message.error);
                            } else {
                                updateChatMessage(messageId, message.content || '', testCaseJson, message.fileActions);
                            }
                        }
                    } else {
                        addChatMessage('assistant', message.content || message.error || '', false, testCaseJson, message.fileActions);
                    }
                    
                    // Update chat history
                    if (message.content && !message.error) {
                        chatHistory.push({ role: 'user', content: message.userMessage });
                        chatHistory.push({ role: 'assistant', content: message.content });
                        
                        // Save chat history
                        vscode.postMessage({
                            command: 'saveChatHistory',
                            history: chatHistory
                        });
                    }
                    
                    // Re-enable send button
                    if (chatSendButton && chatInput && chatModelSelect) {
                        chatSendButton.disabled = !chatInput.value.trim() || !chatModelSelect.value;
                    }
                }
                
                if (message.command === 'chatStateLoaded') {
                    // Restore saved model
                    if (message.model && chatModelSelect) {
                        // Wait for models to be loaded first
                        setTimeout(() => {
                            if (chatModelSelect.querySelector('option[value="' + message.model + '"]')) {
                                chatModelSelect.value = message.model;
                                if (chatSendButton && chatInput) {
                                    chatSendButton.disabled = !chatInput.value.trim() || !message.model;
                                }
                            }
                        }, 500);
                    }
                    
                    // Restore chat history
                    if (message.history && Array.isArray(message.history) && message.history.length > 0) {
                        chatHistory = message.history;
                        
                        // Re-render messages from history
                        if (chatMessages) {
                            const emptyMessage = chatMessages.querySelector('.chat-empty');
                            if (emptyMessage) {
                                emptyMessage.remove();
                            }
                            
                            // Render all messages from history
                            message.history.forEach(function(msg) {
                                if (msg.role === 'user' || msg.role === 'assistant') {
                                    addChatMessage(msg.role, msg.content, false, null, null);
                                }
                            });
                            
                            // Scroll to bottom
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }
                }
                
                if (message.command === 'llmModelsList' && chatModelSelect) {
                    // Update model select in chat tab
                    const currentValue = chatModelSelect.value;
                    chatModelSelect.innerHTML = '<option value="">Выберите модель...</option>';
                    
                    if (message.models && message.models.length > 0) {
                        message.models.forEach(model => {
                            const option = document.createElement('option');
                            option.value = model;
                            option.textContent = model;
                            chatModelSelect.appendChild(option);
                        });
                        
                        // Restore previous selection if it still exists
                        if (currentValue) {
                            const option = Array.from(chatModelSelect.options).find(opt => opt.value === currentValue);
                            if (option) {
                                chatModelSelect.value = currentValue;
                            }
                        }
                    }
                    
                    // Update send button state
                    if (chatSendButton && chatInput) {
                        chatSendButton.disabled = !chatInput.value.trim() || !chatModelSelect.value;
                    }
                }
            });
        })();
    </script>
</body>
</html>`;
    }
}
