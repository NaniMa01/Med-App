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

// Ansichts-Scope für die Stärken & Schwächen ('case' = dieser Fall, 'global' = alle)
let skillViewScope = 'case';

// DIE 3 OFFIZIELLEN MEDIZINISCHEN KERNKOMPETENZEN
const CANONICAL_SKILLS = [
    "Pathophysiologie und Risikofaktoren",
    "Diagnostik",
    "Therapie und Nachsorge"
];

// STATISCHE FALLDATEIEN AUS DEM CASES-ORDNER
const STATIC_CASE_FILES = [
    'cases/haemato_lymph_001.json',
    'cases/haemato_lymph_002.json',
    'cases/neuro_cjk_001.json',
    'cases/neuro_demenz_001.json',
    'cases/neuro_ftd_002_adv.json',
    'cases/neuro_ftd_ppa_002.json',
    'cases/neuro_lbd_audit_001.json'
];

function createBlankSkillSet() {
    return {
        "Pathophysiologie und Risikofaktoren": { hits: 0, total: 0 },
        "Diagnostik": { hits: 0, total: 0 },
        "Therapie und Nachsorge": { hits: 0, total: 0 }
    };
}

// INTELLIGENTES SMART-MAPPING FÜR ALTE & NEUE TAGS
window.mapSkillTag = function(skillTag) {
    if (!skillTag) return "Pathophysiologie und Risikofaktoren";
    const tag = String(skillTag).trim().toLowerCase();

    if (
        tag.includes('therap') || 
        tag.includes('pharm') || 
        tag.includes('nachsorge') || 
        tag.includes('management') || 
        tag.includes('treatment')
    ) {
        return "Therapie und Nachsorge";
    }

    if (
        tag.includes('diag') || 
        tag.includes('triage') || 
        tag.includes('labor') || 
        tag.includes('bildgebung') || 
        tag.includes('nachweis')
    ) {
        return "Diagnostik";
    }

    return "Pathophysiologie und Risikofaktoren";
};

