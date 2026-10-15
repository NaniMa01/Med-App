// ====================================================
// GLOBALE STATES & KONFIGURATION
// ====================================================
let activeCaseData = null;
let currentActiveChallenge = 'overview';

// Challenge States
let selectedSynapses = [], totalSynapseDiseases = 0, solvedSynapseDiseases = 0, tilesPerDisease = 4;
let cascadesSolvedCount = 0, totalCascades = 0;
let categorizationSolved = false;
let quizSolved = false, userQuizAnswers = {};
let doctordleSolved = false, totalDoctordlePuzzles = 0, solvedDoctordlePuzzles = 0;
let clearedStepsCount = 0, totalStepsCount = 0;

// Dashboard & UI States
let openFolders = {};
let superFolderOpen = true;
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

// V6.0 BUILT-IN DEMO CASE (Cornell Edition mit 3 Doctordle-Rätseln)
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
                "notes": "<strong>Vaskuläre Myelopathien:</strong><br>Oft durch eine <em>Aortendissektion</em> (Verlegung der A. radicularis magna) ausgelöst.<br>Führt zur Ischämie der ventralen 2/3 des Myelons (Vorderhörner = Motorikausfall; Tractus spinothalamicus = Schmerz-/Temperaturausfall).<br><em>Warum bleibt der Lagesinn intakt?</em> Die Hinterstränge werden separat durch die posterioren Spinalarterien versorgt."
            },
            {
                "cues": ["NMOSD", "LETM (≥3 Segmente)", "AQP4-IgG", "Wer? Meist Frauen", "Vorsicht: Kein Interferon!"],
                "notes": "<strong>Autoimmun-Demyelinisierend:</strong><br>Neuromyelitis-optica-Spektrum-Erkrankungen sind primär <em>Astrozytopathien</em>. <br>Diagnostisch beweisend ist eine longitudinale extensive transversale Myelitis (LETM) im MRT sowie eine massive neutrophile Pleozytose (meist <em>ohne</em> oligoklonale Banden).<br>Normale MS-Basismedikation ist absolut kontraindiziert und triggert Schübe."
            },
            {
                "cues": ["Funikuläre Myelose", "Lachgas (N2O)", "MMA erhöht", "Was? Spinale Ataxie"],
                "notes": "<strong>Metabolisch/Toxisch:</strong><br>Degeneration der Hinterstränge und kortikospinalen Bahnen.<br><em>Mechanismus:</em> Lachgas oxidiert das Cobalt-Ion im Vitamin B12, was die Methionin-Synthase inaktiviert.<br><em>Marker:</em> Methylmalonsäure (MMA) ist massiv erhöht, selbst wenn der absolute B12-Wert im Serum noch normal erscheint."
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
        "doctordle": [
            {
                "puzzle_id": 1,
                "title": "Deduktion 1: Perakute spinale Symptomatik",
                "target_diagnosis": "Arteria-spinalis-anterior-Syndrom",
                "synonyms": ["A. spinalis anterior Syndrom", "Spinaler Insult", "Rückenmarksinfarkt", "Anteriore Myelonischämie"],
                "hints": [
                    "Stufe 1: 52-jähriger Patient erleidet perakut einschießende interskapuläre Schmerzen mit rascher Parese.",
                    "Stufe 2: Schlaffe Paraparese, dissoziierte Sensibilitätsstörung.",
                    "Stufe 3: D-Dimere leicht erhöht; Ausschluss GBS.",
                    "Stufe 4: CT-Angio zeigt Stanford-Typ-B-Dissektion (Verschluss A. radicularis magna).",
                    "Stufe 5: Spine-MRT zeigt T2-Hyperintensitäten in Vorderhörnern ('Eulenaugen-Zeichen').",
                    "Stufe 6: Perfusionsausfall der ventralen zwei Drittel des Myelons."
                ],
                "learning_pearl": "Die dissoziierte Sensibilitätsstörung beweist das Arteria-spinalis-anterior-Syndrom."
            },
            {
                "puzzle_id": 2,
                "title": "Deduktion 2: Subakute autoimmune Myelitis",
                "target_diagnosis": "Neuromyelitis-optica-Spektrum-Erkrankung",
                "synonyms": ["NMOSD", "Morbus Devic", "Devic-Syndrom", "Aquaporin-4-Autoimmunenzephalomyelitis"],
                "hints": [
                    "Stufe 1: Sehkraftverlust rechts gefolgt von progredienter Paraparese.",
                    "Stufe 2: Positiver Babinski, therapierefraktärer Schluckauf und Nausea.",
                    "Stufe 3: Pleozytose mit überwiegend neutrophilen Granulozyten, OKB negativ.",
                    "Stufe 4: Hochtiteriger Nachweis von Aquaporin-4-Antikörpern (AQP4-IgG).",
                    "Stufe 5: LETM über 4 Segmente sowie T2-Läsion in der Area postrema.",
                    "Stufe 6: Keine Remission unter Interferon-beta."
                ],
                "learning_pearl": "LETM (≥3 Segmente) + negative OKB + AQP4-IgG sichert die Diagnose NMOSD."
            },
            {
                "puzzle_id": 3,
                "title": "Deduktion 3: Metabolisch-toxische Ataxie",
                "target_diagnosis": "Funikuläre Myelose",
                "synonyms": ["Subakute kombinierte Degeneration", "Vitamin-B12-Mangel-Myelopathie", "Distickstoffmonoxid-induzierte Myelopathie", "Cobalamin-Mangelsyndrom"],
                "hints": [
                    "Stufe 1 (Initialpräsentation): 26-jähriger Partygänger bemerkt seit drei Wochen symmetrische Parästhesien ('Pelzigkeitsgefühl') an Händen und Füßen sowie Gangunsicherheit im Dunkeln.",
                    "Stufe 2 (Klinischer Status): Spinale Ataxie, erloschenes Vibrationsempfinden an beiden Malleoli (Pallhypästhesie 0/8), Pyramidenbahnzeichen positiv.",
                    "Stufe 3 (Spezifisches Labor): Serum-Vitamin-B12 grenzwertig normal, jedoch Methylmalonsäure (MMA) und Homocystein massiv erhöht.",
                    "Stufe 4 (Anamnestischer Trigger): Regelmäßige Inhalation von Distickstoffmonoxid (Lachgas, N2O) zur Entspannung am Wochenende.",
                    "Stufe 5 (MRT Spine): T2-Hyperintensität der dorsalen Kolumnen (Hinterstränge) mit typischem umgekehrtem V-Zeichen ('Inverted V Sign').",
                    "Stufe 6 (Pathophysiologie): Irreversible Oxidation des zentralen Cobalt-Ions (Co+ zu Co+++) führt zum Ausfall der Methionin-Synthase und Demyelinisierung der Hinterstränge."
                ],
                "learning_pearl": "Lachgas inaktiviert Vitamin B12 funktionell; MMA ist wegweisend erhöht."
            }
        ],
        "library_entries": [
            "Arteria-spinalis-anterior-Syndrom", "Spinaler Insult", "Neuromyelitis-optica-Spektrum-Erkrankung", "NMOSD", "Funikuläre Myelose", "Multiple Sklerose", "Spinales Epiduralhämatom"
        ],
        "master_quiz": [
            {
                "question": "Welcher Befund im Spinal-MRT spricht am ehesten für eine NMOSD und schließt eine klassische Multiple Sklerose weitgehend aus?",
                "options": ["Kurzstreckige posterolaterale Läsion <1 Segment", "Longitudinale extensive transversale Myelitis (LETM) ≥3 Segmente", "Bilaterale Hyperintensität der Vorderhörner (Eulenaugen-Zeichen)", "Symmetrisches umgekehrtes V-Zeichen der Hinterstränge"],
                "correct_index": 1,
                "explanation": "Eine Läsionsausdehnung über 3 oder mehr Wirbelkörpersegmente (LETM) ist das radiologische Hauptkriterium der NMOSD. Typische MS-Plaques sind meist kurzstreckig."
            },
            {
                "question": "Ein 24-jähriger Patient zeigt eine spinale Ataxie, Pallhypästhesie und gesteigerte Reflexe. Welcher toxische Trigger führt funktionell zum gleichen klinischen Bild wie eine klassische funikuläre Myelose?",
                "options": ["Chronischer Cannabis-Konsum", "Inhalation von Distickstoffmonoxid (Lachgas)", "Exzessiver Konsum von Energy-Drinks (Taurin)", "Systemische Corticosteroid-Langzeittherapie"],
                "correct_index": 1,
                "explanation": "Lachgas (N2O) oxidiert das zentrale Cobalt-Ion von Vitamin B12. Dies inaktiviert das Vitamin B12 intrazellulär irreversibel und führt zur Demyelinisierung der Hinterstränge."
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
    } catch (e) {
        console.error('DD-Pool Schreibfehler:', e);
    }
}

function loadDDLibrary() {
    try {
        const stored = JSON.parse(localStorage.getItem(DD_POOL_KEY) || '[]');
        if (Array.isArray(stored)) stored.forEach(addToDDLibrary);
    } catch (e) {
        console.error('DD-Pool Lesefehler:', e);
    }
}

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
            } catch (e) { /* fehlerhafte Datei ignorieren */ }
        }));
    } catch (e) { /* Manifest nicht verfügbar */ }
}

