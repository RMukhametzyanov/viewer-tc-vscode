export interface MarkdownComment {
    number: number;
    comment: string;
    status: string;
}

export interface MarkdownTestCase {
    title: string;
    metadata: {
        id?: string;
        author?: string;
        owner?: string;
        status?: string;
        testType?: string;
    };
    links?: string[];
    attachedDocuments?: string[];
    epicFeatureStory: {
        epic?: string;
        feature?: string;
        story?: string;
    };
    tags?: string[];
    description?: string;
    preconditions?: string;
    steps: MarkdownTestStep[];
    comments?: MarkdownComment[];
}

export interface MarkdownTestStep {
    stepNumber: number;
    action: string;
    expectedResult: string;
    attachments?: string;
    status?: string;
    reason?: string; // Причина для failed/skipped статусов
}

export class MarkdownTestCaseParser {
    public static parse(content: string): MarkdownTestCase {
        const lines = content.split('\n');
        const result: MarkdownTestCase = {
            title: '',
            metadata: {},
            links: [],
            attachedDocuments: [],
            epicFeatureStory: {},
            tags: [],
            steps: [],
            comments: []
        };

        let currentSection = '';
        let inTable = false;
        let tableHeaders: string[] = [];
        let tableRows: string[][] = [];
        let currentTableRow: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty lines
            if (!line) {
                if (inTable && currentTableRow.length > 0) {
                    tableRows.push([...currentTableRow]);
                    currentTableRow = [];
                }
                continue;
            }

            // Check for main title (first line with single #)
            if (!result.title && line.startsWith('# ') && !line.startsWith('##')) {
                result.title = line.replace(/^#\s*/, '').trim();
                continue;
            }

            // Check for headers
            if (line.startsWith('##')) {
                // Process previous table if exists
                if (inTable) {
                    this._processTable(currentSection, tableHeaders, tableRows, result);
                    inTable = false;
                    tableHeaders = [];
                    tableRows = [];
                    currentTableRow = [];
                }

                const headerText = line.replace(/^##\s*/, '').trim();
                currentSection = headerText;
                continue;
            }

            // Check for table start (separator line with ---)
            if (line.startsWith('|') && line.includes('---')) {
                // This is a table separator, headers should be in previous line
                if (i > 0) {
                    const headerLine = lines[i - 1].trim();
                    if (headerLine.startsWith('|')) {
                        tableHeaders = this._parseTableRow(headerLine);
                        inTable = true;
                    }
                }
                continue;
            }

            // Check if this is a table header row (if we're in a section with tables)
            if (!inTable && line.startsWith('|') && (currentSection === 'Метаданные' || currentSection === 'Epic/Feature/Story' || currentSection === 'Шаги тестирования' || currentSection === 'Комментарии')) {
                // Check if next line is a separator
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    if (nextLine.startsWith('|') && nextLine.includes('---')) {
                        tableHeaders = this._parseTableRow(line);
                        inTable = true;
                        continue; // Skip to next iteration to process separator
                    }
                }
            }

            // Process table rows
            if (inTable && line.startsWith('|')) {
                const cells = this._parseTableRow(line);
                if (cells.length > 0) {
                    tableRows.push(cells);
                }
                continue;
            }

            // Process non-table content
            if (!inTable) {
                this._processLine(currentSection, line, result);
            }
        }

        // Process last table if exists
        if (inTable) {
            this._processTable(currentSection, tableHeaders, tableRows, result);
        }

        return result;
    }

    private static _parseTableRow(line: string): string[] {
        // Split by | and keep all cells, including empty ones
        const cells = line.split('|');
        // Remove first and last empty cells (from leading/trailing |)
        const result = cells.slice(1, -1).map(cell => cell.trim());
        return result;
    }

