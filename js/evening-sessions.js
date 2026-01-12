// Evening Sessions Planner - Custom Columnar Layout
(function() {
    'use strict';

    // ========== STATE ==========
    const state = {
        startDate: null,
        endDate: null,
        events: {},        // Map: "YYYY-MM-DD" -> { id, title, color }
        holidays: [],      // Array of { id, start, end, label }
        courseList: [],    // Available courses [{ id, name, color }]
        selectedColor: '#d1c4e9',
        nextCourseId: 1,
        nextHolidayId: 1,
        nextEventId: 1
    };

    // Month names in French
    const MONTH_NAMES = [
        'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
    ];

    const DAY_NAMES = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];

    // ========== DOM ELEMENTS ==========
    let elements = {};

    // ========== INITIALIZATION ==========
    function init() {
        cacheElements();
        initializeDateSelectors();
        setDefaultDates();
        attachEventListeners();
        renderPlanning();
        setupDragAndDrop();
    }

    function cacheElements() {
        elements = {
            startMonth: document.getElementById('start-month'),
            startYear: document.getElementById('start-year'),
            endMonth: document.getElementById('end-month'),
            endYear: document.getElementById('end-year'),
            btnApplyDates: document.getElementById('btn-apply-dates'),
            icsFileInput: document.getElementById('ics-file-input'),
            btnImportIcs: document.getElementById('btn-import-ics'),
            courseName: document.getElementById('course-name'),
            colorOptions: document.getElementById('color-options'),
            btnAddCourse: document.getElementById('btn-add-course'),
            courseList: document.getElementById('course-list'),
            vacationStart: document.getElementById('vacation-start'),
            vacationEnd: document.getElementById('vacation-end'),
            vacationLabel: document.getElementById('vacation-label'),
            btnAddVacation: document.getElementById('btn-add-vacation'),
            vacationList: document.getElementById('vacation-list'),
            btnExportPng: document.getElementById('btn-export-png'),
            btnExportPdf: document.getElementById('btn-export-pdf'),
            planningGrid: document.getElementById('planning-grid'),
            planningLegend: document.getElementById('planning-legend'),
            planningSubtitle: document.getElementById('planning-subtitle'),
            planningStage: document.getElementById('planning-stage')
        };
    }

    function initializeDateSelectors() {
        // Populate months
        MONTH_NAMES.forEach((name, index) => {
            const optStart = document.createElement('option');
            optStart.value = index;
            optStart.textContent = name;
            elements.startMonth.appendChild(optStart);

            const optEnd = document.createElement('option');
            optEnd.value = index;
            optEnd.textContent = name;
            elements.endMonth.appendChild(optEnd);
        });

        // Populate years (current year - 1 to current year + 2)
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 1; y <= currentYear + 2; y++) {
            const optStart = document.createElement('option');
            optStart.value = y;
            optStart.textContent = y;
            elements.startYear.appendChild(optStart);

            const optEnd = document.createElement('option');
            optEnd.value = y;
            optEnd.textContent = y;
            elements.endYear.appendChild(optEnd);
        }
    }

    function setDefaultDates() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Default: current month to +3 months
        elements.startMonth.value = currentMonth;
        elements.startYear.value = currentYear;

        let endMonth = currentMonth + 3;
        let endYear = currentYear;
        if (endMonth > 11) {
            endMonth -= 12;
            endYear++;
        }
        elements.endMonth.value = endMonth;
        elements.endYear.value = endYear;

        applyDateRange();
    }

    function applyDateRange() {
        const startMonth = parseInt(elements.startMonth.value);
        const startYear = parseInt(elements.startYear.value);
        const endMonth = parseInt(elements.endMonth.value);
        const endYear = parseInt(elements.endYear.value);

        state.startDate = new Date(startYear, startMonth, 1);
        state.endDate = new Date(endYear, endMonth + 1, 0); // Last day of end month

        // Update subtitle
        const startStr = `${MONTH_NAMES[startMonth]} ${startYear}`;
        const endStr = `${MONTH_NAMES[endMonth]} ${endYear}`;
        elements.planningSubtitle.textContent = `${startStr} - ${endStr}`;

        renderPlanning();
    }

    // ========== EVENT LISTENERS ==========
    function attachEventListeners() {
        // Date range
        elements.btnApplyDates.addEventListener('click', applyDateRange);

        // ICS Import
        elements.btnImportIcs.addEventListener('click', () => elements.icsFileInput.click());
        elements.icsFileInput.addEventListener('change', handleIcsImport);

        // Color selection
        elements.colorOptions.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-btn')) {
                elements.colorOptions.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                state.selectedColor = e.target.dataset.color;
            }
        });

        // Add course
        elements.btnAddCourse.addEventListener('click', addCourse);
        elements.courseName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addCourse();
        });

        // Add vacation
        elements.btnAddVacation.addEventListener('click', addVacation);

        // Export
        elements.btnExportPng.addEventListener('click', exportToPng);
        elements.btnExportPdf.addEventListener('click', exportToPdf);
    }

    // ========== COURSE MANAGEMENT ==========
    function addCourse() {
        const name = elements.courseName.value.trim();
        if (!name) return;

        const course = {
            id: `course-${state.nextCourseId++}`,
            name: name,
            color: state.selectedColor
        };

        state.courseList.push(course);
        elements.courseName.value = '';
        renderCourseList();
        renderLegend();
        setupDragAndDrop();
    }

    function removeCourse(courseId) {
        state.courseList = state.courseList.filter(c => c.id !== courseId);
        renderCourseList();
        renderLegend();
        setupDragAndDrop();
    }

    function renderCourseList() {
        if (state.courseList.length === 0) {
            elements.courseList.innerHTML = '<p class="empty-message">Aucun cours. Ajoutez-en un ci-dessus.</p>';
            return;
        }

        elements.courseList.innerHTML = state.courseList.map(course => `
            <div class="course-item" data-course-id="${course.id}" data-course-name="${escapeHtml(course.name)}" data-course-color="${course.color}">
                <div class="course-color" style="background-color: ${course.color}"></div>
                <span class="course-name">${escapeHtml(course.name)}</span>
                <button class="course-delete" data-course-id="${course.id}">&times;</button>
            </div>
        `).join('');

        // Attach delete handlers
        elements.courseList.querySelectorAll('.course-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeCourse(btn.dataset.courseId);
            });
        });
    }

    // ========== VACATION MANAGEMENT ==========
    function addVacation() {
        const start = elements.vacationStart.value;
        const end = elements.vacationEnd.value;
        const label = elements.vacationLabel.value.trim() || 'Vacances';

        if (!start || !end) {
            alert('Veuillez selectionner les dates de debut et fin');
            return;
        }

        if (new Date(start) > new Date(end)) {
            alert('La date de debut doit etre avant la date de fin');
            return;
        }

        const vacation = {
            id: `vacation-${state.nextHolidayId++}`,
            start: start,
            end: end,
            label: label
        };

        state.holidays.push(vacation);
        elements.vacationStart.value = '';
        elements.vacationEnd.value = '';
        elements.vacationLabel.value = '';
        renderVacationList();
        renderPlanning();
    }

    function removeVacation(vacationId) {
        state.holidays = state.holidays.filter(v => v.id !== vacationId);
        renderVacationList();
        renderPlanning();
    }

    function renderVacationList() {
        if (state.holidays.length === 0) {
            elements.vacationList.innerHTML = '';
            return;
        }

        elements.vacationList.innerHTML = state.holidays.map(v => `
            <div class="vacation-item">
                <div class="vacation-item-info">
                    <span class="vacation-item-label">${escapeHtml(v.label)}</span>
                    <span class="vacation-item-dates">${formatDateShort(v.start)} - ${formatDateShort(v.end)}</span>
                </div>
                <button class="vacation-delete" data-vacation-id="${v.id}">&times;</button>
            </div>
        `).join('');

        elements.vacationList.querySelectorAll('.vacation-delete').forEach(btn => {
            btn.addEventListener('click', () => removeVacation(btn.dataset.vacationId));
        });
    }

    function isVacationDay(dateStr) {
        const date = new Date(dateStr);
        return state.holidays.find(v => {
            const start = new Date(v.start);
            const end = new Date(v.end);
            return date >= start && date <= end;
        });
    }

    // ========== PLANNING RENDERER ==========
    function renderPlanning() {
        if (!state.startDate || !state.endDate) return;

        elements.planningGrid.innerHTML = '';

        let currentDate = new Date(state.startDate);
        let lastMonth = -1;
        let monthColumn = null;

        while (currentDate <= state.endDate) {
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();

            // Create new month column if needed
            if (month !== lastMonth) {
                monthColumn = document.createElement('div');
                monthColumn.className = 'month-column';

                const header = document.createElement('div');
                header.className = 'month-header';
                header.textContent = `${MONTH_NAMES[month]} ${year}`;
                monthColumn.appendChild(header);

                elements.planningGrid.appendChild(monthColumn);
                lastMonth = month;
            }

            // Create day row
            const dayRow = createDayRow(currentDate);
            monthColumn.appendChild(dayRow);

            // Next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Re-render events
        renderEvents();
        setupDragAndDrop();
    }

    function createDayRow(date) {
        const dateStr = formatDateISO(date);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const vacation = isVacationDay(dateStr);

        const row = document.createElement('div');
        row.className = 'day-row';
        row.dataset.date = dateStr;

        if (isWeekend) row.classList.add('weekend');
        if (vacation) row.classList.add('vacation');

        // Day name cell
        const dayName = document.createElement('div');
        dayName.className = 'day-name';
        dayName.textContent = DAY_NAMES[dayOfWeek];
        row.appendChild(dayName);

        // Day number cell
        const dayNum = document.createElement('div');
        dayNum.className = 'day-num';
        dayNum.textContent = date.getDate().toString().padStart(2, '0');
        row.appendChild(dayNum);

        // Event slot
        const eventSlot = document.createElement('div');
        eventSlot.className = 'day-event-slot';
        eventSlot.dataset.date = dateStr;

        // Add vacation block if applicable
        if (vacation) {
            const vacBlock = document.createElement('div');
            vacBlock.className = 'vacation-block';
            vacBlock.innerHTML = `<span>${escapeHtml(vacation.label)}</span>`;
            eventSlot.appendChild(vacBlock);
        }

        row.appendChild(eventSlot);

        return row;
    }

    function renderEvents() {
        // Clear existing events
        document.querySelectorAll('.grid-event').forEach(el => el.remove());

        // Render each event
        Object.entries(state.events).forEach(([dateStr, event]) => {
            const slot = document.querySelector(`.day-event-slot[data-date="${dateStr}"]`);
            if (slot && !isVacationDay(dateStr)) {
                const eventEl = document.createElement('div');
                eventEl.className = 'grid-event';
                eventEl.style.backgroundColor = event.color;
                eventEl.textContent = event.title;
                eventEl.dataset.eventId = event.id;
                eventEl.dataset.date = dateStr;
                slot.appendChild(eventEl);
            }
        });

        setupDragAndDrop();
    }

    function renderLegend() {
        if (state.courseList.length === 0) {
            elements.planningLegend.innerHTML = '';
            return;
        }

        elements.planningLegend.innerHTML = state.courseList.map(course => `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${course.color}"></div>
                <span>${escapeHtml(course.name)}</span>
            </div>
        `).join('');
    }

    // ========== DRAG AND DROP ==========
    function setupDragAndDrop() {
        // Make course items draggable
        interact('.course-item').draggable({
            inertia: true,
            autoScroll: true,
            listeners: {
                start(event) {
                    event.target.classList.add('dragging');
                    createDragClone(event);
                },
                move(event) {
                    moveDragClone(event);
                },
                end(event) {
                    event.target.classList.remove('dragging');
                    removeDragClone();
                }
            }
        });

        // Make grid events draggable (to move them)
        interact('.grid-event').draggable({
            inertia: true,
            autoScroll: true,
            listeners: {
                start(event) {
                    event.target.classList.add('dragging');
                },
                move(event) {
                    // Visual feedback during drag
                },
                end(event) {
                    event.target.classList.remove('dragging');
                }
            }
        });

        // Make event slots droppable
        interact('.day-event-slot').dropzone({
            accept: '.course-item, .grid-event',
            overlap: 0.5,
            ondragenter(event) {
                const slot = event.target;
                const dateStr = slot.dataset.date;
                if (!isVacationDay(dateStr)) {
                    slot.parentElement.classList.add('drop-target');
                }
            },
            ondragleave(event) {
                event.target.parentElement.classList.remove('drop-target');
            },
            ondrop(event) {
                event.target.parentElement.classList.remove('drop-target');
                handleDrop(event);
            }
        });
    }

    function createDragClone(event) {
        const item = event.target;
        const clone = document.createElement('div');
        clone.className = 'drag-clone grid-event';
        clone.style.backgroundColor = item.dataset.courseColor;
        clone.textContent = item.dataset.courseName;
        clone.id = 'drag-clone';
        clone.style.position = 'fixed';
        clone.style.left = `${event.clientX}px`;
        clone.style.top = `${event.clientY}px`;
        clone.style.padding = '4px 8px';
        clone.style.zIndex = '1000';
        document.body.appendChild(clone);
    }

    function moveDragClone(event) {
        const clone = document.getElementById('drag-clone');
        if (clone) {
            clone.style.left = `${event.clientX - 20}px`;
            clone.style.top = `${event.clientY - 10}px`;
        }
    }

    function removeDragClone() {
        const clone = document.getElementById('drag-clone');
        if (clone) clone.remove();
    }

    function handleDrop(event) {
        const dragged = event.relatedTarget;
        const slot = event.target;
        const dateStr = slot.dataset.date;

        // Don't allow drop on vacation days
        if (isVacationDay(dateStr)) return;

        if (dragged.classList.contains('course-item')) {
            // Dropping a new course from sidebar
            const courseName = dragged.dataset.courseName;
            const courseColor = dragged.dataset.courseColor;

            state.events[dateStr] = {
                id: `event-${state.nextEventId++}`,
                title: courseName,
                color: courseColor
            };
        } else if (dragged.classList.contains('grid-event')) {
            // Moving an existing event
            const oldDate = dragged.dataset.date;
            const eventData = state.events[oldDate];

            if (eventData) {
                delete state.events[oldDate];
                state.events[dateStr] = eventData;
            }
        }

        renderEvents();
    }

    // ========== ICS IMPORT ==========
    function handleIcsImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                parseIcsFile(e.target.result);
            } catch (error) {
                console.error('Error parsing ICS:', error);
                alert('Erreur lors de la lecture du fichier ICS');
            }
        };
        reader.readAsText(file);
        elements.icsFileInput.value = '';
    }

    function parseIcsFile(icsData) {
        try {
            const jcalData = ICAL.parse(icsData);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            let importedCount = 0;
            const colors = ['#d1c4e9', '#bbdefb', '#c8e6c9', '#ffe0b2', '#ffcdd2', '#fff9c4'];

            vevents.forEach((vevent, index) => {
                const icalEvent = new ICAL.Event(vevent);
                const title = icalEvent.summary || 'Sans titre';
                const color = colors[index % colors.length];

                // Add to course list if not exists
                const existingCourse = state.courseList.find(c => c.name === title);
                if (!existingCourse) {
                    state.courseList.push({
                        id: `course-${state.nextCourseId++}`,
                        name: title,
                        color: color
                    });
                }

                // If event has a date within range, add to grid
                if (icalEvent.startDate) {
                    const startDate = icalEvent.startDate.toJSDate();
                    const dateStr = formatDateISO(startDate);

                    if (startDate >= state.startDate && startDate <= state.endDate) {
                        state.events[dateStr] = {
                            id: `event-${state.nextEventId++}`,
                            title: title,
                            color: existingCourse ? existingCourse.color : color
                        };
                    }
                }

                importedCount++;
            });

            renderCourseList();
            renderLegend();
            renderEvents();
            setupDragAndDrop();

            alert(`${importedCount} evenement(s) importe(s)`);
        } catch (error) {
            console.error('Error parsing ICS:', error);
            alert('Erreur lors de l\'analyse du fichier ICS');
        }
    }

    // ========== EXPORT ==========
    function exportToPng() {
        const stage = elements.planningStage;

        html2canvas(stage, {
            scale: 2,
            backgroundColor: '#fff',
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: stage.scrollWidth,
            windowHeight: stage.scrollHeight
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `planning_${formatDateISO(new Date())}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            console.error('Error exporting PNG:', error);
            alert('Erreur lors de l\'export PNG');
        });
    }

    function exportToPdf() {
        const stage = elements.planningStage;

        html2canvas(stage, {
            scale: 2,
            backgroundColor: '#fff',
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: stage.scrollWidth,
            windowHeight: stage.scrollHeight
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jspdf.jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = 297;
            const pageHeight = 210;
            const imgRatio = canvas.height / canvas.width;
            let imgWidth = pageWidth - 10;
            let imgHeight = imgWidth * imgRatio;

            if (imgHeight > pageHeight - 10) {
                imgHeight = pageHeight - 10;
                imgWidth = imgHeight / imgRatio;
            }

            const x = (pageWidth - imgWidth) / 2;
            const y = (pageHeight - imgHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            pdf.save(`planning_${formatDateISO(new Date())}.pdf`);
        }).catch(error => {
            console.error('Error exporting PDF:', error);
            alert('Erreur lors de l\'export PDF');
        });
    }

    // ========== UTILITIES ==========
    function formatDateISO(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateShort(dateStr) {
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== INIT ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
