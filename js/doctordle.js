/**
 * Doctordle – fall-integriertes Deduktions-Rätsel (Tab "Doctordle" im Player).
 * Datenquelle: caseData.extra_tasks.doctordle { title, target_diagnosis, synonyms, hints, learning_pearl }
 * Abhängigkeit: window.DiagnosisRegistry (js/mapping.js, klassisches Skript).
 */
export const DOCTORDLE_XP_SCALE = [600, 500, 400, 300, 200, 100];
export const DOCTORDLE_REVEAL_PENALTY = 200;
const MAX_ATTEMPTS = DOCTORDLE_XP_SCALE.length;
const SCORED_KEY = 'doctordle_scored';

const esc = s => String(s == null ? '' : s).replace(/[&<>'"]/g,
    t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t]));

export class DoctordleChallenge {
    /**
     * @param {object} caseData       aktiver Fall
     * @param {function} onScoreUpdate Callback (xpDelta, label) -> XP-Update inkl. Cloud-Sync
     */
    constructor(caseData, onScoreUpdate) {
        this.caseData = caseData;
        this.doctordleData = caseData && caseData.extra_tasks && caseData.extra_tasks.doctordle;
        this.onScoreUpdate = typeof onScoreUpdate === 'function' ? onScoreUpdate : () => {};
        this.currentAttempt = 0;
        this.isFinished = false;
        this.matches = [];
        this.activeIndex = -1;
        this.abort = new AbortController();

        if (!this.doctordleData || !Array.isArray(this.doctordleData.hints)) return;
        this.cacheDom();
        if (!this.el.input) return;
        this.render();
        this.bind();
    }

    cacheDom() {
        const $ = id => document.getElementById(id);
        this.el = {
            title: $('doctordle-title'), subtitle: $('doctordle-subtitle'), xp: $('doctordle-xp-badge'),
            hints: $('doctordle-hints'), input: $('doctordle-input'), list: $('doctordle-autocomplete-list'),
            submit: $('doctordle-submit-btn'), reveal: $('doctordle-reveal-btn'), result: $('doctordle-result-box'),
            wrap: $('doctordle-autocomplete-wrap')
        };
    }

