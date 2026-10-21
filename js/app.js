// ====================================================
// GLOBALE STATES & KONFIGURATION
// ====================================================
const CREATOR_EMAIL = 'marco.claudio.nani@gmail.com';
let activeCaseData = null;
let currentActiveChallenge = 'overview';

// Challenge States
let selectedSynapses = [], totalSynapseDiseases = 0, solvedSynapseDiseases = 0, tilesPerDisease = 4;
let cascadesSolvedCount = 0, totalCascades = 0;
let categorizationSolved = false;
let quizSolved = false, userQuizAnswers = {};
let doctordleSolved = false, totalDoctordlePuzzles = 0, solvedDoctordlePuzzles = 0;
let flashcardsSolved = true, totalFlashcardsCount = 0, solvedFlashcardsCount = 0;
let clearedStepsCount = 0, totalStepsCount = 0;

// Dashboard & UI States
let openFolders = {};
let superFolderStates = {
    'Nervensystem und Sinnesorgane': true,
    'Psyche / Ethik / Recht': true,
    'Reproduktion': true,
    'Allgemein': true
};

// Klapp-Status für die Überordner im Bookshelf
let bookshelfSuperFolderState = {
    'Nervensystem und Sinnesorgane': false,
    'Psyche / Ethik / Recht': false,
    'Reproduktion': false,
    'Allgemein': true
};

let bookshelfFolderState = {};
let draggedItemState = null;
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

// ==========================================
// THEME ENGINE (FRÜHZEITIG INITIALISIERT)
// ==========================================
const THEME_STORAGE_KEY = 'medcheck_ui_theme';
const THEME_META_COLORS = {
    midnight: '#060913',
    daylight: '#f1f5f9',
    scrubs:   '#04110f',
    neuro:    '#090614'
};

window.applyAppTheme = function(themeName) {
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

    resetEntireCase(caseId) {
        if (!caseId || window.isSpecialtyBlindMode) return;
        const all = this.getAll();
        delete all[caseId];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));

        let solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
        solved = solved.filter(id => id !== caseId);
        localStorage.setItem('solved_cases', JSON.stringify(solved));
    }
};

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
// ERWEITERTE ORDNER- & ÜBERORDNER-VERWALTUNG
// ====================================================
function getCustomSuperFolders() {
    try {
        return JSON.parse(localStorage.getItem('medcheck_custom_supers') || '[]');
    } catch (e) {
        return [];
    }
}

function removeCustomSuperFolder(superTitle) {
    if (!confirm(`Überordner "${superTitle}" wirklich entfernen?`)) return;
    let customSupers = getCustomSuperFolders().filter(s => s !== superTitle);
    localStorage.setItem('medcheck_custom_supers', JSON.stringify(customSupers));
    delete superFolderStates[superTitle];
    delete bookshelfSuperFolderState[superTitle];
    renderDashboardCases();
}

function initCustomSuperFoldersState() {
    try {
        const savedSupers = getCustomSuperFolders();
        savedSupers.forEach(sName => {
            if (superFolderStates[sName] === undefined) {
                superFolderStates[sName] = true;
                bookshelfSuperFolderState[sName] = true;
            }
        });
    } catch (e) {
        console.error("Fehler beim Laden der Custom Supers:", e);
    }
}

initCustomSuperFoldersState();

window.createNewSuperFolderModal = function() {
    const superName = window.prompt("Name für den neuen Überordner (z.B. 'Interdisziplinäre Notfälle'):");
    if (!superName || !superName.trim()) return;

    const cleanName = superName.trim();
    if (superFolderStates[cleanName] !== undefined) {
        alert("Dieser Überordner existiert bereits.");
        return;
    }

    superFolderStates[cleanName] = true;
    bookshelfSuperFolderState[cleanName] = true;

    let customSupers = getCustomSuperFolders();
    if (!customSupers.includes(cleanName)) {
        customSupers.push(cleanName);
        localStorage.setItem('medcheck_custom_supers', JSON.stringify(customSupers));
    }

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
};

window.createNewFolder = function(folderName) {
    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    if (!order.includes(folderName)) {
        order.push(folderName);
        localStorage.setItem('medcheck_folder_order', JSON.stringify(order));
    }
    bookshelfFolderState[folderName] = true;
    renderDashboardCases();
};

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
// COMPLETION CHECK (VOR LOADCASE VORAB DEFINIERT)
// ====================================================
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

