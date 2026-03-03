'use strict';

/* ════════════════════════════════════════════════════════════════════
   IIFE-WRAPPER — kein globaler Scope-Leak
   ════════════════════════════════════════════════════════════════════ */
(function AuraMatrix() {

    /* ── Konstanten ────────────────────────────────────────────────── */
    const STORAGE_KEY  = 'aura_matrix_v2';
    const TIMER_START  = 25 * 60;          // Sekunden
    const VALID_QUADS  = ['q1', 'q2', 'q3', 'q4'];
    const TITLE_ORIG   = document.title;

    /* ── Hilfsfunktionen (werden vor State-Init benötigt) ──────────── */

    /**
     * Schema-Validierung für Task-Objekte.
     * Schützt vor korrupten localStorage-Daten und Import-Daten.
     * @param {unknown} t
     * @returns {boolean}
     */
    function isValidTask(t) {
        return (
            t !== null &&
            typeof t === 'object' &&
            typeof t.id    === 'string'  && t.id.trim().length > 0 &&
            typeof t.title === 'string'  && t.title.trim().length > 0 &&
            VALID_QUADS.includes(t.quad) &&
            typeof t.done  === 'boolean'
        );
    }

    /**
     * localStorage sicher lesen.
     * Fehlerfall: Safari Private Mode, gesperrter Storage, korruptes JSON.
     * @returns {Task[]}
     */
    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(isValidTask);
        } catch {
            return [];
        }
    }

    /**
     * localStorage sicher schreiben.
     * @param {Task[]} data
     */
    function saveToStorage(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
            showToast('Speichern fehlgeschlagen – Speicher nicht verfügbar.', true);
        }
    }

    /**
     * ISO-Datum (YYYY-MM-DD) ohne Zeitzonenverschiebung formatieren.
     * new Date('2024-06-15') interpretiert als UTC → in GMT+2: 14.06.2024 (falsch).
     * Lösung: manuell in lokale Datumskomponenten zerlegen.
     * @param {string} iso
     * @returns {string}
     */
    function formatDate(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    }

    /* ── Applikations-State ────────────────────────────────────────── */
    /*
      State ist in diesem Objekt gekapselt.
      Kein einziger let/var im äußeren Scope — verhindert versehentliche
      globale Mutation aus Eventhandlern oder Konsolenzugriffen.
    */
    const State = {
        db:            loadFromStorage(),  // isValidTask ist bereits definiert ✓
        timerId:       null,
        timeLeft:      TIMER_START,
        chartObj:      null,
        toastTimer:    null,
        draggedId:     null,
        prevFocus:     null,       // Fokus-Rückgabe nach Modal-Schließen
        confirmFocus:  null,       // Fokus-Rückgabe nach Bestätigungs-Dialog
        pendingDelete: null,       // { id, title } — wartet auf Bestätigung
    };

    /* ── Toast ─────────────────────────────────────────────────────── */
    /**
     * Nicht-intrusive Status-Meldung (2,5 Sekunden).
     * Kein blockierendes alert() / confirm().
     * @param {string}  msg
     * @param {boolean} isError
     */
    function showToast(msg, isError = false) {
        const el = document.getElementById('toast');
        clearTimeout(State.toastTimer);
        el.textContent = msg;
        el.className   = 'toast toast--visible' + (isError ? ' toast--error' : '');
        State.toastTimer = setTimeout(() => { el.className = 'toast'; }, 2500);
    }

    /* ── Rendering ─────────────────────────────────────────────────── */
    /**
     * Vollständiges Re-Render aller Ansichten.
     * Nach DOM-Aufbau: lucide.createIcons() für Icon-Initialisierung.
     */
    function render() {
        renderMatrix();
        renderArchive();
        renderStats();
        if (window.lucide) lucide.createIcons();
    }

    /** Alle vier Quadrant-Listen rendern. */
    function renderMatrix() {
        VALID_QUADS.forEach(quad => {
            const container = document.getElementById(`list-${quad}`);
            container.replaceChildren();  // moderner, kein innerHTML = ''

            const tasks = State.db.filter(t => t.quad === quad && !t.done);

            if (tasks.length === 0) {
                const empty = document.createElement('p');
                empty.className   = 'empty-state';
                empty.textContent = 'Keine Aufgaben.';
                container.appendChild(empty);
                return;
            }
            tasks.forEach(t => container.appendChild(buildTaskNode(t)));
        });

        // Fortschrittsbalken
        const done  = State.db.filter(t => t.done).length;
        const total = State.db.length;
        const pct   = total ? Math.round((done / total) * 100) : 0;
        document.getElementById('progress-text').textContent =
            `${pct}% abgeschlossen — ${done} von ${total} Aufgaben erledigt`;
    }

    /**
     * Task-Karte per createElement bauen.
     * KEIN innerHTML mit Nutzerdaten → XSS-sicher by design.
     * Alle Nutzerdaten werden ausschließlich via textContent oder
     * setAttribute (automatisch escaped vom Browser) eingefügt.
     *
     * setAttribute() escaped HTML-Entities automatisch:
     * kein escapeHtml() für Attributwerte nötig oder korrekt.
     *
     * @param {Task} task
     * @returns {HTMLElement}
     */
    function buildTaskNode(task) {
        const node = document.createElement('div');
        node.className       = 'task-node';
        node.draggable       = true;
        node.dataset.id      = task.id;
        node.setAttribute('role', 'listitem');

        node.addEventListener('dragstart', e => {
            State.draggedId = task.id;
            e.dataTransfer.effectAllowed = 'move';
        });
        node.addEventListener('dragend', () => { State.draggedId = null; });

        /* ── Erledigt-Button ──────────────────────────────────── */
        const doneBtn = document.createElement('button');
        doneBtn.className = 'task-done-btn';
        // setAttribute escaped Sonderzeichen automatisch → kein escapeHtml nötig
        doneBtn.setAttribute('aria-label', `"${task.title}" als erledigt markieren`);
        doneBtn.innerHTML  = '<i data-lucide="circle" width="18" height="18" aria-hidden="true"></i>';
        doneBtn.addEventListener('click', () => toggleDone(task.id));

        /* ── Body: Titel + Datum ──────────────────────────────── */
        const body = document.createElement('div');
        body.className = 'task-body';

        const titleEl = document.createElement('div');
        titleEl.className       = 'task-text';
        titleEl.contentEditable = 'true';
        titleEl.setAttribute('role',         'textbox');
        titleEl.setAttribute('aria-label',   'Aufgabentitel bearbeiten');
        titleEl.setAttribute('aria-multiline', 'false');
        titleEl.textContent = task.title; // textContent → XSS-sicher

        // Enter: bestätigen (kein Zeilenumbruch)
        titleEl.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
        });
        // blur: Änderung speichern oder verwerfen
        titleEl.addEventListener('blur', () => {
            const val = titleEl.textContent.trim();
            if (val && val !== task.title) {
                updateField(task.id, 'title', val);
                // aria-label aktualisieren
                doneBtn.setAttribute('aria-label', `"${val}" als erledigt markieren`);
                deleteBtn.setAttribute('aria-label', `"${val}" löschen`);
            } else {
                titleEl.textContent = task.title; // Leerstring → Originalwert
            }
        });

        body.appendChild(titleEl);

        if (task.date) {
            const dateEl = document.createElement('div');
            dateEl.className = 'task-date';
            dateEl.innerHTML = '<i data-lucide="calendar" width="12" height="12" aria-hidden="true"></i>';
            // Datum als sicherer TextNode anfügen
            dateEl.appendChild(document.createTextNode('\u00A0' + formatDate(task.date)));
            body.appendChild(dateEl);
        }

        /* ── Löschen-Button ───────────────────────────────────── */
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'task-delete-btn';
        deleteBtn.setAttribute('aria-label', `"${task.title}" löschen`);
        deleteBtn.innerHTML = '<i data-lucide="trash-2" width="15" height="15" aria-hidden="true"></i>';
        // Bestätigungs-Dialog — kein sofortiges Löschen
        deleteBtn.addEventListener('click', () => openConfirmDialog(task.id, task.title));

        const main = document.createElement('div');
        main.className = 'task-main';
        main.appendChild(doneBtn);
        main.appendChild(body);
        main.appendChild(deleteBtn);
        node.appendChild(main);

        /* ── Beschreibung ─────────────────────────────────────── */
        const descEl = document.createElement('div');
        descEl.className       = 'task-desc';
        descEl.contentEditable = 'true';
        descEl.setAttribute('role',        'textbox');
        descEl.setAttribute('aria-label',  'Aufgabendetails bearbeiten');
        descEl.setAttribute('aria-multiline', 'true');

        const hasDesc = task.desc && task.desc.trim().length > 0;
        if (hasDesc) {
            descEl.textContent = task.desc;
        } else {
            descEl.textContent    = 'Details hinzufügen …';
            descEl.style.color    = 'var(--color-muted)';
            descEl.dataset.empty  = 'true';
        }

        descEl.addEventListener('focus', () => {
            if (descEl.dataset.empty === 'true') {
                descEl.textContent  = '';
                descEl.style.color  = '';
                delete descEl.dataset.empty;
            }
        });
        descEl.addEventListener('blur', () => {
            const val = descEl.textContent.trim();
            if (val !== (task.desc || '')) updateField(task.id, 'desc', val);
            if (!val) {
                descEl.textContent    = 'Details hinzufügen …';
                descEl.style.color    = 'var(--color-muted)';
                descEl.dataset.empty  = 'true';
            }
        });

        node.appendChild(descEl);
        return node;
    }

    /** Archiv-Liste rendern (erledigte Aufgaben, mit Suche). */
    function renderArchive() {
        const container = document.getElementById('list-archive');
        const searchVal = (document.getElementById('archive-search')?.value || '')
            .toLowerCase().trim();
        const done = State.db.filter(
            t => t.done && t.title.toLowerCase().includes(searchVal)
        );

        container.replaceChildren();

        if (done.length === 0) {
            const empty = document.createElement('p');
            empty.className   = 'empty-state';
            empty.textContent = searchVal ? 'Keine Treffer im Archiv.' : 'Archiv ist leer.';
            container.appendChild(empty);
            return;
        }

        done.forEach(task => {
            const node = document.createElement('div');
            node.className = 'task-node task-node--done';
            node.setAttribute('role', 'listitem');

            const restoreBtn = document.createElement('button');
            restoreBtn.className   = 'task-done-btn';
            restoreBtn.style.color = 'var(--color-q2)';
            restoreBtn.setAttribute('aria-label', `"${task.title}" wiederherstellen`);
            restoreBtn.innerHTML   = '<i data-lucide="check-circle-2" width="18" height="18" aria-hidden="true"></i>';
            restoreBtn.addEventListener('click', () => toggleDone(task.id));

            const titleEl = document.createElement('span');
            titleEl.className   = 'task-text';
            titleEl.textContent = task.title;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'task-delete-btn';
            deleteBtn.setAttribute('aria-label', `"${task.title}" dauerhaft löschen`);
            deleteBtn.innerHTML = '<i data-lucide="trash-2" width="15" height="15" aria-hidden="true"></i>';
            deleteBtn.addEventListener('click', () => openConfirmDialog(task.id, task.title));

            const main = document.createElement('div');
            main.className = 'task-main';
            main.appendChild(restoreBtn);
            main.appendChild(titleEl);
            main.appendChild(deleteBtn);
            node.appendChild(main);
            container.appendChild(node);
        });
    }

    /** Statistik-Kacheln aktualisieren. */
    function renderStats() {
        const done  = State.db.filter(t => t.done).length;
        const total = State.db.length;
        const pct   = total ? Math.round((done / total) * 100) : 0;
        document.getElementById('st-total').textContent = total;
        document.getElementById('st-done').textContent  = done;
        document.getElementById('st-rate').textContent  = pct + '%';
    }

    /* ── Chart ─────────────────────────────────────────────────────── */
    /**
     * Balkendiagramm mit ECHTEN Daten pro Quadrant.
     * Kein einziger Fake-Wert. Wird nur beim Öffnen der Analyse-Seite gebaut.
     */
    function renderChart() {
        const ctx = document.getElementById('prodChart').getContext('2d');
        if (State.chartObj) State.chartObj.destroy();

        const labels = [
            'Sofort erledigen',
            'Strategische Planung',
            'Operative Aufgaben',
            'Warteschlange',
        ];
        const colors = ['#ef4444', '#22c55e', '#f59e0b', '#71717a'];

        State.chartObj = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label:           'Offen',
                        data:            VALID_QUADS.map(q => State.db.filter(t => t.quad === q && !t.done).length),
                        backgroundColor: colors.map(c => c + 'bb'),
                        borderColor:     colors,
                        borderWidth:     1,
                        borderRadius:    6,
                    },
                    {
                        label:           'Erledigt',
                        data:            VALID_QUADS.map(q => State.db.filter(t => t.quad === q &&  t.done).length),
                        backgroundColor: 'rgba(255,255,255,0.07)',
                        borderColor:     'rgba(255,255,255,0.2)',
                        borderWidth:     1,
                        borderRadius:    6,
                    },
                ],
            },
            options: {
                responsive:          true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#a1a1aa' } },
                },
                scales: {
                    x: {
                        ticks: { color: '#71717a' },
                        grid:  { color: 'rgba(255,255,255,0.04)' },
                    },
                    y: {
                        beginAtZero: true,
                        ticks:       { color: '#71717a', stepSize: 1, precision: 0 },
                        grid:        { color: 'rgba(255,255,255,0.04)' },
                    },
                },
            },
        });
    }

    /* ── Task-Operationen ──────────────────────────────────────────── */

    /** Neue Aufgabe anlegen — mit vollständiger Validierung. */
    function addTask() {
        const titleInput = document.getElementById('m-title');
        const titleError = document.getElementById('m-title-error');
        const title      = titleInput.value.trim();

        if (!title) {
            titleInput.classList.add('form-input--error');
            titleError.classList.add('field-error--visible');
            titleInput.focus();
            return;
        }
        titleInput.classList.remove('form-input--error');
        titleError.classList.remove('field-error--visible');

        const quad = document.getElementById('m-quad').value;
        const date = document.getElementById('m-date').value;

        // Immutables Push: neues Objekt, kein Mutieren
        State.db = [
            ...State.db,
            {
                id:        crypto.randomUUID(),   // kollisionssichere ID
                title,
                desc:      document.getElementById('m-desc').value.trim(),
                quad,
                date:      (quad === 'q2' && date) ? date : null,
                done:      false,
                createdAt: Date.now(),
                doneAt:    null,
            },
        ];

        saveToStorage(State.db);
        closeModal();
        render();
        showToast(`"${title}" wurde erstellt.`);
    }

    /** Erledigungsstatus umschalten. Immutable Update. */
    function toggleDone(id) {
        State.db = State.db.map(t =>
            t.id === id
                ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : null }
                : t
        );
        saveToStorage(State.db);
        render();
    }

    /**
     * Einzelfeld nach Inline-Bearbeitung aktualisieren.
     * Immutable Update — konsistent mit allen anderen Operationen.
     * Kein render() → würde Fokus und Cursor-Position verlieren.
     */
    function updateField(id, field, value) {
        State.db = State.db.map(t =>
            t.id === id ? { ...t, [field]: value } : t
        );
        saveToStorage(State.db);
        // Nur abhängige Teile aktualisieren
        renderStats();
        renderArchive();
        if (window.lucide) lucide.createIcons();
    }

    /** Aufgabe dauerhaft löschen. Wird nur nach Bestätigung aufgerufen. */
    function deleteTask(id) {
        const task  = State.db.find(t => t.id === id);
        const title = task?.title ?? '';
        State.db = State.db.filter(t => t.id !== id);
        saveToStorage(State.db);
        render();
        showToast(`"${title}" wurde gelöscht.`);
    }

    /* ── Drag & Drop ───────────────────────────────────────────────── */
    function setupDropZones() {
        VALID_QUADS.forEach(quad => {
            const zone = document.getElementById(`drop-${quad}`);

            zone.addEventListener('dragover', e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                zone.classList.add('q-box--dragover');
            });

            zone.addEventListener('dragleave', e => {
                // Nur entfernen wenn wirklich außerhalb der Drop-Zone
                if (!zone.contains(e.relatedTarget)) {
                    zone.classList.remove('q-box--dragover');
                }
            });

            zone.addEventListener('drop', e => {
                e.preventDefault();
                zone.classList.remove('q-box--dragover');
                if (!State.draggedId) return;

                const task = State.db.find(t => t.id === State.draggedId);
                if (task && task.quad !== quad) {
                    // Immutable Update
                    State.db = State.db.map(t =>
                        t.id === State.draggedId
                            ? { ...t, quad, date: quad !== 'q2' ? null : t.date }
                            : t
                    );
                    saveToStorage(State.db);
                    render();
                }
                State.draggedId = null;
            });
        });
    }

    /* ── Modal — Aufgabe erstellen ─────────────────────────────────── */

    /** Alle fokussierbaren Elemente innerhalb eines Containers ermitteln. */
    function getFocusable(container) {
        return Array.from(
            container.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), ' +
                'select:not([disabled]), textarea:not([disabled]), ' +
                '[tabindex]:not([tabindex="-1"])'
            )
        );
    }

    /**
     * Fokus-Trap: Tab / Shift+Tab bleibt innerhalb des Containers.
     * @param {KeyboardEvent} e
     * @param {HTMLElement}   container
     */
    function trapFocus(e, container) {
        if (e.key !== 'Tab') return;
        const focusable = getFocusable(container);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    function openModal() {
        State.prevFocus = document.activeElement;

        // Felder zurücksetzen
        document.getElementById('m-title').value = '';
        document.getElementById('m-desc').value  = '';
        document.getElementById('m-date').value  = '';
        document.getElementById('m-quad').value  = 'q2';
        document.getElementById('m-title').classList.remove('form-input--error');
        document.getElementById('m-title-error').classList.remove('field-error--visible');
        syncDateField();

        document.getElementById('modal').classList.add('modal--open');
        // Fokus nach Render-Zyklus setzen
        requestAnimationFrame(() => document.getElementById('m-title').focus());
    }

    function closeModal() {
        document.getElementById('modal').classList.remove('modal--open');
        // Fokus an auslösendes Element zurückgeben
        if (State.prevFocus && typeof State.prevFocus.focus === 'function') {
            State.prevFocus.focus();
        }
        State.prevFocus = null;
    }

    /** Datumsfeld bei Quadrant-Wechsel aktivieren oder deaktivieren. */
    function syncDateField() {
        const quad  = document.getElementById('m-quad').value;
        const field = document.getElementById('m-date');
        field.disabled = (quad !== 'q2');
        if (quad !== 'q2') field.value = '';
    }

    /* ── Bestätigungs-Dialog ───────────────────────────────────────── */

    function openConfirmDialog(id, title) {
        State.confirmFocus  = document.activeElement;
        State.pendingDelete = { id, title };

        document.getElementById('confirm-msg').textContent =
            `"${title}" wird unwiderruflich gelöscht.`;

        const dlg = document.getElementById('confirm-dialog');
        dlg.classList.add('confirm-dialog--open');
        // Fokus auf den Abbrechen-Button (sicherer Default)
        requestAnimationFrame(() =>
            document.getElementById('btn-confirm-cancel').focus()
        );
    }

    function closeConfirmDialog() {
        document.getElementById('confirm-dialog').classList.remove('confirm-dialog--open');
        State.pendingDelete = null;
        if (State.confirmFocus && typeof State.confirmFocus.focus === 'function') {
            State.confirmFocus.focus();
        }
        State.confirmFocus = null;
    }

    function confirmDelete() {
        if (!State.pendingDelete) return;
        const { id } = State.pendingDelete;
        closeConfirmDialog();
        deleteTask(id);
    }

    /* ── Timer ─────────────────────────────────────────────────────── */

    function startTimer() {
        if (State.timerId) return; // Guard: läuft bereits
        document.getElementById('timer-ui').classList.remove('timer-ui--done');
        document.getElementById('timer-display').setAttribute('aria-live', 'off');

        State.timerId = setInterval(() => {
            if (State.timeLeft > 0) {
                State.timeLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(State.timerId);
                State.timerId = null;
                document.getElementById('timer-ui').classList.add('timer-ui--done');
                // Screen-Reader über Ablauf informieren
                document.getElementById('timer-display').setAttribute('aria-live', 'assertive');
                showToast('⏱ Pomodoro abgeschlossen! Mach eine Pause.');
                document.title = '✅ Fertig! — Aura Matrix';
            }
        }, 1000);
    }

    function pauseTimer() {
        clearInterval(State.timerId);
        State.timerId = null;
    }

    function resetTimer() {
        pauseTimer();
        State.timeLeft = TIMER_START;
        document.getElementById('timer-ui').classList.remove('timer-ui--done');
        document.getElementById('timer-display').setAttribute('aria-live', 'off');
        updateTimerDisplay();
        document.title = TITLE_ORIG;
    }

    function updateTimerDisplay() {
        const m   = Math.floor(State.timeLeft / 60);
        const s   = State.timeLeft % 60;
        const str = `${m}:${s < 10 ? '0' + s : s}`;
        document.getElementById('timer-display').textContent = str;
        if (State.timerId) document.title = `${str} — Aura Matrix`;
    }

    /* ── Navigation ────────────────────────────────────────────────── */

    function showPage(pageId) {
        document.querySelectorAll('.page').forEach(
            p => p.classList.remove('page--active')
        );
        document.querySelectorAll('.nav-btn[data-page]').forEach(
            btn => btn.removeAttribute('aria-current')
        );
        document.getElementById(`page-${pageId}`).classList.add('page--active');
        document.querySelector(`.nav-btn[data-page="${pageId}"]`)
            ?.setAttribute('aria-current', 'page');
        if (pageId === 'stats') renderChart();
    }

    /* ── Export / Import ───────────────────────────────────────────── */

    /** PDF-Export mit korrektem Seitenumbruch und formatierten Daten. */
    function exportPDF() {
        if (!window.jspdf) { showToast('jsPDF nicht geladen.', true); return; }
        const { jsPDF } = window.jspdf;
        const doc   = new jsPDF();
        const pageH = doc.internal.pageSize.height;
        let y = 20;

        const addLine = (text, size = 10, style = 'normal') => {
            if (y + 10 > pageH - 15) { doc.addPage(); y = 20; }
            doc.setFontSize(size);
            doc.setFont('helvetica', style);
            doc.text(String(text), 20, y);
            y += 10;
        };

        addLine('AURA MATRIX 1.0 — STATUSBERICHT', 14, 'bold');
        addLine(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, 9);
        y += 4;

        [
            { label: 'Sofort erledigen',     quad: 'q1' },
            { label: 'Strategische Planung', quad: 'q2' },
            { label: 'Operative Aufgaben',   quad: 'q3' },
            { label: 'Warteschlange',        quad: 'q4' },
        ].forEach(({ label, quad }) => {
            const tasks = State.db.filter(t => t.quad === quad);
            if (!tasks.length) return;
            y += 4;
            addLine(label.toUpperCase(), 11, 'bold');
            tasks.forEach(t => {
                addLine(
                    `  ${t.done ? '[X]' : '[ ]'} ${t.title}` +
                    `${t.date ? ' — ' + formatDate(t.date) : ''}`,
                    10
                );
                if (t.desc) addLine(`       ${t.desc}`, 8);
            });
        });

        doc.save(`Aura_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('PDF wurde exportiert.');
    }

    /** JSON-Backup exportieren. URL-Objekt nach Verwendung freigeben. */
    function exportJSON() {
        try {
            const blob = new Blob(
                [JSON.stringify(State.db, null, 2)],
                { type: 'application/json' }
            );
            const url = URL.createObjectURL(blob);
            const a   = Object.assign(document.createElement('a'), {
                href:     url,
                download: `Aura_Backup_${new Date().toISOString().slice(0, 10)}.json`,
            });
            a.click();
            URL.revokeObjectURL(url); // Speicher sofort freigeben
            showToast('Backup wurde gespeichert.');
        } catch {
            showToast('Backup fehlgeschlagen.', true);
        }
    }

    function importJSON() {
        document.getElementById('json-file-input').click();
    }

    /**
     * JSON-Import mit vollständiger Schema-Validierung.
     * isValidTask() filtert alle Objekte die nicht dem Task-Schema entsprechen.
     */
    function handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!Array.isArray(parsed)) throw new Error('Datei enthält kein Array.');

                const valid   = parsed.filter(isValidTask);
                const skipped = parsed.length - valid.length;

                State.db = valid;
                saveToStorage(State.db);
                render();
                showToast(
                    skipped > 0
                        ? `${valid.length} geladen, ${skipped} ungültige übersprungen.`
                        : `${valid.length} Aufgaben erfolgreich importiert.`
                );
            } catch (err) {
                showToast(`Import fehlgeschlagen: ${err.message}`, true);
            }
            e.target.value = ''; // Input zurücksetzen für erneuten Import
        };
        reader.readAsText(file);
    }

    /* ── Event-Listener — zentralisiert ───────────────────────────── */
    /*
      Kein einziger inline onclick/onchange/oninput im HTML.
      Alle Listener werden hier registriert.
    */
    function setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn[data-page]').forEach(btn =>
            btn.addEventListener('click', () => showPage(btn.dataset.page))
        );

        // Neue Aufgabe
        document.getElementById('btn-new-task').addEventListener('click', openModal);

        // Timer
        document.getElementById('btn-timer-start').addEventListener('click', startTimer);
        document.getElementById('btn-timer-pause').addEventListener('click', pauseTimer);
        document.getElementById('btn-timer-reset').addEventListener('click', resetTimer);

        // Modal: Speichern & Abbrechen
        document.getElementById('btn-modal-save').addEventListener('click', addTask);
        document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
        document.getElementById('m-quad').addEventListener('change', syncDateField);

        // Modal: Overlay-Klick schließt
        document.getElementById('modal').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeModal();
        });

        // Modal: Fokus-Trap
        document.getElementById('modal').addEventListener('keydown', e =>
            trapFocus(e, document.getElementById('modal-content'))
        );

        // Bestätigungs-Dialog
        document.getElementById('btn-confirm-ok').addEventListener('click', confirmDelete);
        document.getElementById('btn-confirm-cancel').addEventListener('click', closeConfirmDialog);

        // Bestätigungs-Dialog: Overlay-Klick schließt
        document.getElementById('confirm-dialog').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeConfirmDialog();
        });

        // Bestätigungs-Dialog: Fokus-Trap
        document.getElementById('confirm-dialog').addEventListener('keydown', e =>
            trapFocus(e, document.getElementById('confirm-dialog-box'))
        );

        // Globale Tastatur-Events: Escape schließt das oberste offene Dialog
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            // Reihenfolge: zuerst tiefstes Layer schließen
            const confirmOpen = document.getElementById('confirm-dialog')
                .classList.contains('confirm-dialog--open');
            const modalOpen   = document.getElementById('modal')
                .classList.contains('modal--open');

            if (confirmOpen)   { closeConfirmDialog(); return; }
            if (modalOpen)     { closeModal();          return; }
        });

        // Enter im Modal-Titelfeld → Speichern (nur wenn Modal offen)
        document.getElementById('m-title').addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); addTask(); }
        });

        // Export / Import
        document.getElementById('btn-export-pdf').addEventListener('click',  exportPDF);
        document.getElementById('btn-export-json').addEventListener('click', exportJSON);
        document.getElementById('btn-import-json').addEventListener('click', importJSON);
        document.getElementById('json-file-input').addEventListener('change', handleFileImport);

        // Archiv-Suche
        document.getElementById('archive-search').addEventListener('input', () => {
            renderArchive();
            if (window.lucide) lucide.createIcons();
        });

        // Mobile Navigation Toggle
        const navToggle  = document.getElementById('btn-nav-toggle');
        const navEl      = document.getElementById('main-nav');
        const navOverlay = document.getElementById('nav-overlay');

        function openNav() {
            navEl.classList.add('nav--open');
            navOverlay.classList.add('nav-overlay--visible');
            navOverlay.setAttribute('aria-hidden', 'false');
            navToggle.setAttribute('aria-expanded', 'true');
            navToggle.setAttribute('aria-label', 'Navigation schließen');
        }
        function closeNav() {
            navEl.classList.remove('nav--open');
            navOverlay.classList.remove('nav-overlay--visible');
            navOverlay.setAttribute('aria-hidden', 'true');
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.setAttribute('aria-label', 'Navigation öffnen');
        }

        navToggle.addEventListener('click', () => {
            navEl.classList.contains('nav--open') ? closeNav() : openNav();
        });
        navOverlay.addEventListener('click', closeNav);

        // Schließe Nav bei Page-Wechsel auf Mobile
        document.querySelectorAll('.nav-btn[data-page]').forEach(btn =>
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 900) closeNav();
            })
        );

        // Escape schließt auch die Nav auf Mobile
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && navEl.classList.contains('nav--open')) closeNav();
        });
    }

    /* ── Initialisierung ───────────────────────────────────────────── */
    /*
      window.load: stellt sicher dass alle defer-Scripts
      (lucide, jsPDF, Chart.js) vollständig geladen sind.
    */
    window.addEventListener('load', () => {
        setupEventListeners();
        setupDropZones();
        render();
    });

})(); // Ende IIFE
