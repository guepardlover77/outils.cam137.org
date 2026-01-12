// Excel to XML Moodle Converter
let logger;
let loadedQuestions = null;

document.addEventListener('DOMContentLoaded', () => {
    logger = new Logger('log-output');
    initializeControls();
});

function initializeControls() {
    // Setup file input
    setupFileInput('input-file', handleFileSelect);

    // Setup buttons
    const btnConvert = document.getElementById('btn-convert');
    const btnClear = document.getElementById('btn-clear');

    if (btnConvert) {
        btnConvert.addEventListener('click', convertToXML);
    }

    if (btnClear) {
        btnClear.addEventListener('click', clearAll);
    }
}

async function handleFileSelect(file) {
    logger.clear();
    logger.info(`Chargement du fichier: ${file.name}`);

    try {
        const workbook = await readExcelFile(file);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = sheetToObjects(sheet);

        if (!data || data.length === 0) {
            logger.error('Le fichier est vide ou mal formate');
            return;
        }

        // Validate required columns
        const requiredColumns = ['SNO', 'Questions', 'Type', 'option 1', 'Correct Answer', 'Points'];
        const firstRow = data[0];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));

        if (missingColumns.length > 0) {
            logger.error(`Colonnes manquantes: ${missingColumns.join(', ')}`);
            logger.warning('Format attendu: SNO, Questions, Type, Required, option 1-5, Correct Answer, Commentaires, Points');
            return;
        }

        loadedQuestions = data;
        updateFileName('file-name', file.name);
        displayPreview(data);

        document.getElementById('btn-convert').disabled = false;
        logger.success(`${data.length} question(s) chargee(s) avec succes`);

    } catch (error) {
        logger.error(`Erreur lors du chargement: ${error.message}`);
        console.error(error);
    }
}

