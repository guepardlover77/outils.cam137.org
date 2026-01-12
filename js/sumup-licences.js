// Sumup Licences - Extract anonymat numbers from Excel files and organize by licence

let loadedFiles = [];
let logger = null;

document.addEventListener('DOMContentLoaded', () => {
    logger = new Logger('log-output');

    setupFileInput('input-files', handleFilesSelect, { multiple: true });

    document.getElementById('btn-process').addEventListener('click', processFiles);
    document.getElementById('btn-clear').addEventListener('click', clearAll);

    logger.info('Pret. Selectionnez des fichiers Excel (.xlsx).');
});

async function handleFilesSelect(files) {
    logger.clear();

    for (const file of files) {
        // Check if file already loaded
        if (loadedFiles.some(f => f.name === file.name)) {
            logger.warning(`Fichier deja charge : ${file.name}`);
            continue;
        }

        loadedFiles.push(file);
        logger.info(`Fichier ajoute : ${file.name}`);
    }

    updateFileList();
    document.getElementById('btn-process').disabled = loadedFiles.length === 0;
}

function updateFileList() {
    const container = document.getElementById('file-list');

    if (loadedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    for (let i = 0; i < loadedFiles.length; i++) {
        const file = loadedFiles[i];
        const licence = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
        html += `
            <div class="file-item">
                <span class="file-item-name">📄 ${escapeHtml(file.name)} → Licence: ${escapeHtml(licence)}</span>
                <button class="file-item-remove" onclick="removeFile(${i})">✕</button>
            </div>
        `;
    }

    container.innerHTML = html;
}

function removeFile(index) {
    const removed = loadedFiles.splice(index, 1);
    logger.info(`Fichier retire : ${removed[0].name}`);
    updateFileList();
    document.getElementById('btn-process').disabled = loadedFiles.length === 0;
}

async function processFiles() {
    if (loadedFiles.length === 0) {
        logger.error('Aucun fichier a traiter');
        return;
    }

    logger.clear();
    logger.info('Traitement en cours...');
    logger.info(`${loadedFiles.length} fichier(s) a traiter`);
    logger.log('─'.repeat(50));

    const etudiants17 = [];
    const etudiants9 = [];
    const stats = {};
    const statsByCategory = { '17': {}, '9': {} };
    const doublons = [];

    // Process each file
    for (const file of loadedFiles) {
        const licence = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
        logger.info(`Traitement de : ${file.name}`);
        logger.info(`   Licence : ${licence}`);

        try {
            const workbook = await readExcelFile(file);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = sheetToObjects(sheet);

            // Find the "Client" column
            let clientColumn = null;
            if (data.length > 0) {
                const firstRow = data[0];
                for (const key of Object.keys(firstRow)) {
                    if (key.toLowerCase().includes('client') && !key.toLowerCase().includes('nom')) {
                        clientColumn = key;
                        break;
                    }
                }
            }

            if (!clientColumn) {
                logger.warning(`   Colonne 'Client' non trouvee dans ${file.name}`);
                continue;
            }

            // Extract unique anonymat numbers
            const numeros = new Set();
            for (const row of data) {
                const value = row[clientColumn];
                if (value !== undefined && value !== null && value !== '') {
                    const num = parseInt(value);
                    if (!isNaN(num)) {
                        numeros.add(num);
                    }
                }
            }

            logger.success(`   ${numeros.size} numero(s) d'anonymat trouve(s)`);

            let count17 = 0;
            let count9 = 0;

            // Categorize by first digit
            for (const numero of numeros) {
                const firstDigit = String(numero)[0];

                if (firstDigit === '1' || firstDigit === '7') {
                    etudiants17.push({ numero, licence });
                    count17++;
                } else if (firstDigit === '9') {
                    etudiants9.push({ numero, licence });
                    count9++;
                }
            }

            stats[licence] = numeros.size;
            statsByCategory['17'][licence] = count17;
            statsByCategory['9'][licence] = count9;

            logger.info(`      → ${count17} numero(s) commencant par 1 ou 7`);
            logger.info(`      → ${count9} numero(s) commencant par 9`);

        } catch (err) {
            logger.error(`   Erreur : ${err.message}`);
        }
    }

    logger.log('─'.repeat(50));
    logger.info('Verification des doublons...');

    // Check for duplicates
    const checkDoublons = (etudiants, category) => {
        const seen = new Map();
        const duplicates = [];

        for (const e of etudiants) {
            if (seen.has(e.numero)) {
                duplicates.push({
                    numero: e.numero,
                    licences: [seen.get(e.numero), e.licence]
                });
            } else {
                seen.set(e.numero, e.licence);
            }
        }

        if (duplicates.length > 0) {
            logger.warning(`Doublons dans la categorie ${category} :`);
            for (const d of duplicates) {
                logger.warning(`   Numero ${d.numero} : ${d.licences.join(', ')}`);
            }
        }

        return duplicates;
    };

    const doublons17 = checkDoublons(etudiants17, 'numeros 1 et 7');
    const doublons9 = checkDoublons(etudiants9, 'numeros 9');

    if (doublons17.length === 0 && doublons9.length === 0) {
        logger.success('Aucun doublon detecte');
    }

    logger.log('─'.repeat(50));

    // Sort data
    etudiants17.sort((a, b) => a.licence.localeCompare(b.licence) || a.numero - b.numero);
    etudiants9.sort((a, b) => a.licence.localeCompare(b.licence) || a.numero - b.numero);

    // Generate output files
    const output17 = document.getElementById('output-17').value.trim() || 'licences_1_7.xlsx';
    const output9 = document.getElementById('output-9').value.trim() || 'licences_9.xlsx';

    if (etudiants17.length > 0) {
        const wb17 = XLSX.utils.book_new();
        const ws17 = XLSX.utils.json_to_sheet(etudiants17.map(e => ({
            'Numéro Anonymat': e.numero,
            'Licence': e.licence
        })));
        XLSX.utils.book_append_sheet(wb17, ws17, 'Licences');
        downloadXLSX(wb17, output17);
        logger.success(`Fichier '${output17}' cree avec ${etudiants17.length} etudiants`);
    } else {
        logger.warning('Aucun etudiant avec numero commencant par 1 ou 7');
    }

    if (etudiants9.length > 0) {
        const wb9 = XLSX.utils.book_new();
        const ws9 = XLSX.utils.json_to_sheet(etudiants9.map(e => ({
            'Numéro Anonymat': e.numero,
            'Licence': e.licence
        })));
        XLSX.utils.book_append_sheet(wb9, ws9, 'Licences');
        downloadXLSX(wb9, output9);
        logger.success(`Fichier '${output9}' cree avec ${etudiants9.length} etudiants`);
    } else {
        logger.warning('Aucun etudiant avec numero commencant par 9');
    }

    // Update stats display
    updateStats(stats, statsByCategory, etudiants17.length, etudiants9.length);

    logger.log('─'.repeat(50));
    logger.success('Traitement termine !');
}

function updateStats(stats, statsByCategory, total17, total9) {
    const container = document.getElementById('stats-container');
    const total = total17 + total9;

    let html = `<p style="margin-bottom: var(--spacing-md);"><strong>Total d'etudiants : ${total}</strong></p>`;

    html += '<table class="results-table"><thead><tr>';
    html += '<th>Licence</th><th>Total</th><th>1/7</th><th>9</th>';
    html += '</tr></thead><tbody>';

    for (const licence of Object.keys(stats).sort()) {
        const t = stats[licence];
        const c17 = statsByCategory['17'][licence] || 0;
        const c9 = statsByCategory['9'][licence] || 0;
        html += `<tr><td>${escapeHtml(licence)}</td><td>${t}</td><td>${c17}</td><td>${c9}</td></tr>`;
    }

    html += '</tbody></table>';

    html += `<p style="margin-top: var(--spacing-md); font-size: 0.875rem;">`;
    html += `Fichier 1/7 : ${total17} etudiants | Fichier 9 : ${total9} etudiants</p>`;

    container.innerHTML = html;
}

function clearAll() {
    loadedFiles = [];
    document.getElementById('input-files').value = '';
    document.getElementById('file-list').innerHTML = '';
    document.getElementById('btn-process').disabled = true;
    document.getElementById('stats-container').innerHTML = '<p style="opacity: 0.5; font-size: 0.875rem;">Aucune donnee traitee</p>';
    logger.clear();
    logger.info('Donnees effacees. Selectionnez de nouveaux fichiers.');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make removeFile available globally
window.removeFile = removeFile;
