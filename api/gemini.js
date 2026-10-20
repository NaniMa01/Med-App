// ==========================================================================
// api/gemini.js – Zentrale Serverless AI-Engine (Fall-Schmiede, Depot & Flashcards)
// ==========================================================================

const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = 'gemini-2.0-flash';
const MAX_PROMPT_LENGTH = 50000;

function sendJson(res, status, payload) {
    return res.status(status).json(payload);
}

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (_error) {
            return null;
        }
    }
    return body;
}

function extractFlexibleJson(text) {
    if (typeof text !== 'string') {
        throw new Error('Gemini response is not a string.');
    }

    let value = text
        .replace(/^\uFEFF/, '')
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    try {
        return JSON.parse(value);
    } catch (_error) {
        const firstBrace = value.indexOf('{');
        const firstBracket = value.indexOf('[');

        let startIdx = -1;
        let targetEndChar = '}';

        if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
            startIdx = firstBracket;
            targetEndChar = ']';
        } else if (firstBrace !== -1) {
            startIdx = firstBrace;
            targetEndChar = '}';
        }

        const lastIdx = value.lastIndexOf(targetEndChar);

        if (startIdx === -1 || lastIdx === -1 || lastIdx <= startIdx) {
            throw new Error('No valid JSON structure found in Gemini response.');
        }

        const possibleJson = value.slice(startIdx, lastIdx + 1);
        return JSON.parse(possibleJson);
    }
}

// Allgemeingültiger System-Prompt für atomare Flash Cards (Bloom Stufe 1)
function buildUniversalFlashcardPrompt(sourceText) {
    return `Du bist ein präziser Wissens-Extraktor für deklaratives Faktenwissen (Bloom-Taxonomie Stufe 1: Erinnern).
Deine Aufgabe ist es, aus dem bereitgestellten Quelltext oder Thema 8 bis 12 atomare, eindeutige Flash Cards zu erstellen.

STRIKTE REGELN FÜR DIE KARTENERSTELLUNG:
1. Minimum Information Principle: Jede Karte fragt exakt EINEN isolierten Fakt ab (z. B. eine Definition, einen Grenzwert, eine Klassifikation, eine Zuordnung oder einen Fachbegriff).
2. Eindeutigkeit: Die Vorderseite (front) muss so präzise gestellt sein, dass es genau eine spezifische Antwort gibt.
3. Knappe Rückseite: Die Antwort (back) darf maximal 1–2 kurze Sätze oder 3–4 Stichpunkte umfassen.
4. Kontextfreie Verständlichkeit: Jede Karte muss für sich allein verständlich sein.

WICHTIG: Antworte AUSSCHLIESSLICH mit einem validen JSON-Array. Kein Markdown, keine Einleitung.
Format:
[
  {
    "id": "fc_01",
    "category": "Name des Teilgebiets",
    "difficulty": "basic | intermediate | advanced",
    "front": "Präzise Faktenfrage oder Begriff",
    "back": "Knappe, eindeutige Faktenantwort",
    "mnemonic_or_context": "Optional: Kurze Eselsbrücke oder Kontext (max. 140 Zeichen)"
  }
]

QUELLTEXT / THEMA:
${sourceText}`;
}

