/* ==========================================================================
   js/synapses.js – MEDCHECK "SYNAPSEN" (OpenEvidence / Medical Connections Style)
   Optimiert für Smartphone Touch-Bedienung (4x4 Grid, Auto-Scaling, Smart Fallback)
   ========================================================================== */

const SynapsesChallenge = (function () {
  // Schwierigkeits-Farben nach OpenEvidence / Connections Standard
  const LEVEL_COLORS = [
    { bg: '#fef08a', border: '#eab308', text: '#713f12', label: 'Stufe 1 · Basis-Assoziation' },
    { bg: '#bbf7d0', border: '#22c55e', text: '#14532d', label: 'Stufe 2 · Klinisches Bild' },
    { bg: '#bae6fd', border: '#0ea5e9', text: '#0c4a6e', label: 'Stufe 3 · Diagnostik & Labor' },
    { bg: '#e9d5ff', border: '#a855f7', text: '#581c87', label: 'Stufe 4 · Differentialdiagnose' }
  ];

  let state = {
    container: null,
    groups: [],         // 4 Gruppen à 4 Items: { title, items: [], explanation, level }
    remainingItems: [], // Noch nicht gelöste Items im Grid
    selectedItems: [],  // Aktuell angetippte Items (max. 4)
    solvedGroups: [],   // Bereits gelöste Gruppen
    mistakesLeft: 4,
    isGameOver: false
  };

  /**
   * 1. Fallback-Generator: Falls die geladene JSON-Falldatei noch keine
   *    explizite "synapses"-Struktur besitzt, bauen wir ein klinisch
   *    hochwertiges Board passend zu deinen Neuro-/Hämato-Fällen.
   */
  function extractOrGenerateGroups(caseData) {
    // A. Prüfen, ob im Fall bereits gültige Synapsen-Daten vorliegen
    const raw = caseData?.synapses || caseData?.challenges?.synapses || caseData?.synapsen;
    if (Array.isArray(raw) && raw.length === 4 && raw[0].items?.length === 4) {
      return raw.map((g, idx) => ({
        title: g.title || g.category || g.name || `Kategorie ${idx + 1}`,
        items: g.items || g.words || g.terms,
        explanation: g.explanation || g. rationale || '',
        level: g.level !== undefined ? g.level : idx
      }));
    }

    // B. Prüfen, ob der Fall ein Hämatologie- oder Neurologie-Fall ist
    const caseStr = JSON.stringify(caseData || {}).toLowerCase();
    const isHaemato = caseStr.includes('lymph') || caseStr.includes('haemato') || caseStr.includes('b-symptomatik') || caseStr.includes('ann-arbor');

    if (isHaemato) {
      return [
        {
          title: 'Klassische B-Symptomatik',
          items: ['Nachtschweiß', 'Fieber > 38°C', 'Gewichtsverlust', 'Leistungsknick'],
          explanation: 'Systemische Entzündungszeichen bei malignen Lymphomen (>10% Gewichtsverlust in 6 Monaten).',
          level: 0
        },
        {
          title: 'Diagnostik beim Lymphom',
          items: ['Exzisionsbiopsie', 'PET-CT Staging', 'Knochenmarkpunktion', 'Immunhistochemie'],
          explanation: 'Eine Feinnadelpunktion reicht zur Lymphom-Klassifikation nicht aus – Goldstandard ist die Lymphknoten-Exzision.',
          level: 1
        },
        {
          title: 'Laborparameter für Zellumsatz / Tumorlast',
          items: ['LDH erhöht', 'Harnsäure ↑', 'Beta-2-Mikroglobulin', 'BSG-Sturzsenkung'],
          explanation: 'Wichtige prognostische Marker und Indikatoren für ein mögliches Tumorlyse-Syndrom.',
          level: 2
        },
        {
          title: 'Differentialdiagnosen der Lymphadenopathie',
          items: ['EBV-Mononukleose', 'Sarkoidose', 'Toxoplasmose', 'Hodgkin-Lymphom'],
          explanation: 'Infektiöse, granulomatöse und neoplastische Ursachen geschwollener Lymphknoten.',
          level: 3
        }
      ];
    }

    // Default: Neurodegenerative & Prionen-Diagnostik (passend zu CJK, FTD, LBD, Demenz)
    return [
      {
        title: 'Kardinalsymptome Lewy-Body-Demenz (LBD)',
        items: ['Optische Halluzinationen', 'Kognitive Fluktuation', 'REM-Schlaf-Störung', 'Parkinsonismus'],
        explanation: 'Zusätzlich besteht eine extreme Neuroleptika-Überempfindlichkeit!',
        level: 0
      },
      {
        title: 'Befunde bei Creutzfeldt-Jakob (CJK)',
        items: ['14-3-3 Protein', 'RT-QuIC positiv', 'Myoklonien', 'Cortical Ribboning'],
        explanation: 'Rasch progrediente Demenz mit typischem DWI-MRT (Basalganglien/Kortex) und Liquormarkern.',
        level: 1
      },
      {
        title: 'Varianten der Frontotemporalen Demenz (FTD)',
        items: ['Enthemmung / Apathie', 'Semantische Aphasie', 'Unflüssige Agrammatik', 'Frühe Persönlichkeitsänderung'],
        explanation: 'Umfasst bvFTD (Verhaltensvariante) sowie die primär progredienten Aphasien (svPPA, nfvPPA).',
        level: 2
      },
      {
        title: 'Reversible Demenz-Ursachen („Pseudodemenz")',
        items: ['Vitamin-B12-Mangel', 'Hypothyreose', 'Normaldruckhydrozephalus', 'Schwere Depression'],
        explanation: 'Müssen bei jeder Erstdiagnostik eines demenziellen Syndroms zwingend ausgeschlossen werden.',
        level: 3
      }
    ];
  }

  // Fisher-Yates Shuffle für die 16 Kacheln
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Haupt-Initialisierung
  function init(caseData, targetElement) {
    // Container automatisch finden oder erstellen
    let container = targetElement ||
      document.getElementById('synapses-container') ||
      document.getElementById('synapses-view') ||
      document.getElementById('synapses') ||
      document.querySelector('[data-challenge="synapses"]') ||
      document.querySelector('.synapses-container');

    if (!container) {
      const parent = document.getElementById('case-content') ||
                     document.getElementById('challenge-container') ||
                     document.querySelector('main') ||
                     document.body;
      container = document.createElement('section');
      container.id = 'synapses-container';
      container.className = 'challenge-section synapses-module';
      parent.appendChild(container);
    }

    state.container = container;
    state.groups = extractOrGenerateGroups(caseData);
    state.solvedGroups = [];
    state.selectedItems = [];
    state.mistakesLeft = 4;
    state.isGameOver = false;

    // Alle 16 Items flach klopfen und mischen
    const allItems = [];
    state.groups.forEach((group, gIdx) => {
      group.items.forEach((term) => {
        allItems.push({
          id: `${gIdx}-${term}`,
          term: term,
          groupIndex: gIdx
        });
      });
    });

    state.remainingItems = shuffle(allItems);
    render();
  }

  // Kachel antippen
  function toggleTile(itemId) {
    if (state.isGameOver) return;
    const idx = state.selectedItems.indexOf(itemId);

    if (idx > -1) {
      state.selectedItems.splice(idx, 1);
    } else {
      if (state.selectedItems.length >= 4) return; // Maximal 4 gleichzeitig
      state.selectedItems.push(itemId);
    }

    // Leichtes Haptik-Feedback auf dem Smartphone
    if (navigator.vibrate) navigator.vibrate(15);
    render();
  }

  // Auswahl von 4 Kacheln überprüfen
  function submitSelection() {
    if (state.selectedItems.length !== 4 || state.isGameOver) return;

    const selectedObjs = state.remainingItems.filter(item =>
      state.selectedItems.includes(item.id)
    );

    // Zählen, wie viele Items zu welcher Gruppe gehören
    const counts = {};
    selectedObjs.forEach(obj => {
      counts[obj.groupIndex] = (counts[obj.groupIndex] || 0) + 1;
    });

    const maxMatch = Math.max(...Object.values(counts));

    if (maxMatch === 4) {
      // TREFFER! Gruppe gelöst
      const solvedIdx = selectedObjs[0].groupIndex;
      const solvedGroup = state.groups[solvedIdx];

      state.solvedGroups.push(solvedGroup);
      state.remainingItems = state.remainingItems.filter(
        item => item.groupIndex !== solvedIdx
      );
      state.selectedItems = [];

      if (navigator.vibrate) navigator.vibrate([30, 50, 40]);

      if (state.solvedGroups.length === 4) {
        state.isGameOver = true;
        render('🎉 Perfekt! Alle 4 klinischen Synapsen gelöst!');
      } else {
        render('✅ Stark! Klinische Verbindung erkannt.');
      }
    } else {
      // FEHLVERSUCH
      state.mistakesLeft -= 1;
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);

      let feedbackMsg = '❌ Keine gemeinsame klinische Gruppe.';
      if (maxMatch === 3) {
        feedbackMsg = '🤏 Fast! 3 von 4 Begriffen gehören zusammen („Nur 1 entfernt")!';
      }

      if (state.mistakesLeft <= 0) {
        state.isGameOver = true;
        // Bei Spielende alle verbleibenden Gruppen auflösen
        state.groups.forEach((g, idx) => {
          if (!state.solvedGroups.includes(g)) {
            state.solvedGroups.push(g);
          }
        });
        state.remainingItems = [];
        state.selectedItems = [];
        render('💡 Keine Versuche mehr – hier ist die klinische Auflösung:');
      } else {
        render(feedbackMsg, true);
      }
    }
  }

  function shuffleRemaining() {
    state.remainingItems = shuffle(state.remainingItems);
    render('🔀 Begriffe neu gemischt.');
  }

  function deselectAll() {
    state.selectedItems = [];
    render();
  }

  // UI im OpenEvidence Synapses Smartphone-Design rendern
  function render(toastMessage = '', shakeGrid = false) {
    if (!state.container) return;

    const dotsHtml = Array.from({ length: 4 }, (_, i) => {
      const active = i < state.mistakesLeft;
      return `<span class="syn-mistake-dot ${active ? 'active' : 'used'}"></span>`;
    }).join('');

    const solvedHtml = state.solvedGroups.map(group => {
      const color = LEVEL_COLORS[group.level % 4];
      return `
        <div class="syn-solved-banner" style="background:${color.bg}; border-color:${color.border}; color:${color.text};">
          <div class="syn-solved-level">${color.label}</div>
          <div class="syn-solved-title">${group.title}</div>
          <div class="syn-solved-items">${group.items.join(' • ')}</div>
          ${group.explanation ? `<div class="syn-solved-exp">${group.explanation}</div>` : ''}
        </div>
      `;
    }).join('');

    const tilesHtml = state.remainingItems.map(item => {
      const isSelected = state.selectedItems.includes(item.id);
      // Lange medizinische Wörter bekommen automatisch eine kleinere Schriftklasse
      const len = item.term.length;
      const sizeClass = len > 18 ? 'syn-text-xs' : len > 12 ? 'syn-text-sm' : 'syn-text-md';

      return `
        <button type="button" 
                class="syn-tile ${isSelected ? 'selected' : ''} ${sizeClass}" 
                data-id="${item.id}">
          <span>${item.term}</span>
        </button>
      `;
    }).join('');

    state.container.innerHTML = `
      <div class="syn-wrapper">
        <div class="syn-header">
          <div>
            <span class="syn-badge">OpenEvidence Style</span>
            <h3 class="syn-title">🧠 Klinische Synapsen</h3>
          </div>
          <p class="syn-subtitle">Finde 4 Gruppen aus jeweils 4 klinisch zusammengehörigen Begriffen.</p>
        </div>

        ${toastMessage ? `<div class="syn-toast">${toastMessage}</div>` : ''}

        <!-- Gelöste Gruppen klappen hier oben zusammen -->
        <div class="syn-solved-list">
          ${solvedHtml}
        </div>

        <!-- Das 4x4 Smartphone-Touch-Grid -->
        ${state.remainingItems.length > 0 ? `
          <div class="syn-grid ${shakeGrid ? 'syn-shake' : ''}">
            ${tilesHtml}
          </div>
        ` : ''}

        <!-- Fehlversuche-Anzeige -->
        <div class="syn-status-bar">
          <span class="syn-mistakes-label">Verbleibende Fehlversuche:</span>
          <div class="syn-mistake-dots">${dotsHtml}</div>
        </div>

        <!-- Smartphone Daumen-Steuerung -->
        <div class="syn-controls">
          ${!state.isGameOver ? `
            <button type="button" class="syn-btn syn-btn-outline" id="syn-btn-shuffle">🔀 Mischen</button>
            <button type="button" class="syn-btn syn-btn-outline" id="syn-btn-deselect" ${state.selectedItems.length === 0 ? 'disabled' : ''}>Auswahl löschen</button>
            <button type="button" class="syn-btn syn-btn-primary" id="syn-btn-submit" ${state.selectedItems.length !== 4 ? 'disabled' : ''}>Prüfen (${state.selectedItems.length}/4)</button>
          ` : `
            <button type="button" class="syn-btn syn-btn-primary" id="syn-btn-restart" style="width:100%;">🔄 Synapsen neu starten</button>
          `}
        </div>
      </div>
    `;

    // Event-Listener sauber binden
    state.container.querySelectorAll('.syn-tile').forEach(btn => {
      btn.addEventListener('click', () => toggleTile(btn.getAttribute('data-id')));
    });

    const btnShuffle = state.container.querySelector('#syn-btn-shuffle');
    const btnDeselect = state.container.querySelector('#syn-btn-deselect');
    const btnSubmit = state.container.querySelector('#syn-btn-submit');
    const btnRestart = state.container.querySelector('#syn-btn-restart');

    if (btnShuffle) btnShuffle.addEventListener('click', shuffleRemaining);
    if (btnDeselect) btnDeselect.addEventListener('click', deselectAll);
    if (btnSubmit) btnSubmit.addEventListener('click', submitSelection);
    if (btnRestart) btnRestart.addEventListener('click', () => init(window.currentCaseData || {}, state.container));
  }

  return { init };
})();

// Sowohl als globale Funktion als auch über das Objekt aufrufbar machen (maximale Kompatibilität mit deiner app.js)
window.SynapsesChallenge = SynapsesChallenge;
window.initSynapses = SynapsesChallenge.init;
window.renderSynapses = SynapsesChallenge.init;
