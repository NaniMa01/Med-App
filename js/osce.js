/* ==========================================================================
   MEDCHECK – INTERAKTIVER OSCE-FALLGENERATOR & ROLLENSPIEL-SIMULATOR (js/osce.js)
   ==========================================================================
   FEATURES:
   01. 21 Fachrichtungen inkl. klinischer Untersuchungs- & Checklisten-Profile
   02. Deterministische Case-to-OSCE Synthese-Engine (aus importierten Fällen)
   03. Eingebaute Original-Referenzfälle (RLS – Fr. Keller & Ileus – Hr. Schneider)
   04. Realistischer Schweizer Labor- (SI-Einheiten) & Bildgebungs-Generator
   05. 3-Rollen-Modus (Kandidat/Türzettel, Simulationspatient, Prüfer-Checkliste)
   06. Live OSCE-Timer (8/10/12 Min.), Gemini-KI-Anbindung & A4-Stationsdruck
   ========================================================================== */

const OSCEModule = (() => {
    const STORAGE_KEY = 'medcheck_saved_osce_stations_v1';

    // ======================================================================
    // 01. DIE 21 FACHRICHTUNGEN & KLINISCHE PROFILE
    // ======================================================================
    const SPECIALTIES = [
        { id: 'Chirurgie', label: 'Chirurgie', icon: '🔪', setting: 'Notfallstation / Chirurgisches Ambulatorium', keywords: ['chirurg', 'abdomen', 'ileus', 'appendiz', 'hernie', 'cholezyst', 'peritonit', 'trauma', 'fraktur', 'kolik', 'milz', 'pankreas'] },
        { id: 'Ophthalmologie', label: 'Ophthalmologie', icon: '👁️', setting: 'Augenklinik / Notfallambulanz', keywords: ['auge', 'ophthal', 'visus', 'glaukom', 'retina', 'netzhaut', 'uveitis', 'diplopie', 'pupille', 'amaurosis', 'optikus'] },
        { id: 'Dermatologie', label: 'Dermatologie', icon: '🔬', setting: 'Dermatologische Poliklinik', keywords: ['derma', 'haut', 'exanthem', 'melanom', 'psoriasis', 'ekzem', 'pruritus', 'erythem', 'blase', 'urtikaria', 'vaskulitis'] },
        { id: 'Orthopädie', label: 'Orthopädie', icon: '🦴', setting: 'Orthopädische Sprechstunde / Traumatologie', keywords: ['ortho', 'gelenk', 'knie', 'schulter', 'kreuzband', 'meniskus', 'arthrose', 'wirbelsäule', 'lws', 'hüfte', 'fraktur', 'sehne'] },
        { id: 'Gesprächsführung', label: 'Gesprächsführung', icon: '💬', setting: 'Sprechzimmer / Stationsgespräch', keywords: ['gespräch', 'ethik', 'aufklärung', 'breaking bad news', 'spikes', 'adherenz', 'konflikt', 'motivation', 'compliance'] },
        { id: 'Pädiatrie', label: 'Pädiatrie', icon: '🧸', setting: 'Pädiatrische Notfallstation / Kinderarztpraxis', keywords: ['päd', 'kind', 'säugling', 'fieberkrampf', 'krupp', 'bronchiolitis', 'impf', 'entwicklung', 'exsikkose', 'meningitis'] },
        { id: 'Gynäkologie & Geburtshilfe', label: 'Gynäkologie & Geburtshilfe', icon: '🤰', setting: 'Gynäkologische Ambulanz / Gebärsaal', keywords: ['gyn', 'geburt', 'schwanger', 'repro', 'ovar', 'uterus', 'präeklampsie', 'blutung', 'zyklus', 'endometriose', 'mamma'] },
        { id: 'Palliativ Care', label: 'Palliativ Care', icon: '🕊️', setting: 'Palliativstation / Hausbesuch', keywords: ['palliativ', 'schmerztherapie', 'opioid', 'dyspnoe', 'lebensende', 'delir', 'rasselatmung', 'patientenverfügung', 'onkolog'] },
        { id: 'HNO', label: 'HNO', icon: '👂', setting: 'HNO-Poliklinik / Notfall', keywords: ['hno', 'ohr', 'schwindel', 'menière', 'tinnitus', 'hypakusis', 'epistaxis', 'tonsill', 'sinusitis', 'larynx', 'stridor'] },
        { id: 'Pneumologie', label: 'Pneumologie', icon: '🫁', setting: 'Pneumologische Sprechstunde / Notfallstation', keywords: ['pneumo', 'lunge', 'dyspnoe', 'copd', 'asthma', 'pneumonie', 'lungenembolie', 'pleura', 'husten', 'hämoptysen', 'bga'] },
        { id: 'Innere Medizin', label: 'Innere Medizin', icon: '🩺', setting: 'Allgemeinmedizinische Praxis / Innere Notfallstation', keywords: ['innere', 'allgemein', 'hämato', 'lymph', 'anämie', 'endokrin', 'diabetes', 'schilddrüse', 'gastro', 'leber', 'infekt'] },
        { id: 'Psychiatrie', label: 'Psychiatrie', icon: '🧠', setting: 'Psychiatrische Ambulanz / Krisenintervention', keywords: ['psych', 'depression', 'suizid', 'schizophren', 'wahn', 'manie', 'angst', 'panik', 'sucht', 'delir', 'demenz'] },
        { id: 'Kardiologie', label: 'Kardiologie', icon: '❤️', setting: 'Chest Pain Unit / Kardiologische Ambulanz', keywords: ['kardio', 'herz', 'thoraxschmerz', 'acs', 'stemi', 'infarkt', 'herzinsuffizienz', 'vorhofflimmern', 'synkope', 'ekg', 'klappe'] },
        { id: 'Radiologie', label: 'Radiologie', icon: '🩻', setting: 'Radiologischer Befundungsraum / interdisziplinäres Board', keywords: ['radio', 'röntgen', 'ct', 'mrt', 'kontrastmittel', 'fraktur', 'thorax', 'ischämie', 'blutung', 'kalibersprung'] },
        { id: 'Nahtkurs', label: 'Nahtkurs', icon: '🪡', setting: 'Chirurgische Wundversorgung / Notfall-Koje', keywords: ['naht', 'wunde', 'schnitt', 'platzwunde', 'lokalanästhesie', 'lidocain', 'tetanus', 'donati', 'einzelknopf', 'debridement'] },
        { id: 'Rechtsmedizin', label: 'Rechtsmedizin', icon: '⚖️', setting: 'Rechtsmedizinischer Dienst / Ärztliche Leichenschau', keywords: ['recht', 'forensik', 'leichenschau', 'todeszeichen', 'gewalt', 'hämatom', 'würger', 'intoxikation', 'alkohol'] },
        { id: 'Neurologie', label: 'Neurologie', icon: '⚡', setting: 'Neurologische Praxis / Stroke Unit / Notfall', keywords: ['neuro', 'nerv', 'myelon', 'rückenmark', 'stroke', 'schlaganfall', 'epilepsie', 'parkinson', 'demenz', 'cjk', 'ftd', 'lbd', 'nmosd', 'ms', 'polyneuropathie', 'rls'] },
        { id: 'Rheumatologie', label: 'Rheumatologie', icon: '🖐️', setting: 'Rheumatologische Poliklinik', keywords: ['rheuma', 'arthritis', 'gicht', 'lupus', 'sle', 'spondylo', 'vaskulitis', 'riesenzell', 'polymyalgia', 'autoimmun', 'ana'] },
        { id: 'Notfall', label: 'Notfall', icon: '🚨', setting: 'Interdisziplinäre Notfallstation (Schockraum / Koje)', keywords: ['notfall', 'akut', 'schock', 'sepsis', 'abcde', 'reanimation', 'bewusstlos', 'anaphylaxie', 'blutung', 'aortendissektion', 'querschnitt'] },
        { id: 'Ultraschall', label: 'Ultraschall', icon: '📡', setting: 'Sonographie-Kabine / POCUS Notfallstation', keywords: ['ultraschall', 'sono', 'pocus', 'efast', 'freie flüssigkeit', 'gallenblase', 'aorta', 'harnstau', 'thrombose', 'pleuraerguss'] },
        { id: 'Urologie', label: 'Urologie', icon: '💧', setting: 'Urologische Notfallambulanz / Sprechstunde', keywords: ['uro', 'niere', 'harn', 'kolik', 'urolithiasis', 'hämaturie', 'prostata', 'hoden', 'torsion', 'pyelonephritis', 'harnverhalt'] }
    ];

    // ======================================================================
    // 02. DIE 2 REFERENZ-VORLAGEN AUS DEINEM PROMPT (1:1 EINGEBAUT)
    // ======================================================================
    const BUILTIN_OSCE_PRESETS = {
        'PRESET_RLS_KELLER': {
            osce_id: 'PRESET_RLS_KELLER',
            specialty: 'Neurologie',
            title: 'Unruhige Beine am Abend – Idiopathisches Restless-Legs-Syndrom (RLS)',
            source_case_title: 'Referenz-Vorlage 1 (Allgemeinmedizin / Neurologie)',
            door_sign: {
                role: 'Sie sind Unterassistentin / Unterassistent in einer allgemeinmedizinischen Praxis.',
                vignette: 'Eine 54-jährige Patientin, Frau Sabine Keller, kommt zu Ihnen in die Praxis mit Beschwerden in den Beinen.',
                tasks: [
                    'Führen Sie eine gezielte Anamnese der aktuellen Beschwerden durch.',
                    'Führen Sie eine orientierende körperliche Untersuchung durch.',
                    'Erklären Sie am Ende der Patientin Ihre Verdachtsdiagnose(n) und Ihr geplantes weiteres Vorgehen in patientenverständlicher Sprache.'
                ],
                vitals: {
                    bp: '125/75 mmHg',
                    hr: '72/min, regelmäßig',
                    rr: '14/min',
                    temp: '36,7 °C',
                    spo2: '98 %',
                    bmi: '25 kg/m²'
                }
            },
            sp_script: {
                opening_quote: '„Meine Beine kribbeln in letzter Zeit so komisch. Es stört mich total! Vor allem abends ist es mir aufgefallen.“',
                qa_rows: [
                    { topic: 'Beschwerdedauer', answer: '„Seit etwa einem Jahr, aber es wird schlimmer.“' },
                    { topic: 'Lokalisation', answer: '„Beide Beine, vor allem die Waden und manchmal bis in die Oberschenkel.“' },
                    { topic: 'Charakter der Beschwerden', answer: '„Ein Ziehen, Kribbeln, inneres Unruhegefühl – richtig unangenehm. Es ist kein Schmerz, aber ich MUSS die Beine bewegen.“' },
                    { topic: 'Tageszeit / Auslöser', answer: '„Immer abends, wenn ich zur Ruhe komme oder im Bett liege. Wenn ich aufstehe und rumlaufe, wird es besser.“' },
                    { topic: 'Besserung durch Bewegung', answer: '„Ja, sofort. Wenn ich aufstehe oder die Beine bewege, verschwindet es kurz.“' },
                    { topic: 'Begleitsymptome', answer: '„Ich habe manchmal ein leichtes Ziehen in den Beinen tagsüber, aber abends ist es am schlimmsten.“' },
                    { topic: 'Schlafqualität', answer: '„Ich schlafe schlecht ein und wache oft auf. Ich bin tagsüber müde.“' },
                    { topic: 'Hände / Arme betroffen?', answer: '„Nein, nur die Beine.“' },
                    { topic: 'Vorerkrankungen', answer: '„Bluthochdruck.“' },
                    { topic: 'Medikation', answer: '„Ramipril 5 mg täglich. Keine weiteren Medikamente (keine Neuroleptika / Antidepressiva).“' },
                    { topic: 'Koffein / Alkohol / Rauchen', answer: '„Trinke zwei Tassen Kaffee am Tag, selten Alkohol, Nichtraucherin.“' },
                    { topic: 'Familienanamnese', answer: '„Meine Mutter hatte das auch, sie hat immer gesagt, ihre Beine seien ‚nie still‘.“' },
                    { topic: 'Neurologische Symptome (Taubheit, Schwäche)', answer: '„Nein, ich spüre alles normal, nur dieses Kribbeln und Zucken abends.“' },
                    { topic: 'Reiseanamnese / Thrombose / Schmerzen beim Gehen (Claudicatio)', answer: '„Keine.“' }
                ],
                behavior: [
                    'Freundlich, ruhig, leicht müde wirkend.',
                    'Sitzt unruhig, bewegt gelegentlich die Beine.',
                    'Kein akuter Krankheits- oder Schmerzcharakter.',
                    'Äußert deutliche Belastung durch Schlafmangel.'
                ]
            },
            physical_exam: [
                { area: 'Inspektion', finding: 'Unauffällig, keine Schwellung, keine Hautveränderungen, keine ausgeprägte Varikosis.' },
                { area: 'Motorik / Reflexe', finding: 'Kraftgrad 5/5 allseits, Muskeleigenreflexe (PSR, ASR) seitengleich mittellebhaft, keine Paresen.' },
                { area: 'Sensibilität', finding: 'Oberflächen- und Tiefensensibilität inkl. Vibrationssinn (Stimmgabel 8/8) normal.' },
                { area: 'Durchblutung (Fußpulse, Temperatur)', finding: 'A. dorsalis pedis und A. tibialis posterior beidseits kräftig palpabel, Füße warm.' },
                { area: 'Gangbild', finding: 'Unauffällig, Zehen- und Fersengang problemlos möglich.' },
                { area: 'Neurologische Zusatzbefunde', finding: 'Keine Zeichen einer Polyneuropathie oder Radikulopathie (Lasègue negativ).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf gezielte Nachfrage (Basisdiagnostik Sekundäres RLS):',
                labs: [
                    { param: 'Ferritin', value: '18 µg/l', ref: '30–150 µg/l (RLS-Zielwert > 50–75 µg/l)', flag: '↓ (Eisenmangel-Trigger!)' },
                    { param: 'Hämoglobin (Hb)', value: '128 g/l', ref: '120–160 g/l', flag: 'Normal' },
                    { param: 'Kreatinin / eGFR', value: '68 µmol/l (eGFR > 90 ml/min)', ref: '45–84 µmol/l', flag: 'Normal (Ausschluss Urämie)' },
                    { param: 'TSH basal', value: '1.8 mU/l', ref: '0.4–4.0 mU/l', flag: 'Normal' },
                    { param: 'Vitamin B12 & Folsäure', value: '410 pmol/l', ref: '> 200 pmol/l', flag: 'Normal' },
                    { param: 'HbA1c', value: '5.3 %', ref: '< 5.7 %', flag: 'Normal' }
                ],
                imaging: [
                    { modality: 'Apparative Zusatzdiagnostik (falls angefordert)', finding: 'Kein Hinweis auf pAVK (ABI 1.1 bds.) oder venöse Insuffizienz. Elektroneurographie (ENG) unauffällig. Polysomnographie nur bei Therapieresistenz oder V.a. Schlafapnoe indiziert.' }
                ]
            },
            examiner_info: {
                background: 'Erstvorstellung einer Patientin mit typischem Restless-Legs-Syndrom (RLS, positive Familienanamnese, getriggert durch niedrig-normales/erniedrigtes Ferritin < 50 µg/l).',
                goals: 'Erkennen der 4 obligaten RLS-Diagnosekriterien (Bewegungsdrang + Missempfindungen, Verschlechterung in Ruhe, sofortige Besserung durch Bewegung, abendliche/nächtliche Betonung), Ausschluss sekundärer Ursachen (Polyneuropathie, pAVK, Venenleiden, Niereninsuffizienz, Dopaminantagonisten) und Planung von Ferritin-Bestimmung & Therapie.',
                differentials: ['Polyneuropathie (z. B. diabetisch, B12-Mangel)', 'Periphere arterielle Verschlusskrankheit (pAVK / Claudicatio intermittens)', 'Chronisch-venöse Insuffizienz / Varikosis', 'Medikamenteninduziertes RLS / Akathisie (Neuroleptika, SSRI, Metoclopramid)', 'Nächtliche Wadenkrämpfe (Crampi)'],
                therapy_plan: '1. Eisensubstitution bei Ferritin < 50–75 µg/l, 2. Schlafhygiene & Reduktion von Koffein/Alkohol am Abend, 3. Bei Persistenz: Alpha-2-Delta-Liganden (Pregabalin/Gabapentin) oder niedrigdosierte Dopaminagonisten (Pramipexol, Ropinirol, Rotigotin – Cave: Augmentation!).'
            },
            checklist: [
                { category: 'Anamnese', item: 'Begrüßung, Vorstellung mit Name/Funktion, Erklärung des Vorgehens', points: 1 },
                { category: 'Anamnese', item: 'Erfragt Hauptsymptom und lässt Patientin zunächst frei berichten', points: 1 },
                { category: 'Anamnese', item: 'Erfragt Zeitpunkt, Auslöser und zirkadianen Verlauf (Abend-/Nachtbetonung)', points: 2 },
                { category: 'Anamnese', item: 'Erfragt gezielt Besserung durch Bewegung und Verschlechterung in Ruhe', points: 2 },
                { category: 'Anamnese', item: 'Erfragt Schlafstörungen und resultierende Tagesmüdigkeit / Leidensdruck', points: 1 },
                { category: 'Anamnese', item: 'Fragt nach Vorerkrankungen, Medikation (Dopaminantagonisten?), Noxen (Koffein/Alkohol) & positiver Familienanamnese', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Erfragt/prüft neurologische & vaskuläre Begleitsymptome (Sensibilität, Motorik, Fußpulse)', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Führt strukturierte orientierende Untersuchung der Beine durch (Inspektion, Pulse, Kraft, Reflexe, Sensibilität)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Erkennt die typische Konstellation und benennt den Verdacht auf ein Restless-Legs-Syndrom (RLS)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Nennt relevante Differenzialdiagnosen (Polyneuropathie, Eisenmangel, pAVK, Medikamentennebenwirkungen)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Schlägt gezielte Labordiagnostik vor (insb. Ferritin, Nierenfunktion/Kreatinin, Blutbild, B12, TSH)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Schlägt leitliniengerechten Therapieansatz vor (Eisenoptimierung, Schlafhygiene, Koffeinreduktion, ggf. medikamentöse Therapie)', points: 2 },
                { category: 'Kommunikation', item: 'Kommuniziert empathisch, strukturiert, patientenverständlich und fasst Ergebnisse & Plan klar zusammen', points: 2 }
            ]
        },

        'PRESET_ILEUS_SCHNEIDER': {
            osce_id: 'PRESET_ILEUS_SCHNEIDER',
            specialty: 'Chirurgie',
            title: 'Akutes Abdomen & Schwallartiges Erbrechen – Mechanischer Ileus (Bridenileus)',
            source_case_title: 'Referenz-Vorlage 2 (Chirurgie / Notfallstation)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt auf der interdisziplinären Notfallstation.',
                vignette: 'Herr Thomas Schneider (62-jährig) kommt aufgrund starker Bauchschmerzen und Übelkeit auf die Notfallstation.',
                tasks: [
                    'Führen Sie eine fokussierte Schmerz- und Systemanamnese (SOCRATES) durch.',
                    'Führen Sie eine strukturierte klinische Untersuchung des Abdomens durch.',
                    'Besprechen Sie mit dem Patienten Ihre Verdachtsdiagnose und das unmittelbare weitere Vorgehen.'
                ],
                vitals: {
                    bp: '95/60 mmHg',
                    hr: '110/min (tachykard)',
                    rr: '22/min',
                    temp: '37,8 °C',
                    spo2: '97 % (Raumluft)',
                    bmi: '26 kg/m²'
                }
            },
            sp_script: {
                opening_quote: '„Herr/Frau Doktor, ich halte diese Bauchkrämpfe nicht mehr aus! Mir ist speiübel und ich musste mich schon mehrfach übergeben.“',
                qa_rows: [
                    { topic: 'Beginn & Verlauf (Onset / Timing)', answer: '„Beginn plötzlich vor 24 Stunden. Die krampfartigen Schmerzen kommen und gehen in Wellen und werden immer schlimmer.“' },
                    { topic: 'Lokalisation & Ausstrahlung (Site / Radiation)', answer: '„Zu Beginn um den Bauchnabel herum, jetzt diffus im gesamten Mittel- und Unterbauch. Keine Ausstrahlung in den Rücken oder die Schulter.“' },
                    { topic: 'Schmerzcharakter & Intensität (Character / Severity)', answer: '„Wellenförmig, krampfartig (kolikartig). In den Spitzen auf der Schmerzskala (NRS) 8 von 10!“' },
                    { topic: 'Verstärkende / lindernde Faktoren (Exacerbating / Relieving)', answer: '„Stärker bei Bewegung und nach jedem Versuch etwas zu trinken/essen. Linderung bringt eigentlich gar nichts.“' },
                    { topic: 'Übelkeit & Erbrechen (Association)', answer: '„Mehrfaches Erbrechen seit gestern, zuletzt schwallartig und gelb-grünlich (gallig).“' },
                    { topic: 'Stuhlgang & Windabgang', answer: '„Kein Stuhlgang und auch kein einziger Windabgang mehr seit 2 Tagen (Stuhl- und Windverhalten). Mein Bauch ist stark aufgebläht.“' },
                    { topic: 'Allgemeinsymptome & Miktion', answer: '„Kaltschweißigkeit, starkes Schwächegefühl. Kein richtiges Fieber. Wasserlösen ging heute Morgen noch wenig, dunkler Urin.“' },
                    { topic: 'Voroperationen im Bauchraum', answer: '„Ja, vor 25 Jahren wurde mir der Blinddarm entfernt (Appendektomie).“' },
                    { topic: 'Vorerkrankungen & Koloskopie-Vorsorge', answer: '„Keine Vorerkrankungen bekannt. Vorsorge-Darmspiegelung habe ich bisher noch nie gemacht.“' },
                    { topic: 'Allergien, Medikamente, Noxen & Familienanamnese', answer: '„Keine Allergien, keine Dauermedikamente. Nichtraucher, selten Alkohol. In der Familie kein Darmkrebs und keine CED bekannt.“' }
                ],
                behavior: [
                    'Schmerzgeplagt, blass, leicht kaltschweißig.',
                    'Hält sich bei Schmerzwellen den Bauch und krümmt sich leicht.',
                    'Kooperativ, aber sichtlich erschöpft und besorgt.'
                ]
            },
            physical_exam: [
                { area: 'Inspektion', finding: 'Prall geblähtes Abdomen (Meteorismus), reizlose ältere Appendektomie-Narbe im rechten Unterbauch, keine sichtbaren Hernien.' },
                { area: 'Auskultation (alle 4 Quadranten)', finding: 'Hochgestellte, klingende, metallisch-spritzende und gesteigerte Darmgeräusche (Hyperperistaltik gegen Stenose).' },
                { area: 'Perkussion (alle 4 Quadranten)', finding: 'Ausgeprägt tympanitischer Klopfschall über dem gesamten Abdomen.' },
                { area: 'Palpation (schmerzfern im Oberbauch gestartet)', finding: 'Diffus druckschmerzhaftes Abdomen (v. a. Mittel-/Unterbauch), aktuell noch ohne brettharte Abwehrspannung. Bruchpforten (inguinal/umbilikal) frei.' },
                { area: 'Digital-rektale Untersuchung (DRU)', finding: 'Sphinktertonus normoton, Rektumampulle leer, kein Tumor tastbar, kein Blut am Fingerling.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf gezielte Nachfrage durch die Kandidatin / den Kandidaten:',
                labs: [
                    { param: 'Leukozyten', value: '14.8 G/l', ref: '4.0–10.0 G/l', flag: '↑ (Stress / beginnende Wanddurchwanderung)' },
                    { param: 'CRP', value: '42 mg/l', ref: '< 5.0 mg/l', flag: '↑' },
                    { param: 'Hämoglobin (Hb) / Hämatokrit', value: '162 g/l (Hk 0.49)', ref: '135–175 g/l', flag: 'Hämokonzentration (Volumenmangel)' },
                    { param: 'Kalium', value: '3.1 mmol/l', ref: '3.5–5.0 mmol/l', flag: '↓ (Hypokaliämie durch galliges Erbrechen!)' },
                    { param: 'Natrium & Chlorid', value: 'Na 133 mmol/l, Cl 92 mmol/l', ref: 'Na 135–145 mmol/l', flag: '↓ (Elektrolytverlust)' },
                    { param: 'Kreatinin', value: '138 µmol/l', ref: '62–106 µmol/l', flag: '↑ (Prärenale AKI durch Drittgenerationsverlust)' },
                    { param: 'BGA & Laktat (venös/arteriell)', value: 'pH 7.47, Laktat 2.6 mmol/l', ref: 'pH 7.35–7.45, Laktat < 1.8 mmol/l', flag: '⚠️ Laktaterhöhung + metabolische Alkalose!' },
                    { param: 'Lipase & Transaminasen (ALT/AST)', value: 'Lipase 38 U/l, ALT 24 U/l', ref: 'Lipase < 60 U/l, ALT < 50 U/l', flag: 'Normal' }
                ],
                imaging: [
                    { modality: 'Abdomen-Sonographie (POCUS)', finding: 'Dilatierte, flüssigkeitsgefüllte Dünndarmschlingen (> 3 cm) mit Pendelperistaltik („Klaviertasten-Phänomen“), schmaler Saum freier Flüssigkeit interenterisch.' },
                    { modality: 'Röntgen-Abdomenübersicht', finding: 'Multiple stehende Dünndarmspiegel (Spiegelbildung), rahmenförmiges Kolon weitgehend luftleer.' },
                    { modality: 'CT Abdomen/Becken mit i.v. KM (Goldstandard)', finding: 'Deutlicher Kalibersprung im distalen Ileum im Bereich einer Bride (Adhäsion nahe der alten Appendektomie-Region). Vorgeschaltete Dünndarmdilatation auf 4.2 cm, noch erhaltene Kontrastmittelaufnahme der Darmwand.' }
                ]
            },
            examiner_info: {
                background: 'Klassischer mechanischer Dünndarmileus (Bridenileus, 25 Jahre nach Appendektomie) mit drohender Strangulation, Volumenmangel (Hypotonie, Tachykardie, prärenales Nierenversagen) und Hypokaliämie durch Erbrechen.',
                goals: 'Strukturierte Schmerzanamnese (SOCRATES), Erkennen der Ileus-Kardinalsymptome (Kolikschmerz, galliges Erbrechen, Stuhl-/Windverhalten, Meteorismus), korrekte Reihenfolge der Abdomen-Untersuchung (Inspektion → Auskultation → Perkussion → Palpation → DRU) und sofortiges Einleiten des „Drip & Drain“-Protokolls + CT-Abdomen.',
                differentials: ['Mechanischer Bridenileus (Adhäsionen nach Appendektomie)', 'Inkarzerierte Hernie (inguinal / femoral / intern)', 'Mesenterialischämie (Differentialdiagnose bei Laktatanstieg!)', 'Kolonkarzinom-bedingter Dickdarmileus', 'Akute Pankreatitis / Hohlorganperforation'],
                therapy_plan: 'Sofortige stationäre chirurgische Aufnahme & „Drip & Drain“: 1. Nüchtern lassen (NPO), 2. Großlumige i.v.-Zugänge + kristalloide Volumensubstitution & Kaliumkorrektur, 3. Magensonde zur Dekompression legen, 4. Dauerkatheter (DK) zur Stundendiurese-Bilanzierung, 5. i.v. Analgesie & Antiemese, 6. Chirurgische Exploration (Adhäsiolyse) nach CT-Kalibersprung.'
            },
            checklist: [
                { category: 'Anamnese (SOCRATES)', item: 'Alle Schmerzdimensionen systematisch erfragt (SOCRATES: Site, Onset, Character, Radiation, Associations, Timing, Exacerbating/Relieving, Severity NRS)', points: 2 },
                { category: 'Anamnese (SOCRATES)', item: 'Spezifisch nach Begleitsymptomen gefragt: Übelkeit, Erbrechen (Qualität: gallig/miserere?), Miktion, Stuhlgang, Windabgang, Fieber', points: 2 },
                { category: 'Anamnese (SOCRATES)', item: 'Persönliche Anamnese erhoben: Voroperationen im Bauchraum (Appendektomie!), Vorerkrankungen, Vorsorgekoloskopie, Allergien, Medikamente, Noxen', points: 2 },
                { category: 'Anamnese (SOCRATES)', item: 'Familienanamnese erhoben (Karzinome, KHK, Diabetes, chronisch-entzündliche Darmerkrankungen)', points: 1 },
                { category: 'Klinische Untersuchung', item: 'Händedesinfektion vor und nach der Untersuchung durchgeführt / angesagt', points: 1 },
                { category: 'Klinische Untersuchung', item: 'Inspektion (AZ/EZ, Hautkolorit, Vorwölbung/Blähung, Narben!) & Auskultation über allen 4 Quadranten für mehrere Sekunden VOR der Palpation', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Perkussion über allen 4 Quadranten + Palpation schmerzfern gestartet (oberflächlich & tief mit Blickkontakt zum Patienten, inkl. Bruchpforten)', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Digital-rektale Untersuchung (DRU) aktiv erwähnt / durchgeführt', points: 1 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Äußert klar die Verdachtsdiagnose eines mechanischen Ileus (Bridenileus nach Appendektomie)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Verordnet zielgerichtetes Notfall-Labor: Hb, Leukozyten, CRP, Na, K, Kreatinin, Transaminasen, Lipase, BGA inkl. Laktat', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Verordnet adäquate Bildgebung: Abdomen-Sonographie, ggf. Röntgen-Abdomenübersicht und CT-Abdomen mit KM (Kalibersprung)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Initiiert stationäre chirurgische Aufnahme mit „Drip & Drain“ (Nüchtern, Magensonde, i.v. Flüssigkeit + Elektrolytausgleich, Analgesie, DK) & bespricht wahrscheinliche OP-Indikation', points: 3 },
                { category: 'Kommunikation', item: 'Begrüßung mit Funktion, schafft ruhige Atmosphäre, erklärt Verdachtsdiagnose & Magensonde/OP patientenverständlich ohne Fachjargon', points: 2 }
            ]
        }
    };

    // ======================================================================
    // 03. RUNTIME STATES DES OSCE-GENERATORS
    // ======================================================================
    let selectedSpecialty = 'Innere Medizin';
    let selectedSourceCaseId = '__AUTO__';
    let selectedSetting = 'auto';
    let currentOSCEData = null;
    let activeRoleMode = 'all'; // 'all' | 'candidate' | 'sp' | 'examiner'
    let revealedSections = { exam: false, labs: false, imaging: false };
    let checkedCriteria = {};
    let spSearchFilter = '';

    // Timer State
    let timerTotalSec = 480; // 8 Minuten Standard
    let timerRemainingSec = 480;
    let timerInterval = null;
    let isTimerRunning = false;

    // ======================================================================
    // 04. AUTOMATISCHE CSS-INJEKTION (DARK & BRIGHT MODE KOMPATIBEL)
    // ======================================================================
    function injectOSCEStyles() {
        if (document.getElementById('mc-osce-generator-styles')) return;
        const style = document.createElement('style');
        style.id = 'mc-osce-generator-styles';
        style.textContent = `
            .osce-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 9999;
                background: rgba(6, 9, 19, 0.82);
                backdrop-filter: blur(12px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                animation: osceFadeIn 0.18s ease-out;
            }
            .osce-modal-backdrop.hidden { display: none !important; }
            @keyframes osceFadeIn {
                from { opacity: 0; transform: scale(0.98); }
                to { opacity: 1; transform: scale(1); }
            }
            .osce-modal-window {
                width: 100%;
                max-width: 1420px;
                height: 92vh;
                background: var(--surface-primary, #0b1121);
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.2));
                border-radius: 20px;
                box-shadow: 0 25px 70px rgba(0, 0, 0, 0.55);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                color: var(--text-main, #f8fafc);
            }
            .osce-modal-header {
                padding: 16px 22px;
                border-bottom: 1px solid var(--card-border, rgba(148, 163, 184, 0.16));
                background: var(--surface-secondary, rgba(15, 23, 42, 0.75));
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
            }
            .osce-modal-body {
                display: grid;
                grid-template-columns: 340px 1fr;
                flex: 1;
                min-height: 0;
                overflow: hidden;
            }
            @media (max-width: 1024px) {
                .osce-modal-body {
                    grid-template-columns: 1fr;
                    overflow-y: auto;
                }
                .osce-config-sidebar {
                    border-right: none !important;
                    border-bottom: 1px solid var(--card-border);
                    max-height: none !important;
                }
                .osce-station-viewport {
                    overflow-y: visible !important;
                }
            }
            .osce-config-sidebar {
                padding: 16px;
                border-right: 1px solid var(--card-border, rgba(148, 163, 184, 0.16));
                background: var(--surface-secondary, rgba(15, 23, 42, 0.45));
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .osce-specialty-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 6px;
                max-height: 310px;
                overflow-y: auto;
                padding-right: 4px;
            }
            .osce-spec-btn {
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 8px 10px;
                border-radius: 10px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                background: var(--surface-primary, rgba(15, 23, 42, 0.6));
                color: var(--text-main, #e2e8f0);
                font-size: 0.75rem;
                font-weight: 700;
                cursor: pointer;
                text-align: left;
                transition: all 0.15s ease;
            }
            .osce-spec-btn:hover {
                border-color: var(--accent-cyan, #38bdf8);
                transform: translateY(-1px);
            }
            .osce-spec-btn.active {
                background: rgba(2, 132, 199, 0.22);
                border-color: var(--accent-cyan, #38bdf8);
                color: var(--accent-cyan, #38bdf8);
                box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25);
            }
            .osce-spec-count {
                margin-left: auto;
                font-size: 0.65rem;
                padding: 1px 6px;
                border-radius: 999px;
                background: rgba(148, 163, 184, 0.16);
                color: var(--text-muted, #94a3b8);
                font-family: 'JetBrains Mono', monospace;
            }
            .osce-station-viewport {
                padding: 20px 26px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 18px;
            }
            .osce-role-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                padding: 10px 14px;
                border-radius: 12px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.65));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                position: sticky;
                top: 0;
                z-index: 20;
                backdrop-filter: blur(10px);
            }
            .osce-role-tabs {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .osce-role-tab {
                padding: 6px 12px;
                border-radius: 8px;
                border: 1px solid transparent;
                background: transparent;
                color: var(--text-muted, #94a3b8);
                font-size: 0.78rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.15s;
            }
            .osce-role-tab.active {
                background: var(--surface-primary, #1e293b);
                color: var(--accent-cyan, #38bdf8);
                border-color: rgba(56, 189, 248, 0.35);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }
            .osce-timer-pill {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 5px 12px;
                border-radius: 999px;
                background: rgba(15, 23, 42, 0.75);
                border: 1px solid var(--card-border);
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.85rem;
                font-weight: 700;
            }
            .osce-timer-pill.warning {
                border-color: #f59e0b;
                color: #fcd34d;
                background: rgba(245, 158, 11, 0.15);
                animation: oscePulse 1.2s infinite;
            }
            @keyframes oscePulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.65; }
            }
            .osce-section-card {
                background: var(--surface-secondary, rgba(15, 23, 42, 0.5));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                border-radius: 14px;
                padding: 18px 20px;
            }
            .osce-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 12px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--card-border, rgba(148, 163, 184, 0.14));
            }
            .osce-section-title {
                font-size: 1rem;
                font-weight: 800;
                color: var(--text-main);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .osce-vitals-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
                gap: 10px;
                margin-top: 12px;
            }
            .osce-vital-box {
                padding: 10px 12px;
                border-radius: 10px;
                background: var(--surface-primary, rgba(6, 9, 19, 0.65));
                border: 1px solid var(--card-border);
            }
            .osce-vital-label {
                font-size: 0.68rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-muted);
                font-weight: 700;
            }
            .osce-vital-val {
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.9rem;
                font-weight: 800;
                color: var(--accent-cyan, #38bdf8);
                margin-top: 3px;
            }
            .osce-sp-quote {
                padding: 14px 16px;
                border-radius: 12px;
                background: rgba(2, 132, 199, 0.12);
                border-left: 4px solid var(--accent-cyan, #38bdf8);
                font-size: 0.96rem;
                font-weight: 700;
                font-style: italic;
                color: var(--text-main);
                margin-bottom: 14px;
            }
            .osce-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.84rem;
            }
            .osce-table th, .osce-table td {
                padding: 10px 12px;
                text-align: left;
                border-bottom: 1px solid var(--card-border, rgba(148, 163, 184, 0.14));
                vertical-align: top;
                line-height: 1.45;
            }
            .osce-table th {
                font-size: 0.72rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-muted);
                background: rgba(148, 163, 184, 0.06);
                font-weight: 800;
            }
            .osce-table tr:last-child td { border-bottom: none; }
            .osce-table td:first-child {
                font-weight: 700;
                width: 30%;
                color: var(--text-main);
            }
            .osce-checklist-row {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 12px;
                border-radius: 10px;
                border: 1px solid var(--card-border);
                background: var(--surface-primary);
                margin-bottom: 6px;
                cursor: pointer;
                transition: all 0.14s ease;
            }
            .osce-checklist-row:hover {
                border-color: var(--accent-cyan, #38bdf8);
            }
            .osce-checklist-row.is-checked {
                background: rgba(16, 185, 129, 0.12);
                border-color: rgba(16, 185, 129, 0.45);
            }
            .osce-checkbox-box {
                width: 20px;
                height: 20px;
                border-radius: 6px;
                border: 2px solid var(--text-muted);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 0.78rem;
                font-weight: 900;
                margin-top: 1px;
            }
            .osce-checklist-row.is-checked .osce-checkbox-box {
                background: #10b981;
                border-color: #10b981;
                color: #06281e;
            }
        `;
        document.head.appendChild(style);
    }

    // ======================================================================
    // 05. AUTOMATISCHER BUTTON-INJEKTOR IM REITER "FALL-GENERATOR" (#forge-view)
    // ======================================================================
    function ensureForgeOSCEButton() {
        const forgeView = document.getElementById('forge-view');
        if (!forgeView || document.getElementById('btn-open-osce-generator')) return;

        const subtitleEl = forgeView.querySelector('.panel-subtitle');
        const launchpad = document.createElement('div');
        launchpad.className = 'osce-forge-launchpad';
        launchpad.style.cssText = 'margin: 14px 0 18px 0; padding: 16px 18px; border-radius: 14px; background: linear-gradient(135deg, rgba(2, 132, 199, 0.16) 0%, rgba(16, 185, 129, 0.10) 100%); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;';
        launchpad.innerHTML = `
            <div>
                <div style="font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-cyan, #38bdf8); margin-bottom: 3px;">
                    PRAKTISCHES KLINIK- & ROLLENSPIEL-TRAINING
                </div>
                <div style="font-size: 1rem; font-weight: 800; color: var(--text-main);">
                    🩺 Interaktiver OSCE-Fallgenerator (21 Fachrichtungen)
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                    Erstellt aus deinen importierten MedCheck-Fällen realitätsgetreue OSCE-Stationen inkl. Türzettel, SP-Skript, Labor/Bildgebung auf Nachfrage & interaktiver Checkliste.
                </div>
            </div>
            <button type="button" class="action-btn" id="btn-open-osce-generator" onclick="window.OSCEModule.openModal()" style="background: linear-gradient(135deg, #0284c7, #0d9488); border: none; padding: 11px 18px; font-weight: 800; box-shadow: 0 6px 20px rgba(2, 132, 199, 0.3);">
                🩺 OSCE-Fallgenerator
            </button>
        `;

        if (subtitleEl) {
            subtitleEl.insertAdjacentElement('afterend', launchpad);
        } else {
            forgeView.prepend(launchpad);
        }
    }

    // ======================================================================
    // 06. HEURISTIK: WELCHE IMPORTIERTEN FÄLLE PASSEN ZU WELCHER FACHRICHTUNG?
    // ======================================================================
    function getAllImportedAppCases() {
        if (typeof window.getRegisteredCases === 'function') {
            return window.getRegisteredCases({ ignoreSpecialtyFilter: true });
        }
        return [];
    }

    function doesCaseMatchSpecialty(caseObj, specialtyId) {
        const spec = SPECIALTIES.find(s => s.id === specialtyId);
        if (!spec || !caseObj) return false;

        // Notfall, Innere Medizin, Gesprächsführung & Ultraschall können auf fast jeden klinischen Fall angewendet werden
        const haystack = [
            caseObj.folder_name || '',
            caseObj.metadata?.medical_field || '',
            caseObj.metadata?.title || '',
            caseObj.metadata?.primary_disease || '',
            caseObj.case_overview?.topic || '',
            caseObj.case_overview?.summary || ''
        ].join(' ').toLowerCase();

        return spec.keywords.some(kw => haystack.includes(kw.toLowerCase()));
    }

    function stripHtmlTags(html) {
        if (!html) return '';
        return String(html)
            .replace(/<li[^>]*>/gi, ' • ')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<\/p>/gi, ' ')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ======================================================================
    // 07. DETERMINISTISCHE CASE-TO-OSCE SYNTHESE-ENGINE
    //     Wandelt JEDEN importierten MedCheck-Fall in eine komplette OSCE-Station um!
    // ======================================================================
    function synthesizeOSCEFromMedCheckCase(caseObj, specialtyId, customSetting = 'auto') {
        const specMeta = SPECIALTIES.find(s => s.id === specialtyId) || SPECIALTIES[10];
        const primaryDisease = caseObj.metadata?.primary_disease || caseObj.extra_tasks?.doctordle?.[0]?.target_diagnosis || caseObj.case_overview?.topic || caseObj.metadata?.title || 'Klinisches Syndrom';
        const caseTitle = caseObj.metadata?.title || primaryDisease;

        // 1. Demografie, Alter & Geschlecht aus Timeline oder Doctordle-Hints extrahieren
        const step1Text = caseObj.timeline?.[0]?.content || '';
        const docHint1 = caseObj.extra_tasks?.doctordle?.[0]?.hints?.[0] || '';
        const combinedIntro = `${step1Text} ${docHint1}`;

        const ageMatch = combinedIntro.match(/(\d{2})-jährig(e|er|en)/i);
        const age = ageMatch ? parseInt(ageMatch[1], 10) : 58;
        const isFemale = /patientin|frau|weiblich|(\d{2})-jährige\s+patientin/i.test(combinedIntro);

        const femaleNames = ['Frau Sabine Keller', 'Frau Marianne Brunner', 'Frau Claudia Moser', 'Frau Elena Widmer', 'Frau Ruth Baumann'];
        const maleNames = ['Herr Thomas Schneider', 'Herr Lukas Meier', 'Herr Peter Gerber', 'Herr Martin Frei', 'Herr Daniel Sutter'];
        const nameHash = (caseObj.case_id || '0').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const patientName = isFemale ? femaleNames[nameHash % femaleNames.length] : maleNames[nameHash % maleNames.length];

        // 2. Setting & Rolle bestimmen
        const isAcute = /notfall|akut|perakut|schock|reißend|krampf|ileus|stemi|stroke|lähmung|paraparese/i.test(combinedIntro) || specialtyId === 'Notfall' || specialtyId === 'Chirurgie';
        const effectiveSetting = customSetting !== 'auto'
            ? customSetting
            : (isAcute ? 'Notfallstation' : specMeta.setting);

        const roleText = isAcute
            ? `Sie sind Assistenzärztin / Assistenzarzt auf der ${effectiveSetting} (${specialtyId}).`
            : `Sie sind Unterassistentin / Unterassistent in der ${effectiveSetting} (${specialtyId}).`;

        // 3. Synapsen-Matrix Variablen nach Kategorien auslesen
        const synVars = (caseObj.extra_tasks?.synapses_matrix?.variables || []).filter(v => !v.disease || v.disease === primaryDisease);
        const allSynVars = caseObj.extra_tasks?.synapses_matrix?.variables || [];

        const getSynTerms = (type) => {
            const primaryHits = synVars.filter(v => v.type === type).map(v => v.term);
            if (primaryHits.length > 0) return primaryHits;
            return allSynVars.filter(v => v.type === type).map(v => v.term).slice(0, 3);
        };

        const symptomTerms = getSynTerms('Symptom');
        const riskPathoTerms = getSynTerms('Risikofaktor/Pathophysiologie');
        const diagTerms = getSynTerms('Diagnostik');
        const therapyTerms = getSynTerms('Therapie');

        // 4. Clinical Cascade der Primärerkrankung auslesen
        const cascadeObj = (caseObj.extra_tasks?.clinical_cascades || [])[0];
        const cascadeMap = {};
        (cascadeObj?.cascade || []).forEach(st => {
            cascadeMap[st.stage] = st.content;
        });

        // 5. Doctordle-Hints (Stufe 1 bis 6) für realistische Klinik-, Labor- & Bildgebungsbefunde
        const docPuzzle = (Array.isArray(caseObj.extra_tasks?.doctordle) ? caseObj.extra_tasks.doctordle[0] : caseObj.extra_tasks?.doctordle) || {};
        const hints = (docPuzzle.hints || []).map(h => h.replace(/^Stufe\s*\d+\s*:\s*|^Hinweis\s*\d+\s*:\s*/i, '').trim());

        // 6. Vitalparameter realistisch extrahieren oder passend zur Akuität generieren
        const bpMatch = combinedIntro.match(/(\d{2,3}\/\d{2,3})\s*mmHg/i);
        const hrMatch = combinedIntro.match(/(\d{2,3})\s*\/min/i);
        const tempMatch = combinedIntro.match(/(\d{2}[.,]\d)\s*°C/i);

        const vitals = {
            bp: bpMatch ? `${bpMatch[1]} mmHg` : (isAcute ? '155/92 mmHg' : '128/78 mmHg'),
            hr: hrMatch ? `${hrMatch[1]}/min` : (isAcute ? '98/min, regelmäßig' : '74/min, regelmäßig'),
            rr: isAcute ? '20/min' : '14/min',
            temp: tempMatch ? `${tempMatch[1]} °C` : '36,8 °C',
            spo2: isAcute ? '96 % (Raumluft)' : '98 % (Raumluft)',
            bmi: '24,5 kg/m²'
        };

        // 7. Aufgabenstellung für Türzettel (je nach Fachrichtung angepasst)
        const chiefComplaintSummary = symptomTerms.length > 0
            ? symptomTerms.join(', ')
            : (cascadeMap['05_Klinische Manifestation'] || 'neu aufgetretenen leitsymptomatischen Beschwerden');

        let tasks = [
            'Führen Sie eine strukturierte und gezielte Anamnese der aktuellen Beschwerden durch (inkl. Red Flags).',
            `Führen Sie eine fokussierte klinische Untersuchung (${specialtyId}) durch.`,
            'Erklären Sie der Patientin / dem Patienten am Ende Ihre Verdachtsdiagnose(n) sowie das geplante diagnostische und therapeutische Vorgehen in patientenverständlicher Sprache.'
        ];

        if (specialtyId === 'Gesprächsführung' || specialtyId === 'Palliativ Care') {
            tasks = [
                'Führen Sie ein strukturiertes, empathisches Aufklärungs- bzw. Beratungsgespräch nach dem SPIKES- und NURSE-Protokoll durch.',
                'Explorieren Sie das Vorwissen, die Sorgen und die individuellen Therapieziele der Patientin / des Patienten.',
                'Besprechen Sie die Diagnose und das weitere Vorgehen verständlich, ohne medizinischen Fachjargon.'
            ];
        } else if (specialtyId === 'Nahtkurs') {
            tasks = [
                'Erheben Sie eine kurze fokussierte Unfall- und Wundanamnese (inkl. Tetanus-Status, Allergien, Antikoagulation und DMS-Prüfung).',
                'Erklären Sie das Vorgehen und führen Sie eine fachgerechte Lokalanästhesie sowie Wundversorgung (Einzelknopf- / Donati-Rückstichnaht) am Modell durch.',
                'Instruieren Sie die Patientin / den Patienten bezüglich Wundpflege, Red Flags für Wundinfektionen und Zeitpunkt der Fadenentfernung.'
            ];
        } else if (specialtyId === 'Ultraschall' || specialtyId === 'Radiologie') {
            tasks = [
                'Erheben Sie eine kurze fokussierte Anamnese zur klinischen Fragestellung.',
                'Führen Sie die strukturierte Bildgebungs-Demonstration (Sonographie / Schnittbilddiagnostik) durch und benennen Sie die anatomischen Leitstrukturen sowie Pathologien.',
                'Erläutern Sie der Patientin / dem Patienten den Befund und die daraus folgende klinische Konsequenz.'
            ];
        }

        // 8. Simulationspatienten-Skript (SP-Antworten in direkter Rede!)
        const openingQuote = isAcute
            ? `„Grüezi! Es hat ganz plötzlich angefangen – vor allem macht mir ${chiefComplaintSummary} enorm zu schaffen. Ich habe richtig Angst, dass das etwas Schlimmes ist!“`
            : `„Grüezi! Ich komme zu Ihnen, weil mir seit einiger Zeit ${chiefComplaintSummary} aufgefallen ist und es mich im Alltag zunehmend einschränkt.“`;

        const cornellRows = caseObj.case_overview?.cornell_notes || [];
        const cleanCornellExtracts = cornellRows.map(r => ({
            cue: (r.cues || [])[0] || 'Klinischer Kontext',
            text: stripHtmlTags(r.notes || '')
        }));

        const qaRows = [
            {
                topic: 'Hauptbeschwerde & Leitsymptom',
                answer: `„Im Vordergrund steht für mich: ${chiefComplaintSummary}.${hints[0] ? ' (' + hints[0] + ')' : ''}“`
            },
            {
                topic: 'Beginn, Dauer & zeitlicher Verlauf (Onset / Timing)',
                answer: isAcute
                    ? '„Es hat akut vor wenigen Stunden eingesetzt und hat sich rasch bis zum jetzigen Zustand entwickelt.“'
                    : '„Es hat schleichend vor einigen Wochen/Monaten begonnen und nimmt im Verlauf langsam, aber stetig zu.“'
            },
            {
                topic: 'Charakter & Lokalisation (SOCRATES)',
                answer: `„Es betrifft genau die typische Region (${chiefComplaintSummary}). ${cascadeMap['05_Klinische Manifestation'] ? 'Ich merke vor allem: ' + cascadeMap['05_Klinische Manifestation'] + '.' : 'Es lässt sich kaum ignorieren.'}“`
            },
            {
                topic: 'Auslöser & Risikofaktoren (Vorgeschichte)',
                answer: riskPathoTerms.length > 0
                    ? `„Wenn Sie danach fragen: In meiner Vorgeschichte bzw. als Auslöser gab es tatsächlich Hinweise auf: ${riskPathoTerms.join(', ')}.${cascadeMap['01_Auslöser'] ? ' (' + cascadeMap['01_Auslöser'] + ')' : ''}“`
                    : `„${cascadeMap['01_Auslöser'] || 'Einen eindeutigen äußeren Auslöser habe ich selbst nicht bemerkt.'}“`
            },
            {
                topic: 'Begleitsymptome & Systemüberblick',
                answer: hints[1]
                    ? `„Zusätzlich ist mir aufgefallen: ${hints[1]}“`
                    : '„Ich fühle mich insgesamt abgeschlagen und durch die Beschwerden stark verunsichert. Kein Schüttelfrost.“'
            },
            {
                topic: 'Vorerkrankungen & Voroperationen',
                answer: '„Arterielle Hypertonie (leichtgradig). Keine größeren Bauch- oder Thoraxoperationen in den letzten Jahren, sofern nicht im Befund erwähnt.“'
            },
            {
                topic: 'Medikation & Allergien',
                answer: '„Basismedikation nach Medikamentenplan. Keine bekannten Medikamentenallergien (insb. keine Kontrastmittel- oder Penicillinallergie).“'
            },
            {
                topic: 'Noxen (Rauchen, Alkohol, Substanzen) & Sozialanamnese',
                answer: '„Gelegentlich ein Glas Wein, Nichtraucher/in (bzw. wie im Auslöser-Profil angegeben). Lebt mit Partner/in zusammen, beruflich aktiv.“'
            },
            {
                topic: 'Familienanamnese',
                answer: '„In der Familie sind Herz-Kreislauf-Erkrankungen bekannt, ansonsten keine seltenen Erbkrankheiten.“'
            }
        ];

        // 9. Körperliche Untersuchungsbefunde (kombiniert Fall-Befunde + Fachrichtungs-Standard)
        const physicalExam = buildSpecialtyPhysicalExam(specialtyId, hints, cascadeMap, step1Text, primaryDisease);

        // 10. Realistisches Labor & Bildgebung ("NUR auf Nachfrage")
        const diagnosticsOnDemand = buildRealisticDiagnostics(caseObj, specialtyId, hints, diagTerms, cascadeMap, cleanCornellExtracts);

        // 11. Informationen für Prüfer*innen
        const allDiffs = Array.from(new Set([
            ...(caseObj.extra_tasks?.synapses_matrix?.diseases || []),
            ...(caseObj.extra_tasks?.library_entries || []).slice(0, 6)
        ])).filter(d => d && d.toLowerCase() !== primaryDisease.toLowerCase()).slice(0, 5);

        const examinerInfo = {
            background: `${caseTitle} – Leitdiagnose: ${primaryDisease}. ${caseObj.case_overview?.summary || ''}`,
            goals: `Gezielte Anamnese und klinische Untersuchung im Fachbereich ${specialtyId}, Erkennen der Schlüsselbefunde von „${primaryDisease}“, Abgrenzung der wichtigsten Differenzialdiagnosen sowie Einleiten der Goldstandard-Diagnostik (${diagTerms.join(', ') || cascadeMap['06_Diagnostischer Befund'] || 'Labor & Bildgebung'}) und Therapie.`,
            differentials: allDiffs.length > 0 ? allDiffs : ['Wichtigste Differentialdiagnose des Formenkreises', 'Medikamentös-toxische oder metabolische Genese', 'Vaskuläre / entzündliche Akutpathologie'],
            therapy_plan: `${therapyTerms.length > 0 ? therapyTerms.join(' + ') + '. ' : ''}${cascadeMap['07_Therapeutische Intervention'] || ''}${cascadeMap['08_Outcome'] ? ' (Therapieziel/Outcome: ' + cascadeMap['08_Outcome'] + ')' : ''}` || 'Leitliniengerechte kausale und symptomatische Therapie gemäß Fachgesellschaft.'
        };

        // 12. Strukturierte Bewertungskriterien / Checkliste
        const checklist = buildSpecialtyChecklist(specialtyId, primaryDisease, allDiffs, diagTerms, therapyTerms, cascadeMap);

        return {
            osce_id: `OSCE_${specialtyId.toUpperCase().replace(/[^A-Z]/g, '')}_${caseObj.case_id}`,
            specialty: specialtyId,
            title: `${specialtyId}: ${primaryDisease}`,
            source_case_id: caseObj.case_id,
            source_case_title: caseTitle,
            door_sign: {
                role: roleText,
                vignette: `${isFemale ? 'Eine' : 'Ein'} ${age}-jährige${isFemale ? '' : 'r'} Patient${isFemale ? 'in' : ''}, ${patientName}, stellt sich bei Ihnen mit ${chiefComplaintSummary} vor.`,
                tasks: tasks,
                vitals: vitals
            },
            sp_script: {
                opening_quote: openingQuote,
                qa_rows: qaRows,
                behavior: [
                    isAcute ? 'Sichtlich belastet durch die akute Symptomatik, sucht aktiv Augenkontakt und Hilfe.' : 'Freundlich, kooperativ, berichtet strukturiert auf gezielte offene und geschlossene Fragen.',
                    `Zeigt bei der Untersuchung genau die zu „${primaryDisease}“ passenden Befunde.`,
                    'Fragt am Ende des Gesprächs nach: „Was denken Sie, was ich habe, und was müssen wir jetzt genau machen?“'
                ]
            },
            physical_exam: physicalExam,
            diagnostics_on_demand: diagnosticsOnDemand,
            examiner_info: examinerInfo,
            checklist: checklist
        };
    }

    function buildSpecialtyPhysicalExam(specialtyId, hints, cascadeMap, step1Text, primaryDisease) {
        const caseClinicalManifestation = cascadeMap['05_Klinische Manifestation'] || hints[1] || 'Pathognomonischer Lokalbefund gemäß Krankheitsbild';
        const caseFuncTest = hints[3] || cascadeMap['04_Anatomische Konsequenz'] || 'Spezifischer Provokations-/Funktionstest wegweisend';

        const rows = [
            {
                area: 'Allgemeinzustand & Inspektion',
                finding: `Patient/in wach, orientiert (GCS 15). Klinisches Leitbild: ${caseClinicalManifestation}.`
            }
        ];

        if (specialtyId === 'Neurologie') {
            rows.push(
                { area: 'Hirnnervenstatus (HN II–XII)', finding: 'Pupillen isokor, prompte Lichtreaktion, Augenmotilität frei (sofern nicht Teil des Leitsyndroms), kein Fazialisdefizit.' },
                { area: 'Motorik, Tonus & Reflexstatus (MER)', finding: `Spezifischer Befund: ${caseClinicalManifestation}. (${caseFuncTest}).` },
                { area: 'Sensibilität (Schmerz, Temperatur, Vibration/Lagesinn)', finding: hints[1] || 'Prüfung auf dissoziierte Empfindungsstörung, sensibles Niveau oder strumpfförmige Hypästhesie.' },
                { area: 'Koordination & Stand-/Gangprüfung', finding: 'Finger-Nase-Versuch, Romberg-Stehversuch und Gangbild entsprechend der Läsionshöhe.' }
            );
        } else if (specialtyId === 'Chirurgie' || specialtyId === 'Notfall') {
            rows.push(
                { area: 'Auskultation (Thorax / Abdomen 4 Quadranten)', finding: 'Herz rein, rhythmisch; Lunge vesikulär; Abdomen-Auskultation vor Palpation durchgeführt.' },
                { area: 'Perkussion & Palpation (schmerzfern gestartet)', finding: `${caseClinicalManifestation}. Prüfung auf Druckschmerz, Loslassschmerz und Abwehrspannung.` },
                { area: 'Gefäßstatus / pDMS / DRU', finding: `Periphere Pulse seitengleich tastbar. ${caseFuncTest}.` }
            );
        } else if (specialtyId === 'Orthopädie' || specialtyId === 'Rheumatologie') {
            rows.push(
                { area: 'Inspektion & Palpation (Neutral-Null-Methode)', finding: `Prüfung auf Gelenkerguss, Überwärmung, Druckdolenz über den Leitstrukturen: ${caseClinicalManifestation}.` },
                { area: 'Aktive & passive Beweglichkeit (ROM)', finding: 'Seitenvergleich der Bewegungsausmaße, Endphasenschmerz dokumentiert.' },
                { area: 'Spezifische Stabilitäts- & Provokationstests / pDMS', finding: `${caseFuncTest}. Periphere Durchblutung, Motorik und Sensibilität (pDMS) intakt.` }
            );
        } else if (specialtyId === 'Kardiologie' || specialtyId === 'Pneumologie') {
            rows.push(
                { area: 'Herzauskultation (Erb-Punkt, 2. ICR, Apex)', finding: `${caseClinicalManifestation}. Beurteilung von Herzrhythmus, Herztönen und allfälligen Vitien-Geräuschen.` },
                { area: 'Lungenauskultation & Perkussion', finding: 'Seitenvergleich basal und apikal auf Rasselgeräusche (RG), Giemen, Brummen oder Dämpfung.' },
                { area: 'Volumenstatus (Halsvenen, periphere Ödeme, Rekap-Zeit)', finding: `${caseFuncTest}. Prüfung auf prätibiale Ödeme und Jugularvenenstauung.` }
            );
        } else {
            rows.push(
                { area: `Fokussierte Untersuchung (${specialtyId})`, finding: `${caseClinicalManifestation}` },
                { area: 'Spezifische Funktionsprüfung / Zusatzbefund', finding: `${caseFuncTest}` },
                { area: 'Orientierender internistisch-neurologischer Status', finding: 'Kardiopulmonal kompensiert, periphere Pulse und Schutzreflexe erhalten.' }
            );
        }

        // Falls in Schritt 1 der Timeline ein konkreter Satz zur Untersuchung steht, als Original-Klinikbefund ergänzen
        const cleanStep1 = stripHtmlTags(step1Text).replace(/\[|\]/g, '');
        if (cleanStep1.length > 20) {
            rows.push({
                area: 'Klinischer Originalbefund aus Fall-Akte',
                finding: cleanStep1.slice(0, 320) + (cleanStep1.length > 320 ? '…' : '')
            });
        }

        return rows;
    }

    function buildRealisticDiagnostics(caseObj, specialtyId, hints, diagTerms, cascadeMap, cleanCornellExtracts) {
        const fullCaseText = JSON.stringify(caseObj).toLowerCase();
        const labs = [];

        // Intelligente Labor-Synthese (Schweizer SI-Referenzwerte + fallbezogene Pathologien)
        if (/entzünd|infekt|sepsis|fieber|pleozytose|mening|pneumon|appendiz|ileus|cholezyst|vaskulit/i.test(fullCaseText)) {
            labs.push(
                { param: 'Leukozyten', value: '13.9 G/l', ref: '4.0–10.0 G/l', flag: '↑ (Leukozytose)' },
                { param: 'CRP (C-reaktives Protein)', value: '68 mg/l', ref: '< 5.0 mg/l', flag: '↑ (Systemische Entzündung)' }
            );
        } else {
            labs.push(
                { param: 'Leukozyten', value: '6.8 G/l', ref: '4.0–10.0 G/l', flag: 'Normal' },
                { param: 'CRP (C-reaktives Protein)', value: '2.4 mg/l', ref: '< 5.0 mg/l', flag: 'Normal' }
            );
        }

        if (/anämie|blutung|hämoly|lymphom|leukämie|myelom|hämato|mcv|b12|funikulär/i.test(fullCaseText)) {
            const isMacrocytic = /b12|funikulär|lachgas|mma|folsäure/i.test(fullCaseText);
            labs.push(
                { param: 'Hämoglobin (Hb)', value: '104 g/l', ref: '120–160 g/l', flag: '↓ (Anämie)' },
                { param: 'MCV (Mittleres Erythrozytenvolumen)', value: isMacrocytic ? '108 fl' : '82 fl', ref: '80–98 fl', flag: isMacrocytic ? '↑ (Makrozytär)' : 'Normozytär' },
                { param: 'LDH (Laktatdehydrogenase)', value: '465 U/l', ref: '135–225 U/l', flag: '↑ (Zellumsatz / Hämolyse)' }
            );
        } else {
            labs.push({ param: 'Hämoglobin (Hb)', value: '138 g/l', ref: '120–160 g/l', flag: 'Normal' });
        }

        if (/b12|mma|methylmalon|lachgas|homocystein|polyneuropathie/i.test(fullCaseText)) {
            labs.push(
                { param: 'Methylmalonsäure (MMA im Serum)', value: '1420 nmol/l', ref: '< 270 nmol/l', flag: '↑↑ (Funktioneller B12-Mangel!)' },
                { param: 'Holotranscobalamin (aktives Vit. B12)', value: '24 pmol/l', ref: '> 50 pmol/l', flag: '↓' }
            );
        }

        if (/liquor|pleozytose|okb|oligoklonal|aqp4|nmosd|cjk|14-3-3|tau|demenz/i.test(fullCaseText)) {
            labs.push({
                param: 'Liquor- & Autoantikörper-Diagnostik',
                value: diagTerms.join(', ') || hints[2] || 'Spezifisches Liquorprofil',
                ref: 'Zellzahl < 5/µl, Schrankenfunktion intakt',
                flag: '⚠️ Pathologisch (siehe Fallbefund)'
            });
        }

        if (/kardio|infarkt|stemi|nstemi|troponin|thoraxschmerz|herzinsuffizienz|aortendissektion|d-dimer/i.test(fullCaseText)) {
            labs.push(
                { param: 'hs-Troponin T', value: '58 ng/l', ref: '< 14 ng/l', flag: '↑ (Myokardschaden)' },
                { param: 'D-Dimere', value: '2.4 mg/l', ref: '< 0.5 mg/l', flag: '↑' },
                { param: 'NT-proBNP', value: '1250 pg/ml', ref: '< 125 pg/ml', flag: '↑' }
            );
        }

        // Standard-Elektrolyte & Niere immer ergänzen
        labs.push(
            { param: 'Natrium / Kalium', value: 'Na 139 mmol/l | K 4.1 mmol/l', ref: 'Na 135–145 | K 3.5–5.0 mmol/l', flag: 'Normal' },
            { param: 'Kreatinin / eGFR (CKD-EPI)', value: '76 µmol/l (eGFR > 90 ml/min)', ref: '50–95 µmol/l', flag: 'Normal' }
        );

        // Spezifischen Diagnostik-Befund aus dem Fall als Highlight-Zeile im Labor verankern
        const specificDiagText = cascadeMap['06_Diagnostischer Befund'] || hints[2] || diagTerms.join(', ');
        if (specificDiagText) {
            labs.unshift({
                param: '🎯 Fall-Spezifischer Schlüsselparameter',
                value: specificDiagText,
                ref: 'Goldstandard-Referenz',
                flag: '⚠️ Wegweisender Hauptbefund'
            });
        }

        // Bildgebung & Apparative Diagnostik aus Doctordle Hint 4/5/6 & Cornell Notes
        const imaging = [];
        if (hints[4] || hints[5] || cascadeMap['06_Diagnostischer Befund']) {
            imaging.push({
                modality: `Bildgebung / Apparative Diagnostik (${diagTerms[0] || specialtyId})`,
                finding: [hints[4], hints[5], cascadeMap['06_Diagnostischer Befund']].filter(Boolean).join(' — ')
            });
        }

        if (cleanCornellExtracts.length > 0) {
            imaging.push({
                modality: `Spezifische Befundkonstellation (${cleanCornellExtracts[0].cue})`,
                finding: cleanCornellExtracts[0].text.slice(0, 360)
            });
        }

        if (imaging.length === 0) {
            imaging.push({
                modality: 'Apparative Basisdiagnostik (Sonographie / Röntgen / Schnittbild)',
                finding: `Befund korreliert mit der Leitdiagnose „${caseObj.metadata?.primary_disease || caseObj.metadata?.title}“.`
            });
        }

        return {
            lab_note: 'NUR auf gezielte Anforderung der Kandidatin / des Kandidaten herausgeben:',
            labs: labs,
            imaging: imaging
        };
    }

    function buildSpecialtyChecklist(specialtyId, primaryDisease, differentials, diagTerms, therapyTerms, cascadeMap) {
        const diffString = differentials.length > 0 ? differentials.slice(0, 3).join(', ') : 'wichtigste Differenzialdiagnosen';
        const diagString = diagTerms.length > 0 ? diagTerms.join(', ') : (cascadeMap['06_Diagnostischer Befund'] || 'Labor & gezielte Bildgebung');
        const therString = therapyTerms.length > 0 ? therapyTerms.join(', ') : (cascadeMap['07_Therapeutische Intervention'] || 'leitliniengerechte Akut- und Basistherapie');

        return [
            { category: 'Anamnese', item: 'Begrüßung, Vorstellung mit Name und Funktion, Schaffen einer angenehmen Gesprächsatmosphäre', points: 1 },
            { category: 'Anamnese', item: 'Erfragt Leitsymptom offen und exploriert systematisch alle Dimensionen (SOCRATES: Beginn, Verlauf, Charakter, Auslöser, Red Flags)', points: 2 },
            { category: 'Anamnese', item: 'Erfragt gezielt relevante Begleitsymptome sowie funktionelle Auswirkungen im Alltag / Schlaf', points: 2 },
            { category: 'Anamnese', item: 'Erhebt vollständige persönliche Anamnese (Vorerkrankungen, Vor-OPs, Medikamente, Allergien, Noxen, Familien- & Sozialanamnese)', points: 2 },
            { category: 'Klinische Untersuchung', item: 'Führt Händedesinfektion vor und nach der körperlichen Untersuchung durch und holt Einverständnis ein', points: 1 },
            { category: 'Klinische Untersuchung', item: `Führt strukturierte, auf ${specialtyId} fokussierte Untersuchung durch (Inspektion, Palpation/Auskultation, spezifische Funktionstests)`, points: 3 },
            { category: 'Verdachtsdiagnose & Procedere', item: `Benennt korrekt die Verdachtsdiagnose: „${primaryDisease}“`, points: 2 },
            { category: 'Verdachtsdiagnose & Procedere', item: `Nennt relevante Differenzialdiagnosen (${diffString}) und begründet die Abgrenzung`, points: 2 },
            { category: 'Verdachtsdiagnose & Procedere', item: `Schlägt zielgerichtete Diagnostik vor (${diagString})`, points: 2 },
            { category: 'Verdachtsdiagnose & Procedere', item: `Schlägt das korrekte therapeutische Vorgehen vor (${therString})`, points: 2 },
            { category: 'Kommunikation', item: 'Kommuniziert empathisch, strukturiert und erklärt Verdachtsdiagnose sowie Procedere in patientenverständlicher Sprache ohne Fachjargon', points: 2 },
            { category: 'Kommunikation', item: 'Fasst Ergebnisse klar zusammen, gibt Raum für Rückfragen und verabschiedet sich professionell', points: 1 }
        ];
    }

    // ======================================================================
    // 08. MODAL DOM ERSTELLEN & RENDERN
    // ======================================================================
    function ensureModalDOM() {
        injectOSCEStyles();
        let modal = document.getElementById('osce-generator-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'osce-generator-modal';
        modal.className = 'osce-modal-backdrop hidden';
        modal.innerHTML = `
            <div class="osce-modal-window" role="dialog" aria-modal="true" aria-label="OSCE-Fallgenerator">
                <!-- Header -->
                <div class="osce-modal-header">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, #0284c7, #0d9488); display:flex; align-items:center; justify-content:center; font-size:1.25rem; box-shadow:0 4px 14px rgba(2,132,199,0.35);">
                            🩺
                        </div>
                        <div>
                            <div style="font-size:0.7rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent-cyan, #38bdf8);">
                                MEDCHECK CLINICAL SKILLS LAB · STAATSEXAMEN & OSCE-TRAINING
                            </div>
                            <h2 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-main);">
                                Interaktiver OSCE-Fallgenerator
                            </h2>
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.OSCEModule.generateWithGeminiAI(this)" title="Lässt Gemini den aktuellen Fall noch tiefer ausformulieren">
                            ✨ KI-Feinschliff (Gemini)
                        </button>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.OSCEModule.copyOSCEPrompt(this)" title="OSCE-Masterprompt für externe KI kopieren">
                            📋 OSCE-Prompt kopieren
                        </button>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.OSCEModule.printStation()" title="Als A4-Postenblätter (Türzettel, SP, Prüfer) drucken / PDF">
                            🖨️ Drucken / PDF
                        </button>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.OSCEModule.closeModal()" style="padding:6px 12px; font-weight:800;">
                            ✕ Schließen
                        </button>
                    </div>
                </div>

                <!-- Body: Links Konfiguration (21 Fachrichtungen + Quell-Fall), Rechts Station -->
                <div class="osce-modal-body">
                    <aside class="osce-config-sidebar">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <label style="font-size:0.74rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent-cyan, #38bdf8);">
                                    1. Fachrichtung wählen (21)
                                </label>
                                <span id="osce-active-spec-badge" style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">Innere Medizin</span>
                            </div>
                            <div class="osce-specialty-grid" id="osce-specialty-grid"></div>
                        </div>

                        <div>
                            <label for="osce-source-case-select" style="display:block; font-size:0.74rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent-cyan, #38bdf8); margin-bottom:6px;">
                                2. Importierter Fall / Vorlage
                            </label>
                            <select id="osce-source-case-select" class="forge-topic-input" style="min-height:auto; padding:9px 12px; font-size:0.8rem; width:100%;" onchange="window.OSCEModule.onSourceCaseChange(this.value)"></select>
                        </div>

                        <div>
                            <label for="osce-setting-select" style="display:block; font-size:0.74rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px;">
                                3. Klinisches Setting
                            </label>
                            <select id="osce-setting-select" class="forge-topic-input" style="min-height:auto; padding:8px 12px; font-size:0.78rem; width:100%;" onchange="window.OSCEModule.onSettingChange(this.value)">
                                <option value="auto">🔄 Automatisch (passend zu Fach & Akuität)</option>
                                <option value="allgemeinmedizinischen Praxis">🏥 Hausarztpraxis / Allgemeinmedizin</option>
                                <option value="interdisziplinären Notfallstation">🚨 Interdisziplinäre Notfallstation</option>
                                <option value="Spezialambulanz / Poliklinik">🩺 Spezialambulanz / Poliklinik</option>
                                <option value="Bettenstation (Stationsvisite)">🛏️ Bettenstation (Visite)</option>
                            </select>
                        </div>

                        <div style="display:flex; gap:6px; margin-top:2px;">
                            <button type="button" class="action-btn" style="flex:1; padding:10px; font-size:0.82rem;" onclick="window.OSCEModule.generateStation()">
                                🔄 OSCE-Fall generieren
                            </button>
                            <button type="button" class="action-btn secondary" style="padding:10px 12px; font-size:0.82rem;" onclick="window.OSCEModule.pickRandomCaseForSpecialty()" title="Zufälligen passenden Fall aus der App ziehen">
                                🎲
                            </button>
                        </div>

                        <div style="margin-top:auto; padding-top:12px; border-top:1px solid var(--card-border); font-size:0.73rem; color:var(--text-muted); line-height:1.45;">
                            💡 <strong>Tipp fürs Üben zu zweit:</strong> Nutzt oben die Rollen-Tabs <em>„🚪 Kandidat*in“</em>, <em>„🎭 SP-Skript“</em> und <em>„📋 Prüfer*in“</em>, um den Fall ohne Spoiler durchzuspielen!
                        </div>
                    </aside>

                    <main class="osce-station-viewport" id="osce-station-viewport"></main>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        return modal;
    }

    function renderSpecialtyButtons() {
        const grid = document.getElementById('osce-specialty-grid');
        const badge = document.getElementById('osce-active-spec-badge');
        if (!grid) return;

        const allCases = getAllImportedAppCases();

        grid.innerHTML = SPECIALTIES.map(spec => {
            const matchCount = allCases.filter(c => doesCaseMatchSpecialty(c, spec.id)).length;
            const isActive = spec.id === selectedSpecialty;
            return `
                <button type="button" class="osce-spec-btn ${isActive ? 'active' : ''}" onclick="window.OSCEModule.selectSpecialty('${spec.id.replace(/'/g, "\\'")}')">
                    <span>${spec.icon}</span>
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${spec.label}</span>
                    ${matchCount > 0 ? `<span class="osce-spec-count" title="${matchCount} direkt passende Fälle importiert">${matchCount}</span>` : ''}
                </button>
            `;
        }).join('');

        if (badge) badge.textContent = selectedSpecialty;
    }

    function populateSourceCaseDropdown() {
        const select = document.getElementById('osce-source-case-select');
        if (!select) return;

        const allCases = getAllImportedAppCases();
        const matchingCases = allCases.filter(c => doesCaseMatchSpecialty(c, selectedSpecialty));
        const otherCases = allCases.filter(c => !doesCaseMatchSpecialty(c, selectedSpecialty));

        let html = `
            <optgroup label="⭐ Original OSCE-Referenzvorlagen">
                <option value="PRESET_RLS_KELLER" ${selectedSourceCaseId === 'PRESET_RLS_KELLER' ? 'selected' : ''}>🩺 RLS – Frau Sabine Keller (54 J., Kribbeln in den Beinen)</option>
                <option value="PRESET_ILEUS_SCHNEIDER" ${selectedSourceCaseId === 'PRESET_ILEUS_SCHNEIDER' ? 'selected' : ''}>🔪 Mechanischer Ileus – Herr Schneider (62 J., Akutes Abdomen)</option>
            </optgroup>
        `;

        if (matchingCases.length > 0) {
            html += `<optgroup label="🎯 Passende importierte Fälle (${selectedSpecialty}: ${matchingCases.length})">`;
            matchingCases.forEach(c => {
                const label = `${c.metadata?.primary_disease ? c.metadata.primary_disease + ' – ' : ''}${c.metadata?.title || c.case_id}`;
                html += `<option value="${c.case_id}" ${selectedSourceCaseId === c.case_id ? 'selected' : ''}>${ label.slice(0, 75) }</option>`;
            });
            html += `</optgroup>`;
        }

        if (otherCases.length > 0) {
            html += `<optgroup label="📚 Weitere importierte Fälle in deiner App (${otherCases.length})">`;
            otherCases.forEach(c => {
                const folder = c.folder_name || c.metadata?.medical_field || 'Allgemein';
                const label = `[${folder.slice(0, 18)}] ${c.metadata?.title || c.case_id}`;
                html += `<option value="${c.case_id}" ${selectedSourceCaseId === c.case_id ? 'selected' : ''}>${ label.slice(0, 75) }</option>`;
            });
            html += `</optgroup>`;
        }

        select.innerHTML = html;

        // Sinnvollen Default wählen, falls __AUTO__ aktiv ist
        if (selectedSourceCaseId === '__AUTO__') {
            if (selectedSpecialty === 'Chirurgie') {
                selectedSourceCaseId = 'PRESET_ILEUS_SCHNEIDER';
            } else if (matchingCases.length > 0) {
                selectedSourceCaseId = matchingCases[0].case_id;
            } else {
                selectedSourceCaseId = 'PRESET_RLS_KELLER';
            }
            select.value = selectedSourceCaseId;
        }
    }

    // ======================================================================
    // 09. HAUPT-RENDERER FÜR DIE AKTIVE OSCE-STATION
    // ======================================================================
    function renderActiveStation() {
        const viewport = document.getElementById('osce-station-viewport');
        if (!viewport || !currentOSCEData) return;

        const d = currentOSCEData;
        const totalPoints = (d.checklist || []).reduce((acc, item) => acc + (item.points || 1), 0);
        const earnedPoints = (d.checklist || []).reduce((acc, item, idx) => acc + (checkedCriteria[idx] ? (item.points || 1) : 0), 0);
        const scorePct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

        const showCandidate = activeRoleMode === 'all' || activeRoleMode === 'candidate';
        const showSP = activeRoleMode === 'all' || activeRoleMode === 'sp';
        const showExaminer = activeRoleMode === 'all' || activeRoleMode === 'examiner';

        const filteredQaRows = (d.sp_script?.qa_rows || []).filter(row => {
            if (!spSearchFilter) return true;
            return (row.topic + ' ' + row.answer).toLowerCase().includes(spSearchFilter);
        });

        // Checkliste nach Kategorien gruppieren
        const groupedChecklist = {};
        (d.checklist || []).forEach((item, idx) => {
            const cat = item.category || 'Allgemein';
            if (!groupedChecklist[cat]) groupedChecklist[cat] = [];
            groupedChecklist[cat].push({ ...item, idx });
        });

        viewport.innerHTML = `
            <!-- Sticky Role & Timer Bar -->
            <div class="osce-role-bar">
                <div class="osce-role-tabs">
                    <button type="button" class="osce-role-tab ${activeRoleMode === 'all' ? 'active' : ''}" onclick="window.OSCEModule.setRoleMode('all')">
                        👁️ Gesamtansicht
                    </button>
                    <button type="button" class="osce-role-tab ${activeRoleMode === 'candidate' ? 'active' : ''}" onclick="window.OSCEModule.setRoleMode('candidate')">
                        🚪 Kandidat*in (Türzettel)
                    </button>
                    <button type="button" class="osce-role-tab ${activeRoleMode === 'sp' ? 'active' : ''}" onclick="window.OSCEModule.setRoleMode('sp')">
                        🎭 Simulationspatient*in (SP)
                    </button>
                    <button type="button" class="osce-role-tab ${activeRoleMode === 'examiner' ? 'active' : ''}" onclick="window.OSCEModule.setRoleMode('examiner')">
                        📋 Prüfer*in & Checkliste (${scorePct}%)
                    </button>
                </div>

                <!-- Live OSCE Prüfungs-Timer -->
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="osce-timer-pill ${timerRemainingSec <= 120 && timerRemainingSec > 0 ? 'warning' : ''}" id="osce-timer-display" title="Bei ≤ 2:00 Min. leuchtet der Timer gelb (Zusammenfassung & Procedere!)">
                        <span>⏱️</span>
                        <span id="osce-timer-text">${formatTime(timerRemainingSec)}</span>
                    </div>
                    <button type="button" class="action-btn secondary btn-sm" style="padding:5px 10px; font-size:0.74rem;" onclick="window.OSCEModule.toggleTimer()">
                        ${isTimerRunning ? '⏸ Pause' : '▶ Start'}
                    </button>
                    <select class="forge-topic-input" style="min-height:auto; padding:4px 8px; font-size:0.72rem; width:auto;" onchange="window.OSCEModule.setTimerDuration(this.value)">
                        <option value="480" ${timerTotalSec === 480 ? 'selected' : ''}>8 Min.</option>
                        <option value="600" ${timerTotalSec === 600 ? 'selected' : ''}>10 Min.</option>
                        <option value="720" ${timerTotalSec === 720 ? 'selected' : ''}>12 Min.</option>
                    </select>
                </div>
            </div>

            <!-- Station Header Banner -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; padding:4px 2px;">
                <div>
                    <span style="font-size:0.72rem; font-weight:800; padding:3px 10px; border-radius:999px; background:rgba(2,132,199,0.2); color:var(--accent-cyan, #38bdf8); border:1px solid rgba(56,189,248,0.35);">
                        OSCE-STATION · ${d.specialty.toUpperCase()}
                    </span>
                    <h3 style="margin:8px 0 2px 0; font-size:1.25rem; font-weight:800; color:var(--text-main);">
                        ${activeRoleMode === 'candidate' ? `OSCE-Posten ${d.specialty} (Prüfungs-Modus – Diagnose verdeckt)` : d.title}
                    </h3>
                    <div style="font-size:0.78rem; color:var(--text-muted);">
                        Quell-Datensatz: <strong>${d.source_case_title || d.osce_id}</strong>
                    </div>
                </div>
            </div>

            <!-- 1. AUFGABENSTELLUNG & VITALPARAMETER (TÜRZETTEL) -->
            ${showCandidate ? `
                <section class="osce-section-card">
                    <div class="osce-section-header">
                        <div class="osce-section-title">🩺 Aufgabenstellung (Fallbeschrieb an der Tür)</div>
                        <span style="font-size:0.72rem; color:var(--text-muted); font-weight:700;">Kandidaten-Instruktion</span>
                    </div>
                    <p style="margin:0 0 8px 0; font-weight:700; color:var(--accent-cyan, #38bdf8); font-size:0.92rem;">
                        ${d.door_sign.role}
                    </p>
                    <p style="margin:0 0 14px 0; font-size:0.94rem; line-height:1.55; color:var(--text-main);">
                        ${d.door_sign.vignette}
                    </p>
                    <div style="font-weight:800; font-size:0.84rem; margin-bottom:6px; color:var(--text-main);">Ihre Aufgaben:</div>
                    <ul style="margin:0 0 16px 0; padding-left:20px; font-size:0.88rem; line-height:1.6; color:var(--text-main);">
                        ${(d.door_sign.tasks || []).map(t => `<li>${t}</li>`).join('')}
                    </ul>

                    <div style="font-weight:800; font-size:0.82rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">
                        Vitalparameter:
                    </div>
                    <div class="osce-vitals-grid">
                        <div class="osce-vital-box"><div class="osce-vital-label">Blutdruck</div><div class="osce-vital-val">${d.door_sign.vitals.bp}</div></div>
                        <div class="osce-vital-box"><div class="osce-vital-label">Puls / HF</div><div class="osce-vital-val">${d.door_sign.vitals.hr}</div></div>
                        <div class="osce-vital-box"><div class="osce-vital-label">Atemfrequenz</div><div class="osce-vital-val">${d.door_sign.vitals.rr}</div></div>
                        <div class="osce-vital-box"><div class="osce-vital-label">Temperatur</div><div class="osce-vital-val">${d.door_sign.vitals.temp}</div></div>
                        <div class="osce-vital-box"><div class="osce-vital-label">SpO₂</div><div class="osce-vital-val">${d.door_sign.vitals.spo2}</div></div>
                        <div class="osce-vital-box"><div class="osce-vital-label">BMI</div><div class="osce-vital-val">${d.door_sign.vitals.bmi}</div></div>
                    </div>
                </section>
            ` : ''}

            <!-- 2. INFORMATIONEN FÜR SIMULATIONSPATIENT*IN (SP-SKRIPT) -->
            ${showSP ? `
                <section class="osce-section-card">
                    <div class="osce-section-header">
                        <div class="osce-section-title">👩‍⚕️ Informationen für die/den Simulationspatientin/-patienten (SP)</div>
                        <input type="text" class="forge-topic-input" style="min-height:auto; padding:5px 10px; font-size:0.76rem; width:210px;" placeholder="🔍 Fragebereich filtern..." value="${spSearchFilter}" oninput="window.OSCEModule.filterSpTable(this.value)">
                    </div>

                    <div class="osce-sp-quote">
                        🗣️ Einstiegssatz: ${d.sp_script.opening_quote}
                    </div>

                    <div style="font-weight:800; font-size:0.84rem; margin-bottom:8px; color:var(--text-main);">
                        Anamnestische Angaben (nur auf entsprechende Frage der Kandidat*innen nennen):
                    </div>
                    <div style="overflow-x:auto; border:1px solid var(--card-border); border-radius:10px; margin-bottom:14px;">
                        <table class="osce-table">
                            <thead>
                                <tr>
                                    <th>Fragebereich</th>
                                    <th>Antwort (durch Simulationspatient*in)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredQaRows.map(r => `
                                    <tr>
                                        <td>${r.topic}</td>
                                        <td>${r.answer}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div style="font-weight:800; font-size:0.84rem; margin-bottom:6px; color:var(--text-main);">
                        Verhalten und Erscheinung:
                    </div>
                    <ul style="margin:0; padding-left:20px; font-size:0.85rem; line-height:1.55; color:var(--text-muted);">
                        ${(d.sp_script.behavior || []).map(b => `<li>${b}</li>`).join('')}
                    </ul>
                </section>
            ` : ''}

            <!-- 3. BEFUNDE BEI KÖRPERLICHER UNTERSUCHUNG -->
            ${(showExaminer || (showCandidate && revealedSections.exam)) ? `
                <section class="osce-section-card">
                    <div class="osce-section-header">
                        <div class="osce-section-title">🔍 Befunde bei körperlicher Untersuchung</div>
                        ${showExaminer ? `
                            <button type="button" class="action-btn secondary btn-sm" style="padding:4px 10px; font-size:0.72rem;" onclick="window.OSCEModule.toggleSectionReveal('exam')">
                                ${revealedSections.exam ? '✓ Für Kandidat*in sichtbar' : '👁️ Auf Kandidaten-Ansicht freigeben'}
                            </button>
                        ` : ''}
                    </div>
                    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:10px;">
                        Werden den Studierenden mitgeteilt, sobald der jeweilige Untersuchungsschritt korrekt durchgeführt / angesagt wird:
                    </div>
                    <div style="overflow-x:auto; border:1px solid var(--card-border); border-radius:10px;">
                        <table class="osce-table">
                            <thead>
                                <tr>
                                    <th>Untersuchung</th>
                                    <th>Befund</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(d.physical_exam || []).map(r => `
                                    <tr>
                                        <td>${r.area}</td>
                                        <td>${r.finding}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            ` : ''}

            <!-- 4. LABOR & BILDGEBUNG (NUR AUF NACHFRAGE!) -->
            <section class="osce-section-card">
                <div class="osce-section-header">
                    <div class="osce-section-title">🔬 LABOR & 🩻 BILDGEBUNG (NUR bei gezielter Nachfrage)</div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="action-btn secondary btn-sm" style="padding:5px 11px; font-size:0.74rem;" onclick="window.OSCEModule.toggleSectionReveal('labs')">
                            ${revealedSections.labs ? '🙈 Labor verbergen' : '🔬 Laborbefunde aufdecken'}
                        </button>
                        <button type="button" class="action-btn secondary btn-sm" style="padding:5px 11px; font-size:0.74rem;" onclick="window.OSCEModule.toggleSectionReveal('imaging')">
                            ${revealedSections.imaging ? '🙈 Bildgebung verbergen' : '🩻 Bildgebung aufdecken'}
                        </button>
                    </div>
                </div>

                ${!revealedSections.labs && !revealedSections.imaging ? `
                    <div style="padding:14px; border-radius:10px; border:1px dashed var(--card-border); text-align:center; font-size:0.82rem; color:var(--text-muted);">
                        🔒 <strong>Spoiler-Schutz aktiv:</strong> Klicke oben auf <em>„🔬 Laborbefunde aufdecken“</em> oder <em>„🩻 Bildgebung aufdecken“</em>, sobald die Kandidatin / der Kandidat diese Diagnostik im Prüfungsgespräch konkret anfordert.
                    </div>
                ` : ''}

                ${revealedSections.labs ? `
                    <div style="margin-bottom:14px;">
                        <div style="font-size:0.78rem; font-weight:700; color:var(--accent-cyan, #38bdf8); margin-bottom:8px;">
                            ${d.diagnostics_on_demand.lab_note}
                        </div>
                        <div style="overflow-x:auto; border:1px solid var(--card-border); border-radius:10px;">
                            <table class="osce-table">
                                <thead>
                                    <tr>
                                        <th>Parameter</th>
                                        <th>Resultat</th>
                                        <th>Referenzbereich (SI)</th>
                                        <th>Interpretation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(d.diagnostics_on_demand.labs || []).map(l => {
                                        const isPatho = l.flag && !l.flag.toLowerCase().startsWith('normal');
                                        return `
                                            <tr>
                                                <td>${l.param}</td>
                                                <td style="font-family:'JetBrains Mono',monospace; font-weight:800; color:${isPatho ? '#fca5a5' : 'var(--text-main)'};">${l.value}</td>
                                                <td style="font-family:'JetBrains Mono',monospace; font-size:0.76rem; color:var(--text-muted);">${l.ref}</td>
                                                <td style="font-weight:700; color:${isPatho ? '#fcd34d' : '#6ee7b7'};">${l.flag}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}

                ${revealedSections.imaging ? `
                    <div>
                        <div style="font-size:0.78rem; font-weight:700; color:var(--accent-cyan, #38bdf8); margin-bottom:8px;">
                            🩻 Apparative Diagnostik & Bildgebungsbefunde:
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${(d.diagnostics_on_demand.imaging || []).map(img => `
                                <div style="padding:12px 14px; border-radius:10px; background:var(--surface-primary); border:1px solid var(--card-border); font-size:0.85rem; line-height:1.5;">
                                    <div style="font-weight:800; color:var(--accent-cyan, #38bdf8); margin-bottom:4px;">${img.modality}</div>
                                    <div>${img.finding}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </section>

            <!-- 5. INFORMATIONEN FÜR PRÜFER*INNEN -->
            ${showExaminer ? `
                <section class="osce-section-card">
                    <div class="osce-section-header">
                        <div class="osce-section-title">📚 Informationen für Prüfer*innen</div>
                        <span style="font-size:0.72rem; color:var(--text-muted); font-weight:700;">Erwartungshorizont</span>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; font-size:0.85rem; line-height:1.55;">
                        <div style="padding:12px 14px; border-radius:10px; background:var(--surface-primary); border:1px solid var(--card-border);">
                            <div style="font-weight:800; color:var(--accent-cyan, #38bdf8); margin-bottom:4px;">Hintergrund des Falls</div>
                            <div>${d.examiner_info.background}</div>
                        </div>
                        <div style="padding:12px 14px; border-radius:10px; background:var(--surface-primary); border:1px solid var(--card-border);">
                            <div style="font-weight:800; color:var(--accent-cyan, #38bdf8); margin-bottom:4px;">Wichtige klinische Ziele</div>
                            <div>${d.examiner_info.goals}</div>
                        </div>
                        <div style="padding:12px 14px; border-radius:10px; background:var(--surface-primary); border:1px solid var(--card-border);">
                            <div style="font-weight:800; color:var(--accent-cyan, #38bdf8); margin-bottom:4px;">Differenzialdiagnosen (DDx)</div>
                            <ul style="margin:0; padding-left:18px;">
                                ${(d.examiner_info.differentials || []).map(dd => `<li>${dd}</li>`).join('')}
                            </ul>
                        </div>
                        <div style="padding:12px 14px; border-radius:10px; background:var(--surface-primary); border:1px solid var(--card-border);">
                            <div style="font-weight:800; color:var(--accent-cyan, #38bdf8); margin-bottom:4px;">Therapie & Management-Plan</div>
                            <div>${d.examiner_info.therapy_plan}</div>
                        </div>
                    </div>
                </section>

                <!-- 6. INTERAKTIVE BEWERTUNGSKRITERIEN / CHECKLISTE -->
                <section class="osce-section-card">
                    <div class="osce-section-header">
                        <div class="osce-section-title">✅ Bewertungskriterien / Interaktive Checkliste</div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-family:'JetBrains Mono',monospace; font-size:0.85rem; font-weight:800; color:${scorePct >= 60 ? '#10b981' : '#f59e0b'};">
                                Score: ${earnedPoints} / ${totalPoints} Pkt. (${scorePct}%)
                            </span>
                            <button type="button" class="action-btn secondary btn-sm" style="padding:4px 10px; font-size:0.72rem;" onclick="window.OSCEModule.resetChecklist()">
                                ↺ Reset
                            </button>
                        </div>
                    </div>

                    ${Object.entries(groupedChecklist).map(([catName, items]) => `
                        <div style="margin-bottom:14px;">
                            <div style="font-size:0.76rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent-cyan, #38bdf8); margin-bottom:6px;">
                                ${catName}
                            </div>
                            ${items.map(it => {
                                const isChecked = !!checkedCriteria[it.idx];
                                return `
                                    <div class="osce-checklist-row ${isChecked ? 'is-checked' : ''}" onclick="window.OSCEModule.toggleChecklistItem(${it.idx})">
                                        <div style="display:flex; align-items:flex-start; gap:10px;">
                                            <div class="osce-checkbox-box">${isChecked ? '✓' : ''}</div>
                                            <div style="font-size:0.85rem; line-height:1.45; font-weight:${isChecked ? '700' : '500'};">
                                                ${it.item}
                                            </div>
                                        </div>
                                        <span style="font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:var(--text-muted); white-space:nowrap;">
                                            ${it.points || 1} Pkt.
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `).join('')}
                </section>
            ` : ''}
        `;
    }

    // ======================================================================
    // 10. INTERAKTIONS-HANDLER, TIMER, KI-FEINSCHLIFF & DRUCK-EXPORT
    // ======================================================================
    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function toggleTimer() {
        if (isTimerRunning) {
            clearInterval(timerInterval);
            isTimerRunning = false;
        } else {
            isTimerRunning = true;
            timerInterval = setInterval(() => {
                if (timerRemainingSec > 0) {
                    timerRemainingSec--;
                    const textEl = document.getElementById('osce-timer-text');
                    const pillEl = document.getElementById('osce-timer-display');
                    if (textEl) textEl.textContent = formatTime(timerRemainingSec);
                    if (pillEl) {
                        pillEl.classList.toggle('warning', timerRemainingSec <= 120 && timerRemainingSec > 0);
                    }
                    if (timerRemainingSec === 120 && typeof window.triggerHaptic === 'function') {
                        window.triggerHaptic([30, 60, 30]);
                    }
                } else {
                    clearInterval(timerInterval);
                    isTimerRunning = false;
                    renderActiveStation();
                }
            }, 1000);
        }
        renderActiveStation();
    }

    function setTimerDuration(seconds) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        timerTotalSec = parseInt(seconds, 10) || 480;
        timerRemainingSec = timerTotalSec;
        renderActiveStation();
    }

    function selectSpecialty(specId) {
        selectedSpecialty = specId;
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);

        // Automatisch passenden Fall für diese Fachrichtung vorselektieren
        const allCases = getAllImportedAppCases();
        const matching = allCases.filter(c => doesCaseMatchSpecialty(c, specId));
        if (specId === 'Chirurgie' && matching.length === 0) {
            selectedSourceCaseId = 'PRESET_ILEUS_SCHNEIDER';
        } else if (matching.length > 0) {
            selectedSourceCaseId = matching[0].case_id;
        }

        renderSpecialtyButtons();
        populateSourceCaseDropdown();
        generateStation();
    }

    function onSourceCaseChange(caseId) {
        selectedSourceCaseId = caseId;
        generateStation();
    }

    function onSettingChange(settingVal) {
        selectedSetting = settingVal;
        generateStation();
    }

    function pickRandomCaseForSpecialty() {
        const allCases = getAllImportedAppCases();
        const matching = allCases.filter(c => doesCaseMatchSpecialty(c, selectedSpecialty));
        const pool = matching.length > 0 ? matching : allCases;
        if (pool.length === 0) return;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        selectedSourceCaseId = chosen.case_id;
        populateSourceCaseDropdown();
        generateStation();
    }

    function generateStation() {
        checkedCriteria = {};
        revealedSections = { exam: false, labs: false, imaging: false };

        if (BUILTIN_OSCE_PRESETS[selectedSourceCaseId]) {
            // Kopie des Presets laden und ggf. gewählte Fachrichtung übernehmen
            currentOSCEData = JSON.parse(JSON.stringify(BUILTIN_OSCE_PRESETS[selectedSourceCaseId]));
            renderActiveStation();
            return;
        }

        const allCases = getAllImportedAppCases();
        const targetCase = allCases.find(c => c.case_id === selectedSourceCaseId) || allCases[0];
        if (!targetCase) {
            currentOSCEData = JSON.parse(JSON.stringify(BUILTIN_OSCE_PRESETS['PRESET_RLS_KELLER']));
        } else {
            currentOSCEData = synthesizeOSCEFromMedCheckCase(targetCase, selectedSpecialty, selectedSetting);
        }

        renderActiveStation();
    }

    // Optionaler KI-Feinschliff über deinen /api/gemini Endpunkt
    async function generateWithGeminiAI(btnEl) {
        if (!currentOSCEData) return;
        const origHtml = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '⏳ Gemini generiert...';
        }

        try {
            const allCases = getAllImportedAppCases();
            const sourceCase = allCases.find(c => c.case_id === selectedSourceCaseId);
            const caseContext = sourceCase
                ? JSON.stringify({
                    title: sourceCase.metadata?.title,
                    primary_disease: sourceCase.metadata?.primary_disease,
                    summary: sourceCase.case_overview?.summary,
                    cornell_notes: sourceCase.case_overview?.cornell_notes,
                    doctordle: sourceCase.extra_tasks?.doctordle?.[0],
                    synapses: sourceCase.extra_tasks?.synapses_matrix?.variables
                })
                : JSON.stringify(currentOSCEData);

            const prompt = buildOSCEMasterPrompt(selectedSpecialty, caseContext);

            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, mode: 'osce_vignette' })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const rawText = (data.generatedText || data.result || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsed = JSON.parse(rawText);

            if (parsed && parsed.door_sign && parsed.sp_script) {
                currentOSCEData = parsed;
                checkedCriteria = {};
                renderActiveStation();
            }
        } catch (err) {
            console.warn('[OSCE-KI] Fallback auf lokalen Synthesizer aktiv:', err);
            alert('Lokale OSCE-Synthese ist bereits aktiv. (Tipp: Für externe KI kannst du auch auf „📋 OSCE-Prompt kopieren“ klicken.)');
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origHtml;
            }
        }
    }

    function buildOSCEMasterPrompt(specialty, caseContextJson) {
        return `Du bist klinischer OSCE-Prüfungsexperte (Staatsexamen Medizin Schweiz). Erstelle aus den folgenden medizinischen Falldaten eine hochrealistische OSCE-Prüfungsstation für die Fachrichtung "${specialty}" als reines, valides JSON-Objekt (ohne Markdown-Codeblöcke).
Nutze Schweizer Referenzwerte (SI-Einheiten), wörtliche Patienten-Zitate im SP-Skript (inkl. SOCRATES), realistische Untersuchungsbefunde, Labor/Bildgebung "NUR auf Nachfrage" und eine detaillierte Checkliste.

FALLDATEN:
${caseContextJson}

JSON-SCHEMA:
{
  "osce_id": "STRING",
  "specialty": "${specialty}",
  "title": "STRING",
  "source_case_title": "STRING",
  "door_sign": {
    "role": "Sie sind Unterassistent/in bzw. Assistenzarzt/ärztin...",
    "vignette": "Patientenname, Alter, Leitsymptom...",
    "tasks": ["Aufgabe 1", "Aufgabe 2", "Aufgabe 3"],
    "vitals": { "bp": "125/75 mmHg", "hr": "72/min", "rr": "14/min", "temp": "36,7 °C", "spo2": "98 %", "bmi": "24 kg/m²" }
  },
  "sp_script": {
    "opening_quote": "„Wörtlicher Einstiegssatz...“",
    "qa_rows": [{ "topic": "Beschwerdedauer / SOCRATES...", "answer": "„Wörtliche Antwort...“" }],
    "behavior": ["Verhaltenshinweis 1", "Verhaltenshinweis 2"]
  },
  "physical_exam": [{ "area": "Inspektion / Auskultation / Palpation...", "finding": "Detaillierter Befund..." }],
  "diagnostics_on_demand": {
    "lab_note": "NUR auf gezielte Nachfrage:",
    "labs": [{ "param": "Parameter", "value": "Wert + Einheit", "ref": "Referenzbereich", "flag": "↑ / ↓ / Normal" }],
    "imaging": [{ "modality": "Sonographie / CT / MRT / EKG", "finding": "Realitätsgetreuer Befundbericht" }]
  },
  "examiner_info": {
    "background": "Hintergrund...",
    "goals": "Lernziele...",
    "differentials": ["DD 1", "DD 2", "DD 3"],
    "therapy_plan": "Konkrete Therapie (z.B. Drip & Drain, Medikation)..."
  },
  "checklist": [{ "category": "Anamnese | Klinische Untersuchung | Verdachtsdiagnose & Procedere | Kommunikation", "item": "Prüfungskriterium", "points": 2 }]
}`;
    }

    async function copyOSCEPrompt(btnEl) {
        const allCases = getAllImportedAppCases();
        const sourceCase = allCases.find(c => c.case_id === selectedSourceCaseId);
        const promptText = buildOSCEMasterPrompt(selectedSpecialty, JSON.stringify(sourceCase || currentOSCEData, null, 2));

        try {
            await navigator.clipboard.writeText(promptText);
            if (btnEl) {
                const orig = btnEl.innerHTML;
                btnEl.innerHTML = '✓ OSCE-Prompt kopiert!';
                setTimeout(() => { btnEl.innerHTML = orig; }, 2000);
            }
        } catch (_e) {}
    }

    function printStation() {
        if (!currentOSCEData) return;
        // Vor dem Drucken alle Sektionen aufklappen, damit das A4-Handout komplett ist
        revealedSections = { exam: true, labs: true, imaging: true };
        activeRoleMode = 'all';
        renderActiveStation();
        setTimeout(() => window.print(), 150);
    }

    function openModal(initialSpecialty = null, initialCaseId = null) {
        const modal = ensureModalDOM();
        if (initialSpecialty) selectedSpecialty = initialSpecialty;
        if (initialCaseId) selectedSourceCaseId = initialCaseId;

        renderSpecialtyButtons();
        populateSourceCaseDropdown();
        if (!currentOSCEData) generateStation();
        else renderActiveStation();

        modal.classList.remove('hidden');
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
    }

    function closeModal() {
        const modal = document.getElementById('osce-generator-modal');
        if (modal) modal.classList.add('hidden');
        if (isTimerRunning) {
            clearInterval(timerInterval);
            isTimerRunning = false;
        }
    }

    // Initialisierung beim App-Start
    document.addEventListener('DOMContentLoaded', () => {
        injectOSCEStyles();
        ensureForgeOSCEButton();
    });

    return {
        openModal,
        closeModal,
        selectSpecialty,
        onSourceCaseChange,
        onSettingChange,
        pickRandomCaseForSpecialty,
        generateStation,
        generateWithGeminiAI,
        copyOSCEPrompt,
        printStation,
        setRoleMode(mode) {
            activeRoleMode = mode;
            renderActiveStation();
        },
        toggleSectionReveal(secKey) {
            revealedSections[secKey] = !revealedSections[secKey];
            renderActiveStation();
        },
        toggleChecklistItem(idx) {
            checkedCriteria[idx] = !checkedCriteria[idx];
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
            renderActiveStation();
        },
        resetChecklist() {
            checkedCriteria = {};
            renderActiveStation();
        },
        filterSpTable(val) {
            spSearchFilter = (val || '').trim().toLowerCase();
            renderActiveStation();
        },
        toggleTimer,
        setTimerDuration
    };
})();

window.OSCEModule = OSCEModule;