    private static _processTable(section: string, headers: string[], rows: string[][], result: MarkdownTestCase) {
        if (section === 'Метаданные') {
            for (const row of rows) {
                if (row.length >= 2) {
                    const field = row[0].replace(/\*\*/g, '').trim();
                    const value = row[1].trim();
                    
                    if (field === 'ID') {
                        result.metadata.id = value;
                    } else if (field === 'Автор') {
                        result.metadata.author = value;
                    } else if (field === 'Исполнитель' || field === 'Владелец') {
                        result.metadata.owner = value;
                    } else if (field === 'Статус') {
                        result.metadata.status = value;
                    } else if (field === 'Тип теста') {
                        result.metadata.testType = value;
                    }
                }
            }
        } else if (section === 'Epic/Feature/Story') {
            for (const row of rows) {
                if (row.length >= 2) {
                    const field = row[0].replace(/\*\*/g, '').trim();
                    const value = row[1].trim();
                    
                    if (field === 'Epic') {
                        result.epicFeatureStory.epic = value;
                    } else if (field === 'Feature') {
                        result.epicFeatureStory.feature = value;
                    } else if (field === 'Story') {
                        result.epicFeatureStory.story = value;
                    }
                }
            }
        } else if (section === 'Шаги тестирования') {
            // Find indices of columns
            const stepIndex = headers.findIndex(h => h.toLowerCase().includes('шаг'));
            const actionIndex = headers.findIndex(h => h.toLowerCase().includes('действие'));
            const expectedIndex = headers.findIndex(h => h.toLowerCase().includes('ор') || h.toLowerCase().includes('ожидаемый'));
            const statusIndex = headers.findIndex(h => h.toLowerCase().includes('статус'));

            for (const row of rows) {
                const statusCell = statusIndex >= 0 && row[statusIndex] ? row[statusIndex] : '';
                // Парсим статус: может быть "passed", "failed<br>Причина: ...", "skipped<br>Причина: ..."
                let status = '';
                let reason = '';
                
                if (statusCell) {
                    // Проверяем наличие <br> и причины
                    const brMatch = statusCell.match(/^(.+?)(?:<br\s*\/?>|\\n)(?:Причина:\s*)?(.+)$/i);
                    if (brMatch) {
                        status = brMatch[1].trim().toLowerCase();
                        reason = brMatch[2].trim();
                    } else {
                        status = this._normalizeStepCell(statusCell).toLowerCase();
                    }
                }
                
                const step: MarkdownTestStep = {
                    stepNumber: stepIndex >= 0 && row[stepIndex] ? parseInt(row[stepIndex]) || 0 : 0,
                    action: actionIndex >= 0 && row[actionIndex] ? this._normalizeStepCell(row[actionIndex]) : '',
                    expectedResult: expectedIndex >= 0 && row[expectedIndex] ? this._normalizeStepCell(row[expectedIndex]) : '',
                    status: status || undefined,
                    reason: reason || undefined
                };
                
                if (step.stepNumber > 0 || step.action || step.expectedResult) {
                    result.steps.push(step);
                }
            }
        } else if (section === 'Комментарии') {
            // Find indices of columns
            const numberIndex = headers.findIndex(h => h.toLowerCase().includes('№') || h.toLowerCase().includes('номер'));
            const commentIndex = headers.findIndex(h => h.toLowerCase().includes('комментарий'));
            const statusIndex = headers.findIndex(h => h.toLowerCase().includes('статус'));

            for (const row of rows) {
                if (!result.comments) {
                    result.comments = [];
                }
                const comment: MarkdownComment = {
                    number: numberIndex >= 0 && row[numberIndex] ? parseInt(row[numberIndex]) || result.comments.length + 1 : result.comments.length + 1,
                    comment: commentIndex >= 0 && row[commentIndex] ? this._normalizeStepCell(row[commentIndex]) : '',
                    status: statusIndex >= 0 && row[statusIndex] ? row[statusIndex].trim() : 'OPEN'
                };
                
                if (comment.comment) {
                    result.comments.push(comment);
                }
            }
        }
    }

    /**
     * Преобразует содержимое ячейки шага из markdown в текст для редактирования.
     * Заменяем <br> на переводы строк, чтобы в textarea отображалось многострочно.
     */
    private static _normalizeStepCell(value: string): string {
        if (!value) return '';
        return value
            .replace(/<br\s*\/?>/gi, '\n')
            .trim();
    }