loadDDLibrary();

window.saveChallengeProgress = function(challengeKey, data) {
    if (!activeCaseData) return;
    ProgressManager.saveCaseState(activeCaseData.case_id, {
        [challengeKey]: data
    });
};

// ====================================================
// INITIALISIERUNG
// ====================================================
document.addEventListener('DOMContentLoaded', () => {
    initUserData();
    [BUILTIN_DEMO_CASE, ...getCustomCases()].forEach(window.registerCaseDDs);
    prefetchManifestDDs();
    renderSkillsSidebar();
    renderDashboardCases();
    if (typeof window.renderSpecialtyHub === 'function') {
        window.renderSpecialtyHub();
    }

    const addFolderBtn = document.getElementById('add-bookshelf-folder-btn');
    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', () => {
            const name = window.prompt("Name für den neuen Ordner:");
            if (name && name.trim()) {
                createNewFolder(name.trim());
            }
        });
    }

    // Event-Delegation für die Sticky-Steuerleiste
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest('#btn-next-specialty-case')) {
            window.nextSpecialtyCase();
        }
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
});

// ====================================================
// ALLGEMEINE UI & UTILS (INKL. VIEW TRANSITIONS & HAPTICS)
// ====================================================
window.triggerHaptic = function(ms = 8) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(ms); } catch (_e) {}
    }
};

