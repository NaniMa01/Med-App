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
        finalInstruction = `# ROLLE & ZIELGRUPPE

Facharzt, IMPP/NBME-Prüfungsbeauftragter & Software-Architect für MedCheck. Generiere aus dem Fachtext/Skript genau EINEN maximal vollständigen Fall als syntaktisch valides JSON.

  - **Zielgruppe:** Medizinstudierende vor dem Staatsexamen (2. Masterjahr).
  - **Fokus:** Differenzialdiagnosen, Pathophysiologie-Kausalketten, Goldstandards, Leitlinien, Fallstricke (Cognitive Biases, Behandlungsfehler).
  - **Sprache:** Höchste Fachterminologie, anatomische Leitstrukturen, exakte Laborparameter (mit Einheiten/Grenzwerten), Bildgebung, Medikamente inkl. Wirkmechanismen.

# 1. KRITISCHE TECHNISCHE REGELN (ZERO-TOLERANCE)

1.  **ZWINGENDE CASE_ID ZUERST:** `"case_id": "STRING_IDENTIFIER"` MUSS die allererste Eigenschaft im JSON sein. Darf niemals fehlen oder leer sein.
2.  **REINES ROHTEXT-JSON (TRUNCATION-SCHUTZ):** Antworte AUSSCHLIESSLICH mit dem JSON-Objekt (Erstes Zeichen `{`, letztes Zeichen `}`). KEIN einleitender/erklärender Text, KEINE Markdown-Codeblöcke, KEINE Kommentare. Muss direkt durch `JSON.parse()` lesbar und vollständig geschlossen sein.
3.  **STRIKTES ZITATIONSVERBOT & VERBOT VON SPAN- UND ZITAT-TAGS:** Absolut verboten sind Zitationsmarker, Quellenverweise, Span-Markierungen oder Tags jeder Art wie `[cite: ...]`, `[source: ...]`, `[1]`, `(Quelle: ...)`, `[span_...]`, `(start_span)`, `(end_span)` oder `<span>...</span>`. Der Text muss ausnahmslos sauberer, reiner Fließtext ohne jegliche Zitations- oder Span-Fragmente sein!
4.  **STRING-ESCAPING:** Unescapte doppelte Anführungszeichen in Strings sind VERBOTEN (nutze `'...'` oder `\"`). Zeilenumbrüche in Strings zwingend als `\n\n` escapen (keine echten Returns). Keine unmaskierten LaTeX-Backslashes (nutze Unicode wie ≥, ≤, ±, →).
5.  **HTML-GÜLTIGKEITSBEREICH:** HTML-Tags (`<p>`, `<b>`, `<ul>`, `<li>`) sind AUSSCHLIESSLICH in `case_overview.cornell_notes[].notes` erlaubt. Alle anderen Felder (`cues`, `summary`, `content`, `hotspots`, `hints`, `cascades`, `explanation`, `flashcards` etc.) sind ausnahmslos reiner Plain-Text! Im Feld `cues` sind absolut KEINE HTML-Tags gestattet; `cues` sind reiner Plain-Text (z. B. `"Epidemiologie"`, NIEMALS `"<b>Epidemiologie</b>"`).
6.  **SYSTEMANKER (`metadata.primary_disease`):** Exakte Zielerkrankung des Falls als primärer Filter-Anker.

# 2. SEKTIONSSPEZIFISCHE ANFORDERUNGEN

## A. CASE_OVERVIEW

  - **`cornell_notes`:**
      - **Lückenlose Abdeckung:** MUSS ALLE Themenblöcke, Entitäten, Anatomie-Details, Physiologie, Leitsymptome, Diagnostik- und Therapieschemata des Quelltextes komplett abdecken.
      - **1:1 Höhen-Synchronisation & Reiner Plain-Text in `cues`:** `cues` (Array von reinen Plain-Text-Strings OHNE HTML-Tags wie `<b>`) müssen vertikal exakt 1:1 mit den Absätzen/Bullets in `notes` korrespondieren (Cue 1 = Absatz/Bullet 1, Cue 2 = Absatz/Bullet 2).
      - **ZWINGENDE INTENSIVE FETTMARKIERUNG IN `notes`:** In `notes` MÜSSEN alle klinischen Schlüsselbegriffe, Grenzwerte, Leitstrukturen, Goldstandards, Erreger, Medikamente, Dosierungen, Warnzeichen ('Cave') und Leitsymptome konsequent, lückenlos und extrem dicht mit `<b>...</b>` hervorgehoben werden! Unformatierte Fließtextpassagen ohne `<b>...</b>` sind in `notes` streng verboten. Nutze `<p>`, `<b>` und `<ul><li>`.
  - **`summary` (Take-Home-Message):**
      - Reiner Plain-Text (2–4 prägnante Sätze, eigene Worte, keine Zitate).
      - Implizites 3-Schritte-Schema (ohne Labels wie "Das Was"): 1. Kern/Definition, 2. Pathophysiologischer Mechanismus/Warum, 3. Klinische Konsequenz/Nutzen.

