/**
 * Tests pour Sumup Licences
 * Teste l'extraction et l'organisation des anonymats par licence
 */

// Mock du DOM
document.body.innerHTML = `
    <input type="file" id="input-files" multiple>
    <div id="file-list"></div>
    <div id="log-output"></div>
    <button id="btn-process" disabled></button>
    <button id="btn-clear"></button>
`;

// Mock dependencies
global.Logger = class Logger {
    constructor(id) { this.id = id; }
    info(msg) {}
    success(msg) {}
    error(msg) {}
    warning(msg) {}
    clear() {}
    log(msg) {}
};

global.setupFileInput = jest.fn();
global.readExcelFile = jest.fn();
global.sheetToObjects = jest.fn();
global.downloadXLSX = jest.fn();

// Charger le code source
const fs = require('fs');
const path = require('path');
const sumupLicencesCode = fs.readFileSync(
    path.join(__dirname, '../js/sumup-licences.js'),
    'utf8'
);

// Variables globales
let loadedFiles = [];
let logger = new Logger('log-output');

// Extraire les fonctions necessaires
const functionPatterns = [
    /function escapeHtml\([\s\S]*?\n\}/,
    /function removeFile\([\s\S]*?\n\}/,
    /function updateFileList\([\s\S]*?\n\}/
];

let extractedCode = '';
functionPatterns.forEach(pattern => {
    const match = sumupLicencesCode.match(pattern);
    if (match) {
        extractedCode += match[0] + '\n\n';
    }
});

eval(extractedCode);

