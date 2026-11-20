/**
 * js/specialty.js - Lernen nach Fachrichtung (Strikte Überordner-Architektur)
 * Gruppiert alle Unterthemen in ihre Überordner (z. B. "Nervensystem und Sinnesorgane",
 * "Psyche / Ethik / Recht", "Reproduktion", "Allgemein" + eigene Überordner),
 * fragt beim Starten ALLE darin enthaltenen Themen in zufälliger Reihenfolge ab
 * und synchronisiert die Überordner live mit dem Mindmap-Labor (window.MEDCHECK_DASHBOARD_FOLDERS).
 */

(function () {
    'use strict';

    const SPECIALTY_STORAGE_KEY = 'medcheck_specialty_progress';

    const specialtySession = {
        field: null,       // Name des aktiven Überordners (oder "__ALL_SUPER_FOLDERS__" bei Gesamt-Rotation)
        queue: [],         // Zufällige Queue aller noch zu lösenden case_ids dieses Überordners
        totalCount: 0,     // Gesamtzahl der Fälle im Überordner für diesen Durchlauf
        currentIndex: 0,   // Aktuelle Position (1-basiert für UI)
        currentId: null,   // Aktuelle case_id
        recorded: false
    };

    // Styling- & Keyword-Regeln für die Standard- und typische eigene Überordner (Sync mit mindmap.js)
    const SUPER_FOLDER_STYLE_RULES = [
        {
            match: ['nervensystem', 'sinnesorgane', 'neuro'],
            icon: '🧠',
            color: '#8b5cf6',
            keywords: [
                '29.2.', 'neuro', 'nerv', 'sinnes', 'auge', 'ophthal', 'hno', 'hals-nasen', 'ohr',
                'myelon', 'rückenmark', 'hirn', 'hydrocephalus', 'hydrozephalus', 'liquor',
                'anfallsleiden', 'epilep', 'bewegungsstörung', 'parkinson', 'demenz',
                'infektionen des zentralen', 'tumore', 'schwindel', 'kopfschmerz', 'stroke', 'cjk', 'ftd', 'lbd'
            ]
        },
        {
            match: ['psyche', 'ethik', 'recht', 'forens'],
            icon: '⚖️',
            color: '#6366f1',
            keywords: [
                '0.30.', 'psych', 'ethik', 'recht', 'forens', 'rechtsmedizin', 'toxikologie',
                'leichenschau', 'dna', 'sucht', 'schizophren', 'neurotisch', 'anpassung',
                'affektiv', 'persönlichkeits', 'suizid'
            ]
        },
        {
            match: ['reproduktion', 'gyn', 'geburt'],
            icon: '🧬',
            color: '#ec4899',
            keywords: [
                'repro', 'gyn', 'geburt', 'schwanger', 'fertilit', 'zyklus', 'ovari', 'uterus', 'mamma'
            ]
        },
        {
            match: ['kardio', 'herz', 'kreislauf', 'gefäss', 'gefaess'],
            icon: '🫀',
            color: '#ef4444',
            keywords: ['kardio', 'herz', 'kreislauf', 'stemi', 'acs', 'ekg', 'gefäss', 'angiologie']
        },
        {
            match: ['pneumo', 'lunge', 'atemweg', 'thorax'],
            icon: '🫁',
            color: '#06b6d4',
            keywords: ['pneumo', 'lunge', 'lae', 'embolie', 'asthma', 'copd', 'thorax']
        },
        {
            match: ['hämato', 'haemato', 'onko', 'blut'],
            icon: '🩸',
            color: '#e11d48',
            keywords: ['hämato', 'haemato', 'onko', 'lymph', 'leukämie', 'anämie', 'gerinnung']
        },
        {
            match: ['gastro', 'verdauung', 'leber', 'viszeral'],
            icon: '🩺',
            color: '#f59e0b',
            keywords: ['gastro', 'leber', 'hepato', 'darm', 'pankreas', 'magen', 'viszeral']
        },
        {
            match: ['nephro', 'niere', 'uro'],
            icon: '💧',
            color: '#3b82f6',
            keywords: ['nephro', 'niere', 'uro', 'elektrolyt', 'säure-basen']
        },
        {
            match: ['endokrin', 'stoffwechsel', 'hormon'],
            icon: '⚗️',
            color: '#10b981',
            keywords: ['endokrin', 'diabetes', 'schilddrüse', 'hormon', 'stoffwechsel']
        },
        {
            match: ['infekt', 'immun', 'rheuma'],
            icon: '🦠',
            color: '#22c55e',
            keywords: ['infekt', 'immun', 'sepsis', 'mikrobio', 'rheuma', 'autoimmun']
        },
        {
            match: ['chirurg', 'ortho', 'trauma', 'bewegungsapparat'],
            icon: '🦴',
            color: '#f97316',
            keywords: ['chirurg', 'ortho', 'trauma', 'fraktur', 'unfall', 'bewegungsapparat']
        },
        {
            match: ['notfall', 'intensiv', 'anästhes', 'anaesthes'],
            icon: '🚑',
            color: '#dc2626',
            keywords: ['notfall', 'intensiv', 'anästhesie', 'schock', 'reanimation']
        },
        {
            match: ['pharma', 'medikament'],
            icon: '💊',
            color: '#14b8a6',
            keywords: ['pharma', 'medikament', 'wirkstoff', 'antibiotika']
        },
        {
            match: ['pädiatr', 'paediatr', 'kind'],
            icon: '🧸',
            color: '#38bdf8',
            keywords: ['pädiatr', 'kind', 'säugling', 'neonat']
        },
        {
            match: ['derma', 'haut'],
            icon: '🩹',
            color: '#fb7185',
            keywords: ['derma', 'haut', 'ekzem', 'exanthem']
        }
    ];

    let manualDashboardFoldersOverride = null;

    // ============================================================================
    // 1. SPEICHER & PERSISTENZ
    // ============================================================================
    const SpecialtyStore = {
        getAll() {
            try {
                const data = JSON.parse(localStorage.getItem(SPECIALTY_STORAGE_KEY));
                return data && typeof data === 'object' ? data : {};
            } catch (_e) {
                return {};
            }
        },
        get(field) {
            const e = this.getAll()[field] || {};
            return {
                completedCaseIds: Array.isArray(e.completedCaseIds) ? e.completedCaseIds : [],
                totalScore: e.totalScore || 0,
                lastPlayed: e.lastPlayed || null
            };
        },
        save(field, entry) {
            const all = this.getAll();
            all[field] = entry;
            try {
                localStorage.setItem(SPECIALTY_STORAGE_KEY, JSON.stringify(all));
            } catch (e) {
                console.error('Specialty-Progress Schreibfehler:', e);
            }
            if (window.Cloud && typeof window.Cloud.scheduleProgressSync === 'function') {
                window.Cloud.scheduleProgressSync();
            }
        },
        resetCompleted(field) {
            const e = this.get(field);
            this.save(field, { ...e, completedCaseIds: [] });
        }
    };

    // ============================================================================
    // 2. HELPER & ÜBERORDNER-AUFLÖSUNG (DIREKT AUS LOCALSTORAGE & APP-STATE)
    // ============================================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    /**
     * Sicheres Escaping für Strings innerhalb von inline onclick="fn('...')"-Attributen
     * (verhindert SyntaxError bei Apostrophen, Backslashes oder Anführungszeichen im Ordnernamen).
     */
    function escapeInlineJsArg(str) {
        return String(str || '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '')
            .replace(/\n/g, ' ')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function normalizeFolderSlug(str) {
        return String(str || '')
            .trim()
            .toLowerCase()
            .replace(/ä/g, 'ae')
            .replace(/ö/g, 'oe')
            .replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    /**
     * Liest alle existierenden Überordner in der korrekten Dashboard-Reihenfolge aus
     */
    function getActiveSuperFoldersList() {
        const defaults = [
            'Nervensystem und Sinnesorgane',
            'Psyche / Ethik / Recht',
            'Reproduktion',
            'Allgemein'
        ];

        let rawList = null;
        if (typeof window.getSuperFolderOrder === 'function') {
            try {
                const fromApp = window.getSuperFolderOrder();
                if (Array.isArray(fromApp) && fromApp.length > 0) {
                    rawList = fromApp;
                }
            } catch (_e) {}
        }

        if (!rawList) {
            try {
                const savedOrder = JSON.parse(localStorage.getItem('medcheck_super_folder_order_v1') || 'null');
                if (Array.isArray(savedOrder) && savedOrder.length > 0) {
                    rawList = savedOrder;
                }
            } catch (_e) {}
        }

        const list = (rawList || defaults)
            .map(s => String(s || '').trim())
            .filter(Boolean);

        return Array.from(new Set(list.length > 0 ? list : defaults));
    }

    /**
     * Ordnet jeden Unterordner / jedes Thema zuverlässig seinem Überordner zu.
     * Berücksichtigt: 1. Manuelle Drag&Drop-Zuweisung, 2. Direkter Treffer, 3. Klinik-Heuristik, 4. App-Fallback.
     */
    function getSuperFolderForSubTopic(subTopicName) {
        if (!subTopicName) return 'Allgemein';
        const clean = String(subTopicName).trim();
        const availableSupers = getActiveSuperFoldersList();

        // 1. Vom Nutzer gespeicherte Zuordnung aus dem Dashboard prüfen
        try {
            const mapping = JSON.parse(localStorage.getItem('medcheck_folder_super_mapping') || '{}');
            if (mapping[clean] && availableSupers.includes(mapping[clean])) {
                return mapping[clean];
            }
        } catch (_e) {}

        // 2. Direkter Treffer, falls der Ordner bereits wie ein Überordner heißt
        const directMatch = availableSupers.find(s => s.toLowerCase() === clean.toLowerCase());
        if (directMatch) return directMatch;

        // 3. Erweiterte medizinische Heuristik (inkl. Basler Vorlesungs-Präfixe 29.2.x & 0.30.x)
        const lower = clean.toLowerCase();

        if (
            lower.includes('0.30.') || lower.includes('psych') || lower.includes('ethik') ||
            lower.includes('recht') || lower.includes('forens') || lower.includes('sucht') ||
            lower.includes('schizophren') || lower.includes('neurotisch') || lower.includes('anpassung') ||
            lower.includes('affektiv') || lower.includes('persönlichkeits') || lower.includes('suizid')
        ) {
            return availableSupers.includes('Psyche / Ethik / Recht') ? 'Psyche / Ethik / Recht' : 'Allgemein';
        }

        if (
            lower.includes('29.2.') || lower.includes('neuro') || lower.includes('nerv') ||
            lower.includes('sinnes') || lower.includes('auge') || lower.includes('ophthal') ||
            lower.includes('hno') || lower.includes('hals-nasen') || lower.includes('ohr') ||
            lower.includes('myelon') || lower.includes('rückenmark') || lower.includes('hirn') ||
            lower.includes('hydrocephal') || lower.includes('hydrozephal') || lower.includes('liquor') ||
            lower.includes('anfallsleiden') || lower.includes('epilep') || lower.includes('bewegungsstörung') ||
            lower.includes('parkinson') || lower.includes('demenz') || lower.includes('infektionen des zentralen') ||
            lower.includes('tumore') || lower.includes('schwindel') || lower.includes('kopfschmerz')
        ) {
            return availableSupers.includes('Nervensystem und Sinnesorgane') ? 'Nervensystem und Sinnesorgane' : 'Allgemein';
        }

        if (
            lower.includes('repro') || lower.includes('gyn') || lower.includes('geburt') ||
            lower.includes('schwanger') || lower.includes('fertilit') || lower.includes('zyklus') ||
            lower.includes('ovari') || lower.includes('uterus') || lower.includes('mamma')
        ) {
            return availableSupers.includes('Reproduktion') ? 'Reproduktion' : 'Allgemein';
        }

        // 4. Fallback auf globale Funktion aus app.js (falls vorhanden)
        if (typeof window.getSuperFolderForCategory === 'function') {
            return window.getSuperFolderForCategory(clean);
        }

        return 'Allgemein';
    }

    function resolveSubTopicForCase(caseObj) {
        if (!caseObj) return 'Allgemein';
        return (caseObj.folder_name || caseObj.metadata?.medical_field || caseObj.medical_field || 'Allgemein').trim();
    }

    function resolveSuperFolderForCase(caseObj) {
        if (!caseObj) return 'Allgemein';
        const subTopic = resolveSubTopicForCase(caseObj);
        return getSuperFolderForSubTopic(subTopic);
    }

    // ============================================================================
    // 2B. 100%-SYNCHRONISATION DER DASHBOARD-ORDNER FÜR MINDMAP.JS (V7.1+)
    // ============================================================================
    function getMindmapFolderIdForSuperTitle(superTitle) {
        const clean = String(superTitle || '').trim();
        // 'Allgemein' auf 'sonstige' mappen, damit mindmap.js exakt diesen Ordner
        // als Auffangordner nutzt und keinen doppelten "Allgemein & Weitere Fächer"-Ordner erzeugt.
        if (clean.toLowerCase() === 'allgemein') return 'sonstige';
        return normalizeFolderSlug(clean) || 'sonstige';
    }

    function getStyleMetaForSuperFolder(superTitle) {
        const lower = String(superTitle || '').toLowerCase();
        if (lower === 'allgemein') {
            return { icon: '📂', color: '#94a3b8', keywords: [] };
        }
        const matched = SUPER_FOLDER_STYLE_RULES.find(rule =>
            rule.match.some(token => lower.includes(token))
        );
        if (matched) {
            return { icon: matched.icon, color: matched.color, keywords: [...matched.keywords] };
        }
        return { icon: '📁', color: '#38bdf8', keywords: [lower] };
    }

    /**
     * Erzeugt live das exakte Ordner-Array im Format von js/mindmap.js:
     * [{ id, label, icon, color, keywords, orderIndex }]
     * Inklusive aller Unterthemen aus Dashboard-Mapping & registrierten Fällen als Auto-Sortier-Keywords.
     */
    function buildDashboardFoldersForMindmap() {
        if (Array.isArray(manualDashboardFoldersOverride) && manualDashboardFoldersOverride.length > 0) {
            return manualDashboardFoldersOverride;
        }

        const superFolders = getActiveSuperFoldersList();
        const extraKeywordsBySuper = new Map();
        superFolders.forEach(s => extraKeywordsBySuper.set(s, new Set()));

        // 1. Manuelle Unterordner -> Überordner Zuordnungen aus dem Dashboard als Keywords übernehmen
        try {
            const mapping = JSON.parse(localStorage.getItem('medcheck_folder_super_mapping') || '{}');
            if (mapping && typeof mapping === 'object') {
                Object.entries(mapping).forEach(([subTopic, superName]) => {
                    if (extraKeywordsBySuper.has(superName) && subTopic) {
                        extraKeywordsBySuper.get(superName).add(String(subTopic).trim().toLowerCase());
                    }
                });
            }
        } catch (_e) {}

        // 2. Unterthemen aus allen aktuell registrierten Fällen als zusätzliche Keywords aufnehmen
        const allCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        allCases.forEach(c => {
            const sTitle = resolveSuperFolderForCase(c);
            const subTopic = resolveSubTopicForCase(c);
            if (extraKeywordsBySuper.has(sTitle) && subTopic && subTopic.toLowerCase() !== 'allgemein') {
                extraKeywordsBySuper.get(sTitle).add(subTopic.toLowerCase());
            }
        });

        const seenIds = new Set();
        return superFolders.map((superTitle, idx) => {
            let id = getMindmapFolderIdForSuperTitle(superTitle);
            if (seenIds.has(id)) {
                id = `${id}_${idx + 1}`;
            }
            seenIds.add(id);

            const styleMeta = getStyleMetaForSuperFolder(superTitle);
            const dynamicKws = Array.from(extraKeywordsBySuper.get(superTitle) || []);
            const combinedKeywords = id === 'sonstige'
                ? []
                : Array.from(new Set([
                    superTitle.toLowerCase(),
                    ...styleMeta.keywords,
                    ...dynamicKws
                ])).filter(Boolean);

            return {
                id,
                label: superTitle,
                icon: styleMeta.icon,
                color: styleMeta.color,
                keywords: combinedKeywords,
                orderIndex: idx
            };
        });
    }

    /**
     * Öffnet direkt aus einer Dashboard-Überordner-Karte den passenden Fachordner im Mindmap-Labor
     */
    function openMindmapsForSuperFolder(superTitle) {
        if (!window.MindmapModule || typeof window.MindmapModule.openFolder !== 'function') return;
        const folderId = getMindmapFolderIdForSuperTitle(superTitle);

        if (typeof window.switchTab === 'function') {
            try {
                const mindmapNavBtn = document.querySelector('[data-tab="mindmap"], [onclick*="mindmap"]');
                window.switchTab('mindmap', mindmapNavBtn || undefined);
            } catch (_e) {}
        }
        window.MindmapModule.openFolder(folderId);
    }

    /**
     * Holt ausnahmslos ALLE Fälle, die im gewählten Überordner liegen
     */
    function getSpecialtyCases(superFolderName) {
        const all = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        if (superFolderName === '__ALL_SUPER_FOLDERS__') {
            return all;
        }
        const target = (superFolderName || '').trim();
        return all.filter(c => resolveSuperFolderForCase(c) === target);
    }

    function shuffleFisherYates(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /**
     * Erstellt die zufällige Queue für ALLE Themen innerhalb des gewählten Überordners.
     * Noch nicht gelöste Themen kommen zuerst dran; sind alle gelöst, werden alle frisch gemischt.
     */
    function buildQueue(superFolderName) {
        const allMatching = getSpecialtyCases(superFolderName);
        const allIds = allMatching.map(c => c.case_id).filter(Boolean);
        const doneSet = new Set(SpecialtyStore.get(superFolderName).completedCaseIds.filter(id => allIds.includes(id)));

        const unsolved = shuffleFisherYates(allIds.filter(id => !doneSet.has(id)));
        if (unsolved.length > 0) {
            return unsolved;
        }
        return shuffleFisherYates(allIds);
    }

    // ============================================================================
    // 3. TOP-BUTTONS IM PLAYER ("🔍 Diagnose" & "Nächstes Thema ➔")
    // ============================================================================
    function ensureTopNewCaseButton() {
        const badge = document.getElementById('player-case-badge-title');
        const wrap = badge ? badge.parentElement : null;
        if (!wrap) return;

        wrap.style.display = 'inline-flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';
        wrap.style.flexWrap = 'wrap';

        let revealBtn = document.getElementById('btn-top-reveal-case');
        if (!revealBtn) {
            revealBtn = document.createElement('button');
            revealBtn.id = 'btn-top-reveal-case';
            revealBtn.type = 'button';
            revealBtn.innerHTML = '🔍 Diagnose';
            revealBtn.title = 'Diagnose & Take-Home-Pearl aufdecken';
            revealBtn.style.cssText = 'background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 5px 12px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0;';
            revealBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.revealDiagnosis();
            };
            wrap.appendChild(revealBtn);
        }

        let newBtn = document.getElementById('btn-top-new-case');
        if (!newBtn) {
            newBtn = document.createElement('button');
            newBtn.id = 'btn-top-new-case';
            newBtn.type = 'button';
            newBtn.innerHTML = 'Nächstes Thema ➔';
            newBtn.style.cssText = 'background: #0284c7; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4); flex-shrink: 0;';
            newBtn.onmouseenter = () => newBtn.style.background = '#0369a1';
            newBtn.onmouseleave = () => newBtn.style.background = '#0284c7';
            newBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.nextSpecialtyCase();
            };
            wrap.appendChild(newBtn);
        }

        const showBlindControls = !!window.isSpecialtyBlindMode;
        revealBtn.style.display = showBlindControls ? 'inline-flex' : 'none';
        newBtn.style.display = showBlindControls ? 'inline-flex' : 'none';
    }

    // ============================================================================
    // 4. STEUERUNG DES FACHRICHTUNGS-MODUS (ÜBERORDNER-SESSION)
    // ============================================================================
    function startSpecialty(superFolderName) {
        const cases = getSpecialtyCases(superFolderName);
        if (!cases.length) {
            alert(`Im Überordner "${superFolderName}" befinden sich aktuell noch keine Fälle.`);
            return;
        }

        const validIds = new Set(cases.map(c => c.case_id));
        const completedInSuper = SpecialtyStore.get(superFolderName).completedCaseIds.filter(id => validIds.has(id));

        if (completedInSuper.length >= cases.length) {
            SpecialtyStore.resetCompleted(superFolderName);
        }

        specialtySession.field = superFolderName;
        specialtySession.queue = buildQueue(superFolderName);
        specialtySession.totalCount = specialtySession.queue.length;
        specialtySession.currentIndex = 0;
        specialtySession.currentId = null;
        specialtySession.recorded = false;

        window.isSpecialtyBlindMode = true;
        window.nextSpecialtyCase();
    }

    function nextSpecialtyCase() {
        window.closeRevealModal();

        if (specialtySession.queue && specialtySession.queue.length > 0) {
            const nextId = specialtySession.queue.shift();
            specialtySession.currentIndex++;
            specialtySession.currentId = nextId;
            specialtySession.recorded = false;

            const nextBtn = document.getElementById('btn-top-new-case');
            if (nextBtn) {
                nextBtn.style.background = '#0284c7';
                const remaining = specialtySession.queue.length;
                nextBtn.innerText = remaining > 0
                    ? `Nächstes Thema (${specialtySession.currentIndex}/${specialtySession.totalCount}) ➔`
                    : 'Fachrichtung abschließen ✓';
            }

            if (typeof window.loadCaseById === 'function') {
                window.loadCaseById(nextId, { specialty: true });
            }
            setTimeout(ensureTopNewCaseButton, 50);
            return;
        }

        showSpecialtyFinished();
    }

    function applyBlindHeader(blind, caseData) {
        ensureTopNewCaseButton();

        const badge = document.getElementById('player-case-badge-title');
        const wrap = badge ? badge.parentElement : null;

        if (wrap && wrap.firstChild && wrap.firstChild.nodeType === Node.TEXT_NODE) {
            wrap.firstChild.nodeValue = blind ? 'Überordner: ' : 'Aktiver Fall: ';
        }

        if (badge) {
            if (blind) {
                const rawField = specialtySession.field || resolveSuperFolderForCase(caseData);
                const displayField = rawField === '__ALL_SUPER_FOLDERS__' ? '⚡ Gesamt-Rotation (Alle Fächer)' : rawField;
                const progressText = specialtySession.totalCount > 0
                    ? ` • Fall ${specialtySession.currentIndex}/${specialtySession.totalCount}`
                    : '';
                badge.innerText = `${displayField}${progressText}`;
            } else if (caseData) {
                badge.innerText = caseData.metadata?.title || caseData.case_id || '';
            }
        }

        const overviewTab = document.getElementById('tab-btn-overview');
        if (overviewTab) {
            overviewTab.style.display = blind ? 'none' : '';
        }
    }

    // ============================================================================
    // 5. FORTSCHRITT & REVEAL-MODALS
    // ============================================================================
    function recordSpecialtyCompletion() {
        if (specialtySession.recorded || !window.activeCaseData) return;
        specialtySession.recorded = true;

        const superField = specialtySession.field || resolveSuperFolderForCase(window.activeCaseData);
        if (!superField) return;

        const reward = window.activeCaseData.metadata?.xp_reward || 900;
        const entry = SpecialtyStore.get(superField);

        if (!entry.completedCaseIds.includes(window.activeCaseData.case_id)) {
            entry.completedCaseIds.push(window.activeCaseData.case_id);
        }
        entry.totalScore += reward;
        entry.lastPlayed = new Date().toISOString();
        SpecialtyStore.save(superField, entry);

        if (superField === '__ALL_SUPER_FOLDERS__') {
            const actualSuper = resolveSuperFolderForCase(window.activeCaseData);
            const subEntry = SpecialtyStore.get(actualSuper);
            if (!subEntry.completedCaseIds.includes(window.activeCaseData.case_id)) {
                subEntry.completedCaseIds.push(window.activeCaseData.case_id);
                SpecialtyStore.save(actualSuper, subEntry);
            }
        }
    }

    function onSpecialtyCompletionChange(allCompleted) {
        if (window.isSpecialtyBlindMode && allCompleted) {
            recordSpecialtyCompletion();
            const nextBtn = document.getElementById('btn-top-new-case');
            if (nextBtn) {
                nextBtn.style.background = '#10b981';
                const hasMore = specialtySession.queue && specialtySession.queue.length > 0;
                nextBtn.innerText = hasMore
                    ? `✔ Gelöst! Nächstes Thema (${specialtySession.currentIndex}/${specialtySession.totalCount}) ➔`
                    : '✔ Gelöst! Fachrichtung abschließen 🏆';
            }
        }
    }

    function closeRevealModal() {
        document.getElementById('reveal-modal')?.remove();
    }

    function revealDiagnosis() {
        if (!window.activeCaseData) return;
        const meta = window.activeCaseData.metadata || {};
        const doc = window.activeCaseData.extra_tasks?.doctordle;
        const pearl = (Array.isArray(doc) ? doc[0] : doc)?.learning_pearl || '';
        const summary = window.activeCaseData.case_overview?.summary || '';
        const superField = resolveSuperFolderForCase(window.activeCaseData);
        const subTopic = resolveSubTopicForCase(window.activeCaseData);
        const primary = meta.primary_disease || meta.title || window.activeCaseData.case_id;
        const hasMore = specialtySession.queue && specialtySession.queue.length > 0;

        const modalHtml = `
            <div id="reveal-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.82); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
                <div style="background:#1e293b; border:1px solid #334155; border-radius:14px; max-width:560px; width:100%; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.6); color:#f8fafc;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span style="background:#0284c7; color:#fff; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">📂 ${escapeHtml(superField)}</span>
                            <span style="background:rgba(148,163,184,0.15); color:#cbd5e1; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:600;">📁 ${escapeHtml(subTopic)}</span>
                        </div>
                        <button type="button" onclick="window.closeRevealModal()" style="background:none; border:none; color:#94a3b8; font-size:1.4rem; cursor:pointer;">&times;</button>
                    </div>
                    <span style="color:#94a3b8; font-size:0.78rem; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Entschlüsselte Diagnose:</span>
                    <h2 style="color:#38bdf8; margin:4px 0 8px 0; font-size:1.35rem;">${escapeHtml(primary)}</h2>
                    <p style="color:#cbd5e1; font-size:0.9rem; margin-bottom:16px;">${escapeHtml(meta.title || '')}</p>

                    ${summary ? `
                        <div style="background:#0f172a; padding:12px; border-radius:8px; border-left:3px solid #38bdf8; margin-bottom:14px;">
                            <h4 style="margin:0 0 6px 0; font-size:0.82rem; color:#94a3b8;">Pathophysiologische Synthese:</h4>
                            <p style="margin:0; font-size:0.85rem; line-height:1.45;">${escapeHtml(summary)}</p>
                        </div>
                    ` : ''}

                    ${pearl ? `
                        <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; padding:12px; border-radius:8px; margin-bottom:18px;">
                            <strong style="color:#10b981; font-size:0.85rem;">💡 Klinische Take-Home-Pearl:</strong>
                            <p style="margin:4px 0 0 0; font-size:0.85rem; line-height:1.4;">${escapeHtml(pearl)}</p>
                        </div>
                    ` : ''}

                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button type="button" onclick="window.closeRevealModal()" style="background:#334155; color:#fff; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.85rem;">Weiter im Fall</button>
                        <button type="button" onclick="window.nextSpecialtyCase()" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                            ${hasMore ? 'Nächstes Thema ➔' : 'Fachrichtung abschließen 🏆'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        closeRevealModal();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    function showSpecialtyFinished() {
        const rawField = specialtySession.field || 'Fachrichtung';
        const displayField = rawField === '__ALL_SUPER_FOLDERS__' ? 'Gesamt-Rotation (Alle Überordner)' : rawField;
        const escapedFieldJs = escapeInlineJsArg(rawField);
        const totalPlayed = specialtySession.totalCount || getSpecialtyCases(rawField).length;

        const modalHtml = `
            <div id="reveal-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
                <div style="background:#1e293b; border:1px solid #38bdf8; border-radius:14px; max-width:500px; width:100%; padding:28px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.6); color:#f8fafc;">
                    <div style="font-size:2.6rem; margin-bottom:10px;">🏆</div>
                    <h2 style="color:#38bdf8; margin:0 0 10px 0;">Überordner komplett gemeistert!</h2>
                    <p style="color:#cbd5e1; font-size:0.92rem; line-height:1.5; margin-bottom:20px;">
                        Du hast alle <strong>${totalPlayed} Fälle & Themen</strong> aus <strong>${escapeHtml(displayField)}</strong> restlos durchgespielt!
                    </p>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button type="button" onclick="window.SpecialtyStore.resetCompleted('${escapedFieldJs}'); window.startSpecialty('${escapedFieldJs}');" style="background:#0284c7; color:#fff; border:none; padding:11px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.9rem;">
                            🔄 Alle Themen neu mischen & nochmal trainieren
                        </button>
                        <button type="button" onclick="window.closeRevealModal(); window.isSpecialtyBlindMode = false; window.switchTab('dashboard', document.querySelectorAll('.nav-item')[0]); window.setLearningMode('specialty');" style="background:#334155; color:#fff; border:none; padding:11px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">
                            Zurück zur Fachrichtungs-Übersicht
                        </button>
                    </div>
                </div>
            </div>
        `;
        closeRevealModal();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // ============================================================================
    // 6. DASHBOARD-HUB RENDERING (ZEIGT NUR DIE ÜBERORDNER ALS KARTEN)
    // ============================================================================
    function setLearningMode(mode) {
        const isSpecialty = mode === 'specialty';
        const topicWrapper = document.getElementById('super-folders-wrapper') || document.getElementById('topic-grid');
        const specialtyHub = document.getElementById('specialty-hub');

        if (topicWrapper) topicWrapper.style.display = isSpecialty ? 'none' : 'flex';
        if (specialtyHub) specialtyHub.style.display = isSpecialty ? 'block' : 'none';

        document.getElementById('seg-topic')?.classList.toggle('active', !isSpecialty);
        document.getElementById('seg-specialty')?.classList.toggle('active', isSpecialty);

        if (isSpecialty) renderSpecialtyHub();
    }

    function renderSpecialtyHub() {
        const hub = document.getElementById('specialty-hub');
        if (!hub) return;

        const allCases = typeof window.getRegisteredCases === 'function' ? window.getRegisteredCases() : [];
        const superOrder = getActiveSuperFoldersList();

        // Optional: Live-Mindmap-Zahlen pro Überordner abrufen (falls MindmapModule geladen)
        const mindmapCountByFolderId = new Map();
        const hasMindmapModule = Boolean(window.MindmapModule && typeof window.MindmapModule.openFolder === 'function');
        if (hasMindmapModule && typeof window.MindmapModule.getFoldersWithStats === 'function') {
            try {
                window.MindmapModule.getFoldersWithStats().forEach(f => {
                    mindmapCountByFolderId.set(f.id, Array.isArray(f.maps) ? f.maps.length : 0);
                });
            } catch (_e) {}
        }

        const superMap = new Map();
        superOrder.forEach(sTitle => {
            superMap.set(sTitle, { cases: [], subTopics: new Map() });
        });

        allCases.forEach(c => {
            const sTitle = resolveSuperFolderForCase(c);
            const subTopic = resolveSubTopicForCase(c);

            if (!superMap.has(sTitle)) {
                superMap.set(sTitle, { cases: [], subTopics: new Map() });
            }
            const entry = superMap.get(sTitle);
            entry.cases.push(c);
            entry.subTopics.set(subTopic, (entry.subTopics.get(subTopic) || 0) + 1);
        });

        const entries = Array.from(superMap.entries());
        if (!entries.length) {
            hub.innerHTML = '<div style="color:#94a3b8; padding:20px;">Keine Überordner verfügbar.</div>';
            return;
        }

        const totalAllCases = allCases.length;

        hub.innerHTML = `
            <!-- Master-Banner für interdisziplinäre Staatsexamens-Rotation über alle Überordner -->
            <div onclick="window.startSpecialty('__ALL_SUPER_FOLDERS__')"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.startSpecialty('__ALL_SUPER_FOLDERS__');}"
                 role="button" tabindex="0"
                 style="margin-top:15px; margin-bottom:18px; padding:16px 20px; border-radius:14px; background:linear-gradient(135deg, rgba(2,132,199,0.22), rgba(99,102,241,0.18)); border:1px solid rgba(56,189,248,0.45); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; cursor:pointer; transition:transform 0.18s ease;">
                <div>
                    <div style="display:flex; align-items:center; gap:8px; color:#38bdf8; font-weight:800; font-size:1rem;">
                        <span>⚡ Staatsexamens-Modus: Blind-Triage über alle Überordner</span>
                    </div>
                    <div style="color:#cbd5e1; font-size:0.82rem; margin-top:3px;">
                        Mischt alle <strong>${totalAllCases} Krankheitsbilder</strong> aus sämtlichen Fachrichtungen ohne Vorab-Hinweis auf das Organsystem.
                    </div>
                </div>
                <button type="button" onclick="event.stopPropagation(); window.startSpecialty('__ALL_SUPER_FOLDERS__');" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:700; font-size:0.84rem; cursor:pointer; white-space:nowrap;">
                    Gesamt-Rotation starten ➔
                </button>
            </div>

            <!-- Karten der Überordner (Fachrichtungen) -->
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); gap:18px;">
                ${entries.map(([superTitle, data]) => {
                    const count = data.cases.length;
                    const subTopicsEntries = Array.from(data.subTopics.entries());
                    const validIds = new Set(data.cases.map(c => c.case_id));
                    const done = SpecialtyStore.get(superTitle).completedCaseIds.filter(id => validIds.has(id)).length;
                    const pct = count > 0 ? Math.round((done / count) * 100) : 0;
                    const escapedSuperJs = escapeInlineJsArg(superTitle);
                    const styleMeta = getStyleMetaForSuperFolder(superTitle);
                    const folderId = getMindmapFolderIdForSuperTitle(superTitle);
                    const mmCount = mindmapCountByFolderId.get(folderId) || 0;

                    const topicsPillsHtml = subTopicsEntries.length > 0
                        ? subTopicsEntries.map(([topicName, topicCaseCount]) =>
                            `<span style="background:rgba(15,23,42,0.75); border:1px solid rgba(56,189,248,0.25); color:#e2e8f0; padding:4px 9px; border-radius:8px; font-size:0.74rem; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
                                <span>📁 ${escapeHtml(topicName)}</span>
                                <span style="color:#38bdf8; font-family:'JetBrains Mono', monospace; font-size:0.7rem;">(${topicCaseCount})</span>
                            </span>`
                          ).join('')
                        : `<span style="color:#64748b; font-size:0.78rem; font-style:italic;">Noch keine Themen in diesem Überordner</span>`;

                    return `
                        <div class="specialty-card" role="button" tabindex="0"
                             onclick="window.startSpecialty('${escapedSuperJs}')"
                             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.startSpecialty('${escapedSuperJs}');}"
                             style="background:#1e293b; border:1px solid ${count > 0 ? '#334155' : 'rgba(51,65,85,0.4)'}; border-top:3px solid ${escapeHtml(styleMeta.color)}; padding:22px; border-radius:14px; cursor:${count > 0 ? 'pointer' : 'not-allowed'}; opacity:${count > 0 ? '1' : '0.72'}; display:flex; flex-direction:column; justify-content:space-between; gap:16px; transition:all 0.2s ease; box-shadow:0 4px 16px rgba(0,0,0,0.25);">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:12px;">
                                    <h3 style="color:#38bdf8; margin:0; font-size:1.15rem; font-weight:800; line-height:1.3;">
                                        ${escapeHtml(styleMeta.icon)} ${escapeHtml(superTitle)}
                                    </h3>
                                    <span style="background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:3px 9px; border-radius:20px; font-size:0.73rem; font-weight:700; white-space:nowrap;">
                                        ${subTopicsEntries.length} ${subTopicsEntries.length === 1 ? 'Thema' : 'Themen'}
                                    </span>
                                </div>
                                <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.4px;">
                                    Enthaltene Themenbereiche (Zufalls-Pool):
                                </div>
                                <div style="display:flex; flex-wrap:wrap; gap:6px; max-height:135px; overflow-y:auto; padding-right:2px;">
                                    ${topicsPillsHtml}
                                </div>
                            </div>

                            <div style="border-top:1px solid rgba(148,163,184,0.12); padding-top:12px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; color:#cbd5e1; font-size:0.82rem; margin-bottom:7px; font-weight:700; flex-wrap:wrap;">
                                    <span>🎯 ${count} ${count === 1 ? 'Krankheitsbild' : 'Krankheitsbilder'} gesamt</span>
                                    <span style="color:${pct === 100 && count > 0 ? '#10b981' : '#38bdf8'};">${done}/${count} gelöst (${pct}%)</span>
                                </div>
                                <div style="background:rgba(0,0,0,0.5); height:8px; border-radius:10px; overflow:hidden;">
                                    <div style="width:${pct}%; background:${pct === 100 ? '#10b981' : '#38bdf8'}; height:100%; transition:width 0.3s ease;"></div>
                                </div>
                                ${hasMindmapModule ? `
                                    <div style="display:flex; justify-content:flex-end; margin-top:10px;">
                                        <button type="button"
                                                onclick="event.stopPropagation(); window.SpecialtyModule.openMindmaps('${escapedSuperJs}');"
                                                title="Direkt die Mindmaps aus diesem Überordner öffnen"
                                                style="background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.35); padding:5px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                                            🕸️ Mindmaps (${mmCount}) ➔
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>`;
                }).join('')}
            </div>
        `;
    }

    // ============================================================================
    // 7. GLOBAL-BINDING, LIVE DASHBOARD-FOLDER-EXPORT & OVERRIDE-SCHUTZ
    // ============================================================================
    function defineLiveDashboardFoldersProperty() {
        try {
            Object.defineProperty(window, 'MEDCHECK_DASHBOARD_FOLDERS', {
                configurable: true,
                enumerable: true,
                get() {
                    return buildDashboardFoldersForMindmap();
                },
                set(val) {
                    manualDashboardFoldersOverride = Array.isArray(val) ? val : null;
                }
            });
        } catch (_e) {
            window.MEDCHECK_DASHBOARD_FOLDERS = buildDashboardFoldersForMindmap();
        }
    }

    function bindSpecialtyGlobals() {
        window.SpecialtyStore = SpecialtyStore;
        window.startSpecialty = startSpecialty;
        window.startSpecialtyMode = startSpecialty;
        window.nextSpecialtyCase = nextSpecialtyCase;
        window.applyBlindHeader = applyBlindHeader;
        window.onSpecialtyCompletionChange = onSpecialtyCompletionChange;
        window.closeRevealModal = closeRevealModal;
        window.revealDiagnosis = revealDiagnosis;
        window.setLearningMode = setLearningMode;
        window.renderSpecialtyHub = renderSpecialtyHub;
        window.SpecialtyEngine = {
            start: (name) => startSpecialty(name),
            nextCase: () => nextSpecialtyCase()
        };
        window.SpecialtyModule = {
            getFolders: buildDashboardFoldersForMindmap,
            getActiveSuperFoldersList,
            getSuperFolderForSubTopic,
            getMindmapFolderIdForSuperTitle,
            openMindmaps: openMindmapsForSuperFolder
        };
        defineLiveDashboardFoldersProperty();
    }

    // Sofort binden
    bindSpecialtyGlobals();

    // Nach dem Laden von app.js erneut binden, damit Legacy-Funktionen nichts überschreiben
    document.addEventListener('DOMContentLoaded', () => {
        bindSpecialtyGlobals();
        ensureTopNewCaseButton();
    });
    window.addEventListener('load', () => {
        bindSpecialtyGlobals();
    });
})();
