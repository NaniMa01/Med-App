/**
 * Doctordle – Diagnose-Ratespiel mit 6 progressiven Hinweisen.
 * Abhängigkeiten: DiagnosisDictionary (mapping.js), applyXpDelta/escapeHtml/BUILTIN_DEMO_CASE (app.js).
 */
const DOCTORDLE_MAX_ATTEMPTS = 6;
const DOCTORDLE_WIN_XP = [600, 500, 400, 300, 200, 100];
const DOCTORDLE_PENALTY_XP = 200;
const DOCTORDLE_CASE_FILES = [
    'neuro_cjk_001', 'neuro_demenz_001', 'neuro_ftd_002_adv', 'neuro_ftd_ppa_002',
    'neuro_lbd_audit_001', 'haemato_lymph_001', 'haemato_lymph_002'
];

class DoctordleGame {
    constructor() {
        this.cases = [];
        this.current = null;
        this.attempts = 0;
        this.state = 'idle'; // idle | playing | won | lost
        this.activeIndex = -1;
        this.matches = [];
        this.els = {};
    }

    async init() {
        this.els = {
            select: document.getElementById('doctordle-case-select'),
            cards: document.getElementById('doctordle-cards'),
            input: document.getElementById('doctordle-input'),
            list: document.getElementById('doctordle-suggestions'),
            submit: document.getElementById('doctordle-submit'),
            reveal: document.getElementById('doctordle-reveal'),
            fb: document.getElementById('doctordle-fb'),
            combo: document.getElementById('doctordle-combobox')
        };
        if (!this.els.cards || this.initialized) return;
        this.initialized = true;
        this.bindEvents();
        await this.loadCases();
    }

    async loadCases() {
        const found = [];
        const seen = new Set();
        const push = c => {
            if (c && c.doctordle && c.doctordle.hints && c.case_id && !seen.has(c.case_id)) {
                seen.add(c.case_id); found.push(c);
            }
        };
        try { push(typeof BUILTIN_DEMO_CASE !== 'undefined' ? BUILTIN_DEMO_CASE : null); } catch (e) { /* ignore */ }
        try { (JSON.parse(localStorage.getItem('custom_cases')) || []).forEach(push); } catch (e) { /* ignore */ }
        await Promise.all(DOCTORDLE_CASE_FILES.map(async name => {
            try {
                const res = await fetch(`cases/${name}.json`);
                if (res.ok) push(await res.json());
            } catch (e) { /* Datei nicht verfügbar */ }
        }));
        this.cases = found;
        DiagnosisDictionary.build(found);
        this.els.select.innerHTML = found.length
            ? found.map((c, i) => `<option value="${i}">Rätsel ${i + 1}</option>`).join('')
            : '<option value="">Keine Doctordle-Fälle verfügbar</option>';
        if (found.length) this.start(0);
        else this.els.fb.textContent = 'Keine Fälle mit Doctordle-Daten gefunden.';
    }

    start(index) {
        const c = this.cases[index];
        if (!c) return;
        this.current = c;
        this.attempts = 0;
        this.state = 'playing';
        this.els.input.value = '';
        this.closeList();
        this.setControlsDisabled(false);
        this.els.fb.className = 'feedback-box';
        this.els.fb.style.display = 'none';
        this.renderCards();
    }

    /** Zeigt Hinweise 1..(attempts+1); der Rest bleibt Placeholder. */
    renderCards() {
        const hints = this.current.doctordle.hints.slice(0, DOCTORDLE_MAX_ATTEMPTS);
        const visible = this.state === 'playing' ? this.attempts + 1 : DOCTORDLE_MAX_ATTEMPTS;
        let html = '';
        for (let i = 0; i < DOCTORDLE_MAX_ATTEMPTS; i++) {
            const shown = i < visible && hints[i];
            const cls = ['doctordle-card', shown ? 'revealed' : 'placeholder'];
            if (this.state === 'won') cls.push('win');
            html += `<div class="${cls.join(' ')}"><span class="doctordle-card-num">${i + 1}</span>` +
                `<span class="doctordle-card-text">${shown ? escapeHtml(hints[i]) : ''}</span></div>`;
        }
        this.els.cards.innerHTML = html;
    }

    setControlsDisabled(disabled) {
        this.els.input.disabled = disabled;
        this.els.submit.disabled = disabled;
        this.els.reveal.disabled = disabled;
    }

    showFeedback(type, html) {
        this.els.fb.className = `feedback-box feedback-${type}`;
        this.els.fb.style.display = 'block';
        this.els.fb.innerHTML = html;
    }

    /** Bereits gewertete Rätsel geben keine XP mehr (Schutz vor Farming). */
    isScored(caseId) {
        try { return (JSON.parse(localStorage.getItem('doctordle_done')) || []).includes(caseId); } catch (e) { return false; }
    }
    markScored(caseId) {
        let done = [];
        try { done = JSON.parse(localStorage.getItem('doctordle_done')) || []; } catch (e) { /* ignore */ }
        if (!done.includes(caseId)) done.push(caseId);
        localStorage.setItem('doctordle_done', JSON.stringify(done));
    }

