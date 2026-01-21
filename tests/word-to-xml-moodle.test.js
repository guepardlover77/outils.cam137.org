/**
 * Tests pour Word to XML Moodle Converter
 * Teste la conversion des QCM et l'integration des images
 */

// Mock du DOM necessaire
document.body.innerHTML = `
    <input type="file" id="word-file">
    <div id="drop-zone"></div>
    <button id="btn-generate"></button>
    <button id="btn-clear"></button>
    <div id="file-name"></div>
    <div id="corrections-section" style="display:none;"></div>
    <div id="corrections-preview"></div>
    <div id="questions-section" style="display:none;"></div>
    <div id="questions-container"></div>
    <div id="options-section" style="display:none;"></div>
    <div id="actions-section" style="display:none;"></div>
    <div id="log-output"></div>
    <input type="text" id="category-name" value="Test Category">
    <input type="text" id="output-filename" value="test.xml">
`;

/**
 * Implementation des fonctions a tester (extraites de word-to-xml-moodle.js)
 */

function escapeXML(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizeFileName(name) {
    return name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/__+/g, '_');
}

function buildTextWithImage(text, imageData) {
    let html = escapeXML(text || '');
    let file = null;

    if (imageData && imageData.data) {
        const base64Pure = imageData.data.split(',')[1] || imageData.data;
        const imageName = sanitizeFileName(imageData.name);

        html += `<br><img src="@@PLUGINFILE@@/${imageName}" alt="" role="presentation" class="img-responsive">`;
        file = `      <file name="${imageName}" path="/" encoding="base64">${base64Pure}</file>\n`;
    }

    return { html, file };
}

function splitQcmAndCorrections(text) {
    const lines = text.split('\n');
    let correctionIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().toLowerCase() === 'correction') {
            correctionIndex = i;
            break;
        }
    }

    if (correctionIndex === -1) {
        return { qcmText: text, correctionsText: null };
    }

    const qcmText = lines.slice(0, correctionIndex).join('\n');
    const correctionsText = lines.slice(correctionIndex + 1).join('\n');

    return { qcmText, correctionsText };
}

function parseCorrections(correctionsText) {
    const corrections = [];
    if (!correctionsText) return corrections;

    const lines = correctionsText.split('\n');
    let currentCorrection = null;
    let currentFeedbackLines = [];

    const qcmPattern = /^QCM\s*(\d+)\s*[-–:]\s*([A-E]+)/i;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const match = trimmedLine.match(qcmPattern);
        if (match) {
            if (currentCorrection !== null) {
                currentCorrection.feedback = currentFeedbackLines.join('\n').trim();
                corrections.push(currentCorrection);
            }

            currentCorrection = {
                qcm_number: parseInt(match[1]),
                correct_answers: match[2].toUpperCase().split(''),
                feedback: ''
            };
            currentFeedbackLines = [];
        } else {
            if (currentCorrection !== null) {
                currentFeedbackLines.push(trimmedLine);
            }
        }
    }

    if (currentCorrection !== null) {
        currentCorrection.feedback = currentFeedbackLines.join('\n').trim();
        corrections.push(currentCorrection);
    }

    return corrections;
}

function parseQuestions(text) {
    const questions = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let i = 0;
    let questionNumber = 1;

    while (i < lines.length) {
        if (i + 5 < lines.length) {
            const question = {
                id: questionNumber,
                title: lines[i],
                titleImage: null,
                generalFeedback: '',
                feedbackImage: null,
                answers: [
                    { text: lines[i + 1], letter: 'A', isCorrect: false, image: null },
                    { text: lines[i + 2], letter: 'B', isCorrect: false, image: null },
                    { text: lines[i + 3], letter: 'C', isCorrect: false, image: null },
                    { text: lines[i + 4], letter: 'D', isCorrect: false, image: null },
                    { text: lines[i + 5], letter: 'E', isCorrect: false, image: null }
                ]
            };

            questions.push(question);
            questionNumber++;
            i += 6;
        } else {
            break;
        }
    }

    return questions;
}

