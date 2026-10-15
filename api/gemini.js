// ==========================================================================
// api/gemini.js – Zentrale Serverless AI-Engine (Fall-Schmiede & Lern-Depot)
// ==========================================================================

const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = 'gemini-1.5-flash';
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

// Universeller JSON-Extractor für Objekte { ... } UND Arrays [ ... ]
function extractFlexibleJson(text) {
    if (typeof text !== 'string') {
        throw new Error('Gemini response is not a string.');
    }

    let value = text
        .replace(/^\uFEFF/, '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
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

// Hilfsfunktion für den Google API Request inkl. automatischem Modell-Fallback
async function callGeminiUpstream(apiKey, modelName, instructionText, temperature = 0.7) {
   const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(gemini3.5 flash-lite)}:generateContent?key=${apiKey}`;

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

    return { ok: response.ok, status: response.status, json, rawText, usedModel: modelName };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
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
    const medicalField = requestedMedicalField || '29.2.10_Erkrankungen des Rückenmarks und des peripheren Nervensystems';

    // =======================================================================
    // PROMPT-AUSWAHL JE NACH MODUS ('depot_quiz' vs. 'case_forge')
    // =======================================================================
    let finalInstruction = '';

    if (mode === 'depot_quiz') {
        // Im Depot-Quiz-Modus kommt der fertige IMPP-Vignetten-Prompt direkt aus der app.js
        finalInstruction = prompt;
    } else {
        // Vollständiger System-Prompt für die In-App Fall-Schmiede
        finalInstruction = `Du bist ein erfahrener Facharzt, universitärer Prüfungsbeauftragter für das humanmedizinische Staatsexamen (orientiert an IMPP- und NBME-Standards) und leitender didaktischer Software-Architekt für MedCheck. Deine Aufgabe ist es, aus dem übergebenen Vorlesungsskript bzw. medizinischen Fachtext genau EINEN maximal vollständigen, hochdifferenzierten Fall als syntaktisch valides JSON-Objekt zu generieren.

ZIELGRUPPE & DIDAKTISCHER ANSPRUCH:
- Medizinstudierende im letzten Masterjahr vor dem Staatsexamen.
- Fokus auf Differenzialdiagnosen, pathophysiologische Kausalketten, diagnostische Goldstandards, Leitlinienempfehlungen und klinische Fallstricke (Cognitive Biases, typische Behandlungsfehler).
- Höchste Fachterminologie: Verwende konkrete Fachbegriffe, anatomische Leitstrukturen, exakte Laborparameter (mit Einheiten/Grenzwerten), Bildgebungsmorphologien und Medikamentennamen inklusive Wirkmechanismen.

KRITISCHE TECHNISCHE REGELN FÜR DEN IMPORT (ZERO-TOLERANCE):
1. Antworte AUSSCHLIESSLICH mit dem validen JSON-Objekt ({ ... }).
2. Füge NIEMALS Zitationsmarker wie oder [1] ein.
3. HTML-Tags (<p>, <b>, <ul>, <li>) sind ausschließlich im Feld case_overview.cornell_notes[].notes gestattet. Alle übrigen Felder sind reiner Plain-Text.

JSON-SCHEMA:
{
  "case_id": "STRING_IDENTIFIER",
  "metadata": {
    "title": "STRING",
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
        "notes": "<p>Fundierte Erklärung mit <b>wichtigen Inhalten immer fett</b>.</p><ul><li><b>Aspekt 1:</b> Details.</li></ul>"
      }
    ],
    "summary": "STRING"
  },
  "timeline": [
    {
      "step_id": 1,
      "patient_id": "patient_1",
      "phase": "Patient 1: Anamnese & Erstkontakt",
      "content": "Patient 1\\n\\nAusführlicher Plain-Text Bericht ohne HTML (70-160 Wörter)...",
      "hotspots": [
        {
          "phrase": "exakter Textteil",
          "is_error": false,
          "feedback": "Diese Feststellung ist im klinischen Kontext fachlich vollkommen korrekt."
        }
      ]
    }
  ],
  "extra_tasks": {
    "doctordle": [
      {
        "puzzle_id": 1,
        "title": "Fall 1",
        "target_diagnosis": "Diagnose A",
        "synonyms": ["Synonym 1", "Synonym 2"],
        "hints": ["Hinweis 1", "Hinweis 2", "Hinweis 3", "Hinweis 4", "Hinweis 5", "Hinweis 6"],
        "learning_pearl": "Kernaussage."
      }
    ],
    "library_entries": ["Diagnose A", "Diagnose B"],
    "clinical_cascades": [
      {
        "disease": "Erkrankung A",
        "hint": "Hinweis",
        "cascade": [
          { "stage": "01_Auslöser", "content": "..." },
          { "stage": "02_Pathophysiologie", "content": "..." },
          { "stage": "03_Zellulärer Mechanismus", "content": "..." },
          { "stage": "04_Anatomische Konsequenz", "content": "..." },
          { "stage": "05_Klinische Manifestation", "content": "..." },
          { "stage": "06_Diagnostischer Befund", "content": "..." },
          { "stage": "07_Therapeutische Intervention", "content": "..." },
          { "stage": "08_Outcome", "content": "..." }
        ]
      }
    ],
    "synapses_matrix": {
      "description": "Ordne jeweils vier Begriffe derselben Erkrankung zu.",
      "hint": "Hinweis",
      "diseases": ["Erkrankung A", "Erkrankung B", "Erkrankung C", "Erkrankung D"],
      "variables": [
        { "term": "Terminus", "type": "Risiko/Pathologie", "disease": "Erkrankung A" }
      ]
    },
    "categorization": {
      "description": "Ordne die klinischen Befunde den Krankheitsbildern zu.",
      "hint": "Hinweis",
      "categories": ["Krankheitsbild A", "Krankheitsbild B", "Krankheitsbild C"],
      "items": [
        { "term": "Befund", "category": "Krankheitsbild A" }
      ]
    },
    "master_quiz": [
      {
        "question": "Fallvignette + Leitfrage",
        "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
        "correct_index": 0,
        "explanation": "Fundierte Begründung inkl. Ausschluss der Distraktoren.",
        "hint": "Hinweis"
      }
    ]
  }
}

 THEMA / SKRIPT:
${prompt}`;
    }

    const configuredModel = (process.env.GEMINI_MODEL || PRIMARY_MODEL).trim();

    try {
        // 1. Versuch mit dem konfigurierten Hauptmodell
        let result = await callGeminiUpstream(apiKey, configuredModel, finalInstruction, 0.65);

        // Falls das Modell (z.B. wegen Tippfehler in ENV wie 'gemini-3.5-flash-lite') mit 404/400 ablehnt -> Sofortiger Fallback!
        if (!result.ok && (result.status === 404 || result.status === 400) && configuredModel !== FALLBACK_MODEL) {
            console.warn(`Modell ${configuredModel} nicht verfügbar (${result.status}). Wechsle automatisch auf ${FALLBACK_MODEL}...`);
            result = await callGeminiUpstream(apiKey, FALLBACK_MODEL, finalInstruction, 0.65);
        }

        if (!result.json) {
            return sendJson(res, 502, {
                error: 'Gemini API returned a non-JSON response.',
                upstreamStatus: result.status,
                rawResponse: (result.rawText || '').slice(0, 1500)
            });
        }

        if (!result.ok) {
            const upstreamMessage =
                result.json?.error?.message ||
                result.json?.message ||
                `Gemini API request failed with status ${result.status}.`;
            return sendJson(res, 502, { error: upstreamMessage, upstreamStatus: result.status });
        }

        const generatedText = result.json?.candidates?.[0]?.content?.parts
            ?.map(part => (typeof part?.text === 'string' ? part.text : ''))
            .join('')
            .trim();

        if (!generatedText) {
            return sendJson(res, 502, {
                error: 'Gemini returned no usable content.',
                finishReason: result.json?.candidates?.[0]?.finishReason || null
            });
        }

        // WICHTIG: Hier rufen wir jetzt korrekt extractFlexibleJson auf!
        let parsedOutput;
        try {
            parsedOutput = extractFlexibleJson(generatedText);
        } catch (error) {
            return sendJson(res, 502, {
                error: 'Gemini returned invalid JSON format.',
                details: error.message,
                rawResponse: generatedText.slice(0, 3000)
            });
        }

        // ===================================================================
        // AUSGABE MODUS 1: DEPOT-QUIZ (Erwartet ein JSON-Array mit Fragen)
        // ===================================================================
        if (mode === 'depot_quiz') {
            // Falls Gemini das Array in ein Objekt wie { "questions": [...] } gewickelt hat, entpacken wir es automatisch:
            const questionsArray = Array.isArray(parsedOutput)
                ? parsedOutput
                : (Array.isArray(parsedOutput?.questions) ? parsedOutput.questions : null);

            if (!questionsArray || questionsArray.length === 0) {
                return sendJson(res, 502, { error: 'Gemini response for depot_quiz must be a non-empty JSON array.' });
            }

            return sendJson(res, 200, {
                ok: true,
                model: result.usedModel,
                result: questionsArray
            });
        }

        // ===================================================================
        // AUSGABE MODUS 2: FALL-SCHMIEDE (Erwartet ein Fall-Objekt)
        // ===================================================================
        if (!parsedOutput || typeof parsedOutput !== 'object' || Array.isArray(parsedOutput)) {
            return sendJson(res, 502, { error: 'Gemini response is not a JSON object.' });
        }

        if (!parsedOutput.case_id || !parsedOutput.metadata || !Array.isArray(parsedOutput.timeline)) {
            return sendJson(res, 502, { error: 'Gemini JSON is missing required case fields.' });
        }

        parsedOutput.metadata.medical_field = medicalField;

        return sendJson(res, 200, {
            ok: true,
            model: result.usedModel,
            generatedText: JSON.stringify(parsedOutput),
            generatedCase: parsedOutput
        });

    } catch (error) {
        console.error('Gemini API error:', error);
        return sendJson(res, 500, {
            error: 'Unexpected server error while contacting Gemini.',
            details: error?.message || 'Unknown error'
        });
    }
};
