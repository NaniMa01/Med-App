/**
 * MedCheck – Synchronized Cornell Notes Engine V2.1 (js/cornell.js)
 * Features:
 * - Zusammenhängender klinischer Fließtext rechts, gegliedert nach Themen & Differenzialdiagnosen
 * - Exakte 1:1 vertikale Höhen- & Baseline-Synchronisation mit den Titeln in der linken Spalte
 * - Multi-Format-Parser: V6-HTML, Legacy-<br><br>, <ul>-Listen & Plain-Text-Cues (inkl. ▼-Deep-Dive-Recovery)
 * - 100 % Safari-/iOS-kompatibel (keine Lookbehind-Regexes)
 * - Live-Suchfilter mit DOM-Highlight ohne Input-Rebuild, Quick-Jump, Active-Recall-Drill & 1-Klick Lern-Depot
 */

const CornellNotesModule = (() => {
    let isRecallHideMode = false;
    let filterQuery = '';
    let lastRenderedCaseId = null;
    let revealedRowsSet = new Set(); // Trackt individuell aufgedeckte Zeilen im Active-Recall-Modus

    const STOPWORDS = new Set([
        'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen',
        'und', 'oder', 'aber', 'sowie', 'auch', 'bei', 'mit', 'von', 'vom', 'zur', 'zum',
        'auf', 'aus', 'für', 'über', 'unter', 'durch', 'nach', 'vor', 'als', 'wie', 'sind',
        'ist', 'wird', 'werden', 'kann', 'können', 'muss', 'müssen', 'soll', 'sollte', 'nicht',
        'kein', 'keine', 'sehr', 'mehr', 'weniger', 'bzw', 'etc', 'z.b', 'essenziell'
    ]);

    function escapeSafe(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function escapeRegExp(str) {
        return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = String(html || '');
        return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
    }

    // Entfernt gefährliche Tags, behält aber alle redaktionellen MedCheck-Elemente
    function sanitizeEditorialHtml(rawHtml) {
        return String(rawHtml || '')
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
    }

    // Robuster Case-Resolver (kompatibel mit window.activeCaseData und globalem `let activeCaseData`)
    function getActiveCase() {
        if (window.activeCaseData && typeof window.activeCaseData === 'object') {
            return window.activeCaseData;
        }
        try {
            if (typeof activeCaseData !== 'undefined' && activeCaseData && typeof activeCaseData === 'object') {
                return activeCaseData;
            }
        } catch (_e) {}
        return window.currentCase || window.activeCase || null;
    }

    /**
     * Erzeugt normalisierte Wortstämme (inkl. Bindestrich-Auflösung),
     * damit z.B. "Komaähnliche Zustände" sicher auf "Koma-ähnlichen Zuständen" matcht.
     */
    function extractStemTokens(str) {
        return stripHtml(str)
            .toLowerCase()
            .replace(/^(wann|wer|was|wie|warum|wo|cave|merke|klinik-perle|therapie|diagnostik|klinik|ätiologie|pathophysiologie)\s*[:?!]\s*/i, '')
            .replace(/[-–—/()[\].,:;!?„“"']/g, ' ')
            .split(/\s+/)
            .map(w => w.trim())
            .filter(w => w.length >= 3 && !STOPWORDS.has(w))
            .map(w => (w.length > 7 ? w.slice(0, 7) : w));
    }

    // Sicherer Fallback für aufklappbare Deep-Dive-Exkurse
    if (typeof window.toggleDeepDive !== 'function') {
        window.toggleDeepDive = function(btnElement) {
            const card = btnElement?.closest?.('.sm-deep-dive-card');
            if (card) card.classList.toggle('is-open');
        };
    }

    function injectStyles() {
        if (document.getElementById('mc-cornell-sync-css')) return;
        const style = document.createElement('style');
        style.id = 'mc-cornell-sync-css';
        style.textContent = `
            /* Schutz vor EditorialScrollEngine: Cornell-Zeilen dürfen nie auf opacity: 0 hängen bleiben */
            #overview-container .cornell-sync-row,
            #overview-container .cornell-sync-row.scroll-reveal-item {
                opacity: 1 !important;
                transform: none !important;
                visibility: visible !important;
            }

            .cornell-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                padding: 12px 18px;
                background: var(--surface-secondary, rgba(15, 23, 42, 0.55));
                border-bottom: 1px solid var(--card-border, rgba(148, 163, 184, 0.18));
            }
            .cornell-toc-pills {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
                flex: 1;
            }
            .cornell-toc-pill {
                font-size: 0.72rem;
                font-weight: 700;
                padding: 3px 9px;
                border-radius: 999px;
                background: rgba(56, 189, 248, 0.1);
                border: 1px solid rgba(56, 189, 248, 0.28);
                color: var(--accent-cyan, #38bdf8);
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .cornell-toc-pill:hover {
                background: rgba(56, 189, 248, 0.22);
                transform: translateY(-1px);
            }
            html[data-theme="daylight"] .cornell-toc-pill,
            html[data-theme="tropical"] .cornell-toc-pill {
                color: #0369a1;
                background: rgba(2, 132, 199, 0.1);
                border-color: rgba(2, 132, 199, 0.3);
            }

            .cornell-search-box {
                position: relative;
                min-width: 210px;
                max-width: 270px;
            }
            .cornell-search-input {
                width: 100%;
                padding: 5px 28px 5px 10px;
                border-radius: 8px;
                border: 1px solid var(--card-border, rgba(148, 163, 184, 0.25));
                background: var(--surface-primary, rgba(6, 9, 19, 0.6));
                color: var(--text-main, #f8fafc);
                font-size: 0.76rem;
            }
            .cornell-search-input:focus {
                outline: none;
                border-color: var(--accent-cyan, #38bdf8);
            }
            .cornell-search-clear {
                position: absolute;
                right: 6px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: var(--text-muted, #94a3b8);
                cursor: pointer;
                font-size: 0.75rem;
                padding: 2px 4px;
                display: none;
            }
            .cornell-search-clear.visible {
                display: block;
            }

            .cornell-recall-status-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 8px;
                padding: 8px 18px;
                background: rgba(56, 189, 248, 0.08);
                border-bottom: 1px solid rgba(56, 189, 248, 0.2);
                font-size: 0.76rem;
                color: var(--text-main, #f8fafc);
            }

            /* 1:1 SYNCHRONISIERTE ZEILE */
            .cornell-sync-sheet {
                display: flex;
                flex-direction: column;
            }
            .cornell-sync-row {
                display: grid;
                grid-template-columns: minmax(210px, 28%) 1fr;
                align-items: start;
                border-bottom: 1px solid var(--divider-color, rgba(148, 163, 184, 0.14));
                transition: background-color 0.18s ease;
                position: relative;
            }
            .cornell-sync-row:last-child {
                border-bottom: none;
            }
            .cornell-sync-row.is-row-hovered,
            .cornell-sync-row.is-row-pinned {
                background: rgba(56, 189, 248, 0.06);
            }
            html[data-theme="daylight"] .cornell-sync-row.is-row-hovered,
            html[data-theme="daylight"] .cornell-sync-row.is-row-pinned,
            html[data-theme="tropical"] .cornell-sync-row.is-row-hovered,
            html[data-theme="tropical"] .cornell-sync-row.is-row-pinned {
                background: rgba(2, 132, 199, 0.06);
            }

            /* Linke Titel-Spalte */
            .cornell-sync-cue-col {
                padding: 18px 16px 18px 20px;
                border-right: 2px solid rgba(239, 68, 68, 0.35);
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                gap: 6px;
            }
            .cornell-sync-cue-item {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin-top: -3px;
                padding: 5px 10px;
                border-radius: 9px;
                background: rgba(15, 23, 42, 0.45);
                border: 1px solid rgba(148, 163, 184, 0.18);
                color: var(--text-main, #f8fafc);
                font-size: 0.83rem;
                font-weight: 700;
                line-height: 1.45;
                cursor: pointer;
                transition: all 0.16s ease;
                user-select: none;
            }
            html[data-theme="daylight"] .cornell-sync-cue-item,
            html[data-theme="tropical"] .cornell-sync-cue-item {
                background: var(--surface-secondary, #f8fafc);
                border-color: var(--card-border, #cbd5e1);
                color: #0f172a;
            }
            .cornell-sync-row.is-row-hovered .cornell-sync-cue-item,
            .cornell-sync-row.is-row-pinned .cornell-sync-cue-item,
            .cornell-sync-cue-item:focus {
                border-color: var(--accent-cyan, #38bdf8);
                background: rgba(56, 189, 248, 0.16);
                color: var(--accent-cyan, #38bdf8);
                transform: translateX(3px);
                outline: none;
            }
            html[data-theme="daylight"] .cornell-sync-row.is-row-hovered .cornell-sync-cue-item,
            html[data-theme="daylight"] .cornell-sync-row.is-row-pinned .cornell-sync-cue-item,
            html[data-theme="tropical"] .cornell-sync-row.is-row-hovered .cornell-sync-cue-item,
            html[data-theme="tropical"] .cornell-sync-row.is-row-pinned .cornell-sync-cue-item {
                background: rgba(2, 132, 199, 0.14);
                border-color: #0284c7;
                color: #0369a1;
            }
            .cornell-sync-cue-num {
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.68rem;
                font-weight: 800;
                padding: 1px 6px;
                border-radius: 5px;
                background: rgba(56, 189, 248, 0.15);
                color: var(--accent-cyan, #38bdf8);
                flex-shrink: 0;
                margin-top: 2px;
            }
            html[data-theme="daylight"] .cornell-sync-cue-num,
            html[data-theme="tropical"] .cornell-sync-cue-num {
                color: #0369a1;
                background: rgba(2, 132, 199, 0.14);
            }

            /* Rechte Fließtext-Spalte */
            .cornell-sync-note-col {
                padding: 18px 86px 18px 24px;
                font-size: 0.94rem;
                line-height: 1.72;
                color: var(--text-main, #f1f5f9);
                border-left: 3px solid transparent;
                transition: border-color 0.18s ease, background-color 0.18s ease;
                position: relative;
            }
            .cornell-prose-flow {
                max-width: 82ch;
                text-align: left;
            }
            .cornell-prose-flow > p {
                margin: 0 0 10px 0;
            }
            .cornell-prose-flow > p:last-child {
                margin-bottom: 0;
            }
            .cornell-sync-row.is-row-hovered .cornell-sync-note-col,
            .cornell-sync-row.is-row-pinned .cornell-sync-note-col {
                border-left-color: var(--accent-cyan, #38bdf8);
                background: rgba(56, 189, 248, 0.04);
            }

            /* Depot-Button ohne Textüberlappung */
            .cornell-row-depot-btn {
                position: absolute;
                top: 14px;
                right: 12px;
                opacity: 0;
                pointer-events: none;
                font-size: 0.69rem;
                padding: 3px 8px;
                border-radius: 7px;
                transition: opacity 0.15s ease;
                z-index: 2;
            }
            .cornell-sync-row:hover .cornell-row-depot-btn,
            .cornell-sync-row.is-row-pinned .cornell-row-depot-btn,
            .cornell-sync-row.is-row-revealed .cornell-row-depot-btn {
                opacity: 0.92;
                pointer-events: auto;
            }

            /* Echter Active-Recall-Modus: Nur per Klick aufdecken (kein versehentlicher Hover-Spoiler!) */
            .cornell-recall-active .cornell-sync-row:not(.is-row-revealed) .cornell-prose-flow {
                filter: blur(7px);
                opacity: 0.28;
                cursor: pointer;
                user-select: none;
                transition: filter 0.2s ease, opacity 0.2s ease;
            }
            .cornell-recall-active .cornell-sync-row.is-row-revealed .cornell-prose-flow {
                filter: none;
                opacity: 1;
                user-select: text;
                transition: filter 0.2s ease, opacity 0.2s ease;
            }
            .cornell-recall-reveal-hint {
                display: none;
            }
            .cornell-recall-active .cornell-sync-row:not(.is-row-revealed) .cornell-recall-reveal-hint {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 6px 13px;
                border-radius: 999px;
                background: var(--surface-primary, rgba(15, 23, 42, 0.92));
                border: 1px solid var(--accent-cyan, #38bdf8);
                color: var(--accent-cyan, #38bdf8);
                font-size: 0.74rem;
                font-weight: 700;
                cursor: pointer;
                z-index: 3;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
            }

            /* Such-Markierung */
            .cornell-search-mark {
                background: rgba(250, 204, 21, 0.32);
                color: inherit;
                border-radius: 3px;
                padding: 0 2px;
            }

            /* Inline-Popover für med-term-highlight (Touch & Desktop) */
            .cornell-term-popover {
                position: fixed;
                z-index: 9999;
                max-width: 310px;
                padding: 9px 12px;
                border-radius: 10px;
                background: var(--surface-elevated, #0f172a);
                border: 1px solid var(--accent-cyan, #38bdf8);
                color: var(--text-main, #f8fafc);
                font-size: 0.78rem;
                line-height: 1.45;
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
                pointer-events: auto;
            }

            @media (max-width: 720px) {
                .cornell-sync-row {
                    grid-template-columns: 1fr;
                }
                .cornell-sync-cue-col {
                    border-right: none;
                    border-bottom: 1px dashed var(--card-border, rgba(148, 163, 184, 0.2));
                    padding: 12px 14px 8px 14px;
                }
                .cornell-sync-note-col {
                    padding: 12px 14px 36px 14px;
                }
                .cornell-row-depot-btn {
                    top: auto;
                    bottom: 8px;
                    right: 12px;
                    opacity: 0.78;
                    pointer-events: auto;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Extrahiert die führende Überschrift aus einem HTML- oder Plain-Text-Absatz
     * (z.B. "<b>Locked-in-Syndrom:</b> Text..." oder "Epidemiologie: Text...")
     */
    function extractLeadingHeading(blockHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = blockHtml;
        const container = tmp.querySelector('p, li, h3, h4, div') || tmp;
        const firstElem = container.firstElementChild;

        if (firstElem && (firstElem.tagName === 'B' || firstElem.tagName === 'STRONG')) {
            const rawHeading = firstElem.textContent.replace(/[:–—-]+$/, '').trim();
            if (rawHeading.length >= 2 && rawHeading.length <= 80) {
                return rawHeading;
            }
        }

        // Plain-Text-Fallback: "Überschrift: Fließtext..."
        const plain = stripHtml(blockHtml);
        const colonIdx = plain.indexOf(':');
        if (colonIdx >= 3 && colonIdx <= 75) {
            const candidate = plain.slice(0, colonIdx).trim();
            if (candidate && !/[.!?]/.test(candidate)) {
                return candidate;
            }
        }
        return '';
    }

    function deriveFallbackTitleFromBlock(block) {
        if (block.leadingHeading) return block.leadingHeading;

        const tmp = document.createElement('div');
        tmp.innerHTML = block.html;
        const firstBold = tmp.querySelector('b, strong, .med-term-highlight');
        if (firstBold) {
            const txt = firstBold.textContent.replace(/[:–—-]+$/, '').trim();
            if (txt.length >= 3 && txt.length <= 60) return txt;
        }

        const words = block.plainText.split(/\s+/).slice(0, 4).join(' ').replace(/[,:;.-]+$/, '');
        return words ? `${words}…` : 'Klinischer Abschnitt';
    }

    /**
     * Rekonstruiert aus Plain-Text-Resten eines gestrippten Deep-Dives ("...Ende.Titel▼Exkurs...")
     * wieder eine funktionale, aufklappbare SpringerMedizin-Deep-Dive-Card.
     */
    function extractStrippedDeepDiveFromPlainText(rawText) {
        const arrowIdx = rawText.indexOf('▼');
        if (arrowIdx === -1 || /sm-deep-dive-card/i.test(rawText)) {
            return { mainText: rawText, deepDiveHtml: '' };
        }

        const beforeArrow = rawText.slice(0, arrowIdx);
        const afterArrow = rawText.slice(arrowIdx + 1).trim();
        if (!afterArrow) return { mainText: rawText, deepDiveHtml: '' };

        // Letztes Satzende vor dem Deep-Dive-Titel finden
        const titleMatch = beforeArrow.match(/([\s\S]*?[.!?])\s*([A-ZÄÖÜ][^.!?\n]{3,120})$/);
        if (!titleMatch) {
            return { mainText: rawText, deepDiveHtml: '' };
        }

        const mainText = titleMatch[1].trim();
        const ddTitle = titleMatch[2].trim();
        const deepDiveHtml = `
            <div class="sm-deep-dive-card">
                <button type="button" class="sm-deep-dive-trigger" onclick="toggleDeepDive(this)">
                    <span>${escapeSafe(ddTitle)}</span>
                    <span class="sm-deep-dive-chevron">▼</span>
                </button>
                <div class="sm-deep-dive-grid-wrapper">
                    <div class="sm-deep-dive-inner">
                        <div class="sm-deep-dive-content">${escapeSafe(afterArrow)}</div>
                    </div>
                </div>
            </div>
        `.trim();

        return { mainText, deepDiveHtml };
    }

    /**
     * Formatiert Plain-Text-Absätze mit führender "Überschrift:" sowie inline "Merke:/Cave:/Klinik-Perle:"
     * sauber in lesbares HTML.
     */
    function formatPlainProseChunkToHtml(chunkText) {
        const clean = String(chunkText || '').trim();
        if (!clean) return '';

        // Falls bereits HTML-Tags enthalten sind, unverändert in <p> belassen
        if (/<[a-z][\s\S]*>/i.test(clean)) {
            return /^<p\b/i.test(clean) ? clean : `<p>${clean}</p>`;
        }

        // Inline-Callouts ("Merke:", "Cave:", "Klinik-Perle:") als eigene Absätze absetzen
        const parts = clean
            .replace(/([.!?])\s*(?=(?:Merke|Cave|Klinik-Perle)\s*:)/gi, '$1\u0000')
            .split('\u0000')
            .map(p => p.trim())
            .filter(Boolean);

        return parts.map(part => {
            const escaped = escapeSafe(part);
            const colonIdx = part.indexOf(':');
            if (colonIdx >= 3 && colonIdx <= 75 && !/[.!?]/.test(part.slice(0, colonIdx))) {
                const head = escapeSafe(part.slice(0, colonIdx + 1));
                const rest = escapeSafe(part.slice(colonIdx + 1));
                return `<p><b>${head}</b>${rest}</p>`;
            }
            return `<p>${escaped}</p>`;
        }).join('');
    }

    /**
     * Teilt einen einzelnen Plain-Text-Block anhand der definierten Cues ("Cue:") auf –
     * selbst dann, wenn im JSON kein Leerzeichen nach dem Satzpunkt steht.
     */
    function splitPlainBlockByCues(plainText, cuesList) {
        if (!plainText || !Array.isArray(cuesList) || cuesList.length < 2) return null;

        const splitPoints = [];
        cuesList.forEach(cue => {
            const cleanCue = stripHtml(cue).trim();
            if (cleanCue.length < 3) return;
            const regex = new RegExp(escapeRegExp(cleanCue) + '\\s*:', 'gi');
            const match = regex.exec(plainText);
            if (match) {
                splitPoints.push(match.index);
            }
        });

        const uniqueSorted = Array.from(new Set(splitPoints)).sort((a, b) => a - b);
        if (uniqueSorted.length < 2) return null;

        const chunks = [];
        if (uniqueSorted[0] > 0) {
            const preamble = plainText.slice(0, uniqueSorted[0]).trim();
            if (preamble) chunks.push(preamble);
        }
        for (let i = 0; i < uniqueSorted.length; i++) {
            const start = uniqueSorted[i];
            const end = i + 1 < uniqueSorted.length ? uniqueSorted[i + 1] : plainText.length;
            const slice = plainText.slice(start, end).trim();
            if (slice) chunks.push(slice);
        }

        return chunks.length > 1 ? chunks : null;
    }

    /**
     * Führt verwaiste reine Überschriften-Blöcke (z.B. "<p><strong>Vaskuläre Myelopathien:</strong></p>")
     * mit dem nachfolgenden Fließtext-Absatz zusammen.
     */
    function mergeOrphanHeadingBlocks(blocks) {
        if (!Array.isArray(blocks) || blocks.length < 2) return blocks;

        const merged = [];
        for (let i = 0; i < blocks.length; i++) {
            const curr = blocks[i];
            const next = blocks[i + 1];
            const isStandaloneHeading = next
                && curr.plainText.length <= 75
                && /:$/.test(curr.plainText)
                && !/[.!?]/.test(curr.plainText);

            if (isStandaloneHeading) {
                const combinedHtml = `${curr.html}${next.html}`;
                merged.push({
                    html: combinedHtml,
                    plainText: `${curr.plainText} ${next.plainText}`.trim(),
                    leadingHeading: curr.leadingHeading || curr.plainText.replace(/:$/, '').trim()
                });
                i++; // nächsten Block als bereits verschmolzen überspringen
            } else {
                merged.push(curr);
            }
        }
        return merged;
    }

    /**
     * Wandelt HTML- oder Plain-Text-Inhalte in saubere, thematisch gegliederte Fließtext-Blöcke um.
     */
    function parseNoteIntoProseBlocks(rawNotesHtml, cuesList = []) {
        let html = sanitizeEditorialHtml(rawNotesHtml).trim();
        if (!html) return [];

        const hasHtmlTags = /<[a-z][\s\S]*>/i.test(html);

        // FALL A: Reiner Plain-Text (wie bei HTML-gestrippten JSONs)
        if (!hasHtmlTags) {
            const { mainText, deepDiveHtml } = extractStrippedDeepDiveFromPlainText(html);
            const cueChunks = splitPlainBlockByCues(mainText, cuesList);

            let plainBlocks;
            if (cueChunks) {
                plainBlocks = cueChunks.map(chunk => {
                    const formatted = formatPlainProseChunkToHtml(chunk);
                    return {
                        html: formatted,
                        plainText: stripHtml(formatted),
                        leadingHeading: extractLeadingHeading(formatted)
                    };
                });
            } else {
                const paraParts = mainText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
                plainBlocks = paraParts.map(part => {
                    const formatted = formatPlainProseChunkToHtml(part);
                    return {
                        html: formatted,
                        plainText: stripHtml(formatted),
                        leadingHeading: extractLeadingHeading(formatted)
                    };
                });
            }

            if (deepDiveHtml && plainBlocks.length > 0) {
                plainBlocks[plainBlocks.length - 1].html += deepDiveHtml;
            }
            return plainBlocks;
        }

        // FALL B: HTML-Inhalte (inkl. Legacy <br><br> Trenner)
        const hasBlockTags = /<(p|ul|ol|div|h[1-6]|blockquote)\b/i.test(html);
        if (!hasBlockTags && /<br\s*\/?>/i.test(html)) {
            const parts = html.split(/(?:<br\s*\/?>\s*){2,}/i).map(s => s.trim()).filter(Boolean);
            html = parts.map(p => `<p>${p}</p>`).join('');
        } else if (!hasBlockTags) {
            html = `<p>${html}</p>`;
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        const blocks = [];
        const normalizedCuesLower = cuesList.map(c => stripHtml(c).toLowerCase());

        Array.from(wrapper.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const txt = node.textContent.trim();
                if (txt) {
                    const formatted = formatPlainProseChunkToHtml(txt);
                    blocks.push({
                        html: formatted,
                        plainText: txt,
                        leadingHeading: extractLeadingHeading(formatted)
                    });
                }
                return;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.tagName.toUpperCase();

            // Deep-Dive-Exkurse an den vorherigen Fließtext-Block anhängen
            if (node.classList?.contains('sm-deep-dive-card')) {
                if (blocks.length > 0) {
                    blocks[blocks.length - 1].html += node.outerHTML;
                } else {
                    blocks.push({
                        html: node.outerHTML,
                        plainText: stripHtml(node.outerHTML),
                        leadingHeading: 'Pathophysiologischer Exkurs'
                    });
                }
                return;
            }

            // Listen (<ul> / <ol>) intelligent in Fließtext (<p>) überführen
            if (tag === 'UL' || tag === 'OL') {
                const listItems = Array.from(node.children).filter(li => li.tagName === 'LI');
                if (listItems.length === 0) return;

                const itemInfos = listItems.map(li => {
                    const inner = li.innerHTML.trim();
                    const heading = extractLeadingHeading(li.outerHTML);
                    const matchesSeparateCue = heading && normalizedCuesLower.some(
                        c => c === heading.toLowerCase() || c.includes(heading.toLowerCase()) || heading.toLowerCase().includes(c)
                    );
                    return { inner, heading, matchesSeparateCue, plain: stripHtml(inner) };
                });

                const distinctTopicsCount = itemInfos.filter(i => i.heading || i.matchesSeparateCue).length;

                if (distinctTopicsCount >= 2 || (cuesList.length > 1 && listItems.length > 1)) {
                    itemInfos.forEach(item => {
                        let proseContent = item.inner;
                        if (!/[.!?]$/.test(stripHtml(proseContent))) {
                            proseContent += '.';
                        }
                        blocks.push({
                            html: `<p>${proseContent}</p>`,
                            plainText: stripHtml(proseContent),
                            leadingHeading: item.heading
                        });
                    });
                } else {
                    const mergedProse = itemInfos
                        .map(item => {
                            let s = item.inner.trim();
                            if (!/[.!?]$/.test(stripHtml(s))) s += '.';
                            return s;
                        })
                        .join(' ');

                    blocks.push({
                        html: `<p>${mergedProse}</p>`,
                        plainText: stripHtml(mergedProse),
                        leadingHeading: itemInfos[0]?.heading || ''
                    });
                }
                return;
            }

            // Standard-Absätze (<p>, <h3>, <h4>, <blockquote>, <div>)
            const plain = stripHtml(node.innerHTML);
            if (plain) {
                const innerClean = tag === 'P' ? node.outerHTML : `<p>${node.innerHTML}</p>`;
                blocks.push({
                    html: innerClean,
                    plainText: plain,
                    leadingHeading: extractLeadingHeading(innerClean)
                });
            }
        });

        // Falls ein gesamter HTML-Block nur aus 1 langen Absatz besteht, aber mehrere Cues definiert wurden:
        // Safari-sicher (OHNE Lookbehind) an Fett-Überschriften aufteilen
        if (blocks.length === 1 && cuesList.length > 1) {
            const innerMatch = blocks[0].html.match(/^<p[^>]*>([\s\S]*)<\/p>$/i);
            if (innerMatch && innerMatch[1]) {
                const chunks = innerMatch[1]
                    .replace(/([.!?])\s*(?=(?:<b\b[^>]*>|<strong\b[^>]*>)[A-ZÄÖÜ])/g, '$1\u0000')
                    .split('\u0000')
                    .map(s => s.trim())
                    .filter(Boolean);

                if (chunks.length > 1) {
                    return mergeOrphanHeadingBlocks(chunks.map(chunk => ({
                        html: `<p>${chunk}</p>`,
                        plainText: stripHtml(chunk),
                        leadingHeading: extractLeadingHeading(`<p>${chunk}</p>`)
                    })));
                }
            }
        }

        return mergeOrphanHeadingBlocks(blocks);
    }

    /**
     * Verknüpft die linken Titel (Cues) semantisch 1:1 mit den rechten Fließtext-Absätzen.
     */
    function buildAlignedPairsForEntry(noteEntry) {
        const rawCues = Array.isArray(noteEntry.cues)
            ? noteEntry.cues.map(c => stripHtml(c)).filter(Boolean)
            : (noteEntry.cues ? [stripHtml(noteEntry.cues)] : []);

        const blocks = parseNoteIntoProseBlocks(noteEntry.notes, rawCues);
        if (blocks.length === 0) {
            return rawCues.map(c => ({ cue: c, html: '', plainText: '' }));
        }

        const candidateScores = [];
        rawCues.forEach((cue, cIdx) => {
            const cueLower = cue.toLowerCase();
            const cueStems = extractStemTokens(cue);

            blocks.forEach((block, bIdx) => {
                let score = 0;
                const headingLower = (block.leadingHeading || '').toLowerCase();
                const textLower = block.plainText.toLowerCase();
                const blockStems = new Set(extractStemTokens(block.plainText));
                const headingStems = new Set(extractStemTokens(block.leadingHeading));

                if (headingLower && (headingLower === cueLower || headingLower.includes(cueLower) || cueLower.includes(headingLower))) {
                    score += 140;
                }
                if (cueLower.length >= 4 && textLower.includes(cueLower)) {
                    score += 65;
                }
                cueStems.forEach(stem => {
                    if (headingStems.has(stem)) score += 32;
                    else if (blockStems.has(stem)) score += 18;
                });

                if (cIdx === bIdx) {
                    score += 16;
                } else if (Math.abs(cIdx - bIdx) === 1) {
                    score += 4;
                }

                candidateScores.push({ cIdx, bIdx, score });
            });
        });

        candidateScores.sort((a, b) => b.score - a.score);
        const assignedCueForBlock = new Array(blocks.length).fill(null);
        const usedCues = new Set();

        candidateScores.forEach(({ cIdx, bIdx, score }) => {
            if (usedCues.has(cIdx)) return;
            if (assignedCueForBlock[bIdx] !== null) return;
            if (score <= 0) return;

            assignedCueForBlock[bIdx] = rawCues[cIdx];
            usedCues.add(cIdx);
        });

        rawCues.forEach((cue, cIdx) => {
            if (usedCues.has(cIdx)) return;
            const freeBlockIdx = assignedCueForBlock.findIndex(val => val === null);
            if (freeBlockIdx !== -1) {
                assignedCueForBlock[freeBlockIdx] = cue;
                usedCues.add(cIdx);
            }
        });

        const pairs = blocks.map((block, bIdx) => ({
            cue: assignedCueForBlock[bIdx] || deriveFallbackTitleFromBlock(block),
            html: block.html,
            plainText: block.plainText
        }));

        const remainingCues = rawCues.filter((_, idx) => !usedCues.has(idx));
        if (remainingCues.length > 0 && pairs.length > 0) {
            pairs[pairs.length - 1].extraCues = remainingCues;
        }

        return pairs;
    }

    // Sicherer DOM-Highlighter: markiert Suchbegriffe nur in TextNodes ohne HTML-Tags zu beschädigen
    function highlightSearchInElement(rootEl, query) {
        const cleanQuery = (query || '').trim();
        if (!rootEl || cleanQuery.length < 2) return;

        const regex = new RegExp(`(${escapeRegExp(cleanQuery)})`, 'gi');
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            if (!node.nodeValue || !node.nodeValue.trim()) continue;
            const parentTag = node.parentElement?.tagName;
            if (parentTag === 'BUTTON' || parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'MARK') continue;
            if (regex.test(node.nodeValue)) {
                textNodes.push(node);
            }
            regex.lastIndex = 0;
        }

        textNodes.forEach(textNode => {
            const frag = document.createDocumentFragment();
            const parts = textNode.nodeValue.split(regex);
            parts.forEach((part, idx) => {
                if (idx % 2 === 1) {
                    const mark = document.createElement('mark');
                    mark.className = 'cornell-search-mark';
                    mark.textContent = part;
                    frag.appendChild(mark);
                } else if (part) {
                    frag.appendChild(document.createTextNode(part));
                }
            });
            textNode.parentNode?.replaceChild(frag, textNode);
        });
    }

    // Interaktives Glossar-Popover für <span class="med-term-highlight" data-med-info="...">
    function closeMedTermPopover() {
        document.getElementById('mc-cornell-term-popover')?.remove();
    }

    function openMedTermPopover(termEl) {
        closeMedTermPopover();
        const info = termEl?.getAttribute('data-med-info');
        if (!info) return;

        const pop = document.createElement('div');
        pop.id = 'mc-cornell-term-popover';
        pop.className = 'cornell-term-popover';
        pop.innerHTML = `<strong style="color:var(--accent-cyan,#38bdf8); display:block; margin-bottom:2px;">${escapeSafe(termEl.textContent)}</strong><span>${escapeSafe(info)}</span>`;
        document.body.appendChild(pop);

        const rect = termEl.getBoundingClientRect();
        const popRect = pop.getBoundingClientRect();
        const top = rect.top > popRect.height + 16 ? rect.top - popRect.height - 8 : rect.bottom + 8;
        const left = Math.min(window.innerWidth - popRect.width - 12, Math.max(12, rect.left));
        pop.style.top = `${Math.max(12, top)}px`;
        pop.style.left = `${left}px`;
    }

    function computeAllPairs(data) {
        const allPairs = [];
        if (Array.isArray(data?.cornell_notes)) {
            data.cornell_notes.forEach(entry => {
                allPairs.push(...buildAlignedPairsForEntry(entry));
            });
        }
        return allPairs;
    }

    // Aktualisiert NUR Toolbar, Recall-Leiste & Zeilen – lässt das Suchfeld unberührt im DOM!
    function renderSheetContent(container, allPairs, caseObj) {
        const tocHost = container.querySelector('#cornell-toc-host');
        const recallBarHost = container.querySelector('#cornell-recall-bar-host');
        const sheetHost = container.querySelector('#cornell-sync-sheet');
        const rootEl = container.querySelector('#cornell-sheet-root');
        const clearBtn = container.querySelector('#cornell-search-clear-btn');
        if (!sheetHost || !rootEl) return;

        rootEl.classList.toggle('cornell-recall-active', isRecallHideMode);
        if (clearBtn) clearBtn.classList.toggle('visible', filterQuery.trim().length > 0);

        const qLower = filterQuery.trim().toLowerCase();
        const visibleEntries = allPairs
            .map((pair, origIdx) => ({ pair, origIdx }))
            .filter(({ pair }) => {
                if (!qLower) return true;
                const extraMatch = Array.isArray(pair.extraCues) && pair.extraCues.some(ec => ec.toLowerCase().includes(qLower));
                return pair.cue.toLowerCase().includes(qLower)
                    || pair.plainText.toLowerCase().includes(qLower)
                    || extraMatch;
            });

        // 1. Recall-Fortschrittsleiste
        if (recallBarHost) {
            if (isRecallHideMode && visibleEntries.length > 0) {
                const revealedVisibleCount = visibleEntries.filter(e => revealedRowsSet.has(e.origIdx)).length;
                const allRevealed = revealedVisibleCount === visibleEntries.length;
                recallBarHost.innerHTML = `
                    <div class="cornell-recall-status-bar">
                        <span>🧠 <strong>Active-Recall aktiv:</strong> Überlege zuerst anhand des linken Stichworts, dann klicke auf die Zeile zum Abgleich (<strong>${revealedVisibleCount}/${visibleEntries.length}</strong> aufgedeckt).</span>
                        <button type="button" class="ghost-tool-btn" id="btn-cornell-reveal-all" style="font-size:0.72rem; padding:3px 9px;">
                            ${allRevealed ? '🙈 Alle wieder abdecken' : '👁️ Alle aufdecken'}
                        </button>
                    </div>
                `;
            } else {
                recallBarHost.innerHTML = '';
            }
        }

        // 2. TOC Quick-Jump-Pills
        if (tocHost) {
            if (visibleEntries.length > 1) {
                tocHost.innerHTML = `
                    <div class="cornell-toolbar">
                        <div class="cornell-toc-pills">
                            ${visibleEntries.map(({ pair }, idx) => `
                                <button type="button"
                                        class="cornell-toc-pill"
                                        data-jump-row="cornell-row-${idx}"
                                        title="Direkt zu „${escapeSafe(pair.cue)}“ springen">
                                    ${idx + 1}. ${escapeSafe(pair.cue)}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                tocHost.innerHTML = '';
            }
        }

        // 3. Synchronisierte Cornell-Zeilen
        if (visibleEntries.length === 0) {
            sheetHost.innerHTML = `
                <div style="padding:24px; text-align:center; color:var(--text-muted);">
                    Keine passenden Abschnitte für „${escapeSafe(filterQuery)}“ gefunden.
                </div>
            `;
            return;
        }

        sheetHost.innerHTML = visibleEntries.map(({ pair, origIdx }, rowIdx) => {
            const rowId = `cornell-row-${rowIdx}`;
            const targetId = `cornell-note-target-${rowIdx}`;
            const isRevealed = revealedRowsSet.has(origIdx);

            const extraCuesHtml = Array.isArray(pair.extraCues)
                ? pair.extraCues.map(ec => `
                    <div class="cornell-sync-cue-item cornell-cue-item" tabindex="0" role="button" data-row="${rowId}" data-target="${targetId}">
                        <span class="cornell-cue-bullet"></span>
                        <span class="cornell-cue-label">${escapeSafe(ec)}</span>
                    </div>
                `).join('')
                : '';

            return `
                <div class="cornell-grid cornell-sync-row is-in-view ${isRevealed ? 'is-row-revealed' : ''}"
                     id="${rowId}"
                     data-row-idx="${rowIdx}"
                     data-orig-idx="${origIdx}">
                    <div class="cornell-sync-cue-col">
                        <div class="cornell-sync-cue-item cornell-cue-item"
                             tabindex="0"
                             role="button"
                             data-row="${rowId}"
                             data-target="${targetId}">
                            <span class="cornell-sync-cue-num">${rowIdx + 1}</span>
                            <span class="cornell-cue-label">${escapeSafe(pair.cue)}</span>
                        </div>
                        ${extraCuesHtml}
                    </div>
                    <div class="cornell-sync-note-col cornell-notes" id="${targetId}" data-row="${rowId}">
                        <button type="button"
                                class="ghost-tool-btn cornell-row-depot-btn"
                                data-save-row-idx="${rowIdx}"
                                title="Diesen Abschnitt ins Lern-Depot speichern">
                            📌 Depot
                        </button>
                        <button type="button" class="cornell-recall-reveal-hint" data-reveal-row="${origIdx}">
                            👁️ Lösung aufdecken
                        </button>
                        <div class="cornell-prose-flow">
                            ${pair.html}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Suchtreffer im Text hervorheben
        if (qLower.length >= 2) {
            highlightSearchInElement(sheetHost, filterQuery);
        }

        bindSheetInteractions(container, allPairs, visibleEntries, caseObj);
    }

    function bindSheetInteractions(container, allPairs, visibleEntries, caseObj) {
        const rows = Array.from(container.querySelectorAll('.cornell-sync-row'));

        const toggleRowRecall = (row, origIdx) => {
            if (!isRecallHideMode) return;
            if (revealedRowsSet.has(origIdx)) {
                revealedRowsSet.delete(origIdx);
                row.classList.remove('is-row-revealed');
            } else {
                revealedRowsSet.add(origIdx);
                row.classList.add('is-row-revealed');
            }
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(7);

            // Zähler in der Recall-Leiste aktualisieren ohne komplettes Re-Render
            const bar = container.querySelector('.cornell-recall-status-bar');
            if (bar) {
                const revealedVisibleCount = visibleEntries.filter(e => revealedRowsSet.has(e.origIdx)).length;
                const strongs = bar.querySelectorAll('strong');
                if (strongs.length >= 2) {
                    strongs[1].textContent = `${revealedVisibleCount}/${visibleEntries.length}`;
                }
                const allBtn = bar.querySelector('#btn-cornell-reveal-all');
                if (allBtn) {
                    allBtn.textContent = revealedVisibleCount === visibleEntries.length
                        ? '🙈 Alle wieder abdecken'
                        : '👁️ Alle aufdecken';
                }
            }
        };

        rows.forEach((row, idx) => {
            const origIdx = Number(row.getAttribute('data-orig-idx'));
            const cueItems = Array.from(row.querySelectorAll('.cornell-sync-cue-item'));
            const noteCol = row.querySelector('.cornell-sync-note-col');
            const revealBtn = row.querySelector('.cornell-recall-reveal-hint');

            row.addEventListener('mouseenter', () => {
                row.classList.add('is-row-hovered');
            });

            row.addEventListener('mouseleave', () => {
                row.classList.remove('is-row-hovered');
            });

            // Alle Cues (inkl. extraCues) interaktiv machen
            cueItems.forEach(cueItem => {
                cueItem.addEventListener('click', () => {
                    if (isRecallHideMode) {
                        toggleRowRecall(row, origIdx);
                        return;
                    }
                    const wasPinned = row.classList.contains('is-row-pinned');
                    rows.forEach(r => r.classList.remove('is-row-pinned'));
                    if (!wasPinned) {
                        row.classList.add('is-row-pinned');
                        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(7);
                    }
                });

                cueItem.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        cueItem.click();
                    } else if (e.key === 'ArrowDown' && rows[idx + 1]) {
                        e.preventDefault();
                        rows[idx + 1].querySelector('.cornell-sync-cue-item')?.focus();
                        rows[idx + 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else if (e.key === 'ArrowUp' && rows[idx - 1]) {
                        e.preventDefault();
                        rows[idx - 1].querySelector('.cornell-sync-cue-item')?.focus();
                        rows[idx - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
            });

            // Klick auf verschwommenen Text oder "Lösung aufdecken"-Pill im Active-Recall-Modus
            if (revealBtn) {
                revealBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleRowRecall(row, origIdx);
                });
            }
            if (noteCol) {
                noteCol.addEventListener('click', (e) => {
                    if (!isRecallHideMode) return;
                    if (e.target.closest('button, a, .sm-deep-dive-card, .med-term-highlight')) return;
                    if (!revealedRowsSet.has(origIdx)) {
                        toggleRowRecall(row, origIdx);
                    }
                });
            }
        });

        // "Alle aufdecken / Alle abdecken" im Active-Recall-Modus
        const revealAllBtn = container.querySelector('#btn-cornell-reveal-all');
        if (revealAllBtn) {
            revealAllBtn.addEventListener('click', () => {
                const allRevealed = visibleEntries.every(e => revealedRowsSet.has(e.origIdx));
                if (allRevealed) {
                    visibleEntries.forEach(e => revealedRowsSet.delete(e.origIdx));
                } else {
                    visibleEntries.forEach(e => revealedRowsSet.add(e.origIdx));
                }
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
                renderSheetContent(container, allPairs, caseObj);
            });
        }

        // Quick-Jump-Pills
        container.querySelectorAll('.cornell-toc-pill[data-jump-row]').forEach(pill => {
            pill.addEventListener('click', () => {
                const targetRow = document.getElementById(pill.getAttribute('data-jump-row'));
                if (!targetRow) return;
                rows.forEach(r => r.classList.remove('is-row-pinned'));
                targetRow.classList.add('is-row-pinned');
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
            });
        });

        // 1-Klick Lern-Depot-Export pro Zeile
        container.querySelectorAll('.cornell-row-depot-btn[data-save-row-idx]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const entry = visibleEntries[Number(btn.getAttribute('data-save-row-idx'))];
                const saveFn = window.createDepotEntry || (typeof createDepotEntry === 'function' ? createDepotEntry : null);
                if (!entry || !saveFn) return;

                await saveFn({
                    case_id: caseObj?.case_id || 'cornell_note',
                    case_title: caseObj?.metadata?.title || caseObj?.case_id || 'Cornell Note',
                    category: caseObj?.folder_name || caseObj?.metadata?.medical_field || 'Allgemein',
                    cue_context: entry.pair.cue,
                    highlighted_text: entry.pair.plainText
                });
                btn.textContent = '✓ Gespeichert';
                btn.disabled = true;
            });
        });

        // Touch- & Tastatur-Popover für interaktive Fachbegriffe (.med-term-highlight)
        container.querySelectorAll('.med-term-highlight[data-med-info]').forEach(termEl => {
            termEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openMedTermPopover(termEl);
            });
            termEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openMedTermPopover(termEl);
                }
            });
        });
    }

    // Einmaliger Dokument-Listener zum Schließen des Fachbegriff-Popovers
    if (!window._mcCornellPopoverCloseBound) {
        window._mcCornellPopoverCloseBound = true;
        document.addEventListener('click', (e) => {
            if (!e.target.closest?.('.cornell-term-popover') && !e.target.closest?.('.med-term-highlight')) {
                closeMedTermPopover();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMedTermPopover();
        });
    }

    function render() {
        const container = document.getElementById('overview-container');
        if (!container) return;

        injectStyles();
        closeMedTermPopover();

        const caseObj = getActiveCase();
        const data = caseObj?.case_overview;
        if (!data) {
            container.innerHTML = '<div class="feedback-box feedback-neutral" style="display:block;">Für diesen Fall ist keine detaillierte Übersicht verfügbar.</div>';
            return;
        }

        // Bei Fallwechsel Suchfilter & Recall-Aufdeckstatus sauber zurücksetzen
        const currentCaseId = caseObj.case_id || caseObj.id || '__unknown__';
        if (lastRenderedCaseId !== currentCaseId) {
            lastRenderedCaseId = currentCaseId;
            filterQuery = '';
            revealedRowsSet = new Set();
        }

        const allPairs = computeAllPairs(data);

        const topicTitle = window.isSpecialtyBlindMode
            ? 'Klinisches Krankheitsbild (Blind-Training)'
            : (data.topic || 'Thematische Übersicht');

        container.innerHTML = `
            <div class="cornell-wrapper ${isRecallHideMode ? 'cornell-recall-active' : ''}" id="cornell-sheet-root">
                <div class="cornell-header">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <h2>${escapeSafe(topicTitle)}</h2>
                            <div class="cornell-header-subtitle">
                                Vollständige Cornell-Note · ${allPairs.length} Themenabschnitte (1:1 Fließtext-Synchronisation)
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <div class="cornell-search-box">
                                <input type="text"
                                       id="cornell-live-search-input"
                                       class="cornell-search-input"
                                       value="${escapeSafe(filterQuery)}"
                                       placeholder="🔍 In Übersicht suchen..."
                                       autocomplete="off">
                                <button type="button"
                                        id="cornell-search-clear-btn"
                                        class="cornell-search-clear ${filterQuery ? 'visible' : ''}"
                                        title="Suche leeren">✕</button>
                            </div>
                            <button type="button"
                                    class="ghost-tool-btn"
                                    id="btn-toggle-cornell-recall"
                                    style="font-size:0.76rem; padding:6px 12px;"
                                    title="Blendet den Fließtext rechts aus, damit du dich anhand der linken Titel selbst abfragen kannst">
                                ${isRecallHideMode ? '👁️ Text einblenden' : '🧠 Active-Recall (Text abdecken)'}
                            </button>
                        </div>
                    </div>
                </div>

                <div id="cornell-recall-bar-host"></div>
                <div id="cornell-toc-host"></div>
                <div class="cornell-body cornell-sync-sheet" id="cornell-sync-sheet"></div>

                <div class="cornell-summary">
                    <div class="cornell-summary-badge">Take-Home Message (Synthese)</div>
                    <p>${escapeSafe(data.summary || 'Keine Zusammenfassung hinterlegt.')}</p>
                </div>
            </div>
        `;

        // Header-Events einmalig binden (überleben alle Live-Such-Updates)
        const searchInput = container.querySelector('#cornell-live-search-input');
        const clearBtn = container.querySelector('#cornell-search-clear-btn');
        const recallBtn = container.querySelector('#btn-toggle-cornell-recall');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterQuery = e.target.value;
                renderSheetContent(container, allPairs, caseObj);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && filterQuery) {
                    e.stopPropagation();
                    filterQuery = '';
                    searchInput.value = '';
                    renderSheetContent(container, allPairs, caseObj);
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                filterQuery = '';
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }
                renderSheetContent(container, allPairs, caseObj);
            });
        }

        if (recallBtn) {
            recallBtn.addEventListener('click', () => {
                isRecallHideMode = !isRecallHideMode;
                if (isRecallHideMode) {
                    revealedRowsSet = new Set();
                }
                recallBtn.textContent = isRecallHideMode
                    ? '👁️ Text einblenden'
                    : '🧠 Active-Recall (Text abdecken)';
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
                renderSheetContent(container, allPairs, caseObj);
            });
        }

        renderSheetContent(container, allPairs, caseObj);
    }

    function resetState() {
        filterQuery = '';
        revealedRowsSet = new Set();
    }

    return { render, resetState };
})();

window.CornellNotesModule = CornellNotesModule;
window.renderOverview = CornellNotesModule.render;
