function renderCategorization() {
    const cat = activeCaseData?.extra_tasks?.categorization || {};
    const descEl = document.getElementById('cat-desc');
    const taskEl = document.getElementById('categorization-task');
    const badgeEl = document.getElementById('badge-mode-cat');
    const fbEl = document.getElementById('cat-fb');

    // Falls UI-Elemente fehlen, Funktion sauber abbrechen statt crashen
    if (!descEl || !taskEl || !badgeEl || !fbEl) {
        console.warn('Categorization UI elements fehlen (#cat-desc, #categorization-task, #badge-mode-cat, #cat-fb).');
        categorizationSolved = true; // blockiert nicht den Abschluss
        return;
    }

    const categories = Array.isArray(cat.categories) ? cat.categories : [];
    const items = Array.isArray(cat.items) ? cat.items : [];

    // Keine Aufgaben vorhanden -> als erledigt markieren und ruhig bleiben
    if (!items.length || !categories.length) {
        descEl.innerText = cat.description || 'Keine Zuordnungsaufgabe vorhanden.';
        taskEl.innerHTML = '<div style="font-size:0.85rem;color:var(--text-muted);">Für diesen Fall sind keine Zuordnungen definiert.</div>';
        badgeEl.innerText = '—';
        fbEl.style.display = 'none';
        categorizationSolved = true;
        return;
    }

    descEl.innerText = cat.description || 'Ordne die Begriffe korrekt zu.';
    taskEl.innerHTML = items.map((item) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(6,9,19,0.6); padding:12px 16px; border-radius:10px; margin-bottom:10px; border:1px solid var(--card-border); gap:12px;">
            <span style="font-weight:600; font-size:0.88rem; max-width:65%;">${item.term || ''}</span>
            <select class="cat-select" data-correct="${item.category || ''}" style="background:rgba(16,24,46,0.9); color:#fff; border:1px solid var(--card-border); padding:7px 12px; border-radius:8px; outline:none;">
                <option value="">-- Kategorie wählen --</option>
                ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
        </div>
    `).join('');

    badgeEl.innerText = 'Offen';
    fbEl.style.display = 'none';
    categorizationSolved = false;
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
