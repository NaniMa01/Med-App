window.toggleBodyRegion = function(regionId) {
    if (bodyMappingSolved) return;
    const el = document.getElementById(regionId);
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        selectedBodyRegions = selectedBodyRegions.filter(id => id !== regionId);
    } else {
        el.classList.add('selected');
        selectedBodyRegions.push(regionId);
    }
};

window.evalBodyMapping = function() {
    if (bodyMappingSolved) return;
    const task = activeCaseData.extra_tasks.body_mapping;
    const fb = document.getElementById('topo-fb');
    const targets = task.target_regions || [];
    const isMatch = (selectedBodyRegions.length === targets.length) && selectedBodyRegions.every(r => targets.includes(r));

    fb.style.display = 'block';
    if (isMatch) {
        applyXpDelta(50, 'Lokalisation');
        trackSkill('Diagnostik', true);
        fb.className = 'feedback-box feedback-success';
        fb.innerHTML = `<strong>Korrekt!</strong> ${task.feedback_success}`;
        selectedBodyRegions.forEach(id => document.getElementById(id).classList.add('correct'));
        bodyMappingSolved = true;
        document.getElementById('badge-mode-topo').innerText = '✓ Gelöst';
        checkFinalCompletion();
    } else {
        applyXpDelta(-20, 'Fehllokalisation');
        trackSkill('Diagnostik', false);
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Nicht ganz:</strong> ${task.feedback_error}`;
        selectedBodyRegions.forEach(id => {
            const el = document.getElementById(id);
            el.classList.remove('selected'); el.classList.add('incorrect');
            setTimeout(() => el.classList.remove('incorrect'), 600);
        });
        selectedBodyRegions = [];
    }
};

/* ==========================================================================
   DiagnosisRegistry (Doctordle): Basiskatalog + dynamisch gelernte Diagnosen
   ========================================================================== */
const DiagnosisRegistry = (function () {
    const STORAGE_KEY = 'medapp_learned_diagnoses';

    // Basiskatalog: [kanonische Diagnose, ...Synonyme]
    const baseDiagnoses = [
        ['Creutzfeldt-Jakob-Krankheit', 'CJK', 'CJD', 'Subakute spongiforme Enzephalopathie', 'Prionenerkrankung des ZNS'],
        ['Alzheimer-Krankheit', 'Morbus Alzheimer', 'Alzheimer-Demenz'],
        ['Lewy-Body-Demenz', 'LBD', 'DLB', 'Demenz mit Lewy-Körperchen'],
        ['Frontotemporale Demenz', 'FTD', 'Morbus Pick'],
        ['Vaskuläre Demenz', 'Multiinfarktdemenz'],
        ['Normaldruckhydrozephalus', 'NPH', 'Hakim-Trias'],
        ['Parkinson-Krankheit', 'Morbus Parkinson', 'Idiopathisches Parkinson-Syndrom'],
        ['Multiple Sklerose', 'MS', 'Encephalomyelitis disseminata'],
        ['Neuromyelitis-optica-Spektrum-Erkrankung', 'NMOSD', 'Devic-Syndrom'],
        ['Amyotrophe Lateralsklerose', 'ALS', 'Morbus Charcot'],
        ['Myasthenia gravis', 'MG'],
        ['Guillain-Barré-Syndrom', 'GBS', 'Akute inflammatorische demyelinisierende Polyneuropathie'],
        ['Chorea Huntington', 'Morbus Huntington'],
        ['Wernicke-Enzephalopathie', 'Wernicke-Korsakow-Syndrom'],
        ['Herpes-simplex-Enzephalitis', 'HSV-Enzephalitis'],
        ['Bakterielle Meningitis', 'Eitrige Meningitis'],
        ['Subarachnoidalblutung', 'SAB'],
        ['Ischämischer Schlaganfall', 'Hirninfarkt', 'Apoplex'],
        ['Anteriore ischämische Myelopathie', 'Spinalis-anterior-Syndrom', 'Arteria-spinalis-anterior-Syndrom'],
        ['Funikuläre Myelose', 'Vitamin-B12-Mangel-Myelopathie'],
        ['Burkitt-Lymphom', 'BL', 'Burkitt Lymphom'],
        ['Hodgkin-Lymphom', 'Morbus Hodgkin'],
        ['Diffus großzelliges B-Zell-Lymphom', 'DLBCL'],
        ['Follikuläres Lymphom', 'FL'],
        ['Multiples Myelom', 'Plasmozytom', 'Morbus Kahler'],
        ['Chronische lymphatische Leukämie', 'CLL'],
        ['Chronische myeloische Leukämie', 'CML'],
        ['Akute myeloische Leukämie', 'AML'],
        ['Akute lymphatische Leukämie', 'ALL'],
        ['Polycythaemia vera', 'PV'],
        ['Myelodysplastisches Syndrom', 'MDS'],
        ['Aplastische Anämie'],
        ['Eisenmangelanämie'],
        ['Immunthrombozytopenie', 'ITP', 'Morbus Werlhof'],
        ['Thrombotisch-thrombozytopenische Purpura', 'TTP', 'Morbus Moschcowitz'],
        ['Myokardinfarkt', 'Herzinfarkt', 'STEMI', 'NSTEMI'],
        ['Lungenembolie', 'LAE'],
        ['Infektiöse Endokarditis', 'Endokarditis'],
        ['Aortendissektion'],
        ['Sarkoidose', 'Morbus Boeck'],
        ['Systemischer Lupus erythematodes', 'SLE'],
        ['Tuberkulose', 'TBC'],
        ['Neurosyphilis', 'Tertiäre Syphilis'],
        ['Progressive multifokale Leukenzephalopathie', 'PML']
    ];

    const byKey = new Map();    // normalisierter Begriff -> kanonische Diagnose
    const display = new Map();  // normalisierter Begriff -> Anzeigeform
    let learned = {};           // kanonisch -> [Synonyme]

    function normalize(str) {
        return String(str == null ? '' : str).trim().toLowerCase()
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '');
    }

    function addTerm(term, canonical) {
        const key = normalize(term);
        if (!key) return;
        if (!byKey.has(key)) { byKey.set(key, canonical); display.set(key, String(term).trim()); }
    }

    function addEntry(canonical, synonyms) {
        if (!canonical || typeof canonical !== 'string') return;
        const c = canonical.trim();
        if (!c) return;
        addTerm(c, c);
        (Array.isArray(synonyms) ? synonyms : []).forEach(s => { if (typeof s === 'string') addTerm(s, c); });
    }

    function persistLearned(canonical, synonyms) {
        const list = learned[canonical] || (learned[canonical] = []);
        (synonyms || []).forEach(s => { if (typeof s === 'string' && s.trim() && !list.includes(s.trim())) list.push(s.trim()); });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(learned)); } catch (e) { /* Speicher voll/blockiert */ }
    }

    /** Registriert Diagnosen eines Falls (Doctordle-Block + Fallback aus Synapsen/Kaskaden/Übersicht). */
    function registerCase(caseObj) {
        if (!caseObj || typeof caseObj !== 'object') return;
        const tasks = caseObj.extra_tasks || {};
        const dd = tasks.doctordle;
        if (dd && dd.target_diagnosis) {
            addEntry(dd.target_diagnosis, dd.synonyms);
            persistLearned(dd.target_diagnosis.trim(), dd.synonyms);
        }
        const names = [];
        if (caseObj.case_overview && caseObj.case_overview.topic) names.push(caseObj.case_overview.topic);
        if (tasks.synapses_matrix && Array.isArray(tasks.synapses_matrix.diseases)) names.push(...tasks.synapses_matrix.diseases);
        if (Array.isArray(tasks.clinical_cascades)) tasks.clinical_cascades.forEach(c => { if (c && c.disease) names.push(c.disease); });
        names.forEach(n => {
            if (typeof n !== 'string' || !n.trim()) return;
            const canonical = byKey.get(normalize(n)) || n.trim();
            addEntry(canonical, []);
            persistLearned(canonical, []);
        });
    }

    function registerAllCases(casesArray) {
        (Array.isArray(casesArray) ? casesArray : []).forEach(registerCase);
    }

    function normalizeText(s) { return normalize(s); }

    /** true, wenn der Input dem Ziel oder einem Synonym entspricht. */
    function isMatch(userInput, targetDiagnosis, synonyms) {
        const n = normalize(userInput);
        if (!n) return false;
        return [targetDiagnosis].concat(Array.isArray(synonyms) ? synonyms : []).some(t => normalize(t) === n);
    }

    /** Autocomplete: ab 2 Zeichen, case-insensitiv, normalisiert. */
    function getAutocompleteSuggestions(query, limit = 8) {
        const q = normalize(query);
        if (String(query || '').trim().length < 2 || !q) return [];
        const out = [];
        for (const [key, label] of display) {
            if (key.includes(q)) out.push(label);
        }
        return out.sort((a, b) => a.localeCompare(b, 'de')).slice(0, limit);
    }

    // Initialisierung: Basiskatalog + persistierte Begriffe
    baseDiagnoses.forEach(e => addEntry(e[0], e.slice(1)));
    try {
        learned = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        if (typeof learned !== 'object' || Array.isArray(learned)) learned = {};
        Object.entries(learned).forEach(([c, syns]) => addEntry(c, syns));
    } catch (e) { learned = {}; }

    return { baseDiagnoses, normalize: normalizeText, registerCase, registerAllCases, isMatch, getAutocompleteSuggestions };
})();

window.DiagnosisRegistry = DiagnosisRegistry;