window.toggleSidebar = function() {
    // BUGFIX: <sidebar> Tag wird jetzt zuverlässig gefunden
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
    const updateDOM = () => {
        document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
        if (el) el.classList.add('active');
        
        const showTab = (id, displayStyle) => {
            const element = document.getElementById(id);
            if (element) element.style.display = displayStyle;
        };

        showTab('dashboard-view', tab === 'dashboard' ? 'block' : 'none');
        showTab('player-view', tab === 'player' ? 'block' : 'none');
        showTab('forge-view', tab === 'forge' ? 'block' : 'none');
        showTab('settings-view', tab === 'settings' ? 'block' : 'none');
        showTab('nav-player', tab === 'player' ? 'flex' : 'none');
        
        const sidebar = document.querySelector('sidebar') || document.querySelector('.sidebar') || document.querySelector('aside');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');

        if (tab === 'dashboard') {
            window.isSpecialtyBlindMode = false;
            window.applyBlindHeader(false, null);
            renderDashboardCases();
            if (window.renderSpecialtyHub) window.renderSpecialtyHub();
        }
    };

    if (document.startViewTransition) {
        document.startViewTransition(updateDOM);
    } else {
        updateDOM();
    }
};

window.switchPlayerMode = function(mode) {
    currentActiveChallenge = mode;
    window.triggerHaptic(6);

    const updateModeDOM = () => {
        document.querySelectorAll('.player-mode-pane').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.challenge-tab-btn').forEach(btn => btn.classList.remove('active'));
        
        const targetPane = document.getElementById('mode-container-' + mode);
        const targetTab = document.getElementById('tab-btn-' + mode);
        if (targetPane) targetPane.style.display = 'block';
        if (targetTab) targetTab.classList.add('active');

        if (mode === 'doctordle' && window.initDoctordle && activeCaseData) {
            window.initDoctordle(activeCaseData);
        }
    };

    if (document.startViewTransition) {
        document.startViewTransition(updateModeDOM);
    } else {
        updateModeDOM();
    }
};