// V6.0 BUILTIN DEMO CASE (Cornell Edition mit 3 Doctordle-Rätseln)
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
                "notes": "<strong>Vaskuläre Myelopathien:</strong><br>Oft durch eine <em>Aortendissektion</em> (Verlegung der A. radicularis magna) ausgelöst.<br>Führt zur Ischämie der ventralen Anteile."
            },
            {
                "cues": ["NMOSD", "LETM (≥3 Segmente)", "AQP4-IgG", "Wer? Meist Frauen", "Vorsicht: Kein Interferon!"],
                "notes": "<strong>Autoimmun-Demyelinisierend:</strong><br>Neuromyelitis-optica-Spektrum-Erkrankungen sind primär <em>Astrozytopathien</em>.<br>Diagnostisch beweisend ist eine longitudinale Myelitis."
            },
            {
                "cues": ["Funikuläre Myelose", "Lachgas (N2O)", "MMA erhöht", "Was? Spinale Ataxie"],
                "notes": "<strong>Metabolisch/Toxisch:</strong><br>Degeneration der Hinterstränge und kortikospinalen Bahnen.<br><em>Mechanismus:</em> Lachgas oxidiert das Cobalt-Ion im Vitamin B12."
            }
        ],
        "summary": "Die Triage von Myelopathien erfordert exakte Klinik: Perakuter Schmerz weist auf eine Ischämie hin, eine LETM mit Neutrophilie auf eine NMOSD. Funktionelle B12-Mängel (z. B. durch Lachgas) müssen rechtzeitig erkannt werden."
    },
    "timeline": [
        {
            "step_id": 1,
            "phase": "Akutphase Notfallstation (Vaskulär & Null-Fehler)",
            "content": "Eine 45-jährige Patientin erwacht nachts mit reissenden thorakolumbalen Schmerzen und einer schlaffen Paraparese. Die Untersuchung demonstriert einen Harnverhalt sowie eine [beidseitige dissoziierte Sensibilitätsstörung mit aufgehobenem Schmerz- und Temperaturempfinden bei erhaltenem Lagesinn]. Der Dienstarzt veranlasst [ein sofortiges Angio-CT von Thorax und Abdomen zum Ausschluss einer Aortendissektion]. Im späteren Verlauf zeigt sich im MRT das Bild eines [bilateralen T2-Hyperintensitätsmusters der Vorderhörner (Eulenaugen-Zeichen)].",
            "hotspots": [
                { "phrase": "beidseitige dissoziierte Sensibilitätsstörung mit aufgehobenem Schmerz- und Temperaturempfinden bei erhaltenem Lagesinn", "is_error": false, "skill_tag": "Diagnostik", "feedback": "Korrekt: Typisch für eine Läsion der vorderen 2/3 des Myelons (A. spinalis anterior)." },
                { "phrase": "ein sofortiges Angio-CT von Thorax und Abdomen zum Ausschluss einer Aortendissektion", "is_error": false, "skill_tag": "Diagnostik", "feedback": "Korrekt: Eine Aortendissektion ist ein lebensgefährlicher Trigger." },
                { "phrase": "bilateralen T2-Hyperintensitätsmusters der Vorderhörner (Eulenaugen-Zeichen)", "is_error": false, "skill_tag": "Diagnostik", "feedback": "Korrekt: Die stoffwechselaktiven Vorderhörner sind besonders ischämieanfällig." }
            ]
        },
        {
            "step_id": 2,
            "phase": "Autoimmun-entzündliche Differenzierung",
            "content": "Ein 77-jähriger Patient stellt sich mit einer subakuten Paraplegie ab T5 vor. Das Spine-MRT zeigt eine [longitudinale extensive transversale Myelitis (LETM) über 4 vertebrale Segmente]. Der Arzt vermutet den [primären Schub einer Multiplen Sklerose und initiiert eine Langzeittherapie mit Interferon-beta].",
            "hotspots": [
                { "phrase": "longitudinale extensive transversale Myelitis (LETM) über 4 vertebrale Segmente", "is_error": false, "skill_tag": "Diagnostik", "feedback": "Richtig: Eine Myelonläsion >3 Segmente spricht stark für NMOSD." },
                { "phrase": "primären Schub einer Multiplen Sklerose und initiiert eine Langzeittherapie mit Interferon-beta", "is_error": true, "skill_tag": "Therapie und Nachsorge", "socratic_trap": "Eine LETM ist sehr untypisch für MS. Was passiert bei NMOSD unter Interferon?", "feedback": "Fehler: Interferon-beta verschlechtert eine NMOSD potenziell massiv." }
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
                    "Stufe 1: Partygänger bemerkt seit 3 Wochen symmetrische Parästhesien an Händen/Füßen.",
                    "Stufe 2: Spinale Ataxie, erloschenes Vibrationsempfinden an beiden Malleoli.",
                    "Stufe 3: Serum-B12 grenzwertig normal, aber Methylmalonsäure (MMA) massiv erhöht.",
                    "Stufe 4: Regelmäßige Inhalation von Distickstoffmonoxid (Lachgas) am Wochenende.",
                    "Stufe 5: MRT Spine: T2-Hyperintensität der Hinterstränge ('Inverted V Sign').",
                    "Stufe 6: Irreversible Oxidation des zentralen Cobalt-Ions (Co+ zu Co+++)."
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
                "options": ["Kurzstreckige posterolaterale Läsion <1 Segment", "Longitudinale extensive transversale Myelitis (LETM) ≥3 Segmente", "Bilaterale Hyperintensität der Vorderhörner"],
                "correct_index": 1,
                "explanation": "Eine Läsionsausdehnung über 3 oder mehr Wirbelkörpersegmente (LETM) ist das radiologische Hauptkriterium der NMOSD."
            },
            {
                "question": "Ein 24-jähriger Patient zeigt eine spinale Ataxie. Welcher toxische Trigger führt funktionell zum gleichen klinischen Bild wie ein Vitamin-B12-Mangel?",
                "options": ["Chronischer Cannabis-Konsum", "Inhalation von Distickstoffmonoxid (Lachgas)", "Exzessiver Konsum von Energy-Drinks (Taurin)"],
                "correct_index": 1,
                "explanation": "Lachgas (N2O) oxidiert das zentrale Cobalt-Ion von Vitamin B12 und inaktiviert es irreversibel."
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
        if (!caseId) return;
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
        if (!caseId) return;
        const all = this.getAll();
        if (all[caseId] && all[caseId][challengeKey]) {
            delete all[caseId][challengeKey];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
        }
    },

    resetEntireCase(caseId) {
        if (!caseId) return;
        const all = this.getAll();
        delete all[caseId];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));

        // Aus gelösten Fällen austragen
        let solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
        solved = solved.filter(id => id !== caseId);
        localStorage.setItem('solved_cases', JSON.stringify(solved));

        // Auch fall-spezifische Skills für diesen Fall zurücksetzen
        let caseSkillsMap = JSON.parse(localStorage.getItem('medcheck_case_skills') || '{}');
        delete caseSkillsMap[caseId];
        localStorage.setItem('medcheck_case_skills', JSON.stringify(caseSkillsMap));
    }
};

