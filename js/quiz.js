/**
 * MedCheck – Master Quiz Engine (V2.0)
 * Features:
 * - State-Persistence über ProgressManager (kein Datenverlust bei Tab-Wechsel)
 * - Sokratischer 2nd-Chance-Modus bei < 70 % (kein Spoiler-Deadlock)
 * - Strukturierter Explanations-Parser (trennt Zeichenvergleich, Rationale & Distraktoren)
 * - Touch- & Maus-kompatibles Distraktor-Strikeout (✕) + Confidence-Based Marking (CBM)
 * - 100 % kompatibel mit SpacedRepetitionEngine V1 & V2 (Leitner-System)
 */

// Lokale UI-Hilfs-States für den aktuellen Durchlauf
let quizConfidenceState = {}; // { [qIdx]: 'sure' | 'unsure' | 'guess' }
let quizStruckOptions = {};   // { ["qIdx_oIdx"]: boolean }
let quizHintsOpen = {};       // { [qIdx]: boolean }
let quizAttemptCount = 0;
let quizLockedCorrect = {};   // { [qIdx]: boolean } -> Fragen, die im 1. Versuch bereits richtig waren

function escapeQuizHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

/**
 * Parst den Explanation-String aus dem Masterprompt in klinisch saubere Sektionen
 * und klappt den technischen "Zeichenvergleich" standardmäßig ein.
 */
function formatClinicalExplanation(rawExplanation, qIdx) {
    if (!rawExplanation) return '<em>Keine detaillierte Erklärung hinterlegt.</em>';

    // Ersetze doppelt escapte \\n sowie echte \n
    const normalized = String(rawExplanation)
        .replace(/\\n/g, '\n')
        .trim();

    // Prüfen, ob ein "Zeichenvergleich:" Block am Anfang existiert
    let lengthCheckHtml = '';
    let mainMedicalText = normalized;

    const lengthRegex = /^Zeichenvergleich:\s*([\s\S]*?\(Maximale Varianz:[^)]+\))\s*/i;
    const match = normalized.match(lengthRegex);

    if (match && match[1]) {
        const lengthContent = escapeQuizHtml(match[1].trim()).replace(/\n/g, '<br>');
        mainMedicalText = normalized.slice(match[0].length).trim();
        lengthCheckHtml = `
            <details style="margin-bottom: 10px; font-size: 0.74rem; color: var(--text-muted); background: rgba(15, 23, 42, 0.35); border: 1px dashed var(--card-border); border-radius: 8px; padding: 6px 10px;">
                <summary style="cursor: pointer; font-weight: 700; color: var(--text-dim); user-select: none;">
                    📏 Anti-Bias Längenparität prüfen (Masterprompt-Check)
                </summary>
                <div style="margin-top: 6px; font-family: 'JetBrains Mono', monospace; line-height: 1.45;">
                    ${lengthContent}
                </div>
            </details>
        `;
    }

    // Medizinischen Haupttext strukturieren (Absätze & Bullet-Listen)
    const paragraphs = mainMedicalText.split(/\n\s*\n/);
    const formattedParagraphs = paragraphs.map(block => {
        const lines = block.trim().split('\n');
        const hasBullets = lines.some(l => l.trim().startsWith('- ') || l.trim().startsWith('• '));

        if (hasBullets) {
            let blockHtml = '';
            let inList = false;

            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                    if (!inList) {
                        blockHtml += '<ul style="margin: 6px 0 6px 18px; padding: 0; display: flex; flex-direction: column; gap: 4px;">';
                        inList = true;
                    }
                    const itemText = escapeQuizHtml(trimmed.slice(2)).replace(
                        /^(Option [A-E]:?)/i,
                        '<strong style="color: var(--text-main);">$1</strong>'
                    );
                    blockHtml += `<li style="line-height: 1.5;">${itemText}</li>`;
                } else {
                    if (inList) {
                        blockHtml += '</ul>';
                        inList = false;
                    }
                    const headerFormatted = escapeQuizHtml(trimmed).replace(
                        /^(Fundierte Rationale[^:]*:|Klinische Analyse der Distraktoren:?)/i,
                        '<strong style="color: var(--accent-cyan, #38bdf8); display: block; margin-top: 4px;">$1</strong>'
                    );
                    blockHtml += `<div style="margin-bottom: 4px; line-height: 1.55;">${headerFormatted}</div>`;
                }
            });

            if (inList) blockHtml += '</ul>';
            return `<div style="margin-bottom: 10px;">${blockHtml}</div>`;
        }

        const cleanBlock = escapeQuizHtml(block.trim())
            .replace(
                /^(Fundierte Rationale[^:]*:|Klinische Analyse der Distraktoren:?)/i,
                '<strong style="color: var(--accent-cyan, #38bdf8);">$1</strong>'
            )
            .replace(/\n/g, '<br>');

        return `<p style="margin: 0 0 10px 0; line-height: 1.58;">${cleanBlock}</p>`;
    }).join('');

    return `
        ${lengthCheckHtml}
        <div class="quiz-medical-rationale">${formattedParagraphs}</div>
        <div style="display: flex; justify-content: flex-end; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--card-border);">
            <button type="button"
                    class="ghost-tool-btn"
                    style="font-size: 0.74rem; padding: 4px 10px;"
                    onclick="window.saveQuizExplanationToDepot(${qIdx}, this)">
                📌 Kernaussage ins Lern-Depot speichern
            </button>
        </div>
    `;
}

