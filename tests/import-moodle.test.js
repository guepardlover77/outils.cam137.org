/**
 * Tests pour Import Moodle
 * Teste la conversion de donnees vers CSV Moodle
 */

// Mock du DOM
document.body.innerHTML = `
    <div class="tab-btn active" data-tab="manual"></div>
    <div class="tab-btn" data-tab="file"></div>
    <div id="tab-manual" class="tab-content active"></div>
    <div id="tab-file" class="tab-content"></div>
    <textarea id="manual-input"></textarea>
    <input type="file" id="input-file">
    <div id="file-name"></div>
    <input type="text" id="cohort-id" value="">
    <input type="text" id="output-filename" value="moodle_import.csv">
    <div id="preview-container"></div>
    <div id="log-output"></div>
    <button id="btn-convert"></button>
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
};

global.setupFileInput = jest.fn();
global.readExcelFile = jest.fn();
global.sheetToArray = jest.fn();
global.downloadCSV = jest.fn();
global.updateFileName = jest.fn();

// Variable pour capturer le CSV genere
let generatedCSV = null;
global.downloadCSV = jest.fn((content, filename) => {
    generatedCSV = content;
});

// Charger le code source
const fs = require('fs');
const path = require('path');
const importMoodleCode = fs.readFileSync(
    path.join(__dirname, '../js/import-moodle.js'),
    'utf8'
);

// Variables globales utilisees par le code
let loadedData = null;
let logger = new Logger('log-output');
let currentMode = 'manual';

// Extraire les fonctions necessaires
const functionPatterns = [
    /function handleManualInput\(\) \{[\s\S]*?\n\}/,
    /function convertToCSV\(\) \{[\s\S]*?\n\}/,
    /function escapeHtml\([\s\S]*?\n\}/,
    /function updatePreview\(\) \{[\s\S]*?\n\}/
];

let extractedCode = '';
functionPatterns.forEach(pattern => {
    const match = importMoodleCode.match(pattern);
    if (match) {
        extractedCode += match[0] + '\n\n';
    }
});

eval(extractedCode);

describe('Import Moodle', () => {

    beforeEach(() => {
        loadedData = null;
        generatedCSV = null;
        document.getElementById('manual-input').value = '';
        document.getElementById('cohort-id').value = '';
        currentMode = 'manual';
    });

    describe('handleManualInput', () => {
        test('devrait parser des donnees separees par tabulation', () => {
            document.getElementById('manual-input').value = '12345\ttest@email.com';
            handleManualInput();

            expect(loadedData).toHaveLength(1);
            expect(loadedData[0]).toEqual({
                anonymat: '12345',
                email: 'test@email.com'
            });
        });

        test('devrait parser des donnees separees par point-virgule', () => {
            document.getElementById('manual-input').value = '12345;test@email.com';
            handleManualInput();

            expect(loadedData).toHaveLength(1);
            expect(loadedData[0].anonymat).toBe('12345');
            expect(loadedData[0].email).toBe('test@email.com');
        });

        test('devrait parser des donnees separees par virgule', () => {
            document.getElementById('manual-input').value = '12345,test@email.com';
            handleManualInput();

            expect(loadedData).toHaveLength(1);
            expect(loadedData[0].email).toBe('test@email.com');
        });

        test('devrait parser des donnees separees par espaces', () => {
            document.getElementById('manual-input').value = '12345    test@email.com';
            handleManualInput();

            expect(loadedData).toHaveLength(1);
            expect(loadedData[0].anonymat).toBe('12345');
        });

        test('devrait parser plusieurs lignes', () => {
            document.getElementById('manual-input').value = `12345\ttest1@email.com
67890\ttest2@email.com
11111\ttest3@email.com`;
            handleManualInput();

            expect(loadedData).toHaveLength(3);
            expect(loadedData[0].anonymat).toBe('12345');
            expect(loadedData[1].anonymat).toBe('67890');
            expect(loadedData[2].anonymat).toBe('11111');
        });

        test('devrait ignorer les lignes sans email valide', () => {
            document.getElementById('manual-input').value = `12345\ttest@email.com
67890\tinvalid-email
11111\ttest2@email.com`;
            handleManualInput();

            expect(loadedData).toHaveLength(2);
            expect(loadedData[0].anonymat).toBe('12345');
            expect(loadedData[1].anonymat).toBe('11111');
        });

        test('devrait gerer les lignes vides', () => {
            document.getElementById('manual-input').value = `12345\ttest@email.com