window.saveChallengeProgress = function(challengeKey, data) {
    if (!activeCaseData) return;
    ProgressManager.saveCaseState(activeCaseData.case_id, {
        [challengeKey]: data
    });
};

// ====================================================
// INITIALISIERUNG & ASYNCHRONER PRELOADER
// ====================================================
document.addEventListener('DOMContentLoaded', () => {
    initUserData();
    renderSkillsSidebar();
    renderDashboardCases();
    preloadStaticCases(); // Lädt vorhandene JSON-Fälle aus /cases/ automatisch nach

    const addFolderBtn = document.getElementById('add-bookshelf-folder-btn');
    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', () => {
            const name = window.prompt("Name für den neuen Ordner:");
            if (name && name.trim()) {
                createNewFolder(name.trim());
            }
        });
    }
});

async function preloadStaticCases() {
    let customCases = [];
    try { customCases = JSON.parse(localStorage.getItem('custom_cases')) || []; } catch (e) { customCases = []; }
    const knownIds = new Set([BUILTIN_DEMO_CASE.case_id, ...customCases.map(c => c.case_id)]);

    let newlyAdded = false;
    for (const url of STATIC_CASE_FILES) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (data && data.case_id && !knownIds.has(data.case_id)) {
                customCases.push(data);
                knownIds.add(data.case_id);
                newlyAdded = true;
            }
        } catch (_fetchErr) {
            // Unkritisch (z.B. Offline-Betrieb oder reines file://-Protokoll)
        }
    }

    if (newlyAdded) {
        localStorage.setItem('custom_cases', JSON.stringify(customCases));
        renderDashboardCases();
    }
}