## B. AUDIT & TIMELINE (`timeline` – 9 Schritte)

  - **Struktur:** 9 Schritte in 3 Szenarien (`patient_1`, `patient_2`, `patient_3` à 3 Schritte). Je 70–160 Wörter realistischer Verlaufsbericht mit Vitalparametern/Befunden.
  - **Format:** Reiner Plain-Text in `content` (kein HTML, keine `[...]`). Keine Vorab-Validierungs-Flags im JSON.
  - **Hotspots (`phrase`):** Exakter, zeichengenauer Substring aus `content` (zusammenhängender Satzbaustein, 3–8 Wörter).
  - **Fehler (`"is_error": true`):** In 6–7 der 9 Schritte. Benötigen `"socratic_trap"` (lenkende Frage ohne Lösung) und `"correct_pathophysiology"` (evidenzbasierte Korrektur).
  - **Anti-Bias / Signalwort-Verbot im Audit:** Vermeide im `content` und in Fehler-Phrasen absolute Signalwörter („nie“, „niemals“, „immer“, „sofort“, „ausnahmslos“), die Fehler trivial verraten. Formuliere Fehler im plausiblen Facharztduktus (subtile Kontraindikationen, falsche Grenzwerte/Prioritäten).
  - **Distraktoren (`"is_error": false`):** Pro Schritt 3–5 täuschend echte, kontraintuitive, aber leitliniengerechte Maßnahmen mit pathophysiologischer Begründung in `"feedback"`.

## C. FLASHCARDS (`extra_tasks.flashcards` – 8 bis 12 Karten)

  - **Konzept:** Reines deklaratives Faktenwissen (Bloom-Stufe 1: Grenzwerte, Triaden, Goldstandards, Erstlinienmedikamente, Genetik/Antikörper). Minimum Information Principle: Exakt EIN atomarer Fakt pro Karte (keine Fallgeschichten!).
  - **Felder:** `"id"` (`"fc_01"`...), `"category"`, `"difficulty"` (`"basic"`, `"intermediate"`, `"advanced"`), `"front"` (eindeutige Kurzfrage), `"back"` (max. 1–2 Sätze oder 3–5 Bullets, < 2 Sek. Lesezeit), `"mnemonic_or_context"` (Merksatz/Pearl, max. 140 Zeichen).

## D. DOCTORDLE & LIBRARY (`extra_tasks.doctordle` & `library_entries`)

  - **`doctordle`:** Genau 3 Objekte (`puzzle_id`: 1, 2, 3). `"title"` lautet exakt `"Fall 1"`, `"Fall 2"`, `"Fall 3"` (keine Zusätze).
  - **Felder:** `puzzle_id`, `title`, `target_diagnosis`, `synonyms` (3–6 Strings), `learning_pearl` (1–2 Sätze), `hints` (genau 6 progressive Strings ohne Früh-Spoiler: 1: Demografie/Leitsymptom, 2: Untersuchungsbefund, 3: Basislabor/Vitalwerte, 4: Weichenstellung/Funktionstest, 5: Spezifische Bildgebung/Morphologie, 6: Pathognomonischer Goldstandard).
  - **`library_entries`:** Array aus 15–20 Strings (alle 3 `target_diagnoses` + `synonyms` + 8–12 Differenzialdiagnosen).

## E. TAXONOMIE (`extra_tasks.categorization`)

  - **Konzept:** Zuordnung von 8–12 anspruchsvollen Befunden/Manövern (`items`: `{ "term": "...", "category": "..." }`) zu 3–4 spezifischen Krankheitsentitäten/Syndromen (`categories`).
  - **Verbot generischer Bins:** Kategorien wie `"Diagnostik"`, `"Symptom"`, `"Therapie"` sind VERBOTEN. Hinweisfeld heißt rein `"hint"`.
  - **SHUFFLE-PFLICHT:** `items` MUSS komplett willkürlich durchmischt sein (keine A-A-B-B-Blöcke, keine A-B-C-D-Zyklen).

