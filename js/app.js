// ====================================================
// GLOBALE STATES & KONFIGURATION
// ====================================================
const CREATOR_EMAIL = 'marco.claudio.nani@gmail.com';
let activeCaseData = null;
let currentActiveChallenge = 'overview';

const THEME_STORAGE_KEY = 'medcheck_ui_theme';
const THEME_META_COLORS = {
    midnight: '#060913',
    daylight: '#ffffff',
    scrubs:   '#04110f',
    neuro:    '#090614',
    tropical: '#fff8ed'
};
function sanitizeLightThemeInlineStyles(rootEl = document.body) {
    const activeTheme = document.documentElement.getAttribute('data-theme');
    const isLight = (activeTheme === 'daylight' || activeTheme === 'tropical');
    if (!isLight || !rootEl) return;

    const elements = rootEl.querySelectorAll('[style]');
    elements.forEach(el => {
        // Theme-Preview-Karten in den Einstellungen nicht verändern
        if (el.closest('.theme-card') || el.closest('#mindmap-view')) return;

        const styleAttr = el.getAttribute('style') || '';

        // Dunkle Inline-Hintergründe aus JS-Modulen auf helle Oberflächen umstellen
        if (/rgba\(\s*(6|10|11|15|16|30)\s*,\s*(9|15|17|23|24|41)/i.test(styleAttr) || /#(060913|0b1121|0f172a|1e293b)/i.test(styleAttr)) {
            el.style.backgroundColor = 'var(--surface-secondary)';
            el.style.backgroundImage = 'none';
            el.style.color = 'var(--text-main)';
            el.style.borderColor = 'var(--card-border)';
        }

        // Zu helle Pastell-Textfarben auf hellem Hintergrund abdunkeln
        if (/#(f8fafc|f1f5f9|e2e8f0|cbd5e1)/i.test(styleAttr)) {
            el.style.color = 'var(--text-main)';
        } else if (/#(a7f3d0|6ee7b7|86efac)/i.test(styleAttr)) {
            el.style.color = '#065f46'; // Sattes Smaragdgrün
        } else if (/#(fecaca|fca5a5|fecdd3)/i.test(styleAttr)) {
            el.style.color = '#991b1b'; // Sattes Karminrot
        } else if (/#(fde68a|fcd34d)/i.test(styleAttr)) {
            el.style.color = '#92400e'; // Sattes Amber-Braun
        }
    });
}

function applyAppTheme(themeName) {
    const validTheme = THEME_META_COLORS[themeName] ? themeName : 'midnight';

    if (validTheme === 'midnight') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', validTheme);
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', THEME_META_COLORS[validTheme]);
    }

    document.querySelectorAll('.theme-card').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme-value') === validTheme);
    });

    localStorage.setItem(THEME_STORAGE_KEY, validTheme);

    // Bestehende Inline-Styles bei Light-Themes sofort harmonisieren
    if (validTheme === 'daylight' || validTheme === 'tropical') {
        setTimeout(() => sanitizeLightThemeInlineStyles(document.body), 20);
    }
}
window.applyAppTheme = applyAppTheme;

// Überwacht dynamisch nachgerenderte Challenge-Elemente (Audit, Doctordle, Quiz, Taxonomie)
document.addEventListener('DOMContentLoaded', () => {
    const playerView = document.getElementById('player-view');
    if (playerView && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => {
            const activeTheme = document.documentElement.getAttribute('data-theme');
            if (activeTheme === 'daylight' || activeTheme === 'tropical') {
                sanitizeLightThemeInlineStyles(playerView);
            }
        });
        observer.observe(playerView, { childList: true, subtree: true });
    }
});

// Challenge States
let selectedSynapses = [], totalSynapseDiseases = 0, solvedSynapseDiseases = 0, tilesPerDisease = 4;
let cascadesSolvedCount = 0, totalCascades = 0;
let categorizationSolved = false;
let quizSolved = false, userQuizAnswers = {};
let doctordleSolved = false, totalDoctordlePuzzles = 0, solvedDoctordlePuzzles = 0;
let flashcardsSolved = true, totalFlashcardsCount = 0, solvedFlashcardsCount = 0;
let clearedStepsCount = 0, totalStepsCount = 0;

// ====================================================
// SUPER-FOLDER & DASHBOARD STATE KONFIGURATION
// ====================================================
const DEFAULT_SUPER_FOLDERS = [
    'Nervensystem und Sinnesorgane',
    'Psyche / Ethik / Recht',
    'Reproduktion',
    'Allgemein'
];

const SUPER_FOLDER_ORDER_KEY = 'medcheck_super_folder_order_v1';
const CUSTOM_SUPERS_LEGACY_KEY = 'medcheck_custom_supers';
const FOLDER_SUPER_MAPPING_KEY = 'medcheck_folder_super_mapping';
const DASHBOARD_FOLDER_ORDER_KEY = 'medcheck_dashboard_folder_order';

let openFolders = {};
let superFolderStates = {
    'Nervensystem und Sinnesorgane': false,
    'Psyche / Ethik / Recht': false,
    'Reproduktion': false,
    'Allgemein': false
};

// Klapp-Status für die Überordner im Bookshelf
let bookshelfSuperFolderState = {
    'Nervensystem und Sinnesorgane': false,
    'Psyche / Ethik / Recht': false,
    'Reproduktion': false,
    'Allgemein': false
};

let bookshelfFolderState = {};
let draggedItemState = null;
let draggedDashboardFolder = null;
let draggedSuperFolderTitle = null;
let dragHoverTimer = null;
let currentLearningMode = 'topic';

// Fachrichtungs-Modus Queue
let specialtyQueue = [];
let specialtyIndex = 0;
let activeSpecialtyName = '';

const defaultSkills = {
    "Triage": { hits: 0, total: 0 },
    "Diagnostik": { hits: 0, total: 0 },
    "Pharmakologie": { hits: 0, total: 0 },
    "Pathophysiologie": { hits: 0, total: 0 }
};

// V6.0 BUILT-IN DEMO CASE
const BUILTIN_DEMO_CASE = {
    "case_id": "MYELON_MASTER_001_USB",
    "metadata": {
        "title": "Akute & subakute Myelopathien: Vaskuläre, autoimmune und metabolische Querschnitte",
        "medical_field": "29.2.10_Erkrankungen des Rückenmarks und des peripheren Nervensystems",
        "bloom_level": "Evaluation & Synthese",
        "difficulty": 5,
        "xp_reward": 500
    },
    "case_overview": {
        "topic": "Differenzialdiagnose Rückenmarkserkrankungen",
        "cornell_notes": [
            {
                "cues": ["A. spinalis anterior", "Dissoziierte Empfindungsstörung", "Eulenaugen-Zeichen", "Wann? Perakut!"],
                "notes": "<strong>Vaskuläre Myelopathien:</strong><br><br>Oft durch eine <em>Aortendissektion</em> (Verlegung der A. radicularis magna) ausgelöst.<br><br>Führt zur Ischämie der ventralen 2/3 des Myelons (Vorderhörner = Motorikausfall; Tractus spinothalamicus = Schmerz-/Temperaturausfall).<br><br><em>Warum bleibt der Lagesinn intakt?</em> Die Hinterstränge werden separat durch die posterioren Spinalarterien versorgt."
            },
            {
                "cues": ["NMOSD", "LETM (≥3 Segmente)", "AQP4-IgG", "Wer? Meist Frauen", "Vorsicht: Kein Interferon!"],
                "notes": "<strong>Autoimmun-Demyelinisierend:</strong><br><br>Neuromyelitis-optica-Spektrum-Erkrankungen sind primär <em>Astrozytopathien</em>. <br><br>Diagnostisch beweisend ist eine longitudinale extensive transversale Myelitis (LETM) im MRT sowie eine massive neutrophile Pleozytose (meist <em>ohne</em> oligoklonale Banden).<br><br>Normale MS-Basismedikation ist absolut kontraindiziert und triggert Schübe."
            },
            {
                "cues": ["Funikuläre Myelose", "Lachgas (N2O)", "MMA erhöht", "Was? Spinale Ataxie"],
                "notes": "<strong>Metabolisch/Toxisch:</strong><br><br>Degeneration der Hinterstränge und kortikospinalen Bahnen.<br><br><em>Mechanismus:</em> Lachgas oxidiert das Cobalt-Ion im Vitamin B12, was die Methionin-Synthase inaktiviert.<br><br><em>Marker:</em> Methylmalonsäure (MMA) ist massiv erhöht, selbst wenn der absolute B12-Wert im Serum noch normal erscheint."
            }
        ],
        "summary": "Die Triage von Myelopathien erfordert exakte Klinik: Perakuter Schmerz weist auf eine Ischämie hin, eine LETM mit Neutrophilie auf eine NMOSD. Funktionelle B12-Mängel (z. B. durch Lachgas) müssen frühzeitig über MMA-Bestimmung aufgedeckt und substituiert werden."
    },
    "timeline": [
        {
            "step_id": 1,
            "phase": "Akutphase Notfallstation (Vaskulär & Null-Fehler)",
            "content": "Eine 45-jährige Patientin erwacht nachts mit reissenden thorakolumbalen Schmerzen und einer schlaffen Paraparese. Die Untersuchung demonstriert einen Harnverhalt sowie eine [beidseitige dissoziierte Sensibilitätsstörung mit aufgehobenem Schmerz- und Temperaturempfinden bei erhaltenem Lagesinn]. Der Dienstarzt veranlasst [ein sofortiges Angio-CT von Thorax und Abdomen zum Ausschluss einer Aortendissektion] sowie ein Spine-MRT mit Darstellung des [bilateralen T2-Hyperintensitätsmusters der Vorderhörner (Eulenaugen-Zeichen)].",
            "hotspots": [
                { "phrase": "beidseitige dissoziierte Sensibilitätsstörung mit aufgehobenem Schmerz- und Temperaturempfinden bei erhaltenem Lagesinn", "is_error": false, "skill_tag": "Diagnostik", "feedback": "Korrekt auditiert (Null-Fehler): A. spinalis anterior versorgt die vorderen zwei Drittel; die Hinterstränge bleiben intakt." },
                { "phrase": "ein sofortiges Angio-CT von Thorax und Abdomen zum Ausschluss einer Aortendissektion", "is_error": false, "skill_tag": "Triage", "feedback": "Korrekt: Eine Aortendissektion mit Verlegung der A. radicularis magna muss vital ausgeschlossen werden." },
                { "phrase": "bilateralen T2-Hyperintensitätsmusters der Vorderhörner (Eulenaugen-Zeichen)", "is_error": false, "skill_tag": "Diagnostik", "feedback": "Korrekt: Die stoffwechselaktiven Vorderhornneurone dekompensieren bei Ischämie zuerst." }
            ]
        },
        {
            "step_id": 2,
            "phase": "Autoimmun-entzündliche Differenzierung",
            "content": "Ein 77-jähriger Patient stellt sich mit einer subakuten Paraplegie ab T5 vor. Das Spine-MRT zeigt eine [longitudinale extensive transversale Myelitis (LETM) über 4 vertebrale Segmente]. Im Liquor findet sich eine neutrophile Pleozytose ohne oligoklonale Banden. Die Stationsärztin diagnostiziert einen [primären Schub einer Multiplen Sklerose und initiiert eine Langzeittherapie mit Interferon-beta].",
            "hotspots": [
                { "phrase": "longitudinale extensive transversale Myelitis (LETM) über 4 vertebrale Segmente", "is_error": false, "skill_tag": "Diagnostik", "feedback": "Richtig: Eine Myelonläsion ≥3 Segmente definiert eine LETM und schließt eine typische MS weitgehend aus." },
                { "phrase": "primären Schub einer Multiplen Sklerose und initiiert eine Langzeittherapie mit Interferon-beta", "is_error": true, "skill_tag": "Pharmakologie", "socratic_trap": "Welche autoimmunologische Entität verursacht eine LETM ohne OKB, und warum führt Interferon-beta hier zu fatalen Exazerbationen?", "correct_pathophysiology": "Das Bild entspricht einer Neuromyelitis-optica-Spektrum-Erkrankung (NMOSD, AQP4-IgG). Klassische MS-Medikamente wie Interferon-beta triggern bei NMOSD schwere Schübe und sind kontraindiziert!" }
            ]
        }
    ],
    "extra_tasks": {
        "flashcards": [
            {
                "id": "fc_01",
                "category": "Diagnostische Triade",
                "difficulty": "basic",
                "front": "Aus welchen drei Kardinalsymptomen besteht die klassische Menière-Triade?",
                "back": "Drehschwindel (anfallsartig, 20 min bis 12 h), fluktuierende Schallempfindungsschwerhörigkeit (v. a. Tieftonbereich) und Tinnitus bzw. Ohrdruckgefühl.",
                "mnemonic_or_context": "Triade: Schwindel + Tiefton-Hypakusis + Tinnitus/Völlegefühl."
            }
        ],
        "doctordle": [
            {
                "puzzle_id": 1,
                "title": "Deduktion 1: Perakute spinale Symptomatik",
                "target_diagnosis": "Arteria-spinalis-anterior-Syndrom",
                "synonyms": ["A. spinalis anterior Syndrom", "Spinaler Insult", "Rückenmarksinfarkt", "Anteriore Myelonischämie"],
                "hints": [
                    "Stufe 1: 52-jähriger Patient erleidet perakut einschießende interskapuläre Schmerzen mit rascher Parese.",
                    "Stufe 2: Schlaffe Paraparese, dissoziierte Sensibilitätsstörung.",
                    "Stufe 3: D-Dimere leicht erhöht; Ausschluss GBS."
                ],
                "learning_pearl": "Die dissoziierte Sensibilitätsstörung beweist das Arteria-spinalis-anterior-Syndrom."
            }
        ],
        "library_entries": [
            "Arteria-spinalis-anterior-Syndrom", "Spinaler Insult", "Neuromyelitis-optica-Spektrum-Erkrankung"
        ],
        "master_quiz": [
            {
                "question": "Welcher Befund im Spinal-MRT spricht am ehesten für eine NMOSD und schließt eine klassische Multiple Sklerose weitgehend aus?",
                "options": ["Kurzstreckige posterolaterale Läsion <1 Segment", "Longitudinale extensive transversale Myelitis (LETM) ≥3 Segmente", "Bilaterale Hyperintensität der Vorderhörner (Eulenaugen-Zeichen)", "Symmetrisches umgekehrtes V-Zeichen der Hinterstränge"],
                "correct_index": 1,
                "explanation": "Eine Läsionsausdehnung über 3 oder mehr Wirbelkörpersegmente (LETM) ist das radiologische Hauptkriterium der NMOSD."
            }
        ]
    }
};

// ====================================================
// PROGRESS MANAGER & PERSISTENCE
// ====================================================
const ProgressManager = {
    STORAGE_KEY: 'medcheck_user_progress_v1',

    getAll() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
        } catch (e) {
            console.error('Fehler beim Lesen des Progress-Speichers:', e);
            return {};
        }
    },

    getCaseProgress(caseId) {
        if (!caseId) return null;
        const all = this.getAll();
        return all[caseId] || null;
    },

    saveCaseState(caseId, partialState) {
        if (!caseId || window.isSpecialtyBlindMode) return;
        const all = this.getAll();
        all[caseId] = {
            ...(all[caseId] || {}),
            ...partialState,
            updatedAt: Date.now()
        };
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
        } catch (e) {
            console.error('LocalStorage Schreibfehler:', e);
        }
    },

    resetChallenge(caseId, challengeKey) {
        if (!caseId || window.isSpecialtyBlindMode) return;
        const all = this.getAll();
        if (all[caseId] && all[caseId][challengeKey]) {
            delete all[caseId][challengeKey];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
        }
    },

    // NEU: Setzt ALLE interaktiven Challenges (Audit, Quiz, Synapsen, Kaskaden, Doctordle, Flashcards)
    // für eine Spaced-Repetition-Wiederholung zurück, behält den Fall aber in 'solved_cases'!
    resetCaseChallengesForReview(caseId) {
        if (!caseId) return;

        // 1. Haupt-Progress für diesen Fall löschen
        const all = this.getAll();
        if (all[caseId]) {
            delete all[caseId];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
        }

        // 2. Separaten Doctordle-Speicher für diesen Fall löschen
        try {
            localStorage.removeItem(`doctordle_state_${caseId}`);
        } catch (e) {}

        // 3. Laufende Doctordle-Instanz im RAM zurücksetzen, damit initDoctordle() nicht cached
        if (window.doctordleGame && window.doctordleGame.currentCaseId === caseId) {
            window.doctordleGame.currentCaseId = null;
        }
    },

    resetEntireCase(caseId) {
        if (!caseId || window.isSpecialtyBlindMode) return;
        this.resetCaseChallengesForReview(caseId);

        let solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
        solved = solved.filter(id => id !== caseId);
        localStorage.setItem('solved_cases', JSON.stringify(solved));
    }
};
window.ProgressManager = ProgressManager;

// ====================================================
// GLOBALE DD-BIBLIOTHEK
// ====================================================
const DD_POOL_KEY = 'medcheck_global_dd_pool';
window.MedCheckDDLibrary = new Set();
const ddLibraryKeys = new Set();

function addToDDLibrary(term) {
    if (typeof term !== 'string') return false;
    const clean = term.trim().replace(/\s+/g, ' ');
    if (clean.length < 2) return false;
    const key = clean.toLowerCase();
    if (ddLibraryKeys.has(key)) return false;
    ddLibraryKeys.add(key);
    window.MedCheckDDLibrary.add(clean);
    return true;
}

function saveDDLibrary() {
    try {
        localStorage.setItem(DD_POOL_KEY, JSON.stringify(Array.from(window.MedCheckDDLibrary)));
    } catch (e) {}
}

function loadDDLibrary() {
    try {
        const stored = JSON.parse(localStorage.getItem(DD_POOL_KEY) || '[]');
        if (Array.isArray(stored)) stored.forEach(addToDDLibrary);
    } catch (e) {}
}

// ====================================================
// VOLLSTÄNDIGE ÜBERORDNER- & ORDNER-ENGINE (DASHBOARD + BOOKSHELF)
// ====================================================

function getSuperFolderOrder() {
    window.getSuperFolderOrder = getSuperFolderOrder;
    try {
        let order = JSON.parse(localStorage.getItem(SUPER_FOLDER_ORDER_KEY) || 'null');
        const legacyCustom = JSON.parse(localStorage.getItem(CUSTOM_SUPERS_LEGACY_KEY) || '[]')
            .map(item => (typeof item === 'string' ? item : item?.name))
            .filter(Boolean);

        if (!Array.isArray(order) || order.length === 0) {
            order = [...DEFAULT_SUPER_FOLDERS];
            legacyCustom.forEach(c => {
                if (!order.includes(c)) order.push(c);
            });
            if (!order.includes('Allgemein')) order.push('Allgemein');
            localStorage.setItem(SUPER_FOLDER_ORDER_KEY, JSON.stringify(order));
        } else {
            let changed = false;
            legacyCustom.forEach(c => {
                if (!order.includes(c)) {
                    order.push(c);
                    changed = true;
                }
            });
            if (!order.includes('Allgemein')) {
                order.push('Allgemein');
                changed = true;
            }
            if (changed) localStorage.setItem(SUPER_FOLDER_ORDER_KEY, JSON.stringify(order));
        }
        return order;
    } catch (e) {
        return [...DEFAULT_SUPER_FOLDERS];
    }
}

function saveSuperFolderOrder(orderArray) {
    try {
        const clean = Array.from(new Set(orderArray.map(s => s.trim()).filter(Boolean)));
        if (!clean.includes('Allgemein')) clean.push('Allgemein');
        localStorage.setItem(SUPER_FOLDER_ORDER_KEY, JSON.stringify(clean));

        // Legacy-Array synchron halten
        const customOnly = clean.filter(name => !DEFAULT_SUPER_FOLDERS.includes(name));
        localStorage.setItem(CUSTOM_SUPERS_LEGACY_KEY, JSON.stringify(customOnly));
    } catch (e) {
        console.error('Fehler beim Speichern der Überordner-Reihenfolge:', e);
    }
}

function getCustomSuperFolders() {
    const order = getSuperFolderOrder();
    return order
        .filter(name => !DEFAULT_SUPER_FOLDERS.includes(name))
        .map(name => ({ id: name, name: name, icon: '📂' }));
}
window.getCustomSuperFolders = getCustomSuperFolders;

function initCustomSuperFoldersState() {
    try {
        const allSupers = getSuperFolderOrder();
        // Entfernte Überordner aus dem Laufzeit-State bereinigen
        Object.keys(superFolderStates).forEach(k => {
            if (!allSupers.includes(k)) delete superFolderStates[k];
        });
        allSupers.forEach(sName => {
            if (superFolderStates[sName] === undefined) {
                superFolderStates[sName] = false;
            }
            if (bookshelfSuperFolderState[sName] === undefined) {
                bookshelfSuperFolderState[sName] = false;
            }
        });
    } catch (e) {
        console.error("Fehler beim Laden der Super-Folders:", e);
    }
}

// Direkt beim Laden initialisieren
initCustomSuperFoldersState();

// 1. Neuen Überordner erstellen
function createCustomSuperFolder(folderName) {
    if (!folderName || !folderName.trim()) return;
    const cleanName = folderName.trim();

    const order = getSuperFolderOrder();
    if (order.some(s => s.toLowerCase() === cleanName.toLowerCase())) {
        alert(`Der Überordner "${cleanName}" existiert bereits.`);
        return;
    }

    // Vor "Allgemein" einfügen, damit "Allgemein" als Sammelbecken unten bleibt
    const allgIdx = order.indexOf('Allgemein');
    if (allgIdx !== -1) {
        order.splice(allgIdx, 0, cleanName);
    } else {
        order.push(cleanName);
    }
    saveSuperFolderOrder(order);

    superFolderStates[cleanName] = true;
    bookshelfSuperFolderState[cleanName] = true;

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);

    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
}
window.createCustomSuperFolder = createCustomSuperFolder;

window.createNewSuperFolderModal = function() {
    const superName = window.prompt("Name für den neuen Überordner (z.B. 'Innere Medizin', 'Chirurgie', 'Staatsexamen Fokus'):");
    if (!superName || !superName.trim()) return;
    createCustomSuperFolder(superName.trim());
};

function promptNewSuperFolder() {
    window.createNewSuperFolderModal();
}
window.promptNewSuperFolder = promptNewSuperFolder;

// 2. Überordner umbenennen (inkl. Migration aller Unterordner-Zuweisungen)
window.renameSuperFolder = function(oldTitle) {
    if (!oldTitle) return;
    if (oldTitle === 'Allgemein') {
        alert('Der Standard-Sammelordner "Allgemein" kann nicht umbenannt werden.');
        return;
    }

    const newTitleRaw = window.prompt(`Neuer Name für den Überordner "${oldTitle}":`, oldTitle);
    if (!newTitleRaw || !newTitleRaw.trim() || newTitleRaw.trim() === oldTitle) return;
    const newTitle = newTitleRaw.trim();

    const order = getSuperFolderOrder();
    if (order.some(s => s.toLowerCase() === newTitle.toLowerCase() && s !== oldTitle)) {
        alert(`Ein Überordner mit dem Namen "${newTitle}" existiert bereits.`);
        return;
    }

    const idx = order.indexOf(oldTitle);
    if (idx !== -1) {
        order[idx] = newTitle;
    } else {
        order.push(newTitle);
    }
    saveSuperFolderOrder(order);

    // States übertragen
    superFolderStates[newTitle] = superFolderStates[oldTitle] !== undefined ? superFolderStates[oldTitle] : true;
    bookshelfSuperFolderState[newTitle] = bookshelfSuperFolderState[oldTitle] !== undefined ? bookshelfSuperFolderState[oldTitle] : true;
    delete superFolderStates[oldTitle];
    delete bookshelfSuperFolderState[oldTitle];

    // Alle zugewiesenen Unterordner auf den neuen Überordner umziehen
    const mapping = getFolderSuperMapping();
    Object.keys(mapping).forEach(subFolder => {
        if (mapping[subFolder] === oldTitle) {
            mapping[subFolder] = newTitle;
        }
    });

    // Auch bisher heuristisch zugeordnete Unterordner explizit an den neuen Namen binden
    const allCases = window.getRegisteredCases ? window.getRegisteredCases() : [BUILTIN_DEMO_CASE, ...getCustomCases()];
    const savedSubOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    const allSubFolders = new Set(savedSubOrder);
    allCases.forEach(c => {
        allSubFolders.add((c.folder_name || c.metadata?.medical_field || 'Allgemein').trim());
    });
    allSubFolders.forEach(sub => {
        if (!mapping[sub] && getSuperFolderForCategoryHeuristic(sub) === oldTitle) {
            mapping[sub] = newTitle;
        }
    });

    saveFolderSuperMapping(mapping);
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);

    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
};