window.switchPlayerMode = function(mode) {
    currentActiveChallenge = mode;

    document.querySelectorAll('.player-mode-pane').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.challenge-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const targetPane = document.getElementById('mode-container-' + mode);
    const targetTab = document.getElementById('tab-btn-' + mode);
    if (targetPane) targetPane.style.display = 'block';
    if (targetTab) targetTab.classList.add('active');

    if (mode === 'doctordle' && window.initDoctordle && activeCaseData) {
        window.initDoctordle(activeCaseData);
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

window.toggleSuperFolder = function() {
    superFolderOpen = !superFolderOpen;
    const container = document.getElementById('dashboard-folders-container');
    const arrow = document.getElementById('super-folder-arrow');
    if (container) container.style.display = superFolderOpen ? 'flex' : 'none';
    if (arrow) arrow.innerText = superFolderOpen ? '▼' : '▶';
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

// Pfeil-Schrittfunktion: verbreitert (+) oder schmälert (-)
function stepSidebarWidth(deltaPx) {
    const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 260;
    setSidebarWidth(current + deltaPx);
}

function initSidebarResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    if (!resizer) return;

    // Gespeicherte Breite wiederherstellen
    const savedWidth = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (savedWidth) {
        setSidebarWidth(parseInt(savedWidth, 10));
    }

    let isDragging = false;

    resizer.addEventListener('mousedown', (e) => {
        // Klicks auf die Pfeil-Buttons nicht als Drag werten
        if (e.target.tagName === 'BUTTON') return;

        isDragging = true;
        document.body.classList.add('is-resizing');
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        // Die neue Breite entspricht der horizontalen Mausposition X
        setSidebarWidth(e.clientX);
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.classList.remove('is-resizing');
        }
    });
}

// Beim Start initialisieren
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
    const topicGrid = document.getElementById('topic-grid');
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
        if (topicGrid) topicGrid.style.display = 'block';
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

    // Shuffle queue (Fisher-Yates)
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
    // 1. Das Badge und den Container aus DEINEM HTML suchen
    const badge = document.getElementById('player-case-badge-title');
    const wrap = badge ? badge.parentElement : null;
    
    // Fachrichtung bestimmen
    let field = 'Fachrichtung';
    if (caseData && caseData.metadata && caseData.metadata.medical_field) {
        field = caseData.metadata.medical_field;
    } else if (caseData && caseData.folder_name) {
        field = caseData.folder_name;
    } else if (typeof specialtySession !== 'undefined' && specialtySession.field) {
        field = specialtySession.field;
    }

    if (wrap) {
        // Text anonymisieren ("Aktiver Fall:" ausblenden im Blind-Modus)
        wrap.classList.toggle('blind-mode-header', blind);
        if (wrap.firstChild && wrap.firstChild.nodeType === Node.TEXT_NODE) {
            wrap.firstChild.nodeValue = blind ? '' : 'Aktiver Fall: ';
        }

        // 2. DEN BUTTON "NEUER FALL" ERSTELLEN UND DIREKT EINHÄNGEN
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
            
            // Button rechts neben das Badge setzen
            wrap.appendChild(nextBtn);
            wrap.style.display = 'inline-flex';
            wrap.style.alignItems = 'center';
        }
        
        // Button nur im Fachrichtungs-Modus (blind = true) anzeigen
        nextBtn.style.display = blind ? 'inline-block' : 'none';
    }

    // 3. Titel des Badges setzen
    if (badge && caseData) {
        badge.innerText = blind ? `${field} • Training` : (caseData.metadata?.title || caseData.case_id);
    }

    // 4. Übersicht-Tab im Fachrichtungsmodus verstecken (Spoiler-Schutz)
    const overviewTab = document.getElementById('tab-btn-overview');
    if (overviewTab) {
        overviewTab.style.display = blind ? 'none' : '';
    }
};
window.SpecialtyEngine = {
    start: (s) => window.startSpecialtyMode(s),
    nextCase: () => window.nextSpecialtyCase()
};