## F. CLINICAL CASCADES (`extra_tasks.clinical_cascades`)

  - Genau 3 Erkrankungen à 8 Stufen (`01_Auslöser` bis `08_Outcome`). Hinweisfeld heißt rein `"hint"`.
  - **Pflicht:** Index 0 MUSS exakt `metadata.primary_disease` behandeln (`"disease"` identisch mit `primary_disease`). Index 1 & 2 behandeln Differenzialdiagnosen.

## G. SYNAPSES MATRIX (`extra_tasks.synapses_matrix` – 4x4 Board)

  - **Konzept:** 4 Krankheiten (`diseases`, Index 0 = `primary_disease`) × 4 feste Dimensionen (`"Risikofaktor/Pathophysiologie"`, `"Diagnostik"`, `"Therapie"`, `"Symptom"`) = 16 Kacheln. Jede Krankheit steuert exakt 1 Begriff pro Dimension bei.
  - **Kachel-Ergonomie:** Jeder Begriff (`term` / `items`) max. 1–4 Wörter (ideal < 28 Zeichen, keine Sätze). Hohe Trennschärfe mit Red Herrings, aber eindeutiger 4x4-Lösung.
  - **Felder:** `"description"`, `"hint"`, `"diseases"` (4 Strings), `"groups"` (4 Objekte mit `"title"`, `"level"` 0–3, `"items"` [4 Strings], `"explanation"` [1–2 Sätze]), `"variables"` (16 Objekte `{ "term": "...", "type": "...", "disease": "..." }`).
  - **SHUFFLE-PFLICHT:** `variables` MUSS komplett pseudozufällig durchmischt sein (keine Gruppenblöcke oder zyklischen Muster).

## H. MASTER QUIZ (`extra_tasks.master_quiz` – Mind. 5 MC-Fragen, Typ A)

1.  **Tagging:** Mind. Frage 1 & 2 (Index 0, 1) behandeln `primary_disease` (`"is_primary": true`, `"target_disease"` = `primary_disease`). Restliche Fragen behandeln Differenzialdiagnosen (`"is_primary": false`).
2.  **Anspruch (Bloom 3–5):** Fallvignetten mit zweistufigem Denkschritt (Befundsynthese -> Diagnose -> Therapie/Mechanismus) und klinischen Zielkonflikten. Kein First-Order Recall! Distraktoren auf Facharztniveau (Cognitive Biases, Kontraindikationen).
3.  **Anti-Bias-Protokoll (STRIKT):**
      - **Längenparität:** Alle 5 Optionen (`options`) innerhalb 10–15 % Zeichenvarianz.
      - **Homogenität:** Gleicher grammatikalischer Typus, keine Begründungssätze ("weil...", "um zu..."), keine absoluten Signalwörter ("immer", "nie"), keine Meta-Optionen ("Alle genannten"). Option-Reihenfolge willkürlich permutieren.
      - **Schlüsselverteilung (`correct_index` 0–4):** Bei 5 Fragen MUSS jeder Index (0, 1, 2, 3, 4) genau einmal vorkommen (z. B. 2, 4, 0, 3, 1). KEIN Bias zu 0/1 (A/B)! Aufeinanderfolgende Fragen dürfen NIEMALS denselben `correct_index` haben.
4.  **Feedback (`explanation` & `hint`):**
      - `"hint"`: Sokratischer Impuls ohne Spoiler (Feld heißt rein `"hint"`).
      - `"explanation"`: 1. Expliziter Zeichenvergleich aller 5 Optionen inkl. Varianz-Prozentangabe, 2. Mechanistische Begründung der richtigen Option (Rezeptoren, Ionenkanäle, Enzymwege), 3. Dezidierte klinische Entkräftung JEDES einzelnen Distraktors.

# 3. JSON-SCHEMA (TEMPLATE)

