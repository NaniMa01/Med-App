function renderTimeline() {
    const container = document.getElementById('player-container');
    container.innerHTML = activeCaseData.timeline.map((step, index) => {
        let text = step.content;
        if (step.hotspots) {
            step.hotspots.forEach((hs, i) => { text = text.replace(new RegExp(`\\[${hs.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g'), `__HS_${i}__`); });
            text = text.split(/\s+/).map(w => w.startsWith('__HS_') ? w : `<span class="stealth-word" onclick="handleGenericClick(this)">${w}</span>`).join(' ');
            step.hotspots.forEach((hs, i) => { text = text.replace(`__HS_${i}__`, `<span class="stealth-hotspot" id="hs-${index}-${i}" onclick="evaluateAuditHotspot(${index}, ${i})">${hs.phrase}</span>`); });
        }
        return `
            <div style="margin-top:20px;">
                <div style="font-size:0.75rem; font-weight:800; color:var(--accent-blue); text-transform:uppercase; margin-bottom:8px;">Abschnitt ${index+1}: ${step.phase}</div>
                <div class="step-content">${text}</div>
                <div class="feedback-box" id="audit-fb-${index}"></div>
                <button class="action-btn secondary" id="clear-step-btn-${index}" onclick="clearStep(${index})" style="width:100%; margin-top:8px;">Abschnitt freigeben (Makellos)</button>
            </div>`;
    }).join('');
}

window.handleGenericClick = function(el) {
    if (el.classList.contains('resolved-generic')) return;
    el.classList.add('resolved-generic');
    applyXpDelta(-10, 'Unsystematischer Klick');
};

window.evaluateAuditHotspot = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const span = document.getElementById(`hs-${stepIndex}-${hotspotIndex}`);
    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    if (span.classList.contains('resolved-noise') || span.classList.contains('resolved-signal')) return;

    fb.style.display = 'block';
    if (hs.is_error) {
        span.classList.add('resolved-signal');
        trackSkill(hs.skill_tag || 'Pathophysiologie', true);
        applyXpDelta(100, 'Fehler identifiziert');
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Kritischer Fehler!</strong><br><br><strong>Sokratischer Einspruch:</strong> ${hs.socratic_trap}<br><br><button class="action-btn" onclick="revealSynthesis(${stepIndex}, ${hotspotIndex})">Synthese aufdecken</button>`;
    } else {
        span.classList.add('resolved-noise');
        trackSkill(hs.skill_tag || 'Pathophysiologie', false);
        applyXpDelta(-40, 'Fehlalarm');
        fb.className = 'feedback-box feedback-neutral';
        fb.innerHTML = `<strong>Fehlalarm (-40 XP):</strong> ${hs.feedback}`;
    }
};

window.revealSynthesis = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    fb.className = 'feedback-box feedback-success';
    fb.innerHTML = `<strong>Synthese:</strong> ${hs.correct_pathophysiology}`;
};

window.clearStep = function(stepIndex) {
    const step = activeCaseData.timeline[stepIndex];
    const hasUnresolved = step.hotspots && step.hotspots.some((hs, i) => hs.is_error && !document.getElementById(`hs-${stepIndex}-${i}`).classList.contains('resolved-signal'));
    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    fb.style.display = 'block';

    if (hasUnresolved) {
        applyXpDelta(-100, 'Fahrlässige Freigabe');
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Grobe Fahrlässigkeit (-100 XP):</strong> Es befinden sich noch unentdeckte Fehler in diesem Abschnitt!`;
    } else {
        applyXpDelta(100, 'Abschnitt validiert');
        fb.className = 'feedback-box feedback-success';
        fb.innerHTML = `<strong>Abschnitt freigegeben (+100 XP):</strong> Fehlerfrei verifiziert.`;
        document.getElementById(`clear-step-btn-${stepIndex}`).style.display = 'none';
        clearedStepsCount++;
        document.getElementById('badge-mode-audit').innerText = `${clearedStepsCount}/${totalStepsCount}`;
        checkFinalCompletion();
    }
};
