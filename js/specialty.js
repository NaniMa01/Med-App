/**
 * js/specialty.js - Lernen nach Fachrichtung (Strikte Überordner-Architektur)
 * Gruppiert alle Unterthemen in ihre Überordner (z. B. "Nervensystem und Sinnesorgane",
 * "Psyche / Ethik / Recht", "Reproduktion", "Allgemein" + eigene Überordner)
 * und fragt beim Starten ALLE darin enthaltenen Themen in zufälliger Reihenfolge ab.
 */

const SPECIALTY_STORAGE_KEY = 'medcheck_specialty_progress';

const specialtySession = {
    field: null,       // Name des aktiven Überordners (oder "ALL_MIXED" bei Gesamt-Rotation)
    queue: [],         // Zufällige Queue aller noch zu lösenden case_ids dieses Überordners
    totalCount: 0,     // Gesamtzahl der Fälle im Überordner für diesen Durchlauf
    currentIndex: 0,   // Aktuelle Position (1-basiert für UI)
    currentId: null,   // Aktuelle case_id
    recorded: false
};

// ============================================================================
// 1. SPEICHER & PERSISTENZ
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
// 2. ÜBERORDNER-AUFLÖSUNG (DIREKT AUS LOCALSTORAGE & APP-STATE)
// ============================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

/**
 * Liest alle existierenden Überordner in der korrekten Reihenfolge aus
 */
function getActiveSuperFoldersList() {
    if (typeof window.getSuperFolderOrder === 'function') {
        return window.getSuperFolderOrder();
    }
    const defaults = [
        'Nervensystem und Sinnesorgane',
        'Psyche / Ethik / Recht',
        'Reproduktion',
        'Allgemein'
    ];
    try {
        const savedOrder = JSON.parse(localStorage.getItem('medcheck_super_folder_order_v1') || 'null');
        if (Array.isArray(savedOrder) && savedOrder.length > 0) {
            return savedOrder;
        }
    } catch (e) {}
    return defaults;
}

/**
 * Ordnet jeden Unterordner / jedes Thema zuverlässig seinem Überordner zu.
 * Berücksichtigt: 1. Manuelle Drag&Drop-Zuweisung, 2. App-Funktion, 3. Erweiterte Klinik-Heuristik.
 */
function getSuperFolderForSubTopic(subTopicName) {
    if (!subTopicName) return 'Allgemein';
    const clean = subTopicName.trim();
    const availableSupers = getActiveSuperFoldersList();

    // 1. Vom Nutzer gespeicherte Zuordnung aus dem Dashboard prüfen
    try {
        const mapping = JSON.parse(localStorage.getItem('medcheck_folder_super_mapping') || '{}');
        if (mapping[clean] && availableSupers.includes(mapping[clean])) {
            return mapping[clean];
        }
    } catch (e) {}

    // 2. Direkter Treffer, falls der Ordner bereits wie ein Überordner heißt
    const directMatch = availableSupers.find(s => s.toLowerCase() === clean.toLowerCase());
    if (directMatch) return directMatch;

    // 3. Erweiterte medizinische Heuristik (inkl. Basler Vorlesungs-Präfixe 29.2.x & 0.30.x)
    const lower = clean.toLowerCase();

    if (
        lower.includes('0.30.') || lower.includes('psych') || lower.includes('ethik') || 
        lower.includes('recht') || lower.includes('forensik') || lower.includes('sucht') || 
        lower.includes('schizophren') || lower.includes('neurotisch') || lower.includes('anpassung') ||
        lower.includes('affektiv') || lower.includes('persönlichkeits') || lower.includes('suizid')
    ) {
        return availableSupers.includes('Psyche / Ethik / Recht') ? 'Psyche / Ethik / Recht' : 'Allgemein';
    }

    if (
        lower.includes('29.2.') || lower.includes('neuro') || lower.includes('nerv') || 
        lower.includes('sinnes') || lower.includes('auge') || lower.includes('ophthal') || 
        lower.includes('hno') || lower.includes('hals-nasen') || lower.includes('ohr') || 
        lower.includes('myelon') || lower.includes('rückenmark') || lower.includes('hirn') || 
        lower.includes('anfallsleiden') || lower.includes('epilep') || lower.includes('bewegungsstörung') || 
        lower.includes('parkinson') || lower.includes('demenz') || lower.includes('infektionen des zentralen') ||
        lower.includes('tumore') || lower.includes('schwindel') || lower.includes('kopfschmerz')
    ) {
        return availableSupers.includes('Nervensystem und Sinnesorgane') ? 'Nervensystem und Sinnesorgane' : 'Allgemein';
    }

    if (
        lower.includes('repro') || lower.includes('gyn') || lower.includes('geburt') || 
        lower.includes('schwanger') || lower.includes('fertilit') || lower.includes('zyklus') || 
        lower.includes('ovari') || lower.includes('uterus') || lower.includes('mamma')
    ) {
        return availableSupers.includes('Reproduktion') ? 'Reproduktion' : 'Allgemein';
    }

    // 4. Fallback auf globale Funktion aus app.js (falls vorhanden)
    if (typeof window.getSuperFolderForCategory === 'function') {
        return window.getSuperFolderForCategory(clean);
    }

    return 'Allgemein';
}

