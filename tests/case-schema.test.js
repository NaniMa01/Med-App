const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseCaseJson,
    validateMediCheckerCase
} = require('../js/case-schema.js');

test('parseCaseJson entfernt Markdown-Fences', () => {
    const parsed = parseCaseJson('```json\n{"case_id":"fall-001","timeline":[{"phase":"A","content":"B","hotspots":[]}],"metadata":{},"case_overview":{},"extra_tasks":{}}\n```');
    assert.equal(parsed.case_id, 'fall-001');
});

test('validateMediCheckerCase akzeptiert gültigen Minimalfall', () => {
    const result = validateMediCheckerCase({
        case_id: 'fall_001',
        metadata: {},
        case_overview: {},
        extra_tasks: {},
        timeline: [{ phase: 'Anamnese', content: 'Text', hotspots: [] }]
    });

    assert.equal(result.valid, true);
});

test('validateMediCheckerCase lehnt unsichere case_id ab', () => {
    const result = validateMediCheckerCase({
        case_id: "bad'case",
        metadata: {},
        case_overview: {},
        extra_tasks: {},
        timeline: [{ phase: 'A', content: 'B', hotspots: [] }]
    });

    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /case_id/);
});
