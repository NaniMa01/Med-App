function getCategoryData(typeStr) {
    const t = (typeStr || '').toLowerCase();
    if (t.includes('symptom') || t.includes('klinik')) return { class: 'category-symptom', dotClass: 'dot-symptom', label: 'Symptom' };
    if (t.includes('risiko') || t.includes('ursache') || t.includes('patho') || t.includes('ätiologie')) return { class: 'category-risk', dotClass: 'dot-risk', label: 'Patho/Risiko' };
    if (t.includes('diagnostik') || t.includes('labor') || t.includes('nachweis')) return { class: 'category-lab', dotClass: 'dot-lab', label: 'Diagnostik' };
    return { class: 'category-treatment', dotClass: 'dot-treatment', label: 'Therapie' };
}

function renderSynapsesMatrix() {
    const m = activeCaseData.extra_tasks.synapses_matrix;
    document.getElementById('synapses-desc').innerText = m.description || "Bilde geschlossene 4er-Gruppen.";
    const grid = document.getElementById('synapses-grid');
    document.getElementById('synapses-solved-area').innerHTML = '';
    document.getElementById('syn-fb').style.display = 'none';

    selectedSynapses = [];
    totalSynapseDiseases = m.diseases.length;
    solvedSynapseDiseases = 0;
    document.getElementById('badge-mode-synapses').innerText = `0/${totalSynapseDiseases}`;

    tilesPerDisease = Math.round(m.variables.length / totalSynapseDiseases) || 4;

    let vars = [...m.variables];
    for (let i = vars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vars[i], vars[j]] = [vars[j], vars[i]];
    }

    grid.innerHTML = vars.map((v, i) => {
        const cat = getCategoryData(v.type);
        return `
            <div class="synapse-tile-modern ${cat.class}" id="syn-tile-${i}" data-disease="${v.disease}" data-term="${v.term}" onclick="toggleSynapseTile(${i})">
                <div class="syn-corner-tag"><span class="syn-corner-dot ${cat.dotClass}"></span><span>${cat.label}</span></div>
                <div class="syn-tile-text">${v.term}</div>
            </div>`;
    }).join('');
}

window.toggleSynapseTile = function(index) {
    const tile = document.getElementById(`syn-tile-${index}`);
    if (!tile) return;
    if (tile.classList.contains('selected')) {
        tile.classList.remove('selected');
        selectedSynapses = selectedSynapses.filter(t => t.id !== tile.id);
        return;
    }
    if (selectedSynapses.length >= tilesPerDisease) return;

    tile.classList.add('selected');
    selectedSynapses.push(tile);

    if (selectedSynapses.length === tilesPerDisease) {
        setTimeout(evaluateSynapsesGroup, 250);
    }
};

window.evaluateSynapsesGroup = function() {
    const fb = document.getElementById('syn-fb');
    const targetDisease = selectedSynapses[0].dataset.disease;
    const isMatch = selectedSynapses.every(tile => tile.dataset.disease === targetDisease);

    if (isMatch) {
        applyXpDelta(100, 'Synapsen Match');
        trackSkill('Diagnostik', true);
        const terms = selectedSynapses.map(t => t.dataset.term).join(' • ');
        document.getElementById('synapses-solved-area').innerHTML += `
            <div class="synapse-solved-card">
                <div style="font-weight:800; font-size:0.95rem; text-transform:uppercase;">✓ ${targetDisease}</div>
                <div style="font-size:0.8rem; margin-top:4px;">${terms}</div>
            </div>`;
        selectedSynapses.forEach(tile => tile.remove());
        selectedSynapses = [];
        solvedSynapseDiseases++;
        document.getElementById('badge-mode-synapses').innerText = `${solvedSynapseDiseases}/${totalSynapseDiseases}`;

        if (solvedSynapseDiseases === totalSynapseDiseases) {
            fb.style.display = 'block';
            fb.className = 'feedback-box feedback-success';
            fb.innerHTML = '<strong>Hervorragend!</strong> Alle Synapsen-Verknüpfungen wurden gelöst.';
            document.getElementById('badge-mode-synapses').innerText = '✓ Gelöst';
            checkFinalCompletion();
        }
    } else {
        applyXpDelta(-25, 'Synapsen Fehler');
        trackSkill('Diagnostik', false);
        selectedSynapses.forEach(tile => {
            tile.classList.add('shake');
            setTimeout(() => { tile.classList.remove('shake', 'selected'); }, 400);
        });
        selectedSynapses = [];
    }
};