// 3. Überordner löschen (Unterordner wandern sicher nach "Allgemein")
function removeCustomSuperFolder(superTitle) {
    if (!superTitle) return;
    if (superTitle === 'Allgemein') {
        alert('Der Basis-Überordner "Allgemein" wird als Fallback benötigt und kann nicht gelöscht werden.');
        return;
    }

    if (!window.confirm(`Möchtest du den Überordner "${superTitle}" wirklich entfernen?\n\nAlle darin liegenden Unterordner und Fälle bleiben erhalten und werden sicher in den Überordner "Allgemein" verschoben.`)) {
        return;
    }

    const order = getSuperFolderOrder().filter(s => s !== superTitle);
    saveSuperFolderOrder(order);

    delete superFolderStates[superTitle];
    delete bookshelfSuperFolderState[superTitle];

    const mapping = getFolderSuperMapping();
    Object.keys(mapping).forEach(subFolder => {
        if (mapping[subFolder] === superTitle) {
            mapping[subFolder] = 'Allgemein';
        }
    });
    saveFolderSuperMapping(mapping);

    superFolderStates['Allgemein'] = true;
    bookshelfSuperFolderState['Allgemein'] = true;

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);

    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
}
window.removeCustomSuperFolder = removeCustomSuperFolder;
window.deleteSuperFolder = removeCustomSuperFolder;

// 4. Überordner per Drag & Drop umsortieren
function reorderSuperFolders(draggedTitle, targetTitle) {
    if (!draggedTitle || !targetTitle || draggedTitle === targetTitle) return;
    const order = getSuperFolderOrder();
    const fromIdx = order.indexOf(draggedTitle);
    const toIdx = order.indexOf(targetTitle);
    if (fromIdx === -1 || toIdx === -1) return;

    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, draggedTitle);
    saveSuperFolderOrder(order);

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
}
window.reorderSuperFolders = reorderSuperFolders;

// 5. Unterordner direkt innerhalb eines bestimmten Überordners anlegen
window.createSubfolderInSuperFolder = function(superTitle) {
    const targetSuper = superTitle || 'Allgemein';
    const subName = window.prompt(`Neuen Unterordner in "${targetSuper}" erstellen:\n\nName des Unterordners:`);
    if (!subName || !subName.trim()) return;
    const cleanSub = subName.trim();

    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    if (!order.includes(cleanSub)) {
        order.push(cleanSub);
        localStorage.setItem('medcheck_folder_order', JSON.stringify(order));
    }

    const mapping = getFolderSuperMapping();
    mapping[cleanSub] = targetSuper;
    saveFolderSuperMapping(mapping);

    superFolderStates[targetSuper] = true;
    bookshelfSuperFolderState[targetSuper] = true;
    bookshelfFolderState[cleanSub] = true;
    openFolders[cleanSub] = true;

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
};

function toggleBookshelfSuperGroup(superTitle) {
    bookshelfSuperFolderState[superTitle] = bookshelfSuperFolderState[superTitle] === false ? true : false;
    renderDashboardCases();
}
window.toggleBookshelfSuperGroup = toggleBookshelfSuperGroup;

// 6. Bookshelf-Header-Buttons (stellt sicher, dass "+ Über" auch ohne HTML-Anpassung im Bookshelf erscheint)
window.renderBookshelfHeader = function() {
    return `
        <div class="bookshelf-header-row">
            <span class="bookshelf-title">Bücherregal & Ordner</span>
            <div style="display:flex; gap:4px; align-items:center;">
                <button type="button" class="bookshelf-add-btn" onclick="window.createNewSuperFolderModal()" title="Neuen Überordner erstellen" style="font-size:0.7rem; padding:2px 6px; width:auto;">+ Über</button>
                <button type="button" class="bookshelf-add-btn" onclick="window.promptCreateNewFolderWithSuper()" title="Neuen Unterordner erstellen">+</button>
            </div>
        </div>
    `;
};

function ensureBookshelfHeaderButtons() {
    const addFolderBtn = document.getElementById('add-bookshelf-folder-btn');
    if (addFolderBtn && !document.getElementById('add-bookshelf-super-btn')) {
        const superBtn = document.createElement('button');
        superBtn.type = 'button';
        superBtn.id = 'add-bookshelf-super-btn';
        superBtn.className = addFolderBtn.className || 'bookshelf-add-btn';
        superBtn.title = 'Neuen Überordner erstellen';
        superBtn.style.cssText = 'font-size:0.7rem; padding:2px 7px; width:auto; margin-right:4px; font-weight:700;';
        superBtn.textContent = '+ Über';
        superBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.createNewSuperFolderModal();
        });
        addFolderBtn.parentNode.insertBefore(superBtn, addFolderBtn);
    }
}

window.promptCreateNewFolderWithSuper = function() {
    const name = window.prompt("Name für den neuen Unterordner:");
    if (!name || !name.trim()) return;
    const cleanName = name.trim();

    const availableSupers = getSuperFolderOrder();
    const defaultSuper = getSuperFolderForCategoryHeuristic(cleanName);
    const defaultIdx = Math.max(0, availableSupers.indexOf(defaultSuper)) + 1;

    const optionsText = availableSupers
        .map((s, idx) => `${idx + 1}: ${s}${s === defaultSuper ? ' (Vorschlag)' : ''}`)
        .join('\n');

    const superChoice = window.prompt(
        `In welchem Überordner soll "${cleanName}" angelegt werden?\n\nGib die Ziffer ein (oder lasse es für "${defaultSuper}" auf ${defaultIdx}):\n${optionsText}`,
        String(defaultIdx)
    );

    let chosenSuper = defaultSuper;
    if (superChoice !== null && superChoice.trim() !== '') {
        const num = parseInt(superChoice.trim(), 10);
        if (!isNaN(num) && num >= 1 && num <= availableSupers.length) {
            chosenSuper = availableSupers[num - 1];
        } else {
            const match = availableSupers.find(s => s.toLowerCase() === superChoice.trim().toLowerCase());
            if (match) chosenSuper = match;
        }
    }

    createNewFolder(cleanName, chosenSuper);
};

// 7. Unterordner erstellen
function createNewFolder(folderName, targetSuperFolder = null) {
    if (!folderName || !folderName.trim()) return;
    const cleanName = folderName.trim();
    if (typeof unmarkFolderAsDeleted === 'function') unmarkFolderAsDeleted(cleanName);

    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    if (!order.includes(cleanName)) {
        order.push(cleanName);
        localStorage.setItem('medcheck_folder_order', JSON.stringify(order));
    }

    const chosenSuper = targetSuperFolder || getSuperFolderForCategory(cleanName);
    const mapping = getFolderSuperMapping();
    mapping[cleanName] = chosenSuper;
    saveFolderSuperMapping(mapping);

    superFolderStates[chosenSuper] = true;
    bookshelfSuperFolderState[chosenSuper] = true;
    bookshelfFolderState[cleanName] = true;
    openFolders[cleanName] = true;

    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
}
window.createNewFolder = createNewFolder;

window.registerCaseDDs = function(caseData) {
    const tasks = caseData?.extra_tasks;
    if (!tasks) return;
    let changed = false;
    const add = t => { if (addToDDLibrary(t)) changed = true; };

    (Array.isArray(tasks.library_entries) ? tasks.library_entries : []).forEach(add);
    const puzzles = Array.isArray(tasks.doctordle) ? tasks.doctordle : (tasks.doctordle ? [tasks.doctordle] : []);
    puzzles.forEach(p => {
        add(p?.target_diagnosis);
        (Array.isArray(p?.synonyms) ? p.synonyms : []).forEach(add);
    });
    if (changed) saveDDLibrary();
};

async function prefetchManifestDDs() {
    try {
        const res = await fetch('manifest.json');
        if (!res.ok) return;
        const manifest = await res.json();
        const files = (manifest.cases || []).map(c => c.file_path).filter(Boolean);
        await Promise.all(files.map(async path => {
            try {
                const r = await fetch(path);
                if (r.ok) window.registerCaseDDs(await r.json());
            } catch (e) {}
        }));
    } catch (e) {}
}

loadDDLibrary();

window.saveChallengeProgress = function(challengeKey, data) {
    if (!activeCaseData) return;
    ProgressManager.saveCaseState(activeCaseData.case_id, {
        [challengeKey]: data
    });
};

// ====================================================
// FALL LÖSCHEN & AUSBLENDEN (INKL. CLOUD-PROTECTION)
// ====================================================
const HIDDEN_CLOUD_CASES_KEY = 'medcheck_hidden_cloud_cases_v1';

function getHiddenCloudCaseIds() {
    try {
        return JSON.parse(localStorage.getItem(HIDDEN_CLOUD_CASES_KEY) || '[]');
    } catch (_e) {
        return [];
    }
}

function addHiddenCloudCaseId(caseId) {
    const list = getHiddenCloudCaseIds();
    if (!list.includes(caseId)) {
        list.push(caseId);
        localStorage.setItem(HIDDEN_CLOUD_CASES_KEY, JSON.stringify(list));
    }
}

window.deleteCaseById = async function(caseId) {
    if (!caseId) return;

    // 1. Schutz für den fest eingebauten System-Demo-Fall
    if (caseId === BUILTIN_DEMO_CASE.case_id) {
        alert('Der integrierte System-Demofall kann nicht gelöscht werden.');
        return;
    }

    const allCases = window.getRegisteredCases ? window.getRegisteredCases() : [BUILTIN_DEMO_CASE, ...getCustomCases()];
    const targetCase = allCases.find(c => (c.case_id || c.id) === caseId);
    const title = targetCase?.metadata?.title || targetCase?.title || caseId;
    const isCloudCase = !!(window.cloudCaseIds && window.cloudCaseIds.has(caseId));
    const isCurrentUserCreator = window.currentSessionUser?.email?.toLowerCase() === CREATOR_EMAIL.toLowerCase();

    // 2. Sicherheitsabfrage
    const confirmMsg = isCloudCase
        ? `Möchtest du den Fall „${title}“ lokal von diesem Gerät entfernen?\n\n(Hinweis: Da es ein Cloud-Fall ist, wird er für dein lokales Dashboard ausgeblendet.)`
        : `Möchtest du den lokalen Fall „${title}“ (${caseId}) wirklich löschen?\n\nDein Lernfortschritt für diesen Fall wird dabei ebenfalls zurückgesetzt.`;

    if (!window.confirm(confirmMsg)) return;

    // 3. Optional für dich als Creator: Direkt fragen, ob er auch komplett aus der Supabase-Cloud gelöscht werden soll
    if (isCloudCase && isCurrentUserCreator) {
        const alsoUnpublish = window.confirm(
            `Creator-Option: Dieser Fall ist in der Supabase-Cloud veröffentlicht.\n\nSoll „${title}“ AUCH komplett aus der Cloud für alle Nutzer gelöscht werden?\n(Klicke „Abbrechen“, um ihn nur lokal bei dir zu löschen.)`
        );
        if (alsoUnpublish) {
            const sb = getActiveSupabaseClient();
            if (sb) {
                try {
                    const { error } = await sb.from('cases').delete().eq('case_id', caseId);
                    if (error) throw error;
                    window.cloudCaseIds.delete(caseId);
                } catch (err) {
                    console.error('Fehler beim Löschen aus der Cloud:', err);
                    alert(`Cloud-Löschung fehlgeschlagen: ${err.message}`);
                }
            }
        } else {
            // Nur lokal ausblenden, damit loadCasesFromDatabase ihn nicht sofort wiederherstellt
            addHiddenCloudCaseId(caseId);
        }
    } else if (isCloudCase) {
        // Normale Nutzer blenden Cloud-Fälle lokal aus
        addHiddenCloudCaseId(caseId);
    }

    // 4. Aus localStorage ('custom_cases') entfernen
    let customCases = getCustomCases();
    customCases = customCases.filter(c => (c.case_id || c.id) !== caseId);
    localStorage.setItem('custom_cases', JSON.stringify(customCases));

    // 5. Fortschritt & Challenge-States sauber bereinigen
    if (ProgressManager && typeof ProgressManager.resetEntireCase === 'function') {
        ProgressManager.resetEntireCase(caseId);
    }

    // 6. Falls der gelöschte Fall gerade im Player geöffnet war -> zurück zum Dashboard
    if (activeCaseData && (activeCaseData.case_id === caseId || activeCaseData.id === caseId)) {
        activeCaseData = null;
        const playerView = document.getElementById('player-view');
        if (playerView && playerView.style.display !== 'none') {
            window.switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
        }
    }

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(14);

    // 7. Alle UI-Komponenten synchron neu rendern
    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
    if (typeof window.renderSpecialtyHub === 'function') {
        window.renderSpecialtyHub();
    }
    if (window.SpacedRepetitionEngine && typeof window.SpacedRepetitionEngine.renderDashboardWidget === 'function') {
        const currentFilter = document.getElementById('sr-folder-filter')?.value || 'ALL';
        window.SpacedRepetitionEngine.renderDashboardWidget('sr-dashboard-widget', currentFilter);
    }
};
// ====================================================
// INITIALISIERUNG
// ====================================================
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'midnight';
    applyAppTheme(savedTheme);

    ensureBookshelfHeaderButtons();
    initUserData();
    initCreatorHubAndCloudCases();

    [BUILTIN_DEMO_CASE, ...getCustomCases()].forEach(window.registerCaseDDs);
    prefetchManifestDDs();
    renderSkillsSidebar();
    renderDashboardCases();
    if (typeof window.renderSpecialtyHub === 'function') {
        window.renderSpecialtyHub();
    }

    // =========================================================================
    // INITIALISIERUNG: SPACED REPETITION WIDGET (Stabil & Fehlerfrei)
    // =========================================================================
    if (window.SpacedRepetitionEngine) {
        window.SpacedRepetitionEngine.renderDashboardWidget('sr-dashboard-widget', 'ALL');
    }

    window.addEventListener('sr:updated', () => {
        if (window.SpacedRepetitionEngine) {
            const currentFilter = document.getElementById('sr-folder-filter')?.value || 'ALL';
            window.SpacedRepetitionEngine.renderDashboardWidget('sr-dashboard-widget', currentFilter);
        }
    });
    // =========================================================================

    const addFolderBtn = document.getElementById('add-bookshelf-folder-btn');
    if (addFolderBtn) {
        addFolderBtn.onclick = (e) => {
            e.preventDefault();
            window.promptCreateNewFolderWithSuper();
        };
    }

    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest('#btn-next-specialty-case')) window.nextSpecialtyCase();
        if (e.target && e.target.closest('#btn-exit-specialty')) {
            window.isSpecialtyBlindMode = false;
            window.applyBlindHeader(false, null);
            window.switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
        }
  if (e.target && e.target.closest('#btn-reveal-diagnosis')) {
    if (typeof window.revealDiagnosis === 'function') window.revealDiagnosis();
}
    });

    setTimeout(renderSubjectProgressDrawer, 500);
});

// ====================================================
// ALLGEMEINE UI & UTILS
// ====================================================
window.triggerHaptic = function(ms = 8) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(ms); } catch (_e) {}
    }
};

window.toggleSidebar = function() {
    const sidebar = document.querySelector('sidebar') || document.querySelector('.sidebar') || document.querySelector('aside');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
    window.triggerHaptic(6);
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

window.switchTab = function(tab, el) {
    window.triggerHaptic(6);

    if (tab === 'auth') {
        tab = 'settings';
    }

    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    if (el) {
        el.classList.add('active');
    } else {
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('onclick')?.includes(`'${tab}'`) || item.getAttribute('data-view') === tab) {
                item.classList.add('active');
            }
        });
    }

    const allViews = [
        'dashboard-view', 
        'player-view', 
        'forge-view', 
        'settings-view', 
        'depot-view', 
        'pharmacology-view',
        'mindmap-view',
        'duel-view'
    ];

    allViews.forEach(viewId => {
        const element = document.getElementById(viewId);
        if (element) {
            element.style.display = 'none';
            element.classList.add('hidden');
        }
    });

    const sidebar = document.querySelector('sidebar') || document.querySelector('.sidebar') || document.querySelector('aside');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    const navPlayer = document.getElementById('nav-player');
    if (navPlayer) navPlayer.style.display = (tab === 'player') ? 'flex' : 'none';

    if (tab === 'mindmap') {
        window.isSpecialtyBlindMode = false;
        const mmView = document.getElementById('mindmap-view');
        if (mmView) {
            mmView.classList.remove('hidden');
            mmView.style.display = 'block';
        }
        if (window.MindmapModule && typeof window.MindmapModule.openView === 'function') {
            window.MindmapModule.openView();
        }
        return;
    }

    if (tab === 'duel') {
        window.isSpecialtyBlindMode = false;
        const duelView = document.getElementById('duel-view');
        if (duelView) {
            duelView.classList.remove('hidden');
            duelView.style.display = 'block';
        }
        if (window.DuelModule && typeof window.DuelModule.openView === 'function') {
            window.DuelModule.openView();
        }
        return;
    }

    const targetViewMap = {
        'dashboard': 'dashboard-view',
        'player': 'player-view',
        'forge': 'forge-view',
        'settings': 'settings-view',
        'depot': 'depot-view',
        'pharmacology': 'pharmacology-view'
    };

    const activeViewId = targetViewMap[tab];
    if (activeViewId) {
        const targetElement = document.getElementById(activeViewId);
        if (targetElement) {
            targetElement.classList.remove('hidden');
            targetElement.style.display = 'block';
        }
    }

    if (tab === 'dashboard') {
        window.isSpecialtyBlindMode = false;
        if (typeof renderDashboardCases === 'function') renderDashboardCases();
        if (typeof window.renderSpecialtyHub === 'function') window.renderSpecialtyHub();
    } else if (tab === 'depot') {
        if (typeof renderDepotView === 'function') renderDepotView();
    } else if (tab === 'pharmacology') {
        window.isSpecialtyBlindMode = false;
        if (typeof PharmacologyModule !== 'undefined' && typeof PharmacologyModule.init === 'function') {
            PharmacologyModule.init('pharmacology-container');
        }
    }
};

window.switchPlayerMode = function(mode) {
    currentActiveChallenge = mode;
    window.triggerHaptic(6);

    document.querySelectorAll('.player-mode-pane').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.challenge-tab-btn').forEach(btn => btn.classList.remove('active'));

    const targetPane = document.getElementById('mode-container-' + mode);
    const targetTab = document.getElementById('tab-btn-' + mode);
    if (targetPane) targetPane.style.display = 'block';
    if (targetTab) targetTab.classList.add('active');

    if (mode === 'doctordle' && window.initDoctordle && activeCaseData) {
        window.initDoctordle(activeCaseData);
    }

    if (mode === 'flashcards' && typeof window.renderFlashcards === 'function') {
        window.renderFlashcards();
    }
};

window.showTutorHint = function(taskKey) {
    if (!activeCaseData || !activeCaseData.extra_tasks) return;
    let hint = "Kein spezifischer Hinweis hinterlegt.";

    if (taskKey === 'clinical_cascades' && activeCaseData.extra_tasks.clinical_cascades) {
        hint = activeCaseData.extra_tasks.clinical_cascades[0]?.tutor_hint || activeCaseData.extra_tasks.clinical_cascades[0]?.hint || hint;
    } else if (activeCaseData.extra_tasks[taskKey]) {
        hint = activeCaseData.extra_tasks[taskKey].tutor_hint || activeCaseData.extra_tasks[taskKey].hint || hint;
    }

    const tutorText = document.getElementById('tutor-text');
    const tutorModal = document.getElementById('tutor-modal');
    if (tutorText) tutorText.innerText = hint;
    if (tutorModal) tutorModal.style.display = 'flex';
};

window.toggleSuperFolder = function(superFolderTitle) {
    superFolderStates[superFolderTitle] = superFolderStates[superFolderTitle] !== undefined ? !superFolderStates[superFolderTitle] : false;
    renderDashboardCases();
};

// ====================================================
// PERSISTENTE ÜBERORDNER-ZUWEISUNG (FOLDER-MAPPING)
// ====================================================
function getFolderSuperMapping() {
    try {
        return JSON.parse(localStorage.getItem(FOLDER_SUPER_MAPPING_KEY) || '{}');
    } catch (_e) {
        return {};
    }
}

function saveFolderSuperMapping(mapping) {
    try {
        localStorage.setItem(FOLDER_SUPER_MAPPING_KEY, JSON.stringify(mapping));
    } catch (e) {
        console.error('Fehler beim Speichern der Überordner-Zuweisung:', e);
    }
}

function getSuperFolderForCategoryHeuristic(cleanName) {
    window.getSuperFolderForCategory = getSuperFolderForCategory;
    const lower = (cleanName || '').toLowerCase();
    const availableSupers = getSuperFolderOrder();

    // Direkter Treffer mit einem benutzerdefinierten Überordnernamen
    const directMatch = availableSupers.find(s => s.toLowerCase() === lower);
    if (directMatch) return directMatch;

    if (lower === 'allgemein' || lower.startsWith('allgemein') || lower === 'sonstiges' || lower === 'uncategorized') {
        return 'Allgemein';
    }
    if (lower.includes('psych') || lower.includes('ethik') || lower.includes('recht') || lower.includes('legal') || lower.includes('forensik') || lower.includes('sozial')) {
        return availableSupers.includes('Psyche / Ethik / Recht') ? 'Psyche / Ethik / Recht' : 'Allgemein';
    }
    if (lower.includes('repro') || lower.includes('gyn') || lower.includes('geburt') || lower.includes('fertilit') || lower.includes('schwanger') || lower.includes('zyklus') || lower.includes('ovard')) {
        return availableSupers.includes('Reproduktion') ? 'Reproduktion' : 'Allgemein';
    }
    if (
        lower.includes('neuro') || lower.includes('nerv') || lower.includes('sinnes') || 
        lower.includes('auge') || lower.includes('ophthal') || lower.includes('hno') || 
        lower.includes('hals-nase') || lower.includes('ohr') || lower.includes('29.2') || 
        lower.includes('myelon') || lower.includes('hirn') || lower.includes('gehirn') || 
        lower.includes('spinal') || lower.includes('mening') || lower.includes('cns') || 
        lower.includes('zns') || lower.includes('cjk') || lower.includes('demenz')
    ) {
        return availableSupers.includes('Nervensystem und Sinnesorgane') ? 'Nervensystem und Sinnesorgane' : 'Allgemein';
    }
    return 'Allgemein';
}

function getSuperFolderForCategory(categoryName) {
    if (!categoryName) return 'Allgemein';
    const cleanName = categoryName.trim();
    const availableSupers = getSuperFolderOrder();

    // 1. Explizite Nutzerzuweisung prüfen
    const mapping = getFolderSuperMapping();
    if (mapping[cleanName] && availableSupers.includes(mapping[cleanName])) {
        return mapping[cleanName];
    }

    // 2. Intelligente Heuristik als Fallback
    return getSuperFolderForCategoryHeuristic(cleanName);
}

window.moveFolderToSuperFolder = function(folderName, targetSuperFolder) {
    if (!folderName || !targetSuperFolder) return;
    const cleanFolder = folderName.trim();
    const cleanSuper = targetSuperFolder.trim();

    const order = getSuperFolderOrder();
    if (!order.includes(cleanSuper)) {
        order.push(cleanSuper);
        saveSuperFolderOrder(order);
    }

    const mapping = getFolderSuperMapping();
    mapping[cleanFolder] = cleanSuper;
    saveFolderSuperMapping(mapping);

    // Sicherstellen, dass der Unterordner auch in der Ordnerliste bekannt ist
    let subOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    if (!subOrder.includes(cleanFolder)) {
        subOrder.push(cleanFolder);
        localStorage.setItem('medcheck_folder_order', JSON.stringify(subOrder));
    }

    // Ziel-Überordner automatisch aufklappen
    superFolderStates[cleanSuper] = true;
    bookshelfSuperFolderState[cleanSuper] = true;

    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
};
window.assignFolderToSuperFolder = window.moveFolderToSuperFolder;

// ====================================================
// PERSISTENTE ORDNER-OVERRIDES & TOMBSTONE-ENGINE (VERHINDERT RELOAD-RESET!)
// ====================================================
const CASE_FOLDER_OVERRIDES_KEY = 'medcheck_case_folder_overrides_v1';
const DELETED_FOLDERS_SET_KEY   = 'medcheck_deleted_folders_v1';

function getCaseFolderOverrides() {
    try {
        return JSON.parse(localStorage.getItem(CASE_FOLDER_OVERRIDES_KEY) || '{}');
    } catch (_e) {
        return {};
    }
}

function saveCaseFolderOverrides(map) {
    try {
        localStorage.setItem(CASE_FOLDER_OVERRIDES_KEY, JSON.stringify(map));
    } catch (_e) {}
}

function setCaseFolderOverride(caseId, folderName) {
    if (!caseId || !folderName) return;
    const map = getCaseFolderOverrides();
    map[caseId] = folderName.trim();
    saveCaseFolderOverrides(map);
}

function getDeletedFoldersSet() {
    try {
        return new Set(JSON.parse(localStorage.getItem(DELETED_FOLDERS_SET_KEY) || '[]'));
    } catch (_e) {
        return new Set();
    }
}

function markFolderAsDeleted(folderName) {
    if (!folderName) return;
    const clean = folderName.trim();
    if (clean.toLowerCase() === 'allgemein') return;
    const set = getDeletedFoldersSet();
    set.add(clean);
    localStorage.setItem(DELETED_FOLDERS_SET_KEY, JSON.stringify(Array.from(set)));
}

function unmarkFolderAsDeleted(folderName) {
    if (!folderName) return;
    const clean = folderName.trim();
    const set = getDeletedFoldersSet();
    if (set.has(clean)) {
        set.delete(clean);
        localStorage.setItem(DELETED_FOLDERS_SET_KEY, JSON.stringify(Array.from(set)));
    }
}

/**
 * Stellt sicher, dass jeder Fall (egal ob Built-in Demo, lokal oder aus Supabase geladen)
 * exakt die vom Nutzer vorgenommenen Ordner-Verschiebungen und Ordner-Löschungen respektiert!
 */
