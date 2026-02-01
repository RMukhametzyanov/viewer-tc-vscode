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
                        <div class="step-name">Шаг ${stepNumber}</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${step.status ? `<div class="step-status ${statusClass}">${this.getStatusLabel(step.status)}</div>` : ''}
                            <div class="step-actions">
                                <button class="step-action-btn" data-action="move-up" data-step-id="${this.escapeHtml(step.id || '')}" ${isFirst ? 'disabled' : ''} title="Переместить выше">↑</button>
                                <button class="step-action-btn" data-action="move-down" data-step-id="${this.escapeHtml(step.id || '')}" ${isLast ? 'disabled' : ''} title="Переместить ниже">↓</button>
                                <button class="step-action-btn" data-action="add-above" data-step-id="${this.escapeHtml(step.id || '')}" title="Добавить шаг выше">+↑</button>
                                <button class="step-action-btn" data-action="add-below" data-step-id="${this.escapeHtml(step.id || '')}" title="Добавить шаг ниже">+↓</button>
                                <button class="step-action-btn step-action-btn-danger" data-action="delete" data-step-id="${this.escapeHtml(step.id || '')}" title="Удалить шаг">×</button>
                            </div>
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
            padding: 20px;
            line-height: 1.6;
            margin: 0;
            transition: transform 0.1s ease;
            min-height: 100%;
            transform-origin: top left;
        }
        
        .container {
            max-width: 1200px;
            margin: 0;
        }
        
        h1 {
            font-size: 24px;
            margin-bottom: 24px;
            color: var(--vscode-textLink-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 12px;
        }
        
        .section {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 20px;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--vscode-textLink-foreground);
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
        
        .steps-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .step {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 16px;
            border-radius: 4px;
        }
        
        .step-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
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
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
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
        }
        
        .step-description-editable:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .step-expected {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            padding: 12px;
            border-radius: 4px;
            margin-top: 8px;
        }
        
        .step-expected-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
            font-weight: 500;
        }
        
        .step-expected-value {
            font-size: 14px;
            color: var(--vscode-foreground);
            white-space: pre-wrap;
        }
        
        .step-expected-value-editable {
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
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Case Viewer</h1>
        
        <div class="section">
            <div class="section-title">Информация о тест-кейсе</div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">ID:</div>
                    <div class="info-value">${this.escapeHtml(testCase.id || '')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Название:</div>
                    <input 
                        type="text" 
                        class="info-value-editable" 
                        id="test-case-name" 
                        value="${this.escapeHtml(testCase.name || '')}"
                        data-field="name"
                    />
                </div>
                <div class="info-item">
                    <div class="info-label">Test Case ID:</div>
                    <div class="info-value">${this.escapeHtml(testCase.testCaseId || '')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Статус:</div>
                    <select 
                        class="info-value-select" 
                        id="test-case-status" 
                        data-field="status"
                    >
                        <option value="Draft" ${testCase.status === 'Draft' ? 'selected' : ''}>Draft</option>
                        <option value="Design" ${testCase.status === 'Design' ? 'selected' : ''}>Design</option>
                        <option value="Review" ${testCase.status === 'Review' ? 'selected' : ''}>Review</option>
                        <option value="Done" ${testCase.status === 'Done' ? 'selected' : ''}>Done</option>
                    </select>
                </div>
                <div class="info-item">
                    <div class="info-label">Тип теста:</div>
                    <select 
                        class="info-value-select" 
                        id="test-case-type" 
                        data-field="testType"
                    >
                        <option value="Manual" ${testCase.testType === 'Manual' || testCase.testType === 'manual' ? 'selected' : ''}>Manual</option>
                        <option value="Hybrid" ${testCase.testType === 'Hybrid' || testCase.testType === 'hybrid' ? 'selected' : ''}>Hybrid</option>
                        <option value="Automated" ${testCase.testType === 'Automated' || testCase.testType === 'automated' ? 'selected' : ''}>Automated</option>
                    </select>
                </div>
                <div class="info-item">
                    <div class="info-label">Владелец:</div>
                    ${testers && testers.length > 0 ? `
                    <select 
                        class="info-value-select" 
                        id="test-case-owner" 
                        data-field="owner"
                    >
                        <option value="">-- Выберите --</option>
                        ${testers.map(tester => `<option value="${this.escapeHtml(tester)}" ${testCase.owner === tester ? 'selected' : ''}>${this.escapeHtml(tester)}</option>`).join('')}
                    </select>
                    ` : `
                    <div class="info-value">${this.escapeHtml(testCase.owner || '')}</div>
                    `}
                </div>
                <div class="info-item">
                    <div class="info-label">Автор:</div>
                    ${testers && testers.length > 0 ? `
                    <select 
                        class="info-value-select" 
                        id="test-case-author" 
                        data-field="author"
                    >
                        <option value="">-- Выберите --</option>
                        ${testers.map(tester => `<option value="${this.escapeHtml(tester)}" ${testCase.author === tester ? 'selected' : ''}>${this.escapeHtml(tester)}</option>`).join('')}
                    </select>
                    ` : `
                    <div class="info-value">${this.escapeHtml(testCase.author || '')}</div>
                    `}
                </div>
                <div class="info-item">
                    <div class="info-label">Reviewer:</div>
                    ${testers && testers.length > 0 ? `
                    <select 
                        class="info-value-select" 
                        id="test-case-reviewer" 
                        data-field="reviewer"
                    >
                        <option value="">-- Выберите --</option>
                        ${testers.map(tester => `<option value="${this.escapeHtml(tester)}" ${testCase.reviewer === tester ? 'selected' : ''}>${this.escapeHtml(tester)}</option>`).join('')}
                    </select>
                    ` : `
                    <div class="info-value">${this.escapeHtml(testCase.reviewer || '')}</div>
                    `}
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Epic / Feature / Story</div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">epic:</div>
                    <input 
                        type="text" 
                        class="info-value-editable" 
                        id="test-case-epic" 
                        data-field="epic"
                        value="${this.escapeHtml(testCase.epic || '')}"
                    />
                </div>
                <div class="info-item">
                    <div class="info-label">feature:</div>
                    <input 
                        type="text" 
                        class="info-value-editable" 
                        id="test-case-feature" 
                        data-field="feature"
                        value="${this.escapeHtml(testCase.feature || '')}"
                    />
                </div>
                <div class="info-item">
                    <div class="info-label">story:</div>
                    <input 
                        type="text" 
                        class="info-value-editable" 
                        id="test-case-story" 
                        data-field="story"
                        value="${this.escapeHtml(testCase.story || '')}"
                    />
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Описание</div>
            <textarea 
                class="description-editable" 
                id="test-case-description" 
                data-field="description"
                placeholder="Описание тест-кейса"
            >${this.escapeHtml(testCase.description || '')}</textarea>
        </div>
        
        <div class="section">
            <div class="section-title">Предусловие</div>
            <textarea 
                class="description-editable" 
                id="test-case-preconditions" 
                data-field="preconditions"
                placeholder="Предусловия для выполнения тест-кейса"
            >${this.escapeHtml(testCase.preconditions || '')}</textarea>
        </div>
        
        <div class="section">
            <div class="section-title">Шаги тестирования</div>
            <div class="steps-container">
                ${stepsHtml || '<div class="empty">Нет шагов тестирования</div>'}
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
        })();
    </script>
</body>
</html>`;
    }
}