// ====================================================
// INITIALISIERUNG
// ====================================================
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'midnight';
    window.applyAppTheme(savedTheme);

    initUserData();
    if (typeof initCreatorHubAndCloudCases === 'function') {
        initCreatorHubAndCloudCases();
    }

    [BUILTIN_DEMO_CASE, ...getCustomCases()].forEach(window.registerCaseDDs);
    prefetchManifestDDs();
    renderSkillsSidebar();
    renderDashboardCases();
    if (typeof window.renderSpecialtyHub === 'function') {
        window.renderSpecialtyHub();
    }

    if (window.SpacedRepetitionEngine) {
        window.SpacedRepetitionEngine.renderDashboardWidget('sr-dashboard-widget', 'ALL');
    }

    window.addEventListener('sr:updated', () => {
        if (window.SpacedRepetitionEngine) {
            const currentFilter = document.getElementById('sr-folder-filter')?.value || 'ALL';
            window.SpacedRepetitionEngine.renderDashboardWidget('sr-dashboard-widget', currentFilter);
        }
    });

    const addFolderBtn = document.getElementById('add-bookshelf-folder-btn');
    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', () => {
            const name = window.prompt("Name für den neuen Ordner:");
            if (name && name.trim()) window.createNewFolder(name.trim());
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest('#btn-next-specialty-case')) window.nextSpecialtyCase();
        if (e.target && e.target.closest('#btn-exit-specialty')) {
            window.isSpecialtyBlindMode = false;
            window.applyBlindHeader(false, null);
            window.switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
        }
        if (e.target && e.target.closest('#btn-reveal-diagnosis')) {
            const title = activeCaseData?.metadata?.title || activeCaseData?.case_id || 'Krankheitsbild';
            alert(`🔍 Diagnose enthüllt:\n\n${title}`);
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

    if (tab === 'auth') tab = 'settings';

    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    if (el) {
        el.classList.add('active');
    } else {
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('onclick')?.includes(`'${tab}'`)) {
                item.classList.add('active');
            }
        });
    }

    const allViews = ['dashboard-view', 'player-view', 'forge-view', 'settings-view', 'depot-view', 'pharmacology-view'];
    allViews.forEach(viewId => {
        const element = document.getElementById(viewId);
        if (element) element.style.display = 'none';
    });

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
        if (targetElement) targetElement.style.display = 'block';
    }

    const navPlayer = document.getElementById('nav-player');
    if (navPlayer) navPlayer.style.display = (tab === 'player') ? 'flex' : 'none';

    const sidebar = document.querySelector('sidebar') || document.querySelector('.sidebar') || document.querySelector('aside');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

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
        hint = activeCaseData.extra_tasks.clinical_cascades[0]?.tutor_hint || hint;
    } else if (activeCaseData.extra_tasks[taskKey]) {
        hint = activeCaseData.extra_tasks[taskKey].tutor_hint || hint;
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

const FOLDER_SUPER_MAPPING_KEY = 'medcheck_folder_super_mapping';

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

function getSuperFolderForCategory(categoryName) {
    if (!categoryName) return 'Allgemein';
    const cleanName = categoryName.trim();

    const mapping = getFolderSuperMapping();
    if (mapping[cleanName] && superFolderStates[mapping[cleanName]] !== undefined) {
        return mapping[cleanName];
    }

    const lower = cleanName.toLowerCase();
    if (lower === 'allgemein' || lower.startsWith('allgemein') || lower === 'sonstiges' || lower === 'uncategorized') {
        return 'Allgemein';
    }
    if (lower.includes('psych') || lower.includes('ethik') || lower.includes('recht') || lower.includes('legal') || lower.includes('forensik') || lower.includes('sozial')) {
        return 'Psyche / Ethik / Recht';
    }
    if (lower.includes('repro') || lower.includes('gyn') || lower.includes('geburt') || lower.includes('fertilit') || lower.includes('schwanger') || lower.includes('zyklus') || lower.includes('ovard')) {
        return 'Reproduktion';
    }
    if (
        lower.includes('neuro') || lower.includes('nerv') || lower.includes('sinnes') ||
        lower.includes('auge') || lower.includes('ophthal') || lower.includes('hno') ||
        lower.includes('hals-nase') || lower.includes('ohr') || lower.includes('29.2') ||
        lower.includes('myelon') || lower.includes('hirn') || lower.includes('gehirn') ||
        lower.includes('spinal') || lower.includes('mening') || lower.includes('cns') ||
        lower.includes('zns') || lower.includes('cjk') || lower.includes('demenz')
    ) {
        return 'Nervensystem und Sinnesorgane';
    }
    return 'Allgemein';
}

window.moveFolderToSuperFolder = function(folderName, targetSuperFolder) {
    if (!folderName || !targetSuperFolder) return;
    if (superFolderStates[targetSuperFolder] === undefined) return;

    const mapping = getFolderSuperMapping();
    mapping[folderName] = targetSuperFolder;
    saveFolderSuperMapping(mapping);

    superFolderStates[targetSuperFolder] = true;
    if (typeof bookshelfSuperFolderState !== 'undefined') {
        bookshelfSuperFolderState[targetSuperFolder] = true;
    }

    renderDashboardCases();
    if (typeof renderSubjectProgressDrawer === 'function') {
        renderSubjectProgressDrawer();
    }
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
};

window.promptMoveFolderToSuperFolder = function(folderName) {
    if (!folderName) return;
    const currentSuper = getSuperFolderForCategory(folderName);
    const availableSupers = Object.keys(superFolderStates);

    const optionsText = availableSupers
        .map((s, idx) => `${idx + 1}: ${s}${s === currentSuper ? ' (aktuell)' : ''}`)
        .join('\n');

    const choice = window.prompt(
        `In welchen Überordner möchtest du "${folderName}" verschieben?\n\nGib die Ziffer ein:\n${optionsText}`
    );

    if (choice === null) return;
    const num = parseInt(choice.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= availableSupers.length) {
        const target = availableSupers[num - 1];
        if (target !== currentSuper) {
            window.moveFolderToSuperFolder(folderName, target);
        }
    } else {
        const match = availableSupers.find(s => s.toLowerCase() === choice.trim().toLowerCase());
        if (match && match !== currentSuper) {
            window.moveFolderToSuperFolder(folderName, match);
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

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isResizing = true;
        document.body.classList.add('is-resizing');
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        setSidebarWidth(e.clientX);
    });

    window.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
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
    let currentXp = Math.max(0, parseInt(localStorage.getItem('user_xp') || '0') + delta);
    localStorage.setItem('user_xp', currentXp);
    updateStatsUI();
    if (window.Cloud) window.Cloud.scheduleProgressSync();

    const container = document.getElementById('hud-popup-container');
    if (!container) return;
    const popup = document.createElement('div');
    popup.className = `score-popup ${delta >= 0 ? 'positive' : 'negative'}`;
    popup.innerText = `${delta >= 0 ? '+' : ''}${delta} XP (${label})`;
    container.appendChild(popup);
    setTimeout(() => popup.remove(), 1400);
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
// FACHRICHTUNGS-TRAINING ENGINE
// ====================================================
window.setLearningMode = function(mode) {
    currentLearningMode = mode;

    const btnTopic = document.getElementById('seg-topic');
    const btnSpecialty = document.getElementById('seg-specialty');
    const topicGrid = document.getElementById('super-folders-wrapper');
    const specialtyHub = document.getElementById('specialty-hub');

    if (mode === 'specialty') {
        btnTopic?.classList.remove('active');
        btnSpecialty?.classList.add('active');
        if (topicGrid) topicGrid.style.display = 'none';
        if (specialtyHub) {
            specialtyHub.style.display = 'block';
            window.renderSpecialtyHub();
        }
    } else {
        btnSpecialty?.classList.remove('active');
        btnTopic?.classList.add('active');
        if (specialtyHub) specialtyHub.style.display = 'none';
        if (topicGrid) topicGrid.style.display = 'flex';
    }
};

window.renderSpecialtyHub = function() {
    const hub = document.getElementById('specialty-hub');
    if (!hub) return;

    const allCases = window.getRegisteredCases();
    const specialties = {};
    allCases.forEach(c => {
        const field = (c.folder_name || c.metadata?.medical_field || c.medical_field || 'Allgemein').trim();
        specialties[field] = (specialties[field] || 0) + 1;
    });

    if (Object.keys(specialties).length === 0) {
        hub.innerHTML = `<p style="color: var(--text-muted, #94a3b8); padding: 20px;">Keine Fachrichtungen gefunden.</p>`;
        return;
    }

    let html = `<div class="specialty-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 15px;">`;
    for (const [spec, count] of Object.entries(specialties)) {
        html += `
            <div class="specialty-card" onclick="window.startSpecialtyMode('${escapeHtml(spec)}')" style="background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; cursor: pointer; transition: transform 0.2s ease;">
                <h3 style="color: #38bdf8; margin: 0 0 8px 0; font-size: 1.1rem;">${escapeHtml(spec)}</h3>
                <p style="color: #94a3b8; font-size: 0.85rem; margin: 0;">${count} Krankheitsbild${count > 1 ? 'er' : ''}</p>
            </div>
        `;
    }
    html += `</div>`;
    hub.innerHTML = html;
};

window.startSpecialtyMode = function(specialtyName) {
    activeSpecialtyName = specialtyName;
    const allCases = window.getRegisteredCases();

    specialtyQueue = allCases.filter(c => {
        const f = (c.folder_name || c.metadata?.medical_field || c.medical_field || '').trim();
        return f.toLowerCase() === specialtyName.trim().toLowerCase();
    });

    if (specialtyQueue.length === 0) {
        alert(`Keine Fälle für die Fachrichtung "${specialtyName}" gefunden.`);
        return;
    }

    for (let i = specialtyQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [specialtyQueue[i], specialtyQueue[j]] = [specialtyQueue[j], specialtyQueue[i]];
    }

    specialtyIndex = 0;
    loadSpecialtyCase(specialtyIndex);
};

function loadSpecialtyCase(index) {
    if (index < 0 || index >= specialtyQueue.length) {
        index = 0;
        specialtyIndex = 0;
    }
    const caseItem = specialtyQueue[index];
    window.isSpecialtyBlindMode = true;
    window.loadCaseById(caseItem.case_id, { specialty: true });
    window.applyBlindHeader(true, caseItem);
}

window.nextSpecialtyCase = function() {
    if (specialtyQueue.length === 0) return;
    specialtyIndex = (specialtyIndex + 1) % specialtyQueue.length;
    loadSpecialtyCase(specialtyIndex);
};

window.applyBlindHeader = function(blind, caseData) {
    const badge = document.getElementById('player-case-badge-title');
    const wrap = badge ? badge.parentElement : null;

    let field = 'Fachrichtung';
    if (caseData && caseData.metadata && caseData.metadata.medical_field) {
        field = caseData.metadata.medical_field;
    } else if (caseData && caseData.folder_name) {
        field = caseData.folder_name;
    } else if (typeof specialtySession !== 'undefined' && specialtySession.field) {
        field = specialtySession.field;
    }

    if (wrap) {
        wrap.classList.toggle('blind-mode-header', blind);
        if (wrap.firstChild && wrap.firstChild.nodeType === Node.TEXT_NODE) {
            wrap.firstChild.nodeValue = blind ? '' : 'Aktiver Fall: ';
        }

        let nextBtn = document.getElementById('btn-top-new-case');
        if (!nextBtn) {
            nextBtn = document.createElement('button');
            nextBtn.id = 'btn-top-new-case';
            nextBtn.innerHTML = 'Neuer Fall ➔';
            nextBtn.style.cssText = 'background: #0284c7; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; margin-left: 15px; font-size: 0.85rem; box-shadow: 0 2px 8px rgba(2,132,199,0.4); flex-shrink: 0;';

            nextBtn.onmouseenter = () => nextBtn.style.background = '#0369a1';
            nextBtn.onmouseleave = () => nextBtn.style.background = '#0284c7';

            nextBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.nextSpecialtyCase === 'function') {
                    window.nextSpecialtyCase();
                } else if (window.SpecialtyEngine && typeof window.SpecialtyEngine.nextCase === 'function') {
                    window.SpecialtyEngine.nextCase();
                }
            };

            wrap.appendChild(nextBtn);
            wrap.style.display = 'inline-flex';
            wrap.style.alignItems = 'center';
        }

        nextBtn.style.display = blind ? 'inline-block' : 'none';
    }

    if (badge && caseData) {
        badge.innerText = blind ? `${field} • Training` : (caseData.metadata?.title || caseData.case_id);
    }

    const overviewTab = document.getElementById('tab-btn-overview');
    if (overviewTab) {
        overviewTab.style.display = blind ? 'none' : '';
    }
};