function applyFolderOverridesToCase(caseObj) {
    if (!caseObj) return caseObj;
    const cId = caseObj.case_id || caseObj.id;
    const overrides = getCaseFolderOverrides();
    const deletedFolders = getDeletedFoldersSet();

    let currentFolder = (caseObj.folder_name || caseObj.metadata?.medical_field || 'Allgemein').trim();

    // 1. Hat der Nutzer diesen Fall explizit in einen Ordner verschoben?
    if (cId && overrides[cId]) {
        currentFolder = overrides[cId];
    }

    // 2. Liegt der Fall in einem Ordner, den der Nutzer gelöscht hat? -> Ab nach "Allgemein"!
    if (deletedFolders.has(currentFolder)) {
        currentFolder = 'Allgemein';
        if (cId) {
            overrides[cId] = 'Allgemein';
            saveCaseFolderOverrides(overrides);
        }
    }

    caseObj.folder_name = currentFolder;
    if (caseObj.metadata) {
        caseObj.metadata.medical_field = currentFolder;
    }
    return caseObj;
}

/**
 * Hilfsfunktion: Synchronisiert eine Liste geänderter Fälle im Hintergrund mit Supabase
 */
async function syncModifiedCasesToSupabase(casesList) {
    if (!Array.isArray(casesList) || casesList.length === 0) return;
    const sb = getActiveSupabaseClient();
    if (!sb || !sb.auth) return;

    try {
        const { data: { session } } = await sb.auth.getSession();
        const currentUser = session?.user;
        if (!currentUser) return;

        for (const c of casesList) {
            const cId = c.case_id || c.id;
            if (!cId || cId === BUILTIN_DEMO_CASE.case_id) continue;
            const folder = (c.folder_name || c.metadata?.medical_field || 'Allgemein').trim();
            const title = c.metadata?.title || c.title || cId;

            // Zuerst gezieltes UPDATE versuchen (funktioniert auch für bereits existierende Cloud-Fälle)
            const { data: updated, error: updErr } = await sb
                .from('cases')
                .update({
                    medical_field: folder,
                    content: c
                })
                .eq('case_id', cId)
                .select('case_id');

            // Falls der Fall noch gar nicht in der Cloud war, per UPSERT anlegen
            if (!updErr && (!updated || updated.length === 0)) {
                await sb.from('cases').upsert({
                    case_id: cId,
                    title: title,
                    medical_field: folder,
                    is_public: true,
                    user_id: currentUser.id,
                    created_by: currentUser.id,
                    content: c
                }, { onConflict: 'case_id' });
            }
        }
    } catch (err) {
        console.warn('[Sync] Hintergrund-Sync zu Supabase übersprungen (lokale Overrides greifen trotzdem):', err);
    }
}

// ====================================================
// ORDNER VERWALTUNG (UMBENENNEN & LÖSCHEN MIT SYNC)
// ====================================================

window.renameFolder = async function(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();

    unmarkFolderAsDeleted(cleanNew);
    markFolderAsDeleted(cleanOld);

    // 1. medcheck_folder_order aktualisieren
    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    const idx = order.indexOf(cleanOld);
    if (idx !== -1) {
        order[idx] = cleanNew;
    } else {
        order.push(cleanNew);
    }
    order = Array.from(new Set(order));
    localStorage.setItem('medcheck_folder_order', JSON.stringify(order));

    // 2. Mapping auf Überordner übernehmen
    const mapping = getFolderSuperMapping();
    if (mapping[cleanOld]) {
        mapping[cleanNew] = mapping[cleanOld];
        delete mapping[cleanOld];
        saveFolderSuperMapping(mapping);
    }

    // 3. Alle registrierten Fälle (inkl. Demo-Fall & Custom Cases) + Overrides aktualisieren
    const overrides = getCaseFolderOverrides();
    Object.keys(overrides).forEach(cId => {
        if (overrides[cId] === cleanOld) overrides[cId] = cleanNew;
    });

    const demoFolder = (BUILTIN_DEMO_CASE.folder_name || BUILTIN_DEMO_CASE.metadata?.medical_field || '').trim();
    if (demoFolder === cleanOld || overrides[BUILTIN_DEMO_CASE.case_id] === cleanOld) {
        overrides[BUILTIN_DEMO_CASE.case_id] = cleanNew;
    }

    let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
    let modifiedCases = [];
    customCases.forEach(c => {
        applyFolderOverridesToCase(c);
        const cFolder = (c.folder_name || c.metadata?.medical_field || '').trim();
        if (cFolder === cleanOld) {
            c.folder_name = cleanNew;
            if (c.metadata) c.metadata.medical_field = cleanNew;
            overrides[c.case_id || c.id] = cleanNew;
            modifiedCases.push(c);
        }
    });

    saveCaseFolderOverrides(overrides);
    localStorage.setItem('custom_cases', JSON.stringify(customCases));

    // 4. UI States aktualisieren
    if (openFolders[cleanOld] !== undefined) {
        openFolders[cleanNew] = openFolders[cleanOld];
        delete openFolders[cleanOld];
    }
    if (bookshelfFolderState[cleanOld] !== undefined) {
        bookshelfFolderState[cleanNew] = bookshelfFolderState[cleanOld];
        delete bookshelfFolderState[cleanOld];
    }

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') renderSubjectProgressDrawer();

    // 5. In Supabase synchronisieren
    await syncModifiedCasesToSupabase(modifiedCases);
};

window.deleteFolder = async function(folderName, caseCount = 0) {
    if (!folderName) return;
    const clean = folderName.trim();

    if (clean.toLowerCase() === 'allgemein') {
        alert('Der Standardordner "Allgemein" kann nicht gelöscht werden.');
        return;
    }

    const confirmMsg = caseCount > 0
        ? `Möchtest du den Ordner "${clean}" wirklich löschen?\n\nDie darin liegenden ${caseCount} Fall/Fälle werden dauerhaft in den Ordner "Allgemein" verschoben.`
        : `Möchtest du den leeren Ordner "${clean}" wirklich löschen?`;

    if (!window.confirm(confirmMsg)) return;

    // 1. Ordner in die Tombstone-Liste eintragen (verhindert Wiederauferstehung nach Reload!)
    markFolderAsDeleted(clean);

    // 2. Aus medcheck_folder_order & Dashboard-Order austragen
    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    order = order.filter(f => f !== clean);
    localStorage.setItem('medcheck_folder_order', JSON.stringify(order));

    let dashOrder = getDashboardFolderOrder().filter(f => f !== clean);
    saveDashboardFolderOrder(dashOrder);

    // 3. Aus Überordner-Mapping entfernen
    const mapping = getFolderSuperMapping();
    delete mapping[clean];
    saveFolderSuperMapping(mapping);

    // 4. Alle Fälle in diesem Ordner (auch Built-in Demo & Cloud-Fälle) per Override nach "Allgemein" verschieben
    const overrides = getCaseFolderOverrides();
    Object.keys(overrides).forEach(cId => {
        if (overrides[cId] === clean) overrides[cId] = 'Allgemein';
    });

    const demoCurrentFolder = overrides[BUILTIN_DEMO_CASE.case_id]
        || (BUILTIN_DEMO_CASE.folder_name || BUILTIN_DEMO_CASE.metadata?.medical_field || '').trim();
    if (demoCurrentFolder === clean) {
        overrides[BUILTIN_DEMO_CASE.case_id] = 'Allgemein';
    }

    let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
    let modifiedCases = [];
    customCases.forEach(c => {
        const cId = c.case_id || c.id;
        const cFolder = (overrides[cId] || c.folder_name || c.metadata?.medical_field || '').trim();
        if (cFolder === clean) {
            c.folder_name = 'Allgemein';
            if (c.metadata) c.metadata.medical_field = 'Allgemein';
            if (cId) overrides[cId] = 'Allgemein';
            modifiedCases.push(c);
        }
    });

    saveCaseFolderOverrides(overrides);
    localStorage.setItem('custom_cases', JSON.stringify(customCases));

    // 5. UI States bereinigen & sofort neu rendern
    delete openFolders[clean];
    delete bookshelfFolderState[clean];
    openFolders['Allgemein'] = true;

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') renderSubjectProgressDrawer();
    if (typeof window.renderSpecialtyHub === 'function') window.renderSpecialtyHub();

    // 6. Geänderte Fälle in Supabase synchronisieren
    await syncModifiedCasesToSupabase(modifiedCases);
};

// ====================================================
// ZENTRALE FUNKTION ZUM VERSCHIEBEN VON FÄLLEN IN ORDNER
// ====================================================
window.moveCaseToFolder = async function(caseId, targetFolder) {
    if (!caseId || !targetFolder) return;
    const cleanFolder = targetFolder.trim();

    // Falls der Zielordner früher mal gelöscht wurde, wieder reaktivieren
    unmarkFolderAsDeleted(cleanFolder);

    // 1. Dauerhaften Override für diese case_id speichern (überlebt jeden Reload!)
    setCaseFolderOverride(caseId, cleanFolder);

    let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
    let targetCase = customCases.find(c => (c.case_id || c.id) === caseId);

    if (!targetCase && caseId === BUILTIN_DEMO_CASE.case_id) {
        targetCase = JSON.parse(JSON.stringify(BUILTIN_DEMO_CASE));
    }

    if (!targetCase) {
        const allRegistered = window.getRegisteredCases ? window.getRegisteredCases() : [];
        const found = allRegistered.find(c => (c.case_id || c.id) === caseId);
        if (found) {
            targetCase = JSON.parse(JSON.stringify(found));
        }
    }

    if (!targetCase) {
        console.warn("Fall nicht gefunden zum Verschieben:", caseId);
        return;
    }

    // 2. Ordner-Eigenschaft am Fall-Objekt aktualisieren
    targetCase.folder_name = cleanFolder;
    if (targetCase.metadata) {
        targetCase.metadata.medical_field = cleanFolder;
    }

    if (caseId !== BUILTIN_DEMO_CASE.case_id) {
        customCases = customCases.filter(c => (c.case_id || c.id) !== caseId);
        customCases.push(targetCase);
        localStorage.setItem('custom_cases', JSON.stringify(customCases));
    }

    // 3. Sicherstellen, dass der Zielordner in der Ordnerstruktur registriert ist
    if (typeof registerDynamicFolder === 'function') {
        registerDynamicFolder(cleanFolder);
    }

    openFolders[cleanFolder] = true;

    // 4. Sofort Dashboard & Bookshelf neu rendern
    if (typeof renderDashboardCases === 'function') {
        renderDashboardCases();
    }
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
    if (typeof window.triggerHaptic === 'function') {
        window.triggerHaptic(14);
    }

    // 5. Cloud-Sync in Supabase
    await syncModifiedCasesToSupabase([targetCase]);
};

// Fall direkt auf einen Überordner ziehen
async function moveCaseToSuperFolder(caseId, targetSuperTitle) {
    if (!caseId || !targetSuperTitle) return;
    const allCases = window.getRegisteredCases ? window.getRegisteredCases() : [BUILTIN_DEMO_CASE, ...getCustomCases()];
    const targetCase = allCases.find(c => (c.case_id || c.id) === caseId);
    if (!targetCase) return;

    const currentFolder = (targetCase.folder_name || targetCase.metadata?.medical_field || 'Allgemein').trim();

    let destinationSubfolder = currentFolder;
    if (currentFolder.toLowerCase() === 'allgemein') {
        destinationSubfolder = targetSuperTitle;
    }

    unmarkFolderAsDeleted(destinationSubfolder);

    const mapping = getFolderSuperMapping();
    mapping[destinationSubfolder] = targetSuperTitle;
    saveFolderSuperMapping(mapping);

    superFolderStates[targetSuperTitle] = true;
    bookshelfSuperFolderState[targetSuperTitle] = true;
    openFolders[destinationSubfolder] = true;
    bookshelfFolderState[destinationSubfolder] = true;

    await window.moveCaseToFolder(caseId, destinationSubfolder);
}

window.promptMoveFolderToSuperFolder = function(folderName) {
    if (!folderName) return;
    const currentSuper = getSuperFolderForCategory(folderName);
    const availableSupers = getSuperFolderOrder();

    const optionsText = availableSupers
        .map((s, idx) => `${idx + 1}: ${s}${s === currentSuper ? ' (aktuell)' : ''}`)
        .join('\n');

    const choice = window.prompt(
        `In welchen Überordner möchtest du "${folderName}" verschieben?\n\nGib die Ziffer ein (oder tippe einen komplett neuen Überordner-Namen ein):\n${optionsText}`
    );

    if (choice === null || !choice.trim()) return;
    const trimmed = choice.trim();
    const num = parseInt(trimmed, 10);

    if (!isNaN(num) && num >= 1 && num <= availableSupers.length) {
        const target = availableSupers[num - 1];
        window.moveFolderToSuperFolder(folderName, target);
    } else {
        const existingMatch = availableSupers.find(s => s.toLowerCase() === trimmed.toLowerCase());
        if (existingMatch) {
            window.moveFolderToSuperFolder(folderName, existingMatch);
        } else {
            createCustomSuperFolder(trimmed);
            window.moveFolderToSuperFolder(folderName, trimmed);
        }
    }
};
// ==========================================
// DYNAMISCHES RESIZING DER SIDEBAR
// ==========================================
const SIDEBAR_STORAGE_KEY = 'medcheck_sidebar_width';
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 500;

function setSidebarWidth(widthPx) {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, widthPx));
    document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, clamped.toString());
}

function stepSidebarWidth(deltaPx) {
    const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 260;
    setSidebarWidth(current + deltaPx);
}

function initSidebarResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    if (!resizer) return;

    const savedWidth = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (savedWidth) setSidebarWidth(parseInt(savedWidth, 10));

    let isging = false;

    resizer.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isging = true;
        document.body.classList.add('is-resizing');
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isging) return;
        setSidebarWidth(e.clientX);
    });

    window.addEventListener('mouseup', () => {
        if (isging) {
            isging = false;
            document.body.classList.remove('is-resizing');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initSidebarResizer();
});

// ====================================================
// STATS & SKILLS
// ====================================================
function initUserData() {
    if (!localStorage.getItem('user_xp')) localStorage.setItem('user_xp', '0');
    let rawSkills = JSON.parse(localStorage.getItem('user_skills') || 'null');
    if (!rawSkills || rawSkills.Diagnostics !== undefined) {
        let cleaned = JSON.parse(JSON.stringify(defaultSkills));
        if (rawSkills) {
            cleaned["Triage"].hits += (rawSkills.Triage?.hits || 0);
            cleaned["Triage"].total += (rawSkills.Triage?.total || 0);
            cleaned["Diagnostik"].hits += (rawSkills.Diagnostik?.hits || 0) + (rawSkills.Diagnostics?.hits || 0);
            cleaned["Diagnostik"].total += (rawSkills.Diagnostik?.total || 0) + (rawSkills.Diagnostics?.total || 0);
            cleaned["Pharmakologie"].hits += (rawSkills.Pharmakologie?.hits || 0) + (rawSkills.Pharmacology?.hits || 0);
            cleaned["Pharmakologie"].total += (rawSkills.Pharmakologie?.total || 0) + (rawSkills.Pharmacology?.total || 0);
            cleaned["Pathophysiologie"].hits += (rawSkills.Pathophysiologie?.hits || 0) + (rawSkills.Pathophysiology?.hits || 0);
            cleaned["Pathophysiologie"].total += (rawSkills.Pathophysiologie?.total || 0) + (rawSkills.Pathophysiology?.total || 0);
        }
        localStorage.setItem('user_skills', JSON.stringify(cleaned));
    }

    try {
        let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
        if (window.MedicalDictionary && typeof window.MedicalDictionary.registerAllCases === 'function') {
            window.MedicalDictionary.registerAllCases([BUILTIN_DEMO_CASE, ...customCases]);
        }
    } catch (_dictErr) {}

    updateStatsUI();
}

function updateStatsUI() {
    const xp = parseInt(localStorage.getItem('user_xp') || '0');
    const statXp = document.getElementById('stat-xp');
    if (statXp) statXp.innerText = xp;

    let rank = xp >= 1500 ? 'Oberarzt' : (xp >= 800 ? 'Facharzt' : (xp >= 300 ? 'Assistenzarzt' : 'Famulus'));
    const statRank = document.getElementById('stat-rank');
    if (statRank) statRank.innerText = rank;
}

function applyXpDelta(delta, label) {
    let finalDelta = delta;
    let multSuffix = '';

    // Positiven XP-Gewinn mit aktivem Dienst-Streak-Multiplikator verrechnen
    if (delta > 0 && window.Gamification) {
        window.Gamification.recordActivity('xp_earned');
        const mult = window.Gamification.getXpMultiplier();
        if (mult > 1.0) {
            finalDelta = Math.round(delta * mult);
            multSuffix = ` 🔥${mult}x`;
        }
    }

    let currentXp = Math.max(0, parseInt(localStorage.getItem('user_xp') || '0') + finalDelta);
    localStorage.setItem('user_xp', currentXp);
    updateStatsUI();
    if (window.Cloud) window.Cloud.scheduleProgressSync();

    const container = document.getElementById('hud-popup-container');
    if (!container) return;
    const popup = document.createElement('div');
    popup.className = `score-popup ${finalDelta >= 0 ? 'positive' : 'negative'}`;
    popup.innerText = `${finalDelta >= 0 ? '+' : ''}${finalDelta} XP (${label}${multSuffix})`;
    container.appendChild(popup);
    setTimeout(() => popup.remove(), 1500);
}

function trackSkill(skillTag, isHit) {
    let skills = JSON.parse(localStorage.getItem('user_skills')) || JSON.parse(JSON.stringify(defaultSkills));
    const map = { "Diagnostics": "Diagnostik", "Pharmacology": "Pharmakologie", "Pathophysiology": "Pathophysiologie", "Triage": "Triage" };
    const tag = map[skillTag] || "Diagnostik";
    if (!skills[tag]) skills[tag] = { hits: 0, total: 0 };
    skills[tag].total += 1;
    if (isHit) skills[tag].hits += 1;
    localStorage.setItem('user_skills', JSON.stringify(skills));
    renderSkillsSidebar();
    if (window.Cloud) window.Cloud.scheduleProgressSync();
}

function renderSkillsSidebar() {
    const container = document.getElementById('skills-sidebar-container');
    if (!container) return;

    const skills = JSON.parse(localStorage.getItem('user_skills') || JSON.stringify(defaultSkills));
    const canonicalOrder = ["Triage", "Diagnostik", "Pharmakologie", "Pathophysiologie"];
    container.innerHTML = canonicalOrder.map(skill => {
        const data = skills[skill] || { hits: 0, total: 0 };
        const perc = data.total > 0 ? Math.round((data.hits / data.total) * 100) : 0;
        const color = data.total > 0 ? (perc < 50 ? 'var(--color-risk, #ef4444)' : (perc < 80 ? '#f59e0b' : 'var(--color-symptom, #10b981)')) : 'var(--accent-blue, #38bdf8)';
        return `
            <div style="margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; font-size:0.82rem; font-weight:700; margin-bottom:6px;">
                    <span>${skill}</span>
                    <span style="color:${color}; font-family:'JetBrains Mono';">${perc}% (${data.hits}/${data.total})</span>
                </div>
                <div style="background:rgba(6,9,19,0.7); height:7px; border-radius:10px; overflow:hidden;">
                    <div style="width:${perc}%; background:${color}; height:100%; transition:width 0.4s ease;"></div>
                </div>
            </div>`;
    }).join('');
}


// ====================================================
// DASHBOARD DYNAMISCHES RENDERING (SUPER-FOLDER ENGINE)
// ====================================================
function getDashboardFolderOrder() {
    try { return JSON.parse(localStorage.getItem(DASHBOARD_FOLDER_ORDER_KEY) || '[]'); } catch (_e) { return []; }
}

function saveDashboardFolderOrder(orderArray) {
    try { localStorage.setItem(DASHBOARD_FOLDER_ORDER_KEY, JSON.stringify(orderArray)); } catch (e) {}
}

function reorderDashboardFolders(draggedCat, targetCat) {
    if (!draggedCat || !targetCat || draggedCat === targetCat) return;
    let order = getDashboardFolderOrder();
    const fromIdx = order.indexOf(draggedCat);
    const toIdx = order.indexOf(targetCat);
    if (fromIdx !== -1 && toIdx !== -1) {
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, draggedCat);
        saveDashboardFolderOrder(order);
    }

    let bsOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    const bsFrom = bsOrder.indexOf(draggedCat);
    const bsTo = bsOrder.indexOf(targetCat);
    if (bsFrom !== -1 && bsTo !== -1) {
        bsOrder.splice(bsFrom, 1);
        bsOrder.splice(bsTo, 0, draggedCat);
        localStorage.setItem('medcheck_folder_order', JSON.stringify(bsOrder));
    }

    renderDashboardCases();
}

function toggleFolder(category) {
    if (!category) return;
    openFolders[category] = !openFolders[category];

    // Schnelles DOM-Toggling ohne kompletten Re-Render:
    const safeCat = encodeURIComponent(category);
    const folderEl = document.querySelector(`.category-folder[data-category="${safeCat}"]`);
    if (folderEl) {
        const body = folderEl.querySelector('.category-cases-body');
        const arrow = folderEl.querySelector('.category-arrow');
        const isNowOpen = !!openFolders[category];

        if (body) body.style.display = isNowOpen ? 'grid' : 'none';
        if (arrow) arrow.classList.toggle('expanded', isNowOpen);
    } else {
        // Fallback: Re-Render, falls das Element nicht direkt selektierbar war
        renderDashboardCases();
    }
}
window.toggleFolder = toggleFolder;
// ====================================================
// DASHBOARD ECHTZEIT-SUCHE & DEEP-INDEXING ENGINE
// ====================================================
let dashboardSearchQuery = '';
let dashboardSearchStatusFilter = 'all'; // 'all' | 'open' | 'progress' | 'solved'
let isDashboardSearchOpen = false;

window.toggleDashboardSearch = function(forceOpen) {
    const panel = document.getElementById('dashboard-search-panel');
    const toggleBtn = document.getElementById('dashboard-search-toggle-btn');
    const input = document.getElementById('dashboard-case-search-input');
    if (!panel) return;

    isDashboardSearchOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.classList.contains('hidden');

    if (isDashboardSearchOpen) {
        panel.classList.remove('hidden');
        if (toggleBtn) toggleBtn.classList.add('active');
        setTimeout(() => input?.focus(), 40);
    } else {
        panel.classList.add('hidden');
        if (toggleBtn) toggleBtn.classList.remove('active');
        if (dashboardSearchQuery !== '' || dashboardSearchStatusFilter !== 'all') {
            window.clearDashboardSearch(true);
        }
    }
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
};

window.handleDashboardSearchInput = function(val) {
    dashboardSearchQuery = (val || '').trim();
    const clearBtn = document.getElementById('dashboard-search-clear-btn');
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', dashboardSearchQuery.length === 0 && dashboardSearchStatusFilter === 'all');
    }
    renderDashboardCases();
};

window.setDashboardSearchStatus = function(statusKey, btnEl) {
    dashboardSearchStatusFilter = statusKey || 'all';
    document.querySelectorAll('.search-status-pill').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const clearBtn = document.getElementById('dashboard-search-clear-btn');
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', dashboardSearchQuery.length === 0 && dashboardSearchStatusFilter === 'all');
    }
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
    renderDashboardCases();
};

window.clearDashboardSearch = function(keepClosed = false) {
    dashboardSearchQuery = '';
    dashboardSearchStatusFilter = 'all';

    const input = document.getElementById('dashboard-case-search-input');
    if (input) {
        input.value = '';
        if (!keepClosed && isDashboardSearchOpen) input.focus();
    }

    document.querySelectorAll('.search-status-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-status-filter') === 'all');
    });

    const clearBtn = document.getElementById('dashboard-search-clear-btn');
    if (clearBtn) clearBtn.classList.add('hidden');

    const statsEl = document.getElementById('dashboard-search-stats');
    if (statsEl) statsEl.textContent = '';

    renderDashboardCases();
};

// Prüft, ob ein Fall zur Suchanfrage + Statusfilter passt, und liefert die genaue Fundstelle zurück
function evaluateCaseSearchMatch(caseObj, queryLower, statusFilter, solvedList) {
    const isSolved = solvedList.includes(caseObj.case_id);
    const savedState = ProgressManager.getCaseProgress(caseObj.case_id);
    const inProgress = !isSolved && savedState && Object.keys(savedState).length > 0;

    if (statusFilter === 'solved' && !isSolved) return { matches: false, reason: null };
    if (statusFilter === 'progress' && !inProgress) return { matches: false, reason: null };
    if (statusFilter === 'open' && (isSolved || inProgress)) return { matches: false, reason: null };

    if (!queryLower) return { matches: true, reason: null };

    const title = (caseObj.metadata?.title || caseObj.case_id || '');
    const primary = (caseObj.metadata?.primary_disease || '');
    const folder = (caseObj.folder_name || caseObj.metadata?.medical_field || '');
    const topic = (caseObj.case_overview?.topic || '');
    const summary = (caseObj.case_overview?.summary || '');

    if (title.toLowerCase().includes(queryLower)) return { matches: true, reason: 'Falltitel' };
    if (primary.toLowerCase().includes(queryLower)) return { matches: true, reason: `Leitdiagnose: ${primary}` };
    if (folder.toLowerCase().includes(queryLower)) return { matches: true, reason: `Ordner: ${folder}` };
    if (topic.toLowerCase().includes(queryLower)) return { matches: true, reason: `Thema: ${topic}` };

    // Cornell Cues durchsuchen
    const cornell = Array.isArray(caseObj.case_overview?.cornell_notes) ? caseObj.case_overview.cornell_notes : [];
    for (const row of cornell) {
        const hitCue = (row.cues || []).find(cue => String(cue).toLowerCase().includes(queryLower));
        if (hitCue) return { matches: true, reason: `Cornell-Cue: „${hitCue}“` };
        const cleanNotes = String(row.notes || '').replace(/<[^>]*>/g, ' ');
        if (cleanNotes.toLowerCase().includes(queryLower)) {
            return { matches: true, reason: 'Cornell-Notizen' };
        }
    }

    if (summary.toLowerCase().includes(queryLower)) return { matches: true, reason: 'Take-Home Summary' };

    // Differenzialdiagnosen / Doctordle durchsuchen
    const libEntries = Array.isArray(caseObj.extra_tasks?.library_entries) ? caseObj.extra_tasks.library_entries : [];
    const hitLib = libEntries.find(e => String(e).toLowerCase().includes(queryLower));
    if (hitLib) return { matches: true, reason: `DD: ${hitLib}` };

    return { matches: false, reason: null };
}

