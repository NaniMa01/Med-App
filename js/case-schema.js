(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MediCheckerCaseSchema = factory();
    }
})(typeof self !== 'undefined' ? self : this, function() {
    const CASE_ID_PATTERN = /^[A-Za-z0-9_-]{3,80}$/;

    function stripMarkdownCodeFence(input) {
        return String(input || '')
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '');
    }

    function normalizeCaseJsonInput(raw) {
        return stripMarkdownCodeFence(raw)
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'")
            .trim();
    }

    function parseCaseJson(raw) {
        const normalized = normalizeCaseJsonInput(raw);
        if (!normalized) {
            throw new Error('Leerer Inhalt.');
        }

        try {
            return JSON.parse(normalized);
        } catch (initialError) {
            const first = normalized.indexOf('{');
            const last = normalized.lastIndexOf('}');
            if (first >= 0 && last > first) {
                const sliced = normalized.slice(first, last + 1);
                try {
                    return JSON.parse(sliced);
                } catch (_) {
                    // Fallback below.
                }
            }
            throw new Error('Ungültiges JSON-Format.');
        }
    }

    function sanitizeCaseId(caseId) {
        return String(caseId || '').trim();
    }

    function validateHotspot(hotspot, index, errors, stepIndex) {
        if (!hotspot || typeof hotspot !== 'object' || Array.isArray(hotspot)) {
            errors.push(`hotspots[${stepIndex}][${index}] muss ein Objekt sein.`);
            return;
        }

        if (!String(hotspot.phrase || '').trim()) {
            errors.push(`hotspots[${stepIndex}][${index}].phrase fehlt.`);
        }

        if (hotspot.is_error !== undefined && typeof hotspot.is_error !== 'boolean') {
            errors.push(`hotspots[${stepIndex}][${index}].is_error muss boolesch sein.`);
        }
    }

    function normalizeCaseShape(candidate) {
        const parsed = JSON.parse(JSON.stringify(candidate));
        parsed.case_id = sanitizeCaseId(parsed.case_id);

        if (!parsed.metadata || typeof parsed.metadata !== 'object' || Array.isArray(parsed.metadata)) {
            parsed.metadata = {};
        }

        if (!parsed.case_overview || typeof parsed.case_overview !== 'object' || Array.isArray(parsed.case_overview)) {
            parsed.case_overview = {};
        }

        if (!parsed.extra_tasks || typeof parsed.extra_tasks !== 'object' || Array.isArray(parsed.extra_tasks)) {
            parsed.extra_tasks = {};
        }

        if (Array.isArray(parsed.timeline)) {
            parsed.timeline = parsed.timeline.map(step => ({
                ...step,
                phase: String(step?.phase || '').trim(),
                content: String(step?.content || '').trim(),
                hotspots: Array.isArray(step?.hotspots) ? step.hotspots : []
            }));
        }

        return parsed;
    }

    function validateMediCheckerCase(candidate) {
        const errors = [];

        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
            return {
                valid: false,
                errors: ['Bitte füge einen einzelnen Fall ein, kein JSON-Array.']
            };
        }

        const normalized = normalizeCaseShape(candidate);

        if (!normalized.case_id) {
            errors.push('Das Pflichtfeld "case_id" fehlt.');
        } else if (!CASE_ID_PATTERN.test(normalized.case_id)) {
            errors.push('"case_id" darf nur Buchstaben, Zahlen, Bindestrich und Unterstrich enthalten (3-80 Zeichen).');
        }

        if (!Array.isArray(normalized.timeline) || normalized.timeline.length === 0) {
            errors.push('Das Pflichtfeld "timeline" muss ein nicht-leeres Array sein.');
        } else {
            normalized.timeline.forEach((step, index) => {
                if (!step || typeof step !== 'object' || Array.isArray(step)) {
                    errors.push(`timeline[${index}] muss ein Objekt sein.`);
                    return;
                }

                if (!step.phase) {
                    errors.push(`timeline[${index}].phase fehlt.`);
                }

                if (!step.content) {
                    errors.push(`timeline[${index}].content fehlt.`);
                }

                if (!Array.isArray(step.hotspots)) {
                    errors.push(`timeline[${index}].hotspots muss ein Array sein.`);
                } else {
                    step.hotspots.forEach((hs, hsIdx) => validateHotspot(hs, hsIdx, errors, index));
                }
            });
        }

        if (typeof normalized.metadata !== 'object' || Array.isArray(normalized.metadata)) {
            errors.push('"metadata" muss ein Objekt sein.');
        }

        if (typeof normalized.case_overview !== 'object' || Array.isArray(normalized.case_overview)) {
            errors.push('"case_overview" muss ein Objekt sein.');
        }

        if (typeof normalized.extra_tasks !== 'object' || Array.isArray(normalized.extra_tasks)) {
            errors.push('"extra_tasks" muss ein Objekt sein.');
        }

        return {
            valid: errors.length === 0,
            errors,
            value: normalized
        };
    }

    return {
        CASE_ID_PATTERN,
        normalizeCaseJsonInput,
        parseCaseJson,
        sanitizeCaseId,
        validateMediCheckerCase
    };
});
