/**
 * Pharmacology Module - Modular Game & Learning Hub
 * Supports keyboard-driven Arrow-Compass games and future interactive modes.
 */

const PharmacologyModule = (() => {
    // Interner State
    let state = {
        activeSubView: 'hub', // 'hub' | 'arrow_compass' | 'interaction_matrix' | 'import'
        currentSet: null,
        currentQuestionIndex: 0,
        score: 0,
        streak: 0,
        isAnswered: false,
        selectedDirection: null,
        customSets: []
    };

    // Vorinstalliertes Standard-Set zum direkten Loslegen
    const defaultSets = [
        {
            set_id: "pharma_cardio_001",
            title: "Kardiologie & Elektrolyte",
            medical_field: "Kardiologie / Nephrologie",
            game_type: "arrow_compass",
            questions: [
                {
                    id: "q1",
                    patient_context: "68-jähriger Patient mit HFrEF (LVEF 32%) und arterieller Hypertonie. Aktuelles Labor: eGFR 38 ml/min, Kalium 5,6 mmol/l.",
                    prompt: "Welches Medikament ergänzt die Herzinsuffizienz-Therapie prognoseverbessernd, ohne die Hyperkaliämie zu verschärfen?",
                    directions: {
                        up: {
                            drug: "Spironolacton",
                            class: "Aldosteronantagonist (MRA)",
                            is_correct: false,
                            feedback: "Kontraindiziert! Bei Kalium > 5,0 mmol/l droht unter MRA eine lebensbedrohliche Hyperkaliämie."
                        },
                        right: {
                            drug: "Dapagliflozin",
                            class: "SGLT2-Inhibitor",
                            is_correct: true,
                            feedback: "Korrekt! SGLT2-Hemmer verbessern die Prognose bei HFrEF, schützen die Niere und erhöhen den Kaliumspiegel nicht."
                        },
                        down: {
                            drug: "Verapamil",
                            class: "Kalziumantagonist (Phenylalkylamin)",
                            is_correct: false,
                            feedback: "Kontraindiziert bei HFrEF! Wirkt stark negativ inotrop und begünstigt eine kardiale Dekompensation."
                        },
                        left: {
                            drug: "Valsartan Aufdosierung",
                            class: "AT1-Rezeptorantagonist",
                            is_correct: false,
                            feedback: "Falsch. Eine Steigerung der RAAS-Blockade bei Kalium 5,6 mmol/l treibt das Kalium in kritische Bereiche."
                        }
                    },
                    pearl: "Merke: SGLT2-Inhibitoren erleichtern durch Förderung der Kaliumausscheidung oft sogar die spätere Hinzunahme von MRA."
                },
                {
                    id: "q2",
                    patient_context: "54-jährige Patientin mit Vorhofflimmern (unter Apixaban), Hypertonie und neu diagnostizierter schwerer Onychomykose bzw. Systemmykose.",
                    prompt: "Welches Antimykotikum führt über eine starke CYP3A4- und P-gp-Hemmung zu einem massiv erhöhten Blutungsrisiko unter Apixaban?",
                    directions: {
                        up: {
                            drug: "Itraconazol",
                            class: "Triazol-Antimykotikum",
                            is_correct: true,
                            feedback: "Richtig erkannt! Itraconazol ist ein potenter Inhibitor von CYP3A4 und P-Glykoprotein -> Apixaban-Spiegel steigen drastisch an."
                        },
                        right: {
                            drug: "Terbinafin",
                            class: "Allylamin-Antimykotikum",
                            is_correct: false,
                            feedback: "Falsch. Terbinafin hemmt primär CYP2D6 und zeigt keine klinisch relevante Interaktion mit Apixaban."
                        },
                        down: {
                            drug: "Nystatin",
                            class: "Polyen-Antimykotikum",
                            is_correct: false,
                            feedback: "Falsch. Nystatin wird bei topischer/oraler Gabe kaum resorbiert und zeigt keine CYP-Interaktionen."
                        },
                        left: {
                            drug: "Caspofungin",
                            class: "Echinocandin",
                            is_correct: false,
                            feedback: "Falsch. Echinocandine sind keine starken Inhibitoren von CYP3A4 oder P-gp."
                        }
                    },
                    pearl: "Azol-Antimykotika (Itraconazol, Voriconazol, Posaconazol, Ketoconazol) sind klassische Staatsexamens-Fallen für CYP3A4/P-gp-Interaktionen mit DOAKs."
                },
                {
                    id: "q3",
                    patient_context: "72-jähriger Patient mit idiopathischem Morbus Parkinson (unter L-Dopa/Benserazid) entwickelt postoperativ starke Übelkeit und Erbrechen.",
                    prompt: "Welches Antiemetikum ist hier Mittel der 1. Wahl, da es die Blut-Hirn-Schranke kaum überwindet und die Parkinson-Symptomatik nicht verschlechtert?",
                    directions: {
                        up: {
                            drug: "Metoclopramid (MCP)",
                            class: "Zentraler D2-Antagonist",
                            is_correct: false,
                            feedback: "Streng kontraindiziert! MCP passiert die Blut-Hirn-Schranke, blockiert striatale D2-Rezeptoren und löst eine schwere akinetische Krise aus."
                        },
                        right: {
                            drug: "Haloperidol",
                            class: "Typisches Neuroleptikum",
                            is_correct: false,
                            feedback: "Kontraindiziert! Hochpotenter zentraler D2-Blocker -> massive Verschlechterung der Rigor- und Akinese-Symptomatik."
                        },
                        down: {
                            drug: "Domperidon",
                            class: "Peripherer D2-Antagonist",
                            is_correct: true,
                            feedback: "Korrekt! Domperidon wirkt an der Area postrema (außerhalb der BHS), überwindet die Blut-Hirn-Schranke aber kaum (Cave: QT-Zeit beachten!)."
                        },
                        left: {
                            drug: "Promethazin",
                            class: "Niederpotentes Antipsychotikum / H1-Blocker",
                            is_correct: false,
                            feedback: "Ungünstig durch zentrale Dopaminrezeptor-Blockade und ausgeprägte anticholinerge/sedierende Delir-Gefahr beim älteren Patienten."
                        }
                    },
                    pearl: "Parkinson + Übelkeit = Domperidon (oder 5-HT3-Antagonisten wie Ondansetron, sofern kein Apomorphin gegeben wird!). Niemals MCP!"
                }
            ]
        }
    ];

    // Lokal gespeicherte Sets laden
    function loadSavedSets() {
        try {
            const saved = localStorage.getItem('medcheck_pharma_sets');
            if (saved) {
                state.customSets = JSON.parse(saved);
            }
        } catch (e) {
            console.error("Fehler beim Laden der Pharma-Sets:", e);
        }
    }

    function getAllSets() {
        return [...defaultSets, ...state.customSets];
    }

    // Initialisierung
    function init(containerId = 'pharmacology-container') {
        loadSavedSets();
        setupKeyboardListener();
        render(containerId);
    }

    // Globales Keyboard-Handling für das Pfeiltasten-Spiel
    function setupKeyboardListener() {
        window.removeEventListener('keydown', handleKeyDown);
        window.addEventListener('keydown', handleKeyDown);
    }

    function handleKeyDown(e) {
        // Prüfen, ob der Pharmakologie-View überhaupt sichtbar ist
        const container = document.getElementById('pharmacology-container');
        if (!container || container.offsetParent === null) return;

        // Nicht auslösen, wenn der User in einem Input/Textarea tippt
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        if (state.activeSubView === 'arrow_compass') {
            const keyMap = {
                'ArrowUp': 'up',
                'KeyW': 'up',
                'ArrowRight': 'right',
                'KeyD': 'right',
                'ArrowDown': 'down',
                'KeyS': 'down',
                'ArrowLeft': 'left',
                'KeyA': 'left'
            };

            if (keyMap[e.code]) {
                e.preventDefault(); // Verhindert das Scrollen der Seite mit Pfeiltasten
                if (!state.isAnswered) {
                    selectDirection(keyMap[e.code]);
                }
            } else if ((e.code === 'Space' || e.code === 'Enter') && state.isAnswered) {
                e.preventDefault();
                nextQuestion();
            }
        }
    }

    // Haupt-Render-Funktion
    function render(containerId = 'pharmacology-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (state.activeSubView === 'hub') {
            container.innerHTML = renderHub();
        } else if (state.activeSubView === 'arrow_compass') {
            container.innerHTML = renderArrowCompass();
        } else if (state.activeSubView === 'import') {
            container.innerHTML = renderImporter();
        }

        attachEvents(container);
    }

    // 1. HUB ANSICHT (Übersicht aller Spielmodi & Sets)
    function renderHub() {
        const sets = getAllSets();
        return `
            <div class="pharma-wrapper">
                <div class="pharma-header">
                    <div>
                        <span class="pharma-badge">NEUES MODUL</span>
                        <h1 class="pharma-title">Klinische Pharmakologie</h1>
                        <p class="pharma-subtitle">Trainiere Wirkstoffklassen, Kontraindikationen und CYP-Interaktionen interaktiv.</p>
                    </div>
                    <div class="pharma-header-actions">
                        <button class="pharma-btn pharma-btn-secondary" data-action="open-import">
                            <span>+ JSON / KI-Prompt</span>
                        </button>
                    </div>
                </div>

                <!-- Spielmodi-Karten -->
                <div class="pharma-modes-grid">
                    <div class="pharma-mode-card active-mode">
                        <div class="pharma-mode-icon">⌨️</div>
                        <div class="pharma-mode-info">
                            <h3>Pharma-Compass (Pfeiltasten)</h3>
                            <p>Navigiere mit den Pfeiltasten (↑ ↓ ← →) oder WASD blitzschnell zum richtigen Präparat und weiche Kontraindikationen aus.</p>
                        </div>
                        <span class="pharma-mode-tag">Verfügbar</span>
                    </div>

                    <div class="pharma-mode-card coming-soon-mode">
                        <div class="pharma-mode-icon">⚡</div>
                        <div class="pharma-mode-info">
                            <h3>CYP450 & Interaktions-Radar</h3>
                            <p>Identifiziere gefährliche Inhibitoren, Induktoren und QT-Zeit-Verlängerer in komplexen Medikationsplänen.</p>
                        </div>
                        <span class="pharma-mode-tag tag-muted">Geplant (Gleiche Engine)</span>
                    </div>
                </div>

                <!-- Verfügbare Spiele-Sets -->
                <h2 class="pharma-section-title">Verfügbare Trainings-Sets</h2>
                <div class="pharma-sets-list">
                    ${sets.map((set, idx) => `
                        <div class="pharma-set-card">
                            <div class="pharma-set-meta">
                                <span class="pharma-field-pill">${set.medical_field || 'Pharmakologie'}</span>
                                <span class="pharma-type-pill">⌨️ ${set.questions?.length || 0} Szenarien</span>
                            </div>
                            <h3>${set.title}</h3>
                            <button class="pharma-btn pharma-btn-primary" data-action="start-set" data-set-index="${idx}">
                                Spiel starten →
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 2. PFEILTASTEN-SPIEL (ARROW COMPASS)
    function renderArrowCompass() {
        const set = state.currentSet;
        const q = set.questions[state.currentQuestionIndex];
        const total = set.questions.length;

        if (!q) {
            return renderGameSummary();
        }

        const renderCard = (dirKey, arrowSymbol, keyLabel) => {
            const opt = q.directions[dirKey];
            let statusClass = '';
            if (state.isAnswered) {
                if (opt.is_correct) statusClass = 'card-correct';
                else if (state.selectedDirection === dirKey) statusClass = 'card-wrong';
                else statusClass = 'card-dimmed';
            }

            return `
                <div class="compass-card compass-${dirKey} ${statusClass}" data-action="select-dir" data-dir="${dirKey}">
                    <div class="compass-key-badge">${arrowSymbol} <span>${keyLabel}</span></div>
                    <div class="compass-drug-name">${opt.drug}</div>
                    <div class="compass-drug-class">${opt.class}</div>
                    ${state.isAnswered ? `<div class="compass-card-feedback">${opt.feedback}</div>` : ''}
                </div>
            `;
        };

        return `
            <div class="pharma-wrapper">
                <!-- Top Bar -->
                <div class="compass-topbar">
                    <button class="pharma-btn pharma-btn-ghost" data-action="back-to-hub">← Zurück zum Hub</button>
                    <div class="compass-stats">
                        <span class="stat-pill">Frage <strong>${state.currentQuestionIndex + 1} / ${total}</strong></span>
                        <span class="stat-pill">Streak 🔥 <strong>${state.streak}</strong></span>
                        <span class="stat-pill">Score ⭐ <strong>${state.score}</strong></span>
                    </div>
                </div>

                <!-- Das Kompass-Spielfeld -->
                <div class="compass-arena">
                    <!-- OBEN (ArrowUp) -->
                    <div class="compass-slot-up">
                        ${renderCard('up', '↑', 'Oben')}
                    </div>

                    <!-- MITTE: Links - Patientenvignette - Rechts -->
                    <div class="compass-middle-row">
                        <div class="compass-slot-left">
                            ${renderCard('left', '←', 'Links')}
                        </div>

                        <div class="compass-center-patient">
                            <div class="patient-badge">KLINISCHES SZENARIO</div>
                            <p class="patient-context-text">${q.patient_context}</p>
                            <div class="patient-question-prompt">${q.prompt}</div>
                            ${!state.isAnswered ? `
                                <div class="keyboard-hint">
                                    Nutze die Pfeiltasten <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> zur Auswahl
                                </div>
                            ` : ''}
                        </div>

                        <div class="compass-slot-right">
                            ${renderCard('right', '→', 'Rechts')}
                        </div>
                    </div>

                    <!-- UNTEN (ArrowDown) -->
                    <div class="compass-slot-down">
                        ${renderCard('down', '↓', 'Unten')}
                    </div>
                </div>

                <!-- Auflösung & Weiter-Button -->
                ${state.isAnswered ? `
                    <div class="compass-resolution-panel">
                        <div class="pearl-box">
                            <strong>💡 Klinische Pearl:</strong> ${q.pearl}
                        </div>
                        <button class="pharma-btn pharma-btn-primary" data-action="next-question">
                            ${state.currentQuestionIndex + 1 < total ? 'Nächstes Szenario (Leertaste / Enter) →' : 'Auswertung anzeigen →'}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderGameSummary() {
        const total = state.currentSet.questions.length;
        const percent = Math.round((state.score / total) * 100);
        return `
            <div class="pharma-wrapper">
                <div class="pharma-summary-card">
                    <h2>Training abgeschlossen! 🎉</h2>
                    <p class="pharma-subtitle">${state.currentSet.title}</p>
                    <div class="summary-score-circle">
                        <span>${state.score} / ${total}</span>
                        <small>${percent}% korrekt</small>
                    </div>
                    <div class="summary-actions">
                        <button class="pharma-btn pharma-btn-primary" data-action="restart-set">Nochmal spielen</button>
                        <button class="pharma-btn pharma-btn-secondary" data-action="back-to-hub">Zurück zur Übersicht</button>
                    </div>
                </div>
            </div>
        `;
    }

    // 3. JSON IMPORTER & PROMPT GENERATOR
    function renderImporter() {
        const promptTemplate = `Erstelle ein valides JSON-Objekt für mein Pharmakologie-Spiel "Pharma-Compass" zu folgendem Thema: [THEMA HIER EINFÜGEN].
Nutze exakt diese Struktur (ohne Markdown-Erklärungen drumherum):
{
  "set_id": "pharma_custom_${Date.now()}",
  "title": "Titel des Sets",
  "medical_field": "Fachbereich",
  "game_type": "arrow_compass",
  "questions": [
    {
      "id": "q1",
      "patient_context": "Prägnante klinische Vignette inkl. relevanter Vitalparameter, Nieren-/Leberwerte oder Komedikation.",
      "prompt": "Präzise Frage nach dem Mittel der 1. Wahl oder einer spezifischen Kontraindikation/Interaktion.",
      "directions": {
        "up": { "drug": "Wirkstoff A", "class": "Wirkstoffklasse", "is_correct": false, "feedback": "Warum falsch/kontraindiziert?" },
        "right": { "drug": "Wirkstoff B", "class": "Wirkstoffklasse", "is_correct": true, "feedback": "Warum exakt richtig?" },
        "down": { "drug": "Wirkstoff C", "class": "Wirkstoffklasse", "is_correct": false, "feedback": "Warum falsch?" },
        "left": { "drug": "Wirkstoff D", "class": "Wirkstoffklasse", "is_correct": false, "feedback": "Warum falsch?" }
      },
      "pearl": "Hochrelevanter klinischer Merksatz auf Staatsexamens-Niveau."
    }
  ]
}
Wichtig: Variiere die Position von "is_correct": true zufällig zwischen up, right, down und left. Erstelle 5 anspruchsvolle Fragen.`;

        return `
            <div class="pharma-wrapper">
                <div class="compass-topbar">
                    <button class="pharma-btn pharma-btn-ghost" data-action="back-to-hub">← Zurück zum Hub</button>
                    <h2>Eigenes Pharmakologie-Set importieren</h2>
                </div>

                <div class="pharma-import-grid">
                    <div class="pharma-import-box">
                        <h3>1. KI-Prompt kopieren</h3>
                        <p>Kopiere diesen System-Prompt, um dir beliebige neue Pharmakologie-Runden im passenden JSON-Format generieren zu lassen:</p>
                        <textarea id="pharma-prompt-Area" readonly class="pharma-textarea">${promptTemplate}</textarea>
                        <button class="pharma-btn pharma-btn-secondary" data-action="copy-prompt">📋 Prompt in Zwischenablage kopieren</button>
                    </div>

                    <div class="pharma-import-box">
                        <h3>2. JSON-Code hier einfügen</h3>
                        <p>Füge den generierten JSON-Code hier ein, um das Spiel sofort deiner Bibliothek hinzuzufügen:</p>
                        <textarea id="pharma-json-input" placeholder='{"set_id": "...", "title": "...", "questions": [...]}' class="pharma-textarea"></textarea>
                        <div id="pharma-import-error" class="pharma-error-msg"></div>
                        <button class="pharma-btn pharma-btn-primary" data-action="save-json">💾 Set validieren & speichern</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Spiellogik-Funktionen
    function selectDirection(dir) {
        if (state.isAnswered) return;
        const q = state.currentSet.questions[state.currentQuestionIndex];
        const chosen = q.directions[dir];
        if (!chosen) return;

        state.isAnswered = true;
        state.selectedDirection = dir;

        if (chosen.is_correct) {
            state.score += 1;
            state.streak += 1;
        } else {
            state.streak = 0;
        }

        render();
    }

    function nextQuestion() {
        state.currentQuestionIndex += 1;
        state.isAnswered = false;
        state.selectedDirection = null;
        render();
    }

    // Event-Delegation innerhalb des Containers
    function attachEvents(container) {
        container.querySelectorAll('[data-action]').forEach(el => {
            el.addEventListener('click', (e) => {
                const action = el.getAttribute('data-action');

                if (action === 'start-set') {
                    const idx = parseInt(el.getAttribute('data-set-index'), 10);
                    state.currentSet = getAllSets()[idx];
                    state.currentQuestionIndex = 0;
                    state.score = 0;
                    state.streak = 0;
                    state.isAnswered = false;
                    state.selectedDirection = null;
                    state.activeSubView = 'arrow_compass';
                    render();
                } else if (action === 'select-dir') {
                    const dir = el.getAttribute('data-dir');
                    selectDirection(dir);
                } else if (action === 'next-question') {
                    nextQuestion();
                } else if (action === 'back-to-hub') {
                    state.activeSubView = 'hub';
                    render();
                } else if (action === 'restart-set') {
                    state.currentQuestionIndex = 0;
                    state.score = 0;
                    state.streak = 0;
                    state.isAnswered = false;
                    state.selectedDirection = null;
                    render();
                } else if (action === 'open-import') {
                    state.activeSubView = 'import';
                    render();
                } else if (action === 'copy-prompt') {
                    const promptArea = document.getElementById('pharma-prompt-Area');
                    navigator.clipboard.writeText(promptArea.value);
                    el.textContent = '✅ Kopiert!';
                    setTimeout(() => { el.textContent = '📋 Prompt in Zwischenablage kopieren'; }, 2000);
                } else if (action === 'save-json') {
                    const input = document.getElementById('pharma-json-input').value.trim();
                    const errBox = document.getElementById('pharma-import-error');
                    try {
                        const parsed = JSON.parse(input);
                        if (!parsed.title || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
                            throw new Error("JSON benötigt mindestens 'title' und ein nicht-leeres 'questions'-Array.");
                        }
                        state.customSets.push(parsed);
                        localStorage.setItem('medcheck_pharma_sets', JSON.stringify(state.customSets));
                        state.activeSubView = 'hub';
                        render();
                    } catch (err) {
                        errBox.textContent = "Ungültiges JSON: " + err.message;
                    }
                }
            });
        });
    }

    return {
        init,
        render
    };
})();

window.PharmacologyModule = PharmacologyModule;
