import { MarkdownTestCase, MarkdownTestStep, MarkdownComment } from './markdownTestCaseParser';

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
            height: auto;
            overflow: visible;
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
        
        .steps-table-wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
            font-size: 14px;
        }

        .steps-table {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .steps-table-header {
            display: grid;
            grid-template-columns: 120px 1fr 1fr 100px;
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

        .steps-row-wrapper {
            display: flex;
            align-items: stretch;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            transition: background-color 0.2s, opacity 0.2s;
        }

        .steps-row-wrapper:last-child {
            border-bottom: none;
        }

        .steps-row-wrapper.dragging {
            opacity: 0.5;
            background-color: var(--vscode-list-hoverBackground);
        }

        .steps-row-wrapper.drag-over {
            background-color: var(--vscode-list-activeSelectionBackground);
            border-top: 2px solid var(--vscode-textLink-foreground);
        }

        .steps-table-row {
            flex: 1;
            display: grid;
            grid-template-columns: 120px 1fr 1fr 100px;
            background-color: transparent;
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
            justify-content: center;
            align-items: center;
            padding: 8px;
            cursor: pointer;
            position: relative;
            flex-direction: column;
            gap: 4px;
        }

        .step-cell-number {
            font-weight: 600;
        }

        .step-cell-actions {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
        }

        .steps-row-actions {
            display: none;
        }

        .step-cell-drag-handle {
            cursor: move;
            user-select: none;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            line-height: 1;
            opacity: 0.6;
            padding: 4px;
            transition: opacity 0.2s;
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

        .step-context-menu {
            position: absolute;
            background-color: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border);
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            min-width: 150px;
            padding: 4px 0;
            display: none;
            top: 100%;
            left: 0;
            margin-top: 4px;
        }

        .step-context-menu.visible {
            display: block;
        }

        .step-context-menu-item {
            padding: 6px 12px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
            font-size: 13px;
            transition: background-color 0.1s;
        }

        .step-context-menu-item:hover {
            background-color: var(--vscode-menu-selectionBackground);
            color: var(--vscode-menu-selectionForeground);
        }

        .step-context-menu-item.delete {
            color: var(--vscode-errorForeground);
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

        .viewer-tags-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 13px;
        }
        
        .tags-inline-container {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px;
            position: relative;
        }
        
        .tag-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.4;
            height: 20px;
        }
        
        .tag-chip-text {
            user-select: none;
        }
        
        .tag-chip-remove {
            background: transparent;
            border: none;
            color: var(--vscode-editor-background);
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            padding: 0;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 2px;
            transition: background-color 0.2s;
            opacity: 0.8;
        }
        
        .tag-chip-remove:hover {
            background-color: rgba(0, 0, 0, 0.2);
            opacity: 1;
        }
        
        .tags-add-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 14px;
            padding: 2px 6px;
            border-radius: 3px;
            height: 20px;
            min-width: 20px;
            transition: background-color 0.2s, border-color 0.2s;
        }
        
        .tags-add-btn:hover {
            background-color: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .tags-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            margin-top: 4px;
            min-width: 250px;
            max-width: 400px;
            max-height: 300px;
            display: none;
            flex-direction: column;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
        }
        
        .tags-dropdown.visible {
            display: flex;
        }
        
        .tags-dropdown-header {
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        
        .tags-dropdown-input {
            width: 100%;
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: none;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 8px 12px;
            font-family: var(--vscode-font-family);
            box-sizing: border-box;
        }
        
        .tags-dropdown-input:focus {
            outline: none;
        }
        
        .tags-dropdown-input::placeholder {
            color: var(--vscode-descriptionForeground);
        }
        
        .tags-dropdown-list {
            max-height: 200px;
            overflow-y: auto;
        }
        
        .tags-dropdown-item {
            padding: 8px 12px;
            cursor: pointer;
            font-size: 13px;
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

        .comments-table {
            width: 100%;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
            font-size: 14px;
        }

        .comments-table-header {
            display: grid;
            grid-template-columns: 50px 1fr 120px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom: 2px solid var(--vscode-panel-border);
        }

        .comments-table-header-cell {
            padding: 12px;
            font-weight: 600;
            color: var(--vscode-foreground);
            text-align: left;
            border-right: 1px solid var(--vscode-panel-border);
        }

        .comments-table-header-cell:last-child {
            border-right: none;
        }

        .comments-table-header-cell.number-cell {
            text-align: center;
        }

        .comments-table-body {
            display: flex;
            flex-direction: column;
        }

        .comments-table-row {
            display: grid;
            grid-template-columns: 50px 1fr 120px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
        }

        .comments-table-row:last-child {
            border-bottom: none;
        }

        .comments-table-cell {
            padding: 12px;
            border-right: 1px solid var(--vscode-panel-border);
            vertical-align: top;
            display: flex;
            align-items: flex-start;
        }

        .comments-table-cell:last-child {
            border-right: none;
        }

        .comments-table-cell.number-cell {
            text-align: center;
            justify-content: center;
            align-items: center;
        }

        .comment-cell-editable {
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

        .comment-cell-editable:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .comment-status-select {
            width: 100%;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: 14px;
            padding: 4px 8px;
            border-radius: 2px;
            cursor: pointer;
        }

        .comment-status-select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .comments-add-form {
            display: none;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            margin-bottom: 12px;
        }

        .comments-add-form.visible {
            display: flex;
        }

        .comments-add-form textarea {
            width: 100%;
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            box-sizing: border-box;
            resize: vertical;
        }

        .comments-add-form textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .comments-add-form button {
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

        .comments-add-form button:hover {
            background-color: var(--vscode-button-hoverBackground);
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
                // Reset height to get accurate scrollHeight
                const currentHeight = textarea.style.height;
                textarea.style.height = 'auto';
                const scrollHeight = textarea.scrollHeight;
                textarea.style.height = Math.max(20, scrollHeight) + 'px';
                
                // Update row height based on the tallest cell
                const row = textarea.closest('.steps-table-row');
                const rowWrapper = textarea.closest('.steps-row-wrapper');
                if (row && rowWrapper) {
                    // Force reflow to get accurate cell heights
                    void row.offsetHeight;
                    
                    const cells = row.querySelectorAll('.steps-table-cell');
                    let maxHeight = 0;
                    cells.forEach(cell => {
                        const cellHeight = cell.offsetHeight;
                        if (cellHeight > maxHeight) {
                            maxHeight = cellHeight;
                        }
                    });
                    // Ensure row wrapper height matches the tallest cell
                    if (maxHeight > 0) {
                        rowWrapper.style.minHeight = maxHeight + 'px';
                    }
                }
            }

            document.querySelectorAll('.step-cell-editable').forEach(textarea => {
                // Set initial height to auto before calculating
                textarea.style.height = 'auto';
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
            // Use requestAnimationFrame to ensure DOM is fully rendered
            requestAnimationFrame(() => {
                setTimeout(() => {
                    document.querySelectorAll('.steps-table-row').forEach(row => {
                        const textareas = row.querySelectorAll('.step-cell-editable');
                        textareas.forEach(textarea => {
                            // Reset height first to get accurate scrollHeight
                            textarea.style.height = 'auto';
                            autoResizeTextarea(textarea);
                        });
                    });
                    // Force layout recalculation to fix height issues
                    void document.body.offsetHeight;
                }, 50);
            });
            
            // Additional resize after a longer delay to ensure all content is rendered
            setTimeout(() => {
                document.querySelectorAll('.step-cell-editable').forEach(textarea => {
                    textarea.style.height = 'auto';
                    autoResizeTextarea(textarea);
                });
                // Force layout recalculation
                void document.body.offsetHeight;
            }, 200);

            // Handle comments (Комментарии)
            const commentsAddToggle = document.getElementById('comments-add-toggle');
            const commentsAddForm = document.getElementById('comments-add-form');
            const newCommentTextInput = document.getElementById('new-comment-text');
            const addCommentButton = document.getElementById('add-comment-button');

            // Toggle add form visibility
            if (commentsAddToggle && commentsAddForm) {
                commentsAddToggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    commentsAddForm.classList.toggle('visible');
                    if (commentsAddForm.classList.contains('visible')) {
                        newCommentTextInput?.focus();
                    }
                });
            }

            // Handle adding new comment
            if (addCommentButton && newCommentTextInput) {
                addCommentButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    const commentText = newCommentTextInput.value.trim();
                    
                    if (!commentText) {
                        return;
                    }

                    vscode.postMessage({
                        command: 'addComment',
                        comment: commentText
                    });

                    // Clear form and hide it
                    newCommentTextInput.value = '';
                    commentsAddForm?.classList.remove('visible');
                });

                // Also handle Enter key in textarea
                newCommentTextInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        addCommentButton.click();
                    }
                });
            }

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

            // Handle comment updates
            document.querySelectorAll('[data-comment-field]').forEach(element => {
                if (element.tagName === 'SELECT') {
                    element.addEventListener('change', function() {
                        const commentIndex = parseInt(this.getAttribute('data-comment-index') || '0');
                        const field = this.getAttribute('data-comment-field');
                        const value = this.value || '';
                        vscode.postMessage({
                            command: 'updateComment',
                            commentIndex: commentIndex,
                            field: field,
                            value: value
                        });
                    });
                } else {
                    element.addEventListener('blur', function() {
                        const commentIndex = parseInt(this.getAttribute('data-comment-index') || '0');
                        const field = this.getAttribute('data-comment-field');
                        const value = this.value || '';
                        vscode.postMessage({
                            command: 'updateComment',
                            commentIndex: commentIndex,
                            field: field,
                            value: value
                        });
                    });
                }
            });

            // Auto-resize textareas in comment cells
            function autoResizeCommentTextarea(textarea) {
                // Reset height to get accurate scrollHeight
                textarea.style.height = 'auto';
                const scrollHeight = textarea.scrollHeight;
                textarea.style.height = Math.max(20, scrollHeight) + 'px';
                
                // Update row height based on the tallest cell
                const row = textarea.closest('.comments-table-row');
                if (row) {
                    // Force reflow to get accurate cell heights
                    void row.offsetHeight;
                    
                    const cells = row.querySelectorAll('.comments-table-cell');
                    let maxHeight = 0;
                    cells.forEach(cell => {
                        const cellHeight = cell.offsetHeight;
                        if (cellHeight > maxHeight) {
                            maxHeight = cellHeight;
                        }
                    });
                    // Ensure row height matches the tallest cell
                    if (maxHeight > 0) {
                        row.style.minHeight = maxHeight + 'px';
                    }
                }
            }

            document.querySelectorAll('.comment-cell-editable').forEach(textarea => {
                // Set initial height to auto before calculating
                textarea.style.height = 'auto';
                autoResizeCommentTextarea(textarea);
                textarea.addEventListener('input', function() {
                    autoResizeCommentTextarea(this);
                });
                textarea.addEventListener('focus', function() {
                    autoResizeCommentTextarea(this);
                });
            });

            // Initial resize for all comment rows after content is loaded
            requestAnimationFrame(() => {
                setTimeout(() => {
                    document.querySelectorAll('.comments-table-row').forEach(row => {
                        const textareas = row.querySelectorAll('.comment-cell-editable');
                        textareas.forEach(textarea => {
                            // Reset height first to get accurate scrollHeight
                            textarea.style.height = 'auto';
                            autoResizeCommentTextarea(textarea);
                        });
                    });
                }, 50);
            });

            // Handle drag and drop for steps
            const stepsTableBody = document.getElementById('steps-table-body');
            let draggedElement = null;
            let draggedIndex = -1;
            let dragStartElement = null;

            if (stepsTableBody) {
                // Only allow drag from drag handle (not from buttons, textarea, or context menu)
                stepsTableBody.addEventListener('mousedown', function(e) {
                    const target = e.target;
                    
                    // Don't allow drag from context menu, textarea, or buttons
                    if (target.tagName === 'TEXTAREA' || 
                        target.closest('textarea') ||
                        target.closest('.step-context-menu') ||
                        target.closest('.step-context-menu-item') ||
                        target.classList.contains('step-cell-btn') ||
                        target.closest('.step-cell-btn')) {
                        dragStartElement = null;
                        return;
                    }
                    
                    // Only allow drag from drag handle
                    if (target.classList.contains('step-cell-drag-handle')) {
                        const rowWrapper = target.closest('.steps-row-wrapper');
                        if (rowWrapper) {
                            dragStartElement = rowWrapper;
                        }
                    } else {
                        dragStartElement = null;
                    }
                });

                stepsTableBody.addEventListener('dragstart', function(e) {
                    // Only start drag if we clicked on drag handle
                    const target = e.target;
                    
                    // Don't start drag if clicking on context menu, textarea, or buttons
                    if (target.tagName === 'TEXTAREA' || 
                        target.closest('textarea') ||
                        target.closest('.step-context-menu') ||
                        target.closest('.step-context-menu-item') ||
                        target.classList.contains('step-cell-btn') ||
                        target.closest('.step-cell-btn')) {
                        e.preventDefault();
                        return;
                    }
                    
                    // Only allow drag from drag handle
                    let rowWrapper = null;
                    if (target.classList.contains('step-cell-drag-handle')) {
                        rowWrapper = target.closest('.steps-row-wrapper');
                    } else if (dragStartElement) {
                        rowWrapper = dragStartElement;
                    }
                    
                    if (rowWrapper) {
                        draggedElement = rowWrapper;
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
                        document.querySelectorAll('.steps-row-wrapper').forEach(row => {
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

                    const targetRowWrapper = e.target.closest('.steps-row-wrapper');
                    if (targetRowWrapper && targetRowWrapper !== draggedElement) {
                        // Remove drag-over from all rows
                        document.querySelectorAll('.steps-row-wrapper').forEach(row => {
                            row.classList.remove('drag-over');
                        });
                        targetRowWrapper.classList.add('drag-over');
                    }
                });

                stepsTableBody.addEventListener('dragleave', function(e) {
                    const targetRowWrapper = e.target.closest('.steps-row-wrapper');
                    if (targetRowWrapper) {
                        targetRowWrapper.classList.remove('drag-over');
                    }
                });

                stepsTableBody.addEventListener('drop', function(e) {
                    e.preventDefault();
                    
                    if (!draggedElement) return;

                    const targetRowWrapper = e.target.closest('.steps-row-wrapper');
                    if (!targetRowWrapper || targetRowWrapper === draggedElement) {
                        return;
                    }

                    const targetIndex = parseInt(targetRowWrapper.getAttribute('data-step-index') || '0');
                    
                    // Remove drag-over from all rows
                    document.querySelectorAll('.steps-row-wrapper').forEach(row => {
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

            // Handle context menu for step cells (right click or click on cell)
            document.querySelectorAll('.steps-table-cell.step-cell').forEach(cell => {
                const stepIndex = parseInt(cell.getAttribute('data-step-index') || '0');
                const contextMenu = cell.querySelector('.step-context-menu');
                
                if (!contextMenu) return;
                
                // Handle click on step cell (not on drag handle or buttons)
                cell.addEventListener('click', function(e) {
                    // Don't show menu if clicked on drag handle or buttons
                    if (e.target.classList.contains('step-cell-drag-handle') || 
                        e.target.closest('.step-cell-drag-handle') ||
                        e.target.classList.contains('step-cell-btn') ||
                        e.target.closest('.step-cell-btn')) {
                        return;
                    }
                    
                    e.stopPropagation();
                    
                    // Close all other menus
                    document.querySelectorAll('.step-context-menu').forEach(menu => {
                        if (menu !== contextMenu) {
                            menu.classList.remove('visible');
                        }
                    });
                    
                    // Toggle current menu
                    contextMenu.classList.toggle('visible');
                });
                
                // Handle menu items
                contextMenu.querySelectorAll('.step-context-menu-item').forEach(item => {
                    item.addEventListener('click', function(e) {
                        e.stopPropagation();
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
                        
                        contextMenu.classList.remove('visible');
                    });
                });
            });

            // Close menu when clicking outside
            document.addEventListener('click', function(e) {
                if (!e.target.closest('.step-context-menu') && 
                    !e.target.closest('.steps-table-cell.step-cell')) {
                    document.querySelectorAll('.step-context-menu').forEach(menu => {
                        menu.classList.remove('visible');
                    });
                }
            });

            // Prevent drag when clicking on buttons or drag handle
            document.querySelectorAll('.step-cell-btn, .step-cell-drag-handle').forEach(element => {
                element.addEventListener('mousedown', function(e) {
                    e.stopPropagation();
                });
            });

            // Only allow drag from drag handle
            document.querySelectorAll('.step-cell-drag-handle').forEach(handle => {
                handle.addEventListener('mousedown', function(e) {
                    const rowWrapper = this.closest('.steps-row-wrapper');
                    if (rowWrapper) {
                        dragStartElement = rowWrapper;
                    }
                });
            });

            // Handle tags dropdown (new minimalistic design)
            const tagsAddBtn = document.getElementById('tags-add-btn');
            const tagsDropdown = document.getElementById('tags-dropdown');
            const tagsDropdownInput = document.getElementById('tags-dropdown-input');
            const tagsDropdownList = document.getElementById('tags-dropdown-list');
            const tagsListInline = document.getElementById('tags-list-inline');
            const currentTags = ${JSON.stringify(testCase.tags || [])};
            const availableTags = ${JSON.stringify(availableTags)};
            let selectedDropdownIndex = -1;
            let filteredTags = [];
            let isDropdownOpen = false;
            
            function updateTagsField() {
                const tagItems = tagsListInline.querySelectorAll('.tag-chip .tag-chip-text');
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
                const existingTags = Array.from(tagsListInline.querySelectorAll('.tag-chip .tag-chip-text')).map(item => item.textContent.trim());
                
                if (existingTags.includes(trimmedTag)) {
                    return; // Tag already exists
                }
                
                const tagChip = document.createElement('span');
                tagChip.className = 'tag-chip';
                const escapedTag = trimmedTag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                tagChip.innerHTML = '<span class="tag-chip-text">' + escapedTag + '</span><button class="tag-chip-remove" data-tag="' + escapedTag + '" title="Удалить тег">×</button>';
                
                const removeBtn = tagChip.querySelector('.tag-chip-remove');
                if (removeBtn) {
                    removeBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        tagChip.remove();
                        updateTagsField();
                    });
                }
                
                tagsListInline.appendChild(tagChip);
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
                if (!tagsDropdown || !tagsAddBtn) return;
                isDropdownOpen = true;
                tagsDropdown.classList.add('visible');
                if (tagsDropdownInput) {
                    tagsDropdownInput.focus();
                    updateDropdownList();
                }
            }
            
            function closeDropdown() {
                if (!tagsDropdown) return;
                isDropdownOpen = false;
                tagsDropdown.classList.remove('visible');
                selectedDropdownIndex = -1;
                if (tagsDropdownInput) {
                    tagsDropdownInput.value = '';
                }
            }
            
            if (tagsAddBtn && tagsDropdown && tagsDropdownInput && tagsDropdownList && tagsListInline) {
                // Add remove handlers to existing tags
                tagsListInline.querySelectorAll('.tag-chip-remove').forEach(btn => {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const tagChip = this.closest('.tag-chip');
                        if (tagChip) {
                            tagChip.remove();
                            updateTagsField();
                        }
                    });
                });
                
                // Open dropdown on button click
                tagsAddBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isDropdownOpen) {
                        closeDropdown();
                    } else {
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
                        e.target !== tagsAddBtn && !tagsAddBtn.contains(e.target)) {
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
            
            // Fix height calculation on initial load
            // This ensures proper height calculation when panel is first opened
            function fixInitialHeight() {
                // Force layout recalculation
                void document.body.offsetHeight;
                
                // Recalculate all textarea heights
                document.querySelectorAll('.step-cell-editable').forEach(textarea => {
                    textarea.style.height = 'auto';
                    const scrollHeight = textarea.scrollHeight;
                    textarea.style.height = Math.max(20, scrollHeight) + 'px';
                });
                
                // Update row wrapper heights
                document.querySelectorAll('.steps-row-wrapper').forEach(wrapper => {
                    const row = wrapper.querySelector('.steps-table-row');
                    if (row) {
                        const cells = row.querySelectorAll('.steps-table-cell');
                        let maxHeight = 0;
                        cells.forEach(cell => {
                            const cellHeight = cell.offsetHeight;
                            if (cellHeight > maxHeight) {
                                maxHeight = cellHeight;
                            }
                        });
                        if (maxHeight > 0) {
                            wrapper.style.minHeight = maxHeight + 'px';
                        }
                    }
                });
                
                // Force final layout recalculation
                void document.body.offsetHeight;
            }
            
            // Run height fix multiple times to ensure proper calculation
            requestAnimationFrame(() => {
                setTimeout(fixInitialHeight, 0);
                setTimeout(fixInitialHeight, 50);
                setTimeout(fixInitialHeight, 200);
            });
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
                <div class="viewer-tags-row">
                    <span class="viewer-meta-label">Теги:</span>
                    ${this._renderTagsInline(testCase.tags || [])}
                </div>
            </div>
            
            ${this._renderSection('links', 'Связи', this._renderLinks(testCase.links || []), false, false, '<button class="section-add-btn" id="links-add-toggle" title="Добавить связь">+</button>')}
            ${this._renderSection('epic-feature-story', 'Epic/Feature/Story', this._renderEpicFeatureStory(testCase.epicFeatureStory))}
            ${this._renderSection('description', 'Описание (description)', this._renderDescription(testCase.description || ''), true, true)}
            ${this._renderSection('preconditions', 'Предусловия (preconditions)', this._renderPreconditions(testCase.preconditions || ''), true, true)}
            ${this._renderSection('steps', 'Шаги тестирования', this._renderSteps(testCase.steps || [], showStatusColumn))}
            ${this._renderSection('comments', 'Комментарии', this._renderComments(testCase.comments || []), false, false, '<button class="section-add-btn" id="comments-add-toggle" title="Добавить комментарий">+</button>')}
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

    private static _renderTagsInline(tags: string[]): string {
        return `
            <div class="tags-inline-container">
                <div class="tags-list-inline" id="tags-list-inline">
                    ${tags.map(tag => `
                        <span class="tag-chip">
                            <span class="tag-chip-text">${this.escapeHtml(tag)}</span>
                            <button class="tag-chip-remove" data-tag="${this.escapeHtml(tag)}" title="Удалить тег">×</button>
                        </span>
                    `).join('')}
                </div>
                <button class="tags-add-btn" id="tags-add-btn" title="Добавить тег">+</button>
                <div class="tags-dropdown" id="tags-dropdown">
                    <div class="tags-dropdown-header">Предложения</div>
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
            ? '120px 1fr 1fr 100px' 
            : '120px 1fr 1fr';
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
            <div class="steps-row-wrapper" draggable="true" data-step-index="${index}">
                <div class="steps-table-row" style="${gridColumnsStyle}">
                    <div class="steps-table-cell step-cell" data-step-index="${index}">
                        <div class="step-cell-number">${step.stepNumber || index + 1}</div>
                        <div class="step-cell-actions">
                            <div class="step-cell-drag-handle" title="Перетащить шаг">⋮⋮</div>
                            <button class="step-cell-btn add-btn" data-step-index="${index}" data-action="add" title="Добавить шаг после этого">+</button>
                            <button class="step-cell-btn delete-btn" data-step-index="${index}" data-action="delete" title="Удалить шаг">×</button>
                        </div>
                        <div class="step-context-menu" data-step-index="${index}">
                            <div class="step-context-menu-item add" data-action="add">Добавить шаг</div>
                            <div class="step-context-menu-item delete" data-action="delete">Удалить шаг</div>
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
                    ${statusCell}
                </div>
            </div>
        `;
        }).join('');

        const statusHeader = showStatusColumn 
            ? '<div class="steps-table-header-cell status-cell">Статус</div>' 
            : '';

        return `
            <div class="steps-table-wrapper">
                <div class="steps-table">
                    <div class="steps-table-header" style="${gridColumnsStyle}">
                        <div class="steps-table-header-cell step-cell">Шаг</div>
                        <div class="steps-table-header-cell action-cell">Действие</div>
                        <div class="steps-table-header-cell expected-cell">ОР</div>
                        ${statusHeader}
                    </div>
                    <div class="steps-table-body" id="steps-table-body">
                        ${rows}
                    </div>
                </div>
            </div>
        `;
    }

    private static _renderComments(comments: MarkdownComment[]): string {
        const rows = comments && comments.length > 0 ? comments.map((comment, index) => {
            const statusOptions = ['OPEN', 'FIXED', 'CLOSED'];
            const options = statusOptions.map(status => 
                `<option value="${status}" ${comment.status === status ? 'selected' : ''}>${this.escapeHtml(status)}</option>`
            ).join('');

            return `
                <div class="comments-table-row" data-comment-index="${index}">
                    <div class="comments-table-cell number-cell">${comment.number}</div>
                    <div class="comments-table-cell comment-cell">
                        <textarea 
                            class="comment-cell-editable" 
                            data-comment-index="${index}"
                            data-comment-field="comment"
                            rows="1"
                        >${this.escapeHtml(comment.comment || '')}</textarea>
                    </div>
                    <div class="comments-table-cell status-cell">
                        <select 
                            class="comment-status-select" 
                            data-comment-index="${index}"
                            data-comment-field="status"
                        >
                            ${options}
                        </select>
                    </div>
                </div>
            `;
        }).join('') : '';

        return `
            <div class="comments-add-form" id="comments-add-form">
                <textarea 
                    id="new-comment-text" 
                    placeholder="Введите комментарий"
                    rows="3"
                ></textarea>
                <button id="add-comment-button">Добавить</button>
            </div>
            <div class="comments-table">
                <div class="comments-table-header">
                    <div class="comments-table-header-cell number-cell">№</div>
                    <div class="comments-table-header-cell comment-cell">Комментарий</div>
                    <div class="comments-table-header-cell status-cell">Статус</div>
                </div>
                <div class="comments-table-body" id="comments-table-body">
                    ${rows}
                </div>
            </div>
        `;
    }
}