// ====================================================
// DASHBOARD DYNAMISCHES RENDERING (SUPER-FOLDER ENGINE)
// ====================================================
function renderDashboardCases() {
    const customCases = getCustomCases();
    const solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');

    let wrapper = document.getElementById('super-folders-wrapper');
    if (!wrapper) {
        const topicGrid = document.getElementById('topic-grid');
        if (topicGrid) {
            wrapper = document.createElement('div');
            wrapper.id = 'super-folders-wrapper';
            wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 16px; margin-top: 15px;';
            topicGrid.parentNode.replaceChild(wrapper, topicGrid);
        }
    }
    if (!wrapper) return;

    const allCases = [BUILTIN_DEMO_CASE, ...customCases.filter(c => c.case_id !== BUILTIN_DEMO_CASE.case_id)];

    const grouped = {};
    allCases.forEach(c => {
        const cat = (c.folder_name || c.metadata?.medical_field || "Allgemein").trim();
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(c);
    });

    const superFolders = {};
    Object.keys(superFolderStates).forEach(key => {
        superFolders[key] = [];
    });

    Object.keys(grouped).forEach(cat => {
        const targetSuper = getSuperFolderForCategory(cat);
        if (!superFolders[targetSuper]) superFolders[targetSuper] = [];
        superFolders[targetSuper].push(cat);
    });

    let superFoldersHtml = '';
    const isCurrentUserCreator = window.currentSessionUser?.email?.toLowerCase() === CREATOR_EMAIL.toLowerCase();

    Object.entries(superFolders).forEach(([superTitle, categories], superIdx) => {
        const isOpen = superFolderStates[superTitle] !== undefined ? superFolderStates[superTitle] : true;
        const arrowSymbol = isOpen ? '▼' : '▶';

        let categoriesHtml = '';
        if (categories.length === 0) {
            categoriesHtml = `<div style="padding: 16px; color: var(--text-dim); font-size: 0.85rem; font-style: italic;">Ordner hierher ziehen, um sie diesem Themenblock zuzuweisen.</div>`;
        } else {
            categories.sort((a, b) => a.localeCompare(b));

            categoriesHtml = categories.map((category, catIdx) => {
                const cases = grouped[category] || [];
                const solvedCount = cases.filter(c => solved.includes(c.case_id)).length;
                const isExpanded = !!openFolders[category];

                const cardsHtml = cases.map(c => {
                    const isSolved = solved.includes(c.case_id);
                    const savedState = ProgressManager.getCaseProgress(c.case_id);
                    const inProgress = !isSolved && savedState && Object.keys(savedState).length > 0;
                    const isCloudCase = !!(window.cloudCaseIds && window.cloudCaseIds.has(c.case_id));

                    const deleteBtn = c.case_id === BUILTIN_DEMO_CASE.case_id
                        ? ''
                        : '<button type="button" class="delete-case-btn" aria-label="Fall löschen" title="Fall lokal löschen">×</button>';

                    const unpublishBtn = (isCurrentUserCreator && isCloudCase)
                        ? `<button type="button" class="unpublish-case-btn" data-unpublish-id="${encodeURIComponent(c.case_id)}" title="Aus Cloud entfernen (Unpublish)">☁️✕</button>`
                        : '';

                    return `
                    <div class="case-card ${inProgress ? 'in-progress' : ''}" 
                         draggable="true" 
                         data-case-id="${encodeURIComponent(c.case_id)}" 
                         role="button" 
                         tabindex="0">

                        <div class="case-card-header">
                            <div class="case-card-badges">
                                <span class="tag">${escapeHtml(c.metadata?.bloom_level || 'Evaluation')}</span>
                                <span class="cloud-badge ${isCloudCase ? 'is-cloud' : 'is-local'}">
                                    ${isCloudCase ? '☁️ Cloud' : '💾 Lokal'}
                                </span>
                            </div>
                            <div class="case-card-actions">
                                ${unpublishBtn}
                                ${deleteBtn}
                            </div>
                        </div>

                        <h3>${escapeHtml(c.metadata?.title || c.case_id)}</h3>

                        <div style="font-size:0.75rem; display:flex; justify-content:space-between; margin-top:10px;">
                            <span style="color:${isSolved ? 'var(--color-symptom, #10b981)' : (inProgress ? '#f59e0b' : 'var(--accent-blue, #38bdf8)')}; font-weight:700;">
                                ${isSolved ? '✓ Gelöst' : (inProgress ? '↻ Angefangen' : '● Offen')}
                            </span>
                            <span>+${c.metadata?.xp_reward || 900} XP</span>
                        </div>
                    </div>`;
                }).join('');

                return `
                    <div class="category-folder" draggable="true" data-category="${encodeURIComponent(category)}" data-super="${encodeURIComponent(superTitle)}" id="dashboard-folder-${superIdx}-${catIdx}">
                        <div class="category-header">
                            <div class="category-title-wrap">
                                <span class="category-drag-handle" title="Ordner ziehen zum Verschieben">⠿</span>
                                <span class="category-arrow ${isExpanded ? 'expanded' : ''}" id="arrow-${superIdx}-${catIdx}">▶</span>
                                <span>📁 ${escapeHtml(category)}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <button type="button" class="folder-action-btn move-btn" onclick="event.stopPropagation(); promptMoveFolderToSuperFolder('${escapeHtml(category)}')" title="Überordner wechseln">⇄</button>
                                <span class="category-badge">${solvedCount}/${cases.length} Gelöst</span>
                            </div>
                        </div>
                        <div class="category-cases-body" id="folder-body-${superIdx}-${catIdx}" style="display:${isExpanded ? 'grid' : 'none'};">${cardsHtml}</div>
                    </div>`;
            }).join('');
        }

        superFoldersHtml += `
            <div class="super-folder" data-super-title="${encodeURIComponent(superTitle)}">
                <div class="super-folder-header" onclick="toggleSuperFolder('${superTitle}')">
                    <div class="super-folder-title">
                        <svg class="super-folder-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        <span>${escapeHtml(superTitle)}</span>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${arrowSymbol}</span>
                </div>
                <div class="super-folder-body" style="display:${isOpen ? 'flex' : 'none'}; flex-direction:column; gap:12px;">
                    ${categoriesHtml}
                </div>
            </div>
        `;
    });

    wrapper.innerHTML = superFoldersHtml;

    // Drag-over & Drop für die Überordner im Dashboard
    wrapper.querySelectorAll('.super-folder').forEach(superEl => {
        const sTitle = decodeURIComponent(superEl.dataset.superTitle);

        superEl.addEventListener('dragover', (e) => {
            if (!draggedDashboardFolder) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            superEl.classList.add('super-folder-drag-over');
        });

        superEl.addEventListener('dragleave', (e) => {
            if (!superEl.contains(e.relatedTarget)) {
                superEl.classList.remove('super-folder-drag-over');
            }
        });

        superEl.addEventListener('drop', (e) => {
            e.preventDefault();
            superEl.classList.remove('super-folder-drag-over');
            if (!draggedDashboardFolder) return;
            window.moveFolderToSuperFolder(draggedDashboardFolder, sTitle);
            draggedDashboardFolder = null;
        });
    });

    // Klick- & Drag-Handler für Ordner
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
            if (e.target !== folderEl && !e.target.closest('.category-header')) return;
            draggedDashboardFolder = catName;
            folderEl.classList.add('folder-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', catName);
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
        });

        folderEl.addEventListener('dragend', () => {
            folderEl.classList.remove('folder-dragging');
            draggedDashboardFolder = null;
            wrapper.querySelectorAll('.super-folder').forEach(f => f.classList.remove('super-folder-drag-over'));
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
            e.dataTransfer.effectAllowed = 'copyMove';
            e.dataTransfer.setData('text/plain', caseId);
            e.dataTransfer.setData('application/medcheck-case-id', caseId);
            card.classList.add('case-card-dragging');
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('case-card-dragging');
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

const DASHBOARD_FOLDER_ORDER_KEY = 'medcheck_dashboard_folder_order';
let draggedDashboardFolder = null;

function getDashboardFolderOrder() {
    try { return JSON.parse(localStorage.getItem(DASHBOARD_FOLDER_ORDER_KEY) || '[]'); } catch (_e) { return []; }
}

function saveDashboardFolderOrder(orderArray) {
    try { localStorage.setItem(DASHBOARD_FOLDER_ORDER_KEY, JSON.stringify(orderArray)); } catch (e) {}
}

// ====================================================
// BOOKSHELF & ORDNER-VERWALTUNG
// ====================================================
function renderBookshelf(casesArray) {
    const bookshelfContainer = document.getElementById('bookshelf-container');
    if (!bookshelfContainer) return;

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

    const superFolders = {};
    Object.keys(superFolderStates).forEach(key => {
        superFolders[key] = [];
    });

    savedOrder.forEach(folderName => {
        const targetSuper = getSuperFolderForCategory(folderName);
        if (!superFolders[targetSuper]) {
            superFolders[targetSuper] = [];
        }
        superFolders[targetSuper].push(folderName);
    });

    Object.entries(superFolders).forEach(([superTitle, subfolderNames]) => {
        const isSuperOpen = bookshelfSuperFolderState[superTitle] !== false;

        let totalCasesInSuper = 0;
        let solvedCasesInSuper = 0;
        subfolderNames.forEach(fName => {
            const list = folders[fName] || [];
            totalCasesInSuper += list.length;
            solvedCasesInSuper += list.filter(c => solved.includes(c.case_id)).length;
        });

        const superDiv = document.createElement('div');
        superDiv.className = 'bookshelf-super-group';
        superDiv.dataset.superTitle = superTitle;

        const superHeader = document.createElement('div');
        superHeader.className = 'bookshelf-super-header';
        superHeader.innerHTML = `
            <div class="bookshelf-super-title-wrap">
                <span class="bookshelf-super-arrow ${isSuperOpen ? 'open' : ''}">▶</span>
                <span class="bookshelf-super-icon">📂</span>
                <span class="bookshelf-super-title" title="${escapeHtml(superTitle)}">${escapeHtml(superTitle)}</span>
            </div>
            <span class="bookshelf-super-badge">${solvedCasesInSuper}/${totalCasesInSuper}</span>
        `;

        superHeader.addEventListener('click', () => {
            bookshelfSuperFolderState[superTitle] = !isSuperOpen;
            renderBookshelf(casesArray);
        });

        superDiv.addEventListener('dragover', (e) => {
            if (!draggedItemState || draggedItemState.type !== 'folder') return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            superDiv.classList.add('bookshelf-super-drag-over');
        });

        superDiv.addEventListener('dragleave', (e) => {
            if (!superDiv.contains(e.relatedTarget)) {
                superDiv.classList.remove('bookshelf-super-drag-over');
            }
        });

        superDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            superDiv.classList.remove('bookshelf-super-drag-over');
            if (!draggedItemState || draggedItemState.type !== 'folder') return;
            window.moveFolderToSuperFolder(draggedItemState.name, superTitle);
        });

        const superBody = document.createElement('div');
        superBody.className = `bookshelf-super-body ${isSuperOpen ? '' : 'collapsed'}`;

        if (subfolderNames.length === 0) {
            const emptyNotice = document.createElement('div');
            emptyNotice.style.cssText = 'font-size:0.68rem; color:var(--text-dim, #64748b); padding:4px 8px; font-style:italic;';
            emptyNotice.textContent = 'Hierher ziehen zum Ablegen';
            superBody.appendChild(emptyNotice);
        } else {
            subfolderNames.forEach(folderName => {
                const casesInFolder = folders[folderName] || [];
                const isOpen = !!bookshelfFolderState[folderName];
                const solvedCount = casesInFolder.filter(c => solved.includes(c.case_id)).length;

                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder-group';
                folderDiv.dataset.folderName = folderName;
                folderDiv.draggable = true;

                const header = document.createElement('div');
                header.className = 'folder-header';
                header.innerHTML = `
                    <div class="folder-header-left" style="display:flex; align-items:center; overflow:hidden; gap:5px; flex:1; min-width:0;">
                        <span class="folder-drag-handle" title="Ordner ziehen zum Verschieben">⠿</span>
                        <span class="folder-toggle-arrow ${isOpen ? 'open' : ''}">▶</span>
                        <span class="folder-title-text" style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">📁 ${escapeHtml(folderName)}</span>
                        <span class="folder-badge-mini" style="font-size:0.65rem; color:var(--accent-cyan, #38bdf8); margin-left:auto; margin-right:4px; flex-shrink:0;">${solvedCount}/${casesInFolder.length}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:2px; flex-shrink:0;">
                        <button type="button" class="folder-action-btn move-btn" title="Überordner wechseln">⇄</button>
                        <button type="button" class="folder-action-btn edit-btn" title="Ordner umbenennen">✏️</button>
                        <button type="button" class="folder-action-btn delete-folder-btn" title="Ordner löschen">🗑️</button>
                    </div>
                `;

                const list = document.createElement('ul');
                list.className = `folder-cases-list ${isOpen ? '' : 'collapsed'}`;

                if (casesInFolder.length === 0) {
                    const emptyLi = document.createElement('li');
                    emptyLi.style.cssText = 'font-size:0.72rem; color:var(--text-dim, #64748b); padding:4px 6px; font-style:italic;';
                    emptyLi.textContent = 'Ordner ist leer (Fall hierher ziehen)';
                    list.appendChild(emptyLi);
                } else {
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
                            e.dataTransfer.effectAllowed = 'move';
                        });

                        li.addEventListener('click', () => window.loadCaseById(caseItem.case_id));
                        list.appendChild(li);
                    });
                }

                header.addEventListener('click', (e) => {
                    if (e.target.closest('.folder-action-btn') || e.target.closest('.folder-drag-handle')) return;
                    bookshelfFolderState[folderName] = !isOpen;
                    renderBookshelf(casesArray);
                });

                const moveBtn = header.querySelector('.move-btn');
                if (moveBtn) {
                    moveBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.promptMoveFolderToSuperFolder(folderName);
                    });
                }

                const editBtn = header.querySelector('.edit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const newName = window.prompt("Neuer Name für den Ordner:", folderName);
                        if (newName && newName.trim() && newName.trim() !== folderName) {
                            renameFolder(folderName, newName.trim());
                        }
                    });
                }

                const deleteFolderBtn = header.querySelector('.delete-folder-btn');
                if (deleteFolderBtn) {
                    deleteFolderBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteFolder(folderName, casesInFolder.length);
                    });
                }

                folderDiv.addEventListener('dragstart', (e) => {
                    draggedItemState = { type: 'folder', name: folderName };
                    folderDiv.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });

                folderDiv.addEventListener('dragend', () => {
                    folderDiv.classList.remove('dragging');
                    draggedItemState = null;
                    document.querySelectorAll('.bookshelf-super-group').forEach(f => f.classList.remove('bookshelf-super-drag-over'));
                });

                folderDiv.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    folderDiv.classList.add('drag-over-folder');
                });

                folderDiv.addEventListener('dragleave', () => {
                    folderDiv.classList.remove('drag-over-folder');
                });

                folderDiv.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    folderDiv.classList.remove('drag-over-folder');

                    if (!draggedItemState) return;
                    if (draggedItemState.type === 'case') {
                        const caseId = draggedItemState.id;
                        if (caseId) await moveCaseToFolder(caseId, folderName);
                    } else if (draggedItemState.type === 'folder') {
                        const draggedFolder = draggedItemState.name;
                        if (draggedFolder && draggedFolder !== folderName) {
                            const targetSuper = getSuperFolderForCategory(folderName);
                            window.moveFolderToSuperFolder(draggedFolder, targetSuper);
                        }
                    }
                });

                folderDiv.appendChild(header);
                folderDiv.appendChild(list);
                superBody.appendChild(folderDiv);
            });
        }

        superDiv.appendChild(superHeader);
        superDiv.appendChild(superBody);
        bookshelfContainer.appendChild(superDiv);
    });
}

