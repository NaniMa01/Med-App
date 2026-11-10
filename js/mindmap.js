/**
 * MedCheck - Interactive Clinical Mindmap Module V6.0 (js/mindmap.js)
 * "Deep Clinical Mastery Gate & Active-Recall Edition"
 *
 * Upgrades in V6.0:
 *  - Deep Clinical Mastery Gate on Node Placement: Every placed block triggers a rigorous
 *    state-exam level comprehension question (mechanism, contraindication, cutoff, differential)
 *    instead of merely asking which branch it belongs to.
 *  - Active-Recall-First Mode ("Erst Freitext-Hypothese, dann MC-Optionen"): Forces active memory
 *    retrieval before revealing the 4 length-balanced options.
 *  - Live AI Question Regenerator ("🔄 Neue KI-Prüfungsfrage"): Dynamically generates new deep
 *    comprehension questions via /api/gemini (mode: 'depot_quiz') for infinite replayability
 *    and automatic upgrading of legacy custom mindmaps.
 *  - Socratic Error Coaching inside the Mastery Modal (no solution spoilers on wrong clicks).
 *  - Anti-Spoiler Pool Architecture + Clinical Distractor Chips (Red Herrings).
 *  - Direct 1-Click Integration with MedCheck "Persönliches Lern-Depot" (createDepotEntry).
 */

