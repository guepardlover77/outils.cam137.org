/**
 * Tests pour Excel to XML Moodle Converter
 * Teste la conversion Excel vers XML Moodle
 */

// Mock du DOM
document.body.innerHTML = `
    <input type="file" id="input-file">
    <div id="file-name"></div>
    <div id="preview-container"></div>
    <div id="log-output"></div>
    <input type="text" id="category-name" value="Test Category">
    <input type="text" id="output-filename" value="test.xml">
    <input type="text" id="moodle-url" value="">
    <input type="text" id="moodle-token" value="">
    <button id="btn-convert"></button>
    <button id="btn-clear"></button>
    <button id="btn-test-connection"></button>
    <button id="btn-save-settings"></button>
    <button id="btn-import-moodle"></button>
    <input type="text" id="banks-search">
    <div id="banks-overview-section" style="display:none;"></div>
    <div id="banks-list-container"></div>
    <span id="stat-courses">0</span>
    <span id="stat-banks">0</span>
    <span id="stat-questions">0</span>
`;

// Mock Logger et autres dependances
global.Logger = class Logger {
    constructor(id) { this.id = id; }
    info(msg) { console.log('[INFO]', msg); }
    success(msg) { console.log('[OK]', msg); }
    error(msg) { console.log('[ERR]', msg); }
    warning(msg) { console.log('[WARN]', msg); }
    clear() {}
};

global.MoodleSettings = {
    load: () => ({ url: '', token: '' }),
    save: () => {},
    saveToken: () => {}
};

global.MoodleAPI = class MoodleAPI {
    constructor(url, token) {
        this.url = url;
        this.token = token;
    }
};

global.setupFileInput = jest.fn();
global.sheetToObjects = jest.fn();
global.downloadBlob = jest.fn();
global.updateFileName = jest.fn();

// Charger le code source
const fs = require('fs');
const path = require('path');
const excelToXmlCode = fs.readFileSync(
    path.join(__dirname, '../js/excel-to-xml-moodle.js'),
    'utf8'
);

// Variables globales
let logger = new Logger('log-output');
let loadedQuestions = null;
let moodleApi = null;
let moodleConnected = false;
let allBanksData = [];
let selectedBankId = null;
let selectedCourseId = null;

// Extraire les fonctions necessaires
const functionPatterns = [
    /function generateMoodleXML\([\s\S]*?\n\}/,
    /function generateQuestionXML\([\s\S]*?\n\}/,
    /function parseCorrectAnswers\([\s\S]*?\n\}/,
    /function escapeXml\([\s\S]*?\n\}/,
    /function escapeHtml\([\s\S]*?\n\}/
];

let extractedCode = '';
functionPatterns.forEach(pattern => {
    const match = excelToXmlCode.match(pattern);
    if (match) {
        extractedCode += match[0] + '\n\n';
    }
});

eval(extractedCode);

