const DEFAULT_MODEL = 'gemini-3.5-flash-lite'; 
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

// Universeller JSON-Extractor für Objekte { ... } und Arrays [ ... ]
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
    const mode = typeof parsedBody.mode === 'string' ? parsedBody.mode.trim() : 'case_forge';

    if (!prompt) {
        return sendJson(res, 400, { error: 'Missing "prompt" field.' });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
        return sendJson(res, 400, { error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} characters.` });
    }

    const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    const endpoint = `[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
        const upstream = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    responseMimeType: 'application/json'
                }
            })
        });

        const upstreamText = await upstream.text();
        let upstreamJson = null;

        try {
            upstreamJson = upstreamText ? JSON.parse(upstreamText) : null;
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

            return sendJson(res, 502, { error: upstreamMessage, upstreamStatus: upstream.status });
        }

        const generatedText = upstreamJson?.candidates?.[0]?.content?.parts
            ?.map(part => (typeof part?.text === 'string' ? part.text : ''))
            .join('')
            .trim();

        if (!generatedText) {
            return sendJson(res, 502, {
                error: 'Gemini returned no usable content.',
                finishReason: upstreamJson?.candidates?.[0]?.finishReason || null
            });
        }

        let parsedOutput;
        try {
            parsedOutput = extractJsonOutput(generatedText);
        } catch (error) {
            return res.status(502).json({
                error: 'Gemini returned invalid JSON format.',
                details: error.message,
                rawResponse: generatedText.slice(0, 4000)
            });
        }

        // ===================================================================
        // MODUS 1: DEPOT-QUIZ (Erwartet ein JSON-Array mit Fragen)
        // ===================================================================
        if (mode === 'depot_quiz') {
            if (!Array.isArray(parsedOutput)) {
                return sendJson(res, 502, { error: 'Gemini response for depot_quiz must be a JSON array.' });
            }
            return sendJson(res, 200, {
                ok: true,
                model,
                result: parsedOutput
            });
        }

        // ===================================================================
        // MODUS 2: FALL-SCHMIEDE / STANDARD (Erwartet ein Fall-Objekt)
        // ===================================================================
        if (!parsedOutput || typeof parsedOutput !== 'object' || Array.isArray(parsedOutput)) {
            return sendJson(res, 502, { error: 'Gemini response is not a JSON object.' });
        }

        if (!parsedOutput.case_id || !parsedOutput.metadata || !Array.isArray(parsedOutput.timeline)) {
            return sendJson(res, 502, { error: 'Gemini JSON is missing required case fields.' });
        }

        return sendJson(res, 200, {
            ok: true,
            model,
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