async function renameFolder(oldName, newName) {
    if (!newName || oldName === newName) return;

    let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
    let modified = false;

    customCases.forEach(c => {
        const cur = (c.folder_name || c.metadata?.medical_field || 'Allgemein').trim();
        if (cur === oldName) {
            c.folder_name = newName;
            c.updated_at = new Date().toISOString();
            modified = true;
        }
    });

    if (modified) {
        localStorage.setItem('custom_cases', JSON.stringify(customCases));
    }

    if (BUILTIN_DEMO_CASE.folder_name === oldName || (!BUILTIN_DEMO_CASE.folder_name && BUILTIN_DEMO_CASE.metadata?.medical_field === oldName)) {
        BUILTIN_DEMO_CASE.folder_name = newName;
    }

    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    const idx = order.indexOf(oldName);
    if (idx !== -1) order[idx] = newName;
    localStorage.setItem('medcheck_folder_order', JSON.stringify(order));

    if (bookshelfFolderState[oldName] !== undefined) {
        bookshelfFolderState[newName] = bookshelfFolderState[oldName];
        delete bookshelfFolderState[oldName];
    }

    const mapping = getFolderSuperMapping();
    if (mapping[oldName]) {
        mapping[newName] = mapping[oldName];
        delete mapping[oldName];
        saveFolderSuperMapping(mapping);
    }
    renderDashboardCases();
}

