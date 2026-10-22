// ============================================================================
// SPACED REPETITION ENGINE V6.0 (Compact Preview + Interactive Modal)
// ============================================================================

const SR_STORAGE_KEY = 'medcheck_sr_schedule_v1';
// Standard-Intervalle in Tagen nach Leitner/SM-2-Logik (Stufe 0 bis 5)
const SR_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];

const SpacedRepetitionEngine = {
    activeFilter: 'ALL',
    isModalOpen: false,

    // 1. SR-Daten aus LocalStorage laden
    getScheduleData() {
        try {
            return JSON.parse(localStorage.getItem(SR_STORAGE_KEY) || '{}');
        } catch (e) {
            console.error('Fehler beim Lesen des SR-Speichers:', e);
            return {};
        }
    },

    // 2. SR-Daten speichern
    saveScheduleData(data) {
        try {
            localStorage.setItem(SR_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Fehler beim Speichern des SR-Speichers:', e);
        }
    },

    // 3. Synchronisiert gelöste Fälle & Fortschritt mit dem SR-Planer
    syncCasesWithSchedule() {
        const schedule = this.getScheduleData();
        const solvedIds = JSON.parse(localStorage.getItem('solved_cases') || '[]');
        const allProgress = JSON.parse(localStorage.getItem('medcheck_user_progress_v1') || '{}');
        const allCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];

        let changed = false;
        const now = Date.now();
        const DAY_MS = 86400000;

        allCases.forEach(c => {
            const caseId = c.case_id || c.id;
            if (!caseId) return;

            const isSolved = solvedIds.includes(caseId);
            const caseProg = allProgress[caseId];
            const lastUpdated = caseProg?.updatedAt || (isSolved ? now - (4 * DAY_MS) : null);

            // Wenn ein Fall gelöst oder bearbeitet wurde, aber noch keinen SR-Eintrag hat
            if ((isSolved || caseProg) && !schedule[caseId]) {
                const initialStage = isSolved ? 1 : 0;
                const intervalDays = SR_INTERVALS_DAYS[initialStage];
                schedule[caseId] = {
                    stage: initialStage,
                    lastReviewed: lastUpdated || now,
                    nextDue: (lastUpdated || now) + (intervalDays * DAY_MS),
                    historyCount: 1
                };
                changed = true;
            }
        });

        if (changed) this.saveScheduleData(schedule);
        return schedule;
    },

    // 4. Fall nach Abschluss / Wiederholung hochstufen oder zurücksetzen
    recordCaseReview(caseId, performanceRating = 'good') {
        if (!caseId) return;
        const schedule = this.getScheduleData();
        const now = Date.now();
        const DAY_MS = 86400000;

        const current = schedule[caseId] || { stage: 0, historyCount: 0 };
        let nextStage = current.stage;

        if (performanceRating === 'again') {
            nextStage = 0; // Morgen wiederholen
        } else if (performanceRating === 'hard') {
            nextStage = Math.max(0, current.stage); // Gleiche Stufe behalten
        } else {
            nextStage = Math.min(SR_INTERVALS_DAYS.length - 1, current.stage + 1);
        }

        const intervalDays = SR_INTERVALS_DAYS[nextStage];
        schedule[caseId] = {
            stage: nextStage,
            lastReviewed: now,
            nextDue: now + (intervalDays * DAY_MS),
            historyCount: (current.historyCount || 0) + 1
        };

        this.saveScheduleData(schedule);
        window.dispatchEvent(new CustomEvent('sr:updated'));
    },

    // 5. Berechnet alle Fälle & kategorisiert sie in "due" (Heute fällig), "soon" (Bald fällig), "mastered"
    getEvaluatedCases(filterSuperFolder = 'ALL') {
        const schedule = this.syncCasesWithSchedule();
        const allCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        const solvedIds = JSON.parse(localStorage.getItem('solved_cases') || '[]');
        const now = Date.now();
        const DAY_MS = 86400000;

        const dueCases = [];
        const upcomingCases = [];
        const unstartedCases = [];

        allCases.forEach(c => {
            const caseId = c.case_id || c.id;
            const subFolder = (c.folder_name || c.metadata?.medical_field || 'Allgemein').trim();
            const superFolder = typeof window.getSuperFolderForCategory === 'function'
                ? window.getSuperFolderForCategory(subFolder)
                : 'Allgemein';

            if (filterSuperFolder !== 'ALL' && superFolder !== filterSuperFolder) {
                return;
            }

            const srEntry = schedule[caseId];
            const isSolved = solvedIds.includes(caseId);

            if (!srEntry && !isSolved) {
                unstartedCases.push({ caseData: c, subFolder, superFolder, status: 'new', daysDiff: 0, stage: 0 });
                return;
            }

            const dueTime = srEntry ? srEntry.nextDue : now;
            const diffMs = dueTime - now;
            const daysDiff = Math.ceil(diffMs / DAY_MS);
            const stage = srEntry ? srEntry.stage : 1;

            const itemObj = {
                caseData: c,
                subFolder,
                superFolder,
                stage,
                lastReviewed: srEntry?.lastReviewed || now,
                nextDue: dueTime,
                daysDiff
            };

            if (diffMs <= 0) {
                dueCases.push({ ...itemObj, status: 'due', overdueDays: Math.abs(daysDiff) });
            } else {
                upcomingCases.push({ ...itemObj, status: 'upcoming' });
            }
        });

        // Sortiere fällige Fälle: Am längsten überfällige zuerst
        dueCases.sort((a, b) => a.nextDue - b.nextDue);
        // Sortiere kommende Fälle: Bald fällige zuerst
        upcomingCases.sort((a, b) => a.nextDue - b.nextDue);

        return { dueCases, upcomingCases, unstartedCases };
    },

    // 6. Rendert NUR DIE KLEINE KOMPAKTE PREVIEW-LEISTE im Dashboard
    renderDashboardWidget(containerId = 'sr-dashboard-widget', filter = 'ALL') {
        const container = document.getElementById(containerId);
        if (!container) return;

        this.activeFilter = filter || 'ALL';
        const { dueCases, upcomingCases } = this.getEvaluatedCases(this.activeFilter);

        const dueCount = dueCases.length;
        const upcomingCount = upcomingCases.length;

        // Gruppiere fällige Themenbereiche für die Kurz-Vorschau (max. 2 Themen-Pills anzeigen)
        const dueTopicsMap = {};
        dueCases.forEach(item => {
            dueTopicsMap[item.subFolder] = (dueTopicsMap[item.subFolder] || 0) + 1;
        });
        const topicKeys = Object.keys(dueTopicsMap);
        const previewTopicsText = topicKeys.length > 0
            ? topicKeys.slice(0, 2).join(', ') + (topicKeys.length > 2 ? ` +${topicKeys.length - 2} weitere` : '')
            : (upcomingCount > 0 ? 'Alles im grünen Bereich – nächste Wiederholung geplant' : 'Löse deinen ersten Fall, um das Intervall-Training zu starten');

        const statusColor = dueCount > 0 ? 'var(--warning, #f59e0b)' : 'var(--color-symptom, #10b981)';
        const pulseDotClass = dueCount > 0 ? 'sr-pulse-dot due' : 'sr-pulse-dot clear';

        container.innerHTML = `
            <div class="sr-compact-preview-bar" onclick="window.SpacedRepetitionEngine.openModal()" role="button" tabindex="0" title="Klicken, um alle zu wiederholenden Themenbereiche und Fälle zu öffnen">
                <div class="sr-compact-left">
                    <div class="sr-compact-icon-wrap" style="border-color: ${statusColor};">
                        <span>🧠</span>
                        <span class="${pulseDotClass}"></span>
                    </div>
                    <div class="sr-compact-info">
                        <div class="sr-compact-title-row">
                            <span class="sr-compact-title">Spaced Repetition</span>
                            ${this.activeFilter !== 'ALL' ? `<span class="sr-filter-tag">${this.escapeHtml(this.activeFilter)}</span>` : ''}
                        </div>
                        <div class="sr-compact-subtitle">${this.escapeHtml(previewTopicsText)}</div>
                    </div>
                </div>

                <div class="sr-compact-right">
                    <div class="sr-compact-badges">
                        <span class="sr-mini-pill ${dueCount > 0 ? 'is-due' : 'is-zero'}">
                            <strong>${dueCount}</strong> Fällig
                        </span>
                        <span class="sr-mini-pill is-upcoming">
                            <strong>${upcomingCount}</strong> Geplant
                        </span>
                    </div>
                    <button type="button" class="sr-compact-open-btn" onclick="event.stopPropagation(); window.SpacedRepetitionEngine.openModal()">
                        <span>Öffnen</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            </div>
        `;

        // Falls das Modal gerade offen ist, Inhalt live mitaktualisieren
        if (this.isModalOpen) {
            this.renderModalContent();
        }
    },

    // 7. Öffnet das Modal-Fenster mit den Themenbereichen & Fällen
    openModal(optionalFilter = null) {
        if (optionalFilter) this.activeFilter = optionalFilter;
        this.isModalOpen = true;

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);

        let modalOverlay = document.getElementById('sr-modal-overlay');
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.id = 'sr-modal-overlay';
            modalOverlay.className = 'sr-modal-overlay';
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) this.closeModal();
            });
            document.body.appendChild(modalOverlay);
        }

        this.renderModalContent();
        modalOverlay.classList.add('active');
    },

    // 8. Schliesst das Modal-Fenster
    closeModal() {
        this.isModalOpen = false;
        const modalOverlay = document.getElementById('sr-modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    },

    // 9. Rendert den Inhalt des geöffneten Fensters (gruppiert nach Themenbereichen)
    renderModalContent() {
        const modalOverlay = document.getElementById('sr-modal-overlay');
        if (!modalOverlay) return;

        const { dueCases, upcomingCases } = this.getEvaluatedCases(this.activeFilter);
        const superFolders = typeof window.getSuperFolderOrder === 'function'
            ? window.getSuperFolderOrder()
            : ['Nervensystem und Sinnesorgane', 'Psyche / Ethik / Recht', 'Reproduktion', 'Allgemein'];

        // Gruppierung der fälligen Fälle nach Unterordner (Themenbereich)
        const groupedDue = {};
        dueCases.forEach(item => {
            if (!groupedDue[item.subFolder]) groupedDue[item.subFolder] = [];
            groupedDue[item.subFolder].push(item);
        });

        let dueSectionHtml = '';
        if (dueCases.length === 0) {
            dueSectionHtml = `
                <div class="sr-empty-state">
                    <div style="font-size: 1.8rem; margin-bottom: 6px;">🎉</div>
                    <div style="font-weight: 700; color: var(--text-main);">Keine offenen Wiederholungen für heute!</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                        Alle gelernten Fälle befinden sich im optimalen Konsolidierungs-Intervall. Du kannst unten trotzdem jederzeit ein freies Review starten.
                    </div>
                </div>
            `;
        } else {
            dueSectionHtml = Object.entries(groupedDue).map(([topicName, items]) => `
                <div class="sr-topic-group">
                    <div class="sr-topic-header">
                        <span>📁 ${this.escapeHtml(topicName)}</span>
                        <span class="sr-topic-count">${items.length} ${items.length === 1 ? 'Fall' : 'Fälle'} fällig</span>
                    </div>
                    <div class="sr-cases-list">
                        ${items.map(item => {
                            const c = item.caseData;
                            const cId = c.case_id || c.id;
                            const title = c.metadata?.title || cId;
                            const overdueBadge = item.overdueDays > 0
                                ? `<span class="sr-due-tag overdue">Seit ${item.overdueDays}d fällig</span>`
                                : `<span class="sr-due-tag today">Heute fällig</span>`;

                            return `
                                <div class="sr-case-row">
                                    <div class="sr-case-main" onclick="window.SpacedRepetitionEngine.startReviewCase('${this.escapeHtml(cId)}')">
                                        <div class="sr-case-title">${this.escapeHtml(title)}</div>
                                        <div class="sr-case-meta">
                                            ${overdueBadge}
                                            <span>• Intervall-Stufe ${item.stage + 1}/${SR_INTERVALS_DAYS.length}</span>
                                        </div>
                                    </div>
                                    <div class="sr-case-actions">
                                        <button type="button" class="sr-btn-mark-done" onclick="event.stopPropagation(); window.SpacedRepetitionEngine.quickCompleteReview('${this.escapeHtml(cId)}')" title="Als wiederholt markieren (nächstes Intervall)">✓</button>
                                        <button type="button" class="sr-btn-start" onclick="window.SpacedRepetitionEngine.startReviewCase('${this.escapeHtml(cId)}')">Wiederholen ➔</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('');
        }

        // Geplante / Zukünftige Fälle kompakt darunter
        let upcomingSectionHtml = '';
        if (upcomingCases.length > 0) {
            upcomingSectionHtml = `
                <details class="sr-upcoming-accordion" ${dueCases.length === 0 ? 'open' : ''}>
                    <summary class="sr-upcoming-summary">
                        <span>📅 Geplante Wiederholungen (${upcomingCases.length})</span>
                        <span style="font-size: 0.75rem; color: var(--text-dim);">Ausklappen</span>
                    </summary>
                    <div class="sr-cases-list" style="margin-top: 10px;">
                        ${upcomingCases.map(item => {
                            const c = item.caseData;
                            const cId = c.case_id || c.id;
                            const title = c.metadata?.title || cId;
                            return `
                                <div class="sr-case-row upcoming">
                                    <div class="sr-case-main" onclick="window.SpacedRepetitionEngine.startReviewCase('${this.escapeHtml(cId)}')">
                                        <div class="sr-case-title">${this.escapeHtml(title)}</div>
                                        <div class="sr-case-meta">
                                            <span class="sr-due-tag scheduled">In ${item.daysDiff} Tag${item.daysDiff === 1 ? '' : 'en'}</span>
                                            <span>• 📁 ${this.escapeHtml(item.subFolder)}</span>
                                            <span>• Stufe ${item.stage + 1}/${SR_INTERVALS_DAYS.length}</span>
                                        </div>
                                    </div>
                                    <div class="sr-case-actions">
                                        <button type="button" class="sr-btn-start secondary" onclick="window.SpacedRepetitionEngine.startReviewCase('${this.escapeHtml(cId)}')">Frühzeitig üben</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </details>
            `;
        }

        modalOverlay.innerHTML = `
            <div class="sr-modal-card" role="dialog" aria-modal="true">
                <div class="sr-modal-header">
                    <div>
                        <div class="sr-modal-title-row">
                            <span style="font-size: 1.25rem;">🧠</span>
                            <h3>Spaced Repetition Planer</h3>
                        </div>
                        <p class="sr-modal-subtitle">Gezielte Langzeit-Konsolidierung deiner bearbeiteten Themenbereiche & Fälle</p>
                    </div>
                    <button type="button" class="sr-modal-close" onclick="window.SpacedRepetitionEngine.closeModal()" aria-label="Schließen">✕</button>
                </div>

                <div class="sr-modal-toolbar">
                    <div class="sr-filter-group">
                        <label for="sr-folder-filter">Überordner:</label>
                        <select id="sr-folder-filter" class="sr-select" onchange="window.SpacedRepetitionEngine.setFilter(this.value)">
                            <option value="ALL" ${this.activeFilter === 'ALL' ? 'selected' : ''}>Alle Überordner</option>
                            ${superFolders.map(sf => `
                                <option value="${this.escapeHtml(sf)}" ${this.activeFilter === sf ? 'selected' : ''}>${this.escapeHtml(sf)}</option>
                            `).join('')}
                        </select>
                    </div>

                    ${dueCases.length > 0 ? `
                        <button type="button" class="action-btn btn-sm" onclick="window.SpacedRepetitionEngine.startNextDueCase()">
                            ⚡ Sofort dringendsten Fall starten
                        </button>
                    ` : ''}
                </div>

                <div class="sr-modal-body">
                    <div class="sr-section-label">🔥 Jetzt zur Wiederholung fällig (${dueCases.length})</div>
                    ${dueSectionHtml}
                    ${upcomingSectionHtml}
                </div>
            </div>
        `;
    },

    setFilter(newFilter) {
        this.activeFilter = newFilter || 'ALL';
        this.renderDashboardWidget('sr-dashboard-widget', this.activeFilter);
    },

  startReviewCase(caseId, startMode = 'audit') {
        this.closeModal();

        // Sicherheits-Reset direkt vor dem Laden aufrufen
        if (window.ProgressManager && typeof window.ProgressManager.resetCaseChallengesForReview === 'function') {
            window.ProgressManager.resetCaseChallengesForReview(caseId);
        } else {
            // Fallback, falls ProgressManager global nicht gebunden war
            try {
                const allProg = JSON.parse(localStorage.getItem('medcheck_user_progress_v1') || '{}');
                delete allProg[caseId];
                localStorage.setItem('medcheck_user_progress_v1', JSON.stringify(allProg));
                localStorage.removeItem(`doctordle_state_${caseId}`);
                if (window.doctordleGame) window.doctordleGame.currentCaseId = null;
            } catch (e) {}
        }

        if (typeof window.loadCaseById === 'function') {
            window.loadCaseById(caseId, {
                resetForReview: true,
                startMode: startMode
            });
        }
    },

    startNextDueCase() {
        const { dueCases } = this.getEvaluatedCases(this.activeFilter);
        if (dueCases.length > 0) {
            const firstId = dueCases[0].caseData.case_id || dueCases[0].caseData.id;
            this.startReviewCase(firstId, 'audit');
        }
    },

    quickCompleteReview(caseId) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        this.recordCaseReview(caseId, 'good');
    },

    escapeHtml(str) {
        return String(str || '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }
};

// Globale Exports für HTML-Handler & Fächer-Drawer
window.SpacedRepetitionEngine = SpacedRepetitionEngine;

window.selectSrFolder = function(folderName) {
    SpacedRepetitionEngine.openModal(folderName);
};

// Direkt initialisieren, falls DOM schon geladen ist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        SpacedRepetitionEngine.renderDashboardWidget('sr-dashboard-widget', 'ALL');
    });
} else {
    SpacedRepetitionEngine.renderDashboardWidget('sr-dashboard-widget', 'ALL');
}

// Tastatur-Support (ESC schließt das SR-Modal)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && SpacedRepetitionEngine.isModalOpen) {
        SpacedRepetitionEngine.closeModal();
    }
});
