/**
 * Pharmacology Module - Modular Game & Learning Hub (V4.0)
 * Unterstützt:
 * 1. 1:1 Ordner- & Überordner-Synchronisation mit dem MedCheck-Dashboard
 * 2. Drag & Drop von Sets & Ordnern + Touch-Move-Modal (MedUI)
 * 3. Pharma-Compass (Pfeiltasten / WASD) & Indikations-Matrix (Drag & Drop)
 * 4. Kontext-sensitive KI-Prompt-Generierung pro Dashboard-Ordner
 * 5. Deep-Search (Wirkstoffe, Klassen, Pearls) & lokales Highscore-Tracking
 * 6. Vollautomatische bidirektionale Supabase-Cloud-Synchronisation
 */

const PharmacologyModule = (() => {
    const STORAGE_KEY          = 'medcheck_pharma_sets';
    const FOLDER_OVERRIDES_KEY = 'medcheck_pharma_folder_overrides_v1';
    const HIGHSCORES_KEY       = 'medcheck_pharma_highscores_v1';

    // Eigene SVG-Icons (unabhängig vom lokalen Scope in app.js)
    const PharmaIcons = {
        edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
        trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
        move: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
        plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
    };

    let state = {
        activeSubView: 'hub', // 'hub' | 'arrow_compass' | 'drag_matrix' | 'prompts' | 'import'
        modeFilter: 'all',    // 'all' | 'arrow_compass' | 'drag_matrix'
        showEmptyDashboardFolders: true, // Zeigt standardmäßig alle Dashboard-Ordner
        searchQuery: '',
        importType: 'arrow_compass',
        importTargetFolder: '',
        currentSet: null,
        currentQuestionIndex: 0,
        score: 0,
        streak: 0,
        isAnswered: false,
        selectedDirection: null,
        matrixPlacements: {},
        matrixEvaluated: false,
        selectedDrugForClickMove: null,
        customSets: [],
        cloudSetIds: new Set(),
        openSuperFolders: {},
        openSubFolders: {},
        draggedPharmaState: null
    };

    // =========================================================================
    // VORINSTALLIERTE STANDARD-SETS
    // =========================================================================
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
                        up: { drug: "Spironolacton", class: "Aldosteronantagonist (MRA)", is_correct: false, feedback: "Kontraindiziert! Bei Kalium > 5,0 mmol/l droht unter MRA eine lebensbedrohliche Hyperkaliämie." },
                        right: { drug: "Dapagliflozin", class: "SGLT2-Inhibitor", is_correct: true, feedback: "Korrekt! SGLT2-Hemmer verbessern die Prognose bei HFrEF, schützen die Niere und erhöhen den Kaliumspiegel nicht." },
                        down: { drug: "Verapamil", class: "Kalziumantagonist (Phenylalkylamin)", is_correct: false, feedback: "Kontraindiziert bei HFrEF! Wirkt stark negativ inotrop und begünstigt eine kardiale Dekompensation." },
                        left: { drug: "Valsartan Aufdosierung", class: "AT1-Rezeptorantagonist", is_correct: false, feedback: "Falsch. Eine Steigerung der RAAS-Blockade bei Kalium 5,6 mmol/l treibt das Kalium in kritische Bereiche." }
                    },
                    pearl: "SGLT2-Inhibitoren erleichtern durch Förderung der Kaliumausscheidung oft sogar die spätere Hinzunahme von MRA."
                },
                {
                    id: "q2",
                    patient_context: "54-jährige Patientin mit Vorhofflimmern (unter Apixaban), Hypertonie und neu diagnostizierter schwerer Systemmykose.",
                    prompt: "Welches Antimykotikum führt über eine starke CYP3A4- und P-gp-Hemmung zu einem massiv erhöhten Blutungsrisiko unter Apixaban?",
                    directions: {
                        up: { drug: "Itraconazol", class: "Triazol-Antimykotikum", is_correct: true, feedback: "Richtig erkannt! Itraconazol ist ein potenter Inhibitor von CYP3A4 und P-Glykoprotein -> Apixaban-Spiegel steigen drastisch an." },
                        right: { drug: "Terbinafin", class: "Allylamin-Antimykotikum", is_correct: false, feedback: "Falsch. Terbinafin hemmt primär CYP2D6 und zeigt keine klinisch relevante Interaktion mit Apixaban." },
                        down: { drug: "Nystatin", class: "Polyen-Antimykotikum", is_correct: false, feedback: "Falsch. Nystatin wird bei oraler Gabe kaum resorbiert und zeigt keine CYP-Interaktionen." },
                        left: { drug: "Caspofungin", class: "Echinocandin", is_correct: false, feedback: "Falsch. Echinocandine sind keine starken Inhibitoren von CYP3A4 oder P-gp." }
                    },
                    pearl: "Azol-Antimykotika (Itraconazol, Voriconazol, Posaconazol, Ketoconazol) sind klassische Staatsexamens-Fallen für CYP3A4/P-gp-Interaktionen mit DOAKs."
                },
                {
                    id: "q3",
                    patient_context: "72-jähriger Patient mit idiopathischem Morbus Parkinson (unter L-Dopa/Benserazid) entwickelt postoperativ starke Übelkeit und Erbrechen.",
                    prompt: "Welches Antiemetikum ist hier Mittel der 1. Wahl, da es die Blut-Hirn-Schranke kaum überwindet und die Parkinson-Symptomatik nicht verschlechtert?",
                    directions: {
                        up: { drug: "Metoclopramid (MCP)", class: "Zentraler D2-Antagonist", is_correct: false, feedback: "Streng kontraindiziert! MCP passiert die Blut-Hirn-Schranke, blockiert striatale D2-Rezeptoren und löst eine akinetische Krise aus." },
                        right: { drug: "Haloperidol", class: "Typisches Neuroleptikum", is_correct: false, feedback: "Kontraindiziert! Hochpotenter zentraler D2-Blocker -> massive Verschlechterung der Rigor- und Akinese-Symptomatik." },
                        down: { drug: "Domperidon", class: "Peripherer D2-Antagonist", is_correct: true, feedback: "Korrekt! Domperidon wirkt an der Area postrema, überwindet die Blut-Hirn-Schranke aber kaum (Cave: QT-Zeit beachten!)." },
                        left: { drug: "Promethazin", class: "Niederpotentes Antipsychotikum", is_correct: false, feedback: "Ungünstig durch zentrale Dopaminrezeptor-Blockade und ausgeprägte anticholinerge Delir-Gefahr." }
                    },
                    pearl: "Parkinson + Übelkeit = Domperidon (oder 5-HT3-Antagonisten wie Ondansetron, sofern kein Apomorphin gegeben wird!). Niemals MCP!"
                }
            ]
        },
        {
            set_id: "pharma_psych_compass_002",
            title: "Antidepressiva & Antipsychotika (Kompass)",
            medical_field: "Klinische Pharmakologie / Psychiatrie",
            game_type: "arrow_compass",
            questions: [
                {
                    id: "q1",
                    patient_context: "Eine 52-jährige Brustkrebspatientin unter adjuvanter Tamoxifen-Therapie entwickelt eine depressive Episode. Medikamentenwechselwirkungen müssen zwingend vermieden werden.",
                    prompt: "Welches Antidepressivum ist aufgrund seiner starken CYP2D6-Inhibition (verminderte Bildung von aktivem Endoxifen) unter Tamoxifen kontraindiziert?",
                    directions: {
                        up: { drug: "Paroxetin", class: "SSRI", is_correct: true, feedback: "Exakt! Paroxetin (wie auch Fluoxetin) ist ein starker CYP2D6-Inhibitor und erhöht nachweislich die Brustkrebsmortalität unter Tamoxifen." },
                        right: { drug: "Sertralin", class: "SSRI", is_correct: false, feedback: "Sertralin hemmt CYP2D6 nur schwach bis moderat." },
                        down: { drug: "Citalopram", class: "SSRI", is_correct: false, feedback: "Citalopram ist ein schwacher CYP2D6-Inhibitor." },
                        left: { drug: "Venlafaxin", class: "SNRI", is_correct: false, feedback: "Venlafaxin zeigt die geringste CYP2D6-Hemmung und wird bei Tamoxifen-Therapie oft bevorzugt." }
                    },
                    pearl: "Tamoxifen ist ein Prodrug, das über CYP2D6 in Endoxifen umgewandelt wird. Starke CYP2D6-Hemmer (Paroxetin, Fluoxetin, Bupropion) führen zum Wirkverlust!"
                },
                {
                    id: "q2",
                    patient_context: "Ein 68-jähriger Patient mit schwerer Depression erhält Amitriptylin. Nach wenigen Tagen entwickelt er Mundtrockenheit, Mydriasis, Akkommodationsstörungen, Obstipation und Harnverhalt.",
                    prompt: "Welche Rezeptorblockade der trizyklischen Antidepressiva (TCA) verursacht dieses klassische Toxidrom?",
                    directions: {
                        up: { drug: "Histamin H1-Rezeptor", class: "Rezeptorblockade", is_correct: false, feedback: "H1-Blockade bewirkt starke Sedation und Appetit-/Gewichtszunahme." },
                        right: { drug: "Muskarinischer ACh-Rezeptor (M1)", class: "Rezeptorblockade", is_correct: true, feedback: "Richtig! Die Blockade muskarinischer Acetylcholinrezeptoren verursacht das atropinartige anticholinerge Syndrom." },
                        down: { drug: "Alpha-1-Adrenozeptor", class: "Rezeptorblockade", is_correct: false, feedback: "Alpha-1-Blockade führt zu orthostatischer Hypotonie und Reflextachykardie." },
                        left: { drug: "5-HT2A-Rezeptor", class: "Rezeptorblockade", is_correct: false, feedback: "5-HT2A-Blockade wirkt primär anxiolytisch." }
                    },
                    pearl: "TCA wirken als 'dirty drugs' an SERT/NET sowie M1 (anticholinerg), H1 (Sedation, Gewicht↑) und Alpha-1 (Orthostase)."
                },
                {
                    id: "q3",
                    patient_context: "Ein Patient unter stabiler Lithium-Phasenprophylaxe (0.7 mmol/L) erleidet eine fieberhafte Gastroenteritis mit massivem Erbrechen und Diarrhoe. Er wirkt zunehmend ataktisch, dysarthrisch und somnolent.",
                    prompt: "Welcher Mechanismus führt hier zur akuten Lithium-Intoxikation?",
                    directions: {
                        up: { drug: "CYP3A4-Inhibition in der Leber", class: "Metabolismus", is_correct: false, feedback: "Lithium wird überhaupt nicht hepatisch metabolisiert, sondern unverändert renal ausgeschieden." },
                        right: { drug: "Verdrängung aus der Plasmaproteinbindung", class: "Verteilung", is_correct: false, feedback: "Lithium ist nicht relevant an Plasmaproteine gebunden." },
                        down: { drug: "Kompensatorische Rückresorption mit Natrium im proximalen Tubulus", class: "Renale Elimination", is_correct: true, feedback: "Korrekt! Bei Salz- und Volumenmangel steigert die Niere im proximalen Tubulus die Natrium- und damit identisch auch die Lithium-Rückresorption." },
                        left: { drug: "Hemmung der P-Glykoprotein-Pumpe", class: "Transporter", is_correct: false, feedback: "Spielt für das einwertige Kation Lithium keine Rolle." }
                    },
                    pearl: "Hyponatriämie, Dehydratation sowie NSAR, ACE-Hemmer/Sartane und Thiazide erhöhen den Lithiumspiegel bis in letale Bereiche!"
                },
                {
                    id: "q4",
                    patient_context: "Ein 34-jähriger Patient mit therapieresistenter Schizophrenie wird erfolgreich auf Clozapin eingestellt. In Woche 6 klagt er über Halsschmerzen und Fieber (38.9 °C).",
                    prompt: "Welche potenziell letale UAW muss sofort mittels Bestimmung der absoluten Neutrophilenzahl (ANC) ausgeschlossen werden?",
                    directions: {
                        up: { drug: "Rhabdomyolyse", class: "Muskuläre UAW", is_correct: false, feedback: "Kommt beim malignen neuroleptischen Syndrom vor, erklärt aber nicht primär die Pharyngitis durch Granulozytenmangel." },
                        right: { drug: "Thrombozytopenie", class: "Hämatologische UAW", is_correct: false, feedback: "Nicht die charakteristische Leitkomplikation von Clozapin." },
                        down: { drug: "Nephrogener Diabetes insipidus", class: "Renale UAW", is_correct: false, feedback: "Dies ist eine klassische Spätkomplikation von Lithium (AVP-Resistenz)." },
                        left: { drug: "Agranulozytose", class: "Hämatologische UAW", is_correct: true, feedback: "Exakt! Clozapin hat ein ca. 0.7–0.8%iges Risiko für eine Agranulozytose (85% treten in den ersten 18 Wochen auf)." }
                    },
                    pearl: "Unter Clozapin gilt ein obligates ANC-Monitoring: Woche 0–18 wöchentlich, Woche 18–52 monatlich!"
                },
                {
                    id: "q5",
                    patient_context: "Eine 29-jährige Patientin mit Depression, ausgeprägter Insomnie und ungewolltem Gewichtsverlust soll ein Antidepressivum erhalten, das bereits in der ersten Woche den Schlaf fördert und den Appetit steigert.",
                    prompt: "Welcher Wirkstoff eignet sich durch seinen präsynaptischen Alpha-2-Antagonismus und starken H1-Antagonismus hierfür optimal?",
                    directions: {
                        up: { drug: "Bupropion", class: "NDRI", is_correct: false, feedback: "Bupropion wirkt stark aktivierend und kann Insomnie verstärken." },
                        right: { drug: "Mirtazapin", class: "Alpha-2- & 5-HT2/3-Antagonist", is_correct: true, feedback: "Richtig! Mirtazapin wirkt über H1-Blockade stark sedierend und appetitsteigernd, ohne anticholinerge oder sexuelle UAW." },
                        down: { drug: "Venlafaxin", class: "SNRI", is_correct: false, feedback: "Venlafaxin wirkt antriebssteigernd und kann den Blutdruck erhöhen." },
                        left: { drug: "Fluoxetin", class: "SSRI", is_correct: false, feedback: "Fluoxetin wirkt aktivierend und führt anfangs eher zu Gewichtsverlust und Unruhe." }
                    },
                    pearl: "Mirtazapin blockiert präsynaptische Alpha-2-Autorezeptoren (NA & 5-HT ↑) sowie postsynaptische 5-HT2/5-HT3- und H1-Rezeptoren (kaum Übelkeit, kaum Sexualstörungen, starke Sedation)."
                },
                {
                    id: "q6",
                    patient_context: "Eine 24-jährige Patientin mit Bulimie und bekannter juveniler Epilepsie wünscht ein aktivierendes Antidepressivum ohne Risiko für Gewichtszunahme oder sexuelle Funktionsstörungen.",
                    prompt: "Welches Antidepressivum ist trotz passendem Wirkprofil bei dieser Patientin wegen Senkung der Krampfschwelle kontraindiziert?",
                    directions: {
                        up: { drug: "Agomelatin", class: "MT1/MT2-Agonist & 5-HT2C-Antagonist", is_correct: false, feedback: "Agomelatin erfordert zwar regelmäßige Leberwertkontrollen, ist aber kein klassischer Krampfschwellensenker wie Bupropion." },
                        right: { drug: "Sertralin", class: "SSRI", is_correct: false, feedback: "SSRI sind bei Bulimie sogar indiziert." },
                        down: { drug: "Bupropion", class: "NDRI", is_correct: true, feedback: "Korrekt! Bupropion senkt die Krampfschwelle relevant und ist bei Epilepsie sowie Essstörungen (Bulimie/Anorexie) absolut kontraindiziert." },
                        left: { drug: "Escitalopram", class: "SSRI", is_correct: false, feedback: "Verursacht zwar häufiger sexuelle UAW, ist aber bei Epilepsie/Essstörung nicht primär kontraindiziert." }
                    },
                    pearl: "Bupropion (NDRI) ist ideal bei Anhedonie/Antriebsmangel und zur Raucherentwöhnung, aber kontraindiziert bei Epilepsie und Essstörungen!"
                },
                {
                    id: "q7",
                    patient_context: "Eine organtransplantierte Patientin (unter Immunsuppression mit Ciclosporin) nimmt wegen gedrückter Stimmung freiverkäufliches Johanniskraut (Hypericum perforatum, reich an Hyperforin) ein.",
                    prompt: "Welche gefährliche pharmakokinetische Interaktion droht hier?",
                    directions: {
                        up: { drug: "Starke CYP3A4- & P-gp-Induktion mit Abstoßungskrise", class: "Enzyminduktion", is_correct: true, feedback: "Volltreffer! Hyperforin induziert CYP3A4 und P-gp massiv -> Ciclosporin-Spiegel sinken um 50–70% -> akute Organabstoßung!" },
                        right: { drug: "CYP2D6-Hemmung mit Ciclosporin-Nephrotoxizität", class: "Enzymhemmung", is_correct: false, feedback: "Falsch, Hypericum ist ein Induktor, kein relevanter Inhibitor." },
                        down: { drug: "Renale Tubulusblockade", class: "Ausscheidung", is_correct: false, feedback: "Trifft nicht zu." },
                        left: { drug: "Reine pharmakodynamische Sedierungsverstärkung", class: "Pharmakodynamik", is_correct: false, feedback: "Das Hauptproblem ist die dramatische Spiegelsenkung durch CYP3A4-Induktion." }
                    },
                    pearl: "Hyperforin im Johanniskraut induziert CYP3A4 und P-gp (Spiegelabfall von Ciclosporin, Tacrolimus, HIV-Medikamenten, DOAKs und Kontrazeptiva). Ausnahme: hyperforinarme Extrakte wie Ze 117."
                },
                {
                    id: "q8",
                    patient_context: "Ein 22-jähriger Patient erhält wegen einer akuten Psychose hochdosiert Haloperidol i.m. Am 2. Tag entwickelt er schmerzhafte Verkrampfungen der Zungen-, Schlund- und Augenmuskulatur (okulogyre Krise).",
                    prompt: "Um welche extrapyramidale Störung (EPS) handelt es sich und was ist das Antidot der 1. Wahl?",
                    directions: {
                        up: { drug: "Spätdyskinesie -> Therapie mit Clozapin", class: "Chronische EPS", is_correct: false, feedback: "Spätdyskinesien treten erst nach Monaten/Jahren durch D2-Hypersensitivität auf und sprechen NICHT auf Biperiden an." },
                        right: { drug: "Frühdyskinesie -> Therapie mit Biperiden (mACh-Antagonist)", class: "Akute EPS (<1 Woche)", is_correct: true, feedback: "Exakt! Akute Dystonien/Frühdyskinesien entstehen durch ein striatales Dopamin-Tal mit relativem Acetylcholin-Überschuss und verschwinden rasch unter Biperiden." },
                        down: { drug: "Malignes neuroleptisches Syndrom -> Dantrolen", class: "Notfall-EPS", is_correct: false, feedback: "Das MNS geht mit extremem Rigor, hohem Fieber, CK-Anstieg und autonomer Instabilität einher." },
                        left: { drug: "Akathisie -> Dosissteigerung von Haloperidol", class: "Subakute EPS", is_correct: false, feedback: "Eine Dosissteigerung würde die EPS massiv verschlimmern!" }
                    },
                    pearl: "Frühdyskinesie (Tage) und Parkinsonoid (Wochen) reagieren prompt auf Anticholinergika (Biperiden). Bei irreversibler Spätdyskinesie (Jahre) verschlechtert Biperiden die Symptomatik -> Wechsel auf Clozapin!"
                },
                {
                    id: "q9",
                    patient_context: "Bei einem Patienten soll ein Wechsel von einem SSRI (bzw. Clomipramin) auf einen irreversiblen MAO-Hemmer erfolgen. Zudem erhält er Schmerzmittel.",
                    prompt: "Welches Analgetikum kann in Kombination mit SSRI oder MAO-Hemmern ein lebensbedrohliches Serotonin-Syndrom (Trias: Klonus/Hyperreflexie, Hyperthermie, Agitation) auslösen?",
                    directions: {
                        up: { drug: "Paracetamol", class: "Nicht-Opioid-Analgetikum", is_correct: false, feedback: "Paracetamol hat keine relevante serotonerge Wiederaufnahmehemmung." },
                        right: { drug: "Ibuprofen", class: "NSAR", is_correct: false, feedback: "Ibuprofen erhöht zwar unter SSRI das GI-Blutungsrisiko, löst aber kein Serotonin-Syndrom aus." },
                        down: { drug: "Tramadol", class: "Opioid mit SERT/NET-Hemmung", is_correct: true, feedback: "Richtig! Tramadol (ebenso wie Fentanyl, Pethidin, Dextromethorphan oder Linezolid) wirkt serotonerg und triggert mit SSRI/MAOI ein Serotonin-Syndrom." },
                        left: { drug: "Metamizol", class: "Pyrazolon", is_correct: false, feedback: "Metamizol birgt ein Agranulozytose-Risiko, aber kein Risiko für ein Serotonin-Syndrom." }
                    },
                    pearl: "Serotonin-Syndrom-Trigger unter SSRI: MAO-Hemmer (mind. 2 Wochen Karenzzeit!), Tramadol, Dextromethorphan, Linezolid."
                },
                {
                    id: "q10",
                    patient_context: "Ein 45-jähriger Patient mit schwerer therapieresistenter Depression (nach 2 Antidepressiva und Lithium-Augmentation ohne Erfolg, CGI-S 6) wird in einem psychiatrischen Zentrum vorstellig.",
                    prompt: "Welches nasal applizierte Medikament wirkt als nicht-kompetitiver NMDA-Rezeptor-Antagonist oft bereits innerhalb von 24 Stunden antidepressiv und antisuizidal?",
                    directions: {
                        up: { drug: "Agomelatin", class: "Melatonin-Agonist", is_correct: false, feedback: "Agomelatin wird oral gegeben und wirkt über MT1/MT2 und 5-HT2C." },
                        right: { drug: "Esketamin (Spravato)", class: "NMDA-Rezeptor-Antagonist", is_correct: true, feedback: "Exakt! Esketamin-Nasenspray wirkt über das Glutamat-System extrem rasch, erfordert aber mind. 2h Nachüberwachung (Blutdruck↑, Dissoziation, Sedierung)." },
                        down: { drug: "Vortioxetin", class: "Multimodaler Serotonin-Modulator", is_correct: false, feedback: "Vortioxetin ist ein orales Antidepressivum mit langer HWZ (66h)." },
                        left: { drug: "Reboxetin", class: "Selektiver NRI", is_correct: false, feedback: "Reboxetin ist ein klassischer oraler Noradrenalin-Wiederaufnahmehemmer." }
                    },
                    pearl: "Esketamin-Nasenspray wirkt binnen 24h über NMDA-Blockade. Zwingend 2 Stunden Überwachung in der Praxis wegen Dissoziation und Blutdruckanstieg!"
                }
            ]
        },
        {
            set_id: "pharma_matrix_psych_001",
            title: "Psychopharmaka: Krankheitsbilder & 1. Wahl",
            medical_field: "Psychiatrie / Klinische Pharmakologie",
            game_type: "drag_matrix",
            description: "Ziehe die Medikamente per Drag & Drop (oder durch Antippen) in das jeweils passende Krankheitsbild bzw. klinische Szenario.",
            categories: [
                { id: "cat_mdd_anxiety", name: "Major Depression & Angst-/Zwangsstörung (1. Wahl)" },
                { id: "cat_bipolar", name: "Bipolare Störung (Akute Manie & Phasenprophylaxe)" },
                { id: "cat_trd_schizo", name: "Therapieresistente Schizophrenie & Spätdyskinesie" },
                { id: "cat_adhd_anhedonia", name: "ADHS / Antriebslose Depression (Noradrenerg/Dopaminerg)" }
            ],
            drugs: [
                { id: "m1_d1", name: "Sertralin", subtitle: "SSRI (SERT-Hemmer)", correct_cat: "cat_mdd_anxiety" },
                { id: "m1_d2", name: "Escitalopram", subtitle: "SSRI (Cave: QT-Zeit)", correct_cat: "cat_mdd_anxiety" },
                { id: "m1_d3", name: "Lithium (Quilonorm)", subtitle: "Kation / IP3-Modulator", correct_cat: "cat_bipolar" },
                { id: "m1_d4", name: "Lamotrigin / Valproat", subtitle: "Stimmungsstabilisierende Antikonvulsiva", correct_cat: "cat_bipolar" },
                { id: "m1_d5", name: "Clozapin", subtitle: "Atypikum (Cave: ANC / Agranulozytose)", correct_cat: "cat_trd_schizo" },
                { id: "m1_d6", name: "Olanzapin", subtitle: "Atypikum (D2/5-HT2-Blocker, Cave: Gewicht↑)", correct_cat: "cat_trd_schizo" },
                { id: "m1_d7", name: "Atomoxetin (Strattera)", subtitle: "Selektiver NRI (NET-Hemmer)", correct_cat: "cat_adhd_anhedonia" },
                { id: "m1_d8", name: "Bupropion (Wellbutrin)", subtitle: "NDRI (NET/DAT-Hemmer, Cave: Krampfschwelle)", correct_cat: "cat_adhd_anhedonia" }
            ]
        },
        {
            set_id: "pharma_matrix_tox_002",
            title: "UAW-Profile, Toxidrome & Notfall-Management",
            medical_field: "Klinische Toxikologie",
            game_type: "drag_matrix",
            description: "Ordne die klinischen Befunde, Auslöser und Antidote dem jeweiligen pharmakologischen Syndrom zu.",
            categories: [
                { id: "tox_antichol", name: "Anticholinerges Syndrom (M1-Blockade)" },
                { id: "tox_serotonin", name: "Serotonin-Syndrom (5-HT-Exzess)" },
                { id: "tox_mns", name: "Malignes Neuroleptisches Syndrom (D2-Blockade)" },
                { id: "tox_eps_acute", name: "Akute Frühdyskinesie & Parkinsonoid (Striataler D2-Block)" }
            ],
            drugs: [
                { id: "m2_d1", name: "Amitriptylin / Doxepin Überdosis", subtitle: "Klassische TCA", correct_cat: "tox_antichol" },
                { id: "m2_d2", name: "Heiße trockene Haut, Mydriasis & Harnverhalt", subtitle: "Klinisches Leitsymptom", correct_cat: "tox_antichol" },
                { id: "m2_d3", name: "SSRI + Moclobemid / Tramadol", subtitle: "Gefährliche Komedikation", correct_cat: "tox_serotonin" },
                { id: "m2_d4", name: "Spontaner Klonus, Hyperreflexie & Diarrhoe", subtitle: "Neuromuskuläre Übererregbarkeit", correct_cat: "tox_serotonin" },
                { id: "m2_d5", name: "Dantrolen + Bromocriptin + Kühlung", subtitle: "Spezifische Intensivtherapie", correct_cat: "tox_mns" },
                { id: "m2_d6", name: "Ausgeprägter Rigor, Fieber & massive CK-Erhöhung", subtitle: "Rhabdomyolyse-Gefahr", correct_cat: "tox_mns" },
                { id: "m2_d7", name: "Biperiden i.v. (Akineton)", subtitle: "Zentrales Anticholinergikum (Antidot)", correct_cat: "tox_eps_acute" },
                { id: "m2_d8", name: "Zungen-/Schlundkrämpfe unter Haloperidol", subtitle: "Dystonie in Woche 1", correct_cat: "tox_eps_acute" }
            ]
        }
    ];

    // =========================================================================
    // HILFSFUNKTIONEN & PERSISTENZ
    // =========================================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function getSupabase() {
        return window.supabaseClient || window.supabase || window.sb || null;
    }

    function getFolderOverrides() {
        try {
            return JSON.parse(localStorage.getItem(FOLDER_OVERRIDES_KEY) || '{}');
        } catch (_e) {
            return {};
        }
    }

    function saveFolderOverrides(map) {
        try {
            localStorage.setItem(FOLDER_OVERRIDES_KEY, JSON.stringify(map));
        } catch (_e) {}
    }

    function getDeletedDashboardFolders() {
        try {
            return new Set(JSON.parse(localStorage.getItem('medcheck_deleted_folders_v1') || '[]'));
        } catch (_e) {
            return new Set();
        }
    }

    function getHighscores() {
        try {
            return JSON.parse(localStorage.getItem(HIGHSCORES_KEY) || '{}');
        } catch (_e) {
            return {};
        }
    }

    function recordHighscore(setId, achieved, total) {
        if (!setId || !total) return;
        const scores = getHighscores();
        const pct = Math.round((achieved / total) * 100);
        const prev = scores[setId];
        if (!prev || pct >= prev.pct) {
            scores[setId] = { achieved, total, pct, updatedAt: Date.now() };
            try {
                localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(scores));
            } catch (_e) {}
        }
    }

    function resolveSetFolder(setObj) {
        if (!setObj) return 'Allgemein';
        const overrides = getFolderOverrides();
        const deleted = getDeletedDashboardFolders();

        let folder = (
            overrides[setObj.set_id] ||
            setObj.folder_name ||
            setObj.medical_field ||
            'Allgemein'
        ).trim();

        if (deleted.has(folder)) {
            folder = 'Allgemein';
        }
        return folder || 'Allgemein';
    }

    function loadSavedSets() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) state.customSets = parsed;
            }
        } catch (e) {
            console.error("Fehler beim Laden der lokalen Pharma-Sets:", e);
        }
    }

    function saveLocalSets() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customSets));
        } catch (e) {
            console.error("Fehler beim Speichern im LocalStorage:", e);
        }
    }

    function getAllSets() {
        const defaultIds = new Set(defaultSets.map(s => s.set_id));
        const filteredCustom = state.customSets.filter(s => s && !defaultIds.has(s.set_id));
        const combined = [...defaultSets, ...filteredCustom];

        return combined.map(s => {
            const resolvedFolder = resolveSetFolder(s);
            return {
                ...s,
                folder_name: resolvedFolder,
                medical_field: resolvedFolder
            };
        });
    }

    // =========================================================================
    // DASHBOARD-ORDNER-SYNCHRONISATION (1:1 IDENTISCHE STRUKTUR)
    // =========================================================================
    function getDashboardSuperFolders() {
        if (typeof window.getSuperFolderOrder === 'function') {
            return window.getSuperFolderOrder();
        }
        try {
            const saved = JSON.parse(localStorage.getItem('medcheck_super_folder_order_v1') || 'null');
            if (Array.isArray(saved) && saved.length > 0) return saved;
        } catch (_e) {}
        return [
            'Nervensystem und Sinnesorgane',
            'Psyche / Ethik / Recht',
            'Reproduktion',
            'Allgemein'
        ];
    }

    function getSuperFolderForSubfolder(subFolderName) {
        if (typeof window.getSuperFolderForCategory === 'function') {
            return window.getSuperFolderForCategory(subFolderName);
        }
        return 'Allgemein';
    }

    function getAllUnifiedSubfolders(allPharmaSets = []) {
        const deleted = getDeletedDashboardFolders();
        const subFolderSet = new Set();

        // 1. Gespeicherte Unterordner-Reihenfolge vom Dashboard
        try {
            const savedOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
            savedOrder.forEach(f => {
                if (f && f.trim() && !deleted.has(f.trim())) subFolderSet.add(f.trim());
            });
        } catch (_e) {}

        // 2. Alle aktiven Ordner der klinischen Fälle auf dem Dashboard
        if (typeof window.getRegisteredCases === 'function') {
            try {
                const cases = window.getRegisteredCases({ ignoreSpecialtyFilter: true }) || [];
                cases.forEach(c => {
                    const f = (c.folder_name || c.metadata?.medical_field || 'Allgemein').trim();
                    if (f && !deleted.has(f)) subFolderSet.add(f);
                });
            } catch (_e) {}
        }

        // 3. Alle Ordner der Pharmakologie-Sets
        allPharmaSets.forEach(s => {
            const f = resolveSetFolder(s);
            if (f && !deleted.has(f)) subFolderSet.add(f);
        });

        if (subFolderSet.size === 0) subFolderSet.add('Allgemein');
        return Array.from(subFolderSet);
    }

    // Verschiebt ein Pharma-Set (Standard oder Custom) in einen Dashboard-Ordner
    async function moveSetToFolder(setId, targetFolderName) {
        if (!setId || !targetFolderName) return;
        const cleanFolder = targetFolderName.trim();

        // 1. Override speichern (damit auch Built-in Sets verschoben bleiben)
        const overrides = getFolderOverrides();
        overrides[setId] = cleanFolder;
        saveFolderOverrides(overrides);

        // 2. Falls neuer Ordner, auch in die globale Dashboard-Ordnerliste eintragen
        try {
            let order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
            if (!order.includes(cleanFolder) && cleanFolder.toLowerCase() !== 'allgemein') {
                order.push(cleanFolder);
                localStorage.setItem('medcheck_folder_order', JSON.stringify(order));
            }
        } catch (_e) {}

        // 3. Falls Custom-Set, direkt aktualisieren und in Supabase pushen
        const customIdx = state.customSets.findIndex(s => s && s.set_id === setId);
        if (customIdx !== -1) {
            state.customSets[customIdx].folder_name = cleanFolder;
            state.customSets[customIdx].medical_field = cleanFolder;
            saveLocalSets();
            await uploadSetToSupabase(state.customSets[customIdx]);
        }

        // Ziel-Überordner und Ziel-Unterordner automatisch öffnen
        const parentSuper = getSuperFolderForSubfolder(cleanFolder);
        state.openSuperFolders[parentSuper] = true;
        state.openSubFolders[cleanFolder] = true;

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);
        render();
        if (typeof window.renderDashboardCases === 'function') {
            window.renderDashboardCases();
        }
    }

    async function promptMoveSetModal(setId) {
        const allSets = getAllSets();
        const targetSet = allSets.find(s => s.set_id === setId);
        if (!targetSet) return;

        const currentFolder = resolveSetFolder(targetSet);
        const allSubfolders = getAllUnifiedSubfolders(allSets);

        if (window.MedUI && typeof window.MedUI.openDialog === 'function') {
            const options = allSubfolders.map(f => {
                const sName = getSuperFolderForSubfolder(f);
                return {
                    value: f,
                    label: `${sName} ➔ ${f}${f === currentFolder ? ' (aktuell)' : ''}`
                };
            });

            const res = await window.MedUI.openDialog({
                kicker: 'Pharmakologie-Architektur',
                title: `„${targetSet.title}“ verschieben`,
                fields: [
                    {
                        id: 'targetFolder',
                        type: 'select',
                        label: 'Ziel-Ordner (synchron mit Dashboard)',
                        defaultValue: currentFolder,
                        options
                    },
                    {
                        id: 'newFolder',
                        label: 'Oder neuen Ordner anlegen (optional)',
                        placeholder: 'Leer lassen für Auswahl oben...'
                    }
                ],
                confirmText: 'Verschieben'
            });

            if (!res) return;
            const chosen = (res.newFolder || res.targetFolder || '').trim();
            if (chosen) {
                if (res.newFolder && typeof window.createNewFolder === 'function') {
                    window.createNewFolder(chosen);
                }
                await moveSetToFolder(setId, chosen);
            }
        } else {
            const nextFolder = window.prompt(`In welchen Ordner soll „${targetSet.title}“ verschoben werden?`, currentFolder);
            if (nextFolder && nextFolder.trim()) {
                await moveSetToFolder(setId, nextFolder.trim());
            }
        }
    }

    // =========================================================================
    // SUCHE & FILTER-LOGIK
    // =========================================================================
    function matchesPharmaSearch(setObj, queryLower) {
        if (!queryLower) return { matches: true, reason: null };

        const title = (setObj.title || '').toLowerCase();
        const folder = resolveSetFolder(setObj).toLowerCase();
        const desc = (setObj.description || '').toLowerCase();

        if (title.includes(queryLower)) return { matches: true, reason: 'Set-Titel' };
        if (folder.includes(queryLower)) return { matches: true, reason: 'Ordner' };
        if (desc.includes(queryLower)) return { matches: true, reason: 'Beschreibung' };

        // Suche in Kompass-Fragen (Wirkstoffe, Klassen, Vignetten, Pearls)
        if (Array.isArray(setObj.questions)) {
            for (const q of setObj.questions) {
                const dirs = q.directions ? Object.values(q.directions) : [];
                for (const d of dirs) {
                    if ((d.drug || '').toLowerCase().includes(queryLower)) {
                        return { matches: true, reason: `Wirkstoff: ${d.drug}` };
                    }
                    if ((d.class || '').toLowerCase().includes(queryLower)) {
                        return { matches: true, reason: `Klasse: ${d.class}` };
                    }
                }
                if ((q.pearl || '').toLowerCase().includes(queryLower)) {
                    return { matches: true, reason: 'Klinische Pearl' };
                }
                if ((q.patient_context || '').toLowerCase().includes(queryLower)) {
                    return { matches: true, reason: 'Patienten-Szenario' };
                }
            }
        }

        // Suche in Drag-Matrix (Medikamente & Indikationen)
        if (Array.isArray(setObj.drugs)) {
            const hitDrug = setObj.drugs.find(d =>
                (d.name || '').toLowerCase().includes(queryLower) ||
                (d.subtitle || '').toLowerCase().includes(queryLower)
            );
            if (hitDrug) return { matches: true, reason: `Wirkstoff: ${hitDrug.name}` };
        }
        if (Array.isArray(setObj.categories)) {
            const hitCat = setObj.categories.find(c => (c.name || '').toLowerCase().includes(queryLower));
            if (hitCat) return { matches: true, reason: `Indikation: ${hitCat.name}` };
        }

        return { matches: false, reason: null };
    }

    // =========================================================================
    // CLOUD-SYNCHRONISATION (ROBUST & BIDIREKTIONAL)
    // =========================================================================
    async function syncFromCloud() {
        const sb = getSupabase();
        if (!sb || !sb.auth) return;

        try {
            const { data: sessionData } = await sb.auth.getSession();
            const user = sessionData?.session?.user;
            if (!user) return;

            const { data, error } = await sb
                .from('pharma_sets')
                .select('set_id, content')
                .eq('user_id', user.id);

            if (error) {
                console.warn('[Pharmacology] Supabase Sync Hinweis:', error.message);
                return;
            }

            loadSavedSets();
            const setMap = new Map();
            state.cloudSetIds.clear();

            state.customSets.forEach(s => {
                if (s && s.set_id) setMap.set(s.set_id, s);
            });

            if (Array.isArray(data)) {
                data.forEach(row => {
                    if (row?.content?.set_id) {
                        setMap.set(row.content.set_id, row.content);
                        state.cloudSetIds.add(row.content.set_id);
                    }
                });
            }

            state.customSets = Array.from(setMap.values());
            saveLocalSets();

            const unuploadedSets = state.customSets.filter(s => !state.cloudSetIds.has(s.set_id));
            if (unuploadedSets.length > 0) {
                for (const s of unuploadedSets) {
                    await uploadSetToSupabase(s, user.id);
                }
            }

            const container = document.getElementById('pharmacology-container');
            if (container && state.activeSubView === 'hub') {
                render('pharmacology-container');
            }
        } catch (e) {
            console.warn('[Pharmacology] Cloud-Sync übersprungen:', e);
        }
    }

    async function uploadSetToSupabase(setObj, userId = null) {
        const sb = getSupabase();
        if (!sb || !sb.auth || !setObj || !setObj.set_id) return false;

        try {
            let uid = userId;
            if (!uid) {
                const { data: sessionData } = await sb.auth.getSession();
                uid = sessionData?.session?.user?.id;
            }
            if (!uid) return false;

            const resolvedFolder = resolveSetFolder(setObj);
            setObj.folder_name = resolvedFolder;
            setObj.medical_field = resolvedFolder;

            const payload = {
                set_id: setObj.set_id,
                user_id: uid,
                title: setObj.title || 'Pharmakologie-Set',
                medical_field: resolvedFolder,
                game_type: setObj.game_type || 'arrow_compass',
                content: setObj,
                updated_at: new Date().toISOString()
            };

            const { error } = await sb
                .from('pharma_sets')
                .upsert(payload, { onConflict: 'user_id,set_id' });

            if (error) {
                console.warn('[Pharmacology] Upload-Warnung:', error.message);
                return false;
            }

            state.cloudSetIds.add(setObj.set_id);
            return true;
        } catch (err) {
            console.warn('[Pharmacology] Upload fehlgeschlagen:', err);
            return false;
        }
    }

    async function deleteSet(setId) {
        if (!setId) return;
        const setObj = state.customSets.find(s => s.set_id === setId);
        const title = setObj?.title || setId;

        if (!window.confirm(`Möchtest du das Set "${title}" wirklich löschen?`)) return;

        state.customSets = state.customSets.filter(s => s.set_id !== setId);
        state.cloudSetIds.delete(setId);
        saveLocalSets();

        const sb = getSupabase();
        if (sb && sb.auth) {
            try {
                const { data: sessionData } = await sb.auth.getSession();
                const user = sessionData?.session?.user;
                if (user) {
                    await sb
                        .from('pharma_sets')
                        .delete()
                        .eq('set_id', setId)
                        .eq('user_id', user.id);
                }
            } catch (err) {
                console.warn('[Pharmacology] Fehler beim Löschen in Supabase:', err);
            }
        }

        render();
    }

    // =========================================================================
    // INITIALISIERUNG, HOOKS & TASTEN-STEUERUNG
    // =========================================================================
    function init(containerId = 'pharmacology-container') {
        loadSavedSets();
        setupKeyboardListener();
        bindDashboardFolderSyncHook();

        // Beim ersten Start die Überordner öffnen, die bereits Pharma-Sets enthalten
        if (Object.keys(state.openSuperFolders).length === 0) {
            const allSets = getAllSets();
            allSets.forEach(s => {
                const folder = resolveSetFolder(s);
                const superTitle = getSuperFolderForSubfolder(folder);
                state.openSuperFolders[superTitle] = true;
                state.openSubFolders[folder] = true;
            });
        }

        syncFromCloud();
        render(containerId);
    }

    function bindDashboardFolderSyncHook() {
        if (window._pharmaDashboardSyncHooked) return;
        window._pharmaDashboardSyncHooked = true;

        // Wenn über MedUI ein Ordner auf dem Dashboard oder im Pharma-Hub geändert wird,
        // aktualisiert sich der Pharma-Hub sofort automatisch mit!
        const origRenderDash = window.renderDashboardCases;
        if (typeof origRenderDash === 'function') {
            window.renderDashboardCases = function() {
                origRenderDash.apply(this, arguments);
                const pharmaView = document.getElementById('pharmacology-view');
                if (pharmaView && pharmaView.style.display !== 'none' && state.activeSubView === 'hub') {
                    render('pharmacology-container');
                }
            };
        }

        // Falls ein Ordner umbenannt wird, auch die Pharma-Folder-Overrides mitziehen
        const origRenameFolder = window.renameFolder;
        if (typeof origRenameFolder === 'function') {
            window.renameFolder = async function(oldName, newName) {
                const overrides = getFolderOverrides();
                let changed = false;
                Object.keys(overrides).forEach(setId => {
                    if (overrides[setId] === oldName) {
                        overrides[setId] = newName;
                        changed = true;
                    }
                });
                if (changed) saveFolderOverrides(overrides);

                state.customSets.forEach(s => {
                    if (s && (s.folder_name === oldName || s.medical_field === oldName)) {
                        s.folder_name = newName;
                        s.medical_field = newName;
                    }
                });
                saveLocalSets();

                return await origRenameFolder.apply(this, arguments);
            };
        }
    }

    function setupKeyboardListener() {
        window.removeEventListener('keydown', handleKeyDown);
        window.addEventListener('keydown', handleKeyDown);
    }

    function handleKeyDown(e) {
        const container = document.getElementById('pharmacology-container');
        if (!container || container.offsetParent === null) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        if (state.activeSubView === 'arrow_compass') {
            const keyMap = {
                'ArrowUp': 'up', 'KeyW': 'up',
                'ArrowRight': 'right', 'KeyD': 'right',
                'ArrowDown': 'down', 'KeyS': 'down',
                'ArrowLeft': 'left', 'KeyA': 'left'
            };

            if (keyMap[e.code]) {
                e.preventDefault();
                if (!state.isAnswered) selectDirection(keyMap[e.code]);
            } else if ((e.code === 'Space' || e.code === 'Enter') && state.isAnswered) {
                e.preventDefault();
                nextQuestion();
            }
        }
    }

    // =========================================================================
    // RENDER-ROUTING
    // =========================================================================
    function render(containerId = 'pharmacology-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (state.activeSubView === 'hub') {
            container.innerHTML = renderHub();
        } else if (state.activeSubView === 'arrow_compass') {
            container.innerHTML = renderArrowCompass();
        } else if (state.activeSubView === 'drag_matrix') {
            container.innerHTML = renderDragMatrix();
        } else if (state.activeSubView === 'prompts') {
            container.innerHTML = renderPromptsHub();
        } else if (state.activeSubView === 'import') {
            container.innerHTML = renderImporter();
        }

        attachEvents(container);
    }

    // =========================================================================
    // 1. HUB ANSICHT (MIT DASHBOARD-ORDNERBAUM, DRAG & DROP & SUCHE)
    // =========================================================================
    function renderHub() {
        const allSets = getAllSets();
        const defaultIds = new Set(defaultSets.map(s => s.set_id));
        const highscores = getHighscores();
        const queryLower = (state.searchQuery || '').trim().toLowerCase();
        const isSearching = queryLower.length > 0;

        // 1. Spielmodus- und Suchfilter anwenden
        const matchReasons = {};
        const filteredSets = allSets.filter(s => {
            const type = s.game_type || 'arrow_compass';
            if (state.modeFilter !== 'all' && type !== state.modeFilter) return false;
            const searchRes = matchesPharmaSearch(s, queryLower);
            if (!searchRes.matches) return false;
            if (searchRes.reason) matchReasons[s.set_id] = searchRes.reason;
            return true;
        });

        const compassCount = allSets.filter(s => (s.game_type || 'arrow_compass') === 'arrow_compass').length;
        const matrixCount = allSets.filter(s => s.game_type === 'drag_matrix').length;

        // 2. Einheitlichen Ordnerbaum (Dashboard + Pharma) aufbauen
        const superOrder = getDashboardSuperFolders();
        const allSubfolders = getAllUnifiedSubfolders(allSets);
        let savedSubOrder = [];
        try {
            savedSubOrder = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
        } catch (_e) {}

        const groupedBySubfolder = {};
        allSubfolders.forEach(sub => { groupedBySubfolder[sub] = []; });

        filteredSets.forEach(s => {
            const folder = resolveSetFolder(s);
            if (!groupedBySubfolder[folder]) groupedBySubfolder[folder] = [];
            groupedBySubfolder[folder].push(s);
        });

        const superFoldersMap = {};
        superOrder.forEach(sup => { superFoldersMap[sup] = []; });

        Object.keys(groupedBySubfolder).forEach(sub => {
            const hasSets = groupedBySubfolder[sub].length > 0;
            const subMatchesSearch = isSearching && sub.toLowerCase().includes(queryLower);

            if (isSearching && !hasSets && !subMatchesSearch) return;
            if (!state.showEmptyDashboardFolders && !hasSets && !isSearching) return;

            const targetSuper = getSuperFolderForSubfolder(sub);
            if (!superFoldersMap[targetSuper]) superFoldersMap[targetSuper] = [];
            superFoldersMap[targetSuper].push(sub);
        });

        // 3. Überordner & Unterordner HTML generieren
        let superFoldersHtml = '';
        let renderedSuperCount = 0;

        Object.entries(superFoldersMap).forEach(([superTitle, categories]) => {
            let totalSetsInSuper = 0;
            let compassInSuper = 0;
            let matrixInSuper = 0;

            categories.forEach(cName => {
                const list = groupedBySubfolder[cName] || [];
                totalSetsInSuper += list.length;
                compassInSuper += list.filter(s => (s.game_type || 'arrow_compass') === 'arrow_compass').length;
                matrixInSuper += list.filter(s => s.game_type === 'drag_matrix').length;
            });

            if ((isSearching || !state.showEmptyDashboardFolders) && categories.length === 0) {
                return;
            }
            renderedSuperCount++;

            const isSuperOpen = isSearching ? true : !!state.openSuperFolders[superTitle];
            const arrowSymbol = isSuperOpen ? '▼' : '▶';
            const isProtectedDefault = (superTitle === 'Allgemein');
            const escapedSuperJs = escapeHtml(superTitle).replace(/'/g, "\\'");

            // Unterordner exakt wie auf dem Dashboard sortieren
            categories.sort((a, b) => {
                const idxA = savedSubOrder.indexOf(a);
                const idxB = savedSubOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            let categoriesHtml = '';
            if (categories.length === 0) {
                categoriesHtml = `
                    <div class="empty-superfolder-hint">
                        <span>Noch keine Unterordner in „${escapeHtml(superTitle)}“</span>
                        <button type="button" class="ghost-tool-btn" onclick="event.stopPropagation(); window.createSubfolderInSuperFolder && window.createSubfolderInSuperFolder('${escapedSuperJs}')">+ Unterordner</button>
                    </div>
                `;
            } else {
                categoriesHtml = categories.map(category => {
                    const setsInCat = groupedBySubfolder[category] || [];
                    const isSubOpen = isSearching ? true : !!state.openSubFolders[category];
                    const escapedCatJs = escapeHtml(category).replace(/'/g, "\\'");
                    const parsedLabel = typeof formatClinicalFolderLabel === 'function'
                        ? formatClinicalFolderLabel(category)
                        : { code: null, title: category };

                    const setsCardsHtml = setsInCat.length === 0
                        ? `
                            <div class="empty-subfolder-hint" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                                <span>Noch kein Pharma-Set in diesem Dashboard-Ordner (Set hierher ziehen oder neu erstellen).</span>
                                <button type="button" class="ghost-tool-btn" data-action="open-import-for-folder" data-folder="${escapeHtml(category)}" style="font-size:0.74rem; padding:4px 10px;">
                                    + Set für „${escapeHtml(parsedLabel.title.slice(0, 26))}“ erstellen
                                </button>
                            </div>
                        `
                        : setsInCat.map(set => {
                            const isMatrix = set.game_type === 'drag_matrix';
                            const isCustom = !defaultIds.has(set.set_id);
                            const isCloud = state.cloudSetIds.has(set.set_id);
                            const hs = highscores[set.set_id];
                            const matchReason = matchReasons[set.set_id];

                            const countLabel = isMatrix
                                ? `🧩 ${set.drugs?.length || 0} Wirkstoffe → ${set.categories?.length || 0} Indikationen`
                                : `⌨️ ${set.questions?.length || 0} Szenarien`;

                            const syncBadge = isCustom
                                ? `<span class="cloud-badge ${isCloud ? 'is-cloud' : 'is-local'}" style="font-size:0.68rem; padding:2px 8px; border-radius:6px; font-weight:700;">
                                      ${isCloud ? '☁️ Cloud' : '💾 Lokal'}
                                   </span>`
                                : `<span style="font-size:0.68rem; padding:2px 8px; border-radius:6px; background:rgba(255,255,255,0.06); color:var(--text-dim); font-weight:600;">Standard</span>`;

                            const highscoreBadge = hs
                                ? `<span style="font-size:0.68rem; padding:2px 8px; border-radius:6px; background:${hs.pct === 100 ? 'rgba(16,185,129,0.16)' : 'rgba(56,189,248,0.14)'}; color:${hs.pct === 100 ? '#6ee7b7' : '#38bdf8'}; font-weight:700;">
                                      🏆 ${hs.achieved}/${hs.total} (${hs.pct}%)
                                   </span>`
                                : '';

                            return `
                                <div class="pharma-set-card" draggable="true" data-pharma-set-id="${escapeHtml(set.set_id)}" style="cursor:grab;">
                                    <div style="flex:1; min-width:0;">
                                        <div class="pharma-set-meta" style="margin-bottom: 6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                            <span class="category-drag-handle" title="Ziehen, um das Set in einen anderen Ordner zu legen" style="cursor:grab; margin-right:2px;">⠿</span>
                                            <span class="pharma-type-pill">${countLabel}</span>
                                            ${syncBadge}
                                            ${highscoreBadge}
                                            ${matchReason ? `<span class="case-search-match-pill" style="margin:0;">🎯 ${escapeHtml(matchReason)}</span>` : ''}
                                        </div>
                                        <h3 style="margin: 0 0 4px 0; font-size:1.02rem;">${escapeHtml(set.title)}</h3>
                                        ${set.description ? `<p style="font-size:0.78rem; color:var(--text-muted); margin:0;">${escapeHtml(set.description)}</p>` : ''}
                                    </div>
                                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                                        <button type="button" class="folder-action-btn move-btn" data-action="move-set-modal" data-set-id="${escapeHtml(set.set_id)}" title="In anderen Dashboard-Ordner verschieben" style="padding:7px 9px; border-radius:8px;">
                                            ${PharmaIcons.move}
                                        </button>
                                        ${isCustom ? `
                                            <button type="button" class="folder-action-btn delete-folder-btn" data-action="delete-set" data-set-id="${escapeHtml(set.set_id)}" title="Set löschen" style="padding:7px 9px; border-radius:8px;">
                                                ${PharmaIcons.trash}
                                            </button>
                                        ` : ''}
                                        <button class="pharma-btn pharma-btn-primary" data-action="start-set" data-set-id="${escapeHtml(set.set_id)}">
                                            ${isMatrix ? '🧩 Starten →' : '⌨️ Starten →'}
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('');

                    return `
                        <div class="category-folder pharma-category-folder"
                             draggable="true"
                             data-pharma-subfolder="${encodeURIComponent(category)}"
                             data-pharma-super="${encodeURIComponent(superTitle)}">
                            <div class="category-header" data-action="toggle-subfolder" data-folder="${escapeHtml(category)}">
                                <div class="category-title-wrap">
                                    <span class="category-drag-handle" title="Ziehen zum Verschieben">⠿</span>
                                    <span class="category-arrow ${isSubOpen ? 'expanded' : ''}">▶</span>
                                    ${parsedLabel.code ? `<span style="font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:var(--accent-cyan); background:rgba(56,189,248,0.12); padding:2px 6px; border-radius:5px; margin-right:4px;">${escapeHtml(parsedLabel.code)}</span>` : ''}
                                    <span class="category-name-text">${escapeHtml(parsedLabel.title)}</span>
                                </div>
                                <div class="category-header-right" onclick="event.stopPropagation();">
                                    <div class="folder-hover-tools">
                                        <button type="button" class="folder-action-btn" data-action="open-import-for-folder" data-folder="${escapeHtml(category)}" title="Neues Pharma-Set direkt in diesem Ordner erstellen">${PharmaIcons.plus}</button>
                                        <button type="button" class="folder-action-btn move-btn" onclick="window.promptMoveFolderToSuperFolder && window.promptMoveFolderToSuperFolder('${escapedCatJs}')" title="Ordner in anderen Überordner verschieben">${PharmaIcons.move}</button>
                                        <button type="button" class="folder-action-btn edit-btn" onclick="window.promptRenameSubfolder && window.promptRenameSubfolder('${escapedCatJs}')" title="Ordner umbenennen">${PharmaIcons.edit}</button>
                                        <button type="button" class="folder-action-btn delete-folder-btn" onclick="window.deleteFolder && window.deleteFolder('${escapedCatJs}', 0)" title="Ordner löschen">${PharmaIcons.trash}</button>
                                    </div>
                                    <span class="category-badge" style="${setsInCat.length > 0 ? 'background:rgba(56,189,248,0.16); color:var(--accent-cyan); border-color:rgba(56,189,248,0.35);' : ''}">
                                        ${setsInCat.length} ${setsInCat.length === 1 ? 'Set' : 'Sets'}
                                    </span>
                                </div>
                            </div>
                            <div class="category-cases-body" style="display:${isSubOpen ? 'flex' : 'none'}; flex-direction:column; gap:10px; padding-top:10px;">
                                ${setsCardsHtml}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            const superEditControls = !isProtectedDefault
                ? `
                    <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.createSubfolderInSuperFolder && window.createSubfolderInSuperFolder('${escapedSuperJs}')" title="Neuer Unterordner">+</button>
                    <button type="button" class="folder-action-btn edit-btn" onclick="event.stopPropagation(); window.renameSuperFolder && window.renameSuperFolder('${escapedSuperJs}')" title="Überordner umbenennen">✏️</button>
                    <button type="button" class="folder-action-btn delete-folder-btn" onclick="event.stopPropagation(); window.removeCustomSuperFolder && window.removeCustomSuperFolder('${escapedSuperJs}')" title="Überordner löschen">🗑️</button>
                  `
                : `
                    <button type="button" class="folder-action-btn" onclick="event.stopPropagation(); window.createSubfolderInSuperFolder && window.createSubfolderInSuperFolder('${escapedSuperJs}')" title="Neuer Unterordner">+</button>
                  `;

            superFoldersHtml += `
                <div class="super-folder pharma-super-folder" data-pharma-super-title="${encodeURIComponent(superTitle)}">
                    <div class="super-folder-header" data-action="toggle-superfolder" data-super="${escapeHtml(superTitle)}">
                        <div class="super-folder-title">
                            <span class="super-drag-handle" title="Überordner vom Dashboard">⠿</span>
                            <svg class="super-folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            <span>${escapeHtml(superTitle)}</span>
                        </div>
                        <div class="super-folder-right">
                            <div class="folder-hover-tools" onclick="event.stopPropagation();">
                                ${superEditControls}
                            </div>
                            ${compassInSuper > 0 ? `<span style="font-size:0.7rem; color:var(--text-muted); margin-right:4px;">⌨️ ${compassInSuper}</span>` : ''}
                            ${matrixInSuper > 0 ? `<span style="font-size:0.7rem; color:var(--text-muted); margin-right:4px;">🧩 ${matrixInSuper}</span>` : ''}
                            <span class="super-count-pill" style="${totalSetsInSuper > 0 ? 'background:rgba(56,189,248,0.16); color:var(--accent-cyan); border-color:rgba(56,189,248,0.35);' : ''}">
                                💊 ${totalSetsInSuper} ${totalSetsInSuper === 1 ? 'Set' : 'Sets'}
                            </span>
                            <span class="super-chevron">${arrowSymbol}</span>
                        </div>
                    </div>
                    <div class="super-folder-body" style="display:${isSuperOpen ? 'flex' : 'none'}; flex-direction:column; gap:10px;">
                        ${categoriesHtml}
                    </div>
                </div>
            `;
        });

        if (renderedSuperCount === 0) {
            superFoldersHtml = `
                <div class="dashboard-search-empty-state" style="padding:28px; text-align:center;">
                    <div style="font-size:1.5rem; margin-bottom:6px;">💊</div>
                    <div style="font-weight:700; color:var(--text-main); margin-bottom:4px;">Keine passenden Pharmakologie-Sets gefunden</div>
                    <div style="font-size:0.82rem; color:var(--text-muted); margin-bottom:12px;">
                        Passe deinen Filter an oder blende alle Dashboard-Ordner ein.
                    </div>
                    <button type="button" class="pharma-btn pharma-btn-secondary" data-action="reset-hub-filters">
                        Filter zurücksetzen & alle Ordner zeigen
                    </button>
                </div>
            `;
        }

        return `
            <div class="pharma-wrapper">
                <div class="pharma-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <span class="pharma-badge">INTERAKTIVES TRAINING · SYNCHRON MIT DASHBOARD</span>
                        <h1 class="pharma-title">💊 Klinische Pharmakologie</h1>
                        <p class="pharma-subtitle">Deine Themenordner sind 1:1 mit dem Dashboard synchronisiert. Ziehe Sets einfach per Drag & Drop in den passenden Ordner.</p>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="ghost-tool-btn" onclick="window.createNewSuperFolderModal && window.createNewSuperFolderModal()" title="Neuen Überordner anlegen">
                            + Überordner
                        </button>
                        <button type="button" class="ghost-tool-btn" onclick="window.promptCreateNewFolderWithSuper && window.promptCreateNewFolderWithSuper()" title="Neuen Unterordner anlegen">
                            + Ordner
                        </button>
                        <button class="pharma-btn pharma-btn-primary" data-action="open-prompts" style="background:var(--accent-cyan); color:#0f172a; font-weight:700;">
                            ✨ Pharma-Prompts
                        </button>
                        <button class="pharma-btn pharma-btn-secondary" data-action="open-import">
                            <span>+ Set importieren</span>
                        </button>
                    </div>
                </div>

                <div class="pharma-modes-grid">
                    <div class="pharma-mode-card ${state.modeFilter === 'arrow_compass' ? 'active-mode' : ''}" data-action="filter-mode" data-mode="arrow_compass" style="cursor:pointer;">
                        <div class="pharma-mode-icon">⌨️</div>
                        <div class="pharma-mode-info">
                            <h3>Pharma-Compass (Pfeiltasten)</h3>
                            <p>Navigiere mit den Pfeiltasten (↑ ↓ ← →) zum Mittel der 1. Wahl.</p>
                        </div>
                        <span class="pharma-mode-tag">${compassCount} Sets</span>
                    </div>

                    <div class="pharma-mode-card ${state.modeFilter === 'drag_matrix' ? 'active-mode' : ''}" data-action="filter-mode" data-mode="drag_matrix" style="cursor:pointer;">
                        <div class="pharma-mode-icon">🧩</div>
                        <div class="pharma-mode-info">
                            <h3>Indikations-Matrix (Drag & Drop)</h3>
                            <p>Ziehe Wirkstoffe per Drag & Drop in die passenden Krankheitsbilder.</p>
                        </div>
                        <span class="pharma-mode-tag">${matrixCount} Sets</span>
                    </div>
                </div>

                <!-- Toolbar: Suche, Ordner-Filter & Spielmodus-Filter -->
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom: 1rem;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1; min-width:260px;">
                        <div style="position:relative; flex:1; max-width:340px;">
                            <input type="text"
                                   id="pharma-hub-search-input"
                                   value="${escapeHtml(state.searchQuery)}"
                                   placeholder="🔍 Wirkstoff, Klasse, Syndrom oder Ordner suchen..."
                                   style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid var(--card-border); background:var(--surface-secondary, rgba(15,23,42,0.6)); color:var(--text-main); font-size:0.82rem;">
                        </div>
                        <button type="button" class="ghost-tool-btn" data-action="toggle-empty-folders" title="Leere Dashboard-Ordner ein- oder ausblenden">
                            ${state.showEmptyDashboardFolders ? '📂 Alle Dashboard-Ordner' : '💊 Nur befüllte Ordner'}
                        </button>
                        <button type="button" class="ghost-tool-btn" data-action="expand-collapse-all" title="Alle Ordner auf- oder zuklappen">
                            ↕ Alle auf/zu
                        </button>
                    </div>

                    <div class="segmented-control" style="margin:0;">
                        <button type="button" class="segmented-btn ${state.modeFilter === 'all' ? 'active' : ''}" data-action="filter-mode" data-mode="all">Alle (${allSets.length})</button>
                        <button type="button" class="segmented-btn ${state.modeFilter === 'arrow_compass' ? 'active' : ''}" data-action="filter-mode" data-mode="arrow_compass">⌨️ Kompass (${compassCount})</button>
                        <button type="button" class="segmented-btn ${state.modeFilter === 'drag_matrix' ? 'active' : ''}" data-action="filter-mode" data-mode="drag_matrix">🧩 Matrix (${matrixCount})</button>
                    </div>
                </div>

                <!-- 1:1 Dashboard Super-Folders & Sub-Folders -->
                <div id="pharma-super-folders-wrapper" style="display:flex; flex-direction:column; gap:12px;">
                    ${superFoldersHtml}
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 2. SEPARATER PROMPT-BEREICH
    // =========================================================================
    function buildPromptTemplates(targetFolder = '') {
        const cleanFolder = (targetFolder || '').trim() || 'Pharmakologie';
        const parsedLabel = typeof formatClinicalFolderLabel === 'function'
            ? formatClinicalFolderLabel(cleanFolder)
            : { code: null, title: cleanFolder };
        const topicPlaceholder = targetFolder ? parsedLabel.title : '[HIER THEMA EINFÜGEN]';

        const compassPromptTemp = `Erstelle ein valides JSON-Objekt für mein Pharmakologie-Spiel "Pharma-Compass" zu folgendem Thema: ${topicPlaceholder}.
Nutze exakt diese Struktur (ohne Markdown-Erklärungen):
{
  "set_id": "pharma_custom_${Date.now()}",
  "title": "Titel des Sets (${topicPlaceholder})",
  "medical_field": "${cleanFolder}",
  "folder_name": "${cleanFolder}",
  "game_type": "arrow_compass",
  "questions": [
    {
      "id": "q1",
      "patient_context": "Prägnante klinische Vignette inkl. Vitalparameter, Labor oder Komedikation.",
      "prompt": "Präzise Frage nach dem Mittel der 1. Wahl oder einer spezifischen Kontraindikation.",
      "directions": {
        "up": { "drug": "Wirkstoff A", "class": "Wirkstoffklasse", "is_correct": false, "feedback": "Warum falsch?" },
        "right": { "drug": "Wirkstoff B", "class": "Wirkstoffklasse", "is_correct": true, "feedback": "Warum exakt richtig?" },
        "down": { "drug": "Wirkstoff C", "class": "Wirkstoffklasse", "is_correct": false, "feedback": "Warum falsch?" },
        "left": { "drug": "Wirkstoff D", "class": "Wirkstoffklasse", "is_correct": false, "feedback": "Warum falsch?" }
      },
      "pearl": "Hochrelevanter klinischer Merksatz auf Staatsexamens-Niveau."
    }
  ]
}
Wichtig: Variiere die Position von "is_correct": true zufällig zwischen up, right, down und left. Erstelle 5-10 anspruchsvolle Fragen.`;

        const matrixPromptTemp = `Erstelle ein valides JSON-Objekt für mein Drag-and-Drop Pharmakologie-Spiel "Pharma-Matrix" zu folgendem Thema: ${topicPlaceholder}.
Nutze exakt diese Struktur (ohne Markdown-Erklärungen):
{
  "set_id": "pharma_matrix_${Date.now()}",
  "title": "Indikations-Matrix: ${topicPlaceholder}",
  "medical_field": "${cleanFolder}",
  "folder_name": "${cleanFolder}",
  "game_type": "drag_matrix",
  "description": "Ordne die Medikamente den passenden Krankheitsbildern / Indikationen zu.",
  "categories": [
    { "id": "cat_1", "name": "Krankheitsbild / Indikation 1" },
    { "id": "cat_2", "name": "Krankheitsbild / Indikation 2" },
    { "id": "cat_3", "name": "Krankheitsbild / Indikation 3" },
    { "id": "cat_4", "name": "Krankheitsbild / Indikation 4" }
  ],
  "drugs": [
    { "id": "d1", "name": "Wirkstoff 1", "subtitle": "Wirkstoffklasse", "correct_cat": "cat_1" },
    { "id": "d2", "name": "Wirkstoff 2", "subtitle": "Wirkstoffklasse", "correct_cat": "cat_2" }
  ]
}
Wichtig: Erstelle 4 klinisch trennscharfe Krankheitsbilder (categories) und 8 passende Medikamente (drugs).`;

        return { compassPromptTemp, matrixPromptTemp };
    }

    function renderPromptsHub() {
        const { compassPromptTemp, matrixPromptTemp } = buildPromptTemplates(state.importTargetFolder);

        return `
            <div class="pharma-wrapper">
                <div class="compass-topbar" style="margin-bottom: 1.5rem;">
                    <button class="pharma-btn pharma-btn-ghost" data-action="back-to-hub">← Zurück zum Pharma-Hub</button>
                    <h2>✨ Pharma-Prompt-Bibliothek</h2>
                </div>
                <p class="pharma-subtitle" style="margin-bottom: 1.5rem;">Kopiere dir hier die passenden KI-Prompts heraus, um sie in ChatGPT, Claude oder Gemini für neue Sets zu nutzen.</p>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                    <div class="pharma-import-box">
                        <h3>⌨️ Prompt für Pharma-Compass</h3>
                        <textarea id="box-prompt-compass" readonly class="pharma-textarea" style="height:180px;">${compassPromptTemp}</textarea>
                        <button class="pharma-btn pharma-btn-primary" data-action="copy-specific-prompt" data-target-id="box-prompt-compass" style="background:#38bdf8; color:#0f172a; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer;">📋 Kompass-Prompt kopieren</button>
                    </div>

                    <div class="pharma-import-box">
                        <h3>🧩 Prompt für Indikations-Matrix</h3>
                        <textarea id="box-prompt-matrix" readonly class="pharma-textarea" style="height:180px;">${matrixPromptTemp}</textarea>
                        <button class="pharma-btn pharma-btn-primary" data-action="copy-specific-prompt" data-target-id="box-prompt-matrix" style="background:var(--accent-cyan); color:#0f172a; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer;">📋 Matrix-Prompt kopieren</button>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 3. SPIELMODUS A: PFEILTASTEN-SPIEL
    // =========================================================================
    function renderArrowCompass() {
        const set = state.currentSet;
        const q = set.questions[state.currentQuestionIndex];
        const total = set.questions.length;

        if (!q) return renderCompassSummary();

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
                    <div class="compass-drug-name">${escapeHtml(opt.drug)}</div>
                    <div class="compass-drug-class">${escapeHtml(opt.class)}</div>
                    ${state.isAnswered ? `<div class="compass-card-feedback">${escapeHtml(opt.feedback)}</div>` : ''}
                </div>
            `;
        };

        return `
            <div class="pharma-wrapper">
                <div class="compass-topbar">
                    <button class="pharma-btn pharma-btn-ghost" data-action="back-to-hub">← Zurück zum Pharma-Hub</button>
                    <div class="compass-stats">
                        <span class="stat-pill">📁 <strong>${escapeHtml(resolveSetFolder(set))}</strong></span>
                        <span class="stat-pill">Frage <strong>${state.currentQuestionIndex + 1} / ${total}</strong></span>
                        <span class="stat-pill">Streak 🔥 <strong>${state.streak}</strong></span>
                        <span class="stat-pill">Score ⭐ <strong>${state.score}</strong></span>
                    </div>
                </div>

                <div class="compass-arena">
                    <div class="compass-slot-up">${renderCard('up', '↑', 'Oben (W)')}</div>

                    <div class="compass-middle-row">
                        <div class="compass-slot-left">${renderCard('left', '←', 'Links (A)')}</div>

                        <div class="compass-center-patient">
                            <div class="patient-badge">KLINISCHES SZENARIO</div>
                            <p class="patient-context-text">${escapeHtml(q.patient_context)}</p>
                            <div class="patient-question-prompt">${escapeHtml(q.prompt)}</div>
                            ${!state.isAnswered ? `
                                <div class="keyboard-hint">
                                    Nutze die Pfeiltasten <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> oder Klick
                                </div>
                            ` : ''}
                        </div>

                        <div class="compass-slot-right">${renderCard('right', '→', 'Rechts (D)')}</div>
                    </div>

                    <div class="compass-slot-down">${renderCard('down', '↓', 'Unten (S)')}</div>
                </div>

                ${state.isAnswered ? `
                    <div class="compass-resolution-panel">
                        <div class="pearl-box">
                            <strong>💡 Klinische Pearl:</strong> ${escapeHtml(q.pearl)}
                        </div>
                        <button class="pharma-btn pharma-btn-primary" data-action="next-question">
                            ${state.currentQuestionIndex + 1 < total ? 'Nächstes Szenario (Leertaste) →' : 'Auswertung anzeigen →'}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderCompassSummary() {
        const total = state.currentSet.questions.length;
        const percent = Math.round((state.score / total) * 100);
        recordHighscore(state.currentSet.set_id, state.score, total);

        return `
            <div class="pharma-wrapper">
                <div class="pharma-import-box" style="text-align:center; padding: 2.5rem; max-width: 520px; margin: 2rem auto;">
                    <h2 style="margin-bottom:0.4rem;">Training abgeschlossen! 🎉</h2>
                    <p class="pharma-subtitle">${escapeHtml(state.currentSet.title)}</p>
                    <div style="font-size: 2.4rem; font-weight: 800; color: var(--accent-blue); margin: 1.2rem 0;">
                        ${state.score} / ${total} <span style="font-size: 1.1rem; color: var(--text-muted);">(${percent}%)</span>
                    </div>
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button class="pharma-btn pharma-btn-primary" data-action="restart-set">↻ Nochmal spielen</button>
                        <button class="pharma-btn pharma-btn-secondary" data-action="back-to-hub">← Zurück zur Ordner-Übersicht</button>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 4. SPIELMODUS B: DRAG & DROP MATRIX
    // =========================================================================
    function renderDragMatrix() {
        const set = state.currentSet;
        const drugs = set.drugs || [];
        const categories = set.categories || [];

        const unplacedDrugs = drugs.filter(d => !state.matrixPlacements[d.id]);
        const placedCount = drugs.length - unplacedDrugs.length;

        let correctCount = 0;
        if (state.matrixEvaluated) {
            drugs.forEach(d => {
                if (state.matrixPlacements[d.id] === d.correct_cat) correctCount++;
            });
        }

        const renderDrugCard = (drug) => {
            const isSelected = state.selectedDrugForClickMove === drug.id;
            let evalStyle = '';
            let badgeHtml = '';

            if (state.matrixEvaluated) {
                const isCorrect = state.matrixPlacements[drug.id] === drug.correct_cat;
                evalStyle = isCorrect
                    ? 'border-color: var(--color-symptom, #10b981); background: rgba(16, 185, 129, 0.16);'
                    : 'border-color: var(--color-risk, #ef4444); background: rgba(239, 68, 68, 0.16);';
                badgeHtml = `<span style="font-size:0.75rem; font-weight:800; color:${isCorrect ? '#4ade80' : '#f87171'};">${isCorrect ? '✓' : '✕'}</span>`;
            } else if (isSelected) {
                evalStyle = 'border-color: var(--accent-cyan); box-shadow: 0 0 14px rgba(34, 211, 238, 0.45); transform: scale(1.03);';
            }

            return `
                <div class="pharma-matrix-card"
                     draggable="true"
                     data-drug-id="${escapeHtml(drug.id)}"
                     data-action="click-drug"
                     style="${evalStyle} display:flex; flex-direction:column; gap:2px; min-width: 170px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <span style="font-weight:700; color:var(--text-main);">${escapeHtml(drug.name)}</span>
                        ${badgeHtml}
                    </div>
                    ${drug.subtitle ? `<span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">${escapeHtml(drug.subtitle)}</span>` : ''}
                </div>
            `;
        };

        return `
            <div class="pharma-wrapper">
                <div class="compass-topbar">
                    <button class="pharma-btn pharma-btn-ghost" data-action="back-to-hub">← Zurück zum Pharma-Hub</button>
                    <div class="compass-stats">
                        <span class="stat-pill">📁 <strong>${escapeHtml(resolveSetFolder(set))}</strong></span>
                        <span class="stat-pill">Zugeordnet: <strong>${placedCount} / ${drugs.length}</strong></span>
                        <button class="pharma-btn pharma-btn-secondary" data-action="reset-matrix" style="padding: 0.35rem 0.8rem; font-size:0.8rem;">↺ Zurücksetzen</button>
                    </div>
                </div>

                <div style="margin-bottom: 1.25rem;">
                    <h2 style="margin: 0 0 4px 0; font-size: 1.4rem;">🧩 ${escapeHtml(set.title)}</h2>
                    <p class="pharma-subtitle">${escapeHtml(set.description || 'Ziehe jedes Medikament in das passende Krankheitsbild.')}</p>
                </div>

                <div class="pharma-bank-section" data-drop-target="pool">
                    <div class="bank-title">
                        💊 Verfügbare Medikamente (${unplacedDrugs.length} übrig)
                        ${state.selectedDrugForClickMove ? '<span style="color:var(--accent-cyan); margin-left:8px;">→ Klicke jetzt auf ein Krankheitsbild!</span>' : ''}
                    </div>
                    <div class="pharma-drug-pool" id="pharma-matrix-pool">
                        ${unplacedDrugs.length > 0
                            ? unplacedDrugs.map(renderDrugCard).join('')
                            : '<span style="font-size:0.82rem; color:var(--text-dim);">Alle Medikamente wurden verteilt. Klicke unten auf „Zuordnung prüfen“!</span>'}
                    </div>
                </div>

                <div class="pharma-categories-grid">
                    ${categories.map(cat => {
                        const drugsInCat = drugs.filter(d => state.matrixPlacements[d.id] === cat.id);
                        return `
                            <div class="pharma-category-column" data-drop-target="category" data-cat-id="${escapeHtml(cat.id)}">
                                <div class="pharma-cat-header">${escapeHtml(cat.name)}</div>
                                <div class="pharma-cat-dropzone">
                                    ${drugsInCat.map(renderDrugCard).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${state.matrixEvaluated ? `
                    <div class="feedback-box ${correctCount === drugs.length ? 'feedback-success' : 'feedback-error'}" style="display:block; margin-top: 18px;">
                        ${correctCount === drugs.length
                            ? `<strong>🎉 Perfekt gelöst!</strong> Alle ${drugs.length} Medikamente wurden dem richtigen Krankheitsbild zugeordnet!`
                            : `<strong>Fast geschafft:</strong> ${correctCount} von ${drugs.length} Medikamenten liegen richtig. Korrigiere die rot markierten Karten!`}
                    </div>
                ` : ''}

                <button type="button" class="action-btn" data-action="check-matrix" style="width: 100%; margin-top: 18px; padding: 14px;">
                    Zuordnung überprüfen ✓
                </button>
            </div>
        `;
    }

    // =========================================================================
    // 5. IMPORTER MIT ZIEL-ORDNER-AUSWAHL AUS DEM DASHBOARD
    // =========================================================================
    function renderImporter() {
        const isMatrix = state.importType === 'drag_matrix';
        const allSubfolders = getAllUnifiedSubfolders(getAllSets());
        const currentTarget = state.importTargetFolder || allSubfolders[0] || 'Allgemein';
        const { compassPromptTemp, matrixPromptTemp } = buildPromptTemplates(currentTarget);

        const folderOptionsHtml = allSubfolders.map(f => {
            const sup = getSuperFolderForSubfolder(f);
            return `<option value="${escapeHtml(f)}" ${f === currentTarget ? 'selected' : ''}>${escapeHtml(sup)} ➔ ${escapeHtml(f)}</option>`;
        }).join('');

        return `
            <div class="pharma-wrapper">
                <div class="compass-topbar">
                    <button class="pharma-btn pharma-btn-ghost" data-action="back-to-hub">← Zurück zum Hub</button>
                    <h2>Eigenes Pharmakologie-Set importieren</h2>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom: 1.25rem;">
                    <div class="segmented-control" style="margin:0;">
                        <button type="button" class="segmented-btn ${!isMatrix ? 'active' : ''}" data-action="switch-import-type" data-type="arrow_compass">⌨️ Prompt für Pfeiltasten-Spiel</button>
                        <button type="button" class="segmented-btn ${isMatrix ? 'active' : ''}" data-action="switch-import-type" data-type="drag_matrix">🧩 Prompt für Drag & Drop Matrix</button>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; flex:1; max-width:440px;">
                        <label for="pharma-import-folder-select" style="font-size:0.78rem; font-weight:700; color:var(--text-muted); white-space:nowrap;">📁 Ziel-Ordner:</label>
                        <select id="pharma-import-folder-select" class="mc-dialog-select" style="flex:1; padding:7px 10px; border-radius:8px;">
                            ${folderOptionsHtml}
                        </select>
                    </div>
                </div>

                <div class="pharma-import-grid">
                    <div class="pharma-import-box">
                        <h3>1. KI-Prompt kopieren (inkl. Ordner „${escapeHtml(currentTarget)}“)</h3>
                        <p>Kopiere diese Vorlage für ${isMatrix ? 'ein neues Drag-&-Drop-Zuordnungsspiel' : 'ein neues Pfeiltasten-Kompass-Spiel'}:</p>
                        <textarea id="pharma-prompt-Area" readonly class="pharma-textarea">${isMatrix ? matrixPromptTemp : compassPromptTemp}</textarea>
                        <button class="pharma-btn pharma-btn-secondary" data-action="copy-prompt">📋 Prompt in Zwischenablage kopieren</button>
                    </div>

                    <div class="pharma-import-box">
                        <h3>2. JSON-Code hier einfügen</h3>
                        <p>Wird direkt im ausgewählten Dashboard-Ordner gespeichert und mit der Cloud synchronisiert:</p>
                        <textarea id="pharma-json-input" placeholder='{"set_id": "...", "title": "...", ...}' class="pharma-textarea"></textarea>
                        <div id="pharma-import-status" style="margin-top:10px; font-size:0.85rem;"></div>
                        <button class="pharma-btn pharma-btn-primary" data-action="save-json" style="margin-top:10px;">💾 Set validieren & in Ordner speichern</button>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // EVENT-DISPATCHER & DRAG-AND-DROP AKTIONEN
    // =========================================================================
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
            if (typeof applyXpDelta === 'function') applyXpDelta(25, 'Pharma-Compass Treffer');
            if (typeof trackSkill === 'function') trackSkill('Pharmakologie', true);
        } else {
            state.streak = 0;
            if (typeof trackSkill === 'function') trackSkill('Pharmakologie', false);
        }

        render();
    }

    function nextQuestion() {
        state.currentQuestionIndex += 1;
        state.isAnswered = false;
        state.selectedDirection = null;
        render();
    }

    function assignDrugToCategory(drugId, categoryIdOrNull) {
        if (!drugId) return;
        state.matrixEvaluated = false;
        if (!categoryIdOrNull) {
            delete state.matrixPlacements[drugId];
        } else {
            state.matrixPlacements[drugId] = categoryIdOrNull;
        }
        state.selectedDrugForClickMove = null;
        render();
    }

    function attachEvents(container) {
        // Suchfeld im Hub (mit Fokus-Erhalt beim Tippen)
        const searchInput = container.querySelector('#pharma-hub-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const cursorPos = e.target.selectionStart;
                state.searchQuery = e.target.value;
                render();
                const newSearchInput = document.getElementById('pharma-hub-search-input');
                if (newSearchInput) {
                    newSearchInput.focus();
                    try { newSearchInput.setSelectionRange(cursorPos, cursorPos); } catch (_e) {}
                }
            });
        }

        // Ordner-Dropdown im Importer aktualisiert live den KI-Prompt
        const importFolderSelect = container.querySelector('#pharma-import-folder-select');
        if (importFolderSelect) {
            importFolderSelect.addEventListener('change', (e) => {
                state.importTargetFolder = e.target.value;
                render();
            });
        }

        container.querySelectorAll('[data-action]').forEach(el => {
            el.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = el.getAttribute('data-action');

                if (action === 'filter-mode') {
                    state.modeFilter = el.getAttribute('data-mode') || 'all';
                    render();
                } else if (action === 'toggle-empty-folders') {
                    state.showEmptyDashboardFolders = !state.showEmptyDashboardFolders;
                    render();
                } else if (action === 'expand-collapse-all') {
                    const superOrder = getDashboardSuperFolders();
                    const allSubs = getAllUnifiedSubfolders(getAllSets());
                    const anyOpen = superOrder.some(s => state.openSuperFolders[s]);
                    const nextState = !anyOpen;
                    superOrder.forEach(s => { state.openSuperFolders[s] = nextState; });
                    allSubs.forEach(sub => { state.openSubFolders[sub] = nextState; });
                    render();
                } else if (action === 'reset-hub-filters') {
                    state.modeFilter = 'all';
                    state.searchQuery = '';
                    state.showEmptyDashboardFolders = true;
                    render();
                } else if (action === 'toggle-superfolder') {
                    const sup = el.getAttribute('data-super');
                    if (sup) {
                        state.openSuperFolders[sup] = !state.openSuperFolders[sup];
                        render();
                    }
                } else if (action === 'toggle-subfolder') {
                    const folder = el.getAttribute('data-folder');
                    if (folder) {
                        state.openSubFolders[folder] = !state.openSubFolders[folder];
                        render();
                    }
                } else if (action === 'open-prompts') {
                    state.activeSubView = 'prompts';
                    render();
                } else if (action === 'open-import') {
                    state.activeSubView = 'import';
                    render();
                } else if (action === 'open-import-for-folder') {
                    state.importTargetFolder = el.getAttribute('data-folder') || '';
                    state.activeSubView = 'import';
                    render();
                } else if (action === 'move-set-modal') {
                    const setId = el.getAttribute('data-set-id');
                    await promptMoveSetModal(setId);
                } else if (action === 'start-set') {
                    const setId = el.getAttribute('data-set-id');
                    const found = getAllSets().find(s => s.set_id === setId);
                    if (!found) return;

                    state.currentSet = JSON.parse(JSON.stringify(found));

                    if (found.game_type === 'drag_matrix') {
                        state.currentSet.drugs = [...(found.drugs || [])].sort(() => Math.random() - 0.5);
                        state.matrixPlacements = {};
                        state.matrixEvaluated = false;
                        state.selectedDrugForClickMove = null;
                        state.activeSubView = 'drag_matrix';
                    } else {
                        state.currentQuestionIndex = 0;
                        state.score = 0;
                        state.streak = 0;
                        state.isAnswered = false;
                        state.selectedDirection = null;
                        state.activeSubView = 'arrow_compass';
                    }
                    render();
                } else if (action === 'delete-set') {
                    const setId = el.getAttribute('data-set-id');
                    await deleteSet(setId);
                } else if (action === 'select-dir') {
                    selectDirection(el.getAttribute('data-dir'));
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
                } else if (action === 'reset-matrix') {
                    state.matrixPlacements = {};
                    state.matrixEvaluated = false;
                    state.selectedDrugForClickMove = null;
                    render();
                } else if (action === 'check-matrix') {
                    state.matrixEvaluated = true;
                    const drugs = state.currentSet?.drugs || [];
                    const correctCount = drugs.filter(d => state.matrixPlacements[d.id] === d.correct_cat).length;
                    const allCorrect = drugs.length > 0 && correctCount === drugs.length;

                    recordHighscore(state.currentSet.set_id, correctCount, drugs.length);

                    if (allCorrect && typeof applyXpDelta === 'function') {
                        applyXpDelta(150, 'Pharma-Matrix gelöst');
                    }
                    if (typeof trackSkill === 'function') trackSkill('Pharmakologie', allCorrect);
                    render();
                } else if (action === 'click-drug') {
                    const drugId = el.getAttribute('data-drug-id');
                    state.selectedDrugForClickMove = (state.selectedDrugForClickMove === drugId) ? null : drugId;
                    render();
                } else if (action === 'switch-import-type') {
                    state.importType = el.getAttribute('data-type') || 'arrow_compass';
                    render();
                } else if (action === 'copy-prompt') {
                    const promptArea = document.getElementById('pharma-prompt-Area');
                    navigator.clipboard.writeText(promptArea.value);
                    el.textContent = '✅ Kopiert!';
                    setTimeout(() => { el.textContent = '📋 Prompt in Zwischenablage kopieren'; }, 2000);
                } else if (action === 'copy-specific-prompt') {
                    const targetId = el.getAttribute('data-target-id');
                    const ta = document.getElementById(targetId);
                    if (!ta) return;
                    navigator.clipboard.writeText(ta.value).then(() => {
                        const origText = el.textContent;
                        el.textContent = '✅ Kopiert!';
                        el.style.background = '#10b981';
                        el.style.color = '#fff';
                        setTimeout(() => {
                            el.textContent = origText;
                            el.style.background = '';
                            el.style.color = '';
                        }, 2000);
                    });
                } else if (action === 'save-json') {
                    const input = document.getElementById('pharma-json-input').value.trim();
                    const selectedFolder = document.getElementById('pharma-import-folder-select')?.value || state.importTargetFolder || '';
                    const statusBox = document.getElementById('pharma-import-status');
                    try {
                        const cleanInput = input.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                        const parsed = JSON.parse(cleanInput);

                        if (!parsed.set_id) parsed.set_id = 'pharma_custom_' + Date.now();
                        if (!parsed.title) throw new Error("Feld 'title' fehlt.");

                        const targetFolder = (selectedFolder || parsed.folder_name || parsed.medical_field || 'Allgemein').trim();
                        parsed.folder_name = targetFolder;
                        parsed.medical_field = targetFolder;

                        const isMatrixSet = parsed.game_type === 'drag_matrix' || (Array.isArray(parsed.categories) && Array.isArray(parsed.drugs));
                        if (isMatrixSet) {
                            parsed.game_type = 'drag_matrix';
                            if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.drugs) || parsed.drugs.length === 0) {
                                throw new Error("Ein Drag-&-Drop-Set benötigt 'categories' und 'drugs' Arrays.");
                            }
                        } else {
                            parsed.game_type = 'arrow_compass';
                            if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
                                throw new Error("Ein Kompass-Set benötigt ein nicht-leeres 'questions'-Array.");
                            }
                        }

                        // Ordner-Zuweisung sichern & Ordner öffnen
                        const overrides = getFolderOverrides();
                        overrides[parsed.set_id] = targetFolder;
                        saveFolderOverrides(overrides);

                        const parentSuper = getSuperFolderForSubfolder(targetFolder);
                        state.openSuperFolders[parentSuper] = true;
                        state.openSubFolders[targetFolder] = true;

                        state.customSets = state.customSets.filter(s => s.set_id !== parsed.set_id);
                        state.customSets.push(parsed);
                        saveLocalSets();

                        statusBox.style.color = '#38bdf8';
                        statusBox.innerHTML = `💾 In Ordner „${escapeHtml(targetFolder)}“ gespeichert. Synchronisiere mit Cloud...`;

                        const uploaded = await uploadSetToSupabase(parsed);
                        if (uploaded) {
                            statusBox.style.color = '#10b981';
                            statusBox.innerHTML = `✓ Erfolgreich in „${escapeHtml(targetFolder)}“ und auf deinem Account gesichert!`;
                        } else {
                            statusBox.style.color = '#f59e0b';
                            statusBox.innerHTML = `💾 Lokal in „${escapeHtml(targetFolder)}“ gespeichert (Melde dich an, um es online zu sichern).`;
                        }

                        setTimeout(() => {
                            state.activeSubView = 'hub';
                            render();
                        }, 1000);

                    } catch (err) {
                        statusBox.style.color = '#ef4444';
                        statusBox.textContent = "Ungültiges JSON: " + err.message;
                    }
                }
            });
        });

        // =====================================================================
        // DRAG & DROP IM PHARMA-HUB (SETS & ORDNER VERSCHIEBEN)
        // =====================================================================
        if (state.activeSubView === 'hub') {
            // 1. Pharma-Set-Karten ziehbar machen
            container.querySelectorAll('.pharma-set-card[data-pharma-set-id]').forEach(card => {
                const setId = card.getAttribute('data-pharma-set-id');
                card.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    state.draggedPharmaState = { type: 'pharma-set', id: setId };
                    card.classList.add('case-card-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', setId);
                    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
                });
                card.addEventListener('dragend', () => {
                    card.classList.remove('case-card-dragging');
                    state.draggedPharmaState = null;
                    container.querySelectorAll('.drag-over-folder, .super-folder-drag-over').forEach(el => {
                        el.classList.remove('drag-over-folder', 'super-folder-drag-over');
                    });
                });
            });

            // 2. Unterordner als Drop-Ziele (und selbst ziehbar in andere Überordner)
            container.querySelectorAll('.pharma-category-folder').forEach(folderEl => {
                const subName = decodeURIComponent(folderEl.getAttribute('data-pharma-subfolder') || '');

                folderEl.addEventListener('dragstart', (e) => {
                    if (e.target.closest('.pharma-set-card')) return;
                    e.stopPropagation();
                    state.draggedPharmaState = { type: 'subfolder', name: subName };
                    folderEl.classList.add('folder-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', subName);
                });

                folderEl.addEventListener('dragend', () => {
                    folderEl.classList.remove('folder-dragging');
                    state.draggedPharmaState = null;
                });

                folderEl.addEventListener('dragover', (e) => {
                    if (!state.draggedPharmaState) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    folderEl.classList.add('drag-over-folder');
                });

                folderEl.addEventListener('dragleave', (e) => {
                    if (!folderEl.contains(e.relatedTarget)) {
                        folderEl.classList.remove('drag-over-folder');
                    }
                });

                folderEl.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    folderEl.classList.remove('drag-over-folder');

                    const payload = state.draggedPharmaState;
                    state.draggedPharmaState = null;
                    if (!payload) return;

                    if (payload.type === 'pharma-set') {
                        await moveSetToFolder(payload.id, subName);
                    } else if (payload.type === 'subfolder' && payload.name !== subName) {
                        const targetSuper = getSuperFolderForSubfolder(subName);
                        if (typeof window.moveFolderToSuperFolder === 'function') {
                            window.moveFolderToSuperFolder(payload.name, targetSuper);
                        }
                    }
                });
            });

            // 3. Überordner als Drop-Ziele für Unterordner & Pharma-Sets
            container.querySelectorAll('.pharma-super-folder').forEach(superEl => {
                const superTitle = decodeURIComponent(superEl.getAttribute('data-pharma-super-title') || '');

                superEl.addEventListener('dragover', (e) => {
                    if (!state.draggedPharmaState || e.target.closest('.pharma-category-folder')) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    superEl.classList.add('super-folder-drag-over');
                });

                superEl.addEventListener('dragleave', (e) => {
                    if (!superEl.contains(e.relatedTarget)) {
                        superEl.classList.remove('super-folder-drag-over');
                    }
                });

                superEl.addEventListener('drop', async (e) => {
                    if (e.target.closest('.pharma-category-folder')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    superEl.classList.remove('super-folder-drag-over');

                    const payload = state.draggedPharmaState;
                    state.draggedPharmaState = null;
                    if (!payload) return;

                    if (payload.type === 'subfolder') {
                        if (typeof window.moveFolderToSuperFolder === 'function') {
                            window.moveFolderToSuperFolder(payload.name, superTitle);
                        }
                        state.openSuperFolders[superTitle] = true;
                        render();
                    } else if (payload.type === 'pharma-set') {
                        // Wenn direkt auf einen Überordner gezogen wird: in dessen ersten Unterordner oder gleichnamigen Ordner legen
                        if (typeof window.moveFolderToSuperFolder === 'function') {
                            window.moveFolderToSuperFolder(superTitle, superTitle);
                        }
                        await moveSetToFolder(payload.id, superTitle);
                    }
                });
            });
        }

        // =====================================================================
        // DRAG & DROP IM MATRIX-SPIEL
        // =====================================================================
        if (state.activeSubView === 'drag_matrix') {
            container.querySelectorAll('.pharma-matrix-card[draggable="true"]').forEach(card => {
                card.addEventListener('dragstart', (e) => {
                    const drugId = card.getAttribute('data-drug-id');
                    e.dataTransfer.setData('text/plain', drugId);
                    e.dataTransfer.effectAllowed = 'move';
                    card.classList.add('dragging');
                });
                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                });
            });

            container.querySelectorAll('[data-drop-target]').forEach(zone => {
                zone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    zone.classList.add('drag-over');
                });
                zone.addEventListener('dragleave', () => {
                    zone.classList.remove('drag-over');
                });
                zone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    zone.classList.remove('drag-over');
                    const drugId = e.dataTransfer.getData('text/plain');
                    const targetType = zone.getAttribute('data-drop-target');
                    const catId = targetType === 'category' ? zone.getAttribute('data-cat-id') : null;
                    assignDrugToCategory(drugId, catId);
                });

                zone.addEventListener('click', (e) => {
                    if (e.target.closest('.pharma-matrix-card')) return;
                    if (!state.selectedDrugForClickMove) return;
                    const targetType = zone.getAttribute('data-drop-target');
                    const catId = targetType === 'category' ? zone.getAttribute('data-cat-id') : null;
                    assignDrugToCategory(state.selectedDrugForClickMove, catId);
                });
            });
        }
    }

    return {
        init,
        render,
        syncFromCloud,
        deleteSet,
        moveSetToFolder
    };
})();

window.PharmacologyModule = PharmacologyModule;
