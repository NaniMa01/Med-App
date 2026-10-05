const test = require('node:test');
const assert = require('node:assert/strict');

const { processGenerateCaseRequest } = require('../api/generate-case.js');

const baseEnv = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-1.5-flash',
    MAX_SOURCE_TEXT_CHARS: '12000'
};

test('processGenerateCaseRequest blockiert falsche Methode', async () => {
    const result = await processGenerateCaseRequest({
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        env: baseEnv,
        fetchImpl: async () => ({ ok: true, json: async () => ({}) })
    });

    assert.equal(result.status, 405);
});

test('processGenerateCaseRequest liefert validierten Fall bei gültiger KI-Antwort', async () => {
    const fakeFetch = async () => ({
        ok: true,
        json: async () => ({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: '```json\n{"case_id":"fall-xyz","metadata":{},"case_overview":{},"extra_tasks":{},"timeline":[{"phase":"Anamnese","content":"Text","hotspots":[]}]}\n```'
                            }
                        ]
                    }
                }
            ]
        })
    });

    const result = await processGenerateCaseRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source_text: 'Anonymisierter Lerntext' }),
        env: baseEnv,
        fetchImpl: fakeFetch
    });

    assert.equal(result.status, 200);
    const payload = JSON.parse(result.body);
    assert.equal(payload.case.case_id, 'fall-xyz');
});

test('processGenerateCaseRequest meldet ungültigen KI-Fall als 422', async () => {
    const fakeFetch = async () => ({
        ok: true,
        json: async () => ({
            candidates: [
                {
                    content: {
                        parts: [{ text: '{"case_id":"bad","timeline":[]}' }]
                    }
                }
            ]
        })
    });

    const result = await processGenerateCaseRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source_text: 'Anonymisierter Lerntext' }),
        env: baseEnv,
        fetchImpl: fakeFetch
    });

    assert.equal(result.status, 422);
});
