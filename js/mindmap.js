/**
 * MedCheck - Interactive Clinical Mindmap Module (js/mindmap.js)
 * Features:
 *  - Clinical Category Color Coding (Etiology, Pathophysiology, Clinical, Diagnostics, Therapy)
 *  - Blind Exam Mode ("Staatsexamens-Modus" against Test-Wiseness)
 *  - Smooth Pointer-Event Drag & Drop + Click-to-Place Support
 *  - Automatic 2-Ring Radial Graph Layout + Dynamic SVG Cubic Bézier Edges
 *  - Socratic AI Feedback Loop via /api/gemini with Smart Local Fallback
 *  - Supabase Persistence (mindmaps & mindmap_progress) + LocalStorage Sync
 */

(function () {
    'use strict';

    const CATEGORIES = {
        etiology: { label: 'Ätiologie & Risiko', color: '#3b82f6', cssClass: 'cat-etiology' },
        pathophysiology: { label: 'Pathophysiologie', color: '#ef4444', cssClass: 'cat-pathophysiology' },
        clinical: { label: 'Klinik & Symptome', color: '#f59e0b', cssClass: 'cat-clinical' },
        diagnostics: { label: 'Diagnostik', color: '#8b5cf6', cssClass: 'cat-diagnostics' },
        therapy: { label: 'Therapie', color: '#10b981', cssClass: 'cat-therapy' }
    };

    // Vorinstallierte klinische Mindmaps als sofort spielbare Referenz
    const BUILTIN_MINDMAPS = [
        {
            id: 'mm_cardio_stemi_001',
            title: 'Akutes Koronarsyndrom (STEMI)',
            specialty: 'Kardiologie',
            central_concept: 'STEMI (Transmurale Ischämie)',
            nodes: [
                // 1. Ordnung (direkt am Zentrum)
                {
                    id: 'n1',
                    label: 'Plaqueruptur & Thrombus',
                    category: 'pathophysiology',
                    parent_id: 'root',
                    relation_label: 'Entstehungsmechanismus',
                    socratic_hint: 'Was passiert akut an einer vulnerablen atherosklerotischen Koronarläsion, bevor das Gefäß komplett verschließt?'
                },
                {
                    id: 'n2',
                    label: 'Vernichtungsschmerz (retrosternal)',
                    category: 'clinical',
                    parent_id: 'root',
                    relation_label: 'Leitsymptom',
                    socratic_hint: 'Wie äußert sich eine akute myokardiale Ischämie typischerweise subjektiv beim Patienten?'
                },
                {
                    id: 'n3',
                    label: '12-Kanal-EKG (< 10 Min.)',
                    category: 'diagnostics',
                    parent_id: 'root',
                    relation_label: 'Primärdiagnostik',
                    socratic_hint: 'Welche apparative Untersuchung muss laut ESC-Leitlinie innerhalb von 10 Minuten nach Erstkontakt erfolgen?'
                },
                {
                    id: 'n4',
                    label: 'Primäre PCI (Herzkatheter)',
                    category: 'therapy',
                    parent_id: 'root',
                    relation_label: 'Kausale Reperfusion',
                    socratic_hint: 'Welche Intervention öffnet das verschlossene Koronargefäß mechanisch mit der höchsten Erfolgsrate?'
                },
                {
                    id: 'n5',
                    label: 'LDL-Hypercholesterinämie & Nikotin',
                    category: 'etiology',
                    parent_id: 'root',
                    relation_label: 'Hauptrisikofaktoren',
                    socratic_hint: 'Welche chronischen kardiovaskulären Faktoren fördern die Bildung vulnerabler Plaques?'
                },
                // 2. Ordnung (Unteräste)
                {
                    id: 'n6',
                    label: 'Transmurale Nekrose & Troponin-Anstieg',
                    category: 'pathophysiology',
                    parent_id: 'n1',
                    relation_label: 'führt unbehandelt zu',
                    socratic_hint: 'Was passiert mit den Kardiomyozyten bei anhaltender kompletter Ischämie und welcher Biomarker wird dabei frei?'
                },
                {
                    id: 'n7',
                    label: 'Ausstrahlung in linken Arm / Unterkiefer',
                    category: 'clinical',
                    parent_id: 'n2',
                    relation_label: 'Head-Zonen-Projektion',
                    socratic_hint: 'Wohin projiziert der viszerale Herzschmerz über die Segmente C8–Th5 typischerweise?'
                },
                {
                    id: 'n8',
                    label: 'Konvexe ST-Hebung in ≥ 2 Nachbarableitungen',
                    category: 'diagnostics',
                    parent_id: 'n3',
                    relation_label: 'Beweisender Befund',
                    socratic_hint: 'Welches spezifische Erregungsrückbildungs-Kriterium im EKG definiert den STEMI?'
                },
                {
                    id: 'n9',
                    label: 'DAPT (ASS + Prasugrel/Ticagrelor)',
                    category: 'therapy',
                    parent_id: 'n4',
                    relation_label: 'Stentthrombose-Prophylaxe',
                    socratic_hint: 'Welche medikamentöse Kombination verhindert nach Stent-Implantation den akuten Wiederverschluss?'
                }
            ]
        },
        {
            id: 'mm_pneumo_lae_001',
            title: 'Akute Lungenarterienembolie (LAE)',
            specialty: 'Pneumologie / Notfallmedizin',
            central_concept: 'Lungenarterienembolie (LAE)',
            nodes: [
                {
                    id: 'l1',
                    label: 'Tiefe Beinvenenthrombose (TVT)',
                    category: 'etiology',
                    parent_id: 'root',
                    relation_label: 'Häufigste Emboliequelle (90%)',
                    socratic_hint: 'Woher stammt der eingeschwemmte Thrombus in den allermeisten Fällen anatomisch?'
                },
                {
                    id: 'l2',
                    label: 'Abrupter Nachlastanstieg des rechten Ventrikels',
                    category: 'pathophysiology',
                    parent_id: 'root',
                    relation_label: 'Hämodynamische Folge',
                    socratic_hint: 'Welcher Herzabschnitt muss plötzlich gegen den erhöhten pulmonalvaskulären Widerstand anpumpen?'
                },
                {
                    id: 'l3',
                    label: 'Akute Dyspnoe & Tachypnoe',
                    category: 'clinical',
                    parent_id: 'root',
                    relation_label: 'Häufigstes Initialsymptom',
                    socratic_hint: 'Welches klinische Zeichen tritt plötzlich durch die Totraumventilation und Hypoxämie auf?'
                },
                {
                    id: 'l4',
                    label: 'Wells-Score + D-Dimere / CT-Angiographie',
                    category: 'diagnostics',
                    parent_id: 'root',
                    relation_label: 'Diagnose-Algorithmus',
                    socratic_hint: 'Wie kombiniert man klinische Wahrscheinlichkeit, Labor und Goldstandard-Bildgebung?'
                },
                {
                    id: 'l5',
                    label: 'Therapeutische Antikoagulation (DOAK / Heparin)',
                    category: 'therapy',
                    parent_id: 'root',
                    relation_label: 'Basistherapie (Intermediate/Low Risk)',
                    socratic_hint: 'Welche medikamentöse Maßnahme stoppt sofort das appositionelle Thrombuswachstum?'
                },
                {
                    id: 'l6',
                    label: 'Obstruktiver Schock (RRsys < 90 mmHg)',
                    category: 'pathophysiology',
                    parent_id: 'l2',
                    relation_label: 'Dekompensation (High-Risk)',
                    socratic_hint: 'Was passiert mit dem linksventrikulären Vorlast-Angebot und dem Systemblutdruck, wenn der rechte Ventrikel versagt?'
                },
                {
                    id: 'l7',
                    label: 'Systemische Thrombolyse (rt-PA / Alteplase)',
                    category: 'therapy',
                    parent_id: 'l6',
                    relation_label: 'Notfalltherapie bei Schock',
                    socratic_hint: 'Welche medikamentöse Reperfusionstherapie ist bei hämodynamischer Instabilität (High-Risk-LAE) indiziert?'
                }
            ]
        }
    ];

    const state = {
        mindmaps: [],
        currentMap: null,
        solvedNodeIds: new Set(),
        selectedChipId: null,
        blindMode: false, // false = Kategoriefarbe sichtbar, true = Prüfungsmodus (grau bis zur Lösung)
        mistakesCount: 0,
        weakNodeIds: new Set(),
        startTime: null,
        nodePositions: {}, // Berechnete { x, y } in Prozent (0..100)
        progressCache: {}, // mindmap_id -> progress object
        dragState: null
    };

    // ========================================================================
    // 1. INITIALISIERUNG & DEFENSIVE DOM-EINBINDUNG
    // ========================================================================

    function ensureDomStructure() {
        // 1. View-Section prüfen / automatisch anlegen, falls in index.html vergessen
        let viewSection = document.getElementById('mindmap-view');
        if (!viewSection) {
            const mainEl = document.querySelector('main') || document.body;
            viewSection = document.createElement('section');
            viewSection.id = 'mindmap-view';
            viewSection.className = 'view-section hidden';
            mainEl.appendChild(viewSection);
        }

        // 2. Sidebar-Button prüfen / automatisch einfügen, falls noch nicht in index.html
        const existingNavBtn = document.querySelector('[data-view="mindmap"]');
        if (!existingNavBtn) {
            const sidebarNav = document.querySelector('.sidebar-nav, nav, .sidebar');
            if (sidebarNav) {
                const btn = document.createElement('button');
                btn.className = 'nav-item';
                btn.setAttribute('data-view', 'mindmap');
                btn.innerHTML = `<span class="nav-icon">🕸️</span><span class="nav-label">Mindmap-Labor</span>`;
                btn.addEventListener('click', () => openView());
                sidebarNav.appendChild(btn);
            }
        }
        return viewSection;
    }

    async function init() {
        ensureDomStructure();
        await loadMindmapsAndProgress();
        if (!state.currentMap && state.mindmaps.length > 0) {
            selectMindmap(state.mindmaps[0].id);
        } else {
            renderModule();
        }

        window.addEventListener('resize', () => {
            if (isViewVisible()) {
                drawSvgConnections();
            }
        });
    }

    function isViewVisible() {
        const el = document.getElementById('mindmap-view');
        return el && !el.classList.contains('hidden') && el.style.display !== 'none';
    }

    function openView() {
        // Alle anderen Sektionen ausblenden (kompatibel mit gängigen MedCheck View-Switchern)
        document.querySelectorAll('.view-section, main > section, main > div[id$="-view"]').forEach(sec => {
            sec.classList.add('hidden');
            sec.style.display = 'none';
        });

        const viewSection = ensureDomStructure();
        viewSection.classList.remove('hidden');
        viewSection.style.display = 'block';

        // Sidebar Active-State aktualisieren
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-view') === 'mindmap');
        });

        if (!state.currentMap) {
            init();
        } else {
            renderModule();
            requestAnimationFrame(() => drawSvgConnections());
        }
    }

    // ========================================================================
    // 2. SUPABASE PERSISTENZ & LOCALSTORAGE SYNC
    // ========================================================================

    function getSupabase() {
        return window.supabaseClient || window.supabase || (window.Auth && window.Auth.supabase) || null;
    }

    async function getCurrentUser() {
        const sb = getSupabase();
        if (!sb || !sb.auth) return null;
        try {
            const { data } = await sb.auth.getUser();
            return data?.user || null;
        } catch (err) {
            return null;
        }
    }

    async function loadMindmapsAndProgress() {
        // 1. Lokale Mindmaps & Built-ins zusammenführen
        const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
        const localProgress = JSON.parse(localStorage.getItem('medcheck_mindmap_progress') || '{}');
        state.progressCache = localProgress;

        const mapById = new Map();
        BUILTIN_MINDMAPS.forEach(m => mapById.set(m.id, m));
        localSaved.forEach(m => mapById.set(m.id, m));

        // 2. Supabase abfragen, falls eingeloggt
        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
                const { data: dbMaps, error: mapErr } = await sb
                    .from('mindmaps')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!mapErr && Array.isArray(dbMaps)) {
                    dbMaps.forEach(row => {
                        const parsed = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
                        mapById.set(row.id, {
                            id: row.id,
                            title: row.title,
                            specialty: row.specialty,
                            central_concept: row.central_concept,
                            nodes: parsed.nodes || []
                        });
                    });
                }

                const { data: dbProg, error: progErr } = await sb
                    .from('mindmap_progress')
                    .select('*')
                    .eq('user_id', user.id);

                if (!progErr && Array.isArray(dbProg)) {
                    dbProg.forEach(row => {
                        state.progressCache[row.mindmap_id] = {
                            completed: row.completed,
                            accuracy: Number(row.accuracy),
                            mistakes_count: row.mistakes_count,
                            best_time_sec: row.best_time_sec,
                            weak_nodes: row.weak_nodes_json || []
                        };
                    });
                    localStorage.setItem('medcheck_mindmap_progress', JSON.stringify(state.progressCache));
                }
            } catch (e) {
                console.warn('[Mindmap] Supabase-Sync im Offline-Fallback:', e);
            }
        }

        state.mindmaps = Array.from(mapById.values());
    }

    async function saveCustomMindmapToDb(mindmapObj) {
        // 1. Lokal sichern
        const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
        const filtered = localSaved.filter(m => m.id !== mindmapObj.id);
        filtered.unshift(mindmapObj);
        localStorage.setItem('medcheck_custom_mindmaps', JSON.stringify(filtered));

        // 2. In Supabase speichern
        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
                await sb.from('mindmaps').upsert({
                    id: mindmapObj.id,
                    user_id: user.id,
                    title: mindmapObj.title,
                    specialty: mindmapObj.specialty || 'Vorlesung',
                    central_concept: mindmapObj.central_concept,
                    data_json: { nodes: mindmapObj.nodes },
                    updated_at: new Date().toISOString()
                });
            } catch (err) {
                console.warn('[Mindmap] Konnte Mindmap nicht in Supabase speichern (lokal gesichert):', err);
            }
        }
    }

    async function saveProgressToDb() {
        if (!state.currentMap) return;
        const totalNodes = state.currentMap.nodes.length;
        const totalAttempts = totalNodes + state.mistakesCount;
        const accuracy = totalAttempts > 0 ? Math.round((totalNodes / totalAttempts) * 100) : 100;
        const elapsedSec = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;

        const prev = state.progressCache[state.currentMap.id] || {};
        const bestTime = prev.best_time_sec ? Math.min(prev.best_time_sec, elapsedSec) : elapsedSec;

        const record = {
            completed: true,
            accuracy,
            mistakes_count: state.mistakesCount,
            best_time_sec: bestTime,
            weak_nodes: Array.from(state.weakNodeIds),
            last_played_at: new Date().toISOString()
        };

        state.progressCache[state.currentMap.id] = record;
        localStorage.setItem('medcheck_mindmap_progress', JSON.stringify(state.progressCache));

        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
                // Sicherstellen, dass die Mindmap selbst auch in `mindmaps` existiert (wegen Foreign Key)
                await saveCustomMindmapToDb(state.currentMap);

                await sb.from('mindmap_progress').upsert({
                    user_id: user.id,
                    mindmap_id: state.currentMap.id,
                    completed: true,
                    accuracy,
                    mistakes_count: state.mistakesCount,
                    best_time_sec: bestTime,
                    weak_nodes_json: Array.from(state.weakNodeIds),
                    last_played_at: new Date().toISOString()
                }, { onConflict: 'user_id,mindmap_id' });
            } catch (err) {
                console.warn('[Mindmap] Fortschritt lokal gespeichert, Supabase-Sync übersprungen:', err);
            }
        }
    }

    // ========================================================================
    // 3. RADIALER GRAPH-ALGORITHMUS (AUTOMATISCHE KOORDINATEN)
    // ========================================================================

    function computeRadialLayout(mindmap) {
        const positions = {
            root: { x: 50, y: 50 } // Zentrum in Prozent
        };

        const nodes = mindmap.nodes || [];
        const firstOrder = nodes.filter(n => !n.parent_id || n.parent_id === 'root');
        const secondOrder = nodes.filter(n => n.parent_id && n.parent_id !== 'root');

        const count1 = firstOrder.length || 1;
        const radius1X = 25; // Innerer Ring (Prozent vom Canvas)
        const radius1Y = 26;

        firstOrder.forEach((node, idx) => {
            // Startwinkel -90 Grad (12 Uhr), gleichmäßig verteilt
            const angle = (-Math.PI / 2) + (idx * 2 * Math.PI) / count1;
            positions[node.id] = {
                x: 50 + radius1X * Math.cos(angle),
                y: 50 + radius1Y * Math.sin(angle),
                angle
            };
        });

        // Kinder-Knoten (2. Ordnung) um den jeweiligen Eltern-Winkel auffächern
        const childrenByParent = {};
        secondOrder.forEach(n => {
            if (!childrenByParent[n.parent_id]) childrenByParent[n.parent_id] = [];
            childrenByParent[n.parent_id].push(n);
        });

        const radius2X = 42; // Äußerer Ring
        const radius2Y = 42;

        Object.keys(childrenByParent).forEach(parentId => {
            const parentPos = positions[parentId] || { x: 50, y: 50, angle: 0 };
            const children = childrenByParent[parentId];
            const spread = Math.PI / 4.5; // Fächerbreite

            children.forEach((child, i) => {
                let offset = 0;
                if (children.length > 1) {
                    offset = -spread / 2 + (i * spread) / (children.length - 1);
                }
                const childAngle = (parentPos.angle || 0) + offset;
                positions[child.id] = {
                    x: Math.max(9, Math.min(91, 50 + radius2X * Math.cos(childAngle))),
                    y: Math.max(10, Math.min(90, 50 + radius2Y * Math.sin(childAngle))),
                    angle: childAngle
                };
            });
        });

        state.nodePositions = positions;
    }

    // ========================================================================
    // 4. RENDERING & INTERAKTION
    // ========================================================================

    function selectMindmap(mindmapId) {
        const found = state.mindmaps.find(m => m.id === mindmapId) || state.mindmaps[0];
        if (!found) return;

        state.currentMap = found;
        state.solvedNodeIds = new Set();
        state.selectedChipId = null;
        state.mistakesCount = 0;
        state.weakNodeIds = new Set();
        state.startTime = Date.now();

        computeRadialLayout(found);
        renderModule();
        requestAnimationFrame(() => drawSvgConnections());
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function shuffleArray(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function renderModule() {
        const container = ensureDomStructure();
        if (!state.currentMap) {
            container.innerHTML = `<div class="mindmap-wrapper"><p>Keine Mindmap geladen.</p></div>`;
            return;
        }

        const map = state.currentMap;
        const totalNodes = map.nodes.length;
        const solvedCount = state.solvedNodeIds.size;
        const savedProg = state.progressCache[map.id];

        // Ungelöste Begriffe für den Pool mischen
        const remainingNodes = shuffleArray(map.nodes.filter(n => !state.solvedNodeIds.has(n.id)));

        container.innerHTML = `
            <div class="mindmap-wrapper">
                <!-- TOP HEADER -->
                <div class="mm-header">
                    <div class="mm-title-group">
                        <h2>🕸️ Klinisches Mindmap-Labor</h2>
                        <p>Verknüpfe Vorlesungsbegriffe kausal nach Ätiologie, Pathophysiologie, Klinik, Diagnostik & Therapie</p>
                    </div>
                    <div class="mm-controls">
                        <select id="mm-map-selector" class="mm-select" title="Mindmap auswählen">
                            ${state.mindmaps.map(m => {
                                const prog = state.progressCache[m.id];
                                const badge = prog?.completed ? `✅ (${prog.accuracy}%)` : '⭕';
                                return `<option value="${escapeHtml(m.id)}" ${m.id === map.id ? 'selected' : ''}>
                                    ${badge} [${escapeHtml(m.specialty)}] ${escapeHtml(m.title)}
                                </option>`;
                            }).join('')}
                        </select>

                        <button id="mm-toggle-blind" class="mm-btn mm-btn-blind ${state.blindMode ? 'active' : ''}" title="Verbirgt die Kategoriefarben vor dem Lösen gegen Test-Wiseness">
                            ${state.blindMode ? '🕶️ Prüfungs-Modus (Blind: AN)' : '🎨 Lern-Modus (Farben: AN)'}
                        </button>

                        <button id="mm-btn-reset" class="mm-btn" title="Mindmap zurücksetzen">
                            🔄 Reset
                        </button>

                        <button id="mm-btn-prompt" class="mm-btn" title="Prompt für Vorlesungs-Extraktion kopieren">
                            📋 Vorlesungs-Prompt
                        </button>

                        <button id="mm-btn-import" class="mm-btn mm-btn-primary">
                            📥 JSON Importieren
                        </button>
                    </div>
                </div>

                <!-- LEGENDE & FORTSCHRITT -->
                <div class="mm-statusbar">
                    <div class="mm-legend">
                        ${Object.entries(CATEGORIES).map(([key, cfg]) => `
                            <span class="mm-legend-item">
                                <span class="mm-dot" style="background:${cfg.color}"></span>
                                ${escapeHtml(cfg.label)}
                            </span>
                        `).join('')}
                    </div>
                    <div class="mm-stats">
                        <span class="mm-stat-badge" id="mm-stat-progress">🧩 Gelöst: ${solvedCount} / ${totalNodes}</span>
                        <span class="mm-stat-badge" id="mm-stat-mistakes">⚠️ Fehlversuche: ${state.mistakesCount}</span>
                        ${savedProg?.best_time_sec ? `<span class="mm-stat-badge">⏱️ Bestzeit: ${savedProg.best_time_sec}s</span>` : ''}
                    </div>
                </div>

                <!-- WORKSPACE -->
                <div class="mm-workspace">
                    <!-- LINKE SPALTE: BEGRIFFS-POOL & SOKRATISCHER TUTOR -->
                    <div class="mm-sidebar-panel">
                        <div class="mm-pool-box">
                            <div class="mm-box-header">
                                <span>📦 Extrahierte Vorlesungsbegriffe (${remainingNodes.length})</span>
                                <small style="color:#94a3b8; font-weight:400;">Ziehen oder Klicken</small>
                            </div>
                            <div id="mm-chip-pool" class="mm-chip-list">
                                ${remainingNodes.length === 0 ? `
                                    <div style="color:#10b981; font-weight:600; padding:0.75rem 0;">
                                        🎉 Alle Begriffe erfolgreich vernetzt!
                                    </div>
                                ` : remainingNodes.map(node => {
                                    const catClass = state.blindMode ? 'cat-blind' : (CATEGORIES[node.category]?.cssClass || 'cat-blind');
                                    const isSelected = state.selectedChipId === node.id ? 'selected-chip' : '';
                                    return `
                                        <div class="mm-chip ${catClass} ${isSelected}"
                                             data-node-id="${escapeHtml(node.id)}"
                                             title="Ziehe diesen Begriff auf den passenden Knoten oder klicke ihn an">
                                            ${escapeHtml(node.label)}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- SOKRATISCHES AI-FEEDBACK PANEL -->
                        <div class="mm-tutor-box">
                            <div class="mm-box-header">
                                <span>🏛️ Sokratischer KI-Tutor</span>
                                <span style="font-size:0.72rem; color:#38bdf8;">Bloom-Stufe: Analyse & Synthese</span>
                            </div>
                            <div id="mm-tutor-message" class="mm-tutor-content">
                                Wähle einen Begriff aus dem Pool und ziehe ihn auf den passenden Ziel-Knoten in der Mindmap. Bei einer Fehlzuordnung analysiere ich deinen Gedankengang sokratisch!
                            </div>
                        </div>
                    </div>

                    <!-- RECHTE SPALTE: INTERAKTIVES MINDMAP-CANVAS -->
                    <div id="mm-canvas" class="mm-canvas-container">
                        <svg id="mm-svg" class="mm-svg-layer"></svg>
                        <div id="mm-nodes" class="mm-nodes-layer">
                            <!-- ZENTRALER WURZEL-KNOTEN -->
                            <div class="mm-node mm-node-root" style="left: 50%; top: 50%;" data-node-pos="root">
                                <span class="mm-root-badge">${escapeHtml(map.specialty)}</span>
                                <span>${escapeHtml(map.central_concept)}</span>
                            </div>

                            <!-- ZIEL-SLOTS / GELÖSTE KNOTEN -->
                            ${map.nodes.map(node => renderCanvasNode(node)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderCanvasNode(node) {
        const pos = state.nodePositions[node.id] || { x: 50, y: 50 };
        const isSolved = state.solvedNodeIds.has(node.id);
        const catCfg = CATEGORIES[node.category] || { label: 'Konzept', cssClass: 'cat-blind' };

        if (isSolved) {
            return `
                <div class="mm-node mm-node-solved ${catCfg.cssClass}"
                     style="left: ${pos.x}%; top: ${pos.y}%;"
                     data-slot-id="${escapeHtml(node.id)}">
                    <span class="mm-slot-hint">${escapeHtml(catCfg.label)}</span>
                    <span>${escapeHtml(node.label)}</span>
                </div>
            `;
        }

        // Ungelöster Ziel-Slot
        const slotCatClass = state.blindMode ? 'cat-blind' : catCfg.cssClass;
        const slotHintLabel = state.blindMode ? '❓ Offener Knoten' : catCfg.label;

        return `
            <div class="mm-node mm-node-slot ${slotCatClass}"
                 style="left: ${pos.x}%; top: ${pos.y}%;"
                 data-slot-id="${escapeHtml(node.id)}"
                 title="Begriff hier ablegen oder für Sokratischen Tipp klicken">
                <span class="mm-slot-hint">${escapeHtml(slotHintLabel)}</span>
                <span>Begriff hierhin ziehen</span>
            </div>
        `;
    }

    // ========================================================================
    // 5. DYNAMISCHE SVG-BÉZIER-VERBINDUNGEN ZEICHNEN
    // ========================================================================

    function drawSvgConnections() {
        const svg = document.getElementById('mm-svg');
        const canvas = document.getElementById('mm-canvas');
        if (!svg || !canvas || !state.currentMap) return;

        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 680;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        let defsHtml = `
            <defs>
                <marker id="mm-arrow-default" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="rgba(148, 163, 184, 0.55)" />
                </marker>
                ${Object.entries(CATEGORIES).map(([key, cfg]) => `
                    <marker id="mm-arrow-${key}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 8 5 L 0 9 z" fill="${cfg.color}" />
                    </marker>
                `).join('')}
            </defs>
        `;

        let pathsHtml = '';
        let labelsHtml = '';

        state.currentMap.nodes.forEach(node => {
            const parentId = node.parent_id || 'root';
            const fromPos = state.nodePositions[parentId] || { x: 50, y: 50 };
            const toPos = state.nodePositions[node.id] || { x: 50, y: 50 };

            const x1 = (fromPos.x / 100) * width;
            const y1 = (fromPos.y / 100) * height;
            const x2 = (toPos.x / 100) * width;
            const y2 = (toPos.y / 100) * height;

            // Geschwungene kubische Bézier-Kurve berechnen
            const dx = x2 - x1;
            const dy = y2 - y1;
            const cx1 = x1 + dx * 0.38;
            const cy1 = y1 + dy * 0.12;
            const cx2 = x1 + dx * 0.62;
            const cy2 = y1 + dy * 0.88;

            const isSolved = state.solvedNodeIds.has(node.id);
            const catCfg = CATEGORIES[node.category];
            const showColor = isSolved || !state.blindMode;
            const strokeColor = showColor && catCfg ? catCfg.color : 'rgba(148, 163, 184, 0.38)';
            const markerId = showColor && catCfg ? `mm-arrow-${node.category}` : 'mm-arrow-default';

            pathsHtml += `
                <path class="mm-edge-path ${isSolved ? 'solved-edge' : ''}"
                      d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}"
                      style="stroke: ${strokeColor};"
                      marker-end="url(#${markerId})" />
            `;

            if (node.relation_label) {
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                const labelText = escapeHtml(node.relation_label);
                const boxWidth = Math.max(76, node.relation_label.length * 6.2 + 16);

                labelsHtml += `
                    <g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)})">
                        <rect class="mm-edge-label-bg" x="${(-boxWidth / 2).toFixed(1)}" y="-10" width="${boxWidth.toFixed(1)}" height="20" />
                        <text class="mm-edge-label-text" x="0" y="0">${labelText}</text>
                    </g>
                `;
            }
        });

        svg.innerHTML = defsHtml + pathsHtml + labelsHtml;
    }

    // ========================================================================
    // 6. POINTER DRAG-AND-DROP & CLICK-TO-PLACE LOGIK
    // ========================================================================

    function bindEvents() {
        const selector = document.getElementById('mm-map-selector');
        if (selector) {
            selector.addEventListener('change', e => selectMindmap(e.target.value));
        }

        const blindBtn = document.getElementById('mm-toggle-blind');
        if (blindBtn) {
            blindBtn.addEventListener('click', () => {
                state.blindMode = !state.blindMode;
                renderModule();
                requestAnimationFrame(() => drawSvgConnections());
            });
        }

        const resetBtn = document.getElementById('mm-btn-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (state.currentMap) selectMindmap(state.currentMap.id);
            });
        }

        const promptBtn = document.getElementById('mm-btn-prompt');
        if (promptBtn) {
            promptBtn.addEventListener('click', copyExtractionPrompt);
        }

        const importBtn = document.getElementById('mm-btn-import');
        if (importBtn) {
            importBtn.addEventListener('click', openImportModal);
        }

        // Chips: Pointer-Drag + Click-to-Select
        document.querySelectorAll('.mm-chip').forEach(chip => {
            chip.addEventListener('pointerdown', onChipPointerDown);
            chip.addEventListener('click', e => {
                e.stopPropagation();
                const nodeId = chip.getAttribute('data-node-id');
                state.selectedChipId = (state.selectedChipId === nodeId) ? null : nodeId;
                document.querySelectorAll('.mm-chip').forEach(c => {
                    c.classList.toggle('selected-chip', c.getAttribute('data-node-id') === state.selectedChipId);
                });
            });
        });

        // Ziel-Slots: Click-to-Drop oder Sokratischen Hinweis anfordern
        document.querySelectorAll('.mm-node-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const slotId = slot.getAttribute('data-slot-id');
                if (state.selectedChipId) {
                    evaluateDropAttempt(state.selectedChipId, slotId, slot);
                } else {
                    showSlotSocraticHint(slotId);
                }
            });
        });
    }

    function onChipPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        const chip = e.currentTarget;
        const nodeId = chip.getAttribute('data-node-id');
        const startX = e.clientX;
        const startY = e.clientY;
        let isDragging = false;
        let ghostEl = null;

        function onPointerMove(moveEvent) {
            const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
            if (!isDragging && dist > 6) {
                isDragging = true;
                chip.classList.add('dragging');
                ghostEl = chip.cloneNode(true);
                ghostEl.classList.remove('dragging');
                ghostEl.classList.add('mm-drag-ghost');
                document.body.appendChild(ghostEl);
            }

            if (isDragging && ghostEl) {
                ghostEl.style.left = `${moveEvent.clientX}px`;
                ghostEl.style.top = `${moveEvent.clientY}px`;

                // Hover-Highlight auf Ziel-Slot prüfen
                document.querySelectorAll('.mm-node-slot').forEach(s => s.classList.remove('drag-over'));
                const targetSlot = findSlotUnderPoint(moveEvent.clientX, moveEvent.clientY);
                if (targetSlot) targetSlot.classList.add('drag-over');
            }
        }

        function onPointerUp(upEvent) {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);

            if (isDragging) {
                chip.classList.remove('dragging');
                if (ghostEl) ghostEl.remove();
                document.querySelectorAll('.mm-node-slot').forEach(s => s.classList.remove('drag-over'));

                const targetSlot = findSlotUnderPoint(upEvent.clientX, upEvent.clientY);
                if (targetSlot) {
                    const slotId = targetSlot.getAttribute('data-slot-id');
                    evaluateDropAttempt(nodeId, slotId, targetSlot);
                }
            }
        }

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function findSlotUnderPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);
        for (const el of elements) {
            const slot = el.closest && el.closest('.mm-node-slot');
            if (slot) return slot;
        }
        return null;
    }

    // ========================================================================
    // 7. AUSWERTUNG & SOKRATISCHE AI-FEEDBACK-SCHLEIFE (/api/gemini)
    // ========================================================================

    async function evaluateDropAttempt(draggedNodeId, targetSlotId, slotElement) {
        const map = state.currentMap;
        if (!map) return;

        const draggedNode = map.nodes.find(n => n.id === draggedNodeId);
        const targetNode = map.nodes.find(n => n.id === targetSlotId);
        if (!draggedNode || !targetNode) return;

        // Fall 1: Korrekte Zuordnung!
        if (draggedNode.id === targetNode.id) {
            state.solvedNodeIds.add(targetNode.id);
            state.selectedChipId = null;
            renderModule();
            requestAnimationFrame(() => drawSvgConnections());

            const tutorEl = document.getElementById('mm-tutor-message');
            if (tutorEl) {
                const parentLabel = getParentLabel(targetNode);
                tutorEl.innerHTML = `
                    <strong style="color:#10b981;">✅ Exakt richtig vernetzt!</strong><br>
                    <em>„${escapeHtml(targetNode.label)}“</em> gehört über die Relation <strong>„${escapeHtml(targetNode.relation_label || 'Verbindung')}“</strong> direkt zu <strong>„${escapeHtml(parentLabel)}“</strong>.
                `;
            }

            // Prüfen, ob die gesamte Mindmap gelöst wurde
            if (state.solvedNodeIds.size === map.nodes.length) {
                await saveProgressToDb();
                if (tutorEl) {
                    tutorEl.innerHTML = `
                        <strong style="color:#10b981;">🏆 Mindmap vollständig gelöst!</strong><br>
                        Dein Fortschritt (${state.mistakesCount} Fehlversuche) wurde gespeichert.
                        ${state.weakNodeIds.size > 0
                            ? `<br><small style="color:#fcd34d;">Tipp für die Prüfung: Wiederhole besonders die Knoten mit Fehlversuchen.</small>`
                            : `<br><small style="color:#38bdf8;">Makelloser Durchlauf beim ersten Versuch!</small>`}
                    `;
                }
            }
            return;
        }

        // Fall 2: Fehlzuordnung -> Shake-Effekt + Schwachstellen-Tracking + Sokratisches KI-Feedback
        state.mistakesCount += 1;
        state.weakNodeIds.add(targetNode.id);

        const mistakesBadge = document.getElementById('mm-stat-mistakes');
        if (mistakesBadge) {
            mistakesBadge.textContent = `⚠️ Fehlversuche: ${state.mistakesCount}`;
        }

        if (slotElement) {
            slotElement.classList.remove('mm-node-error');
            void slotElement.offsetWidth; // Reflow für Animation
            slotElement.classList.add('mm-node-error');
        }

        await triggerSocraticFeedback(draggedNode, targetNode);
    }

    function getParentLabel(node) {
        if (!node.parent_id || node.parent_id === 'root') {
            return state.currentMap.central_concept;
        }
        const parent = state.currentMap.nodes.find(n => n.id === node.parent_id);
        return parent ? parent.label : state.currentMap.central_concept;
    }

    function showSlotSocraticHint(slotId) {
        const targetNode = state.currentMap?.nodes.find(n => n.id === slotId);
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!targetNode || !tutorEl) return;

        const parentLabel = getParentLabel(targetNode);
        tutorEl.innerHTML = `
            <strong style="color:#38bdf8;">💡 Sokratischer Impuls für diesen Knoten:</strong><br>
            Ausgehend von <strong>„${escapeHtml(parentLabel)}“</strong> über <em>„${escapeHtml(targetNode.relation_label || '')}“</em>:<br>
            ${escapeHtml(targetNode.socratic_hint || 'Überlege, welcher Begriff aus dem Pool kausal an diese Stelle gehört.')}
        `;
    }

    async function triggerSocraticFeedback(draggedNode, targetNode) {
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!tutorEl) return;

        const parentLabel = getParentLabel(targetNode);
        const draggedCat = CATEGORIES[draggedNode.category]?.label || draggedNode.category;
        const targetCat = CATEGORIES[targetNode.category]?.label || targetNode.category;

        tutorEl.innerHTML = `
            <div class="mm-tutor-thinking">
                <span>🧠 Analysiere deinen Zuordnungsversuch sokratisch...</span>
            </div>
        `;

        const prompt = `Du bist ein sokratischer Medizin-Tutor auf Staatsexamensniveau.
Ein Medizinstudent bearbeitet gerade eine Mindmap zum Thema "${state.currentMap.central_concept}".
Er hat versucht, den Begriff "${draggedNode.label}" (Kategorie: ${draggedCat}) auf einen Ziel-Knoten zu ziehen, der über die Relation "${targetNode.relation_label}" an "${parentLabel}" hängt (gesuchte Kategorie: ${targetCat}).
Die eigentlich richtige Lösung für diesen Slot wäre "${targetNode.label}" (VERRATE DIESEN BEGRIFF NICHT WÖRTLICH!).

Deine Aufgabe:
Formuliere in maximal 2 bis 3 prägnanten Sätzen (auf Deutsch, per "Du") ein sokratisches Feedback:
1. Erkläre kurz, warum "${draggedNode.label}" pathophysiologisch oder klinisch nicht an diese Stelle passt.
2. Stelle eine gezielte sokratische Leitfrage, die den Studenten auf das richtige Konzept hinführt, ohne den Zielbegriff direkt zu nennen.`;

        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    systemInstruction: 'Antworte kurz, präzise, medizinisch exakt und rein sokratisch ohne die Lösung direkt zu verraten.'
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            // Unterstützt verschiedene Response-Formate von /api/gemini.js
            const aiText = data.text
                || data.reply
                || data.response
                || data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (aiText) {
                tutorEl.innerHTML = `
                    <strong style="color:#f59e0b;">🤔 Sokratische Rückfrage:</strong><br>
                    ${escapeHtml(aiText)}
                `;
                return;
            }
            throw new Error('Leere AI-Antwort');
        } catch (err) {
            // Intelligenter lokaler Fallback, falls /api/gemini offline ist
            const catMismatch = draggedNode.category !== targetNode.category
                ? `Du hast mit <strong>„${escapeHtml(draggedNode.label)}“</strong> einen Begriff aus dem Bereich <em>${escapeHtml(draggedCat)}</em> gewählt, aber dieser Ast sucht nach einem Konzept der <em>${escapeHtml(targetCat)}</em>.`
                : `<strong>„${escapeHtml(draggedNode.label)}“</strong> stammt zwar ebenfalls aus dem Bereich <em>${escapeHtml(draggedCat)}</em>, passt aber kausal nicht zur Relation <em>„${escapeHtml(targetNode.relation_label)}“</em> von <strong>„${escapeHtml(parentLabel)}“</strong>.`;

            tutorEl.innerHTML = `
                <strong style="color:#f59e0b;">🤔 Sokratische Rückfrage:</strong><br>
                ${catMismatch}<br>
                <span style="color:#38bdf8;">Leitfrage:</span> ${escapeHtml(targetNode.socratic_hint || 'Welche direkte Konsequenz oder Maßnahme ergibt sich hier?')}
            `;
        }
    }

    // ========================================================================
    // 8. VORLESUNGS-PROMPT KOPIERER & JSON-IMPORT MODAL
    // ========================================================================

    function copyExtractionPrompt() {
        const promptTemplate = `Extrahiere aus den folgenden Vorlesungsnotizen die wichtigsten klinischen Kernbegriffe und erstelle daraus ein valides JSON-Objekt für mein MedCheck Mindmap-Modul.

Halte dich STRIKT an dieses JSON-Schema (keine Markdown-Erklärungen drumherum, nur valides JSON):
{
  "id": "mm_fach_thema_001",
  "title": "Prägnanter Titel der Vorlesung / Erkrankung",
  "specialty": "Fachgebiet (z.B. Kardiologie, Neurologie, Innere Medizin)",
  "central_concept": "Zentraler Hauptbegriff in der Mitte",
  "nodes": [
    {
      "id": "n1",
      "label": "Kurzer, prägnanter Begriff (max. 40 Zeichen)",
      "category": "etiology | pathophysiology | clinical | diagnostics | therapy",
      "parent_id": "root",
      "relation_label": "Kurzes Verb/Relation (z.B. führt zu, Goldstandard, Erstlinie)",
      "socratic_hint": "Eine sokratische Frage, die auf diesen Begriff hinführt, ohne ihn zu nennen"
    }
  ]
}

Regeln für ein optimales Layout:
1. Erstelle insgesamt 7 bis 12 Knoten in "nodes".
2. Davon haben 4 bis 6 Knoten "parent_id": "root" (Hauptäste 1. Ordnung).
3. Die übrigen Knoten hängen als Unteräste (2. Ordnung) an einem der Hauptäste (z.B. "parent_id": "n1").
4. Nutze für "category" ausschließlich einen dieser 5 Werte: "etiology", "pathophysiology", "clinical", "diagnostics", "therapy".

Hier ist der Vorlesungstext:
[HIER VORLESUNGSTEXT EINFÜGEN]`;

        navigator.clipboard.writeText(promptTemplate).then(() => {
            const btn = document.getElementById('mm-btn-prompt');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '✅ Prompt kopiert!';
                setTimeout(() => { btn.innerHTML = orig; }, 2200);
            }
        });
    }

    function openImportModal() {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'mm-modal-backdrop';
        modalBackdrop.innerHTML = `
            <div class="mm-modal">
                <h3 style="margin-top:0;">📥 Vorlesungs-Mindmap (JSON) importieren</h3>
                <p style="font-size:0.85rem; color:#94a3b8; margin-bottom:0.5rem;">
                    Füge hier das JSON ein, das du mit dem Vorlesungs-Prompt aus deinen Unterlagen generiert hast. Es wird automatisch validiert und in Supabase gespeichert.
                </p>
                <textarea id="mm-import-textarea" class="mm-textarea" placeholder='{\n  "id": "mm_neuro_01",\n  "title": "...",\n  "central_concept": "...",\n  "nodes": [ ... ]\n}'></textarea>
                <div id="mm-import-error" style="color:#ef4444; font-size:0.82rem; margin-bottom:0.75rem;"></div>
                <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
                    <button id="mm-modal-cancel" class="mm-btn">Abbrechen</button>
                    <button id="mm-modal-save" class="mm-btn mm-btn-primary">🚀 Mindmap laden & speichern</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalBackdrop);

        modalBackdrop.querySelector('#mm-modal-cancel').addEventListener('click', () => modalBackdrop.remove());
        modalBackdrop.querySelector('#mm-modal-save').addEventListener('click', async () => {
            const raw = modalBackdrop.querySelector('#mm-import-textarea').value.trim();
            const errEl = modalBackdrop.querySelector('#mm-import-error');
            try {
                // Falls das JSON in ```json ... ``` Codeblöcken steckt, bereinigen:
                const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
                const parsed = JSON.parse(cleaned);

                if (!parsed.central_concept || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
                    throw new Error('JSON muss "central_concept" und ein nicht-leeres Array "nodes" enthalten.');
                }

                parsed.id = parsed.id || `mm_custom_${Date.now()}`;
                parsed.title = parsed.title || parsed.central_concept;
                parsed.specialty = parsed.specialty || 'Vorlesung';

                await saveCustomMindmapToDb(parsed);
                await loadMindmapsAndProgress();
                selectMindmap(parsed.id);
                modalBackdrop.remove();
            } catch (err) {
                errEl.textContent = `Fehler beim Parsen: ${err.message}`;
            }
        });
    }

    // Globales API-Objekt für MedCheck
    window.MindmapModule = {
        init,
        openView,
        selectMindmap
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