// ====================================================
// ALLGEMEINE UI & UTILS
// ====================================================
window.toggleSidebar = function() {
    const sidebar = document.querySelector('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// FORMATIERUNG: 50'000 XP (Schweizer Standard)
function formatXP(num) {
    return Number(num || 0).toLocaleString('de-CH');
}

function switchTab(tab, el) {
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
    
    const sidebar = document.querySelector('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    if (tab === 'dashboard') renderDashboardCases();
    renderSkillsSidebar();
}

window.switchPlayerMode = function(mode) {
    currentActiveChallenge = mode;

    document.querySelectorAll('.player-mode-pane').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.challenge-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const targetPane = document.getElementById('mode-container-' + mode) || document.getElementById('tab-pane-' + mode);
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
    if (tutorModal) tutorModal.style.display = 'block';
};

window.toggleSuperFolder = function() {
    superFolderOpen = !superFolderOpen;
    const container = document.getElementById('dashboard-folders-container');
    const arrow = document.getElementById('super-folder-arrow');
    if (container) container.style.display = superFolderOpen ? 'flex' : 'none';
    if (arrow) arrow.innerText = superFolderOpen ? '▼' : '▶';
};

// ====================================================
// STATS, XP, RÄNGE & FALL-SPEZIFISCHE KOMPETENZEN
// ====================================================
function initUserData() {
    if (!localStorage.getItem('user_xp')) localStorage.setItem('user_xp', '0');

    // Migration der alten Skills auf die 3 Säulen
    let rawSkills = JSON.parse(localStorage.getItem('user_skills') || 'null');
    let cleaned = createBlankSkillSet();

    if (rawSkills) {
        Object.entries(rawSkills).forEach(([tag, data]) => {
            const mapped = mapSkillTag(tag);
            cleaned[mapped].hits += (data.hits || 0);
            cleaned[mapped].total += (data.total || 0);
        });
    }
    localStorage.setItem('user_skills', JSON.stringify(cleaned));

    // KORRIGIERT: Valides leeres Objekt ohne Syntaxfehler
    if (!localStorage.getItem('medcheck_case_skills')) {
        localStorage.setItem('medcheck_case_skills', JSON.stringify({}));
    }

    try {
        let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
        if (window.MedicalDictionary && typeof window.MedicalDictionary.registerAllCases === 'function') {
            window.MedicalDictionary.registerAllCases([BUILTIN_DEMO_CASE, ...customCases]);
        }
    } catch (_dictErr) {}

    updateStatsUI();
}

// RANG-SYSTEM: 50'000 / 200'000 / 500'000 XP
function updateStatsUI() {
    const xp = parseInt(localStorage.getItem('user_xp') || '0', 10);
    const statXp = document.getElementById('stat-xp');
    if (statXp) statXp.innerText = formatXP(xp);

    let rank = 'Famulus';
    if (xp >= 500000) {
        rank = 'Chefarzt';
    } else if (xp >= 200000) {
        rank = 'Oberarzt';
    } else if (xp >= 50000) {
        rank = 'Assistenzarzt';
    }

    const statRank = document.getElementById('stat-rank');
    if (statRank) statRank.innerText = rank;
}

function applyXpDelta(delta, label) {
    let currentXp = Math.max(0, parseInt(localStorage.getItem('user_xp') || '0', 10) + delta);
    localStorage.setItem('user_xp', currentXp);
    updateStatsUI();
    if (window.Cloud) window.Cloud.scheduleProgressSync();

    const container = document.getElementById('hud-popup-container');
    if (!container) return;
    const popup = document.createElement('div');
    popup.className = `score-popup ${delta >= 0 ? 'positive' : 'negative'}`;
    popup.innerText = `${delta >= 0 ? '+' : ''}${formatXP(delta)} XP (${label})`;
    container.appendChild(popup);
    setTimeout(() => popup.remove(), 1400);
}

// TRACKING: Synchron in die globale Historie UND in den individuellen Fall
window.trackSkill = function(rawSkillTag, isHit) {
    const canonicalTag = mapSkillTag(rawSkillTag);

    // 1. Global tracken
    let globalSkills = JSON.parse(localStorage.getItem('user_skills') || 'null') || createBlankSkillSet();
    if (!globalSkills[canonicalTag]) globalSkills[canonicalTag] = { hits: 0, total: 0 };
    globalSkills[canonicalTag].total += 1;
    if (isHit) globalSkills[canonicalTag].hits += 1;
    localStorage.setItem('user_skills', JSON.stringify(globalSkills));

    // 2. Fall-spezifisch tracken
    if (activeCaseData && activeCaseData.case_id) {
        const caseId = activeCaseData.case_id;
        let caseSkillsMap = JSON.parse(localStorage.getItem('medcheck_case_skills') || '{}');
        if (!caseSkillsMap[caseId]) caseSkillsMap[caseId] = createBlankSkillSet();
        if (!caseSkillsMap[caseId][canonicalTag]) caseSkillsMap[caseId][canonicalTag] = { hits: 0, total: 0 };

        caseSkillsMap[caseId][canonicalTag].total += 1;
        if (isHit) caseSkillsMap[caseId][canonicalTag].hits += 1;

        localStorage.setItem('medcheck_case_skills', JSON.stringify(caseSkillsMap));
    }

    renderSkillsSidebar();
    if (window.Cloud) window.Cloud.scheduleProgressSync();
};

window.setSkillScope = function(scope) {
    skillViewScope = scope;
    renderSkillsSidebar();
};

function renderSkillsSidebar() {
    const container = document.getElementById('skills-sidebar-container');
    if (!container) return;

    const hasActiveCase = !!(activeCaseData && activeCaseData.case_id);
    const caseSkillsMap = JSON.parse(localStorage.getItem('medcheck_case_skills') || '{}');
    const globalSkills = JSON.parse(localStorage.getItem('user_skills') || 'null') || createBlankSkillSet();

    const currentScope = hasActiveCase ? skillViewScope : 'global';
    const activeCaseId = activeCaseData?.case_id;

    let skillsToDisplay;
    let scopeBadgeText = '';

    if (currentScope === 'case' && hasActiveCase) {
        skillsToDisplay = caseSkillsMap[activeCaseId] || createBlankSkillSet();
        const shortTitle = activeCaseData.metadata?.title ? (activeCaseData.metadata.title.slice(0, 20) + '...') : activeCaseId;
        scopeBadgeText = `Fall: ${shortTitle}`;
    } else {
        skillsToDisplay = globalSkills;
        scopeBadgeText = 'Gesamt-Profil';
    }

    const scopeToggleHtml = hasActiveCase ? `
        <div class="skill-scope-toggle">
            <button type="button" class="skill-scope-btn ${currentScope === 'case' ? 'active' : ''}" onclick="setSkillScope('case')">Dieser Fall</button>
            <button type="button" class="skill-scope-btn ${currentScope === 'global' ? 'active' : ''}" onclick="setSkillScope('global')">Gesamt</button>
        </div>
    ` : '';

    const barsHtml = CANONICAL_SKILLS.map(skill => {
        const data = skillsToDisplay[skill] || { hits: 0, total: 0 };
        const perc = data.total > 0 ? Math.round((data.hits / data.total) * 100) : 0;
        const color = data.total > 0 ? (perc < 50 ? 'var(--color-risk)' : (perc < 80 ? '#f59e0b' : 'var(--color-symptom)')) : 'var(--accent-blue)';
        return `
            <div style="margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:0.8rem; font-weight:700; margin-bottom:6px; gap:8px;">
                    <span style="overflow-wrap:break-word; word-break:break-word;">${skill}</span>
                    <span style="color:${color}; font-family:'JetBrains Mono'; white-space:nowrap;">${perc}% (${data.hits}/${data.total})</span>
                </div>
                <div style="background:rgba(6,9,19,0.7); height:7px; border-radius:10px; overflow:hidden;">
                    <div style="width:${perc}%; background:${color}; height:100%; transition:width 0.4s ease;"></div>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <span>Fokus:</span>
            <span style="color:var(--accent-cyan); font-weight:700;">${scopeBadgeText}</span>
        </div>
        ${scopeToggleHtml}
        ${barsHtml}
    `;
}

// ====================================================
// DASHBOARD & BOOKSHELF
// ====================================================
function renderDashboardCases() {
    let customCases = [];
    try { customCases = JSON.parse(localStorage.getItem('custom_cases')) || []; } catch (e) { customCases = []; }
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
                    <span style="color:${isSolved ? 'var(--color-symptom)' : (inProgress ? '#f59e0b' : 'var(--accent-blue)')}; font-weight:700;">
                        ${isSolved ? '✓ Gelöst' : (inProgress ? '↻ Angefangen' : '● Offen')}
                    </span>
                    <span>+${formatXP(c.metadata?.xp_reward || 900)} XP</span>
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
                <span class="folder-badge-mini" style="font-size:0.65rem; color:var(--accent-cyan); margin-left:auto; margin-right:4px; flex-shrink:0;">${solvedCount}/${casesInFolder.length}</span>
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
            emptyLi.style.cssText = 'font-size:0.72rem; color:var(--text-dim); padding:4px 6px; font-style:italic;';
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

    // Fall-Skills mitbereinigen
    let caseSkillsMap = JSON.parse(localStorage.getItem('medcheck_case_skills') || '{}');
    delete caseSkillsMap[caseId];
    localStorage.setItem('medcheck_case_skills', JSON.stringify(caseSkillsMap));

    if (window.Cloud && window.Cloud.isLoggedIn()) {
        window.Cloud.deleteCloudCase(caseId)
            .then(() => window.Cloud.scheduleProgressSync())
            .catch(err => alert(`Fall wurde lokal gelöscht, aber nicht online: ${err.message}`));
    }

    if (activeCaseData && activeCaseData.case_id === caseId) {
        activeCaseData = null;
        switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
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
window.loadCaseById = async function(caseId) {
    let customCases = [];
    try { customCases = JSON.parse(localStorage.getItem('custom_cases')) || []; } catch (e) { customCases = []; }
    let targetCase = [BUILTIN_DEMO_CASE, ...customCases].find(c => c.case_id === caseId);
    
    // Fallback: Falls der Fall aus einer Datei stammt und noch nicht im Speicher ist
    if (!targetCase) {
        for (const fileUrl of STATIC_CASE_FILES) {
            if (fileUrl.includes(caseId)) {
                try {
                    const res = await fetch(fileUrl);
                    if (res.ok) {
                        targetCase = await res.json();
                        customCases.push(targetCase);
                        localStorage.setItem('custom_cases', JSON.stringify(customCases));
                        break;
                    }
                } catch (_err) {}
            }
        }
    }

    if (!targetCase) { 
        alert("Fall nicht gefunden!"); 
        return; 
    }

    activeCaseData = JSON.parse(JSON.stringify(targetCase));
    const saved = ProgressManager.getCaseProgress(caseId) || {};
    
    const badgeTitle = document.getElementById('player-case-badge-title');
    if (badgeTitle) badgeTitle.innerText = activeCaseData.metadata?.title || activeCaseData.case_id;

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

    // Sidebar standardmäßig auf diesen Fall fokussieren
    skillViewScope = 'case';
    renderSkillsSidebar();

    switchTab('player', document.getElementById('nav-player'));
    switchPlayerMode('overview');
    checkFinalCompletion();
};

window.renderOverview = function() {
    const container = document.getElementById('overview-container');
    if (!container) return;

    const data = activeCaseData.case_overview;
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

    const html = `
        <div class="cornell-wrapper">
            <div class="cornell-header">
                <h2>${data.topic || 'Thematische Übersicht'}</h2>
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

        showForgeFeedback('feedback-success', 'Fall generiert. Bitte prüfen, ggf. anpassen und validieren.');
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
// ABSCHLUSS, DOCTORDLE & RESETS
// ====================================================
window.onDoctordlePuzzleSolved = function(solvedCount, totalCount) {
    solvedDoctordlePuzzles = solvedCount;
    totalDoctordlePuzzles = totalCount;
    const badge = document.getElementById('badge-mode-doctordle');
    if (badge) {
        if (solvedCount >= totalCount && totalCount > 0) {
            badge.innerText = 'Gelöst';
            badge.style.background = 'var(--color-symptom)';
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
    
    checkFinalCompletion();
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
    }
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
    
    alert('🎉 Gratulation! Alle Challenges gemeistert.');
    
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length > 0) switchTab('dashboard', navItems[0]);
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

    checkFinalCompletion();
};

window.resetCurrentCaseEntirely = function() {
    if (!activeCaseData) return;
    const title = activeCaseData.metadata?.title || activeCaseData.case_id;
    if (!window.confirm(`Gesamten Fall "${title}" komplett neu starten? Alle Teilergebnisse werden gelöscht.`)) return;

    ProgressManager.resetEntireCase(activeCaseData.case_id);
    window.loadCaseById(activeCaseData.case_id);
};