function highlightSearchTerm(text, query) {
    const safeText = escapeHtml(text || '');
    if (!query || query.length < 2) return safeText;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return safeText.replace(regex, '<mark class="mc-search-highlight">$1</mark>');
}

// Tastatur-Shortcuts: Ctrl/Cmd + K zum Öffnen, ESC zum Zurücksetzen
document.addEventListener('keydown', (e) => {
    const dashboardView = document.getElementById('dashboard-view');
    const isDashboardVisible = dashboardView && dashboardView.style.display !== 'none';
    if (!isDashboardVisible) return;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.toggleDashboardSearch(true);
    } else if (e.key === 'Escape' && isDashboardSearchOpen) {
        const input = document.getElementById('dashboard-case-search-input');
        if (dashboardSearchQuery.length > 0 || dashboardSearchStatusFilter !== 'all') {
            window.clearDashboardSearch(false);
        } else {
            window.toggleDashboardSearch(false);
            input?.blur();
        }
    }
});

function renderDashboardCases() {
    initCustomSuperFoldersState();
    ensureBookshelfHeaderButtons();

    const customCases = getCustomCases();
    const solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');

    let wrapper = document.getElementById('super-folders-wrapper');
    if (!wrapper) {
        const topicGrid = document.getElementById('topic-grid');
        if (topicGrid) {
            wrapper = document.createElement('div');
            wrapper.id = 'super-folders-wrapper';
            wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin-top: 12px;';
            topicGrid.parentNode.replaceChild(wrapper, topicGrid);
        }
    }
    if (!wrapper) return;

    const allCases = [BUILTIN_DEMO_CASE, ...customCases.filter(c => c.case_id !== BUILTIN_DEMO_CASE.case_id)];

    const queryLower = dashboardSearchQuery.toLowerCase();
    const isFilteringActive = queryLower.length > 0 || dashboardSearchStatusFilter !== 'all';
    const caseMatchMap = {};
    let totalMatchedCasesCount = 0;

    const savedSubOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    const grouped = {};
    savedSubOrder.forEach(folderName => {
        if (folderName && folderName.trim()) {
            grouped[folderName.trim()] = [];
        }
    });

    allCases.forEach(c => {
        const matchResult = evaluateCaseSearchMatch(c, queryLower, dashboardSearchStatusFilter, solved);
        if (!matchResult.matches) return;

        caseMatchMap[c.case_id] = matchResult.reason;
        totalMatchedCasesCount++;

        const cat = (c.folder_name || c.metadata?.medical_field || "Allgemein").trim();
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(c);
    });

    const statsEl = document.getElementById('dashboard-search-stats');
    if (statsEl) {
        statsEl.textContent = isFilteringActive
            ? `${totalMatchedCasesCount} ${totalMatchedCasesCount === 1 ? 'Treffer' : 'Treffer'}`
            : '';
    }

    const orderedSuperTitles = getSuperFolderOrder();
    const superFolders = {};
    orderedSuperTitles.forEach(key => {
        superFolders[key] = [];
    });

    Object.keys(grouped).forEach(cat => {
        if (isFilteringActive && grouped[cat].length === 0 && (!queryLower || !cat.toLowerCase().includes(queryLower))) {
            return;
        }
        const targetSuper = getSuperFolderForCategory(cat);
        if (!superFolders[targetSuper]) superFolders[targetSuper] = [];
        superFolders[targetSuper].push(cat);
    });

    const isCurrentUserCreator = window.currentSessionUser?.email?.toLowerCase() === CREATOR_EMAIL.toLowerCase();

    let superFoldersHtml = '';
    const subFolderOrderList = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    let renderedSuperCount = 0;

    Object.entries(superFolders).forEach(([superTitle, categories], superIdx) => {
        if (isFilteringActive && categories.length === 0) return;
        renderedSuperCount++;

        const isOpen = isFilteringActive ? true : !!superFolderStates[superTitle];
        const arrowSymbol = isOpen ? '▼' : '▶';
        const isProtectedDefault = (superTitle === 'Allgemein');

        let totalCasesInSuper = 0;
        let solvedCasesInSuper = 0;
        categories.forEach(cName => {
            const list = grouped[cName] || [];
            totalCasesInSuper += list.length;
            solvedCasesInSuper += list.filter(c => solved.includes(c.case_id)).length;
        });

        let categoriesHtml = '';
        if (categories.length === 0) {
            categoriesHtml = `
                <div class="empty-superfolder-hint">
                    <span>Ordner leer</span>
                    <button type="button" class="ghost-tool-btn" onclick="event.stopPropagation(); window.createSubfolderInSuperFolder('${escapeHtml(superTitle).replace(/'/g, "\\'")}')">+ Unterordner</button>
                </div>`;
        } else {
            categories.sort((a, b) => {
                const idxA = subFolderOrderList.indexOf(a);
                const idxB = subFolderOrderList.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            categoriesHtml = categories.map((category, catIdx) => {
                const cases = grouped[category] || [];
                const solvedCount = cases.filter(c => solved.includes(c.case_id)).length;
                const isExpanded = isFilteringActive ? true : !!openFolders[category];

                const cardsHtml = cases.length === 0
                    ? `<div class="empty-subfolder-hint">Noch keine Fälle (Fallkarte per Drag & Drop hierher ziehen).</div>`
                    : cases.map(c => {
                        const isSolved = solved.includes(c.case_id);
                        const savedState = ProgressManager.getCaseProgress(c.case_id);
                        const inProgress = !isSolved && savedState && Object.keys(savedState).length > 0;
                        const isCloudCase = !!(window.cloudCaseIds && window.cloudCaseIds.has(c.case_id));
                        const matchReason = caseMatchMap[c.case_id];

                        const statusClass = isSolved ? 'status-solved' : (inProgress ? 'status-progress' : 'status-open');
                        const statusLabel = isSolved ? 'Gelöst' : (inProgress ? 'In Arbeit' : 'Offen');

                        const deleteBtn = c.case_id === BUILTIN_DEMO_CASE.case_id
                            ? ''
                            : '<button type="button" class="delete-case-btn" aria-label="Fall löschen" title="Fall lokal entfernen">✕</button>';

                        const unpublishBtn = (isCurrentUserCreator && isCloudCase)
                            ? `<button type="button" class="unpublish-case-btn" data-unpublish-id="${encodeURIComponent(c.case_id)}" title="Aus Cloud entfernen">☁️✕</button>`
                            : '';

                        const matchBadgeHtml = (queryLower && matchReason && matchReason !== 'Falltitel')
                            ? `<div class="case-search-match-pill">🎯 ${escapeHtml(matchReason)}</div>`
                            : '';

                        return `
                        <div class="case-card ${inProgress ? 'in-progress' : ''} ${isSolved ? 'is-solved-card' : ''}" 
                             draggable="true" 
                             data-case-id="${encodeURIComponent(c.case_id)}" 
                             role="button" 
                             tabindex="0">

                            <div class="case-card-top">
                                <span class="case-status-pill ${statusClass}">
                                    <span class="status-dot"></span>${statusLabel}
                                </span>
                                <div class="case-card-actions">
                                    ${unpublishBtn}
                                    ${deleteBtn}
                                </div>
                            </div>

                            <h3>${highlightSearchTerm(c.metadata?.title || c.case_id, dashboardSearchQuery)}</h3>
                            ${matchBadgeHtml}

                            <div class="case-card-footer">
                                <span class="case-meta-source">${isCloudCase ? 'Cloud' : 'Lokal'}</span>
                                <span class="case-meta-xp">+${c.metadata?.xp_reward || 900} XP</span>
                            </div>
                        </div>`;
                    }).join('');

                const escapedCatJs = escapeHtml(category).replace(/'/g, "\\'");

                return `
                    <div class="category-folder" draggable="true" data-category="${encodeURIComponent(category)}" data-super="${encodeURIComponent(superTitle)}" id="dashboard-folder-${superIdx}-${catIdx}">
                        <div class="category-header">
                            <div class="category-title-wrap">
                                <span class="category-drag-handle" title="Ziehen zum Verschieben">⠿</span>
                                <span class="category-arrow ${isExpanded ? 'expanded' : ''}" id="arrow-${superIdx}-${catIdx}">▶</span>
                                <span class="category-name-text">${highlightSearchTerm(category, dashboardSearchQuery)}</span>
                            </div>
                            <div class="category-header-right">
                                <div class="folder-hover-tools">
                                    <button type="button" class="folder-action-btn move-btn" onclick="event.stopPropagation(); promptMoveFolderToSuperFolder('${escapedCatJs}')" title="Verschieben">⇄</button>
                                    <button type="button" class="folder-action-btn edit-btn" onclick="event.stopPropagation(); const n = window.prompt('Neuer Name für den Unterordner:', '${escapedCatJs}'); if(n && n.trim() && n.trim() !== '${escapedCatJs}') renameFolder('${escapedCatJs}', n.trim());" title="Umbenennen">✏️</button>
                                    <button type="button" class="folder-action-btn delete-folder-btn" onclick="event.stopPropagation(); deleteFolder('${escapedCatJs}', ${cases.length});" title="Löschen">🗑️</button>
                                </div>
                                <span class="category-badge">${solvedCount}/${cases.length}</span>
                            </div>
                        </div>
                        <div class="category-cases-body" id="folder-body-${superIdx}-${catIdx}" style="display:${isExpanded ? 'grid' : 'none'};">${cardsHtml}</div>
                    </div>`;
            }).join('');
        }

        const escapedSuperJs = escapeHtml(superTitle).replace(/'/g, "\\'");
        const superEditControls = !isProtectedDefault
            ? `
                <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.createSubfolderInSuperFolder('${escapedSuperJs}')" title="Neuer Unterordner">+</button>
                <button type="button" class="folder-action-btn edit-btn" onclick="event.stopPropagation(); window.renameSuperFolder('${escapedSuperJs}')" title="Umbenennen">✏️</button>
                <button type="button" class="folder-action-btn delete-folder-btn" onclick="event.stopPropagation(); window.removeCustomSuperFolder('${escapedSuperJs}')" title="Löschen">🗑️</button>
              `
            : `
                <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.createSubfolderInSuperFolder('${escapedSuperJs}')" title="Neuer Unterordner">+</button>
              `;

        superFoldersHtml += `
            <div class="super-folder" draggable="true" data-super-title="${encodeURIComponent(superTitle)}">
                <div class="super-folder-header" onclick="toggleSuperFolder('${escapedSuperJs}')">
                    <div class="super-folder-title">
                        <span class="super-drag-handle" title="Ziehen zum Umsortieren">⠿</span>
                        <svg class="super-folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        <span>${escapeHtml(superTitle)}</span>
                    </div>
                    <div class="super-folder-right">
                        <div class="folder-hover-tools">
                            ${superEditControls}
                        </div>
                        <span class="super-count-pill">${solvedCasesInSuper}/${totalCasesInSuper}</span>
                        <span class="super-chevron">${arrowSymbol}</span>
                    </div>
                </div>
                <div class="super-folder-body" style="display:${isOpen ? 'flex' : 'none'}; flex-direction:column; gap:10px;">
                    ${categoriesHtml}
                </div>
            </div>
        `;
    });

    if (isFilteringActive && renderedSuperCount === 0) {
        superFoldersHtml += `
            <div class="dashboard-search-empty-state">
                <div style="font-size: 1.5rem; margin-bottom: 6px;">🔍</div>
                <div style="font-weight: 700; color: var(--text-main); font-size: 0.92rem; margin-bottom: 4px;">
                    Keine passenden Fälle gefunden
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
                    Für „${escapeHtml(dashboardSearchQuery)}“ wurden keine Treffer gefunden.
                </div>
                <button type="button" class="action-btn secondary btn-sm" onclick="window.clearDashboardSearch()">
                    Filter zurücksetzen
                </button>
            </div>
        `;
    }

    wrapper.innerHTML = superFoldersHtml;

    // Drag & Drop für Überordner
    wrapper.querySelectorAll('.super-folder').forEach(superEl => {
        const sTitle = decodeURIComponent(superEl.dataset.superTitle);
        const superHeader = superEl.querySelector('.super-folder-header');

        if (superHeader) {
            superEl.addEventListener('dragstart', (e) => {
                if (e.target.closest('.category-folder') || e.target.closest('.case-card')) return;
                draggedSuperFolderTitle = sTitle;
                draggedItemState = { type: 'super-folder', name: sTitle };
                superEl.classList.add('folder-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', sTitle);
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
            });

            superEl.addEventListener('dragend', () => {
                superEl.classList.remove('folder-dragging');
                draggedSuperFolderTitle = null;
                if (draggedItemState?.type === 'super-folder') draggedItemState = null;
                wrapper.querySelectorAll('.super-folder').forEach(f => f.classList.remove('super-folder-drag-over'));
            });
        }

        superEl.addEventListener('dragover', (e) => {
            const hasDragPayload = draggedDashboardFolder || draggedSuperFolderTitle || draggedItemState;
            if (!hasDragPayload) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            superEl.classList.add('super-folder-drag-over');
        });

        superEl.addEventListener('dragleave', (e) => {
            if (!superEl.contains(e.relatedTarget)) {
                superEl.classList.remove('super-folder-drag-over');
            }
        });

        superEl.addEventListener('drop', async (e) => {
            if (e.target.closest('.category-folder') && !draggedSuperFolderTitle && draggedItemState?.type !== 'super-folder') {
                superEl.classList.remove('super-folder-drag-over');
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            superEl.classList.remove('super-folder-drag-over');

            if (draggedSuperFolderTitle || draggedItemState?.type === 'super-folder') {
                const sourceSuper = draggedSuperFolderTitle || draggedItemState.name;
                draggedSuperFolderTitle = null;
                draggedItemState = null;
                reorderSuperFolders(sourceSuper, sTitle);
                return;
            }

            if (draggedDashboardFolder) {
                const folderToMove = draggedDashboardFolder;
                draggedDashboardFolder = null;
                window.moveFolderToSuperFolder(folderToMove, sTitle);
                return;
            }

            if (draggedItemState) {
                if (draggedItemState.type === 'folder') {
                    const fName = draggedItemState.name;
                    draggedItemState = null;
                    window.moveFolderToSuperFolder(fName, sTitle);
                } else if (draggedItemState.type === 'case') {
                    const cId = draggedItemState.id;
                    draggedItemState = null;
                    await moveCaseToSuperFolder(cId, sTitle);
                }
            }
        });
    });

    // Klick- & Drag-Handler für Unterordner
    wrapper.querySelectorAll('.category-folder').forEach(folderEl => {
        const catName = decodeURIComponent(folderEl.dataset.category);
        const header = folderEl.querySelector('.category-header');
        if (header) {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.category-drag-handle') || e.target.closest('.folder-action-btn')) return;
                toggleFolder(catName);
            });
        }

        folderEl.addEventListener('dragstart', (e) => {
            if (e.target.closest('.case-card')) return;
            e.stopPropagation();
            draggedDashboardFolder = catName;
            draggedItemState = { type: 'folder', name: catName };
            folderEl.classList.add('folder-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', catName);
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
        });

        folderEl.addEventListener('dragend', () => {
            folderEl.classList.remove('folder-dragging');
            draggedDashboardFolder = null;
            if (draggedItemState?.type === 'folder') draggedItemState = null;
            wrapper.querySelectorAll('.super-folder').forEach(f => f.classList.remove('super-folder-drag-over'));
            wrapper.querySelectorAll('.category-folder').forEach(f => f.classList.remove('drag-over-folder'));
        });

        folderEl.addEventListener('dragover', (e) => {
            if (draggedSuperFolderTitle || draggedItemState?.type === 'super-folder') return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            folderEl.classList.add('drag-over-folder');
        });

        folderEl.addEventListener('dragleave', (e) => {
            if (!folderEl.contains(e.relatedTarget)) {
                folderEl.classList.remove('drag-over-folder');
            }
        });

        folderEl.addEventListener('drop', async (e) => {
            if (draggedSuperFolderTitle || draggedItemState?.type === 'super-folder') return;
            e.preventDefault();
            e.stopPropagation();
            folderEl.classList.remove('drag-over-folder');

            const droppedCaseId = (draggedItemState?.type === 'case' && draggedItemState.id) || e.dataTransfer.getData('application/medcheck-case-id');
            if (droppedCaseId) {
                draggedItemState = null;
                openFolders[catName] = true;
                await moveCaseToFolder(droppedCaseId, catName);
                return;
            }

            const sourceFolder = draggedDashboardFolder || (draggedItemState?.type === 'folder' ? draggedItemState.name : null);
            if (sourceFolder && sourceFolder !== catName) {
                draggedDashboardFolder = null;
                draggedItemState = null;
                const targetSuper = getSuperFolderForCategory(catName);
                window.moveFolderToSuperFolder(sourceFolder, targetSuper);
                reorderDashboardFolders(sourceFolder, catName);
            }
        });
    });

    // Fall-Karten Handler
    wrapper.querySelectorAll('.case-card[data-case-id]').forEach(card => {
        const caseId = decodeURIComponent(card.dataset.caseId);

        card.addEventListener('click', () => window.loadCaseById(caseId));
        card.addEventListener('keydown', event => {
            if (event.target !== card) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.loadCaseById(caseId);
            }
        });

        card.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            draggedItemState = { type: 'case', id: caseId };
            e.dataTransfer.effectAllowed = 'copyMove';
            e.dataTransfer.setData('text/plain', caseId);
            e.dataTransfer.setData('application/medcheck-case-id', caseId);
            card.classList.add('case-card-dragging');
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('case-card-dragging');
            if (draggedItemState?.type === 'case') draggedItemState = null;
        });

        const deleteBtn = card.querySelector('.delete-case-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', event => {
                event.stopPropagation();
                window.deleteCaseById(caseId);
            });
        }

        const unpublishBtn = card.querySelector('.unpublish-case-btn');
        if (unpublishBtn) {
            unpublishBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                await unpublishCaseFromCloud(caseId);
            });
        }
    });

    try {
        renderBookshelf(allCases);
    } catch (bsErr) {
        console.error("Bookshelf Fehler:", bsErr);
    }
}

// ====================================================
// NOTABILITY-STYLE BOOKSHELF MIT DYNAMISCHER EINRÜCKUNG
// ====================================================

let activeDropIndicator = null;
let currentDropTargetInfo = null;

function removeDropIndicator() {
    if (activeDropIndicator) {
        activeDropIndicator.remove();
        activeDropIndicator = null;
    }
    currentDropTargetInfo = null;
}

