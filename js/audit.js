// js/audit.js - Challenge Audit mit semantischen Satzbausteinen (3-6 Wörter)

// Hilfsfunktion zum Aufteilen von Text in semantische Chunks (3-6 Wörter)
// js/audit.js - Semantische Klausel-Segmentierung für den Audit-Modus

// Zerlegt den Text intelligent in sprachlich sinnvolle Sinnabschnitte (Klauseln/Phrasen)
// js/audit.js - Natürliche semantische Klausel-Segmentierung für den Audit-Modus

// js/audit.js - Semantische Klausel-Segmentierung im natürlichen Lesefluss

function chunkTextIntoSemanticSegments(text, hotspots = []) {
    if (!text) return [];

    // Trennung an echten Satzgrenzen und Klauseln für korrekte Sinnzusammenhänge
    const rawParts = text.split(/([,;.]\s+|\s+und\s+|\s+oder\s+|\s+während\s+|\s+sodass\s+|\s+da\s+|\s+weil\s+)/g);
    
    let segments = [];
    let currentChunk = '';

    rawParts.forEach(part => {
        if (!part) return;
        currentChunk += part;
        
        if (/[,;.]/.test(part) || currentChunk.split(/\s+/).length >= 5) {
            if (currentChunk.trim().length > 0) {
                segments.push(currentChunk.trim());
                currentChunk = '';
            }
        }
    });

    if (currentChunk.trim().length > 0) {
        segments.push(currentChunk.trim());
    }

    if (segments.length === 0) {
        segments.push(text);
    }

    return segments.map((segText, index) => {
        const matchingHotspotIndex = hotspots.findIndex(hs => {
            return segText.includes(hs.phrase) || hs.phrase.includes(segText);
        });

        return {
            id: `seg_${index}`,
            text: segText,
            hasError: matchingHotspotIndex !== -1,
            hotspotIndex: matchingHotspotIndex !== -1 ? matchingHotspotIndex : null
        };
    });
}

function renderTimeline() {
    const container = document.getElementById('player-container');
    if (!container || !activeCaseData || !activeCaseData.timeline) return;

    container.innerHTML = activeCaseData.timeline.map((step, index) => {
        let rawText = step.content || "";
        const hotspots = step.hotspots || []; 

        const segments = chunkTextIntoSemanticSegments(rawText, hotspots);

        // Rendering als natürlicher Fließtext ohne veränderte Abstände
        const renderedHTML = segments.map((seg) => {
            const textWithSpace = seg.text + ' ';

            if (seg.hasError) {
                return `<span class="stealth-hotspot" id="hs-${index}-${seg.hotspotIndex}" onclick="evaluateAuditHotspot(${index}, ${seg.hotspotIndex})">${textWithSpace}</span>`;
            } else {
                return `<span class="stealth-word" onclick="handleGenericChunkClick(this)">${textWithSpace}</span>`;
            }
        }).join('');

        return `
            <div class="audit-step-container" style="margin-top: 25px; padding: 20px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.75rem; font-weight:800; color:var(--accent-blue); text-transform:uppercase; margin-bottom:12px;">Abschnitt ${index+1}: ${step.phase}</div>
                <div class="step-content" style="line-height: 1.8; font-size: 1rem;">${renderedHTML}</div>
                <div class="feedback-box" id="audit-fb-${index}" style="display:none; margin-top: 15px;"></div>
                <button class="action-btn secondary" id="clear-step-btn-${index}" onclick="clearStep(${index})" style="width:100%; margin-top:15px;">Abschnitt freigeben (Makellos)</button>
            </div>`;
    }).join('');
}

window.handleGenericChunkClick = function(el) {
    if (el.classList.contains('resolved-noise') || el.classList.contains('resolved-generic')) return;
    el.classList.add('resolved-noise');
    applyXpDelta(-20, 'Fehlalarm');
};

window.clearStep = function(stepIndex) {
    const step = activeCaseData.timeline[stepIndex];
    const hotspots = step.hotspots || []; 
    
    const hasUnresolved = hotspots.some((hs, i) => hs.is_error && !document.getElementById(`hs-${stepIndex}-${i}`).classList.contains('resolved-signal'));
    
    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    fb.style.display = 'block';

    if (hasUnresolved) {
        applyXpDelta(-100, 'Fahrlässige Freigabe');
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Grobe Fahrlässigkeit (-100 XP):</strong> Dieser Abschnitt enthält noch unentdeckte klinische Fehler! Studiere die Satzbausteine genauer.`;
    } else {
        applyXpDelta(100, 'Abschnitt validiert');
        fb.className = 'feedback-box feedback-success';
        
        if (hotspots.filter(hs => hs.is_error).length === 0) {
            fb.innerHTML = `<strong>Abschnitt freigegeben (+100 XP):</strong> Hervorragend! Du hast dich nicht täuschen lassen – dieser Abschnitt war komplett fehlerfrei.`;
        } else {
            fb.innerHTML = `<strong>Abschnitt freigegeben (+100 XP):</strong> Alle Fehler in diesem Abschnitt korrekt verifiziert.`;
        }
        
        document.getElementById(`clear-step-btn-${stepIndex}`).style.display = 'none';
        
        if (typeof clearedStepsCount !== 'undefined') clearedStepsCount++;
        const badge = document.getElementById('badge-mode-audit');
        if (badge && typeof totalStepsCount !== 'undefined') {
            badge.innerText = `${clearedStepsCount}/${totalStepsCount}`;
        }

        // SM-2 Tracking Hook
        if (window.SpacedRepetitionEngine && activeCaseData && activeCaseData.case_id) {
            const scorePercent = Math.round((clearedStepsCount / totalStepsCount) * 100);
            const quality = window.SpacedRepetitionEngine.deriveQualityFromMetrics('audit', { scorePercent });

            window.SpacedRepetitionEngine.recordReview({
                itemId: activeCaseData.case_id,
                moduleType: 'audit',
                quality,
                medicalField: activeCaseData.metadata?.medical_field || activeCaseData.folder_name
            }).catch(err => console.warn('[Audit] SM-2 Record Warning:', err));
        }

        if (typeof checkFinalCompletion === 'function') checkFinalCompletion();
    }
};

window.evaluateAuditHotspot = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const span = document.getElementById(`hs-${stepIndex}-${hotspotIndex}`);
    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    
    if (!span || span.classList.contains('resolved-noise') || span.classList.contains('resolved-signal')) return;

    fb.style.display = 'block';

    if (hs.is_error) {
        span.classList.add('resolved-signal');
        trackSkill(hs.skill_tag || 'Pathophysiologie', true);
        applyXpDelta(100, 'Fehler identifiziert');
        fb.className = 'feedback-box feedback-error';
        
        fb.innerHTML = `
            <div style="font-weight: 800; color: var(--accent-red, #ef4444); margin-bottom: 6px;">
                ⚠️ Kritischer Fehler in Satzbaustein identifiziert (+100 XP)
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
                <strong>Erklärung:</strong> ${hs.feedback || 'Dieser Satzbaustein ist im klinischen Kontext fachlich korrekt.'}
            </div>
        `;
    }
};

window.revealHint = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const fb = document.getElementById(`audit-fb-${stepIndex}`);

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
