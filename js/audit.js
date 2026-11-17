// ==========================================================================
// js/audit.js – Editorial Clinical Audit, Patient-Triage & Active-Recall Engine (V4.0)
// Features:
// - Patienten-Akten-Filter (Patient 1 / 2 / 3) mit Live-Fortschritt & Quick-Next
// - Präziser Akten-Scanner für Vitalparameter, Laborwerte & anatomische Segmente
// - Active-Recall Hypothesen-Feld + optionaler sokratischer KI-Check (/api/gemini)
// - Anti-Pixel-Hunting "Oberarzt-Fokus" nach 3 Fehlalarmen in einem Abschnitt
// - Klinische Konsequenz-Warnung bei Premature Closure & Fehler-Epikrise mit Batch-Export
// ==========================================================================

(function initEditorialAuditEngine() {
    let lastUnlockedStudyId = null;
    let activePatientFilter = 'ALL'; // 'ALL' | 'patient_1' | 'patient_2' | 'patient_3'
    let sentenceHintActiveMap = {}; // { [stepIndex]: sentenceIndex }

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
    // 1. PERSISTENZ (FORTSCHRITT, HOTSPOTS, NOISE & ACTIVE RECALL)
    // ----------------------------------------------------------------------
    function getAuditProgressState() {
        const caseData = window.activeCaseData;
        if (!caseData || !caseData.case_id || window.isSpecialtyBlindMode || typeof ProgressManager === 'undefined') {
            return {
                clearedStepsCount: 0,
                clearedStepsMap: {},
                resolvedHotspotsMap: {},
                resolvedNoiseMap: {},
                userHypothesesMap: {},
                hypothesisRewardedMap: {},
                errorCategoryMap: {},
                aiEvaluationsMap: {},
                prematureClosureCount: 0
            };
        }
        const saved = ProgressManager.getCaseProgress(caseData.case_id)?.audit || {};
        return {
            clearedStepsCount: saved.clearedStepsCount || 0,
            clearedStepsMap: { ...(saved.clearedStepsMap || {}) },
            resolvedHotspotsMap: { ...(saved.resolvedHotspotsMap || {}) },
            resolvedNoiseMap: { ...(saved.resolvedNoiseMap || {}) },
            userHypothesesMap: { ...(saved.userHypothesesMap || {}) },
            hypothesisRewardedMap: { ...(saved.hypothesisRewardedMap || {}) },
            errorCategoryMap: { ...(saved.errorCategoryMap || {}) },
            aiEvaluationsMap: { ...(saved.aiEvaluationsMap || {}) },
            prematureClosureCount: saved.prematureClosureCount || 0
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
            resolvedNoiseMap: { ...current.resolvedNoiseMap, ...(partialAuditState.resolvedNoiseMap || {}) },
            userHypothesesMap: { ...current.userHypothesesMap, ...(partialAuditState.userHypothesesMap || {}) },
            hypothesisRewardedMap: { ...current.hypothesisRewardedMap, ...(partialAuditState.hypothesisRewardedMap || {}) },
            errorCategoryMap: { ...current.errorCategoryMap, ...(partialAuditState.errorCategoryMap || {}) },
            aiEvaluationsMap: { ...current.aiEvaluationsMap, ...(partialAuditState.aiEvaluationsMap || {}) }
        };
        ProgressManager.saveCaseState(caseData.case_id, { audit: nextState });
    }

    // ----------------------------------------------------------------------
    // 2. KLINISCHER MESSWERT-HIGHLIGHTER (OHNE REGEX-BOUNDARY-BUGS)
    // ----------------------------------------------------------------------
    function formatClinicalNumbersInHtml(escapedText) {
        const pattern = /(?<![A-Za-zÄÖÜäöüß0-9_])(\d{2,3}\/\d{2,3}\s*mmHg|\d+(?:[.,]\d+)?\s*(?:mg\/dl|mmol\/l|µmol\/l|nmol\/l|pmol\/l|g\/dl|µg\/l|ng\/ml|pg\/ml|U\/l|G\/l|T\/l|mmHg|\/min|bpm|°C|mg|g|µg|ml|IE|fl|pg|%|Segmente?|Segment|Jahre|J\.)|(?:≥|≤|&gt;|&lt;)\s*\d+(?:[.,]\d+)?|pH\s*\d+[.,]\d+|(?:Th|[CTLS])\d{1,2})(?![A-Za-zÄÖÜäöüß0-9_])/g;
        return escapedText.replace(pattern, '<span class="audit-clinical-metric">$1</span>');
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
    // 4. STYLESHEET (DARK & LIGHT MODE KONSISTENT)
    // ----------------------------------------------------------------------
    function injectAuditEnhancementStyles() {
        if (document.getElementById('mc-audit-v4-styles')) return;
        const style = document.createElement('style');
        style.id = 'mc-audit-v4-styles';
        style.textContent = `
            .audit-patient-triage-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 14px;
                padding: 9px 13px;
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
                border-color: rgba(16, 185, 129, 0.55);
            }
            .audit-clinical-metric {
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.88em;
                font-weight: 600;
                color: var(--accent-cyan, #38bdf8);
                background: rgba(56, 189, 248, 0.09);
                padding: 0 4px;
                border-radius: 4px;
            }
            html[data-theme="daylight"] .audit-clinical-metric,
            html[data-theme="tropical"] .audit-clinical-metric {
                color: #0369a1;
                background: rgba(2, 132, 199, 0.11);
            }
            .audit-step-status-strip {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
                font-size: 0.72rem;
                font-weight: 700;
            }
            .audit-error-badge {
                background: rgba(239, 68, 68, 0.16);
                color: #fca5a5;
                border: 1px solid rgba(239, 68, 68, 0.35);
            }
            html[data-theme="daylight"] .audit-error-badge,
            html[data-theme="tropical"] .audit-error-badge {
                background: #fee2e2;
                color: #991b1b;
                border-color: #fca5a5;
            }
            .audit-paragraph.is-focus-sentence {
                background: rgba(245, 158, 11, 0.08);
                border-left: 3px solid #f59e0b;
                padding: 8px 12px;
                border-radius: 8px;
                transition: background 0.25s ease;
            }
            .audit-recall-box {
                margin-top: 10px;
                padding: 11px 13px;
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
            .audit-errcat-row {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 8px;
            }
            .audit-errcat-chip {
                font-size: 0.71rem;
                font-weight: 700;
                padding: 4px 9px;
                border-radius: 999px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.28));
                background: transparent;
                color: var(--text-muted, #94a3b8);
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .audit-errcat-chip.selected {
                background: var(--badge-primary-bg, rgba(2, 132, 199, 0.2));
                border-color: var(--accent-blue, #38bdf8);
                color: var(--text-main, #f8fafc);
            }
            .audit-ai-eval-box {
                margin-top: 8px;
                padding: 9px 12px;
                border-radius: 8px;
                background: rgba(56, 189, 248, 0.1);
                border-left: 3px solid var(--accent-cyan, #38bdf8);
                font-size: 0.81rem;
                line-height: 1.5;
                color: var(--text-main, #f8fafc);
            }
            .audit-epikrise-card {
                margin-top: 20px;
                padding: 18px;
                border-radius: 14px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.75));
                border: 1px solid rgba(16, 185, 129, 0.38);
            }
            .audit-epikrise-row {
                padding: 11px 13px;
                border-radius: 10px;
                background: var(--surface-primary, rgba(6, 9, 19, 0.65));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                margin-top: 8px;
                font-size: 0.82rem;
                line-height: 1.5;
            }
            .audit-epikrise-wrong {
                color: #fca5a5;
                margin-bottom: 4px;
            }
            .audit-epikrise-right {
                color: #6ee7b7;
            }
            html[data-theme="daylight"] .audit-epikrise-wrong,
            html[data-theme="tropical"] .audit-epikrise-wrong {
                color: #b91c1c;
            }
            html[data-theme="daylight"] .audit-epikrise-right,
            html[data-theme="tropical"] .audit-epikrise-right {
                color: #065f46;
            }
            .audit-unlocked-rad {
                animation: pulseSuccess 0.5s var(--ease-spring) both;
                border-color: #10b981 !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ----------------------------------------------------------------------
    // 5. PATIENTEN-AKTEN-GRUPPIERUNG & EPIKRISE-GENERATOR
    // ----------------------------------------------------------------------
    function extractStepPatientId(step) {
        return step?.patient_id || (step?.phase?.match(/Patient\s*\d+/i)?.[0]?.toLowerCase().replace(/\s+/, '_')) || null;
    }

    function detectPatientGroups(timeline, clearedMap) {
        const groups = {};
        timeline.forEach((step, idx) => {
            const rawPid = extractStepPatientId(step);
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

    function getSynthesisText(hs) {
        return hs.correct_pathophysiology
            || hs.synthesis
            || hs.correction
            || hs.solution
            || hs.pathophysiology
            || hs.feedback
            || 'Keine detaillierte Synthese hinterlegt.';
    }

    function buildEpikriseSummaryHtml(timeline, clearedMap, resolvedHsMap, userHypothesesMap, prematureClosureCount) {
        const solvedErrors = [];
        timeline.forEach((step, stepIdx) => {
            (step.hotspots || []).forEach((hs, hsIdx) => {
                if (!hs.is_error) return;
                const hsKey = `${stepIdx}_${hsIdx}`;
                const status = resolvedHsMap[hsKey];
                if (status === 'signal' || status === 'corrected' || clearedMap[stepIdx]) {
                    solvedErrors.push({
                        stepIndex: stepIdx,
                        hotspotIndex: hsIdx,
                        stepNum: stepIdx + 1,
                        phase: step.phase || `Abschnitt ${stepIdx + 1}`,
                        wrongPhrase: hs.phrase,
                        userHypothesis: userHypothesesMap[hsKey] || '',
                        correction: getSynthesisText(hs)
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
                        <div style="font-size:0.68rem; font-weight:800; color:var(--color-symptom, #10b981); text-transform:uppercase; letter-spacing:0.06em;">
                            📋 KLINISCHE VISITE & FEHLER-EPIKRISE
                        </div>
                        <h4 style="margin:2px 0 0 0; font-size:0.95rem; color:var(--text-main);">
                            Aufgedeckte Fallstricke & Pathophysiologische Korrekturen (${solvedErrors.length})
                        </h4>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        ${prematureClosureCount > 0 ? `
                            <span class="case-status-pill audit-error-badge" title="Voreilige Abschnittsfreigaben trotz unentdeckter Fehler">
                                ⚠️ ${prematureClosureCount}× Premature Closure
                            </span>
                        ` : ''}
                        <span class="case-status-pill ${clearedTotal === totalSteps ? 'status-solved' : 'status-progress'}">
                            ${clearedTotal}/${totalSteps} Abschnitte validiert
                        </span>
                        <button type="button" class="ghost-tool-btn" style="font-size:0.72rem; padding:4px 10px;"
                                onclick="window.saveAllAuditErrorsToDepot(this)">
                            📌 Alle ins Lern-Depot
                        </button>
                    </div>
                </div>
                ${solvedErrors.map(err => `
                    <div class="audit-epikrise-row">
                        <div style="font-size:0.72rem; font-weight:800; color:var(--text-muted); margin-bottom:3px;">
                            Abschnitt ${err.stepNum} · ${escapeAuditHtml(err.phase)}
                        </div>
                        <div class="audit-epikrise-wrong">
                            <strong>✕ Fehler im Bericht:</strong> „${escapeAuditHtml(err.wrongPhrase)}“
                        </div>
                        ${err.userHypothesis ? `
                            <div style="font-size:0.78rem; color:var(--accent-blue, #38bdf8); margin-bottom:4px;">
                                <strong>🧠 Deine Begründung:</strong> ${escapeAuditHtml(err.userHypothesis)}
                            </div>
                        ` : ''}
                        <div class="audit-epikrise-right">
                            <strong>✓ Korrektes Vorgehen:</strong> ${escapeAuditHtml(err.correction)}
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
        const resolvedNoiseMap = auditState.resolvedNoiseMap || {};

        const clearedCount = Object.keys(clearedMap).filter(k => clearedMap[k]).length;
        if (typeof window.clearedStepsCount !== 'undefined') {
            window.clearedStepsCount = clearedCount;
        }
        const badge = document.getElementById('badge-mode-audit');
        if (badge) {
            badge.innerText = `${clearedCount}/${caseData.timeline.length}`;
        }

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

        const radLinks = (window.RadiopaediaLinkEngine && typeof window.RadiopaediaLinkEngine.getLinksForCase === 'function')
            ? window.RadiopaediaLinkEngine.getLinksForCase(caseData)
            : [];

        const stepsHtml = caseData.timeline.map((step, stepIndex) => {
            const stepPatientId = extractStepPatientId(step);
            if (activePatientFilter !== 'ALL' && stepPatientId !== activePatientFilter) {
                return '';
            }

            const rawText = step.content || '';
            const hotspots = step.hotspots || [];
            const isStepCleared = !!clearedMap[stepIndex];

            let foundErrorsCount = 0;
            let unfoundErrorsCount = 0;
            hotspots.forEach((hs, hIdx) => {
                const st = resolvedHsMap[`${stepIndex}_${hIdx}`];
                if (hs.is_error) {
                    if (st === 'signal' || st === 'corrected') foundErrorsCount++;
                    else unfoundErrorsCount++;
                }
            });

            // Zähle persistierte Fehlalarme in diesem Abschnitt
            const stepNoisePrefix = `${stepIndex}_`;
            const stepNoiseCount = Object.keys(resolvedNoiseMap).filter(k => k.startsWith(stepNoisePrefix) && resolvedNoiseMap[k]).length;
            const activeHintParaIdx = sentenceHintActiveMap[stepIndex];

            const paragraphs = splitStepIntoEditorialParagraphs(rawText);

            const paragraphsHTML = paragraphs.map((paraText, paraIdx) => {
                const segments = parseParagraphIntoSegments(paraText, hotspots);

                const spansHTML = segments.map((seg, segIdx) => {
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
                        const noiseKey = `${stepIndex}_${paraIdx}_${segIdx}`;
                        const isNoiseResolved = !!resolvedNoiseMap[noiseKey];
                        return `<span class="stealth-word ${isNoiseResolved ? 'resolved-noise' : ''}" data-noise-key="${noiseKey}" onclick="window.handleGenericChunkClick(this, ${stepIndex}, '${noiseKey}')">${formattedSegHtml}</span>`;
                    }
                }).join(' ');

                const isHighlightedPara = (activeHintParaIdx === paraIdx && unfoundErrorsCount > 0 && !isStepCleared);
                return `<p class="audit-paragraph ${isHighlightedPara ? 'is-focus-sentence' : ''}">${spansHTML}</p>`;
            }).join('');

            const stepRadLinks = radLinks.filter(l => l.stepIndex !== null && Number(l.stepIndex) === stepIndex);
            const stepRadHtml = stepRadLinks.map(link => {
                const isJustUnlocked = lastUnlockedStudyId && String(link.id) === String(lastUnlockedStudyId);
                return `
                    <a href="${escapeAuditHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="mc-rad-link-pill ${isJustUnlocked ? 'audit-unlocked-rad' : ''}" title="${escapeAuditHtml(link.note || link.url)}">
                        🩻 ${escapeAuditHtml(link.modality)}: ${escapeAuditHtml(link.title)} ↗
                    </a>
                `;
            }).join('');

            // Anti-Pixel-Hunting Button ab 3 Fehlalarmen in diesem Abschnitt
            const focusAssistBtnHtml = (!isStepCleared && unfoundErrorsCount > 0 && stepNoiseCount >= 3)
                ? `<button type="button" class="ghost-tool-btn" style="font-size:0.7rem; padding:3px 8px; border-color:rgba(245,158,11,0.45); color:#f59e0b;"
                           onclick="window.activateOberarztFocus(${stepIndex})"
                           title="Grenzt die Passage mit dem nächsten unentdeckten Fehler ein">
                       🔍 Oberarzt-Fokus
                   </button>`
                : '';

            const statusBadgesHtml = `
                <div class="audit-step-status-strip">
                    ${stepRadHtml}
                    ${focusAssistBtnHtml}
                    ${foundErrorsCount > 0 ? `<span class="case-status-pill audit-error-badge">🚨 ${foundErrorsCount} Fehler enttarnt</span>` : ''}
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

        // Quick-Navigation zum nächsten Patienten, falls ein einzelner Patient fertig auditiert wurde
        let nextPatientBannerHtml = '';
        if (activePatientFilter !== 'ALL' && patientGroups.length > 1) {
            const currentPgIdx = patientGroups.findIndex(g => g.id === activePatientFilter);
            const currentPg = patientGroups[currentPgIdx];
            if (currentPg && currentPg.cleared === currentPg.total) {
                const nextPg = patientGroups.find(g => g.cleared < g.total);
                nextPatientBannerHtml = `
                    <div class="audit-patient-complete-card">
                        <div style="font-weight:800; font-size:1rem; color:var(--color-symptom, #10b981); margin-bottom:4px;">
                            ✅ Akte „${escapeAuditHtml(currentPg.label)}“ vollständig auditiert
                        </div>
                        <div style="font-size:0.84rem; color:var(--text-muted);">
                            ${nextPg ? `Weiter zur nächsten Patientenakte auf Station:` : `Alle Patientenakten dieses Falls wurden erfolgreich abgeschlossen!`}
                        </div>
                        <div class="complete-actions">
                            ${nextPg
                                ? `<button type="button" class="action-btn btn-sm" onclick="window.setAuditPatientFilter('${escapeAuditHtml(nextPg.id)}')">Weiter zu ${escapeAuditHtml(nextPg.label)} ➔</button>`
                                : `<button type="button" class="action-btn btn-sm" onclick="window.setAuditPatientFilter('ALL')">Gesamt-Epikrise anzeigen</button>`
                            }
                        </div>
                    </div>
                `;
            }
        }

        const epikriseHtml = buildEpikriseSummaryHtml(
            caseData.timeline,
            clearedMap,
            resolvedHsMap,
            auditState.userHypothesesMap || {},
            auditState.prematureClosureCount || 0
        );

        container.innerHTML = patientTriageHtml + stepsHtml + nextPatientBannerHtml + epikriseHtml;

        if (window.RadiopaediaLinkEngine && typeof window.RadiopaediaLinkEngine.refreshUI === 'function') {
            window.RadiopaediaLinkEngine.refreshUI();
        }
    }

    // ----------------------------------------------------------------------
    // 7. INTERAKTIONS-HANDLER (FILTER, OBERARZT-FOKUS, FREIGABE & HOTSPOTS)
    // ----------------------------------------------------------------------
    window.setAuditPatientFilter = function(patientId) {
        activePatientFilter = patientId || 'ALL';
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
        renderTimeline();
    };

    window.activateOberarztFocus = function(stepIndex) {
        const step = window.activeCaseData?.timeline?.[stepIndex];
        if (!step) return;

        const auditState = getAuditProgressState();
        const resolvedHsMap = auditState.resolvedHotspotsMap || {};
        const hotspots = step.hotspots || [];

        const nextUnfoundHs = hotspots.find((hs, idx) => {
            if (!hs.is_error) return false;
            const st = resolvedHsMap[`${stepIndex}_${idx}`];
            return st !== 'signal' && st !== 'corrected';
        });

        if (!nextUnfoundHs) return;

        const paragraphs = splitStepIntoEditorialParagraphs(step.content || '');
        const normPhrase = normalizeForMatch(String(nextUnfoundHs.phrase || '').replace(/^\[|\]$/g, '').trim()).toLowerCase();
        const targetParaIdx = paragraphs.findIndex(p => normalizeForMatch(p).toLowerCase().includes(normPhrase));

        if (targetParaIdx !== -1) {
            sentenceHintActiveMap[stepIndex] = targetParaIdx;
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
            renderTimeline();
        }
    };

    window.handleGenericChunkClick = function(el, stepIndex, noiseKey = null) {
        if (!el) return;
        const auditState = getAuditProgressState();
        if (stepIndex !== undefined && auditState.clearedStepsMap[stepIndex]) return;

        if (el.classList.contains('resolved-noise') || el.classList.contains('resolved-generic')) return;
        el.classList.add('resolved-noise');

        const keyToSave = noiseKey || el.getAttribute('data-noise-key');
        if (keyToSave) {
            saveAuditProgressState({
                resolvedNoiseMap: { [keyToSave]: true }
            });
        }

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        if (typeof applyXpDelta === 'function') applyXpDelta(-20, 'Fehlalarm');

        // Prüfen, ob ab jetzt 3 Fehlalarme erreicht wurden -> Oberarzt-Fokus-Button einblenden
        const stepNoiseCount = Object.keys({ ...auditState.resolvedNoiseMap, ...(keyToSave ? { [keyToSave]: true } : {}) })
            .filter(k => k.startsWith(`${stepIndex}_`)).length;
        if (stepNoiseCount === 3) {
            renderTimeline();
        }
    };

    window.clearStep = function(stepIndex) {
        const caseData = window.activeCaseData;
        if (!caseData || !caseData.timeline || !caseData.timeline[stepIndex]) return;

        const step = caseData.timeline[stepIndex];
        const hotspots = step.hotspots || [];
        const auditState = getAuditProgressState();
        const resolvedHsMap = auditState.resolvedHotspotsMap || {};

        const unfoundErrorHotspots = hotspots.filter((hs, i) => {
            if (!hs.is_error) return false;
            const spanGroup = document.querySelectorAll(`[data-hs-group="hs-${stepIndex}-${i}"]`);
            const domResolved = spanGroup.length > 0 && Array.from(spanGroup).some(el => el.classList.contains('resolved-signal'));
            const stateResolved = resolvedHsMap[`${stepIndex}_${i}`] === 'signal' || resolvedHsMap[`${stepIndex}_${i}`] === 'corrected';
            return !(domResolved || stateResolved);
        });

        const fb = document.getElementById(`audit-fb-${stepIndex}`);
        if (!fb) return;
        fb.style.display = 'block';

        if (unfoundErrorHotspots.length > 0) {
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic([15, 40, 15]);
            if (typeof applyXpDelta === 'function') applyXpDelta(-100, 'Fahrlässige Freigabe');
            if (typeof trackSkill === 'function') trackSkill('Triage', false);

            saveAuditProgressState({
                prematureClosureCount: (auditState.prematureClosureCount || 0) + 1
            });

            const firstMissed = unfoundErrorHotspots[0];
            const domainHint = firstMissed.skill_tag
                ? `Prüfe insbesondere den Bereich <strong>${escapeAuditHtml(firstMissed.skill_tag)}</strong> (Kontraindikationen, Leitlinien-Abweichungen oder Diagnostik-Lücken).`
                : 'Prüfe Dosierungen, Kontraindikationen und diagnostische Weichenstellungen erneut.';

            fb.className = 'feedback-box feedback-error';
            fb.innerHTML = `
                <div class="audit-fb-title">⚠️ Freigabe abgelehnt – Premature Closure (-100 XP)</div>
                <p class="audit-fb-text">
                    Dieser Bericht enthält noch <strong>${unfoundErrorHotspots.length}</strong> unentdeckten klinischen Fehler. Eine unkritische Übernahme würde den Patienten gefährden.<br>
                    <span style="font-size:0.84rem; opacity:0.9;">💡 <strong>Klinischer Hinweis:</strong> ${domainHint}</span>
                </p>
            `;
        } else {
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
            if (typeof applyXpDelta === 'function') applyXpDelta(100, 'Abschnitt validiert');
            if (typeof trackSkill === 'function') trackSkill('Diagnostik', true);

            delete sentenceHintActiveMap[stepIndex];

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

    function renderActiveRecallEditorHtml(stepIndex, hotspotIndex, savedHypothesis, selectedCategory, socraticHintHtml = '') {
        const hsKey = `${stepIndex}_${hotspotIndex}`;
        const categories = [
            'Kontraindikation / Komorbidität',
            'Therapie- / Dosierungsfehler',
            'Diagnostik- / Triage-Lücke',
            'Pathophysiologie-Fehlannahme'
        ];

        return `
            ${socraticHintHtml}
            <div class="audit-recall-box">
                <label for="audit-hyp-${hsKey}" style="font-size:0.75rem; font-weight:800; color:var(--accent-cyan, #38bdf8); display:block;">
                    🧠 Active Recall (Bloom-Synthese): Warum ist diese Maßnahme fehlerhaft und wie lautet dein korrektes Vorgehen?
                </label>
                <div class="audit-errcat-row" role="group" aria-label="Fehlertyp einordnen">
                    ${categories.map(cat => `
                        <button type="button"
                                class="audit-errcat-chip ${selectedCategory === cat ? 'selected' : ''}"
                                onclick="window.selectAuditErrorCategory(${stepIndex}, ${hotspotIndex}, '${escapeAuditHtml(cat)}', this)">
                            ${escapeAuditHtml(cat)}
                        </button>
                    `).join('')}
                </div>
                <textarea id="audit-hyp-${hsKey}" class="audit-recall-input" placeholder="Formuliere deine klinische Korrektur in 1–2 Sätzen (+30 XP Bonus beim Abgleich)...">${escapeAuditHtml(savedHypothesis)}</textarea>
                <div id="audit-ai-eval-${hsKey}"></div>
            </div>
            <div class="audit-fb-actions" style="margin-top:10px;">
                ${!socraticHintHtml ? `
                    <button type="button" class="action-btn secondary" onclick="window.revealHint(${stepIndex}, ${hotspotIndex})">
                        Sokratischen Impuls anzeigen (-50 XP)
                    </button>
                ` : ''}
                <button type="button" class="action-btn secondary" onclick="window.evaluateAuditHypothesisWithAI(${stepIndex}, ${hotspotIndex}, this)">
                    🩺 Oberarzt-Check (KI)
                </button>
                <button type="button" class="action-btn" onclick="window.revealSynthesis(${stepIndex}, ${hotspotIndex}, true)">
                    Synthese & Musterlösung abgleichen
                </button>
            </div>
        `;
    }

    window.selectAuditErrorCategory = function(stepIndex, hotspotIndex, category, btnEl) {
        const hsKey = `${stepIndex}_${hotspotIndex}`;
        saveAuditProgressState({ errorCategoryMap: { [hsKey]: category } });
        if (btnEl && btnEl.parentElement) {
            btnEl.parentElement.querySelectorAll('.audit-errcat-chip').forEach(b => b.classList.remove('selected'));
            btnEl.classList.add('selected');
        }
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
    };

    window.evaluateAuditHypothesisWithAI = async function(stepIndex, hotspotIndex, btnEl) {
        const hsKey = `${stepIndex}_${hotspotIndex}`;
        const inputEl = document.getElementById(`audit-hyp-${hsKey}`);
        const outputEl = document.getElementById(`audit-ai-eval-${hsKey}`);
        const hs = window.activeCaseData?.timeline?.[stepIndex]?.hotspots?.[hotspotIndex];
        if (!inputEl || !outputEl || !hs) return;

        const hypothesis = inputEl.value.trim();
        if (hypothesis.length < 6) {
            outputEl.innerHTML = `<div class="audit-ai-eval-box">Bitte formuliere zuerst eine kurze klinische Begründung im Textfeld oben.</div>`;
            inputEl.focus();
            return;
        }

        saveAuditProgressState({ userHypothesesMap: { [hsKey]: hypothesis } });

        const origText = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '⏳ Oberarzt prüft...';
        }

        const referenceText = getSynthesisText(hs);
        const prompt = `Du bist ein klinischer Oberarzt-Tutor. Ein Medizinstudent im 5. Jahr hat in einem Patientenbericht folgenden Fehler entdeckt: "${hs.phrase}".
Musterkorrektur: "${referenceText}".
Antwort des Studenten: "${hypothesis}".
Bewerte in maximal 2–3 präzisen Sätzen auf Deutsch: Was stimmt an seiner Überlegung schon, und welches pathophysiologische/therapeutische Kerndetail fehlt ggf. noch? (Sokratisch, konstruktiv, ohne Floskeln).`;

        try {
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, mode: 'socratic_hint' })
            });
            const data = await res.json().catch(() => ({}));
            const feedbackText = (data.generatedText || data.result || '').trim();

            if (!res.ok || !feedbackText || feedbackText.startsWith('{')) {
                throw new Error('Keine KI-Antwort verfügbar');
            }

            saveAuditProgressState({ aiEvaluationsMap: { [hsKey]: feedbackText } });
            outputEl.innerHTML = `<div class="audit-ai-eval-box"><strong>🩺 Oberarzt-Feedback:</strong> ${escapeAuditHtml(feedbackText)}</div>`;
        } catch (_err) {
            outputEl.innerHTML = `<div class="audit-ai-eval-box"><strong>🩺 Hinweis:</strong> Deine Begründung wurde gespeichert. Klicke jetzt auf <em>„Synthese & Musterlösung abgleichen“</em> für den direkten Vergleich und deinen +30 XP Bonus.</div>`;
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origText;
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
        const savedCategory = auditState.errorCategoryMap[hsKey] || '';

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
                ${renderActiveRecallEditorHtml(stepIndex, hotspotIndex, savedHypothesis, savedCategory)}
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

        const hsKey = `${stepIndex}_${hotspotIndex}`;
        const auditState = getAuditProgressState();
        const currentTyped = document.getElementById(`audit-hyp-${hsKey}`)?.value?.trim();
        const savedHypothesis = currentTyped || auditState.userHypothesesMap[hsKey] || '';
        const savedCategory = auditState.errorCategoryMap[hsKey] || '';

        if (currentTyped) {
            saveAuditProgressState({ userHypothesesMap: { [hsKey]: currentTyped } });
        }

        if (typeof applyXpDelta === 'function') applyXpDelta(-50, 'Tutor-Impuls angefordert');
        const explanationText = hs.socratic_trap || hs.explanation || hs.feedback || 'Überlege, welche pathophysiologischen Mechanismen in dieser Konstellation greifen.';

        const socraticBlockHtml = `
            <div style="padding:10px 12px; border-radius:8px; background:rgba(245,158,11,0.12); border-left:3px solid #f59e0b; margin-bottom:10px;">
                <div class="audit-fb-title" style="margin-bottom:4px;">💡 Sokratischer Impuls (-50 XP)</div>
                <p class="audit-fb-text">${escapeAuditHtml(explanationText)}</p>
            </div>
        `;

        // Behält das Active-Recall-Eingabefeld erhalten, damit der Student seinen Gedanken nach dem Impuls noch formulieren kann!
        fb.innerHTML = renderActiveRecallEditorHtml(stepIndex, hotspotIndex, savedHypothesis, savedCategory, socraticBlockHtml);
    };

    window.revealSynthesis = function(stepIndex, hotspotIndex, rewardActiveRecall = false) {
        const hs = window.activeCaseData?.timeline?.[stepIndex]?.hotspots?.[hotspotIndex];
        const fb = document.getElementById(`audit-fb-${stepIndex}`);
        if (!hs || !fb) return;

        const hsKey = `${stepIndex}_${hotspotIndex}`;
        const auditState = getAuditProgressState();
        const inputEl = document.getElementById(`audit-hyp-${hsKey}`);
        const typedHypothesis = inputEl ? inputEl.value.trim() : (auditState.userHypothesesMap[hsKey] || '');
        const alreadyRewarded = !!auditState.hypothesisRewardedMap[hsKey];

        let rewardedNow = false;
        if (rewardActiveRecall && typedHypothesis.length >= 8 && !alreadyRewarded) {
            rewardedNow = true;
            if (typeof applyXpDelta === 'function') applyXpDelta(30, 'Active-Recall Begründung');
        }

        const spans = document.querySelectorAll(`[data-hs-group="hs-${stepIndex}-${hotspotIndex}"]`);
        spans.forEach(s => s.classList.add('resolved-signal', 'resolved-corrected'));

        saveAuditProgressState({
            resolvedHotspotsMap: { [hsKey]: 'corrected' },
            ...(typedHypothesis ? { userHypothesesMap: { [hsKey]: typedHypothesis } } : {}),
            ...(rewardedNow ? { hypothesisRewardedMap: { [hsKey]: true } } : {})
        });

        const synthesisText = getSynthesisText(hs);
        const aiEvalText = auditState.aiEvaluationsMap[hsKey] || '';

        const userComparisonHtml = typedHypothesis
            ? `<div style="padding:8px 10px; border-radius:8px; background:rgba(56,189,248,0.12); border-left:3px solid #38bdf8; margin-bottom:8px; font-size:0.8rem;">
                   <strong style="color:var(--accent-blue, #38bdf8);">Deine Begründung:</strong> ${escapeAuditHtml(typedHypothesis)}
               </div>`
            : '';

        const aiEvalHtml = aiEvalText
            ? `<div class="audit-ai-eval-box" style="margin-bottom:8px;"><strong>🩺 Oberarzt-Feedback:</strong> ${escapeAuditHtml(aiEvalText)}</div>`
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
            ${aiEvalHtml}
            <p class="audit-fb-text">${escapeAuditHtml(synthesisText)}</p>
        `;
    };

    window.saveAuditSynthesisToDepot = async function(stepIndex, hotspotIndex, btnEl) {
        const caseData = window.activeCaseData;
        const step = caseData?.timeline?.[stepIndex];
        const hs = step?.hotspots?.[hotspotIndex];
        if (!caseData || !hs || typeof createDepotEntry !== 'function') return;

        const synthesisText = getSynthesisText(hs);

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

    window.saveAllAuditErrorsToDepot = async function(btnEl) {
        const caseData = window.activeCaseData;
        if (!caseData || !Array.isArray(caseData.timeline) || typeof createDepotEntry !== 'function') return;

        const auditState = getAuditProgressState();
        const clearedMap = auditState.clearedStepsMap || {};
        const resolvedHsMap = auditState.resolvedHotspotsMap || {};

        if (btnEl) {
            btnEl.disabled = true;
            btnEl.textContent = '⏳ Speichere...';
        }

        let exportedCount = 0;
        for (let stepIdx = 0; stepIdx < caseData.timeline.length; stepIdx++) {
            const step = caseData.timeline[stepIdx];
            const hotspots = step.hotspots || [];
            for (let hsIdx = 0; hsIdx < hotspots.length; hsIdx++) {
                const hs = hotspots[hsIdx];
                if (!hs.is_error) continue;
                const status = resolvedHsMap[`${stepIdx}_${hsIdx}`];
                if (status === 'signal' || status === 'corrected' || clearedMap[stepIdx]) {
                    await createDepotEntry({
                        case_id: caseData.case_id,
                        case_title: caseData.metadata?.title || caseData.case_id,
                        category: caseData.folder_name || caseData.metadata?.medical_field || 'Klinisches Audit',
                        cue_context: `Audit-Falle: „${String(hs.phrase || '').slice(0, 48)}“`,
                        highlighted_text: getSynthesisText(hs)
                    });
                    exportedCount++;
                }
            }
        }

        if (btnEl) {
            btnEl.textContent = exportedCount > 0 ? `✓ ${exportedCount} im Depot gesichert` : 'Keine Fehler offen';
        }
    };

    // Bei Fallwechsel Filter & Satz-Hinweise sauber zurücksetzen (ohne Doppel-Wrapping)
    const origLoadCase = window.loadCaseById;
    if (typeof origLoadCase === 'function' && !origLoadCase._auditV4Wrapped) {
        const wrappedLoadCase = async function(caseId, opts = {}) {
            activePatientFilter = 'ALL';
            sentenceHintActiveMap = {};
            return await origLoadCase.apply(this, arguments);
        };
        wrappedLoadCase._auditV4Wrapped = true;
        window.loadCaseById = wrappedLoadCase;
    }

    // Globale Exporte
    window.parseParagraphIntoSegments = parseParagraphIntoSegments;
    window.splitIntoNaturalClauses = splitIntoNaturalClauses;
    window.splitStepIntoEditorialParagraphs = splitStepIntoEditorialParagraphs;
    window.renderTimeline = renderTimeline;

    window.addEventListener('medcheck:imagingSolved', (e) => {
        lastUnlockedStudyId = e.detail?.studyId || null;
        renderTimeline();
        if (lastUnlockedStudyId) {
            setTimeout(() => {
                const unlockedEl = document.querySelector('.audit-unlocked-rad');
                if (unlockedEl) unlockedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 80);
        }
    });
})();