function renderBookshelf(casesArray) {
    const bookshelfContainer = document.getElementById('bookshelf-container');
    if (!bookshelfContainer) return;

    ensureBookshelfHeaderButtons();
    bookshelfContainer.innerHTML = '';

    const solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    let savedOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');

    const folders = {};
    savedOrder.forEach(name => { folders[name] = []; });

    casesArray.forEach(c => {
        const folder = (c.folder_name || c.metadata?.medical_field || 'Allgemein').trim();
        if (!folders[folder]) {
            folders[folder] = [];
            if (!savedOrder.includes(folder)) savedOrder.push(folder);
        }
        folders[folder].push(c);
    });

    localStorage.setItem('medcheck_folder_order', JSON.stringify(savedOrder));

    const orderedSuperTitles = getSuperFolderOrder();
    const superFolders = {};
    orderedSuperTitles.forEach(key => { superFolders[key] = []; });

    savedOrder.forEach(folderName => {
        const targetSuper = getSuperFolderForCategory(folderName);
        if (!superFolders[targetSuper]) {
            superFolders[targetSuper] = [];
        }
        superFolders[targetSuper].push(folderName);
    });

    Object.entries(superFolders).forEach(([superTitle, subfolderNames]) => {
        const isSuperOpen = !!bookshelfSuperFolderState[superTitle];
        const isProtectedDefault = (superTitle === 'Allgemein');

        let totalCasesInSuper = 0;
        let solvedCasesInSuper = 0;
        subfolderNames.forEach(fName => {
            const list = folders[fName] || [];
            totalCasesInSuper += list.length;
            solvedCasesInSuper += list.filter(c => solved.includes(c.case_id)).length;
        });

        // ==========================
        // ÜBERORDNER-ELEMENT (ROOT)
        // ==========================
        const superDiv = document.createElement('div');
        superDiv.className = 'bookshelf-super-group';
        superDiv.dataset.folderName = superTitle;
        superDiv.dataset.isSuper = 'true';
        superDiv.draggable = true;

        const superHeader = document.createElement('div');
        superHeader.className = 'bookshelf-super-header';
        superHeader.innerHTML = `
            <div class="bookshelf-super-title-wrap" style="display:flex; align-items:center; gap:5px; overflow:hidden; flex:1; min-width:0;">
                <span class="folder-drag-handle super-drag-handle" title="Ziehen zum Umsortieren oder Einrücken">⠿</span>
                <span class="bookshelf-super-arrow ${isSuperOpen ? 'open' : ''}">▶</span>
                <span class="bookshelf-super-icon">📂</span>
                <span class="bookshelf-super-title" title="${escapeHtml(superTitle)}" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:700;">${escapeHtml(superTitle)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:2px; flex-shrink:0;">
                <span class="bookshelf-super-badge" style="margin-right:2px;">${solvedCasesInSuper}/${totalCasesInSuper}</span>
                <button type="button" class="folder-action-btn add-sub-btn" title="Neuen Unterordner erstellen">➕</button>
                ${!isProtectedDefault ? `
                    <button type="button" class="folder-action-btn edit-super-btn" title="Überordner umbenennen">✏️</button>
                    <button type="button" class="folder-action-btn delete-super-btn" title="Überordner löschen">🗑️</button>
                ` : ''}
            </div>
        `;

        // Buttons binden
        superHeader.querySelector('.add-sub-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.createSubfolderInSuperFolder(superTitle);
        });
        superHeader.querySelector('.edit-super-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.renameSuperFolder(superTitle);
        });
        superHeader.querySelector('.delete-super-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            removeCustomSuperFolder(superTitle);
        });

        superHeader.addEventListener('click', (e) => {
            if (e.target.closest('.folder-action-btn') || e.target.closest('.super-drag-handle')) return;
            bookshelfSuperFolderState[superTitle] = !isSuperOpen;
            renderBookshelf(casesArray);
        });

        // ==========================
        // UNTERORDNER-CONTAINER
        // ==========================
        const superBody = document.createElement('div');
        superBody.className = `bookshelf-super-body ${isSuperOpen ? '' : 'collapsed'}`;

        subfolderNames.forEach(folderName => {
            const casesInFolder = folders[folderName] || [];
            const isOpen = !!bookshelfFolderState[folderName];
            const solvedCount = casesInFolder.filter(c => solved.includes(c.case_id)).length;

            const folderDiv = document.createElement('div');
            folderDiv.className = 'folder-group is-subfolder';
            folderDiv.dataset.folderName = folderName;
            folderDiv.dataset.parentSuper = superTitle;
            folderDiv.dataset.isSuper = 'false';
            folderDiv.draggable = true;

            const header = document.createElement('div');
            header.className = 'folder-header';
            header.innerHTML = `
                <div class="folder-header-left" style="display:flex; align-items:center; overflow:hidden; gap:5px; flex:1; min-width:0;">
                    <span class="folder-drag-handle" title="Ziehen: Ganz links = Überordner, Rechts = Unterordner">⠿</span>
                    <span class="folder-toggle-arrow ${isOpen ? 'open' : ''}">▶</span>
                    <span class="folder-title-text" style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">📁 ${escapeHtml(folderName)}</span>
                    <span class="folder-badge-mini" style="font-size:0.65rem; color:var(--accent-cyan, #38bdf8); margin-left:auto; margin-right:4px;">${solvedCount}/${casesInFolder.length}</span>
                </div>
                <div style="display:flex; align-items:center; gap:2px; flex-shrink:0;">
                    <button type="button" class="folder-action-btn edit-btn" title="Unterordner umbenennen">✏️</button>
                    <button type="button" class="folder-action-btn delete-folder-btn" title="Unterordner löschen">🗑️</button>
                </div>
            `;

            header.querySelector('.edit-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const newName = window.prompt("Neuer Name für den Ordner:", folderName);
                if (newName && newName.trim() && newName.trim() !== folderName) {
                    renameFolder(folderName, newName.trim());
                }
            });

            header.querySelector('.delete-folder-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFolder(folderName, casesInFolder.length);
            });

            header.addEventListener('click', (e) => {
                if (e.target.closest('.folder-action-btn') || e.target.closest('.folder-drag-handle')) return;
                bookshelfFolderState[folderName] = !isOpen;
                renderBookshelf(casesArray);
            });

            // Fälle innerhalb des Unterordners
            const list = document.createElement('ul');
            list.className = `folder-cases-list ${isOpen ? '' : 'collapsed'}`;
            casesInFolder.forEach(caseItem => {
                const li = document.createElement('li');
                const isSolved = solved.includes(caseItem.case_id);
                li.className = `folder-case-item ${isSolved ? 'case-solved' : ''}`;
                li.textContent = caseItem.metadata?.title || caseItem.case_id;
                li.dataset.caseId = caseItem.case_id;
                li.draggable = true;

                li.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    draggedItemState = { type: 'case', id: caseItem.case_id };
                    e.dataTransfer.setData('text/plain', caseItem.case_id);
                    e.dataTransfer.setData('application/medcheck-case-id', caseItem.case_id);
                });
                li.addEventListener('click', () => window.loadCaseById(caseItem.case_id));
                list.appendChild(li);
            });

            folderDiv.appendChild(header);
            folderDiv.appendChild(list);
            superBody.appendChild(folderDiv);
        });

        superDiv.appendChild(superHeader);
        superDiv.appendChild(superBody);
        bookshelfContainer.appendChild(superDiv);
    });

  // ====================================================
    // NOTABILITY-STYLE INTERACTION ENGINE MIT LEUCHT-FEEDBACK
    // ====================================================
    const draggableRows = bookshelfContainer.querySelectorAll('.bookshelf-super-group, .folder-group.is-subfolder');

    function clearRowGlows() {
        draggableRows.forEach(r => {
            r.classList.remove('drop-target-active');
            r.classList.remove('drop-target-sub-active');
        });
    }

    draggableRows.forEach(row => {
        row.addEventListener('dragstart', (e) => {
            if (e.target.closest('.folder-case-item')) return;
            e.stopPropagation();

            const name = row.dataset.folderName;
            const isSuper = row.dataset.isSuper === 'true';

            draggedItemState = { 
                type: 'bookshelf-folder', 
                name: name, 
                isSuper: isSuper,
                parentSuper: row.dataset.parentSuper || null 
            };

            row.classList.add('bookshelf-item-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', name);
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
        });

        row.addEventListener('dragend', () => {
            row.classList.remove('bookshelf-item-dragging');
            clearRowGlows();
            removeDropIndicator();
            draggedItemState = null;
        });

        row.addEventListener('dragover', (e) => {
            // A) Wenn ein Fall über den Ordner gezogen wird:
            const isCaseDrag = draggedItemState?.type === 'case' || e.dataTransfer.types.includes('application/medcheck-case-id');
            if (isCaseDrag) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                clearRowGlows();
                row.classList.add('drop-target-active');
                return;
            }

            // B) Wenn ein Bookshelf-Ordner verschoben wird:
            if (!draggedItemState || draggedItemState.type !== 'bookshelf-folder') return;
            if (draggedItemState.name === row.dataset.folderName) return;

            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            const containerRect = bookshelfContainer.getBoundingClientRect();
            const mouseXRelative = e.clientX - containerRect.left;
            const makeSubfolder = mouseXRelative >= 38;

            clearRowGlows();
            if (makeSubfolder) {
                row.classList.add('drop-target-sub-active');
            } else {
                row.classList.add('drop-target-active');
            }

            if (!activeDropIndicator) {
                activeDropIndicator = document.createElement('div');
                activeDropIndicator.className = 'bookshelf-drop-indicator';
            }

            activeDropIndicator.className = `bookshelf-drop-indicator ${makeSubfolder ? 'as-sub' : 'as-super'}`;
            row.after(activeDropIndicator);

            currentDropTargetInfo = {
                targetName: row.dataset.folderName,
                targetIsSuper: row.dataset.isSuper === 'true',
                targetParentSuper: row.dataset.parentSuper || null,
                makeSubfolder: makeSubfolder
            };
        });

        row.addEventListener('dragleave', (e) => {
            if (!row.contains(e.relatedTarget)) {
                row.classList.remove('drop-target-active');
                row.classList.remove('drop-target-sub-active');
            }
        });

        row.addEventListener('drop', async (e) => {
            clearRowGlows();
            removeDropIndicator();

            // A) Fallkarte wurde auf diesen Ordner/Überordner fallen gelassen:
            const droppedCaseId = (draggedItemState?.type === 'case' && draggedItemState.id) 
                                  || e.dataTransfer.getData('application/medcheck-case-id')
                                  || e.dataTransfer.getData('text/plain');

            if (draggedItemState?.type === 'case' || e.dataTransfer.types.includes('application/medcheck-case-id')) {
                e.preventDefault();
                e.stopPropagation();
                draggedItemState = null;

                const targetFolderName = row.dataset.folderName;
                const isSuper = row.dataset.isSuper === 'true';

                if (isSuper) {
                    await moveCaseToSuperFolder(droppedCaseId, targetFolderName);
                } else {
                    await window.moveCaseToFolder(droppedCaseId, targetFolderName);
                }
                return;
            }

            // B) Ordner-Hierarchie-Änderung (Notability Style):
            if (!draggedItemState || draggedItemState.type !== 'bookshelf-folder') return;
            e.preventDefault();
            e.stopPropagation();

            const info = currentDropTargetInfo;
            const dragged = draggedItemState;

            if (!info || dragged.name === info.targetName) return;

            applyNotabilityFolderHierarchy(dragged, info);
        });
    }); // <-- HIER: Sauberes Schließen von draggableRows.forEach

    bookshelfContainer.addEventListener('dragleave', (e) => {
        if (!bookshelfContainer.contains(e.relatedTarget)) {
            clearRowGlows();
            removeDropIndicator();
        }
    });
} // <-- HIER: Sauberes Schließen von function renderBookshelf()
/**
 * Wendet die Notability-Hierarchieänderung auf Überordner- und Unterordner-Listen an
 */
function applyNotabilityFolderHierarchy(dragged, targetInfo) {
    const draggedName = dragged.name;
    let superOrder = getSuperFolderOrder();
    let subOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    let mapping = getFolderSuperMapping();

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);

    // =========================================================================
    // FALL 1: NACH LINKS GEDROPPT -> WIRD ZUM ECHTEN ÜBERORDNER
    // =========================================================================
    if (!targetInfo.makeSubfolder) {
        // Falls er vorher ein Unterordner war: Aus dem Mapping entfernen
        if (mapping[draggedName]) {
            delete mapping[draggedName];
            saveFolderSuperMapping(mapping);
        }

        // Zu den Überordnern hinzufügen (falls noch nicht drin)
        if (!superOrder.includes(draggedName)) {
            const targetIdx = superOrder.indexOf(targetInfo.targetIsSuper ? targetInfo.targetName : targetInfo.targetParentSuper);
            if (targetIdx !== -1) {
                superOrder.splice(targetIdx + 1, 0, draggedName);
            } else {
                superOrder.push(draggedName);
            }
            saveSuperFolderOrder(superOrder);
        }

        bookshelfSuperFolderState[draggedName] = true;
        superFolderStates[draggedName] = true;
    }

    // =========================================================================
    // FALL 2: NACH RECHTS GEDROPPT -> WIRD ZUM UNTERORDNER
    // =========================================================================
    else {
        // Bestimme den übergeordneten Ziel-Überordner
        const destinationSuper = targetInfo.targetIsSuper ? targetInfo.targetName : targetInfo.targetParentSuper;
        if (!destinationSuper || destinationSuper === draggedName) return;

        // Falls er vorher ein Überordner war: Aus der Überordnerliste austragen
        if (superOrder.includes(draggedName) && draggedName !== 'Allgemein') {
            superOrder = superOrder.filter(s => s !== draggedName);
            saveSuperFolderOrder(superOrder);
            delete bookshelfSuperFolderState[draggedName];
            delete superFolderStates[draggedName];
        }

        // Sicherstellen, dass er in der Unterordnerliste eingetragen ist
        if (!subOrder.includes(draggedName)) {
            subOrder.push(draggedName);
            localStorage.setItem('medcheck_folder_order', JSON.stringify(subOrder));
        }

        // Mapping zuweisen
        mapping[draggedName] = destinationSuper;
        saveFolderSuperMapping(mapping);

        // Ziel-Überordner aufklappen, damit man das Ergebnis sofort sieht
        bookshelfSuperFolderState[destinationSuper] = true;
        superFolderStates[destinationSuper] = true;
    }

    // UI aktualisieren
    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
}
// ====================================================
// FALL LADEN & PLAYER LOGIK
// ====================================================
function getCustomCases() {
    try {
        const raw = JSON.parse(localStorage.getItem('custom_cases')) || [];
        return raw.map(c => applyFolderOverridesToCase(c));
    } catch (e) {
        return [];
    }
}

window.getRegisteredCases = function() {
    const demoCopy = applyFolderOverridesToCase(JSON.parse(JSON.stringify(BUILTIN_DEMO_CASE)));
    return [demoCopy, ...getCustomCases().filter(c => c.case_id !== BUILTIN_DEMO_CASE.case_id)];
};

function applySpecialtyFilters(caseData) {
    if (Array.isArray(caseData.timeline)) {
        caseData.timeline = caseData.timeline.slice(0, 3).map((step, idx) => ({
            ...step,
            step_id: idx + 1
        }));
    }

    const tasks = caseData.extra_tasks;
    if (!tasks) return;
    const primary = caseData.metadata?.primary_disease;

    if (Array.isArray(tasks.clinical_cascades) && tasks.clinical_cascades.length) {
        const match = primary ? tasks.clinical_cascades.find(c => c.disease === primary) : null;
        tasks.clinical_cascades = [match || tasks.clinical_cascades[0]];
    }

    if (Array.isArray(tasks.master_quiz) && tasks.master_quiz.length) {
        let pool = tasks.master_quiz.filter(q => q.is_primary === true || (primary && q.target_disease === primary));
        if (!pool.length) pool = [tasks.master_quiz[0]];
        tasks.master_quiz = [pool[Math.floor(Math.random() * pool.length)]];
    }
}
window.applySpecialtyFilters = applySpecialtyFilters;
window.loadCaseById = function(caseId, opts = {}) {
    // NEU: Wenn ein normaler Fall geladen wird (nicht über Notdienst), Notdienst beenden!
    if (!opts.isEmergency && window.EmergencyManager && typeof window.EmergencyManager.exitSession === 'function') {
        window.EmergencyManager.exitSession();
    }
    const specialtyMode = !!opts.specialty || !!window.isSpecialtyBlindMode;
    window.isSpecialtyBlindMode = specialtyMode;

    let targetCase = window.getRegisteredCases().find(c => c.case_id === caseId);

    if (!targetCase) { 
        alert("Fall nicht gefunden!"); 
        return; 
    }

    if (opts.resetForReview) {
        ProgressManager.resetCaseChallengesForReview(caseId);
    }

    activeCaseData = JSON.parse(JSON.stringify(targetCase));
    window.registerCaseDDs(activeCaseData);
    if (specialtyMode) applySpecialtyFilters(activeCaseData);
    const saved = (specialtyMode || opts.resetForReview) ? {} : (ProgressManager.getCaseProgress(caseId) || {});

    window.applyBlindHeader(specialtyMode, activeCaseData);

    if (!Array.isArray(activeCaseData.timeline)) activeCaseData.timeline = [];
    totalStepsCount = activeCaseData.timeline.length;
    clearedStepsCount = saved.audit?.clearedStepsCount || 0;
    selectedSynapses = [];

    const badgeAudit = document.getElementById('badge-mode-audit');
    if (badgeAudit) {
        badgeAudit.innerText = `${clearedStepsCount}/${totalStepsCount}`;
        badgeAudit.style.background = '';
    }

    const tasks = activeCaseData.extra_tasks || {};
    
    // Wichtig: show-Hilfsfunktion definieren!
    const show = (id, on) => { 
        const el = document.getElementById(id); 
        if (el) el.style.display = on ? 'inline-flex' : 'none'; 
    };

    const hasSyn = !!(tasks.synapses_matrix && tasks.synapses_matrix.variables?.length && tasks.synapses_matrix.diseases?.length);
    const hasCas = !!(tasks.clinical_cascades && tasks.clinical_cascades.length);
    const hasCat = !!(tasks.categorization && tasks.categorization.items?.length && tasks.categorization.categories?.length);
    const hasQuiz = !!(tasks.master_quiz && tasks.master_quiz.length);
    const doctordleData = tasks.doctordle;
    const hasDoctordle = !!(doctordleData && (Array.isArray(doctordleData) ? doctordleData.length > 0 : !!doctordleData.hints));

    show('tab-btn-synapses', hasSyn);
    show('tab-btn-cascade', hasCas);
    show('tab-btn-cat', hasCat);
    show('tab-btn-quiz', hasQuiz);
    show('tab-btn-doctordle', hasDoctordle);
    show('tab-btn-flashcards', true);

    totalSynapseDiseases = hasSyn ? tasks.synapses_matrix.diseases.length : 0;
    solvedSynapseDiseases = saved.synapses?.solvedCount || 0;

    totalCascades = hasCas ? tasks.clinical_cascades.length : 0;
    cascadesSolvedCount = saved.cascades?.solvedCount || 0;

    categorizationSolved = !hasCat || !!saved.categorization?.solved;
    quizSolved = !hasQuiz || !!saved.quiz?.solved;
    userQuizAnswers = saved.quiz?.answers || {};

    if (hasDoctordle) {
        totalDoctordlePuzzles = Array.isArray(doctordleData) ? doctordleData.length : 1;
        solvedDoctordlePuzzles = saved.doctordle?.solvedCount || 0;
        doctordleSolved = solvedDoctordlePuzzles >= totalDoctordlePuzzles;
        const doctordleBadge = document.getElementById('badge-mode-doctordle');
        if (doctordleBadge) doctordleBadge.innerText = `${solvedDoctordlePuzzles}/${totalDoctordlePuzzles}`;
    } else {
        doctordleSolved = true;
    }

    const safely = (label, fn) => {
        try { if (typeof fn === 'function') fn(); } 
        catch (err) { console.error(`Fehler bei Modul '${label}':`, err); }
    };

    safely('Übersicht', window.renderOverview);
    safely('Audit', window.renderTimeline);
    if (hasSyn) safely('Synapsen', window.renderSynapsesMatrix);
    if (hasCas) safely('Kaskade', window.renderCascades);
    if (hasCat) safely('Taxonomie', window.renderCategorization);
    if (hasQuiz) safely('Quiz', window.renderQuiz);
    if (hasDoctordle && window.initDoctordle) safely('Doctordle', () => window.initDoctordle(activeCaseData));
    safely('Flashcards', window.renderFlashcards);

    if (specialtyMode && window.doctordleGame) window.doctordleGame.currentCaseId = null;
    
    window.switchTab('player', document.getElementById('nav-player'));
    
    const initialMode = opts.startMode || (specialtyMode ? 'audit' : 'overview');
    window.switchPlayerMode(initialMode);
    
    const mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) mainWrapper.scrollTop = 0;

    if (typeof window.checkFinalCompletion === 'function') {
        window.checkFinalCompletion();
    }
};

window.renderOverview = function() {
    const container = document.getElementById('overview-container');
    if (!container) return;

    const data = activeCaseData?.case_overview;
    if (!data) {
        container.innerHTML = '<div class="feedback-box feedback-neutral" style="display:block;">Für diesen Fall ist keine detaillierte Übersicht verfügbar.</div>';
        return;
    }

    let notesHtml = '';
    if (data.cornell_notes && Array.isArray(data.cornell_notes)) {
        data.cornell_notes.forEach((note, noteIdx) => {
            const cuesArray = Array.isArray(note.cues) ? note.cues : [];
            const rawNotes = note.notes || '';

            const paragraphs = rawNotes.split(/<br\s*\/?>\s*<br\s*\/?>|<\/p>/i)
                .map(p => p.trim())
                .filter(p => p.length > 0);

            cuesArray.forEach((cueText, cueIdx) => {
                let paragraphText = paragraphs[cueIdx] || paragraphs[0] || rawNotes;

                notesHtml += `
                    <div class="cornell-row-item" data-row="${noteIdx}-${cueIdx}">
                        <div class="cornell-cue-col">
                            <div class="cornell-cue-item" data-target="frag-${noteIdx}-${cueIdx}">
                                ${escapeHtml(cueText)}
                            </div>
                        </div>
                        <div class="cornell-note-col">
                            <div class="cornell-fragment" id="frag-${noteIdx}-${cueIdx}">
                                ${paragraphText}
                            </div>
                        </div>
                    </div>
                `;
            });
        });
    }

    const topicTitle = window.isSpecialtyBlindMode ? "Klinisches Krankheitsbild (Blind-Training)" : (data.topic || 'Thematische Übersicht');

    const html = `
        <div class="cornell-wrapper">
            <div class="cornell-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.1rem;">📖</span>
                    <h2 style="margin: 0;">${escapeHtml(topicTitle)}</h2>
                </div>
                ${!window.isSpecialtyBlindMode ? `
                    <button type="button" class="action-btn secondary btn-sm" onclick="window.practiceCurrentCaseAsMindmap()" style="font-size: 0.76rem; padding: 6px 12px; border-color: rgba(56, 189, 248, 0.4); color: var(--accent-blue);">
                        🕸️ Aus dieser Übersicht Mindmap generieren
                    </button>
                ` : ''}
            </div>
            <div class="cornell-container-body">
                ${notesHtml}
            </div>
            <div class="cornell-summary">
                <h4>Take-Home Message (Zusammenfassung)</h4>
                <p>${data.summary || 'Keine Zusammenfassung hinterlegt.'}</p>
            </div>
        </div>
    `;
    container.innerHTML = html;

    container.querySelectorAll('.cornell-cue-item').forEach(cueEl => {
        const targetId = cueEl.getAttribute('data-target');
        const targetFragment = document.getElementById(targetId);

        if (targetFragment) {
            cueEl.addEventListener('mouseenter', () => {
                cueEl.classList.add('cue-active-highlight');
                targetFragment.classList.add('highlight-target');
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(4);
            });

            cueEl.addEventListener('mouseleave', () => {
                cueEl.classList.remove('cue-active-highlight');
                targetFragment.classList.remove('highlight-target');
            });
        }
    });
};

// ====================================================
// AUTO-KONVERTER V2.0: AKTIVER FALL -> LOGISCHE KAUSAL-MINDMAP
// ====================================================
window.practiceCurrentCaseAsMindmap = function() {
    if (!activeCaseData) {
        alert('Bitte öffne zuerst einen klinischen Fall.');
        return;
    }

    const caseId = activeCaseData.case_id || 'custom_case';
    const mindmapId = `mm_case_${caseId}`;
    const title = activeCaseData.metadata?.title || activeCaseData.case_overview?.topic || caseId;
    const specialty = resolveCaseFolderName(activeCaseData);
    const centralConcept = activeCaseData.metadata?.primary_disease || activeCaseData.case_overview?.topic || title.slice(0, 42);

    const nodes = [];
    let nodeCounter = 1;

    // 1. Primärerkrankung aus der Synapsen-Matrix extrahieren (4 klar getrennte Hauptäste 1. Ordnung)
    const synVars = activeCaseData.extra_tasks?.synapses_matrix?.variables || [];
    const primaryDisease = activeCaseData.metadata?.primary_disease;
    const primaryVars = synVars.filter(v => !primaryDisease || v.disease === primaryDisease);

    const typeMap = {
        'Risikofaktor/Pathophysiologie': { cat: 'pathophysiology', rel: 'Pathomechanismus / Risiko' },
        'Symptom': { cat: 'clinical', rel: 'Klinisches Leitsymptom' },
        'Diagnostik': { cat: 'diagnostics', rel: 'Diagnostischer Nachweis' },
        'Therapie': { cat: 'therapy', rel: 'Therapeutische Säule' }
    };

    const parentByCategory = {};

    primaryVars.slice(0, 4).forEach(v => {
        const cfg = typeMap[v.type] || { cat: 'clinical', rel: 'Klinischer Aspekt' };
        const nId = `n${nodeCounter++}`;
        parentByCategory[cfg.cat] = nId;

        nodes.push({
            id: nId,
            label: String(v.term || '').slice(0, 48),
            category: cfg.cat,
            parent_id: 'root',
            relation_label: cfg.rel,
            socratic_hint: `Welches Kernkonzept aus dem Bereich „${v.type}“ charakterisiert ${centralConcept}?`,
            explanation: `Bestandteil der klinischen Synapsen-Matrix für ${centralConcept} (${v.type}).`
        });
    });

    // 2. Kausale Paare aus Clinical Cascades (1. Ordnung -> 2. Ordnung) extrahieren
    const firstCascadeObj = activeCaseData.extra_tasks?.clinical_cascades?.[0];
    const cascadeSteps = firstCascadeObj?.cascade || [];

    if (cascadeSteps.length >= 6) {
        // Paar A: Auslöser (01) -> Pathophysiologie (02)
        const trigId = `n${nodeCounter++}`;
        nodes.push({
            id: trigId,
            label: String(cascadeSteps[0].content || '').slice(0, 48),
            category: 'etiology',
            parent_id: 'root',
            relation_label: 'Primärer Auslöser',
            socratic_hint: 'Welcher initiale Faktor steht ganz am Beginn der pathophysiologischen Kaskade?',
            explanation: `Stufe 1 (Auslöser) der Kaskade zu ${firstCascadeObj.disease || centralConcept}.`
        });

        nodes.push({
            id: `n${nodeCounter++}`,
            label: String(cascadeSteps[1].content || '').slice(0, 48),
            category: 'pathophysiology',
            parent_id: trigId,
            relation_label: 'löst unmittelbar aus',
            socratic_hint: `Welcher direkte pathophysiologische Prozess wird durch „${String(cascadeSteps[0].content || '').slice(0, 35)}“ in Gang gesetzt?`,
            explanation: `Stufe 2 (Pathophysiologie) als direkte Folge des Auslösers.`
        });

        // Paar B: Klinische Manifestation (05) -> Diagnostischer Befund (06)
        if (cascadeSteps[4] && cascadeSteps[5]) {
            const clinParentId = parentByCategory.clinical || `n${nodeCounter++}`;
            if (!parentByCategory.clinical) {
                nodes.push({
                    id: clinParentId,
                    label: String(cascadeSteps[4].content || '').slice(0, 48),
                    category: 'clinical',
                    parent_id: 'root',
                    relation_label: 'Klinische Manifestation',
                    socratic_hint: 'Wie manifestiert sich die anatomische Schädigung klinisch beim Patienten?',
                    explanation: 'Klinische Manifestation innerhalb der Krankheitskaskade.'
                });
            }
            nodes.push({
                id: `n${nodeCounter++}`,
                label: String(cascadeSteps[5].content || '').slice(0, 48),
                category: 'diagnostics',
                parent_id: clinParentId,
                relation_label: 'weist man nach durch',
                socratic_hint: 'Welcher spezifische diagnostische Befund objektiviert diese klinische Symptomatik?',
                explanation: 'Diagnostischer Korrelatbefund in der klinischen Kaskade.'
            });
        }
    }

    // 3. Falls noch Knoten fehlen: Aus Cornell-Notes logische Cue-Paare mit echtem Erklärungstext bilden
    const cornellNotes = activeCaseData.case_overview?.cornell_notes || [];
    const catCycle = ['pathophysiology', 'diagnostics', 'therapy', 'clinical', 'etiology'];

    cornellNotes.forEach((row, rIdx) => {
        if (nodes.length >= 10) return;
        const cues = Array.isArray(row.cues) ? row.cues : [];
        const cleanNotes = String(row.notes || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cues.length === 0) return;

        const mainCue = String(cues[0] || '').trim();
        if (!mainCue || nodes.some(n => n.label.toLowerCase() === mainCue.toLowerCase())) return;

        const cat = catCycle[rIdx % catCycle.length];
        const pId = `n${nodeCounter++}`;
        nodes.push({
            id: pId,
            label: mainCue.slice(0, 48),
            category: cat,
            parent_id: 'root',
            relation_label: `Schwerpunkt ${rIdx + 1}`,
            socratic_hint: `Welcher Leitbegriff steht im Zentrum dieses Abschnitts: „${cleanNotes.slice(0, 95)}…“?`,
            explanation: cleanNotes.slice(0, 220)
        });

        if (cues.length >= 2 && nodes.length < 10) {
            const subCue = String(cues[1] || '').trim();
            if (subCue && !nodes.some(n => n.label.toLowerCase() === subCue.toLowerCase())) {
                nodes.push({
                    id: `n${nodeCounter++}`,
                    label: subCue.slice(0, 48),
                    category: cat,
                    parent_id: pId,
                    relation_label: 'spezifisches Detail',
                    socratic_hint: `Welches spezifische Detail oder Kriterium gehört im Kontext von „${mainCue}“ unmittelbar dazu?`,
                    explanation: cleanNotes.slice(0, 220)
                });
            }
        }
    });

    const generatedMindmap = {
        id: mindmapId,
        title: `Fall-Mindmap: ${title}`,
        specialty: specialty,
        central_concept: centralConcept,
        nodes: nodes
    };

    try {
        const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
        const filtered = localSaved.filter(m => m.id !== mindmapId);
        filtered.unshift(generatedMindmap);
        localStorage.setItem('medcheck_custom_mindmaps', JSON.stringify(filtered));
    } catch (e) {
        console.warn('Konnte generierte Fall-Mindmap nicht zwischenspeichern:', e);
    }

    window.switchTab('mindmap', document.getElementById('nav-mindmap'));

    if (window.MindmapModule) {
        if (typeof window.MindmapModule.init === 'function') {
            window.MindmapModule.init().then(() => {
                window.MindmapModule.selectMindmap(mindmapId);
            });
        } else if (typeof window.MindmapModule.selectMindmap === 'function') {
            window.MindmapModule.selectMindmap(mindmapId);
        }
    }
};
// ====================================================
// FORGE / GEMINI API
// ====================================================
function showForgeFeedback(type, message) {
    const fb = document.getElementById('forge-fb');
    if (!fb) return;
    fb.style.display = 'block';
    fb.className = `feedback-box ${type}`;
    fb.innerHTML = message;
}