async function callGeminiUpstream(apiKey, modelName, instructionText, temperature = 0.4) {
    const selectedModel = (modelName || PRIMARY_MODEL).trim();
    
    // ⚡ KORREKTE REST-URL OHNE MARKDOWN-ARTEFAKTE
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: instructionText }] }],
            generationConfig: {
                temperature: temperature,
                responseMimeType: 'application/json'
            }
        })
    });

    const rawText = await response.text();
    let json = null;
    try {
        json = rawText ? JSON.parse(rawText) : null;
    } catch (_e) {
        json = null;
    }

    return { ok: response.ok, status: response.status, json, rawText, usedModel: selectedModel };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return sendJson(res, 500, {
            error: 'Server misconfiguration: GEMINI_API_KEY fehlt in den Vercel Environment Variables.'
        });
    }

    const parsedBody = parseRequestBody(req.body);
    if (!parsedBody) {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }

    const prompt = typeof parsedBody.prompt === 'string' ? parsedBody.prompt.trim() : '';
    const mode = typeof parsedBody.mode === 'string' ? parsedBody.mode.trim() : 'case_forge';

    if (!prompt) {
        return sendJson(res, 400, { error: 'Missing "prompt" field.' });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
        return sendJson(res, 400, { error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} characters.` });
    }

    const requestedMedicalField = typeof parsedBody.medicalField === 'string' ? parsedBody.medicalField.trim() : '';
    const medicalField = requestedMedicalField || 'Allgemein';

    let finalInstruction = '';

    if (mode === 'depot_quiz') {
        finalInstruction = prompt;
    } else if (mode === 'flashcards_only') {
        finalInstruction = buildUniversalFlashcardPrompt(prompt);
    } else {
        // Fall-Schmiede Modus
        finalInstruction = `Du bist ein erfahrener Facharzt, universitärer Prüfungsbeauftragter für das humanmedizinische Staatsexamen (orientiert an IMPP- und NBME-Standards) und leitender didaktischer Software-Architect für MedCheck. Deine Aufgabe ist es, aus dem übergebenen Vorlesungsskript bzw. medizinischen Fachtext genau EINEN maximal vollständigen, hochdifferenzierten Fall als syntaktisch valides JSON-Objekt zu generieren.

ZIELGRUPPE & DIDAKTISCHER ANSPRUCH:

Medizinstudierende im letzten Masterjahr vor dem Staatsexamen. Fokus auf Differenzialdiagnosen, pathophysiologische Kausalketten, diagnostische Goldstandards, Leitlinienempfehlungen und klinische Fallstricke (Cognitive Biases, typische Behandlungsfehler). Höchste Fachterminologie: Verwende konkrete Fachbegriffe, anatomische Leitstrukturen, exakte Laborparameter (mit Einheiten/Grenzwerten), Bildgebungsmorphologien und Medikamentennamen inklusive Wirkmechanismen. KRITISCHE TECHNISCHE REGELN FÜR DEN IMPORT (ZERO-TOLERANCE):

ZWINGENDE CASE_ID AM ANFANG DES FILES:
Das Feld "case_id" ist IMMER zwingend notwendig und MUSS als allererste Eigenschaft direkt am Anfang des JSON-Objekts stehen (z. B. "case_id": "STRING_IDENTIFIER"). Es darf unter keinen Umständen fehlen, leer sein oder erst weiter hinten im JSON platziert werden.

REINES ROHTEXT-JSON & VOLLSTÄNDIGKEITS-GARANTIE (TRUNCATION-SCHUTZ): Antworte AUSSCHLIESSLICH mit dem validen JSON-Objekt. Das ALLERERSTE Zeichen deiner Antwort ist { und das ALLERLETZTE Zeichen ist }. Absolut KEIN einleitender oder erklärender Text, kein Markdown-Codeblock (KEIN json und KEIN ), keine Kommentare davor oder danach. Der Text wird direkt an JSON.parse() übergeben. Das JSON muss zwingend vollständig generiert werden und syntaktisch geschlossen mit } enden. STRIKTES ZITATIONSVERBOT (LESEFLUSS & DATENBANK-KOMPATIBILITÄT): Füge NIEMALS Zitationsmarker, Quellenverweise, Klammern oder Zitations-Tags wie \[cite: ...\], \[source: ...\], \[1\], (Quelle: ...) in irgendeinen String oder Task ein. Alle Texte müssen reine, flüssige, hochprofessionelle klinische Fachsprache ohne jegliche Zitationsartefakte sein. STRING-ESCAPING & TEXTFORMATIERUNG: In Fließtexten innerhalb von JSON-Strings sind unescapte doppelte Anführungszeichen STRENG VERBOTEN. Nutze stattdessen einfache Anführungszeichen ('...') oder maskiere sie als \". Zeilenumbrüche innerhalb von JSON-Werten dürfen NIEMALS als echte Returns stehen, sondern müssen immer als \\n\\n escaped sein. HTML-Gültigkeitsbereich: HTML-Tags (<p>, <b>, <ul>, <li>) sind ausschließlich im Feld case_overview.cornell_notes\[\].notes gestattet. Alle übrigen Felder (summary, content, hotspots, hints, cascades, explanation, flashcards etc.) sind ausnahmslos reiner Plain-Text. FACHRICHTUNG & PRIMÄRERKRANKUNG (METADATA-STANDARDS): metadata.medical_field: Wähle strikt aus der vorgegebenen Whitelist: \["HNO", "Neurologie", "Hämatologie", "Kardiologie", "Gastroenterologie", "Pneumologie", "Infektiologie", "Nephrologie", "Endokrinologie", "Rheumatologie", "Dermatologie"\]. Keine freien Umschreibungen oder Langformen (z. B. niemals "Hals-Nasen-Ohrenheilkunde", sondern strikt "HNO"). metadata.primary_disease: Exakte Zielerkrankung des Falls (z. B. "Morbus Menière", "Creutzfeldt-Jakob-Krankheit"). Dient als primärer Systemanker für die fachrichtungsspezifische Filterung und Zuordnung in der MedCheck-App. CASE_OVERVIEW (MAXIMALE VOLLSTÄNDIGKEIT, SYNCHRONISIERTE CUES, INTENSIVE FETTMARKIERUNG & PERFEKTE TAKE-HOME-MESSAGE): case_overview.cornell_notes: MUSS ALLE im übergebenen Skript oder Text vorkommenden Themenblöcke, Entitäten, Anatomie-Details, physiologischen Funktionen, Leitsymptome, Diagnostik- und Therapieschemata lückenlos abdecken – egal wie umfangreich die Sektion wird. HÖHEN-SYNCHRONISATION DER ÜBERSCHRIFTEN / CUES: Die Stichworte/Überschriften im Array cues müssen strikt auf der vertikalen Höhe stehen, wo die jeweilige Information im Text zu finden ist. Strukturiere jeden Eintrag daher feingranular oder spiegele die Absätze/Bulletpoints im Text exakt 1:1 durch die Reihenfolge der Cues wider (Cue 1 korrespondiert mit Absatz/Bullet 1, Cue 2 mit Absatz/Bullet 2 usw.). INTENSIVE FETTMARKIERUNG: Alle wichtigen Inhalte, klinischen Schlüsselbegriffe, Grenzwerte, Leitstrukturen, Goldstandards, Erregernamen, Medikamente, Warnzeichen ('Cave') und Leitsymptome MÜSSEN im Fließtext konsequent fett hervorgehoben werden (mittels <b>...</b>). cues: Präzise, hochspezifische Fachbegriffe und Kernaspekte als Array von Strings. notes: Ausführliche HTML-Darstellung mit <p>, <b>Schlüsselbegriffen</b> und detaillierten <ul><li>Aufzählungspunkten</li></ul>, die Faktenwissen, pathophysiologische Zusammenhänge, Leitlinien und klinische Pearls maximal tief und vollständig ausarbeiten. case_overview.summary (Take-Home-Message): Reiner Plain-Text (kein HTML). Muss als perfekter, flüssiger Fließtext aus 2 bis 4 prägnanten Sätzen aufgebaut sein, der die Kernfrage des Themas beantwortet und eigenen Worten folgt. Folgt dem impliziten 3-Schritte-Schema ohne störende Füllwörter oder Bezeichnungen wie „Das Was“: Der Kern: Einleitende Definition oder Grundaussage auf den Punkt gebracht. Der Mechanismus / Das Warum: Verbindung zwischen Ursache, Wirkung oder Hauptargument. Der Nutzen / Die Konsequenz: Praktischer Nutzen oder übergeordnete Bedeutung für Klausur und Praxis. Kein bloßes Abschreiben, maximal 3–4 Zeilen bzw. Sätze, selbstdacht und präzise. Schreibe absolut niemals die Zitate hin (Cite). AUDIT & TIMELINE (9 SCHRITTE – INTERAKTIVES LAYOUT & HOHER KLINISCHER ANSPRUCH): REINER PLAIN-TEXT IN "content": Absolut keine HTML-Tags und keine eckigen Klammern \[...\] in timeline\[\].content. Der Text wird von der Editorial-Engine (js/audit.js) automatisch in saubere Absätze und natürliche Satzbausteine (Klauseln) gegliedert. 9 SCHRITTE GEGLIEDERT IN 3 KLINISCHE SZENARIEN (patient_1, patient_2, patient_3, je 3 Schritte): 70 bis 160 Wörter pro Schritt als realistischer klinischer Verlaufsbericht mit Vitalparametern und Befunden. INTERAKTIVE VALIDIERUNG (KEINE VORAB-FREIGABE): Die Hotspots und Timeline-Abschnitte dürfen im JSON niemals als „bereits validiert“ oder „freigegeben“ markiert sein. Der Anwender muss jeden Schritt im Frontend interaktiv prüfen und korrekte sowie fehlerhafte Abschnitte aktiv per Button anklicken, um sie manuell freizugeben. FEHLER-QUANTITÄT & DISTRAKTOREN: Mindestens 6 bis 7 der 9 Schritte enthalten echte klinische Fehler (is_error: true) mit sokratischem Impuls (socratic_trap) und fundierter pathophysiologischer Korrektur (correct_pathophysiology). Jeder Schritt enthält zudem 3 bis 5 täuschend echte Plausibilitäts-Distraktoren (is_error: false), die im ersten Moment kontraintuitiv wirken, aber leitliniengerecht und exakt richtig sind. Diese benötigen zwingend eine spezifische pathophysiologische Begründung im feedback-Feld. GANZHEITLICHE PHRASENBILDUNG: Jede phrase im Array hotspots muss ein kompletter, zusammenhängender sprachlicher Satzbaustein aus 3 bis 8 Wörtern sein und als exakter, zeichengenauer Substring in content vorkommen. HOCHQUALITATIVE FLASH CARDS (REINES FAKTENWISSEN / BLOOM-STUFE 1 - ERINNERN): extra_tasks.flashcards ist ein Array mit 8 bis 12 atomaren Karteikarten zur gezielten und fundierten Abfrage von medizinischem Fachwissen. ERSTELLUNG DER KARTEIKARTEN ZUR FACHWISSENS-ABFRAGE: Die Karteikarten müssen gezielt zentrales, hochrelevantes medizinisches Fachwissen abfragen (pathophysiologische Schlüsselmechanismen, diagnostische Kriterien/Goldstandards, Cut-off-Grenzwerte, Leitsymptom-Konstellationen, Antikörper/Genetik sowie leitliniengerechte Pharmakotherapie). PURE DECLARATIVE FACTS / MINIMUM INFORMATION PRINCIPLE: Im Gegensatz zum Master-Quiz (das Transfer- und Fallvignettenwissen prüft) prüfen die Flash Cards ausschließlich isoliertes, deklaratives Faktenwissen (Definitionen, pathognomonische Triaden, Cut-off-Grenzwerte, Antikörper-/Gen-Zuordnungen, Leitlinien-Erstlinienmedikamente, anatomische Ausfallmuster). Jede Karte fragt exakt EINEN atomaren Fakt ab ("Minimum Information Principle"). Keine langen Fallgeschichten auf der Vorderseite\! PRÄZISE VORDERSEITE (front): Eindeutige, direkte Faktenfrage oder Begriffsnennung (z. B. "Welcher Antikörper ist hochspezifisch für die Neuromyelitis-optica-Spektrum-Erkrankung (NMOSD)?"). Keine Mehrdeutigkeit: Die Frage muss so formuliert sein, dass im Kopf des Lernenden nur genau eine richtige Kurzantwort existiert. KNAPPE RÜCKSEITE (back): Maximal 1 bis 2 kurze, prägnante Sätze oder 3 bis 5 Stichpunkte (z. B. "Aquaporin-4-IgG (Anti-AQP4-AK)."). Ermöglicht eine blitzschnelle Selbstkontrolle in unter 2 Sekunden. ESELSBRÜCKE / KONTEXT (mnemonic_or_context): Optionaler, aber hochwillkommener kurzer Merksatz, pathophysiologischer Schlüsselhinweis oder didaktische Eselsbrücke (max. 140 Zeichen). Jedes Objekt enthält: "id": Eindeutige String-ID (z. B. "fc_01", "fc_02", ...) "category": Präziser Fachbereichs-/Themenbegriff (z. B. "Neuroimmunologie", "Liquordiagnostik", "Pharmakotherapie") "difficulty": "basic", "intermediate" oder "advanced" "front": Direkte Faktenfrage / Begriff "back": Eindeutige, knappe Faktenantwort "mnemonic_or_context": Merksatz / Kontext-Pearl DOCTORDLE (ORIGINALES DEDUKTIONSPRINZIP – PROGRESSIVE HINWEISE OHNE FRÜH-SPOILER): extra_tasks.doctordle ist ein Array mit genau 3 Objekten (puzzle_id: 1, 2, 3). Jedes Rätsel behandelt eine zentrale Zielerkrankung des Themas (sollte sich mit synapses_matrix und clinical_cascades überschneiden). TITEL-KONVENTION: Der Titel lautet schlicht und standardisiert genau "Fall 1", "Fall 2" bzw. "Fall 3". Absolut keine Zusätze, Diagnosenamen oder Untertitel. ECHTES DOCTORDLE-PRINZIP: Hinweise müssen subtil und deduktiv aufgebaut sein. Verrate niemals zu früh die Lösung durch offensichtliche Reizwörter. Die Diagnose muss schrittweise progressiv erschlossen werden: Hinweis 1 (Demografie & unspezifisches Leitsymptom): Alter/Geschlecht, sehr allgemeines Hauptsymptom. Lässt ein breites Spektrum an Differenzialdiagnosen offen. Hinweis 2 (Körperlicher Untersuchungsbefund / Phänotyp): Objektiver Befund, der mehrere Erkrankungen einschließt. Hinweis 3 (Basislabor oder Vitalparameter): Unspezifische laborchemische Auffälligkeit oder Vitalwert. Hinweis 4 (Differenzialdiagnostische Weichenstellung / Funktionstest / Kontext): Befund, der das Spektrum stark einengt, ohne die Diagnose direkt zu nennen. Hinweis 5 (Spezifischer Befund / Bildgebung): Spezifischer bildgebender oder morphologischer Befund. Hinweis 6 (Pathognomonischer Schlüsselbefund / Goldstandard): Erst HIER folgt der nahezu beweisende Befund. Jedes Rätsel enthält: puzzle_id (1, 2 oder 3), title ("Fall 1", "Fall 2", "Fall 3"), target_diagnosis, synonyms (3–6 valide Schreibweisen/Synonyme), hints (genau 6 Strings), learning_pearl (1–2 Sätze Kausalität). LIBRARY_ENTRIES: Array aus mindestens 15 bis 20 Strings: Enthält alle 3 target_diagnoses, sämtliche zugehörigen synonyms und 8 bis 12 klinisch bedeutsame Differenzialdiagnosen für das fallübergreifende Autocomplete-Wörterbuch. ANSPRUCHSVOLLE TAXONOMIE (KEINE GENERISCHEN BINS & STRIKTE ITEM-DURCHMISCHUNG): Unter extra_tasks.categorization geht es um die klinische Zuordnung von spezifischen Befunden, Manövern, Mustern oder Pathologien zu konkreten Krankheitsentitäten, anatomischen Kompartimenten oder pathophysiologischen Syndromen. VERBOTEN sind triviale, generische Kategorien wie "Diagnostik", "Symptom", "Therapie", "Risiko". categories: Genau 3 bis 4 spezifische Krankheitsentitäten oder pathophysiologische Kategorien des Themas. items: 8 bis 12 spezifische, anspruchsvolle Befunde, Manöver, Nystagmusmuster oder Kausalzusammenhänge, die jeweils eindeutig einer der definierten Krankheits-/Syndrom-Kategorien zugeordnet werden müssen. STRIKTE DURCHMISCHUNG DER ITEMS (SHUFFLE-PFLICHT): Die Reihenfolge der Objekte im Array items MUSS völlig willkürlich und unvorhersehbar durchmischt sein\! STRENGSTENS VERBOTEN ist jede sequentielle Gruppierung nach Kategorien (z. B. 2x Kategorie A, 2x Kategorie B, 2x Kategorie C...) sowie zyklische Muster (A, B, C, D, A, B, C, D). Aufeinanderfolgende Items im Array müssen in der Regel unterschiedlichen Kategorien angehören. Aus der Listenreihenfolge im JSON darf absolut kein Muster oder Rückschluss auf die Zielkategorie möglich sein\! CASCADES, SYNAPSEN (OPENEVIDENCE STYLE) & MASTER QUIZ (TAGGING, DURCHMISCHUNG & ANTI-BIAS): clinical_cascades: Genau 3 Erkrankungen mit je 8 Stufen (01_Auslöser bis 08_Outcome). Feld tutor_hint heißt rein "hint".

BINDUNG AN PRIMARY_DISEASE: Die erste Kaskade (Index 0) behandelt zwingend exakt die in metadata.primary_disease definierte Haupterkrankung. Der Wert des Feldes disease bei Index 0 MUSS buchstabengetreu mit metadata.primary_disease übereinstimmen. Kaskade 2 und 3 behandeln zentrale Differenzialdiagnosen. synapses_matrix (OPENEVIDENCE SYNAPSES / 4x4 MEDICAL CONNECTIONS FORMAT):

DIDAKTISCHES KONZEPT: Ein medizinisches 4x4-Assoziations-Board nach dem Vorbild von OpenEvidence Synapses. Es existieren genau 4 klinische Gruppen/Erkrankungen à 4 zusammenhängende Begriffe (= exakt 16 Kacheln). STRIKTE THEMEN-AUFTEILUNG (GENAU 4 KÄSTCHEN PRO THEMA): Bei den Synapsen müssen IMMER genau 4 Kästchen zu jedem der 4 Themen vorhanden sein: (1) Risikofaktor/Pathophysiologie, (2) Diagnostik, (3) Therapie, (4) Symptom. Jede der 4 Erkrankungen/Gruppen muss exakt genau 1 Begriff zu jedem dieser 4 Themenbereiche beisteuern, sodass das gesamte 16er-Board ausnahmslos genau 4 Kästchen für Risikofaktor/Pathophysiologie, 4 Kästchen für Diagnostik, 4 Kästchen für Therapie und 4 Kästchen für Symptom umfasst. MOBILE KACHEL-ERGONOMIE (MAXIMAL 1–4 WÖRTER PRO TERM): Damit die 16 Begriffe auf dem Smartphone im 4x4-Grid optimal lesbar bleiben, muss jeder Begriff (term bzw. Eintrag in items) ein prägnanter klinischer Fachbegriff von 1 bis maximal 4 Wörtern (ideal < 28 Zeichen) sein (z. B. "14-3-3-Protein im Liquor", "Cortical Ribboning (DWI)", "B-Symptomatik", "Reed-Sternberg-Riesenzellen"). Keine ganzen Sätze in den Kacheln\! KOGNITIVE TRENNSCHÄRFE & RED-HERRING-DESIGN: Die 4 Gruppen behandeln die metadata.primary_disease sowie 3 eng verwandte Differenzialdiagnosen oder klinische Cluster des Themas. Baue bewusste gedankliche Überlappungen ("Red Herrings") ein, die klinisches Wissen auf Staatsexamensniveau prüfen, aber am Ende exakt EINE eindeutige 4x4-Auflösung zulassen. DUAL-KOMPATIBLE DATENSTRUKTUR IN extra_tasks.synapses_matrix: description: Kurze Aufgabenbeschreibung ("Finde 4 Gruppen aus jeweils 4 klinisch zusammengehörigen Begriffen."). hint: Sokratischer Hinweis zur Abgrenzung der 4 Gruppen (Feld heißt rein "hint"). diseases: Array mit exakt den 4 Gruppentiteln/Erkrankungsnamen \["Erkrankung A", "Erkrankung B", "Erkrankung C", "Erkrankung D"\]. Index 0 ist zwingend die metadata.primary_disease. groups: Array mit genau 4 Objekten (Schwierigkeitsstufen level: 0 = Gelb/Basis, level: 1 = Grün/Klinik, level: 2 = Blau/Diagnostik, level: 3 = Violett/Differenzialdiagnose). Jedes Objekt enthält: "title": Exakter Name aus diseases (bzw. präziser Kategoriename) "level": 0, 1, 2 oder 3 "items": Array aus genau den 4 zugehörigen Kurzbegriffen \["Begriff 1", "Begriff 2", "Begriff 3", "Begriff 4"\] "explanation": 1–2 fundierte Sätze klinische Auflösung, die beim Lösen der Reihe im Farb-Banner eingeblendet werden. variables: Array aus exakt 16 Objekten (alle 4x4 Begriffe aus groups), wobei jede Gruppe genau die 4 Dimensionen "Risikofaktor/Pathophysiologie", "Symptom", "Diagnostik" und "Therapie" abdeckt (in Summe exakt jeweils 4 Kacheln pro Thema). Jedes Objekt hat { "term": "...", "type": "...", "disease": "..." }. STRIKTE DURCHMISCHUNG (SHUFFLE-PFLICHT): Das Array variables MUSS komplett pseudozufällig durchmischt sein – niemals alle 4 Variablen einer Erkrankung geblockt hintereinander oder im Muster A-B-C-D-A-B-C-D auflisten\! categorization: Feld tutor_hint heißt rein "hint".

master_quiz: Mindestens 5 Multiple-Choice-Fragen (Typ A, 1 aus 5) mit hohem diskriminatorischem Wert: A. ERKRANKUNGS-TAGGING & PRIMARY-ZUORDNUNG:

Jedes Fragenobjekt im Array master_quiz MUSS die Eigenschaften target_disease (String) und is_primary (Boolean) besitzen. Mindestens die ersten 2 Fragen des Sets (Index 0 und 1) behandeln zwingend die Haupterkrankung: "is_primary": true "target_disease": "\[Exakter Name der metadata.primary_disease\]" Die übrigen Fragen des Sets behandeln relevante Differenzialdiagnosen des Cluster-Themas: "is_primary": false "target_disease": "\[Exakter Name der jeweiligen Differenzialdiagnose\]" B. INHALTLICHE ANFORDERUNGEN (Bloom-Taxonomie Level 3–5): Jede Frage basiert auf einer realistischen Fallvignette (Symptome, Vitalparameter, Labor/Bildgebung) oder komplexen pathophysiologischen Vorgängen mit präziser Leitfrage am Ende des "question"-Strings. Zweistufiger Denkschritt ("Two-step reasoning": z. B. Befunde synthetisieren -> Verdachtsdiagnose -> nächste therapeutische Maßnahme oder pharmakologischer Wirkmechanismus). Keine reinen Faktenabfragen ("First-Order Recall"). C. ANTI-BIAS-PROTOKOLL GEGEN TEST-WISENESS (STRIKTE UMSETZUNG): Kontrollierte Längenparität (10–15 % Zeichenvarianz): Alle 5 Antwortoptionen (A bis E bzw. Index 0 bis 4) bewegen sich in einem ausgewogenen Korridor von ca. 10–15 % Zeichenvarianz. Flexibilität des Ensembles: Das gesamte Set der Optionen kann je nach Fragestellung kurz oder ausführlich formuliert sein. Wichtig ist die interne Homogenität innerhalb der Frage. Echte Unvorhersehbarkeit: Die korrekte Antwort folgt keinem Längenmuster. Syntaktische Homogenität & Begründungsverbot: Alle 5 Optionen teilen denselben grammatikalischen Typus. Keine Begründungssätze ("um zu...", "weil...") in einzelnen Optionen. Hochwertige klinische Distraktoren: Relevante Differenzialdiagnosen, typische Denkfallen oder kontraindizierte Maßnahmen. Test-Wiseness-Verbote: Keine Signalwörter wie "immer", "nie". Keine Meta-Optionen ("Alle genannten"). Vollständig willkürliche & balancierte Schlüsselverteilung (Anti-Bias): Die korrekte Option (correct_index) MUSS über das gesamte Fragenset hinweg echt willkürlich und gleichmäßig gestreut sein (Index 0 = A, 1 = B, 2 = C, 3 = D, 4 = E). STRENGSTENS VERBOTEN ist ein Bias zu den ersten Optionen (A oder B). Keinesfalls dürfen Antworten überproportional auf Index 0 oder 1 liegen\! Bei einem Set von 5 Fragen müssen alle Positionen (0, 1, 2, 3, 4) vertreten sein (z. B. Frage 1: C \[2\], Frage 2: E \[4\], Frage 3: A \[0\], Frage 4: D \[3\], Frage 5: B \[1\]). Zwei aufeinanderfolgende Fragen dürfen NIEMALS denselben Lösungsindex haben. Auch die Antwortoptionen innerhalb einer Frage dürfen keiner systematischen, alphabetischen oder hierarchischen Reihenfolge folgen, sondern müssen willkürlich permutiert sein. D. DIDAKTISCHE RATIONALE & FEEDBACK: "explanation": Expliziter Zeichenvergleich aller 5 Optionen zur Bestätigung der 10–15 % Varianz, fundierte Rationale für die korrekte Option sowie dezidierte klinische Entkräftung JEDES einzelnen Distraktors (keine Wiederholung des Falltextes). "hint": Rein "hint" (nicht "tutor_hint" oder "sokratischer Hinweis"). Ein zielgerichteter, didaktischer Impuls zur Leitsymptomatik oder Pathophysiologie ohne Spoiler der Lösung. DIDAKTISCHES QUALITÄTSPROTOKOLL (MAXIMALE KOGNITIVE TIEFE):

KEINE ISOLIERTEN ZAHLEN-/FAKTENABFRAGEN IM MASTER-QUIZ: Reines Fakten- und Grenzwertwissen gehört ausnahmslos in die Flashcards (extra_tasks.flashcards). Das Master-Quiz bleibt zwingend fallbasiert (Bloom 3–5). VIGNETTENBASIERTES ENTSCHEIDEN: Alle Quiz-Fragen müssen als konkrete klinische Zielkonflikte (z.B. Nutzen vs. Organtoxizität, Interaktionen bei Polymedikation, Notfallsituationen) konstruiert sein. DISTRAKTOREN MIT FACHARZTNIVEAU: Falschantworten müssen typische klinische Denkfehler (z.B. Availability Heuristic, unbegründete Angst vor Nebenwirkungen, Verwechslung von Induktion und Inhibition) abbilden. MECHANISTISCHE BEGRÜNDUNGEN: In 'explanation'-Feldern muss stets der molekulare/physiologische Wirkmechanismus (Rezeptorbindung, Ionenkanäle, Second Messenger, Enzymwege) als Kausalkette dargelegt werden. JSON-SCHEMA (STRUKTURBEISPIEL): { "case_id": "STRING_IDENTIFIER", "metadata": { "title": "STRING", "primary_disease": "STRING (z. B. 'Morbus Menière')", "medical_field": "HNO", "bloom_level": "Evaluation & Synthese", "difficulty": 5, "xp_reward": 1200 }, "case_overview": { "topic": "STRING", "cornell_notes": \[ { "cues": \["Schlüsselbegriff 1", "Schlüsselbegriff 2"\], "notes": "<p>Fundierte Erklärung mit <b>wichtigen Inhalten immer fett</b>.</p><ul><li><b>Aspekt 1:</b> Wichtige Details fett markiert.</li><li><b>Aspekt 2:</b> Höhen-Synchronisation zu Cue 2.</li></ul>" } \], "summary": "STRING" }, "timeline": \[ { "step_id": 1, "patient_id": "patient_1", "phase": "Patient 1: Anamnese & Erstkontakt", "content": "Patient 1\\n\\nAusführlicher Plain-Text Bericht ohne HTML (70-160 Wörter)...", "hotspots": \[ { "phrase": "harmlose unauffällige Maßnahme", "is_error": false, "feedback": "Diese Feststellung ist im klinischen Kontext fachlich vollkommen korrekt." }, { "phrase": "fehlerhafter klinischer Handlungsschritt", "is_error": true, "socratic_trap": "Sokratischer Impuls (lenkende Frage/Tipp, keine Lösung)", "correct_pathophysiology": "Fundierte Erklärung, warum Maßnahme falsch ist und wie es evidenzbasiert lauten muss" }, { "phrase": "korrekte leitliniengerechte Medikation", "is_error": false, "feedback": "Diese Feststellung ist im klinischen Kontext fachlich vollkommen korrekt." } \] } \], "extra_tasks": { "flashcards": \[ { "id": "fc_01", "category": "Diagnostische Triade", "difficulty": "basic", "front": "Aus welchen drei Kardinalsymptomen besteht die klassische Menière-Triade?", "back": "Drehschwindel (anfallsartig, 20 min bis 12 h), fluktuierende Schallempfindungsschwerhörigkeit (v. a. Tieftonbereich) und Tinnitus bzw. Ohrdruckgefühl.", "mnemonic_or_context": "Triade: Schwindel + Tiefton-Hypakusis + Tinnitus/Völlegefühl." }, { "id": "fc_02", "category": "Pathophysiologie", "difficulty": "intermediate", "front": "Welches pathomorphologische Korrelat liegt dem Morbus Menière zugrunde?", "back": "Ein Endolymphhydrops (Überdruck und Volumenzunahme der kaliumreichen Endolymphe im Ductus cochlearis und Vestibularorgan).", "mnemonic_or_context": "Ruptur der Reissner-Membran führt zur toxischen Kaliumüberflutung der Perilymphe." }, { "id": "fc_03", "category": "Pharmakotherapie", "difficulty": "advanced", "front": "Welcher Wirkstoff wird zur Anfallsprophylaxe des Morbus Menière als H1-Agonist und H3-Antagonist eingesetzt?", "back": "Betahistin (hochdosiert, z. B. 3x 48 mg/Tag über mindestens 6 bis 12 Monate).", "mnemonic_or_context": "Fördert die Mikrozirkulation der Stria vascularis im Innenohr." } \], "doctordle": \[ { "puzzle_id": 1, "title": "Fall 1", "target_diagnosis": "Morbus Menière", "synonyms": \["M. Menière", "Menière-Krankheit", "Endolymphatischer Hydrops"\], "hints": \[ "Hinweis 1: ...", "Hinweis 2: ...", "Hinweis 3: ...", "Hinweis 4: ...", "Hinweis 5: ...", "Hinweis 6: ..." \], "learning_pearl": "Prägnante Kernaussage zur Diagnosefindung." }, { "puzzle_id": 2, "title": "Fall 2", "target_diagnosis": "Vestibuläre Migräne", "synonyms": \["Migräne-assoziierter Schwindel", "Vestibular Migraine"\], "hints": \[ "Hinweis 1: ...", "Hinweis 2: ...", "Hinweis 3: ...", "Hinweis 4: ...", "Hinweis 5: ...", "Hinweis 6: ..." \], "learning_pearl": "Kernaussage B." }, { "puzzle_id": 3, "title": "Fall 3", "target_diagnosis": "Benigner paroxysmaler Lagerungsschwindel", "synonyms": \["BPLS", "BPPV", "Cupulolithiasis", "Kanalolithiasis"\], "hints": \[ "Hinweis 1: ...", "Hinweis 2: ...", "Hinweis 3: ...", "Hinweis 4: ...", "Hinweis 5: ...", "Hinweis 6: ..." \], "learning_pearl": "Kernaussage C." } \], "library_entries": \[ "Morbus Menière", "Vestibuläre Migräne", "Benigner paroxysmaler Lagerungsschwindel" \], "clinical_cascades": \[ { "disease": "Morbus Menière", "hint": "Hinweis zum pathophysiologischen Ablauf", "cascade": \[ { "stage": "01_Auslöser", "content": "..." }, { "stage": "02_Pathophysiologie", "content": "..." }, { "stage": "03_Zellulärer Mechanismus", "content": "..." }, { "stage": "04_Anatomische Konsequenz", "content": "..." }, { "stage": "05_Klinische Manifestation", "content": "..." }, { "stage": "06_Diagnostischer Befund", "content": "..." }, { "stage": "07_Therapeutische Intervention", "content": "..." }, { "stage": "08_Outcome", "content": "..." } \] } \], "synapses_matrix": { "description": "Finde 4 Gruppen aus jeweils 4 klinisch zusammengehörigen Begriffen.", "hint": "Verbinde Risikofaktor/Pathophysiologie, Symptom, Diagnostik und Therapie der 4 Krankheitsbilder.", "diseases": \[ "Erkrankung A", "Erkrankung B", "Erkrankung C", "Erkrankung D" \], "groups": \[ { "title": "Erkrankung A", "level": 0, "items": \[ "Variable A1", "Variable A2", "Variable A3", "Variable A4" \], "explanation": "Fundierte klinische Zusammenfassung zu Erkrankung A für das Auflösungs-Banner." }, { "title": "Erkrankung B", "level": 1, "items": \[ "Variable B1", "Variable B2", "Variable B3", "Variable B4" \], "explanation": "Fundierte klinische Zusammenfassung zu Erkrankung B." }, { "title": "Erkrankung C", "level": 2, "items": \[ "Variable C1", "Variable C2", "Variable C3", "Variable C4" \], "explanation": "Fundierte klinische Zusammenfassung zu Erkrankung C." }, { "title": "Erkrankung D", "level": 3, "items": \[ "Variable D1", "Variable D2", "Variable D3", "Variable D4" \], "explanation": "Fundierte klinische Zusammenfassung zu Erkrankung D." } \], "variables": \[ { "term": "Variable C1", "type": "Diagnostik", "disease": "Erkrankung C" }, { "term": "Variable A2", "type": "Risikofaktor/Pathophysiologie", "disease": "Erkrankung A" }, { "term": "Variable D4", "type": "Therapie", "disease": "Erkrankung D" }, { "term": "Variable B3", "type": "Symptom", "disease": "Erkrankung B" } \] }, "categorization": { "description": "Ordne die klinischen Befunde, Manöver und Phänomene den entsprechenden Krankheitsbildern zu.", "hint": "Differenziere die pathognomonischen Befunde der einzelnen Entitäten.", "categories": \[ "Krankheitsbild A", "Krankheitsbild B", "Krankheitsbild C", "Krankheitsbild D" \], "items": \[ { "term": "Spezifischer Befund 1", "category": "Krankheitsbild C" }, { "term": "Spezifischer Befund 2", "category": "Krankheitsbild A" }, { "term": "Spezifischer Befund 3", "category": "Krankheitsbild D" }, { "term": "Spezifischer Befund 4", "category": "Krankheitsbild B" } \] }, "master_quiz": \[ { "target_disease": "Morbus Menière", "is_primary": true, "question": "Detaillierte Fallvignette zur Haupterkrankung mit klinischer Leitsymptomatik, Vitalparametern, Labor/Befunden und präziser klinischer Leitfrage...", "options": \[ "Option A", "Option B", "Option C", "Option D", "Option E" \], "correct_index": 2, "explanation": "Zeichenvergleich:\\n- Option A: 48 Z.\\n- Option B: 49 Z.\\n- Option C: 47 Z.\\n- Option D: 46 Z.\\n- Option E: 48 Z.\\n(Maximale Varianz: 6.2 %)\\n\\nFundierte Rationale für Option C: \[...\]\\n\\nKlinische Analyse der Distraktoren:\\n- Option A: \[...\]\\n- Option B: \[...\]\\n- Option D: \[...\]\\n- Option E: \[...\]", "hint": "Hinweis zur Leitsymptomatik oder Pathophysiologie ohne Spoiler." }, { "target_disease": "Morbus Menière", "is_primary": true, "question": "Zweite anspruchsvolle Fallvignette zur Haupterkrankung...", "options": \[ "Option A", "Option B", "Option C", "Option D", "Option E" \], "correct_index": 4, "explanation": "...", "hint": "Hinweis" }, { "target_disease": "Vestibuläre Migräne", "is_primary": false, "question": "Fallvignette zur zentralen Differenzialdiagnose...", "options": \[ "Option A", "Option B", "Option C", "Option D", "Option E" \], "correct_index": 0, "explanation": "...", "hint": "Hinweis" } \] } }
${prompt}`;
    }

    const configuredModel = (process.env.GEMINI_MODEL || PRIMARY_MODEL).trim();

    try {
        let result = await callGeminiUpstream(apiKey, configuredModel, finalInstruction, 0.4);

        if (!result.ok && (result.status === 404 || result.status === 400)) {
            const fallbackCandidates = [FALLBACK_MODEL, 'gemini-1.5-flash'];
            for (const candidate of fallbackCandidates) {
                if (candidate === configuredModel) continue;
                result = await callGeminiUpstream(apiKey, candidate, finalInstruction, 0.4);
                if (result.ok) break;
            }
        }

        if (!result.json || !result.ok) {
            const upstreamMessage = result.json?.error?.message || `Gemini API failed (${result.status}).`;
            return sendJson(res, 502, { error: upstreamMessage, upstreamStatus: result.status });
        }

        const generatedText = result.json?.candidates?.[0]?.content?.parts
            ?.map(part => (typeof part?.text === 'string' ? part.text : ''))
            .join('')
            .trim();

        const parsedOutput = extractFlexibleJson(generatedText);

        // Modus: Depot-Quiz oder Flashcards-Only
        if (mode === 'depot_quiz' || mode === 'flashcards_only') {
            const arr = Array.isArray(parsedOutput)
                ? parsedOutput
                : (parsedOutput?.flashcards || parsedOutput?.questions || null);

            if (!Array.isArray(arr) || arr.length === 0) {
                return sendJson(res, 502, { error: `Gemini response for ${mode} must be a non-empty array.` });
            }

            return sendJson(res, 200, {
                ok: true,
                model: result.usedModel,
                result: arr
            });
        }

        // Modus: Fall-Schmiede (Objekt)
        if (!parsedOutput || typeof parsedOutput !== 'object' || Array.isArray(parsedOutput)) {
            return sendJson(res, 502, { error: 'Gemini response is not a JSON object.' });
        }

        parsedOutput.metadata = parsedOutput.metadata || {};
        parsedOutput.metadata.medical_field = medicalField;

        return sendJson(res, 200, {
            ok: true,
            model: result.usedModel,
            generatedText: JSON.stringify(parsedOutput),
            generatedCase: parsedOutput
        });
    } catch (error) {
        return sendJson(res, 500, {
            error: 'Unexpected server error while contacting Gemini.',
            details: error?.message || 'Unknown error'
        });
    }
};
