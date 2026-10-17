// ==========================================================================
// js/audit.js – Editorial Clinical Audit Engine
// Schlichtes, wissenschaftliches Text-Layout mit präziser Phrasen-Gruppierung
// ==========================================================================

/**
 * Zerlegt einen Absatz in natürliche sprachliche Sinnabschnitte (Klauseln)
 * und bewahrt definierte Hotspots exakt als zusammengehörige Einheiten,
 * ohne dass eckige Klammern [ ] im Text sichtbar bleiben.
 */
function parseParagraphIntoSegments(paragraphText, hotspots = []) {
    if (!paragraphText) return [];

    // 1. Eckige Klammern entfernen, aber Positionen der Hotspots exakt merken
    let cleanText = paragraphText.replace(/\[([^\]]+)\]/g, '$1');

    // 2. Alle bekannten Hotspots im bereinigten Text lokalisieren
    let ranges = [];
    hotspots.forEach((hs, idx) => {
        if (!hs || !hs.phrase) return;
        const cleanPhrase = hs.phrase.replace(/^\[\vert{}\]$/g, '').trim();
        if (!cleanPhrase) return;

        let searchStart = 0;
        while (searchStart < cleanText.length) {
            const foundPos = cleanText.indexOf(cleanPhrase, searchStart);
            if (foundPos === -1) break;

            const foundEnd = foundPos + cleanPhrase.length;
            const overlaps = ranges.some(r => !(foundEnd <= r.start || foundPos >= r.end));
            if (!overlaps) {
                ranges.push({
                    start: foundPos,
                    end: foundEnd,
                    hotspotIndex: idx,
                    text: cleanText.slice(foundPos, foundEnd)
                });
            }
            searchStart = foundEnd;
        }
    });

    ranges.sort((a, b) => a.start - b.start);

    // 3. Text in abwechselnde Blöcke (Normaltext vs. Hotspot) aufteilen
    let blocks = [];
    let cursor = 0;

    ranges.forEach(r => {
        if (r.start > cursor) {
            blocks.push({ type: 'plain', text: cleanText.slice(cursor, r.start) });
        }
        blocks.push({
            type: 'hotspot',
            text: r.text,
            hotspotIndex: r.hotspotIndex
        });
        cursor = r.end;
    });

    if (cursor < cleanText.length) {
        blocks.push({ type: 'plain', text: cleanText.slice(cursor) });
    }

    // 4. Normaltext-Blöcke in angenehme, natürliche Satzbausteine (4-7 Wörter / Klauseln) gliedern
    let finalSegments = [];

    blocks.forEach(block => {
        if (block.type === 'hotspot') {
            // Satzzeichen direkt nach einer Hotspot-Klammer sanft an den Hotspot anbinden
            finalSegments.push({
                text: block.text.trim(),
                isHotspot: true,
                hotspotIndex: block.hotspotIndex
            });
        } else {
            // Falls der Block mit einem Satzzeichen beginnt (z.B. Punkt nach Hotspot), an vorheriges Segment hängen
            let textToChunk = block.text;
            const leadingPunctMatch = textToChunk.match(/^([.,;:!?]+)(\s*)/);
            if (leadingPunctMatch && finalSegments.length > 0) {
                finalSegments[finalSegments.length - 1].text += leadingPunctMatch[1];
                textToChunk = textToChunk.slice(leadingPunctMatch[0].length);
            }

            const clauses = splitIntoNaturalClauses(textToChunk);
            clauses.forEach(clause => {
                if (clause.trim().length > 0) {
                    finalSegments.push({
                        text: clause.trim(),
                        isHotspot: false,
                        hotspotIndex: null
                    });
                }
            });
        }
    });

    return finalSegments;
}

/**
 * Hilfsfunktion: Teilt normalen Fließtext an Satzzeichen, Konjunktionen
 * oder nach ca. 5-7 Wörtern in ruhige, lesefreundliche Phrasen.
 */