    private static _processLine(section: string, line: string, result: MarkdownTestCase) {
        if (section === 'Связи') {
            // Extract links from markdown format [text](url)
            // и сохраняем только саму ссылку без ведущих "-"/"*" и лишних символов
            const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                if (!result.links) {
                    result.links = [];
                }
                // linkMatch[0] содержит ровно `[Текст](url)`, убираем лишние символы после ссылки
                const cleanLink = linkMatch[0].trim().replace(/\|[^|]*$/, '').trim();
                if (cleanLink) {
                    result.links.push(cleanLink);
                }
            }
        } else if (section === 'Вложения') {
            // Обработка ссылок на файлы в формате [Название](относительный/путь/к/файлу)
            const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                if (!result.attachedDocuments) {
                    result.attachedDocuments = [];
                }
                // Сохраняем относительный путь к файлу в формате [Название](путь)
                result.attachedDocuments.push(linkMatch[0].trim());
            }
        } else if (section === 'Теги (tags)' || section === 'Теги') {
            // Parse tags (comma-separated)
            const tags = line.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            result.tags = [...(result.tags || []), ...tags];
        } else if (section === 'Описание (description)' || section === 'Описание') {
            if (!result.description) {
                result.description = '';
            }
            result.description += (result.description ? '\n' : '') + line;
        } else if (section === 'Предусловия (preconditions)' || section === 'Предусловия') {
            if (!result.preconditions) {
                result.preconditions = '';
            }
            result.preconditions += (result.preconditions ? '\n' : '') + line;
        }
        // Комментарии теперь обрабатываются как таблица в _processTable
    }

    public static serialize(testCase: MarkdownTestCase): string {
        const lines: string[] = [];

        // Title - добавляем # если его нет
        const title = testCase.title || '';
        const titleWithHash = title.startsWith('# ') ? title : (title ? `# ${title}` : '');
        lines.push(titleWithHash);
        lines.push('');

        // Метаданные
        lines.push('## Метаданные');
        lines.push('| Поле | Значение |');
        lines.push('|------|----------|');
        lines.push(`| **ID** | ${testCase.metadata.id || ''} |`);
        lines.push(`| **Автор** | ${testCase.metadata.author || ''} |`);
        lines.push(`| **Исполнитель** | ${testCase.metadata.owner || ''} |`);
        lines.push(`| **Статус** | ${testCase.metadata.status || ''} |`);
        lines.push(`| **Тип теста** | ${testCase.metadata.testType || ''} |`);
        lines.push('');

        // Связи
        lines.push('## Связи');
        if (testCase.links && testCase.links.length > 0) {
            testCase.links.forEach(link => {
                lines.push(` - ${link}`);
            });
        }
        lines.push('');

        // Epic/Feature/Story
        lines.push('## Epic/Feature/Story');
        lines.push('| Поле | Значение |');
        lines.push('|------|----------|');
        lines.push(`| **Epic** | ${testCase.epicFeatureStory.epic || ''} |`);
        lines.push(`| **Feature** | ${testCase.epicFeatureStory.feature || ''} |`);
        lines.push(`| **Story** | ${testCase.epicFeatureStory.story || ''} |`);
        lines.push('');

        // Теги
        lines.push('## Теги (tags)');
        if (testCase.tags && testCase.tags.length > 0) {
            lines.push(testCase.tags.join(', '));
        }
        lines.push('');

        // Описание
        lines.push('## Описание (description)');
        if (testCase.description) {
            lines.push(testCase.description);
        }
        lines.push('');

        // Предусловия
        lines.push('## Предусловия (preconditions)');
        if (testCase.preconditions) {
            lines.push(testCase.preconditions);
        }
        lines.push('');

        // Вложения
        lines.push('## Вложения');
        if (testCase.attachedDocuments && testCase.attachedDocuments.length > 0) {
            testCase.attachedDocuments.forEach(doc => {
                lines.push(` - ${doc}`);
            });
        }
        lines.push('');

        // Шаги тестирования
        lines.push('## Шаги тестирования');
        lines.push('| Шаг |  Действие  |           ОР          | Статус |');
        lines.push('|-----|------------|-----------------------|--------|');
        if (testCase.steps && testCase.steps.length > 0) {
            testCase.steps.forEach(step => {
                const action = this._serializeStepCell(step.action);
                const expected = this._serializeStepCell(step.expectedResult);
                // Форматируем статус: если есть причина для failed/skipped, добавляем <br>Причина: ...
                let status = '';
                if (step.status) {
                    const statusLower = step.status.toLowerCase();
                    if ((statusLower === 'failed' || statusLower === 'skipped') && step.reason) {
                        status = `${statusLower}<br>Причина: ${this._serializeStepCell(step.reason)}`;
                    } else {
                        status = statusLower;
                    }
                }
                lines.push(`| ${step.stepNumber} | ${action} | ${expected} | ${status} |`);
            });
        }
        lines.push('');
        lines.push('');

        // Комментарии
        lines.push('## Комментарии');
        lines.push('');
        if (testCase.comments && testCase.comments.length > 0) {
            lines.push('| № |  Комментарий  |  Статус  |');
            lines.push('|---|------------|------------|');
            testCase.comments.forEach(comment => {
                const commentText = this._serializeStepCell(comment.comment);
                lines.push(`|${comment.number} |${commentText} |${comment.status || 'OPEN'} |`);
            });
        } else {
            lines.push('| № |  Комментарий  |  Статус  |');
            lines.push('|---|------------|------------|');
        }

        return lines.join('\n');
    }

    /**
     * Преобразует многострочный текст шага в формат для markdown-таблицы.
     * Переводы строк заменяем на <br>, чтобы строка шага оставалась одной строкой в таблице.
     */
    private static _serializeStepCell(value?: string): string {
        if (!value) return '';
        return value.replace(/\r?\n/g, '<br>');
    }
}