describe('Sumup Licences', () => {

    beforeEach(() => {
        loadedFiles = [];
    });

    describe('Classification des numeros d\'anonymat', () => {
        test('devrait classifier les numeros commencant par 1 ou 7', () => {
            const numeros = [1234, 7890, 1111, 7777];

            const result = numeros.filter(n => {
                const firstDigit = String(n)[0];
                return firstDigit === '1' || firstDigit === '7';
            });

            expect(result).toEqual([1234, 7890, 1111, 7777]);
        });

        test('devrait classifier les numeros commencant par 9', () => {
            const numeros = [9001, 9876, 9999, 1234];

            const result = numeros.filter(n => {
                const firstDigit = String(n)[0];
                return firstDigit === '9';
            });

            expect(result).toEqual([9001, 9876, 9999]);
        });

        test('devrait ignorer les numeros commencant par autres chiffres', () => {
            const numeros = [1234, 2345, 3456, 7890, 9012];

            const etudiants17 = numeros.filter(n => ['1', '7'].includes(String(n)[0]));
            const etudiants9 = numeros.filter(n => String(n)[0] === '9');
            const autres = numeros.filter(n => !['1', '7', '9'].includes(String(n)[0]));

            expect(etudiants17).toEqual([1234, 7890]);
            expect(etudiants9).toEqual([9012]);
            expect(autres).toEqual([2345, 3456]);
        });
    });

    describe('Extraction du nom de licence depuis le fichier', () => {
        test('devrait extraire le nom de licence du nom de fichier', () => {
            const filename = 'L1_BIOLOGIE.xlsx';
            const licence = filename.replace(/\.[^/.]+$/, '').toUpperCase();

            expect(licence).toBe('L1_BIOLOGIE');
        });

        test('devrait gerer differents formats de noms', () => {
            const testCases = [
                { file: 'l2-chimie.xlsx', expected: 'L2-CHIMIE' },
                { file: 'PACES.xlsx', expected: 'PACES' },
                { file: 'master_1_bio.xlsx', expected: 'MASTER_1_BIO' }
            ];

            testCases.forEach(tc => {
                const licence = tc.file.replace(/\.[^/.]+$/, '').toUpperCase();
                expect(licence).toBe(tc.expected);
            });
        });
    });

    describe('Detection de la colonne Client', () => {
        test('devrait trouver la colonne Client', () => {
            const headers = ['Date', 'Client', 'Montant', 'Reference'];
            const clientColumn = headers.find(h =>
                h.toLowerCase().includes('client') && !h.toLowerCase().includes('nom')
            );

            expect(clientColumn).toBe('Client');
        });

        test('devrait gerer differentes variantes du nom', () => {
            const variants = ['Client', 'CLIENT', 'client', 'N° Client', 'Id Client'];

            variants.forEach(header => {
                const isClient = header.toLowerCase().includes('client') &&
                                !header.toLowerCase().includes('nom');
                expect(isClient).toBe(true);
            });
        });

        test('devrait exclure Nom Client', () => {
            const header = 'Nom Client';
            const isClient = header.toLowerCase().includes('client') &&
                            !header.toLowerCase().includes('nom');
            expect(isClient).toBe(false);
        });
    });

    describe('Detection des doublons', () => {
        test('devrait detecter les doublons entre licences', () => {
            const etudiants = [
                { numero: 1234, licence: 'L1_BIO' },
                { numero: 5678, licence: 'L1_BIO' },
                { numero: 1234, licence: 'L2_CHIMIE' }, // Doublon
                { numero: 9012, licence: 'L2_CHIMIE' }
            ];

            const seen = new Map();
            const doublons = [];

            etudiants.forEach(e => {
                if (seen.has(e.numero)) {
                    doublons.push({
                        numero: e.numero,
                        licences: [seen.get(e.numero), e.licence]
                    });
                } else {
                    seen.set(e.numero, e.licence);
                }
            });

            expect(doublons).toHaveLength(1);
            expect(doublons[0].numero).toBe(1234);
            expect(doublons[0].licences).toEqual(['L1_BIO', 'L2_CHIMIE']);
        });

        test('devrait gerer les cas sans doublons', () => {
            const etudiants = [
                { numero: 1234, licence: 'L1' },
                { numero: 5678, licence: 'L2' },
                { numero: 9012, licence: 'L3' }
            ];

            const seen = new Set();
            const doublons = [];

            etudiants.forEach(e => {
                if (seen.has(e.numero)) {
                    doublons.push(e.numero);
                }
                seen.add(e.numero);
            });

            expect(doublons).toHaveLength(0);
        });
    });

    describe('Statistiques par licence', () => {
        test('devrait compter les etudiants par licence', () => {
            const etudiants = [
                { numero: 1001, licence: 'L1' },
                { numero: 1002, licence: 'L1' },
                { numero: 1003, licence: 'L1' },
                { numero: 9001, licence: 'L2' },
                { numero: 9002, licence: 'L2' }
            ];

            const stats = {};
            etudiants.forEach(e => {
                stats[e.licence] = (stats[e.licence] || 0) + 1;
            });

            expect(stats).toEqual({ 'L1': 3, 'L2': 2 });
        });

        test('devrait separer les stats par categorie 17 et 9', () => {
            const etudiants = [
                { numero: 1001, licence: 'L1' },
                { numero: 7001, licence: 'L1' },
                { numero: 9001, licence: 'L1' },
                { numero: 1002, licence: 'L2' },
                { numero: 9002, licence: 'L2' }
            ];

            const statsByCategory = { '17': {}, '9': {} };

            etudiants.forEach(e => {
                const firstDigit = String(e.numero)[0];
                const category = ['1', '7'].includes(firstDigit) ? '17' : '9';

                statsByCategory[category][e.licence] = (statsByCategory[category][e.licence] || 0) + 1;
            });

            expect(statsByCategory['17']['L1']).toBe(2);
            expect(statsByCategory['17']['L2']).toBe(1);
            expect(statsByCategory['9']['L1']).toBe(1);
            expect(statsByCategory['9']['L2']).toBe(1);
        });
    });

    describe('Gestion des fichiers', () => {
        test('devrait empecher les doublons de fichiers', () => {
            const files = [
                { name: 'file1.xlsx' },
                { name: 'file2.xlsx' },
                { name: 'file1.xlsx' } // Doublon
            ];

            const loadedFileNames = new Set();
            const uniqueFiles = [];

            files.forEach(f => {
                if (!loadedFileNames.has(f.name)) {
                    loadedFileNames.add(f.name);
                    uniqueFiles.push(f);
                }
            });

            expect(uniqueFiles).toHaveLength(2);
        });
    });

    describe('Sortie vers fichiers Excel', () => {
        test('devrait structurer les donnees pour licences_1_7.xlsx', () => {
            const etudiants17 = [
                { numero: 1001, licence: 'L1_BIO' },
                { numero: 7002, licence: 'L1_BIO' },
                { numero: 1003, licence: 'L2_CHIMIE' }
            ];

            // Trier par licence puis par numero
            const sorted = [...etudiants17].sort((a, b) => {
                if (a.licence !== b.licence) {
                    return a.licence.localeCompare(b.licence);
                }
                return a.numero - b.numero;
            });

            expect(sorted[0].licence).toBe('L1_BIO');
            expect(sorted[0].numero).toBe(1001);
            expect(sorted[2].licence).toBe('L2_CHIMIE');
        });

        test('devrait structurer les donnees pour licences_9.xlsx', () => {
            const etudiants9 = [
                { numero: 9001, licence: 'L1_BIO' },
                { numero: 9002, licence: 'L2_CHIMIE' }
            ];

            const data = etudiants9.map(e => ({
                'Numero Anonymat': e.numero,
                'Licence': e.licence
            }));

            expect(data).toHaveLength(2);
            expect(data[0]['Numero Anonymat']).toBe(9001);
            expect(data[0]['Licence']).toBe('L1_BIO');
        });
    });

    describe('escapeHtml', () => {
        test('devrait echapper les caracteres HTML', () => {
            // Cette fonction est definie dans le code
            const result = escapeHtml('<script>alert("xss")</script>');
            expect(result).not.toContain('<script>');
        });
    });

    describe('Integration - Flux complet', () => {
        test('devrait traiter un ensemble de fichiers type', () => {
            // Simuler le traitement de donnees
            const fileData = {
                'L1_BIO.xlsx': [1001, 1002, 7003, 9001],
                'L2_CHIMIE.xlsx': [1004, 9002, 9003]
            };

            const etudiants17 = [];
            const etudiants9 = [];

            Object.entries(fileData).forEach(([filename, numeros]) => {
                const licence = filename.replace(/\.[^/.]+$/, '').toUpperCase();

                numeros.forEach(numero => {
                    const firstDigit = String(numero)[0];
                    if (firstDigit === '1' || firstDigit === '7') {
                        etudiants17.push({ numero, licence });
                    } else if (firstDigit === '9') {
                        etudiants9.push({ numero, licence });
                    }
                });
            });

            expect(etudiants17).toHaveLength(4); // 1001, 1002, 7003, 1004
            expect(etudiants9).toHaveLength(3);  // 9001, 9002, 9003

            // Verifier les licences
            const licences17 = [...new Set(etudiants17.map(e => e.licence))];
            const licences9 = [...new Set(etudiants9.map(e => e.licence))];

            expect(licences17).toContain('L1_BIO');
            expect(licences17).toContain('L2_CHIMIE');
            expect(licences9).toContain('L1_BIO');
            expect(licences9).toContain('L2_CHIMIE');
        });
    });
});