function resolveSubTopicForCase(caseObj) {
    if (!caseObj) return 'Allgemein';
    return (caseObj.folder_name || caseObj.metadata?.medical_field || caseObj.medical_field || 'Allgemein').trim();
}

function resolveSuperFolderForCase(caseObj) {
    if (!caseObj) return 'Allgemein';
    const subTopic = resolveSubTopicForCase(caseObj);
    return getSuperFolderForSubTopic(subTopic);
}

/**
 * Holt ausnahmslos ALLE Fälle, die im gewählten Überordner liegen
 */
function getSpecialtyCases(superFolderName) {
    const all = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
    if (superFolderName === '__ALL_SUPER_FOLDERS__') {
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
 * Erstellt die zufällige Queue für ALLE Themen innerhalb des gewählten Überordners.
 * Noch nicht gelöste Themen kommen zuerst dran; sind alle gelöst, werden alle frisch gemischt.
 */
function buildQueue(superFolderName) {
    const allMatching = getSpecialtyCases(superFolderName);
    const allIds = allMatching.map(c => c.case_id);
    const doneSet = new Set(SpecialtyStore.get(superFolderName).completedCaseIds.filter(id => allIds.includes(id)));

    const unsolved = shuffleFisherYates(allIds.filter(id => !doneSet.has(id)));
    if (unsolved.length > 0) {
        return unsolved;
    }
    return shuffleFisherYates(allIds);
}

// ============================================================================
// 3. TOP-BUTTONS IM PLAYER ("🔍 Diagnose" & "Nächstes Thema ➔")
// ============================================================================
function ensureTopNewCaseButton() {
    const badge = document.getElementById('player-case-badge-title');
    const wrap = badge ? badge.parentElement : null;
    if (!wrap) return;

    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';
    wrap.style.flexWrap = 'wrap';

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
// 4. STEUERUNG DES FACHRICHTUNGS-MODUS (ÜBERORDNER-SESSION)
// ============================================================================
function startSpecialty(superFolderName) {
    const cases = getSpecialtyCases(superFolderName);
    if (!cases.length) {
        alert(`Im Überordner "${superFolderName}" befinden sich aktuell noch keine Fälle.`);
        return;
    }

    const validIds = new Set(cases.map(c => c.case_id));
    const completedInSuper = SpecialtyStore.get(superFolderName).completedCaseIds.filter(id => validIds.has(id));

    // Wenn bereits alle Themen in diesem Überordner gelöst wurden -> für neuen Durchlauf zurücksetzen
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
}

function nextSpecialtyCase() {
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
                : 'Fachrichtung abschließen ✓';
        }

        window.loadCaseById(nextId, { specialty: true });
        setTimeout(ensureTopNewCaseButton, 50);
        return;
    }

    // Wenn die Queue leer ist, wurden alle Themen des Überordners abgefragt!
    showSpecialtyFinished();
}

function applyBlindHeader(blind, caseData) {
    ensureTopNewCaseButton();

    const badge = document.getElementById('player-case-badge-title');
    const wrap = badge ? badge.parentElement : null;

    if (wrap && wrap.firstChild && wrap.firstChild.nodeType === Node.TEXT_NODE) {
        wrap.firstChild.nodeValue = blind ? 'Überordner: ' : 'Aktiver Fall: ';
    }

    if (badge) {
        if (blind) {
            const rawField = specialtySession.field || resolveSuperFolderForCase(caseData);
            const displayField = rawField === '__ALL_SUPER_FOLDERS__' ? '⚡ Gesamt-Rotation (Alle Fächer)' : rawField;
            const progressText = specialtySession.totalCount > 0 
                ? ` • Fall ${specialtySession.currentIndex}/${specialtySession.totalCount}` 
                : '';
            badge.innerText = `${displayField}${progressText}`;
        } else if (caseData) {
            badge.innerText = caseData.metadata?.title || caseData.case_id || '';
        }
    }

    const overviewTab = document.getElementById('tab-btn-overview');
    if (overviewTab) {
        overviewTab.style.display = blind ? 'none' : '';
    }
}

// ============================================================================
// 5. FORTSCHRITT & REVEAL-MODALS
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

    // Falls in der Gesamt-Rotation gelöst, auch im jeweiligen Überordner als gelöst vermerken
    if (superField === '__ALL_SUPER_FOLDERS__') {
        const actualSuper = resolveSuperFolderForCase(window.activeCaseData);
        const subEntry = SpecialtyStore.get(actualSuper);
        if (!subEntry.completedCaseIds.includes(window.activeCaseData.case_id)) {
            subEntry.completedCaseIds.push(window.activeCaseData.case_id);
            SpecialtyStore.save(actualSuper, subEntry);
        }
    }
}

