'use strict';

/* ════════════════════════════════════════════════════════════════════
   IIFE-WRAPPER — kein globaler Scope-Leak
   ════════════════════════════════════════════════════════════════════ */
(function AuraMatrix() {

    /* ── Konstanten ────────────────────────────────────────────────── */
    const STORAGE_KEY        = 'aura_matrix_v2';
    const TIMER_SETTINGS_KEY = 'aura_timer_settings_v1';
    const VALID_QUADS        = ['q1', 'q2', 'q3', 'q4'];
    const TITLE_ORIG         = document.title;
    const API_BASE = '/api/tasks';

    /* ── Timer-Presets (in Sekunden) ───────────────────────────────── */
    const TIMER_PRESETS = {
        focus:      25 * 60,
        shortBreak:  5 * 60,
        longBreak:  15 * 60,
    };

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
     * Timer-Einstellungen sicher aus localStorage laden.
     * @returns {{ focus: number, shortBreak: number, longBreak: number }}
     */
    function loadTimerSettings() {
        try {
            const raw = localStorage.getItem(TIMER_SETTINGS_KEY);
            if (!raw) return { ...TIMER_PRESETS };
            const parsed = JSON.parse(raw);
            // Validierung: alle Werte müssen positive Zahlen zwischen 1 und 99 Minuten sein
            const valid = (v) => typeof v === 'number' && v >= 60 && v <= 99 * 60;
            return {
                focus:      valid(parsed.focus)      ? parsed.focus      : TIMER_PRESETS.focus,
                shortBreak: valid(parsed.shortBreak) ? parsed.shortBreak : TIMER_PRESETS.shortBreak,
                longBreak:  valid(parsed.longBreak)  ? parsed.longBreak  : TIMER_PRESETS.longBreak,
            };
        } catch {
            return { ...TIMER_PRESETS };
        }
    }

    function saveTimerSettings(settings) {
        try {
            localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(settings));
        } catch { /* silently fail */ }
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

    // Front-end and back-end field mapping functions
    function mapTypeToQuad(type) {
        switch (type) {
            case 'SOFORT':
                return 'q1';
            case 'STRATEGISCH':
                return 'q2';
            case 'OPERATIV':
                return 'q3';
            case 'WARTESCHLANGE':
                return 'q4';
            default:
                return 'q4';
        }
    }

    function mapQuadToType(quad) {
        switch (quad) {
            case 'q1':
                return 'SOFORT';
            case 'q2':
                return 'STRATEGISCH';
            case 'q3':
                return 'OPERATIV';
            case 'q4':
                return 'WARTESCHLANGE';
            default:
                return 'WARTESCHLANGE';
        }
    }

    function mapBackendTask(task) {
        return {
            id: String(task.id),
            title: task.title ?? '',
            desc: task.description ?? '',
            quad: mapTypeToQuad(task.type),
            date: task.dueDate ?? null,
            done: Boolean(task.completed),
            createdAt: task.createdAt ?? null,
            updatedAt: task.updatedAt ?? null,
        };
    }

    function mapFrontendTaskToBackend(task) {
        return {
            title: task.title,
            description: task.desc || '',
            type: mapQuadToType(task.quad),
            dueDate: task.quad === 'q2' ? (task.date || null) : null,
            completed: Boolean(task.done),
        };
    }

    // API request function
    async function fetchTasks() {
        const response = await fetch(API_BASE);

        if (!response.ok) {
            throw new Error('Aufgaben konnten nicht geladen werden.');
        }

        const data = await response.json();
        return data.map(mapBackendTask);
    }

    async function createTaskApi(task) {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mapFrontendTaskToBackend(task))
        });

        if (!response.ok) {
            throw new Error('Aufgabe konnte nicht erstellt werden.');
        }

        const data = await response.json();
        return mapBackendTask(data);
    }

    async function updateTaskApi(task) {
        const response = await fetch(`${API_BASE}/${task.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mapFrontendTaskToBackend(task))
        });

        if (!response.ok) {
            throw new Error('Aufgabe konnte nicht aktualisiert werden.');
        }

        const data = await response.json();
        return mapBackendTask(data);
    }

    async function toggleCompleteApi(id) {
        const response = await fetch(`${API_BASE}/${id}/complete`, {
            method: 'PATCH'
        });

        if (!response.ok) {
            throw new Error('Status konnte nicht geändert werden.');
        }

        const data = await response.json();
        return mapBackendTask(data);
    }

    async function deleteTaskApi(id) {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Aufgabe konnte nicht gelöscht werden.');
        }
    }

    async function loadTasksFromBackend() {
        try {
            State.db = await fetchTasks();
            render();
        } catch (err) {
            showToast(err.message, true);
        }
    }

    /* ── Applikations-State ────────────────────────────────────────── */
    const timerSettings = loadTimerSettings();

    const State = {
        db:            [],
        timerId:       null,
        timeLeft:      timerSettings.focus,
        timerMode:     'focus',            // 'focus' | 'shortBreak' | 'longBreak'
        timerSettings: timerSettings,
        chartObj:      null,
        toastTimer:    null,
        undoTimer:     null,               // Timeout für Undo-Fenster
        pendingUndo:   null,               // { task, index } — wartet auf Undo
        draggedId:     null,
        dragOverId:    null,               // für Intra-Quadrant-Sortierung
        prevFocus:     null,
        confirmFocus:  null,
        pendingDelete: null,
        settingsOpen:  false,
    };

    /* ── Toast (mit optionalem Undo-Button) ────────────────────────── */
    /**
     * Nicht-intrusive Status-Meldung.
     * @param {string}   msg
     * @param {boolean}  isError
     * @param {Function} undoFn   – wenn gesetzt, wird ein "Rückgängig"-Button gezeigt
     * @param {number}   duration – Anzeigedauer in ms (default 2500, mit Undo 5000)
     */
    function showToast(msg, isError = false, undoFn = null, duration = null) {
        const el = document.getElementById('toast');
        clearTimeout(State.toastTimer);

        el.replaceChildren();

        const text = document.createElement('span');
        text.textContent = msg;
        el.appendChild(text);

        if (undoFn) {
            const undoBtn = document.createElement('button');
            undoBtn.className   = 'toast__undo-btn';
            undoBtn.textContent = 'Rückgängig';
            undoBtn.setAttribute('aria-label', 'Löschen rückgängig machen');
            undoBtn.addEventListener('click', () => {
                clearTimeout(State.toastTimer);
                el.className = 'toast';
                el.replaceChildren();
                undoFn();
            });
            el.appendChild(undoBtn);
        }

        const ms = duration ?? (undoFn ? 5000 : 2500);
        el.className = 'toast toast--visible' + (isError ? ' toast--error' : '');
        State.toastTimer = setTimeout(() => { el.className = 'toast'; }, ms);
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
    function buildTaskNode(taskParam) {
        let task = taskParam; // let: lokale Kopie für Titel/Desc-Updates ohne Re-Render
        const node = document.createElement('div');
        node.className       = 'task-node';
        node.draggable       = true;
        node.dataset.id      = task.id;
        node.setAttribute('role', 'listitem');

        node.addEventListener('dragstart', e => {
            State.draggedId = task.id;
            e.dataTransfer.effectAllowed = 'move';
            requestAnimationFrame(() => node.classList.add('task-node--dragging'));
        });
        node.addEventListener('dragend', () => {
            State.draggedId  = null;
            State.dragOverId = null;
            node.classList.remove('task-node--dragging');
            document.querySelectorAll('.task-node--drag-over-top, .task-node--drag-over-bottom')
                .forEach(el => el.classList.remove('task-node--drag-over-top', 'task-node--drag-over-bottom'));
        });

        // ── Touch-Drag (Mobile) ────────────────────────────────
        let touchClone = null;
        let touchOffsetX = 0, touchOffsetY = 0;

        node.addEventListener('touchstart', e => {
            // Nur Drag wenn kein Input/Textarea fokussiert
            if (['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName)) return;
            const touch = e.touches[0];
            const rect  = node.getBoundingClientRect();
            touchOffsetX = touch.clientX - rect.left;
            touchOffsetY = touch.clientY - rect.top;

            State.draggedId = task.id;

            // Ghost-Klon erstellen
            touchClone = node.cloneNode(true);
            touchClone.className = 'task-node task-node--touch-ghost';
            touchClone.style.width  = rect.width + 'px';
            touchClone.style.left   = touch.clientX - touchOffsetX + 'px';
            touchClone.style.top    = touch.clientY - touchOffsetY + 'px';
            document.body.appendChild(touchClone);
            node.classList.add('task-node--dragging');
        }, { passive: true });

        node.addEventListener('touchmove', e => {
            if (!State.draggedId) return;
            e.preventDefault(); // Scrollen verhindern während Drag
            const touch = e.touches[0];

            // Ghost-Klon mitbewegen
            if (touchClone) {
                touchClone.style.left = touch.clientX - touchOffsetX + 'px';
                touchClone.style.top  = touch.clientY - touchOffsetY + 'px';
            }

            // Ziel-Element unter dem Finger ermitteln
            touchClone && (touchClone.style.display = 'none');
            const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            touchClone && (touchClone.style.display = '');

            if (!elUnder) return;

            // Drop-Zone Quadrant-Highlight
            const zone = elUnder.closest('.q-box');
            document.querySelectorAll('.q-box--dragover')
                .forEach(z => z.classList.remove('q-box--dragover'));
            if (zone) zone.classList.add('q-box--dragover');

            // Intra-Quadrant: Sortierungs-Indikator
            const targetNode = elUnder.closest('.task-node');
            document.querySelectorAll('.task-node--drag-over-top, .task-node--drag-over-bottom')
                .forEach(el => el.classList.remove('task-node--drag-over-top', 'task-node--drag-over-bottom'));

            if (targetNode && targetNode !== node && targetNode.dataset.id) {
                const targetTask = State.db.find(t => t.id === targetNode.dataset.id);
                const myTask     = State.db.find(t => t.id === State.draggedId);
                if (targetTask && myTask && targetTask.quad === myTask.quad) {
                    const r = targetNode.getBoundingClientRect();
                    targetNode.classList.add(
                        touch.clientY < r.top + r.height / 2
                            ? 'task-node--drag-over-top'
                            : 'task-node--drag-over-bottom'
                    );
                    State.dragOverId = targetTask.id;
                }
            }
        }, { passive: false });

        node.addEventListener('touchend', e => {
            if (!State.draggedId) return;
            const touch = e.changedTouches[0];

            // Ghost entfernen
            if (touchClone) { touchClone.remove(); touchClone = null; }
            node.classList.remove('task-node--dragging');
            document.querySelectorAll('.q-box--dragover')
                .forEach(z => z.classList.remove('q-box--dragover'));
            document.querySelectorAll('.task-node--drag-over-top, .task-node--drag-over-bottom')
                .forEach(el => el.classList.remove('task-node--drag-over-top', 'task-node--drag-over-bottom'));

            // Ziel-Element bestimmen (Ghost versteckt für korrektes elementFromPoint)
            const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            if (!elUnder) { State.draggedId = null; return; }

            const draggedTask = State.db.find(t => t.id === State.draggedId);
            if (!draggedTask) { State.draggedId = null; return; }

            // Fall 1: Intra-Quadrant (über anderer Task)
            if (State.dragOverId && State.dragOverId !== State.draggedId) {
                const targetTask = State.db.find(t => t.id === State.dragOverId);
                if (targetTask && targetTask.quad === draggedTask.quad) {
                    const targetEl = document.querySelector(`[data-id="${State.dragOverId}"]`);
                    const before   = targetEl
                        ? touch.clientY < targetEl.getBoundingClientRect().top + targetEl.getBoundingClientRect().height / 2
                        : false;
                    const newDb    = State.db.filter(t => t.id !== State.draggedId);
                    const idx      = newDb.findIndex(t => t.id === State.dragOverId);
                    newDb.splice(before ? idx : idx + 1, 0, draggedTask);
                    State.db = newDb;
                    saveToStorage(State.db);
                    State.draggedId = null; State.dragOverId = null;
                    render();
                    return;
                }
            }

            // Fall 2: Inter-Quadrant (über Quadrant-Box)
            const zone = elUnder.closest('.q-box');
            if (zone && zone.dataset.quad && zone.dataset.quad !== draggedTask.quad) {
                const newQuad = zone.dataset.quad;
                State.db = State.db.map(t =>
                    t.id === State.draggedId
                        ? { ...t, quad: newQuad, date: newQuad !== 'q2' ? null : t.date }
                        : t
                );
                saveToStorage(State.db);
                State.draggedId = null; State.dragOverId = null;
                render();
                return;
            }

            State.draggedId = null; State.dragOverId = null;
        });

        // Intra-Quadrant Sortierung: über anderen Tasks
        node.addEventListener('dragover', e => {
            if (!State.draggedId || State.draggedId === task.id) return;
            const draggedTask = State.db.find(t => t.id === State.draggedId);

            // Nur intra-Quadrant: stopPropagation nur wenn gleicher Quadrant
            if (draggedTask && draggedTask.quad === task.quad) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                const rect   = node.getBoundingClientRect();
                const middle = rect.top + rect.height / 2;
                document.querySelectorAll('.task-node--drag-over-top, .task-node--drag-over-bottom')
                    .forEach(el => el.classList.remove('task-node--drag-over-top', 'task-node--drag-over-bottom'));
                node.classList.add(e.clientY < middle ? 'task-node--drag-over-top' : 'task-node--drag-over-bottom');
                State.dragOverId = task.id;
            }
            // Inter-Quadrant: kein stopPropagation → Quadrant-Drop-Zone übernimmt
        });

        node.addEventListener('dragleave', e => {
            if (!node.contains(e.relatedTarget)) {
                node.classList.remove('task-node--drag-over-top', 'task-node--drag-over-bottom');
            }
        });

        node.addEventListener('drop', e => {
            if (!State.draggedId || State.draggedId === task.id) return;
            const draggedTask = State.db.find(t => t.id === State.draggedId);
            if (!draggedTask || draggedTask.quad !== task.quad) return;

            e.preventDefault();
            e.stopPropagation();

            const rect    = node.getBoundingClientRect();
            const middle  = rect.top + rect.height / 2;
            const before  = e.clientY < middle;

            // Sortierung im Array umschichten
            const newDb   = State.db.filter(t => t.id !== State.draggedId);
            const dropIdx = newDb.findIndex(t => t.id === task.id);
            const insertAt = before ? dropIdx : dropIdx + 1;
            newDb.splice(insertAt, 0, draggedTask);

            State.db = newDb;
            saveToStorage(State.db);
            State.draggedId  = null;
            State.dragOverId = null;
            render();
        });

        /* ── Erledigt-Button ──────────────────────────────────── */
        const doneBtn = document.createElement('button');
        doneBtn.className = 'task-done-btn';
        const shortTitle = task.title.length > 50
            ? task.title.slice(0, 47).trimEnd() + '…'
            : task.title;
        doneBtn.setAttribute('aria-label', `„${shortTitle}" als erledigt markieren`);
        doneBtn.innerHTML  = '<i data-lucide="circle" width="18" height="18" aria-hidden="true"></i>';
        doneBtn.addEventListener('click', () => toggleDone(task.id));

        /* ── Body: Titel + Datum ──────────────────────────────── */
        const body = document.createElement('div');
        body.className = 'task-body';

        // Klick-zum-Bearbeiten: <span> + versteckter <input>
        // Kein contentEditable → kein HTML-Inject-Risiko, kein ungewolltes Mobile-Keyboard
        const titleSpan = document.createElement('span');
        titleSpan.className   = 'task-text';
        titleSpan.textContent = task.title;

        const titleInput = document.createElement('input');
        titleInput.type        = 'text';
        titleInput.className   = 'task-text-input';
        titleInput.value       = task.title;
        titleInput.maxLength   = 200;
        titleInput.setAttribute('aria-label', 'Aufgabentitel bearbeiten');
        titleInput.hidden = true;

        // Span-Klick → Bearbeitungsmodus aktivieren
        titleSpan.addEventListener('click', () => {
            titleSpan.hidden  = true;
            titleInput.hidden = false;
            titleInput.value  = task.title;
            titleInput.focus();
            titleInput.select();
        });

        // Doppelklick für Touch-Geräte (verhindert unbeabsichtigtes Aktivieren)
        // Einmaliger Klick bleibt für Desktop
        const commitTitle = () => {
            const val = titleInput.value.trim();
            titleInput.hidden = false;
            if (val && val !== task.title) {
                updateField(task.id, 'title', val);
                const newShort = val.length > 50 ? val.slice(0, 47).trimEnd() + '…' : val;
                doneBtn.setAttribute('aria-label',   `„${newShort}" als erledigt markieren`);
                deleteBtn.setAttribute('aria-label', `„${newShort}" löschen`);
                titleSpan.textContent = val;
                task = { ...task, title: val };
            } else {
                titleInput.value = task.title;
            }
            titleInput.hidden = true;
            titleSpan.hidden  = false;
        };

        titleInput.addEventListener('blur',    commitTitle);
        titleInput.addEventListener('keydown', e => {
            if (e.key === 'Enter')  { e.preventDefault(); titleInput.blur(); }
            if (e.key === 'Escape') { titleInput.value = task.title; titleInput.blur(); }
        });

        body.appendChild(titleSpan);
        body.appendChild(titleInput);

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
        deleteBtn.setAttribute('aria-label', `„${shortTitle}" löschen`);
        deleteBtn.innerHTML = '<i data-lucide="trash-2" width="15" height="15" aria-hidden="true"></i>';
        // Löschen direkt (Undo im Toast statt Confirm-Dialog)
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        const main = document.createElement('div');
        main.className = 'task-main';
        main.appendChild(doneBtn);
        main.appendChild(body);
        main.appendChild(deleteBtn);
        node.appendChild(main);

        /* ── Beschreibung ─────────────────────────────────────── */
        // Klick-zum-Bearbeiten mit <textarea> — kein contentEditable
        const hasDesc = task.desc && task.desc.trim().length > 0;

        const descSpan = document.createElement('div');
        descSpan.className = 'task-desc task-desc--preview';
        descSpan.textContent = hasDesc ? task.desc : 'Details hinzufügen …';
        if (!hasDesc) descSpan.classList.add('task-desc--placeholder');

        const descArea = document.createElement('textarea');
        descArea.className  = 'task-desc task-desc--edit';
        descArea.value      = task.desc || '';
        descArea.maxLength  = 1000;
        descArea.rows       = 3;
        descArea.setAttribute('aria-label', 'Aufgabendetails bearbeiten');
        descArea.hidden = true;

        descSpan.addEventListener('click', () => {
            descSpan.hidden = true;
            descArea.hidden = false;
            descArea.value  = task.desc || '';
            descArea.focus();
        });

        const commitDesc = () => {
            const val = descArea.value.trim();
            if (val !== (task.desc || '')) {
                updateField(task.id, 'desc', val);
                task = { ...task, desc: val };
            }
            descSpan.textContent = val || 'Details hinzufügen …';
            descSpan.classList.toggle('task-desc--placeholder', !val);
            descArea.hidden = true;
            descSpan.hidden = false;
        };

        descArea.addEventListener('blur', commitDesc);
        descArea.addEventListener('keydown', e => {
            // Shift+Enter = Zeilenumbruch; Escape = verwerfen
            if (e.key === 'Escape') { descArea.value = task.desc || ''; descArea.blur(); }
        });

        node.appendChild(descSpan);
        node.appendChild(descArea);
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

            // Hilfsfunktion: Titel für aria-label auf 50 Zeichen kürzen
            // → Screen-Reader liest nicht 200-Zeichen-Titel vor
            const shortTitle = task.title.length > 50
                ? task.title.slice(0, 47).trimEnd() + '…'
                : task.title;

            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'task-done-btn';
            restoreBtn.style.color = 'var(--color-q2)';
            restoreBtn.setAttribute('aria-label', `„${shortTitle}" als offen markieren (Archiv)`);
            restoreBtn.innerHTML = '<i data-lucide="check-circle-2" width="18" height="18" aria-hidden="true"></i>';
            restoreBtn.addEventListener('click', () => toggleDone(task.id));

            const titleEl = document.createElement('span');
            titleEl.className   = 'task-text';
            titleEl.textContent = task.title;
            // Vollständiger Titel für Screen-Reader sichtbar im Textknoten — kein aria-label nötig

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'task-delete-btn';
            // Kontext "im Archiv" verhindert Verwechslung mit aktivem Löschen
            deleteBtn.setAttribute('aria-label', `„${shortTitle}" dauerhaft aus dem Archiv löschen`);
            deleteBtn.innerHTML = '<i data-lucide="trash-2" width="15" height="15" aria-hidden="true"></i>';
            deleteBtn.addEventListener('click', () => deleteTask(task.id));

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
     * Balkendiagramm: beim ersten Aufruf erstellen, danach nur Daten
     * und chart.update() — kein destroy/recreate mehr pro Tab-Wechsel.
     */
    function renderChart() {
        if (!window.Chart) return; // Guard: Chart.js nicht geladen

        const openData = VALID_QUADS.map(q => State.db.filter(t => t.quad === q && !t.done).length);
        const doneData = VALID_QUADS.map(q => State.db.filter(t => t.quad === q &&  t.done).length);

        if (State.chartObj) {
            // Nur Daten aktualisieren — kein Rebuild
            State.chartObj.data.datasets[0].data = openData;
            State.chartObj.data.datasets[1].data = doneData;
            State.chartObj.update('active');
            return;
        }

        // Einmaliger Erstaufbau
        const ctx    = document.getElementById('prodChart').getContext('2d');
        const colors = ['#ef4444', '#22c55e', '#f59e0b', '#71717a'];

        State.chartObj = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Sofort erledigen', 'Strategische Planung', 'Operative Aufgaben', 'Warteschlange'],
                datasets: [
                    {
                        label:           'Offen',
                        data:            openData,
                        backgroundColor: colors.map(c => c + 'bb'),
                        borderColor:     colors,
                        borderWidth:     1,
                        borderRadius:    6,
                    },
                    {
                        label:           'Erledigt',
                        data:            doneData,
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
                animation:           { duration: 400 },
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
    async function addTask() {
        const titleInput = document.getElementById('m-title');
        const titleError = document.getElementById('m-title-error');
        const title = titleInput.value.trim();

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

        const newTask = {
            title,
            desc: document.getElementById('m-desc').value.trim(),
            quad,
            date: (quad === 'q2' && date) ? date : null,
            done: false,
        };

        try {
            const createdTask = await createTaskApi(newTask);
            State.db = [...State.db, createdTask];
            closeModal();
            render();
            showToast(`"${createdTask.title}" wurde erstellt.`);
        } catch (err) {
            showToast(err.message, true);
        }
    }

    /** Erledigungsstatus umschalten. Immutable Update. */
    async function toggleDone(id) {
        try {
            const updatedTask = await toggleCompleteApi(id);
            State.db = State.db.map(t => t.id === id ? updatedTask : t);
            render();
        } catch (err) {
            showToast(err.message, true);
        }
    }

    /**
     * Einzelfeld nach Inline-Bearbeitung aktualisieren.
     * Immutable Update — konsistent mit allen anderen Operationen.
     * Kein render() → würde Fokus und Cursor-Position verlieren.
     */
    async function updateField(id, field, value) {
        const task = State.db.find(t => t.id === id);
        if (!task) return;

        const updatedTask = {
            ...task,
            [field]: value
        };

        try {
            const savedTask = await updateTaskApi(updatedTask);
            State.db = State.db.map(t => t.id === id ? savedTask : t);
            renderMatrix();
            renderArchive();
            renderStats();
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            showToast(err.message, true);
        }
    }

    /** Aufgabe löschen mit 5-Sekunden-Undo vor endgültigem Backend-Delete. */
    function deleteTask(id) {
        const idx = State.db.findIndex(t => t.id === id);
        if (idx === -1) return;

        const task = State.db[idx];

        // If the previous deletion hasn't been truly committed to the backend yet, commit it first.
        if (State.pendingUndo) {
            finalizePendingDelete();
        }

        // Remove from the front-end interface first
        State.db = State.db.filter(t => t.id !== id);
        render();

        // Save information to be revoked
        State.pendingUndo = { task, index: idx };

        // A 5-second countdown will begin; the database will be truly deleted after the timeout.
        clearTimeout(State.undoTimer);
        State.undoTimer = setTimeout(async () => {
            await finalizePendingDelete();
        }, 5000);

        showToast(
            `"${task.title}" gelöscht.`,
            false,
            () => undoDelete()
        );
    }

    function undoDelete() {
        if (!State.pendingUndo) return;

        clearTimeout(State.undoTimer);

        const { task, index } = State.pendingUndo;
        const newDb = [...State.db];
        const safeIndex = Math.min(index, newDb.length);

        newDb.splice(safeIndex, 0, task);
        State.db = newDb;

        State.pendingUndo = null;
        State.undoTimer = null;

        render();
        showToast(`"${task.title}" wiederhergestellt.`);
    }

    async function finalizePendingDelete() {
        if (!State.pendingUndo) return;

        const { task } = State.pendingUndo;

        try {
            await deleteTaskApi(task.id);
            State.pendingUndo = null;
            State.undoTimer = null;
        } catch (err) {
            // If the backend deletion fails, restore the task to the interface.
            const exists = State.db.some(t => t.id === task.id);
            if (!exists) {
                State.db = [...State.db, task];
                render();
            }

            State.pendingUndo = null;
            State.undoTimer = null;

            showToast(err.message, true);
        }
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
                if (!zone.contains(e.relatedTarget)) {
                    zone.classList.remove('q-box--dragover');
                }
            });

            zone.addEventListener('drop', async e => {
                e.preventDefault();
                zone.classList.remove('q-box--dragover');

                const draggedId = State.draggedId;
                if (!draggedId) return;

                const task = State.db.find(t => t.id === draggedId);
                if (!task) {
                    State.draggedId = null;
                    return;
                }

                // If it's moved back to its original quadrant, no request will be made to the backend.
                if (task.quad === quad) {
                    State.draggedId = null;
                    return;
                }

                const updatedTask = {
                    ...task,
                    quad: quad,
                    date: quad === 'q2' ? task.date : null
                };

                try {
                    const savedTask = await updateTaskApi(updatedTask);

                    State.db = State.db.map(t =>
                        t.id === draggedId ? savedTask : t
                    );

                    // This explicitly refreshes several areas, which is more stable than simply using `render()`.
                    renderMatrix();
                    renderArchive();
                    renderStats();

                    if (window.lucide) lucide.createIcons();
                } catch (err) {
                    showToast(err.message, true);
                } finally {
                    State.draggedId = null;
                    State.dragOverId = null;

                    document.querySelectorAll('.q-box--dragover').forEach(el =>
                        el.classList.remove('q-box--dragover')
                    );

                    document.querySelectorAll('.task-node--drag-over-top, .task-node--drag-over-bottom').forEach(el =>
                        el.classList.remove('task-node--drag-over-top', 'task-node--drag-over-bottom')
                    );
                }
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
                document.getElementById('timer-display').setAttribute('aria-live', 'assertive');
                const modeLabel = State.timerMode === 'focus' ? 'Fokus-Session' :
                                  State.timerMode === 'shortBreak' ? 'Kurzpause' : 'Langpause';
                showToast(`⏱ ${modeLabel} abgeschlossen!`);
                document.title = '✅ Fertig! — Aura Matrix';
            }
        }, 1000);
    }

    function pauseTimer() {
        clearInterval(State.timerId);
        State.timerId  = null;
        document.title = TITLE_ORIG; // Immer zurücksetzen — auch nach Ablauf (✅ Fertig!)
    }

    function resetTimer(mode) {
        pauseTimer();
        State.timerMode = mode || State.timerMode;
        State.timeLeft  = State.timerSettings[State.timerMode];
        document.getElementById('timer-ui').classList.remove('timer-ui--done');
        document.getElementById('timer-display').setAttribute('aria-live', 'off');
        updateTimerDisplay();
        // Timer-Mode-Buttons aktualisieren
        document.querySelectorAll('.timer-mode-btn').forEach(btn => {
            btn.classList.toggle('timer-mode-btn--active', btn.dataset.mode === State.timerMode);
        });
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

    /** PDF-Export — strukturiertes Layout mit farbigen Sektionen und Header. */
    function exportPDF() {
        if (!window.jspdf) { showToast('jsPDF nicht geladen.', true); return; }
        const { jsPDF } = window.jspdf;
        const doc   = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.width;
        const pageH = doc.internal.pageSize.height;
        const margin = 18;
        const contentW = pageW - margin * 2;
        let y = 0;

        // ── Farbpalette ────────────────────────────────────────────────
        const COLORS = {
            bg:      [3,   3,   5],
            accent:  [59,  130, 246],
            q1:      [239, 68,  68],
            q2:      [34,  197, 94],
            q3:      [245, 158, 11],
            q4:      [113, 113, 122],
            white:   [255, 255, 255],
            gray:    [161, 161, 170],
            darkCard:[18,  18,  22],
        };

        const setRGB = (arr) => doc.setTextColor(...arr);
        const fillRGB = (arr) => doc.setFillColor(...arr);
        const drawRGB = (arr) => doc.setDrawColor(...arr);

        const checkPage = (neededH = 12) => {
            if (y + neededH > pageH - margin) {
                doc.addPage();
                drawHeader();
                y = 42;
            }
        };

        // ── Kopfzeile ──────────────────────────────────────────────────
        function drawHeader() {
            // Dunkler Hintergrundbalken
            fillRGB(COLORS.bg);
            doc.rect(0, 0, pageW, 28, 'F');

            // Akzentlinie unten
            fillRGB(COLORS.accent);
            doc.rect(0, 26, pageW, 2, 'F');

            // Titel
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            setRGB(COLORS.white);
            doc.text('AURA MATRIX', margin, 12);

            // Untertitel
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            setRGB(COLORS.accent);
            doc.text('PROFESSIONAL FOCUS OS  ·  STATUSBERICHT', margin, 18);

            // Datum rechts
            doc.setFontSize(8);
            setRGB(COLORS.gray);
            const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
            doc.text(dateStr, pageW - margin, 18, { align: 'right' });
        }

        // ── Stat-Zusammenfassung ───────────────────────────────────────
        function drawSummary() {
            const total  = State.db.length;
            const done   = State.db.filter(t => t.done).length;
            const open   = total - done;
            const pct    = total ? Math.round((done / total) * 100) : 0;

            y = 34;
            const boxW  = (contentW - 6) / 3;
            const stats = [
                { label: 'Gesamt',       val: String(total), color: COLORS.accent },
                { label: 'Erledigt',     val: String(done),  color: COLORS.q2 },
                { label: 'Fortschritt',  val: pct + '%',     color: COLORS.q3 },
            ];

            stats.forEach(({ label, val, color }, i) => {
                const x = margin + i * (boxW + 3);
                fillRGB([24, 24, 28]);
                drawRGB([45, 45, 55]);
                doc.setLineWidth(0.3);
                doc.roundedRect(x, y, boxW, 18, 2, 2, 'FD');

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                setRGB(color);
                doc.text(val, x + boxW / 2, y + 10, { align: 'center' });

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                setRGB(COLORS.gray);
                doc.text(label.toUpperCase(), x + boxW / 2, y + 15.5, { align: 'center' });
            });
            y += 24;
        }

        // ── Quadrant-Sektion ───────────────────────────────────────────
        const QUADS = [
            { label: 'Sofort erledigen',     quad: 'q1', color: COLORS.q1 },
            { label: 'Strategische Planung', quad: 'q2', color: COLORS.q2 },
            { label: 'Operative Aufgaben',   quad: 'q3', color: COLORS.q3 },
            { label: 'Warteschlange',        quad: 'q4', color: COLORS.q4 },
        ];

        function drawQuadSection({ label, quad, color }) {
            const tasks = State.db.filter(t => t.quad === quad);
            if (!tasks.length) return;

            checkPage(20);

            // Sektion-Header
            fillRGB(color);
            doc.rect(margin, y, 3, 8, 'F');
            fillRGB([24, 24, 28]);
            doc.rect(margin + 3, y, contentW - 3, 8, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            setRGB(color);
            doc.text(label.toUpperCase(), margin + 7, y + 5.5);

            // Aufgaben-Anzahl rechts
            const openCount = tasks.filter(t => !t.done).length;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            setRGB(COLORS.gray);
            doc.text(`${openCount} offen  ·  ${tasks.filter(t => t.done).length} erledigt`, pageW - margin, y + 5.5, { align: 'right' });

            y += 10;

            tasks.forEach(t => {
                const rowH = t.desc ? 12 : 8;
                checkPage(rowH + 2);

                // Zebrastreifen
                fillRGB(tasks.indexOf(t) % 2 === 0 ? [16, 16, 20] : [20, 20, 25]);
                doc.rect(margin, y, contentW, rowH, 'F');

                // Status-Indikator (Kreis)
                drawRGB(t.done ? COLORS.q2 : color);
                doc.setLineWidth(0.5);
                doc.circle(margin + 4.5, y + rowH / 2, 1.8, t.done ? 'FD' : 'D');
                if (t.done) { // Häkchen
                    doc.setLineWidth(0.4);
                    drawRGB(COLORS.bg);
                    doc.line(margin + 3.7, y + rowH / 2, margin + 4.3, y + rowH / 2 + 0.8);
                    doc.line(margin + 4.3, y + rowH / 2 + 0.8, margin + 5.3, y + rowH / 2 - 0.6);
                }

                // Titel
                doc.setFont('helvetica', t.done ? 'normal' : 'bold');
                doc.setFontSize(8.5);
                setRGB(t.done ? COLORS.gray : COLORS.white);
                const titleX = margin + 9;
                const titleW = contentW - 9 - (t.date ? 28 : 2);
                const titleLines = doc.splitTextToSize(t.title, titleW);
                doc.text(titleLines[0], titleX, y + (t.desc ? 5.5 : rowH / 2 + 1.5));

                // Datum rechts
                if (t.date) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    setRGB(COLORS.q2);
                    doc.text(formatDate(t.date), pageW - margin - 1, y + (t.desc ? 5.5 : rowH / 2 + 1.5), { align: 'right' });
                }

                // Beschreibung
                if (t.desc) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    setRGB(COLORS.gray);
                    const descLines = doc.splitTextToSize(t.desc, contentW - 12);
                    doc.text(descLines[0], titleX, y + 9.5);
                }

                y += rowH;
            });
            y += 6;
        }

        // ── Aufbau ────────────────────────────────────────────────────
        drawHeader();
        drawSummary();
        QUADS.forEach(drawQuadSection);

        // ── Fußzeile letzte Seite ──────────────────────────────────────
        fillRGB([12, 12, 15]);
        doc.rect(0, pageH - 10, pageW, 10, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        setRGB(COLORS.gray);
        doc.text('Aura Matrix 1.0  ·  Generiert am ' + new Date().toLocaleString('de-DE'), margin, pageH - 4);
        doc.text(`Seite ${doc.getCurrentPageInfo().pageNumber}`, pageW - margin, pageH - 4, { align: 'right' });

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

    /* ── Timer Settings Panel ──────────────────────────────────────── */

    function openTimerSettings() {
        const s = State.timerSettings;
        document.getElementById('setting-focus').value      = Math.round(s.focus / 60);
        document.getElementById('setting-short').value      = Math.round(s.shortBreak / 60);
        document.getElementById('setting-long').value       = Math.round(s.longBreak / 60);
        document.getElementById('timer-settings-panel').classList.add('timer-settings--open');
        requestAnimationFrame(() => document.getElementById('setting-focus').focus());
    }

    function closeTimerSettings() {
        document.getElementById('timer-settings-panel').classList.remove('timer-settings--open');
    }

    function saveTimerSettingsFromPanel() {
        const focusMin = parseInt(document.getElementById('setting-focus').value, 10);
        const shortMin = parseInt(document.getElementById('setting-short').value, 10);
        const longMin  = parseInt(document.getElementById('setting-long').value, 10);

        // Validierung
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const newSettings = {
            focus:      clamp(isNaN(focusMin) ? 25 : focusMin, 1, 99) * 60,
            shortBreak: clamp(isNaN(shortMin) ?  5 : shortMin, 1, 60) * 60,
            longBreak:  clamp(isNaN(longMin)  ? 15 : longMin,  1, 60) * 60,
        };

        State.timerSettings = newSettings;
        saveTimerSettings(newSettings);
        closeTimerSettings();

        // Timer zurücksetzen mit neuen Einstellungen
        resetTimer();
        showToast('Timer-Einstellungen gespeichert.');
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
        document.getElementById('btn-timer-reset').addEventListener('click', () => resetTimer());

        // Timer-Mode-Buttons (Fokus / Kurzpause / Langpause)
        document.querySelectorAll('.timer-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                pauseTimer();
                resetTimer(btn.dataset.mode);
            });
        });

        // Timer-Settings Panel
        document.getElementById('btn-timer-settings').addEventListener('click', openTimerSettings);
        document.getElementById('btn-settings-close').addEventListener('click', closeTimerSettings);
        document.getElementById('btn-settings-cancel').addEventListener('click', closeTimerSettings);
        document.getElementById('btn-settings-save').addEventListener('click', saveTimerSettingsFromPanel);
        document.getElementById('timer-settings-panel').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeTimerSettings();
        });
        document.getElementById('timer-settings-panel').addEventListener('keydown', e => {
            if (e.key === 'Escape') closeTimerSettings();
        });

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

        // Globale Tastatur-Events: Escape schließt das oberste offene Dialog
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            const settingsOpen = document.getElementById('timer-settings-panel')
                .classList.contains('timer-settings--open');
            const modalOpen    = document.getElementById('modal')
                .classList.contains('modal--open');

            if (settingsOpen) { closeTimerSettings(); return; }
            if (modalOpen)    { closeModal();          return; }
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
    window.addEventListener('load', async () => {
        setupEventListeners();
        setupDropZones();

        document.querySelectorAll('.timer-mode-btn').forEach(btn => {
            btn.classList.toggle('timer-mode-btn--active', btn.dataset.mode === State.timerMode);
        });

        updateTimerDisplay();
        await loadTasksFromBackend();
    });

})(); // Ende IIFE
