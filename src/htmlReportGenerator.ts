import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MarkdownTestCaseParser, MarkdownTestCase } from './markdownTestCaseParser';

interface Statistics {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pending: number;
}

interface TestCaseResult {
    case: MarkdownTestCase;
    status: 'passed' | 'failed' | 'skipped' | 'pending';
    skipReason?: string;
    errorReason?: string;
}

/**
 * Получить текущую Git ветку
 */
async function getCurrentBranch(): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return 'unknown';
    }

    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (gitExtension && gitExtension.isActive) {
            const git = gitExtension.exports.getAPI(1);
            const repository = git.getRepository(workspaceFolders[0].uri);
            if (repository) {
                return repository.state.HEAD?.name || 'unknown';
            }
        }
    } catch (e) {
        // Fallback к команде git
    }

    // Fallback: выполнить git команду
    try {
        const { execSync } = require('child_process');
        const branch = execSync('git branch --show-current', { 
            cwd: workspaceFolders[0].uri.fsPath,
            encoding: 'utf8'
        }).trim();
        return branch || 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

export async function generateHtmlReport(
    testCasesDir?: vscode.Uri,
    projectName?: string
): Promise<vscode.Uri | null> {
    try {
        // Определяем рабочую папку
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Не найдена рабочая папка');
            return null;
        }

        const workspaceFolder = workspaceFolders[0];
        const workspacePath = workspaceFolder.uri.fsPath;

        // Получаем текущую ветку Git
        const branch = await getCurrentBranch();

        // Создаем папку _releases в workspace (как в функционале "Запуск тест-кейсов")
        const releasesDir = path.join(workspacePath, '_releases');
        if (!fs.existsSync(releasesDir)) {
            fs.mkdirSync(releasesDir, { recursive: true });
        }

        // Создаем подпапку с названием ветки
        const branchDir = path.join(releasesDir, branch);
        if (!fs.existsSync(branchDir)) {
            fs.mkdirSync(branchDir, { recursive: true });
        }

        const reportDir = branchDir;

        // Получаем текущую дату и время
        const now = new Date();

        // Загружаем все тест-кейсы
        const files = await vscode.workspace.findFiles('**/*.md');
        const testCases: MarkdownTestCase[] = [];

        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const contentStr = content.toString();
                const testCase = MarkdownTestCaseParser.parse(contentStr);
                
                // Проверяем, что это тест-кейс (есть заголовок)
                if (testCase.title || (testCase.steps && testCase.steps.length > 0)) {
                    testCases.push(testCase);
                }
            } catch (e) {
                // Пропустить невалидные MD файлы
                console.log(`Skipping file ${file.fsPath}: ${e}`);
            }
        }

        if (testCases.length === 0) {
            vscode.window.showWarningMessage('Не найдено тест-кейсов для генерации отчета');
            return null;
        }

        // Собираем статистику
        const stats = calculateStatistics(testCases);
        const owners = getUniqueOwners(testCases);
        const results = collectTestResults(testCases);

        // Генерируем HTML
        const htmlContent = generateHtmlContent(stats, owners, now, results, testCases);

        // Формируем имя файла с датой и названием проекта
        const dateStr = now.toISOString().split('T')[0];
        const htmlFilename = projectName && projectName.trim()
            ? `${projectName.trim()}. Отчет о прохождении тестирования ${dateStr}.html`
            : `Отчет о прохождении тестирования ${dateStr}.html`;

        // Сохраняем HTML файл
        const htmlFile = path.join(reportDir, htmlFilename);
        fs.writeFileSync(htmlFile, htmlContent, 'utf-8');

        return vscode.Uri.file(reportDir);
    } catch (error) {
        vscode.window.showErrorMessage(`Ошибка при генерации HTML отчета: ${error}`);
        return null;
    }
}