describe('Excel to XML Moodle Converter', () => {

    describe('escapeXml', () => {
        test('devrait echapper les caracteres speciaux XML', () => {
            expect(escapeXml('Test & <tag> "quote" \'apos\'')).toBe(
                'Test &amp; &lt;tag&gt; &quot;quote&quot; &apos;apos&apos;'
            );
        });

        test('devrait gerer les valeurs nulles', () => {
            expect(escapeXml(null)).toBe('');
            expect(escapeXml('')).toBe('');
            expect(escapeXml(undefined)).toBe('');
        });

        test('devrait convertir les nombres en string', () => {
            expect(escapeXml(123)).toBe('123');
        });
    });

    describe('parseCorrectAnswers', () => {
        const options = ['Option A', 'Option B', 'Option C', 'Option D'];

        test('devrait trouver une reponse exacte', () => {
            const result = parseCorrectAnswers('Option A', options);
            expect(result).toEqual(['Option A']);
        });

        test('devrait trouver plusieurs reponses separees par virgule', () => {
            const result = parseCorrectAnswers('Option A, Option C', options);
            expect(result).toEqual(['Option A', 'Option C']);
        });

        test('devrait gerer la correspondance insensible a la casse', () => {
            const result = parseCorrectAnswers('option a', options);
            expect(result).toEqual(['Option A']);
        });

        test('devrait trouver une correspondance partielle', () => {
            const options2 = ['La reponse A est correcte', 'La reponse B', 'Autre'];
            const result = parseCorrectAnswers('reponse A', options2);
            expect(result).toEqual(['La reponse A est correcte']);
        });

        test('devrait retourner un tableau vide si pas de correspondance', () => {
            const result = parseCorrectAnswers('Option Z', options);
            expect(result).toEqual([]);
        });

        test('devrait gerer les valeurs vides', () => {
            expect(parseCorrectAnswers('', options)).toEqual([]);
            expect(parseCorrectAnswers(null, options)).toEqual([]);
        });
    });

    describe('generateQuestionXML', () => {
        test('devrait generer un XML valide pour une question CHECKBOX', () => {
            const question = {
                SNO: 1,
                Questions: 'Quelle est la bonne reponse?',
                Type: 'CHECKBOX',
                'option 1': 'Reponse A',
                'option 2': 'Reponse B',
                'option 3': 'Reponse C',
                'Correct Answer': 'Reponse A, Reponse C',
                Points: 2,
                Commentaires: 'Feedback de la question'
            };

            const xml = generateQuestionXML(question, 1);

            expect(xml).toContain('<question type="multichoice">');
            expect(xml).toContain('Question 1');
            expect(xml).toContain('Quelle est la bonne reponse?');
            expect(xml).toContain('<single>false</single>'); // CHECKBOX = multiple choice
            expect(xml).toContain('<defaultgrade>2</defaultgrade>');
            expect(xml).toContain('Feedback de la question');
        });

        test('devrait generer un XML pour une question RADIO (single choice)', () => {
            const question = {
                SNO: 1,
                Questions: 'Question radio',
                Type: 'RADIO',
                'option 1': 'Option 1',
                'option 2': 'Option 2',
                'Correct Answer': 'Option 1',
                Points: 1
            };

            const xml = generateQuestionXML(question, 1);

            expect(xml).toContain('<single>true</single>'); // RADIO = single choice
        });

        test('devrait marquer les bonnes reponses avec fraction="100"', () => {
            const question = {
                Questions: 'Test',
                Type: 'CHECKBOX',
                'option 1': 'Bonne',
                'option 2': 'Mauvaise',
                'Correct Answer': 'Bonne',
                Points: 1
            };

            const xml = generateQuestionXML(question, 1);

            // La bonne reponse doit avoir fraction="100"
            expect(xml).toMatch(/<answer fraction="100"[\s\S]*?Bonne/);
            // La mauvaise reponse doit avoir fraction="0"
            expect(xml).toMatch(/<answer fraction="0"[\s\S]*?Mauvaise/);
        });

        test('devrait lever une erreur si aucune option', () => {
            const question = {
                Questions: 'Test sans options',
                Type: 'CHECKBOX',
                'Correct Answer': 'A',
                Points: 1
            };

            expect(() => generateQuestionXML(question, 1)).toThrow('Aucune option trouvee');
        });

        test('devrait lever une erreur si aucune reponse correcte identifiee', () => {
            const question = {
                Questions: 'Test',
                Type: 'CHECKBOX',
                'option 1': 'A',
                'option 2': 'B',
                'Correct Answer': 'Z', // N'existe pas
                Points: 1
            };

            expect(() => generateQuestionXML(question, 1)).toThrow('Aucune reponse correcte identifiee');
        });
    });

    describe('generateMoodleXML', () => {
        beforeEach(() => {
            // Reset logger mock
            global.logger = new Logger('log-output');
        });

        test('devrait generer un XML complet avec categorie', () => {
            const questions = [{
                SNO: 1,
                Questions: 'Question 1',
                Type: 'CHECKBOX',
                'option 1': 'A',
                'option 2': 'B',
                'Correct Answer': 'A',
                Points: 1
            }];

            const xml = generateMoodleXML(questions, 'Ma Categorie');

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('<quiz>');
            expect(xml).toContain('</quiz>');
            expect(xml).toContain('<question type="category">');
            expect(xml).toContain('$course$/top/Ma Categorie');
        });

        test('devrait traiter plusieurs questions', () => {
            const questions = [
                {
                    SNO: 1,
                    Questions: 'Question 1',
                    Type: 'CHECKBOX',
                    'option 1': 'A',
                    'option 2': 'B',
                    'Correct Answer': 'A',
                    Points: 1
                },
                {
                    SNO: 2,
                    Questions: 'Question 2',
                    Type: 'RADIO',
                    'option 1': 'X',
                    'option 2': 'Y',
                    'Correct Answer': 'Y',
                    Points: 2
                }
            ];

            const xml = generateMoodleXML(questions, 'Test');

            expect(xml).toContain('Question 1');
            expect(xml).toContain('Question 2');
            expect((xml.match(/<question type="multichoice">/g) || []).length).toBe(2);
        });

        test('devrait ignorer les questions invalides avec warning', () => {
            const questions = [
                {
                    SNO: 1,
                    Questions: 'Question valide',
                    Type: 'CHECKBOX',
                    'option 1': 'A',
                    'Correct Answer': 'A',
                    Points: 1
                },
                {
                    SNO: 2,
                    Questions: 'Question sans reponse correcte',
                    Type: 'CHECKBOX',
                    'option 1': 'A',
                    'Correct Answer': 'Z', // Invalid
                    Points: 1
                }
            ];

            const xml = generateMoodleXML(questions, 'Test');

            // Seule la question valide doit etre incluse
            expect(xml).toContain('Question valide');
            expect((xml.match(/<question type="multichoice">/g) || []).length).toBe(1);
        });
    });

    describe('Integration - Format Excel complet', () => {
        test('devrait traiter un fichier Excel type', () => {
            const excelData = [
                {
                    SNO: 1,
                    Questions: 'La mitochondrie est:',
                    Type: 'CHECKBOX',
                    Required: 'Yes',
                    'option 1': 'La centrale energetique de la cellule',
                    'option 2': 'Le noyau de la cellule',
                    'option 3': 'Responsable de la synthese proteique',
                    'option 4': 'Presente dans toutes les cellules eucaryotes',
                    'option 5': '',
                    'Correct Answer': 'La centrale energetique de la cellule, Presente dans toutes les cellules eucaryotes',
                    Commentaires: 'La mitochondrie produit l\'ATP',
                    Points: 2
                },
                {
                    SNO: 2,
                    Questions: 'Quel est le plus grand organe du corps humain?',
                    Type: 'RADIO',
                    Required: 'Yes',
                    'option 1': 'Le foie',
                    'option 2': 'La peau',
                    'option 3': 'Le cerveau',
                    'option 4': 'Les poumons',
                    'option 5': '',
                    'Correct Answer': 'La peau',
                    Commentaires: '',
                    Points: 1
                }
            ];

            const xml = generateMoodleXML(excelData, 'Biologie');

            // Verifications structurelles
            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('$course$/top/Biologie');

            // Question 1 - Multiple choice
            expect(xml).toContain('La mitochondrie est:');
            expect(xml).toContain('<defaultgrade>2</defaultgrade>');

            // Question 2 - Single choice
            expect(xml).toContain('Quel est le plus grand organe');
            expect(xml).toContain('<single>true</single>');
        });
    });

    describe('Validation XML structure', () => {
        test('devrait generer un XML bien forme', () => {
            const questions = [{
                SNO: 1,
                Questions: 'Test',
                Type: 'CHECKBOX',
                'option 1': 'A',
                'option 2': 'B',
                'Correct Answer': 'A',
                Points: 1
            }];

            const xml = generateMoodleXML(questions, 'Test');

            // Verifier structure basique
            expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
            expect(xml.trim().endsWith('</quiz>')).toBe(true);

            // Verifier que les balises sont bien fermees
            expect(xml).toContain('<quiz>');
            expect(xml).toContain('</quiz>');
            expect(xml).toContain('<questiontext format="html">');
            expect(xml).toContain('</questiontext>');
        });

        test('devrait echapper correctement les caracteres speciaux', () => {
            const questions = [{
                SNO: 1,
                Questions: 'Test avec <balises> & "guillemets"',
                Type: 'CHECKBOX',
                'option 1': 'Option avec "quotes"',
                'option 2': 'Option < normale >',
                'Correct Answer': 'Option avec "quotes"',
                Points: 1
            }];

            const xml = generateMoodleXML(questions, 'Test & Category');

            expect(xml).toContain('&lt;balises&gt;');
            expect(xml).toContain('&amp;');
            expect(xml).toContain('&quot;guillemets&quot;');
        });
    });
});
