function renderTimeline() {
    const container = document.getElementById('player-container');
    container.innerHTML = activeCaseData.timeline.map((step, index) => {
        let text = step.content;

        if (step.hotspots && step.hotspots.length > 0) {
            // 1. Phrasen ersetzen – flexibel MIT oder OHNE eckige Klammern im Originaltext:
            step.hotspots.forEach((hs, i) => {
                const escapedPhrase = hs.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Erfasst sowohl [Phrase] als auch Phrase im Text
                const regex = new RegExp(`\\[?${escapedPhrase}\\]?`, 'g');
                text = text.replace(regex, `___HOTSPOT_TOKEN_${i}___`);
            });

            // 2. Reguläre Wörter mit stealth-word ummanteln
            text = text.split(/(\s+)/).map(part => {
                if (part.includes('___HOTSPOT_TOKEN_') || /^\s+$/.test(part)) {
                    return part;
                }
                return `<span class="stealth-word" onclick="handleGenericClick(this)">${part}</span>`;
            }).join('');

            // 3. Hotspot-Tokens mit den echten klickbaren Spans belegen
            step.hotspots.forEach((hs, i) => {
                const token = `___HOTSPOT_TOKEN_${i}___`;
                const replacement = `<span class="stealth-hotspot" id="hs-${index}-${i}" onclick="evaluateAuditHotspot(${index}, ${i})">${hs.phrase}</span>`;
                text = text.replaceAll(token, replacement);
            });
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
    
    // Verhindern, dass bereits gelöste Hotspots erneut getriggert werden
    if (span.classList.contains('resolved-noise') || span.classList.contains('resolved-signal')) return;

    fb.style.display = 'block';

    if (hs.is_error) {
        span.classList.add('resolved-signal');
        trackSkill(hs.skill_tag || 'Pathophysiologie', true);
        applyXpDelta(100, 'Fehler identifiziert');
        fb.className = 'feedback-box feedback-error';
        
        // Dynamischer Fallback: nimmt 'explanation', falls vorhanden, sonst 'feedback' oder 'socratic_trap'
        const errorExplanation = hs.explanation || hs.feedback || hs.socratic_trap || 'Diese Aussage ist pathophysiologisch inkorrekt.';

        fb.innerHTML = `
            <div style="font-weight: 700; color: var(--accent-red, #ef4444); margin-bottom: 6px;">
                ⚠️ Kritischer Fehler identifiziert (+100 XP)
            </div>
            <div style="margin-bottom: 10px; line-height: 1.5;">
                <strong>Erklärung:</strong> ${errorExplanation}
            </div>
            <button class="action-btn" onclick="revealSynthesis(${stepIndex}, ${hotspotIndex})">
                Klinische Korrektur & Synthese aufdecken
            </button>
        `;
    } else {
        span.classList.add('resolved-noise');
        trackSkill(hs.skill_tag || 'Pathophysiologie', false);
        applyXpDelta(-40, 'Fehlalarm');
        fb.className = 'feedback-box feedback-neutral';
        fb.innerHTML = `
            <div style="font-weight: 700; color: var(--text-muted, #94a3b8); margin-bottom: 6px;">
                Fehlalarm (-40 XP)
            </div>
            <div style="line-height: 1.5;">
                <strong>Erklärung:</strong> ${hs.feedback || 'Diese Aussage ist im vorliegenden Kontext fachlich korrekt.'}
            </div>
        `;
    }
};

window.revealSynthesis = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const span = document.getElementById(`hs-${stepIndex}-${hotspotIndex}`);
    const fb = document.getElementById(`audit-fb-${stepIndex}`);

    // Visueller Abschluss im Text
    if (span) span.style.borderBottomColor = 'var(--accent-green, #10b981)';

    fb.className = 'feedback-box feedback-success';
    fb.innerHTML = `
        <div style="font-weight: 700; color: var(--accent-green, #10b981); margin-bottom: 6px;">
            ✓ Korrekte Pathophysiologie & Synthese
        </div>
        <div style="line-height: 1.5;">
            ${hs.correct_pathophysiology}
        </div>
    `;
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
