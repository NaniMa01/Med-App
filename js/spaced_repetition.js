/**
 * @file js/spaced_repetition.js
 * @description SuperMemo SM-2 Spaced Repetition Engine, Clinical Organ Heatmap & Daily Flash-Case Manager
 */

export class SpacedRepetitionEngine {
    /**
     * Ermittelt dynamisch die aktive Supabase-Client-Instanz aus der bestehenden App-Architektur.
     */
    static getSupabaseClient() {
        if (window.supabaseClient) return window.supabaseClient;
        if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
        if (window.auth && window.auth.supabase) return window.auth.supabase;
        if (window.app && window.app.supabase) return window.app.supabase;
        console.error('[SpacedRepetition] Keine aktive Supabase-Client-Instanz gefunden.');
        return null;
    }

    /**
     * Holt die aktuell eingeloggte User-ID sicher über Supabase Auth.
     */
    static async getCurrentUserId() {
        const supabase = this.getSupabaseClient();
        if (!supabase) return null;

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            return session?.user?.id || null;
        } catch (err) {
            console.error('[SpacedRepetition] Fehler beim Abrufen der User-Session:', err.message);
            return null;
        }
    }

    /**
     * Mathematischer Kern: Berechnet die neuen SM-2 Parameter.
     * @param {number} quality - Antwortqualität (0 bis 5, wobei < 3 als Fehler gilt)
     * @param {number} prevRepetitions - Bisherige erfolgreiche Wiederholungen in Folge
     * @param {number} prevEaseFactor - Bisheriger Ease Factor (Standard 2.50)
     * @param {number} prevInterval - Bisheriges Intervall in Tagen
     */
    static calculateSM2(quality, prevRepetitions = 0, prevEaseFactor = 2.50, prevInterval = 0) {
        // Clamp quality auf [0, 5]
        const q = Math.max(0, Math.min(5, Math.round(quality)));
        
        let repetition_number = Number(prevRepetitions) || 0;
        let ease_factor = Number(prevEaseFactor) || 2.50;
        let interval_days = Number(prevInterval) || 0;

        // 1. Intervall- & Wiederholungslogik nach SuperMemo SM-2
        if (q < 3) {
            // Bei Fehler: Zurücksetzen der Serie, Wiederholung am nächsten Tag
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

        // 2. Anpassung des Ease Factors (EF)
        // Formel: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        const qDiff = 5 - q;
        const rawEf = ease_factor + (0.1 - qDiff * (0.08 + qDiff * 0.02));
        ease_factor = Math.max(1.30, Number(rawEf.toFixed(2)));

        // 3. Zeitstempel berechnen
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

    /**
     * Hilfsfunktion: Rechnet Modul-Metriken (z.B. Prozentwerte oder Versuche) in SM-2 Quality (0-5) um.
     * @param {string} moduleType - 'audit' | 'doctordle' | 'synapses' | 'quiz' | 'cascade'
     * @param {object} metrics - { scorePercent, attempts, maxAttempts, mistakes }
     */
    static deriveQualityFromMetrics(moduleType, metrics = {}) {
        if (typeof metrics.quality === 'number') return metrics.quality;

        if (moduleType === 'doctordle') {
            const attempts = metrics.attempts ?? 6;
            const won = metrics.won ?? true;
            if (!won) return 1;
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

        // Standard: Prozentbasierte Auswertung (Audit, Quiz, Cascade)
        const pct = metrics.scorePercent ?? 0;
        if (pct >= 90) return 5;
        if (pct >= 75) return 4;
        if (pct >= 60) return 3;
        if (pct >= 40) return 2;
        if (pct > 0) return 1;
        return 0;
    }

    /**
     * Speichert oder aktualisiert (Upsert) ein absolviertes Lern-Item für den eingeloggten User.
     * @param {object} params
     * @param {string} params.itemId - Eindeutige Fall- oder Item-ID (z.B. 'neuro_cjk_001')
     * @param {string} params.moduleType - 'audit' | 'doctordle' | 'synapses' | 'quiz'
     * @param {number} params.quality - SM-2 Qualität (0-5)
     * @param {string} [params.medicalField] - Fachbereich (z.B. 'Neurologie', 'Hämatologie')
     */
    static async recordReview({ itemId, moduleType, quality, medicalField = null }) {
        const supabase = this.getSupabaseClient();
        const userId = await this.getCurrentUserId();

        if (!supabase || !userId) {
            console.warn('[SpacedRepetition] Kein eingeloggter Nutzer – Review wird übersprungen.');
            return null;
        }

        if (!itemId || !moduleType) {
            console.error('[SpacedRepetition] itemId und moduleType sind Pflichtfelder.');
            return null;
        }

        // Automatische Fachbereichs-Erkennung aus der Fall-ID falls nicht übergeben
        const resolvedField = medicalField || this.inferMedicalField(itemId);

        try {
            // 1. Bestehenden Datensatz für dieses Item laden (falls vorhanden)
            const { data: existing, error: fetchError } = await supabase
                .from('user_spaced_repetition')
                .select('repetition_number, ease_factor, interval_days')
                .eq('user_id', userId)
                .eq('item_id', itemId)
                .eq('module_type', moduleType)
                .maybeSingle();

            if (fetchError) throw fetchError;

            // 2. SM-2 Berechnung durchführen
            const sm2Result = this.calculateSM2(
                quality,
                existing?.repetition_number ?? 0,
                existing?.ease_factor ?? 2.50,
                existing?.interval_days ?? 0
            );

            // 3. Atomarer Upsert in Supabase
            const payload = {
                user_id: userId,
                item_id: itemId,
                module_type: moduleType,
                medical_field: resolvedField,
                ...sm2Result
            };

            const { data: savedData, error: upsertError } = await supabase
                .from('user_spaced_repetition')
                .upsert(payload, { onConflict: 'user_id,item_id,module_type' })
                .select()
                .single();

            if (upsertError) throw upsertError;

            // Optionales Custom Event feuern, damit sich das Dashboard automatisch aktualisiert
            window.dispatchEvent(new CustomEvent('sr:updated', { detail: savedData }));
            return savedData;

        } catch (err) {
            console.error('[SpacedRepetition] Fehler beim Speichern des Reviews:', err.message);
            return null;
        }
    }

    /**
     * Lädt alle aktuell fälligen Wiederholungen (next_review_at <= NOW()) für den eingeloggten User.
     */
    static async getDueReviews() {
        const supabase = this.getSupabaseClient();
        const userId = await this.getCurrentUserId();
        if (!supabase || !userId) return [];

        try {
            const nowIso = new Date().toISOString();
            const { data, error } = await supabase
                .from('user_spaced_repetition')
                .select('*')
                .eq('user_id', userId)
                .lte('next_review_at', nowIso)
                .order('ease_factor', { ascending: true }) // Schwierigste Items zuerst
                .order('next_review_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[SpacedRepetition] Fehler beim Laden fälliger Wiederholungen:', err.message);
            return [];
        }
    }

    /**
     * Lädt alle Spaced-Repetition-Einträge des aktuellen Nutzers für die Clinical Organ Heatmap.
     */
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
            console.error('[SpacedRepetition] Fehler beim Laden der Heatmap-Daten:', err.message);
            return [];
        }
    }

    /**
     *Leitet den Fachbereich aus bekannten Case-Präfixen ab, falls nicht explizit angegeben.
     */
    static inferMedicalField(itemId = '') {
        const lower = itemId.toLowerCase();
        if (lower.startsWith('neuro')) return 'Neurologie';
        if (lower.startsWith('haemato') || lower.startsWith('onko')) return 'Hämatologie & Onkologie';
        if (lower.startsWith('kardio') || lower.startsWith('cardio')) return 'Kardiologie';
        if (lower.startsWith('pneumo') || lower.startsWith('pulmo')) return 'Pneumologie';
        if (lower.startsWith('gastro')) return 'Gastroenterologie';
        if (lower.startsWith('nephro')) return 'Nephrologie';
        if (lower.startsWith('endo')) return 'Endokrinologie';
        if (lower.startsWith('infekt')) return 'Infektiologie';
        return window.currentCase?.medical_field || 'Allgemeine Innere Medizin';
    }

    /**
     * Aggregiert die Nutzerdaten nach Fachbereich/Organsystem für die Clinical Organ Heatmap.
     */
    static computeOrganHeatmapData(items = []) {
        const defaultOrgans = [
            'Neurologie',
            'Hämatologie & Onkologie',
            'Kardiologie',
            'Pneumologie',
            'Gastroenterologie',
            'Nephrologie'
        ];

        const grouped = {};
        defaultOrgans.forEach(org => {
            grouped[org] = { field: org, total: 0, due: 0, avgEf: 2.5, masteryScore: null, status: 'untracked' };
        });

        const now = new Date();

        items.forEach(item => {
            const field = item.medical_field || this.inferMedicalField(item.item_id);
            if (!grouped[field]) {
                grouped[field] = { field, total: 0, due: 0, sumEf: 0, sumMastery: 0 };
            }
            if (grouped[field].sumEf === undefined) {
                grouped[field].sumEf = 0;
                grouped[field].sumMastery = 0;
            }

            grouped[field].total += 1;
            grouped[field].sumEf += Number(item.ease_factor || 2.5);

            const isDue = new Date(item.next_review_at) <= now;
            if (isDue) grouped[field].due += 1;

            // Mastery-Score pro Item (0 bis 100) basierend auf Intervall, EF und Fälligkeit
            const repFactor = Math.min(1, item.repetition_number / 4);
            const efFactor = Math.min(1, Math.max(0, (Number(item.ease_factor) - 1.3) / 1.5));
            const duePenalty = isDue ? 0.6 : 1.0;
            const itemMastery = Math.round(((repFactor * 0.65) + (efFactor * 0.35)) * 100 * duePenalty);

            grouped[field].sumMastery += itemMastery;
        });

        return Object.values(grouped).map(group => {
            if (group.total === 0) return group;

            const avgEf = Number((group.sumEf / group.total).toFixed(2));
            const masteryScore = Math.round(group.sumMastery / group.total);

            let status = 'critical'; // Rot: Hohe Fehlerquote / frisch / überfällig
            if (masteryScore >= 75 && group.due === 0) {
                status = 'mastered'; // Grün: Gefestigt
            } else if (masteryScore >= 45) {
                status = 'learning'; // Gelb/Amber: Im Aufbau
            }

            return {
                field: group.field,
                total: group.total,
                due: group.due,
                avgEf,
                masteryScore,
                status
            };
        });
    }

    /**
     * Rendert das komplette Spaced-Repetition-Dashboard (Daily Flash-Case + Clinical Organ Heatmap).
     * @param {string|HTMLElement} containerTarget - DOM-ID oder Element
     * @param {Function} [onLaunchCase] - Callback(itemId, moduleType), wenn der User den Flash-Case startet
     */
    static async renderDashboardWidget(containerTarget = 'sr-dashboard-widget', onLaunchCase = null) {
        const container = typeof containerTarget === 'string'
            ? document.getElementById(containerTarget)
            : containerTarget;

        if (!container) return;

        const [allItems, dueItems] = await Promise.all([
            this.getAllUserItems(),
            this.getDueReviews()
        ]);

        const heatmapData = this.computeOrganHeatmapData(allItems);
        const topDueItem = dueItems[0] || null;

        container.innerHTML = `
            <div class="sr-dashboard-card">
                <div class="sr-header">
                    <div>
                        <span class="sr-badge">SM-2 COGNITIVE ENGINE</span>
                        <h3 class="sr-title">Spaced Repetition & Clinical Organ Heatmap</h3>
                    </div>
                    <div class="sr-stats-pill">
                        <span class="sr-due-count ${dueItems.length > 0 ? 'has-due' : ''}">
                            ${dueItems.length} ${dueItems.length === 1 ? 'Wiederholung' : 'Wiederholungen'} fällig
                        </span>
                    </div>
                </div>

                <!-- DAILY FLASH-CASE BANNER -->
                <div class="sr-flash-banner ${topDueItem ? 'is-active' : 'is-clear'}">
                    <div class="sr-flash-info">
                        <h4>⚡ Daily Flash-Case</h4>
                        ${topDueItem ? `
                            <p>
                                Höchste Priorität: <strong>${this.formatItemTitle(topDueItem.item_id)}</strong> 
                                <span class="sr-module-tag">${topDueItem.module_type.toUpperCase()}</span>
                                <span class="sr-ef-tag">EF: ${Number(topDueItem.ease_factor).toFixed(2)}</span>
                            </p>
                        ` : `
                            <p>Alle fälligen Karten für heute abgeschlossen! Dein Langzeitgedächtnis ist auf Kurs.</p>
                        `}
                    </div>
                    ${topDueItem ? `
                        <button type="button" class="sr-flash-btn" id="sr-trigger-flash-btn"
                            data-item-id="${topDueItem.item_id}"
                            data-module-type="${topDueItem.module_type}">
                            Flash-Case starten →
                        </button>
                    ` : ''}
                </div>

                <!-- CLINICAL ORGAN HEATMAP -->
                <div class="sr-heatmap-grid">
                    ${heatmapData.map(organ => `
                        <div class="sr-organ-tile status-${organ.status}" title="Durchschnittlicher Ease-Factor: ${organ.avgEf}">
                            <div class="sr-organ-top">
                                <span class="sr-organ-name">${organ.field}</span>
                                <span class="sr-organ-indicator"></span>
                            </div>
                            <div class="sr-organ-metrics">
                                ${organ.total > 0 ? `
                                    <div class="sr-mastery-bar">
                                        <div class="sr-mastery-fill" style="width: ${organ.masteryScore}%"></div>
                                    </div>
                                    <div class="sr-organ-meta">
                                        <span>Festigung: <strong>${organ.masteryScore}%</strong></span>
                                        <span>${organ.due > 0 ? `<strong class="text-danger">${organ.due} fällig</strong>` : `${organ.total} Karten`}</span>
                                    </div>
                                ` : `
                                    <div class="sr-organ-empty">Noch keine Fälle absolviert</div>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Event-Listener für den Daily Flash-Case Trigger
        const flashBtn = container.querySelector('#sr-trigger-flash-btn');
        if (flashBtn) {
            flashBtn.addEventListener('click', () => {
                const { itemId, moduleType } = flashBtn.dataset;
                if (typeof onLaunchCase === 'function') {
                    onLaunchCase(itemId, moduleType);
                } else {
                    this.defaultLaunchFlashCase(itemId, moduleType);
                }
            });
        }
    }

    /**
     * Standard-Launcher, der sich in die bestehende App-Navigation (`window.app` / Events) einklinkt.
     */
    static defaultLaunchFlashCase(itemId, moduleType) {
        window.dispatchEvent(new CustomEvent('sr:launchFlashCase', {
            detail: { itemId, moduleType }
        }));

        // Fallback auf typische App-Controller-Methoden
        if (window.app && typeof window.app.loadCase === 'function') {
            window.app.loadCase(itemId, moduleType);
        } else if (typeof window.loadCase === 'function') {
            window.loadCase(itemId, moduleType);
        } else {
            console.info(`[SpacedRepetition] Starte Flash-Case: ${itemId} im Modul ${moduleType}`);
        }
    }

    static formatItemTitle(itemId = '') {
        return itemId
            .replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    }
}

// Global verfügbar machen für bestehenden Vanilla-JS Code ohne ES-Module-Imports
window.SpacedRepetitionEngine = SpacedRepetitionEngine;
