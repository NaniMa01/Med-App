function renderTimeline() {
    const container = document.getElementById('player-container');
    if (!container || !activeCaseData || !activeCaseData.timeline) return;

    container.innerHTML = activeCaseData.timeline.map((step, index) => {
        let text = step.content;
        const hotspots = step.hotspots || []; // Fallback: Leeres Array, falls keine Fehler im JSON definiert sind

        // 1. Linebreaks (\n) schützen, damit lange Texte Absätze behalten
        text = text.replace(/\n/g, '___NEWLINE___');

        if (hotspots.length > 0) {
            // 2. Phrasen durch Platzhalter ersetzen
            hotspots.forEach((hs, i) => {
                const escapedPhrase = hs.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\[?${escapedPhrase}\\]?`, 'g');
                text = text.replace(regex, `___HOTSPOT_TOKEN_${i}___`);
            });
        }

        // 3. ALLE regulären Wörter mit stealth-word ummanteln (auch wenn es 0 Fehler gibt!)
        text = text.split(/(\s+)/).map(part => {
            if (part.includes('___HOTSPOT_TOKEN_') || /^\s+$/.test(part) || part === '___NEWLINE___') {
                return part;
            }
            return `<span class="stealth-word" onclick="handleGenericClick(this)">${part}</span>`;
        }).join('');

        // 4. Hotspot-Tokens wieder in klickbare Fehlerspans umwandeln
        if (hotspots.length > 0) {
            hotspots.forEach((hs, i) => {
                const token = `___HOTSPOT_TOKEN_${i}___`;
                const replacement = `<span class="stealth-hotspot" id="hs-${index}-${i}" onclick="evaluateAuditHotspot(${index}, ${i})">${hs.phrase}</span>`;
                text = text.split(token).join(replacement);
            });
        }

        // 5. Absätze (<br>) für lange Texte wiederherstellen
        text = text.split('___NEWLINE___').join('<br>');

        return `
            <div class="audit-step-container" style="margin-top: 25px; padding: 15px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.75rem; font-weight:800; color:var(--accent-blue); text-transform:uppercase; margin-bottom:12px;">Abschnitt ${index+1}: ${step.phase}</div>
                <div class="step-content" style="line-height: 1.6; font-size: 1rem;">${text}</div>
                <div class="feedback-box" id="audit-fb-${index}" style="display:none; margin-top: 15px;"></div>
                <button class="action-btn secondary" id="clear-step-btn-${index}" onclick="clearStep(${index})" style="width:100%; margin-top:15px;">Abschnitt freigeben (Makellos)</button>
            </div>`;
    }).join('');
}

window.clearStep = function(stepIndex) {
    const step = activeCaseData.timeline[stepIndex];
    const hotspots = step.hotspots || []; 
    
    const hasUnresolved = hotspots.some((hs, i) => hs.is_error && !document.getElementById(`hs-${stepIndex}-${i}`).classList.contains('resolved-signal'));
    
    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    fb.style.display = 'block';

    if (hasUnresolved) {
        applyXpDelta(-100, 'Fahrlässige Freigabe');
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Grobe Fahrlässigkeit (-100 XP):</strong> Es befinden sich noch unentdeckte Fehler in diesem Abschnitt!`;
    } else {
        applyXpDelta(100, 'Abschnitt validiert');
        fb.className = 'feedback-box feedback-success';
        
        if (hotspots.filter(hs => hs.is_error).length === 0) {
            fb.innerHTML = `<strong>Abschnitt freigegeben (+100 XP):</strong> Hervorragend! Du hast dich nicht täuschen lassen, dieser Abschnitt war komplett fehlerfrei.`;
        } else {
            fb.innerHTML = `<strong>Abschnitt freigegeben (+100 XP):</strong> Alle Fehler in diesem Abschnitt verifiziert.`;
        }
        
        document.getElementById(`clear-step-btn-${stepIndex}`).style.display = 'none';
        
        if (typeof clearedStepsCount !== 'undefined') clearedStepsCount++;
        const badge = document.getElementById('badge-mode-audit');
        if (badge && typeof totalStepsCount !== 'undefined') {
            badge.innerText = `${clearedStepsCount}/${totalStepsCount}`;
        }
        
        if (typeof checkFinalCompletion === 'function') checkFinalCompletion();
    }
};

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
        
        fb.innerHTML = `
            <div style="font-weight: 800; color: var(--accent-red, #ef4444); margin-bottom: 6px;">
                ⚠️ Kritischer Fehler identifiziert (+100 XP)
            </div>
            <div style="margin-bottom: 15px; line-height: 1.5; color: var(--text-main, #f1f5f9);">
                Du hast eine pathophysiologisch inkorrekte Aussage gefunden. Kannst du den Fehler im Kopf korrigieren?
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button class="action-btn secondary" onclick="revealHint(${stepIndex}, ${hotspotIndex})">
                    💡 Sokratischen Impuls anzeigen (-50 XP)
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

window.revealHint = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const fb = document.getElementById(`audit-fb-${stepIndex}`);

    // XP-Abzug auslösen und tracken
    applyXpDelta(-50, 'Tutor-Impuls angefordert');

    const explanationText = hs.explanation || hs.feedback || hs.socratic_trap || 'Überlege, welche pathophysiologischen Mechanismen hier wirklich greifen.';

    fb.innerHTML = `
        <div style="font-weight: 800; color: var(--accent-red, #ef4444); margin-bottom: 6px;">
            ⚠️ Kritischer Fehler identifiziert
        </div>
        <div style="margin-bottom: 15px; line-height: 1.5; color: var(--text-main, #f1f5f9);">
            <span style="color: #f59e0b; font-weight: 800;">Tipp (-50 XP):</span> ${explanationText}
        </div>
        <button class="action-btn" onclick="revealSynthesis(${stepIndex}, ${hotspotIndex})" style="width: 100%;">
            Klinische Korrektur & Synthese aufdecken
        </button>
    `;
};

window.revealSynthesis = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    const span = document.getElementById(`hs-${stepIndex}-${hotspotIndex}`);

    if (span) {
        span.style.borderBottomColor = 'var(--accent-green, #10b981)';
        span.style.color = '#f1f5f9';
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
