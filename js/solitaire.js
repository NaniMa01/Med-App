/* ==========================================================================
   MEDCHECK – SOLITAIRE ASSOCIATIONS JOURNEY MODULE V3.1 (js/solitaire.js)
   ==========================================================================
   FEATURES V3.1 (ZERO-DELAY TOUCH/IPAD DRAG & MAGNETIC DROP ENGINE):
   01. 0ms Instant Touch-Pickup via Pointer-Events & GPU translate3d() Ghost
   02. Magnetisches Drop-Snapping (Berechnet Karten-Rechteck-Überlappung statt nur Fingerpunkt)
   03. Elastischer Spring-Back-Effekt beim Loslassen im Leeren oder bei Fehlversuch
   04. 1-Tap / Double-Tap Smart-Auto-Move für einhändiges Spielen auf dem Smartphone
   05. Hochkant-Spielkarten (5:7 Portrait), Spoilerfreier ⓘ Button & Zero-Move-Penalty
   ========================================================================== */

const SolitaireModule = (() => {
    const STORAGE_DECKS_KEY = 'medcheck_solitaire_custom_decks_v1';
    const STORAGE_STATS_KEY = 'medcheck_solitaire_stats_v1';

    // ----------------------------------------------------------------------
    // 01. INTEGRIERTE STAATSEXAMENS-DEMODECKS
    // ----------------------------------------------------------------------
    const BUILTIN_DECKS = [
        {
            deck_id: 'builtin_ddx_neuro_degen_01',
            title: 'DDx: Atypische Parkinson-Syndrome & Demenzen',
            medical_field: 'Neurologie',
            difficulty: 'Staatsexamen',
            description: 'Differentialdiagnostische Abgrenzung von PSP, MSA, Lewy-Body-Demenz und Kortikobasaler Degeneration anhand Klinik, MRT-Zeichen und Neuropathologie.',
            is_builtin: true,
            diseases: [
                {
                    disease_id: 'psp',
                    name: 'Progressive supranukleäre Blickparese (PSP)',
                    icd10: 'G23.1',
                    color_accent: '#38bdf8',
                    clinical_pearl: '4R-Tauopathie mit charakteristischer Mittelhirnatrophie, vertikaler Blickparese und früher posturaler Instabilität.',
                    cards: [
                        { term: 'Vertikale Blickparese (v.a. nach unten)', category: 'Klinik', explanation: 'Schädigung des rostralen interstitiellen Kerns des Fasciculus longitudinalis medialis (riMLF) im Mittelhirn. Patienten können beim Essen oft nicht auf den Teller blicken.' },
                        { term: 'Hummingbird-Sign (Kolibri-Zeichen)', category: 'Diagnostik', explanation: 'Atrophie des Mesencephalons (Schnabel/Kopf des Kolibris) bei erhaltenem Pons (Bauch des Kolibris) im mediosagittalen T1-MRT.' },
                        { term: '4-Repeat-Tau (Tufted Astrocytes)', category: 'Pathophysiologie', explanation: 'Pathognomonische neuropathologische Ablagerung von 4R-Tau-Isoformen in büschelförmigen Astrozyten und subkortikalen Neurofibrillenbündeln.' },
                        { term: 'Frühe ungebremste Stürze nach hinten', category: 'Klinik', explanation: 'Ausgeprägte posturale Instabilität und axiale Rigidität bereits im 1. Krankheitsjahr (wichtige Red Flag gegen den idiopathischen Morbus Parkinson).' },
                        { term: 'Mickey-Mouse-Sign im axialen MRT', category: 'Diagnostik', explanation: 'Verschmächtigung des anteroposterioren Mittelhirndurchmessers mit konkaver Einziehung der Hirnschenkel im axialen Schnittbild.' },
                        { term: 'Kaum / kein Ansprechen auf L-Dopa', category: 'Therapie', explanation: 'Durch den Untergang postsynaptischer striataler Dopaminrezeptoren bleibt die dopaminerge Substitutionstherapie meist wirkungslos.' }
                    ]
                },
                {
                    disease_id: 'msa',
                    name: 'Multisystematrophie (MSA-P / MSA-C)',
                    icd10: 'G90.3',
                    color_accent: '#a855f7',
                    clinical_pearl: 'Alpha-Synukleinopathie mit schwerer früher autonomer Dysfunktion sowie parkinsonoidem (MSA-P) oder zerebellärem (MSA-C) Phänotyp.',
                    cards: [
                        { term: 'Hot-Cross-Bun-Zeichen im Pons', category: 'Diagnostik', explanation: 'Kreuzförmige T2-Hyperintensität in der Brücke durch selektive Degeneration pontozerebellärer Fasern.' },
                        { term: 'Gliale Einschlüsse (Papp-Lantos-Körper)', category: 'Pathophysiologie', explanation: 'Alpha-Synuklein-Aggregate lagern sich primär in Oligodendrozyten (Glia) statt nur in Neuronen ab.' },
                        { term: 'Frühe schwere Orthostase & Inkontinenz', category: 'Klinik', explanation: 'Ausgeprägte autonome Beteiligung durch Degeneration präganglionärer sympathischer Neurone im Nucleus intermediolateralis und Onuf-Kern.' },
                        { term: 'Nächtlicher inspiratorischer Larynxstridor', category: 'Klinik', explanation: 'Gefährliche Stimmbandabduktionsparese (M. cricoarytaenoideus posterior) mit Risiko des plötzlichen nächtlichen Herztodes.' },
                        { term: 'Putaminale Randatrophie (T2-Randsaum)', category: 'Diagnostik', explanation: 'Typisches dorsolaterales T2-MRT-Korrelat der striatonigralen Degeneration beim parkinsonoiden Subtyp.' },
                        { term: 'Fludrocortison / Midodrin', category: 'Therapie', explanation: 'Symptomatische Volumensubstitution (Mineralokortikoid) und Alpha-1-Agonismus bei schwerer neurogener orthostatischer Hypotonie.' }
                    ]
                },
                {
                    disease_id: 'lbd',
                    name: 'Lewy-Körperchen-Demenz (LBD)',
                    icd10: 'G31.82',
                    color_accent: '#10b981',
                    clinical_pearl: 'Synukleinopathie mit der 1-Jahres-Regel (Demenz vor oder gleichzeitig mit Parkinsonismus), optischen Halluzinationen und extremer Neuroleptika-Sensitivität.',
                    cards: [
                        { term: 'Szenische optische Halluzinationen', category: 'Klinik', explanation: 'Detaillierte, oft wiederkehrende visuelle Trugwahrnehmungen (z.B. Personen oder Tiere im Raum) bereits im Frühstadium.' },
                        { term: 'Starke Fluktuationen der Vigilanz', category: 'Klinik', explanation: 'Ausgeprägte Tagesschwankungen zwischen nahezu luziden Phasen und starker Verwirrtheit oder Tagesmüdigkeit.' },
                        { term: 'Paradoxe Neuroleptika-Überempfindlichkeit', category: 'Therapie', explanation: 'Klassische D2-Rezeptorantagonisten (z.B. Haloperidol) können schwerste akinetische Krisen und ein malignes neuroleptisches Syndrom auslösen!' },
                        { term: 'REM-Schlaf-Verhaltensstörung (RBD)', category: 'Klinik', explanation: 'Fehlende physiologische Muskelatonie im REM-Schlaf mit motorischem Ausagieren von Träumen (oft Jahre vor Demenzbeginn).' },
                        { term: 'Erhalt des medialen Temporallappens', category: 'Diagnostik', explanation: 'Im cMRT wichtige strukturelle Abgrenzung zur Alzheimer-Demenz, welche frühzeitig eine Hippocampusatrophie zeigt.' },
                        { term: 'Rivastigmin (AChE-Hemmer)', category: 'Therapie', explanation: 'Durch das schwere kortikale cholinerge Defizit bessert die ChE-Hemmung sowohl Kognition als auch visuelle Halluzinationen.' }
                    ]
                },
                {
                    disease_id: 'cbd',
                    name: 'Kortikobasale Degeneration (CBD)',
                    icd10: 'G31.8',
                    color_accent: '#f59e0b',
                    clinical_pearl: 'Stark asymmetrische 4R-Tauopathie mit Kombination aus basalganglionären und kortikalen Funktionsstörungen.',
                    cards: [
                        { term: 'Alien-Limb-Phänomen (Fremde Hand)', category: 'Klinik', explanation: 'Unwillkürliche, scheinbar zweckgebundene autonome Bewegungen einer Extremität, die vom Patienten als fremd erlebt wird.' },
                        { term: 'Asymmetrische Apraxie & Dystonie', category: 'Klinik', explanation: 'Einseitiger Beginn mit Unfähigkeit, erlernte zweckgerichtete Bewegungen auszuführen, trotz intakter Primärmotorik.' },
                        { term: 'Astereognosie (kortikale Sensibilität ↓)', category: 'Klinik', explanation: 'Unfähigkeit, Gegenstände allein durch Betasten zu erkennen, infolge einer Beteiligung des somatosensorischen Parietalkortex.' },
                        { term: 'Asymmetrische frontoparietale Atrophie', category: 'Diagnostik', explanation: 'Im MRT streng kontralateral zur klinisch stärker betroffenen Körperseite betonte Hirnrindenverschmächtigung.' },
                        { term: 'Astrocytic Plaques & Ballonierte Neurone', category: 'Pathophysiologie', explanation: 'Charakteristisches histopathologisches Korrelat der 4R-Tau-Pathologie im frontoparietalen Kortex und Striatum.' },
                        { term: 'Kortikaler aktionsinduzierter Myoklonus', category: 'Klinik', explanation: 'Durch Berührung oder Willkürbewegung ausgelöstes, blitzartiges Muskelzucken der betroffenen Extremität.' }
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
                        { term: 'Dissoziierte Sensibilitätsstörung', category: 'Klinik', explanation: 'Bilaterales Erlöschen des Schmerz- und Temperaturempfindens (Tractus spinothalamicus) bei intaktem Lagesinn und Vibrationsempfinden (Hinterstränge).' },
                        { term: 'Eulenaugen-Zeichen (Snake-Eyes) im MRT', category: 'Diagnostik', explanation: 'Bilaterale punktförmige T2-Hyperintensität der metabolisch besonders vulnerablen Vorderhörner im axialen Schnittbild.' },
                        { term: 'Verlegung der A. radicularis magna', category: 'Pathophysiologie', explanation: 'Häufig durch ein Aortenaneurysma oder eine Aortendissektion ausgelöste Unterbrechung des wichtigsten thorakolumbalen Zuflusses (Adamkiewicz).' },
                        { term: 'Perakuter Schmerz & schlaffe Paraparese', category: 'Klinik', explanation: 'Schlagartiger Beginn innerhalb von Minuten mit initialem spinalem Schock (schlaffe Parese, Areflexie und Harnverhalt).' },
                        { term: 'Sofortiges Angio-CT Thorax/Abdomen', category: 'Diagnostik', explanation: 'Zwingender notfallmäßiger Ausschluss einer zugrundeliegenden Aortendissektion vor jeder gerinnungsaktiven Therapie.' }
                    ]
                },
                {
                    disease_id: 'nmosd',
                    name: 'NMOSD (Neuromyelitis-optica-Spektrum)',
                    icd10: 'G36.0',
                    color_accent: '#38bdf8',
                    clinical_pearl: 'Primäre Autoimmun-Astrozytopathie (AQP4-IgG) mit langstreckiger Myelitis und schwerer Optikusneuritis.',
                    cards: [
                        { term: 'LETM (Myelonläsion ≥ 3 Segmente)', category: 'Diagnostik', explanation: 'Longitudinale extensive transversale Myelitis, die sich im sagittalen Spinal-MRT zentral über 3 oder mehr Wirbelkörpersegmente erstreckt.' },
                        { term: 'Anti-Aquaporin-4-IgG (AQP4-Ak)', category: 'Diagnostik', explanation: 'Hochspezifischer Serum-Autoantikörper gegen Wasserkanäle auf den Astrozyten-Endfüßchen der Blut-Hirn-Schranke.' },
                        { term: 'CAVE: Interferon-beta triggert Schübe!', category: 'Therapie', explanation: 'Klassische MS-Basistherapeutika (Interferon-beta, Fingolimod, Natalizumab) führen zu fatalen Exazerbationen und sind kontraindiziert.' },
                        { term: 'Area-postrema-Syndrom (Singultus)', category: 'Klinik', explanation: 'Unstillbarer Schluckauf und Erbrechen durch Entzündung des Brechzentrums am Boden des 4. Ventrikels.' },
                        { term: 'Neutrophile Pleozytose meist OHNE OKB', category: 'Diagnostik', explanation: 'Im akuten Schub oft ausgeprägte Zellzahlerhöhung im Liquor bei typischerweise fehlenden oligoklonalen Banden.' }
                    ]
                },
                {
                    disease_id: 'funikulaere_myelose',
                    name: 'Funikuläre Myelose (Vitamin-B12-Mangel)',
                    icd10: 'E53.8',
                    color_accent: '#10b981',
                    clinical_pearl: 'Subakute kombinierte Degeneration der Hinterstränge und Pyramidenbahnen durch Cobalaminmangel oder Lachgas-Abusus.',
                    cards: [
                        { term: 'Umgekehrtes V-Zeichen dorsal im MRT', category: 'Diagnostik', explanation: 'Symmetrische dorsale T2-Hyperintensität der Hinterstränge (Fasciculus gracilis und cuneatus) im axialen Spinal-MRT.' },
                        { term: 'Lachgas (N2O) oxidiert Cobalt-Ion', category: 'Pathophysiologie', explanation: 'Inaktiviert die Methionin-Synthase und provoziert einen akuten funktionellen Substratmangel trotz oft noch normalem Gesamt-B12 im Serum.' },
                        { term: 'Methylmalonsäure (MMA) sensitiv ↑↑', category: 'Diagnostik', explanation: 'Hochsensitiver metabolischer Frühmarker eines intrazellulären Mangels, noch bevor eine megaloblastäre Anämie auftritt.' },
                        { term: 'Spinale Ataxie + Babinski + ASR ↓', category: 'Klinik', explanation: 'Klassische Trias aus Hinterstrangschädigung, Pyramidenbahnzeichen und gleichzeitiger peripherer Polyneuropathie.' },
                        { term: 'Parenterales Hydroxocobalamin', category: 'Therapie', explanation: 'Muss zwingend vor einer etwaigen Folsäure-Gabe erfolgen, um eine Dekompensation der neurologischen Symptomatik zu verhindern.' }
                    ]
                }
            ]
        }
    ];

    const SKILL_EXTRACTION_PROMPT = `# ROLLE & AUFGABE
Du bist ein medizinischer Facharzt, IMPP/SMPP-Prüfungsarchitekt und Senior Game-Designer für den Spielmodus "Solitaire Associations Journey" in MedCheck.
Deine Aufgabe: Extrahiere aus dem bereitgestellten medizinischen Fachtext / Vorlesungsskript / Leitlinientext ALLE relevanten Krankheitsbilder (Entitäten) und ihre zugehörigen klinischen Fakten zu 100 % vollständig in ein direkt spielbares, syntaktisch valides JSON-Kartendeck.

# 1. KRITISCHE TECHNISCHE REGELN (ZERO-TOLERANCE)
1. REINES ROHTEXT-JSON: Antworte AUSSCHLIESSLICH mit dem validen JSON-Objekt (Erstes Zeichen {, letztes Zeichen }). KEIN einleitender oder abschließender Text, KEINE Markdown-Codeblöcke, KEINE Kommentare.
2. STRIKTES ZITATIONS- & TAG-VERBOT: Verwende NIEMALS Zitationsmarker oder Tags wie [1], (Quelle: ...), <span> oder HTML-Fragmente. Alle Strings müssen reiner Plain-Text sein.
3. VOLLSTÄNDIGKEIT (100% EXTRACTION): Jedes im Quelltext behandelte Krankheitsbild (bzw. jede klinische Hauptentität/Subform) wird als eigenes Objekt im Array "diseases" angelegt (ideal: 4 bis 8 Krankheitsbilder pro Deck). Jedes Krankheitsbild erhält 5 bis 8 hochspezifische Begriffskarten im Array "cards".

# 2. SPIELKARTEN-ERGONOMIE (HOCHKANT-FORMAT 5:7)
Da die Karten im Spiel als rechteckige Hochkant-Spielkarten (Portrait-Ratio 5:7) dargestellt werden, gelten für das Feld "term" strikte Längenregeln:
- "term": Prägnanter klinischer Stichpunkt, Befund, Zeichen, Gen/Antikörper, Laborparameter oder Wirkstoff.
- LÄNGEN-LIMIT FÜR "term": Maximal 2 bis 6 Wörter (strikt max. 42 Zeichen!), damit der Begriff auf dem Hochkant-Kartenblatt perfekt lesbar zentriert sitzt.
- Alle ausführlichen Details, Grenzwerte, Dosierungen und Mechanismen gehören NICHT in "term", sondern zwingend in das Feld "explanation"!

# 3. STRIKTES ANTI-SPOILER-PROTOKOLL FÜR "explanation" (ⓘ BUTTON)
Auf jeder Spielkarte befindet sich oben rechts ein kleiner Info-Button (ⓘ), mit dem der Studierende vor dem Zuordnen mehr über den Begriff erfahren kann.
- ABSOLUTES SPOILER-VERBOT: Im Feld "explanation" einer Karte darf NIEMALS der Name des zugehörigen Krankheitsbildes ("name"), dessen Abkürzung (z.B. "PSP", "NMOSD", "MSA"), dessen direkter Eigenname oder ICD-10-Code genannt werden!
- STATTDESSEN: Erkläre in "explanation" (1 bis 2 dichte Sätze auf Staatsexamensniveau) präzise die zugrundeliegende Pathophysiologie, das anatomische Korrelat, den Rezeptor-/Wirkmechanismus oder die genaue klinische Bedeutung des Befundes, sodass der Studierende durch medizinisches Mitdenken selbst deduzieren kann, zu welchem Krankheitsbild die Karte gehört!

# 4. KATEGORIEN & FARBEN
- "category" jeder Karte MUSS exakt einer dieser 5 Werte sein:
  1. "Pathophysiologie" (Ätiologie, Genetik, Erreger, Molekularpathologie, Histologie)
  2. "Klinik" (Leitsymptome, klinische Zeichen, Red Flags, Verlauf)
  3. "Diagnostik" (Goldstandard, MRT/CT-Zeichen, Labor, Antikörper, Liquor, Funktionstests)
  4. "Therapie" (Erstlinientherapie, Notfallmanagement, spezifische Kontraindikationen / Cave)
  5. "Komplikation" (Prognose, spezifische Organkomplikationen, Spätfolgen)
- "color_accent": Vergib für jedes Krankheitsbild im Deck eine visuell gut unterscheidbare Hex-Akzentfarbe aus dieser Palette: "#38bdf8", "#a855f7", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6".

# 5. JSON-SCHEMA (EXAKTES TEMPLATE)
{
  "deck_id": "ddx_fachgebiet_thema_01",
  "title": "DDx: Prägnanter Titel des Kartendecks",
  "medical_field": "Fachgebiet (z.B. Neurologie, Innere Medizin, Kardiologie)",
  "difficulty": "Staatsexamen",
  "description": "1-2 Sätze zum differentialdiagnostischen Fokus dieses Decks.",
  "diseases": [
    {
      "disease_id": "eindeutige_kurz_id",
      "name": "Exakter Name des Krankheitsbildes",
      "icd10": "ICD-10 Code",
      "color_accent": "#38bdf8",
      "clinical_pearl": "Prägnante klinische Synthese / Merksatz (1-2 Sätze) zum gesamten Krankheitsbild.",
      "cards": [
        {
          "term": "Kompakter Begriff (max. 42 Zeichen)",
          "category": "Diagnostik",
          "explanation": "Spoilerfreie, tiefgehende pathophysiologische oder klinische Erklärung dieses Befundes (OHNE den Namen der Krankheit zu verraten!)."
        }
      ]
    }
  ]
}`;

    // ----------------------------------------------------------------------
    // 02. RUNTIME STATE & POINTER-DRAG STATE
    // ----------------------------------------------------------------------
    let currentViewMode = 'lobby';
    let activeDeck = null;
    let hardMode = false;
    let keyboardBound = false;
    let globalPointerBound = false;

    let gameState = {
        movesLeft: 0,
        maxMoves: 0,
        score: 0,
        comboStreak: 0,
        hintsLeft: 3,
        jokersLeft: 2,
        foundations: [null, null, null, null],
        completedDiseases: [],
        tableau: [[], [], [], []],
        stock: [],
        waste: [],
        selectedSource: null,
        hintHighlightIds: [],
        historyStack: [],
        lastSuccessAnim: null
    };

    // High-Precision Touch / Pointer Drag State (0ms Delay)
    let dragSession = {
        active: false,
        hasMoved: false,
        pointerId: null,
        sourceObj: null,
        originEl: null,
        originRect: null,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
        ghostEl: null,
        hoveredTarget: null, // { type: 'foundation' | 'tableau', index: number, el: HTMLElement }
        lastTapTime: 0,
        lastTapUid: null
    };

    const CATEGORY_COLORS = {
        'Pathophysiologie': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.16)', label: 'Patho', suit: '🧬' },
        'Klinik':           { color: '#10b981', bg: 'rgba(16, 185, 129, 0.16)', label: 'Klinik', suit: '🩺' },
        'Diagnostik':       { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.16)', label: 'Diag.',  suit: '🔬' },
        'Therapie':         { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)', label: 'Ther.',  suit: '💊' },
        'Komplikation':     { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)', label: 'Kompl.', suit: '⚡' }
    };

    const ACCENT_PALETTE = ['#38bdf8', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

    // ----------------------------------------------------------------------
    // 03. ANTI-SPOILER SANITIZER FÜR DEN ⓘ ZUSATZINFO-BUTTON
    // ----------------------------------------------------------------------
    function getSpoilerFreeExplanation(explanationText, diseaseName, icd10) {
        if (!explanationText) return 'Klinischer Befund im Rahmen der Differentialdiagnose.';
        let clean = String(explanationText);

        const allDiseases = activeDeck?.diseases || [];
        allDiseases.forEach(d => {
            const rawName = (d.name || '').trim();
            if (!rawName) return;

            const escapedFull = rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            clean = clean.replace(new RegExp(escapedFull, 'gi'), '[Gesuchte Entität]');

            const parts = rawName.split(/[\(\)\/–-]/).map(s => s.trim()).filter(s => s.length >= 3);
            parts.forEach(part => {
                const escapedPart = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                clean = clean.replace(new RegExp(`\\b${escapedPart}\\b`, 'gi'), '[Gesuchte Entität]');
            });
        });

        if (icd10 && icd10.length >= 3) {
            const escapedIcd = icd10.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            clean = clean.replace(new RegExp(escapedIcd, 'gi'), '[ICD-10]');
        }

        return clean;
    }

    function openCardInfoByUid(cardUid) {
        let foundCard = null;

        if (gameState.waste.length > 0 && gameState.waste[gameState.waste.length - 1].uid === cardUid) {
            foundCard = gameState.waste[gameState.waste.length - 1];
        }
        if (!foundCard) {
            for (const col of gameState.tableau) {
                const match = col.find(c => c.uid === cardUid);
                if (match && match.faceUp) {
                    foundCard = match;
                    break;
                }
            }
        }
        if (!foundCard) return;

        const modal = document.getElementById('sol-inspect-modal');
        const body = document.getElementById('sol-inspect-body');
        if (!modal || !body) return;

        if (foundCard.isCategoryCard) {
            const collected = foundCard.collectedTerms || [];
            body.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; border-bottom:1px solid var(--card-border); padding-bottom:10px; margin-bottom:12px;">
                    <div>
                        <span class="sol-crown-badge">👑 KATEGORIENKARTE • ${escapeHtml(foundCard.icd10 || 'DDx')}</span>
                        <h3 style="margin:6px 0 0 0; font-size:1.12rem; color:var(--text-main);">${escapeHtml(foundCard.diseaseName)}</h3>
                    </div>
                    <button type="button" class="action-btn secondary btn-sm" onclick="document.getElementById('sol-inspect-modal').style.display='none'">✕</button>
                </div>
                <div class="sm-callout-box sm-merke" style="margin:0 0 14px 0;">
                    <div class="sm-callout-header"><span class="sm-callout-badge">📘 Krankheitsbild-Charakteristik (Spoilerfrei)</span></div>
                    <div class="sm-callout-body">${escapeHtml(foundCard.clinicalPearl || 'Lege diese Kategorienkarte in einen freien Slot oben, um die zugehörigen Befunde darauf zu sammeln.')}</div>
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted);">
                    Bereits zugeordnete Karten in diesem Stapel: <strong>${collected.length} / ${foundCard.totalRequired}</strong>
                </div>
                ${collected.length > 0 ? `
                    <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px; max-height:35vh; overflow-y:auto;">
                        ${collected.map(t => `
                            <div style="padding:8px 10px; border-radius:8px; background:rgba(15,23,42,0.6); border:1px solid var(--card-border); font-size:0.8rem;">
                                <strong>${escapeHtml(t.term)}</strong> <span style="color:var(--text-dim);">(${escapeHtml(t.category)})</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;
        } else {
            const allCardsInBundle = [
                { term: foundCard.term, category: foundCard.category, explanation: foundCard.explanation },
                ...(foundCard.stackedCards || [])
            ];

            body.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; border-bottom:1px solid var(--card-border); padding-bottom:10px; margin-bottom:12px;">
                    <div>
                        <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--accent-cyan); letter-spacing:0.06em;">
                            ⓘ SPIELKARTEN-ZUSATZINFO (OHNE DIAGNOSE-SPOILER)
                        </div>
                        <h3 style="margin:4px 0 0 0; font-size:1.08rem; color:var(--text-main);">
                            ${allCardsInBundle.length > 1 ? `Gebündelter ${allCardsInBundle.length}er Spielkarten-Stack` : escapeHtml(foundCard.term)}
                        </h3>
                    </div>
                    <button type="button" class="action-btn secondary btn-sm" onclick="document.getElementById('sol-inspect-modal').style.display='none'">✕</button>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px; max-height:52vh; overflow-y:auto; padding-right:4px;">
                    ${allCardsInBundle.map((item, idx) => {
                        const catCfg = CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Klinik'];
                        const safeExpl = getSpoilerFreeExplanation(item.explanation, foundCard.diseaseName, '');
                        return `
                            <div style="background:rgba(15,23,42,0.65); border:1px solid var(--card-border); border-left:4px solid ${catCfg.color}; border-radius:10px; padding:12px 14px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
                                    <strong style="font-size:0.9rem; color:var(--text-main);">${catCfg.suit} ${idx + 1}. ${escapeHtml(item.term)}</strong>
                                    <span style="font-size:0.66rem; font-weight:800; padding:2px 8px; border-radius:999px; background:${catCfg.bg}; color:${catCfg.color};">
                                        ${escapeHtml(item.category)}
                                    </span>
                                </div>
                                <div style="font-size:0.83rem; color:var(--text-muted); line-height:1.55;">
                                    ${escapeHtml(safeExpl)}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div style="margin-top:14px; padding-top:10px; border-top:1px dashed var(--card-border); display:flex; justify-content:space-between; align-items:center; font-size:0.74rem; color:var(--text-dim);">
                    <span>🔒 Ziel-Erkrankung bleibt verdeckt, bis du die Karte zuordnest.</span>
                    <button type="button" class="action-btn btn-sm" onclick="document.getElementById('sol-inspect-modal').style.display='none'">Verstanden</button>
                </div>
            `;
        }

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
        modal.style.display = 'flex';
    }

    // ----------------------------------------------------------------------
    // 04. SOLITAIRE FX ENGINE (PARTIKEL, SHOCKWAVE & FLOATING TELEMETRY)
    // ----------------------------------------------------------------------
    function spawnMatchCelebrationFX(rect, accentColor = '#38bdf8', floatingLabel = '+Match!', isDiseaseComplete = false) {
        if (!rect) return;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const fxLayer = document.createElement('div');
        fxLayer.className = 'sol-fx-overlay-container';
        document.body.appendChild(fxLayer);

        const ring = document.createElement('div');
        ring.className = `sol-fx-shockwave ${isDiseaseComplete ? 'is-grand' : ''}`;
        ring.style.left = `${centerX}px`;
        ring.style.top = `${centerY}px`;
        ring.style.borderColor = accentColor;
        ring.style.boxShadow = `0 0 28px ${accentColor}, inset 0 0 14px ${accentColor}`;
        fxLayer.appendChild(ring);

        const particleCount = isDiseaseComplete ? 34 : 18;
        const colors = [accentColor, '#ffffff', '#38bdf8', '#10b981', '#facc15'];

        for (let i = 0; i < particleCount; i++) {
            const p = document.createElement('div');
            p.className = 'sol-fx-particle';
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
            const distance = (isDiseaseComplete ? 120 : 65) + Math.random() * 55;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance - (isDiseaseComplete ? 20 : 8);
            const size = (isDiseaseComplete ? 6 : 4.5) + Math.random() * 4;

            p.style.left = `${centerX}px`;
            p.style.top = `${centerY}px`;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.background = colors[i % colors.length];
            p.style.boxShadow = `0 0 10px ${colors[i % colors.length]}`;
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);
            fxLayer.appendChild(p);
        }

        const floater = document.createElement('div');
        floater.className = `sol-fx-floating-badge ${isDiseaseComplete ? 'is-grand' : ''}`;
        floater.style.left = `${centerX}px`;
        floater.style.top = `${Math.max(40, rect.top - 8)}px`;
        floater.style.borderColor = accentColor;
        floater.innerHTML = floatingLabel;
        fxLayer.appendChild(floater);

        setTimeout(() => {
            fxLayer.remove();
        }, 1200);
    }

    // ----------------------------------------------------------------------
    // 05. PERSISTENZ & DECK-HELPER
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
    // 06. AUTO-GENERATOR AUS VORHANDENEN APP-FÄLLEN
    // ----------------------------------------------------------------------
    function generateDecksFromExistingCases() {
        const registeredCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        if (!registeredCases.length) {
            alert('Keine Fälle zum Konvertieren gefunden.');
            return;
        }

        const diseasesMap = new Map();

        registeredCases.forEach(c => {
            const tasks = c.extra_tasks || {};
            const field = c.folder_name || c.metadata?.medical_field || 'Allgemein';

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
                            explanation: `Charakteristischer Aspekt der Dimension ${v.type || 'Klinik'} im Rahmen der Differentialdiagnose.`
                        });
                    }
                });
            }

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
                            explanation: `Spezifischer Untersuchungsbefund bzw. klinisches Phänomen zur Abgrenzung ähnlicher Entitäten.`
                        });
                    }
                });
            }
        });

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
            alert('Noch nicht genügend Falldaten (mind. 2 Krankheiten mit je ≥4 Begriffen) vorhanden.');
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
        renderView();
    }

    // ----------------------------------------------------------------------
    // 07. SMART ANTI-DEADLOCK DEAL-ALGORITHMUS & SPIELSTART
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

        const categoryCards = [];
        const termCards = [];

        activeDeck.diseases.forEach((disease, dIdx) => {
            const dId = disease.disease_id || `dis_${dIdx}`;
            const accent = disease.color_accent || ACCENT_PALETTE[dIdx % ACCENT_PALETTE.length];
            const totalTerms = (disease.cards || []).length;

            categoryCards.push({
                uid: `cat_${dId}`,
                isCategoryCard: true,
                diseaseId: dId,
                diseaseName: disease.name,
                icd10: disease.icd10 || '',
                accent: accent,
                clinicalPearl: disease.clinical_pearl || '',
                totalRequired: totalTerms,
                collectedTerms: [],
                faceUp: false
            });

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
                    stackedCards: [],
                    faceUp: false
                });
            });
        });

        const shuffledCats = shuffleArray(categoryCards);
        const shuffledTerms = shuffleArray(termCards);

        const guaranteedCats = shuffledCats.slice(0, 2);
        const remainingCats = shuffledCats.slice(2);
        const generalPool = shuffleArray([...remainingCats, ...shuffledTerms]);

        const numCols = 4;
        const tableau = [[], [], [], []];
        const totalCardsCount = categoryCards.length + termCards.length;
        const targetTableauCount = Math.min(generalPool.length, 12);

        for (let i = 0; i < targetTableauCount; i++) {
            const colIdx = i % numCols;
            const card = generalPool.shift();
            if (card) {
                card.faceUp = false;
                tableau[colIdx].push(card);
            }
        }

        const openCol = Math.floor(Math.random() * numCols);
        if (guaranteedCats[0]) {
            guaranteedCats[0].faceUp = true;
            tableau[openCol].push(guaranteedCats[0]);
        }

        tableau.forEach(col => {
            if (col.length > 0) {
                col[col.length - 1].faceUp = true;
            }
        });

        const stock = [...generalPool];
        if (guaranteedCats[1]) {
            const insertIdx = Math.min(stock.length, 1);
            stock.splice(insertIdx, 0, guaranteedCats[1]);
        }
        stock.forEach(c => { c.faceUp = false; });

        const calculatedMaxMoves = Math.ceil(totalCardsCount * 1.55) + 14;

        gameState = {
            movesLeft: calculatedMaxMoves,
            maxMoves: calculatedMaxMoves,
            score: 0,
            comboStreak: 0,
            hintsLeft: 3,
            jokersLeft: 2,
            foundations: [null, null, null, null],
            completedDiseases: [],
            tableau: tableau,
            stock: stock,
            waste: [],
            selectedSource: null,
            hintHighlightIds: [],
            historyStack: [],
            lastSuccessAnim: null
        };

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        renderView();
    }

    // ----------------------------------------------------------------------
    // 08. SNAPSHOT / UNDO & AUTO-FINISH CHECK
    // ----------------------------------------------------------------------
    function saveHistorySnapshot() {
        const snapshot = JSON.stringify({
            movesLeft: gameState.movesLeft,
            score: gameState.score,
            comboStreak: gameState.comboStreak,
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
        gameState.comboStreak = prev.comboStreak || 0;
        gameState.foundations = prev.foundations;
        gameState.completedDiseases = prev.completedDiseases;
        gameState.tableau = prev.tableau;
        gameState.stock = prev.stock;
        gameState.waste = prev.waste;
        gameState.selectedSource = null;
        gameState.hintHighlightIds = [];
        gameState.lastSuccessAnim = null;

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
        renderView();
    }

    function canAutoFinishGame() {
        if (gameState.stock.length > 0 || gameState.waste.length > 0) return false;
        const hasHiddenCard = gameState.tableau.some(col => col.some(c => !c.faceUp));
        const hasAnyTableauCard = gameState.tableau.some(col => col.length > 0);
        return !hasHiddenCard && hasAnyTableauCard;
    }

    function triggerAutoFinish() {
        if (!activeDeck) return;
        saveHistorySnapshot();

        activeDeck.diseases.forEach((d, idx) => {
            const dId = d.disease_id || `dis_${idx}`;
            const alreadyDone = gameState.completedDiseases.some(cd => cd.diseaseId === dId);
            if (!alreadyDone) {
                gameState.completedDiseases.push({
                    uid: `cat_${dId}`,
                    isCategoryCard: true,
                    diseaseId: dId,
                    diseaseName: d.name,
                    icd10: d.icd10 || '',
                    accent: d.color_accent || ACCENT_PALETTE[idx % ACCENT_PALETTE.length],
                    clinicalPearl: d.clinical_pearl || '',
                    totalRequired: (d.cards || []).length,
                    collectedTerms: (d.cards || []).map(c => ({
                        term: c.term,
                        category: c.category || 'Klinik',
                        explanation: c.explanation || ''
                    }))
                });
                gameState.score += 200;
            }
        });

        gameState.foundations = [null, null, null, null];
        gameState.tableau = [[], [], [], []];
        gameState.stock = [];
        gameState.waste = [];
        renderView();
        checkGameOverState();
    }

    // ----------------------------------------------------------------------
    // 09. SPIELZÜGE, OPTISCHES PRE-STACKING & VALIDIERUNG (OHNE FEHLER-ABZUG)
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
            return col[col.length - 1];
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
            if (col.length > 0 && !col[col.length - 1].faceUp) {
                col[col.length - 1].faceUp = true;
            }
            return removed;
        }
        return null;
    }

    function drawFromStock() {
        if (gameState.movesLeft <= 0) {
            checkGameOverState();
            return;
        }

        gameState.selectedSource = null;
        gameState.hintHighlightIds = [];
        gameState.lastSuccessAnim = null;

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

    function attemptMoveToFoundation(source, slotIdx) {
        const card = getPlayableCardFromSource(source);
        if (!card) return false;

        const targetSlot = gameState.foundations[slotIdx];
        const slotDom = document.querySelector(`[data-foundation-idx="${slotIdx}"]`);
        const targetRect = slotDom ? slotDom.getBoundingClientRect() : null;

        if (!targetSlot) {
            if (!card.isCategoryCard) {
                gameState.comboStreak = 0;
                triggerWrongMoveFeedback(
                    source,
                    `In einen freien Ziel-Slot oben muss zuerst eine <strong>Krankheitsbild-Spielkarte (👑)</strong> gelegt werden. <em>(Kein Move abgezogen)</em>`,
                    slotDom
                );
                return false;
            }

            saveHistorySnapshot();
            const movedCatCard = removeCardFromSource(source);
            gameState.foundations[slotIdx] = movedCatCard;
            gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
            gameState.comboStreak++;
            gameState.score += 50;
            gameState.selectedSource = null;
            gameState.hintHighlightIds = [];
            gameState.lastSuccessAnim = { type: 'foundation', targetIdx: slotIdx };

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);

            const wasCompletedImmediately = checkFoundationSlotCompletion(slotIdx, targetRect);
            if (!wasCompletedImmediately) {
                spawnMatchCelebrationFX(targetRect, movedCatCard.accent, `👑 ${escapeHtml(movedCatCard.diseaseName)} eröffnet!`, false);
            }

            renderView();
            showToast(`👑 <strong>${escapeHtml(movedCatCard.diseaseName)}</strong> freigeschaltet! Ordne nun die passenden Spielkarten zu.`, 'positive');
            checkGameOverState();
            return true;
        }

        if (card.isCategoryCard) {
            triggerWrongMoveFeedback(
                source,
                `Dieser Slot ist bereits durch <strong>${escapeHtml(targetSlot.diseaseName)}</strong> belegt. Wähle einen freien Ziel-Slot oben! <em>(Kein Move abgezogen)</em>`,
                slotDom
            );
            return false;
        }

        if (card.diseaseId !== targetSlot.diseaseId) {
            gameState.comboStreak = 0;
            if (typeof trackSkill === 'function') trackSkill('Diagnostik', false);
            triggerWrongMoveFeedback(
                source,
                `<strong>Differentialdiagnostischer Konflikt (Kein Move-Abzug):</strong> „${escapeHtml(card.term)}“ gehört <u>nicht</u> zu <strong>${escapeHtml(targetSlot.diseaseName)}</strong>. Klicke auf <strong>ⓘ</strong> oben rechts auf der Karte für Details!`,
                slotDom
            );
            return false;
        }

        saveHistorySnapshot();
        const movedTermCard = removeCardFromSource(source);

        const allTermsToAdd = [
            { term: movedTermCard.term, category: movedTermCard.category, explanation: movedTermCard.explanation },
            ...(movedTermCard.stackedCards || [])
        ];

        targetSlot.collectedTerms.push(...allTermsToAdd);
        gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
        gameState.comboStreak++;

        const comboMultiplier = gameState.comboStreak >= 3 ? 1.5 : 1;
        const earnedPts = Math.round(35 * allTermsToAdd.length * comboMultiplier);
        gameState.score += earnedPts;

        gameState.selectedSource = null;
        gameState.hintHighlightIds = [];
        gameState.lastSuccessAnim = { type: 'foundation', targetIdx: slotIdx };

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic([10, 30, 10]);
        if (typeof trackSkill === 'function') trackSkill('Diagnostik', true);
        if (typeof applyXpDelta === 'function') {
            applyXpDelta(15 * allTermsToAdd.length, allTermsToAdd.length > 1 ? `Stack +${allTermsToAdd.length}` : 'DDx-Match');
        }

        const wasCompleted = checkFoundationSlotCompletion(slotIdx, targetRect);
        if (!wasCompleted) {
            const badgeLabel = allTermsToAdd.length > 1
                ? `📚 +${allTermsToAdd.length} Stack-Match! (+${earnedPts})`
                : `✓ +${earnedPts} Pkt ${gameState.comboStreak >= 2 ? `🔥${gameState.comboStreak}x` : ''}`;
            spawnMatchCelebrationFX(targetRect, targetSlot.accent, badgeLabel, false);
        }

        renderView();

        if (!wasCompleted) {
            showToast(
                `✓ <strong>${escapeHtml(movedTermCard.term)}</strong> → ${escapeHtml(targetSlot.diseaseName)}: <em>${escapeHtml(movedTermCard.explanation || 'Korrekt zugeordnet.')}</em>`,
                'positive'
            );
        }

        checkGameOverState();
        return true;
    }

    function attemptMoveToTableauColumn(source, targetColIdx) {
        if (source.zone === 'tableau' && source.colIdx === targetColIdx) {
            gameState.selectedSource = null;
            renderView();
            return false;
        }

        const card = getPlayableCardFromSource(source);
        if (!card) return false;

        const targetCol = gameState.tableau[targetColIdx];
        const colDom = document.querySelector(`.sol-tableau-col[data-tableau-col="${targetColIdx}"]`);
        const lastCardInColDom = colDom ? colDom.querySelector('.sol-stacked-group:last-child, .sol-card:last-child') : null;
        const targetRect = (lastCardInColDom || colDom)?.getBoundingClientRect();

        if (targetCol.length === 0) {
            saveHistorySnapshot();
            const moved = removeCardFromSource(source);
            targetCol.push(moved);
            gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
            gameState.selectedSource = null;
            gameState.hintHighlightIds = [];
            gameState.lastSuccessAnim = { type: 'tableau', targetIdx: targetColIdx, uid: moved.uid };
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
            renderView();
            checkGameOverState();
            return true;
        }

        const topTargetCard = targetCol[targetCol.length - 1];

        if (topTargetCard.diseaseId === card.diseaseId) {
            if (topTargetCard.isCategoryCard && !card.isCategoryCard) {
                saveHistorySnapshot();
                const movedTerm = removeCardFromSource(source);
                const termsToMerge = [
                    { term: movedTerm.term, category: movedTerm.category, explanation: movedTerm.explanation },
                    ...(movedTerm.stackedCards || [])
                ];
                topTargetCard.collectedTerms.push(...termsToMerge);
                gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
                gameState.comboStreak++;
                gameState.score += 30 * termsToMerge.length;
                gameState.selectedSource = null;
                gameState.hintHighlightIds = [];
                gameState.lastSuccessAnim = { type: 'tableau', targetIdx: targetColIdx, uid: topTargetCard.uid };

                spawnMatchCelebrationFX(targetRect, topTargetCard.accent, `🔗 Pre-Stack (${topTargetCard.collectedTerms.length}/${topTargetCard.totalRequired})`, false);
                renderView();
                showToast(`🔗 <strong>${escapeHtml(movedTerm.term)}</strong> direkt an „${escapeHtml(topTargetCard.diseaseName)}“ gestapelt!`, 'positive');
                checkGameOverState();
                return true;
            }

            if (!topTargetCard.isCategoryCard && !card.isCategoryCard) {
                saveHistorySnapshot();
                const movedTerm = removeCardFromSource(source);
                topTargetCard.stackedCards = topTargetCard.stackedCards || [];
                topTargetCard.stackedCards.push(
                    { term: movedTerm.term, category: movedTerm.category, explanation: movedTerm.explanation },
                    ...(movedTerm.stackedCards || [])
                );
                gameState.movesLeft = Math.max(0, gameState.movesLeft - 1);
                gameState.comboStreak++;
                gameState.score += 30;
                gameState.selectedSource = null;
                gameState.hintHighlightIds = [];
                gameState.lastSuccessAnim = { type: 'tableau', targetIdx: targetColIdx, uid: topTargetCard.uid };

                if (typeof window.triggerHaptic === 'function') window.triggerHaptic([8, 25, 8]);
                const totalInStack = 1 + topTargetCard.stackedCards.length;
                spawnMatchCelebrationFX(targetRect, topTargetCard.accent, `📚 ${totalInStack}er DDx-Stack!`, false);
                renderView();
                showToast(`📚 <strong>Optischer ${totalInStack}er-Spielkarten-Stack gebildet!</strong> Klicke auf <strong>ⓘ</strong> oben rechts für alle Details.`, 'positive');
                checkGameOverState();
                return true;
            }

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
                gameState.comboStreak++;
                gameState.score += 35;
                gameState.selectedSource = null;
                gameState.hintHighlightIds = [];
                gameState.lastSuccessAnim = { type: 'tableau', targetIdx: targetColIdx, uid: movedCat.uid };

                spawnMatchCelebrationFX(targetRect, movedCat.accent, `👑 Stack übernommen!`, false);
                renderView();
                showToast(`👑 <strong>${escapeHtml(movedCat.diseaseName)}</strong> hat den Spielkarten-Stack im Tableau aufgenommen!`, 'positive');
                checkGameOverState();
                return true;
            }
        }

        gameState.comboStreak = 0;
        triggerWrongMoveFeedback(
            source,
            `<strong>Nicht kombinierbar (Kein Move-Abzug):</strong> Diese beiden Spielkarten gehören zu <u>unterschiedlichen Krankheitsbildern</u>. Nutze <strong>ⓘ</strong> oben rechts für Details!`,
            lastCardInColDom
        );
        return false;
    }

    // Sucht bei Doppel-Tap automatisch den besten Ziel-Slot oben oder einen Pre-Stack-Partner im Tableau
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
            // Falls die Krankheit oben noch nicht offen liegt: Prüfen, ob im Tableau eine passende Karte zum Pre-Stacken liegt!
            for (let cIdx = 0; cIdx < gameState.tableau.length; cIdx++) {
                if (source.zone === 'tableau' && source.colIdx === cIdx) continue;
                const col = gameState.tableau[cIdx];
                if (col.length > 0 && col[col.length - 1].diseaseId === card.diseaseId) {
                    return attemptMoveToTableauColumn(source, cIdx);
                }
            }
        }
        return false;
    }

    function checkFoundationSlotCompletion(slotIdx, targetRect) {
        const slot = gameState.foundations[slotIdx];
        if (!slot) return false;

        if (slot.collectedTerms.length >= slot.totalRequired) {
            const completedCopy = JSON.parse(JSON.stringify(slot));
            gameState.completedDiseases.push(completedCopy);
            gameState.foundations[slotIdx] = null;
            gameState.score += 250;

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic([20, 60, 30]);
            if (typeof applyXpDelta === 'function') {
                applyXpDelta(150, `${completedCopy.diseaseName} komplett!`);
            }

            spawnMatchCelebrationFX(targetRect, completedCopy.accent, `🏆 ${escapeHtml(completedCopy.diseaseName)} GEMEISTERT! (+150 XP)`, true);
            showToast(`🎉 <strong>${escapeHtml(completedCopy.diseaseName)} (${completedCopy.totalRequired}/${completedCopy.totalRequired})</strong> vollständig gelöst! Der Ziel-Slot ist wieder frei.`, 'positive');
            return true;
        }
        return false;
    }

    function checkGameOverState() {
        const totalDiseases = activeDeck?.diseases?.length || 0;
        if (gameState.completedDiseases.length >= totalDiseases && totalDiseases > 0) {
            const bonusScore = gameState.movesLeft * 25;
            gameState.score += bonusScore;
            recordDeckWin(activeDeck.deck_id, gameState.movesLeft, gameState.score);
            if (typeof applyXpDelta === 'function') {
                applyXpDelta(300, 'Solitaire Deck komplett gelöst!');
            }
            setTimeout(() => showVictoryModal(), 450);
            return;
        }

        if (gameState.movesLeft <= 0) {
            setTimeout(() => {
                if (window.confirm('Keine Züge (Moves) mehr übrig! Möchtest du kostenlos +10 Extra-Moves erhalten, um die Runde zu Ende zu bringen?')) {
                    gameState.movesLeft += 10;
                    renderView();
                } else {
                    startNewGame(activeDeck.deck_id);
                }
            }, 200);
        }
    }

    // ----------------------------------------------------------------------
    // 10. POWER-UPS: HINT & JOKER
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

        const hasFreeFoundation = gameState.foundations.some(s => s === null);
        if (hasFreeFoundation) {
            const catCandidate = playable.find(p => p.card.isCategoryCard);
            if (catCandidate) {
                gameState.hintsLeft--;
                gameState.hintHighlightIds = [catCandidate.card.uid];
                renderView();
                showToast(`💡 Tipp: Ziehe die Krankheitsbild-Spielkarte „${escapeHtml(catCandidate.card.diseaseName)}“ oben in einen freien Ziel-Slot!`, 'positive');
                return;
            }
        }

        for (const p of playable) {
            if (!p.card.isCategoryCard) {
                const matchSlot = gameState.foundations.find(s => s && s.diseaseId === p.card.diseaseId);
                if (matchSlot) {
                    gameState.hintsLeft--;
                    gameState.hintHighlightIds = [p.card.uid, matchSlot.uid];
                    renderView();
                    showToast(`💡 Tipp: „${escapeHtml(p.card.term)}“ passt zu <strong>${escapeHtml(matchSlot.diseaseName)}</strong> oben!`, 'positive');
                    return;
                }
            }
        }

        for (let i = 0; i < playable.length; i++) {
            for (let j = i + 1; j < playable.length; j++) {
                const a = playable[i];
                const b = playable[j];
                if (a.card.diseaseId === b.card.diseaseId && (a.zone === 'tableau' || b.zone === 'tableau')) {
                    gameState.hintsLeft--;
                    gameState.hintHighlightIds = [a.card.uid, b.card.uid];
                    renderView();
                    showToast(`💡 Pre-Stack-Tipp: Diese beiden markierten Spielkarten gehören zur selben Erkrankung und können im Tableau gestapelt werden!`, 'positive');
                    return;
                }
            }
        }

        showToast('💡 Aktuell kein direkter Match offen – tippe auf den Nachziehstapel oben links oder nutze eine freie Spalte!', 'neutral');
    }

    function useJoker() {
        if (gameState.jokersLeft <= 0) {
            showToast('Keine Joker mehr übrig.', 'neutral');
            return;
        }

        saveHistorySnapshot();
        gameState.jokersLeft--;

        let revealedCount = 0;
        gameState.tableau.forEach(col => {
            col.forEach(c => {
                if (!c.faceUp) {
                    c.faceUp = true;
                    revealedCount++;
                }
            });
        });

        const emptySlotIdx = gameState.foundations.findIndex(s => s === null);
        if (emptySlotIdx !== -1) {
            const stockCatIdx = gameState.stock.findIndex(c => c.isCategoryCard);
            if (stockCatIdx !== -1) {
                const [catCard] = gameState.stock.splice(stockCatIdx, 1);
                catCard.faceUp = true;
                gameState.foundations[emptySlotIdx] = catCard;
                gameState.lastSuccessAnim = { type: 'foundation', targetIdx: emptySlotIdx };
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(14);
                renderView();
                showToast(`🃏 Joker eingesetzt: „${escapeHtml(catCard.diseaseName)}“ direkt freigeschaltet!`, 'positive');
                return;
            }
        }

        renderView();
        if (revealedCount > 0) {
            showToast(`🃏 Joker eingesetzt: Alle verdeckten Spielkarten im Tableau aufgedeckt!`, 'positive');
        } else {
            gameState.movesLeft += 5;
            renderView();
            showToast(`🃏 Joker eingesetzt: +5 Extra-Moves erhalten!`, 'positive');
        }
    }

    // ----------------------------------------------------------------------
    // 11. UI FEEDBACK, DOSSIER-MODAL & LERN-DEPOT INTEGRATION
    // ----------------------------------------------------------------------
    function showToast(htmlMsg, type = 'neutral') {
        const banner = document.getElementById('sol-feedback-banner');
        if (!banner) return;
        banner.className = `sol-feedback-banner ${type}`;
        banner.innerHTML = htmlMsg;
        banner.style.display = 'flex';
    }

    function triggerWrongMoveFeedback(source, htmlReason, targetDomEl = null) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic([20, 40, 20]);
        const card = getPlayableCardFromSource(source);
        gameState.selectedSource = null;
        gameState.lastSuccessAnim = null;
        renderView();
        showToast(htmlReason, 'error');

        if (card) {
            const el = document.querySelector(`[data-card-uid="${card.uid}"]`);
            if (el) {
                el.classList.add('sol-card-shake');
                setTimeout(() => el.classList.remove('sol-card-shake'), 520);
            }
        }
        if (targetDomEl) {
            targetDomEl.classList.add('sol-card-shake');
            setTimeout(() => targetDomEl.classList.remove('sol-card-shake'), 520);
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
                        👑 Krankheitsbild-Dossier (${terms.length}/${diseaseSlotObj.totalRequired} Karten)
                    </div>
                    <h3 style="margin:4px 0 0 0; font-size:1.15rem; color:var(--text-main);">${escapeHtml(diseaseSlotObj.diseaseName)}</h3>
                </div>
                <button type="button" class="action-btn secondary btn-sm" onclick="document.getElementById('sol-inspect-modal').style.display='none'">✕</button>
            </div>

            ${diseaseSlotObj.clinicalPearl ? `
                <div class="sm-callout-box sm-pearl" style="margin:0 0 14px 0;">
                    <div class="sm-callout-header"><span class="sm-callout-badge">💡 Klinische Synthese</span></div>
                    <div class="sm-callout-body">${escapeHtml(diseaseSlotObj.clinicalPearl)}</div>
                </div>
            ` : ''}

            <div style="font-size:0.76rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">
                Zugeordnete Spielkarten & Pathophysiologie:
            </div>

            ${terms.length === 0 ? `
                <div style="padding:16px; text-align:center; color:var(--text-dim); border:1px dashed var(--card-border); border-radius:10px;">
                    Noch keine Begriffskarten auf diesem Krankheitsbild abgelegt.
                </div>
            ` : `
                <div style="display:flex; flex-direction:column; gap:8px; max-height:48vh; overflow-y:auto; padding-right:4px;">
                    ${terms.map(t => {
                        const catCfg = CATEGORY_COLORS[t.category] || CATEGORY_COLORS['Klinik'];
                        return `
                            <div style="background:rgba(15,23,42,0.6); border:1px solid var(--card-border); border-left:4px solid ${catCfg.color}; border-radius:10px; padding:10px 12px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
                                    <strong style="font-size:0.88rem; color:var(--text-main);">${catCfg.suit} ${escapeHtml(t.term)}</strong>
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <span style="font-size:0.65rem; font-weight:800; padding:2px 7px; border-radius:999px; background:${catCfg.bg}; color:${catCfg.color};">
                                            ${escapeHtml(t.category)}
                                        </span>
                                        <button type="button" class="fc-depot-pin-btn" onclick="window.SolitaireModule.pinTermToDepot('${escapeHtml(diseaseSlotObj.diseaseName).replace(/'/g, "\\'")}', '${escapeHtml(t.term).replace(/'/g, "\\'")}', '${escapeHtml(t.explanation).replace(/'/g, "\\'")}')" title="Direkt ins Lern-Depot pinnen">
                                            📌 Depot
                                        </button>
                                    </div>
                                </div>
                                <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.48;">
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
            showToast(`📌 „${escapeHtml(term)}“ im Lern-Depot gespeichert!`, 'positive');
        }
    }

    function showVictoryModal() {
        const modal = document.getElementById('sol-inspect-modal');
        const body = document.getElementById('sol-inspect-body');
        if (!modal || !body) return;

        body.innerHTML = `
            <div style="text-align:center; padding:12px 6px;">
                <div style="font-size:3rem; margin-bottom:6px;">🏆</div>
                <h3 style="font-size:1.35rem; color:var(--text-main); margin-bottom:6px;">Deck vollständig gemeistert!</h3>
                <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:16px;">
                    Du hast alle <strong>${gameState.completedDiseases.length} Krankheitsbilder</strong> differentialdiagnostisch perfekt zugeordnet.
                </p>
                <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap; margin-bottom:18px;">
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
    // 12. MANUELLER DECK-UPLOAD & SKILL-PROMPT EXPORT
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
                btnEl.innerHTML = '✓ Mega-Prompt kopiert!';
                setTimeout(() => { btnEl.innerHTML = orig; }, 2200);
            }
        } catch (_e) {
            alert('Kopieren fehlgeschlagen.');
        }
    }

    // ----------------------------------------------------------------------
    // 13. RENDERING: LOBBY & HOCHKANT-SPIELKARTEN-TISCH (5:7 PORTRAIT)
    // ----------------------------------------------------------------------
    function renderLobby(container) {
        container.classList.remove('sol-in-game-mode');
        const decks = getAllDecks();
        const stats = getDeckStats();

        container.innerHTML = `
            <div class="sol-lobby-wrapper">
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

                <div id="sol-upload-panel" class="sol-upload-panel hidden">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                        <div>
                            <div style="font-weight:800; font-size:0.92rem; color:var(--text-main);">📦 Krankheitskartendeck importieren (.json)</div>
                            <div style="font-size:0.76rem; color:var(--text-muted);">Ziehe eine JSON-Datei aus deinem Extraktions-Skill hierher oder füge den JSON-Code direkt ein.</div>
                        </div>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.SolitaireModule.copySkillMasterPrompt(this)">
                            📋 Skill Mega-Prompt & JSON-Schema kopieren
                        </button>
                    </div>

                    <div id="sol-file-dropzone" class="sol-file-dropzone">
                        <span>📂 <strong>JSON-Deckdatei hier ablegen</strong> oder klicken zum Durchsuchen</span>
                        <input type="file" id="sol-file-input" accept=".json" multiple style="display:none;">
                    </div>

                    <textarea id="sol-json-textarea" class="forge-textarea" style="height:130px; margin-top:10px; margin-bottom:10px;" placeholder='Oder JSON-Code des Kartendecks hier direkt einfügen...'></textarea>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.SolitaireModule.toggleUploadPanel()">Schließen</button>
                        <button type="button" class="action-btn btn-sm" onclick="window.SolitaireModule.handlePasteImport()">✓ Validieren & Deck speichern</button>
                    </div>
                </div>

                <div class="sol-rules-strip">
                    <div class="sol-rule-pill"><span>👑</span> <strong>Krankheitsbild-Karte</strong> oben in freien Slot ziehen</div>
                    <div class="sol-rule-pill"><span>ⓘ</span> <strong>Ecke oben rechts:</strong> Spoilerfreie Zusatzinfos öffnen</div>
                    <div class="sol-rule-pill"><span>📱</span> <strong>Direct-Touch:</strong> Sofortiges Ziehen ohne Wartezeit oder Doppeltipp!</div>
                </div>

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
                                    <h3 style="font-size:1.02rem; font-weight:800; color:var(--text-main); margin-bottom:6px;">${escapeHtml(deck.title)}</h3>
                                    <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.45; margin-bottom:12px;">
                                        ${escapeHtml(deck.description || '')}
                                    </p>
                                    <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:14px;">
                                        ${(deck.diseases || []).map(d => `
                                            <span style="font-size:0.66rem; font-weight:700; padding:2px 7px; border-radius:6px; background:rgba(255,255,255,0.05); border-left:3px solid ${d.color_accent || '#38bdf8'}; color:var(--text-main);">
                                                ${escapeHtml(d.name)} (${d.cards?.length || 0})
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px; border-top:1px solid var(--divider-color);">
                                    <span style="font-size:0.72rem; color:var(--text-dim); font-family:'JetBrains Mono', monospace;">
                                        ${deck.diseases?.length || 0} Diagnosen • ${totalTerms} Spielkarten
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

    // WICHTIG: Kein natives draggable="true" mehr! Unsere 0ms Pointer-Engine übernimmt Touch, Pencil & Maus verzögerungsfrei.
    function renderCardHtml(card, zone, colIdx, cardIdx, isPlayable) {
        const isSelected = gameState.selectedSource &&
            gameState.selectedSource.zone === zone &&
            gameState.selectedSource.colIdx === colIdx &&
            gameState.selectedSource.cardIdx === cardIdx;

        const isHinted = gameState.hintHighlightIds.includes(card.uid);
        const isJustMatched = gameState.lastSuccessAnim &&
            gameState.lastSuccessAnim.type === 'tableau' &&
            gameState.lastSuccessAnim.uid === card.uid;

        if (!card.faceUp) {
            return `
                <div class="sol-playing-card sol-card-back" data-card-uid="${card.uid}">
                    <div class="sol-card-back-inner">
                        <span class="sol-card-back-pip">✚</span>
                    </div>
                </div>
            `;
        }

        if (card.isCategoryCard) {
            const collected = card.collectedTerms || [];
            const collectedCount = collected.length;
            const visibleSlices = collected.slice(-3);
            const hiddenExtraCount = Math.max(0, collectedCount - visibleSlices.length);

            const peekingSlicesHtml = visibleSlices.map((subCard, sIdx) => {
                const subCatCfg = CATEGORY_COLORS[subCard.category] || CATEGORY_COLORS['Klinik'];
                return `
                    <div class="sol-stack-peek-slice" style="--slice-accent: ${card.accent}; --slice-index: ${sIdx};">
                        <span class="sol-peek-suit" style="color:${subCatCfg.color};">${subCatCfg.suit}</span>
                        <span class="sol-peek-term">${escapeHtml(subCard.term)}</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="sol-stacked-group ${collectedCount > 0 ? 'has-physical-stack' : ''} ${isPlayable ? 'is-playable' : 'is-covered-faceup'} ${isSelected ? 'is-selected' : ''} ${isHinted ? 'is-hinted' : ''} ${isJustMatched ? 'sol-anim-stack-snap' : ''}"
                     style="--disease-accent: ${card.accent};"
                     data-card-uid="${card.uid}"
                     data-zone="${zone}"
                     data-col="${colIdx}"
                     data-idx="${cardIdx}">
                    ${collectedCount > 0 ? `<div class="sol-stack-peeking-list">${peekingSlicesHtml}</div>` : ''}
                    <div class="sol-playing-card sol-card-category" title="${escapeHtml(card.diseaseName)}">
                        <div class="sol-card-corner-top">
                            <div class="sol-corner-pip-group">
                                <span class="sol-pip-symbol">👑</span>
                                <span class="sol-pip-label">${collectedCount}/${card.totalRequired}</span>
                            </div>
                            <span class="sol-collapsed-inline-title">${escapeHtml(card.diseaseName)}</span>
                            <div class="sol-card-corner-actions">
                                ${hiddenExtraCount > 0 ? `<span class="sol-prestack-badge">+${hiddenExtraCount}</span>` : ''}
                                <button type="button" class="sol-card-info-btn" data-info-uid="${card.uid}" title="Krankheitsbild-Info (ohne Spoiler)">ⓘ</button>
                            </div>
                        </div>

                        <div class="sol-card-center-art">
                            <div class="sol-card-watermark">👑</div>
                            <div class="sol-cat-kicker">KRANKHEITSBILD</div>
                            <div class="sol-cat-disease-title">${escapeHtml(card.diseaseName)}</div>
                        </div>

                        <div class="sol-card-corner-bottom">
                            <span class="sol-icd-tag">${escapeHtml(card.icd10 || 'DDx')}</span>
                            <span class="sol-pip-bottom-mirror">👑</span>
                        </div>
                    </div>
                </div>
            `;
        }

        const catCfg = CATEGORY_COLORS[card.category] || CATEGORY_COLORS['Klinik'];
        const subCards = card.stackedCards || [];
        const stackCount = 1 + subCards.length;
        const visibleSubCards = subCards.slice(-3);
        const hiddenSubCount = Math.max(0, subCards.length - visibleSubCards.length);

        const peekingTermsHtml = visibleSubCards.map((sub, sIdx) => {
            const subCat = CATEGORY_COLORS[sub.category] || CATEGORY_COLORS['Klinik'];
            return `
                <div class="sol-stack-peek-slice" style="--slice-accent: ${subCat.color}; --slice-index: ${sIdx};">
                    <span class="sol-peek-suit" style="color:${subCat.color};">${subCat.suit}</span>
                    <span class="sol-peek-term">${escapeHtml(sub.term)}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="sol-stacked-group ${stackCount > 1 ? 'has-physical-stack' : ''} ${isPlayable ? 'is-playable' : 'is-covered-faceup'} ${isSelected ? 'is-selected' : ''} ${isHinted ? 'is-hinted' : ''} ${isJustMatched ? 'sol-anim-stack-snap' : ''}"
                 style="--disease-accent: ${catCfg.color};"
                 data-card-uid="${card.uid}"
                 data-zone="${zone}"
                 data-col="${colIdx}"
                 data-idx="${cardIdx}">
                ${stackCount > 1 ? `<div class="sol-stack-peeking-list">${peekingTermsHtml}</div>` : ''}
                <div class="sol-playing-card sol-card-term" style="--suit-color: ${catCfg.color}; --suit-bg: ${catCfg.bg};" title="${escapeHtml(card.term)}">
                    <div class="sol-card-corner-top">
                        <div class="sol-corner-pip-group" style="color:${catCfg.color};">
                            <span class="sol-pip-symbol">${catCfg.suit}</span>
                            ${!hardMode ? `<span class="sol-pip-label">${escapeHtml(catCfg.label)}</span>` : ''}
                        </div>
                        <span class="sol-collapsed-inline-title">${escapeHtml(card.term)}</span>
                        <div class="sol-card-corner-actions">
                            ${stackCount > 1 ? `<span class="sol-prestack-badge" title="${stackCount} gestapelte Spielkarten">${stackCount}x${hiddenSubCount > 0 ? `+` : ''}</span>` : ''}
                            <button type="button" class="sol-card-info-btn" data-info-uid="${card.uid}" title="Zusatzinfo öffnen (ohne Spoiler)">ⓘ</button>
                        </div>
                    </div>

                    <div class="sol-card-center-art">
                        <div class="sol-card-watermark" style="color:${catCfg.color};">${catCfg.suit}</div>
                        <div class="sol-term-main-text">${escapeHtml(card.term)}</div>
                    </div>

                    <div class="sol-card-corner-bottom">
                        <span class="sol-suit-line" style="background:${catCfg.color};"></span>
                        <span class="sol-pip-bottom-mirror" style="color:${catCfg.color};">${catCfg.suit}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderGameBoard(container) {
        container.classList.add('sol-in-game-mode');
        const totalDiseases = activeDeck.diseases.length;
        const solvedDiseasesCount = gameState.completedDiseases.length;
        const topWasteCard = gameState.waste.length > 0 ? gameState.waste[gameState.waste.length - 1] : null;
        const showAutoFinish = canAutoFinishGame();

        container.innerHTML = `
            <div class="sol-game-wrapper">
                <!-- Kompakte Topbar -->
                <div class="sol-topbar">
                    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                        <button type="button" class="back-btn" style="padding:4px 10px; font-size:0.74rem;" onclick="window.SolitaireModule.backToLobby()">← Decks</button>
                        <div style="min-width:0;">
                            <div style="font-size:0.86rem; font-weight:800; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(activeDeck.title)}</div>
                            <div style="font-size:0.68rem; color:var(--text-muted);">
                                Gelöst: <strong>${solvedDiseasesCount}/${totalDiseases}</strong> • <em>Ziehen ohne Verzögerung oder 2x Tippen</em>
                            </div>
                        </div>
                    </div>

                    <div class="sol-hud-Controls">
                        ${showAutoFinish ? `
                            <button type="button" class="action-btn btn-sm" style="padding:4px 11px; font-size:0.74rem; background:linear-gradient(135deg,#10b981,#059669);" onclick="window.SolitaireModule.triggerAutoFinish()">
                                ⚡ Auto-Finish
                            </button>
                        ` : ''}
                        ${gameState.comboStreak >= 2 ? `
                            <div class="sol-combo-pill">🔥 ${gameState.comboStreak}x</div>
                        ` : ''}
                        <div class="sol-moves-pill ${gameState.movesLeft <= 8 ? 'critical' : ''}">
                            <span>MOVES</span>
                            <strong>${gameState.movesLeft}</strong>
                        </div>
                        <button type="button" class="sol-power-btn" onclick="window.SolitaireModule.undoLastMove()" ${gameState.historyStack.length === 0 ? 'disabled' : ''} title="Rückgängig (Shortcut: Z)">↩</button>
                        <button type="button" class="sol-power-btn" onclick="window.SolitaireModule.useHint()" title="Hinweis (Shortcut: H)">💡 ${gameState.hintsLeft}</button>
                        <button type="button" class="sol-power-btn" onclick="window.SolitaireModule.useJoker()" title="Joker einsetzen">🃏 ${gameState.jokersLeft}</button>
                        <button type="button" class="sol-power-btn ${hardMode ? 'active' : ''}" onclick="window.SolitaireModule.toggleHardMode()" title="Kategorie-Label ein-/ausblenden">🎓</button>
                        <button type="button" class="sol-power-btn" onclick="window.SolitaireModule.startNewGame('${activeDeck.deck_id}')" title="Neu mischen">🔄</button>
                    </div>
                </div>

                <!-- Kompaktes Feedback-Banner -->
                <div id="sol-feedback-banner" class="sol-feedback-banner" style="display:none;"></div>

                <!-- OBERE REIHE: 6 HOCHKANT-SPIELKARTEN-SLOTS -->
                <div class="sol-upper-table-row">
                    <div class="sol-card-slot-frame sol-stock-slot ${gameState.stock.length > 0 ? 'has-cards' : 'is-empty'}" onclick="window.SolitaireModule.drawFromStock()" title="Karte ziehen (Leertaste)">
                        ${gameState.stock.length > 0 ? `
                            <div class="sol-playing-card sol-card-back is-stock-deck">
                                <div class="sol-card-back-inner">
                                    <span class="sol-stock-count">${gameState.stock.length}</span>
                                    <span class="sol-stock-sub">ZIEHEN</span>
                                </div>
                            </div>
                        ` : `
                            <div class="sol-stock-empty-icon">
                                <span style="font-size:1.3rem;">↻</span>
                                <span>Neu wenden</span>
                            </div>
                        `}
                    </div>

                    <div class="sol-card-slot-frame sol-waste-slot">
                        ${topWasteCard ? renderCardHtml(topWasteCard, 'waste', 0, gameState.waste.length - 1, true) : `
                            <div class="sol-empty-card-outline">
                                <span>Ablage</span>
                            </div>
                        `}
                    </div>

                    <div class="sol-table-divider"></div>

                    <div class="sol-foundations-row">
                        ${gameState.foundations.map((slot, sIdx) => {
                            if (!slot) {
                                return `
                                    <div class="sol-card-slot-frame sol-foundation-slot is-empty-foundation" data-foundation-idx="${sIdx}">
                                        <div class="sol-foundation-crown-icon">👑</div>
                                        <div class="sol-foundation-empty-text">Krankheitsbild<br>hier ablegen</div>
                                    </div>
                                `;
                            }
                            const count = slot.collectedTerms.length;
                            const pct = Math.min(100, Math.round((count / slot.totalRequired) * 100));
                            const latestTerm = count > 0 ? slot.collectedTerms[count - 1] : null;
                            const isHinted = gameState.hintHighlightIds.includes(slot.uid);
                            const isJustMatched = gameState.lastSuccessAnim &&
                                gameState.lastSuccessAnim.type === 'foundation' &&
                                gameState.lastSuccessAnim.targetIdx === sIdx;

                            return `
                                <div class="sol-card-slot-frame sol-foundation-slot is-active-foundation ${isHinted ? 'is-hinted' : ''} ${isJustMatched ? 'sol-anim-match-pop' : ''}"
                                     style="--disease-accent: ${slot.accent};"
                                     data-foundation-idx="${sIdx}">
                                    <div class="sol-foundation-top">
                                        <span class="sol-foundation-badge" style="background:${slot.accent}; color:#060913;">
                                            👑 ${count}/${slot.totalRequired}
                                        </span>
                                        <button type="button" class="sol-card-info-btn" data-inspect-slot="${sIdx}" title="Krankheitsbild-Dossier öffnen">ⓘ</button>
                                    </div>

                                    <div class="sol-foundation-center">
                                        <div class="sol-foundation-title" title="${escapeHtml(slot.diseaseName)}">${escapeHtml(slot.diseaseName)}</div>
                                        <div class="sol-foundation-progress-track">
                                            <div class="sol-foundation-progress-fill" style="width:${pct}%; background:${slot.accent};"></div>
                                        </div>
                                    </div>

                                    <div class="sol-foundation-mini-stack">
                                        ${!latestTerm ? `
                                            <div class="sol-foundation-empty-sub">Karten zuordnen</div>
                                        ` : `
                                            <div class="sol-foundation-layered-card">
                                                <span>${(CATEGORY_COLORS[latestTerm.category] || CATEGORY_COLORS['Klinik']).suit}</span>
                                                <span class="sol-foundation-layered-text">${escapeHtml(latestTerm.term)}</span>
                                            </div>
                                        `}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Gelöste Krankheitsbilder Leiste -->
                ${gameState.completedDiseases.length > 0 ? `
                    <div class="sol-completed-strip">
                        <span style="font-size:0.66rem; font-weight:800; text-transform:uppercase; color:var(--color-symptom);">✓ Gemeistert:</span>
                        ${gameState.completedDiseases.map((cd, cIdx) => `
                            <button type="button" class="sol-completed-pill" onclick="window.SolitaireModule.inspectCompletedDisease(${cIdx})">
                                👑 ${escapeHtml(cd.diseaseName)}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- TABLEAU: 4 ZENTRIERTE HOCHKANT-KARTENSPALTEN -->
                <div class="sol-tableau-grid">
                    ${gameState.tableau.map((col, colIdx) => `
                        <div class="sol-tableau-col" data-tableau-col="${colIdx}">
                            ${col.length === 0 ? `
                                <div class="sol-card-slot-frame sol-tableau-empty-dropzone" data-tableau-col="${colIdx}">
                                    <span>Freier Slot</span>
                                </div>
                            ` : col.map((card, cardIdx) => {
                                const isBottomPlayable = (cardIdx === col.length - 1);
                                return renderCardHtml(card, 'tableau', colIdx, cardIdx, isBottomPlayable);
                            }).join('')}
                        </div>
                    `).join('')}
                </div>

                <!-- Inspect & Zusatzinfo Modal -->
                <div id="sol-inspect-modal" class="reveal-modal" style="display:none;" onclick="if(event.target === this) this.style.display='none'">
                    <div class="reveal-card" id="sol-inspect-body" style="max-width:560px;"></div>
                </div>
            </div>
        `;

        bindGameBoardEvents(container);
    }

    // ----------------------------------------------------------------------
    // 14. 0ms POINTER-DRAG & MAGNETIC DROP-SNAPPING ENGINE (HANDY, IPAD & DESKTOP)
    // ----------------------------------------------------------------------
    function clearMagneticTargetHighlights() {
        document.querySelectorAll('.sol-magnetic-target').forEach(el => {
            el.classList.remove('sol-magnetic-target');
        });
    }

    // Berechnet die Überlappungsfläche + Nähe zwischen dem gezogenen Karten-Rechteck und allen möglichen Ziel-Slots
    function findBestMagneticDropTarget(ghostRect, sourceObj) {
        const candidates = [];
        const magneticPadding = 26; // 26px magnetischer Fangradius rund um jeden Slot für müheloses Touch-Dropping!

        // 1. Alle 4 Foundation-Slots oben prüfen
        document.querySelectorAll('.sol-foundation-slot').forEach(slotEl => {
            const idx = parseInt(slotEl.dataset.foundationIdx, 10);
            const r = slotEl.getBoundingClientRect();
            candidates.push({ type: 'foundation', index: idx, el: slotEl, rect: r });
        });

        // 2. Alle 4 Tableau-Spalten unten prüfen (außer der eigenen Ausgangsspalte)
        document.querySelectorAll('.sol-tableau-col').forEach(colEl => {
            const idx = parseInt(colEl.dataset.tableauCol, 10);
            if (sourceObj.zone === 'tableau' && sourceObj.colIdx === idx) return;

            // Ziel-Rechteck ist entweder die unterste Karte in der Spalte oder die leere Dropzone
            const bottomTargetEl = colEl.querySelector('.sol-stacked-group:last-child, .sol-tableau-empty-dropzone') || colEl;
            const r = bottomTargetEl.getBoundingClientRect();
            candidates.push({ type: 'tableau', index: idx, el: colEl, rect: r });
        });

        let bestMatch = null;
        let highestScore = 0;

        const ghostCenterX = ghostRect.left + ghostRect.width / 2;
        const ghostCenterY = ghostRect.top + ghostRect.height / 2;

        candidates.forEach(cand => {
            const r = cand.rect;
            const expLeft = r.left - magneticPadding;
            const expRight = r.right + magneticPadding;
            const expTop = r.top - magneticPadding;
            const expBottom = r.bottom + magneticPadding;

            // Schnittfläche zwischen gezogener Karte und erweitertem Ziel-Rechteck berechnen
            const overlapX = Math.max(0, Math.min(ghostRect.right, expRight) - Math.max(ghostRect.left, expLeft));
            const overlapY = Math.max(0, Math.min(ghostRect.bottom, expBottom) - Math.max(ghostRect.top, expTop));
            const overlapArea = overlapX * overlapY;

            if (overlapArea > 0) {
                const targetCenterX = r.left + r.width / 2;
                const targetCenterY = r.top + r.height / 2;
                const dist = Math.hypot(ghostCenterX - targetCenterX, ghostCenterY - targetCenterY);
                const score = overlapArea - dist * 12;

                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = cand;
                }
            }
        });

        return bestMatch;
    }

    function createFloatingDragGhost(originEl, rect) {
        const ghost = originEl.cloneNode(true);
        ghost.className = originEl.className + ' sol-drag-ghost-floating';
        ghost.classList.remove('is-selected', 'sol-anim-stack-snap');
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.left = '0px';
        ghost.style.top = '0px';
        ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) scale(1.06) rotate(2deg)`;
        document.body.appendChild(ghost);
        return ghost;
    }

    function animateGhostSpringBack(ghostEl, originRect, onComplete) {
        if (!ghostEl || !originRect) {
            if (onComplete) onComplete();
            return;
        }
        ghostEl.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease';
        ghostEl.style.transform = `translate3d(${originRect.left}px, ${originRect.top}px, 0) scale(1) rotate(0deg)`;
        setTimeout(() => {
            ghostEl.remove();
            if (onComplete) onComplete();
        }, 220);
    }

    function initGlobalPointerDragListeners() {
        if (globalPointerBound) return;
        globalPointerBound = true;

        window.addEventListener('pointermove', (e) => {
            if (!dragSession.active || e.pointerId !== dragSession.pointerId) return;

            const dx = e.clientX - dragSession.startX;
            const dy = e.clientY - dragSession.startY;

            // Sofort-Start ab 5px Fingerbewegung (0ms Long-Press Delay!)
            if (!dragSession.hasMoved) {
                if (Math.hypot(dx, dy) < 5) return;
                dragSession.hasMoved = true;

                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);

                dragSession.ghostEl = createFloatingDragGhost(dragSession.originEl, dragSession.originRect);
                dragSession.originEl.classList.add('is-dragging-source');
                document.body.classList.add('sol-touch-dragging');
            }

            e.preventDefault();

            const newLeft = e.clientX - dragSession.offsetX;
            const newTop = e.clientY - dragSession.offsetY;

            if (dragSession.ghostEl) {
                dragSession.ghostEl.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0) scale(1.06) rotate(2deg)`;
            }

            // Magnetisches Ziel-Snapping anhand des aktuellen Karten-Rechtecks
            const currentGhostRect = {
                left: newLeft,
                top: newTop,
                right: newLeft + dragSession.originRect.width,
                bottom: newTop + dragSession.originRect.height,
                width: dragSession.originRect.width,
                height: dragSession.originRect.height
            };

            const bestTarget = findBestMagneticDropTarget(currentGhostRect, dragSession.sourceObj);
            clearMagneticTargetHighlights();

            if (bestTarget && bestTarget.el) {
                bestTarget.el.classList.add('sol-magnetic-target');
                dragSession.hoveredTarget = bestTarget;
            } else {
                dragSession.hoveredTarget = null;
            }
        }, { passive: false });

        const finishPointerSession = (e, isCancel = false) => {
            if (!dragSession.active || (e && e.pointerId !== dragSession.pointerId)) return;

            const wasDragging = dragSession.hasMoved;
            const sourceObj = dragSession.sourceObj;
            const target = dragSession.hoveredTarget;
            const ghostEl = dragSession.ghostEl;
            const originEl = dragSession.originEl;
            const originRect = dragSession.originRect;
            const cardUid = originEl?.dataset?.cardUid;

            dragSession.active = false;
            dragSession.hasMoved = false;
            dragSession.pointerId = null;
            dragSession.hoveredTarget = null;

            clearMagneticTargetHighlights();
            document.body.classList.remove('sol-touch-dragging');

            if (wasDragging && !isCancel) {
                // FALL A: Der Nutzer hat die Karte gezogen und über einem magnetischen Ziel losgelassen
                if (target) {
                    if (ghostEl) ghostEl.remove();
                    if (originEl) originEl.classList.remove('is-dragging-source');

                    let moveSucceeded = false;
                    if (target.type === 'foundation') {
                        moveSucceeded = attemptMoveToFoundation(sourceObj, target.index);
                    } else if (target.type === 'tableau') {
                        moveSucceeded = attemptMoveToTableauColumn(sourceObj, target.index);
                    }
                    return;
                }

                // Kein Ziel getroffen -> Karte gleitet sanft an ihren Ursprung zurück
                animateGhostSpringBack(ghostEl, originRect, () => {
                    if (originEl) originEl.classList.remove('is-dragging-source');
                });
                return;
            }

            if (ghostEl) ghostEl.remove();
            if (originEl) originEl.classList.remove('is-dragging-source');

            if (isCancel) return;

            // FALL B: Kurzer Tap / Klick ohne Ziehen (< 5px Bewegung)
            const now = Date.now();
            const isDoubleTap = (cardUid && dragSession.lastTapUid === cardUid && (now - dragSession.lastTapTime) < 380);
            dragSession.lastTapTime = now;
            dragSession.lastTapUid = cardUid;

            if (isDoubleTap) {
                // Doppeltipp -> Sofortiger Auto-Move nach oben oder zum passenden Pre-Stack!
                if (attemptAutoMoveCard(sourceObj)) return;
            }

            // Wenn bereits eine andere Karte ausgewählt war und man auf diese Tableau-Karte tippt -> Pre-Stacking versuchen!
            if (gameState.selectedSource && sourceObj.zone === 'tableau') {
                const isSameCard = gameState.selectedSource.zone === sourceObj.zone &&
                                   gameState.selectedSource.colIdx === sourceObj.colIdx &&
                                   gameState.selectedSource.cardIdx === sourceObj.cardIdx;
                if (isSameCard) {
                    // Zweiter Tipp auf bereits ausgewählte Karte versucht ebenfalls zuerst Auto-Move!
                    if (!attemptAutoMoveCard(sourceObj)) {
                        gameState.selectedSource = null;
                        gameState.lastSuccessAnim = null;
                        renderView();
                    }
                    return;
                }
                attemptMoveToTableauColumn(gameState.selectedSource, sourceObj.colIdx);
                return;
            }

            if (gameState.selectedSource && sourceObj.zone === 'waste') {
                const isSameWaste = gameState.selectedSource.zone === 'waste';
                if (isSameWaste) {
                    if (!attemptAutoMoveCard(sourceObj)) {
                        gameState.selectedSource = null;
                        renderView();
                    }
                    return;
                }
            }

            gameState.selectedSource = sourceObj;
            gameState.lastSuccessAnim = null;
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
            renderView();
        };

        window.addEventListener('pointerup', (e) => finishPointerSession(e, false));
        window.addEventListener('pointercancel', (e) => finishPointerSession(e, true));
    }

    function initKeyboardShortcuts() {
        if (keyboardBound) return;
        keyboardBound = true;

        document.addEventListener('keydown', (e) => {
            const solView = document.getElementById('solitaire-view');
            if (!solView || solView.style.display === 'none' || currentViewMode !== 'game') return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space') {
                e.preventDefault();
                drawFromStock();
            } else if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undoLastMove();
            } else if (e.key.toLowerCase() === 'h') {
                e.preventDefault();
                useHint();
            }
        });
    }

    function bindGameBoardEvents(container) {
        initKeyboardShortcuts();
        initGlobalPointerDragListeners();

        // 1. ⓘ Zusatzinfo-Buttons (stoppen PointerDown & Click sofort, damit kein Drag startet)
        container.querySelectorAll('[data-info-uid]').forEach(infoBtn => {
            infoBtn.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
            });
            infoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openCardInfoByUid(infoBtn.dataset.infoUid);
            });
        });

        // 2. Spielbare Karten / Stacks -> Sofortige 0ms PointerDown-Registrierung
        const playableNodes = container.querySelectorAll('.sol-stacked-group.is-playable');
        playableNodes.forEach(nodeEl => {
            const zone = nodeEl.dataset.zone;
            const colIdx = parseInt(nodeEl.dataset.col, 10);
            const cardIdx = parseInt(nodeEl.dataset.idx, 10);
            const sourceObj = { zone, colIdx, cardIdx };

            // Verhindert das iOS/iPadOS Long-Press-Kontextmenü komplett
            nodeEl.addEventListener('contextmenu', (e) => e.preventDefault());

            nodeEl.addEventListener('pointerdown', (e) => {
                if (e.target.closest('[data-info-uid]')) return;
                if (e.button !== undefined && e.button !== 0) return; // Nur Primärklick / Touch

                e.preventDefault();
                e.stopPropagation();

                const rect = nodeEl.getBoundingClientRect();
                dragSession.active = true;
                dragSession.hasMoved = false;
                dragSession.pointerId = e.pointerId;
                dragSession.sourceObj = sourceObj;
                dragSession.originEl = nodeEl;
                dragSession.originRect = rect;
                dragSession.startX = e.clientX;
                dragSession.startY = e.clientY;
                dragSession.offsetX = e.clientX - rect.left;
                dragSession.offsetY = e.clientY - rect.top;
                dragSession.ghostEl = null;
                dragSession.hoveredTarget = null;
            });
        });

        // 3. Foundation-Slots oben (für Tap-to-Move & Dossier-Klick)
        const foundationSlots = container.querySelectorAll('.sol-foundation-slot');
        foundationSlots.forEach(slotEl => {
            const slotIdx = parseInt(slotEl.dataset.foundationIdx, 10);

            const inspectBtn = slotEl.querySelector('[data-inspect-slot]');
            if (inspectBtn) {
                inspectBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
                inspectBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openDiseaseInspectModal(gameState.foundations[slotIdx]);
                });
            }

            slotEl.addEventListener('click', () => {
                if (gameState.selectedSource) {
                    attemptMoveToFoundation(gameState.selectedSource, slotIdx);
                } else if (gameState.foundations[slotIdx]) {
                    openDiseaseInspectModal(gameState.foundations[slotIdx]);
                }
            });
        });

        // 4. Leere Tableau-Spalten (für Tap-to-Move)
        const tableauCols = container.querySelectorAll('.sol-tableau-col');
        tableauCols.forEach(colEl => {
            const targetColIdx = parseInt(colEl.dataset.tableauCol, 10);
            colEl.addEventListener('click', () => {
                if (gameState.selectedSource && gameState.tableau[targetColIdx].length === 0) {
                    attemptMoveToTableauColumn(gameState.selectedSource, targetColIdx);
                }
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
        triggerAutoFinish,
        openCardInfoByUid,
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
