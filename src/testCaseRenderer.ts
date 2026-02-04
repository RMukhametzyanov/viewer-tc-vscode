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

interface ReviewComment {
    id: string;
    stepId: string;
    stepNumber: number;
    author: string;
    createdAt: number;
    comment: string;
    status: 'open' | 'resolved' | 'fixed';
    resolvedAt?: number;
    resolvedBy?: string;
    type?: 'suggestion' | 'question' | 'issue';
}

interface Notes {
    reviews?: ReviewComment[];
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

    static renderSteps(steps: TestStep[], reviews?: ReviewComment[], testers?: string[]): string {
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
            
            // Get reviews for this step (used in renderStepReviews)
            const stepReviews = reviews?.filter(r => r.stepId === step.id) || [];
            
            return `
                <div class="step" data-step-id="${this.escapeHtml(step.id || '')}" data-step-index="${index}">
                    <div class="step-header">
                        <div class="step-number">
                            Шаг ${stepNumber}
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
                    
                    ${this.renderStepReviews(stepReviews, step.id, stepNumber, testers || [])}
                </div>
            `;
        }).join('');
    }

    static renderStepReviews(reviews: ReviewComment[], stepId: string, stepNumber: number, testers: string[]): string {
        const totalReviews = reviews.length;
        const openReviews = reviews.filter(r => r.status === 'open').length;
        const sortedReviews = [...reviews].sort((a, b) => b.createdAt - a.createdAt);
        
        return `
            <div class="step-reviews" data-step-id="${this.escapeHtml(stepId)}">
                ${totalReviews > 0 ? `
                    <div class="step-reviews-header">
                        <button class="step-reviews-toggle" data-step-id="${this.escapeHtml(stepId)}" title="Показать/скрыть комментарии">
                            <span class="step-reviews-toggle-icon">▼</span>
                            <span class="step-reviews-count">Комментарии (всего ${totalReviews}${openReviews > 0 ? `, открытых ${openReviews}` : ''})</span>
                        </button>
                    </div>
                    <div class="step-reviews-content collapsed" data-step-id="${this.escapeHtml(stepId)}">
                        <div class="step-reviews-list">
                        ${sortedReviews.map(review => {
                            const statusClass = review.status === 'open' ? 'open' : review.status === 'resolved' ? 'resolved' : 'fixed';
                            const statusLabel = review.status === 'open' ? 'Открыто' : review.status === 'resolved' ? 'Исправлено' : 'Закрыто';
                            const date = new Date(review.createdAt).toLocaleString('ru-RU');
                            const resolvedDate = review.resolvedAt ? new Date(review.resolvedAt).toLocaleString('ru-RU') : '';
                            
                            return `
                                <div class="step-review-item" data-review-id="${this.escapeHtml(review.id)}" data-status="${review.status}">
                                    <div class="step-review-item-header">
                                        <div class="step-review-item-meta">
                                            <span class="step-review-author">${this.escapeHtml(review.author)}</span>
                                            <span class="step-review-date">${date}</span>
                                        </div>
                                        <div class="step-review-item-actions">
                                            <select class="step-review-status-select" data-review-id="${this.escapeHtml(review.id)}">
                                                <option value="open" ${review.status === 'open' ? 'selected' : ''}>Открыто</option>
                                                <option value="resolved" ${review.status === 'resolved' ? 'selected' : ''}>Исправлено</option>
                                                <option value="fixed" ${review.status === 'fixed' ? 'selected' : ''}>Закрыто</option>
                                            </select>
                                            <button class="step-review-delete-btn" data-review-id="${this.escapeHtml(review.id)}" title="Удалить комментарий">×</button>
                                        </div>
                                    </div>
                                    <div class="step-review-item-content">
                                        <div class="step-review-comment">${this.escapeHtml(review.comment)}</div>
                                        ${review.resolvedAt && review.resolvedBy ? `
                                            <div class="step-review-resolved-info">
                                                ${statusLabel} ${review.resolvedBy ? 'пользователем ' + this.escapeHtml(review.resolvedBy) : ''} ${resolvedDate ? 'в ' + resolvedDate : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                        </div>
                        <div class="step-reviews-add">
                            <textarea 
                                class="step-review-input" 
                                data-step-id="${this.escapeHtml(stepId)}"
                                placeholder="Добавить комментарий..."
                                rows="2"
                            ></textarea>
                            <button class="step-review-add-btn" data-step-id="${this.escapeHtml(stepId)}" title="Добавить комментарий">Добавить</button>
                        </div>
                    </div>
                ` : `
                    <div class="step-reviews-add">
                        <textarea 
                            class="step-review-input" 
                            data-step-id="${this.escapeHtml(stepId)}"
                            placeholder="Добавить комментарий..."
                            rows="2"
                        ></textarea>
                        <button class="step-review-add-btn" data-step-id="${this.escapeHtml(stepId)}" title="Добавить комментарий">Добавить</button>
                    </div>
                `}
            </div>
        `;
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

    static render(testCase: TestCase, documentUri?: string, testers?: string[], tags?: string[]): string {
        // Parse reviews from notes - notes is now a direct array
        let reviews: ReviewComment[] = [];
        if (testCase.notes && Array.isArray(testCase.notes)) {
            reviews = testCase.notes;
        } else if (testCase.notes && typeof testCase.notes === 'object' && testCase.notes.reviews) {
            // Support old format for backward compatibility
            reviews = Array.isArray(testCase.notes.reviews) ? testCase.notes.reviews : [];
        }
        
        const stepsHtml = this.renderSteps(testCase.steps || [], reviews, testers || []);
        
        // Parse tags from string (comma-separated) or array
        let currentTags: string[] = [];
        if (testCase.tags) {
            if (typeof testCase.tags === 'string') {
                currentTags = testCase.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
            } else if (Array.isArray(testCase.tags)) {
                currentTags = testCase.tags;
            }
        }

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
            margin-top: 16px;
            padding: 12px;
            border-radius: 4px;
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            font-size: 13px;
        }
        
        .step-expected-label {
            font-size: 12px;
            color: var(--vscode-textBlockQuote-foreground);
            font-weight: 600;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .step-expected-value {
            font-size: 14px;
            color: var(--vscode-foreground);
            white-space: pre-wrap;
        }
        
        .step-expected-value-editable {
            font-size: 13px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-textBlockQuote-border);
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
            outline: 2px solid var(--vscode-textBlockQuote-border);
            outline-offset: -1px;
            border-color: var(--vscode-textBlockQuote-border);
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
        
        .tags-container {
            margin-bottom: 16px;
        }
        
        .tags-input-wrapper {
            position: relative;
            margin-bottom: 12px;
        }
        
        .tags-input {
            width: 100%;
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            box-sizing: border-box;
        }
        
        .tags-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .tags-autocomplete {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 2px;
            margin-top: 2px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .tags-autocomplete.visible {
            display: block;
        }
        
        .tags-autocomplete-item {
            padding: 6px 8px;
            cursor: pointer;
            font-size: 14px;
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .tags-autocomplete-item:last-child {
            border-bottom: none;
        }
        
        .tags-autocomplete-item:hover,
        .tags-autocomplete-item.selected {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .tags-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .tag-item {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
        }
        
        .tag-text {
            user-select: none;
        }
        
        .tag-remove {
            background: transparent;
            border: none;
            color: var(--vscode-editor-background);
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            padding: 0;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 2px;
            transition: background-color 0.2s;
        }
        
        .tag-remove:hover {
            background-color: rgba(0, 0, 0, 0.2);
        }
        
        /* Step reviews styles */
        .step-reviews {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        .step-reviews-header {
            margin-bottom: 12px;
        }
        
        .step-reviews-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            background: transparent;
            border: none;
            padding: 4px 8px;
            cursor: pointer;
            color: var(--vscode-foreground);
            font-size: 13px;
            font-family: var(--vscode-font-family);
            transition: background-color 0.2s;
            border-radius: 2px;
        }
        
        .step-reviews-toggle:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .step-reviews-toggle-icon {
            display: inline-block;
            transition: transform 0.2s;
            font-size: 10px;
        }
        
        .step-reviews-toggle.expanded .step-reviews-toggle-icon {
            transform: rotate(180deg);
        }
        
        .step-reviews-count {
            font-weight: 500;
        }
        
        .step-reviews-content {
            overflow: hidden;
            transition: max-height 0.3s ease, opacity 0.3s ease, margin-bottom 0.3s ease;
            max-height: 0;
            opacity: 0;
            margin-bottom: 0;
        }
        
        .step-reviews-content.expanded {
            max-height: 5000px;
            opacity: 1;
            margin-bottom: 12px;
        }
        
        .step-reviews-content.collapsed {
            max-height: 0;
            opacity: 0;
            margin-bottom: 0;
        }
        
        .step-reviews-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 12px;
        }
        
        .step-review-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            transition: border-color 0.2s;
        }
        
        .step-review-item[data-status="open"] {
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
        
        .step-review-item[data-status="resolved"] {
            border-left: 3px solid var(--vscode-inputValidation-infoForeground);
        }
        
        .step-review-item[data-status="fixed"] {
            border-left: 3px solid var(--vscode-descriptionForeground);
            opacity: 0.8;
        }
        
        .step-review-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .step-review-item-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        
        .step-review-author {
            font-weight: 600;
            color: var(--vscode-foreground);
            font-size: 13px;
        }
        
        .step-review-date {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .step-review-item-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .step-review-status-select {
            font-size: 12px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 6px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            cursor: pointer;
        }
        
        .step-review-delete-btn {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .step-review-delete-btn:hover {
            opacity: 0.8;
        }
        
        .step-review-item-content {
            margin-top: 8px;
        }
        
        .step-review-comment {
            font-size: 14px;
            color: var(--vscode-foreground);
            white-space: pre-wrap;
            line-height: 1.6;
            margin-bottom: 8px;
        }
        
        .step-review-resolved-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        .step-reviews-add {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .step-review-input {
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            width: 100%;
            resize: vertical;
            white-space: pre-wrap;
            box-sizing: border-box;
        }
        
        .step-review-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .step-review-add-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            align-self: flex-start;
        }
        
        .step-review-add-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        /* Review styles */
        .step-review-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 3px;
            margin-left: 8px;
            transition: background-color 0.2s;
        }
        
        .step-review-indicator:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .step-review-indicator.has-open {
            color: var(--vscode-textLink-foreground);
            font-weight: 600;
        }
        
        .step-review-indicator.has-resolved {
            color: var(--vscode-inputValidation-infoForeground);
            font-weight: 600;
        }
        
        .step-review-indicator.has-resolved::before {
            content: '✓';
            display: inline-block;
            margin-right: 4px;
            font-size: 14px;
            line-height: 1;
        }
        
        .step-review-indicator.has-fixed {
            color: var(--vscode-inputValidation-infoForeground);
            font-weight: 600;
            opacity: 0.8;
        }
        
        .step-review-indicator.has-fixed::before {
            content: '✓';
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
            font-size: 11px;
            margin-right: 4px;
            font-weight: bold;
        }
        
        .review-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            flex-wrap: wrap;
            gap: 16px;
        }
        
        .review-stats {
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
        }
        
        .review-stat-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
        }
        
        .review-stat-label {
            color: var(--vscode-descriptionForeground);
        }
        
        .review-stat-value {
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .review-stat-value.open {
            color: var(--vscode-textLink-foreground);
        }
        
        .review-stat-value.resolved {
            color: var(--vscode-inputValidation-infoForeground);
        }
        
        .review-stat-value.fixed {
            color: var(--vscode-inputValidation-infoForeground);
            opacity: 0.7;
        }
        
        .review-filters {
            display: flex;
            gap: 8px;
        }
        
        .review-filter-select {
            font-size: 13px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            cursor: pointer;
        }
        
        .review-filter-select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .review-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 24px;
        }
        
        .review-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
            transition: border-color 0.2s;
        }
        
        .review-item[data-status="open"] {
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
        
        .review-item[data-status="resolved"] {
            border-left: 3px solid var(--vscode-inputValidation-infoForeground);
        }
        
        .review-item[data-status="fixed"] {
            border-left: 3px solid var(--vscode-descriptionForeground);
            opacity: 0.8;
        }
        
        .review-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .review-item-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        
        .review-step-badge {
            background-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
        }
        
        .review-author {
            font-weight: 600;
            color: var(--vscode-foreground);
            font-size: 13px;
        }
        
        .review-date {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .review-item-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .review-status-select {
            font-size: 12px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 6px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            cursor: pointer;
        }
        
        .review-delete-btn {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .review-delete-btn:hover {
            opacity: 0.8;
        }
        
        .review-item-content {
            margin-top: 8px;
        }
        
        .review-comment {
            font-size: 14px;
            color: var(--vscode-foreground);
            white-space: pre-wrap;
            line-height: 1.6;
            margin-bottom: 8px;
        }
        
        .review-resolved-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        .review-add-section {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
        }
        
        .review-add-header {
            margin-bottom: 12px;
        }
        
        .review-add-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .review-add-form {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .review-add-step-select {
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 6px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            cursor: pointer;
        }
        
        .review-add-comment-input {
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
            box-sizing: border-box;
        }
        
        .review-add-comment-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .review-add-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            align-self: flex-start;
        }
        
        .review-add-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="tabs">
            <button class="tab active" data-tab="viewer">Viewer</button>
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
            
            <div class="viewer-section-title">Теги</div>
            <div class="tags-container">
                <div class="tags-input-wrapper">
                    <input 
                        type="text" 
                        class="tags-input" 
                        id="tags-input" 
                        placeholder="Введите тег для поиска или создания нового"
                        autocomplete="off"
                    />
                    <div class="tags-autocomplete" id="tags-autocomplete"></div>
                </div>
                <div class="tags-list" id="tags-list">
                    ${currentTags.map(tag => `
                        <span class="tag-item">
                            <span class="tag-text">${this.escapeHtml(tag)}</span>
                            <button class="tag-remove" data-tag="${this.escapeHtml(tag)}" title="Удалить тег">×</button>
                        </span>
                    `).join('')}
                </div>
            </div>
            
            <div class="viewer-steps">
                <div class="viewer-steps-title">Шаги тестирования</div>
                <div class="steps-container">
                    ${stepsHtml || '<div class="empty">Нет шагов тестирования</div>'}
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
            
            // Handle tags input with autocomplete
            const tagsInput = document.getElementById('tags-input');
            const tagsAutocomplete = document.getElementById('tags-autocomplete');
            const tagsList = document.getElementById('tags-list');
            const currentTags = ${JSON.stringify(currentTags)};
            const availableTags = ${JSON.stringify(tags || [])};
            let selectedAutocompleteIndex = -1;
            let filteredTags = [];
            
            function updateTagsField() {
                const tagItems = tagsList.querySelectorAll('.tag-item .tag-text');
                const tagsArray = Array.from(tagItems).map(item => item.textContent.trim()).filter(t => t.length > 0);
                const tagsValue = tagsArray.join(', ');
                vscode.postMessage({
                    command: 'updateField',
                    field: 'tags',
                    value: tagsValue
                });
            }
            
            function addTag(tagText) {
                if (!tagText || tagText.trim().length === 0) return;
                
                const trimmedTag = tagText.trim();
                const existingTags = Array.from(tagsList.querySelectorAll('.tag-item .tag-text')).map(item => item.textContent.trim());
                
                if (existingTags.includes(trimmedTag)) {
                    return; // Tag already exists
                }
                
                const tagItem = document.createElement('span');
                tagItem.className = 'tag-item';
                const escapedTag = trimmedTag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                tagItem.innerHTML = '<span class="tag-text">' + escapedTag + '</span><button class="tag-remove" data-tag="' + escapedTag + '" title="Удалить тег">×</button>';
                
                const removeBtn = tagItem.querySelector('.tag-remove');
                if (removeBtn) {
                    removeBtn.addEventListener('click', function() {
                        tagItem.remove();
                        updateTagsField();
                    });
                }
                
                tagsList.appendChild(tagItem);
                updateTagsField();
                
                // If tag is not in available tags, add it to config
                if (!availableTags.includes(trimmedTag)) {
                    vscode.postMessage({
                        command: 'addTag',
                        tag: trimmedTag
                    });
                }
                
                // Clear input and hide autocomplete
                tagsInput.value = '';
                hideAutocomplete();
            }
            
            function filterTags(query) {
                if (!query || query.trim().length === 0) {
                    return availableTags.filter(tag => !currentTags.includes(tag));
                }
                
                const lowerQuery = query.toLowerCase();
                return availableTags.filter(tag => {
                    const lowerTag = tag.toLowerCase();
                    return lowerTag.includes(lowerQuery) && !currentTags.includes(tag);
                });
            }
            
            function showAutocomplete(tags) {
                if (!tagsAutocomplete) return;
                
                filteredTags = tags;
                selectedAutocompleteIndex = -1;
                
                if (tags.length === 0) {
                    tagsAutocomplete.classList.remove('visible');
                    return;
                }
                
                tagsAutocomplete.innerHTML = tags.map((tag, index) => {
                    const escapedTag = tag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    return '<div class="tags-autocomplete-item" data-index="' + index + '" data-tag="' + escapedTag + '">' + escapedTag + '</div>';
                }).join('');
                
                tagsAutocomplete.classList.add('visible');
                
                // Add click handlers
                const items = tagsAutocomplete.querySelectorAll('.tags-autocomplete-item');
                items.forEach(item => {
                    item.addEventListener('click', function() {
                        const tag = this.getAttribute('data-tag');
                        addTag(tag);
                    });
                });
            }
            
            function hideAutocomplete() {
                if (tagsAutocomplete) {
                    tagsAutocomplete.classList.remove('visible');
                    selectedAutocompleteIndex = -1;
                }
            }
            
            function updateAutocompleteSelection() {
                const items = tagsAutocomplete.querySelectorAll('.tags-autocomplete-item');
                items.forEach((item, index) => {
                    if (index === selectedAutocompleteIndex) {
                        item.classList.add('selected');
                        item.scrollIntoView({ block: 'nearest' });
                    } else {
                        item.classList.remove('selected');
                    }
                });
            }
            
            if (tagsInput) {
                tagsInput.addEventListener('input', function(e) {
                    const query = e.target.value;
                    const filtered = filterTags(query);
                    showAutocomplete(filtered);
                });
                
                tagsInput.addEventListener('keydown', function(e) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (filteredTags.length > 0) {
                            selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, filteredTags.length - 1);
                            updateAutocompleteSelection();
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (filteredTags.length > 0) {
                            selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
                            updateAutocompleteSelection();
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedAutocompleteIndex >= 0 && selectedAutocompleteIndex < filteredTags.length) {
                            addTag(filteredTags[selectedAutocompleteIndex]);
                        } else {
                            const tagText = tagsInput.value.trim();
                            if (tagText.length > 0) {
                                addTag(tagText);
                            }
                        }
                    } else if (e.key === 'Escape') {
                        hideAutocomplete();
                    }
                });
                
                tagsInput.addEventListener('blur', function() {
                    // Delay to allow click on autocomplete item
                    setTimeout(() => {
                        hideAutocomplete();
                    }, 200);
                });
                
                tagsInput.addEventListener('focus', function() {
                    const query = tagsInput.value;
                    const filtered = filterTags(query);
                    showAutocomplete(filtered);
                });
            }
            
            // Handle remove buttons for existing tags
            const tagRemoveButtons = document.querySelectorAll('.tag-remove');
            tagRemoveButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    const tagItem = btn.closest('.tag-item');
                    if (tagItem) {
                        tagItem.remove();
                        updateTagsField();
                    }
                });
            });
            
            // Handle step review deletion - use event delegation with capture phase (register FIRST)
            document.addEventListener('click', function(e) {
                if (!e || !e.target) return;
                
                const target = e.target;
                let deleteBtn = null;
                
                // Check if target is the button itself
                if (target.nodeType === 1 && target.classList && target.classList.contains('step-review-delete-btn')) {
                    deleteBtn = target;
                } else if (target.closest) {
                    // Check if target is inside the button
                    deleteBtn = target.closest('.step-review-delete-btn');
                } else {
                    // Fallback: traverse up the DOM tree
                    let element = target.parentElement;
                    while (element && element !== document.body) {
                        if (element.classList && element.classList.contains('step-review-delete-btn')) {
                            deleteBtn = element;
                            break;
                        }
                        element = element.parentElement;
                    }
                }
                
                if (deleteBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    const reviewId = deleteBtn.getAttribute('data-review-id');
                    if (reviewId) {
                        if (confirm('Удалить этот комментарий?')) {
                            console.log('Sending deleteReview command with reviewId:', reviewId);
                            vscode.postMessage({
                                command: 'deleteReview',
                                reviewId: reviewId
                            });
                        }
                    } else {
                        console.error('No reviewId found on delete button');
                    }
                    return false;
                }
            }, true); // Use capture phase to catch event early
            
            // Handle step reviews toggle (expand/collapse) - use event delegation
            document.addEventListener('click', function(e) {
                const target = e.target;
                // Skip if this is a delete button click
                if (target && (target.classList.contains('step-review-delete-btn') || target.closest('.step-review-delete-btn'))) {
                    return;
                }
                if (target && target.closest('.step-reviews-toggle')) {
                    const toggle = target.closest('.step-reviews-toggle');
                    const stepId = toggle.getAttribute('data-step-id');
                    const reviewsContent = document.querySelector('.step-reviews-content[data-step-id="' + stepId + '"]');
                    if (reviewsContent) {
                        const isExpanded = reviewsContent.classList.contains('expanded');
                        if (isExpanded) {
                            reviewsContent.classList.remove('expanded');
                            reviewsContent.classList.add('collapsed');
                            toggle.classList.remove('expanded');
                        } else {
                            reviewsContent.classList.remove('collapsed');
                            reviewsContent.classList.add('expanded');
                            toggle.classList.add('expanded');
                        }
                    }
                }
            });
            
            // Handle step review status changes - use event delegation
            document.addEventListener('change', function(e) {
                const target = e.target;
                if (target && target.classList.contains('step-review-status-select')) {
                    const reviewId = target.getAttribute('data-review-id');
                    const newStatus = target.value;
                    if (reviewId) {
                        vscode.postMessage({
                            command: 'updateReviewStatus',
                            reviewId: reviewId,
                            status: newStatus
                        });
                    }
                }
            });
            
            // Handle add review from step - use event delegation
            document.addEventListener('click', function(e) {
                const target = e.target;
                if (target && target.classList.contains('step-review-add-btn')) {
                    const stepId = target.getAttribute('data-step-id');
                    const reviewsSection = target.closest('.step-reviews');
                    if (reviewsSection) {
                        const commentInput = reviewsSection.querySelector('.step-review-input');
                        if (commentInput) {
                            const comment = commentInput.value.trim();
                            if (!comment) {
                                alert('Введите комментарий');
                                return;
                            }
                            
                            vscode.postMessage({
                                command: 'addReview',
                                stepId: stepId,
                                comment: comment
                            });
                            
                            commentInput.value = '';
                            
                            // Auto-expand reviews content after adding comment
                            const reviewsContent = reviewsSection.querySelector('.step-reviews-content');
                            const toggle = reviewsSection.querySelector('.step-reviews-toggle');
                            if (reviewsContent && toggle) {
                                reviewsContent.classList.remove('collapsed');
                                reviewsContent.classList.add('expanded');
                                toggle.classList.add('expanded');
                            }
                        }
                    }
                }
            });
            
            // Handle Enter key in step review input (Ctrl+Enter to submit) - use event delegation
            document.addEventListener('keydown', function(e) {
                const target = e.target;
                if (target && target.classList.contains('step-review-input')) {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        const stepId = target.getAttribute('data-step-id');
                        const comment = target.value.trim();
                        if (comment) {
                            vscode.postMessage({
                                command: 'addReview',
                                stepId: stepId,
                                comment: comment
                            });
                            target.value = '';
                            
                            // Auto-expand reviews content after adding comment
                            const reviewsSection = target.closest('.step-reviews');
                            if (reviewsSection) {
                                const reviewsContent = reviewsSection.querySelector('.step-reviews-content');
                                const toggle = reviewsSection.querySelector('.step-reviews-toggle');
                                if (reviewsContent && toggle) {
                                    reviewsContent.classList.remove('collapsed');
                                    reviewsContent.classList.add('expanded');
                                    toggle.classList.add('expanded');
                                }
                            }
                        }
                    }
                }
            });
        })();
    </script>
</body>
</html>`;
    }
}
