/**
 * MedCheck - Interactive Clinical Mindmap Module V4.0 (js/mindmap.js)
 * Upgrades in V4.0:
 *  - Full Delete Function (LocalStorage + Supabase Cloud DELETE + Built-in Hide/Restore)
 *  - Progressive Causal Unlocking: 2nd-order nodes unlock dynamically once their 1st-order parent is solved
 *  - Step-by-Step Clinical Reasoning & Pearl Confirmation on every solved node
 *  - Active Pool Filtering (highlights 1st-order vs. unlocked 2nd-order concepts)
 *  - Zero Text-Selection Drag & Drop + 2400x1600 XXL Stage with Auto-Fit
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

    const STAGE_WIDTH = 2400;
    const STAGE_HEIGHT = 1600;
    const DELETED_BUILTINS_KEY = 'medcheck_deleted_builtin_mindmaps_v1';

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
                    relation_label: 'Akuter Pathomechanismus',
                    socratic_hint: 'Was passiert akut an einer vulnerablen atherosklerotischen Koronarläsion, bevor das Gefäß komplett verschließt?',
                    explanation: 'Durch Ruptur der fibrösen Kappe einer vulnerablen Plaque wird subendotheliales Kollagen und Tissue Factor freigelegt, was zur sofortigen Thrombozytenaggregation und einem okklusiven Abscheidungsthrombus führt.'
                },
                {
                    id: 'n2',
                    label: 'Vernichtungsschmerz (retrosternal)',
                    category: 'clinical',
                    parent_id: 'root',
                    relation_label: 'Klinisches Leitsymptom',
                    socratic_hint: 'Wie äußert sich eine akute myokardiale Ischämie (> 20 Min., nicht nitro-sensibel) subjektiv beim Patienten?',
                    explanation: 'Anhaltender retrosternaler Druck- oder Vernichtungsschmerz (> 20 Min.), oft begleitet von vegetativer Symptomatik (Kaltschweißigkeit, Todesangst, Dyspnoe).'
                },
                {
                    id: 'n3',
                    label: '12-Kanal-EKG (< 10 Min.)',
                    category: 'diagnostics',
                    parent_id: 'root',
                    relation_label: 'Sofort-Diagnostik',
                    socratic_hint: 'Welche apparative Untersuchung muss laut ESC-Leitlinie zwingend innerhalb von 10 Minuten nach medizinischem Erstkontakt erfolgen?',
                    explanation: 'Das 12-Kanal-EKG innerhalb von 10 Minuten nach Erstkontakt (First Medical Contact) ist die entscheidende Weichenstellung für die sofortige Reperfusionsstrategie.'
                },
                {
                    id: 'n4',
                    label: 'Primäre PCI (Herzkatheter)',
                    category: 'therapy',
                    parent_id: 'root',
                    relation_label: 'Kausale Reperfusion',
                    socratic_hint: 'Welche Intervention öffnet das verschlossene Koronargefäß mechanisch mit der höchsten Erfolgsrate (Time is Muscle)?',
                    explanation: 'Die primäre perkutane Koronarintervention (PCI) mit Stent-Implantation (< 60–90 Min. nach Diagnose) ist der Goldstandard zur Wiederherstellung des TIMI-III-Flusses.'
                },
                {
                    id: 'n5',
                    label: 'LDL-Hypercholesterinämie & Nikotin',
                    category: 'etiology',
                    parent_id: 'root',
                    relation_label: 'Kardiovaskuläre Hauptrisiken',
                    socratic_hint: 'Welche chronischen Faktoren fördern endotheliale Dysfunktion und die Bildung vulnerabler Koronarplaques?',
                    explanation: 'Oxidiertes LDL-Cholesterin, Nikotinabusus, arterielle Hypertonie und Diabetes mellitus treiben die koronare Atherosklerose über Jahre voran.'
                },
                {
                    id: 'n6',
                    label: 'Transmurale Nekrose & Troponin-Anstieg',
                    category: 'pathophysiology',
                    parent_id: 'n1',
                    relation_label: 'führt nach 20–40 Min. zu',
                    socratic_hint: 'Was passiert mit den Kardiomyozyten bei anhaltender kompletter Ischämie von innen nach außen (Subendokard -> Epikard) und welcher Biomarker wird frei?',
                    explanation: 'Ohne Reperfusion breitet sich die Wellenfront der Myokardnekrose vom Subendokard transmural aus; durch den Zelluntergang steigt hochsensitives kardiales Troponin (hs-cTnT/I) im Blut an.'
                },
                {
                    id: 'n7',
                    label: 'Ausstrahlung in linken Arm / Unterkiefer',
                    category: 'clinical',
                    parent_id: 'n2',
                    relation_label: 'Head-Zonen-Projektion',
                    socratic_hint: 'Wohin projiziert der viszerale Herzschmerz über die Konvergenz viszero- und somatosensibler Fasern (Segmente C8–Th5)?',
                    explanation: 'Über viszerosomatische Konvergenz im Hinterhorn des Rückenmarks wird der Schmerz als übertragener Schmerz (Referred Pain) in den linken Arm (ulnar), Hals, Unterkiefer oder das Epigastrium projiziert.'
                },
                {
                    id: 'n8',
                    label: 'Konvexe ST-Hebung in ≥ 2 Nachbarableitungen',
                    category: 'diagnostics',
                    parent_id: 'n3',
                    relation_label: 'Beweisender EKG-Befund',
                    socratic_hint: 'Welches spezifische Erregungsrückbildungs-Kriterium im EKG beweist den transmuralen Verletzungsstrom?',
                    explanation: 'Signifikante ST-Strecken-Hebungen am J-Punkt in mindestens zwei anatomisch benachbarten Ableitungen (oder ein neu aufgetretener Links-/Rechtsschenkelblock bei passender Klinik) sichern die STEMI-Diagnose.'
                },
                {
                    id: 'n9',
                    label: 'DAPT (ASS + Prasugrel/Ticagrelor)',
                    category: 'therapy',
                    parent_id: 'n4',
                    relation_label: 'Stentthrombose-Prophylaxe',
                    socratic_hint: 'Welche duale medikamentöse Thrombozytenhemmung verhindert nach Stent-Implantation über 12 Monate den akuten Wiederverschluss?',
                    explanation: 'Nach Stent-Implantation ist eine duale Thrombozytenaggregationshemmung (DAPT) aus ASS (COX-1-Hemmer) plus einem potenten P2Y12-Inhibitor (Prasugrel oder Ticagrelor) für i.d.R. 12 Monate obligat.'
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
                    relation_label: 'Emboliequelle (ca. 90%)',
                    socratic_hint: 'Woher stammt der eingeschwemmte Thrombus (Virchow-Trias) in den allermeisten Fällen anatomisch?',
                    explanation: 'Rund 90 % aller Lungenembolien entstehen durch Abschwemmung eines Thrombus aus den tiefen Bein- oder Beckenvenen (V. femoralis, V. iliaca).'
                },
                {
                    id: 'l2',
                    label: 'Abrupter Nachlastanstieg rechter Ventrikel',
                    category: 'pathophysiology',
                    parent_id: 'root',
                    relation_label: 'Hämodynamische Primärfolge',
                    socratic_hint: 'Welcher dünnwandige Herzabschnitt muss plötzlich gegen den akut erhöhten pulmonalvaskulären Widerstand (PVR) anpumpen?',
                    explanation: 'Durch mechanische Obstruktion (> 30–50 % des Gefäßbetts) und hypoxische Vasokonstriktion steigt die rechtsventrikuläre Nachlast abrupt an -> akutes Cor pulmonale.'
                },
                {
                    id: 'l3',
                    label: 'Akute Dyspnoe, Tachypnoe & Pleuraschmerz',
                    category: 'clinical',
                    parent_id: 'root',
                    relation_label: 'Klinische Leitsymptome',
                    socratic_hint: 'Welche Symptome treten plötzlich durch die Totraumventilation, V/Q-Mismatch und pleurale Reizung auf?',
                    explanation: 'Plötzliche Dyspnoe, Tachypnoe, Sinustachykardie und atemabhängiger (pleuritischer) Thoraxschmerz sind die häufigsten Initialsymptome.'
                },
                {
                    id: 'l4',
                    label: 'Wells-Score + D-Dimere / CT-Pulmonalis-Angio',
                    category: 'diagnostics',
                    parent_id: 'root',
                    relation_label: 'Diagnose-Algorithmus',
                    socratic_hint: 'Wie kombiniert man klinische Vortestwahrscheinlichkeit, Ausschlusslabor und bildgebenden Goldstandard?',
                    explanation: 'Bei niedriger/mittlerer Wahrscheinlichkeit (Wells-Score) schließen negative D-Dimere eine LAE aus; bei hoher Wahrscheinlichkeit oder positiven D-Dimeren folgt direkt die CT-Pulmonalisangiographie (CTPA).'
                },
                {
                    id: 'l5',
                    label: 'Therapeutische Antikoagulation (DOAK/Heparin)',
                    category: 'therapy',
                    parent_id: 'root',
                    relation_label: 'Sofort-Basistherapie',
                    socratic_hint: 'Welche medikamentöse Maßnahme stoppt sofort das appositionelle Thrombuswachstum bei hämodynamisch stabilen Patienten?',
                    explanation: 'Hämodynamisch stabile Patienten erhalten sofort eine therapeutische Antikoagulation (bevorzugt DOAK wie Apixaban/Rivaroxaban oder initial NMH/UFH).'
                },
                {
                    id: 'l6',
                    label: 'Obstruktiver Schock (RRsys < 90 mmHg)',
                    category: 'pathophysiology',
                    parent_id: 'l2',
                    relation_label: 'führt bei RV-Versagen zu',
                    socratic_hint: 'Was passiert durch die rechtsventrikuläre Dilatation und Septumverschiebung (Ventrikel-Interdependenz) mit der Füllung des linken Ventrikels?',
                    explanation: 'Der dilatierte rechte Ventrikel wölbt das Septum nach links, komprimiert den linken Ventrikel im Perikard und führt zum kritischen linksventrikulären Vorlastmangel -> obstruktiver Schock (High-Risk-LAE).'
                },
                {
                    id: 'l7',
                    label: 'Systemische Thrombolyse (rt-PA / Alteplase)',
                    category: 'therapy',
                    parent_id: 'l6',
                    relation_label: 'Notfalltherapie im Schock',
                    socratic_hint: 'Welche medikamentöse Reperfusionstherapie löst den Embolus bei hämodynamischer Instabilität (High-Risk-LAE) aktiv auf?',
                    explanation: 'Bei High-Risk-LAE (obstruktiver Schock / Reanimation) ist die sofortige systemische Fibrinolyse mit rt-PA (Alteplase) neben unfraktioniertem Heparin lebensrettend.'
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
        strictCausalOrder: true, // NEU: Erzwingt logisches Lernen (erst 1. Ordnung, dann 2. Ordnung!)
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
    // 2. SUPABASE PERSISTENZ, LOCALSTORAGE SYNC & LÖSCH-FUNKTION
    // ========================================================================

    function getSupabase() {
        return window.supabaseClient || window.supabase || window.sb || (window.Auth && window.Auth.supabase) || null;
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

    function getDeletedBuiltinIds() {
        try {
            return JSON.parse(localStorage.getItem(DELETED_BUILTINS_KEY) || '[]');
        } catch (_e) {
            return [];
        }
    }

    function addDeletedBuiltinId(id) {
        const list = getDeletedBuiltinIds();
        if (!list.includes(id)) {
            list.push(id);
            localStorage.setItem(DELETED_BUILTINS_KEY, JSON.stringify(list));
        }
    }

    async function restoreDeletedBuiltinMindmaps() {
        localStorage.removeItem(DELETED_BUILTINS_KEY);
        await loadMindmapsAndProgress();
        if (state.mindmaps.length > 0) {
            selectMindmap(state.mindmaps[0].id);
        } else {
            renderModule();
        }
    }

    async function loadMindmapsAndProgress() {
        const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
        const localProgress = JSON.parse(localStorage.getItem('medcheck_mindmap_progress') || '{}');
        const deletedBuiltins = getDeletedBuiltinIds();
        state.progressCache = localProgress;

        const mapById = new Map();
        BUILTIN_MINDMAPS.forEach(m => {
            if (!deletedBuiltins.includes(m.id)) {
                mapById.set(m.id, m);
            }
        });
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
                        if (deletedBuiltins.includes(row.id)) return;
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

    /**
     * NEU: Löscht die aktuell ausgewählte Mindmap lokal UND aus der Supabase-Cloud
     */
    async function deleteCurrentMindmap() {
        if (!state.currentMap) return;

        const targetId = state.currentMap.id;
        const targetTitle = state.currentMap.title || state.currentMap.central_concept || targetId;
        const isBuiltin = BUILTIN_MINDMAPS.some(b => b.id === targetId);

        const confirmMsg = isBuiltin
            ? `Möchtest du die Standard-Mindmap „${targetTitle}“ aus deiner Liste entfernen?\n\n(Du kannst Standard-Mindmaps später jederzeit wiederherstellen.)`
            : `Möchtest du die Mindmap „${targetTitle}“ inklusive deines Lernfortschritts wirklich unwiderruflich löschen?`;

        if (!window.confirm(confirmMsg)) return;

        if (isBuiltin) {
            addDeletedBuiltinId(targetId);
        }

        // 1. Aus LocalStorage ('medcheck_custom_mindmaps') entfernen
        try {
            const localSaved = JSON.parse(localStorage.getItem('medcheck_custom_mindmaps') || '[]');
            const updatedLocal = localSaved.filter(m => m.id !== targetId);
            localStorage.setItem('medcheck_custom_mindmaps', JSON.stringify(updatedLocal));
        } catch (_e) {}

        // 2. Fortschritt aus LocalStorage ('medcheck_mindmap_progress') entfernen
        delete state.progressCache[targetId];
        try {
            localStorage.setItem('medcheck_mindmap_progress', JSON.stringify(state.progressCache));
        } catch (_e) {}

        // 3. Aus Supabase ('mindmap_progress' & 'mindmaps') löschen
        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
            try {
                await sb.from('mindmap_progress').delete().eq('mindmap_id', targetId).eq('user_id', user.id);
                await sb.from('mindmaps').delete().eq('id', targetId);
            } catch (err) {
                console.warn('[Mindmap] Fehler beim Cloud-Delete (lokal bereits gelöscht):', err);
            }
        }

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(14);

        // 4. Liste aktualisieren und nächste verfügbare Mindmap wählen
        await loadMindmapsAndProgress();
        if (state.mindmaps.length > 0) {
            selectMindmap(state.mindmaps[0].id);
        } else {
            state.currentMap = null;
            state.solvedNodeIds = new Set();
            renderModule();
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
        const centerX = STAGE_WIDTH / 2;
        const centerY = STAGE_HEIGHT / 2;

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
    // 5. RENDERING & PROGRESSIVE KAUSAL-LOGIK
    // ========================================================================

    function selectMindmap(mindmapId) {
        const found = state.mindmaps.find(m => m.id === mindmapId) || state.mindmaps[0];
        if (!found) {
            state.currentMap = null;
            renderModule();
            return;
        }

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

    function isSlotCurrentlyLocked(node) {
        if (!state.strictCausalOrder) return false;
        return !isParentSolvedOrRoot(node);
    }

    function renderModule() {
        const container = ensureDomStructure();
        const deletedBuiltins = getDeletedBuiltinIds();

        if (!state.currentMap) {
            container.innerHTML = `
                <div class="mindmap-wrapper">
                    <div class="mm-header">
                        <div class="mm-title-group">
                            <h2>🕸️ Klinisches Mindmap-Labor</h2>
                            <p>Aktuell sind keine Mindmaps in deiner Bibliothek vorhanden.</p>
                        </div>
                        <div class="mm-controls">
                            ${deletedBuiltins.length > 0 ? `
                                <button id="mm-btn-restore-builtins" class="mm-btn">♻️ Standard-Mindmaps wiederherstellen</button>
                            ` : ''}
                            <button id="mm-btn-prompt" class="mm-btn">📋 Deep-Prompt</button>
                            <button id="mm-btn-import" class="mm-btn mm-btn-primary">📥 JSON Importieren</button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('mm-btn-restore-builtins')?.addEventListener('click', restoreDeletedBuiltinMindmaps);
            document.getElementById('mm-btn-prompt')?.addEventListener('click', copyExtractionPrompt);
            document.getElementById('mm-btn-import')?.addEventListener('click', openImportModal);
            return;
        }

        const map = state.currentMap;
        const totalNodes = map.nodes.length;
        const solvedCount = state.solvedNodeIds.size;
        const savedProg = state.progressCache[map.id];

        // Sortiere die ungelösten Begriffe im Pool didaktisch sinnvoll:
        // Aktuell freigeschaltete (spielbare) Begriffe stehen oben, noch gesperrte Folgeschritte leicht gedimmt darunter!
        const unplacedNodes = map.nodes.filter(n => !state.solvedNodeIds.has(n.id));
        const unlockedPoolNodes = shuffleArray(unplacedNodes.filter(n => !isSlotCurrentlyLocked(n)));
        const lockedPoolNodes = shuffleArray(unplacedNodes.filter(n => isSlotCurrentlyLocked(n)));
        const orderedPoolNodes = [...unlockedPoolNodes, ...lockedPoolNodes];

        container.innerHTML = `
            <div class="mindmap-wrapper">
                <!-- TOP HEADER -->
                <div class="mm-header">
                    <div class="mm-title-group">
                        <h2>🕸️ Klinisches Mindmap-Labor</h2>
                        <p>
                            <strong>Schritt-für-Schritt-Kausallogik:</strong> Löse zuerst die inneren Hauptäste rund um das Zentrum – dadurch schaltest du automatisch die abhängigen Folgekaskaden (2. Ebene) frei!
                        </p>
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

                        <button id="mm-btn-delete" class="mm-btn" style="border-color: rgba(239, 68, 68, 0.45); color: #fca5a5 !important;" title="Aktuelle Mindmap löschen">
                            🗑️ Löschen
                        </button>

                        ${deletedBuiltins.length > 0 ? `
                            <button id="mm-btn-restore-builtins" class="mm-btn" title="Ausgeblendete Standard-Mindmaps wiederherstellen">
                                ♻️ Standards
                            </button>
                        ` : ''}

                        <button id="mm-toggle-causal" class="mm-btn ${state.strictCausalOrder ? 'active' : ''}" title="Wenn aktiv, müssen erst Hauptknoten (1. Ebene) gelöst werden, bevor deren Unteräste (2. Ebene) freigeschaltet werden">
                            ${state.strictCausalOrder ? '🔗 Kausal-Sperre: AN' : '🔓 Alle Ebenen offen'}
                        </button>

                        <button id="mm-toggle-blind" class="mm-btn mm-btn-blind ${state.blindMode ? 'active' : ''}" title="Verbirgt die Kategoriefarben vor dem Lösen gegen Test-Wiseness">
                            ${state.blindMode ? '🕶️ Prüfungs-Modus' : '🎨 Lern-Modus'}
                        </button>

                        <button id="mm-btn-inspector" class="mm-btn ${state.showInspector ? 'active' : ''}" title="Zeigt alle kausalen Verbindungen als übersichtliche Baumstruktur">
                            🧭 Baum-Logik
                        </button>

                        <button id="mm-toggle-expand" class="mm-btn ${state.expandedCanvas ? 'active' : ''}" title="Mindmap auf volle Breite ausdehnen">
                            ${state.expandedCanvas ? '📐 Standard' : '🔭 Großansicht'}
                        </button>

                        <button id="mm-btn-reset" class="mm-btn" title="Mindmap zurücksetzen">
                            🔄 Reset
                        </button>

                        <button id="mm-btn-prompt" class="mm-btn" title="Deep-Prompt für Vorlesungs-Extraktion kopieren">
                            📋 Deep-Prompt
                        </button>

                        <button id="mm-btn-import" class="mm-btn mm-btn-primary">
                            📥 JSON Import
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
                                <span class="mm-box-title">📦 Extrahierte Begriffe (${orderedPoolNodes.length})</span>
                                <span class="mm-box-sub">${unlockedPoolNodes.length} direkt zuordenbar</span>
                            </div>
                            <div id="mm-chip-pool" class="mm-chip-list">
                                ${orderedPoolNodes.length === 0 ? `
                                    <div class="mm-all-solved-banner">
                                        🎉 Alle Begriffe erfolgreich vernetzt!
                                    </div>
                                ` : orderedPoolNodes.map(node => {
                                    const catCfg = CATEGORIES[node.category];
                                    const catClass = state.blindMode ? 'cat-blind' : (catCfg?.cssClass || 'cat-blind');
                                    const isSelected = state.selectedChipId === node.id ? 'selected-chip' : '';
                                    const isLockedChild = isSlotCurrentlyLocked(node);
                                    const levelTag = (!node.parent_id || node.parent_id === 'root')
                                        ? '1. Ebene (Hauptast)'
                                        : (isLockedChild ? '🔒 2. Ebene (Löse erst Hauptast)' : '🔓 2. Ebene (Folgeschritt)');
                                    const catBadge = state.blindMode
                                        ? `<span class="mm-chip-cat-tag">${levelTag}</span>`
                                        : `<span class="mm-chip-cat-tag">${escapeHtml(catCfg?.label || '')} • ${levelTag}</span>`;

                                    return `
                                        <div class="mm-chip ${catClass} ${isSelected}"
                                             style="${isLockedChild ? 'opacity: 0.58;' : ''}"
                                             data-node-id="${escapeHtml(node.id)}"
                                             draggable="false"
                                             title="${isLockedChild ? 'Dieser Begriff gehört auf die 2. Ebene – löse zuerst den zugehörigen Hauptast!' : 'Ziehe diesen Begriff auf den passenden Ziel-Knoten oder klicke ihn an'}">
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
                                Klicke auf einen beliebigen Ziel-Knoten in der Mindmap, um eine <strong>gezielte sokratische Leitfrage</strong> zu erhalten, oder ziehe direkt einen passenden Begriff darauf!
                            </div>
                        </div>
                    </div>

                    <!-- RECHTE SPALTE: INTERAKTIVES XXL PAN & ZOOM MINDMAP-CANVAS -->
                    <div id="mm-canvas-viewport" class="mm-canvas-container">
                        <div class="mm-canvas-HUD">
                            <button type="button" class="mm-hud-btn" id="mm-zoom-out" title="Herauszoomen">➖</button>
                            <span id="mm-zoom-label" class="mm-hud-zoom-text">65%</span>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-in" title="Hineinzoomen">➕</button>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-100" title="100% Originalgröße">100%</button>
                            <button type="button" class="mm-hud-btn" id="mm-zoom-fit" title="Gesamte Mindmap einpassen">🎯 Alles zeigen</button>
                        </div>

                        <div class="mm-canvas-help-pill">
                            🖱️ Hintergrund ziehen zum Verschieben • Mausrad zum Zoomen • Knoten anklicken für sokratische Leitfrage
                        </div>

                        <!-- TRANSFORMABLE XXL STAGE (2400 x 1600) -->
                        <div id="mm-stage" class="mm-stage" style="width:${STAGE_WIDTH}px; height:${STAGE_HEIGHT}px;">
                            <svg id="mm-svg" class="mm-svg-layer" viewBox="0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}"></svg>
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
                    <span>Klicke auf einen offenen Schritt, um dir den sokratischen Hinweis im Tutor anzeigen zu lassen!</span>
                </div>
                <div class="mm-inspector-grid">
                    ${firstOrder.map(parent => {
                        const pSolved = state.solvedNodeIds.has(parent.id);
                        const pCat = CATEGORIES[parent.category]?.label || parent.category;
                        const children = secondOrder.filter(c => c.parent_id === parent.id);

                        return `
                            <div class="mm-inspector-branch">
                                <div class="mm-inspector-step ${pSolved ? 'is-solved' : ''}" data-ins-slot="${escapeHtml(parent.id)}" style="cursor:pointer;">
                                    <span class="mm-ins-rel">1️⃣ Zentrum ➔ <strong>${escapeHtml(parent.relation_label || 'Verbindung')}</strong>:</span>
                                    <strong class="mm-ins-target">
                                        ${pSolved ? `✅ ${escapeHtml(parent.label)}` : `❓ [${escapeHtml(pCat)} gesucht – klicken für Tipp]`}
                                    </strong>
                                </div>
                                ${children.map(child => {
                                    const cSolved = state.solvedNodeIds.has(child.id);
                                    const cCat = CATEGORIES[child.category]?.label || child.category;
                                    return `
                                        <div class="mm-inspector-substep ${cSolved ? 'is-solved' : ''}" data-ins-slot="${escapeHtml(child.id)}" style="cursor:pointer;">
                                            <span class="mm-ins-rel">↳ 2️⃣ Folgeschritt: <strong>${escapeHtml(child.relation_label || 'führt zu')}</strong>:</span>
                                            <strong class="mm-ins-target">
                                                ${cSolved ? `✅ ${escapeHtml(child.label)}` : (pSolved ? `🔓 [${escapeHtml(cCat)} gesucht]` : `🔒 [Löse erst Schritt 1]`)}
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
        const isLocked = isSlotCurrentlyLocked(node);

        let originPrefix = `1. Ebene • Vom Zentrum`;
        if (isSecondOrder) {
            originPrefix = !isLocked
                ? `2. Ebene • Aus „${getParentLabel(node)}“`
                : `🔒 2. Ebene • Gesperrte Folgekaskade`;
        }

        if (isSolved) {
            return `
                <div class="mm-node mm-node-solved ${catCfg.cssClass}"
                     id="mm-node-dom-${escapeHtml(node.id)}"
                     style="left: ${pos.x}px; top: ${pos.y}px;"
                     data-slot-id="${escapeHtml(node.id)}"
                     title="Klicken, um die klinische Erklärung im Tutor zu lesen">
                    <div class="mm-node-rel-banner">
                        <span class="mm-rel-origin">${escapeHtml(originPrefix)}</span>
                        <strong class="mm-rel-verb">➔ ${escapeHtml(relationText)}</strong>
                    </div>
                    <div class="mm-node-body-solved">
                        <span class="mm-solved-cat-pill">✅ ${catCfg.icon} ${escapeHtml(catCfg.label)}</span>
                        <div class="mm-solved-title">${escapeHtml(node.label)}</div>
                    </div>
                </div>
            `;
        }

        if (isLocked) {
            return `
                <div class="mm-node mm-node-slot cat-blind mm-node-locked"
                     id="mm-node-dom-${escapeHtml(node.id)}"
                     style="left: ${pos.x}px; top: ${pos.y}px; opacity: 0.58; filter: grayscale(0.4);"
                     data-slot-id="${escapeHtml(node.id)}"
                     title="Löse zuerst den inneren Hauptknoten (1. Ebene), um diesen Folgeschritt freizuschalten!">
                    <div class="mm-node-rel-banner">
                        <span class="mm-rel-origin">🔒 Folgeschritt (2. Ebene)</span>
                        <strong class="mm-rel-verb">➔ ${escapeHtml(relationText)}</strong>
                    </div>
                    <div class="mm-slot-inner">
                        <span class="mm-slot-hint">⏳ Kausal-Sperre aktiv</span>
                        <span class="mm-slot-cta">Löse zuerst den inneren Vorgänger-Knoten!</span>
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
                 title="Klicken für sokratische Leitfrage oder passenden Begriff hier ablegen">
                <div class="mm-node-rel-banner">
                    <span class="mm-rel-origin">${escapeHtml(originPrefix)}</span>
                    <strong class="mm-rel-verb">➔ ${escapeHtml(relationText)}</strong>
                </div>
                <div class="mm-slot-inner">
                    <span class="mm-slot-hint">${escapeHtml(slotHintLabel)}</span>
                    <span class="mm-slot-cta">💡 Klicken für Leitfrage oder Begriff ziehen</span>
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
            const isLocked = isSlotCurrentlyLocked(node);
            const isHovered = state.hoveredNodeId === node.id || state.hoveredNodeId === parentId;
            const catCfg = CATEGORIES[node.category];
            const showColor = isSolved || (!state.blindMode && !isLocked);
            const strokeColor = showColor && catCfg ? catCfg.color : '#64748b';
            const markerId = showColor && catCfg ? `mm-arrow-${node.category}` : 'mm-arrow-default';

            pathsHtml += `
                <path class="mm-edge-path ${isSolved ? 'solved-edge' : ''} ${isHovered ? 'hovered-edge' : ''}"
                      d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}"
                      style="stroke: ${strokeColor}; opacity: ${isLocked ? '0.35' : '0.9'};"
                      marker-end="url(#${markerId})" />
            `;

            if (node.relation_label) {
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                htmlBadges += `
                    <div class="mm-edge-html-badge ${isHovered ? 'is-hovered' : ''}"
                         style="left:${midX.toFixed(1)}px; top:${midY.toFixed(1)}px; border-color:${strokeColor}; opacity:${isLocked ? '0.45' : '1'};">
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
    // 7. EVENT-BINDING (DRAG & DROP, DELETE, CAUSAL LOCK, ZOOM, PAN)
    // ========================================================================

    function bindEvents() {
        document.getElementById('mm-map-selector')?.addEventListener('change', e => selectMindmap(e.target.value));
        document.getElementById('mm-btn-delete')?.addEventListener('click', deleteCurrentMindmap);
        document.getElementById('mm-btn-restore-builtins')?.addEventListener('click', restoreDeletedBuiltinMindmaps);

        document.getElementById('mm-toggle-causal')?.addEventListener('click', () => {
            state.strictCausalOrder = !state.strictCausalOrder;
            renderModule();
            requestAnimationFrame(() => {
                applyStageTransform();
                drawSvgConnections();
            });
        });

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

        // Klicks im Baum-Inspektor zeigen ebenfalls den sokratischen Tipp
        document.querySelectorAll('[data-ins-slot]').forEach(el => {
            el.addEventListener('click', () => {
                const slotId = el.getAttribute('data-ins-slot');
                showSlotSocraticHint(slotId);
            });
        });

        // Zoom Controls
        document.getElementById('mm-zoom-in')?.addEventListener('click', () => adjustZoom(0.14));
        document.getElementById('mm-zoom-out')?.addEventListener('click', () => adjustZoom(-0.14));
        document.getElementById('mm-zoom-100')?.addEventListener('click', () => {
            const delta = 1.0 - state.zoom;
            adjustZoom(delta);
        });
        document.getElementById('mm-zoom-fit')?.addEventListener('click', () => fitStageToViewport());

        const viewport = document.getElementById('mm-canvas-viewport');
        if (viewport) {
            viewport.addEventListener('wheel', e => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                adjustZoom(delta);
            }, { passive: false });

            viewport.addEventListener('pointerdown', e => {
                if (e.target.closest('.mm-node') || e.target.closest('.mm-canvas-HUD')) return;
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

        document.querySelectorAll('.mm-chip').forEach(chip => {
            chip.addEventListener('dragstart', e => e.preventDefault());
            chip.addEventListener('selectstart', e => e.preventDefault());
            chip.addEventListener('pointerdown', onChipPointerDown);
        });

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

            nodeEl.addEventListener('click', () => {
                if (nodeEl.classList.contains('mm-node-solved')) {
                    showSolvedNodeExplanation(slotId);
                } else if (state.selectedChipId) {
                    evaluateDropAttempt(state.selectedChipId, slotId, nodeEl);
                } else {
                    showSlotSocraticHint(slotId);
                }
            });
        });
    }

    function onChipPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;

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
    // 8. AUSWERTUNG, KAUSAL-PRÜFUNG & SOKRATISCHE AI-FEEDBACK-SCHLEIFE
    // ========================================================================

    async function evaluateDropAttempt(draggedNodeId, targetSlotId, slotElement) {
        const map = state.currentMap;
        if (!map) return;

        const draggedNode = map.nodes.find(n => n.id === draggedNodeId);
        const targetNode = map.nodes.find(n => n.id === targetSlotId);
        if (!draggedNode || !targetNode) return;

        const tutorEl = document.getElementById('mm-tutor-message');

        // 1. Prüfen, ob der Ziel-Slot noch durch die Kausal-Sperre blockiert ist (ohne Strafpunkt!)
        if (isSlotCurrentlyLocked(targetNode)) {
            if (slotElement) {
                slotElement.classList.remove('mm-node-error');
                void slotElement.offsetWidth;
                slotElement.classList.add('mm-node-error');
            }
            if (tutorEl) {
                tutorEl.innerHTML = `
                    <strong style="color:#38bdf8;">🔒 Kausaler Zwischenschritt fehlt noch!</strong><br>
                    Dieser Knoten liegt auf der <strong>2. Ebene</strong> (Folgeschritt über <em>„${escapeHtml(targetNode.relation_label)}“</em>).<br>
                    Löse zuerst den übergeordneten Hauptknoten der 1. Ebene, damit die Kausalkette logisch aufgebaut wird! (Kein Fehlversuch abgezogen).
                `;
            }
            return;
        }

        // 2. Prüfen auf exakte Übereinstimmung ODER semantische Äquivalenz (gleicher Elternknoten, gleiche Kategorie, gleiche Relation)
        const isExactMatch = draggedNode.id === targetNode.id;
        const isSemanticEquivalent = (
            (draggedNode.parent_id || 'root') === (targetNode.parent_id || 'root') &&
            draggedNode.category === targetNode.category &&
            (draggedNode.relation_label || '').trim().toLowerCase() === (targetNode.relation_label || '').trim().toLowerCase()
        );

        if (isExactMatch || isSemanticEquivalent) {
            // Falls semantisch äquivalent, aber andere ID: Labels/Daten der beiden Knoten tauschen, damit der gezogene Chip verschwindet
            if (!isExactMatch && isSemanticEquivalent) {
                const temp = { ...targetNode };
                targetNode.label = draggedNode.label;
                targetNode.socratic_hint = draggedNode.socratic_hint;
                targetNode.explanation = draggedNode.explanation;
                draggedNode.label = temp.label;
                draggedNode.socratic_hint = temp.socratic_hint;
                draggedNode.explanation = temp.explanation;
            }

            state.solvedNodeIds.add(targetNode.id);
            state.selectedChipId = null;

            // Prüfen, welche Kind-Knoten durch diesen Schritt neu freigeschaltet wurden
            const newlyUnlockedChildren = map.nodes.filter(n => n.parent_id === targetNode.id);

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

            const updatedTutorEl = document.getElementById('mm-tutor-message');
            if (updatedTutorEl) {
                const parentLabel = getParentLabel(targetNode);
                const pearlText = targetNode.explanation
                    ? `<div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(16,185,129,0.12); border-left:3px solid #10b981; font-size:0.8rem;">💡 <strong>Klinischer Hintergrund:</strong> ${escapeHtml(targetNode.explanation)}</div>`
                    : '';
                const unlockNotice = newlyUnlockedChildren.length > 0
                    ? `<div style="margin-top:6px; color:#38bdf8; font-size:0.8rem;">🔓 <strong>Folgekaskade freigeschaltet:</strong> Du kannst jetzt den nächsten Schritt (${newlyUnlockedChildren.map(c => '<em>„' + escapeHtml(c.relation_label) + '“</em>').join(', ')}) zuordnen!</div>`
                    : '';

                updatedTutorEl.innerHTML = `
                    <strong style="color:#10b981;">✅ Exakt richtig vernetzt!</strong><br>
                    <strong>„${escapeHtml(targetNode.label)}“</strong> folgt über <em>„${escapeHtml(targetNode.relation_label || 'Verbindung')}“</em> aus <strong>„${escapeHtml(parentLabel)}“</strong>.
                    ${pearlText}
                    ${unlockNotice}
                `;
            }

            if (state.solvedNodeIds.size === map.nodes.length) {
                await saveProgressToDb();
                if (updatedTutorEl) {
                    updatedTutorEl.innerHTML = `
                        <strong style="color:#10b981;">🏆 Gesamte Mindmap gemeistert (+250 XP)!</strong><br>
                        Du hast alle ${map.nodes.length} Konzepte kausal vernetzt (${state.mistakesCount} Fehlversuche). Klicke auf beliebige gelöste Knoten, um ihre klinischen Erklärungen noch einmal zu wiederholen!
                    `;
                }
            }
            return;
        }

        // 3. Fehlversuch -> Gezielte diagnostische & sokratische Rückmeldung
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

    function showSolvedNodeExplanation(slotId) {
        const node = state.currentMap?.nodes.find(n => n.id === slotId);
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!node || !tutorEl) return;

        const parentLabel = getParentLabel(node);
        tutorEl.innerHTML = `
            <strong style="color:#10b981;">✅ Gelöster Knoten: „${escapeHtml(node.label)}“</strong><br>
            <span style="font-size:0.8rem; color:#94a3b8;">Kausalkette: <strong>${escapeHtml(parentLabel)}</strong> ➔ <em>${escapeHtml(node.relation_label)}</em></span><br>
            <div style="margin-top:6px;">${escapeHtml(node.explanation || node.socratic_hint || 'Klinisch verifiziertes Konzept.')}</div>
        `;
    }

    function showSlotSocraticHint(slotId) {
        const targetNode = state.currentMap?.nodes.find(n => n.id === slotId);
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!targetNode || !tutorEl) return;

        if (isSlotCurrentlyLocked(targetNode)) {
            tutorEl.innerHTML = `
                <strong style="color:#f59e0b;">🔒 Dieser Folgeschritt (2. Ebene) ist noch gesperrt:</strong><br>
                Löse zuerst den zugehörigen Hauptknoten der 1. Ebene am Zentrum. Sobald die Ursache steht, wird dieser Folgeschritt (<em>„${escapeHtml(targetNode.relation_label || '')}“</em>) freigeschaltet!
            `;
            return;
        }

        const parentLabel = getParentLabel(targetNode);
        const targetCat = CATEGORIES[targetNode.category]?.label || targetNode.category;
        tutorEl.innerHTML = `
            <strong style="color:#38bdf8;">💡 Sokratische Leitfrage für diesen Knoten:</strong><br>
            <span style="font-size:0.8rem; color:#94a3b8;">Gesucht: <strong>${escapeHtml(parentLabel)}</strong> ➔ <em>${escapeHtml(targetNode.relation_label || '')}</em> (${escapeHtml(targetCat)})</span>
            <div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8;">
                ${escapeHtml(targetNode.socratic_hint || 'Überlege, welcher Begriff aus dem Pool kausal an diese Stelle gehört.')}
            </div>
        `;
    }

    async function triggerSocraticFeedback(draggedNode, targetNode) {
        const tutorEl = document.getElementById('mm-tutor-message');
        if (!tutorEl) return;

        const parentLabel = getParentLabel(targetNode);
        const draggedCat = CATEGORIES[draggedNode.category]?.label || draggedNode.category;
        const targetCat = CATEGORIES[targetNode.category]?.label || targetNode.category;
        const draggedIsSecondOrder = draggedNode.parent_id && draggedNode.parent_id !== 'root';
        const targetIsSecondOrder = targetNode.parent_id && targetNode.parent_id !== 'root';

        // Sofortiger präziser Ebenen-/Kategorie-Hinweis vorab
        let structuralHint = '';
        if (draggedIsSecondOrder !== targetIsSecondOrder) {
            structuralHint = draggedIsSecondOrder
                ? `⚠️ <strong>Ebenen-Verwechslung:</strong> „${escapeHtml(draggedNode.label)}“ ist eine spezifische <em>Folgeerscheinung / Detailmaßnahme (2. Ebene)</em>, aber hier wird zuerst das übergeordnete <em>Primärkonzept (1. Ebene)</em> gesucht!`
                : `⚠️ <strong>Ebenen-Verwechslung:</strong> „${escapeHtml(draggedNode.label)}“ ist ein <em>Hauptast (1. Ebene)</em> direkt am Zentrum, nicht der hier gesuchte <em>Folgeschritt (2. Ebene)</em>!`;
        } else if (draggedNode.category !== targetNode.category) {
            structuralHint = `⚠️ <strong>Kategorie-Konflikt:</strong> Du hast einen Begriff der <em>${escapeHtml(draggedCat)}</em> gewählt, aber dieser Ast fragt nach <em>${escapeHtml(targetCat)}</em>.`;
        }

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
                    ${structuralHint ? `<div style="margin-bottom:5px; font-size:0.8rem; color:#fcd34d;">${structuralHint}</div>` : ''}
                    <strong style="color:#f59e0b;">🤔 Sokratische Rückfrage:</strong><br>
                    ${escapeHtml(aiText)}
                `;
                return;
            }
            throw new Error('Leere AI-Antwort');
        } catch (err) {
            const fallbackReason = structuralHint || `<strong>„${escapeHtml(draggedNode.label)}“</strong> passt kausal nicht zur Relation <em>„${escapeHtml(targetNode.relation_label)}“</em> ausgehend von <strong>„${escapeHtml(parentLabel)}“</strong>.`;

            tutorEl.innerHTML = `
                <strong style="color:#f59e0b;">🤔 Sokratische Analyse:</strong><br>
                ${fallbackReason}<br>
                <div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8;">
                    <strong style="color:#38bdf8;">Leitfrage für diesen Slot:</strong> ${escapeHtml(targetNode.socratic_hint || 'Welche direkte Konsequenz oder Maßnahme ergibt sich hier?')}
                </div>
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

# 1. INHALTLICHE REGELN (ZERO-SUPERFICIALITY & KAUSALE LOGIK)
1. KEINE OBERFLÄCHLICHKEITEN: Begriffe wie "Blutbild", "MRT", "Entzündung" oder "Medikamente" sind verboten! Extrahiere exakte Rezeptoren, Ionenkanäle, Autoantikörper, Genmutationen, pathognomonische Zeichen, spezifische Sequenzen, exakte Cutoffs mit Einheiten und Wirkstoffe inkl. Mechanismus/Kontraindikation.
2. STRIKTE 2-RING-KAUSALLOGIK (KEINE MEHRDEUTIGKEITEN!):
   - Erstelle insgesamt 10 bis 12 Knoten in "nodes".
   - 5 Knoten sind Hauptäste 1. Ordnung ("parent_id": "root") und decken alle 5 Kategorien ab ("etiology", "pathophysiology", "clinical", "diagnostics", "therapy").
   - 5 bis 7 Knoten sind Vertiefungsäste 2. Ordnung ("parent_id": "n1" etc.), die einen Hauptast logisch-kausal weiterführen (Ursache -> unmittelbare Folge; Primärdiagnostik -> beweisender Befund; Erstlinientherapie -> spezifischer Wirkmechanismus/Prophylaxe).
   - Jeder Slot muss durch seine "relation_label" und "socratic_hint" EINDEUTIG von allen anderen Knoten unterscheidbar sein!
3. KOMPAKTE UI-LABELS:
   - "label": Maximal 48 Zeichen.
   - "relation_label": Präzises kausales Verb/Beziehung (max. 26 Zeichen, z.B. "oxidiert Co2+ in", "Goldstandard-Nachweis", "kontraindiziert wegen").
4. SOKRATISCHE LEITFRAGEN ("socratic_hint") & ERKLÄRUNG ("explanation"):
   - "socratic_hint": Gezielte Frage, die über den Mechanismus auf den Begriff hinführt, OHNE das Wort aus "label" zu verraten!
   - "explanation": 1-2 prägnante Sätze mit dem klinischen/pathophysiologischen Merksatz, der nach dem Lösen zur Festigung angezeigt wird.

# 2. STRIKTES JSON-SCHEMA (Antworte NUR mit reinem JSON ohne Markdown-Block)
{
  "id": "mm_fach_thema_001",
  "title": "Prägnanter Titel der Vorlesung / Erkrankung",
  "specialty": "Fachgebiet",
  "central_concept": "Zentrale Leitdiagnose / Hauptkonzept",
  "nodes": [
    {
      "id": "n1",
      "label": "Tiefendetail 1. Ordnung (max. 48 Z.)",
      "category": "etiology | pathophysiology | clinical | diagnostics | therapy",
      "parent_id": "root",
      "relation_label": "Eindeutige Kausalrelation",
      "socratic_hint": "Sokratische Frage ohne Lösungsspoiler?",
      "explanation": "Klinisch-pathophysiologische Begründung nach dem Lösen."
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
        selectMindmap,
        deleteCurrentMindmap
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
