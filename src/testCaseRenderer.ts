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
    </style>
</head>
<body>
    <div class="container">
        <div class="tabs">
            <button class="tab active" data-tab="viewer">Viewer</button>
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
                tab.addEventListener('click', function() {
                    const targetTab = this.getAttribute('data-tab');
                    
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
        })();
    </script>
</body>
</html>`;
    }
}
