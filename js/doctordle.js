/**
 * js/doctordle.js - Controller für die Fall-Deduktionsrätsel (Doctordle)
 */

class DoctordleController {
    constructor() {
        this.puzzles = [];
        this.currentCaseId = null;
        this.currentPuzzleIndex = 0;
        this.currentAttempt = 0; // 0 bis 5
        this.maxAttempts = 6;
        this.xpTiers = [600, 500, 400, 300, 200, 100];
        this.revealPenalty = 200;
        this.solvedPuzzles = 0;
        this.isFinishedCurrent = false;

        this.initDOM();
    }

    initDOM() {
        this.container = document.getElementById('doctordle-hints-container');
        this.input = document.getElementById('doctordle-input');
        this.submitBtn = document.getElementById('doctordle-submit-btn');
        this.revealBtn = document.getElementById('doctordle-reveal-btn');
        this.nextBtn = document.getElementById('doctordle-next-btn');
        this.autocompleteList = document.getElementById('doctordle-autocomplete-list');
        this.resultBox = document.getElementById('doctordle-result-box');
        this.headline = document.getElementById('doctordle-headline');
        this.tracker = document.getElementById('doctordle-puzzle-tracker');
        this.xpBadge = document.getElementById('doctordle-potential-xp');

        if (this.submitBtn) {
            this.submitBtn.onclick = () => this.handleGuess();
        }
        if (this.input) {
            this.input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleGuess();
                }
            };
            this.input.oninput = (e) => this.handleAutocomplete(e.target.value);
        }
        if (this.revealBtn) {
            this.revealBtn.onclick = () => this.handleReveal();
        }
        if (this.nextBtn) {
            this.nextBtn.onclick = () => this.goToNextPuzzle();
        }

        document.addEventListener('click', (e) => {
            if (this.input && this.autocompleteList && !this.input.contains(e.target) && !this.autocompleteList.contains(e.target)) {
                this.hideAutocomplete();
            }
        });
    }

    hideAutocomplete() {
        if (this.autocompleteList) {
            this.autocompleteList.classList.add('hidden');
            this.autocompleteList.style.display = 'none';
        }
    }

    showAutocomplete() {
        if (this.autocompleteList) {
            this.autocompleteList.classList.remove('hidden');
            this.autocompleteList.style.display = 'block';
        }
    }

    initCase(caseData, forceReset = false) {
        // Sicherstellen, dass DOM-Elemente gebunden sind
        if (!this.container) this.initDOM();

        if (!caseData || !caseData.extra_tasks || !caseData.extra_tasks.doctordle) {
            if (this.container) {
                this.container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:20px;">Keine Doctordle-Rätsel für diesen Fall hinterlegt.</div>';
            }
            return;
        }

        // Wenn derselbe Fall nur reaktiviert wird (z. B. nach Tab-Wechsel), Zustand beibehalten
        if (this.currentCaseId === caseData.case_id && !forceReset) {
            return;
        }

        this.currentCaseId = caseData.case_id;
        const raw = caseData.extra_tasks.doctordle;
        this.puzzles = Array.isArray(raw) ? raw : [raw];

        // Gespeicherten Zustand aus dem ProgressManager abrufen
        const saved = window.ProgressManager ? window.ProgressManager.getCaseProgress(caseData.case_id)?.doctordle : null;
        this.solvedPuzzles = saved?.solvedCount || 0;
        
        // Starte beim ersten ungelösten Rätsel oder bleibe beim letzten
        this.currentPuzzleIndex = Math.min(this.solvedPuzzles, Math.max(0, this.puzzles.length - 1));
        this.loadPuzzle(this.currentPuzzleIndex);
    }

    loadPuzzle(index) {
        this.currentPuzzleIndex = index;
        this.currentAttempt = 0;
        this.isFinishedCurrent = false;

        const p = this.puzzles[this.currentPuzzleIndex];
        if (!p) return;

        if (this.headline) this.headline.innerText = p.title || `Deduktionsrätsel ${index + 1}`;
        if (this.tracker) this.tracker.innerText = `Rätsel ${index + 1}/${this.puzzles.length}`;
        
        if (this.resultBox) {
            this.resultBox.className = 'doctordle-result hidden';
            this.resultBox.style.display = 'none';
            this.resultBox.innerHTML = '';
        }
        if (this.nextBtn) {
            this.nextBtn.classList.add('hidden');
            this.nextBtn.style.display = 'none';
        }
        if (this.input) {
            this.input.disabled = false;
            this.input.value = '';
        }
        if (this.submitBtn) this.submitBtn.disabled = false;
        if (this.revealBtn) this.revealBtn.disabled = false;

        this.updateXPBadge();
        this.renderHints();
    }

    updateXPBadge() {
        if (!this.xpBadge) return;
        const currentXP = this.xpTiers[this.currentAttempt] || 0;
        this.xpBadge.innerText = `Mögliche XP: +${currentXP}`;
    }

    renderHints() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const p = this.puzzles[this.currentPuzzleIndex];
        const hints = p.hints || [];

        for (let i = 0; i < this.maxAttempts; i++) {
            const card = document.createElement('div');
            card.className = 'hint-card';
            card.style.padding = '12px 16px';
            card.style.borderRadius = '8px';
            card.style.marginBottom = '8px';
            card.style.fontSize = '0.92rem';
            card.style.lineHeight = '1.4';
            card.style.transition = 'all 0.3s ease';

            if (i <= this.currentAttempt && hints[i]) {
                card.style.background = 'rgba(14, 165, 233, 0.1)';
                card.style.border = '1px solid rgba(14, 165, 233, 0.4)';
                card.style.color = '#e0f2fe';
                card.innerHTML = `<strong>Stufe ${i + 1}:</strong> ${hints[i].replace(/^Stufe \d+[^:]*:\s*/i, '')}`;
            } else {
                card.style.background = 'rgba(255, 255, 255, 0.03)';
                card.style.border = '1px dashed rgba(255, 255, 255, 0.15)';
                card.style.color = 'var(--text-dim, #64748b)';
                card.style.textAlign = 'center';
                card.innerText = `🔒 Hinweis ${i + 1} (Gesperrt)`;
            }
            this.container.appendChild(card);
        }
    }

    handleAutocomplete(query) {
        if (!this.autocompleteList) return;
        const trimmed = query.trim().toLowerCase();
        if (trimmed.length < 2) {
            this.hideAutocomplete();
            return;
        }

        let list = [];
        if (window.MedicalDictionary && typeof window.MedicalDictionary.getAllDiagnoses === 'function') {
            list = window.MedicalDictionary.getAllDiagnoses();
        } else {
            const entries = activeCaseData?.extra_tasks?.library_entries || [];
            list = Array.from(new Set(entries));
        }

        const matches = list.filter(item => item.toLowerCase().includes(trimmed)).slice(0, 6);

        this.autocompleteList.innerHTML = '';
        if (matches.length > 0) {
            this.showAutocomplete();
            matches.forEach(m => {
                const li = document.createElement('li');
                li.innerText = m;
                li.style.padding = '10px 14px';
                li.style.cursor = 'pointer';
                li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                li.style.color = 'var(--text-main, #f1f5f9)';
                li.onmousedown = (e) => {
                    e.preventDefault();
                    this.input.value = m;
                    this.hideAutocomplete();
                    this.input.focus();
                };
                this.autocompleteList.appendChild(li);
            });
        } else {
            this.hideAutocomplete();
        }
    }

    normalize(str) {
        if (!str) return '';
        return str.toLowerCase()
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]/g, '').trim();
    }

    handleGuess() {
        if (this.isFinishedCurrent) return;
        const val = this.input.value.trim();
        if (!val) return;

        this.hideAutocomplete();

        const p = this.puzzles[this.currentPuzzleIndex];
        const normInput = this.normalize(val);
        const normTarget = this.normalize(p.target_diagnosis);
        const normSynonyms = (p.synonyms || []).map(s => this.normalize(s));

        const isHit = (normInput === normTarget) || normSynonyms.includes(normInput);

        if (isHit) {
            this.finishCurrentPuzzle(true);
        } else {
            this.currentAttempt++;
            this.input.value = '';
            if (this.currentAttempt >= this.maxAttempts) {
                this.finishCurrentPuzzle(false, false);
            } else {
                this.updateXPBadge();
                this.renderHints();
            }
        }
    }

    handleReveal() {
        if (this.isFinishedCurrent) return;
        if (!window.confirm("Diagnose wirklich aufdecken? Dafür werden 200 XP abgezogen.")) return;
        this.finishCurrentPuzzle(false, true);
    }

    finishCurrentPuzzle(won, byReveal = false) {
        this.isFinishedCurrent = true;
        this.input.disabled = true;
        this.submitBtn.disabled = true;
        this.revealBtn.disabled = true;

        const p = this.puzzles[this.currentPuzzleIndex];
        const hints = p.hints || [];

        const cards = this.container.querySelectorAll('.hint-card');
        cards.forEach((c, idx) => {
            c.style.background = won ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            c.style.border = won ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)';
            c.style.color = '#fff';
            c.innerHTML = `<strong>Stufe ${idx + 1}:</strong> ${hints[idx] ? hints[idx].replace(/^Stufe \d+[^:]*:\s*/i, '') : ''}`;
        });

        this.resultBox.classList.remove('hidden');
        this.resultBox.style.display = 'block';

        if (won) {
            this.solvedPuzzles = Math.max(this.solvedPuzzles, this.currentPuzzleIndex + 1);
            const earnedXP = this.xpTiers[this.currentAttempt] || 100;
            this.resultBox.style.background = 'rgba(34, 197, 94, 0.15)';
            this.resultBox.style.border = '1px solid #22c55e';
            this.resultBox.style.color = '#86efac';
            this.resultBox.innerHTML = `
                <strong>Exzellent deduziert!</strong><br>
                Diagnose: <em>${p.target_diagnosis}</em> im ${this.currentAttempt + 1}. Versuch erkannt.<br>
                <strong>+${earnedXP} XP erhalten.</strong>
                ${p.learning_pearl ? `<div style="margin-top:8px; font-size:0.85rem; color:#f1f5f9;">💡 ${p.learning_pearl}</div>` : ''}
            `;
            if (typeof applyXpDelta === 'function') {
                applyXpDelta(earnedXP, `Doctordle Rätsel ${this.currentPuzzleIndex + 1}`);
            }
        } else if (byReveal) {
            this.resultBox.style.background = 'rgba(239, 68, 68, 0.15)';
            this.resultBox.style.border = '1px solid #ef4444';
            this.resultBox.style.color = '#fca5a5';
            this.resultBox.innerHTML = `
                <strong>Lösung aufgedeckt:</strong><br>
                Gesuchte Entität: <em>${p.target_diagnosis}</em><br>
                <strong>-200 XP abgezogen.</strong>
            `;
            if (typeof applyXpDelta === 'function') {
                applyXpDelta(-this.revealPenalty, 'Doctordle Aufdecken');
            }
        } else {
            this.resultBox.style.background = 'rgba(239, 68, 68, 0.15)';
            this.resultBox.style.border = '1px solid #ef4444';
            this.resultBox.style.color = '#fca5a5';
            this.resultBox.innerHTML = `
                <strong>6 Fehlversuche erreicht!</strong><br>
                Die richtige Diagnose war: <em>${p.target_diagnosis}</em>
            `;
        }

        // Globalen Callback und Auto-Save triggern
        if (typeof window.onDoctordlePuzzleSolved === 'function') {
            window.onDoctordlePuzzleSolved(this.solvedPuzzles, this.puzzles.length);
        }

        if (this.currentPuzzleIndex < this.puzzles.length - 1) {
            this.nextBtn.classList.remove('hidden');
            this.nextBtn.style.display = 'block';
        }
    }

    goToNextPuzzle() {
        if (this.currentPuzzleIndex < this.puzzles.length - 1) {
            this.loadPuzzle(this.currentPuzzleIndex + 1);
        }
    }

    resetGame() {
        this.currentCaseId = null;
        this.solvedPuzzles = 0;
        this.currentPuzzleIndex = 0;
        if (activeCaseData) {
            this.initCase(activeCaseData, true);
        }
    }
}

// Singleton-Instanziierung
window.doctordleGame = new DoctordleController();

window.initDoctordle = function(caseData) {
    if (window.doctordleGame) {
        window.doctordleGame.initCase(caseData);
    }
};
