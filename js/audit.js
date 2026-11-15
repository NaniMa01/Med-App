// ==========================================================================
// js/audit.js – Editorial Clinical Audit, Patient-Triage & Active-Recall Engine (V3.0)
// Features:
// - Patienten-Akten-Filter (Patient 1 / 2 / 3) mit Live-Fortschritt
// - Automatische Hervorhebung klinischer Messwerte & Laborparameter (Akten-Scan)
// - Active-Recall Hypothesen-Feld vor Aufdecken der Muster-Synthese (+30 XP Bonus)
// - Nahtlose Integration des Radiopaedia-Bild-Tresors (RadiopaediaLinkEngine)
// - Klinische Epikrise (Fehler vs. Goldstandard-Gegenüberstellung) & Depot-Export
// ==========================================================================

(function initEditorialAuditEngine() {
    let lastUnlockedStudyId = null;
    let activePatientFilter = 'ALL'; // 'ALL' | 'patient_1' | 'patient_2' | 'patient_3'

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

    // ----------------------------------------------------------------------
    // 1. PERSISTENZ (FORTSCHRITT, HOTSPOTS & EIGENE HYPOTHESEN)
    // ----------------------------------------------------------------------
    function getAuditProgressState() {
        const caseData = window.activeCaseData;
        if (!caseData || !caseData.case_id || window.isSpecialtyBlindMode || typeof ProgressManager === 'undefined') {
            return { clearedStepsCount: 0, clearedStepsMap: {}, resolvedHotspotsMap: {}, userHypothesesMap: {} };
        }
        const saved = ProgressManager.getCaseProgress(caseData.case_id)?.audit || {};
        return {
            clearedStepsCount: saved.clearedStepsCount || 0,
            clearedStepsMap: { ...(saved.clearedStepsMap || {}) },
            resolvedHotspotsMap: { ...(saved.resolvedHotspotsMap || {}) },
            userHypothesesMap: { ...(saved.userHypothesesMap || {}) }
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
            resolvedHotspotsMap: { ...current.resolvedHotspotsMap, ...(partialAuditState.resolvedHotspotsMap || {}) },
            userHypothesesMap: { ...current.userHypothesesMap, ...(partialAuditState.userHypothesesMap || {}) }
        };
        ProgressManager.saveCaseState(caseData.case_id, { audit: nextState });
    }

    // ----------------------------------------------------------------------
    // 2. KLINISCHER MESSWERT-HIGHLIGHTER (AKTEN-SCANNER FÜR VITALWERTE/LABOR)
    // ----------------------------------------------------------------------
    function formatClinicalNumbersInHtml(escapedText) {
        // Hebt Laborwerte, Dosierungen, Segmente & Vitalparameter dezent typografisch hervor,
        // ohne die Phrasen-Klickbarkeit zu beeinträchtigen.
        return escapedText.replace(
            /\b(\d+(?:[.,]\d+)?\s*(?:mg\/dl|mmol\/l|g\/dl|µg\/l|ng\/ml|U\/l|mmHg|\/min|bpm|°C|mg|g|µg|ml|IE|Segmente?|Segment|Jahre|J\.)|≥\s*\d+|≤\s*\d+|pH\s*\d+[.,]\d+|[CTLS]\d{1,2})\b/g,
            '<span class="audit-clinical-metric">$1</span>'
        );
    }

    // ----------------------------------------------------------------------
    // 3. TEXT-SEGMENTIERUNG & KLAUSEL-PARSER
    // ----------------------------------------------------------------------
    function parseParagraphIntoSegments(paragraphText, hotspots = []) {
        if (!paragraphText) return [];

        const cleanText = paragraphText.replace(/\[([^\]]+)\]/g, '$1');
        const normCleanText = normalizeForMatch(cleanText);

        const ranges = [];
        hotspots.forEach((hs, idx) => {
            if (!hs || !hs.phrase) return;
            const cleanPhrase = String(hs.phrase).replace(/^\[|\]$/g, '').trim();
            if (!cleanPhrase) return;

            const normPhrase = normalizeForMatch(cleanPhrase);
            let searchStart = 0;

            while (searchStart < normCleanText.length) {
                let foundPos = normCleanText.indexOf(normPhrase, searchStart);
                if (foundPos === -1) {
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

        const finalSegments = [];

        blocks.forEach(block => {
            if (block.type === 'hotspot') {
                finalSegments.push({
                    text: block.text.trim(),
                    isHotspot: true,
                    hotspotIndex: block.hotspotIndex
                });
            } else {
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

            if (conjunctions.has(cleanWord) && currentWords.length >= 3) {
                clauses.push(currentWords.join(' '));
                currentWords = [word];
                continue;
            }

            currentWords.push(word);

            const endsWithPunct = /[,;:.!?]$/.test(word);
            const remainingWords = tokens.length - 1 - i;

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

    function splitStepIntoEditorialParagraphs(rawText) {
        if (!rawText) return [];

        // Entferne redundante "Patient 1\n\n" Kopfzeilen am Anfang, da wir dafür eigene Patienten-Badges rendern
        const normalizedRaw = String(rawText)
            .replace(/\\n/g, '\n')
            .replace(/^Patient\s*\d+\s*\n+/i, '')
            .trim();

        const explicitParagraphs = normalizedRaw
            .split(/\n\s*\n|<br\s*\/?>\s*<br\s*\/?>/i)
            .map(p => p.trim())
            .filter(Boolean);

        if (explicitParagraphs.length > 1) {
            return explicitParagraphs;
        }

        const singleBlock = explicitParagraphs[0] || normalizedRaw;
        const sentenceRegex = /[^.!?]+(?:\.(?:\s+(?=[A-ZÄÖÜ0-9"„])|$)|[!?]+(?:\s+|$))/g;
        const rawSentences = singleBlock.match(sentenceRegex);

        if (!rawSentences || rawSentences.length <= 2) {
            return [singleBlock];
        }

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

        const paragraphs = [];
        for (let i = 0; i < mergedSentences.length; i += 2) {
            paragraphs.push(mergedSentences.slice(i, i + 2).join(' '));
        }

        return paragraphs;
    }

    // ----------------------------------------------------------------------
    // 4. STYLESHEET FÜR KLINISCHE AKTEN-OPTIK & ACTIVE RECALL
    // ----------------------------------------------------------------------
    function injectAuditEnhancementStyles() {
        if (document.getElementById('mc-audit-v3-styles')) return;
        const style = document.createElement('style');
        style.id = 'mc-audit-v3-styles';
        style.textContent = `
            .audit-patient-triage-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 14px;
                padding: 8px 12px;
                border-radius: 12px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.55));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.2));
            }
            .audit-patient-pills {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .audit-patient-pill {
                padding: 5px 11px;
                border-radius: 8px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.25));
                background: transparent;
                color: var(--text-muted, #94a3b8);
                font-size: 0.75rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.15s ease;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .audit-patient-pill.active {
                background: var(--badge-primary-bg, rgba(2, 132, 199, 0.2));
                border-color: var(--accent-blue, #38bdf8);
                color: var(--text-main, #f8fafc);
            }
            .audit-patient-pill.is-done {
                border-color: rgba(16, 185, 129, 0.45);
            }
            .audit-clinical-metric {
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.88em;
                font-weight: 600;
                color: var(--accent-cyan, #38bdf8);
                background: rgba(56, 189, 248, 0.08);
                padding: 0 4px;
                border-radius: 4px;
            }
            html[data-theme="daylight"] .audit-clinical-metric,
            html[data-theme="tropical"] .audit-clinical-metric {
                color: #0369a1;
                background: rgba(2, 132, 199, 0.1);
            }
            .audit-step-status-strip {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.72rem;
                font-weight: 700;
            }
            .audit-recall-box {
                margin-top: 10px;
                padding: 10px 12px;
                border-radius: 10px;
                background: rgba(15, 23, 42, 0.45);
                border: 1px dashed rgba(56, 189, 248, 0.35);
            }
            html[data-theme="daylight"] .audit-recall-box,
            html[data-theme="tropical"] .audit-recall-box {
                background: rgba(2, 132, 199, 0.05);
            }
            .audit-recall-input {
                width: 100%;
                margin-top: 6px;
                padding: 8px 10px;
                border-radius: 8px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.3));
                background: var(--surface-primary, rgba(6, 9, 19, 0.8));
                color: var(--text-main, #f8fafc);
                font-size: 0.82rem;
                font-family: inherit;
                resize: vertical;
                min-height: 54px;
            }
            .audit-epikrise-card {
                margin-top: 20px;
                padding: 18px;
                border-radius: 14px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.75));
                border: 1px solid rgba(16, 185, 129, 0.35);
            }
            .audit-epikrise-row {
                padding: 10px 12px;
                border-radius: 10px;
                background: var(--surface-primary, rgba(6, 9, 19, 0.65));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                margin-top: 8px;
                font-size: 0.82rem;
                line-height: 1.5;
            }
        `;
        document.head.appendChild(style);
    }

    // ----------------------------------------------------------------------
    // 5. PATIENTEN-AKTEN-GRUPPIERUNG & EPIKRISE-GENERATOR
    // ----------------------------------------------------------------------
    function detectPatientGroups(timeline, clearedMap) {
        const groups = {};
        timeline.forEach((step, idx) => {
            const rawPid = step.patient_id || (step.phase?.match(/Patient\s*(\d+)/i)?.[0]?.toLowerCase().replace(/\s+/, '_')) || null;
            if (!rawPid) return;
            if (!groups[rawPid]) {
                const numMatch = rawPid.match(/\d+/);
                groups[rawPid] = {
                    id: rawPid,
                    label: numMatch ? `Patient ${numMatch[0]}` : rawPid,
                    total: 0,
                    cleared: 0
                };
            }
            groups[rawPid].total += 1;
            if (clearedMap[idx]) groups[rawPid].cleared += 1;
        });
        return Object.values(groups);
    }

    function buildEpikriseSummaryHtml(timeline, clearedMap, resolvedHsMap) {
        const solvedErrors = [];
        timeline.forEach((step, stepIdx) => {
            (step.hotspots || []).forEach((hs, hsIdx) => {
                if (!hs.is_error) return;
                const status = resolvedHsMap[`${stepIdx}_${hsIdx}`];
                if (status === 'signal' || status === 'corrected' || clearedMap[stepIdx]) {
                    solvedErrors.push({
                        stepNum: stepIdx + 1,
                        phase: step.phase || `Abschnitt ${stepIdx + 1}`,
                        wrongPhrase: hs.phrase,
                        correction: hs.correct_pathophysiology || hs.synthesis || hs.correction || hs.feedback || ''
                    });
                }
            });
        });

        if (solvedErrors.length === 0) return '';

        const totalSteps = timeline.length;
        const clearedTotal = Object.keys(clearedMap).filter(k => clearedMap[k]).length;

        return `
            <section class="audit-epikrise-card">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                    <div>
                        <div style="font-size:0.68rem; font-weight:800; color:#10b981; text-transform:uppercase; letter-spacing:0.06em;">
                            📋 KLINISCHE VISITE & FEHLER-EPIKRISE
                        </div>
                        <h4 style="margin:2px 0 0 0; font-size:0.95rem; color:var(--text-main);">
                            Aufgedeckte Fallstricke & Pathophysiologische Korrekturen (${solvedErrors.length})
                        </h4>
                    </div>
                    <span class="case-status-pill ${clearedTotal === totalSteps ? 'status-solved' : 'status-progress'}">
                        ${clearedTotal}/${totalSteps} Abschnitte validiert
                    </span>
                </div>
                ${solvedErrors.map(err => `
                    <div class="audit-epikrise-row">
                        <div style="font-size:0.72rem; font-weight:800; color:var(--text-muted); margin-bottom:3px;">
                            Abschnitt ${err.stepNum} · ${escapeAuditHtml(err.phase)}
                        </div>
                        <div style="color:#fca5a5; margin-bottom:4px;">
                            <strong>✕ Fehler im Bericht:</strong> „${escapeAuditHtml(err.wrongPhrase)}“
                        </div>
                        <div style="color:var(--text-main);">
                            <strong style="color:#6ee7b7;">✓ Korrektes Vorgehen:</strong> ${escapeAuditHtml(err.correction)}
                        </div>
                    </div>
                `).join('')}
            </section>
        `;
    }

    // ----------------------------------------------------------------------
    // 6. HAUPT-RENDERER FÜR DAS KLINISCHE AUDIT
    // ----------------------------------------------------------------------
    function renderTimeline() {
        injectAuditEnhancementStyles();
        const container = document.getElementById('player-container');
        const caseData = window.activeCaseData;
        if (!container || !caseData || !Array.isArray(caseData.timeline)) return;

        const auditState = getAuditProgressState();
        const clearedMap = auditState.clearedStepsMap || {};
        const resolvedHsMap = auditState.resolvedHotspotsMap || {};

        const clearedCount = Object.keys(clearedMap).filter(k => clearedMap[k]).length;
        if (typeof window.clearedStepsCount !== 'undefined') {
            window.clearedStepsCount = clearedCount;
        }
        const badge = document.getElementById('badge-mode-audit');
        if (badge) {
            badge.innerText = `${clearedCount}/${caseData.timeline.length}`;
        }

        // Patienten-Akten-Filter (falls der Fall mehrere Patienten-Szenarien enthält)
        const patientGroups = detectPatientGroups(caseData.timeline, clearedMap);
        if (activePatientFilter !== 'ALL' && !patientGroups.some(g => g.id === activePatientFilter)) {
            activePatientFilter = 'ALL';
        }

        const patientTriageHtml = patientGroups.length > 1
            ? `
                <div class="audit-patient-triage-bar">
                    <span style="font-size:0.72rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">
                        🏥 Stations-Akte:
                    </span>
                    <div class="audit-patient-pills">
                        <button type="button" class="audit-patient-pill ${activePatientFilter === 'ALL' ? 'active' : ''}"
                                onclick="window.setAuditPatientFilter('ALL')">
                            Alle Abschnitte (${clearedCount}/${caseData.timeline.length})
                        </button>
                        ${patientGroups.map(pg => `
                            <button type="button" class="audit-patient-pill ${activePatientFilter === pg.id ? 'active' : ''} ${pg.cleared === pg.total ? 'is-done' : ''}"
                                    onclick="window.setAuditPatientFilter('${escapeAuditHtml(pg.id)}')">
                                ${pg.cleared === pg.total ? '✓ ' : ''}${escapeAuditHtml(pg.label)} (${pg.cleared}/${pg.total})
                            </button>
                        `).join('')}
                    </div>
                </div>
            `
            : '';

        // Radiopaedia-Links des Falls auslesen (für direkte Einbettung pro Abschnitt)
        const radLinks = (window.RadiopaediaLinkEngine && typeof window.RadiopaediaLinkEngine.getLinksForCase === 'function')
            ? window.RadiopaediaLinkEngine.getLinksForCase(caseData)
            : [];

        const stepsHtml = caseData.timeline.map((step, stepIndex) => {
            const stepPatientId = step.patient_id || (step.phase?.match(/Patient\s*\d+/i)?.[0]?.toLowerCase().replace(/\s+/, '_')) || null;
            if (activePatientFilter !== 'ALL' && stepPatientId !== activePatientFilter) {
                return '';
            }

            const rawText = step.content || '';
            const hotspots = step.hotspots || [];
            const isStepCleared = !!clearedMap[stepIndex];

            // Zähle bereits gefundene Fehler / geprüfte Distraktoren in diesem Abschnitt
            let foundErrorsCount = 0;
            let checkedDistractorsCount = 0;
            hotspots.forEach((hs, hIdx) => {
                const st = resolvedHsMap[`${stepIndex}_${hIdx}`];
                if (hs.is_error && (st === 'signal' || st === 'corrected')) foundErrorsCount++;
                if (!hs.is_error && st === 'noise') checkedDistractorsCount++;
            });

            const paragraphs = splitStepIntoEditorialParagraphs(rawText);

            const paragraphsHTML = paragraphs.map(paraText => {
                const segments = parseParagraphIntoSegments(paraText, hotspots);

                const spansHTML = segments.map(seg => {
                    const formattedSegHtml = formatClinicalNumbersInHtml(escapeAuditHtml(seg.text));
                    if (seg.isHotspot) {
                        const hsKey = `${stepIndex}_${seg.hotspotIndex}`;
                        const savedHsStatus = resolvedHsMap[hsKey];
                        let stateClasses = 'stealth-hotspot';
                        if (savedHsStatus === 'signal') stateClasses += ' resolved-signal';
                        else if (savedHsStatus === 'corrected') stateClasses += ' resolved-signal resolved-corrected';
                        else if (savedHsStatus === 'noise') stateClasses += ' resolved-noise';

                        return `<span class="${stateClasses}" data-hs-group="hs-${stepIndex}-${seg.hotspotIndex}" id="hs-${stepIndex}-${seg.hotspotIndex}" role="button" tabindex="0" onclick="window.evaluateAuditHotspot(${stepIndex}, ${seg.hotspotIndex})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.evaluateAuditHotspot(${stepIndex}, ${seg.hotspotIndex});}">${formattedSegHtml}</span>`;
                    } else {
                        return `<span class="stealth-word" onclick="window.handleGenericChunkClick(this, ${stepIndex})">${formattedSegHtml}</span>`;
                    }
                }).join(' ');

                return `<p class="audit-paragraph">${spansHTML}</p>`;
            }).join('');

            // Verknüpfte Radiopaedia-Bildserien genau für diesen Abschnitt
            const stepRadLinks = radLinks.filter(l => l.stepIndex !== null && Number(l.stepIndex) === stepIndex);
            const stepRadHtml = stepRadLinks.map(link => `
                <a href="${escapeAuditHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="mc-rad-link-pill" title="${escapeAuditHtml(link.note || link.url)}">
                    🩻 ${escapeAuditHtml(link.modality)}: ${escapeAuditHtml(link.title)} ↗
                </a>
            `).join('');

            const statusBadgesHtml = `
                <div class="audit-step-status-strip">
                    ${stepRadHtml}
                    ${foundErrorsCount > 0 ? `<span class="case-status-pill" style="background:rgba(239,68,68,0.16); color:#fca5a5; border:1px solid rgba(239,68,68,0.35);">🚨 ${foundErrorsCount} Fehler enttarnt</span>` : ''}
                    ${isStepCleared ? `<span class="case-status-pill status-solved">✓ Validiert</span>` : ''}
                </div>
            `;

            const fbClass = isStepCleared ? 'feedback-box feedback-success' : 'feedback-box';
            const fbDisplay = isStepCleared ? 'block' : 'none';
            const fbInitialContent = isStepCleared
                ? '<strong>Abschnitt validiert:</strong> Dieser klinische Abschnitt wurde erfolgreich auditiert. Klicke auf markierte Phrasen, um die pathophysiologische Synthese erneut einzusehen.'
                : '';

            return `
                <article class="audit-step-container" id="audit-step-${stepIndex}">
                    <header class="audit-step-header" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                        <div>
                            <span class="audit-step-kicker">Abschnitt ${stepIndex + 1}</span>
                            <h3 class="audit-step-title">${escapeAuditHtml(step.phase || 'Klinischer Verlauf')}</h3>
                        </div>
                        ${statusBadgesHtml}
                    </header>

                    <div class="step-content audit-editorial-body">
                        ${paragraphsHTML}
                    </div>

                    <div class="${fbClass}" id="audit-fb-${stepIndex}" style="display:${fbDisplay};">
                        ${fbInitialContent}
                    </div>

                    <div class="audit-step-footer" id="audit-footer-${stepIndex}" style="display:${isStepCleared ? 'none' : 'flex'};">
                        <button type="button" class="action-btn secondary audit-clear-btn" id="clear-step-btn-${stepIndex}" onclick="window.clearStep(${stepIndex})">
                            Abschnitt als fachlich korrekt freigeben
                        </button>
                    </div>
                </article>
            `;
        }).join('');

        const epikriseHtml = buildEpikriseSummaryHtml(caseData.timeline, clearedMap, resolvedHsMap);

        container.innerHTML = patientTriageHtml + stepsHtml + epikriseHtml;

        // Radiopaedia-Leiste oben im Audit synchronisieren
        if (window.RadiopaediaLinkEngine && typeof window.RadiopaediaLinkEngine.refreshUI === 'function') {
            window.RadiopaediaLinkEngine.refreshUI();
        }
    }

    window.setAuditPatientFilter = function(patientId) {
        activePatientFilter = patientId || 'ALL';
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
        renderTimeline();
    };

    window.handleGenericChunkClick = function(el, stepIndex) {
        if (!el) return;
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

            const clearedStepsMap = { ...(auditState.clearedStepsMap || {}), [stepIndex]: true };
            const newClearedCount = Object.keys(clearedStepsMap).filter(k => clearedStepsMap[k]).length;

            if (typeof window.clearedStepsCount !== 'undefined') {
                window.clearedStepsCount = newClearedCount;
            }

            saveAuditProgressState({
                clearedStepsCount: newClearedCount,
                clearedStepsMap: clearedStepsMap
            });

            if (window.SpacedRepetitionEngine && caseData.case_id && typeof window.SpacedRepetitionEngine.logConceptSuccess === 'function') {
                window.SpacedRepetitionEngine.logConceptSuccess(caseData.case_id, 'Klinisches Audit');
            }

            if (typeof window.checkFinalCompletion === 'function') {
                window.checkFinalCompletion();
            }

            // Neu rendern, damit die Epikrise & Patienten-Badges sofort aktualisiert werden
            renderTimeline();

            const updatedFb = document.getElementById(`audit-fb-${stepIndex}`);
            if (updatedFb) {
                updatedFb.style.display = 'block';
                updatedFb.className = 'feedback-box feedback-success';
                updatedFb.innerHTML = hotspots.filter(hs => hs.is_error).length === 0
                    ? `<strong>Abschnitt freigegeben (+100 XP):</strong> Korrekt eingeschätzt (Null-Fehler-Kontrolle).`
                    : `<strong>Abschnitt freigegeben (+100 XP):</strong> Alle kritischen Fehler in diesem Abschnitt wurden erfolgreich identifiziert.`;
            }
        }
    };

    window.evaluateAuditHotspot = function(stepIndex, hotspotIndex) {
        const caseData = window.activeCaseData;
        const step = caseData?.timeline?.[stepIndex];
        const hs = step?.hotspots?.[hotspotIndex];
        const fb = document.getElementById(`audit-fb-${stepIndex}`);
        if (!step || !hs || !fb) return;

        const spans = document.querySelectorAll(`[data-hs-group="hs-${stepIndex}-${hotspotIndex}"]`);
        const primarySpan = document.getElementById(`hs-${stepIndex}-${hotspotIndex}`);
        if (!primarySpan) return;

        const alreadyResolved = primarySpan.classList.contains('resolved-noise') || primarySpan.classList.contains('resolved-signal');

        if (alreadyResolved) {
            if (hs.is_error) {
                window.revealSynthesis(stepIndex, hotspotIndex, false);
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
        const auditState = getAuditProgressState();
        const savedHypothesis = auditState.userHypothesesMap[hsKey] || '';

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
                <div class="audit-fb-title">🚨 Klinische Unstimmigkeit identifiziert (+100 XP)</div>
                <div class="audit-recall-box">
                    <label for="audit-hyp-${hsKey}" style="font-size:0.75rem; font-weight:800; color:var(--accent-cyan, #38bdf8); display:block;">
                        🧠 Active Recall (Bloom-Synthese): Warum ist diese Maßnahme fehlerhaft und wie lautet dein korrektes Vorgehen?
                    </label>
                    <textarea id="audit-hyp-${hsKey}" class="audit-recall-input" placeholder="Formuliere deine klinische Korrektur in 1 Satz (bringt +30 XP Bonus beim Aufdecken)...">${escapeAuditHtml(savedHypothesis)}</textarea>
                </div>
                <div class="audit-fb-actions" style="margin-top:10px;">
                    <button type="button" class="action-btn secondary" onclick="window.revealHint(${stepIndex}, ${hotspotIndex})">
                        Sokratischen Impuls anzeigen (-50 XP)
                    </button>
                    <button type="button" class="action-btn" onclick="window.revealSynthesis(${stepIndex}, ${hotspotIndex}, true)">
                        Synthese & Musterlösung abgleichen
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

        // Falls der Student schon etwas ins Active-Recall-Feld getippt hat, zwischenspeichern
        const hsKey = `${stepIndex}_${hotspotIndex}`;
        const hypVal = document.getElementById(`audit-hyp-${hsKey}`)?.value?.trim();
        if (hypVal) {
            saveAuditProgressState({ userHypothesesMap: { [hsKey]: hypVal } });
        }

        if (typeof applyXpDelta === 'function') applyXpDelta(-50, 'Tutor-Impuls angefordert');
        const explanationText = hs.socratic_trap || hs.explanation || hs.feedback || 'Überlege, welche pathophysiologischen Mechanismen in dieser Konstellation greifen.';

        fb.innerHTML = `
            <div class="audit-fb-title">Sokratischer Impuls (-50 XP)</div>
            <p class="audit-fb-text">${escapeAuditHtml(explanationText)}</p>
            <div class="audit-fb-actions">
                <button type="button" class="action-btn" onclick="window.revealSynthesis(${stepIndex}, ${hotspotIndex}, true)">
                    Klinische Korrektur und Synthese aufdecken
                </button>
            </div>
        `;
    };

    window.revealSynthesis = function(stepIndex, hotspotIndex, rewardActiveRecall = false) {
        const hs = window.activeCaseData?.timeline?.[stepIndex]?.hotspots?.[hotspotIndex];
        const fb = document.getElementById(`audit-fb-${stepIndex}`);
        if (!hs || !fb) return;

        const hsKey = `${stepIndex}_${hotspotIndex}`;
        const auditState = getAuditProgressState();
        const inputEl = document.getElementById(`audit-hyp-${hsKey}`);
        const typedHypothesis = inputEl ? inputEl.value.trim() : (auditState.userHypothesesMap[hsKey] || '');

        // Active-Recall-Bonus vergeben, wenn der Student selbst eine Begründung formuliert hat
        if (rewardActiveRecall && typedHypothesis.length >= 8 && !auditState.userHypothesesMap[hsKey]) {
            if (typeof applyXpDelta === 'function') applyXpDelta(30, 'Active-Recall Begründung');
        }

        const spans = document.querySelectorAll(`[data-hs-group="hs-${stepIndex}-${hotspotIndex}"]`);
        spans.forEach(s => s.classList.add('resolved-signal', 'resolved-corrected'));

        saveAuditProgressState({
            resolvedHotspotsMap: { [hsKey]: 'corrected' },
            ...(typedHypothesis ? { userHypothesesMap: { [hsKey]: typedHypothesis } } : {})
        });

        const synthesisText = hs.correct_pathophysiology
                           || hs.synthesis
                           || hs.correction
                           || hs.solution
                           || hs.pathophysiology
                           || hs.feedback
                           || 'Keine detaillierte Synthese hinterlegt.';

        const userComparisonHtml = typedHypothesis
            ? `<div style="padding:8px 10px; border-radius:8px; background:rgba(56,189,248,0.12); border-left:3px solid #38bdf8; margin-bottom:8px; font-size:0.8rem;">
                   <strong style="color:#38bdf8;">Deine Begründung:</strong> ${escapeAuditHtml(typedHypothesis)}
               </div>`
            : '';

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
            ${userComparisonHtml}
            <p class="audit-fb-text">${escapeAuditHtml(synthesisText)}</p>
        `;
    };

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

    // Bei Fallwechsel Filter zurücksetzen
    const origLoadCase = window.loadCaseById;
    if (typeof origLoadCase === 'function') {
        window.loadCaseById = async function(caseId, opts = {}) {
            activePatientFilter = 'ALL';
            return await origLoadCase.apply(this, arguments);
        };
    }

    // Globale Exporte
    window.parseParagraphIntoSegments = parseParagraphIntoSegments;
    window.splitIntoNaturalClauses = splitIntoNaturalClauses;
    window.splitStepIntoEditorialParagraphs = splitStepIntoEditorialParagraphs;
    window.renderTimeline = renderTimeline;

    window.addEventListener('medcheck:imagingSolved', (e) => {
        lastUnlockedStudyId = e.detail?.studyId || null;
        renderTimeline();
    });
})();
