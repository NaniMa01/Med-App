/**
 * js/specialty.js - Lernen nach Fachrichtung (Überordner-basiert, Blind-Modus, Session-Queue & Fortschritt)
 */

const SPECIALTY_STORAGE_KEY = 'medcheck_specialty_progress';

const specialtySession = {
    field: null,       // Name des Überordners (Fachrichtung)
    queue: [],         // Zufällige Queue aller noch zu lösenden case_ids dieses Durchlaufs
    totalCount: 0,     // Gesamtzahl der Fälle im Überordner für diesen Durchlauf
    currentIndex: 0,   // Aktuelle Position (1-basiert für UI)
    currentId: null,   // Aktuelle case_id
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
        if (window.Cloud && typeof window.Cloud.scheduleProgressSync === 'function') {
            window.Cloud.scheduleProgressSync();
        }
    },
    resetCompleted(field) {
        const e = this.get(field);
        this.save(field, { ...e, completedCaseIds: [] });
    }
};
window.SpecialtyStore = SpecialtyStore;

// ============================================================================
// HILFSFUNKTIONEN & ÜBERORDNER-MAPPING
// ============================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

/**
 * Ermittelt den zugehörigen Überordner (Fachrichtung) für einen Fall
 */
function resolveSuperFolderForCase(caseObj) {
    if (!caseObj) return 'Allgemein';
    const rawSubCategory = (caseObj.folder_name || caseObj.metadata?.medical_field || caseObj.medical_field || 'Allgemein').trim();
    if (typeof window.getSuperFolderForCategory === 'function') {
        return window.getSuperFolderForCategory(rawSubCategory);
    }
    return 'Allgemein';
}

/**
 * Ermittelt den Namen des Unterordners (Themas) für einen Fall
 */
function resolveSubTopicForCase(caseObj) {
    if (!caseObj) return 'Allgemein';
    return (caseObj.folder_name || caseObj.metadata?.medical_field || caseObj.medical_field || 'Allgemein').trim();
}

/**
 * Liefert ALLE Fälle, die in einem bestimmten Überordner (superFolderName) liegen
 */
function getSpecialtyCases(superFolderName) {
    const target = (superFolderName || '').trim();
    const all = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
    return all.filter(c => resolveSuperFolderForCase(c) === target);
}

function shuffleFisherYates(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Baut die Abfrage-Queue für einen Überordner auf:
 * Stellt sicher, dass alle noch offenen Themen/Fälle in zufälliger Reihenfolge drankommen.
 */
function buildQueue(superFolderName) {
    const allMatching = getSpecialtyCases(superFolderName);
    const allIds = allMatching.map(c => c.case_id);
    const doneSet = new Set(SpecialtyStore.get(superFolderName).completedCaseIds.filter(id => allIds.includes(id)));

    const unsolved = shuffleFisherYates(allIds.filter(id => !doneSet.has(id)));
    
    // Wenn noch ungelöste Fälle im Überordner existieren, fragen wir gezielt diese ab,
    // ansonsten (falls gerade frisch zurückgesetzt) alle Fälle in zufälliger Reihenfolge.
    if (unsolved.length > 0) {
        return unsolved;
    }
    return shuffleFisherYates(allIds);
}

// ============================================================================
// TOP-BUTTONS IM PLAYER ("🔍 Diagnose" & "Nächstes Thema ➔")
// ============================================================================
function ensureTopNewCaseButton() {
    const badge = document.getElementById('player-case-badge-title');
    const wrap = badge ? badge.parentElement : null;
    if (!wrap) return;

    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';
    wrap.style.flexWrap = 'wrap';

    // 1. Diagnose-Aufdecken-Button für den Blind-Modus
    let revealBtn = document.getElementById('btn-top-reveal-case');
    if (!revealBtn) {
        revealBtn = document.createElement('button');
        revealBtn.id = 'btn-top-reveal-case';
        revealBtn.type = 'button';
        revealBtn.innerHTML = '🔍 Diagnose';
        revealBtn.title = 'Diagnose & Take-Home-Pearl aufdecken';
        revealBtn.style.cssText = 'background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 5px 12px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0;';
        revealBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.revealDiagnosis();
        };
        wrap.appendChild(revealBtn);
    }

    // 2. Nächstes Thema / Neuer Fall Button
    let newBtn = document.getElementById('btn-top-new-case');
    if (!newBtn) {
        newBtn = document.createElement('button');
        newBtn.id = 'btn-top-new-case';
        newBtn.type = 'button';
        newBtn.innerHTML = 'Nächstes Thema ➔';
        newBtn.style.cssText = 'background: #0284c7; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4); flex-shrink: 0;';
        newBtn.onmouseenter = () => newBtn.style.background = '#0369a1';
        newBtn.onmouseleave = () => newBtn.style.background = '#0284c7';
        newBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.nextSpecialtyCase();
        };
        wrap.appendChild(newBtn);
    }

    const showBlindControls = !!window.isSpecialtyBlindMode;
    revealBtn.style.display = showBlindControls ? 'inline-flex' : 'none';
    newBtn.style.display = showBlindControls ? 'inline-flex' : 'none';
}

