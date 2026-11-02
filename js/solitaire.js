/* ==========================================================================
   MEDCHECK – SOLITAIRE ASSOCIATIONS JOURNEY MODULE (js/solitaire.js)
   ==========================================================================
   FEATURES:
   01. Original Solitaire Associations Journey Mechanik (Hitapps-Style)
   02. Kategorienkarten (Krankheitsbilder) & Begriffskarten (Klinik, Patho, Diagnostik, Therapie)
   03. Tableau Pre-Stacking (Gleichnamige Krankheitsbegriffe im Tableau vorab bündeln)
   04. Smart Anti-Deadlock Deal-Algorithmus (Garantiert lösbare Starthand)
   05. Dual-Control: Drag & Drop + Click-to-Move + Doppelklick-Auto-Play
   06. Power-Ups: Undo (Snapshot-Stack), Hint, Joker & Staatsexamen-Hard-Mode
   07. Inspect-Modal mit Pathophysiologie-Erklärungen & 1-Klick Lern-Depot-Pin
   08. Deck-Manager: JSON File-Dropzone, Copy/Paste-Import, Auto-Case-Converter & Skill-Schema
   ========================================================================== */

const SolitaireModule = (() => {
    const STORAGE_DECKS_KEY = 'medcheck_solitaire_custom_decks_v1';
    const STORAGE_STATS_KEY = 'medcheck_solitaire_stats_v1';

    // ----------------------------------------------------------------------
    // 01. INTEGRIERTE STAATSEXAMENS-DEMODECKS (SOFORT SPIELBAR)
    // ----------------------------------------------------------------------
    const BUILTIN_DECKS = [
        {
            deck_id: 'builtin_ddx_neuro_degen_01',
            title: 'DDx: Atypische Parkinson-Syndrome & Demenzen',
            medical_field: 'Neurologie',
            difficulty: 'Staatsexamen',
            description: 'Differentialdiagnostische Abgrenzung von PSP, MSA, Lewy-Body-Demenz und Morbus Parkinson anhand Klinik, MRT-Zeichen und Neuropathologie.',
            is_builtin: true,
            diseases: [
                {
                    disease_id: 'psp',
                    name: 'Progressive supranukleäre Blickparese (PSP)',
                    icd10: 'G23.1',
                    color_accent: '#38bdf8',
                    clinical_pearl: '4R-Tauopathie mit charakteristischer Mittelhirnatrophie, vertikaler Blickparese und früher posturaler Instabilität.',
                    cards: [
                        { term: 'Vertikale Blickparese (v.a. nach unten)', category: 'Klinik', explanation: 'Schädigung des rostralen interstitiellen Kerns des Fasciculus longitudinalis medialis (riMLF) im Mittelhirn.' },
                        { term: 'Hummingbird-Sign (Kolibri-Zeichen)', category: 'Diagnostik', explanation: 'Atrophie des Mesencephalons bei erhaltenem Pons im mediosagittalen T1-MRT.' },
                        { term: '4-Repeat-Tau (Tufted Astrocytes)', category: 'Pathophysiologie', explanation: 'Pathognomonische neuropathologische Ablagerung von 4R-Tau-Isoformen in Astrozyten.' },
                        { term: 'Frühe ungebremste Stürze nach hinten', category: 'Klinik', explanation: 'Ausgeprägte posturale Instabilität bereits im 1. Krankheitsjahr (Red Flag gegen idiopathischen M. Parkinson).' },
                        { term: 'Mickey-Mouse-Sign im axialen MRT', category: 'Diagnostik', explanation: 'Verschmächtigung des anteroposterioren Mittelhirndurchmessers mit Einziehung der Hirnschenkel.' },
                        { term: 'Kaum / kein Ansprechen auf L-Dopa', category: 'Therapie', explanation: 'Durch den Verlust postsynaptischer striataler Dopaminrezeptoren bleibt die L-Dopa-Response meist aus.' }
                    ]
                },
                {
                    disease_id: 'msa',
                    name: 'Multisystematrophie (MSA-P / MSA-C)',
                    icd10: 'G90.3',
                    color_accent: '#a855f7',
                    clinical_pearl: 'Alpha-Synukleinopathie mit schwerer früher autonomer Dysfunktion sowie parkinsonoidem (MSA-P) oder zerebellärem (MSA-C) Phänotyp.',
                    cards: [
                        { term: 'Hot-Cross-Bun-Zeichen im Pons', category: 'Diagnostik', explanation: 'Kreuzförmige T2-Hyperintensität in der Brücke durch Degeneration pontozerebellärer Fasern.' },
                        { term: 'Gliale zytoplasmatische Einschlüsse (Papp-Lantos)', category: 'Pathophysiologie', explanation: 'Alpha-Synuklein-Aggregate primär in Oligodendrozyten statt nur in Neuronen.' },
                        { term: 'Frühe schwere orthostatische Hypotonie & Harninkontinenz', category: 'Klinik', explanation: 'Ausgeprägte autonome Beteiligung (Degeneration des Nucleus intermediolateralis und Onuf-Kerns).' },
                        { term: 'Inspiratorischer Larynxstridor (nächtlich)', category: 'Klinik', explanation: 'Gefährliche Stimmbandabduktionsparese mit Risiko des plötzlichen nächtlichen Herztodes.' },
                        { term: 'Putaminale Randatrophie (Hyperintenser Randsaum)', category: 'Diagnostik', explanation: 'Typisches MRT-Korrelat der striatonigralen Degeneration beim MSA-P-Subtyp.' },
                        { term: 'Fludrocortison / Midodrin gegen Orthostase', category: 'Therapie', explanation: 'Symptomatische Volumensubstitution und Vasokonstriktion bei neurogener orthostatischer Hypotonie.' }
                    ]
                },
                {
                    disease_id: 'lbd',
                    name: 'Lewy-Körperchen-Demenz (LBD)',
                    icd10: 'G31.82',
                    color_accent: '#10b981',
                    clinical_pearl: 'Synukleinopathie mit der 1-Jahres-Regel (Demenz vor oder gleichzeitig mit Parkinsonismus), optischen Halluzinationen und extremer Neuroleptika-Sensitivität.',
                    cards: [
                        { term: 'Szenische optische Halluzinationen', category: 'Klinik', explanation: 'Detaillierte visuelle Trugwahrnehmungen (oft Menschen/Tiere) schon im Frühstadium.' },
                        { term: 'Ausgeprägte Fluktuationen der Kognition & Vigilanz', category: 'Klinik', explanation: 'Starke Tagesschwankungen zwischen fast klaren Phasen und schwerer Verwirrtheit.' },
                        { term: 'Schwere paradoxe Neuroleptika-Überempfindlichkeit', category: 'Therapie', explanation: 'Klassische D2-Antagonisten (z.B. Haloperidol) können lebensbedrohliche Rigor-Krisen und MNS auslösen!' },
                        { term: 'REM-Schlaf-Verhaltensstörung (RBD)', category: 'Klinik', explanation: 'Fehlende Muskelatonie im REM-Schlaf mit Ausagieren von Träumen (oft Jahre vor Demenzbeginn).' },
                        { term: 'Relativer Erhalt des medialen Temporallappens im MRT', category: 'Diagnostik', explanation: 'Wichtige Abgrenzung zum M. Alzheimer, der früh eine Hippocampusatrophie zeigt.' },
                        { term: 'Rivastigmin (Acetylcholinesterase-Hemmer)', category: 'Therapie', explanation: 'Bessert durch das ausgeprägte cholinerge Defizit sowohl Kognition als auch visuelle Halluzinationen.' }
                    ]
                },
                {
                    disease_id: 'cbd',
                    name: 'Kortikobasale Degeneration (CBD)',
                    icd10: 'G31.8',
                    color_accent: '#f59e0b',
                    clinical_pearl: 'Stark asymmetrische 4R-Tauopathie mit Kombination aus basalganglionären und kortikalen Funktionsstörungen.',
                    cards: [
                        { term: 'Alien-Limb-Phänomen (Fremde-Hand-Syndrom)', category: 'Klinik', explanation: 'Unwillkürliche, zweckgebunden wirkende Bewegungen einer Extremität, die als fremd erlebt wird.' },
                        { term: 'Stark asymmetrische Gliedmaßen-Apraxie & Dystonie', category: 'Klinik', explanation: 'Einseitiger Beginn mit Verlust erlernter Bewegungsabläufe trotz intakter Motorik.' },
                        { term: 'Astereognosie & kortikale Sensibilitätsstörung', category: 'Klinik', explanation: 'Unfähigkeit, Gegenstände durch Tasten zu erkennen, durch Beteiligung des parietalen Kortex.' },
                        { term: 'Asymmetrische frontoparietale Kortexatrophie', category: 'Diagnostik', explanation: 'Im MRT kontralateral zur klinisch stärker betroffenen Körperseite betont.' },
                        { term: 'Astrocytic Plaques & Ballonierte Neurone', category: 'Pathophysiologie', explanation: 'Histopathologisches Korrelat der 4R-Tau-Pathologie im Kortex und Striatum.' },
                        { term: 'Kortikaler aktionsinduzierter Myoklonus', category: 'Klinik', explanation: 'Stimulus-sensitives Muskelzucken der betroffenen Extremität.' }
                    ]
                }
            ]
        },
        {
            deck_id: 'builtin_ddx_myelopathy_02',
            title: 'DDx: Akute & subakute Myelopathien',
            medical_field: 'Neurologie / Notfallmedizin',
            difficulty: 'Staatsexamen',
            description: 'Triage und Differenzierung vaskulärer, autoimmun-entzündlicher und metabolischer Rückenmarksläsionen.',
            is_builtin: true,
            diseases: [
                {
                    disease_id: 'asa_syndrom',
                    name: 'Arteria-spinalis-anterior-Syndrom',
                    icd10: 'G95.1',
                    color_accent: '#ef4444',
                    clinical_pearl: 'Ischämie der ventralen 2/3 des Myelons mit dissoziierter Sensibilitätsstörung bei erhaltenem Hinterstrang.',
                    cards: [
                        { term: 'Dissoziierte Sensibilitätsstörung (Schmerz/Temp ↓, Lagesinn intakt)', category: 'Klinik', explanation: 'Tractus spinothalamicus betroffen, während Hinterstränge über Aa. spinales posteriores versorgt bleiben.' },
                        { term: 'Eulenaugen-Zeichen (Snake-Eyes) im axialen T2-MRT', category: 'Diagnostik', explanation: 'Bilaterale Hyperintensität der metabolisch vulnerablen Vorderhörner.' },
                        { term: 'Aortendissektion / Verlegung der A. radicularis magna (Adamkiewicz)', category: 'Pathophysiologie', explanation: 'Häufigste vaskuläre Ursache durch Unterbrechung des wichtigsten thorakolumbalen Zuflusses.' },
                        { term: 'Perakuter gürtelförmiger Rückenschmerz & schlaffe Paraparese', category: 'Klinik', explanation: 'Schlagartiger Beginn mit initialem spinalem Schock (Areflexie vor Übergang in Spastik).' },
                        { term: 'Sofortiges Angio-CT Thorax/Abdomen', category: 'Diagnostik', explanation: 'Notfallmäßiger Ausschluss einer zugrundeliegenden Aortendissektion vor jeder Lyse-Überlegung.' }
                    ]
                },
                {
                    disease_id: 'nmosd',
                    name: 'NMOSD (Neuromyelitis-optica-Spektrum)',
                    icd10: 'G36.0',
                    color_accent: '#38bdf8',
                    clinical_pearl: 'Primäre Autoimmun-Astrozytopathie (AQP4-IgG) mit langstreckiger Myelitis und schwerer Optikusneuritis.',
                    cards: [
                        { term: 'LETM (Myelonläsion über ≥ 3 Wirbelsegmente)', category: 'Diagnostik', explanation: 'Longitudinale extensive transversale Myelitis zentral im Myelon gelegen.' },
                        { term: 'Anti-Aquaporin-4-Antikörper (AQP4-IgG) im Serum', category: 'Diagnostik', explanation: 'Hochspezifischer Autoantikörper gegen Wasserkanäle auf Astrozyten-Endfüßchen.' },
                        { term: 'CAVE: Interferon-beta & Natalizumab verschlechtern Schübe!', category: 'Therapie', explanation: 'Klassische MS-Medikamente triggern bei NMOSD schwere Exazerbationen und sind kontraindiziert.' },
                        { term: 'Area-postrema-Syndrom (unstillbarer Singultus & Erbrechen)', category: 'Klinik', explanation: 'Klassische Hirnstammmanifestation am Boden des 4. Ventrikels (AQP4-reiche Zone).' },
                        { term: 'Neutrophile/eosinophile Pleozytose meist OHNE oligoklonale Banden', category: 'Diagnostik', explanation: 'Wichtiger Liquorbefund zur Abgrenzung gegen die klassische Multiple Sklerose.' }
                    ]
                },
                {
                    disease_id: 'funikulaere_myelose',
                    name: 'Funikuläre Myelose (Vitamin-B12-Mangel)',
                    icd10: 'E53.8',
                    color_accent: '#10b981',
                    clinical_pearl: 'Subakute kombinierte Degeneration der Hinterstränge und Pyramidenbahnen durch Cobalaminmangel oder Lachgas-Abusus.',
                    cards: [
                        { term: 'Umgekehrtes V-Zeichen (Inverted V-Sign) dorsal im MRT', category: 'Diagnostik', explanation: 'Symmetrische T2-Hyperintensität der Hinterstränge (Fasciculus gracilis und cuneatus).' },
                        { term: 'Lachgas-Inhalation (N2O) oxidiert Cobalt-Ion im Vitamin B12', category: 'Pathophysiologie', explanation: 'Führt zu akutem funktionellem B12-Mangel bei oft noch normwertigem Gesamt-Serum-B12.' },
                        { term: 'Methylmalonsäure (MMA) & Homocystein sensitiv erhöht', category: 'Diagnostik', explanation: 'Früheste metabolische Marker eines intrazellulären funktionellen Cobalaminmangels.' },
                        { term: 'Spinale Ataxie + Pyramidenbahnzeichen bei erloschenem ASR', category: 'Klinik', explanation: 'Kombination aus Hinterstrangataxie, spastischer Parese und peripherer Polyneuropathie.' },
                        { term: 'Hochdosierte parenterale Hydroxocobalamin-Substitution', category: 'Therapie', explanation: 'Muss sofort erfolgen, bevor Folsäure gegeben wird (sonst droht Verschlechterung der Neurologie).' }
                    ]
                }
            ]
        }
    ];

    // ----------------------------------------------------------------------
    // 02. JSON-PROMPT FÜR DEINEN EXTRACTION-SKILL
    // ----------------------------------------------------------------------
    const SKILL_EXTRACTION_PROMPT = `# ROLLE & AUFGABE
Du bist ein medizinischer Facharzt und Didaktik-Architekt für den Spielmodus "Solitaire Associations Journey" in MedCheck.
Extrahiere aus dem bereitgestellten medizinischen Fachtext / Vorlesungsskript ALLE relevanten Krankheitsbilder (Entitäten) und ihre zugehörigen klinischen Fakten zu 100 % vollständig in ein valides JSON-Kartendeck.

# REGELN FÜR OPTIMALE SPIELBARKEIT & DIFFERENTIALDIAGNOSE
1. Antworte AUSSCHLIESSLICH mit validem JSON (Erstes Zeichen {, letztes Zeichen }).
2. Jedes Krankheitsbild wird ein Objekt im Array "diseases" (mindestens 3 bis 8 Krankheitsbilder pro Deck).
3. Jedes Krankheitsbild enthält 5 bis 8 präzise Begriffskarten im Array "cards".
4. "term" auf der Karte: Prägnanter klinischer Begriff, Befund, Zeichen, Gen/Antikörper oder Wirkstoff (ideal 2 bis 9 Wörter, max. 65 Zeichen), sodass man beim Lesen sofort differentialdiagnostisch kombinieren muss.
5. "category": Wähle exakt eine aus: "Pathophysiologie", "Klinik", "Diagnostik", "Therapie", "Komplikation".
6. "explanation": 1 bis 2 prägnante Sätze auf Staatsexamensniveau, WARUM dieser Begriff pathophysiologisch oder klinisch zu dieser Krankheit gehört.

# JSON-SCHEMA
{
  "deck_id": "eindeutige_id_mit_unterstrichen",
  "title": "Prägnanter Titel des DDx-Decks",
  "medical_field": "Fachgebiet (z.B. Neurologie, Innere Medizin, Hämatologie)",
  "difficulty": "Staatsexamen",
  "description": "Kurze Beschreibung des differentialdiagnostischen Fokus.",
  "diseases": [
    {
      "disease_id": "kurze_id",
      "name": "Exakter Name des Krankheitsbildes",
      "icd10": "ICD-10 Code",
      "color_accent": "#38bdf8",
      "clinical_pearl": "Klinische Kernaussage (1-2 Sätze) zur Gesamtsynthese.",
      "cards": [
        {
          "term": "Prägnanter Begriff / Befund / Zeichen",
          "category": "Diagnostik",
          "explanation": "Exakte pathophysiologische oder klinische Begründung."
        }
      ]
    }
  ]
}`;

    // ----------------------------------------------------------------------
    // 03. RUNTIME STATE DES SPIELS
    // ----------------------------------------------------------------------
    let currentViewMode = 'lobby'; // 'lobby' | 'game'
    let activeDeck = null;
    let hardMode = false; // Blendet Kategorie-Badges auf den Karten aus

    let gameState = {
        movesLeft: 0,
        maxMoves: 0,
        score: 0,
        hintsLeft: 3,
        jokersLeft: 2,
        foundations: [null, null, null, null], // 4 Ziel-Slots oben
        completedDiseases: [], // Vollständig gelöste Krankheitsbilder
        tableau: [[], [], [], []], // 4 Spalten
        stock: [], // Verdeckter Nachziehstapel
        waste: [], // Offener Ablagestapel
        selectedSource: null, // { zone: 'waste'|'tableau', colIdx, cardIdx }
        hintHighlightIds: [],
        historyStack: [] // Für Undo-Funktion
    };

    const CATEGORY_COLORS = {
        'Pathophysiologie': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', label: 'Patho' },
        'Klinik':           { color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', label: 'Klinik' },
        'Diagnostik':       { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.14)', label: 'Diagnostik' },
        'Therapie':         { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)', label: 'Therapie' },
        'Komplikation':     { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', label: 'Komplikation' }
    };

    const ACCENT_PALETTE = ['#38bdf8', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

    // ----------------------------------------------------------------------
    // 04. PERSISTENZ & DECK-VERWALTUNG
    // ----------------------------------------------------------------------
    function getCustomDecks() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_DECKS_KEY) || '[]');
        } catch (_e) {
            return [];
        }
    }

    function saveCustomDecks(decks) {
        try {
            localStorage.setItem(STORAGE_DECKS_KEY, JSON.stringify(decks));
        } catch (e) {
            console.error('Fehler beim Speichern der Solitaire-Decks:', e);
        }
    }

    function getAllDecks() {
        const custom = getCustomDecks();
        const customIds = new Set(custom.map(d => d.deck_id));
        const builtins = BUILTIN_DECKS.filter(d => !customIds.has(d.deck_id));
        return [...custom, ...builtins];
    }

    function getDeckStats() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_STATS_KEY) || '{}');
        } catch (_e) {
            return {};
        }
    }

    function recordDeckWin(deckId, movesRemaining, score) {
        const stats = getDeckStats();
        const prev = stats[deckId] || { wins: 0, bestScore: 0, bestMovesLeft: 0 };
        stats[deckId] = {
            wins: prev.wins + 1,
            bestScore: Math.max(prev.bestScore, score),
            bestMovesLeft: Math.max(prev.bestMovesLeft, movesRemaining),
            lastPlayed: Date.now()
        };
        try {
            localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
        } catch (_e) {}
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, tag => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag
        ));
    }

    // ----------------------------------------------------------------------
    // 05. AUTO-GENERATOR AUS VORHANDENEN APP-FÄLLEN
    // ----------------------------------------------------------------------
    function generateDecksFromExistingCases() {
        const registeredCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        if (!registeredCases.length) {
            showToast('Keine Fälle zum Konvertieren gefunden.', 'error');
            return;
        }

        const diseasesMap = new Map();

        registeredCases.forEach(c => {
            const tasks = c.extra_tasks || {};
            const field = c.folder_name || c.metadata?.medical_field || 'Allgemein';

            // 1. Aus Synapsen-Matrix extrahieren
            if (tasks.synapses_matrix && Array.isArray(tasks.synapses_matrix.variables)) {
                const groups = Array.isArray(tasks.synapses_matrix.groups) ? tasks.synapses_matrix.groups : [];
                tasks.synapses_matrix.variables.forEach(v => {
                    if (!v.disease || !v.term) return;
                    const dName = v.disease.trim();
                    if (!diseasesMap.has(dName)) {
                        const grp = groups.find(g => g.title === dName);
                        diseasesMap.set(dName, {
                            disease_id: 'auto_' + dName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24),
                            name: dName,
                            field: field,
                            clinical_pearl: grp?.explanation || `Klinisches Syndrom aus Fall „${c.metadata?.title || c.case_id}“.`,
                            cards: []
                        });
                    }
                    const entry = diseasesMap.get(dName);
                    const catMap = {
                        'Risikofaktor/Pathophysiologie': 'Pathophysiologie',
                        'Symptom': 'Klinik',
                        'Diagnostik': 'Diagnostik',
                        'Therapie': 'Therapie'
                    };
                    if (!entry.cards.some(card => card.term.toLowerCase() === v.term.trim().toLowerCase())) {
                        entry.cards.push({
                            term: v.term.trim(),
                            category: catMap[v.type] || 'Klinik',
                            explanation: `${v.type || 'Klinischer Aspekt'} bei ${dName}.`
                        });
                    }
                });
            }

            // 2. Aus Taxonomie (Categorization) ergänzen
            if (tasks.categorization && Array.isArray(tasks.categorization.items)) {
                tasks.categorization.items.forEach(item => {
                    if (!item.category || !item.term) return;
                    const dName = item.category.trim();
                    if (!diseasesMap.has(dName)) {
                        diseasesMap.set(dName, {
                            disease_id: 'auto_' + dName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24),
                            name: dName,
                            field: field,
                            clinical_pearl: tasks.categorization.hint || `Differentialdiagnose aus „${c.metadata?.title || c.case_id}“.`,
                            cards: []
                        });
                    }
                    const entry = diseasesMap.get(dName);
                    if (!entry.cards.some(card => card.term.toLowerCase() === item.term.trim().toLowerCase())) {
                        entry.cards.push({
                            term: item.term.trim(),
                            category: 'Klinik',
                            explanation: `Charakteristischer Befund / Manöver für ${dName}.`
                        });
                    }
                });
            }
        });

        // Nur Krankheitsbilder mit mindestens 4 Begriffskarten übernehmen
        const validDiseases = Array.from(diseasesMap.values())
            .filter(d => d.cards.length >= 4)
            .map((d, idx) => ({
                disease_id: d.disease_id + '_' + idx,
                name: d.name,
                icd10: 'DDx',
                color_accent: ACCENT_PALETTE[idx % ACCENT_PALETTE.length],
                clinical_pearl: d.clinical_pearl,
                cards: d.cards.slice(0, 7)
            }));

        if (validDiseases.length < 2) {
            showToast('Noch nicht genügend Falldaten (mind. 2 Krankheiten mit je ≥4 Begriffen) vorhanden.', 'error');
            return;
        }

        const generatedDeck = {
            deck_id: 'auto_cases_deck_' + Date.now(),
            title: `App-Synthese: ${validDiseases.length} Krankheitsbilder im Direktvergleich`,
            medical_field: 'Interdisziplinär (Aus deinen Fällen)',
            difficulty: 'Staatsexamen',
            description: `Automatisch generiert aus deinen geladenen MedCheck-Fällen (${validDiseases.map(d => d.name).slice(0, 4).join(', ')} u.a.).`,
            diseases: validDiseases.slice(0, 6)
        };

        const customDecks = getCustomDecks();
        customDecks.unshift(generatedDeck);
        saveCustomDecks(customDecks);

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
        showToast(`Deck mit ${generatedDeck.diseases.length} Krankheitsbildern erfolgreich generiert!`, 'positive');
        renderView();
    }

    // ----------------------------------------------------------------------
    // 06. SMART ANTI-DEADLOCK DEAL-ALGORITHMUS & SPIELSTART
    // ----------------------------------------------------------------------
    function shuffleArray(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function startNewGame(deckId) {
        const allDecks = getAllDecks();
        const found = allDecks.find(d => d.deck_id === deckId) || allDecks[0];
        if (!found) return;

        activeDeck = JSON.parse(JSON.stringify(found));
        currentViewMode = 'game';

        // 1. Alle Karten erzeugen (1 Kategorienkarte + N Begriffskarten pro Krankheit)
        const categoryCards = [];
        const termCards = [];

        activeDeck.diseases.forEach((disease, dIdx) => {
            const dId = disease.disease_id || `dis_${dIdx}`;
            const accent = disease.color_accent || ACCENT_PALETTE[dIdx % ACCENT_PALETTE.length];
            const totalTerms = (disease.cards || []).length;

            // Parent Card (Krankheitsbild)
            categoryCards.push({
                uid: `cat_${dId}`,
                isCategoryCard: true,
                diseaseId: dId,
                diseaseName: disease.name,
                icd10: disease.icd10 || '',
                accent: accent,
                clinicalPearl: disease.clinical_pearl || '',
                totalRequired: totalTerms,
                collectedTerms: [], // Bereits im Tableau oder Slot gesammelte Begriffe
                faceUp: false
            });

            // Child Cards (Assoziierte Begriffe)
            (disease.cards || []).forEach((c, cIdx) => {
                termCards.push({
                    uid: `term_${dId}_${cIdx}`,
                    isCategoryCard: false,
                    diseaseId: dId,
                    diseaseName: disease.name,
                    accent: accent,
                    term: c.term,
                    category: c.category || 'Klinik',
                    explanation: c.explanation || '',
                    stackedCards: [], // Für Tableau Pre-Stacking!
                    faceUp: false
                });
            });
        });

        const shuffledCats = shuffleArray(categoryCards);
        const shuffledTerms = shuffleArray(termCards);

        // 2. Smart Anti-Deadlock Verteilung:
        // Wir garantieren, dass mindestens 2 Kategorienkarten direkt spielbar (oberste Tableau-Karte oder frühe Stock-Karte) sind,
        // damit der Spieler sofort loslegen und kombinieren kann.
        const guaranteedCats = shuffledCats.slice(0, 2);
        const remainingCats = shuffledCats.slice(2);

        const generalPool = shuffleArray([...remainingCats, ...shuffledTerms]);

        // 4 Tableau-Spalten aufbauen (z.B. je 3 bis 5 Karten je nach Deckgröße)
        const numCols = 4;
        const tableau = [[], [], [], []];
        const totalCardsCount = categoryCards.length + termCards.length;
        const targetTableauCount = Math.min(generalPool.length, Math.max(12, Math.floor(totalCardsCount * 0.58)));

        for (let i = 0; i < targetTableauCount; i++) {
            const colIdx = i % numCols;
            const card = generalPool.shift();
            if (card) {
                card.faceUp = false;
                tableau[colIdx].push(card);
            }
        }

        // Die erste garantierte Kategorienkarte legen wir offen ganz nach unten (spielbar) auf Spalte 0 oder 1
        const openCol = Math.floor(Math.random() * numCols);
        if (guaranteedCats[0]) {
            guaranteedCats[0].faceUp = true;
            tableau[openCol].push(guaranteedCats[0]);
        }

        // Oberste (letzte) Karte jeder Tableau-Spalte aufdecken
        tableau.forEach(col => {
            if (col.length > 0) {
                col[col.length - 1].faceUp = true;
            }
        });

        // Stock Pile: Die zweite garantierte Kategorienkarte kommt unter die ersten 2 Stock-Karten
        const stock = [...generalPool];
        if (guaranteedCats[1]) {
            const insertIdx = Math.min(stock.length, 1);
            stock.splice(insertIdx, 0, guaranteedCats[1]);
        }
        stock.forEach(c => { c.faceUp = false; });

        // Move-Budget großzügig, aber herausfordernd kalkulieren
        const calculatedMaxMoves = Math.ceil(totalCardsCount * 1.55) + 14;

        gameState = {
            movesLeft: calculatedMaxMoves,
            maxMoves: calculatedMaxMoves,
            score: 0,
            hintsLeft: 3,
            jokersLeft: 2,
            foundations: [null, null, null, null],
            completedDiseases: [],
            tableau: tableau,
            stock: stock,
            waste: [],
            selectedSource: null,
            hintHighlightIds: [],
            historyStack: []
        };

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        renderView();
    }

    // ----------------------------------------------------------------------
    // 07. SNAPSHOT / UNDO ENGINE
    // ----------------------------------------------------------------------
    function saveHistorySnapshot() {
        const snapshot = JSON.stringify({
            movesLeft: gameState.movesLeft,
            score: gameState.score,
            foundations: gameState.foundations,
            completedDiseases: gameState.completedDiseases,
            tableau: gameState.tableau,
            stock: gameState.stock,
            waste: gameState.waste
        });
        gameState.historyStack.push(snapshot);
        if (gameState.historyStack.length > 25) {
            gameState.historyStack.shift();
        }
    }

    function undoLastMove() {
        if (gameState.historyStack.length === 0) {
            showToast('Kein Zug zum Rückgängigmachen vorhanden.', 'neutral');
            return;
        }
        const prev = JSON.parse(gameState.historyStack.pop());
        gameState.movesLeft = prev.movesLeft;
        gameState.score = prev.score;
        gameState.foundations = prev.foundations;
        gameState.completedDiseases = prev.completedDiseases;
        gameState.tableau = prev.tableau;
        gameState.stock = prev.stock;
        gameState.waste = prev.waste;
        gameState.selectedSource = null;
        gameState.hintHighlightIds = [];

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
        renderView();
    }

    // ----------------------------------------------------------------------
    // 08. SPIELZÜGE, PRE-STACKING & VALIDIERUNG
    // ----------------------------------------------------------------------
    function getPlayableCardFromSource(source) {
        if (!source) return null;
        if (source.zone === 'waste') {
            if (gameState.waste.length === 0) return null;
            return gameState.waste[gameState.waste.length - 1];
        }
        if (source.zone === 'tableau') {
            const col = gameState.tableau[source.colIdx];
            if (!col || col.length === 0) return null;
            return col[col.length - 1]; // Nur die unterste (freie) Karte einer Spalte ist spielbar
        }
        return null;
    }

    function removeCardFromSource(source) {
        if (source.zone === 'waste') {
            return gameState.waste.pop();
        }
        if (source.zone === 'tableau') {
            const col = gameState.tableau[source.colIdx];
            const removed = col.pop();
            // Falls darunter eine verdeckte Karte liegt -> automatisch aufdecken!
            if (col.length > 0 && !col[col.length - 1].faceUp) {
                col[col.length - 1].faceUp = true;
            }
            return removed;
        }
        return null;
    }

    // Ziehen vom Nachziehstapel (Stock -> Waste)
    function drawFromStock() {
        if (gameState.movesLeft <= 0) {
            checkGameOverState();
            return;
        }

        gameState.selectedSource = null;
        gameState.hintHighlightIds = [];

        if (gameState.stock.length > 0) {
            saveHistorySnapshot();
            const card = gameState.stock.shift();
            card.faceUp = true;
            gameState.waste.push(card);
            gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
            renderView();
            checkGameOverState();
        } else if (gameState.waste.length > 0) {
            // Waste Pile zurück in den Stock mischen/umdrehen
            saveHistorySnapshot();
            gameState.stock = gameState.waste.reverse().map(c => ({ ...c, faceUp: false }));
            gameState.waste = [];
            gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
            showToast('Ablagestapel wieder umgedreht (-1 Move)', 'neutral');
            renderView();
            checkGameOverState();
        }
    }

    // Versuch, eine Karte in einen Foundation-Slot (oben) zu legen
    function attemptMoveToFoundation(source, slotIdx) {
        const card = getPlayableCardFromSource(source);
        if (!card) return false;

        const targetSlot = gameState.foundations[slotIdx];

        // FALL A: Ziel-Slot ist leer -> Nur eine Krankheitsbild-Kategorienkarte darf hinein!
        if (!targetSlot) {
            if (!card.isCategoryCard) {
                triggerWrongMoveFeedback(
                    source,
                    `In einen freien Ziel-Slot oben muss zuerst eine <strong>Krankheitsbild-Kategorienkarte</strong> (👑) gelegt werden, bevor du Begriffe zuordnen kannst.`
                );
                return false;
            }

            saveHistorySnapshot();
            const movedCatCard = removeCardFromSource(source);
            gameState.foundations[slotIdx] = movedCatCard;
            gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
            gameState.score += 50;
            gameState.selectedSource = null;
            gameState.hintHighlightIds = [];

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);

            // Prüfen, ob die Kategorienkarte schon im Tableau komplett vor-gestapelt wurde
            checkFoundationSlotCompletion(slotIdx);
            renderView();
            checkGameOverState();
            return true;
        }

        // FALL B: Ziel-Slot hat bereits ein Krankheitsbild -> Begriffskarte (oder Mini-Stapel) zuordnen
        if (card.isCategoryCard) {
            triggerWrongMoveFeedback(
                source,
                `Dieser Slot ist bereits durch <strong>${escapeHtml(targetSlot.diseaseName)}</strong> belegt. Lege diese Krankheitsbild-Karte in einen freien Ziel-Slot.`
            );
            return false;
        }

        if (card.diseaseId !== targetSlot.diseaseId) {
            // Fehlzuordnung! Sokratisches Feedback + 1 Zug Abzug
            gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
            if (typeof trackSkill === 'function') trackSkill('Diagnostik', false);
            triggerWrongMoveFeedback(
                source,
                `<strong>Differentialdiagnostischer Konflikt (-1 Move):</strong><br>„${escapeHtml(card.term)}“ (${escapeHtml(card.category)}) gehört <u>nicht</u> zu <strong>${escapeHtml(targetSlot.diseaseName)}</strong>. Überlege: Für welche andere Entität im Deck ist dieser Befund pathognomonisch?`
            );
            checkGameOverState();
            return false;
        }

        // KORREKTE ZUORDNUNG!
        saveHistorySnapshot();
        const movedTermCard = removeCardFromSource(source);

        // Hauptkarte + alle evtl. im Tableau vorab gestapelten Karten (Pre-Stacking) übertragen!
        const allTermsToAdd = [
            { term: movedTermCard.term, category: movedTermCard.category, explanation: movedTermCard.explanation },
            ...(movedTermCard.stackedCards || [])
        ];

        targetSlot.collectedTerms.push(...allTermsToAdd);
        gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
        gameState.score += 35 * allTermsToAdd.length;
        gameState.selectedSource = null;
        gameState.hintHighlightIds = [];

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        if (typeof trackSkill === 'function') trackSkill('Diagnostik', true);
        if (typeof applyXpDelta === 'function') {
            applyXpDelta(15 * allTermsToAdd.length, allTermsToAdd.length > 1 ? `Combo +${allTermsToAdd.length} Karten` : 'Assoziation');
        }

        checkFoundationSlotCompletion(slotIdx);
        renderView();
        checkGameOverState();
        return true;
    }

    // Versuch, eine Karte innerhalb des Tableaus auf eine andere Spalte zu legen (Pre-Stacking oder leere Spalte)
    function attemptMoveToTableauColumn(source, targetColIdx) {
        if (source.zone === 'tableau' && source.colIdx === targetColIdx) {
            gameState.selectedSource = null;
            renderView();
            return false;
        }

        const card = getPlayableCardFromSource(source);
        if (!card) return false;

        const targetCol = gameState.tableau[targetColIdx];

        // FALL 1: Ziel-Spalte im Tableau ist komplett leer -> Jede spielbare Karte (oder Mini-Stack) darf dorthin!
        if (targetCol.length === 0) {
            saveHistorySnapshot();
            const moved = removeCardFromSource(source);
            targetCol.push(moved);
            gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
            gameState.selectedSource = null;
            gameState.hintHighlightIds = [];
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
            renderView();
            checkGameOverState();
            return true;
        }

        const topTargetCard = targetCol[targetCol.length - 1];

        // FALL 2: Gleiches Krankheitsbild im Tableau zusammenführen (Tableau Pre-Stacking!)
        if (topTargetCard.diseaseId === card.diseaseId) {
            // 2a: Zielkarte im Tableau ist die Krankheitsbild-Kategorienkarte, gezogene Karte ist Begriffskarte
            if (topTargetCard.isCategoryCard && !card.isCategoryCard) {
                saveHistorySnapshot();
                const movedTerm = removeCardFromSource(source);
                const termsToMerge = [
                    { term: movedTerm.term, category: movedTerm.category, explanation: movedTerm.explanation },
                    ...(movedTerm.stackedCards || [])
                ];
                topTargetCard.collectedTerms.push(...termsToMerge);
                gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
                gameState.score += 25 * termsToMerge.length;
                gameState.selectedSource = null;
                gameState.hintHighlightIds = [];
                showToast(`🔗 Im Tableau an „${topTargetCard.diseaseName}“ gekoppelt!`, 'positive');
                renderView();
                checkGameOverState();
                return true;
            }

            // 2b: Beide Karten sind Begriffskarten derselben Krankheit -> Mini-Stack bilden!
            if (!topTargetCard.isCategoryCard && !card.isCategoryCard) {
                saveHistorySnapshot();
                const movedTerm = removeCardFromSource(source);
                topTargetCard.stackedCards = topTargetCard.stackedCards || [];
                topTargetCard.stackedCards.push(
                    { term: movedTerm.term, category: movedTerm.category, explanation: movedTerm.explanation },
                    ...(movedTerm.stackedCards || [])
                );
                gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
                gameState.score += 30;
                gameState.selectedSource = null;
                gameState.hintHighlightIds = [];
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
                showToast(`📚 Pre-Stack gebildet (${1 + topTargetCard.stackedCards.length} Begriffe derselben Krankheit)!`, 'positive');
                renderView();
                checkGameOverState();
                return true;
            }

            // 2c: Gezogene Karte ist die Kategorienkarte und wird auf einen passenden Begriff im Tableau gelegt
            if (card.isCategoryCard && !topTargetCard.isCategoryCard) {
                saveHistorySnapshot();
                const movedCat = removeCardFromSource(source);
                const targetTerm = targetCol.pop();
                movedCat.collectedTerms.push(
                    { term: targetTerm.term, category: targetTerm.category, explanation: targetTerm.explanation },
                    ...(targetTerm.stackedCards || [])
                );
                targetCol.push(movedCat);
                gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
                gameState.score += 30;
                gameState.selectedSource = null;
                gameState.hintHighlightIds = [];
                renderView();
                checkGameOverState();
                return true;
            }
        }

        // Fehlversuch im Tableau (verschiedene Krankheiten)
        gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
        triggerWrongMoveFeedback(
            source,
            `<strong>Nicht kombinierbar (-1 Move):</strong><br>Im Tableau lassen sich nur Karten stapeln, die zum <u>selben Krankheitsbild</u> gehören (oder auf eine freie Spalte verschoben werden).`
        );
        checkGameOverState();
        return false;
    }

    // Doppelklick / Schnell-Zuordnung (sucht automatisch den passenden Slot oben)
    function attemptAutoMoveCard(source) {
        const card = getPlayableCardFromSource(source);
        if (!card) return false;

        if (card.isCategoryCard) {
            const emptySlotIdx = gameState.foundations.findIndex(s => s === null);
            if (emptySlotIdx !== -1) {
                return attemptMoveToFoundation(source, emptySlotIdx);
            }
        } else {
            const matchingSlotIdx = gameState.foundations.findIndex(s => s && s.diseaseId === card.diseaseId);
            if (matchingSlotIdx !== -1) {
                return attemptMoveToFoundation(source, matchingSlotIdx);
            }
        }
        return false;
    }

    function checkFoundationSlotCompletion(slotIdx) {
        const slot = gameState.foundations[slotIdx];
        if (!slot) return;

        if (slot.collectedTerms.length >= slot.totalRequired) {
            // Krankheitsbild komplett gelöst!
            gameState.completedDiseases.push(JSON.parse(JSON.stringify(slot)));
            gameState.foundations[slotIdx] = null; // Slot wird wieder frei für das nächste Krankheitsbild!
            gameState.score += 200;

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic([15, 50, 20]);
            if (typeof applyXpDelta === 'function') {
                applyXpDelta(150, `${slot.diseaseName} gemeistert!`);
            }
            showToast(`🎉 ${slot.diseaseName} vollständig gelöst (+150 XP)! Slot ist wieder frei.`, 'positive');
        }
    }

    function checkGameOverState() {
        const totalDiseases = activeDeck?.diseases?.length || 0;
        if (gameState.completedDiseases.length >= totalDiseases && totalDiseases > 0) {
            // SIEG!
            const bonusScore = gameState.movesLeft * 25;
            gameState.score += bonusScore;
            recordDeckWin(activeDeck.deck_id, gameState.movesLeft, gameState.score);
            if (typeof applyXpDelta === 'function') {
                applyXpDelta(300, 'Solitaire Deck komplett gelöst!');
            }
            setTimeout(() => showVictoryModal(), 250);
            return;
        }

        if (gameState.movesLeft <= 0) {
            setTimeout(() => {
                if (window.confirm('Keine Züge (Moves) mehr übrig! Möchtest du mit +10 Extra-Moves weiterspielen (-50 XP) oder das Deck neu starten?')) {
                    gameState.movesLeft += 10;
                    if (typeof applyXpDelta === 'function') applyXpDelta(-50, '+10 Extra-Moves');
                    renderView();
                } else {
                    startNewGame(activeDeck.deck_id);
                }
            }, 200);
        }
    }

    // ----------------------------------------------------------------------
    // 09. POWER-UPS: HINT & JOKER
    // ----------------------------------------------------------------------
    function useHint() {
        if (gameState.hintsLeft <= 0) {
            showToast('Keine Hinweise mehr in dieser Runde verfügbar.', 'neutral');
            return;
        }

        const playable = [];
        if (gameState.waste.length > 0) {
            playable.push({ card: gameState.waste[gameState.waste.length - 1], zone: 'waste' });
        }
        gameState.tableau.forEach((col, cIdx) => {
            if (col.length > 0) {
                playable.push({ card: col[col.length - 1], zone: 'tableau', colIdx: cIdx });
            }
        });

        // 1. Prüfen, ob eine Kategorienkarte in einen freien Foundation-Slot kann
        const hasFreeFoundation = gameState.foundations.some(s => s === null);
        if (hasFreeFoundation) {
            const catCandidate = playable.find(p => p.card.isCategoryCard);
            if (catCandidate) {
                gameState.hintsLeft--;
                gameState.hintHighlightIds = [catCandidate.card.uid];
                showToast(`💡 Tipp: Lege die Krankheitsbild-Karte „${catCandidate.card.diseaseName}“ oben in einen freien Ziel-Slot!`, 'positive');
                renderView();
                return;
            }
        }

        // 2. Prüfen, ob eine spielbare Begriffskarte in einen aktiven Foundation-Slot passt
        for (const p of playable) {
            if (!p.card.isCategoryCard) {
                const matchSlot = gameState.foundations.find(s => s && s.diseaseId === p.card.diseaseId);
                if (matchSlot) {
                    gameState.hintsLeft--;
                    gameState.hintHighlightIds = [p.card.uid, matchSlot.uid];
                    showToast(`💡 Tipp: „${p.card.term}“ gehört zu einem bereits geöffneten Krankheitsbild oben!`, 'positive');
                    renderView();
                    return;
                }
            }
        }

        // 3. Prüfen, ob zwei Karten im Tableau / Waste zur selben Krankheit gehören (Pre-Stacking!)
        for (let i = 0; i < playable.length; i++) {
            for (let j = i + 1; j < playable.length; j++) {
                const a = playable[i];
                const b = playable[j];
                if (a.card.diseaseId === b.card.diseaseId && (a.zone === 'tableau' || b.zone === 'tableau')) {
                    gameState.hintsLeft--;
                    gameState.hintHighlightIds = [a.card.uid, b.card.uid];
                    showToast(`💡 Pre-Stack-Tipp: Diese beiden markierten Karten gehören zur selben Erkrankung und können im Tableau gestapelt werden!`, 'positive');
                    renderView();
                    return;
                }
            }
        }

        showToast('💡 Aktuell kein direkter Match offen – ziehe eine Karte vom Nachziehstapel oder nutze eine freie Spalte!', 'neutral');
    }

    function useJoker() {
        if (gameState.jokersLeft <= 0) {
            showToast('Keine Joker mehr übrig.', 'neutral');
            return;
        }

        saveHistorySnapshot();
        gameState.jokersLeft--;

        // Wenn im Tableau noch verdeckte Karten liegen, deckt der Joker alle zweituntersten Karten auf
        let revealedCount = 0;
        gameState.tableau.forEach(col => {
            col.forEach(c => {
                if (!c.faceUp) {
                    c.faceUp = true;
                    revealedCount++;
                }
            });
        });

        // Zusätzlich: Falls ein Foundation-Slot frei ist und eine Kategorienkarte im Stock/Tableau schlummert, holen wir sie nach oben
        const emptySlotIdx = gameState.foundations.findIndex(s => s === null);
        if (emptySlotIdx !== -1) {
            const stockCatIdx = gameState.stock.findIndex(c => c.isCategoryCard);
            if (stockCatIdx !== -1) {
                const [catCard] = gameState.stock.splice(stockCatIdx, 1);
                catCard.faceUp = true;
                gameState.foundations[emptySlotIdx] = catCard;
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(14);
                showToast(`🃏 Joker eingesetzt: „${catCard.diseaseName}“ direkt freigeschaltet!`, 'positive');
                renderView();
                return;
            }
        }

        if (revealedCount > 0) {
            showToast(`🃏 Joker eingesetzt: Alle verdeckten Karten im Tableau zur besseren Planung aufgedeckt!`, 'positive');
        } else {
            gameState.movesLeft += 5;
            showToast(`🃏 Joker eingesetzt: +5 Extra-Moves erhalten!`, 'positive');
        }
        renderView();
    }

    // ----------------------------------------------------------------------
    // 10. UI FEEDBACK, INSPECT-MODAL & LERN-DEPOT INTEGRATION
    // ----------------------------------------------------------------------
    function showToast(htmlMsg, type = 'neutral') {
        const banner = document.getElementById('sol-feedback-banner');
        if (!banner) return;
        banner.className = `sol-feedback-banner ${type}`;
        banner.innerHTML = htmlMsg;
        banner.style.display = 'flex';
    }

    function triggerWrongMoveFeedback(source, htmlReason) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic([20, 40, 20]);
        gameState.selectedSource = null;
        renderView();
        showToast(htmlReason, 'error');

        const card = getPlayableCardFromSource(source);
        if (card) {
            const el = document.querySelector(`[data-card-uid="${card.uid}"]`);
            if (el) {
                el.classList.add('sol-card-shake');
                setTimeout(() => el.classList.remove('sol-card-shake'), 500);
            }
        }
    }

    function openDiseaseInspectModal(diseaseSlotObj) {
        if (!diseaseSlotObj) return;
        const modal = document.getElementById('sol-inspect-modal');
        const body = document.getElementById('sol-inspect-body');
        if (!modal || !body) return;

        const terms = diseaseSlotObj.collectedTerms || [];
        body.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; border-bottom:1px solid var(--card-border); padding-bottom:12px; margin-bottom:14px;">
                <div>
                    <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:${diseaseSlotObj.accent}; letter-spacing:0.06em;">
                        👑 Krankheitsbild-Dossier (${terms.length}/${diseaseSlotObj.totalRequired} Begriffe)
                    </div>
                    <h3 style="margin:4px 0 0 0; font-size:1.2rem; color:var(--text-main);">${escapeHtml(diseaseSlotObj.diseaseName)}</h3>
                </div>
                <button type="button" class="action-btn secondary btn-sm" onclick="document.getElementById('sol-inspect-modal').style.display='none'">✕</button>
            </div>

            ${diseaseSlotObj.clinicalPearl ? `
                <div class="sm-callout-box sm-pearl" style="margin:0 0 16px 0;">
                    <div class="sm-callout-header"><span class="sm-callout-badge">💡 Klinische Synthese</span></div>
                    <div class="sm-callout-body">${escapeHtml(diseaseSlotObj.clinicalPearl)}</div>
                </div>
            ` : ''}

            <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">
                Bereits zugeordnete Begriffe & Pathophysiologie:
            </div>

            ${terms.length === 0 ? `
                <div style="padding:18px; text-align:center; color:var(--text-dim); border:1px dashed var(--card-border); border-radius:10px;">
                    Noch keine Begriffskarten auf diesem Krankheitsbild abgelegt.
                </div>
            ` : `
                <div style="display:flex; flex-direction:column; gap:10px; max-height:48vh; overflow-y:auto; padding-right:4px;">
                    ${terms.map((t, idx) => {
                        const catCfg = CATEGORY_COLORS[t.category] || CATEGORY_COLORS['Klinik'];
                        return `
                            <div style="background:rgba(15,23,42,0.6); border:1px solid var(--card-border); border-left:4px solid ${catCfg.color}; border-radius:10px; padding:12px 14px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
                                    <strong style="font-size:0.9rem; color:var(--text-main);">${escapeHtml(t.term)}</strong>
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <span style="font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:999px; background:${catCfg.bg}; color:${catCfg.color};">
                                            ${escapeHtml(t.category)}
                                        </span>
                                        <button type="button" class="fc-depot-pin-btn" onclick="window.SolitaireModule.pinTermToDepot('${escapeHtml(diseaseSlotObj.diseaseName).replace(/'/g, "\\'")}', '${escapeHtml(t.term).replace(/'/g, "\\'")}', '${escapeHtml(t.explanation).replace(/'/g, "\\'")}')" title="Direkt ins Lern-Depot pinnen">
                                            📌 Depot
                                        </button>
                                    </div>
                                </div>
                                <div style="font-size:0.82rem; color:var(--text-muted); line-height:1.5;">
                                    ${escapeHtml(t.explanation || 'Zugehöriger klinischer Befund.')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        `;
        modal.style.display = 'flex';
    }

    function pinTermToDepot(diseaseName, term, explanation) {
        if (typeof createDepotEntry === 'function') {
            createDepotEntry({
                case_id: activeDeck?.deck_id || 'solitaire_ddx',
                case_title: `Solitaire DDx: ${diseaseName}`,
                category: activeDeck?.medical_field || 'Differentialdiagnose',
                cue_context: `${diseaseName} – ${term}`,
                highlighted_text: `${term}: ${explanation}`
            });
            showToast(`📌 „${term}“ im Lern-Depot gespeichert!`, 'positive');
        }
    }

    function showVictoryModal() {
        const modal = document.getElementById('sol-inspect-modal');
        const body = document.getElementById('sol-inspect-body');
        if (!modal || !body) return;

        body.innerHTML = `
            <div style="text-align:center; padding:12px 6px;">
                <div style="font-size:3rem; margin-bottom:8px;">🏆</div>
                <h3 style="font-size:1.4rem; color:var(--text-main); margin-bottom:6px;">Deck vollständig gemeistert!</h3>
                <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:18px;">
                    Du hast alle <strong>${gameState.completedDiseases.length} Krankheitsbilder</strong> differentialdiagnostisch sauber zugeordnet.
                </p>
                <div style="display:flex; justify-content:center; gap:14px; flex-wrap:wrap; margin-bottom:20px;">
                    <div class="hud-stat"><strong style="color:var(--accent-blue);">${gameState.score}</strong> <span>Punkte</span></div>
                    <div class="hud-stat"><strong style="color:var(--color-symptom);">${gameState.movesLeft}</strong> <span>Moves übrig</span></div>
                </div>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                    <button type="button" class="action-btn" onclick="document.getElementById('sol-inspect-modal').style.display='none'; window.SolitaireModule.startNewGame('${activeDeck.deck_id}')">
                        🔄 Nochmal spielen
                    </button>
                    <button type="button" class="action-btn secondary" onclick="document.getElementById('sol-inspect-modal').style.display='none'; window.SolitaireModule.backToLobby()">
                        📚 Zur Deck-Bibliothek
                    </button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    }

    // ----------------------------------------------------------------------
    // 11. MANUELLER DECK-UPLOAD & SKILL-PROMPT EXPORT
    // ----------------------------------------------------------------------
    function validateAndImportDeckJson(rawText) {
        const cleaned = rawText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const parsed = JSON.parse(cleaned);

        if (!parsed.title || !Array.isArray(parsed.diseases) || parsed.diseases.length === 0) {
            throw new Error('Ungültiges Format: Das JSON muss "title" und ein nicht-leeres Array "diseases" enthalten.');
        }

        parsed.deck_id = (parsed.deck_id || 'custom_deck_' + Date.now()).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        parsed.medical_field = parsed.medical_field || 'Allgemein';
        parsed.difficulty = parsed.difficulty || 'Staatsexamen';

        parsed.diseases.forEach((d, idx) => {
            if (!d.name || !Array.isArray(d.cards) || d.cards.length === 0) {
                throw new Error(`Krankheitsbild #${idx + 1} benötigt "name" und ein Array "cards".`);
            }
            d.disease_id = d.disease_id || `dis_${idx}_${Date.now()}`;
            d.color_accent = d.color_accent || ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
        });

        const customDecks = getCustomDecks().filter(d => d.deck_id !== parsed.deck_id);
        customDecks.unshift(parsed);
        saveCustomDecks(customDecks);
        return parsed;
    }

    function deleteCustomDeck(deckId) {
        if (!window.confirm('Möchtest du dieses hochgeladene Kartendeck wirklich löschen?')) return;
        const updated = getCustomDecks().filter(d => d.deck_id !== deckId);
        saveCustomDecks(updated);
        renderView();
    }

    async function copySkillMasterPrompt(btnEl) {
        try {
            await navigator.clipboard.writeText(SKILL_EXTRACTION_PROMPT);
            if (btnEl) {
                const orig = btnEl.innerHTML;
                btnEl.innerHTML = '✓ Skill-Prompt & JSON-Schema kopiert!';
                setTimeout(() => { btnEl.innerHTML = orig; }, 2200);
            }
        } catch (_e) {
            alert('Kopieren fehlgeschlagen.');
        }
    }

    // ----------------------------------------------------------------------
    // 12. RENDERING: LOBBY (DECK-MANAGER) & SPIELFELD (JOURNEY BOARD)
    // ----------------------------------------------------------------------
    function renderLobby(container) {
        const decks = getAllDecks();
        const stats = getDeckStats();

        container.innerHTML = `
            <div class="sol-lobby-wrapper">
                <!-- Header -->
                <div class="sol-lobby-header">
                    <div>
                        <div class="friends-kicker">CLINICAL DEDUCTION CARD GAME</div>
                        <h2 class="friends-main-title">🃏 Solitaire Associations Journey</h2>
                        <p class="friends-subtitle">
                            Lege Krankheitsbilder als Kategorienkarten frei und ordne ihnen Pathophysiologie, Leitsymptome, Diagnostik und Therapie strategisch zu.
                        </p>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.SolitaireModule.generateDecksFromExistingCases()" title="Erstellt automatisch ein DDx-Deck aus deinen bestehenden MedCheck-Fällen">
                            ⚡ Deck aus meinen App-Fällen generieren
                        </button>
                        <button type="button" class="action-btn btn-sm" onclick="window.SolitaireModule.toggleUploadPanel()">
                            📥 Eigenes Krankheitsdeck hochladen
                        </button>
                    </div>
                </div>

                <!-- Ausklappbarer Deck-Uploader & Skill-Schema -->
                <div id="sol-upload-panel" class="sol-upload-panel hidden">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                        <div>
                            <div style="font-weight:800; font-size:0.95rem; color:var(--text-main);">📦 Krankheitskartendeck importieren (.json)</div>
                            <div style="font-size:0.78rem; color:var(--text-muted);">Ziehe eine JSON-Datei aus deinem Extraktions-Skill hierher oder füge den JSON-Code direkt ein.</div>
                        </div>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.SolitaireModule.copySkillMasterPrompt(this)">
                            📋 JSON-Schema & Prompt für deinen Skill kopieren
                        </button>
                    </div>

                    <div id="sol-file-dropzone" class="sol-file-dropzone">
                        <span>📂 <strong>JSON-Deckdatei hier ablegen</strong> oder klicken zum Durchsuchen</span>
                        <input type="file" id="sol-file-input" accept=".json" multiple style="display:none;">
                    </div>

                    <textarea id="sol-json-textarea" class="forge-textarea" style="height:140px; margin-top:10px; margin-bottom:10px;" placeholder='Oder JSON-Code des Kartendecks hier direkt einfügen...'></textarea>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.SolitaireModule.toggleUploadPanel()">Schließen</button>
                        <button type="button" class="action-btn btn-sm" onclick="window.SolitaireModule.handlePasteImport()">✓ Validieren & Deck speichern</button>
                    </div>
                </div>

                <!-- Spielregeln Kurz-Strip -->
                <div class="sol-rules-strip">
                    <div class="sol-rule-pill"><span>1️⃣</span> <strong>Krankheitsbild (👑)</strong> in freien Slot oben legen</div>
                    <div class="sol-rule-pill"><span>2️⃣</span> Passende <strong>Befunde & Begriffe</strong> darauf sammeln</div>
                    <div class="sol-rule-pill"><span>3️⃣</span> <strong>Pre-Stacking:</strong> Gleiche Krankheit schon im Tableau bündeln, um Moves zu sparen!</div>
                </div>

                <!-- Deck-Karten Grid -->
                <div class="sol-decks-grid">
                    ${decks.map(deck => {
                        const dStat = stats[deck.deck_id] || { wins: 0, bestScore: 0 };
                        const totalTerms = (deck.diseases || []).reduce((acc, d) => acc + (d.cards?.length || 0), 0);
                        return `
                            <div class="sol-deck-card">
                                <div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                                        <span class="tag">${escapeHtml(deck.medical_field || 'Medizin')}</span>
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            ${dStat.wins > 0 ? `<span style="font-size:0.7rem; font-weight:800; color:var(--color-symptom);">✓ ${dStat.wins}x gelöst</span>` : ''}
                                            ${!deck.is_builtin ? `<button type="button" class="folder-action-btn delete-folder-btn" onclick="event.stopPropagation(); window.SolitaireModule.deleteCustomDeck('${deck.deck_id}')" title="Deck löschen">🗑️</button>` : ''}
                                        </div>
                                    </div>
                                    <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-main); margin-bottom:6px;">${escapeHtml(deck.title)}</h3>
                                    <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.45; margin-bottom:12px;">
                                        ${escapeHtml(deck.description || '')}
                                    </p>
                                    <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:14px;">
                                        ${(deck.diseases || []).map(d => `
                                            <span style="font-size:0.68rem; font-weight:700; padding:2px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border-left:3px solid ${d.color_accent || '#38bdf8'}; color:var(--text-main);">
                                                ${escapeHtml(d.name)} (${d.cards?.length || 0})
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px; border-top:1px solid var(--divider-color);">
                                    <span style="font-size:0.74rem; color:var(--text-dim); font-family:'JetBrains Mono', monospace;">
                                        ${deck.diseases?.length || 0} Diagnosen • ${totalTerms} Karten
                                    </span>
                                    <button type="button" class="action-btn btn-sm" onclick="window.SolitaireModule.startNewGame('${deck.deck_id}')">
                                        Spielen ➔
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        bindDropzoneEvents();
    }

    function renderCardHtml(card, zone, colIdx, cardIdx, isPlayable) {
        const isSelected = gameState.selectedSource &&
            gameState.selectedSource.zone === zone &&
            gameState.selectedSource.colIdx === colIdx &&
            gameState.selectedSource.cardIdx === cardIdx;

        const isHinted = gameState.hintHighlightIds.includes(card.uid);

        if (!card.faceUp) {
            return `
                <div class="sol-card sol-card-back" data-card-uid="${card.uid}">
                    <div class="sol-card-back-pattern">✚</div>
                </div>
            `;
        }

        // KATEGORIENKARTE (KRANKHEITSBILD / PARENT CARD)
        if (card.isCategoryCard) {
            const collectedCount = (card.collectedTerms || []).length;
            return `
                <div class="sol-card sol-card-category ${isPlayable ? 'is-playable' : ''} ${isSelected ? 'is-selected' : ''} ${isHinted ? 'is-hinted' : ''}"
                     style="--disease-accent: ${card.accent};"
                     data-card-uid="${card.uid}"
                     data-zone="${zone}"
                     data-col="${colIdx}"
                     data-idx="${cardIdx}"
                     draggable="${isPlayable ? 'true' : 'false'}">
                    <div class="sol-cat-crown-row">
                        <span class="sol-crown-badge">👑 KRANKHEITSBILD</span>
                        <span class="sol-cat-counter">${collectedCount}/${card.totalRequired}</span>
                    </div>
                    <div class="sol-cat-disease-title">${escapeHtml(card.diseaseName)}</div>
                    <div class="sol-cat-footer">
                        <span>${escapeHtml(card.icd10 || 'DDx-Kategorie')}</span>
                        <span>In Ziel-Slot legen ⬆</span>
                    </div>
                </div>
            `;
        }

        // BEGRIFFSKARTE (CHILD CARD)
        const catCfg = CATEGORY_COLORS[card.category] || CATEGORY_COLORS['Klinik'];
        const stackCount = 1 + (card.stackedCards?.length || 0);

        return `
            <div class="sol-card sol-card-term ${isPlayable ? 'is-playable' : ''} ${isSelected ? 'is-selected' : ''} ${isHinted ? 'is-hinted' : ''}"
                 data-card-uid="${card.uid}"
                 data-zone="${zone}"
                 data-col="${colIdx}"
                 data-idx="${cardIdx}"
                 draggable="${isPlayable ? 'true' : 'false'}">
                <div class="sol-term-top-row">
                    ${!hardMode ? `
                        <span class="sol-term-cat-pill" style="background:${catCfg.bg}; color:${catCfg.color};">
                            ${escapeHtml(catCfg.label)}
                        </span>
                    ` : `<span class="sol-term-cat-pill" style="background:rgba(148,163,184,0.12); color:var(--text-dim);">🎓 Exam</span>`}
                    ${stackCount > 1 ? `<span class="sol-prestack-badge" title="Gestapelte Begriffe derselben Krankheit">📚 ${stackCount}x</span>` : ''}
                </div>
                <div class="sol-term-main-text">${escapeHtml(card.term)}</div>
                ${stackCount > 1 ? `
                    <div class="sol-prestack-preview">
                        + ${card.stackedCards.map(s => escapeHtml(s.term)).join(' • ')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderGameBoard(container) {
        const totalDiseases = activeDeck.diseases.length;
        const solvedDiseasesCount = gameState.completedDiseases.length;
        const topWasteCard = gameState.waste.length > 0 ? gameState.waste[gameState.waste.length - 1] : null;

        container.innerHTML = `
            <div class="sol-game-wrapper">
                <!-- Top-Control & Telemetry Bar -->
                <div class="sol-topbar">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="back-btn" onclick="window.SolitaireModule.backToLobby()">← Decks</button>
                        <div>
                            <div style="font-size:0.95rem; font-weight:800; color:var(--text-main);">${escapeHtml(activeDeck.title)}</div>
                            <div style="font-size:0.74rem; color:var(--text-muted);">
                                Gelöste Krankheitsbilder: <strong>${solvedDiseasesCount} / ${totalDiseases}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="sol-hud-Controls">
                        <div class="sol-moves-pill ${gameState.movesLeft <= 8 ? 'critical' : ''}">
                            <span>MOVES</span>
                            <strong>${gameState.movesLeft}</strong>
                        </div>
                        <button type="button" class="sol-power-btn" onclick="window.SolitaireModule.undoLastMove()" ${gameState.historyStack.length === 0 ? 'disabled' : ''} title="Letzten Zug rückgängig machen">
                            ↩ Undo
                        </button>
                        <button type="button" class="sol-power-btn" onclick="window.SolitaireModule.useHint()" title="Mögliche Zuordnung markieren">
                            💡 Hint (${gameState.hintsLeft})
                        </button>
                        <button type="button" class="sol-power-btn" onclick="window.SolitaireModule.useJoker()" title="Joker einsetzen">
                            🃏 Joker (${gameState.jokersLeft})
                        </button>
                        <button type="button" class="sol-power-btn ${hardMode ? 'active' : ''}" onclick="window.SolitaireModule.toggleHardMode()" title="Kategorie-Hinweise auf Karten ein-/ausblenden">
                            🎓 ${hardMode ? 'Hard' : 'Normal'}
                        </button>
                        <button type="button" class="sol-power-btn" onclick="window.SolitaireModule.startNewGame('${activeDeck.deck_id}')" title="Runde neu mischen">
                            🔄 Neu
                        </button>
                    </div>
                </div>

                <!-- Sokratisches Feedback-Banner -->
                <div id="sol-feedback-banner" class="sol-feedback-banner" style="display:none;"></div>

                <!-- OBERE REIHE: NACHZIEHSTAPEL (LINKS) & 4 KRANKHEITS-ZIELSLOTS (RECHTS) -->
                <div class="sol-upper-deck-row">
                    <!-- Stock & Waste Area -->
                    <div class="sol-stock-waste-group">
                        <div class="sol-stock-slot ${gameState.stock.length > 0 ? 'has-cards' : 'is-empty'}" onclick="window.SolitaireModule.drawFromStock()" title="Karte ziehen (1 Move)">
                            ${gameState.stock.length > 0 ? `
                                <div class="sol-stock-card-stack">
                                    <span class="sol-stock-count">${gameState.stock.length}</span>
                                    <span style="font-size:0.68rem; color:var(--text-muted);">Ziehen</span>
                                </div>
                            ` : `
                                <div class="sol-stock-empty-icon">↻<span>Recyceln</span></div>
                            `}
                        </div>

                        <div class="sol-waste-slot">
                            ${topWasteCard ? renderCardHtml(topWasteCard, 'waste', 0, gameState.waste.length - 1, true) : `
                                <div class="sol-empty-placeholder">Ablage</div>
                            `}
                        </div>
                    </div>

                    <!-- 4 Foundation-Slots für Krankheitsbilder -->
                    <div class="sol-foundations-grid">
                        ${gameState.foundations.map((slot, sIdx) => {
                            if (!slot) {
                                return `
                                    <div class="sol-foundation-slot is-empty-foundation" data-foundation-idx="${sIdx}">
                                        <div class="sol-foundation-crown-icon">👑</div>
                                        <div class="sol-foundation-empty-text">Krankheitsbild-Karte<br>hier ablegen</div>
                                    </div>
                                `;
                            }
                            const count = slot.collectedTerms.length;
                            const pct = Math.min(100, Math.round((count / slot.totalRequired) * 100));
                            const lastTerm = count > 0 ? slot.collectedTerms[count - 1].term : 'Noch keine Begriffe zugeordnet';
                            const isHinted = gameState.hintHighlightIds.includes(slot.uid);

                            return `
                                <div class="sol-foundation-slot is-active-foundation ${isHinted ? 'is-hinted' : ''}"
                                     style="--disease-accent: ${slot.accent};"
                                     data-foundation-idx="${sIdx}">
                                    <div class="sol-foundation-top">
                                        <span class="sol-foundation-badge" style="background:${slot.accent}; color:#060913;">
                                            ${count} / ${slot.totalRequired}
                                        </span>
                                        <button type="button" class="sol-inspect-btn" data-inspect-slot="${sIdx}" title="Zugeordnete Begriffe & Pathophysiologie inspizieren">
                                            🔍 Dossier
                                        </button>
                                    </div>
                                    <div class="sol-foundation-title">${escapeHtml(slot.diseaseName)}</div>
                                    <div class="sol-foundation-progress-track">
                                        <div class="sol-foundation-progress-fill" style="width:${pct}%; background:${slot.accent};"></div>
                                    </div>
                                    <div class="sol-foundation-last-term">
                                        Zuletzt: <em>${escapeHtml(lastTerm)}</em>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- BEREITS VOLLSTÄNDIG GELÖSTE KRANKHEITSBILDER (TROPHY BAR) -->
                ${gameState.completedDiseases.length > 0 ? `
                    <div class="sol-completed-strip">
                        <span style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:var(--color-symptom);">✓ Gemeistert (Klicken für Dossier):</span>
                        ${gameState.completedDiseases.map((cd, cIdx) => `
                            <button type="button" class="sol-completed-pill" onclick="window.SolitaireModule.inspectCompletedDisease(${cIdx})">
                                👑 ${escapeHtml(cd.diseaseName)} (${cd.totalRequired}/${cd.totalRequired})
                            </button>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- TABLEAU: 4 SOLITAIRE-SPALTEN -->
                <div class="sol-tableau-grid">
                    ${gameState.tableau.map((col, colIdx) => `
                        <div class="sol-tableau-col" data-tableau-col="${colIdx}">
                            ${col.length === 0 ? `
                                <div class="sol-tableau-empty-dropzone" data-tableau-col="${colIdx}">
                                    <span>Freie Spalte<br><small>(Beliebige Karte ablegen)</small></span>
                                </div>
                            ` : col.map((card, cardIdx) => {
                                const isBottomPlayable = (cardIdx === col.length - 1);
                                return renderCardHtml(card, 'tableau', colIdx, cardIdx, isBottomPlayable);
                            }).join('')}
                        </div>
                    `).join('')}
                </div>

                <!-- Inspect & Victory Modal -->
                <div id="sol-inspect-modal" class="reveal-modal" style="display:none;" onclick="if(event.target === this) this.style.display='none'">
                    <div class="reveal-card" id="sol-inspect-body" style="max-width:600px;"></div>
                </div>
            </div>
        `;

        bindGameBoardEvents(container);
    }

    // ----------------------------------------------------------------------
    // 13. INTERAKTIONS-BINDINGS (DRAG & DROP + CLICK + DOUBLECLICK)
    // ----------------------------------------------------------------------
    function bindGameBoardEvents(container) {
        // 1. Spielbare Karten (Waste + unterste Tableau-Karten)
        const playableCards = container.querySelectorAll('.sol-card.is-playable');
        playableCards.forEach(cardEl => {
            const zone = cardEl.dataset.zone;
            const colIdx = parseInt(cardEl.dataset.col, 10);
            const cardIdx = parseInt(cardEl.dataset.idx, 10);
            const sourceObj = { zone, colIdx, cardIdx };

            // Klick zum Auswählen ODER zum Stapeln auf eine bereits ausgewählte Karte im Tableau
            cardEl.addEventListener('click', (e) => {
                e.stopPropagation();

                // Wenn bereits eine andere Karte ausgewählt ist und man auf eine Tableau-Karte klickt -> Pre-Stacking versuchen!
                if (gameState.selectedSource && zone === 'tableau') {
                    const isSameCard = gameState.selectedSource.zone === zone &&
                                       gameState.selectedSource.colIdx === colIdx &&
                                       gameState.selectedSource.cardIdx === cardIdx;
                    if (isSameCard) {
                        gameState.selectedSource = null;
                        renderView();
                        return;
                    }
                    attemptMoveToTableauColumn(gameState.selectedSource, colIdx);
                    return;
                }

                gameState.selectedSource = sourceObj;
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
                renderView();
            });

            // Doppelklick -> Sofortige Auto-Zuordnung in passenden Foundation-Slot oben
            cardEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                attemptAutoMoveCard(sourceObj);
            });

            // Drag Start
            cardEl.addEventListener('dragstart', (e) => {
                gameState.selectedSource = sourceObj;
                cardEl.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', JSON.stringify(sourceObj));
            });

            cardEl.addEventListener('dragend', () => {
                cardEl.classList.remove('is-dragging');
            });
        });

        // 2. Foundation-Slots (Oben)
        const foundationSlots = container.querySelectorAll('.sol-foundation-slot');
        foundationSlots.forEach(slotEl => {
            const slotIdx = parseInt(slotEl.dataset.foundationIdx, 10);

            // Inspect-Dossier Button
            const inspectBtn = slotEl.querySelector('[data-inspect-slot]');
            if (inspectBtn) {
                inspectBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openDiseaseInspectModal(gameState.foundations[slotIdx]);
                });
            }

            // Klick auf Foundation-Slot
            slotEl.addEventListener('click', () => {
                if (gameState.selectedSource) {
                    attemptMoveToFoundation(gameState.selectedSource, slotIdx);
                } else if (gameState.foundations[slotIdx]) {
                    openDiseaseInspectModal(gameState.foundations[slotIdx]);
                }
            });

            // Drag & Drop auf Foundation-Slot
            slotEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                slotEl.classList.add('drag-over');
            });
            slotEl.addEventListener('dragleave', () => {
                slotEl.classList.remove('drag-over');
            });
            slotEl.addEventListener('drop', (e) => {
                e.preventDefault();
                slotEl.classList.remove('drag-over');
                try {
                    const src = JSON.parse(e.dataTransfer.getData('text/plain'));
                    attemptMoveToFoundation(src, slotIdx);
                } catch (_err) {}
            });
        });

        // 3. Tableau-Spalten (für Drag & Drop & Klick auf leere Spalten)
        const tableauCols = container.querySelectorAll('.sol-tableau-col');
        tableauCols.forEach(colEl => {
            const targetColIdx = parseInt(colEl.dataset.tableauCol, 10);

            colEl.addEventListener('click', () => {
                if (gameState.selectedSource && gameState.tableau[targetColIdx].length === 0) {
                    attemptMoveToTableauColumn(gameState.selectedSource, targetColIdx);
                }
            });

            colEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                colEl.classList.add('drag-over-col');
            });
            colEl.addEventListener('dragleave', () => {
                colEl.classList.remove('drag-over-col');
            });
            colEl.addEventListener('drop', (e) => {
                e.preventDefault();
                colEl.classList.remove('drag-over-col');
                try {
                    const src = JSON.parse(e.dataTransfer.getData('text/plain'));
                    attemptMoveToTableauColumn(src, targetColIdx);
                } catch (_err) {}
            });
        });
    }

    function bindDropzoneEvents() {
        const dz = document.getElementById('sol-file-dropzone');
        const fileInput = document.getElementById('sol-file-input');
        if (!dz || !fileInput) return;

        dz.onclick = () => fileInput.click();

        fileInput.onchange = async (e) => {
            if (e.target.files?.length) {
                await handleUploadedFiles(e.target.files);
                fileInput.value = '';
            }
        };

        dz.addEventListener('dragover', (e) => {
            e.preventDefault();
            dz.classList.add('dragover');
        });
        dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
        dz.addEventListener('drop', async (e) => {
            e.preventDefault();
            dz.classList.remove('dragover');
            if (e.dataTransfer?.files?.length) {
                await handleUploadedFiles(e.dataTransfer.files);
            }
        });
    }

    async function handleUploadedFiles(fileList) {
        let importedCount = 0;
        for (const file of Array.from(fileList)) {
            try {
                const text = await file.text();
                validateAndImportDeckJson(text);
                importedCount++;
            } catch (err) {
                alert(`Fehler in Datei "${file.name}": ${err.message}`);
            }
        }
        if (importedCount > 0) {
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
            renderView();
        }
    }

    function handlePasteImport() {
        const ta = document.getElementById('sol-json-textarea');
        if (!ta || !ta.value.trim()) {
            alert('Bitte füge zuerst einen JSON-Code in das Textfeld ein.');
            return;
        }
        try {
            const deck = validateAndImportDeckJson(ta.value);
            ta.value = '';
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
            renderView();
            alert(`Deck „${deck.title}“ mit ${deck.diseases.length} Krankheitsbildern erfolgreich gespeichert!`);
        } catch (err) {
            alert(`Validierungsfehler: ${err.message}`);
        }
    }

    function toggleUploadPanel() {
        const panel = document.getElementById('sol-upload-panel');
        if (panel) panel.classList.toggle('hidden');
    }

    function renderView() {
        const container = document.getElementById('solitaire-view');
        if (!container) return;
        if (currentViewMode === 'game' && activeDeck) {
            renderGameBoard(container);
        } else {
            renderLobby(container);
        }
    }

    // ----------------------------------------------------------------------
    // 14. PUBLIC API
    // ----------------------------------------------------------------------
    return {
        openView() {
            renderView();
        },
        startNewGame,
        backToLobby() {
            currentViewMode = 'lobby';
            renderView();
        },
        drawFromStock,
        undoLastMove,
        useHint,
        useJoker,
        toggleHardMode() {
            hardMode = !hardMode;
            renderView();
        },
        inspectCompletedDisease(idx) {
            openDiseaseInspectModal(gameState.completedDiseases[idx]);
        },
        pinTermToDepot,
        toggleUploadPanel,
        handlePasteImport,
        deleteCustomDeck,
        generateDecksFromExistingCases,
        copySkillMasterPrompt
    };
})();

window.SolitaireModule = SolitaireModule;
