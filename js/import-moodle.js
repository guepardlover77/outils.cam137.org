// Import Moodle - Convert data to CSV for Moodle import

let loadedData = null;
let logger = null;
let currentMode = 'manual';

document.addEventListener('DOMContentLoaded', () => {
    logger = new Logger('log-output');

    // Setup tabs
    initTabs();

    // Setup file input
    setupFileInput('input-file', handleFileSelect);

    // Setup manual input live preview
    document.getElementById('manual-input').addEventListener('input', handleManualInput);

    // Setup buttons
    document.getElementById('btn-convert').addEventListener('click', convertToCSV);
    document.getElementById('btn-clear').addEventListener('click', clearAll);

    logger.info('Pret. Saisissez vos donnees ou selectionnez un fichier.');
});

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Update buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');

            // Update mode
            currentMode = tabId;

            // Clear data when switching
            loadedData = null;
            updatePreview();

            logger.clear();
            if (tabId === 'manual') {
                logger.info('Mode saisie directe. Collez vos donnees.');
                handleManualInput(); // Process any existing content
            } else {
                logger.info('Mode fichier. Selectionnez un fichier Excel/ODS.');
            }
        });
    });
}

function handleManualInput() {
    const input = document.getElementById('manual-input').value.trim();

    if (!input) {
        loadedData = null;
        updatePreview();
        return;
    }

    const lines = input.split('\n').filter(l => l.trim());
    loadedData = [];
    let skipped = 0;

    for (const line of lines) {
        // Try different separators: tab, semicolon, comma
        let parts = null;

        if (line.includes('\t')) {
            parts = line.split('\t');
        } else if (line.includes(';')) {
            parts = line.split(';');
        } else if (line.includes(',')) {
            parts = line.split(',');
        } else {
            // Try splitting by multiple spaces
            parts = line.split(/\s+/);
        }

        if (parts && parts.length >= 2) {
            const anonymat = parts[0].trim();
            const email = parts[1].trim();

            // Basic validation
            if (anonymat && email && email.includes('@')) {
                loadedData.push({ anonymat, email });
            } else {
                skipped++;
            }
        } else {
            skipped++;
        }
    }

    updatePreview();
}

async function handleFileSelect(file) {
    logger.clear();
    logger.info(`Fichier selectionne : ${file.name}`);
    updateFileName('file-name', file.name);

    try {
        const workbook = await readExcelFile(file);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Read as array (no headers)
        const data = sheetToArray(sheet);

        if (data.length === 0) {
            logger.error('Le fichier est vide');
            return;
        }

        // Extract anonymat and email from columns A and B
        loadedData = [];
        let skipped = 0;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const anonymat = row[0];
            const email = row[1];

            // Skip empty rows
            if (!anonymat || !email) {
                skipped++;
                continue;
            }

            // Clean data
            const cleanAnonymat = String(anonymat).trim();
            const cleanEmail = String(email).trim();

            // Validate email format (basic check)
            if (!cleanEmail.includes('@')) {
                skipped++;
                continue;
            }

            loadedData.push({
                anonymat: cleanAnonymat,
                email: cleanEmail
            });
        }

        logger.success(`${loadedData.length} entrees trouvees`);
        if (skipped > 0) {
            logger.warning(`${skipped} lignes ignorees (donnees manquantes ou invalides)`);
        }

        // Update preview
        updatePreview();

    } catch (err) {
        logger.error(`Erreur lors de la lecture : ${err.message}`);
        loadedData = null;
    }
}

function updatePreview() {
    const container = document.getElementById('preview-container');

    if (!loadedData || loadedData.length === 0) {
        container.innerHTML = '<p style="opacity: 0.5; font-size: 0.875rem;">Aucune donnee chargee</p>';
        return;
    }

    const previewCount = Math.min(loadedData.length, 10);
    let html = `<p style="margin-bottom: var(--spacing-sm); font-size: 0.875rem;">${loadedData.length} entree(s) detectee(s). Apercu :</p>`;

    html += '<table class="results-table"><thead><tr>';
    html += '<th>Anonymat</th><th>Email</th>';
    html += '</tr></thead><tbody>';

    for (let i = 0; i < previewCount; i++) {
        const row = loadedData[i];
        html += `<tr><td>${escapeHtml(row.anonymat)}</td><td>${escapeHtml(row.email)}</td></tr>`;
    }

    html += '</tbody></table>';

    if (loadedData.length > previewCount) {
        html += `<p style="margin-top: var(--spacing-sm); opacity: 0.7; font-size: 0.8rem;">... et ${loadedData.length - previewCount} autres lignes</p>`;
    }

    container.innerHTML = html;
}

function convertToCSV() {
    // If in manual mode, make sure to parse the input first
    if (currentMode === 'manual') {
        handleManualInput();
    }

    if (!loadedData || loadedData.length === 0) {
        logger.error('Aucune donnee a convertir');
        return;
    }

    const cohortId = document.getElementById('cohort-id').value.trim();
    const outputFilename = document.getElementById('output-filename').value.trim() || 'moodle_import.csv';

    logger.info('Conversion en cours...');

    // Build CSV content
    const headers = ['username', 'email', 'auth', 'firstname', 'lastname'];
    if (cohortId) {
        headers.push('cohort1');
    }

    let csvContent = headers.join(',') + '\n';

    for (const row of loadedData) {
        const values = [
            row.anonymat,
            row.email,
            'email',
            'Etudiant',
            row.anonymat
        ];

        if (cohortId) {
            values.push(cohortId);
        }

        // Escape values for CSV
        const escapedValues = values.map(v => {
            if (v.includes(',') || v.includes('"') || v.includes('\n')) {
                return '"' + v.replace(/"/g, '""') + '"';
            }
            return v;
        });

        csvContent += escapedValues.join(',') + '\n';
    }

    // Download
    downloadCSV(csvContent, outputFilename);

    logger.success(`Fichier CSV cree : ${outputFilename}`);
    logger.success(`${loadedData.length} utilisateurs exportes`);

    if (cohortId) {
        logger.info(`Cohorte configuree : ${cohortId}`);
    }

    logger.info('Format CSV : username,email,auth,firstname,lastname' + (cohortId ? ',cohort1' : ''));
    logger.success('Pret pour l\'import dans Moodle');
}

function clearAll() {
    loadedData = null;
    document.getElementById('input-file').value = '';
    document.getElementById('manual-input').value = '';
    updateFileName('file-name', '');
    document.getElementById('cohort-id').value = '';
    document.getElementById('preview-container').innerHTML = '<p style="opacity: 0.5; font-size: 0.875rem;">Aucune donnee chargee</p>';
    logger.clear();
    logger.info('Donnees effacees.');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
