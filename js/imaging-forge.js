/* ==========================================================================
   MEDCHECK – RADIOLOGY SEARCH & HOTSPOT CALIBRATOR V2.5 (js/imaging-forge.js)
   Durchsucht Wikimedia Commons / Radiopaedia-CC-Bestände, kalibriert Hotspots,
   baut durchscrollbare Bildserien (Stacks) und generiert Befundoptionen per Gemini.
   ========================================================================== */

const ImagingForge = (() => {
    let state = {
        results: [],
        selectedImage: null,
        seriesSlices: [], // Erlaubt das Sammeln mehrerer Bilder zu einer durchscrollbaren Serie!
        hotspot: { x: 50, y: 50, radius: 11 },
        linkedStepId: 1,
        modality: 'cCT / cMRT',
        title: '',
        question: 'Scrolle durch die Aufnahme, markiere die pathologische Struktur direkt im Bild und wähle die korrekte radiologische Beurteilung.',
        label: '',
        options: [
            'Normalbefund ohne akute Pathologie',
            'Pathologischer Hauptbefund',
            'Technisches Artefakt / anatomische Normvariante',
            'Alte postischämische Narbe ohne Raumforderung'
        ],
        correctIdx: 1,
        pearl: '',
        isGeneratingAi: false
    };

    function escapeSafe(str) {
        return String(str || '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        return (tmp.textContent || tmp.innerText || '').trim();
    }

    // ======================================================================
    // 1. LIVE-SUCHE ÜBER WIKIMEDIA COMMONS / RADIOPAEDIA OPEN REPOSITORY
    // ======================================================================
    async function searchOpenRadiology(queryInput) {
        const query = (queryInput || document.getElementById('img-forge-query')?.value || '').trim();
        const statusEl = document.getElementById('img-forge-status');
        const gridEl = document.getElementById('img-forge-results');
        if (!query || !gridEl) return;

        if (statusEl) statusEl.textContent = '🔍 Durchsuche Open-Access-Radiologie (Wikimedia / Radiopaedia CC)...';
        gridEl.innerHTML = '';

        try {
            const searchQuery = `filetype:bitmap (radiopaedia OR CT OR MRI OR ultrasound OR X-ray OR sonography OR radiograph) ${query}`;
            const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=900&format=json&origin=*`;

            const res = await fetch(endpoint);
            const data = await res.json();
            const pages = Object.values(data?.query?.pages || {});

            state.results = pages
                .map(p => {
                    const info = p.imageinfo?.[0];
                    if (!info) return null;
                    const meta = info.extmetadata || {};
                    const artist = stripHtml(meta.Artist?.value || 'Radiopaedia / Wikimedia Contributor');
                    const license = stripHtml(meta.LicenseShortName?.value || 'CC BY-SA');
                    const desc = stripHtml(meta.ImageDescription?.value || p.title.replace(/^File:/, ''));

                    return {
                        pageId: p.pageid,
                        fileName: p.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' '),
                        description: desc.slice(0, 350),
                        thumbUrl: info.thumburl || info.url,
                        fullUrl: info.url,
                        width: info.width,
                        height: info.height,
                        attribution: `${artist} (${license}) – via Wikimedia Commons`
                    };
                })
                .filter(Boolean);

            if (state.results.length === 0) {
                if (statusEl) statusEl.textContent = `Keine Treffer für „${query}“. Tipp: Englische Fachbegriffe liefern die meisten Radiopaedia-Treffer (z. B. "subdural hematoma", "pneumothorax", "ischemic stroke MRI").`;
                return;
            }

            if (statusEl) statusEl.textContent = `✓ ${state.results.length} Aufnahmen gefunden – klicke ein Bild zum Kalibrieren (oder füge mehrere zu einer Serie zusammen):`;

            gridEl.innerHTML = state.results.map((item, idx) => `
                <div class="img-forge-thumb-card" onclick="window.ImagingForge.selectSearchResult(${idx})">
                    <img src="${escapeSafe(item.thumbUrl)}" alt="${escapeSafe(item.fileName)}" loading="lazy">
                    <div class="img-forge-thumb-meta">
                        <div class="img-forge-thumb-title">${escapeSafe(item.fileName)}</div>
                        <div class="img-forge-thumb-attr">${escapeSafe(item.attribution)}</div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            if (statusEl) statusEl.textContent = `Fehler bei der Bildsuche: ${err.message}`;
        }
    }

    // ======================================================================
    // 2. BILD AUSWÄHLEN & AUTOMATISCHE KI-BEFUNDOPTIONEN GENERIEREN
    // ======================================================================
    function selectSearchResult(idx) {
        const item = state.results[idx];
        if (!item) return;

        state.selectedImage = item;
        if (!state.title) state.title = item.fileName;
        state.hotspot = { x: 50, y: 50, radius: 11 };
        renderCalibrator();
    }

    function addCurrentImageToSeriesStack() {
        if (!state.selectedImage) return;
        state.seriesSlices.push({
            url: state.selectedImage.fullUrl,
            label: `Schicht ${state.seriesSlices.length + 1}: ${state.selectedImage.fileName.slice(0, 36)}`,
            hotspot: { ...state.hotspot, label: state.label || state.title || 'Pathologie' }
        });
        renderCalibrator();
    }

    function clearSeriesStack() {
        state.seriesSlices = [];
        renderCalibrator();
    }

    async function autoFillWithAI() {
        if (!state.selectedImage || state.isGeneratingAi) return;
        state.isGeneratingAi = true;
        renderCalibrator();

        const caseContext = document.getElementById('forge-topic')?.value || '';
        const prompt = `Du bist Oberarzt für Radiologie. Erstelle für ein interaktives Medizinstudenten-Falltraining anhand dieser Bild-Metadaten ein JSON-Objekt (NUR reines JSON, ohne Markdown-Codeblock):
Bildtitel: "${state.selectedImage.fileName}"
Bildbeschreibung: "${state.selectedImage.description || ''}"
Fallkontext: "${caseContext}"

Format:
{
  "modality": "z.B. cCT nativ / cMRT DWI / Thorax-Röntgen p.a. / Abdomen-Sono",
  "title": "Prägnanter deutscher Titel der Aufnahme",
  "clinical_question": "Kurzer Arbeitsauftrag für den Studenten (1 Satz)",
  "label": "Exakte Bezeichnung der gesuchten Zielstruktur",
  "finding_options": [
    "Plausible Differentialdiagnose / Distraktor 1",
    "Korrekte radiologische Beschreibung des Hauptbefunds",
    "Plausible Differentialdiagnose / Distraktor 2",
    "Plausible Differentialdiagnose / Distraktor 3"
  ],
  "correct_finding_index": 1,
  "radiology_pearl": "Kompakte, prüfungsrelevante Radiologie-Perle (1-2 Sätze)"
}`;

        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const data = await response.json();
            // WICHTIG: Unterstützt data.generatedText aus deiner api/gemini.js!
            const rawText = data?.generatedText || data?.text || data?.result || data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = String(rawText).match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.modality) state.modality = parsed.modality;
                if (parsed.title) state.title = parsed.title;
                if (parsed.clinical_question) state.question = parsed.clinical_question;
                if (parsed.label) state.label = parsed.label;
                if (Array.isArray(parsed.finding_options) && parsed.finding_options.length === 4) {
                    state.options = parsed.finding_options;
                    state.correctIdx = Number(parsed.correct_finding_index ?? 1);
                }
                if (parsed.radiology_pearl) state.pearl = parsed.radiology_pearl;
            }
        } catch (err) {
            console.warn('[ImagingForge] KI-Auto-Fill fehlgeschlagen:', err);
        } finally {
            state.isGeneratingAi = false;
            renderCalibrator();
        }
    }

    function setCustomImageUrl(url, attributionText = 'Eigene / Radiopaedia Case Upload (CC BY-NC-SA 3.0)') {
        const cleanUrl = (url || '').trim();
        if (!cleanUrl) return;
        state.selectedImage = {
            fileName: 'Klinischer Befund',
            description: '',
            thumbUrl: cleanUrl,
            fullUrl: cleanUrl,
            attribution: attributionText
        };
        state.hotspot = { x: 50, y: 50, radius: 11 };
        renderCalibrator();
    }

    function renderCalibrator() {
        const calContainer = document.getElementById('img-forge-calibrator');
        if (!calContainer || !state.selectedImage) return;

        calContainer.style.display = 'block';
        calContainer.innerHTML = `
            <div class="pacs-workstation-card" style="margin-top: 14px;">
                <div class="pacs-header">
                    <div>
                        <div class="pacs-kicker">HOTSPOT- & SERIEN-KALIBRATOR</div>
                        <h4 class="pacs-title">1× im Bild auf die Pathologie klicken & ins Fall-JSON übernehmen</h4>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <span class="pacs-modality-badge">X: ${state.hotspot.x.toFixed(1)}% · Y: ${state.hotspot.y.toFixed(1)}% · R: ${state.hotspot.radius}%</span>
                        <button type="button" class="action-btn secondary btn-sm"
                                ${state.isGeneratingAi ? 'disabled' : ''}
                                onclick="window.ImagingForge.autoFillWithAI()">
                            ${state.isGeneratingAi ? '⏳ KI analysiert Bild...' : '✨ Fragen & Distraktoren per KI füllen'}
                        </button>
                    </div>
                </div>

                <div class="pacs-main-grid">
                    <div>
                        <div class="pacs-viewport" id="forge-cal-viewport" style="max-height: 360px;">
                            <div class="pacs-canvas-stage">
                                <img src="${escapeSafe(state.selectedImage.fullUrl)}"
                                     id="forge-cal-img"
                                     class="pacs-dicom-img"
                                     style="max-height: 356px;"
                                     alt="Kalibrierung">
                                <svg class="pacs-svg-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <circle cx="${state.hotspot.x}" cy="${state.hotspot.y}" r="${state.hotspot.radius}"
                                            fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="0.8" />
                                    <circle cx="${state.hotspot.x}" cy="${state.hotspot.y}" r="1.2" fill="#ffffff" />
                                </svg>
                            </div>
                        </div>
                        <div class="pacs-sliders-bar">
                            <label class="pacs-slider-control">
                                <span>🎯 Ziel-Toleranzradius (${state.hotspot.radius}%)</span>
                                <input type="range" min="5" max="25" value="${state.hotspot.radius}"
                                       oninput="window.ImagingForge.updateRadius(Number(this.value))">
                            </label>
                            <button type="button" class="pacs-tool-btn" onclick="window.ImagingForge.addCurrentImageToSeriesStack()" title="Fügt dieses Bild als Schicht zur aktuellen Bildserie hinzu">
                                ➕ Als Schicht zur Serie (${state.seriesSlices.length})
                            </button>
                            ${state.seriesSlices.length > 0 ? `
                                <button type="button" class="pacs-tool-btn" onclick="window.ImagingForge.clearSeriesStack()">🗑️ Serie leeren</button>
                            ` : ''}
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 6px;">
                            Quelle: ${escapeSafe(state.selectedImage.attribution)}
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; gap: 8px;">
                            <input type="text" class="forge-topic-input" style="min-height: auto; margin: 0; flex: 1;"
                                   placeholder="Modalität (z. B. cCT nativ, Thorax-Röntgen)"
                                   value="${escapeSafe(state.modality)}"
                                   oninput="window.ImagingForge.updateField('modality', this.value)">
                            <input type="number" class="forge-topic-input" style="min-height: auto; margin: 0; width: 135px;"
                                   min="1" max="9" title="Welcher Audit-Schritt (1-9) soll durch dieses Bild gesperrt werden?"
                                   placeholder="Audit-Step (1-9)"
                                   value="${escapeSafe(state.linkedStepId)}"
                                   oninput="window.ImagingForge.updateField('linkedStepId', Number(this.value))">
                        </div>

                        <input type="text" class="forge-topic-input" style="min-height: auto; margin: 0;"
                               placeholder="Titel der Aufnahme / Serie"
                               value="${escapeSafe(state.title)}"
                               oninput="window.ImagingForge.updateField('title', this.value)">

                        <input type="text" class="forge-topic-input" style="min-height: auto; margin: 0;"
                               placeholder="Zielstruktur-Label (z. B. Sichelförmiges subdurales Hämatom links)"
                               value="${escapeSafe(state.label)}"
                               oninput="window.ImagingForge.updateField('label', this.value)">

                        <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); margin-top: 2px;">
                            Befund-Optionen (Radio-Button = korrekte Antwort):
                        </div>
                        ${state.options.map((opt, i) => `
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="radio" name="forge-img-correct" ${state.correctIdx === i ? 'checked' : ''}
                                       onchange="window.ImagingForge.updateField('correctIdx', ${i})">
                                <input type="text" class="forge-topic-input" style="min-height: auto; margin: 0; padding: 6px 10px; font-size: 0.8rem;"
                                       value="${escapeSafe(opt)}"
                                       oninput="window.ImagingForge.updateOption(${i}, this.value)">
                            </div>
                        `).join('')}

                        <input type="text" class="forge-topic-input" style="min-height: auto; margin: 0;"
                               placeholder="Radiologie-Perle für die Auflösung"
                               value="${escapeSafe(state.pearl)}"
                               oninput="window.ImagingForge.updateField('pearl', this.value)">

                        <button type="button" class="action-btn" onclick="window.ImagingForge.injectIntoForgeJson()">
                            ⚡ Bildgebungs-Block (${state.seriesSlices.length > 0 ? `${state.seriesSlices.length} Schichten` : '1 Aufnahme'}) in Fall-JSON einfügen
                        </button>
                    </div>
                </div>
            </div>
        `;

        const img = document.getElementById('forge-cal-img');
        const vp = document.getElementById('forge-cal-viewport');
        if (vp && img) {
            vp.onclick = (e) => {
                const rect = img.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
                    state.hotspot.x = Number(x.toFixed(1));
                    state.hotspot.y = Number(y.toFixed(1));
                    renderCalibrator();
                }
            };
        }
    }

    function updateRadius(r) {
        state.hotspot.radius = r;
        renderCalibrator();
    }

    function updateField(key, val) {
        state[key] = val;
    }

    function updateOption(idx, val) {
        state.options[idx] = val;
    }

    // ======================================================================
    // 3. FERTIGEN IMAGING-BLOCK IN #forge-input MERGEN
    // ======================================================================
    function injectIntoForgeJson() {
        const textarea = document.getElementById('forge-input');
        if (!textarea || !state.selectedImage) return;

        const slicesToSave = state.seriesSlices.length > 0
            ? [...state.seriesSlices]
            : [{
                url: state.selectedImage.fullUrl,
                label: state.title || state.selectedImage.fileName,
                hotspot: {
                    x: state.hotspot.x,
                    y: state.hotspot.y,
                    radius: state.hotspot.radius,
                    label: state.label || state.title || 'Pathologisches Korrelat'
                }
            }];

        const newStudy = {
            id: 'img_' + Date.now().toString(36),
            linked_step_id: Number(state.linkedStepId) || 1,
            modality: state.modality || 'Radiologie',
            title: state.title || 'Bildgebender Befund',
            clinical_question: state.question,
            image_url: slicesToSave[0].url,
            slices: slicesToSave,
            attribution: state.selectedImage.attribution,
            hotspot: {
                x: state.hotspot.x,
                y: state.hotspot.y,
                radius: state.hotspot.radius,
                label: state.label || state.title || 'Pathologisches Korrelat'
            },
            finding_options: [...state.options],
            correct_finding_index: state.correctIdx,
            radiology_pearl: state.pearl || 'Systematische Befundung von innen nach außen durchführen.'
        };

        try {
            const raw = textarea.value.trim();
            const parsed = raw ? JSON.parse(raw) : { case_id: 'custom_imaging_case_01', metadata: { title: state.title }, timeline: [] };
            if (!Array.isArray(parsed.imaging)) parsed.imaging = [];
            parsed.imaging.push(newStudy);
            textarea.value = JSON.stringify(parsed, null, 2);
            state.seriesSlices = [];

            const fb = document.getElementById('forge-fb');
            if (fb) {
                fb.className = 'feedback-box feedback-success';
                fb.style.display = 'block';
                fb.textContent = `✓ Radiologie-Studie „${newStudy.title}“ (${slicesToSave.length} Schicht/en, gekoppelt an Audit-Schritt ${newStudy.linked_step_id}) ins JSON eingefügt!`;
            }
        } catch (err) {
            alert('Bitte stelle sicher, dass im Fall-JSON-Feld bereits gültiges JSON steht (oder leere es komplett): ' + err.message);
        }
    }

    return {
        searchOpenRadiology,
        selectSearchResult,
        addCurrentImageToSeriesStack,
        clearSeriesStack,
        autoFillWithAI,
        setCustomImageUrl,
        updateRadius,
        updateField,
        updateOption,
        injectIntoForgeJson
    };
})();

window.ImagingForge = ImagingForge;
