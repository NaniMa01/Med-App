function renderCategorization() {
    const cat = activeCaseData.extra_tasks.categorization;
    document.getElementById('cat-desc').innerText = cat.description;
    document.getElementById('categorization-task').innerHTML = cat.items.map((item, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(6,9,19,0.6); padding:12px 16px; border-radius:10px; margin-bottom:10px; border:1px solid var(--card-border);">
            <span style="font-weight:600; font-size:0.88rem; max-width:65%;">${item.term}</span>
            <select class="cat-select" data-correct="${item.category}" style="background:rgba(16,24,46,0.9); color:#fff; border:1px solid var(--card-border); padding:7px 12px; border-radius:8px; outline:none;">
                <option value="">-- Kategorie wählen --</option>
                ${cat.categories.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
        </div>`).join('');
    document.getElementById('badge-mode-cat').innerText = 'Offen';
    document.getElementById('cat-fb').style.display = 'none';
}

window.evalCategorization = function() {
    if (categorizationSolved) return;
    let correct = true;
    document.querySelectorAll('.cat-select').forEach(sel => {
        if (sel.value === sel.getAttribute('data-correct')) {
            sel.style.borderColor = 'var(--color-symptom)';
        } else {
            correct = false;
            sel.style.borderColor = 'var(--color-risk)';
        }
    });

    const fb = document.getElementById('cat-fb');
    fb.style.display = 'block';
    if (correct) {
        applyXpDelta(50, 'Taxonomie gemeistert');
        trackSkill('Pharmakologie', true);
        fb.className = 'feedback-box feedback-success';
        fb.innerHTML = 'Hervorragend! Alle Entitäten wurden den richtigen Kategorien zugeteilt.';
        document.querySelectorAll('.cat-select').forEach(s => s.disabled = true);
        document.getElementById('badge-mode-cat').innerText = '✓ Gelöst';
        categorizationSolved = true;
        checkFinalCompletion();
    } else {
        applyXpDelta(-20, 'Taxonomie Fehler');
        trackSkill('Pharmakologie', false);
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = 'Einige Zuordnungen stimmen noch nicht.';
    }
};