function sanitizeForgeJsonInput(rawValue) {
    return rawValue
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .trim();
}

window.generateCaseWithGemini = async function() {
    const promptInput = document.getElementById('forge-topic');
    const outputInput = document.getElementById('forge-input');
    const generateBtn = document.getElementById('forge-generate-btn');

    if (!promptInput || !outputInput || !generateBtn) return;

    const prompt = promptInput.value.trim();

    if (!prompt) {
        showForgeFeedback('feedback-error', 'Bitte gib zuerst ein Thema oder einen Prompt ein.');
        return;
    }

    if (prompt.length > 50000) {
        showForgeFeedback('feedback-error', 'Prompt zu lang. Bitte auf maximal 50000 Zeichen kürzen.');
        return;
    }

    const originalBtnText = generateBtn.innerHTML;
    generateBtn.disabled = true;
    generateBtn.innerText = 'Generiere...';
    showForgeFeedback('feedback-neutral', 'Gemini wird kontaktiert. Bitte warten...');

    try {
        const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const responseText = await res.text();
        let data = null;
        try {
            data = JSON.parse(responseText);
        } catch (_error) {
            data = null;
        }

        if (!res.ok || !data) {
            const serverMessage = data?.error || responseText.trim().slice(0, 200);
            throw new Error(
                `Serverfehler (HTTP ${res.status})${serverMessage ? ': ' + serverMessage : ''}. Die Anfrage hat evtl. das Zeitlimit überschritten.`
            );
        }

        const rawResult = typeof data.generatedText === 'string' ? data.generatedText : '';
        const sanitized = sanitizeForgeJsonInput(rawResult);

        try {
            const parsed = JSON.parse(sanitized);
            outputInput.value = JSON.stringify(parsed, null, 2);
        } catch (_error) {
            outputInput.value = sanitized;
        }

        showForgeFeedback('feedback-success', 'Fall generiert. Bitte prüfen, ggf. anpassen und validieren/speichern.');
    } catch (error) {
        showForgeFeedback('feedback-error', `Generierungsfehler: ${error.message}`);
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalBtnText;
    }
};

// ====================================================
// FORGE / GEMINI API & MASTERPROMPT EXPORT
// ====================================================

const MEDCHECK_MASTER_PROMPT = `# ROLLE & ZIELGRUPPE

Facharzt, IMPP/NBME-Prüfungsbeauftragter & Software-Architect für MedCheck. Generiere aus dem Fachtext/Skript genau EINEN maximal vollständigen Fall als syntaktisch valides JSON.

  - Zielgruppe: Medizinstudierende vor dem Staatsexamen (2. Masterjahr).
  - Fokus: Differenzialdiagnosen, Pathophysiologie-Kausalketten, Goldstandards, Leitlinien, Fallstricke (Cognitive Biases, Behandlungsfehler).
  - Sprache: Höchste Fachterminologie, anatomische Leitstrukturen, exakte Laborparameter (mit Einheiten/Grenzwerten), Bildgebung, Medikamente inkl. Wirkmechanismen.

# 1. KRITISCHE TECHNISCHE REGELN (ZERO-TOLERANCE)

1. ZWINGENDE CASE_ID ZUERST: "case_id": "STRING_IDENTIFIER" MUSS die allererste Eigenschaft im JSON sein. Darf niemals fehlen oder leer sein.
2. REINES ROHTEXT-JSON (TRUNCATION-SCHUTZ): Antworte AUSSCHLIESSLICH mit dem JSON-Objekt (Erstes Zeichen {, letztes Zeichen }). KEIN einleitender/erklärender Text, KEINE Markdown-Codeblöcke, KEINE Kommentare. Muss direkt durch JSON.parse() lesbar und vollständig geschlossen sein.
3. STRIKTES ZITATIONSVERBOT & VERBOT VON SPAN- UND ZITAT-TAGS: Absolut verboten sind Zitationsmarker, Quellenverweise, Span-Markierungen oder Tags jeder Art wie,, [1], (Quelle: ...), [span_...], (start_span), (end_span) oder <span>...</span>. Der Text muss ausnahmslos sauberer, reiner Fließtext ohne jegliche Zitations- oder Span-Fragmente sein!
4. STRING-ESCAPING: Unescapte doppelte Anführungszeichen in Strings sind VERBOTEN (nutze '...' oder \\"). Zeilenumbrüche in Strings zwingend als \\n\\n escapen (keine echten Returns). Keine unmaskierten LaTeX-Backslashes (nutze Unicode wie ≥, ≤, ±, →).
5. HTML-GÜLTIGKEITSBEREICH: HTML-Tags (<p>, <b>, <ul>, <li>) sind AUSSCHLIESSLICH in case_overview.cornell_notes[].notes erlaubt. Alle anderen Felder (cues, summary, content, hotspots, hints, cascades, explanation, flashcards etc.) sind ausnahmslos reiner Plain-Text! Im Feld cues sind absolut KEINE HTML-Tags gestattet; cues sind reiner Plain-Text (z. B. "Epidemiologie", NIEMALS "<b>Epidemiologie</b>").
6. SYSTEMANKER (metadata.primary_disease): Exakte Zielerkrankung des Falls als primärer Filter-Anker.

# 2. SEKTIONSSPEZIFISCHE ANFORDERUNGEN

## A. CASE_OVERVIEW
  - cornell_notes:
      - Lückenlose Abdeckung: MUSS ALLE Themenblöcke, Entitäten, Anatomie-Details, Physiologie, Leitsymptome, Diagnostik- und Therapieschemata des Quelltextes komplett abdecken.
      - 1:1 Höhen-Synchronisation & Reiner Plain-Text in cues: cues (Array von reinen Plain-Text-Strings OHNE HTML-Tags wie <b>) müssen vertikal exakt 1:1 mit den Absätzen/Bullets in notes korrespondieren (Cue 1 = Absatz/Bullet 1, Cue 2 = Absatz/Bullet 2).
      - ZWINGENDE INTENSIVE FETTMARKIERUNG IN notes: In notes MÜSSEN alle klinischen Schlüsselbegriffe, Grenzwerte, Leitstrukturen, Goldstandards, Erreger, Medikamente, Dosierungen, Warnzeichen ('Cave') und Leitsymptome konsequent, lückenlos und extrem dicht mit <b>...</b> hervorgehoben werden! Unformatierte Fließtextpassagen ohne <b>...</b> sind in notes streng verboten. Nutze <p>, <b> und <ul><li>.
  - summary (Take-Home-Message):
      - Reiner Plain-Text (2–4 prägnante Sätze, eigene Worte, keine Zitate).
      - Implizites 3-Schritte-Schema (ohne Labels wie "Das Was"): 1. Kern/Definition, 2. Pathophysiologischer Mechanismus/Warum, 3. Klinische Konsequenz/Nutzen.

## B. AUDIT & TIMELINE (timeline – 9 Schritte)
- STRUKTUR: 9 Schritte in 3 Patientenszenarien (patient_1, patient_2, patient_3 à 3 Schritte, je 70-160 Wörter).
- LINGUISTIK-REGEL (KEINE ABSOLUTISMEN): Verwende NIEMALS absolute Signalwörter wie "immer", "nie", "ausschließlich", "stets" oder "beweist". Klinische Fallbeschreibungen müssen nuanciert und realistisch bleiben, um "Test-Wiseness" (das einfache Erraten von Fehlern) zu verhindern.
- HOTSPOTS ("phrase"): Muss ein exakter Substring aus "content" sein (ca. 4-15 Wörter). ZWINGEND: Wähle ausschließlich logische, klinische Sinneinheiten, die zusammengehören (z. B. "sofortige Gabe von 500 mg Ceftriaxon i.v." oder "Verzicht auf die nativradiologische Bildgebung" – niemals nur isolierte Wörter wie "Ceftriaxon").
- FEHLER-DESIGN ("is_error": true): In 6-7 Schritten existiert genau EIN subtiler klinischer Fehler im Text, der exakt vom Hotspot abgedeckt wird. Dieser Fehler muss knifflig sein, tiefes pathophysiologisches oder pharmakologisches Wissen erfordern (z. B. übersehene relative Kontraindikationen, falsche Dosierung bei Niereninsuffizienz, subtile Leitlinien-Abweichung). Keine offensichtlichen Anfängerfehler!
- DISTRAKTOREN ("is_error": false): In den restlichen 2-3 Schritten ist der im Hotspot markierte Text klinisch KORREKT, fungiert aber als starker Distraktor. Er muss wie ein typischer Behandlungsfehler oder eine Falle wirken (z. B. eine paradoxe, aber bei genauem Nachdenken leitliniengerechte Maßnahme), um das Selbstvertrauen und die klinische Synthesefähigkeit auf höchstem Niveau zu testen.
- FEEDBACK & TRAPS: 
  -> Bei "is_error": true: Generiere einen "socratic_trap" (einen sokratischen Impuls, der den Studierenden durch gezielte Fragen selbst auf den Denkfehler bringt, statt nur die Lösung zu verraten) sowie die "correct_pathophysiology". 
  -> Bei "is_error": false: Generiere ein präzises "feedback" mit pathophysiologischer Begründung, warum diese auf den ersten Blick fragwürdige Maßnahme korrekt ist.
  
## C. FLASHCARDS (extra_tasks.flashcards – 8 bis 12 Karten)
  - Konzept: Reines deklaratives Faktenwissen (Bloom-Stufe 1: Grenzwerte, Triaden, Goldstandards, Erstlinienmedikamente, Genetik/Antikörper). Minimum Information Principle: Exakt EIN atomarer Fakt pro Karte (keine Fallgeschichten!).
  - Felder: "id" ("fc_01"...), "category", "difficulty" ("basic", "intermediate", "advanced"), "front" (eindeutige Kurzfrage), "back" (max. 1–2 Sätze oder 3–5 Bullets, < 2 Sek. Lesezeit), "mnemonic_or_context" (Merksatz/Pearl, max. 140 Zeichen).

## D. DOCTORDLE & LIBRARY (extra_tasks.doctordle & library_entries)
  - doctordle: Genau 3 Objekte (puzzle_id: 1, 2, 3). "title" lautet exakt "Fall 1", "Fall 2", "Fall 3" (keine Zusätze).
  - Felder: puzzle_id, title, target_diagnosis, synonyms (3–6 Strings), learning_pearl (1–2 Sätze), hints (genau 6 progressive Strings ohne Früh-Spoiler: 1: Demografie/Leitsymptom, 2: Untersuchungsbefund, 3: Basislabor/Vitalwerte, 4: Weichenstellung/Funktionstest, 5: Spezifische Bildgebung/Morphologie, 6: Pathognomonischer Goldstandard).
  - library_entries: Array aus 15–20 Strings (alle 3 target_diagnoses + synonyms + 8–12 Differenzialdiagnosen).

## E. TAXONOMIE (extra_tasks.categorization)
  - Konzept: Zuordnung von 8–12 anspruchsvollen Befunden/Manövern (items: { "term": "...", "category": "..." }) zu 3–4 spezifischen Krankheitsentitäten/Syndromen (categories).
  - Verbot generischer Bins: Kategorien wie "Diagnostik", "Symptom", "Therapie" sind VERBOTEN. Hinweisfeld heißt rein "hint".
  - SHUFFLE-PFLICHT: items MUSS komplett willkürlich durchmischt sein (keine A-A-B-B-Blöcke, keine A-B-C-D-Zyklen).

## F. CLINICAL CASCADES (extra_tasks.clinical_cascades)
  - Genau 3 Erkrankungen à 8 Stufen (01_Auslöser bis 08_Outcome). Hinweisfeld heißt rein "hint".
  - Pflicht: Index 0 MUSS exakt metadata.primary_disease behandeln ("disease" identisch mit primary_disease). Index 1 & 2 behandeln Differenzialdiagnosen.

## G. SYNAPSES MATRIX (extra_tasks.synapses_matrix – 4x4 Board)
  - Konzept: 4 Krankheiten (diseases, Index 0 = primary_disease) × 4 feste Dimensionen ("Risikofaktor/Pathophysiologie", "Diagnostik", "Therapie", "Symptom") = 16 Kacheln. Jede Krankheit steuert exakt 1 Begriff pro Dimension bei.
  - Kachel-Ergonomie: Jeder Begriff (term / items) max. 1–4 Wörter (ideal < 28 Zeichen, keine Sätze). Hohe Trennschärfe mit Red Herrings, aber eindeutiger 4x4-Lösung.
  - Felder: "description", "hint", "diseases" (4 Strings), "groups" (4 Objekte mit "title", "level" 0–3, "items" [4 Strings], "explanation" [1–2 Sätze]), "variables" (16 Objekte { "term": "...", "type": "...", "disease": "..." }).
  - SHUFFLE-PFLICHT: variables MUSS komplett pseudozufällig durchmischt sein (keine Gruppenblöcke oder zyklischen Muster).

## H. MASTER QUIZ (extra_tasks.master_quiz – Mind. 5 MC-Fragen, Typ A)
1. Tagging: Mind. Frage 1 & 2 (Index 0, 1) behandeln primary_disease ("is_primary": true, "target_disease" = primary_disease). Restliche Fragen behandeln Differenzialdiagnosen ("is_primary": false).
2. Anspruch (Bloom 3–5): Fallvignetten mit zweistufigem Denkschritt (Befundsynthese -> Diagnose -> Therapie/Mechanismus) und klinischen Zielkonflikten. Kein First-Order Recall! Distraktoren auf Facharztniveau (Cognitive Biases, Kontraindikationen).
3. Anti-Bias-Protokoll (STRIKT):
      - Längenparität: Alle 5 Optionen (options) innerhalb 10–15 % Zeichenvarianz.
      - Homogenität: Gleicher grammatikalischer Typus, keine Begründungssätze ("weil...", "um zu..."), keine absoluten Signalwörter ("immer", "nie"), keine Meta-Optionen ("Alle genannten"). Option-Reihenfolge willkürlich permutieren.
      - Schlüsselverteilung (correct_index 0–4): Bei 5 Fragen MUSS jeder Index (0, 1, 2, 3, 4) genau einmal vorkommen (z. B. 2, 4, 0, 3, 1). KEIN Bias zu 0/1 (A/B)! Aufeinanderfolgende Fragen dürfen NIEMALS denselben correct_index haben.
4. Feedback (explanation & hint):
      - "hint": Sokratischer Impuls ohne Spoiler (Feld heißt rein "hint").
      - "explanation": 1. Expliziter Zeichenvergleich aller 5 Optionen inkl. Varianz-Prozentangabe, 2. Mechanistische Begründung der richtigen Option (Rezeptoren, Ionenkanäle, Enzymwege), 3. Dezidierte klinische Entkräftung JEDES einzelnen Distraktors.

# 3. JSON-SCHEMA (TEMPLATE)
{
  "case_id": "STRING_IDENTIFIER",
  "metadata": {
    "title": "STRING",
    "primary_disease": "STRING",
    "medical_field": "STRING",
    "bloom_level": "Evaluation & Synthese",
    "difficulty": 5,
    "xp_reward": 1200
  },
  "case_overview": {
    "topic": "STRING",
    "cornell_notes": [
      {
        "cues": ["Fachbegriff 1 (Plain-Text)", "Fachbegriff 2 (Plain-Text)"],
        "notes": "<p>Erklärung mit <b>zwingend intensiver Fettmarkierung</b> aller <b>Schlüsselbegriffe</b> und <b>Grenzwerte</b>.</p><ul><li><b>Aspekt 1:</b> Details mit <b>fett markierten Fakten</b> (synchron zu Cue 1).</li><li><b>Aspekt 2:</b> Details mit <b>fett markierten Medikamenten</b> (synchron zu Cue 2).</li></ul>"
      }
    ],
    "summary": "Plain-Text Synthese (2-4 Sätze: Kern, Mechanismus, Konsequenz)."
  },
  "timeline": [
    {
      "step_id": 1,
      "patient_id": "patient_1",
      "phase": "Patient 1: Phase",
      "content": "Patient 1\\\\n\\\\nRealistischer Plain-Text Bericht ohne HTML (70-160 Wörter)...",
      "hotspots": [
        {
          "phrase": "exakter Substring drei bis acht Wörter",
          "is_error": false,
          "feedback": "Pathophysiologische Begründung der Richtigkeit."
        },
        {
          "phrase": "subtil fehlerhafter klinischer Handlungsschritt",
          "is_error": true,
          "socratic_trap": "Lenkende sokratische Frage ohne Lösungsspoiler?",
          "correct_pathophysiology": "Fundierte pathophysiologische Korrektur."
        }
      ]
    }
  ],
  "extra_tasks": {
    "flashcards": [
      {
        "id": "fc_01",
        "category": "Kategorie",
        "difficulty": "basic",
        "front": "Direkte atomare Faktenfrage?",
        "back": "Knappe Antwort (< 2 Sek. Lesezeit).",
        "mnemonic_or_context": "Kurze Eselsbrücke (max. 140 Zeichen)."
      }
    ],
    "doctordle": [
      {
        "puzzle_id": 1,
        "title": "Fall 1",
        "target_diagnosis": "Erkrankung A",
        "synonyms": ["Synonym 1", "Synonym 2", "Synonym 3"],
        "hints": ["Hinweis 1: ...", "Hinweis 2: ...", "Hinweis 3: ...", "Hinweis 4: ...", "Hinweis 5: ...", "Hinweis 6: ..."],
        "learning_pearl": "Kernaussage."
      }
    ],
    "library_entries": ["Erkrankung A", "Synonym 1", "Differenzialdiagnose 1"],
    "clinical_cascades": [
      {
        "disease": "Exakter Name der primary_disease",
        "hint": "Hinweis",
        "cascade": [
          { "stage": "01_Auslöser", "content": "..." },
          { "stage": "02_Pathophysiologie", "content": "..." },
          { "stage": "03_Zellulärer Mechanismus", "content": "..." },
          { "stage": "04_Anatomische Konsequenz", "content": "..." },
          { "stage": "05_Klinische Manifestation", "content": "..." },
          { "stage": "06_Diagnostischer Befund", "content": "..." },
          { "stage": "07_Therapeutische Intervention", "content": "..." },
          { "stage": "08_Outcome", "content": "..." }
        ]
      }
    ],
    "synapses_matrix": {
      "description": "Finde 4 Gruppen aus jeweils 4 klinisch zusammengehörigen Begriffen.",
      "hint": "Verbinde Risikofaktor/Pathophysiologie, Symptom, Diagnostik und Therapie der 4 Krankheitsbilder.",
      "diseases": ["Erkrankung A", "Erkrankung B", "Erkrankung C", "Erkrankung D"],
      "groups": [
        {
          "title": "Erkrankung A",
          "level": 0,
          "items": ["Term A1", "Term A2", "Term A3", "Term A4"],
          "explanation": "Klinische Zusammenfassung."
        }
      ],
      "variables": [
        { "term": "Term C1", "type": "Diagnostik", "disease": "Erkrankung C" },
        { "term": "Term A2", "type": "Risikofaktor/Pathophysiologie", "disease": "Erkrankung A" }
      ]
    },
    "categorization": {
      "description": "Ordne die klinischen Befunde, Manöver und Phänomene den entsprechenden Krankheitsbildern zu.",
      "hint": "Differenziere die pathognomonischen Befunde der einzelnen Entitäten.",
      "categories": ["Erkrankung A", "Erkrankung B", "Erkrankung C", "Erkrankung D"],
      "items": [
        { "term": "Befund 1", "category": "Erkrankung C" },
        { "term": "Befund 2", "category": "Erkrankung A" }
      ]
    },
    "master_quiz": [
      {
        "target_disease": "Exakter Name der primary_disease",
        "is_primary": true,
        "question": "Fallvignette mit zweistufiger Leitfrage...",
        "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
        "correct_index": 2,
        "explanation": "Zeichenvergleich:\\\\n- Option A: 48 Z.\\\\n- Option B: 49 Z.\\\\n- Option C: 47 Z.\\\\n- Option D: 46 Z.\\\\n- Option E: 48 Z.\\\\n(Maximale Varianz: 6.2 %)\\\\n\\\\nFundierte Rationale für Option C: [...Reference...Mechanismus...]\\\\n\\\\nKlinische Analyse der Distraktoren:\\\\n- Option A: [...]\\\\n- Option B: [...]\\\\n- Option D: [...]\\\\n- Option E: [...]",
        "hint": "Hinweis ohne Spoiler."
      }
    ]
  }
}`;
/**
 * Kopiert den didaktischen Masterprompt in die Zwischenablage (Clipboard API + Fallback)
 */
window.copyMasterPromptToClipboard = async function(btnElement) {
    if (typeof window.triggerHaptic === 'function') {
        window.triggerHaptic(12);
    }

    let success = false;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(MEDCHECK_MASTER_PROMPT);
            success = true;
        } catch (_err) {
            success = false;
        }
    }

    if (!success) {
        try {
            const tempArea = document.createElement('textarea');
            tempArea.value = MEDCHECK_MASTER_PROMPT;
            tempArea.style.position = 'fixed';
            tempArea.style.top = '-9999px';
            tempArea.style.left = '-9999px';
            tempArea.setAttribute('readonly', '');
            document.body.appendChild(tempArea);
            tempArea.select();
            success = document.execCommand('copy');
            document.body.removeChild(tempArea);
        } catch (e) {
            console.error('Kopieren fehlgeschlagen:', e);
            success = false;
        }
    }

    if (btnElement) {
        const originalHtml = btnElement.innerHTML;
        if (success) {
            btnElement.innerHTML = '✓ Masterprompt kopiert!';
            btnElement.style.background = 'rgba(16, 185, 129, 0.25)';
            btnElement.style.borderColor = 'var(--color-symptom, #10b981)';
            btnElement.style.color = '#86efac';

            if (typeof showForgeFeedback === 'function') {
                showForgeFeedback('feedback-success', '<strong>In Zwischenablage kopiert!</strong> Füge den Prompt einfach in deine externe KI (z. B. Gemini, ChatGPT oder Claude) ein und hänge dein Vorlesungsskript an.');
            }
        } else {
            btnElement.innerHTML = '✕ Fehler beim Kopieren';
            btnElement.style.borderColor = 'var(--color-risk, #ef4444)';
            btnElement.style.color = '#fca5a5';
        }

        setTimeout(() => {
            btnElement.innerHTML = originalHtml;
            btnElement.style.background = '';
            btnElement.style.borderColor = '';
            btnElement.style.color = '';
        }, 2200);
    }
};

// ====================================================
// INTELLIGENTER FALL-KLASSIFIZIERER (AUTO-ROUTING)
// ====================================================
function resolveCaseFolderName(caseData) {
    if (!caseData) return 'Allgemein';

    const explicitFolder = (caseData.folder_name || '').trim();
    if (explicitFolder && explicitFolder.toLowerCase() !== 'allgemein') {
        return explicitFolder;
    }

    const rawField = (caseData.metadata?.medical_field || caseData.medical_field || '').trim();
    if (rawField) {
        if (rawField.includes('_')) {
            const parts = rawField.split('_');
            const cleanTitle = parts.slice(1).join('_').trim();
            if (cleanTitle.length > 2) return cleanTitle;
        }
        return rawField;
    }

    const topic = (caseData.case_overview?.topic || '').trim();
    if (topic && topic.length > 2) {
        return topic;
    }

    return 'Allgemein';
}

function autoAssignSuperFolder(folderName) {
    if (!folderName) return 'Allgemein';
    const clean = folderName.trim();

    const mapping = getFolderSuperMapping();
    const availableSupers = getSuperFolderOrder();
    if (mapping[clean] && availableSupers.includes(mapping[clean])) {
        return mapping[clean];
    }

    return getSuperFolderForCategoryHeuristic(clean);
}

function registerDynamicFolder(folderName, targetSuperFolder = null) {
    if (!folderName || folderName.toLowerCase() === 'allgemein') return;

    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    if (!order.includes(folderName)) {
        order.push(folderName);
        localStorage.setItem('medcheck_folder_order', JSON.stringify(order));
    }

    const superTarget = targetSuperFolder || autoAssignSuperFolder(folderName);
    const mapping = getFolderSuperMapping();
    if (!mapping[folderName]) {
        mapping[folderName] = superTarget;
        saveFolderSuperMapping(mapping);
    }
}

