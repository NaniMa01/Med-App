/* ==========================================================================
   MEDCHECK – INTERAKTIVER OSCE-FALLGENERATOR V2.1 (js/osce.js)
   ==========================================================================
   CHANGELOG V2.1 (ZERO-SPOILER DIAGNOSTICS):
   01. Strikte 2-Stufen-Trennung im Labor:
       - Stufe 1: Reine Rohwerte + saubere SI-Referenzbereiche (neutrale Farbe)
       - Stufe 2: Pathologie-Flags (↑/↓), Farb-Highlighting & klinische Interpretation
         (wahlweise Zeile für Zeile per Klick oder global aufdeckbar!)
   02. Strikte 2-Stufen-Trennung in der Bildgebung:
       - Stufe 1: Reine deskriptive Morphologie (EKG/Sono/Röntgen/CT/MRT)
       - Stufe 2: Radiologisch-klinische Diagnose & Beurteilung
   03. Präzisions-Klassifikator für alle 21 Fachgebiete + manifest.json Auto-Loader
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
            diseasePatterns: [/\befast\b/i, /\babdomen-sonographie/i, /\bcholezystolithiasis/i, /\baortenaneurysma-screening/i, /\bkompressionssonographie/i],
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
    // 02. MANUELLE FACHGEBIETS-ZUORDNUNG (PINNING)
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
    // 03. PRÄZISIONS-KLASSIFIKATOR FÜR IMPORTIERTE APP-FÄLLE
    // ======================================================================
    function classifyCasePrimarySpecialty(caseObj) {
        if (!caseObj) return null;
        const cId = caseObj.case_id || caseObj.id || '';

        const pinnedMap = getPinnedCaseSpecialtyMap();
        if (pinnedMap[cId]) return pinnedMap[cId];
        if (caseObj.osce_specialty && SPECIALTIES.some(s => s.id === caseObj.osce_specialty)) {
            return caseObj.osce_specialty;
        }
        if (caseObj.metadata?.osce_specialty && SPECIALTIES.some(s => s.id === caseObj.metadata.osce_specialty)) {
            return caseObj.metadata.osce_specialty;
        }

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

        const folderStr = `${caseObj.folder_name || ''} ${caseObj.metadata?.medical_field || ''}`.trim();
        const diseaseAndTitleStr = `${caseObj.metadata?.primary_disease || ''} ${caseObj.metadata?.title || ''} ${caseObj.case_overview?.topic || ''}`.trim();

        let bestSpec = null;
        let bestScore = 0;

        for (const spec of SPECIALTIES) {
            let score = 0;
            const isBlacklisted = (spec.blacklist || []).some(rx => rx.test(diseaseAndTitleStr));
            if (isBlacklisted) continue;

            for (const rx of (spec.folderPatterns || [])) {
                if (rx.test(folderStr)) score += 80;
            }
            for (const rx of (spec.diseasePatterns || [])) {
                if (rx.test(diseaseAndTitleStr)) score += 60;
                else if (rx.test(folderStr)) score += 45;
            }

            if (score > bestScore) {
                bestScore = score;
                bestSpec = spec.id;
            }
        }

        return bestScore >= 45 ? bestSpec : null;
    }

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
    // 04. 21 FACHSPEZIFISCHE SCHWEIZER OSCE-REFERENZFÄLLE (ZERO-SPOILER)
    //     Alle Referenzbereiche und Rohwerte sind strikt frei von Spoilern!
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
                vitals: { bp: '95/60 mmHg', hr: '110/min', rr: '22/min', temp: '37,8 °C', spo2: '97 % (Raumluft)', bmi: '26 kg/m²' }
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
                    { param: 'Leukozyten', value: '14.8 G/l', ref: '4.0–10.0 G/l', flag: '↑ Leukozytose (Stress / beginnende Durchwanderung)' },
                    { param: 'CRP', value: '42 mg/l', ref: '< 5.0 mg/l', flag: '↑ Systemische Entzündungsreaktion' },
                    { param: 'Hämoglobin (Hb) / Hämatokrit', value: '162 g/l (Hk 0.49)', ref: '135–175 g/l (Hk 0.40–0.50)', flag: 'Hämokonzentration durch intraluminalen Flüssigkeitsverlust' },
                    { param: 'Kalium', value: '3.1 mmol/l', ref: '3.5–5.0 mmol/l', flag: '↓ Hypokaliämie durch schwallartiges Erbrechen' },
                    { param: 'Natrium & Chlorid', value: 'Na 133 mmol/l | Cl 92 mmol/l', ref: 'Na 135–145 | Cl 98–107 mmol/l', flag: '↓ Hyponatriämie & Hypochlorämie' },
                    { param: 'Kreatinin', value: '138 µmol/l', ref: '62–106 µmol/l', flag: '↑ Prärenale akute Nierenschädigung (AKI) bei Hypovolämie' },
                    { param: 'BGA & Laktat', value: 'pH 7.47 | Laktat 2.6 mmol/l', ref: 'pH 7.35–7.45 | Laktat < 1.8 mmol/l', flag: '⚠️ Laktaterhöhung (Warnzeichen für Darmwandischämie!) + metabolische Alkalose' },
                    { param: 'Lipase & ALT', value: 'Lipase 38 U/l | ALT 24 U/l', ref: '< 60 U/l | < 50 U/l', flag: 'Normal (Ausschluss akute Pankreatitis)' }
                ],
                imaging: [
                    {
                        modality: 'Abdomen-Sonographie & Röntgen-Abdomenübersicht',
                        finding: 'Multiple flüssigkeitsgefüllte, auf 3.8 cm dilatierte Dünndarmschlingen mit Pendelperistaltik sowie stehende Luft-Flüssigkeits-Spiegel. Kolonrahmen weitgehend luftleer.',
                        interpretation: 'Sonographisches „Klaviertastenphänomen“ und Röntgen-Spiegelbildung passend zu einem kompletten Dünndarm-Passagestopp.'
                    },
                    {
                        modality: 'CT Abdomen/Becken mit i.v. KM',
                        finding: 'Abrupter Kalibersprung des distalen Ileums im rechten Unterbauch unmittelbar angrenzend an die Bauchwandnarbe; vorgeschaltete Dünndarmdilatation auf 4.2 cm, noch erhaltene Wandkontrastierung.',
                        interpretation: 'Mechanischer Dünndarmileus durch strangulierende Bride (Adhäsion nach Appendektomie) mit OP-Indikation.'
                    }
                ]
            },
            examiner_info: {
                background: 'Mechanischer Dünndarmileus (Bridenileus nach Appendektomie vor 25 Jahren) mit Volumenmangel, Hypokaliämie und beginnender Laktaterhöhung.',
                goals: 'SOCRATES-Anamnese, Ileus-Trias erkennen, Abdomen-Untersuchung in korrekter Reihenfolge (Inspektion → Auskultation → Perkussion → Palpation → DRU), Soforttherapie „Drip & Drain“ + CT Abdomen.',
                differentials: ['Mechanischer Bridenileus', 'Inkarzerierte Hernie', 'Mesenterialischämie', 'Stenosierendes Kolonkarzinom'],
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
                lab_note: 'NUR bei gezielter Nachfrage:',
                labs: [
                    { param: 'Ferritin im Serum', value: '18 µg/l', ref: '30–150 µg/l', flag: '↓ Erniedrigt (Eisenmangel im ZNS triggert/verstärkt RLS; Zielwert bei RLS > 50–75 µg/l!)' },
                    { param: 'Hämoglobin (Hb) & MCV', value: 'Hb 128 g/l | MCV 84 fl', ref: '120–160 g/l | 80–98 fl', flag: 'Normal (Speichereisenmangel noch ohne manifeste Anämie)' },
                    { param: 'Kreatinin & eGFR', value: '68 µmol/l (eGFR > 90 ml/min)', ref: '45–84 µmol/l', flag: 'Normal (Ausschluss urämisches RLS)' },
                    { param: 'Vitamin B12, Folsäure & TSH', value: 'B12 410 pmol/l | TSH 1.8 mU/l', ref: '> 200 pmol/l | 0.4–4.0 mU/l', flag: 'Normal (Ausschluss B12-Mangel-PNP & Hypothyreose)' }
                ],
                imaging: [
                    {
                        modality: 'Apparative Zusatzdiagnostik (Doppler / ENG / Polysomnographie)',
                        finding: 'Knöchel-Arm-Index (ABI) 1.1 beidseits. Nervenleitgeschwindigkeit (ENG) des N. suralis und N. tibialis normwertig.',
                        interpretation: 'Ausschluss einer pAVK oder Polyneuropathie; RLS ist eine klinische Diagnose (Polysomnographie nur bei Therapieresistenz).'
                    }
                ]
            },
            examiner_info: {
                background: 'Erstvorstellung einer Patientin mit typischem Restless-Legs-Syndrom (RLS) bei positiver Familienanamnese und erniedrigtem Serum-Ferritin (18 µg/l).',
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
                    { topic: 'Ophthalmologische Vorgeschichte (Brille)', answer: '„Ich bin stark weitsichtig (+5.5 Dioptrien bds.), bisher noch keine Katarakt-OP gehabt.“' },
                    { topic: 'Vorerkrankungen & Medikamente', answer: '„Bluthochdruck (Candesartan). Gestern habe ich wegen Erkältung ein neues Nasenspray und ein Kombi-Erkältungspräparat genommen.“' }
                ],
                behavior: ['Hält sich die linke Stirn/Schläfe, kneift das linke Auge leicht zu, wirkt durch die Übelkeit stark mitgenommen.']
            },
            physical_exam: [
                { area: 'Inspektion & Konjunktiven', finding: 'Links ausgeprägte gemischte (konjunktivale und ziliare) Gefäßinjektion, Hornhaut matt/getrübt. Rechtes Auge reizlos.' },
                { area: 'Pupillenmotorik', finding: 'Links mittelweite, entrundete und lichtstarre Pupille (direkte & konsensuelle Lichtreaktion links aufgehoben). Rechts normal.' },
                { area: 'Digitale Bulbuspalpation (im Seitenvergleich)', finding: 'Linker Bulbus bei Palpation durch das geschlossene Oberlid steinhart! Rechter Bulbus normoton.' },
                { area: 'Orientierende Visusprüfung', finding: 'Links Visuscc auf Handbewegungen reduziert; rechts Visuscc 0.9.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Kreatinin / eGFR & Kalium', value: 'Krea 74 µmol/l | K 4.2 mmol/l', ref: '45–84 µmol/l | 3.5–5.0 mmol/l', flag: 'Normal (Keine Kontraindikation für i.v. Carboanhydrasehemmer / Acetazolamid)' },
                    { param: 'CRP & BSG', value: 'CRP 2.1 mg/l | BSG 12 mm/h', ref: '< 5.0 mg/l | < 20 mm/h', flag: 'Normal (Spricht gegen Arteriitis temporalis)' }
                ],
                imaging: [
                    {
                        modality: 'Applanationstonometrie nach Goldmann, Spaltlampe & Gonioskopie',
                        finding: 'Augeninnendruck (IOD) links 58 mmHg, rechts 16 mmHg (Referenz 10–21 mmHg). Spaltlampe: diffuses Hornhautepithelödem, extrem flache Vorderkammer, Kammerwinkel zirkulär verschlossen.',
                        interpretation: 'Beweisend für akuten Winkelblockglaukom-Anfall links (Pupillarblock bei flacher Vorderkammer).'
                    }
                ]
            },
            examiner_info: {
                background: 'Akuter Winkelblockglaukom-Anfall links bei prädisponierter hyperoper Patientin, ausgelöst durch Mydriasis im dunklen Kino und sympathomimetische Erkältungsmedikation.',
                goals: 'Klassische Trias erkennen (einseitig rotes schmerzhaftes Auge + Visusminderung/Halos/Übelkeit + steinharter Bulbus mit mittelweiter lichtstarrer Pupille), sofortige medikamentöse IOD-Senkung + YAG-Laser-Iridotomie.',
                differentials: ['Akute Iritis / Uveitis anterior (dort Miosis & Hypotonie/Normotonie!)', 'Akute Konjunktivitis / Keratitis', 'Subarachnoidalblutung / Migräneanfall'],
                therapy_plan: 'Sofortige Notfalltherapie: 1. Acetazolamid (Diamox) 500 mg i.v., 2. Topisch: Timolol 0.5% AT + Pilocarpin 1–2% AT (Miotikum) + Prednisolon AT, 3. Ggf. Mannitol 20% i.v., 4. Kausale Therapie: YAG-Laser-Iridotomie (beidseits!).'
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
                    { topic: 'Eintrittspforte (Zehenzwischenräume)', answer: '„Ja, zwischen meinen Zehen juckt und schuppt die Haut schon seit Monaten, da sind kleine Risse.“' },
                    { topic: 'Vorerkrankungen & Medikamente', answer: '„Diabetes mellitus Typ 2 (Metformin 1000 mg 1-0-1) und leichte Venenschwäche.“' },
                    { topic: 'Allergien & Thrombose-Hinweise', answer: '„Keine Penicillin-Allergie bekannt. Keine lange Reise, keine Operation gehabt.“' }
                ],
                behavior: ['Fiebrig, schont das rechte Bein beim Auftreten, kooperativ.']
            },
            physical_exam: [
                { area: 'Inspektion rechter Unterschenkel', finding: 'Scharf begrenzte, hellrote, flammenförmige („kartenblattartige“) Rötung und Schwellung prätibial rechts. Keine Nekrosen, kein Hautknistern.' },
                { area: 'Inspektion Zehenzwischenräume', finding: 'Mazeration und weißliche Schuppung mit schmerzhaften Rhagaden zwischen Dig. IV und V rechts.' },
                { area: 'Palpation & Lymphknotenstatus', finding: 'Deutliche Überwärmung und Druckdolenz, zarte rote Streifen Richtung Leiste und druckdolenter Lymphknoten inguinal rechts. Fußpulse bds. kräftig.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Leukozyten', value: '15.6 G/l', ref: '4.0–10.0 G/l', flag: '↑ Ausgeprägte neutrophile Leukozytose' },
                    { param: 'CRP', value: '118 mg/l', ref: '< 5.0 mg/l', flag: '↑↑ Akute bakterielle Weichteilinfektion' },
                    { param: 'Glukose & Kreatinin', value: 'Glukose 8.9 mmol/l | Krea 82 µmol/l', ref: '3.9–5.6 mmol/l | 62–106 µmol/l', flag: 'Leichte Hyperglykämie bei bekanntem Diabetes mellitus' }
                ],
                imaging: [
                    {
                        modality: 'Kompressionssonographie der Beinvenen',
                        finding: 'V. femoralis communis, V. poplitea und tiefe Unterschenkelvenen vollständig komprimierbar, echofreies Lumen. Subkutanes Gewebeödem.',
                        interpretation: 'Ausschluss einer tiefen Beinvenenthrombose (TVT); subkutanes Lymphödem bei Erysipel.'
                    }
                ]
            },
            examiner_info: {
                background: 'Klassisches akutes Erysipel (beta-hämolysierende Streptokokken der Gruppe A / S. pyogenes) mit Eintrittspforte Tinea pedis interdigitalis bei Diabetes mellitus.',
                goals: 'Scharf begrenztes Erythem + Fieber erkennen, zwingend die Zehenzwischenräume als Eintrittspforte inspizieren, Rötungsgrenze mit Stift markieren und Penicillin-Therapie + antimykotische Sanierung der Eintrittspforte einleiten.',
                differentials: ['Tiefe Beinvenenthrombose (TVT)', 'Phlegmone (unscharf begrenzt, tieferreichend, oft S. aureus)', 'Nekrotisierende Fasziitis', 'Stauungsdermatitis bei CVI'],
                therapy_plan: '1. Rötungsgrenze mit Hautmarker anzeichnen, 2. Systemische Antibiose: Penicillin G i.v. (oder Amoxicillin) für 7–10 Tage, 3. Eintrittspforte sanieren (topisches Antimykotikum wie Terbinafin für Tinea pedis!), 4. Bein hochlagern, Kühlung, Analgesie, Thromboseprophylaxe (NMH).'
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
                    { topic: 'Unfallmechanismus', answer: '„Ski verkantet, Unterschenkel nach außen gedreht und Knie nach innen weggeknickt, Bindung ging nicht auf.“' },
                    { topic: 'Sofortsymptomatik & Ergussverlauf', answer: '„Ein hörbares ‚Plopp‘/Zerreißgefühl. Innerhalb von 2 Stunden ist das Knie dick angeschwollen.“' },
                    { topic: 'Instabilitätsgefühl (Giving-way)', answer: '„Ja, beim Versuch aufzustehen hatte ich das Gefühl, der Unterschenkel rutscht mir unter dem Oberschenkel weg.“' },
                    { topic: 'Beruf & Sportliches Anspruchsniveau', answer: '„Physiotherapeut, spiele aktiv Volleyball und gehe viel Skifahren.“' }
                ],
                behavior: ['Kommt hinkend, kann das rechte Knie wegen des Gelenkergusses nicht ganz durchstrecken.']
            },
            physical_exam: [
                { area: 'Inspektion & Ergussprüfung', finding: 'Deutliche Schwellung des rechten Kniegelenks mit verstrichenen Konturen. Tanzende Patella (Ballottement) positiv.' },
                { area: 'Beweglichkeit (Neutral-Null-Methode)', finding: 'Extension/Flexion rechts schmerz- und ergussbedingt 0-15-95° (links 5-0-140°).' },
                { area: 'Lachman-Test & Schubladen-Prüfung', finding: 'Lachman-Test in 20–30° Flexion mit vermehrter anteriorer Translation der Tibia und weichem/fehlendem Anschlag. Hintere Schublade negativ.' },
                { area: 'Kollateralbänder (Valgus-/Varusstress in 0° und 30°)', finding: 'Valgusstress in 30° leicht druckschmerzhaft über dem medialen Seitenband, aber fester Anschlag; lateral stabil.' },
                { area: 'Meniskus-Zeichen & pDMS', finding: 'Druckschmerz über dem medialen Gelenkspalt, Schmerzangabe medial bei Außenrotation des Unterschenkels (Steinmann I positiv). pDMS allseits intakt.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Quick / INR & Thrombozyten', value: 'INR 1.0 | Thrombozyten 245 G/l', ref: 'INR 0.9–1.15 | 150–400 G/l', flag: 'Normal (Normale Gerinnung für Punktion / OP)' }
                ],
                imaging: [
                    {
                        modality: 'Röntgen Kniegelenk rechts in 2 Ebenen (+ Patella axial)',
                        finding: 'Regelrechte Artikulation, keine kortikale Stufenbildung an Femur, Tibia oder Patella, Eminentia intercondylaris intakt, Weichteilschatten suprapatellär verbreitert.',
                        interpretation: 'Ausschluss einer knöchernen Fraktur / knöchernen Bandausriss; ausgeprägter Gelenkerguss.'
                    },
                    {
                        modality: 'MRT Kniegelenk rechts (T1/T2/PD-fs)',
                        finding: 'Kontinuitätsunterbrechung der Fasern in der Fossa intercondylaris mit ödematöser Auftreibung, subchondrales Knochenmarködem am lateralen Femurkondylus und posterolateralen Tibiaplateau sowie longitudinaler Riss im Hinterhorn des medialen Meniskus.',
                        interpretation: 'Komplette vordere Kreuzbandruptur (VKB) mit typischem „Kissing Bone Bruise“ und begleitender Innenmeniskusläsion.'
                    }
                ]
            },
            examiner_info: {
                background: 'Akute vordere Kreuzbandruptur (VKB) mit Begleitläsion des Innenmeniskus und MCL-Zerrung („Unhappy Triad“-Konstellation) nach Valgus-Flexions-Außenrotations-Trauma.',
                goals: 'Unfallmechanismus und raschen Hämarthros (< 2–4 h) als Hinweis auf VKB-Ruptur erkennen, Lachman-Test als sensitivsten Akuttest korrekt durchführen, Röntgen zum Frakturausschluss + MRT anordnen.',
                differentials: ['Isolierte Meniskusläsion', 'Patellaluxation', 'Tibiakopffraktur / knöcherner Bandausriss', 'Hintere Kreuzbandruptur'],
                therapy_plan: 'Akut: PECH-Schema, NSAR, Teilbelastung an Gehstöcken, Physiotherapie. Aufgrund des jungen Alters, hohen Sportanspruchs und der begleitenden Innenmeniskusläsion: Arthroskopische VKB-Ersatzplastik + Meniskusnaht.'
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
                { area: 'Hinweis zur Station', finding: 'Reine Kommunikations-Station. Fokus liegt auf Gesprächsstruktur (SPIKES) und nonverbaler/verbaler Empathie (NURSE).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'Befunde liegen für das Aufklärungsgespräch vor:',
                labs: [
                    { param: 'CEA & Hämoglobin (Hb)', value: 'CEA 18.4 µg/l | Hb 112 g/l', ref: '< 5.0 µg/l | 120–160 g/l', flag: '↑ Tumormarker CEA erhöht, milde Anämie' }
                ],
                imaging: [
                    {
                        modality: 'Histologie Koloskopie & Staging-CT Thorax/Abdomen',
                        finding: 'Raumforderung im Colon sigmoideum (histologisch: invasives Adenokarzinom, G2, MSS) sowie zwei scharf begrenzte hypodense Läsionen im Lebersegment VI (1.8 cm und 1.4 cm). Lunge frei.',
                        interpretation: 'Synchrone, oligometastasierte Erkrankung (UICC-Stadium IV), jedoch beide Lebermetastasen im Segment VI anatomisch gut resektabel (potenziell kuratives multimodales Therapiekonzept!).'
                    }
                ]
            },
            examiner_info: {
                background: 'Überbringen einer Erstdiagnose Kolonkarzinom mit synchroner, aber resektabler Oligometastasierung der Leber.',
                goals: 'SPIKES-Schritte (Setting, Perception, Invitation, Knowledge mit „Warning Shot“, Emotions mit Schweigepause & NURSE, Strategy & Summary) vorbildlich anwenden.',
                differentials: ['Akute Belastungsreaktion', 'Informationsüberflutung nach Schockdiagnose'],
                therapy_plan: 'Vorstellung im interdisziplinären Tumorboard morgen, psychoonkologische Mitbetreuung anbieten, Folgetermin gemeinsam mit Angehörigen vereinbaren.'
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
                vignette: 'Herr/Frau Berger kommt völlig aufgelöst mit dem 18 Monate alten Sohn Leo auf die Notfallstation, nachdem Leo zu Hause bei hohem Fieber plötzlich am ganzen Körper gezuckt habe.',
                tasks: [
                    'Erheben Sie eine präzise Fremdanamnese zum Anfallsereignis (Kriterien einfach vs. kompliziert) und zur Fieberursache.',
                    'Untersuchen Sie das Kind fokussiert auf Meningismus und Infektfokus.',
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
                    { topic: 'Entwicklung, Impfstatus & Familienanamnese', answer: '„Altersgerecht entwickelt, alle Impfungen nach Schweizer Impfplan. Ich selbst hatte als Kleinkind auch zweimal Fieberkrämpfe!“' }
                ],
                behavior: ['Hochgradig ängstliches Elternteil, hat Angst vor bleibendem Hirnschaden oder Epilepsie.']
            },
            physical_exam: [
                { area: 'Pediatric Assessment Triangle & Neurostatus', finding: 'Kind wach, weint bei Untersuchung, tröstbar durch Elternteil. Kein fokal-neurologisches Defizit, keine Todd-Parese.' },
                { area: 'Meningismus-Prüfung (Nackensteifigkeit, Brudzinski, Kernig)', finding: 'Kopf frei beweglich, kein Meningismus! Fontanelle altersentsprechend geschlossen.' },
                { area: 'HNO-, Lungen- & Hautstatus', finding: 'Pharynx und beide Trommelfelle deutlich gerötet. Lunge frei, Haut ohne Petechien.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Kapillärer Blutzucker', value: '5.4 mmol/l', ref: '3.5–6.0 mmol/l', flag: 'Normal (Ausschluss einer hypoglykämischen Krampfursache)' }
                ],
                imaging: [
                    {
                        modality: 'Weiterführende Diagnostik (Lumbalpunktion / EEG / cMRT)',
                        finding: 'Wurde klinisch nicht durchgeführt.',
                        interpretation: 'Wichtige Leitlinien-Regel: Beim klinisch eindeutigen unkomplizierten Fieberkrampf (> 12–18 Mt., rasche Aufklaren, kein Meningismus) sind Blutentnahme, LP, EEG und cMRT NICHT indiziert!'
                    }
                ]
            },
            examiner_info: {
                background: 'Klassischer unkomplizierter (einfacher) Fieberkrampf bei einem 18 Monate alten Kleinkind im Rahmen eines viralen Infekts der oberen Atemwege bei positiver Familienanamnese.',
                goals: 'Kriterien des unkomplizierten Fieberkrampfes abfragen (Alter 6 Mt. – 5 J., generalisiert, Dauer < 15 Min., kein Rezidiv innerhalb 24 h, rasche Reorientierung), Meningitis klinisch ausschließen, Eltern empathisch entlasten und Notfallmedikament erklären.',
                differentials: ['Bakterielle Meningitis / Meningoenzephalitis', 'Komplizierter Fieberkrampf (fokal, > 15 Min. oder mehrfach in 24 h)', 'Erstmanifestation einer Epilepsie'],
                therapy_plan: 'Antipyrese zur Symptomlinderung (Paracetamol / Ibuprofen gewichtsadaptiert), Aufklärung über stabile Seitenlage, Blick auf die Uhr und Rezeptierung von Diazepam-Rektiole (5 mg) bzw. Midazolam bukkal bei Anfallsdauer > 3–5 Minuten.'
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
                    'Führen Sie die klinische und gynäkologische Untersuchung durch.',
                    'Besprechen Sie die Verdachtsdiagnose und das unmittelbare operative Vorgehen mit der Patientin.'
                ],
                vitals: { bp: '98/62 mmHg', hr: '108/min', rr: '18/min', temp: '36,9 °C', spo2: '99 %', bmi: '22 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Vor zwei Stunden hat es mir plötzlich wie mit einem Messer rechts unten in den Bauch gestochen, und beim Aufstehen im Bad bin ich fast ohnmächtig geworden!“',
                qa_rows: [
                    { topic: 'Letzte Periode & Zyklusanamnese', answer: '„Meine letzte reguläre Periode war vor knapp 7 Wochen. Seit gestern habe ich eine leichte bräunliche Schmierblutung.“' },
                    { topic: 'Verhütung & Schwangerschaftstest', answer: '„Wir haben einen Kinderwunsch und verhüten seit 6 Monaten nicht mehr. Einen Test habe ich noch nicht gemacht.“' },
                    { topic: 'Schmerzausstrahlung', answer: '„Starke Schmerzen im rechten Unterbauch (NRS 8/10), und im Liegen zieht es bis in meine rechte Schulter.“' },
                    { topic: 'Gynäkologische Vorgeschichte', answer: '„Vor 3 Jahren hatte ich eine Chlamydien-bedingte Eileiterentzündung.“' }
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
                    { param: 'Urin-hCG & Serum-beta-hCG', value: 'Positiv | 3.850 IU/l', ref: '< 5 IU/l', flag: '↑↑ Positiver Schwangerschaftsnachweis (oberhalb der sonographischen Diskriminationsgrenze von 1500 IU/l!)' },
                    { param: 'Hämoglobin (Hb)', value: '102 g/l', ref: '120–160 g/l', flag: '↓ Akute Blutungsanämie' },
                    { param: 'Blutgruppe & Rhesusfaktor', value: 'A Rh-negativ (Antikörpersuchtest negativ)', ref: 'Blutgruppenbestimmung', flag: '⚠️ Rhesus-negativ: Zwingend Anti-D-Prophylaxe erforderlich!' }
                ],
                imaging: [
                    {
                        modality: 'Transvaginale Sonographie (TVS)',
                        finding: 'Cavum uteri leer mit hochaufgebautem Endometrium (14 mm). Rechts paraovariell kokardenförmige Struktur (2.4 cm) sowie reichlich echoreiche freie Flüssigkeit im Douglas-Raum und Morrison-Pouch.',
                        interpretation: 'Rupturierte Tubargravidität rechts („Bagel-Sign“ + leerer Uterus bei beta-hCG > 1500 IU/l) mit ausgeprägtem Hämatoperitoneum.'
                    }
                ]
            },
            examiner_info: {
                background: 'Rupturierte Tubargravidität (Extrauteringravidität, 7. SSW) rechts mit Hämatoperitoneum und beginnender hämodynamischer Instabilität nach früherer Chlamydien-Adnexitis.',
                goals: 'Klassische Trias (sekundäre Amenorrhoe ~6–8 SSW + Schmierblutung + einseitiger Unterbauchschmerz/Portioschiebeschmerz) erkennen, beta-hCG + transvaginalen Ultraschall anfordern, Notfall-Laparoskopie und Anti-D-Prophylaxe (bei Rh-negativ!) einleiten.',
                differentials: ['Rupturierte Ovarialzyste / Corpus-luteum-Blutung', 'Ovarialtorsion', 'Akute Appendizitis', 'Abortus incompletus'],
                therapy_plan: 'Sofortige Volumengabe (2 großlumige Zugänge), Bereitstellung von Erythrozytenkonzentraten, dringliche operative Laparoskopie (Salpingotomie vs. Salpingektomie) sowie Anti-D-Immunglobulin.'
            },
            checklist: [
                { category: 'Anamnese', item: 'Erfragt exakt den ersten Tag der letzten Periode (Amenorrhoe!), Verhütung, vaginale Blutung, Schulterschmerz (Kehr-Zeichen) und Risikofaktoren (Adnexitis/Chlamydien)', points: 3 },
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
                { area: 'Wirbelsäule & Neurostatus', finding: 'Klopfschmerz über LWK 3/4, Kraft 5/5 in beiden Beinen, Reithosensensibilität und Sphinktertonus intakt.' },
                { area: 'Abdomen', finding: 'Verhärtete Stuhlwalze im linken Unterbauch tastbar, Darmgeräusche spärlich.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Kreatinin & eGFR', value: '142 µmol/l (eGFR 42 ml/min)', ref: '62–106 µmol/l (eGFR > 60 ml/min)', flag: '↓ Moderates CKD G3b (Cave: Kumulation aktiver Morphin-Metabolite M6G/M3G → Rotation auf Hydromorphon/Buprenorphin sinnvoll!)' },
                    { param: 'Kalzium (albumin-korrigiert)', value: '2.48 mmol/l', ref: '2.15–2.55 mmol/l', flag: 'Normal (Ausschluss einer malignen Hyperkalzämie)' }
                ],
                imaging: [
                    {
                        modality: 'MRT Lendenwirbelsäule',
                        finding: 'Sklerosierende Raumforderung im Wirbelkörper LWK 4 mit Infiltration des rechten Neuroforamens L4/L5, jedoch ohne Kompression des Duralsacks/Conus medullaris.',
                        interpretation: 'Ossäre Metastase LWK 4 mit neuropathischer Wurzelreizung L4 rechts (gut zugänglich für lokale analgetische Radiotherapie), kein akutes Kauda-Syndrom.'
                    }
                ]
            },
            examiner_info: {
                background: 'Unzureichend eingestellter gemischter Tumorschmerz (nozizeptiv-ossär + neuropathisch) bei ossär metastasiertem Prostatakarzinom sowie unbehandelte Opioid-induzierte Obstipation (OIC) und fehlende schnellwirksame Opioid-Bedarfsmedikation.',
                goals: '1/6-Regel für Durchbruchschmerz berechnen, obligate Laxanzien-Prophylaxe (Macrogol), Ko-Analgetikum (Pregabalin/Dexamethason) und analgetische lokale Radiotherapie einplanen.',
                differentials: ['Malignes Myelonkompressionssyndrom (Red Flag!)', 'Hyperkalzämie-Syndrom bei Knochenmetastasen'],
                therapy_plan: '1. Retard-Opioid anpassen bzw. Rotation auf Hydromorphon wegen eingeschränkter eGFR, 2. Schnellwirksames Opioid für Durchbruchschmerzen fest verordnen (1/6 der Tagesdosis!), 3. Fixe Laxanzien-Therapie (Macrogol), 4. Ko-Analgetikum (Pregabalin) + lokale Schmerzbestrahlung LWK 4.'
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
                    { topic: 'Neurologische Red Flags', answer: '„Nein, keine Doppelbilder, kein Taubheitsgefühl im Gesicht, keine Schluck-/Sprachstörung.“' }
                ],
                behavior: ['Hält sich am Stuhl fest, Übelkeit bei schnellen Kopfbewegungen.']
            },
            physical_exam: [
                { area: 'Otoskopie beidseits', finding: 'Gehörgang und Trommelfell beidseits reizlos und spiegelnd, keine Bläschen.' },
                { area: 'Stimmgabelversuche nach Weber & Rinne (512 Hz)', finding: 'Weber lateralisiert nach LINKS; Rinne beidseits positiv (Luftleitung > Knochenleitung).' },
                { area: 'Spontannystagmus (Frenzelbrille) & HINTS', finding: 'Horizontal-rotatorischer Spontannystagmus nach links. Keine vertikale Skew Deviation, Blickrichtungsnystagmus negativ.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Natrium, Kalium, Glukose, CRP', value: 'Na 140 mmol/l | K 4.0 mmol/l | Gluk 5.2 mmol/l | CRP 1.1 mg/l', ref: '135–145 | 3.5–5.0 | 3.9–5.6 mmol/l | < 5 mg/l', flag: 'Normal' }
                ],
                imaging: [
                    {
                        modality: 'Reintonaudiogramm (Tonschwellenaudiometrie)',
                        finding: 'Rechtsseitig identischer Abfall von Luft- und Knochenleitung (keine Schallleitungskomponente) im Frequenzbereich 125–1000 Hz um 45 dB; linkes Ohr normakusisch.',
                        interpretation: 'Cochleäre Tiefton-Schallempfindungsschwerhörigkeit rechts – bestätigt zusammen mit Drehschwindel (20 Min.–12 h) und Tinnitus die Menière-Trias (endolymphatischer Hydrops).'
                    }
                ]
            },
            examiner_info: {
                background: 'Klassischer Morbus Menière rechts (endolymphatischer Hydrops) mit der pathognomonischen Menière-Trias.',
                goals: 'Menière-Trias erkennen, Weber/Rinne korrekt als Schallempfindungsschwerhörigkeit rechts interpretieren und zentralen Schwindel sowie BPLS/Neuritis vestibularis abgrenzen.',
                differentials: ['Neuritis vestibularis (Dauerschwindel > 24 h OHNE Hörverlust!)', 'Benigner paroxysmaler Lagerungsschwindel (BPLS)', 'Kleinhirn-/Hirnstamminfarkt (AICA-Infarkt)', 'Vestibularisschwannom'],
                therapy_plan: 'Akut im Anfall: Antivertiginosa/Antiemetika (Dimenhydrinat oder Ondansetron). Anfallsprophylaxe im Intervall: Betahistin, salzarme Kost, ggf. intratympanale Glukokortikoid-Injektion.'
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
                vitals: { bp: '118/76 mmHg', hr: '108/min', rr: '24/min', temp: '37,3 °C', spo2: '91 % (Raumluft)', bmi: '27 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Ich bekomme seit heute Morgen kaum noch Luft, mein Herz rast und jedes Mal, wenn ich tief einatme, sticht es rechts in der Brust!“',
                qa_rows: [
                    { topic: 'Reiseanamnese & Immobilisation', answer: '„Ich bin gestern Nachmittag von einem 12-Stunden-Flug aus Costa Rica zurückgekommen.“' },
                    { topic: 'Beinschmerzen / Schwellung', answer: '„Ja, meine linke Wade zieht schon seit zwei Tagen und ist etwas dicker als die rechte.“' },
                    { topic: 'Husten / Hämoptysen / Synkope', answer: '„Trockener Reizhusten, kein blutiger Auswurf, nicht ohnmächtig geworden.“' },
                    { topic: 'Medikation & Hormonpräparate', answer: '„Ich nehme ein kombiniertes Östrogen-Gestagen-Präparat.“' }
                ],
                behavior: ['Tachypnoeisch, spricht in kürzeren Sätzen, ängstlich.']
            },
            physical_exam: [
                { area: 'Lunge & Herz', finding: 'Vesikuläratmen beidseits ohne feuchte RG, leises Pleurareiben rechts basal. Herzfrequenz 108/min, Herztöne rein.' },
                { area: 'Untere Extremitäten (Seitenvergleich)', finding: 'Linke Wade +3.5 cm Umfangsdifferenz gegenüber rechts, prall-elastisch, Druckschmerz entlang des tiefen Venensystems.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Arterielle BGA (Raumluft)', value: 'pO₂ 61 mmHg | pCO₂ 31 mmHg | pH 7.46', ref: 'pO₂ 75–100 | pCO₂ 35–45 mmHg | pH 7.35–7.45', flag: '⚠️ Hypoxämie + Hypokapnie + respiratorische Alkalose durch Hyperventilation' },
                    { param: 'D-Dimere', value: '3.8 mg/l', ref: '< 0.5 mg/l', flag: '↑↑ Deutlich erhöht (Hinweis: Bei hohem Wells-Score ist primär direkt die CTPA indiziert!)' },
                    { param: 'hs-Troponin T & NT-proBNP', value: 'Troponin T 28 ng/l | NT-proBNP 640 pg/ml', ref: '< 14 ng/l | < 125 pg/ml', flag: '↑ Zeichen der akuten Rechtsherzbelastung (intermediär-hohes Risiko)' },
                    { param: 'Kreatinin / eGFR', value: '69 µmol/l (eGFR > 90 ml/min)', ref: '45–84 µmol/l', flag: 'Normal (Keine Kontraindikation für KM-CT)' }
                ],
                imaging: [
                    {
                        modality: '12-Kanal-EKG',
                        finding: 'Sinustachykardie (108/min), tiefe S-Zacke in Ableitung I, Q-Zacke und T-Negativierung in Ableitung III, inkompletter Rechtsschenkelblock sowie T-Negativierungen in V1–V3.',
                        interpretation: 'Klassischer SI-QIII-Typ und rechtspräkordiale Erregungsrückbildungsstörung als Ausdruck der akuten Rechtsherzbelastung.'
                    },
                    {
                        modality: 'CT-Pulmonalisangiographie (CTPA)',
                        finding: 'Kontrastmittelaussparung in der rechten Hauptpulmonalarterie mit Übergreifen auf die Segmentarterien des rechten Unterlappens; Quotient des rechten zum linken Ventrikeldurchmesser (RV/LV) = 1.1.',
                        interpretation: 'Zentrale Lungenarterienembolie rechts mit radiologischer Rechtsherzbelastung.'
                    }
                ]
            },
            examiner_info: {
                background: 'Akute Lungenarterienembolie (intermediär-hohes Risiko) bei tiefer Beinvenenthrombose links nach Langstreckenflug unter Östrogentherapie.',
                goals: 'Wells-Score berechnen (klinische TVT-Zeichen +3, LE wahrscheinlichste Diagnose +3, HF > 100 +1.5 = 7.5 Punkte → hohe Wahrscheinlichkeit!), sofortige Antikoagulation + CTPA einleiten.',
                differentials: ['Akutes Koronarsyndrom (ACS)', 'Spontaner Pneumothorax', 'Pleuropneumonie', 'Aortendissektion'],
                therapy_plan: '1. Sauerstoffgabe (Ziel-SpO₂ > 94 %), 2. Sofortige therapeutische Antikoagulation (NMH / UFH oder DOAK wie Apixaban/Rivaroxaban), 3. Überwachung auf IMC wegen RV-Belastung, 4. Kompressionssonographie Beinvenen & Absetzen des Östrogenpräparats.'
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
                { area: 'Abdomen (Leber & Milz)', finding: 'Milz 2 cm unter dem linken Rippenbogen palpabel, Leber unauffällig.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Hämoglobin (Hb) & MCV', value: '114 g/l | 85 fl', ref: '135–175 g/l | 80–98 fl', flag: '↓ Normozytäre Anämie (Anämie der chronischen Erkrankung)' },
                    { param: 'Leukozyten & Differenzialblutbild', value: '9.4 G/l (Eosinophile 8 %, Lymphozyten 0.8 G/l)', ref: '4.0–10.0 G/l (Eos < 4 %, Lympho 1.0–3.5 G/l)', flag: '⚠️ Eosinophilie + absolute Lymphopenie (typisch bei Hodgkin-Lymphom!)' },
                    { param: 'BSG (Blutkörperchensenkungsgeschwindigkeit)', value: '68 mm/h', ref: '< 15 mm/h', flag: '↑↑ Stark beschleunigt (ungünstiger Risikofaktor)' },
                    { param: 'LDH (Laktatdehydrogenase)', value: '410 U/l', ref: '135–225 U/l', flag: '↑ Erhöhter Zellumsatz / Tumorlast' },
                    { param: 'HIV- & EBV-Serologie', value: 'HIV-Ag/Ak negativ | EBV-VCA-IgG +, EBNA-1-IgG +, IgM –', ref: 'Negativ', flag: 'Status nach früherer EBV-Infektion, keine akute Mononukleose' }
                ],
                imaging: [
                    {
                        modality: 'Röntgen-Thorax & FDG-PET-CT',
                        finding: 'Verbreiterung des oberen Mediastinums auf 7.5 cm sowie intensiv FDG-avide Lymphknotenpakete zervikal links, supraklavikulär links, mediastinal sowie multifokale Mehranreicherungen in der vergrößerten Milz.',
                        interpretation: 'Befall auf beiden Seiten des Zwerchfells unter Einschluss der Milz mit B-Symptomatik → Ann-Arbor-Stadium IIIB (bzw. IIIS B).'
                    },
                    {
                        modality: 'Histopathologie nach kompletter Lymphknoten-Exzision',
                        finding: 'Aufgehobene Lymphknotenarchitektur mit buntem entzündlichem Hintergrundinfiltrat und eingestreuten großen, doppelkernigen Zellen mit prominenten eosinophilen Nukleolen (CD30+, CD15+, CD20–).',
                        interpretation: 'Nachweis von klassischen Hodgkin- und Reed-Sternberg-Zellen → Klassisches Hodgkin-Lymphom.'
                    }
                ]
            },
            examiner_info: {
                background: 'Klassisches Hodgkin-Lymphom (Stadium IIIB nach Ann Arbor) mit typischer B-Symptomatik, Alkoholschmerz, Pruritus und derbem, indolentem zervikalem/supraklavikulärem LK-Paket.',
                goals: 'Kriterien der B-Symptomatik exakt abfragen, kompletten LK- und Milzstatus erheben und zwingend eine komplette Lymphknoten-Exzisionsbiopsie (KEINE alleinige Feinnadelpunktion!) + PET-CT veranlassen.',
                differentials: ['Non-Hodgkin-Lymphom (NHL)', 'Infektiöse Mononukleose (EBV) / CMV / Toxoplasmose', 'Sarkoidose / Tuberkulose', 'Metastase eines Kopf-Hals-Tumors'],
                therapy_plan: 'Komplette diagnostische Lymphknoten-Exzision, Staging mittels PET-CT, Fertilitätsberatung (Kryokonservierung vor Chemotherapie!) und stadiengerechte Polychemotherapie (z. B. ABVD oder BrECADD).'
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
                    { topic: 'Stimmung, Antrieb & Freudfähigkeit (3 Hauptkriterien)', answer: '„Seit 6 Wochen ist alles komplett leer und grau. Ich fühle gar nichts mehr, schaffe es morgens kaum unter die Dusche und kann mich nicht einmal mehr über meine Kinder freuen.“' },
                    { topic: 'Schlaf, Morgentief & Appetit', answer: '„Ich wache jeden Tag um 3 Uhr nachts auf und grüble stundenlang. Morgens ist es am allerschlimmsten. Ich habe 5 kg abgenommen.“' },
                    { topic: 'Schuldgefühle & Selbstwert', answer: '„Ich habe im Büro ein Projekt verzögert – ich bin ein kompletter Versager und ruiniere meine Familie.“' },
                    { topic: 'Suizidalität (Gedanken, Pläne, Distanzierungsfähigkeit)', answer: '„(Wenn direkt gefragt wird:) Ja, ich denke jeden Tag daran, dass es besser wäre, nicht mehr aufzuwachen. Vor zwei Tagen stand ich auf der Brücke und habe hinuntergeschaut. Allein zu Hause kann ich heute nicht versprechen, dass ich mir nichts antue.“' },
                    { topic: 'Frühere manische Episoden & Substanzkonsum', answer: '„Noch nie Phasen von übersteigertem Antrieb gehabt. Kein Alkohol- oder Drogenmissbrauch.“' }
                ],
                behavior: ['Psychomotorisch gehemmt, leise Stimme, lange Antwortlatenz, verarmte Mimik, wirkt hoffnungslos.']
            },
            physical_exam: [
                { area: 'Psychopathologischer Befund nach AMDP', finding: 'Wach, allseits orientiert. Auffassung und Konzentration reduziert, formales Denken verlangsamt und eingeengt auf Insuffizienz-/Schuldthemen. Affekt: tiefgedrückt, Gefühl der Gefühllosigkeit, affektstarr. Antrieb schwer gehemmt, Morgentief, Früherwachen. Akute, drängende Suizidgedanken ohne sichere Absprachefähigkeit.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'TSH basal', value: '1.9 mU/l', ref: '0.4–4.0 mU/l', flag: 'Normal (Ausschluss einer Hypothyreose als organische Ursache)' },
                    { param: 'Hämoglobin, Vitamin B12, Natrium, Kalzium', value: 'Hb 142 g/l | B12 380 pmol/l | Na 140 mmol/l | Ca 2.32 mmol/l', ref: '135–175 g/l | > 200 pmol/l | 135–145 | 2.15–2.55 mmol/l', flag: 'Normal' }
                ],
                imaging: [
                    {
                        modality: '12-Kanal-EKG & cMRT',
                        finding: 'EKG: Sinusrhythmus, HF 68/min, QTc-Zeit 410 ms (Norm < 450 ms). cMRT: Regelrechte Hirnparenchymdarstellung ohne Raumforderung oder vaskuläre Läsionen.',
                        interpretation: 'Ausschluss organischer ZNS-Ursachen bei Erstmanifestation; normwertige QTc-Zeit erlaubt sicheren Start einer antidepressiven Pharmakotherapie (z.B. Escitalopram / Mirtazapin).'
                    }
                ]
            },
            examiner_info: {
                background: 'Schwere depressive Episode ohne psychotische Symptome (ICD-10 F32.2) mit somatischem Syndrom und akuter Suizidalität.',
                goals: 'Alle 3 Hauptkriterien und Zusatzkriterien abfragen, Suizidalität offen und direkt explorieren und sofortige stationäre Aufnahme einleiten.',
                differentials: ['Bipolare affektive Störung', 'Hypothyreose / organische depressive Störung', 'Schwere Anpassungsstörung'],
                therapy_plan: 'Sofortige stationäre Aufnahme zum Schutz vor Selbstgefährdung, engmaschige Begleitung, Beginn einer kombinierten Pharmako- (SSRI / Mirtazapin) und Psychotherapie (KVT).'
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
                    'Erheben Sie eine fokussierte kardiologische Notfallanamnese.',
                    'Führen Sie eine gezielte kardiopulmonale Untersuchung durch und befunden Sie das 12-Kanal-EKG.',
                    'Leiten Sie das sofortige STEMI-Management ein (achten Sie auf spezifische Kontraindikationen!).'
                ],
                vitals: { bp: '96/60 mmHg', hr: '52/min', rr: '20/min', temp: '36,5 °C', spo2: '95 % (Raumluft)', bmi: '28 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Mir sitzt seit einer Dreiviertelstunde ein Elefant mitten auf der Brust! Es zieht bis in den Hals und den linken Arm, und mir läuft der kalte Schweiß herunter.“',
                qa_rows: [
                    { topic: 'Schmerzcharakter & Beginn', answer: '„Beim Schneeschaufeln plötzlich begonnen, dumpf-drückend, einschnürend (NRS 8/10), wird in Ruhe nicht besser.“' },
                    { topic: 'Kardiovaskuläre Risikofaktoren', answer: '„Raucher (40 Pack Years), Bluthochdruck, hohes Cholesterin, mein Vater hatte mit 58 Jahren einen Herzinfarkt.“' },
                    { topic: 'Medikation & PDE-5-Hemmer', answer: '„Amlodipin 5 mg. Vor 12 Stunden habe ich Sildenafil (Viagra) eingenommen.“' }
                ],
                behavior: ['Kaltschweißig, blass, hält die geballte Faust vor das Brustbein (Levine-Zeichen), Todesangst.']
            },
            physical_exam: [
                { area: 'Herz, Lunge & Halsvenen', finding: 'Herztöne rein, Herzfrequenz 52/min. Lunge beidseits frei (keine feuchten RG). Deutliche Jugularvenenstauung bei 45°-Oberkörperhochlagerung.' },
                { area: 'Pulsstatus (Seitenvergleich)', finding: 'Radialispulse bds. symmetrisch, keine Blutdruckdifferenz zwischen rechtem und linkem Arm.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'hs-Troponin T (0h)', value: '145 ng/l', ref: '< 14 ng/l', flag: '↑↑ Akuter Myokardschaden (Cave: Bei STEMI im EKG sofort Katheterlabor ohne Abwarten des Laborwerts!)' },
                    { param: 'Kreatinin & Kalium', value: 'Krea 88 µmol/l | K 4.3 mmol/l', ref: '62–106 µmol/l | 3.5–5.0 mmol/l', flag: 'Normal' }
                ],
                imaging: [
                    {
                        modality: '12-Kanal-EKG (+ rechtspräkordiale Ableitungen V3R, V4R)',
                        finding: 'Sinusbradykardie (52/min). Konvexe ST-Streckenhebungen von 0.3 mV in den Ableitungen II, III und aVF; ST-Senkungen in I und aVL. In V3R und V4R ST-Streckenhebung von 0.15 mV.',
                        interpretation: 'Akuter inferiorer ST-Hebungsinfarkt (Hinterwand-STEMI bei RCA-Verschluss) mit Rechtsherzinfarkt (ST-Hebung in V3R/V4R)!'
                    }
                ]
            },
            examiner_info: {
                background: 'Akuter inferiorer ST-Hebungsinfarkt (Hinterwand-STEMI bei RCA-Verschluss) mit Rechtsherzbeteiligung sowie Sildenafil-Einnahme vor 12 h.',
                goals: '12-Kanal-EKG binnen 10 Min. anfordern (+ V3R/V4R!), Hinterwand-STEMI diagnostizieren, sofortige primäre PCI aktivieren und die doppelte Kontraindikation gegen Nitrate erkennen (Rechtsherzinfarkt + Sildenafil!).',
                differentials: ['Akute Aortendissektion Stanford A', 'Lungenarterienembolie', 'Spannungspneumothorax'],
                therapy_plan: '1. Sofortige Aktivierung Herzkatheterlabor (primäre PCI), 2. Monitoring + Defibrillator-Bereitschaft, 3. ASS 250–500 mg i.v. + Heparin 5000 IE i.v. + P2Y12-Inhibitor (Prasugrel/Ticagrelor), 4. Morphin i.v., 5. KEINE Nitrate und KEINE Betablocker, stattdessen vorsichtige kristalloide Volumengabe.'
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
            title: 'Strukturierte Röntgen-Thorax- & Notfall-Bildbefundung – Spannungspneumothorax',
            source_case_title: 'Referenz-Station Radiologie (Systematische Bildbefundung)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt im radiologischen Dienst.',
                vignette: 'Ein 34-jähriger Patient (Herr Marc Tobler, 192 cm, 72 kg) stellt sich mit plötzlich aufgetretener linksseitiger Thoraxschmerz-Attacke und zunehmender Atemnot vor. Demonstrieren Sie die Bildgebung systematisch und besprechen Sie die Konsequenz.',
                tasks: [
                    'Erheben Sie eine kurze fokussierte Anamnese.',
                    'Befunden Sie das Thorax-Röntgenbild systematisch nach dem ABCDE-Schema.',
                    'Erklären Sie dem Patienten den Befund und die unmittelbare interventionelle Therapie.'
                ],
                vitals: { bp: '92/58 mmHg', hr: '122/min', rr: '28/min', temp: '36,6 °C', spo2: '88 % (Raumluft)', bmi: '19,5 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Vor einer Stunde hat es beim Husten plötzlich links in der Brust gestochen und jetzt bekomme ich immer schlechter Luft!“',
                qa_rows: [
                    { topic: 'Konstitution & Rauchen', answer: '„Ich bin schon immer sehr groß und schlank, rauche etwa 15 Zigaretten am Tag. Kein Unfall.“' }
                ],
                behavior: ['Deutlich dyspnoeisch, sitzt aufrecht.']
            },
            physical_exam: [
                { area: 'Auskultation & Perkussion Thorax', finding: 'Linksseitig komplett aufgehobenes Atemgeräusch und hypersonorer Klopfschall. Gestaute Halsvenen.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Arterielle BGA (Raumluft)', value: 'pO₂ 54 mmHg | pCO₂ 33 mmHg | SpO₂ 88 %', ref: 'pO₂ 75–100 | pCO₂ 35–45 mmHg', flag: '⚠️ Schwere hypoxämische respiratorische Insuffizienz' }
                ],
                imaging: [
                    {
                        modality: 'Röntgen-Thorax p.a.',
                        finding: 'Linksseitig komplett fehlende Lungengefäßzeichnung peripher einer scharf abgrenzbaren Haarlinie, weichteildichte Verschattung am linken Hilus, Abflachung und Tiefstand der linken Zwerchfellkuppel sowie Verlagerung von Trachea und Herzschatten nach rechts.',
                        interpretation: 'Linksseitiger Spannungspneumothorax mit komplettem Lungenkollaps, „Deep Sulcus Sign“ und Mediastinalshift nach rechts (Lebensgefahr!).'
                    }
                ]
            },
            examiner_info: {
                background: 'Spontaner linksseitiger Spannungspneumothorax bei jungem, leptosomem Raucher mit Mediastinalverlagerung und oberer Einflussstauung.',
                goals: 'Röntgenbild strukturiert befunden (Pleuralinie, Abbruch der Gefäßzeichnung, Mediastinalshift zur Gegenseite, Zwerchfelltiefstand) und sofortige Nadeldekompression + Thoraxdrainage einleiten.',
                differentials: ['Einfacher Mantelpneumothorax ohne Spannungskomponente', 'Große bullöse Emphysemblase', 'Lungenembolie'],
                therapy_plan: '1. Hochdosiert Sauerstoff, 2. Sofortige Entlastung mittels Nadeldekompression (2. ICR MCL nach Monaldi oder 4./5. ICR AAL nach Bülau am Oberrand der unteren Rippe!), 3. Einlage einer Thoraxdrainage mit Wasserschloss/Sog.'
            },
            checklist: [
                { category: 'Klinik & Patientensicherheit', item: 'Erkennt die Trias aus einseitig aufgehobenem Atemgeräusch, hypersonorem Klopfschall und Schock/Halsvenenstauung (betont, dass ein klinischer Spannungspneumothorax eigentlich vor dem Röntgen entlastet wird!)', points: 3 },
                { category: 'Systematische Radiologie-Befundung', item: 'Befundet das Thoraxbild strukturiert: Identifiziert viszerale Pleuralinie, periphere Gefäßleere links, Zwerchfelltiefstand und den Mediastinalshift nach rechts', points: 4 },
                { category: 'Therapie & Anatomie', item: 'Benennt die exakten anatomischen Punktionsorte (Monaldi: 2. ICR MCL; Bülau: 4./5. ICR AAL im Safe Triangle, immer am RIPPENOBERRAND!)', points: 3 }
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
                    'Führen Sie die Lokalanästhesie, Wundreinigung und den spannungsfreien Wundverschluss steril durch und instruieren Sie die Nachsorge.'
                ],
                vitals: { bp: '126/78 mmHg', hr: '76/min', rr: '14/min', temp: '36,7 °C', spo2: '99 %', bmi: '24 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Ich bin vor einer Dreiviertelstunde im Garten ausgerutscht und mit dem linken Unterarm an einer rostigen Blechkante hängen geblieben. Es klafft ziemlich auseinander.“',
                qa_rows: [
                    { topic: 'Unfallzeitpunkt & Tetanus-Impfstatus', answer: '„Vor 45 Minuten passiert. Meine letzte Tetanus-Impfung war vor 12 Jahren beim Militär!“' },
                    { topic: 'Allergien & Blutverdünner', answer: '„Keine Allergien bekannt, auch beim Zahnarzt habe ich die Betäubungsspritze immer vertragen. Ich nehme keine Blutverdünner.“' },
                    { topic: 'Kribbeln oder Kraftverlust in den Fingern', answer: '„Nein, ich kann alle Finger normal bewegen und spüre alles.“' }
                ],
                behavior: ['Ruhig, schaut interessiert zu.']
            },
            physical_exam: [
                { area: 'Wundinspektion & pDMS VOR Lokalanästhesie', finding: '4 cm lange, glattrandige, bis in die Subkutis reichende Wunde dorsal am linken Unterarm. Keine aktive arterielle Blutung, kein Fremdkörper. Periphere Durchblutung, Sensibilität und Finger-/Handgelenksextension gegen Widerstand vollständig intakt.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'Material & Medikamente auf Nachfrage:',
                labs: [
                    { param: 'Lidocain 1 % (10 mg/ml) ohne Adrenalin', value: 'Ampulle à 10 ml', ref: 'Max. 4.5 mg/kg KG (~300 mg / 30 ml bei 70 kg)', flag: 'Lokalanästhetikum der Wahl (Cave: niemals Adrenalinzusatz an Endstromgebieten/Akren!)' }
                ],
                imaging: [
                    {
                        modality: 'Wundexploration & Nahtmaterial',
                        finding: 'Wundgrund reicht bis auf die intakte Unterarmfaszie, keine Metallsplitter. Bereitgestellt: Monofiler, nicht-resorbierbarer Faden (Prolene / Ethilon 3-0) mit schneidender Nadel.',
                        interpretation: 'Primäre Wundnaht mittels Einzelknopfnaht oder vertikaler Rückstichnaht nach Donati („weit-weit, nah-nah“) + aktive Tetanus-Auffrischimpfung (dT/dTpa, da letzte Impfung > 10 J.).'
                    }
                ]
            },
            examiner_info: {
                background: 'Frische (< 6 h), mäßig verschmutzte Riss-Quetschwunde am Unterarm ohne Sehnen-/Nervenverletzung bei abgelaufenem Tetanus-Impfschutz.',
                goals: 'Zwingend pDMS & Sehnenfunktion VOR der Lokalanästhesie prüfen! Steriles Arbeiten, Aspiration vor Lidocain-Injektion, Wundspülung/Exploration, korrekte instrumentelle Knotentechnik, Tetanus-Booster und Aufklärung über Fadenentfernung (Unterarm: nach 10–12 Tagen).',
                differentials: ['Begleitende Strecksehnenläsion', 'Fremdkörperverbleib in der Wunde'],
                therapy_plan: 'Sterile Wundspülung, Infiltrationsanästhesie, primäre Hautnaht, steriler Verband, Tetanus-Booster (dTpa), Kontrolle in 48 h, Fadenentfernung am Unterarm nach 10–12 Tagen.'
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
                behavior: ['Untersuchung erfolgt am Modell; Lebensgefährte wirkt nervös und drängt auf einen schnellen Totenschein.']
            },
            physical_exam: [
                { area: 'Sichere Todeszeichen (Livores & Rigor mortis)', finding: 'Totenflecke (Livores) am Rücken kräftig ausgebildet, auf kräftigen Daumendruck noch knapp wegdrückbar. Totenstarre (Rigor mortis) im Kiefer-, Nacken- und Armbereich vollständig ausgeprägt.' },
                { area: 'Augen & Konjunktiven (Ektropionieren der Lider!)', finding: 'Zahlreiche punktförmige Einblutungen in beiden Augenbindehäuten (Konjunktiven) sowie in der Mundschleimhaut und retroaurikulär.' },
                { area: 'Hals, Nacken & Extremitäten', finding: 'Am vorderen und seitlichen Hals mehrere halbmondförmige Oberhautvertrocknungen und diskrete Unterblutungen. An den Unterarmen rundliche Hämatome.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'Rechtsmedizinische Messwerte:',
                labs: [
                    { param: 'Rektaltemperatur & Umgebungstemperatur', value: '31.2 °C (Umgebung 20.0 °C)', ref: 'Henssge-Nomogramm', flag: '⚠️ Todeszeitpunkt ca. 6–10 Stunden vor Auffindung (Widerspruch zur Aussage des Lebensgefährten!)' }
                ],
                imaging: [
                    {
                        modality: 'Palpation des Kehlkopfskeletts & Inspektion der Halsweichteile',
                        finding: 'Abnorme Beweglichkeit und Krepitation im Bereich des oberen Schildknorpelhorns links.',
                        interpretation: 'Kehlkopfhornfraktur + halbmondförmige Fingernagelmarken + konjunktivale Stauungspetechien = Hochgradiger Verdacht auf Tötungsdelikt durch manuelles Würgen (Nicht-natürlicher Tod!).'
                    }
                ]
            },
            examiner_info: {
                background: 'Tötungsdelikt durch manuelles Würgen (Kompression des Halses mit konjunktivalen Stauungspetechien, Würgemalen am Hals, Abwehrhämatomen an den Unterarmen und zeitlicher Diskrepanz der sicheren Todeszeichen).',
                goals: 'Sichere Todeszeichen benennen, Leiche vollständig entkleidet inkl. Konjunktiven untersuchen, bei Verdacht auf nicht-natürlichen Tod die Untersuchung sofort abbrechen (Spurenschutz!), Todesart „nicht-natürlich“ bzw. „ungeklärt“ ankreuzen und sofort die Polizei verständigen.',
                differentials: ['Erdrosseln', 'Erhängen', 'Plötzlicher Herztod'],
                therapy_plan: 'Keinen natürlichen Tod bescheinigen! Leiche und Fundort unverändert belassen (Spurensicherung), Polizei umgehend informieren.'
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
                { area: 'Inspektion & Palpation MTP-I-Gelenk rechts', finding: 'Hochgradige Rötung, Schwellung, Überwärmung und extremste Druck- und Bewegungsdolenz des rechten Großzehengrundgelenks (MTP I). Keine Eintrittspforte.' },
                { area: 'Übrige Gelenke & Ohrmuscheln', finding: 'Knie-, Sprung- und Fingergelenke frei. Kleiner derber, weißlicher Knoten an der rechten Ohrmuschel (Helix).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'CRP & Leukozyten', value: 'CRP 64 mg/l | Leuk 12.1 G/l', ref: '< 5.0 mg/l | 4.0–10.0 G/l', flag: '↑ Akute kristallinduzierte Entzündungsreaktion' },
                    { param: 'Kreatinin & eGFR', value: '118 µmol/l (eGFR 56 ml/min)', ref: '62–106 µmol/l (eGFR > 60 ml/min)', flag: '↓ Chronische Niereninsuffizienz CKD G3a (relevant für NSAR/Colchicin-Dosierung!)' },
                    { param: 'Harnsäure im Serum', value: '490 µmol/l (8.2 mg/dl)', ref: '200–420 µmol/l (3.4–7.0 mg/dl)', flag: '↑ Hyperurikämie (Hinweis: Kann im akuten Anfall auch normwertig sein; Therapieziel < 360 µmol/l!)' }
                ],
                imaging: [
                    {
                        modality: 'Gelenkpunktion (Polarisationsmikroskopie) & Gelenk-Sonographie',
                        finding: 'Synovialanalyse: Zahlreiche intrazelluläre, nadelförmige, stark NEGATIV doppelbrechende Kristalle; Gram-Färbung negativ. Sonographie: Echoreicher Saum auf der hyalinen Knorpeloberfläche.',
                        interpretation: 'Beweisend für akute Arthritis urica (Urat-Kristalle + sonographisches „Doppelkontur-Zeichen“), Ausschluss einer septischen Arthritis.'
                    }
                ]
            },
            examiner_info: {
                background: 'Klassischer akuter Gichtanfall des Großzehengrundgelenks (Podagra) nach Purin-/Bierexzess und Thiaziddiuretikum-Gabe (HCT hemmt die renale Harnsäureausscheidung!).',
                goals: 'Podagra erkennen, septische Arthritis abgrenzen, Polarisationsmikroskopie (negativ doppelbrechende Uratkristalle) benennen, HCT absetzen und zwischen Akuttherapie (Prednisolon/Colchicin/NSAR) und Dauertherapie (Allopurinol) trennen.',
                differentials: ['Akute septische Arthritis', 'Chondrokalzinose / Pseudogicht (CPPD – positiv doppelbrechend)', 'Aktivierte Arthrose (Hallux rigidus)', 'Psoriasis-Arthritis (Daktylitis)'],
                therapy_plan: '1. Akuttherapie: Prednisolon p.o. (30–50 mg für 5 Tage) oder niedrigdosiertes Colchicin + Kühlung, 2. HCT auf Losartan oder Amlodipin umstellen, 3. Harnsäuresenkende Dauertherapie mit Allopurinol (Ziel-Harnsäure < 360 µmol/l).'
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
                vitals: { bp: 'Rechts 185/105 mmHg | Links 135/80 mmHg', hr: '104/min', rr: '22/min', temp: '36,6 °C', spo2: '96 %', bmi: '26 kg/m²' }
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
                { area: 'ABCDE-Beurteilung & Puls-/Blutdruckstatus beidseits', finding: 'A/B frei. C: Blutdruck rechts 185/105 mmHg, links 135/80 mmHg, linker Radialispuls deutlich abgeschwächt. Diastolisches Decrescendo-Geräusch über dem Erb-Punkt.' },
                { area: 'Neurostatus (D)', finding: 'GCS 15, leichte rechtsseitige Armparese (KG 4/5).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'D-Dimere', value: '8.4 mg/l', ref: '< 0.5 mg/l', flag: '↑↑ Massiv erhöht durch intramurale Gerinnungsaktivierung im falschen Lumen' },
                    { param: 'hs-Troponin T & Hämoglobin', value: 'Troponin 22 ng/l | Hb 136 g/l', ref: '< 14 ng/l | 135–175 g/l', flag: 'Leichte Troponin-Erhöhung (Cave: Keine blinde Antikoagulation vor CT!)' }
                ],
                imaging: [
                    {
                        modality: 'EKG-getriggertes Angio-CT der gesamten Aorta',
                        finding: 'Nachweis einer intraluminalen Membran (wahres und falsches Lumen) beginnend unmittelbar oberhalb des Sinus Valsalvae in der Aorta ascendens, weiterziehend über den Aortenbogen mit Einengung des Abgangs des Truncus brachiocephalicus und der linken A. subclavia bis in die Aorta abdominalis.',
                        interpretation: 'Akute Aortendissektion Typ Stanford A (DeBakey Typ I) mit Malperfusion der supraaortalen Äste – absolute herzchirurgische Notfallindikation!'
                    }
                ]
            },
            examiner_info: {
                background: 'Akute Aortendissektion Typ Stanford A mit Puls-/Blutdruckdifferenz (> 20 mmHg), sekundärer Aortenklappeninsuffizienz und supraaortaler Malperfusion.',
                goals: 'ABCDE-Schema anwenden, beidseitige Blutdruckmessung durchführen, KEINE Antikoagulation/Lyse vor Ausschluss der Dissektion geben, sofortiges Angio-CT + herzchirurgischen Notfalleingriff einleiten.',
                differentials: ['Akuter Myokardinfarkt', 'Lungenarterienembolie', 'Ösophagusruptur'],
                therapy_plan: '1. Zwei großlumige Zugänge + Kreuzblut für 4–6 EK, 2. Schmerztherapie (Morphin/Fentanyl i.v.), 3. Sofortige Senkung von Herzfrequenz (< 60/min) und systolischem Blutdruck (Ziel 100–120 mmHg) mit i.v. Betablocker (Esmolol/Labetalol), 4. Unverzügliche herzchirurgische Notfall-OP.'
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
                    'Befunden Sie die sonographischen Kriterien und besprechen Sie das Procedere.'
                ],
                vitals: { bp: '132/80 mmHg', hr: '94/min', rr: '18/min', temp: '38,4 °C', spo2: '98 %', bmi: '29 kg/m²' }
            },
            sp_script: {
                opening_quote: '„Nach dem Fondue gestern Abend hat es erst krampfartig im rechten Oberbauch angefangen, und jetzt tut es dort ununterbrochen weh, besonders wenn Sie mit dem Schallkopf draufdrücken!“',
                qa_rows: [
                    { topic: 'Schmerzausstrahlung & Stuhl-/Urinverfärbung', answer: '„Der Schmerz strahlt in meine rechte Schulter aus. Mein Urin ist normal hell, Stuhl normal braun.“' }
                ],
                behavior: ['Stoppt bei gezieltem Schallkopfdruck auf die Gallenblase abrupt die Inspiration.']
            },
            physical_exam: [
                { area: 'Schallkopf & Untersuchungstechnik', finding: 'Konvexschallkopf (3.5–5 MHz), Untersuchung im subkostalen und interkostalen Schrägschnitt in tiefer Inspiration sowie Linksseitenlage.' },
                { area: 'Abdomen-Palpation', finding: 'Isolierter Druckschmerz im rechten Oberbauch mit inspiratorischem Innehalten (Murphy-Zeichen positiv).' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Leukozyten & CRP', value: 'Leuk 14.2 G/l | CRP 85 mg/l', ref: '4.0–10.0 G/l | < 5.0 mg/l', flag: '↑↑ Systemische Entzündungsreaktion' },
                    { param: 'Bilirubin gesamt, AP & GGT', value: 'Bili 14 µmol/l | AP 78 U/l | GGT 34 U/l', ref: '< 21 µmol/l | 35–105 U/l | < 40 U/l', flag: 'Normal (Kein Hinweis auf extrahepatische Cholestase / Choledocholithiasis)' },
                    { param: 'Lipase', value: '32 U/l', ref: '< 60 U/l', flag: 'Normal (Ausschluss einer biliären Pankreatitis)' }
                ],
                imaging: [
                    {
                        modality: 'B-Bild-Sonographie Rechter Oberbauch',
                        finding: 'Gallenblase prall gespannt (11 × 4.5 cm), Wanddicke 6 mm mit echoarmem mittlerem Randsaum, im Infundibulum fixierter 1.8 cm großer echoreicher Reflex mit kompletter dorsaler Schallauslöschung, schmaler echoarmer Flüssigkeitssaum im Gallenblasenbett. DHC 4 mm.',
                        interpretation: 'Alle 4 sonographischen Hauptkriterien einer akuten kalkulösen Cholezystitis (Steinnachweis + Schallschatten, Dreischichtung/Wandödem > 3 mm, pericholezystische Flüssigkeit, sonographisches Murphy-Zeichen) ohne Choledocholithiasis.'
                    }
                ]
            },
            examiner_info: {
                background: 'Akute kalkulöse Cholezystitis ohne Choledocholithiasis (DHC < 6 mm, Bilirubin normal).',
                goals: 'Konvexschallkopf wählen, alle 4 sonographischen Hauptkriterien der akuten Cholezystitis benennen und die Gallenwege (DHC) mitbeurteilen.',
                differentials: ['Choledocholithiasis / akute Cholangitis', 'Akute biliäre Pankreatitis', 'Ulcus duodeni'],
                therapy_plan: 'Nüchtern lassen, i.v. Flüssigkeit, Spasmoanalgesie (Metamizol / NSAR), i.v. Antibiose (Ceftriaxon + Metronidazol oder Amoxicillin/Clavulansäure) und früh-elektive laparoskopische Cholezystektomie innerhalb von 24–72 Stunden.'
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
            title: 'Akute Flankenkolik, Fieber & Harnstau – Obstruktive Pyelonephritis bei Urolithiasis',
            source_case_title: 'Referenz-Station Urologie (Obstruktive Harnleitersteinkolik)',
            door_sign: {
                role: 'Sie sind Assistenzärztin / Assistenzarzt auf der Notfallstation.',
                vignette: 'Herr Sandro Rossi (44-jährig) stellt sich wegen vernichtender, wellenförmiger Schmerzen in der linken Flanke mit Ausstrahlung in die linke Leiste sowie seit 2 Stunden bestehendem Schüttelfrost vor.',
                tasks: [
                    'Erheben Sie eine fokussierte urologische Schmerz- und Infektanamnese.',
                    'Führen Sie die klinische Untersuchung (Abdomen, Nierenlogen, Genitale) durch.',
                    'Erkennen Sie die vital bedrohliche Komplikation und leiten Sie die sofortige Notfalltherapie ein.'
                ],
                vitals: { bp: '102/64 mmHg', hr: '114/min', rr: '22/min', temp: '39,2 °C', spo2: '97 %', bmi: '26 kg/m²' }
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
                { area: 'Nierenlogen & Abdomen', finding: 'Linker Nierenlagerklopfschmerz hochpositiv! Abdomen weich, kein Peritonismus.' },
                { area: 'Äußeres Genitale', finding: 'Beide Hoden orthotop, normalkonsistent, indolent, Kremasterreflex bds. erhalten.' }
            ],
            diagnostics_on_demand: {
                lab_note: 'NUR auf Nachfrage:',
                labs: [
                    { param: 'Urinstatus (U-Stix)', value: 'Erythrozyten +++, Leukozyten +++, Nitrit positiv', ref: 'Negativ', flag: '⚠️ Makro-/Mikrohämaturie + eitrige Leukozyturie + Nitrit-positive Bakteriurie!' },
                    { param: 'Leukozyten & CRP', value: 'Leuk 17.4 G/l | CRP 142 mg/l', ref: '4.0–10.0 G/l | < 5.0 mg/l', flag: '↑↑ Schwere systemische Infektion (beginnende Urosepsis!)' },
                    { param: 'Kreatinin', value: '156 µmol/l', ref: '62–106 µmol/l', flag: '↑ Postrenale + septische akute Nierenschädigung (AKI)' }
                ],
                imaging: [
                    {
                        modality: 'Nieren-Sonographie & Nativ-Low-Dose-CT Abdomen',
                        finding: 'Sonographisch deutlich erweitertes Nierenbeckenkelchsystem links mit plumpem Kelchhals. Im Nativ-CT 7 mm messende hyperdense Struktur (950 HE) im distalen linken Ureter prävesikal mit umgebendem „Rim Sign“.',
                        interpretation: 'Harnstauungsniere II° links durch prävesikalen Ureterstein (7 mm) – in Kombination mit Fieber/Leukozyturie liegt eine lebensbedrohliche obstruktive Pyelonephritis („infizierte Stauungsniere“) vor!'
                    }
                ]
            },
            examiner_info: {
                background: 'Obstruktive Pyelonephritis mit beginnender Urosepsis bei prävesikalem Harnleiterstein links (7 mm) – absoluter urologischer Notfall!',
                goals: 'Kombination aus Harnleiterkolik/Harnstau + Fieber/Nitrit-positivem Urin als urologischen Notfall erkennen, sofort Blut-/Urinkulturen abnehmen, i.v. Antibiose starten und unverzügliche Harnableitung (Doppel-J-Katheter oder perkutane Nephrostomie) veranlassen.',
                differentials: ['Unkomplizierte Harnleiterkolik ohne Infekt', 'Rupturiertes Bauchaortenaneurysma', 'Hodentorsion / Epididymitis', 'Akute Divertikulitis'],
                therapy_plan: '1. Analgesie (Metamizol i.v. / Paracetamol; Cave: NSAR wegen Krea 156 µmol/l vermeiden!), 2. Blutkulturen + Urinkultur, danach sofort empirische i.v. Antibiose (Ceftriaxon oder Piperacillin/Tazobactam), 3. SOFORTIGE notfallmäßige Harnableitung (DJ-Ureterschiene oder perkutane Nephrostomie).'
            },
            checklist: [
                { category: 'Anamnese & Untersuchung', item: 'Erfragt Kolikcharakter, Ausstrahlung (Leiste/Hoden), Hämaturie und Fieber/Schüttelfrost; prüft Nierenlagerklopfschmerz & untersucht Hoden', points: 3 },
                { category: 'Diagnostik', item: 'Fordert U-Stix/Urinkultur, Blutkulturen, Entzündungswerte/Kreatinin, Nieren-Sonographie (Harnstau!) und Nativ-Low-Dose-CT an', points: 3 },
                { category: 'Notfall-Management', item: 'Erkennt die „infizierte Harnstauungsniere“ (obstruktive Pyelonephritis / Urosepsis) als absoluten Notfall und leitet sofortige i.v. Antibiose + notfallmäßige Harnableitung (DJ-Katheter / Nephrostomie) ein', points: 4 }
            ]
        }
    };

    // ======================================================================
    // 05. RUNTIME STATES (INKL. GETRENNTEM SPOILER-STATE FÜR INTERPRETATION!)
    // ======================================================================
    let selectedSpecialty = 'Innere Medizin';
    let selectedSourceCaseId = '__AUTO__';
    let selectedSetting = 'auto';
    let showCrossSpecialtyCases = false;
    let currentOSCEData = null;
    let activeRoleMode = 'all'; // 'all' | 'candidate' | 'sp' | 'examiner'

    // WICHTIG: Getrennte States für Rohbefunde vs. Interpretation!
    let revealedSections = {
        exam: false,
        labs: false,                // Zeigt NUR Parameter, Rohwert (neutral) & SI-Referenzbereich
        labInterpretation: false,   // Zeigt Pathologie-Flags (↑/↓), Farb-Highlighting & Erklärung
        imaging: false,             // Zeigt NUR die deskriptive Morphologie
        imagingInterpretation: false // Zeigt die radiologisch-klinische Beurteilung/Diagnose
    };
    let revealedLabRows = {}; // Erlaubt das einzelne Aufdecken der Interpretation pro Laborzeile!

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
                flex-wrap: wrap;
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
                width: 28%;
                color: var(--text-main);
            }
            .osce-reveal-cell-btn {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 3px 9px;
                border-radius: 6px;
                border: 1px dashed rgba(56, 189, 248, 0.45);
                background: rgba(2, 132, 199, 0.08);
                color: var(--accent-cyan, #38bdf8);
                font-size: 0.72rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.14s ease;
            }
            .osce-reveal-cell-btn:hover {
                background: rgba(2, 132, 199, 0.2);
                border-style: solid;
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
        launchpad
