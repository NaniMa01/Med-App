/**
 * MedCheck – Synchronized Cornell Notes Engine (js/cornell.js)
 * Features:
 * - Exakte 1:1 vertikale Höhen-Synchronisation (Jeder Titel auf gleicher Höhe wie sein Textabschnitt)
 * - Semantisches Titel-zu-Absatz-Matching (verhindert falsche/zufällige Verknüpfungen)
 * - 100 % Vollständigkeit: Rendert lückenlos alle Themenblöcke & Aufzählungspunkte der Quelle
 * - Präzises Row-Highlighting bei Hover, Klick und Tastaturnavigation (Pfeiltasten ↑/↓)
 * - Quick-Jump-Inhaltsverzeichnis & Active-Recall-Abdeckmodus (Text ausblenden zum Selbstabfragen)
 */

const CornellNotesModule = (() => {
    let isRecallHideMode = false;

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

    function normalizeTokens(str) {
        return stripHtml(str)
            .toLowerCase()
            .replace(/^(wann|wer|was|wie|warum|wo|cave|merke|klinik-perle|therapie|diagnostik|klinik|ätiologie|pathophysiologie)\s*[:?!]\s*/i, '')
            .replace(/[^a-zäöüß0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 3);
    }

    /**
     * Injiziert die Layout-Styles für exakte 1:1 Zeilen-Synchronisation (Dark & Bright Mode)
     */
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
                padding: 10px 16px;
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

            /* 1:1 SYNCHRONISIERTE ZEILE (LINKER TITEL = EXAKT GLEICHE HÖHE WIE RECHTER TEXT) */
            .cornell-sync-sheet {
                display: flex;
                flex-direction: column;
            }
            .cornell-sync-row {
                display: grid;
                grid-template-columns: minmax(190px, 27%) 1fr;
                align-items: start;
                border-bottom: 1px solid var(--divider-color, rgba(148, 163, 184, 0.14));
                transition: background-color 0.18s ease, box-shadow 0.18s ease;
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

            /* Linke Cue-Spalte (exakt auf Höhe des Textbeginns) */
            .cornell-sync-cue-col {
                padding: 16px 14px 16px 18px;
                border-right: 2px solid rgba(239, 68, 68, 0.35);
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
            }
            .cornell-sync-cue-item {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 7px 10px;
                border-radius: 9px;
                background: rgba(15, 23, 42, 0.45);
                border: 1px solid rgba(148, 163, 184, 0.18);
                color: var(--text-main, #f8fafc);
                font-size: 0.82rem;
                font-weight: 700;
                line-height: 1.4;
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
                margin-top: 1px;
            }
            html[data-theme="daylight"] .cornell-sync-cue-num,
            html[data-theme="tropical"] .cornell-sync-cue-num {
                color: #0369a1;
                background: rgba(2, 132, 199, 0.14);
            }
            .cornell-sync-cue-continuation {
                font-size: 0.74rem;
                font-weight: 600;
                color: var(--text-dim, #64748b);
                padding: 4px 8px;
                font-style: italic;
            }

            /* Rechte Notes-Spalte */
            .cornell-sync-note-col {
                padding: 16px 20px;
                font-size: 0.92rem;
                line-height: 1.65;
                color: var(--text-main, #f1f5f9);
                border-left: 3px solid transparent;
                transition: border-color 0.18s ease, background-color 0.18s ease, filter 0.2s ease;
            }
            .cornell-sync-note-col > p:first-child,
            .cornell-sync-note-col > ul:first-child,
            .cornell-sync-note-col > ol:first-child,
            .cornell-sync-note-col > h3:first-child,
            .cornell-sync-note-col > h4:first-child {
                margin-top: 0;
            }
            .cornell-sync-note-col > p:last-child,
            .cornell-sync-note-col > ul:last-child,
            .cornell-sync-note-col > ol:last-child {
                margin-bottom: 0;
            }
            .cornell-sync-note-col ul.cornell-single-bullet,
            .cornell-sync-note-col ol.cornell-single-bullet {
                margin: 0;
                padding-left: 18px;
            }
            .cornell-sync-row.is-row-hovered .cornell-sync-note-col,
            .cornell-sync-row.is-row-pinned .cornell-sync-note-col {
                border-left-color: var(--accent-cyan, #38bdf8);
                background: rgba(56, 189, 248, 0.05);
            }

            /* Active-Recall-Modus: Rechte Seite verschwommen bis zum Klick/Hover auf die Zeile */
            .cornell-recall-active .cornell-sync-note-col {
                filter: blur(6px);
                opacity: 0.35;
                cursor: pointer;
                user-select: none;
            }
            .cornell-recall-active .cornell-sync-row.is-row-pinned .cornell-sync-note-col,
            .cornell-recall-active .cornell-sync-row:hover .cornell-sync-note-col {
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
                    padding: 10px 14px 14px 14px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Extrahiert eine eventuelle führende Fett-Überschrift aus einem HTML-Block
     * (z.B. "<p><b>Epidemiologie:</b> Text...</p>" -> "Epidemiologie")
     */
    function extractLeadingHeading(blockHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = blockHtml;
        const container = tmp.querySelector('li, p, h3, h4, div') || tmp;
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
     * Zerlegt einen Cornell-Notes-Eintrag verlustfrei in atomare Textblöcke,
     * sodass jeder Abschnitt exakt auf der Höhe seines Titels liegt.
     */
    function parseNoteIntoAtomicBlocks(rawNotesHtml, expectedCueCount = 0) {
        let html = String(rawNotesHtml || '').trim();
        if (!html) return [];

        // 1. Falls keine Block-Tags vorhanden sind, aber <br><br> genutzt wurde (Legacy-Fälle), in <p> umwandeln
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

            // Aufklappbare Deep-Dive-Karten an den vorherigen Inhaltsblock anhängen, damit sie nicht verwaist stehen
            if (node.classList?.contains('sm-deep-dive-card')) {
                if (blocks.length > 0) {
                    blocks[blocks.length - 1].html += node.outerHTML;
                } else {
                    blocks.push({
                        html: node.outerHTML,
                        plainText: stripHtml(node.outerHTML),
                        leadingHeading: 'Vertiefung'
                    });
                }
                return;
            }

            // Listen (<ul> / <ol>): In einzelne Listenpunkte aufsplitten, wenn mehrere Items vorhanden sind,
            // damit jeder Punkt seinen eigenen Titel auf exakt derselben Höhe erhält!
            if (tag === 'UL' || tag === 'OL') {
                const listItems = Array.from(node.children).filter(li => li.tagName === 'LI');
                if (listItems.length > 1 || expectedCueCount > 1) {
                    listItems.forEach((li, liIdx) => {
                        const listTag = tag.toLowerCase();
                        const startAttr = listTag === 'ol' ? ` start="${liIdx + 1}"` : '';
                        const singleListHtml = `<${listTag} class="cornell-single-bullet"${startAttr}>${li.outerHTML}</${listTag}>`;
                        blocks.push({
                            html: singleListHtml,
                            plainText: stripHtml(li.innerHTML),
                            leadingHeading: extractLeadingHeading(li.outerHTML)
                        });
                    });
                } else if (listItems.length === 1) {
                    blocks.push({
                        html: node.outerHTML,
                        plainText: stripHtml(node.innerHTML),
                        leadingHeading: extractLeadingHeading(listItems[0].outerHTML)
                    });
                }
                return;
            }

            // Standard-Absätze (<p>, <h3>, <h4>, <blockquote>, <div>)
            const plain = stripHtml(node.innerHTML);
            if (plain) {
                blocks.push({
                    html: node.outerHTML,
                    plainText: plain,
                    leadingHeading: extractLeadingHeading(node.outerHTML)
                });
            }
        });

        // Sonderfall: Es gibt nur 1 langen Absatz, aber mehrere Cues -> Satzweise aufteilen, falls sinnvoll
        if (blocks.length === 1 && expectedCueCount > 1) {
            const singleHtml = blocks[0].html;
            const innerMatch = singleHtml.match(/^<p[^>]*>([\s\S]*)<\/p>$/i);
            if (innerMatch && innerMatch[1]) {
                // Trenne an Satzenden vor einem fettgedruckten Begriff oder Fragezeichen
                const sentenceChunks = innerMatch[1]
                    .split(/(?<=[.!?])\s+(?=(?:<b>|<strong>|<em>|[A-ZÄÖÜ]))/g)
                    .map(s => s.trim())
                    .filter(Boolean);

                if (sentenceChunks.length >= expectedCueCount) {
                    return sentenceChunks.map(chunk => ({
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
     * Ordnet die `cues` semantisch exakt den passenden Textblöcken zu (kein zufälliges Mapping!)
     * und stellt sicher, dass 100 % aller Textblöcke erhalten bleiben.
     */
    function buildAlignedPairsForEntry(noteEntry) {
        const rawCues = Array.isArray(noteEntry.cues)
            ? noteEntry.cues.map(c => stripHtml(c)).filter(Boolean)
            : (noteEntry.cues ? [stripHtml(noteEntry.cues)] : []);

        const blocks = parseNoteIntoAtomicBlocks(noteEntry.notes, rawCues.length);
        if (blocks.length === 0) {
            return rawCues.map(c => ({ cue: c, html: '', isContinuation: false }));
        }

        // Bewertungs-Matrix zwischen jedem Cue und jedem Textblock aufbauen
        const candidateScores = [];
        rawCues.forEach((cue, cIdx) => {
            const cueLower = cue.toLowerCase();
            const cueTokens = normalizeTokens(cue);

            blocks.forEach((block, bIdx) => {
                let score = 0;
                const headingLower = (block.leadingHeading || '').toLowerCase();
                const textLower = block.plainText.toLowerCase();

                // 1. Direkter Match mit der fettgedruckten Überschrift des Absatzes
                if (headingLower && (headingLower === cueLower || headingLower.includes(cueLower) || cueLower.includes(headingLower))) {
                    score += 120;
                }

                // 2. Exakter Phrasen-Match im Absatztext
                if (cueLower.length >= 4 && textLower.includes(cueLower)) {
                    score += 55;
                }

                // 3. Token-Überlappung (medizinische Schlüsselwörter)
                cueTokens.forEach(tok => {
                    if (headingLower.includes(tok)) score += 25;
                    else if (textLower.includes(tok)) score += 14;
                });

                // 4. Sanfter Positions-Tiebreaker (wenn Cues und Absätze bereits 1:1 synchron geschrieben wurden)
                if (cIdx === bIdx) {
                    score += 18;
                } else if (Math.abs(cIdx - bIdx) === 1) {
                    score += 4;
                }

                candidateScores.push({ cIdx, bIdx, score });
            });
        });

        // Beste eindeutige 1:1-Paare zuweisen (Greedy Bipartite Matching)
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

        // Falls ein Cue noch nicht zugewiesen wurde, auf den nächsten freien Block legen
        rawCues.forEach((cue, cIdx) => {
            if (usedCues.has(cIdx)) return;
            const freeBlockIdx = assignedCueForBlock.findIndex(val => val === null);
            if (freeBlockIdx !== -1) {
                assignedCueForBlock[freeBlockIdx] = cue;
                usedCues.add(cIdx);
            }
        });

        // Ergebnisliste für ALLE Textblöcke bauen (100 % Vollständigkeit!)
        const pairs = blocks.map((block, bIdx) => {
            let title = assignedCueForBlock[bIdx];
            let isContinuation = false;

            if (!title) {
                if (block.leadingHeading) {
                    title = block.leadingHeading;
                } else {
                    title = 'Vertiefung / Details';
                    isContinuation = true;
                }
            }

            return {
                cue: title,
                html: block.html,
                isContinuation
            };
        });

        // Falls mehr Cues als Blöcke existierten, verbleibende Cues sauber im letzten Block ergänzen
        const remainingCues = rawCues.filter((_, idx) => !usedCues.has(idx));
        if (remainingCues.length > 0 && pairs.length > 0) {
            pairs[pairs.length - 1].extraCues = remainingCues;
        }

        return pairs;
    }

    /**
     * Haupt-Renderer für die Cornell-Note-Übersicht
     */
    function render() {
        const container = document.getElementById('overview-container');
        if (!container) return;

        injectStyles();

        const data = activeCaseData?.case_overview;
        if (!data) {
            container.innerHTML = '<div class="feedback-box feedback-neutral" style="display:block;">Für diesen Fall ist keine detaillierte Übersicht verfügbar.</div>';
            return;
        }

        // Alle Cornell-Notes-Einträge zu einer durchgehenden, 1:1 ausgerichteten Tabelle zusammenführen
        const allPairs = [];
        if (Array.isArray(data.cornell_notes)) {
            data.cornell_notes.forEach(entry => {
                const pairs = buildAlignedPairsForEntry(entry);
                allPairs.push(...pairs);
            });
        }

        const primaryCues = allPairs.filter(p => !p.isContinuation);

        const tocPillsHtml = primaryCues.map((p, idx) => {
            const rowIndex = allPairs.indexOf(p);
            return `
                <button type="button"
                        class="cornell-toc-pill"
                        data-jump-row="cornell-row-${rowIndex}"
                        title="Direkt zu „${escapeSafe(p.cue)}“ springen">
                    ${idx + 1}. ${escapeSafe(p.cue)}
                </button>
            `;
        }).join('');

        let sectionCounter = 0;
        const rowsHtml = allPairs.map((pair, rowIdx) => {
            const rowId = `cornell-row-${rowIdx}`;
            const targetId = `cornell-note-target-${rowIdx}`;
            if (!pair.isContinuation) sectionCounter++;

            const extraCuesHtml = Array.isArray(pair.extraCues)
                ? pair.extraCues.map(ec => `
                    <div class="cornell-sync-cue-item cornell-cue-item" style="margin-top:6px;" tabindex="0" role="button" data-row="${rowId}" data-target="${targetId}">
                        <span class="cornell-cue-bullet"></span>
                        <span class="cornell-cue-label">${escapeSafe(ec)}</span>
                    </div>
                `).join('')
                : '';

            const leftCellHtml = pair.isContinuation
                ? `<div class="cornell-sync-cue-continuation">↳ Fortsetzung</div>`
                : `
                    <div class="cornell-sync-cue-item cornell-cue-item"
                         tabindex="0"
                         role="button"
                         data-row="${rowId}"
                         data-target="${targetId}">
                        <span class="cornell-sync-cue-num">${sectionCounter}</span>
                        <span class="cornell-cue-label">${escapeSafe(pair.cue)}</span>
                    </div>
                    ${extraCuesHtml}
                `;

            return `
                <div class="cornell-grid cornell-sync-row" id="${rowId}" data-row-idx="${rowIdx}">
                    <div class="cornell-sync-cue-col">
                        ${leftCellHtml}
                    </div>
                    <div class="cornell-sync-note-col cornell-notes" id="${targetId}" data-row="${rowId}">
                        ${pair.html}
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
                                Vollständige Cornell-Note · ${primaryCues.length} Themenabschnitte (${allPairs.length} Blöcke 1:1 synchronisiert)
                            </div>
                        </div>
                        <button type="button"
                                class="ghost-tool-btn"
                                id="btn-toggle-cornell-recall"
                                style="font-size:0.76rem; padding:6px 12px;"
                                title="Blendet die rechte Textspalte aus, damit du dich anhand der linken Titel selbst abfragen kannst">
                            ${isRecallHideMode ? '👁️ Notizen wieder einblenden' : '🧠 Active-Recall-Modus (Text abdecken)'}
                        </button>
                    </div>
                </div>

                ${primaryCues.length > 1 ? `
                    <div class="cornell-toolbar">
                        <div class="cornell-toc-pills">
                            ${tocPillsHtml}
                        </div>
                    </div>
                ` : ''}

                <div class="cornell-body cornell-sync-sheet">
                    ${rowsHtml || '<div style="padding:20px; color:var(--text-muted);">Keine Cornell-Notizen hinterlegt.</div>'}
                </div>

                <div class="cornell-summary">
                    <div class="cornell-summary-badge">Take-Home Message (Synthese)</div>
                    <p>${escapeSafe(data.summary || 'Keine Zusammenfassung hinterlegt.')}</p>
                </div>
            </div>
        `;

        bindRowInteractions(container);
    }

    /**
     * Verbindet Hover-, Klick-, Quick-Jump- und Tastatur-Events für jede synchronisierte Zeile
     */
    function bindRowInteractions(container) {
        const rows = Array.from(container.querySelectorAll('.cornell-sync-row'));

        rows.forEach((row, idx) => {
            const cueItem = row.querySelector('.cornell-sync-cue-item');

            // Hover über die Zeile (egal ob links auf dem Titel oder rechts im Text) hebt das gesamte 1:1-Paar hervor
            row.addEventListener('mouseenter', () => {
                row.classList.add('is-row-hovered');
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(3);
            });

            row.addEventListener('mouseleave', () => {
                row.classList.remove('is-row-hovered');
            });

            // Klick auf den linken Titel fixiert die Markierung (und deckt im Recall-Modus den Text auf)
            if (cueItem) {
                cueItem.addEventListener('click', () => {
                    const wasPinned = row.classList.contains('is-row-pinned');
                    rows.forEach(r => r.classList.remove('is-row-pinned'));
                    if (!wasPinned) {
                        row.classList.add('is-row-pinned');
                        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(7);
                    }
                });

                // Tastatur-Navigation (Pfeiltaste Runter / Hoch springt zum nächsten/vorherigen Titel)
                cueItem.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        cueItem.click();
                    } else if (e.key === 'ArrowDown' && rows[idx + 1]) {
                        e.preventDefault();
                        const nextCue = rows[idx + 1].querySelector('.cornell-sync-cue-item');
                        nextCue?.focus();
                        rows[idx + 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else if (e.key === 'ArrowUp' && rows[idx - 1]) {
                        e.preventDefault();
                        const prevCue = rows[idx - 1].querySelector('.cornell-sync-cue-item');
                        prevCue?.focus();
                        rows[idx - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
            }
        });

        // Quick-Jump-Pills oben in der Toolbar
        container.querySelectorAll('.cornell-toc-pill[data-jump-row]').forEach(pill => {
            pill.addEventListener('click', () => {
                const targetRowId = pill.getAttribute('data-jump-row');
                const targetRow = document.getElementById(targetRowId);
                if (!targetRow) return;

                rows.forEach(r => r.classList.remove('is-row-pinned'));
                targetRow.classList.add('is-row-pinned');
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
            });
        });

        // Active-Recall-Toggle
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