/**
 * Haupt-Renderer für das Staatsexamens-Quiz
 */
function renderQuiz() {
    const quizList = activeCaseData?.extra_tasks?.master_quiz || [];
    const wrapper = document.getElementById('quiz-wrapper');
    const badgeEl = document.getElementById('badge-mode-quiz');
    const evalBtn = document.getElementById('eval-quiz-btn');
    const fbEl = document.getElementById('quiz-fb');

    if (!wrapper) return;

    // Bei komplett neuem Fall-Start States initialisieren
    const currentCaseId = activeCaseData?.case_id;
    if (wrapper.dataset.loadedCaseId !== currentCaseId) {
        wrapper.dataset.loadedCaseId = currentCaseId || '';
        quizConfidenceState = {};
        quizStruckOptions = {};
        quizHintsOpen = {};
        quizAttemptCount = 0;
        quizLockedCorrect = {};
    }

    if (quizList.length === 0) {
        wrapper.innerHTML = `<div class="feedback-box feedback-neutral" style="display:block;">Für diesen Fall sind keine Prüfungsfragen hinterlegt.</div>`;
        if (badgeEl) badgeEl.innerText = '0/0';
        if (evalBtn) evalBtn.style.display = 'none';
        return;
    }

    const answeredCount = Object.keys(userQuizAnswers || {}).length;
    if (badgeEl) {
        if (quizSolved) {
            badgeEl.innerText = '✓ Bestanden';
            badgeEl.style.background = 'var(--color-symptom, #10b981)';
        } else {
            badgeEl.innerText = `${answeredCount}/${quizList.length}`;
            badgeEl.style.background = '';
        }
    }

    if (evalBtn) {
        evalBtn.style.display = quizSolved ? 'none' : 'block';
        evalBtn.innerText = quizAttemptCount > 0
            ? '🔄 Korrigierte Antworten jetzt prüfen'
            : 'Prüfung abgeben & auswerten ✓';
    }

    if (fbEl && !quizSolved && quizAttemptCount === 0) {
        fbEl.style.display = 'none';
    }

    wrapper.innerHTML = quizList.map((q, qIdx) => {
        const selectedOpt = userQuizAnswers?.[qIdx];
        const isLockedRight = !!quizLockedCorrect[qIdx];
        const showFullSolution = quizSolved || isLockedRight;
        const conf = quizConfidenceState[qIdx] || 'sure';
        const hasHint = !!(q.hint && String(q.hint).trim());
        const isHintVisible = !!quizHintsOpen[qIdx];
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

        // Fokus-Tag (nur wenn NICHT im Blind-Modus)
        const targetBadge = (!window.isSpecialtyBlindMode && q.target_disease)
            ? `<span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: rgba(56, 189, 248, 0.12); color: var(--accent-cyan, #38bdf8); font-weight: 700;">🎯 ${escapeQuizHtml(q.target_disease)}</span>`
            : '';

        const optionsHtml = (q.options || []).map((opt, oIdx) => {
            const isSelected = selectedOpt === oIdx;
            const isCorrectOpt = oIdx === Number(q.correct_index);
            const strikeKey = `${qIdx}_${oIdx}`;
            const isStruck = !!quizStruckOptions[strikeKey];

            let statusClasses = [];
            if (isSelected && !showFullSolution) statusClasses.push('selected');
            if (showFullSolution) {
                if (isCorrectOpt) statusClasses.push('correct-highlight');
                else if (isSelected && !isCorrectOpt) statusClasses.push('wrong-highlight');
            }

            const disabledAttr = showFullSolution ? 'disabled' : '';
            const strikeStyle = (isStruck && !showFullSolution)
                ? 'text-decoration: line-through; opacity: 0.42;'
                : '';

            return `
                <div class="quiz-opt-row" style="display: flex; align-items: stretch; gap: 6px;">
                    <button type="button"
                            class="quiz-opt-btn ${statusClasses.join(' ')}"
                            id="opt-btn-${qIdx}-${oIdx}"
                            style="flex: 1; display: flex; align-items: flex-start; gap: 10px; text-align: left; ${strikeStyle}"
                            onclick="window.selectQuizOption(${qIdx}, ${oIdx})"
                            oncontextmenu="event.preventDefault(); window.toggleQuizOptionStrike(${qIdx}, ${oIdx});"
                            ${disabledAttr}>
                        <span class="quiz-opt-letter" style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.78rem; min-width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,0.07); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
                            ${letters[oIdx] || (oIdx + 1)}
                        </span>
                        <span style="flex: 1; line-height: 1.48;">${escapeQuizHtml(opt)}</span>
                    </button>
                    ${!showFullSolution ? `
                        <button type="button"
                                class="ghost-tool-btn"
                                title="${isStruck ? 'Durchstreichung aufheben' : 'Als Distraktor ausschließen (durchstreichen)'}"
                                style="padding: 0 10px; border-radius: 10px; opacity: ${isStruck ? '1' : '0.55'}; color: ${isStruck ? '#f87171' : 'var(--text-muted)'}; flex-shrink: 0;"
                                onclick="window.toggleQuizOptionStrike(${qIdx}, ${oIdx})">
                            ✕
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="quiz-card" id="quiz-card-${qIdx}" data-question-index="${qIdx}" data-didactics-enhanced="true">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                    <div class="quiz-question-num" style="margin: 0;">
                        Prüfungsfrage ${qIdx + 1} von ${quizList.length}
                        ${isLockedRight ? '<span style="color: #4ade80; margin-left: 6px;">✓ Korrekt gelöst</span>' : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${targetBadge}
                        ${hasHint && !showFullSolution ? `
                            <button type="button"
                                    class="ghost-tool-btn"
                                    style="font-size: 0.72rem; padding: 3px 9px; border-color: rgba(245, 158, 11, 0.4); color: #fbbf24;"
                                    onclick="window.toggleQuizSocraticHint(${qIdx})">
                                💡 ${isHintVisible ? 'Hinweis ausblenden' : 'Sokratischer Hinweis'}
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="quiz-question-text" style="line-height: 1.6; margin-bottom: 14px;">
                    ${escapeQuizHtml(q.question)}
                </div>

                ${hasHint ? `
                    <div id="quiz-hint-box-${qIdx}" style="display: ${isHintVisible && !showFullSolution ? 'block' : 'none'}; margin-bottom: 14px; padding: 10px 14px; border-radius: 10px; background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; font-size: 0.82rem; color: var(--text-main);">
                        <strong>💡 Sokratischer Denkanstoß:</strong> ${escapeQuizHtml(q.hint)}
                    </div>
                ` : ''}

                <div class="quiz-options-grid" style="display: flex; flex-direction: column; gap: 8px;">
                    ${optionsHtml}
                </div>

                <!-- Confidence-Based Marking (CBM) Bar -->
                ${!showFullSolution ? `
                    <div class="cbm-confidence-bar" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding: 8px 12px; border-radius: 8px; background: rgba(15, 23, 42, 0.4); border: 1px dashed var(--card-border); font-size: 0.74rem;">
                        <span style="color: var(--text-muted); font-weight: 600;">🎯 Deine Diagnosesicherheit:</span>
                        <div style="display: flex; gap: 6px;">
                            <button type="button" onclick="window.setQuizConfidence(${qIdx}, 'sure')" style="padding: 3px 9px; border-radius: 6px; border: 1px solid rgba(16,185,129,0.4); background: ${conf === 'sure' ? 'rgba(16,185,129,0.22)' : 'transparent'}; color: #6ee7b7; cursor: pointer; font-weight: 700; font-size: 0.72rem;">✓ Sicher</button>
                            <button type="button" onclick="window.setQuizConfidence(${qIdx}, 'unsure')" style="padding: 3px 9px; border-radius: 6px; border: 1px solid rgba(245,158,11,0.4); background: ${conf === 'unsure' ? 'rgba(245,158,11,0.22)' : 'transparent'}; color: #fcd34d; cursor: pointer; font-weight: 700; font-size: 0.72rem;">🤔 50:50</button>
                            <button type="button" onclick="window.setQuizConfidence(${qIdx}, 'guess')" style="padding: 3px 9px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.4); background: ${conf === 'guess' ? 'rgba(239,68,68,0.22)' : 'transparent'}; color: #fca5a5; cursor: pointer; font-weight: 700; font-size: 0.72rem;">🎲 Geraten</button>
                        </div>
                    </div>
                ` : ''}

                <div class="quiz-explanation-box"
                     id="quiz-expl-${qIdx}"
                     style="display: ${showFullSolution ? 'block' : 'none'}; margin-top: 14px;">
                    ${formatClinicalExplanation(q.explanation, qIdx)}
                </div>
            </div>
        `;
    }).join('');
}
window.renderQuiz = renderQuiz;

/**
 * Antwort-Option auswählen & Fortschritt persistent im ProgressManager sichern
 */
window.selectQuizOption = function(qIdx, oIdx) {
    if (quizSolved || quizLockedCorrect[qIdx]) return;

    // Falls Option vorher durchgestrichen war, Durchstreichung beim Auswählen aufheben
    const strikeKey = `${qIdx}_${oIdx}`;
    if (quizStruckOptions[strikeKey]) {
        delete quizStruckOptions[strikeKey];
    }

    userQuizAnswers[qIdx] = oIdx;

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);

    const card = document.getElementById(`quiz-card-${qIdx}`);
    if (card) {
        card.querySelectorAll('.quiz-opt-btn').forEach((btn, idx) => {
            btn.classList.toggle('selected', idx === oIdx);
            if (idx === oIdx) {
                btn.style.textDecoration = 'none';
                btn.style.opacity = '1';
            }
        });
    }

    const quizList = activeCaseData?.extra_tasks?.master_quiz || [];
    const answeredCount = Object.keys(userQuizAnswers).length;
    const badgeEl = document.getElementById('badge-mode-quiz');
    if (badgeEl) {
        badgeEl.innerText = `${answeredCount}/${quizList.length}`;
    }

    // Zwischenstand sofort im ProgressManager sichern
    if (typeof window.saveChallengeProgress === 'function') {
        window.saveChallengeProgress('quiz', {
            solved: quizSolved,
            answers: userQuizAnswers
        });
    }
};

/**
 * Distraktor durchstreichen (Touch-Button & Rechtsklick)
 */
window.toggleQuizOptionStrike = function(qIdx, oIdx) {
    if (quizSolved || quizLockedCorrect[qIdx]) return;
    const key = `${qIdx}_${oIdx}`;
    quizStruckOptions[key] = !quizStruckOptions[key];

    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
    renderQuiz();
};

/**
 * Sokratischen Hinweis für eine einzelne Frage ein-/ausblenden
 */
window.toggleQuizSocraticHint = function(qIdx) {
    quizHintsOpen[qIdx] = !quizHintsOpen[qIdx];
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
    const hintBox = document.getElementById(`quiz-hint-box-${qIdx}`);
    if (hintBox) {
        hintBox.style.display = quizHintsOpen[qIdx] ? 'block' : 'none';
    } else {
        renderQuiz();
    }
};

/**
 * Confidence-Level (CBM) pro Frage setzen
 */
window.setQuizConfidence = function(qIdx, level) {
    if (quizSolved || quizLockedCorrect[qIdx]) return;
    quizConfidenceState[qIdx] = level;
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(4);
    renderQuiz();
};

/**
 * Speichert die Rationale einer Frage mit 1 Klick ins persönliche Lern-Depot
 */
window.saveQuizExplanationToDepot = async function(qIdx, btnEl) {
    const q = activeCaseData?.extra_tasks?.master_quiz?.[qIdx];
    if (!q) return;

    const correctOptText = q.options?.[q.correct_index] || '';
    const cleanExplanation = String(q.explanation || '')
        .replace(/\\n/g, ' ')
        .replace(/^Zeichenvergleich:[\s\S]*?\(Maximale Varianz:[^)]+\)\s*/i, '')
        .trim()
        .slice(0, 360);

    if (typeof createDepotEntry === 'function') {
        await createDepotEntry({
            case_id: activeCaseData.case_id,
            case_title: activeCaseData.metadata?.title || activeCaseData.case_id,
            category: activeCaseData.folder_name || activeCaseData.metadata?.medical_field || 'Prüfungswissen',
            cue_context: q.target_disease || `Prüfungsfrage ${qIdx + 1}`,
            highlighted_text: `✓ ${correctOptText} — ${cleanExplanation}`
        });
        if (btnEl) {
            btnEl.innerText = '✓ Im Lern-Depot gespeichert!';
            btnEl.disabled = true;
        }
    }
};

/**
 * Deckt nach einem Fehlversuch (< 70 %) auf Wunsch alle Musterlösungen sofort auf
 */
window.forceRevealQuizSolutions = function() {
    const quizList = activeCaseData?.extra_tasks?.master_quiz || [];
    quizList.forEach((_, qIdx) => {
        quizLockedCorrect[qIdx] = true;
    });
    renderQuiz();
};

/**
 * Haupt-Auswertung der Prüfung (inkl. Leitner-SR-Kompatibilität & Sokratischem Retry)
 */
window.evalQuiz = function() {
    const quizList = activeCaseData?.extra_tasks?.master_quiz || [];
    if (quizList.length === 0) return;

    if (Object.keys(userQuizAnswers).length < quizList.length) {
        if (window.MedUI && typeof window.MedUI.openDialog === 'function') {
            window.MedUI.openDialog({
                kicker: 'Prüfungs-Hinweis',
                title: 'Noch offene Fragen',
                message: `Bitte beantworte erst alle ${quizList.length} Fragen (${Object.keys(userQuizAnswers).length}/${quizList.length} ausgewählt), bevor du die Prüfung abgibst.`,
                confirmText: 'Verstanden',
                cancelText: ''
            });
        } else {
            alert(`Bitte beantworte alle ${quizList.length} Fragen vor der Abgabe!`);
        }
        return;
    }

    quizAttemptCount += 1;
    let correctCount = 0;
    let highConfidenceMistakes = [];

    quizList.forEach((q, qIdx) => {
        const userChoice = Number(userQuizAnswers[qIdx]);
        const isCorrect = (userChoice === Number(q.correct_index));
        const conf = quizConfidenceState[qIdx] || 'sure';
        const conceptTag = q.target_disease || activeCaseData?.metadata?.primary_disease || 'Diagnostik';

        if (isCorrect) {
            correctCount++;
            quizLockedCorrect[qIdx] = true;
            if (window.SpacedRepetitionEngine && typeof window.SpacedRepetitionEngine.logConceptSuccess === 'function') {
                window.SpacedRepetitionEngine.logConceptSuccess(activeCaseData?.case_id, conceptTag);
            }
        } else {
            // Bei Fehlantwort: Gewählte falsche Option als durchgestrichen markieren & sokratischen Hinweis öffnen!
            quizStruckOptions[`${qIdx}_${userChoice}`] = true;
            quizHintsOpen[qIdx] = true;

            if (conf === 'sure') {
                highConfidenceMistakes.push(qIdx + 1);
            }
            if (window.SpacedRepetitionEngine && typeof window.SpacedRepetitionEngine.logConceptStruggle === 'function') {
                window.SpacedRepetitionEngine.logConceptStruggle(
                    activeCaseData?.case_id,
                    conceptTag,
                    conf === 'sure' ? 'high_confidence_error' : 'quiz_miss'
                );
            }
        }
    });

    const scorePercent = Math.round((correctCount / quizList.length) * 100);
    const fb = document.getElementById('quiz-fb');
    const evalBtn = document.getElementById('eval-quiz-btn');

    // Kompatibilitäts-Brücke für SpacedRepetitionEngine (V1 SM-2 UND V2 Leitner)
    if (window.SpacedRepetitionEngine && activeCaseData?.case_id) {
        if (typeof window.SpacedRepetitionEngine.deriveQualityFromMetrics === 'function' &&
            typeof window.SpacedRepetitionEngine.recordReview === 'function') {
            const quality = window.SpacedRepetitionEngine.deriveQualityFromMetrics('quiz', { scorePercent });
            window.SpacedRepetitionEngine.recordReview({
                itemId: `${activeCaseData.case_id}_quiz`,
                moduleType: 'quiz',
                quality: quality,
                medicalField: activeCaseData.metadata?.medical_field || activeCaseData.folder_name
            }).catch(err => console.warn('[Quiz] SM-2 Record Warning:', err));
        }
    }

    if (scorePercent >= 70) {
        // BESTANDEN (>= 70 %) -> Alle Erklärungen freischalten & Status persistieren
        quizSolved = true;
        if (typeof window.saveChallengeProgress === 'function') {
            window.saveChallengeProgress('quiz', {
                solved: true,
                answers: userQuizAnswers
            });
        }

        renderQuiz();

        if (fb) {
            fb.style.display = 'block';
            fb.className = 'feedback-box feedback-success';
            fb.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <strong>🎉 Prüfung bestanden!</strong> ${correctCount} von ${quizList.length} Fragen richtig (${scorePercent}%).
                        ${quizAttemptCount > 1 ? `<span style="font-size: 0.78rem; opacity: 0.85;">(Im ${quizAttemptCount}. Durchgang gelöst)</span>` : ''}
                    </div>
                </div>
                ${highConfidenceMistakes.length > 0 ? `
                    <div style="margin-top: 8px; font-size: 0.78rem; color: #fca5a5;">
                        ⚠️ <strong>Metakognitiver Hinweis (Frage ${highConfidenceMistakes.join(', ')}):</strong> Du warst dir sicher („✓ Sicher“), lagst aber falsch. Diese Entität wurde automatisch in deiner Leitner-Visite (Box 1) priorisiert.
                    </div>
                ` : ''}
            `;
        }

        if (evalBtn) evalBtn.style.display = 'none';

        const xpReward = quizAttemptCount === 1 ? (correctCount * 30) : (correctCount * 15);
        if (typeof applyXpDelta === 'function') applyXpDelta(xpReward, 'Master-Exam');
        if (typeof trackSkill === 'function') {
            trackSkill('Pathophysiologie', true);
            trackSkill('Diagnostik', true);
        }
        if (typeof window.checkFinalCompletion === 'function') {
            window.checkFinalCompletion();
        }
    } else {
        // NICHT BESTANDEN (< 70 %) -> Sokratischer Retry-Modus (Kein Deadlock!)
        // Richtige Fragen bleiben eingeloggt, falsche Fragen werden für den 2. Versuch zurückgesetzt
        quizList.forEach((q, qIdx) => {
            if (!quizLockedCorrect[qIdx]) {
                delete userQuizAnswers[qIdx];
            }
        });

        if (typeof window.saveChallengeProgress === 'function') {
            window.saveChallengeProgress('quiz', {
                solved: false,
                answers: userQuizAnswers
            });
        }

        renderQuiz();

        if (fb) {
            fb.style.display = 'block';
            fb.className = 'feedback-box feedback-error';
            fb.innerHTML = `
                <div style="margin-bottom: 8px;">
                    <strong>Noch nicht bestanden (${scorePercent}%):</strong> ${correctCount} von ${quizList.length} Fragen waren auf Anhieb richtig (Mindestscore: 70%).
                </div>
                <div style="font-size: 0.82rem; line-height: 1.5; margin-bottom: 10px;">
                    🧠 <strong>Sokratischer 2. Versuch aktiviert:</strong> Deine bereits richtigen Antworten sind grün gesichert. Bei den offenen Fragen wurde deine Fehl-Option durchgestrichen und der <em>💡 Sokratische Hinweis</em> eingeblendet. Korrigiere die offenen Fragen oben und gib erneut ab!
                </div>
                <button type="button" class="ghost-tool-btn" style="font-size: 0.74rem;" onclick="window.forceRevealQuizSolutions()">
                    👁️ Musterlösungen trotzdem sofort aufdecken
                </button>
            `;
        }

        if (typeof applyXpDelta === 'function') applyXpDelta(-25, 'Exam Zwischenversuch');
        if (typeof trackSkill === 'function') trackSkill('Pathophysiologie', false);
    }
};
