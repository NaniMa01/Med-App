/**
 * MedCheck – Synchronized Cornell Notes Engine V2.0 (js/cornell.js)
 * Features:
 * - Zusammenhängender klinischer Fließtext rechts, gegliedert nach Themen & Differenzialdiagnosen
 * - Exakte 1:1 vertikale Höhen- & Baseline-Synchronisation mit den Titeln in der linken Spalte
 * - Deutsches Wortstamm- & Hyphen-Matching (keine verwaisten "Fortsetzung"-Zeilen mehr)
 * - Automatische Konvertierung bestehender Bullet-Listen in lesbaren Fließtext
 * - Live-Suchfilter, Quick-Jump-Navigation, Active-Recall-Modus & 1-Klick Lern-Depot-Export
 */

const CornellNotesModule = (() => {
    let isRecallHideMode = false;
    let filterQuery = '';

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

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = String(html || '');
        return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
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

    function injectStyles() {
        if (document.getElementById('mc-cornell-sync-css')) return;
        const style = document.createElement('style');
        style.id = 'mc-cornell-sync-css';
        style.textContent = `
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
                padding: 5px 10px;
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

            /* 1:1 SYNCHRONISIERTE ZEILE (LINKER TITEL = EXAKT GLEICHE HÖHE WIE FLIESSTEXT RECHTS) */
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

            /* Linke Titel-Spalte (exakt auf Baseline des ersten Satzes rechts ausgerichtet) */
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
                padding: 18px 24px;
                font-size: 0.94rem;
                line-height: 1.72;
                color: var(--text-main, #f1f5f9);
                border-left: 3px solid transparent;
                transition: border-color 0.18s ease, background-color 0.18s ease, filter 0.2s ease;
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

            /* Dezenter Depot-Export-Button pro Absatz bei Hover */
            .cornell-row-depot-btn {
                position: absolute;
                top: 14px;
                right: 14px;
                opacity: 0;
                pointer-events: none;
                font-size: 0.7rem;
                padding: 3px 8px;
                border-radius: 7px;
                transition: opacity 0.15s ease;
            }
            .cornell-sync-row:hover .cornell-row-depot-btn,
            .cornell-sync-row.is-row-pinned .cornell-row-depot-btn {
                opacity: 0.9;
                pointer-events: auto;
            }

            /* Active-Recall-Modus: Rechter Fließtext verschwommen bis zum Klick/Hover */
            .cornell-recall-active .cornell-sync-note-col .cornell-prose-flow {
                filter: blur(6px);
                opacity: 0.32;
                cursor: pointer;
                user-select: none;
                transition: filter 0.2s ease, opacity 0.2s ease;
            }
            .cornell-recall-active .cornell-sync-row.is-row-pinned .cornell-sync-note-col .cornell-prose-flow,
            .cornell-recall-active .cornell-sync-row:hover .cornell-sync-note-col .cornell-prose-flow {
                filter: none;
                opacity: 1;
                user-select: text;
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
                    padding: 12px 14px 16px 14px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Extrahiert die führende Überschrift aus einem HTML-Absatz (z.B. "<b>Locked-in-Syndrom:</b> Text..." -> "Locked-in-Syndrom")
     */
    function extractLeadingHeading(blockHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = blockHtml;
        const container = tmp.querySelector('p, li, h3, h4, div') || tmp;
        const firstElem = container.firstElementChild;

        if (firstElem && (firstElem.tagName === 'B' || firstElem.tagName === 'STRONG')) {
            const rawHeading = firstElem.textContent.replace(/[:–—-]+$/, '').trim();
            if (rawHeading.length >= 2 && rawHeading.length <= 75) {
                return rawHeading;
            }
        }
        return '';
    }

    /**
     * Erzeugt einen sinnvollen Fallback-Titel aus den ersten Schlüsselbegriffen eines Absatzes,
     * falls ein Absatz keinen eigenen Cue im JSON hatte.
     */
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
     * Wandelt HTML-Inhalte (auch bestehende <ul><li>-Listen) in sauberen, zusammenhängenden
     * Fließtext (<p>) um und trennt nur dort in neue Blöcke, wo ein neues Thema oder eine
     * neue Differenzialdiagnose beginnt.
     */
    function parseNoteIntoProseBlocks(rawNotesHtml, cuesList = []) {
        let html = String(rawNotesHtml || '').trim();
        if (!html) return [];

        // Legacy <br><br> Trenner in <p> umwandeln
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
        const normalizedCuesLower = cuesList.map(c => c.toLowerCase());

        Array.from(wrapper.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const txt = node.textContent.trim();
                if (txt) {
                    blocks.push({
                        html: `<p>${escapeSafe(txt)}</p>`,
                        plainText: txt,
                        leadingHeading: ''
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

            // Listen (<ul> / <ol>) intelligent in Fließtext (<p>) überführen:
            if (tag === 'UL' || tag === 'OL') {
                const listItems = Array.from(node.children).filter(li => li.tagName === 'LI');
                if (listItems.length === 0) return;

                // Prüfen, ob die einzelnen <li> eigene Unterthemen / Differenzialdiagnosen sind
                // (z.B. "<li><b>Locked-in-Syndrom:</b> ...</li>") oder ob alle zusammen EIN Thema bilden
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
                    // Jede Differenzialdiagnose / jedes Unterthema wird ein eigener Fließtext-Absatz (<p>)
                    // (ohne Bullet-Punkte "•", damit es als echter Fließtext erscheint!)
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
                    // Alle Listenpunkte gehören zum SELBE Thema -> Zu einem einzigen zusammenhängenden Fließtext-Absatz verbinden!
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

        // Falls ein gesamter Block nur aus 1 langen Absatz besteht, aber mehrere Cues definiert wurden,
        // an thematischen Satzgrenzen vor Fett-Überschriften in Absätze teilen
        if (blocks.length === 1 && cuesList.length > 1) {
            const innerMatch = blocks[0].html.match(/^<p[^>]*>([\s\S]*)<\/p>$/i);
            if (innerMatch && innerMatch[1]) {
                const chunks = innerMatch[1]
                    .split(/(?<=[.!?])\s+(?=(?:<b>|<strong>)[A-ZÄÖÜ])/g)
                    .map(s => s.trim())
                    .filter(Boolean);

                if (chunks.length > 1) {
                    return chunks.map(chunk => ({
                        html: `<p>${chunk}</p>`,
                        plainText: stripHtml(chunk),
                        leadingHeading: extractLeadingHeading(`<p>${chunk}</p>`)
                    }));
                }
            }
        }

        return blocks;
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

        // Bewertungs-Matrix zwischen jedem Cue und jedem Fließtext-Absatz
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

                // 1. Direkter Abgleich mit der fettgedruckten Überschrift des Absatzes
                if (headingLower && (headingLower === cueLower || headingLower.includes(cueLower) || cueLower.includes(headingLower))) {
                    score += 140;
                }

                // 2. Exakter Phrasen-Match im Fließtext
                if (cueLower.length >= 4 && textLower.includes(cueLower)) {
                    score += 65;
                }

                // 3. Wortstamm-Überlappung (fängt Flexionen & Bindestriche wie "Komaähnliche" vs "Koma-ähnlichen" auf!)
                cueStems.forEach(stem => {
                    if (headingStems.has(stem)) score += 32;
                    else if (blockStems.has(stem)) score += 18;
                });

                // 4. Sanfter Positions-Tiebreaker (falls Reihenfolge im JSON bereits 1:1 stimmt)
                if (cIdx === bIdx) {
                    score += 16;
                } else if (Math.abs(cIdx - bIdx) === 1) {
                    score += 4;
                }

                candidateScores.push({ cIdx, bIdx, score });
            });
        });

        // Eindeutige 1:1-Zuordnung nach höchstem semantischem Score
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

        // Falls ein Cue noch frei ist, auf den nächsten unbesetzten Absatz legen
        rawCues.forEach((cue, cIdx) => {
            if (usedCues.has(cIdx)) return;
            const freeBlockIdx = assignedCueForBlock.findIndex(val => val === null);
            if (freeBlockIdx !== -1) {
                assignedCueForBlock[freeBlockIdx] = cue;
                usedCues.add(cIdx);
            }
        });

        // Alle Fließtext-Absätze vollständig ausgeben – jeder mit seinem exakten linken Titel!
        const pairs = blocks.map((block, bIdx) => {
            const title = assignedCueForBlock[bIdx] || deriveFallbackTitleFromBlock(block);
            return {
                cue: title,
                html: block.html,
                plainText: block.plainText
            };
        });

        // Falls es mehr Cues als Absätze gab, verbleibende Cues im letzten Block mit anzeigen
        const remainingCues = rawCues.filter((_, idx) => !usedCues.has(idx));
        if (remainingCues.length > 0 && pairs.length > 0) {
            pairs[pairs.length - 1].extraCues = remainingCues;
        }

        return pairs;
    }

    function render() {
        const container = document.getElementById('overview-container');
        if (!container) return;

        injectStyles();

        const data = activeCaseData?.case_overview;
        if (!data) {
            container.innerHTML = '<div class="feedback-box feedback-neutral" style="display:block;">Für diesen Fall ist keine detaillierte Übersicht verfügbar.</div>';
            return;
        }

        const allPairs = [];
        if (Array.isArray(data.cornell_notes)) {
            data.cornell_notes.forEach(entry => {
                allPairs.push(...buildAlignedPairsForEntry(entry));
            });
        }

        const qLower = filterQuery.trim().toLowerCase();
        const visiblePairs = qLower
            ? allPairs.filter(p => p.cue.toLowerCase().includes(qLower) || p.plainText.toLowerCase().includes(qLower))
            : allPairs;

        const tocPillsHtml = visiblePairs.map((p, idx) => `
            <button type="button"
                    class="cornell-toc-pill"
                    data-jump-row="cornell-row-${idx}"
                    title="Direkt zu „${escapeSafe(p.cue)}“ springen">
                ${idx + 1}. ${escapeSafe(p.cue)}
            </button>
        `).join('');

        const rowsHtml = visiblePairs.map((pair, rowIdx) => {
            const rowId = `cornell-row-${rowIdx}`;
            const targetId = `cornell-note-target-${rowIdx}`;

            const extraCuesHtml = Array.isArray(pair.extraCues)
                ? pair.extraCues.map(ec => `
                    <div class="cornell-sync-cue-item cornell-cue-item" tabindex="0" role="button" data-row="${rowId}" data-target="${targetId}">
                        <span class="cornell-cue-bullet"></span>
                        <span class="cornell-cue-label">${escapeSafe(ec)}</span>
                    </div>
                `).join('')
                : '';

            return `
                <div class="cornell-grid cornell-sync-row" id="${rowId}" data-row-idx="${rowIdx}">
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
                        <div class="cornell-prose-flow">
                            ${pair.html}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

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
                                       placeholder="🔍 In Übersicht suchen...">
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

                ${visiblePairs.length > 1 ? `
                    <div class="cornell-toolbar">
                        <div class="cornell-toc-pills">
                            ${tocPillsHtml}
                        </div>
                    </div>
                ` : ''}

                <div class="cornell-body cornell-sync-sheet">
                    ${rowsHtml || '<div style="padding:20px; color:var(--text-muted);">Keine passenden Abschnitte gefunden.</div>'}
                </div>

                <div class="cornell-summary">
                    <div class="cornell-summary-badge">Take-Home Message (Synthese)</div>
                    <p>${escapeSafe(data.summary || 'Keine Zusammenfassung hinterlegt.')}</p>
                </div>
            </div>
        `;

        bindInteractions(container, visiblePairs);
    }

    function bindInteractions(container, visiblePairs) {
        const rows = Array.from(container.querySelectorAll('.cornell-sync-row'));

        rows.forEach((row, idx) => {
            const cueItem = row.querySelector('.cornell-sync-cue-item');

            row.addEventListener('mouseenter', () => {
                row.classList.add('is-row-hovered');
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(3);
            });

            row.addEventListener('mouseleave', () => {
                row.classList.remove('is-row-hovered');
            });

            if (cueItem) {
                cueItem.addEventListener('click', () => {
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
            }
        });

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
                const pair = visiblePairs[Number(btn.getAttribute('data-save-row-idx'))];
                if (!pair || typeof window.createDepotEntry !== 'function') return;

                await window.createDepotEntry({
                    case_id: activeCaseData?.case_id || 'cornell_note',
                    case_title: activeCaseData?.metadata?.title || activeCaseData?.case_id || 'Cornell Note',
                    category: activeCaseData?.folder_name || activeCaseData?.metadata?.medical_field || 'Allgemein',
                    cue_context: pair.cue,
                    highlighted_text: pair.plainText
                });
                btn.textContent = '✓ Gespeichert';
                btn.disabled = true;
            });
        });

        // Live-Suchfeld mit Fokus-Erhalt
        const searchInput = container.querySelector('#cornell-live-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const pos = e.target.selectionStart;
                filterQuery = e.target.value;
                render();
                const nextInput = document.getElementById('cornell-live-search-input');
                if (nextInput) {
                    nextInput.focus();
                    try { nextInput.setSelectionRange(pos, pos); } catch (_e) {}
                }
            });
        }

        // Active-Recall-Modus Toggle
        const recallBtn = container.querySelector('#btn-toggle-cornell-recall');
        if (recallBtn) {
            recallBtn.addEventListener('click', () => {
                isRecallHideMode = !isRecallHideMode;
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
                render();
            });
        }
    }

    return { render };
})();

window.CornellNotesModule = CornellNotesModule;
window.renderOverview = CornellNotesModule.render;