function applyCorrectionsToQuestions(questions, corrections) {
    for (let idx = 0; idx < questions.length && idx < corrections.length; idx++) {
        const question = questions[idx];
        const correction = corrections[idx];

        question.answers.forEach((answer) => {
            answer.isCorrect = correction.correct_answers.includes(answer.letter);
        });

        if (correction.feedback) {
            question.generalFeedback = correction.feedback;
        }
    }
}

function createMoodleXML(questions, categoryName) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n';

    xml += `  <question type="category">\n`;
    xml += `    <category>\n`;
    xml += `      <text>$course$/top/${escapeXML(categoryName)}</text>\n`;
    xml += `    </category>\n`;
    xml += `  </question>\n`;

    questions.forEach((question, index) => {
        xml += `  <question type="multichoice">\n`;
        xml += `    <name>\n`;
        xml += `      <text><![CDATA[Question ${index + 1}]]></text>\n`;
        xml += `    </name>\n`;

        const questionTextContent = buildTextWithImage(question.title, question.titleImage);
        xml += `    <questiontext format="html">\n`;
        xml += `      <text><![CDATA[${questionTextContent.html}]]></text>\n`;
        if (questionTextContent.file) {
            xml += questionTextContent.file;
        }
        xml += `    </questiontext>\n`;

        const feedbackContent = buildTextWithImage(question.generalFeedback, question.feedbackImage);
        xml += `    <generalfeedback format="html">\n`;
        xml += `      <text><![CDATA[${feedbackContent.html}]]></text>\n`;
        if (feedbackContent.file) {
            xml += feedbackContent.file;
        }
        xml += `    </generalfeedback>\n`;

        xml += `    <defaultgrade>1.0000000</defaultgrade>\n`;
        xml += `    <penalty>0.3333333</penalty>\n`;
        xml += `    <hidden>0</hidden>\n`;
        xml += `    <single>false</single>\n`;
        xml += `    <shuffleanswers>true</shuffleanswers>\n`;
        xml += `    <answernumbering>abc</answernumbering>\n`;

        const correctAnswers = question.answers.filter(a => a.isCorrect);
        const correctFraction = correctAnswers.length > 0 ? (100 / correctAnswers.length) : 0;

        question.answers.forEach((answer) => {
            const fraction = answer.isCorrect ? correctFraction : 0;
            const answerContent = buildTextWithImage(answer.text, answer.image);

            xml += `    <answer fraction="${fraction}" format="html">\n`;
            xml += `      <text><![CDATA[${answerContent.html}]]></text>\n`;
            if (answerContent.file) {
                xml += answerContent.file;
            }
            xml += `      <feedback format="html">\n`;
            xml += `        <text></text>\n`;
            xml += `      </feedback>\n`;
            xml += `    </answer>\n`;
        });

        xml += `  </question>\n`;
    });

    xml += '</quiz>';
    return xml;
}

/**
 * Tests
 */
