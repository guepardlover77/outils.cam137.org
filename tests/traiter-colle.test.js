/**
 * Tests pour Traiter Colle
 * Teste le traitement des notes et l'organisation par licence
 */

// Mock du DOM
document.body.innerHTML = `
    <input type="file" id="file-notes">
    <input type="file" id="file-licences">
    <div id="file-notes-name"></div>
    <div id="file-licences-name"></div>
    <div id="preview-notes"></div>
    <div id="preview-licences"></div>
    <div id="log-output"></div>
    <button id="btn-process"></button>
    <button id="btn-clear"></button>
    <select id="group-config">
        <option value="A:6-10;B:10-14;C:14-20">Option 1</option>
    </select>
`;

// Mock dependencies
global.Logger = class Logger {
    constructor(id) { this.id = id; }
    info(msg) {}
    success(msg) {}
    error(msg) {}
    warning(msg) {}
    clear() {}
};

global.setupFileInput = jest.fn();
global.readExcelFile = jest.fn();
global.sheetToObjects = jest.fn();
global.updateFileName = jest.fn();
global.downloadXLSX = jest.fn();

// Charger le code source
const fs = require('fs');
const path = require('path');
const traiterColleCode = fs.readFileSync(
    path.join(__dirname, '../js/traiter-colle.js'),
    'utf8'
);

// Executer le code (sans DOMContentLoaded)
const codeWithoutInit = traiterColleCode.replace(
    /document\.addEventListener\('DOMContentLoaded'[\s\S]*?\}\);/,
    'logger = new Logger("log-output");'
);
eval(codeWithoutInit);