function onSpecialtyCompletionChange(allCompleted) {
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
}

function closeRevealModal() {
    document.getElementById('reveal-modal')?.remove();
}

function revealDiagnosis() {
    if (!window.activeCaseData) return;
    const meta = window.activeCaseData.metadata || {};
    const doc = window.activeCaseData.extra_tasks?.doctordle;
    const pearl = (Array.isArray(doc) ? doc[0] : doc)?.learning_pearl || '';
    const summary = window.activeCaseData.case_overview?.summary || '';
    const superField = resolveSuperFolderForCase(window.activeCaseData);
    const subTopic = resolveSubTopicForCase(window.activeCaseData);
    const primary = meta.primary_disease || meta.title || window.activeCaseData.case_id;
    const hasMore = specialtySession.queue && specialtySession.queue.length > 0;

    const modalHtml = `
        <div id="reveal-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.82); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
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
}

function showSpecialtyFinished() {
    const rawField = specialtySession.field || 'Fachrichtung';
    const displayField = rawField === '__ALL_SUPER_FOLDERS__' ? 'Gesamt-Rotation (Alle Überordner)' : rawField;
    const escapedFieldJs = escapeHtml(rawField).replace(/'/g, "\\'");
    const totalPlayed = specialtySession.totalCount || getSpecialtyCases(rawField).length;

    const modalHtml = `
        <div id="reveal-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
            <div style="background:#1e293b; border:1px solid #38bdf8; border-radius:14px; max-width:500px; width:100%; padding:28px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.6); color:#f8fafc;">
                <div style="font-size:2.6rem; margin-bottom:10px;">🏆</div>
                <h2 style="color:#38bdf8; margin:0 0 10px 0;">Überordner komplett gemeistert!</h2>
                <p style="color:#cbd5e1; font-size:0.92rem; line-height:1.5; margin-bottom:20px;">
                    Du hast alle <strong>${totalPlayed} Fälle & Themen</strong> aus <strong>${escapeHtml(displayField)}</strong> restlos durchgespielt!
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
// 6. DASHBOARD-HUB RENDERING (ZEIGT NUR DIE ÜBERORDNER ALS KARTEN)
// ============================================================================
function setLearningMode(mode) {
    const isSpecialty = mode === 'specialty';
    const topicWrapper = document.getElementById('super-folders-wrapper') || document.getElementById('topic-grid');
    const specialtyHub = document.getElementById('specialty-hub');

    if (topicWrapper) topicWrapper.style.display = isSpecialty ? 'none' : 'flex';
    if (specialtyHub) specialtyHub.style.display = isSpecialty ? 'block' : 'none';

    document.getElementById('seg-topic')?.classList.toggle('active', !isSpecialty);
    document.getElementById('seg-specialty')?.classList.toggle('active', isSpecialty);

    if (isSpecialty) renderSpecialtyHub();
}

function renderSpecialtyHub() {
    const hub = document.getElementById('specialty-hub');
    if (!hub) return;

    const allCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
    const superOrder = getActiveSuperFoldersList();

    // Map für alle Überordner anlegen
    const superMap = new Map();
    superOrder.forEach(sTitle => {
        superMap.set(sTitle, { cases: [], subTopics: new Map() });
    });

    // Alle Fälle ihrem jeweiligen Überordner zuweisen und Unterthemen zählen
    allCases.forEach(c => {
        const sTitle = resolveSuperFolderForCase(c);
        const subTopic = resolveSubTopicForCase(c);

        if (!superMap.has(sTitle)) {
            superMap.set(sTitle, { cases: [], subTopics: new Map() });
        }
        const entry = superMap.get(sTitle);
        entry.cases.push(c);
        entry.subTopics.set(subTopic, (entry.subTopics.get(subTopic) || 0) + 1);
    });

    const entries = Array.from(superMap.entries());
    if (!entries.length) {
        hub.innerHTML = '<div style="color:#94a3b8; padding:20px;">Keine Überordner verfügbar.</div>';
        return;
    }

    // Berechne Gesamt-Statistik für die Staatsexamens-Gesamtrotation
    const totalAllCases = allCases.length;

    hub.innerHTML = `
        <!-- Master-Banner für interdisziplinäre Staatsexamens-Rotation über alle Überordner -->
        <div onclick="window.startSpecialty('__ALL_SUPER_FOLDERS__')" role="button" tabindex="0"
             style="margin-top:15px; margin-bottom:18px; padding:16px 20px; border-radius:14px; background:linear-gradient(135deg, rgba(2,132,199,0.22), rgba(99,102,241,0.18)); border:1px solid rgba(56,189,248,0.45); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; cursor:pointer; transition:transform 0.18s ease;">
            <div>
                <div style="display:flex; align-items:center; gap:8px; color:#38bdf8; font-weight:800; font-size:1rem;">
                    <span>⚡ Staatsexamens-Modus: Blind-Triage über alle Überordner</span>
                </div>
                <div style="color:#cbd5e1; font-size:0.82rem; margin-top:3px;">
                    Mischt alle <strong>${totalAllCases} Krankheitsbilder</strong> aus sämtlichen Fachrichtungen ohne Vorab-Hinweis auf das Organsystem.
                </div>
            </div>
            <button type="button" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:700; font-size:0.84rem; cursor:pointer; white-space:nowrap;">
                Gesamt-Rotation starten ➔
            </button>
        </div>

        <!-- Karten der Überordner (Fachrichtungen) -->
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); gap:18px;">
            ${entries.map(([superTitle, data]) => {
                const count = data.cases.length;
                const subTopicsEntries = Array.from(data.subTopics.entries());
                const validIds = new Set(data.cases.map(c => c.case_id));
                const done = SpecialtyStore.get(superTitle).completedCaseIds.filter(id => validIds.has(id)).length;
                const pct = count > 0 ? Math.round((done / count) * 100) : 0;
                const escapedSuperJs = escapeHtml(superTitle).replace(/'/g, "\\'");

                const topicsPillsHtml = subTopicsEntries.length > 0
                    ? subTopicsEntries.map(([topicName, topicCaseCount]) => 
                        `<span style="background:rgba(15,23,42,0.75); border:1px solid rgba(56,189,248,0.25); color:#e2e8f0; padding:4px 9px; border-radius:8px; font-size:0.74rem; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
                            <span>📁 ${escapeHtml(topicName)}</span>
                            <span style="color:#38bdf8; font-family:'JetBrains Mono', monospace; font-size:0.7rem;">(${topicCaseCount})</span>
                        </span>`
                      ).join('')
                    : `<span style="color:#64748b; font-size:0.78rem; font-style:italic;">Noch keine Themen in diesem Überordner</span>`;

                return `
                    <div class="specialty-card" role="button" tabindex="0" 
                         onclick="window.startSpecialty('${escapedSuperJs}')" 
                         style="background:#1e293b; border:1px solid ${count > 0 ? '#334155' : 'rgba(51,65,85,0.4)'}; padding:22px; border-radius:14px; cursor:${count > 0 ? 'pointer' : 'not-allowed'}; opacity:${count > 0 ? '1' : '0.6'}; display:flex; flex-direction:column; justify-content:space-between; gap:16px; transition:all 0.2s ease; box-shadow:0 4px 16px rgba(0,0,0,0.25);">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:12px;">
                                <h3 style="color:#38bdf8; margin:0; font-size:1.15rem; font-weight:800; line-height:1.3;">
                                    📂 ${escapeHtml(superTitle)}
                                </h3>
                                <span style="background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:3px 9px; border-radius:20px; font-size:0.73rem; font-weight:700; white-space:nowrap;">
                                    ${subTopicsEntries.length} ${subTopicsEntries.length === 1 ? 'Thema' : 'Themen'}
                                </span>
                            </div>
                            <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.4px;">
                                Enthaltene Themenbereiche (Zufalls-Pool):
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:6px; max-height:135px; overflow-y:auto; padding-right:2px;">
                                ${topicsPillsHtml}
                            </div>
                        </div>

                        <div style="border-top:1px solid rgba(148,163,184,0.12); padding-top:12px;">
                            <div style="display:flex; justify-content:space-between; color:#cbd5e1; font-size:0.82rem; margin-bottom:7px; font-weight:700;">
                                <span>🎯 ${count} ${count === 1 ? 'Krankheitsbild' : 'Krankheitsbilder'} gesamt</span>
                                <span style="color:${pct === 100 && count > 0 ? '#10b981' : '#38bdf8'};">${done}/${count} gelöst (${pct}%)</span>
                            </div>
                            <div style="background:rgba(0,0,0,0.5); height:8px; border-radius:10px; overflow:hidden;">
                                <div style="width:${pct}%; background:${pct === 100 ? '#10b981' : '#38bdf8'}; height:100%; transition:width 0.3s ease;"></div>
                            </div>
                        </div>
                    </div>`;
            }).join('')}
        </div>
    `;
}

// ============================================================================
// 7. BINDING & OVERRIDE-SCHUTZ GEGEN LEGACY-CODE IN APP.JS
// ============================================================================
function bindSpecialtyGlobals() {
    window.startSpecialty = startSpecialty;
    window.startSpecialtyMode = startSpecialty;
    window.nextSpecialtyCase = nextSpecialtyCase;
    window.applyBlindHeader = applyBlindHeader;
    window.onSpecialtyCompletionChange = onSpecialtyCompletionChange;
    window.closeRevealModal = closeRevealModal;
    window.revealDiagnosis = revealDiagnosis;
    window.setLearningMode = setLearningMode;
    window.renderSpecialtyHub = renderSpecialtyHub;
    window.SpecialtyEngine = {
        start: (name) => startSpecialty(name),
        nextCase: () => nextSpecialtyCase()
    };
}

// Sofort binden
bindSpecialtyGlobals();

// Und nach dem Laden von app.js (DOMContentLoaded) erneut binden, 
// damit alte Funktionen in app.js unsere Überordner-Ansicht NIEMALS überschreiben können!
document.addEventListener('DOMContentLoaded', () => {
    bindSpecialtyGlobals();
    ensureTopNewCaseButton();
});
window.addEventListener('load', () => {
    bindSpecialtyGlobals();
});