{ "case_id": "STRING_IDENTIFIER", "metadata": { "title": "STRING", "primary_disease": "STRING", "medical_field": "STRING", "bloom_level": "Evaluation & Synthese", "difficulty": 5, "xp_reward": 1200 }, "case_overview": { "topic": "STRING", "cornell_notes": [ { "cues": ["Fachbegriff 1 (Plain-Text)", "Fachbegriff 2 (Plain-Text)"], "notes": "<p>Erklärung mit <b>zwingend intensiver Fettmarkierung</b> aller <b>Schlüsselbegriffe</b> und <b>Grenzwerte</b>.</p><ul><li><b>Aspekt 1:</b> Details mit <b>fett markierten Fakten</b> (synchron zu Cue 1).</li><li><b>Aspekt 2:</b> Details mit <b>fett markierten Medikamenten</b> (synchron zu Cue 2).</li></ul>" } ], "summary": "Plain-Text Synthese (2-4 Sätze: Kern, Mechanismus, Konsequenz)." }, "timeline": [ { "step_id": 1, "patient_id": "patient_1", "phase": "Patient 1: Phase", "content": "Patient 1\\n\\nRealistischer Plain-Text Bericht ohne HTML (70-160 Wörter)...", "hotspots": [ { "phrase": "exakter Substring drei bis acht Wörter", "is_error": false, "feedback": "Pathophysiologische Begründung der Richtigkeit." }, { "phrase": "subtil fehlerhafter klinischer Handlungsschritt", "is_error": true, "socratic_trap": "Lenkende sokratische Frage ohne Lösungsspoiler?", "correct_pathophysiology": "Fundierte pathophysiologische Korrektur." } ] } ], "extra_tasks": { "flashcards": [ { "id": "fc_01", "category": "Kategorie", "difficulty": "basic", "front": "Direkte atomare Faktenfrage?", "back": "Knappe Antwort (< 2 Sek. Lesezeit).", "mnemonic_or_context": "Kurze Eselsbrücke (max. 140 Zeichen)." } ], "doctordle": [ { "puzzle_id": 1, "title": "Fall 1", "target_diagnosis": "Erkrankung A", "synonyms": ["Synonym 1", "Synonym 2", "Synonym 3"], "hints": ["Hinweis 1: ...", "Hinweis 2: ...", "Hinweis 3: ...", "Hinweis 4: ...", "Hinweis 5: ...", "Hinweis 6: ..."], "learning_pearl": "Kernaussage." } ], "library_entries": ["Erkrankung A", "Synonym 1", "Differenzialdiagnose 1"], "clinical_cascades": [ { "disease": "Exakter Name der primary_disease", "hint": "Hinweis", "cascade": [ { "stage": "01_Auslöser", "content": "..." }, { "stage": "02_Pathophysiologie", "content": "..." }, { "stage": "03_Zellulärer Mechanismus", "content": "..." }, { "stage": "04_Anatomische Konsequenz", "content": "..." }, { "stage": "05_Klinische Manifestation", "content": "..." }, { "stage": "06_Diagnostischer Befund", "content": "..." }, { "stage": "07_Therapeutische Intervention", "content": "..." }, { "stage": "08_Outcome", "content": "..." } ] } ], "synapses_matrix": { "description": "Finde 4 Gruppen aus jeweils 4 klinisch zusammengehörigen Begriffen.", "hint": "Verbinde Risikofaktor/Pathophysiologie, Symptom, Diagnostik und Therapie der 4 Krankheitsbilder.", "diseases": ["Erkrankung A", "Erkrankung B", "Erkrankung C", "Erkrankung D"], "groups": [ { "title": "Erkrankung A", "level": 0, "items": ["Term A1", "Term A2", "Term A3", "Term A4"], "explanation": "Klinische Zusammenfassung." } ], "variables": [ { "term": "Term C1", "type": "Diagnostik", "disease": "Erkrankung C" }, { "term": "Term A2", "type": "Risikofaktor/Pathophysiologie", "disease": "Erkrankung A" } ] }, "categorization": { "description": "Ordne die klinischen Befunde, Manöver und Phänomene den entsprechenden Krankheitsbildern zu.", "hint": "Differenziere die pathognomonischen Befunde der einzelnen Entitäten.", "categories": ["Erkrankung A", "Erkrankung B", "Erkrankung C", "Erkrankung D"], "items": [ { "term": "Befund 1", "category": "Erkrankung C" }, { "term": "Befund 2", "category": "Erkrankung A" } ] }, "master_quiz": [ { "target_disease": "Exakter Name der primary_disease", "is_primary": true, "question": "Fallvignette mit zweistufiger Leitfrage...", "options": ["Option A", "Option B", "Option C", "Option D", "Option E"], "correct_index": 2, "explanation": "Zeichenvergleich:\\n- Option A: 48 Z.\\n- Option B: 49 Z.\\n- Option C: 47 Z.\\n- Option D: 46 Z.\\n- Option E: 48 Z.\\n(Maximale Varianz: 6.2 %)\\n\\nFundierte Rationale für Option C: [...Reference...Mechanismus...]\\n\\nKlinische Analyse der Distraktoren:\\n- Option A: [...]\\n- Option B: [...]\\n- Option D: [...]\\n- Option E: [...]", "hint": "Hinweis ohne Spoiler." } ] } }`
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
