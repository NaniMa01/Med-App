/**
 * js/specialty.js - Lernen nach Fachrichtung (Blind-Modus, Session-Queue, Reveal & automatischer Header-Button)
 */

const SPECIALTY_STORAGE_KEY = 'medcheck_specialty_progress';

const specialtySession = {
    field: null,
    queue: [],
    totalCount: 0,
    currentIndex: 0,
    currentId: null,
    recorded: false
};

// ============================================================================
// SPEICHER & PERSISTENZ
// ============================================================================
const SpecialtyStore = {
    getAll() {
        try {
            const data = JSON.parse(localStorage.getItem(SPECIALTY_STORAGE_KEY));
            return data && typeof data === 'object' ? data : {};
        } catch (e) {
            return {};
        }
    },
    get(field) {
        const e = this.getAll()[field] || {};
        return {
            completedCaseIds: Array.isArray(e.completedCaseIds) ? e.completedCaseIds : [],
            totalScore: e.totalScore || 0,
            lastPlayed: e.lastPlayed || null
        };
    },
    save(field, entry) {
        const all = this.getAll();
        all[field] = entry;
        try {
            localStorage.setItem(SPECIALTY_STORAGE_KEY, JSON.stringify(all));
        } catch (e) {
            console.error('Specialty-Progress Schreibfehler:', e);
        }
        if (window.Cloud) window.Cloud.scheduleProgressSync();
    },
    resetCompleted(field) {
        const e = this.get(field);
        this.save(field, { ...e, completedCaseIds: [] });
    }
};

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function getSpecialtyCases(field) {
    const norm = (field || '').trim().toLowerCase();
    const all = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
    return all.filter(c => {
        const f = (c.metadata?.medical_field || c.folder_name || c.medical_field || '').trim().toLowerCase();
        return f === norm || f.includes(norm);
    });
}

function shuffleFisherYates(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function buildQueue(field) {
    const done = new Set(SpecialtyStore.get(field).completedCaseIds);
    const allMatching = getSpecialtyCases(field);
    const ids = allMatching.map(c => c.case_id);
    const unsolved = shuffleFisherYates(ids.filter(id => !done.has(id)));
    const solved = shuffleFisherYates(ids.filter(id => done.has(id)));
    return [...unsolved, ...solved];
}

// ============================================================================
// AUTOMATISCHE INJEKTION DES BUTTONS "NEUER FALL ➔" (OBEN RECHTS)
// ============================================================================
function ensureTopNewCaseButton() {
    // 1. Button existiert bereits im sichtbaren DOM -> nichts tun
    if (document.getElementById('btn-top-new-case')) return;

    // 2. Den Zurück-Button suchen
    const backBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
        el.textContent && el.textContent.includes('Zurück')
    );

    // 3. Das Element "Aktiver Fall:" im Textbaum aufspüren
    let activeCaseEl = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.includes('Aktiver Fall')) {
            activeCaseEl = node.parentElement;
            break;
        }
    }

    // 4. Die obere Kopfleiste ermitteln
    let targetRow = backBtn?.parentElement;
    if (!targetRow && activeCaseEl) {
        targetRow = activeCaseEl.parentElement;
    }
    if (!targetRow) return;

    // Sicherstellen, dass die Leiste sauber als Flexbox ausgerichtet ist (Links Zurück, Rechts Fall & Button)
    targetRow.style.display = 'flex';
    targetRow.style.justifyContent = 'space-between';
    targetRow.style.alignItems = 'center';

    // Den Button erzeugen
    const newBtn = document.createElement('button');
    newBtn.id = 'btn-top-new-case';
    newBtn.type = 'button';
    newBtn.innerHTML = 'Neuer Fall ➔';
    newBtn.style.cssText = 'background: #0284c7; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4); margin-left: 10px; flex-shrink: 0;';

    newBtn.onmouseenter = () => newBtn.style.background = '#0369a1';
    newBtn.onmouseleave = () => newBtn.style.background = '#0284c7';

    newBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.nextSpecialtyCase();
    };

    // Platzierung: Rechts neben dem Badge für den aktiven Fall
    if (activeCaseEl) {
        if (activeCaseEl.parentElement === targetRow) {
            const rightGroup = document.createElement('div');
            rightGroup.id = 'top-bar-right-group';
            rightGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
            targetRow.replaceChild(rightGroup, activeCaseEl);
            rightGroup.appendChild(activeCaseEl);
            rightGroup.appendChild(newBtn);
        } else {
            activeCaseEl.insertAdjacentElement('afterend', newBtn);
        }
    } else {
        targetRow.appendChild(newBtn);
    }
}

// Ständiger Wächter: Stellt sicher, dass der Button auch nach Tab-Wechseln und Ladevorgängen stets existiert
setInterval(ensureTopNewCaseButton, 300);

