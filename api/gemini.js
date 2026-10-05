const DEFAULT_MODEL = 'gemini-2.0-flash';
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
    const instruction = `Erzeuge genau EINEN medizinischen Fall als reines JSON-Objekt ohne Markdown. Verwende dieses Schema:
{
  "case_id": "STRING",
  "metadata": { "title": "STRING", "medical_field": "STRING", "bloom_level": "STRING", "difficulty": NUMBER(1-5), "xp_reward": NUMBER },
  "timeline": [
    {
      "step_id": NUMBER,
      "phase": "STRING",
      "content": "STRING mit [markierten] Phrasen für Hotspots",
      "hotspots": [
        {
          "phrase": "STRING exakt wie in content",
          "is_error": BOOLEAN,
          "skill_tag": "Triage|Diagnostics|Pharmacology|Pathophysiology|Diagnostik|Pharmakologie|Pathophysiologie",
          "feedback": "STRING (bei is_error=false)",
          "socratic_trap": "STRING (bei is_error=true)",
          "correct_pathophysiology": "STRING (bei is_error=true)"
        }
      ]
    }
  ]
}
Wichtig: Gib ausschließlich gültiges JSON zurück, ohne zusätzliche Erklärungen. Thema/Prompt: ${prompt}`;

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
            return sendJson(res, 502, { error: 'Gemini returned no usable content.' });
        }

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
