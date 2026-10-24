/**
 * js/gamification.js - Psychologische Motivations- & Belohnungs-Engine für MedCheck V6.0
 * Implementiert:
 * 1. Dienst-Streak (Duty Streak) + Dienstfrei-Joker (Shift Swaps) + XP-Multiplikator
 * 2. Wordle-Style Emoji-Share-Generator für Doctordle (Social Proof)
 * 3. Critical-Hit Engine (Gold-Partikel & WebAudio-Harmonie bei Stufe-1-Deduktion)
 * 4. Kognitiver Klinik-Atlas (Topografische Mastery-Visualisierung pro Überordner)
 */

const GAMIFICATION_KEY = 'medcheck_gamification_v1';

class GamificationEngine {
    constructor() {
        this.state = this.loadState();
        this.checkStreakIntegrity();
    }

    loadState() {
        const defaultState = {
            streak: {
                current: 0,
                longest: 0,
                lastActiveDate: null,
                jokers: 1 // Startet mit 1 Dienstfrei-Joker (Shift Swap)
            },
            badges: [],
            stats: {
                criticalHits: 0,
                casesCompletedTotal: 0,
                emergencyShiftsCompleted: 0,
                doctordleFirstTryHits: 0
            }
        };

        try {
            const raw = localStorage.getItem(GAMIFICATION_KEY);
            if (!raw) return defaultState;
            const parsed = JSON.parse(raw);
            return {
                streak: { ...defaultState.streak, ...(parsed.streak || {}) },
                badges: Array.isArray(parsed.badges) ? parsed.badges : [],
                stats: { ...defaultState.stats, ...(parsed.stats || {}) }
            };
        } catch (e) {
            console.warn('[Gamification] Fallback auf Default-State:', e);
            return defaultState;
        }
    }

