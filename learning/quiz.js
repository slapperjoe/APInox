/* quiz.js — Interactive quiz logic for Rust Learning Guide */

/* -------------------------------------------------------
   PROGRESS TRACKING (localStorage)
   ------------------------------------------------------- */

function getLessonId() {
  return window.location.pathname.split('/').pop().replace('.html', '');
}

function getProgress(lessonId) {
  try {
    return JSON.parse(localStorage.getItem('rlg_' + lessonId) || '{}');
  } catch { return {}; }
}

function saveProgress(lessonId, quizId, result) {
  const progress = getProgress(lessonId);
  progress[quizId] = result;
  localStorage.setItem('rlg_' + lessonId, JSON.stringify(progress));
  updateProgressBar();
}

function updateProgressBar() {
  const lessonId = getLessonId();
  const quizzes = document.querySelectorAll('.quiz[id]');
  const progress = getProgress(lessonId);
  const answered = Object.keys(progress).length;
  const total = quizzes.length;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const bar = document.querySelector('.progress-bar-fill');
  const label = document.querySelector('.progress-label');
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = answered + ' of ' + total + ' questions answered';
  // also update global index progress
  updateCardProgress(lessonId, pct);
}

function updateCardProgress(lessonId, pct) {
  const stored = JSON.parse(localStorage.getItem('rlg_card_progress') || '{}');
  stored[lessonId] = pct;
  localStorage.setItem('rlg_card_progress', JSON.stringify(stored));
}

/* -------------------------------------------------------
   MULTIPLE CHOICE
   mc(quizId, buttonEl, isCorrect, explanation)
   ------------------------------------------------------- */

function mc(quizId, btn, isCorrect) {
  const quiz = document.getElementById(quizId);
  if (!quiz || quiz.dataset.answered) return;
  quiz.dataset.answered = '1';

  const options = quiz.querySelectorAll('.quiz-options button');
  options.forEach(b => {
    b.disabled = true;
    if (b.dataset.correct === 'true') b.classList.add('correct');
  });

  if (!isCorrect) btn.classList.add('wrong');

  const exp = document.getElementById(quizId + '-exp');
  if (exp) {
    exp.classList.add('show');
    exp.classList.add(isCorrect ? 'correct-exp' : 'wrong-exp');
  }
  saveProgress(getLessonId(), quizId, isCorrect ? 'correct' : 'wrong');
}

/* -------------------------------------------------------
   FILL IN THE BLANK
   fillCheck(quizId, correctAnswers)
   correctAnswers: string or array of strings (any match passes)
   ------------------------------------------------------- */

function fillCheck(quizId, answers) {
  const quiz = document.getElementById(quizId);
  if (!quiz || quiz.dataset.answered) return;

  const input = quiz.querySelector('.fill-input');
  const exp = document.getElementById(quizId + '-exp');
  const accepted = Array.isArray(answers) ? answers : [answers];
  const userVal = (input.value || '').trim().toLowerCase();
  const isCorrect = accepted.some(a => a.toLowerCase() === userVal);

  quiz.dataset.answered = '1';
  input.disabled = true;
  input.classList.add(isCorrect ? 'correct' : 'wrong');

  const checkBtn = quiz.querySelector('.btn-check');
  if (checkBtn) checkBtn.disabled = true;

  if (exp) {
    exp.classList.add('show');
    exp.classList.add(isCorrect ? 'correct-exp' : 'wrong-exp');
  }
  saveProgress(getLessonId(), quizId, isCorrect ? 'correct' : 'wrong');
}

// Allow Enter key to submit fill-in-blank
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.fill-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const quiz = input.closest('.quiz');
        if (quiz) {
          const btn = quiz.querySelector('.btn-check');
          if (btn && !btn.disabled) btn.click();
        }
      }
    });
  });
});

/* -------------------------------------------------------
   REVEAL (predict output / click to reveal)
   reveal(quizId)
   ------------------------------------------------------- */

function reveal(quizId) {
  const quiz = document.getElementById(quizId);
  if (!quiz) return;
  quiz.dataset.answered = '1';

  const btn = quiz.querySelector('.btn-reveal');
  if (btn) btn.style.display = 'none';

  const exp = document.getElementById(quizId + '-exp');
  if (exp) {
    exp.classList.add('show');
    exp.classList.add('correct-exp');
  }
  saveProgress(getLessonId(), quizId, 'revealed');
}