// ============================================================================
// STEUERUNG DES FACHRICHTUNGS-MODUS
// ============================================================================
window.startSpecialty = function(field) {
    const cases = getSpecialtyCases(field);
    if (!cases.length) {
        alert(`Keine Fälle für die Fachrichtung "${field}" gefunden.`);
        return;
    }

    const ids = new Set(cases.map(c => c.case_id));
    if (SpecialtyStore.get(field).completedCaseIds.filter(id => ids.has(id)).length >= cases.length) {
        SpecialtyStore.resetCompleted(field);
    }

    specialtySession.field = field;
    specialtySession.queue = buildQueue(field);
    specialtySession.totalCount = specialtySession.queue.length;
    specialtySession.currentIndex = 0;

    window.isSpecialtyBlindMode = true;
    window.nextSpecialtyCase();
};

window.nextSpecialtyCase = function() {
    window.closeRevealModal();

    // 1. Wenn noch Fälle in der Queue liegen:
    if (specialtySession.queue && specialtySession.queue.length > 0) {
        const nextId = specialtySession.queue.shift();
        specialtySession.currentIndex++;
        specialtySession.currentId = nextId;
        window.loadCaseById(nextId, { specialty: true });
        setTimeout(ensureTopNewCaseButton, 50);
        return;
    }

    // 2. Fallback: Nächsten Fall aus derselben Fachrichtung rotieren
    const currentField = (window.activeCaseData?.metadata?.medical_field || window.activeCaseData?.folder_name || specialtySession.field || '').trim();
    const allCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
    const pool = allCases.filter(c => {
        const f = (c.metadata?.medical_field || c.folder_name || '').trim();
        return f.toLowerCase() === currentField.toLowerCase() && c.case_id !== window.activeCaseData?.case_id;
    });

    if (pool.length > 0) {
        const next = pool[Math.floor(Math.random() * pool.length)];
        window.loadCaseById(next.case_id, { specialty: true });
        setTimeout(ensureTopNewCaseButton, 50);
    } else {
        showSpecialtyFinished();
    }
};

window.applyBlindHeader = function(blind, caseData) {
    ensureTopNewCaseButton();

    // "Aktiver Fall: Lädt..." durch den tatsächlichen Fachbereich ersetzen
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.includes('Aktiver Fall')) {
            const field = caseData?.metadata?.medical_field || specialtySession.field || 'Fachrichtung';
            node.nodeValue = blind ? `Aktiver Fall: ${field}` : `Aktiver Fall: ${caseData?.metadata?.title || caseData?.case_id || ''}`;
            break;
        }
    }
};

// ============================================================================
// FORTSCHRITT & MODAL
// ============================================================================
function recordSpecialtyCompletion() {
    if (specialtySession.recorded || !window.activeCaseData) return;
    specialtySession.recorded = true;
    
    const field = (window.activeCaseData.metadata?.medical_field || specialtySession.field || '').trim();
    if (!field) return;

    const reward = window.activeCaseData.metadata?.xp_reward || 900;
    const entry = SpecialtyStore.get(field);
    
    if (!entry.completedCaseIds.includes(window.activeCaseData.case_id)) {
        entry.completedCaseIds.push(window.activeCaseData.case_id);
    }
    entry.totalScore += reward;
    entry.lastPlayed = new Date().toISOString();
    SpecialtyStore.save(field, entry);
}

window.onSpecialtyCompletionChange = function(allCompleted) {
    if (window.isSpecialtyBlindMode && allCompleted) {
        recordSpecialtyCompletion();
        const nextBtn = document.getElementById('btn-top-new-case');
        if (nextBtn) {
            nextBtn.style.background = '#10b981';
            nextBtn.innerText = '✔ Gelöst! Neuer Fall ➔';
        }
    }
};

function closeRevealModal() {
    document.getElementById('reveal-modal')?.remove();
}
window.closeRevealModal = closeRevealModal;

