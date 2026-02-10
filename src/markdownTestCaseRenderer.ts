import { MarkdownTestCase, MarkdownTestStep } from './markdownTestCaseParser';

export class MarkdownTestCaseRenderer {
    public static escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    public static render(testCase: MarkdownTestCase, documentUri?: string, testers?: string[]): string {
        const testersList = testers || [];

        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Test Case Viewer</title>
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
            min-height: 100%;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
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
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
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
            transition: max-height 0.3s ease, opacity 0.3s ease;
        }
        
        .section-content.collapsed {
            max-height: 0 !important;
            opacity: 0;
            padding: 0;
        }

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
            background: transparent;
            border: none;
            padding: 0;
            width: 100%;
            font-family: var(--vscode-font-family);
        }
        
        .viewer-title:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
            border-radius: 2px;
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
        
        .viewer-meta-select option {
            background-color: var(--vscode-dropdown-background) !important;
            color: var(--vscode-dropdown-foreground) !important;
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

        .info-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .info-item {
            display: flex;
            flex-direction: row;
            align-items: baseline;
        }

        .info-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            font-weight: 500;
            margin-right: 8px;
            flex-shrink: 0;
            min-width: 80px;
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
        
        .viewer-steps {
            margin-top: 16px;
        }
        
        .viewer-steps-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 20px;
        }
        
        .steps-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        .steps-table th,
        .steps-table td {
            padding: 12px;
            text-align: left;
            border: 1px solid var(--vscode-panel-border);
            vertical-align: top;
        }

        .steps-table th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .steps-table td {
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
        }

        .steps-table .step-cell {
            width: 50px;
            text-align: center;
        }

        .steps-table .action-cell {
            min-width: 200px;
        }

        .steps-table .expected-cell {
            min-width: 200px;
        }

        .steps-table .attachments-cell {
            width: 100px;
        }

        .steps-table .status-cell {
            width: 100px;
        }

        .step-cell-editable {
            width: 100%;
            border: none;
            background: transparent;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: 14px;
            padding: 4px;
            resize: none;
            overflow: hidden;
            min-height: 20px;
            box-sizing: border-box;
        }

        .step-cell-editable:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .tags-container {
            margin-bottom: 16px;
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

        .links-list {
            list-style: none;
            padding: 0;
        }

        .links-list li {
            margin-bottom: 8px;
        }

        .links-list input {
            width: 100%;
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
        }

        .links-list input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .comments-list {
            list-style: none;
            padding: 0;
        }

        .comments-list li {
            margin-bottom: 8px;
            padding: 8px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
        }

        .comments-list input {
            width: 100%;
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
        }

        .comments-list input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
    </style>
</head>
<body>
    <div class="container">
        ${this._renderContent(testCase, testersList)}
    </div>
    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            let focusedElement = null;

            // Section collapse/expand
            document.querySelectorAll('.section-title').forEach(title => {
                title.addEventListener('click', () => {
                    const section = title.closest('.section');
                    const content = section.querySelector('.section-content');
                    const toggle = title.querySelector('.section-toggle');
                    
                    if (content && toggle) {
                        const isCollapsed = content.classList.contains('collapsed');
                        if (isCollapsed) {
                            content.classList.remove('collapsed');
                            toggle.classList.remove('collapsed');
                        } else {
                            content.classList.add('collapsed');
                            toggle.classList.add('collapsed');
                        }
                    }
                });
            });

            // Track focus state
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

            // Auto-resize textareas in table cells
            function autoResizeTextarea(textarea) {
                textarea.style.height = 'auto';
                const scrollHeight = textarea.scrollHeight;
                textarea.style.height = Math.max(20, scrollHeight) + 'px';
            }

            document.querySelectorAll('.step-cell-editable').forEach(textarea => {
                autoResizeTextarea(textarea);
                textarea.addEventListener('input', function() {
                    autoResizeTextarea(this);
                });
                // Also resize on focus to ensure proper height
                textarea.addEventListener('focus', function() {
                    autoResizeTextarea(this);
                });
            });

            // Handle field updates
            document.querySelectorAll('[data-field]').forEach(element => {
                element.addEventListener('blur', function() {
                    const field = this.getAttribute('data-field');
                    const value = this.value || this.textContent || '';
                    vscode.postMessage({
                        command: 'updateField',
                        field: field,
                        value: value
                    });
                });
            });

            // Handle metadata dropdowns
            document.querySelectorAll('.viewer-meta-select').forEach(select => {
                select.addEventListener('change', function() {
                    const field = this.getAttribute('data-field');
                    const value = this.value;
                    vscode.postMessage({
                        command: 'updateMetadata',
                        field: field,
                        value: value
                    });
                });
            });

            // Handle step updates
            document.querySelectorAll('[data-step-field]').forEach(element => {
                element.addEventListener('blur', function() {
                    const stepIndex = parseInt(this.getAttribute('data-step-index') || '0');
                    const field = this.getAttribute('data-step-field');
                    const value = this.value || '';
                    vscode.postMessage({
                        command: 'updateStep',
                        stepIndex: stepIndex,
                        field: field,
                        value: value
                    });
                });
            });
        })();
    </script>