    saveState() {
        try {
            localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(this.state));
        } catch (e) {
            console.error('[Gamification] Schreibfehler:', e);
        }
        this.renderStreakUI();
    }

    getTodayDateStr() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Prüft beim App-Start, ob der Streak aktiv ist oder ein Dienstfrei-Joker einspringen muss
    checkStreakIntegrity() {
        const today = this.getTodayDateStr();
        const last = this.state.streak.lastActiveDate;

        if (!last || last === today) return;

        const todayDate = new Date(today + 'T00:00:00');
        const lastDate = new Date(last + 'T00:00:00');
        const diffDays = Math.round((todayDate - lastDate) / 86400000);

        if (diffDays === 1) {
            // Gestern aktiv gewesen -> Streak bereit für heute
            return;
        } else if (diffDays === 2 && this.state.streak.jokers > 0) {
            // 1 Tag verpasst -> Dienstfrei-Joker (Shift Swap) rettet automatisch!
            this.state.streak.jokers--;
            const yesterday = new Date(todayDate.getTime() - 86400000);
            const yYear = yesterday.getFullYear();
            const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
            const yDay = String(yesterday.getDate()).padStart(2, '0');
            this.state.streak.lastActiveDate = `${yYear}-${yMonth}-${yDay}`;
            this.saveState();

            setTimeout(() => {
                this.showFloatingBanner('🛡️ Dienstfrei-Joker eingesetzt! Dein Dienst-Streak wurde gerettet.', 'joker');
            }, 900);
        } else if (diffDays > 1) {
            // Streak leider gerissen
            this.state.streak.current = 0;
            this.saveState();
        }
    }

    // Wird bei jeder gelösten Challenge / jedem abgeschlossenen Fall getriggert
    recordActivity(activityType = 'general') {
        const today = this.getTodayDateStr();
        let streakIncremented = false;

        if (this.state.streak.lastActiveDate !== today) {
            this.state.streak.current++;
            this.state.streak.lastActiveDate = today;
            streakIncremented = true;

            if (this.state.streak.current > (this.state.streak.longest || 0)) {
                this.state.streak.longest = this.state.streak.current;
            }

            // Alle 5 Tage Streak gibt es 1 Dienstfrei-Joker dazu (Maximal 3 auf Lager)
            if (this.state.streak.current % 5 === 0 && this.state.streak.jokers < 3) {
                this.state.streak.jokers++;
                setTimeout(() => {
                    this.showFloatingBanner('🛡️ +1 Dienstfrei-Joker für 5 Tage Dienst in Folge erhalten!', 'joker');
                }, 1200);
            }
        }

        if (activityType === 'case_completed') {
            this.state.stats.casesCompletedTotal++;
            // Zusätzlich: Pro 5 gemeisterten Fällen +1 Joker (falls unter 3)
            if (this.state.stats.casesCompletedTotal % 5 === 0 && this.state.streak.jokers < 3) {
                this.state.streak.jokers++;
                setTimeout(() => {
                    this.showFloatingBanner('🛡️ +1 Dienstfrei-Joker (5 Fälle gemeistert)!', 'joker');
                }, 1400);
            }
        }

        this.saveState();

        if (streakIncremented) {
            this.showFloatingBanner(`🔥 Dienst-Streak Tag ${this.state.streak.current}! (${this.getXpMultiplier()}x XP-Boost aktiv)`, 'streak');
        }
    }

    // XP-Multiplikator basierend auf dem aktuellen Dienst-Streak
    getXpMultiplier() {
        const s = this.state.streak.current || 0;
        if (s >= 14) return 1.5;
        if (s >= 7) return 1.25;
        if (s >= 3) return 1.1;
        return 1.0;
    }

    // =========================================================================
    // CRITICAL HIT ENGINE (Für Erstversuch-Deduktionen & fehlerfreie Audits)
    // =========================================================================
    triggerCriticalHit(reasonLabel = 'Blitz-Deduktion Stufe 1') {
        this.state.stats.criticalHits++;
        this.saveState();

        if (typeof window.triggerHaptic === 'function') {
            window.triggerHaptic([15, 40, 25, 40, 35]);
        }

        this.playCriticalHitSound();
        this.spawnGoldParticles();
        this.showFloatingBanner(`⚡ CRITICAL HIT: ${reasonLabel}! (Maximale Klinische Präzision)`, 'critical');
    }

    playCriticalHitSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 - E5 - G5 - C6 Akkord
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.065);

                gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.065);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.065 + 0.45);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + idx * 0.065);
                osc.stop(ctx.currentTime + idx * 0.065 + 0.46);
            });
        } catch (_e) {}
    }

    spawnGoldParticles() {
        const container = document.createElement('div');
        container.className = 'critical-particles-overlay';
        document.body.appendChild(container);

        const colors = ['#facc15', '#38bdf8', '#10b981', '#f472b6', '#ffffff'];
        for (let i = 0; i < 36; i++) {
            const p = document.createElement('span');
            p.className = 'crit-particle';
            const angle = Math.random() * Math.PI * 2;
            const velocity = 90 + Math.random() * 190;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity - 60;
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);
            p.style.background = colors[i % colors.length];
            container.appendChild(p);
        }

        setTimeout(() => container.remove(), 1100);
    }

    showFloatingBanner(text, variant = 'streak') {
        const existing = document.getElementById('gamification-toast-banner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'gamification-toast-banner';
        banner.className = `gamification-toast ${variant}`;
        banner.innerHTML = `<span>${text}</span>`;
        document.body.appendChild(banner);

        setTimeout(() => {
            banner.classList.add('fade-out');
            setTimeout(() => banner.remove(), 400);
        }, 3200);
    }

    // =========================================================================
    // WORDLE-STYLE EMOJI SHARE GENERATOR FÜR DOCTORDLE (OHNE SPOILER!)
    // =========================================================================
    generateDoctordleShareString({ caseId, puzzleIndex, totalPuzzles, attempts, won, byReveal, earnedXP }) {
        let rows = [];
        for (let i = 0; i < attempts; i++) {
            const isSolvingRow = (i === attempts - 1) && won;
            if (isSolvingRow) {
                rows.push(`🟩🟩🟩🟩 (Stufe ${i + 1}: Treffer!)`);
            } else if (byReveal && i === attempts - 1) {
                rows.push(`🟥🟥🟥🟥 (Aufgedeckt)`);
            } else {
                const greenCount = Math.min(3, Math.floor((i + 1) / 2));
                const blackCount = 4 - greenCount;
                rows.push(`${'🟨'.repeat(greenCount)}${'⬛'.repeat(blackCount)} (Stufe ${i + 1})`);
            }
        }

        const headerTag = caseId ? `#${caseId.slice(0, 10)}` : '#Klinik';
        const scoreTag = won ? `${attempts}/6 Versuche` : 'Aufgedeckt';
        const mult = this.getXpMultiplier();
        const multTag = mult > 1 ? ` (${mult}x 🔥)` : '';

        return [
            `MedCheck Doctordle ${headerTag} 🧠 (${puzzleIndex + 1}/${totalPuzzles})`,
            `${scoreTag} | ${earnedXP >= 0 ? '+' + earnedXP : earnedXP} XP${multTag}`,
            ...rows,
            `🔥 Dienst-Streak: ${this.state.streak.current} Tage`,
            `Kannst du den Fall schneller knacken?`
        ].join('\n');
    }

    async copyShareText(shareText, btnEl) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        let ok = false;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(shareText);
                ok = true;
            } catch (_e) {}
        }
        if (!ok) {
            const ta = document.createElement('textarea');
            ta.value = shareText;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            ok = document.execCommand('copy');
            ta.remove();
        }
        if (btnEl) {
            const old = btnEl.innerHTML;
            btnEl.innerHTML = ok ? '✓ Emoji-Grid kopiert! (Bereit für WhatsApp)' : '✕ Kopieren fehlgeschlagen';
            btnEl.style.background = ok ? '#10b981' : '#ef4444';
            setTimeout(() => {
                btnEl.innerHTML = old;
                btnEl.style.background = '';
            }, 2400);
        }
    }

    // =========================================================================
    // TOPBAR & KOGNITIVER ATLAS RENDERING
    // =========================================================================
    renderStreakUI() {
        const streakEl = document.getElementById('stat-streak');
        if (!streakEl) return;

        const count = this.state.streak.current || 0;
        const jokers = this.state.streak.jokers || 0;
        const mult = this.getXpMultiplier();

        streakEl.innerHTML = `🔥 ${count}d${jokers > 0 ? ` <span class="joker-pill" title="${jokers} Dienstfrei-Joker schützen deinen Streak bei Pause">🛡️${jokers}</span>` : ''}${mult > 1 ? ` <span class="mult-pill">${mult}x</span>` : ''}`;
    }

    // Rendert den visuellen Kognitiven Klinik-Atlas ins Dashboard
    renderCognitiveAtlas(containerId = 'cognitive-atlas-widget') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const allCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        const solvedIds = JSON.parse(localStorage.getItem('solved_cases') || '[]');
        const superOrder = typeof window.getSuperFolderOrder === 'function'
            ? window.getSuperFolderOrder()
            : ['Nervensystem und Sinnesorgane', 'Psyche / Ethik / Recht', 'Reproduktion', 'Allgemein'];

        const organMeta = {
            'Nervensystem und Sinnesorgane': { icon: '🧠', tract: 'Tractus corticospinalis & Cortex', color: '#38bdf8' },
            'Psyche / Ethik / Recht':        { icon: '⚖️', tract: 'Limbisches System & Präfrontalkortex', color: '#c084fc' },
            'Reproduktion':                  { icon: '🧬', tract: 'Hypothalamus-Hypophysen-Gonaden-Achse', color: '#f472b6' },
            'Allgemein':                     { icon: '🫀', tract: 'Kardiopulmonale & Metabolische Achse', color: '#10b981' }
        };

        const nodesHtml = superOrder.map(superTitle => {
            const matching = allCases.filter(c => {
                const sub = (c.folder_name || c.metadata?.medical_field || 'Allgemein').trim();
                const sf = typeof window.getSuperFolderForCategory === 'function' ? window.getSuperFolderForCategory(sub) : 'Allgemein';
                return sf === superTitle;
            });

            const total = matching.length;
            const solved = matching.filter(c => solvedIds.includes(c.case_id)).length;
            const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
            const meta = organMeta[superTitle] || { icon: '🩺', tract: 'Klinisches Organsystem', color: '#38bdf8' };
            const isMastered = total > 0 && pct === 100;
            const isActive = pct > 0;

            return `
                <div class="atlas-organ-node ${isActive ? 'is-illuminated' : 'is-dormant'} ${isMastered ? 'is-mastered' : ''}" 
                     style="--organ-color: ${meta.color};"
                     onclick="if(typeof window.setLearningMode==='function'){window.setLearningMode('specialty');}"
                     title="${superTitle}: ${solved}/${total} Krankheitsbilder synaptisch verknüpft">
                    <div class="atlas-ring-wrap">
                        <svg class="atlas-progress-ring" width="44" height="44" viewBox="0 0 44 44">
                            <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3.5"></circle>
                            <circle cx="22" cy="22" r="18" fill="none" stroke="${meta.color}" stroke-width="3.5"
                                    stroke-dasharray="113.1" stroke-dashoffset="${113.1 - (113.1 * pct) / 100}"
                                    stroke-linecap="round"></circle>
                        </svg>
                        <span class="atlas-organ-icon">${meta.icon}</span>
                    </div>
                    <div class="atlas-organ-info">
                        <div class="atlas-organ-title">${superTitle}</div>
                        <div class="atlas-organ-tract">${meta.tract}</div>
                        <div class="atlas-organ-stats" style="color:${meta.color};">${pct}% synaptisch aktiv (${solved}/${total})</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="cognitive-atlas-bar">
                <div class="atlas-header-row">
                    <div>
                        <span class="atlas-badge-title">🧬 Kognitiver Klinik-Atlas (Synaptische System-Mastery)</span>
                        <span class="atlas-badge-sub">Mit jedem gelösten Fall leuchten die zugehörigen Leitungsbahnen & Organsysteme permanent auf.</span>
                    </div>
                    <div class="atlas-streak-summary">
                        <span>⚡ Kritische Treffer: <strong>${this.state.stats.criticalHits}</strong></span>
                    </div>
                </div>
                <div class="atlas-nodes-grid">
                    ${nodesHtml}
                </div>
            </div>
        `;
    }
}

window.Gamification = new GamificationEngine();

document.addEventListener('DOMContentLoaded', () => {
    if (window.Gamification) {
        window.Gamification.renderStreakUI();
        window.Gamification.renderCognitiveAtlas();
    }
});