window.revealDiagnosis = function() {
    if (!window.activeCaseData) return;
    const meta = window.activeCaseData.metadata || {};
    const doc = window.activeCaseData.extra_tasks?.doctordle;
    const pearl = (Array.isArray(doc) ? doc[0] : doc)?.learning_pearl || '';
    const summary = window.activeCaseData.case_overview?.summary || '';
    const field = meta.medical_field || specialtySession.field || 'Fachgebiet';
    const primary = meta.primary_disease || meta.title || window.activeCaseData.case_id;

    const modalHtml = `
        <div id="reveal-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
            <div style="background:#1e293b; border:1px solid #334155; border-radius:14px; max-width:550px; width:100%; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.6); color:#f8fafc;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span style="background:#0284c7; color:#fff; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">${escapeHtml(field)}</span>
                    <button type="button" onclick="window.closeRevealModal()" style="background:none; border:none; color:#94a3b8; font-size:1.4rem; cursor:pointer;">&times;</button>
                </div>
                <span style="color:#94a3b8; font-size:0.8rem; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Diagnose:</span>
                <h2 style="color:#38bdf8; margin:4px 0 8px 0; font-size:1.4rem;">${escapeHtml(primary)}</h2>
                <p style="color:#cbd5e1; font-size:0.9rem; margin-bottom:16px;">${escapeHtml(meta.title || '')}</p>

                ${summary ? `
                    <div style="background:#0f172a; padding:12px; border-radius:8px; border-left:3px solid #38bdf8; margin-bottom:14px;">
                        <h4 style="margin:0 0 6px 0; font-size:0.85rem; color:#94a3b8;">Pathophysiologische Synthese:</h4>
                        <p style="margin:0; font-size:0.85rem; line-height:1.4;">${escapeHtml(summary)}</p>
                    </div>
                ` : ''}

                ${pearl ? `
                    <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; padding:12px; border-radius:8px; margin-bottom:18px;">
                        <strong style="color:#10b981; font-size:0.85rem;">💡 Klinische Take-Home-Pearl:</strong>
                        <p style="margin:4px 0 0 0; font-size:0.85rem;">${escapeHtml(pearl)}</p>
                    </div>
                ` : ''}

                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button type="button" onclick="window.closeRevealModal()" style="background:#334155; color:#fff; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.85rem;">Schließen</button>
                    <button type="button" onclick="window.nextSpecialtyCase()" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.85rem;">Neuer Fall ➔</button>
                </div>
            </div>
        </div>
    `;

    closeRevealModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

function showSpecialtyFinished() {
    const field = specialtySession.field || 'Fachrichtung';
    const modalHtml = `
        <div id="reveal-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
            <div style="background:#1e293b; border:1px solid #38bdf8; border-radius:14px; max-width:500px; width:100%; padding:28px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.6); color:#f8fafc;">
                <div style="font-size:2.5rem; margin-bottom:10px;">🏆</div>
                <h2 style="color:#38bdf8; margin:0 0 10px 0;">Fachrichtung abgeschlossen!</h2>
                <p style="color:#cbd5e1; font-size:0.9rem; line-height:1.5; margin-bottom:20px;">
                    Du hast alle verfügbaren Krankheitsbilder aus dem Fachbereich <strong>${escapeHtml(field)}</strong> durchgespielt.
                </p>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button type="button" onclick="SpecialtyStore.resetCompleted('${escapeHtml(field)}'); window.startSpecialty('${escapeHtml(field)}');" style="background:#0284c7; color:#fff; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.9rem;">
                        🔄 Fachrichtung erneut trainieren
                    </button>
                    <button type="button" onclick="window.closeRevealModal(); window.switchTab('dashboard', document.querySelectorAll('.nav-item')[0]); window.setLearningMode('specialty');" style="background:#334155; color:#fff; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">
                        Zurück zur Fachrichtungs-Übersicht
                    </button>
                </div>
            </div>
        </div>
    `;
    closeRevealModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ============================================================================
// DASHBOARD-HUB RENDERING
// ============================================================================
window.setLearningMode = function(mode) {
    const specialty = mode === 'specialty';
    const set = (id, display) => { 
        const el = document.getElementById(id); 
        if (el) el.style.display = display; 
    };
    
    set('topic-grid', specialty ? 'none' : 'block');
    set('specialty-hub', specialty ? 'block' : 'none');
    
    document.getElementById('seg-topic')?.classList.toggle('active', !specialty);
    document.getElementById('seg-specialty')?.classList.toggle('active', specialty);
    
    if (specialty) window.renderSpecialtyHub();
};

window.renderSpecialtyHub = function() {
    const hub = document.getElementById('specialty-hub');
    if (!hub) return;

    const fields = {};
    const all = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
    all.forEach(c => {
        const f = (c.metadata?.medical_field || c.folder_name || c.medical_field || '').trim();
        if (f) fields[f] = (fields[f] || 0) + 1;
    });

    const entries = Object.entries(fields).sort((a, b) => a[0].localeCompare(b[0], 'de'));
    if (!entries.length) {
        hub.innerHTML = '<div style="color:#94a3b8; padding:20px;">Keine Fachrichtungen verfügbar.</div>';
        return;
    }

    hub.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:16px; margin-top:15px;">
            ${entries.map(([field, count]) => {
                const ids = new Set(getSpecialtyCases(field).map(c => c.case_id));
                const done = SpecialtyStore.get(field).completedCaseIds.filter(id => ids.has(id)).length;
                const pct = count ? Math.round((done / count) * 100) : 0;
                return `
                    <div class="specialty-card" role="button" tabindex="0" onclick="window.startSpecialty('${escapeHtml(field)}')" style="background:#1e293b; border:1px solid #334155; padding:18px; border-radius:12px; cursor:pointer;">
                        <h3 style="color:#38bdf8; margin:0 0 8px 0; font-size:1.05rem;">${escapeHtml(field)}</h3>
                        <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:0.8rem; margin-bottom:8px;">
                            <span>${count}${count === 1 ? 'Krankheitsbild' : 'Krankheitsbilder'}</span>
                            <span>${done}/${count} gelöst</span>
                        </div>
                        <div style="background:rgba(0,0,0,0.4); height:6px; border-radius:10px; overflow:hidden;">
                            <div style="width:${pct}%; background:#10b981; height:100%;"></div>
                        </div>
                    </div>`;
            }).join('')}
        </div>
    `;
};

// ============================================================================
// EVENT-LISTENER & EXPORT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    ensureTopNewCaseButton();
    window.setLearningMode('topic');
});

window.SpecialtyEngine = {
    start: (name) => window.startSpecialty(name),
    nextCase: () => window.nextSpecialtyCase()
};
