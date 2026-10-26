/**
 * MedCheck - Interactive Clinical Mindmap Module V3.0 (js/mindmap.js)
 * Upgrades in V3.0:
 *  - Zero Text-Selection Drag & Drop (e.preventDefault, getSelection().removeAllRanges, PointerCapture, body lock)
 *  - Expanded XXL Stage (2400 x 1600 px) with wide elliptical rings & collision repulsion
 *  - Auto-expanding HTML Edge Labels (never truncates long medical relation descriptions)
 *  - Full-text wrapping nodes (250-280px width) + Focus/Expand Mode toggle
 */

(function () {
    'use strict';

    const CATEGORIES = {
        etiology: { label: 'Ätiologie & Risiko', color: '#3b82f6', cssClass: 'cat-etiology', icon: '🧬' },
        pathophysiology: { label: 'Pathophysiologie', color: '#ef4444', cssClass: 'cat-pathophysiology', icon: '⚡' },
        clinical: { label: 'Klinik & Symptome', color: '#f59e0b', cssClass: 'cat-clinical', icon: '🩺' },
        diagnostics: { label: 'Diagnostik', color: '#8b5cf6', cssClass: 'cat-diagnostics', icon: '🔬' },
        therapy: { label: 'Therapie', color: '#10b981', cssClass: 'cat-therapy', icon: '💊' }
    };

    // Großzügig ausgedehnte XXL-Stage für 100% Text-Lesbarkeit ohne Gedränge
    const STAGE_WIDTH = 2400;
    const STAGE_HEIGHT = 1600;

    const BUILTIN_MINDMAPS = [
        {
            id: 'mm_cardio_stemi_001',
            title: 'Akutes Koronarsyndrom (STEMI)',
            specialty: 'Kardiologie',
            central_concept: 'STEMI (Transmurale Ischämie)',
            nodes: [
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
                    relation_label: 'Emboliequelle (90%)',
                    socratic_hint: 'Woher stammt der eingeschwemmte Thrombus in den allermeisten Fällen anatomisch?'
                },
                {
                    id: 'l2',
                    label: 'Abrupter Nachlastanstieg rechter Ventrikel',
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
                    relation_label: 'Initiales Leitsymptom',
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
                    label: 'Therapeutische Antikoagulation (DOAK/Heparin)',
                    category: 'therapy',
                    parent_id: 'root',
                    relation_label: 'Basistherapie',
                    socratic_hint: 'Welche medikamentöse Maßnahme stoppt sofort das appositionelle Thrombuswachstum?'
                },
                {
                    id: 'l6',
                    label: 'Obstruktiver Schock (RRsys < 90 mmHg)',
                    category: 'pathophysiology',
                    parent_id: 'l2',
                    relation_label: 'Dekompensation',
                    socratic_hint: 'Was passiert mit dem linksventrikulären Vorlast-Angebot und dem Systemblutdruck, wenn der rechte Ventrikel versagt?'
                },
                {
                    id: 'l7',
                    label: 'Systemische Thrombolyse (rt-PA / Alteplase)',
                    category: 'therapy',
                    parent_id: 'l6',
                    relation_label: 'Notfalltherapie Schock',
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
        hoveredNodeId: null,
        blindMode: false,
        showInspector: false,
        expandedCanvas: false,
        mistakesCount: 0,
        weakNodeIds: new Set(),
        startTime: null,
        nodePositions: {},
        progressCache: {},
        zoom: 0.65,
        panX: 0,
        panY: 0,
        isPanning: false
    };

    // ========================================================================
    // 1. INITIALISIERUNG & DOM-STRUKTUR
    // ========================================================================

    function clearBrowserTextSelection() {
        try {
            if (window.getSelection) {
                const sel = window.getSelection();
                if (sel && sel.removeAllRanges) sel.removeAllRanges();
            }
        } catch (_e) {}
    }

    function ensureDomStructure() {
        let viewSection = document.getElementById('mindmap-view');
        if (!viewSection) {
            const mainEl = document.querySelector('.content-body > div') || document.querySelector('main') || document.body;
            viewSection = document.createElement('section');
            viewSection.id = 'mindmap-view';
            viewSection.className = 'panel view-section hidden';
            viewSection.style.display = 'none';
            mainEl.appendChild(viewSection);
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
                fitStageToViewport();
                drawSvgConnections();
            }
        });
    }

    function isViewVisible() {
        const el = document.getElementById('mindmap-view');
        return el && !el.classList.contains('hidden') && el.style.display !== 'none';
    }

    function openView() {
        const viewSection = ensureDomStructure();
        viewSection.classList.remove('hidden');
        viewSection.style.display = 'block';

        if (!state.currentMap) {
            init();
        } else {
            renderModule();
            requestAnimationFrame(() => {
                fitStageToViewport();
                drawSvgConnections();
            });
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
        const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
        const localProgress = JSON.parse(localStorage.getItem('medcheck_mindmap_progress') || '{}');
        state.progressCache = localProgress;

        const mapById = new Map();
        BUILTIN_MINDMAPS.forEach(m => mapById.set(m.id, m));
        localSaved.forEach(m => mapById.set(m.id, m));

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
        const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
        const filtered = localSaved.filter(m => m.id !== mindmapObj.id);
        filtered.unshift(mindmapObj);
        localStorage.setItem('medcheck_custom_mindmaps', JSON.stringify(filtered));

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
                console.warn('[Mindmap] Lokal gesichert:', err);
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

        if (typeof window.applyXpDelta === 'function') {
            window.applyXpDelta(250, 'Mindmap vernetzt');
        }

        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
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
                console.warn('[Mindmap] Fortschritt lokal gespeichert:', err);
            }
        }
    }

    // ========================================================================
    // 3. WEIT AUSGEDEHNTER 2-RING-ALGORITHMUS (2400 x 1600 XXL-STAGE)
    // ========================================================================

    function computeRadialLayout(mindmap) {
        const centerX = STAGE_WIDTH / 2;   // 1200px
        const centerY = STAGE_HEIGHT / 2;  // 800px

        const positions = {
            root: { x: centerX, y: centerY, angle: 0, level: 0 }
        };

        const nodes = mindmap.nodes || [];
        const firstOrder = nodes.filter(n => !n.parent_id || n.parent_id === 'root');
        const secondOrder = nodes.filter(n => n.parent_id && n.parent_id !== 'root');

        const childrenByParent = {};
        secondOrder.forEach(n => {
            if (!childrenByParent[n.parent_id]) childrenByParent[n.parent_id] = [];
            childrenByParent[n.parent_id].push(n);
        });

        const count1 = firstOrder.length || 1;
        // Weit ausgedehnter 1. Ring -> volle Sichtbarkeit für alle Verbindungs-Badges!
        const radius1X = 500;
        const radius1Y = 350;

        firstOrder.forEach((node, idx) => {
            const angle = (-Math.PI / 2) + (idx * 2 * Math.PI) / count1;
            positions[node.id] = {
                x: centerX + radius1X * Math.cos(angle),
                y: centerY + radius1Y * Math.sin(angle),
                angle,
                level: 1
            };
        });

        // Weit ausgedehnter 2. Ring -> 420px Abstand zum 1. Ring!
        const radius2X = 940;
        const radius2Y = 640;

        Object.keys(childrenByParent).forEach(parentId => {
            const parentPos = positions[parentId] || { x: centerX, y: centerY, angle: 0 };
            const children = childrenByParent[parentId];
            const spread = Math.min(Math.PI / 2.2, children.length * 0.42);

            children.forEach((child, i) => {
                let offset = 0;
                if (children.length > 1) {
                    offset = -spread / 2 + (i * spread) / (children.length - 1);
                }
                const childAngle = (parentPos.angle || 0) + offset;
                positions[child.id] = {
                    x: Math.max(180, Math.min(STAGE_WIDTH - 180, centerX + radius2X * Math.cos(childAngle))),
                    y: Math.max(110, Math.min(STAGE_HEIGHT - 110, centerY + radius2Y * Math.sin(childAngle))),
                    angle: childAngle,
                    level: 2
                };
            });
        });

        // Starke physikalische Entzerrung (Repulsion) mit 330px horizontalem & 165px vertikalem Puffer
        const nodeIds = Object.keys(positions).filter(id => id !== 'root');
        for (let iter = 0; iter < 24; iter++) {
            for (let i = 0; i < nodeIds.length; i++) {
                for (let j = i + 1; j < nodeIds.length; j++) {
                    const a = positions[nodeIds[i]];
                    const b = positions[nodeIds[j]];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const minDx = 330;
                    const minDy = 165;

                    if (Math.abs(dx) < minDx && Math.abs(dy) < minDy) {
                        const pushX = ((minDx - Math.abs(dx)) / 2) * (dx >= 0 ? 1 : -1);
                        const pushY = ((minDy - Math.abs(dy)) / 2) * (dy >= 0 ? 1 : -1);

                        if (Math.abs(dx) < minDx * 0.65) {
                            a.y = Math.max(105, Math.min(STAGE_HEIGHT - 105, a.y - pushY * 0.75));
                            b.y = Math.max(105, Math.min(STAGE_HEIGHT - 105, b.y + pushY * 0.75));
                        } else {
                            a.x = Math.max(175, Math.min(STAGE_WIDTH - 175, a.x - pushX * 0.65));
                            b.x = Math.max(175, Math.min(STAGE_WIDTH - 175, b.x + pushX * 0.65));
                        }
                    }
                }
            }
        }

        state.nodePositions = positions;
    }

    // ========================================================================
    // 4. INTELLIGENTES BOUNDING-BOX AUTO-FIT & PAN/ZOOM
    // ========================================================================

    function fitStageToViewport() {
        const viewport = document.getElementById('mm-canvas-viewport');
        if (!viewport) return;

        const vw = viewport.clientWidth || 960;
        const vh = viewport.clientHeight || 740;

        // Berechne die tatsächliche Bounding-Box aller aktiven Knoten auf der Stage
        const pts = Object.values(state.nodePositions);
        if (pts.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
            if (p.x - 180 < minX) minX = p.x - 180;
            if (p.x + 180 > maxX) maxX = p.x + 180;
            if (p.y - 110 < minY) minY = p.y - 110;
            if (p.y + 110 > maxY) maxY = p.y + 110;
        });

        const contentW = Math.max(800, maxX - minX);
        const contentH = Math.max(600, maxY - minY);
        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;

        const scaleX = (vw - 60) / contentW;
        const scaleY = (vh - 80) / contentH;
        const bestScale = Math.max(0.48, Math.min(1.05, Math.min(scaleX, scaleY)));

        state.zoom = Number(bestScale.toFixed(2));
        state.panX = Math.round(vw / 2 - contentCenterX * state.zoom);
        state.panY = Math.round(vh / 2 - contentCenterY * state.zoom);

        applyStageTransform();
    }

    function applyStageTransform() {
        const stage = document.getElementById('mm-stage');
        const zoomLabel = document.getElementById('mm-zoom-label');
        if (stage) {
            stage.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
        }
        if (zoomLabel) {
            zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
        }
    }

    function adjustZoom(delta) {
        const viewport = document.getElementById('mm-canvas-viewport');
        if (!viewport) return;

        const oldZoom = state.zoom;
        const newZoom = Math.max(0.38, Math.min(1.6, Number((oldZoom + delta).toFixed(2))));
        if (newZoom === oldZoom) return;

        const cx = viewport.clientWidth / 2;
        const cy = viewport.clientHeight / 2;
        state.panX = Math.round(cx - ((cx - state.panX) / oldZoom) * newZoom);
        state.panY = Math.round(cy - ((cy - state.panY) / oldZoom) * newZoom);
        state.zoom = newZoom;

        applyStageTransform();
    }

    // ========================================================================
    // 5. RENDERING & INTERAKTION
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
        requestAnimationFrame(() => {
            fitStageToViewport();
            drawSvgConnections();
        });
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

    function getParentLabel(node) {
        if (!node.parent_id || node.parent_id === 'root') {
            return state.currentMap.central_concept;
        }
        const parent = state.currentMap.nodes.find(n => n.id === node.parent_id);
        return parent ? parent.label : state.currentMap.central_concept;
    }

    function isParentSolvedOrRoot(node) {
        if (!node.parent_id || node.parent_id === 'root') return true;
        return state.solvedNodeIds.has(node.parent_id);
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

        const remainingNodes = shuffleArray(map.nodes.filter(n => !state.solvedNodeIds.has(n.id)));

        container.innerHTML = `
            <div class="mindmap-wrapper">
                <!-- TOP HEADER -->
                <div class="mm-header">
                    <div class="mm-title-group">
                        <h2>🕸️ Klinisches Mindmap-Labor</h2>
                        <p>Ziehe die Begriffe auf die passenden Knoten. Jede Verbindungslinie und jedes Knoten-Banner zeigt dir die genaue kausale Beziehung.</p>
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

                        <button id="mm-toggle-expand" class="mm-btn ${state.expandedCanvas ? 'active' : ''}" title="Mindmap auf volle Breite ausdehnen">
                            ${state.expandedCanvas ? '📐 Standard-Ansicht' : '🔭 Großansicht (Breit)'}
                        </button>

                        <button id="mm-toggle-blind" class="mm-btn mm-btn-blind ${state.blindMode ? 'active' : ''}" title="Verbirgt die Kategoriefarben vor dem Lösen gegen Test-Wiseness">
                            ${state.blindMode ? '🕶️ Prüfungs-Modus (Blind)' : '🎨 Lern-Modus (Farben)'}
                        </button>

                        <button id="mm-btn-inspector" class="mm-btn ${state.showInspector ? 'active' : ''}" title="Zeigt alle kausalen Verbindungen als übersichtliche Baumstruktur">
                            🧭 Verbindungs-Baum
                        </button>

                        <button id="mm-btn-reset" class="mm-btn" title="Mindmap zurücksetzen">
                            🔄 Reset
                        </button>

                        <button id="mm-btn-prompt" class="mm-btn" title="Deep-Prompt für Vorlesungs-Extraktion kopieren">
                            📋 Deep-Prompt
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
                                <span>${cfg.icon} ${escapeHtml(cfg.label)}</span>
                            </span>
                        `).join('')}
                    </div>
                    <div class="mm-stats">
                        <span class="mm-stat-badge" id="mm-stat-progress">🧩 Gelöst: ${solvedCount} / ${totalNodes}</span>
                        <span class="mm-stat-badge" id="mm-stat-mistakes">⚠️ Fehlversuche: ${state.mistakesCount}</span>
                        ${savedProg?.best_time_sec ? `<span class="mm-stat-badge">⏱️ Bestzeit: ${savedProg.best_time_sec}s</span>` : ''}
                    </div>
                </div>

                <!-- OPTIONALER KAUSALKETTEN-INSPEKTOR -->
                ${state.showInspector ? renderInspectorPanel(map) : ''}

                <!-- WORKSPACE -->
                <div class="mm-workspace ${state.expandedCanvas ? 'mm-workspace-expanded' : ''}">
                    <!-- LINKE SPALTE: BEGRIFFS-POOL & SOKRATISCHER TUTOR -->
                    <div class="mm-sidebar-panel">
                        <div class="mm-pool-box">
                            <div class="mm-box-header">
                                <span class="mm-box-title">📦 Extrahierte Begriffe (${remainingNodes.length})</span>
                                <span class="mm-box-sub">Ziehen oder Klicken</span>
                            </div>
                            <div id="mm-chip-pool" class="mm-chip-list">
                                ${remainingNodes.length === 0 ? `
                                    <div class="mm-all-solved-banner">
                                        🎉 Alle Begriffe erfolgreich vernetzt!
                                    </div>
                                ` : remainingNodes.map(node => {
                                    const catCfg = CATEGORIES[node.category];
                                    const catClass = state.blindMode ? 'cat-blind' : (catCfg?.cssClass || 'cat-blind');
                                    const isSelected = state.selectedChipId === node.id ? 'selected-chip' : '';
                                    const catBadge = state.blindMode ? '' : `<span class="mm-chip-cat-tag">${escapeHtml(catCfg?.label || '')}</span>`;
                                    return `
                                        <div class="mm-chip ${catClass} ${isSelected}"
                                             data-node-id="${escapeHtml(node.id)}"
                                             draggable="false"
                                             title="Ziehe diesen Begriff auf den passenden Ziel-Knoten oder klicke ihn an">
                                            ${catBadge}
                                            <span class="mm-chip-label">${escapeHtml(node.label)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- SOKRATISCHES AI-FEEDBACK PANEL -->
                        <div class="mm-tutor-box">
                            <div class="mm-box-header">
                                <span class="mm-box-title">🏛️ Sokratischer KI-Tutor</span>
                                <span class="mm-tutor-bloom">Bloom: Analyse & Synthese</span>
                            </div>
                            <div id="mm-tutor-message" class="mm-tutor-content">
                                Klicke auf einen offenen Ziel-Knoten in der Mindmap, um eine <strong>sokratische Leitfrage</strong> zu erhalten, oder ziehe direkt einen Begriff darauf!
                            </div>
                        </div>
                    </div>

                    <!-- RECHTE SPALTE: INTERAKTIVES XXL PAN & ZOOM MINDMAP-CANVAS -->
                    <div id="mm-canvas-viewport" class="mm-canvas-container">
                        <div class="mm-canvas-HUD">
                            <button type="button" class="mm-hud-btn" id="mm-zoom-out" title="Herauszoomen">➖</button>
                            <span id="mm-zoom-label" class="mm-hud-zoom-text">65%</span>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-in" title="Hineinzoomen">➕</button>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-100" title="100% Originalgröße für maximale Lesbarkeit">100%</button>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-fit" title="Gesamte Mindmap einpassen">🎯 Alles zeigen</button>
                        </div>

                        <div class="mm-canvas-help-pill">
                            🖱️ Hintergrund ziehen zum Verschieben • Mausrad zum Zoomen • Knoten anklicken für sokratischen Tipp
                        </div>

                        <!-- TRANSFORMABLE XXL STAGE (2400 x 1600) -->
                        <div id="mm-stage" class="mm-stage" style="width:${STAGE_WIDTH}px; height:${STAGE_HEIGHT}px;">
                            <svg id="mm-svg" class="mm-svg-layer" viewBox="0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}"></svg>
                            <!-- HTML-Layer für niemals abgeschnittene Verbindungs-Schilder auf den Linien -->
                            <div id="mm-edge-labels-layer" class="mm-edge-labels-layer"></div>
                            <div id="mm-nodes" class="mm-nodes-layer">
                                <!-- ZENTRALER WURZEL-KNOTEN -->
                                <div class="mm-node mm-node-root"
                                     id="mm-node-dom-root"
                                     style="left: ${STAGE_WIDTH / 2}px; top: ${STAGE_HEIGHT / 2}px;"
                                     data-node-pos="root">
                                    <span class="mm-root-badge">🎯 ZENTRALKONZEPT • ${escapeHtml(map.specialty)}</span>
                                    <span class="mm-root-title">${escapeHtml(map.central_concept)}</span>
                                </div>

                                <!-- ZIEL-SLOTS / GELÖSTE KNOTEN -->
                                ${map.nodes.map(node => renderCanvasNode(node)).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderInspectorPanel(map) {
        const firstOrder = map.nodes.filter(n => !n.parent_id || n.parent_id === 'root');
        const secondOrder = map.nodes.filter(n => n.parent_id && n.parent_id !== 'root');

        return `
            <div class="mm-inspector-panel">
                <div class="mm-inspector-header">
                    <strong>🧭 Logische Kausalstruktur dieser Mindmap (${escapeHtml(map.central_concept)})</strong>
                    <span>Grün = bereits gelöst • Grau = noch offen</span>
                </div>
                <div class="mm-inspector-grid">
                    ${firstOrder.map(parent => {
                        const pSolved = state.solvedNodeIds.has(parent.id);
                        const pCat = CATEGORIES[parent.category]?.label || parent.category;
                        const children = secondOrder.filter(c => c.parent_id === parent.id);

                        return `
                            <div class="mm-inspector-branch">
                                <div class="mm-inspector-step ${pSolved ? 'is-solved' : ''}">
                                    <span class="mm-ins-rel">🎯 Zentrum ➔ <em>${escapeHtml(parent.relation_label || 'Verbindung')}</em>:</span>
                                    <strong class="mm-ins-target">
                                        ${pSolved ? `✅ ${escapeHtml(parent.label)}` : `❓ [${escapeHtml(pCat)} gesucht]`}
                                    </strong>
                                </div>
                                ${children.map(child => {
                                    const cSolved = state.solvedNodeIds.has(child.id);
                                    const cCat = CATEGORIES[child.category]?.label || child.category;
                                    return `
                                        <div class="mm-inspector-substep ${cSolved ? 'is-solved' : ''}">
                                            <span class="mm-ins-rel">↳ <em>${escapeHtml(child.relation_label || 'führt zu')}</em>:</span>
                                            <strong class="mm-ins-target">
                                                ${cSolved ? `✅ ${escapeHtml(child.label)}` : `❓ [${escapeHtml(cCat)} gesucht]`}
                                            </strong>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function renderCanvasNode(node) {
        const pos = state.nodePositions[node.id] || { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2, level: 1 };
        const isSolved = state.solvedNodeIds.has(node.id);
        const catCfg = CATEGORIES[node.category] || { label: 'Konzept', cssClass: 'cat-blind', icon: '🔹' };
        const relationText = node.relation_label || 'Verbindung';
        const isSecondOrder = node.parent_id && node.parent_id !== 'root';
        const parentSolved = isParentSolvedOrRoot(node);

        // Vollständiger Herkunftstext ohne enges Abschneiden
        let originPrefix = `🎯 Vom Zentrum (${state.currentMap.central_concept})`;
        if (isSecondOrder) {
            originPrefix = parentSolved
                ? `↳ Ausgehend von: „${getParentLabel(node)}“`
                : `↳ Folgeschritt (2. Ebene – löse zuerst den Vorgänger-Knoten)`;
        }

        if (isSolved) {
            return `
                <div class="mm-node mm-node-solved ${catCfg.cssClass}"
                     id="mm-node-dom-${escapeHtml(node.id)}"
                     style="left: ${pos.x}px; top: ${pos.y}px;"
                     data-slot-id="${escapeHtml(node.id)}">
                    <div class="mm-node-rel-banner">
                        <span class="mm-rel-origin">${escapeHtml(originPrefix)}</span>
                        <strong class="mm-rel-verb">➔ ${escapeHtml(relationText)}</strong>
                    </div>
                    <div class="mm-node-body-solved">
                        <span class="mm-solved-cat-pill">${catCfg.icon} ${escapeHtml(catCfg.label)}</span>
                        <div class="mm-solved-title">${escapeHtml(node.label)}</div>
                    </div>
                </div>
            `;
        }

        const slotCatClass = state.blindMode ? 'cat-blind' : catCfg.cssClass;
        const slotHintLabel = state.blindMode ? '❓ Offener Begriff' : `${catCfg.icon} ${catCfg.label}`;

        return `
            <div class="mm-node mm-node-slot ${slotCatClass} ${isSecondOrder ? 'mm-node-second-order' : ''}"
                 id="mm-node-dom-${escapeHtml(node.id)}"
                 style="left: ${pos.x}px; top: ${pos.y}px;"
                 data-slot-id="${escapeHtml(node.id)}"
                 title="Klicken für sokratische Leitfrage oder Begriff hier ablegen">
                <div class="mm-node-rel-banner">
                    <span class="mm-rel-origin">${escapeHtml(originPrefix)}</span>
                    <strong class="mm-rel-verb">➔ ${escapeHtml(relationText)}</strong>
                </div>
                <div class="mm-slot-inner">
                    <span class="mm-slot-hint">${escapeHtml(slotHintLabel)}</span>
                    <span class="mm-slot-cta">Passenden Begriff hierhin ziehen</span>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // 6. BOX-EDGE-CLIPPING & AUTO-EXPANDIERENDE HTML-KANTEN-LABELS
    // ========================================================================

    function getBoxBorderPoint(cx, cy, halfW, halfH, tx, ty, extraPad = 6) {
        const dx = tx - cx;
        const dy = ty - cy;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return { x: cx, y: cy };

        const w = halfW + extraPad;
        const h = halfH + extraPad;

        const scaleX = Math.abs(dx) > 0.001 ? w / Math.abs(dx) : Infinity;
        const scaleY = Math.abs(dy) > 0.001 ? h / Math.abs(dy) : Infinity;
        const scale = Math.min(scaleX, scaleY);

        return {
            x: cx + dx * scale,
            y: cy + dy * scale
        };
    }

    function getNodeHalfDimensions(nodeId) {
        const domEl = document.getElementById(`mm-node-dom-${nodeId}`);
        if (domEl && domEl.offsetWidth > 0 && domEl.offsetHeight > 0) {
            return { halfW: domEl.offsetWidth / 2, halfH: domEl.offsetHeight / 2 };
        }
        if (nodeId === 'root') return { halfW: 145, halfH: 54 };
        return { halfW: 132, halfH: 58 };
    }

    function drawSvgConnections() {
        const svg = document.getElementById('mm-svg');
        const edgeLabelsLayer = document.getElementById('mm-edge-labels-layer');
        if (!svg || !state.currentMap) return;

        let defsHtml = `
            <defs>
                <marker id="mm-arrow-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
                ${Object.entries(CATEGORIES).map(([key, cfg]) => `
                    <marker id="mm-arrow-${key}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="${cfg.color}" />
                    </marker>
                `).join('')}
            </defs>
        `;

        let pathsHtml = '';
        let htmlBadges = '';

        state.currentMap.nodes.forEach(node => {
            const parentId = node.parent_id || 'root';
            const fromCenter = state.nodePositions[parentId] || { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 };
            const toCenter = state.nodePositions[node.id] || { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 };

            const fromDim = getNodeHalfDimensions(parentId);
            const toDim = getNodeHalfDimensions(node.id);

            const startPt = getBoxBorderPoint(fromCenter.x, fromCenter.y, fromDim.halfW, fromDim.halfH, toCenter.x, toCenter.y, 4);
            const endPt = getBoxBorderPoint(toCenter.x, toCenter.y, toDim.halfW, toDim.halfH, fromCenter.x, fromCenter.y, 10);

            const x1 = startPt.x;
            const y1 = startPt.y;
            const x2 = endPt.x;
            const y2 = endPt.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const cx1 = x1 + dx * 0.35;
            const cy1 = y1 + dy * 0.15;
            const cx2 = x1 + dx * 0.65;
            const cy2 = y1 + dy * 0.85;

            const isSolved = state.solvedNodeIds.has(node.id);
            const isHovered = state.hoveredNodeId === node.id || state.hoveredNodeId === parentId;
            const catCfg = CATEGORIES[node.category];
            const showColor = isSolved || !state.blindMode;
            const strokeColor = showColor && catCfg ? catCfg.color : '#94a3b8';
            const markerId = showColor && catCfg ? `mm-arrow-${node.category}` : 'mm-arrow-default';

            pathsHtml += `
                <path class="mm-edge-path ${isSolved ? 'solved-edge' : ''} ${isHovered ? 'hovered-edge' : ''}"
                      d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}"
                      style="stroke: ${strokeColor};"
                      marker-end="url(#${markerId})" />
            `;

            // Echte HTML-Badges auf dem Mittelpunkt der sichtbaren Linie (passt sich jedem Text flexibel an!)
            if (node.relation_label) {
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                htmlBadges += `
                    <div class="mm-edge-html-badge ${isHovered ? 'is-hovered' : ''}"
                         style="left:${midX.toFixed(1)}px; top:${midY.toFixed(1)}px; border-color:${strokeColor};">
                        ${escapeHtml(node.relation_label)}
                    </div>
                `;
            }
        });

        svg.innerHTML = defsHtml + pathsHtml;
        if (edgeLabelsLayer) {
            edgeLabelsLayer.innerHTML = htmlBadges;
        }
    }

    // ========================================================================
    // 7. EVENT-BINDING (ZERO-SELECTION DRAG & DROP, ZOOM, PAN)
    // ========================================================================

    function bindEvents() {
        document.getElementById('mm-map-selector')?.addEventListener('change', e => selectMindmap(e.target.value));

        document.getElementById('mm-toggle-expand')?.addEventListener('click', () => {
            state.expandedCanvas = !state.expandedCanvas;
            renderModule();
            requestAnimationFrame(() => {
                fitStageToViewport();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-toggle-blind')?.addEventListener('click', () => {
            state.blindMode = !state.blindMode;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-btn-inspector')?.addEventListener('click', () => {
            state.showInspector = !state.showInspector;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

        document.getElementById('mm-btn-reset')?.addEventListener('click', () => {
            if (state.currentMap) selectMindmap(state.currentMap.id);
        });

        document.getElementById('mm-btn-prompt')?.addEventListener('click', copyExtractionPrompt);
        document.getElementById('mm-btn-import')?.addEventListener('click', openImportModal);

        // Zoom Controls
        document.getElementById('mm-zoom-in')?.addEventListener('click', () => adjustZoom(0.14));
        document.getElementById('mm-zoom-out')?.addEventListener('click', () => adjustZoom(-0.14));
        document.getElementById('mm-zoom-100')?.addEventListener('click', () => {
            const delta = 1.0 - state.zoom;
            adjustZoom(delta);
        });
        document.getElementById('mm-zoom-fit')?.addEventListener('click', () => fitStageToViewport());

        // Viewport Panning & Mousewheel Zoom (ohne Text-Markierung!)
        const viewport = document.getElementById('mm-canvas-viewport');
        if (viewport) {
            viewport.addEventListener('wheel', e => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                adjustZoom(delta);
            }, { passive: false });

            viewport.addEventListener('pointerdown', e => {
                if (e.target.closest('.mm-node') || e.target.closest('.mm-canvas-HUD')) return;
                // Verhindert sofort jegliche Textmarkierung beim Ziehen des Hintergrunds
                e.preventDefault();
                clearBrowserTextSelection();

                state.isPanning = true;
                viewport.classList.add('is-panning');
                document.body.classList.add('mm-dragging-active');

                const startX = e.clientX - state.panX;
                const startY = e.clientY - state.panY;

                function onPanMove(moveEv) {
                    if (!state.isPanning) return;
                    moveEv.preventDefault();
                    state.panX = moveEv.clientX - startX;
                    state.panY = moveEv.clientY - startY;
                    applyStageTransform();
                }

                function onPanUp() {
                    state.isPanning = false;
                    viewport.classList.remove('is-panning');
                    document.body.classList.remove('mm-dragging-active');
                    window.removeEventListener('pointermove', onPanMove);
                    window.removeEventListener('pointerup', onPanUp);
                    window.removeEventListener('pointercancel', onPanUp);
                }

                window.addEventListener('pointermove', onPanMove, { passive: false });
                window.addEventListener('pointerup', onPanUp);
                window.addEventListener('pointercancel', onPanUp);
            });
        }

        // Chips: Zero-Selection Pointer-Drag + Click-to-Select
        document.querySelectorAll('.mm-chip').forEach(chip => {
            // Verhindert natives HTML5-Drag-Verhalten & Textselektion
            chip.addEventListener('dragstart', e => e.preventDefault());
            chip.addEventListener('selectstart', e => e.preventDefault());
            chip.addEventListener('pointerdown', onChipPointerDown);
        });

        // Ziel-Slots & Gelöste Knoten: Hover & Click
        document.querySelectorAll('.mm-node[data-slot-id]').forEach(nodeEl => {
            const slotId = nodeEl.getAttribute('data-slot-id');

            nodeEl.addEventListener('mouseenter', () => {
                state.hoveredNodeId = slotId;
                drawSvgConnections();
            });

            nodeEl.addEventListener('mouseleave', () => {
                state.hoveredNodeId = null;
                drawSvgConnections();
            });

            if (nodeEl.classList.contains('mm-node-slot')) {
                nodeEl.addEventListener('click', () => {
                    if (state.selectedChipId) {
                        evaluateDropAttempt(state.selectedChipId, slotId, nodeEl);
                    } else {
                        showSlotSocraticHint(slotId);
                    }
                });
            }
        });
    }

    function onChipPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;

        // KRITISCH: Verhindert sofort, dass der Browser Text im Chip oder auf der Seite markiert!
        e.preventDefault();
        e.stopPropagation();
        clearBrowserTextSelection();

        const chip = e.currentTarget;
        const nodeId = chip.getAttribute('data-node-id');
        const pointerId = e.pointerId;
        const startX = e.clientX;
        const startY = e.clientY;
        let isDragging = false;
        let ghostEl = null;

        document.body.classList.add('mm-dragging-active');
        try {
            if (chip.setPointerCapture) chip.setPointerCapture(pointerId);
        } catch (_err) {}

        function onPointerMove(moveEvent) {
            moveEvent.preventDefault();
            clearBrowserTextSelection();

            const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
            if (!isDragging && dist > 5) {
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

                document.querySelectorAll('.mm-node-slot').forEach(s => s.classList.remove('drag-over'));
                const targetSlot = findSlotUnderPoint(moveEvent.clientX, moveEvent.clientY);
                if (targetSlot) targetSlot.classList.add('drag-over');
            }
        }

        function onPointerUp(upEvent) {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            document.body.classList.remove('mm-dragging-active');

            try {
                if (chip.releasePointerCapture) chip.releasePointerCapture(pointerId);
            } catch (_err) {}

            if (isDragging) {
                chip.classList.remove('dragging');
                if (ghostEl) ghostEl.remove();
                document.querySelectorAll('.mm-node-slot').forEach(s => s.classList.remove('drag-over'));

                const targetSlot = findSlotUnderPoint(upEvent.clientX, upEvent.clientY);
                if (targetSlot) {
                    const slotId = targetSlot.getAttribute('data-slot-id');
                    evaluateDropAttempt(nodeId, slotId, targetSlot);
                }
            } else {
                // Es war ein kurzer Klick ohne Ziehen -> Chip auswählen / abwählen (Click-to-Place)
                state.selectedChipId = (state.selectedChipId === nodeId) ? null : nodeId;
                document.querySelectorAll('.mm-chip').forEach(c => {
                    c.classList.toggle('selected-chip', c.getAttribute('data-node-id') === state.selectedChipId);
                });
            }
        }

        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
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
    // 8. AUSWERTUNG & SOKRATISCHE AI-FEEDBACK-SCHLEIFE (/api/gemini)
    // ========================================================================

    async function evaluateDropAttempt(draggedNodeId, targetSlotId, slotElement) {
        const map = state.currentMap;
        if (!map) return;

        const draggedNode = map.nodes.find(n => n.id === draggedNodeId);
        const targetNode = map.nodes.find(n => n.id === targetSlotId);
        if (!draggedNode || !targetNode) return;

        if (draggedNode.id === targetNode.id) {
            state.solvedNodeIds.add(targetNode.id);
            state.selectedChipId = null;

            const savedZoom = state.zoom;
            const savedPanX = state.panX;
            const savedPanY = state.panY;

            renderModule();
            state.zoom = savedZoom;
            state.panX = savedPanX;
            state.panY = savedPanY;

            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);

            const tutorEl = document.getElementById('mm-tutor-message');
            if (tutorEl) {
                const parentLabel = getParentLabel(targetNode);
                tutorEl.innerHTML = `
                    <strong style="color:#10b981;">✅ Exakt richtig vernetzt!</strong><br>
                    <strong>„${escapeHtml(targetNode.label)}“</strong> ist über die Relation <em>„${escapeHtml(targetNode.relation_label || 'Verbindung')}“</em> direkt mit <strong>„${escapeHtml(parentLabel)}“</strong> verknüpft.
                `;
            }

            if (state.solvedNodeIds.size === map.nodes.length) {
                await saveProgressToDb();
                if (tutorEl) {
                    tutorEl.innerHTML = `
                        <strong style="color:#10b981;">🏆 Mindmap vollständig gelöst (+250 XP)!</strong><br>
                        Dein Fortschritt (${state.mistakesCount} Fehlversuche) wurde gespeichert.
                    `;
                }
            }
            return;
        }

        state.mistakesCount += 1;
        state.weakNodeIds.add(targetNode.id);

        const mistakesBadge = document.getElementById('mm-stat-mistakes');
        if (mistakesBadge) {
            mistakesBadge.textContent = `⚠️ Fehlversuche: ${state.mistakesCount}`;
        }

        if (slotElement) {
            slotElement.classList.remove('mm-node-error');
            void slotElement.offsetWidth;
            slotElement.classList.add('mm-node-error');
        }

        await triggerSocraticFeedback(draggedNode, targetNode);
    }

    function showSlotSocraticHint(slotId) {
        const targetNode = state.currentMap?.nodes.find(n => n.id === slotId);
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!targetNode || !tutorEl) return;

        const parentLabel = getParentLabel(targetNode);
        tutorEl.innerHTML = `
            <strong style="color:#38bdf8;">💡 Sokratischer Hinweis für diesen Knoten:</strong><br>
            Gesucht wird die Verbindung: <strong>„${escapeHtml(parentLabel)}“</strong> ➔ <em>„${escapeHtml(targetNode.relation_label || '')}“</em>.<br>
            <span style="display:block; margin-top:6px;">${escapeHtml(targetNode.socratic_hint || 'Überlege, welcher Begriff aus dem Pool kausal an diese Stelle gehört.')}</span>
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

            const aiText = data.text
                || data.generatedText
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
            const catMismatch = draggedNode.category !== targetNode.category
                ? `Du hast mit <strong>„${escapeHtml(draggedNode.label)}“</strong> einen Begriff aus dem Bereich <em>${escapeHtml(draggedCat)}</em> gewählt, aber dieser Knoten sucht nach einem Konzept der <em>${escapeHtml(targetCat)}</em>.`
                : `<strong>„${escapeHtml(draggedNode.label)}“</strong> stammt zwar ebenfalls aus dem Bereich <em>${escapeHtml(draggedCat)}</em>, passt aber kausal nicht zur Relation <em>„${escapeHtml(targetNode.relation_label)}“</em> ausgehend von <strong>„${escapeHtml(parentLabel)}“</strong>.`;

            tutorEl.innerHTML = `
                <strong style="color:#f59e0b;">🤔 Sokratische Rückfrage:</strong><br>
                ${catMismatch}<br>
                <strong style="color:#38bdf8; display:block; margin-top:5px;">Leitfrage:</strong> ${escapeHtml(targetNode.socratic_hint || 'Welche direkte Konsequenz oder Maßnahme ergibt sich hier?')}
            `;
        }
    }

    // ========================================================================
    // 9. VORLESUNGS-PROMPT KOPIERER & JSON-IMPORT MODAL
    // ========================================================================

    function copyExtractionPrompt() {
        const promptTemplate = `# ROLLE & ZIEL
Du bist ein medizinischer Facharzt-Tutor (Staatsexamensniveau) und Daten-Architekt für das MedCheck Mindmap-Labor.
Extrahiere aus dem folgenden Vorlesungstext die TIEFSTEN pathophysiologischen, molekularbiologischen, diagnostischen und therapeutischen Details und überführe sie in ein direkt importierbares, valides JSON-Objekt.

# 1. INHALTLICHE REGELN (ZERO-SUPERFICIALITY)
1. KEINE OBERFLÄCHLICHKEITEN: Begriffe wie "Blutbild", "MRT", "Entzündung" oder "Medikamente" sind verboten! Extrahiere exakte Rezeptoren, Ionenkanäle, Autoantikörper, Genmutationen, pathognomonische Zeichen, spezifische Sequenzen, exakte Cutoffs mit Einheiten und Wirkstoffe inkl. Mechanismus/Kontraindikation.
2. 2-RING-TOPOLOGIE:
   - Erstelle insgesamt 10 bis 12 Knoten in "nodes".
   - 5 Knoten sind Hauptäste 1. Ordnung ("parent_id": "root") und decken alle 5 Kategorien ab ("etiology", "pathophysiology", "clinical", "diagnostics", "therapy").
   - 5 bis 7 Knoten sind Vertiefungsäste 2. Ordnung ("parent_id": "n1" etc.), die einen Hauptast kausal weiterführen. Keine 3. Ebene!
3. KOMPAKTE UI-LABELS:
   - "label": Maximal 50 Zeichen.
   - "relation_label": Präzises kausales Verb/Beziehung (z.B. "oxidiert Co2+ in", "Goldstandard bei", "kontraindiziert wegen").
4. SOKRATISCHE LEITFRAGEN ("socratic_hint"):
   - Formuliere eine gezielte Frage, die über den Mechanismus auf den Begriff hinführt, OHNE das Wort aus "label" zu verraten!

# 2. STRIKTES JSON-SCHEMA (Antworte NUR mit reinem JSON ohne Markdown-Block)
{
  "id": "mm_fach_thema_001",
  "title": "Prägnanter Titel der Vorlesung / Erkrankung",
  "specialty": "Fachgebiet",
  "central_concept": "Zentrale Leitdiagnose / Hauptkonzept",
  "nodes": [
    {
      "id": "n1",
      "label": "Tiefendetail 1. Ordnung",
      "category": "etiology | pathophysiology | clinical | diagnostics | therapy",
      "parent_id": "root",
      "relation_label": "Kausale Relation",
      "socratic_hint": "Sokratische Frage ohne Lösungsspoiler?"
    }
  ]
}

Hier ist der Vorlesungstext:
[HIER VORLESUNGSTEXT EINFÜGEN]`;

        navigator.clipboard.writeText(promptTemplate).then(() => {
            const btn = document.getElementById('mm-btn-prompt');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '✅ Deep-Prompt kopiert!';
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
                    Füge hier das JSON ein, das du mit dem Mindmap-Extraktor aus deinen Unterlagen generiert hast.
                </p>
                <textarea id="mm-import-textarea" class="mm-textarea" placeholder='{\n  "id": "mm_pharma_opioids_001",\n  "title": "...",\n  "central_concept": "...",\n  "nodes": [ ... ]\n}'></textarea>
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
                const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
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
