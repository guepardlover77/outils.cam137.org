// Traiter Colle - Process exam grades and organize by licence

let notesData = null;  // { numero: note }
let tauxReussite = {}; // { question: taux }
let licencesData = null; // { numero: licence }
let logger = null;

document.addEventListener('DOMContentLoaded', () => {
    logger = new Logger('log-output');

    setupFileInput('file-notes', handleNotesFile);
    setupFileInput('file-licences', handleLicencesFile);

    document.getElementById('btn-process').addEventListener('click', processData);
    document.getElementById('btn-clear').addEventListener('click', clearAll);

    logger.info('Pret. Chargez le fichier des notes et le fichier des licences.');
});

async function handleNotesFile(file) {
    logger.info(`Fichier notes selectionne : ${file.name}`);
    updateFileName('file-notes-name', file.name);

    try {
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'csv') {
            await readCSVNotes(file);
        } else {
            await readXLSXNotes(file);
        }

        checkReady();

    } catch (err) {
        logger.error(`Erreur lecture notes : ${err.message}`);
        notesData = null;
    }
}

async function readCSVNotes(file) {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
        logger.error('Fichier CSV vide ou invalide');
        return;
    }

    // Parse header
    const header = lines[0].split(';').map(h => h.trim());
    const etuIndex = header.findIndex(h => h.toLowerCase() === 'etu');
    const markIndex = header.findIndex(h => h.toLowerCase() === 'mark');

    if (etuIndex === -1 || markIndex === -1) {
        logger.error('Colonnes "etu" et "Mark" non trouvees dans le CSV');
        return;
    }

    notesData = {};
    tauxReussite = {};
    let errors = [];
    let skipped = 0;

    // Find question columns (Q01-Q40)
    const questionCols = [];
    for (let i = 0; i < header.length; i++) {
        if (/^Q\d{2}$/.test(header[i])) {
            questionCols.push({ index: i, name: header[i] });
        }
    }

    // Calculate success rates
    const questionSums = {};
    const questionCounts = {};

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        const etuRaw = cols[etuIndex]?.trim();
        const markRaw = cols[markIndex]?.trim().replace(',', '.');

        if (!etuRaw || !markRaw) {
            skipped++;
            continue;
        }

        try {
            let numero = String(parseInt(parseFloat(etuRaw)));
            const note = parseFloat(markRaw);

            // Validate 4-digit number
            if (numero.length !== 4 || !/^\d{4}$/.test(numero)) {
                errors.push({ numero, note, ligne: i + 1, raison: 'Numero doit avoir 4 chiffres' });
                continue;
            }

            notesData[numero] = note;

            // Count question success
            for (const q of questionCols) {
                const val = parseInt(cols[q.index]);
                if (!isNaN(val)) {
                    questionSums[q.name] = (questionSums[q.name] || 0) + val;
                    questionCounts[q.name] = (questionCounts[q.name] || 0) + 1;
                }
            }

        } catch (e) {
            skipped++;
        }
    }

    // Calculate success rates
    for (const q in questionSums) {
        if (questionCounts[q] > 0) {
            tauxReussite[q] = questionSums[q] / questionCounts[q];
        }
    }

    logger.success(`${Object.keys(notesData).length} notes extraites`);
    if (skipped > 0) logger.warning(`${skipped} lignes ignorees`);
    if (errors.length > 0) {
        logger.warning(`${errors.length} erreurs de validation`);
        for (const e of errors.slice(0, 5)) {
            logger.warning(`   Ligne ${e.ligne}: ${e.numero} - ${e.raison}`);
        }
        if (errors.length > 5) logger.warning(`   ... et ${errors.length - 5} autres`);
    }
    logger.info(`${Object.keys(tauxReussite).length} taux de reussite calcules`);
}