window.validateAndSaveCustomCase = function() {
    const inputEl = document.getElementById('forge-input');
    if (!inputEl) return;
    const rawVal = inputEl.value.trim();

    if (!rawVal) {
        showForgeFeedback('feedback-error', 'Bitte füge zuerst einen JSON-Fall ein.');
        return;
    }

    try {
        const sanitized = sanitizeForgeJsonInput(rawVal);
        const parsed = JSON.parse(sanitized);

        if (Array.isArray(parsed)) {
            throw new Error('Bitte füge einen einzelnen Fall ein, kein JSON-Array.');
        }
        if (!parsed.case_id || typeof parsed.case_id !== 'string') {
            throw new Error('Das Pflichtfeld "case_id" fehlt.');
        }

        parsed.case_id = parsed.case_id.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

        if (!parsed.case_id) {
            throw new Error('Die case_id ist ungültig.');
        }
        if (!Array.isArray(parsed.timeline)) {
            throw new Error('Das Pflichtfeld "timeline" muss ein Array sein.');
        }

        parsed.folder_name = document.getElementById('case-folder-input')?.value.trim() 
                             || resolveCaseFolderName(parsed);

        registerDynamicFolder(parsed.folder_name);

        let customCases = [];
        try {
            customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
            if (!Array.isArray(customCases)) { customCases = []; }
        } catch (storageError) {
            customCases = [];
        }

        customCases = customCases.filter(c => c.case_id !== parsed.case_id);
        customCases.push(parsed);
        localStorage.setItem('custom_cases', JSON.stringify(customCases));

        try {
            if (window.MedicalDictionary && typeof window.MedicalDictionary.registerCase === 'function') {
                window.MedicalDictionary.registerCase(parsed);
            }
        } catch (_dictErr) {}

        showForgeFeedback('feedback-success', `<strong>Korrekt!</strong> Fall "${parsed.case_id}" lokal gespeichert.`);
        renderDashboardCases();

        if (window.Cloud && window.Cloud.isLoggedIn()) {
            window.Cloud.saveCloudCase(parsed)
                .then(() => showForgeFeedback('feedback-success', `<strong>Korrekt!</strong> Fall "${parsed.case_id}" lokal und online gespeichert.`))
                .catch(cloudErr => showForgeFeedback('feedback-error', `Fall lokal gespeichert, aber Online-Speicherung fehlgeschlagen: ${cloudErr.message}`));
        }

    } catch (err) {
        showForgeFeedback('feedback-error', `Validierungsfehler: ${err.message}`);
    }
};

// ====================================================
// ABSCHLUSS & RESETS
// ====================================================
window.onDoctordlePuzzleSolved = function(solvedCount, totalCount) {
    solvedDoctordlePuzzles = solvedCount;
    totalDoctordlePuzzles = totalCount;
    const badge = document.getElementById('badge-mode-doctordle');
    if (badge) {
        if (solvedCount >= totalCount && totalCount > 0) {
            badge.innerText = 'Gelöst';
            badge.style.background = 'var(--color-symptom, #10b981)';
        } else {
            badge.innerText = `${solvedCount}/${totalCount}`;
            badge.style.background = '';
        }
    }

    if (solvedCount >= totalCount) {
        doctordleSolved = true;
    }

    if (activeCaseData) {
        ProgressManager.saveCaseState(activeCaseData.case_id, {
            doctordle: {
                solvedCount: solvedCount,
                totalCount: totalCount,
                solved: solvedCount >= totalCount
            }
        });
    }

    window.checkFinalCompletion();
};

window.checkFinalCompletion = function() {
    const stepsDone = (clearedStepsCount === totalStepsCount);
    const synDone = (solvedSynapseDiseases === totalSynapseDiseases);
    const casDone = (cascadesSolvedCount === totalCascades);
    const docDone = doctordleSolved;
    const fcDone = window.flashcardsSolved !== undefined ? window.flashcardsSolved : true;

    const allCompleted = stepsDone && synDone && casDone && categorizationSolved && quizSolved && docDone && fcDone;

    const finishBtn = document.getElementById('finish-case-btn');
    if (finishBtn) {
        finishBtn.style.display = allCompleted ? 'block' : 'none';
        if (window.isSpecialtyBlindMode) {
            finishBtn.innerText = '🎉 Krankheitsbild aufdecken & abschließen';
        } else {
            finishBtn.innerText = 'Fall abschließen & XP sichern';
        }
    }
    if (window.onSpecialtyCompletionChange) window.onSpecialtyCompletionChange(allCompleted);
};

window.finishCase = function() {
    let solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    if (activeCaseData && !solved.includes(activeCaseData.case_id)) {
        solved.push(activeCaseData.case_id);
        localStorage.setItem('solved_cases', JSON.stringify(solved));
        if (window.Cloud) window.Cloud.scheduleProgressSync();
        applyXpDelta(activeCaseData.metadata?.xp_reward || 900, 'Fall abgeschlossen');
    } else {
        applyXpDelta(50, 'Review Bonus');
    }

    // SR-Engine benachrichtigen, dass der Fall erfolgreich wiederholt wurde
    if (activeCaseData && window.SpacedRepetitionEngine) {
        window.SpacedRepetitionEngine.recordCaseReview(activeCaseData.case_id, 'good');
    }

    if (window.isSpecialtyBlindMode) {
        const title = activeCaseData?.metadata?.title || activeCaseData?.case_id || 'Krankheitsbild';
        alert(`🎉 Gratulation! Das Krankheitsbild "${title}" wurde erfolgreich gemeistert.`);
        window.nextSpecialtyCase();
        return;
    } else {
        alert('🎉 Gratulation! Alle Challenges gemeistert.');
    }

    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length > 0) window.switchTab('dashboard', navItems[0]);
};
window.resetCurrentChallenge = function() {
    if (!activeCaseData || currentActiveChallenge === 'overview') return;

    const confirmReset = window.confirm(`Möchtest du die Challenge "${currentActiveChallenge.toUpperCase()}" wirklich zurücksetzen?`);
    if (!confirmReset) return;

    const caseId = activeCaseData.case_id;

    switch (currentActiveChallenge) {
        case 'audit':
            ProgressManager.resetChallenge(caseId, 'audit');
            clearedStepsCount = 0;
            const badgeAudit = document.getElementById('badge-mode-audit');
            if (badgeAudit) badgeAudit.innerText = `0/${totalStepsCount}`;
            if (window.renderTimeline) window.renderTimeline();
            break;

        case 'quiz':
            ProgressManager.resetChallenge(caseId, 'quiz');
            quizSolved = false;
            userQuizAnswers = {};
            if (window.renderQuiz) window.renderQuiz();
            break;

        case 'synapses':
            ProgressManager.resetChallenge(caseId, 'synapses');
            solvedSynapseDiseases = 0;
            selectedSynapses = [];
            if (window.renderSynapsesMatrix) window.renderSynapsesMatrix();
            break;

        case 'cascade':
            ProgressManager.resetChallenge(caseId, 'cascades');
            cascadesSolvedCount = 0;
            if (window.renderCascades) window.renderCascades();
            break;

        case 'cat':
            ProgressManager.resetChallenge(caseId, 'categorization');
            categorizationSolved = false;
            if (window.renderCategorization) window.renderCategorization();
            break;

        case 'doctordle':
            ProgressManager.resetChallenge(caseId, 'doctordle');
            solvedDoctordlePuzzles = 0;
            doctordleSolved = false;
            const docBadge = document.getElementById('badge-mode-doctordle');
            if (docBadge) {
                docBadge.innerText = `0/${totalDoctordlePuzzles}`;
                docBadge.style.background = '';
            }
            if (window.doctordleGame) {
                window.doctordleGame.resetGame();
            }
            break;

        case 'flashcards':
            ProgressManager.resetChallenge(caseId, 'flashcards');
            if (window.restartFlashcardDeck) window.restartFlashcardDeck(false);
            break;
    }

    window.checkFinalCompletion();
};

window.resetCurrentCaseEntirely = function() {
    if (!activeCaseData) return;
    const blind = !!window.isSpecialtyBlindMode;
    const title = blind ? 'dieses Krankheitsbild' : (activeCaseData.metadata?.title || activeCaseData.case_id);
    if (!window.confirm(`Gesamten Fall "${title}" komplett neu starten? Alle Teilergebnisse werden gelöscht.`)) return;

    ProgressManager.resetEntireCase(activeCaseData.case_id);
    window.loadCaseById(activeCaseData.case_id, { specialty: blind });
};

window.addEventListener("cloudCasesSynced", async () => {
    getCustomCases().forEach(window.registerCaseDDs);
    if (typeof renderDashboardCases === "function") {
        renderDashboardCases();
    }
    if (typeof window.renderSpecialtyHub === "function") {
        window.renderSpecialtyHub();
    }
    if (window.PharmacologyModule && typeof window.PharmacologyModule.syncFromCloud === 'function') {
        window.PharmacologyModule.syncFromCloud();
    }
});
// ====================================================
// SMARTPHONE CHALLENGE-MENÜ
// ====================================================
(function initMobileChallengePicker() {
    function syncMobileChallengePicker() {
        const navBar = document.querySelector('.challenge-nav-bar');
        if (!navBar) return;

        let mobileWrapper = document.getElementById('mc-mobile-picker-wrap');
        if (!mobileWrapper) {
            mobileWrapper = document.createElement('div');
            mobileWrapper.id = 'mc-mobile-picker-wrap';
            mobileWrapper.className = 'mc-mobile-picker-wrap';
            navBar.parentElement.insertBefore(mobileWrapper, navBar);
        }

        const buttons = Array.from(navBar.querySelectorAll('.challenge-tab-btn')).filter(btn => {
            return btn.style.display !== 'none';
        });

        const optionsHtml = buttons.map(btn => {
            const mode = btn.id.replace('tab-btn-', '');
            const badgeText = btn.querySelector('.tab-badge')?.innerText || '';
            const clone = btn.cloneNode(true);
            const b = clone.querySelector('.tab-badge');
            if (b) b.remove();
            const label = clone.innerText.trim();
            const selected = (mode === currentActiveChallenge) ? 'selected' : '';
            return `<option value="${mode}" ${selected}>${label}${badgeText ? ' (' + badgeText + ')' : ''}</option>`;
        }).join('');

        mobileWrapper.innerHTML = `
            <div class="mc-mobile-picker-inner">
                <label for="mc-mobile-challenge-select" class="mc-mobile-picker-label">🎯 Challenge wählen:</label>
                <select id="mc-mobile-challenge-select" class="mc-mobile-picker-select">
                    ${optionsHtml}
                </select>
            </div>
        `;

        const selectEl = document.getElementById('mc-mobile-challenge-select');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                window.switchPlayerMode(e.target.value);
            });
        }

        let fabContainer = document.getElementById('landscape-fab-container');
        if (!fabContainer) {
            fabContainer = document.createElement('div');
            fabContainer.id = 'landscape-fab-container';
            fabContainer.className = 'landscape-fab-container';

            fabContainer.innerHTML = `
                <div class="landscape-fab-menu" id="landscape-fab-menu"></div>
                <button class="landscape-fab-btn" id="landscape-fab-btn" title="Menü öffnen">+</button>
            `;
            document.body.appendChild(fabContainer);

            document.getElementById('landscape-fab-btn').addEventListener('click', () => {
                const menu = document.getElementById('landscape-fab-menu');
                const btn = document.getElementById('landscape-fab-btn');
                menu.classList.toggle('open');
                btn.classList.toggle('active');
                window.triggerHaptic(8);
            });
        }

        const playerView = document.getElementById('player-view');
        if (playerView && playerView.style.display !== 'none') {
            fabContainer.classList.add('visible');
        } else {
            fabContainer.classList.remove('visible');
            document.getElementById('landscape-fab-menu')?.classList.remove('open');
            document.getElementById('landscape-fab-btn')?.classList.remove('active');
        }

        const fabMenu = document.getElementById('landscape-fab-menu');
        if (fabMenu) {
            fabMenu.innerHTML = buttons.map(btn => {
                const mode = btn.id.replace('tab-btn-', '');
                const clone = btn.cloneNode(true);
                const b = clone.querySelector('.tab-badge');
                if (b) b.remove();
                const label = clone.innerText.trim();
                const isActive = (mode === currentActiveChallenge) ? 'active' : '';

                return `<button class="${isActive}" onclick="
                    window.triggerHaptic(5);
                    window.switchPlayerMode('${mode}'); 
                    document.getElementById('landscape-fab-menu').classList.remove('open'); 
                    document.getElementById('landscape-fab-btn').classList.remove('active');
                ">${label}</button>`;
            }).join('');
        }
    }

    const origSwitchPlayerMode = window.switchPlayerMode;
    if (typeof origSwitchPlayerMode === 'function') {
        window.switchPlayerMode = function(mode) {
            origSwitchPlayerMode(mode);
            syncMobileChallengePicker();
        };
    }

    const origLoadCaseById = window.loadCaseById;
    if (typeof origLoadCaseById === 'function') {
        window.loadCaseById = function(caseId, opts) {
            origLoadCaseById(caseId, opts);
            setTimeout(syncMobileChallengePicker, 50);
        };
    }

    const origSwitchTab = window.switchTab;
    if (typeof origSwitchTab === 'function') {
       window.switchTab = function(tab, el) {
    window.triggerHaptic(6);

    // NEU: Sobald man den Player verlässt, Notdienst-Session beenden
    if (tab !== 'player' && window.EmergencyManager && typeof window.EmergencyManager.exitSession === 'function') {
        window.EmergencyManager.exitSession();
    }

    if (tab === 'auth') {
        tab = 'settings';
    }
            origSwitchTab(tab, el);
            setTimeout(syncMobileChallengePicker, 50);
        };
    }

    window.addEventListener('DOMContentLoaded', () => setTimeout(syncMobileChallengePicker, 200));
})();

// ==========================================================================
// THEMEN-FORTSCHRITT MODAL
// ==========================================================================
window.toggleSubjectProgressModal = function(forceOpen) {
    const modal = document.getElementById('subject-progress-modal');
    if (!modal) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : (modal.style.display === 'none');
    
    if (shouldOpen) {
        renderSubjectProgressDrawer();
        modal.style.display = 'flex';
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
    } else {
        modal.style.display = 'none';
    }
};

// Rückwärtskompatibilität, falls noch irgendwo toggleSubjectDrawer aufgerufen wird:
window.toggleSubjectDrawer = function() {
    window.toggleSubjectProgressModal();
};

function getSubjectColorClass(pct) {
    if (pct <= 32) return 'bar-red';
    if (pct <= 66) return 'bar-orange';
    return 'bar-green';
}

function renderSubjectProgressDrawer() {
    const listEl = document.getElementById('dynamic-subjects-list');
    if (!listEl) return;

    const solvedIds = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    const superStats = {};
    getSuperFolderOrder().forEach(name => {
        superStats[name] = { total: 0, solved: 0 };
    });

    const allAvailableCases = typeof window.getRegisteredCases === 'function'
        ? window.getRegisteredCases()
        : [BUILTIN_DEMO_CASE, ...getCustomCases()];

    allAvailableCases.forEach(c => {
        const rawCategory = (c.folder_name || c.metadata?.medical_field || c.medical_field || 'Allgemein').trim();
        const superFolder = typeof getSuperFolderForCategory === 'function'
            ? getSuperFolderForCategory(rawCategory)
            : 'Allgemein';

        if (!superStats[superFolder]) {
            superStats[superFolder] = { total: 0, solved: 0 };
        }
        superStats[superFolder].total += 1;

        const caseId = c.case_id || c.id;
        if (solvedIds.includes(caseId)) {
            superStats[superFolder].solved += 1;
        }
    });

    const entries = Object.entries(superStats);
    entries.sort((a, b) => {
        const pctA = a[1].total > 0 ? (a[1].solved / a[1].total) * 100 : 0;
        const pctB = b[1].total > 0 ? (b[1].solved / b[1].total) * 100 : 0;
        return pctA - pctB;
    });

    listEl.innerHTML = entries.map(([folderName, stats]) => {
        const pct = stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0;
        const colorClass = getSubjectColorClass(pct);

        return `
            <div class="subject-item" style="cursor: pointer; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--card-border); border-radius: 10px; padding: 10px 12px;" onclick="window.toggleSubjectProgressModal(false); if(typeof window.selectSrFolder === 'function') window.selectSrFolder('${folderName.replace(/'/g, "\\'")}')" title="Klicken, um Spaced Repetition auf '${escapeHtml(folderName)}' zu filtern">
                <div class="subject-item-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span class="subject-item-name" style="font-size:0.82rem; font-weight:700; color:var(--text-main);">📁 ${escapeHtml(folderName)}</span>
                    <span class="subject-item-stats" style="font-family:'JetBrains Mono', monospace; font-size:0.75rem; color:var(--accent-blue); font-weight:700;">${pct}% (${stats.solved}/${stats.total})</span>
                </div>
                <div class="subject-bar-track" style="width:100%; height:6px; background:rgba(255,255,255,0.08); border-radius:999px; overflow:hidden;">
                    <div class="subject-bar-fill ${colorClass}" style="width: ${pct}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================================================
// LERN-DEPOT (KNOWLEDGE VAULT) MODULE
// ==========================================================================
const DEPOT_STORAGE_KEY = 'medcheck_learning_depot_v1';
let currentDepotFilter = 'open';
let pendingSelectionData = null;

function getLocalDepot() {
    try {
        return JSON.parse(localStorage.getItem(DEPOT_STORAGE_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function saveLocalDepot(items) {
    localStorage.setItem(DEPOT_STORAGE_KEY, JSON.stringify(items));
    updateDepotBadges(items);
}

function getSupabaseInstance() {
    return window.supabaseClient || window.sb || window.supabase_client || null;
}

async function syncDepotWithSupabase() {
    const sb = getSupabaseInstance();
    if (!sb || !sb.auth) {
        updateDepotBadges(getLocalDepot());
        return;
    }

    try {
        const { data: sessionData } = await sb.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) {
            updateDepotBadges(getLocalDepot());
            return;
        }

        const { data, error } = await sb
            .from('user_depot')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
            saveLocalDepot(data);
            const depotView = document.getElementById('depot-view');
            if (depotView && depotView.style.display !== 'none') {
                renderDepotView();
            }
        }
    } catch (err) {
        console.warn('Depot Offline-Modus aktiv:', err);
    }
}

function initOverviewSelectionListener() {
    const popover = document.getElementById('depot-selection-popover');
    if (!popover) return;

    const handleSelection = () => {
        const overviewPane = document.getElementById('mode-container-overview');
        if (!overviewPane || overviewPane.style.display === 'none') {
            popover.classList.add('hidden');
            return;
        }

        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : '';

        if (selectedText.length < 5 || !overviewPane.contains(selection.anchorNode)) {
            popover.classList.add('hidden');
            pendingSelectionData = null;
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        let cueContext = '';
        const anchorEl = selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentElement : selection.anchorNode;
        const cornellRow = anchorEl ? (anchorEl.closest('.cornell-row-item') || anchorEl.closest('.cornell-grid')) : null;
        if (cornellRow) {
            const cueEl = cornellRow.querySelector('.cornell-cue-item');
            if (cueEl) cueContext = cueEl.textContent.trim();
        }

        const activeCaseObj = activeCaseData || window.currentCase || window.activeCase || {};
        const badgeTitleEl = document.getElementById('player-case-badge-title');
        const caseTitle = activeCaseObj.metadata?.title || activeCaseObj.title || (badgeTitleEl ? badgeTitleEl.textContent.trim() : 'Klinischer Fall');
        const caseId = activeCaseObj.case_id || activeCaseObj.id || caseTitle;
        const category = activeCaseObj.folder_name || activeCaseObj.metadata?.medical_field || activeCaseObj.category || 'Allgemein';

        pendingSelectionData = {
            case_id: caseId,
            case_title: caseTitle,
            category: category,
            cue_context: cueContext,
            highlighted_text: selectedText
        };

        const topPos = Math.max(45, rect.top);
        const leftPos = Math.min(window.innerWidth - 90, Math.max(90, rect.left + rect.width / 2));

        popover.style.top = `${topPos}px`;
        popover.style.left = `${leftPos}px`;
        popover.classList.remove('hidden');
    };

    document.addEventListener('mouseup', () => setTimeout(handleSelection, 20));
    document.addEventListener('touchend', () => setTimeout(handleSelection, 60));

    document.querySelector('.main-wrapper')?.addEventListener('scroll', () => {
        popover.classList.add('hidden');
    });
}

async function saveCurrentSelectionToDepot(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const popover = document.getElementById('depot-selection-popover');
    if (popover) popover.classList.add('hidden');

    if (!pendingSelectionData) return;

    await createDepotEntry(pendingSelectionData);
    window.getSelection()?.removeAllRanges();
    pendingSelectionData = null;
}

async function addManualDepotEntry() {
    const input = document.getElementById('depot-manual-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    await createDepotEntry({
        case_id: 'manual_note',
        case_title: 'Eigene Notiz / Eselsbrücke',
        category: 'Eigene Notizen',
        cue_context: 'Merksatz',
        highlighted_text: text
    });

    input.value = '';
    renderDepotView();
}

async function createDepotEntry(entryData) {
    const items = getLocalDepot();

    const exists = items.some(i => i.highlighted_text === entryData.highlighted_text && i.case_id === entryData.case_id);
    if (exists) {
        if (typeof showScorePopup === 'function') {
            showScorePopup('Bereits im Lern-Depot vorhanden', 'neutral');
        }
        return;
    }

    const newItem = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'dep_' + Date.now(),
        case_id: entryData.case_id,
        case_title: entryData.case_title,
        category: entryData.category || 'Allgemein',
        cue_context: entryData.cue_context || '',
        highlighted_text: entryData.highlighted_text,
        user_note: '',
        is_mastered: false,
        created_at: new Date().toISOString()
    };

    items.unshift(newItem);
    saveLocalDepot(items);

    if (typeof showScorePopup === 'function') {
        showScorePopup('📌 Im Lern-Depot gespeichert!', 'positive');
    }

    const sb = getSupabaseInstance();
    if (sb && sb.auth) {
        try {
            const { data: sessionData } = await sb.auth.getSession();
            const user = sessionData?.session?.user;
            if (user) {
                await sb.from('user_depot').insert([{
                    id: newItem.id,
                    user_id: user.id,
                    case_id: newItem.case_id,
                    case_title: newItem.case_title,
                    category: newItem.category,
                    cue_context: newItem.cue_context,
                    highlighted_text: newItem.highlighted_text,
                    user_note: newItem.user_note,
                    is_mastered: newItem.is_mastered
                }]);
            }
        } catch (e) {
            console.warn('Supabase Insert im Hintergrund fehlgeschlagen (lokal gesichert):', e);
        }
    }
}

async function toggleDepotItemMastered(itemId) {
    const items = getLocalDepot();
    const target = items.find(i => i.id === itemId);
    if (!target) return;

    target.is_mastered = !target.is_mastered;
    saveLocalDepot(items);
    renderDepotView();

    const sb = getSupabaseInstance();
    if (sb && sb.auth) {
        try {
            await sb.from('user_depot').update({ is_mastered: target.is_mastered }).eq('id', itemId);
        } catch (e) {}
    }
}

async function updateDepotItemNote(itemId, noteText) {
    const items = getLocalDepot();
    const target = items.find(i => i.id === itemId);
    if (!target) return;

    target.user_note = noteText.trim();
    saveLocalDepot(items);

    const sb = getSupabaseInstance();
    if (sb && sb.auth) {
        try {
            await sb.from('user_depot').update({ user_note: target.user_note }).eq('id', itemId);
        } catch (e) {}
    }
}

async function deleteDepotItem(itemId) {
    const items = getLocalDepot().filter(i => i.id !== itemId);
    saveLocalDepot(items);
    renderDepotView();

    const sb = getSupabaseInstance();
    if (sb && sb.auth) {
        try {
            await sb.from('user_depot').delete().eq('id', itemId);
        } catch (e) {}
    }
}

function setDepotFilter(filterType) {
    currentDepotFilter = filterType;
    ['open', 'mastered', 'all'].forEach(type => {
        const btn = document.getElementById(`depot-filter-${type}`);
        if (btn) btn.classList.toggle('active', type === filterType);
    });
    renderDepotView();
}

function updateDepotBadges(items = getLocalDepot()) {
    const openCount = items.filter(i => !i.is_mastered).length;
    const masteredCount = items.filter(i => i.is_mastered).length;

    const navBadge = document.getElementById('nav-depot-badge');
    if (navBadge) navBadge.textContent = openCount;

    const openEl = document.getElementById('depot-count-open');
    if (openEl) openEl.textContent = openCount;

    const masteredEl = document.getElementById('depot-count-mastered');
    if (masteredEl) masteredEl.textContent = masteredCount;
}

function escapeDepotHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderDepotView() {
    const container = document.getElementById('depot-items-container');
    const categorySelect = document.getElementById('depot-category-select');
    const searchInput = document.getElementById('depot-search-input');
    if (!container) return;

    const allItems = getLocalDepot();
    updateDepotBadges(allItems);

    if (categorySelect) {
        const currentVal = categorySelect.value || 'ALL';
        const categories = [...new Set(allItems.map(i => i.category || 'Allgemein'))];
        categorySelect.innerHTML = `<option value="ALL">Alle Kategorien (${allItems.length})</option>` +
            categories.map(c => `<option value="${escapeDepotHtml(c)}">${escapeDepotHtml(c)}</option>`).join('');
        if (categories.includes(currentVal)) categorySelect.value = currentVal;
    }

    const selectedCat = categorySelect ? categorySelect.value : 'ALL';
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const filtered = allItems.filter(item => {
        if (currentDepotFilter === 'open' && item.is_mastered) return false;
        if (currentDepotFilter === 'mastered' && !item.is_mastered) return false;
        if (selectedCat !== 'ALL' && item.category !== selectedCat) return false;
        if (query) {
            const hay = `${item.highlighted_text} ${item.case_title} ${item.cue_context} ${item.user_note}`.toLowerCase();
            if (!hay.includes(query)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 36px 20px; color: var(--text-muted); background: rgba(10,15,29,0.35); border-radius: 14px; border: 1px dashed var(--card-border);">
                <div style="font-size: 1.5rem; margin-bottom: 8px;">📌</div>
                <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">Keine Einträge in dieser Ansicht</div>
                <div style="font-size: 0.82rem;">Markiere im Tab <strong>„🧭 Übersicht“</strong> eines Falls beliebige Textstellen mit der Maus, um sie direkt hier zu sammeln.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => `
        <div class="depot-card ${item.is_mastered ? 'is-mastered' : ''}">
            <div>
                <div class="depot-card-meta">
                    <span class="depot-case-Origin" title="${escapeDepotHtml(item.case_title)}">
                        📁 ${escapeDepotHtml(item.case_title)}
                    </span>
                    <span class="tag">${escapeDepotHtml(item.category)}</span>
                </div>
                ${item.cue_context ? `<div class="depot-cue-tag">💡 ${escapeDepotHtml(item.cue_context)}</div>` : ''}
                <div class="depot-quote-text">„${escapeDepotHtml(item.highlighted_text)}“</div>
            </div>

            <div>
                <input type="text" class="depot-note-input" 
                       placeholder="Eigene Notiz / Eselsbrücke ergänzen..." 
                       value="${escapeDepotHtml(item.user_note)}"
                       onchange="updateDepotItemNote('${item.id}', this.value)">
                <div class="depot-card-actions" style="margin-top: 8px;">
                    <button type="button" class="depot-toggle-btn" onclick="toggleDepotItemMastered('${item.id}')">
                        ${item.is_mastered ? '↺ Zurück zu Offen' : '✓ Als gelernt markieren'}
                    </button>
                    <button type="button" class="depot-delete-btn" onclick="deleteDepotItem('${item.id}')" title="Eintrag löschen">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    initOverviewSelectionListener();
    syncDepotWithSupabase();
});

// ==========================================================================
// KI-PRÜFUNGS-GENERATOR AUS DEM LERN-DEPOT (GEMINI API + FALLBACK)
// ==========================================================================
let currentDepotQuizQuestions = [];

function closeDepotQuizArena() {
    const arena = document.getElementById('depot-quiz-arena');
    if (arena) arena.classList.add('hidden');
}

async function generateDepotQuizWithAI() {
    const allItems = getLocalDepot();
    const categorySelect = document.getElementById('depot-category-select');
    const selectedCat = categorySelect ? categorySelect.value : 'ALL';

    let targetItems = allItems.filter(item => !item.is_mastered && (selectedCat === 'ALL' || item.category === selectedCat));

    if (targetItems.length === 0) {
        targetItems = allItems.filter(item => !item.is_mastered);
    }

    if (targetItems.length === 0) {
        if (typeof showScorePopup === 'function') {
            showScorePopup('Keine offenen Lernlücken im Depot vorhanden!', 'neutral');
        } else {
            alert('Du hast aktuell keine offenen Lernlücken im Depot. Markiere zuerst Textstellen in einer Fall-Übersicht!');
        }
        return;
    }

    const sampledItems = [...targetItems]
        .sort(() => Math.random() - 0.5)
        .slice(0, 6);

    const arena = document.getElementById('depot-quiz-arena');
    const body = document.getElementById('depot-quiz-body');
    const subtitle = document.getElementById('depot-quiz-subtitle');
    const btn = document.getElementById('btn-generate-depot-quiz');

    if (!arena || !body) return;

    arena.classList.remove('hidden');
    if (btn) btn.disabled = true;
    if (subtitle) subtitle.textContent = `Analysiere ${sampledItems.length} offene Lernlücken und konstruiere klinische Prüfungsfragen...`;

    body.innerHTML = `
        <div class="skeleton" style="height: 110px; width: 100%;"></div>
        <div class="skeleton" style="height: 110px; width: 100%;"></div>
    `;

    // Erstelle den strukturierten Kontext der ausgewählten Lern-Depot-Karten
    const notesContext = sampledItems.map((item) => 
        `[ID: ${item.id}] (Thema: ${item.cue_context || item.category}): "${item.highlighted_text}" ${item.user_note ? `(Eigene Notiz des Studenten: ${item.user_note})` : ''}`
    ).join('\n');

    try {
        // ⚡ Übergibt direkt den strukturierten Kontext; api/gemini.js baut den Super-Prompt drumherum!
        const questions = await fetchQuizFromGeminiEndpoint(notesContext);
        currentDepotQuizQuestions = questions;
        if (subtitle) subtitle.textContent = `${questions.length} klinische Fragen aus deinen offenen Lernlücken bereit:`;
        renderDepotQuizQuestions(questions);
    } catch (err) {
        console.warn('KI-Endpunkt nicht erreichbar, nutze intelligenten lokalen Recall-Generator:', err);
        const fallbackQuestions = buildLocalFallbackQuiz(sampledItems);
        currentDepotQuizQuestions = fallbackQuestions;
        if (subtitle) subtitle.textContent = `${fallbackQuestions.length} Active-Recall-Fragen (Offline-Modus) bereit:`;
        renderDepotQuizQuestions(fallbackQuestions);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function fetchQuizFromGeminiEndpoint(promptText) {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: promptText,
            mode: 'depot_quiz'
        })
    });

    const rawData = await response.json().catch(() => ({}));

    if (!response.ok) {
        const serverReason = rawData.details || rawData.error || `HTTP ${response.status}`;
        throw new Error(`Server-Antwort (${response.status}): ${serverReason}`);
    }

    if (Array.isArray(rawData.result)) {
        return rawData.result;
    } else if (Array.isArray(rawData)) {
        return rawData;
    }

    throw new Error('Unerwartetes Antwortformat vom Server.');
}