// ====================================================
// DASHBOARD & BOOKSHELF
// ====================================================
function renderDashboardCases() {
    let customCases = getCustomCases();
    const solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    const container = document.getElementById('dashboard-folders-container');
    
    if (!container) return;

    let allCases = [BUILTIN_DEMO_CASE, ...customCases.filter(c => c.case_id !== BUILTIN_DEMO_CASE.case_id)];
    
    const grouped = {};
    allCases.forEach(c => {
        const cat = (c.folder_name || c.metadata?.medical_field || "Allgemeine Neurologie").trim();
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(c);
    });

    container.innerHTML = Object.entries(grouped).map(([category, cases], catIdx) => {
        const solvedCount = cases.filter(c => solved.includes(c.case_id)).length;
        const isExpanded = openFolders[category] !== undefined ? openFolders[category] : true;
        
        const cardsHtml = cases.map(c => {
            const isSolved = solved.includes(c.case_id);
            const savedState = ProgressManager.getCaseProgress(c.case_id);
            const inProgress = !isSolved && savedState && Object.keys(savedState).length > 0;
            
            const deleteBtn = c.case_id === BUILTIN_DEMO_CASE.case_id
                ? ''
                : '<button type="button" class="delete-case-btn" aria-label="Fall löschen" title="Fall löschen">×</button>';
            return `
            <div class="case-card ${inProgress ? 'in-progress' : ''}" data-case-id="${encodeURIComponent(c.case_id)}" role="button" tabindex="0">
                ${deleteBtn}
                <div>
                    <span class="tag">${c.metadata?.bloom_level || 'Evaluation'}</span>
                    <h3>${c.metadata?.title || c.case_id}</h3>
                </div>
                <div style="font-size:0.75rem; display:flex; justify-content:space-between; margin-top:10px;">
                    <span style="color:${isSolved ? 'var(--color-symptom, #10b981)' : (inProgress ? '#f59e0b' : 'var(--accent-blue, #38bdf8)')}; font-weight:700;">
                        ${isSolved ? '✓ Gelöst' : (inProgress ? '↻ Angefangen' : '● Offen')}
                    </span>
                    <span>+${c.metadata?.xp_reward || 900} XP</span>
                </div>
            </div>`;
        }).join('');

        return `
            <div class="category-folder">
                <div class="category-header" data-category="${encodeURIComponent(category)}">
                    <div class="category-title-wrap"><span class="category-arrow ${isExpanded ? 'expanded' : ''}" id="arrow-${catIdx}">▶</span><span>📁 ${category}</span></div>
                    <span class="category-badge">${solvedCount}/${cases.length} Gelöst</span>
                </div>
                <div class="category-cases-body" id="folder-body-${catIdx}" style="display:${isExpanded ? 'grid' : 'none'};">${cardsHtml}</div>
            </div>`;
    }).join('');

    container.querySelectorAll('.category-header[data-category]').forEach(header => {
        header.addEventListener('click', () => {
            toggleFolder(decodeURIComponent(header.dataset.category));
        });
    });

    container.querySelectorAll('.case-card[data-case-id]').forEach(card => {
        const caseId = decodeURIComponent(card.dataset.caseId);
        card.addEventListener('click', () => window.loadCaseById(caseId));
        card.addEventListener('keydown', event => {
            if (event.target !== card) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.loadCaseById(caseId);
            }
        });

        const deleteBtn = card.querySelector('.delete-case-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', event => {
                event.stopPropagation();
                window.deleteCaseById(caseId);
            });
        }
    });

    try {
        renderBookshelf(allCases);
    } catch (bsErr) {
        console.error("Bookshelf Fehler:", bsErr);
    }
}

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

    savedOrder.forEach(folderName => {
        const casesInFolder = folders[folderName] || [];
        const isOpen = bookshelfFolderState[folderName] !== undefined ? bookshelfFolderState[folderName] : true;
        const solvedCount = casesInFolder.filter(c => solved.includes(c.case_id)).length;

        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-group';
        folderDiv.dataset.folderName = folderName;
        folderDiv.draggable = true;

        const header = document.createElement('div');
        header.className = 'folder-header';
        header.innerHTML = `
            <div class="folder-header-left" style="display:flex; align-items:center; overflow:hidden; gap:6px; flex:1; min-width:0;">
                <span class="folder-drag-handle" title="Ordner ziehen zum Sortieren">⠿</span>
                <span class="folder-toggle-arrow ${isOpen ? 'open' : ''}">▶</span>
                <span class="folder-title-text" style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">📁 ${escapeHtml(folderName)}</span>
                <span class="folder-badge-mini" style="font-size:0.65rem; color:var(--accent-cyan, #38bdf8); margin-left:auto; margin-right:4px; flex-shrink:0;">${solvedCount}/${casesInFolder.length}</span>
            </div>
            <div style="display:flex; align-items:center; gap:2px; flex-shrink:0;">
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
            if (dragHoverTimer) clearTimeout(dragHoverTimer);
            document.querySelectorAll('.folder-group').forEach(f => f.classList.remove('drag-over-folder'));
        });

        folderDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            folderDiv.classList.add('drag-over-folder');

            if (draggedItemState && draggedItemState.type === 'case' && !isOpen && !dragHoverTimer) {
                dragHoverTimer = setTimeout(() => {
                    bookshelfFolderState[folderName] = true;
                    renderBookshelf(casesArray);
                }, 400);
            }
        });

        folderDiv.addEventListener('dragleave', () => {
            folderDiv.classList.remove('drag-over-folder');
            if (dragHoverTimer) {
                clearTimeout(dragHoverTimer);
                dragHoverTimer = null;
            }
        });

        folderDiv.addEventListener('drop', async (e) => {
            e.preventDefault();
            folderDiv.classList.remove('drag-over-folder');
            if (dragHoverTimer) {
                clearTimeout(dragHoverTimer);
                dragHoverTimer = null;
            }

            if (!draggedItemState) return;
            if (draggedItemState.type === 'case') {
                const caseId = draggedItemState.id;
                if (caseId) await moveCaseToFolder(caseId, folderName);
            } else if (draggedItemState.type === 'folder') {
                const draggedFolder = draggedItemState.name;
                if (draggedFolder && draggedFolder !== folderName) {
                    reorderFolders(draggedFolder, folderName);
                }
            }
        });

        folderDiv.appendChild(header);
        folderDiv.appendChild(list);
        bookshelfContainer.appendChild(folderDiv);
    });
}

function createNewFolder(folderName) {
    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    if (!order.includes(folderName)) {
        order.push(folderName);
        localStorage.setItem('medcheck_folder_order', JSON.stringify(order));
    }
    bookshelfFolderState[folderName] = true;
    renderDashboardCases();
}

function reorderFolders(draggedName, targetName) {
    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    const fromIdx = order.indexOf(draggedName);
    const toIdx = order.indexOf(targetName);

    if (fromIdx !== -1 && toIdx !== -1) {
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, draggedName);
        localStorage.setItem('medcheck_folder_order', JSON.stringify(order));
        renderDashboardCases();
    }
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

    if (typeof supabaseClient !== 'undefined' && window.currentSession) {
        try {
            await supabaseClient
                .from('medical_cases')
                .update({ folder_name: newName, updated_at: new Date().toISOString() })
                .eq('folder_name', oldName)
                .eq('user_id', window.currentSession.user.id);
        } catch (err) {
            console.error('Fehler bei Supabase Folder Update:', err);
        }
    }

    renderDashboardCases();
}

async function deleteFolder(folderName, caseCount) {
    const warning = caseCount > 0 
        ? `Ordner "${folderName}" wirklich löschen?\n\nDie darin enthaltenen ${caseCount} Fälle werden nicht gelöscht, sondern sicher in den Ordner "Allgemein" verschoben.`
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

    if (typeof supabaseClient !== 'undefined' && window.currentSession && caseCount > 0) {
        try {
            await supabaseClient
                .from('medical_cases')
                .update({ folder_name: 'Allgemein', updated_at: new Date().toISOString() })
                .eq('folder_name', folderName)
                .eq('user_id', window.currentSession.user.id);
        } catch (err) {
            console.error('Fehler beim Aktualisieren in Supabase nach Ordner-Löschung:', err);
        }
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

        if (typeof supabaseClient !== 'undefined' && window.currentSession) {
            try {
                await supabaseClient
                    .from('medical_cases')
                    .update({ folder_name: targetFolder, updated_at: new Date().toISOString() })
                    .eq('case_id', caseId)
                    .eq('user_id', window.currentSession.user.id);
            } catch (err) {
                console.error('Fehler beim Verschieben in Supabase:', err);
            }
        }
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
    openFolders[category] = openFolders[category] !== undefined ? !openFolders[category] : false;
    renderDashboardCases();
};

// ====================================================
// FALL LADEN & PLAYER LOGIK
// ====================================================
function getCustomCases() {
    try { return JSON.parse(localStorage.getItem('custom_cases')) || []; } catch (e) { return []; }
}

window.getRegisteredCases = function() {
    return [BUILTIN_DEMO_CASE, ...getCustomCases().filter(c => c.case_id !== BUILTIN_DEMO_CASE.case_id)];
};

function applySpecialtyFilters(caseData) {
    // 1. Audit strikt auf 3 Schritte begrenzen
    if (Array.isArray(caseData.timeline)) {
        caseData.timeline = caseData.timeline.slice(0, 3).map((step, idx) => ({
            ...step,
            step_id: idx + 1
        }));
    }

    const tasks = caseData.extra_tasks;
    if (!tasks) return;
    const primary = caseData.metadata?.primary_disease;

    // 2. Kaskaden auf 1 Kaskade reduzieren
    if (Array.isArray(tasks.clinical_cascades) && tasks.clinical_cascades.length) {
        const match = primary ? tasks.clinical_cascades.find(c => c.disease === primary) : null;
        tasks.clinical_cascades = [match || tasks.clinical_cascades[0]];
    }

    // 3. Quiz auf 1 Frage reduzieren
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
        data.cornell_notes.forEach(note => {
            const cuesArray = Array.isArray(note.cues) ? note.cues : [];
            notesHtml += `
                <div class="cornell-grid">
                    <div class="cornell-cues">
                        ${cuesArray.map(c => `<div class="cornell-cue-item">${c}</div>`).join('')}
                    </div>
                    <div class="cornell-notes">
                        ${note.notes || ''}
                    </div>
                </div>
            `;
        });
    }

    const topicTitle = window.isSpecialtyBlindMode ? "Klinisches Krankheitsbild (Blind-Training)" : (data.topic || 'Thematische Übersicht');

    const html = `
        <div class="cornell-wrapper">
            <div class="cornell-header">
                <h2>${topicTitle}</h2>
            </div>
            ${notesHtml}
            <div class="cornell-summary">
                <h4>Zusammenfassung (Take-Home Message)</h4>
                <p>${data.summary || 'Keine Zusammenfassung hinterlegt.'}</p>
            </div>
        </div>
    `;
    container.innerHTML = html;
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
    
    const allCompleted = stepsDone && synDone && casDone && categorizationSolved && quizSolved && docDone;
    
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

// Automatisches Neuladen des Dashboards, sobald Cloud-Fälle synchronisiert sind
window.addEventListener("cloudCasesSynced", () => {
    getCustomCases().forEach(window.registerCaseDDs);
    if (typeof renderDashboardCases === "function") {
        renderDashboardCases();
    }
    if (typeof window.renderSpecialtyHub === "function") {
        window.renderSpecialtyHub();
    }
});
// ====================================================
// SMARTPHONE CHALLENGE-MENÜ (Hochformat-Dropdown & Querformat-FAB)
// ====================================================
(function initMobileChallengePicker() {
    function syncMobileChallengePicker() {
        const navBar = document.querySelector('.challenge-nav-bar');
        if (!navBar) return;

        // 1. Hochformat-Dropdown synchronisieren
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
            return `<option value="${mode}" ${selected}>${label} ${badgeText ? '(' + badgeText + ')' : ''}</option>`;
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

        // 2. Querformat-FAB (Floating Action Button) synchronisieren
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
            
            // Toggle Logic für den FAB
            document.getElementById('landscape-fab-btn').addEventListener('click', () => {
                const menu = document.getElementById('landscape-fab-menu');
                const btn = document.getElementById('landscape-fab-btn');
                menu.classList.toggle('open');
                btn.classList.toggle('active');
                window.triggerHaptic(8);
            });
        }
        
        // FAB nur sichtbar schalten, wenn wir uns im "Player"-Modus befinden
        const playerView = document.getElementById('player-view');
        if (playerView && playerView.style.display !== 'none') {
            fabContainer.classList.add('visible');
        } else {
            fabContainer.classList.remove('visible');
            document.getElementById('landscape-fab-menu').classList.remove('open');
            document.getElementById('landscape-fab-btn').classList.remove('active');
        }

        // Menü-Punkte des FABs mit den aktiven Challenges befüllen
        const fabMenu = document.getElementById('landscape-fab-menu');
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

    // Hooks in die bestehenden Funktionen, damit UI synchron bleibt
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
            origSwitchTab(tab, el);
            setTimeout(syncMobileChallengePicker, 50);
        };
    }

    window.addEventListener('DOMContentLoaded', () => setTimeout(syncMobileChallengePicker, 200));
})();

// Ein- und Ausklappen des rechten Themen-Panels
function toggleSubjectDrawer() {
    const drawer = document.getElementById('subject-progress-drawer');
    if (!drawer) return;
    drawer.classList.toggle('collapsed');
    
    // Immer frisch berechnen, sobald man es aufklappt
    if (!drawer.classList.contains('collapsed')) {
        renderSubjectProgressDrawer();
    }
}

// Farbklasse nach Schwellenwert: <=32% Rot, 33-66% Orange, >=67% Grün
function getSubjectColorClass(pct) {
    if (pct <= 32) return 'bar-red';
    if (pct <= 66) return 'bar-orange';
    return 'bar-green';
}

// Liest dynamisch alle Themen/Überordner der App aus und berechnet den Fortschritt
function renderSubjectProgressDrawer() {
    const listEl = document.getElementById('dynamic-subjects-list');
    if (!listEl) return;

    const solvedIds = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    const folderStats = {};

    // 1. Alle Fälle sammeln (Standard-Bibliothek + Custom Cases)
    let allAvailableCases = [];
    if (typeof casesDatabase !== 'undefined' && Array.isArray(casesDatabase)) {
        allAvailableCases = [...casesDatabase];
    } else if (window.allCases && Array.isArray(window.allCases)) {
        allAvailableCases = [...window.allCases];
    } else {
        // Fallback: Custom Cases aus localStorage + DOM-Ordner auslesen
        const custom = JSON.parse(localStorage.getItem('custom_cases') || '[]');
        allAvailableCases = [...custom];
    }

    // 2. Falls Fälle im Speicher liegen, nach ihrem Überordner/Kategorie gruppieren
    allAvailableCases.forEach(c => {
        // Prüft die gängigen Felder deiner Fall-JSONs für Überordner/Themen
        const categoryName = c.folder || c.category || c.superFolder || c.topic || c.specialty || 'Allgemein';
        const caseId = c.id || c.case_id || c.title;

        if (!folderStats[categoryName]) {
            folderStats[categoryName] = { total: 0, solved: 0 };
        }
        folderStats[categoryName].total += 1;

        if (solvedIds.includes(caseId)) {
            folderStats[categoryName].solved += 1;
        }
    });

    // 3. Zusätzlich sichtbare Ordner aus dem Dashboard/Bookshelf prüfen (falls ein neuer Ordner noch 0 Fälle hat oder im DOM steht)
    document.querySelectorAll('.folder-card, .super-folder-title span, #existing-folders-list option').forEach(el => {
        const name = (el.value || el.textContent || '').trim();
        if (name && !folderStats[name] && name !== 'Lade Fall-Bibliothek...') {
            folderStats[name] = { total: 0, solved: 0 };
        }
    });

    const entries = Object.entries(folderStats);

    if (entries.length === 0) {
        listEl.innerHTML = `<div style="font-size:0.75rem; color:var(--text-dim); text-align:center; padding:12px 0;">Noch keine Themen-Ordner geladen.</div>`;
        return;
    }

    // Sortieren: Schwächste Fächer (Rot) nach oben, damit man sofort sieht, wo man lernen muss!
    entries.sort((a, b) => {
        const pctA = a[1].total > 0 ? (a[1].solved / a[1].total) * 100 : 0;
        const pctB = b[1].total > 0 ? (b[1].solved / b[1].total) * 100 : 0;
        return pctA - pctB;
    });

    listEl.innerHTML = entries.map(([folderName, stats]) => {
        const pct = stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0;
        const colorClass = getSubjectColorClass(pct);

        return `
            <div class="subject-item">
                <div class="subject-item-top">
                    <span class="subject-item-name" title="${folderName}">${folderName}</span>
                    <span class="subject-item-stats">${pct}% (${stats.solved}/${stats.total})</span>
                </div>
                <div class="subject-bar-track">
                    <div class="subject-bar-fill ${colorClass}" style="width: ${pct}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Initial einmal beim Laden vorbereiten
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(renderSubjectProgressDrawer, 500);
});

// ==========================================
// THEME ENGINE (FARBLAYOUT WECHSELN)
// ==========================================

const THEME_STORAGE_KEY = 'medcheck_ui_theme';

const THEME_META_COLORS = {
    midnight: '#060913',
    daylight: '#f1f5f9',
    scrubs:   '#04110f',
    neuro:    '#090614'
};

function applyAppTheme(themeName) {
    const validTheme = THEME_META_COLORS[themeName] ? themeName : 'midnight';

    // 1. Attribut auf <html> setzen (steuert alle CSS-Variablen)
    if (validTheme === 'midnight') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', validTheme);
    }

    // 2. Meta-Theme-Color für Mobile/PWA Statusbar aktualisieren
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', THEME_META_COLORS[validTheme]);
    }

    // 3. Aktiven Status auf den Einstellungs-Karten setzen
    document.querySelectorAll('.theme-card').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme-value') === validTheme);
    });

    // 4. Dauerhaft im Browser speichern
    localStorage.setItem(THEME_STORAGE_KEY, validTheme);
}

// Beim Laden der Seite sofort das gespeicherte Theme aktivieren
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'midnight';
    applyAppTheme(savedTheme);
});
