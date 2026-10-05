const {
    parseCaseJson,
    validateMediCheckerCase
} = require('../js/case-schema.js');

const DEFAULT_MAX_SOURCE_TEXT_CHARS = Number(process.env.MAX_SOURCE_TEXT_CHARS || 12000);
const DEFAULT_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25000);

function withCorsHeaders(baseHeaders = {}, origin, allowedOrigin) {
    if (!allowedOrigin) return baseHeaders;
    if (origin && origin !== allowedOrigin) return baseHeaders;
    return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}

function jsonResponse(status, payload, headers = {}) {
    return {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...headers
        },
        body: JSON.stringify(payload)
    };
}

function safeErrorMessage(error) {
    if (!error) return 'Unbekannter Fehler.';
    if (error.name === 'AbortError') return 'Zeitüberschreitung bei der KI-Anfrage.';
    return 'Die KI-Anfrage ist fehlgeschlagen.';
}

function buildPrompt(sourceText) {
    return [
        'Erstelle aus dem folgenden anonymisierten medizinischen Lerntext einen MediChecker-Lernfall.',
        'Wichtige Regeln:',
        '- Liefere ausschließlich JSON ohne Markdown oder Erklärtext.',
        '- Keine realen Patientennamen, Adressen oder sonstige identifizierende Daten.',
        '- Das Ergebnis ist Lernmaterial, keine medizinische Beratung.',
        '- Benötigte Hauptfelder: case_id, metadata, timeline, case_overview, extra_tasks.',
        '- timeline muss mindestens ein Element mit phase, content und hotspots enthalten.',
        '',
        'Lerntext:',
        sourceText
    ].join('\n');
}

function buildGeminiSchema() {
    return {
        type: 'OBJECT',
        required: ['case_id', 'metadata', 'timeline', 'case_overview', 'extra_tasks'],
        properties: {
            case_id: { type: 'STRING' },
            metadata: {
                type: 'OBJECT',
                properties: {
                    title: { type: 'STRING' },
                    medical_field: { type: 'STRING' },
                    bloom_level: { type: 'STRING' },
                    xp_reward: { type: 'NUMBER' }
                }
            },
            timeline: {
                type: 'ARRAY',
                items: {
                    type: 'OBJECT',
                    required: ['phase', 'content', 'hotspots'],
                    properties: {
                        phase: { type: 'STRING' },
                        content: { type: 'STRING' },
                        hotspots: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    phrase: { type: 'STRING' },
                                    is_error: { type: 'BOOLEAN' },
                                    skill_tag: { type: 'STRING' },
                                    feedback: { type: 'STRING' },
                                    socratic_trap: { type: 'STRING' },
                                    correct_pathophysiology: { type: 'STRING' }
                                }
                            }
                        }
                    }
                }
            },
            case_overview: {
                type: 'OBJECT',
                properties: {
                    topic: { type: 'STRING' },
                    summary: { type: 'STRING' },
                    cornell_notes: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                cues: { type: 'ARRAY', items: { type: 'STRING' } },
                                notes: { type: 'STRING' }
                            }
                        }
                    }
                }
            },
            extra_tasks: { type: 'OBJECT' }
        }
    };
}

function parseRequestBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (_) {
            throw new Error('Ungültiger JSON-Body.');
        }
    }
    if (typeof body === 'object') return body;
    throw new Error('Ungültiger Request-Body.');
}

function extractGeminiText(responseJson) {
    const parts = responseJson?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) {
        throw new Error('Leere KI-Antwort.');
    }

    const text = parts
        .map(part => (typeof part?.text === 'string' ? part.text : ''))
        .join('\n')
        .trim();

    if (!text) {
        throw new Error('Leere KI-Antwort.');
    }

    return text;
}

async function callGemini({ sourceText, env, fetchImpl = fetch }) {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY fehlt.');
    }

    const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
    const baseUrl = env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
    const timeoutMs = Number(env.GEMINI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: buildPrompt(sourceText) }] }],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.9,
                    responseMimeType: 'application/json',
                    responseSchema: buildGeminiSchema()
                }
            })
        });

        const responseJson = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(responseJson?.error?.message || 'Gemini-API-Fehler.');
        }

        return extractGeminiText(responseJson);
    } finally {
        clearTimeout(timeout);
    }
}

async function processGenerateCaseRequest({ method, headers = {}, body, env = process.env, fetchImpl = fetch }) {
    const origin = headers.origin || headers.Origin;
    const allowedOrigin = env.ALLOWED_ORIGIN;
    const corsHeaders = withCorsHeaders({}, origin, allowedOrigin);

    if (method === 'OPTIONS') {
        return jsonResponse(204, {}, corsHeaders);
    }

    if (method !== 'POST') {
        return jsonResponse(405, { error: 'Nur POST ist erlaubt.' }, corsHeaders);
    }

    const contentType = String(headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        return jsonResponse(415, { error: 'Content-Type muss application/json sein.' }, corsHeaders);
    }

    let requestJson;
    try {
        requestJson = parseRequestBody(body);
    } catch (error) {
        return jsonResponse(400, { error: error.message }, corsHeaders);
    }

    const sourceText = String(requestJson?.source_text || '').trim();
    const maxLen = Number(env.MAX_SOURCE_TEXT_CHARS || DEFAULT_MAX_SOURCE_TEXT_CHARS);

    if (!sourceText) {
        return jsonResponse(400, { error: 'Bitte Lerntext eingeben.' }, corsHeaders);
    }

    if (sourceText.length > maxLen) {
        return jsonResponse(413, { error: `Text ist zu lang (max. ${maxLen} Zeichen).` }, corsHeaders);
    }

    try {
        const rawGemini = await callGemini({ sourceText, env, fetchImpl });
        const parsedCase = parseCaseJson(rawGemini);
        const validation = validateMediCheckerCase(parsedCase);

        if (!validation.valid) {
            return jsonResponse(422, {
                error: 'Generierter Fall ist ungültig.',
                details: validation.errors
            }, corsHeaders);
        }

        return jsonResponse(200, {
            case: validation.value,
            notice: 'Nur als Lernmaterial verwenden – keine medizinische Beratung.'
        }, corsHeaders);
    } catch (error) {
        const knownConfigError = error.message === 'GEMINI_API_KEY fehlt.';
        const status = knownConfigError ? 500 : 502;
        return jsonResponse(status, { error: safeErrorMessage(error) }, corsHeaders);
    }
}

async function vercelHandler(req, res) {
    const result = await processGenerateCaseRequest({
        method: req.method,
        headers: req.headers || {},
        body: req.body
    });

    Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    return res.status(result.status).send(result.body);
}

async function netlifyHandler(event) {
    const result = await processGenerateCaseRequest({
        method: event.httpMethod,
        headers: event.headers || {},
        body: event.body
    });

    return {
        statusCode: result.status,
        headers: result.headers,
        body: result.body
    };
}

module.exports = vercelHandler;
module.exports.handler = netlifyHandler;
module.exports.processGenerateCaseRequest = processGenerateCaseRequest;
module.exports.callGemini = callGemini;
