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
        finalInstruction = `Du bist ein didaktischer Software-Architekt und medizinischer Fachexperte. Generiere aus dem Quelltext genau EINEN vollständigen Lernfall als syntaktisch valides JSON-Objekt.

KRITISCHE TECHNISCHE REGELN:
1. Antworte AUSSCHLIESSLICH mit dem validen JSON-Objekt ({ ... }).
2. Füge keine Zitationsmarker wie [1] ein.
3. HTML-Tags (<p>, <b>, <ul>, <li>) sind ausschließlich im Feld case_overview.cornell_notes[].notes gestattet.
4. Erstelle im Feld extra_tasks.flashcards mindestens 8 atomare Fakten-Flashcards.

JSON-SCHEMA:
{
  "case_id": "STRING_IDENTIFIER",
  "metadata": {
    "title": "STRING",
    "primary_disease": "STRING",
    "medical_field": "${medicalField}",
    "bloom_level": "Evaluation & Synthese",
    "difficulty": 5,
    "xp_reward": 1200
  },
  "case_overview": {
    "topic": "STRING",
    "cornell_notes": [
      {
        "cues": ["Schlüsselbegriff 1", "Schlüsselbegriff 2"],
        "notes": "<p>Fundierte Erklärung mit <b>wichtigen Inhalten fett</b>.</p>"
      }
    ],
    "summary": "STRING"
  },
  "timeline": [
    {
      "step_id": 1,
      "patient_id": "patient_1",
      "phase": "Phase 1: Ausgangslage & Analyse",
      "content": "Ausführlicher Plain-Text Bericht ohne HTML (70-160 Wörter)...",
      "hotspots": [
        {
          "phrase": "exakter Textteil",
          "is_error": false,
          "feedback": "Begründung."
        }
      ]
    }
  ],
  "extra_tasks": {
    "flashcards": [
      {
        "id": "fc_01",
        "category": "Teilgebiet",
        "difficulty": "basic",
        "front": "Faktenfrage",
        "back": "Faktenantwort",
        "mnemonic_or_context": "Eselsbrücke"
      }
    ],
    "doctordle": [
      {
        "puzzle_id": 1,
        "title": "Deduktion 1",
        "target_diagnosis": "Diagnose",
        "synonyms": ["Synonym 1"],
        "hints": ["Hinweis 1", "Hinweis 2", "Hinweis 3", "Hinweis 4", "Hinweis 5", "Hinweis 6"],
        "learning_pearl": "Kernaussage"
      }
    ],
    "library_entries": ["Begriff A"],
    "clinical_cascades": [
      {
        "disease": "Erkrankung",
        "hint": "Hinweis",
        "cascade": [
          { "stage": "01_Auslöser", "content": "..." },
          { "stage": "02_Mechanismus", "content": "..." },
          { "stage": "03_Konsequenz", "content": "..." },
          { "stage": "04_Outcome", "content": "..." }
        ]
      }
    ],
    "synapses_matrix": {
      "description": "Bilde 4er-Gruppen.",
      "hint": "Hinweis",
      "diseases": ["Kategorie A", "Kategorie B", "Kategorie C", "Kategorie D"],
      "variables": [
        { "term": "Terminus", "type": "Risiko/Pathologie", "disease": "Kategorie A" }
      ]
    },
    "categorization": {
      "description": "Zuordnung",
      "hint": "Hinweis",
      "categories": ["Kategorie A", "Kategorie B", "Kategorie C"],
      "items": [
        { "term": "Befund", "category": "Kategorie A" }
      ]
    },
    "master_quiz": [
      {
        "target_disease": "Thema",
        "is_primary": true,
        "question": "Prüfungsfrage",
        "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
        "correct_index": 0,
        "explanation": "Begründung."
      }
    ]
  }
}

THEMA / SKRIPT:
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