function displayPreview(data) {
    const container = document.getElementById('preview-container');

    if (!data || data.length === 0) {
        container.innerHTML = '<p style="opacity: 0.5; font-size: 0.875rem;">Aucune donnee</p>';
        return;
    }

    let html = '<table class="data-table"><thead><tr>';
    html += '<th>N°</th><th>Question</th><th>Type</th><th>Options</th><th>Reponses correctes</th><th>Points</th>';
    html += '</tr></thead><tbody>';

    // Show first 5 questions as preview
    const preview = data.slice(0, 5);
    preview.forEach(row => {
        const options = [];
        for (let i = 1; i <= 5; i++) {
            const opt = row[`option ${i}`];
            if (opt && opt.trim()) {
                options.push(opt.trim());
            }
        }

        html += '<tr>';
        html += `<td>${row.SNO || ''}</td>`;
        html += `<td style="max-width: 300px;">${escapeHtml(row.Questions || '')}</td>`;
        html += `<td>${row.Type || ''}</td>`;
        html += `<td style="font-size: 0.75rem;">${options.length} option(s)</td>`;
        html += `<td style="font-size: 0.75rem; max-width: 200px;">${escapeHtml(String(row['Correct Answer'] || ''))}</td>`;
        html += `<td>${row.Points || 1}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';

    if (data.length > 5) {
        html += `<p style="margin-top: var(--spacing-sm); opacity: 0.7; font-size: 0.875rem;">... et ${data.length - 5} autre(s) question(s)</p>`;
    }

    container.innerHTML = html;
}

function convertToXML() {
    if (!loadedQuestions || loadedQuestions.length === 0) {
        logger.error('Aucune question chargee');
        return;
    }

    logger.clear();
    logger.info('Debut de la conversion...');

    const categoryName = document.getElementById('category-name').value.trim() || 'Questions';
    const outputFilename = document.getElementById('output-filename').value.trim() || 'moodle_questions.xml';

    try {
        const xml = generateMoodleXML(loadedQuestions, categoryName);

        // Download the XML file
        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        downloadBlob(blob, outputFilename);

        logger.success(`XML genere avec succes: ${loadedQuestions.length} question(s)`);
        logger.success(`Fichier: ${outputFilename}`);
        logger.info('Import dans Moodle: Banque de questions > Importer > Format Moodle XML');

    } catch (error) {
        logger.error(`Erreur lors de la conversion: ${error.message}`);
        console.error(error);
    }
}

function generateMoodleXML(questions, categoryName) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<quiz>\n\n';

    // Add category
    xml += '  <question type="category">\n';
    xml += '    <category>\n';
    xml += `      <text>$course$/top/${escapeXml(categoryName)}</text>\n`;
    xml += '    </category>\n';
    xml += '  </question>\n\n';

    // Process each question
    questions.forEach((q, index) => {
        try {
            xml += generateQuestionXML(q, index + 1);
        } catch (error) {
            logger.warning(`Question ${index + 1} ignoree: ${error.message}`);
        }
    });

    xml += '</quiz>';
    return xml;
}

function generateQuestionXML(question, questionNumber) {
    const questionText = question.Questions || '';
    const questionType = question.Type || 'CHECKBOX';
    const points = question.Points || 1;
    const feedback = question.Commentaires || '';
    const correctAnswerText = String(question['Correct Answer'] || '');

    // Collect all options
    const options = [];
    for (let i = 1; i <= 5; i++) {
        const opt = question[`option ${i}`];
        if (opt && String(opt).trim()) {
            options.push(String(opt).trim());
        }
    }

    if (options.length === 0) {
        throw new Error('Aucune option trouvee');
    }

    // Parse correct answers
    const correctAnswers = parseCorrectAnswers(correctAnswerText, options);

    if (correctAnswers.length === 0) {
        throw new Error('Aucune reponse correcte identifiee');
    }

    // Determine if single or multiple choice
    // CHECKBOX = multiple choice (single=false), RADIO = single choice (single=true)
    const isSingleChoice = questionType.toUpperCase() === 'RADIO';

    let xml = '  <question type="multichoice">\n';
    xml += `    <name>\n`;
    xml += `      <text>Question ${questionNumber}</text>\n`;
    xml += `    </name>\n`;
    xml += `    <questiontext format="html">\n`;
    xml += `      <text><![CDATA[${escapeXml(questionText)}]]></text>\n`;
    xml += `    </questiontext>\n`;
    xml += `    <generalfeedback format="html">\n`;
    xml += `      <text><![CDATA[${escapeXml(feedback)}]]></text>\n`;
    xml += `    </generalfeedback>\n`;
    xml += `    <defaultgrade>${points}</defaultgrade>\n`;
    xml += `    <penalty>0.3333333</penalty>\n`;
    xml += `    <hidden>0</hidden>\n`;
    xml += `    <single>${isSingleChoice}</single>\n`;
    xml += `    <shuffleanswers>true</shuffleanswers>\n`;
    xml += `    <answernumbering>abc</answernumbering>\n`;
    xml += `    <correctfeedback format="html">\n`;
    xml += `      <text>Votre reponse est correcte.</text>\n`;
    xml += `    </correctfeedback>\n`;
    xml += `    <partiallycorrectfeedback format="html">\n`;
    xml += `      <text>Votre reponse est partiellement correcte.</text>\n`;
    xml += `    </partiallycorrectfeedback>\n`;
    xml += `    <incorrectfeedback format="html">\n`;
    xml += `      <text>Votre reponse est incorrecte.</text>\n`;
    xml += `    </incorrectfeedback>\n`;

    // Add answer options
    options.forEach(option => {
        const isCorrect = correctAnswers.includes(option);
        // For "all or nothing" mode: correct answers get 100, wrong answers get 0
        const fraction = isCorrect ? '100' : '0';

        xml += `    <answer fraction="${fraction}" format="html">\n`;
        xml += `      <text><![CDATA[${escapeXml(option)}]]></text>\n`;
        xml += `      <feedback format="html">\n`;
        xml += `        <text></text>\n`;
        xml += `      </feedback>\n`;
        xml += `    </answer>\n`;
    });

    xml += '  </question>\n\n';
    return xml;
}

function parseCorrectAnswers(correctAnswerText, allOptions) {
    if (!correctAnswerText || !correctAnswerText.trim()) {
        return [];
    }

    // Split by comma and trim each part
    const parts = correctAnswerText.split(',').map(p => p.trim());

    const correctAnswers = [];

    // Try to match each part with an option
    parts.forEach(part => {
        // Try exact match first
        const exactMatch = allOptions.find(opt => opt === part);
        if (exactMatch) {
            correctAnswers.push(exactMatch);
            return;
        }

        // Try case-insensitive match
        const caseInsensitiveMatch = allOptions.find(opt =>
            opt.toLowerCase() === part.toLowerCase()
        );
        if (caseInsensitiveMatch) {
            correctAnswers.push(caseInsensitiveMatch);
            return;
        }

        // Try partial match (if the correct answer text is contained in an option)
        const partialMatch = allOptions.find(opt =>
            opt.includes(part) || part.includes(opt)
        );
        if (partialMatch) {
            correctAnswers.push(partialMatch);
        }
    });

    return correctAnswers;
}

function escapeXml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function clearAll() {
    loadedQuestions = null;
    updateFileName('file-name', '');
    document.getElementById('input-file').value = '';
    document.getElementById('btn-convert').disabled = true;
    document.getElementById('preview-container').innerHTML = '<p style="opacity: 0.5; font-size: 0.875rem;">Aucun fichier charge</p>';
    logger.clear();
    logger.info('Interface reinitialise');
}
