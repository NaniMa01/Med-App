/**
 * js/specialty.js - Lernen nach Fachrichtung (Blind-Modus, Session-Queue, Reveal, separater Fortschritt)
 */
const SPECIALTY_STORAGE_KEY = 'medcheck_specialty_progress';
const specialtySession = { field: null, queue: [], currentId: null, recorded: false };

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
