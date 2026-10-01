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
