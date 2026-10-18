// ==========================================================================
// js/flashcards.js – Domänenunabhängige Active-Recall Flash-Card Engine
// ==========================================================================

(function () {
    let deck = [];
    let queue = []; // Indizes der noch zu lernenden Karten
    let masteredIds = new Set();
    let isFlipped = false;
    let isReverseMode = false; // false = Frage -> Antwort, true = Antwort -> Frage
    let currentCardIndex = null;

    function escapeFcHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    // Initialisiert die Flashcards für den aktuellen Fall
    window.renderFlashcards = function () {
        const container = document.getElementById('flashcards-wrapper');
        if (!container || !activeCaseData) return;

        const rawCards = activeCaseData.extra_tasks?.flashcards;
        deck = Array.isArray(rawCards) ? rawCards.map((c, idx) => ({
            id: c.id || `fc_${idx + 1}`,
            category: c.category || activeCaseData.metadata?.medical_field || 'Faktenwissen',
            difficulty: c.difficulty || 'basic',
            front: c.front || '',
            back: c.back || '',
            hint: c.mnemonic_or_context || c.hint || ''
        })).filter(c => c.front && c.back) : [];

        // Gespeicherten Fortschritt aus ProgressManager laden
        const saved = (!window.isSpecialtyBlindMode && activeCaseData.case_id)
            ? (ProgressManager.getCaseProgress(activeCaseData.case_id)?.flashcards || {})
            : {};

        masteredIds = new Set(Array.isArray(saved.masteredIds) ? saved.masteredIds : []);
        isFlipped = false;

        // Queue aus allen noch nicht gemeisterten Karten aufbauen
        queue = deck
            .map((c, idx) => idx)
            .filter(idx => !masteredIds.has(deck[idx].id));

        currentCardIndex = queue.length > 0 ? queue[0] : null;

        updateFlashcardBadge();
        renderFlashcardUI();
    };

    function updateFlashcardBadge() {
        const badge = document.getElementById('badge-mode-flashcards');
        const total = deck.length;
        const solved = masteredIds.size;

        if (badge) {
            if (total === 0) {
                badge.innerText = 'KI-Gen';
                badge.style.background = '';
            } else if (solved >= total) {
                badge.innerText = 'Gelöst';
                badge.style.background = 'var(--color-symptom, #10b981)';
            } else {
                badge.innerText = `${solved}/${total}`;
                badge.style.background = '';
            }
        }

        // Globalen State in app.js synchronisieren
        window.totalFlashcardsCount = total;
        window.solvedFlashcardsCount = solved;
        window.flashcardsSolved = (total === 0) || (solved >= total);

        if (activeCaseData && activeCaseData.case_id && total > 0) {
            window.saveChallengeProgress('flashcards', {
                masteredIds: Array.from(masteredIds),
                solvedCount: solved,
                totalCount: total,
                solved: solved >= total
            });
        }

        if (typeof window.checkFinalCompletion === 'function') {
            window.checkFinalCompletion();
        }
    }

    function renderFlashcardUI() {
        const container = document.getElementById('flashcards-wrapper');
        if (!container) return;

        // FALL 1: Noch keine Flashcards im JSON vorhanden -> On-Demand KI-Generator anbieten
        if (deck.length === 0) {
            container.innerHTML = `
                <div class="fc-empty-state">
                    <div style="font-size: 2rem; margin-bottom: 10px;">🗂️</div>
                    <h3 style="margin: 0 0 8px 0; color: var(--text-main);">Noch keine Flash Cards hinterlegt</h3>
                    <p style="color: var(--text-muted); font-size: 0.88rem; max-width: 520px; margin: 0 auto 18px auto;">
                        Du kannst jetzt sofort atomare Fakten-Karten (Bloom-Stufe 1) aus diesem Fall extrahieren lassen oder ein eigenes beliebiges Thema / Skript eingeben.
                    </p>
                    <div style="max-width: 540px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px;">
                        <textarea id="fc-custom-topic-input" class="forge-topic-input" style="min-height: 75px; font-size: 0.85rem;" placeholder="Optional: Eigenes Thema, Vokabeln, Gesetze oder Skript-Auszug hier einfügen (leer lassen, um automatisch den aktuellen Fall zu nutzen)..."></textarea>
                        <button type="button" class="action-btn" id="btn-generate-fc-ai" onclick="window.generateFlashcardsOnDemand()">
                            ✨ Fakten-Flashcards jetzt generieren
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        const total = deck.length;
        const solved = masteredIds.size;
        const pct = Math.round((solved / total) * 100);

        // FALL 2: Alle Karten im Deck wurden gemeistert!
        if (queue.length === 0 || currentCardIndex === null) {
            container.innerHTML = `
                <div class="fc-complete-state">
                    <div style="font-size: 2.4rem; margin-bottom: 10px;">🎯</div>
                    <h3 style="margin: 0 0 6px 0; color: var(--color-symptom, #10b981);">Alle ${total} Fakten-Karten sitzen sicher!</h3>
                    <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 18px;">
                        Du hast das gesamte deklarative Faktenwissen dieses Stapels erfolgreich abgerufen.
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button type="button" class="action-btn secondary" onclick="window.restartFlashcardDeck(false)">
                            ↻ Stapel nochmal durchgehen
                        </button>
                        <button type="button" class="action-btn" onclick="window.restartFlashcardDeck(true)">
                            🔀 Im Umkehrmodus (Antwort → Frage) testen
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // FALL 3: Aktive Karte rendern
        const card = deck[currentCardIndex];
        const questionText = isReverseMode ? card.back : card.front;
        const answerText = isReverseMode ? card.front : card.back;
        const modeLabelFront = isReverseMode ? 'ANTWORT / DEFINITION (WAS IST DER BEGRIFF?)' : 'FRAGE / BEGRIFF';
        const modeLabelBack = isReverseMode ? 'GESUCHTER BEGRIFF / FRAGE' : 'FAKTEN-ANTWORT';

        const diffBadgeColor = card.difficulty === 'advanced'
            ? 'rgba(239,68,68,0.15); color: #f87171;'
            : (card.difficulty === 'intermediate' ? 'rgba(245,158,11,0.15); color: #fbbf24;' : 'rgba(56,189,248,0.15); color: #38bdf8;');

        container.innerHTML = `
            <div class="fc-toolbar">
                <div class="fc-progress-wrap">
                    <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:700; margin-bottom:5px;">
                        <span>Fortschritt: ${solved} / ${total} gemeistert</span>
                        <span style="color:var(--accent-blue);">${pct}% (${queue.length} im Stapel)</span>
                    </div>
                    <div class="fc-progress-bar">
                        <div class="fc-progress-fill" style="width:${pct}%;"></div>
                    </div>
                </div>
                <div class="fc-toolbar-actions">
                    <button type="button" class="action-btn secondary btn-sm" onclick="window.toggleFlashcardReverseMode()" title="Frage und Antwort tauschen">
                        ⇄ ${isReverseMode ? 'Umkehrmodus aktiv' : 'Standardmodus'}
                    </button>
                    <button type="button" class="action-btn secondary btn-sm" onclick="window.shuffleFlashcardQueue()" title="Verbleibende Karten mischen">
                        🔀 Mischen
                    </button>
                </div>
            </div>

            <div class="fc-stage" onclick="window.flipCurrentFlashcard()">
                <div class="fc-card-3d ${isFlipped ? 'is-flipped' : ''}" id="fc-active-card">
                    <!-- VORDERSEITE -->
                    <div class="fc-face fc-front">
                        <div class="fc-card-meta">
                            <span class="tag">${escapeFcHtml(card.category)}</span>
                            <span class="fc-diff-pill" style="background:${diffBadgeColor}">${escapeFcHtml(card.difficulty)}</span>
                        </div>
                        <div class="fc-face-label">${modeLabelFront}</div>
                        <div class="fc-main-text">${escapeFcHtml(questionText)}</div>
                        <div class="fc-flip-hint">Klicken oder <kbd>Leertaste</kbd> zum Umdrehen</div>
                    </div>

                    <!-- RÜCKSEITE -->
                    <div class="fc-face fc-back">
                        <div class="fc-card-meta">
                            <span class="tag">${escapeFcHtml(card.category)}</span>
                            <button type="button" class="fc-depot-pin-btn" onclick="window.pinFlashcardToDepot(event, ${currentCardIndex})" title="Diesen Fakt ins Lern-Depot speichern">
                                📌 Ins Depot
                            </button>
                        </div>
                        <div class="fc-face-label" style="color:var(--color-symptom, #10b981);">${modeLabelBack}</div>
                        <div class="fc-main-text fc-answer-text">${escapeFcHtml(answerText)}</div>
                        ${card.hint ? `<div class="fc-mnemonic-box">💡 <strong>Kontext / Eselsbrücke:</strong> ${escapeFcHtml(card.hint)}</div>` : ''}
                    </div>
                </div>
            </div>

            <div class="fc-controls-area">
                ${!isFlipped ? `
                    <button type="button" class="action-btn" style="width:100%; padding:14px;" onclick="window.flipCurrentFlashcard()">
                        Antwort aufdecken (<kbd>Leertaste</kbd>)
                    </button>
                ` : `
                    <div class="fc-rating-grid">
                        <button type="button" class="fc-rate-btn rate-again" onclick="window.rateCurrentFlashcard('again')">
                            <span class="rate-title">🔴 Nochmal (<kbd>1</kbd>)</span>
                            <span class="rate-sub">In 3 Karten wiederholen</span>
                        </button>
                        <button type="button" class="fc-rate-btn rate-hard" onclick="window.rateCurrentFlashcard('hard')">
                            <span class="rate-title">🟡 Unsicher (<kbd>2</kbd>)</span>
                            <span class="rate-sub">Ans Ende des Stapels</span>
                        </button>
                        <button type="button" class="fc-rate-btn rate-good" onclick="window.rateCurrentFlashcard('good')">
                            <span class="rate-title">🟢 Sitzt sicher (<kbd>3</kbd>)</span>
                            <span class="rate-sub">Karte abhaken (+15 XP)</span>
                        </button>
                    </div>
                `}
            </div>
        `;
    }

    window.flipCurrentFlashcard = function () {
        if (queue.length === 0 || currentCardIndex === null) return;
        isFlipped = !isFlipped;
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
        renderFlashcardUI();
    };

    window.rateCurrentFlashcard = function (rating) {
        if (queue.length === 0 || currentCardIndex === null) return;
        const card = deck[currentCardIndex];

        // Aktuelle Karte vorne aus der Queue nehmen
        queue.shift();

        if (rating === 'good') {
            const wasAlreadyMastered = masteredIds.has(card.id);
            masteredIds.add(card.id);
            if (!wasAlreadyMastered && typeof applyXpDelta === 'function') {
                applyXpDelta(15, 'Fakt gemeistert');
            }
        } else if (rating === 'again') {
            // 3 Positionen weiter hinten wieder einreihen
            const insertPos = Math.min(queue.length, 3);
            queue.splice(insertPos, 0, currentCardIndex);
        } else if (rating === 'hard') {
            // Ans Ende des aktuellen Stapels setzen
            queue.push(currentCardIndex);
        }

        isFlipped = false;
        currentCardIndex = queue.length > 0 ? queue[0] : null;
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);

        updateFlashcardBadge();
        renderFlashcardUI();
    };

    window.toggleFlashcardReverseMode = function () {
        isReverseMode = !isReverseMode;
        isFlipped = false;
        renderFlashcardUI();
    };

    window.shuffleFlashcardQueue = function () {
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }
        currentCardIndex = queue.length > 0 ? queue[0] : null;
        isFlipped = false;
        renderFlashcardUI();
    };

    window.restartFlashcardDeck = function (reverse = false) {
        isReverseMode = !!reverse;
        masteredIds.clear();
        queue = deck.map((_, idx) => idx);
        window.shuffleFlashcardQueue();
        updateFlashcardBadge();
        renderFlashcardUI();
    };

    // Speichert eine einzelne Flashcard bei Bedarf direkt ins Lern-Depot
    window.pinFlashcardToDepot = function (event, cardIdx) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const card = deck[cardIdx];
        if (!card || typeof createDepotEntry !== 'function') return;

        createDepotEntry({
            case_id: activeCaseData?.case_id || 'flashcard_set',
            case_title: activeCaseData?.metadata?.title || 'Flash Cards',
            category: card.category || 'Faktenwissen',
            cue_context: card.front,
            highlighted_text: `${card.front} → ${card.back}${card.hint ? ' (' + card.hint + ')' : ''}`
        });
    };

    // Generiert On-Demand Flashcards über /api/gemini (für bestehende Fälle oder Freitext-Wissen)
    window.generateFlashcardsOnDemand = async function () {
        const btn = document.getElementById('btn-generate-fc-ai');
        const inputEl = document.getElementById('fc-custom-topic-input');
        const customText = inputEl ? inputEl.value.trim() : '';

        // Falls kein eigener Text eingegeben wurde, Kontext aus dem geladenen Fall extrahieren
        let sourceContent = customText;
        if (!sourceContent && activeCaseData) {
            const overviewText = JSON.stringify(activeCaseData.case_overview || {});
            const timelineText = JSON.stringify(activeCaseData.timeline || []);
            sourceContent = `Titel: ${activeCaseData.metadata?.title || ''}\nÜbersicht: ${overviewText}\nVerlauf: ${timelineText}`;
        }

        if (!sourceContent) {
            alert('Bitte gib ein Thema oder einen Quelltext ein.');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerText = '⏳ Extrahiere atomare Fakten...';
        }

        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'flashcards_only',
                    prompt: sourceContent
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !Array.isArray(data.result)) {
                throw new Error(data.error || `Serverfehler (${response.status})`);
            }

            if (!activeCaseData.extra_tasks) activeCaseData.extra_tasks = {};
            activeCaseData.extra_tasks.flashcards = data.result;

            // Falls es ein Custom-Case ist, direkt dauerhaft im Case speichern
            let customCases = JSON.parse(localStorage.getItem('custom_cases') || '[]');
            const idx = customCases.findIndex(c => c.case_id === activeCaseData.case_id);
            if (idx !== -1) {
                customCases[idx].extra_tasks = activeCaseData.extra_tasks;
                localStorage.setItem('custom_cases', JSON.stringify(customCases));
            }

            window.renderFlashcards();
        } catch (err) {
            alert(`Fehler bei der Flashcard-Generierung: ${err.message}`);
            if (btn) {
                btn.disabled = false;
                btn.innerText = '✨ Fakten-Flashcards jetzt generieren';
            }
        }
    };

    // Globale Keyboard-Shortcuts (Leertaste, 1, 2, 3), wenn der Flashcard-Tab aktiv ist
    document.addEventListener('keydown', (e) => {
        if (window.currentActiveChallenge !== 'flashcards') return;
        const playerView = document.getElementById('player-view');
        if (!playerView || playerView.style.display === 'none') return;

        // Nicht auslösen, wenn der User gerade in einem Input/Textarea tippt
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

        if (e.code === 'Space') {
            e.preventDefault();
            window.flipCurrentFlashcard();
        } else if (isFlipped) {
            if (e.key === '1') {
                e.preventDefault();
                window.rateCurrentFlashcard('again');
            } else if (e.key === '2') {
                e.preventDefault();
                window.rateCurrentFlashcard('hard');
            } else if (e.key === '3' || e.key === 'Enter') {
                e.preventDefault();
                window.rateCurrentFlashcard('good');
            }
        }
    });
})();
