/**
 * MedCheck - Klinik-Duell Module V3.0 (Multiplayer, Leitner-Sync & Round-Inspector)
 * Fixes & Features:
 *  - Deterministic State-Transition Calculation AFTER Atomic Cloud Merge (fixes Race Conditions)
 *  - Interactive Round-Inspector: Click any played round to review questions, answers & explanations
 *  - Clean Medical Explanation Parser (strips Masterprompt 'Zeichenvergleich' boilerplate)
 *  - Expanded Question Pool: Automatically integrates Case Master-Quizzes + Pharmacology Compass Sets
 *  - Direct Integration with Lern-Depot (1-Click Save) & SpacedRepetitionEngine (Leitner V2)
 *  - Speed-Telemetry (Ø Response Time & Reflex-Tiebreaker) + 3 Bot Difficulty Profiles
 *  - Full Keyboard Controls (1-4 / A-D & Space/Enter) + Safe Timer Auto-Stop on View Switch
 */

(function () {
    'use strict';

    const TOTAL_ROUNDS = 5;
    const QUESTIONS_PER_ROUND = 3;
    const QUESTION_TIME_LIMIT_SEC = 20;

    const BOT_PROFILES = {
        'pj@klinik-bot.ch': {
            email: 'pj@klinik-bot.ch',
            name: '👶 PJ-Student (Training)',
            accuracy: 0.60,
            minTime: 6.5,
            maxTime: 14.0
        },
        'dr.house@klinik-bot.ch': {
            email: 'dr.house@klinik-bot.ch',
            name: '🩺 Dr. House (Oberarzt)',
            accuracy: 0.78,
            minTime: 3.5,
            maxTime: 8.5
        },
        'chefarzt@klinik-bot.ch': {
            email: 'chefarzt@klinik-bot.ch',
            name: '🧠 IMPP-Endgegner (Chefarzt)',
            accuracy: 0.92,
            minTime: 2.2,
            maxTime: 5.2
        }
    };
    const DEFAULT_BOT_EMAIL = 'dr.house@klinik-bot.ch';

    const BUILTIN_DUEL_QUESTIONS = [
        {
            category: 'Kardiologie & Angiologie',
            question: 'Welches EKG-Kriterium beweist am ehesten einen posterioren Myokardinfarkt in den Standardableitungen V1–V3?',
            options: [
                'Horizontale ST-Senkung in V1–V3 mit überhöhter, breiter R-Zacke (Spiegelbild)',
                'Isolierte T-Negativierung in aVR und V1 ohne R-Progression',
                'Biphasische P-Welle in Ableitung II mit verkürzter PQ-Zeit < 120 ms',
                'Konkave ST-Hebung aus dem absteigenden S in allen Brustwandableitungen'
            ],
            correct_index: 0,
            explanation: 'Da V1–V3 auf der Vorderwand kleben, bildet sich eine transmurale Ischämie der posterioren Wand spiegelbildlich als ST-Senkung mit großer R-Zacke ab.'
        },
        {
            category: 'Kardiologie & Angiologie',
            question: 'Ein 68-jähriger Patient mit Vorhofflimmern und eGFR 22 ml/min benötigt eine therapeutische Antikoagulation. Was gilt für Dabigatran?',
            options: [
                'Kontraindiziert, da Dabigatran zu über 80 % renal eliminiert wird',
                'Mittel der 1. Wahl ohne Dosisanpassung wegen rein biliärer Elimination',
                'Wirkverlust durch fehlende renale Aktivierung des Prodrugs Dabigatran-Etexilat',
                'Nur in Kombination mit Clopidogrel zugelassen, um Thrombozyten zu hemmen'
            ],
            correct_index: 0,
            explanation: 'Dabigatran wird zu ca. 80–85 % unverändert renal ausgeschieden und ist bei einer Kreatinin-Clearance < 30 ml/min kontraindiziert.'
        },
        {
            category: 'Kardiologie & Angiologie',
            question: 'Welcher Auskultationsbefund ist klassisch für eine hochgradige Aortenklappenstenose?',
            options: [
                'Spindelförmiges Systolikum im 2. ICR rechts mit Fortleitung in die Karotiden',
                'Decrescendo-Diastolikum im 3. ICR links am Erb-Punkt im Sitzen',
                'Holosystolisches Bandgeräusch über der Herzspitze mit Fortleitung in die Axilla',
                'Spät-diastolisches Rollen mit Öffnungston über dem 4. ICR parasternal'
            ],
            correct_index: 0,
            explanation: 'Die Aortenklappenstenose erzeugt ein raues, spindelförmiges Austreibungsgeräusch (Crescendo-Decrescendo) mit Punctum maximum im 2. ICR rechts und Fortleitung in die Karotiden.'
        },
        {
            category: 'Neurologie & ZNS',
            question: 'Welche Befundkonstellation charakterisiert das Arteria-spinalis-anterior-Syndrom (Beck-Syndrom)?',
            options: [
                'Paraparese mit Ausfall von Schmerz-/Temperatursinn bei erhaltenem Lagesinn',
                'Isolierter Verlust der Propriozeption und Vibration bei intakter Motorik',
                'Ipsilaterale schlaffe Parese mit kontralateralem Verlust des Berührungssinns',
                'Spastische Tetraparese mit frühzeitiger Okulomotorikstörung und Doppelbildern'
            ],
            correct_index: 0,
            explanation: 'Die A. spinalis anterior versorgt die vorderen 2/3 des Myelons (Pyramidenbahn + Tractus spinothalamicus). Die Hinterstränge (Lagesinn/Vibration) bleiben über die Aa. spinales posteriores intakt.'
        },
        {
            category: 'Neurologie & ZNS',
            question: 'Warum ist Interferon-beta bei einer Neuromyelitis-optica-Spektrum-Erkrankung (NMOSD, AQP4-IgG+) kontraindiziert?',
            options: [
                'Es triggert über Typ-I-Interferon-Signalwege und B-Zell-Stimulation schwere Schübe',
                'Es führt durch direkte Blockade von Aquaporin-4 zu einem zytotoxischen Hirnödem',
                'Es wird über CYP2D6 in einen neurotoxischen Metaboliten für Astrozyten gespalten',
                'Es induziert innerhalb weniger Tage eine irreversible funikuläre Myelose'
            ],
            correct_index: 0,
            explanation: 'Klassische MS-Basistherapien wie Interferon-beta verschlechtern eine Th17/B-Zell-vermittelte NMOSD drastisch und lösen schwere Schübe aus.'
        },
        {
            category: 'Neurologie & ZNS',
            question: 'Welcher Laborparameter deckt einen funktionellen Vitamin-B12-Mangel (z. B. nach Lachgas-Abusus) am sensitivsten auf?',
            options: [
                'Deutlich erhöhte Methylmalonsäure (MMA) und Homocystein im Serum',
                'Erniedrigtes Coeruloplasmin bei gleichzeitig erhöhter Kupferausscheidung',
                'Isoliert erhöhtes Ferritin bei mikrozytärer, hypochromer Erythropoese',
                'Verminderte Aktivität der Glucose-6-Phosphat-Dehydrogenase im Erythrozyten'
            ],
            correct_index: 0,
            explanation: 'Lachgas (N2O) oxidiert das Cobalt-Ion im Vitamin B12 irreversibel. Selbst bei noch normwertigem Gesamt-B12 im Serum steigen Methylmalonsäure (MMA) und Homocystein massiv an.'
        },
        {
            category: 'Klinische Pharmakologie',
            question: 'Warum darf Morphin bei schwerer Niereninsuffizienz (eGFR < 30 ml/min) nicht eingesetzt werden?',
            options: [
                'Kumulation von Morphin-6-Glucuronid (Atemdepression) und Morphin-3-Glucuronid (Neuroexzitation)',
                'Vollständiger Wirkverlust durch fehlende renale 1-alpha-Hydroxylierung zum aktiven Metaboliten',
                'Direkte kristalline Ausfällung von Morphin-Sulfat im proximalen Nierentubulus',
                'Kompetitive Hemmung der tubulären Kaliumsekretion mit fulminanter Hyperkaliämie'
            ],
            correct_index: 0,
            explanation: 'Morphin wird hepatisch zu M6G (potent analgetisch/atemdepressiv) und M3G (neuroexzitatorisch) glucuronidiert, welche beide renal eliminiert werden.'
        },
        {
            category: 'Klinische Pharmakologie',
            question: 'Welche pharmakologische Eigenschaft unterscheidet Buprenorphin von reinem Fentanyl oder Morphin?',
            options: [
                'Partialagonist am μ-Rezeptor (Ceiling-Effekt für Atemdepression) und κ-Antagonist',
                'Reiner Antagonist am μ-Rezeptor mit einer extrem kurzen Halbwertszeit von 15 Minuten',
                'Reines Prodrug, das erst durch CYP2D6 in der Leber zu Hydromorphon aktiviert wird',
                'Ausschließliche Wirkung an peripheren Opioidrezeptoren im Darm wegen P-gp-Efflux'
            ],
            correct_index: 0,
            explanation: 'Buprenorphin bindet hochaffin als Partialagonist an den μ-Opioid-Rezeptor (Ceiling-Effekt für Atemdepression) und wirkt antagonistisch am κ-Rezeptor.'
        },
        {
            category: 'Klinische Pharmakologie',
            question: 'Um wie viel Prozent sollte die berechnete Äquivalenzdosis bei einer regulären Opioidrotation (ausgenommen Methadon) initial reduziert werden?',
            options: [
                'Reduktion der berechneten Äquivalenzdosis um 30 bis 50 Prozent',
                'Erhöhung der berechneten Äquivalenzdosis um 25 bis 40 Prozent',
                'Exakte 1:1-Übernahme ohne Dosisreduktion zur Vermeidung von Schmerzspitzen',
                'Reduktion der Dosis um exakt 95 Prozent für die ersten sieben Therapietage'
            ],
            correct_index: 0,
            explanation: 'Wegen unvollständiger Kreuztoleranz wird die errechnete Äquivalenzdosis bei einer Opioidrotation um 30–50 % (bei Wechsel auf Methadon um 75–90 %) reduziert.'
        },
        {
            category: 'Pneumologie & Intensivmedizin',
            question: 'Wann ist bei einer akuten Lungenarterienembolie (LAE) primär eine systemische Thrombolyse (z. B. mit rt-PA) indiziert?',
            options: [
                'Bei High-Risk-LAE mit hämodynamischer Instabilität (obstruktiver Schock, RRsys < 90 mmHg)',
                'Bei jedem positiven D-Dimer-Test in Kombination mit einer Sinustachykardie > 100/min',
                'Bei isoliertem Nachweis eines subsegmentalen Embolus ohne Rechtsherzbelastung',
                'Grundsätzlich bei allen Patienten unter 65 Jahren zur Prävention einer tiefen Venenthrombose'
            ],
            correct_index: 0,
            explanation: 'Die systemische Thrombolyse ist der High-Risk-LAE (hämodynamische Instabilität / obstruktiver Schock mit RRsys < 90 mmHg) vorbehalten.'
        },
        {
            category: 'Pneumologie & Intensivmedizin',
            question: 'Welcher Pathomechanismus führt bei der schweren akuten Lungenembolie primär zum kardiogenen/obstruktiven Kreislaufversagen?',
            options: [
                'Abrupter Nachlastanstieg des rechten Ventrikels mit Septumshift und linksventrikulärem Vorlastmangel',
                'Direkte Koronarembolie über das Foramen ovale als obligate Ursache des Linksherzversagens',
                'Neurogener Vagusreflex mit sofortiger Asystolie durch Dehnung der Pleura parietalis',
                'Massiver Flüssigkeitsverlust in das Interstitium durch histaminvermittelte Kapillarleckage'
            ],
            correct_index: 0,
            explanation: 'Die Verlegung der Pulmonalstrombahn erhöht abrupt die RV-Nachlast. Der rechte Ventrikel dilatiert, komprimiert über den Septumshift den linken Ventrikel und führt zum Vorlastmangel.'
        },
        {
            category: 'Pneumologie & Intensivmedizin',
            question: 'Welche Kombination bildet die klassische Kriterien-Gruppe des CURB-65-Scores bei ambulant erworbener Pneumonie?',
            options: [
                'Verwirrtheit, Harnstoff > 7 mmol/l, Atemfrequenz ≥ 30/min, RR < 90/60 mmHg, Alter ≥ 65 J.',
                'CRP > 100 mg/l, Urobilinogenurie, Ruhedyspnoe, Bradykardie < 50/min, Alter ≥ 65 J.',
                'Cyanose, Urinausscheidung < 20 ml/h, Rasselgeräusche basal, Bilirubin > 2 mg/dl, Alter ≥ 65 J.',
                'Chronische Bronchitis, Untergewicht, Röntgen-Infiltrat, Blutkultur positiv, Alter ≥ 65 J.'
            ],
            correct_index: 0,
            explanation: 'CURB-65 steht für: Confusion, Urea (> 7 mmol/l), Respiratory rate (≥ 30/min), Blood pressure (< 90/60 mmHg) und Alter ≥ 65 Jahre.'
        },
        {
            category: 'Hämatologie & Onkologie',
            question: 'Welche zytogenetische Translokation ist pathognomonisch für das klassische follikuläre Lymphom?',
            options: [
                'Translokation t(14;18) mit Überexpression des anti-apoptotischen BCL2-Proteins',
                'Translokation t(9;22) mit Bildung des konstitutiv aktiven BCR-ABL1-Fusionsgens',
                'Translokation t(15;17) mit Fusion des PML-RARA-Rezeptors und Differenzierungsblock',
                'Translokation t(8;14) mit Fusion des MYC-Protoonkogens an den IgH-Promotor'
            ],
            correct_index: 0,
            explanation: 'Beim follikulären Lymphom führt t(14;18) zur konstitutiven Überexpression von BCL2, was die Apoptose der Keimzentrums-B-Zellen verhindert.'
        },
        {
            category: 'Hämatologie & Onkologie',
            question: 'Welche Elektrolytstörung tritt beim akuten Tumorlysesyndrom (TLS) typischerweise NICHT auf?',
            options: [
                'Ausgeprägte Hyperkalzämie (stattdessen entsteht eine sekundäre Hypokalzämie)',
                'Schwere Hyperkaliämie durch massiven Austritt intrazellulärer Kaliumionen',
                'Ausgeprägte Hyperphosphatämie durch Freisetzung intrazellulärer Phosphate',
                'Massive Hyperurikämie durch den Abbau freigesetzter Nukleinsäuren (Purine)'
            ],
            correct_index: 0,
            explanation: 'Beim Tumorlysesyndrom fällt das hohe Phosphat mit Kalzium zu Kalziumphosphat aus, was zu einer sekundären HYPOkalzämie führt.'
        },
        {
            category: 'Hämatologie & Onkologie',
            question: 'Welcher Wirkmechanismus liegt dem Einsatz von Rasburicase beim Hochrisiko-Tumorlysesyndrom zugrunde?',
            options: [
                'Rekombinante Uratoxidase, die Harnsäure direkt in gut wasserlösliches Allantoin umwandelt',
                'Kompetitive Hemmung der Xanthinoxidase zur Blockade der Harnsäure-Neusynthese',
                'Steigerung der tubulären Harnsäuresekretion durch Alkalisierung des Primärharns',
                'Direkte Chelatbildung mit freiem Kalziumphosphat im renalen Sammelrohrsystem'
            ],
            correct_index: 0,
            explanation: 'Rasburicase baut als rekombinante Uratoxidase bereits vorhandene Harnsäure enzymatisch zu gut wasserlöslichem Allantoin ab.'
        },
        {
            category: 'Psychiatrie & Psychosomatik',
            question: 'Welche zusätzliche Symptom-Trias (Störung der Selbstorganisation, DSO) unterscheidet in der ICD-11 die komplexe PTBS (KPTBS) von der klassischen PTBS?',
            options: [
                'Affektregulationsstörung, chronisch negatives Selbstkonzept und Beziehungsstörungen',
                'Akute optische Halluzinationen, formale Denkstörungen und katatone Erstarrung',
                'Ausgeprägte manische Phasen, Ideenflucht und vermindertes Schlafbedürfnis',
                'Zwanghaftes Kontrollverhalten, isolierte Tierphobien und hypochondrische Ängste'
            ],
            correct_index: 0,
            explanation: 'Die KPTBS erfordert in der ICD-11 neben den 3 PTBS-Kernkriterien die 3 DSO-Cluster: Affektregulationsstörung, negatives Selbstkonzept und Beziehungsstörungen.'
        },
        {
            category: 'Psychiatrie & Psychosomatik',
            question: 'Warum sind Benzodiazepine in der Akutphase unmittelbar nach einem psychischen Trauma kontraindiziert?',
            options: [
                'Sie hemmen die erforderliche Furchtextinktion/Gedächtniskonsolidierung und fördern Chronifizierung',
                'Sie lösen über eine direkte Dopamin-Freisetzung im Striatum sofortige Psychosen aus',
                'Sie führen in Kombination mit körpereigenem Adrenalin zu maligner Hyperthermie',
                'Sie blockieren selektiv die Wirkung einer späteren SSRI-Therapie durch Enzyminduktion'
            ],
            correct_index: 0,
            explanation: 'Benzodiazepine unterdrücken die physiologische Traumaverarbeitung und Furchtextinktion und erhöhen das Risiko einer späteren PTBS.'
        },
        {
            category: 'Psychiatrie & Psychosomatik',
            question: 'Welche Therapieform gilt laut Leitlinien als Behandlung der 1. Wahl bei einer manifesten Posttraumatischen Belastungsstörung (PTBS)?',
            options: [
                'Traumafokussierte kognitive Verhaltenstherapie (TF-KVT) oder EMDR',
                'Hochdosierte Monotherapie mit Haloperidol über mindestens sechs Monate',
                'Unstrukturierte, rein stützende Gesprächstherapie unter strikter Traumavermeidung',
                'Langzeitgabe von Lorazepam kombiniert mit abendlichem Zolpidem'
            ],
            correct_index: 0,
            explanation: 'Traumafokussierte Psychotherapie (TF-KVT oder EMDR) hat die höchste Effektstärke und ist Goldstandard.'
        }
    ];

    const state = {
        myEmail: '',
        myUserId: null,
        isAuthenticated: false,
        matches: [],
        activeMatch: null,
        viewMode: 'lobby', // 'lobby' | 'match_overview' | 'category_select' | 'playing_round'
        selectedBotEmail: DEFAULT_BOT_EMAIL,
        inspectedRoundNum: null, // Geöffnete Runde im Runden-Inspektor
        searchQueryEmail: '',
        statusMessage: null,
        activeRoundNum: 1,
        activeQuestionIdx: 0,
        activeQuestions: [],
        roundAnswers: [],
        questionLocked: false,
        timerRafId: null,
        questionStartTime: 0,
        remainingMs: QUESTION_TIME_LIMIT_SEC * 1000,
        realtimeChannel: null,
        pollIntervalId: null,
        keyboardBound: false
    };

    // ========================================================================
    // 1. INITIALISIERUNG, AUTH, KEYBOARD-SHORTCUTS & POLLING
    // ========================================================================

    function getSupabase() {
        return window.supabaseClient || window.supabase || window.sb || (window.Auth && window.Auth.supabase) || null;
    }

    function isBotEmail(email) {
        const clean = String(email || '').toLowerCase().trim();
        return Boolean(BOT_PROFILES[clean]);
    }

    async function resolveCurrentUserEmail() {
        const sb = getSupabase();
        if (sb && sb.auth) {
            try {
                const { data } = await sb.auth.getSession();
                const user = data?.session?.user || window.currentSessionUser;
                if (user && user.email) {
                    state.myEmail = user.email.toLowerCase().trim();
                    state.myUserId = user.id;
                    state.isAuthenticated = true;
                    return state.myEmail;
                }
            } catch (_e) {}
        }

        if (window.currentSessionUser && window.currentSessionUser.email) {
            state.myEmail = window.currentSessionUser.email.toLowerCase().trim();
            state.myUserId = window.currentSessionUser.id || null;
            state.isAuthenticated = true;
            return state.myEmail;
        }

        const domEmail = document.getElementById('auth-user-email')?.textContent?.trim();
        if (domEmail && domEmail.includes('@')) {
            state.myEmail = domEmail.toLowerCase().trim();
            state.isAuthenticated = true;
            return state.myEmail;
        }

        state.isAuthenticated = false;
        state.myUserId = null;
        state.myEmail = localStorage.getItem('medcheck_guest_duel_email') || 'gast-arzt@medcheck.ch';
        return state.myEmail;
    }

    function ensureDomStructure() {
        let viewSection = document.getElementById('duel-view');
        if (!viewSection) {
            const mainEl = document.querySelector('.content-body > div') || document.querySelector('main') || document.body;
            viewSection = document.createElement('section');
            viewSection.id = 'duel-view';
            viewSection.className = 'panel view-section hidden';
            viewSection.style.display = 'none';
            mainEl.appendChild(viewSection);
        }
        return viewSection;
    }

    function setupKeyboardShortcuts() {
        if (state.keyboardBound) return;
        state.keyboardBound = true;

        window.addEventListener('keydown', (e) => {
            if (!isDuelViewVisible()) return;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

            if (state.viewMode === 'playing_round') {
                if (!state.questionLocked) {
                    const keyMap = {
                        'Digit1': 0, 'Numpad1': 0, 'KeyA': 0,
                        'Digit2': 1, 'Numpad2': 1, 'KeyB': 1,
                        'Digit3': 2, 'Numpad3': 2, 'KeyC': 2,
                        'Digit4': 3, 'Numpad4': 3, 'KeyD': 3
                    };
                    if (keyMap[e.code] !== undefined) {
                        e.preventDefault();
                        handleAnswerSubmission(keyMap[e.code], false);
                    }
                } else if (e.code === 'Space' || e.code === 'Enter') {
                    const nextBtn = document.getElementById('duel-next-q-btn');
                    if (nextBtn && !nextBtn.disabled) {
                        e.preventDefault();
                        advanceToNextQuestionOrFinishRound();
                    }
                }
            }
        });
    }

    async function init() {
        ensureDomStructure();
        setupKeyboardShortcuts();
        await resolveCurrentUserEmail();
        await loadMatches();
        subscribeRealtimeUpdates();
        startBackgroundPolling();
        updateSidebarBadge();

        const sb = getSupabase();
        if (sb && sb.auth) {
            sb.auth.onAuthStateChange(async () => {
                await resolveCurrentUserEmail();
                await loadMatches();
                if (isDuelViewVisible() && state.viewMode !== 'playing_round') {
                    render();
                }
            });
        }
    }

    async function openView() {
        stopQuestionTimer();
        ensureDomStructure();
        await resolveCurrentUserEmail();
        await loadMatches();
        state.viewMode = 'lobby';
        state.inspectedRoundNum = null;
        render();
    }

    function startBackgroundPolling() {
        if (state.pollIntervalId) clearInterval(state.pollIntervalId);
        state.pollIntervalId = setInterval(async () => {
            if (!isDuelViewVisible() || state.viewMode === 'playing_round' || state.viewMode === 'category_select') {
                return;
            }
            const prevUpdated = state.activeMatch?.updated_at;
            const prevCount = state.matches.length;
            await loadMatches();

            const newUpdated = state.activeMatch?.updated_at;
            if (prevUpdated !== newUpdated || state.matches.length !== prevCount) {
                render();
            }
        }, 5000);
    }

    // ========================================================================
    // 2. ERWEITERTER FRAGEN-POOL (BUILT-IN + FÄLLE + PHARMAKOLOGIE-KOMPASS)
    // ========================================================================

    /**
     * Entfernt den technischen "Zeichenvergleich:"-Block aus Masterprompt-Erklärungen,
     * damit im Duell sofort die medizinische Begründung lesbar ist.
     */
    function cleanMedicalExplanation(rawExplanation) {
        if (!rawExplanation) return 'Klinische Kernfakten aus dem MedCheck-Fragenpool.';
        return String(rawExplanation)
            .replace(/\\n/g, '\n')
            .replace(/^Zeichenvergleich:\s*[\s\S]*?\(Maximale Varianz:[^)]+\)\s*/i, '')
            .trim();
    }

    function buildQuestionBankByCategory() {
        const bank = {};

        const addQ = (catRaw, qObj) => {
            const cat = cleanCategoryName(catRaw);
            if (!bank[cat]) bank[cat] = [];
            if (!Array.isArray(qObj.options) || qObj.options.length < 2) return;
            if (bank[cat].some(existing => existing.question === qObj.question)) return;

            let opts = [...qObj.options];
            let corrIdx = Number(qObj.correct_index) || 0;
            if (opts.length > 4) {
                const correctText = opts[corrIdx];
                const distractors = shuffleArray(opts.filter((_, idx) => idx !== corrIdx)).slice(0, 3);
                opts = shuffleArray([correctText, ...distractors]);
                corrIdx = opts.indexOf(correctText);
            }

            bank[cat].push({
                category: cat,
                question: qObj.question,
                options: opts,
                correct_index: corrIdx,
                explanation: cleanMedicalExplanation(qObj.explanation),
                target_disease: qObj.target_disease || cat
            });
        };

        // 1. Integrierte Klinik-Duell-Fragen
        BUILTIN_DUEL_QUESTIONS.forEach(q => addQ(q.category, q));

        // 2. Master-Quiz Fragen aus allen registrierten klinischen Fällen
        const registeredCases = typeof window.getRegisteredCases === 'function'
            ? window.getRegisteredCases({ ignoreSpecialtyFilter: true })
            : [];
        registeredCases.forEach(c => {
            const rawCat = c.folder_name || c.metadata?.medical_field || 'Allgemeinmedizin';
            const quizzes = c.extra_tasks?.master_quiz || [];
            quizzes.forEach(q => addQ(rawCat, {
                ...q,
                target_disease: q.target_disease || c.metadata?.primary_disease || rawCat
            }));
        });

        // 3. Pharmakologie-Kompass-Szenarien automatisch als 4-Optionen-Fragen einbinden
        try {
            const pharmaSets = JSON.parse(localStorage.getItem('medcheck_pharma_sets') || '[]');
            if (Array.isArray(pharmaSets)) {
                pharmaSets.forEach(set => {
                    if (set.game_type === 'drag_matrix' || !Array.isArray(set.questions)) return;
                    const cat = set.folder_name || set.medical_field || 'Klinische Pharmakologie';
                    set.questions.forEach(pq => {
                        if (!pq.directions) return;
                        const dirList = ['up', 'right', 'down', 'left']
                            .map(k => pq.directions[k])
                            .filter(Boolean);
                        if (dirList.length < 4) return;
                        const corrIdx = dirList.findIndex(d => d.is_correct);
                        if (corrIdx === -1) return;

                        addQ(cat, {
                            question: `${pq.patient_context ? pq.patient_context + ' — ' : ''}${pq.prompt || 'Welcher Wirkstoff ist hier indiziert?'}`,
                            options: dirList.map(d => `${d.drug}${d.class ? ' (' + d.class + ')' : ''}`),
                            correct_index: corrIdx,
                            explanation: `${dirList[corrIdx].feedback || ''} ${pq.pearl ? '💡 Pearl: ' + pq.pearl : ''}`.trim()
                        });
                    });
                });
            }
        } catch (_e) {}

        return bank;
    }

    function cleanCategoryName(raw) {
        if (!raw) return 'Allgemeinmedizin';
        let str = String(raw).trim();
        if (str.includes('_')) {
            str = str.split('_').slice(1).join('_').trim() || str;
        }
        return str.length > 36 ? str.slice(0, 34) + '…' : str;
    }

    function getRandomCategoryChoices(excludeCategories = []) {
        const bank = buildQuestionBankByCategory();
        let validCats = Object.keys(bank).filter(c => bank[c].length >= 3 && !excludeCategories.includes(c));
        if (validCats.length < 4) {
            validCats = Object.keys(bank);
        }
        return shuffleArray(validCats).slice(0, 4);
    }

    function pickThreeQuestionsForCategory(categoryName) {
        const bank = buildQuestionBankByCategory();
        let pool = bank[categoryName] || [];
        if (pool.length < 3) {
            const allQs = Object.values(bank).flat();
            pool = [...pool, ...allQs];
        }
        return shuffleArray(pool).slice(0, QUESTIONS_PER_ROUND).map(q => {
            const correctOptionText = q.options[q.correct_index];
            const shuffledOptions = shuffleArray([...q.options]);
            return {
                category: categoryName,
                target_disease: q.target_disease || categoryName,
                question: q.question,
                options: shuffledOptions,
                correct_index: shuffledOptions.indexOf(correctOptionText),
                explanation: q.explanation
            };
        });
    }

    // ========================================================================
    // 3. ROBUSTE CLOUD-PERSISTENZ & DETERMINISTISCHER STATE-RECONCILER
    // ========================================================================

    function getLocalMatches() {
        try {
            return JSON.parse(localStorage.getItem('medcheck_duel_matches_v1') || '[]');
        } catch (_e) {
            return [];
        }
    }

    function saveLocalMatches(list) {
        try {
            localStorage.setItem('medcheck_duel_matches_v1', JSON.stringify(list));
        } catch (_e) {}
    }

    function getHiddenMatchIds() {
        try {
            return new Set(JSON.parse(localStorage.getItem('medcheck_duel_hidden_ids_v1') || '[]'));
        } catch (_e) {
            return new Set();
        }
    }

    function markMatchHiddenLocally(matchId) {
        const set = getHiddenMatchIds();
        set.add(matchId);
        try {
            localStorage.setItem('medcheck_duel_hidden_ids_v1', JSON.stringify(Array.from(set)));
        } catch (_e) {}
    }

    async function loadMatches() {
        await resolveCurrentUserEmail();
        const localList = getLocalMatches();
        const hiddenIds = getHiddenMatchIds();
        const mapById = new Map();

        localList.forEach(m => {
            if (!m || hiddenIds.has(m.id)) return;
            const p1 = (m.player1_email || '').toLowerCase();
            const p2 = (m.player2_email || '').toLowerCase();
            if (p1 === state.myEmail || p2 === state.myEmail) {
                mapById.set(m.id, m);
            }
        });

        const sb = getSupabase();
        if (sb && state.isAuthenticated) {
            try {
                const cleanMail = state.myEmail.replace(/,/g, '');
                const { data, error } = await sb
                    .from('duel_matches')
                    .select('*')
                    .or(`player1_email.ilike.${cleanMail},player2_email.ilike.${cleanMail}`)
                    .order('updated_at', { ascending: false });

                if (!error && Array.isArray(data)) {
                    data.forEach(row => {
                        if (hiddenIds.has(row.id)) return;
                        const cloudMatch = normalizeMatchRow(row);
                        mapById.set(cloudMatch.id, cloudMatch);
                    });
                    saveLocalMatches(Array.from(mapById.values()));
                } else if (error) {
                    console.warn('[Duel] Fehler beim Abrufen aus Supabase:', error.message);
                }
            } catch (err) {
                console.warn('[Duel] Supabase-Abfrage im Offline-Fallback:', err);
            }
        }

        state.matches = Array.from(mapById.values()).sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        if (state.activeMatch) {
            const refreshed = state.matches.find(m => m.id === state.activeMatch.id);
            if (refreshed) state.activeMatch = refreshed;
        }

        updateSidebarBadge();
    }

    function normalizeMatchRow(row) {
        const ms = typeof row.match_state === 'string' ? JSON.parse(row.match_state) : (row.match_state || {});
        const p2Mail = (row.player2_email || '').toLowerCase().trim();
        return {
            id: row.id,
            player1_id: row.player1_id || null,
            player1_email: (row.player1_email || '').toLowerCase().trim(),
            player2_email: p2Mail,
            status: row.status || 'active',
            current_round: Number(row.current_round) || 1,
            turn_email: (row.turn_email || '').toLowerCase().trim(),
            p1_score: Number(row.p1_score) || 0,
            p2_score: Number(row.p2_score) || 0,
            winner_email: row.winner_email || null,
            is_local_only: isBotEmail(p2Mail),
            match_state: ms,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString()
        };
    }

    /**
     * Deterministischer Reconciler: Berechnet Scores, Reaktionszeiten, aktuelle Runde,
     * wer am Zug ist (`turn_email`) und den Match-Status direkt aus den Runden-Daten.
     * Dadurch können sich Spieler 1 und Spieler 2 bei einem Cloud-Merge niemals gegenseitig
     * den Rundenfortschritt überschreiben!
     */
    function reconcileMatchProgress(match) {
        recalculateTotalScores(match);

        for (let r = 1; r <= TOTAL_ROUNDS; r++) {
            const rData = match.match_state.rounds[r];
            if (!rData) continue;

            const p1Done = Array.isArray(rData.p1_answers) && rData.p1_answers.length >= QUESTIONS_PER_ROUND;
            const p2Done = Array.isArray(rData.p2_answers) && rData.p2_answers.length >= QUESTIONS_PER_ROUND;

            if (!p1Done || !p2Done) {
                match.status = 'active';
                match.current_round = r;
                match.winner_email = null;

                const chooserRole = getCategoryChooserRole(r);
                if (!rData.chosen_category) {
                    // Der Kategoriewähler dieser Runde ist am Zug
                    match.turn_email = chooserRole === 'p1' ? match.player1_email : match.player2_email;
                    if (!Array.isArray(rData.category_options) || rData.category_options.length === 0) {
                        const usedCats = Object.values(match.match_state.rounds)
                            .map(x => x.chosen_category)
                            .filter(Boolean);
                        rData.category_options = getRandomCategoryChoices(usedCats);
                    }
                } else if (!p1Done && !p2Done) {
                    // Kategorie gewählt, aber der Wähler hat die 3 Fragen noch nicht abgeschlossen
                    match.turn_email = chooserRole === 'p1' ? match.player1_email : match.player2_email;
                } else if (!p1Done) {
                    match.turn_email = match.player1_email;
                } else {
                    match.turn_email = match.player2_email;
                }
                return;
            }
        }

        // Alle 5 Runden sind von beiden Spielern vollständig beantwortet!
        match.status = 'finished';
        match.current_round = TOTAL_ROUNDS;
        match.turn_email = '';

        if (match.p1_score > match.p2_score) {
            match.winner_email = match.player1_email;
        } else if (match.p2_score > match.p1_score) {
            match.winner_email = match.player2_email;
        } else {
            match.winner_email = 'draw';
        }
    }

    async function insertNewMatchToDb(matchObj) {
        const local = getLocalMatches().filter(m => m.id !== matchObj.id);
        local.unshift(matchObj);
        saveLocalMatches(local);

        const sb = getSupabase();
        if (sb && !matchObj.is_local_only) {
            if (!state.isAuthenticated) {
                setStatusMessage('error', 'Hinweis: Du bist aktuell nicht in der Cloud angemeldet (Einstellungen). Das Duell wurde nur lokal gespeichert.');
                return;
            }
            try {
                const { data, error } = await sb
                    .from('duel_matches')
                    .insert([{
                        id: matchObj.id,
                        player1_id: state.myUserId,
                        player1_email: matchObj.player1_email,
                        player2_email: matchObj.player2_email,
                        status: matchObj.status,
                        current_round: matchObj.current_round,
                        turn_email: matchObj.turn_email,
                        p1_score: matchObj.p1_score,
                        p2_score: matchObj.p2_score,
                        winner_email: matchObj.winner_email,
                        match_state: matchObj.match_state,
                        updated_at: matchObj.updated_at
                    }])
                    .select();

                if (error) {
                    console.error('[Duel] Supabase INSERT Fehler:', error);
                    setStatusMessage('error', `Cloud-Speicherfehler: ${error.message}. Bitte prüfe die SQL-Policy in Supabase.`);
                } else if (data && data[0]) {
                    matchObj = normalizeMatchRow(data[0]);
                }
            } catch (err) {
                console.error('[Duel] Netzwerkfehler beim Erstellen:', err);
            }
        }

        await loadMatches();
    }

    async function updateExistingMatchInDb(matchObj) {
        matchObj.updated_at = new Date().toISOString();

        const sb = getSupabase();
        if (sb && !matchObj.is_local_only) {
            if (!state.isAuthenticated) {
                setStatusMessage('error', 'Du bist nicht angemeldet! Bitte logge dich unter „Einstellungen“ ein, damit dein Gegner deinen Spielstand erhält.');
                return;
            }

            try {
                // A) Frischen Stand aus der DB holen, um Race-Conditions zu verhindern
                const { data: latestRows } = await sb
                    .from('duel_matches')
                    .select('*')
                    .eq('id', matchObj.id)
                    .maybeSingle();

                if (latestRows && latestRows.match_state) {
                    const cloudState = typeof latestRows.match_state === 'string'
                        ? JSON.parse(latestRows.match_state)
                        : latestRows.match_state;

                    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
                        const localRound = matchObj.match_state.rounds[r] || {};
                        const cloudRound = cloudState.rounds?.[r] || {};

                        matchObj.match_state.rounds[r] = {
                            ...cloudRound,
                            ...localRound,
                            chosen_category: localRound.chosen_category || cloudRound.chosen_category || null,
                            questions: (localRound.questions && localRound.questions.length > 0)
                                ? localRound.questions
                                : (cloudRound.questions || []),
                            p1_answers: localRound.p1_answers || cloudRound.p1_answers || null,
                            p2_answers: localRound.p2_answers || cloudRound.p2_answers || null
                        };
                    }
                }

                // WICHTIG: Nach dem Merge den Spielstatus deterministisch neu berechnen!
                reconcileMatchProgress(matchObj);

                // B) Explizites UPDATE
                const { data: updatedRows, error: updateErr } = await sb
                    .from('duel_matches')
                    .update({
                        status: matchObj.status,
                        current_round: matchObj.current_round,
                        turn_email: matchObj.turn_email,
                        p1_score: matchObj.p1_score,
                        p2_score: matchObj.p2_score,
                        winner_email: matchObj.winner_email,
                        match_state: matchObj.match_state,
                        updated_at: matchObj.updated_at
                    })
                    .eq('id', matchObj.id)
                    .select();

                if (updateErr) {
                    console.error('[Duel] Supabase UPDATE Fehler:', updateErr);
                    setStatusMessage('error', `Spielstand konnte nicht übertragen werden: ${updateErr.message}`);
                } else if (updatedRows && updatedRows[0]) {
                    state.activeMatch = normalizeMatchRow(updatedRows[0]);
                }
            } catch (err) {
                console.error('[Duel] Fehler beim Cloud-Update:', err);
            }
        } else {
            reconcileMatchProgress(matchObj);
        }

        const local = getLocalMatches().filter(m => m.id !== matchObj.id);
        local.unshift(matchObj);
        saveLocalMatches(local);

        await loadMatches();
    }

    async function deleteMatchById(matchId) {
        if (!matchId) return;
        const target = state.matches.find(m => m.id === matchId);
        const oppName = target
            ? formatPlayerName(getMyRole(target) === 'p1' ? target.player2_email : target.player1_email)
            : matchId;

        if (!window.confirm(`Möchtest du das Duell gegen „${oppName}“ wirklich aus deiner Liste entfernen?`)) {
            return;
        }

        markMatchHiddenLocally(matchId);
        const filtered = getLocalMatches().filter(m => m.id !== matchId);
        saveLocalMatches(filtered);

        const sb = getSupabase();
        if (sb && state.isAuthenticated && target && !target.is_local_only) {
            try {
                await sb.from('duel_matches').delete().eq('id', matchId);
            } catch (_e) {}
        }

        if (state.activeMatch && state.activeMatch.id === matchId) {
            state.activeMatch = null;
            state.viewMode = 'lobby';
        }

        await loadMatches();
        render();
    }

    function subscribeRealtimeUpdates() {
        const sb = getSupabase();
        if (!sb || typeof sb.channel !== 'function' || state.realtimeChannel) return;

        try {
            state.realtimeChannel = sb
                .channel('duel_matches_realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'duel_matches' }, async () => {
                    await loadMatches();
                    if (isDuelViewVisible() && state.viewMode !== 'playing_round' && state.viewMode !== 'category_select') {
                        render();
                    }
                })
                .subscribe();
        } catch (_e) {}
    }

    function isDuelViewVisible() {
        const el = document.getElementById('duel-view');
        return el && !el.classList.contains('hidden') && el.style.display !== 'none';
    }

    function updateSidebarBadge() {
        const badge = document.getElementById('nav-duel-badge');
        if (!badge) return;
        const myTurnCount = state.matches.filter(
            m => m.status === 'active' && m.turn_email.toLowerCase() === state.myEmail.toLowerCase()
        ).length;

        if (myTurnCount > 0) {
            badge.style.display = 'inline-flex';
            badge.textContent = String(myTurnCount);
        } else {
            badge.style.display = 'none';
        }
    }

    // ========================================================================
    // 4. SPIELFLUSS-LOGIK (5 RUNDEN, KATEGORIEWAHL, ZUGWECHSEL & 3 BOT-STUFEN)
    // ========================================================================

    function getCategoryChooserRole(roundNum) {
        return (roundNum % 2 === 1) ? 'p1' : 'p2';
    }

    function getMyRole(match) {
        return match.player1_email.toLowerCase().trim() === state.myEmail.toLowerCase().trim() ? 'p1' : 'p2';
    }

    async function createNewDuel(opponentEmailRaw) {
        await resolveCurrentUserEmail();
        const opponentEmail = String(opponentEmailRaw || '').trim().toLowerCase();

        if (!opponentEmail || !opponentEmail.includes('@')) {
            setStatusMessage('error', 'Bitte gib eine gültige E-Mail-Adresse deines Freundes ein (z. B. clara@stud.unibas.ch).');
            return;
        }

        if (!isBotEmail(opponentEmail) && !state.isAuthenticated) {
            setStatusMessage('error', 'Für ein Online-Duell mit Freunden musst du unter „Einstellungen“ mit deiner E-Mail angemeldet sein!');
            return;
        }

        if (opponentEmail === state.myEmail.toLowerCase()) {
            setStatusMessage('error', 'Du kannst dich nicht selbst herausfordern. Nutze eine andere E-Mail oder spiele gegen einen Klinik-Bot!');
            return;
        }

        const matchId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'duel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

        const roundsObj = {};
        for (let r = 1; r <= TOTAL_ROUNDS; r++) {
            roundsObj[r] = {
                round_number: r,
                chooser_role: getCategoryChooserRole(r),
                category_options: r === 1 ? getRandomCategoryChoices() : [],
                chosen_category: null,
                questions: [],
                p1_answers: null,
                p2_answers: null
            };
        }

        const newMatch = {
            id: matchId,
            player1_id: state.myUserId,
            player1_email: state.myEmail.toLowerCase().trim(),
            player2_email: opponentEmail,
            status: 'active',
            current_round: 1,
            turn_email: state.myEmail.toLowerCase().trim(),
            p1_score: 0,
            p2_score: 0,
            winner_email: null,
            is_local_only: isBotEmail(opponentEmail),
            match_state: {
                rounds: roundsObj,
                p1_total_time_sec: 0,
                p2_total_time_sec: 0
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        await insertNewMatchToDb(newMatch);
        state.activeMatch = newMatch;
        state.searchQueryEmail = '';
        state.statusMessage = null;
        state.inspectedRoundNum = null;
        state.viewMode = 'match_overview';
        render();
    }

    async function startTurnAction() {
        await loadMatches();
        const match = state.activeMatch;
        if (!match || match.status !== 'active') return;

        const rNum = match.current_round;
        const roundData = match.match_state.rounds[rNum];
        if (!roundData) return;

        state.activeRoundNum = rNum;

        if (!roundData.chosen_category || !Array.isArray(roundData.questions) || roundData.questions.length === 0) {
            if (!Array.isArray(roundData.category_options) || roundData.category_options.length === 0) {
                const usedCats = Object.values(match.match_state.rounds)
                    .map(r => r.chosen_category)
                    .filter(Boolean);
                roundData.category_options = getRandomCategoryChoices(usedCats);
            }
            state.viewMode = 'category_select';
            render();
        } else {
            beginThreeQuestionSequence(roundData.questions);
        }
    }

    async function selectCategoryForRound(chosenCat) {
        const match = state.activeMatch;
        if (!match) return;

        const rNum = match.current_round;
        const roundData = match.match_state.rounds[rNum];
        roundData.chosen_category = chosenCat;
        roundData.questions = pickThreeQuestionsForCategory(chosenCat);

        await updateExistingMatchInDb(match);
        beginThreeQuestionSequence(roundData.questions);
    }

    function beginThreeQuestionSequence(questionsArray) {
        state.activeQuestions = questionsArray;
        state.activeQuestionIdx = 0;
        state.roundAnswers = [];
        state.questionLocked = false;
        state.viewMode = 'playing_round';
        render();
        startQuestionTimer();
    }

    // ========================================================================
    // 5. DER 20-SEKUNDEN TOP-CENTER COUNTDOWN-BANNER (MIT VIEW-GUARD)
    // ========================================================================

    function startQuestionTimer() {
        stopQuestionTimer();
        state.questionStartTime = performance.now();
        state.remainingMs = QUESTION_TIME_LIMIT_SEC * 1000;

        function tick(now) {
            // Sicherheits-Guard: Falls der Spieler in einen anderen Tab gewechselt hat, Timer sofort stoppen!
            if (!isDuelViewVisible() || state.viewMode !== 'playing_round') {
                stopQuestionTimer();
                return;
            }

            const elapsed = now - state.questionStartTime;
            const remaining = Math.max(0, QUESTION_TIME_LIMIT_SEC * 1000 - elapsed);
            state.remainingMs = remaining;

            updateTimerBannerDOM(remaining);

            if (remaining <= 0) {
                state.timerRafId = null;
                handleAnswerSubmission(-1, true);
                return;
            }
            state.timerRafId = requestAnimationFrame(tick);
        }

        state.timerRafId = requestAnimationFrame(tick);
    }

    function stopQuestionTimer() {
        if (state.timerRafId) {
            cancelAnimationFrame(state.timerRafId);
            state.timerRafId = null;
        }
    }

    function updateTimerBannerDOM(remainingMs) {
        const fillEl = document.getElementById('duel-timer-bar-fill');
        const textEl = document.getElementById('duel-timer-seconds-text');
        const bannerEl = document.getElementById('duel-timer-top-banner');
        if (!fillEl || !textEl) return;

        const pct = (remainingMs / (QUESTION_TIME_LIMIT_SEC * 1000)) * 100;
        const secFloat = (remainingMs / 1000).toFixed(1);

        fillEl.style.width = `${pct.toFixed(2)}%`;
        textEl.textContent = `${secFloat}s`;

        if (remainingMs <= 3500) {
            fillEl.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
            bannerEl?.classList.add('timer-critical');
        } else if (remainingMs <= 7500) {
            fillEl.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
            bannerEl?.classList.remove('timer-critical');
        } else {
            fillEl.style.background = 'linear-gradient(90deg, #10b981, #38bdf8)';
            bannerEl?.classList.remove('timer-critical');
        }
    }

    function handleAnswerSubmission(selectedIdx, isTimeout = false) {
        if (state.questionLocked) return;
        state.questionLocked = true;
        stopQuestionTimer();

        if (typeof window.triggerHaptic === 'function') {
            window.triggerHaptic(isTimeout ? [20, 40, 20] : 10);
        }

        const currentQ = state.activeQuestions[state.activeQuestionIdx];
        const isCorrect = !isTimeout && selectedIdx === Number(currentQ.correct_index);
        const timeSpentSec = Number(((QUESTION_TIME_LIMIT_SEC * 1000 - state.remainingMs) / 1000).toFixed(1));

        state.roundAnswers.push({
            selectedIdx,
            isCorrect,
            isTimeout,
            timeSec: timeSpentSec
        });

        // Leitner Spaced Repetition Telemetrie anbinden
        const conceptName = currentQ.target_disease || currentQ.category || 'Klinik-Duell';
        if (window.SpacedRepetitionEngine) {
            if (isCorrect && timeSpentSec <= 12 && typeof window.SpacedRepetitionEngine.logConceptSuccess === 'function') {
                window.SpacedRepetitionEngine.logConceptSuccess(null, conceptName);
            } else if (!isCorrect && typeof window.SpacedRepetitionEngine.logConceptStruggle === 'function') {
                window.SpacedRepetitionEngine.logConceptStruggle(null, conceptName, isTimeout ? 'duel_timeout' : 'duel_miss');
            }
        }

        const optionBtns = document.querySelectorAll('.duel-opt-btn');
        optionBtns.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === Number(currentQ.correct_index)) {
                btn.classList.add('duel-opt-correct');
            } else if (idx === selectedIdx && !isCorrect) {
                btn.classList.add('duel-opt-wrong');
            }
        });

        const fbBox = document.getElementById('duel-instant-feedback');
        if (fbBox) {
            const statusHeader = isTimeout
                ? `<div class="duel-fb-title timeout">⏰ Zeit abgelaufen (20.0s)!</div>`
                : (isCorrect
                    ? `<div class="duel-fb-title correct">✅ Richtig beantwortet (${timeSpentSec}s) – +1 Punkt!</div>`
                    : `<div class="duel-fb-title wrong">❌ Leider falsch!</div>`);

            const isLastInRound = state.activeQuestionIdx >= QUESTIONS_PER_ROUND - 1;
            const nextBtnLabel = isLastInRound
                ? '🏁 Runde speichern & übertragen (Leertaste) ➔'
                : 'Nächste Frage (' + (state.activeQuestionIdx + 2) + '/3) (Leertaste) ➔';

            fbBox.style.display = 'block';
            fbBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
                    ${statusHeader}
                    <button type="button" class="ghost-tool-btn" id="duel-save-depot-live-btn" style="font-size:0.73rem; padding:4px 10px;">
                        📌 Ins Lern-Depot speichern
                    </button>
                </div>
                <div class="duel-fb-expl" style="line-height:1.55;">${escapeHtml(cleanMedicalExplanation(currentQ.explanation))}</div>
                <button type="button" class="duel-next-q-btn" id="duel-next-q-btn" style="margin-top:12px;">${nextBtnLabel}</button>
            `;

            document.getElementById('duel-save-depot-live-btn')?.addEventListener('click', (e) => {
                saveQuestionToDepot(currentQ, e.currentTarget);
            });

            document.getElementById('duel-next-q-btn')?.addEventListener('click', () => {
                advanceToNextQuestionOrFinishRound();
            });
        }
    }

    async function saveQuestionToDepot(qObj, btnEl) {
        if (!qObj || typeof window.createDepotEntry !== 'function') return;
        const correctOpt = qObj.options?.[qObj.correct_index] || '';
        const cleanExpl = cleanMedicalExplanation(qObj.explanation).slice(0, 340);

        await window.createDepotEntry({
            case_id: 'duel_arena',
            case_title: `Klinik-Duell: ${qObj.category || 'Allgemein'}`,
            category: qObj.category || 'Klinik-Duell',
            cue_context: qObj.target_disease || 'Prüfungsfrage',
            highlighted_text: `Frage: ${qObj.question} — ✓ ${correctOpt} (${cleanExpl})`
        });

        if (btnEl) {
            btnEl.textContent = '✓ Im Lern-Depot gespeichert!';
            btnEl.disabled = true;
        }
    }

    async function advanceToNextQuestionOrFinishRound() {
        if (state.activeQuestionIdx < QUESTIONS_PER_ROUND - 1) {
            state.activeQuestionIdx += 1;
            state.questionLocked = false;
            render();
            startQuestionTimer();
            return;
        }

        const nextBtn = document.getElementById('duel-next-q-btn');
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.textContent = '☁️ Übertrage Spielstand an Gegner...';
        }

        const match = state.activeMatch;
        const myRole = getMyRole(match);
        const rNum = state.activeRoundNum;
        const roundData = match.match_state.rounds[rNum];
        const prevStatus = match.status;

        if (myRole === 'p1') {
            roundData.p1_answers = state.roundAnswers;
        } else {
            roundData.p2_answers = state.roundAnswers;
        }

        reconcileMatchProgress(match);

        // Bot-Simulation, falls Gegner ein Bot ist
        if (isBotEmail(match.player2_email) && match.status === 'active' && match.turn_email === match.player2_email) {
            simulateBotTurn(match);
            reconcileMatchProgress(match);
        }

        await updateExistingMatchInDb(match);

        // XP gutschreiben, falls das Match durch diesen Zug beendet wurde
        if (prevStatus !== 'finished' && state.activeMatch?.status === 'finished') {
            if (typeof window.applyXpDelta === 'function') {
                const myScore = myRole === 'p1' ? state.activeMatch.p1_score : state.activeMatch.p2_score;
                const won = state.activeMatch.winner_email === state.myEmail;
                window.applyXpDelta(won ? 300 : 120, won ? 'Duell-Sieg 🏆' : `Duell beendet (${myScore}/15)`);
            }
        }

        state.inspectedRoundNum = rNum; // Direkt die gespielte Runde zur Nachbesprechung aufklappen
        state.viewMode = 'match_overview';
        render();
    }

    function simulateBotTurn(match) {
        const botProfile = BOT_PROFILES[match.player2_email] || BOT_PROFILES[DEFAULT_BOT_EMAIL];
        let rNum = match.current_round;
        let roundData = match.match_state.rounds[rNum];

        const generateBotAnswers = (questions) => questions.map(q => {
            const botHits = Math.random() < botProfile.accuracy;
            const wrongIndices = [0, 1, 2, 3].filter(idx => idx !== Number(q.correct_index) && idx < q.options.length);
            const selectedIdx = botHits
                ? Number(q.correct_index)
                : wrongIndices[Math.floor(Math.random() * wrongIndices.length)] ?? 0;
            const timeSec = Number((botProfile.minTime + Math.random() * (botProfile.maxTime - botProfile.minTime)).toFixed(1));
            return {
                selectedIdx,
                isCorrect: botHits,
                isTimeout: false,
                timeSec
            };
        });

        // 1. Falls eine Kategorie in der aktuellen Runde schon gewählt ist, beantwortet der Bot die 3 Fragen
        if (roundData && roundData.chosen_category && !roundData.p2_answers) {
            roundData.p2_answers = generateBotAnswers(roundData.questions);
            reconcileMatchProgress(match);
        }

        // 2. Falls der Bot danach in der nächsten Runde als Kategoriewähler dran ist, wählt und spielt er sofort
        rNum = match.current_round;
        roundData = match.match_state.rounds[rNum];
        if (match.status === 'active' && match.turn_email === match.player2_email && roundData && !roundData.chosen_category) {
            const usedCats = Object.values(match.match_state.rounds).map(r => r.chosen_category).filter(Boolean);
            const options = getRandomCategoryChoices(usedCats);
            roundData.category_options = options;
            const botChosenCat = options[Math.floor(Math.random() * options.length)] || options[0];
            roundData.chosen_category = botChosenCat;
            roundData.questions = pickThreeQuestionsForCategory(botChosenCat);
            roundData.p2_answers = generateBotAnswers(roundData.questions);
        }
    }

    function recalculateTotalScores(match) {
        let s1 = 0;
        let s2 = 0;
        let t1 = 0;
        let t2 = 0;

        Object.values(match.match_state.rounds || {}).forEach(r => {
            if (Array.isArray(r.p1_answers)) {
                s1 += r.p1_answers.filter(a => a && a.isCorrect).length;
                t1 += r.p1_answers.reduce((acc, a) => acc + (Number(a?.timeSec) || 0), 0);
            }
            if (Array.isArray(r.p2_answers)) {
                s2 += r.p2_answers.filter(a => a && a.isCorrect).length;
                t2 += r.p2_answers.reduce((acc, a) => acc + (Number(a?.timeSec) || 0), 0);
            }
        });

        match.p1_score = s1;
        match.p2_score = s2;
        match.match_state.p1_total_time_sec = Number(t1.toFixed(1));
        match.match_state.p2_total_time_sec = Number(t2.toFixed(1));
    }

    // ========================================================================
    // 6. UI-RENDERING (INKL. RUNDEN-INSPEKTOR & BEKANNTE GEGNER)
    // ========================================================================

    function setStatusMessage(type, text) {
        state.statusMessage = { type, text };
        if (isDuelViewVisible()) render();
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function shuffleArray(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function formatPlayerName(email) {
        if (!email) return 'Unbekannt';
        const clean = email.toLowerCase().trim();
        if (BOT_PROFILES[clean]) return BOT_PROFILES[clean].name;
        return email;
    }

    function getRecentHumanOpponents() {
        const set = new Set();
        state.matches.forEach(m => {
            const opp = getMyRole(m) === 'p1' ? m.player2_email : m.player1_email;
            if (opp && !isBotEmail(opp) && opp !== state.myEmail) {
                set.add(opp);
            }
        });
        return Array.from(set).slice(0, 5);
    }

    function render() {
        const container = ensureDomStructure();
        if (state.viewMode === 'lobby') {
            container.innerHTML = renderLobbyHTML();
            bindLobbyEvents();
        } else if (state.viewMode === 'match_overview') {
            container.innerHTML = renderMatchOverviewHTML();
            bindMatchOverviewEvents();
        } else if (state.viewMode === 'category_select') {
            container.innerHTML = renderCategorySelectHTML();
            bindCategorySelectEvents();
        } else if (state.viewMode === 'playing_round') {
            container.innerHTML = renderPlayingQuestionHTML();
            bindPlayingQuestionEvents();
        }
    }

    function renderLobbyHTML() {
        const activeMatches = state.matches.filter(m => m.status === 'active');
        const finishedMatches = state.matches.filter(m => m.status === 'finished');
        const recentOpponents = getRecentHumanOpponents();

        return `
            <div class="duel-wrapper">
                <!-- HEADER -->
                <div class="duel-header-card">
                    <div>
                        <div class="duel-title-row">
                            <span class="duel-bolt-badge">⚡</span>
                            <h2>MedCheck Klinik-Duell</h2>
                            <span class="duel-mode-pill">5 Runden • Max. 15 Punkte • 20s Timer</span>
                        </div>
                        <p class="duel-subtitle">
                            Fordere Kommilitonen per E-Mail-Adresse heraus oder trainiere gegen unsere Klinik-Bots. Pro Runde wählt abwechselnd ein Spieler 1 aus 4 Fachkategorien (aus deinen Fällen & Pharma-Sets).
                        </p>
                    </div>
                    <div class="duel-user-identity">
                        <span>${state.isAuthenticated ? '🟢 Cloud-Account aktiv:' : '🟠 Gastmodus (Lokal):'}</span>
                        <strong>${escapeHtml(state.myEmail)}</strong>
                    </div>
                </div>

                ${!state.isAuthenticated ? `
                    <div class="duel-alert error" style="margin-top:0;">
                        ⚠️ <strong>Wichtiger Hinweis für Multiplayer:</strong> Du bist aktuell nicht in der Cloud eingeloggt. Damit dein Gegner deine Spielzüge sieht, melde dich bitte kurz unter <strong>„Einstellungen“</strong> mit deiner E-Mail an!
                    </div>
                ` : ''}

                <!-- FREUNDE SUCHEN & BOT-TRAINING -->
                <div class="duel-search-card">
                    <div class="duel-section-label">🔍 Mit Freunden spielen oder Klinik-Bot herausfordern</div>
                    <div class="duel-search-bar-row" style="flex-wrap:wrap; gap:8px;">
                        <div class="duel-email-input-wrap" style="flex:1; min-width:240px;">
                            <span class="duel-input-icon">✉️</span>
                            <input type="email"
                                   id="duel-friend-email-input"
                                   class="duel-email-input"
                                   placeholder="E-Mail-Adresse deines Freundes eingeben..."
                                   value="${escapeHtml(state.searchQueryEmail)}"
                                   autocomplete="email">
                        </div>
                        <button type="button" id="duel-start-friend-btn" class="duel-btn duel-btn-primary">
                            ⚔️ Freund herausfordern
                        </button>

                        <div style="display:flex; gap:6px; align-items:center;">
                            <select id="duel-bot-select" class="mc-dialog-select" style="padding:9px 10px; border-radius:10px; font-size:0.8rem;">
                                ${Object.values(BOT_PROFILES).map(b => `
                                    <option value="${escapeHtml(b.email)}" ${state.selectedBotEmail === b.email ? 'selected' : ''}>${escapeHtml(b.name)}</option>
                                `).join('')}
                            </select>
                            <button type="button" id="duel-start-bot-btn" class="duel-btn duel-btn-secondary">
                                🤖 Bot-Duell starten
                            </button>
                        </div>
                    </div>

                    ${recentOpponents.length > 0 ? `
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:10px; font-size:0.75rem;">
                            <span style="color:var(--text-muted); font-weight:600;">⚡ Letzte Duell-Partner:</span>
                            ${recentOpponents.map(mail => `
                                <button type="button" class="ghost-tool-btn duel-quick-opp-chip" data-opp-email="${escapeHtml(mail)}" style="padding:3px 9px; font-size:0.73rem;">
                                    ⚔️ ${escapeHtml(mail)}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${state.statusMessage ? `
                        <div class="duel-alert ${state.statusMessage.type}">
                            ${escapeHtml(state.statusMessage.text)}
                        </div>
                    ` : ''}
                </div>

                <!-- LAUFENDE DUELLE -->
                <div class="duel-matches-section">
                    <div class="duel-section-header">
                        <h3>🔥 Laufende Duelle (${activeMatches.length})</h3>
                        <button type="button" class="duel-btn duel-btn-sm" id="duel-refresh-btn">🔄 Jetzt synchronisieren</button>
                    </div>
                    ${activeMatches.length === 0 ? `
                        <div class="duel-empty-box">
                            Noch kein aktives Duell. Gib oben die E-Mail-Adresse eines Freundes ein oder starte eine Runde gegen einen Klinik-Bot!
                        </div>
                    ` : `
                        <div class="duel-matches-grid">
                            ${activeMatches.map(m => renderMatchCardHTML(m)).join('')}
                        </div>
                    `}
                </div>

                <!-- BEENDETE DUELLE -->
                ${finishedMatches.length > 0 ? `
                    <div class="duel-matches-section">
                        <div class="duel-section-header">
                            <h3>🏆 Abgeschlossene Duelle (${finishedMatches.length})</h3>
                        </div>
                        <div class="duel-matches-grid">
                            ${finishedMatches.slice(0, 8).map(m => renderMatchCardHTML(m)).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderMatchCardHTML(match) {
        const myRole = getMyRole(match);
        const myScore = myRole === 'p1' ? match.p1_score : match.p2_score;
        const oppScore = myRole === 'p1' ? match.p2_score : match.p1_score;
        const oppEmail = myRole === 'p1' ? match.player2_email : match.player1_email;
        const isMyTurn = match.status === 'active' && match.turn_email.toLowerCase().trim() === state.myEmail.toLowerCase().trim();

        let statusBadge = '';
        if (match.status === 'finished') {
            if (match.winner_email === 'draw') {
                statusBadge = `<span class="duel-turn-pill draw">🤝 Unentschieden</span>`;
            } else if (match.winner_email?.toLowerCase().trim() === state.myEmail.toLowerCase().trim()) {
                statusBadge = `<span class="duel-turn-pill won">🏆 Gewonnen!</span>`;
            } else {
                statusBadge = `<span class="duel-turn-pill lost">Knapp unterlegen</span>`;
            }
        } else {
            statusBadge = isMyTurn
                ? `<span class="duel-turn-pill my-turn">🟢 Du bist dran (Runde ${match.current_round}/5)</span>`
                : `<span class="duel-turn-pill waiting">⏳ Warte auf Gegner (Runde ${match.current_round}/5)</span>`;
        }

        return `
            <div class="duel-match-card ${isMyTurn ? 'my-turn-card' : ''}" data-match-id="${escapeHtml(match.id)}" style="position:relative;">
                <div class="duel-card-top">
                    <div class="duel-opponent-info">
                        <span class="duel-vs-tag">VS</span>
                        <strong>${escapeHtml(formatPlayerName(oppEmail))}</strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${statusBadge}
                        <button type="button"
                                class="folder-action-btn delete-folder-btn duel-delete-match-btn"
                                data-delete-match-id="${escapeHtml(match.id)}"
                                title="Duell entfernen">🗑️</button>
                    </div>
                </div>
                <div class="duel-card-score-row">
                    <div class="duel-score-box">
                        <span>Du</span>
                        <strong>${myScore}</strong>
                    </div>
                    <div class="duel-score-divider">:</div>
                    <div class="duel-score-box">
                        <span>Gegner</span>
                        <strong>${oppScore}</strong>
                    </div>
                    <div class="duel-max-pts-hint">Max. 15 Pkt.</div>
                </div>
            </div>
        `;
    }

    function renderMatchOverviewHTML() {
        const m = state.activeMatch;
        if (!m) return '';

        const myRole = getMyRole(m);
        const myScore = myRole === 'p1' ? m.p1_score : m.p2_score;
        const oppScore = myRole === 'p1' ? m.p2_score : m.p1_score;
        const oppEmail = myRole === 'p1' ? m.player2_email : m.player1_email;
        const isMyTurn = m.status === 'active' && m.turn_email.toLowerCase().trim() === state.myEmail.toLowerCase().trim();

        const myTotalTime = myRole === 'p1' ? (m.match_state.p1_total_time_sec || 0) : (m.match_state.p2_total_time_sec || 0);
        const oppTotalTime = myRole === 'p1' ? (m.match_state.p2_total_time_sec || 0) : (m.match_state.p1_total_time_sec || 0);

        let rowsHtml = '';
        for (let r = 1; r <= TOTAL_ROUNDS; r++) {
            const rData = m.match_state.rounds[r] || {};
            const myAns = myRole === 'p1' ? rData.p1_answers : rData.p2_answers;
            const oppAns = myRole === 'p1' ? rData.p2_answers : rData.p1_answers;
            const bothPlayed = Array.isArray(myAns) && Array.isArray(oppAns);
            const iPlayedThisRound = Array.isArray(myAns) && myAns.length > 0;
            const isInspected = state.inspectedRoundNum === r;

            rowsHtml += `
                <div class="duel-round-row ${r === m.current_round && m.status === 'active' ? 'active-round-row' : ''}"
                     data-inspect-round="${iPlayedThisRound ? r : ''}"
                     style="${iPlayedThisRound ? 'cursor:pointer;' : ''}"
                     title="${iPlayedThisRound ? 'Klicken, um die 3 Fragen & Erklärungen dieser Runde einzusehen' : ''}">
                    <div class="duel-dots-col">
                        ${renderThreeAnswerDots(myAns, false)}
                    </div>
                    <div class="duel-round-center-info">
                        <span class="duel-round-badge">
                            Runde ${r} / 5 ${iPlayedThisRound ? (isInspected ? '▲ Details' : '▼ Details') : ''}
                        </span>
                        <strong class="duel-round-cat-title">
                            ${rData.chosen_category ? escapeHtml(rData.chosen_category) : 'Kategorie noch offen'}
                        </strong>
                    </div>
                    <div class="duel-dots-col">
                        ${renderThreeAnswerDots(oppAns, !bothPlayed && Array.isArray(oppAns))}
                    </div>
                </div>
                ${isInspected && iPlayedThisRound ? renderRoundInspectorHTML(r, rData, myAns, oppAns, bothPlayed) : ''}
            `;
        }

        // Bei Punktgleichstand am Ende den Reflex-Sieger (schnellere Gesamtzeit) anzeigen
        let drawTiebreakerHint = '';
        if (m.status === 'finished' && m.winner_email === 'draw' && myTotalTime > 0 && oppTotalTime > 0) {
            const fasterMe = myTotalTime < oppTotalTime;
            drawTiebreakerHint = `
                <div style="font-size:0.8rem; color:var(--accent-cyan, #38bdf8); margin-top:4px;">
                    ⚡ <strong>Klinischer Reflex-Tiebreaker:</strong> ${fasterMe ? 'Du warst' : 'Dein Gegner war'} insgesamt schneller (${myTotalTime.toFixed(1)}s vs. ${oppTotalTime.toFixed(1)}s)!
                </div>
            `;
        }

        return `
            <div class="duel-wrapper">
                <div class="duel-nav-top">
                    <button type="button" class="duel-btn duel-btn-secondary" id="duel-back-lobby-btn">← Zurück zur Duell-Lobby</button>
                    <button type="button" class="duel-btn duel-btn-sm" id="duel-sync-match-btn">🔄 Spielstand live abrufen</button>
                </div>

                ${state.statusMessage ? `
                    <div class="duel-alert ${state.statusMessage.type}">
                        ${escapeHtml(state.statusMessage.text)}
                    </div>
                ` : ''}

                <!-- GROSSES SCOREBOARD -->
                <div class="duel-scoreboard-hero">
                    <div class="duel-player-col">
                        <div class="duel-avatar-circle me">🩺</div>
                        <div class="duel-player-name">Du</div>
                        <div class="duel-player-email">${escapeHtml(state.myEmail)}</div>
                        ${myTotalTime > 0 ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:3px;">⏱️ Gesamt: ${myTotalTime.toFixed(1)}s</div>` : ''}
                    </div>

                    <div class="duel-center-score">
                        <div class="duel-big-numbers">
                            <span>${myScore}</span>
                            <span class="duel-colon">:</span>
                            <span>${oppScore}</span>
                        </div>
                        <div class="duel-score-sub">Maximal 15 Punkte (5 Runden)</div>
                        ${drawTiebreakerHint}
                    </div>

                    <div class="duel-player-col">
                        <div class="duel-avatar-circle opp">⚔️</div>
                        <div class="duel-player-name">Gegner</div>
                        <div class="duel-player-email">${escapeHtml(formatPlayerName(oppEmail))}</div>
                        ${oppTotalTime > 0 && m.status === 'finished' ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:3px;">⏱️ Gesamt: ${oppTotalTime.toFixed(1)}s</div>` : ''}
                    </div>
                </div>

                <!-- AKTION-CTA -->
                <div class="duel-action-banner">
                    ${m.status === 'finished' ? `
                        <div class="duel-finished-headline">
                            ${m.winner_email === 'draw'
                                ? '🤝 Unentschieden! Ein starkes Duell auf Augenhöhe.'
                                : (m.winner_email?.toLowerCase().trim() === state.myEmail.toLowerCase().trim()
                                    ? '🏆 Sieg! Du hast dieses Klinik-Duell gewonnen!'
                                    : '⚔️ Duell beendet – fordere deinen Gegner direkt zur Revanche heraus!')}
                        </div>
                        <button type="button" class="duel-btn duel-btn-primary" id="duel-rematch-btn">
                            🔄 Sofort Revanche starten
                        </button>
                    ` : (isMyTurn ? `
                        <button type="button" class="duel-btn duel-btn-primary duel-btn-large" id="duel-play-round-btn">
                            ▶️ Jetzt Runde ${m.current_round} spielen!
                        </button>
                    ` : `
                        <div class="duel-waiting-notice">
                            ⏳ <strong>${escapeHtml(formatPlayerName(oppEmail))}</strong> ist gerade am Zug (Runde ${m.current_round}).<br>
                            <small style="color:#94a3b8;">Klicke unten auf bereits gespielte Runden, um die Fragen & Erklärungen zu wiederholen.</small>
                        </div>
                    `)}
                </div>

                <!-- 5 RUNDEN ÜBERSICHT (KLICKBAR FÜR FRAGEN-REVIEW) -->
                <div class="duel-rounds-list">
                    ${rowsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Rendert die aufklappbare Nachbesprechung für eine abgeschlossene Runde
     */
    function renderRoundInspectorHTML(roundNum, rData, myAns, oppAns, bothPlayed) {
        const questions = rData.questions || [];
        if (questions.length === 0) return '';

        return `
            <div class="duel-round-inspector" style="padding:14px 16px; margin:-4px 0 8px 0; border-radius:12px; background:var(--surface-secondary, rgba(15,23,42,0.55)); border:1px solid var(--card-border); display:flex; flex-direction:column; gap:12px;">
                <div style="font-size:0.76rem; font-weight:800; color:var(--accent-cyan, #38bdf8); text-transform:uppercase; letter-spacing:0.05em;">
                    🔍 Runden-Nachbesprechung · Runde ${roundNum}: ${escapeHtml(rData.chosen_category || '')}
                </div>
                ${questions.map((q, qIdx) => {
                    const myA = myAns?.[qIdx];
                    const oppA = oppAns?.[qIdx];
                    const correctText = q.options?.[q.correct_index] || '';
                    const myChoiceText = (myA && myA.selectedIdx >= 0) ? q.options?.[myA.selectedIdx] : '⏰ Zeit abgelaufen';
                    const oppChoiceText = bothPlayed
                        ? ((oppA && oppA.selectedIdx >= 0) ? q.options?.[oppA.selectedIdx] : '⏰ Zeit abgelaufen')
                        : '⏳ Noch geheim (Gegner spielt noch)';

                    return `
                        <div style="padding:12px; border-radius:10px; background:var(--surface-primary, rgba(6,9,19,0.65)); border:1px solid var(--card-border);">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
                                <strong style="font-size:0.85rem; color:var(--text-main); line-height:1.45;">
                                    ${qIdx + 1}. ${escapeHtml(q.question)}
                                </strong>
                                <button type="button"
                                        class="ghost-tool-btn duel-inspector-depot-btn"
                                        data-r="${roundNum}"
                                        data-q="${qIdx}"
                                        style="font-size:0.7rem; padding:3px 8px; flex-shrink:0;">
                                    📌 Depot
                                </button>
                            </div>
                            <div style="font-size:0.78rem; color:#4ade80; font-weight:700; margin-bottom:4px;">
                                ✓ Richtige Antwort: ${escapeHtml(correctText)}
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:12px; font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">
                                <span>🩺 <strong>Du (${myA?.timeSec ?? 20}s):</strong> <span style="color:${myA?.isCorrect ? '#4ade80' : '#f87171'};">${escapeHtml(myChoiceText)}</span></span>
                                <span>⚔️ <strong>Gegner ${bothPlayed && oppA ? '(' + oppA.timeSec + 's)' : ''}:</strong> <span style="color:${!bothPlayed ? 'var(--text-dim)' : (oppA?.isCorrect ? '#4ade80' : '#f87171')};">${escapeHtml(oppChoiceText)}</span></span>
                            </div>
                            <div style="font-size:0.78rem; color:var(--text-muted); line-height:1.5; border-top:1px dashed var(--card-border); padding-top:6px;">
                                💡 ${escapeHtml(cleanMedicalExplanation(q.explanation))}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderThreeAnswerDots(answersArray, maskSecret) {
        if (!Array.isArray(answersArray)) {
            return `
                <span class="duel-dot empty"></span>
                <span class="duel-dot empty"></span>
                <span class="duel-dot empty"></span>
            `;
        }
        return [0, 1, 2].map(idx => {
            const ans = answersArray[idx];
            if (!ans) return `<span class="duel-dot empty"></span>`;
            if (maskSecret) return `<span class="duel-dot masked" title="Gegner hat diese Frage bereits beantwortet">?</span>`;
            return ans.isCorrect
                ? `<span class="duel-dot hit" title="Richtig (${ans.timeSec}s)">✓</span>`
                : `<span class="duel-dot miss" title="Falsch / Zeit abgelaufen">✕</span>`;
        }).join('');
    }

    function renderCategorySelectHTML() {
        const m = state.activeMatch;
        const rNum = m.current_round;
        const options = m.match_state.rounds[rNum]?.category_options || getRandomCategoryChoices();

        return `
            <div class="duel-wrapper">
                <div class="duel-nav-top">
                    <button type="button" class="duel-btn duel-btn-secondary" id="duel-cancel-cat-btn">← Zurück zum Spielstand</button>
                </div>
                <div class="duel-cat-select-card">
                    <div class="duel-round-pill-large">Runde ${rNum} von 5</div>
                    <h2>Wähle die Fachkategorie für diese Runde</h2>
                    <p>Du und dein Gegner beantwortet jeweils dieselben <strong>3 Fragen</strong> aus dem gewählten Thema (20 Sekunden pro Frage).</p>

                    <div class="duel-cat-grid-4">
                        ${options.map(cat => `
                            <button type="button" class="duel-cat-choice-btn" data-cat="${escapeHtml(cat)}">
                                <span class="duel-cat-icon">📚</span>
                                <span class="duel-cat-name">${escapeHtml(cat)}</span>
                                <span class="duel-cat-cta">3 Fragen starten ➔</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderPlayingQuestionHTML() {
        const q = state.activeQuestions[state.activeQuestionIdx];
        if (!q) return '';

        return `
            <div class="duel-arena-wrapper">
                <!-- OBEN MITTIG: DER 20-SEKUNDEN COUNTDOWN-BANNER -->
                <div class="duel-timer-top-banner" id="duel-timer-top-banner">
                    <div class="duel-timer-meta-row">
                        <span class="duel-arena-round-tag">Runde ${state.activeRoundNum}/5 • Frage ${state.activeQuestionIdx + 1}/3</span>
                        <span class="duel-arena-cat-tag">${escapeHtml(q.category)}</span>
                        <span class="duel-timer-clock">⏱️ <strong id="duel-timer-seconds-text">20.0s</strong></span>
                    </div>
                    <div class="duel-timer-bar-track">
                        <div class="duel-timer-bar-fill" id="duel-timer-bar-fill" style="width: 100%;"></div>
                    </div>
                </div>

                <!-- FRAGEN-KARTE -->
                <div class="duel-question-card">
                    <div class="duel-question-stem">${escapeHtml(q.question)}</div>

                    <div class="duel-options-grid">
                        ${q.options.map((optText, idx) => `
                            <button type="button" class="duel-opt-btn" data-opt-idx="${idx}" title="Tastatur: ${idx + 1} oder ${String.fromCharCode(65 + idx)}">
                                <span class="duel-opt-letter">${String.fromCharCode(65 + idx)}</span>
                                <span class="duel-opt-text">${escapeHtml(optText)}</span>
                            </button>
                        `).join('')}
                    </div>

                    <div id="duel-instant-feedback" class="duel-instant-feedback" style="display: none;"></div>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // 7. EVENT-LISTENERS BINDEN
    // ========================================================================

    function bindLobbyEvents() {
        const emailInput = document.getElementById('duel-friend-email-input');
        emailInput?.addEventListener('input', e => {
            state.searchQueryEmail = e.target.value;
        });

        emailInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createNewDuel(emailInput.value);
            }
        });

        document.getElementById('duel-start-friend-btn')?.addEventListener('click', () => {
            createNewDuel(emailInput?.value || state.searchQueryEmail);
        });

        const botSelect = document.getElementById('duel-bot-select');
        botSelect?.addEventListener('change', (e) => {
            state.selectedBotEmail = e.target.value;
        });

        document.getElementById('duel-start-bot-btn')?.addEventListener('click', () => {
            const chosenBot = botSelect?.value || state.selectedBotEmail || DEFAULT_BOT_EMAIL;
            createNewDuel(chosenBot);
        });

        document.querySelectorAll('.duel-quick-opp-chip[data-opp-email]').forEach(chip => {
            chip.addEventListener('click', () => {
                const mail = chip.getAttribute('data-opp-email');
                if (mail) createNewDuel(mail);
            });
        });

        document.getElementById('duel-refresh-btn')?.addEventListener('click', async () => {
            await loadMatches();
            render();
        });

        document.querySelectorAll('.duel-delete-match-btn[data-delete-match-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mId = btn.getAttribute('data-delete-match-id');
                deleteMatchById(mId);
            });
        });

        document.querySelectorAll('.duel-match-card[data-match-id]').forEach(card => {
            card.addEventListener('click', () => {
                const mId = card.getAttribute('data-match-id');
                const found = state.matches.find(m => m.id === mId);
                if (found) {
                    state.activeMatch = found;
                    state.statusMessage = null;
                    state.inspectedRoundNum = null;
                    state.viewMode = 'match_overview';
                    render();
                }
            });
        });
    }

    function bindMatchOverviewEvents() {
        document.getElementById('duel-back-lobby-btn')?.addEventListener('click', async () => {
            state.statusMessage = null;
            state.inspectedRoundNum = null;
            await loadMatches();
            state.viewMode = 'lobby';
            render();
        });

        document.getElementById('duel-sync-match-btn')?.addEventListener('click', async () => {
            await loadMatches();
            render();
        });

        document.getElementById('duel-play-round-btn')?.addEventListener('click', () => {
            startTurnAction();
        });

        document.getElementById('duel-rematch-btn')?.addEventListener('click', () => {
            if (!state.activeMatch) return;
            const myRole = getMyRole(state.activeMatch);
            const oppEmail = myRole === 'p1' ? state.activeMatch.player2_email : state.activeMatch.player1_email;
            createNewDuel(oppEmail);
        });

        // Klick auf gespielte Runden öffnet/schließt den Runden-Inspektor
        document.querySelectorAll('.duel-round-row[data-inspect-round]').forEach(row => {
            const rVal = row.getAttribute('data-inspect-round');
            if (!rVal) return;
            row.addEventListener('click', () => {
                const rNum = Number(rVal);
                state.inspectedRoundNum = (state.inspectedRoundNum === rNum) ? null : rNum;
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
                render();
            });
        });

        // Depot-Speicher-Buttons innerhalb des Runden-Inspektors
        document.querySelectorAll('.duel-inspector-depot-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rNum = Number(btn.getAttribute('data-r'));
                const qIdx = Number(btn.getAttribute('data-q'));
                const qObj = state.activeMatch?.match_state?.rounds?.[rNum]?.questions?.[qIdx];
                if (qObj) saveQuestionToDepot(qObj, btn);
            });
        });
    }

    function bindCategorySelectEvents() {
        document.getElementById('duel-cancel-cat-btn')?.addEventListener('click', () => {
            state.viewMode = 'match_overview';
            render();
        });

        document.querySelectorAll('.duel-cat-choice-btn[data-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosen = btn.getAttribute('data-cat');
                selectCategoryForRound(chosen);
            });
        });
    }

    function bindPlayingQuestionEvents() {
        document.querySelectorAll('.duel-opt-btn[data-opt-idx]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-opt-idx'));
                handleAnswerSubmission(idx, false);
            });
        });
    }

    window.DuelModule = {
        init,
        openView
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