function splitIntoNaturalClauses(text) {
    if (!text || !text.trim()) return [];

    const tokens = text.trim().split(/\s+/);
    const conjunctions = new Set([
        'und', 'oder', 'sowie', 'während', 'sodass', 'da', 'weil',
        'obwohl', 'jedoch', 'aber', 'denn', 'wobei', 'woraufhin', 'zumal'
    ]);

    let clauses = [];
    let currentWords = [];

    for (let i = 0; i < tokens.length; i++) {
        const word = tokens[i];
        const cleanWord = word.toLowerCase().replace(/[^a-zäöüß]/g, '');

        // Vor einer Konjunktion trennen, wenn der aktuelle Baustein schon mindestens 3 Wörter hat
        if (conjunctions.has(cleanWord) && currentWords.length >= 3) {
            clauses.push(currentWords.join(' '));
            currentWords = [word];
            continue;
        }

        currentWords.push(word);

        const endsWithPunct = /[,;:.!?]$/.test(word);
        const remainingWords = tokens.length - 1 - i;

        // Trennen bei Satzzeichen oder nach 6 Wörtern (verhindert einzelne Waisen-Wörter am Satzende)
        if (endsWithPunct || (currentWords.length >= 6 && remainingWords >= 2)) {
            clauses.push(currentWords.join(' '));
            currentWords = [];
        }
    }

    if (currentWords.length > 0) {
        if (clauses.length > 0 && currentWords.length === 1 && !/[,;:.!?]$/.test(clauses[clauses.length - 1])) {
            clauses[clauses.length - 1] += ' ' + currentWords[0];
        } else {
            clauses.push(currentWords.join(' '));
        }
    }

    return clauses;
}

/**
 * Gliedert einen langen Rohtext in logische, gut lesbare Absätze (je 2-3 Sätze),
 * falls vom Autor noch keine expliziten Absätze (\n\n) gesetzt wurden.
 */