async function readXLSXNotes(file) {
    const workbook = await readExcelFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = sheetToArray(sheet);

    if (data.length < 6) {
        logger.error('Fichier XLSX invalide (pas assez de lignes)');
        return;
    }

    notesData = {};
    tauxReussite = {};
    let skipped = 0;
    let errors = [];

    // Extract success rates from row 5 (index 4)
    const tauxRow = data[4];
    for (let i = 6; i < 46 && i < tauxRow.length; i++) {
        const qNum = i - 5;
        const taux = tauxRow[i];
        if (taux !== undefined && taux !== '') {
            const tauxFloat = parseFloat(String(taux).replace(',', '.').replace('%', ''));
            if (!isNaN(tauxFloat)) {
                tauxReussite[`Q${String(qNum).padStart(2, '0')}`] = tauxFloat;
            }
        }
    }

    // Extract student grades from row 6 onwards (index 5+)
    for (let idx = 5; idx < data.length; idx++) {
        const row = data[idx];
        const numeroRaw = row[46]; // Column AV
        const noteRaw = row[3];    // Column D

        if (!numeroRaw || !noteRaw) {
            skipped++;
            continue;
        }

        try {
            let numero = String(parseInt(parseFloat(numeroRaw)));
            const note = parseFloat(String(noteRaw).replace(',', '.'));

            if (numero.length !== 4 || !/^\d{4}$/.test(numero)) {
                errors.push({ numero, note, ligne: idx + 1, raison: 'Numero doit avoir 4 chiffres' });
                continue;
            }

            notesData[numero] = note;

        } catch (e) {
            skipped++;
        }
    }

    logger.success(`${Object.keys(notesData).length} notes extraites`);
    if (skipped > 0) logger.warning(`${skipped} lignes ignorees`);
    if (errors.length > 0) {
        logger.warning(`${errors.length} erreurs de validation`);
    }
    logger.info(`${Object.keys(tauxReussite).length} taux de reussite extraits`);
}

async function handleLicencesFile(file) {
    logger.info(`Fichier licences selectionne : ${file.name}`);
    updateFileName('file-licences-name', file.name);

    try {
        const extension = file.name.split('.').pop().toLowerCase();
        let data;

        if (extension === 'csv') {
            const text = await file.text();
            const lines = text.split('\n').filter(l => l.trim());
            const header = lines[0].split(';').map(h => h.trim());

            data = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(';');
                const obj = {};
                for (let j = 0; j < header.length; j++) {
                    obj[header[j]] = cols[j]?.trim() || '';
                }
                data.push(obj);
            }
        } else {
            const workbook = await readExcelFile(file);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            data = sheetToObjects(sheet);
        }

        // Find columns
        let numCol = null, licCol = null;
        if (data.length > 0) {
            for (const key of Object.keys(data[0])) {
                const k = key.toLowerCase();
                if (k.includes('anonymat') || k.includes('numero')) numCol = key;
                if (k.includes('licence')) licCol = key;
            }
        }

        if (!numCol || !licCol) {
            logger.error('Colonnes "Numero Anonymat" et "Licence" non trouvees');
            licencesData = null;
            return;
        }

        licencesData = {};
        for (const row of data) {
            const num = String(parseInt(row[numCol]));
            const lic = String(row[licCol]).trim();
            if (num && lic) {
                licencesData[num] = lic;
            }
        }

        logger.success(`${Object.keys(licencesData).length} etudiants charges`);
        updateGroupsConfig();
        checkReady();

    } catch (err) {
        logger.error(`Erreur lecture licences : ${err.message}`);
        licencesData = null;
    }
}

function updateGroupsConfig() {
    if (!licencesData) return;

    const licences = [...new Set(Object.values(licencesData))].sort();

    document.getElementById('groups-placeholder').style.display = 'none';
    document.getElementById('groups-config').style.display = 'block';

    for (const groupId of ['group-a', 'group-b', 'group-c']) {
        const select = document.getElementById(groupId);
        select.innerHTML = licences.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
    }
}