/* -------------------------------------------------------
   TRUE / FALSE
   tf(quizId, buttonEl, userSaidTrue, actuallyTrue)
   ------------------------------------------------------- */

function tf(quizId, btn, userSaidTrue, actuallyTrue) {
  const quiz = document.getElementById(quizId);
  if (!quiz || quiz.dataset.answered) return;
  quiz.dataset.answered = '1';

  const isCorrect = (userSaidTrue === actuallyTrue);
  const options = quiz.querySelectorAll('.quiz-options button');
  options.forEach(b => {
    b.disabled = true;
    if (b.dataset.answer === String(actuallyTrue)) b.classList.add('correct');
  });
  if (!isCorrect) btn.classList.add('wrong');

  const exp = document.getElementById(quizId + '-exp');
  if (exp) {
    exp.classList.add('show');
    exp.classList.add(isCorrect ? 'correct-exp' : 'wrong-exp');
  }
  saveProgress(getLessonId(), quizId, isCorrect ? 'correct' : 'wrong');
}

/* -------------------------------------------------------
   SPOT THE BUG
   bugLine(quizId, lineEl, isBug)
   ------------------------------------------------------- */

function bugLine(quizId, lineEl, isBug) {
  const quiz = document.getElementById(quizId);
  if (!quiz || quiz.dataset.answered) return;

  if (isBug) {
    quiz.dataset.answered = '1';
    lineEl.classList.add('is-bug');
    // Mark non-bug lines
    quiz.querySelectorAll('.bug-line').forEach(l => {
      if (l !== lineEl) l.classList.add('not-bug');
      l.style.cursor = 'default';
    });
    const exp = document.getElementById(quizId + '-exp');
    if (exp) { exp.classList.add('show', 'correct-exp'); }
    saveProgress(getLessonId(), quizId, 'correct');
  } else {
    lineEl.style.background = 'rgba(220,38,38,.12)';
    setTimeout(() => { lineEl.style.background = ''; }, 600);
  }
}

/* -------------------------------------------------------
   MATCH IT
   Simple click-to-pair: click one from each column.
   State stored on the quiz element.
   ------------------------------------------------------- */

function matchClick(quizId, itemId, side, btn) {
  const quiz = document.getElementById(quizId);
  if (!quiz || btn.classList.contains('matched')) return;

  const state = quiz._matchState || (quiz._matchState = { left: null, right: null, matched: 0, total: null });
  if (state.total === null) {
    state.total = quiz.querySelectorAll('.match-col:first-child .match-item').length;
  }

  // Deselect same-side previous selection
  if (state[side] && state[side].el !== btn) {
    state[side].el.classList.remove('selected');
  }

  state[side] = { id: itemId, el: btn };
  btn.classList.add('selected');

  // If both sides selected, check match
  if (state.left && state.right) {
    const isMatch = state.left.id === state.right.id;
    [state.left.el, state.right.el].forEach(el => {
      el.classList.remove('selected');
      el.classList.add(isMatch ? 'matched' : 'wrong-match');
      el.disabled = isMatch;
    });

    if (isMatch) {
      state.matched++;
      state.left = null;
      state.right = null;
      if (state.matched === state.total) {
        const exp = document.getElementById(quizId + '-exp');
        if (exp) { exp.classList.add('show', 'correct-exp'); }
        saveProgress(getLessonId(), quizId, 'correct');
      }
    } else {
      // Flash red then reset
      setTimeout(() => {
        [state.left.el, state.right.el].forEach(el => {
          el.classList.remove('wrong-match');
        });
        state.left = null;
        state.right = null;
      }, 800);
    }
  }
}

/* -------------------------------------------------------
   INIT — run on page load
   ------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  updateProgressBar();

  // Restore any previously answered quizzes from localStorage (visual only — re-running is fine)
  // For now just update the progress bar count

  // Prism highlight if loaded
  if (typeof Prism !== 'undefined') Prism.highlightAll();
});