function splitStepIntoEditorialParagraphs(rawText) {
    if (!rawText) return [];

    // 1. Explizite Absätze bevorzugen
    const explicitParagraphs = rawText
        .split(/\n\s*\n|<br\s*\/?>\s*<br\s*\/?>/i)
        .map(p => p.trim())
        .filter(Boolean);

    if (explicitParagraphs.length > 1) {
        return explicitParagraphs;
    }

    // 2. Lange Einzelblöcke intelligent alle 2 Sätze gruppieren (schützt Abkürzungen wie "A. spinalis" oder "z. B.")
    const singleBlock = explicitParagraphs[0] || rawText.trim();
    const sentenceRegex = /[^.!?]+(?:\.(?:\s+(?=[A-ZÄÖÜ0-9"„])|$)\vert{}[!?]+(?:\s+\vert{}$))/g;
    const rawSentences = singleBlock.match(sentenceRegex);

    if (!rawSentences || rawSentences.length <= 2) {
        return [singleBlock];
    }

    // Kurze Fragmente (z. B. nach "A." oder "ca.") wieder mit dem Folgesatz verschmelzen
    let mergedSentences = [];
    let buffer = '';

    rawSentences.forEach(s => {
        buffer += (buffer ? ' ' : '') + s.trim();
        const endsWithAbbrev = /\b([A-Za-z]|ca|bzw|inkl|ggf|evtl|sog|z\.\s*B|u\.\s*a|d\.\s*h|Dr|Prof|St|mind|max)\.$/i.test(buffer);
        if (!endsWithAbbrev && buffer.split(/\s+/).length >= 5) {
            mergedSentences.push(buffer);
            buffer = '';
        }
    });
    if (buffer) {
        if (mergedSentences.length > 0) {
            mergedSentences[mergedSentences.length - 1] += ' ' + buffer;
        } else {
            mergedSentences.push(buffer);
        }
    }

    // Jeweils 2 Sätze zu einem ruhigen Lese-Absatz bündeln
    let paragraphs = [];
    for (let i = 0; i < mergedSentences.length; i += 2) {
        paragraphs.push(mergedSentences.slice(i, i + 2).join(' '));
    }

    return paragraphs;
}

/**
 * Haupt-Renderer für das klinische Audit
 */
function renderTimeline() {
    const container = document.getElementById('player-container');
    if (!container || !activeCaseData || !activeCaseData.timeline) return;

    const savedAuditState = (typeof ProgressManager !== 'undefined' && activeCaseData.case_id && !window.isSpecialtyBlindMode)
        ? (ProgressManager.getCaseProgress(activeCaseData.case_id)?.audit || {})
        : {};
    const clearedMap = savedAuditState.clearedStepsMap || {};

    container.innerHTML = activeCaseData.timeline.map((step, stepIndex) => {
        const rawText = step.content || '';
        const hotspots = step.hotspots || [];
        const isStepCleared = !!clearedMap[stepIndex];

        const paragraphs = splitStepIntoEditorialParagraphs(rawText);

        const paragraphsHTML = paragraphs.map(paraText => {
            const segments = parseParagraphIntoSegments(paraText, hotspots);

            const spansHTML = segments.map(seg => {
                if (seg.isHotspot) {
                    return `<span class="stealth-hotspot" data-hs-group="hs-${stepIndex}-${seg.hotspotIndex}" id="hs-${stepIndex}-${seg.hotspotIndex}" onclick="evaluateAuditHotspot(${stepIndex}, ${seg.hotspotIndex})">${seg.text}</span>`;
                } else {
                    return `<span class="stealth-word" onclick="handleGenericChunkClick(this)">${seg.text}</span>`;
                }
            }).join(' ');

            return `<p class="audit-paragraph">${spansHTML}</p>`;
        }).join('');

        return `
            <article class="audit-step-container" id="audit-step-${stepIndex}">
                <header class="audit-step-header">
                    <span class="audit-step-kicker">Abschnitt ${stepIndex + 1}</span>
                    <h3 class="audit-step-title">${step.phase || 'Klinischer Verlauf'}</h3>
                </header>
                <div class="step-content audit-editorial-body">
                    ${paragraphsHTML}
                </div>
                <div class="feedback-box" id="audit-fb-${stepIndex}" style="display:${isStepCleared ? 'block' : 'none'};" ${isStepCleared ? 'class="feedback-box feedback-success"' : ''}>
                    ${isStepCleared ? '<strong>Abschnitt validiert:</strong> Dieser klinische Abschnitt wurde bereits vollständig geprüft.' : ''}
                </div>
                <div class="audit-step-footer" id="audit-footer-${stepIndex}" style="display:${isStepCleared ? 'none' : 'flex'};">
                    <button type="button" class="action-btn secondary audit-clear-btn" id="clear-step-btn-${stepIndex}" onclick="clearStep(${stepIndex})">
                        Abschnitt als fachlich korrekt freigeben
                    </button>
                </div>
            </article>
        `;
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

    const hasUnresolved = hotspots.some((hs, i) => {
        if (!hs.is_error) return false;
        const el = document.getElementById(`hs-${stepIndex}-${i}`);
        return el && !el.classList.contains('resolved-signal');
    });

    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    if (!fb) return;
    fb.style.display = 'block';

    if (hasUnresolved) {
        applyXpDelta(-100, 'Fahrlässige Freigabe');
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Freigabe abgelehnt (-100 XP):</strong> Dieser Abschnitt enthält noch unentdeckte fachliche Fehler. Prüfe die Aussagen noch einmal sorgfältig.`;
    } else {
        applyXpDelta(100, 'Abschnitt validiert');
        fb.className = 'feedback-box feedback-success';

        if (hotspots.filter(hs => hs.is_error).length === 0) {
            fb.innerHTML = `<strong>Abschnitt freigegeben (+100 XP):</strong> Korrekt eingeschätzt. Dieser Abschnitt enthielt keine pathophysiologischen oder klinischen Fehler.`;
        } else {
            fb.innerHTML = `<strong>Abschnitt freigegeben (+100 XP):</strong> Alle kritischen Fehler in diesem Abschnitt wurden erfolgreich identifiziert.`;
        }

        const footer = document.getElementById(`audit-footer-${stepIndex}`);
        if (footer) footer.style.display = 'none';

        const btn = document.getElementById(`clear-step-btn-${stepIndex}`);
        if (btn) btn.style.display = 'none';

        if (typeof clearedStepsCount !== 'undefined') clearedStepsCount++;
        const badge = document.getElementById('badge-mode-audit');
        if (badge && typeof totalStepsCount !== 'undefined') {
            badge.innerText = `${clearedStepsCount}/${totalStepsCount}`;
        }

        // Fortschritt dauerhaft speichern
        if (typeof ProgressManager !== 'undefined' && activeCaseData?.case_id) {
            const existing = ProgressManager.getCaseProgress(activeCaseData.case_id)?.audit || {};
            const clearedStepsMap = existing.clearedStepsMap || {};
            clearedStepsMap[stepIndex] = true;
            ProgressManager.saveCaseState(activeCaseData.case_id, {
                audit: {
                    clearedStepsCount: clearedStepsCount,
                    clearedStepsMap: clearedStepsMap
                }
            });
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
            <div class="audit-fb-title">Klinische Unstimmigkeit identifiziert (+100 XP)</div>
            <p class="audit-fb-text">
                Diese Passage enthält eine fachlich inkorrekte Aussage. Überlege dir zunächst selbstständig die pathophysiologische Korrektur, bevor du die Auflösung einblendest.
            </p>
            <div class="audit-fb-actions">
                <button type="button" class="action-btn secondary" onclick="revealHint(${stepIndex}, ${hotspotIndex})">
                    Sokratischen Impuls anzeigen (-50 XP)
                </button>
                <button type="button" class="action-btn" onclick="revealSynthesis(${stepIndex}, ${hotspotIndex})">
                    Synthese und Korrektur anzeigen
                </button>
            </div>
        `;
    } else {
        span.classList.add('resolved-noise');
        trackSkill(hs.skill_tag || 'Pathophysiologie', false);
        applyXpDelta(-40, 'Fehlalarm');
        fb.className = 'feedback-box feedback-neutral';
        fb.innerHTML = `
            <div class="audit-fb-title">Fachlich korrekte Aussage (-40 XP)</div>
            <p class="audit-fb-text">
                ${hs.feedback || 'Dieser Satzbaustein ist im vorliegenden klinischen Kontext medizinisch zutreffend.'}
            </p>
        `;
    }
};

window.revealHint = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const fb = document.getElementById(`audit-fb-${stepIndex}`);

    applyXpDelta(-50, 'Tutor-Impuls angefordert');
    const explanationText = hs.socratic_trap || hs.explanation || hs.feedback || 'Überlege, welche pathophysiologischen Mechanismen in dieser Konstellation greifen.';

    fb.innerHTML = `
        <div class="audit-fb-title">Sokratischer Impuls (-50 XP)</div>
        <p class="audit-fb-text">${explanationText}</p>
        <div class="audit-fb-actions">
            <button type="button" class="action-btn" onclick="revealSynthesis(${stepIndex}, ${hotspotIndex})">
                Klinische Korrektur und Synthese aufdecken
            </button>
        </div>
    `;
};

window.revealSynthesis = function(stepIndex, hotspotIndex) {
    const hs = activeCaseData.timeline[stepIndex].hotspots[hotspotIndex];
    const fb = document.getElementById(`audit-fb-${stepIndex}`);
    const span = document.getElementById(`hs-${stepIndex}-${hotspotIndex}`);

    if (span) {
        span.classList.add('resolved-corrected');
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
        <div class="audit-fb-title">Pathophysiologische Synthese</div>
        <p class="audit-fb-text">${synthesisText}</p>
    `;
};
