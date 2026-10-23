/**
 * js/specialty.js - Lernen nach Fachrichtung (Überordner-Queue, Notaufnahme Blind-Triage, Reveal & Auto-Header)
 */

const SPECIALTY_STORAGE_KEY = 'medcheck_specialty_progress';
const ALL_TRIAGE_KEY = '__ALL_TRIAGE__';

const specialtySession = {
    field: null,               // Name des Überordners oder '__ALL_TRIAGE__'
    isTotalBlindTriage: false, // true = Selbst der Überordner wird im Header verborgen
    queue: [],                 // Zufällige Queue aller noch zu lösenden case_ids dieses Durchlaufs
    totalCount: 0,             // Gesamtzahl der Fälle in dieser Session
    currentIndex: 0,           // Aktuelle Position (1-basiert für UI)
    currentId: null,           // Aktuelle case_id
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
        if (field === ALL_TRIAGE_KEY) {
            const all = this.getAll();
            Object.keys(all).forEach(k => {
                all[k].completedCaseIds = [];
            });
            try {
                localStorage.setItem(SPECIALTY_STORAGE_KEY, JSON.stringify(all));
            } catch (e) {}
            return;
        }
        const e = this.get(field);
        this.save(field, { ...e, completedCaseIds: [] });
    },
    getAllCompletedIdsSet() {
        const all = this.getAll();
        const set = new Set();
        Object.values(all).forEach(entry => {
            if (Array.isArray(entry.completedCaseIds)) {
                entry.completedCaseIds.forEach(id => set.add(id));
            }
        });
        return set;
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
 * Liefert ALLE Fälle eines bestimmten Überordners (oder ALLE Fälle bei '__ALL_TRIAGE__')
 */
function getSpecialtyCases(superFolderName) {
    const all = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
    if (superFolderName === ALL_TRIAGE_KEY) {
        return all;
    }
    const target = (superFolderName || '').trim();
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
 * Baut die Abfrage-Queue auf:
 * Mischt alle noch offenen Fälle des gewählten Überordners (bzw. aller Überordner bei Triage).
 */
function buildQueue(superFolderName) {
    const allMatching = getSpecialtyCases(superFolderName);
    const allIds = allMatching.map(c => c.case_id);

    const doneSet = superFolderName === ALL_TRIAGE_KEY
        ? SpecialtyStore.getAllCompletedIdsSet()
        : new Set(SpecialtyStore.get(superFolderName).completedCaseIds.filter(id => allIds.includes(id)));

    const unsolved = shuffleFisherYates(allIds.filter(id => !doneSet.has(id)));

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

    // 1. Diagnose-Aufdecken-Button
    let revealBtn = document.getElementById('btn-top-reveal-case');
    if (!revealBtn) {
        revealBtn = document.createElement('button');
        revealBtn.id = 'btn-top-reveal-case';
        revealBtn.type = 'button';
        revealBtn.innerHTML = '🔍 Diagnose';
        revealBtn.title = 'Diagnose, Unterthema & Take-Home-Pearl aufdecken';
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
// STEUERUNG DES FACHRICHTUNGS-MODUS & DER NOTAUFNAHME-TRIAGE
// ============================================================================
window.startSpecialty = function(superFolderName) {
    const isTotalBlind = (superFolderName === ALL_TRIAGE_KEY);
    const cases = getSpecialtyCases(superFolderName);

    if (!cases.length) {
        alert(isTotalBlind 
            ? 'Es sind noch keine Fälle im System hinterlegt.' 
            : `Im Überordner "${superFolderName}" befinden sich aktuell noch keine Fälle.`);
        return;
    }

    const validIds = new Set(cases.map(c => c.case_id));
    const doneSet = isTotalBlind 
        ? SpecialtyStore.getAllCompletedIdsSet() 
        : new Set(SpecialtyStore.get(superFolderName).completedCaseIds);
    const completedCount = Array.from(validIds).filter(id => doneSet.has(id)).length;

    // Wenn bereits alle Fälle gelöst wurden -> für kompletten Neu-Durchlauf zurücksetzen
    if (completedCount >= cases.length) {
        SpecialtyStore.resetCompleted(superFolderName);
    }

    specialtySession.field = superFolderName;
    specialtySession.isTotalBlindTriage = isTotalBlind;
    specialtySession.queue = buildQueue(superFolderName);
    specialtySession.totalCount = specialtySession.queue.length;
    specialtySession.currentIndex = 0;
    specialtySession.currentId = null;
    specialtySession.recorded = false;

    window.isSpecialtyBlindMode = true;
    window.nextSpecialtyCase();
};

window.startSpecialtyMode = window.startSpecialty;

window.nextSpecialtyCase = function() {
    window.closeRevealModal();

    if (specialtySession.queue && specialtySession.queue.length > 0) {
        const nextId = specialtySession.queue.shift();
        specialtySession.currentIndex++;
        specialtySession.currentId = nextId;
        specialtySession.recorded = false;

        const nextBtn = document.getElementById('btn-top-new-case');
        if (nextBtn) {
            nextBtn.style.background = '#0284c7';
            const remaining = specialtySession.queue.length;
            nextBtn.innerText = remaining > 0 
                ? `Nächstes Thema (${specialtySession.currentIndex}/${specialtySession.totalCount}) ➔` 
                : 'Durchlauf abschließen ✓';
        }

        window.loadCaseById(nextId, { specialty: true });
        setTimeout(ensure
