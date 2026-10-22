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

  - Zielgruppe: Medizinstudierende vor dem Staatsexamen (2. Masterjahr).
  - Fokus: Differenzialdiagnosen, Pathophysiologie-Kausalketten, Goldstandards, Leitlinien, Fallstricke (Cognitive Biases, Behandlungsfehler).
  - Sprache: Höchste Fachterminologie, anatomische Leitstrukturen, exakte Laborparameter (mit Einheiten/Grenzwerten), Bildgebung, Medikamente inkl. Wirkmechanismen.

# 1. KRITISCHE TECHNISCHE REGELN (ZERO-TOLERANCE)
1. ZWINGENDE CASE_ID ZUERST: "case_id": "STRING_IDENTIFIER" MUSS die allererste Eigenschaft im JSON sein. Darf niemals fehlen oder leer sein.
2. REINES ROHTEXT-JSON (TRUNCATION-SCHUTZ): Antworte AUSSCHLIESSLICH mit dem JSON-Objekt (Erstes Zeichen {, letztes Zeichen }). KEIN einleitender/erklärender Text, KEINE Markdown-Codeblöcke, KEINE Kommentare. Muss direkt durch JSON.parse() lesbar und vollständig geschlossen sein.
3. STRIKTES ZITATIONSVERBOT: Absolut verboten sind Zitationsmarker, Quellenverweise, Span-Markierungen oder Tags jeder Art.
4. STRING-ESCAPING: Unescapte doppelte Anführungszeichen in Strings sind VERBOTEN (nutze '...' oder \\"). Zeilenumbrüche in Strings zwingend als \\n\\n escapen. Keine unmaskierten LaTeX-Backslashes (nutze Unicode wie ≥, ≤, ±, →).
5. HTML-GÜLTIGKEITSBEREICH: HTML-Tags (<p>, <b>, <ul>, <li>) sind AUSSCHLIESSLICH in case_overview.cornell_notes[].notes erlaubt. Alle anderen Felder sind ausnahmslos reiner Plain-Text!
6. SYSTEMANKER (metadata.primary_disease): Exakte Zielerkrankung des Falls als primärer Filter-Anker.

# 2. SEKTIONSSPEZIFISCHE ANFORDERUNGEN
## A. CASE_OVERVIEW
- cornell_notes: Vollständige Abdeckung. 1:1 Höhen-Synchronisation zwischen cues (Array aus reinem Plain-Text) und notes.
- In notes zwingende intensive Fettmarkierung mit <b>...</b> aller Schlüsselbegriffe, Grenzwerte und Medikamente.
- summary: Reiner Plain-Text (2-4 Sätze: Kern/Definition, Mechanismus, klinische Konsequenz).

## B. AUDIT & TIMELINE (timeline – 9 Schritte)
- 9 Schritte in 3 Patientenszenarien (patient_1, patient_2, patient_3 à 3 Schritte, je 70-160 Wörter).
- Hotspots (phrase): Exakter Substring aus content (3-8 Wörter).
- In 6-7 Schritten subtile Fehler ("is_error": true) mit "socratic_trap" und "correct_pathophysiology".
- Restliche Hotspots ("is_error": false) mit pathophysiologischer Begründung in "feedback".

## C. FLASHCARDS (extra_tasks.flashcards – 8 bis 12 Karten)
- Reines deklaratives Faktenwissen (Bloom-Stufe 1). Atomarer Fakt pro Karte.
- Felder: id, category, difficulty, front, back, mnemonic_or_context.

## D. DOCTORDLE & LIBRARY
- doctordle: Genau 3 Objekte mit puzzle_id (1, 2, 3), title ("Fall 1", "Fall 2", "Fall 3"), target_diagnosis, synonyms, hints (6 progressive Hinweise), learning_pearl.
- library_entries: Array aus 15-20 Strings (Diagnosen, Synonyme, Differenzialdiagnosen).

## E. TAXONOMIE (extra_tasks.categorization)
- 8-12 Items mit term und category zu 3-4 Krankheitsentitäten. Array items zufällig durchmischt.

## F. CLINICAL CASCADES (extra_tasks.clinical_cascades)
- 3 Erkrankungen à 8 Stufen (01_Auslöser bis 08_Outcome). Index 0 = primary_disease.

## G. SYNAPSES MATRIX (extra_tasks.synapses_matrix – 4x4 Board)
- 4 Krankheiten × 4 Dimensionen ("Risikofaktor/Pathophysiologie", "Diagnostik", "Therapie", "Symptom") = 16 Kacheln. Array variables zufällig durchmischt.

## H. MASTER QUIZ (extra_tasks.master_quiz – Mind. 5 MC-Fragen, Typ A)
- Frage 1 & 2 behandeln primary_disease. Optionen mit 10-15 % Längenparität.
- correct_index (0-4) gleichmäßig verteilt. Ausführliche explanation mit Distraktoren-Entkräftung.

# 3. ZU ANALYSIERENDER FACHTEXT / THEMA
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