(function () {
    'use strict';

    const CATEGORIES = {
        etiology: { label: 'Ätiologie & Risiko', color: '#3b82f6', cssClass: 'cat-etiology', icon: '🧬' },
        pathophysiology: { label: 'Pathophysiologie', color: '#ef4444', cssClass: 'cat-pathophysiology', icon: '⚡' },
        clinical: { label: 'Klinik & Symptome', color: '#f59e0b', cssClass: 'cat-clinical', icon: '🩺' },
        diagnostics: { label: 'Diagnostik', color: '#8b5cf6', cssClass: 'cat-diagnostics', icon: '🔬' },
        therapy: { label: 'Therapie', color: '#10b981', cssClass: 'cat-therapy', icon: '💊' }
    };

    const STAGE_WIDTH = 2400;
    const STAGE_HEIGHT = 1600;
    const DELETED_BUILTINS_KEY = 'medcheck_deleted_builtin_mindmaps_v1';
    const DEPOT_STORAGE_KEY = 'medcheck_learning_depot_v1';

    const BUILTIN_MINDMAPS = [
        {
            id: 'mm_cardio_stemi_001',
            title: 'Akutes Koronarsyndrom (STEMI)',
            specialty: 'Kardiologie',
            central_concept: 'STEMI (Transmurale Ischämie)',
            nodes: [
                {
                    id: 'n1',
                    label: 'Plaqueruptur & Abscheidungsthrombus',
                    category: 'pathophysiology',
                    parent_id: 'root',
                    relation_label: 'Akuter Pathomechanismus',
                    socratic_hint: 'Was passiert akut an einer vulnerablen atherosklerotischen Koronarläsion, bevor das Gefäß komplett verschließt?',
                    explanation: 'Durch Ruptur der dünnen fibrösen Kappe eines Lipid-reichen Atheroms werden subendotheliales Kollagen und Tissue Factor exponiert, was über vWF/GPIb und GPIIb/IIIa zur sofortigen Thrombozytenvernetzung und okklusiven Thrombusbildung führt.',
                    mastery_question: {
                        question: 'Welcher molekulare Kaskadenschritt führt nach der Ruptur einer vulnerablen Koronarplaque unmittelbar zur finalen, festen Quervernetzung der Thrombozyten im weißen Abscheidungsthrombus?',
                        options: [
                            'Konformationsänderung des GPIIb/IIIa-Integrins auf aktivierten Thrombozyten mit anschließender symmetrischer Brückenbildung durch Fibrinogen',
                            'Direkte Spaltung von hochmolekularem Kininogen durch Faktor XIIa an der intakten Endotheloberfläche ohne vorherige Kollagenexposition',
                            'Isolierte Bindung von Antithrombin III an subendotheliales Heparansulfat mit konsekutiver Aktivierung der primären Fibrinolyse',
                            'Paradoxe Hemmung der Thromboxan-A2-Synthese in Endothelzellen bei gleichzeitiger Überexpression von Prostacyclin (PGI2)'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Überlege: Welcher spezifische Oberflächenrezeptor auf Thrombozyten bildet die „gemeinsame Endstrecke“ der Aggregation, indem er Fibrinogen als Brücke zwischen zwei Thrombozyten bindet?',
                        rationale: 'Nach initialer Adhäsion (vWF an GPIb-IX-V und Kollagen an GPVI) führen ADP und Thromboxan A2 zu einer Inside-Out-Aktivierung des GPIIb/IIIa-Rezeptors, der Fibrinogen bindet und die Thrombozyten unlöslich vernetzt.'
                    }
                },
                {
                    id: 'n2',
                    label: 'Vernichtungsschmerz (> 20 Min., nitro-refraktär)',
                    category: 'clinical',
                    parent_id: 'root',
                    relation_label: 'Klinisches Leitsymptom',
                    socratic_hint: 'Wie äußert sich eine akute transmurale myokardiale Ischämie subjektiv beim Patienten im Gegensatz zur stabilen Angina pectoris?',
                    explanation: 'Anhaltender retrosternaler Druck- oder Vernichtungsschmerz (> 20 Min., kein Ansprechen auf Nitroglycerin), oft begleitet von Kaltschweißigkeit, Todesangst und vagaler Übelkeit.',
                    mastery_question: {
                        question: 'Bei welcher spezifischen Patientengruppe präsentiert sich ein akuter STEMI besonders häufig OHNE den klassischen retrosternalen Vernichtungsschmerz („stummer Infarkt“), sondern primär durch Dyspnoe, Synkope oder vegetative Erschöpfung?',
                        options: [
                            'Patienten mit langjährigem Diabetes mellitus und autonomer kardialer Neuropathie sowie hochbetagte Patienten und Frauen',
                            'Junge männliche Ausdauersportler mit physiologischer Sinusbradykardie und isolierter vagotoner Trainingsadaptation',
                            'Patienten mit bekannter familiärer Hypercholesterinämie unter hochdosierter Statin- und PCSK9-Inhibitor-Therapie',
                            'Patienten mit akutem Vorderwandinfarkt durch proximalen RIVA-Verschluss ohne begleitende Kollateralzirkulation'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Welche Stoffwechselerkrankung schädigt chronisch die viszerosensiblen Afferenzen (autonome Neuropathie), die den Ischämieschmerz vom Myokard zum ZNS leiten?',
                        rationale: 'Durch eine diabetische autonome Neuropathie werden viszerale Schmerzafferenzen geschädigt; zudem zeigen ältere Patienten, Frauen und Niereninsuffiziente signifikant häufiger atypische Äquivalente (Dyspnoe, Epigastralgie, Vigilanzminderung).'
                    }
                },
                {
                    id: 'n3',
                    label: '12-Kanal-EKG (< 10 Min. nach FMC)',
                    category: 'diagnostics',
                    parent_id: 'root',
                    relation_label: 'Apparative Sofort-Weichenstellung',
                    socratic_hint: 'Welche apparative Untersuchung muss laut ESC-Leitlinie zwingend innerhalb von 10 Minuten nach First Medical Contact erfolgen, ohne auf Laborwerte zu warten?',
                    explanation: 'Das 12-Kanal-EKG innerhalb von 10 Minuten nach Erstkontakt (First Medical Contact) stellt die Weiche für die sofortige Reperfusion – auf den Troponin-Anstieg darf beim STEMI nicht gewartet werden!',
                    mastery_question: {
                        question: 'Ein Patient bietet klinisch einen hochgradigen STEMI-Verdacht, das Standard-12-Kanal-EKG zeigt jedoch lediglich prominente R-Zacken und horizontale ST-Senkungen in V1–V3. Welche diagnostische Maßnahme ist laut ESC-Leitlinie sofort indiziert?',
                        options: [
                            'Sofortige Ableitung der posterioren Zusatzableitungen V7–V9 zum Nachweis eines streng posterioren Myokardinfarkts (RCX/RCA)',
                            'Abwarten des 0h/3h-Verlaufs des hochsensitiven Troponins auf der Normalstation vor einer etwaigen Katheter-Aktivierung',
                            'Durchführung einer ergometrischen Belastungsuntersuchung zur Provokation klassischer anteriorer ST-Strecken-Hebungen',
                            'Ausschluss eines transmuralen Infarkts, da ST-Senkungen in V1–V3 beweisend für eine harmlose frühe Repolarisation sind'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Denke dreidimensional: V1–V3 blicken von vorne auf das Herz. Wenn du dort „spiegelbildlich“ ST-Senkungen und hohe R-Zacken (als Spiegelbild von Q-Zacken) siehst, welche Herzwand ist dann transmural ischämisch?',
                        rationale: 'ST-Senkungen in V1–V3 mit R/S-Ratio > 1 sind oft das reziproke Spiegelbild eines streng posterioren STEMI (Verschluss von RCX oder RCA). Die Ableitungen V7–V9 (Cutoff ≥ 0,05 mV; ≥ 0,1 mV bei Männern < 40 J.) entlarven die direkte ST-Hebung.'
                    }
                },
                {
                    id: 'n4',
                    label: 'Primäre PCI (< 60–90 Min.)',
                    category: 'therapy',
                    parent_id: 'root',
                    relation_label: 'Kausale Reperfusionsstrategie',
                    socratic_hint: 'Welche Intervention öffnet das verschlossene Koronargefäß mechanisch mit der höchsten Erfolgsrate (Time is Muscle)?',
                    explanation: 'Die primäre perkutane Koronarintervention (PCI) mit Drug-Eluting-Stent (< 60 Min. im PCI-Zentrum, < 90 Min. bei Transfer) ist der Goldstandard zur Wiederherstellung des TIMI-III-Flusses.',
                    mastery_question: {
                        question: 'Ein STEMI-Patient hat seit 90 Minuten Thoraxschmerzen. Er befindet sich in einem peripheren Krankenhaus OHNE Herzkatheterlabor; der Transfer zur PCI würde 150 Minuten dauern. Wie lautet das leitliniengerechte Vorgehen (ESC)?',
                        options: [
                            'Einleitung einer sofortigen systemischen Fibrinolyse (innerhalb von 10 Min.) mit anschließendem unverzüglichem Transfer in ein PCI-Zentrum',
                            'Verzicht auf jegliche Reperfusionstherapie vor Ort und langsamer Sekundärtransport zur elektiven Koronarangiographie am Folgetag',
                            'Alleinige Gabe von ASS oral und Beobachtung auf der peripheren Intensivstation, bis der Troponin-Spitzenwert nach 24 Stunden fällt',
                            'Isolierte Anlage einer intraaortalen Ballonpumpe (IABP) ohne medikamentöse oder mechanische Wiedereröffnung des Gefäßes'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Ab welchem erwarteten Zeitfenster von der STEMI-Diagnose bis zur Drahtpassage (Wire Crossing) verliert die primäre PCI ihren Zeitvorteil gegenüber einer sofortigen Lyse?',
                        rationale: 'Kann eine primäre PCI nicht innerhalb von < 120 Minuten nach STEMI-Diagnose durchgeführt werden, ist bei Symptombeginn < 12 h (und fehlenden Kontraindikationen) eine sofortige Fibrinolyse (< 10 Min.) gefolgt vom sofortigen Transfer ins PCI-Zentrum (Routine-PCI nach 2–24 h oder Rescue-PCI) indiziert.'
                    }
                },
                {
                    id: 'n5',
                    label: 'LDL-Hypercholesterinämie & Nikotinabusus',
                    category: 'etiology',
                    parent_id: 'root',
                    relation_label: 'Chronische Atherogenese-Treiber',
                    socratic_hint: 'Welche chronisch-systemischen Faktoren fördern endotheliale Dysfunktion, Lipidkern-Wachstum und die Bildung vulnerabler Koronarplaques?',
                    explanation: 'Oxidiertes LDL-Cholesterin, Nikotinabusus, arterielle Hypertonie und Diabetes mellitus treiben über endotheliale Inflammation die koronare Atherosklerose voran.',
                    mastery_question: {
                        question: 'Welcher histomorphologische Plaque-Phänotyp („Thin-Cap Fibroatheroma“) weist das höchste Risiko für eine spontane Ruptur mit akutem Koronarverschluss auf?',
                        options: [
                            'Großer nekrotischer Lipidkern, dichtes Makrophagen-Infiltrat mit hoher Metalloproteinasen-Aktivität und dünne fibröse Kappe (< 65 µm)',
                            'Stark verkalkte, konzentrische Koronarstenose mit dicker kollagenreicher Kappe, vielen glatten Muskelzellen und minimalem Lipidkern',
                            'Rein funktioneller Koronarspasmus einer angiographisch völlig glatten Tunica intima ohne subendotheliale Schaumzell-Akkumulation',
                            'Ausgeprägte Media-Hypertrophie der peripheren Widerstandsgefäße ohne Beteiligung der epikardialen Leitarterien oder Makrophagen'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Was macht eine Plaque mechanisch instabil: eine dicke kollagenreiche Narbe oder Makrophagen (Schaumzellen), die das Kollagen der Kappe enzymatisch abbauen?',
                        rationale: 'Vulnerable Plaques zeichnen sich durch eine dünne fibröse Kappe (< 65 µm), wenige glatte Muskelzellen (geringe Kollagensynthese) und viele aktivierte Makrophagen aus, die über Matrix-Metalloproteinasen (MMPs) das Kollagengerüst der Kappe abbauen.'
                    }
                },
                {
                    id: 'n6',
                    label: 'Transmurale Nekrose & hs-cTnT/I-Anstieg',
                    category: 'pathophysiology',
                    parent_id: 'n1',
                    relation_label: 'verursacht nach 20–40 Min. Ischämie',
                    socratic_hint: 'Was passiert mit den Kardiomyozyten bei anhaltender kompletter Okklusion von innen nach außen (Subendokard -> Epikard) und welcher Strukturmarker wird frei?',
                    explanation: 'Ohne Reperfusion breitet sich die Wellenfront der Myokardnekrose (Wavefront Phenomenon nach Reimer) vom Subendokard transmural zum Epikard aus; durch Sarkolemm-Ruptur steigt hs-Troponin an.',
                    mastery_question: {
                        question: 'Warum beginnt der ischämische Zelluntergang beim akuten Koronarverschluss stets im Subendokard, bevor er sich als „Wavefront Phenomenon“ transmural bis zum Epikard ausbreitet?',
                        options: [
                            'Das Subendokard unterliegt in der Systole der höchsten intramuralen Wandspannung, wird nur diastolisch perfundiert und liegt am Ende der Gefäßstrecke',
                            'Die großen epikardialen Koronararterien verlaufen anatomisch direkt im Subendokard und geben ihre Endäste von innen nach außen ab',
                            'Subendokardiale Kardiomyozyten besitzen keine Mitochondrien und gewinnen ihr ATP ausschließlich über anaerobe Glykolyse',
                            'Das Epikard wird direkt aus dem sauerstoffreichen Blut des linken Ventrikelkavums über Thebesius-Venen retrograd versorgt'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Überlege, wo die Koronararterien verlaufen (außen auf dem Epikard) und welche Wandschicht während der Systole durch den hohen Ventrikeldruck am stärksten komprimiert wird!',
                        rationale: 'Die Koronararterien penetrieren das Myokard von außen (epikardial) nach innen (subendokardial). Im Subendokard herrscht der höchste extravasale Kompressionsdruck, der höchste O2-Bedarf und die geringste Kollateralreserve.'
                    }
                },
                {
                    id: 'n7',
                    label: 'Ausstrahlung in linken Arm (ulnar) & Kiefer',
                    category: 'clinical',
                    parent_id: 'n2',
                    relation_label: 'projiziert über Head-Zonen (C8–Th5) als',
                    socratic_hint: 'Wohin projiziert der viszerale Herzschmerz über die viszerosomatische Konvergenz im Hinterhorn des Rückenmarks?',
                    explanation: 'Über viszerosomatische Konvergenz (Segmente C8–Th5) wird der viszerale Ischämieschmerz als übertragener Schmerz (Referred Pain) in den linken Arm, Hals, Unterkiefer oder das Epigastrium projiziert.',
                    mastery_question: {
                        question: 'Durch welchen neuroanatomischen Mechanismus nimmt die Großhirnrinde eine myokardiale Ischämie als Schmerz an der ulnaren Seite des linken Arms oder im Unterkiefer wahr?',
                        options: [
                            'Konvergenz viszerosensibler kardialer Afferenzen und somatosensibler Hautafferenzen auf dieselben Wide-Dynamic-Range-Neurone im Hinterhorn',
                            'Direkte anatomische Kompression des Plexus brachialis durch die akute ischämische Dilatation des linken Ventrikels im Mediastinum',
                            'Fortgeleitete arterielle Embolisation aus dem linken Koronarsinus direkt in die A. subclavia sinistra und A. carotis externa',
                            'Efferente parasympathische Überstimulation des Nervus phrenicus mit direkter motorischer Verkrampfung der Unterarmmuskulatur'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Wie verschalten das Herz und die Dermatome C8–Th5 ihre Schmerzfasern auf der Ebene des Rückenmarks (Tractus spinothalamicus)?',
                        rationale: 'Viszerosensible Sympathikus-Afferenzen des Herzens (C8–Th5) und somatosensible Afferenzen der entsprechenden Dermatome (z. B. C8/Th1 = ulnarer Unterarm) projizieren auf gemeinsame Hinterhornneurone (viszerosomatische Konvergenz). Der Kortex interpretiert das Signal als somatischen Oberflächenschmerz.'
                    }
                },
                {
                    id: 'n8',
                    label: 'Konvexe ST-Hebung in ≥ 2 Nachbarableitungen',
                    category: 'diagnostics',
                    parent_id: 'n3',
                    relation_label: 'zeigt als beweisendes Ischämie-Kriterium',
                    socratic_hint: 'Welches spezifische Erregungsrückbildungs-Kriterium am J-Punkt beweist im EKG den transmuralen Verletzungsstrom eines Versorgungsgebiets?',
                    explanation: 'Signifikante ST-Strecken-Hebungen am J-Punkt in mindestens zwei anatomisch benachbarten Ableitungen (mit reziproken ST-Senkungen im Gegenwandgebiet) sichern die Diagnose.',
                    mastery_question: {
                        question: 'Das 12-Kanal-EKG zeigt signifikante konvexe ST-Hebungen in den Ableitungen II, III und aVF (wobei die ST-Hebung in III > II ist) sowie reziproke ST-Senkungen in I und aVL. Welches Koronargefäß ist am wahrscheinlichsten verschlossen?',
                        options: [
                            'Rechte Koronararterie (RCA), wobei zusätzlich rechtspräkordiale Ableitungen (V3r/V4r) zum Ausschluss eines RV-Infarkts obligat sind',
                            'Proximaler Ramus interventricularis anterior (RIVA/LAD) vor Abgang des ersten großen Septal- und Diagonalastes',
                            'Distaler Ramus circumflexus (RCX) bei einem ausgeprägten anatomischen Linksversorgungstyp ohne Beteiligung der Hinterwand',
                            'Isolierter Verschluss der Vena cardiaca magna mit venöser Stauung der anterolateralen Papillarmuskulatur'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'II, III und aVF repräsentieren die inferiore Herzwand. Wenn der Verletzungsvektor stärker nach rechts-unten (Ableitung III bei +120°) als nach links-unten (Ableitung II bei +60°) zeigt, welches Gefäß ist dann betroffen?',
                        rationale: 'Inferiore ST-Hebungen (II, III, aVF) mit dem Kriterium ST-Hebung in III > II und tiefer ST-Senkung in I/aVL sprechen mit hoher Spezifität für einen RCA-Verschluss (statt RCX). Hier muss zwingend V3r/V4r abgeleitet werden, um eine rechtsventrikuläre Beteiligung zu erkennen.'
                    }
                },
                {
                    id: 'n9',
                    label: 'DAPT (ASS + Prasugrel/Ticagrelor für 12 Mo.)',
                    category: 'therapy',
                    parent_id: 'n4',
                    relation_label: 'erfordert zur Stentthrombose-Prophylaxe',
                    socratic_hint: 'Welche duale medikamentöse Thrombozytenhemmung verhindert nach erfolgreicher Stent-Implantation über 12 Monate den akuten Wiederverschluss?',
                    explanation: 'Nach DES-Implantation beim ACS ist eine duale Thrombozytenaggregationshemmung (DAPT) aus ASS (COX-1-Hemmer) plus einem potenten P2Y12-Inhibitor (Prasugrel oder Ticagrelor) für 12 Monate obligat.',
                    mastery_question: {
                        question: 'Warum werden Prasugrel oder Ticagrelor beim akuten STEMI mit PCI gegenüber Clopidogrel bevorzugt, und bei welcher Anamnese ist Prasugrel absolut kontraindiziert?',
                        options: [
                            'Schnellerer und konsistenterer Wirkungseintritt unabhängig von CYP2C19-Polymorphismen; Prasugrel ist bei Z.n. TIA/Schlaganfall absolut kontraindiziert',
                            'Sie hemmen zusätzlich direkt den Gerinnungsfaktor Xa im Plasma; Prasugrel ist ausschließlich bei einem Lebensalter unter 50 Jahren kontraindiziert',
                            'Clopidogrel wirkt nur intravenös mit einer Halbwertszeit von 5 Minuten; Prasugrel ist bei Vorliegen einer arteriellen Hypertonie kontraindiziert',
                            'Beide Substanzen aktivieren direkt Plasminogen; Prasugrel darf niemals zusammen mit niedrig dosierter Acetylsalicylsäure gegeben werden'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Clopidogrel ist ein Prodrug mit zweistufiger hepatischer CYP2C19-Aktivierung („Low-Responder“-Risiko). Welches schwere neurologische Ereignis in der Vorgeschichte verbietet den Einsatz von Prasugrel (TRITON-TIMI-38)?',
                        rationale: 'Prasugrel (irreversibler P2Y12-Blocker) und Ticagrelor (direkt wirksamer, reversibler P2Y12-Blocker) überwinden die genetische CYP2C19-Variabilität von Clopidogrel. Prasugrel ist bei Z.n. Schlaganfall oder TIA absolut kontraindiziert (und bei ≥ 75 J. oder < 60 kg nur mit Vorsicht/Dosisreduktion einzusetzen).'
                    }
                }
            ],
            distractors: [
                {
                    id: 'd_stemi_1',
                    label: 'Konkave ST-Hebung aus allen Ableitungen + PR-Senkung',
                    category: 'diagnostics',
                    distractor_reason: 'Klinische Falle (Differenzialdiagnose): Diffuse konkave („sattelförmige“) ST-Hebungen ohne anatomisches Koronarterritorium in Kombination mit PR-Senkung sind klassisch für die akute Perikarditis, nicht für einen territorialen STEMI!'
                },
                {
                    id: 'd_stemi_2',
                    label: 'Reperfusions-Entscheidung erst nach 0h/3h-Troponin',
                    category: 'diagnostics',
                    distractor_reason: 'Gefährlicher Behandlungsfehler: Beim STEMI („Time is Muscle“) wird die Indikation zur sofortigen Koronarangiographie rein klinisch + EKG-basiert gestellt. Auf das Troponin-Ergebnis zu warten kostet vitales Myokard!'
                },
                {
                    id: 'd_stemi_3',
                    label: 'Isolierte Nitrate i.v. bei Rechtsventrikulärem Infarkt',
                    category: 'therapy',
                    distractor_reason: 'Klinische Kontraindikation: Bei rechtsventrikulärer Beteiligung (oft bei Hinterwand-STEMI II, III, aVF + V4r) ist der RV extrem vorlastabhängig. Nitrate senken das venöse Pooling und lösen einen kardiogenen Schock aus!'
                }
            ]
        },
        {
            id: 'mm_pneumo_lae_001',
            title: 'Akute Lungenarterienembolie (LAE)',
            specialty: 'Pneumologie / Notfallmedizin',
            central_concept: 'Lungenarterienembolie (LAE)',
            nodes: [
                {
                    id: 'l1',
                    label: 'Tiefe Bein-/Beckenvenenthrombose (TVT)',
                    category: 'etiology',
                    parent_id: 'root',
                    relation_label: 'Kausale Emboliequelle (~90%)',
                    socratic_hint: 'Woher stammt der eingeschwemmte Thrombus (Virchow-Trias: Stase, Endothelschaden, Hyperkoagulabilität) in den allermeisten Fällen anatomisch?',
                    explanation: 'Rund 90 % aller Lungenembolien entstehen durch Abschwemmung eines Thrombus aus den tiefen Bein- oder Beckenvenen (V. poplitea, V. femoralis, V. iliaca).',
                    mastery_question: {
                        question: 'Welcher molekulare Defekt stellt die häufigste hereditäre Thrombophilie dar, die über eine gestörte Inaktivierung der Gerinnungsfaktoren Va und VIIIa das Risiko für eine TVT und LAE signifikant erhöht?',
                        options: [
                            'Punktmutation im Faktor-V-Gen (Faktor-V-Leiden), die zur Resistenz gegenüber der proteolytischen Spaltung durch aktiviertes Protein C (APC-Resistenz) führt',
                            'Kompletter genetischer Mangel an von-Willebrand-Faktor mit konsekutiver Überaktivierung der primären thrombozytären Hämostase im venösen Niederdrucksystem',
                            'Autosomal-rezessive Überexpression von Gewebe-Plasminogenaktivator (t-PA) mit unkontrollierter Vernetzung von Fibrinmonomeren in den Beinvenen',
                            'Isolierte Defizienz von Gerinnungsfaktor VIII (Hämophilie A) mit paradoxer Hyperkoagulabilität bei postoperativer venöser Stase'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Welches physiologische Antikoagulans spaltet normalerweise Faktor Va, und wie nennt man die häufigste Punktmutation, die diese Spaltstelle unempfindlich macht?',
                        rationale: 'Die Faktor-V-Leiden-Mutation (Arg506Gln) verhindert die Inaktivierung von Faktor Va durch aktiviertes Protein C (APC-Resistenz) und ist der häufigste genetische Risikofaktor für venöse Thromboembolien (gefolgt von der Prothrombin-G20210A-Mutation).'
                    }
                },
                {
                    id: 'l2',
                    label: 'Abrupter Nachlastanstieg des rechten Ventrikels',
                    category: 'pathophysiology',
                    parent_id: 'root',
                    relation_label: 'Hämodynamische Primärfolge',
                    socratic_hint: 'Welcher dünnwandige Herzabschnitt muss plötzlich gegen den akut erhöhten pulmonalvaskulären Widerstand (PVR) und die Thromboxan-vermittelte Vasokonstriktion anpumpen?',
                    explanation: 'Durch mechanische Obstruktion (> 30–50 % des Gefäßbetts) und neurohumorale Vasokonstriktion (Serotonin, Thromboxan A2) steigt die rechtsventrikuläre Nachlast abrupt an -> akutes Cor pulmonale.',
                    mastery_question: {
                        question: 'Warum steigt der pulmonalvaskuläre Widerstand (PVR) bei einer akuten LAE oft deutlich stärker an, als es durch die rein mechanische Gefäßverlegung des Embolus allein erklärbar wäre?',
                        options: [
                            'Zusätzliche Freisetzung potenter Vasokonstriktoren (Thromboxan A2, Serotonin) aus aktivierten Thrombozyten sowie hypoxische pulmonale Vasokonstriktion (Euler-Liljestrand)',
                            'Gleichzeitiger spastischer Verschluss der Lungenvenen durch eine parasympathische Vagus-Überaktivierung im linken Vorhof',
                            'Sofortige kompensatorische Verdickung (konzentrische Hypertrophie) der Media aller Pulmonalarterien innerhalb weniger Minuten nach Embolisation',
                            'Abrupter Anstieg der Blutviskosität auf das Dreifache durch akute osmotische Hämokonzentration in den Alveolarkapillaren'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Denke an das Zusammenspiel aus biochemischen Botenstoffen des Thrombus und dem physiologischen Reflex der Lungenstrombahn auf alveoläre Hypoxie!',
                        rationale: 'Neben der mechanischen Obstruktion setzen Thrombozyten und Endothel Thromboxan A2, Serotonin und Endothelin-1 frei; zusammen mit dem Euler-Liljestrand-Mechanismus (hypoxische Vasokonstriktion) führt dies zu einem massiven PVR-Anstieg, gegen den der dünnwandige RV (Wanddicke 3–4 mm) nicht anpumpen kann.'
                    }
                },
                {
                    id: 'l3',
                    label: 'Akute Dyspnoe, Tachypnoe & Pleuraschmerz',
                    category: 'clinical',
                    parent_id: 'root',
                    relation_label: 'Klinische Initialtrias',
                    socratic_hint: 'Welche Symptome treten plötzlich durch funktionelle Totraumventilation, V/Q-Mismatch und periphere pleurale Infarzierung auf?',
                    explanation: 'Plötzliche Dyspnoe, Tachypnoe, Sinustachykardie und atemabhängiger (pleuritischer) Thoraxschmerz sind die häufigsten Initialsymptome.',
                    mastery_question: {
                        question: 'Welche charakteristische Konstellation zeigt die arterielle Blutgasanalyse (BGA) typischerweise bei einer akuten, mittelschweren Lungenarterienembolie?',
                        options: [
                            'Hypoxämie (erniedrigter paO2) kombiniert mit einer Hypokapnie (erniedrigter paCO2) und respiratorischer Alkalose infolge der kompensatorischen Hyperventilation',
                            'Isolierte schwere Hyperkapnie (paCO2 > 65 mmHg) bei gleichzeitig völlig normalem arteriellem Sauerstoffpartialdruck und metabolischer Alkalose',
                            'Ausgeprägte respiratorische Azidose mit kompensatorischem Bikarbonat-Abfall durch primäre Lähmung des Atemzentrums in der Medulla oblongata',
                            'Erhöhter arterieller Sauerstoffpartialdruck (Hyperoxämie) bei vergrößerter alveolo-arterieller Sauerstoffdruckdifferenz (AaDO2 = 0 mmHg)'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Der Patient hat durch das V/Q-Mismatch einen O2-Mangel und atmet deshalb sehr schnell (Tachypnoe). Da CO2 20-mal besser diffundiert als O2: Was passiert durch die Tachypnoe mit dem paCO2?',
                        rationale: 'Durch Ventilations-Perfusions-Inhomogenität (V/Q-Mismatch) und funktionellen Rechts-Links-Shunt sinkt der paO2 (erhöhte AaDO2), während die reflektorische Hyperventilation vermehrt CO2 abatmet (Hypokapnie + respiratorische Alkalose).'
                    }
                },
                {
                    id: 'l4',
                    label: 'Wells-Score + alterskorrigierte D-Dimere / CTPA',
                    category: 'diagnostics',
                    parent_id: 'root',
                    relation_label: 'Gestufter Diagnose-Algorithmus',
                    socratic_hint: 'Wie kombiniert man klinische Vortestwahrscheinlichkeit, hochsensitives Ausschlusslabor und bildgebenden Goldstandard bei hämodynamisch stabilen Patienten?',
                    explanation: 'Bei niedriger/mittlerer Wahrscheinlichkeit (Wells/Geneva) schließen negative D-Dimere (ab 50 J.: Alter × 10 µg/L) eine LAE sicher aus; bei hoher Vortestwahrscheinlichkeit oder positiven D-Dimeren folgt direkt die CT-Pulmonalisangiographie (CTPA).',
                    mastery_question: {
                        question: 'Ein 72-jähriger, hämodynamisch stabiler Patient hat einen niedrigen Wells-Score (1,5 Punkte). Sein D-Dimer-Wert im Plasma beträgt 640 µg/L (Standard-Referenz < 500 µg/L). Wie ist dieser Befund nach aktueller ESC-Leitlinie zu werten?',
                        options: [
                            'Durch Anwendung des altersadaptierten Cutoffs (Alter × 10 µg/L = 720 µg/L ab 50 Jahren) gilt der Befund als negativ und schließt eine LAE ohne CTPA aus',
                            'Da der Wert über dem starren Grenzwert von 500 µg/L liegt, ist die Diagnose einer LAE bewiesen und eine sofortige Thrombolyse ohne Bildgebung Pflicht',
                            'Der altersadaptierte Cutoff lautet Alter geteilt durch 2 (360 µg/L), weshalb der Wert hochgradig pathologisch ist und eine V/Q-Szintigraphie erzwingt',
                            'D-Dimere besitzen eine Spezifität von 99 %, aber eine Sensitivität von nur 20 %, weshalb sie zum Ausschluss einer LAE grundsätzlich ungeeignet sind'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Ab 50 Jahren steigen D-Dimere physiologisch an. Wie berechnet man den alterskorrigierten D-Dimer-Grenzwert (in µg/L) bei einem 72-jährigen Patienten?',
                        rationale: 'Bei Patienten > 50 Jahre erhöht der altersadaptierte D-Dimer-Cutoff (Alter × 10 µg/L, hier 72 × 10 = 720 µg/L) die Spezifität signifikant, ohne die hohe Sensitivität (> 95 %) bei niedriger/mittlerer Vortestwahrscheinlichkeit zu gefährden. 640 µg/L liegt unter 720 µg/L -> LAE ausgeschlossen.'
                    }
                },
                {
                    id: 'l5',
                    label: 'Therapeutische Antikoagulation (DOAK / NMH)',
                    category: 'therapy',
                    parent_id: 'root',
                    relation_label: 'Sofort-Basistherapie (Non-High-Risk)',
                    socratic_hint: 'Welche medikamentöse Maßnahme stoppt sofort das appositionelle Thrombuswachstum und Rezidivembolien bei hämodynamisch stabilen Patienten?',
                    explanation: 'Hämodynamisch stabile Patienten erhalten sofort eine therapeutische Antikoagulation (bevorzugt direkte Faktor-Xa-Inhibitoren wie Apixaban/Rivaroxaban oder initial NMH/Fondaparinux).',
                    mastery_question: {
                        question: 'Bei welcher der folgenden klinischen Konstellationen sind direkte orale Antikoagulanzien (DOAK wie Apixaban/Rivaroxaban) zur LAE-Therapie KONTRAINDIZIERT, sodass stattdessen Heparin bzw. ein Vitamin-K-Antagonist eingesetzt werden muss?',
                        options: [
                            'Patienten mit gesichertem Antiphospholipid-Syndrom (insb. Triple-Positivität), schwerer Niereninsuffizienz (CrCl < 15 mL/min) oder während der Schwangerschaft',
                            'Alle Patienten über 65 Jahre mit begleitender arterieller Hypertonie und einer glomerulären Filtrationsrate (eGFR) von 75 mL/min',
                            'Patienten mit einer unprovozierten tiefen Beinvenenthrombose nach einem Langstreckenflug ohne bekannte Gerinnungsstörung',
                            'Patienten mit normotensiver Intermediate-Low-Risk-LAE, die kein erhöhtes kardiales Troponin im Aufnahmelabor aufweisen'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Denke an Autoantikörper-vermittelte Thrombophilien (TRAPS-Studie), Plazentagängigkeit und renale Elimination von Faktor-Xa-Inhibitoren!',
                        rationale: 'DOAKs sind plazentagängig (in Schwangerschaft/Stillzeit kontraindiziert, dort NMH Mittel der Wahl), bei terminaler Niereninsuffizienz (CrCl < 15 mL/min) und beim Antiphospholipid-Syndrom (erhöhte Rate arterieller Thromboembolien unter DOAK vs. VKA) kontraindiziert.'
                    }
                },
                {
                    id: 'l6',
                    label: 'LV-Vorlastmangel & Obstruktiver Schock (RRsys < 90)',
                    category: 'pathophysiology',
                    parent_id: 'l2',
                    relation_label: 'mündet über Septumshift (D-Sign) in',
                    socratic_hint: 'Was passiert durch die rechtsventrikuläre Dilatation und paradoxe Septumverschiebung (Ventrikel-Interdependenz im unnachgiebigen Perikard) mit der Füllung des linken Ventrikels?',
                    explanation: 'Der akut dilatierte rechte Ventrikel wölbt das interventrikuläre Septum nach links (D-Shaping im Echo), komprimiert den linken Ventrikel und führt zum kritischen LV-Vorlastmangel -> obstruktiver Schock (High-Risk-LAE).',
                    mastery_question: {
                        question: 'Über welchen zweifachen pathophysiologischen Mechanismus („Todes-Spirale des rechten Ventrikels“) führt die akute RV-Dilatation bei einer High-Risk-LAE zum kardiogen-obstruktiven Schock?',
                        options: [
                            'Septumshift nach links (D-Sign) behindert die diastolische LV-Füllung -> Abfall von HZV und Aortendruck -> rechtskoronare Minderperfusion mit akuter RV-Ischämie',
                            'Erhöhter Druck im linken Vorhof führt zum sofortigen Lungenödem mit nachfolgender Kompression der Aorta descendens im hinteren Mediastinum',
                            'Paradoxe Öffnung des Foramen ovale mit massivem Links-Rechts-Shunt und Volumenüberladung des linken Ventrikels in der Diastole',
                            'Reflektorische Bradykardie (Bezold-Jarisch-Reflex) mit kompletter Erschlaffung des interventrikulären Septums und Anstieg des systemischen Blutdrucks'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Verfolge die Kette im unnachgiebigen Herzbeutel: 1. RV drückt das Septum in den LV -> 2. LV wirft kein Blut in die Aorta aus -> 3. Woher bezieht die rechte Koronararterie (RCA) ihren Perfusionsdruck?',
                        rationale: 'Durch den verringerten transpulmonalen Einstrom und die Kompression des LV durch die paradoxe Septumverschiebung (Ventrikel-Interdependenz) sinken LV-Vorlast, Schlagvolumen und systemischer Aortendruck. Da der überlastete RV gleichzeitig einen hohen intramuralen Druck hat, bricht der koronare Perfusionsdruck der RCA zusammen -> tödliche RV-Ischämie.'
                    }
                },
                {
                    id: 'l7',
                    label: 'Systemische Thrombolyse (rt-PA / Alteplase) + UFH',
                    category: 'therapy',
                    parent_id: 'l6',
                    relation_label: 'indiziert als lebensrettende Reperfusion',
                    socratic_hint: 'Welche medikamentöse Reperfusionstherapie löst den Embolus bei hämodynamischer Instabilität (High-Risk-LAE / Schock) aktiv auf?',
                    explanation: 'Erst bei High-Risk-LAE (obstruktiver Schock / persistierende Hypotonie RRsys < 90 mmHg) überwiegt der Nutzen der systemischen Fibrinolyse mit rt-PA (Alteplase) plus unfraktioniertem Heparin das Blutungsrisiko.',
                    mastery_question: {
                        question: 'Ein Patient erleidet eine High-Risk-LAE mit obstruktiven Schockzeichen (RR 75/40 mmHg), hatte jedoch vor 5 Tagen eine große neurochirurgische intrakranielle Tumorresektion. Welche Reperfusionsstrategie ist hier indiziert?',
                        options: [
                            'Da eine absolute Kontraindikation gegen die systemische Lyse besteht, ist eine kathetergestützte Thrombektomie oder chirurgische Embolektomie (plus UFH) indiziert',
                            'Trotz der frischen Hirnoperation muss sofort die volle systemische Dosis von 100 mg Alteplase (rt-PA) i.v. über 2 Stunden verabreicht werden',
                            'Alleinige orale Gabe eines Vitamin-K-Antagonisten (Phenprocoumon), da die volle Wirkung bereits nach 15 Minuten den Schock durchbricht',
                            'Aggressive Volumentherapie mit 4 Litern Elektrolytlösung zur Erhöhung der rechtsventrikulären Vorlast ohne jegliche Antikoagulation'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Eine frische intrakranielle OP ist eine absolute Kontraindikation für systemisches rt-PA. Wie kann der Thrombus im Pulmonalarterienstamm trotzdem mechanisch entfernt werden?',
                        rationale: 'Bei High-Risk-LAE und absoluten Lyse-Kontraindikationen (z. B. intrakranieller Eingriff < 3 Wochen, hämorrhagischer Schlaganfall, aktive schwere Blutung) oder nach erfolgloser Lyse empfiehlt die ESC-Leitlinie die chirurgische pulmonale Embolektomie oder perkutane kathetergestützte Verfahren.'
                    }
                }
            ],
            distractors: [
                {
                    id: 'd_lae_1',
                    label: 'D-Dimer-Bestimmung zum Ausschluss bei hohem Wells-Score',
                    category: 'diagnostics',
                    distractor_reason: 'Klinische Algorithmus-Falle: Bei hoher klinischer Vortestwahrscheinlichkeit (Wells-Score > 6 Punkte) reicht der negative prädiktive Wert der D-Dimere NICHT aus, um eine LAE sicher auszuschließen – hier muss direkt eine CTPA erfolgen!'
                },
                {
                    id: 'd_lae_2',
                    label: 'Massive Volumengabe (> 2000 mL Kristalloide) im RV-Versagen',
                    category: 'therapy',
                    distractor_reason: 'Pathophysiologische Falle: Eine aggressive Volumengabe überdehnt den ohnehin dilatierten rechten Ventrikel noch weiter, verstärkt den Septumshift nach links (Ventrikel-Interdependenz) und verschlimmert den obstruktiven Schock!'
                },
                {
                    id: 'd_lae_3',
                    label: 'Primäre systemische Lyse bei normotensiver Intermediate-Low-LAE',
                    category: 'therapy',
                    distractor_reason: 'Leitlinien-Falle (PEITHO-Studie): Bei normotensiven Patienten ohne Schock erhöht die routinemäßige systemische Thrombolyse das Risiko für schwere und intrakranielle Blutungen signifikant ohne relevanten Mortalitätsvorteil!'
                }
            ]
        }
    ];

    const state = {
        mindmaps: [],
        currentMap: null,
        solvedNodeIds: new Set(),
        eliminatedDistractorIds: new Set(),
        poolOrderIds: [],
        selectedChipId: null,
        hoveredNodeId: null,
        difficultyPreset: 'clinical', // 'guided' | 'clinical' | 'exam'
        blindMode: false,
        strictCausalOrder: true,
        deepComprehensionMode: true,  // NEU V6.0: Öffnet beim Platzieren das Deep Clinical Mastery Gate!
        activeRecallFirstMode: false, // NEU V6.0: Erst Freitext-Hypothese tippen, bevor die 4 MC-Optionen aufgedeckt werden!
        includeDistractors: true,
        blindRootMode: false,
        rootRevealed: false,
        showInspector: false,
        expandedCanvas: false,
        mistakesCount: 0,
        streakCount: 0,
        maxStreak: 0,
        weakNodeIds: new Set(),
        startTime: null,
        nodePositions: {},
        progressCache: {},
        zoom: 0.65,
        panX: 0,
        panY: 0,
        isPanning: false
    };

    // ========================================================================
    // 1. INITIALISIERUNG, SCOPED CSS & DOM-STRUKTUR
    // ========================================================================

 function ensureMindmapStyles() {
        if (document.getElementById('medcheck-mindmap-v6-styles')) return;
        const styleEl = document.createElement('style');
        styleEl.id = 'medcheck-mindmap-v6-styles';
        styleEl.textContent = `
            .mm-preset-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                padding: 10px 14px;
                margin-bottom: 12px;
                border-radius: 12px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.72));
                border: 1px solid var(--card-border, rgba(56, 189, 248, 0.22));
            }
            .mm-preset-group {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .mm-preset-btn {
                padding: 6px 12px;
                border-radius: 8px;
                font-size: 0.78rem;
                font-weight: 700;
                cursor: pointer;
                border: 1px solid var(--card-border, rgba(255, 255, 255, 0.12));
                background: var(--surface-subtle, rgba(30, 41, 59, 0.65));
                color: var(--text-muted, #94a3b8);
                transition: all 0.18s ease;
            }
            .mm-preset-btn:hover {
                border-color: var(--accent-cyan, #38bdf8);
                color: var(--text-main, #f8fafc);
            }
            .mm-preset-btn.active {
                background: var(--badge-primary-bg, rgba(56, 189, 248, 0.22));
                border-color: var(--accent-cyan, #38bdf8);
                color: var(--text-main, #f8fafc);
                box-shadow: 0 0 14px rgba(56, 189, 248, 0.18);
            }
            .mm-synapse-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 9999;
                background: rgba(15, 23, 42, 0.65);
                backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                animation: mmFadeIn 0.16s ease-out;
            }
            .mm-synapse-modal {
                width: 100%;
                max-width: 680px;
                max-height: 92vh;
                overflow-y: auto;
                background: var(--surface-primary, #0f172a);
                border: 1px solid var(--card-border, rgba(56, 189, 248, 0.5));
                border-radius: 18px;
                padding: 22px 24px;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
                color: var(--text-main, #f8fafc);
            }
            .mm-synapse-chain-box {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 10px 14px;
                margin: 10px 0 14px;
                border-radius: 10px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.92));
                border: 1px dashed var(--accent-cyan, rgba(56, 189, 248, 0.4));
                font-size: 0.82rem;
                flex-wrap: wrap;
            }
            .mm-synapse-node-pill {
                padding: 5px 10px;
                border-radius: 8px;
                background: var(--surface-subtle, rgba(30, 41, 59, 0.95));
                border: 1px solid var(--card-border, rgba(255, 255, 255, 0.12));
                font-weight: 700;
                color: var(--text-main, #e2e8f0);
            }
            .mm-synapse-missing-pill {
                padding: 4px 10px;
                border-radius: 999px;
                background: rgba(16, 185, 129, 0.16);
                border: 1px solid #10b981;
                color: #10b981;
                font-weight: 800;
                font-size: 0.75rem;
            }
            .mm-mastery-question-box {
                padding: 14px 16px;
                border-radius: 12px;
                background: var(--surface-secondary, rgba(30, 41, 59, 0.9));
                border: 1px solid var(--card-border, transparent);
                border-left: 4px solid var(--accent-cyan, #38bdf8);
                font-size: 0.94rem;
                font-weight: 700;
                line-height: 1.5;
                color: var(--text-main, #f8fafc);
                margin-bottom: 14px;
            }
            .mm-recall-first-box {
                padding: 14px;
                border-radius: 12px;
                background: var(--surface-secondary, rgba(30, 41, 59, 0.55));
                border: 1px solid rgba(245, 158, 11, 0.45);
                margin-bottom: 14px;
            }
            .mm-recall-textarea {
                width: 100%;
                min-height: 68px;
                margin-top: 8px;
                padding: 10px 12px;
                border-radius: 8px;
                border: 1px solid var(--card-border, rgba(255, 255, 255, 0.16));
                background: var(--surface-primary, rgba(6, 9, 19, 0.85));
                color: var(--text-main, #f8fafc);
                font-family: inherit;
                font-size: 0.85rem;
                resize: vertical;
            }
            .mm-synapse-options {
                display: flex;
                flex-direction: column;
                gap: 9px;
                margin-bottom: 14px;
            }
            .mm-synapse-opt-btn {
                text-align: left;
                padding: 12px 15px;
                border-radius: 11px;
                border: 1px solid var(--card-border, rgba(255, 255, 255, 0.13));
                background: var(--surface-secondary, rgba(30, 41, 59, 0.75));
                color: var(--text-main, #f1f5f9);
                font-size: 0.86rem;
                line-height: 1.45;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.16s ease;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
            }
            .mm-synapse-opt-btn:hover:not(:disabled) {
                background: var(--badge-primary-bg, rgba(56, 189, 248, 0.16));
                border-color: var(--accent-cyan, #38bdf8);
                transform: translateX(3px);
            }
            .mm-synapse-opt-btn.wrong-choice {
                background: rgba(239, 68, 68, 0.14) !important;
                border-color: #ef4444 !important;
                color: #ef4444 !important;
                opacity: 0.78;
            }
            .mm-synapse-opt-btn.correct-choice {
                background: rgba(16, 185, 129, 0.18) !important;
                border-color: #10b981 !important;
                color: var(--text-main, #ecfdf5) !important;
                box-shadow: 0 0 18px rgba(16, 185, 129, 0.22);
            }
            .mm-mastery-rationale-box {
                padding: 12px 14px;
                border-radius: 10px;
                background: rgba(16, 185, 129, 0.12);
                border: 1px solid rgba(16, 185, 129, 0.4);
                color: var(--text-main, #e2e8f0);
                font-size: 0.84rem;
                line-height: 1.5;
                margin-top: 10px;
            }
            .mm-mastery-nudge-box {
                padding: 11px 14px;
                border-radius: 10px;
                background: rgba(245, 158, 11, 0.14);
                border-left: 3px solid #f59e0b;
                color: var(--text-main, #fde68a);
                font-size: 0.83rem;
                line-height: 1.45;
                margin-top: 8px;
            }
            .mm-depot-pin-btn {
                margin-top: 8px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 10px;
                border-radius: 7px;
                font-size: 0.75rem;
                font-weight: 700;
                background: var(--badge-primary-bg, rgba(56, 189, 248, 0.14));
                border: 1px solid var(--accent-cyan, rgba(56, 189, 248, 0.4));
                color: var(--accent-blue, #38bdf8);
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .mm-depot-pin-btn:hover {
                background: rgba(56, 189, 248, 0.26);
            }
            .mm-chip.distractor-eliminated {
                opacity: 0.35 !important;
                text-decoration: line-through;
                pointer-events: none;
                border-color: #ef4444 !important;
            }
            .mm-root-deduce-box {
                margin-top: 6px;
                display: flex;
                gap: 6px;
                align-items: center;
            }
            .mm-root-deduce-input {
                padding: 4px 8px;
                border-radius: 6px;
                border: 1px solid var(--accent-cyan, rgba(56, 189, 248, 0.5));
                background: var(--surface-primary, rgba(6, 9, 19, 0.85));
                color: var(--text-main, #f8fafc);
                font-size: 0.78rem;
                width: 170px;
            }
            .mm-root-deduce-btn {
                padding: 4px 8px;
                border-radius: 6px;
                border: 1px solid var(--accent-blue, #38bdf8);
                background: var(--badge-primary-bg, rgba(56, 189, 248, 0.25));
                color: var(--text-main, #ffffff);
                font-size: 0.75rem;
                font-weight: 700;
                cursor: pointer;
            }
            @keyframes mmFadeIn {
                from { opacity: 0; transform: scale(0.96); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(styleEl);
    }
    function clearBrowserTextSelection() {
        try {
            if (window.getSelection) {
                const sel = window.getSelection();
                if (sel && sel.removeAllRanges) sel.removeAllRanges();
            }
        } catch (_e) {}
    }

    function ensureDomStructure() {
        ensureMindmapStyles();
        let viewSection = document.getElementById('mindmap-view');
        if (!viewSection) {
            const mainEl = document.querySelector('.content-body > div') || document.querySelector('main') || document.body;
            viewSection = document.createElement('section');
            viewSection.id = 'mindmap-view';
            viewSection.className = 'panel view-section hidden';
            viewSection.style.display = 'none';
            mainEl.appendChild(viewSection);
        }
        return viewSection;
    }

    async function init() {
        ensureDomStructure();
        await loadMindmapsAndProgress();
        if (!state.currentMap && state.mindmaps.length > 0) {
            selectMindmap(state.mindmaps[0].id);
        } else {
            renderModule();
        }

        window.addEventListener('resize', () => {
            if (isViewVisible()) {
                fitStageToViewport();
                drawSvgConnections();
            }
        });
    }

    function isViewVisible() {
        const el = document.getElementById('mindmap-view');
        return el && !el.classList.contains('hidden') && el.style.display !== 'none';
    }

    function openView() {
        const viewSection = ensureDomStructure();
        viewSection.classList.remove('hidden');
        viewSection.style.display = 'block';

        if (!state.currentMap) {
            init();
        } else {
            renderModule();
            requestAnimationFrame(() => {
                fitStageToViewport();
                drawSvgConnections();
            });
        }
    }

    // ========================================================================
    // 2. SUPABASE PERSISTENZ, LOCALSTORAGE SYNC, LERN-DEPOT & LÖSCH-FUNKTION
    // ========================================================================

    function getSupabase() {
        return window.supabaseClient || window.supabase || window.sb || (window.Auth && window.Auth.supabase) || null;
    }

    async function getCurrentUser() {
        const sb = getSupabase();
        if (!sb || !sb.auth) return null;
        try {
            const { data } = await sb.auth.getUser();
            return data?.user || null;
        } catch (_err) {
            return null;
        }
    }

    function getDeletedBuiltinIds() {
        try {
            return JSON.parse(localStorage.getItem(DELETED_BUILTINS_KEY) || '[]');
        } catch (_e) {
            return [];
        }
    }

    function addDeletedBuiltinId(id) {
        const list = getDeletedBuiltinIds();
        if (!list.includes(id)) {
            list.push(id);
            localStorage.setItem(DELETED_BUILTINS_KEY, JSON.stringify(list));
        }
    }

    async function restoreDeletedBuiltinMindmaps() {
        localStorage.removeItem(DELETED_BUILTINS_KEY);
        await loadMindmapsAndProgress();
        if (state.mindmaps.length > 0) {
            selectMindmap(state.mindmaps[0].id);
        } else {
            renderModule();
        }
    }

    async function saveNodeToLearningDepot(node, customPrefix = '') {
        if (!node || !state.currentMap) return;
        const parentLabel = getParentLabel(node, true);
        const catLabel = CATEGORIES[node.category]?.label || node.category;
        const cueContext = `${catLabel}: ${parentLabel} ➔ ${node.relation_label || 'Kausalbeziehung'}`;
        const masterySummary = node.mastery_question?.rationale ? ` | Prüfungs-Pearl: ${node.mastery_question.rationale}` : '';
        const textToSave = `${customPrefix ? customPrefix + ' ' : ''}${parentLabel} führt über „${node.relation_label || 'Verbindung'}“ zu: ${node.label}. — ${node.explanation || node.socratic_hint || ''}${masterySummary}`.trim();

        const entryPayload = {
            case_id: state.currentMap.id,
            case_title: `Mindmap: ${state.currentMap.title || state.currentMap.central_concept}`,
            category: state.currentMap.specialty || 'Mindmap-Labor',
            cue_context: cueContext,
            highlighted_text: textToSave
        };

        if (typeof window.createDepotEntry === 'function') {
            await window.createDepotEntry(entryPayload);
        } else {
            try {
                const items = JSON.parse(localStorage.getItem(DEPOT_STORAGE_KEY) || '[]');
                const exists = items.some(i => i.highlighted_text === entryPayload.highlighted_text);
                if (!exists) {
                    items.unshift({
                        id: 'dep_mm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                        ...entryPayload,
                        user_note: '',
                        mastered: false,
                        created_at: new Date().toISOString()
                    });
                    localStorage.setItem(DEPOT_STORAGE_KEY, JSON.stringify(items));
                }
            } catch (_e) {}
        }

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
    }

    async function loadMindmapsAndProgress() {
        const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
        const localProgress = JSON.parse(localStorage.getItem('medcheck_mindmap_progress') || '{}');
        const deletedBuiltins = getDeletedBuiltinIds();
        state.progressCache = localProgress;

        const mapById = new Map();
        BUILTIN_MINDMAPS.forEach(m => {
            if (!deletedBuiltins.includes(m.id)) {
                mapById.set(m.id, JSON.parse(JSON.stringify(m)));
            }
        });

        localSaved.forEach(m => {
            // Falls ein Builtin lokal überschrieben wurde, behalte trotzdem die neuen V6.0 mastery_questions bei
            const builtinMatch = BUILTIN_MINDMAPS.find(b => b.id === m.id);
            if (builtinMatch && Array.isArray(m.nodes)) {
                m.nodes.forEach(n => {
                    const bn = builtinMatch.nodes.find(x => x.id === n.id);
                    if (bn && bn.mastery_question && !n.mastery_question) {
                        n.mastery_question = bn.mastery_question;
                    }
                });
                if (!m.distractors && builtinMatch.distractors) {
                    m.distractors = builtinMatch.distractors;
                }
            }
            mapById.set(m.id, m);
        });

        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
                const { data: dbMaps, error: mapErr } = await sb
                    .from('mindmaps')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!mapErr && Array.isArray(dbMaps)) {
                    dbMaps.forEach(row => {
                        if (deletedBuiltins.includes(row.id)) return;
                        const parsed = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
                        const builtinMatch = BUILTIN_MINDMAPS.find(b => b.id === row.id);
                        const nodes = parsed?.nodes || [];
                        if (builtinMatch) {
                            nodes.forEach(n => {
                                const bn = builtinMatch.nodes.find(x => x.id === n.id);
                                if (bn && bn.mastery_question && !n.mastery_question) {
                                    n.mastery_question = bn.mastery_question;
                                }
                            });
                        }
                        mapById.set(row.id, {
                            id: row.id,
                            title: row.title,
                            specialty: row.specialty,
                            central_concept: row.central_concept,
                            nodes,
                            distractors: parsed?.distractors || builtinMatch?.distractors || []
                        });
                    });
                }

                const { data: dbProg, error: progErr } = await sb
                    .from('mindmap_progress')
                    .select('*')
                    .eq('user_id', user.id);

                if (!progErr && Array.isArray(dbProg)) {
                    dbProg.forEach(row => {
                        state.progressCache[row.mindmap_id] = {
                            completed: row.completed,
                            accuracy: Number(row.accuracy),
                            mistakes_count: row.mistakes_count,
                            best_time_sec: row.best_time_sec,
                            weak_nodes: row.weak_nodes_json || []
                        };
                    });
                    localStorage.setItem('medcheck_mindmap_progress', JSON.stringify(state.progressCache));
                }
            } catch (e) {
                console.warn('[Mindmap] Supabase-Sync im Offline-Fallback:', e);
            }
        }

        state.mindmaps = Array.from(mapById.values());
    }

    async function saveCustomMindmapToDb(mindmapObj) {
        const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
        const filtered = localSaved.filter(m => m.id !== mindmapObj.id);
        filtered.unshift(mindmapObj);
        localStorage.setItem('medcheck_custom_mindmaps', JSON.stringify(filtered));

        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
                await sb.from('mindmaps').upsert({
                    id: mindmapObj.id,
                    user_id: user.id,
                    title: mindmapObj.title,
                    specialty: mindmapObj.specialty || 'Vorlesung',
                    central_concept: mindmapObj.central_concept,
                    data_json: {
                        nodes: mindmapObj.nodes,
                        distractors: mindmapObj.distractors || []
                    },
                    updated_at: new Date().toISOString()
                });
            } catch (err) {
                console.warn('[Mindmap] Lokal gesichert:', err);
            }
        }
    }

    async function deleteCurrentMindmap() {
        if (!state.currentMap) return;

        const targetId = state.currentMap.id;
        const targetTitle = state.currentMap.title || state.currentMap.central_concept || targetId;
        const isBuiltin = BUILTIN_MINDMAPS.some(b => b.id === targetId);

        const confirmMsg = isBuiltin
            ? `Möchtest du die Standard-Mindmap „${targetTitle}“ aus deiner Liste entfernen?\n\n(Du kannst Standard-Mindmaps später jederzeit wiederherstellen.)`
            : `Möchtest du die Mindmap „${targetTitle}“ inklusive deines Lernfortschritts wirklich unwiderruflich löschen?`;

        if (!window.confirm(confirmMsg)) return;

        if (isBuiltin) {
            addDeletedBuiltinId(targetId);
        }

        try {
            const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
            const updatedLocal = localSaved.filter(m => m.id !== targetId);
            localStorage.setItem('medcheck_custom_mindmaps', JSON.stringify(updatedLocal));
        } catch (_e) {}

        delete state.progressCache[targetId];
        try {
            localStorage.setItem('medcheck_mindmap_progress', JSON.stringify(state.progressCache));
        } catch (_e) {}

        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
                await sb.from('mindmap_progress').delete().eq('mindmap_id', targetId).eq('user_id', user.id);
                await sb.from('mindmaps').delete().eq('id', targetId);
            } catch (err) {
                console.warn('[Mindmap] Fehler beim Cloud-Delete (lokal bereits gelöscht):', err);
            }
        }

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(14);

        await loadMindmapsAndProgress();
        if (state.mindmaps.length > 0) {
            selectMindmap(state.mindmaps[0].id);
        } else {
            state.currentMap = null;
            state.solvedNodeIds = new Set();
            renderModule();
        }
    }

    async function saveProgressToDb() {
        if (!state.currentMap) return;
        const totalNodes = state.currentMap.nodes.length;
        const totalAttempts = totalNodes + state.mistakesCount;
        const accuracy = totalAttempts > 0 ? Math.round((totalNodes / totalAttempts) * 100) : 100;
        const elapsedSec = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;

        const prev = state.progressCache[state.currentMap.id] || {};
        const bestTime = prev.best_time_sec ? Math.min(prev.best_time_sec, elapsedSec) : elapsedSec;

        const record = {
            completed: true,
            accuracy,
            mistakes_count: state.mistakesCount,
            best_time_sec: bestTime,
            weak_nodes: Array.from(state.weakNodeIds),
            last_played_at: new Date().toISOString()
        };

        state.progressCache[state.currentMap.id] = record;
        localStorage.setItem('medcheck_mindmap_progress', JSON.stringify(state.progressCache));

        const xpBonus = state.difficultyPreset === 'exam' ? 450 : (state.difficultyPreset === 'clinical' ? 350 : 250);
        if (typeof window.applyXpDelta === 'function') {
            window.applyXpDelta(xpBonus, `Mindmap gemeistert (${accuracy}%)`);
        }

        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
                await saveCustomMindmapToDb(state.currentMap);
                await sb.from('mindmap_progress').upsert({
                    user_id: user.id,
                    mindmap_id: state.currentMap.id,
                    completed: true,
                    accuracy,
                    mistakes_count: state.mistakesCount,
                    best_time_sec: bestTime,
                    weak_nodes_json: Array.from(state.weakNodeIds),
                    last_played_at: new Date().toISOString()
                }, { onConflict: 'user_id,mindmap_id' });
            } catch (err) {
                console.warn('[Mindmap] Fortschritt lokal gespeichert:', err);
            }
        }
    }

    // ========================================================================
    // 3. DISTRAKTOR-GENERATOR & SCHWIERIGKEITS-PRESETS
    // ========================================================================

    function getActiveDistractors(mindmap) {
        if (!mindmap || !state.includeDistractors) return [];

        if (Array.isArray(mindmap.distractors) && mindmap.distractors.length > 0) {
            return mindmap.distractors.map((d, idx) => ({
                id: d.id || `dist_${idx}`,
                label: d.label,
                category: d.category || 'pathophysiology',
                is_distractor: true,
                distractor_reason: d.distractor_reason || 'Dieser Befund ist ein klinischer Distraktor (gehört zu einer Differenzialdiagnose oder ist hier kontraindiziert).'
            }));
        }

        const otherMaps = state.mindmaps.filter(m => m.id !== mindmap.id);
        const candidates = [];
        otherMaps.forEach(other => {
            (other.nodes || []).forEach(n => {
                candidates.push({
                    id: `auto_dist_${other.id}_${n.id}`,
                    label: n.label,
                    category: n.category,
                    is_distractor: true,
                    distractor_reason: `Differenzialdiagnose-Falle: „${n.label}“ gehört pathophysiologisch/klinisch zu „${other.central_concept}“ (${other.specialty}) und nicht zu „${mindmap.central_concept}“!`
                });
            });
        });

        return candidates.slice(0, 3);
    }

    function applyDifficultyPreset(presetName) {
        state.difficultyPreset = presetName;
        if (presetName === 'guided') {
            state.blindMode = false;
            state.strictCausalOrder = true;
            state.deepComprehensionMode = false;
            state.activeRecallFirstMode = false;
            state.includeDistractors = false;
            state.blindRootMode = false;
        } else if (presetName === 'clinical') {
            state.blindMode = false;
            state.strictCausalOrder = true;
            state.deepComprehensionMode = true;
            state.activeRecallFirstMode = false;
            state.includeDistractors = true;
            state.blindRootMode = false;
        } else if (presetName === 'exam') {
            state.blindMode = true;
            state.strictCausalOrder = true;
            state.deepComprehensionMode = true;
            state.activeRecallFirstMode = true;
            state.includeDistractors = true;
            state.blindRootMode = true;
            state.rootRevealed = false;
        }

        rebuildPoolOrder();
        renderModule();
        requestAnimationFrame(() => {
            applyStageTransform();
            drawSvgConnections();
        });
    }

    function rebuildPoolOrder() {
        if (!state.currentMap) {
            state.poolOrderIds = [];
            return;
        }
        const realIds = state.currentMap.nodes.map(n => n.id);
        const distIds = getActiveDistractors(state.currentMap).map(d => d.id);
        state.poolOrderIds = shuffleArray([...realIds, ...distIds]);
    }

    // ========================================================================
    // 4. WEIT AUSGEDEHNTER 2-RING-ALGORITHMUS (2400 x 1600 XXL-STAGE)
    // ========================================================================

    function computeRadialLayout(mindmap) {
        const centerX = STAGE_WIDTH / 2;
        const centerY = STAGE_HEIGHT / 2;

        const positions = {
            root: { x: centerX, y: centerY, angle: 0, level: 0 }
        };

        const nodes = mindmap.nodes || [];
        const firstOrder = nodes.filter(n => !n.parent_id || n.parent_id === 'root');
        const secondOrder = nodes.filter(n => n.parent_id && n.parent_id !== 'root');

        const childrenByParent = {};
        secondOrder.forEach(n => {
            if (!childrenByParent[n.parent_id]) childrenByParent[n.parent_id] = [];
            childrenByParent[n.parent_id].push(n);
        });

        const count1 = firstOrder.length || 1;
        const radius1X = 500;
        const radius1Y = 350;

        firstOrder.forEach((node, idx) => {
            const angle = (-Math.PI / 2) + (idx * 2 * Math.PI) / count1;
            positions[node.id] = {
                x: centerX + radius1X * Math.cos(angle),
                y: centerY + radius1Y * Math.sin(angle),
                angle,
                level: 1
            };
        });

        const radius2X = 940;
        const radius2Y = 640;

        Object.keys(childrenByParent).forEach(parentId => {
            const parentPos = positions[parentId] || { x: centerX, y: centerY, angle: 0 };
            const children = childrenByParent[parentId];
            const spread = Math.min(Math.PI / 2.2, children.length * 0.42);

            children.forEach((child, i) => {
                let offset = 0;
                if (children.length > 1) {
                    offset = -spread / 2 + (i * spread) / (children.length - 1);
                }
                const childAngle = (parentPos.angle || 0) + offset;
                positions[child.id] = {
                    x: Math.max(180, Math.min(STAGE_WIDTH - 180, centerX + radius2X * Math.cos(childAngle))),
                    y: Math.max(110, Math.min(STAGE_HEIGHT - 110, centerY + radius2Y * Math.sin(childAngle))),
                    angle: childAngle,
                    level: 2
                };
            });
        });

        const nodeIds = Object.keys(positions).filter(id => id !== 'root');
        for (let iter = 0; iter < 24; iter++) {
            for (let i = 0; i < nodeIds.length; i++) {
                for (let j = i + 1; j < nodeIds.length; j++) {
                    const a = positions[nodeIds[i]];
                    const b = positions[nodeIds[j]];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const minDx = 330;
                    const minDy = 165;

                    if (Math.abs(dx) < minDx && Math.abs(dy) < minDy) {
                        const pushX = ((minDx - Math.abs(dx)) / 2) * (dx >= 0 ? 1 : -1);
                        const pushY = ((minDy - Math.abs(dy)) / 2) * (dy >= 0 ? 1 : -1);

                        if (Math.abs(dx) < minDx * 0.65) {
                            a.y = Math.max(105, Math.min(STAGE_HEIGHT - 105, a.y - pushY * 0.75));
                            b.y = Math.max(105, Math.min(STAGE_HEIGHT - 105, b.y + pushY * 0.75));
                        } else {
                            a.x = Math.max(175, Math.min(STAGE_WIDTH - 175, a.x - pushX * 0.65));
                            b.x = Math.max(175, Math.min(STAGE_WIDTH - 175, b.x + pushX * 0.65));
                        }
                    }
                }
            }
        }

        state.nodePositions = positions;
    }

    // ========================================================================
    // 5. INTELLIGENTES BOUNDING-BOX AUTO-FIT & PAN/ZOOM
    // ========================================================================

    function fitStageToViewport() {
        const viewport = document.getElementById('mm-canvas-viewport');
        if (!viewport) return;

        const vw = viewport.clientWidth || 960;
        const vh = viewport.clientHeight || 740;

        const pts = Object.values(state.nodePositions);
        if (pts.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
            if (p.x - 180 < minX) minX = p.x - 180;
            if (p.x + 180 > maxX) maxX = p.x + 180;
            if (p.y - 110 < minY) minY = p.y - 110;
            if (p.y + 110 > maxY) maxY = p.y + 110;
        });

        const contentW = Math.max(800, maxX - minX);
        const contentH = Math.max(600, maxY - minY);
        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;

        const scaleX = (vw - 60) / contentW;
        const scaleY = (vh - 80) / contentH;
        const bestScale = Math.max(0.48, Math.min(1.05, Math.min(scaleX, scaleY)));

        state.zoom = Number(bestScale.toFixed(2));
        state.panX = Math.round(vw / 2 - contentCenterX * state.zoom);
        state.panY = Math.round(vh / 2 - contentCenterY * state.zoom);

        applyStageTransform();
    }

    function applyStageTransform() {
        const stage = document.getElementById('mm-stage');
        const zoomLabel = document.getElementById('mm-zoom-label');
        if (stage) {
            stage.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
        }
        if (zoomLabel) {
            zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
        }
    }

    function adjustZoom(delta) {
        const viewport = document.getElementById('mm-canvas-viewport');
        if (!viewport) return;

        const oldZoom = state.zoom;
        const newZoom = Math.max(0.38, Math.min(1.6, Number((oldZoom + delta).toFixed(2))));
        if (newZoom === oldZoom) return;

        const cx = viewport.clientWidth / 2;
        const cy = viewport.clientHeight / 2;
        state.panX = Math.round(cx - ((cx - state.panX) / oldZoom) * newZoom);
        state.panY = Math.round(cy - ((cy - state.panY) / oldZoom) * newZoom);
        state.zoom = newZoom;

        applyStageTransform();
    }

    // ========================================================================
    // 6. RENDERING & ANTI-SPOILER KAUSAL-LOGIK
    // ========================================================================

    function selectMindmap(mindmapId) {
        const found = state.mindmaps.find(m => m.id === mindmapId) || state.mindmaps[0];
        if (!found) {
            state.currentMap = null;
            renderModule();
            return;
        }

        state.currentMap = found;
        state.solvedNodeIds = new Set();
        state.eliminatedDistractorIds = new Set();
        state.selectedChipId = null;
        state.mistakesCount = 0;
        state.streakCount = 0;
        state.weakNodeIds = new Set();
        state.rootRevealed = false;
        state.startTime = Date.now();

        rebuildPoolOrder();
        computeRadialLayout(found);
        renderModule();
        requestAnimationFrame(() => {
            fitStageToViewport();
            drawSvgConnections();
        });
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

    function getRootDisplayTitle(forceReveal = false) {
        if (!state.currentMap) return '';
        if (!state.blindRootMode || state.rootRevealed || forceReveal || state.solvedNodeIds.size === state.currentMap.nodes.length) {
            return state.currentMap.central_concept;
        }
        return '🕵️ [Zentraldiagnose deduzieren]';
    }

    function getParentLabel(node, forceReveal = false) {
        if (!node.parent_id || node.parent_id === 'root') {
            return getRootDisplayTitle(forceReveal);
        }
        const parent = state.currentMap.nodes.find(n => n.id === node.parent_id);
        return parent ? parent.label : getRootDisplayTitle(forceReveal);
    }

    function isParentSolvedOrRoot(node) {
        if (!node.parent_id || node.parent_id === 'root') return true;
        return state.solvedNodeIds.has(node.parent_id);
    }

    function isSlotCurrentlyLocked(node) {
        if (!state.strictCausalOrder) return false;
        return !isParentSolvedOrRoot(node);
    }

    function getPoolItemsForCurrentState() {
        if (!state.currentMap) return [];
        const allPoolMap = new Map();

        state.currentMap.nodes.forEach(n => {
            if (!state.solvedNodeIds.has(n.id)) {
                allPoolMap.set(n.id, { ...n, is_distractor: false });
            }
        });

        getActiveDistractors(state.currentMap).forEach(d => {
            allPoolMap.set(d.id, d);
        });

        if (!state.poolOrderIds || state.poolOrderIds.length === 0) {
            rebuildPoolOrder();
        }

        const ordered = [];
        state.poolOrderIds.forEach(id => {
            if (allPoolMap.has(id)) {
                ordered.push(allPoolMap.get(id));
                allPoolMap.delete(id);
            }
        });
        allPoolMap.forEach(val => ordered.push(val));
        return ordered;
    }

    function renderModule() {
        const container = ensureDomStructure();
        const deletedBuiltins = getDeletedBuiltinIds();

        if (!state.currentMap) {
            container.innerHTML = `
                <div class="mindmap-wrapper">
                    <div class="mm-header">
                        <div class="mm-title-group">
                            <h2>🕸️ Klinisches Mindmap-Labor V6.0</h2>
                            <p>Aktuell sind keine Mindmaps in deiner Bibliothek vorhanden.</p>
                        </div>
                        <div class="mm-controls">
                            ${deletedBuiltins.length > 0 ? `
                                <button id="mm-btn-restore-builtins" class="mm-btn">♻️ Standard-Mindmaps wiederherstellen</button>
                            ` : ''}
                            <button id="mm-btn-prompt" class="mm-btn">📋 Deep-Prompt</button>
                            <button id="mm-btn-import" class="mm-btn mm-btn-primary">📥 JSON Importieren</button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('mm-btn-restore-builtins')?.addEventListener('click', restoreDeletedBuiltinMindmaps);
            document.getElementById('mm-btn-prompt')?.addEventListener('click', copyExtractionPrompt);
            document.getElementById('mm-btn-import')?.addEventListener('click', openImportModal);
            return;
        }

        const map = state.currentMap;
        const totalNodes = map.nodes.length;
        const solvedCount = state.solvedNodeIds.size;
        const savedProg = state.progressCache[map.id];
        const poolItems = getPoolItemsForCurrentState();
        const activeDistractorsCount = getActiveDistractors(map).length;
        const allRealSolved = solvedCount === totalNodes;

        container.innerHTML = `
            <div class="mindmap-wrapper">
                <!-- TOP HEADER -->
                <div class="mm-header">
                    <div class="mm-title-group">
                        <h2>🕸️ Klinisches Mindmap-Labor <span style="font-size:0.75rem; padding:3px 8px; border-radius:6px; background:rgba(56,189,248,0.16); color:#38bdf8; vertical-align:middle;">V6.0 Deep Mastery Gate</span></h2>
                        <p>
                            <strong>Zweistufiges Clinical Reasoning:</strong> 1. Baustein kausal richtig platzieren ➔ 2. Im anschließenden <strong>Tiefen-Verhör</strong> das exakte pathophysiologische & klinische Verständnis unter Beweis stellen!
                        </p>
                    </div>
                    <div class="mm-controls">
                        <select id="mm-map-selector" class="mm-select" title="Mindmap auswählen">
                            ${state.mindmaps.map(m => {
                                const prog = state.progressCache[m.id];
                                const badge = prog?.completed ? `✅ (${prog.accuracy}%)` : '⭕';
                                return `<option value="${escapeHtml(m.id)}" ${m.id === map.id ? 'selected' : ''}>
                                    ${badge} [${escapeHtml(m.specialty)}] ${escapeHtml(m.title)}
                                </option>`;
                            }).join('')}
                        </select>

                        <button id="mm-btn-delete" class="mm-btn" style="border-color: rgba(239, 68, 68, 0.45); color: #fca5a5 !important;" title="Aktuelle Mindmap löschen">
                            🗑️ Löschen
                        </button>

                        ${deletedBuiltins.length > 0 ? `
                            <button id="mm-btn-restore-builtins" class="mm-btn" title="Ausgeblendete Standard-Mindmaps wiederherstellen">
                                ♻️ Standards
                            </button>
                        ` : ''}

                        <button id="mm-btn-inspector" class="mm-btn ${state.showInspector ? 'active' : ''}" title="Zeigt die Kausalstruktur als Baum">
                            🧭 Baum-Logik
                        </button>

                        <button id="mm-toggle-expand" class="mm-btn ${state.expandedCanvas ? 'active' : ''}" title="Mindmap auf volle Breite ausdehnen">
                            ${state.expandedCanvas ? '📐 Standard' : '🔭 Großansicht'}
                        </button>

                        <button id="mm-btn-reset" class="mm-btn" title="Mindmap zurücksetzen & neu mischen">
                            🔄 Reset
                        </button>

                        <button id="mm-btn-prompt" class="mm-btn" title="Deep-Prompt (inkl. Tiefenverständnis-Fragen & Distraktoren) kopieren">
                            📋 Deep-Prompt
                        </button>

                        <button id="mm-btn-import" class="mm-btn mm-btn-primary">
                            📥 JSON Import
                        </button>
                    </div>
                </div>

                <!-- CLINICAL REASONING PRESET & CHALLENGE BAR -->
                <div class="mm-preset-bar">
                    <div class="mm-preset-group">
                        <span style="font-size:0.78rem; font-weight:800; color:#94a3b8; margin-right:4px;">🎓 Anspruch:</span>
                        <button type="button" class="mm-preset-btn ${state.difficultyPreset === 'guided' ? 'active' : ''}" data-preset="guided" title="Direktes Einrasten ohne Prüfungsfrage, Kategoriefarben sichtbar, keine Distraktoren">
                            🟢 Assistenzarzt (Guided)
                        </button>
                        <button type="button" class="mm-preset-btn ${state.difficultyPreset === 'clinical' ? 'active' : ''}" data-preset="clinical" title="Tiefenverständnis-Prüfung beim Platzieren + Klinische Distraktoren im Pool">
                            🟡 Facharzt (Deep Mastery)
                        </button>
                        <button type="button" class="mm-preset-btn ${state.difficultyPreset === 'exam' ? 'active' : ''}" data-preset="exam" title="Blind-Modus + Active-Recall-First (Freitext vor Optionen) + Tiefen-Verhör + Distraktoren + Diagnose-Deduktion">
                            🔴 Staatsexamen (IMPP-Mastery)
                        </button>
                    </div>

                    <div class="mm-preset-group">
                        <button id="mm-toggle-deep-gate" class="mm-btn ${state.deepComprehensionMode ? 'active' : ''}" title="Stellt beim Platzieren jedes Bausteins eine tiefgehende klinische Verständnisfrage zum Mechanismus, bevor der Knoten einrastet">
                            ${state.deepComprehensionMode ? '🔬 Tiefen-Verhör beim Platzieren: AN' : '⚡ Direktes Einrasten'}
                        </button>

                        ${state.deepComprehensionMode ? `
                            <button id="mm-toggle-recall-first" class="mm-btn ${state.activeRecallFirstMode ? 'active' : ''}" title="Erzwingt zuerst eine eigene gedankliche/Freitext-Antwort, bevor die 4 Antwortoptionen sichtbar werden (Testing Effect)">
                                ${state.activeRecallFirstMode ? '✍️ Active-Recall-First: AN' : '📋 MC-Optionen sofort'}
                            </button>
                        ` : ''}

                        <button id="mm-toggle-distractors" class="mm-btn ${state.includeDistractors ? 'active' : ''}" title="Mischt täuschend echte Differenzialdiagnose-Fallen in den Pool gegen das Ausschlussverfahren">
                            ${state.includeDistractors ? `🎭 Distraktoren: AN (${activeDistractorsCount})` : '🎭 Distraktoren: AUS'}
                        </button>

                        <button id="mm-toggle-blind" class="mm-btn mm-btn-blind ${state.blindMode ? 'active' : ''}" title="Verbirgt die Kategoriefarben vor dem Lösen">
                            ${state.blindMode ? '🕶️ Farben: Verdeckt' : '🎨 Farben: Sichtbar'}
                        </button>

                        <button id="mm-toggle-blind-root" class="mm-btn ${state.blindRootMode ? 'active' : ''}" title="Verbirgt das zentrale Krankheitsbild – deduziere die Diagnose aus den Ästen!">
                            ${state.blindRootMode ? '🕵️ Diagnose-Deduktion: AN' : '🎯 Diagnose sichtbar'}
                        </button>
                    </div>
                </div>

                <!-- LEGENDE & FORTSCHRITT -->
                <div class="mm-statusbar">
                    <div class="mm-legend">
                        ${Object.entries(CATEGORIES).map(([_key, cfg]) => `
                            <span class="mm-legend-item">
                                <span class="mm-dot" style="background:${cfg.color}"></span>
                                <span>${cfg.icon} ${escapeHtml(cfg.label)}</span>
                            </span>
                        `).join('')}
                    </div>
                    <div class="mm-stats">
                        <span class="mm-stat-badge" id="mm-stat-progress">🧩 Verifiziert: ${solvedCount} / ${totalNodes}</span>
                        <span class="mm-stat-badge" id="mm-stat-streak">🔥 Serie: ${state.streakCount}</span>
                        <span class="mm-stat-badge" id="mm-stat-mistakes">⚠️ Fehler: ${state.mistakesCount}</span>
                        ${savedProg?.best_time_sec ? `<span class="mm-stat-badge">⏱️ Bestzeit: ${savedProg.best_time_sec}s</span>` : ''}
                    </div>
                </div>

                <!-- OPTIONALER KAUSALKETTEN-INSPEKTOR -->
                ${state.showInspector ? renderInspectorPanel(map) : ''}

                <!-- WORKSPACE -->
                <div class="mm-workspace ${state.expandedCanvas ? 'mm-workspace-expanded' : ''}">
                    <!-- LINKE SPALTE: BEGRIFFS-POOL & SOKRATISCHER TUTOR -->
                    <div class="mm-sidebar-panel">
                        <div class="mm-pool-box">
                            <div class="mm-box-header">
                                <span class="mm-box-title">📦 Klinischer Pool (${ allRealSolved ? 0 : poolItems.length })</span>
                                <span class="mm-box-sub">${state.includeDistractors ? `inkl. ${activeDistractorsCount} DD-Fallen` : 'Ohne Ebenen-Spoiler'}</span>
                            </div>
                            <div id="mm-chip-pool" class="mm-chip-list">
                                ${allRealSolved ? `
                                    <div class="mm-all-solved-banner">
                                        🎉 Alle ${totalNodes} Kausalknoten & Tiefen-Prüfungen gemeistert!
                                        ${state.weakNodeIds.size > 0 ? `
                                            <div style="margin-top:8px;">
                                                <button type="button" id="mm-btn-save-weak-depot" class="mm-depot-pin-btn">
                                                    📌 Alle ${state.weakNodeIds.size} Wackelkandidaten ins Lern-Depot sichern
                                                </button>
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : poolItems.map(item => {
                                    const catCfg = CATEGORIES[item.category];
                                    const catClass = state.blindMode ? 'cat-blind' : (catCfg?.cssClass || 'cat-blind');
                                    const isSelected = state.selectedChipId === item.id ? 'selected-chip' : '';
                                    const isEliminated = state.eliminatedDistractorIds.has(item.id) ? 'distractor-eliminated' : '';

                                    let subBadgeText = 'Klinisches Konzept (Ebene selbst prüfen)';
                                    if (!state.blindMode && catCfg) {
                                        subBadgeText = state.difficultyPreset === 'guided' && !item.is_distractor
                                            ? `${catCfg.label} • ${(!item.parent_id || item.parent_id === 'root') ? '1. Ebene' : '2. Ebene'}`
                                            : `${catCfg.icon} ${catCfg.label}`;
                                    } else if (isEliminated) {
                                        subBadgeText = '🚫 Enttarnte DD-Falle (Distraktor)';
                                    }

                                    return `
                                        <div class="mm-chip ${catClass} ${isSelected} ${isEliminated}"
                                             data-node-id="${escapeHtml(item.id)}"
                                             draggable="false"
                                             title="Ziehe diesen Baustein auf den passenden Slot – anschließend startet die klinische Tiefenprüfung!">
                                            <span class="mm-chip-cat-tag">${escapeHtml(subBadgeText)}</span>
                                            <span class="mm-chip-label">${escapeHtml(item.label)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- SOKRATISCHES AI-FEEDBACK PANEL -->
                        <div class="mm-tutor-box">
                            <div class="mm-box-header">
                                <span class="mm-box-title">🏛️ Sokratischer KI-Tutor</span>
                                <span class="mm-tutor-bloom">Bloom: Analyse & Evaluation</span>
                            </div>
                            <div id="mm-tutor-message" class="mm-tutor-content">
                                Klicke auf einen Ziel-Knoten für eine <strong>sokratische Leitfrage</strong> oder ziehe einen Baustein darauf.${state.deepComprehensionMode ? '<br><span style="color:#38bdf8; font-size:0.78rem;">🔬 <strong>Deep Mastery Gate aktiv:</strong> Beim Platzieren eines Blocks musst du eine tiefgehende klinische Verständnisfrage beantworten, bevor der Knoten einrastet!</span>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- RECHTE SPALTE: INTERAKTIVES XXL PAN & ZOOM MINDMAP-CANVAS -->
                    <div id="mm-canvas-viewport" class="mm-canvas-container">
                        <div class="mm-canvas-HUD">
                            <button type="button" class="mm-hud-btn" id="mm-zoom-out" title="Herauszoomen">➖</button>
                            <span id="mm-zoom-label" class="mm-hud-zoom-text">65%</span>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-in" title="Hineinzoomen">➕</button>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-100" title="100% Originalgröße">100%</button>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-fit" title="Gesamte Mindmap einpassen">🎯 Alles zeigen</button>
                        </div>

                        <div class="mm-canvas-help-pill">
                            🖱️ Hintergrund ziehen zum Verschieben • Mausrad zum Zoomen • Gelöste Knoten anklicken zum erneuten Prüfen
                        </div>

                        <!-- TRANSFORMABLE XXL STAGE (2400 x 1600) -->
                        <div id="mm-stage" class="mm-stage" style="width:${STAGE_WIDTH}px; height:${STAGE_HEIGHT}px;">
                            <svg id="mm-svg" class="mm-svg-layer" viewBox="0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}"></svg>
                            <div id="mm-edge-labels-layer" class="mm-edge-labels-layer"></div>
                            <div id="mm-nodes" class="mm-nodes-layer">
                                <!-- ZENTRALER WURZEL-KNOTEN -->
                                <div class="mm-node mm-node-root"
                                     id="mm-node-dom-root"
                                     style="left: ${STAGE_WIDTH / 2}px; top: ${STAGE_HEIGHT / 2}px;"
                                     data-node-pos="root">
                                    <span class="mm-root-badge">🎯 ZENTRALKONZEPT • ${escapeHtml(map.specialty)}</span>
                                    <span class="mm-root-title">${escapeHtml(getRootDisplayTitle())}</span>
                                    ${state.blindRootMode && !state.rootRevealed && !allRealSolved ? `
                                        <div class="mm-root-deduce-box" onclick="event.stopPropagation();">
                                            <input type="text" id="mm-root-guess-input" class="mm-root-deduce-input" placeholder="Diagnose tippen..." />
                                            <button type="button" id="mm-root-guess-btn" class="mm-root-deduce-btn">Prüfen</button>
                                        </div>
                                    ` : ''}
                                </div>

                                <!-- ZIEL-SLOTS / GELÖSTE KNOTEN -->
                                ${map.nodes.map(node => renderCanvasNode(node)).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderInspectorPanel(map) {
        const firstOrder = map.nodes.filter(n => !n.parent_id || n.parent_id === 'root');
        const secondOrder = map.nodes.filter(n => n.parent_id && n.parent_id !== 'root');

        return `
            <div class="mm-inspector-panel">
                <div class="mm-inspector-header">
                    <strong>🧭 Logische Kausalstruktur (${escapeHtml(getRootDisplayTitle())})</strong>
                    <span>Klicke auf einen offenen Schritt, um dir die sokratische Leitfrage im Tutor anzeigen zu lassen!</span>
                </div>
                <div class="mm-inspector-grid">
                    ${firstOrder.map(parent => {
                        const pSolved = state.solvedNodeIds.has(parent.id);
                        const pCat = state.blindMode && !pSolved ? 'Unbekannte Kategorie' : (CATEGORIES[parent.category]?.label || parent.category);
                        const pRel = parent.relation_label || 'Verbindung';
                        const children = secondOrder.filter(c => c.parent_id === parent.id);

                        return `
                            <div class="mm-inspector-branch">
                                <div class="mm-inspector-step ${pSolved ? 'is-solved' : ''}" data-ins-slot="${escapeHtml(parent.id)}" style="cursor:pointer;">
                                    <span class="mm-ins-rel">1️⃣ Zentrum ➔ <strong>${escapeHtml(pRel)}</strong>:</span>
                                    <strong class="mm-ins-target">
                                        ${pSolved ? `✅ ${escapeHtml(parent.label)}` : `❓ [${escapeHtml(pCat)} – klicken für Leitfrage]`}
                                    </strong>
                                </div>
                                ${children.map(child => {
                                    const cSolved = state.solvedNodeIds.has(child.id);
                                    const cCat = state.blindMode && !cSolved ? 'Folgekonzept' : (CATEGORIES[child.category]?.label || child.category);
                                    const cRel = child.relation_label || 'führt zu';
                                    return `
                                        <div class="mm-inspector-substep ${cSolved ? 'is-solved' : ''}" data-ins-slot="${escapeHtml(child.id)}" style="cursor:pointer;">
                                            <span class="mm-ins-rel">↳ 2️⃣ Folgeschritt: <strong>${escapeHtml(cRel)}</strong>:</span>
                                            <strong class="mm-ins-target">
                                                ${cSolved ? `✅ ${escapeHtml(child.label)}` : (pSolved ? `🔓 [${escapeHtml(cCat)} gesucht]` : `🔒 [Löse erst Hauptast 1]`)}
                                            </strong>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function renderCanvasNode(node) {
        const pos = state.nodePositions[node.id] || { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2, level: 1 };
        const isSolved = state.solvedNodeIds.has(node.id);
        const catCfg = CATEGORIES[node.category] || { label: 'Konzept', cssClass: 'cat-blind', icon: '🔹' };
        const isSecondOrder = node.parent_id && node.parent_id !== 'root';
        const isLocked = isSlotCurrentlyLocked(node);
        const relationText = node.relation_label || 'Verbindung';

        let originPrefix = `1. Ebene • Hauptast`;
        if (isSecondOrder) {
            originPrefix = !isLocked
                ? `2. Ebene • Aus „${getParentLabel(node)}“`
                : `🔒 2. Ebene • Gesperrte Folgekaskade`;
        }

        if (isSolved) {
            return `
                <div class="mm-node mm-node-solved ${catCfg.cssClass}"
                     id="mm-node-dom-${escapeHtml(node.id)}"
                     style="left: ${pos.x}px; top: ${pos.y}px;"
                     data-slot-id="${escapeHtml(node.id)}"
                     title="Klicken für klinische Erklärung, Lern-Depot-Pin oder erneute Tiefen-Prüfungsfrage">
                    <div class="mm-node-rel-banner">
                        <span class="mm-rel-origin">${escapeHtml(originPrefix)}</span>
                        <strong class="mm-rel-verb">➔ ${escapeHtml(relationText)}</strong>
                    </div>
                    <div class="mm-node-body-solved">
                        <span class="mm-solved-cat-pill">✅ ${catCfg.icon} ${escapeHtml(catCfg.label)}</span>
                        <div class="mm-solved-title">${escapeHtml(node.label)}</div>
                    </div>
                </div>
            `;
        }

        if (isLocked) {
            return `
                <div class="mm-node mm-node-slot cat-blind mm-node-locked"
                     id="mm-node-dom-${escapeHtml(node.id)}"
                     style="left: ${pos.x}px; top: ${pos.y}px; opacity: 0.58; filter: grayscale(0.4);"
                     data-slot-id="${escapeHtml(node.id)}"
                     title="Löse zuerst den inneren Hauptknoten (1. Ebene), um diesen Folgeschritt freizuschalten!">
                    <div class="mm-node-rel-banner">
                        <span class="mm-rel-origin">🔒 Folgeschritt (2. Ebene)</span>
                        <strong class="mm-rel-verb">➔ ${escapeHtml(relationText)}</strong>
                    </div>
                    <div class="mm-slot-inner">
                        <span class="mm-slot-hint">⏳ Kausal-Sperre aktiv</span>
                        <span class="mm-slot-cta">Löse zuerst die Ursache auf der 1. Ebene!</span>
                    </div>
                </div>
            `;
        }

        const slotCatClass = state.blindMode ? 'cat-blind' : catCfg.cssClass;
        const slotHintLabel = state.blindMode ? '❓ Offenes Konzept (Blind-Modus)' : `${catCfg.icon} ${catCfg.label}`;

        return `
            <div class="mm-node mm-node-slot ${slotCatClass} ${isSecondOrder ? 'mm-node-second-order' : ''}"
                 id="mm-node-dom-${escapeHtml(node.id)}"
                 style="left: ${pos.x}px; top: ${pos.y}px;"
                 data-slot-id="${escapeHtml(node.id)}"
                 title="Klicken für sokratische Leitfrage oder passenden Begriff hier ablegen">
                <div class="mm-node-rel-banner">
                    <span class="mm-rel-origin">${escapeHtml(originPrefix)}</span>
                    <strong class="mm-rel-verb">➔ ${escapeHtml(relationText)}</strong>
                </div>
                <div class="mm-slot-inner">
                    <span class="mm-slot-hint">${escapeHtml(slotHintLabel)}</span>
                    <span class="mm-slot-cta">${state.deepComprehensionMode ? '🔬 Ablegen ➔ Tiefen-Verhör' : '💡 Klicken oder Baustein ziehen'}</span>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // 7. BOX-EDGE-CLIPPING & AUTO-EXPANDIERENDE HTML-KANTEN-LABELS
    // ========================================================================

    function getBoxBorderPoint(cx, cy, halfW, halfH, tx, ty, extraPad = 6) {
        const dx = tx - cx;
        const dy = ty - cy;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return { x: cx, y: cy };

        const w = halfW + extraPad;
        const h = halfH + extraPad;

        const scaleX = Math.abs(dx) > 0.001 ? w / Math.abs(dx) : Infinity;
        const scaleY = Math.abs(dy) > 0.001 ? h / Math.abs(dy) : Infinity;
        const scale = Math.min(scaleX, scaleY);

        return {
            x: cx + dx * scale,
            y: cy + dy * scale
        };
    }

    function getNodeHalfDimensions(nodeId) {
        const domEl = document.getElementById(`mm-node-dom-${nodeId}`);
        if (domEl && domEl.offsetWidth > 0 && domEl.offsetHeight > 0) {
            return { halfW: domEl.offsetWidth / 2, halfH: domEl.offsetHeight / 2 };
        }
        if (nodeId === 'root') return { halfW: 145, halfH: 54 };
        return { halfW: 132, halfH: 58 };
    }

    function drawSvgConnections() {
        const svg = document.getElementById('mm-svg');
        const edgeLabelsLayer = document.getElementById('mm-edge-labels-layer');
        if (!svg || !state.currentMap) return;

        let defsHtml = `
            <defs>
                <marker id="mm-arrow-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
                ${Object.entries(CATEGORIES).map(([key, cfg]) => `
                    <marker id="mm-arrow-${key}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="${cfg.color}" />
                    </marker>
                `).join('')}
            </defs>
        `;

        let pathsHtml = '';
        let htmlBadges = '';

        state.currentMap.nodes.forEach(node => {
            const parentId = node.parent_id || 'root';
            const fromCenter = state.nodePositions[parentId] || { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 };
            const toCenter = state.nodePositions[node.id] || { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 };

            const fromDim = getNodeHalfDimensions(parentId);
            const toDim = getNodeHalfDimensions(node.id);

            const startPt = getBoxBorderPoint(fromCenter.x, fromCenter.y, fromDim.halfW, fromDim.halfH, toCenter.x, toCenter.y, 4);
            const endPt = getBoxBorderPoint(toCenter.x, toCenter.y, toDim.halfW, toDim.halfH, fromCenter.x, fromCenter.y, 10);

            const x1 = startPt.x;
            const y1 = startPt.y;
            const x2 = endPt.x;
            const y2 = endPt.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const cx1 = x1 + dx * 0.35;
            const cy1 = y1 + dy * 0.15;
            const cx2 = x1 + dx * 0.65;
            const cy2 = y1 + dy * 0.85;

            const isSolved = state.solvedNodeIds.has(node.id);
            const isLocked = isSlotCurrentlyLocked(node);
            const isHovered = state.hoveredNodeId === node.id || state.hoveredNodeId === parentId;
            const catCfg = CATEGORIES[node.category];
            const showColor = isSolved || (!state.blindMode && !isLocked);
            const strokeColor = showColor && catCfg ? catCfg.color : '#64748b';
            const markerId = showColor && catCfg ? `mm-arrow-${node.category}` : 'mm-arrow-default';

            pathsHtml += `
                <path class="mm-edge-path ${isSolved ? 'solved-edge' : ''} ${isHovered ? 'hovered-edge' : ''}"
                      d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}"
                      style="stroke: ${strokeColor}; opacity: ${isLocked ? '0.35' : '0.9'};"
                      marker-end="url(#${markerId})" />
            `;

            if (node.relation_label) {
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                htmlBadges += `
                    <div class="mm-edge-html-badge ${isHovered ? 'is-hovered' : ''}"
                         style="left:${midX.toFixed(1)}px; top:${midY.toFixed(1)}px; border-color:${strokeColor}; opacity:${isLocked ? '0.45' : '1'};">
                        ${escapeHtml(node.relation_label)}
                    </div>
                `;
            }
        });

        svg.innerHTML = defsHtml + pathsHtml;
        if (edgeLabelsLayer) {
            edgeLabelsLayer.innerHTML = htmlBadges;
        }
    }

    // ========================================================================
    // 8. EVENT-BINDING (PRESETS, DRAG & DROP, ROOT-DEDUKTION, ZOOM, PAN)
    // ========================================================================

    function bindEvents() {
        document.getElementById('mm-map-selector')?.addEventListener('change', e => selectMindmap(e.target.value));
        document.getElementById('mm-btn-delete')?.addEventListener('click', deleteCurrentMindmap);
        document.getElementById('mm-btn-restore-builtins')?.addEventListener('click', restoreDeletedBuiltinMindmaps);

        document.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                applyDifficultyPreset(preset);
            });
        });

        document.getElementById('mm-toggle-deep-gate')?.addEventListener('click', () => {
            state.deepComprehensionMode = !state.deepComprehensionMode;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-toggle-recall-first')?.addEventListener('click', () => {
            state.activeRecallFirstMode = !state.activeRecallFirstMode;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-toggle-distractors')?.addEventListener('click', () => {
            state.includeDistractors = !state.includeDistractors;
            rebuildPoolOrder();
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-toggle-blind')?.addEventListener('click', () => {
            state.blindMode = !state.blindMode;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-toggle-blind-root')?.addEventListener('click', () => {
            state.blindRootMode = !state.blindRootMode;
            state.rootRevealed = false;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-toggle-expand')?.addEventListener('click', () => {
            state.expandedCanvas = !state.expandedCanvas;
            renderModule();
            requestAnimationFrame(() => {
                fitStageToViewport();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-btn-inspector')?.addEventListener('click', () => {
            state.showInspector = !state.showInspector;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-btn-reset')?.addEventListener('click', () => {
            if (state.currentMap) selectMindmap(state.currentMap.id);
        });

        document.getElementById('mm-btn-prompt')?.addEventListener('click', copyExtractionPrompt);
        document.getElementById('mm-btn-import')?.addEventListener('click', openImportModal);

        document.getElementById('mm-btn-save-weak-depot')?.addEventListener('click', async e => {
            const btn = e.currentTarget;
            for (const weakId of state.weakNodeIds) {
                const n = state.currentMap?.nodes.find(item => item.id === weakId);
                if (n) await saveNodeToLearningDepot(n, '[Wiederholungs-Fokus]');
            }
            btn.textContent = '✅ Im Lern-Depot gespeichert!';
            btn.disabled = true;
        });

        // Root-Diagnose-Deduktion prüfen
        const rootGuessBtn = document.getElementById('mm-root-guess-btn');
        const rootGuessInput = document.getElementById('mm-root-guess-input');
        const verifyRootDeduction = () => {
            if (!rootGuessInput || !state.currentMap) return;
            const guess = rootGuessInput.value.trim().toLowerCase();
            if (guess.length < 3) return;
            const target = (state.currentMap.central_concept + ' ' + state.currentMap.title).toLowerCase();
            const tokens = guess.split(/[\s,()-]+/).filter(t => t.length >= 3);
            const matched = tokens.some(tok => target.includes(tok));

            const tutorEl = document.getElementById('mm-tutor-message');
            if (matched) {
                state.rootRevealed = true;
                if (typeof window.applyXpDelta === 'function') window.applyXpDelta(100, 'Zentraldiagnose deduziert');
                renderModule();
                requestAnimationFrame(() => {
                    applyStageTransform();
                    drawSvgConnections();
                });
                const newTutor = document.getElementById('mm-tutor-message');
                if (newTutor) {
                    newTutor.innerHTML = `<strong style="color:#10b981;">🎯 Starke diagnostische Deduktion (+100 XP)!</strong><br>Du hast das zentrale Krankheitsbild <strong>„${escapeHtml(state.currentMap.central_concept)}“</strong> korrekt aus den Kausalästen abgeleitet!`;
                }
            } else if (tutorEl) {
                tutorEl.innerHTML = `<strong style="color:#f59e0b;">🕵️ Noch nicht ganz:</strong> „${escapeHtml(rootGuessInput.value)}“ deckt sich noch nicht mit dem gesuchten Zentralkonzept. Nutze die sokratischen Leitfragen der Hauptäste!`;
            }
        };
        rootGuessBtn?.addEventListener('click', verifyRootDeduction);
        rootGuessInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') verifyRootDeduction();
        });

        document.querySelectorAll('[data-ins-slot]').forEach(el => {
            el.addEventListener('click', () => {
                const slotId = el.getAttribute('data-ins-slot');
                showSlotSocraticHint(slotId);
            });
        });

        // Zoom Controls
        document.getElementById('mm-zoom-in')?.addEventListener('click', () => adjustZoom(0.14));
        document.getElementById('mm-zoom-out')?.addEventListener('click', () => adjustZoom(-0.14));
        document.getElementById('mm-zoom-100')?.addEventListener('click', () => {
            const delta = 1.0 - state.zoom;
            adjustZoom(delta);
        });
        document.getElementById('mm-zoom-fit')?.addEventListener('click', () => fitStageToViewport());

        const viewport = document.getElementById('mm-canvas-viewport');
        if (viewport) {
            viewport.addEventListener('wheel', e => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                adjustZoom(delta);
            }, { passive: false });

            viewport.addEventListener('pointerdown', e => {
                if (e.target.closest('.mm-node') || e.target.closest('.mm-canvas-HUD')) return;
                e.preventDefault();
                clearBrowserTextSelection();

                state.isPanning = true;
                viewport.classList.add('is-panning');
                document.body.classList.add('mm-dragging-active');

                const startX = e.clientX - state.panX;
                const startY = e.clientY - state.panY;

                function onPanMove(moveEv) {
                    if (!state.isPanning) return;
                    moveEv.preventDefault();
                    state.panX = moveEv.clientX - startX;
                    state.panY = moveEv.clientY - startY;
                    applyStageTransform();
                }

                function onPanUp() {
                    state.isPanning = false;
                    viewport.classList.remove('is-panning');
                    document.body.classList.remove('mm-dragging-active');
                    window.removeEventListener('pointermove', onPanMove);
                    window.removeEventListener('pointerup', onPanUp);
                    window.removeEventListener('pointercancel', onPanUp);
                }

                window.addEventListener('pointermove', onPanMove, { passive: false });
                window.addEventListener('pointerup', onPanUp);
                window.addEventListener('pointercancel', onPanUp);
            });
        }

        document.querySelectorAll('.mm-chip').forEach(chip => {
            chip.addEventListener('dragstart', e => e.preventDefault());
            chip.addEventListener('selectstart', e => e.preventDefault());
            chip.addEventListener('pointerdown', onChipPointerDown);
        });

        document.querySelectorAll('.mm-node[data-slot-id]').forEach(nodeEl => {
            const slotId = nodeEl.getAttribute('data-slot-id');

            nodeEl.addEventListener('mouseenter', () => {
                state.hoveredNodeId = slotId;
                drawSvgConnections();
            });

            nodeEl.addEventListener('mouseleave', () => {
                state.hoveredNodeId = null;
                drawSvgConnections();
            });

            nodeEl.addEventListener('click', () => {
                if (nodeEl.classList.contains('mm-node-solved')) {
                    showSolvedNodeExplanation(slotId);
                } else if (state.selectedChipId) {
                    evaluateDropAttempt(state.selectedChipId, slotId, nodeEl);
                } else {
                    showSlotSocraticHint(slotId);
                }
            });
        });
    }

    function onChipPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();
        clearBrowserTextSelection();

        const chip = e.currentTarget;
        const nodeId = chip.getAttribute('data-node-id');
        if (state.eliminatedDistractorIds.has(nodeId)) return;

        const pointerId = e.pointerId;
        const startX = e.clientX;
        const startY = e.clientY;
        let isDragging = false;
        let ghostEl = null;

        document.body.classList.add('mm-dragging-active');
        try {
            if (chip.setPointerCapture) chip.setPointerCapture(pointerId);
        } catch (_err) {}

        function onPointerMove(moveEvent) {
            moveEvent.preventDefault();
            clearBrowserTextSelection();

            const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
            if (!isDragging && dist > 5) {
                isDragging = true;
                chip.classList.add('dragging');
                ghostEl = chip.cloneNode(true);
                ghostEl.classList.remove('dragging');
                ghostEl.classList.add('mm-drag-ghost');
                document.body.appendChild(ghostEl);
            }

            if (isDragging && ghostEl) {
                ghostEl.style.left = `${moveEvent.clientX}px`;
                ghostEl.style.top = `${moveEvent.clientY}px`;

                document.querySelectorAll('.mm-node-slot').forEach(s => s.classList.remove('drag-over'));
                const targetSlot = findSlotUnderPoint(moveEvent.clientX, moveEvent.clientY);
                if (targetSlot) targetSlot.classList.add('drag-over');
            }
        }

        function onPointerUp(upEvent) {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            document.body.classList.remove('mm-dragging-active');

            try {
                if (chip.releasePointerCapture) chip.releasePointerCapture(pointerId);
            } catch (_err) {}

            if (isDragging) {
                chip.classList.remove('dragging');
                if (ghostEl) ghostEl.remove();
                document.querySelectorAll('.mm-node-slot').forEach(s => s.classList.remove('drag-over'));

                const targetSlot = findSlotUnderPoint(upEvent.clientX, upEvent.clientY);
                if (targetSlot) {
                    const slotId = targetSlot.getAttribute('data-slot-id');
                    evaluateDropAttempt(nodeId, slotId, targetSlot);
                }
            } else {
                state.selectedChipId = (state.selectedChipId === nodeId) ? null : nodeId;
                document.querySelectorAll('.mm-chip').forEach(c => {
                    c.classList.toggle('selected-chip', c.getAttribute('data-node-id') === state.selectedChipId);
                });
            }
        }

        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }

    function findSlotUnderPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);
        for (const el of elements) {
            const slot = el.closest && el.closest('.mm-node-slot');
            if (slot) return slot;
        }
        return null;
    }

    // ========================================================================
    // 9. AUSWERTUNG & DEEP CLINICAL MASTERY GATE BEIM PLATZIEREN (NEU V6.0)
    // ========================================================================

    async function evaluateDropAttempt(draggedNodeId, targetSlotId, slotElement) {
        const map = state.currentMap;
        if (!map) return;

        const targetNode = map.nodes.find(n => n.id === targetSlotId);
        if (!targetNode) return;

        const tutorEl = document.getElementById('mm-tutor-message');

        // 1. Prüfen, ob der Ziel-Slot noch durch die Kausal-Sperre blockiert ist
        if (isSlotCurrentlyLocked(targetNode)) {
            if (slotElement) {
                slotElement.classList.remove('mm-node-error');
                void slotElement.offsetWidth;
                slotElement.classList.add('mm-node-error');
            }
            if (tutorEl) {
                tutorEl.innerHTML = `
                    <strong style="color:#38bdf8;">🔒 Kausaler Zwischenschritt auf 1. Ebene fehlt noch!</strong><br>
                    Dieser Ziel-Slot liegt auf dem <strong>2. Ring (Folgekaskade)</strong>.<br>
                    Löse zuerst den übergeordneten Hauptknoten der 1. Ebene direkt am Zentrum, bevor du dessen Folgeerscheinung zuordnest! (Kein Fehlerpunkt abgezogen).
                `;
            }
            return;
        }

        // 2. Prüfen, ob der gezogene Chip ein klinischer DISTRAKTOR (Falle) ist!
        const activeDistractors = getActiveDistractors(map);
        const distractorObj = activeDistractors.find(d => d.id === draggedNodeId);
        if (distractorObj) {
            state.mistakesCount += 1;
            state.streakCount = 0;
            state.weakNodeIds.add(targetNode.id);
            state.eliminatedDistractorIds.add(distractorObj.id);
            state.selectedChipId = null;

            const savedZoom = state.zoom;
            const savedPanX = state.panX;
            const savedPanY = state.panY;
            renderModule();
            state.zoom = savedZoom;
            state.panX = savedPanX;
            state.panY = savedPanY;
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });

            const newTutorEl = document.getElementById('mm-tutor-message');
            if (newTutorEl) {
                newTutorEl.innerHTML = `
                    <strong style="color:#ef4444;">🚨 Klinische Differenzialdiagnose-Falle (Distraktor)!</strong><br>
                    <strong>„${escapeHtml(distractorObj.label)}“</strong> gehört NICHT in diese Kausalkette:<br>
                    <div style="margin-top:6px; padding:7px 9px; border-radius:6px; background:rgba(239,68,68,0.14); border-left:3px solid #ef4444; font-size:0.81rem;">
                        ${escapeHtml(distractorObj.distractor_reason)}
                    </div>
                `;
            }
            return;
        }

        const draggedNode = map.nodes.find(n => n.id === draggedNodeId);
        if (!draggedNode) return;

        // 3. Prüfen auf exakte Übereinstimmung ODER semantische Äquivalenz
        const isExactMatch = draggedNode.id === targetNode.id;
        const isSemanticEquivalent = (
            (draggedNode.parent_id || 'root') === (targetNode.parent_id || 'root') &&
            draggedNode.category === targetNode.category &&
            (draggedNode.relation_label || '').trim().toLowerCase() === (targetNode.relation_label || '').trim().toLowerCase()
        );

        if (isExactMatch || isSemanticEquivalent) {
            if (!isExactMatch && isSemanticEquivalent) {
                const temp = { ...targetNode };
                targetNode.label = draggedNode.label;
                targetNode.socratic_hint = draggedNode.socratic_hint;
                targetNode.explanation = draggedNode.explanation;
                targetNode.mastery_question = draggedNode.mastery_question;
                draggedNode.label = temp.label;
                draggedNode.socratic_hint = temp.socratic_hint;
                draggedNode.explanation = temp.explanation;
                draggedNode.mastery_question = temp.mastery_question;
            }

            // NEU V6.0: Öffne das Deep Clinical Mastery Gate (Tiefenverständnis-Prüfung zum platzierten Knoten!)
            if (state.deepComprehensionMode) {
                await openDeepComprehensionGate(targetNode, false);
                return;
            }

            await finalizeNodePlacement(targetNode, true);
            return;
        }

        // 4. Fehlversuch beim Platzieren -> Sokratisches Feedback
        state.mistakesCount += 1;
        state.streakCount = 0;
        state.weakNodeIds.add(targetNode.id);

        const mistakesBadge = document.getElementById('mm-stat-mistakes');
        if (mistakesBadge) mistakesBadge.textContent = `⚠️ Fehler: ${state.mistakesCount}`;
        const streakBadge = document.getElementById('mm-stat-streak');
        if (streakBadge) streakBadge.textContent = `🔥 Serie: 0`;

        if (slotElement) {
            slotElement.classList.remove('mm-node-error');
            void slotElement.offsetWidth;
            slotElement.classList.add('mm-node-error');
        }

        await triggerSocraticFeedback(draggedNode, targetNode);
    }

    /**
     * Erzeugt oder lädt eine tiefgehende klinische Verständnisfrage (Staatsexamensniveau) für den Knoten.
     * Unterstützt 1. Kuratierte/importierte Fragen, 2. Live-KI-Generierung via /api/gemini (mode: 'depot_quiz'), 3. Offline-Synthese-Fallback.
     */
    async function resolveMasteryQuestionForNode(targetNode, forceAiRegenerate = false) {
        if (!forceAiRegenerate && targetNode.mastery_question && Array.isArray(targetNode.mastery_question.options) && targetNode.mastery_question.options.length >= 3) {
            return targetNode.mastery_question;
        }

        const map = state.currentMap;
        const parentLabel = getParentLabel(targetNode, true);
        const catLabel = CATEGORIES[targetNode.category]?.label || targetNode.category;

        const aiPrompt = `Du bist Prüfungsautor für das medizinische Staatsexamen (IMPP / USMLE Step 2 CK).
Ein Medizinstudent hat in einer klinischen Mindmap zum Thema "${map.central_concept}" (${map.specialty}) soeben den Baustein "${targetNode.label}" (Kategorie: ${catLabel}, Kausalbeziehung: "${targetNode.relation_label}" ausgehend von "${parentLabel}") an der richtigen Stelle platziert.
Hintergrundinfo zum Knoten: "${targetNode.explanation || targetNode.socratic_hint || ''}".

Erstelle EINE hochspezifische, tiefgehende Verständnisfrage (Bloom-Stufe: Analyse, Evaluation & Pathomechanismus), die prüft, ob der Student diesen konkreten Baustein "${targetNode.label}" im Kontext von "${map.central_concept}" WIRKLICH tiefgründig verstanden hat.
WICHTIG:
1. Frage NICHT oberflächlich "Zu welchem Ast gehört ${targetNode.label}?", sondern hinterfrage das WARUM / WIE (z.B. exakter molekularer/hämodynamischer Mechanismus, entscheidende Kontraindikation, diagnostischer Fallstrick, Cutoff oder Abgrenzung zur engsten Differenzialdiagnose).
2. Erstelle genau 4 Antwortoptionen ("options") mit strikter Längenparität (alle 4 Optionen ähnlich lang, ca. 14 bis 24 Wörter, gleicher Fachstil, keine Test-Wiseness-Hinweise!).
3. Gib den "correct_index" (0 bis 3), einen "socratic_nudge" (sokratischer Tipp bei falscher Auswahl OHNE die Lösung direkt zu nennen) und eine präzise "rationale" (Begründung inkl. Ausschluss der Distraktoren) an.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Array mit genau einem Objekt:
[
  {
    "question": "Tiefgehende klinisch-pathophysiologische Prüfungsfrage...",
    "options": [
      "Option 1...",
      "Option 2...",
      "Option 3...",
      "Option 4..."
    ],
    "correct_index": 0,
    "socratic_nudge": "Sokratischer Denkanstoß bei Fehlversuch ohne Lösungsspoiler...",
    "rationale": "Klinisch-pathophysiologische Begründung..."
  }
]`;

        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'depot_quiz',
                    prompt: aiPrompt
                })
            });

            if (response.ok) {
                const data = await response.json();
                const item = Array.isArray(data?.result) ? data.result[0] : null;
                if (item && item.question && Array.isArray(item.options) && item.options.length >= 4) {
                    const generatedQuiz = {
                        question: item.question,
                        options: item.options.slice(0, 4),
                        correct_index: Number.isInteger(item.correct_index) ? item.correct_index : 0,
                        socratic_nudge: item.socratic_nudge || targetNode.socratic_hint || 'Überdenke den exakten Pathomechanismus und die Leitlinien-Kriterien dieses Schritts.',
                        rationale: item.rationale || targetNode.explanation || ''
                    };
                    targetNode.mastery_question = generatedQuiz;
                    // Direkt lokal im Mindmap-Objekt cachen
                    saveCustomMindmapToDb(map).catch(() => {});
                    return generatedQuiz;
                }
            }
        } catch (_e) {
            console.warn('[Mindmap V6.0] Offline-Synthese-Fallback für Mastery-Question aktiv.');
        }

        // Intelligenter Offline-Fallback aus den Erklärungen der Mindmap-Knoten
        const correctStatement = targetNode.explanation || `Durch „${targetNode.relation_label}“ resultiert aus „${parentLabel}“ unmittelbar das klinische Konzept „${targetNode.label}“.`;
        const otherNodes = map.nodes.filter(n => n.id !== targetNode.id && n.explanation);
        const distractorExplanations = shuffleArray(otherNodes).slice(0, 3).map(n => n.explanation);

        while (distractorExplanations.length < 3) {
            distractorExplanations.push(
                'Es handelt sich um einen rein kompensatorischen Begleitmechanismus ohne prognostische Relevanz oder therapeutische Konsequenz im Akutstadium.'
            );
        }

        return {
            question: `Tiefenverständnis-Prüfung zu „${targetNode.label}“: Welche pathophysiologische bzw. klinisch-therapeutische Aussage begründet diesen Baustein im Kontext von „${map.central_concept}“ exakt?`,
            options: [correctStatement, ...distractorExplanations],
            correct_index: 0,
            socratic_nudge: targetNode.socratic_hint || 'Fokussiere dich auf den spezifischen Mechanismus, der genau diesen Knoten von den anderen Ästen der Mindmap unterscheidet.',
            rationale: correctStatement
        };
    }

    /**
     * NEU V6.0: Öffnet das "Deep Clinical Mastery Gate" (Tiefenverständnis-Prüfung) beim Platzieren eines Blocks
     * (oder im Review-Modus beim Klick auf einen bereits gelösten Knoten).
     */
    async function openDeepComprehensionGate(targetNode, isReviewOnly = false, forceAiRegenerate = false) {
        const existingModal = document.querySelector('.mm-synapse-modal-backdrop');
        if (existingModal) existingModal.remove();

        const parentLabel = getParentLabel(targetNode, isReviewOnly);
        const catCfg = CATEGORIES[targetNode.category] || { label: 'Konzept', icon: '🩺', color: '#38bdf8' };

        const backdrop = document.createElement('div');
        backdrop.className = 'mm-synapse-modal-backdrop';
        backdrop.innerHTML = `
            <div class="mm-synapse-modal">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap;">
                    <span style="font-size:0.76rem; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:0.04em;">
                        🔬 ${isReviewOnly ? 'Tiefenverständnis-Training (Review)' : 'Schritt 2/2: Klinisches Tiefen-Verhör vor dem Einrasten'}
                    </span>
                    <span style="font-size:0.75rem; padding:3px 8px; border-radius:6px; background:rgba(56,189,248,0.14); color:#38bdf8; font-weight:700;">
                        ${catCfg.icon} ${escapeHtml(catCfg.label)}
                    </span>
                </div>

                <div class="mm-synapse-chain-box">
                    <span class="mm-synapse-node-pill">${escapeHtml(parentLabel)}</span>
                    <span class="mm-synapse-missing-pill">➔ ${escapeHtml(targetNode.relation_label || 'Kausalverbindung')} ➔</span>
                    <span class="mm-synapse-node-pill" style="border-color:#38bdf8;">${escapeHtml(targetNode.label)}</span>
                </div>

                <div id="mm-gate-body">
                    <div style="padding:24px; text-align:center; color:#94a3b8; font-size:0.88rem;">
                        🧠 Generiere tiefgehende klinische Verständnisfrage zu <strong>„${escapeHtml(targetNode.label)}“</strong>...
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);

        const masteryData = await resolveMasteryQuestionForNode(targetNode, forceAiRegenerate);
        const gateBody = backdrop.querySelector('#mm-gate-body');
        if (!gateBody) return;

        // Antwortoptionen zufällig mischen, damit die richtige Antwort nicht immer auf Index 0 liegt
        const indexedOptions = masteryData.options.map((text, idx) => ({
            text,
            isCorrect: idx === (masteryData.correct_index ?? 0)
        }));
        const shuffledOptions = shuffleArray(indexedOptions);

        let optionsRevealed = !state.activeRecallFirstMode;
        let hadWrongAttempt = false;
        let solvedInModal = false;

        const renderGateContent = (userHypothesisText = '') => {
            gateBody.innerHTML = `
                <div class="mm-mastery-question-box">
                    ${escapeHtml(masteryData.question)}
                </div>

                ${!optionsRevealed ? `
                    <div class="mm-recall-first-box">
                        <div style="font-size:0.8rem; font-weight:800; color:#fcd34d;">
                            ✍️ Active-Recall-Stufe (Freitext-Hypothese vor den Antwortoptionen):
                        </div>
                        <div style="font-size:0.78rem; color:#cbd5e1; margin-top:2px;">
                            Formuliere in 1–2 Stichworten deine eigene Erklärung, bevor du die 4 Optionen aufdeckst (maximiert den Testing-Effekt!):
                        </div>
                        <textarea id="mm-recall-hypothesis-input" class="mm-recall-textarea" placeholder="Meine pathophysiologische / klinische Begründung...">${escapeHtml(userHypothesisText)}</textarea>
                        <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                            <button type="button" id="mm-btn-reveal-mc" class="mm-btn mm-btn-primary">
                                🔓 Antwortoptionen aufdecken & verifizieren
                            </button>
                        </div>
                    </div>
                ` : `
                    ${userHypothesisText ? `
                        <div style="margin-bottom:10px; padding:8px 12px; border-radius:8px; background:rgba(56,189,248,0.09); border-left:3px solid #38bdf8; font-size:0.8rem; color:#cbd5e1;">
                            <strong>Deine Vorab-Hypothese:</strong> <em>„${escapeHtml(userHypothesisText)}“</em>
                        </div>
                    ` : ''}
                    <div class="mm-synapse-options" id="mm-gate-options-list">
                        ${shuffledOptions.map((opt, idx) => `
                            <button type="button" class="mm-synapse-opt-btn" data-opt-idx="${idx}">
                                <span><strong>${String.fromCharCode(65 + idx)})</strong> ${escapeHtml(opt.text)}</span>
                                <span style="color:#64748b; font-weight:800;">➔</span>
                            </button>
                        `).join('')}
                    </div>
                `}

                <div id="mm-gate-feedback"></div>

                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); flex-wrap:wrap;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" id="mm-gate-ai-regen" class="mm-btn" style="font-size:0.76rem;" title="Generiert per KI eine völlig neue klinische Prüfungsfrage zu diesem Knoten">
                            🔄 Neue KI-Prüfungsfrage (anderer Fokus)
                        </button>
                        <button type="button" id="mm-gate-pin-depot" class="mm-btn" style="font-size:0.76rem; color:#38bdf8;">
                            📌 Ins Lern-Depot
                        </button>
                    </div>
                    <div style="display:flex; gap:8px;">
                        ${isReviewOnly ? `
                            <button type="button" id="mm-gate-close" class="mm-btn">Schließen</button>
                        ` : ''}
                        <button type="button" id="mm-gate-confirm-next" class="mm-btn mm-btn-primary" style="display:none;">
                            ✅ Verstanden & Knoten einrasten ➔
                        </button>
                    </div>
                </div>
            `;

            gateBody.querySelector('#mm-btn-reveal-mc')?.addEventListener('click', () => {
                const val = gateBody.querySelector('#mm-recall-hypothesis-input')?.value.trim() || '';
                optionsRevealed = true;
                renderGateContent(val);
            });

            gateBody.querySelector('#mm-gate-ai-regen')?.addEventListener('click', () => {
                openDeepComprehensionGate(targetNode, isReviewOnly, true);
            });

            gateBody.querySelector('#mm-gate-pin-depot')?.addEventListener('click', async e => {
                const btn = e.currentTarget;
                await saveNodeToLearningDepot(targetNode);
                btn.textContent = '✅ Im Depot gespeichert!';
                btn.disabled = true;
            });

            gateBody.querySelector('#mm-gate-close')?.addEventListener('click', () => {
                backdrop.remove();
            });

            gateBody.querySelectorAll('.mm-synapse-opt-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (solvedInModal) return;
                    const idx = Number(btn.getAttribute('data-opt-idx'));
                    const chosen = shuffledOptions[idx];
                    const fbEl = gateBody.querySelector('#mm-gate-feedback');

                    if (chosen.isCorrect) {
                        solvedInModal = true;
                        btn.classList.add('correct-choice');
                        gateBody.querySelectorAll('.mm-synapse-opt-btn').forEach(b => { b.disabled = true; });

                        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);

                        if (fbEl) {
                            fbEl.innerHTML = `
                                <div class="mm-mastery-rationale-box">
                                    <strong style="color:#10b981;">🎯 Exzellentes Tiefenverständnis!</strong><br>
                                    ${escapeHtml(masteryData.rationale || targetNode.explanation || '')}
                                </div>
                            `;
                        }

                        const confirmBtn = gateBody.querySelector('#mm-gate-confirm-next');
                        if (confirmBtn) {
                            confirmBtn.style.display = 'inline-flex';
                            confirmBtn.focus();
                            confirmBtn.addEventListener('click', async () => {
                                backdrop.remove();
                                if (!isReviewOnly) {
                                    await finalizeNodePlacement(targetNode, !hadWrongAttempt);
                                }
                            });
                        }
                    } else {
                        hadWrongAttempt = true;
                        state.mistakesCount += 1;
                        state.streakCount = 0;
                        state.weakNodeIds.add(targetNode.id);
                        btn.classList.add('wrong-choice');
                        btn.disabled = true;

                        const mistakesBadge = document.getElementById('mm-stat-mistakes');
                        if (mistakesBadge) mistakesBadge.textContent = `⚠️ Fehler: ${state.mistakesCount}`;
                        const streakBadge = document.getElementById('mm-stat-streak');
                        if (streakBadge) streakBadge.textContent = `🔥 Serie: 0`;

                        if (fbEl) {
                            fbEl.innerHTML = `
                                <div class="mm-mastery-nudge-box">
                                    <strong>🤔 Sokratischer Denkanstoß (noch nicht ganz):</strong><br>
                                    ${escapeHtml(masteryData.socratic_nudge || targetNode.socratic_hint || 'Prüfe den exakten pathophysiologischen Mechanismus noch einmal.')}
                                </div>
                            `;
                        }
                    }
                });
            });
        };

        renderGateContent('');
    }

    async function finalizeNodePlacement(targetNode, flawlessFirstTry) {
        const map = state.currentMap;
        if (!map) return;

        state.solvedNodeIds.add(targetNode.id);
        state.selectedChipId = null;

        if (flawlessFirstTry) {
            state.streakCount += 1;
            if (state.streakCount > state.maxStreak) state.maxStreak = state.streakCount;
            if (typeof window.applyXpDelta === 'function') {
                window.applyXpDelta(25, 'Tiefenprüfung 1st-Try');
            }
        }

        const newlyUnlockedChildren = map.nodes.filter(n => n.parent_id === targetNode.id);

        const savedZoom = state.zoom;
        const savedPanX = state.panX;
        const savedPanY = state.panY;

        renderModule();
        state.zoom = savedZoom;
        state.panX = savedPanX;
        state.panY = savedPanY;

        requestAnimationFrame(() => {
            applyStageTransform();
            drawSvgConnections();
        });

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);

        const updatedTutorEl = document.getElementById('mm-tutor-message');
        if (updatedTutorEl) {
            const parentLabel = getParentLabel(targetNode);
            const rationaleText = targetNode.mastery_question?.rationale || targetNode.explanation;
            const pearlText = rationaleText
                ? `<div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(16,185,129,0.12); border-left:3px solid #10b981; font-size:0.8rem;">💡 <strong>Klinische Essenz:</strong> ${escapeHtml(rationaleText)}</div>`
                : '';
            const unlockNotice = newlyUnlockedChildren.length > 0
                ? `<div style="margin-top:6px; color:#38bdf8; font-size:0.8rem;">🔓 <strong>Folgekaskade freigeschaltet:</strong> ${newlyUnlockedChildren.length} abhängige(r) Knoten der 2. Ebene an „${escapeHtml(targetNode.label)}“ ist jetzt bereit!</div>`
                : '';

            updatedTutorEl.innerHTML = `
                <strong style="color:#10b981;">✅ Knoten & Tiefenverständnis verifiziert!</strong><br>
                <strong>„${escapeHtml(targetNode.label)}“</strong> folgt über <em>„${escapeHtml(targetNode.relation_label || 'Verbindung')}“</em> aus <strong>„${escapeHtml(parentLabel)}“</strong>.
                ${pearlText}
                ${unlockNotice}
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                    <button type="button" class="mm-depot-pin-btn" data-pin-node="${escapeHtml(targetNode.id)}">
                        📌 Ins Lern-Depot pinnen
                    </button>
                    <button type="button" class="mm-depot-pin-btn" data-retest-node="${escapeHtml(targetNode.id)}">
                        🔬 Tiefen-Frage erneut öffnen
                    </button>
                </div>
            `;
            bindTutorActionButtons(updatedTutorEl);
        }

        if (state.solvedNodeIds.size === map.nodes.length) {
            await saveProgressToDb();
            if (updatedTutorEl) {
                const totalAttempts = map.nodes.length + state.mistakesCount;
                const accuracy = totalAttempts > 0 ? Math.round((map.nodes.length / totalAttempts) * 100) : 100;
                updatedTutorEl.innerHTML = `
                    <strong style="color:#10b981;">🏆 Gesamte Mindmap & Tiefenprüfung gemeistert (${accuracy}% Präzision, Max-Serie: ${state.maxStreak})!</strong><br>
                    Du hast alle ${map.nodes.length} Konzepte kausal zugeordnet und ihr klinisches Tiefenverständnis bewiesen (${state.mistakesCount} Fehlversuche). Klicke auf beliebige gelöste Knoten, um dir weitere KI-Prüfungsfragen dazu generieren zu lassen!
                `;
            }
        }
    }

    function bindTutorActionButtons(containerEl) {
        const pinBtn = containerEl.querySelector('[data-pin-node]');
        if (pinBtn) {
            pinBtn.addEventListener('click', async () => {
                const nodeId = pinBtn.getAttribute('data-pin-node');
                const node = state.currentMap?.nodes.find(n => n.id === nodeId);
                if (node) {
                    await saveNodeToLearningDepot(node);
                    pinBtn.textContent = '✅ Im Lern-Depot gespeichert!';
                    pinBtn.disabled = true;
                }
            });
        }

        const retestBtn = containerEl.querySelector('[data-retest-node]');
        if (retestBtn) {
            retestBtn.addEventListener('click', () => {
                const nodeId = retestBtn.getAttribute('data-retest-node');
                const node = state.currentMap?.nodes.find(n => n.id === nodeId);
                if (node) {
                    openDeepComprehensionGate(node, true, false);
                }
            });
        }
    }

    function showSolvedNodeExplanation(slotId) {
        const node = state.currentMap?.nodes.find(n => n.id === slotId);
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!node || !tutorEl) return;

        const parentLabel = getParentLabel(node, true);
        const rationaleText = node.mastery_question?.rationale || node.explanation || node.socratic_hint || 'Klinisch verifiziertes Konzept.';
        tutorEl.innerHTML = `
            <strong style="color:#10b981;">✅ Gelöster Knoten: „${escapeHtml(node.label)}“</strong><br>
            <span style="font-size:0.8rem; color:#94a3b8;">Kausalkette: <strong>${escapeHtml(parentLabel)}</strong> ➔ <em>${escapeHtml(node.relation_label)}</em></span><br>
            <div style="margin-top:6px;">${escapeHtml(rationaleText)}</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                <button type="button" class="mm-depot-pin-btn" data-pin-node="${escapeHtml(node.id)}">
                    📌 Ins Lern-Depot pinnen
                </button>
                <button type="button" class="mm-depot-pin-btn" data-retest-node="${escapeHtml(node.id)}">
                    🔬 Tiefenverständnis-Frage öffnen
                </button>
            </div>
        `;
        bindTutorActionButtons(tutorEl);
    }

    function showSlotSocraticHint(slotId) {
        const targetNode = state.currentMap?.nodes.find(n => n.id === slotId);
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!targetNode || !tutorEl) return;

        if (isSlotCurrentlyLocked(targetNode)) {
            tutorEl.innerHTML = `
                <strong style="color:#f59e0b;">🔒 Dieser Folgeschritt (2. Ebene) ist noch gesperrt:</strong><br>
                Löse zuerst den zugehörigen Hauptknoten der 1. Ebene am Zentrum. Sobald die primäre Ursache verifiziert ist, wird diese Folgekaskade freigeschaltet!
            `;
            return;
        }

        const parentLabel = getParentLabel(targetNode);
        const targetCat = state.blindMode ? 'Kategorie im Blind-Modus verdeckt' : (CATEGORIES[targetNode.category]?.label || targetNode.category);
        const relHint = targetNode.relation_label || '';

        tutorEl.innerHTML = `
            <strong style="color:#38bdf8;">💡 Sokratische Leitfrage für diesen Knoten:</strong><br>
            <span style="font-size:0.8rem; color:#94a3b8;">Gesucht: <strong>${escapeHtml(parentLabel)}</strong> ➔ <em>${escapeHtml(relHint)}</em> (${escapeHtml(targetCat)})</span>
            <div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8;">
                ${escapeHtml(targetNode.socratic_hint || 'Überlege, welcher Begriff aus dem Pool kausal an diese Stelle gehört.')}
            </div>
        `;
    }

    async function triggerSocraticFeedback(draggedNode, targetNode) {
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!tutorEl) return;

        const parentLabel = getParentLabel(targetNode);
        const draggedCat = CATEGORIES[draggedNode.category]?.label || draggedNode.category;
        const targetCat = CATEGORIES[targetNode.category]?.label || targetNode.category;
        const draggedIsSecondOrder = draggedNode.parent_id && draggedNode.parent_id !== 'root';
        const targetIsSecondOrder = targetNode.parent_id && targetNode.parent_id !== 'root';

        let structuralHint = '';
        if (draggedIsSecondOrder !== targetIsSecondOrder) {
            structuralHint = draggedIsSecondOrder
                ? `⚠️ <strong>Kausal-Ebenen-Konflikt:</strong> „${escapeHtml(draggedNode.label)}“ ist eine nachgelagerte <em>Konsequenz / Detailmaßnahme (2. Ebene)</em>, aber dieser Slot sucht zuerst den primären <em>Hauptast (1. Ebene)</em> direkt am Zentrum!`
                : `⚠️ <strong>Kausal-Ebenen-Konflikt:</strong> „${escapeHtml(draggedNode.label)}“ ist ein primärer <em>Hauptast (1. Ebene)</em> am Zentrum, nicht der hier gesuchte <em>Folgeschritt (2. Ebene)</em> aus „${escapeHtml(parentLabel)}“!`;
        } else if (draggedNode.category !== targetNode.category) {
            structuralHint = `⚠️ <strong>Domänen-Konflikt:</strong> Du hast ein Konzept der <em>${escapeHtml(draggedCat)}</em> gewählt, aber an dieser Stelle der Kausalkette wird <em>${escapeHtml(targetCat)}</em> gesucht.`;
        }

        tutorEl.innerHTML = `
            <div class="mm-tutor-thinking">
                <span>🧠 Analysiere deinen Zuordnungsversuch sokratisch...</span>
            </div>
        `;

        const prompt = `Du bist ein sokratischer Medizin-Tutor auf Staatsexamensniveau.
Ein Medizinstudent bearbeitet gerade eine Mindmap zum Thema "${state.currentMap.central_concept}".
Er hat versucht, den Begriff "${draggedNode.label}" (${draggedCat}) auf einen Ziel-Knoten zu ziehen, der über die Kausalrelation "${targetNode.relation_label}" an "${parentLabel}" hängt (gesuchte Kategorie: ${targetCat}).
Die korrekte Lösung für diesen Ziel-Knoten wäre "${targetNode.label}" (VERRATE DIESEN ZIELBEGRIFF UNTER KEINEN UMSTÄNDEN WÖRTLICH!).

Antworte AUSSCHLIESSLICH mit einem validen JSON-Array mit genau einem Objekt im folgenden Format:
[
  {
    "flaw_analysis": "1 prägnanter Satz (per Du), warum '${draggedNode.label}' pathophysiologisch oder klinisch nicht an diese Stelle passt.",
    "socratic_question": "1 gezielte sokratische Leitfrage, die auf den gesuchten Mechanismus hinführt, ohne '${targetNode.label}' zu nennen."
  }
]`;

        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'depot_quiz',
                    prompt
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            const firstItem = Array.isArray(data?.result) ? data.result[0] : null;
            const aiFlaw = firstItem?.flaw_analysis || '';
            const aiQuestion = firstItem?.socratic_question || '';

            if (aiFlaw || aiQuestion) {
                tutorEl.innerHTML = `
                    ${structuralHint ? `<div style="margin-bottom:6px; font-size:0.8rem; color:#fcd34d;">${structuralHint}</div>` : ''}
                    <strong style="color:#f59e0b;">🤔 Sokratisches Differential-Feedback:</strong><br>
                    ${aiFlaw ? `<span>${escapeHtml(aiFlaw)}</span><br>` : ''}
                    ${aiQuestion ? `<div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8;"><strong style="color:#38bdf8;">Leitfrage:</strong> ${escapeHtml(aiQuestion)}</div>` : ''}
                `;
                return;
            }
            throw new Error('Leere AI-Antwort');
        } catch (_err) {
            const fallbackReason = structuralHint || `<strong>„${escapeHtml(draggedNode.label)}“</strong> erfüllt nicht die gesuchte Kausalrolle ausgehend von <strong>„${escapeHtml(parentLabel)}“</strong>.`;

            tutorEl.innerHTML = `
                <strong style="color:#f59e0b;">🤔 Sokratische Analyse:</strong><br>
                ${fallbackReason}<br>
                <div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8;">
                    <strong style="color:#38bdf8;">Leitfrage für diesen Slot:</strong> ${escapeHtml(targetNode.socratic_hint || 'Welche direkte Konsequenz oder Maßnahme ergibt sich hier?')}
                </div>
            `;
        }
    }

    // ========================================================================
    // 10. VORLESUNGS-PROMPT KOPIERER (MIT MASTERY-QUESTIONS) & JSON-IMPORT
    // ========================================================================

    function copyExtractionPrompt() {
        const promptTemplate = `# ROLLE & ZIEL
Du bist ein medizinischer Facharzt-Tutor (Staatsexamensniveau IMPP/NBME) und Daten-Architekt für das MedCheck Mindmap-Labor V6.0 ("Deep Clinical Mastery Gate").
Extrahiere aus dem folgenden Vorlesungstext die TIEFSTEN pathophysiologischen, molekularbiologischen, diagnostischen und therapeutischen Details und überführe sie in ein direkt importierbares, valides JSON-Objekt.

# 1. INHALTLICHE REGELN (ZERO-SUPERFICIALITY & DEEP COMPREHENSION GATE)
1. KEINE OBERFLÄCHLICHKEITEN: Begriffe wie "Blutbild", "MRT", "Entzündung" oder "Medikamente" sind verboten! Extrahiere exakte Rezeptoren, Ionenkanäle, Autoantikörper, Genmutationen, pathognomonische Zeichen, spezifische Sequenzen, exakte Cutoffs mit Einheiten und Wirkstoffe inkl. Mechanismus/Kontraindikation.
2. STRIKTE 2-RING-KAUSALLOGIK (KEINE MEHRDEUTIGKEITEN!):
   - Erstelle insgesamt 10 bis 12 Knoten in "nodes".
   - 5 Knoten sind Hauptäste 1. Ordnung ("parent_id": "root") und decken alle 5 Kategorien ab ("etiology", "pathophysiology", "clinical", "diagnostics", "therapy").
   - 5 bis 7 Knoten sind Vertiefungsäste 2. Ordnung ("parent_id": "n1" etc.), die einen Hauptast logisch-kausal weiterführen (Ursache -> unmittelbare Folge; Primärdiagnostik -> beweisender Befund; Erstlinientherapie -> spezifischer Wirkmechanismus/Prophylaxe).
3. TIEFENVERSTÄNDNIS-PRÜFUNGSFRAGE ("mastery_question") FÜR JEDEN KNOTEN:
   - Jeder Knoten MUSS ein Objekt "mastery_question" enthalten, das beim Platzieren des Blocks abfragt, ob der Student das klinische/pathophysiologische Prinzip dahinter WIRKLICH verstanden hat (NICHT bloß "Zu welchem Ast gehört das?", sondern Warum/Wie/Kontraindikation/Mechanismus/Differenzialdiagnose).
   - "options": 4 hochplausible Antwortoptionen mit kontrollierter Längenparität (10-15% Varianz, gleicher Fachstil, keine Test-Wiseness!).
   - "correct_index": Index der richtigen Antwort (0 bis 3).
   - "socratic_nudge": Sokratischer Denkanstoß bei Falschantwort (ohne die Lösung direkt zu verraten).
   - "rationale": Präzise Begründung inkl. Ausschluss der Distraktoren.
4. KLINISCHE DISTRAKTOREN ("distractors") GEGEN AUSSCHLUSSVERFAHREN:
   - Erstelle zusätzlich 3 hochplausible klinische Fallen in "distractors" (Befunde einer engen Differenzialdiagnose oder Kontraindikationen) inklusive "distractor_reason".

# 2. STRIKTES JSON-SCHEMA (Antworte NUR mit reinem JSON ohne Markdown-Block)
{
  "id": "mm_fach_thema_001",
  "title": "Prägnanter Titel der Vorlesung / Erkrankung",
  "specialty": "Fachgebiet",
  "central_concept": "Zentrale Leitdiagnose / Hauptkonzept",
  "nodes": [
    {
      "id": "n1",
      "label": "Tiefendetail 1. Ordnung (max. 48 Z.)",
      "category": "etiology | pathophysiology | clinical | diagnostics | therapy",
      "parent_id": "root",
      "relation_label": "Eindeutige Kausalrelation",
      "socratic_hint": "Sokratische Frage vor dem Ziehen ohne Lösungsspoiler?",
      "explanation": "Klinisch-pathophysiologische Zusammenfassung.",
      "mastery_question": {
        "question": "Tiefgehende Staatsexamens-Verständnisfrage zum Mechanismus / zur Klinik dieses Bausteins?",
        "options": [
          "Präzise korrekte Aussage (Längenparität beachten)...",
          "Hochplausibler Distraktor 1...",
          "Hochplausibler Distraktor 2...",
          "Hochplausibler Distraktor 3..."
        ],
        "correct_index": 0,
        "socratic_nudge": "Sokratischer Tipp bei falscher Auswahl ohne Lösungsspoiler.",
        "rationale": "Exakte Begründung nach erfolgreichem Lösen."
      }
    }
  ],
  "distractors": [
    {
      "id": "d1",
      "label": "Täuschend echter Befund einer DD / Kontraindikation",
      "category": "diagnostics | therapy | pathophysiology | clinical | etiology",
      "distractor_reason": "Klinische Begründung, warum dieser Begriff eine Falle ist."
    }
  ]
}

Hier ist der Vorlesungstext:
[HIER VORLESUNGSTEXT EINFÜGEN]`;

        navigator.clipboard.writeText(promptTemplate).then(() => {
            const btn = document.getElementById('mm-btn-prompt');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '✅ V6.0 Mastery-Prompt kopiert!';
                setTimeout(() => { btn.innerHTML = orig; }, 2200);
            }
        });
    }

    function openImportModal() {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'mm-modal-backdrop';
        modalBackdrop.innerHTML = `
            <div class="mm-modal">
                <h3 style="margin-top:0;">📥 Vorlesungs-Mindmap (JSON) importieren</h3>
                <p style="font-size:0.85rem; color:#94a3b8; margin-bottom:0.5rem;">
                    Füge hier das JSON ein (unterstützt <code>mastery_question</code> pro Knoten sowie <code>distractors</code>; ältere JSONs ohne <code>mastery_question</code> werden beim Spielen automatisch live per KI aufgerüstet!).
                </p>
                <textarea id="mm-import-textarea" class="mm-textarea" placeholder='{\n  "id": "mm_pharma_opioids_001",\n  "title": "...",\n  "central_concept": "...",\n  "nodes": [ ... ],\n  "distractors": [ ... ]\n}'></textarea>
                <div id="mm-import-error" style="color:#ef4444; font-size:0.82rem; margin-bottom:0.75rem;"></div>
                <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
                    <button id="mm-modal-cancel" class="mm-btn">Abbrechen</button>
                    <button id="mm-modal-save" class="mm-btn mm-btn-primary">🚀 Mindmap laden & speichern</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalBackdrop);

        modalBackdrop.querySelector('#mm-modal-cancel').addEventListener('click', () => modalBackdrop.remove());
        modalBackdrop.querySelector('#mm-modal-save').addEventListener('click', async () => {
            const raw = modalBackdrop.querySelector('#mm-import-textarea').value.trim();
            const errEl = modalBackdrop.querySelector('#mm-import-error');
            try {
                const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
                const parsed = JSON.parse(cleaned);

                if (!parsed.central_concept || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
                    throw new Error('JSON muss "central_concept" und ein nicht-leeres Array "nodes" enthalten.');
                }

                parsed.id = parsed.id || `mm_custom_${Date.now()}`;
                parsed.title = parsed.title || parsed.central_concept;
                parsed.specialty = parsed.specialty || 'Vorlesung';
                parsed.distractors = Array.isArray(parsed.distractors) ? parsed.distractors : [];

                await saveCustomMindmapToDb(parsed);
                await loadMindmapsAndProgress();
                selectMindmap(parsed.id);
                modalBackdrop.remove();
            } catch (err) {
                errEl.textContent = `Fehler beim Parsen: ${err.message}`;
            }
        });
    }

    window.MindmapModule = {
        init,
        openView,
        selectMindmap,
        deleteCurrentMindmap,
        applyDifficultyPreset,
        openDeepComprehensionGate
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
