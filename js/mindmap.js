/**
 * MedCheck - Interactive Clinical Mindmap Module V7.3 (js/mindmap.js)
 * "Clean Minimalist Studio, Deep-Tree Mastery, Specialty Folders & Free-Recall Promotion Edition"
 *
 * Upgrades in V7.0 – V7.3:
 *  - Clean Minimalist Studio Chrome (2 compact bars, monochrome SVG icons, Segmented Control & Popover Switches).
 *  - True N-Tier Multi-Branch Hierarchy (Tier 1 Macro -> Tier 2 Mechanism/Algorithm -> Tier 3+ Molecular/Cutoff/Guideline Details).
 *  - Zero-Overlap Dual Layout Engine: Bi-Directional Weighted Tidy-Tree (default) + Weighted Angular-Sector Radial View,
 *    with dynamic stage sizing and per-branch Collapse/Expand toggles.
 *  - Specialty Folder System synced 1:1 with Dashboard super-folders (exact orderIndex, auto-sorting, manual move, progress aggregation).
 *  - Compact Custom User Terms per Category Branch (Free-Recall Brainstorming + AI Verification + 1-Click Promotion to Official Exam Node).
 *  - Active Clinical Distractor Quarantine Zone & Metacognitive Confidence Calibration inside the Deep Clinical Mastery Gate.
 *  - Cross-Domain Synthesis Links (cross_links) rendered as dashed synthesis arcs + final transfer check.
 */

(function () {
    'use strict';

    const CATEGORIES = {
        etiology: { label: 'Ätiologie & Risiko', shortLabel: 'Ätiologie', color: '#3b82f6', cssClass: 'cat-etiology', icon: '🧬' },
        pathophysiology: { label: 'Pathophysiologie', shortLabel: 'Pathophysiologie', color: '#ef4444', cssClass: 'cat-pathophysiology', icon: '⚡' },
        clinical: { label: 'Klinik & Symptome', shortLabel: 'Klinik', color: '#f59e0b', cssClass: 'cat-clinical', icon: '🩺' },
        diagnostics: { label: 'Diagnostik', shortLabel: 'Diagnostik', color: '#8b5cf6', cssClass: 'cat-diagnostics', icon: '🔬' },
        therapy: { label: 'Therapie', shortLabel: 'Therapie', color: '#10b981', cssClass: 'cat-therapy', icon: '💊' }
    };

    const TIER_META = {
        1: { short: 'E1 • Überblick', full: 'Ebene 1: Makro-Konzept / Hauptast', badgeClass: 'tier-1' },
        2: { short: 'E2 • Vertiefung', full: 'Ebene 2: Mechanismus / Algorithmus', badgeClass: 'tier-2' },
        3: { short: 'E3 • Tiefendetail', full: 'Ebene 3: Molekular / Cutoff / Leitlinie', badgeClass: 'tier-3' },
        4: { short: 'E4 • Experten-Detail', full: 'Ebene 4: Sonderfall / Komplikation', badgeClass: 'tier-4' }
    };

    const LAYOUT_CONFIG = {
        COL_SPACING_X: 430,     // Horizontaler Abstand zwischen Tiefenebenen im Tidy-Tree
        ROOT_GAP_X: 450,        // Abstand vom Zentralknoten zu Ebene 1
        ROW_SPACING_Y: 168,     // Garantierter vertikaler Mindestabstand zwischen Blattknoten
        BRANCH_EXTRA_GAP_Y: 46, // Extra-Abstand zwischen Hauptästen für maximale Übersichtlichkeit
        STAGE_PADDING_X: 340,
        STAGE_PADDING_Y: 220,
        MIN_STAGE_W: 2400,
        MIN_STAGE_H: 1500
    };

    const UI_ICONS = {
        back: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
        plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
        upload: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        sliders: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
        more: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
        chevron: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
        folder: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
        trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>'
    };

    const DELETED_BUILTINS_KEY = 'medcheck_deleted_builtin_mindmaps_v1';
    const DEPOT_STORAGE_KEY = 'medcheck_learning_depot_v1';
    const FOLDER_OVERRIDES_KEY = 'medcheck_mindmap_folder_overrides_v1';
    const USER_TERMS_STORAGE_KEY = 'medcheck_mindmap_user_terms_v1';
    const BUILTIN_SCHEMA_VERSION = 7;

    /**
     * Fallback-Ordnerliste, falls das Dashboard seine Ordner noch nicht über
     * window.MEDCHECK_DASHBOARD_FOLDERS exponiert.
     */
    const DASHBOARD_FOLDER_FALLBACKS = [
        { id: 'kardiologie', label: 'Kardiologie', icon: '🫀', color: '#ef4444', keywords: ['kardio', 'herz', 'stemi', 'acs', 'ekg', 'gefäss', 'angiologie'] },
        { id: 'neurologie', label: 'Neurologie & Neurochirurgie', icon: '🧠', color: '#8b5cf6', keywords: ['neuro', 'hirn', 'hydrocephalus', 'hydrozephalus', 'liquor', 'demenz', 'stroke', 'epilepsie', 'cjk', 'ftd', 'lbd'] },
        { id: 'pneumologie', label: 'Pneumologie', icon: '🫁', color: '#06b6d4', keywords: ['pneumo', 'lunge', 'lae', 'embolie', 'asthma', 'copd', 'thorax'] },
        { id: 'haematologie', label: 'Hämatologie & Onkologie', icon: '🩸', color: '#ec4899', keywords: ['hämato', 'onko', 'lymph', 'leukämie', 'anämie', 'gerinnung'] },
        { id: 'gastroenterologie', label: 'Gastroenterologie', icon: '🩺', color: '#f59e0b', keywords: ['gastro', 'leber', 'hepato', 'darm', 'pankreas', 'magen', 'viszeral'] },
        { id: 'nephrologie', label: 'Nephrologie & Urologie', icon: '💧', color: '#3b82f6', keywords: ['nephro', 'niere', 'uro', 'elektrolyt', 'säure-basen'] },
        { id: 'endokrinologie', label: 'Endokrinologie & Stoffwechsel', icon: '⚗️', color: '#10b981', keywords: ['endokrin', 'diabetes', 'schilddrüse', 'hormon', 'stoffwechsel'] },
        { id: 'infektiologie', label: 'Infektiologie & Immunologie', icon: '🦠', color: '#22c55e', keywords: ['infekt', 'immun', 'sepsis', 'mikrobio', 'rheuma', 'autoimmun'] },
        { id: 'chirurgie', label: 'Chirurgie & Orthopädie', icon: '🦴', color: '#f97316', keywords: ['chirurg', 'ortho', 'trauma', 'fraktur', 'unfall'] },
        { id: 'notfall', label: 'Notfall- & Intensivmedizin', icon: '🚑', color: '#dc2626', keywords: ['notfall', 'intensiv', 'anästhesie', 'schock', 'reanimation'] },
        { id: 'rechtsmedizin', label: 'Rechtsmedizin & Forensik', icon: '⚖️', color: '#64748b', keywords: ['rechtsmedizin', 'forens', 'toxikologie', 'leichenschau', 'dna'] },
        { id: 'pharmakologie', label: 'Pharmakologie', icon: '💊', color: '#14b8a6', keywords: ['pharma', 'medikament', 'wirkstoff', 'antibiotika'] },
        { id: 'sonstige', label: 'Allgemein & Weitere Fächer', icon: '📁', color: '#94a3b8', keywords: [] }
    ];

    const BUILTIN_MINDMAPS = [
        // ====================================================================
        // BUILT-IN 1: STEMI (19 Knoten über 3 Ebenen, 3 Cross-Links, 4 Fallen)
        // ====================================================================
        {
            id: 'mm_cardio_stemi_001',
            schema_version: BUILTIN_SCHEMA_VERSION,
            title: 'Akutes Koronarsyndrom (STEMI) – Deep Tree',
            specialty: 'Kardiologie',
            central_concept: 'STEMI (Transmurale Ischämie)',
            nodes: [
                // --- AST 1: ÄTIOLOGIE & RISIKO ---
                {
                    id: 'n1',
                    label: 'Koronare Atherosklerose & Risikoprofil',
                    category: 'etiology',
                    parent_id: 'root',
                    relation_label: 'Chronische Hauptursache (~90 %)',
                    socratic_hint: 'Welcher chronisch-inflammatorische Gefäßprozess (getrieben durch LDL, Nikotin, Hypertonie, Diabetes) bildet die strukturelle Grundlage der meisten Myokardinfarkte?',
                    explanation: 'In rund 90 % liegt eine koronare Makroangiopathie mit subendothelialer LDL-Akkumulation, Endotheldysfunktion und Plaquebildung zugrunde.',
                    mastery_question: {
                        question: 'Welcher pathobiologische Prozess markiert den eigentlichen Beginn (Initiation) der koronaren Atherosklerose lange vor einer hämodynamisch wirksamen Lumenstenose?',
                        options: [
                            'Subendotheliale Retention und Oxidation von ApoB-haltigen Lipoproteinen (LDL) mit Endothelaktivierung und Monozyten-Rekrutierung',
                            'Primäre Kalzifizierung der Tunica adventitia durch systemische Hyperkalzämie ohne Beteiligung zirkulierender Lipoproteine',
                            'Spontane Ruptur der gesunden Membrana elastica externa mit Einblutung aus den Vasa vasorum bei normotensiver Strömung',
                            'Autoimmun-vermittelte Zerstörung der Kardiomyozyten-Sarkomere mit sekundärer retrograder Lipidablagerung im Sinus coronarius'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Denke an die „Response-to-Retention“-Hypothese: Was dringt bei gestörter Endothelfunktion zuerst in die Intima ein und lockt Makrophagen an?',
                        rationale: 'ApoB-Lipoproteine (v. a. LDL, Lp(a)) werden an Proteoglykane der Intima gebunden, oxidiert (oxLDL) und induzieren Adhäsionsmoleküle (VCAM-1/ICAM-1), die Monozyten anlocken (Schaumzellbildung).'
                    }
                },
                {
                    id: 'n1a',
                    label: 'Thin-Cap Fibroatheroma (< 65 µm Kappe)',
                    category: 'etiology',
                    parent_id: 'n1',
                    relation_label: 'bildet als Hochrisiko-Läsion',
                    socratic_hint: 'Wie heißt der morphologisch instabile Plaque-Phänotyp mit großem nekrotischem Lipidkern und extrem dünner fibröser Kappe?',
                    explanation: 'Ein Thin-Cap Fibroatheroma (TCFA) besitzt eine fibröse Kappe < 65 µm, einen großen nekrotischen Lipidkern und führt häufiger aus < 50 % stenotischen, aber vulnerablen Plaques zur Ruptur.',
                    mastery_question: {
                        question: 'Warum entstehen akute STEMIs angiographisch paradoxerweise häufig an Koronarplaques, die vor dem Ereignis nur eine < 50%ige Lumenstenose verursachten?',
                        options: [
                            'Vulnerable Plaques wachsen initial nach außen (positives Remodeling) und besitzen dünne, makrophagenreiche Kappen mit hoher Rupturneigung',
                            'Hochgradige > 90%-Stenosen sind komplett frei von Endothelzellen und können deshalb biochemisch keinen Fibrinthrombus mehr verankern',
                            'In geringgradigen Stenosen herrscht eine laminare Strömung ohne jegliche Scherkräfte, was die spontane Fibrinolyse dauerhaft blockiert',
                            'Starke Verkalkungen hochgradiger Stenosen lösen Thrombozyten mechanisch auf, bevor eine relevante Aggregation stattfinden kann'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Vergleiche eine alte, dick verkalkte > 80%-Narbe (stabile Angina) mit einer jungen, lipidreichen Plaque, die nach außen in die Gefäßwand wächst (Glagov-Phänomen)!',
                        rationale: 'Durch positives Remodeling bleibt das Lumen lange relativ weit, sodass keine Belastungsangina warnt. Dennoch ist die dünne Kappe (< 65 µm) extrem rupturgefährdet.'
                    }
                },
                {
                    id: 'n1a1',
                    label: 'MMP-Kollagenabbau durch Schaumzellen',
                    category: 'etiology',
                    parent_id: 'n1a',
                    relation_label: 'destabilisiert Kappe molekular über',
                    socratic_hint: 'Welche proteolytischen Enzyme sezernieren aktivierte Makrophagen in der Plaque-Schulterregion, um das stabilisierende Kollagengerüst zu zersetzen?',
                    explanation: 'Aktivierte Makrophagen (Schaumzellen) und T-Lymphozyten (IFN-γ hemmt Kollagensynthese glatter Muskelzellen) setzen Matrix-Metalloproteinasen (MMP-1, MMP-8, MMP-9) frei, die Typ-I/III-Kollagen abbauen.',
                    mastery_question: {
                        question: 'Durch welchen doppelten zellulären Mechanismus schwächt die chronische Plaque-Entzündung gezielt die Zugfestigkeit der fibrösen Kappe eines TCFA?',
                        options: [
                            'Makrophagen spalten Kollagen über Matrix-Metalloproteinasen (MMPs), während IFN-γ aus Th1-Zellen die Kollagen-Neusynthese glatter Muskelzellen hemmt',
                            'Neutrophile Granulozyten bilden überschüssiges Elastin, während B-Zellen über IgE-Antikörper die glatten Muskelzellen zur Hypertrophie anregen',
                            'Endothelzellen sezernieren vermehrt Stickstoffmonoxid (NO), das Kalziumkristalle auflöst und die Tunica media direkt in Fettgewebe umwandelt',
                            'Fibroblasten überexprimieren Gewebe-Inhibitoren der Metalloproteinasen (TIMPs), wodurch die Plaque-Kappe spröde wie Glas zersplittert'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Denke an das Gleichgewicht aus Kollagen-Abbau (durch Makrophagen-Enzyme) und Kollagen-Aufbau (durch glatte Muskelzellen unter Th1-Zytokin-Einfluss)!',
                        rationale: 'MMPs bauen bestehendes Kollagen ab, und gleichzeitig unterdrückt Interferon-gamma (IFN-γ) aus T-Zellen die Proliferation und Kollagensynthese vaskulärer glatter Muskelzellen (VSMCs).'
                    }
                },
                {
                    id: 'n1b',
                    label: 'Nicht-atherosklerotische DD (SCAD / Spasmus)',
                    category: 'etiology',
                    parent_id: 'n1',
                    relation_label: 'abzugrenzen von Sonderursachen (MINOCA)',
                    socratic_hint: 'Welche wichtigen nicht-atherosklerotischen Ursachen eines STEMI/MINOCA müssen besonders bei jüngeren Frauen oder Kokainkonsum bedacht werden?',
                    explanation: 'Spontane Koronararteriendissektion (SCAD, v. a. junge/peripartale Frauen, fibromuskuläre Dysplasie), Prinzmetal-Vasospasmus, Koronarembolie oder Kokain-induzierter Spasmus.',
                    mastery_question: {
                        question: 'Eine 34-jährige Patientin stellt sich 10 Tage postpartal mit einem akuten Vorderwand-STEMI ohne kardiovaskuläre Risikofaktoren vor. Koronarangiographisch zeigt sich ein langstreckiges intramurales Hämatom im RIVA (SCAD). Wie lautet das primäre Therapieprinzip bei hämodynamischer Stabilität?',
                        options: [
                            'Primär konservatives Management (Betablocker, ASS) statt aggressiver Stent-Implantation, da PCI ein hohes Risiko für eine Dissektionsausbreitung birgt',
                            'Sofortige systemische Fibrinolyse mit hochdosierter Alteplase zur raschen Auflösung des intramuralen Gefäßwandhämatoms',
                            'Routine-Implantation von mindestens drei überlappenden Drug-Eluting-Stents unabhängig vom TIMI-Fluss im distalen Gefäßabschnitt',
                            'Hochdosierte Gabe von Ergotamin und nicht-selektiven Betablockern zur maximalen Vasokonstriktion des falschen Lumens'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Bei einer SCAD ist die Gefäßwand brüchig und ein Bluterguss liegt IN der Wand. Was droht beim Vorschieben eines PCI-Drahts oder bei einer Lyse?',
                        rationale: 'Bei stabiler SCAD mit erhaltenem Fluss heilt die Gefäßwand meist spontan ab; PCI führt oft zur Propagation des Hämatoms oder iatrogener Dissektion, und eine Lyse vergrößert die Wandblutung fatal.'
                    }
                },

                // --- AST 2: PATHOPHYSIOLOGIE ---
                {
                    id: 'n2',
                    label: 'Plaqueruptur & okklusiver Thrombus',
                    category: 'pathophysiology',
                    parent_id: 'root',
                    relation_label: 'Akuter Pathomechanismus',
                    socratic_hint: 'Was passiert akut an der rupturierten Koronarläsion, sodass der Blutfluss im epikardialen Gefäß abrupt zum Stillstand (TIMI 0) kommt?',
                    explanation: 'Die Ruptur (oder Plaque-Erosion) exponiert subendotheliales Kollagen und Tissue Factor (Faktor III), was primäre Thrombozytenadhäsion (vWF/GPIb) und sekundäre plasmatische Gerinnung massiv aktiviert.',
                    mastery_question: {
                        question: 'Welche beiden exponierten Struktur- bzw. Gerinnungskomponenten der rupturierten Plaque triggern parallel die primäre thrombozytäre Hämostase und die extrinsische plasmatische Gerinnungskaskade?',
                        options: [
                            'Subendotheliales Kollagen (bindet vWF/GPIb & GPVI) sowie makrophagenreicher Tissue Factor (bindet Faktor VIIa zur Thrombinbildung)',
                            'Intaktes Prostacyclin (PGI2) der Endothelmembran sowie Faktor XIIa aus der isolierten intrinsischen Kontaktaktivierung',
                            'Freies Antithrombin III aus dem nekrotischen Kern sowie Thrombomodulin-Protein-C-Komplexe der Tunica media',
                            'Gewebe-Plasminogenaktivator (t-PA) aus glatten Muskelzellen sowie Plasminogen-Aktivator-Inhibitor aus Erythrozyten'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Trenne die beiden Arme der Hämostase: Was dockt die Thrombozyten mechanisch an (Adhäsion), und welcher Faktor startet den extrinsischen Weg mit Faktor VII?',
                        rationale: 'Kollagen + vWF vermitteln die Thrombozytenadhäsion (GPIb-IX-V, GPVI), während Tissue Factor aus Makrophagen des Lipidkerns mit Faktor VIIa den Tenase-/Prothrombinase-Weg zur Thrombin-Explosion startet.'
                    }
                },
                {
                    id: 'n2a',
                    label: 'GPIIb/IIIa-Quervernetzung (Aggregation)',
                    category: 'pathophysiology',
                    parent_id: 'n2',
                    relation_label: 'vernetzt Thrombozyten final über',
                    socratic_hint: 'Über welchen Integrin-Rezeptor und welches Plasmaprotein werden aktivierte Thrombozyten unlöslich zum weißen Abscheidungsthrombus verbrückt?',
                    explanation: 'ADP (über P2Y12) und Thromboxan A2 führen zur Inside-Out-Konformationsänderung des GPIIb/IIIa-Integrins, das Fibrinogen als symmetrische Brücke zwischen Thrombozyten bindet.',
                    mastery_question: {
                        question: 'Welcher molekulare Kaskadenschritt bildet die gemeinsame Endstrecke der Thrombozytenaggregation im akuten Koronarthrombus?',
                        options: [
                            'Konformationsänderung des GPIIb/IIIa-Integrins auf aktivierten Thrombozyten mit anschließender symmetrischer Brückenbildung durch Fibrinogen',
                            'Direkte Spaltung von hochmolekularem Kininogen durch Faktor XIIa an der intakten Endotheloberfläche ohne vorherige Kollagenexposition',
                            'Isolierte Bindung von Antithrombin III an subendotheliales Heparansulfat mit konsekutiver Aktivierung der primären Fibrinolyse',
                            'Paradoxe Hemmung der Thromboxan-A2-Synthese in Endothelzellen bei gleichzeitiger Überexpression von Prostacyclin (PGI2)'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Welcher Oberflächenrezeptor (Ziel von Tirofiban/Eptifibatid als Bail-out) vernetzt zwei Thrombozyten mithilfe von Fibrinogen?',
                        rationale: 'Unabhängig vom auslösenden Agonisten (ADP, TXA2, Thrombin) mündet die Thrombozytenaktivierung in der Aktivierung von GPIIb/IIIa (αIIbβ3), der Fibrinogen bindet und den Thrombus stabilisiert.'
                    }
                },
                {
                    id: 'n2b',
                    label: 'Wavefront-Nekrose (Subendokard → Epikard)',
                    category: 'pathophysiology',
                    parent_id: 'n2',
                    relation_label: 'verursacht nach 20–40 Min. Ischämie',
                    socratic_hint: 'In welcher räumlichen Richtung schreitet die irreversible Kardiomyozyten-Nekrose fort, und welcher Strukturmarker wird bei Sarkolemmruptur freigesetzt?',
                    explanation: 'Ab ~20–40 Min. kompletter Okklusion wandert die Nekrosefront (Reimer-Wavefront) vom vulnerablen Subendokard transmural nach epikardial (nach 3–6 h weitgehend komplett); hs-cTnT/I steigt an.',
                    mastery_question: {
                        question: 'Warum beginnt der ischämische Zelluntergang beim akuten Koronarverschluss stets im Subendokard, bevor er sich als „Wavefront Phenomenon“ transmural bis zum Epikard ausbreitet?',
                        options: [
                            'Das Subendokard unterliegt systolisch der höchsten Wandspannung, wird nur diastolisch perfundiert und liegt am distalen Ende der Gefäßstrecke',
                            'Die großen epikardialen Koronararterien verlaufen anatomisch direkt im Subendokard und geben ihre Endäste von innen nach außen ab',
                            'Subendokardiale Kardiomyozyten besitzen keine Mitochondrien und gewinnen ihr ATP ausschließlich über anaerobe Glykolyse',
                            'Das Epikard wird direkt aus dem sauerstoffreichen Blut des linken Ventrikelkavums über Thebesius-Venen retrograd versorgt'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Überlege: Wo verlaufen die großen Koronarien (außen am Epikard), und welche innere Schicht wird während der Systole durch den LV-Druck maximal komprimiert?',
                        rationale: 'Koronararterien penetrieren das Myokard von außen nach innen. Subendokardial herrschen der höchste extravasale Kompressionsdruck, der höchste O2-Bedarf und die geringste Kollateralreserve.'
                    }
                },
                {
                    id: 'n2b1',
                    label: 'Mechanische Komplikationen (Tag 3–7)',
                    category: 'pathophysiology',
                    parent_id: 'n2b',
                    relation_label: 'disponiert durch Myomalazie für',
                    socratic_hint: 'Welche lebensbedrohlichen strukturellen Rupturen drohen ab Tag 3–7 nach transmuraler Nekrose, wenn Makrophagen nekrotisches Gewebe abbauen (Myomalazie)?',
                    explanation: 'Durch leukozytären/makrophagenvermittelten Abbau (weiche Myomalazie vor Kollagennarbe) drohen freie Wandruptur (Perikardtamponade), Ventrikelseptumruptur (VSD) und Papillarmuskelabriss (akute schwere MI).',
                    mastery_question: {
                        question: 'Ein Patient entwickelt 5 Tage nach einem unbehandelten Hinterwand-STEMI (RCA-Verschluss) plötzlich ein akutes Lungenödem und einen kardiogenen Schock mit neuem holosystolischem Geräusch über der Herzspitze. Welche Struktur ist anatomisch am anfälligsten für eine Ruptur?',
                        options: [
                            'Der posteromediale Papillarmuskel, da er in der Regel ausschließlich singulär über die rechte Koronararterie (R. interventricularis posterior) versorgt wird',
                            'Der anterolaterale Papillarmuskel, da er niemals Kollateralen erhält und ausschließlich über die linke Koronarvene drainiert wird',
                            'Die Aortenklappen-Taschen, da die akute Hypoxie des linken Vorhofs direkt zur enzymatischen Auflösung der Semilunarklappen führt',
                            'Das His-Bündel im membranösen Septum, was ohne jegliche Klappenbeteiligung ein hochfrequentes holosystolisches Herzgeräusch erzeugt'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Vergleiche die arterielle Versorgung der beiden Mitral-Papillarmuskeln: Einer hat eine duale Versorgung (LAD + RCX), der andere nur eine singuläre!',
                        rationale: 'Der posteromediale Papillarmuskel wird meist nur von einem Gefäß (PDA aus RCA oder RCX) versorgt und reißt daher deutlich häufiger als der dual versorgte anterolaterale Papillarmuskel (LAD + RCX).'
                    }
                },

                // --- AST 3: KLINIK & SYMPTOME ---
                {
                    id: 'n3',
                    label: 'Vernichtungsschmerz (> 20 Min., nitro-refraktär)',
                    category: 'clinical',
                    parent_id: 'root',
                    relation_label: 'Klinisches Leitsymptom',
                    socratic_hint: 'Wie unterscheidet sich der akute Infarktschmerz zeitlich und medikamentös von einer stabilen Angina pectoris?',
                    explanation: 'Anhaltender retrosternaler Druck- oder Vernichtungsschmerz (> 20 Min., kein Ansprechen auf Nitroglycerin), häufig begleitet von Kaltschweißigkeit, Todesangst und vagaler Übelkeit (v. a. inferior).',
                    mastery_question: {
                        question: 'Warum schließt eine kurzfristige Schmerzlinderung nach sublingualer Nitroglycerin-Gabe in der Notaufnahme ein akutes Koronarsyndrom (ACS) diagnostisch NICHT aus?',
                        options: [
                            'Nitroglycerin lindert auch unspezifische Ösophagusspasmen oder partielle Koronarspasmen und besitzt für die Abgrenzung ACS vs. Non-ACS eine völlig unzureichende Spezifität',
                            'Nitroglycerin verengt selektiv die großen epikardialen Koronarien, weshalb ein echter Infarktschmerz nach Gabe immer sofort vollständig sistiert',
                            'Bei einem transmuralen Infarkt wirkt Nitroglycerin direkt lokalanästhetisch auf die kardialen Schmerzrezeptoren der Segmente C8 bis Th5',
                            'Eine fehlende Schmerzlinderung auf Nitroglycerin tritt ausschließlich bei einer akuten Perikarditis und niemals bei einem STEMI auf'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Ist der „Nitro-Test“ in der modernen Notfallmedizin ein verlässliches diagnostisches Kriterium, um ein ACS auszuschließen oder zu beweisen?',
                        rationale: 'Studien zeigen, dass das Ansprechen auf Nitroglycerin weder sensitiv noch spezifisch für ein ACS ist (z. B. sprechen auch Ösophagusspasmen gut an, während einzelne ACS-Patienten durch Vorlastsenkung kurzfristig Linderung spüren).'
                    }
                },
                {
                    id: 'n3a',
                    label: 'Referred Pain (Head-Zonen C8–Th5)',
                    category: 'clinical',
                    parent_id: 'n3',
                    relation_label: 'projiziert neuroanatomisch als',
                    socratic_hint: 'Über welchen Verschaltungsmechanismus im Rückenmark nimmt der Patient den viszeralen Herzschmerz im linken ulnaren Arm, Hals oder Unterkiefer wahr?',
                    explanation: 'Viszerosomatische Konvergenz kardialer Sympathikus-Afferenzen (C8–Th5) und somatosensibler Hautafferenzen auf gemeinsame Hinterhornneurone führt zur Schmerzprojektion in Dermatome.',
                    mastery_question: {
                        question: 'Durch welchen neuroanatomischen Mechanismus interpretiert der somatosensorische Kortex eine myokardiale Ischämie als Schmerz an der ulnaren Seite des linken Arms oder im Unterkiefer?',
                        options: [
                            'Konvergenz viszerosensibler kardialer Afferenzen und somatosensibler Hautafferenzen auf dieselben Wide-Dynamic-Range-Neurone im Hinterhorn',
                            'Direkte anatomische Kompression des Plexus brachialis durch die akute ischämische Dilatation des linken Ventrikels im Mediastinum',
                            'Fortgeleitete arterielle Embolisation aus dem linken Koronarsinus direkt in die A. subclavia sinistra und A. carotis externa',
                            'Efferente parasympathische Überstimulation des Nervus phrenicus mit direkter motorischer Verkrampfung der Unterarmmuskulatur'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Wie teilen sich Herz-Afferenzen und Haut-Afferenzen (Dermatome C8–Th5) die aufsteigende Schmerzbahn (Tractus spinothalamicus)?',
                        rationale: 'Viszerale Sympathikus-Afferenzen des Herzens und somatische Hautafferenzen (C8–Th5) konvergieren im Hinterhorn auf identische Projektionsneurone; der Kortex ordnet den Reiz erfahrungsgemäß der Körperoberfläche zu.'
                    }
                },
                {
                    id: 'n3b',
                    label: 'Stummer Infarkt & Killip-Schock (III/IV)',
                    category: 'clinical',
                    parent_id: 'n3',
                    relation_label: 'präsentiert sich atypisch / fulminant als',
                    socratic_hint: 'Welche Risikogruppen erleiden häufig schmerzlose Infarkte, und wie klassifiziert man die klinische Linksherzinsuffizienz bzw. den kardiogenen Schock?',
                    explanation: 'Diabetiker (autonome Neuropathie), Hochbetagte und Frauen zeigen oft Dyspnoe/Übelkeit statt Thoraxschmerz. Killip-Klassen: I (keine Stauung), II (basale RGs/S3), III (Lungenödem), IV (kardiogener Schock).',
                    mastery_question: {
                        question: 'Ein 68-jähriger Diabetiker mit akutem Vorderwand-STEMI ist kaltschweißig, hypoton (RR 78/48 mmHg), oligurisch, zeigt ein Laktat von 5,4 mmol/L sowie feuchte Rasselgeräusche über beiden Lungenfeldern. Welcher Killip-Klasse entspricht dieses Bild und welche Prognose besteht?',
                        options: [
                            'Killip-Klasse IV (kardiogener Schock mit Endorgan-Hypoperfusion); höchste Akutmortalität (~40–50 %) mit zwingender Notfall-Revaskularisation',
                            'Killip-Klasse I (kompensierte Hämodynamik); unkomplizierter Verlauf mit elektiver Koronarangiographie innerhalb von 72 Stunden',
                            'Killip-Klasse II (milde basale Stauung ohne Hypoperfusion); primäre Behandlung durch hochdosierte orale Betablocker-Gabe',
                            'Killip-Klasse III (isoliertes Lungenödem bei hypertensiver Entgleisung); sofortige systemische Hochdosis-Nitrattherapie als Monotherapie'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Achte auf die Kombination aus Hypotonie (< 90 mmHg) UND Zeichen der Endorgan-Minderperfusion (Oligurie, Laktatazidose, Kaltschweißigkeit)!',
                        rationale: 'Killip IV definiert den kardiogenen Schock (RRsys < 90 mmHg + Hypoperfusionszeichen wie Laktat > 2 mmol/L, Oligurie, kalte Extremitäten). Nur die rasche Revaskularisation (Culprit-Lesion-PCI) senkt die hohe Mortalität.'
                    }
                },

                // --- AST 4: DIAGNOSTIK ---
                {
                    id: 'n4',
                    label: '12-Kanal-EKG (< 10 Min. nach FMC)',
                    category: 'diagnostics',
                    parent_id: 'root',
                    relation_label: 'Apparative Sofort-Weichenstellung',
                    socratic_hint: 'Welche Untersuchung entscheidet laut ESC-Leitlinie binnen 10 Minuten nach First Medical Contact über den sofortigen Weg ins Herzkatheterlabor (ohne auf Troponin zu warten)?',
                    explanation: 'Das 12-Kanal-EKG innerhalb von ≤ 10 Min. nach Erstkontakt ist die zeitkritische Schlüsseldiagnostik. Auf hs-Troponin darf beim STEMI nicht gewartet werden!',
                    mastery_question: {
                        question: 'Welche spezifische EKG-Frühveränderung kann bereits wenige Minuten nach akutem proximalem Koronarverschluss noch VOR der klassischen ST-Strecken-Hebung sichtbar werden?',
                        options: [
                            'Hyperakute, symmetrisch überhöhte und breitbasige T-Wellen („Erstickungs-T“) im betroffenen Koronarterritorium',
                            'Ausgeprägte pathologische Q-Zacken (> 40 ms) mit vollständig isoelektrischer ST-Strecke und terminal positiver T-Welle',
                            'Isolierte Verkürzung der PQ-Zeit (< 120 ms) mit charakteristischer Delta-Welle als Ausdruck einer akzessorischen Leitungsbahn',
                            'Diffuse konkave ST-Hebungen in nahezu allen Ableitungen begleitet von einer PR-Strecken-Senkung in Ableitung II'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Wie sieht das allererste Stadium im zeitlichen Verlauf der transmuralen Ischämie aus (noch vor dem „Grabstein“-ST-Segment und lange vor der Q-Zacke)?',
                        rationale: 'Hyperakute, hoch-symmetrische T-Wellen entstehen binnen Minuten durch subendokardiale Kalium-Freisetzung und verkürzte Aktionspotenzialdauer – ein kritisches STEMI-Äquivalent, das serielle EKGs alle 5–10 Min. erzwingt.'
                    }
                },
                {
                    id: 'n4a',
                    label: 'Territoriale ST-Hebung (J-Punkt ≥ 2 Abl.)',
                    category: 'diagnostics',
                    parent_id: 'n4',
                    relation_label: 'sichert Diagnose über Kriterium',
                    socratic_hint: 'Welche geschlechts- und altersabhängigen J-Punkt-Cutoffs in mindestens zwei anatomisch benachbarten Ableitungen definieren den STEMI?',
                    explanation: 'J-Punkt-ST-Hebung in ≥ 2 Nachbarableitungen: ≥ 0,1 mV (1 mm) in allen Ableitungen außer V2–V3; in V2–V3 gelten ≥ 0,25 mV (Männer < 40 J.), ≥ 0,2 mV (Männer ≥ 40 J.) und ≥ 0,15 mV (Frauen).',
                    mastery_question: {
                        question: 'Das 12-Kanal-EKG zeigt signifikante konvexe ST-Hebungen in II, III und aVF (ST-Hebung in III > II) sowie tiefe reziproke ST-Senkungen in I und aVL. Welches Koronargefäß ist mit höchster Spezifität verschlossen?',
                        options: [
                            'Rechte Koronararterie (RCA), wobei rechtspräkordiale Zusatzableitungen (V3r/V4r) zum Ausschluss eines RV-Infarkts zwingend abgeleitet werden müssen',
                            'Proximaler Ramus interventricularis anterior (RIVA/LAD) vor Abgang des ersten großen Septal- und Diagonalastes',
                            'Distaler Ramus circumflexus (RCX) bei einem ausgeprägten Linksversorgungstyp mit dominanter ST-Hebung in I, aVL und V6',
                            'Isolierter Verschluss der Vena cardiaca magna mit venöser Stauung der anterolateralen Papillarmuskulatur'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'II, III und aVF bilden die inferiore Wand ab. Wenn der Verletzungsvektor stärker nach rechts-unten (Ableitung III bei +120°) als nach links-unten (II bei +60°) weist, welches Gefäß liegt rechts?',
                        rationale: 'Bei inferiorem STEMI spricht ST-Hebung in III > II plus reziproke ST-Senkung in I/aVL hochspezifisch für einen RCA-Verschluss (statt RCX). Wegen möglicher RV-Beteiligung sind V3r/V4r obligat.'
                    }
                },
                {
                    id: 'n4a1',
                    label: 'Zusatzableitungen V7–V9 & V3r/V4r',
                    category: 'diagnostics',
                    parent_id: 'n4a',
                    relation_label: 'entlarvt blinde Wandzonen via',
                    socratic_hint: 'Welche speziellen Zusatzableitungen sind bei ST-Senkungen in V1–V3 bzw. bei jedem inferioren STEMI zwingend erforderlich?',
                    explanation: 'V7–V9 (Cutoff ≥ 0,05 mV; ≥ 0,1 mV bei Männern < 40 J.) sichern den streng posterioren Infarkt (reziproke ST-Senkung & hohes R in V1–V3); V3r/V4r (≥ 0,05 mV) sichern die RV-Beteiligung.',
                    mastery_question: {
                        question: 'Ein Patient präsentiert sich mit heftigen Thoraxschmerzen. Das Standard-12-Kanal-EKG zeigt keine ST-Hebungen, jedoch horizontale ST-Senkungen und auffallend hohe R-Zacken (R/S > 1) in V1–V3. Welche Sofortmaßnahme ist indiziert?',
                        options: [
                            'Unverzügliche Ableitung der posterioren Zusatzableitungen V7–V9 zum Nachweis eines streng posterioren STEMI (meist RCX-Verschluss)',
                            'Abwarten des 0h/3h-Verlaufs des hochsensitiven Troponins auf der Normalstation vor einer etwaigen Katheter-Aktivierung',
                            'Durchführung einer Belastungsergometrie zur Provokation klassischer anteriorer ST-Strecken-Hebungen in V4–V6',
                            'Entlassung mit der Diagnose einer harmlosen frühen Repolarisation, da isolierte ST-Senkungen in V1–V3 niemals transmural sind'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Drehe das EKG im Kopf um 180°: Was sind eine ST-Senkung und eine hohe R-Zacke von vorne (V1–V3) gesehen, wenn man von hinten (V7–V9) auf die Hinterwand blickt?',
                        rationale: 'ST-Senkungen mit prominenten R-Zacken (Spiegelbild von Q-Zacken) in V1–V3 sind das reziproke Bild eines streng posterioren transmuralen Infarkts. V7–V9 zeigen die direkte ST-Hebung und erzwingen eine Notfall-PCI.'
                    }
                },
                {
                    id: 'n4a2',
                    label: 'LSB-Diagnostik (Mod. Sgarbossa-Kriterien)',
                    category: 'diagnostics',
                    parent_id: 'n4a',
                    relation_label: 'überwindet Block-Maskierung durch',
                    socratic_hint: 'Wie erkennst du eine akute Koronarokklusion im EKG, wenn ein vorbestehender oder neuer Linksschenkelblock (LSB) die Repolarisation verzerrt?',
                    explanation: 'Beim LSB sind diskordante ST-Veränderungen normal. Konkordante ST-Hebungen ≥ 1 mm, konkordante ST-Senkungen ≥ 1 mm in V1–V3 oder exzessive Diskordanz (ST/S-Ratio ≤ -0,25 nach Smith) beweisen die Okklusion.',
                    mastery_question: {
                        question: 'Ein Patient mit akutem Vernichtungsschmerz hat im EKG einen Linksschenkelblock (QRS 148 ms). Welcher EKG-Befund erfüllt nach den modifizierten Sgarbossa-Kriterien (Smith) mit höchster Spezifität die Indikation zur sofortigen Notfall-PCI?',
                        options: [
                            'Konkordante ST-Hebung ≥ 1 mm in Ableitungen mit positivem QRS-Komplex oder eine exzessiv diskordante ST-Hebung mit ST/S-Verhältnis ≥ 25 %',
                            'Physiologisch diskordante ST-Hebung von 2 mm bei einer 25 mm tiefen S-Zacke in V2 (ST/S-Verhältnis 8 %) ohne jegliche Konkordanz',
                            'Isolierte Verbreiterung der P-Welle (> 120 ms) bei normaler diskordanter T-Wellen-Negativierung in Ableitung I und aVL',
                            'Vollständiges Fehlen von R-Zacken in V1 bei typischer linksanteriorer Achsendrehung ohne dynamische ST-Veränderungen'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Beim unkomplizierten LSB zeigt die ST-Strecke immer GEGEN den Hauptausschlag des QRS (Diskordanz). Wann ist eine ST-Abweichung hochpathologisch?',
                        rationale: 'Konkordante ST-Hebung ≥ 1 mm (in die gleiche Richtung wie ein positiver QRS), konkordante ST-Senkung ≥ 1 mm in V1–V3 oder eine überproportionale Diskordanz (ST-Hebung ≥ 25 % der vorangehenden S-Zacke) sind hochspezifisch für einen akuten Koronarverschluss.'
                    }
                },

                // --- AST 5: THERAPIE ---
                {
                    id: 'n5',
                    label: 'Primäre PCI (< 60–90 Min. / max. 120 Min.)',
                    category: 'therapy',
                    parent_id: 'root',
                    relation_label: 'Kausale Reperfusionsstrategie',
                    socratic_hint: 'Welche kausale Akutmaßnahme eröffnet das okkludierte Gefäß mechanisch mit der höchsten TIMI-III-Rate, und welche maximale Zeitgrenze ab STEMI-Diagnose gilt laut ESC?',
                    explanation: 'Sofortige primäre PCI mit Drug-Eluting-Stent (bevorzugt radialer Zugang): < 60 Min. im PCI-Zentrum, < 90 Min. bei Transfer; absolutes Maximum ab STEMI-Diagnose bis Wire Crossing sind 120 Minuten.',
                    mastery_question: {
                        question: 'Welche Begleittherapie sollte im akuten unkomplizierten STEMI laut ESC-Leitlinie NICHT routinemäßig verabreicht werden, da sie keinen Überlebensvorteil bringt bzw. sogar schädlich (Vasokonstriktion/ROS) sein kann?',
                        options: [
                            'Routinemäßige Sauerstoffgabe bei normoxämischen Patienten mit einer peripheren Sauerstoffsättigung (SpO2) ≥ 90 %',
                            'Sofortige Gabe von Acetylsalicylsäure (150–300 mg oral oder 75–250 mg i.v.) unmittelbar nach klinischer Verdachtsdiagnose',
                            'Periprozedurale parenterale Antikoagulation (z. B. unfraktioniertes Heparin als Bolus) begleitend zur primären Koronarintervention',
                            'Kontinuierliches EKG-Monitoring mit Defibrillator-Bereitschaft zur sofortigen Erkennung von primärem Kammerflimmern'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Denke an die DETO2X-AMI-Studie: Was macht unnötig hochdosierter Sauerstoff (Hyperoxämie) mit den Koronargefäßen und freien Sauerstoffradikalen?',
                        rationale: 'Sauerstoff ist erst bei Hypoxämie (SpO2 < 90 %) indiziert! Bei SpO2 ≥ 90 % führt Hyperoxämie zu koronarer Vasokonstriktion, erhöhtem oxidativem Stress und keinem klinischen Nutzen (DETO2X-AMI).'
                    }
                },
                {
                    id: 'n5a',
                    label: 'Fibrinolyse-Weiche (wenn PCI > 120 Min.)',
                    category: 'therapy',
                    parent_id: 'n5',
                    relation_label: 'weicht bei Transferverzögerung aus auf',
                    socratic_hint: 'Wie gehst du leitliniengerecht vor, wenn der Patient in einem peripheren Spital ohne Katheterlabor liegt und der Transfer zur PCI > 120 Minuten dauern würde?',
                    explanation: 'Bei Symptombeginn < 12 h und erwarteter PCI-Verzögerung > 120 Min. ab Diagnose: sofortige Fibrinolyse (Tenecteplase/Alteplase binnen < 10 Min.) + sofortiger Transfer ins PCI-Zentrum (Rescue-PCI bei Misserfolg oder Routine-PCI nach 2–24 h).',
                    mastery_question: {
                        question: 'Ein 62-jähriger STEMI-Patient erhielt wegen einer Transferzeit von 160 Minuten vor 75 Minuten eine systemische Fibrinolyse (Tenecteplase). Im Kontroll-EKG sind die ST-Hebungen nur um 20 % rückläufig und der Patient klagt weiter über stärkste Schmerzen. Was ist jetzt zwingend indiziert?',
                        options: [
                            'Unverzügliche Rescue-PCI im Herzkatheterlabor wegen fehlgeschlagener Reperfusion (< 50 % ST-Strecken-Resolution nach 60–90 Min.)',
                            'Wiederholte Gabe der vollen Fibrinolyse-Dosis (Re-Lyse) bei Verzicht auf eine invasive Koronarangiographie',
                            'Elektive Koronarangiographie erst nach 48 Stunden, da nach jeder Fibrinolyse ein strenges zweitägiges Katheterverbot besteht',
                            'Umstellung auf eine alleinige orale Vitamin-K-Antagonisten-Therapie ohne begleitende Thrombozytenaggregationshemmung'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Woran misst man 60–90 Minuten nach einer Lyse den Reperfusionserfolg im EKG (ST-Resolution-Grenzwert), und wie heißt der rettende Notfalleingriff bei Versagen?',
                        rationale: 'Eine ST-Resolution < 50 % nach 60–90 Min. (oder anhaltende Ischämie/Instabilität) zeigt ein Lyseversagen an und erfordert eine sofortige Rescue-PCI (keine Re-Lyse wegen Blutungsrisiko).'
                    }
                },
                {
                    id: 'n5b',
                    label: 'DAPT (ASS + Prasugrel/Ticagrelor 12 Mo.)',
                    category: 'therapy',
                    parent_id: 'n5',
                    relation_label: 'sichert Stent-Offenheit durch',
                    socratic_hint: 'Welche duale Plättchenhemmung verhindert nach DES-Implantation die katastrophale akute Stentthrombose, und welche spezifischen Kontraindikationen gelten?',
                    explanation: 'ASS (lebenslang 100 mg/d) plus potenter P2Y12-Inhibitor (Prasugrel oder Ticagrelor statt Clopidogrel) für 12 Monate (bei hohem Blutungsrisiko Verkürzung möglich).',
                    mastery_question: {
                        question: 'Warum werden Prasugrel oder Ticagrelor beim STEMI mit PCI gegenüber Clopidogrel bevorzugt, und bei welcher Anamnese ist Prasugrel absolut kontraindiziert?',
                        options: [
                            'Schnellerer und konsistenterer Wirkungseintritt unabhängig von CYP2C19-Polymorphismen; Prasugrel ist bei Z.n. TIA/Schlaganfall absolut kontraindiziert',
                            'Sie hemmen zusätzlich direkt den Gerinnungsfaktor Xa im Plasma; Prasugrel ist ausschließlich bei einem Lebensalter unter 50 Jahren kontraindiziert',
                            'Clopidogrel wirkt nur intravenös mit einer Halbwertszeit von 5 Minuten; Prasugrel ist bei Vorliegen einer arteriellen Hypertonie kontraindiziert',
                            'Beide Substanzen aktivieren direkt Plasminogen; Prasugrel darf niemals zusammen mit niedrig dosierter Acetylsalicylsäure gegeben werden'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Clopidogrel benötigt eine zweistufige hepatische Aktivierung über CYP2C19. Welches zerebrovaskuläre Vorereignis schließt Prasugrel (TRITON-TIMI-38) strikt aus?',
                        rationale: 'Prasugrel und Ticagrelor vermeiden das CYP2C19-Non-Responder-Problem von Clopidogrel. Prasugrel hat eine absolute Kontraindikation bei Z.n. Schlaganfall/TIA (hohes intrakranielles Blutungsrisiko) und wird bei ≥ 75 J. oder < 60 kg nur zurückhaltend/dosisreduziert gegeben.'
                    }
                },
                {
                    id: 'n5b1',
                    label: 'Sekundärprophylaxe (LDL < 1,4 mmol/L, BB, ACEi)',
                    category: 'therapy',
                    parent_id: 'n5b',
                    relation_label: 'ergänzt langfristig zur Remodeling-Hemmung',
                    socratic_hint: 'Welche strengen Lipid-Zielwerte (ESC) und neurohumoralen Medikamente verhindern post-infarzielles Remodeling und Re-Infarkte?',
                    explanation: 'Hochintensives Statin (+ Ezetimib / PCSK9i) mit ESC-Ziel LDL-C < 1,4 mmol/L (< 55 mg/dL) UND ≥ 50 % Reduktion; ACE-Hemmer/ARB (bei LVEF ≤ 40 %, Hypertonie, Diabetes), Betablocker, MRA (bei LVEF ≤ 40 % + HI/DM).',
                    mastery_question: {
                        question: 'Ein 58-jähriger Patient weist 6 Wochen nach einem Vorderwand-STEMI unter maximal verträglicher Rosuvastatin-Therapie (40 mg/d) noch ein LDL-Cholesterin von 2,3 mmol/L (89 mg/dL) auf. Welches Vorgehen entspricht der aktuellen ESC-Leitlinie?',
                        options: [
                            'Eskalation der Lipidsenkung durch Kombination mit Ezetimib (und bei weiterem Verfehlen PCSK9-Inhibitor), da der Zielwert < 1,4 mmol/L (< 55 mg/dL) UND ≥ 50 % Reduktion beträgt',
                            'Belassen der unveränderten Monotherapie, da nach akutem Myokardinfarkt ein LDL-Zielwert unter 3,0 mmol/L (115 mg/dL) vollkommen ausreichend ist',
                            'Absetzen des Statins wegen mutmaßlicher Statin-Resistenz und ausschließliche Umstellung auf Omega-3-Fettsäuren in diätetischer Dosierung',
                            'Halbierung der Statindosis, da LDL-Werte unter 2,0 mmol/L nachweislich zu hämorrhagischen Myokardrupturen führen'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Patienten nach ACS gehören in die „Very High Risk“-Kategorie der ESC. Welcher strikte LDL-Zielwert (in mmol/L bzw. mg/dL) gilt hier?',
                        rationale: 'Nach ACS (Very High Risk) fordert die ESC sowohl LDL-C < 1,4 mmol/L (< 55 mg/dL) als auch ≥ 50 % Senkung vom Ausgangswert – stufenweise über Hochdosis-Statin → + Ezetimib → + PCSK9-Inhibitor/Inclisiran.'
                    }
                }
            ],
            cross_links: [
                {
                    id: 'cl_stemi_1',
                    from: 'n1a1',
                    to: 'n2',
                    label: 'Kappen-Erosion triggert Ruptur',
                    synthesis_question: {
                        question: 'Querverbindungs-Synthese (Ätiologie ➔ Pathophysiologie): Wie verbindet die hochintensive Statintherapie bereits früh nach einem STEMI die molekulare Plaque-Biologie mit dem Schutz vor einer erneuten akuten Ruptur?',
                        options: [
                            'Statine senken LDL-C massiv und wirken pleiotrop antiinflammatorisch (weniger Makrophagen/MMP-Aktivität), wodurch die fibröse Kappe dicker und stabiler wird',
                            'Statine lösen den frischen Fibrinthrombus innerhalb von 15 Minuten enzymatisch auf und ersetzen damit die primäre perkutane Koronarintervention',
                            'Statine blockieren irreversibel den P2Y12-Rezeptor auf Thrombozyten und machen eine duale Plättchenhemmung nach Stent-Implantation überflüssig',
                            'Statine induzieren eine gezielte Apoptose vaskulärer glatter Muskelzellen, damit die dünne fibröse Kappe rasch vollständig resorbiert wird'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Denke an den Effekt auf Lipidkern-Größe, Makrophagen-Entzündung und MMP-Aktivität in anderen, noch nicht rupturierten vulnerablen Plaques!',
                        rationale: 'Hochintensive Statine stabilisieren vulnerable Plaques im gesamten Koronarbaum (Delipidierung, Reduktion von Makrophagen/MMPs, Verdickung der fibrösen Kappe).'
                    }
                },
                {
                    id: 'cl_stemi_2',
                    from: 'n4a1',
                    to: 'n5',
                    label: 'RV-Infarkt (V4r): Nitrat-KI!',
                    synthesis_question: {
                        question: 'Querverbindungs-Synthese (Diagnostik ➔ Therapie): Im inferioren STEMI zeigt V4r eine ST-Hebung von 1,5 mm (RV-Infarkt); der Blutdruck liegt bei 88/54 mmHg bei klaren Lungen. Welche Akutmaßnahme wäre hier lebensgefährlich, und was ist stattdessen indiziert?',
                        options: [
                            'Nitrate und Schleifendiuretika sind strikt kontraindiziert (kritischer Vorlastverlust); stattdessen vorsichtige intravenöse Volumengabe zur Sicherung der RV-Füllung plus rasche PCI',
                            'Hochdosiertes Nitroglycerin i.v. kombiniert mit 80 mg Furosemid zur maximalen Senkung des zentralen Venendrucks vor der Katheteruntersuchung',
                            'Sofortige Gabe eines nicht-selektiven Betablockers i.v. zur Induktion einer reflektorischen Bradykardie unter 40/min',
                            'Verzicht auf jegliche Revaskularisation, da ein rechtsventrikulärer Infarkt das linksventrikuläre Herzzeitvolumen prinzipiell nicht beeinflusst'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Der ischämische rechte Ventrikel verliert seine Pumpkraft und wird extrem vorlastabhängig, um überhaupt noch Blut durch die Lungenstrombahn in den LV zu drücken!',
                        rationale: 'Bei RV-Infarkt führt venöses Pooling durch Nitrate oder Diuretika zum sofortigen Abfall des LV-Füllungsdrucks und zum kardiogenen Schock. Vorsichtige Volumengabe + rasche Reperfusion sind lebensrettend.'
                    }
                },
                {
                    id: 'cl_stemi_3',
                    from: 'n2b1',
                    to: 'n3b',
                    label: 'Ruptur → Killip IV Schock'
                }
            ],
            distractors: [
                {
                    id: 'd_stemi_1',
                    label: 'Diffuse konkave ST-Hebung + PR-Senkung',
                    category: 'diagnostics',
                    distractor_reason: 'Differenzialdiagnose-Falle: Diffuse konkave („sattelförmige“) ST-Hebungen über mehrere Koronarterritorien mit PR-Senkung sind klassisch für eine akute Perikarditis – nicht für einen territorialen STEMI!'
                },
                {
                    id: 'd_stemi_2',
                    label: 'PCI-Indikation erst nach 0h/3h-hs-Troponin',
                    category: 'diagnostics',
                    distractor_reason: 'Schwerer Behandlungsfehler: Beim STEMI („Time is Muscle“) wird die Katheter-Aktivierung rein anhand Klinik + 12-Kanal-EKG gestellt. Auf Troponin zu warten kostet unwiederbringliches Myokard!'
                },
                {
                    id: 'd_stemi_3',
                    label: 'Nitrate i.v. + Diuretika bei RV-Infarkt (V4r+)',
                    category: 'therapy',
                    distractor_reason: 'Lebensgefährliche Kontraindikation: Der akut ischämische rechte Ventrikel ist streng vorlastabhängig. Nitrate/Diuretika stürzen den Patienten in den kardiogenen Schock!'
                },
                {
                    id: 'd_stemi_4',
                    label: 'Routinemäßige O2-Gabe bei SpO2 97 %',
                    category: 'therapy',
                    distractor_reason: 'Leitlinien-Falle (DETO2X-AMI): Ohne Hypoxämie (SpO2 < 90 %) führt überschüssiger Sauerstoff zu koronarer Vasokonstriktion und oxidativem Stress ohne Überlebensvorteil.'
                }
            ]
        },

        // ====================================================================
        // BUILT-IN 2: LAE (18 Knoten über 3 Ebenen, 3 Cross-Links, 4 Fallen)
        // ====================================================================
        {
            id: 'mm_pneumo_lae_001',
            schema_version: BUILTIN_SCHEMA_VERSION,
            title: 'Akute Lungenarterienembolie (LAE) – Deep Tree',
            specialty: 'Pneumologie / Notfallmedizin',
            central_concept: 'Lungenarterienembolie (LAE)',
            nodes: [
                // --- AST 1: ÄTIOLOGIE & RISIKO ---
                {
                    id: 'l1',
                    label: 'Tiefe Bein-/Beckenvenenthrombose (TVT)',
                    category: 'etiology',
                    parent_id: 'root',
                    relation_label: 'Kausale Emboliequelle (~90 %)',
                    socratic_hint: 'Aus welchem Gefäßbett stammt der eingeschwemmte Thrombus (Virchow-Trias: Stase, Endothelschaden, Hyperkoagulabilität) in rund 90 % aller Fälle?',
                    explanation: 'Rund 90 % aller LAE entstehen durch Abschwemmung eines Thrombus aus den tiefen proximalen Bein- oder Beckenvenen (V. poplitea, V. femoralis, V. iliaca).',
                    mastery_question: {
                        question: 'Welche Komponente der Virchow-Trias erklärt maßgeblich, warum venöse Thromben bevorzugt in den Klappentaschen der tiefen Beinvenen (statt im arteriellen Hochdrucksystem) entstehen?',
                        options: [
                            'Lokale venöse Stase mit wirbelarmer Hypoxie hinter den Venenklappen führt zur Endothelaktivierung und Bildung fibrinreicher „roter“ Gerinnungsthromben',
                            'Hohe arterielle Scherkräfte reißen die Venenklappen ab und erzeugen plättchenreiche „weiße“ Abscheidungsthromben ohne Fibrinbeteiligung',
                            'Erhöhter Sauerstoffpartialdruck im tiefen Venensystem oxidiert direkt Fibrinogen zu unlöslichen Kollagenfasern in den Klappentaschen',
                            'Physiologischer Rückfluss von Lymphflüssigkeit durch den Ductus thoracicus aktiviert Faktor XII unmittelbar in der Vena poplitea'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Vergleiche den venösen „roten“ Gerinnungsthrombus (Stase, Fibrin, Erythrozyten) mit dem arteriellen „weißen“ Abscheidungsthrombus (Scherkraft, Thrombozyten)!',
                        rationale: 'Stase in den Klappentaschen verursacht lokale Hypoxie, die Endothelzellen aktiviert (P-Selektin, vWF) und die plasmatische Gerinnungskaskade zur Bildung fibrin- und erythrozytenreicher Gerinnungsthromben anstößt.'
                    }
                },
                {
                    id: 'l1a',
                    label: 'Hereditäre Thrombophilie (Faktor-V-Leiden)',
                    category: 'etiology',
                    parent_id: 'l1',
                    relation_label: 'genetisch begünstigt durch',
                    socratic_hint: 'Welche häufigste angeborene Gerinnungsstörung verhindert die proteolytische Inaktivierung von Faktor Va durch aktiviertes Protein C?',
                    explanation: 'Die Faktor-V-Leiden-Mutation (Arg506Gln → APC-Resistenz) ist die häufigste hereditäre Thrombophilie, gefolgt von der Prothrombin-G20210A-Mutation sowie Protein-C/S- und Antithrombin-Mangel.',
                    mastery_question: {
                        question: 'Welcher molekulare Defekt charakterisiert die häufigste hereditäre Thrombophilie, die das Risiko für eine TVT und LAE signifikant erhöht?',
                        options: [
                            'Punktmutation im Faktor-V-Gen (Faktor-V-Leiden), die zur Resistenz gegenüber der proteolytischen Spaltung durch aktiviertes Protein C (APC-Resistenz) führt',
                            'Kompletter genetischer Mangel an von-Willebrand-Faktor mit konsekutiver Überaktivierung der primären thrombozytären Hämostase im venösen System',
                            'Autosomal-rezessive Überexpression von Gewebe-Plasminogenaktivator (t-PA) mit unkontrollierter Vernetzung von Fibrinmonomeren in den Beinvenen',
                            'Isolierte Defizienz von Gerinnungsfaktor VIII (Hämophilie A) mit paradoxer Hyperkoagulabilität bei postoperativer venöser Stase'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Welches physiologische Antikoagulans spaltet normalerweise Faktor Va und VIIIa, und warum funktioniert das bei dieser Punktmutation nicht mehr?',
                        rationale: 'Durch den Aminosäureaustausch Arg506Gln verliert Faktor Va seine bevorzugte Spaltstelle für aktiviertes Protein C (APC), sodass die Thrombinbildung verzögert abgeschaltet wird.'
                    }
                },
                {
                    id: 'l1b',
                    label: 'Erworbene Risiken (Malignom, OP, Östrogene)',
                    category: 'etiology',
                    parent_id: 'l1',
                    relation_label: 'getriggert durch starke/moderate Faktoren',
                    socratic_hint: 'Welche starken erworbenen Risikofaktoren (ESC: OR > 10 bzw. OR 2–9) provozieren venöse Thromboembolien – und wann gilt eine VTE als „unprovoziert“?',
                    explanation: 'Starke Trigger (OR > 10): Hüft-/Knie-TEP, großes Trauma, Fraktur der unteren Extremität. Moderate Trigger: aktive Malignome (Pankreas, Lunge, GI, Gehirn), orale Östrogene, Schwangerschaft/Wochenbett.',
                    mastery_question: {
                        question: 'Warum hat die exakte Unterscheidung zwischen einer durch einen starken transienten Risikofaktor (z. B. Hüft-TEP) provozierten LAE und einer unprovozierten LAE eine unmittelbare therapeutische Konsequenz?',
                        options: [
                            'Nach starkem transientem Trigger ist das Rezidivrisiko niedrig (< 3 %/Jahr → Absetzen der Antikoagulation nach 3 Monaten), bei unprovozierter LAE deutlich höher (Erwägung einer verlängerten Sekundärprophylaxe)',
                            'Bei einer provozierten LAE nach Operation ist jegliche Antikoagulation grundsätzlich kontraindiziert, weshalb ausschließlich Kompressionsstrümpfe verordnet werden',
                            'Eine unprovozierte LAE heilt spontan innerhalb von 14 Tagen ab und benötigt lediglich eine zweiwöchige Kurzzeit-Antikoagulation',
                            'Nur bei einer durch Flugreisen provozierten LAE besteht eine zwingende Indikation zur lebenslangen systemischen Fibrinolyse'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Vergleiche das langfristige Rezidivrisiko nach Wegfall eines einmaligen OP-Triggers mit einer LAE „aus heiterem Himmel“!',
                        rationale: 'Die ESC-Leitlinie steuert die Antikoagulationsdauer über das Rezidivrisiko: Starke transiente Faktoren (OP/Trauma) → 3 Monate reichen i. d. R. aus; unprovozierte LAE oder persistierende Faktoren (Malignom/APS) → verlängerte Therapie über > 3 Monate erwägen.'
                    }
                },

                // --- AST 2: PATHOPHYSIOLOGIE ---
                {
                    id: 'l2',
                    label: 'Abrupter RV-Nachlastanstieg (Cor pulmonale)',
                    category: 'pathophysiology',
                    parent_id: 'root',
                    relation_label: 'Hämodynamische Primärfolge',
                    socratic_hint: 'Welche dünnwandige Herzkammer (3–4 mm) wird durch den plötzlichen Anstieg des pulmonalvaskulären Widerstands (PVR) akut überlastet?',
                    explanation: 'Ab ~30–50 % Verlegung der Lungenstrombahn steigt der pulmonalarterielle Druck (mPAP) abrupt an. Der an niedrige Drücke adaptierte rechte Ventrikel dilatiert akut (kann akut kaum > 40 mmHg mPAP aufbauen).',
                    mastery_question: {
                        question: 'Warum toleriert der rechte Ventrikel bei einer akuten LAE einen plötzlichen Druckanstieg (mPAP > 40 mmHg) deutlich schlechter als bei einer chronisch-thromboembolischen pulmonalen Hypertonie (CTEPH)?',
                        options: [
                            'Der normale RV ist dünnwandig (3–4 mm) und auf Volumen- statt Druckarbeit ausgelegt; ohne monatelange konzentrische Hypertrophie führt akute Nachlaststeigerung sofort zur Dilatation und zum Pumpversagen',
                            'Bei einer chronischen CTEPH übernimmt der linke Ventrikel über das Foramen ovale vollständig die Pumparbeit für den Lungenkreislauf',
                            'Der rechte Ventrikel besitzt bei einer akuten LAE keine sympathische Innervation und kann seine Kontraktilität erst nach mehreren Wochen steigern',
                            'Bei einer chronischen pulmonalen Hypertonie lösen sich die Pulmonalklappen auf, sodass der Blutfluss passiv ohne ventrikuläre Druckarbeit erfolgt'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Denke an die Wanddicke und die Anpassungszeit des Myokards (Laplace-Gesetz: Wandspannung = Druck × Radius / 2 × Wanddicke)!',
                        rationale: 'Ein nicht-hypertrophierter RV kann akut kaum einen mPAP > 40 mmHg generieren. Findet man im Echo bei akuter LAE einen sPAP > 60 mmHg, spricht dies stark für eine bereits vorbestehende chronische pulmonale Hypertonie / CTEPH.'
                    }
                },
                {
                    id: 'l2a',
                    label: 'Vasokonstriktion (TXA2 / Euler-Liljestrand)',
                    category: 'pathophysiology',
                    parent_id: 'l2',
                    relation_label: 'verstärkt PVR biochemisch über',
                    socratic_hint: 'Welche vasoaktiven Mediatoren aus dem Thrombus und welcher physiologische Lungenreflex treiben den Gefäßwiderstand weit über die rein mechanische Verlegung hinaus?',
                    explanation: 'Aktivierte Thrombozyten setzen Thromboxan A2 und Serotonin frei; zusätzlich verengt der Euler-Liljestrand-Reflex (hypoxische pulmonale Vasokonstriktion) die Arteriolen → massiver PVR-Anstieg.',
                    mastery_question: {
                        question: 'Warum steigt der pulmonalvaskuläre Widerstand (PVR) bei einer akuten LAE oft wesentlich stärker an, als es die rein mechanische Verlegung durch den Embolus allein erklären würde?',
                        options: [
                            'Zusätzliche Freisetzung potenter Vasokonstriktoren (Thromboxan A2, Serotonin) aus aktivierten Thrombozyten sowie hypoxische pulmonale Vasokonstriktion (Euler-Liljestrand)',
                            'Gleichzeitiger spastischer Verschluss der Lungenvenen durch eine parasympathische Vagus-Überaktivierung im linken Vorhof',
                            'Sofortige kompensatorische Verdickung (konzentrische Hypertrophie) der Media aller Pulmonalarterien innerhalb weniger Minuten nach Embolisation',
                            'Abrupter Anstieg der Blutviskosität auf das Dreifache durch akute osmotische Hämokonzentration in den Alveolarkapillaren'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Kombiniere zwei Verstärker: Botenstoffe aus den Thrombozyten des Embolus + reflektorische Gefäßantwort der Lunge auf Hypoxie!',
                        rationale: 'Mechanische Obstruktion + Thromboxan A2/Serotonin/Endothelin-1 + hypoxische Vasokonstriktion summieren sich zu einem abrupten PVR-Sprung, der den RV überfordert.'
                    }
                },
                {
                    id: 'l2b',
                    label: 'Septumshift (D-Sign) & Obstruktiver Schock',
                    category: 'pathophysiology',
                    parent_id: 'l2',
                    relation_label: 'komprimiert LV (Ventrikel-Interdependenz)',
                    socratic_hint: 'Was passiert im starren Perikardbeutel mit der Füllung des linken Ventrikels, wenn der rechte Ventrikel massiv dilatiert und das Septum nach links drückt?',
                    explanation: 'Der akut dilatierte RV wölbt das interventrikuläre Septum nach links (D-Shaping im Echo), behindert die diastolische LV-Füllung und senkt das Herzzeitvolumen drastisch → obstruktiver Schock (RRsys < 90 mmHg).',
                    mastery_question: {
                        question: 'Welches hämodynamische Risiko entsteht, wenn man einen Patienten im obstruktiven Schock bei akuter High-Risk-LAE unkritisch mit großen Mengen kristalloider Volumenboli (> 2000 mL) behandelt?',
                        options: [
                            'Weitere Überdehnung des bereits dilatierten RV verstärkt den Septumshift nach links, komprimiert den LV noch stärker und verschlechtert den kardiogenen Schock',
                            'Die Volumengabe senkt den pulmonalarteriellen Widerstand sofort auf Normalwerte und löst den Embolus hydrostatisch auf',
                            'Das Volumen fließt bevorzugt direkt über die Bronchialarterien in den linken Ventrikel und umgeht den rechten Ventrikel vollständig',
                            'Hochvolumige Kristalloide bewirken eine sofortige Vasodilatation der rechten Koronararterie und beenden die RV-Ischämie dauerhaft'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Stell dir den RV auf dem absteigenden Schenkel der Frank-Starling-Kurve im engen Herzbeutel vor: Was passiert, wenn du ihn noch praller füllst?',
                        rationale: 'Nur vorsichtige kleine Volumenboli (≤ 500 mL bei niedrigem ZVD) sind erlaubt; exzessives Volumen überdehnt den RV (Wandspannung ↑), verstärkt das D-Shaping und verschlechtert das HZV (Vasopressor der Wahl: Noradrenalin!).'
                    }
                },
                {
                    id: 'l2b1',
                    label: 'RV-Ischämie-Spirale (RCA-Perfusionsabfall)',
                    category: 'pathophysiology',
                    parent_id: 'l2b',
                    relation_label: 'eskaliert fatal über',
                    socratic_hint: 'Warum gerät der rechte Ventrikel im obstruktiven Schock trotz völlig unauffälliger Koronararterien in eine tödliche myokardiale Ischämie?',
                    explanation: 'Gleichzeitig steigt der intramurale RV-Wanddruck (O2-Bedarf ↑) und fällt der systemische Aortendruck (Koronarperfusionsdruck = RR_Aorta - P_RV ↓) → akute RV-Ischämie → Herz-Kreislauf-Stillstand.',
                    mastery_question: {
                        question: 'Warum verbessert Noradrenalin (statt reiner Volumengabe oder Dobutamin-Monotherapie) die Hämodynamik in der tödlichen „RV-Ischämie-Spirale“ bei High-Risk-LAE entscheidend?',
                        options: [
                            'Es steigert über α1-Vasokonstriktion den systemischen Aortendruck (stellt den Perfusionsdruck der RCA wieder her) und erhöht über β1-Wirkung die RV-Inotropie ohne massive Tachykardie',
                            'Es senkt den systemischen Blutdruck maximal ab, damit der linke Ventrikel gegen einen geringeren Widerstand auswerfen kann',
                            'Es wirkt selektiv fibrinolytisch an den Pulmonalarterien und ersetzt bei hämodynamischem Schock die Gabe von Alteplase',
                            'Es induziert über α2-Rezeptoren eine tiefe Bradykardie unter 40/min, um das Herzzeitvolumen auf das Minimum zu drosseln'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Der Koronarperfusionsdruck des rechten Ventrikels ergibt sich aus der Differenz zwischen Aortendruck und RV-Druck. Wie rettest du diesen Gradienten pharmakologisch?',
                        rationale: 'Noradrenalin hebt den mittleren arteriellen Druck (MAP) an, verbessert dadurch unmittelbar die Perfusion der rechten Koronararterie (durchbricht die RV-Ischämie) und stützt zusätzlich die RV-Kontraktilität.'
                    }
                },

                // --- AST 3: KLINIK & SYMPTOME ---
                {
                    id: 'l3',
                    label: 'Akute Dyspnoe, Tachypnoe & Pleuraschmerz',
                    category: 'clinical',
                    parent_id: 'root',
                    relation_label: 'Klinische Initialtrias',
                    socratic_hint: 'Welche Leitsymptome entstehen akut durch funktionelle Totraumventilation, V/Q-Mismatch und periphere pleurale Reizung?',
                    explanation: 'Plötzliche Dyspnoe (häufigstes Symptom), Tachypnoe (> 20/min), Sinustachykardie und atemabhängiger pleuritischer Thoraxschmerz.',
                    mastery_question: {
                        question: 'Durch welchen Atemmechanismus entsteht bei einer akuten LAE eine ausgeprägte funktionelle Totraumventilation?',
                        options: [
                            'Alveolen distal des embolischen Gefäßverschlusses werden weiterhin belüftet (V > 0), aber nicht mehr durchblutet (Q ≈ 0 → V/Q → ∞)',
                            'Der Embolus verlegt mechanisch die Hauptbronchien, sodass das Lungengewebe durchblutet (Q > 0), aber nicht mehr belüftet wird (V = 0)',
                            'Die Lungenembolie zerstört binnen Sekunden den Surfactant in der gesamten kontralateralen Lunge, was zum kompletten Bronchospasmus führt',
                            'Durch den akuten Zwerchfellhochstand vergrößert sich das anatomische Volumen von Trachea und Nasopharynx auf das Dreifache'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Definiere „alveolärer Totraum“ anhand des Ventilations-Perfusions-Verhältnisses (V/Q): Was fehlt im infarzierten Lungenareal – Luft oder Blut?',
                        rationale: 'Belüftete, aber nicht perfundierte Alveolen nehmen nicht am Gasaustausch teil (alveolärer Totraum, V/Q = ∞), während umverteiltes Blut in überperfundierten Arealen ein niedriges V/Q (Hypoxämie) erzeugt.'
                    }
                },
                {
                    id: 'l3a',
                    label: 'BGA: Hypoxämie + Hypokapnie (AaDO2 ↑)',
                    category: 'clinical',
                    parent_id: 'l3',
                    relation_label: 'objektiviert Gasaustauschstörung als',
                    socratic_hint: 'Wie verändern sich paO2, paCO2, pH und die alveolo-arterielle Sauerstoffdruckdifferenz (AaDO2) typischerweise bei einer mittelschweren akuten LAE?',
                    explanation: 'Durch V/Q-Mismatch und Shunts sinkt der paO2 (erhöhte AaDO2), während die reflektorische Hyperventilation vermehrt das extrem diffusionsfähige CO2 abatmet → Hypokapnie + respiratorische Alkalose.',
                    mastery_question: {
                        question: 'Welche arterielle Blutgasanalyse (BGA) ist typisch für eine akute, mittelschwere Lungenarterienembolie (und schließt eine völlig normale BGA eine LAE sicher aus)?',
                        options: [
                            'Hypoxämie (paO2 ↓) mit Hypokapnie (paCO2 ↓), respiratorischer Alkalose und erhöhter AaDO2; eine normale BGA schließt eine LAE jedoch NICHT aus',
                            'Schwere Hyperkapnie (paCO2 > 65 mmHg) mit normalem paO2 und normaler AaDO2; eine normale BGA schließt jede relevante LAE zu 100 % aus',
                            'Isolierte metabolische Alkalose mit Hyperoxämie (paO2 > 140 mmHg) durch gesteigerte Sauerstoffbindung an venöses Hämoglobin',
                            'Respiratorische Azidose mit kompensatorischem Bikarbonat-Abfall, die immer beweisend für eine periphere Subsegment-Embolie ist'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'CO2 diffundiert 20× besser als O2 – was bewirkt Tachypnoe beim paCO2? Und Vorsicht: Wie hoch ist der Anteil an LAE-Patienten mit unauffälliger BGA (~20–30 %)?',
                        rationale: 'Typisch sind Hypoxämie, Hypokapnie (respiratorische Alkalose) und erhöhte AaDO2. Wichtig für die Klinik: Bis zu 20–30 % der Patienten (v. a. junge, kardiopulmonal gesunde) haben anfangs eine normale BGA!'
                    }
                },
                {
                    id: 'l3b',
                    label: 'Synkope (zentral) vs. Hämoptysen (Infarkt)',
                    category: 'clinical',
                    parent_id: 'l3',
                    relation_label: 'differenziert Lokalisation klinisch in',
                    socratic_hint: 'Wofür spricht eine initiale Synkope im Gegensatz zu pleuritischen Schmerzen mit blutigem Auswurf (Hämoptysen)?',
                    explanation: 'Eine Synkope weist auf eine hämodynamisch relevante zentrale LAE (kurzzeitiger HZV-Abfall / Arrhythmie) hin; Hämoptysen + Pleuraschmerz sprechen für periphere Emboli mit hämorrhagischem Lungeninfarkt.',
                    mastery_question: {
                        question: 'Warum entwickelt sich ein echter hämorrhagischer Lungeninfarkt (mit Pleuraschmerz und Hämoptysen) typischerweise eher bei kleinen, peripheren Embolien als bei isolierten zentralen Embolien?',
                        options: [
                            'Periphere Emboli blockieren Endäste nahe der Pleura, wo der Kollateralfluss über Bronchialarterien (Vasa privata) zur Gewebeversorgung nicht mehr ausreicht bzw. ins ischämische Areal einblutet',
                            'Zentrale Emboli im Pulmonalishauptstamm enthalten ausschließlich Luftblasen und können niemals ein Lungenparenchym schädigen',
                            'Nur periphere Lungenabschnitte besitzen eine doppelte Blutversorgung, während der Lungenhilus überhaupt keine Bronchialarterien aufweist',
                            'Hämoptysen entstehen bei der LAE ausschließlich durch Ruptur der Ösophagusvarizen infolge eines zentralen Druckanstiegs'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Erinnere dich an die duale Gefäßversorgung der Lunge (Pulmonalarterien = Vasa publica + Bronchialarterien = Vasa privata)!',
                        rationale: 'Durch die duale Versorgung bleibt das Lungenparenchym oft vital. Erst bei peripheren Embolien (insb. bei Linksherzinsuffizienz/venöser Stauung) kommt es zur lokalen Nekrose mit Einblutung über die Bronchialarterien (hämorrhagischer Infarkt).'
                    }
                },

                // --- AST 4: DIAGNOSTIK ---
                {
                    id: 'l4',
                    label: 'Vortestwahrscheinlichkeit (Wells/Geneva) & sPESI',
                    category: 'diagnostics',
                    parent_id: 'root',
                    relation_label: 'Strukturierter Diagnose- & Risiko-Start',
                    socratic_hint: 'Welche validierten klinischen Scores steuern vor jeder Bildgebung den Diagnosepfad (Vortestwahrscheinlichkeit) bzw. nach Diagnose die Prognose-Einschätzung (30-Tage-Mortalität)?',
                    explanation: 'Wells- oder revidierter Geneva-Score bestimmen die klinische Vortestwahrscheinlichkeit (niedrig/mittel vs. hoch). Nach bestätigter LAE trennt der sPESI (0 vs. ≥ 1 Punkt) Low-Risk von Intermediate-Risk.',
                    mastery_question: {
                        question: 'Ein 54-jähriger hämodynamisch stabiler Patient mit gesicherter LAE (ohne Malignom, ohne Herz-/Lungenvorerkrankung) hat eine HF von 88/min, RR 126/78 mmHg und SpO2 96 %. Sein sPESI beträgt 0 Punkte, im Echo besteht keine RV-Dysfunktion. Welche Risikokategorie (ESC) liegt vor?',
                        options: [
                            'Low-Risk-LAE (30-Tage-Mortalität < 1 %): frühe Entlassung bzw. ambulante Therapie unter therapeutischer DOAK-Gabe kann erwogen werden',
                            'High-Risk-LAE: sofortige Aufnahme auf die Intensivstation mit systemischer Alteplase-Thrombolyse innerhalb von 30 Minuten',
                            'Intermediate-High-Risk-LAE: zwingende kontinuierliche Überwachung auf der Intensivstation für mindestens 7 Tage unter UFH i.v.',
                            'Kein Behandlungsbedarf: bei einem sPESI von 0 Punkten darf auf jegliche Antikoagulation vollständig verzichtet werden'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Prüfe die 6 Parameter des sPESI (Alter > 80, Malignom, chron. Herz-/Lungenerkrankung, HF ≥ 110, RRsys < 100, SpO2 < 90 %). Was bedeutet sPESI = 0 + normales Echo?',
                        rationale: 'sPESI = 0 Punkte ohne RV-Dysfunktion definiert eine Low-Risk-LAE (Mortalität < 1 %). Bei geeigneter sozialer Versorgung ist eine frühe Entlassung/ambulante DOAK-Therapie (Hestia-Kriterien prüfen) möglich.'
                    }
                },
                {
                    id: 'l4a',
                    label: 'Altersadaptierte D-Dimere (Alter × 10 µg/L)',
                    category: 'diagnostics',
                    parent_id: 'l4',
                    relation_label: 'schließt LAE bei niedriger/mittl. Wkt. aus via',
                    socratic_hint: 'Wie nutzt man die extrem hohe Sensitivität der D-Dimere bei niedriger/mittlerer Vortestwahrscheinlichkeit, und welche Formel gilt ab dem 50. Lebensjahr?',
                    explanation: 'D-Dimere sind Fibrinspaltprodukte mit sehr hoher Sensitivität (> 95 %), aber niedriger Spezifität. Ab 50 Jahren gilt der altersadaptierte Cutoff (Alter × 10 µg/L) zum sicheren Ausschluss bei niedriger/mittlerer Vortestwahrscheinlichkeit.',
                    mastery_question: {
                        question: 'Ein 72-jähriger, hämodynamisch stabiler Patient hat einen niedrigen Wells-Score (1,5 Punkte). Sein D-Dimer-Wert beträgt 640 µg/L (Standard-Cutoff < 500 µg/L). Wie lautet die leitliniengerechte Konsequenz?',
                        options: [
                            'Durch Anwendung des altersadaptierten Cutoffs (Alter × 10 µg/L = 720 µg/L ab 50 J.) gilt der Test als negativ und schließt eine LAE ohne CTPA aus',
                            'Da 640 µg/L über dem starren Grenzwert von 500 µg/L liegt, ist die LAE bewiesen und eine sofortige systemische Lyse ohne Bildgebung Pflicht',
                            'Der altersadaptierte Cutoff beträgt Alter geteilt durch 2 (360 µg/L), weshalb zwingend eine sofortige V/Q-Szintigraphie erfolgen muss',
                            'D-Dimere haben eine Spezifität von 99 %, aber eine Sensitivität von nur 25 %, weshalb sie zum Ausschluss prinzipiell ungeeignet sind'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Berechne den altersadaptierten Grenzwert ab 50 Jahren (Alter × 10 µg/L) für einen 72-Jährigen und vergleiche ihn mit 640 µg/L!',
                        rationale: 'Bei Patienten > 50 J. steigert der altersadaptierte Cutoff (hier 720 µg/L) die Spezifität signifikant bei unverändert hoher Sicherheit (ADJUST-PE-Studie). 640 < 720 µg/L → LAE ausgeschlossen, keine CTPA nötig.'
                    }
                },
                {
                    id: 'l4b',
                    label: 'CT-Pulmonalisangiographie (CTPA) / V/Q-Scan',
                    category: 'diagnostics',
                    parent_id: 'l4',
                    relation_label: 'sichert Embolus bildgebend durch',
                    socratic_hint: 'Welche Bildgebung ist der diagnostische Goldstandard bei hoher Vortestwahrscheinlichkeit oder positiven D-Dimeren, und wann weicht man auf Alternativen aus?',
                    explanation: 'Die kontrastmittelgestützte CTPA weist intraluminale Füllungsdefekte direkt bis auf Subsegmentebene nach. Bei schwerer Kontrastmittelallergie, fortgeschrittener Niereninsuffizienz oder Schwangerschaft (bei normalem Röntgen-Thorax) ist die V/Q-Szintigraphie eine wichtige Alternative.',
                    mastery_question: {
                        question: 'Eine 29-jährige Schwangere (26. SSW) stellt sich mit akuter Dyspnoe und einseitiger schmerzhafter Wadenschwellung vor. Welche strahlen- und kontrastmittelschonende Diagnostik sollte als ALLERERSTES durchgeführt werden?',
                        options: [
                            'Bilaterale Kompressionssonographie (KUS) der Beinvenen: Der Nachweis einer proximalen TVT rechtfertigt sofort die therapeutische Antikoagulation ohne thorakale Strahlenexposition',
                            'Sofortige hochauflösende CT-Pulmonalisangiographie ohne vorherige Untersuchung, da die Kompressionssonographie in der Schwangerschaft kontraindiziert ist',
                            'Ausschluss mittels unkorrigierter D-Dimere allein, da D-Dimere in der Schwangerschaft physiologisch auf Null absinken',
                            'Elektive konventionelle Pulmonalis-Katheterangiographie über die Vena femoralis als strahlenärmster Goldstandard'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Wenn die Patientin bereits klinische Zeichen einer TVT hat: Brauchst du zwingend eine CT-Bestrahlung des Brustkorbs/Fetus, wenn du den Thrombus per Ultraschall im Bein sicher nachweist?',
                        rationale: 'Bei Schwangeren mit LAE-Verdacht und TVT-Symptomen ist die Kompressionssonographie der erste Schritt: Ein positiver proximaler TVT-Befund etabliert die Diagnose VTE und die Therapieindikation ohne Strahlung/Kontrastmittel.'
                    }
                },
                {
                    id: 'l4b1',
                    label: 'RV-Dysfunktion (Echo McConnell, hs-TnT, BNP)',
                    category: 'diagnostics',
                    parent_id: 'l4b',
                    relation_label: 'stratifiziert Intermediate-High-Risk über',
                    socratic_hint: 'Welche Kombination aus Bildgebung (Echo/CT: RV/LV-Ratio, McConnell-Zeichen) und Biomarkern identifiziert hämodynamisch noch normotensive Patienten mit drohender Dekompensation?',
                    explanation: 'Bei normotensiven Patienten mit sPESI ≥ 1 trennen Zeichen der RV-Dysfunktion (Echo: RV/LV > 1,0, D-Sign, McConnell-Sign = Hypokinesie der freien RV-Wand bei erhaltener Apex-Kontraktion) UND erhöhtes hs-Troponin Intermediate-High-Risk von Intermediate-Low-Risk.',
                    mastery_question: {
                        question: 'Was beschreibt das echokardiographische „McConnell-Zeichen“, das mit hoher Spezifität (wenn auch begrenzter Sensitivität) auf eine akute relevante Lungenarterienembolie hinweist?',
                        options: [
                            'Ausgeprägte Akinesie/Hypokinesie der freien mittleren Wand des rechten Ventrikels bei gleichzeitig erhaltener oder hyperkontraktiler Bewegung des RV-Apex',
                            'Systolische Vorwärtsbewegung des anterioren Mitralklappensegels (SAM-Phänomen) mit Obstruktion des linksventrikulären Ausflusstrakts',
                            'Kompletter diastolischer Kollaps des linken Vorhofs kombiniert mit einem ausgeprägten „Swinging Heart“ im großen Perikarderguss',
                            'Isolierte konzentrische Hypertrophie des linken Ventrikelseptums (> 18 mm) ohne jegliche Dilatation der rechten Herzhöhlen'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Welcher Teil des rechten Ventrikels steht bei akuter Drucküberlastung still, und welcher Teil wird vom kräftigen linken Ventrikel „mitgezogen“?',
                        rationale: 'Beim McConnell-Zeichen zeigt sich eine Hypo-/Akinesie der mittleren freien RV-Wand bei normaler/hyperdynamischer Bewegung der RV-Spitze (vermutlich durch Tethering an den hyperdynamischen LV-Apex).'
                    }
                },

                // --- AST 5: THERAPIE ---
                {
                    id: 'l5',
                    label: 'Risikoadaptierte Akuttherapie (ESC)',
                    category: 'therapy',
                    parent_id: 'root',
                    relation_label: 'Sofortige Weichenstellung nach Hämodynamik',
                    socratic_hint: 'Welches klinische Kriterium entscheidet sofort über „Antikoagulation allein“ versus „sofortige Reperfusion (Lyse/Thrombektomie)“?',
                    explanation: 'Bereits bei hohem/mittlerem Verdacht (noch vor Abschluss der Diagnostik!) wird die Antikoagulation eingeleitet. Hämodynamische Stabilität vs. Schock (RRsys < 90 mmHg) trennt Non-High-Risk von High-Risk.',
                    mastery_question: {
                        question: 'Ein normotensiver Patient hat eine gesicherte Intermediate-High-Risk-LAE (sPESI = 2, RV/LV-Ratio 1,3 im Echo, hs-Troponin deutlich erhöht, RR 118/74 mmHg). Welche primäre Therapiestrategie empfiehlt die ESC-Leitlinie (PEITHO-Studie)?',
                        options: [
                            'Therapeutische Antikoagulation (initial NMH oder UFH) unter engmaschigem hämodynamischem Monitoring (IMC/ICU) und Rescue-Reperfusion nur bei klinischer Dekompensation',
                            'Sofortige routinemäßige systemische Thrombolyse mit 100 mg Alteplase, da sie die Gesamtmortalität ohne erhöhtes Blutungsrisiko halbiert',
                            'Alleinige Gabe von Acetylsalicylsäure 100 mg/d und sofortige Entlassung nach Hause wegen fehlender arterieller Hypotonie',
                            'Unverzügliche chirurgische pulmonale Embolektomie an der Herz-Lungen-Maschine als Erstlinientherapie bei jedem normotensiven Patienten'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Erinnere dich an das Ergebnis der PEITHO-Studie (Tenecteplase bei Intermediate-High-Risk): War der Nutzen größer als das Risiko schwerer/intrakranieller Blutungen?',
                        rationale: 'In PEITHO verhinderte die primäre Lyse zwar Dekompensationen, erhöhte aber schwere (v. a. intrakranielle) Blutungen drastisch ohne Mortalitätsvorteil. Daher: Antikoagulation + engmaschige Überwachung + Rescue-Reperfusion erst bei Dekompensation.'
                    }
                },
                {
                    id: 'l5a',
                    label: 'Non-High-Risk: Antikoagulation (DOAK / NMH)',
                    category: 'therapy',
                    parent_id: 'l5',
                    relation_label: 'stoppt Thrombuswachstum bei Stabilität via',
                    socratic_hint: 'Welche Wirkstoffklassen sind Mittel der ersten Wahl bei stabiler LAE, und welche Substanzen erfordern eine 5-tägige parenterale Lead-in-Phase mit NMH?',
                    explanation: 'Direkte orale Antikoagulanzien (DOAK) sind gegenüber VKA bevorzugt (geringeres schweres Blutungsrisiko): Apixaban und Rivaroxaban als „Single-Drug“ sofort oral (höhere Startdosis); Dabigatran und Edoxaban benötigen ≥ 5 Tage parenterales NMH vorab.',
                    mastery_question: {
                        question: 'Welche beiden direkten oralen Antikoagulanzien (DOAK) dürfen bei einer akuten Non-High-Risk-LAE als „Single-Drug-Regime“ OHNE vorherige 5-tägige parenterale Heparin-Einleitung direkt oral gestartet werden?',
                        options: [
                            'Apixaban (initial 2× 10 mg/d für 7 Tage) und Rivaroxaban (initial 2× 15 mg/d für 21 Tage) mit anschließender Reduktion auf die Erhaltungsdosis',
                            'Dabigatran und Edoxaban, da beide Substanzen keinerlei parenterale Vorbehandlung mit niedermolekularem Heparin benötigen',
                            'Phenprocoumon und Warfarin, da Vitamin-K-Antagonisten bereits nach 30 Minuten ihre maximale antikoagulatorische Wirkung erreichen',
                            'Clopidogrel und Ticagrelor, da eine duale Thrombozytenaggregationshemmung die Standardtherapie der venösen Thromboembolie darstellt'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Unterscheide die beiden „Single-Drug“-Faktor-Xa-Hemmer (mit hoher initialer Aufsättigungsdosis) von Edoxaban und Dabigatran (die ein 5-tägiges NMH-Lead-in brauchen)!',
                        rationale: 'Apixaban (AMPLIFY) und Rivaroxaban (EINSTEIN-PE) wurden ohne parenterale Lead-in-Phase geprüft und starten direkt mit erhöhter oraler Dosis; Edoxaban und Dabigatran verlangen zuvor ≥ 5 Tage NMH/Fondaparinux.'
                    }
                },
                {
                    id: 'l5a1',
                    label: 'DOAK-KI (APS, Schwangerschaft, CrCl < 15)',
                    category: 'therapy',
                    parent_id: 'l5a',
                    relation_label: 'zwingt zu NMH / VKA bei',
                    socratic_hint: 'Bei welchen drei wichtigen Patientengruppen sind DOAKs kontraindiziert, sodass zwingend NMH oder ein Vitamin-K-Antagonist eingesetzt werden muss?',
                    explanation: 'DOAKs sind kontraindiziert bei schwerer Niereninsuffizienz (CrCl < 15 mL/min; Dabigatran < 30 mL/min), in Schwangerschaft/Stillzeit (plazentagängig → NMH!) und beim Antiphospholipid-Syndrom (insb. Triple-Positivität → VKA!).',
                    mastery_question: {
                        question: 'Bei welcher der folgenden Konstellationen sind direkte orale Antikoagulanzien (DOAK) zur Therapie einer LAE KONTRAINDIZIERT, sodass stattdessen ein Vitamin-K-Antagonist (VKA) bzw. Heparin eingesetzt werden muss?',
                        options: [
                            'Gesichertes Antiphospholipid-Syndrom (insb. Triple-Positivität), terminale Niereninsuffizienz (CrCl < 15 mL/min) sowie Schwangerschaft und Stillzeit',
                            'Alle Patienten über 65 Jahre mit arterieller Hypertonie und einer geschätzten glomerulären Filtrationsrate (eGFR) von 75 mL/min',
                            'Patienten mit einer unprovozierten tiefen Beinvenenthrombose nach einem Langstreckenflug ohne bekannte Autoimmunerkrankung',
                            'Patienten mit normotensiver Low-Risk-LAE, die im Aufnahmelabor ein normwertiges kardiales Troponin und NT-proBNP aufweisen'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Denke an die TRAPS-Studie (Autoantikörper-Thrombophilie), Plazentagängigkeit und renale Elimination!',
                        rationale: 'Beim Antiphospholipid-Syndrom (APS) zeigten DOAKs signifikant mehr (auch arterielle) Thromboembolien als VKA (TRAPS-Studie). In Schwangerschaft/Stillzeit ist NMH Mittel der Wahl (nicht plazentagängig).'
                    }
                },
                {
                    id: 'l5b',
                    label: 'High-Risk: Lyse (rt-PA) vs. Thrombektomie',
                    category: 'therapy',
                    parent_id: 'l5',
                    relation_label: 'rettet Leben im Schock durch',
                    socratic_hint: 'Welche Reperfusionstherapie ist bei High-Risk-LAE (Schock / RRsys < 90 mmHg) Erstlinie, und wie gehst du bei absoluten Lyse-Kontraindikationen vor?',
                    explanation: 'Bei High-Risk-LAE: sofortige systemische Thrombolyse (rt-PA / Alteplase 100 mg über 2 h) + UFH. Bei absoluten Lyse-KI (z. B. frische intrakranielle OP, aktive Blutung, hämorrhagischer Stroke) → chirurgische Embolektomie oder kathetergestützte Thrombektomie.',
                    mastery_question: {
                        question: 'Ein Patient erleidet eine High-Risk-LAE mit obstruktiven Schockzeichen (RR 74/42 mmHg), hatte jedoch vor 5 Tagen eine neurochirurgische intrakranielle Tumorresektion. Welche Reperfusionsstrategie ist indiziert?',
                        options: [
                            'Da eine absolute Kontraindikation gegen systemische Lyse besteht, ist eine kathetergestützte Thrombektomie oder chirurgische Embolektomie (plus UFH) indiziert',
                            'Trotz der frischen Hirnoperation muss sofort die volle systemische Dosis von 100 mg Alteplase (rt-PA) i.v. über 2 Stunden verabreicht werden',
                            'Alleinige orale Gabe eines Vitamin-K-Antagonisten (Phenprocoumon), da dieser den Schock innerhalb von 15 Minuten durchbricht',
                            'Aggressive Volumentherapie mit 4 Litern Elektrolytlösung ohne jegliche Antikoagulation oder mechanische Gefäßeröffnung'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Eine frische Hirn-OP verbietet systemisches rt-PA absolut (tödliche Hirnblutung). Wie entfernst du den zentralen Sattel-Embolus mechanisch?',
                        rationale: 'Bei High-Risk-LAE und absoluten Lyse-Kontraindikationen (oder nach erfolgloser Lyse) sieht die ESC-Leitlinie die chirurgische pulmonale Embolektomie oder perkutane kathetergestützte Verfahren (z. B. großlumige Aspirationsthrombektomie) vor.'
                    }
                }
            ],
            cross_links: [
                {
                    id: 'cl_lae_1',
                    from: 'l2b1',
                    to: 'l4b1',
                    label: 'RV-Ischämie → hs-TnT & BNP ↑',
                    synthesis_question: {
                        question: 'Querverbindungs-Synthese (Pathophysiologie ➔ Diagnostik): Warum ist ein erhöhtes hochsensitives Troponin bei einer akuten LAE prognostisch so bedeutsam, obwohl kein primärer Koronararterienverschluss vorliegt?',
                        options: [
                            'Es objektiviert die akute druckinduzierte rechtsventrikuläre Myokardschädigung (Typ-2-Ischämie durch Wandspannung ↑ und RCA-Perfusionsabfall) und definiert zusammen mit RV-Dilatation die Intermediate-High-Risk-Gruppe',
                            'Es beweist automatisch einen zeitgleichen kompletten thrombotischen Verschluss des proximalen RIVA (Typ-1-STEMI) und zwingt zur sofortigen Stent-Implantation',
                            'Es entsteht ausschließlich durch die Zersetzung des venösen Thrombus in der Pulmonalarterie und korreliert nicht mit der Sterblichkeit',
                            'Es zeigt eine vollständige Erholung des rechten Ventrikels an und erlaubt die sofortige Entlassung ohne Überwachung'
                        ],
                        correct_index: 0,
                        socratic_nudge: 'Verknüpfe Wandspannung + relativen O2-Mangel des RV mit der Freisetzung intrazellulärer Strukturproteine!',
                        rationale: 'Troponin-Freisetzung bei LAE spiegelt eine akute RV-Mikronekrose durch Missverhältnis zwischen massiv erhöhtem O2-Bedarf (Nachlast) und verminderter RCA-Perfusion wider – ein starker Prädiktor für frühe Dekompensation.'
                    }
                },
                {
                    id: 'cl_lae_2',
                    from: 'l2b',
                    to: 'l5b',
                    label: 'RRsys < 90 → High-Risk Reperfusion'
                },
                {
                    id: 'cl_lae_3',
                    from: 'l1b',
                    to: 'l5a',
                    label: 'Tumor-VTE: GI-Blutungsrisiko beachten'
                }
            ],
            distractors: [
                {
                    id: 'd_lae_1',
                    label: 'D-Dimere zum Ausschluss bei hohem Wells-Score',
                    category: 'diagnostics',
                    distractor_reason: 'Algorithmus-Falle: Bei hoher klinischer Vortestwahrscheinlichkeit (Wells > 6) reicht der negative prädiktive Wert der D-Dimere NICHT aus – hier muss direkt eine CTPA erfolgen!'
                },
                {
                    id: 'd_lae_2',
                    label: 'Aggressive Volumengabe (> 2000 mL) im RV-Versagen',
                    category: 'therapy',
                    distractor_reason: 'Pathophysiologische Falle: Exzessives Volumen überdehnt den dilatierten rechten Ventrikel, verstärkt das D-Shaping nach links und aggraviert den obstruktiven Schock!'
                },
                {
                    id: 'd_lae_3',
                    label: 'Primäre systemische Lyse bei normotensiver LAE',
                    category: 'therapy',
                    distractor_reason: 'Leitlinien-Falle (PEITHO-Studie): Bei normotensiven Patienten erhöht die routinemäßige Thrombolyse das Risiko schwerer/intrakranieller Blutungen drastisch ohne Mortalitätsvorteil!'
                },
                {
                    id: 'd_lae_4',
                    label: 'DOAK-Monotherapie bei Triple-positivem APS',
                    category: 'therapy',
                    distractor_reason: 'Kontraindikations-Falle (TRAPS-Studie): Beim Antiphospholipid-Syndrom versagen DOAKs gegenüber Vitamin-K-Antagonisten mit signifikant erhöhter Rate arterieller und venöser Thromboembolien!'
                }
            ]
        }
    ];

    const inFlightUserTermIds = new Set();

    const state = {
        initialized: false,
        initPromise: null,
        mindmaps: [],
        currentMap: null,
        viewMode: 'folders',                 // 'folders' (Ordner-Bibliothek) | 'canvas' (Aktive Mindmap)
        activeFolderId: null,                // null = Ordner-Übersicht, sonst ID des geöffneten Fachordners
        librarySearchQuery: '',              // Suche in der Ordner-/Mindmap-Bibliothek
        libraryFilterMode: 'all',            // 'all' | 'open' | 'weak'
        solvedNodeIds: new Set(),
        eliminatedDistractorIds: new Set(),  // Quarantänisierte / enttarnte Distraktoren
        uncertainNodeIds: new Set(),         // Metakognitiv als "Geraten/Unsicher" markierte Knoten
        collapsedNodeIds: new Set(),         // Eingeklappte gelöste Unterbäume für maximale Übersicht
        poolOrderIds: [],
        selectedChipId: null,
        hoveredNodeId: null,
        difficultyPreset: 'clinical',        // 'guided' | 'clinical' | 'exam'
        layoutMode: 'tree',                  // 'tree' (Bidirektionaler Tidy-Tree, Null-Überlappung) | 'radial'
        blindMode: false,
        strictCausalOrder: true,
        deepComprehensionMode: true,
        activeRecallFirstMode: false,
        includeDistractors: true,
        hideRelationLabels: false,           // Im Exam-Modus: Relation-Spoiler auf ungelösten Slots ausblenden
        showCrossLinks: true,
        showUserTerms: true,                 // V7.2: Eigene Zusatzbegriffe im Baum anzeigen
        openPopover: null,                   // V7.3: null | 'options' | 'more'
        blindRootMode: false,
        rootRevealed: false,
        showInspector: false,
        expandedCanvas: false,
        poolSearchQuery: '',
        mistakesCount: 0,
        streakCount: 0,
        maxStreak: 0,
        weakNodeIds: new Set(),
        synthesisCompleted: false,
        startTime: null,
        // Dynamische Geometrie & Topologie
        stageWidth: LAYOUT_CONFIG.MIN_STAGE_W,
        stageHeight: LAYOUT_CONFIG.MIN_STAGE_H,
        rootX: LAYOUT_CONFIG.MIN_STAGE_W / 2,
        rootY: LAYOUT_CONFIG.MIN_STAGE_H / 2,
        nodePositions: {},
        nodeMeta: {},                        // { [nodeId]: { depth, childrenIds, subtreeLeaves, side, branchRootId, isUserTerm } }
        maxTreeDepth: 1,
        progressCache: {},
        zoom: 0.65,
        panX: 0,
        panY: 0,
        isPanning: false
    };

    // ========================================================================
    // 1. INITIALISIERUNG, SCOPED CSS (V7.3 CLEAN STUDIO) & DOM-STRUKTUR
    // ========================================================================

    function safeParseJson(raw, fallback = null) {
        if (raw === null || raw === undefined) return fallback;
        if (typeof raw !== 'string') return raw;
        try {
            return JSON.parse(raw);
        } catch (_e) {
            return fallback;
        }
    }

    function safeStorageSet(key, value) {
        try {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            return true;
        } catch (err) {
            console.warn(`[Mindmap V7.3] localStorage Schreibfehler (${key}):`, err);
            return false;
        }
    }

    function closeOpenPopovers() {
        if (!state.openPopover) return;
        state.openPopover = null;
        document.querySelectorAll('.mm-popover-panel').forEach(p => p.classList.add('is-hidden'));
        document.querySelectorAll('[data-popover-trigger]').forEach(t => {
            t.classList.remove('is-active');
            t.setAttribute('aria-expanded', 'false');
        });
    }

    function ensureMindmapStyles() {
        if (document.getElementById('medcheck-mindmap-v73-styles')) return;
        ['medcheck-mindmap-v6-styles', 'medcheck-mindmap-v7-styles', 'medcheck-mindmap-v71-styles', 'medcheck-mindmap-v72-styles'].forEach(oldId => {
            const oldEl = document.getElementById(oldId);
            if (oldEl) oldEl.remove();
        });

        const styleEl = document.createElement('style');
        styleEl.id = 'medcheck-mindmap-v73-styles';
        styleEl.textContent = `
            /* === V7.3 CLEAN MINIMALIST STUDIO BAR & POPOVERS === */
            .mm-studio-chrome {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 12px;
            }
            .mm-studio-topbar {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                padding: 8px 12px;
                border-radius: 12px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.78));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.16));
                backdrop-filter: blur(12px);
            }
            .mm-progress-rail {
                position: absolute;
                left: 10px;
                right: 10px;
                bottom: 0;
                height: 2px;
                border-radius: 999px;
                background: rgba(148, 163, 184, 0.12);
                overflow: hidden;
                pointer-events: none;
            }
            .mm-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #38bdf8, #10b981);
                transition: width 0.28s ease;
            }
            .mm-studio-left,
            .mm-studio-right {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .mm-studio-left {
                flex: 1 1 280px;
                min-width: 0;
            }
            .mm-studio-select {
                flex: 1;
                min-width: 190px;
                max-width: 390px;
                height: 34px;
                padding: 0 28px 0 10px;
                border-radius: 8px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                background: var(--surface-primary, rgba(9, 13, 26, 0.75));
                color: var(--text-main, #f8fafc);
                font-size: 0.84rem;
                font-weight: 600;
                cursor: pointer;
                outline: none;
                text-overflow: ellipsis;
            }
            .mm-studio-select:focus {
                border-color: var(--accent-cyan, #38bdf8);
            }
            .mm-clean-btn {
                height: 34px;
                padding: 0 11px;
                border-radius: 8px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                background: transparent;
                color: var(--text-main, #e2e8f0);
                font-size: 0.8rem;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                white-space: nowrap;
                transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
            }
            .mm-clean-btn:hover {
                background: var(--surface-subtle, rgba(30, 41, 59, 0.75));
                border-color: rgba(148, 163, 184, 0.35);
            }
            .mm-clean-btn.is-active {
                background: rgba(56, 189, 248, 0.14);
                border-color: rgba(56, 189, 248, 0.45);
                color: #38bdf8;
            }
            .mm-clean-btn.is-primary {
                background: #2563eb;
                border-color: #3b82f6;
                color: #ffffff;
            }
            .mm-clean-btn.is-primary:hover {
                background: #1d4ed8;
            }
            .mm-clean-btn.is-icon-only {
                width: 34px;
                padding: 0;
                justify-content: center;
            }
            .mm-segmented {
                display: inline-flex;
                align-items: center;
                padding: 3px;
                border-radius: 9px;
                background: var(--surface-primary, rgba(9, 13, 26, 0.72));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.14));
                gap: 2px;
            }
            .mm-seg-btn {
                height: 28px;
                padding: 0 11px;
                border-radius: 6px;
                border: none;
                background: transparent;
                color: var(--text-muted, #94a3b8);
                font-size: 0.77rem;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.15s ease, color 0.15s ease;
            }
            .mm-seg-btn:hover {
                color: var(--text-main, #f8fafc);
            }
            .mm-seg-btn.active {
                background: var(--surface-subtle, rgba(51, 65, 85, 0.85));
                color: var(--text-main, #f8fafc);
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
            }

            /* Popover Container & Switches */
            .mm-popover-wrap {
                position: relative;
            }
            .mm-popover-panel {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                z-index: 1200;
                min-width: 285px;
                padding: 10px;
                border-radius: 12px;
                background: var(--surface-primary, #0b1120);
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.24));
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.48);
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .mm-popover-panel.is-compact {
                min-width: 225px;
            }
            .mm-popover-panel.is-hidden {
                display: none;
            }
            .mm-pop-section-title {
                padding: 6px 8px 3px;
                font-size: 0.67rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: var(--text-muted, #64748b);
            }
            .mm-pop-divider {
                height: 1px;
                margin: 4px 2px;
                background: rgba(148, 163, 184, 0.14);
            }
            .mm-switch-row {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 7px 8px;
                border-radius: 8px;
                border: none;
                background: transparent;
                color: var(--text-main, #e2e8f0);
                font-size: 0.8rem;
                font-weight: 500;
                text-align: left;
                cursor: pointer;
                transition: background 0.12s ease;
            }
            .mm-switch-row:hover {
                background: var(--surface-subtle, rgba(30, 41, 59, 0.72));
            }
            .mm-switch-row.is-danger {
                color: #f87171;
            }
            .mm-switch-row.is-danger:hover {
                background: rgba(239, 68, 68, 0.12);
            }
            .mm-switch-sub {
                font-size: 0.72rem;
                color: var(--text-muted, #64748b);
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            }
            .mm-toggle-track {
                width: 32px;
                height: 18px;
                border-radius: 999px;
                background: rgba(148, 163, 184, 0.26);
                position: relative;
                flex-shrink: 0;
                transition: background 0.16s ease;
            }
            .mm-toggle-track::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #e2e8f0;
                transition: transform 0.16s ease;
            }
            .mm-switch-row.is-on .mm-toggle-track {
                background: #38bdf8;
            }
            .mm-switch-row.is-on .mm-toggle-track::after {
                transform: translateX(14px);
                background: #0f172a;
            }

            /* Kompakte Telemetrie- & Kategorie-Leiste (Zeile 2) */
            .mm-studio-subbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                padding: 7px 12px;
                border-radius: 10px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.48));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.12));
            }
            .mm-clean-legend {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
            }
            .mm-cat-chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                height: 26px;
                padding: 0 4px 0 9px;
                border-radius: 999px;
                background: var(--surface-subtle, rgba(30, 41, 59, 0.55));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.14));
                font-size: 0.75rem;
                font-weight: 500;
                color: var(--text-main, #cbd5e1);
            }
            .mm-cat-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .mm-cat-add {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                border: none;
                background: transparent;
                color: var(--text-muted, #94a3b8);
                font-size: 0.85rem;
                line-height: 1;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: background 0.14s ease, color 0.14s ease;
            }
            .mm-cat-add:hover {
                background: rgba(56, 189, 248, 0.2);
                color: #38bdf8;
            }
            .mm-telemetry-group {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
                font-size: 0.76rem;
                color: var(--text-muted, #94a3b8);
            }
            .mm-telemetry-item {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-variant-numeric: tabular-nums;
            }
            .mm-telemetry-val {
                color: var(--text-main, #f1f5f9);
                font-weight: 700;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            }
            .mm-telemetry-val.is-warn {
                color: #f87171;
            }
            .mm-telemetry-val.is-good {
                color: #34d399;
            }
            .mm-tier-inline {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding-left: 10px;
                border-left: 1px solid rgba(148, 163, 184, 0.18);
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                font-size: 0.73rem;
            }
            .mm-tier-inline-item.is-done {
                color: #34d399;
                font-weight: 700;
            }
            .mm-drill-pill {
                height: 24px;
                padding: 0 9px;
                border-radius: 999px;
                border: 1px solid rgba(245, 158, 11, 0.45);
                background: rgba(245, 158, 11, 0.14);
                color: #fbbf24;
                font-size: 0.73rem;
                font-weight: 700;
                cursor: pointer;
            }
            .mm-drill-pill:hover {
                background: rgba(245, 158, 11, 0.24);
            }

            /* Legacy Preset Buttons (genutzt in Bibliotheks-Filter) */
            .mm-preset-btn {
                padding: 5px 11px;
                border-radius: 7px;
                font-size: 0.77rem;
                font-weight: 600;
                cursor: pointer;
                border: 1px solid var(--card-border, rgba(255, 255, 255, 0.12));
                background: transparent;
                color: var(--text-muted, #94a3b8);
                transition: all 0.15s ease;
            }
            .mm-preset-btn:hover {
                border-color: var(--accent-cyan, #38bdf8);
                color: var(--text-main, #f8fafc);
            }
            .mm-preset-btn.active {
                background: rgba(56, 189, 248, 0.16);
                border-color: rgba(56, 189, 248, 0.5);
                color: var(--text-main, #f8fafc);
            }

            /* Tier Badges */
            .mm-tier-pill {
                display: inline-flex;
                align-items: center;
                padding: 1px 6px;
                border-radius: 999px;
                font-size: 0.65rem;
                font-weight: 800;
                letter-spacing: 0.02em;
                text-transform: uppercase;
            }
            .mm-tier-pill.tier-1 { background: rgba(56, 189, 248, 0.16); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); }
            .mm-tier-pill.tier-2 { background: rgba(168, 85, 247, 0.16); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35); }
            .mm-tier-pill.tier-3 { background: rgba(245, 158, 11, 0.16); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
            .mm-tier-pill.tier-4 { background: rgba(239, 68, 68, 0.16); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }

            /* Pool Search & Quarantine Dropzone */
            .mm-pool-search-wrap {
                padding: 8px 10px 4px;
            }
            .mm-pool-search-input {
                width: 100%;
                padding: 7px 10px;
                border-radius: 8px;
                border: 1px solid var(--card-border, rgba(255, 255, 255, 0.14));
                background: var(--surface-primary, rgba(6, 9, 19, 0.75));
                color: var(--text-main, #f8fafc);
                font-size: 0.8rem;
                outline: none;
            }
            .mm-pool-search-input:focus {
                border-color: var(--accent-cyan, #38bdf8);
            }
            .mm-quarantine-zone {
                margin: 8px 10px 6px;
                padding: 9px 11px;
                border-radius: 10px;
                border: 1.5px dashed rgba(239, 68, 68, 0.48);
                background: rgba(239, 68, 68, 0.07);
                color: var(--text-main, #fca5a5);
                font-size: 0.77rem;
                transition: all 0.18s ease;
                cursor: pointer;
            }
            .mm-quarantine-zone:hover,
            .mm-quarantine-zone.drag-over-quarantine {
                background: rgba(239, 68, 68, 0.2);
                border-color: #ef4444;
                transform: scale(1.01);
            }
            .mm-quarantine-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-weight: 700;
                margin-bottom: 2px;
            }
            .mm-quarantine-sub {
                font-size: 0.72rem;
                color: var(--text-muted, #94a3b8);
                line-height: 1.35;
            }

            /* Node Enhancements */
            .mm-node-collapse-btn {
                position: absolute;
                right: -11px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 6;
                width: 24px;
                height: 24px;
                border-radius: 999px;
                border: 1px solid var(--accent-cyan, #38bdf8);
                background: var(--surface-primary, #0f172a);
                color: var(--text-main, #f8fafc);
                font-size: 0.72rem;
                font-weight: 900;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                transition: transform 0.15s ease, background 0.15s ease;
            }
            .mm-node-collapse-btn.side-left {
                right: auto;
                left: -11px;
            }
            .mm-node-collapse-btn:hover {
                transform: translateY(-50%) scale(1.15);
                background: var(--accent-cyan, #38bdf8);
                color: #0f172a;
            }
            .mm-node-uncertain-badge {
                display: inline-block;
                margin-left: 5px;
                padding: 1px 6px;
                border-radius: 999px;
                background: rgba(245, 158, 11, 0.2);
                border: 1px solid rgba(245, 158, 11, 0.45);
                color: #fbbf24;
                font-size: 0.64rem;
                font-weight: 700;
            }
            .mm-node-promoted-badge {
                display: inline-block;
                margin-left: 4px;
                padding: 1px 5px;
                border-radius: 999px;
                background: rgba(250, 204, 21, 0.14);
                border: 1px solid rgba(250, 204, 21, 0.45);
                color: #fde047;
                font-size: 0.63rem;
                font-weight: 700;
            }
            .mm-rel-hidden-pill {
                font-style: italic;
                opacity: 0.85;
                color: #fbbf24;
            }

            /* Cross-Links SVG & Synthesis */
            .mm-crosslink-path {
                fill: none;
                stroke: #f59e0b;
                stroke-width: 2.2;
                stroke-dasharray: 7 5;
                opacity: 0.72;
                transition: opacity 0.2s ease, stroke-width 0.2s ease;
                pointer-events: none;
            }
            .mm-crosslink-path.is-active {
                opacity: 1;
                stroke-width: 3.2;
            }
            .mm-crosslink-badge {
                position: absolute;
                transform: translate(-50%, -50%);
                padding: 3px 9px;
                border-radius: 999px;
                background: rgba(15, 23, 42, 0.94);
                border: 1px dashed #f59e0b;
                color: #fcd34d;
                font-size: 0.68rem;
                font-weight: 700;
                white-space: nowrap;
                z-index: 4;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
                transition: transform 0.15s ease;
            }
            .mm-crosslink-badge:hover {
                transform: translate(-50%, -50%) scale(1.06);
                background: rgba(245, 158, 11, 0.22);
            }

            /* Mastery Gate Modal & Confidence Bar */
            .mm-synapse-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 9999;
                background: rgba(15, 23, 42, 0.7);
                backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                animation: mmFadeIn 0.16s ease-out;
            }
            .mm-synapse-modal {
                width: 100%;
                max-width: 720px;
                max-height: 92vh;
                overflow-y: auto;
                background: var(--surface-primary, #0f172a);
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.28));
                border-radius: 16px;
                padding: 22px 24px;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.48);
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
                border: 1px dashed var(--accent-cyan, rgba(56, 189, 248, 0.35));
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
                font-weight: 700;
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
                margin-bottom: 12px;
            }
            .mm-confidence-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                flex-wrap: wrap;
                padding: 8px 12px;
                margin-bottom: 12px;
                border-radius: 10px;
                background: var(--surface-subtle, rgba(30, 41, 59, 0.55));
                border: 1px solid var(--card-border, rgba(255, 255, 255, 0.09));
                font-size: 0.77rem;
            }
            .mm-conf-btn {
                padding: 4px 10px;
                border-radius: 7px;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                border: 1px solid var(--card-border, rgba(255, 255, 255, 0.14));
                background: transparent;
                color: var(--text-muted, #94a3b8);
                transition: all 0.15s ease;
            }
            .mm-conf-btn.active-sure {
                background: rgba(16, 185, 129, 0.2);
                border-color: #10b981;
                color: #34d399;
            }
            .mm-conf-btn.active-unsure {
                background: rgba(245, 158, 11, 0.22);
                border-color: #f59e0b;
                color: #fbbf24;
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
                margin-top: 6px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 10px;
                border-radius: 7px;
                font-size: 0.75rem;
                font-weight: 600;
                background: var(--badge-primary-bg, rgba(56, 189, 248, 0.12));
                border: 1px solid var(--accent-cyan, rgba(56, 189, 248, 0.35));
                color: var(--accent-blue, #38bdf8);
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .mm-depot-pin-btn:hover {
                background: rgba(56, 189, 248, 0.24);
            }
            .mm-chip.distractor-eliminated {
                opacity: 0.36 !important;
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

            /* === FACHGEBIETS-ORDNERSYSTEM (CLEAN) === */
            .mm-library-shell {
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .mm-library-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                padding: 10px 14px;
                border-radius: 12px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.72));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.16));
            }
            .mm-lib-search-input {
                flex: 1;
                min-width: 210px;
                max-width: 360px;
                height: 34px;
                padding: 0 11px;
                border-radius: 8px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                background: var(--surface-primary, rgba(6, 9, 19, 0.8));
                color: var(--text-main, #f8fafc);
                font-size: 0.82rem;
                outline: none;
            }
            .mm-lib-search-input:focus {
                border-color: var(--accent-cyan, #38bdf8);
            }
            .mm-resume-banner {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
                padding: 11px 15px;
                border-radius: 12px;
                background: rgba(56, 189, 248, 0.08);
                border: 1px solid rgba(56, 189, 248, 0.28);
            }
            .mm-folder-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                gap: 12px;
            }
            .mm-folder-card {
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 15px 17px;
                border-radius: 13px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.8));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.14));
                border-top: 3px solid var(--folder-accent, #38bdf8);
                cursor: pointer;
                transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
            }
            .mm-folder-card:hover {
                transform: translateY(-2px);
                border-color: var(--folder-accent, #38bdf8);
                box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
            }
            .mm-folder-card.is-empty {
                opacity: 0.62;
            }
            .mm-folder-card-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }
            .mm-folder-dot-badge {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: var(--folder-accent, #38bdf8);
                box-shadow: 0 0 10px var(--folder-accent, #38bdf8);
            }
            .mm-folder-count-pill {
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 0.72rem;
                font-weight: 700;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                background: var(--surface-subtle, rgba(30, 41, 59, 0.85));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.14));
                color: var(--text-main, #cbd5e1);
            }
            .mm-folder-title {
                font-size: 0.95rem;
                font-weight: 700;
                color: var(--text-main, #f8fafc);
            }
            .mm-folder-meta {
                font-size: 0.75rem;
                color: var(--text-muted, #94a3b8);
                display: flex;
                justify-content: space-between;
                gap: 8px;
                font-variant-numeric: tabular-nums;
            }
            .mm-folder-progress-track {
                width: 100%;
                height: 4px;
                border-radius: 999px;
                background: rgba(148, 163, 184, 0.16);
                overflow: hidden;
            }
            .mm-folder-progress-fill {
                height: 100%;
                border-radius: 999px;
                background: var(--folder-accent, #38bdf8);
                transition: width 0.25s ease;
            }
            .mm-map-card-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(305px, 1fr));
                gap: 12px;
            }
            .mm-map-card {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                gap: 12px;
                padding: 15px 17px;
                border-radius: 13px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.84));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.14));
                border-left: 3px solid var(--folder-accent, #38bdf8);
                transition: transform 0.15s ease, border-color 0.15s ease;
            }
            .mm-map-card:hover {
                transform: translateY(-2px);
                border-color: var(--accent-cyan, #38bdf8);
            }
            .mm-map-card-badges {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                font-size: 0.72rem;
            }
            .mm-map-mini-badge {
                padding: 2px 7px;
                border-radius: 6px;
                background: var(--surface-subtle, rgba(30, 41, 59, 0.85));
                color: var(--text-muted, #cbd5e1);
                font-weight: 600;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            }
            .mm-map-mini-badge.is-done {
                background: rgba(16, 185, 129, 0.15);
                color: #34d399;
            }
            .mm-map-mini-badge.is-weak {
                background: rgba(245, 158, 11, 0.16);
                color: #fbbf24;
            }
            .mm-map-card-actions {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                flex-wrap: wrap;
                padding-top: 10px;
                border-top: 1px solid rgba(148, 163, 184, 0.12);
            }
            .mm-move-folder-select {
                height: 30px;
                padding: 0 8px;
                border-radius: 7px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                background: var(--surface-primary, rgba(6, 9, 19, 0.85));
                color: var(--text-main, #e2e8f0);
                font-size: 0.74rem;
                max-width: 175px;
                cursor: pointer;
            }
            .mm-breadcrumb-bar {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                font-size: 0.88rem;
                font-weight: 700;
            }

            /* === KOMPAKTE ZUSATZBEGRIFFE & 1-KLICK-BEFÖRDERUNG === */
            .mm-node-add-term-btn {
                position: absolute;
                top: -9px;
                right: 8px;
                z-index: 6;
                width: 20px;
                height: 20px;
                border-radius: 999px;
                border: 1px solid rgba(56, 189, 248, 0.5);
                background: var(--surface-primary, #0f172a);
                color: #38bdf8;
                font-size: 0.82rem;
                font-weight: 800;
                line-height: 1;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
                transition: transform 0.14s ease, background 0.14s ease;
            }
            .mm-node-add-term-btn:hover {
                transform: scale(1.12);
                background: #38bdf8;
                color: #0f172a;
            }
            .mm-node-userterm {
                width: 214px;
                min-height: 56px;
                padding: 7px 9px;
                border-radius: 10px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.92));
                border: 1.5px dashed var(--ut-accent, #38bdf8);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.26);
                cursor: pointer;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .mm-node-userterm:hover {
                transform: translate(-50%, -50%) scale(1.03);
                box-shadow: 0 8px 22px rgba(56, 189, 248, 0.22);
            }
            .mm-ut-top {
                display: flex;
                align-items: flex-start;
                gap: 6px;
            }
            .mm-ut-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                margin-top: 4px;
                flex-shrink: 0;
                background: var(--ut-accent, #38bdf8);
            }
            .mm-ut-label {
                font-size: 0.78rem;
                font-weight: 700;
                line-height: 1.28;
                color: var(--text-main, #f8fafc);
                word-break: break-word;
            }
            .mm-ut-note-preview {
                margin-top: 2px;
                padding-left: 13px;
                font-size: 0.68rem;
                line-height: 1.25;
                color: var(--text-muted, #94a3b8);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .mm-ut-bottom {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 4px;
                margin-top: 5px;
                padding-top: 4px;
                border-top: 1px dashed rgba(255, 255, 255, 0.1);
            }
            .mm-ut-status-pill {
                padding: 1px 6px;
                border-radius: 999px;
                font-size: 0.62rem;
                font-weight: 700;
                background: rgba(148, 163, 184, 0.14);
                color: #cbd5e1;
                white-space: nowrap;
            }
            .mm-ut-status-pill.status-valid {
                background: rgba(16, 185, 129, 0.16);
                color: #34d399;
                border: 1px solid rgba(16, 185, 129, 0.4);
            }
            .mm-ut-status-pill.status-partial {
                background: rgba(245, 158, 11, 0.16);
                color: #fbbf24;
                border: 1px solid rgba(245, 158, 11, 0.4);
            }
            .mm-ut-status-pill.status-wrong {
                background: rgba(239, 68, 68, 0.16);
                color: #f87171;
                border: 1px solid rgba(239, 68, 68, 0.4);
            }
            .mm-ut-mini-actions {
                display: inline-flex;
                align-items: center;
                gap: 3px;
            }
            .mm-ut-mini-btn {
                padding: 1px 6px;
                border-radius: 5px;
                border: 1px solid rgba(148, 163, 184, 0.22);
                background: rgba(30, 41, 59, 0.8);
                color: var(--text-main, #e2e8f0);
                font-size: 0.64rem;
                font-weight: 700;
                line-height: 1.35;
                cursor: pointer;
                transition: background 0.14s ease, border-color 0.14s ease;
            }
            .mm-ut-mini-btn:hover:not(:disabled) {
                border-color: var(--accent-cyan, #38bdf8);
                background: rgba(56, 189, 248, 0.2);
            }
            .mm-ut-mini-btn.is-promote-ready {
                border-color: rgba(250, 204, 21, 0.65);
                background: rgba(250, 204, 21, 0.16);
                color: #fde047;
            }
            .mm-ut-mini-btn.is-promote-ready:hover:not(:disabled) {
                background: rgba(250, 204, 21, 0.3);
            }
            .mm-edge-userterm {
                fill: none;
                stroke-width: 1.8;
                stroke-dasharray: 5 5;
                opacity: 0.78;
                pointer-events: none;
            }
            .mm-ut-modal-list {
                display: flex;
                flex-direction: column;
                gap: 7px;
                max-height: 220px;
                overflow-y: auto;
                margin-top: 8px;
                padding-right: 4px;
            }
            .mm-ut-modal-row {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 8px;
                padding: 8px 10px;
                border-radius: 9px;
                background: var(--surface-secondary, rgba(30, 41, 59, 0.72));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.14));
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
        if (state.initPromise) return state.initPromise;

        state.initPromise = (async () => {
            ensureDomStructure();
            await loadMindmapsAndProgress();
            if (!state.currentMap && state.mindmaps.length > 0) {
                selectMindmap(state.mindmaps[0].id, { keepFolderView: true });
            } else {
                renderModule();
            }

            if (!state.initialized) {
                state.initialized = true;
                window.addEventListener('resize', () => {
                    if (isViewVisible() && state.viewMode === 'canvas') {
                        fitStageToViewport();
                        drawSvgConnections();
                    }
                });
                document.addEventListener('click', e => {
                    if (state.openPopover && !e.target.closest('.mm-popover-wrap')) {
                        closeOpenPopovers();
                    }
                });
                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape' && state.openPopover) {
                        closeOpenPopovers();
                    }
                });
            }
        })();

        try {
            await state.initPromise;
        } finally {
            state.initPromise = null;
        }
    }

    function isViewVisible() {
        const el = document.getElementById('mindmap-view');
        return el && !el.classList.contains('hidden') && el.style.display !== 'none';
    }

    async function openView() {
        const viewSection = ensureDomStructure();
        viewSection.classList.remove('hidden');
        viewSection.style.display = 'block';

        if (!state.initialized) {
            await init();
        } else {
            renderModule();
            if (state.viewMode === 'canvas') {
                requestAnimationFrame(() => {
                    fitStageToViewport();
                    drawSvgConnections();
                });
            }
        }
    }

    // ========================================================================
    // 2. SUPABASE PERSISTENZ, LOCALSTORAGE SYNC, LERN-DEPOT & SCHEMA-UPGRADE
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
        const parsed = safeParseJson(localStorage.getItem(DELETED_BUILTINS_KEY), []);
        return Array.isArray(parsed) ? parsed : [];
    }

    function addDeletedBuiltinId(id) {
        const list = getDeletedBuiltinIds();
        if (!list.includes(id)) {
            list.push(id);
            safeStorageSet(DELETED_BUILTINS_KEY, list);
        }
    }

    async function restoreDeletedBuiltinMindmaps() {
        try {
            localStorage.removeItem(DELETED_BUILTINS_KEY);
        } catch (_e) {}
        await loadMindmapsAndProgress();
        if (state.mindmaps.length > 0) {
            selectMindmap(state.mindmaps[0].id, { keepFolderView: state.viewMode === 'folders' });
        } else {
            renderModule();
        }
    }

    /**
     * Migriert veraltete gecachte Built-in-Versionen sauber auf V7.3,
     * behält aber KI-Fragen, Ordner-Zuweisungen, eigene Zusatzbegriffe sowie
     * bereits beförderte Benutzer-Knoten (_userPromoted) vollständig bei.
     */
    function mergeWithBuiltinIfOutdated(candidateMap) {
        const builtinMatch = BUILTIN_MINDMAPS.find(b => b.id === candidateMap.id);
        if (!builtinMatch) return candidateMap;

        const candidateVersion = Number(candidateMap.schema_version || 0);
        const candidateNodeCount = Array.isArray(candidateMap.nodes) ? candidateMap.nodes.length : 0;

        if (candidateVersion < BUILTIN_SCHEMA_VERSION || candidateNodeCount < builtinMatch.nodes.length) {
            const upgraded = JSON.parse(JSON.stringify(builtinMatch));
            if (candidateMap.folder_id) upgraded.folder_id = candidateMap.folder_id;
            if (candidateMap.specialty) upgraded.specialty = candidateMap.specialty;
            if (Array.isArray(candidateMap.user_terms)) upgraded.user_terms = candidateMap.user_terms;

            const oldNodeMap = new Map((candidateMap.nodes || []).map(n => [n.id, n]));
            const upgradedIds = new Set(upgraded.nodes.map(n => n.id));

            upgraded.nodes.forEach(n => {
                const oldNode = oldNodeMap.get(n.id);
                if (oldNode?.mastery_question?._aiGenerated) {
                    n.mastery_question = oldNode.mastery_question;
                }
            });

            (candidateMap.nodes || []).forEach(oldNode => {
                if (oldNode?._userPromoted && !upgradedIds.has(oldNode.id)) {
                    upgraded.nodes.push(oldNode);
                    upgradedIds.add(oldNode.id);
                }
            });

            return upgraded;
        }

        if (!Array.isArray(candidateMap.distractors) && builtinMatch.distractors) {
            candidateMap.distractors = JSON.parse(JSON.stringify(builtinMatch.distractors));
        }
        if (!Array.isArray(candidateMap.cross_links) && builtinMatch.cross_links) {
            candidateMap.cross_links = JSON.parse(JSON.stringify(builtinMatch.cross_links));
        }
        if (!Array.isArray(candidateMap.user_terms)) {
            candidateMap.user_terms = [];
        }
        return candidateMap;
    }

    async function saveNodeToLearningDepot(node, customPrefix = '') {
        if (!node || !state.currentMap) return;
        const parentLabel = getParentLabel(node, true);
        const catLabel = CATEGORIES[node.category]?.label || node.category;
        const depth = state.nodeMeta[node.id]?.depth || 1;
        const cueContext = `E${depth} • ${catLabel}: ${parentLabel} ➔ ${node.relation_label || 'Kausalbeziehung'}`;
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
            const items = safeParseJson(localStorage.getItem(DEPOT_STORAGE_KEY), []);
            if (Array.isArray(items) && !items.some(i => i.highlighted_text === entryPayload.highlighted_text)) {
                items.unshift({
                    id: 'dep_mm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    ...entryPayload,
                    user_note: '',
                    mastered: false,
                    created_at: new Date().toISOString()
                });
                safeStorageSet(DEPOT_STORAGE_KEY, items);
            }
        }

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
    }

    async function loadMindmapsAndProgress() {
        const localSavedRaw = safeParseJson(localStorage.getItem('medcheck_custom_mindmaps'), []);
        const localSaved = Array.isArray(localSavedRaw) ? localSavedRaw : [];
        const localProgressRaw = safeParseJson(localStorage.getItem('medcheck_mindmap_progress'), {});
        const localProgress = (localProgressRaw && typeof localProgressRaw === 'object') ? localProgressRaw : {};

        const deletedBuiltins = getDeletedBuiltinIds();
        state.progressCache = localProgress;

        const mapById = new Map();
        BUILTIN_MINDMAPS.forEach(m => {
            if (!deletedBuiltins.includes(m.id)) {
                mapById.set(m.id, JSON.parse(JSON.stringify(m)));
            }
        });

        localSaved.forEach(m => {
            if (!m || !m.id || deletedBuiltins.includes(m.id)) return;
            mapById.set(m.id, mergeWithBuiltinIfOutdated(m));
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
                        if (!row || !row.id || deletedBuiltins.includes(row.id)) return;
                        const parsed = safeParseJson(row.data_json, null);
                        if (!parsed || !Array.isArray(parsed.nodes)) return;

                        const dbObj = {
                            id: row.id,
                            schema_version: parsed.schema_version || 6,
                            folder_id: parsed.folder_id || null,
                            title: row.title || row.central_concept || row.id,
                            specialty: row.specialty || 'Vorlesung',
                            central_concept: row.central_concept || row.title || '',
                            nodes: parsed.nodes,
                            cross_links: Array.isArray(parsed.cross_links) ? parsed.cross_links : [],
                            distractors: Array.isArray(parsed.distractors) ? parsed.distractors : [],
                            user_terms: Array.isArray(parsed.user_terms) ? parsed.user_terms : []
                        };
                        mapById.set(row.id, mergeWithBuiltinIfOutdated(dbObj));
                    });
                }

                const { data: dbProg, error: progErr } = await sb
                    .from('mindmap_progress')
                    .select('*')
                    .eq('user_id', user.id);

                if (!progErr && Array.isArray(dbProg)) {
                    dbProg.forEach(row => {
                        if (!row || !row.mindmap_id) return;
                        state.progressCache[row.mindmap_id] = {
                            completed: Boolean(row.completed),
                            accuracy: Number(row.accuracy) || 0,
                            mistakes_count: Number(row.mistakes_count) || 0,
                            best_time_sec: Number(row.best_time_sec) || 0,
                            weak_nodes: Array.isArray(row.weak_nodes_json) ? row.weak_nodes_json : []
                        };
                    });
                    safeStorageSet('medcheck_mindmap_progress', state.progressCache);
                }
            } catch (e) {
                console.warn('[Mindmap V7.3] Supabase-Sync im Offline-Fallback:', e);
            }
        }

        state.mindmaps = Array.from(mapById.values());
    }

    async function saveCustomMindmapToDb(mindmapObj) {
        if (!mindmapObj || !mindmapObj.id) return;

        const mergedTerms = getUserTermsForMap(mindmapObj);
        mindmapObj.user_terms = mergedTerms;

        const localSavedRaw = safeParseJson(localStorage.getItem('medcheck_custom_mindmaps'), []);
        const localSaved = Array.isArray(localSavedRaw) ? localSavedRaw : [];

        const filtered = localSaved.filter(m => m && m.id !== mindmapObj.id);
        filtered.unshift(mindmapObj);
        safeStorageSet('medcheck_custom_mindmaps', filtered);

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
                        schema_version: mindmapObj.schema_version || BUILTIN_SCHEMA_VERSION,
                        folder_id: mindmapObj.folder_id || resolveFolderForMindmap(mindmapObj).id,
                        nodes: mindmapObj.nodes,
                        cross_links: mindmapObj.cross_links || [],
                        distractors: mindmapObj.distractors || [],
                        user_terms: mergedTerms
                    },
                    updated_at: new Date().toISOString()
                });
            } catch (err) {
                console.warn('[Mindmap V7.3] Lokal gesichert:', err);
            }
        }
    }

    async function deleteCurrentMindmap(explicitMapId = null) {
        const targetMap = explicitMapId
            ? state.mindmaps.find(m => m.id === explicitMapId)
            : state.currentMap;
        if (!targetMap) return false;

        const targetId = targetMap.id;
        const targetTitle = targetMap.title || targetMap.central_concept || targetId;
        const isBuiltin = BUILTIN_MINDMAPS.some(b => b.id === targetId);

        const confirmMsg = isBuiltin
            ? `Möchtest du die Standard-Mindmap „${targetTitle}“ aus deiner Liste entfernen?\n\n(Du kannst Standard-Mindmaps später jederzeit wiederherstellen.)`
            : `Möchtest du die Mindmap „${targetTitle}“ inklusive deines Lernfortschritts wirklich unwiderruflich löschen?`;

        if (!window.confirm(confirmMsg)) return false;

        if (isBuiltin) {
            addDeletedBuiltinId(targetId);
        }

        const localSavedRaw = safeParseJson(localStorage.getItem('medcheck_custom_mindmaps'), []);
        if (Array.isArray(localSavedRaw)) {
            safeStorageSet('medcheck_custom_mindmaps', localSavedRaw.filter(m => m && m.id !== targetId));
        }

        setFolderOverride(targetId, null);
        saveUserTermsForMapId(targetId, []);
        delete state.progressCache[targetId];
        safeStorageSet('medcheck_mindmap_progress', state.progressCache);

        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
                await sb.from('mindmap_progress').delete().eq('mindmap_id', targetId).eq('user_id', user.id);
                await sb.from('mindmaps').delete().eq('id', targetId);
            } catch (err) {
                console.warn('[Mindmap V7.3] Fehler beim Cloud-Delete (lokal bereits gelöscht):', err);
            }
        }

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(14);

        const wasActiveMap = state.currentMap?.id === targetId;
        const keepFolders = state.viewMode === 'folders';

        await loadMindmapsAndProgress();
        if (wasActiveMap) {
            if (state.mindmaps.length > 0) {
                selectMindmap(state.mindmaps[0].id, { keepFolderView: keepFolders });
            } else {
                state.currentMap = null;
                state.solvedNodeIds = new Set();
                renderModule();
            }
        } else {
            renderModule();
        }
        return true;
    }

    async function saveProgressToDb() {
        if (!state.currentMap) return;
        const totalNodes = state.currentMap.nodes.length;
        const totalAttempts = totalNodes + state.mistakesCount;
        const accuracy = totalAttempts > 0 ? Math.round((totalNodes / totalAttempts) * 100) : 100;
        const elapsedSec = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;

        const prev = state.progressCache[state.currentMap.id] || {};
        const bestTime = prev.best_time_sec ? Math.min(prev.best_time_sec, elapsedSec) : elapsedSec;

        const combinedWeakIds = Array.from(new Set([...state.weakNodeIds, ...state.uncertainNodeIds]));

        const record = {
            completed: true,
            accuracy,
            mistakes_count: state.mistakesCount,
            best_time_sec: bestTime,
            weak_nodes: combinedWeakIds,
            last_played_at: new Date().toISOString()
        };

        state.progressCache[state.currentMap.id] = record;
        safeStorageSet('medcheck_mindmap_progress', state.progressCache);

        const xpBonus = state.difficultyPreset === 'exam' ? 600 : (state.difficultyPreset === 'clinical' ? 450 : 300);
        if (typeof window.applyXpDelta === 'function') {
            window.applyXpDelta(xpBonus, `Deep-Tree Mindmap gemeistert (${accuracy}%)`);
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
                    weak_nodes_json: combinedWeakIds,
                    last_played_at: new Date().toISOString()
                }, { onConflict: 'user_id,mindmap_id' });
            } catch (err) {
                console.warn('[Mindmap V7.3] Fortschritt lokal gespeichert:', err);
            }
        }
    }

    // ========================================================================
    // 2B. FACHGEBIETS-ORDNERSYSTEM (SYNC MIT DASHBOARD + EXAKTE REIHENFOLGE)
    // ========================================================================

    function normalizeSearchText(str) {
        return String(str || '')
            .trim()
            .toLowerCase()
            .replace(/ä/g, 'ae')
            .replace(/ö/g, 'oe')
            .replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss');
    }

    function normalizeFolderKey(str) {
        return normalizeSearchText(str)
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function getFolderOverrides() {
        const parsed = safeParseJson(localStorage.getItem(FOLDER_OVERRIDES_KEY), {});
        return (parsed && typeof parsed === 'object') ? parsed : {};
    }

    function setFolderOverride(mindmapId, folderId) {
        const map = getFolderOverrides();
        if (folderId) {
            map[mindmapId] = folderId;
        } else {
            delete map[mindmapId];
        }
        safeStorageSet(FOLDER_OVERRIDES_KEY, map);
    }

    /**
     * Liest die Fachgebiets-Ordner automatisch aus dem Dashboard (Single Source of Truth)
     * inklusive orderIndex für identische Reihenfolge.
     */
    function getDashboardFolders() {
        const rawExternal =
            (Array.isArray(window.MEDCHECK_DASHBOARD_FOLDERS) && window.MEDCHECK_DASHBOARD_FOLDERS) ||
            (typeof window.SpecialtyModule?.getFolders === 'function' && window.SpecialtyModule.getFolders()) ||
            (Array.isArray(window.SPECIALTY_FOLDERS) && window.SPECIALTY_FOLDERS) ||
            (Array.isArray(window.DASHBOARD_FOLDERS) && window.DASHBOARD_FOLDERS) ||
            null;

        const sourceList = (Array.isArray(rawExternal) && rawExternal.length > 0)
            ? rawExternal
            : DASHBOARD_FOLDER_FALLBACKS;

        const baseList = sourceList.map((rawItem, idx) => {
            const f = typeof rawItem === 'string' ? { label: rawItem } : (rawItem || {});
            const label = f.label || f.name || f.title || f.id || 'Allgemein';
            const id = f.id ? String(f.id) : normalizeFolderKey(label);
            const fallbackMatch = DASHBOARD_FOLDER_FALLBACKS.find(
                fb => fb.id === id || normalizeFolderKey(fb.label) === normalizeFolderKey(label)
            );
            return {
                id,
                label,
                icon: f.icon || fallbackMatch?.icon || '📁',
                color: f.color || fallbackMatch?.color || '#38bdf8',
                orderIndex: typeof f.orderIndex === 'number' ? f.orderIndex : idx,
                keywords: Array.isArray(f.keywords) && f.keywords.length > 0
                    ? f.keywords
                    : [label, id, ...(fallbackMatch?.keywords || [])]
            };
        });

        if (!baseList.some(f => f.id === 'sonstige')) {
            baseList.push({
                id: 'sonstige',
                label: 'Allgemein & Weitere Fächer',
                icon: '📁',
                color: '#94a3b8',
                orderIndex: 9999,
                keywords: []
            });
        }

        return baseList;
    }

    function resolveFolderForMindmap(mindmap, foldersCache = null) {
        const folders = foldersCache || getDashboardFolders();
        const fallbackFolder = folders.find(f => f.id === 'sonstige') || folders[folders.length - 1];
        if (!mindmap) return fallbackFolder;

        const overrides = getFolderOverrides();
        const explicitId = overrides[mindmap.id] || mindmap.folder_id;
        if (explicitId) {
            const exact = folders.find(f => f.id === explicitId);
            if (exact) return exact;
        }

        const specSearch = normalizeSearchText(mindmap.specialty);
        const specKey = normalizeFolderKey(mindmap.specialty);
        const searchHaystack = `${specSearch} ${normalizeSearchText(mindmap.title)}`;

        const directMatch = folders.find(f => {
            if (f.id === 'sonstige') return false;
            const labelSearch = normalizeSearchText(f.label);
            return (
                f.id === specKey ||
                normalizeFolderKey(f.label) === specKey ||
                (labelSearch.length >= 4 && specSearch.includes(labelSearch)) ||
                (specSearch.length >= 4 && labelSearch.includes(specSearch))
            );
        });
        if (directMatch) return directMatch;

        for (const f of folders) {
            if (f.id === 'sonstige') continue;
            if ((f.keywords || []).some(kw => {
                const kwNorm = normalizeSearchText(kw);
                return kwNorm.length >= 3 && specSearch.includes(kwNorm);
            })) {
                return f;
            }
        }
        for (const f of folders) {
            if (f.id === 'sonstige') continue;
            if ((f.keywords || []).some(kw => {
                const kwNorm = normalizeSearchText(kw);
                return kwNorm.length >= 4 && searchHaystack.includes(kwNorm);
            })) {
                return f;
            }
        }

        return fallbackFolder;
    }

    function getFoldersWithStats() {
        const folders = getDashboardFolders();
        const buckets = new Map();
        folders.forEach(f => {
            buckets.set(f.id, {
                ...f,
                maps: [],
                completedCount: 0,
                weakMapCount: 0,
                avgAccuracy: null
            });
        });

        state.mindmaps.forEach(m => {
            const targetFolder = resolveFolderForMindmap(m, folders);
            const bucket = buckets.get(targetFolder.id);
            if (!bucket) return;
            bucket.maps.push(m);
            const prog = state.progressCache[m.id];
            if (prog?.completed) bucket.completedCount += 1;
            if (Array.isArray(prog?.weak_nodes) && prog.weak_nodes.length > 0) bucket.weakMapCount += 1;
        });

        const result = Array.from(buckets.values()).map(b => {
            const accs = b.maps
                .map(m => state.progressCache[m.id]?.accuracy)
                .filter(v => typeof v === 'number' && !Number.isNaN(v));
            b.avgAccuracy = accs.length > 0 ? Math.round(accs.reduce((s, v) => s + v, 0) / accs.length) : null;
            return b;
        });

        // Behält exakt die Dashboard-Reihenfolge (orderIndex) bei; Allgemein/Sonstige immer am Ende
        return result.sort((a, b) => {
            if (a.id === 'sonstige') return 1;
            if (b.id === 'sonstige') return -1;
            if (typeof a.orderIndex === 'number' && typeof b.orderIndex === 'number') {
                return a.orderIndex - b.orderIndex;
            }
            return a.label.localeCompare(b.label, 'de');
        });
    }

    async function moveMindmapToFolder(mindmapId, newFolderId) {
        const targetMap = state.mindmaps.find(m => m.id === mindmapId);
        const folders = getDashboardFolders();
        const folderObj = folders.find(f => f.id === newFolderId);
        if (!targetMap || !folderObj) return;

        targetMap.folder_id = folderObj.id;
        targetMap.specialty = folderObj.label;
        setFolderOverride(targetMap.id, folderObj.id);
        await saveCustomMindmapToDb(targetMap);

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        renderModule();
        if (state.viewMode === 'canvas') {
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        }
    }

    function openFolderLibrary(folderId = null) {
        closeOpenPopovers();
        state.viewMode = 'folders';
        state.activeFolderId = folderId;
        state.librarySearchQuery = '';
        renderModule();
    }

    async function openFolder(folderId) {
        closeOpenPopovers();
        const viewSection = ensureDomStructure();
        viewSection.classList.remove('hidden');
        viewSection.style.display = 'block';
        state.viewMode = 'folders';
        state.activeFolderId = folderId;
        if (!state.initialized) {
            await init();
        } else {
            renderModule();
        }
    }

    function getMapTreeDepthPreview(mindmap) {
        const nodes = mindmap?.nodes || [];
        const byId = new Map(nodes.map(n => [n.id, n]));
        let maxD = 1;
        nodes.forEach(n => {
            let d = 1;
            let cur = n.parent_id;
            const seen = new Set([n.id]);
            while (cur && cur !== 'root' && byId.has(cur) && !seen.has(cur)) {
                seen.add(cur);
                d += 1;
                cur = byId.get(cur).parent_id;
            }
            if (d > maxD) maxD = d;
        });
        return maxD;
    }

    function renderGroupedMapOptions(selectedMapId) {
        const folders = getFoldersWithStats().filter(f => f.maps.length > 0);
        return folders.map(folder => `
            <optgroup label="${escapeHtml(`${folder.label} (${folder.maps.length})`)}">
                ${folder.maps.map(m => {
                    const prog = state.progressCache[m.id];
                    const prefix = prog?.completed ? `✓ ${prog.accuracy}% · ` : '';
                    return `<option value="${escapeHtml(m.id)}" ${m.id === selectedMapId ? 'selected' : ''}>
                        ${prefix}${escapeHtml(m.title)} (${(m.nodes || []).length})
                    </option>`;
                }).join('')}
            </optgroup>
        `).join('');
    }

    // ========================================================================
    // 2C. EIGENE ZUSATZBEGRIFFE PRO KATEGORIEAST + 1-KLICK-BEFÖRDERUNG (V7.3)
    // ========================================================================

    function getAllStoredUserTermsMap() {
        const parsed = safeParseJson(localStorage.getItem(USER_TERMS_STORAGE_KEY), {});
        return (parsed && typeof parsed === 'object') ? parsed : {};
    }

    function saveUserTermsForMapId(mapId, termsArray) {
        if (!mapId) return;
        const all = getAllStoredUserTermsMap();
        if (Array.isArray(termsArray) && termsArray.length > 0) {
            all[mapId] = termsArray;
        } else {
            delete all[mapId];
        }
        safeStorageSet(USER_TERMS_STORAGE_KEY, all);
    }

    function getUserTermsForMap(mindmap) {
        if (!mindmap || !mindmap.id) return [];
        const storedList = getAllStoredUserTermsMap()[mindmap.id];
        const embeddedList = Array.isArray(mindmap.user_terms) ? mindmap.user_terms : [];

        const merged = new Map();
        embeddedList.forEach(t => {
            if (t && t.id && t.label) merged.set(t.id, t);
        });
        if (Array.isArray(storedList)) {
            storedList.forEach(t => {
                if (t && t.id && t.label) merged.set(t.id, t);
            });
        }
        return Array.from(merged.values());
    }

    function resolveAnchorNodeIdForCategory(mindmap, categoryKey, preferredParentId = null) {
        if (!mindmap || !Array.isArray(mindmap.nodes)) return 'root';
        if (preferredParentId && preferredParentId !== 'root') {
            if (mindmap.nodes.some(n => n.id === preferredParentId)) return preferredParentId;
        }
        const tier1Match = mindmap.nodes.find(
            n => (!n.parent_id || n.parent_id === 'root') && n.category === categoryKey
        );
        if (tier1Match) return tier1Match.id;

        const anyCatMatch = mindmap.nodes.find(n => n.category === categoryKey);
        return anyCatMatch ? anyCatMatch.id : 'root';
    }

    function getRenderableUserTerms(mindmap) {
        if (!mindmap || !state.showUserTerms) return [];
        const allTerms = getUserTermsForMap(mindmap);

        return allTerms
            .map(term => {
                const anchorParentId = resolveAnchorNodeIdForCategory(mindmap, term.category, term.parent_id);
                const parentUnsolvedInBlindMode =
                    state.blindMode &&
                    anchorParentId !== 'root' &&
                    !state.solvedNodeIds.has(anchorParentId);
                return {
                    ...term,
                    anchorParentId,
                    deferredByBlindMode: parentUnsolvedInBlindMode
                };
            })
            .filter(t => !t.deferredByBlindMode);
    }

    async function persistUserTermsOnCurrentMap(updatedTerms) {
        if (!state.currentMap) return;
        state.currentMap.user_terms = updatedTerms;
        saveUserTermsForMapId(state.currentMap.id, updatedTerms);
        await saveCustomMindmapToDb(state.currentMap);
    }

    async function addUserTermsToCurrentMap({ category, parentId = null, rawInput = '', note = '', runAiCheck = false }) {
        if (!state.currentMap) return [];
        const safeCat = CATEGORIES[category] ? category : 'pathophysiology';
        const anchorId = resolveAnchorNodeIdForCategory(state.currentMap, safeCat, parentId);

        const labels = String(rawInput || '')
            .split(/[\n;]+/)
            .map(s => s.trim())
            .filter(s => s.length >= 2);

        if (labels.length === 0) return [];

        const existing = getUserTermsForMap(state.currentMap);
        const created = labels.map((label, idx) => ({
            id: `ut_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            label: label.slice(0, 64),
            note: String(note || '').trim().slice(0, 240),
            category: safeCat,
            parent_id: anchorId,
            ai_status: 'unchecked', // 'unchecked' | 'valid' | 'partial' | 'wrong'
            ai_feedback: '',
            created_at: new Date().toISOString()
        }));

        const updated = [...existing, ...created];
        await persistUserTermsOnCurrentMap(updated);

        if (anchorId !== 'root' && state.collapsedNodeIds.has(anchorId)) {
            state.collapsedNodeIds.delete(anchorId);
        }

        const savedZoom = state.zoom;
        const savedPanX = state.panX;
        const savedPanY = state.panY;

        computeLayout(state.currentMap);
        renderModule();
        if (state.viewMode === 'canvas') {
            state.zoom = savedZoom;
            state.panX = savedPanX;
            state.panY = savedPanY;
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
                if (!state.blindMode || anchorId === 'root' || state.solvedNodeIds.has(anchorId)) {
                    focusCameraOnNode(created[0].id, Math.max(0.76, state.zoom));
                }
            });
        }

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);

        if (runAiCheck) {
            for (const item of created) {
                await runAiCheckForUserTerm(item.id);
            }
        }
        return created;
    }

    async function deleteUserTerm(termId) {
        if (!state.currentMap) return;
        const existing = getUserTermsForMap(state.currentMap);
        const updated = existing.filter(t => t.id !== termId);
        await persistUserTermsOnCurrentMap(updated);

        const savedZoom = state.zoom;
        const savedPanX = state.panX;
        const savedPanY = state.panY;

        computeLayout(state.currentMap);
        renderModule();
        if (state.viewMode === 'canvas') {
            state.zoom = savedZoom;
            state.panX = savedPanX;
            state.panY = savedPanY;
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        }
    }

    async function saveUserTermToLearningDepot(term) {
        if (!term || !state.currentMap) return;
        const catLabel = CATEGORIES[term.category]?.label || term.category;
        const parentNode = state.currentMap.nodes.find(n => n.id === term.parent_id);
        const parentLabel = parentNode ? parentNode.label : state.currentMap.central_concept;

        const details = [
            term.note ? `Eigene Notiz: ${term.note}` : '',
            term.ai_feedback ? `KI-Feedback: ${term.ai_feedback}` : ''
        ].filter(Boolean).join(' | ');

        const entryPayload = {
            case_id: state.currentMap.id,
            case_title: `Mindmap: ${state.currentMap.title || state.currentMap.central_concept}`,
            category: state.currentMap.specialty || 'Mindmap-Labor',
            cue_context: `Eigene Ergänzung · ${catLabel} (${parentLabel})`,
            highlighted_text: `${term.label}${details ? ` — ${details}` : ''}`
        };

        if (typeof window.createDepotEntry === 'function') {
            await window.createDepotEntry(entryPayload);
        } else {
            const items = safeParseJson(localStorage.getItem(DEPOT_STORAGE_KEY), []);
            if (Array.isArray(items) && !items.some(i => i.highlighted_text === entryPayload.highlighted_text)) {
                items.unshift({
                    id: 'dep_mm_ut_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    ...entryPayload,
                    user_note: '',
                    mastered: false,
                    created_at: new Date().toISOString()
                });
                safeStorageSet(DEPOT_STORAGE_KEY, items);
            }
        }
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
    }

    async function runAiCheckForUserTerm(termId) {
        if (!state.currentMap || inFlightUserTermIds.has(termId)) return null;
        const terms = getUserTermsForMap(state.currentMap);
        const term = terms.find(t => t.id === termId);
        if (!term) return null;

        inFlightUserTermIds.add(termId);
        const catLabel = CATEGORIES[term.category]?.label || term.category;
        const parentNode = state.currentMap.nodes.find(n => n.id === term.parent_id);
        const parentContext = parentNode ? `übergeordneter Knoten "${parentNode.label}"` : `Hauptast ${catLabel}`;

        const tutorEl = document.getElementById('mm-tutor-message');
        if (tutorEl) {
            tutorEl.innerHTML = `<div class="mm-tutor-thinking"><span>Prüfe „${escapeHtml(term.label)}“ fachlich & kontextuell...</span></div>`;
        }

        const prompt = `Du bist medizinischer Facharzt-Tutor (Staatsexamensniveau).
Ein Medizinstudent ergänzt in einer klinischen Mindmap zum Thema "${state.currentMap.central_concept}" (${state.currentMap.specialty}) im Kategorieast "${catLabel}" (${parentContext}) spontan folgenden eigenen Begriff aus dem freien Abruf:
Begriff: "${term.label}"
${term.note ? `Eigene Notiz: "${term.note}"` : ''}

Bewerte präzise:
1. Ist dieser Begriff medizinisch korrekt für "${state.currentMap.central_concept}" und passt er in den Ast "${catLabel}"?
2. Klassifiziere als "valid" (korrekt & klinisch wertvolle Ergänzung), "partial" (im Kern richtig, aber falsche Kategorie oder wichtige Einschränkung/Nuance fehlt) oder "wrong" (fachlich falsch, Kontraindikation oder Verwechslung mit Differenzialdiagnose).
3. Gib ein prägnantes Feedback (2 Sätze, per Du, konkret mit Mechanismus/Cutoff/Korrektur).

Antworte AUSSCHLIESSLICH als valides JSON-Array mit genau einem Objekt:
[
  {
    "status": "valid | partial | wrong",
    "feedback": "Prägnante klinische Einordnung..."
  }
]`;

        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'depot_quiz', prompt })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const item = Array.isArray(data?.result) ? data.result[0] : null;
            if (!item || !item.feedback) throw new Error('Ungültige KI-Antwort');

            const normalizedStatus = ['valid', 'partial', 'wrong'].includes(item.status) ? item.status : 'partial';
            const wasValidBefore = term.ai_status === 'valid';
            term.ai_status = normalizedStatus;
            term.ai_feedback = String(item.feedback).trim();
            await persistUserTermsOnCurrentMap(terms);

            if (normalizedStatus === 'valid' && !wasValidBefore && typeof window.applyXpDelta === 'function') {
                window.applyXpDelta(15, 'Freier Abruf verifiziert');
            }

            const savedZoom = state.zoom;
            const savedPanX = state.panX;
            const savedPanY = state.panY;
            renderModule();
            if (state.viewMode === 'canvas') {
                state.zoom = savedZoom;
                state.panX = savedPanX;
                state.panY = savedPanY;
                requestAnimationFrame(() => {
                    applyStageTransform();
                    drawSvgConnections();
                    showUserTermDetailInTutor(term.id);
                });
            }
            return term;
        } catch (_err) {
            if (tutorEl) {
                tutorEl.innerHTML = `<strong style="color:#f59e0b;">KI-Check offline:</strong> „${escapeHtml(term.label)}“ bleibt lokal gespeichert.`;
            }
            return null;
        } finally {
            inFlightUserTermIds.delete(termId);
        }
    }

    /**
     * Befördert einen eigenen Zusatzbegriff dauerhaft in einen vollwertigen offiziellen
     * Prüfungs-Knoten (map.nodes) inkl. Relation, sokratischer Leitfrage & Staatsexamens-Mastery-Question.
     */
    async function promoteUserTermToOfficialNode(termId) {
        if (!state.currentMap || inFlightUserTermIds.has(termId)) return null;
        const map = state.currentMap;
        const terms = getUserTermsForMap(map);
        const term = terms.find(t => t.id === termId);
        if (!term) return null;

        if (term.ai_status === 'wrong') {
            const proceed = window.confirm(
                `Der KI-Check hat „${term.label}“ als fachlich fehlerhaft bzw. unpassend markiert.\nMöchtest du den Begriff trotzdem als offiziellen Knoten aufnehmen?`
            );
            if (!proceed) return null;
        }

        inFlightUserTermIds.add(termId);
        const anchorId = resolveAnchorNodeIdForCategory(map, term.category, term.parent_id);
        const parentNode = map.nodes.find(n => n.id === anchorId);
        const parentLabel = parentNode ? parentNode.label : map.central_concept;
        const catLabel = CATEGORIES[term.category]?.label || term.category;

        const tutorEl = document.getElementById('mm-tutor-message');
        if (tutorEl) {
            tutorEl.innerHTML = `<div class="mm-tutor-thinking"><span>Befördere „${escapeHtml(term.label)}“ zum offiziellen Prüfungs-Knoten...</span></div>`;
        }

        const prompt = `Du bist medizinischer Facharzt-Tutor & Prüfungsautor (Staatsexamensniveau IMPP/NBME).
Ein Medizinstudent möchte seinen eigenen Zusatzbegriff dauerhaft als vollwertigen Knoten in die klinische Mindmap "${map.central_concept}" (${map.specialty}) aufnehmen:
- Zielbegriff: "${term.label}"
- Kategorie: "${catLabel}"
- Übergeordneter Knoten: "${parentLabel}"
${term.note ? `- Eigene Notiz: "${term.note}"` : ''}
${term.ai_feedback ? `- Bisheriges KI-Feedback: "${term.ai_feedback}"` : ''}

Erstelle die vollständigen Knoten-Metadaten inklusive einer tiefgehenden 4-Optionen-Verständnisfrage (strikte Längenparität 14–24 Wörter, keine Test-Wiseness).
Antworte AUSSCHLIESSLICH mit einem validen JSON-Array mit genau einem Objekt:
[
  {
    "label": "Prägnantes klinisches Label (max. 48 Zeichen)",
    "relation_label": "Kurze kausale Verb-Phrase (max. 28 Zeichen, ohne das Label zu verraten)",
    "socratic_hint": "Sokratische Leitfrage ohne das Label zu spoilern?",
    "explanation": "Präzise klinisch-pathophysiologische Zusammenfassung (1–2 Sätze).",
    "mastery_question": {
      "question": "Tiefgehende Staatsexamensfrage (Mechanismus / Cutoff / Kontraindikation)?",
      "options": ["Option 1...", "Option 2...", "Option 3...", "Option 4..."],
      "correct_index": 0,
      "socratic_nudge": "Sokratischer Impuls bei Falschklick ohne Spoiler.",
      "rationale": "Präzise klinische Begründung."
    }
  }
]`;

        let aiNodeData = null;
        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'depot_quiz', prompt })
            });
            if (response.ok) {
                const data = await response.json();
                const item = Array.isArray(data?.result) ? data.result[0] : null;
                if (item && item.explanation) {
                    aiNodeData = item;
                }
            }
        } catch (_e) {
            console.warn('[Mindmap V7.3] Offline-Beförderung aktiv.');
        } finally {
            inFlightUserTermIds.delete(termId);
        }

        const newNodeId = `n_user_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const mqRaw = aiNodeData?.mastery_question;
        let masteryQuestion = null;
        if (mqRaw && mqRaw.question && Array.isArray(mqRaw.options) && mqRaw.options.length >= 4) {
            const opts = mqRaw.options.slice(0, 4);
            const safeIdx = (Number.isInteger(mqRaw.correct_index) && mqRaw.correct_index >= 0 && mqRaw.correct_index < opts.length)
                ? mqRaw.correct_index
                : 0;
            masteryQuestion = {
                question: mqRaw.question,
                options: opts,
                correct_index: safeIdx,
                socratic_nudge: mqRaw.socratic_nudge || aiNodeData.socratic_hint || 'Überdenke den exakten Pathomechanismus dieses Knotens.',
                rationale: mqRaw.rationale || aiNodeData.explanation,
                _aiGenerated: true
            };
        }

        const promotedNode = {
            id: newNodeId,
            label: String(aiNodeData?.label || term.label).trim().slice(0, 52),
            category: term.category,
            parent_id: anchorId,
            relation_label: String(aiNodeData?.relation_label || 'ergänzt klinisch über').trim().slice(0, 34),
            socratic_hint: String(aiNodeData?.socratic_hint || `Welches wichtige Zusatzkonzept im Ast „${catLabel}“ ergänzt „${parentLabel}“?`).trim(),
            explanation: String(aiNodeData?.explanation || term.ai_feedback || term.note || `Vom Nutzer ergänztes und verifiziertes Konzept zu „${parentLabel}“.`).trim(),
            _userPromoted: true
        };
        if (masteryQuestion) {
            promotedNode.mastery_question = masteryQuestion;
        }

        const remainingTerms = terms.filter(t => t.id !== termId);
        map.nodes.push(promotedNode);
        map.user_terms = remainingTerms;
        saveUserTermsForMapId(map.id, remainingTerms);

        if (anchorId === 'root' || state.solvedNodeIds.has(anchorId)) {
            state.solvedNodeIds.add(newNodeId);
        } else {
            rebuildPoolOrder();
        }

        if (anchorId !== 'root' && state.collapsedNodeIds.has(anchorId)) {
            state.collapsedNodeIds.delete(anchorId);
        }

        await saveCustomMindmapToDb(map);

        if (typeof window.applyXpDelta === 'function') {
            window.applyXpDelta(40, 'Eigener Prüfungs-Knoten erstellt');
        }
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(14);

        const savedZoom = state.zoom;
        const savedPanX = state.panX;
        const savedPanY = state.panY;

        computeLayout(map);
        renderModule();
        if (state.viewMode === 'canvas') {
            state.zoom = savedZoom;
            state.panX = savedPanX;
            state.panY = savedPanY;
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
                focusCameraOnNode(newNodeId, Math.max(0.78, state.zoom));

                const updatedTutor = document.getElementById('mm-tutor-message');
                if (updatedTutor) {
                    updatedTutor.innerHTML = `
                        <strong style="color:#fde047;">★ Zum Prüfungs-Knoten befördert (+40 XP)</strong><br>
                        <strong>„${escapeHtml(promotedNode.label)}“</strong> ist jetzt fest im Baum verankert.
                        <div style="margin-top:6px; font-size:0.8rem; color:#cbd5e1;">${escapeHtml(promotedNode.explanation)}</div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                            <button type="button" class="mm-depot-pin-btn" data-retest-node="${escapeHtml(newNodeId)}">
                                Prüfungsfrage testen
                            </button>
                            <button type="button" class="mm-depot-pin-btn" data-pin-node="${escapeHtml(newNodeId)}">
                                Ins Lern-Depot
                            </button>
                        </div>
                    `;
                    bindTutorActionButtons(updatedTutor);
                }
            });
        }

        return promotedNode;
    }

    function showUserTermDetailInTutor(termId) {
        if (!state.currentMap) return;
        const term = getUserTermsForMap(state.currentMap).find(t => t.id === termId);
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!term || !tutorEl) return;

        const catCfg = CATEGORIES[term.category] || { label: 'Ergänzung', shortLabel: 'Ergänzung', color: '#38bdf8' };
        const statusLabels = {
            unchecked: 'Noch nicht KI-geprüft',
            valid: 'KI-verifiziert (+15 XP)',
            partial: 'Teilweise korrekt · Nuance prüfen',
            wrong: 'Fachliche Abweichung / falscher Ast'
        };
        const statusColor = term.ai_status === 'valid' ? '#34d399' : (term.ai_status === 'wrong' ? '#f87171' : '#fbbf24');

        tutorEl.innerHTML = `
            <strong style="color:${escapeHtml(catCfg.color)};">Eigener Begriff · ${escapeHtml(catCfg.shortLabel || catCfg.label)}</strong><br>
            <div style="font-weight:700; font-size:0.9rem; margin:3px 0;">„${escapeHtml(term.label)}“</div>
            ${term.note ? `<div style="font-size:0.8rem; color:#cbd5e1; margin-bottom:5px;">Notiz: ${escapeHtml(term.note)}</div>` : ''}
            <div style="font-size:0.76rem; font-weight:600; color:${statusColor}; margin-bottom:4px;">${statusLabels[term.ai_status] || statusLabels.unchecked}</div>
            ${term.ai_feedback ? `
                <div style="margin-top:4px; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.08); border-left:3px solid ${statusColor}; font-size:0.8rem;">
                    ${escapeHtml(term.ai_feedback)}
                </div>
            ` : ''}
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
                <button type="button" class="mm-depot-pin-btn" id="mm-tutor-ut-aicheck">KI-Check</button>
                <button type="button" class="mm-depot-pin-btn" id="mm-tutor-ut-promote" style="border-color:rgba(250,204,21,0.5); color:#fde047;" title="In einen offiziellen Prüfungs-Knoten mit eigener Staatsexamensfrage umwandeln">★ Befördern</button>
                <button type="button" class="mm-depot-pin-btn" id="mm-tutor-ut-depot">Depot</button>
                <button type="button" class="mm-depot-pin-btn" id="mm-tutor-ut-delete" style="border-color:rgba(239,68,68,0.4); color:#fca5a5;">Entfernen</button>
            </div>
        `;

        tutorEl.querySelector('#mm-tutor-ut-aicheck')?.addEventListener('click', () => runAiCheckForUserTerm(term.id));
        tutorEl.querySelector('#mm-tutor-ut-promote')?.addEventListener('click', () => promoteUserTermToOfficialNode(term.id));
        tutorEl.querySelector('#mm-tutor-ut-depot')?.addEventListener('click', async e => {
            const btn = e.currentTarget;
            await saveUserTermToLearningDepot(term);
            btn.textContent = 'Gespeichert';
            btn.disabled = true;
        });
        tutorEl.querySelector('#mm-tutor-ut-delete')?.addEventListener('click', () => deleteUserTerm(term.id));
    }

    function renderUserTermNode(ut) {
        const pos = state.nodePositions[ut.id] || { x: state.rootX, y: state.rootY };
        const catCfg = CATEGORIES[ut.category] || { label: 'Ergänzung', shortLabel: 'Notiz', color: '#38bdf8' };

        const statusMap = {
            unchecked: { cls: '', text: 'Notiz' },
            valid: { cls: 'status-valid', text: '✓ Valid' },
            partial: { cls: 'status-partial', text: 'Nuance' },
            wrong: { cls: 'status-wrong', text: 'Prüfen' }
        };
        const st = statusMap[ut.ai_status] || statusMap.unchecked;
        const isPromoteReady = ut.ai_status === 'valid';

        return `
            <div class="mm-node mm-node-userterm"
                 id="mm-node-dom-${escapeHtml(ut.id)}"
                 style="left: ${pos.x}px; top: ${pos.y}px; --ut-accent: ${escapeHtml(catCfg.color)};"
                 data-userterm-id="${escapeHtml(ut.id)}"
                 title="Eigene Ergänzung (${escapeHtml(catCfg.label)}) – klicken für Details, KI-Check oder Beförderung">
                <div class="mm-ut-top">
                    <span class="mm-ut-dot"></span>
                    <div class="mm-ut-label">${escapeHtml(ut.label)}</div>
                </div>
                ${ut.note ? `<div class="mm-ut-note-preview">${escapeHtml(ut.note)}</div>` : ''}
                <div class="mm-ut-bottom">
                    <span class="mm-ut-status-pill ${st.cls}">${st.text}</span>
                    <div class="mm-ut-mini-actions">
                        <button type="button" class="mm-ut-mini-btn" data-ut-aicheck="${escapeHtml(ut.id)}" title="Fachlich per KI prüfen">KI</button>
                        <button type="button" class="mm-ut-mini-btn ${isPromoteReady ? 'is-promote-ready' : ''}" data-ut-promote="${escapeHtml(ut.id)}" title="Zu offiziellem Prüfungs-Knoten befördern">★</button>
                        <button type="button" class="mm-ut-mini-btn" data-ut-delete="${escapeHtml(ut.id)}" title="Zusatzbegriff löschen">×</button>
                    </div>
                </div>
            </div>
        `;
    }

    function openUserTermModal(preselectedCategory = null, preselectedParentId = null) {
        if (!state.currentMap) return;
        closeOpenPopovers();

        const map = state.currentMap;
        const existing = document.querySelector('.mm-synapse-modal-backdrop');
        if (existing) existing.remove();

        const safeCategory = (typeof preselectedCategory === 'string' && CATEGORIES[preselectedCategory])
            ? preselectedCategory
            : 'pathophysiology';
        const safeParentId = typeof preselectedParentId === 'string' ? preselectedParentId : '';

        const backdrop = document.createElement('div');
        backdrop.className = 'mm-synapse-modal-backdrop';

        const renderModalInner = (selectedCat, selectedParent) => {
            const solvedNodesInCat = map.nodes.filter(n => n.category === selectedCat && state.solvedNodeIds.has(n.id));
            const allTerms = getUserTermsForMap(map);
            const termsInCat = allTerms.filter(t => t.category === selectedCat);
            const catCfg = CATEGORIES[selectedCat];

            backdrop.innerHTML = `
                <div class="mm-synapse-modal">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="mm-cat-dot" style="background:${escapeHtml(catCfg.color)}; width:9px; height:9px;"></span>
                            <span style="font-size:0.86rem; font-weight:700; color:var(--text-main, #f8fafc);">
                                Zusatzbegriffe · ${escapeHtml(catCfg.label)}
                            </span>
                        </div>
                        <button type="button" id="mm-ut-modal-close" class="mm-clean-btn is-icon-only" aria-label="Schließen">×</button>
                    </div>

                    <p style="font-size:0.8rem; color:var(--text-muted, #94a3b8); margin:0 0 12px;">
                        Mehrere Begriffe einfach mit <strong>;</strong> oder <strong>Enter</strong> trennen. Verifizierte Ergänzungen lassen sich per <strong>★</strong> zu einem Prüfungs-Knoten befördern.
                    </p>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                        <div>
                            <label for="mm-ut-cat-select" style="display:block; font-size:0.74rem; font-weight:600; margin-bottom:4px; color:#94a3b8;">Kategorieast</label>
                            <select id="mm-ut-cat-select" class="mm-studio-select" style="width:100%; max-width:none;">
                                ${Object.entries(CATEGORIES).map(([key, cfg]) => `
                                    <option value="${key}" ${key === selectedCat ? 'selected' : ''}>${escapeHtml(cfg.label)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="mm-ut-parent-select" style="display:block; font-size:0.74rem; font-weight:600; margin-bottom:4px; color:#94a3b8;">Anhängen an</label>
                            <select id="mm-ut-parent-select" class="mm-studio-select" style="width:100%; max-width:none;">
                                <option value="">Hauptast (${escapeHtml(catCfg.shortLabel || catCfg.label)})</option>
                                ${solvedNodesInCat.map(n => `
                                    <option value="${escapeHtml(n.id)}" ${n.id === selectedParent ? 'selected' : ''}>↳ ${escapeHtml(n.label)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <label for="mm-ut-input-label" style="display:block; font-size:0.74rem; font-weight:600; margin-bottom:4px; color:#94a3b8;">Begriff(e)</label>
                    <textarea id="mm-ut-input-label" class="mm-recall-textarea" style="min-height:60px; margin-top:0; margin-bottom:10px;" placeholder="z. B. Morphin verzögert P2Y12-Resorption;&#10;V3r/V4r bei inferiorem STEMI obligat"></textarea>

                    <label for="mm-ut-input-note" style="display:block; font-size:0.74rem; font-weight:600; margin-bottom:4px; color:#94a3b8;">Optionaler Zusammenhang / Merksatz</label>
                    <input type="text" id="mm-ut-input-note" class="mm-lib-search-input" style="max-width:100%; width:100%; margin-bottom:12px;" placeholder="Warum gehört das hierher? (optional)" />

                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="font-size:0.73rem; color:#94a3b8;">
                            ${state.blindMode ? 'Blind-Modus aktiv: Begriffe an ungelösten Ästen erscheinen nach deren Lösung.' : 'Wird kompakt und überlappungsfrei am Ast angeheftet.'}
                        </span>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button type="button" id="mm-ut-save-only" class="mm-clean-btn">Anheften</button>
                            <button type="button" id="mm-ut-save-aicheck" class="mm-clean-btn is-primary">Anheften & KI-Check</button>
                        </div>
                    </div>

                    <div style="margin-top:15px; padding-top:11px; border-top:1px solid rgba(148,163,184,0.14);">
                        <div style="font-size:0.75rem; font-weight:700; color:#cbd5e1;">
                            Notiert in ${escapeHtml(catCfg.shortLabel || catCfg.label)} (${termsInCat.length}) · Gesamt: ${allTerms.length}
                        </div>
                        ${termsInCat.length === 0 ? `
                            <div style="font-size:0.76rem; color:#64748b; margin-top:6px;">Noch keine eigenen Zusatzbegriffe in dieser Kategorie.</div>
                        ` : `
                            <div class="mm-ut-modal-list">
                                ${termsInCat.map(t => `
                                    <div class="mm-ut-modal-row">
                                        <div style="flex:1; min-width:0;">
                                            <div style="font-weight:700; font-size:0.82rem;">${escapeHtml(t.label)}</div>
                                            ${t.note ? `<div style="font-size:0.73rem; color:#94a3b8; margin-top:2px;">${escapeHtml(t.note)}</div>` : ''}
                                            ${t.ai_feedback ? `<div style="font-size:0.72rem; color:#38bdf8; margin-top:3px;">KI: ${escapeHtml(t.ai_feedback)}</div>` : ''}
                                        </div>
                                        <div style="display:flex; gap:4px; flex-shrink:0;">
                                            <button type="button" class="mm-ut-mini-btn" data-modal-ut-ai="${escapeHtml(t.id)}" title="Mit KI prüfen">KI</button>
                                            <button type="button" class="mm-ut-mini-btn ${t.ai_status === 'valid' ? 'is-promote-ready' : ''}" data-modal-ut-promote="${escapeHtml(t.id)}" title="Zu offiziellem Prüfungs-Knoten befördern">★</button>
                                            <button type="button" class="mm-ut-mini-btn" data-modal-ut-del="${escapeHtml(t.id)}" title="Löschen">×</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;

            backdrop.querySelector('#mm-ut-modal-close')?.addEventListener('click', () => backdrop.remove());
            backdrop.querySelector('#mm-ut-cat-select')?.addEventListener('change', e => {
                renderModalInner(e.target.value, '');
            });

            const submitTerms = async withAi => {
                const catVal = backdrop.querySelector('#mm-ut-cat-select')?.value || selectedCat;
                const parentVal = backdrop.querySelector('#mm-ut-parent-select')?.value || null;
                const rawVal = backdrop.querySelector('#mm-ut-input-label')?.value || '';
                const noteVal = backdrop.querySelector('#mm-ut-input-note')?.value || '';
                if (!rawVal.trim()) return;

                backdrop.remove();
                await addUserTermsToCurrentMap({
                    category: catVal,
                    parentId: parentVal || null,
                    rawInput: rawVal,
                    note: noteVal,
                    runAiCheck: withAi
                });
            };

            backdrop.querySelector('#mm-ut-save-only')?.addEventListener('click', () => submitTerms(false));
            backdrop.querySelector('#mm-ut-save-aicheck')?.addEventListener('click', () => submitTerms(true));

            backdrop.querySelectorAll('[data-modal-ut-ai]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-modal-ut-ai');
                    btn.textContent = '...';
                    btn.disabled = true;
                    await runAiCheckForUserTerm(id);
                    renderModalInner(selectedCat, selectedParent);
                });
            });

            backdrop.querySelectorAll('[data-modal-ut-promote]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-modal-ut-promote');
                    backdrop.remove();
                    await promoteUserTermToOfficialNode(id);
                });
            });

            backdrop.querySelectorAll('[data-modal-ut-del]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-modal-ut-del');
                    await deleteUserTerm(id);
                    renderModalInner(selectedCat, selectedParent);
                });
            });

            backdrop.querySelector('#mm-ut-input-label')?.focus();
        };

        backdrop.addEventListener('click', e => {
            if (e.target === backdrop) backdrop.remove();
        });

        document.body.appendChild(backdrop);
        renderModalInner(safeCategory, safeParentId);
    }

    // ========================================================================
    // 3. TOPOLOGIE-ENGINE (N-EBENEN, ZYKLUS-SCHUTZ, USER-TERMS & COLLAPSE)
    // ========================================================================

    function buildTreeTopology(mindmap) {
        const nodes = Array.isArray(mindmap?.nodes) ? mindmap.nodes : [];
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        const childrenMap = new Map();
        childrenMap.set('root', []);
        nodes.forEach(n => childrenMap.set(n.id, []));

        // Eltern-Kind-Beziehungen mit Zyklus- & Waisen-Schutz aufbauen
        nodes.forEach(node => {
            let pid = node.parent_id || 'root';
            if (pid !== 'root' && !nodeById.has(pid)) {
                pid = 'root';
                node.parent_id = 'root';
            }
            if (pid !== 'root') {
                const visited = new Set([node.id]);
                let cursor = pid;
                let hasCycle = false;
                while (cursor && cursor !== 'root') {
                    if (visited.has(cursor)) {
                        hasCycle = true;
                        break;
                    }
                    visited.add(cursor);
                    cursor = nodeById.get(cursor)?.parent_id || 'root';
                }
                if (hasCycle) {
                    pid = 'root';
                    node.parent_id = 'root';
                }
            }
            childrenMap.get(pid).push(node.id);
        });

        // Sichtbare eigene Zusatzbegriffe als überlappungsfreie Blattknoten einhängen
        const renderableTerms = getRenderableUserTerms(mindmap);
        const userTermIds = new Set();
        renderableTerms.forEach(ut => {
            userTermIds.add(ut.id);
            childrenMap.set(ut.id, []);
            const anchorId = childrenMap.has(ut.anchorParentId) ? ut.anchorParentId : 'root';
            childrenMap.get(anchorId).push(ut.id);
        });

        const meta = {};
        let maxDepth = 1;

        function traverseHidden(nodeId, depth, branchRootId) {
            if (depth > maxDepth) maxDepth = depth;
            const childrenIds = childrenMap.get(nodeId) || [];
            meta[nodeId] = {
                depth,
                childrenIds,
                visibleChildrenIds: [],
                subtreeLeaves: 1,
                branchRootId,
                hiddenByCollapse: true,
                isUserTerm: userTermIds.has(nodeId),
                side: 'right'
            };
            childrenIds.forEach(cid => traverseHidden(cid, depth + 1, branchRootId));
        }

        function traverse(nodeId, depth, branchRootId, parentCollapsed) {
            if (depth > maxDepth) maxDepth = depth;
            const childrenIds = childrenMap.get(nodeId) || [];
            const isCollapsed = state.collapsedNodeIds.has(nodeId);
            const visibleChildren = isCollapsed ? [] : childrenIds;

            let visibleLeaves = 0;
            if (visibleChildren.length === 0) {
                visibleLeaves = 1;
            } else {
                visibleChildren.forEach(cid => {
                    visibleLeaves += traverse(cid, depth + 1, branchRootId, parentCollapsed || isCollapsed);
                });
            }

            if (isCollapsed && childrenIds.length > 0) {
                childrenIds.forEach(cid => traverseHidden(cid, depth + 1, branchRootId));
            }

            meta[nodeId] = {
                depth,
                childrenIds,
                visibleChildrenIds: visibleChildren,
                subtreeLeaves: Math.max(1, visibleLeaves),
                branchRootId,
                hiddenByCollapse: parentCollapsed,
                isUserTerm: userTermIds.has(nodeId),
                side: 'right'
            };

            return Math.max(1, visibleLeaves);
        }

        const rootChildren = childrenMap.get('root') || [];
        rootChildren.forEach(rootChildId => {
            traverse(rootChildId, 1, rootChildId, false);
        });

        state.nodeMeta = meta;
        state.maxTreeDepth = maxDepth;
        return { rootChildren, childrenMap, meta, maxDepth };
    }

    function getDescendantIds(nodeId) {
        const result = [];
        const stack = [...(state.nodeMeta[nodeId]?.childrenIds || [])];
        while (stack.length > 0) {
            const current = stack.pop();
            result.push(current);
            const kids = state.nodeMeta[current]?.childrenIds || [];
            kids.forEach(k => stack.push(k));
        }
        return result;
    }

    function isNodeHiddenByCollapse(nodeId) {
        return Boolean(state.nodeMeta[nodeId]?.hiddenByCollapse);
    }

    function toggleSubtreeCollapse(nodeId) {
        if (!state.currentMap) return;
        if (state.collapsedNodeIds.has(nodeId)) {
            state.collapsedNodeIds.delete(nodeId);
        } else {
            state.collapsedNodeIds.add(nodeId);
        }
        computeLayout(state.currentMap);
        renderModule();
        requestAnimationFrame(() => {
            fitStageToViewport();
            drawSvgConnections();
        });
    }
   // ========================================================================
    // 4. DISTRAKTOR-GENERATOR, SCHWIERIGKEITS-PRESETS & SCHWACHSTELLEN-DRILL
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

        return candidates.slice(0, 4);
    }

    function applyDifficultyPreset(presetName) {
        state.openPopover = null;
        state.difficultyPreset = presetName;
        if (presetName === 'guided') {
            state.blindMode = false;
            state.strictCausalOrder = true;
            state.deepComprehensionMode = false;
            state.activeRecallFirstMode = false;
            state.includeDistractors = false;
            state.hideRelationLabels = false;
            state.blindRootMode = false;
        } else if (presetName === 'clinical') {
            state.blindMode = false;
            state.strictCausalOrder = true;
            state.deepComprehensionMode = true;
            state.activeRecallFirstMode = false;
            state.includeDistractors = true;
            state.hideRelationLabels = false;
            state.blindRootMode = false;
        } else if (presetName === 'exam') {
            state.blindMode = true;
            state.strictCausalOrder = true;
            state.deepComprehensionMode = true;
            state.activeRecallFirstMode = true;
            state.includeDistractors = true;
            state.hideRelationLabels = true;
            state.blindRootMode = true;
            state.rootRevealed = false;
        }

        rebuildPoolOrder();
        if (state.currentMap) computeLayout(state.currentMap);
        renderModule();
        if (state.viewMode === 'canvas') {
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        }
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

    function startWeakNodeDrill(explicitTargetIds = null) {
        if (!state.currentMap) return;
        const savedWeak = Array.isArray(state.progressCache[state.currentMap.id]?.weak_nodes)
            ? state.progressCache[state.currentMap.id].weak_nodes
            : [];
        const sourceList = Array.isArray(explicitTargetIds) && explicitTargetIds.length > 0
            ? explicitTargetIds
            : ([...state.weakNodeIds, ...state.uncertainNodeIds].length > 0
                ? [...state.weakNodeIds, ...state.uncertainNodeIds]
                : savedWeak);

        const validNodeIds = new Set(state.currentMap.nodes.map(n => n.id));
        const targets = new Set(sourceList.filter(id => validNodeIds.has(id)));
        if (targets.size === 0) return;

        // Nur echte Knoten-Nachfahren zurücksetzen (User-Terms bleiben unangetastet)
        const toReset = new Set();
        targets.forEach(id => {
            toReset.add(id);
            getDescendantIds(id).forEach(descId => {
                if (validNodeIds.has(descId)) toReset.add(descId);
            });
        });

        state.openPopover = null;
        state.viewMode = 'canvas';
        state.collapsedNodeIds.clear();
        state.solvedNodeIds = new Set(
            state.currentMap.nodes
                .map(n => n.id)
                .filter(id => !toReset.has(id))
        );
        state.weakNodeIds.clear();
        state.uncertainNodeIds.clear();
        state.selectedChipId = null;
        state.poolSearchQuery = '';
        state.mistakesCount = 0;
        state.streakCount = 0;
        state.startTime = Date.now();

        rebuildPoolOrder();
        computeLayout(state.currentMap);
        renderModule();
        requestAnimationFrame(() => {
            fitStageToViewport();
            drawSvgConnections();
            const tutorEl = document.getElementById('mm-tutor-message');
            if (tutorEl) {
                tutorEl.innerHTML = `<strong style="color:#f59e0b;">Schwachstellen-Drill gestartet (${toReset.size} Knoten)</strong><br>Alle sicher gemeisterten Konzepte bleiben verankert. Festige jetzt gezielt deine Wackelkandidaten.`;
            }
        });
    }

    // ========================================================================
    // 5. GARANTIERT ÜBERLAPPUNGSFREIE DUAL-LAYOUT-ENGINE (TIDY-TREE & RADIAL)
    // ========================================================================

    function computeLayout(mindmap) {
        if (!mindmap) return;
        const topology = buildTreeTopology(mindmap);
        if (state.layoutMode === 'radial') {
            computeWeightedRadialLayout(mindmap, topology);
        } else {
            computeBidirectionalTreeLayout(mindmap, topology);
        }
    }

    function computeBidirectionalTreeLayout(mindmap, topology) {
        const { rootChildren, meta } = topology;
        const { COL_SPACING_X, ROOT_GAP_X, ROW_SPACING_Y, BRANCH_EXTRA_GAP_Y, STAGE_PADDING_X, STAGE_PADDING_Y, MIN_STAGE_W, MIN_STAGE_H } = LAYOUT_CONFIG;

        const rightRoots = [];
        const leftRoots = [];
        let rightWeight = 0;
        let leftWeight = 0;

        const sortedForBalance = [...rootChildren].sort((a, b) => (meta[b]?.subtreeLeaves || 1) - (meta[a]?.subtreeLeaves || 1));
        const sideAssignment = new Map();

        sortedForBalance.forEach(rootId => {
            const w = meta[rootId]?.subtreeLeaves || 1;
            if (rightWeight <= leftWeight) {
                sideAssignment.set(rootId, 'right');
                rightWeight += w;
            } else {
                sideAssignment.set(rootId, 'left');
                leftWeight += w;
            }
        });

        rootChildren.forEach(rootId => {
            if (sideAssignment.get(rootId) === 'left') {
                leftRoots.push(rootId);
            } else {
                rightRoots.push(rootId);
            }
        });

        function getMaxDepthForSubtree(nodeId) {
            const m = meta[nodeId];
            if (!m || m.visibleChildrenIds.length === 0) return m?.depth || 1;
            return Math.max(...m.visibleChildrenIds.map(getMaxDepthForSubtree));
        }

        const maxDepthRight = rightRoots.length > 0 ? Math.max(...rightRoots.map(getMaxDepthForSubtree)) : 1;
        const maxDepthLeft = leftRoots.length > 0 ? Math.max(...leftRoots.map(getMaxDepthForSubtree)) : 1;

        const rightSpanX = rightRoots.length > 0 ? ROOT_GAP_X + Math.max(0, maxDepthRight - 1) * COL_SPACING_X : 260;
        const leftSpanX = leftRoots.length > 0 ? ROOT_GAP_X + Math.max(0, maxDepthLeft - 1) * COL_SPACING_X : 260;

        function computeSideHeight(branchRootIds) {
            if (branchRootIds.length === 0) return ROW_SPACING_Y;
            const totalLeaves = branchRootIds.reduce((sum, id) => sum + (meta[id]?.subtreeLeaves || 1), 0);
            return totalLeaves * ROW_SPACING_Y + Math.max(0, branchRootIds.length - 1) * BRANCH_EXTRA_GAP_Y;
        }

        const rightHeight = computeSideHeight(rightRoots);
        const leftHeight = computeSideHeight(leftRoots);
        const contentHeight = Math.max(rightHeight, leftHeight);

        const leftReq = leftSpanX + STAGE_PADDING_X;
        const rightReq = rightSpanX + STAGE_PADDING_X;
        const stageWidth = Math.max(MIN_STAGE_W, Math.round(leftReq + rightReq));
        const stageHeight = Math.max(MIN_STAGE_H, Math.round(contentHeight + STAGE_PADDING_Y * 2));
        const extraW = stageWidth - (leftReq + rightReq);

        const rootX = Math.round(leftReq + extraW / 2);
        const rootY = Math.round(stageHeight / 2);

        state.stageWidth = stageWidth;
        state.stageHeight = stageHeight;
        state.rootX = rootX;
        state.rootY = rootY;

        const positions = {
            root: { x: rootX, y: rootY, angle: 0, level: 0, side: 'center' }
        };

        function assignSubtreePositions(nodeId, side, yTop) {
            const m = meta[nodeId];
            if (!m) return yTop;
            m.side = side;

            const dir = side === 'right' ? 1 : -1;
            const x = rootX + dir * (ROOT_GAP_X + (m.depth - 1) * COL_SPACING_X);
            const kids = m.visibleChildrenIds || [];

            if (kids.length === 0) {
                const y = yTop + ROW_SPACING_Y / 2;
                positions[nodeId] = { x, y, angle: side === 'right' ? 0 : Math.PI, level: m.depth, side };
                if (m.childrenIds.length > 0) {
                    getDescendantIds(nodeId).forEach(descId => {
                        positions[descId] = { x, y, angle: 0, level: meta[descId]?.depth || m.depth + 1, side };
                        if (meta[descId]) meta[descId].side = side;
                    });
                }
                return yTop + ROW_SPACING_Y;
            }

            let cursorY = yTop;
            const childCenters = [];
            kids.forEach(cid => {
                const nextCursor = assignSubtreePositions(cid, side, cursorY);
                childCenters.push(positions[cid].y);
                cursorY = nextCursor;
            });

            const y = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
            positions[nodeId] = { x, y, angle: side === 'right' ? 0 : Math.PI, level: m.depth, side };
            return cursorY;
        }

        let cursorRightY = rootY - rightHeight / 2;
        rightRoots.forEach((rootId, idx) => {
            cursorRightY = assignSubtreePositions(rootId, 'right', cursorRightY);
            if (idx < rightRoots.length - 1) cursorRightY += BRANCH_EXTRA_GAP_Y;
        });

        let cursorLeftY = rootY - leftHeight / 2;
        leftRoots.forEach((rootId, idx) => {
            cursorLeftY = assignSubtreePositions(rootId, 'left', cursorLeftY);
            if (idx < leftRoots.length - 1) cursorLeftY += BRANCH_EXTRA_GAP_Y;
        });

        state.nodePositions = positions;
    }

    function computeWeightedRadialLayout(mindmap, topology) {
        const { rootChildren, meta, maxDepth } = topology;
        const totalLeaves = Math.max(1, rootChildren.reduce((sum, id) => sum + (meta[id]?.subtreeLeaves || 1), 0));

        const minArcPerLeaf = 290;
        const requiredOuterRadius = Math.max(520 + (maxDepth - 1) * 430, (totalLeaves * minArcPerLeaf) / (2 * Math.PI));
        const ringStep = Math.max(410, Math.round(requiredOuterRadius / Math.max(1, maxDepth)));

        const maxRadius = ringStep * Math.max(1, maxDepth) + 320;
        const stageWidth = Math.max(LAYOUT_CONFIG.MIN_STAGE_W, Math.round(maxRadius * 2.25));
        const stageHeight = Math.max(LAYOUT_CONFIG.MIN_STAGE_H, Math.round(maxRadius * 1.95));
        const centerX = Math.round(stageWidth / 2);
        const centerY = Math.round(stageHeight / 2);

        state.stageWidth = stageWidth;
        state.stageHeight = stageHeight;
        state.rootX = centerX;
        state.rootY = centerY;

        const positions = {
            root: { x: centerX, y: centerY, angle: 0, level: 0, side: 'center' }
        };

        function placeRadialSubtree(nodeId, startAngle, endAngle) {
            const m = meta[nodeId];
            if (!m) return;
            const midAngle = (startAngle + endAngle) / 2;
            const radiusX = m.depth * ringStep * 1.12;
            const radiusY = m.depth * ringStep * 0.92;
            const x = centerX + radiusX * Math.cos(midAngle);
            const y = centerY + radiusY * Math.sin(midAngle);
            const side = Math.cos(midAngle) >= 0 ? 'right' : 'left';
            m.side = side;
            positions[nodeId] = { x, y, angle: midAngle, level: m.depth, side };

            const kids = m.visibleChildrenIds || [];
            if (kids.length === 0) {
                if (m.childrenIds.length > 0) {
                    getDescendantIds(nodeId).forEach(descId => {
                        positions[descId] = { x, y, angle: midAngle, level: meta[descId]?.depth || m.depth + 1, side };
                        if (meta[descId]) meta[descId].side = side;
                    });
                }
                return;
            }

            const totalChildLeaves = kids.reduce((s, cid) => s + (meta[cid]?.subtreeLeaves || 1), 0);
            let cursorAngle = startAngle;
            kids.forEach(cid => {
                const weight = (meta[cid]?.subtreeLeaves || 1) / Math.max(1, totalChildLeaves);
                const slice = (endAngle - startAngle) * weight;
                placeRadialSubtree(cid, cursorAngle, cursorAngle + slice);
                cursorAngle += slice;
            });
        }

        let angleCursor = -Math.PI / 2;
        rootChildren.forEach(rootId => {
            const weight = (meta[rootId]?.subtreeLeaves || 1) / totalLeaves;
            const slice = 2 * Math.PI * weight;
            placeRadialSubtree(rootId, angleCursor, angleCursor + slice);
            angleCursor += slice;
        });

        const visibleIds = Object.keys(positions).filter(id => id !== 'root' && !isNodeHiddenByCollapse(id));
        for (let iter = 0; iter < 28; iter++) {
            for (let i = 0; i < visibleIds.length; i++) {
                for (let j = i + 1; j < visibleIds.length; j++) {
                    const a = positions[visibleIds[i]];
                    const b = positions[visibleIds[j]];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const minDx = 335;
                    const minDy = 165;
                    if (Math.abs(dx) < minDx && Math.abs(dy) < minDy) {
                        const pushX = ((minDx - Math.abs(dx)) / 2) * (dx >= 0 ? 1 : -1);
                        const pushY = ((minDy - Math.abs(dy)) / 2) * (dy >= 0 ? 1 : -1);
                        a.x = Math.max(185, Math.min(stageWidth - 185, a.x - pushX * 0.55));
                        b.x = Math.max(185, Math.min(stageWidth - 185, b.x + pushX * 0.55));
                        a.y = Math.max(115, Math.min(stageHeight - 115, a.y - pushY * 0.7));
                        b.y = Math.max(115, Math.min(stageHeight - 115, b.y + pushY * 0.7));
                    }
                }
            }
        }

        state.nodePositions = positions;
    }

    // ========================================================================
    // 6. KAMERA-STEUERUNG (AUTO-FIT, FOKUS AUF NÄCHSTEN SLOT, PAN & ZOOM)
    // ========================================================================

    function fitStageToViewport() {
        const viewport = document.getElementById('mm-canvas-viewport');
        if (!viewport) return;

        const vw = viewport.clientWidth || 960;
        const vh = viewport.clientHeight || 740;

        const pts = Object.entries(state.nodePositions)
            .filter(([id]) => id === 'root' || !isNodeHiddenByCollapse(id))
            .map(([, p]) => p);
        if (pts.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
            if (p.x - 190 < minX) minX = p.x - 190;
            if (p.x + 190 > maxX) maxX = p.x + 190;
            if (p.y - 110 < minY) minY = p.y - 110;
            if (p.y + 110 > maxY) maxY = p.y + 110;
        });

        const contentW = Math.max(820, maxX - minX);
        const contentH = Math.max(600, maxY - minY);
        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;

        const scaleX = (vw - 64) / contentW;
        const scaleY = (vh - 84) / contentH;
        const bestScale = Math.max(0.28, Math.min(1.02, Math.min(scaleX, scaleY)));

        state.zoom = Number(bestScale.toFixed(2));
        state.panX = Math.round(vw / 2 - contentCenterX * state.zoom);
        state.panY = Math.round(vh / 2 - contentCenterY * state.zoom);

        applyStageTransform();
    }

    function focusCameraOnNode(nodeId, targetZoom = 0.88) {
        const viewport = document.getElementById('mm-canvas-viewport');
        const pos = state.nodePositions[nodeId];
        if (!viewport || !pos) return;

        const vw = viewport.clientWidth || 960;
        const vh = viewport.clientHeight || 740;
        state.zoom = Math.max(state.zoom, targetZoom);
        state.panX = Math.round(vw / 2 - pos.x * state.zoom);
        state.panY = Math.round(vh / 2 - pos.y * state.zoom);
        applyStageTransform();

        const domEl = document.getElementById(`mm-node-dom-${nodeId}`);
        if (domEl) {
            domEl.classList.remove('drag-over');
            void domEl.offsetWidth;
            domEl.classList.add('drag-over');
            setTimeout(() => domEl.classList.remove('drag-over'), 1100);
        }
    }

    function focusNextOpenSlot() {
        if (!state.currentMap) return;
        const openUnlocked = state.currentMap.nodes
            .filter(n => !state.solvedNodeIds.has(n.id) && !isSlotCurrentlyLocked(n))
            .sort((a, b) => (state.nodeMeta[a.id]?.depth || 1) - (state.nodeMeta[b.id]?.depth || 1));

        if (openUnlocked.length === 0) {
            fitStageToViewport();
            return;
        }
        const nextNode = openUnlocked[0];

        let parentCursor = nextNode.parent_id;
        let reopened = false;
        while (parentCursor && parentCursor !== 'root') {
            if (state.collapsedNodeIds.has(parentCursor)) {
                state.collapsedNodeIds.delete(parentCursor);
                reopened = true;
            }
            parentCursor = state.currentMap.nodes.find(n => n.id === parentCursor)?.parent_id;
        }
        if (reopened) {
            computeLayout(state.currentMap);
            renderModule();
            requestAnimationFrame(() => {
                drawSvgConnections();
                focusCameraOnNode(nextNode.id, 0.85);
                showSlotSocraticHint(nextNode.id);
            });
        } else {
            focusCameraOnNode(nextNode.id, 0.85);
            showSlotSocraticHint(nextNode.id);
        }
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
        const newZoom = Math.max(0.24, Math.min(1.65, Number((oldZoom + delta).toFixed(2))));
        if (newZoom === oldZoom) return;

        const cx = viewport.clientWidth / 2;
        const cy = viewport.clientHeight / 2;
        state.panX = Math.round(cx - ((cx - state.panX) / oldZoom) * newZoom);
        state.panY = Math.round(cy - ((cy - state.panY) / oldZoom) * newZoom);
        state.zoom = newZoom;

        applyStageTransform();
    }

    // ========================================================================
    // 7. RENDERING (V7.3 CLEAN MINIMALIST STUDIO) & ANTI-SPOILER KAUSAL-LOGIK
    // ========================================================================

    function selectMindmap(mindmapId, options = {}) {
        const found = state.mindmaps.find(m => m.id === mindmapId) || state.mindmaps[0];
        if (!found) {
            state.currentMap = null;
            renderModule();
            return;
        }

        state.openPopover = null;
        state.currentMap = found;
        state.activeFolderId = resolveFolderForMindmap(found).id;
        if (!options.keepFolderView) {
            state.viewMode = 'canvas';
        }
        state.solvedNodeIds = new Set();
        state.eliminatedDistractorIds = new Set();
        state.uncertainNodeIds = new Set();
        state.collapsedNodeIds = new Set();
        state.selectedChipId = null;
        state.poolSearchQuery = '';
        state.mistakesCount = 0;
        state.streakCount = 0;
        state.maxStreak = 0;
        state.weakNodeIds = new Set();
        state.synthesisCompleted = false;
        state.rootRevealed = false;
        state.startTime = Date.now();

        rebuildPoolOrder();
        computeLayout(found);
        renderModule();
        if (state.viewMode === 'canvas') {
            requestAnimationFrame(() => {
                fitStageToViewport();
                drawSvgConnections();
            });
        }
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
        return '[Zentraldiagnose deduzieren]';
    }

    function getParentLabel(node, forceReveal = false) {
        if (!node.parent_id || node.parent_id === 'root') {
            return getRootDisplayTitle(forceReveal);
        }
        const parent = state.currentMap?.nodes.find(n => n.id === node.parent_id);
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

    function updateLiveTelemetryCounters() {
        const streakEl = document.getElementById('mm-stat-streak');
        if (streakEl) streakEl.textContent = String(state.streakCount);

        const mistakesEl = document.getElementById('mm-stat-mistakes');
        if (mistakesEl) {
            mistakesEl.textContent = String(state.mistakesCount);
            mistakesEl.classList.toggle('is-warn', state.mistakesCount > 0);
        }
    }

    function getPoolItemsForCurrentState(applySearchFilter = true) {
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

        if (applySearchFilter && state.poolSearchQuery.trim()) {
            const q = normalizeSearchText(state.poolSearchQuery);
            return ordered.filter(item => {
                const catLabel = normalizeSearchText(CATEGORIES[item.category]?.label || '');
                return normalizeSearchText(item.label).includes(q) || (!state.blindMode && catLabel.includes(q));
            });
        }
        return ordered;
    }

    function renderPoolChipsHtml(poolItems, allRealSolved, totalNodes) {
        const weakOrUncertainCount = new Set([...state.weakNodeIds, ...state.uncertainNodeIds]).size;

        if (allRealSolved) {
            const activeDist = getActiveDistractors(state.currentMap);
            const remainingDist = activeDist.filter(d => !state.eliminatedDistractorIds.has(d.id));
            const crossLinksWithQuestions = (state.currentMap.cross_links || []).filter(cl => cl.synthesis_question);

            return `
                <div class="mm-all-solved-banner">
                    Alle ${totalNodes} Knoten verifiziert.
                    ${remainingDist.length > 0 ? `
                        <div style="margin-top:5px; font-size:0.76rem; color:#fcd34d;">
                            Noch ${remainingDist.length} offene DD-Falle(n) im Pool – zur Prüfung in die Quarantäne ziehen.
                        </div>
                    ` : ''}
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                        ${weakOrUncertainCount > 0 ? `
                            <button type="button" id="mm-btn-weak-drill" class="mm-depot-pin-btn" style="border-color:rgba(245,158,11,0.55); color:#fbbf24;">
                                Drill (${weakOrUncertainCount})
                            </button>
                            <button type="button" id="mm-btn-save-weak-depot" class="mm-depot-pin-btn">
                                Ins Lern-Depot
                            </button>
                        ` : ''}
                        ${crossLinksWithQuestions.length > 0 ? `
                            <button type="button" id="mm-btn-run-synthesis" class="mm-depot-pin-btn" style="border-color:rgba(16,185,129,0.5); color:#34d399;">
                                Synthese (${crossLinksWithQuestions.length})
                            </button>
                        ` : ''}
                    </div>
                </div>
                ${remainingDist.map(item => renderSingleChipHtml(item)).join('')}
            `;
        }

        if (poolItems.length === 0) {
            return `<div style="padding:14px; text-align:center; color:#94a3b8; font-size:0.8rem;">Keine Treffer für „${escapeHtml(state.poolSearchQuery)}“.</div>`;
        }

        return poolItems.map(item => renderSingleChipHtml(item)).join('');
    }

    function renderSingleChipHtml(item) {
        const catCfg = CATEGORIES[item.category];
        const catClass = state.blindMode ? 'cat-blind' : (catCfg?.cssClass || 'cat-blind');
        const isSelected = state.selectedChipId === item.id ? 'selected-chip' : '';
        const isEliminated = state.eliminatedDistractorIds.has(item.id) ? 'distractor-eliminated' : '';
        const depth = !item.is_distractor ? (state.nodeMeta[item.id]?.depth || 1) : null;

        let subBadgeText = 'Konzept';
        if (isEliminated) {
            subBadgeText = 'Enttarnte DD-Falle';
        } else if (!state.blindMode && catCfg) {
            const catShort = catCfg.shortLabel || catCfg.label;
            subBadgeText = (state.difficultyPreset === 'guided' && depth)
                ? `${catShort} · E${depth}`
                : catShort;
        }

        return `
            <div class="mm-chip ${catClass} ${isSelected} ${isEliminated}"
                 data-node-id="${escapeHtml(item.id)}"
                 draggable="false"
                 title="${isEliminated ? 'Als klinische Falle enttarnt' : 'Auf einen passenden Slot ziehen oder bei Verdacht auf Falle in die DD-Quarantäne ziehen'}">
                <span class="mm-chip-cat-tag">${escapeHtml(subBadgeText)}</span>
                <span class="mm-chip-label">${escapeHtml(item.label)}</span>
            </div>
        `;
    }

    function renderCompactTierTelemetry(map) {
        const depthStats = {};
        map.nodes.forEach(n => {
            const d = state.nodeMeta[n.id]?.depth || 1;
            if (!depthStats[d]) depthStats[d] = { total: 0, solved: 0 };
            depthStats[d].total += 1;
            if (state.solvedNodeIds.has(n.id)) depthStats[d].solved += 1;
        });

        const depths = Object.keys(depthStats).map(Number).sort((a, b) => a - b);
        const activeDistractors = getActiveDistractors(map);
        const eliminatedCount = activeDistractors.filter(d => state.eliminatedDistractorIds.has(d.id)).length;

        const tierSpans = depths.map(d => {
            const st = depthStats[d];
            const done = st.solved === st.total;
            return `<span class="mm-tier-inline-item ${done ? 'is-done' : ''}" title="Ebene ${d}">E${d} ${st.solved}/${st.total}</span>`;
        }).join('');

        const distSpan = (state.includeDistractors && activeDistractors.length > 0)
            ? `<span class="mm-tier-inline-item ${eliminatedCount === activeDistractors.length ? 'is-done' : ''}" title="Enttarnte DD-Fallen">DD ${eliminatedCount}/${activeDistractors.length}</span>`
            : '';

        return `<div class="mm-tier-inline">${tierSpans}${distSpan}</div>`;
    }

    function renderFolderLibraryGridHtml() {
        const folders = getFoldersWithStats();
        const q = normalizeSearchText(state.librarySearchQuery);
        const filterMode = state.libraryFilterMode;

        const matchesFilter = m => {
            const prog = state.progressCache[m.id];
            if (filterMode === 'open' && prog?.completed) return false;
            if (filterMode === 'weak' && !(Array.isArray(prog?.weak_nodes) && prog.weak_nodes.length > 0)) return false;
            if (!q) return true;
            return (
                normalizeSearchText(m.title).includes(q) ||
                normalizeSearchText(m.central_concept).includes(q) ||
                normalizeSearchText(m.specialty).includes(q)
            );
        };

        // ANSICHT A: Globaler Suchtreffer-Modus ODER geöffneter Fachordner -> Mindmap-Karten
        if (state.activeFolderId || q || filterMode !== 'all') {
            const activeFolder = state.activeFolderId ? folders.find(f => f.id === state.activeFolderId) : null;
            const sourceMaps = activeFolder ? activeFolder.maps : state.mindmaps;
            const visibleMaps = sourceMaps.filter(matchesFilter);

            if (visibleMaps.length === 0) {
                return `
                    <div style="padding:28px; text-align:center; border-radius:13px; background:var(--surface-secondary, rgba(15,23,42,0.7)); border:1px dashed var(--card-border, rgba(148,163,184,0.2));">
                        <div style="font-weight:700; margin-bottom:6px;">
                            ${activeFolder ? `Noch keine Mindmaps in „${escapeHtml(activeFolder.label)}“` : 'Keine Mindmaps für diesen Filter gefunden'}
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted, #94a3b8); margin-bottom:14px;">
                            Importiere ein Vorlesungs-JSON direkt in diesen Fachordner oder setze den Filter zurück.
                        </div>
                        <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">
                            <button type="button" class="mm-clean-btn is-primary" data-lib-import-folder="${escapeHtml(activeFolder?.id || '')}">
                                ${UI_ICONS.upload} Hier importieren
                            </button>
                            ${state.activeFolderId ? `<button type="button" class="mm-clean-btn" data-lib-back-root="1">${UI_ICONS.back} Alle Ordner</button>` : ''}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="mm-map-card-grid">
                    ${visibleMaps.map(m => {
                        const folder = resolveFolderForMindmap(m, folders);
                        const prog = state.progressCache[m.id];
                        const nodeCount = (m.nodes || []).length;
                        const depthCount = getMapTreeDepthPreview(m);
                        const weakCount = Array.isArray(prog?.weak_nodes) ? prog.weak_nodes.length : 0;
                        const distCount = (m.distractors || []).length;
                        const crossCount = (m.cross_links || []).length;
                        const userTermsCount = getUserTermsForMap(m).length;

                        return `
                            <div class="mm-map-card" style="--folder-accent:${escapeHtml(folder.color)};">
                                <div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
                                        <span style="display:inline-flex; align-items:center; gap:6px; font-size:0.74rem; font-weight:700; color:${escapeHtml(folder.color)};">
                                            <span class="mm-cat-dot" style="background:${escapeHtml(folder.color)};"></span>
                                            ${escapeHtml(folder.label)}
                                        </span>
                                        <button type="button" class="mm-clean-btn is-icon-only" data-lib-delete-map="${escapeHtml(m.id)}" style="width:28px; height:28px; color:#f87171; border-color:rgba(239,68,68,0.28);" title="Mindmap löschen" aria-label="Mindmap löschen">
                                            ${UI_ICONS.trash}
                                        </button>
                                    </div>
                                    <div style="font-size:0.95rem; font-weight:700; color:var(--text-main, #f8fafc); margin-bottom:3px;">
                                        ${escapeHtml(m.title)}
                                    </div>
                                    <div style="font-size:0.77rem; color:var(--text-muted, #94a3b8); margin-bottom:10px;">
                                        ${escapeHtml(m.central_concept)}
                                    </div>
                                    <div class="mm-map-card-badges">
                                        <span class="mm-map-mini-badge">${nodeCount} Kn.</span>
                                        <span class="mm-map-mini-badge">${depthCount} Ebenen</span>
                                        ${distCount > 0 ? `<span class="mm-map-mini-badge">${distCount} DD</span>` : ''}
                                        ${crossCount > 0 ? `<span class="mm-map-mini-badge">${crossCount} Brücken</span>` : ''}
                                        ${userTermsCount > 0 ? `<span class="mm-map-mini-badge">${userTermsCount} Notizen</span>` : ''}
                                        ${prog?.completed
                                            ? `<span class="mm-map-mini-badge is-done">✓ ${prog.accuracy}% · ${prog.best_time_sec || 0}s</span>`
                                            : `<span class="mm-map-mini-badge">Offen</span>`
                                        }
                                        ${weakCount > 0 ? `<span class="mm-map-mini-badge is-weak">${weakCount} Wackel</span>` : ''}
                                    </div>
                                </div>

                                <div class="mm-map-card-actions">
                                    <select class="mm-move-folder-select" data-move-map-id="${escapeHtml(m.id)}" title="In einen anderen Fachordner verschieben">
                                        ${folders.map(f => `
                                            <option value="${escapeHtml(f.id)}" ${f.id === folder.id ? 'selected' : ''}>
                                                ${escapeHtml(f.label)}
                                            </option>
                                        `).join('')}
                                    </select>
                                    <button type="button" class="mm-clean-btn is-primary" style="height:30px; padding:0 12px;" data-lib-open-map="${escapeHtml(m.id)}">
                                        Öffnen
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // ANSICHT B: Schlichte Fachgebiets-Ordner-Übersicht (Dashboard-Spiegelung)
        return `
            <div class="mm-folder-grid">
                ${folders.map(folder => {
                    const total = folder.maps.length;
                    const pct = total > 0 ? Math.round((folder.completedCount / total) * 100) : 0;
                    return `
                        <div class="mm-folder-card ${total === 0 ? 'is-empty' : ''}"
                             style="--folder-accent:${escapeHtml(folder.color)};"
                             data-open-folder="${escapeHtml(folder.id)}">
                            <div class="mm-folder-card-top">
                                <span class="mm-folder-dot-badge"></span>
                                <span class="mm-folder-count-pill">
                                    ${total} ${total === 1 ? 'Map' : 'Maps'}
                                </span>
                            </div>
                            <div class="mm-folder-title">${escapeHtml(folder.label)}</div>
                            <div class="mm-folder-meta">
                                <span>${total > 0 ? `${folder.completedCount}/${total} gemeistert` : 'Leer · zum Import öffnen'}</span>
                                <span>${folder.avgAccuracy !== null ? `Ø ${folder.avgAccuracy}%` : (folder.weakMapCount > 0 ? `${folder.weakMapCount} offen` : '')}</span>
                            </div>
                            <div class="mm-folder-progress-track">
                                <div class="mm-folder-progress-fill" style="width:${pct}%;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderFolderLibrary(container, deletedBuiltins) {
        const folders = getFoldersWithStats();
        const activeFolder = state.activeFolderId ? folders.find(f => f.id === state.activeFolderId) : null;
        const totalMaps = state.mindmaps.length;
        const completedMaps = state.mindmaps.filter(m => state.progressCache[m.id]?.completed).length;

        container.innerHTML = `
            <div class="mindmap-wrapper mm-library-shell">
                <div class="mm-studio-topbar">
                    <div class="mm-studio-left">
                        <span style="display:inline-flex; align-items:center; gap:8px; font-size:0.96rem; font-weight:700; color:var(--text-main, #f8fafc);">
                            ${UI_ICONS.folder} Mindmap-Labor
                        </span>
                        <span class="mm-folder-count-pill">${completedMaps}/${totalMaps} gemeistert</span>
                    </div>
                    <div class="mm-studio-right">
                        ${deletedBuiltins.length > 0 ? `
                            <button id="mm-btn-restore-builtins" class="mm-clean-btn">Standards</button>
                        ` : ''}
                        <button id="mm-btn-prompt" class="mm-clean-btn">Prompt</button>
                        <button id="mm-btn-import" class="mm-clean-btn is-primary">${UI_ICONS.upload} Import</button>
                    </div>
                </div>

                ${state.currentMap ? `
                    <div class="mm-resume-banner">
                        <div>
                            <div style="font-size:0.7rem; font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:0.05em;">Aktive Sitzung</div>
                            <div style="font-size:0.9rem; font-weight:700; color:var(--text-main, #f8fafc);">
                                ${escapeHtml(state.currentMap.title)}
                                <span style="font-weight:500; font-size:0.78rem; color:var(--text-muted, #94a3b8); margin-left:6px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
                                    ${state.solvedNodeIds.size}/${state.currentMap.nodes.length}
                                </span>
                            </div>
                        </div>
                        <button type="button" id="mm-lib-resume-active" class="mm-clean-btn is-primary">
                            Fortsetzen
                        </button>
                    </div>
                ` : ''}

                <div class="mm-library-toolbar">
                    <div class="mm-breadcrumb-bar">
                        ${activeFolder ? `
                            <button type="button" id="mm-lib-back-btn" class="mm-clean-btn" style="height:30px;">${UI_ICONS.back} Alle Ordner</button>
                            <span style="display:inline-flex; align-items:center; gap:7px; color:${escapeHtml(activeFolder.color)};">
                                <span class="mm-cat-dot" style="background:${escapeHtml(activeFolder.color)};"></span>
                                ${escapeHtml(activeFolder.label)} (${activeFolder.maps.length})
                            </span>
                        ` : `
                            <span style="color:var(--text-main, #e2e8f0);">Fachgebiete</span>
                            <span style="font-size:0.76rem; font-weight:500; color:var(--text-muted, #94a3b8);">
                                ${folders.filter(f => f.maps.length > 0).length} von ${folders.length} belegt
                            </span>
                        `}
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <input type="text" id="mm-lib-search" class="mm-lib-search-input"
                               value="${escapeHtml(state.librarySearchQuery)}"
                               placeholder="Thema suchen..." />
                        <div class="mm-segmented">
                            <button type="button" class="mm-seg-btn ${state.libraryFilterMode === 'all' ? 'active' : ''}" data-lib-filter="all">Alle</button>
                            <button type="button" class="mm-seg-btn ${state.libraryFilterMode === 'open' ? 'active' : ''}" data-lib-filter="open">Offen</button>
                            <button type="button" class="mm-seg-btn ${state.libraryFilterMode === 'weak' ? 'active' : ''}" data-lib-filter="weak">Wackel</button>
                        </div>
                    </div>
                </div>

                <div id="mm-lib-grid-mount">
                    ${renderFolderLibraryGridHtml()}
                </div>
            </div>
        `;

        bindFolderLibraryEvents();
    }

    function bindFolderLibraryGridEvents() {
        const mount = document.getElementById('mm-lib-grid-mount');
        if (!mount) return;

        mount.querySelectorAll('[data-open-folder]').forEach(card => {
            card.addEventListener('click', () => {
                state.activeFolderId = card.getAttribute('data-open-folder');
                renderModule();
            });
        });

        mount.querySelectorAll('[data-lib-open-map]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectMindmap(btn.getAttribute('data-lib-open-map'));
            });
        });

        mount.querySelectorAll('[data-move-map-id]').forEach(sel => {
            sel.addEventListener('change', async e => {
                const mapId = sel.getAttribute('data-move-map-id');
                await moveMindmapToFolder(mapId, e.target.value);
            });
        });

        mount.querySelectorAll('[data-lib-delete-map]').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const mapId = btn.getAttribute('data-lib-delete-map');
                await deleteCurrentMindmap(mapId);
            });
        });

        mount.querySelectorAll('[data-lib-import-folder]').forEach(btn => {
            btn.addEventListener('click', () => {
                openImportModal(btn.getAttribute('data-lib-import-folder') || null);
            });
        });

        mount.querySelectorAll('[data-lib-back-root]').forEach(btn => {
            btn.addEventListener('click', () => openFolderLibrary(null));
        });
    }

    function bindFolderLibraryEvents() {
        document.getElementById('mm-btn-restore-builtins')?.addEventListener('click', () => restoreDeletedBuiltinMindmaps());
        document.getElementById('mm-btn-prompt')?.addEventListener('click', () => copyExtractionPrompt());
        document.getElementById('mm-btn-import')?.addEventListener('click', () => openImportModal(state.activeFolderId));
        document.getElementById('mm-lib-back-btn')?.addEventListener('click', () => openFolderLibrary(null));

        document.getElementById('mm-lib-resume-active')?.addEventListener('click', () => {
            if (!state.currentMap) return;
            state.viewMode = 'canvas';
            renderModule();
            requestAnimationFrame(() => {
                fitStageToViewport();
                drawSvgConnections();
            });
        });

        document.querySelectorAll('[data-lib-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.libraryFilterMode = btn.getAttribute('data-lib-filter');
                renderModule();
            });
        });

        // Suche aktualisiert nur #mm-lib-grid-mount, damit der Fokus im Suchfeld bleibt
        document.getElementById('mm-lib-search')?.addEventListener('input', e => {
            state.librarySearchQuery = e.target.value;
            const mount = document.getElementById('mm-lib-grid-mount');
            if (mount) {
                mount.innerHTML = renderFolderLibraryGridHtml();
                bindFolderLibraryGridEvents();
            }
        });

        bindFolderLibraryGridEvents();
    }

    function renderModule() {
        const container = ensureDomStructure();
        const deletedBuiltins = getDeletedBuiltinIds();

        if (state.viewMode === 'folders') {
            renderFolderLibrary(container, deletedBuiltins);
            return;
        }

        if (!state.currentMap) {
            container.innerHTML = `
                <div class="mindmap-wrapper">
                    <div class="mm-studio-topbar">
                        <div class="mm-studio-left">
                            <button id="mm-btn-folders" class="mm-clean-btn">${UI_ICONS.back} Ordner</button>
                            <span style="font-size:0.84rem; color:var(--text-muted, #94a3b8);">Keine Mindmaps vorhanden</span>
                        </div>
                        <div class="mm-studio-right">
                            ${deletedBuiltins.length > 0 ? `<button id="mm-btn-restore-builtins" class="mm-clean-btn">Standards</button>` : ''}
                            <button id="mm-btn-prompt" class="mm-clean-btn">Prompt</button>
                            <button id="mm-btn-import" class="mm-clean-btn is-primary">${UI_ICONS.upload} Import</button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('mm-btn-folders')?.addEventListener('click', () => openFolderLibrary(null));
            document.getElementById('mm-btn-restore-builtins')?.addEventListener('click', () => restoreDeletedBuiltinMindmaps());
            document.getElementById('mm-btn-prompt')?.addEventListener('click', () => copyExtractionPrompt());
            document.getElementById('mm-btn-import')?.addEventListener('click', () => openImportModal(state.activeFolderId));
            return;
        }

        const map = state.currentMap;
        const totalNodes = map.nodes.length;
        const solvedCount = state.solvedNodeIds.size;
        const progressPct = totalNodes > 0 ? Math.round((solvedCount / totalNodes) * 100) : 0;
        const savedProg = state.progressCache[map.id];
        const poolItems = getPoolItemsForCurrentState(true);
        const unfilteredPoolCount = getPoolItemsForCurrentState(false).filter(i => !state.eliminatedDistractorIds.has(i.id)).length;
        const activeDistractors = getActiveDistractors(map);
        const activeDistractorsCount = activeDistractors.length;
        const eliminatedDistractorsCount = activeDistractors.filter(d => state.eliminatedDistractorIds.has(d.id)).length;
        const allRealSolved = solvedCount === totalNodes;
        const visibleNodes = map.nodes.filter(n => !isNodeHiddenByCollapse(n.id));
        const allUserTermsCount = getUserTermsForMap(map).length;
        const visibleUserTerms = getRenderableUserTerms(map).filter(ut => !isNodeHiddenByCollapse(ut.id));
        const weakTotal = new Set([...state.weakNodeIds, ...state.uncertainNodeIds]).size;

        const optionsOpen = state.openPopover === 'options';
        const moreOpen = state.openPopover === 'more';

        container.innerHTML = `
            <div class="mindmap-wrapper">
                <!-- SCHLICHTE STUDIO-STEUERUNG (2 KOMPAKTE ZEILEN) -->
                <div class="mm-studio-chrome">
                    <!-- ZEILE 1: NAVIGATION, PRESETS & POPOVERS -->
                    <div class="mm-studio-topbar">
                        <div class="mm-studio-left">
                            <button id="mm-btn-folders" class="mm-clean-btn" title="Zur Fachgebiets-Ordner-Übersicht">
                                ${UI_ICONS.back} Ordner
                            </button>
                            <select id="mm-map-selector" class="mm-studio-select" title="Mindmap wechseln">
                                ${renderGroupedMapOptions(map.id)}
                            </select>
                        </div>

                        <div class="mm-segmented" role="group" aria-label="Anspruch">
                            <button type="button" class="mm-seg-btn ${state.difficultyPreset === 'guided' ? 'active' : ''}" data-preset="guided" title="Direktes Einrasten, Kategoriefarben sichtbar, ohne Fallen">
                                Guided
                            </button>
                            <button type="button" class="mm-seg-btn ${state.difficultyPreset === 'clinical' ? 'active' : ''}" data-preset="clinical" title="Tiefen-Verhör beim Platzieren + DD-Fallen">
                                Facharzt
                            </button>
                            <button type="button" class="mm-seg-btn ${state.difficultyPreset === 'exam' ? 'active' : ''}" data-preset="exam" title="Blind-Modus + Active-Recall-First + DD-Fallen + Diagnose-Deduktion">
                                Examen
                            </button>
                        </div>

                        <div class="mm-studio-right">
                            <button id="mm-btn-add-userterm" class="mm-clean-btn is-primary" title="Eigenen Zusatzbegriff an einen Ast anheften">
                                ${UI_ICONS.plus} Begriff
                            </button>

                            <button id="mm-btn-import" class="mm-clean-btn" title="Mindmap als JSON importieren">
                                ${UI_ICONS.upload} Import
                            </button>

                            <!-- OPTIONEN POPOVER -->
                            <div class="mm-popover-wrap">
                                <button type="button" id="mm-btn-options-pop" class="mm-clean-btn ${optionsOpen ? 'is-active' : ''}" data-popover-trigger="options" aria-haspopup="true" aria-expanded="${optionsOpen}">
                                    ${UI_ICONS.sliders} Optionen ${UI_ICONS.chevron}
                                </button>
                                <div class="mm-popover-panel ${optionsOpen ? '' : 'is-hidden'}" id="mm-popover-options">
                                    <div class="mm-pop-section-title">Ansicht & Layout</div>
                                    <button type="button" id="mm-toggle-layout" class="mm-switch-row">
                                        <span>Layout</span>
                                        <span class="mm-switch-sub">${state.layoutMode === 'tree' ? 'Baum' : 'Radial'}</span>
                                    </button>
                                    <button type="button" id="mm-btn-inspector" class="mm-switch-row ${state.showInspector ? 'is-on' : ''}">
                                        <span>Baum-Logik Übersicht</span>
                                        <span class="mm-toggle-track"></span>
                                    </button>
                                    <button type="button" id="mm-toggle-expand" class="mm-switch-row ${state.expandedCanvas ? 'is-on' : ''}">
                                        <span>Großansicht</span>
                                        <span class="mm-toggle-track"></span>
                                    </button>
                                    <button type="button" id="mm-toggle-crosslinks" class="mm-switch-row ${state.showCrossLinks ? 'is-on' : ''}">
                                        <span>Querverbindungen</span>
                                        <span class="mm-toggle-track"></span>
                                    </button>
                                    <button type="button" id="mm-toggle-userterms" class="mm-switch-row ${state.showUserTerms ? 'is-on' : ''}">
                                        <span>Eigene Begriffe <span class="mm-switch-sub">(${allUserTermsCount})</span></span>
                                        <span class="mm-toggle-track"></span>
                                    </button>

                                    <div class="mm-pop-divider"></div>
                                    <div class="mm-pop-section-title">Prüfungs-Schärfe</div>
                                    <button type="button" id="mm-toggle-deep-gate" class="mm-switch-row ${state.deepComprehensionMode ? 'is-on' : ''}">
                                        <span>Tiefen-Verhör beim Platzieren</span>
                                        <span class="mm-toggle-track"></span>
                                    </button>
                                    ${state.deepComprehensionMode ? `
                                        <button type="button" id="mm-toggle-recall-first" class="mm-switch-row ${state.activeRecallFirstMode ? 'is-on' : ''}">
                                            <span>Active-Recall-First (Freitext)</span>
                                            <span class="mm-toggle-track"></span>
                                        </button>
                                    ` : ''}
                                    <button type="button" id="mm-toggle-distractors" class="mm-switch-row ${state.includeDistractors ? 'is-on' : ''}">
                                        <span>DD-Fallen im Pool <span class="mm-switch-sub">(${activeDistractorsCount})</span></span>
                                        <span class="mm-toggle-track"></span>
                                    </button>
                                    <button type="button" id="mm-toggle-hide-rel" class="mm-switch-row ${state.hideRelationLabels ? 'is-on' : ''}">
                                        <span>Pfeil-Hinweise verdecken</span>
                                        <span class="mm-toggle-track"></span>
                                    </button>
                                    <button type="button" id="mm-toggle-blind" class="mm-switch-row ${state.blindMode ? 'is-on' : ''}">
                                        <span>Kategoriefarben verdecken</span>
                                        <span class="mm-toggle-track"></span>
                                    </button>
                                    <button type="button" id="mm-toggle-blind-root" class="mm-switch-row ${state.blindRootMode ? 'is-on' : ''}">
                                        <span>Diagnose-Deduktion (Blind)</span>
                                        <span class="mm-toggle-track"></span>
                                    </button>
                                </div>
                            </div>

                            <!-- MEHR-AKTIONEN POPOVER -->
                            <div class="mm-popover-wrap">
                                <button type="button" id="mm-btn-more-pop" class="mm-clean-btn is-icon-only ${moreOpen ? 'is-active' : ''}" data-popover-trigger="more" aria-label="Weitere Aktionen" aria-haspopup="true" aria-expanded="${moreOpen}">
                                    ${UI_ICONS.more}
                                </button>
                                <div class="mm-popover-panel is-compact ${moreOpen ? '' : 'is-hidden'}" id="mm-popover-more">
                                    <button type="button" id="mm-btn-reset" class="mm-switch-row">
                                        <span>Durchlauf zurücksetzen</span>
                                    </button>
                                    <button type="button" id="mm-btn-prompt" class="mm-switch-row">
                                        <span>Deep-Tree Prompt kopieren</span>
                                    </button>
                                    ${deletedBuiltins.length > 0 ? `
                                        <button type="button" id="mm-btn-restore-builtins" class="mm-switch-row">
                                            <span>Standards wiederherstellen</span>
                                        </button>
                                    ` : ''}
                                    <div class="mm-pop-divider"></div>
                                    <button type="button" id="mm-btn-delete" class="mm-switch-row is-danger">
                                        <span>Mindmap löschen</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="mm-progress-rail" aria-hidden="true">
                            <div class="mm-progress-bar" style="width:${progressPct}%;"></div>
                        </div>
                    </div>

                    <!-- ZEILE 2: KOMPAKTE KATEGORIEN (+ ADD) & MONOSPACE-TELEMETRIE -->
                    <div class="mm-studio-subbar">
                        <div class="mm-clean-legend">
                            ${Object.entries(CATEGORIES).map(([key, cfg]) => `
                                <span class="mm-cat-chip">
                                    <span class="mm-cat-dot" style="background:${cfg.color}"></span>
                                    <span>${escapeHtml(cfg.shortLabel || cfg.label)}</span>
                                    <button type="button" class="mm-cat-add" data-legend-add-cat="${key}" title="Zusatzbegriff in „${escapeHtml(cfg.label)}“ ergänzen">+</button>
                                </span>
                            `).join('')}
                        </div>

                        <div class="mm-telemetry-group">
                            <span class="mm-telemetry-item">
                                Gelöst <span class="mm-telemetry-val ${allRealSolved ? 'is-good' : ''}" id="mm-stat-progress">${solvedCount}/${totalNodes}</span>
                            </span>
                            <span class="mm-telemetry-item">
                                Serie <span class="mm-telemetry-val" id="mm-stat-streak">${state.streakCount}</span>
                            </span>
                            <span class="mm-telemetry-item">
                                Fehler <span class="mm-telemetry-val ${state.mistakesCount > 0 ? 'is-warn' : ''}" id="mm-stat-mistakes">${state.mistakesCount}</span>
                            </span>
                            ${savedProg?.best_time_sec ? `<span class="mm-telemetry-item">Best <span class="mm-telemetry-val">${savedProg.best_time_sec}s</span></span>` : ''}
                            ${renderCompactTierTelemetry(map)}
                            ${weakTotal > 0 ? `
                                <button type="button" id="mm-strip-weak-drill" class="mm-drill-pill">
                                    Drill (${weakTotal})
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- OPTIONALER N-EBENEN KAUSALKETTEN-INSPEKTOR -->
                ${state.showInspector ? renderInspectorPanel(map) : ''}

                <!-- WORKSPACE -->
                <div class="mm-workspace ${state.expandedCanvas ? 'mm-workspace-expanded' : ''}">
                    <!-- LINKE SPALTE: BEGRIFFS-POOL, DD-QUARANTÄNE & SOKRATISCHER TUTOR -->
                    <div class="mm-sidebar-panel">
                        <div class="mm-pool-box">
                            <div class="mm-box-header">
                                <span class="mm-box-title">Begriffe (${unfilteredPoolCount})</span>
                                <span class="mm-box-sub">${state.includeDistractors ? `${activeDistractorsCount - eliminatedDistractorsCount} DD-Fallen` : 'Ziehen oder klicken'}</span>
                            </div>

                            ${!allRealSolved ? `
                                <div class="mm-pool-search-wrap">
                                    <input type="text" id="mm-pool-search" class="mm-pool-search-input"
                                           value="${escapeHtml(state.poolSearchQuery)}"
                                           placeholder="Baustein filtern..." />
                                </div>
                            ` : ''}

                            ${state.includeDistractors && activeDistractorsCount > 0 ? `
                                <div id="mm-quarantine-dropzone" class="mm-quarantine-zone" title="Ziehe falsche Differenzialdiagnosen / Kontraindikationen hierher (oder Chip auswählen + hier klicken)">
                                    <div class="mm-quarantine-header">
                                        <span>DD-Quarantäne</span>
                                        <span>${eliminatedDistractorsCount}/${activeDistractorsCount}</span>
                                    </div>
                                    <div class="mm-quarantine-sub">
                                        Falsche Differenzialdiagnose hierher ziehen.
                                    </div>
                                </div>
                            ` : ''}

                            <div id="mm-chip-pool" class="mm-chip-list">
                                ${renderPoolChipsHtml(poolItems, allRealSolved, totalNodes)}
                            </div>
                        </div>

                        <!-- SOKRATISCHES AI-FEEDBACK PANEL -->
                        <div class="mm-tutor-box">
                            <div class="mm-box-header">
                                <span class="mm-box-title">Sokratischer Tutor</span>
                                <span class="mm-tutor-bloom">Analyse & Transfer</span>
                            </div>
                            <div id="mm-tutor-message" class="mm-tutor-content">
                                Klicke auf einen offenen Knoten für eine Leitfrage oder ordne einen Baustein aus der Liste zu.
                            </div>
                        </div>
                    </div>

                    <!-- RECHTE SPALTE: DYNAMISCHES OVERLAP-FREE PAN & ZOOM CANVAS -->
                    <div id="mm-canvas-viewport" class="mm-canvas-container">
                        <div class="mm-canvas-HUD">
                            <button type="button" class="mm-hud-btn" id="mm-zoom-out" title="Herauszoomen">−</button>
                            <span id="mm-zoom-label" class="mm-hud-zoom-text">${Math.round(state.zoom * 100)}%</span>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-in" title="Hineinzoomen">+</button>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-100" title="100% Originalgröße">100%</button>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-fit" title="Gesamten Baum einpassen">Einpassen</button>
                            <button type="button" class="mm-hud-btn" id="mm-focus-next" title="Kamera zum nächsten offenen Slot fahren">Nächster Slot</button>
                            ${state.collapsedNodeIds.size > 0 ? `
                                <button type="button" class="mm-hud-btn" id="mm-expand-all" title="Alle eingeklappten Äste wieder öffnen">Alle aufklappen</button>
                            ` : ''}
                        </div>

                        <div class="mm-canvas-help-pill">
                            Ziehen = Verschieben · Mausrad = Zoom · „−“ = Einklappen · „+“ = Begriff ergänzen
                        </div>

                        <!-- TRANSFORMABLE DYNAMIC STAGE -->
                        <div id="mm-stage" class="mm-stage" style="width:${state.stageWidth}px; height:${state.stageHeight}px;">
                            <svg id="mm-svg" class="mm-svg-layer" viewBox="0 0 ${state.stageWidth} ${state.stageHeight}"></svg>
                            <div id="mm-edge-labels-layer" class="mm-edge-labels-layer"></div>
                            <div id="mm-nodes" class="mm-nodes-layer">
                                <!-- ZENTRALER WURZEL-KNOTEN -->
                                <div class="mm-node mm-node-root"
                                     id="mm-node-dom-root"
                                     style="left: ${state.rootX}px; top: ${state.rootY}px;"
                                     data-node-pos="root">
                                    <span class="mm-root-badge">${escapeHtml(map.specialty)}</span>
                                    <span class="mm-root-title">${escapeHtml(getRootDisplayTitle())}</span>
                                    ${state.blindRootMode && !state.rootRevealed && !allRealSolved ? `
                                        <div class="mm-root-deduce-box" onclick="event.stopPropagation();">
                                            <input type="text" id="mm-root-guess-input" class="mm-root-deduce-input" placeholder="Diagnose tippen..." />
                                            <button type="button" id="mm-root-guess-btn" class="mm-root-deduce-btn">Prüfen</button>
                                        </div>
                                    ` : ''}
                                </div>

                                <!-- SICHTBARE ZIEL-SLOTS / GELÖSTE KNOTEN -->
                                ${visibleNodes.map(node => renderCanvasNode(node)).join('')}

                                <!-- EIGENE KOMPAKTE ZUSATZBEGRIFFE -->
                                ${visibleUserTerms.map(ut => renderUserTermNode(ut)).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderInspectorPanel(map) {
        const rootNodes = map.nodes.filter(n => !n.parent_id || n.parent_id === 'root');

        function renderRecursiveBranch(node) {
            const meta = state.nodeMeta[node.id] || { depth: 1, childrenIds: [] };
            const isSolved = state.solvedNodeIds.has(node.id);
            const isLocked = isSlotCurrentlyLocked(node);
            const cat = state.blindMode && !isSolved ? 'Verdeckt' : (CATEGORIES[node.category]?.shortLabel || node.category);
            const rel = (state.hideRelationLabels && !isSolved) ? '??? (verdeckt)' : (node.relation_label || 'führt zu');
            const indent = Math.max(0, (meta.depth - 1) * 14);
            const kids = (meta.childrenIds || []).map(id => map.nodes.find(n => n.id === id)).filter(Boolean);

            return `
                <div class="${meta.depth === 1 ? 'mm-inspector-step' : 'mm-inspector-substep'} ${isSolved ? 'is-solved' : ''}"
                     data-ins-slot="${escapeHtml(node.id)}"
                     style="cursor:pointer; margin-left:${indent}px;">
                    <span class="mm-ins-rel">
                        <span class="mm-tier-pill tier-${Math.min(4, meta.depth)}">E${meta.depth}</span>
                        → <strong>${escapeHtml(rel)}</strong>:
                    </span>
                    <strong class="mm-ins-target">
                        ${isSolved
                            ? `✓ ${escapeHtml(node.label)}${node._userPromoted ? ' ★' : ''}${state.uncertainNodeIds.has(node.id) ? ' (Wackel)' : ''}`
                            : (isLocked ? `[Gesperrt · erst E${meta.depth - 1}]` : `[Offen · ${escapeHtml(cat)}]`)
                        }
                    </strong>
                </div>
                ${kids.map(renderRecursiveBranch).join('')}
            `;
        }

        return `
            <div class="mm-inspector-panel">
                <div class="mm-inspector-header">
                    <strong>Kausalstruktur · ${state.maxTreeDepth} Ebenen (${escapeHtml(getRootDisplayTitle())})</strong>
                    <span>Klick auf einen Schritt fokussiert den Knoten und zeigt die Leitfrage.</span>
                </div>
                <div class="mm-inspector-grid">
                    ${rootNodes.map(rootNode => `
                        <div class="mm-inspector-branch">
                            ${renderRecursiveBranch(rootNode)}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderCanvasNode(node) {
        const pos = state.nodePositions[node.id] || { x: state.rootX, y: state.rootY, level: 1, side: 'right' };
        const meta = state.nodeMeta[node.id] || { depth: 1, childrenIds: [], side: 'right' };
        const depth = meta.depth || 1;
        const tMeta = TIER_META[Math.min(4, depth)] || { short: `E${depth}`, badgeClass: 'tier-4' };

        const isSolved = state.solvedNodeIds.has(node.id);
        const isLocked = isSlotCurrentlyLocked(node);
        const isUncertain = state.uncertainNodeIds.has(node.id);
        const catCfg = CATEGORIES[node.category] || { label: 'Konzept', shortLabel: 'Konzept', cssClass: 'cat-blind' };

        const hasChildren = (meta.childrenIds || []).length > 0;
        const isCollapsed = state.collapsedNodeIds.has(node.id);
        const collapsedDescCount = isCollapsed ? getDescendantIds(node.id).length : 0;

        const showRelation = isSolved || !state.hideRelationLabels;
        const relationText = showRelation ? (node.relation_label || 'Verbindung') : 'Kausalbeziehung erschließen';

        const collapseBtnHtml = (isSolved && hasChildren) ? `
            <button type="button"
                    class="mm-node-collapse-btn ${meta.side === 'left' ? 'side-left' : ''}"
                    data-collapse-node="${escapeHtml(node.id)}"
                    title="${isCollapsed ? `Unterast (+${collapsedDescCount}) aufklappen` : 'Unterast einklappen'}">
                ${isCollapsed ? `+${collapsedDescCount}` : '−'}
            </button>
        ` : '';

        if (isSolved) {
            return `
                <div class="mm-node mm-node-solved ${catCfg.cssClass}"
                     id="mm-node-dom-${escapeHtml(node.id)}"
                     style="left: ${pos.x}px; top: ${pos.y}px;"
                     data-slot-id="${escapeHtml(node.id)}"
                     title="Klicken für Erklärung, Lern-Depot oder Prüfungsfrage">
                    ${collapseBtnHtml}
                    <button type="button"
                            class="mm-node-add-term-btn"
                            data-add-term-node="${escapeHtml(node.id)}"
                            data-add-term-cat="${escapeHtml(node.category)}"
                            title="Eigenen Zusatzbegriff an diesen Ast anheften">
                        +
                    </button>
                    <div class="mm-node-rel-banner">
                        <span class="mm-rel-origin">
                            <span class="mm-tier-pill ${tMeta.badgeClass}">E${depth}</span>
                            ${depth > 1 ? escapeHtml(` ${getParentLabel(node)}`) : ' Hauptast'}
                        </span>
                        <strong class="mm-rel-verb">→ ${escapeHtml(node.relation_label || 'Verbindung')}</strong>
                    </div>
                    <div class="mm-node-body-solved">
                        <span class="mm-solved-cat-pill">
                            ${escapeHtml(catCfg.shortLabel || catCfg.label)}
                            ${node._userPromoted ? `<span class="mm-node-promoted-badge" title="Beförderter eigener Prüfungs-Knoten">★ Eigen</span>` : ''}
                            ${isUncertain ? `<span class="mm-node-uncertain-badge" title="Als unsicher markiert – im Drill wiederholen">Wackel</span>` : ''}
                        </span>
                        <div class="mm-solved-title">${escapeHtml(node.label)}</div>
                    </div>
                </div>
            `;
        }

        if (isLocked) {
            return `
                <div class="mm-node mm-node-slot cat-blind mm-node-locked"
                     id="mm-node-dom-${escapeHtml(node.id)}"
                     style="left: ${pos.x}px; top: ${pos.y}px; opacity: 0.52; filter: grayscale(0.45);"
                     data-slot-id="${escapeHtml(node.id)}"
                     title="Löse zuerst den übergeordneten Knoten auf Ebene ${depth - 1}">
                    <div class="mm-node-rel-banner">
                        <span class="mm-rel-origin"><span class="mm-tier-pill ${tMeta.badgeClass}">E${depth}</span> Gesperrt</span>
                        <strong class="mm-rel-verb ${!showRelation ? 'mm-rel-hidden-pill' : ''}">→ ${escapeHtml(relationText)}</strong>
                    </div>
                    <div class="mm-slot-inner">
                        <span class="mm-slot-hint">Ebene ${depth} gesperrt</span>
                        <span class="mm-slot-cta">Erst E${depth - 1} verifizieren</span>
                    </div>
                </div>
            `;
        }

        const slotCatClass = state.blindMode ? 'cat-blind' : catCfg.cssClass;
        const slotHintLabel = state.blindMode
            ? `Offen · E${depth}`
            : (catCfg.shortLabel || catCfg.label);

        return `
            <div class="mm-node mm-node-slot ${slotCatClass} ${depth > 1 ? 'mm-node-second-order' : ''}"
                 id="mm-node-dom-${escapeHtml(node.id)}"
                 style="left: ${pos.x}px; top: ${pos.y}px;"
                 data-slot-id="${escapeHtml(node.id)}"
                 title="Klicken für sokratische Leitfrage oder passenden Baustein ablegen">
                <div class="mm-node-rel-banner">
                    <span class="mm-rel-origin">
                        <span class="mm-tier-pill ${tMeta.badgeClass}">E${depth}</span>
                        ${escapeHtml(depth === 1 ? ' Hauptast' : ` ${getParentLabel(node)}`)}
                    </span>
                    <strong class="mm-rel-verb ${!showRelation ? 'mm-rel-hidden-pill' : ''}">→ ${escapeHtml(relationText)}</strong>
                </div>
                <div class="mm-slot-inner">
                    <span class="mm-slot-hint">${escapeHtml(slotHintLabel)}</span>
                    <span class="mm-slot-cta">${state.deepComprehensionMode ? 'Ablegen → Verhör' : 'Ablegen oder klicken'}</span>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // 8. SVG-VERBINDUNGEN (TIDY-TREE S-KURVEN, USER-TERMS & QUERVERBINDUNGEN)
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
        if (nodeId === 'root') return { halfW: 150, halfH: 54 };
        if (state.nodeMeta[nodeId]?.isUserTerm) return { halfW: 107, halfH: 29 };
        return { halfW: 136, halfH: 58 };
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
                <marker id="mm-arrow-crosslink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#f59e0b" />
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

        // 1. Hierarchische Baum-Kanten zeichnen
        state.currentMap.nodes.forEach(node => {
            if (isNodeHiddenByCollapse(node.id)) return;

            const parentId = node.parent_id || 'root';
            const fromCenter = state.nodePositions[parentId] || { x: state.rootX, y: state.rootY };
            const toCenter = state.nodePositions[node.id] || { x: state.rootX, y: state.rootY };
            const fromDim = getNodeHalfDimensions(parentId);
            const toDim = getNodeHalfDimensions(node.id);
            const side = state.nodeMeta[node.id]?.side || 'right';

            let x1, y1, x2, y2, cx1, cy1, cx2, cy2;

            if (state.layoutMode === 'tree') {
                const dir = side === 'left' ? -1 : 1;
                x1 = fromCenter.x + dir * (fromDim.halfW + 4);
                y1 = fromCenter.y;
                x2 = toCenter.x - dir * (toDim.halfW + 10);
                y2 = toCenter.y;

                const midSpan = Math.abs(x2 - x1) * 0.5;
                cx1 = x1 + dir * midSpan;
                cy1 = y1;
                cx2 = x2 - dir * midSpan;
                cy2 = y2;
            } else {
                const startPt = getBoxBorderPoint(fromCenter.x, fromCenter.y, fromDim.halfW, fromDim.halfH, toCenter.x, toCenter.y, 4);
                const endPt = getBoxBorderPoint(toCenter.x, toCenter.y, toDim.halfW, toDim.halfH, fromCenter.x, fromCenter.y, 10);
                x1 = startPt.x;
                y1 = startPt.y;
                x2 = endPt.x;
                y2 = endPt.y;
                const dx = x2 - x1;
                const dy = y2 - y1;
                cx1 = x1 + dx * 0.35;
                cy1 = y1 + dy * 0.15;
                cx2 = x1 + dx * 0.65;
                cy2 = y1 + dy * 0.85;
            }

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
                      style="stroke: ${strokeColor}; opacity: ${isLocked ? '0.32' : '0.92'};"
                      marker-end="url(#${markerId})" />
            `;

            const showBadgeLabel = node.relation_label && (isSolved || !state.hideRelationLabels);
            if (showBadgeLabel) {
                const midX = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
                const midY = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
                htmlBadges += `
                    <div class="mm-edge-html-badge ${isHovered ? 'is-hovered' : ''}"
                         style="left:${midX.toFixed(1)}px; top:${midY.toFixed(1)}px; border-color:${strokeColor}; opacity:${isLocked ? '0.4' : '1'};">
                        ${escapeHtml(node.relation_label)}
                    </div>
                `;
            }
        });

        // 1B. Gestrichelte Kanten zu eigenen Zusatzbegriffen
        getRenderableUserTerms(state.currentMap).forEach(ut => {
            if (isNodeHiddenByCollapse(ut.id)) return;
            const parentId = ut.anchorParentId || 'root';
            const fromCenter = state.nodePositions[parentId] || { x: state.rootX, y: state.rootY };
            const toCenter = state.nodePositions[ut.id] || { x: state.rootX, y: state.rootY };
            const fromDim = getNodeHalfDimensions(parentId);
            const toDim = getNodeHalfDimensions(ut.id);
            const side = state.nodeMeta[ut.id]?.side || 'right';
            const catCfg = CATEGORIES[ut.category];
            const strokeColor = catCfg ? catCfg.color : '#38bdf8';
            const isHovered = state.hoveredNodeId === ut.id || state.hoveredNodeId === parentId;

            let x1, y1, x2, y2, cx1, cy1, cx2, cy2;
            if (state.layoutMode === 'tree') {
                const dir = side === 'left' ? -1 : 1;
                x1 = fromCenter.x + dir * (fromDim.halfW + 4);
                y1 = fromCenter.y;
                x2 = toCenter.x - dir * (toDim.halfW + 8);
                y2 = toCenter.y;
                const midSpan = Math.abs(x2 - x1) * 0.5;
                cx1 = x1 + dir * midSpan;
                cy1 = y1;
                cx2 = x2 - dir * midSpan;
                cy2 = y2;
            } else {
                const startPt = getBoxBorderPoint(fromCenter.x, fromCenter.y, fromDim.halfW, fromDim.halfH, toCenter.x, toCenter.y, 4);
                const endPt = getBoxBorderPoint(toCenter.x, toCenter.y, toDim.halfW, toDim.halfH, fromCenter.x, fromCenter.y, 8);
                x1 = startPt.x;
                y1 = startPt.y;
                x2 = endPt.x;
                y2 = endPt.y;
                cx1 = x1 + (x2 - x1) * 0.35;
                cy1 = y1 + (y2 - y1) * 0.15;
                cx2 = x1 + (x2 - x1) * 0.65;
                cy2 = y1 + (y2 - y1) * 0.85;
            }

            pathsHtml += `
                <path class="mm-edge-userterm"
                      d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}"
                      style="stroke: ${strokeColor}; opacity: ${isHovered ? '1' : '0.78'}; stroke-width: ${isHovered ? '2.6' : '1.8'};" />
            `;
        });

        // 2. Fachübergreifende Querverbindungen (cross_links) zeichnen
        if (state.showCrossLinks && Array.isArray(state.currentMap.cross_links)) {
            state.currentMap.cross_links.forEach((cl, idx) => {
                if (!state.solvedNodeIds.has(cl.from) || !state.solvedNodeIds.has(cl.to)) return;
                if (isNodeHiddenByCollapse(cl.from) || isNodeHiddenByCollapse(cl.to)) return;

                const fromPos = state.nodePositions[cl.from];
                const toPos = state.nodePositions[cl.to];
                if (!fromPos || !toPos) return;

                const fromDim = getNodeHalfDimensions(cl.from);
                const toDim = getNodeHalfDimensions(cl.to);
                const p1 = getBoxBorderPoint(fromPos.x, fromPos.y, fromDim.halfW, fromDim.halfH, toPos.x, toPos.y, 6);
                const p2 = getBoxBorderPoint(toPos.x, toPos.y, toDim.halfW, toDim.halfH, fromPos.x, fromPos.y, 12);

                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.hypot(dx, dy) || 1;
                const curveOffset = Math.min(200, Math.max(85, dist * 0.22)) * (idx % 2 === 0 ? 1 : -1);
                const qx = mx - (dy / dist) * curveOffset;
                const qy = my + (dx / dist) * curveOffset;

                const isHover = state.hoveredNodeId === cl.from || state.hoveredNodeId === cl.to;
                pathsHtml += `
                    <path class="mm-crosslink-path ${isHover ? 'is-active' : ''}"
                          d="M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${qx.toFixed(1)} ${qy.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}"
                          marker-end="url(#mm-arrow-crosslink)" />
                `;

                const badgeX = 0.25 * p1.x + 0.5 * qx + 0.25 * p2.x;
                const badgeY = 0.25 * p1.y + 0.5 * qy + 0.25 * p2.y;
                htmlBadges += `
                    <button type="button"
                            class="mm-crosslink-badge"
                            data-crosslink-id="${escapeHtml(cl.id || `cl_${idx}`)}"
                            style="left:${badgeX.toFixed(1)}px; top:${badgeY.toFixed(1)}px;"
                            title="Klicken für Querverbindungs-Synthese-Prüfung">
                        ${escapeHtml(cl.label || 'Querverbindung')}
                    </button>
                `;
            });
        }

        svg.innerHTML = defsHtml + pathsHtml;
        if (edgeLabelsLayer) {
            edgeLabelsLayer.innerHTML = htmlBadges;
            edgeLabelsLayer.querySelectorAll('[data-crosslink-id]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const clId = btn.getAttribute('data-crosslink-id');
                    const found = (state.currentMap?.cross_links || []).find((c, i) => (c.id || `cl_${i}`) === clId);
                    if (found) openCrossLinkSynthesisModal(found);
                });
            });
        }
    }

    // ========================================================================
    // 9. EVENT-BINDING (POPOVERS, PRESETS, SUCHE, QUARANTÄNE, USER-TERMS, PAN)
    // ========================================================================

    function bindPoolChipEvents() {
        document.querySelectorAll('#mm-chip-pool .mm-chip').forEach(chip => {
            chip.addEventListener('dragstart', e => e.preventDefault());
            chip.addEventListener('selectstart', e => e.preventDefault());
            chip.addEventListener('pointerdown', onChipPointerDown);
        });

        document.getElementById('mm-btn-weak-drill')?.addEventListener('click', () => startWeakNodeDrill());
        document.getElementById('mm-btn-save-weak-depot')?.addEventListener('click', async e => {
            const btn = e.currentTarget;
            const combined = new Set([...state.weakNodeIds, ...state.uncertainNodeIds]);
            for (const weakId of combined) {
                const n = state.currentMap?.nodes.find(item => item.id === weakId);
                if (n) await saveNodeToLearningDepot(n, '[Wiederholungs-Fokus]');
            }
            btn.textContent = 'Gespeichert';
            btn.disabled = true;
        });
        document.getElementById('mm-btn-run-synthesis')?.addEventListener('click', () => {
            const firstCl = (state.currentMap?.cross_links || []).find(cl => cl.synthesis_question) || state.currentMap?.cross_links?.[0];
            if (firstCl) openCrossLinkSynthesisModal(firstCl);
        });
    }

    function bindEvents() {
        // Popover-Trigger (Optionen & Mehr-Menü)
        document.querySelectorAll('[data-popover-trigger]').forEach(trigger => {
            trigger.addEventListener('click', e => {
                e.stopPropagation();
                const name = trigger.getAttribute('data-popover-trigger');
                state.openPopover = (state.openPopover === name) ? null : name;
                document.querySelectorAll('.mm-popover-panel').forEach(p => {
                    const isTarget = p.id === `mm-popover-${state.openPopover}`;
                    p.classList.toggle('is-hidden', !isTarget);
                });
                document.querySelectorAll('[data-popover-trigger]').forEach(t => {
                    const active = t.getAttribute('data-popover-trigger') === state.openPopover;
                    t.classList.toggle('is-active', active);
                    t.setAttribute('aria-expanded', String(active));
                });
            });
        });

        // Klicks im Popover nicht als Outside-Click werten
        document.querySelectorAll('.mm-popover-panel').forEach(panel => {
            panel.addEventListener('click', e => e.stopPropagation());
        });

        document.getElementById('mm-map-selector')?.addEventListener('change', e => selectMindmap(e.target.value));
        document.getElementById('mm-btn-folders')?.addEventListener('click', () => {
            openFolderLibrary(resolveFolderForMindmap(state.currentMap).id);
        });
        document.getElementById('mm-btn-delete')?.addEventListener('click', () => {
            closeOpenPopovers();
            deleteCurrentMindmap();
        });
        document.getElementById('mm-btn-restore-builtins')?.addEventListener('click', () => {
            closeOpenPopovers();
            restoreDeletedBuiltinMindmaps();
        });
        document.getElementById('mm-strip-weak-drill')?.addEventListener('click', () => startWeakNodeDrill());

        document.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => applyDifficultyPreset(btn.getAttribute('data-preset')));
        });

        document.getElementById('mm-toggle-layout')?.addEventListener('click', () => {
            state.layoutMode = state.layoutMode === 'tree' ? 'radial' : 'tree';
            computeLayout(state.currentMap);
            renderModule();
            requestAnimationFrame(() => {
                fitStageToViewport();
                drawSvgConnections();
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

        document.getElementById('mm-toggle-hide-rel')?.addEventListener('click', () => {
            state.hideRelationLabels = !state.hideRelationLabels;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-toggle-crosslinks')?.addEventListener('click', () => {
            state.showCrossLinks = !state.showCrossLinks;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        // Eigene Zusatzbegriffe ein-/ausblenden & hinzufügen
        document.getElementById('mm-toggle-userterms')?.addEventListener('click', () => {
            state.showUserTerms = !state.showUserTerms;
            computeLayout(state.currentMap);
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-btn-add-userterm')?.addEventListener('click', () => {
            openUserTermModal(null, null);
        });

        document.querySelectorAll('[data-legend-add-cat]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                openUserTermModal(btn.getAttribute('data-legend-add-cat'), null);
            });
        });

        document.querySelectorAll('[data-add-term-node]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                openUserTermModal(
                    btn.getAttribute('data-add-term-cat'),
                    btn.getAttribute('data-add-term-node')
                );
            });
        });

        document.querySelectorAll('.mm-node-userterm').forEach(el => {
            const utId = el.getAttribute('data-userterm-id');
            el.addEventListener('mouseenter', () => {
                state.hoveredNodeId = utId;
                drawSvgConnections();
            });
            el.addEventListener('mouseleave', () => {
                state.hoveredNodeId = null;
                drawSvgConnections();
            });
            el.addEventListener('click', () => showUserTermDetailInTutor(utId));
        });

        document.querySelectorAll('[data-ut-aicheck]').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const id = btn.getAttribute('data-ut-aicheck');
                btn.textContent = '...';
                btn.disabled = true;
                const result = await runAiCheckForUserTerm(id);
                if (!result) {
                    btn.textContent = 'KI';
                    btn.disabled = false;
                }
            });
        });

        document.querySelectorAll('[data-ut-promote]').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const id = btn.getAttribute('data-ut-promote');
                btn.textContent = '...';
                btn.disabled = true;
                const promoted = await promoteUserTermToOfficialNode(id);
                if (!promoted) {
                    btn.textContent = '★';
                    btn.disabled = false;
                }
            });
        });

        document.querySelectorAll('[data-ut-delete]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                deleteUserTerm(btn.getAttribute('data-ut-delete'));
            });
        });

        // Blind-Mode-Toggle berechnet Layout neu, da ggf. geparkte Zusatzbegriffe erscheinen/verschwinden
        document.getElementById('mm-toggle-blind')?.addEventListener('click', () => {
            state.blindMode = !state.blindMode;
            computeLayout(state.currentMap);
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
            closeOpenPopovers();
            if (state.currentMap) selectMindmap(state.currentMap.id);
        });

        document.getElementById('mm-btn-prompt')?.addEventListener('click', () => {
            closeOpenPopovers();
            copyExtractionPrompt();
        });

        document.getElementById('mm-btn-import')?.addEventListener('click', () => {
            closeOpenPopovers();
            openImportModal(resolveFolderForMindmap(state.currentMap).id);
        });

        // Pool-Suche ohne Fokusverlust (aktualisiert gezielt nur #mm-chip-pool)
        const searchInput = document.getElementById('mm-pool-search');
        searchInput?.addEventListener('input', e => {
            state.poolSearchQuery = e.target.value;
            const poolContainer = document.getElementById('mm-chip-pool');
            if (poolContainer && state.currentMap) {
                const allRealSolved = state.solvedNodeIds.size === state.currentMap.nodes.length;
                const filtered = getPoolItemsForCurrentState(true);
                poolContainer.innerHTML = renderPoolChipsHtml(filtered, allRealSolved, state.currentMap.nodes.length);
                bindPoolChipEvents();
            }
        });

        // Quarantäne-Klick für ausgewählten Chip
        const quarantineZone = document.getElementById('mm-quarantine-dropzone');
        quarantineZone?.addEventListener('click', () => {
            if (state.selectedChipId) {
                evaluateQuarantineAttempt(state.selectedChipId);
            } else {
                const tutorEl = document.getElementById('mm-tutor-message');
                if (tutorEl) {
                    tutorEl.innerHTML = `<strong style="color:#fca5a5;">DD-Quarantäne:</strong> Wähle zuerst einen verdächtigen Baustein aus dem Pool aus oder ziehe ihn direkt auf das rote Feld.`;
                }
            }
        });

        // Root-Diagnose-Deduktion prüfen
        const rootGuessBtn = document.getElementById('mm-root-guess-btn');
        const rootGuessInput = document.getElementById('mm-root-guess-input');
        const verifyRootDeduction = () => {
            if (!rootGuessInput || !state.currentMap) return;
            const guess = normalizeSearchText(rootGuessInput.value);
            if (guess.length < 3) return;
            const target = normalizeSearchText(`${state.currentMap.central_concept} ${state.currentMap.title}`);
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
                    newTutor.innerHTML = `<strong style="color:#10b981;">Diagnose korrekt deduziert (+100 XP)</strong><br>Du hast <strong>„${escapeHtml(state.currentMap.central_concept)}“</strong> aus den Kausalästen abgeleitet.`;
                }
            } else if (tutorEl) {
                tutorEl.innerHTML = `<strong style="color:#f59e0b;">Noch nicht ganz:</strong> „${escapeHtml(rootGuessInput.value)}“ passt noch nicht zum gesuchten Zentralkonzept. Nutze die Leitfragen der Hauptäste.`;
            }
        };
        rootGuessBtn?.addEventListener('click', verifyRootDeduction);
        rootGuessInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') verifyRootDeduction();
        });

        // Inspektor-Klicks fahren Kamera direkt zum Knoten + zeigen Leitfrage
        document.querySelectorAll('[data-ins-slot]').forEach(el => {
            el.addEventListener('click', () => {
                const slotId = el.getAttribute('data-ins-slot');
                if (!isNodeHiddenByCollapse(slotId)) {
                    focusCameraOnNode(slotId, 0.85);
                }
                if (state.solvedNodeIds.has(slotId)) {
                    showSolvedNodeExplanation(slotId);
                } else {
                    showSlotSocraticHint(slotId);
                }
            });
        });

        // Zoom & Navigation HUD
        document.getElementById('mm-zoom-in')?.addEventListener('click', () => adjustZoom(0.14));
        document.getElementById('mm-zoom-out')?.addEventListener('click', () => adjustZoom(-0.14));
        document.getElementById('mm-zoom-100')?.addEventListener('click', () => adjustZoom(1.0 - state.zoom));
        document.getElementById('mm-zoom-fit')?.addEventListener('click', () => fitStageToViewport());
        document.getElementById('mm-focus-next')?.addEventListener('click', () => focusNextOpenSlot());
        document.getElementById('mm-expand-all')?.addEventListener('click', () => {
            state.collapsedNodeIds.clear();
            computeLayout(state.currentMap);
            renderModule();
            requestAnimationFrame(() => {
                fitStageToViewport();
                drawSvgConnections();
            });
        });

        // Subtree-Collapse-Buttons auf gelösten Knoten
        document.querySelectorAll('[data-collapse-node]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                toggleSubtreeCollapse(btn.getAttribute('data-collapse-node'));
            });
        });

        // Canvas Pan & Wheel Zoom
        const viewport = document.getElementById('mm-canvas-viewport');
        if (viewport) {
            viewport.addEventListener('wheel', e => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                adjustZoom(delta);
            }, { passive: false });

            viewport.addEventListener('pointerdown', e => {
                if (e.target.closest('.mm-node') || e.target.closest('.mm-canvas-HUD') || e.target.closest('.mm-crosslink-badge')) return;
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

        bindPoolChipEvents();

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

        function clearDragHighlights() {
            document.querySelectorAll('.mm-node-slot').forEach(s => s.classList.remove('drag-over'));
            document.getElementById('mm-quarantine-dropzone')?.classList.remove('drag-over-quarantine');
        }

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

                clearDragHighlights();
                const dropTarget = findDropTargetUnderPoint(moveEvent.clientX, moveEvent.clientY);
                if (dropTarget?.type === 'slot') {
                    dropTarget.el.classList.add('drag-over');
                } else if (dropTarget?.type === 'quarantine') {
                    dropTarget.el.classList.add('drag-over-quarantine');
                }
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
                clearDragHighlights();

                const dropTarget = findDropTargetUnderPoint(upEvent.clientX, upEvent.clientY);
                if (dropTarget?.type === 'slot') {
                    const slotId = dropTarget.el.getAttribute('data-slot-id');
                    evaluateDropAttempt(nodeId, slotId, dropTarget.el);
                } else if (dropTarget?.type === 'quarantine') {
                    evaluateQuarantineAttempt(nodeId);
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

    function findDropTargetUnderPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);
        for (const el of elements) {
            const quarantine = el.closest && el.closest('#mm-quarantine-dropzone');
            if (quarantine) return { type: 'quarantine', el: quarantine };
            const slot = el.closest && el.closest('.mm-node-slot');
            if (slot) return { type: 'slot', el: slot };
        }
        return null;
    }

    // ========================================================================
    // 10. AUSWERTUNG: DD-QUARANTÄNE, DEEP MASTERY GATE & SYNTHESE-PRÜFUNG
    // ========================================================================

    function evaluateQuarantineAttempt(draggedNodeId) {
        const map = state.currentMap;
        if (!map) return;

        const activeDistractors = getActiveDistractors(map);
        const distractorObj = activeDistractors.find(d => d.id === draggedNodeId);

        // Echten Knoten fälschlich aussortiert -> Sokratischer Stopp
        if (!distractorObj) {
            const realNode = map.nodes.find(n => n.id === draggedNodeId);
            state.mistakesCount += 1;
            state.streakCount = 0;
            if (realNode) state.weakNodeIds.add(realNode.id);
            state.selectedChipId = null;

            updateLiveTelemetryCounters();
            document.querySelectorAll('.mm-chip.selected-chip').forEach(c => c.classList.remove('selected-chip'));

            const tutorEl = document.getElementById('mm-tutor-message');
            if (tutorEl && realNode) {
                const depth = state.nodeMeta[realNode.id]?.depth || 1;
                tutorEl.innerHTML = `
                    <strong style="color:#ef4444;">Keine Falle:</strong><br>
                    <strong>„${escapeHtml(realNode.label)}“</strong> ist ein echtes Kernkonzept auf <strong>Ebene ${depth}</strong> von <em>${escapeHtml(getRootDisplayTitle())}</em>.<br>
                    <div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8; font-size:0.8rem;">
                        <strong>Denkanstoß:</strong> ${escapeHtml(realNode.socratic_hint || 'Prüfe, zu welchem Hauptast oder Detailknoten dieser Baustein gehört.')}
                    </div>
                `;
            }
            return;
        }

        if (state.deepComprehensionMode) {
            openDistractorVerificationModal(distractorObj);
        } else {
            finalizeDistractorQuarantine(distractorObj, true);
        }
    }

    function openDistractorVerificationModal(distractorObj) {
        const existing = document.querySelector('.mm-synapse-modal-backdrop');
        if (existing) existing.remove();

        const map = state.currentMap;
        const safeRootTitle = getRootDisplayTitle();
        const correctReason = distractorObj.distractor_reason || 'Klinisch nicht passend für diese Entität oder kontraindiziert.';

        const otherReasons = Array.from(new Set(
            getActiveDistractors(map)
                .filter(d => d.id !== distractorObj.id && d.distractor_reason && d.distractor_reason !== correctReason)
                .map(d => d.distractor_reason)
        ));

        const fallbackPlausibles = [
            `Dieser Schritt ist zwar leitliniengerecht für „${safeRootTitle}“, darf jedoch erst nach vollständiger Ausheilung im ambulanten Langzeitverlauf nach 12 Monaten eingesetzt werden.`,
            `Der Befund ist bei „${safeRootTitle}“ zwar pathognomonisch, wird aber in modernen Leitlinien wegen fehlender Kosteneffizienz nicht mehr gelehrt.`
        ];

        const wrongOpts = shuffleArray([...otherReasons, ...fallbackPlausibles]).slice(0, 2);
        const options = shuffleArray([
            { text: correctReason, isCorrect: true },
            ...wrongOpts.map(t => ({ text: t, isCorrect: false }))
        ]);

        const backdrop = document.createElement('div');
        backdrop.className = 'mm-synapse-modal-backdrop';
        backdrop.innerHTML = `
            <div class="mm-synapse-modal">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                    <span style="font-size:0.78rem; font-weight:700; color:#f87171; text-transform:uppercase; letter-spacing:0.04em;">
                        DD-Quarantäne begründen
                    </span>
                    <span style="font-size:0.73rem; padding:2px 8px; border-radius:6px; background:rgba(239,68,68,0.14); color:#fca5a5; font-weight:600;">
                        Differenzialdiagnose / Kontraindikation
                    </span>
                </div>
                <div class="mm-mastery-question-box" style="border-left-color:#ef4444;">
                    Warum ist <strong>„${escapeHtml(distractorObj.label)}“</strong> bei <em>${escapeHtml(safeRootTitle)}</em> eine klinische Falle?
                </div>
                <div class="mm-synapse-options">
                    ${options.map((o, idx) => `
                        <button type="button" class="mm-synapse-opt-btn" data-q-opt="${idx}">
                            <span><strong>${String.fromCharCode(65 + idx)})</strong> ${escapeHtml(o.text)}</span>
                            <span style="color:#64748b; font-weight:700;">→</span>
                        </button>
                    `).join('')}
                </div>
                <div id="mm-quarantine-fb"></div>
                <div style="display:flex; justify-content:flex-end; margin-top:12px;">
                    <button type="button" id="mm-quarantine-confirm" class="mm-clean-btn is-primary" style="display:none;">
                        Falle entsorgen (+30 XP)
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);

        let hadError = false;
        let solved = false;
        backdrop.querySelectorAll('[data-q-opt]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (solved) return;
                const opt = options[Number(btn.getAttribute('data-q-opt'))];
                const fb = backdrop.querySelector('#mm-quarantine-fb');
                if (opt.isCorrect) {
                    solved = true;
                    btn.classList.add('correct-choice');
                    backdrop.querySelectorAll('[data-q-opt]').forEach(b => { b.disabled = true; });
                    if (fb) {
                        fb.innerHTML = `<div class="mm-mastery-rationale-box"><strong style="color:#34d399;">Korrekt begründet.</strong> Diese Differenzialdiagnose-Falle ist sicher enttarnt.</div>`;
                    }
                    const confirmBtn = backdrop.querySelector('#mm-quarantine-confirm');
                    if (confirmBtn) {
                        confirmBtn.style.display = 'inline-flex';
                        confirmBtn.focus();
                        confirmBtn.addEventListener('click', () => {
                            backdrop.remove();
                            finalizeDistractorQuarantine(distractorObj, !hadError);
                        });
                    }
                } else {
                    hadError = true;
                    state.mistakesCount += 1;
                    state.streakCount = 0;
                    btn.classList.add('wrong-choice');
                    btn.disabled = true;

                    updateLiveTelemetryCounters();

                    if (fb) {
                        fb.innerHTML = `<div class="mm-mastery-nudge-box"><strong>Prüfe genauer:</strong> Welcher Pathomechanismus oder welche Leitlinien-Kontraindikation macht genau <em>„${escapeHtml(distractorObj.label)}“</em> falsch?</div>`;
                    }
                }
            });
        });
    }

    function finalizeDistractorQuarantine(distractorObj, flawless) {
        state.eliminatedDistractorIds.add(distractorObj.id);
        state.selectedChipId = null;

        if (flawless) {
            state.streakCount += 1;
            if (state.streakCount > state.maxStreak) state.maxStreak = state.streakCount;
            if (typeof window.applyXpDelta === 'function') window.applyXpDelta(30, 'Klinische DD-Falle enttarnt');
        }
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(12);

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

        const tutorEl = document.getElementById('mm-tutor-message');
        if (tutorEl) {
            tutorEl.innerHTML = `
                <strong style="color:#34d399;">Falle quarantänisiert:</strong><br>
                <strong>„${escapeHtml(distractorObj.label)}“</strong> wurde aussortiert:<br>
                <div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(16,185,129,0.12); border-left:3px solid #10b981; font-size:0.8rem;">
                    ${escapeHtml(distractorObj.distractor_reason)}
                </div>
            `;
        }
    }

    async function evaluateDropAttempt(draggedNodeId, targetSlotId, slotElement) {
        const map = state.currentMap;
        if (!map) return;

        const targetNode = map.nodes.find(n => n.id === targetSlotId);
        if (!targetNode) return;

        const tutorEl = document.getElementById('mm-tutor-message');

        // 1. Kausal-Sperre prüfen (N-Ebenen-fähig)
        if (isSlotCurrentlyLocked(targetNode)) {
            const targetDepth = state.nodeMeta[targetNode.id]?.depth || 2;
            if (slotElement) {
                slotElement.classList.remove('mm-node-error');
                void slotElement.offsetWidth;
                slotElement.classList.add('mm-node-error');
            }
            if (tutorEl) {
                tutorEl.innerHTML = `
                    <strong style="color:#38bdf8;">Zwischenschritt auf Ebene ${targetDepth - 1} fehlt</strong><br>
                    Dieser Slot liegt auf <strong>Ebene ${targetDepth}</strong>. Verifiziere zuerst den übergeordneten Knoten auf Ebene ${targetDepth - 1} (kein Fehlerpunkt).
                `;
            }
            return;
        }

        // 2. Distraktor-Falle auf dem Canvas abgelegt
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
                    <strong style="color:#f87171;">Differenzialdiagnose-Falle ausgelöst:</strong><br>
                    <strong>„${escapeHtml(distractorObj.label)}“</strong> gehört in die rote <strong>DD-Quarantäne</strong>:<br>
                    <div style="margin-top:6px; padding:7px 9px; border-radius:6px; background:rgba(239,68,68,0.14); border-left:3px solid #ef4444; font-size:0.81rem;">
                        ${escapeHtml(distractorObj.distractor_reason)}
                    </div>
                `;
            }
            return;
        }

        const draggedNode = map.nodes.find(n => n.id === draggedNodeId);
        if (!draggedNode) return;

        // 3. Exakte Übereinstimmung ODER Leaf- & CrossLink-sichere semantische Äquivalenz
        const isExactMatch = draggedNode.id === targetNode.id;
        const bothAreLeaves = (state.nodeMeta[draggedNode.id]?.childrenIds?.length || 0) === 0
            && (state.nodeMeta[targetNode.id]?.childrenIds?.length || 0) === 0;
        const hasCrossLinkRef = (map.cross_links || []).some(cl =>
            cl.from === draggedNode.id || cl.to === draggedNode.id ||
            cl.from === targetNode.id || cl.to === targetNode.id
        );
        const isSemanticEquivalent = bothAreLeaves && !hasCrossLinkRef && (
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

            if (state.deepComprehensionMode) {
                await openDeepComprehensionGate(targetNode, false);
                return;
            }

            await finalizeNodePlacement(targetNode, true, false);
            return;
        }

        // 4. Fehlversuch beim Platzieren -> Sokratisches Differential-Feedback
        state.mistakesCount += 1;
        state.streakCount = 0;
        state.weakNodeIds.add(targetNode.id);

        updateLiveTelemetryCounters();

        if (slotElement) {
            slotElement.classList.remove('mm-node-error');
            void slotElement.offsetWidth;
            slotElement.classList.add('mm-node-error');
        }

        await triggerSocraticFeedback(draggedNode, targetNode);
    }

    async function resolveMasteryQuestionForNode(targetNode, forceAiRegenerate = false) {
        if (!forceAiRegenerate && targetNode.mastery_question && Array.isArray(targetNode.mastery_question.options) && targetNode.mastery_question.options.length >= 3) {
            return targetNode.mastery_question;
        }

        const map = state.currentMap;
        const parentLabel = getParentLabel(targetNode, true);
        const catLabel = CATEGORIES[targetNode.category]?.label || targetNode.category;
        const depth = state.nodeMeta[targetNode.id]?.depth || 1;

        const aiPrompt = `Du bist Prüfungsautor für das medizinische Staatsexamen (IMPP / USMLE Step 2 CK).
Ein Medizinstudent bearbeitet eine tiefe Multi-Ebenen-Mindmap zum Thema "${map.central_concept}" (${map.specialty}) und hat soeben auf Vertiefungsebene ${depth} den Baustein "${targetNode.label}" (Kategorie: ${catLabel}, Relation: "${targetNode.relation_label}" ausgehend von "${parentLabel}") platziert.
Hintergrundinfo: "${targetNode.explanation || targetNode.socratic_hint || ''}".

Erstelle EINE hochspezifische, tiefgehende Verständnisfrage (Bloom-Stufe: Analyse, Evaluation, Transfer), die prüft, ob der Student "${targetNode.label}" im Kontext von "${map.central_concept}" WIRKLICH tiefgründig verstanden hat.
WICHTIG:
1. Frage NICHT oberflächlich nach der Ast-Zugehörigkeit, sondern nach dem exakten Pathomechanismus, molekularen Schritt, Leitlinien-Cutoff, einer klinischen Fallkonstellation oder absoluten Kontraindikation.
2. Erstelle genau 4 Antwortoptionen ("options") mit strikter Längenparität (ca. 14 bis 24 Wörter, gleicher Fachstil, keine Test-Wiseness!).
3. Gib "correct_index" (0–3), "socratic_nudge" (Denkanstoß bei falscher Antwort OHNE Lösungsspoiler) und "rationale" (präzise Begründung) an.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Array mit genau einem Objekt:
[
  {
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correct_index": 0,
    "socratic_nudge": "...",
    "rationale": "..."
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
                    const opts = item.options.slice(0, 4);
                    const safeIdx = (Number.isInteger(item.correct_index) && item.correct_index >= 0 && item.correct_index < opts.length)
                        ? item.correct_index
                        : 0;
                    const generatedQuiz = {
                        question: item.question,
                        options: opts,
                        correct_index: safeIdx,
                        socratic_nudge: item.socratic_nudge || targetNode.socratic_hint || 'Überdenke den exakten Mechanismus und die Leitlinien-Kriterien dieses Schritts.',
                        rationale: item.rationale || targetNode.explanation || '',
                        _aiGenerated: true
                    };
                    targetNode.mastery_question = generatedQuiz;
                    saveCustomMindmapToDb(map).catch(() => {});
                    return generatedQuiz;
                }
            }
        } catch (_e) {
            console.warn('[Mindmap V7.3] Offline-Synthese-Fallback für Mastery-Question aktiv.');
        }

        const safeRootTitle = getRootDisplayTitle();
        const correctStatement = targetNode.explanation || `Durch „${targetNode.relation_label}“ resultiert aus „${parentLabel}“ unmittelbar das klinische Konzept „${targetNode.label}“.`;
        const otherNodes = map.nodes.filter(n => n.id !== targetNode.id && n.explanation);
        const distractorExplanations = shuffleArray(otherNodes).slice(0, 3).map(n => n.explanation);
        while (distractorExplanations.length < 3) {
            distractorExplanations.push('Es handelt sich um einen rein kompensatorischen Begleitmechanismus ohne prognostische Relevanz oder therapeutische Konsequenz im Akutstadium.');
        }

        return {
            question: `Tiefenverständnis-Prüfung (Ebene ${depth}) zu „${targetNode.label}“: Welche klinisch-pathophysiologische Aussage begründet diesen Baustein im Kontext von „${safeRootTitle}“ exakt?`,
            options: [correctStatement, ...distractorExplanations],
            correct_index: 0,
            socratic_nudge: targetNode.socratic_hint || 'Fokussiere dich auf den spezifischen Mechanismus dieses Tiefenknotens.',
            rationale: correctStatement
        };
    }

    async function openDeepComprehensionGate(targetNode, isReviewOnly = false, forceAiRegenerate = false) {
        const existingModal = document.querySelector('.mm-synapse-modal-backdrop');
        if (existingModal) existingModal.remove();

        const parentLabel = getParentLabel(targetNode, isReviewOnly);
        const catCfg = CATEGORIES[targetNode.category] || { label: 'Konzept', shortLabel: 'Konzept', color: '#38bdf8' };
        const depth = state.nodeMeta[targetNode.id]?.depth || 1;
        const tMeta = TIER_META[Math.min(4, depth)] || { short: `E${depth}`, badgeClass: 'tier-4' };

        const backdrop = document.createElement('div');
        backdrop.className = 'mm-synapse-modal-backdrop';
        backdrop.innerHTML = `
            <div class="mm-synapse-modal">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap;">
                    <span style="font-size:0.76rem; font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:0.04em;">
                        ${isReviewOnly ? 'Tiefenverständnis · Review' : 'Schritt 2/2 · Klinisches Tiefen-Verhör'}
                    </span>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="mm-tier-pill ${tMeta.badgeClass}">E${depth}</span>
                        <span style="display:inline-flex; align-items:center; gap:5px; font-size:0.74rem; padding:2px 8px; border-radius:6px; background:rgba(56,189,248,0.12); color:#cbd5e1; font-weight:600;">
                            <span class="mm-cat-dot" style="background:${escapeHtml(catCfg.color)};"></span>
                            ${escapeHtml(catCfg.shortLabel || catCfg.label)}
                        </span>
                    </div>
                </div>

                <div class="mm-synapse-chain-box">
                    <span class="mm-synapse-node-pill">${escapeHtml(parentLabel)}</span>
                    <span class="mm-synapse-missing-pill">→ ${escapeHtml(targetNode.relation_label || 'Kausalverbindung')} →</span>
                    <span class="mm-synapse-node-pill" style="border-color:#38bdf8;">${escapeHtml(targetNode.label)}</span>
                </div>

                <div id="mm-gate-body">
                    <div style="padding:24px; text-align:center; color:#94a3b8; font-size:0.86rem;">
                        Generiere Verständnisfrage zu <strong>„${escapeHtml(targetNode.label)}“</strong>...
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);

        const masteryData = await resolveMasteryQuestionForNode(targetNode, forceAiRegenerate);
        const gateBody = backdrop.querySelector('#mm-gate-body');
        if (!gateBody) return;

        const rawOpts = Array.isArray(masteryData.options) && masteryData.options.length > 0
            ? masteryData.options
            : [targetNode.explanation || targetNode.label];
        const safeCorrectIdx = (Number.isInteger(masteryData.correct_index) && masteryData.correct_index >= 0 && masteryData.correct_index < rawOpts.length)
            ? masteryData.correct_index
            : 0;

        const indexedOptions = rawOpts.map((text, idx) => ({
            text,
            isCorrect: idx === safeCorrectIdx
        }));
        const shuffledOptions = shuffleArray(indexedOptions);

        let optionsRevealed = !state.activeRecallFirstMode;
        let hadWrongAttempt = false;
        let solvedInModal = false;
        let confidenceState = 'sure'; // 'sure' | 'unsure'

        const renderGateContent = (userHypothesisText = '') => {
            gateBody.innerHTML = `
                <div class="mm-mastery-question-box">
                    ${escapeHtml(masteryData.question)}
                </div>

                ${!optionsRevealed ? `
                    <div class="mm-recall-first-box">
                        <div style="font-size:0.8rem; font-weight:700; color:#fcd34d;">
                            Active-Recall-Stufe (Freitext-Hypothese vor den Antwortoptionen)
                        </div>
                        <div style="font-size:0.78rem; color:#cbd5e1; margin-top:2px;">
                            Formuliere kurz deine eigene Erklärung, bevor du die 4 Optionen aufdeckst:
                        </div>
                        <textarea id="mm-recall-hypothesis-input" class="mm-recall-textarea" placeholder="Meine pathophysiologische / klinische Begründung...">${escapeHtml(userHypothesisText)}</textarea>
                        <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                            <button type="button" id="mm-btn-reveal-mc" class="mm-clean-btn is-primary">
                                Optionen aufdecken
                            </button>
                        </div>
                    </div>
                ` : `
                    ${userHypothesisText ? `
                        <div style="margin-bottom:10px; padding:8px 12px; border-radius:8px; background:rgba(56,189,248,0.09); border-left:3px solid #38bdf8; font-size:0.8rem; color:#cbd5e1;">
                            <strong>Deine Vorab-Hypothese:</strong> <em>„${escapeHtml(userHypothesisText)}“</em>
                        </div>
                    ` : ''}

                    <!-- METAKOGNITIVE KONFIDENZ-KALIBRIERUNG -->
                    <div class="mm-confidence-bar">
                        <span style="color:#94a3b8; font-weight:600;">Selbsteinschätzung vor Klick:</span>
                        <div style="display:flex; gap:6px;">
                            <button type="button" class="mm-conf-btn ${confidenceState === 'sure' ? 'active-sure' : ''}" data-conf="sure">
                                Sicher gewusst
                            </button>
                            <button type="button" class="mm-conf-btn ${confidenceState === 'unsure' ? 'active-unsure' : ''}" data-conf="unsure" title="Markiert den Knoten auch bei richtiger Antwort als Wackelkandidat für deinen Fehler-Drill">
                                Unsicher / Geraten
                            </button>
                        </div>
                    </div>

                    <div class="mm-synapse-options" id="mm-gate-options-list">
                        ${shuffledOptions.map((opt, idx) => `
                            <button type="button" class="mm-synapse-opt-btn" data-opt-idx="${idx}">
                                <span><strong>${String.fromCharCode(65 + idx)})</strong> ${escapeHtml(opt.text)}</span>
                                <span style="color:#64748b; font-weight:700;">→</span>
                            </button>
                        `).join('')}
                    </div>
                `}

                <div id="mm-gate-feedback"></div>

                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); flex-wrap:wrap;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" id="mm-gate-ai-regen" class="mm-clean-btn" style="height:30px; font-size:0.75rem;" title="Generiert per KI eine neue klinische Prüfungsfrage zu diesem Knoten">
                            Neue KI-Frage
                        </button>
                        <button type="button" id="mm-gate-pin-depot" class="mm-clean-btn" style="height:30px; font-size:0.75rem; color:#38bdf8;">
                            Ins Lern-Depot
                        </button>
                    </div>
                    <div style="display:flex; gap:8px;">
                        ${isReviewOnly ? `
                            <button type="button" id="mm-gate-close" class="mm-clean-btn" style="height:32px;">Schließen</button>
                        ` : ''}
                        <button type="button" id="mm-gate-confirm-next" class="mm-clean-btn is-primary" style="display:none; height:32px;">
                            Knoten einrasten →
                        </button>
                    </div>
                </div>
            `;

            gateBody.querySelector('#mm-btn-reveal-mc')?.addEventListener('click', () => {
                const val = gateBody.querySelector('#mm-recall-hypothesis-input')?.value.trim() || '';
                optionsRevealed = true;
                renderGateContent(val);
            });

            gateBody.querySelectorAll('[data-conf]').forEach(cBtn => {
                cBtn.addEventListener('click', () => {
                    if (solvedInModal) return;
                    confidenceState = cBtn.getAttribute('data-conf');
                    gateBody.querySelectorAll('[data-conf]').forEach(b => {
                        const mode = b.getAttribute('data-conf');
                        b.classList.toggle('active-sure', mode === 'sure' && confidenceState === 'sure');
                        b.classList.toggle('active-unsure', mode === 'unsure' && confidenceState === 'unsure');
                    });
                });
            });

            gateBody.querySelector('#mm-gate-ai-regen')?.addEventListener('click', () => {
                openDeepComprehensionGate(targetNode, isReviewOnly, true);
            });

            gateBody.querySelector('#mm-gate-pin-depot')?.addEventListener('click', async e => {
                const btn = e.currentTarget;
                await saveNodeToLearningDepot(targetNode);
                btn.textContent = 'Gespeichert';
                btn.disabled = true;
            });

            gateBody.querySelector('#mm-gate-close')?.addEventListener('click', () => backdrop.remove());

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

                        const markedUncertain = confidenceState === 'unsure';
                        const calibrationNote = markedUncertain
                            ? `<div style="margin-top:6px; font-size:0.78rem; color:#fcd34d;"><strong>Hinweis:</strong> Da du „Unsicher/Geraten“ gewählt hast, wird dieser Knoten für den Schwachstellen-Drill vorgemerkt.</div>`
                            : '';

                        if (fbEl) {
                            fbEl.innerHTML = `
                                <div class="mm-mastery-rationale-box">
                                    <strong style="color:#34d399;">Korrekt verifiziert</strong><br>
                                    ${escapeHtml(masteryData.rationale || targetNode.explanation || '')}
                                    ${calibrationNote}
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
                                    await finalizeNodePlacement(targetNode, !hadWrongAttempt, markedUncertain);
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

                        updateLiveTelemetryCounters();

                        const overconfidentNote = confidenceState === 'sure'
                            ? `<div style="margin-top:4px; font-size:0.76rem; color:#fca5a5;"><em>Kalibrierungs-Signal:</em> Hohe gefühlte Sicherheit bei falscher Antwort – starker Lernmoment (Hypercorrection-Effekt).</div>`
                            : '';

                        if (fbEl) {
                            fbEl.innerHTML = `
                                <div class="mm-mastery-nudge-box">
                                    <strong>Sokratischer Denkanstoß:</strong><br>
                                    ${escapeHtml(masteryData.socratic_nudge || targetNode.socratic_hint || 'Prüfe den exakten pathophysiologischen Mechanismus noch einmal.')}
                                    ${overconfidentNote}
                                </div>
                            `;
                        }
                    }
                });
            });
        };

        renderGateContent('');
    }

    async function openCrossLinkSynthesisModal(crossLink) {
        if (!crossLink || !state.currentMap) return;
        const fromNode = state.currentMap.nodes.find(n => n.id === crossLink.from);
        const toNode = state.currentMap.nodes.find(n => n.id === crossLink.to);
        if (!fromNode || !toNode) return;

        const existing = document.querySelector('.mm-synapse-modal-backdrop');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'mm-synapse-modal-backdrop';
        backdrop.innerHTML = `
            <div class="mm-synapse-modal" style="border-color:rgba(245,158,11,0.5);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:0.78rem; font-weight:700; color:#fbbf24; text-transform:uppercase; letter-spacing:0.04em;">
                        Querverbindungs-Synthese · Bloom 5
                    </span>
                </div>
                <div class="mm-synapse-chain-box" style="border-color:rgba(245,158,11,0.45);">
                    <span class="mm-synapse-node-pill">${escapeHtml(fromNode.label)}</span>
                    <span class="mm-synapse-missing-pill" style="background:rgba(245,158,11,0.16); border-color:#f59e0b; color:#fbbf24;">${escapeHtml(crossLink.label || 'Querverbindung')} →</span>
                    <span class="mm-synapse-node-pill">${escapeHtml(toNode.label)}</span>
                </div>
                <div id="mm-synth-body" style="padding:20px; text-align:center; color:#94a3b8; font-size:0.86rem;">
                    Lade Transfer-Synthesefrage...
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);

        let qData = crossLink.synthesis_question;
        if (!qData || !Array.isArray(qData.options) || qData.options.length < 4) {
            const prompt = `Du bist medizinischer Staatsexamens-Prüfer (Bloom-Stufe: Synthese & klinischer Transfer).
Verknüpfe für das Thema "${state.currentMap.central_concept}" diese beiden Mindmap-Knoten aus unterschiedlichen Domänen:
Knoten A: "${fromNode.label}" (${fromNode.explanation || ''})
Knoten B: "${toNode.label}" (${toNode.explanation || ''})
Querverbindung: "${crossLink.label || 'Klinische Wechselwirkung'}".

Erstelle EINE anspruchsvolle Transferfrage mit genau 4 längenbalancierten Antwortoptionen (14–24 Wörter), correct_index (0–3), socratic_nudge und rationale.
Antworte AUSSCHLIESSLICH mit einem validen JSON-Array mit genau einem Objekt:
[{"question":"...","options":["...","...","...","..."],"correct_index":0,"socratic_nudge":"...","rationale":"..."}]`;

            try {
                const res = await fetch('/api/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'depot_quiz', prompt })
                });
                if (res.ok) {
                    const data = await res.json();
                    const item = Array.isArray(data?.result) ? data.result[0] : null;
                    if (item?.question && Array.isArray(item.options) && item.options.length >= 4) {
                        qData = item;
                        crossLink.synthesis_question = item;
                        saveCustomMindmapToDb(state.currentMap).catch(() => {});
                    }
                }
            } catch (_e) {}
        }

        const synthBody = backdrop.querySelector('#mm-synth-body');
        if (!synthBody) return;

        if (!qData) {
            synthBody.innerHTML = `
                <div class="mm-mastery-rationale-box" style="text-align:left;">
                    <strong style="color:#fbbf24;">Klinische Brücke:</strong><br>
                    <strong>${escapeHtml(fromNode.label)}</strong> beeinflusst unmittelbar <strong>${escapeHtml(toNode.label)}</strong> (${escapeHtml(crossLink.label)}).<br>
                    <div style="margin-top:6px; font-size:0.8rem; color:#cbd5e1;">${escapeHtml(fromNode.explanation || '')} → ${escapeHtml(toNode.explanation || '')}</div>
                </div>
                <div style="display:flex; justify-content:flex-end; margin-top:12px;">
                    <button type="button" id="mm-synth-close" class="mm-clean-btn is-primary">Verstanden</button>
                </div>
            `;
            synthBody.querySelector('#mm-synth-close')?.addEventListener('click', () => backdrop.remove());
            return;
        }

        const rawSynthOpts = qData.options;
        const safeSynthIdx = (Number.isInteger(qData.correct_index) && qData.correct_index >= 0 && qData.correct_index < rawSynthOpts.length)
            ? qData.correct_index
            : 0;
        const opts = shuffleArray(rawSynthOpts.map((text, idx) => ({ text, isCorrect: idx === safeSynthIdx })));

        synthBody.style.textAlign = 'left';
        synthBody.style.padding = '0';
        synthBody.innerHTML = `
            <div class="mm-mastery-question-box" style="border-left-color:#f59e0b;">${escapeHtml(qData.question)}</div>
            <div class="mm-synapse-options">
                ${opts.map((o, idx) => `
                    <button type="button" class="mm-synapse-opt-btn" data-s-opt="${idx}">
                        <span><strong>${String.fromCharCode(65 + idx)})</strong> ${escapeHtml(o.text)}</span>
                        <span style="color:#64748b; font-weight:700;">→</span>
                    </button>
                `).join('')}
            </div>
            <div id="mm-synth-fb"></div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
                <button type="button" id="mm-synth-close" class="mm-clean-btn">Schließen</button>
            </div>
        `;

        synthBody.querySelector('#mm-synth-close')?.addEventListener('click', () => backdrop.remove());
        let done = false;
        synthBody.querySelectorAll('[data-s-opt]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (done) return;
                const chosen = opts[Number(btn.getAttribute('data-s-opt'))];
                const fb = synthBody.querySelector('#mm-synth-fb');
                if (chosen.isCorrect) {
                    done = true;
                    state.synthesisCompleted = true;
                    btn.classList.add('correct-choice');
                    synthBody.querySelectorAll('[data-s-opt]').forEach(b => { b.disabled = true; });
                    if (typeof window.applyXpDelta === 'function') window.applyXpDelta(50, 'Querverbindungs-Synthese');
                    if (fb) {
                        fb.innerHTML = `<div class="mm-mastery-rationale-box"><strong style="color:#34d399;">Transfer gemeistert (+50 XP)</strong><br>${escapeHtml(qData.rationale || '')}</div>`;
                    }
                } else {
                    btn.classList.add('wrong-choice');
                    btn.disabled = true;
                    if (fb) {
                        fb.innerHTML = `<div class="mm-mastery-nudge-box"><strong>Sokratischer Impuls:</strong> ${escapeHtml(qData.socratic_nudge || 'Verknüpfe den Pathomechanismus von Knoten A direkt mit der Konsequenz in Knoten B.')}</div>`;
                    }
                }
            });
        });
    }

    async function finalizeNodePlacement(targetNode, flawlessFirstTry, wasUncertain = false) {
        const map = state.currentMap;
        if (!map) return;

        state.solvedNodeIds.add(targetNode.id);
        state.selectedChipId = null;

        if (wasUncertain) {
            state.uncertainNodeIds.add(targetNode.id);
        }

        if (flawlessFirstTry && !wasUncertain) {
            state.streakCount += 1;
            if (state.streakCount > state.maxStreak) state.maxStreak = state.streakCount;
            if (typeof window.applyXpDelta === 'function') {
                const depth = state.nodeMeta[targetNode.id]?.depth || 1;
                window.applyXpDelta(20 + depth * 10, `Ebene-${depth} Tiefenprüfung 1st-Try`);
            }
        }

        // Falls im Blind-Modus zuvor geparkte Zusatzbegriffe an diesem Knoten jetzt sichtbar werden -> Layout neu berechnen
        const newlyVisibleUserTerms = getRenderableUserTerms(map).some(ut => !state.nodePositions[ut.id]);
        if (newlyVisibleUserTerms) {
            computeLayout(map);
        }

        const newlyUnlockedChildren = map.nodes.filter(n => n.parent_id === targetNode.id);
        const unlockedCrossLinks = (map.cross_links || []).filter(cl =>
            (cl.from === targetNode.id && state.solvedNodeIds.has(cl.to)) ||
            (cl.to === targetNode.id && state.solvedNodeIds.has(cl.from))
        );

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
            const depth = state.nodeMeta[targetNode.id]?.depth || 1;
            const rationaleText = targetNode.mastery_question?.rationale || targetNode.explanation;
            const pearlText = rationaleText
                ? `<div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(16,185,129,0.12); border-left:3px solid #10b981; font-size:0.8rem;"><strong>Essenz:</strong> ${escapeHtml(rationaleText)}</div>`
                : '';
            const unlockNotice = newlyUnlockedChildren.length > 0
                ? `<div style="margin-top:6px; color:#38bdf8; font-size:0.79rem;">Ebene ${depth + 1} freigeschaltet: ${newlyUnlockedChildren.length} Vertiefung(en) an „${escapeHtml(targetNode.label)}“.</div>`
                : '';
            const crossLinkNotice = unlockedCrossLinks.length > 0
                ? `<div style="margin-top:5px; color:#fbbf24; font-size:0.79rem;">Querverbindung sichtbar: „${escapeHtml(unlockedCrossLinks[0].label)}“ (Klick für Synthese).</div>`
                : '';

            updatedTutorEl.innerHTML = `
                <strong style="color:#34d399;">✓ E${depth}-Knoten verifiziert</strong><br>
                <strong>„${escapeHtml(targetNode.label)}“</strong> folgt über <em>„${escapeHtml(targetNode.relation_label || 'Verbindung')}“</em> aus <strong>„${escapeHtml(parentLabel)}“</strong>.
                ${pearlText}
                ${unlockNotice}
                ${crossLinkNotice}
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                    <button type="button" class="mm-depot-pin-btn" data-pin-node="${escapeHtml(targetNode.id)}">
                        Ins Lern-Depot
                    </button>
                    <button type="button" class="mm-depot-pin-btn" data-retest-node="${escapeHtml(targetNode.id)}">
                        Prüfungsfrage öffnen
                    </button>
                </div>
            `;
            bindTutorActionButtons(updatedTutorEl);
        }

        if (state.solvedNodeIds.size === map.nodes.length) {
            await saveProgressToDb();
            const finalTutorEl = document.getElementById('mm-tutor-message');
            if (finalTutorEl) {
                const totalAttempts = map.nodes.length + state.mistakesCount;
                const accuracy = totalAttempts > 0 ? Math.round((map.nodes.length / totalAttempts) * 100) : 100;
                const weakCount = new Set([...state.weakNodeIds, ...state.uncertainNodeIds]).size;
                finalTutorEl.innerHTML = `
                    <strong style="color:#34d399;">Mindmap komplett gemeistert (${accuracy}% · Max-Serie ${state.maxStreak})</strong><br>
                    Alle ${map.nodes.length} Konzepte über ${state.maxTreeDepth} Ebenen verifiziert (${state.mistakesCount} Fehler${weakCount > 0 ? `, ${weakCount} Wackelkandidat(en)` : ''}).
                    ${weakCount > 0 ? `<br>Nutze <strong>Drill (${weakCount})</strong> in der Kopfzeile für die gezielte Nachschärfung.` : ''}
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
                    pinBtn.textContent = 'Gespeichert';
                    pinBtn.disabled = true;
                }
            });
        }

        const retestBtn = containerEl.querySelector('[data-retest-node]');
        if (retestBtn) {
            retestBtn.addEventListener('click', () => {
                const nodeId = retestBtn.getAttribute('data-retest-node');
                const node = state.currentMap?.nodes.find(n => n.id === nodeId);
                if (node) openDeepComprehensionGate(node, true, false);
            });
        }
    }

    function showSolvedNodeExplanation(slotId) {
        const node = state.currentMap?.nodes.find(n => n.id === slotId);
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!node || !tutorEl) return;

        const parentLabel = getParentLabel(node, true);
        const depth = state.nodeMeta[node.id]?.depth || 1;
        const rationaleText = node.mastery_question?.rationale || node.explanation || node.socratic_hint || 'Klinisch verifiziertes Konzept.';
        tutorEl.innerHTML = `
            <strong style="color:#34d399;">E${depth} · „${escapeHtml(node.label)}“${node._userPromoted ? ' ★' : ''}</strong><br>
            <span style="font-size:0.78rem; color:#94a3b8;">${escapeHtml(parentLabel)} → <em>${escapeHtml(node.relation_label)}</em></span><br>
            <div style="margin-top:6px;">${escapeHtml(rationaleText)}</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                <button type="button" class="mm-depot-pin-btn" data-pin-node="${escapeHtml(node.id)}">
                    Ins Lern-Depot
                </button>
                <button type="button" class="mm-depot-pin-btn" data-retest-node="${escapeHtml(node.id)}">
                    Prüfungsfrage öffnen
                </button>
            </div>
        `;
        bindTutorActionButtons(tutorEl);
    }

    function showSlotSocraticHint(slotId) {
        const targetNode = state.currentMap?.nodes.find(n => n.id === slotId);
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!targetNode || !tutorEl) return;

        const depth = state.nodeMeta[targetNode.id]?.depth || 1;
        if (isSlotCurrentlyLocked(targetNode)) {
            tutorEl.innerHTML = `
                <strong style="color:#fbbf24;">Ebene ${depth} noch gesperrt</strong><br>
                Verifiziere zuerst den direkt übergeordneten Knoten auf <strong>Ebene ${depth - 1}</strong>.
            `;
            return;
        }

        const parentLabel = getParentLabel(targetNode);
        const targetCat = state.blindMode ? 'Blind-Modus' : (CATEGORIES[targetNode.category]?.shortLabel || targetNode.category);
        const relHint = state.hideRelationLabels ? '[verdeckt]' : (targetNode.relation_label || '');

        tutorEl.innerHTML = `
            <strong style="color:#38bdf8;">Sokratische Leitfrage (E${depth})</strong><br>
            <span style="font-size:0.78rem; color:#94a3b8;">${escapeHtml(parentLabel)} → <em>${escapeHtml(relHint)}</em> · ${escapeHtml(targetCat)}</span>
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
        const draggedDepth = state.nodeMeta[draggedNode.id]?.depth || 1;
        const targetDepth = state.nodeMeta[targetNode.id]?.depth || 1;

        let structuralHint = '';
        if (draggedDepth !== targetDepth) {
            structuralHint = draggedDepth > targetDepth
                ? `<strong>Ebenen-Konflikt:</strong> „${escapeHtml(draggedNode.label)}“ gehört auf <em>Ebene ${draggedDepth}</em>, gesucht ist <em>Ebene ${targetDepth}</em>.`
                : `<strong>Ebenen-Konflikt:</strong> „${escapeHtml(draggedNode.label)}“ gehört auf <em>Ebene ${draggedDepth}</em>, nicht als Detail auf <em>Ebene ${targetDepth}</em> unter „${escapeHtml(parentLabel)}“.`;
        } else if (draggedNode.category !== targetNode.category) {
            structuralHint = `<strong>Domänen-Konflikt:</strong> Gewählt wurde <em>${escapeHtml(draggedCat)}</em>, gesucht ist <em>${escapeHtml(targetCat)}</em>.`;
        }

        tutorEl.innerHTML = `
            <div class="mm-tutor-thinking">
                <span>Analysiere Zuordnung sokratisch...</span>
            </div>
        `;

        const prompt = `Du bist ein sokratischer Medizin-Tutor auf Staatsexamensniveau.
Ein Medizinstudent bearbeitet eine Multi-Ebenen-Mindmap zum Thema "${state.currentMap.central_concept}".
Er hat versucht, den Begriff "${draggedNode.label}" (${draggedCat}, Ebene ${draggedDepth}) auf einen Ziel-Slot (Ebene ${targetDepth}) zu ziehen, der über "${targetNode.relation_label}" an "${parentLabel}" hängt (gesuchte Kategorie: ${targetCat}).
Die korrekte Lösung wäre "${targetNode.label}" (VERRATE DIESEN ZIELBEGRIFF UNTER KEINEN UMSTÄNDEN WÖRTLICH!).

Antworte AUSSCHLIESSLICH mit einem validen JSON-Array mit genau einem Objekt:
[
  {
    "flaw_analysis": "1 prägnanter Satz (per Du), warum '${draggedNode.label}' pathophysiologisch oder auf dieser Hierarchie-Ebene nicht passt.",
    "socratic_question": "1 gezielte sokratische Leitfrage, die auf das gesuchte Konzept hinführt, ohne '${targetNode.label}' zu nennen."
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
                    ${structuralHint ? `<div style="margin-bottom:6px; font-size:0.79rem; color:#fcd34d;">${structuralHint}</div>` : ''}
                    <strong style="color:#fbbf24;">Differential-Feedback:</strong><br>
                    ${aiFlaw ? `<span>${escapeHtml(aiFlaw)}</span><br>` : ''}
                    ${aiQuestion ? `<div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8;"><strong style="color:#38bdf8;">Leitfrage:</strong> ${escapeHtml(aiQuestion)}</div>` : ''}
                `;
                return;
            }
            throw new Error('Leere AI-Antwort');
        } catch (_err) {
            const fallbackReason = structuralHint || `<strong>„${escapeHtml(draggedNode.label)}“</strong> passt nicht auf Ebene ${targetDepth} unter <strong>„${escapeHtml(parentLabel)}“</strong>.`;
            tutorEl.innerHTML = `
                <strong style="color:#fbbf24;">Sokratische Analyse:</strong><br>
                ${fallbackReason}<br>
                <div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8;">
                    <strong style="color:#38bdf8;">Leitfrage:</strong> ${escapeHtml(targetNode.socratic_hint || 'Welche direkte Konsequenz oder Detailmaßnahme ergibt sich hier?')}
                </div>
            `;
        }
    }

    // ========================================================================
    // 11. V7.3 DEEP-TREE EXTRAKTIONS-PROMPT & VALIDIERENDER JSON-IMPORT
    // ========================================================================

    function copyExtractionPrompt() {
        const promptTemplate = `# ROLLE & ZIEL
Du bist ein medizinischer Facharzt-Tutor (Staatsexamensniveau IMPP/NBME) und Wissens-Architekt für das MedCheck Mindmap-Labor V7.3 ("Deep-Tree Multi-Tier Mastery & Synthesis").
Extrahiere aus dem folgenden Vorlesungstext das Thema VOLLSTÄNDIG von grob nach hochdetailliert in ein direkt importierbares, valides JSON-Objekt.

# 1. INHALTLICHE & STRUKTURELLE REGELN (ZERO-SUPERFICIALITY & FULL DEPTH)
1. VOLLSTÄNDIGE TIEFENABDECKUNG (16 BIS 24 KNOTEN ÜBER 3–4 EBENEN):
  - Ebene 1 (5 Hauptäste, "parent_id": "root"): Decken alle 5 Kategorien ab ("etiology", "pathophysiology", "clinical", "diagnostics", "therapy") als Makro-Einstieg.
  - Ebene 2 (7–10 Knoten, "parent_id": "n1" etc.): Mehrfachverzweigungen pro Hauptast sind ausdrücklich erwünscht! Zerlege jeden Hauptast in seine zentralen Untermechanismen, klinischen Syndrome, Diagnose-Pfade oder Therapiesäulen.
  - Ebene 3 & 4 (6–10 Knoten, "parent_id": "n1a" etc.): Hochspezifische Tiefendetails — exakte Rezeptoren, Mutationen, Autoantikörper, histologische Zeichen, Scores, Cutoffs mit Einheiten, Zusatzableitungen, Wirkmechanismen, Leitlinien-Zielwerte und absolute Kontraindikationen.
  - VERBOTEN: Generische Platzhalter wie "Labor", "Bildgebung", "Entzündung" oder "Medikamente".
2. TIEFENVERSTÄNDNIS-PRÜFUNGSFRAGE ("mastery_question") FÜR JEDEN KNOTEN:
  - Jedes Objekt in "nodes" MUSS eine eigene "mastery_question" auf Staatsexamensniveau (Bloom 3–5) besitzen (Warum/Wie/Mechanismus/Cutoff/Kontraindikation/Fallvignette).
  - "options": genau 4 Antwortoptionen mit strikter Längenparität (10–15 % Varianz, gleicher Fachstil, keine Test-Wiseness!).
  - "correct_index" (0–3), "socratic_nudge" (ohne Lösungsspoiler!) und präzise "rationale".
3. QUERVERBINDUNGEN ("cross_links"):
  - Erstelle 2 bis 3 fachübergreifende Brücken zwischen gelösten Knoten verschiedener Äste (z. B. Pathophysiologie -> Diagnostik oder Diagnostik -> Therapie-Kontraindikation) inklusive einer "synthesis_question" für den Transfer.
4. KLINISCHE FALLEN FÜR DIE AKTIVE DD-QUARANTÄNE ("distractors"):
  - Erstelle 3 bis 4 hochplausible Differenzialdiagnose-Fallen oder gefährliche Behandlungsfehler inklusive exakter "distractor_reason".

# 2. STRIKTES JSON-SCHEMA (Antworte NUR mit reinem, validem JSON ohne Markdown-Fences)
{
  "id": "mm_fach_thema_001",
  "schema_version": 7,
  "title": "Prägnanter Titel der Vorlesung / Erkrankung",
  "specialty": "Fachgebiet",
  "central_concept": "Zentrale Leitdiagnose / Hauptkonzept",
  "nodes": [
    {
      "id": "n1",
      "label": "Ebene-1-Konzept (max. 48 Z.)",
      "category": "etiology | pathophysiology | clinical | diagnostics | therapy",
      "parent_id": "root",
      "relation_label": "Eindeutige Kausalrelation",
      "socratic_hint": "Sokratische Leitfrage ohne den Begriff zu verraten?",
      "explanation": "Präzise klinisch-pathophysiologische Erklärung.",
      "mastery_question": {
        "question": "Tiefgehende Staatsexamensfrage zu diesem Knoten?",
        "options": [
          "Korrekte Antwort (Längenparität)...",
          "Hochplausibler Distraktor 1...",
          "Hochplausibler Distraktor 2...",
          "Hochplausibler Distraktor 3..."
        ],
        "correct_index": 0,
        "socratic_nudge": "Sokratischer Denkanstoß ohne Spoiler.",
        "rationale": "Klinische Begründung nach dem Lösen."
      }
    },
    {
      "id": "n1a",
      "label": "Ebene-2-Verzweigung (max. 48 Z.)",
      "category": "etiology",
      "parent_id": "n1",
      "relation_label": "vermittelt über / gliedert sich in",
      "socratic_hint": "...",
      "explanation": "...",
      "mastery_question": { "question": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "socratic_nudge": "...", "rationale": "..." }
    },
    {
      "id": "n1a1",
      "label": "Ebene-3-Molekular-/Cutoff-Detail (max. 48 Z.)",
      "category": "etiology",
      "parent_id": "n1a",
      "relation_label": "exakter Mechanismus / Cutoff",
      "socratic_hint": "...",
      "explanation": "...",
      "mastery_question": { "question": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "socratic_nudge": "...", "rationale": "..." }
    }
  ],
  "cross_links": [
    {
      "id": "cl1",
      "from": "n4a1",
      "to": "n5",
      "label": "Kurze klinische Brücke",
      "synthesis_question": {
        "question": "Domänenübergreifende Transferfrage zwischen beiden Knoten?",
        "options": ["...", "...", "...", "..."],
        "correct_index": 0,
        "socratic_nudge": "...",
        "rationale": "..."
      }
    }
  ],
  "distractors": [
    {
      "id": "d1",
      "label": "Täuschend echte DD-Falle / Kontraindikation",
      "category": "diagnostics | therapy | pathophysiology | clinical | etiology",
      "distractor_reason": "Exakte klinische Begründung, warum dieser Baustein in die Quarantäne gehört."
    }
  ]
}

Hier ist der Vorlesungstext:
[HIER VORLESUNGSTEXT EINFÜGEN]`;

        const showCopiedFeedback = () => {
            const btn = document.getElementById('mm-btn-prompt');
            if (btn && !btn.closest('.mm-popover-panel')) {
                const orig = btn.textContent;
                btn.textContent = '✓ Kopiert';
                setTimeout(() => { btn.textContent = orig; }, 2000);
            }
            const tutorEl = document.getElementById('mm-tutor-message');
            if (tutorEl) {
                tutorEl.innerHTML = `<strong style="color:#34d399;">Deep-Tree Prompt kopiert</strong><br>Füge ihn direkt in deine KI ein und importiere das erzeugte JSON über <strong>Import</strong>.`;
            }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(promptTemplate).then(showCopiedFeedback).catch(() => {
                fallbackCopyText(promptTemplate);
                showCopiedFeedback();
            });
        } else {
            fallbackCopyText(promptTemplate);
            showCopiedFeedback();
        }
    }

    function fallbackCopyText(text) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        } catch (_e) {}
    }

    function openImportModal(preselectedFolderId = null) {
        closeOpenPopovers();
        const safeFolderId = typeof preselectedFolderId === 'string' ? preselectedFolderId : null;
        const folders = getDashboardFolders();

        const existing = document.querySelector('.mm-modal-backdrop');
        if (existing) existing.remove();

        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'mm-modal-backdrop';
        modalBackdrop.innerHTML = `
            <div class="mm-modal">
                <h3 style="margin-top:0; font-size:1.02rem;">Mindmap (JSON) importieren</h3>
                <p style="font-size:0.82rem; color:#94a3b8; margin-bottom:0.75rem;">
                    Wähle optional direkt den Ziel-Fachordner oder lasse ihn automatisch anhand von <code>specialty</code> zuordnen.
                </p>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:0.75rem; flex-wrap:wrap;">
                    <label for="mm-import-folder" style="font-size:0.78rem; font-weight:600; color:var(--text-muted, #94a3b8);">Ziel-Ordner</label>
                    <select id="mm-import-folder" class="mm-studio-select" style="flex:1; min-width:220px; max-width:none;">
                        <option value="">Automatisch nach Fachgebiet zuordnen</option>
                        ${folders.map(f => `
                            <option value="${escapeHtml(f.id)}" ${safeFolderId === f.id ? 'selected' : ''}>
                                ${escapeHtml(f.label)}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <textarea id="mm-import-textarea" class="mm-textarea" placeholder='{\n  "id": "mm_neuro_hydrocephalus_001",\n  "schema_version": 7,\n  "title": "...",\n  "central_concept": "...",\n  "nodes": [ ... ],\n  "cross_links": [ ... ],\n  "distractors": [ ... ]\n}'></textarea>
                <div id="mm-import-error" style="color:#f87171; font-size:0.8rem; margin-bottom:0.75rem;"></div>
                <div style="display:flex; justify-content:flex-end; gap:0.65rem;">
                    <button id="mm-modal-cancel" class="mm-clean-btn">Abbrechen</button>
                    <button id="mm-modal-save" class="mm-clean-btn is-primary">Validieren & speichern</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalBackdrop);

        const closeModal = () => modalBackdrop.remove();
        modalBackdrop.addEventListener('click', e => {
            if (e.target === modalBackdrop) closeModal();
        });
        modalBackdrop.querySelector('#mm-modal-cancel')?.addEventListener('click', closeModal);

        modalBackdrop.querySelector('#mm-modal-save')?.addEventListener('click', async () => {
            const raw = modalBackdrop.querySelector('#mm-import-textarea').value.trim();
            const chosenFolderId = modalBackdrop.querySelector('#mm-import-folder')?.value || '';
            const errEl = modalBackdrop.querySelector('#mm-import-error');
            try {
                const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
                const parsed = JSON.parse(cleaned);

                if (!parsed.central_concept || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
                    throw new Error('JSON muss "central_concept" und ein nicht-leeres Array "nodes" enthalten.');
                }

                const seenIds = new Set();
                parsed.nodes.forEach((n, idx) => {
                    if (!n.id || seenIds.has(n.id)) n.id = `n_auto_${idx + 1}`;
                    seenIds.add(n.id);
                    if (!n.parent_id) n.parent_id = 'root';
                    if (!CATEGORIES[n.category]) n.category = 'pathophysiology';
                });

                // Nur valide Querverbindungen behalten (beide Endpunkte müssen existieren)
                parsed.cross_links = Array.isArray(parsed.cross_links)
                    ? parsed.cross_links.filter(cl => cl && seenIds.has(cl.from) && seenIds.has(cl.to) && cl.from !== cl.to)
                    : [];

                // Distraktor-IDs gegen Kollision mit echten Knoten-IDs schützen
                const seenDistIds = new Set();
                parsed.distractors = Array.isArray(parsed.distractors)
                    ? parsed.distractors
                        .filter(d => d && d.label)
                        .map((d, idx) => {
                            let distId = d.id || `d_auto_${idx + 1}`;
                            if (seenIds.has(distId) || seenDistIds.has(distId)) {
                                distId = `d_auto_${idx + 1}_${Date.now()}`;
                            }
                            seenDistIds.add(distId);
                            return {
                                ...d,
                                id: distId,
                                category: CATEGORIES[d.category] ? d.category : 'pathophysiology'
                            };
                        })
                    : [];

                // Optionale importierte Zusatzbegriffe sauber normalisieren
                parsed.user_terms = Array.isArray(parsed.user_terms)
                    ? parsed.user_terms
                        .filter(t => t && t.label)
                        .map((t, idx) => ({
                            id: t.id || `ut_imp_${Date.now()}_${idx}`,
                            label: String(t.label).trim().slice(0, 64),
                            note: String(t.note || '').trim().slice(0, 240),
                            category: CATEGORIES[t.category] ? t.category : 'pathophysiology',
                            parent_id: seenIds.has(t.parent_id) ? t.parent_id : resolveAnchorNodeIdForCategory(parsed, t.category),
                            ai_status: ['unchecked', 'valid', 'partial', 'wrong'].includes(t.ai_status) ? t.ai_status : 'unchecked',
                            ai_feedback: String(t.ai_feedback || ''),
                            created_at: t.created_at || new Date().toISOString()
                        }))
                    : [];

                parsed.id = parsed.id || `mm_custom_${Date.now()}`;
                parsed.schema_version = BUILTIN_SCHEMA_VERSION;
                parsed.title = parsed.title || parsed.central_concept;
                parsed.specialty = parsed.specialty || 'Vorlesung';

                if (chosenFolderId) {
                    const chosenFolder = folders.find(f => f.id === chosenFolderId);
                    parsed.folder_id = chosenFolderId;
                    if (chosenFolder) parsed.specialty = chosenFolder.label;
                    setFolderOverride(parsed.id, chosenFolderId);
                } else {
                    parsed.folder_id = resolveFolderForMindmap(parsed, folders).id;
                }

                if (parsed.user_terms.length > 0) {
                    saveUserTermsForMapId(parsed.id, parsed.user_terms);
                }

                await saveCustomMindmapToDb(parsed);
                await loadMindmapsAndProgress();
                selectMindmap(parsed.id);
                closeModal();
            } catch (err) {
                errEl.textContent = `Fehler beim Parsen: ${err.message}`;
            }
        });
    }

    window.MindmapModule = {
        init,
        openView,
        openFolderLibrary,
        openFolder,
        moveMindmapToFolder,
        getFoldersWithStats,
        selectMindmap,
        deleteCurrentMindmap,
        applyDifficultyPreset,
        openDeepComprehensionGate,
        openCrossLinkSynthesisModal,
        openUserTermModal,
        addUserTermsToCurrentMap,
        runAiCheckForUserTerm,
        promoteUserTermToOfficialNode,
        startWeakNodeDrill,
        focusNextOpenSlot
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
