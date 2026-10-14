/**
 * js/specialty.js - Lernen nach Fachrichtung (Blind-Modus, Session-Queue, Reveal, separater Fortschritt)
 */
const SPECIALTY_STORAGE_KEY = 'medcheck_specialty_progress';
const specialtySession = { field: null, queue: [], currentId: null, recorded: false };
// ============================================================================
// MEDCHECK FACHRICHTUNGS-ENGINE & ASPEKT-ROTATION
// ============================================================================

const SpecialtyEngine = {
  activeSpecialty: null,
  caseQueue: [],
  currentIndex: 0,
  
  // Speichert für jeden Fall, welche Bestandteile bereits gezeigt wurden:
  // { [caseId]: { seenPatients: [0], seenCascades: [1], seenQuestions: [3], seenPuzzles: [0] } }
  history: JSON.parse(localStorage.getItem('medcheck_aspect_history') || '{}'),

  /**
   * Startet den Fachrichtungsmodus mit gemischter Fall-Queue
   */
  start(specialtyName) {
    const norm = specialtyName.trim().toLowerCase();
    
    // Alle passenden Fälle ermitteln
    const matches = (state.allCases || []).filter(c => {
      const field = (c.metadata?.medical_field || c.medical_field || c.category || '').toLowerCase();
      return field.includes(norm);
    });

    if (matches.length === 0) {
      alert(`Keine Fälle für das Fachgebiet "${specialtyName}" hinterlegt.`);
      return;
    }

    // Fisher-Yates-Shuffle für unvorhersehbare Fall-Reihenfolge
    const shuffled = [...matches];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    this.activeSpecialty = specialtyName;
    this.caseQueue = shuffled;
    this.currentIndex = 0;
    state.currentMode = 'specialty';

    this.loadCurrentCase();
  },

  /**
   * Lädt den aktuellen Fall der Queue und schneidet ihn auf 1 Teilaufgabe pro Challenge zu
   */
  async loadCurrentCase() {
    if (this.currentIndex >= this.caseQueue.length) {
      this.renderFinishedScreen();
      return;
    }

    const caseItem = this.caseQueue[this.currentIndex];

    // Roh-JSON laden (gecacht oder via Fetch)
    let rawData = caseItem;
    if (caseItem.file && !caseItem.timeline) {
      try {
        const res = await fetch(caseItem.file);
        rawData = await res.json();
      } catch (err) {
        console.error("Fehler beim Laden des Falls:", err);
        alert("Fall konnte nicht geladen werden.");
        return;
      }
    }

    // Deep-Clone erstellen, damit das Original im Dashboard vollständig bleibt
    const clonedCase = JSON.parse(JSON.stringify(rawData));
    const caseId = clonedCase.case_id || clonedCase.metadata?.title || `case_${this.currentIndex}`;

    // Historie für diesen Fall initialisieren
    if (!this.history[caseId]) {
      this.history[caseId] = { seenPatients: [], seenCascades: [], seenQuestions: [], seenPuzzles: [] };
    }
    const h = this.history[caseId];

    // -------------------------------------------------------------
    // 1. AUDIT: Exakt 1 Patient (3 Schritte) rotierend auswählen
    // -------------------------------------------------------------
    if (Array.isArray(clonedCase.timeline) && clonedCase.timeline.length > 0) {
      // Gruppierung nach Patient (entweder nach patient_id oder in 3er-Blöcken)
      const patientGroups = [];
      const pidMap = new Map();

      clonedCase.timeline.forEach(step => {
        const pid = step.patient_id || 'unknown';
        if (!pidMap.has(pid)) {
          pidMap.set(pid, []);
          patientGroups.push(pidMap.get(pid));
        }
        pidMap.get(pid).push(step);
      });

      // Fallback: Falls keine patient_id existiert, stur in 3er-Blöcke schneiden
      let chunks = patientGroups.filter(g => g.length > 0);
      if (chunks.length === 1 && chunks[0].length >= 6) {
        chunks = [];
        for (let i = 0; i < clonedCase.timeline.length; i += 3) {
          chunks.push(clonedCase.timeline.slice(i, i + 3));
        }
      }

      // Nächsten ungesehenen Patienten wählen (oder Reset bei Volldurchlauf)
      let availableIndices = chunks.map((_, i) => i).filter(i => !h.seenPatients.includes(i));
      if (availableIndices.length === 0) {
        h.seenPatients = [];
        availableIndices = chunks.map((_, i) => i);
      }
      const chosenPatientIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      h.seenPatients.push(chosenPatientIdx);

      // Die 3 Schritte isolieren und step_id sauber auf 1, 2, 3 normieren
      const singlePatientTimeline = chunks[chosenPatientIdx].map((step, idx) => ({
        ...step,
        step_id: idx + 1 // audit.js setzt auf sequentielle Indizes von 1 bis 3
      }));

      clonedCase.timeline = singlePatientTimeline;
    }

    // -------------------------------------------------------------
    // 2. KASKADE: Exakt 1 Kaskade rotierend auswählen
    // -------------------------------------------------------------
    const cascades = clonedCase.extra_tasks?.clinical_cascades;
    if (Array.isArray(cascades) && cascades.length > 0) {
      let avail = cascades.map((_, i) => i).filter(i => !h.seenCascades.includes(i));
      if (avail.length === 0) {
        h.seenCascades = [];
        avail = cascades.map((_, i) => i);
      }
      const chosenCascadeIdx = avail[Math.floor(Math.random() * avail.length)];
      h.seenCascades.push(chosenCascadeIdx);
      clonedCase.extra_tasks.clinical_cascades = [cascades[chosenCascadeIdx]];
    }

    // -------------------------------------------------------------
    // 3. MASTER QUIZ: Exakt 1 Multiple-Choice-Frage auswählen
    // -------------------------------------------------------------
    const questions = clonedCase.extra_tasks?.master_quiz;
    if (Array.isArray(questions) && questions.length > 0) {
      let avail = questions.map((_, i) => i).filter(i => !h.seenQuestions.includes(i));
      if (avail.length === 0) {
        h.seenQuestions = [];
        avail = questions.map((_, i) => i);
      }
      const chosenQIdx = avail[Math.floor(Math.random() * avail.length)];
      h.seenQuestions.push(chosenQIdx);
      clonedCase.extra_tasks.master_quiz = [questions[chosenQIdx]];
    }

    // -------------------------------------------------------------
    // 4. DOCTORDLE: Exakt 1 Rätsel-Fall auswählen
    // -------------------------------------------------------------
    const doctordles = clonedCase.extra_tasks?.doctordle;
    if (Array.isArray(doctordles) && doctordles.length > 0) {
      let avail = doctordles.map((_, i) => i).filter(i => !h.seenPuzzles.includes(i));
      if (avail.length === 0) {
        h.seenPuzzles = [];
        avail = doctordles.map((_, i) => i);
      }
      const chosenDocIdx = avail[Math.floor(Math.random() * avail.length)];
      h.seenPuzzles.push(chosenDocIdx);
      clonedCase.extra_tasks.doctordle = [doctordles[chosenDocIdx]];
    }

    // Historie persistent sichern
    localStorage.setItem('medcheck_aspect_history', JSON.stringify(this.history));

    // -------------------------------------------------------------
    // 5. SYNAPSEN & TAXONOMIE: Bleiben vollständig (DD-Training)
    // -------------------------------------------------------------

    // Aktiven Case setzen & rendern
    state.currentCase = clonedCase;
    this.renderCaseView(clonedCase);
  },

  /**
   * Bereitet das UI für den Blind-Modus vor und initialisiert die Module
   */
  renderCaseView(caseData) {
    // Views umschalten
    document.getElementById('view-dashboard')?.classList.add('hidden');
    document.getElementById('specialty-hub')?.classList.add('hidden');
    const caseView = document.getElementById('view-case') || document.getElementById('case-container');
    caseView?.classList.remove('hidden');

    // Sticky-Bar oben einblenden und Daten setzen
    const bar = document.getElementById('specialty-sticky-bar');
    if (bar) {
      bar.classList.remove('hidden');
      document.getElementById('specialty-pill-name').textContent = this.activeSpecialty;
      document.getElementById('specialty-pill-counter').textContent = `Fall ${this.currentIndex + 1} / ${this.caseQueue.length}`;
    }

    // Header anonymisieren (Spoiler-Schutz)
    const titleEl = document.getElementById('case-title') || document.querySelector('.case-header-title');
    if (titleEl) {
      titleEl.textContent = `${this.activeSpecialty} • Syndromale Falldiskussion`;
    }
    const subtitleEl = document.getElementById('case-subtitle') || document.querySelector('.case-header-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = "Analysiere die Befunde und erarbeite die Differenzialdiagnose.";
    }

    // Bestehende Challenge-Module triggern
    if (typeof initAudit === 'function' && caseData.timeline) {
      initAudit(caseData.timeline);
    }
    if (typeof initCascade === 'function' && caseData.extra_tasks?.clinical_cascades) {
      initCascade(caseData.extra_tasks.clinical_cascades);
    }
    if (typeof initSynapses === 'function' && caseData.extra_tasks?.synapses_matrix) {
      initSynapses(caseData.extra_tasks.synapses_matrix);
    }
    if (typeof initTaxonomy === 'function' && caseData.extra_tasks?.categorization) {
      initTaxonomy(caseData.extra_tasks.categorization);
    }
    if (typeof initQuiz === 'function' && caseData.extra_tasks?.master_quiz) {
      initQuiz(caseData.extra_tasks.master_quiz);
    }

    // Fenster nach oben scrollen
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * Springt zum nächsten Fall in der Queue
   */
  nextCase() {
    this.currentIndex++;
    this.loadCurrentCase();
  },

  /**
   * Screen, wenn alle Fälle der Fachrichtung absolviert wurden
   */
  renderFinishedScreen() {
    const caseView = document.getElementById('view-case') || document.getElementById('case-container');
    if (!caseView) return;

    caseView.innerHTML = `
      <div class="specialty-finish-card">
        <div class="finish-icon">🏆</div>
        <h2>Alle Fälle in ${this.activeSpecialty} abgeschlossen!</h2>
        <p>Du hast alle registrierten Krankheitsbilder dieser Fachrichtung in verschiedenen Konstellationen analysiert.</p>
        <div class="finish-actions">
          <button type="button" class="btn btn-primary" id="btn-restart-specialty">
            🔄 Fachrichtung erneut trainieren (neue Varianten)
          </button>
          <button type="button" class="btn btn-outline" id="btn-exit-specialty">
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    `;
  }
};

// ============================================================================
// GLOBALE EVENT-DELEGATION (Funktioniert IMMER, unabhängig von innerHTML)
// ============================================================================

document.addEventListener('click', (e) => {
  // 1. Klick auf "Nächstes Krankheitsbild"
  if (e.target.closest('#btn-next-specialty-case')) {
    e.preventDefault();
    document.getElementById('reveal-modal')?.remove(); // Offenes Modal schließen
    SpecialtyEngine.nextCase();
    return;
  }

  // 2. Klick auf "Diagnose enthüllen"
  if (e.target.closest('#btn-reveal-diagnosis')) {
    e.preventDefault();
    showDiagnosisModal();
    return;
  }

  // 3. Modus beenden / zurück zum Dashboard
  if (e.target.closest('#btn-exit-specialty')) {
    e.preventDefault();
    document.getElementById('specialty-sticky-bar')?.classList.add('hidden');
    document.getElementById('reveal-modal')?.remove();
    document.getElementById('view-case')?.classList.add('hidden');
    document.getElementById('case-container')?.classList.add('hidden');
    document.getElementById('view-dashboard')?.classList.remove('hidden');
    return;
  }

  // 4. Fachrichtung neu starten
  if (e.target.closest('#btn-restart-specialty')) {
    e.preventDefault();
    SpecialtyEngine.start(SpecialtyEngine.activeSpecialty);
    return;
  }

  // 5. Modal schließen
  if (e.target.closest('#btn-close-modal') || e.target.classList.contains('modal-backdrop')) {
    document.getElementById('reveal-modal')?.remove();
    return;
  }
});

/**
 * Öffnet das Enthüllungs-Modal
 */
function showDiagnosisModal() {
  const c = state.currentCase;
  if (!c) return;

  const title = c.metadata?.title || 'Klinischer Fall';
  const primary = c.metadata?.primary_disease || title;
  const summary = c.case_overview?.summary || 'Keine Zusammenfassung hinterlegt.';
  const pearl = c.extra_tasks?.doctordle?.[0]?.learning_pearl || '';

  const modalHtml = `
    <div class="modal-backdrop" id="reveal-modal">
      <div class="modal-card">
        <div class="modal-header">
          <span class="badge-tag">${SpecialtyEngine.activeSpecialty}</span>
          <button class="btn-close" id="btn-close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <span class="diag-subtitle">Ziel-Diagnose:</span>
          <h2 class="diag-headline">${primary}</h2>
          <p class="diag-meta">${title}</p>

          <div class="diag-section">
            <h4>Pathophysiologische Synthese:</h4>
            <p>${summary}</p>
          </div>

          ${pearl ? `
            <div class="diag-pearl">
              <strong>Klinische Take-Home-Pearl:</strong>
              <p>${pearl}</p>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary btn-block" id="btn-next-specialty-case">
            Nächstes Krankheitsbild bearbeiten ➔
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('reveal-modal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

const SpecialtyStore = {
    getAll() {
        try {
            const data = JSON.parse(localStorage.getItem(SPECIALTY_STORAGE_KEY));
            return data && typeof data === 'object' ? data : {};
        } catch (e) { return {}; }
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
        try { localStorage.setItem(SPECIALTY_STORAGE_KEY, JSON.stringify(all)); }
        catch (e) { console.error('Specialty-Progress Schreibfehler:', e); }
        if (window.Cloud) window.Cloud.scheduleProgressSync();
    },
    // Fortschritt zurücksetzen (gesammelte Punkte bleiben erhalten)
    resetCompleted(field) {
        const e = this.get(field);
        this.save(field, { ...e, completedCaseIds: [] });
    }
};

function getSpecialtyCases(field) {
    return window.getRegisteredCases().filter(c => (c.metadata?.medical_field || '').trim() === field);
}

function shuffleFisherYates(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

window.setLearningMode = function(mode) {
    const specialty = mode === 'specialty';
    const set = (id, display) => { const el = document.getElementById(id); if (el) el.style.display = display; };
    set('topic-grid', specialty ? 'none' : 'block');
    set('specialty-hub', specialty ? 'grid' : 'none');
    document.getElementById('seg-topic')?.classList.toggle('active', !specialty);
    document.getElementById('seg-specialty')?.classList.toggle('active', specialty);
    if (specialty) window.renderSpecialtyHub();
};

window.renderSpecialtyHub = function() {
    const hub = document.getElementById('specialty-hub');
    if (!hub) return;

    const fields = {};
    window.getRegisteredCases().forEach(c => {
        const f = (c.metadata?.medical_field || '').trim();
        if (f) fields[f] = (fields[f] || 0) + 1;
    });

    const entries = Object.entries(fields).sort((a, b) => a[0].localeCompare(b[0], 'de'));
    if (!entries.length) {
        hub.innerHTML = '<div class="specialty-empty">Keine Fachrichtungen verfügbar.</div>';
        return;
    }

    hub.innerHTML = entries.map(([field, count]) => {
        const ids = new Set(getSpecialtyCases(field).map(c => c.case_id));
        const done = SpecialtyStore.get(field).completedCaseIds.filter(id => ids.has(id)).length;
        const pct = count ? Math.round((done / count) * 100) : 0;
        return `
            <div class="specialty-card" role="button" tabindex="0" data-field="${encodeURIComponent(field)}">
                <h3>${escapeHtml(field)}</h3>
                <div class="specialty-meta"><span>${count} ${count === 1 ? 'Fall' : 'Fälle'}</span><span>${done}/${count} gelöst</span></div>
                <div class="specialty-progress-track"><div class="specialty-progress-fill" style="width:${pct}%"></div></div>
                <div class="specialty-meta"><span>${pct}%</span></div>
            </div>`;
    }).join('');

    hub.querySelectorAll('.specialty-card').forEach(card => {
        const field = decodeURIComponent(card.dataset.field);
        card.addEventListener('click', () => window.startSpecialty(field));
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.startSpecialty(field); }
        });
    });
};

function buildQueue(field) {
    const done = new Set(SpecialtyStore.get(field).completedCaseIds);
    const ids = getSpecialtyCases(field).map(c => c.case_id);
    // Offene Fälle zuerst, jeweils per Fisher-Yates gemischt
    return [...shuffleFisherYates(ids.filter(id => !done.has(id))), ...shuffleFisherYates(ids.filter(id => done.has(id)))];
}

window.startSpecialty = function(field) {
    const cases = getSpecialtyCases(field);
    if (!cases.length) return;

    // Alle gelöst: Fortschritt zurücksetzen (XP/Score bleiben), damit wieder offene Fälle bereitstehen
    const ids = new Set(cases.map(c => c.case_id));
    if (SpecialtyStore.get(field).completedCaseIds.filter(id => ids.has(id)).length >= cases.length) {
        SpecialtyStore.resetCompleted(field);
    }
    specialtySession.field = field;
    specialtySession.queue = buildQueue(field);
    window.nextSpecialtyCase();
};

window.nextSpecialtyCase = function() {
    closeRevealModal();
    const nextId = specialtySession.queue.shift();
    if (!nextId) {
        showSpecialtyFinished();
        return;
    }
    specialtySession.currentId = nextId;
    window.loadCaseById(nextId, { specialty: true });
};

window.applyBlindHeader = function(blind, caseData) {
    const badge = document.getElementById('player-case-badge-title');
    const wrap = badge?.parentElement;
    const field = caseData?.metadata?.medical_field || specialtySession.field || 'Fachrichtung';

    specialtySession.recorded = false;
    const actions = document.getElementById('specialty-actions');
    if (actions) actions.style.display = 'none';
    const overviewTab = document.getElementById('tab-btn-overview');
    if (overviewTab) overviewTab.style.display = blind ? 'none' : '';

    if (wrap) {
        wrap.classList.toggle('blind-mode-header', blind);
        if (wrap.firstChild && wrap.firstChild.nodeType === Node.TEXT_NODE) {
            wrap.firstChild.nodeValue = blind ? '' : 'Aktiver Fall: ';
        }
    }
    if (badge && caseData) {
        badge.innerText = blind ? `${field} • Klinische Fall-Challenge` : (caseData.metadata?.title || caseData.case_id);
    }
};

function recordSpecialtyCompletion() {
    if (specialtySession.recorded || !activeCaseData) return;
    specialtySession.recorded = true;
    const field = (activeCaseData.metadata?.medical_field || specialtySession.field || '').trim();
    if (!field) return;

    const reward = activeCaseData.metadata?.xp_reward || 900;
    const entry = SpecialtyStore.get(field);
    if (!entry.completedCaseIds.includes(activeCaseData.case_id)) entry.completedCaseIds.push(activeCaseData.case_id);
    entry.totalScore += reward;
    entry.lastPlayed = new Date().toISOString();
    SpecialtyStore.save(field, entry);
    applyXpDelta(reward, 'Fachrichtungs-Fall abgeschlossen');
}

window.onSpecialtyCompletionChange = function(allCompleted) {
    const actions = document.getElementById('specialty-actions');
    if (!actions) return;
    const show = !!(window.isSpecialtyBlindMode && allCompleted);
    actions.style.display = show ? 'flex' : 'none';
    if (show) recordSpecialtyCompletion();
};

function openRevealModal(html) {
    const modal = document.getElementById('reveal-modal');
    const card = document.getElementById('reveal-card');
    if (!modal || !card) return;
    card.innerHTML = html;
    modal.style.display = 'flex';
}

function closeRevealModal() {
    const modal = document.getElementById('reveal-modal');
    if (modal) modal.style.display = 'none';
}
window.closeRevealModal = closeRevealModal;

window.revealDiagnosis = function() {
    if (!activeCaseData) return;
    const meta = activeCaseData.metadata || {};
    const doc = activeCaseData.extra_tasks?.doctordle;
    const pearl = (Array.isArray(doc) ? doc[0] : doc)?.learning_pearl;
    const summary = activeCaseData.case_overview?.summary;

    openRevealModal(`
        <h3>${escapeHtml(meta.title || activeCaseData.case_id)}</h3>
        ${meta.primary_disease ? `<div class="reveal-label">Zielerkrankung</div><div>${escapeHtml(meta.primary_disease)}</div>` : ''}
        ${summary ? `<div class="reveal-label">Zusammenfassung</div><div>${escapeHtml(summary)}</div>` : ''}
        ${pearl ? `<div class="reveal-pearl">💡 ${escapeHtml(pearl)}</div>` : ''}
        <button type="button" class="action-btn" onclick="closeRevealModal()">Schließen</button>`);
};

function showSpecialtyFinished() {
    const field = specialtySession.field || '';
    openRevealModal(`
        <h3>🎉 Gratulation!</h3>
        <div>Du hast alle Krankheitsbilder der Fachrichtung <strong>${escapeHtml(field)}</strong> in dieser Session durchgespielt.</div>
        <button type="button" class="action-btn" id="btn-specialty-restart">Session-Queue zurücksetzen</button>
        <button type="button" class="action-btn" id="btn-specialty-menu" style="background: rgba(255,255,255,0.08);">Zurück zum Fachrichtungs-Menü</button>`);

    document.getElementById('btn-specialty-restart').onclick = () => {
        SpecialtyStore.resetCompleted(field);
        window.startSpecialty(field);
    };
    document.getElementById('btn-specialty-menu').onclick = () => {
        closeRevealModal();
        switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
        window.setLearningMode('specialty');
    };
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-reveal-diagnosis')?.addEventListener('click', window.revealDiagnosis);
    document.getElementById('btn-next-specialty-case')?.addEventListener('click', window.nextSpecialtyCase);
    document.getElementById('reveal-modal')?.addEventListener('click', e => {
        if (e.target.id === 'reveal-modal') closeRevealModal();
    });
    window.setLearningMode('topic');
});