    render() {
        const d = this.doctordleData;
        this.el.title.textContent = d.title || 'Klinische Deduktion';
        this.el.subtitle.textContent = 'Jeder Fehlversuch deckt einen weiteren Hinweis auf – und senkt die möglichen XP.';
        this.el.input.value = '';
        this.el.input.disabled = false;
        this.el.submit.disabled = false;
        this.el.reveal.disabled = false;
        this.el.result.className = 'feedback-box';
        this.el.result.style.display = 'none';
        this.el.result.innerHTML = '';
        this.closeList();
        this.el.hints.innerHTML = '';
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const box = document.createElement('div');
            box.className = 'doctordle-hint empty';
            box.id = `doctordle-hint-${i}`;
            this.el.hints.appendChild(box);
        }
        this.revealHints(1);
        this.updateXpBadge();
    }

    /** Deckt Hinweise bis einschließlich Anzahl `count` auf. */
    revealHints(count, animateFrom = 0) {
        const hints = this.doctordleData.hints;
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const box = this.el.hints.children[i];
            if (!box || i >= count || !hints[i] || !box.classList.contains('empty')) continue;
            box.classList.remove('empty');
            box.innerHTML = `<span class="doctordle-hint-num">${i + 1}</span><span>${esc(hints[i])}</span>`;
            if (i >= animateFrom) this.pulseHint(box);
        }
    }

    pulseHint(box) {
        box.classList.remove('pulse');
        void box.offsetWidth; // Animation neu starten
        box.classList.add('pulse');
    }

    updateXpBadge() {
        const xp = this.isFinished ? 0 : DOCTORDLE_XP_SCALE[Math.min(this.currentAttempt, MAX_ATTEMPTS - 1)];
        this.el.xp.textContent = this.isFinished ? 'Beendet' : `Mögliche XP: +${xp}`;
    }

    isScored() {
        try { return (JSON.parse(localStorage.getItem(SCORED_KEY)) || []).includes(this.caseData.case_id); } catch (e) { return false; }
    }

    markScored() {
        let list = [];
        try { list = JSON.parse(localStorage.getItem(SCORED_KEY)) || []; } catch (e) { /* ignore */ }
        if (!list.includes(this.caseData.case_id)) list.push(this.caseData.case_id);
        localStorage.setItem(SCORED_KEY, JSON.stringify(list));
    }

    /** XP nur einmal pro Fall vergeben (Schutz vor Farming durch Neuladen). */
    award(xp, label) {
        if (xp === 0 || this.isScored()) return false;
        this.markScored();
        this.onScoreUpdate(xp, label);
        return true;
    }

    finish(type, html) {
        this.isFinished = true;
        this.el.input.disabled = true;
        this.el.submit.disabled = true;
        this.el.reveal.disabled = true;
        this.closeList();
        this.updateXpBadge();
        this.el.result.className = `feedback-box feedback-${type}`;
        this.el.result.style.display = 'block';
        this.el.result.innerHTML = html;
    }

    pearlHtml() {
        const p = this.doctordleData.learning_pearl;
        return p ? `<div class="doctordle-pearl">💎 ${esc(p)}</div>` : '';
    }

    submit() {
        if (this.isFinished) return;
        const guess = this.el.input.value.trim();
        if (!guess) return;
        const d = this.doctordleData;
        this.closeList();

        if (window.DiagnosisRegistry.isMatch(guess, d.target_diagnosis, d.synonyms)) {
            const xp = DOCTORDLE_XP_SCALE[this.currentAttempt];
            this.revealHints(MAX_ATTEMPTS, this.currentAttempt + 1);
            Array.from(this.el.hints.children).forEach(b => b.classList.add('correct'));
            const gained = this.award(xp, 'Doctordle');
            this.finish('success', `<strong>Richtig!</strong> ${esc(d.target_diagnosis)} – ` +
                (gained ? `+${xp} XP` : 'XP für dieses Rätsel wurden bereits vergeben') + this.pearlHtml());
            return;
        }

        this.currentAttempt++;
        this.el.input.value = '';
        this.shake();
        if (this.currentAttempt >= MAX_ATTEMPTS) {
            this.revealHints(MAX_ATTEMPTS, 0);
            this.finish('error', `<strong>Alle Versuche verbraucht (0 XP).</strong> Gesuchte Diagnose: <strong>${esc(d.target_diagnosis)}</strong>` + this.pearlHtml());
            return;
        }
        this.revealHints(this.currentAttempt + 1, this.currentAttempt);
        this.updateXpBadge();
        this.el.result.className = 'feedback-box feedback-error';
        this.el.result.style.display = 'block';
        this.el.result.innerHTML = `<strong>Leider nicht.</strong> Ein weiterer Hinweis wurde aufgedeckt.`;
        this.el.input.focus();
    }

    shake() {
        this.el.input.classList.remove('shake');
        void this.el.input.offsetWidth;
        this.el.input.classList.add('shake');
    }

    revealSolution() {
        if (this.isFinished) return;
        if (!window.confirm(`Lösung wirklich aufdecken? Das kostet ${DOCTORDLE_REVEAL_PENALTY} XP.`)) return;
        const d = this.doctordleData;
        this.revealHints(MAX_ATTEMPTS, 0);
        this.award(-DOCTORDLE_REVEAL_PENALTY, 'Doctordle Aufgabe');
        this.finish('error', `<strong>Lösung:</strong> ${esc(d.target_diagnosis)} (−${DOCTORDLE_REVEAL_PENALTY} XP)` + this.pearlHtml());
    }

    /* ---------- Autocomplete ---------- */
    updateSuggestions() {
        this.matches = window.DiagnosisRegistry.getAutocompleteSuggestions(this.el.input.value, 8);
        this.activeIndex = -1;
        if (!this.matches.length) return this.closeList();
        this.el.list.innerHTML = this.matches.map((t, i) =>
            `<li role="option" id="doctordle-opt-${i}" data-index="${i}" aria-selected="false">${esc(t)}</li>`).join('');
        this.el.list.classList.remove('hidden');
        this.el.input.setAttribute('aria-expanded', 'true');
    }

    closeList() {
        this.matches = [];
        this.activeIndex = -1;
        this.el.list.classList.add('hidden');
        this.el.list.innerHTML = '';
        this.el.input.setAttribute('aria-expanded', 'false');
        this.el.input.removeAttribute('aria-activedescendant');
    }

    setActive(i) {
        const items = this.el.list.querySelectorAll('li');
        items.forEach(li => { li.classList.remove('active'); li.setAttribute('aria-selected', 'false'); });
        this.activeIndex = i;
        const li = items[i];
        if (!li) return;
        li.classList.add('active');
        li.setAttribute('aria-selected', 'true');
        li.scrollIntoView({ block: 'nearest' });
        this.el.input.setAttribute('aria-activedescendant', li.id);
    }

    choose(i) {
        if (this.matches[i] === undefined) return;
        this.el.input.value = this.matches[i];
        this.closeList();
        this.el.input.focus();
    }

    bind() {
        const { signal } = this.abort;
        const { input, list, submit, reveal, wrap } = this.el;
        input.addEventListener('input', () => this.updateSuggestions(), { signal });
        input.addEventListener('keydown', e => {
            const open = !list.classList.contains('hidden') && this.matches.length > 0;
            if (e.key === 'ArrowDown' && open) { e.preventDefault(); this.setActive((this.activeIndex + 1) % this.matches.length); }
            else if (e.key === 'ArrowUp' && open) { e.preventDefault(); this.setActive((this.activeIndex - 1 + this.matches.length) % this.matches.length); }
            else if (e.key === 'Escape') this.closeList();
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (open && this.activeIndex >= 0) this.choose(this.activeIndex); else this.submit();
            }
        }, { signal });
        list.addEventListener('mousedown', e => {
            const li = e.target.closest('li');
            if (li) { e.preventDefault(); this.choose(parseInt(li.dataset.index, 10)); }
        }, { signal });
        document.addEventListener('click', e => { if (!wrap.contains(e.target)) this.closeList(); }, { signal });
        submit.addEventListener('click', () => this.submit(), { signal });
        reveal.addEventListener('click', () => this.revealSolution(), { signal });
    }

    /** Entfernt Event-Listener (beim Laden eines anderen Falls). */
    destroy() { this.abort.abort(); }
}

window.DoctordleChallenge = DoctordleChallenge;
