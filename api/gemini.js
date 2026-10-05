const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_PROMPT_LENGTH = 10000;

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

function extractJsonObject(text) {
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
        const lastBrace = value.lastIndexOf('}');

        if (
            firstBrace === -1 ||
            lastBrace === -1 ||
            lastBrace <= firstBrace
        ) {
            throw new Error('No JSON object found in Gemini response.');
        }

        const possibleJson = value.slice(firstBrace, lastBrace + 1);
        return JSON.parse(possibleJson);
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, {
            error: 'Method not allowed. Use POST.'
        });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return sendJson(res, 500, {
            error: 'Server misconfiguration: GEMINI_API_KEY is missing.'
        });
    }

    const parsedBody = parseRequestBody(req.body);

    if (!parsedBody) {
        return sendJson(res, 400, {
            error: 'Invalid JSON body.'
        });
    }

    const prompt =
        typeof parsedBody.prompt === 'string'
            ? parsedBody.prompt.trim()
            : '';

    if (!prompt) {
        return sendJson(res, 400, {
            error: 'Missing "prompt" field.'
        });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
        return sendJson(res, 400, {
            error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} characters.`
        });
    }

    const requestedMedicalField =
        typeof parsedBody.medicalField === 'string'
            ? parsedBody.medicalField.trim()
            : '';

    const medicalField =
        requestedMedicalField ||
        '29.2.10_Erkrankungen des Rückenmarks und des peripheren Nervensystems';

    const model = (
        process.env.GEMINI_MODEL || DEFAULT_MODEL
    ).trim();

    const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent?key=` +
        `${encodeURIComponent(apiKey)}`;

    const instruction = `
Du bist ein medizinischer Facharzt und didaktischer Content-Architekt.

Erstelle aus dem folgenden Rohtext genau EINEN medizinischen Fall.

WICHTIGE AUSGABEREGELN:
- Antworte ausschließlich mit einem gültigen JSON-Objekt.
- Beginne direkt mit {.
- Beende direkt mit }.
- Verwende keine Markdown-Codeblöcke.
- Verwende keine Einleitung.
- Verwende keine Erklärung außerhalb des JSON-Objekts.
- Verwende doppelte Anführungszeichen.
- Verwende keine Kommentare.
- Verwende keine trailing commas.
- Erzeuge kein Feld "body_mapping".
- Erzeuge keine Aufgabe zur Zuordnung einer Erkrankung zu einem Körperteil.
- Das Feld "medical_field" muss exakt diesen Wert enthalten:
  "${medicalField}"

Erzeuge exakt diese Grundstruktur:

{
  "case_id": "EINDEUTIGE_ID",
  "metadata": {
    "title": "STRING",
    "medical_field": "${medicalField}",
    "bloom_level": "Evaluation & Synthese",
    "difficulty": 5,
    "xp_reward": 900
  },
  "case_overview": {
    "topic": "STRING",
    "cornell_notes": [
      {
        "cues": ["STRING", "STRING", "Was?", "Warum?"],
        "notes": "HTML-formatierte Erklärung"
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
    "clinical_cascades": [
      {
        "disease": "STRING",
        "tutor_hint": "STRING",
        "cascade": [
          {
            "stage": "01_Auslöser",
            "content": "STRING"
          },
          {
            "stage": "02_Pathophysiologie",
            "content": "STRING"
          },
          {
            "stage": "03_Zellulärer Mechanismus",
            "content": "STRING"
          },
          {
            "stage": "04_Anatomische Konsequenz",
            "content": "STRING"
          },
          {
            "stage": "05_Klinische Manifestation",
            "content": "STRING"
          },
          {
            "stage": "06_Diagnostischer Befund",
            "content": "STRING"
          },
          {
            "stage": "07_Therapeutische Intervention",
            "content": "STRING"
          },
          {
            "stage": "08_Outcome",
            "content": "STRING"
          }
        ]
      }
    ],
    "synapses_matrix": {
      "description": "Ordne jeweils vier Begriffe derselben Erkrankung zu.",
      "tutor_hint": "Verbinde Risiko/Pathologie, Symptom/Klinik, Diagnostik und Therapie/Management.",
      "diseases": [
        "STRING",
        "STRING",
        "STRING"
      ],
      "variables": [
        {
          "term": "STRING",
          "type": "Risiko/Pathologie",
          "disease": "STRING"
        },
        {
          "term": "STRING",
          "type": "Symptom/Klinik",
          "disease": "STRING"
        },
        {
          "term": "STRING",
          "type": "Diagnostik",
          "disease": "STRING"
        },
        {
          "term": "STRING",
          "type": "Therapie/Management",
          "disease": "STRING"
        }
      ]
    },
    "categorization": {
      "description": "Ordne die klinischen Begriffe den korrekten Kategorien zu.",
      "tutor_hint": "Achte darauf, ob der Begriff Ursache, Klinik, Diagnostik oder Therapie beschreibt.",
      "categories": [
        "Risiko/Pathologie",
        "Symptom/Klinik",
        "Diagnostik",
        "Therapie/Management"
      ],
      "items": [
        {
          "term": "STRING",
          "category": "Risiko/Pathologie"
        },
        {
          "term": "STRING",
          "category": "Symptom/Klinik"
        },
        {
          "term": "STRING",
          "category": "Diagnostik"
        },
        {
          "term": "STRING",
          "category": "Therapie/Management"
        }
      ]
    },
    "master_quiz": [
      {
        "question": "STRING",
        "options": [
          "STRING",
          "STRING",
          "STRING",
          "STRING"
        ],
        "correct_index": 0,
        "explanation": "STRING",
        "tutor_hint": "STRING"
      }
    ]
  }

VERBINDLICHE REGELN:

TIMELINE:
- Erzeuge exakt 9 Timeline-Schritte.
- Verwende exakt 3 Patienten.
- Jeder Patient erhält exakt 3 Schritte.
- Jeder Patient benötigt mindestens einen Hotspot mit "is_error": false.
- Jede Hotspot-"phrase" muss exakt in "content" vorkommen.
- Jeder Hotspot benötigt ein "skill_tag".
- Fehler-Hotspots benötigen zusätzlich:
  "socratic_trap" und "correct_pathophysiology".

CASE OVERVIEW:
- Erzeuge mindestens 4 Cornell-Notizblöcke.
- Jeder Notizblock benötigt mindestens 4 cues.
- Die notes müssen detaillierte Pathophysiologie, Klinik und Diagnostik enthalten.
- Die summary muss mindestens 3 prägnante Merksätze enthalten.

CLINICAL CASCADES:
- Erzeuge mindestens 2 Clinical Cascades.
- Für jede behandelte Erkrankung muss eine eigene Cascade erzeugt werden.
- Jede Cascade enthält exakt 8 Elemente.
- Die Elemente müssen kausal und chronologisch geordnet sein.
- Verwende exakt die stage-Werte:
  01_Auslöser,
  02_Pathophysiologie,
  03_Zellulärer Mechanismus,
  04_Anatomische Konsequenz,
  05_Klinische Manifestation,
  06_Diagnostischer Befund,
  07_Therapeutische Intervention,
  08_Outcome.
- Jede Cascade benötigt disease, cascade und tutor_hint.

SYNAPSEN-MATRIX:
- Erzeuge mindestens 3 verschiedene Erkrankungen.
- Erzeuge für jede Erkrankung exakt 4 variables.
- Die 4 Typen müssen jeweils einmal vorkommen:
  Risiko/Pathologie,
  Symptom/Klinik,
  Diagnostik,
  Therapie/Management.
- Jede variable benötigt term, type und disease.
- Die disease-Werte müssen exakt einem Eintrag aus diseases entsprechen.
- Erzeuge insgesamt mindestens 12 variables.
- Jede Erkrankung muss genau 4 Variablen besitzen.

KATEGORISIERUNG:
- Erzeuge mindestens 8 items.
- Verwende ausschließlich diese Kategorien:
  Risiko/Pathologie,
  Symptom/Klinik,
  Diagnostik,
  Therapie/Management.
- Jedes item benötigt term und category.
- Jede Kategorie muss mindestens zweimal verwendet werden.
- Erzeuge categories und items, nicht body_mapping.

MASTER-QUIZ:
- Erzeuge 5 bis 8 anspruchsvolle Multiple-Choice-Fragen.
- Jede Frage benötigt genau 4 options.
- Jede Frage benötigt einen gültigen correct_index von 0 bis 3.
- Jede Frage benötigt explanation und tutor_hint.

ALLGEMEIN:
- Erzeuge kein Feld "body_mapping".
- Erzeuge keine Aufgabe zur Zuordnung einer Erkrankung zu einem Körperteil.
- Fülle alle Arrays mit vollständigen Inhalten.
- Verwende niemals leere Arrays für clinical_cascades, variables, items oder master_quiz.
- Verwende keine Platzhalter wie "STRING" in der tatsächlichen Antwort.
ROHTEXT:
${prompt}
`;

    try {
        const upstream = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: instruction
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 30000,
                    responseMimeType: 'application/json'
                }
            })
        });

        const upstreamText = await upstream.text();

        let upstreamJson = null;

        try {
            upstreamJson = upstreamText
                ? JSON.parse(upstreamText)
                : null;
        } catch (_error) {
            return sendJson(res, 502, {
                error: 'Gemini API returned a non-JSON response.',
                upstreamStatus: upstream.status,
                rawResponse: upstreamText.slice(0, 2000)
            });
        }

        if (!upstream.ok) {
            const upstreamMessage =
                upstreamJson?.error?.message ||
                upstreamJson?.message ||
                `Gemini API request failed with status ${upstream.status}.`;

            return sendJson(res, 502, {
                error: upstreamMessage,
                upstreamStatus: upstream.status
            });
        }

        const generatedText = upstreamJson?.candidates?.[0]?.content?.parts
            ?.map(part =>
                typeof part?.text === 'string'
                    ? part.text
                    : ''
            )
            .join('')
            .trim();

        if (!generatedText) {
            return sendJson(res, 502, {
                error: 'Gemini returned no usable content.',
                finishReason:
                    upstreamJson?.candidates?.[0]?.finishReason || null
            });
        }

        let generatedCase;

        try {
            generatedCase = extractJsonObject(generatedText);
        } catch (error) {
            return sendJson(res, 502, {
                error: 'Gemini returned invalid JSON.',
                details: error.message,
                finishReason:
                    upstreamJson?.candidates?.[0]?.finishReason || null,
                rawResponse: generatedText.slice(0, 4000)
            });
        }

        if (
            !generatedCase ||
            typeof generatedCase !== 'object' ||
            Array.isArray(generatedCase)
        ) {
            return sendJson(res, 502, {
                error: 'Gemini response is not a JSON object.'
            });
        }

        if (
            !generatedCase.case_id ||
            !generatedCase.metadata ||
            !Array.isArray(generatedCase.timeline)
        ) {
            return sendJson(res, 502, {
                error: 'Gemini JSON is missing required fields.'
            });
        }

        generatedCase.metadata.medical_field = medicalField;

        return sendJson(res, 200, {
            ok: true,
            model,
            generatedText: JSON.stringify(generatedCase),
            generatedCase
        });
    } catch (error) {
        console.error('Gemini API error:', error);

        return sendJson(res, 500, {
            error: 'Unexpected server error while contacting Gemini.',
            details: error?.message || 'Unknown error'
        });
    }
};