    applyXp(delta, label) {
        const id = this.current.case_id;
        if (this.isScored(id)) return;
        this.markScored(id);
        if (typeof applyXpDelta === 'function') applyXpDelta(delta, label);
    }

    submit() {
        if (this.state !== 'playing') return;
        const guess = this.els.input.value.trim();
        if (!guess) return;
        this.closeList();
        const target = this.current.doctordle.canonical_diagnosis;
        const resolved = DiagnosisDictionary.resolveDiagnosis(guess);
        this.attempts++;

        if (resolved && resolved.canonical === target) {
            const xp = DOCTORDLE_WIN_XP[this.attempts - 1];
            this.state = 'won';
            this.setControlsDisabled(true);
            this.renderCards();
            this.showFeedback('success', `<strong>Richtig!</strong> ${escapeHtml(target)} – Versuch ${this.attempts}/${DOCTORDLE_MAX_ATTEMPTS}, +${xp} XP.`);
            this.applyXp(xp, 'Doctordle');
        } else if (this.attempts >= DOCTORDLE_MAX_ATTEMPTS) {
            this.lose('Alle Versuche verbraucht.');
        } else {
            this.els.input.value = '';
            this.renderCards();
            this.showFeedback('error', `<strong>Leider falsch.</strong> Neuer Hinweis freigeschaltet (${this.attempts}/${DOCTORDLE_MAX_ATTEMPTS}).`);
            this.els.input.focus();
        }
    }

    reveal() {
        if (this.state !== 'playing') return;
        if (!window.confirm(`Lösung wirklich aufdecken? Das kostet ${DOCTORDLE_PENALTY_XP} XP.`)) return;
        this.lose('Lösung aufgedeckt.');
    }

    lose(reason) {
        this.state = 'lost';
        this.setControlsDisabled(true);
        this.els.input.value = '';
        this.renderCards();
        this.showFeedback('error', `<strong>${escapeHtml(reason)}</strong> Gesuchte Diagnose: <strong>${escapeHtml(this.current.doctordle.canonical_diagnosis)}</strong> (−${DOCTORDLE_PENALTY_XP} XP).`);
        this.applyXp(-DOCTORDLE_PENALTY_XP, 'Doctordle Aufgabe');
    }

    /* ---------- Autocomplete ---------- */
    updateSuggestions() {
        const q = this.els.input.value.trim().toLowerCase();
        if (q.length < 2) return this.closeList();
        this.matches = DiagnosisDictionary.getInputTerms().filter(t => t.toLowerCase().includes(q)).slice(0, 8);
        this.activeIndex = -1;
        if (!this.matches.length) return this.closeList();
        this.els.list.innerHTML = this.matches.map((t, i) =>
            `<li role="option" id="doctordle-opt-${i}" data-index="${i}" aria-selected="false">${escapeHtml(t)}</li>`).join('');
        this.els.list.hidden = false;
        this.els.input.setAttribute('aria-expanded', 'true');
    }

    closeList() {
        this.matches = [];
        this.activeIndex = -1;
        if (this.els.list) { this.els.list.hidden = true; this.els.list.innerHTML = ''; }
        if (this.els.input) {
            this.els.input.setAttribute('aria-expanded', 'false');
            this.els.input.removeAttribute('aria-activedescendant');
        }
    }

    setActive(i) {
        const items = this.els.list.querySelectorAll('li');
        items.forEach(li => { li.classList.remove('active'); li.setAttribute('aria-selected', 'false'); });
        this.activeIndex = i;
        if (i >= 0 && items[i]) {
            items[i].classList.add('active');
            items[i].setAttribute('aria-selected', 'true');
            items[i].scrollIntoView({ block: 'nearest' });
            this.els.input.setAttribute('aria-activedescendant', items[i].id);
        }
    }

    choose(i) {
        if (this.matches[i] === undefined) return;
        this.els.input.value = this.matches[i];
        this.closeList();
        this.els.input.focus();
    }

    bindEvents() {
        const { input, list, submit, reveal, select, combo } = this.els;
        input.addEventListener('input', () => this.updateSuggestions());
        input.addEventListener('keydown', e => {
            const open = !list.hidden && this.matches.length;
            if (e.key === 'ArrowDown' && open) { e.preventDefault(); this.setActive((this.activeIndex + 1) % this.matches.length); }
            else if (e.key === 'ArrowUp' && open) { e.preventDefault(); this.setActive((this.activeIndex - 1 + this.matches.length) % this.matches.length); }
            else if (e.key === 'Escape') { this.closeList(); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (open && this.activeIndex >= 0) this.choose(this.activeIndex);
                else this.submit();
            }
        });
        list.addEventListener('mousedown', e => {
            const li = e.target.closest('li');
            if (li) { e.preventDefault(); this.choose(parseInt(li.dataset.index, 10)); }
        });
        document.addEventListener('click', e => { if (!combo.contains(e.target)) this.closeList(); });
        submit.addEventListener('click', () => this.submit());
        reveal.addEventListener('click', () => this.reveal());
        select.addEventListener('change', () => this.start(parseInt(select.value, 10)));
    }
}

window.doctordleGame = new DoctordleGame();
