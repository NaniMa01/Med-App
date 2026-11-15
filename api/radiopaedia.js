// ==========================================================================
// api/radiopaedia.js – Vercel Serverless Extractor für originale Radiopaedia-Serien
// Extrahiert alle Studien & CT/MRT/Röntgen-Schichten in exakter Reihenfolge
// ==========================================================================

function decodeHtmlEntities(str) {
    return String(str || '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
}

function stripTags(html) {
    return decodeHtmlEntities(String(html || '').replace(/<[^>]*>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeRadiopaediaImageUrl(rawUrl) {
    if (!rawUrl) return '';
    let clean = String(rawUrl).replace(/\\\//g, '/').trim();
    if (clean.startsWith('//')) clean = 'https:' + clean;
    // Auf hochauflösende PACS-Ansicht (_big_gallery) normalisieren
    clean = clean.replace(/_(tiny|thumb|teaser|small|medium|square|gallery)\.(jpe?g|png|webp)$/i, '_big_gallery.$2');
    return clean;
}

function extractSlicesFromText(rawText, fallbackLabel = 'Radiopaedia Aufnahme') {
    const text = String(rawText || '').replace(/\\\//g, '/');
    const sliceMap = new Map(); // imageId -> sliceObj

    // 1. Strukturierte JSON-Metadaten (public_filename / fullscreen_filename / id) auslesen
    const jsonImgRegex = /"id"\s*:\s*(\d+)[^}]*?"(?:fullscreen_filename|public_filename|big_gallery)"\s*:\s*"(https?:\/\/prod-images-static\.radiopaedia\.org\/images\/\d+\/[^"]+)"/gi;
    let m;
    while ((m = jsonImgRegex.exec(text)) !== null) {
        const imageId = m[1];
        const url = normalizeRadiopaediaImageUrl(m[2]);
        if (!sliceMap.has(imageId)) {
            sliceMap.set(imageId, {
                imageId,
                url,
                label: `${fallbackLabel} · Schicht ${sliceMap.size + 1}`
            });
        }
    }

    // 2. Alle direkten CDN-URLs (prod-images-static.radiopaedia.org/images/<id>/<hash>...) erfassen
    const cdnRegex = /https?:\/\/prod-images-static\.radiopaedia\.org\/images\/(\d+)\/([a-zA-Z0-9._-]+?\.(?:jpe?g|png|webp))/gi;
    while ((m = cdnRegex.exec(text)) !== null) {
        const imageId = m[1];
        const fullMatch = m[0];
        // Reine Mini-Thumbnails nur aufnehmen, wenn wir sie auf _big_gallery hochstufen können
        const url = normalizeRadiopaediaImageUrl(fullMatch);
        if (!sliceMap.has(imageId)) {
            sliceMap.set(imageId, {
                imageId,
                url,
                label: `${fallbackLabel} · Schicht ${sliceMap.size + 1}`
            });
        }
    }

    const slices = Array.from(sliceMap.values());
    const total = slices.length;
    return slices.map((s, idx) => ({
        ...s,
        label: `Schicht ${idx + 1} / ${total}`
    }));
}

function parseStudyMetadata(html, studyId) {
    // Modalität erkennen (CT, MRI, X-ray, Ultrasound, etc.)
    const modMatch = html.match(/Modality[:\s]*<\/[^>]+>\s*<[^>]+>([^<]+)</i)
                  || html.match(/"modality"\s*:\s*"([^"]+)"/i)
                  || html.match(/\b(CT|MRI|X-ray|Ultrasound|Fluoroscopy|Angiography|Nuclear medicine)\b/i);
    const modality = modMatch ? stripTags(modMatch[1]) : 'Radiopaedia PACS';

    // Studien-Caption / Befund extrahieren
    const captionMatch = html.match(/<div[^>]*class="[^"]*study-caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                      || html.match(/"caption"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
    const caption = captionMatch ? stripTags(captionMatch[1].replace(/\\n/g, ' ')) : '';

    return {
        studyId: String(studyId),
        modality,
        caption
    };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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

    // Sicherheits-Check: Ausschließlich radiopaedia.org zulassen
    if (!/(^|\.)radiopaedia\.org$/i.test(parsedUrl.hostname)) {
        return res.status(400).json({
            ok: false,
            error: 'Bitte gib einen gültigen Link von radiopaedia.org ein (z. B. https://radiopaedia.org/cases/...).'
        });
    }

    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        'Referer': 'https://radiopaedia.org/'
    };

    try {
        const response = await fetch(parsedUrl.toString(), {
            headers: browserHeaders,
            redirect: 'follow'
        });

        if (response.status === 403 || response.status === 429) {
            return res.status(403).json({
                ok: false,
                blocked: true,
                error: 'Radiopaedia hat die automatische Server-Abfrage vorübergehend durch Cloudflare geschützt (HTTP 403).'
            });
        }

        if (!response.ok) {
            return res.status(response.status).json({
                ok: false,
                error: `Radiopaedia antwortete mit Status ${response.status}.`
            });
        }

        const html = await response.text();

        // 1. Fall-Titel & Klinische Präsentation / Befund extrahieren
        const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
        const caseTitle = titleMatch
            ? stripTags(titleMatch[1]).replace(/\|\s*Radiology Case.*$/i, '').trim()
            : 'Radiopaedia Fall';

        const presMatch = html.match(/id="case-patient-presentation"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
        const presentation = presMatch ? stripTags(presMatch[1]) : '';

        const findingsMatch = html.match(/id="case-findings"[\s\S]*?<div[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                           || html.match(/Findings<\/h[234]>([\s\S]*?)<\/div>/i);
        const findings = findingsMatch ? stripTags(findingsMatch[1]) : '';

        // 2. Alle Study-IDs der Seite ermitteln (damit jede Serie einzeln geladen wird!)
        const studyIdSet = new Set();
        const directStudyMatch = parsedUrl.pathname.match(/\/studies\/(\d+)/i);
        if (directStudyMatch) studyIdSet.add(directStudyMatch[1]);

        const studyRegex = /(?:data-study-id=["']|\/studies\/|"study_id"\s*:\s*)(\d{4,10})/gi;
        let sMatch;
        while ((sMatch = studyRegex.exec(html)) !== null) {
            studyIdSet.add(sMatch[1]);
        }

        const studies = [];
        const studyIds = Array.from(studyIdSet).slice(0, 6);

        if (studyIds.length > 0) {
            // Lade die Einzel-Studien parallel, um den kompletten Schichtstapel (alle CT/MRT-Slices) zu erhalten
            const studyResults = await Promise.all(studyIds.map(async (sId, idx) => {
                try {
                    const studyUrl = `https://radiopaedia.org/studies/${sId}`;
                    const sRes = await fetch(studyUrl, { headers: browserHeaders });
                    const sHtml = sRes.ok ? await sRes.text() : html;
                    const meta = parseStudyMetadata(sHtml, sId);
                    const slices = extractSlicesFromText(sHtml, `${meta.modality} Serie ${idx + 1}`);
                    if (slices.length === 0) return null;

                    return {
                        studyId: sId,
                        title: `${meta.modality} · ${caseTitle}`,
                        modality: meta.modality,
                        caption: meta.caption || findings,
                        slices
                    };
                } catch (_err) {
                    return null;
                }
            }));

            studyResults.filter(Boolean).forEach(st => studies.push(st));
        }

        // Fallback: Falls keine separaten Study-IDs gefunden wurden, direkt aus dem Haupt-HTML extrahieren
        if (studies.length === 0) {
            const slices = extractSlicesFromText(html, caseTitle);
            if (slices.length > 0) {
                const meta = parseStudyMetadata(html, 'main');
                studies.push({
                    studyId: 'main',
                    title: caseTitle,
                    modality: meta.modality,
                    caption: meta.caption || findings,
                    slices
                });
            }
        }

        if (studies.length === 0) {
            return res.status(422).json({
                ok: false,
                blocked: true,
                error: 'Keine eingebetteten Schichtbilder im HTML gefunden (evtl. dynamisch nachgeladen).'
            });
        }

        return res.status(200).json({
            ok: true,
            sourceUrl: parsedUrl.toString(),
            caseTitle,
            presentation,
            findings,
            studies
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            error: `Serverfehler beim Abrufen von Radiopaedia: ${err.message}`
        });
    }
};
