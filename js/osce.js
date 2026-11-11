/* ==========================================================================
   MEDCHECK – INTERAKTIVER OSCE-FALLGENERATOR V2.0 (js/osce.js)
   ==========================================================================
   ARCHITEKTUR-HIGHLIGHTS:
   01. Strikte 4-Stufen-Fachgebiets-Klassifikation (mit Wortgrenzen & Blacklist)
   02. Auto-Loader für manifest.json (lädt alle cases/*.json direkt in den Pool)
   03. 21 fachspezifische Schweizer Staatsexamens-Referenzstationen (0 Falschzuordnungen)
   04. Deterministische Case-to-OSCE Synthese für alle importierten App-Fälle
   05. Manuelle 1-Klick-Fachgebiets-Zuweisung (Pinning) für eigene Fälle
   06. 3-Rollen-Modus (Türzettel, SP, Prüfer), Live-Timer & A4-Stationsdruck
   ========================================================================== */

const OSCEModule = (() => {
    const PINNED_SPECIALTY_STORAGE_KEY = 'medcheck_osce_case_specialty_map_v2';
    let manifestCasesCache = [];
    let manifestLoaded = false;

    // ======================================================================
    // 01. DIE 21 FACHRICHTUNGEN MIT STRIKTEN REGEX-REGELN & BLACKLISTS
    // ======================================================================
    const SPECIALTIES = [
        {
            id: 'Chirurgie', label: 'Chirurgie', icon: '🔪',
            setting: 'Chirurgische Notfallstation / Ambulatorium',
            folderPatterns: [/\bchirurg/i, /\bviszeral/i, /\bgefässchirurg/i, /\bthoraxchirurg/i],
            diseasePatterns: [/\bileus\b/i, /\bappendizit/i, /\bcholezystit/i, /\bhernie\b/i, /\bperitonit/i, /\bdivertikulit/i, /\bdarmperforation/i, /\bmilzruptur/i, /\bvolvulus\b/i, /\bmesenterialischämie/i],
            blacklist: [/appendektomie\s+vor/i, /zustand\s+nach/i]
        },
        {
            id: 'Ophthalmologie', label: 'Ophthalmologie', icon: '👁️',
            setting: 'Augenklinik / Ophthalmologische Notfallambulanz',
            folderPatterns: [/\bophthal/i, /\baugenheilkunde/i, /\baugenklinik/i],
            diseasePatterns: [/\bglaukom/i, /\bamotio\b/i, /\bretina/i, /\bnetzhaut/i, /\buveitis\b/i, /\bkeratitis\b/i, /\bkonjunktivit/i, /\bmakuladegeneration/i, /\bzentralarterienverschluss/i, /\bneuritis\s+nervi\s+optici/i],
            blacklist: [/eulenaugen/i, /augenkontakt/i, /augenmerk/i, /blickkontakt/i]
        },
        {
            id: 'Dermatologie', label: 'Dermatologie', icon: '🔬',
            setting: 'Dermatologische Poliklinik / Sprechstunde',
            folderPatterns: [/\bderma/i, /\bhautklinik/i, /\bvenerolog/i],
            diseasePatterns: [/\berysipel\b/i, /\bmelanom\b/i, /\bpsoriasis\b/i, /\batopisches\s+ekzem/i, /\bpemphigus\b/i, /\bbullös/i, /\burtikaria\b/i, /\bbasaliom\b/i, /\bplattenepithelkarzinom\s+der\s+haut/i, /\bherpes\s+zoster/i],
            blacklist: [/hautkolorit/i, /schleimhaut/i]
        },
        {
            id: 'Orthopädie', label: 'Orthopädie', icon: '🦴',
            setting: 'Orthopädische Sprechstunde / Traumatologie',
            folderPatterns: [/\borthopäd/i, /\btraumatolog/i, /\bbewegungsapparat/i, /\bsportmedizin/i],
            diseasePatterns: [/\bkreuzband/i, /\bmeniskus/i, /\brotatorenmanschette/i, /\bgonarthrose/i, /\bkoxarthrose/i, /\bsprunggelenksfraktur/i, /\bschenkelhalsfraktur/i, /\bachillessehne/i, /\bimpingement/i, /\bdiskushernie/i],
            blacklist: []
        },
        {
            id: 'Gesprächsführung', label: 'Gesprächsführung', icon: '💬',
            setting: 'Sprechzimmer / Ärztliches Aufklärungsgespräch',
            folderPatterns: [/\bgesprächsführung/i, /\bkommunikation/i, /\bpsychosomatik/i, /\bethik\b/i],
            diseasePatterns: [/\bbreaking\s+bad\s+news/i, /\bspikes\b/i, /\bmotivational\s+interviewing/i, /\baufklärungsgespräch/i, /\btherapieadhärenz/i],
            blacklist: []
        },
        {
            id: 'Pädiatrie', label: 'Pädiatrie', icon: '🧸',
            setting: 'Pädiatrische Notfallstation / Kinderarztpraxis',
            folderPatterns: [/\bpädiatr/i, /\bkinderheilkunde/i, /\bneonatolog/i],
            diseasePatterns: [/\bfieberkrampf/i, /\bpseudokrupp/i, /\bbronchiolitis\b/i, /\bkawasaki/i, /\binvagination\b/i, /\bpylorusstenose/i, /\bmasern\b/i, /\bscharlach\b/i, /\bepiglottitis/i],
            blacklist: [/kindheit/i, /kinderwunsch/i]
        },
        {
            id: 'Gynäkologie & Geburtshilfe', label: 'Gynäkologie & Geburtshilfe', icon: '🤰',
            setting: 'Gynäkologische Notfallambulanz / Gebärsaal',
            folderPatterns: [/\bgynäkolog/i, /\bgeburtshilfe/i, /\breproduktion/i],
            diseasePatterns: [/\bextrauteringravidität/i, /\btubargravidität/i, /\bpräeklampsie/i, /\bendometriose/i, /\bovarialtorsion/i, /\bovarialkarzinom/i, /\bzervixkarzinom/i, /\bmammakarzinom/i, /\bplazenta\s+praevia/i, /\bpcos\b/i],
            blacklist: []
        },
        {
            id: 'Palliativ Care', label: 'Palliativ Care', icon: '🕊️',
            setting: 'Palliativstation / Spezialisierte Palliativsprechstunde',
            folderPatterns: [/\bpalliativ/i, /\bhospiz/i],
            diseasePatterns: [/\bpalliativ/i, /\bdurchbruchschmerz/i, /\bopioidrotation/i, /\bterminalphase/i, /\brasselatmung/i, /\bpatientenverfügung/i],
            blacklist: []
        },
        {
            id: 'HNO', label: 'HNO', icon: '👂',
            setting: 'HNO-Poliklinik / HNO-Notfallambulanz',
            folderPatterns: [/\bhno\b/i, /\bhals-nasen-ohren/i, /\botorhinolaryngolog/i],
            diseasePatterns: [/\bmenière/i, /\bneuritis\s+vestibularis/i, /\bbpls\b/i, /\blagerungsschwindel/i, /\botitis\b/i, /\bperitonsillarabszess/i, /\bepistaxis\b/i, /\bsinusitis\b/i, /\bhörsturz/i, /\blarynxkarzinom/i],
            blacklist: []
        },
        {
            id: 'Pneumologie', label: 'Pneumologie', icon: '🫁',
            setting: 'Pneumologische Sprechstunde / Notfallstation',
            folderPatterns: [/\bpneumolog/i, /\blungenheilkunde/i, /\bthorax\b/i],
            diseasePatterns: [/\blungenembolie/i, /\bcopd\b/i, /\basthma\s+bronchiale/i, /\bpneumonie\b/i, /\bpneumothorax\b/i, /\bpleuraerguss/i, /\bsarkoidose\b/i, /\blungenfibrose/i, /\bbronchialkarzinom/i],
            blacklist: []
        },
        {
            id: 'Innere Medizin', label: 'Innere Medizin', icon: '🩺',
            setting: 'Allgemeinmedizinische Praxis / Innere Medizin',
            folderPatterns: [/\binnere\s+medizin/i, /\ballgemeinmedizin/i, /\bhämatolog/i, /\bonkolog/i, /\bendokrinolog/i, /\bgastroenterolog/i, /\bnephrolog/i, /\binfektiolog/i],
            diseasePatterns: [/\blymphom\b/i, /\bleukämie/i, /\bmultiples\s+myelom/i, /\banämie\b/i, /\bdiabetes\s+mellitus/i, /\bhyperthyreose/i, /\bhypothyreose/i, /\bleberzirrhose/i, /\bpankreatitis/i, /\bchronisch-entzündliche\s+darmerkrankung/i, /\bmorbus\s+crohn/i, /\bcolitis\s+ulcerosa/i, /\bsepsis\b/i],
            blacklist: []
        },
        {
            id: 'Psychiatrie', label: 'Psychiatrie', icon: '🧠',
            setting: 'Psychiatrische Krisenintervention / Ambulatorium',
            folderPatterns: [/\bpsychiatr/i, /\bpsychotherapie/i],
            diseasePatterns: [/\bdepression\b/i, /\bdepressive\s+episode/i, /\bsuizidalität/i, /\bschizophrenie\b/i, /\bbipolare\s+störung/i, /\bmanie\b/i, /\bpanikstörung/i, /\bposttraumatische\s+belastungsstörung/i, /\banorexia\s+nervosa/i, /\balkoholentzugsdelir/i],
            blacklist: []
        },
        {
            id: 'Kardiologie', label: 'Kardiologie', icon: '❤️',
            setting: 'Chest Pain Unit / Kardiologische Ambulanz',
            folderPatterns: [/\bkardiolog/i, /\bherzzentrum/i],
            diseasePatterns: [/\bmyokardinfarkt/i, /\bstemi\b/i, /\bnstemi\b/i, /\bakutes\s+koronarsyndrom/i, /\bherzinsuffizienz/i, /\bvorhofflimmern/i, /\baortenklappenstenose/i, /\bendokarditis\b/i, /\bperimyokarditis/i, /\bav-block/i],
            blacklist: []
        },
        {
            id: 'Radiologie', label: 'Radiologie', icon: '🩻',
            setting: 'Radiologischer Befundungsraum / Interdisziplinäres Board',
            folderPatterns: [/\bradiolog/i, /\bneuroradiolog/i, /\bnuklearmedizin/i],
            diseasePatterns: [/\bröntgenthorax-befundung/i, /\bct-befundung/i, /\bmrt-befundung/i, /\bstrahlenschutz/i, /\bkontrastmittelreaktion/i],
            blacklist: []
        },
        {
            id: 'Nahtkurs', label: 'Nahtkurs', icon: '🪡',
            setting: 'Chirurgische Wundversorgung / Skills Lab',
            folderPatterns: [/\bnahtkurs/i, /\bwundversorgung/i, /\bkleinchirurg/i],
            diseasePatterns: [/\briss-quetschwunde/i, /\bschnittwunde/i, /\bplatzwunde/i, /\bdonati-rückstichnaht/i, /\beinzelknopfnaht/i, /\blokalanästhesie/i],
            blacklist: []
        },
        {
            id: 'Rechtsmedizin', label: 'Rechtsmedizin', icon: '⚖️',
            setting: 'Institut für Rechtsmedizin / Ärztliche Leichenschau',
            folderPatterns: [/\brechtsmedizin/i, /\bforensik/i],
            diseasePatterns: [/\bleichenschau/i, /\btodeszeichen/i, /\bdrosselung/i, /\bwürgen/i, /\bscharfe\s+gewalt/i, /\bstumpfe\s+gewalt/i, /\bkohlenmonoxidintoxikation/i],
            blacklist: []
        },
        {
            id: 'Neurologie', label: 'Neurologie', icon: '⚡',
            setting: 'Neurologische Praxis / Stroke Unit / Notfallstation',
            folderPatterns: [/\bneurolog/i, /\brückenmark/i, /\bnervensystem/i, /29\.2\.10/i, /\bzns\b/i, /\bdemenz/i],
            diseasePatterns: [/\bmyelopathie/i, /\bmyelitis\b/i, /\bnmosd\b/i, /\bmultiple\s+sklerose/i, /\bfunikuläre\s+myelose/i, /\bspinalis-anterior/i, /\bcreutzfeldt-jakob/i, /\bcjk\b/i, /\bfrontotemporale\s+demenz/i, /\bftd\b/i, /\blewy-body/i, /\blbd\b/i, /\balzheimer/i, /\bprimär\s+progressive\s+aphasie/i, /\bppa\b/i, /\bparkinson/i, /\bschlaganfall/i, /\bepilepsie/i, /\brestless-legs/i, /\bpolyneuropathie/i, /\bguillain-barré/i],
            blacklist: []
        },
        {
            id: 'Rheumatologie', label: 'Rheumatologie', icon: '🖐️',
            setting: 'Rheumatologische Poliklinik',
            folderPatterns: [/\brheumatolog/i, /\bimmunolog/i],
            diseasePatterns: [/\brheumatoide\s+arthritis/i, /\bgicht\b/i, /\bpodagra\b/i, /\bsystemischer\s+lupus/i, /\bsle\b/i, /\bspondyloarthritis/i, /\bmorbus\s+bechterew/i, /\briesenzellarteriitis/i, /\bpolymyalgia\s+rheumatica/i, /\bsjögren/i, /\bsklerodermie/i],
            blacklist: []
        },
        {
            id: 'Notfall', label: 'Notfall', icon: '🚨',
            setting: 'Interdisziplinäre Notfallstation / Schockraum',
            folderPatterns: [/\bnotfallmedizin/i, /\bnotaufnahme/i, /\bintensivmedizin/i, /\banästhesi/i],
            diseasePatterns: [/\banaphylaxie/i, /\baortendissektion/i, /\bpolytrauma/i, /\breanimation/i, /\bseptischer\s+schock/i, /\bhypovolämischer\s+schock/i, /\blungenödem/i, /\bstatus\s+epilepticus/i, /\bintoxikation/i],
            blacklist: []
        },
        {
            id: 'Ultraschall', label: 'Ultraschall', icon: '📡',
            setting: 'Sonographie-Kabine / POCUS Notfallstation',
            folderPatterns: [/\bultraschall/i, /\bsonograph/i, /\bpocus\b/i],
            diseasePatterns: [/\befast\b/i, /\babdomen-sonographie/i, /\bcholezystolithiasis/i, /\bauortenaneurysma-screening/i, /\bkompressionssonographie/i],
            blacklist: []
        },
        {
            id: 'Urologie', label: 'Urologie', icon: '💧',
            setting: 'Urologische Notfallambulanz / Sprechstunde',
            folderPatterns: [/\burolog/i],
            diseasePatterns: [/\burolithiasis/i, /\bnierenkolik/i, /\bharnleiterstein/i, /\bpyelonephritis/i, /\bhodentorsion/i, /\bepididymitis/i, /\bprostatahyperplasie/i, /\bprostatakarzinom/i, /\bharnblasentumor/i, /\bakuter\s+harnverhalt/i],
            blacklist: [/nierenfunktion/i, /nierenwerte/i, /kreatinin/i]
        }
    ];

    // ======================================================================
    // 02. MANUELLE FACHGEBIETS-ZUORDNUNG (PINNING) SPEICHERN & LADEN
    // ======================================================================
    function getPinnedCaseSpecialtyMap() {
        try {
            return JSON.parse(localStorage.getItem(PINNED_SPECIALTY_STORAGE_KEY) || '{}');
        } catch (_e) {
            return {};
        }
    }

    function setPinnedCaseSpecialty(caseId, specialtyId) {
        if (!caseId || !specialtyId) return;
        const map = getPinnedCaseSpecialtyMap();
        map[caseId] = specialtyId;
        try {
            localStorage.setItem(PINNED_SPECIALTY_STORAGE_KEY, JSON.stringify(map));
        } catch (_e) {}
    }

    // ======================================================================
    // 03. PRÄZISIONS-KLASSIFIKATOR: ORDNET JEDEN IMPORTIERTEN FALL EXAKT ZU
    // ======================================================================
    function classifyCasePrimarySpecialty(caseObj) {
        if (!caseObj) return null;
        const cId = caseObj.case_id || caseObj.id || '';

        // 1. Höchste Priorität: Manuelle Zuweisung durch den User oder explizites JSON-Feld
        const pinnedMap = getPinnedCaseSpecialtyMap();
        if (pinnedMap[cId]) return pinnedMap[cId];
        if (caseObj.osce_specialty && SPECIALTIES.some(s => s.id === caseObj.osce_specialty)) {
            return caseObj.osce_specialty;
        }
        if (caseObj.metadata?.osce_specialty && SPECIALTIES.some(s => s.id === caseObj.metadata.osce_specialty)) {
            return caseObj.metadata.osce_specialty;
        }

        // 2. Direkte ID-Präfix-Erkennung für deine Repository-Fälle (cases/*.json)
        const idLower = cId.toLowerCase();
        if (idLower.startsWith('neuro_') || idLower.startsWith('myelon_')) return 'Neurologie';
        if (idLower.startsWith('haemato_') || idLower.startsWith('innere_')) return 'Innere Medizin';
        if (idLower.startsWith('chir_') || idLower.startsWith('ileus_')) return 'Chirurgie';
        if (idLower.startsWith('kardio_')) return 'Kardiologie';
        if (idLower.startsWith('pneumo_')) return 'Pneumologie';
        if (idLower.startsWith('ortho_')) return 'Orthopädie';
        if (idLower.startsWith('gyn_')) return 'Gynäkologie & Geburtshilfe';
        if (idLower.startsWith('paed_')) return 'Pädiatrie';
        if (idLower.startsWith('uro_')) return 'Urologie';
        if (idLower.startsWith('derma_')) return 'Dermatologie';
        if (idLower.startsWith('hno_')) return 'HNO';
        if (idLower.startsWith('psych_')) return 'Psychiatrie';
        if (idLower.startsWith('ophthal_')) return 'Ophthalmologie';
        if (idLower.startsWith('rheuma_')) return 'Rheumatologie';

        // 3. Gewichtetes Scoring auf Ordnername, medical_field, primary_disease und Titel (KEIN unstrukturierter Volltext!)
        const folderStr = `${caseObj.folder_name || ''} ${caseObj.metadata?.medical_field || ''}`.trim();
        const diseaseAndTitleStr = `${caseObj.metadata?.primary_disease || ''} ${caseObj.metadata?.title || ''} ${caseObj.case_overview?.topic || ''}`.trim();

        let bestSpec = null;
        let bestScore = 0;

        for (const spec of SPECIALTIES) {
            let score = 0;

            // Blacklist-Prüfung
            const isBlacklisted = (spec.blacklist || []).some(rx => rx.test(diseaseAndTitleStr));
            if (isBlacklisted) continue;

            // Ordner / medical_field Treffer zählen stark (+80 Punkte)
            for (const rx of (spec.folderPatterns || [])) {
                if (rx.test(folderStr)) {
                    score += 80;
                }
            }

            // Primary Disease & Titel Treffer mit echten Wortgrenzen (+60 Punkte)
            for (const rx of (spec.diseasePatterns || [])) {
                if (rx.test(diseaseAndTitleStr)) {
                    score += 60;
                } else if (rx.test(folderStr)) {
                    score += 45;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestSpec = spec.id;
            }
        }

        // Nur zurückgeben, wenn ein eindeutiger Fachtreffer vorliegt (Mindestscore >= 45)
        return bestScore >= 45 ? bestSpec : null;
    }

    //Lädt beim ersten Öffnen automatisch alle statischen Fälle aus manifest.json (cases/*.json) nach
    async function ensureManifestCasesLoaded() {
        if (manifestLoaded) return;
        manifestLoaded = true;
        try {
            const res = await fetch('manifest.json');
            if (!res.ok) return;
            const manifest = await res.json();
            const entries = Array.isArray(manifest.cases) ? manifest.cases : [];
            const loaded = await Promise.all(entries.map(async (entry) => {
                if (!entry.file_path) return null;
                try {
                    const r = await fetch(entry.file_path);
                    if (!r.ok) return null;
                    const data = await r.json();
                    if (data && data.case_id) {
                        if (!data.folder_name && entry.category) data.folder_name = entry.category;
                        return data;
                    }
                } catch (_e) {}
                return null;
            }));
            manifestCasesCache = loaded.filter(Boolean);
        } catch (_err) {}
    }

    function getAllImportedAppCases() {
        const reg = (typeof window.getRegisteredCases === 'function')
            ? window.getRegisteredCases({ ignoreSpecialtyFilter: true })
            : [];
        const map = new Map();
        reg.forEach(c => {
            if (c && c.case_id) map.set(c.case_id, c);
        });
        manifestCasesCache.forEach(c => {
            if (c && c.case_id && !map.has(c.case_id)) {
                map.set(c.case_id, c);
            }
        });
        return Array.from(map.values());
    }

    function getStrictCasesForSpecialty(specialtyId) {
        const allCases = getAllImportedAppCases();
        return allCases.filter(c => classifyCasePrimarySpecialty(c) === specialtyId);
    }

    // ======================================================================
    // 04. 21 FACHSPEZIFISCHE SCHWEIZER OSCE-REFERENZFÄLLE (1 PRO FACHGEBIET)
    //     Garantiert für JEDES der 21 Fächer sofort einen 100 % passenden Fall!
    // ======================================================================
    const SPECIALTY_REFERENCE_BLUEPRINTS = {
        'Chirurgie': {
            osce_id: 'REF_CHIR_ILEUS',
            specialty: 'Chirurgie',
            title: 'Akutes Abdomen & Schwallartiges Erbrechen – Mechanischer Dünndarmileus (Bridenileus)',
            source_case_title: 'Referenz-Station Chirurgie (Mechanischer Ileus)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt auf der interdisziplinären Notfallstation.',
                vignette: 'Herr Thomas Schneider (62-jährig) kommt aufgrund starker, krampfartiger Bauchschmerzen und Übelkeit auf die Notfallstation.',
                tasks: [
                    'Führen Sie eine fokussierte Schmerz- und Systemanamnese (SOCRATES) durch.',
                    'Führen Sie eine strukturierte klinische Untersuchung des Abdomens durch.',
                    'Besprechen Sie mit dem Patienten Ihre Verdachtsdiagnose und das unmittelbare weitere Vorgehen.'
                ],
                vitals: { bp: '95/60 mmHg', hr: '110/min (tachykard)', rr: '22/min', temp: '37,8 °C', spo2: '97 % (Raumluft)', bmi: '26 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Herr/Frau Doktor, ich halte diese Bauchkrämpfe nicht mehr aus! Mir ist speiübel und ich musste mich schon mehrfach übergeben.“',
                qa_rows: [
                    { topic: 'Beginn & Verlauf (Onset / Timing)', answer: '„Beginn plötzlich vor 24 Stunden. Die krampfartigen Schmerzen kommen und gehen in Wellen und werden immer schlimmer.“' },
                    { topic: 'Lokalisation & Ausstrahlung (Site / Radiation)', answer: '„Zu Beginn um den Bauchnabel herum, jetzt diffus im Mittel- und Unterbauch, keine Ausstrahlung.“' },
                    { topic: 'Charakter & Intensität (Character / Severity)', answer: '„Wellenförmige Krämpfe (Koliken), Intensität auf der Schmerzskala NRS 8/10. Bewegung und Essen verstärken es, nichts hilft.“' },
                    { topic: 'Erbrechen, Stuhlgang & Windabgang', answer: '„Mehrfaches Erbrechen, zuletzt schwallartig und gelb-grünlich (gallig). Kein Stuhlgang und kein Windabgang seit 2 Tagen! Bauch stark gebläht.“' },
                    { topic: 'Begleitsymptome & Voroperationen', answer: '„Kaltschweißigkeit, Schwächegefühl, kein Fieber. Vor 25 Jahren Blinddarmentfernung (Appendektomie).“' },
                    { topic: 'Vorerkrankungen, Medikation, Allergien, FA', answer: '„Keine Vorerkrankungen, keine Medikamente, keine Allergien. Familienanamnese bland (kein Darmkrebs, keine CED).“' }
                ],
                behavior: ['Schmerzgeplagt, kaltschweißig, krümmt sich bei Schmerzwellen.', 'Kooperativ, aber erschöpft.']
            },
            physical_exam: [
                { area: 'Inspektion', finding: 'Prall geblähtes Abdomen (Meteorismus), reizlose Appendektomie-Narbe im rechten Unterbauch.' },
                { area: 'Auskultation (4 Quadranten)', finding: 'Hochgestellte, klingende, metallisch-spritzende und gesteigerte Darmgeräusche.' },
                { area: 'Perkussion', finding: 'Diffus tympanitischer Klopfschall über allen 4 Quadranten.' },
                { area: 'Palpation (schmerzfern im Oberbauch gestartet)', finding: 'Diffus druckschmerzhaftes Abdomen ohne klare Abwehrspannung, Bruchpforten frei.' },
                { area: 'Digital-rektale Untersuchung (DRU)', finding: 'Rektumampulle leer, Sphinktertonus normal, kein Blut am Fingerling.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf gezielte Nachfrage:',
                labs: [
                    { param: 'Leukozyten & CRP', value: 'Leuk 14.8 G/l | CRP 42 mg/l', ref: '4.0–10.0 G/l | < 5 mg/l', flag: '↑ (Entzündung / Stress)' },
                    { param: 'Hb & Kreatinin', value: 'Hb 162 g/l | Krea 138 µmol/l', ref: '135–175 g/l | 62–106 µmol/l', flag: '↑ (Hämokonzentration & prärenale AKI)' },
                    { param: 'Kalium & Natrium', value: 'K 3.1 mmol/l | Na 133 mmol/l', ref: '3.5–5.0 | 135–145 mmol/l', flag: '↓ (Hypokaliämie durch Erbrechen!)' },
                    { param: 'BGA & Laktat', value: 'pH 7.47 | Laktat 2.6 mmol/l', ref: 'pH 7.35–7.45 | Laktat < 1.8', flag: '⚠️ Laktat ↑ (Drohende Strangulation!)' },
                    { param: 'Lipase & Transaminasen', value: 'Lipase 38 U/l | ALT 24 U/l', ref: '< 60 U/l | < 50 U/l', flag: 'Normal' }
                ],
                imaging: [
                    { modality: 'Abdomen-Sonographie & Röntgen-Abdomenübersicht', finding: 'Dilatierte Dünndarmschlingen (> 3.5 cm) mit Pendelperistaltik („Klaviertastenphänomen“) und stehenden Flüssigkeitsspiegeln.' },
                    { modality: 'CT Abdomen mit i.v. KM (Goldstandard)', finding: 'Kalibersprung im distalen Ileum durch Bride im rechten Unterbauch nahe der Appendektomie-Narbe, vorgeschaltete Dünndarmdilatation.' }
                ]
            },
            examiner_info: {
                background: 'Mechanischer Dünndarmileus (Bridenileus nach Appendektomie vor 25 Jahren) mit Volumenmangel, Hypokaliämie und beginnender Laktaterhöhung.',
                goals: 'SOCRATES-Anamnese, Ileus-Trias erkennen, Abdomen-Untersuchung in korrekter Reihenfolge (Inspektion → Auskultation → Perkussion → Palpation → DRU), Soforttherapie „Drip & Drain“ + CT Abdomen.',
                differentials: ['Mechanischer Bridenileus', 'Inkarzerierte Hernie', 'Mesenterialischämie', 'Stenosing Kolonkarzinom'],
                therapy_plan: 'Stationäre chirurgische Aufnahme & „Drip & Drain“: Nüchtern (NPO), Magensonde legen, i.v. Volumengabe + Kaliumsubstitution, Analgesie, DK zur Bilanzierung, zeitnahe operative Adhäsiolyse nach CT.'
            },
            checklist: [
                { category: 'Anamnese', item: 'Alle Schmerzdimensionen nach SOCRATES erfragt (inkl. NRS 8/10)', points: 2 },
                { category: 'Anamnese', item: 'Spezifisch nach Begleitsymptomen gefragt: Übelkeit, galliges Erbrechen, Stuhl-/Windverhalten, Miktion, Fieber', points: 2 },
                { category: 'Anamnese', item: 'Voroperationen im Bauchraum (Appendektomie!), Vorerkrankungen, Vorsorgekoloskopie, Medikamente, Allergien & FA erfragt', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Händedesinfektion + korrekte Reihenfolge: Inspektion (Narben!) → Auskultation (alle 4 Quadranten, mehrere Sek.) VOR Palpation', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Perkussion (4 Quadranten) + Palpation schmerzfern im Oberbauch gestartet (oberflächlich & tief mit Blickkontakt) + DRU erwähnt', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Äußert Verdachtsdiagnose eines mechanischen Ileus (Bridenileus) + verordnet Labor (inkl. Elektrolyte, Krea, BGA/Laktat) & CT mit KM', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Startet „Drip & Drain“ (Nüchtern, Magensonde, i.v. Infusion + Elektrolytkorrektur, Analgesie, DK) & kündigt wahrscheinliche OP an', points: 3 },
                { category: 'Kommunikation', item: 'Begrüßung mit Funktion, empathische Kommunikation in patientenverständlicher Sprache', points: 2 }
            ]
        },

        'Neurologie': {
            osce_id: 'REF_NEURO_RLS',
            specialty: 'Neurologie',
            title: 'Unruhige Beine am Abend – Idiopathisches Restless-Legs-Syndrom (RLS)',
            source_case_title: 'Referenz-Station Neurologie / Allgemeinmedizin (RLS)',
            door_sign: {
                role: 'Sie sind Unterassistentin / Unterassistent in einer allgemeinmedizinischen / neurologischen Praxis.',
                vignette: 'Eine 54-jährige Patientin, Frau Sabine Keller, kommt zu Ihnen in die Praxis mit unangenehmen Beschwerden in den Beinen.',
                tasks: [
                    'Führen Sie eine gezielte Anamnese der aktuellen Beschwerden durch.',
                    'Führen Sie eine orientierende körperliche Untersuchung der unteren Extremitäten durch.',
                    'Erklären Sie am Ende der Patientin Ihre Verdachtsdiagnose(n) und Ihr geplantes weiteres Vorgehen in patientenverständlicher Sprache.'
                ],
                vitals: { bp: '125/75 mmHg', hr: '72/min, regelmäßig', rr: '14/min', temp: '36,7 °C', spo2: '98 %', bmi: '25 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Meine Beine kribbeln in letzter Zeit so komisch. Es stört mich total! Vor allem abends ist es mir aufgefallen.“',
                qa_rows: [
                    { topic: 'Beschwerdedauer & Verlauf', answer: '„Seit etwa einem Jahr, aber es wird in den letzten Monaten deutlich schlimmer.“' },
                    { topic: 'Lokalisation & Ausbreitung', answer: '„Beide Beine tief in den Waden, manchmal bis in die Oberschenkel. Hände und Arme sind nicht betroffen.“' },
                    { topic: 'Charakter der Beschwerden', answer: '„Ein Ziehen, Kribbeln, inneres Unruhegefühl – richtig unangenehm. Es ist kein eigentlicher Schmerz, aber ich MUSS die Beine bewegen.“' },
                    { topic: 'Tageszeit, Auslöser & Linderung', answer: '„Immer abends, wenn ich zur Ruhe komme oder im Bett liege. Wenn ich aufstehe und herumlaufe, verschwindet es sofort kurzzeitig.“' },
                    { topic: 'Schlafqualität & Tagesmüdigkeit', answer: '„Ich schlafe extrem schlecht ein, wache oft auf und bin tagsüber wie gerädert.“' },
                    { topic: 'Vorerkrankungen, Medikation & Noxen', answer: '„Bluthochdruck, nehme Ramipril 5 mg täglich (keine Neuroleptika/Antidepressiva). 2 Tassen Kaffee/Tag, selten Alkohol, Nichtraucherin.“' },
                    { topic: 'Familienanamnese & Red Flags', answer: '„Meine Mutter hatte das auch (‚Beine nie still‘). Keine Taubheit, keine Lähmungen, keine Schmerzen beim Gehen (keine Claudicatio).“' }
                ],
                behavior: ['Freundlich, wirkt müde, sitzt unruhig und bewegt gelegentlich die Beine.', 'Äußert hohen Leidensdruck durch den chronischen Schlafmangel.']
            },
            physical_exam: [
                { area: 'Inspektion der Beine', finding: 'Unauffällig, keine Ödeme, keine trophischen Hautveränderungen, keine relevante Varikosis.' },
                { area: 'Motorik & Muskeleigenreflexe (MER)', finding: 'Kraft 5/5 in allen Kennmuskeln, PSR und ASR seitengleich mittellebhaft auslösbar, Babinski negativ.' },
                { area: 'Sensibilität (Oberflächen & Vibration)', finding: 'Berührungs-, Schmerz-, Temperatur- und Vibrationsempfinden (Stimmgabel 8/8 an Großzehe/Malleolus) intakt.' },
                { area: 'Periphere Durchblutung & Gangbild', finding: 'A. dorsalis pedis und A. tibialis posterior bds. kräftig palpabel, Füße warm. Gangbild inkl. Zehen-/Fersengang unauffällig.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR bei gezielter Nachfrage (Ausschluss sekundäres RLS):',
                labs: [
                    { param: 'Ferritin im Serum', value: '18 µg/l', ref: '30–150 µg/l (RLS-Zielwert > 50–75 µg/l)', flag: '↓ (Eisenmangel verstärkt RLS!)' },
                    { param: 'Hämoglobin (Hb) & MCV', value: 'Hb 128 g/l | MCV 84 fl', ref: '120–160 g/l | 80–98 fl', flag: 'Normal (Noch keine manifeste Anämie)' },
                    { param: 'Kreatinin & eGFR', value: '68 µmol/l (eGFR > 90 ml/min)', ref: '45–84 µmol/l', flag: 'Normal (Ausschluss urämisches RLS)' },
                    { param: 'Vitamin B12, Folsäure & TSH', value: 'B12 410 pmol/l | TSH 1.8 mU/l', ref: '> 200 pmol/l | 0.4–4.0 mU/l', flag: 'Normal' }
                ],
                imaging: [
                    { modality: 'Apparative Diagnostik (ENG / Polysomnographie)', finding: 'Keine routinemäßige Bildgebung erforderlich. Elektroneurographie (ENG) nur bei klinischem PNP-Verdacht; Polysomnographie nur bei Therapieresistenz.' }
                ]
            },
            examiner_info: {
                background: 'Erstvorstellung einer Patientin mit typischem Restless-Legs-Syndrom (RLS) bei positiver Familienanamnese und niedrigem Serum-Ferritin (18 µg/l).',
                goals: 'Erkennen der 4 obligaten RLS-Kriterien, Ausschluss von Polyneuropathie, pAVK, Venenleiden und medikamentösen Auslösern (Dopaminantagonisten), gezielte Ferritin-Bestimmung und Therapieplanung.',
                differentials: ['Polyneuropathie (diabetisch, toxisch, B12-Mangel)', 'Periphere arterielle Verschlusskrankheit (pAVK)', 'Chronisch-venöse Insuffizienz', 'Neuroleptika-induzierte Akathisie', 'Nächtliche Wadenkrämpfe (Crampi)'],
                therapy_plan: '1. Eisensubstitution (Ziel-Ferritin > 50–75 µg/l), 2. Schlafhygiene & Verzicht auf Koffein/Alkohol am Abend, 3. Bei Persistenz: Pregabalin/Gabapentin oder niedrigdosierte Dopaminagonisten (Pramipexol, Ropinirol, Rotigotin).'
            },
            checklist: [
                { category: 'Anamnese', item: 'Begrüßung, Vorstellung, offene Eingangsfrage zum Hauptsymptom', points: 1 },
                { category: 'Anamnese', item: 'Erfragt gezielt die 4 RLS-Hauptkriterien (Bewegungsdrang + Dysästhesien, Beginn in Ruhe, Besserung durch Bewegung, Abend-/Nachtbetonung)', points: 3 },
                { category: 'Anamnese', item: 'Erfragt Schlafstörungen, Tagesmüdigkeit, Vorerkrankungen, Medikation (Dopaminantagonisten!) & Familienanamnese', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Führt orientierende neurologische & vaskuläre Untersuchung der Beine durch (Inspektion, Fußpulse, Kraft, Reflexe, Sensibilität, Gang)', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Benennt RLS-Verdachtsdiagnose + relevante Differenzialdiagnosen (Polyneuropathie, Eisenmangel, pAVK, Medikamentennebenwirkung)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Schlägt Basisdiagnostik (Ferritin!, Nierenfunktion) und Therapie (Eisenoptimierung, Schlafhygiene, medikamentöse Optionen) vor', points: 3 },
                { category: 'Kommunikation', item: 'Kommuniziert empathisch, strukturiert und fasst Ergebnisse patientenverständlich zusammen', points: 2 }
            ]
        },

        'Ophthalmologie': {
            osce_id: 'REF_OPHTHAL_GLAUKOM',
            specialty: 'Ophthalmologie',
            title: 'Akutes schmerzhaftes rotes Auge & Sehverlust – Akuter Winkelblockglaukom-Anfall',
            source_case_title: 'Referenz-Station Ophthalmologie (Akuter Glaukomanfall)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt in der ophthalmologischen Notfallambulanz.',
                vignette: 'Frau Margrit Huber (67-jährig) stellt sich abends notfallmäßig wegen stärkster linksseitiger Augen- und Kopfschmerzen sowie verschwommenem Sehen vor.',
                tasks: [
                    'Erheben Sie eine gezielte ophthalmologische und systemische Notfallanamnese.',
                    'Führen Sie eine strukturierte Untersuchung der Augen (inkl. Visus, Pupillenmotorik und digitaler Bulbuspalpation) durch.',
                    'Nennen Sie der Patientin Ihre Verdachtsdiagnose und leiten Sie die sofortige drucksenkende Notfalltherapie ein.'
                ],
                vitals: { bp: '165/95 mmHg', hr: '88/min', rr: '18/min', temp: '36,6 °C', spo2: '98 %', bmi: '24 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Mein linkes Auge und meine ganze linke Kopfhälfte platzen fast vor Schmerzen! Ich sehe links alles nur noch wie durch dichten Nebel und mir ist furchtbar übel.“',
                qa_rows: [
                    { topic: 'Beginn & Auslöser', answer: '„Vor 3 Stunden im abgedunkelten Kinosaal plötzlich eingeschossen.“' },
                    { topic: 'Schmerzcharakter & Begleitsymptome', answer: '„Dumpfer, extrem bohrender Schmerz im linken Auge und über der Stirn (NRS 9/10), dazu starke Übelkeit und einmaliges Erbrechen.“' },
                    { topic: 'Sehstörung & Halos', answer: '„Ich sehe links stark verschwommen und um Lichtquellen herum sehe ich farbige Regenbogenringe (Halos).“' },
                    { topic: 'Ophthalmologische Vorgeschichte (Brille)', answer: '„Ich bin stark weitsichtig (Hyperopie, +5.5 Dioptrien bds.), bisher noch keine Katarakt-OP gehabt.“' },
                    { topic: 'Vorerkrankungen & Medikamente', answer: '„Bluthochdruck (Candesartan). Gestern habe ich wegen Erkältung ein neues Nasenspray und ein Kombi-Erkältungspräparat (sympathomimetisch/anticholinerg) genommen.“' }
                ],
                behavior: ['Hält sich die linke Stirn/Schläfe, kneift das linke Auge leicht zu, wirkt durch die Übelkeit stark mitgenommen.']
            },
            physical_exam: [
                { area: 'Inspektion & Konjunktiven', finding: 'Links ausgeprägte gemischte (konjunktivale und ziliare) Gefäßinjektion, Hornhaut matt/getrübt (Epithelödem). Rechtes Auge reizlos.' },
                { area: 'Pupillenmotorik', finding: 'Links mittelweite, entrundete und lichtstarre Pupille (direkte & konsensuelle Lichtreaktion links aufgehoben). Rechts normal.' },
                { area: 'Digitale Bulbuspalpation (im Seitenvergleich)', finding: 'Linker Bulbus bei Palpation durch das geschlossene Oberlid steinhart! Rechter Bulbus normoton.' },
                { area: 'Orientierende Visusprüfung', finding: 'Links Visuscc auf Handbewegungen / Fingerzählen reduziert; rechts Visuscc 0.9.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage (vor i.v. Acetazolamid-Gabe):',
                labs: [
                    { param: 'Kreatinin / eGFR & Kalium', value: 'Krea 74 µmol/l | K 4.2 mmol/l', ref: '45–84 µmol/l | 3.5–5.0 mmol/l', flag: 'Normal (Keine Kontraindikation für Acetazolamid)' }
                ],
                imaging: [
                    { modality: 'Applanationstonometrie nach Goldmann & Spaltlampe', finding: 'Augeninnendruck (IOD) links 58 mmHg (Norm 10–21 mmHg), rechts 16 mmHg. Flache Vorderkammer, aufgehobener Kammerwinkel in der Gonioskopie.' }
                ]
            },
            examiner_info: {
                background: 'Akuter Winkelblockglaukom-Anfall links bei prädisponierter hyperoper Patientin, ausgelöst durch Mydriasis im dunklen Kino und anticholinerge/sympathomimetische Erkältungsmedikation.',
                goals: 'Klassische Trias erkennen (einseitig rotes schmerzhaftes Auge + Visusminderung/Halos/Übelkeit + steinharter Bulbus mit mittelweiter lichtstarrer Pupille), sofortige medikamentöse IOD-Senkung + YAG-Laser-Iridotomie.',
                differentials: ['Akute Iritis / Uveitis anterior (dort Miosis & Hypotonie/Normotonie!)', 'Akute Konjunktivitis / Keratitis', 'Subarachnoidalblutung / Migräneanfall (wegen Kopfschmerz & Erbrechen)'],
                therapy_plan: 'Sofortige Notfalltherapie: 1. Acetazolamid (Diamox) 500 mg i.v. (Carboanhydrasehemmer), 2. Topisch: Timolol 0.5% AT + Pilocarpin 1–2% AT (Miotikum zum Freiziehen des Kammerwinkels) + Prednisolon AT, 3. Ggf. Mannitol 20% i.v., 4. Definitive kausale Therapie nach Entquellung der Hornhaut: YAG-Laser-Iridotomie (beidseits!).'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt Beginn (Dunkelheit/Kino), Schmerzcharakter, Halos/Nebelsehen, vegetative Symptomatik (Übelkeit/Erbrechen) & Hyperopie (+dpt)', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Prüft Visus, Pupillenreaktion (mittelweit, lichtstarr links!) und führt die vergleichende digitale Bulbuspalpation durch („steinharter Bulbus“)', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Stellt die Diagnose „Akuter Winkelblockglaukom-Anfall“ und grenzt Uveitis anterior / Konjunktivitis ab', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Verordnet sofortige Druckmessung (Tonometrie) und Akuttherapie: Acetazolamid i.v., Pilocarpin AT (Miotikum), Betablocker AT + anschließende YAG-Iridotomie', points: 3 },
                { category: 'Kommunikation', item: 'Beruhigt die schmerzgeplagte Patientin und erklärt den Notfallplan klar und verständlich', points: 2 }
            ]
        },

        'Dermatologie': {
            osce_id: 'REF_DERMA_ERYSIPEL',
            specialty: 'Dermatologie',
            title: 'Scharf begrenzte überwärmte Unterschenkelrötung & Fieber – Akutes Erysipel',
            source_case_title: 'Referenz-Station Dermatologie (Erysipel vs. TVT)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt in der dermatologischen / internistischen Notfallambulanz.',
                vignette: 'Herr Beat Kunz (59-jährig) stellt sich wegen einer seit gestern rasch zunehmenden, schmerzhaften Rötung am rechten Unterschenkel und Schüttelfrost vor.',
                tasks: [
                    'Erheben Sie eine gezielte dermatologische und infektiologische Anamnese (inkl. Eintrittspforten & Risikofaktoren).',
                    'Untersuchen Sie das betroffene Bein systematisch.',
                    'Besprechen Sie Diagnose, Differenzialdiagnosen und Therapieplan mit dem Patienten.'
                ],
                vitals: { bp: '138/82 mmHg', hr: '96/min', rr: '16/min', temp: '38,9 °C', spo2: '98 %', bmi: '29 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Seit gestern Abend brennt mein rechtes Schienbein wie Feuer, ist knallrot angeschwollen und heute Morgen hatte ich richtig Schüttelfrost!“',
                qa_rows: [
                    { topic: 'Verlauf & Ausbreitung', answer: '„Gestern als kleiner roter Fleck über dem Knöchel begonnen, heute schon bis zur halben Wade hochgezogen.“' },
                    { topic: 'Eintrittspforte (Zehenzwischenräume)', answer: '„Ja, zwischen meinen Zehen juckt und schuppt die Haut schon seit Monaten (Fußpilz), da sind kleine Risse.“' },
                    { topic: 'Vorerkrankungen & Medikamente', answer: '„Diabetes mellitus Typ 2 (Metformin 1000 mg 1-0-1) und leichte Venenschwäche.“' },
                    { topic: 'Allergien & Thrombose-Hinweise', answer: '„Keine Penicillin-Allergie bekannt. Keine lange Reise, keine Operation gehabt.“' }
                ],
                behavior: ['Fiebrig, schont das rechte Bein beim Auftreten, kooperativ.']
            },
            physical_exam: [
                { area: 'Inspektion rechter Unterschenkel', finding: 'Scharf begrenzte, hellrote, flammenförmige („kartenblattartige“) Rötung und Schwellung prätibial rechts. Keine Nekrosen, kein Hautknistern.' },
                { area: 'Inspektion Zehenzwischenräume (Eintrittspforte!)', finding: 'Interdigitalmykose (Tinea pedis interdigitalis) mit schmerzhaften Rhagaden zwischen Dig. IV und V rechts.' },
                { area: 'Palpation & Lymphknotenstatus', finding: 'Deutliche Überwärmung und Druckdolenz, zarte rote Streifen (Lymphangitis) und druckdolenter Lymphknoten inguinal rechts. Fußpulse bds. kräftig.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Leukozyten & CRP', value: 'Leuk 15.6 G/l | CRP 118 mg/l', ref: '4.0–10.0 G/l | < 5 mg/l', flag: '↑↑ (Bakterielle Weichteilinfektion)' },
                    { param: 'Blutzucker & Kreatinin', value: 'Glukose 8.9 mmol/l | Krea 82 µmol/l', ref: '3.9–5.6 mmol/l | 62–106 µmol/l', flag: 'Leichte Hyperglykämie' }
                ],
                imaging: [
                    { modality: 'Duplexsonographie (falls zum TVT-Ausschluss angefordert)', finding: 'Tiefe Beinvenen vollständig komprimierbar, kein Hinweis auf tiefe Beinvenenthrombose (TVT), subkutanes Ödem.' }
                ]
            },
            examiner_info: {
                background: 'Klassisches akutes Erysipel (beta-hämolysierende Streptokokken der Gruppe A / S. pyogenes) mit Eintrittspforte Tinea pedis interdigitalis bei Diabetes mellitus.',
                goals: 'Scharf begrenztes Erythem + Fieber erkennen, zwingend die Zehenzwischenräume als Eintrittspforte inspizieren, Rötungsgrenze mit Stift markieren und Penicillin-Therapie + antimykotische Sanierung der Eintrittspforte einleiten.',
                differentials: ['Tiefe Beinvenenthrombose (TVT)', 'Phlegmone (unscharf begrenzt, tieferreichend, oft S. aureus)', 'Nekrotisierende Fasziitis (Red Flag: unverhältnismäßiger Schmerz, Krepitation, Blasen)', 'Stauungsdermatitis bei CVI'],
                therapy_plan: '1. Rötungsgrenze mit Hautmarker anzeichnen, 2. Systemische Antibiose: Penicillin G i.v. (oder Amoxicillin p.o./i.v.) für 7–10 Tage, 3. Eintrittspforte sanieren (topisches Antimykotikum wie Terbinafin für Tinea pedis!), 4. Bein hochlagern, Kühlung, Analgesie/Antipyrese, Thromboseprophylaxe (NMH).'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt Beginn, Fieber/Schüttelfrost, Diabetes, Allergien (Penicillin!) und sucht gezielt nach einer Eintrittspforte (Fußpilz/Bagatelltrauma)', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Inspiziert Unterschenkel (scharfe Begrenzung, Überwärmung), inspiziert aktiv die Zehenzwischenräume und tastet inguinale Lymphknoten', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Stellt die Diagnose „Erysipel“ (Streptokokken) und grenzt TVT, Phlegmone sowie nekrotisierende Fasziitis ab', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Zeichnet Ausdehnung mit Stift an, verordnet Penicillin/Amoxicillin + topisches Antimykotikum für die Tinea pedis + Hochlagerung/NMH', points: 3 },
                { category: 'Kommunikation', item: 'Erklärt Rezidivprophylaxe (Fußpilzbehandlung!) verständlich', points: 2 }
            ]
        },

        'Orthopädie': {
            osce_id: 'REF_ORTHO_VKB',
            specialty: 'Orthopädie',
            title: 'Akutes Knietrauma mit „Knall“ & Hämarthros – Vordere Kreuzbandruptur & Innenmeniskusläsion',
            source_case_title: 'Referenz-Station Orthopädie / Sporttraumatologie (Kniegelenk)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt in der orthopädisch-traumatologischen Sprechstunde.',
                vignette: 'Herr Lukas Wyss (28-jährig) stellt sich nach einem Skiunfall gestern mit einem geschwollenen, instabilen rechten Kniegelenk vor.',
                tasks: [
                    'Erheben Sie eine präzise Unfallmechanismus- und Beschwerdeanamnese.',
                    'Führen Sie eine strukturierte klinische Kniegelenksuntersuchung (Inspektion, Ergussprüfung, Bandstabilität, Meniskustests, pDMS) durch.',
                    'Besprechen Sie Ihre Verdachtsdiagnose, die notwendige Bildgebung und die Therapieoptionen (konservativ vs. operativ).'
                ],
                vitals: { bp: '122/76 mmHg', hr: '68/min', rr: '14/min', temp: '36,6 °C', spo2: '99 %', bmi: '23 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Beim Skifahren hat es mir gestern den rechten Ski verkantet, das Knie hat sich nach innen verdreht und ich habe ein richtiges Schnalzen im Knie gespürt!“',
                qa_rows: [
                    { topic: 'Unfallmechanismus', answer: '„Typisches Valgus-Flexions-Außenrotations-Trauma (Ski verkantet, Bindung ging nicht auf).“' },
                    { topic: 'Sofortsymptomatik & Ergussverlauf', answer: '„Ein hörbares ‚Plopp‘/Zerreißgefühl. Innerhalb von 2 Stunden ist das Knie dick angeschwollen.“' },
                    { topic: 'Instabilitätsgefühl (Giving-way)', answer: '„Ja, beim Versuch aufzustehen hatte ich das Gefühl, der Unterschenkel rutscht mir unter dem Oberschenkel weg.“' },
                    { topic: 'Beruf & Sportliches Anspruchsniveau', answer: '„Physiotherapeut, spiele aktiv Volleyball und gehe viel Skifahren.“' }
                ],
                behavior: ['Kommt hinkend, kann das rechte Knie wegen des Gelenkergusses nicht ganz durchstrecken.']
            },
            physical_exam: [
                { area: 'Inspektion & Ergussprüfung', finding: 'Deutliche Schwellung des rechten Kniegelenks mit verstrichenen Konturen. Tanzende Patella (Ballottement) positiv.' },
                { area: 'Beweglichkeit (Neutral-Null-Methode)', finding: 'Extension/Flexion rechts schmerz- und ergussbedingt 0-15-95° (links 5-0-140°).' },
                { area: 'Kreuzband-Tests (Lachman-Test & Vordere Schublade)', finding: 'Lachman-Test in 20–30° Flexion deutlich positiv mit weichem/fehlendem Anschlag! Hintere Schublade negativ.' },
                { area: 'Kollateralbänder (Valgus-/Varusstress in 0° und 30°)', finding: 'Valgusstress in 30° leicht druckschmerzhaft über dem MCL (Grad I Distorsion), aber stabiler Anschlag; LCL stabil.' },
                { area: 'Meniskus-Zeichen & pDMS', finding: 'Druckschmerz über dem medialen Gelenkspalt, Steinmann I (Schmerz medial bei Außenrotation) positiv. pDMS allseits intakt.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Gerinnung / Routinelabor', value: 'Unauffällig (nur bei geplanter Punktion/OP relevant)', ref: 'INR 1.0', flag: 'Normal' }
                ],
                imaging: [
                    { modality: 'Röntgen Kniegelenk rechts in 2 Ebenen (+ Patella axial)', finding: 'Kein knöcherner Ausriss der Eminentia intercondylaris, keine Segond-Fraktur, Gelenkerguss.' },
                    { modality: 'MRT Kniegelenk rechts (Goldstandard Weichteile)', finding: 'Komplette Ruptur des vorderen Kreuzbandes (VKB), typisches Bone-Bruise-Muster am lateralen Femurkondylus und posterolateralen Tibiaplateau sowie Korbhenkelriss des Innenmeniskus.' }
                ]
            },
            examiner_info: {
                background: 'Akute vordere Kreuzbandruptur (VKB) mit Begleitläsion des Innenmeniskus und MCL-Zerrung („Unhappy Triad“-Konstellation) nach Valgus-Flexions-Außenrotations-Trauma.',
                goals: 'Unfallmechanismus und raschen Hämarthros (< 2–4 h) als Hinweis auf VKB-Ruptur erkennen, Lachman-Test als sensitivsten Akuttest korrekt durchführen, Röntgen zum Frakturausschluss (Ottawa Knee Rules) + MRT anordnen.',
                differentials: ['Isolierte Meniskusläsion', 'Patellaluxation', 'Tibiakopffraktur / knöcherner Bandausriss', 'Hintere Kreuzbandruptur (Dashboard-Injury)'],
                therapy_plan: 'Akut: PECH-Schema (Pause, Eis, Compression, Hochlagern), NSAR, Teilbelastung an Gehstöcken, Physiotherapie (Abschwellung & ROM). Aufgrund des jungen Alters, hohen Sportanspruchs (Pivoting-Sportarten) und der begleitenden Innenmeniskusläsion: Arthroskopische VKB-Ersatzplastik (z. B. Semitendinosus-/Quadrizepssehne) + Meniskusnaht.'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt exakten Unfallmechanismus (Valgus-Flexion-Außenrotation), Zerreißgeräusch, rasche Schwellung (Hämarthros) & Giving-way-Phänomen', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Untersucht zuerst die gesunde Gegenseite! Prüft Tanzende Patella, ROM (Neutral-Null), Lachman-Test (Endpunkt!), Valgus-/Varusstress, Meniskuszeichen & pDMS', points: 4 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Benennt V.a. VKB-Ruptur + Innenmeniskus-/MCL-Beteiligung („Unhappy Triad“) und verordnet Röntgen (2 Ebenen) + MRT Knie', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Erklärt Akutmaßnahmen (PECH, Analgesie, Gehstöcke) und Indikation zur arthroskopischen VKB-Plastik + Meniskuserhalt bei sportlich aktivem Patienten', points: 3 }
            ]
        },

        'Gesprächsführung': {
            osce_id: 'REF_COMM_SPIKES',
            specialty: 'Gesprächsführung',
            title: 'Überbringen einer schwerwiegenden Diagnose (Breaking Bad News) nach dem SPIKES-Protokoll',
            source_case_title: 'Referenz-Station Gesprächsführung (SPIKES & NURSE)',
            door_sign: {
                role: 'Sie sind Stationsärztin / Stationsarzt auf der viszeralchirurgisch-onkologischen Abteilung.',
                vignette: 'Frau Sonja Meier (52-jährig) wurde vor 4 Tagen wegen anhaltender Stuhlunregelmäßigkeiten und Gewichtsverlust koloskopiert und mittels CT untersucht. Die Befunde zeigen ein sigmatisches Adenokarzinom mit zwei resektablen Lebermetastasen. Führen Sie das Befundgespräch.',
                tasks: [
                    'Überbringen Sie der Patientin die Diagnose strukturiert und empathisch nach dem SPIKES-Protokoll.',
                    'Gehen Sie mit den Emotionen der Patientin nach dem NURSE-Modell um.',
                    'Besprechen Sie die nächsten Schritte (Vorstellung im interdisziplinären Tumorboard mit kurativem Therapieansatz).'
                ],
                vitals: { bp: '132/84 mmHg', hr: '84/min', rr: '16/min', temp: '36,7 °C', spo2: '99 %', bmi: '21 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Guten Tag... Ich bin schon ganz nervös. Sind die Ergebnisse von der Darmspiegelung und dem CT endlich da? Ist es nur eine Entzündung?“',
                qa_rows: [
                    { topic: 'Vorwissen & Erwartung (Perception)', answer: '„Ich habe gehofft, dass es ein harmloser Polyp oder Reizdarm ist, aber weil Sie auch noch das CT gemacht haben, hatte ich schon ein ungutes Bauchgefühl.“' },
                    { topic: 'Informationsbedürfnis (Invitation)', answer: '„Bitte sagen Sie mir ehrlich, was los ist, aber erklären Sie es mir so, dass ich es verstehe.“' },
                    { topic: 'Reaktion auf den „Warning Shot“ & die Diagnose', answer: '„(Schweigt erst 5 Sekunden geschockt, Tränen in den Augen) Krebs?! Und schon in der Leber? Heißt das, ich muss jetzt sterben?! Meine Tochter macht doch nächstes Jahr Matura...“' },
                    { topic: 'Frage nach Heilungschance & nächstem Schritt', answer: '„Kann man diese Herde in der Leber und im Darm denn noch operieren?“' }
                ],
                behavior: ['Anfangs angespannt-hoffnungsvoll, nach Diagnosemitteilung erst geschockt und weinend, beruhigt sich, wenn empathisch Pausen ausgehalten und Emotionen validiert werden.']
            },
            physical_exam: [
                { area: 'Hinweis zur Station', finding: 'Reine Kommunikations-Station (keine körperliche Untersuchung erforderlich). Fokus liegt zu 100 % auf Gesprächsstruktur (SPIKES) und nonverbaler/verbaler Empathie (NURSE).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'Befunde liegen für das Gespräch bereits vor:',
                labs: [
                    { param: 'CEA (Tumormarker) & Hb', value: 'CEA 18.4 µg/l | Hb 112 g/l', ref: '< 5.0 µg/l | 120–160 g/l', flag: '↑ / ↓' }
                ],
                imaging: [
                    { modality: 'Histologie Koloskopie & Staging-CT Thorax/Abdomen', finding: 'Mäßig differenziertes Adenokarzinom des Sigmas (G2) sowie zwei scharf begrenzte Lebermetastasen im Segment VI (interdisziplinär als potenziell kurativ resektabel eingestuft).' }
                ]
            },
            examiner_info: {
                background: 'Überbringen einer Erstdiagnose Kolonkarzinom mit synchroner, aber resektabler Oligometastasierung der Leber (potenziell kuratives Konzept aus neoadjuvanter Systemtherapie und Resektion).',
                goals: 'SPIKES-Schritte (Setting, Perception, Invitation, Knowledge mit „Warning Shot“, Emotions mit Schweigepause & NURSE, Strategy & Summary) vorbildlich anwenden.',
                differentials: ['Akute Belastungsreaktion', 'Informationsüberflutung nach Schockdiagnose (Cave: nach der Diagnose nur dosierte Häppchen!)'],
                therapy_plan: 'Vorstellung im interdisziplinären Tumorboard morgen, psychoonkologische Mitbetreuung anbieten, Folgetermin gemeinsam mit dem Ehemann/Angehörigen vereinbaren.'
            },
            checklist: [
                { category: 'SPIKES: S, P & I', item: 'Setting geschaffen (Sitzen auf Augenhöhe, Störungsfreiheit), Vorwissen (Perception) und Informationswunsch (Invitation) erfragt', points: 2 },
                { category: 'SPIKES: K (Knowledge)', item: 'Nutzt einen „Warning Shot“ („Leider habe ich keine guten Nachrichten...“), nennt Diagnose klar ohne Fachjargon und lässt danach eine bewusste Schweigepause zu', points: 3 },
                { category: 'SPIKES: E (NURSE-Modell)', item: 'Fängt Emotionen empathisch auf (Naming, Understanding, Respecting, Supporting, Exploring) und gibt keine vorschnellen falschen Beschwichtigungen', points: 3 },
                { category: 'SPIKES: S (Strategy & Summary)', item: 'Vermittelt realistische Hoffnung (Tumorboard, kurativ resektable Leberherde), bietet Psychoonkologie & Folgetermin mit Angehörigen an', points: 3 }
            ]
        },

        'Pädiatrie': {
            osce_id: 'REF_PAED_FIEBERKRAMPF',
            specialty: 'Pädiatrie',
            title: 'Erster tonisch-klonischer Krampfanfall bei Fieber – Unkomplizierter Fieberkrampf vs. Meningitis',
            source_case_title: 'Referenz-Station Pädiatrie (Fieberkrampf, 18 Monate)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt auf der pädiatrischen Notfallstation.',
                vignette: 'Herr/Frau Berger kommt völlig aufgelöst mit dem 18 Monate alten Sohn Leo auf die Notfallstation, nachdem Leo zu Hause bei hohem Fieber plötzlich am ganzen Körper gezuckt habe. Leo schläft aktuell erschöpft auf dem Arm bzw. Untersuchungstisch.',
                tasks: [
                    'Erheben Sie eine präzise Fremdanamnese zum Anfallsereignis (Kriterien einfach vs. kompliziert) und zur Fieberursache.',
                    'Untersuchen Sie das Kind (bzw. Simulationspuppe) fokussiert auf Meningismus und Infektfokus.',
                    'Beruhigen Sie das Elternteil, erklären Sie das Krankheitsbild und instruieren Sie das Notfallmanagement bei einem Rezidiv.'
                ],
                vitals: { bp: '92/58 mmHg', hr: '136/min', rr: '28/min', temp: '39,4 °C (rektal)', spo2: '98 %', bmi: '11.5 kg (50. Perzentile)' }
            },
            sp_script: {
                opening_quote: '„Bitte helfen Sie uns schnell! Leo hatte plötzlich fast 40 Grad Fieber, hat die Augen verdreht, war kurz ganz steif und hat dann mit beiden Armen und Beinen gezuckt! Ich dachte, er stirbt mir unter den Händen weg!“',
                qa_rows: [
                    { topic: 'Exakte Dauer & Symmetrie des Anfalls', answer: '„Es hat etwa 2 bis 3 Minuten gedauert und hat von selbst wieder aufgehört. Beide Körperseiten haben symmetrisch gezuckt.“' },
                    { topic: 'Zustand nach dem Anfall & Wiederholungen', answer: '„Danach war er kurz schläfrig, hat mich aber nach 10 Minuten wieder erkannt und geweint. Es war der einzige Anfall heute.“' },
                    { topic: 'Vorangegangene Infektzeichen', answer: '„Seit gestern Abend Schnupfen, leichter Husten und rasch steigendes Fieber. Er hat aber noch gut getrunken.“' },
                    { topic: 'Entwicklung, Impfstatus & Familienanamnese', answer: '„Altersgerecht entwickelt, alle Impfungen nach Schweizer Impfplan (inkl. Pneumokokken, Meningokokken, MMR). Ich selbst hatte als Kleinkind auch zweimal Fieberkrämpfe!“' }
                ],
                behavior: ['Hochgradig ängstliches Elternteil, hat Angst vor bleibendem Hirnschaden oder Epilepsie.']
            },
            physical_exam: [
                { area: 'Pediatric Assessment Triangle & Neurostatus', finding: 'Kind wach, weint bei Untersuchung, tröstbar durch Elternteil. Kein fokal-neurologisches Defizit, keine Todd-Parese.' },
                { area: 'Meningismus-Prüfung (Nackensteifigkeit, Brudzinski, Kernig)', finding: 'Kopf frei beweglich, kein Meningismus! Fontanelle bereits altersentsprechend geschlossen.' },
                { area: 'HNO-, Lungen- & Hautstatus (Fieberfokus)', finding: 'Pharynx und beide Trommelfelle deutlich gerötet (viraler oberer Atemwegsinfekt / Otitis media acuta). Lunge frei, Haut ohne Petechien.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Kapillärer Blutzucker', value: '5.4 mmol/l', ref: '3.5–6.0 mmol/l', flag: 'Normal (Ausschluss Hypoglykämie)' },
                    { param: 'Hinweis zu Labor / LP / EEG', value: 'Beim klinisch eindeutigen unkomplizierten Fieberkrampf (> 12–18 Mt., kein Meningismus) sind Routinelabor, Lumbalpunktion und EEG NICHT indiziert!', ref: 'Leitlinie', flag: 'Klinische Diagnose' }
                ],
                imaging: [
                    { modality: 'Zerebrale Bildgebung (cMRT/cCT)', finding: 'Nicht indiziert bei unkompliziertem Fieberkrampf ohne fokal-neurologisches Defizit.' }
                ]
            },
            examiner_info: {
                background: 'Klassischer unkomplizierter (einfacher) Fieberkrampf bei einem 18 Monate alten Kleinkind im Rahmen eines viralen Infekts der oberen Atemwege bei positiver Familienanamnese.',
                goals: 'Kriterien des unkomplizierten Fieberkrampfes abfragen (Alter 6 Mt. – 5 J., generalisiert, Dauer < 15 Min., kein Rezidiv innerhalb 24 h, rasche Reorientierung), Meningitis klinisch ausschließen, Eltern empathisch entlasten (kein Hirnschaden, ~30 % Rezidivrisiko, nur ~1–2 % späteres Epilepsierisiko) und Notfallmedikament (Diazepam-Rektiole oder bukkales Midazolam bei Anfall > 3–5 Min.) erklären.',
                differentials: ['Bakterielle Meningitis / Meningoenzephalitis (zwingend auszuschließen!)', 'Komplizierter Fieberkrampf (fokal, > 15 Min. oder mehrfach in 24 h)', 'Erstmanifestation einer Epilepsie / Dravet-Syndrom', ' Elektrolytentgleisung / Hypoglykämie'],
                therapy_plan: 'Antipyrese zur Symptomlinderung (Paracetamol / Ibuprofen gewichtsadaptiert; Hinweis: senkt Fieber, verhindert aber Krämpfe nicht sicher), Aufklärung über stabile Seitenlage, Blick auf die Uhr und Rezeptierung von Diazepam-Rektiole (5 mg) bzw. Midazolam bukkal bei Anfallsdauer > 3–5 Minuten.'
            },
            checklist: [
                { category: 'Anamnese', item: 'Prüft systematisch alle Kriterien für einfachen vs. komplizierten Fieberkrampf (Dauer < 15 Min., generalisiert vs. fokal, einmalig in 24 h, postiktale Erholung)', points: 3 },
                { category: 'Anamnese', item: 'Erfragt Fieberfokus, Impfstatus, Entwicklung und positive Familienanamnese für Fieberkrämpfe', points: 2 },
                { category: 'Klinische Untersuchung', item: 'Prüft gezielt auf Meningismus, Bewusstseinslage, Petechien und HNO-/Lungenfokus', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Erkennt unkomplizierten Fieberkrampf und verzichtet leitliniengerecht auf unnötige LP/EEG/cCT', points: 2 },
                { category: 'Kommunikation & Eltern-Instruktion', item: 'Nimmt den Eltern die Todes-/Hirnschadensangst, nennt Rezidivrisiko (~30 %) und instruiert das Vorgehen beim Rezidiv (Ruhe bewahren, Uhrzeit, Seitenlage, Notfallmedikament ab 3–5 Min.)', points: 3 }
            ]
        },

        'Gynäkologie & Geburtshilfe': {
            osce_id: 'REF_GYN_EUG',
            specialty: 'Gynäkologie & Geburtshilfe',
            title: 'Akuter einseitiger Unterbauchschmerz & Schmierblutung – Rupturierte Extrauteringravidität (EUG)',
            source_case_title: 'Referenz-Station Gynäkologie (Tubargravidität)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt in der gynäkologischen Notfallambulanz.',
                vignette: 'Frau Laura Frei (29-jährig) stellt sich wegen plötzlich aufgetretener starker Schmerzen im rechten Unterbauch und kurzem Schwarzwerden vor den Augen vor.',
                tasks: [
                    'Erheben Sie eine fokussierte gynäkologische und Schmerzanamnese.',
                    'Führen Sie die klinische und gynäkologische Untersuchung (bzw. Ansage) durch.',
                    'Besprechen Sie die Verdachtsdiagnose und das unmittelbare operative Vorgehen mit der Patientin.'
                ],
                vitals: { bp: '98/62 mmHg', hr: '108/min', rr: '18/min', temp: '36,9 °C', spo2: '99 %', bmi: '22 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Vor zwei Stunden hat es mir plötzlich wie mit einem Messer rechts unten in den Bauch gestochen, und beim Aufstehen im Bad bin ich fast ohnmächtig geworden!“',
                qa_rows: [
                    { topic: 'Letzte Periode & Zyklusanamnese', answer: '„Meine letzte reguläre Periode war vor knapp 7 Wochen. Seit gestern habe ich eine leichte bräunliche Schmierblutung.“' },
                    { topic: 'Verhütung & Schwangerschaftstest', answer: '„Wir haben einen Kinderwunsch und verhüten seit 6 Monaten nicht mehr. Einen Test habe ich noch nicht gemacht.“' },
                    { topic: 'Schmerzausstrahlung (Schulterschmerz!)', answer: '„Starke Schmerzen im rechten Unterbauch (NRS 8/10), und im Liegen zieht es komischerweise bis in meine rechte Schulter (Kehr-Zeichen durch Zwerchfellreizung).“' },
                    { topic: 'Gynäkologische Vorgeschichte (Risikofaktoren)', answer: '„Vor 3 Jahren hatte ich eine Chlamydien-bedingte Eileiterentzündung (Adnexitis).“' }
                ],
                behavior: ['Blass, schmerzgeplagt, gleichzeitig hoffnungsvoll bezüglich einer möglichen Schwangerschaft.']
            },
            physical_exam: [
                { area: 'Abdomen-Palpation', finding: 'Deutlicher Druck- und Loslassschmerz im rechten Unterbauch mit lokalem Peritonismus.' },
                { area: 'Gynäkologische Untersuchung (Spekulum & bimanuelle Palpation)', finding: 'Dunkle Schmierblutung aus dem Zervikalkanal, Uterus leicht aufgelockert, ausgeprägter Portioschiebeschmerz und teigige Druckdolenz in der rechten Adnexregion.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Urin-hCG & Serum-beta-hCG', value: 'Positiv | beta-hCG 3.850 IU/l', ref: '< 5 IU/l (nicht schwanger)', flag: '↑↑ (Schwangerschaft nachgewiesen!)' },
                    { param: 'Hämoglobin (Hb) & Blutgruppe/Rhesus', value: 'Hb 102 g/l | Blutgruppe A Rh-negativ!', ref: '120–160 g/l', flag: '↓ Hb-Abfall + Rhesus-Prophylaxe beachten!' }
                ],
                imaging: [
                    { modality: 'Transvaginale Sonographie (TVS)', finding: 'Cavum uteri leer („leerer Uterus“ bei beta-hCG > 1500 IU/l!), hochaufgebautes Endometrium, in der rechten Tube ringförmige Struktur („Bagel-Sign“) sowie reichlich echoreiche freie Flüssigkeit (Hämatoperitoneum) im Douglas-Raum.' }
                ]
            },
            examiner_info: {
                background: 'Rupturierte Tubargravidität (Extrauteringravidität, 7. SSW) rechts mit Hämatoperitoneum und beginnender hämodynamischer Instabilität nach früherer Chlamydien-Adnexitis.',
                goals: 'Klassische Trias (sekundäre Amenorrhoe ~6–8 SSW + Schmierblutung + einseitiger Unterbauchschmerz/Portioschiebeschmerz) erkennen, beta-hCG + transvaginalen Ultraschall anfordern, Notfall-Laparoskopie und Anti-D-Prophylaxe (bei Rh-negativ!) einleiten.',
                differentials: ['Rupturierte Ovarialzyste / Corpus-luteum-Blutung', 'Ovarialtorsion', 'Akute Appendizitis', 'Abortus imminens / incompletus'],
                therapy_plan: 'Sofortige Volumengabe (2 großlumige Zugänge), Bereitstellung von Erythrozytenkonzentraten, dringliche operative Laparoskopie (Salpingotomie vs. Salpingektomie je nach Tubenschaden) sowie zwingend Anti-D-Immunglobulin (Rhesus-Prophylaxe bei Rh-negativer Patientin!).'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt exakt den ersten Tag der letzten Periode (Amenorrhoe!), Verhütung, vaginale Blutung und Risikofaktoren (Adnexitis/Chlamydien)', points: 3 },
                { category: 'Klinische Untersuchung', item: 'Untersucht Abdomen und führt Spekulum- sowie bimanuelle Tastuntersuchung durch (Portioschiebeschmerz!)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Fordert sofort Schwangerschaftstest (beta-hCG), Hb, Blutgruppe/Rhesusfaktor und transvaginalen Ultraschall (TVS) an', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Stellt Diagnose „Rupturierte Extrauteringravidität“, indiziert Notfall-Laparoskopie und denkt an die Rhesus-Prophylaxe (Anti-D)', points: 3 },
                { category: 'Kommunikation', item: 'Überbringt die Nachricht des Schwangerschaftsverlustes bei gleichzeitigem Notfall einfühlsam und klar', points: 2 }
            ]
        },

        'Palliativ Care': {
            osce_id: 'REF_PALL_OPIOID',
            specialty: 'Palliativ Care',
            title: 'Tumorschmerz-Exazerbation & Opioid-Nebenwirkungen – Ganzheitliches Total-Pain-Management',
            source_case_title: 'Referenz-Station Palliativ Care (Schmerztherapie & Bedarfsmedikation)',
            door_sign: {
                role: 'Sie sind Stationsärztin / Stationsarzt auf der Palliativstation.',
                vignette: 'Herr Hanspeter Vogt (74-jährig) mit ossär metastasiertem Prostatakarzinom stellt sich wegen zunehmender Rückenschmerzen und hartnäckiger Verstopfung unter seiner bisherigen Morphin-Therapie vor.',
                tasks: [
                    'Erheben Sie eine differenzierte palliativmedizinische Schmerz- und Symptomanamnese (inkl. „Total Pain“-Dimensionen).',
                    'Prüfen Sie die aktuelle Opioid-Dosierung (Basis- und Durchbruchschmerzmedikation) sowie Begleitmedikamente.',
                    'Passen Sie das Therapieschema an und besprechen Sie es verständlich mit dem Patienten.'
                ],
                vitals: { bp: '128/76 mmHg', hr: '78/min', rr: '15/min', temp: '36,6 °C', spo2: '97 %', bmi: '21 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Die Schmerzen in der Lendenwirbelsäule sind in den letzten Tagen wieder auf 7 von 10 gestiegen, und außerdem konnte ich seit 5 Tagen überhaupt nicht mehr auf die Toilette...“',
                qa_rows: [
                    { topic: 'Schmerzcharakter (nozizeptiv vs. neuropathisch)', answer: '„Ein tiefer, bohrender Dauerschmerz im unteren Rücken, und bei Bewegung schießt es manchmal brennend bis ins rechte Bein ein.“' },
                    { topic: 'Aktuelle Medikation', answer: '„Morphin retard 30 mg morgens und 30 mg abends (Tagesdosis 60 mg p.o.). Als Reserve habe ich nur Paracetamol-Tabletten, kein schnellwirksames Morphin und kein Abführmittel!“' },
                    { topic: 'Psychosoziale & spirituelle Sorge (Total Pain)', answer: '„Ich habe große Angst, dass ich am Ende unter unerträglichen Schmerzen im Pflegeheim lande und meiner Frau zur Last falle.“' }
                ],
                behavior: ['Erschöpft, bewegt sich vorsichtig, dankbar für aufmerksames Zuhören.']
            },
            physical_exam: [
                { area: 'Wirbelsäule & Neurostatus', finding: 'Klopfschmerz über LWK 3/4, Kraft und Kontinenz erhalten (kein akutes Kauda-Syndrom!).' },
                { area: 'Abdomen', finding: 'Verhärtete Stuhlwalze im linken Unterbauch tastbar (Opioid-induzierte Obstipation), Darmgeräusche spärlich.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Kreatinin / eGFR & Kalzium (albumin-korrigiert)', value: 'eGFR 42 ml/min | Kalzium 2.52 mmol/l', ref: '> 60 ml/min | 2.15–2.55 mmol/l', flag: 'Moderates CKD (Cave: aktive Morphin-Metabolite bei schwerer Niereninsuffizienz!)' }
                ],
                imaging: [
                    { modality: 'Vorbekanntes Wirbelsäulen-MRT', finding: 'Osteoplastische Metastase LWK 4 ohne relevante Spinalkanalkompression (für analgetische Radiotherapie geeignet).' }
                ]
            },
            examiner_info: {
                background: 'Unzureichend eingestellter gemischter Tumorschmerz (nozizeptiv-ossär + neuropathisch) bei ossär metastasiertem Prostatakarzinom sowie unbehandelte Opioid-induzierte Obstipation (OIC) und fehlende schnellwirksame Opioid-Bedarfsmedikation.',
                goals: '1/6-Regel für Durchbruchschmerz berechnen (bei 60 mg Tagesdosis = 10 mg unretardiertes Morphin p.o.; nach Dosissteigerung auf z.B. 90 mg/d = 15 mg Bedarfsdosis), obligate Laxanzien-Prophylaxe (Macrogol), Ko-Analgetikum (Pregabalin/Dexamethason/Bisphosphonat) und analgetische lokale Radiotherapie einplanen.',
                differentials: ['Malignes Myelonkompressionssyndrom (Red Flag: Paresen/Blasenstörung ausschließen!)', 'Hyperkalzämie-Syndrom bei Knochenmetastasen'],
                therapy_plan: '1. Retard-Opioid um 30–50 % erhöhen (oder Rotation auf Hydromorphon wegen eingeschränkter eGFR), 2. Schnellwirksames Opioid für Durchbruchschmerzen fest verordnen (1/6 der Tagesdosis!), 3. Fixe Laxanzien-Therapie (Macrogol + ggf. Klysma/PAMORA), 4. Ko-Analgetikum gegen neuropathische Komponente (Pregabalin) + lokale Schmerzbestrahlung LWK 4.'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt Schmerzqualitäten (ossär + neuropathisch), prüft Red Flags (Kauda/Querschnitt) und exploriert psychosoziale Ängste („Total Pain“)', points: 3 },
                { category: 'Pharmakologie & Therapie', item: 'Erkennt die zwei Medikationsfehler: Fehlende unretardierte Opioid-Reserve (1/6 der Tagesdosis) und fehlende obligate Laxanzien-Gabe', points: 3 },
                { category: 'Pharmakologie & Therapie', item: 'Passt Basis-Opioid an (bzw. erwägt Hydromorphon bei Niereninsuffizienz), ergänzt Ko-Analgetikum (Pregabalin) & lokale Radiotherapie', points: 3 },
                { category: 'Kommunikation', item: 'Geht empathisch auf die Angst vor Autonomieverlust ein und bietet ambulante Palliativversorgung (Spitex/SAPV) & Patientenverfügung an', points: 2 }
            ]
        },

        'HNO': {
            osce_id: 'REF_HNO_MENIERE',
            specialty: 'HNO',
            title: 'Anfallsartiger Drehschwindel, Tinnitus & Hörminderung – Morbus Menière vs. Neuritis vestibularis',
            source_case_title: 'Referenz-Station HNO (Akuter Schwindel & HINTS)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt in der HNO-Notfallambulanz.',
                vignette: 'Frau Claudia Studer (46-jährig) stellt sich wegen einer seit 2 Stunden bestehenden heftigen Drehschwindelattacke mit Ohrgeräusch rechts vor.',
                tasks: [
                    'Erheben Sie eine gezielte neuro-otologische Schwindelanamnese.',
                    'Führen Sie die HNO- und Gleichgewichtsuntersuchung (Otoskopie, Weber/Rinne, Nystagmus, HINTS) durch.',
                    'Besprechen Sie Ihre Verdachtsdiagnose sowie die Akut- und Intervalltherapie.'
                ],
                vitals: { bp: '134/82 mmHg', hr: '84/min', rr: '16/min', temp: '36,6 °C', spo2: '99 %', bmi: '23 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Alles dreht sich wie in einem Karussell! Auf meinem rechten Ohr rauscht es ganz tief, es fühlt sich wie verstopft an und ich höre rechts plötzlich viel dumpfer!“',
                qa_rows: [
                    { topic: 'Dauer & frühere Attacken', answer: '„Jetzt seit 2 Stunden. Vor 4 Monaten hatte ich schon einmal so eine Attacke, die nach etwa 3 Stunden wieder vorbei war.“' },
                    { topic: 'Ohrsymptome (Trias)', answer: '„Starkes Druck-/Völlegefühl im rechten Ohr, tiefer rauschender Tinnitus rechts und Hörminderung rechts während des Anfalls.“' },
                    { topic: 'Neurologische Red Flags (Doppelbilder, Schluck-/Sprachstörung)', answer: '„Nein, keine Doppelbilder, kein Taubheitsgefühl im Gesicht, keine Lähmungen.“' }
                ],
                behavior: ['Hält sich am Stuhl fest, Übelkeit bei schnellen Kopfbewegungen.']
            },
            physical_exam: [
                { area: 'Otoskopie beidseits', finding: 'Gehörgang und Trommelfell beidseits völlig reizlos, kein Herpes zoster oticus.' },
                { area: 'Stimmgabelversuche nach Weber & Rinne (512 Hz)', finding: 'Weber lateralisiert nach LINKS (in das gesunde Ohr!); Rinne beidseits positiv → Rechtsseitige Schallempfindungsschwerhörigkeit!' },
                { area: 'Spontannystagmus (Frenzelbrille) & HINTS', finding: 'Horizontal-rotatorischer Spontannystagmus (initial Reiznystagmus nach rechts, im Verlauf Ausfallnystagmus nach links). Keine vertikale Skew Deviation, HINTS spricht gegen zentralen Hirnstamm-/Kleinhirninsult.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Routinelabor', value: 'Unauffällig', ref: 'Normbereich', flag: 'Normal' }
                ],
                imaging: [
                    { modality: 'Reintonaudiogramm (Tonschwellenaudiometrie)', finding: 'Rechtsseitige cochleäre Schallempfindungsschwerhörigkeit im Tieftonbereich (250–1000 Hz) um 45 dB.' }
                ]
            },
            examiner_info: {
                background: 'Klassischer Morbus Menière rechts (endolymphatischer Hydrops) mit der pathognomonischen Menière-Trias.',
                goals: 'Menière-Trias (Drehschwindelattacken 20 Min. bis 12 h + fluktuierende Tiefton-Schallempfindungsschwerhörigkeit + Tinnitus/Ohrdruckgefühl) erkennen, Weber/Rinne korrekt interpretieren und zentralen Schwindel (AICA-/PICA-Infarkt) sowie BPLS/Neuritis vestibularis abgrenzen.',
                differentials: ['Neuritis vestibularis (Dauerschwindel > 24 h OHNE Hörverlust!)', 'Benigner paroxysmaler Lagerungsschwindel (BPLS – Sekunden-Attacken ohne Hörverlust)', 'Kleinhirn-/Hirnstamminfarkt (AICA-Infarkt kann ebenfalls Innenohr + Kleinhirn betreffen!)', 'Vestibularisschwannom (Akustikusneurinom)'],
                therapy_plan: 'Akut im Anfall: Antivertiginosa/Antiemetika (Dimenhydrinat oder Ondansetron). Anfallsprophylaxe im Intervall: Betahistin hochdosiert, salzarme Kost, ggf. intratympanale Glukokortikoid-Injektion.'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt gezielt die Menière-Trias (Attackendauer 20 Min.–12 h, Tiefton-Hörminderung, Tinnitus/Ohrdruck) & zentrale Red Flags', points: 3 },
                { category: 'Klinische Untersuchung', item: 'Führt Otoskopie, Weber- und Rinne-Stimmgabeltest (korrekte Interpretation: Innenohrschwerhörigkeit rechts!) sowie Nystagmus/HINTS-Prüfung durch', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Stellt Diagnose „Morbus Menière“, fordert Tonschwellenaudiogramm (Tieftonsenke!) an und grenzt BPLS & Neuritis vestibularis ab', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Nennt Akuttherapie (Antivertiginosa) und Intervallprophylaxe (Betahistin / intratympanale Therapie)', points: 2 }
            ]
        },

        'Pneumologie': {
            osce_id: 'REF_PNEUMO_LE',
            specialty: 'Pneumologie',
            title: 'Akute Dyspnoe & atemabhängiger Thoraxschmerz nach Langstreckenflug – Lungenarterienembolie',
            source_case_title: 'Referenz-Station Pneumologie (Lungenembolie & Wells-Score)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt auf der Notfallstation.',
                vignette: 'Frau Karin Bieri (49-jährig) stellt sich wegen seit heute Morgen bestehender akuter Atemnot und stechenden Schmerzen im rechten Brustkorb beim Einatmen vor.',
                tasks: [
                    'Erheben Sie eine fokussierte Anamnese (inkl. Risikofaktoren zur Bestimmung des Wells-Scores).',
                    'Führen Sie eine strukturierte kardiopulmonale und vaskuläre Untersuchung durch.',
                    'Besprechen Sie Ihren diagnostischen Algorithmus und die Antikoagulation.'
                ],
                vitals: { bp: '118/76 mmHg', hr: '108/min (tachykard)', rr: '24/min', temp: '37,3 °C', spo2: '91 % (Raumluft)', bmi: '27 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Ich bekomme seit heute Morgen kaum noch Luft, mein Herz rast und jedes Mal, wenn ich tief einatme, sticht es rechts in der Brust!“',
                qa_rows: [
                    { topic: 'Reiseanamnese & Immobilisation', answer: '„Ich bin gestern Nachmittag von einem 12-Stunden-Flug aus Costa Rica zurückgekommen.“' },
                    { topic: 'Beinschmerzen / Schwellung (TVT-Zeichen)', answer: '„Ja, meine linke Wade zieht schon seit zwei Tagen und ist etwas dicker als die rechte.“' },
                    { topic: 'Husten / Hämoptysen / Synkope', answer: '„Trockener Reizhusten, kein blutiger Auswurf, nicht ohnmächtig geworden.“' },
                    { topic: 'Medikation & Hormonpräparate', answer: '„Ich nehme ein kombiniertes Östrogen-Gestagen-Präparat.“' }
                ],
                behavior: ['Tachypnoeisch, spricht in kürzeren Sätzen, ängstlich.']
            },
            physical_exam: [
                { area: 'Lunge & Herz', finding: 'Vesikuläratmen beidseits ohne feuchte RG, leises Pleurareiben rechts basal. Tachykardie (108/min), Herztöne rein.' },
                { area: 'Untere Extremitäten (Seitenvergleich)', finding: 'Linke Wade +3.5 cm Umfangsdifferenz gegenüber rechts, prall-elastisch, Druckschmerz entlang des tiefen Venensystems.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Arterielle BGA (Raumluft)', value: 'pO₂ 61 mmHg | pCO₂ 31 mmHg | pH 7.46', ref: 'pO₂ > 75 | pCO₂ 35–45 mmHg', flag: '⚠️ Hypoxämie + Hypokapnie (Hyperventilation!)' },
                    { param: 'D-Dimere & hs-Troponin T', value: 'D-Dimere 3.8 mg/l | Troponin T 28 ng/l', ref: '< 0.5 mg/l | < 14 ng/l', flag: '↑↑ (Hohe Vortestwahrscheinlichkeit + leichte RV-Belastung)' },
                    { param: 'Kreatinin / eGFR', value: '69 µmol/l (eGFR > 90 ml/min)', ref: '45–84 µmol/l', flag: 'Normal (CT-KM problemlos möglich)' }
                ],
                imaging: [
                    { modality: '12-Kanal-EKG', finding: 'Sinustachykardie (108/min), SI-QIII-Typ, inkompletter Rechtsschenkelblock, T-Negativierungen in V1–V3.' },
                    { modality: 'CT-Pulmonalisangiographie (CTPA)', finding: 'Zentraler Reitthrombus in der rechten Pulmonalarterie mit Ausdehnung in die Unterlappenarterien sowie beginnende Rechtsherzdilatation (RV/LV-Ratio 1.1).' }
                ]
            },
            examiner_info: {
                background: 'Akute Lungenarterienembolie (intermediär-hohes Risiko, sPESI ≥ 1, positive RV-Belastung) bei tiefer Beinvenenthrombose links nach Langstreckenflug unter Östrogentherapie.',
                goals: 'Wells-Score berechnen (klinische TVT-Zeichen +3, LE wahrscheinlichste Diagnose +3, HF > 100 +1.5 = 7.5 Punkte → hohe Wahrscheinlichkeit!), sofortige Antikoagulation + CTPA einleiten.',
                differentials: ['Akutes Koronarsyndrom (ACS)', 'Spontaner Pneumothorax', 'Pleuropneumonie', 'Aortendissektion'],
                therapy_plan: '1. Sauerstoffgabe (Ziel-SpO₂ > 94 %), 2. Sofortige therapeutische Antikoagulation (NMH s.c. / UFH i.v. oder direkt DOAK wie Apixaban/Rivaroxaban), 3. Überwachung auf IMC wegen RV-Belastung, 4. Kompressionssonographie Beinvenen & Absetzen des Östrogenpräparats.'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt systematisch die Wells-Score-Kriterien (TVT-Symptome, Immobilisation/Langstreckenflug, Hämoptysen, Malignom, Hormone)', points: 3 },
                { category: 'Klinische Untersuchung', item: 'Auskultiert Lunge/Herz und untersucht zwingend beide Beine im Seitenvergleich (Umfangsdifferenz Wade links!)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Berechnet hohe Vortestwahrscheinlichkeit (Wells-Score), fordert BGA, EKG, Troponin/NT-proBNP und direkt CT-Pulmonalisangiographie (CTPA) an', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Leitet Sauerstoffgabe, Überwachung und sofortige therapeutische Antikoagulation für mind. 3–6 Monate ein', points: 3 }
            ]
        },

        'Innere Medizin': {
            osce_id: 'REF_INNERE_LYMPHOM',
            specialty: 'Innere Medizin',
            title: 'Schmerzlose Lymphknotenschwellung & B-Symptomatik – Malignes Lymphom (Hodgkin-Lymphom)',
            source_case_title: 'Referenz-Station Innere Medizin / Hämatologie (Lymphadenopathie)',
            door_sign: {
                role: 'Sie sind Unterassistentin / Unterassistent in der internistischen Poliklinik.',
                vignette: 'Herr Fabian Berger (32-jährig) stellt sich wegen eines seit 6 Wochen wachsenden Knotens am linken Hals und starkem nächtlichem Schwitzen vor.',
                tasks: [
                    'Führen Sie eine gezielte hämatologisch-internistische Anamnese (inkl. B-Symptomatik) durch.',
                    'Führen Sie einen kompletten Lymphknotenstatus sowie eine Untersuchung von Leber und Milz durch.',
                    'Besprechen Sie Ihre Verdachtsdiagnose und den diagnostischen Goldstandard (Exzisionsbiopsie vs. Feinnadelpunktion).'
                ],
                vitals: { bp: '120/74 mmHg', hr: '82/min', rr: '14/min', temp: '37,9 °C', spo2: '99 %', bmi: '21,5 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Vor sechs Wochen habe ich beim Rasieren diesen Knoten links am Hals bemerkt. Er tut zwar überhaupt nicht weh, wird aber immer größer, und nachts schwitze ich mein ganzes Bett durch.“',
                qa_rows: [
                    { topic: 'B-Symptomatik (Fieber, Nachtschweiß, Gewichtsverlust)', answer: '„Ja, ich muss nachts das Pyjama wechseln, habe in 4 Monaten ungewollt 7 kg abgenommen (von 76 auf 69 kg) und habe abends oft um 38,2 °C Temperatur.“' },
                    { topic: 'Alkoholschmerz & Pruritus', answer: '„Wenn ich am Wochenende ein Bier trinke, zieht und schmerzt der Knoten am Hals plötzlich stark! Außerdem juckt meine Haut am ganzen Körper.“' },
                    { topic: 'Infektzeichen / Katzenkontakt / Reisen', answer: '„Keine Halsschmerzen, kein Zahninfekt, keine Katzen zu Hause.“' }
                ],
                behavior: ['Junger Patient, blass, macht sich Sorgen wegen der raschen Gewichtsabnahme.']
            },
            physical_exam: [
                { area: 'Lymphknotenstatus (zervikal, supraklavikulär, axillär, inguinal)', finding: 'Links zervikal und supraklavikulär derbes, indolentes, verbackenes („radiergummiartiges“) Lymphknotenpaket von 3.5 cm Durchmesser. Axillär und inguinal unauffällig.' },
                { area: 'Abdomen (Leber & Milz)', finding: 'Milz leicht vergrößert unter dem linken Rippenbogen palpabel (Splenomegalie), Leber unauffällig.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Differenzialblutbild & BSG', value: 'Hb 114 g/l | Eosinophilie 8 % | Lymphopenie | BSG 68 mm/h', ref: 'Hb 135–175 g/l | BSG < 15 mm/h', flag: '↑ BSG, normozytäre Anämie' },
                    { param: 'LDH (Laktatdehydrogenase)', value: '410 U/l', ref: '135–225 U/l', flag: '↑ (Erhöhter Zellumsatz)' },
                    { param: 'EBV- / HIV- / Toxoplasmose-Serologie', value: 'HIV negativ, EBV-IgG positiv (abgelaufene Infektion)', ref: 'Negativ', flag: 'Ausschluss akute Mononukleose' }
                ],
                imaging: [
                    { modality: 'Röntgen-Thorax & PET-CT (Staging nach Ann Arbor)', finding: 'Mediastinalverbreiterung (Bulk) sowie FDG-avide Lymphome zervikal, supraklavikulär links, mediastinal und Milzbefall (Ann-Arbor-Stadium IIIB).' },
                    { modality: 'Histologie nach kompletter LK-Exzision (Goldstandard!)', finding: 'Nachweis von mehrkernigen Reed-Sternberg-Riesen- und einkernigen Hodgkin-Zellen (CD30+, CD15+) → Klassisches Hodgkin-Lymphom.' }
                ]
            },
            examiner_info: {
                background: 'Klassisches Hodgkin-Lymphom (Stadium IIIB nach Ann Arbor) mit typischer B-Symptomatik, Alkoholschmerz, Pruritus und derbem, indolentem zervikalem/supraklavikulärem LK-Paket.',
                goals: 'Kriterien der B-Symptomatik exakt abfragen (Fieber > 38 °C, drenching Nachtschweiß mit Wäschewechsel, Gewichtsverlust > 10 % in 6 Monaten), kompletten LK- und Milzstatus erheben und zwingend eine komplette Lymphknoten-Exzisionsbiopsie (KEINE alleinige Feinnadelpunktion, da Architekturbeurteilung nötig!) + PET-CT veranlassen.',
                differentials: ['Non-Hodgkin-Lymphom (NHL)', 'Infektiöse Mononukleose (EBV) / CMV / Toxoplasmose', 'Sarkoidose / Tuberkulose', 'Metastase eines Kopf-Hals-Tumors'],
                therapy_plan: 'Komplette diagnostische Lymphknoten-Exzision, Staging mittels PET-CT, Fertilitätsberatung (Kryokonservierung vor Chemotherapie bei 32-jährigem Patienten!) und stadiengerechte Polychemotherapie (z. B. ABVD oder BrECADD) mit exzellenter Heilungsprognose (> 85–90 %).'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt exakt die 3 B-Symptome (inkl. 10-%-Gewichtsgrenze & Wäschewechsel), Alkoholschmerz, Pruritus und Infektquellen', points: 3 },
                { category: 'Klinische Untersuchung', item: 'Palpiert alle Lymphknotenstationen systematisch (Größe, Konsistenz, Verschieblichkeit, Dolenz) sowie Leber und Milz', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Stellt V.a. Hodgkin-Lymphom und fordert zwingend eine komplette Lymphknoten-Exzision (begründet, warum FNP nicht ausreicht!) + PET-CT an', points: 3 },
                { category: 'Kommunikation', item: 'Erwähnt die sehr gute Heilbarkeit des Hodgkin-Lymphoms und denkt an die Fertilitätserhaltung (Kryokonservierung) vor Therapiebeginn', points: 2 }
            ]
        },

        'Psychiatrie': {
            osce_id: 'REF_PSYCH_DEPRESSION',
            specialty: 'Psychiatrie',
            title: 'Schwere depressive Episode & strukturierte Suizidalitäts-Exploration (AMDP-Befund)',
            source_case_title: 'Referenz-Station Psychiatrie (Depression & Suizidalität)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt in der psychiatrischen Notfallambulanz.',
                vignette: 'Herr Michael Hofmann (41-jährig, Architekt) wird von seiner Ehefrau gebracht, da er seit Wochen kaum noch das Bett verlässt, nicht mehr zur Arbeit geht und gestern geäußert habe, „dass alles keinen Sinn mehr habe“.',
                tasks: [
                    'Erheben Sie eine strukturierte psychiatrische Anamnese (Haupt- und Zusatzkriterien nach ICD-10/11) sowie den psychopathologischen Befund (AMDP).',
                    'Führen Sie eine direkte, unmissverständliche Exploration der akuten Suizidalität durch.',
                    'Besprechen Sie die Diagnose und das sichere therapeutische Setting.'
                ],
                vitals: { bp: '118/74 mmHg', hr: '68/min', rr: '14/min', temp: '36,6 °C', spo2: '99 %', bmi: '20 kg/m²' }
            },
            sp_script: {
                opening_quote: '„(Blickt zu Boden, spricht leise und verlangsamt) Meine Frau wollte unbedingt, dass ich herkomme... Aber ehrlich gesagt kann mir sowieso niemand mehr helfen. Ich bin nur noch ein Klotz am Bein für alle.“',
                qa_rows: [
                    { topic: 'Stimmung, Antrieb & Freudfähigkeit (3 Hauptkriterien)', answer: '„Seit 6 Wochen ist alles komplett leer und grau. Ich fühle gar nichts mehr („Gefühl der Gefühllosigkeit“), schaffe es morgens kaum unter die Dusche und kann mich nicht einmal mehr über meine Kinder freuen.“' },
                    { topic: 'Schlaf, Morgentief & Appetit (Somatisches Syndrom)', answer: '„Ich wache jeden Tag um 3 Uhr nachts auf und grüble stundenlang. Morgens ist es am allerschlimmsten. Ich habe 5 kg abgenommen.“' },
                    { topic: 'Schuldgefühle & Selbstwert', answer: '„Ich habe im Büro ein Projekt verzögert – ich bin ein kompletter Versager und ruiniere meine Familie.“' },
                    { topic: 'Suizidalität (Gedanken, Pläne, Vorbereitung, Distanzierungsfähigkeit)', answer: '„(Wenn direkt gefragt wird:) Ja, ich denke jeden Tag daran, dass es besser wäre, nicht mehr aufzuwachen. Vor zwei Tagen stand ich auf der Brücke und habe hinuntergeschaut. Einen Abschiedsbrief habe ich noch nicht geschrieben, aber allein zu Hause kann ich heute nicht versprechen, dass ich mir nichts antue.“' },
                    { topic: 'Frühere manische Episoden & Substanzkonsum', answer: '„Noch nie Phasen von übersteigertem Antrieb gehabt (Ausschluss Bipolar). Kein Alkohol- oder Drogenmissbrauch.“' }
                ],
                behavior: ['Psychomotorisch gehemmt, leise Stimme, langer Antwortlatenz, verarmte Mimik, weint nicht, wirkt hoffnungslos.']
            },
            physical_exam: [
                { area: 'Psychopathologischer Befund nach AMDP', finding: 'Wach, allseits orientiert. Auffassung und Konzentration reduziert, formales Denken verlangsamt und eingeengt auf Insuffizienz-/Schuldthemen (kein Wahn). Affekt: tiefgedrückt, Gefühl der Gefühllosigkeit, affektstarr. Antrieb schwer gehemmt, zirkadianes Morgentief, Früherwachen. Akute, drängende Suizidgedanken ohne sichere Absprachefähigkeit.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage (Ausschluss organischer Ursachen):',
                labs: [
                    { param: 'TSH basal, Blutbild, Elektrolyte, B12, Leber/Niere', value: 'TSH 1.9 mU/l | Hb 142 g/l | B12 380 pmol/l', ref: 'Normbereich', flag: 'Normal (Ausschluss Hypothyreose)' }
                ],
                imaging: [
                    { modality: 'cMRT & EKG (vor Antidepressiva-Einstellung)', finding: 'cMRT unauffällig (bei Erstmanifestation empfohlen). EKG: Sinusrhythmus, QTc 410 ms (normal).' }
                ]
            },
            examiner_info: {
                background: 'Schwere depressive Episode ohne psychotische Symptome (ICD-10 F32.2) mit somatischem Syndrom und akuter Suizidalität (fehlende Absprache-/Distanzierungsfähigkeit).',
                goals: 'Alle 3 Hauptkriterien (gedrückte Stimmung, Interessenverlust/Anhedonie, Antriebsminderung > 2 Wochen) und Zusatzkriterien abfragen, Suizidalität offen und direkt explorieren (Gedanken → konkrete Pläne → Handlungsimpulse → Bündnisfähigkeit) und sofortige stationäre Aufnahme einleiten.',
                differentials: ['Bipolare affektive Störung (immer nach früheren Manien/Hypomanien fragen!)', 'Hypothyreose / organische depressive Störung', 'Schwere Anpassungsstörung'],
                therapy_plan: 'Aufgrund akuter Suizidalität ohne sichere Distanzierungsfähigkeit: Sofortige stationäre Aufnahme auf geschützter/offener Akutstation (primär auf freiwilliger Basis anstreben, sonst fürsorgerische Unterbringung / FU prüfen), engmaschige Begleitung, Beginn einer kombinierten Pharmako- (z. B. SSRI wie Escitalopram oder Mirtazapin bei Schlafstörung, initial ggf. kurzzeitig Lorazepam gegen quälende Agitation/Suiziddruck) und Psychotherapie (KVT).'
            },
            checklist: [
                { category: 'Anamnese & AMDP', item: 'Erfragt die 3 ICD-Hauptkriterien (> 2 Wochen) sowie Zusatzkriterien/somatisches Syndrom (Früherwachen, Morgentief, Schuldgefühle, Appetitverlust) & schließt Manie/Substanzkonsum aus', points: 3 },
                { category: 'Suizidalitäts-Exploration', item: 'Spricht Suizidalität direkt und ohne Tabuisierung an (passive Todeswünsche → konkrete Pläne/Methode → Vorbereitungen → aktuelle Distanzierungsfähigkeit)', points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Stellt Diagnose „Schwere depressive Episode mit akuter Suizidalität“, veranlasst organisches Ausschlusslabor (TSH!) + EKG (QTc)', points: 2 },
                { category: 'Verdachtsdiagnose & Procedere', item: 'Erkennt die zwingende Indikation zur sofortigen stationären Aufnahme (Schutz vor Selbstgefährdung) und motiviert den Patienten empathisch zur stationären Behandlung', points: 3 }
            ]
        },

        'Kardiologie': {
            osce_id: 'REF_KARDIO_STEMI',
            specialty: 'Kardiologie',
            title: 'Retrosternaler Vernichtungsschmerz & ST-Hebungen in II, III, aVF – Akuter Hinterwand-STEMI',
            source_case_title: 'Referenz-Station Kardiologie (ACS / Hinterwand-STEMI)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt in der Chest Pain Unit / Notfallstation.',
                vignette: 'Herr Werner Arnold (64-jährig) wird wegen eines seit 45 Minuten anhaltenden, drückenden Brustschmerzes mit Ausstrahlung in den Unterkiefer vorgestellt.',
                tasks: [
                    'Erheben Sie eine fokussierte kardiologische Notfallanamnese (inkl. Differentialdiagnosen des akuten Thoraxschmerzes).',
                    'Führen Sie eine gezielte kardiopulmonale Untersuchung durch und befunden Sie das 12-Kanal-EKG.',
                    'Leiten Sie das sofortige STEMI-Management ein (achten Sie auf spezifische Kontraindikationen beim Hinterwandinfarkt!).'
                ],
                vitals: { bp: '96/60 mmHg', hr: '52/min (Sinusbradykardie)', rr: '20/min', temp: '36,5 °C', spo2: '95 % (Raumluft)', bmi: '28 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Mir sitzt seit einer Dreiviertelstunde ein Elefant mitten auf der Brust! Es zieht bis in den Hals und den linken Arm, und mir läuft der kalte Schweiß herunter.“',
                qa_rows: [
                    { topic: 'Schmerzcharakter & Beginn', answer: '„Beim Schneeschaufeln plötzlich begonnen, dumpf-drückend, einschnürend (NRS 8/10), wird in Ruhe nicht besser. Nicht atemabhängig, nicht reißend zwischen den Schulterblättern.“' },
                    { topic: 'Kardiovaskuläre Risikofaktoren', answer: '„Raucher (40 Pack Years), Bluthochdruck, hohes Cholesterin, mein Vater hatte mit 58 Jahren einen Herzinfarkt.“' },
                    { topic: 'Medikation & PDE-5-Hemmer', answer: '„Amlodipin 5 mg. Vor 12 Stunden habe ich Sildenafil (Viagra) eingenommen.“' }
                ],
                behavior: ['Kaltschweißig, blass, hält die geballte Faust vor das Brustbein (Levine-Zeichen), Todesangst.']
            },
            physical_exam: [
                { area: 'Herz, Lunge & Halsvenen', finding: 'Herztöne rein, bradykard (52/min). Lunge beidseits frei (keine feuchten RG!). Deutliche Jugularvenenstauung im 45°-Oberkörperhochlagerung!' },
                { area: 'Pulsstatus (Seitenvergleich)', finding: 'Radialispulse bds. symmetrisch (kein Pulsdefizit, keine Blutdruckdifferenz > 20 mmHg → spricht gegen Aortendissektion).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage (darf Reperfusion NICHT verzögern!):',
                labs: [
                    { param: 'hs-Troponin T (0h) & Kreatinin', value: 'Troponin T 145 ng/l | Krea 88 µmol/l', ref: '< 14 ng/l | 62–106 µmol/l', flag: '↑↑ (Bei STEMI im EKG jedoch sofort Katheterlabor ohne Warten auf Troponin!)' }
                ],
                imaging: [
                    { modality: '12-Kanal-EKG (innerhalb von 10 Minuten geschrieben!)', finding: 'Signifikante ST-Streckenhebungen (> 0.2 mV) in den inferioren Ableitungen II, III und aVF sowie reziproke ST-Senkungen in I und aVL. In den rechtspräkordialen Zusatzableitungen (V3R, V4R) ebenfalls ST-Hebung → Akuter Hinterwand-STEMI (RCA-Verschluss) mit Rechtsherzinfarkt!' }
                ]
            },
            examiner_info: {
                background: 'Akuter inferiorer ST-Hebungsinfarkt (Hinterwand-STEMI bei Verschluss der rechten Koronararterie / RCA) mit Rechtsherzbeteiligung (Hypotonie, Halsvenenstauung, freie Lungenfelder, Sinusbradykardie) sowie Sildenafil-Einnahme vor 12 h.',
                goals: '12-Kanal-EKG binnen 10 Min. anfordern (+ V3R/V4R!), Hinterwand-STEMI diagnostizieren, sofortige primäre PCI (< 60–90 Min.) aktivieren und die DOPPELTE Kontraindikation gegen Nitrate erkennen (1. Rechtsherzinfarkt mit Vorlastabhängigkeit + Hypotonie, 2. Sildenafil-Einnahme!).',
                differentials: ['Akute Aortendissektion Stanford A', 'Lungenarterienembolie', 'Spannungspneumothorax', 'Ösophagusruptur (Boerhaave-Syndrom)'],
                therapy_plan: '1. Sofortige Aktivierung Herzkatheterlabor zur primären PCI (Rekanalisation RCA), 2. Monitoring + Defibrillator-Bereitschaft, 3. ASS 250–500 mg i.v. + Heparin 5000 IE i.v. + potenter P2Y12-Inhibitor (Prasugrel oder Ticagrelor), 4. Morphin i.v. gegen Vernichtungsschmerz, 5. KEINE Nitrate und KEINE Betablocker (wegen Hypotonie, Rechtsherzinfarkt, Sildenafil & Bradykardie!), stattdessen vorsichtige kristalloide Volumengabe zur Vorlastsicherung.'
            },
            checklist: [
                { category: 'Anamnese & Untersuchung', item: 'Erfragt Schmerzcharakter, Risikofaktoren, PDE-5-Hemmer (Sildenafil!) und prüft Puls-/Blutdruckdifferenz, Lunge & Halsvenen', points: 3 },
                { category: 'EKG-Diagnostik', item: 'Fordert sofortiges 12-Kanal-EKG (+ rechtspräkordiale Ableitungen V3R/V4R) an und erkennt die ST-Hebungen in II, III, aVF mit reziproken Senkungen in I, aVL', points: 3 },
                { category: 'Notfalltherapie & Cave', item: 'Aktiviert sofort das Herzkatheterlabor (primäre PCI ohne Warten auf Troponin!) und gibt ASS + Heparin + P2Y12-Hemmer + Morphin', points: 3 },
                { category: 'Patientensicherheit', item: 'Verzichtet explizit auf Nitroglyzerin und Betablocker (wegen Rechtsherzbeteiligung, Hypotonie/Bradykardie und Sildenafil!)', points: 3 }
            ]
        },

        'Radiologie': {
            osce_id: 'REF_RADIO_THORAX',
            specialty: 'Radiologie',
            title: 'Strukturierte Röntgen-Thorax- & Notfall-CT-Befundung – Spannungspneumothorax vs. Aortendissektion',
            source_case_title: 'Referenz-Station Radiologie (Systematische Bildbefundung)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt im radiologischen Dienst.',
                vignette: 'Ein 34-jähriger Patient (Herr Marc Tobler, 192 cm, 72 kg) stellt sich mit plötzlich aufgetretener linksseitiger Thoraxschmerz-Attacke und zunehmender Atemnot vor. Demonstrieren Sie die Bildgebung systematisch und besprechen Sie die Konsequenz.',
                tasks: [
                    'Erheben Sie eine kurze fokussierte Anamnese.',
                    'Befunden Sie das Thorax-Röntgenbild systematisch nach dem ABCDE-Schema (Airway, Breathing, Cardiac/Mediastinum, Diaphragm, Everything else).',
                    'Erklären Sie dem Patienten den Befund und die unmittelbare interventionelle Therapie.'
                ],
                vitals: { bp: '92/58 mmHg', hr: '122/min', rr: '28/min', temp: '36,6 °C', spo2: '88 % (Raumluft)', bmi: '19,5 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Vor einer Stunde hat es beim Husten plötzlich links in der Brust gestochen und jetzt bekomme ich immer schlechter Luft!“',
                qa_rows: [
                    { topic: 'Konstitution & Rauchen', answer: '„Ich bin schon immer sehr groß und schlank (leptosom), rauche etwa 15 Zigaretten am Tag. Kein Unfall.“' }
                ],
                behavior: ['Deutlich dyspnoeisch, sitzt aufrecht.']
            },
            physical_exam: [
                { area: 'Auskultation & Perkussion Thorax', finding: 'Linksseitig komplett aufgehobenes Atemgeräusch und hypersonorer Klopfschall! Gestaute Halsvenen.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'Bildgebung auf Nachfrage:',
                labs: [
                    { param: 'Arterielle BGA', value: 'pO₂ 54 mmHg | SpO₂ 88 %', ref: 'pO₂ > 75 mmHg', flag: '⚠️ Akute respiratorische Insuffizienz' }
                ],
                imaging: [
                    { modality: 'Röntgen-Thorax p.a. (bzw. Lungen-Sonographie)', finding: 'Linksseitig komplett fehlende Lungengefäßzeichnung peripher der scharf abgrenzbaren viszeralen Pleuralinie, kollabierter linker Lungenflügel am Hilus, Tiefstand der linken Zwerchfellkuppel („Deep Sulcus Sign“) und Mediastinalshift (Trachea und Herzschatten) nach RECHTS → Linksseitiger Spannungspneumothorax!' }
                ]
            },
            examiner_info: {
                background: 'Spontaner linksseitiger Spannungspneumothorax bei jungem, leptosomem Raucher (Ruptur subpleuraler Bullae) mit Mediastinalverlagerung und oberer Einflussstauung.',
                goals: 'Hinweis: Bei klinischem Spannungspneumothorax erfolgt die Nadeldekompression in der Realität VOR dem Röntgenbild! Wenn ein Röntgenbild vorliegt, muss es strukturiert befundet werden (Pleuralinie, Abbruch der Gefäßzeichnung, Mediastinalshift zur Gegenseite, Zwerchfelltiefstand) und sofort entlastet werden.',
                differentials: ['Einfacher Mantelpneumothorax ohne Spannungskomponente', 'Große bullöse Emphysemblase', 'Lungenembolie'],
                therapy_plan: '1. Hochdosiert Sauerstoff, 2. Sofortige Entlastung mittels Nadeldekompression (2. ICR medioklavikulär nach Monaldi oder 4./5. ICR vordere/mittlere Axillarlinie nach Bülau am Oberrand der unteren Rippe!), 3. Einlage einer Thoraxdrainage mit Wasserschloss/Sog (15–20 cmH₂O).'
            },
            checklist: [
                { category: 'Klinik & Patientensicherheit', item: 'Erkennt die Trias aus einseitig aufgehobenem Atemgeräusch, hypersonorem Klopfschall und Schock/Halsvenenstauung (betont, dass ein klinischer Spannungspneumothorax eigentlich vor dem Röntgen entlastet wird!)', points: 3 },
                { category: 'Systematische Radiologie-Befundung', item: 'Befundet das Thoraxbild strukturiert: Identifiziert viszerale Pleuralinie, periphere Gefäßleere links, Zwerchfelltiefstand und den Mediastinalshift nach rechts', points: 4 },
                { category: 'Therapie & Anatomie', item: 'Benennt die exakten anatomischen Punktionsorte (Monaldi: 2. ICR MCL; Bülau: 4./5. ICR AAL im Safe Triangle, immer am RIPPENOBERRAND zum Schutz des Gefäß-Nerven-Bündels!)', points: 3 }
            ]
        },

        'Nahtkurs': {
            osce_id: 'REF_NAHT_WUNDE',
            specialty: 'Nahtkurs',
            title: 'Praktische chirurgische Wundversorgung – Riss-Quetschwunde, Lokalanästhesie & Donati-/Einzelknopfnaht',
            source_case_title: 'Referenz-Station Nahtkurs & Kleinchirurgie',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt in der chirurgischen Notfall-Koje.',
                vignette: 'Herr Reto Zürcher (35-jährig) ist vor 45 Minuten beim Heimwerken im Garten auf eine Metallkante gestürzt und hat sich eine 4 cm lange, klaffende Wunde am dorsalen linken Unterarm zugezogen.',
                tasks: [
                    'Erheben Sie eine fokussierte Wund- und Unfallanamnese (inkl. Zeitfenster, Tetanus, Allergien, Antikoagulation).',
                    'Prüfen Sie vor der Anästhesie zwingend pDMS und Sehnenfunktion.',
                    'Führen Sie die Lokalanästhesie, Wundreinigung und den spannungsfreien Wundverschluss (Einzelknopf- / Donati-Rückstichnaht) steril durch und instruieren Sie die Nachsorge.'
                ],
                vitals: { bp: '126/78 mmHg', hr: '76/min', rr: '14/min', temp: '36,7 °C', spo2: '99 %', bmi: '24 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Ich bin vor einer Dreiviertelstunde im Garten ausgerutscht und mit dem linken Unterarm an einer rostigen Blechkante hängen geblieben. Es klafft ziemlich auseinander.“',
                qa_rows: [
                    { topic: 'Unfallzeitpunkt & Tetanus-Impfstatus', answer: '„Vor 45 Minuten passiert. Meine letzte Tetanus-Impfung war vor 12 Jahren beim Militär!“' },
                    { topic: 'Allergien (Lidocain / Jod / Pflaster) & Blutverdünner', answer: '„Keine Allergien bekannt, auch beim Zahnarzt habe ich die Betäubungsspritze immer vertragen. Ich nehme keine Blutverdünner.“' },
                    { topic: 'Kribbeln oder Kraftverlust in den Fingern', answer: '„Nein, ich kann alle Finger normal bewegen und spüre alles.“' }
                ],
                behavior: ['Ruhig, schaut interessiert zu.']
            },
            physical_exam: [
                { area: 'Wundinspektion & pDMS VOR Lokalanästhesie', finding: '4 cm lange, glattrandige, bis in die Subkutis reichende Wunde dorsal am linken Unterarm. Keine aktive arterielle Blutung, kein Fremdkörper. Periphere Durchblutung, Sensibilität und Finger-/Handgelenksextension gegen Widerstand (Sehnen!) vollständig intakt.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'Material & Instrumentarium auf dem Nahttisch:',
                labs: [
                    { param: 'Lokalanästhetikum', value: 'Lidocain 1 % ohne Adrenalin (Maximaldosis ~4.5 mg/kg KG = ca. 30 ml bei 70 kg)', ref: 'Cave: Kein Adrenalin an Akren!', flag: 'Steril bereitgestellt' }
                ],
                imaging: [
                    { modality: 'Fadenmaterial & Nahttechnik', finding: 'Nicht-resorbierbarer monofiler Faden (Prolene / Ethilon 3-0 oder 4-0) mit schneidender Nadel für die Hautnaht.' }
                ]
            },
            examiner_info: {
                background: 'Frische (< 6 h), mäßig verschmutzte Riss-Quetschwunde am Unterarm ohne Sehnen-/Nervenverletzung bei abgelaufenem Tetanus-Impfschutz (> 10 Jahre bei < 65-Jährigem nach Schweizer Impfplan).',
                goals: 'Zwingend pDMS & Sehnenfunktion VOR der Lokalanästhesie prüfen! Steriles Arbeiten, Aspiration vor Lidocain-Injektion, Wundspülung/Exploration, korrekte instrumentelle Knotentechnik (Einzelknopfnaht oder vertikale Rückstichnaht nach Donati: „weit-weit, nah-nah“), Tetanus-Auffrischimpfung (dT/dTpa) und Aufklärung über Fadenentfernung (Unterarm: nach 10–12 Tagen).',
                differentials: ['Begleitende Strecksehnenläsion', 'Fremdkörperverbleib in der Wunde'],
                therapy_plan: 'Sterile Wundspülung, Infiltrationsanästhesie (Lidocain 1 % unter Aspiration), primäre Hautnaht (Einzelknopf / Donati), steriler Verband, Tetanus-Booster (dTpa), Kontrolle in 48 h, Fadenentfernung am Unterarm nach 10–12 Tagen.'
            },
            checklist: [
                { category: 'Vorbereitung & Untersuchung', item: 'Erfragt Unfallzeitpunkt (< 6 h Friedrich-Zeitfenster), Allergien (Lidocain!), Antikoagulation & Tetanusstatus (> 10 J. → Booster nötig!)', points: 2 },
                { category: 'Vorbereitung & Untersuchung', item: 'Prüft ZWINGEND VOR der Lokalanästhesie die periphere Durchblutung, Motorik (Strecksehnen!) und Sensibilität (pDMS)', points: 3 },
                { category: 'Praktische Durchführung', item: 'Händedesinfektion, sterile Handschuhe, Wunddesinfektion, Infiltrationsanästhesie unter Aspiration, gründliche Wundexploration/-spülung', points: 3 },
                { category: 'Nahttechnik & Nachsorge', item: 'Spannt Nadel im hinteren Drittel in den Nadelhalter ein, adaptiert Wundränder spannungsfrei (Einzelknopf/Donati), legt Knoten seitlich der Wunde ab & nennt Zeitpunkt der Fadenentfernung (10–12 Tage)', points: 4 }
            ]
        },

        'Rechtsmedizin': {
            osce_id: 'REF_RECHT_LEICHENSCHAU',
            specialty: 'Rechtsmedizin',
            title: 'Ärztliche Leichenschau & Gewalteinwirkung gegen den Hals – Nicht-natürlicher Todesfall',
            source_case_title: 'Referenz-Station Rechtsmedizin (Leichenschau & Todesart)',
            door_sign: {
                role: 'Sie werden als Notfall-/Hausärztin bzw. -arzt zu einer leblosen Person in einer Wohnung gerufen.',
                vignette: 'Frau Erika Zimmermann (48-jährig) wurde von ihrem Lebensgefährten leblos auf dem Schlafzimmerboden aufgefunden. Führen Sie die ärztliche Leichenschau durch.',
                tasks: [
                    'Prüfen Sie systematisch die unsicheren und sicheren Todeszeichen.',
                    'Führen Sie eine gründliche Inspektion aller Körperregionen (inkl. Körperöffnungen, Kopfhaut und Hals) durch.',
                    'Bestimmen Sie die ungefähre Todeszeit, legen Sie die Todesart fest und leiten Sie die korrekten rechtlichen Schritte ein.'
                ],
                vitals: { bp: 'Nicht messbar', hr: 'Asystolie', rr: 'Apnoe', temp: 'Rektaltemperatur 31,2 °C', spo2: '—', bmi: '23 kg/m²' }
            },
            sp_script: {
                opening_quote: '„(Lebensgefährte im Nebenzimmer:) Ich bin vor 20 Minuten vom Einkaufen zurückgekommen, da lag sie plötzlich kalt hier auf dem Boden! Gestern Abend hatten wir nur einen kleinen Streit, danach ist sie schlafen gegangen.“',
                qa_rows: [
                    { topic: 'Vorerkrankungen der Verstorbenen', answer: '„Sie war eigentlich kerngesund, keine Herzkrankheit, keine Medikamente.“' }
                ],
                behavior: ['Untersuchung erfolgt am Modell / Phantom; Lebensgefährte wirkt nervös und drängt auf einen schnellen Totenschein.']
            },
            physical_exam: [
                { area: 'Sichere Todeszeichen (Livores & Rigor mortis)', finding: 'Totenflecke (Livores) am Rücken kräftig ausgebildet, auf kräftigen Daumendruck noch knapp wegdrückbar (sprechen für 6–12 h post mortem). Totenstarre (Rigor mortis) im Kiefer-, Nacken- und Armbereich vollständig ausgeprägt.' },
                { area: 'Augen & Konjunktiven (Ektropionieren der Lider!)', finding: 'Zahlreiche punktförmige Einblutungen (Petechien / Tardieu-Flecken) in beiden Augenbindehäuten (Konjunktiven) sowie in der Mundschleimhaut und hinter den Ohren (obere Einflussstauung!).' },
                { area: 'Hals, Nacken & Extremitäten', finding: 'Am vorderen und seitlichen Hals mehrere halbmondförmige Oberhautvertrocknungen (Fingernagel-Würgermerkmale) und diskrete Unterblutungen. An den Unterarmen ältere und frische Griffhämatome (Abwehrverletzungen).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'Rechtsmedizinische Beurteilung:',
                labs: [
                    { param: 'Todeszeitschätzung (Totenflecke, Starre, Temperatur)', value: 'Ca. 6 bis 10 Stunden vor Auffindung', ref: 'Diskrepanz zur Aussage des Partners!', flag: '⚠️ Forensisch hochrelevant' }
                ],
                imaging: [
                    { modality: 'Kehlkopfskelett-Palpation', finding: 'Krepitation im Bereich des oberen Schildknorpelhorns (V.a. Kehlkopffraktur durch manuelles Würgen).' }
                ]
            },
            examiner_info: {
                background: 'Tötungsdelikt durch manuelles Würgen (Kompression des Halses mit konjunktivalen Stauungspetechien, Würgemalen am Hals, Abwehrhämatomen an den Unterarmen und zeitlicher Diskrepanz der sicheren Todeszeichen zur Zeugenaussage).',
                goals: 'Sichere Todeszeichen (Totenflecke, Totenstarre, Fäulnis, mit dem Leben unvereinbare Verletzungen) benennen, Leiche vollständig entkleidet inkl. Konjunktiven (Petechien!), Kopfhaut und Körperöffnungen untersuchen, bei Verdacht auf nicht-natürlichen Tod die Untersuchung sofort abbrechen (Spurenschutz!), Todesart „nicht-natürlich“ bzw. „ungeklärt“ ankreuzen und sofort die Polizei / Staatsanwaltschaft verständigen.',
                differentials: ['Erdrosseln (horizontale Schnürfurche)', 'Erhängen (ansteigende Strangmarke)', 'Plötzlicher Herztod (macht KEINE Würgemale und meist keine massiven konjunktivalen Petechien mit Abwehrverletzungen)'],
                therapy_plan: 'Keinen natürlichen Tod bescheinigen! Leiche und Fundort unverändert belassen (Spurensicherung), Polizei umgehend informieren, gegenüber dem anwesenden Lebensgefährten ruhig bleiben und sich nicht in Gefahr bringen.'
            },
            checklist: [
                { category: 'Todesfeststellung', item: 'Benennt und prüft die sicheren Todeszeichen (Totenflecke/Livores inkl. Wegdrückbarkeit & Umlagerbarkeit, Totenstarre/Rigor, Fäulnis)', points: 3 },
                { category: 'Systematische Leichenschau', item: 'Inspiziert am entkleideten Körper gezielt die Augenbindehäute (Ektropionieren → Stauungspetechien!), Mundhöhle, Hals (Würgemale!) und Unterarme (Abwehrhämatome)', points: 4 },
                { category: 'Forensisches Vorgehen', item: 'Erkennt die Hinweise auf Gewalteinwirkung gegen den Hals (Würgen) sowie die Diskrepanz der Todeszeit zur Aussage', points: 2 },
                { category: 'Rechtliche Konsequenz', item: 'Kreuzt Todesart „nicht-natürlich / ungeklärt“ an, verändert nichts mehr am Tatort (Spurenschutz) und verständigt sofort die Polizei', points: 3 }
            ]
        },

        'Rheumatologie': {
            osce_id: 'REF_RHEUMA_GICHT',
            specialty: 'Rheumatologie',
            title: 'Perakute Monarthritis des Großzehengrundgelenks – Akuter Gichtanfall (Podagra) vs. Septische Arthritis',
            source_case_title: 'Referenz-Station Rheumatologie (Kristallarthropathie)',
            door_sign: {
                role: 'Sie sind Unterassistentin / Unterassistent in der rheumatologischen / internistischen Ambulanz.',
                vignette: 'Herr Kurt Wenger (61-jährig) stellt sich vor, weil er heute Nacht mit unerträglichen Schmerzen und einer massiven Rötung im rechten Großzehengrundgelenk aufgewacht ist.',
                tasks: [
                    'Erheben Sie eine gezielte rheumatologische und internistische Anamnese (inkl. Auslöser & Medikation).',
                    'Untersuchen Sie das betroffene Gelenk sowie den übrigen Gelenkstatus.',
                    'Besprechen Sie Diagnose, Gelenkpunktion sowie die Trennung zwischen Akuttherapie und harnsäuresenkender Dauertherapie.'
                ],
                vitals: { bp: '148/90 mmHg', hr: '86/min', rr: '15/min', temp: '37,7 °C', spo2: '98 %', bmi: '31 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Heute Nacht um 3 Uhr bin ich vor Schmerzen fast an die Decke gegangen! Mein rechter großer Zeh ist feuerrot und geschwollen – ich ertrage nicht einmal das Gewicht der Bettdecke darauf!“',
                qa_rows: [
                    { topic: 'Auslöser am Vortag (Ernährung / Alkohol)', answer: '„Gestern Abend waren wir auf einem Grillfest, ich habe reichlich Fleisch gegessen und 4 Bier getrunken.“' },
                    { topic: 'Vorerkrankungen & Medikamente (Diuretika!)', answer: '„Bluthochdruck, Übergewicht und leicht eingeschränkte Nierenwerte. Vor 4 Wochen hat mir mein Hausarzt Hydrochlorothiazid (HCT) dazugegeben.“' },
                    { topic: 'Wunden / Zeckenstich / Psoriasis', answer: '„Keine offene Wunde am Fuß, keine Schuppenflechte.“' }
                ],
                behavior: ['Trägt am rechten Fuß nur eine offene Sandale, extreme Berührungsempfindlichkeit (Allodynie) der Großzehe.']
            },
            physical_exam: [
                { area: 'Inspektion & Palpation MTP-I-Gelenk rechts', finding: 'Hochgradige Rötung, Schwellung, Überwärmung und extremste Druck- und Bewegungsdolenz des rechten Großzehengrundgelenks (MTP I = Podagra). Keine Eintrittspforte.' },
                { area: 'Übrige Gelenke & Ohrmuscheln', finding: 'Knie-, Sprung- und Fingergelenke frei. Kleiner weißlicher Knoten (Gichttophus) an der rechten Ohrmuschel (Helix).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'CRP, Leukozyten & Kreatinin', value: 'CRP 64 mg/l | Leuk 12.1 G/l | Krea 118 µmol/l (eGFR 56 ml/min)', ref: '< 5 mg/l | 4–10 G/l', flag: '↑ Entzündung & CKD G3a' },
                    { param: 'Harnsäure im Serum', value: '490 µmol/l (8.2 mg/dl)', ref: '< 420 µmol/l (< 7.0 mg/dl, Ziel bei Gicht < 360 µmol/l)', flag: '↑ (Hinweis: Kann im akuten Anfall auch normwertig sein!)' }
                ],
                imaging: [
                    { modality: 'Gelenkpunktion & Polarisationsmikroskopie (Goldstandard) / Dual-Energy-CT', finding: 'Intrazelluläre, nadelförmige, stark NEGATIV doppelbrechende Natriumurat-Kristalle im Punktat, Gram-Färbung negativ. Sonographie zeigt „Doppelkontur-Zeichen“ am Gelenkknorpel.' }
                ]
            },
            examiner_info: {
                background: 'Klassischer akuter Gichtanfall des Großzehengrundgelenks (Podagra) nach Purin-/Bierexzess und Thiaziddiuretikum-Gabe (HCT hemmt die renale Harnsäureausscheidung!).',
                goals: 'Podagra erkennen, septische Arthritis als gefährlichste DD abgrenzen, Polarisationsmikroskopie (negativ doppelbrechende Uratkristalle vs. positiv doppelbrechende CPPD-Kristalle bei Pseudogicht) benennen, HCT absetzen und die goldene Therapieregel beachten: Im akuten Anfall zuerst NSAR/Colchicin/Prednisolon – Allopurinol NICHT ungeschützt im akuten Anfall neu starten (bzw. nur unter Anfallsprophylaxe).',
                differentials: ['Akute septische Arthritis (Notfall!)', 'Chondrokalzinose / Pseudogicht (CPPD – positiv doppelbrechend, meist Knie/Handgelenk)', 'Aktivierte Arthrose (Hallux rigidus)', 'Psoriasis-Arthritis (Daktylitis)'],
                therapy_plan: '1. Akuttherapie: Prednisolon p.o. (30–50 mg für 5 Tage, ideal bei eingeschränkter eGFR!) oder niedrigdosiertes Colchicin (Cave: NSAR bei eGFR 56 ml/min nur mit Vorsicht) + lokale Kühlung, 2. HCT auf harnsäureneutrales/senkendes Antihypertensivum (Losartan oder Amlodipin) umstellen, 3. Harnsäuresenkende Dauertherapie mit Allopurinol (einschleichend, Ziel-Harnsäure < 360 µmol/l / < 6 mg/dl) + Ernährungsberatung.'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt nächtlichen perakuten Beginn, Bettdecken-Allodynie, Ernährungs-/Alkoholexzess und Medikamente (Thiaziddiuretika!)', points: 3 },
                { category: 'Klinische Untersuchung', item: 'Untersucht MTP-I-Gelenk, sucht nach Eintrittspforten (DD Septische Arthritis) und Gichttophi (Ohrmuschel, Streckseiten)', points: 2 },
                { category: 'Diagnostik', item: 'Weiß, dass Serum-Harnsäure im Anfall normal sein kann, und nennt den Nachweis negativ doppelbrechender Uratkristalle (bzw. Doppelkonturzeichen im US)', points: 3 },
                { category: 'Therapie & Pharmakologie', item: 'Trennt sauber zwischen Akuttherapie (Prednisolon/Colchicin/NSAR) und Dauertherapie (Allopurinol mit Ziel < 360 µmol/l) & setzt das Thiaziddiuretikum um (z.B. auf Losartan)', points: 3 }
            ]
        },

        'Notfall': {
            osce_id: 'REF_NOTFALL_AORTA',
            specialty: 'Notfall',
            title: 'Perakuter interskapulärer Vernichtungsschmerz & Pulsdefizit – Akute Aortendissektion Stanford A',
            source_case_title: 'Referenz-Station Notfallmedizin (ABCDE & Aortendissektion)',
            door_sign: {
                role: 'Sie sind diensthabende Assistenzärztin / Assistenzarzt im Schockraum der Notfallstation.',
                vignette: 'Herr Markus Lehmann (57-jährig) wird vom Rettungsdienst mit einem vor 30 Minuten schlagartig eingesetzten, reißenden Schmerz zwischen den Schulterblättern und passagerer Schwäche des rechten Arms eingeliefert.',
                tasks: [
                    'Führen Sie ein strukturiertes Primary Survey nach dem ABCDE-Schema parallel zur fokussierten Notfallanamnese durch.',
                    'Prüfen Sie gezielt den beidseitigen Blutdruck- und Pulsstatus sowie den Herz- und Neurostatus.',
                    'Stellen Sie die Verdachtsdiagnose, veranlassen Sie die beweisende Notfallbildgebung und leiten Sie die medikamentöse Zielblutdrucksenkung ein.'
                ],
                vitals: { bp: 'Rechts 185/105 mmHg | Links 135/80 mmHg!', hr: '104/min', rr: '22/min', temp: '36,6 °C', spo2: '96 %', bmi: '26 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Es hat mir vor einer halben Stunde plötzlich wie mit einer Axt zwischen die Schulterblätter geschlagen! Der Schmerz wandert jetzt nach unten in den Rücken!“',
                qa_rows: [
                    { topic: 'Schmerzcharakter & Beginn', answer: '„Von einer Sekunde auf die andere von 0 auf 10/10! Reißend, schneidend, wandernd.“' },
                    { topic: 'Vorerkrankungen & Medikamente', answer: '„Langjähriger hoher Blutdruck, aber ich habe meine Tabletten seit Monaten weggelassen.“' }
                ],
                behavior: ['Schwerst schmerzgeplagt, unruhig, kaltschweißig.']
            },
            physical_exam: [
                { area: 'ABCDE-Beurteilung & Puls-/Blutdruckstatus beidseits', finding: 'A/B frei. C: Massive Seitendifferenz des Blutdrucks von 50 mmHg (rechts 185/105 mmHg, links 135/80 mmHg), linker Radialispuls deutlich abgeschwächt! Diastolisches Decrescendo-Geräusch über dem Erb-Punkt (akute Aortenklappeninsuffizienz).' },
                { area: 'Neurostatus (D)', finding: 'GCS 15, leichte rechtsseitige Armparese (KG 4/5) durch Beteiligung des Truncus brachiocephalicus.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'D-Dimere, Troponin T, Kreuzblut (4 EK)', value: 'D-Dimere 8.4 mg/l | Troponin 22 ng/l', ref: '< 0.5 mg/l | < 14 ng/l', flag: '↑↑ Massive D-Dimer-Erhöhung!' }
                ],
                imaging: [
                    { modality: 'EKG-getriggertes Angio-CT der gesamten Aorta (Thorax bis Becken)', finding: 'Intimale Dissektionsmembran („Intimal Flap“) beginnend unmittelbar oberhalb der Aortenwurzel (Aorta ascendens) mit Ausdehnung über den Aortenbogen (Beteiligung Truncus brachiocephalicus und A. subclavia links) bis in die Aorta abdominalis → Akute Aortendissektion Typ Stanford A (DeBakey I)!' }
                ]
            },
            examiner_info: {
                background: 'Akute Aortendissektion Typ Stanford A (Beteiligung der Aorta ascendens) mit Puls-/Blutdruckdifferenz (> 20 mmHg), sekundärer Aortenklappeninsuffizienz und zerebraler/brachialer Malperfusion.',
                goals: 'ABCDE-Schema anwenden, beidseitige Blutdruckmessung durchführen, tödliche Falle vermeiden (KEINE Antikoagulation/Lyse geben, bevor eine Aortendissektion ausgeschlossen ist!), sofortiges Angio-CT + herzchirurgischen Notfalleingriff einleiten.',
                differentials: ['Akuter Myokardinfarkt (Cave: kann durch Verlegung der Koronarostien auch sekundär bei Stanford A auftreten!)', 'Lungenarterienembolie', 'Ösophagusruptur'],
                therapy_plan: '1. Zwei großlumige Zugänge + Kreuzblut für 4–6 EK, 2. Schmerztherapie (Morphin/Fentanyl i.v.), 3. Sofortige Senkung von Herzfrequenz (< 60/min) und systolischem Blutdruck (Ziel 100–120 mmHg) primär mit i.v. Betablocker (Esmolol oder Labetalol) zur Reduktion des Scher-Stresses (dP/dt), 4. Unverzügliche herzchirurgische Notfall-OP (Ersatz der Aorta ascendens).'
            },
            checklist: [
                { category: 'ABCDE & Untersuchung', item: 'Geht strukturiert nach ABCDE vor, misst den Blutdruck an BEIDEN Armen (erkennt Differenz > 20 mmHg!) und auskultiert das Herz (Aorteninsuffizienz)', points: 3 },
                { category: 'Diagnostik & Patientensicherheit', item: 'Stellt V.a. Aortendissektion Stanford A, fordert sofortiges Angio-CT der Aorta an und gibt KEIN Heparin/ASS vor Ausschluss der Dissektion!', points: 3 },
                { category: 'Notfalltherapie', item: 'Leitet Analgesie (Opioid), Frequenz- und Blutdrucksenkung mit i.v. Betablocker (Ziel-RR sys 100–120 mmHg, HF < 60/min) sowie sofortige Herzchirurgie-Verlegung ein', points: 4 }
            ]
        },

        'Ultraschall': {
            osce_id: 'REF_SONO_CHOLEZYSTITIS',
            specialty: 'Ultraschall',
            title: 'Strukturierte Abdomen-Sonographie & POCUS – Akute kalkulöse Cholezystitis',
            source_case_title: 'Referenz-Station Ultraschall (Abdomen-Sono & eFAST)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt im Sonographie-Dienst der Notfallstation.',
                vignette: 'Frau Monika Gerber (51-jährig) stellt sich wegen seit 8 Stunden anhaltender Schmerzen im rechten Oberbauch und Fieber nach einem fettreichen Essen vor. Führen Sie eine fokussierte Abdomen-Sonographie durch.',
                tasks: [
                    'Erheben Sie eine kurze fokussierte Anamnese (6-F-Risikoprofil).',
                    'Erklären Sie die Schallkopf-Wahl, Schnittführungen und demonstrieren Sie Leber, Gallenblase, Ductus hepatocholedochus (DHC) und Morrison-Pouch.',
                    'Befunden Sie die sonographischen Kriterien der akuten Cholezystitis und besprechen Sie das Procedere.'
                ],
                vitals: { bp: '132/80 mmHg', hr: '94/min', rr: '18/min', temp: '38,4 °C', spo2: '98 %', bmi: '29 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Nach dem Fondue gestern Abend hat es erst krampfartig im rechten Oberbauch angefangen, und jetzt tut es dort ununterbrochen weh, besonders wenn Sie mit dem Schallkopf draufdrücken!“',
                qa_rows: [
                    { topic: 'Schmerzausstrahlung & Stuhl-/Urinverfärbung', answer: '„Der Schmerz strahlt in meine rechte Schulter aus (Boas-Zeichen). Mein Urin ist normal hell, Stuhl normal braun.“' }
                ],
                behavior: ['Stoppt bei gezieltem Schallkopfdruck auf die Gallenblase abrupt die Inspiration (Sonographisches Murphy-Zeichen positiv!).']
            },
            physical_exam: [
                { area: 'Schallkopf & Untersuchungstechnik', finding: 'Konvexschallkopf (3.5–5 MHz), Untersuchung im subkostalen und interkostalen Schrägschnitt in tiefer Inspiration sowie Linksseitenlage.' },
                { area: 'Sonographischer Befund Gallenblase & Gallenwege', finding: '1. Vergrößerte, prall gefüllte Gallenblase (Hydrops, 11 × 4.5 cm), 2. Geschichtete Wandverdickung auf 6 mm („Dreischichtung / Halo-Zeichen“), 3. Präpapillär impaktiertes echoreiches Konkrement (1.8 cm) mit dorsalem Schallschatten, 4. Schmaler pericholezystischer Flüssigkeitssaum, 5. Sonographisches Murphy-Zeichen hochpositiv. DHC normalkalibrig (4 mm).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Leukozyten, CRP, Bilirubin, AP, GGT, Lipase', value: 'Leuk 14.2 G/l | CRP 85 mg/l | Bili 14 µmol/l (norm) | Lipase 32 U/l', ref: 'Bili < 21 µmol/l', flag: '↑ Entzündung ohne extrahepatische Cholestase' }
                ],
                imaging: [
                    { modality: 'Tokyo-Guidelines Kriterien', finding: 'Lokale Entzündungszeichen (Murphy +) + Systemische Entzündung (Fieber, CRP/Leuk ↑) + typischer Sonographiebefund = Gesicherte akute Cholezystitis.' }
                ]
            },
            examiner_info: {
                background: 'Akute kalkulöse Cholezystitis ohne Choledocholithiasis (DHC < 6 mm, Bilirubin normal).',
                goals: 'Konvexschallkopf (3.5–5 MHz) wählen, alle 4 sonographischen Hauptkriterien der akuten Cholezystitis benennen (Steinnachweis mit dorsalem Schallschatten, Wandverdickung > 3–4 mm mit Dreischichtung, pericholezystische Flüssigkeit, sonographisches Murphy-Zeichen) und die intra-/extrahepatischen Gallenwege (DHC) mitbeurteilen.',
                differentials: ['Choledocholithiasis / akute Cholangitis (Charcot-Trias)', 'Akute biliary Pankreatitis', 'Ulcus duodeni', 'Basale Pleuropneumonie rechts'],
                therapy_plan: 'Nüchtern lassen, i.v. Flüssigkeit, Spasmoanalgesie (Metamizol / NSAR), i.v. Antibiose (z. B. Ceftriaxon + Metronidazol oder Amoxicillin/Clavulansäure) und früh-elektive laparoskopische Cholezystektomie innerhalb von 24–72 Stunden.'
            },
            checklist: [
                { category: 'Sonographie-Technik', item: 'Wählt den korrekten Konvexschallkopf (3.5–5 MHz), nutzt Inspiration und Umlagerung (Linksseitenlage) zur Prüfung der Steinmobilität', points: 3 },
                { category: 'Sonographie-Befundung', item: 'Benennt alle sonographischen Kriterien: Echoreicher Stein mit dorsalem Schallschatten, Wandverdickung (> 3 mm, Dreischichtung), Flüssigkeitssaum, sonographisches Murphy-Zeichen & DHC-Weite', points: 4 },
                { category: 'Klinische Konsequenz', item: 'Prüft Cholestaseparameter/Lipase und indiziert Antibiose, Analgesie sowie die frühe laparoskopische Cholezystektomie (< 24–72 h)', points: 3 }
            ]
        },

        'Urologie': {
            osce_id: 'REF_URO_UROLITHIASIS',
            specialty: 'Urologie',
            title: 'Akute Flankenkolik, Fieber & Harnstau – Obstruktive Pyelonephritis bei Urolithiasis (Urologischer Notfall!)',
            source_case_title: 'Referenz-Station Urologie (Obstruktive Harnleitersteinkolik)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt auf der Notfallstation.',
                vignette: 'Herr Sandro Rossi (44-jährig) stellt sich wegen vernichtender, wellenförmiger Schmerzen in der linken Flanke mit Ausstrahlung in die linke Leiste sowie seit 2 Stunden bestehendem Schüttelfrost vor.',
                tasks: [
                    'Erheben Sie eine fokussierte urologische Schmerz- und Infektanamnese.',
                    'Führen Sie die klinische Untersuchung (Abdomen, Nierenlogen, Genitale) durch.',
                    'Erkennen Sie die vital bedrohliche Komplikation und leiten Sie die sofortige Notfalltherapie ein.'
                ],
                vitals: { bp: '102/64 mmHg', hr: '114/min (tachykard)', rr: '22/min', temp: '39,2 °C', spo2: '97 %', bmi: '26 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Ich weiß nicht, ob ich sitzen, stehen oder herumlaufen soll! Es zieht krampfartig von der linken Nierengegend bis in den linken Hoden, und vorhin hatte ich starken Schüttelfrost!“',
                qa_rows: [
                    { topic: 'Schmerzcharakter & Miktion', answer: '„Vernichtende Wellen (NRS 9/10), der Urin war heute Morgen rötlich verfärbt und hat gebrannt.“' },
                    { topic: 'Vorgeschichte (Nierensteine)', answer: '„Vor 4 Jahren hatte ich schon einmal einen kleinen Nierenstein, der von selbst abgegangen ist.“' }
                ],
                behavior: ['Extrem unruhig (motorische Unruhe typisch für Kolik!), läuft im Zimmer auf und ab, fiebrig.']
            },
            physical_exam: [
                { area: 'Nierenlogen & Abdomen', finding: 'Linker Nierenlagerklopfschmerz hochpositiv! Abdomen weich (kein Peritonismus, motorische Unruhe im Gegensatz zur Peritonitis).' },
                { area: 'Äußeres Genitale (Ausschluss Hodentorsion!)', finding: 'Beide Hoden orthotop, normalkonsistent, indolent, Kremasterreflex bds. erhalten.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Urinstatus (U-Stix) & Urinkultur', value: 'Erythrozyten +++, Leukozyten +++, Nitrit positiv!', ref: 'Negativ', flag: '⚠️ Hämaturie + Leukozyturie + Bakteriurie!' },
                    { param: 'Leukozyten, CRP & Kreatinin', value: 'Leuk 17.4 G/l | CRP 142 mg/l | Krea 156 µmol/l', ref: '4–10 G/l | < 5 mg/l | 62–106 µmol/l', flag: '↑↑ Obstruktive Pyelonephritis / Urosepsis + postrenale AKI!' }
                ],
                imaging: [
                    { modality: 'Nieren-Sonographie & Nativ-Low-Dose-CT Abdomen (Steinsuche)', finding: 'Linksseitige Hydronephrose (Harnstau II°) mit dilatiertem Ureter sowie 7 mm messendes, schattengebendes Konkrement im distalen linken Ureter (prävesikal).' }
                ]
            },
            examiner_info: {
                background: 'Obstruktive Pyelonephritis mit beginnender Urosepsis bei prävesikalem Harnleiterstein links (7 mm) – absoluter urologischer Notfall („gestaute infizierte Niere“)!',
                goals: 'Kombination aus Harnleiterkolik/Harnstau + Fieber/Nitrit-positivem Urin als urologischen Notfall erkennen (Konservative Steinpassage / Medical Expulsive Therapy ist bei Fieber/Infektstauung ABSOLUT KONTRAINDIZIERT!), sofort Blut-/Urinkulturen abnehmen, i.v. Antibiose starten und unverzügliche Harnableitung (Doppel-J-Katheter oder perkutane Nephrostomie) veranlassen.',
                differentials: ['Unkomplizierte Harnleiterkolik ohne Infekt', 'Rupturiertes Bauchaortenaneurysma (wichtigste DD bei Flankenschmerz > 60 J.!)', 'Hodentorsion / Epididymitis', 'Akute Divertikulitis'],
                therapy_plan: '1. Analgesie (Metamizol i.v. / Paracetamol; Cave: NSAR wegen Krea 156 µmol/l vermeiden!), 2. Blutkulturen + Urinkultur, danach sofort empirische i.v. Antibiose (z. B. Ceftriaxon oder Piperacillin/Tazobactam), 3. SOFORTIGE notfallmäßige Harnableitung durch Urologie (DJ-Ureterschiene oder perkutane Nephrostomie – Steinentfernung via URS erst sekundär nach Infektsanierung!).'
            },
            checklist: [
                { category: 'Anamnese & Untersuchung', item: 'Erfragt Kolikcharakter, Ausstrahlung (Leiste/Hoden), Hämaturie und Fieber/Schüttelfrost; prüft Nierenlagerklopfschmerz & untersucht Hoden', points: 3 },
                { category: 'Diagnostik', item: 'Fordert U-Stix/Urinkultur, Blutkulturen, Entzündungswerte/Kreatinin, Nieren-Sonographie (Harnstau!) und Nativ-Low-Dose-CT an', points: 3 },
                { category: 'Notfall-Management', item: 'Erkennt die „infizierte Harnstauungsniere“ (obstruktive Pyelonephritis / Urosepsis) als absoluten Notfall und leitet sofortige i.v. Antibiose + notfallmäßige Harnableitung (DJ-Katheter / Nephrostomie) ein', points: 4 }
            ]
        }
    };

    // ======================================================================
    // 05. RUNTIME STATES DES OSCE-GENERATORS
    // ======================================================================
    let selectedSpecialty = 'Innere Medizin';
    let selectedSourceCaseId = '__AUTO__';
    let selectedSetting = 'auto';
    let showCrossSpecialtyCases = false; // Standardmäßig FALSE -> Nur 100 % passende Fälle anzeigen!
    let currentOSCEData = null;
    let activeRoleMode = 'all'; // 'all' | 'candidate' | 'sp' | 'examiner'
    let revealedSections = { exam: false, labs: false, imaging: false };
    let checkedCriteria = {};
    let spSearchFilter = '';

    // Timer State
    let timerTotalSec = 480;
    let timerRemainingSec = 480;
    let timerInterval = null;
    let isTimerRunning = false;

    // ======================================================================
    // 06. CSS-INJEKTION & FORGE-BUTTON
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
                background: rgba(6, 9, 19, 0.84);
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
                max-width: 1440px;
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
                padding: 15px 22px;
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
                grid-template-columns: 350px 1fr;
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
                max-height: 315px;
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
                background: rgba(16, 185, 129, 0.16);
                color: #6ee7b7;
                font-family: 'JetBrains Mono', monospace;
                font-weight: 800;
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
                background: var(--surface-secondary, rgba(15, 23, 42, 0.72));
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
                position: sticky;
                top: 0;
                z-index: 20;
                backdrop-filter: blur(10px);
            }
            .osce-role-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
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
            .osce-checklist-row:hover { border-color: var(--accent-cyan, #38bdf8); }
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
                    Präzise Fachgebiets-Zuordnung: Erstellt aus deinen importierten MedCheck-Fällen & 21 klinischen Referenzstationen realitätsgetreue OSCE-Prüfungen.
                </div>
            </div>
            <button type="button" class="action-btn" id="btn-open-osce-generator" onclick="window.OSCEModule.openModal()" style="background: linear-gradient(135deg, #0284c7, #0d9488); border: none; padding: 11px 18px; font-weight: 800; box-shadow: 0 6px 20px rgba(2, 132, 199, 0.3);">
                🩺 OSCE-Fallgenerator
            </button>
        `;

        if (subtitleEl) subtitleEl.insertAdjacentElement('afterend', launchpad);
        else forgeView.prepend(launchpad);
    }

    // ======================================================================
    // 07. DETERMINISTISCHE CASE-TO-OSCE SYNTHESE FÜR IMPORTIERTE APP-FÄLLE
    // ======================================================================
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

    function synthesizeOSCEFromMedCheckCase(caseObj, specialtyId, customSetting = 'auto') {
        const specMeta = SPECIALTIES.find(s => s.id === specialtyId) || SPECIALTIES[10];
        const primaryDisease = caseObj.metadata?.primary_disease || caseObj.extra_tasks?.doctordle?.[0]?.target_diagnosis || caseObj.case_overview?.topic || caseObj.metadata?.title || 'Klinisches Syndrom';
        const caseTitle = caseObj.metadata?.title || primaryDisease;

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

        const isAcute = /notfall|akut|perakut|schock|reißend|krampf|ileus|stemi|stroke|lähmung|paraparese/i.test(combinedIntro) || specialtyId === 'Notfall' || specialtyId === 'Chirurgie';
        const effectiveSetting = customSetting !== 'auto' ? customSetting : (isAcute ? 'Notfallstation' : specMeta.setting);

        const roleText = isAcute
            ? `Sie sind Assistenzärztin / Assistenzarzt auf der ${effectiveSetting} (${specialtyId}).`
            : `Sie sind Unterassistentin / Unterassistent in der ${effectiveSetting} (${specialtyId}).`;

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

        const cascadeObj = (caseObj.extra_tasks?.clinical_cascades || [])[0];
        const cascadeMap = {};
        (cascadeObj?.cascade || []).forEach(st => { cascadeMap[st.stage] = st.content; });

        const docPuzzle = (Array.isArray(caseObj.extra_tasks?.doctordle) ? caseObj.extra_tasks.doctordle[0] : caseObj.extra_tasks?.doctordle) || {};
        const hints = (docPuzzle.hints || []).map(h => h.replace(/^Stufe\s*\d+\s*:\s*|^Hinweis\s*\d+\s*:\s*/i, '').trim());

        const bpMatch = combinedIntro.match(/(\d{2,3}\/\d{2,3})\s*mmHg/i);
        const hrMatch = combinedIntro.match(/(\d{2,3})\s*\/min/i);
        const tempMatch = combinedIntro.match(/(\d{2}[.,]\d)\s*°C/i);

        const vitals = {
            bp: bpMatch ? `${bpMatch[1]} mmHg` : (isAcute ? '150/90 mmHg' : '126/78 mmHg'),
            hr: hrMatch ? `${hrMatch[1]}/min` : (isAcute ? '96/min, regelmäßig' : '74/min, regelmäßig'),
            rr: isAcute ? '20/min' : '14/min',
            temp: tempMatch ? `${tempMatch[1]} °C` : '36,8 °C',
            spo2: isAcute ? '96 % (Raumluft)' : '98 % (Raumluft)',
            bmi: '24,5 kg/m²'
        };

        const chiefComplaintSummary = symptomTerms.length > 0
            ? symptomTerms.join(', ')
            : (cascadeMap['05_Klinische Manifestation'] || 'neu aufgetretenen leitsymptomatischen Beschwerden');

        const tasks = [
            'Führen Sie eine strukturierte und gezielte Anamnese der aktuellen Beschwerden durch (inkl. Red Flags).',
            `Führen Sie eine fokussierte klinische Untersuchung (${specialtyId}) durch.`,
            'Erklären Sie der Patientin / dem Patienten am Ende Ihre Verdachtsdiagnose(n) sowie das geplante diagnostische und therapeutische Vorgehen in patientenverständlicher Sprache.'
        ];

        const openingQuote = isAcute
            ? `„Grüezi! Es hat plötzlich angefangen – vor allem macht mir ${chiefComplaintSummary} enorm zu schaffen!“`
            : `„Grüezi! Ich komme zu Ihnen, weil mir seit einiger Zeit ${chiefComplaintSummary} aufgefallen ist und es mich im Alltag zunehmend einschränkt.“`;

        const cornellRows = caseObj.case_overview?.cornell_notes || [];
        const cleanCornellExtracts = cornellRows.map(r => ({
            cue: (r.cues || [])[0] || 'Klinischer Kontext',
            text: stripHtmlTags(r.notes || '')
        }));

        const qaRows = [
            { topic: 'Hauptbeschwerde & Leitsymptom', answer: `„Im Vordergrund steht für mich: ${chiefComplaintSummary}.${hints[0] ? ' (' + hints[0] + ')' : ''}“` },
            { topic: 'Beginn, Dauer & zeitlicher Verlauf', answer: isAcute ? '„Es hat akut eingesetzt und hat sich rasch bis zum jetzigen Zustand entwickelt.“' : '„Es hat schleichend begonnen und nimmt im Verlauf langsam, aber stetig zu.“' },
            { topic: 'Charakter & Lokalisation (SOCRATES)', answer: `„Es betrifft genau die typische Region (${chiefComplaintSummary}). ${cascadeMap['05_Klinische Manifestation'] ? 'Ich merke vor allem: ' + cascadeMap['05_Klinische Manifestation'] + '.' : ''}“` },
            { topic: 'Auslöser & Risikofaktoren', answer: riskPathoTerms.length > 0 ? `„In meiner Vorgeschichte bzw. als Auslöser gab es Hinweise auf: ${riskPathoTerms.join(', ')}.${cascadeMap['01_Auslöser'] ? ' (' + cascadeMap['01_Auslöser'] + ')' : ''}“` : `„${cascadeMap['01_Auslöser'] || 'Einen äußeren Auslöser habe ich selbst nicht bemerkt.'}“` },
            { topic: 'Begleitsymptome & Systemüberblick', answer: hints[1] ? `„Zusätzlich ist mir aufgefallen: ${hints[1]}“` : '„Ich fühle mich insgesamt abgeschlagen und durch die Beschwerden verunsichert.“' },
            { topic: 'Vorerkrankungen, Medikation & Allergien', answer: '„Leichte arterielle Hypertonie. Keine bekannten Medikamentenallergien.“' }
        ];

        const caseClinicalManifestation = cascadeMap['05_Klinische Manifestation'] || hints[1] || 'Pathognomonischer Lokalbefund gemäß Krankheitsbild';
        const caseFuncTest = hints[3] || cascadeMap['04_Anatomische Konsequenz'] || 'Spezifischer Funktionstest wegweisend';
        const cleanStep1 = stripHtmlTags(step1Text).replace(/\[|\]/g, '');

        const physicalExam = [
            { area: 'Allgemeinzustand & Inspektion', finding: `Patient/in wach, orientiert. Klinisches Leitbild: ${caseClinicalManifestation}.` },
            { area: `Fokussierte Untersuchung (${specialtyId})`, finding: `${caseClinicalManifestation} (${caseFuncTest}).` }
        ];
        if (cleanStep1.length > 20) {
            physicalExam.push({ area: 'Klinischer Befund aus Fall-Akte', finding: cleanStep1.slice(0, 320) + (cleanStep1.length > 320 ? '…' : '') });
        }

        const labs = [
            { param: '🎯 Fall-Spezifischer Schlüsselparameter', value: cascadeMap['06_Diagnostischer Befund'] || hints[2] || diagTerms.join(', ') || 'Spezifisches Profil', ref: 'Goldstandard-Referenz', flag: '⚠️ Wegweisender Hauptbefund' },
            { param: 'Blutbild & CRP', value: 'Hb 134 g/l | Leuk 7.8 G/l | CRP 4.2 mg/l', ref: '120–160 g/l | 4–10 G/l | < 5 mg/l', flag: 'Basislabor' },
            { param: 'Natrium, Kalium & Kreatinin', value: 'Na 139 mmol/l | K 4.1 mmol/l | Krea 76 µmol/l', ref: '135–145 | 3.5–5.0 | 50–95 µmol/l', flag: 'Normal' }
        ];

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

        const allDiffs = Array.from(new Set([
            ...(caseObj.extra_tasks?.synapses_matrix?.diseases || []),
            ...(caseObj.extra_tasks?.library_entries || []).slice(0, 6)
        ])).filter(d => d && d.toLowerCase() !== primaryDisease.toLowerCase()).slice(0, 5);

        return {
            osce_id: `OSCE_${specialtyId.toUpperCase().replace(/[^A-Z]/g, '')}_${caseObj.case_id}`,
            specialty: specialtyId,
            title: `${specialtyId}: ${primaryDisease}`,
            source_case_id: caseObj.case_id,
            source_case_title: `${caseTitle} (Importierter App-Fall)`,
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
                    'Freundlich, kooperativ, berichtet strukturiert auf gezielte offene und geschlossene Fragen.',
                    `Zeigt bei der Untersuchung genau die zu „${primaryDisease}“ passenden Befunde.`
                ]
            },
            physical_exam: physicalExam,
            diagnostics_on_demand: {
                lab_note: 'NUR auf gezielte Anforderung der Kandidatin / des Kandidaten herausgeben:',
                labs: labs,
                imaging: imaging
            },
            examiner_info: {
                background: `${caseTitle} – Leitdiagnose: ${primaryDisease}. ${caseObj.case_overview?.summary || ''}`,
                goals: `Gezielte Anamnese und klinische Untersuchung im Fachbereich ${specialtyId}, Erkennen der Schlüsselbefunde von „${primaryDisease}“, Abgrenzung der wichtigsten Differenzialdiagnosen sowie Einleiten der Goldstandard-Diagnostik und Therapie.`,
                differentials: allDiffs.length > 0 ? allDiffs : ['Wichtigste Differentialdiagnose des Formenkreises'],
                therapy_plan: `${therapyTerms.length > 0 ? therapyTerms.join(' + ') + '. ' : ''}${cascadeMap['07_Therapeutische Intervention'] || 'Leitliniengerechte kausale und symptomatische Therapie.'}`
            },
            checklist: [
                { category: 'Anamnese', item: 'Begrüßung, Vorstellung mit Name und Funktion, strukturierte Exploration des Leitsymptoms (SOCRATES & Red Flags)', points: 2 },
                { category: 'Anamnese', item: 'Erfragt Begleitsymptome, Vorerkrankungen, Medikamente, Allergien, Noxen & Familienanamnese', points: 2 },
                { category: 'Klinische Untersuchung', item: `Händedesinfektion + strukturierte, auf ${specialtyId} fokussierte körperliche Untersuchung`, points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: `Benennt korrekt die Verdachtsdiagnose „${primaryDisease}“ sowie die wichtigsten Differenzialdiagnosen (${allDiffs.slice(0, 3).join(', ')})`, points: 3 },
                { category: 'Verdachtsdiagnose & Procedere', item: `Schlägt zielgerichtete Diagnostik (${diagTerms.join(', ') || 'Goldstandard'}) und Therapie (${therapyTerms.join(', ') || 'Leitlinientherapie'}) vor`, points: 3 },
                { category: 'Kommunikation', item: 'Kommuniziert empathisch, strukturiert und erklärt Verdachtsdiagnose sowie Procedere in patientenverständlicher Sprache', points: 2 }
            ]
        };
    }

    // ======================================================================
    // 08. MODAL DOM & STRIKTE FACHGEBIETS-AUSWAHL
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
                <div class="osce-modal-header">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, #0284c7, #0d9488); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
                            🩺
                        </div>
                        <div>
                            <div style="font-size:0.7rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent-cyan, #38bdf8);">
                                MEDCHECK CLINICAL SKILLS LAB · STRIKTE FACHGEBIETS-ENGINE V2.0
                            </div>
                            <h2 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-main);">
                                Interaktiver OSCE-Fallgenerator
                            </h2>
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.OSCEModule.promptPinCurrentCaseSpecialty()" title="Einen importierten App-Fall fest einer der 21 OSCE-Fachrichtungen zuordnen">
                            📌 Fall-Zuordnung anpassen
                        </button>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.OSCEModule.generateWithGeminiAI(this)">
                            ✨ KI-Feinschliff (Gemini)
                        </button>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.OSCEModule.copyOSCEPrompt(this)">
                            📋 OSCE-Prompt kopieren
                        </button>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.OSCEModule.printStation()">
                            🖨️ Drucken / PDF
                        </button>
                        <button type="button" class="action-btn secondary btn-sm" onclick="window.OSCEModule.closeModal()" style="padding:6px 12px; font-weight:800;">
                            ✕ Schließen
                        </button>
                    </div>
                </div>

                <div class="osce-modal-body">
                    <aside class="osce-config-sidebar">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <label style="font-size:0.74rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent-cyan, #38bdf8);">
                                    1. Fachrichtung wählen (21)
                                </label>
                                <span id="osce-active-spec-badge" style="font-size:0.72rem; color:#6ee7b7; font-weight:800;">Innere Medizin</span>
                            </div>
                            <div class="osce-specialty-grid" id="osce-specialty-grid"></div>
                        </div>

                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <label for="osce-source-case-select" style="font-size:0.74rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent-cyan, #38bdf8);">
                                    2. Fachspezifischer Fall
                                </label>
                                <label style="font-size:0.68rem; color:var(--text-muted); cursor:pointer; display:flex; align-items:center; gap:4px;" title="Aktivieren, falls du bewusst einen Fall aus einem anderen Ordner in dieses Fachgebiet konvertieren möchtest">
                                    <input type="checkbox" id="osce-cross-spec-toggle" onchange="window.OSCEModule.toggleCrossSpecialtyCases(this.checked)">
                                    Alle Fächer zeigen
                                </label>
                            </div>
                            <select id="osce-source-case-select" class="forge-topic-input" style="min-height:auto; padding:9px 12px; font-size:0.8rem; width:100%;" onchange="window.OSCEModule.onSourceCaseChange(this.value)"></select>
                        </div>

                        <div>
                            <label for="osce-setting-select" style="display:block; font-size:0.74rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px;">
                                3. Klinisches Setting
                            </label>
                            <select id="osce-setting-select" class="forge-topic-input" style="min-height:auto; padding:8px 12px; font-size:0.78rem; width:100%;" onchange="window.OSCEModule.onSettingChange(this.value)">
                                <option value="auto">🔄 Automatisch (fachspezifisch)</option>
                                <option value="allgemeinmedizinischen Praxis">🏥 Hausarztpraxis / Allgemeinmedizin</option>
                                <option value="interdisziplinären Notfallstation">🚨 Interdisziplinäre Notfallstation</option>
                                <option value="Spezialambulanz / Poliklinik">🩺 Spezialambulanz / Poliklinik</option>
                                <option value="Bettenstation (Stationsvisite)">🛏️ Bettenstation (Visite)</option>
                            </select>
                        </div>

                        <div style="display:flex; gap:6px; margin-top:2px;">
                            <button type="button" class="action-btn" style="flex:1; padding:10px; font-size:0.82rem;" onclick="window.OSCEModule.generateStation()">
                                🔄 Station laden
                            </button>
                            <button type="button" class="action-btn secondary" style="padding:10px 12px; font-size:0.82rem;" onclick="window.OSCEModule.pickRandomCaseForSpecialty()" title="Zufälligen passenden Fall aus GENAU diesem Fachgebiet wählen">
                                🎲 Zufallsfall (${selectedSpecialty.slice(0, 10)})
                            </button>
                        </div>

                        <div id="osce-match-info-box" style="padding:10px 12px; border-radius:10px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.28); font-size:0.73rem; color:var(--text-main); line-height:1.45;"></div>
                    </aside>

                    <main class="osce-station-viewport" id="osce-station-viewport"></main>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        return modal;
    }

    function renderSpecialtyButtons() {
        const grid = document.getElementById('osce-specialty-grid');
        const badge = document.getElementById('osce-active-spec-badge');
        if (!grid) return;

        grid.innerHTML = SPECIALTIES.map(spec => {
            const strictImportedMatches = getStrictCasesForSpecialty(spec.id).length;
            const totalAvailableForSpec = strictImportedMatches + 1; // +1 für den fachspezifischen Goldstandard-Referenzfall
            const isActive = spec.id === selectedSpecialty;
            return `
                <button type="button" class="osce-spec-btn ${isActive ? 'active' : ''}" onclick="window.OSCEModule.selectSpecialty('${spec.id.replace(/'/g, "\\'")}')">
                    <span>${spec.icon}</span>
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${spec.label}</span>
                    <span class="osce-spec-count" title="${strictImportedMatches} importierte Fälle + 1 Fach-Referenzstation">${totalAvailableForSpec}</span>
                </button>
            `;
        }).join('');

        if (badge) badge.textContent = selectedSpecialty;
    }

    function populateSourceCaseDropdown() {
        const select = document.getElementById('osce-source-case-select');
        const infoBox = document.getElementById('osce-match-info-box');
        if (!select) return;

        const strictMatches = getStrictCasesForSpecialty(selectedSpecialty);
        const refBlueprint = SPECIALTY_REFERENCE_BLUEPRINTS[selectedSpecialty];

        let html = '';

        // 1. Importierte App-Fälle, die STRIKT zu dieser Fachrichtung gehören
        if (strictMatches.length > 0) {
            html += `<optgroup label="🎯 Deine importierten Fälle für ${selectedSpecialty} (${strictMatches.length})">`;
            strictMatches.forEach(c => {
                const label = `${c.metadata?.primary_disease ? c.metadata.primary_disease + ' – ' : ''}${c.metadata?.title || c.case_id}`;
                html += `<option value="${c.case_id}">${label.slice(0, 78)}</option>`;
            });
            html += `</optgroup>`;
        }

        // 2. Maßgeschneiderter Goldstandard-Referenzfall für GENAU diese Fachrichtung
        if (refBlueprint) {
            html += `<optgroup label="⭐ Maßgeschneiderte ${selectedSpecialty}-Referenzstation">`;
            html += `<option value="BLUEPRINT:${selectedSpecialty}">🩺 ${refBlueprint.title}</option>`;
            html += `</optgroup>`;
        }

        // 3. Optional: Falls der User explizit "Alle Fächer zeigen" aktiviert hat
        if (showCrossSpecialtyCases) {
            const allCases = getAllImportedAppCases();
            const strictIds = new Set(strictMatches.map(c => c.case_id));
            const otherCases = allCases.filter(c => !strictIds.has(c.case_id));
            if (otherCases.length > 0) {
                html += `<optgroup label="🔓 Weitere Fälle aus anderen Fachrichtungen (${otherCases.length})">`;
                otherCases.forEach(c => {
                    const detectedSpec = classifyCasePrimarySpecialty(c) || c.folder_name || 'Allgemein';
                    const label = `[${detectedSpec}] ${c.metadata?.title || c.case_id}`;
                    html += `<option value="${c.case_id}">${label.slice(0, 78)}</option>`;
                });
                html += `</optgroup>`;
            }
        }

        select.innerHTML = html;

        // Sicherstellen, dass selectedSourceCaseId ein valider, fachspezifischer Treffer ist!
        const validOptionValues = Array.from(select.options).map(o => o.value);
        if (!validOptionValues.includes(selectedSourceCaseId)) {
            selectedSourceCaseId = strictMatches.length > 0
                ? strictMatches[0].case_id
                : `BLUEPRINT:${selectedSpecialty}`;
        }
        select.value = selectedSourceCaseId;

        if (infoBox) {
            infoBox.innerHTML = strictMatches.length > 0
                ? `✅ <strong>${strictMatches.length} importierte(r) Fall/Fälle</strong> aus deiner App + <strong>1 ${selectedSpecialty}-Referenzstation</strong> präzise für <strong>${selectedSpecialty}</strong> zugeordnet.`
                : `🎯 <strong>100 % Fach-Fokus (${selectedSpecialty}):</strong> Aktuell ist die spezifische ${selectedSpecialty}-Referenzstation geladen. Sobald du Fälle für ${selectedSpecialty} importierst oder über <em>„📌 Fall-Zuordnung“</em> zuweist, erscheinen sie automatisch hier oben.`;
        }
    }

    // ======================================================================
    // 09. RENDERER FÜR DIE AKTIVE OSCE-STATION
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

        const groupedChecklist = {};
        (d.checklist || []).forEach((item, idx) => {
            const cat = item.category || 'Allgemein';
            if (!groupedChecklist[cat]) groupedChecklist[cat] = [];
            groupedChecklist[cat].push({ ...item, idx });
        });

        viewport.innerHTML = `
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

                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="osce-timer-pill ${timerRemainingSec <= 120 && timerRemainingSec > 0 ? 'warning' : ''}" id="osce-timer-display">
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

            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; padding:4px 2px;">
                <div>
                    <span style="font-size:0.72rem; font-weight:800; padding:3px 10px; border-radius:999px; background:rgba(2,132,199,0.2); color:var(--accent-cyan, #38bdf8); border:1px solid rgba(56,189,248,0.35);">
                        OSCE-STATION · ${d.specialty.toUpperCase()}
                    </span>
                    <h3 style="margin:8px 0 2px 0; font-size:1.25rem; font-weight:800; color:var(--text-main);">
                        ${activeRoleMode === 'candidate' ? `OSCE-Posten ${d.specialty} (Prüfungs-Modus – Diagnose verdeckt)` : d.title}
                    </h3>
                    <div style="font-size:0.78rem; color:var(--text-muted);">
                        Quelle: <strong>${d.source_case_title || d.osce_id}</strong>
                    </div>
                </div>
            </div>

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
                        <div class="osce-vital-box"><div class="osce-vital-label">BMI / Gewicht</div><div class="osce-vital-val">${d.door_sign.vitals.bmi}</div></div>
                    </div>
                </section>
            ` : ''}

            ${showSP ? `
                <section class="osce-section-card">
                    <div class="osce-section-header">
                        <div class="osce-section-title">👩‍⚕️ Informationen für die/den Simulationspatientin/-patienten (SP)</div>
                        <input type="text" class="forge-topic-input" style="min-height:auto; padding:5px 10px; font-size:0.76rem; width:210px;" placeholder="🔍 Fragebereich filtern..." value="${spSearchFilter}" oninput="window.OSCEModule.filterSpTable(this.value)">
                    </div>

                    <div class="osce-sp-quote">
                        🗣️ Einstiegssatz: ${d.sp_script.opening_quote}
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
                        🔒 <strong>Spoiler-Schutz aktiv:</strong> Klicke oben auf <em>„🔬 Laborbefunde aufdecken“</em> oder <em>„🩻 Bildgebung aufdecken“</em>, sobald diese Diagnostik im Prüfungsgespräch konkret angefordert wird.
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
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${(d.diagnostics_on_demand.imaging || []).map(img => `
                            <div style="padding:12px 14px; border-radius:10px; background:var(--surface-primary); border:1px solid var(--card-border); font-size:0.85rem; line-height:1.5;">
                                <div style="font-weight:800; color:var(--accent-cyan, #38bdf8); margin-bottom:4px;">${img.modality}</div>
                                <div>${img.finding}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </section>

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

                <section class="osce-section-card">
                    <div class="osce-section-header">
                        <div class="osce-section-title">✅ Bewertungskriterien / Interaktive Checkliste</div>
                        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                            <span style="font-family:'JetBrains Mono',monospace; font-size:0.85rem; font-weight:800; color:${scorePct >= 60 ? '#10b981' : '#f59e0b'};">
                                Score: ${earnedPoints} / ${totalPoints} Pkt. (${scorePct}%)
                            </span>
                            <button type="button" class="action-btn secondary btn-sm" style="padding:4px 10px; font-size:0.72rem;" onclick="window.OSCEModule.saveMissedItemsToDepot()">
                                📌 Offene Punkte ins Lern-Depot
                            </button>
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
    // 10. STEUERUNG, MANUELLES PINNING, DEPOT-EXPORT & DRUCK
    // ======================================================================
    function selectSpecialty(specId) {
        selectedSpecialty = specId;
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);

        // WICHTIG: Beim Wechsel der Fachrichtung IMMER zuerst auf den besten fachspezifischen Fall schalten!
        const strictMatches = getStrictCasesForSpecialty(specId);
        selectedSourceCaseId = strictMatches.length > 0
            ? strictMatches[0].case_id
            : `BLUEPRINT:${specId}`;

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

    function toggleCrossSpecialtyCases(checked) {
        showCrossSpecialtyCases = !!checked;
        populateSourceCaseDropdown();
    }

    function pickRandomCaseForSpecialty() {
        const strictMatches = getStrictCasesForSpecialty(selectedSpecialty);
        const options = [
            ...strictMatches.map(c => c.case_id),
            `BLUEPRINT:${selectedSpecialty}`
        ];
        // Falls mehrere Optionen für genau dieses Fach existieren, rotiere zu einer anderen als der aktuellen
        const otherOptions = options.filter(id => id !== selectedSourceCaseId);
        const pool = otherOptions.length > 0 ? otherOptions : options;
        selectedSourceCaseId = pool[Math.floor(Math.random() * pool.length)];

        populateSourceCaseDropdown();
        generateStation();
    }

    function generateStation() {
        checkedCriteria = {};
        revealedSections = { exam: false, labs: false, imaging: false };

        if (selectedSourceCaseId.startsWith('BLUEPRINT:')) {
            const blueprintSpec = selectedSourceCaseId.replace('BLUEPRINT:', '');
            const blueprint = SPECIALTY_REFERENCE_BLUEPRINTS[blueprintSpec] || SPECIALTY_REFERENCE_BLUEPRINTS[selectedSpecialty] || SPECIALTY_REFERENCE_BLUEPRINTS['Innere Medizin'];
            currentOSCEData = JSON.parse(JSON.stringify(blueprint));
            renderActiveStation();
            return;
        }

        const allCases = getAllImportedAppCases();
        const targetCase = allCases.find(c => c.case_id === selectedSourceCaseId);

        if (!targetCase) {
            // Niemals auf einen fachfremden Fall zurückfallen, sondern immer auf den Blueprint des gewählten Fachs!
            const fallbackBlueprint = SPECIALTY_REFERENCE_BLUEPRINTS[selectedSpecialty] || SPECIALTY_REFERENCE_BLUEPRINTS['Innere Medizin'];
            currentOSCEData = JSON.parse(JSON.stringify(fallbackBlueprint));
        } else {
            currentOSCEData = synthesizeOSCEFromMedCheckCase(targetCase, selectedSpecialty, selectedSetting);
        }

        renderActiveStation();
    }

    // Erlaubt dem User, jeden importierten App-Fall per Dialog fest einer der 21 OSCE-Fachrichtungen zuzuordnen
    async function promptPinCurrentCaseSpecialty() {
        const allCases = getAllImportedAppCases();
        if (allCases.length === 0) return;

        const defaultCaseId = (!selectedSourceCaseId.startsWith('BLUEPRINT:')) ? selectedSourceCaseId : allCases[0].case_id;

        if (window.MedUI && typeof window.MedUI.openDialog === 'function') {
            const res = await window.MedUI.openDialog({
                kicker: 'OSCE-Fachgebiets-Zuordnung',
                title: 'Importierten Fall einem Fachgebiet zuordnen',
                message: 'Wähle einen importierten Fall und weise ihn fest einer der 21 OSCE-Fachrichtungen zu:',
                fields: [
                    {
                        id: 'caseId',
                        type: 'select',
                        label: 'Importierter App-Fall',
                        defaultValue: defaultCaseId,
                        options: allCases.map(c => ({
                            value: c.case_id,
                            label: `${c.metadata?.title || c.case_id} (aktuell: ${classifyCasePrimarySpecialty(c) || 'Unzugeordnet'})`
                        }))
                    },
                    {
                        id: 'specId',
                        type: 'select',
                        label: 'Ziel-Fachrichtung (OSCE)',
                        defaultValue: selectedSpecialty,
                        options: SPECIALTIES.map(s => ({ value: s.id, label: `${s.icon} ${s.label}` }))
                    }
                ],
                confirmText: 'Zuordnung speichern'
            });

            if (res && res.caseId && res.specId) {
                setPinnedCaseSpecialty(res.caseId, res.specId);
                selectedSpecialty = res.specId;
                selectedSourceCaseId = res.caseId;
                renderSpecialtyButtons();
                populateSourceCaseDropdown();
                generateStation();
            }
        }
    }

    // Überträgt nicht abgehakte Checklisten-Punkte direkt ins persönliche Lern-Depot
    async function saveMissedItemsToDepot() {
        if (!currentOSCEData || !Array.isArray(currentOSCEData.checklist)) return;
        const missed = currentOSCEData.checklist.filter((_, idx) => !checkedCriteria[idx]);
        if (missed.length === 0) {
            alert('Alle Checklisten-Kriterien wurden erfüllt (100 %)! Keine offenen Lücken vorhanden.');
            return;
        }

        const summaryText = missed.map(m => `• [${m.category}] ${m.item}`).join(' | ');
        if (typeof window.createDepotEntry === 'function' || typeof createDepotEntry === 'function') {
            const fn = window.createDepotEntry || createDepotEntry;
            await fn({
                case_id: currentOSCEData.osce_id,
                case_title: `OSCE: ${currentOSCEData.title}`,
                category: `OSCE ${currentOSCEData.specialty}`,
                cue_context: `${missed.length} vergessene Checklisten-Punkte`,
                highlighted_text: summaryText
            });
            alert(`📌 ${missed.length} offene Checklisten-Punkte wurden in dein persönliches Lern-Depot gespeichert!`);
        }
    }

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
                    if (pillEl) pillEl.classList.toggle('warning', timerRemainingSec <= 120 && timerRemainingSec > 0);
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

    async function generateWithGeminiAI(btnEl) {
        if (!currentOSCEData) return;
        const origHtml = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '⏳ Gemini generiert...';
        }
        try {
            const prompt = `Erstelle eine detaillierte Schweizer Staatsexamens-OSCE-Station für das Fachgebiet "${selectedSpecialty}" basierend auf folgendem Fall: ${JSON.stringify(currentOSCEData)}. Antworte ausschließlich als valides JSON im exakt selben Schema.`;
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
        } catch (_err) {
            alert('Die fachspezifische Station ist bereits vollständig geladen. (Für externe KIs kannst du „📋 OSCE-Prompt kopieren“ nutzen.)');
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origHtml;
            }
        }
    }

    async function copyOSCEPrompt(btnEl) {
        const promptText = `Erstelle eine Schweizer Staatsexamens-OSCE-Station für das Fachgebiet "${selectedSpecialty}" als valides JSON basierend auf: ${JSON.stringify(currentOSCEData, null, 2)}`;
        try {
            await navigator.clipboard.writeText(promptText);
            if (btnEl) {
                const orig = btnEl.innerHTML;
                btnEl.innerHTML = '✓ Kopiert!';
                setTimeout(() => { btnEl.innerHTML = orig; }, 2000);
            }
        } catch (_e) {}
    }

    function printStation() {
        if (!currentOSCEData) return;
        revealedSections = { exam: true, labs: true, imaging: true };
        activeRoleMode = 'all';
        renderActiveStation();
        setTimeout(() => window.print(), 150);
    }

    async function openModal(initialSpecialty = null, initialCaseId = null) {
        const modal = ensureModalDOM();
        await ensureManifestCasesLoaded();

        if (initialSpecialty) selectedSpecialty = initialSpecialty;
        if (initialCaseId) {
            selectedSourceCaseId = initialCaseId;
        } else {
            const strictMatches = getStrictCasesForSpecialty(selectedSpecialty);
            selectedSourceCaseId = strictMatches.length > 0 ? strictMatches[0].case_id : `BLUEPRINT:${selectedSpecialty}`;
        }

        renderSpecialtyButtons();
        populateSourceCaseDropdown();
        generateStation();

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
        toggleCrossSpecialtyCases,
        pickRandomCaseForSpecialty,
        generateStation,
        promptPinCurrentCaseSpecialty,
        saveMissedItemsToDepot,
        generateWithGeminiAI,
        copyOSCEPrompt,
        printStation,
        classifyCasePrimarySpecialty,
        setRoleMode(mode) { activeRoleMode = mode; renderActiveStation(); },
        toggleSectionReveal(secKey) { revealedSections[secKey] = !revealedSections[secKey]; renderActiveStation(); },
        toggleChecklistItem(idx) {
            checkedCriteria[idx] = !checkedCriteria[idx];
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
            renderActiveStation();
        },
        resetChecklist() { checkedCriteria = {}; renderActiveStation(); },
        filterSpTable(val) { spSearchFilter = (val || '').trim().toLowerCase(); renderActiveStation(); },
        toggleTimer,
        setTimerDuration
    };
})();

window.OSCEModule = OSCEModule;