</body>
</html>`;
    }

    private static _renderContent(testCase: MarkdownTestCase, testers: string[]): string {
        return `
            <div class="viewer-header">
                <input 
                    type="text" 
                    class="viewer-title" 
                    id="test-case-title" 
                    value="${this.escapeHtml(testCase.title || '')}"
                    data-field="title"
                />
                <div class="viewer-meta" id="metadata">
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">ID:</span>
                        <span>${this.escapeHtml(testCase.metadata.id || '')}</span>
                    </div>
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">Статус:</span>
                        <select 
                            class="viewer-meta-select" 
                            id="test-case-status" 
                            data-field="status"
                        >
                            <option value="Draft" ${testCase.metadata.status === 'Draft' || testCase.metadata.status === 'Готов' ? 'selected' : ''}>Draft</option>
                            <option value="Design" ${testCase.metadata.status === 'Design' ? 'selected' : ''}>Design</option>
                            <option value="Review" ${testCase.metadata.status === 'Review' ? 'selected' : ''}>Review</option>
                            <option value="Done" ${testCase.metadata.status === 'Done' ? 'selected' : ''}>Done</option>
                        </select>
                    </div>
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">Тип:</span>
                        <select 
                            class="viewer-meta-select" 
                            id="test-case-type" 
                            data-field="testType"
                        >
                            <option value="Manual" ${testCase.metadata.testType === 'Manual' || testCase.metadata.testType === 'Ручной' ? 'selected' : ''}>Manual</option>
                            <option value="Hybrid" ${testCase.metadata.testType === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
                            <option value="Automated" ${testCase.metadata.testType === 'Automated' ? 'selected' : ''}>Automated</option>
                        </select>
                    </div>
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">Владелец:</span>
                        ${testers.length > 0 ? `
                        <select 
                            class="viewer-meta-select" 
                            id="test-case-owner" 
                            data-field="owner"
                        >
                            <option value="">-- Выберите --</option>
                            ${testers.map(tester => `<option value="${this.escapeHtml(tester)}" ${testCase.metadata.owner === tester ? 'selected' : ''}>${this.escapeHtml(tester)}</option>`).join('')}
                        </select>
                        ` : `
                        <span>${this.escapeHtml(testCase.metadata.owner || '')}</span>
                        `}
                    </div>
                    <div class="viewer-meta-item">
                        <span class="viewer-meta-label">Автор:</span>
                        ${testers.length > 0 ? `
                        <select 
                            class="viewer-meta-select" 
                            id="test-case-author" 
                            data-field="author"
                        >
                            <option value="">-- Выберите --</option>
                            ${testers.map(tester => `<option value="${this.escapeHtml(tester)}" ${testCase.metadata.author === tester ? 'selected' : ''}>${this.escapeHtml(tester)}</option>`).join('')}
                        </select>
                        ` : `
                        <span>${this.escapeHtml(testCase.metadata.author || '')}</span>
                        `}
                    </div>
                </div>
            </div>
            
            ${this._renderSection('links', 'Связи', this._renderLinks(testCase.links || []))}
            ${this._renderSection('epic-feature-story', 'Epic/Feature/Story', this._renderEpicFeatureStory(testCase.epicFeatureStory))}
            ${this._renderSection('tags', 'Теги (tags)', this._renderTags(testCase.tags || []))}
            ${this._renderSection('description', 'Описание (description)', this._renderDescription(testCase.description || ''), true, true)}
            ${this._renderSection('preconditions', 'Предусловия (preconditions)', this._renderPreconditions(testCase.preconditions || ''), true, true)}
            ${this._renderSection('steps', 'Шаги тестирования', this._renderSteps(testCase.steps || []))}
            ${this._renderSection('comments', 'Комментарии', this._renderComments(testCase.comments || []))}
        `;
    }

    private static _renderSection(id: string, title: string, content: string, collapsible: boolean = false, collapsed: boolean = false): string {
        return `
            <div class="section" id="${id}">
                <div class="section-title ${collapsible ? 'collapsible' : ''}">
                    <span>${this.escapeHtml(title)}</span>
                    ${collapsible ? `<span class="section-toggle ${collapsed ? 'collapsed' : ''}">▼</span>` : ''}
                </div>
                <div class="section-content ${collapsible && collapsed ? 'collapsed' : ''}">
                    ${content}
                </div>
            </div>
        `;
    }

    private static _renderLinks(links: string[]): string {
        if (links.length === 0) {
            return `
                <ul class="links-list">
                    <li><input type="text" data-field="link-0" placeholder="[Задача](https://..)" value="[Задача](https..)" /></li>
                    <li><input type="text" data-field="link-1" placeholder="[Связанный тест-кейс](https://..)" value="[Связанный тест-кейс](https://..)" /></li>
                </ul>
            `;
        }
        return `
            <ul class="links-list">
                ${links.map((link, index) => 
                    `<li><input type="text" data-field="link-${index}" value="${this.escapeHtml(link)}" /></li>`
                ).join('')}
            </ul>
        `;
    }

    private static _renderEpicFeatureStory(efs: { epic?: string; feature?: string; story?: string }): string {
        return `
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Epic</span>
                    <input type="text" class="info-value-editable" data-field="epic" value="${this.escapeHtml(efs.epic || '')}" />
                </div>
                <div class="info-item">
                    <span class="info-label">Feature</span>
                    <input type="text" class="info-value-editable" data-field="feature" value="${this.escapeHtml(efs.feature || '')}" />
                </div>
                <div class="info-item">
                    <span class="info-label">Story</span>
                    <input type="text" class="info-value-editable" data-field="story" value="${this.escapeHtml(efs.story || '')}" />
                </div>
            </div>
        `;
    }

    private static _renderTags(tags: string[]): string {
        const tagsString = tags.join(', ');
        return `
            <div class="tags-container">
                <input 
                    type="text" 
                    class="tags-input" 
                    id="tags-input" 
                    data-field="tags"
                    value="${this.escapeHtml(tagsString)}"
                    placeholder="smoke, regress"
                />
            </div>
        `;
    }

    private static _renderDescription(description: string): string {
        return `
            <textarea 
                class="viewer-description" 
                id="test-case-description" 
                data-field="description"
                placeholder="Описание тест-кейса"
            >${this.escapeHtml(description)}</textarea>
        `;
    }

    private static _renderPreconditions(preconditions: string): string {
        return `
            <textarea 
                class="viewer-description" 
                id="test-case-preconditions" 
                data-field="preconditions"
                placeholder="Предусловия для выполнения тест-кейса"
            >${this.escapeHtml(preconditions)}</textarea>
        `;
    }

    private static _renderSteps(steps: MarkdownTestStep[]): string {
        if (steps.length === 0) {
            return '<div class="empty">Нет шагов тестирования</div>';
        }

        const rows = steps.map((step, index) => `
            <tr>
                <td class="step-cell">${step.stepNumber || index + 1}</td>
                <td class="action-cell">
                    <textarea 
                        class="step-cell-editable" 
                        data-step-index="${index}"
                        data-step-field="action"
                        rows="1"
                    >${this.escapeHtml(step.action || '')}</textarea>
                </td>
                <td class="expected-cell">
                    <textarea 
                        class="step-cell-editable" 
                        data-step-index="${index}"
                        data-step-field="expectedResult"
                        rows="1"
                    >${this.escapeHtml(step.expectedResult || '')}</textarea>
                </td>
                <td class="attachments-cell">
                    <textarea 
                        class="step-cell-editable" 
                        data-step-index="${index}"
                        data-step-field="attachments"
                        rows="1"
                    >${this.escapeHtml(step.attachments || '')}</textarea>
                </td>
                <td class="status-cell">
                    <textarea 
                        class="step-cell-editable" 
                        data-step-index="${index}"
                        data-step-field="status"
                        rows="1"
                    >${this.escapeHtml(step.status || '')}</textarea>
                </td>
            </tr>
        `).join('');

        return `
            <table class="steps-table">
                <thead>
                    <tr>
                        <th class="step-cell">Шаг</th>
                        <th class="action-cell">Действие</th>
                        <th class="expected-cell">ОР</th>
                        <th class="attachments-cell">Вложения</th>
                        <th class="status-cell">Статус</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    private static _renderComments(comments: string[]): string {
        if (comments.length === 0) {
            return '<div class="empty">Нет комментариев</div>';
        }
        return `
            <ul class="comments-list">
                ${comments.map((comment, index) => 
                    `<li><input type="text" data-field="comment-${index}" value="${this.escapeHtml(comment)}" /></li>`
                ).join('')}
            </ul>
        `;
    }
}

