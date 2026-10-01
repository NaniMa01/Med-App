function renderQuiz() {
    const quizList = activeCaseData.extra_tasks.master_quiz || [];
    const wrapper = document.getElementById('quiz-wrapper');
    document.getElementById('badge-mode-quiz').innerText = `0/${quizList.length}`;
    document.getElementById('eval-quiz-btn').style.display = 'block';
    document.getElementById('quiz-fb').style.display = 'none';

    wrapper.innerHTML = quizList.map((q, qIdx) => `
        <div class="quiz-card" id="quiz-card-${qIdx}">
            <div class="quiz-question-num">Prüfungsfrage ${qIdx + 1} von ${quizList.length}</div>
            <div class="quiz-question-text">${q.question}</div>
            <div class="quiz-options-grid">
                ${q.options.map((opt, oIdx) => `
                    <button class="quiz-opt-btn" id="opt-btn-${qIdx}-${oIdx}" onclick="selectQuizOption(${qIdx},${oIdx})">
                        <span>${opt}</span>
                    </button>
                `).join('')}
            </div>
            <div class="quiz-explanation-box" id="quiz-expl-${qIdx}">${q.explanation}</div>
        </div>
    `).join('');
}

window.selectQuizOption = function(qIdx, oIdx) {
    if (quizSolved) return;
    userQuizAnswers[qIdx] = oIdx;
    const card = document.getElementById(`quiz-card-${qIdx}`);
    card.querySelectorAll('.quiz-opt-btn').forEach((btn, idx) => {
        btn.classList.toggle('selected', idx === oIdx);
    });
    const answeredCount = Object.keys(userQuizAnswers).length;
    const total = activeCaseData.extra_tasks.master_quiz.length;
    document.getElementById('badge-mode-quiz').innerText = `${answeredCount}/${total}`;
};

window.evalQuiz = function() {
    const quizList = activeCaseData.extra_tasks.master_quiz || [];
    if (Object.keys(userQuizAnswers).length < quizList.length) {
        alert(`Bitte beantworte alle ${quizList.length} Fragen vor der Abgabe!`);
        return;
    }

    let correctCount = 0;
    quizList.forEach((q, qIdx) => {
        const userChoice = userQuizAnswers[qIdx];
        const card = document.getElementById(`quiz-card-${qIdx}`);
        const isCorrect = (userChoice === q.correct_index);
        if (isCorrect) correctCount++;

        card.querySelectorAll('.quiz-opt-btn').forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === q.correct_index) btn.classList.add('correct-highlight');
            if (idx === userChoice && !isCorrect) btn.classList.add('wrong-highlight');
        });

        const expl = document.getElementById(`quiz-expl-${qIdx}`);
        expl.style.display = 'block';
    });

    const fb = document.getElementById('quiz-fb');
    fb.style.display = 'block';
    document.getElementById('eval-quiz-btn').style.display = 'none';

    const scorePercent = Math.round((correctCount / quizList.length) * 100);
    if (scorePercent >= 70) {
        fb.className = 'feedback-box feedback-success';
        fb.innerHTML = `<strong>Prüfung bestanden!</strong> ${correctCount} von ${quizList.length} Fragen richtig (${scorePercent}%).`;
        applyXpDelta(correctCount * 30, 'Master-Exam');
        trackSkill('Pathophysiologie', true);
        trackSkill('Diagnostik', true);
        quizSolved = true;
        document.getElementById('badge-mode-quiz').innerText = '✓ Bestanden';
        checkFinalCompletion();
    } else {
        fb.className = 'feedback-box feedback-error';
        fb.innerHTML = `<strong>Nicht bestanden:</strong> Nur ${correctCount} von ${quizList.length} Fragen richtig (${scorePercent}%). Zum Bestehen sind mindestens 70% erforderlich.`;
        applyXpDelta(-50, 'Exam Fehlversuch');
        trackSkill('Pathophysiologie', false);
    }
};