describe('WordToMoodleConverter', () => {

    describe('splitQcmAndCorrections', () => {
        test('devrait separer QCM et corrections correctement', () => {
            const text = `QCM 1 - Question test
A/ Reponse A
B/ Reponse B
C/ Reponse C
D/ Reponse D
E/ Reponse E

Correction
QCM 1 - AC
B: Faux car raison`;

            const result = splitQcmAndCorrections(text);

            expect(result.qcmText).toContain('QCM 1 - Question test');
            expect(result.qcmText).not.toContain('Correction');
            expect(result.correctionsText).toContain('QCM 1 - AC');
            expect(result.correctionsText).toContain('B: Faux car raison');
        });

        test('devrait retourner null pour corrections si absent', () => {
            const text = `QCM 1 - Question test
A/ Reponse A
B/ Reponse B
C/ Reponse C
D/ Reponse D
E/ Reponse E`;

            const result = splitQcmAndCorrections(text);

            expect(result.qcmText).toBe(text);
            expect(result.correctionsText).toBeNull();
        });
    });

    describe('parseCorrections', () => {
        test('devrait parser les corrections avec feedback', () => {
            const correctionsText = `QCM 1 - ACD
B: Faux car ceci
E: Faux car cela
QCM 2 - BE
A: Incorrect`;

            const corrections = parseCorrections(correctionsText);

            expect(corrections).toHaveLength(2);
            expect(corrections[0].qcm_number).toBe(1);
            expect(corrections[0].correct_answers).toEqual(['A', 'C', 'D']);
            expect(corrections[0].feedback).toContain('B: Faux car ceci');
            expect(corrections[1].qcm_number).toBe(2);
            expect(corrections[1].correct_answers).toEqual(['B', 'E']);
        });

        test('devrait gerer differents formats de separateurs', () => {
            const correctionsText = `QCM 1 : ABC
QCM 2 - DE`;

            const corrections = parseCorrections(correctionsText);

            expect(corrections).toHaveLength(2);
            expect(corrections[0].correct_answers).toEqual(['A', 'B', 'C']);
            expect(corrections[1].correct_answers).toEqual(['D', 'E']);
        });
    });

    describe('parseQuestions', () => {
        test('devrait parser les questions avec 5 reponses', () => {
            const text = `QCM 1 - Quelle est la capitale?
A/ Paris
B/ Londres
C/ Berlin
D/ Madrid
E/ Rome`;

            const questions = parseQuestions(text);

            expect(questions).toHaveLength(1);
            expect(questions[0].title).toBe('QCM 1 - Quelle est la capitale?');
            expect(questions[0].answers).toHaveLength(5);
            expect(questions[0].answers[0].letter).toBe('A');
            expect(questions[0].titleImage).toBeNull();
        });

        test('devrait parser plusieurs questions', () => {
            const text = `Question 1
A/ A1
B/ B1
C/ C1
D/ D1
E/ E1
Question 2
A/ A2
B/ B2
C/ C2
D/ D2
E/ E2`;

            const questions = parseQuestions(text);

            expect(questions).toHaveLength(2);
            expect(questions[0].id).toBe(1);
            expect(questions[1].id).toBe(2);
        });
    });

    describe('escapeXML', () => {
        test('devrait echapper les caracteres speciaux XML', () => {
            expect(escapeXML('Test & <tag> "quote"')).toBe(
                'Test &amp; &lt;tag&gt; &quot;quote&quot;'
            );
        });

        test('devrait gerer les valeurs nulles', () => {
            expect(escapeXML(null)).toBe('');
            expect(escapeXML('')).toBe('');
        });
    });

    describe('sanitizeFileName', () => {
        test('devrait nettoyer les noms de fichiers', () => {
            expect(sanitizeFileName('image test.png')).toBe('image_test.png');
            expect(sanitizeFileName('image@#$.png')).toBe('image_.png');
            expect(sanitizeFileName('test__file.png')).toBe('test_file.png');
        });

        test('devrait conserver les caracteres valides', () => {
            expect(sanitizeFileName('image-test_123.png')).toBe('image-test_123.png');
        });
    });

    describe('buildTextWithImage', () => {
        test('devrait retourner le texte seul sans image', () => {
            const result = buildTextWithImage('Test text', null);

            expect(result.html).toBe('Test text');
            expect(result.file).toBeNull();
        });

        test('devrait integrer une image correctement', () => {
            const imageData = {
                data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                name: 'test.png',
                type: 'image/png'
            };

            const result = buildTextWithImage('Question avec image', imageData);

            expect(result.html).toContain('Question avec image');
            expect(result.html).toContain('@@PLUGINFILE@@/test.png');
            expect(result.file).toContain('<file name="test.png"');
            expect(result.file).toContain('encoding="base64"');
        });

        test('devrait nettoyer le nom de fichier dans l\'image', () => {
            const imageData = {
                data: 'data:image/png;base64,ABC123',
                name: 'image avec espaces.png',
                type: 'image/png'
            };

            const result = buildTextWithImage('Test', imageData);

            expect(result.html).toContain('@@PLUGINFILE@@/image_avec_espaces.png');
            expect(result.file).toContain('name="image_avec_espaces.png"');
        });
    });

    describe('createMoodleXML', () => {
        test('devrait generer un XML valide', () => {
            const questions = [{
                id: 1,
                title: 'Question test',
                titleImage: null,
                generalFeedback: 'Feedback test',
                feedbackImage: null,
                answers: [
                    { text: 'A', letter: 'A', isCorrect: true, image: null },
                    { text: 'B', letter: 'B', isCorrect: false, image: null },
                    { text: 'C', letter: 'C', isCorrect: true, image: null },
                    { text: 'D', letter: 'D', isCorrect: false, image: null },
                    { text: 'E', letter: 'E', isCorrect: false, image: null }
                ]
            }];

            const xml = createMoodleXML(questions, 'Test Category');

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('<quiz>');
            expect(xml).toContain('</quiz>');
            expect(xml).toContain('<question type="multichoice">');
            expect(xml).toContain('Test Category');
        });

        test('devrait inclure une image dans l\'enonce', () => {
            const questions = [{
                id: 1,
                title: 'Question test',
                titleImage: {
                    data: 'data:image/png;base64,TESTBASE64DATA',
                    name: 'question-image.png',
                    type: 'image/png'
                },
                generalFeedback: '',
                feedbackImage: null,
                answers: [
                    { text: 'A', letter: 'A', isCorrect: true, image: null },
                    { text: 'B', letter: 'B', isCorrect: false, image: null },
                    { text: 'C', letter: 'C', isCorrect: false, image: null },
                    { text: 'D', letter: 'D', isCorrect: false, image: null },
                    { text: 'E', letter: 'E', isCorrect: false, image: null }
                ]
            }];

            const xml = createMoodleXML(questions, 'Test');

            expect(xml).toContain('@@PLUGINFILE@@/question-image.png');
            expect(xml).toContain('<file name="question-image.png" path="/" encoding="base64">TESTBASE64DATA</file>');
        });

        test('devrait inclure une image dans une reponse', () => {
            const questions = [{
                id: 1,
                title: 'Question test',
                titleImage: null,
                generalFeedback: '',
                feedbackImage: null,
                answers: [
                    { text: 'A', letter: 'A', isCorrect: true, image: {
                        data: 'data:image/jpeg;base64,ANSWERBASE64',
                        name: 'answer-image.jpg',
                        type: 'image/jpeg'
                    }},
                    { text: 'B', letter: 'B', isCorrect: false, image: null },
                    { text: 'C', letter: 'C', isCorrect: false, image: null },
                    { text: 'D', letter: 'D', isCorrect: false, image: null },
                    { text: 'E', letter: 'E', isCorrect: false, image: null }
                ]
            }];

            const xml = createMoodleXML(questions, 'Test');

            expect(xml).toContain('@@PLUGINFILE@@/answer-image.jpg');
            expect(xml).toContain('<file name="answer-image.jpg" path="/" encoding="base64">ANSWERBASE64</file>');
        });

        test('devrait inclure une image dans le feedback', () => {
            const questions = [{
                id: 1,
                title: 'Question test',
                titleImage: null,
                generalFeedback: 'Explication',
                feedbackImage: {
                    data: 'data:image/gif;base64,FEEDBACKBASE64',
                    name: 'feedback-image.gif',
                    type: 'image/gif'
                },
                answers: [
                    { text: 'A', letter: 'A', isCorrect: true, image: null },
                    { text: 'B', letter: 'B', isCorrect: false, image: null },
                    { text: 'C', letter: 'C', isCorrect: false, image: null },
                    { text: 'D', letter: 'D', isCorrect: false, image: null },
                    { text: 'E', letter: 'E', isCorrect: false, image: null }
                ]
            }];

            const xml = createMoodleXML(questions, 'Test');

            expect(xml).toContain('@@PLUGINFILE@@/feedback-image.gif');
            expect(xml).toContain('<file name="feedback-image.gif" path="/" encoding="base64">FEEDBACKBASE64</file>');
        });

        test('devrait inclure plusieurs images dans differents endroits', () => {
            const questions = [{
                id: 1,
                title: 'Question test',
                titleImage: { data: 'data:image/png;base64,TITLE_IMG', name: 'title.png', type: 'image/png' },
                generalFeedback: '',
                feedbackImage: { data: 'data:image/png;base64,FEEDBACK_IMG', name: 'feedback.png', type: 'image/png' },
                answers: [
                    { text: 'A', letter: 'A', isCorrect: true, image: null },
                    { text: 'B', letter: 'B', isCorrect: false, image: { data: 'data:image/png;base64,ANSWER_IMG', name: 'answer.png', type: 'image/png' }},
                    { text: 'C', letter: 'C', isCorrect: false, image: null },
                    { text: 'D', letter: 'D', isCorrect: false, image: null },
                    { text: 'E', letter: 'E', isCorrect: false, image: null }
                ]
            }];

            const xml = createMoodleXML(questions, 'Test');

            expect(xml).toContain('TITLE_IMG');
            expect(xml).toContain('FEEDBACK_IMG');
            expect(xml).toContain('ANSWER_IMG');
            expect((xml.match(/<file name=/g) || []).length).toBe(3);
        });
    });

    describe('Integration complete - QCM avec images', () => {
        test('devrait traiter un QCM complet avec images et generer le XML', () => {
            const qcmText = `QCM 1 - Identifier l'organe sur l'image
A/ Foie
B/ Rate
C/ Pancreas
D/ Rein
E/ Estomac`;

            const questions = parseQuestions(qcmText);
            const corrections = [{
                qcm_number: 1,
                correct_answers: ['B'],
                feedback: 'La rate est situee dans l\'hypochondre gauche'
            }];

            applyCorrectionsToQuestions(questions, corrections);

            questions[0].titleImage = {
                data: 'data:image/png;base64,ORGANE_IMAGE_BASE64',
                name: 'organe.png',
                type: 'image/png'
            };
            questions[0].feedbackImage = {
                data: 'data:image/png;base64,EXPLICATION_IMAGE_BASE64',
                name: 'explication.png',
                type: 'image/png'
            };

            const xml = createMoodleXML(questions, 'Anatomie');

            expect(xml).toContain('Anatomie');
            expect(xml).toContain('@@PLUGINFILE@@/organe.png');
            expect(xml).toContain('@@PLUGINFILE@@/explication.png');
            expect(xml).toContain('ORGANE_IMAGE_BASE64');
            expect(xml).toContain('EXPLICATION_IMAGE_BASE64');
            expect(xml).toContain('fraction="100"');
        });
    });

    describe('Validation XML Moodle', () => {
        test('devrait generer un XML bien forme', () => {
            const questions = [{
                id: 1,
                title: 'Test',
                titleImage: null,
                generalFeedback: '',
                feedbackImage: null,
                answers: [
                    { text: 'A', letter: 'A', isCorrect: true, image: null },
                    { text: 'B', letter: 'B', isCorrect: false, image: null },
                    { text: 'C', letter: 'C', isCorrect: false, image: null },
                    { text: 'D', letter: 'D', isCorrect: false, image: null },
                    { text: 'E', letter: 'E', isCorrect: false, image: null }
                ]
            }];

            const xml = createMoodleXML(questions, 'Test');

            expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
            expect(xml.endsWith('</quiz>')).toBe(true);
        });

        test('devrait echapper correctement les caracteres speciaux dans le XML', () => {
            const questions = [{
                id: 1,
                title: 'Test avec <balises> & "quotes"',
                titleImage: null,
                generalFeedback: '',
                feedbackImage: null,
                answers: [
                    { text: 'A & B', letter: 'A', isCorrect: true, image: null },
                    { text: 'C < D', letter: 'B', isCorrect: false, image: null },
                    { text: 'E > F', letter: 'C', isCorrect: false, image: null },
                    { text: 'G', letter: 'D', isCorrect: false, image: null },
                    { text: 'H', letter: 'E', isCorrect: false, image: null }
                ]
            }];

            const xml = createMoodleXML(questions, 'Test');

            expect(xml).toContain('&lt;balises&gt;');
            expect(xml).toContain('&amp;');
            expect(xml).toContain('&quot;quotes&quot;');
        });
    });
});
