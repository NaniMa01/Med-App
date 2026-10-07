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
    
    // Verhindert Mehrfachklicks
    if (span.classList.contains('resolved-noise') || span.classList.contains('resolved-signal')) return;

    fb.style.display = 'block';

    if (hs.is_error) {
        span.classList.add('resolved-signal');
        trackSkill(hs.skill_tag || 'Pathophysiologie', true);
        applyXpDelta(100, 'Fehler identifiziert');
        fb.className = 'feedback-box feedback-error';
        
        // STUFE 1: Treffer bestätigen und intellektuelle Weichenstellung anbieten
        fb.innerHTML = `
            <div style="font-weight: 800; color: var(--accent-red, #ef4444); margin-bottom: 6px;">
                ⚠️ Kritischer Fehler identifiziert (+100 XP)
            </div>
            <div style="margin-bottom: 15px; line-height: 1.5; color: var(--text-main, #f1f5f9);">
                Du hast eine pathophysiologisch inkorrekte Aussage gefunden. Kannst du den Fehler im Kopf korrigieren?
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button class="action-btn secondary" onclick="revealHint(${stepIndex}, ${hotspotIndex})">
                    💡 Sokratischen Impuls (Tipp) anzeigen
                </button>
                <button class="action-btn" onclick="revealSynthesis(${stepIndex}, ${hotspotIndex})">
                    Direkt zur Synthese & Auflösung
                </button>
            </div>
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
            <div style="line-height: 1.5; color: var(--text-main, #f1f5f9);">
                <strong>Erklärung:</strong> ${hs.feedback || 'Diese Feststellung ist im klinischen Kontext fachlich korrekt.'}
            </div>
        `;
    }
};

// NEUE FUNKTION: Stufe 2 - Der Tutor gibt einen Hint
window.revealHint = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const fb = document.getElementById(`audit-fb-${stepIndex}`);

    // Dynamischer Fallback für den Hint
    const explanationText = hs.explanation || hs.feedback || hs.socratic_trap || 'Überlege, welche pathophysiologischen Mechanismen hier wirklich greifen.';

    fb.innerHTML = `
        <div style="font-weight: 800; color: var(--accent-red, #ef4444); margin-bottom: 6px;">
            ⚠️ Kritischer Fehler identifiziert
        </div>
        <div style="margin-bottom: 15px; line-height: 1.5; color: var(--text-main, #f1f5f9);">
            <strong>Tutor-Impuls:</strong> ${explanationText}
        </div>
        <button class="action-btn" onclick="revealSynthesis(${stepIndex}, ${hotspotIndex})" style="width: 100%;">
            Klinische Korrektur & Synthese aufdecken
        </button>
    `;
};

// STUFE 3: Die finale Auflösung
window.revealSynthesis = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    const span = document.getElementById(`hs-${stepIndex}-${hotspotIndex}`);

    // Visuelles Feedback: Markierung im Text auf gelöst (grün) setzen
    if (span) {
        span.style.borderBottomColor = 'var(--accent-green, #10b981)';
        span.style.color = '#f1f5f9'; // Hebt den Text noch etwas mehr vom Hintergrund ab
    }

    const synthesisText = hs.correct_pathophysiology 
                       || hs.synthesis 
                       || hs.correction 
                       || hs.solution 
                       || hs.pathophysiology 
                       || hs.feedback 
                       || 'Keine detaillierte Synthese hinterlegt.';

    fb.className = 'feedback-box feedback-success';
    fb.innerHTML = `
        <div style="font-weight: 800; color: var(--accent-green, #10b981); margin-bottom: 6px;">
            ✓ Korrekte Pathophysiologie & Synthese
        </div>
        <div style="line-height: 1.5; color: var(--text-main, #f1f5f9);">
            ${synthesisText}
        </div>
    `;
};


    fb.className = 'feedback-box feedback-success';
    fb.innerHTML = `
        <div style="font-weight: 800; color: var(--accent-green, #10b981); margin-bottom: 6px;">
            ✓ Korrekte Pathophysiologie & Synthese
        </div>
        <div style="line-height: 1.5; color: var(--text-main, #f1f5f9);">
            ${synthesisText}
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
