/* ==========================================================================
   MEDCHECK – SOLITAIRE ASSOCIATIONS JOURNEY MODULE V4.1 (js/solitaire.js)
   ==========================================================================
   FEATURES V4.1 (IM ORIGINALEN V3.3+ DESIGN):
   01. 100% Originaler V3.3+ Style (5:7 Hochkant-Spielkarten, 👑/🧬/🩺/🔬/💊/⚡ Icons)
   02. Klassische Solitaire-Treppenform im unteren Tableau:
       Links kleinster Stapel (Deck 1 = 1 Karte) bis rechts größter Stapel
       (Deck 6 = 6 Karten: 5 verdeckt + 1 offen).
   03. Dashboard-Ordner-Architektur (Überordner & Unterordner inkl. Drag & Drop,
       ✏️ Umbenennen, 🗑️ Löschen, ⇄ Verschieben & Supabase-Cloud-Sync)
   04. Modus "🎲 Zufälliges Deck ziehen" (Global über alle Decks oder pro Ordner)
   05. Modus "🔀 Kategorien-Mixer" (Mischt Krankheitsbilder quer über Decks hinweg):
       - Einfach:   mind. 35 Karten (35–42 Karten, ~5–6 Krankheitsbilder)
       - Mittel:    ca. 50 Karten   (48–56 Karten, ~7–8 Krankheitsbilder)
       - Schwierig: bis 70 Karten   (64–70 Karten, ~10–11 Krankheitsbilder)
   06. NEUE REGEL: Auf Krankheitsbild-Karten (👑) kann in den 6 unteren Stapeln
       NICHTS abgelegt werden. Oben in den 4 Ziel-Slots muss die Krankheitsbild-
       Karte zwingend zuunterst liegen, bevor Begriffe darauf gesammelt werden.
   ========================================================================== */

