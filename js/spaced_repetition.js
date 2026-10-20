/**
 * @file js/spaced_repetition.js
 * @description SM-2 Spaced Repetition Engine mit Überordner-Fokussierung & bereinigtem Case-Launcher
 */

export class SpacedRepetitionEngine {
    static getSupabaseClient() {
        if (window.supabaseClient) return window.supabaseClient;
        if (window.sb) return window.sb;
        if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
        return null;
    }

    static async getCurrentUserId() {
        const supabase = this.getSupabaseClient();
        if (!supabase) return null;
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            return session?.user?.id || null;
        } catch (err) {
            console.error('[SpacedRepetition] Session-Fehler:', err.message);
            return null;
        }
    }

    static calculateSM2(quality, prevRepetitions = 0, prevEaseFactor = 2.50, prevInterval = 0) {
        const q = Math.max(0, Math.min(5, Math.round(quality)));
        let repetition_number = Number(prevRepetitions) || 0;
        let ease_factor = Number(prevEaseFactor) || 2.50;
        let interval_days = Number(prevInterval) || 0;

        if (q < 3) {
            repetition_number = 0;
            interval_days = 1;
        } else {
            if (repetition_number === 0) {
                interval_days = 1;
            } else if (repetition_number === 1) {
                interval_days = 6;
            } else {
                interval_days = Math.round(interval_days * ease_factor);
            }
            repetition_number += 1;
        }

        const qDiff = 5 - q;
        const rawEf = ease_factor + (0.1 - qDiff * (0.08 + qDiff * 0.02));
        ease_factor = Math.max(1.30, Number(rawEf.toFixed(2)));

        const now = new Date();
        const nextReview = new Date(now.getTime() + interval_days * 24 * 60 * 60 * 1000);

        return {
            repetition_number,
            ease_factor,
            interval_days,
            last_quality: q,
            last_reviewed_at: now.toISOString(),
            next_review_at: nextReview.toISOString()
        };
    }

    static deriveQualityFromMetrics(moduleType, metrics = {}) {
        if (typeof metrics.quality === 'number') return metrics.quality;

        if (moduleType === 'doctordle') {
            const attempts = metrics.attempts ?? 6;
            if (!metrics.won) return 1;
            if (attempts === 1) return 5;
            if (attempts === 2) return 4;
            if (attempts <= 4) return 3;
            return 2;
        }

        if (moduleType === 'synapses') {
            const mistakes = metrics.mistakes ?? 0;
            if (mistakes === 0) return 5;
            if (mistakes === 1) return 4;
            if (mistakes === 2) return 3;
            return 1;
        }

        const pct = metrics.scorePercent ?? 0;
        if (pct >= 90) return 5;
        if (pct >= 75) return 4;
        if (pct >= 60) return 3;
        if (pct >= 40) return 2;
        if (pct > 0) return 1;
        return 0;
    }

    /**
     * Ermittelt den exakten Überordner eines Falls aus den App-Daten
     */
    static resolveFolderForCase(caseId) {
        if (typeof window.getRegisteredCases === 'function') {
            const c = window.getRegisteredCases().find(x => x.case_id === caseId);
            if (c) {
                return (c.folder_name || c.metadata?.medical_field || 'Allgemein').trim();
            }
        }
        return 'Allgemein';
    }

    /**
     * Zerlegt zusammengesetzte IDs (z.B. MYELON_MASTER_001_USB_doctordle_0) wieder in die echte Case-ID
     */
    static extractPureCaseId(itemId) {
        if (!itemId) return '';
        return itemId
            .replace(/_doctordle_\d+$/i, '')
            .replace(/_doctordle$/i, '')
            .replace(/_quiz$/i, '')
            .replace(/_synapses$/i, '')
            .replace(/_cascade$/i, '')
            .replace(/_audit$/i, '');
    }

    static async recordReview({ itemId, moduleType, quality, medicalField = null }) {
        const supabase = this.getSupabaseClient();
        const userId = await this.getCurrentUserId();

        if (!supabase || !userId || !itemId || !moduleType) return null;

        const pureCaseId = this.extractPureCaseId(itemId);
        const folder = medicalField || this.resolveFolderForCase(pureCaseId);

        try {
            const { data: existing } = await supabase
                .from('user_spaced_repetition')
                .select('repetition_number, ease_factor, interval_days')
                .eq('user_id', userId)
                .eq('item_id', itemId)
                .eq('module_type', moduleType)
                .maybeSingle();

            const sm2 = this.calculateSM2(
                quality,
                existing?.repetition_number ?? 0,
                existing?.ease_factor ?? 2.50,
                existing?.interval_days ?? 0
            );

            const payload = {
                user_id: userId,
                item_id: itemId,
                module_type: moduleType,
                medical_field: folder,
                ...sm2
            };

            const { data, error } = await supabase
                .from('user_spaced_repetition')
                .upsert(payload, { onConflict: 'user_id,item_id,module_type' })
                .select()
                .single();

            if (error) throw error;

            window.dispatchEvent(new CustomEvent('sr:updated'));
            return data;
        } catch (err) {
            console.error('[SpacedRepetition] Fehler beim Speichern:', err.message);
            return null;
        }
    }

    static async getAllUserItems() {
        const supabase = this.getSupabaseClient();
        const userId = await this.getCurrentUserId();
        if (!supabase || !userId) return [];

        try {
            const { data, error } = await supabase
                .from('user_spaced_repetition')
                .select('*')
                .eq('user_id', userId);
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[SpacedRepetition] Fehler beim Laden:', err.message);
            return [];
        }
    }

    /**
     * Liest alle dynamischen Überordner aus der App aus
     */
    static getKnownFolders() {
        const folders = new Set();
        try {
            const savedOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
            savedOrder.forEach(f => folders.add(f.trim()));
        } catch (e) {}

        if (typeof window.getRegisteredCases === 'function') {
            window.getRegisteredCases().forEach(c => {
                const f = (c.folder_name || c.metadata?.medical_field || 'Allgemein').trim();
                folders.add(f);
            });
        }
        if (folders.size === 0) folders.add('Allgemein');
        return Array.from(folders);
    }

    /**
     * Startet den Fall sicher und navigiert zum passenden Modul
     */
    static launchReview(rawItemId, moduleType) {
        const pureCaseId = this.extractPureCaseId(rawItemId);

        if (typeof window.loadCaseById === 'function') {
            window.loadCaseById(pureCaseId);

            // Nach dem Laden direkt in den passenden Challenge-Tab schalten
            setTimeout(() => {
                const modeMap = {
                    'doctordle': 'doctordle',
                    'quiz': 'quiz',
                    'synapses': 'synapses',
                    'audit': 'audit',
                    'cascade': 'cascade'
                };
                const targetMode = modeMap[moduleType] || 'overview';
                if (typeof window.switchPlayerMode === 'function') {
                    window.switchPlayerMode(targetMode);
                }
            }, 80);
        } else {
            console.error('[SpacedRepetition] window.loadCaseById nicht gefunden.');
        }
    }

    /**
     * Rendert das Dashboard mit Filter nach Überordnern
     */
    static async renderDashboardWidget(containerTarget = 'sr-dashboard-widget', selectedFolder = 'ALL') {
        const container = typeof containerTarget === 'string'
            ? document.getElementById(containerTarget)
            : containerTarget;
        if (!container) return;

        const allItems = await this.getAllUserItems();
        const now = new Date();
        const knownFolders = this.getKnownFolders();

        // Items nach Überordner filtern falls gewählt
        const filteredItems = selectedFolder === 'ALL'
            ? allItems
            : allItems.filter(i => (i.medical_field || '').toLowerCase() === selectedFolder.toLowerCase());

        const dueItems = filteredItems
            .filter(i => new Date(i.next_review_at) <= now)
            .sort((a, b) => Number(a.ease_factor) - Number(b.ease_factor));

        const topDue = dueItems[0] || null;

        // Ordner-Fortschritt berechnen
        const folderStats = knownFolders.map(folderName => {
            const folderItems = allItems.filter(i => (i.medical_field || '').toLowerCase() === folderName.toLowerCase());
            const dueCount = folderItems.filter(i => new Date(i.next_review_at) <= now).length;
            const total = folderItems.length;

            let score = 0;
            if (total > 0) {
                const sumEf = folderItems.reduce((acc, curr) => acc + Number(curr.ease_factor || 2.5), 0);
                const avgEf = sumEf / total;
                score = Math.min(100, Math.round(((avgEf - 1.3) / 1.5) * 100));
            }

            let status = 'untracked';
            if (total > 0) {
                status = dueCount > 0 ? 'critical' : (score >= 70 ? 'mastered' : 'learning');
            }

            return { folderName, total, dueCount, score, status };
        });

        container.innerHTML = `
            <div class="sr-dashboard-card">
                <div class="sr-header">
                    <div>
                        <span class="sr-badge">SPACED REPETITION • ÜBERORDNER-FOKUS</span>
                        <h3 class="sr-title">Klinische Wiederholungs-Zentrale</h3>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <!-- Filter nach Überordner -->
                        <select id="sr-folder-filter" class="depot-select" style="font-weight:700;">
                            <option value="ALL" ${selectedFolder === 'ALL' ? 'selected' : ''}>Alle Überordner (${dueItems.length} fällig)</option>
                            ${knownFolders.map(f => {
                                const count = allItems.filter(i => (i.medical_field || '').toLowerCase() === f.toLowerCase() && new Date(i.next_review_at) <= now).length;
                                return `<option value="${f}" ${selectedFolder === f ? 'selected' : ''}>📁 ${f} (${count} fällig)</option>`;
                            }).join('')}
                        </select>
                    </div>
                </div>

                <!-- TAGESFALL / DAILY FLASH-CASE -->
                <div class="sr-flash-banner ${topDue ? 'is-active' : 'is-clear'}">
                    <div class="sr-flash-info">
                        <h4>⚡ Fälliger Tagesfall ${selectedFolder !== 'ALL' ? `in „${selectedFolder}“` : ''}</h4>
                        ${topDue ? `
                            <p>
                                Priorität: <strong>${this.extractPureCaseId(topDue.item_id)}</strong>
                                <span class="sr-module-tag">${topDue.module_type.toUpperCase()}</span>
                                <span class="sr-ef-tag">EF: ${Number(topDue.ease_factor).toFixed(2)}</span>
                                <span class="sr-ef-tag">📁 ${topDue.medical_field}</span>
                            </p>
                        ` : `
                            <p>Alle Wiederholungen für diesen Bereich heute abgeschlossen!</p>
                        `}
                    </div>
                    ${topDue ? `
                        <button type="button" class="sr-flash-btn" id="sr-trigger-flash-btn"
                            data-item-id="${topDue.item_id}"
                            data-module-type="${topDue.module_type}">
                            Fall wiederholen →
                        </button>
                    ` : ''}
                </div>

                <!-- ÜBERORDNER HEATMAP -->
                <div class="sr-heatmap-grid">
                    ${folderStats.map(stat => `
                        <div class="sr-organ-tile status-${stat.status}" 
                             onclick="window.selectSrFolder('${stat.folderName.replace(/'/g, "\\'")}')" 
                             style="cursor:pointer;" 
                             title="Klicken, um Wiederholungen auf diesen Überordner einzugrenzen">
                            <div class="sr-organ-top">
                                <span class="sr-organ-name">📁 ${stat.folderName}</span>
                                <span class="sr-organ-indicator"></span>
                            </div>
                            <div class="sr-organ-metrics">
                                ${stat.total > 0 ? `
                                    <div class="sr-mastery-bar">
                                        <div class="sr-mastery-fill" style="width: ${stat.score}%"></div>
                                    </div>
                                    <div class="sr-organ-meta">
                                        <span>Festigung: <strong>${stat.score}%</strong></span>
                                        <span>${stat.dueCount > 0 ? `<strong class="text-danger">${stat.dueCount} fällig</strong>` : `${stat.total} aktiv`}</span>
                                    </div>
                                ` : `
                                    <div class="sr-organ-empty">Noch keine Wiederholungen hinterlegt</div>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // 1. Klick auf den Tagesfall-Button
        const flashBtn = container.querySelector('#sr-trigger-flash-btn');
        if (flashBtn) {
            flashBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const { itemId, moduleType } = flashBtn.dataset;
                this.launchReview(itemId, moduleType);
            });
        }

        // 2. Dropdown-Wechsel für Überordner
        const filterSelect = container.querySelector('#sr-folder-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.renderDashboardWidget(containerTarget, e.target.value);
            });
        }
    }
}

// Global für Klicks auf die Ordnerkacheln verfügbar machen
window.selectSrFolder = function(folderName) {
    if (window.SpacedRepetitionEngine) {
        window.SpacedRepetitionEngine.renderDashboardWidget('sr-dashboard-widget', folderName);
    }
};

window.SpacedRepetitionEngine = SpacedRepetitionEngine;
