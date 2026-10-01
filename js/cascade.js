function renderCascades() {
    const wrapper = document.getElementById('cascades-wrapper');
    const cascades = activeCaseData.extra_tasks.clinical_cascades || [];
    totalCascades = cascades.length;
    cascadesSolvedCount = 0;
    document.getElementById('badge-mode-cascade').innerText = `0/${totalCascades}`;

    wrapper.innerHTML = cascades.map((cData, cIndex) => {
        let items = cData.cascade.map((c, i) => ({ ...c, originalIndex: i }));
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }

        const bankHtml = items.map(it => `
            <div class="drag-item" draggable="true" ondragstart="dragStart(event, ${cIndex}, ${it.originalIndex})" onclick="clickPlaceItem(${cIndex}, ${it.originalIndex})" id="drag-${cIndex}-${it.originalIndex}">
                ${it.content}
            </div>`).join('');

        const flowHtml = cData.cascade.map((orig, i) => {
            const labelText = orig.stage.includes('_') ? orig.stage.split('_').slice(1).join(' ') : `Stufe ${i+1}`;
            return `
                <div class="drop-zone-wrapper">
                    <div class="drop-zone-label">${i+1}. ${labelText}</div>
                    <div class="drop-zone" data-cindex="${cIndex}" data-expected="${i}" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="drop(event, ${cIndex}, ${i})" onclick="clickRemoveItem(${cIndex}, ${i})"></div>
                    ${i < cData.cascade.length - 1 ? '<div class="flow-arrow">↓</div>' : ''}
                </div>`;
        }).join('');

        return `
            <div class="cascade-disease-container" id="cascade-box-${cIndex}">
                <div class="disease-title">${cIndex+1}. ${cData.disease}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">Ziehe die Elemente in die chronologische Reihenfolge oder klicke sie an:</div>
                <div class="drag-bank" id="bank-${cIndex}" ondragover="dragOver(event)" ondrop="dropToBank(event, ${cIndex})">${bankHtml}</div>
                <div class="flow-path">${flowHtml}</div>
                <button class="action-btn" onclick="evalSingleCascade(${cIndex})" style="margin-top:20px; width:100%;">Algorithmus prüfen</button>
                <div class="feedback-box" id="cascade-fb-${cIndex}"></div>
            </div>`;
    }).join('');
}

window.dragStart = function(e, cIndex, origIndex) { e.dataTransfer.setData('text/plain', `${cIndex}-${origIndex}`); };
window.dragOver = function(e) { e.preventDefault(); const zone = e.target.closest('.drop-zone'); if (zone) zone.classList.add('drag-over'); };
window.dragLeave = function(e) { const zone = e.target.closest('.drop-zone'); if (zone) zone.classList.remove('drag-over'); };

window.drop = function(e, cIndex, dropIdx) {
    e.preventDefault();
    const zone = e.target.closest('.drop-zone');
    if (zone) zone.classList.remove('drag-over');
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const [itemCIndex, itemOrigIndex] = raw.split('-');
    if (parseInt(itemCIndex) !== cIndex) return;
    const item = document.getElementById(`drag-${itemCIndex}-${itemOrigIndex}`);
    if (!item) return;
    if (zone.children.length > 0) { document.getElementById(`bank-${cIndex}`).appendChild(zone.children[0]); }
    zone.appendChild(item);
};

window.dropToBank = function(e, cIndex) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const [itemCIndex, itemOrigIndex] = raw.split('-');
    if (parseInt(itemCIndex) !== cIndex) return;
    document.getElementById(`bank-${cIndex}`).appendChild(document.getElementById(`drag-${itemCIndex}-${itemOrigIndex}`));
};

window.clickPlaceItem = function(cIndex, origIndex) {
    const item = document.getElementById(`drag-${cIndex}-${origIndex}`);
    if (!item || item.parentElement.classList.contains('drop-zone')) return;
    const container = document.getElementById(`cascade-box-${cIndex}`);
    const emptyZone = Array.from(container.querySelectorAll('.drop-zone')).find(z => z.children.length === 0);
    if (emptyZone) emptyZone.appendChild(item);
};

window.clickRemoveItem = function(cIndex, dropIdx) {
    const container = document.getElementById(`cascade-box-${cIndex}`);
    const zone = container.querySelectorAll('.drop-zone')[dropIdx];
    if (zone && zone.children.length > 0 && !zone.classList.contains('correct')) {
        document.getElementById(`bank-${cIndex}`).appendChild(zone.children[0]);
    }
};

window.evalSingleCascade = function(cIndex) {
    const container = document.getElementById(`cascade-box-${cIndex}`);
    const zones = container.querySelectorAll('.drop-zone');
    const fb = document.getElementById(`cascade-fb-${cIndex}`);
    let filled = 0, correct = true;

    zones.forEach(zone => {
        if (zone.children.length === 0) return;
        filled++;
        const expected = parseInt(zone.getAttribute('data-expected'));
        const actual = parseInt(zone.children[0].id.split('-')[2]);
        if (expected !== actual) correct = false;
    });

    fb.style.display = 'block';
    if (filled < zones.length) {
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Unvollständig:</strong> Bitte platziere alle Stufen in den Ablauf.`;
        return;
    }

    if (correct) {
        applyXpDelta(150, 'Flow-Chart gemeistert');
        trackSkill('Pathophysiologie', true);
        fb.className = 'feedback-box feedback-success';
        fb.innerHTML = `<strong>Hervorragend!</strong> Kaskade für ${activeCaseData.extra_tasks.clinical_cascades[cIndex].disease} fehlerfrei rekonstruiert.`;
        zones.forEach(z => z.classList.add('correct'));
        container.querySelector('.action-btn').style.display = 'none';
        cascadesSolvedCount++;
        document.getElementById('badge-mode-cascade').innerText = `${cascadesSolvedCount}/${totalCascades}`;
        checkFinalCompletion();
    } else {
        applyXpDelta(-30, 'Kaskade Fehler');
        trackSkill('Pathophysiologie', false);
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Kausaler Fehler:</strong> Mindestens eine Stufe befindet sich an der falschen Position.`;
    }
};
