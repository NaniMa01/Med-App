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
   Doctordle: Diagnosen-Wörterbuch (kanonische Diagnosen + Synonyme)
   ========================================================================== */
const DiagnosisDictionary = (function () {
    const byKey = new Map();   // normalisierter Begriff -> { canonical, caseIds }
    const terms = new Map();   // normalisierter Begriff -> Anzeigeform

    function normalize(str) {
        return String(str || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    }

    function add(term, canonical, caseId) {
        const key = normalize(term);
        if (!key) return;
        if (!byKey.has(key)) byKey.set(key, { canonical, caseIds: [] });
        const entry = byKey.get(key);
        if (!entry.caseIds.includes(caseId)) entry.caseIds.push(caseId);
        if (!terms.has(key)) terms.set(key, String(term).trim());
    }

    /** Aggregiert alle Diagnosen und Synonyme aus den übergebenen Fällen. */
    function build(cases) {
        byKey.clear();
        terms.clear();
        (cases || []).forEach(c => {
            const d = c && c.doctordle;
            if (!d || !d.canonical_diagnosis) return;
            add(d.canonical_diagnosis, d.canonical_diagnosis, c.case_id);
            (d.synonyms || []).forEach(s => add(s, d.canonical_diagnosis, c.case_id));
        });
    }

    /** Liefert { canonical, caseIds } oder null, wenn der Input unbekannt ist. */
    function resolveDiagnosis(input) {
        const entry = byKey.get(normalize(input));
        return entry ? { canonical: entry.canonical, caseIds: entry.caseIds.slice() } : null;
    }

    /** Alphabetisch sortierte Liste aller validen Eingabebegriffe (für Autocomplete). */
    function getInputTerms() {
        return Array.from(terms.values()).sort((a, b) => a.localeCompare(b, 'de'));
    }

    return { build, resolveDiagnosis, getInputTerms, normalize };
})();

window.DiagnosisDictionary = DiagnosisDictionary;
window.resolveDiagnosis = DiagnosisDictionary.resolveDiagnosis;
