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

    public static render(testCase: MarkdownTestCase, documentUri?: string, testers?: string[], tags?: string[], showStatusColumn: boolean = true): string {
        const testersList = testers || [];
        const availableTags = tags || [];

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
            /* Без ограничений по высоте, чтобы содержимое (включая дропдауны) не обрезалось */
        }
        
        .section-content.collapsed {
            display: none;
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

        /* Подсветка статуса Done зелёным цветом */
        .viewer-meta-select.status-done {
            color: var(--vscode-inputValidation-infoForeground);
            font-weight: 600;
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
            display: flex;
            flex-direction: column;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
            font-size: 14px;
        }

        .steps-table-header {
            display: grid;
            grid-template-columns: 120px 1fr 1fr 100px 100px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom: 2px solid var(--vscode-panel-border);
        }

        .steps-table-header-cell {
            padding: 12px;
            font-weight: 600;
            color: var(--vscode-foreground);
            text-align: left;
            border-right: 1px solid var(--vscode-panel-border);
        }

        .steps-table-header-cell:last-child {
            border-right: none;
        }

        .steps-table-header-cell.step-cell {
            text-align: center;
        }

        .steps-table-body {
            display: flex;
            flex-direction: column;
        }

        .steps-table-row {
            display: grid;
            grid-template-columns: 120px 1fr 1fr 100px 100px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            transition: background-color 0.2s, opacity 0.2s;
        }

        .steps-table-row:last-child {
            border-bottom: none;
        }

        .steps-table-row.dragging {
            opacity: 0.5;
            background-color: var(--vscode-list-hoverBackground);
        }

        .steps-table-row.drag-over {
            background-color: var(--vscode-list-activeSelectionBackground);
            border-top: 2px solid var(--vscode-textLink-foreground);
        }

        .steps-table-cell {
            padding: 12px;
            border-right: 1px solid var(--vscode-panel-border);
            vertical-align: top;
            display: flex;
            align-items: flex-start;
        }

        .steps-table-cell:last-child {
            border-right: none;
        }

        .steps-table-cell.step-cell {
            text-align: center;
            justify-content: flex-start;
            align-items: center;
            flex-direction: column;
            gap: 4px;
            padding: 8px;
            position: relative;
        }

        .step-cell-number {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .step-cell-actions {
            display: flex;
            flex-direction: column;
            gap: 2px;
            width: 100%;
        }

        .step-cell-drag-handle {
            cursor: move;
            user-select: none;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            line-height: 1;
            opacity: 0.6;
            padding: 2px;
            margin: 2px 0;
        }

        .step-cell-drag-handle:hover {
            opacity: 1;
        }

        .step-cell-btn {
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            padding: 2px 6px;
            font-size: 11px;
            line-height: 1.2;
            border-radius: 3px;
            transition: background-color 0.2s;
            width: 100%;
            text-align: center;
        }

        .step-cell-btn:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .step-cell-btn:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .step-cell-btn.add-btn {
            color: var(--vscode-textLink-foreground);
        }

        .step-cell-btn.delete-btn {
            color: var(--vscode-errorForeground);
        }

        .step-cell-btn.delete-btn:hover {
            background-color: var(--vscode-inputValidation-errorBackground);
        }

        .steps-table-cell.action-cell,
        .steps-table-cell.expected-cell {
            min-width: 0;
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
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.4;
        }

        .step-cell-editable:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .tags-container {
            margin-bottom: 16px;
        }
        
        .tags-input-wrapper {
            position: relative;
            margin-bottom: 12px;
        }
        
        .tags-input-container {
            position: relative;
            display: flex;
            align-items: center;
        }
        
        .tags-input {
            flex: 1;
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 30px 6px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            box-sizing: border-box;
        }
        
        .tags-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .tags-dropdown-toggle {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 12px;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        }
        
        .tags-dropdown-toggle.open {
            transform: translateY(-50%) rotate(180deg);
        }
        
        .tags-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 2px;
            margin-top: 2px;
            max-height: 300px;
            display: none;
            flex-direction: column;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            z-index: 1000;
        }
        
        .tags-dropdown.visible {
            display: flex;
        }
        
        .tags-dropdown-input {
            width: 100%;
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: none;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 8px;
            border-radius: 2px 2px 0 0;
            font-family: var(--vscode-font-family);
            box-sizing: border-box;
        }
        
        .tags-dropdown-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .tags-dropdown-list {
            max-height: 250px;
            overflow-y: auto;
        }
        
        .tags-dropdown-item {
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            transition: background-color 0.15s;
        }
        
        .tags-dropdown-item:last-child {
            border-bottom: none;
        }
        
        .tags-dropdown-item:hover,
        .tags-dropdown-item.selected {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .tags-dropdown-empty {
            padding: 12px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
            font-style: italic;
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

        .section-title-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .section-add-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            line-height: 1;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
        }

        .section-add-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .links-add-form {
            display: none;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            margin-bottom: 12px;
        }

        .links-add-form.visible {
            display: flex;
        }

        .links-add-form input {
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

        .links-add-form input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .links-add-form button {
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

        .links-add-form button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .links-list {
            list-style: none;
            padding: 0;
        }

        .links-list li {
            margin-bottom: 8px;
        }

        .links-list a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            font-size: 14px;
        }

        .links-list a:hover {
            text-decoration: underline;
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
        ${this._renderContent(testCase, testersList, showStatusColumn)}
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

            // Auto-resize textareas in table cells and update row height
            function autoResizeTextarea(textarea) {
                textarea.style.height = 'auto';
                const scrollHeight = textarea.scrollHeight;
                textarea.style.height = Math.max(20, scrollHeight) + 'px';
                
                // Update row height based on the tallest cell
                const row = textarea.closest('.steps-table-row');
                if (row) {
                    const cells = row.querySelectorAll('.steps-table-cell');
                    let maxHeight = 0;
                    cells.forEach(cell => {
                        const cellHeight = cell.offsetHeight;
                        if (cellHeight > maxHeight) {
                            maxHeight = cellHeight;
                        }
                    });
                    // Ensure row height matches the tallest cell
                    row.style.minHeight = maxHeight + 'px';
                }
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
            
            // Initial resize for all rows after content is loaded
            setTimeout(() => {
                document.querySelectorAll('.steps-table-row').forEach(row => {
                    const textareas = row.querySelectorAll('.step-cell-editable');
                    textareas.forEach(textarea => {
                        autoResizeTextarea(textarea);
                    });
                });
            }, 100);

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

            // Handle drag and drop for steps
            const stepsTableBody = document.getElementById('steps-table-body');
            let draggedElement = null;
            let draggedIndex = -1;
            let dragStartElement = null;

            if (stepsTableBody) {
                // Only allow drag from drag handle (not from buttons or textarea)
                stepsTableBody.addEventListener('mousedown', function(e) {
                    const target = e.target;
                    
                    // Don't allow drag from buttons or textarea
                    if (target.tagName === 'TEXTAREA' || 
                        target.closest('textarea') ||
                        target.classList.contains('step-cell-btn')) {
                        dragStartElement = null;
                        return;
                    }
                    
                    // Only allow drag from drag handle
                    if (target.classList.contains('step-cell-drag-handle')) {
                        const row = target.closest('.steps-table-row');
                        if (row) {
                            dragStartElement = row;
                        }
                    } else {
                        dragStartElement = null;
                    }
                });

                stepsTableBody.addEventListener('dragstart', function(e) {
                    // Only start drag if we clicked on drag handle
                    const target = e.target;
                    
                    // Don't start drag if clicking on buttons or textarea
                    if (target.tagName === 'TEXTAREA' || 
                        target.closest('textarea') ||
                        target.classList.contains('step-cell-btn')) {
                        e.preventDefault();
                        return;
                    }
                    
                    // Only allow drag from drag handle
                    let row = null;
                    if (target.classList.contains('step-cell-drag-handle')) {
                        row = target.closest('.steps-table-row');
                    } else if (dragStartElement) {
                        row = dragStartElement;
                    }
                    
                    if (row) {
                        draggedElement = row;
                        draggedIndex = parseInt(draggedElement.getAttribute('data-step-index') || '0');
                        draggedElement.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', draggedIndex.toString());
                    } else {
                        e.preventDefault();
                    }
                });

                stepsTableBody.addEventListener('dragend', function(e) {
                    if (draggedElement) {
                        draggedElement.classList.remove('dragging');
                        // Remove drag-over from all rows
                        document.querySelectorAll('.steps-table-row').forEach(row => {
                            row.classList.remove('drag-over');
                        });
                        draggedElement = null;
                        draggedIndex = -1;
                        dragStartElement = null;
                    }
                });

                stepsTableBody.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';

                    const targetRow = e.target.closest('.steps-table-row');
                    if (targetRow && targetRow !== draggedElement) {
                        // Remove drag-over from all rows
                        document.querySelectorAll('.steps-table-row').forEach(row => {
                            row.classList.remove('drag-over');
                        });
                        targetRow.classList.add('drag-over');
                    }
                });

                stepsTableBody.addEventListener('dragleave', function(e) {
                    const targetRow = e.target.closest('.steps-table-row');
                    if (targetRow) {
                        targetRow.classList.remove('drag-over');
                    }
                });

                stepsTableBody.addEventListener('drop', function(e) {
                    e.preventDefault();
                    
                    if (!draggedElement) return;

                    const targetRow = e.target.closest('.steps-table-row');
                    if (!targetRow || targetRow === draggedElement) {
                        return;
                    }

                    const targetIndex = parseInt(targetRow.getAttribute('data-step-index') || '0');
                    
                    // Remove drag-over from all rows
                    document.querySelectorAll('.steps-table-row').forEach(row => {
                        row.classList.remove('drag-over');
                    });

                    // Reorder steps
                    vscode.postMessage({
                        command: 'reorderSteps',
                        fromIndex: draggedIndex,
                        toIndex: targetIndex
                    });

                    draggedElement.classList.remove('dragging');
                    draggedElement = null;
                    draggedIndex = -1;
                });
            }

            // Handle step add/delete buttons
            document.querySelectorAll('.step-cell-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const stepIndex = parseInt(this.getAttribute('data-step-index') || '0');
                    const action = this.getAttribute('data-action');
                    
                    if (action === 'add') {
                        vscode.postMessage({
                            command: 'addStep',
                            afterIndex: stepIndex
                        });
                    } else if (action === 'delete') {
                        vscode.postMessage({
                            command: 'deleteStep',
                            stepIndex: stepIndex
                        });
                    }
                });
            });

            // Prevent drag when clicking buttons
            document.querySelectorAll('.step-cell-btn, .step-cell-drag-handle').forEach(element => {
                element.addEventListener('mousedown', function(e) {
                    e.stopPropagation();
                });
            });

            // Only allow drag from drag handle
            document.querySelectorAll('.step-cell-drag-handle').forEach(handle => {
                handle.addEventListener('mousedown', function(e) {
                    const row = this.closest('.steps-table-row');
                    if (row) {
                        dragStartElement = row;
                    }
                });
            });

            // Handle tags dropdown
            const tagsInput = document.getElementById('tags-input');
            const tagsDropdownToggle = document.getElementById('tags-dropdown-toggle');
            const tagsDropdown = document.getElementById('tags-dropdown');
            const tagsDropdownInput = document.getElementById('tags-dropdown-input');
            const tagsDropdownList = document.getElementById('tags-dropdown-list');
            const tagsList = document.getElementById('tags-list');
            const currentTags = ${JSON.stringify(testCase.tags || [])};
            const availableTags = ${JSON.stringify(availableTags)};
            let selectedDropdownIndex = -1;
            let filteredTags = [];
            let isDropdownOpen = false;
            
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
                
                // Clear input
                if (tagsDropdownInput) {
                    tagsDropdownInput.value = '';
                }
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
            
            function showDropdownList(tags) {
                if (!tagsDropdownList) return;
                
                filteredTags = tags;
                selectedDropdownIndex = -1;
                
                if (tags.length === 0) {
                    tagsDropdownList.innerHTML = '<div class="tags-dropdown-empty">Нет доступных тегов</div>';
                    return;
                }
                
                tagsDropdownList.innerHTML = tags.map((tag, index) => {
                    const escapedTag = tag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    return '<div class="tags-dropdown-item" data-index="' + index + '" data-tag="' + escapedTag + '">' + escapedTag + '</div>';
                }).join('');
                
                // Add click handlers
                const items = tagsDropdownList.querySelectorAll('.tags-dropdown-item');
                items.forEach(item => {
                    item.addEventListener('click', function() {
                        const tag = this.getAttribute('data-tag');
                        addTag(tag);
                        updateDropdownList();
                    });
                });
            }
            
            function updateDropdownList() {
                if (!tagsDropdownInput) return;
                const query = tagsDropdownInput.value;
                const filtered = filterTags(query);
                showDropdownList(filtered);
            }
            
            function updateDropdownSelection() {
                const items = tagsDropdownList.querySelectorAll('.tags-dropdown-item');
                items.forEach((item, index) => {
                    if (index === selectedDropdownIndex) {
                        item.classList.add('selected');
                        item.scrollIntoView({ block: 'nearest' });
                    } else {
                        item.classList.remove('selected');
                    }
                });
            }
            
            function openDropdown() {
                if (!tagsDropdown || !tagsDropdownToggle) return;
                isDropdownOpen = true;
                tagsDropdown.classList.add('visible');
                tagsDropdownToggle.classList.add('open');
                if (tagsDropdownInput) {
                    tagsDropdownInput.focus();
                    updateDropdownList();
                }
            }
            
            function closeDropdown() {
                if (!tagsDropdown || !tagsDropdownToggle) return;
                isDropdownOpen = false;
                tagsDropdown.classList.remove('visible');
                tagsDropdownToggle.classList.remove('open');
                selectedDropdownIndex = -1;
                if (tagsDropdownInput) {
                    tagsDropdownInput.value = '';
                }
            }
            
            if (tagsInput && tagsDropdownToggle && tagsDropdown && tagsDropdownInput && tagsDropdownList && tagsList) {
                // Add remove handlers to existing tags
                tagsList.querySelectorAll('.tag-remove').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const tagItem = this.closest('.tag-item');
                        if (tagItem) {
                            tagItem.remove();
                            updateTagsField();
                        }
                    });
                });
                
                // Toggle dropdown on button click
                tagsDropdownToggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isDropdownOpen) {
                        closeDropdown();
                    } else {
                        openDropdown();
                    }
                });
                
                // Open dropdown on input click
                tagsInput.addEventListener('click', function() {
                    if (!isDropdownOpen) {
                        openDropdown();
                    }
                });
                
                // Handle dropdown input
                tagsDropdownInput.addEventListener('input', function() {
                    updateDropdownList();
                    selectedDropdownIndex = -1;
                });
                
                tagsDropdownInput.addEventListener('keydown', function(e) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (filteredTags.length > 0) {
                            selectedDropdownIndex = Math.min(selectedDropdownIndex + 1, filteredTags.length - 1);
                            updateDropdownSelection();
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (filteredTags.length > 0) {
                            selectedDropdownIndex = Math.max(selectedDropdownIndex - 1, -1);
                            updateDropdownSelection();
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedDropdownIndex >= 0 && selectedDropdownIndex < filteredTags.length) {
                            addTag(filteredTags[selectedDropdownIndex]);
                            updateDropdownList();
                        } else {
                            const tagText = tagsDropdownInput.value.trim();
                            if (tagText.length > 0) {
                                addTag(tagText);
                                updateDropdownList();
                            }
                        }
                    } else if (e.key === 'Escape') {
                        closeDropdown();
                    }
                });
                
                // Close dropdown when clicking outside
                document.addEventListener('click', function(e) {
                    if (isDropdownOpen && tagsDropdown && !tagsDropdown.contains(e.target) && 
                        e.target !== tagsInput && e.target !== tagsDropdownToggle && 
                        !tagsInput.contains(e.target) && !tagsDropdownToggle.contains(e.target)) {
                        closeDropdown();
                    }
                });
            }

            // Handle links (Связи)
            const linksAddToggle = document.getElementById('links-add-toggle');
            const linksAddForm = document.getElementById('links-add-form');
            const newLinkTitleInput = document.getElementById('new-link-title');
            const newLinkUrlInput = document.getElementById('new-link-url');
            const addLinkButton = document.getElementById('add-link-button');
            const linksList = document.getElementById('links-list');

            function buildLinkMarkdown(title, url) {
                const t = (title || '').trim();
                const u = (url || '').trim();
                if (!t && !u) {
                    return '';
                }
                if (!u) {
                    return t;
                }
                return '[' + t + '](' + u + ')';
            }

            // Toggle add form visibility
            if (linksAddToggle && linksAddForm) {
                linksAddToggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    linksAddForm.classList.toggle('visible');
                    if (linksAddForm.classList.contains('visible')) {
                        newLinkTitleInput?.focus();
                    }
                });
            }

            // Handle adding new link
            if (addLinkButton && newLinkTitleInput && newLinkUrlInput && linksList) {
                const addLink = () => {
                    const title = newLinkTitleInput.value.trim();
                    const url = newLinkUrlInput.value.trim();

                    if (!title || !url) {
                        return;
                    }

                    const linkMarkdown = buildLinkMarkdown(title, url);
                    const linkValue = ' - ' + linkMarkdown;

                    // Find current links count
                    const currentLinks = linksList.querySelectorAll('li').length;
                    
                    vscode.postMessage({
                        command: 'updateField',
                        field: 'link-' + currentLinks,
                        value: linkValue
                    });

                    newLinkTitleInput.value = '';
                    newLinkUrlInput.value = '';
                    linksAddForm?.classList.remove('visible');
                };

                addLinkButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    addLink();
                });

                newLinkTitleInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addLink();
                    }
                });

                newLinkUrlInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addLink();
                    }
                });
            }
        })();
    </script>
