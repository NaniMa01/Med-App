/* ==========================================================================
   MEDCHECK – CLINICAL CASCADES MODULE V2.0 (js/cascade.js)
   ==========================================================================
   FEATURES V2.0:
   01. 0ms Instant Touch/iPad/Desktop Pointer-Drag (kein iOS Long-Press-Delay)
   02. Magnetisches Drop-Snapping & sanfter Spring-Back-Effekt
   03. Automatischer Viewport-Edge-Scroll beim Ziehen über lange 8-Stufen-Kaskaden
   04. Direkter Slot-zu-Slot-Tausch (Swap) per Drag & Drop oder ↑/↓ Buttons
   05. Sokratisches Teil-Lock-In: Korrekte Stufen rasten bei Prüfung grün ein
   06. Volle ProgressManager-Persistenz (speichert & restauriert gelöste Kaskaden)
   ========================================================================== */

(function initClinicalCascadesModule() {
    let globalCascadePointerBound = false;
    let autoScrollRaf = null;

    // Status für das verzögerungsfreie Pointer-Dragging
    let casDrag = {
        active: false,
        hasMoved: false,
        pointerId: null,
        cIndex: null,
        origIndex: null,
        itemEl: null,
        originZone: null,
        originRect: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        offsetX: 0,
        offsetY: 0,
        ghostEl: null,
        hoveredTarget: null
    };

    function escapeCasHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, tag => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag
        ));
    }

    function getSavedCascadeState() {
        if (!activeCaseData || window.isSpecialtyBlindMode || !window.ProgressManager) return { solvedIndices: [] };
        const saved = window.ProgressManager.getCaseProgress(activeCaseData.case_id);
        const solvedIndices = Array.isArray(saved?.cascades?.solvedIndices) ? saved.cascades.solvedIndices : [];
        return { solvedIndices };
    }

    function persistCascadeSolved(cIndex) {
        if (!activeCaseData || window.isSpecialtyBlindMode || typeof window.saveChallengeProgress !== 'function') return;
        const current = getSavedCascadeState();
        if (!current.solvedIndices.includes(cIndex)) {
            current.solvedIndices.push(cIndex);
        }
        window.saveChallengeProgress('cascades', {
            solvedCount: cascadesSolvedCount,
            totalCount: totalCascades,
            solvedIndices: current.solvedIndices
        });
    }

    // ======================================================================
    // 01. RENDERING DER KLINISCHEN KASKADEN
    // ======================================================================
    window.renderCascades = function() {
        const wrapper = document.getElementById('cascades-wrapper');
        if (!wrapper) return;

        const cascades = activeCaseData?.extra_tasks?.clinical_cascades || [];
        totalCascades = cascades.length;

        const { solvedIndices } = getSavedCascadeState();
        cascadesSolvedCount = solvedIndices.filter(idx => idx >= 0 && idx < totalCascades).length;

        const badge = document.getElementById('badge-mode-cascade');
        if (badge) {
            badge.innerText = `${cascadesSolvedCount}/${totalCascades}`;
            badge.style.background = (cascadesSolvedCount >= totalCascades && totalCascades > 0)
                ? 'var(--color-symptom, #10b981)'
                : '';
        }

        if (cascades.length === 0) {
            wrapper.innerHTML = `
                <div class="feedback-box feedback-neutral" style="display:block;">
                    Für diesen Fall sind keine klinischen Kaskaden hinterlegt.
                </div>`;
            return;
        }

        wrapper.innerHTML = cascades.map((cData, cIndex) => {
            const isAlreadySolved = solvedIndices.includes(cIndex);
            const rawStages = cData.cascade || [];

            // Stufen kopieren und mit Original-Index versehen
            let items = rawStages.map((c, i) => ({ ...c, originalIndex: i }));

            // Nur mischen, wenn die Kaskade noch nicht gelöst ist
            if (!isAlreadySolved) {
                for (let i = items.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [items[i], items[j]] = [items[j], items[i]];
                }
            }

            const renderDragCardHtml = (it, isLocked = false) => `
                <div class="drag-item cas-draggable-card ${isLocked ? 'is-locked-card' : ''}"
                     data-cindex="${cIndex}"
                     data-orig-index="${it.originalIndex}"
                     id="drag-${cIndex}-${it.originalIndex}">
                    <span class="cas-drag-grip" title="Ziehen oder Antippen">⠿</span>
                    <span class="cas-drag-text">${escapeCasHtml(it.content)}</span>
                    <div class="cas-step-quick-actions">
                        <button type="button" class="cas-nudge-btn" data-nudge-dir="-1" title="Eine Stufe nach oben tauschen">↑</button>
                        <button type="button" class="cas-nudge-btn" data-nudge-dir="1" title="Eine Stufe nach unten tauschen">↓</button>
                        <button type="button" class="cas-remove-btn" data-remove-card="true" title="Zurück in die Bank legen">✕</button>
                    </div>
                </div>
            `;

            const bankHtml = isAlreadySolved
                ? ''
                : items.map(it => renderDragCardHtml(it, false)).join('');

            const flowHtml = rawStages.map((orig, i) => {
                const labelText = orig.stage && orig.stage.includes('_')
                    ? orig.stage.split('_').slice(1).join(' ')
                    : `Stufe ${i + 1}`;

                const prefilledCard = isAlreadySolved
                    ? renderDragCardHtml({ ...orig, originalIndex: i }, true)
                    : '';

                return `
                    <div class="drop-zone-wrapper">
                        <div class="drop-zone-label">
                            <span>${i + 1}. ${escapeCasHtml(labelText)}</span>
                            <span class="cas-zone-status-tag" id="cas-status-${cIndex}-${i}">
                                ${isAlreadySolved ? '✓ Gesichert' : ''}
                            </span>
                        </div>
                        <div class="drop-zone ${isAlreadySolved ? 'correct' : ''}"
                             data-cindex="${cIndex}"
                             data-drop-idx="${i}"
                             data-expected="${i}">
                            ${prefilledCard}
                        </div>
                        ${i < rawStages.length - 1 ? '<div class="flow-arrow">↓</div>' : ''}
                    </div>`;
            }).join('');

            return `
                <div class="cascade-disease-container" id="cascade-box-${cIndex}">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px;">
                        <div class="disease-title" style="margin-bottom:0; border-bottom:none; padding-bottom:0;">
                            ${cIndex + 1}. ${escapeCasHtml(cData.disease || 'Kaskade')}
                        </div>
                        <span class="cas-progress-pill" id="cas-prog-pill-${cIndex}">
                            ${isAlreadySolved ? `✓ ${rawStages.length}/${rawStages.length} gelöst` : `0/${rawStages.length} platziert`}
                        </span>
                    </div>

                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">
                        Ziehe die Stufen ohne Verzögerung in den Ablauf (oder tippe sie an). Bereits platzierte Stufen lassen sich direkt untereinander tauschen:
                    </div>

                    <div class="drag-bank ${isAlreadySolved ? 'hidden' : ''}" id="bank-${cIndex}" data-cindex="${cIndex}">
                        ${bankHtml}
                    </div>

                    <div class="flow-path">
                        ${flowHtml}
                    </div>

                    <button type="button" class="action-btn" id="cas-eval-btn-${cIndex}" onclick="window.evalSingleCascade(${cIndex})" style="margin-top:20px; width:100%; display:${isAlreadySolved ? 'none' : 'inline-flex'};">
                        Algorithmus prüfen
                    </button>

                    <div class="feedback-box ${isAlreadySolved ? 'feedback-success' : ''}" id="cascade-fb-${cIndex}" style="display:${isAlreadySolved ? 'block' : 'none'};">
                        ${isAlreadySolved ? `<strong>Hervorragend!</strong> Kaskade für ${escapeCasHtml(cData.disease || 'diese Erkrankung')} fehlerfrei rekonstruiert.` : ''}
                    </div>
                </div>`;
        }).join('');

        bindCascadePointerEvents(wrapper);
        cascades.forEach((_, idx) => updateCascadeCounterPill(idx));
    };

    function updateCascadeCounterPill(cIndex) {
        const container = document.getElementById(`cascade-box-${cIndex}`);
        const pill = document.getElementById(`cas-prog-pill-${cIndex}`);
        if (!container || !pill) return;

        const zones = Array.from(container.querySelectorAll('.drop-zone'));
        const total = zones.length;
        const filled = zones.filter(z => z.querySelector('.drag-item')).length;
        const allLockedCorrect = zones.every(z => z.classList.contains('correct'));

        if (allLockedCorrect && total > 0) {
            pill.textContent = `✓ ${total}/${total} gelöst`;
            pill.classList.add('is-complete');
        } else {
            pill.textContent = `${filled}/${total} platziert`;
            pill.classList.remove('is-complete');
        }

        // Bank optisch komprimieren, wenn alle Elemente platziert sind
        const bank = document.getElementById(`bank-${cIndex}`);
        if (bank) {
            bank.classList.toggle('is-empty-bank', bank.querySelectorAll('.drag-item').length === 0);
        }
    }

    // ======================================================================
    // 02. PLATZIERUNGS- & SWAP-LOGIK (INKL. SLOT-ZU-SLOT TAUSCH)
    // ======================================================================
    function moveCardToDropZone(itemEl, targetZone, cIndex) {
        if (!itemEl || !targetZone || targetZone.classList.contains('correct')) return;

        const originParent = itemEl.parentElement;
        if (originParent === targetZone) return;

        const bank = document.getElementById(`bank-${cIndex}`);
        const existingOccupant = targetZone.querySelector('.drag-item');

        // Wenn in der Ziel-Dropzone bereits ein Element liegt:
        if (existingOccupant && existingOccupant !== itemEl) {
            // Kam die gezogene Karte aus einer anderen Dropzone -> Direkter Platztausch (Swap)!
            if (originParent && originParent.classList.contains('drop-zone') && !originParent.classList.contains('correct')) {
                originParent.appendChild(existingOccupant);
                triggerSnapAnimation(existingOccupant);
            } else if (bank) {
                // Kam die gezogene Karte aus der Bank -> Altes Element zurück in die Bank
                bank.appendChild(existingOccupant);
                triggerSnapAnimation(existingOccupant);
            }
        }

        targetZone.classList.remove('cas-wrong-shake');
        targetZone.appendChild(itemEl);
        triggerSnapAnimation(itemEl);

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
        updateCascadeCounterPill(cIndex);
    }

    function moveCardToBank(itemEl, cIndex) {
        const bank = document.getElementById(`bank-${cIndex}`);
        if (!itemEl || !bank) return;
        const parentZone = itemEl.closest('.drop-zone');
        if (parentZone && parentZone.classList.contains('correct')) return;
        if (parentZone) parentZone.classList.remove('cas-wrong-shake');

        bank.appendChild(itemEl);
        triggerSnapAnimation(itemEl);
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(4);
        updateCascadeCounterPill(cIndex);
    }

    // Schiebt eine platzierte Stufe per ↑ oder ↓ Button um 1 Position nach oben/unten
    function nudgePlacedCard(itemEl, cIndex, delta) {
        const currentZone = itemEl.closest('.drop-zone');
        const container = document.getElementById(`cascade-box-${cIndex}`);
        if (!currentZone || !container || currentZone.classList.contains('correct')) return;

        const allZones = Array.from(container.querySelectorAll('.drop-zone'));
        const curIdx = allZones.indexOf(currentZone);
        if (curIdx === -1) return;

        // Nächste nicht-gesperrte Zone in Richtung delta suchen
        let targetIdx = curIdx + delta;
        while (targetIdx >= 0 && targetIdx < allZones.length && allZones[targetIdx].classList.contains('correct')) {
            targetIdx += delta;
        }

        if (targetIdx >= 0 && targetIdx < allZones.length) {
            moveCardToDropZone(itemEl, allZones[targetIdx], cIndex);
        }
    }

    function triggerSnapAnimation(el) {
        if (!el) return;
        el.classList.remove('cas-anim-snap');
        void el.offsetWidth;
        el.classList.add('cas-anim-snap');
    }

    // Legacy-Funktionen für Abwärtskompatibilität erhalten
    window.clickPlaceItem = function(cIndex, origIndex) {
        const item = document.getElementById(`drag-${cIndex}-${origIndex}`);
        if (!item || item.parentElement.classList.contains('drop-zone')) return;
        const container = document.getElementById(`cascade-box-${cIndex}`);
        if (!container) return;
        const emptyZone = Array.from(container.querySelectorAll('.drop-zone'))
            .find(z => !z.classList.contains('correct') && !z.querySelector('.drag-item'));
        if (emptyZone) moveCardToDropZone(item, emptyZone, cIndex);
    };

    window.clickRemoveItem = function(cIndex, dropIdx) {
        const container = document.getElementById(`cascade-box-${cIndex}`);
        if (!container) return;
        const zone = container.querySelectorAll('.drop-zone')[dropIdx];
        const item = zone?.querySelector('.drag-item');
        if (item && !zone.classList.contains('correct')) {
            moveCardToBank(item, cIndex);
        }
    };

    // ======================================================================
    // 03. 0ms POINTER-DRAG, AUTO-SCROLL & MAGNETIC DROP ENGINE
    // ======================================================================
    function clearCascadeMagneticHighlights() {
        document.querySelectorAll('.cas-magnetic-target').forEach(el => {
            el.classList.remove('cas-magnetic-target');
        });
    }

    function findBestCascadeDropTarget(ghostRect, cIndex, originZone) {
        const container = document.getElementById(`cascade-box-${cIndex}`);
        if (!container) return null;

        const magneticPadding = 18;
        const candidates = [];

        // 1. Alle ungesperrten Drop-Zones dieser Kaskade prüfen
        container.querySelectorAll('.drop-zone:not(.correct)').forEach(zoneEl => {
            if (zoneEl === originZone) return;
            candidates.push({ type: 'zone', el: zoneEl, rect: zoneEl.getBoundingClientRect() });
        });

        // 2. Auch die Bank als Rückgabe-Ziel prüfen (falls die Karte aus einer Dropzone kommt)
        const bankEl = document.getElementById(`bank-${cIndex}`);
        if (bankEl && originZone !== bankEl) {
            candidates.push({ type: 'bank', el: bankEl, rect: bankEl.getBoundingClientRect() });
        }

        let bestMatch = null;
        let highestScore = 0;

        const ghostCenterX = ghostRect.left + ghostRect.width / 2;
        const ghostCenterY = ghostRect.top + ghostRect.height / 2;

        candidates.forEach(cand => {
            const r = cand.rect;
            const expLeft = r.left - magneticPadding;
            const expRight = r.right + magneticPadding;
            const expTop = r.top - magneticPadding;
            const expBottom = r.bottom + magneticPadding;

            const overlapX = Math.max(0, Math.min(ghostRect.right, expRight) - Math.max(ghostRect.left, expLeft));
            const overlapY = Math.max(0, Math.min(ghostRect.bottom, expBottom) - Math.max(ghostRect.top, expTop));
            const overlapArea = overlapX * overlapY;

            if (overlapArea > 0) {
                const targetCenterX = r.left + r.width / 2;
                const targetCenterY = r.top + r.height / 2;
                const dist = Math.hypot(ghostCenterX - targetCenterX, ghostCenterY - targetCenterY);
                const score = overlapArea - dist * 10;

                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = cand;
                }
            }
        });

        return bestMatch;
    }

    function startCascadeAutoScrollLoop() {
        if (autoScrollRaf) return;
        const EDGE_THRESHOLD = 95;
        const MAX_SCROLL_SPEED = 18;

        const step = () => {
            if (!casDrag.active || !casDrag.hasMoved) {
                autoScrollRaf = null;
                return;
            }

            const vh = window.innerHeight;
            const y = casDrag.currentY;
            let deltaY = 0;

            if (y < EDGE_THRESHOLD) {
                deltaY = -Math.ceil(((EDGE_THRESHOLD - y) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
            } else if (y > vh - EDGE_THRESHOLD) {
                deltaY = Math.ceil(((y - (vh - EDGE_THRESHOLD)) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
            }

            if (deltaY !== 0) {
                const scroller = document.querySelector('.main-wrapper') || document.scrollingElement || document.documentElement;
                if (scroller === document.documentElement || scroller === document.body) {
                    window.scrollBy(0, deltaY);
                } else {
                    scroller.scrollTop += deltaY;
                }
            }

            autoScrollRaf = requestAnimationFrame(step);
        };

        autoScrollRaf = requestAnimationFrame(step);
    }

    function bindCascadePointerEvents(wrapper) {
        // Event-Delegation für Karten und Nudge-Buttons innerhalb des Wrappers
        if (wrapper.dataset.pointerBound !== 'true') {
            wrapper.dataset.pointerBound = 'true';

            wrapper.addEventListener('contextmenu', (e) => {
                if (e.target.closest('.cas-draggable-card')) e.preventDefault();
            });

            wrapper.addEventListener('pointerdown', (e) => {
                const cardEl = e.target.closest('.cas-draggable-card');
                if (!cardEl) return;

                // Gesperrte (bereits als korrekt bestätigte) Stufen nicht mehr verschieben
                if (cardEl.classList.contains('is-locked-card') || cardEl.closest('.drop-zone.correct')) return;

                // Falls auf einen der Schnell-Buttons (↑, ↓, ✕) geklickt wurde -> nicht ziehen, sondern Button ausführen!
                if (e.target.closest('.cas-nudge-btn') || e.target.closest('.cas-remove-btn')) {
                    e.stopPropagation();
                    return;
                }

                if (e.button !== undefined && e.button !== 0) return;

                e.preventDefault();
                e.stopPropagation();

                const rect = cardEl.getBoundingClientRect();
                casDrag.active = true;
                casDrag.hasMoved = false;
                casDrag.pointerId = e.pointerId;
                casDrag.cIndex = parseInt(cardEl.dataset.cindex, 10);
                casDrag.origIndex = parseInt(cardEl.dataset.origIndex, 10);
                casDrag.itemEl = cardEl;
                casDrag.originZone = cardEl.parentElement;
                casDrag.originRect = rect;
                casDrag.startX = e.clientX;
                casDrag.startY = e.clientY;
                casDrag.currentX = e.clientX;
                casDrag.currentY = e.clientY;
                casDrag.offsetX = e.clientX - rect.left;
                casDrag.offsetY = e.clientY - rect.top;
                casDrag.ghostEl = null;
                casDrag.hoveredTarget = null;
            });

            // Klick-Listener für die ↑ / ↓ / ✕ Schnell-Buttons auf platzierten Karten
            wrapper.addEventListener('click', (e) => {
                const nudgeBtn = e.target.closest('.cas-nudge-btn');
                if (nudgeBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const cardEl = nudgeBtn.closest('.cas-draggable-card');
                    if (cardEl) {
                        const cIndex = parseInt(cardEl.dataset.cindex, 10);
                        const dir = parseInt(nudgeBtn.dataset.nudgeDir, 10);
                        nudgePlacedCard(cardEl, cIndex, dir);
                    }
                    return;
                }

                const removeBtn = e.target.closest('.cas-remove-btn');
                if (removeBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const cardEl = removeBtn.closest('.cas-draggable-card');
                    if (cardEl) {
                        const cIndex = parseInt(cardEl.dataset.cindex, 10);
                        moveCardToBank(cardEl, cIndex);
                    }
                }
            });
        }

        if (globalCascadePointerBound) return;
        globalCascadePointerBound = true;

        window.addEventListener('pointermove', (e) => {
            if (!casDrag.active || e.pointerId !== casDrag.pointerId) return;

            casDrag.currentX = e.clientX;
            casDrag.currentY = e.clientY;

            const dx = e.clientX - casDrag.startX;
            const dy = e.clientY - casDrag.startY;

            // Sofortiges Aufheben ab 5px Bewegung (0ms Wartezeit!)
            if (!casDrag.hasMoved) {
                if (Math.hypot(dx, dy) < 5) return;
                casDrag.hasMoved = true;

                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);

                const ghost = casDrag.itemEl.cloneNode(true);
                ghost.className = 'drag-item cas-drag-ghost-floating';
                ghost.style.width = `${casDrag.originRect.width}px`;
                ghost.style.height = `${casDrag.originRect.height}px`;
                ghost.style.left = '0px';
                ghost.style.top = '0px';
                ghost.style.transform = `translate3d(${casDrag.originRect.left}px, ${casDrag.originRect.top}px, 0) scale(1.03) rotate(1deg)`;
                document.body.appendChild(ghost);

                casDrag.ghostEl = ghost;
                casDrag.itemEl.classList.add('cas-is-dragging-source');
                document.body.classList.add('cas-touch-dragging');

                startCascadeAutoScrollLoop();
            }

            e.preventDefault();

            const newLeft = e.clientX - casDrag.offsetX;
            const newTop = e.clientY - casDrag.offsetY;

            if (casDrag.ghostEl) {
                casDrag.ghostEl.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0) scale(1.03) rotate(1deg)`;
            }

            const currentGhostRect = {
                left: newLeft,
                top: newTop,
                right: newLeft + casDrag.originRect.width,
                bottom: newTop + casDrag.originRect.height,
                width: casDrag.originRect.width,
                height: casDrag.originRect.height
            };

            const bestTarget = findBestCascadeDropTarget(currentGhostRect, casDrag.cIndex, casDrag.originZone);
            clearCascadeMagneticHighlights();

            if (bestTarget && bestTarget.el) {
                bestTarget.el.classList.add('cas-magnetic-target');
                casDrag.hoveredTarget = bestTarget;
            } else {
                casDrag.hoveredTarget = null;
            }
        }, { passive: false });

        const finishCascadePointer = (e, isCancel = false) => {
            if (!casDrag.active || (e && e.pointerId !== casDrag.pointerId)) return;

            const wasDragging = casDrag.hasMoved;
            const itemEl = casDrag.itemEl;
            const cIndex = casDrag.cIndex;
            const origIndex = casDrag.origIndex;
            const target = casDrag.hoveredTarget;
            const ghostEl = casDrag.ghostEl;
            const originZone = casDrag.originZone;

            casDrag.active = false;
            casDrag.hasMoved = false;
            casDrag.pointerId = null;
            casDrag.hoveredTarget = null;

            if (autoScrollRaf) {
                cancelAnimationFrame(autoScrollRaf);
                autoScrollRaf = null;
            }

            clearCascadeMagneticHighlights();
            document.body.classList.remove('cas-touch-dragging');

            if (wasDragging && !isCancel) {
                if (target && target.type === 'zone') {
                    if (ghostEl) ghostEl.remove();
                    if (itemEl) itemEl.classList.remove('cas-is-dragging-source');
                    moveCardToDropZone(itemEl, target.el, cIndex);
                    return;
                }
                if (target && target.type === 'bank') {
                    if (ghostEl) ghostEl.remove();
                    if (itemEl) itemEl.classList.remove('cas-is-dragging-source');
                    moveCardToBank(itemEl, cIndex);
                    return;
                }

                // Im Leeren losgelassen -> Sanfter Spring-Back zur Ursprungsposition
                if (ghostEl && itemEl) {
                    const currentOriginRect = itemEl.getBoundingClientRect();
                    ghostEl.style.transition = 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease';
                    ghostEl.style.transform = `translate3d(${currentOriginRect.left}px, ${currentOriginRect.top}px, 0) scale(1) rotate(0deg)`;
                    setTimeout(() => {
                        ghostEl.remove();
                        itemEl.classList.remove('cas-is-dragging-source');
                    }, 200);
                } else {
                    if (ghostEl) ghostEl.remove();
                    if (itemEl) itemEl.classList.remove('cas-is-dragging-source');
                }
                return;
            }

            if (ghostEl) ghostEl.remove();
            if (itemEl) itemEl.classList.remove('cas-is-dragging-source');

            if (isCancel) return;

            // Kurzer Tap (< 5px Bewegung):
            // Liegt die Karte in der Bank -> In die erste freie Stufe legen!
            // Liegt die Karte bereits in einer Stufe -> Zurück in die Bank legen!
            if (originZone && originZone.classList.contains('drag-bank')) {
                window.clickPlaceItem(cIndex, origIndex);
            } else if (originZone && originZone.classList.contains('drop-zone') && !originZone.classList.contains('correct')) {
                moveCardToBank(itemEl, cIndex);
            }
        };

        window.addEventListener('pointerup', (e) => finishCascadePointer(e, false));
        window.addEventListener('pointercancel', (e) => finishCascadePointer(e, true));
    }

    // ======================================================================
    // 04. SOKRATISCHE AUSWERTUNG MIT TEIL-LOCK-IN
    // ======================================================================
    window.returnWrongCascadeStepsToBank = function(cIndex) {
        const container = document.getElementById(`cascade-box-${cIndex}`);
        if (!container) return;

        container.querySelectorAll('.drop-zone:not(.correct)').forEach(zone => {
            const item = zone.querySelector('.drag-item');
            if (item) {
                moveCardToBank(item, cIndex);
            }
        });
    };

    window.evalSingleCascade = function(cIndex) {
        const container = document.getElementById(`cascade-box-${cIndex}`);
        if (!container) return;

        const zones = Array.from(container.querySelectorAll('.drop-zone'));
        const fb = document.getElementById(`cascade-fb-${cIndex}`);
        let filledCount = 0;
        let correctCount = 0;

        zones.forEach((zone, zIdx) => {
            const item = zone.querySelector('.drag-item');
            const statusTag = document.getElementById(`cas-status-${cIndex}-${zIdx}`);
            if (!item) return;

            filledCount++;
            const expected = parseInt(zone.getAttribute('data-expected'), 10);
            const actual = parseInt(item.dataset.origIndex, 10);

            if (expected === actual) {
                correctCount++;
                // Korrekte Stufen direkt grün sichern (Lock-In)!
                zone.classList.add('correct');
                zone.classList.remove('cas-wrong-shake');
                item.classList.add('is-locked-card');
                if (statusTag) statusTag.textContent = '✓ Gesichert';
            } else {
                zone.classList.remove('correct');
                zone.classList.remove('cas-wrong-shake');
                void zone.offsetWidth;
                zone.classList.add('cas-wrong-shake');
                if (statusTag) statusTag.textContent = '✕ Position prüfen';
            }
        });

        updateCascadeCounterPill(cIndex);

        if (!fb) return;
        fb.style.display = 'block';

        if (filledCount < zones.length) {
            fb.className = 'feedback-box feedback-neutral';
            fb.innerHTML = `<strong>Noch ${zones.length - filledCount} Stufe(n) offen:</strong> Bitte platziere zuerst alle Stufen im Ablauf (${correctCount} bereits korrekt gesichert).`;
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
            return;
        }

        if (correctCount === zones.length) {
            if (typeof applyXpDelta === 'function') applyXpDelta(150, 'Flow-Chart gemeistert');
            if (typeof trackSkill === 'function') trackSkill('Pathophysiologie', true);

            const diseaseName = activeCaseData?.extra_tasks?.clinical_cascades?.[cIndex]?.disease || 'Erkrankung';
            fb.className = 'feedback-box feedback-success';
            fb.innerHTML = `<strong>Hervorragend!</strong> Die gesamte pathophysiologische Kaskade für <strong>${escapeCasHtml(diseaseName)}</strong> wurde fehlerfrei rekonstruiert.`;

            const evalBtn = document.getElementById(`cas-eval-btn-${cIndex}`);
            if (evalBtn) evalBtn.style.display = 'none';

            const bank = document.getElementById(`bank-${cIndex}`);
            if (bank) bank.classList.add('hidden');

            const { solvedIndices } = getSavedCascadeState();
            if (!solvedIndices.includes(cIndex)) {
                cascadesSolvedCount++;
                persistCascadeSolved(cIndex);
            }

            const badge = document.getElementById('badge-mode-cascade');
            if (badge) {
                badge.innerText = `${cascadesSolvedCount}/${totalCascades}`;
                if (cascadesSolvedCount >= totalCascades) {
                    badge.style.background = 'var(--color-symptom, #10b981)';
                }
            }

            if (typeof window.checkFinalCompletion === 'function') window.checkFinalCompletion();
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic([10, 50, 15]);
        } else {
            if (typeof applyXpDelta === 'function') applyXpDelta(-15, 'Kaskade Korrektur');
            if (typeof trackSkill === 'function') trackSkill('Pathophysiologie', false);

            const wrongCount = zones.length - correctCount;
            fb.className = 'feedback-box feedback-error';
            fb.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <strong>Fast geschafft (${correctCount} von ${zones.length} Stufen korrekt gesichert!):</strong><br>
                        Noch <strong>${wrongCount} Stufe(n)</strong> befinden sich an der falschen kausalen Stelle. Ziehe die rot markierten Stufen direkt aufeinander, um sie zu tauschen!
                    </div>
                    <button type="button" class="action-btn secondary btn-sm" onclick="window.returnWrongCascadeStepsToBank(${cIndex})">
                        🔄 Falsche Stufen in Bank zurücklegen
                    </button>
                </div>
            `;
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(20);
        }
    };
})();
