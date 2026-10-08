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

// V6.0 BUILTIN DEMO CASE
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
            }
        ],
        "master_quiz": [
            {
                "question": "Welcher Befund im Spinal-MRT spricht am ehesten für eine NMOSD und schließt eine klassische Multiple Sklerose weitgehend aus?",
                "options": ["Kurzstreckige posterolaterale Läsion <1 Segment", "Longitudinale extensive transversale Myelitis (LETM) ≥3 Segmente", "Bilaterale Hyperintensität der Vorderhörner"],
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
        try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {}; } 
        catch (e) { return {}; }
    },

    getCaseProgress(caseId) {
        if (!caseId) return null;
        return this.getAll()[caseId] || null;
    },

    saveCaseState(caseId, partialState) {
        if (!caseId) return;
        const all = this.getAll();
        all[caseId] = { ...(all[caseId] || {}), ...partialState, updatedAt: Date.now() };
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all)); } catch (e) {}
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

        let solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
        solved = solved.filter(id => id !== caseId);
        localStorage.setItem('solved_cases', JSON.stringify(solved));

        // Fallspezifische Skills zurücksetzen
        let caseSkillsMap = JSON.parse(localStorage.getItem('medcheck_case_skills') || '{}');
        delete caseSkillsMap[caseId];
        localStorage.setItem('medcheck_case_skills', JSON.stringify(caseSkillsMap));
    }
};

window.saveChallengeProgress = function(challengeKey, data) {
    if (!activeCaseData) return;
    ProgressManager.saveCaseState(activeCaseData.case_id, { [challengeKey]: data });
};

// ====================================================
// INITIALISIERUNG
// ====================================================
document.addEventListener('DOMContentLoaded', () => {
    initUserData();
    renderSkillsSidebar();
    renderDashboardCases();
    preloadStaticCases();

    const addFolderBtn = document.getElementById('add-bookshelf-folder-btn');
    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', () => {
            const name = window.prompt("Name für den neuen Ordner:");
            if (name && name.trim()) createNewFolder(name.trim());
        });
    }
});