function checkReady() {
    const ready = notesData && Object.keys(notesData).length > 0 &&
                  licencesData && Object.keys(licencesData).length > 0;
    document.getElementById('btn-process').disabled = !ready;

    if (ready) {
        logger.success('Fichiers charges. Pret pour le traitement.');
    }
}

function processData() {
    if (!notesData || !licencesData) {
        logger.error('Donnees manquantes');
        return;
    }

    logger.clear();
    logger.info('Traitement en cours...');

    // Organize by licence
    const etudiantsParLicence = {};
    const etudiantsIgnores = [];

    for (const [numero, note] of Object.entries(notesData)) {
        if (licencesData[numero]) {
            const licence = licencesData[numero];
            if (!etudiantsParLicence[licence]) {
                etudiantsParLicence[licence] = [];
            }
            etudiantsParLicence[licence].push({ numero, note });
        } else {
            etudiantsIgnores.push({ numero, note });
        }
    }

    // Sort by note descending
    for (const licence in etudiantsParLicence) {
        etudiantsParLicence[licence].sort((a, b) => b.note - a.note);
    }

    const totalTraites = Object.values(etudiantsParLicence).reduce((s, a) => s + a.length, 0);
    logger.success(`${totalTraites} etudiants traites`);

    if (etudiantsIgnores.length > 0) {
        logger.warning(`${etudiantsIgnores.length} etudiants non trouves dans le fichier licences`);
    }

    // Get group configuration
    const groupes = {
        'Groupe A': getSelectedValues('group-a'),
        'Groupe B': getSelectedValues('group-b'),
        'Groupe C': getSelectedValues('group-c')
    };

    // Generate Excel file
    const outputFilename = document.getElementById('output-filename').value.trim() || 'resultats.xlsx';
    generateExcel(etudiantsParLicence, tauxReussite, groupes, outputFilename);

    // Update preview
    updatePreview(etudiantsParLicence);

    logger.log('─'.repeat(50));
    logger.success('Traitement termine !');
}

function getSelectedValues(selectId) {
    const select = document.getElementById(selectId);
    return Array.from(select.selectedOptions).map(o => o.value);
}

