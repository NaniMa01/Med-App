/* ==========================================================================
   MEDCHECK – CLINICAL PACS & IMAGING WORKSTATION (js/imaging.js)
   Features:
   - Multi-Slice & Foto-Serien Stack-Scrolling (Mausrad, Slider, Pfeiltasten)
   - 2-Stufen Active Recall: 1. Pathologie-Hotspot im Bild klicken -> 2. Befund-MC lösen
   - Echtzeit-Fensterung (Helligkeit/Kontrast), Invertierung (Röntgen-Negativ), 4x Zoom & Pan
   - Pflicht-Befundungs-Gate Integration für js/audit.js (Event: medcheck:imagingSolved)
   - Split-Screen Dock (Workstation-Modus) & Vollbild-Umschaltung
   ========================================================================== */

const ImagingModule = (() => {
    const STORAGE_KEY = 'medcheck_imaging_progress_v1';

    let currentCaseId = null;
    let currentContainerId = 'imaging-container';
    let studies = [];
    let activeStudyIdx = 0;
    let activeSliceIdx = 0;
    let isDockedRight = false;
    let isCollapsed = false;

    // PACS Viewport Transformations-State
    let viewTransform = {
        zoom: 1,
        panX: 0,
        panY: 0,
        brightness: 100,
        contrast: 100,
        invert: false,
        showGrid: false
    };

    // Interaktions-State pro Studie: { [studyId]: { hotspotHit: bool, lastClick: {x,y,hit}, selectedOption: number|null, solved: bool } }
    let sessionState = {};
    let wheelCooldown = false;
    let isDraggingPan = false;
    let dragStart = { x: 0, y: 0 };
    let didPanMove = false;

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    // ======================================================================
    // 1. PERSISTENZ & SOLVED-CHECK (FÜR AUDIT-GATE IN js/audit.js)
    // ======================================================================
    function getSavedState(caseId) {
        if (!caseId || window.isSpecialtyBlindMode) return {};
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return all[caseId] || {};
        } catch (_e) {
            return {};
        }
    }

    function saveStudyState(caseId, studyId, data) {
        if (!caseId || !studyId || window.isSpecialtyBlindMode) return;
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (!all[caseId]) all[caseId] = {};
            all[caseId][studyId] = {
                ...(all[caseId][studyId] || {}),
                ...data,
                updatedAt: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        } catch (_e) {}
    }

    function isStudySolved(caseId, studyId = null) {
        const targetCaseId = caseId || currentCaseId || window.activeCaseData?.case_id;
        if (!targetCaseId) return true;
        if (studies.length === 0) return true;

        if (studyId) {
            return !!(sessionState[studyId]?.solved || getSavedState(targetCaseId)[studyId]?.solved);
        }
        // Wenn keine spezifische studyId übergeben wurde: Prüfen, ob alle Studien des Falls gelöst sind
        return studies.every(st => !!(sessionState[st.id]?.solved || getSavedState(targetCaseId)[st.id]?.solved));
    }

    function getStudyForAuditStep(stepObj, stepIndex = 0) {
        if (!studies || studies.length === 0 || !stepObj) return null;

        // 1. Explizite Verknüpfung über required_imaging_id oder linked_step_id
        if (stepObj.required_imaging_id) {
            const explicit = studies.find(s => s.id === stepObj.required_imaging_id);
            if (explicit) return explicit;
        }
        const byLinkedStep = studies.find(s => Number(s.linked_step_id) === Number(stepObj.step_id || (stepIndex + 1)));
        if (byLinkedStep) return byLinkedStep;

        // 2. Intelligente Klinische Heuristik: Wenn der Audit-Schritt Bildgebungs-Begriffe enthält
        const text = `${stepObj.phase || ''} ${stepObj.content || ''}`;
        const hasImagingMention = /(MRT|cMRT|CT|cCT|Angio-CT|Röntgen|Sonographie|Sono|EKG|T2-Hyperintensität|LETM|Eulenaugen|Bildgebung|Fotoserie|Aufnahme)/i.test(text);

        if (hasImagingMention) {
            return studies[Math.min(studies.length - 1, stepIndex)];
        }
        return null;
    }

    // ======================================================================
    // 2. BUILT-IN FALLBACK FÜR DEN MYELON-DEMOFALL (SOFORT TESTBAR)
    // ======================================================================
    function buildDemoFallbackImaging() {
        const svgSlice1 = `data:image/svg+xml;utf8,` + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
                <rect width="600" height="420" fill="#050811"/>
                <ellipse cx="300" cy="110" rx="92" ry="58" fill="#1e293b" stroke="#475569" stroke-width="2.5"/>
                <circle cx="300" cy="245" r="76" fill="#e2e8f0" stroke="#64748b" stroke-width="3"/>
                <path d="M212,222 Q182,300 285,345 L300,405 L315,345 Q418,300 388,222" fill="#1e293b" stroke="#475569" stroke-width="2.5"/>
                <ellipse cx="300" cy="245" rx="50" ry="40" fill="#334155" stroke="#1e293b" stroke-width="2"/>
                <path d="M272,222 Q285,245 274,268 Q290,252 300,252 Q310,252 326,268 Q315,245 328,222 Q312,238 300,238 Q288,238 272,222 Z" fill="#475569"/>
                <circle cx="279" cy="230" r="9.5" fill="#38bdf8"/><circle cx="279" cy="230" r="5.5" fill="#ffffff"/>
                <circle cx="321" cy="230" r="9.5" fill="#38bdf8"/><circle cx="321" cy="230" r="5.5" fill="#ffffff"/>
                <text x="18" y="28" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold">MRT BWS · T2w AXIAL HÖHE Th4 (SCHICHT 1/2)</text>
                <text x="18" y="46" fill="#94a3b8" font-family="monospace" font-size="11">Klicke auf die Läsion im Myelon-Querschnitt</text>
            </svg>`);

        const svgSlice2 = `data:image/svg+xml;utf8,` + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
                <rect width="600" height="420" fill="#050811"/>
                <g fill="#1e293b" stroke="#475569" stroke-width="2">
                    <rect x="175" y="30" width="72" height="50" rx="6"/><rect x="175" y="95" width="72" height="50" rx="6"/>
                    <rect x="175" y="160" width="72" height="50" rx="6"/><rect x="175" y="225" width="72" height="50" rx="6"/>
                    <rect x="175" y="290" width="72" height="50" rx="6"/><rect x="175" y="355" width="72" height="50" rx="6"/>
                </g>
                <rect x="262" y="20" width="80" height="385" fill="#e2e8f0" opacity="0.85"/>
                <rect x="282" y="20" width="40" height="385" fill="#334155"/>
                <rect x="283" y="160" width="15" height="145" rx="6" fill="#38bdf8"/>
                <rect x="285" y="165" width="10" height="135" rx="4" fill="#ffffff"/>
                <text x="18" y="28" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold">MRT BWS · T2w SAGITTAL (SCHICHT 2/2)</text>
                <text x="18" y="46" fill="#94a3b8" font-family="monospace" font-size="11">Ventrale bleistiftförmige Ischämie (A. spinalis anterior)</text>
            </svg>`);

        return [
            {
                id: 'demo_mri_asa_01',
                linked_step_id: 1,
                modality: 'Spinal-MRT T2w',
                title: 'Patient 1: Akute schlaffe Paraparese (Axiale & Sagittale Schichtserie)',
                clinical_question: 'Scrolle durch die Schichten, klicke direkt auf das pathognomonische Korrelat im Myelon und wähle den passenden Befund.',
                image_url: svgSlice1,
                slices: [
                    { url: svgSlice1, label: 'Schicht 1/2: Axial T2w (Höhe Th4)' },
                    { url: svgSlice2, label: 'Schicht 2/2: Sagittal T2w (BWS)' }
                ],
                attribution: 'MedCheck PACS Simulation / Radiopaedia Open Reference',
                hotspot: {
                    x: 50.0,
                    y: 55.0,
                    radius: 13,
                    label: 'Bilaterale T2-Hyperintensität der Vorderhörner (Eulenaugen-Zeichen)'
                },
                finding_options: [
                    'Dorsale Hyperintensität der Hinterstränge (Umgekehrtes V-Zeichen)',
                    'Bilaterale T2-Hyperintensität der Vorderhörner (Eulenaugen-Zeichen bei A.-spinalis-anterior-Ischämie)',
                    'Keilförmige exzentrische Läsion < 1 Segment im Seitenstrang (Klassische MS-Plaque)',
                    'Kompressive epidurale Raumforderung mit Myelonverlagerung nach ventral'
                ],
                correct_finding_index: 1,
                radiology_pearl: 'Das Eulenaugen-Zeichen (Owl-Eye / Snake-Eye Sign) entsteht durch die selektive Ischämie der stoffwechselaktiven motorischen Vorderhornneurone im Stromgebiet der A. spinalis anterior.'
            }
        ];
    }

    // ======================================================================
    // 3. NORMALISIERUNG DER IMAGING-DATEN DES FALLS
    // ======================================================================
    function normalizeCaseStudies(caseData) {
        if (!caseData) return [];

        let rawList = [];
        if (Array.isArray(caseData.imaging) && caseData.imaging.length > 0) {
            rawList = caseData.imaging;
        } else if (Array.isArray(caseData.extra_tasks?.imaging) && caseData.extra_tasks.imaging.length > 0) {
            rawList = caseData.extra_tasks.imaging;
        } else if (caseData.case_id === 'MYELON_MASTER_001_USB') {
            rawList = buildDemoFallbackImaging();
        }

        return rawList.map((st, idx) => {
            const slices = Array.isArray(st.slices) && st.slices.length > 0
                ? st.slices.map((sl, sIdx) => ({
                    url: typeof sl === 'string' ? sl : (sl.url || sl.image_url || st.image_url),
                    label: sl.label || `Schicht ${sIdx + 1} / ${st.slices.length}`,
                    hotspot: sl.hotspot || st.hotspot || { x: 50, y: 50, radius: 12, label: 'Pathologie' }
                }))
                : [{
                    url: st.image_url || st.url || '',
                    label: st.title || `Aufnahme 1 / 1`,
                    hotspot: st.hotspot || { x: 50, y: 50, radius: 12, label: 'Pathologie' }
                }];

            return {
                id: st.id || `study_${idx + 1}`,
                linked_step_id: st.linked_step_id || (idx + 1),
                modality: st.modality || 'CT / MRT / Röntgen',
                title: st.title || `Bildgebende Untersuchung ${idx + 1}`,
                clinical_question: st.clinical_question || 'Markiere die Pathologie direkt im Bild und wähle anschließend den korrekten Befund.',
                image_url: slices[0]?.url || '',
                slices: slices.filter(s => !!s.url),
                attribution: st.attribution || 'Radiopaedia / Wikimedia Commons (CC BY-NC-SA)',
                hotspot: {
                    x: Number(st.hotspot?.x ?? 50),
                    y: Number(st.hotspot?.y ?? 50),
                    radius: Number(st.hotspot?.radius ?? 12),
                    label: st.hotspot?.label || 'Pathologischer Hauptbefund'
                },
                finding_options: Array.isArray(st.finding_options) && st.finding_options.length > 0
                    ? st.finding_options
                    : [
                        'Unauffälliger Normalbefund ohne akute Pathologie',
                        st.hotspot?.label || 'Pathologischer Leitbefund in der markierten Region',
                        'Technisches Bewegungsartefakt ohne klinisches Korrelat',
                        'Chronisch-degenerative Veränderung ohne Akutrelevanz'
                    ],
                correct_finding_index: Number(st.correct_finding_index ?? 1),
                radiology_pearl: st.radiology_pearl || 'Systematische Befundung und klinische Korrelation sichern die Diagnose.'
            };
        }).filter(st => st.slices.length > 0);
    }

    // ======================================================================
    // 4. HAUPT-INITIALISIERUNG PRO FALL
    // ======================================================================
    function loadForCase(caseData, containerId = 'imaging-container') {
        currentCaseId = caseData?.case_id || null;
        currentContainerId = containerId;
        studies = normalizeCaseStudies(caseData);
        activeStudyIdx = 0;
        activeSliceIdx = 0;
        resetView();

        const container = document.getElementById(containerId);
        if (!container) return;

        if (studies.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            document.body.classList.remove('pacs-split-dock-active');
            return;
        }

        const saved = getSavedState(currentCaseId);
        sessionState = {};
        studies.forEach(st => {
            const prev = saved[st.id];
            sessionState[st.id] = {
                hotspotHit: !!prev?.solved,
                lastClick: prev?.solved ? { x: st.hotspot.x, y: st.hotspot.y, hit: true } : null,
                selectedOption: prev?.solved ? st.correct_finding_index : null,
                solved: !!prev?.solved
            };
        });

        container.style.display = 'block';
        renderWorkstation();
    }

    // ======================================================================
    // 5. PACS WORKSTATION RENDERING
    // ======================================================================
    function renderWorkstation() {
        const container = document.getElementById(currentContainerId);
        if (!container || studies.length === 0) return;

        const study = studies[activeStudyIdx] || studies[0];
        const slice = study.slices[activeSliceIdx] || study.slices[0];
        const activeHotspot = slice.hotspot || study.hotspot;
        const stState = sessionState[study.id] || { hotspotHit: false, lastClick: null, selectedOption: null, solved: false };
        const allSolvedCount = studies.filter(s => sessionState[s.id]?.solved).length;

        container.className = isDockedRight ? 'pacs-docked-right-container' : '';
        document.body.classList.toggle('pacs-split-dock-active', isDockedRight && !isCollapsed);

        const studyTabsHtml = studies.length > 1
            ? `<div class="pacs-study-tabs">
                ${studies.map((s, idx) => {
                    const isDone = !!sessionState[s.id]?.solved;
                    return `
                        <button type="button" class="pacs-study-tab ${idx === activeStudyIdx ? 'active' : ''} ${isDone ? 'is-solved' : ''}"
                                onclick="window.ImagingModule.selectStudy(${idx})">
                            ${isDone ? '✓ ' : '🩻 '}${escapeHtml(s.modality)} (${s.slices.length})
                        </button>
                    `;
                }).join('')}
               </div>`
            : '';

        const totalSlices = study.slices.length;

        container.innerHTML = `
            <div class="pacs-workstation-card ${stState.solved ? 'pacs-study-solved' : ''}" id="pacs-active-workstation">
                <!-- PACS Header -->
                <div class="pacs-header">
                    <div style="min-width: 0; flex: 1;">
                        <div class="pacs-kicker">
                            <span>🩻 RADIOPAEDIA / PACS WORKSTATION (${allSolvedCount}/${studies.length} BEFUNDET)</span>
                            ${stState.solved ? '<span class="pacs-solved-pill">✓ Konsil abgeschlossen</span>' : '<span class="pacs-pending-pill">● Befundung offen</span>'}
                        </div>
                        <h4 class="pacs-title">${escapeHtml(study.title)}</h4>
                    </div>

                    ${studyTabsHtml}

                    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                        <span class="pacs-modality-badge">${escapeHtml(study.modality)}</span>
                        <button type="button" class="pacs-tool-btn ${isDockedRight ? 'active' : ''}"
                                onclick="window.ImagingModule.toggleDockRight()"
                                title="Monitor rechts neben den Audit-Schritten andocken (Split-Workstation)">
                            ${isDockedRight ? '⤢ Standard-Ansicht' : '◫ Rechts andocken'}
                        </button>
                        <button type="button" class="pacs-tool-btn"
                                onclick="window.ImagingModule.toggleCollapse()"
                                title="Monitor ein-/ausklappen">
                            ${isCollapsed ? '▼ Aufklappen' : '▲ Einklappen'}
                        </button>
                    </div>
                </div>

                ${isCollapsed ? '' : `
                <div class="pacs-main-grid">
                    <!-- Linke Spalte: Interaktiver DICOM/Bild-Viewport + Serien-Scrubber -->
                    <div class="pacs-viewport-column">
                        <div class="pacs-viewport" id="pacs-interactive-viewport">
                            <div class="pacs-hud-overlay-top">
                                <span>${escapeHtml(slice.label)}</span>
                                <span>Zoom: ${Math.round(viewTransform.zoom * 100)}% · W/L: ${viewTransform.contrast}/${viewTransform.brightness}</span>
                            </div>

                            ${totalSlices > 1 ? `
                                <div class="pacs-vertical-slice-rail" title="Mausrad zum Durchscrollen der Bildserie nutzen">
                                    ${study.slices.map((_, sIdx) => `
                                        <div class="pacs-rail-tick ${sIdx === activeSliceIdx ? 'active' : ''}"
                                             onclick="event.stopPropagation(); window.ImagingModule.selectSlice(${sIdx})"></div>
                                    `).join('')}
                                </div>
                            ` : ''}

                            <div class="pacs-canvas-stage" id="pacs-canvas-stage"
                                 style="transform: translate(${viewTransform.panX}px, ${viewTransform.panY}px) scale(${viewTransform.zoom});">
                                <img src="${escapeHtml(slice.url)}"
                                     id="pacs-active-img"
                                     class="pacs-dicom-img"
                                     style="filter: brightness(${viewTransform.brightness}%) contrast(${viewTransform.contrast}%) ${viewTransform.invert ? 'invert(1)' : ''};"
                                     alt="${escapeHtml(study.title)}"
                                     draggable="false">

                                ${viewTransform.showGrid ? '<div class="pacs-measure-grid-overlay"></div>' : ''}

                                <!-- SVG Overlay für Hotspot-Treffer & Zielkreis -->
                                <svg class="pacs-svg-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    ${stState.hotspotHit ? `
                                        <circle cx="${activeHotspot.x}" cy="${activeHotspot.y}" r="${activeHotspot.radius}"
                                                class="pacs-target-circle-hit" />
                                        <circle cx="${activeHotspot.x}" cy="${activeHotspot.y}" r="1.4" fill="#10b981" />
                                    ` : ''}
                                    ${stState.lastClick && !stState.lastClick.hit ? `
                                        <circle cx="${stState.lastClick.x}" cy="${stState.lastClick.y}" r="2.2"
                                                class="pacs-click-miss-marker" />
                                    ` : ''}
                                </svg>
                            </div>

                            <div class="pacs-hud-overlay-bottom">
                                <span>🎯 ${stState.hotspotHit ? `Pathologie lokalisiert: ${escapeHtml(activeHotspot.label)}` : 'Schritt 1: Klicke direkt auf die Pathologie im Bild'}</span>
                                ${totalSlices > 1 ? '<span>🖱️ Mausrad = Schichten durchscrollen</span>' : ''}
                            </div>
                        </div>

                        <!-- Serien-Scrubber (falls mehrere Bilder/Schichten vorhanden) -->
                        ${totalSlices > 1 ? `
                            <div class="pacs-series-scrubber-bar">
                                <button type="button" class="pacs-tool-btn" onclick="window.ImagingModule.stepSlice(-1)" ${activeSliceIdx === 0 ? 'disabled' : ''}>◀</button>
                                <span class="pacs-slice-badge">Schicht ${activeSliceIdx + 1} / ${totalSlices}</span>
                                <input type="range" class="pacs-slice-range" min="0" max="${totalSlices - 1}" value="${activeSliceIdx}"
                                       oninput="window.ImagingModule.selectSlice(Number(this.value))">
                                <button type="button" class="pacs-tool-btn" onclick="window.ImagingModule.stepSlice(1)" ${activeSliceIdx === totalSlices - 1 ? 'disabled' : ''}>▶</button>
                            </div>
                        ` : ''}

                        <!-- Radiologie-Werkzeuge (Fensterung, Zoom, Invert, Messgitter) -->
                        <div class="pacs-sliders-bar">
                            <label class="pacs-slider-control" title="Helligkeit (Level)">
                                <span>☀️ Helligkeit</span>
                                <input type="range" min="50" max="160" value="${viewTransform.brightness}"
                                       oninput="window.ImagingModule.setFilter('brightness', Number(this.value))">
                            </label>
                            <label class="pacs-slider-control" title="Kontrast (Window)">
                                <span>◐ Kontrast</span>
                                <input type="range" min="60" max="200" value="${viewTransform.contrast}"
                                       oninput="window.ImagingModule.setFilter('contrast', Number(this.value))">
                            </label>
                            <div style="display: flex; gap: 5px; margin-left: auto;">
                                <button type="button" class="pacs-tool-btn" onclick="window.ImagingModule.zoomBy(0.3)" title="Vergrößern">🔍+</button>
                                <button type="button" class="pacs-tool-btn" onclick="window.ImagingModule.zoomBy(-0.3)" title="Verkleinern">🔍-</button>
                                <button type="button" class="pacs-tool-btn ${viewTransform.invert ? 'active' : ''}" onclick="window.ImagingModule.toggleInvert()" title="Negativ/Röntgen-Invertierung">🌓 Invert</button>
                                <button type="button" class="pacs-tool-btn ${viewTransform.showGrid ? 'active' : ''}" onclick="window.ImagingModule.toggleGrid()" title="Millimeter-/Messgitter">📏</button>
                                <button type="button" class="pacs-tool-btn" onclick="window.ImagingModule.resetView()" title="Reset">↺</button>
                            </div>
                        </div>
                        <div class="pacs-attribution-line">
                            📷 Quelle: ${escapeHtml(study.attribution)}
                        </div>
                    </div>

                    <!-- Rechte Spalte: Befundungs-Auftrag & Multiple-Choice Diagnose -->
                    <div class="pacs-findings-column">
                        <div class="pacs-question-box">
                            <div class="pacs-step-indicator">
                                <span class="pacs-step-pill ${stState.hotspotHit ? 'done' : 'current'}">
                                    ${stState.hotspotHit ? '✓ 1. Läsion lokalisiert' : '1. Läsion im Bild anklicken'}
                                </span>
                                <span class="pacs-step-pill ${stState.solved ? 'done' : (stState.hotspotHit ? 'current' : '')}">
                                    ${stState.solved ? '✓ 2. Befund gesichert' : '2. Befund auswählen'}
                                </span>
                            </div>
                            <div class="pacs-clinical-question">${escapeHtml(study.clinical_question)}</div>
                        </div>

                        <div id="pacs-hotspot-status-msg" class="pacs-hotspot-feedback ${stState.hotspotHit ? 'is-hit' : (stState.lastClick && !stState.lastClick.hit ? 'is-miss' : '')}">
                            ${stState.hotspotHit
                                ? `🎯 <strong>Exakt lokalisiert:</strong> ${escapeHtml(activeHotspot.label)}`
                                : (stState.lastClick && !stState.lastClick.hit
                                    ? `✕ Noch nicht getroffen (${stState.lastClick.hint || 'Suche die pathologische Signalveränderung im Bild'}). Klicke erneut oder nutze den Ziel-Hinweis.`
                                    : `👆 Klicke im Bild links direkt auf die verdächtige Struktur.`)}
                        </div>

                        ${!stState.hotspotHit ? `
                            <button type="button" class="pacs-tool-btn" style="align-self: flex-start; font-size: 0.72rem;"
                                    onclick="window.ImagingModule.revealHotspotHint()">
                                💡 Läsion im Bild markieren (Oberarzt-Hilfe)
                            </button>
                        ` : ''}

                        <div class="pacs-options-list">
                            <div style="font-size: 0.73rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
                                Radiologische Beurteilung wählen:
                            </div>
                            ${study.finding_options.map((opt, oIdx) => {
                                const isSelected = stState.selectedOption === oIdx;
                                const isCorrect = oIdx === study.correct_finding_index;
                                let btnClass = 'pacs-finding-opt-btn';
                                if (stState.solved && isCorrect) btnClass += ' is-correct';
                                else if (isSelected && !isCorrect) btnClass += ' is-wrong';

                                return `
                                    <button type="button" class="${btnClass}"
                                            ${stState.solved ? 'disabled' : ''}
                                            onclick="window.ImagingModule.selectFindingOption(${oIdx})">
                                        <span class="pacs-opt-letter">${String.fromCharCode(65 + oIdx)}</span>
                                        <span style="flex: 1; text-align: left;">${escapeHtml(opt)}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>

                        ${stState.solved ? `
                            <div class="pacs-pearl-box">
                                <div style="font-weight: 800; color: #38bdf8; margin-bottom: 4px; font-size: 0.78rem;">
                                    💎 Radiologische Perle & Klinische Konsequenz
                                </div>
                                <div style="font-size: 0.81rem; line-height: 1.5; color: var(--text-main);">
                                    ${escapeHtml(study.radiology_pearl)}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                `}
            </div>
        `;

        bindInteractiveViewport();
    }

    // ======================================================================
    // 6. VIEWPORT INTERAKTIONEN (HOTSPOT-KLICK, MAUSRAD-SERIEN-SCROLL, PAN)
    // ======================================================================
    function bindInteractiveViewport() {
        const viewport = document.getElementById('pacs-interactive-viewport');
        const img = document.getElementById('pacs-active-img');
        if (!viewport || !img) return;

        const study = studies[activeStudyIdx];
        if (!study) return;

        // A) Mausrad: Durch die Bildserie scrollen (oder mit Strg/Cmd zoomen)
        viewport.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                zoomBy(e.deltaY < 0 ? 0.25 : -0.25);
                return;
            }
            if (study.slices.length > 1) {
                e.preventDefault();
                if (wheelCooldown) return;
                wheelCooldown = true;
                setTimeout(() => { wheelCooldown = false; }, 65);
                stepSlice(e.deltaY > 0 ? 1 : -1);
            }
        }, { passive: false });

        // B) Drag-Panning bei aktivem Zoom
        viewport.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            didPanMove = false;
            if (viewTransform.zoom > 1.05) {
                isDraggingPan = true;
                dragStart = { x: e.clientX - viewTransform.panX, y: e.clientY - viewTransform.panY };
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingPan) return;
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            if (Math.abs(dx - viewTransform.panX) > 4 || Math.abs(dy - viewTransform.panY) > 4) {
                didPanMove = true;
            }
            viewTransform.panX = dx;
            viewTransform.panY = dy;
            const stage = document.getElementById('pacs-canvas-stage');
            if (stage) {
                stage.style.transform = `translate(${viewTransform.panX}px, ${viewTransform.panY}px) scale(${viewTransform.zoom})`;
            }
        });

        window.addEventListener('mouseup', () => {
            isDraggingPan = false;
        });

        // C) Klick auf das Bild -> Relative Prozent-Koordinaten (0-100%) prüfen
        viewport.addEventListener('click', (e) => {
            if (didPanMove) {
                didPanMove = false;
                return;
            }
            const rect = img.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            const clickX = ((e.clientX - rect.left) / rect.width) * 100;
            const clickY = ((e.clientY - rect.top) / rect.height) * 100;
            if (clickX < 0 || clickX > 100 || clickY < 0 || clickY > 100) return;

            evaluateHotspotClick(clickX, clickY);
        });
    }

    function evaluateHotspotClick(x, y) {
        const study = studies[activeStudyIdx];
        if (!study) return;
        const slice = study.slices[activeSliceIdx] || study.slices[0];
        const target = slice.hotspot || study.hotspot;
        const stState = sessionState[study.id];

        const dist = Math.hypot(x - target.x, y - target.y);
        const isHit = dist <= (target.radius || 12);

        if (isHit) {
            stState.hotspotHit = true;
            stState.lastClick = { x: target.x, y: target.y, hit: true };
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic([10, 30, 10]);

            // Prüfen, ob die richtige Befund-Option bereits gewählt wurde -> dann Studie komplett lösen
            if (stState.selectedOption === study.correct_finding_index && !stState.solved) {
                finalizeStudySolved(study);
            }
        } else {
            // Richtungshinweis berechnen, damit der Student sokratisch geleitet wird
            const dirY = y < target.y - 6 ? 'weiter kaudal / unten' : (y > target.y + 6 ? 'weiter kranial / oben' : '');
            const dirX = x < target.x - 6 ? 'weiter rechts im Bild' : (x > target.x + 6 ? 'weiter links im Bild' : '');
            const dirHint = [dirY, dirX].filter(Boolean).join(' und ') || 'ganz in der Nähe';
            stState.lastClick = { x, y, hit: false, hint: `Tipp: Suche ${dirHint}` };
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(15);
        }

        renderWorkstation();
    }

    function revealHotspotHint() {
        const study = studies[activeStudyIdx];
        if (!study) return;
        const stState = sessionState[study.id];
        stState.hotspotHit = true;
        stState.lastClick = { x: study.hotspot.x, y: study.hotspot.y, hit: true };
        renderWorkstation();
    }

    function selectFindingOption(optIdx) {
        const study = studies[activeStudyIdx];
        if (!study) return;
        const stState = sessionState[study.id];
        if (stState.solved) return;

        stState.selectedOption = optIdx;
        const isCorrect = optIdx === study.correct_finding_index;

        if (isCorrect) {
            if (!stState.hotspotHit) {
                // Falls der Student zuerst die richtige Diagnose klickt, markieren wir auch den Hotspot als gelöst
                stState.hotspotHit = true;
            }
            finalizeStudySolved(study);
        } else {
            if (typeof window.trackSkill === 'function') window.trackSkill('Diagnostik', false);
            if (typeof window.applyXpDelta === 'function') window.applyXpDelta(-15, 'Fehlbefund PACS');
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(20);
        }

        renderWorkstation();
    }

    function finalizeStudySolved(study) {
        const stState = sessionState[study.id];
        if (stState.solved) return;
        stState.solved = true;

        saveStudyState(currentCaseId, study.id, { solved: true });
        if (typeof window.trackSkill === 'function') window.trackSkill('Diagnostik', true);
        if (typeof window.applyXpDelta === 'function') window.applyXpDelta(75, `PACS-Befund: ${study.modality}`);
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic([12, 40, 15]);

        // Event feuern -> js/audit.js entsperrt sofort das Pflicht-Befundungs-Gate!
        window.dispatchEvent(new CustomEvent('medcheck:imagingSolved', {
            detail: { caseId: currentCaseId, studyId: study.id }
        }));
    }

    // ======================================================================
    // 7. STEUERUNGS-HELFER (SLICE-NAVIGATION, FILTER, DOCK, FOCUS)
    // ======================================================================
    function selectStudy(idx) {
        if (idx < 0 || idx >= studies.length) return;
        activeStudyIdx = idx;
        activeSliceIdx = 0;
        resetView();
    }

    function selectSlice(sIdx) {
        const study = studies[activeStudyIdx];
        if (!study) return;
        activeSliceIdx = Math.max(0, Math.min(study.slices.length - 1, sIdx));
        renderWorkstation();
    }

    function stepSlice(delta) {
        selectSlice(activeSliceIdx + delta);
    }

    function setFilter(key, val) {
        viewTransform[key] = val;
        const img = document.getElementById('pacs-active-img');
        if (img) {
            img.style.filter = `brightness(${viewTransform.brightness}%) contrast(${viewTransform.contrast}%) ${viewTransform.invert ? 'invert(1)' : ''}`;
        }
    }

    function zoomBy(delta) {
        viewTransform.zoom = Math.max(0.75, Math.min(4.0, +(viewTransform.zoom + delta).toFixed(2)));
        if (viewTransform.zoom <= 1) {
            viewTransform.panX = 0;
            viewTransform.panY = 0;
        }
        renderWorkstation();
    }

    function toggleInvert() {
        viewTransform.invert = !viewTransform.invert;
        renderWorkstation();
    }

    function toggleGrid() {
        viewTransform.showGrid = !viewTransform.showGrid;
        renderWorkstation();
    }

    function resetView() {
        viewTransform = { zoom: 1, panX: 0, panY: 0, brightness: 100, contrast: 100, invert: false, showGrid: false };
        renderWorkstation();
    }

    function toggleDockRight(forceState) {
        isDockedRight = typeof forceState === 'boolean' ? forceState : !isDockedRight;
        if (isDockedRight) isCollapsed = false;
        renderWorkstation();
    }

    function toggleCollapse() {
        isCollapsed = !isCollapsed;
        renderWorkstation();
    }

    // Wird vom Pflicht-Befundungs-Gate aus js/audit.js aufgerufen, wenn man auf "Jetzt im PACS befunden" klickt
    function focusStudyFromAudit(studyId) {
        const idx = studies.findIndex(s => s.id === studyId);
        if (idx !== -1) activeStudyIdx = idx;
        isCollapsed = false;
        renderWorkstation();

        const ws = document.getElementById('pacs-active-workstation');
        if (ws) {
            ws.scrollIntoView({ behavior: 'smooth', block: 'center' });
            ws.classList.add('pacs-attention-pulse');
            setTimeout(() => ws.classList.remove('pacs-attention-pulse'), 1600);
        }
    }

    return {
        loadForCase,
        isStudySolved,
        getStudyForAuditStep,
        selectStudy,
        selectSlice,
        stepSlice,
        selectFindingOption,
        revealHotspotHint,
        setFilter,
        zoomBy,
        toggleInvert,
        toggleGrid,
        resetView,
        toggleDockRight,
        toggleCollapse,
        focusStudyFromAudit
    };
})();

window.ImagingModule = ImagingModule;