</body>
</html>`;
    }

    private static _renderContent(testCase: MarkdownTestCase, testers: string[], showStatusColumn: boolean = true): string {
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
                            class="viewer-meta-select ${testCase.metadata.status === 'Done' ? 'status-done' : ''}" 
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
            
            ${this._renderSection('links', 'Связи', this._renderLinks(testCase.links || []), false, false, '<button class="section-add-btn" id="links-add-toggle" title="Добавить связь">+</button>')}
            ${this._renderSection('epic-feature-story', 'Epic/Feature/Story', this._renderEpicFeatureStory(testCase.epicFeatureStory))}
            ${this._renderSection('tags', 'Теги (tags)', this._renderTags(testCase.tags || []))}
            ${this._renderSection('description', 'Описание (description)', this._renderDescription(testCase.description || ''), true, true)}
            ${this._renderSection('preconditions', 'Предусловия (preconditions)', this._renderPreconditions(testCase.preconditions || ''), true, true)}
            ${this._renderSection('steps', 'Шаги тестирования', this._renderSteps(testCase.steps || [], showStatusColumn))}
            ${this._renderSection('comments', 'Комментарии', this._renderComments(testCase.comments || []))}
        `;
    }

    private static _renderSection(id: string, title: string, content: string, collapsible: boolean = false, collapsed: boolean = false, titleActions?: string): string {
        return `
            <div class="section" id="${id}">
                <div class="section-title ${collapsible ? 'collapsible' : ''}">
                    <span>${this.escapeHtml(title)}</span>
                    <div class="section-title-actions">
                        ${titleActions || ''}
                        ${collapsible ? `<span class="section-toggle ${collapsed ? 'collapsed' : ''}">▼</span>` : ''}
                    </div>
                </div>
                <div class="section-content ${collapsible && collapsed ? 'collapsed' : ''}">
                    ${content}
                </div>
            </div>
        `;
    }

    private static _renderLinks(links: string[]): string {
        // Parse links from markdown format [text](url)
        const parsedLinks = links.map(link => {
            const match = link.match(/\[([^\]]*)\]\(([^)]*)\)/);
            return {
                title: match ? match[1] : link,
                url: match ? match[2] : '',
                raw: link
            };
        });

        return `
            <div class="links-add-form" id="links-add-form">
                <input 
                    type="text" 
                    id="new-link-title" 
                    placeholder="Краткое наименование"
                />
                <input 
                    type="text" 
                    id="new-link-url" 
                    placeholder="Ссылка (https://...)"
                />
                <button id="add-link-button">Добавить</button>
            </div>
            <ul class="links-list" id="links-list">
                ${parsedLinks.map((link, index) => 
                    `<li><a href="${this.escapeHtml(link.url || '#')}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(link.title || 'Без названия')}</a></li>`
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
        return `
            <div class="tags-container">
                <div class="tags-input-wrapper">
                    <div class="tags-input-container">
                        <input 
                            type="text" 
                            class="tags-input" 
                            id="tags-input" 
                            placeholder="Введите тег для поиска или создания нового"
                            autocomplete="off"
                            readonly
                        />
                        <button class="tags-dropdown-toggle" id="tags-dropdown-toggle" title="Открыть список тегов">▼</button>
                    </div>
                    <div class="tags-dropdown" id="tags-dropdown">
                        <input 
                            type="text" 
                            class="tags-dropdown-input" 
                            id="tags-dropdown-input" 
                            placeholder="Введите тег для поиска или создания нового"
                            autocomplete="off"
                        />
                        <div class="tags-dropdown-list" id="tags-dropdown-list"></div>
                    </div>
                </div>
                <div class="tags-list" id="tags-list">
                    ${tags.map(tag => `
                        <span class="tag-item">
                            <span class="tag-text">${this.escapeHtml(tag)}</span>
                            <button class="tag-remove" data-tag="${this.escapeHtml(tag)}" title="Удалить тег">×</button>
                        </span>
                    `).join('')}
                </div>
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

    private static _renderSteps(steps: MarkdownTestStep[], showStatusColumn: boolean = true): string {
        if (steps.length === 0) {
            return '<div class="empty">Нет шагов тестирования</div>';
        }

        const gridColumns = showStatusColumn 
            ? '120px 1fr 1fr 100px 100px' 
            : '120px 1fr 1fr 100px';
        const gridColumnsStyle = `grid-template-columns: ${gridColumns};`;

        const rows = steps.map((step, index) => {
            const statusCell = showStatusColumn ? `
                <div class="steps-table-cell status-cell">
                    <textarea 
                        class="step-cell-editable" 
                        data-step-index="${index}"
                        data-step-field="status"
                        rows="1"
                    >${this.escapeHtml(step.status || '')}</textarea>
                </div>
            ` : '';

            return `
            <div class="steps-table-row" draggable="true" data-step-index="${index}" style="${gridColumnsStyle}">
                <div class="steps-table-cell step-cell">
                    <div class="step-cell-number">${step.stepNumber || index + 1}</div>
                    <div class="step-cell-actions">
                        <div class="step-cell-drag-handle" title="Перетащить шаг">⋮⋮</div>
                        <button class="step-cell-btn add-btn" data-step-index="${index}" data-action="add" title="Добавить шаг после этого">+</button>
                        <button class="step-cell-btn delete-btn" data-step-index="${index}" data-action="delete" title="Удалить шаг">×</button>
                    </div>
                </div>
                <div class="steps-table-cell action-cell">
                    <textarea 
                        class="step-cell-editable" 
                        data-step-index="${index}"
                        data-step-field="action"
                        rows="1"
                    >${this.escapeHtml(step.action || '')}</textarea>
                </div>
                <div class="steps-table-cell expected-cell">
                    <textarea 
                        class="step-cell-editable" 
                        data-step-index="${index}"
                        data-step-field="expectedResult"
                        rows="1"
                    >${this.escapeHtml(step.expectedResult || '')}</textarea>
                </div>
                <div class="steps-table-cell attachments-cell">
                    <textarea 
                        class="step-cell-editable" 
                        data-step-index="${index}"
                        data-step-field="attachments"
                        rows="1"
                    >${this.escapeHtml(step.attachments || '')}</textarea>
                </div>
                ${statusCell}
            </div>
        `;
        }).join('');

        const statusHeader = showStatusColumn 
            ? '<div class="steps-table-header-cell status-cell">Статус</div>' 
            : '';

        return `
            <div class="steps-table">
                <div class="steps-table-header" style="${gridColumnsStyle}">
                    <div class="steps-table-header-cell step-cell">Шаг</div>
                    <div class="steps-table-header-cell action-cell">Действие</div>
                    <div class="steps-table-header-cell expected-cell">ОР</div>
                    <div class="steps-table-header-cell attachments-cell">Вложения</div>
                    ${statusHeader}
                </div>
                <div class="steps-table-body" id="steps-table-body">
                    ${rows}
                </div>
            </div>
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