function generateExcel(etudiantsParLicence, tauxReussite, groupes, filename) {
    const wb = XLSX.utils.book_new();

    // Sheet "General"
    const allStudents = [];
    for (const [licence, etudiants] of Object.entries(etudiantsParLicence)) {
        for (const e of etudiants) {
            allStudents.push({
                'Numéro CREM': e.numero,
                'Note': e.note,
                'Licence': licence
            });
        }
    }
    allStudents.sort((a, b) => b.Note - a.Note);

    const wsGeneral = XLSX.utils.json_to_sheet(allStudents);
    XLSX.utils.book_append_sheet(wb, wsGeneral, 'Général');
    logger.success(`Feuille 'General' : ${allStudents.length} etudiants`);

    // Sheet "Stats"
    const statsData = [];
    const allNotes = allStudents.map(s => s.Note);

    if (allNotes.length > 0) {
        statsData.push({
            'Licence': 'GÉNÉRAL',
            'Nombre': allNotes.length,
            'Moyenne': round(average(allNotes), 2),
            'Médiane': round(median(allNotes), 2),
            'Écart-type': round(stdDev(allNotes), 2),
            'Min': round(Math.min(...allNotes), 2),
            'Max': round(Math.max(...allNotes), 2)
        });

        statsData.push({ 'Licence': '', 'Nombre': '', 'Moyenne': '', 'Médiane': '', 'Écart-type': '', 'Min': '', 'Max': '' });

        for (const licence of Object.keys(etudiantsParLicence).sort()) {
            const notes = etudiantsParLicence[licence].map(e => e.note);
            statsData.push({
                'Licence': licence,
                'Nombre': notes.length,
                'Moyenne': round(average(notes), 2),
                'Médiane': round(median(notes), 2),
                'Écart-type': round(stdDev(notes), 2),
                'Min': round(Math.min(...notes), 2),
                'Max': round(Math.max(...notes), 2)
            });
        }

        // Add success rates
        if (Object.keys(tauxReussite).length > 0) {
            statsData.push({ 'Licence': '', 'Nombre': '', 'Moyenne': '', 'Médiane': '', 'Écart-type': '', 'Min': '', 'Max': '' });
            statsData.push({ 'Licence': 'TAUX DE RÉUSSITE', 'Nombre': '', 'Moyenne': '', 'Médiane': '', 'Écart-type': '', 'Min': '', 'Max': '' });

            for (const q of Object.keys(tauxReussite).sort()) {
                statsData.push({
                    'Licence': q,
                    'Nombre': `${round(tauxReussite[q] * 100, 1)}%`,
                    'Moyenne': '', 'Médiane': '', 'Écart-type': '', 'Min': '', 'Max': ''
                });
            }
        }
    }

    const wsStats = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, wsStats, 'Stats');
    logger.success(`Feuille 'Stats' creee`);

    // Sheets per licence
    for (const licence of Object.keys(etudiantsParLicence).sort()) {
        const data = etudiantsParLicence[licence].map(e => ({
            'Numéro CREM': e.numero,
            'Note': e.note
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, licence.substring(0, 31)); // Excel limit
        logger.success(`Feuille '${licence}' : ${data.length} etudiants`);
    }

    // Group sheets
    for (const [groupName, licences] of Object.entries(groupes)) {
        if (licences.length === 0) continue;

        const groupData = [];
        for (const licence of licences) {
            if (etudiantsParLicence[licence]) {
                for (const e of etudiantsParLicence[licence]) {
                    groupData.push({
                        'Numéro CREM': e.numero,
                        'Note': e.note,
                        'Licence': licence
                    });
                }
            }
        }

        if (groupData.length > 0) {
            groupData.sort((a, b) => b.Note - a.Note);
            const ws = XLSX.utils.json_to_sheet(groupData);
            XLSX.utils.book_append_sheet(wb, ws, groupName);
            logger.success(`Feuille '${groupName}' : ${groupData.length} etudiants`);
        }
    }

    // Download
    downloadXLSX(wb, filename);
    logger.success(`Fichier '${filename}' telecharge`);
}

function updatePreview(etudiantsParLicence) {
    const container = document.getElementById('preview-container');
    const licences = Object.keys(etudiantsParLicence).sort();

    let html = '<table class="results-table"><thead><tr>';
    html += '<th>Licence</th><th>Etudiants</th><th>Moyenne</th><th>Min</th><th>Max</th>';
    html += '</tr></thead><tbody>';

    for (const licence of licences) {
        const notes = etudiantsParLicence[licence].map(e => e.note);
        html += `<tr>
            <td>${escapeHtml(licence)}</td>
            <td>${notes.length}</td>
            <td>${round(average(notes), 2)}</td>
            <td>${round(Math.min(...notes), 2)}</td>
            <td>${round(Math.max(...notes), 2)}</td>
        </tr>`;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

function clearAll() {
    notesData = null;
    licencesData = null;
    tauxReussite = {};

    document.getElementById('file-notes').value = '';
    document.getElementById('file-licences').value = '';
    updateFileName('file-notes-name', '');
    updateFileName('file-licences-name', '');

    document.getElementById('groups-config').style.display = 'none';
    document.getElementById('groups-placeholder').style.display = 'block';
    document.getElementById('btn-process').disabled = true;
    document.getElementById('preview-container').innerHTML = '<p style="opacity: 0.5; font-size: 0.875rem;">Aucune donnee traitee</p>';

    logger.clear();
    logger.info('Donnees effacees.');
}

// Utility functions
function average(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function median(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(arr) {
    if (arr.length < 2) return 0;
    const avg = average(arr);
    const squareDiffs = arr.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(average(squareDiffs));
}

function round(num, decimals) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