// ============================================================================
// STEUERUNG DES FACHRICHTUNGS-MODUS (ÜBERORDNER-QUEUE)
// ============================================================================
window.startSpecialty = function(superFolderName) {
    const cases = getSpecialtyCases(superFolderName);
    if (!cases.length) {
        alert(`Im Überordner "${superFolderName}" befinden sich aktuell noch keine Fälle.`);
        return;
    }

    const validIds = new Set(cases.map(c => c.case_id));
    const completedInSuper = SpecialtyStore.get(superFolderName).completedCaseIds.filter(id => validIds.has(id));

    // Wenn bereits alle Fälle dieses Überordners einmal durchgespielt wurden -> für neuen Komplett-Durchlauf zurücksetzen
    if (completedInSuper.length >= cases.length) {
        SpecialtyStore.resetCompleted(superFolderName);
    }

    specialtySession.field = superFolderName;
    specialtySession.queue = buildQueue(superFolderName);
    specialtySession.totalCount = specialtySession.queue.length;
    specialtySession.currentIndex = 0;
    specialtySession.currentId = null;
    specialtySession.recorded = false;

    window.isSpecialtyBlindMode = true;
    window.nextSpecialtyCase();
};

// Alias für Abwärtskompatibilität
window.startSpecialtyMode = window.startSpecialty;

window.nextSpecialtyCase = function() {
    window.closeRevealModal();

    // Wenn noch Themen/Fälle in der Queue der aktuellen Fachrichtung warten:
    if (specialtySession.queue && specialtySession.queue.length > 0) {
        const nextId = specialtySession.queue.shift();
        specialtySession.currentIndex++;
        specialtySession.currentId = nextId;
        specialtySession.recorded = false;

        // Button-Optik für den neuen Fall zurücksetzen
        const nextBtn = document.getElementById('btn-top-new-case');
        if (nextBtn) {
            nextBtn.style.background = '#0284c7';
            const remaining = specialtySession.queue.length;
            nextBtn.innerText = remaining > 0 ? `Nächstes Thema (${specialtySession.currentIndex}/${specialtySession.totalCount}) ➔` : 'Fachrichtung abschließen ✓';
        }

        window.loadCaseById(nextId, { specialty: true });
        setTimeout(ensureTopNewCaseButton, 50);
        return;
    }

    // Alle Themen des Überordners wurden restlos abgefragt!
    showSpecialtyFinished();
};

window.applyBlindHeader = function(blind, caseData) {
    ensureTopNewCaseButton();

    const badge = document.getElementById('player-case-badge-title');
    const wrap = badge ? badge.parentElement : null;

    if (wrap && wrap.firstChild && wrap.firstChild.nodeType === Node.TEXT_NODE) {
        wrap.firstChild.nodeValue = blind ? 'Fachrichtung: ' : 'Aktiver Fall: ';
    }

    if (badge) {
        if (blind) {
            const superTitle = specialtySession.field || resolveSuperFolderForCase(caseData);
            const progressText = specialtySession.totalCount > 0 
                ? ` (${specialtySession.currentIndex}/${specialtySession.totalCount})` 
                : '';
            badge.innerText = `${superTitle}${progressText}`;
        } else if (caseData) {
            badge.innerText = caseData.metadata?.title || caseData.case_id || '';
        }
    }

    // Im Blind-Modus wird der Tab "Übersicht" ausgeblendet, um die Diagnose nicht zu verraten
    const overviewTab = document.getElementById('tab-btn-overview');
    if (overviewTab) {
        overviewTab.style.display = blind ? 'none' : '';
    }
};

