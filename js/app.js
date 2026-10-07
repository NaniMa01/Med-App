// GLOBALE STATES
let activeCaseData = null;
let selectedSynapses = [], totalSynapseDiseases = 0, solvedSynapseDiseases = 0, tilesPerDisease = 4;
let cascadesSolvedCount = 0, totalCascades = 0;
let categorizationSolved = false;
let quizSolved = false, userQuizAnswers = {};
let doctordleSolved = false, totalDoctordlePuzzles = 0, solvedDoctordlePuzzles = 0;
let clearedStepsCount = 0, totalStepsCount = 0;
let openFolders = {};
let superFolderOpen = true;

// Bookshelf State
let bookshelfFolderState = {};
let draggedItemState = null;
let dragHoverTimer = null; // Für Auto-Open beim Drag & Drop

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
                "synonyms": [
                    "A. spinalis anterior Syndrom",
                    "Spinaler Insult",
                    "Rückenmarksinfarkt",
                    "Anteriore Myelonischämie"
                ],
                "hints": [
                    "Stufe 1 (Initialpräsentation): 52-jähriger Patient erleidet perakut einschießende interskapuläre Schmerzen mit rascher Parese beider Beine.",
                    "Stufe 2 (Klinischer Status): Schlaffe Paraparese, dissoziierte Sensibilitätsstörung: Schmerz/Temperatur erloschen, Tiefensensibilität vollständig intakt.",
                    "Stufe 3 (Basislabor): Unauffällige Entzündungsparameter; D-Dimere leicht erhöht; Ausschluss Guillain-Barré-Syndrom.",
                    "Stufe 4 (Gefäßstatus): CT-Angiographie zeigt eine Stanford-Typ-B-Dissektion mit Abgangsverschluss der A. radicularis magna (Adamkiewicz).",
                    "Stufe 5 (Bildgebung): Spine-MRT zeigt im T2-Axialschnitt hyperintense Signalanhebungen in beiden Vorderhörnern ('Eulenaugen-Zeichen').",
                    "Stufe 6 (Pathophysiologie): Perfusionsausfall der ventralen zwei Drittel des Myelons bei erhaltener Hinterstrangdurchblutung."
                ],
                "learning_pearl": "Die dissoziierte Sensibilitätsstörung (ausgefallene Schmerz-/Temperaturbahnen bei intakten Hintersträngen) beweist das Arteria-spinalis-anterior-Syndrom."
            },
            {
                "puzzle_id": 2,
                "title": "Deduktion 2: Subakute autoimmune Myelitis",
                "target_diagnosis": "Neuromyelitis-optica-Spektrum-Erkrankung",
                "synonyms": [
                    "NMOSD",
                    "Morbus Devic",
                    "Devic-Syndrom",
                    "Aquaporin-4-Autoimmunenzephalomyelitis"
                ],
                "hints": [
                    "Stufe 1 (Initialpräsentation): 38-jährige Frau klagt über Sehkraftverlust rechts gefolgt von einer progredienten Paraparese innerhalb weniger Tage.",
                    "Stufe 2 (Klinischer Status): Beidseits positiver Babinski, sensibles Niveau Th4, begleitend therapierefraktärer Schluckauf und Nausea.",
                    "Stufe 3 (Liquor): Pleozytose mit überwiegend neutrophilen Granulozyten, oligoklonale Banden (OKB) negativ.",
                    "Stufe 4 (Autoantikörper): Hochtiteriger Nachweis von zirkulierenden Autoantikörpern gegen den Wasserkanal Aquaporin-4 (AQP4-IgG).",
                    "Stufe 5 (MRT Schädel/Spine): Longitudinale extensive transversale Myelitis (LETM) über 4 Wirbelkörpersegmente sowie T2-Läsion in der Area postrema.",
                    "Stufe 6 (Therapieansprechen): Keine Remission unter Interferon-beta (Gefahr der Verschlechterung); rasches Ansprechen auf Plasmapherese und B-Zell-Depletion (Rituximab)."
                ],
                "learning_pearl": "Eine LETM (≥3 Segmente) kombiniert mit negativen oligoklonalen Banden und AQP4-IgG sichert die Diagnose einer NMOSD."
            },
            {
                "puzzle_id": 3,
                "title": "Deduktion 3: Metabolisch-toxische Ataxie",
                "target_diagnosis": "Funikuläre Myelose",
                "synonyms": [
                    "Subakute kombinierte Degeneration",
                    "Vitamin-B12-Mangel-Myelopathie",
                    "Distickstoffmonoxid-induzierte Myelopathie",
                    "Cobalamin-Mangelsyndrom"
                ],
                "hints": [
                    "Stufe 1 (Initialpräsentation): 26-jähriger Partygänger bemerkt seit drei Wochen symmetrische Parästhesien ('Pelzigkeitsgefühl') an Händen und Füßen sowie Gangunsicherheit im Dunkeln.",
                    "Stufe 2 (Klinischer Status): Spinale Ataxie, erloschenes Vibrationsempfinden an beiden Malleoli (Pallhypästhesie 0/8), Pyramidenbahnzeichen positiv.",
                    "Stufe 3 (Spezifisches Labor): Serum-Vitamin-B12 grenzwertig normal, jedoch Methylmalonsäure (MMA) und Homocystein massiv erhöht.",
                    "Stufe 4 (Anamnestischer Trigger): Regelmäßige Inhalation von Distickstoffmonoxid (Lachgas, N2O) zur Entspannung am Wochenende.",
                    "Stufe 5 (MRT Spine): T2-Hyperintensität der dorsalen Kolumnen (Hinterstränge) mit typischem umgekehrtem V-Zeichen ('Inverted V Sign').",
                    "Stufe 6 (Pathophysiologie): Irreversible Oxidation des zentralen Cobalt-Ions (Co+ zu Co+++) führt zum Ausfall der Methionin-Synthase und Demyelinisierung der Hinterstränge."
                ],
                "learning_pearl": "Lachgas inaktiviert Vitamin B12 funktionell; wegweisend sind die Erhöhung der Methylmalonsäure (MMA) und das umgekehrte V-Zeichen im Hinterstrang-MRT."
            }
        ],
        "library_entries": [
            "Arteria-spinalis-anterior-Syndrom",
            "A. spinalis anterior Syndrom",
            "Spinaler Insult",
            "Rückenmarksinfarkt",
            "Neuromyelitis-optica-Spektrum-Erkrankung",
            "NMOSD",
            "Morbus Devic",
            "Funikuläre Myelose",
            "Subakute kombinierte Degeneration",
            "Multiple Sklerose",
            "Akute disseminierte Enzephalomyelitis (ADEM)",
            "Guillain-Barré-Syndrom",
            "Spinales Epiduralhämatom",
            "Zervikale spondylotische Myelopathie"
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

// INIT
document.addEventListener('DOMContentLoaded', () => {
    initUserData();
    renderSkillsSidebar();
    renderDashboardCases();

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

    // Automatische Wörterbuch-Initialisierung aller vorhandenen Fälle
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
        const color = data.total > 0 ? (perc < 50 ? 'var(--color-risk)' : (perc < 80 ? '#f59e0b' : 'var(--color-symptom)')) : 'var(--accent-blue)';
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
}

window.switchPlayerMode = function(mode) {
    document.querySelectorAll('.player-mode-pane').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.challenge-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const targetPane = document.getElementById('mode-container-' + mode) || document.getElementById('tab-pane-' + mode);
    const targetTab = document.getElementById('tab-btn-' + mode);
    if (targetPane) targetPane.style.display = 'block';
    if (targetTab) targetTab.classList.add('active');

    // Spezifischer Init-Trigger für Doctordle
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

/**
 * Zentraler Dashboard-Renderer
 */
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
            const deleteBtn = c.case_id === BUILTIN_DEMO_CASE.case_id
                ? ''
                : '<button type="button" class="delete-case-btn" aria-label="Fall löschen" title="Fall löschen">×</button>';
            return `
    <div class="case-card" data-case-id="${encodeURIComponent(c.case_id)}" role="button" tabindex="0">
        ${deleteBtn}
        <div>
            <span class="tag">${c.metadata?.bloom_level || 'Evaluation'}</span>
            <h3>${c.metadata?.title || c.case_id}</h3>
        </div>
        <div style="font-size:0.75rem; display:flex; justify-content:space-between; margin-top:10px;">
            <span style="color:${isSolved ? 'var(--color-symptom)' : 'var(--accent-blue)'}; font-weight:700;">
                ${isSolved ? '✓ Gelöst' : '● Offen'}
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

        card.addEventListener('click', () => {
            window.loadCaseById(caseId);
        });

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

/**
 * ====================================================
 * BOOKSHELF ENGINE
 * ====================================================
 */
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
            emptyLi.style.fontSize = '0.72rem';
            emptyLi.style.color = 'var(--text-dim)';
            emptyLi.style.padding = '4px 6px';
            emptyLi.style.fontStyle = 'italic';
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

                li.addEventListener('click', () => {
                    window.loadCaseById(caseItem.case_id);
                });

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
        switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
    } else {
        renderDashboardCases();
    }
};

window.toggleFolder = function(category) {
    openFolders[category] = openFolders[category] !== undefined ? !openFolders[category] : false;
    renderDashboardCases();
};

window.loadCaseById = function(caseId) {
    let customCases = [];
    try { customCases = JSON.parse(localStorage.getItem('custom_cases')) || []; } catch(e){}
    let targetCase = [BUILTIN_DEMO_CASE, ...customCases].find(c => c.case_id === caseId);
    
    if (!targetCase) { 
        alert("Fall nicht gefunden!"); 
        return; 
    }

    if (targetCase.extra_tasks && targetCase.extra_tasks.topo) {
        delete targetCase.extra_tasks.topo;
    }

    activeCaseData = JSON.parse(JSON.stringify(targetCase));
    
    const badgeTitle = document.getElementById('player-case-badge-title');
    if (badgeTitle) badgeTitle.innerText = activeCaseData.metadata?.title || activeCaseData.case_id;

    clearedStepsCount = 0;
    if (!Array.isArray(activeCaseData.timeline)) activeCaseData.timeline = [];
    totalStepsCount = activeCaseData.timeline.length;
    
    const badgeAudit = document.getElementById('badge-mode-audit');
    if (badgeAudit) badgeAudit.innerText = `0/${totalStepsCount}`;
    
    const finishCaseBtn = document.getElementById('finish-case-btn');
    if (finishCaseBtn) finishCaseBtn.style.display = 'none';

    const tasks = activeCaseData.extra_tasks || {};

    const show = (id, on) => { 
        const el = document.getElementById(id); 
        if (el) el.style.display = on ? 'inline-flex' : 'none'; 
    };

    const hasSyn = !!(tasks.synapses_matrix && tasks.synapses_matrix.variables?.length && tasks.synapses_matrix.diseases?.length);
    show('tab-btn-synapses', hasSyn);
    
    const hasCas = !!(tasks.clinical_cascades && tasks.clinical_cascades.length);
    show('tab-btn-cascade', hasCas);
    
    const hasCat = !!(tasks.categorization && tasks.categorization.items?.length && tasks.categorization.categories?.length);
    show('tab-btn-cat', hasCat);
    
    const hasQuiz = !!(tasks.master_quiz && tasks.master_quiz.length);
    show('tab-btn-quiz', hasQuiz);

    // DOCTORDLE CHALLENGE TAB INITIALISIERUNG
    const doctordleData = tasks.doctordle || activeCaseData.extra_tasks?.doctordle;
    const hasDoctordle = !!(doctordleData && (Array.isArray(doctordleData) ? doctordleData.length > 0 : !!doctordleData.hints));
    show('tab-btn-doctordle', hasDoctordle);

    if (hasDoctordle) {
        totalDoctordlePuzzles = Array.isArray(doctordleData) ? doctordleData.length : 1;
        solvedDoctordlePuzzles = 0;
        doctordleSolved = false;
        const doctordleBadge = document.getElementById('badge-mode-doctordle');
        if (doctordleBadge) doctordleBadge.innerText = `0/${totalDoctordlePuzzles}`;
    } else {
        doctordleSolved = true; // Automatisch als gelöst markieren, wenn Challenge nicht existiert
        totalDoctordlePuzzles = 0;
        solvedDoctordlePuzzles = 0;
    }

    show('tab-btn-topo', false);

    const safely = (label, fn) => {
        try { 
            if (typeof fn === 'function') {
                fn();
            } else {
                console.warn(`Modul '${label}' konnte nicht geladen werden (Funktion nicht gefunden).`);
            }
        } catch (err) { 
            console.error(`Fehler beim Laden von Modul '${label}':`, err); 
        }
    };

    safely('Übersicht', window.renderOverview);
    safely('Audit', window.renderTimeline);

    solvedSynapseDiseases = 0; totalSynapseDiseases = hasSyn ? tasks.synapses_matrix.diseases.length : 0;
    if (hasSyn) safely('Synapsen', window.renderSynapsesMatrix);

    cascadesSolvedCount = 0; totalCascades = hasCas ? tasks.clinical_cascades.length : 0;
    if (hasCas) safely('Kaskade', window.renderCascades);

    categorizationSolved = !hasCat;
    if (hasCat) safely('Taxonomie', window.renderCategorization);

    quizSolved = !hasQuiz;
    if (hasQuiz) { userQuizAnswers = {}; safely('Quiz', window.renderQuiz); }

    if (hasDoctordle && window.initDoctordle) {
        safely('Doctordle', () => window.initDoctordle(activeCaseData));
    }

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
    if(data.cornell_notes && Array.isArray(data.cornell_notes)) {
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
                `Serverfehler (HTTP ${res.status})${serverMessage ? ': ' + serverMessage : ''}. Die Anfrage hat evtl. das Zeitlimit überschritten – bitte erneut versuchen oder den Prompt kürzen.`
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

        showForgeFeedback('feedback-success', 'Fall generiert. Bitte prüfen, ggf. anpassen und anschließend validieren/speichern.');
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

        // Dynamisches Wörterbuch mit neuem Fall sofort erweitern
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

// DOCTORDLE COMPLETION HOOK
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
        }
    }
    if (solvedCount >= totalCount) {
        doctordleSolved = true;
    }
    checkFinalCompletion();
};

window.checkFinalCompletion = function() {
    const stepsDone = (clearedStepsCount === totalStepsCount);
    const synDone = (solvedSynapseDiseases === totalSynapseDiseases);
    const casDone = (cascadesSolvedCount === totalCascades);
    const docDone = doctordleSolved;
    
    if (stepsDone && synDone && casDone && categorizationSolved && quizSolved && docDone) {
        const finishBtn = document.getElementById('finish-case-btn');
        if (finishBtn) finishBtn.style.display = 'block';
    }
};

window.finishCase = function() {
    let solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    if (activeCaseData && !solved.includes(activeCaseData.case_id)) {
        solved.push(activeCaseData.case_id);
        localStorage.setItem('solved_cases', JSON.stringify(solved));
        if (window.Cloud) window.Cloud.scheduleProgressSync();
        applyXpDelta(activeCaseData.metadata?.xp_reward || 900, 'Fall abgeschlossen');
    }
    alert('🎉 Gratulation! Alle Challenges gemeistert.');
    
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length > 0) switchTab('dashboard', navItems[0]);
};
