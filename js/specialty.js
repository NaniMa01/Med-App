/**
 * js/specialty.js - Lernen nach Fachrichtung (Blind-Modus, Session-Queue, Diagnose-Enthüllung, persistenter Fortschritt)
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
// SPEICHER & PERSISTENZ (PUNKTE & FORTSCHRITT)
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
// HILFSFUNKTIONEN FÜR FÄLLE & SHUFFLE
// ============================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function getSpecialtyCases(field) {
    const norm = (field || '').trim().toLowerCase();
    return window.getRegisteredCases().filter(c => {
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
    
    // Ungelöste Fälle zuerst, jeweils zufällig gemischt
    const unsolved = shuffleFisherYates(ids.filter(id => !done.has(id)));
    const solved = shuffleFisherYates(ids.filter(id => done.has(id)));
    return [...unsolved, ...solved];
}

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

    if (!specialtySession.queue || specialtySession.queue.length === 0) {
        showSpecialtyFinished();
        return;
    }

    const nextId = specialtySession.queue.shift();
    specialtySession.currentIndex++;
    specialtySession.currentId = nextId;

    window.loadCaseById(nextId, { specialty: true });
};

// ============================================================================
// DYNAMISCHE STEUERUNGSLEISTE & BLIND-HEADER
// ============================================================================
function ensureSpecialtyStickyBar() {
    let bar = document.getElementById('specialty-sticky-bar');
    
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'specialty-sticky-bar';
        bar.className = 'specialty-sticky-bar';

        // Direkt vor die Challenge-Tabs im Player einfügen
        const navTabs = document.querySelector('.player-nav-tabs') || document.getElementById('tab-btn-overview')?.parentElement;
        if (navTabs && navTabs.parentElement) {
            navTabs.parentElement.insertBefore(bar, navTabs);
        } else {
            const playerView = document.getElementById('player-view') || document.body;
            playerView.insertBefore(bar, playerView.firstChild);
        }
    }

    bar.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#0f172a; padding:10px 16px; border-radius:10px; margin-bottom:14px; border:1px solid #38bdf8; box-shadow: 0 4px 14px rgba(0,0,0,0.4); gap:10px; flex-wrap:wrap;';

    const currentNum = specialtySession.currentIndex || 1;
    const totalNum = specialtySession.totalCount || 1;
    const fieldName = specialtySession.field || 'Fachrichtung';

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <button type="button" id="btn-exit-specialty" style="background:#334155; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.82rem;">✕ Beenden</button>
            <span id="specialty-pill-name" style="background:#0284c7; color:#fff; padding:4px 10px; border-radius:12px; font-size:0.78rem; font-weight:700;">${escapeHtml(fieldName)}</span>
            <span id="specialty-pill-counter" style="background:#1e293b; color:#94a3b8; padding:4px 8px; border-radius:12px; font-size:0.75rem;">Fall ${currentNum} / ${totalNum}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" id="btn-reveal-diagnosis" style="background:transparent; border:1px solid #38bdf8; color:#38bdf8; padding:6px 14px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.82rem;">🔍 Diagnose enthüllen</button>
            <button type="button" id="btn-next-specialty-case" style="background:#0284c7; color:#fff; border:none; padding:7px 16px; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.85rem; box-shadow:0 2px 8px rgba(2,132,199,0.4);">Nächstes Krankheitsbild ➔</button>
        </div>
    `;

    return bar;
}

window.applyBlindHeader = function(blind, caseData) {
    const badge = document.getElementById('player-case-badge-title');
    const wrap = badge?.parentElement;
    const field = caseData?.metadata?.medical_field || specialtySession.field || 'Fachrichtung';

    // 1. Text und Titel setzen
    if (wrap && wrap.firstChild && wrap.firstChild.nodeType === Node.TEXT_NODE) {
        wrap.firstChild.nodeValue = blind ? '' : 'Aktiver Fall: ';
    }
    if (badge && caseData) {
        badge.innerText = blind ? `${field} • Training` : (caseData.metadata?.title || caseData.case_id);
    }

    // 2. Den Button "Neuer Fall ➔" oben rechts garantieren
    let topNewBtn = document.getElementById('btn-top-new-case');
    if (!topNewBtn && wrap) {
        // Container für Badge & Button auf Flexbox stellen
        wrap.style.display = 'inline-flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';

        topNewBtn = document.createElement('button');
        topNewBtn.id = 'btn-top-new-case';
        topNewBtn.type = 'button';
        topNewBtn.innerHTML = 'Neuer Fall ➔';
        topNewBtn.style.cssText = 'background: #0284c7; color: #ffffff; border: none; padding: 5px 12px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4); margin-left: 8px;';
        
        topNewBtn.onmouseover = () => topNewBtn.style.background = '#0369a1';
        topNewBtn.onmouseout = () => topNewBtn.style.background = '#0284c7';

        topNewBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.nextSpecialtyCase === 'function') {
                window.nextSpecialtyCase();
            } else if (window.SpecialtyEngine && typeof window.SpecialtyEngine.nextCase === 'function') {
                window.SpecialtyEngine.nextCase();
            }
        };

        wrap.appendChild(topNewBtn);
    }

    // Im Fachrichtungs-Modus die Übersicht ausblenden (Blind-Modus)
    const overviewTab = document.getElementById('tab-btn-overview');
    if (overviewTab) overviewTab.style.display = blind ? 'none' : '';
};

// ============================================================================
// ABSCHLUSS & FORTSCHRITTSTRACKING
// ============================================================================
function recordSpecialtyCompletion() {
    if (specialtySession.recorded || !activeCaseData) return;
    specialtySession.recorded = true;
    
    const field = (activeCaseData.metadata?.medical_field || specialtySession.field || '').trim();
    if (!field) return;

    const reward = activeCaseData.metadata?.xp_reward || 900;
    const entry = SpecialtyStore.get(field);
    
    if (!entry.completedCaseIds.includes(activeCaseData.case_id)) {
        entry.completedCaseIds.push(activeCaseData.case_id);
    }
    entry.totalScore += reward;
    entry.lastPlayed = new Date().toISOString();
    SpecialtyStore.save(field, entry);
}

window.onSpecialtyCompletionChange = function(allCompleted) {
    if (window.isSpecialtyBlindMode && allCompleted) {
        recordSpecialtyCompletion();
        const nextBtn = document.getElementById('btn-next-specialty-case');
        if (nextBtn) {
            nextBtn.style.background = 'var(--color-symptom, #10b981)';
            nextBtn.innerText = '✔ Gelöst! Nächstes Krankheitsbild ➔';
        }
    }
};

// ============================================================================
// ENTHÜLLUNGS-MODAL
// ============================================================================
function closeRevealModal() {
    document.getElementById('reveal-modal')?.remove();
}
window.closeRevealModal = closeRevealModal;

window.revealDiagnosis = function() {
    if (!activeCaseData) return;
    const meta = activeCaseData.metadata || {};
    const doc = activeCaseData.extra_tasks?.doctordle;
    const pearl = (Array.isArray(doc) ? doc[0] : doc)?.learning_pearl || '';
    const summary = activeCaseData.case_overview?.summary || '';
    const field = meta.medical_field || specialtySession.field || 'Fachgebiet';
    const primary = meta.primary_disease || meta.title || activeCaseData.case_id;

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
                    <button type="button" onclick="window.nextSpecialtyCase()" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.85rem;">Nächstes Krankheitsbild ➔</button>
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
                    Du hast alle verfügbaren Krankheitsbilder aus dem Fachbereich <strong>${escapeHtml(field)}</strong> in dieser Session durchgespielt.
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
    window.getRegisteredCases().forEach(c => {
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
                    <div class="specialty-card" role="button" tabindex="0" onclick="window.startSpecialty('${escapeHtml(field)}')" style="background:#1e293b; border:1px solid #334155; padding:18px; border-radius:12px; cursor:pointer; transition:transform 0.15s ease;">
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
// GLOBALE EVENT-DELEGATION (Klick-Handler)
// ============================================================================
document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-next-specialty-case')) {
        e.preventDefault();
        window.nextSpecialtyCase();
        return;
    }
    if (e.target.closest('#btn-reveal-diagnosis')) {
        e.preventDefault();
        window.revealDiagnosis();
        return;
    }
    if (e.target.closest('#btn-exit-specialty')) {
        e.preventDefault();
        window.isSpecialtyBlindMode = false;
        window.applyBlindHeader(false, null);
        window.switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
        return;
    }
});

// Alias-Objekt für eventuelle externe Aufrufe
window.SpecialtyEngine = {
    start: (name) => window.startSpecialty(name),
    nextCase: () => window.nextSpecialtyCase()
};