async function deleteFolder(folderName, caseCount) {
    const warning = caseCount > 0 
        ? `Ordner "${folderName}" wirklich löschen?\n\nDie darin enthaltenen ${caseCount} Fälle werden sicher in den Ordner "Allgemein" verschoben.`
        : `Möchtest du den leeren Ordner "${folderName}" wirklich löschen?`;

    if (!window.confirm(warning)) return;

    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    order = order.filter(name => name !== folderName);

    if (caseCount > 0 && !order.includes('Allgemein')) {
        order.push('Allgemein');
    }
    localStorage.setItem('medcheck_folder_order', JSON.stringify(order));

    let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
    let modified = false;

    customCases.forEach(c => {
        const cur = (c.folder_name || c.metadata?.medical_field || 'Allgemein').trim();
        if (cur === folderName) {
            c.folder_name = 'Allgemein';
            c.updated_at = new Date().toISOString();
            modified = true;
        }
    });

    if (modified) {
        localStorage.setItem('custom_cases', JSON.stringify(customCases));
    }

    if (BUILTIN_DEMO_CASE.folder_name === folderName) {
        BUILTIN_DEMO_CASE.folder_name = 'Allgemein';
    }

    delete bookshelfFolderState[folderName];

    const mapping = getFolderSuperMapping();
    if (mapping[folderName]) {
        delete mapping[folderName];
        saveFolderSuperMapping(mapping);
    }
    renderDashboardCases();
}