async function preloadStaticCases() {
    let customCases = [];
    try { customCases = JSON.parse(localStorage.getItem('custom_cases')) || []; } catch (e) { customCases = []; }
    let modified = false;

    for (const url of STATIC_CASE_FILES) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (data && data.case_id) {
                const idx = customCases.findIndex(c => c.case_id === data.case_id);
                if (idx === -1) {
                    customCases.push(data);
                    modified = true;
                } else {
                    // Update falls Datei auf der Festplatte vollständiger ist
                    const cur = customCases[idx];
                    const curTasks = Object.keys(cur.extra_tasks || {}).length;
                    const newTasks = Object.keys(data.extra_tasks || {}).length;
                    if (newTasks > curTasks || (!cur.case_overview && data.case_overview)) {
                        customCases[idx] = { ...cur, ...data };
                        modified = true;
                    }
                }
            }
        } catch (_err) {}
    }

    if (modified) {
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
    
    const targetPane = document.getElementById('mode-container-' + mode) 
                    || document.getElementById('tab-pane-' + mode)
                    || document.getElementById(mode + '-container')
                    || document.getElementById('container-' + mode);

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
// STATS, XP & FALLSPEZIFISCHE KOMPETENZEN (SIDEBAR RECHTS)
// ====================================================
function initUserData() {
    if (!localStorage.getItem('user_xp')) localStorage.setItem('user_xp', '0');

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

// 50'000 / 200'000 / 500'000 XP
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

// IMMER FALLSPEZIFISCH + GLOBAL IM HINTERGRUND
window.trackSkill = function(rawSkillTag, isHit) {
    const canonicalTag = mapSkillTag(rawSkillTag);

    // 1. Global
    let globalSkills = JSON.parse(localStorage.getItem('user_skills') || 'null') || createBlankSkillSet();
    if (!globalSkills[canonicalTag]) globalSkills[canonicalTag] = { hits: 0, total: 0 };
    globalSkills[canonicalTag].total += 1;
    if (isHit) globalSkills[canonicalTag].hits += 1;
    localStorage.setItem('user_skills', JSON.stringify(globalSkills));

    // 2. Fallspezifisch
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

function renderSkillsSidebar() {
    const container = document.getElementById('skills-sidebar-container');
    if (!container) return;

    const hasActiveCase = !!(activeCaseData && activeCaseData.case_id);
    const caseSkillsMap = JSON.parse(localStorage.getItem('medcheck_case_skills') || '{}');
    const globalSkills = JSON.parse(localStorage.getItem('user_skills') || 'null') || createBlankSkillSet();

    let skillsToDisplay;
    let badgeText;

    if (hasActiveCase) {
        skillsToDisplay = caseSkillsMap[activeCaseData.case_id] || createBlankSkillSet();
        const shortTitle = activeCaseData.metadata?.title 
            ? (activeCaseData.metadata.title.length > 20 ? activeCaseData.metadata.title.slice(0, 18) + '…' : activeCaseData.metadata.title)
            : activeCaseData.case_id;
        badgeText = `Fall: ${shortTitle}`;
    } else {
        skillsToDisplay = globalSkills;
        badgeText = 'Gesamt-Profil';
    }

    const barsHtml = CANONICAL_SKILLS.map(skill => {
        const data = skillsToDisplay[skill] || { hits: 0, total: 0 };
        const perc = data.total > 0 ? Math.round((data.hits / data.total) * 100) : 0;
        const color = data.total > 0 ? (perc < 50 ? 'var(--color-risk)' : (perc < 80 ? '#f59e0b' : 'var(--color-symptom)')) : 'var(--accent-blue)';
        
        return `
            <div style="margin-bottom: 13px;">
                <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:0.77rem; font-weight:700; margin-bottom:5px; gap:6px;">
                    <span style="overflow-wrap:break-word; word-break:break-word; line-height:1.25; color:#e2e8f0;">${escapeHtml(skill)}</span>
                    <span style="color:${color}; font-family:'JetBrains Mono', monospace; font-size:0.75rem; white-space:nowrap; flex-shrink:0;">${perc}% (${data.hits}/${data.total})</span>
                </div>
                <div style="background:rgba(6,9,19,0.7); height:6px; border-radius:10px; overflow:hidden;">
                    <div style="width:${perc}%; background:${color}; height:100%; border-radius:10px; transition:width 0.4s ease;"></div>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div style="font-size:0.68rem; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:8px;">
            <span>Fokus</span>
            <span style="color:var(--accent-cyan); font-weight:700; font-family:'JetBrains Mono', monospace; text-transform:none; max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${hasActiveCase ? escapeHtml(activeCaseData.metadata?.title || activeCaseData.case_id) : 'Gesamt'}">${badgeText}</span>
        </div>
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

    try { renderBookshelf(allCases); } catch (bsErr) {}
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
            <div class="folder-header-left">
                <span class="folder-drag-handle" title="Ordner ziehen">⠿</span>
                <span class="folder-toggle-arrow ${isOpen ? 'open' : ''}">▶</span>
                <span class="folder-title-text">📁 ${escapeHtml(folderName)}</span>
                <span class="folder-badge-mini">${solvedCount}/${casesInFolder.length}</span>
            </div>
            <div style="display:flex; align-items:center; gap:2px; flex-shrink:0;">
                <button type="button" class="folder-action-btn edit-btn" title="Umbenennen">✏️</button>
                <button type="button" class="folder-action-btn delete-folder-btn" title="Löschen">🗑️</button>
            </div>
        `;

        const list = document.createElement('ul');
        list.className = `folder-cases-list ${isOpen ? '' : 'collapsed'}`;

        if (casesInFolder.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.style.cssText = 'font-size:0.72rem; color:var(--text-dim); padding:4px 6px; font-style:italic;';
            emptyLi.textContent = 'Ordner ist leer';
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
                const newName = window.prompt("Neuer Name:", folderName);
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
        });

        folderDiv.addEventListener('dragend', () => {
            folderDiv.classList.remove('dragging');
            draggedItemState = null;
            document.querySelectorAll('.folder-group').forEach(f => f.classList.remove('drag-over-folder'));
        });

        folderDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
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
                await moveCaseToFolder(draggedItemState.id, folderName);
            } else if (draggedItemState.type === 'folder' && draggedItemState.name !== folderName) {
                reorderFolders(draggedItemState.name, folderName);
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
    customCases.forEach(c => {
        if ((c.folder_name || c.metadata?.medical_field || 'Allgemein').trim() === oldName) {
            c.folder_name = newName;
        }
    });
    localStorage.setItem('custom_cases', JSON.stringify(customCases));

    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    const idx = order.indexOf(oldName);
    if (idx !== -1) order[idx] = newName;
    localStorage.setItem('medcheck_folder_order', JSON.stringify(order));

    renderDashboardCases();
}

async function deleteFolder(folderName, caseCount) {
    if (!window.confirm(`Ordner "${folderName}" wirklich löschen?`)) return;
    let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
    order = order.filter(name => name !== folderName);
    if (caseCount > 0 && !order.includes('Allgemein')) order.push('Allgemein');
    localStorage.setItem('medcheck_folder_order', JSON.stringify(order));

    let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
    customCases.forEach(c => {
        if ((c.folder_name || c.metadata?.medical_field || 'Allgemein').trim() === folderName) {
            c.folder_name = 'Allgemein';
        }
    });
    localStorage.setItem('custom_cases', JSON.stringify(customCases));
    renderDashboardCases();
}

async function moveCaseToFolder(caseId, targetFolder) {
    let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
    let target = customCases.find(c => c.case_id === caseId);
    if (target) {
        target.folder_name = targetFolder;
        localStorage.setItem('custom_cases', JSON.stringify(customCases));
    }
    renderDashboardCases();
}

window.deleteCaseById = function(caseId) {
    if (caseId === BUILTIN_DEMO_CASE.case_id) return;
    let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
    const target = customCases.find(c => c.case_id === caseId);
    if (!window.confirm(`Fall "${target?.metadata?.title || caseId}" löschen?`)) return;

    localStorage.setItem('custom_cases', JSON.stringify(customCases.filter(c => c.case_id !== caseId)));
    let solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    localStorage.setItem('solved_cases', JSON.stringify(solved.filter(id => id !== caseId)));

    let caseSkillsMap = JSON.parse(localStorage.getItem('medcheck_case_skills') || '{}');
    delete caseSkillsMap[caseId];
    localStorage.setItem('medcheck_case_skills', JSON.stringify(caseSkillsMap));

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
// RESILIENTER FALL-LOADER & CHALLENGE-NORMALISIERER
// ====================================================
window.loadCaseById = async function(caseId) {
    let customCases = [];
    try { customCases = JSON.parse(localStorage.getItem('custom_cases')) || []; } catch (e) { customCases = []; }
    let targetCase = [BUILTIN_DEMO_CASE, ...customCases].find(c => c.case_id === caseId);
    
    // Fallback: Falls Fall auf der Festplatte liegt, aber noch nicht im LocalStorage ist
    if (!targetCase) {
        for (const fileUrl of STATIC_CASE_FILES) {
            try {
                const res = await fetch(fileUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.case_id === caseId) {
                        targetCase = data;
                        customCases.push(data);
                        localStorage.setItem('custom_cases', JSON.stringify(customCases));
                        break;
                    }
                }
            } catch (_err) {}
        }
    }

    if (!targetCase) { 
        alert("Fall nicht gefunden!"); 
        return; 
    }

    activeCaseData = JSON.parse(JSON.stringify(targetCase));

    // ==========================================================
    // CRITICAL FIX: NORMALISIERUNG VON ROOT-LEVEL & EXTRA_TASKS
    // ==========================================================
    const rawExtra = activeCaseData.extra_tasks || {};
    activeCaseData.extra_tasks = {
        ...rawExtra,
        synapses_matrix: rawExtra.synapses_matrix || activeCaseData.synapses_matrix || rawExtra.synapses || activeCaseData.synapses,
        clinical_cascades: rawExtra.clinical_cascades || activeCaseData.clinical_cascades || rawExtra.cascades || activeCaseData.cascades,
        categorization: rawExtra.categorization || activeCaseData.categorization || rawExtra.taxonomy || activeCaseData.taxonomy,
        master_quiz: rawExtra.master_quiz || activeCaseData.master_quiz || rawExtra.quiz || activeCaseData.quiz,
        doctordle: rawExtra.doctordle || activeCaseData.doctordle || rawExtra.deduction || activeCaseData.deduction,
        library_entries: rawExtra.library_entries || activeCaseData.library_entries
    };

    if (!activeCaseData.case_overview) {
        activeCaseData.case_overview = activeCaseData.overview || activeCaseData.theory || activeCaseData.briefing;
        if (!activeCaseData.case_overview && activeCaseData.cornell_notes) {
            activeCaseData.case_overview = {
                topic: activeCaseData.metadata?.title || 'Thematische Übersicht',
                cornell_notes: activeCaseData.cornell_notes,
                summary: activeCaseData.summary || ''
            };
        }
    }

    const saved = ProgressManager.getCaseProgress(caseId) || {};
    
    const badgeTitle = document.getElementById('player-case-badge-title');
    if (badgeTitle) badgeTitle.innerText = activeCaseData.metadata?.title || activeCaseData.case_id;

    if (!Array.isArray(activeCaseData.timeline)) activeCaseData.timeline = [];
    totalStepsCount = activeCaseData.timeline.length;
    clearedStepsCount = saved.audit?.clearedStepsCount || 0;
    
    const badgeAudit = document.getElementById('badge-mode-audit');
    if (badgeAudit) badgeAudit.innerText = `${clearedStepsCount}/${totalStepsCount}`;

    // CHALLENGE-ANWESENHEIT GENAU PRÜFEN
    const syn = activeCaseData.extra_tasks.synapses_matrix;
    const hasSyn = !!(syn && ((syn.variables && syn.variables.length > 0) || (syn.diseases && syn.diseases.length > 0)));

    const cas = activeCaseData.extra_tasks.clinical_cascades;
    const hasCas = !!(cas && (Array.isArray(cas) ? cas.length > 0 : Object.keys(cas).length > 0));

    const cat = activeCaseData.extra_tasks.categorization;
    const hasCat = !!(cat && (cat.items?.length > 0 || cat.categories?.length > 0));

    const quiz = activeCaseData.extra_tasks.master_quiz;
    const hasQuiz = !!(quiz && Array.isArray(quiz) && quiz.length > 0);

    const doc = activeCaseData.extra_tasks.doctordle;
    const hasDoc = !!(doc && (Array.isArray(doc) ? doc.length > 0 : !!doc.hints));

    const show = (id, on) => { 
        const el = document.getElementById(id); 
        if (el) el.style.display = on ? 'inline-flex' : 'none'; 
    };

    show('tab-btn-synapses', hasSyn);
    show('tab-btn-cascade', hasCas);
    show('tab-btn-cat', hasCat);
    show('tab-btn-quiz', hasQuiz);
    show('tab-btn-doctordle', hasDoc);

    totalSynapseDiseases = hasSyn ? (syn.diseases?.length || 4) : 0;
    solvedSynapseDiseases = saved.synapses?.solvedCount || 0;

    totalCascades = hasCas ? (Array.isArray(cas) ? cas.length : 1) : 0;
    cascadesSolvedCount = saved.cascades?.solvedCount || 0;

    categorizationSolved = !hasCat || !!saved.categorization?.solved;
    quizSolved = !hasQuiz || !!saved.quiz?.solved;
    userQuizAnswers = saved.quiz?.answers || {};

    if (hasDoc) {
        totalDoctordlePuzzles = Array.isArray(doc) ? doc.length : 1;
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
    if (hasDoc && window.initDoctordle) safely('Doctordle', () => window.initDoctordle(activeCaseData));

    renderSkillsSidebar();

    switchTab('player', document.getElementById('nav-player'));
    switchPlayerMode('overview');
    checkFinalCompletion();
};

window.renderOverview = function() {
    const container = document.getElementById('overview-container');
    if (!container) return;

    const data = activeCaseData.case_overview;
    
    // 1. Wenn Cornell Notes existieren
    if (data && Array.isArray(data.cornell_notes) && data.cornell_notes.length > 0) {
        const notesHtml = data.cornell_notes.map(note => {
            const cuesArray = Array.isArray(note.cues) ? note.cues : (note.cues ? [note.cues] : []);
            return `
                <div class="cornell-grid">
                    <div class="cornell-cues">
                        ${cuesArray.map(c => `<div class="cornell-cue-item">${escapeHtml(c)}</div>`).join('')}
                    </div>
                    <div class="cornell-notes">
                        ${note.notes || ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="cornell-wrapper">
                <div class="cornell-header">
                    <h2>${escapeHtml(data.topic || activeCaseData.metadata?.title || 'Thematische Übersicht')}</h2>
                </div>
                ${notesHtml}
                <div class="cornell-summary">
                    <h4>Zusammenfassung (Take-Home Message)</h4>
                    <p>${escapeHtml(data.summary || 'Keine Zusammenfassung hinterlegt.')}</p>
                </div>
            </div>
        `;
        return;
    }

    // 2. Eleganter Fallback für Vignette / Text
    const fallbackText = data?.summary || data?.description || activeCaseData.metadata?.description || activeCaseData.metadata?.title;
    container.innerHTML = `
        <div class="cornell-wrapper">
            <div class="cornell-header">
                <h2>${escapeHtml(activeCaseData.metadata?.title || 'Klinische Fallübersicht')}</h2>
            </div>
            <div style="padding: 22px; font-size: 0.92rem; line-height: 1.7; color: var(--text-main);">
                <p style="margin-bottom: 12px;"><strong>Fachbereich:</strong> ${escapeHtml(activeCaseData.metadata?.medical_field || 'Allgemeine Medizin')}</p>
                <p style="color: var(--text-muted);">${escapeHtml(fallbackText)}</p>
                <div style="margin-top: 18px; padding: 12px; border-radius: 8px; background: rgba(56, 189, 248, 0.08); border-left: 3px solid var(--accent-blue); font-size: 0.85rem;">
                    💡 <em>Hinweis:</em> Keine separaten Cornell-Notizen vorhanden. Wechsle direkt oben in das <strong>Audit</strong> oder die weiteren <strong>Challenges</strong>!
                </div>
            </div>
        </div>
    `;
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
    return rawValue.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

window.validateAndSaveCustomCase = function() {
    const inputEl = document.getElementById('forge-input');
    if (!inputEl) return;
    const rawVal = inputEl.value.trim();
    if (!rawVal) return showForgeFeedback('feedback-error', 'Bitte JSON einfügen.');

    try {
        const sanitized = sanitizeForgeJsonInput(rawVal);
        const parsed = JSON.parse(sanitized);

        if (!parsed.case_id) throw new Error('case_id fehlt.');
        if (!Array.isArray(parsed.timeline)) throw new Error('timeline Array fehlt.');

        let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
        customCases = customCases.filter(c => c.case_id !== parsed.case_id);
        customCases.push(parsed);
        localStorage.setItem('custom_cases', JSON.stringify(customCases));

        showForgeFeedback('feedback-success', `Fall "${parsed.case_id}" gespeichert.`);
        renderDashboardCases();
    } catch (err) {
        showForgeFeedback('feedback-error', `Validierungsfehler: ${err.message}`);
    }
};

// ====================================================
// DOCTORDLE, RESETS & ABSCHLUSS
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
    
    if (solvedCount >= totalCount) doctordleSolved = true;

    if (activeCaseData) {
        ProgressManager.saveCaseState(activeCaseData.case_id, {
            doctordle: { solvedCount, totalCount, solved: solvedCount >= totalCount }
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
    if (finishBtn) finishBtn.style.display = allCompleted ? 'block' : 'none';
};

window.finishCase = function() {
    let solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    if (activeCaseData && !solved.includes(activeCaseData.case_id)) {
        solved.push(activeCaseData.case_id);
        localStorage.setItem('solved_cases', JSON.stringify(solved));
        applyXpDelta(activeCaseData.metadata?.xp_reward || 900, 'Fall abgeschlossen');
    }
    alert('🎉 Gratulation! Alle Challenges gemeistert.');
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length > 0) switchTab('dashboard', navItems[0]);
};

window.resetCurrentChallenge = function() {
    if (!activeCaseData || currentActiveChallenge === 'overview') return;
    if (!window.confirm(`Challenge "${currentActiveChallenge.toUpperCase()}" zurücksetzen?`)) return;

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
            if (window.doctordleGame) window.doctordleGame.resetGame();
            break;
    }
    checkFinalCompletion();
};

window.resetCurrentCaseEntirely = function() {
    if (!activeCaseData) return;
    if (!window.confirm(`Gesamten Fall zurücksetzen?`)) return;
    ProgressManager.resetEntireCase(activeCaseData.case_id);
    window.loadCaseById(activeCaseData.case_id);
};