const SolitaireModule = (() => {
    const STORAGE_DECKS_KEY = 'medcheck_solitaire_custom_decks_v1';
    const STORAGE_STATS_KEY = 'medcheck_solitaire_stats_v1';
    const STORAGE_HIDDEN_CLOUD_DECKS_KEY = 'medcheck_solitaire_hidden_cloud_v1';
    const STORAGE_SOL_FOLDERS_KEY = 'medcheck_solitaire_folders_v1';
    const STORAGE_SOL_DECK_FOLDER_MAP_KEY = 'medcheck_solitaire_deck_folder_map_v1';
    const STORAGE_SOL_FOLDER_SUPER_MAP_KEY = 'medcheck_solitaire_folder_super_map_v1';

    const CLOUD_DECK_PREFIX = '__SOL_DECK__';
    const CLOUD_DECK_FIELD = '__SOLITAIRE_DECK__';

    const FOUNDATION_SLOTS_COUNT = 4; // 4 Ziel-Slots oben für Krankheitsbilder
    const TABLEAU_COLS_COUNT = 6;     // 6 Kartendecks (Spalten) unten im Tableau

    // Set mit allen deck_ids, die aktuell live in der Supabase-Cloud stehen
    let cloudPublishedDeckIds = new Set();
    let isSyncingCloud = false;

    // Ordner-UI States (synchron zum Dashboard in app.js)
    let solSuperFolderStates = {};
    let solSubFolderStates = {};
    let draggedSolDeckId = null;
    let draggedSolSubFolder = null;
    let solSearchQuery = '';

    // Mixer-Konfiguration
    let mixerConfig = {
        difficulty: 'easy', // 'easy' (35-42) | 'medium' (48-56) | 'hard' (64-70)
        sourceScope: 'ALL'  // 'ALL' | 'CUSTOM_ONLY' | 'SUPER:<name>' | 'FOLDER:<name>'
    };

    const MIXER_PRESETS = {
        easy:   { id: 'easy',   label: 'Einfach (≥ 35 Karten)',     minCards: 35, targetCards: 38, maxCards: 43, desc: '5–6 zufällige Krankheitsbilder • Mindestens 35 Spielkarten' },
        medium: { id: 'medium', label: 'Mittel (~ 50 Karten)',      minCards: 46, targetCards: 52, maxCards: 57, desc: '7–8 zufällige Krankheitsbilder • Klinisches Dienst-Niveau' },
        hard:   { id: 'hard',   label: 'Schwierig (bis 70 Karten)', minCards: 62, targetCards: 68, maxCards: 70, desc: '10–11 Krankheitsbilder im Marathon • Bis zu 70 Spielkarten' }
    };

    // ----------------------------------------------------------------------
    // 01. INTEGRIERTE STAATSEXAMENS-DEMODECKS (INKL. RESERVE-POOL FÜR 70 KARTEN)
    // ----------------------------------------------------------------------
    const BUILTIN_DECKS = [
        {
            deck_id: 'builtin_ddx_neuro_degen_01',
            title: 'DDx: Atypische Parkinson-Syndrome & Demenzen',
            medical_field: 'Neurologie',
            folder_name: 'Neurologie',
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
            folder_name: 'Neurologie',
            difficulty: 'Staatsexamen',
            description: 'Triage und Differenzierung vaskulärer, autoimmun-entzündlicher, metabolischer und kompressiver Rückenmarksläsionen.',
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
                },
                {
                    disease_id: 'spinaler_epiduralabszess',
                    name: 'Spinaler Epiduralabszess (SEA)',
                    icd10: 'G06.1',
                    color_accent: '#f59e0b',
                    clinical_pearl: 'Neurochirurgischer Notfall (meist S. aureus) mit klassischer Trias aus lokalem Rückenschmerz, Fieber und progredientem neurologischem Defizit.',
                    cards: [
                        { term: 'Trias: Klopfschmerz + Fieber + Parese', category: 'Klinik', explanation: 'Typische klinische Befundkonstellation bei raumfordernder Eiteransammlung zwischen Dura mater und Wirbelperiost.' },
                        { term: 'Staphylococcus aureus (häufigster Erreger)', category: 'Pathophysiologie', explanation: 'Hämatogene Streuung (z.B. bei i.v.-Drogenabusus, Endokarditis) oderFortleitung einer Spondylodiszitis.' },
                        { term: 'Ringförmiges KM-Enhancement epidural', category: 'Diagnostik', explanation: 'Beweisender Befund im Kontrastmittel-MRT der gesamten Wirbelsäule mit Kompression des Duralsacks.' },
                        { term: 'CAVE: Keine LP durch infiziertes Gewebe!', category: 'Komplikation', explanation: 'Eine Lumbalpunktion auf Höhe der Läsion birgt das hohe Risiko einer iatrogenen Keimverschleppung in den Subarachnoidalraum.' },
                        { term: 'Notfall-Laminektomie + i.v.-Antibiose', category: 'Therapie', explanation: 'Sofortige chirurgische Dekompression innerhalb weniger Stunden kombiniert mit kalkulierter bakterizider Antibiotikatherapie.' }
                    ]
                }
            ]
        },
        {
            deck_id: 'builtin_ddx_neuro_autoimmun_03',
            title: 'DDx: Neuromuskuläre & ZNS-Autoimmunsyndrome',
            medical_field: 'Neurologie',
            folder_name: 'Neurologie',
            difficulty: 'Staatsexamen',
            description: 'Abgrenzung von Myasthenia gravis, Lambert-Eaton-Syndrom, Guillain-Barré-Syndrom und Creutzfeldt-Jakob-Erkrankung.',
            is_builtin: true,
            diseases: [
                {
                    disease_id: 'myasthenia_gravis',
                    name: 'Myasthenia gravis (MG)',
                    icd10: 'G70.0',
                    color_accent: '#ec4899',
                    clinical_pearl: 'Postsynaptische Autoimmunerkrankung gegen ACh-Rezeptoren oder MuSK mit belastungsabhängiger Ermüdbarkeit.',
                    cards: [
                        { term: 'Dekrement in der 3-Hz-Serienstimulation', category: 'Diagnostik', explanation: 'Elektrophysiologischer Amplitudenabfall des Summenmuskelaktionspotentials um mehr als 10 Prozent bei repetitiver Reizung.' },
                        { term: 'Postsynaptische Anti-AChR- / Anti-MuSK-Ak', category: 'Pathophysiologie', explanation: 'Komplementvermittelte Zerstörung und Internalisierung nikotinerger Acetylcholinrezeptoren an der motorischen Endplatte.' },
                        { term: 'Positiver Simpson-Test & Ice-Pack-Test', category: 'Diagnostik', explanation: 'Zunahme der Ptosis beim Aufwärtsblicken für 60 Sekunden; Besserung durch lokale Kühlung infolge reduzierter Cholinesterase-Aktivität.' },
                        { term: 'Thymushyperplasie / Thymom-Assoziation', category: 'Pathophysiologie', explanation: 'Zwingende Schnittbildgebung des vorderen Mediastinums (CT-Thorax) bei Erstdiagnose.' },
                        { term: 'Pyridostigmin + Thymektomie / Steroide', category: 'Therapie', explanation: 'Symptomatische Hemmung des synaptischen ACh-Abbaus kombiniert mit kausaler Immunsuppression.' },
                        { term: 'CAVE: Aminoglykoside & Fluorchinolone!', category: 'Komplikation', explanation: 'Bestimmte Antibiotika, Magnesium und Betablocker können eine lebensbedrohliche myasthene Krise triggern.' }
                    ]
                },
                {
                    disease_id: 'lems',
                    name: 'Lambert-Eaton-Myasthenie-Syndrom (LEMS)',
                    icd10: 'G73.1',
                    color_accent: '#6366f1',
                    clinical_pearl: 'Präsynaptische paraneoplastische Autoimmunerkrankung (v.a. SCLC) gegen spannungsabhängige P/Q-Calciumkanäle.',
                    cards: [
                        { term: 'Präsynaptische Anti-VGCC-Antikörper (P/Q)', category: 'Pathophysiologie', explanation: 'Autoantikörper blockieren den Calciumeinstrom in die präsynaptische Nervenendigung und reduzieren die ACh-Vesikelfreisetzung.' },
                        { term: 'Inkrement (>60%) nach Maximalinnervation', category: 'Diagnostik', explanation: 'Deutliche Amplitudenzunahme (Fazilitierung) bei hochfrequenter 20–50 Hz Stimulation durch präsynaptische Calcium-Akkumulation.' },
                        { term: 'Lambert-Zeichen (Händedruck wird stärker)', category: 'Klinik', explanation: 'Initial abgeschwächte Muskelkraft und Eigenreflexe nehmen nach kurzer maximaler Willkürkontraktion vorübergehend zu.' },
                        { term: 'Assoziation mit kleinzelligem Bronchial-Ca', category: 'Pathophysiologie', explanation: 'In über 50 Prozent der Fälle paraneoplastische Erstmanifestation eines SCLC (neuroendokriner Tumor).' },
                        { term: 'Autonome Mundtrockenheit & Hyporeflexie', category: 'Klinik', explanation: 'Cholinerges autonomes Defizit kombiniert mit proximal betonter Beinschwäche.' },
                        { term: 'Amifampridin (3,4-Diaminopyridin)', category: 'Therapie', explanation: 'Blockiert präsynaptische Kaliumkanäle, verlängert das Aktionspotential und erhöht so den Calciumeinstrom.' }
                    ]
                },
                {
                    disease_id: 'gbs_aidp',
                    name: 'Guillain-Barré-Syndrom (AIDP)',
                    icd10: 'G61.0',
                    color_accent: '#14b8a6',
                    clinical_pearl: 'Akute postinfektiöse entzündliche Polyradikuloneuropathie mit aufsteigenden schlaffen Paresen und autonomer Instabilität.',
                    cards: [
                        { term: 'Zytalbuminäre Dissoziation im Liquor', category: 'Diagnostik', explanation: 'Stark erhöhtes Liquorgesamteiweiß durch Schrankenstörung der Nervenwurzeln bei normaler Zellzahl (< 5/µl).' },
                        { term: 'Molekulares Mimikry nach C. jejuni', category: 'Pathophysiologie', explanation: 'Kreuzreagierende Antigangliosid-Antikörper (z.B. Anti-GM1, Anti-GD1a) nach vorausgegangener Gastroenteritis oder Atemwegsinfekt.' },
                        { term: 'Verlust der F-Wellen in der Elektroneurografie', category: 'Diagnostik', explanation: 'Frühzeitiger elektrophysiologischer Nachweis einer proximalen demyelinisierenden Leitungsblockade an den Spinalwurzeln.' },
                        { term: 'Symmetrisch aufsteigende Areflexie & Parese', category: 'Klinik', explanation: 'Beginn meist an den unteren Extremitäten mit Gefahr der Zwerchfellparese (Überwachung der Vitalkapazität!).' },
                        { term: 'IVIG oder Plasmapherese (KEINE Steroide!)', category: 'Therapie', explanation: 'Intravenöse Immunglobuline und Plasmaaustausch sind gleichwertig wirksam; Glukokortikoide sind beim klassischen GBS unwirksam.' }
                    ]
                },
                {
                    disease_id: 's_cjk',
                    name: 'Sporadische Creutzfeldt-Jakob-Krankheit (sCJK)',
                    icd10: 'A81.0',
                    color_accent: '#f97316',
                    clinical_pearl: 'Letale Prionenerkrankung (PrPSc) mit subakut-rapider Demenz, Myoklonien und charakteristischem DWI-MRT.',
                    cards: [
                        { term: 'RT-QuIC im Liquor hochspezifisch positiv', category: 'Diagnostik', explanation: 'Real-Time Quaking-Induced Conversion weist fehlgefaltetes Prion-Protein mit nahezu 100 Prozent Spezifität nach.' },
                        { term: 'Protein 14-3-3 & Tau massiv erhöht (Liquor)', category: 'Diagnostik', explanation: 'Surrogatmarker des fulminanten neuroaxonalen Zelluntergangs im Liquor cerebrospinalis.' },
                        { term: 'Cortical Ribboning & Pulvinar-Sign (DWI)', category: 'Diagnostik', explanation: 'Bandförmige Diffusionsrestriktionen des Kortex sowie symmetrische Hyperintensität der Basalganglien im DWI-MRT.' },
                        { term: 'Periodische Sharp-Wave-Komplexe (PSWC)', category: 'Diagnostik', explanation: 'Typisches triphasisches EEG-Muster im Frequenzbereich von 1 bis 2 Hz.' },
                        { term: 'Spongiforme Enzephalopathie (Beta-Faltblatt)', category: 'Pathophysiologie', explanation: 'Autokatalytische Konformationsänderung von physiologischem PrPC in das Protease-resistente PrPSc.' },
                        { term: 'Rapide Demenz + Schreck-Myoklonus', category: 'Klinik', explanation: 'Innerhalb von Wochen fortschreitender kognitiver Abbau mit Ataxie, Startle-Myoklonien und akinetischem Mutismus.' }
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

# 2. SPIELKARTEN-ERGONOMIE (HOCHKANT-FORMAT 5:7 FÜR 6 SPALTEN)
Da die Karten im Spiel als rechteckige Hochkant-Spielkarten (Portrait-Ratio 5:7) in 6 nebeneinanderliegenden Kartendecks dargestellt werden, gelten für das Feld "term" strikte Längenregeln:
- "term": Prägnanter klinischer Stichpunkt, Befund, Zeichen, Gen/Antikörper, Laborparameter oder Wirkstoff.
- LÄNGEN-LIMIT FÜR "term": Maximal 2 bis 6 Wörter (strikt max. 40 Zeichen!), damit der Begriff auf dem Hochkant-Kartenblatt perfekt lesbar zentriert sitzt.
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
          "term": "Kompakter Begriff (max. 40 Zeichen)",
          "category": "Diagnostik",
          "explanation": "Spoilerfreie, tiefgehende pathophysiologische oder klinische Erklärung dieses Befundes (OHNE den Namen der Krankheit zu verraten!)."
        }
      ]
    }
  ]
}`;

    // ----------------------------------------------------------------------
    // 02. RUNTIME STATE & POINTER-DRAG STATE (EXAKTER V3.3+ STYLE)
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
        foundations: Array(FOUNDATION_SLOTS_COUNT).fill(null),
        completedDiseases: [],
        tableau: Array.from({ length: TABLEAU_COLS_COUNT }, () => []),
        stock: [],
        waste: [],
        selectedSource: null,
        hintHighlightIds: [],
        historyStack: [],
        lastSuccessAnim: null
    };

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
        hoveredTarget: null,
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
    // 03. ORDNER- & ÜBERORDNER-ENGINE FÜR SOLITAIRE (SYNCHRON ZUM DASHBOARD)
    // ----------------------------------------------------------------------
    function getSolitaireSuperFolderOrder() {
        if (typeof window.getSuperFolderOrder === 'function') {
            return window.getSuperFolderOrder();
        }
        return ['Nervensystem und Sinnesorgane', 'Psyche / Ethik / Recht', 'Reproduktion', 'Allgemein'];
    }

    function getSolitaireCustomSubFolders() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_SOL_FOLDERS_KEY) || '[]');
        } catch (_e) {
            return [];
        }
    }

    function saveSolitaireCustomSubFolders(list) {
        const clean = Array.from(new Set(list.map(s => String(s || '').trim()).filter(Boolean)));
        localStorage.setItem(STORAGE_SOL_FOLDERS_KEY, JSON.stringify(clean));
    }

    function getDeckFolderMap() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_SOL_DECK_FOLDER_MAP_KEY) || '{}');
        } catch (_e) {
            return {};
        }
    }

    function saveDeckFolderMap(map) {
        localStorage.setItem(STORAGE_SOL_DECK_FOLDER_MAP_KEY, JSON.stringify(map));
    }

    function getSolFolderSuperMap() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_SOL_FOLDER_SUPER_MAP_KEY) || '{}');
        } catch (_e) {
            return {};
        }
    }

    function saveSolFolderSuperMap(map) {
        localStorage.setItem(STORAGE_SOL_FOLDER_SUPER_MAP_KEY, JSON.stringify(map));
    }

    function resolveDeckSubFolder(deck) {
        if (!deck) return 'Allgemein';
        const map = getDeckFolderMap();
        if (deck.deck_id && map[deck.deck_id]) {
            return map[deck.deck_id];
        }
        const raw = (deck.folder_name || deck.medical_field || 'Allgemein').trim();
        if (raw.includes('_')) {
            const parts = raw.split('_');
            const clean = parts.slice(1).join('_').trim();
            if (clean.length > 2) return clean;
        }
        return raw || 'Allgemein';
    }

    function resolveSuperFolderForSolSubFolder(subFolderName) {
        if (!subFolderName) return 'Allgemein';
        const clean = subFolderName.trim();
        const availableSupers = getSolitaireSuperFolderOrder();

        const solSuperMap = getSolFolderSuperMap();
        if (solSuperMap[clean] && availableSupers.includes(solSuperMap[clean])) {
            return solSuperMap[clean];
        }

        if (typeof window.getSuperFolderForCategory === 'function') {
            return window.getSuperFolderForCategory(clean);
        }
        return 'Allgemein';
    }

    function getAllKnownSolitaireSubFolders() {
        const subSet = new Set(getSolitaireCustomSubFolders());
        const dashSubOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
        dashSubOrder.forEach(f => { if (f && f.trim()) subSet.add(f.trim()); });
        getAllDecks().forEach(d => {
            subSet.add(resolveDeckSubFolder(d));
        });
        return Array.from(subSet);
    }

    function createSolitaireSuperFolder() {
        if (typeof window.createNewSuperFolderModal === 'function') {
            window.createNewSuperFolderModal();
            renderView();
            return;
        }
        const name = window.prompt("Name für den neuen Überordner:");
        if (!name || !name.trim()) return;
        if (typeof window.createCustomSuperFolder === 'function') {
            window.createCustomSuperFolder(name.trim());
        }
        solSuperFolderStates[name.trim()] = true;
        renderView();
    }

    function createSolitaireSubFolder(preselectedSuper = null) {
        const name = window.prompt("Name für den neuen Solitaire-Ordner (z.B. 'Neurodegeneration', 'Kardiologie', 'Notfälle'):");
        if (!name || !name.trim()) return;
        const cleanName = name.trim();

        const availableSupers = getSolitaireSuperFolderOrder();
        let chosenSuper = preselectedSuper;

        if (!chosenSuper) {
            const defaultSuper = resolveSuperFolderForSolSubFolder(cleanName);
            const defaultIdx = Math.max(0, availableSupers.indexOf(defaultSuper)) + 1;
            const optionsText = availableSupers
                .map((s, idx) => `${idx + 1}: ${s}${s === defaultSuper ? ' (Vorschlag)' : ''}`)
                .join('\n');

            const superChoice = window.prompt(
                `In welchem Überordner soll "${cleanName}" angelegt werden?\n\nGib die Ziffer ein:\n${optionsText}`,
                String(defaultIdx)
            );

            chosenSuper = defaultSuper;
            if (superChoice !== null && superChoice.trim() !== '') {
                const num = parseInt(superChoice.trim(), 10);
                if (!isNaN(num) && num >= 1 && num <= availableSupers.length) {
                    chosenSuper = availableSupers[num - 1];
                }
            }
        }

        const list = getSolitaireCustomSubFolders();
        if (!list.includes(cleanName)) {
            list.push(cleanName);
            saveSolitaireCustomSubFolders(list);
        }

        const solSuperMap = getSolFolderSuperMap();
        solSuperMap[cleanName] = chosenSuper;
        saveSolFolderSuperMap(solSuperMap);

        if (typeof window.createNewFolder === 'function') {
            window.createNewFolder(cleanName, chosenSuper);
        }

        solSuperFolderStates[chosenSuper] = true;
        solSubFolderStates[cleanName] = true;

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
        renderView();
    }

    function renameSolitaireSubFolder(oldName) {
        if (!oldName) return;
        const newNameRaw = window.prompt(`Neuer Name für den Ordner "${oldName}":`, oldName);
        if (!newNameRaw || !newNameRaw.trim() || newNameRaw.trim() === oldName) return;
        const newName = newNameRaw.trim();

        const list = getSolitaireCustomSubFolders().map(f => f === oldName ? newName : f);
        if (!list.includes(newName)) list.push(newName);
        saveSolitaireCustomSubFolders(list);

        const solSuperMap = getSolFolderSuperMap();
        if (solSuperMap[oldName]) {
            solSuperMap[newName] = solSuperMap[oldName];
            delete solSuperMap[oldName];
            saveSolFolderSuperMap(solSuperMap);
        } else {
            solSuperMap[newName] = resolveSuperFolderForSolSubFolder(oldName);
            saveSolFolderSuperMap(solSuperMap);
        }

        const deckMap = getDeckFolderMap();
        getAllDecks().forEach(d => {
            if (resolveDeckSubFolder(d) === oldName) {
                deckMap[d.deck_id] = newName;
            }
        });
        saveDeckFolderMap(deckMap);

        const customDecks = getCustomDecks();
        customDecks.forEach(d => {
            if ((d.folder_name || d.medical_field) === oldName) {
                d.folder_name = newName;
                d.medical_field = newName;
            }
        });
        saveCustomDecks(customDecks);

        solSubFolderStates[newName] = true;
        delete solSubFolderStates[oldName];

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
        renderView();
    }

    function deleteSolitaireSubFolder(folderName, deckCount = 0) {
        if (!folderName || folderName.toLowerCase() === 'allgemein') {
            alert('Der Standardordner "Allgemein" kann nicht gelöscht werden.');
            return;
        }
        const msg = deckCount > 0
            ? `Möchtest du den Ordner "${folderName}" entfernen?\n\nDie ${deckCount} enthaltenen Kartendecks bleiben erhalten und werden nach "Allgemein" verschoben.`
            : `Möchtest du den leeren Ordner "${folderName}" entfernen?`;
        if (!window.confirm(msg)) return;

        const list = getSolitaireCustomSubFolders().filter(f => f !== folderName);
        saveSolitaireCustomSubFolders(list);

        const deckMap = getDeckFolderMap();
        getAllDecks().forEach(d => {
            if (resolveDeckSubFolder(d) === folderName) {
                deckMap[d.deck_id] = 'Allgemein';
            }
        });
        saveDeckFolderMap(deckMap);

        const customDecks = getCustomDecks();
        customDecks.forEach(d => {
            if ((d.folder_name || d.medical_field) === folderName) {
                d.folder_name = 'Allgemein';
                d.medical_field = 'Allgemein';
            }
        });
        saveCustomDecks(customDecks);

        delete solSubFolderStates[folderName];
        solSuperFolderStates['Allgemein'] = true;
        solSubFolderStates['Allgemein'] = true;

        renderView();
    }

    function moveSolitaireFolderToSuper(subFolderName, targetSuper) {
        if (!subFolderName || !targetSuper) return;
        const solSuperMap = getSolFolderSuperMap();
        solSuperMap[subFolderName.trim()] = targetSuper.trim();
        saveSolFolderSuperMap(solSuperMap);

        if (typeof window.moveFolderToSuperFolder === 'function') {
            window.moveFolderToSuperFolder(subFolderName.trim(), targetSuper.trim());
        }

        solSuperFolderStates[targetSuper.trim()] = true;
        solSubFolderStates[subFolderName.trim()] = true;
        renderView();
    }

    function promptMoveSolitaireFolderToSuper(subFolderName) {
        const availableSupers = getSolitaireSuperFolderOrder();
        const currentSuper = resolveSuperFolderForSolSubFolder(subFolderName);
        const optionsText = availableSupers
            .map((s, idx) => `${idx + 1}: ${s}${s === currentSuper ? ' (aktuell)' : ''}`)
            .join('\n');

        const choice = window.prompt(
            `In welchen Überordner möchtest du den Ordner "${subFolderName}" verschieben?\n\nGib die Ziffer ein:\n${optionsText}`
        );
        if (!choice || !choice.trim()) return;
        const num = parseInt(choice.trim(), 10);
        if (!isNaN(num) && num >= 1 && num <= availableSupers.length) {
            moveSolitaireFolderToSuper(subFolderName, availableSupers[num - 1]);
        }
    }

    async function moveDeckToFolder(deckId, targetSubFolder) {
        if (!deckId || !targetSubFolder) return;
        const cleanFolder = targetSubFolder.trim();

        const list = getSolitaireCustomSubFolders();
        if (!list.includes(cleanFolder)) {
            list.push(cleanFolder);
            saveSolitaireCustomSubFolders(list);
        }

        const deckMap = getDeckFolderMap();
        deckMap[deckId] = cleanFolder;
        saveDeckFolderMap(deckMap);

        const customDecks = getCustomDecks();
        const targetDeck = customDecks.find(d => d.deck_id === deckId);
        if (targetDeck) {
            targetDeck.folder_name = cleanFolder;
            targetDeck.medical_field = cleanFolder;
            saveCustomDecks(customDecks);

            if (targetDeck.is_cloud_published || cloudPublishedDeckIds.has(deckId)) {
                publishDeckToCloud(deckId, null);
            }
        }

        const parentSuper = resolveSuperFolderForSolSubFolder(cleanFolder);
        solSuperFolderStates[parentSuper] = true;
        solSubFolderStates[cleanFolder] = true;

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        renderView();
    }

    function promptMoveDeckToFolder(deckId) {
        const deck = getAllDecks().find(d => d.deck_id === deckId);
        if (!deck) return;
        const currentFolder = resolveDeckSubFolder(deck);
        const knownFolders = getAllKnownSolitaireSubFolders();
        if (!knownFolders.includes(currentFolder)) knownFolders.unshift(currentFolder);

        const optionsText = knownFolders
            .map((f, idx) => `${idx + 1}: ${f}${f === currentFolder ? ' (aktuell)' : ''}`)
            .join('\n');

        const choice = window.prompt(
            `In welchen Ordner möchtest du „${deck.title}“ verschieben?\n\nGib die Ziffer ein (oder tippe direkt einen neuen Ordnernamen ein):\n${optionsText}`
        );
        if (!choice || !choice.trim()) return;
        const trimmed = choice.trim();
        const num = parseInt(trimmed, 10);

        if (!isNaN(num) && num >= 1 && num <= knownFolders.length) {
            moveDeckToFolder(deckId, knownFolders[num - 1]);
        } else {
            moveDeckToFolder(deckId, trimmed);
        }
    }

    // ----------------------------------------------------------------------
    // 04. ZUFÄLLIGES DECK ZIEHEN & CROSS-DECK KATEGORIEN-MIXER (35–70 KARTEN)
    // ----------------------------------------------------------------------
    function filterDecksByScope(scopeStr) {
        const allDecks = getAllDecks();
        if (!scopeStr || scopeStr === 'ALL') return allDecks;

        if (scopeStr === 'CUSTOM_ONLY') {
            const customOnly = allDecks.filter(d => !d.is_builtin);
            return customOnly.length > 0 ? customOnly : allDecks;
        }
        if (scopeStr.startsWith('SUPER:')) {
            const targetSuper = scopeStr.slice(6);
            return allDecks.filter(d => resolveSuperFolderForSolSubFolder(resolveDeckSubFolder(d)) === targetSuper);
        }
        if (scopeStr.startsWith('FOLDER:')) {
            const targetFolder = scopeStr.slice(7);
            return allDecks.filter(d => resolveDeckSubFolder(d) === targetFolder);
        }
        return allDecks;
    }

    // Modus A: Zieht ein zufälliges komplettes Deck (global oder aus einem Ordner)
    function startRandomDeckGame(scopeStr = null) {
        const effectiveScope = scopeStr || mixerConfig.sourceScope || 'ALL';
        let pool = filterDecksByScope(effectiveScope);
        if (pool.length === 0) pool = getAllDecks();
        if (pool.length === 0) return;

        const chosen = pool[Math.floor(Math.random() * pool.length)];
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic([8, 25, 8]);
        startNewGame(chosen.deck_id);
        showToast(`🎲 Zufälliges Deck gezogen: <strong>${escapeHtml(chosen.title)}</strong> (${chosen.diseases?.length || 0} Krankheitsbilder)`, 'positive');
    }

    // Sammelt alle eindeutigen Krankheitsbilder (Kategorienstapel) aus einer Deck-Liste
    function harvestUniqueDiseasesFromDecks(decksList) {
        const diseaseMap = new Map();

        decksList.forEach(deck => {
            (deck.diseases || []).forEach(dis => {
                if (!dis || !dis.name || !Array.isArray(dis.cards) || dis.cards.length === 0) return;
                const key = dis.name.trim().toLowerCase();

                if (!diseaseMap.has(key)) {
                    diseaseMap.set(key, {
                        disease_id: (dis.disease_id || 'mix_' + key.replace(/[^a-z0-9]/g, '_')).slice(0, 28),
                        name: dis.name.trim(),
                        icd10: dis.icd10 || 'DDx',
                        color_accent: dis.color_accent || '#38bdf8',
                        clinical_pearl: dis.clinical_pearl || `Aus Deck „${deck.title}“`,
                        cards: dis.cards.map(c => ({
                            term: String(c.term || '').trim(),
                            category: c.category || 'Klinik',
                            explanation: c.explanation || ''
                        })).filter(c => c.term.length > 0)
                    });
                } else {
                    const existing = diseaseMap.get(key);
                    dis.cards.forEach(c => {
                        const t = String(c.term || '').trim();
                        if (t && !existing.cards.some(ec => ec.term.toLowerCase() === t.toLowerCase())) {
                            existing.cards.push({
                                term: t,
                                category: c.category || 'Klinik',
                                explanation: c.explanation || ''
                            });
                        }
                    });
                }
            });
        });

        return Array.from(diseaseMap.values()).filter(d => d.cards.length >= 4);
    }

    // Erntet zusätzlich Krankheitsbilder aus den klinischen App-Fällen (falls für 70 Karten noch Reserve benötigt wird)
    function harvestDiseasesFromAppCases() {
        const registeredCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        const tempMap = new Map();

        registeredCases.forEach(c => {
            const tasks = c.extra_tasks || {};
            if (tasks.synapses_matrix && Array.isArray(tasks.synapses_matrix.variables)) {
                const groups = Array.isArray(tasks.synapses_matrix.groups) ? tasks.synapses_matrix.groups : [];
                tasks.synapses_matrix.variables.forEach(v => {
                    if (!v.disease || !v.term) return;
                    const dName = v.disease.trim();
                    const key = dName.toLowerCase();
                    if (!tempMap.has(key)) {
                        const grp = groups.find(g => g.title === dName);
                        tempMap.set(key, {
                            disease_id: 'case_' + key.replace(/[^a-z0-9]/g, '_').slice(0, 22),
                            name: dName,
                            icd10: 'DDx',
                            clinical_pearl: grp?.explanation || `Aus Fall „${c.metadata?.title || c.case_id}“`,
                            cards: []
                        });
                    }
                    const entry = tempMap.get(key);
                    const catMap = {
                        'Risikofaktor/Pathophysiologie': 'Pathophysiologie',
                        'Symptom': 'Klinik',
                        'Diagnostik': 'Diagnostik',
                        'Therapie': 'Therapie'
                    };
                    if (!entry.cards.some(ec => ec.term.toLowerCase() === v.term.trim().toLowerCase())) {
                        entry.cards.push({
                            term: v.term.trim(),
                            category: catMap[v.type] || 'Klinik',
                            explanation: `Charakteristischer Befund der Kategorie ${v.type || 'Klinik'} im Rahmen der Differentialdiagnose.`
                        });
                    }
                });
            }
        });

        return Array.from(tempMap.values()).filter(d => d.cards.length >= 4);
    }

    // Modus B: Startet ein gemischtes Cross-Deck-Spiel mit garantierter Kartenanzahl (35 bis 70 Karten)
    function startMixedCategoriesGame(difficultyKey = null, scopeKey = null) {
        const diff = MIXER_PRESETS[difficultyKey || mixerConfig.difficulty] || MIXER_PRESETS.easy;
        const scope = scopeKey || mixerConfig.sourceScope || 'ALL';

        const primaryDecks = filterDecksByScope(scope);
        let candidateDiseases = shuffleArray(harvestUniqueDiseasesFromDecks(primaryDecks));

        const countTotalCardsInPool = (list) => list.reduce((sum, d) => sum + 1 + Math.min(d.cards.length, 7), 0);

        if (countTotalCardsInPool(candidateDiseases) < diff.minCards) {
            const allSolDecks = getAllDecks();
            const fallbackSolDiseases = shuffleArray(harvestUniqueDiseasesFromDecks(allSolDecks));
            fallbackSolDiseases.forEach(fd => {
                if (!candidateDiseases.some(cd => cd.name.toLowerCase() === fd.name.toLowerCase())) {
                    candidateDiseases.push(fd);
                }
            });
        }

        if (countTotalCardsInPool(candidateDiseases) < diff.minCards) {
            const caseDiseases = shuffleArray(harvestDiseasesFromAppCases());
            caseDiseases.forEach(cd => {
                if (!candidateDiseases.some(existing => existing.name.toLowerCase() === cd.name.toLowerCase())) {
                    candidateDiseases.push(cd);
                }
            });
        }

        const selectedDiseases = [];
        let currentCardSum = 0;

        for (let i = 0; i < candidateDiseases.length; i++) {
            const dCopy = JSON.parse(JSON.stringify(candidateDiseases[i]));
            dCopy.cards = shuffleArray(dCopy.cards).slice(0, 7);

            const diseaseCardWeight = 1 + dCopy.cards.length;

            if (currentCardSum + diseaseCardWeight <= diff.maxCards) {
                selectedDiseases.push(dCopy);
                currentCardSum += diseaseCardWeight;
            } else if (currentCardSum < diff.minCards) {
                const needed = Math.max(4, diff.targetCards - currentCardSum - 1);
                dCopy.cards = dCopy.cards.slice(0, needed);
                selectedDiseases.push(dCopy);
                currentCardSum += 1 + dCopy.cards.length;
                break;
            }

            if (currentCardSum >= diff.targetCards && currentCardSum >= diff.minCards) {
                break;
            }
        }

        selectedDiseases.forEach((d, idx) => {
            d.disease_id = `mix_${idx}_${Date.now()}`;
            d.color_accent = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
        });

        const totalCardsFinal = selectedDiseases.reduce((sum, d) => sum + 1 + d.cards.length, 0);

        const scopeLabel = scope === 'CUSTOM_ONLY'
            ? 'Importierte Decks'
            : scope.startsWith('SUPER:')
                ? scope.slice(6)
                : scope.startsWith('FOLDER:')
                    ? scope.slice(7)
                    : 'Alle Decks';

        const virtualMixedDeck = {
            deck_id: `mixed_session_${diff.id}`,
            title: `🔀 DDx-Mixer (${diff.id === 'hard' ? 'Schwierig' : diff.id === 'medium' ? 'Mittel' : 'Einfach'}): ${selectedDiseases.length} Krankheitsbilder • ${totalCardsFinal} Karten`,
            medical_field: `Mix: ${scopeLabel}`,
            folder_name: scopeLabel,
            difficulty: diff.label,
            description: `Dynamisch gemischtes Kartendeck aus ${selectedDiseases.length} Krankheitsbildern (${totalCardsFinal} Spielkarten insgesamt).`,
            is_virtual_mix: true,
            mixer_difficulty: diff.id,
            mixer_scope: scope,
            diseases: selectedDiseases
        };

        startGameWithDeckObject(virtualMixedDeck);
        showToast(
            `🔀 <strong>Kategorien-Mixer gestartet (${escapeHtml(diff.label)}):</strong> ${selectedDiseases.length} zufällige Krankheitsbilder mit insgesamt <strong>${totalCardsFinal} Spielkarten</strong> wurden gemischt!`,
            'positive'
        );
    }

    // ----------------------------------------------------------------------
    // 05. SUPABASE CLOUD-SYNC & ONLINE-PUBLISHING ENGINE
    // ----------------------------------------------------------------------
    function getSupabaseClient() {
        return window.supabaseClient || window.supabase || window.sb || window.supabase_client || null;
    }

    function getHiddenCloudDecks() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_HIDDEN_CLOUD_DECKS_KEY) || '[]');
        } catch (_e) {
            return [];
        }
    }

    function addHiddenCloudDeck(deckId) {
        const list = getHiddenCloudDecks();
        if (!list.includes(deckId)) {
            list.push(deckId);
            localStorage.setItem(STORAGE_HIDDEN_CLOUD_DECKS_KEY, JSON.stringify(list));
        }
    }

    function removeHiddenCloudDeck(deckId) {
        const list = getHiddenCloudDecks().filter(id => id !== deckId);
        localStorage.setItem(STORAGE_HIDDEN_CLOUD_DECKS_KEY, JSON.stringify(list));
    }

    async function syncDecksFromCloud() {
        const solView = document.getElementById('solitaire-view');
        if (solView && solView.style.display !== 'none' && solView.innerHTML.trim() === '') {
            renderView();
        }

        const sb = getSupabaseClient();
        if (!sb || isSyncingCloud) return;
        isSyncingCloud = true;

        try {
            const { data, error } = await sb
                .from('cases')
                .select('case_id, title, medical_field, is_public, content')
                .eq('medical_field', CLOUD_DECK_FIELD)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('[Solitaire Cloud] Decks konnten nicht geladen werden:', error.message);
                return;
            }

            const newCloudSet = new Set();
            const hiddenIds = getHiddenCloudDecks();
            let customDecks = getCustomDecks();
            const deckFolderMap = getDeckFolderMap();
            let changed = false;

            (data || []).forEach(row => {
                const deckObj = row.content;
                if (!deckObj || !deckObj.deck_id || !Array.isArray(deckObj.diseases)) return;

                newCloudSet.add(deckObj.deck_id);
                if (hiddenIds.includes(deckObj.deck_id)) return;

                deckObj.is_cloud_published = true;
                if (deckObj.folder_name && !deckFolderMap[deckObj.deck_id]) {
                    deckFolderMap[deckObj.deck_id] = deckObj.folder_name;
                }

                const existingIdx = customDecks.findIndex(d => d.deck_id === deckObj.deck_id);
                if (existingIdx !== -1) {
                    customDecks[existingIdx] = { ...customDecks[existingIdx], ...deckObj, is_cloud_published: true };
                    changed = true;
                } else {
                    customDecks.push(deckObj);
                    changed = true;
                }
            });

            cloudPublishedDeckIds = newCloudSet;

            if (changed) {
                saveDeckFolderMap(deckFolderMap);
                saveCustomDecks(customDecks);
            }

            if (solView && solView.style.display !== 'none' && currentViewMode === 'lobby') {
                renderView();
            }
        } catch (err) {
            console.warn('[Solitaire Cloud] Fehler beim Cloud-Sync:', err);
        } finally {
            isSyncingCloud = false;
        }
    }

    async function publishDeckToCloud(deckId, btnEl = null) {
        const sb = getSupabaseClient();
        if (!sb || !sb.auth) {
            alert('Keine Verbindung zu Supabase gefunden.');
            return false;
        }

        const { data: { session } } = await sb.auth.getSession();
        const currentUser = session?.user;
        if (!currentUser) {
            alert('Bitte melde dich zuerst unter „Einstellungen“ mit deinem Cloud-Account an, um Decks online zu stellen.');
            return false;
        }

        const allDecks = getAllDecks();
        const targetDeck = allDecks.find(d => d.deck_id === deckId);
        if (!targetDeck) {
            alert('Deck nicht gefunden.');
            return false;
        }

        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '⏳ Lädt hoch...';
        }

        const cloudRowId = CLOUD_DECK_PREFIX + targetDeck.deck_id;
        const resolvedFolder = resolveDeckSubFolder(targetDeck);
        const deckPayload = {
            ...targetDeck,
            folder_name: resolvedFolder,
            medical_field: resolvedFolder,
            is_cloud_published: true,
            published_at: new Date().toISOString(),
            published_by: currentUser.email || currentUser.id
        };

        try {
            const { error } = await sb
                .from('cases')
                .upsert({
                    case_id: cloudRowId,
                    title: targetDeck.title || targetDeck.deck_id,
                    medical_field: CLOUD_DECK_FIELD,
                    is_public: true,
                    user_id: currentUser.id,
                    created_by: currentUser.id,
                    content: deckPayload
                }, { onConflict: 'case_id' });

            if (error) throw error;

            removeHiddenCloudDeck(targetDeck.deck_id);
            cloudPublishedDeckIds.add(targetDeck.deck_id);

            const customDecks = getCustomDecks();
            const idx = customDecks.findIndex(d => d.deck_id === targetDeck.deck_id);
            if (idx !== -1) {
                customDecks[idx].is_cloud_published = true;
                customDecks[idx].folder_name = resolvedFolder;
                saveCustomDecks(customDecks);
            }

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic([10, 40, 10]);
            if (typeof showScorePopup === 'function') {
                showScorePopup(`☁️ Deck „${targetDeck.title}“ ist jetzt online!`, 'positive');
            }

            renderView();
            return true;
        } catch (err) {
            console.error('[Solitaire Cloud] Upload fehlgeschlagen:', err);
            alert(`Online-Stellen fehlgeschlagen: ${err.message}`);
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '☁️ Online stellen';
            }
            return false;
        }
    }

    async function publishAllLocalDecksToCloud(btnEl = null) {
        const customDecks = getCustomDecks();
        const unpublished = customDecks.filter(d => !d.is_builtin && !cloudPublishedDeckIds.has(d.deck_id));

        if (unpublished.length === 0) {
            alert('Alle deine eigenen Kartendecks sind bereits online in der Cloud synchronisiert!');
            return;
        }

        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = `⏳ Synchronisiere ${unpublished.length} Deck(s)...`;
        }

        let successCount = 0;
        for (const deck of unpublished) {
            const ok = await publishDeckToCloud(deck.deck_id, null);
            if (ok) successCount++;
        }

        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = '☁️ Alle Decks online stellen';
        }

        if (successCount > 0) {
            alert(`✓ ${successCount} Kartendeck(s) erfolgreich online gestellt! Sie sind jetzt auf allen deinen Geräten (Handy, iPad, Laptop) verfügbar.`);
            renderView();
        }
    }

    async function unpublishDeckFromCloud(deckId) {
        const allDecks = getAllDecks();
        const targetDeck = allDecks.find(d => d.deck_id === deckId);
        const title = targetDeck?.title || deckId;

        if (!window.confirm(`Möchtest du das Deck „${title}“ wieder aus der Cloud entfernen?\n\n(Es bleibt lokal auf diesem Gerät gespeichert, ist aber online für andere Geräte nicht mehr sichtbar.)`)) {
            return;
        }

        const sb = getSupabaseClient();
        if (!sb) return;

        try {
            const cloudRowId = CLOUD_DECK_PREFIX + deckId;
            const { error } = await sb
                .from('cases')
                .delete()
                .eq('case_id', cloudRowId);

            if (error) throw error;

            cloudPublishedDeckIds.delete(deckId);
            const customDecks = getCustomDecks();
            const idx = customDecks.findIndex(d => d.deck_id === deckId);
            if (idx !== -1) {
                customDecks[idx].is_cloud_published = false;
                saveCustomDecks(customDecks);
            }

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
            if (typeof showScorePopup === 'function') {
                showScorePopup('☁️✕ Deck wieder auf „Nur lokal“ gesetzt', 'neutral');
            }
            renderView();
        } catch (err) {
            alert(`Fehler beim Entfernen aus der Cloud: ${err.message}`);
        }
    }

    function exportDeckAsJsonFile(deckId) {
        const deck = getAllDecks().find(d => d.deck_id === deckId);
        if (!deck) return;
        const cleanCopy = { ...deck };
        delete cleanCopy.is_cloud_published;

        const blob = new Blob([JSON.stringify(cleanCopy, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${deck.deck_id || 'solitaire_deck'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ----------------------------------------------------------------------
    // 06. ANTI-SPOILER SANITIZER FÜR DEN ⓘ ZUSATZINFO-BUTTON
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
                <div style="font-size:0.78rem; color:var(--text-muted); line-height:1.5;">
                    <strong>Spielregel:</strong> Im unteren Tableau darf auf diese Krankheitsbild-Karte <u>nichts</u> abgelegt werden. Ziehe sie zuerst nach oben in einen freien Ziel-Slot, um ihre <strong>${foundCard.totalRequired} zugehörigen Karten</strong> darauf zu sammeln.
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
    // 07. SOLITAIRE FX ENGINE (PARTIKEL, SHOCKWAVE & FLOATING TELEMETRY)
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
    // 08. PERSISTENZ & DECK-HELPER
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
    // 09. AUTO-GENERATOR AUS VORHANDENEN APP-FÄLLEN
    // ----------------------------------------------------------------------
    async function generateDecksFromExistingCases() {
        const validDiseases = harvestDiseasesFromAppCases().map((d, idx) => ({
            ...d,
            color_accent: ACCENT_PALETTE[idx % ACCENT_PALETTE.length],
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
            folder_name: 'Allgemein',
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
    // 10. KLASSISCHE SOLITAIRE-TREPPENFORM (1 BIS 6 KARTEN VON LINKS NACH RECHTS)
    // ----------------------------------------------------------------------
    function shuffleArray(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    // Berechnet die exakte Solitaire-Treppenform [1, 2, 3, 4, 5, 6] (links kleinster, rechts größter Stapel)
    function computeSolitaireStaircaseSizes(numCols, maxTableauCards) {
        const colSizes = Array(numCols).fill(0);
        let cardsAllocated = 0;

        // Klassischer Klondike-Durchlauf:
        // Pass 0 legt je 1 Karte in Spalte 0..5
        // Pass 1 legt je 1 Karte in Spalte 1..5
        // ...
        // Pass 5 legt 1 Karte in Spalte 5 -> Ergebnis bei ≥21 Karten: [1, 2, 3, 4, 5, 6]
        for (let pass = 0; pass < numCols; pass++) {
            for (let col = pass; col < numCols; col++) {
                if (cardsAllocated < maxTableauCards) {
                    colSizes[col]++;
                    cardsAllocated++;
                }
            }
        }
        return colSizes;
    }

    function startNewGame(deckId) {
        if (deckId && deckId.startsWith('mixed_session_') && activeDeck?.is_virtual_mix) {
            startMixedCategoriesGame(activeDeck.mixer_difficulty, activeDeck.mixer_scope);
            return;
        }

        const allDecks = getAllDecks();
        const found = allDecks.find(d => d.deck_id === deckId) || allDecks[0];
        if (!found) return;
        startGameWithDeckObject(found);
    }

    function startGameWithDeckObject(deckTemplate) {
        if (!deckTemplate) return;
        activeDeck = JSON.parse(JSON.stringify(deckTemplate));
        currentViewMode = 'game';

        const shuffledDiseases = shuffleArray(activeDeck.diseases || []);
        const WAVE_SIZE = 3;

        const waves = [];
        const guaranteedInitialCats = [];

        shuffledDiseases.forEach((disease, dIdx) => {
            const waveIdx = Math.floor(dIdx / WAVE_SIZE);
            if (!waves[waveIdx]) waves[waveIdx] = { cats: [], terms: [] };

            const dId = disease.disease_id || `dis_${dIdx}`;
            const accent = disease.color_accent || ACCENT_PALETTE[dIdx % ACCENT_PALETTE.length];
            const totalTerms = (disease.cards || []).length;

            const catCardObj = {
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
            };

            if (dIdx < 2) {
                guaranteedInitialCats.push(catCardObj);
            } else {
                waves[waveIdx].cats.push(catCardObj);
            }

            (disease.cards || []).forEach((c, cIdx) => {
                waves[waveIdx].terms.push({
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

        const generalPool = [];
        waves.forEach(w => {
            const waveChunk = shuffleArray([...w.cats, ...w.terms]);
            generalPool.push(...waveChunk);
        });

        const numCols = TABLEAU_COLS_COUNT; // 6 Spalten
        const tableau = Array.from({ length: numCols }, () => []);
        const totalCardsCount = guaranteedInitialCats.length + generalPool.length;

        // Klassische Solitaire-Treppe benötigt 1 + 2 + 3 + 4 + 5 + 6 = 21 Karten.
        // Wir lassen mindestens 2 Karten aus generalPool (+ guaranteedInitialCats[1]) für den Nachziehstapel übrig.
        const availableForTableau = generalPool.length + (guaranteedInitialCats[0] ? 1 : 0);
        const maxTableauBudget = Math.min(21, Math.max(numCols, availableForTableau - 2));
        const staircaseSizes = computeSolitaireStaircaseSizes(numCols, maxTableauBudget);

        // Zufällige Spalte auswählen, deren oberste (offene) Karte die erste garantierte Krankheitsbild-Karte (👑) ist
        const openCatCol = Math.floor(Math.random() * numCols);

        for (let colIdx = 0; colIdx < numCols; colIdx++) {
            const targetColSize = staircaseSizes[colIdx];
            const faceDownCount = Math.max(0, targetColSize - 1);

            // 1. Verdeckte Basiskarten für diese Spalte legen (0 in Deck 1 ... bis 5 in Deck 6)
            for (let d = 0; d < faceDownCount; d++) {
                const downCard = generalPool.shift();
                if (downCard) {
                    downCard.faceUp = false;
                    tableau[colIdx].push(downCard);
                }
            }

            // 2. Oberste (offene) Spielkarte auf diesen Stapel legen
            if (targetColSize > 0) {
                if (colIdx === openCatCol && guaranteedInitialCats[0]) {
                    guaranteedInitialCats[0].faceUp = true;
                    tableau[colIdx].push(guaranteedInitialCats[0]);
                } else {
                    const topCard = generalPool.shift();
                    if (topCard) {
                        topCard.faceUp = true;
                        tableau[colIdx].push(topCard);
                    }
                }
            }
        }

        // Restliche Karten in den Nachziehstapel (Stock) legen
        const stock = [...generalPool];
        if (guaranteedInitialCats[1]) {
            const insertIdx = Math.min(stock.length, 1);
            stock.splice(insertIdx, 0, guaranteedInitialCats[1]);
        }
        stock.forEach(c => { c.faceUp = false; });

        const calculatedMaxMoves = Math.ceil(totalCardsCount * 1.72) + 16;
        const initialHints = totalCardsCount >= 55 ? 5 : 3;
        const initialJokers = totalCardsCount >= 55 ? 3 : 2;

        gameState = {
            movesLeft: calculatedMaxMoves,
            maxMoves: calculatedMaxMoves,
            totalCardsInSession: totalCardsCount,
            score: 0,
            comboStreak: 0,
            hintsLeft: initialHints,
            jokersLeft: initialJokers,
            foundations: Array(FOUNDATION_SLOTS_COUNT).fill(null),
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
    // 11. SNAPSHOT / UNDO & AUTO-FINISH CHECK
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

        gameState.foundations = Array(FOUNDATION_SLOTS_COUNT).fill(null);
        gameState.tableau = Array.from({ length: TABLEAU_COLS_COUNT }, () => []);
        gameState.stock = [];
        gameState.waste = [];
        renderView();
        checkGameOverState();
    }

    // ----------------------------------------------------------------------
    // 12. SPIELZÜGE, OPTISCHES PRE-STACKING & VALIDIERUNG (INKL. NEUER REGEL)
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
            // Wenn darunter eine verdeckte Karte lag -> aufdecken + kleiner Entdecker-Bonus!
            if (col.length > 0 && !col[col.length - 1].faceUp) {
                col[col.length - 1].faceUp = true;
                gameState.score += 5;
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

    // OBEN IN DEN 4 ZIEL-SLOTS: Die goldene Krankheitsbild-Karte (👑) muss zwingend zuunterst liegen
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

    // UNTEN IN DEN 6 TABLEAU-DECKS: Auf die goldene Krankheitsbild-Karte (👑) kann NICHTS abgelegt werden!
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

        // 1. Auf ein komplett leeres Deck unten darf jede Karte gelegt werden
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

        // 2. NEUE REGEL: Liegt unten eine goldene Krankheitsbild-Karte (👑), darf nichts auf sie draufgelegt werden!
        if (topTargetCard.isCategoryCard) {
            gameState.comboStreak = 0;
            triggerWrongMoveFeedback(
                source,
                `<strong>Gesperrter Stapel (Kein Move-Abzug):</strong> Auf die Krankheitsbild-Karte „${escapeHtml(topTargetCard.diseaseName)}“ (👑) kann in den unteren Stapeln <u>nichts</u> abgelegt werden! Ziehe sie zuerst nach oben in einen freien Ziel-Slot.`,
                lastCardInColDom
            );
            return false;
        }

        // 3. NEUE REGEL: Eine goldene Krankheitsbild-Karte (👑) darf unten nicht auf andere Karten gelegt werden!
        if (card.isCategoryCard) {
            gameState.comboStreak = 0;
            triggerWrongMoveFeedback(
                source,
                `<strong>Regel-Hinweis (Kein Move-Abzug):</strong> Die Krankheitsbild-Karte „${escapeHtml(card.diseaseName)}“ (👑) kann nur oben in einen freien Ziel-Slot (oder unten auf ein komplett freies Deck) gelegt werden.`,
                lastCardInColDom
            );
            return false;
        }

        // 4. Beide Karten sind normale Begriffskarten derselben Krankheit -> Pre-Stacking unten erlaubt!
        if (!topTargetCard.isCategoryCard && !card.isCategoryCard && topTargetCard.diseaseId === card.diseaseId) {
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

        gameState.comboStreak = 0;
        triggerWrongMoveFeedback(
            source,
            `<strong>Nicht kombinierbar (Kein Move-Abzug):</strong> Diese beiden Spielkarten gehören zu <u>unterschiedlichen Krankheitsbildern</u>. Nutze <strong>ⓘ</strong> oben rechts für Details!`,
            lastCardInColDom
        );
        return false;
    }

    // Doppeltipp / Auto-Move beachtet strikt, dass unten nichts auf Krankheitsbild-Karten gelegt werden darf
    function attemptAutoMoveCard(source) {
        const card = getPlayableCardFromSource(source);
        if (!card) return false;

        if (card.isCategoryCard) {
            const emptySlotIdx = gameState.foundations.findIndex(s => s === null);
            if (emptySlotIdx !== -1) {
                return attemptMoveToFoundation(source, emptySlotIdx);
            }
            return false;
        } else {
            const matchingSlotIdx = gameState.foundations.findIndex(s => s && s.diseaseId === card.diseaseId);
            if (matchingSlotIdx !== -1) {
                return attemptMoveToFoundation(source, matchingSlotIdx);
            }
            for (let cIdx = 0; cIdx < gameState.tableau.length; cIdx++) {
                if (source.zone === 'tableau' && source.colIdx === cIdx) continue;
                const col = gameState.tableau[cIdx];
                if (col.length > 0) {
                    const topCard = col[col.length - 1];
                    if (!topCard.isCategoryCard && topCard.diseaseId === card.diseaseId) {
                        return attemptMoveToTableauColumn(source, cIdx);
                    }
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
    // 13. POWER-UPS: HINT & JOKER
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
                if (!a.card.isCategoryCard && !b.card.isCategoryCard &&
                    a.card.diseaseId === b.card.diseaseId &&
                    (a.zone === 'tableau' || b.zone === 'tableau')) {
                    gameState.hintsLeft--;
                    gameState.hintHighlightIds = [a.card.uid, b.card.uid];
                    renderView();
                    showToast(`💡 Pre-Stack-Tipp: Diese beiden markierten Spielkarten gehören zur selben Erkrankung und können im Tableau gestapelt werden!`, 'positive');
                    return;
                }
            }
        }

        showToast('💡 Aktuell kein direkter Match offen – tippe auf den Nachziehstapel oben links oder nutze eines der 6 Decks!', 'neutral');
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
            showToast(`🃏 Joker eingesetzt: Alle verdeckten Spielkarten in den 6 Decks aufgedeckt!`, 'positive');
        } else {
            gameState.movesLeft += 5;
            renderView();
            showToast(`🃏 Joker eingesetzt: +5 Extra-Moves erhalten!`, 'positive');
        }
    }

    // ----------------------------------------------------------------------
    // 14. UI FEEDBACK, DOSSIER-MODAL & LERN-DEPOT INTEGRATION
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
                    Du hast alle <strong>${gameState.completedDiseases.length} Krankheitsbilder</strong> (${gameState.totalCardsInSession || 0} Karten) differentialdiagnostisch perfekt zugeordnet.
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
    // 15. MANUELLER DECK-UPLOAD & SKILL-PROMPT EXPORT
    // ----------------------------------------------------------------------
    function validateAndImportDeckJson(rawText, explicitFolder = null) {
        const cleaned = rawText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const parsed = JSON.parse(cleaned);

        if (!parsed.title || !Array.isArray(parsed.diseases) || parsed.diseases.length === 0) {
            throw new Error('Ungültiges Format: Das JSON muss "title" und ein nicht-leeres Array "diseases" enthalten.');
        }

        parsed.deck_id = (parsed.deck_id || 'custom_deck_' + Date.now()).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const chosenFolder = (explicitFolder || parsed.folder_name || parsed.medical_field || 'Allgemein').trim();
        parsed.folder_name = chosenFolder;
        parsed.medical_field = chosenFolder;
        parsed.difficulty = parsed.difficulty || 'Staatsexamen';

        parsed.diseases.forEach((d, idx) => {
            if (!d.name || !Array.isArray(d.cards) || d.cards.length === 0) {
                throw new Error(`Krankheitsbild #${idx + 1} benötigt "name" und ein Array "cards".`);
            }
            d.disease_id = d.disease_id || `dis_${idx}_${Date.now()}`;
            d.color_accent = d.color_accent || ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
        });

        const deckMap = getDeckFolderMap();
        deckMap[parsed.deck_id] = chosenFolder;
        saveDeckFolderMap(deckMap);

        const subFolders = getSolitaireCustomSubFolders();
        if (!subFolders.includes(chosenFolder)) {
            subFolders.push(chosenFolder);
            saveSolitaireCustomSubFolders(subFolders);
        }

        const parentSuper = resolveSuperFolderForSolSubFolder(chosenFolder);
        solSuperFolderStates[parentSuper] = true;
        solSubFolderStates[chosenFolder] = true;

        removeHiddenCloudDeck(parsed.deck_id);
        const customDecks = getCustomDecks().filter(d => d.deck_id !== parsed.deck_id);
        customDecks.unshift(parsed);
        saveCustomDecks(customDecks);
        return parsed;
    }

    async function deleteCustomDeck(deckId) {
        const isCloud = cloudPublishedDeckIds.has(deckId);
        const msg = isCloud
            ? 'Dieses Deck ist aktuell online in der Cloud veröffentlicht.\n\nMöchtest du es lokal löschen (und falls du Creator bist, auch aus der Cloud entfernen)?'
            : 'Möchtest du dieses lokale Kartendeck wirklich löschen?';

        if (!window.confirm(msg)) return;

        if (isCloud) {
            addHiddenCloudDeck(deckId);
            const sb = getSupabaseClient();
            if (sb) {
                await sb.from('cases').delete().eq('case_id', CLOUD_DECK_PREFIX + deckId).catch(() => {});
                cloudPublishedDeckIds.delete(deckId);
            }
        }

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
    // 16. RENDERING: LOBBY MIT DASHBOARD-ORDNERN & V3.3+ DECK-KARTEN
    // ----------------------------------------------------------------------
    function renderDeckCardHtml(deck, stats) {
        const dStat = stats[deck.deck_id] || { wins: 0, bestScore: 0 };
        const totalTerms = (deck.diseases || []).reduce((acc, d) => acc + (d.cards?.length || 0), 0);
        const isCloudOnline = !!(deck.is_cloud_published || cloudPublishedDeckIds.has(deck.deck_id));
        const subFolder = resolveDeckSubFolder(deck);

        return `
            <div class="sol-deck-card" draggable="true" data-sol-deck-id="${encodeURIComponent(deck.deck_id)}">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span class="tag">${escapeHtml(subFolder)}</span>
                            ${deck.is_builtin ? `
                                <span class="cloud-badge is-local" title="Integriertes Standard-Deck">🏛️ System</span>
                            ` : isCloudOnline ? `
                                <span class="cloud-badge is-cloud" title="Dieses Deck ist live in der Supabase-Cloud veröffentlicht">☁️ Online</span>
                            ` : `
                                <span class="cloud-badge is-local" title="Nur lokal auf diesem Gerät gespeichert">💻 Lokal</span>
                            `}
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                            ${dStat.wins > 0 ? `<span style="font-size:0.68rem; font-weight:800; color:var(--color-symptom); margin-right:4px;">✓ ${dStat.wins}x</span>` : ''}
                            <button type="button" class="folder-action-btn move-btn" onclick="event.stopPropagation(); window.SolitaireModule.promptMoveDeckToFolder('${deck.deck_id}')" title="In anderen Ordner verschieben">⇄</button>
                            <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.SolitaireModule.exportDeckAsJsonFile('${deck.deck_id}')" title="Deck als .json Datei herunterladen">📤</button>
                            ${(!deck.is_builtin && isCloudOnline) ? `
                                <button type="button" class="unpublish-case-btn" onclick="event.stopPropagation(); window.SolitaireModule.unpublishDeckFromCloud('${deck.deck_id}')" title="Aus der Cloud nehmen (bleibt lokal erhalten)">☁️✕</button>
                            ` : ''}
                            ${!deck.is_builtin ? `
                                <button type="button" class="folder-action-btn delete-folder-btn" onclick="event.stopPropagation(); window.SolitaireModule.deleteCustomDeck('${deck.deck_id}')" title="Deck löschen">🗑️</button>
                            ` : ''}
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
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; padding-top:10px; border-top:1px solid var(--divider-color);">
                    <span style="font-size:0.72rem; color:var(--text-dim); font-family:'JetBrains Mono', monospace;">
                        ${deck.diseases?.length || 0} Diagnosen • ${totalTerms} Karten
                    </span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${(!deck.is_builtin && !isCloudOnline) ? `
                            <button type="button" class="action-btn secondary btn-sm" style="padding:6px 11px; font-size:0.74rem; border-color:rgba(56,189,248,0.45); color:var(--accent-blue);" onclick="event.stopPropagation(); window.SolitaireModule.publishDeckToCloud('${deck.deck_id}', this)" title="Dieses Deck in der Supabase-Cloud für alle Geräte veröffentlichen">
                                ☁️ Online stellen
                            </button>
                        ` : ''}
                        <button type="button" class="action-btn btn-sm" onclick="window.SolitaireModule.startNewGame('${deck.deck_id}')">
                            Spielen ➔
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderLobby(container) {
        container.classList.remove('sol-in-game-mode');
        const allDecks = getAllDecks();
        const stats = getDeckStats();
        const unpublishedCount = getCustomDecks().filter(d => !d.is_builtin && !cloudPublishedDeckIds.has(d.deck_id)).length;
        const customDecksCount = getCustomDecks().filter(d => !d.is_builtin).length;

        const orderedSuperTitles = getSolitaireSuperFolderOrder();
        const knownSubFolders = getAllKnownSolitaireSubFolders();

        const queryLower = solSearchQuery.trim().toLowerCase();
        const isSearching = queryLower.length > 0;

        const groupedBySubFolder = {};
        knownSubFolders.forEach(f => { groupedBySubFolder[f] = []; });

        allDecks.forEach(deck => {
            if (isSearching) {
                const hay = `${deck.title} ${deck.description || ''} ${resolveDeckSubFolder(deck)} ${(deck.diseases || []).map(d => d.name).join(' ')}`.toLowerCase();
                if (!hay.includes(queryLower)) return;
            }
            const sub = resolveDeckSubFolder(deck);
            if (!groupedBySubFolder[sub]) groupedBySubFolder[sub] = [];
            groupedBySubFolder[sub].push(deck);
        });

        const superFoldersMap = {};
        orderedSuperTitles.forEach(s => { superFoldersMap[s] = []; });

        Object.keys(groupedBySubFolder).forEach(sub => {
            if (isSearching && groupedBySubFolder[sub].length === 0) return;
            const targetSuper = resolveSuperFolderForSolSubFolder(sub);
            if (!superFoldersMap[targetSuper]) superFoldersMap[targetSuper] = [];
            superFoldersMap[targetSuper].push(sub);
        });

        if (Object.keys(solSuperFolderStates).length === 0) {
            orderedSuperTitles.forEach(s => { solSuperFolderStates[s] = false; });
            const firstNonEmptySuper = orderedSuperTitles.find(s => (superFoldersMap[s] || []).some(sub => (groupedBySubFolder[sub] || []).length > 0)) || orderedSuperTitles[0];
            if (firstNonEmptySuper) {
                solSuperFolderStates[firstNonEmptySuper] = true;
                const firstSub = (superFoldersMap[firstNonEmptySuper] || [])[0];
                if (firstSub) solSubFolderStates[firstSub] = true;
            }
        }

        const scopeOptionsHtml = [
            `<option value="ALL" ${mixerConfig.sourceScope === 'ALL' ? 'selected' : ''}>📚 Alle verfügbaren Decks (${allDecks.length} Decks)</option>`,
            customDecksCount > 0 ? `<option value="CUSTOM_ONLY" ${mixerConfig.sourceScope === 'CUSTOM_ONLY' ? 'selected' : ''}>📥 Nur importierte Decks (${customDecksCount} Decks)</option>` : '',
            ...orderedSuperTitles.map(s => `<option value="SUPER:${escapeHtml(s)}" ${mixerConfig.sourceScope === 'SUPER:' + s ? 'selected' : ''}>📂 Überordner: ${escapeHtml(s)}</option>`),
            ...Object.keys(groupedBySubFolder).filter(f => groupedBySubFolder[f].length > 0).map(f => `<option value="FOLDER:${escapeHtml(f)}" ${mixerConfig.sourceScope === 'FOLDER:' + f ? 'selected' : ''}>📁 Ordner: ${escapeHtml(f)} (${groupedBySubFolder[f].length})</option>`)
        ].join('');

        const activePreset = MIXER_PRESETS[mixerConfig.difficulty] || MIXER_PRESETS.easy;

        let superFoldersHtml = '';
        Object.entries(superFoldersMap).forEach(([superTitle, subFoldersList]) => {
            if (isSearching && subFoldersList.length === 0) return;

            const isSuperOpen = isSearching ? true : !!solSuperFolderStates[superTitle];
            const arrowSymbol = isSuperOpen ? '▼' : '▶';
            const isProtectedDefault = (superTitle === 'Allgemein');

            let totalDecksInSuper = 0;
            let solvedDecksInSuper = 0;
            subFoldersList.forEach(sub => {
                const list = groupedBySubFolder[sub] || [];
                totalDecksInSuper += list.length;
                solvedDecksInSuper += list.filter(d => (stats[d.deck_id]?.wins || 0) > 0).length;
            });

            const escapedSuperJs = escapeHtml(superTitle).replace(/'/g, "\\'");

            let subFoldersHtml = '';
            if (subFoldersList.length === 0) {
                subFoldersHtml = `
                    <div class="empty-superfolder-hint">
                        <span>Ordner leer</span>
                        <button type="button" class="ghost-tool-btn" onclick="event.stopPropagation(); window.SolitaireModule.createSolitaireSubFolder('${escapedSuperJs}')">+ Unterordner</button>
                    </div>
                `;
            } else {
                subFoldersHtml = subFoldersList.map((subName, subIdx) => {
                    const decksInSub = groupedBySubFolder[subName] || [];
                    const solvedInSub = decksInSub.filter(d => (stats[d.deck_id]?.wins || 0) > 0).length;
                    const isSubOpen = isSearching ? true : (solSubFolderStates[subName] !== undefined ? !!solSubFolderStates[subName] : (decksInSub.length > 0 && subIdx === 0));
                    const escapedSubJs = escapeHtml(subName).replace(/'/g, "\\'");

                    const cardsHtml = decksInSub.length === 0
                        ? `<div class="empty-subfolder-hint">Noch keine Decks in diesem Ordner (Deck-Karte per Drag & Drop hierher ziehen oder auf „⇄“ klicken).</div>`
                        : decksInSub.map(d => renderDeckCardHtml(d, stats)).join('');

                    return `
                        <div class="category-folder sol-category-folder" draggable="true" data-sol-subfolder="${encodeURIComponent(subName)}" data-sol-super="${encodeURIComponent(superTitle)}">
                            <div class="category-header" onclick="window.SolitaireModule.toggleSolSubFolder('${escapedSubJs}')">
                                <div class="category-title-wrap">
                                    <span class="category-drag-handle" title="Ziehen zum Verschieben">⠿</span>
                                    <span class="category-arrow ${isSubOpen ? 'expanded' : ''}">▶</span>
                                    <span class="category-name-text">${escapeHtml(subName)}</span>
                                </div>
                                <div class="category-header-right">
                                    <div class="folder-hover-tools">
                                        ${decksInSub.length > 0 ? `
                                            <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.SolitaireModule.startRandomDeckGame('FOLDER:${escapedSubJs}')" title="Zufälliges Deck aus diesem Ordner ziehen">🎲</button>
                                            <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.SolitaireModule.startMixedCategoriesGame(null, 'FOLDER:${escapedSubJs}')" title="Kategorien aus diesem Ordner mischen">🔀</button>
                                        ` : ''}
                                        <button type="button" class="folder-action-btn move-btn" onclick="event.stopPropagation(); window.SolitaireModule.promptMoveSolitaireFolderToSuper('${escapedSubJs}')" title="Verschieben">⇄</button>
                                        <button type="button" class="folder-action-btn edit-btn" onclick="event.stopPropagation(); window.SolitaireModule.renameSolitaireSubFolder('${escapedSubJs}')" title="Umbenennen">✏️</button>
                                        <button type="button" class="folder-action-btn delete-folder-btn" onclick="event.stopPropagation(); window.SolitaireModule.deleteSolitaireSubFolder('${escapedSubJs}', ${decksInSub.length})" title="Löschen">🗑️</button>
                                    </div>
                                    <span class="category-badge">${solvedInSub}/${decksInSub.length}</span>
                                </div>
                            </div>
                            <div class="category-cases-body sol-folder-decks-grid" style="display:${isSubOpen ? 'grid' : 'none'}; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;">
                                ${cardsHtml}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            superFoldersHtml += `
                <div class="super-folder sol-super-folder" data-sol-super-title="${encodeURIComponent(superTitle)}">
                    <div class="super-folder-header" onclick="window.SolitaireModule.toggleSolSuperFolder('${escapedSuperJs}')">
                        <div class="super-folder-title">
                            <span class="super-drag-handle" title="Überordner">⠿</span>
                            <svg class="super-folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            <span>${escapeHtml(superTitle)}</span>
                        </div>
                        <div class="super-folder-right">
                            <div class="folder-hover-tools">
                                ${totalDecksInSuper > 0 ? `
                                    <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.SolitaireModule.startRandomDeckGame('SUPER:${escapedSuperJs}')" title="Zufälliges Deck aus diesem Überordner starten">🎲</button>
                                    <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.SolitaireModule.startMixedCategoriesGame(null, 'SUPER:${escapedSuperJs}')" title="Kategorien aus diesem Überordner mischen">🔀</button>
                                ` : ''}
                                <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.SolitaireModule.createSolitaireSubFolder('${escapedSuperJs}')" title="Neuer Unterordner">+</button>
                                ${!isProtectedDefault ? `
                                    <button type="button" class="folder-action-btn edit-btn" onclick="event.stopPropagation(); window.renameSuperFolder('${escapedSuperJs}'); window.SolitaireModule.openView();" title="Umbenennen">✏️</button>
                                    <button type="button" class="folder-action-btn delete-folder-btn" onclick="event.stopPropagation(); window.removeCustomSuperFolder('${escapedSuperJs}'); window.SolitaireModule.openView();" title="Löschen">🗑️</button>
                                ` : ''}
                            </div>
                            <span class="super-count-pill">${solvedDecksInSuper}/${totalDecksInSuper}</span>
                            <span class="super-chevron">${arrowSymbol}</span>
                        </div>
                    </div>
                    <div class="super-folder-body" style="display:${isSuperOpen ? 'flex' : 'none'}; flex-direction:column; gap:10px;">
                        ${subFoldersHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="sol-lobby-wrapper">
                <div class="sol-lobby-header">
                    <div>
                        <div class="friends-kicker">CLINICAL DEDUCTION CARD GAME</div>
                        <h2 class="friends-main-title">🃏 Solitaire Associations Journey</h2>
                        <p class="friends-subtitle">
                            Klassische Solitaire-Treppe (1 bis 6 Karten von links nach rechts): Lege Krankheitsbilder frei, organisiere Decks in Ordnern oder mische Kategorien quer durch alle Decks.
                        </p>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.SolitaireModule.startRandomDeckGame('ALL')" title="Zieht sofort ein zufälliges komplettes Kartendeck">
                            🎲 Zufälliges Deck
                        </button>
                        ${unpublishedCount > 0 ? `
                            <button type="button" class="action-btn secondary btn-sm" style="border-color:rgba(56,189,248,0.45); color:var(--accent-blue);" onclick="window.SolitaireModule.publishAllLocalDecksToCloud(this)" title="Alle noch lokalen Kartendecks jetzt in Supabase veröffentlichen">
                                ☁️ Alle lokalen Decks online stellen (${unpublishedCount})
                            </button>
                        ` : ''}
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.SolitaireModule.generateDecksFromExistingCases()" title="Erstellt automatisch ein DDx-Deck aus deinen bestehenden MedCheck-Fällen">
                            ⚡ Aus App-Fällen generieren
                        </button>
                        <button type="button" class="action-btn btn-sm" onclick="window.SolitaireModule.toggleUploadPanel()">
                            📥 Eigenes Deck hochladen
                        </button>
                    </div>
                </div>

                <!-- Upload & Cloud-Import Panel -->
                <div id="sol-upload-panel" class="sol-upload-panel hidden">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                        <div>
                            <div style="font-weight:800; font-size:0.92rem; color:var(--text-main);">📦 Krankheitskartendeck importieren & online stellen (.json)</div>
                            <div style="font-size:0.76rem; color:var(--text-muted);">Ziehe eine JSON-Datei aus deinem Extraktions-Skill hierher oder füge den JSON-Code direkt ein.</div>
                        </div>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.SolitaireModule.copySkillMasterPrompt(this)">
                            📋 Skill Mega-Prompt & JSON-Schema kopieren
                        </button>
                    </div>

                    <div style="margin-bottom:10px;">
                        <label style="font-size:0.75rem; font-weight:700; color:var(--accent-blue); text-transform:uppercase; display:block; margin-bottom:4px;">📁 Ziel-Ordner (optional):</label>
                        <input type="text" id="sol-upload-folder-input" class="forge-topic-input" list="sol-known-folders-datalist" style="min-height:auto; padding:8px 12px; margin-bottom:0;" placeholder="Leer lassen für automatische Zuordnung aus JSON oder Ordnernamen eingeben...">
                        <datalist id="sol-known-folders-datalist">
                            ${knownSubFolders.map(f => `<option value="${escapeHtml(f)}"></option>`).join('')}
                        </datalist>
                    </div>

                    <div id="sol-file-dropzone" class="sol-file-dropzone">
                        <span>📂 <strong>JSON-Deckdatei hier ablegen</strong> oder klicken zum Durchsuchen</span>
                        <input type="file" id="sol-file-input" accept=".json" multiple style="display:none;">
                    </div>

                    <textarea id="sol-json-textarea" class="forge-textarea" style="height:130px; margin-top:10px; margin-bottom:10px;" placeholder='Oder JSON-Code des Kartendecks hier direkt einfügen...'></textarea>

                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem; font-weight:700; color:var(--accent-blue); cursor:pointer;">
                            <input type="checkbox" id="sol-auto-publish-checkbox" checked style="width:16px; height:16px; accent-color:var(--accent-blue);">
                            <span>☁️ Beim Importieren direkt in die Cloud stellen (für Handy, iPad & Freunde)</span>
                        </label>
                        <div style="display:flex; gap:8px;">
                            <button type="button" class="action-btn secondary btn-sm" onclick="window.SolitaireModule.toggleUploadPanel()">Schließen</button>
                            <button type="button" class="action-btn btn-sm" onclick="window.SolitaireModule.handlePasteImport()">✓ Validieren & Speichern</button>
                        </div>
                    </div>
                </div>

                <!-- INTERDISZIPLINÄRER KATEGORIEN-MIXER (35 BIS 70 KARTEN) -->
                <div class="sol-mixer-launchpad">
                    <div class="sol-mixer-top">
                        <div>
                            <div class="sol-mixer-kicker">🔀 CROSS-DECK RANDOMIZER • KATEGORIEN-MIXER</div>
                            <div class="sol-mixer-title">Krankheitsbilder deckübergreifend mischen</div>
                            <div class="sol-mixer-desc">${escapeHtml(activePreset.desc)}</div>
                        </div>
                        <div class="sol-mixer-controls">
                            <select class="depot-select" onchange="window.SolitaireModule.setMixerScope(this.value)" title="Quell-Decks für den Mix auswählen">
                                ${scopeOptionsHtml}
                            </select>
                            <div class="segmented-control" style="margin:0;">
                                <button type="button" class="segmented-btn ${mixerConfig.difficulty === 'easy' ? 'active' : ''}" onclick="window.SolitaireModule.setMixerDifficulty('easy')">
                                    Einfach (≥35 Karten)
                                </button>
                                <button type="button" class="segmented-btn ${mixerConfig.difficulty === 'medium' ? 'active' : ''}" onclick="window.SolitaireModule.setMixerDifficulty('medium')">
                                    Mittel (~50 Karten)
                                </button>
                                <button type="button" class="segmented-btn ${mixerConfig.difficulty === 'hard' ? 'active' : ''}" onclick="window.SolitaireModule.setMixerDifficulty('hard')">
                                    Schwierig (bis 70)
                                </button>
                            </div>
                            <button type="button" class="action-btn btn-sm" onclick="window.SolitaireModule.startMixedCategoriesGame()">
                                🔀 Kategorien-Mix starten ➔
                            </button>
                        </div>
                    </div>
                </div>

                <div class="sol-rules-strip">
                    <div class="sol-rule-pill"><span>👑</span> <strong>Krankheitsbild-Karte</strong> zuerst oben in einen der 4 Ziel-Slots ziehen (unten nicht bestapelbar!)</div>
                    <div class="sol-rule-pill"><span>📐</span> <strong>Solitaire-Treppe:</strong> Links kleinster Stapel (1 Karte), rechts größter Stapel (6 Karten)</div>
                    <div class="sol-rule-pill"><span>☁️</span> <strong>Cloud-Sync:</strong> Veröffentlichte Decks sind auf allen Geräten live!</div>
                </div>

                <!-- Ordner-Toolbar & Suche (wie im Dashboard) -->
                <div class="dashboard-subbar" style="margin: 4px 0;">
                    <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:240px;">
                        <input type="text" class="depot-search-input" style="flex:1; max-width:360px;" placeholder="🔍 Deck, Krankheitsbild oder Ordner suchen..." value="${escapeHtml(solSearchQuery)}" oninput="window.SolitaireModule.handleSolSearch(this.value)">
                        ${solSearchQuery ? `<button type="button" class="ghost-tool-btn" onclick="window.SolitaireModule.handleSolSearch('')">✕ Filter löschen</button>` : ''}
                    </div>
                    <div class="dashboard-quick-folder-btns">
                        <button type="button" class="ghost-tool-btn" onclick="window.SolitaireModule.expandAllSolFolders(true)">Alle öffnen</button>
                        <button type="button" class="ghost-tool-btn" onclick="window.SolitaireModule.expandAllSolFolders(false)">Alle schließen</button>
                        <button type="button" class="ghost-tool-btn" onclick="window.SolitaireModule.createSolitaireSuperFolder()">+ Überordner</button>
                        <button type="button" class="ghost-tool-btn" onclick="window.SolitaireModule.createSolitaireSubFolder()">+ Ordner</button>
                    </div>
                </div>

                <!-- Überordner & Unterordner Baum -->
                <div id="sol-super-folders-wrapper" style="display:flex; flex-direction:column; gap:12px;">
                    ${superFoldersHtml}
                </div>
            </div>
        `;

        bindDropzoneEvents();
        bindSolitaireFolderDragAndDrop(container);
    }

    function bindSolitaireFolderDragAndDrop(container) {
        container.querySelectorAll('.sol-deck-card[data-sol-deck-id]').forEach(deckEl => {
            const deckId = decodeURIComponent(deckEl.dataset.solDeckId);
            deckEl.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                draggedSolDeckId = deckId;
                draggedSolSubFolder = null;
                deckEl.classList.add('case-card-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', deckId);
            });
            deckEl.addEventListener('dragend', () => {
                deckEl.classList.remove('case-card-dragging');
                draggedSolDeckId = null;
            });
        });

        container.querySelectorAll('.sol-category-folder').forEach(folderEl => {
            const subName = decodeURIComponent(folderEl.dataset.solSubfolder);

            folderEl.addEventListener('dragstart', (e) => {
                if (e.target.closest('.sol-deck-card')) return;
                e.stopPropagation();
                draggedSolSubFolder = subName;
                draggedSolDeckId = null;
                folderEl.classList.add('folder-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', subName);
            });

            folderEl.addEventListener('dragend', () => {
                folderEl.classList.remove('folder-dragging');
                draggedSolSubFolder = null;
                container.querySelectorAll('.drag-over-folder, .super-folder-drag-over').forEach(el => {
                    el.classList.remove('drag-over-folder', 'super-folder-drag-over');
                });
            });

            folderEl.addEventListener('dragover', (e) => {
                if (!draggedSolDeckId) return;
                e.preventDefault();
                e.stopPropagation();
                folderEl.classList.add('drag-over-folder');
            });

            folderEl.addEventListener('dragleave', (e) => {
                if (!folderEl.contains(e.relatedTarget)) {
                    folderEl.classList.remove('drag-over-folder');
                }
            });

            folderEl.addEventListener('drop', (e) => {
                if (!draggedSolDeckId) return;
                e.preventDefault();
                e.stopPropagation();
                folderEl.classList.remove('drag-over-folder');
                const idToMove = draggedSolDeckId;
                draggedSolDeckId = null;
                moveDeckToFolder(idToMove, subName);
            });
        });

        container.querySelectorAll('.sol-super-folder').forEach(superEl => {
            const superTitle = decodeURIComponent(superEl.dataset.solSuperTitle);

            superEl.addEventListener('dragover', (e) => {
                if (!draggedSolSubFolder && !draggedSolDeckId) return;
                e.preventDefault();
                superEl.classList.add('super-folder-drag-over');
            });

            superEl.addEventListener('dragleave', (e) => {
                if (!superEl.contains(e.relatedTarget)) {
                    superEl.classList.remove('super-folder-drag-over');
                }
            });

            superEl.addEventListener('drop', (e) => {
                if (e.target.closest('.sol-category-folder') && draggedSolDeckId) return;
                e.preventDefault();
                e.stopPropagation();
                superEl.classList.remove('super-folder-drag-over');

                if (draggedSolSubFolder) {
                    const folderToMove = draggedSolSubFolder;
                    draggedSolSubFolder = null;
                    moveSolitaireFolderToSuper(folderToMove, superTitle);
                } else if (draggedSolDeckId) {
                    const idToMove = draggedSolDeckId;
                    draggedSolDeckId = null;
                    moveSolitaireFolderToSuper(superTitle, superTitle);
                    moveDeckToFolder(idToMove, superTitle);
                }
            });
        });
    }

    // ----------------------------------------------------------------------
    // 17. RENDERING: SPIELKARTEN & 6-DECK SPIELFELD (EXAKTER V3.3+ STYLE)
    // ----------------------------------------------------------------------
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
                                Gelöst: <strong>${solvedDiseasesCount}/${totalDiseases}</strong> (${gameState.totalCardsInSession || 0} Karten) • <em>6 Kartendecks (Treppe 1–6) • Kein Move-Abzug bei Fehlern</em>
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

                <!-- OBERE REIHE: 6 SYMMETRISCHE HOCHKANT-SLOTS -->
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
                                <span style="font-size:1.25rem;">↻</span>
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

                <!-- UNTERES TABLEAU: 6 SYMMETRISCHE HOCHKANT-KARTENDECKS IN SOLITAIRE-TREPPENFORM -->
                <div class="sol-tableau-grid">
                    ${gameState.tableau.map((col, colIdx) => {
                        const hiddenCount = col.filter(c => !c.faceUp).length;
                        return `
                            <div class="sol-tableau-col-wrap">
                                <div class="sol-col-header-pill">
                                    <span>Deck ${colIdx + 1}</span>
                                    ${hiddenCount > 0
                                        ? `<span class="sol-col-hidden-count" title="${hiddenCount} verdeckte Karte(n)">🔒 ${hiddenCount}</span>`
                                        : `<span class="sol-col-clear-tag">✓ Frei</span>`
                                    }
                                </div>
                                <div class="sol-tableau-col" data-tableau-col="${colIdx}">
                                    ${col.length === 0 ? `
                                        <div class="sol-card-slot-frame sol-tableau-empty-dropzone" data-tableau-col="${colIdx}">
                                            <span>Freies Deck<br><small>(Karte ablegen)</small></span>
                                        </div>
                                    ` : col.map((card, cardIdx) => {
                                        const isBottomPlayable = (cardIdx === col.length - 1);
                                        return renderCardHtml(card, 'tableau', colIdx, cardIdx, isBottomPlayable);
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
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
    // 18. 0ms POINTER-DRAG & MAGNETIC DROP-SNAPPING ENGINE
    // ----------------------------------------------------------------------
    function clearMagneticTargetHighlights() {
        document.querySelectorAll('.sol-magnetic-target').forEach(el => {
            el.classList.remove('sol-magnetic-target');
        });
    }

    function findBestMagneticDropTarget(ghostRect, sourceObj) {
        const candidates = [];
        const magneticPadding = 24;

        document.querySelectorAll('.sol-foundation-slot').forEach(slotEl => {
            const idx = parseInt(slotEl.dataset.foundationIdx, 10);
            const r = slotEl.getBoundingClientRect();
            candidates.push({ type: 'foundation', index: idx, el: slotEl, rect: r });
        });

        document.querySelectorAll('.sol-tableau-col').forEach(colEl => {
            const idx = parseInt(colEl.dataset.tableauCol, 10);
            if (sourceObj.zone === 'tableau' && sourceObj.colIdx === idx) return;

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
                if (target) {
                    if (ghostEl) ghostEl.remove();
                    if (originEl) originEl.classList.remove('is-dragging-source');

                    if (target.type === 'foundation') {
                        attemptMoveToFoundation(sourceObj, target.index);
                    } else if (target.type === 'tableau') {
                        attemptMoveToTableauColumn(sourceObj, target.index);
                    }
                    return;
                }

                animateGhostSpringBack(ghostEl, originRect, () => {
                    if (originEl) originEl.classList.remove('is-dragging-source');
                });
                return;
            }

            if (ghostEl) ghostEl.remove();
            if (originEl) originEl.classList.remove('is-dragging-source');

            if (isCancel) return;

            const now = Date.now();
            const isDoubleTap = (cardUid && dragSession.lastTapUid === cardUid && (now - dragSession.lastTapTime) < 380);
            dragSession.lastTapTime = now;
            dragSession.lastTapUid = cardUid;

            if (isDoubleTap) {
                if (attemptAutoMoveCard(sourceObj)) return;
            }

            if (gameState.selectedSource && sourceObj.zone === 'tableau') {
                const isSameCard = gameState.selectedSource.zone === sourceObj.zone &&
                                   gameState.selectedSource.colIdx === sourceObj.colIdx &&
                                   gameState.selectedSource.cardIdx === sourceObj.cardIdx;
                if (isSameCard) {
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

        const playableNodes = container.querySelectorAll('.sol-stacked-group.is-playable');
        playableNodes.forEach(nodeEl => {
            const zone = nodeEl.dataset.zone;
            const colIdx = parseInt(nodeEl.dataset.col, 10);
            const cardIdx = parseInt(nodeEl.dataset.idx, 10);
            const sourceObj = { zone, colIdx, cardIdx };

            nodeEl.addEventListener('contextmenu', (e) => e.preventDefault());

            nodeEl.addEventListener('pointerdown', (e) => {
                if (e.target.closest('[data-info-uid]')) return;
                if (e.button !== undefined && e.button !== 0) return;

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
        const autoPublish = document.getElementById('sol-auto-publish-checkbox')?.checked;
        const explicitFolder = document.getElementById('sol-upload-folder-input')?.value?.trim() || null;
        let importedDecks = [];

        for (const file of Array.from(fileList)) {
            try {
                const text = await file.text();
                const deck = validateAndImportDeckJson(text, explicitFolder);
                importedDecks.push(deck);
            } catch (err) {
                alert(`Fehler in Datei "${file.name}": ${err.message}`);
            }
        }

        if (importedDecks.length > 0) {
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
            renderView();

            if (autoPublish) {
                for (const d of importedDecks) {
                    await publishDeckToCloud(d.deck_id, null);
                }
            }
        }
    }

    async function handlePasteImport() {
        const ta = document.getElementById('sol-json-textarea');
        const autoPublish = document.getElementById('sol-auto-publish-checkbox')?.checked;
        const explicitFolder = document.getElementById('sol-upload-folder-input')?.value?.trim() || null;

        if (!ta || !ta.value.trim()) {
            alert('Bitte füge zuerst einen JSON-Code in das Textfeld ein.');
            return;
        }
        try {
            const deck = validateAndImportDeckJson(ta.value, explicitFolder);
            ta.value = '';
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
            renderView();

            if (autoPublish) {
                const ok = await publishDeckToCloud(deck.deck_id, null);
                if (ok) {
                    alert(`Deck „${deck.title}“ validiert, im Ordner „${deck.folder_name}“ gespeichert und direkt in die Cloud gestellt!`);
                    return;
                }
            }
            alert(`Deck „${deck.title}“ mit ${deck.diseases.length} Krankheitsbildern im Ordner „${deck.folder_name}“ lokal gespeichert!`);
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

    // Automatischer Cloud-Sync beim ersten Laden des Scripts
    setTimeout(() => {
        syncDecksFromCloud();
    }, 600);

    return {
        openView() {
            renderView();
            syncDecksFromCloud();
        },
        syncDecksFromCloud,
        publishDeckToCloud,
        publishAllLocalDecksToCloud,
        unpublishDeckFromCloud,
        exportDeckAsJsonFile,
        startNewGame,
        startRandomDeckGame,
        startMixedCategoriesGame,
        setMixerDifficulty(diffKey) {
            mixerConfig.difficulty = MIXER_PRESETS[diffKey] ? diffKey : 'easy';
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
            renderView();
        },
        setMixerScope(scopeVal) {
            mixerConfig.sourceScope = scopeVal || 'ALL';
            renderView();
        },
        toggleSolSuperFolder(superTitle) {
            solSuperFolderStates[superTitle] = !solSuperFolderStates[superTitle];
            renderView();
        },
        toggleSolSubFolder(subName) {
            solSubFolderStates[subName] = !solSubFolderStates[subName];
            renderView();
        },
        expandAllSolFolders(openState) {
            getSolitaireSuperFolderOrder().forEach(s => { solSuperFolderStates[s] = !!openState; });
            getAllKnownSolitaireSubFolders().forEach(f => { solSubFolderStates[f] = !!openState; });
            renderView();
        },
        handleSolSearch(val) {
            solSearchQuery = val || '';
            renderView();
        },
        createSolitaireSuperFolder,
        createSolitaireSubFolder,
        renameSolitaireSubFolder,
        deleteSolitaireSubFolder,
        promptMoveSolitaireFolderToSuper,
        promptMoveDeckToFolder,
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
