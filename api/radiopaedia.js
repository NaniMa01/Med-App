// ==========================================================================
// api/radiopaedia.js – Vercel Serverless Extractor für originale Radiopaedia-Serien
// Unterstützt /cases/<id>/studies/<id>, /studies/<id> und /cases/<slug>
// ==========================================================================

function decodeAllWebEncodings(raw) {
    return String(raw || '')
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x2F;|&#47;/gi, '/')
        .replace(/\\u002F/gi, '/')
        .replace(/\\\//g, '/');
}

function stripTags(html) {
    return decodeAllWebEncodings(String(html || '').replace(/<[^>]*>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeRadiopaediaImageUrl(rawUrl) {
    if (!rawUrl) return '';
    let clean = decodeAllWebEncodings(rawUrl).trim();
    if (clean.startsWith('//')) clean = 'https:' + clean;
    // Query-Parameter (?17123456) für saubere CDN-URL entfernen & auf _big_gallery hochstufen
    const [basePath] = clean.split('?');
    return basePath.replace(
        /_(tiny|thumb|teaser|small|medium|square|gallery)\.(jpe?g|png|webp)$/i,
        '_big_gallery.$2'
    );
}

// Extrahiert alle Schichten aus dekodiertem HTML oder JSON-Text in Originalreihenfolge
function extractSlicesFromDecodedText(rawText, fallbackLabel = 'Radiopaedia Aufnahme') {
    const text = decodeAllWebEncodings(rawText);
    const sliceMap = new Map(); // imageId -> { imageId, url }

    // 1. Strukturierte Bild-Objekte aus Radiopaedia JSON / data-props
    const structuredRegex = /"id"\s*:\s*(\d{5,12})[^{}]{0,400}?"(?:fullscreen_filename|public_filename|big_gallery|gallery_filename)"\s*:\s*"((?:https?:)?\/\/prod-images-static\.radiopaedia\.org\/images\/\d+\/[^"]+)"/gi;
    let m;
    while ((m = structuredRegex.exec(text)) !== null) {
        const imageId = m[1];
        const url = normalizeRadiopaediaImageUrl(m[2]);
        if (url && !sliceMap.has(imageId)) {
            sliceMap.set(imageId, { imageId, url });
        }
    }

    // 2. Alle direkten CDN-Bildpfade (inkl. //prod-images-static... und ?timestamp)
    const cdnRegex = /(?:https?:)?\/\/prod-images-static\.radiopaedia\.org\/images\/(\d{4,12})\/([a-zA-Z0-9._-]+?\.(?:jpe?g|png|webp))(?:\?[^"'\s<>)]*)?/gi;
    while ((m = cdnRegex.exec(text)) !== null) {
        const imageId = m[1];
        const url = normalizeRadiopaediaImageUrl(m[0]);
        if (url && !sliceMap.has(imageId)) {
            sliceMap.set(imageId, { imageId, url });
        }
    }

    const slices = Array.from(sliceMap.values());
    const total = slices.length;
    return slices.map((s, idx) => ({
        imageId: s.imageId,
        url: s.url,
        label: total > 1 ? `Schicht ${idx + 1} / ${total}` : fallbackLabel
    }));
}

// Extrahiert Serien direkt aus einem Radiopaedia JSON-Response (/studies/<id>.json)
function extractStudiesFromJsonPayload(jsonObj, fallbackTitle = 'Radiopaedia Studie', fallbackFindings = '') {
    if (!jsonObj || typeof jsonObj !== 'object') return [];
    const results = [];

    const studyNode = jsonObj.study || jsonObj;
    const modality = studyNode.modality || jsonObj.modality || 'Radiopaedia PACS';
    const caption = stripTags(studyNode.caption || jsonObj.caption || fallbackFindings);
    const baseTitle = stripTags(studyNode.title || jsonObj.title || fallbackTitle);

    // Fall A: Studie enthält mehrere Unterserien (z. B. Axial, Sagittal, Coronal)
    if (Array.isArray(studyNode.series) && studyNode.series.length > 0) {
        studyNode.series.forEach((ser, sIdx) => {
            const imgs = Array.isArray(ser.images) ? ser.images : [];
            const slices = imgs.map((img, iIdx) => {
                const rawFile = img.fullscreen_filename || img.public_filename || img.big_gallery || img.gallery_filename || img.url || '';
                const url = normalizeRadiopaediaImageUrl(rawFile);
                if (!url) return null;
                return {
                    imageId: String(img.id || `${sIdx}_${iIdx}`),
                    url,
                    label: `Schicht ${iIdx + 1} / ${imgs.length}`
                };
            }).filter(Boolean);

            if (slices.length > 0) {
                const plane = ser.plane_projection ? ` (${ser.plane_projection})` : '';
                results.push({
                    studyId: `${studyNode.id || 'st'}_ser_${ser.id || sIdx}`,
                    title: `${modality}${plane} · ${baseTitle}`,
                    modality: `${modality}${plane}`,
                    caption,
                    slices
                });
            }
        });
    }

    // Fall B: Bilder liegen direkt auf der Studie oder tief verschachtelt im JSON
    if (results.length === 0) {
        const slices = extractSlicesFromDecodedText(JSON.stringify(jsonObj), baseTitle);
        if (slices.length > 0) {
            results.push({
                studyId: String(studyNode.id || 'json_study'),
                title: `${modality} · ${baseTitle}`,
                modality,
                caption,
                slices
            });
        }
    }

    return results;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const rawUrl = (req.method === 'POST' ? req.body?.url : req.query?.url) || '';
    const cleanUrl = String(rawUrl).trim();

    if (!cleanUrl) {
        return res.status(400).json({ ok: false, error: 'Keine Radiopaedia-URL übergeben.' });
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(cleanUrl);
    } catch (_e) {
        return res.status(400).json({ ok: false, error: 'Ungültiges URL-Format.' });
    }

    if (!/(^|\.)radiopaedia\.org$/i.test(parsedUrl.hostname)) {
        return res.status(400).json({
            ok: false,
            error: 'Bitte gib einen gültigen Link von radiopaedia.org ein.'
        });
    }

    const commonHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://radiopaedia.org/'
    };

    try {
        // IDs aus URL extrahieren (z. B. /cases/180758/studies/144533)
        const studyMatch = parsedUrl.pathname.match(/\/studies\/(\d+)/i);
        const caseMatch = parsedUrl.pathname.match(/\/cases\/([^/?#]+)/i);
        const directStudyId = studyMatch ? studyMatch[1] : null;
        const caseSlugOrId = caseMatch ? caseMatch[1] : null;

        // 1. SCHRITT: Direkt den offiziellen Rails-.json-Endpunkt der Studie/des Falls testen
        const jsonCandidateUrls = [];
        if (directStudyId) {
            jsonCandidateUrls.push(`https://radiopaedia.org/studies/${directStudyId}.json?lang=us`);
            if (caseSlugOrId) {
                jsonCandidateUrls.push(`https://radiopaedia.org/cases/${caseSlugOrId}/studies/${directStudyId}.json?lang=us`);
            }
        }
        if (caseSlugOrId) {
            jsonCandidateUrls.push(`https://radiopaedia.org/cases/${caseSlugOrId}.json?lang=us`);
        }

        for (const jsonUrl of jsonCandidateUrls) {
            try {
                const jRes = await fetch(jsonUrl, {
                    headers: {
                        ...commonHeaders,
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                if (jRes.ok) {
                    const contentType = jRes.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const jsonData = await jRes.json();
                        const extracted = extractStudiesFromJsonPayload(jsonData);
                        if (extracted.length > 0) {
                            return res.status(200).json({
                                ok: true,
                                sourceUrl: parsedUrl.toString(),
                                caseTitle: extracted[0].title,
                                presentation: stripTags(jsonData.presentation || ''),
                                findings: extracted[0].caption || '',
                                studies: extracted
                            });
                        }
                    }
                }
            } catch (_jsonErr) {}
        }

        // 2. SCHRITT: HTML der Seite abrufen und vollständig dekodieren (&quot;, \u002F, etc.)
        const htmlRes = await fetch(parsedUrl.toString(), {
            headers: {
                ...commonHeaders,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            redirect: 'follow'
        });

        if (htmlRes.status === 403 || htmlRes.status === 429) {
            return res.status(403).json({
                ok: false,
                blocked: true,
                error: 'Radiopaedia schützt den Server-Abruf aktuell mit Cloudflare (HTTP 403). Nutze den Quelltext-Import darunter.'
            });
        }

        if (!htmlRes.ok) {
            return res.status(htmlRes.status).json({
                ok: false,
                error: `Radiopaedia antwortete mit HTTP ${htmlRes.status}.`
            });
        }

        const rawHtml = await htmlRes.text();
        const decodedHtml = decodeAllWebEncodings(rawHtml);

        const titleMatch = decodedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || decodedHtml.match(/<title>([\s\S]*?)<\/title>/i);
        const caseTitle = titleMatch
            ? stripTags(titleMatch[1]).replace(/\|\s*Radiology Case.*$/i, '').trim()
            : 'Radiopaedia Original-Serie';

        const findingsMatch = decodedHtml.match(/id="case-findings"[\s\S]*?<div[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const findings = findingsMatch ? stripTags(findingsMatch[1]) : '';

        // Alle Study-IDs im dekodierten HTML finden und deren .json laden
        const foundStudyIds = new Set(directStudyId ? [directStudyId] : []);
        const studyIdRegex = /(?:data-study-id=["']|\/studies\/|"study_id"\s*:\s*|"id"\s*:\s*)(\d{4,10})/gi;
        let sm;
        while ((sm = studyIdRegex.exec(decodedHtml)) !== null) {
            if (decodedHtml.includes(`/studies/${sm[1]}`) || decodedHtml.includes(`"study_id":${sm[1]}`)) {
                foundStudyIds.add(sm[1]);
            }
        }

        const studies = [];
        for (const sId of Array.from(foundStudyIds).slice(0, 6)) {
            try {
                const sJsonRes = await fetch(`https://radiopaedia.org/studies/${sId}.json?lang=us`, {
                    headers: {
                        ...commonHeaders,
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                if (sJsonRes.ok && (sJsonRes.headers.get('content-type') || '').includes('application/json')) {
                    const sJson = await sJsonRes.json();
                    const parsed = extractStudiesFromJsonPayload(sJson, caseTitle, findings);
                    studies.push(...parsed);
                }
            } catch (_e) {}
        }

        // Direkt aus dem dekodierten HTML extrahieren, falls .json blockiert war
        if (studies.length === 0) {
            const slices = extractSlicesFromDecodedText(decodedHtml, caseTitle);
            if (slices.length > 0) {
                studies.push({
                    studyId: directStudyId || 'html_series',
                    title: caseTitle,
                    modality: 'Radiopaedia PACS',
                    caption: findings,
                    slices
                });
            }
        }

        if (studies.length === 0) {
            return res.status(422).json({
                ok: false,
                blocked: true,
                error: 'Radiopaedia hat eine Cloudflare-Challenge ausgelöst. Bitte nutze den Quelltext-Workaround unten (Cmd+U → Cmd+A → Cmd+C).'
            });
        }

        return res.status(200).json({
            ok: true,
            sourceUrl: parsedUrl.toString(),
            caseTitle,
            findings,
            studies
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            error: `Serverfehler: ${err.message}`
        });
    }
};
