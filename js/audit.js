// ==========================================================================
// js/audit.js – Editorial Clinical Audit & PACS Gate Engine (V2.5)
// Wissenschaftliches Text-Layout mit präziser Phrasen-Gruppierung,
// persistenter Hotspot-Telemetrie, PACS-Konsil-Gate & Lern-Depot-Export
// ==========================================================================

(function initEditorialAuditEngine() {
    let lastUnlockedStudyId = null;

    function escapeAuditHtml(str) {
        return String(str || '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function normalizeForMatch(str) {
        return String(str || '')
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/\u00A0/g, ' ');
    }

    // Liest und speichert den detaillierten Audit-Fortschritt (inkl. einzelner Hotspots)
    function getAuditProgressState() {
        const caseData = window.activeCaseData;
        if (!caseData || !caseData.case_id || window.isSpecialtyBlindMode || typeof ProgressManager === 'undefined') {
            return { clearedStepsCount: 0, clearedStepsMap: {}, resolvedHotspotsMap: {} };
        }
        const saved = ProgressManager.getCaseProgress(caseData.case_id)?.audit || {};
        return {
            clearedStepsCount: saved.clearedStepsCount || 0,
            clearedStepsMap: { ...(saved.clearedStepsMap || {}) },
            resolvedHotspotsMap: { ...(saved.resolvedHotspotsMap || {}) }
        };
    }

    function saveAuditProgressState(partialAuditState) {
        const caseData = window.activeCaseData;
        if (!caseData || !caseData.case_id || window.isSpecialtyBlindMode || typeof ProgressManager === 'undefined') {
            return;
        }
        const current = getAuditProgressState();
        const nextState = {
            ...current,
            ...partialAuditState,
            clearedStepsMap: { ...current.clearedStepsMap, ...(partialAuditState.clearedStepsMap || {}) },
            resolvedHotspotsMap: { ...current.resolvedHotspotsMap, ...(partialAuditState.resolvedHotspotsMap || {}) }
        };
        ProgressManager.saveCaseState(caseData.case_id, { audit: nextState });
    }

    /**
     * Zerlegt einen Absatz in natürliche sprachliche Sinnabschnitte (Klauseln)
     * und bewahrt definierte Hotspots exakt als zusammengehörige Einheiten,
     * ohne dass eckige Klammern [ ] im Text sichtbar bleiben.
     */
    function parseParagraphIntoSegments(paragraphText, hotspots = []) {
        if (!paragraphText) return [];

        // 1. Eckige Klammern entfernen, aber Positionen der Hotspots exakt merken
        const cleanText = paragraphText.replace(/\[([^\]]+)\]/g, '$1');
        const normCleanText = normalizeForMatch(cleanText);

        // 2. Alle bekannten Hotspots im bereinigten Text lokalisieren
        const ranges = [];
        hotspots.forEach((hs, idx) => {
            if (!hs || !hs.phrase) return;
            // FIX: Korrekte Regex-Pipe | statt \vert{} zum Entfernen führender/schließender Klammern
            const cleanPhrase = String(hs.phrase).replace(/^\[|\]$/g, '').trim();
            if (!cleanPhrase) return;

            const normPhrase = normalizeForMatch(cleanPhrase);
            let searchStart = 0;

            while (searchStart < normCleanText.length) {
                let foundPos = normCleanText.indexOf(normPhrase, searchStart);
                if (foundPos === -1) {
                    // Case-insensitive Fallback
                    foundPos = normCleanText.toLowerCase().indexOf(normPhrase.toLowerCase(), searchStart);
                }
                if (foundPos === -1) break;

                const foundEnd = foundPos + normPhrase.length;
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
        const blocks = [];
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
        const finalSegments = [];

        blocks.forEach(block => {
            if (block.type === 'hotspot') {
                finalSegments.push({
                    text: block.text.trim(),
                    isHotspot: true,
                    hotspotIndex: block.hotspotIndex
                });
            } else {
                // Falls der Block mit einem Satzzeichen beginnt (z. B. Punkt nach Hotspot), an vorheriges Segment hängen
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

        const clauses = [];
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

        // Doppelt escapte Zeilenumbrüche (\\n\\n aus JSON-Generatoren) sauber normalisieren
        const normalizedRaw = String(rawText).replace(/\\n/g, '\n');

        // 1. Explizite Absätze bevorzugen
        const explicitParagraphs = normalizedRaw
            .split(/\n\s*\n|<br\s*\/?>\s*<br\s*\/?>/i)
            .map(p => p.trim())
            .filter(Boolean);

        if (explicitParagraphs.length > 1) {
            return explicitParagraphs;
        }

        // 2. Lange Einzelblöcke intelligent alle 2 Sätze gruppieren (schützt Abkürzungen wie "A. spinalis" oder "z. B.")
        const singleBlock = explicitParagraphs[0] || normalizedRaw.trim();
        // FIX: Korrekte Regex-Pipes | statt \vert{}
        const sentenceRegex = /[^.!?]+(?:\.(?:\s+(?=[A-ZÄÖÜ0-9"„])|$)|[!?]+(?:\s+|$))/g;
        const rawSentences = singleBlock.match(sentenceRegex);

        if (!rawSentences || rawSentences.length <= 2) {
            return [singleBlock];
        }

        // Kurze Fragmente (z. B. nach "A." oder "ca.") wieder mit dem Folgesatz verschmelzen
        const mergedSentences = [];
        let buffer = '';

        rawSentences.forEach(s => {
            buffer += (buffer ? ' ' : '') + s.trim();
            const endsWithAbbrev = /\b([A-Za-z]|ca|bzw|inkl|ggf|evtl|sog|z\.\s*B|u\.\s*a|d\.\s*h|Dr|Prof|St|mind|max|vgl|Nr|Abb|Tab)\.$/i.test(buffer);
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
        const paragraphs = [];
        for (let i = 0; i < mergedSentences.length; i += 2) {
            paragraphs.push(mergedSentences.slice(i, i + 2).join(' '));
        }

        return paragraphs;
    }

    /**
     * Prüft, ob für einen Audit-Schritt eine PACS-/Radiopaedia-Aufnahme verknüpft ist
     */
    function getStepImagingGateInfo(step, stepIndex) {
        const caseId = window.activeCaseData?.case_id;
        if (!window.ImagingModule || typeof window.ImagingModule.getStudyForAuditStep !== 'function') {
            return { study: null, isLocked: false };
        }
        const study = window.ImagingModule.getStudyForAuditStep(step, stepIndex);
        if (!study) return { study: null, isLocked: false };

        const isSolved = window.ImagingModule.isStudySolved(caseId, study.id);
        return {
            study,
            isLocked: !isSolved
        };
    }

    /**
     * Haupt-Renderer für das klinische Audit
     */
    function renderTimeline() {
        const container = document.getElementById('player-container');
        const caseData = window.activeCaseData;
        if (!container || !caseData || !Array.isArray(caseData.timeline)) return;

        const auditState = getAuditProgressState();
        const clearedMap = auditState.clearedStepsMap || {};
        const resolvedHsMap = auditState.resolvedHotspotsMap || {};

        // Synchronisiere globalen Zähler mit den tatsächlich gespeicherten Abschnitten
        const clearedCount = Object.keys(clearedMap).filter(k => clearedMap[k]).length;
        if (typeof window.clearedStepsCount !== 'undefined') {
            window.clearedStepsCount = clearedCount;
        }
        const badge = document.getElementById('badge-mode-audit');
        if (badge) {
            badge.innerText = `${clearedCount}/${caseData.timeline.length}`;
        }

        container.innerHTML = caseData.timeline.map((step, stepIndex) => {
            const rawText = step.content || '';
            const hotspots = step.hotspots || [];
            const isStepCleared = !!clearedMap[stepIndex];

            // PACS-Befundungs-Gate prüfen
            const { study: linkedStudy, isLocked: isPacsLocked } = getStepImagingGateInfo(step, stepIndex);
            const justUnlocked = linkedStudy && !isPacsLocked && lastUnlockedStudyId === linkedStudy.id;

            const paragraphs = splitStepIntoEditorialParagraphs(rawText);

            const paragraphsHTML = paragraphs.map(paraText => {
                const segments = parseParagraphIntoSegments(paraText, hotspots);

                const spansHTML = segments.map(seg => {
                    if (seg.isHotspot) {
                        const hsKey = `${stepIndex}_${seg.hotspotIndex}`;
                        const savedHsStatus = resolvedHsMap[hsKey]; // 'signal' | 'corrected' | 'noise'
                        let stateClasses = 'stealth-hotspot';
                        if (savedHsStatus === 'signal') stateClasses += ' resolved-signal';
                        else if (savedHsStatus === 'corrected') stateClasses += ' resolved-signal resolved-corrected';
                        else if (savedHsStatus === 'noise') stateClasses += ' resolved-noise';

                        const clickHandler = isPacsLocked
                            ? `window.handleLockedAuditPacsClick('${escapeAuditHtml(linkedStudy.id)}')`
                            : `window.evaluateAuditHotspot(${stepIndex}, ${seg.hotspotIndex})`;

                        return `<span class="${stateClasses}" data-hs-group="hs-${stepIndex}-${seg.hotspotIndex}" id="hs-${stepIndex}-${seg.hotspotIndex}" role="button" tabindex="0" onclick="${clickHandler}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${clickHandler};}">${escapeAuditHtml(seg.text)}</span>`;
                    } else {
                        const clickHandler = isPacsLocked
                            ? `window.handleLockedAuditPacsClick('${escapeAuditHtml(linkedStudy.id)}')`
                            : `window.handleGenericChunkClick(this, ${stepIndex})`;

                        return `<span class="stealth-word" onclick="${clickHandler}">${escapeAuditHtml(seg.text)}</span>`;
                    }
                }).join(' ');

                return `<p class="audit-paragraph">${spansHTML}</p>`;
            }).join('');

            // PACS-Konsil-Button im Header (falls Bildgebung zu diesem Schritt gehört)
            const pacsHeaderBtnHtml = linkedStudy ? `
                <button type="button" class="pacs-tool-btn" style="margin-left:auto;"
                        onclick="window.ImagingModule.focusStudyFromAudit('${escapeAuditHtml(linkedStudy.id)}')">
                    🩻 ${escapeAuditHtml(linkedStudy.modality)} ${isPacsLocked ? '(Befundung offen)' : '✓ Befundet'}
                </button>
            ` : '';

            // PACS-Konsil-Blocker Banner (falls Bild noch nicht im PACS gelöst wurde)
            const pacsGateBannerHtml = isPacsLocked ? `
                <div class="audit-pacs-gate-lock">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:1.3rem;">🔒</span>
                        <div>
                            <div style="font-weight:800; color:#fcd34d; font-size:0.84rem;">
                                Radiologische Befundung ausstehend: ${escapeAuditHtml(linkedStudy.title)}
                            </div>
                            <div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">
                                Bitte markiere und befunde zuerst die Aufnahme im PACS-Monitor oben, bevor du diesen klinischen Abschnitt auditierst.
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <button type="button" class="action-btn btn-sm"
                                onclick="window.ImagingModule.focusStudyFromAudit('${escapeAuditHtml(linkedStudy.id)}')">
                            🩻 Jetzt im PACS befunden
                        </button>
                        <button type="button" class="pacs-tool-btn"
                                onclick="window.ImagingModule.toggleDockRight(true); window.ImagingModule.focusStudyFromAudit('${escapeAuditHtml(linkedStudy.id)}')">
                            ◫ Split-Screen
                        </button>
                    </div>
                </div>
            ` : '';

            // FIX: Sauberes einzelnes class-Attribut für #audit-fb-${stepIndex}
            const fbClass = isStepCleared ? 'feedback-box feedback-success' : 'feedback-box';
            const fbDisplay = isStepCleared ? 'block' : 'none';
            const fbInitialContent = isStepCleared
                ? '<strong>Abschnitt validiert:</strong> Dieser klinische Abschnitt wurde bereits vollständig geprüft. (Klicke auf markierte Textstellen, um die Synthese erneut einzusehen.)'
                : '';

            return `
                <article class="audit-step-container ${justUnlocked ? 'pacs-gate-unlocked-anim' : ''}" id="audit-step-${stepIndex}">
                    <header class="audit-step-header" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                        <div>
                            <span class="audit-step-kicker">Abschnitt ${stepIndex + 1}</span>
                            <h3 class="audit-step-title">${escapeAuditHtml(step.phase || 'Klinischer Verlauf')}</h3>
                        </div>
                        ${pacsHeaderBtnHtml}
                    </header>

                    ${pacsGateBannerHtml}

                    <div class="step-content audit-editorial-body" style="${isPacsLocked ? 'opacity:0.65;' : ''}">
                        ${paragraphsHTML}
                    </div>

                    <div class="${fbClass}" id="audit-fb-${stepIndex}" style="display:${fbDisplay};">
                        ${fbInitialContent}
                    </div>

                    <div class="audit-step-footer" id="audit-footer-${stepIndex}" style="display:${isStepCleared ? 'none' : 'flex'};">
                        <button type="button" class="action-btn secondary audit-clear-btn" id="clear-step-btn-${stepIndex}"
                                ${isPacsLocked ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}
                                onclick="window.clearStep(${stepIndex})">
                            ${isPacsLocked ? '🔒 Erst PACS-Aufnahme oben befunden' : 'Abschnitt als fachlich korrekt freigeben'}
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    }

    window.handleLockedAuditPacsClick = function(studyId) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(18);
        if (window.ImagingModule && typeof window.ImagingModule.focusStudyFromAudit === 'function') {
            window.ImagingModule.focusStudyFromAudit(studyId);
        }
    };

    window.handleGenericChunkClick = function(el, stepIndex) {
        if (!el) return;
        // Wenn der Abschnitt bereits abgeschlossen ist, keine Minuspunkte beim Lesen vergeben
        const auditState = getAuditProgressState();
        if (stepIndex !== undefined && auditState.clearedStepsMap[stepIndex]) return;

        if (el.classList.contains('resolved-noise') || el.classList.contains('resolved-generic')) return;
        el.classList.add('resolved-noise');
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        if (typeof applyXpDelta === 'function') applyXpDelta(-20, 'Fehlalarm');
    };

    window.clearStep = function(stepIndex) {
        const caseData = window.activeCaseData;
        if (!caseData || !caseData.timeline || !caseData.timeline[stepIndex]) return;

        const step = caseData.timeline[stepIndex];
        const hotspots = step.hotspots || [];

        // Prüfen, ob ein PACS-Gate noch offen ist
        const { study: linkedStudy, isLocked: isPacsLocked } = getStepImagingGateInfo(step, stepIndex);
        if (isPacsLocked && linkedStudy) {
            window.handleLockedAuditPacsClick(linkedStudy.id);
            return;
        }

        const auditState = getAuditProgressState();
        const resolvedHsMap = auditState.resolvedHotspotsMap || {};

        const hasUnresolved = hotspots.some((hs, i) => {
            if (!hs.is_error) return false;
            const spanGroup = document.querySelectorAll(`[data-hs-group="hs-${stepIndex}-${i}"]`);
            const domResolved = spanGroup.length > 0 && Array.from(spanGroup).some(el => el.classList.contains('resolved-signal'));
            const stateResolved = resolvedHsMap[`${stepIndex}_${i}`] === 'signal' || resolvedHsMap[`${stepIndex}_${i}`] === 'corrected';
            return !(domResolved || stateResolved);
        });

        const fb = document.getElementById(`audit-fb-${stepIndex}`);
        if (!fb) return;
        fb.style.display = 'block';

        if (hasUnresolved) {
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic([15, 40, 15]);
            if (typeof applyXpDelta === 'function') applyXpDelta(-100, 'Fahrlässige Freigabe');
            if (typeof trackSkill === 'function') trackSkill('Triage', false);

            fb.className = 'feedback-box feedback-error';
            fb.innerHTML = `<strong>Freigabe abgelehnt (-100 XP):</strong> Dieser Abschnitt enthält noch unentdeckte fachliche Fehler. Prüfe die Aussagen noch einmal sorgfältig.`;
        } else {
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
            if (typeof applyXpDelta === 'function') applyXpDelta(100, 'Abschnitt validiert');
            if (typeof trackSkill === 'function') trackSkill('Diagnostik', true);

            fb.className = 'feedback-box feedback-success';

            if (hotspots.filter(hs => hs.is_error).length === 0) {
                fb.innerHTML = `<strong>Abschnitt freigegeben (+100 XP):</strong> Korrekt eingeschätzt. Dieser Abschnitt enthielt keine pathophysiologischen oder klinischen Fehler (Null-Fehler-Kontrolle).`;
            } else {
                fb.innerHTML = `<strong>Abschnitt freigegeben (+100 XP):</strong> Alle kritischen Fehler in diesem Abschnitt wurden erfolgreich identifiziert.`;
            }

            const footer = document.getElementById(`audit-footer-${stepIndex}`);
            if (footer) footer.style.display = 'none';

            const btn = document.getElementById(`clear-step-btn-${stepIndex}`);
            if (btn) btn.style.display = 'none';

            const clearedStepsMap = { ...(auditState.clearedStepsMap || {}), [stepIndex]: true };
            const newClearedCount = Object.keys(clearedStepsMap).filter(k => clearedStepsMap[k]).length;

            if (typeof window.clearedStepsCount !== 'undefined') {
                window.clearedStepsCount = newClearedCount;
            }

            const badge = document.getElementById('badge-mode-audit');
            if (badge && typeof window.totalStepsCount !== 'undefined') {
                badge.innerText = `${newClearedCount}/${window.totalStepsCount}`;
            }

            // Fortschritt dauerhaft speichern
            saveAuditProgressState({
                clearedStepsCount: newClearedCount,
                clearedStepsMap: clearedStepsMap
            });

            // Kompatibler Hook für SpacedRepetitionEngine (unterstützt Leitner V2 & SM-2 Legacy)
            if (window.SpacedRepetitionEngine && caseData.case_id) {
                if (typeof window.SpacedRepetitionEngine.logConceptSuccess === 'function') {
                    window.SpacedRepetitionEngine.logConceptSuccess(caseData.case_id, 'Klinisches Audit');
                }
                if (typeof window.SpacedRepetitionEngine.deriveQualityFromMetrics === 'function' && typeof window.SpacedRepetitionEngine.recordReview === 'function') {
                    const total = window.totalStepsCount || caseData.timeline.length || 1;
                    const scorePercent = Math.round((newClearedCount / total) * 100);
                    const quality = window.SpacedRepetitionEngine.deriveQualityFromMetrics('audit', { scorePercent });
                    Promise.resolve(window.SpacedRepetitionEngine.recordReview({
                        itemId: caseData.case_id,
                        moduleType: 'audit',
                        quality,
                        medicalField: caseData.metadata?.medical_field || caseData.folder_name
                    })).catch(err => console.warn('[Audit] SR Record Warning:', err));
                }
            }

            if (typeof window.checkFinalCompletion === 'function') {
                window.checkFinalCompletion();
            }
        }
    };

    window.evaluateAuditHotspot = function(stepIndex, hotspotIndex) {
        const caseData = window.activeCaseData;
        const step = caseData?.timeline?.[stepIndex];
        const hs = step?.hotspots?.[hotspotIndex];
        const fb = document.getElementById(`audit-fb-${stepIndex}`);
        if (!step || !hs || !fb) return;

        // Alle zusammengehörigen Spans dieses Hotspots selektieren
        const spans = document.querySelectorAll(`[data-hs-group="hs-${stepIndex}-${hotspotIndex}"]`);
        const primarySpan = document.getElementById(`hs-${stepIndex}-${hotspotIndex}`);
        if (!primarySpan) return;

        const alreadyResolved = primarySpan.classList.contains('resolved-noise') || primarySpan.classList.contains('resolved-signal');

        // Wenn ein Fehler bereits zuvor gelöst wurde, beim erneuten Klick direkt die Synthese/Erklärung zeigen
        if (alreadyResolved) {
            if (hs.is_error) {
                window.revealSynthesis(stepIndex, hotspotIndex, true);
            } else {
                fb.style.display = 'block';
                fb.className = 'feedback-box feedback-neutral';
                fb.innerHTML = `
                    <div class="audit-fb-title">Fachlich korrekte Aussage (Distraktor-Check)</div>
                    <p class="audit-fb-text">
                        ${escapeAuditHtml(hs.feedback || 'Dieser Satzbaustein ist im vorliegenden klinischen Kontext medizinisch zutreffend.')}
                    </p>
                `;
            }
            return;
        }

        fb.style.display = 'block';
        const hsKey = `${stepIndex}_${hotspotIndex}`;

        if (hs.is_error) {
            spans.forEach(s => s.classList.add('resolved-signal'));
            saveAuditProgressState({
                resolvedHotspotsMap: { [hsKey]: 'signal' }
            });

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic([10, 30, 10]);
            if (typeof trackSkill === 'function') trackSkill(hs.skill_tag || 'Pathophysiologie', true);
            if (typeof applyXpDelta === 'function') applyXpDelta(100, 'Fehler identifiziert');

            fb.className = 'feedback-box feedback-error';
            fb.innerHTML = `
                <div class="audit-fb-title">Klinische Unstimmigkeit identifiziert (+100 XP)</div>
                <p class="audit-fb-text">
                    Diese Passage enthält eine fachlich inkorrekte Aussage. Überlege dir zunächst selbstständig die pathophysiologische Korrektur, bevor du die Auflösung einblendest.
                </p>
                <div class="audit-fb-actions">
                    <button type="button" class="action-btn secondary" onclick="window.revealHint(${stepIndex}, ${hotspotIndex})">
                        Sokratischen Impuls anzeigen (-50 XP)
                    </button>
                    <button type="button" class="action-btn" onclick="window.revealSynthesis(${stepIndex}, ${hotspotIndex})">
                        Synthese und Korrektur anzeigen
                    </button>
                </div>
            `;
        } else {
            spans.forEach(s => s.classList.add('resolved-noise'));
            saveAuditProgressState({
                resolvedHotspotsMap: { [hsKey]: 'noise' }
            });

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
            if (typeof trackSkill === 'function') trackSkill(hs.skill_tag || 'Pathophysiologie', false);
            if (typeof applyXpDelta === 'function') applyXpDelta(-40, 'Fehlalarm');

            fb.className = 'feedback-box feedback-neutral';
            fb.innerHTML = `
                <div class="audit-fb-title">Fachlich korrekte Aussage (-40 XP)</div>
                <p class="audit-fb-text">
                    ${escapeAuditHtml(hs.feedback || 'Dieser Satzbaustein ist im vorliegenden klinischen Kontext medizinisch zutreffend.')}
                </p>
            `;
        }
    };

    window.revealHint = function(stepIndex, hotspotIndex) {
        const hs = window.activeCaseData?.timeline?.[stepIndex]?.hotspots?.[hotspotIndex];
        const fb = document.getElementById(`audit-fb-${stepIndex}`);
        if (!hs || !fb) return;

        if (typeof applyXpDelta === 'function') applyXpDelta(-50, 'Tutor-Impuls angefordert');
        const explanationText = hs.socratic_trap || hs.explanation || hs.feedback || 'Überlege, welche pathophysiologischen Mechanismen in dieser Konstellation greifen.';

        fb.innerHTML = `
            <div class="audit-fb-title">Sokratischer Impuls (-50 XP)</div>
            <p class="audit-fb-text">${escapeAuditHtml(explanationText)}</p>
            <div class="audit-fb-actions">
                <button type="button" class="action-btn" onclick="window.revealSynthesis(${stepIndex}, ${hotspotIndex})">
                    Klinische Korrektur und Synthese aufdecken
                </button>
            </div>
        `;
    };

    window.revealSynthesis = function(stepIndex, hotspotIndex) {
        const hs = window.activeCaseData?.timeline?.[stepIndex]?.hotspots?.[hotspotIndex];
        const fb = document.getElementById(`audit-fb-${stepIndex}`);
        if (!hs || !fb) return;

        const spans = document.querySelectorAll(`[data-hs-group="hs-${stepIndex}-${hotspotIndex}"]`);
        spans.forEach(s => s.classList.add('resolved-signal', 'resolved-corrected'));

        saveAuditProgressState({
            resolvedHotspotsMap: { [`${stepIndex}_${hotspotIndex}`]: 'corrected' }
        });

        const synthesisText = hs.correct_pathophysiology
                           || hs.synthesis
                           || hs.correction
                           || hs.solution
                           || hs.pathophysiology
                           || hs.feedback
                           || 'Keine detaillierte Synthese hinterlegt.';

        fb.style.display = 'block';
        fb.className = 'feedback-box feedback-success';
        fb.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                <div class="audit-fb-title" style="margin:0;">Pathophysiologische Synthese</div>
                <button type="button" class="ghost-tool-btn" style="font-size:0.72rem; padding:3px 9px;"
                        onclick="window.saveAuditSynthesisToDepot(${stepIndex}, ${hotspotIndex}, this)">
                    📌 In Lern-Depot sichern
                </button>
            </div>
            <p class="audit-fb-text">${escapeAuditHtml(synthesisText)}</p>
        `;
    };

    // Speichert eine wichtige Audit-Korrektur direkt im persönlichen Lern-Depot (Knowledge Vault)
    window.saveAuditSynthesisToDepot = async function(stepIndex, hotspotIndex, btnEl) {
        const caseData = window.activeCaseData;
        const step = caseData?.timeline?.[stepIndex];
        const hs = step?.hotspots?.[hotspotIndex];
        if (!caseData || !hs || typeof createDepotEntry !== 'function') return;

        const synthesisText = hs.correct_pathophysiology
                           || hs.synthesis
                           || hs.correction
                           || hs.solution
                           || hs.pathophysiology
                           || hs.feedback
                           || '';

        await createDepotEntry({
            case_id: caseData.case_id,
            case_title: caseData.metadata?.title || caseData.case_id,
            category: caseData.folder_name || caseData.metadata?.medical_field || 'Klinisches Audit',
            cue_context: `Audit-Falle: „${String(hs.phrase || '').slice(0, 48)}“`,
            highlighted_text: synthesisText
        });

        if (btnEl) {
            btnEl.textContent = '✓ Im Depot gespeichert';
            btnEl.disabled = true;
        }
    };

    // Globale Exporte für app.js & Tests
    window.parseParagraphIntoSegments = parseParagraphIntoSegments;
    window.splitIntoNaturalClauses = splitIntoNaturalClauses;
    window.splitStepIntoEditorialParagraphs = splitStepIntoEditorialParagraphs;
    window.renderTimeline = renderTimeline;

    // Live-Entsperrung, sobald im PACS-Monitor oben das Bild gelöst wurde
    window.addEventListener('medcheck:imagingSolved', (e) => {
        lastUnlockedStudyId = e.detail?.studyId || null;
        renderTimeline();
    });
})();
