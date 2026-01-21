/**
 * Jest Setup - Configuration globale pour les tests
 */

// Mock des APIs du navigateur non disponibles dans jsdom
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock FileReader
class MockFileReader {
    constructor() {
        this.result = null;
        this.onload = null;
        this.onerror = null;
    }

    readAsDataURL(file) {
        setTimeout(() => {
            if (file && file.content) {
                this.result = file.content;
            } else {
                this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            }
            if (this.onload) this.onload();
        }, 0);
    }

    readAsArrayBuffer(file) {
        setTimeout(() => {
            this.result = new ArrayBuffer(8);
            if (this.onload) this.onload();
        }, 0);
    }

    readAsText(file) {
        setTimeout(() => {
            this.result = file.textContent || '';
            if (this.onload) this.onload();
        }, 0);
    }
}

global.FileReader = MockFileReader;

// Mock Blob
global.Blob = class MockBlob {
    constructor(parts, options = {}) {
        this.parts = parts;
        this.type = options.type || '';
        this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
    }

    text() {
        return Promise.resolve(this.parts.join(''));
    }
};

// Mock createElement pour les downloads
const originalCreateElement = document.createElement.bind(document);
document.createElement = function(tagName) {
    const element = originalCreateElement(tagName);
    if (tagName === 'a') {
        element.click = jest.fn();
    }
    return element;
};

// Utilitaire pour creer un fichier mock
global.createMockFile = (name, content, type) => {
    const file = new Blob([content], { type });
    file.name = name;
    file.lastModified = Date.now();
    return file;
};

// Utilitaire pour creer une image mock en base64
global.createMockImageBase64 = () => {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
};

// Console silencieuse pour les tests (optionnel)
// global.console = {
//     ...console,
//     log: jest.fn(),
//     warn: jest.fn(),
//     error: jest.fn(),
// };