function calculateStatistics(testCases: MarkdownTestCase[]): Statistics {
    let total = testCases.length;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;

    for (const testCase of testCases) {
        const steps = testCase.steps || [];
        if (steps.length === 0) {
            pending++;
            continue;
        }

        const statuses = steps.map(s => (s.status || '').trim().toLowerCase());

        // Проверяем наличие failed (приоритет 1)
        if (statuses.some(s => s === 'failed')) {
            failed++;
            continue;
        }

        // Проверяем наличие skipped (приоритет 2)
        if (statuses.some(s => s === 'skipped')) {
            skipped++;
            continue;
        }

        // Проверяем, все ли шаги passed
        if (statuses.every(s => s) && statuses.every(s => s === 'passed')) {
            passed++;
        } else {
            pending++;
        }
    }

    return { total, passed, failed, skipped, pending };
}

function getUniqueOwners(testCases: MarkdownTestCase[]): Set<string> {
    const owners = new Set<string>();
    for (const testCase of testCases) {
        const owner = testCase.metadata.owner || '';
        if (owner.trim()) {
            owners.add(owner.trim());
        }
    }
    return owners;
}

function collectTestResults(testCases: MarkdownTestCase[]): TestCaseResult[] {
    const results: TestCaseResult[] = [];

    for (const testCase of testCases) {
        const steps = testCase.steps || [];
        if (steps.length === 0) {
            continue;
        }

        const statuses = steps.map(s => (s.status || '').trim().toLowerCase());

        let status: 'passed' | 'failed' | 'skipped' | 'pending' = 'pending';
        let skipReason = '';
        let errorReason = '';

        if (statuses.some(s => s === 'failed')) {
            status = 'failed';
            const errorReasons: string[] = [];
            for (const step of steps) {
                if (step.status === 'failed') {
                    const reason = step.reason || '';
                    if (reason) {
                        errorReasons.push(reason);
                    }
                }
            }
            errorReason = [...new Set(errorReasons)].join(', ');
        } else if (statuses.some(s => s === 'skipped')) {
            status = 'skipped';
            const skipReasons: string[] = [];
            for (const step of steps) {
                if (step.status === 'skipped') {
                    const reason = step.reason || '';
                    if (reason) {
                        skipReasons.push(reason);
                    }
                }
            }
            skipReason = [...new Set(skipReasons)].join(', ');
        } else if (statuses.every(s => s) && statuses.every(s => s === 'passed')) {
            status = 'passed';
        }

        // Добавляем только тест-кейсы со статусами failed, skipped или passed
        if (status !== 'pending') {
            results.push({
                case: testCase,
                status,
                skipReason: skipReason || undefined,
                errorReason: errorReason || undefined
            });
        }
    }

    // Сортируем: сначала failed, потом skipped, потом passed
    const statusOrder: { [key: string]: number } = { failed: 0, skipped: 1, passed: 2 };
    results.sort((a, b) => {
        const orderA = statusOrder[a.status] ?? 3;
        const orderB = statusOrder[b.status] ?? 3;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        return (a.case.title || '').localeCompare(b.case.title || '');
    });

    return results;
}

