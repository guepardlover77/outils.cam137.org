// Main JavaScript - Theme toggle and utilities

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
});

// Theme Management
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'dark';

    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '◐' : '◑';
    }
}

// Logging utility
class Logger {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    log(message, type = '') {
        if (!this.container) return;

        const line = document.createElement('div');
        line.className = `log-line ${type}`;

        const prefix = type === 'success' ? '✓' :
                      type === 'error' ? '✗' :
                      type === 'warning' ? '⚠' :
                      type === 'info' ? 'ℹ' : '$';

        line.innerHTML = `<span class="prompt">${prefix}</span> ${this.escapeHtml(message)}`;
        this.container.appendChild(line);
        this.container.scrollTop = this.container.scrollHeight;
    }

    success(message) { this.log(message, 'success'); }
    error(message) { this.log(message, 'error'); }
    warning(message) { this.log(message, 'warning'); }
    info(message) { this.log(message, 'info'); }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// File utilities
function setupFileInput(inputId, callback, options = {}) {
    const input = document.getElementById(inputId);
    const wrapper = input?.closest('.file-input-wrapper');

    if (!input) return;

    input.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            callback(options.multiple ? Array.from(files) : files[0]);
        }
    });

    if (wrapper) {
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            wrapper.classList.add('dragover');
        });

        wrapper.addEventListener('dragleave', () => {
            wrapper.classList.remove('dragover');
        });

        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            wrapper.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                callback(options.multiple ? Array.from(files) : files[0]);
            }
        });
    }
}

function updateFileName(elementId, name) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = name || '';
    }
}

// Download utilities
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename);
}

function downloadXLSX(workbook, filename) {
    XLSX.writeFile(workbook, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Excel utilities using SheetJS
async function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                resolve(workbook);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function sheetToArray(sheet, options = {}) {
    return XLSX.utils.sheet_to_json(sheet, { header: 1, ...options });
}

function sheetToObjects(sheet, options = {}) {
    return XLSX.utils.sheet_to_json(sheet, options);
}
