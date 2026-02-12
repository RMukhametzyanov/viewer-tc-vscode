import * as vscode from 'vscode';
import { TestCaseStatisticsProvider } from './testCaseStatisticsProvider';

export class TestCaseStatisticsPanel {
    private static _panels: Map<string, vscode.WebviewPanel> = new Map();

    public static createOrShow(context: vscode.ExtensionContext): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Если панель уже открыта, показываем её
        const existingPanel = Array.from(this._panels.values())[0];
        if (existingPanel) {
            existingPanel.reveal(column);
            return;
        }

        // Создаем новую панель
        const panel = vscode.window.createWebviewPanel(
            'testCaseStatistics',
            'Статистика тест-кейсов',
            column || vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [context.extensionUri]
            }
        );

        this._panels.set('statistics', panel);
        this.updateContent(panel);

        // Обновляем при закрытии панели
        panel.onDidDispose(() => {
            this._panels.delete('statistics');
        });

        // Обновляем при изменении файлов
        const watcher = vscode.workspace.onDidSaveTextDocument(() => {
            this.updateContent(panel);
        });

        panel.onDidDispose(() => {
            watcher.dispose();
        });

        // Обработка сообщений от webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'refresh':
                    await this.updateContent(panel);
                    return;
                case 'applyFilters':
                    await this.updateContent(panel, message.filters);
                    return;
            }
        });
    }

    private static async updateContent(panel: vscode.WebviewPanel, filters?: any): Promise<void> {
        const statistics = await TestCaseStatisticsProvider.collectStatistics(filters);
        panel.webview.html = this.getHtmlForWebview(panel.webview, statistics, filters);
    }

    private static getHtmlForWebview(webview: vscode.Webview, statistics: any, filters?: any): string {
        // Подготовка данных для графиков
        // Сортируем по алфавиту для стабильного порядка
        const statusData = Object.entries(statistics.byStatus)
            .map(([label, value]) => ({
                label: label || 'Не указан',
                value: value as number
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        const authorData = Object.entries(statistics.byAuthor)
            .map(([label, value]) => ({
                label: label || 'Не указан',
                value: value as number
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        const ownerData = Object.entries(statistics.byOwner)
            .map(([label, value]) => ({
                label: label || 'Не указан',
                value: value as number
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        const testTypeData = Object.entries(statistics.byTestType)
            .map(([label, value]) => ({
                label: label || 'Не указан',
                value: value as number
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        // Генерация теплых цветов для графиков
        const colors = [
            '#FF6B6B',  // Теплый красный/коралловый
            '#FFA07A',  // Светлый лососевый
            '#FFB347',  // Оранжевый
            '#FFD700',  // Золотой
            '#FF8C69',  // Темный лососевый
            '#FF7F50',  // Коралловый
            '#FF6347',  // Томатный
            '#FFA500',  // Оранжевый
            '#FFB6C1',  // Светло-розовый
            '#FF69B4'   // Ярко-розовый
        ];

        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Статистика тест-кейсов</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 24px;
            line-height: 1.5;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }
        
        .header-title {
            font-size: 24px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .header-actions {
            display: flex;
            gap: 8px;
        }
        
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            font-family: var(--vscode-font-family);
        }
        
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .stats-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }
        
        .stat-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
        }
        
        .stat-card-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        
        .stat-card-value {
            font-size: 32px;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
        }
        
        .filters-section {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 32px;
        }
        
        .filters-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--vscode-foreground);
        }
        
        .filters-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
        }
        
        .filter-group {
            display: flex;
            flex-direction: column;
        }
        
        .filter-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
            text-transform: uppercase;
        }
        
        .filter-select {
            font-size: 14px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 6px 8px;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            cursor: pointer;
        }
        
        .filter-select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        .charts-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 24px;
            margin-bottom: 32px;
        }
        
        .chart-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 20px;
            box-sizing: border-box;
            overflow: hidden;
        }
        
        .chart-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--vscode-foreground);
        }
        
        .chart-container {
            position: relative;
            min-height: 300px;
            width: 100%;
            overflow: hidden;
        }
        
        .pie-chart {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
        }
        
        .bar-chart {
            display: flex;
            flex-direction: column;
            gap: 12px;
            height: 100%;
            justify-content: space-around;
        }
        
        .bar-item {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .bar-label {
            min-width: 120px;
            font-size: 13px;
            color: var(--vscode-foreground);
        }
        
        .bar-container {
            flex: 1;
            height: 24px;
            background-color: var(--vscode-panel-border);
            border-radius: 2px;
            overflow: hidden;
            position: relative;
        }
        
        .bar-fill {
            height: 100%;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 8px;
            color: var(--vscode-editor-background);
            font-size: 11px;
            font-weight: 600;
        }
        
        .bar-value {
            min-width: 40px;
            text-align: right;
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .pie-svg {
            width: 250px;
            height: 250px;
            transform: rotate(-90deg);
            flex-shrink: 0;
        }
        
        .pie-segment {
            transition: opacity 0.2s;
        }
        
        .pie-segment:hover {
            opacity: 0.8;
        }
        
        .pie-legend {
            margin-top: 16px;
            display: flex;
            flex-wrap: wrap;
            gap: 12px 16px;
            justify-content: center;
            max-width: 100%;
            padding: 0 8px;
            box-sizing: border-box;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            white-space: nowrap;
            flex-shrink: 0;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 2px;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="header-title">Статистика тест-кейсов</h1>
            <div class="header-actions">
                <button class="btn btn-secondary" id="refresh-btn">Обновить</button>
            </div>
        </div>
        
        <div class="stats-overview">
            <div class="stat-card">
                <div class="stat-card-label">Всего тест-кейсов</div>
                <div class="stat-card-value">${statistics.total}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Уникальных авторов</div>
                <div class="stat-card-value">${Object.keys(statistics.byAuthor).length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Уникальных владельцев</div>
                <div class="stat-card-value">${Object.keys(statistics.byOwner).length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Уникальных статусов</div>
                <div class="stat-card-value">${Object.keys(statistics.byStatus).length}</div>
            </div>
        </div>
        
        <div class="filters-section">
            <div class="filters-title">Фильтры</div>
            <div class="filters-grid">
                <div class="filter-group">
                    <label class="filter-label">Автор</label>
                    <select class="filter-select" id="filter-author">
                        <option value="">Все</option>
                        ${Object.keys(statistics.byAuthor).map(author => 
                            `<option value="${this.escapeHtml(author)}" ${filters?.author === author ? 'selected' : ''}>${this.escapeHtml(author || 'Не указан')}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">Владелец</label>
                    <select class="filter-select" id="filter-owner">
                        <option value="">Все</option>
                        ${Object.keys(statistics.byOwner).map(owner => 
                            `<option value="${this.escapeHtml(owner)}" ${filters?.owner === owner ? 'selected' : ''}>${this.escapeHtml(owner || 'Не указан')}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">Статус</label>
                    <select class="filter-select" id="filter-status">
                        <option value="">Все</option>
                        ${Object.keys(statistics.byStatus).map(status => 
                            `<option value="${this.escapeHtml(status)}" ${filters?.status === status ? 'selected' : ''}>${this.escapeHtml(status || 'Не указан')}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">Тип теста</label>
                    <select class="filter-select" id="filter-test-type">
                        <option value="">Все</option>
                        ${Object.keys(statistics.byTestType).map(testType => 
                            `<option value="${this.escapeHtml(testType)}" ${filters?.testType === testType ? 'selected' : ''}>${this.escapeHtml(testType || 'Не указан')}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        </div>
        
        <div class="charts-section">
            <div class="chart-card">
                <div class="chart-title">Распределение по статусам</div>
                <div class="chart-container">
                    ${statusData.length > 0 ? this.renderPieChart(statusData, colors) : '<div class="empty-state">Нет данных</div>'}
                </div>
            </div>
            
            <div class="chart-card">
                <div class="chart-title">Распределение по авторам</div>
                <div class="chart-container">
                    ${authorData.length > 0 ? this.renderBarChart(authorData, colors) : '<div class="empty-state">Нет данных</div>'}
                </div>
            </div>
            
            <div class="chart-card">
                <div class="chart-title">Распределение по владельцам</div>
                <div class="chart-container">
                    ${ownerData.length > 0 ? this.renderBarChart(ownerData, colors) : '<div class="empty-state">Нет данных</div>'}
                </div>
            </div>
            
            <div class="chart-card">
                <div class="chart-title">Распределение по типам тестов</div>
                <div class="chart-container">
                    ${testTypeData.length > 0 ? this.renderPieChart(testTypeData, colors) : '<div class="empty-state">Нет данных</div>'}
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh' });
        });
        
        // Filter change handlers
        const filterSelects = document.querySelectorAll('.filter-select');
        let filterTimeout;
        
        filterSelects.forEach(select => {
            select.addEventListener('change', () => {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(() => {
                    const filters = {
                        author: document.getElementById('filter-author').value || undefined,
                        owner: document.getElementById('filter-owner').value || undefined,
                        status: document.getElementById('filter-status').value || undefined,
                        testType: document.getElementById('filter-test-type').value || undefined
                    };
                    
                    vscode.postMessage({
                        command: 'applyFilters',
                        filters: filters
                    });
                }, 300);
            });
        });
    </script>
</body>
</html>`;
    }

    private static escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private static renderPieChart(data: Array<{label: string, value: number}>, colors: string[]): string {
        const total = data.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) return '<div class="empty-state">Нет данных</div>';

        let currentAngle = 0;
        const segments: string[] = [];
        const legendItems: string[] = [];

        data.forEach((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (item.value / total) * 360;
            
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            const x1 = 125 + 125 * Math.cos((startAngle * Math.PI) / 180);
            const y1 = 125 + 125 * Math.sin((startAngle * Math.PI) / 180);
            const x2 = 125 + 125 * Math.cos((endAngle * Math.PI) / 180);
            const y2 = 125 + 125 * Math.sin((endAngle * Math.PI) / 180);
            
            const color = colors[index % colors.length];
            
            segments.push(
                `<path class="pie-segment" d="M 125 125 L ${x1} ${y1} A 125 125 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${color}" stroke="var(--vscode-editor-background)" stroke-width="2" data-label="${this.escapeHtml(item.label)}" data-value="${item.value}"></path>`
            );
            
            legendItems.push(
                `<div class="legend-item">
                    <div class="legend-color" style="background-color: ${color}"></div>
                    <span>${this.escapeHtml(item.label)} (${item.value})</span>
                </div>`
            );
            
            currentAngle = endAngle;
        });

        return `
            <div class="pie-chart">
                <svg class="pie-svg" viewBox="0 0 250 250">
                    ${segments.join('')}
                </svg>
            </div>
            <div class="pie-legend">
                ${legendItems.join('')}
            </div>
        `;
    }

    private static renderBarChart(data: Array<{label: string, value: number}>, colors?: string[]): string {
        const maxValue = Math.max(...data.map(item => item.value));
        if (maxValue === 0) return '<div class="empty-state">Нет данных</div>';

        // Теплые цвета для столбчатых графиков
        const warmColors = colors || [
            '#FF6B6B',  // Теплый красный/коралловый
            '#FFA07A',  // Светлый лососевый
            '#FFB347',  // Оранжевый
            '#FFD700',  // Золотой
            '#FF8C69',  // Темный лососевый
            '#FF7F50',  // Коралловый
            '#FF6347',  // Томатный
            '#FFA500',  // Оранжевый
            '#FFB6C1',  // Светло-розовый
            '#FF69B4'   // Ярко-розовый
        ];

        // Сортируем по убыванию значения
        const sortedData = [...data].sort((a, b) => b.value - a.value);

        const bars = sortedData.map((item, index) => {
            const percentage = (item.value / maxValue) * 100;
            const color = warmColors[index % warmColors.length];
            return `
                <div class="bar-item">
                    <div class="bar-label">${this.escapeHtml(item.label)}</div>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${percentage}%; background-color: ${color}">${item.value}</div>
                    </div>
                    <div class="bar-value">${item.value}</div>
                </div>
            `;
        }).join('');

        return `<div class="bar-chart">${bars}</div>`;
    }
}