function escapeHtml(text: string): string {
    if (!text) {
        return '';
    }
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function generateResultsSection(results: TestCaseResult[]): string {
    let tableRows = '';

    for (const result of results) {
        const testCase = result.case;
        const caseId = testCase.metadata.id || '';
        const owner = testCase.metadata.owner || '';
        const status = result.status;
        const statusClass = `status-${status}`;
        const statusText: { [key: string]: string } = {
            failed: 'Не пройдено',
            skipped: 'Пропущено',
            passed: 'Успешно'
        };

        tableRows += `
            <tr>
                <td>${escapeHtml(caseId)}</td>
                <td>${escapeHtml(testCase.title || '')}</td>
                <td>${escapeHtml(owner)}</td>
                <td><span class="status-badge ${statusClass}">${statusText[status] || status}</span></td>
                <td>${escapeHtml(result.skipReason || '-')}</td>
                <td>${escapeHtml(result.errorReason || '-')}</td>
            </tr>
        `;
    }

    if (!tableRows) {
        tableRows = `
            <tr>
                <td colspan="6" style="text-align: center; color: #888; padding: 40px;">
                    Нет тест-кейсов с результатами прогона
                </td>
            </tr>
        `;
    }

    return `
        <div class="results-section">
            <div class="results-title">📋 Результаты прогона тест-кейсов</div>
            
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Идентификатор тест-кейса</th>
                        <th>Название</th>
                        <th>Владелец</th>
                        <th>Статус</th>
                        <th>Причина пропуска</th>
                        <th>Причина ошибки</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

function generateHtmlContent(
    stats: Statistics,
    owners: Set<string>,
    generationDate: Date,
    results: TestCaseResult[],
    testCases: MarkdownTestCase[]
): string {
    const total = stats.total;
    const passed = stats.passed;
    const failed = stats.failed;
    const skipped = stats.skipped;
    const pending = stats.pending;

    // Вычисляем проценты для диаграммы
    const passedPercent = total > 0 ? (passed / total * 100) : 0;
    const failedPercent = total > 0 ? (failed / total * 100) : 0;
    const skippedPercent = total > 0 ? (skipped / total * 100) : 0;
    const pendingPercent = total > 0 ? (pending / total * 100) : 0;

    // Формируем данные для круговой диаграммы
    const chartData = [
        { label: 'Успешно', value: passed, percent: passedPercent, color: '#6CC24A' },
        { label: 'Не пройдено', value: failed, percent: failedPercent, color: '#F5555D' },
        { label: 'Пропущено', value: skipped, percent: skippedPercent, color: '#95a5a6' },
        { label: 'Осталось', value: pending, percent: pendingPercent, color: '#FFA931' },
    ];

    // Формируем список участников
    const ownersList = Array.from(owners).sort();

    // Форматируем дату
    const dateStr = generationDate.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Генерируем секцию с результатами
    const resultsSection = generateResultsSection(results);

    const chartDataJson = JSON.stringify(chartData);

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Отчет по тест-кейсам</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
            color: #e0e0e0;
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: #2a2a2a;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        h1 {
            color: #ffffff;
            margin-bottom: 10px;
            font-size: 32px;
            text-align: center;
        }
        
        .subtitle {
            text-align: center;
            color: #a0a0a0;
            margin-bottom: 30px;
            font-size: 14px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .stat-card {
            background: #333;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            border: 1px solid #444;
        }
        
        .stat-card.passed {
            border-color: #6CC24A;
        }
        
        .stat-card.failed {
            border-color: #F5555D;
        }
        
        .stat-card.skipped {
            border-color: #95a5a6;
        }
        
        .stat-card.pending {
            border-color: #FFA931;
        }
        
        .stat-value {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stat-value.passed {
            color: #6CC24A;
        }
        
        .stat-value.failed {
            color: #F5555D;
        }
        
        .stat-value.skipped {
            color: #95a5a6;
        }
        
        .stat-value.pending {
            color: #FFA931;
        }
        
        .stat-label {
            color: #b0b0b0;
            font-size: 14px;
        }
        
        .chart-container {
            background: #333;
            border-radius: 8px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #444;
        }
        
        .chart-title {
            color: #ffffff;
            font-size: 20px;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .chart-wrapper {
            max-width: 400px;
            margin: 0 auto;
        }
        
        .owners-section {
            background: #333;
            border-radius: 8px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #444;
        }
        
        .owners-title {
            color: #ffffff;
            font-size: 20px;
            margin-bottom: 20px;
        }
        
        .owners-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .owner-badge {
            background: #444;
            color: #e0e0e0;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            border: 1px solid #555;
        }
        
        .info-section {
            background: #333;
            border-radius: 8px;
            padding: 20px;
            border: 1px solid #444;
            text-align: center;
        }
        
        .info-item {
            color: #b0b0b0;
            margin: 5px 0;
            font-size: 14px;
        }
        
        .results-section {
            background: #333;
            border-radius: 8px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #444;
        }
        
        .results-title {
            color: #ffffff;
            font-size: 20px;
            margin-bottom: 20px;
        }
        
        .tabs {
            display: flex;
            border-bottom: 2px solid #444;
            margin-bottom: 30px;
        }
        
        .tab-button {
            background: #2a2a2a;
            color: #b0b0b0;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            transition: all 0.3s;
        }
        
        .tab-button:hover {
            color: #e0e0e0;
            background: #333;
        }
        
        .tab-button.active {
            color: #ffffff;
            border-bottom-color: #6CC24A;
            background: #333;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .results-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .results-table th {
            background: #2a2a2a;
            color: #ffffff;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #444;
            font-weight: 600;
        }
        
        .results-table td {
            padding: 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            color: #e0e0e0;
        }
        
        .results-table tr:hover {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .status-failed {
            background: #F5555D;
            color: #ffffff;
        }
        
        .status-skipped {
            background: #95a5a6;
            color: #ffffff;
        }
        
        .status-passed {
            background: #6CC24A;
            color: #ffffff;
        }
        
        .status-pending {
            background: #FFA931;
            color: #ffffff;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Отчет по тест-кейсам</h1>
        <div class="subtitle">Дата формирования: ${dateStr}</div>
        
        <div class="tabs">
            <button class="tab-button active" onclick="showTab('general')">Общая информация</button>
            <button class="tab-button" onclick="showTab('results')">Результаты прогона тест-кейсов</button>
        </div>
        
        <div id="generalTab" class="tab-content active">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${total}</div>
                    <div class="stat-label">Всего тест-кейсов</div>
                </div>
                <div class="stat-card passed">
                    <div class="stat-value passed">${passed}</div>
                    <div class="stat-label">Успешно пройдено</div>
                </div>
                <div class="stat-card failed">
                    <div class="stat-value failed">${failed}</div>
                    <div class="stat-label">Не пройдено</div>
                </div>
                <div class="stat-card skipped">
                    <div class="stat-value skipped">${skipped}</div>
                    <div class="stat-label">Пропущено</div>
                </div>
                <div class="stat-card pending">
                    <div class="stat-value pending">${pending}</div>
                    <div class="stat-label">Осталось</div>
                </div>
            </div>
            
            <div class="chart-container">
                <div class="chart-title">Распределение по статусам</div>
                <div class="chart-wrapper">
                    <canvas id="statusChart"></canvas>
                </div>
            </div>
            
            <div class="owners-section">
                <div class="owners-title">👥 Участники (${ownersList.length})</div>
                <div class="owners-list">
${ownersList.map(owner => `                    <div class="owner-badge">${escapeHtml(owner)}</div>`).join('\n')}
                </div>
            </div>
            
            <div class="info-section">
                <div class="info-item">📅 Дата формирования отчета: ${dateStr}</div>
                <div class="info-item">📈 Всего тест-кейсов: ${total}</div>
                <div class="info-item">✅ Успешно: ${passed} (${passedPercent.toFixed(1)}%)</div>
                <div class="info-item">❌ Не пройдено: ${failed} (${failedPercent.toFixed(1)}%)</div>
                <div class="info-item">⏭️ Пропущено: ${skipped} (${skippedPercent.toFixed(1)}%)</div>
                <div class="info-item">⏳ Осталось: ${pending} (${pendingPercent.toFixed(1)}%)</div>
            </div>
        </div>
        
        <div id="resultsTab" class="tab-content">
            ${resultsSection}
        </div>
    </div>
    
    <script>
        const ctx = document.getElementById('statusChart');
        const chartData = ${chartDataJson};
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.map(item => item.label),
                datasets: [{
                    data: chartData.map(item => item.value),
                    backgroundColor: chartData.map(item => item.color),
                    borderWidth: 2,
                    borderColor: '#2a2a2a'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e0e0e0',
                            font: {
                                size: 14
                            },
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = chartData[context.dataIndex];
                                return item.label + ': ' + item.value + ' (' + item.percent.toFixed(1) + '%)';
                            }
                        }
                    }
                }
            }
        });
        
        function showTab(tabName) {
            // Скрываем все вкладки
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Убираем активный класс со всех кнопок
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Показываем выбранную вкладку
            document.getElementById(tabName + 'Tab').classList.add('active');
            
            // Активируем кнопку
            const buttons = document.querySelectorAll('.tab-button');
            buttons.forEach(btn => {
                if (btn.textContent.includes(tabName === 'general' ? 'Общая информация' : 'Результаты прогона')) {
                    btn.classList.add('active');
                }
            });
        }
    </script>
</body>
</html>`;
}

