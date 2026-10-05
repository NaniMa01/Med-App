// GLOBALE STATES
let activeCaseData = null;
let selectedSynapses = [], totalSynapseDiseases = 0, solvedSynapseDiseases = 0, tilesPerDisease = 4;
let selectedBodyRegions = [], bodyMappingSolved = false;
let cascadesSolvedCount = 0, totalCascades = 0;
let categorizationSolved = false;
let quizSolved = false, userQuizAnswers = {};
let clearedStepsCount = 0, totalStepsCount = 0;
let openFolders = {};
let superFolderOpen = true;

const defaultSkills = {
    "Triage": { hits: 0, total: 0 },
    "Diagnostik": { hits: 0, total: 0 },
    "Pharmakologie": { hits: 0, total: 0 },
    "Pathophysiologie": { hits: 0, total: 0 }
};

// V6.0 BUILT-IN DEMO CASE (Cornell Edition)
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
    const endpointInput = document.getElementById('forge-endpoint');
    if (endpointInput) {
        endpointInput.value = localStorage.getItem('forge_generate_endpoint') || '/api/generate-case';
    }
});

window.toggleSidebar = function() {
    document.querySelector('sidebar').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
};

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
    updateStatsUI();
}

function updateStatsUI() {
    const xp = parseInt(localStorage.getItem('user_xp') || '0');
    document.getElementById('stat-xp').innerText = xp;
    let rank = xp >= 1500 ? 'Oberarzt' : (xp >= 800 ? 'Facharzt' : (xp >= 300 ? 'Assistenzarzt' : 'Famulus'));
    document.getElementById('stat-rank').innerText = rank;
}

function applyXpDelta(delta, label) {
    let currentXp = Math.max(0, parseInt(localStorage.getItem('user_xp') || '0') + delta);
    localStorage.setItem('user_xp', currentXp);
    updateStatsUI();
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
}

