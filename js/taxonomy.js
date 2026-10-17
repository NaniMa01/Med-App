// ====================================================
// TAXONOMY / CATEGORIZATION MODULE
// ====================================================

window.renderCategorization = function() {
    const cat = activeCaseData?.extra_tasks?.categorization || {};
    const descEl = document.getElementById('cat-desc');
    const taskEl = document.getElementById('categorization-task');
    const badgeEl = document.getElementById('badge-mode-cat');
    const fbEl = document.getElementById('cat-fb');

    // UI-Elemente prüfen
    if (!descEl || !taskEl || !badgeEl || !fbEl) {
        console.warn('Categorization UI elements fehlen (#cat-desc, #categorization-task, #badge-mode-cat, #cat-fb).');
        categorizationSolved = true;
        return;
    }

    const categories = Array.isArray(cat.categories) ? cat.categories : [];
    const items = Array.isArray(cat.items) ? cat.items : [];

    // Fallback: Keine Aufgaben vorhanden
    if (!items.length || !categories.length) {
        descEl.innerText = cat.description || 'Keine Zuordnungsaufgabe vorhanden.';
        taskEl.innerHTML = '<div style="font-size:0.85rem;color:var(--text-muted);padding:16px 0;">Für diesen Fall sind keine Zuordnungen definiert.</div>';
        badgeEl.innerText = '—';
        fbEl.style.display = 'none';
        categorizationSolved = true;
        return;
    }

    // Gespeicherten Zustand prüfen
    const savedState = ProgressManager.getCaseProgress(activeCaseData?.case_id)?.categorization;
    categorizationSolved = !!savedState?.solved;

    descEl.innerText = cat.description || 'Ordne die klinischen Befunde, Manöver und Phänomene den entsprechenden Kategorien zu.';

    // HTML sauber rendern mit Attribut-Escaping
    taskEl.innerHTML = items.map((item, idx) => {
        const escapedTerm = escapeHtml(item.term || '');
        const escapedCategory = escapeHtml(item.category || '');

        return `
            <div class="cat-row" style="display:flex; justify-content:space-between; align-items:center; background:rgba(6,9,19,0.6); padding:12px 16px; border-radius:10px; margin-bottom:10px; border:1px solid var(--card-border); gap:12px; transition:border-color 0.2s;">
                <span style="font-weight:600; font-size:0.88rem; max-width:62%; line-height:1.4;">${escapedTerm}</span>
                <select class="cat-select" 
                        id="cat-select-${idx}"
                        data-correct="${escapedCategory}" 
                        style="background:rgba(16,24,46,0.9); color:#fff; border:1px solid var(--card-border); padding:8px 12px; border-radius:8px; outline:none; font-size:0.84rem; cursor:pointer; max-width:38%;">
                    <option value="">-- Kategorie wählen --</option>
                    ${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
            </div>
        `;
    }).join('');

    if (categorizationSolved) {
        badgeEl.innerText = '✓ Gelöst';
        badgeEl.style.color = 'var(--color-symptom, #10b981)';
        document.querySelectorAll('.cat-select').forEach(sel => {
            sel.value = sel.getAttribute('data-correct');
            sel.disabled = true;
            sel.style.borderColor = 'var(--color-symptom, #10b981)';
        });
    } else {
        badgeEl.innerText = 'Offen';
        badgeEl.style.color = '';
        fbEl.style.display = 'none';
    }
};

window.evalCategorization = function() {
    if (categorizationSolved) return;

    const selects = document.querySelectorAll('.cat-select');
    const fb = document.getElementById('cat-fb');
    if (!fb || selects.length === 0) return;

    let allSelected = true;
    let correctCount = 0;
    const totalCount = selects.length;

    // 1. Validierung: Wurde überall eine Auswahl getroffen?
    selects.forEach(sel => {
        if (!sel.value) {
            allSelected = false;
            sel.style.borderColor = 'var(--card-border)';
        }
    });

    fb.style.display = 'block';

    if (!allSelected) {
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = '<strong>Unvollständig:</strong> Bitte wähle für jeden Begriff eine Kategorie aus.';
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
        return;
    }

    // 2. Auswertung
    selects.forEach(sel => {
        const expected = (sel.getAttribute('data-correct') || '').trim();
        const actual = sel.value.trim();

        if (actual === expected) {
            correctCount++;
            sel.style.borderColor = 'var(--color-symptom, #10b981)';
        } else {
            sel.style.borderColor = 'var(--color-risk, #ef4444)';
        }
    });

    const isAllCorrect = (correctCount === totalCount);

    if (isAllCorrect) {
        if (typeof applyXpDelta === 'function') applyXpDelta(75, 'Taxonomie gemeistert');
        if (typeof trackSkill === 'function') trackSkill('Diagnostik', true);

        fb.className = 'feedback-box feedback-success';
        fb.innerHTML = `<strong>Hervorragend!</strong> Alle ${totalCount} Entitäten wurden den korrekten Kategorien zugeordnet.`;

        selects.forEach(s => s.disabled = true);

        const badgeEl = document.getElementById('badge-mode-cat');
        if (badgeEl) {
            badgeEl.innerText = '✓ Gelöst';
            badgeEl.style.color = 'var(--color-symptom, #10b981)';
        }

        categorizationSolved = true;
        if (typeof window.saveChallengeProgress === 'function') {
            window.saveChallengeProgress('categorization', { solved: true });
        }

        if (typeof checkFinalCompletion === 'function') checkFinalCompletion();
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic([10, 50, 15]);
    } else {
        if (typeof applyXpDelta === 'function') applyXpDelta(-15, 'Taxonomie Fehler');
        if (typeof trackSkill === 'function') trackSkill('Diagnostik', false);

        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Nicht ganz:</strong> ${correctCount} von ${totalCount} Zuordnungen sind korrekt. Überprüfe die rot markierten Felder.`;
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(20);
    }
};