// ============================================================================
// FORTSCHRITT & MODALS
// ============================================================================
function recordSpecialtyCompletion() {
    if (specialtySession.recorded || !window.activeCaseData) return;
    specialtySession.recorded = true;
    
    const superField = specialtySession.field || resolveSuperFolderForCase(window.activeCaseData);
    if (!superField) return;

    const reward = window.activeCaseData.metadata?.xp_reward || 900;
    const entry = SpecialtyStore.get(superField);
    
    if (!entry.completedCaseIds.includes(window.activeCaseData.case_id)) {
        entry.completedCaseIds.push(window.activeCaseData.case_id);
    }
    entry.totalScore += reward;
    entry.lastPlayed = new Date().toISOString();
    SpecialtyStore.save(superField, entry);
}

window.onSpecialtyCompletionChange = function(allCompleted) {
    if (window.isSpecialtyBlindMode && allCompleted) {
        recordSpecialtyCompletion();
        const nextBtn = document.getElementById('btn-top-new-case');
        if (nextBtn) {
            nextBtn.style.background = '#10b981';
            const hasMore = specialtySession.queue && specialtySession.queue.length > 0;
            nextBtn.innerText = hasMore 
                ? `✔ Gelöst! Nächstes Thema (${specialtySession.currentIndex}/${specialtySession.totalCount}) ➔` 
                : '✔ Gelöst! Fachrichtung abschließen 🏆';
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
    const superField = specialtySession.field || resolveSuperFolderForCase(window.activeCaseData);
    const subTopic = resolveSubTopicForCase(window.activeCaseData);
    const primary = meta.primary_disease || meta.title || window.activeCaseData.case_id;
    const hasMore = specialtySession.queue && specialtySession.queue.length > 0;

    const modalHtml = `
        <div id="reveal-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
            <div style="background:#1e293b; border:1px solid #334155; border-radius:14px; max-width:560px; width:100%; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.6); color:#f8fafc;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span style="background:#0284c7; color:#fff; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">📂 ${escapeHtml(superField)}</span>
                        <span style="background:rgba(148,163,184,0.15); color:#cbd5e1; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:600;">📁 ${escapeHtml(subTopic)}</span>
                    </div>
                    <button type="button" onclick="window.closeRevealModal()" style="background:none; border:none; color:#94a3b8; font-size:1.4rem; cursor:pointer;">&times;</button>
                </div>
                <span style="color:#94a3b8; font-size:0.78rem; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Entschlüsselte Diagnose:</span>
                <h2 style="color:#38bdf8; margin:4px 0 8px 0; font-size:1.35rem;">${escapeHtml(primary)}</h2>
                <p style="color:#cbd5e1; font-size:0.9rem; margin-bottom:16px;">${escapeHtml(meta.title || '')}</p>

                ${summary ? `
                    <div style="background:#0f172a; padding:12px; border-radius:8px; border-left:3px solid #38bdf8; margin-bottom:14px;">
                        <h4 style="margin:0 0 6px 0; font-size:0.82rem; color:#94a3b8;">Pathophysiologische Synthese:</h4>
                        <p style="margin:0; font-size:0.85rem; line-height:1.45;">${escapeHtml(summary)}</p>
                    </div>
                ` : ''}

                ${pearl ? `
                    <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; padding:12px; border-radius:8px; margin-bottom:18px;">
                        <strong style="color:#10b981; font-size:0.85rem;">💡 Klinische Take-Home-Pearl:</strong>
                        <p style="margin:4px 0 0 0; font-size:0.85rem; line-height:1.4;">${escapeHtml(pearl)}</p>
                    </div>
                ` : ''}

                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button type="button" onclick="window.closeRevealModal()" style="background:#334155; color:#fff; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.85rem;">Weiter im Fall</button>
                    <button type="button" onclick="window.nextSpecialtyCase()" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                        ${hasMore ? 'Nächstes Thema ➔' : 'Fachrichtung abschließen 🏆'}
                    </button>
                </div>
            </div>
        </div>
    `;

    closeRevealModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

function showSpecialtyFinished() {
    const field = specialtySession.field || 'Fachrichtung';
    const escapedFieldJs = escapeHtml(field).replace(/'/g, "\\'");
    const totalPlayed = specialtySession.totalCount || getSpecialtyCases(field).length;

    const modalHtml = `
        <div id="reveal-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
            <div style="background:#1e293b; border:1px solid #38bdf8; border-radius:14px; max-width:500px; width:100%; padding:28px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.6); color:#f8fafc;">
                <div style="font-size:2.6rem; margin-bottom:10px;">🏆</div>
                <h2 style="color:#38bdf8; margin:0 0 10px 0;">Fachrichtung komplett gemeistert!</h2>
                <p style="color:#cbd5e1; font-size:0.92rem; line-height:1.5; margin-bottom:20px;">
                    Du hast alle <strong>${totalPlayed} Themen & Krankheitsbilder</strong> aus dem Überordner <strong>${escapeHtml(field)}</strong> erfolgreich durchgespielt!
                </p>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button type="button" onclick="window.SpecialtyStore.resetCompleted('${escapedFieldJs}'); window.startSpecialty('${escapedFieldJs}');" style="background:#0284c7; color:#fff; border:none; padding:11px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.9rem;">
                        🔄 Alle Themen neu mischen & nochmal trainieren
                    </button>
                    <button type="button" onclick="window.closeRevealModal(); window.isSpecialtyBlindMode = false; window.switchTab('dashboard', document.querySelectorAll('.nav-item')[0]); window.setLearningMode('specialty');" style="background:#334155; color:#fff; border:none; padding:11px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">
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
// DASHBOARD-HUB RENDERING (ÜBERORDNER ALS FACHRICHTUNGEN)
// ============================================================================
window.setLearningMode = function(mode) {
    const isSpecialty = mode === 'specialty';
    const topicWrapper = document.getElementById('super-folders-wrapper') || document.getElementById('topic-grid');
    const specialtyHub = document.getElementById('specialty-hub');

    if (topicWrapper) topicWrapper.style.display = isSpecialty ? 'none' : 'flex';
    if (specialtyHub) specialtyHub.style.display = isSpecialty ? 'block' : 'none';

    document.getElementById('seg-topic')?.classList.toggle('active', !isSpecialty);
    document.getElementById('seg-specialty')?.classList.toggle('active', isSpecialty);

    if (isSpecialty) window.renderSpecialtyHub();
};

window.renderSpecialtyHub = function() {
    const hub = document.getElementById('specialty-hub');
    if (!hub) return;

    const allCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
    const superOrder = typeof window.getSuperFolderOrder === 'function' 
        ? window.getSuperFolderOrder() 
        : ['Nervensystem und Sinnesorgane', 'Psyche / Ethik / Recht', 'Reproduktion', 'Allgemein'];

    // Map für alle Überordner initialisieren
    const superMap = new Map();
    superOrder.forEach(sTitle => {
        superMap.set(sTitle, { cases: [], subTopics: new Set() });
    });

    // Auch angelegte Unterordner aus der Ordnerverwaltung berücksichtigen
    const savedSubFolders = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    savedSubFolders.forEach(sub => {
        if (!sub || !sub.trim()) return;
        const cleanSub = sub.trim();
        const sTitle = typeof window.getSuperFolderForCategory === 'function' 
            ? window.getSuperFolderForCategory(cleanSub) 
            : 'Allgemein';
        if (!superMap.has(sTitle)) {
            superMap.set(sTitle, { cases: [], subTopics: new Set() });
        }
        superMap.get(sTitle).subTopics.add(cleanSub);
    });

    // Alle registrierten Fälle ihrem Überordner und Unterthema zuordnen
    allCases.forEach(c => {
        const sTitle = resolveSuperFolderForCase(c);
        const subTopic = resolveSubTopicForCase(c);
        if (!superMap.has(sTitle)) {
            superMap.set(sTitle, { cases: [], subTopics: new Set() });
        }
        const entry = superMap.get(sTitle);
        entry.cases.push(c);
        entry.subTopics.add(subTopic);
    });

    const entries = Array.from(superMap.entries());
    if (!entries.length) {
        hub.innerHTML = '<div style="color:#94a3b8; padding:20px;">Keine Fachrichtungen verfügbar.</div>';
        return;
    }

    hub.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:16px; margin-top:15px;">
            ${entries.map(([superTitle, data]) => {
                const count = data.cases.length;
                const subTopicsList = Array.from(data.subTopics);
                const validIds = new Set(data.cases.map(c => c.case_id));
                const done = SpecialtyStore.get(superTitle).completedCaseIds.filter(id => validIds.has(id)).length;
                const pct = count > 0 ? Math.round((done / count) * 100) : 0;
                const escapedSuperJs = escapeHtml(superTitle).replace(/'/g, "\\'");

                // Themen-Badges rendern (max. 5 direkt + Zähler für weitere)
                const topicsHtml = subTopicsList.length > 0
                    ? subTopicsList.slice(0, 5).map(t => 
                        `<span style="background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25); color:#bae6fd; padding:2px 8px; border-radius:6px; font-size:0.72rem; font-weight:600;">📁 ${escapeHtml(t)}</span>`
                      ).join('') + (subTopicsList.length > 5 ? `<span style="color:#94a3b8; font-size:0.72rem; padding:2px 4px;">+${subTopicsList.length - 5} weitere</span>` : '')
                    : `<span style="color:#64748b; font-size:0.75rem; font-style:italic;">Keine Unterthemen zugeordnet</span>`;

                return `
                    <div class="specialty-card" role="button" tabindex="0" 
                         onclick="window.startSpecialty('${escapedSuperJs}')" 
                         style="background:#1e293b; border:1px solid ${count > 0 ? '#334155' : 'rgba(51,65,85,0.4)'}; padding:20px; border-radius:14px; cursor:${count > 0 ? 'pointer' : 'not-allowed'}; opacity:${count > 0 ? '1' : '0.6'}; display:flex; flex-direction:column; justify-content:space-between; gap:14px; transition:transform 0.18s ease, border-color 0.18s ease;">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:10px;">
                                <h3 style="color:#38bdf8; margin:0; font-size:1.08rem; line-height:1.3;">📂 ${escapeHtml(superTitle)}</h3>
                                <span style="background:rgba(15,23,42,0.7); color:#94a3b8; padding:3px 8px; border-radius:8px; font-size:0.72rem; font-weight:700; white-space:nowrap;">
                                    ${subTopicsList.length} ${subTopicsList.length === 1 ? 'Thema' : 'Themen'}
                                </span>
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
                                ${topicsHtml}
                            </div>
                        </div>

                        <div>
                            <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:0.8rem; margin-bottom:6px; font-weight:600;">
                                <span>${count} ${count === 1 ? 'Fall' : 'Fälle'} im Pool</span>
                                <span style="color:${pct === 100 && count > 0 ? '#10b981' : '#38bdf8'};">${done}/${count} gelöst (${pct}%)</span>
                            </div>
                            <div style="background:rgba(0,0,0,0.45); height:7px; border-radius:10px; overflow:hidden;">
                                <div style="width:${pct}%; background:${pct === 100 ? '#10b981' : '#38bdf8'}; height:100%; transition:width 0.3s ease;"></div>
                            </div>
                        </div>
                    </div>`;
            }).join('')}
        </div>
    `;
};

// ============================================================================
// INITIALISIERUNG & EXPORT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    ensureTopNewCaseButton();
});

window.SpecialtyEngine = {
    start: (name) => window.startSpecialty(name),
    nextCase: () => window.nextSpecialtyCase()
};