function renderSkillsSidebar() {
    const skills = JSON.parse(localStorage.getItem('user_skills') || JSON.stringify(defaultSkills));
    const canonicalOrder = ["Triage", "Diagnostik", "Pharmakologie", "Pathophysiologie"];
    document.getElementById('skills-sidebar-container').innerHTML = canonicalOrder.map(skill => {
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
    document.getElementById('dashboard-view').style.display = tab === 'dashboard' ? 'block' : 'none';
    document.getElementById('player-view').style.display = tab === 'player' ? 'block' : 'none';
    document.getElementById('forge-view').style.display = tab === 'forge' ? 'block' : 'none';
    document.getElementById('settings-view').style.display = tab === 'settings' ? 'block' : 'none';
    document.getElementById('nav-player').style.display = tab === 'player' ? 'flex' : 'none';
    
    document.querySelector('sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');

    if (tab === 'dashboard') renderDashboardCases();
}

function switchPlayerMode(mode) {
    document.querySelectorAll('.player-mode-pane').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.challenge-tab-btn').forEach(btn => btn.classList.remove('active'));
    const targetPane = document.getElementById('mode-container-' + mode);
    const targetTab = document.getElementById('tab-btn-' + mode);
    if (targetPane) targetPane.style.display = 'block';
    if (targetTab) targetTab.classList.add('active');
}

window.showTutorHint = function(taskKey) {
    if (!activeCaseData || !activeCaseData.extra_tasks) return;
    let hint = "Kein spezifischer Hinweis hinterlegt.";
    if (taskKey === 'clinical_cascades' && activeCaseData.extra_tasks.clinical_cascades) {
        hint = activeCaseData.extra_tasks.clinical_cascades[0]?.tutor_hint || hint;
    } else if (activeCaseData.extra_tasks[taskKey]) {
        hint = activeCaseData.extra_tasks[taskKey].tutor_hint || hint;
    }
    document.getElementById('tutor-text').innerText = hint;
    document.getElementById('tutor-modal').style.display = 'block';
};

window.toggleSuperFolder = function() {
    superFolderOpen = !superFolderOpen;
    document.getElementById('dashboard-folders-container').style.display = superFolderOpen ? 'flex' : 'none';
    document.getElementById('super-folder-arrow').innerText = superFolderOpen ? '▼' : '▶';
};

function renderDashboardCases() {
    let customCases = [];
    try { customCases = JSON.parse(localStorage.getItem('custom_cases')) || []; } catch (e) { customCases = []; }
    const solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    const container = document.getElementById('dashboard-folders-container');

    let allCases = [BUILTIN_DEMO_CASE, ...customCases.filter(c => c.case_id !== BUILTIN_DEMO_CASE.case_id)];
    const grouped = {};
    allCases.forEach(c => {
        const cat = (c.metadata?.medical_field || "Allgemeine Neurologie").trim();
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(c);
    });

    container.innerHTML = Object.entries(grouped).map(([category, cases], catIdx) => {
        const solvedCount = cases.filter(c => solved.includes(c.case_id)).length;
        const isExpanded = openFolders[category] !== undefined ? openFolders[category] : true;
        
        const cardsHtml = cases.map(c => {
            const isSolved = solved.includes(c.case_id);
            return `
                <div class="case-card" onclick="loadCaseById('${c.case_id}')">
                    <div><span class="tag">${c.metadata?.bloom_level || 'Evaluation'}</span><h3>${c.metadata?.title || c.case_id}</h3></div>
                    <div style="font-size:0.75rem; display:flex; justify-content:space-between; margin-top:10px;">
                        <span style="color:${isSolved ? 'var(--color-symptom)' : 'var(--accent-blue)'}; font-weight:700;">${isSolved ? '✓ Gelöst' : '● Offen'}</span>
                        <span>+${c.metadata?.xp_reward || 900} XP</span>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="category-folder">
                <div class="category-header" onclick="toggleFolder('${category}')">
                    <div class="category-title-wrap"><span class="category-arrow ${isExpanded ? 'expanded' : ''}" id="arrow-${catIdx}">▶</span><span>📁 ${category}</span></div>
                    <span class="category-badge">${solvedCount}/${cases.length} Gelöst</span>
                </div>
                <div class="category-cases-body" id="folder-body-${catIdx}" style="display:${isExpanded ? 'grid' : 'none'};">${cardsHtml}</div>
            </div>`;
    }).join('');
}

window.toggleFolder = function(category) {
    openFolders[category] = openFolders[category] !== undefined ? !openFolders[category] : false;
    renderDashboardCases();
};

window.loadCaseById = function(caseId) {
    let customCases = [];
    try { customCases = JSON.parse(localStorage.getItem('custom_cases')) || []; } catch(e){}
    let targetCase = [BUILTIN_DEMO_CASE, ...customCases].find(c => c.case_id === caseId);
    if (!targetCase) { alert("Fall nicht gefunden!"); return; }

    activeCaseData = JSON.parse(JSON.stringify(targetCase));
    document.getElementById('player-case-badge-title').innerText = activeCaseData.metadata?.title || activeCaseData.case_id;

    clearedStepsCount = 0;
    totalStepsCount = (activeCaseData.timeline && Array.isArray(activeCaseData.timeline)) ? activeCaseData.timeline.length : 0;
    document.getElementById('badge-mode-audit').innerText = `0/${totalStepsCount}`;
    document.getElementById('finish-case-btn').style.display = 'none';

    const tasks = activeCaseData.extra_tasks || {};

    document.getElementById('tab-btn-synapses').style.display = (tasks.synapses_matrix && tasks.synapses_matrix.variables?.length) ? 'flex' : 'none';
    document.getElementById('tab-btn-cascade').style.display = (tasks.clinical_cascades && tasks.clinical_cascades.length) ? 'flex' : 'none';
    document.getElementById('tab-btn-topo').style.display = (tasks.body_mapping && tasks.body_mapping.target_regions?.length) ? 'flex' : 'none';
    document.getElementById('tab-btn-cat').style.display = (tasks.categorization && tasks.categorization.items?.length) ? 'flex' : 'none';
    document.getElementById('tab-btn-quiz').style.display = (tasks.master_quiz && tasks.master_quiz.length) ? 'flex' : 'none';

    renderOverview();
    renderTimeline();

    if (tasks.synapses_matrix && tasks.synapses_matrix.variables?.length) { renderSynapsesMatrix(); } else { solvedSynapseDiseases = 1; totalSynapseDiseases = 1; }
    if (tasks.clinical_cascades && tasks.clinical_cascades.length) { renderCascades(); } else { cascadesSolvedCount = 1; totalCascades = 1; }
    if (tasks.body_mapping && tasks.body_mapping.target_regions?.length) {
        bodyMappingSolved = false;
        document.getElementById('body-mapping-desc').innerText = tasks.body_mapping.description || '';
        document.querySelectorAll('.body-region').forEach(el => el.classList.remove('selected', 'correct', 'incorrect'));
        document.getElementById('badge-mode-topo').innerText = "Offen";
        document.getElementById('topo-fb').style.display = 'none';
    } else { bodyMappingSolved = true; }

    if (tasks.categorization && tasks.categorization.items?.length) { categorizationSolved = false; renderCategorization(); } else { categorizationSolved = true; }
    if (tasks.master_quiz && tasks.master_quiz.length) { quizSolved = false; userQuizAnswers = {}; renderQuiz(); } else { quizSolved = true; }

    switchTab('player', document.getElementById('nav-player'));
    switchPlayerMode('overview');
    checkFinalCompletion();
};

// --- V6.0 CORNELL NOTE OVERVIEW ENGINE ---
window.renderOverview = function() {
    const container = document.getElementById('overview-container');
    const data = activeCaseData.case_overview;
    if (!data) {
        container.innerHTML = '<div class="feedback-box feedback-neutral" style="display:block;">Für diesen Fall ist keine Übersicht verfügbar.</div>';
        return;
    }

    let notesHtml = '';
    if(data.cornell_notes && Array.isArray(data.cornell_notes)) {
        data.cornell_notes.forEach(note => {
            notesHtml += `
                <div class="cornell-grid">
                    <div class="cornell-cues">
                        ${note.cues.map(c => `<div class="cornell-cue-item">${c}</div>`).join('')}
                    </div>
                    <div class="cornell-notes">
                        ${note.notes}
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
                <p>${data.summary || ''}</p>
            </div>
        </div>
    `;
    container.innerHTML = html;
};

// --- FORGE LOGIK ---
function getCaseSchemaTools() {
    return window.MediCheckerCaseSchema || {};
}

function setForgeFeedback(type, text) {
    const fb = document.getElementById('forge-fb');
    fb.style.display = 'block';
    fb.className = `feedback-box ${type}`;
    fb.innerHTML = text;
}

function readCustomCases() {
    try {
        const parsed = JSON.parse(localStorage.getItem('custom_cases') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function persistCustomCase(inputCase) {
    const customCases = readCustomCases().filter(c => c.case_id !== inputCase.case_id);
    customCases.push(inputCase);
    localStorage.setItem('custom_cases', JSON.stringify(customCases));
    renderDashboardCases();
}

function validateCaseInput(rawVal) {
    const schema = getCaseSchemaTools();
    if (!schema.parseCaseJson || !schema.validateMediCheckerCase) {
        throw new Error('Validierungsmodule konnten nicht geladen werden.');
    }
    const parsed = schema.parseCaseJson(rawVal);
    const validation = schema.validateMediCheckerCase(parsed);
    if (!validation.valid) {
        throw new Error(validation.errors.join(' '));
    }
    return validation.value;
}

window.validateAndSaveCustomCase = function() {
    const rawVal = document.getElementById('forge-input').value.trim();
    if (!rawVal) {
        setForgeFeedback('feedback-error', 'Bitte füge zuerst einen JSON-Fall ein.');
        return;
    }

    try {
        const parsedCase = validateCaseInput(rawVal);
        persistCustomCase(parsedCase);
        setForgeFeedback('feedback-success', `<strong>Korrekt!</strong> Fall "${parsedCase.case_id}" gespeichert.`);
    } catch (err) {
        setForgeFeedback('feedback-error', `Validierungsfehler: ${err.message}`);
    }
};

window.clearForgeSourceText = function() {
    const sourceInput = document.getElementById('forge-source-text');
    sourceInput.value = '';
    sourceInput.focus();
};

window.generateCaseFromText = async function() {
    const sourceText = document.getElementById('forge-source-text').value.trim();
    const endpointInput = document.getElementById('forge-endpoint');
    const generateBtn = document.getElementById('forge-generate-btn');
    const endpoint = (endpointInput.value || '/api/generate-case').trim() || '/api/generate-case';
    localStorage.setItem('forge_generate_endpoint', endpoint);

    if (!sourceText) {
        setForgeFeedback('feedback-error', 'Bitte füge zuerst einen anonymisierten Lerntext ein.');
        return;
    }

    if (sourceText.length > 12000) {
        setForgeFeedback('feedback-error', 'Der Lerntext ist zu lang (maximal 12000 Zeichen).');
        return;
    }

    setForgeFeedback('feedback-neutral', 'Generierung läuft … Bitte warten.');
    generateBtn.disabled = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_text: sourceText }),
            signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error || 'Generierung fehlgeschlagen.');
        }

        const generatedCase = validateCaseInput(JSON.stringify(payload.case));
        persistCustomCase(generatedCase);
        document.getElementById('forge-input').value = JSON.stringify(generatedCase, null, 2);
        setForgeFeedback(
            'feedback-success',
            `<strong>Erfolgreich generiert:</strong> Fall "${generatedCase.case_id}" wurde gespeichert und ist im Dashboard verfügbar.`
        );
    } catch (error) {
        const msg = error.name === 'AbortError'
            ? 'Zeitüberschreitung bei der Generierung. Bitte erneut versuchen.'
            : error.message;
        setForgeFeedback('feedback-error', `Generierungsfehler: ${msg}`);
    } finally {
        clearTimeout(timeout);
        generateBtn.disabled = false;
    }
};
window.checkFinalCompletion = function() {
    const stepsDone = (clearedStepsCount === totalStepsCount);
    const synDone = (solvedSynapseDiseases === totalSynapseDiseases);
    const casDone = (cascadesSolvedCount === totalCascades);
    if (stepsDone && synDone && casDone && bodyMappingSolved && categorizationSolved && quizSolved) {
        document.getElementById('finish-case-btn').style.display = 'block';
    }
};

window.finishCase = function() {
    let solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
    if (!solved.includes(activeCaseData.case_id)) {
        solved.push(activeCaseData.case_id);
        localStorage.setItem('solved_cases', JSON.stringify(solved));
        applyXpDelta(activeCaseData.metadata?.xp_reward || 900, 'Fall abgeschlossen');
    }
    alert('🎉 Gratulation! Alle Challenges gemeistert.');
    switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
};