67890\ttest2@email.com`;
            handleManualInput();

            expect(loadedData).toHaveLength(2);
        });

        test('devrait retourner null si input vide', () => {
            document.getElementById('manual-input').value = '';
            handleManualInput();

            expect(loadedData).toBeNull();
        });
    });

    describe('convertToCSV', () => {
        beforeEach(() => {
            loadedData = [
                { anonymat: '12345', email: 'test1@email.com' },
                { anonymat: '67890', email: 'test2@email.com' }
            ];
        });

        test('devrait generer un CSV avec les bonnes colonnes', () => {
            convertToCSV();

            expect(generatedCSV).toContain('username,email,auth,firstname,lastname');
        });

        test('devrait inclure les donnees utilisateurs', () => {
            convertToCSV();

            expect(generatedCSV).toContain('12345,test1@email.com,email,Etudiant,12345');
            expect(generatedCSV).toContain('67890,test2@email.com,email,Etudiant,67890');
        });

        test('devrait ajouter la cohorte si specifiee', () => {
            document.getElementById('cohort-id').value = 'PACES2024';
            convertToCSV();

            expect(generatedCSV).toContain('username,email,auth,firstname,lastname,cohort1');
            expect(generatedCSV).toContain('12345,test1@email.com,email,Etudiant,12345,PACES2024');
        });

        test('devrait echapper les valeurs avec virgules', () => {
            loadedData = [
                { anonymat: 'test,user', email: 'test@email.com' }
            ];
            convertToCSV();

            expect(generatedCSV).toContain('"test,user"');
        });

        test('devrait echapper les valeurs avec guillemets', () => {
            loadedData = [
                { anonymat: 'test"user', email: 'test@email.com' }
            ];
            convertToCSV();

            expect(generatedCSV).toContain('"test""user"');
        });

        test('devrait appeler downloadCSV avec le bon nom de fichier', () => {
            document.getElementById('output-filename').value = 'custom_filename.csv';
            convertToCSV();

            expect(downloadCSV).toHaveBeenCalledWith(
                expect.any(String),
                'custom_filename.csv'
            );
        });

        test('devrait utiliser le nom par defaut si non specifie', () => {
            document.getElementById('output-filename').value = '';
            convertToCSV();

            expect(downloadCSV).toHaveBeenCalledWith(
                expect.any(String),
                'moodle_import.csv'
            );
        });
    });

    describe('escapeHtml', () => {
        test('devrait echapper les caracteres HTML', () => {
            const result = escapeHtml('<script>alert("xss")</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });
    });

    describe('Integration - Flux complet', () => {
        test('devrait traiter un copier-coller typique', () => {
            // Simuler un copier-coller depuis Excel
            const excelPaste = `123456\tprenom.nom@etudiant.univ-paris13.fr
789012\tautre.etudiant@etudiant.univ-paris13.fr
345678\ttroisieme@etudiant.univ-paris13.fr`;

            document.getElementById('manual-input').value = excelPaste;
            document.getElementById('cohort-id').value = 'L1_Bio_2024';

            handleManualInput();
            expect(loadedData).toHaveLength(3);

            convertToCSV();

            // Verifier le CSV genere
            expect(generatedCSV).toContain('username,email,auth,firstname,lastname,cohort1');
            expect(generatedCSV).toContain('123456,prenom.nom@etudiant.univ-paris13.fr,email,Etudiant,123456,L1_Bio_2024');
            expect(generatedCSV.split('\n').length).toBeGreaterThanOrEqual(4); // Header + 3 lignes
        });

        test('devrait gerer des donnees avec differents separateurs', () => {
            const mixedData = `111;user1@test.com
222,user2@test.com
333\tuser3@test.com`;

            document.getElementById('manual-input').value = mixedData;
            handleManualInput();

            expect(loadedData).toHaveLength(3);
        });
    });

    describe('Validation des entrees', () => {
        test('devrait rejeter les emails sans @', () => {
            document.getElementById('manual-input').value = '12345\tinvalid';
            handleManualInput();

            expect(loadedData).toHaveLength(0);
        });

        test('devrait accepter differents formats d\'email', () => {
            document.getElementById('manual-input').value = `1\tuser@domain.com
2\tuser.name@subdomain.domain.org
3\tuser+tag@domain.co.uk`;
            handleManualInput();

            expect(loadedData).toHaveLength(3);
        });

        test('devrait trimmer les espaces', () => {
            document.getElementById('manual-input').value = '  12345  \t  test@email.com  ';
            handleManualInput();

            expect(loadedData[0].anonymat).toBe('12345');
            expect(loadedData[0].email).toBe('test@email.com');
        });
    });
});