async function moveCaseToFolder(caseId, targetFolder) {
    let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
    let targetCase = customCases.find(c => c.case_id === caseId);

    if (targetCase) {
        targetCase.folder_name = targetFolder;
        targetCase.updated_at = new Date().toISOString();
        localStorage.setItem('custom_cases', JSON.stringify(customCases));
    } else if (caseId === BUILTIN_DEMO_CASE.case_id) {
        BUILTIN_DEMO_CASE.folder_name = targetFolder;
    }

    renderDashboardCases();
}

window.deleteCaseById = function(caseId) {
    if (caseId === BUILTIN_DEMO_CASE.case_id) return;

    let customCases = [];
    try { customCases = JSON.parse(localStorage.getItem('custom_cases')) || []; } catch (e) { customCases = []; }
    if (!Array.isArray(customCases)) customCases = [];

    const target = customCases.find(c => c.case_id === caseId);
    const title = target?.metadata?.title || caseId;
    if (!window.confirm(`Fall "${title}" wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) return;

    localStorage.setItem('custom_cases', JSON.stringify(customCases.filter(c => c.case_id !== caseId)));

    let solved = [];
    try { solved = JSON.parse(localStorage.getItem('solved_cases') || '[]'); } catch (e) { solved = []; }
    localStorage.setItem('solved_cases', JSON.stringify(solved.filter(id => id !== caseId)));

    if (window.Cloud && window.Cloud.isLoggedIn()) {
        window.Cloud.deleteCloudCase(caseId)
            .then(() => window.Cloud.scheduleProgressSync())
            .catch(err => alert(`Fall wurde lokal gelöscht, aber nicht online: ${err.message}`));
    }

    if (activeCaseData && activeCaseData.case_id === caseId) {
        activeCaseData = null;
        window.switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
    } else {
        renderDashboardCases();
    }
};

window.toggleFolder = function(category) {
    openFolders[category] = !openFolders[category];
    renderDashboardCases();
};

function getCustomCases() {
    try { return JSON.parse(localStorage.getItem('custom_cases')) || []; } catch (e) { return []; }
}

window.getRegisteredCases = function() {
    return [BUILTIN_DEMO_CASE, ...getCustomCases().filter(c => c.case_id !== BUILTIN_DEMO_CASE.case_id)];
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
    const specialtyMode = !!opts.specialty || !!window.isSpecialtyBlindMode;
    window.isSpecialtyBlindMode = specialtyMode;

    let targetCase = window.getRegisteredCases().find(c => c.case_id === caseId);

    if (!targetCase) { 
        alert("Fall nicht gefunden!"); 
        return; 
    }

    activeCaseData = JSON.parse(JSON.stringify(targetCase));
    window.registerCaseDDs(activeCaseData);
    if (specialtyMode) applySpecialtyFilters(activeCaseData);
    const saved = specialtyMode ? {} : (ProgressManager.getCaseProgress(caseId) || {});

    window.applyBlindHeader(specialtyMode, activeCaseData);

    if (!Array.isArray(activeCaseData.timeline)) activeCaseData.timeline = [];
    totalStepsCount = activeCaseData.timeline.length;
    clearedStepsCount = saved.audit?.clearedStepsCount || 0;

    const badgeAudit = document.getElementById('badge-mode-audit');
    if (badgeAudit) badgeAudit.innerText = `${clearedStepsCount}/${totalStepsCount}`;

    const tasks = activeCaseData.extra_tasks || {};
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
    window.switchPlayerMode(specialtyMode ? 'audit' : 'overview');
    window.checkFinalCompletion();
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
            <div class="cornell-header">
                <span style="font-size: 1.1rem;">📖</span>
                <h2>${escapeHtml(topicTitle)}</h2>
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
    if (topic && topic.length > 2) return topic;
    return 'Allgemein';
}

function autoAssignSuperFolder(folderName) {
    if (!folderName) return 'Allgemein';
    const clean = folderName.trim();
    const mapping = getFolderSuperMapping();
    if (mapping[clean] && superFolderStates[mapping[clean]] !== undefined) {
        return mapping[clean];
    }
    const lower = clean.toLowerCase();
    if (
        lower.includes('neuro') || lower.includes('nerv') || lower.includes('sinnes') ||
        lower.includes('auge') || lower.includes('ophthal') || lower.includes('hno') ||
        lower.includes('ohr') || lower.includes('myelon') || lower.includes('rückenmark') ||
        lower.includes('hirn') || lower.includes('cns') || lower.includes('zns') ||
        lower.includes('insult') || lower.includes('schwindel')
    ) {
        return 'Nervensystem und Sinnesorgane';
    }
    if (
        lower.includes('psych') || lower.includes('ethik') || lower.includes('recht') ||
        lower.includes('forens') || lower.includes('suizid') || lower.includes('depress') ||
        lower.includes('schizo') || lower.includes('bipolar') || lower.includes('delir')
    ) {
        return 'Psyche / Ethik / Recht';
    }
    if (
        lower.includes('repro') || lower.includes('gyn') || lower.includes('geburt') ||
        lower.includes('schwanger') || lower.includes('ovard') || lower.includes('mamma') ||
        lower.includes('uterus') || lower.includes('zyklus') || lower.includes('partus')
    ) {
        return 'Reproduktion';
    }
    return 'Allgemein';
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

        parsed.folder_name = document.getElementById('case-folder-input')?.value.trim() || resolveCaseFolderName(parsed);
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

window.addEventListener("cloudCasesSynced", () => {
    getCustomCases().forEach(window.registerCaseDDs);
    if (typeof renderDashboardCases === "function") {
        renderDashboardCases();
    }
    if (typeof window.renderSpecialtyHub === "function") {
        window.renderSpecialtyHub();
    }
});

function toggleSubjectDrawer() {
    const drawer = document.getElementById('subject-progress-drawer');
    if (!drawer) return;
    drawer.classList.toggle('collapsed');

    if (!drawer.classList.contains('collapsed')) {
        renderSubjectProgressDrawer();
    }
}

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

    if (typeof superFolderStates === 'object' && superFolderStates !== null) {
        Object.keys(superFolderStates).forEach(name => {
            superStats[name] = { total: 0, solved: 0 };
        });
    }

    ['Nervensystem und Sinnesorgane', 'Psyche / Ethik / Recht', 'Reproduktion', 'Allgemein'].forEach(name => {
        if (!superStats[name]) superStats[name] = { total: 0, solved: 0 };
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
            <div class="subject-item" style="cursor: pointer;" onclick="if(typeof window.selectSrFolder === 'function') window.selectSrFolder('${folderName.replace(/'/g, "\\'")}')" title="Klicken, um Spaced Repetition auf '${folderName}' zu filtern">
                <div class="subject-item-top">
                    <span class="subject-item-name" title="${escapeHtml(folderName)}">📁 ${escapeHtml(folderName)}</span>
                    <span class="subject-item-stats">${pct}% (${stats.solved}/${stats.total})</span>
                </div>
                <div class="subject-bar-track">
                    <div class="subject-bar-fill ${colorClass}" style="width: ${pct}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================================================
// DRAG & DROP AUTO-SCROLL ENGINE
// ==========================================================================
(function initDragAutoScroll() {
    const TOP_THRESHOLD = 180;
    const BOTTOM_THRESHOLD = 140;
    const BASE_SPEED = 8;
    const MAX_SCROLL_SPEED = 52;

    let isDraggingActive = false;
    let currentMouseY = -1;
    let currentMouseX = -1;
    let scrollFrameId = null;

    function getScrollContainer() {
        const mainWrapper = document.querySelector('.main-wrapper');
        if (mainWrapper && mainWrapper.scrollHeight > mainWrapper.clientHeight) {
            return mainWrapper;
        }
        return document.scrollingElement || document.documentElement || document.body;
    }

    function performAutoScroll() {
        if (!isDraggingActive) {
            scrollFrameId = null;
            return;
        }

        let bookshelfScrolled = false;
        const bookshelf = document.getElementById('bookshelf-container');
        if (bookshelf && bookshelf.scrollHeight > bookshelf.clientHeight && currentMouseX >= 0) {
            const rect = bookshelf.getBoundingClientRect();
            const inBookshelfX = currentMouseX >= rect.left && currentMouseX <= rect.right;
            const inBookshelfY = currentMouseY >= rect.top && currentMouseY <= rect.bottom;

            if (inBookshelfX && inBookshelfY) {
                const edgeZone = Math.min(80, rect.height * 0.28);
                if (currentMouseY < rect.top + edgeZone) {
                    const ratio = Math.max(0, (edgeZone - (currentMouseY - rect.top)) / edgeZone);
                    const speed = BASE_SPEED + Math.ceil((MAX_SCROLL_SPEED - BASE_SPEED) * (ratio * ratio));
                    bookshelf.scrollTop -= speed;
                    bookshelfScrolled = true;
                } else if (currentMouseY > rect.bottom - edgeZone) {
                    const ratio = Math.max(0, (currentMouseY - (rect.bottom - edgeZone)) / edgeZone);
                    const speed = BASE_SPEED + Math.ceil((MAX_SCROLL_SPEED - BASE_SPEED) * (ratio * ratio));
                    bookshelf.scrollTop -= speed;
                    bookshelfScrolled = true;
                }
            }
        }

        if (!bookshelfScrolled && currentMouseY >= 0) {
            const scrollTarget = getScrollContainer();
            const viewportHeight = window.innerHeight;
            const topbar = document.querySelector('topbar');
            const topbarBottom = topbar ? topbar.getBoundingClientRect().bottom : 70;
            const topScrollZone = topbarBottom + TOP_THRESHOLD;

            if (currentMouseY < topScrollZone) {
                const distanceInside = Math.max(0, topScrollZone - currentMouseY);
                const ratio = Math.min(1, distanceInside / TOP_THRESHOLD);
                const speed = BASE_SPEED + Math.ceil((MAX_SCROLL_SPEED - BASE_SPEED) * Math.pow(ratio, 1.5));

                if (scrollTarget === document.documentElement || scrollTarget === document.body) {
                    window.scrollBy(0, -speed);
                } else {
                    scrollTarget.scrollTop -= speed;
                }
            } else if (currentMouseY > viewportHeight - BOTTOM_THRESHOLD) {
                const distanceInside = Math.max(0, currentMouseY - (viewportHeight - BOTTOM_THRESHOLD));
                const ratio = Math.min(1, distanceInside / BOTTOM_THRESHOLD);
                const speed = BASE_SPEED + Math.ceil((MAX_SCROLL_SPEED - BASE_SPEED) * Math.pow(ratio, 1.5));

                if (scrollTarget === document.documentElement || scrollTarget === document.body) {
                    window.scrollBy(0, speed);
                } else {
                    scrollTarget.scrollTop -= speed;
                }
            }
        }

        scrollFrameId = requestAnimationFrame(performAutoScroll);
    }

    function updateCoordinates(e) {
        if (!isDraggingActive) return;
        currentMouseY = e.clientY;
        currentMouseX = e.clientX;
    }

    document.addEventListener('dragstart', (e) => {
        const isDraggableItem = e.target.closest('.case-card') || 
                               e.target.closest('.category-folder') || 
                               e.target.closest('.folder-case-item') || 
                               e.target.closest('.folder-group');

        if (isDraggableItem) {
            isDraggingActive = true;
            currentMouseY = e.clientY;
            currentMouseX = e.clientX;

            if (!scrollFrameId) {
                scrollFrameId = requestAnimationFrame(performAutoScroll);
            }
        }
    });

    window.addEventListener('dragover', updateCoordinates, { passive: true });
    document.addEventListener('drag', updateCoordinates, { passive: true });

    const stopAutoScroll = () => {
        isDraggingActive = false;
        currentMouseY = -1;
        currentMouseX = -1;
        if (scrollFrameId) {
            cancelAnimationFrame(scrollFrameId);
            scrollFrameId = null;
        }
    };

    document.addEventListener('dragend', stopAutoScroll);
    document.addEventListener('drop', stopAutoScroll);
})();

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

async function initCreatorHubAndCloudCases() {
    const sb = getActiveSupabaseClient();
    await loadCasesFromDatabase();

    if (!sb || !sb.auth) return;

    try {
        const { data: { session } } = await sb.auth.getSession();
        window.currentSessionUser = session?.user || null;
        setupCreatorHub(window.currentSessionUser);

        sb.auth.onAuthStateChange((_event, session) => {
            window.currentSessionUser = session?.user || null;
            setupCreatorHub(window.currentSessionUser);
            loadCasesFromDatabase();
        });
    } catch (e) {
        console.warn("Creator Hub Auth-Prüfung fehlgeschlagen:", e);
    }
}

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
            let modified = false;

            data.forEach(dbCase => {
                const cloudCase = dbCase.content;
                const idx = customCases.findIndex(c => (c.case_id || c.id) === (cloudCase.case_id || cloudCase.id));
                if (idx !== -1) {
                    customCases[idx] = cloudCase;
                } else {
                    customCases.push(cloudCase);
                    modified = true;
                }
                window.registerCaseDDs(cloudCase);
            });

            if (modified) {
                localStorage.setItem('custom_cases', JSON.stringify(customCases));
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
