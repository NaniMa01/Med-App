/**
 * MedCheck – Synchronized Cornell Notes Engine V3.0 (js/cornell.js)
 * Features:
 * - Redundanzfreie 1:1-Synchronisation: Linke Cue-Titel wiederholen sich rechts nicht mehr
 * - Fall- & kontextbewusste klinische Fetthervorhebung (Grenzwerte, Scores, Goldstandards, Diagnosen)
 * - Sofortige redaktionelle Callout-Boxen (Cave / Merke / Klinik-Perle) & ▼-Deep-Dive-Recovery
 * - Zwei Active-Recall-Modi: 🧩 Lückentext (Schlüsselbegriffe) & 🧠 Text abdecken (ganze Spalte)
 * - 100 % Safari-/iOS-kompatibel (keine Lookbehind-Regexes), Dark- & Bright-Mode-optimiert
 */

const CornellNotesModule = (() => {
    let studyMode = 'normal'; // 'normal' | 'cloze' | 'recall'
    let filterQuery = '';
    let lastRenderedCaseId = null;
    let revealedRowsSet = new Set(); // Trackt individuell aufgedeckte Zeilen im Recall-Modus

    const STOPWORDS = new Set([
        'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen',
        'und', 'oder', 'aber', 'sowie', 'auch', 'bei', 'mit', 'von', 'vom', 'zur', 'zum',
        'auf', 'aus', 'für', 'über', 'unter', 'durch', 'nach', 'vor', 'als', 'wie', 'sind',
        'ist', 'wird', 'werden', 'kann', 'können', 'muss', 'müssen', 'soll', 'sollte', 'nicht',
        'kein', 'keine', 'sehr', 'mehr', 'weniger', 'bzw', 'etc', 'z.b', 'essenziell'
    ]);

    const CALLOUT_PREFIX_REGEX = /^(?:merke|cave|klinik-perle|clinical pearl|praxis-tipp|red flag|achtung|take-home)\b/i;

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

    function sanitizeEditorialHtml(rawHtml) {
        return String(rawHtml || '')
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
    }

    function isWordChar(ch) {
        return !!ch && /[A-Za-zÄÖÜäöüß0-9]/.test(ch);
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

    function normalizeHeadingText(str) {
        return stripHtml(str)
            .toLowerCase()
            .replace(/[:–—\-.,;!?()[\]„“"'&]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Prüft, ob eine führende Überschrift im rechten Text dem linken Cue entspricht
    function isHeadingRedundantWithCue(headingText, cueText) {
        const cleanHead = stripHtml(headingText).replace(/[:–—\-]+$/, '').trim();
        const cleanCue = stripHtml(cueText).replace(/[:–—\-]+$/, '').trim();
        if (!cleanHead || !cleanCue) return false;
        if (CALLOUT_PREFIX_REGEX.test(cleanHead)) return false;

        const normHead = normalizeHeadingText(cleanHead);
        const normCue = normalizeHeadingText(cleanCue);
        if (!normHead || !normCue) return false;

        if (normHead === normCue) return true;

        if (normHead.length >= 4 && normCue.length >= 4) {
            if (normCue.includes(normHead) || normHead.includes(normCue)) {
                const ratio = Math.min(normHead.length, normCue.length) / Math.max(normHead.length, normCue.length);
                if (ratio >= 0.58) return true;
            }
        }

        const headStems = extractStemTokens(cleanHead);
        const cueStems = new Set(extractStemTokens(cleanCue));
        if (headStems.length > 0 && headStems.length <= 7 && cueStems.size > 0) {
            const hits = headStems.filter(s => cueStems.has(s)).length;
            if (hits / headStems.length >= 0.75) return true;
        }

        return false;
    }

    // Kapitalisiert den Satzanfang nach entferntem Doppelpunkt-Titel (schont wissenschaftliche Präfixe wie β-hCG, pH, vWF)
    function capitalizeLeadNodeIfNeeded(el) {
        if (!el) return;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        let firstTextNode = null;
        while ((firstTextNode = walker.nextNode())) {
            if (firstTextNode.nodeValue && firstTextNode.nodeValue.trim().length > 0) break;
        }
        if (!firstTextNode) return;

        const val = firstTextNode.nodeValue.replace(/^\s+/, '');
        if (/^(?:pH|vW|mR|tR|cA|i\.v|i\.m|s\.c|p\.o|z\.B|d\.h|u\.a)/i.test(val)) {
            firstTextNode.nodeValue = val;
            return;
        }
        if (/^[a-zäöü]{3,}/.test(val)) {
            firstTextNode.nodeValue = val.charAt(0).toUpperCase() + val.slice(1);
        } else {
            firstTextNode.nodeValue = val;
        }
    }

    /**
     * Entfernt im rechten Text den führenden Titel, sofern er sich bereits links in der Cue-Spalte befindet.
     * Belässt grammatikalisch eingebettete Subjekte (ohne Trennzeichen : / –) und Callouts (Merke:/Cave:) unangetastet.
     */
    function stripRedundantLeadingTitle(blockHtml, cueTitle) {
        if (!blockHtml || !cueTitle) return blockHtml;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = blockHtml;

        const firstBlock = wrapper.firstElementChild;
        if (!firstBlock || firstBlock.classList?.contains('sm-deep-dive-card') || firstBlock.classList?.contains('sm-callout-box')) {
            return blockHtml;
        }

        const firstBlockText = (firstBlock.textContent || '').trim();

        // Fall 1: Eigenständiger Überschriften-Absatz (z.B. <p><strong>Titel:</strong></p>) gefolgt von weiterem Text
        if (wrapper.children.length > 1 && firstBlockText.length <= 90) {
            const cleanedStandalone = firstBlockText.replace(/[:–—\-]+$/, '').trim();
            if (isHeadingRedundantWithCue(cleanedStandalone, cueTitle)) {
                firstBlock.remove();
                return wrapper.innerHTML.trim();
            }
        }

        // Fall 2: Führendes <b>Titel:</b> oder <strong>Titel</strong>: am Beginn des ersten Absatzes
        const leadChild = firstBlock.firstChild;
        if (leadChild && leadChild.nodeType === Node.ELEMENT_NODE && (leadChild.tagName === 'B' || leadChild.tagName === 'STRONG')) {
            const rawTagText = (leadChild.textContent || '').trim();
            const hasInternalSeparator = /[:–—\-]\s*$/.test(rawTagText);
            const nextSibling = leadChild.nextSibling;
            const nextText = nextSibling && nextSibling.nodeType === Node.TEXT_NODE ? nextSibling.nodeValue : '';
            const hasExternalSeparator = /^\s*[:–—\-]\s*/.test(nextText);
            const nextIsBr = nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && nextSibling.tagName === 'BR';

            if ((hasInternalSeparator || hasExternalSeparator || nextIsBr) && isHeadingRedundantWithCue(rawTagText, cueTitle)) {
                leadChild.remove();
                if (nextIsBr) {
                    nextSibling.remove();
                } else if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                    nextSibling.nodeValue = nextSibling.nodeValue.replace(/^\s*[:–—\-]?\s*/, '');
                }
                // Eventuelle führende <br>-Tags aufräumen
                while (firstBlock.firstChild && firstBlock.firstChild.nodeType === Node.ELEMENT_NODE && firstBlock.firstChild.tagName === 'BR') {
                    firstBlock.firstChild.remove();
                }
                capitalizeLeadNodeIfNeeded(firstBlock);

                if (!(firstBlock.textContent || '').trim()) {
                    firstBlock.remove();
                }
                return wrapper.innerHTML.trim();
            }
        }

        // Fall 3: Unformatierter Plain-Text-Präfix "Titel: Resttext..." im ersten Absatz
        if (leadChild && leadChild.nodeType === Node.TEXT_NODE) {
            const txt = leadChild.nodeValue || '';
            const colonIdx = txt.indexOf(':');
            if (colonIdx >= 2 && colonIdx <= 85) {
                const candidate = txt.slice(0, colonIdx).trim();
                if (!/[.!?]/.test(candidate) && isHeadingRedundantWithCue(candidate, cueTitle)) {
                    leadChild.nodeValue = txt.slice(colonIdx + 1).replace(/^\s+/, '');
                    capitalizeLeadNodeIfNeeded(firstBlock);
                    return wrapper.innerHTML.trim();
                }
            }
        }

        return wrapper.innerHTML.trim();
    }

    // ----------------------------------------------------------------------
    // SMART CLINICAL AUTO-BOLDING ENGINE (FALLBEWUSST & SAFARI-SICHER)
    // ----------------------------------------------------------------------
    function buildDynamicCaseTerms(caseObj) {
        const sensitiveAcronyms = new Set();
        const insensitiveTerms = new Set();

        const register = (raw) => {
            if (typeof raw !== 'string') return;
            const clean = raw.trim().replace(/\s+/g, ' ');
            if (clean.length < 3 || clean.length > 52) return;

            // Klammerzusätze einzeln mit aufnehmen, z.B. "Asherman-Syndrom (AUB-N)" -> beide Teile
            const parenMatch = clean.match(/^(.+?)\s*\(([^)]+)\)$/);
            if (parenMatch) {
                register(parenMatch[1]);
                register(parenMatch[2]);
            }

            // Kurze Großbuchstaben-Akronyme strikt case-sensitiv (verhindert z.B. "EIN" -> "ein")
            if (/^[A-ZÄÖÜ0-9β\-/]{2,6}$/.test(clean) && /[A-ZÄÖÜ]/.test(clean)) {
                if (clean.length >= 3) sensitiveAcronyms.add(clean);
                return;
            }

            if (clean.length >= 5) {
                insensitiveTerms.add(clean);
            }
        };

        if (caseObj && typeof caseObj === 'object') {
            register(caseObj.metadata?.primary_disease);
            const tasks = caseObj.extra_tasks || {};
            (Array.isArray(tasks.library_entries) ? tasks.library_entries : []).forEach(register);
            (Array.isArray(tasks.synapses_matrix?.diseases) ? tasks.synapses_matrix.diseases : []).forEach(register);
            (Array.isArray(tasks.synapses_matrix?.variables) ? tasks.synapses_matrix.variables : []).forEach(v => register(v?.term));
            (Array.isArray(tasks.categorization?.categories) ? tasks.categorization.categories : []).forEach(register);
            const docPuzzles = Array.isArray(tasks.doctordle) ? tasks.doctordle : (tasks.doctordle ? [tasks.doctordle] : []);
            docPuzzles.forEach(p => {
                register(p?.target_diagnosis);
                (Array.isArray(p?.synonyms) ? p.synonyms : []).forEach(register);
            });
        }

        return {
            sensitiveAcronyms: Array.from(sensitiveAcronyms).sort((a, b) => b.length - a.length),
            insensitiveTerms: Array.from(insensitiveTerms).sort((a, b) => b.length - a.length)
        };
    }

    const CLINICAL_SIGNAL_REGEX = new RegExp(
        '(?:' + [
            'Goldstandard',
            'Erstlinientherapie',
            'Erstlinie',
            'Therapie der Wahl',
            'Mittel der Wahl',
            'Ultima Ratio',
            'Ausschlussdiagnose',
            'Hochrisiko-Präkanzerose',
            'Kontraindikation(?:en)?',
            'kontraindiziert',
            'obligat(?:e|er|es|en)?',
            'pathognomonisch(?:e|er|es|en)?',
            'beweisend(?:e|er|es|en)?',
            'Red Flags?',
            'sofortige(?:r|m|n)? Interventionsbedarf',
            'histologische(?:r|n)? Sicherung',
            'prospektive(?:s|n)?\\s+(?:tägliche(?:s|n)?\\s+)?Symptomtagebuch',
            'symptomfreie(?:s|m|n)?\\s+Intervall',
            'normale(?:r|n)?\\s+Hormonstatus',
            'erhöhte(?:r|n)?\\s+zentrale(?:r|n)?\\s+Sensitivität',
            'spontane(?:r|n)?\\s+Regression',
            'okkulte(?:s|n)?\\s+Karzinom',
            'Gewichtsreduktion',
            'Zyklusregulation',
            'Hysterektomie',
            'Hysteroskopie',
            'hysteroskopische(?:r|n)?\\s+(?:Resektion|Synechienlösung)',
            'Hydrosonographie',
            'Resektoskopie(?:\\/Shaver)?',
            'Myomektomie',
            'Uterusarterienembolisation',
            'Endometriumbiopsie',
            'Pipelle de Cornier',
            'transvaginale(?:r|n)?\\s+Ultraschall',
            'Endometriumkarzinom(?:s)?',
            'Endometriumhyperplasie',
            'Endometriumpolypen?',
            'Corpuspolypen?',
            'Leiomyome?',
            'Adenomyose',
            'Adenomyosis',
            'Asherman-Syndrom',
            'Von-Willebrand-Syndrom',
            'chronische(?:r|n)?\\s+Endometritis',
            'Eumenorrhö',
            'Hypermenorrhö',
            'Hypomenorrhö',
            'Menorrhagie',
            'Oligomenorrhö',
            'Polymenorrhö',
            'Metrorrhagie',
            'Amenorrhö',
            'Anovulation',
            'Hyperandrogenismus',
            'Hyperprolaktinämie',
            'Insulinresistenz',
            'Fibrinolyse',
            'Koagulopathie',
            'Nephrolithiasis',
            'periphere(?:r|n)?\\s+Neuropathie',
            'Tranexamsäure',
            'Mefenaminsäure',
            'Spironolacton',
            'Drospirenon\\/EE',
            'Mönchspfeffer',
            'Allopregnanolon',
            'Progesteron',
            'Östradiol',
            'Prolaktin',
            'Ferritin',
            'Blutbild',
            'β-hCG',
            'Beta-hCG',
            '17-OH-Progesteron',
            '75-g-OGTT',
            'Rotterdam-Kriterien',
            'GnRH-Agonisten(?:\\/-Antagonisten)?',
            'GnRH-Antagonisten',
            'Gestagenspirale',
            'Add-back',
            'GABA-A-Rezeptor',
            '5α-Reduktase',
            '[35][αβ]-HSD',
            'CYP450scc',
            'Faktor\\s+(?:I|II|V|VII|VIII|IX|X|XI|XII|XIII)'
        ].join('|') + ')',
        'gi'
    );

    const CLINICAL_METRIC_REGEX = new RegExp(
        '(?:' + [
            '(?:≥|≤|>|<|mind\\.\\s*|ca\\.\\s*|bis\\s+)?\\d+(?:[.,]\\d+)?(?:\\s*[–-]\\s*\\d+(?:[.,]\\d+)?)?\\s*(?:%|mg\\/d(?:l)?|mmol\\/l|µmol\\/l|nmol\\/l|pmol\\/l|g\\/d(?:l)?|µg\\/(?:l|d)|ng\\/ml|pg\\/ml|IU\\/(?:l|d)|U\\/l|G\\/l|T\\/l|mmHg|\\/min|bpm|°C|kg\\/m²|mg|µg|ml|cm|mm|Tage(?:n)?|Woche(?:n)?|Monate(?:n)?|Jahre(?:n)?|Zyklen|Follikel\\/Ovar|Segmente(?:n)?|Menstruationen)',
            '(?:≥|≤|>|<)\\s*\\d+(?:\\s*von\\s*\\d+)?\\s*(?:Kriterien|Symptome(?:n)?|Kernsymptome(?:n)?)?',
            'FIGO(?:-AUB-System\\s*[12]|-Typ\\s*\\d+(?:[–-]\\d+)?|\\s*\\d+(?:[–-]\\d+)?)',
            'DSM-5',
            'ICD-1[01]',
            'Stufe\\s*[1-5]',
            '\\d+\\.\\s*ZT',
            '\\b[1-9]\\/[2-9]\\b'
        ].join('|') + ')',
        'g'
    );

    const CLINICAL_ACRONYM_REGEX = /\b(?:PALM-COEIN|AUB-[PALMCOEIN]|SSRI\/SNRI|SSRI|SNRI|NSAR|LNG-IUS|COCs?|OVH|IUD|HRT|TVUS|MRT|MRI|CT|EKG|EEG|EMG|OGTT|TSH|FSH|LH|AMH|SHBG|DHEAS|HPA|HPG|SERT|BDNF|ALLO|PMOS|PCOS|PMDS|PMS|PMDs?|RED-S|AVM|IMB|vWF-Antigen(?:\/-Aktivität)?|vWF|vWS|EIN|NMOSD|LETM|AQP4-IgG|OKB|MMA|GBS)\b/g;

    const PAREN_TERM_EXCLUDE = /^(?:z\.?\s*b\.?|inkl\.?|ca\.?|vgl\.?|bzw\.?|d\.?\s*h\.?|u\.?\s*a\.?|s\.?\s*o\.?|mind\.?|max\.?|nicht\b|nur\b|meist\b|oft\b|sonst\b|ohne\b|mit\b|bei\b|oder\b|und\b|wie\b|davon\b|nach\b)/i;

    function collectRegexMatches(text, regex, priority, bucket, requireBoundary = true) {
        regex.lastIndex = 0;
        let m;
        while ((m = regex.exec(text)) !== null) {
            if (!m[0]) {
                regex.lastIndex++;
                continue;
            }
            const start = m.index;
            const end = start + m[0].length;

            if (requireBoundary) {
                const prevCh = start > 0 ? text[start - 1] : '';
                const nextCh = end < text.length ? text[end] : '';
                if (isWordChar(m[0][0]) && isWordChar(prevCh)) continue;
                if (isWordChar(m[0][m[0].length - 1]) && isWordChar(nextCh)) continue;
            }

            bucket.push({ start, end, priority, len: end - start });
        }
    }

    function collectSubstringMatches(text, terms, caseSensitive, priority, bucket) {
        if (!terms || terms.length === 0) return;
        const haystack = caseSensitive ? text : text.toLowerCase();

        for (let i = 0; i < terms.length; i++) {
            const term = terms[i];
            const needle = caseSensitive ? term : term.toLowerCase();
            let pos = 0;
            while (pos < haystack.length) {
                const idx = haystack.indexOf(needle, pos);
                if (idx === -1) break;
                const end = idx + needle.length;
                const prevCh = idx > 0 ? text[idx - 1] : '';
                const nextCh = end < text.length ? text[end] : '';

                const leftOk = !isWordChar(needle[0]) || !isWordChar(prevCh);
                const rightOk = !isWordChar(needle[needle.length - 1]) || !isWordChar(nextCh);
                if (leftOk && rightOk) {
                    bucket.push({ start: idx, end, priority, len: needle.length });
                }
                pos = end;
            }
        }
    }

    function autoBoldTextNode(textNode, dynamicTerms) {
        const text = textNode.nodeValue || '';
        if (text.trim().length < 4) return;

        const candidates = [];

        // 1. Fall-spezifische Diagnosen & Begriffe
        collectSubstringMatches(text, dynamicTerms.sensitiveAcronyms, true, 100, candidates);
        collectSubstringMatches(text, dynamicTerms.insensitiveTerms, false, 95, candidates);

        // 2. Medizinische Fachbegriffe mit Klammer-Code/Synonym, z.B. "Endometriumpolypen (AUB-P)"
        const parenRegex = /[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]{3,34}\s*\(([^()]{2,32})\)/g;
        let pm;
        while ((pm = parenRegex.exec(text)) !== null) {
            const inner = pm[1].trim();
            if (!PAREN_TERM_EXCLUDE.test(inner) && !/[.;]/.test(inner)) {
                const start = pm.index;
                const end = start + pm[0].length;
                const prevCh = start > 0 ? text[start - 1] : '';
                if (!isWordChar(prevCh)) {
                    candidates.push({ start, end, priority: 90, len: end - start });
                }
            }
        }

        // 3. Klinische Signalwörter, Goldstandards & Schlüsselbegriffe
        collectRegexMatches(text, CLINICAL_SIGNAL_REGEX, 85, candidates, true);

        // 4. Quantitative Grenzwerte, Dosierungen, Scores & Zeiträume
        collectRegexMatches(text, CLINICAL_METRIC_REGEX, 80, candidates, false);

        // 5. Klinische Akronyme (case-sensitiv)
        collectRegexMatches(text, CLINICAL_ACRONYM_REGEX, 75, candidates, true);

        if (candidates.length === 0) return;

        // Nach Priorität und Länge sortieren, Überlappungen verwerfen
        candidates.sort((a, b) => (b.priority - a.priority) || (b.len - a.len) || (a.start - b.start));

        const chosen = [];
        let boldCharsTotal = 0;
        const maxBoldChars = Math.max(24, Math.floor(text.length * 0.42));

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const overlaps = chosen.some(x => !(c.end <= x.start || c.start >= x.end));
            if (overlaps) continue;
            if (boldCharsTotal + c.len > maxBoldChars && chosen.length >= 2) continue;

            chosen.push(c);
            boldCharsTotal += c.len;
        }

        if (chosen.length === 0) return;
        chosen.sort((a, b) => a.start - b.start);

        const frag = document.createDocumentFragment();
        let cursor = 0;

        chosen.forEach(range => {
            if (range.start > cursor) {
                frag.appendChild(document.createTextNode(text.slice(cursor, range.start)));
            }
            const strong = document.createElement('strong');
            strong.className = 'cornell-auto-key';
            strong.textContent = text.slice(range.start, range.end);
            frag.appendChild(strong);
            cursor = range.end;
        });

        if (cursor < text.length) {
            frag.appendChild(document.createTextNode(text.slice(cursor)));
        }

        textNode.parentNode?.replaceChild(frag, textNode);
    }

    /**
     * Wandelt Absätze mit "Merke:", "Cave:" oder "Klinik-Perle:" direkt in strukturierte Callout-Boxen um
     * und markiert alle Absätze als .sm-upgraded (verhindert doppelte Bearbeitung durch EditorialScrollEngine).
     */
    function upgradeInlineCalloutsInElement(rootEl) {
        if (!rootEl) return;
        const paragraphs = Array.from(rootEl.querySelectorAll('p'));

        paragraphs.forEach(p => {
            if (p.closest('.sm-callout-box, .sm-deep-dive-card')) {
                p.classList.add('sm-upgraded');
                return;
            }
            const rawHtml = p.innerHTML.trim();
            let modifier = '';
            let badgeTitle = '';
            let cleanedHtml = '';

            if (/^(?:<(?:strong|b)[^>]*>)?\s*(?:Merke|Take-Home)\s*:?\s*(?:<\/(?:strong|b)>)?\s*:?\s*/i.test(rawHtml) && /^(?:<(?:strong|b)[^>]*>)?\s*(?:Merke|Take-Home)\s*:/i.test(rawHtml.replace(/<\/?(?:strong|b)[^>]*>/gi, ''))) {
                modifier = 'sm-merke';
                badgeTitle = '📘 Merke';
                cleanedHtml = rawHtml.replace(/^(?:<(?:strong|b)[^>]*>)?\s*(?:Merke|Take-Home)\s*:?\s*(?:<\/(?:strong|b)>)?\s*:?\s*/i, '');
            } else if (/^(?:<(?:strong|b)[^>]*>)?\s*(?:Cave|Red Flag|Achtung)\s*:/i.test(rawHtml.replace(/<\/?(?:strong|b)[^>]*>/gi, ''))) {
                modifier = 'sm-cave';
                badgeTitle = '⚠️ Cave / Red Flag';
                cleanedHtml = rawHtml.replace(/^(?:<(?:strong|b)[^>]*>)?\s*(?:Cave|Red Flag|Achtung)\s*:?\s*(?:<\/(?:strong|b)>)?\s*:?\s*/i, '');
            } else if (/^(?:<(?:strong|b)[^>]*>)?\s*(?:Klinik-Perle|Clinical Pearl|Praxis-Tipp)\s*:/i.test(rawHtml.replace(/<\/?(?:strong|b)[^>]*>/gi, ''))) {
                modifier = 'sm-pearl';
                badgeTitle = '💡 Klinische Perle';
                cleanedHtml = rawHtml.replace(/^(?:<(?:strong|b)[^>]*>)?\s*(?:Klinik-Perle|Clinical Pearl|Praxis-Tipp)\s*:?\s*(?:<\/(?:strong|b)>)?\s*:?\s*/i, '');
            }

            if (modifier) {
                const box = document.createElement('div');
                box.className = `sm-callout-box ${modifier} cornell-inline-callout`;
                box.innerHTML = `
                    <div class="sm-callout-header"><span class="sm-callout-badge">${badgeTitle}</span></div>
                    <div class="sm-callout-body">${cleanedHtml}</div>
                `;
                p.replaceWith(box);
            } else {
                p.classList.add('sm-upgraded');
            }
        });
    }

    /**
     * Wendet Callout-Upgrades + klinisches Auto-Bolding auf einen einzelnen HTML-Block an.
     */
    function polishProseBlockHtml(blockHtml, dynamicTerms) {
        if (!blockHtml) return '';

        const container = document.createElement('div');
        container.innerHTML = blockHtml;

        // 1. Callout-Boxen (Cave/Merke/Klinik-Perle) sofort strukturieren
        upgradeInlineCalloutsInElement(container);

        // 2. Prüfen, ob der Haupttext bereits reichhaltig manuell gefettet wurde
        const mainParas = Array.from(container.querySelectorAll('p'));
        const existingBolds = mainParas.reduce((acc, p) => acc + p.querySelectorAll('b, strong').length, 0);
        const totalChars = mainParas.reduce((acc, p) => acc + (p.textContent || '').trim().length, 0);
        const boldChars = mainParas.reduce((acc, p) => {
            return acc + Array.from(p.querySelectorAll('b, strong')).reduce((s, el) => s + (el.textContent || '').length, 0);
        }, 0);
        const hasRichManualBolding = existingBolds >= 3 || (totalChars > 0 && (boldChars / totalChars) >= 0.14);

        const processSubtree = (rootNode) => {
            const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let node;
            while ((node = walker.nextNode())) {
                if (!node.nodeValue || !node.nodeValue.trim()) continue;
                const parent = node.parentElement;
                if (!parent) continue;
                if (parent.closest('b, strong, button, a, mark, script, style, code, .med-term-highlight, .sm-callout-badge, .sm-deep-dive-trigger')) {
                    continue;
                }
                textNodes.push(node);
            }
            textNodes.forEach(tn => autoBoldTextNode(tn, dynamicTerms));
        };

        if (!hasRichManualBolding) {
            mainParas.forEach(processSubtree);
        }

        // Callout-Texte & Deep-Dive-Inhalte ebenfalls anreichern, falls sie noch kein <b>/<strong> haben
        container.querySelectorAll('.sm-callout-body, .sm-deep-dive-content').forEach(sub => {
            if (sub.querySelectorAll('b, strong').length === 0) {
                processSubtree(sub);
            }
        });

        return container.innerHTML;
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
                min-width: 195px;
                max-width: 250px;
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

            .cornell-mode-btn.is-active {
                background: var(--badge-primary-bg, rgba(56, 189, 248, 0.18)) !important;
                border-color: var(--accent-cyan, #38bdf8) !important;
                color: var(--accent-cyan, #38bdf8) !important;
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
                padding: 6px 10px;
                border-radius: 9px;
                background: rgba(15, 23, 42, 0.45);
                border: 1px solid rgba(148, 163, 184, 0.18);
                color: var(--text-main, #f8fafc);
                font-size: 0.83rem;
                font-weight: 700;
                line-height: 1.42;
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
                line-height: 1.74;
                color: var(--text-secondary, #cbd5e1);
                border-left: 3px solid transparent;
                transition: border-color 0.18s ease, background-color 0.18s ease;
                position: relative;
            }
            html[data-theme="daylight"] .cornell-sync-note-col,
            html[data-theme="tropical"] .cornell-sync-note-col {
                color: var(--text-secondary, #334155);
            }

            /* Starke visuelle Hierarchie: Fließtext ruhig, wichtige Fakten kristallklar fett */
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
            .cornell-prose-flow b,
            .cornell-prose-flow strong {
                font-weight: 700;
                color: #ffffff;
            }
            html[data-theme="daylight"] .cornell-prose-flow b,
            html[data-theme="daylight"] .cornell-prose-flow strong,
            html[data-theme="tropical"] .cornell-prose-flow b,
            html[data-theme="tropical"] .cornell-prose-flow strong {
                color: #0f172a;
            }

            .cornell-sync-row.is-row-hovered .cornell-sync-note-col,
            .cornell-sync-row.is-row-pinned .cornell-sync-note-col {
                border-left-color: var(--accent-cyan, #38bdf8);
                background: rgba(56, 189, 248, 0.04);
            }

            /* Inline-Callouts (Cave / Merke / Klinik-Perle) */
            .cornell-inline-callout {
                margin: 10px 0;
                padding: 10px 14px;
                border-radius: 10px;
                border-left: 3px solid var(--accent-cyan, #38bdf8);
                background: rgba(56, 189, 248, 0.08);
                font-size: 0.89rem;
                line-height: 1.62;
            }
            .cornell-inline-callout:first-child {
                margin-top: 0;
            }
            .cornell-inline-callout:last-child {
                margin-bottom: 0;
            }
            .cornell-inline-callout.sm-cave {
                border-left-color: #ef4444;
                background: rgba(239, 68, 68, 0.1);
            }
            .cornell-inline-callout.sm-pearl {
                border-left-color: #10b981;
                background: rgba(16, 185, 129, 0.1);
            }
            .cornell-inline-callout .sm-callout-header {
                margin-bottom: 4px;
            }
            .cornell-inline-callout .sm-callout-badge {
                font-size: 0.72rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            .cornell-inline-callout.sm-cave .sm-callout-badge { color: #fca5a5; }
            .cornell-inline-callout.sm-merke .sm-callout-badge { color: #7dd3fc; }
            .cornell-inline-callout.sm-pearl .sm-callout-badge { color: #6ee7b7; }
            html[data-theme="daylight"] .cornell-inline-callout.sm-cave .sm-callout-badge,
            html[data-theme="tropical"] .cornell-inline-callout.sm-cave .sm-callout-badge { color: #b91c1c; }
            html[data-theme="daylight"] .cornell-inline-callout.sm-merke .sm-callout-badge,
            html[data-theme="tropical"] .cornell-inline-callout.sm-merke .sm-callout-badge { color: #1e40af; }
            html[data-theme="daylight"] .cornell-inline-callout.sm-pearl .sm-callout-badge,
            html[data-theme="tropical"] .cornell-inline-callout.sm-pearl .sm-callout-badge { color: #065f46; }

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

            /* MODUS 1: Ganzen Text abdecken (Active Recall) */
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

            /* MODUS 2: Lückentext-Drill (nur Schlüsselbegriffe abdecken, einzeln anklickbar) */
            .cornell-cloze-active .cornell-prose-flow b:not(.cloze-revealed),
            .cornell-cloze-active .cornell-prose-flow strong:not(.cloze-revealed) {
                background: rgba(56, 189, 248, 0.2);
                border: 1px dashed rgba(56, 189, 248, 0.55);
                border-radius: 5px;
                padding: 0 5px;
                color: transparent !important;
                text-shadow: 0 0 8px rgba(148, 163, 184, 0.65);
                cursor: pointer;
                user-select: none;
                transition: all 0.16s ease;
            }
            .cornell-cloze-active .cornell-prose-flow b.cloze-revealed,
            .cornell-cloze-active .cornell-prose-flow strong.cloze-revealed {
                background: rgba(16, 185, 129, 0.16);
                border-radius: 4px;
                padding: 0 3px;
                cursor: pointer;
                transition: all 0.16s ease;
            }
            html[data-theme="daylight"] .cornell-cloze-active .cornell-prose-flow b:not(.cloze-revealed),
            html[data-theme="daylight"] .cornell-cloze-active .cornell-prose-flow strong:not(.cloze-revealed),
            html[data-theme="tropical"] .cornell-cloze-active .cornell-prose-flow b:not(.cloze-revealed),
            html[data-theme="tropical"] .cornell-cloze-active .cornell-prose-flow strong:not(.cloze-revealed) {
                background: rgba(3, 105, 161, 0.14);
                border-color: rgba(3, 105, 161, 0.45);
                text-shadow: 0 0 8px rgba(15, 23, 42, 0.45);
            }

            /* Such-Markierung */
            .cornell-search-mark {
                background: rgba(250, 204, 21, 0.34);
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
     */
    function extractLeadingHeading(blockHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = blockHtml;
        const container = tmp.querySelector('p, li, h3, h4, div') || tmp;
        const firstElem = container.firstElementChild;

        if (firstElem && (firstElem.tagName === 'B' || firstElem.tagName === 'STRONG')) {
            const rawHeading = firstElem.textContent.replace(/[:–—-]+$/, '').trim();
            if (rawHeading.length >= 2 && rawHeading.length <= 80 && !CALLOUT_PREFIX_REGEX.test(rawHeading)) {
                return rawHeading;
            }
        }

        const plain = stripHtml(blockHtml);
        const colonIdx = plain.indexOf(':');
        if (colonIdx >= 3 && colonIdx <= 75) {
            const candidate = plain.slice(0, colonIdx).trim();
            if (candidate && !/[.!?]/.test(candidate) && !CALLOUT_PREFIX_REGEX.test(candidate)) {
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
     * sauber in <p>-Struktur (die führende Überschrift wird nach dem Cue-Matching entfernt, falls redundant).
     */
    function formatPlainProseChunkToHtml(chunkText) {
        const clean = String(chunkText || '').trim();
        if (!clean) return '';

        if (/<[a-z][\s\S]*>/i.test(clean)) {
            return /^<p\b/i.test(clean) ? clean : `<p>${clean}</p>`;
        }

        // Inline-Callouts ("Merke:", "Cave:", "Klinik-Perle:") als eigene Absätze absetzen
        const parts = clean
            .replace(/([.!?])\s*(?=(?:Merke|Cave|Klinik-Perle|Clinical Pearl|Red Flag)\s*:)/gi, '$1\u0000')
            .split('\u0000')
            .map(p => p.trim())
            .filter(Boolean);

        return parts.map((part, idx) => {
            const escaped = escapeSafe(part);
            if (idx === 0) {
                const colonIdx = part.indexOf(':');
                if (colonIdx >= 3 && colonIdx <= 75 && !/[.!?]/.test(part.slice(0, colonIdx))) {
                    const candidate = part.slice(0, colonIdx).trim();
                    if (!CALLOUT_PREFIX_REGEX.test(candidate)) {
                        const head = escapeSafe(part.slice(0, colonIdx + 1));
                        const rest = escapeSafe(part.slice(colonIdx + 1));
                        return `<p><b>${head}</b>${rest}</p>`;
                    }
                }
            }
            return `<p>${escaped}</p>`;
        }).join('');
    }

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
                i++;
            } else {
                merged.push(curr);
            }
        }
        return merged;
    }

    function parseNoteIntoProseBlocks(rawNotesHtml, cuesList = []) {
        let html = sanitizeEditorialHtml(rawNotesHtml).trim();
        if (!html) return [];

        const hasHtmlTags = /<[a-z][\s\S]*>/i.test(html);

        // FALL A: Reiner Plain-Text
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

        // FALL B: HTML-Inhalte (inkl. Legacy <br><br>)
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

        // Safari-sicher (ohne Lookbehind) an Fett-Überschriften aufteilen
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
     * Verknüpft die linken Titel (Cues) semantisch 1:1 mit den rechten Absätzen,
     * entfernt doppelte Titel-Wiederholungen und hebt klinische Kerninhalte fett hervor.
     */
    function buildAlignedPairsForEntry(noteEntry, dynamicTerms) {
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

        const pairs = blocks.map((block, bIdx) => {
            const finalCue = assignedCueForBlock[bIdx] || deriveFallbackTitleFromBlock(block);
            // 1. Redundanten führenden Titel im Fließtext entfernen
            const dedupedHtml = stripRedundantLeadingTitle(block.html, finalCue);
            // 2. Callouts strukturieren + wichtige klinische Fakten fett hervorheben
            const polishedHtml = polishProseBlockHtml(dedupedHtml, dynamicTerms);
            return {
                cue: finalCue,
                html: polishedHtml,
                plainText: stripHtml(polishedHtml)
            };
        });

        const remainingCues = rawCues.filter((_, idx) => !usedCues.has(idx));
        if (remainingCues.length > 0 && pairs.length > 0) {
            pairs[pairs.length - 1].extraCues = remainingCues;
        }

        return pairs;
    }

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

    function computeAllPairs(data, caseObj) {
        const dynamicTerms = buildDynamicCaseTerms(caseObj);
        const allPairs = [];
        if (Array.isArray(data?.cornell_notes)) {
            data.cornell_notes.forEach(entry => {
                allPairs.push(...buildAlignedPairsForEntry(entry, dynamicTerms));
            });
        }
        return allPairs;
    }

    function syncHeaderModeButtons(container) {
        const clozeBtn = container.querySelector('#btn-toggle-cornell-cloze');
        const recallBtn = container.querySelector('#btn-toggle-cornell-recall');
        if (clozeBtn) {
            clozeBtn.classList.toggle('is-active', studyMode === 'cloze');
            clozeBtn.textContent = studyMode === 'cloze' ? '👁️ Lücken zeigen' : '🧩 Lückentext';
        }
        if (recallBtn) {
            recallBtn.classList.toggle('is-active', studyMode === 'recall');
            recallBtn.textContent = studyMode === 'recall' ? '👁️ Text zeigen' : '🧠 Text abdecken';
        }
    }

    function renderSheetContent(container, allPairs, caseObj) {
        const tocHost = container.querySelector('#cornell-toc-host');
        const recallBarHost = container.querySelector('#cornell-recall-bar-host');
        const sheetHost = container.querySelector('#cornell-sync-sheet');
        const rootEl = container.querySelector('#cornell-sheet-root');
        const clearBtn = container.querySelector('#cornell-search-clear-btn');
        if (!sheetHost || !rootEl) return;

        rootEl.classList.toggle('cornell-recall-active', studyMode === 'recall');
        rootEl.classList.toggle('cornell-cloze-active', studyMode === 'cloze');
        syncHeaderModeButtons(container);

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

        // 1. Modus-Fortschrittsleiste
        if (recallBarHost) {
            if (studyMode === 'recall' && visibleEntries.length > 0) {
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
            } else if (studyMode === 'cloze' && visibleEntries.length > 0) {
                recallBarHost.innerHTML = `
                    <div class="cornell-recall-status-bar">
                        <span>🧩 <strong>Lückentext aktiv:</strong> Klicke einzelne abgedeckte Schlüsselbegriffe an, um dein Faktenwissen gezielt zu prüfen.</span>
                        <button type="button" class="ghost-tool-btn" id="btn-cornell-cloze-reveal-all" style="font-size:0.72rem; padding:3px 9px;">
                            👁️ Alle Lücken aufdecken
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

        if (qLower.length >= 2) {
            highlightSearchInElement(sheetHost, filterQuery);
        }

        bindSheetInteractions(container, allPairs, visibleEntries, caseObj);
    }

    function bindSheetInteractions(container, allPairs, visibleEntries, caseObj) {
        const rows = Array.from(container.querySelectorAll('.cornell-sync-row'));

        const toggleRowRecall = (row, origIdx) => {
            if (studyMode !== 'recall') return;
            if (revealedRowsSet.has(origIdx)) {
                revealedRowsSet.delete(origIdx);
                row.classList.remove('is-row-revealed');
            } else {
                revealedRowsSet.add(origIdx);
                row.classList.add('is-row-revealed');
            }
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(7);

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

            row.addEventListener('mouseenter', () => row.classList.add('is-row-hovered'));
            row.addEventListener('mouseleave', () => row.classList.remove('is-row-hovered'));

            cueItems.forEach(cueItem => {
                cueItem.addEventListener('click', () => {
                    if (studyMode === 'recall') {
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

            if (revealBtn) {
                revealBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleRowRecall(row, origIdx);
                });
            }

            if (noteCol) {
                noteCol.addEventListener('click', (e) => {
                    // Im Lückentext-Modus einzelne Schlüsselbegriffe aufdecken/zudecken
                    if (studyMode === 'cloze') {
                        const boldEl = e.target.closest('.cornell-prose-flow b, .cornell-prose-flow strong');
                        if (boldEl) {
                            e.stopPropagation();
                            boldEl.classList.toggle('cloze-revealed');
                            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(5);
                        }
                        return;
                    }
                    if (studyMode !== 'recall') return;
                    if (e.target.closest('button, a, .sm-deep-dive-card, .med-term-highlight')) return;
                    if (!revealedRowsSet.has(origIdx)) {
                        toggleRowRecall(row, origIdx);
                    }
                });
            }
        });

        // Alle Zeilen aufdecken (Recall-Modus)
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

        // Alle Lücken aufdecken/zudecken (Cloze-Modus)
        const clozeAllBtn = container.querySelector('#btn-cornell-cloze-reveal-all');
        if (clozeAllBtn) {
            clozeAllBtn.addEventListener('click', () => {
                const allBolds = Array.from(container.querySelectorAll('.cornell-prose-flow b, .cornell-prose-flow strong'));
                const anyHidden = allBolds.some(el => !el.classList.contains('cloze-revealed'));
                allBolds.forEach(el => el.classList.toggle('cloze-revealed', anyHidden));
                clozeAllBtn.textContent = anyHidden ? '🙈 Alle Lücken abdecken' : '👁️ Alle Lücken aufdecken';
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
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

        const currentCaseId = caseObj.case_id || caseObj.id || '__unknown__';
        if (lastRenderedCaseId !== currentCaseId) {
            lastRenderedCaseId = currentCaseId;
            filterQuery = '';
            revealedRowsSet = new Set();
        }

        const allPairs = computeAllPairs(data, caseObj);
        const dynamicTerms = buildDynamicCaseTerms(caseObj);
        const summaryHtml = polishProseBlockHtml(`<p>${escapeSafe(data.summary || 'Keine Zusammenfassung hinterlegt.')}</p>`, dynamicTerms);

        const topicTitle = window.isSpecialtyBlindMode
            ? 'Klinisches Krankheitsbild (Blind-Training)'
            : (data.topic || 'Thematische Übersicht');

        container.innerHTML = `
            <div class="cornell-wrapper ${studyMode === 'recall' ? 'cornell-recall-active' : ''} ${studyMode === 'cloze' ? 'cornell-cloze-active' : ''}" id="cornell-sheet-root">
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
                                    class="ghost-tool-btn cornell-mode-btn ${studyMode === 'cloze' ? 'is-active' : ''}"
                                    id="btn-toggle-cornell-cloze"
                                    style="font-size:0.75rem; padding:6px 11px;"
                                    title="Deckt nur die fett markierten Schlüsselbegriffe als Lückentext ab">
                                ${studyMode === 'cloze' ? '👁️ Lücken zeigen' : '🧩 Lückentext'}
                            </button>
                            <button type="button"
                                    class="ghost-tool-btn cornell-mode-btn ${studyMode === 'recall' ? 'is-active' : ''}"
                                    id="btn-toggle-cornell-recall"
                                    style="font-size:0.75rem; padding:6px 11px;"
                                    title="Blendet den gesamten Fließtext rechts aus, um dich anhand der linken Titel abzufragen">
                                ${studyMode === 'recall' ? '👁️ Text zeigen' : '🧠 Text abdecken'}
                            </button>
                        </div>
                    </div>
                </div>

                <div id="cornell-recall-bar-host"></div>
                <div id="cornell-toc-host"></div>
                <div class="cornell-body cornell-sync-sheet" id="cornell-sync-sheet"></div>

                <div class="cornell-summary">
                    <div class="cornell-summary-badge">Take-Home Message (Synthese)</div>
                    <div class="cornell-prose-flow">${summaryHtml}</div>
                </div>
            </div>
        `;

        const searchInput = container.querySelector('#cornell-live-search-input');
        const clearBtn = container.querySelector('#cornell-search-clear-btn');
        const clozeBtn = container.querySelector('#btn-toggle-cornell-cloze');
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

        if (clozeBtn) {
            clozeBtn.addEventListener('click', () => {
                studyMode = (studyMode === 'cloze') ? 'normal' : 'cloze';
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
                renderSheetContent(container, allPairs, caseObj);
            });
        }

        if (recallBtn) {
            recallBtn.addEventListener('click', () => {
                studyMode = (studyMode === 'recall') ? 'normal' : 'recall';
                if (studyMode === 'recall') {
                    revealedRowsSet = new Set();
                }
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
                renderSheetContent(container, allPairs, caseObj);
            });
        }

        renderSheetContent(container, allPairs, caseObj);
    }

    function resetState() {
        filterQuery = '';
        revealedRowsSet = new Set();
        studyMode = 'normal';
    }

    return { render, resetState };
})();

window.CornellNotesModule = CornellNotesModule;
window.renderOverview = CornellNotesModule.render;
