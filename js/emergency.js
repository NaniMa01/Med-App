/**
 * js/emergency.js - Notaufnahme-Engine für MedCheck V6.0
 * Simuliert interdisziplinäre Notfälle unter Zeit- und Triage-Druck.
 */

const EMERGENCY_STORAGE_KEY = 'medcheck_emergency_progress';

const emergencySession = {
    active: false,
    queue: [],
    currentIndex: 0,
    totalCount: 0,
    startTime: null,
    timerInterval: null,
    timeElapsedSeconds: 0,
    triageScore: 0
};

const EmergencyManager = {
    getEmergencyCases: function() {
        const all = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        return all.filter(c => {
            const diff = c.metadata?.difficulty || 3;
            const title = (c.metadata?.title || '').toLowerCase();
            const field = (c.folder_name || c.metadata?.medical_field || '').toLowerCase();
            return diff >= 4 || title.includes('akut') || title.includes('notfall') || title.includes('myelon') || field.includes('notfall') || field.includes('infarkt');
        });
    },

    startSession: function() {
        let cases = this.getEmergencyCases();
        if (cases.length === 0) {
            cases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        }

        if (cases.length === 0) {
            alert('Keine Fälle für den Notaufnahme-Modus verfügbar.');
            return;
        }

        // Fisher-Yates Shuffle
        const shuffled = [...cases];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        emergencySession.active = true;
        emergencySession.queue = shuffled.map(c => c.case_id);
        emergencySession.totalCount = emergencySession.queue.length;
        emergencySession.currentIndex = 0;
        emergencySession.timeElapsedSeconds = 0;
        emergencySession.triageScore = 0;

        window.isSpecialtyBlindMode = true;
        this.loadNextEmergencyCase();
        this.startGlobalTimer();
    },

    loadNextEmergencyCase: function() {
        if (emergencySession.queue.length === 0) {
            this.finishEmergencyShift();
            return;
        }

        const nextId = emergencySession.queue.shift();
        emergencySession.currentIndex++;

        if (typeof window.loadCaseById === 'function') {
            window.loadCaseById(nextId, { specialty: true, startMode: 'audit' });
        }

        setTimeout(renderEmergencyHudOverlay, 100);
    },

    startGlobalTimer: function() {
        if (emergencySession.timerInterval) clearInterval(emergencySession.timerInterval);
        emergencySession.startTime = Date.now();
        emergencySession.timerInterval = setInterval(() => {
            emergencySession.timeElapsedSeconds++;
            const timerEl = document.getElementById('em-timer-display');
            if (timerEl) {
                const mins = Math.floor(emergencySession.timeElapsedSeconds / 60);
                const secs = emergencySession.timeElapsedSeconds % 60;
                timerEl.innerText = mins + ':' + (secs < 10 ? '0' : '') + secs;
            }
        }, 1000);
    },

    stopGlobalTimer: function() {
        if (emergencySession.timerInterval) {
            clearInterval(emergencySession.timerInterval);
            emergencySession.timerInterval = null;
        }
    },

    finishEmergencyShift: function() {
        this.stopGlobalTimer();
        emergencySession.active = false;
        window.isSpecialtyBlindMode = false;

        const totalTime = emergencySession.timeElapsedSeconds;
        const mins = Math.floor(totalTime / 60);
        const secs = totalTime % 60;

        const modalHtml = `
            <div id="reveal-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
                <div style="background:#1e293b; border:1px solid #38bdf8; border-radius:14px; max-width:500px; width:100%; padding:28px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.6); color:#f8fafc;">
                    <div style="font-size:2.8rem; margin-bottom:10px;">🚨</div>
                    <h2 style="color:#38bdf8; margin:0 0 10px 0;">Notdienst-Schicht beendet!</h2>
                    <p style="color:#cbd5e1; font-size:0.92rem; line-height:1.5; margin-bottom:18px;">
                        Du hast alle Notfälle der Schicht erfolgreich triagiert und behandelt.<br>
                        <strong>Gesamtzeit:</strong> ${mins} Min. ${secs} Sek.
                    </p>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button type="button" onclick="window.closeRevealModal(); window.startEmergencyMode();" style="background:#0284c7; color:#fff; border:none; padding:11px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.9rem;">
                            ⚡ Nächste Notdienst-Schicht starten
                        </button>
                        <button type="button" onclick="window.closeRevealModal(); window.switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);" style="background:#334155; color:#fff; border:none; padding:11px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">
                            Zurück zum Dashboard
                        </button>
                    </div>
                </div>
            </div>
        `;
        if (typeof window.closeRevealModal === 'function') window.closeRevealModal();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
};

window.EmergencyManager = EmergencyManager;
window.startEmergencyMode = function() {
    EmergencyManager.startSession();
};

function renderEmergencyHudOverlay() {
    if (!emergencySession.active) return;
    const badge = document.getElementById('player-case-badge-title');
    if (!badge) return;

    const wrap = badge.parentElement;
    if (wrap) {
        wrap.style.display = 'inline-flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '10px';
    }

    badge.innerText = `🚨 Notaufnahme • Fall ${emergencySession.currentIndex}/${emergencySession.totalCount}`;

    let timerBadge = document.getElementById('em-timer-badge');
    if (!timerBadge && wrap) {
        timerBadge = document.createElement('div');
        timerBadge.id = 'em-timer-badge';
        timerBadge.style.cssText = 'background:rgba(239,68,68,0.2); border:1px solid #ef4444; color:#fca5a5; padding:4px 10px; border-radius:20px; font-size:0.78rem; font-weight:700; font-family:"JetBrains Mono", monospace; display:flex; align-items:center; gap:5px;';
        timerBadge.innerHTML = `⏱️ Schicht-Zeit: <span id="em-timer-display">0:00</span>`;
        wrap.appendChild(timerBadge);
    }

    let nextEmBtn = document.getElementById('btn-emergency-next');
    if (!nextEmBtn && wrap) {
        nextEmBtn = document.createElement('button');
        nextEmBtn.id = 'btn-emergency-next';
        nextEmBtn.type = 'button';
        nextEmBtn.innerHTML = 'Nächster Notfall ➔';
        nextEmBtn.style.cssText = 'background:#ef4444; color:#fff; border:none; padding:6px 14px; border-radius:6px; font-weight:700; font-size:0.8rem; cursor:pointer; box-shadow:0 2px 8px rgba(239,68,68,0.4);';
        nextEmBtn.onclick = function(e) {
            e.preventDefault();
            EmergencyManager.loadNextEmergencyCase();
        };
        wrap.appendChild(nextEmBtn);
    }
}
