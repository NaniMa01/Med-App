const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_PROMPT_LENGTH = 10000;

function sendJson(res, status, payload) {
    res.status(status).json(payload);
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

+function extractJsonObject(text) {
+    if (typeof text !== 'string') {
+        throw new Error('Gemini response is not a string.');
+    }
+
+    let value = text
+        .replace(/^\uFEFF/, '')
+        .replace(/^```json\s*/i, '')
+        .replace(/^```\s*/i, '')
+        .replace(/\s*```$/i, '')
+        .trim();
+
+    try {
+        return JSON.parse(value);
+    } catch (_error) {
+        const firstBrace = value.indexOf('{');
+        const lastBrace = value.lastIndexOf('}');
+
+        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
+            throw new Error('No JSON object found in Gemini response.');
+        }
+
+        const possibleJson = value.slice(firstBrace, lastBrace + 1);
+        return JSON.parse(possibleJson);
+    }
+}
+

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return sendJson(res, 500, { error: 'Server misconfiguration: GEMINI_API_KEY is missing.' });
    }

    const parsedBody = parseRequestBody(req.body);
    if (!parsedBody) {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }

    const prompt = typeof parsedBody.prompt === 'string' ? parsedBody.prompt.trim() : '';
    if (!prompt) {
        return sendJson(res, 400, { error: 'Missing "prompt" field.' });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
        return sendJson(res, 400, { error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} characters.` });
    }

       const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const instruction = `
Du bist ein medizinischer Facharzt und didaktischer Content-Architekt.

Erstelle aus dem folgenden Rohtext genau EINEN medizinischen Fall.

WICHTIG:
- Antworte ausschließlich mit einem gültigen JSON-Objekt.
- Verwende keine Markdown-Codeblöcke.
- Verwende keine Einleitung.
- Verwende keine Erklärung außerhalb des JSON-Objekts.
- Beginne direkt mit { und ende direkt mit }.
- Verwende doppelte Anführungszeichen für alle JSON-Schlüssel und Stringwerte.
- Verwende keine Kommentare im JSON.
- Verwende kein trailing comma.
- Erzeuge kein Feld "body_mapping".
- Erzeuge keine Aufgabe zur Zuordnung einer Erkrankung zu einem Körperteil.

Das JSON muss exakt diese Grundstruktur besitzen:

{
  "case_id": "EINDEUTIGE_ID",
  "metadata": {
    "title": "STRING",
    "medical_field": "29.2.10_Erkrankungen des Rückenmarks und des peripheren Nervensystems",
    "bloom_level": "Evaluation & Synthese",
    "difficulty": 5,
    "xp_reward": 900
  },
  "case_overview": {
    "topic": "STRING",
    "cornell_notes": [
      {
        "cues": ["STRING", "STRING", "Was?", "Warum?"],
        "notes": "HTML-formatierte Erklärung mit <strong>, <ul> und <li>"
      }
    ],
    "summary": "STRING"
  },
  "timeline": [
    {
      "step_id": 1,
      "patient_id": "patient_1",
      "phase": "STRING",
      "content": "STRING",
      "hotspots": [
        {
          "phrase": "exakter Text aus content",
          "is_error": false,
          "skill_tag": "Triage",
          "feedback": "STRING"
        }
      ]
    }
  ],
  "extra_tasks": {
    "clinical_cascades": [],
    "synapses_matrix": {
      "variables": []
    },
    "categorization": {
      "items": []
    },
    "master_quiz": []
  }
}

VERBINDLICHE REGELN:
- Erzeuge exakt 9 Timeline-Schritte.
- Verwende exakt 3 Patienten.
- Jeder Patient erhält exakt 3 Timeline-Schritte.
- Jeder Patient erhält mindestens einen Hotspot mit "is_error": false.
- Jede Hotspot-"phrase" muss exakt in "content" vorkommen.
- Jeder Hotspot benötigt ein "skill_tag".
- Fehler-Hotspots benötigen zusätzlich "socratic_trap" und "correct_pathophysiology".
- Jede Clinical Cascade benötigt exakt 8 Schritte.
- Erzeuge 5 bis 10 Master-Quizfragen.
- Jede Master-Quizfrage benötigt "question", "options", "correct_index", "explanation" und "tutor_hint".
- Jede zusätzliche Aufgabe benötigt ein "tutor_hint".
- Das Feld "medical_field" muss exakt dem vorgegebenen Wert entsprechen.
- Das Feld "body_mapping" darf nicht erzeugt werden.

ROHTEXT:
${prompt}
`;
    try {
        const upstream = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: instruction }] }],
                generationConfig: {
                    temperature: 0.3,
                    responseMimeType: 'application/json'
                }
            })
        });

        const upstreamText = await upstream.text();
        let upstreamJson = null;
        try {
            upstreamJson = upstreamText ? JSON.parse(upstreamText) : null;
        } catch (_error) {}

        if (!upstream.ok) {
            const upstreamMessage =
                upstreamJson?.error?.message ||
                upstreamJson?.message ||
                `Gemini API request failed with status ${upstream.status}.`;
            return sendJson(res, 502, { error: upstreamMessage, upstreamStatus: upstream.status });
        }

        const generatedText = upstreamJson?.candidates?.[0]?.content?.parts
            ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('')
            .trim();

    if (!generatedText) {
    return sendJson(res, 502, {
        error: 'Gemini returned no usable content.'
    });
}

let generatedCase;

try {
    generatedCase = extractJsonObject(generatedText);
} catch (error) {
    return sendJson(res, 502, {
        error: 'Gemini returned invalid JSON.',
        details: error.message,
        rawResponse: generatedText.slice(0, 4000)
    });
}

if (!generatedCase.case_id || !generatedCase.metadata || !generatedCase.timeline) {
    return sendJson(res, 502, {
        error: 'Gemini JSON is missing required fields.'
    });
}

return sendJson(res, 200, {
    ok: true,
    model,
    generatedText: JSON.stringify(generatedCase),
    generatedCase
});

        const cleanedText = generatedText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let generatedCase;

        try {
            generatedCase = JSON.parse(cleanedText);
        } catch (error) {
            return sendJson(res, 502, {
                error: 'Gemini returned invalid JSON.',
                details: error.message,
                rawResponse: cleanedText
            });
        }

        if (!generatedCase.case_id || !generatedCase.metadata || !generatedCase.timeline) {
            return sendJson(res, 502, {
                error: 'Gemini JSON is missing required fields.'
            });
        }

        if (!Array.isArray(generatedCase.timeline)) {
            return sendJson(res, 502, {
                error: 'The timeline must be an array.'
            });
        }

        return sendJson(res, 200, {
            ok: true,
            model,
            generatedText: JSON.stringify(generatedCase),
            generatedCase
        });

        return sendJson(res, 200, {
            ok: true,
            model,
            generatedText
        });
    } catch (error) {
        return sendJson(res, 500, {
            error: 'Unexpected server error while contacting Gemini.',
            details: error?.message || 'Unknown error'
        });
    }
};