function buildLocalFallbackQuiz(sampledItems) {
    const allItems = getLocalDepot();
    return sampledItems.slice(0, 4).map(item => {
        const otherQuotes = allItems
            .filter(other => other.id !== item.id)
            .map(other => other.highlighted_text)
            .slice(0, 3);

        while (otherQuotes.length < 3) {
            otherQuotes.push('Unauffälliger Normalbefund ohne pathologische Relevanz im beschriebenen Kontext.');
        }

        const options = [item.highlighted_text, ...otherQuotes].sort(() => Math.random() - 0.5);
        const correctIndex = options.indexOf(item.highlighted_text);

        return {
            source_depot_id: item.id,
            topic: item.category || 'Active Recall',
            question: `Welche klinische Aussage bzw. welcher Pathomechanismus gehört zum Fall „${item.case_title}“ ${item.cue_context ? `(Fokus: ${item.cue_context})` : ''}?`,
            options: options,
            correct_index: correctIndex,
            explanation: `Original-Markierung aus deinem Depot zu „${item.case_title}“: ${item.highlighted_text}`
        };
    });
}

function renderDepotQuizQuestions(questions) {
    const body = document.getElementById('depot-quiz-body');
    if (!body) return;

    body.innerHTML = questions.map((q, qIdx) => `
        <div class="depot-q-card" id="depot-q-card-${qIdx}">
            <div class="depot-q-meta">
                <span>Frage ${qIdx + 1} / ${questions.length}</span>
                <span>${escapeHtml(q.topic || 'Klinische Prüfung')}</span>
            </div>
            <div class="depot-q-stem">${escapeHtml(q.question)}</div>
            <div class="depot-q-options">
                ${(q.options || []).map((opt, optIdx) => `
                    <button type="button" 
                            class="quiz-opt-btn" 
                            id="depot-q-${qIdx}-opt-${optIdx}"
                            onclick="evaluateDepotQuizAnswer(${qIdx}, ${optIdx})">
                        <span><strong>${String.fromCharCode(65 + optIdx)})</strong> ${escapeHtml(opt)}</span>
                    </button>
                `).join('')}
            </div>
            <div class="depot-q-feedback" id="depot-q-fb-${qIdx}"></div>
        </div>
    `).join('');
}

function evaluateDepotQuizAnswer(qIdx, selectedOptIdx) {
    const q = currentDepotQuizQuestions[qIdx];
    if (!q || q.answered) return;
    q.answered = true;

    const isCorrect = selectedOptIdx === Number(q.correct_index);

    (q.options || []).forEach((_, idx) => {
        const btn = document.getElementById(`depot-q-${qIdx}-opt-${idx}`);
        if (!btn) return;
        btn.disabled = true;
        if (idx === Number(q.correct_index)) {
            btn.classList.add('correct-highlight');
        } else if (idx === selectedOptIdx && !isCorrect) {
            btn.classList.add('wrong-highlight');
        }
    });

    if (isCorrect && typeof showScorePopup === 'function') {
        showScorePopup('+50 XP (Lernlücke gelöst!)', 'positive');
    }

    const fbEl = document.getElementById(`depot-q-fb-${qIdx}`);
    if (fbEl) {
        fbEl.style.display = 'block';
        fbEl.innerHTML = `
            <div style="font-weight: 700; color: ${isCorrect ? 'var(--color-symptom)' : 'var(--color-risk)'}; margin-bottom: 4px;">
                ${isCorrect ? '✓ Exakt richtig deduziert!' : '✕ Nicht ganz – hier ist der klinische Hintergrund:'}
            </div>
            <div>${escapeHtml(q.explanation || '')}</div>
            ${q.source_depot_id ? `
                <div class="depot-mastery-prompt">
                    <span style="font-size: 0.76rem; color: var(--text-dim);">Sitzt dieses Konzept jetzt sicher?</span>
                    <button type="button" class="depot-toggle-btn" onclick="markDepotMasteredFromQuiz('${q.source_depot_id}', this)">
                        ✓ Im Depot als gelernt abhaken
                    </button>
                </div>
            ` : ''}
        `;
    }
}

async function markDepotMasteredFromQuiz(depotId, btnEl) {
    await toggleDepotItemMastered(depotId);
    if (btnEl) {
        btnEl.textContent = '✓ Als gelernt gespeichert!';
        btnEl.disabled = true;
        btnEl.style.opacity = '0.6';
    }
}

// ====================================================
// PHARMA-COMPASS & MATRIX CLOUD-SPEICHER-MODULE (DELEGATOR)
// ====================================================
window.savePharmaSet = async function(setObj) {
    if (window.PharmacologyModule && typeof window.PharmacologyModule.syncFromCloud === 'function') {
        return await window.PharmacologyModule.syncFromCloud();
    }
};

window.syncPharmaSetsFromCloud = async function() {
    if (window.PharmacologyModule && typeof window.PharmacologyModule.syncFromCloud === 'function') {
        return await window.PharmacologyModule.syncFromCloud();
    }
};

// ==========================================================================
// DRAG & DROP AUTO-SCROLL ENGINE V2.0 (Universell für Window & Container)
// ==========================================================================
(function initDragAutoScroll() {
    const EDGE_ZONE = 130;       // Pixel ab oberem/unterem Rand, in denen gescrollt wird
    const MAX_SPEED = 32;        // Maximale Scroll-Geschwindigkeit in Pixel/Frame

    let isDragging = false;
    let mouseY = -1;
    let mouseX = -1;
    let animFrame = null;

    function getScrollContainer() {
        const mw = document.querySelector('.main-wrapper');
        if (mw && mw.scrollHeight > mw.clientHeight) return mw;
        return document.scrollingElement || document.documentElement || document.body;
    }

    function scrollLoop() {
        if (!isDragging) {
            animFrame = null;
            return;
        }

        const vh = window.innerHeight;

        // 1. Bücherregal scrollen, wenn der Zeiger darüber liegt
        const bookshelf = document.getElementById('bookshelf-container');
        let bsScrolled = false;
        if (bookshelf && mouseX >= 0 && mouseY >= 0) {
            const rect = bookshelf.getBoundingClientRect();
            if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
                const zone = 60;
                if (mouseY < rect.top + zone) {
                    const factor = (zone - (mouseY - rect.top)) / zone;
                    bookshelf.scrollTop -= Math.ceil(factor * 20);
                    bsScrolled = true;
                } else if (mouseY > rect.bottom - zone) {
                    const factor = (mouseY - (rect.bottom - zone)) / zone;
                    bookshelf.scrollTop += Math.ceil(factor * 20);
                    bsScrolled = true;
                }
            }
        }

        // 2. Hauptbereich / Fenster scrollen
        if (!bsScrolled && mouseY >= 0) {
            const container = getScrollContainer();
            let delta = 0;

            if (mouseY < EDGE_ZONE) {
                // Nach oben scrollen
                const factor = Math.max(0, (EDGE_ZONE - mouseY) / EDGE_ZONE);
                delta = -Math.ceil(factor * MAX_SPEED);
            } else if (mouseY > vh - EDGE_ZONE) {
                // Nach unten scrollen
                const factor = Math.max(0, (mouseY - (vh - EDGE_ZONE)) / EDGE_ZONE);
                delta = Math.ceil(factor * MAX_SPEED);
            }

            if (delta !== 0) {
                if (container === document.documentElement || container === document.body) {
                    window.scrollBy(0, delta);
                } else {
                    container.scrollTop += delta;
                }
            }
        }

        animFrame = requestAnimationFrame(scrollLoop);
    }

    function updateCoords(e) {
        mouseY = e.clientY;
        mouseX = e.clientX;
    }

    // Höre auf natives HTML5 Drag
    document.addEventListener('dragstart', (e) => {
        isDragging = true;
        mouseY = e.clientY;
        mouseX = e.clientX;
        if (!animFrame) animFrame = requestAnimationFrame(scrollLoop);
    });

    document.addEventListener('dragover', updateCoords, { passive: true });
    window.addEventListener('dragover', updateCoords, { passive: true });

    const stopDrag = () => {
        isDragging = false;
        mouseY = -1;
        mouseX = -1;
        if (animFrame) {
            cancelAnimationFrame(animFrame);
            animFrame = null;
        }
    };

    document.addEventListener('dragend', stopDrag);
    document.addEventListener('drop', stopDrag);

    // Höre zusätzlich auf Pointer-Events (z. B. auf Touch-Geräten oder im Mindmap-Modus)
    document.addEventListener('pointermove', (e) => {
        if (document.body.classList.contains('mm-dragging-active') || isDragging) {
            mouseY = e.clientY;
            mouseX = e.clientX;
            if (!animFrame) animFrame = requestAnimationFrame(scrollLoop);
        }
    }, { passive: true });

    document.addEventListener('pointerup', () => {
        if (!isDragging) stopDrag();
    });
})();

function setupSuperFolderDropZones() {
    document.querySelectorAll('.bookshelf-super-group').forEach(superGroup => {
        superGroup.addEventListener('dragover', (e) => {
            e.preventDefault();
            superGroup.classList.add('bookshelf-super-drag-over');
        });

        superGroup.addEventListener('dragleave', () => {
            superGroup.classList.remove('bookshelf-super-drag-over');
        });

        superGroup.addEventListener('drop', (e) => {
            e.preventDefault();
            superGroup.classList.remove('bookshelf-super-drag-over');

            const folderId = e.dataTransfer.getData('text/plain');
            const targetSuperId = superGroup.dataset.superId || superGroup.dataset.superTitle;

            if (folderId && targetSuperId) {
                if (typeof window.moveFolderToSuperFolder === 'function') {
                    window.moveFolderToSuperFolder(folderId, targetSuperId);
                }
            }
        });
    });
}

// ==========================================
// CREATOR HUB / CASE UPLOAD & CLOUD LOGIK
// ==========================================

window.cloudCaseIds = new Set();
window.currentSessionUser = null;

function getActiveSupabaseClient() {
    return window.supabaseClient || window.supabase || window.sb || null;
}

window.addEventListener('dragover', (e) => {
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
    }
}, false);

window.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
    }
}, false);

// 1. Initialisierung
async function initCreatorHubAndCloudCases() {
    const sb = getActiveSupabaseClient();
    await loadCasesFromDatabase();
    if (window.PharmacologyModule) window.PharmacologyModule.syncFromCloud(); // <-- NEU: Beim Start abrufen

    if (!sb || !sb.auth) return;

    try {
        const { data: { session } } = await sb.auth.getSession();
        window.currentSessionUser = session?.user || null;
        setupCreatorHub(window.currentSessionUser);

        sb.auth.onAuthStateChange(async(_event, session) => {
            window.currentSessionUser = session?.user || null;
            setupCreatorHub(window.currentSessionUser);
            loadCasesFromDatabase();
            if (window.PharmacologyModule) window.PharmacologyModule.syncFromCloud(); // <-- NEU: Bei Login/Logout synchronisieren
        });
    } catch (e) {
        console.warn("Creator Hub Auth-Prüfung fehlgeschlagen:", e);
    }
}

// 2. UI aktivieren/deaktivieren
function setupCreatorHub(currentUser) {
    const uploadSection = document.getElementById('creatorUploadSection');
    if (!uploadSection) return;

    if (currentUser && currentUser.email && currentUser.email.toLowerCase() === CREATOR_EMAIL.toLowerCase()) {
        uploadSection.style.display = 'block';
        initDropZone();
    } else {
        uploadSection.style.display = 'none';
    }
}

// 3. DropZone für Desktop-Dateien & Dashboard-Karten
function initDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('caseFileInput');
    if (!dropZone || !fileInput) return;

    dropZone.onclick = (e) => {
        if (e.target !== fileInput) fileInput.click();
    };

    fileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleCaseFiles(e.target.files);
            fileInput.value = '';
        }
    };

    const highlight = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
    };

    const unhighlight = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
    };

    ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, highlight, false));
    ['dragleave', 'dragend'].forEach(name => dropZone.addEventListener(name, unhighlight, false));

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');

        const dt = e.dataTransfer;
        if (!dt) return;

        const internalCaseId = dt.getData('application/medcheck-case-id') || dt.getData('text/plain');
        if (internalCaseId && (!dt.files || dt.files.length === 0)) {
            await handleInternalCaseUpload(internalCaseId);
            return;
        }

        if (dt.files && dt.files.length > 0) {
            handleCaseFiles(dt.files);
        }
    }, false);
}

// 4. Upload von In-App Fallkarten
async function handleInternalCaseUpload(caseId) {
    const sb = getActiveSupabaseClient();
    if (!sb) {
        alert("Fehler: Verbindung zu Supabase nicht gefunden.");
        return;
    }

    const { data: { session } } = await sb.auth.getSession();
    const currentUser = session?.user;

    if (!currentUser) {
        renderStatus(caseId, 'error', 'Nicht eingeloggt. Bitte melde dich zuerst an.');
        return;
    }

    const allCases = window.getRegisteredCases ? window.getRegisteredCases() : [BUILTIN_DEMO_CASE, ...getCustomCases()];
    const targetCase = allCases.find(c => (c.case_id || c.id) === caseId);

    if (!targetCase) {
        renderStatus(caseId, 'error', 'Fall nicht im lokalen Speicher gefunden.');
        return;
    }

    const title = targetCase.metadata?.title || targetCase.title || caseId;
    const field = targetCase.folder_name || targetCase.metadata?.medical_field || targetCase.medical_field || 'Allgemein';

    renderStatus(title, 'loading', 'Wird mit Supabase Cloud synchronisiert...');

    try {
        const { error } = await sb
            .from('cases')
            .upsert({
                case_id: caseId,
                title: title,
                medical_field: field,
                is_public: true,
                user_id: currentUser.id,
                created_by: currentUser.id,
                content: targetCase
            }, { onConflict: 'case_id' });

        if (error) throw error;

        renderStatus(title, 'success', `In Cloud veröffentlicht (${caseId})`);
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic([10, 40, 10]);

        await loadCasesFromDatabase();
    } catch (err) {
        console.error("Upload Error:", err);
        renderStatus(title, 'error', `Upload fehlgeschlagen: ${err.message}`);
    }
}

// 5. Externe JSON-Dateien per Dropzone verarbeiten
async function handleCaseFiles(files) {
    const sb = getActiveSupabaseClient();
    if (!sb) {
        alert("Fehler: Keine Supabase-Verbindung vorhanden.");
        return;
    }

    const { data: { session } } = await sb.auth.getSession();
    const currentUser = session?.user;

    if (!currentUser) {
        alert("Bitte melde dich zuerst als Creator an.");
        return;
    }

    for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith('.json')) {
            renderStatus(file.name, 'error', 'Keine gültige .json-Datei');
            continue;
        }

        renderStatus(file.name, 'loading', 'Validierung und Speicherung...');

        try {
            const rawContent = await file.text();
            const caseData = JSON.parse(rawContent);

            const caseId = caseData.case_id || caseData.id;
            if (!caseId) throw new Error("Pflichtfeld 'case_id' fehlt.");
            caseData.case_id = caseId;

            caseData.folder_name = caseData.folder_name || resolveCaseFolderName(caseData);
            registerDynamicFolder(caseData.folder_name);

            const field = caseData.folder_name || caseData.metadata?.medical_field || caseData.medical_field || 'Allgemein';
            const title = caseData.metadata?.title || caseData.title || caseId;

            const { error } = await sb
                .from('cases')
                .upsert({
                    case_id: caseId,
                    title: title,
                    medical_field: field,
                    is_public: true,
                    user_id: currentUser.id,
                    created_by: currentUser.id,
                    content: caseData
                }, { onConflict: 'case_id' });

            if (error) throw error;

            renderStatus(file.name, 'success', `Erfolgreich hochgeladen (${caseId})`);
            await loadCasesFromDatabase();
        } catch (err) {
            console.error("Upload Error:", err);
            renderStatus(file.name, 'error', `Fehler: ${err.message}`);
        }
    }
}

// 6. Unpublish-Funktion: Fall aus der Cloud entfernen
async function unpublishCaseFromCloud(caseId) {
    if (!window.confirm(`Möchtest du den Fall "${caseId}" wirklich aus der Cloud entfernen?\n\nEr bleibt lokal auf deinem Gerät erhalten, ist aber für andere Nutzer nicht mehr online sichtbar.`)) {
        return;
    }

    const sb = getActiveSupabaseClient();
    if (!sb) return;

    try {
        const { error } = await sb
            .from('cases')
            .delete()
            .eq('case_id', caseId);

        if (error) throw error;

        renderStatus(caseId, 'success', 'Aus der Cloud entfernt (nur noch lokal verfügbar)');
        await loadCasesFromDatabase();
    } catch (err) {
        alert(`Fehler beim Entfernen aus der Cloud: ${err.message}`);
    }
}

function renderStatus(fileName, state, message) {
    const statusContainer = document.getElementById('uploadStatusList');
    if (!statusContainer) return;

    const safeId = 'status-' + fileName.replace(/[^a-zA-Z0-9]/g, '_');
    let item = document.getElementById(safeId);
    if (!item) {
        item = document.createElement('div');
        item.id = safeId;
        statusContainer.prepend(item);
    }

    item.className = `upload-status-item ${state}`;
    item.innerHTML = `<span><strong>${escapeHtml(fileName)}</strong>: ${escapeHtml(message)}</span>`;
}

// 7. Datenbank synchronisieren & Cloud-Badges verwalten (Respektiert lokale Ordner-Overrides!)
async function loadCasesFromDatabase() {
    const sb = getActiveSupabaseClient();
    if (!sb) return;

    try {
        const { data, error } = await sb
            .from('cases')
            .select('case_id, title, medical_field, is_public, content')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn("Supabase-Fälle konnten nicht abgerufen werden:", error.message);
            return;
        }

        window.cloudCaseIds = new Set((data || []).map(d => d.case_id));

        if (data && data.length > 0) {
            let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
            const hiddenCloudIds = getHiddenCloudCaseIds();
            const deletedFolders = getDeletedFoldersSet();

            data.forEach(dbCase => {
                const cloudCase = dbCase.content;
                if (!cloudCase) return;
                const cId = cloudCase.case_id || cloudCase.id;
                if (hiddenCloudIds.includes(cId)) return;

                // falls in der DB-Spalte 'medical_field' ein neuerer Ordner steht, übernehmen:
                if (dbCase.medical_field && !deletedFolders.has(dbCase.medical_field.trim())) {
                    cloudCase.folder_name = dbCase.medical_field.trim();
                    if (cloudCase.metadata) cloudCase.metadata.medical_field = dbCase.medical_field.trim();
                }

                // WICHTIG: Lokale Ordner-Overrides & gelöschte Ordner auf den Cloud-Fall anwenden!
                applyFolderOverridesToCase(cloudCase);

                const idx = customCases.findIndex(c => (c.case_id || c.id) === cId);
                if (idx !== -1) {
                    customCases[idx] = cloudCase;
                } else {
                    customCases.push(cloudCase);
                }
                window.registerCaseDDs(cloudCase);
            });

            localStorage.setItem('custom_cases', JSON.stringify(customCases));
        }

        // Sicherstellen, dass gelöschte Ordner niemals wieder in medcheck_folder_order landen
        const deletedSet = getDeletedFoldersSet();
        if (deletedSet.size > 0) {
            let savedOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
            const cleanedOrder = savedOrder.filter(f => !deletedSet.has(f.trim()));
            if (cleanedOrder.length !== savedOrder.length) {
                localStorage.setItem('medcheck_folder_order', JSON.stringify(cleanedOrder));
            }
        }

        renderDashboardCases();
        if (typeof renderSubjectProgressDrawer === 'function') {
            renderSubjectProgressDrawer();
        }
    } catch (err) {
        console.error("Fehler bei loadCasesFromDatabase:", err);
    }
}
