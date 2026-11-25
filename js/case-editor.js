/**
 * MedCheck – Creator Inline Case Editor V1.0 (js/case-editor.js)
 * Ermöglicht dem Creator 1-Klick-Bearbeitung direkt in der Fallansicht
 * mit Live-Hotspot-Integritätsprüfung und globaler Supabase-Synchronisation.
 */

const CaseEditorModule = (() => {
    const FALLBACK_CREATOR_EMAIL = 'marco.claudio.nani@gmail.com';

    let isEditing = false;
    let isSaving = false;
    let hasUnsavedChanges = false;
    let verifiedDbCreator = null; // null = ungeprüft, true/false = geprüft
    let verifiedUserId = null;

    let draftCase = null;
    let activeEditorTab = 'cornell'; // 'meta' | 'cornell' | 'audit' | 'quiz' | 'flashcards' | 'doctordle' | 'json'
    let jsonRawDraft = '';
    let jsonParseError = '';
    let savedPaneDisplays = [];

    // ----------------------------------------------------------------------
    // HELPER: CASE-ZUGRIFF, CLONE, ESCAPING & SUPABASE
    // ----------------------------------------------------------------------
    function getSb() {
        return window.supabaseClient || window.supabase || window.sb || null;
    }

    function getActiveCaseObj() {
        if (window.activeCaseData && typeof window.activeCaseData === 'object') {
            return window.activeCaseData;
        }
        try {
            if (typeof activeCaseData !== 'undefined' && activeCaseData && typeof activeCaseData === 'object') {
                return activeCaseData;
            }
        } catch (_e) {}
        return null;
    }

    function setActiveCaseObj(updated) {
        window.activeCaseData = updated;
        try {
            if (typeof activeCaseData !== 'undefined') {
                activeCaseData = updated;
            }
        } catch (_e) {}
    }

    function getCurrentPlayerTab() {
        try {
            if (typeof currentActiveChallenge !== 'undefined' && currentActiveChallenge) {
                return currentActiveChallenge;
            }
        } catch (_e) {}
        const activeBtn = document.querySelector('.challenge-tab-btn.active');
        if (activeBtn && activeBtn.id) {
            return activeBtn.id.replace('tab-btn-', '');
        }
        return 'overview';
    }

    function deepClone(obj) {
        if (typeof structuredClone === 'function') {
            return structuredClone(obj);
        }
        return JSON.parse(JSON.stringify(obj));
    }

    function esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCurrentUserObj() {
        return window.currentSession?.user || window.currentSessionUser || null;
    }

    function isCreatorEmailMatch(user) {
        if (!user || !user.email) return false;
        const expected = (typeof CREATOR_EMAIL !== 'undefined' && CREATOR_EMAIL)
            ? CREATOR_EMAIL
            : FALLBACK_CREATOR_EMAIL;
        return user.email.toLowerCase() === expected.toLowerCase();
    }

    async function verifyCreatorAccess() {
        const sb = getSb();
        let user = getCurrentUserObj();

        if (!user && sb?.auth) {
            try {
                const { data } = await sb.auth.getSession();
                user = data?.session?.user || null;
            } catch (_e) {}
        }

        if (!user) {
            verifiedDbCreator = false;
            verifiedUserId = null;
            return false;
        }

        if (verifiedUserId === user.id && verifiedDbCreator !== null) {
            return verifiedDbCreator;
        }

        // Schneller Vorab-Check über DB-Rolle, mit Fallback auf Creator-E-Mail
        let isAllowed = isCreatorEmailMatch(user);
        if (sb) {
            try {
                const { data, error } = await sb
                    .from('user_profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!error && data && typeof data.role === 'string') {
                    isAllowed = data.role === 'creator' || isAllowed;
                }
            } catch (_e) {}
        }

        verifiedUserId = user.id;
        verifiedDbCreator = isAllowed;
        return isAllowed;
    }

    async function syncCreatorButtonVisibility() {
        const btn = document.getElementById('btn-creator-edit-case');
        if (!btn) return;

        const allowed = await verifyCreatorAccess();
        btn.style.display = allowed ? 'inline-flex' : 'none';
        btn.classList.toggle('is-editing-active', isEditing);
        btn.innerHTML = isEditing ? '✕ Bearbeitung beenden' : '✏️ Bearbeiten';
    }

    // ----------------------------------------------------------------------
    // STYLES (DARK- & BRIGHT-MODE-KOMPATIBEL ÜBER CSS-VARIABLEN)
    // ----------------------------------------------------------------------
    function injectStyles() {
        if (document.getElementById('mc-case-editor-css')) return;
        const style = document.createElement('style');
        style.id = 'mc-case-editor-css';
        style.textContent = `
            #creator-case-editor-root {
                display: flex;
                flex-direction: column;
                gap: 16px;
                margin-top: 8px;
                animation: ceFadeIn 0.18s ease;
            }
            @keyframes ceFadeIn {
                from { opacity: 0; transform: translateY(4px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .ce-sticky-bar {
                position: sticky;
                top: 10px;
                z-index: 40;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                padding: 12px 16px;
                border-radius: 14px;
                background: var(--surface-primary, #0f172a);
                border: 1.5px solid var(--accent-cyan, #38bdf8);
                box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
            }
            .ce-bar-left {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .ce-badge-live {
                font-size: 0.72rem;
                font-weight: 800;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                padding: 4px 10px;
                border-radius: 999px;
                background: rgba(56, 189, 248, 0.16);
                color: var(--accent-cyan, #38bdf8);
                border: 1px solid rgba(56, 189, 248, 0.35);
            }
            .ce-unsaved-dot {
                font-size: 0.76rem;
                font-weight: 700;
                color: var(--warning, #f59e0b);
            }
            .ce-bar-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .ce-subnav {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                padding: 6px;
                border-radius: 12px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.55));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.2));
            }
            .ce-tab-btn {
                padding: 7px 12px;
                border-radius: 8px;
                border: 1px solid transparent;
                background: transparent;
                color: var(--text-muted, #94a3b8);
                font-size: 0.8rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .ce-tab-btn:hover {
                color: var(--text-main, #f8fafc);
                background: rgba(148, 163, 184, 0.1);
            }
            .ce-tab-btn.active {
                background: var(--badge-primary-bg, rgba(56, 189, 248, 0.16));
                color: var(--badge-primary-text, #38bdf8);
                border-color: var(--accent-cyan, #38bdf8);
            }
            .ce-card {
                background: var(--surface-primary, #0f172a);
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.22));
                border-radius: 14px;
                padding: 16px 18px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .ce-card-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                flex-wrap: wrap;
                border-bottom: 1px solid var(--border-subtle, rgba(148, 163, 184, 0.14));
                padding-bottom: 10px;
            }
            .ce-card-title {
                font-size: 0.92rem;
                font-weight: 800;
                color: var(--text-main, #f8fafc);
            }
            .ce-grid-2 {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 12px;
            }
            .ce-cornell-row {
                display: grid;
                grid-template-columns: minmax(200px, 28%) 1fr;
                gap: 14px;
                align-items: start;
            }
            @media (max-width: 760px) {
                .ce-cornell-row {
                    grid-template-columns: 1fr;
                }
            }
            .ce-field {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            .ce-label {
                font-size: 0.74rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: var(--text-muted, #94a3b8);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            .ce-input,
            .ce-textarea,
            .ce-select {
                width: 100%;
                box-sizing: border-box;
                padding: 9px 12px;
                border-radius: 9px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.28));
                background: var(--surface-secondary, rgba(6, 9, 19, 0.55));
                color: var(--text-main, #f8fafc);
                font-family: inherit;
                font-size: 0.88rem;
                line-height: 1.55;
                transition: border-color 0.15s ease;
            }
            .ce-textarea {
                min-height: 96px;
                resize: vertical;
            }
            .ce-textarea.ce-mono {
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.8rem;
                min-height: 420px;
                line-height: 1.5;
            }
            .ce-input:focus,
            .ce-textarea:focus,
            .ce-select:focus {
                outline: none;
                border-color: var(--accent-cyan, #38bdf8);
            }
            .ce-format-bar {
                display: flex;
                gap: 5px;
                flex-wrap: wrap;
                margin-bottom: 4px;
            }
            .ce-fmt-btn {
                padding: 3px 8px;
                font-size: 0.72rem;
                font-weight: 700;
                border-radius: 6px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.28));
                background: var(--surface-secondary, rgba(15, 23, 42, 0.6));
                color: var(--text-main, #f8fafc);
                cursor: pointer;
            }
            .ce-fmt-btn:hover {
                border-color: var(--accent-cyan, #38bdf8);
                color: var(--accent-cyan, #38bdf8);
            }
            .ce-hotspot-box {
                padding: 12px;
                border-radius: 10px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.2));
                background: var(--surface-secondary, rgba(15, 23, 42, 0.35));
                display: flex;
                flex-direction: column;
                gap: 9px;
            }
            .ce-hotspot-box.is-error-hs {
                border-left: 3px solid var(--error, #ef4444);
            }
            .ce-hotspot-box.is-ok-hs {
                border-left: 3px solid var(--success, #10b981);
            }
            .ce-match-pill {
                font-size: 0.7rem;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 999px;
            }
            .ce-match-pill.ok {
                background: rgba(16, 185, 129, 0.16);
                color: var(--success, #10b981);
            }
            .ce-match-pill.warn {
                background: rgba(245, 158, 11, 0.18);
                color: var(--warning, #f59e0b);
            }
            .ce-status-banner {
                padding: 10px 14px;
                border-radius: 10px;
                font-size: 0.83rem;
                font-weight: 600;
                display: none;
            }
            .ce-status-banner.visible {
                display: block;
            }
            .ce-status-banner.error {
                background: rgba(239, 68, 68, 0.14);
                border: 1px solid rgba(239, 68, 68, 0.45);
                color: var(--error, #fca5a5);
            }
            .ce-status-banner.warn {
                background: rgba(245, 158, 11, 0.14);
                border: 1px solid rgba(245, 158, 11, 0.45);
                color: var(--warning, #fcd34d);
            }
            .ce-status-banner.success {
                background: rgba(16, 185, 129, 0.14);
                border: 1px solid rgba(16, 185, 129, 0.45);
                color: var(--success, #6ee7b7);
            }
            .ce-danger-mini {
                padding: 4px 9px;
                font-size: 0.72rem;
                font-weight: 700;
                border-radius: 7px;
                border: 1px solid rgba(239, 68, 68, 0.35);
                background: rgba(239, 68, 68, 0.1);
                color: var(--error, #ef4444);
                cursor: pointer;
            }
            .ce-danger-mini:hover {
                background: rgba(239, 68, 68, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

    // ----------------------------------------------------------------------
    // MODUS-STEUERUNG (ÖFFNEN / SCHLIESSEN / TAB-MAPPING)
    // ----------------------------------------------------------------------
    function mapPlayerTabToEditorTab(playerTab) {
        switch (playerTab) {
            case 'overview': return 'cornell';
            case 'audit': return 'audit';
            case 'quiz': return 'quiz';
            case 'flashcards': return 'flashcards';
            case 'doctordle': return 'doctordle';
            case 'synapses':
            case 'cascade':
            case 'cat':
                return 'json';
            default:
                return 'cornell';
        }
    }

    function hideOriginalPlayerPanes() {
        const playerView = document.getElementById('player-view');
        if (!playerView) return;

        savedPaneDisplays = [];
        playerView.querySelectorAll('.challenge-nav-bar, .player-mode-pane, #finish-case-btn').forEach(el => {
            savedPaneDisplays.push({ el, display: el.style.display });
            el.style.display = 'none';
        });
    }

    function restoreOriginalPlayerPanes() {
        savedPaneDisplays.forEach(({ el, display }) => {
            if (el) el.style.display = display;
        });
        savedPaneDisplays = [];
    }

    async function open() {
        const allowed = await verifyCreatorAccess();
        if (!allowed) {
            alert('Nur der Creator-Account darf Fälle global bearbeiten.');
            return;
        }

        const currentCase = getActiveCaseObj();
        if (!currentCase) {
            alert('Kein aktiver Fall geladen.');
            return;
        }

        injectStyles();

        draftCase = deepClone(currentCase);
        // Basisstrukturen absichern, damit leere Felder nicht crashen
        draftCase.metadata = draftCase.metadata || {};
        draftCase.case_overview = draftCase.case_overview || { topic: '', cornell_notes: [], summary: '' };
        if (!Array.isArray(draftCase.case_overview.cornell_notes)) {
            draftCase.case_overview.cornell_notes = [];
        }
        if (!Array.isArray(draftCase.timeline)) {
            draftCase.timeline = [];
        }
        draftCase.extra_tasks = draftCase.extra_tasks || {};

        activeEditorTab = mapPlayerTabToEditorTab(getCurrentPlayerTab());
        jsonRawDraft = JSON.stringify(draftCase, null, 2);
        jsonParseError = '';
        hasUnsavedChanges = false;
        isEditing = true;

        hideOriginalPlayerPanes();
        renderEditorShell();
        syncCreatorButtonVisibility();
    }

    function close(force = false) {
        if (!isEditing) return;
        if (!force && hasUnsavedChanges) {
            const ok = window.confirm('Du hast ungespeicherte Änderungen. Wirklich verwerfen?');
            if (!ok) return;
        }

        isEditing = false;
        hasUnsavedChanges = false;
        draftCase = null;
        jsonRawDraft = '';
        jsonParseError = '';

        document.getElementById('creator-case-editor-root')?.remove();
        restoreOriginalPlayerPanes();
        syncCreatorButtonVisibility();
    }

    function toggle() {
        if (isEditing) {
            close(false);
        } else {
            open();
        }
    }

    function markDirty() {
        hasUnsavedChanges = true;
        const indicator = document.getElementById('ce-unsaved-indicator');
        if (indicator) {
            indicator.textContent = '● Ungespeicherte Änderungen';
        }
    }

    function showStatus(type, message) {
        const box = document.getElementById('ce-status-banner');
        if (!box) return;
        if (!message) {
            box.className = 'ce-status-banner';
            box.textContent = '';
            return;
        }
        box.className = `ce-status-banner visible ${type}`;
        box.textContent = message;
    }

    // ----------------------------------------------------------------------
    // FORMATIERUNGS-HELPER FÜR CORNELL-TEXTAREAS
    // ----------------------------------------------------------------------
    function wrapSelectionInTextarea(textareaId, before, after = '') {
        const ta = document.getElementById(textareaId);
        if (!ta) return;
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        const selected = ta.value.slice(start, end);
        const replacement = before + (selected || 'Text') + after;

        ta.value = ta.value.slice(0, start) + replacement + ta.value.slice(end);
        ta.focus();
        ta.selectionStart = start + before.length;
        ta.selectionEnd = start + before.length + (selected || 'Text').length;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ----------------------------------------------------------------------
    // HOTSPOT-INTEGRITÄTSPRÜFUNG FÜR AUDIT-SCHRITTE
    // ----------------------------------------------------------------------
    function checkHotspotInContent(stepContent, phrase) {
        const cleanPhrase = String(phrase || '').trim();
        if (!cleanPhrase) return { ok: false, bracketed: false };
        const text = String(stepContent || '');
        if (text.includes(`[${cleanPhrase}]`)) {
            return { ok: true, bracketed: true };
        }
        if (text.includes(cleanPhrase)) {
            return { ok: true, bracketed: false };
        }
        return { ok: false, bracketed: false };
    }

    function collectAuditHotspotWarnings(caseObj) {
        const warnings = [];
        const steps = Array.isArray(caseObj?.timeline) ? caseObj.timeline : [];
        steps.forEach((step, sIdx) => {
            const hotspots = Array.isArray(step.hotspots) ? step.hotspots : [];
            hotspots.forEach((hs, hIdx) => {
                const status = checkHotspotInContent(step.content, hs.phrase);
                if (!status.ok) {
                    warnings.push(`Schritt ${sIdx + 1}, Hotspot ${hIdx + 1}: "${(hs.phrase || '').slice(0, 60)}" nicht im Schritt-Text gefunden.`);
                }
            });
        });
        return warnings;
    }

    // ----------------------------------------------------------------------
    // RENDERER DER EDITOR-SHELL & TABS
    // ----------------------------------------------------------------------
    function renderEditorShell() {
        const playerView = document.getElementById('player-view');
        if (!playerView || !draftCase) return;

        let root = document.getElementById('creator-case-editor-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'creator-case-editor-root';
            playerView.appendChild(root);
        }

        const tabs = [
            { id: 'cornell',    label: `🧭 Übersicht (${draftCase.case_overview.cornell_notes.length})` },
            { id: 'audit',      label: `📋 Audit (${draftCase.timeline.length})` },
            { id: 'quiz',       label: `🎓 Exam (${Array.isArray(draftCase.extra_tasks.master_quiz) ? draftCase.extra_tasks.master_quiz.length : 0})` },
            { id: 'flashcards', label: `🗂️ Flashcards (${Array.isArray(draftCase.extra_tasks.flashcards) ? draftCase.extra_tasks.flashcards.length : 0})` },
            { id: 'doctordle',  label: `🔍 Doctordle (${Array.isArray(draftCase.extra_tasks.doctordle) ? draftCase.extra_tasks.doctordle.length : 0})` },
            { id: 'meta',       label: '⚙️ Metadaten' },
            { id: 'json',       label: '{ } Raw JSON' }
        ];

        root.innerHTML = `
            <div class="ce-sticky-bar">
                <div class="ce-bar-left">
                    <span class="ce-badge-live">✏️ Creator-Modus · Live für alle</span>
                    <span style="font-size:0.84rem; font-weight:700; color:var(--text-main);">
                        ${esc(draftCase.metadata?.title || draftCase.case_id || 'Fall')}
                    </span>
                    <span id="ce-unsaved-indicator" class="ce-unsaved-dot">
                        ${hasUnsavedChanges ? '● Ungespeicherte Änderungen' : ''}
                    </span>
                </div>
                <div class="ce-bar-actions">
                    <button type="button" class="action-btn secondary btn-sm" id="ce-btn-cancel">✕ Abbrechen</button>
                    <button type="button" class="action-btn btn-sm" id="ce-btn-save" ${isSaving ? 'disabled' : ''}>
                        ${isSaving ? '⏳ Speichert...' : '💾 Für alle speichern'}
                    </button>
                </div>
            </div>

            <div id="ce-status-banner" class="ce-status-banner"></div>

            <div class="ce-subnav" role="tablist">
                ${tabs.map(t => `
                    <button type="button"
                            class="ce-tab-btn ${activeEditorTab === t.id ? 'active' : ''}"
                            data-ce-tab="${t.id}">
                        ${t.label}
                    </button>
                `).join('')}
            </div>

            <div id="ce-tab-body"></div>
        `;

        root.querySelector('#ce-btn-cancel')?.addEventListener('click', () => close(false));
        root.querySelector('#ce-btn-save')?.addEventListener('click', () => saveToCloud());

        root.querySelectorAll('.ce-tab-btn[data-ce-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const nextTab = btn.getAttribute('data-ce-tab');
                if (nextTab === activeEditorTab) return;

                // Falls wir aus dem Raw-JSON-Tab wechseln, zuerst JSON validieren und übernehmen
                if (activeEditorTab === 'json') {
                    if (!commitRawJsonIntoDraft()) return;
                }

                activeEditorTab = nextTab;
                if (nextTab === 'json') {
                    jsonRawDraft = JSON.stringify(draftCase, null, 2);
                    jsonParseError = '';
                }
                renderEditorShell();
            });
        });

        renderActiveTabBody();
    }

    function commitRawJsonIntoDraft() {
        try {
            const parsed = JSON.parse(jsonRawDraft);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Das Root-Element muss ein JSON-Objekt sein.');
            }
            if (!parsed.case_id && draftCase?.case_id) {
                parsed.case_id = draftCase.case_id;
            }
            draftCase = parsed;
            draftCase.metadata = draftCase.metadata || {};
            draftCase.case_overview = draftCase.case_overview || { topic: '', cornell_notes: [], summary: '' };
            if (!Array.isArray(draftCase.case_overview.cornell_notes)) draftCase.case_overview.cornell_notes = [];
            if (!Array.isArray(draftCase.timeline)) draftCase.timeline = [];
            draftCase.extra_tasks = draftCase.extra_tasks || {};
            jsonParseError = '';
            showStatus('', '');
            return true;
        } catch (err) {
            jsonParseError = err.message;
            showStatus('error', `JSON-Syntaxfehler: ${err.message}`);
            return false;
        }
    }

    function renderActiveTabBody() {
        const host = document.getElementById('ce-tab-body');
        if (!host || !draftCase) return;

        switch (activeEditorTab) {
            case 'meta':       renderMetaTab(host); break;
            case 'cornell':    renderCornellTab(host); break;
            case 'audit':      renderAuditTab(host); break;
            case 'quiz':       renderQuizTab(host); break;
            case 'flashcards': renderFlashcardsTab(host); break;
            case 'doctordle':  renderDoctordleTab(host); break;
            case 'json':       renderJsonTab(host); break;
        }
    }

    // --- TAB 1: METADATEN ---
    function renderMetaTab(host) {
        const meta = draftCase.metadata || {};
        host.innerHTML = `
            <div class="ce-card">
                <div class="ce-card-header">
                    <span class="ce-card-title">Fall-Metadaten</span>
                    <span style="font-size:0.74rem; color:var(--text-muted); font-family:'JetBrains Mono',monospace;">
                        case_id: ${esc(draftCase.case_id)} (fix für Fortschrittserhalt)
                    </span>
                </div>
                <div class="ce-grid-2">
                    <div class="ce-field">
                        <label class="ce-label">Falltitel</label>
                        <input type="text" class="ce-input" id="ce-meta-title" value="${esc(meta.title || draftCase.title || '')}">
                    </div>
                    <div class="ce-field">
                        <label class="ce-label">Fachgebiet / Ordner (medical_field)</label>
                        <input type="text" class="ce-input" id="ce-meta-field" value="${esc(meta.medical_field || draftCase.folder_name || '')}">
                    </div>
                    <div class="ce-field">
                        <label class="ce-label">Thema (Übersicht-Titel)</label>
                        <input type="text" class="ce-input" id="ce-meta-topic" value="${esc(draftCase.case_overview?.topic || '')}">
                    </div>
                    <div class="ce-field">
                        <label class="ce-label">Bloom-Stufe</label>
                        <input type="text" class="ce-input" id="ce-meta-bloom" value="${esc(meta.bloom_level || '')}">
                    </div>
                    <div class="ce-field">
                        <label class="ce-label">Schwierigkeit (1–5)</label>
                        <input type="number" min="1" max="5" class="ce-input" id="ce-meta-diff" value="${esc(meta.difficulty ?? 3)}">
                    </div>
                    <div class="ce-field">
                        <label class="ce-label">XP-Belohnung</label>
                        <input type="number" min="0" step="50" class="ce-input" id="ce-meta-xp" value="${esc(meta.xp_reward ?? 500)}">
                    </div>
                </div>
            </div>
        `;

        host.querySelector('#ce-meta-title')?.addEventListener('input', e => {
            draftCase.metadata.title = e.target.value;
            draftCase.title = e.target.value;
            markDirty();
        });
        host.querySelector('#ce-meta-field')?.addEventListener('input', e => {
            draftCase.metadata.medical_field = e.target.value;
            draftCase.folder_name = e.target.value;
            markDirty();
        });
        host.querySelector('#ce-meta-topic')?.addEventListener('input', e => {
            draftCase.case_overview.topic = e.target.value;
            markDirty();
        });
        host.querySelector('#ce-meta-bloom')?.addEventListener('input', e => {
            draftCase.metadata.bloom_level = e.target.value;
            markDirty();
        });
        host.querySelector('#ce-meta-diff')?.addEventListener('input', e => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) draftCase.metadata.difficulty = val;
            markDirty();
        });
        host.querySelector('#ce-meta-xp')?.addEventListener('input', e => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) draftCase.metadata.xp_reward = val;
            markDirty();
        });
    }

    // --- TAB 2: CORNELL ÜBERSICHT ---
    function renderCornellTab(host) {
        const notes = draftCase.case_overview.cornell_notes;

        host.innerHTML = `
            <div class="ce-card">
                <div class="ce-field">
                    <label class="ce-label">Übersichts-Titel (topic)</label>
                    <input type="text" class="ce-input" id="ce-cornell-topic" value="${esc(draftCase.case_overview.topic || '')}">
                </div>
            </div>

            ${notes.map((entry, idx) => {
                const cuesText = Array.isArray(entry.cues) ? entry.cues.join('\n') : String(entry.cues || '');
                const taId = `ce-cornell-note-${idx}`;
                return `
                    <div class="ce-card" data-cornell-idx="${idx}">
                        <div class="ce-card-header">
                            <span class="ce-card-title">Abschnitt ${idx + 1}</span>
                            <button type="button" class="ce-danger-mini" data-del-cornell="${idx}">🗑 Abschnitt löschen</button>
                        </div>
                        <div class="ce-cornell-row">
                            <div class="ce-field">
                                <label class="ce-label">Linke Stichwörter (1 pro Zeile)</label>
                                <textarea class="ce-textarea" data-cornell-cues="${idx}" style="min-height:130px;">${esc(cuesText)}</textarea>
                            </div>
                            <div class="ce-field">
                                <label class="ce-label">Rechter Fließtext (Plain-Text oder HTML)</label>
                                <div class="ce-format-bar">
                                    <button type="button" class="ce-fmt-btn" data-fmt-target="${taId}" data-fmt-before="<strong>" data-fmt-after="</strong>"><b>Fett</b></button>
                                    <button type="button" class="ce-fmt-btn" data-fmt-target="${taId}" data-fmt-before="<em>" data-fmt-after="</em>"><i>Kursiv</i></button>
                                    <button type="button" class="ce-fmt-btn" data-fmt-target="${taId}" data-fmt-before="\n\nMerke: " data-fmt-after="">📘 Merke</button>
                                    <button type="button" class="ce-fmt-btn" data-fmt-target="${taId}" data-fmt-before="\n\nCave: " data-fmt-after="">⚠️ Cave</button>
                                    <button type="button" class="ce-fmt-btn" data-fmt-target="${taId}" data-fmt-before="\n\nKlinik-Perle: " data-fmt-after="">💡 Perle</button>
                                </div>
                                <textarea class="ce-textarea" id="${taId}" data-cornell-notes="${idx}" style="min-height:150px;">${esc(entry.notes || '')}</textarea>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}

            <button type="button" class="action-btn secondary btn-sm" id="ce-add-cornell-btn" style="align-self:flex-start;">
                + Neuen Cornell-Abschnitt hinzufügen
            </button>

            <div class="ce-card">
                <div class="ce-field">
                    <label class="ce-label">Take-Home Message (Synthese / summary)</label>
                    <textarea class="ce-textarea" id="ce-cornell-summary" style="min-height:100px;">${esc(draftCase.case_overview.summary || '')}</textarea>
                </div>
            </div>
        `;

        host.querySelector('#ce-cornell-topic')?.addEventListener('input', e => {
            draftCase.case_overview.topic = e.target.value;
            markDirty();
        });
        host.querySelector('#ce-cornell-summary')?.addEventListener('input', e => {
            draftCase.case_overview.summary = e.target.value;
            markDirty();
        });

        host.querySelectorAll('[data-cornell-cues]').forEach(ta => {
            ta.addEventListener('input', e => {
                const i = Number(ta.getAttribute('data-cornell-cues'));
                draftCase.case_overview.cornell_notes[i].cues = e.target.value
                    .split('\n')
                    .map(s => s.trim())
                    .filter(Boolean);
                markDirty();
            });
        });

        host.querySelectorAll('[data-cornell-notes]').forEach(ta => {
            ta.addEventListener('input', e => {
                const i = Number(ta.getAttribute('data-cornell-notes'));
                draftCase.case_overview.cornell_notes[i].notes = e.target.value;
                markDirty();
            });
        });

        host.querySelectorAll('.ce-fmt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                wrapSelectionInTextarea(
                    btn.getAttribute('data-fmt-target'),
                    btn.getAttribute('data-fmt-before') || '',
                    btn.getAttribute('data-fmt-after') || ''
                );
            });
        });

        host.querySelectorAll('[data-del-cornell]').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = Number(btn.getAttribute('data-del-cornell'));
                draftCase.case_overview.cornell_notes.splice(i, 1);
                markDirty();
                renderEditorShell();
            });
        });

        host.querySelector('#ce-add-cornell-btn')?.addEventListener('click', () => {
            draftCase.case_overview.cornell_notes.push({ cues: ['Neues Stichwort'], notes: '' });
            markDirty();
            renderEditorShell();
        });
    }

    // --- TAB 3: AUDIT (TIMELINE & HOTSPOTS MIT INTEGRITÄTSPRÜFUNG) ---
    function renderAuditTab(host) {
        const steps = draftCase.timeline;

        host.innerHTML = `
            <div class="ce-card" style="padding:12px 16px; background:var(--surface-secondary);">
                <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.5;">
                    💡 <strong>Hotspot-Regel:</strong> Markierte Passagen stehen im Fließtext in eckigen Klammern <code>[exakte Phrase]</code>.
                    Wenn du eine Hotspot-Phrase unten umschreibst, aktualisiert der Button <strong>„Im Text synchronisieren“</strong> automatisch den passenden Text im Schritt.
                </div>
            </div>

            ${steps.map((step, sIdx) => {
                const hotspots = Array.isArray(step.hotspots) ? step.hotspots : [];
                return `
                    <div class="ce-card" data-audit-step="${sIdx}">
                        <div class="ce-card-header">
                            <span class="ce-card-title">Audit-Schritt ${sIdx + 1} (step_id: ${esc(step.step_id ?? sIdx + 1)})</span>
                            <button type="button" class="ce-danger-mini" data-del-step="${sIdx}">🗑 Schritt löschen</button>
                        </div>

                        <div class="ce-field">
                            <label class="ce-label">Phase / Überschrift</label>
                            <input type="text" class="ce-input" data-step-phase="${sIdx}" value="${esc(step.phase || '')}">
                        </div>

                        <div class="ce-field">
                            <label class="ce-label">Klinischer Fließtext (Hotspots in [eckigen Klammern])</label>
                            <textarea class="ce-textarea" id="ce-step-content-${sIdx}" data-step-content="${sIdx}" style="min-height:130px;">${esc(step.content || '')}</textarea>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div class="ce-label">Hotspots (${hotspots.length})</div>
                            ${hotspots.map((hs, hIdx) => {
                                const check = checkHotspotInContent(step.content, hs.phrase);
                                const pillClass = check.ok ? 'ok' : 'warn';
                              const pillText = check.ok
    ? (check.bracketed ? '✓ [Phrase] im Text gefunden' : '✓ Exakt im Text gefunden')
    : '⚠️ Nicht im Text gefunden';

                                return `
                                    <div class="ce-hotspot-box ${hs.is_error ? 'is-error-hs' : 'is-ok-hs'}">
                                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                                            <span style="font-size:0.78rem; font-weight:800; color:var(--text-main);">
                                                Hotspot ${hIdx + 1} · ${hs.is_error ? '❌ Fehler (Signal)' : '✅ Korrekt (Null-Fehler)'}
                                            </span>
                                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                                <span class="ce-match-pill ${pillClass}" id="ce-hs-match-${sIdx}-${hIdx}">${pillText}</span>
                                                <button type="button" class="ce-danger-mini" data-del-hs="${sIdx}:${hIdx}">✕</button>
                                            </div>
                                        </div>

                                        <div class="ce-grid-2">
                                            <div class="ce-field">
                                                <label class="ce-label">
                                                    <span>Hotspot-Phrase</span>
                                                    <button type="button" class="ce-fmt-btn" data-sync-hs="${sIdx}:${hIdx}" title="Ersetzt die bisherige Phrase direkt im oberen Fließtext">
                                                        🔄 Im Text synchronisieren
                                                    </button>
                                                </label>
                                                <input type="text"
                                                       class="ce-input"
                                                       data-hs-phrase="${sIdx}:${hIdx}"
                                                       data-orig-phrase="${esc(hs.phrase || '')}"
                                                       value="${esc(hs.phrase || '')}">
                                            </div>
                                            <div class="ce-grid-2" style="gap:8px;">
                                                <div class="ce-field">
                                                    <label class="ce-label">Typ</label>
                                                    <select class="ce-select" data-hs-iserror="${sIdx}:${hIdx}">
                                                        <option value="false" ${!hs.is_error ? 'selected' : ''}>✅ Korrekt (Null-Fehler)</option>
                                                        <option value="true" ${hs.is_error ? 'selected' : ''}>❌ Klinischer Fehler</option>
                                                    </select>
                                                </div>
                                                <div class="ce-field">
                                                    <label class="ce-label">Skill-Tag</label>
                                                    <input type="text" class="ce-input" data-hs-skill="${sIdx}:${hIdx}" value="${esc(hs.skill_tag || 'Diagnostik')}">
                                                </div>
                                            </div>
                                        </div>

                                        ${hs.is_error ? `
                                            <div class="ce-field">
                                                <label class="ce-label">Sokratische Rückfrage (socratic_trap)</label>
                                                <textarea class="ce-textarea" style="min-height:66px;" data-hs-trap="${sIdx}:${hIdx}">${esc(hs.socratic_trap || '')}</textarea>
                                            </div>
                                            <div class="ce-field">
                                                <label class="ce-label">Korrekte Pathophysiologie / Auflösung (correct_pathophysiology)</label>
                                                <textarea class="ce-textarea" style="min-height:76px;" data-hs-patho="${sIdx}:${hIdx}">${esc(hs.correct_pathophysiology || hs.feedback || '')}</textarea>
                                            </div>
                                        ` : `
                                            <div class="ce-field">
                                                <label class="ce-label">Feedback</label>
                                                <textarea class="ce-textarea" style="min-height:66px;" data-hs-feedback="${sIdx}:${hIdx}">${esc(hs.feedback || '')}</textarea>
                                            </div>
                                        `}
                                    </div>
                                `;
                            }).join('')}

                            <button type="button" class="action-btn secondary btn-sm" data-add-hs="${sIdx}" style="align-self:flex-start;">
                                + Hotspot zu Schritt ${sIdx + 1} hinzufügen
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}

            <button type="button" class="action-btn secondary btn-sm" id="ce-add-step-btn" style="align-self:flex-start;">
                + Neuen Audit-Schritt hinzufügen
            </button>
        `;

        const refreshMatchBadgesForStep = (sIdx) => {
            const step = draftCase.timeline[sIdx];
            if (!step || !Array.isArray(step.hotspots)) return;
            step.hotspots.forEach((hs, hIdx) => {
                const pill = document.getElementById(`ce-hs-match-${sIdx}-${hIdx}`);
                if (!pill) return;
                const check = checkHotspotInContent(step.content, hs.phrase);
                pill.className = `ce-match-pill ${check.ok ? 'ok' : 'warn'}`;
                pill.textContent = check.bracketed
                    ? '✓ [Phrase] im Text gefunden'
                    : (check.ok ? '⚠️ Im Text (ohne [Klammern])' : '⚠️ Nicht im Text gefunden');
            });
        };

        host.querySelectorAll('[data-step-phase]').forEach(inp => {
            inp.addEventListener('input', e => {
                draftCase.timeline[Number(inp.getAttribute('data-step-phase'))].phase = e.target.value;
                markDirty();
            });
        });

        host.querySelectorAll('[data-step-content]').forEach(ta => {
            ta.addEventListener('input', e => {
                const sIdx = Number(ta.getAttribute('data-step-content'));
                draftCase.timeline[sIdx].content = e.target.value;
                refreshMatchBadgesForStep(sIdx);
                markDirty();
            });
        });

        host.querySelectorAll('[data-hs-phrase]').forEach(inp => {
            inp.addEventListener('input', e => {
                const [sIdx, hIdx] = inp.getAttribute('data-hs-phrase').split(':').map(Number);
                draftCase.timeline[sIdx].hotspots[hIdx].phrase = e.target.value;
                refreshMatchBadgesForStep(sIdx);
                markDirty();
            });
        });

        // 1-Klick-Synchronisation einer geänderten Hotspot-Phrase in den Fließtext
        host.querySelectorAll('[data-sync-hs]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [sIdx, hIdx] = btn.getAttribute('data-sync-hs').split(':').map(Number);
                const phraseInput = host.querySelector(`[data-hs-phrase="${sIdx}:${hIdx}"]`);
                const contentTa = document.getElementById(`ce-step-content-${sIdx}`);
                if (!phraseInput || !contentTa) return;

                const oldPhrase = phraseInput.getAttribute('data-orig-phrase') || '';
                const newPhrase = phraseInput.value.trim();
                if (!newPhrase) return;

                let text = draftCase.timeline[sIdx].content || '';
if (oldPhrase && text.includes(`[${oldPhrase}]`)) {
    text = text.split(`[${oldPhrase}]`).join(`[${newPhrase}]`);
} else if (oldPhrase && text.includes(oldPhrase)) {
    text = text.split(oldPhrase).join(newPhrase);
} else {
    showStatus('warn', 'Bisherige Phrase wurde im Text nicht mehr gefunden – bitte kurz direkt im Schritt-Text anpassen.');
    return;
}

                draftCase.timeline[sIdx].content = text;
                contentTa.value = text;
                phraseInput.setAttribute('data-orig-phrase', newPhrase);
                refreshMatchBadgesForStep(sIdx);
                showStatus('success', 'Hotspot-Phrase wurde im Schritt-Text synchronisiert.');
                markDirty();
            });
        });

        host.querySelectorAll('[data-hs-iserror]').forEach(sel => {
            sel.addEventListener('change', e => {
                const [sIdx, hIdx] = sel.getAttribute('data-hs-iserror').split(':').map(Number);
                draftCase.timeline[sIdx].hotspots[hIdx].is_error = (e.target.value === 'true');
                markDirty();
                renderActiveTabBody();
            });
        });

        host.querySelectorAll('[data-hs-skill]').forEach(inp => {
            inp.addEventListener('input', e => {
                const [sIdx, hIdx] = inp.getAttribute('data-hs-skill').split(':').map(Number);
                draftCase.timeline[sIdx].hotspots[hIdx].skill_tag = e.target.value;
                markDirty();
            });
        });

        host.querySelectorAll('[data-hs-feedback]').forEach(ta => {
            ta.addEventListener('input', e => {
                const [sIdx, hIdx] = ta.getAttribute('data-hs-feedback').split(':').map(Number);
                draftCase.timeline[sIdx].hotspots[hIdx].feedback = e.target.value;
                markDirty();
            });
        });

        host.querySelectorAll('[data-hs-trap]').forEach(ta => {
            ta.addEventListener('input', e => {
                const [sIdx, hIdx] = ta.getAttribute('data-hs-trap').split(':').map(Number);
                draftCase.timeline[sIdx].hotspots[hIdx].socratic_trap = e.target.value;
                markDirty();
            });
        });

        host.querySelectorAll('[data-hs-patho]').forEach(ta => {
            ta.addEventListener('input', e => {
                const [sIdx, hIdx] = ta.getAttribute('data-hs-patho').split(':').map(Number);
                draftCase.timeline[sIdx].hotspots[hIdx].correct_pathophysiology = e.target.value;
                markDirty();
            });
        });

        host.querySelectorAll('[data-del-hs]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [sIdx, hIdx] = btn.getAttribute('data-del-hs').split(':').map(Number);
                draftCase.timeline[sIdx].hotspots.splice(hIdx, 1);
                markDirty();
                renderActiveTabBody();
            });
        });

        host.querySelectorAll('[data-add-hs]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sIdx = Number(btn.getAttribute('data-add-hs'));
                if (!Array.isArray(draftCase.timeline[sIdx].hotspots)) {
                    draftCase.timeline[sIdx].hotspots = [];
                }
                draftCase.timeline[sIdx].hotspots.push({
                    phrase: '',
                    is_error: false,
                    skill_tag: 'Diagnostik',
                    feedback: ''
                });
                markDirty();
                renderActiveTabBody();
            });
        });

        host.querySelectorAll('[data-del-step]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sIdx = Number(btn.getAttribute('data-del-step'));
                draftCase.timeline.splice(sIdx, 1);
                markDirty();
                renderEditorShell();
            });
        });

        host.querySelector('#ce-add-step-btn')?.addEventListener('click', () => {
            const nextId = draftCase.timeline.reduce((max, s) => Math.max(max, Number(s.step_id) || 0), 0) + 1;
            draftCase.timeline.push({
                step_id: nextId,
                phase: `Schritt ${nextId}`,
                content: '',
                hotspots: []
            });
            markDirty();
            renderEditorShell();
        });
    }

    // --- TAB 4: MASTER-EXAM (QUIZ) ---
    function renderQuizTab(host) {
        if (!Array.isArray(draftCase.extra_tasks.master_quiz)) {
            draftCase.extra_tasks.master_quiz = [];
        }
        const questions = draftCase.extra_tasks.master_quiz;

        host.innerHTML = `
            ${questions.map((q, qIdx) => {
                const options = Array.isArray(q.options) ? q.options : ['', '', '', ''];
                return `
                    <div class="ce-card">
                        <div class="ce-card-header">
                            <span class="ce-card-title">Frage ${qIdx + 1}</span>
                            <button type="button" class="ce-danger-mini" data-del-quiz="${qIdx}">🗑 Frage löschen</button>
                        </div>
                        <div class="ce-field">
                            <label class="ce-label">Fragestellung</label>
                            <textarea class="ce-textarea" style="min-height:72px;" data-quiz-q="${qIdx}">${esc(q.question || '')}</textarea>
                        </div>
                        <div class="ce-grid-2">
                            ${options.map((opt, oIdx) => `
                                <div class="ce-field">
                                    <label class="ce-label">Option ${String.fromCharCode(65 + oIdx)} ${Number(q.correct_index) === oIdx ? '✅ (Korrekt)' : ''}</label>
                                    <input type="text" class="ce-input" data-quiz-opt="${qIdx}:${oIdx}" value="${esc(opt)}">
                                </div>
                            `).join('')}
                        </div>
                        <div class="ce-grid-2">
                            <div class="ce-field">
                                <label class="ce-label">Korrekte Antwort</label>
                                <select class="ce-select" data-quiz-correct="${qIdx}">
                                    ${options.map((_, oIdx) => `
                                        <option value="${oIdx}" ${Number(q.correct_index) === oIdx ? 'selected' : ''}>
                                            Option ${String.fromCharCode(65 + oIdx)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="ce-field">
                            <label class="ce-label">Erklärung / Auflösung</label>
                            <textarea class="ce-textarea" style="min-height:76px;" data-quiz-exp="${qIdx}">${esc(q.explanation || '')}</textarea>
                        </div>
                    </div>
                `;
            }).join('')}

            <button type="button" class="action-btn secondary btn-sm" id="ce-add-quiz-btn" style="align-self:flex-start;">
                + Neue Exam-Frage hinzufügen
            </button>
        `;

        host.querySelectorAll('[data-quiz-q]').forEach(ta => {
            ta.addEventListener('input', e => {
                questions[Number(ta.getAttribute('data-quiz-q'))].question = e.target.value;
                markDirty();
            });
        });
        host.querySelectorAll('[data-quiz-opt]').forEach(inp => {
            inp.addEventListener('input', e => {
                const [qIdx, oIdx] = inp.getAttribute('data-quiz-opt').split(':').map(Number);
                questions[qIdx].options[oIdx] = e.target.value;
                markDirty();
            });
        });
        host.querySelectorAll('[data-quiz-correct]').forEach(sel => {
            sel.addEventListener('change', e => {
                questions[Number(sel.getAttribute('data-quiz-correct'))].correct_index = Number(e.target.value);
                markDirty();
                renderActiveTabBody();
            });
        });
        host.querySelectorAll('[data-quiz-exp]').forEach(ta => {
            ta.addEventListener('input', e => {
                questions[Number(ta.getAttribute('data-quiz-exp'))].explanation = e.target.value;
                markDirty();
            });
        });
        host.querySelectorAll('[data-del-quiz]').forEach(btn => {
            btn.addEventListener('click', () => {
                questions.splice(Number(btn.getAttribute('data-del-quiz')), 1);
                markDirty();
                renderEditorShell();
            });
        });
        host.querySelector('#ce-add-quiz-btn')?.addEventListener('click', () => {
            questions.push({ question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' });
            markDirty();
            renderEditorShell();
        });
    }

    // --- TAB 5: FLASHCARDS ---
    function renderFlashcardsTab(host) {
        if (!Array.isArray(draftCase.extra_tasks.flashcards)) {
            draftCase.extra_tasks.flashcards = [];
        }
        const cards = draftCase.extra_tasks.flashcards;

        host.innerHTML = `
            ${cards.map((fc, idx) => `
                <div class="ce-card">
                    <div class="ce-card-header">
                        <span class="ce-card-title">Flashcard ${idx + 1} (${esc(fc.id || `fc_${idx + 1}`)})</span>
                        <button type="button" class="ce-danger-mini" data-del-fc="${idx}">🗑 Karte löschen</button>
                    </div>
                    <div class="ce-grid-2">
                        <div class="ce-field">
                            <label class="ce-label">Kategorie</label>
                            <input type="text" class="ce-input" data-fc-cat="${idx}" value="${esc(fc.category || '')}">
                        </div>
                        <div class="ce-field">
                            <label class="ce-label">Schwierigkeit</label>
                            <input type="text" class="ce-input" data-fc-diff="${idx}" value="${esc(fc.difficulty || 'basic')}">
                        </div>
                    </div>
                    <div class="ce-grid-2">
                        <div class="ce-field">
                            <label class="ce-label">Vorderseite (Frage)</label>
                            <textarea class="ce-textarea" style="min-height:80px;" data-fc-front="${idx}">${esc(fc.front || '')}</textarea>
                        </div>
                        <div class="ce-field">
                            <label class="ce-label">Rückseite (Antwort)</label>
                            <textarea class="ce-textarea" style="min-height:80px;" data-fc-back="${idx}">${esc(fc.back || '')}</textarea>
                        </div>
                    </div>
                    <div class="ce-field">
                        <label class="ce-label">Eselsbrücke / Kontext (optional)</label>
                        <input type="text" class="ce-input" data-fc-mnem="${idx}" value="${esc(fc.mnemonic_or_context || '')}">
                    </div>
                </div>
            `).join('')}

            <button type="button" class="action-btn secondary btn-sm" id="ce-add-fc-btn" style="align-self:flex-start;">
                + Neue Flashcard hinzufügen
            </button>
        `;

        host.querySelectorAll('[data-fc-cat]').forEach(el => el.addEventListener('input', e => { cards[Number(el.dataset.fcCat)].category = e.target.value; markDirty(); }));
        host.querySelectorAll('[data-fc-diff]').forEach(el => el.addEventListener('input', e => { cards[Number(el.dataset.fcDiff)].difficulty = e.target.value; markDirty(); }));
        host.querySelectorAll('[data-fc-front]').forEach(el => el.addEventListener('input', e => { cards[Number(el.dataset.fcFront)].front = e.target.value; markDirty(); }));
        host.querySelectorAll('[data-fc-back]').forEach(el => el.addEventListener('input', e => { cards[Number(el.dataset.fcBack)].back = e.target.value; markDirty(); }));
        host.querySelectorAll('[data-fc-mnem]').forEach(el => el.addEventListener('input', e => { cards[Number(el.dataset.fcMnem)].mnemonic_or_context = e.target.value; markDirty(); }));
        host.querySelectorAll('[data-del-fc]').forEach(btn => btn.addEventListener('click', () => { cards.splice(Number(btn.dataset.delFc), 1); markDirty(); renderEditorShell(); }));
        host.querySelector('#ce-add-fc-btn')?.addEventListener('click', () => {
            cards.push({
                id: `fc_${String(cards.length + 1).padStart(2, '0')}_${Date.now().toString(36).slice(-3)}`,
                category: 'Faktenwissen',
                difficulty: 'basic',
                front: '',
                back: '',
                mnemonic_or_context: ''
            });
            markDirty();
            renderEditorShell();
        });
    }

    // --- TAB 6: DOCTORDLE ---
    function renderDoctordleTab(host) {
        if (!Array.isArray(draftCase.extra_tasks.doctordle)) {
            draftCase.extra_tasks.doctordle = draftCase.extra_tasks.doctordle ? [draftCase.extra_tasks.doctordle] : [];
        }
        const puzzles = draftCase.extra_tasks.doctordle;

        host.innerHTML = `
            ${puzzles.map((p, idx) => `
                <div class="ce-card">
                    <div class="ce-card-header">
                        <span class="ce-card-title">Doctordle-Rätsel ${idx + 1}</span>
                        <button type="button" class="ce-danger-mini" data-del-doc="${idx}">🗑 Rätsel löschen</button>
                    </div>
                    <div class="ce-grid-2">
                        <div class="ce-field">
                            <label class="ce-label">Titel</label>
                            <input type="text" class="ce-input" data-doc-title="${idx}" value="${esc(p.title || '')}">
                        </div>
                        <div class="ce-field">
                            <label class="ce-label">Ziel-Diagnose</label>
                            <input type="text" class="ce-input" data-doc-target="${idx}" value="${esc(p.target_diagnosis || '')}">
                        </div>
                    </div>
                    <div class="ce-field">
                        <label class="ce-label">Akzeptierte Synonyme (kommagetrennt)</label>
                        <input type="text" class="ce-input" data-doc-syn="${idx}" value="${esc((p.synonyms || []).join(', '))}">
                    </div>
                    <div class="ce-field">
                        <label class="ce-label">Hinweise / Stufen (1 pro Zeile)</label>
                        <textarea class="ce-textarea" style="min-height:110px;" data-doc-hints="${idx}">${esc((p.hints || []).join('\n'))}</textarea>
                    </div>
                    <div class="ce-field">
                        <label class="ce-label">Learning Pearl</label>
                        <textarea class="ce-textarea" style="min-height:66px;" data-doc-pearl="${idx}">${esc(p.learning_pearl || '')}</textarea>
                    </div>
                </div>
            `).join('')}

            <button type="button" class="action-btn secondary btn-sm" id="ce-add-doc-btn" style="align-self:flex-start;">
                + Neues Doctordle-Rätsel hinzufügen
            </button>
        `;

        host.querySelectorAll('[data-doc-title]').forEach(el => el.addEventListener('input', e => { puzzles[Number(el.dataset.docTitle)].title = e.target.value; markDirty(); }));
        host.querySelectorAll('[data-doc-target]').forEach(el => el.addEventListener('input', e => { puzzles[Number(el.dataset.docTarget)].target_diagnosis = e.target.value; markDirty(); }));
        host.querySelectorAll('[data-doc-syn]').forEach(el => el.addEventListener('input', e => {
            puzzles[Number(el.dataset.docSyn)].synonyms = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            markDirty();
        }));
        host.querySelectorAll('[data-doc-hints]').forEach(el => el.addEventListener('input', e => {
            puzzles[Number(el.dataset.docHints)].hints = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
            markDirty();
        }));
        host.querySelectorAll('[data-doc-pearl]').forEach(el => el.addEventListener('input', e => { puzzles[Number(el.dataset.docPearl)].learning_pearl = e.target.value; markDirty(); }));
        host.querySelectorAll('[data-del-doc]').forEach(btn => btn.addEventListener('click', () => { puzzles.splice(Number(btn.dataset.delDoc), 1); markDirty(); renderEditorShell(); }));
        host.querySelector('#ce-add-doc-btn')?.addEventListener('click', () => {
            puzzles.push({
                puzzle_id: puzzles.length + 1,
                title: `Deduktion ${puzzles.length + 1}`,
                target_diagnosis: '',
                synonyms: [],
                hints: ['Stufe 1: '],
                learning_pearl: ''
            });
            markDirty();
            renderEditorShell();
        });
    }

    // --- TAB 7: RAW JSON (FÜR SYNAPSEN, KASKADEN, TAXONOMIE & POWER-EDITS) ---
    function renderJsonTab(host) {
        host.innerHTML = `
            <div class="ce-card">
                <div class="ce-card-header">
                    <span class="ce-card-title">Vollständiges Fall-JSON (inkl. Synapsen, Kaskaden & Taxonomie)</span>
                    <button type="button" class="ce-fmt-btn" id="ce-json-format-btn">✨ JSON prüfen & formatieren</button>
                </div>
                <textarea class="ce-textarea ce-mono" id="ce-raw-json-ta" spellcheck="false">${esc(jsonRawDraft)}</textarea>
            </div>
        `;

        const ta = host.querySelector('#ce-raw-json-ta');
        ta?.addEventListener('input', e => {
            jsonRawDraft = e.target.value;
            markDirty();
        });

        host.querySelector('#ce-json-format-btn')?.addEventListener('click', () => {
            if (commitRawJsonIntoDraft()) {
                jsonRawDraft = JSON.stringify(draftCase, null, 2);
                if (ta) ta.value = jsonRawDraft;
                showStatus('success', 'JSON ist valide und sauber formatiert.');
            }
        });
    }

    // ----------------------------------------------------------------------
    // GLOBALES SPEICHERN IN SUPABASE + LOKALER CACHE + LIVE-RERENDER
    // ----------------------------------------------------------------------
    async function saveToCloud() {
        if (!isEditing || !draftCase || isSaving) return;

        // 1. Falls im Raw-JSON-Tab: zuerst parsen
        if (activeEditorTab === 'json' && !commitRawJsonIntoDraft()) {
            return;
        }

        // 2. Basis-Validierung
        const caseId = (draftCase.case_id || draftCase.id || '').trim();
        const title = (draftCase.metadata?.title || draftCase.title || '').trim();
        if (!caseId) {
            showStatus('error', 'Fehlende case_id – Speichern abgebrochen.');
            return;
        }
        if (!title) {
            showStatus('error', 'Der Falltitel darf nicht leer sein.');
            return;
        }

        // 3. Hotspot-Integritätsprüfung vor dem Schreiben
        const hotspotWarnings = collectAuditHotspotWarnings(draftCase);
        if (hotspotWarnings.length > 0) {
            const proceed = window.confirm(
                `Achtung – ${hotspotWarnings.length} Hotspot(s) passen nicht exakt zum Schritt-Text:\n\n` +
                hotspotWarnings.slice(0, 5).join('\n') +
                `\n\nTrotzdem global speichern?`
            );
            if (!proceed) {
                showStatus('warn', hotspotWarnings[0]);
                return;
            }
        }

        const sb = getSb();
        if (!sb || !sb.auth) {
            showStatus('error', 'Supabase-Client ist nicht verfügbar.');
            return;
        }

        isSaving = true;
        const saveBtn = document.getElementById('ce-btn-save');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Speichert...';
        }
        showStatus('', '');

        try {
            const { data: { session } } = await sb.auth.getSession();
            const user = session?.user;
            if (!user) {
                throw new Error('Nicht eingeloggt. Bitte melde dich erneut an.');
            }

            const medicalField = (
                draftCase.metadata?.medical_field ||
                draftCase.folder_name ||
                'Allgemein'
            ).trim();

            draftCase.case_id = caseId;
            draftCase.title = title;
            draftCase.metadata = {
                ...(draftCase.metadata || {}),
                title,
                medical_field: medicalField
            };

            const nowIso = new Date().toISOString();

            // Prüfen, ob der Fall bereits global in `cases` existiert
            const { data: existingRow, error: lookupErr } = await sb
                .from('cases')
                .select('id, case_id')
                .eq('case_id', caseId)
                .maybeSingle();

            if (lookupErr) throw lookupErr;

            let persistedRow = null;

            if (existingRow?.id) {
                const { data: updatedRows, error: updateErr } = await sb
                    .from('cases')
                    .update({
                        title,
                        medical_field: medicalField,
                        content: draftCase,
                        updated_at: nowIso
                    })
                    .eq('case_id', caseId)
                    .select('id, case_id, updated_at');

                if (updateErr) throw updateErr;
                if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
                    throw new Error(
                        'Keine Zeile aktualisiert (RLS-Berechtigung fehlt). Prüfe, ob dein Account in user_profiles die Rolle "creator" hat.'
                    );
                }
                persistedRow = updatedRows[0];
            } else {
                const { data: insertedRow, error: insertErr } = await sb
                    .from('cases')
                    .insert({
                        case_id: caseId,
                        title,
                        medical_field: medicalField,
                        content: draftCase,
                        is_public: true,
                        user_id: user.id,
                        created_by: user.id,
                        updated_at: nowIso
                    })
                    .select('id, case_id, updated_at')
                    .single();

                if (insertErr) throw insertErr;
                persistedRow = insertedRow;
            }

            // 4. Lokalen Zustand & Cache sofort aktualisieren
            const finalCase = deepClone(draftCase);
            setActiveCaseObj(finalCase);
            if (window.cloudCaseIds instanceof Set) {
                window.cloudCaseIds.add(caseId);
            }

            // custom_cases in localStorage synchron halten
            try {
                const rawList = typeof window.getRawCustomCases === 'function'
                    ? window.getRawCustomCases()
                    : JSON.parse(localStorage.getItem('custom_cases') || '[]');
                const idx = rawList.findIndex(c => (c.case_id || c.id) === caseId);
                if (idx !== -1) {
                    rawList[idx] = finalCase;
                } else {
                    rawList.push(finalCase);
                }
                localStorage.setItem('custom_cases', JSON.stringify(rawList));
            } catch (cacheErr) {
                console.warn('[CaseEditor] Lokaler Cache-Update übersprungen:', cacheErr);
            }

            if (typeof window.registerCaseDDs === 'function') {
                window.registerCaseDDs(finalCase);
            }

            // 5. Editor schließen und aktive Fallansicht sofort mit neuem Inhalt neu rendern
            const prevTab = getCurrentPlayerTab();
            close(true);

            const badgeTitle = document.getElementById('player-case-badge-title');
            if (badgeTitle) badgeTitle.textContent = title;

            if (typeof window.applyUpdatedCaseToPlayer === 'function') {
                window.applyUpdatedCaseToPlayer(finalCase, prevTab);
            } else {
                if (typeof window.renderOverview === 'function') window.renderOverview();
                if (typeof window.switchPlayerMode === 'function') window.switchPlayerMode(prevTab);
            }

            if (typeof window.renderDashboardCases === 'function') {
                window.renderDashboardCases();
            }

            if (typeof window.showScorePopup === 'function') {
                window.showScorePopup('✅ Fall global für alle aktualisiert!', 'positive');
            } else {
                console.info('[CaseEditor] Fall erfolgreich gespeichert:', persistedRow);
            }
        } catch (err) {
            // Editor bewusst OFFEN lassen, damit kein umgeschriebener Text verloren geht!
            console.error('[CaseEditor] Speichern fehlgeschlagen:', err);
            showStatus('error', `Speichern fehlgeschlagen: ${err.message}`);
        } finally {
            isSaving = false;
            const btn = document.getElementById('ce-btn-save');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '💾 Für alle speichern';
            }
        }
    }

    // ----------------------------------------------------------------------
    // GLOBALE KEYBOARD-SHORTCUTS & AUTH-LISTENER
    // ----------------------------------------------------------------------
    function bindGlobalEvents() {
        document.addEventListener('keydown', (e) => {
            if (!isEditing) return;

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveToCloud();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                close(false);
            }
        });

        window.addEventListener('cloudDataSynced', () => {
            verifiedDbCreator = null;
            syncCreatorButtonVisibility();
        });
        window.addEventListener('cloudCasesSynced', () => {
            syncCreatorButtonVisibility();
        });

        // Falls Nutzer im Edit-Modus den Haupt-Tab wechselt, sauber aufräumen
        const origSwitchTab = window.switchTab;
        if (typeof origSwitchTab === 'function' && !origSwitchTab._ceWrapped) {
            const wrapped = function (...args) {
                if (isEditing && args[0] !== 'player') {
                    close(true);
                }
                return origSwitchTab.apply(this, args);
            };
            wrapped._ceWrapped = true;
            window.switchTab = wrapped;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindGlobalEvents();
        setTimeout(syncCreatorButtonVisibility, 600);
        setTimeout(syncCreatorButtonVisibility, 2000);
    });

    return {
        open,
        close,
        toggle,
        saveToCloud,
        syncCreatorButtonVisibility,
        isEditing: () => isEditing
    };
})();

window.CaseEditorModule = CaseEditorModule;