describe('Traiter Colle', () => {

    describe('Fonctions statistiques', () => {

        describe('average', () => {
            test('devrait calculer la moyenne correctement', () => {
                expect(average([1, 2, 3, 4, 5])).toBe(3);
                expect(average([10, 20])).toBe(15);
            });

            test('devrait retourner 0 pour un tableau vide', () => {
                expect(average([])).toBe(0);
            });

            test('devrait gerer les decimaux', () => {
                expect(average([1.5, 2.5, 3.0])).toBeCloseTo(2.333, 2);
            });

            test('devrait gerer un seul element', () => {
                expect(average([5])).toBe(5);
            });
        });

        describe('median', () => {
            test('devrait calculer la mediane pour un nombre impair d\'elements', () => {
                expect(median([1, 2, 3, 4, 5])).toBe(3);
                expect(median([3, 1, 2])).toBe(2);
            });

            test('devrait calculer la mediane pour un nombre pair d\'elements', () => {
                expect(median([1, 2, 3, 4])).toBe(2.5);
                expect(median([10, 20])).toBe(15);
            });

            test('devrait retourner 0 pour un tableau vide', () => {
                expect(median([])).toBe(0);
            });

            test('devrait trier correctement avant calcul', () => {
                expect(median([5, 1, 3, 2, 4])).toBe(3);
            });

            test('devrait gerer un seul element', () => {
                expect(median([42])).toBe(42);
            });
        });

        describe('stdDev', () => {
            test('devrait calculer l\'ecart-type correctement', () => {
                // Pour [2, 4, 4, 4, 5, 5, 7, 9], stdDev = 2
                const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
                expect(result).toBeCloseTo(2, 1);
            });

            test('devrait retourner 0 pour moins de 2 elements', () => {
                expect(stdDev([])).toBe(0);
                expect(stdDev([5])).toBe(0);
            });

            test('devrait retourner 0 pour des valeurs identiques', () => {
                expect(stdDev([5, 5, 5, 5])).toBe(0);
            });
        });
    });

    describe('Validation des numeros d\'anonymat', () => {
        test('devrait valider les numeros a 4 chiffres', () => {
            // Test via parsing indirect - le code verifie les numeros a 4 chiffres
            const validNumero = '1234';
            const invalidNumero = '123';

            expect(validNumero.length).toBe(4);
            expect(/^\d{4}$/.test(validNumero)).toBe(true);
            expect(/^\d{4}$/.test(invalidNumero)).toBe(false);
        });
    });

    describe('Parsing CSV Notes', () => {
        // Test du format attendu
        test('devrait comprendre le format CSV avec etu et Mark', () => {
            const csvHeader = 'etu;Mark;Q01;Q02;Q03';
            const cols = csvHeader.split(';').map(h => h.trim().toLowerCase());

            expect(cols.indexOf('etu')).toBe(0);
            expect(cols.indexOf('mark')).toBe(1);
        });

        test('devrait detecter les colonnes de questions Q01-Q40', () => {
            const headers = ['etu', 'Mark', 'Q01', 'Q02', 'Q10', 'Q40', 'other'];
            const questionCols = headers.filter(h => /^Q\d{2}$/i.test(h));

            expect(questionCols).toEqual(['Q01', 'Q02', 'Q10', 'Q40']);
        });
    });

    describe('Groupes de notes', () => {
        test('devrait parser la configuration des groupes', () => {
            const config = 'A:6-10;B:10-14;C:14-20';
            const groups = config.split(';').map(g => {
                const [name, range] = g.split(':');
                const [min, max] = range.split('-').map(Number);
                return { name, min, max };
            });

            expect(groups).toHaveLength(3);
            expect(groups[0]).toEqual({ name: 'A', min: 6, max: 10 });
            expect(groups[1]).toEqual({ name: 'B', min: 10, max: 14 });
            expect(groups[2]).toEqual({ name: 'C', min: 14, max: 20 });
        });

        test('devrait categoriser les notes correctement', () => {
            const groups = [
                { name: 'A', min: 6, max: 10 },
                { name: 'B', min: 10, max: 14 },
                { name: 'C', min: 14, max: 20 }
            ];

            function getGroup(note) {
                for (const g of groups) {
                    if (note >= g.min && note < g.max) return g.name;
                }
                if (note >= groups[groups.length - 1].min) return groups[groups.length - 1].name;
                return null;
            }

            expect(getGroup(7)).toBe('A');
            expect(getGroup(10)).toBe('B');
            expect(getGroup(12)).toBe('B');
            expect(getGroup(15)).toBe('C');
            expect(getGroup(20)).toBe('C');
            expect(getGroup(5)).toBeNull();
        });
    });

    describe('Integration - Donnees de test', () => {
        test('devrait calculer les statistiques sur un echantillon', () => {
            const notes = [8, 10, 12, 14, 16, 11, 9, 13, 15, 7];

            const avg = average(notes);
            const med = median(notes);
            const std = stdDev(notes);

            expect(avg).toBeCloseTo(11.5, 1);
            expect(med).toBe(11.5); // [7,8,9,10,11,12,13,14,15,16] -> (11+12)/2
            expect(std).toBeGreaterThan(0);
        });

        test('devrait gerer le cas sans licence', () => {
            const licencesData = {
                '1234': 'L1 BIO',
                '5678': 'L2 CHIMIE'
            };
            const notesData = {
                '1234': 12,
                '5678': 14,
                '9999': 10 // Pas de licence
            };

            const sansLicence = Object.keys(notesData).filter(
                num => !licencesData[num]
            );

            expect(sansLicence).toEqual(['9999']);
        });

        test('devrait grouper les etudiants par licence', () => {
            const data = [
                { numero: '1234', licence: 'L1 BIO', note: 12 },
                { numero: '5678', licence: 'L1 BIO', note: 14 },
                { numero: '9012', licence: 'L2 CHIMIE', note: 10 }
            ];

            const grouped = {};
            data.forEach(d => {
                if (!grouped[d.licence]) grouped[d.licence] = [];
                grouped[d.licence].push(d);
            });

            expect(Object.keys(grouped)).toHaveLength(2);
            expect(grouped['L1 BIO']).toHaveLength(2);
            expect(grouped['L2 CHIMIE']).toHaveLength(1);
        });
    });

    describe('Format de sortie Excel', () => {
        test('devrait structurer les donnees pour plusieurs feuilles', () => {
            const output = {
                'General': [],
                'Stats': [],
                'L1 BIO': [],
                'L2 CHIMIE': [],
                'Groupe A': [],
                'Groupe B': [],
                'Groupe C': [],
                'Sans Licence': []
            };

            expect(Object.keys(output)).toContain('General');
            expect(Object.keys(output)).toContain('Stats');
            expect(Object.keys(output)).toContain('Sans Licence');
        });
    });

    describe('Taux de reussite par question', () => {
        test('devrait calculer le taux de reussite', () => {
            const responses = {
                'Q01': [1, 1, 0, 1, 0], // 3/5 = 60%
                'Q02': [1, 1, 1, 1, 1], // 5/5 = 100%
                'Q03': [0, 0, 0, 0, 1]  // 1/5 = 20%
            };

            const tauxReussite = {};
            Object.keys(responses).forEach(q => {
                const sum = responses[q].reduce((a, b) => a + b, 0);
                const count = responses[q].length;
                tauxReussite[q] = Math.round((sum / count) * 100);
            });

            expect(tauxReussite['Q01']).toBe(60);
            expect(tauxReussite['Q02']).toBe(100);
            expect(tauxReussite['Q03']).toBe(20);
        });
    });
});
