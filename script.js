const topics = window.HISTORY_QUIZ_TOPICS || [];
const topicDataMap = window.HISTORY_QUIZ_DATA || {};

const topicTitleEl = document.getElementById('topicTitle');
const topicSubtitleEl = document.getElementById('topicSubtitle');
const topicSelectEl = document.getElementById('topicSelect');
const quizEl = document.getElementById('quiz');
const currentQuestionEl = document.getElementById('currentQuestion');
const totalQuestionsEl = document.getElementById('totalQuestions');
const liveScoreEl = document.getElementById('liveScore');
const answeredCountEl = document.getElementById('answeredCount');
const questionDotsEl = document.getElementById('questionDots');

const sourceCache = {};

const state = {
  topicId: topics[0]?.id || null,
  current: 0,
  answers: [],
  checked: [],
  finished: false,
  sourceVisible: false,
  sourceLoading: false,
  sourceError: '',
};

function getQuizData() {
  return topicDataMap[state.topicId];
}

function getSourcePath(topicId) {
  return `source/${topicId}.txt`;
}

function resetStateForTopic(topicId, keepSelection = true) {
  const quizData = topicDataMap[topicId];
  if (!quizData) return;
  state.topicId = topicId;
  state.current = 0;
  state.answers = Array(quizData.questions.length).fill(null);
  state.checked = Array(quizData.questions.length).fill(false);
  state.finished = false;
  state.sourceVisible = false;
  state.sourceLoading = false;
  state.sourceError = '';
  if (keepSelection) topicSelectEl.value = topicId;
}

function normalizeText(value) {
  return String(value).trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function isAnswered(answer) {
  return answer !== null && (!(Array.isArray(answer)) || answer.length > 0) && answer !== '';
}

function isCorrect(question, answer) {
  if (answer == null) return false;
  if (question.type === 'single') return answer === question.correct;
  if (question.type === 'multi') {
    const a = [...answer].sort((x, y) => x - y);
    const b = [...question.correct].sort((x, y) => x - y);
    return JSON.stringify(a) === JSON.stringify(b);
  }
  if (question.type === 'text') {
    const normalized = normalizeText(answer);
    return question.answers.some((v) => normalizeText(v) === normalized);
  }
  return false;
}

function getScore() {
  const quizData = getQuizData();
  return quizData.questions.reduce((sum, q, i) => sum + (isCorrect(q, state.answers[i]) ? 1 : 0), 0);
}

function getAnsweredCount() {
  return state.answers.filter(isAnswered).length;
}

function renderTopicOptions() {
  topicSelectEl.innerHTML = '';
  topics.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic.id;
    option.textContent = topic.title;
    topicSelectEl.appendChild(option);
  });
  if (state.topicId) topicSelectEl.value = state.topicId;
}

function renderHeader() {
  const quizData = getQuizData();
  topicTitleEl.textContent = quizData.topic;
  topicSubtitleEl.textContent = quizData.subtitle || '';
  totalQuestionsEl.textContent = quizData.questions.length;
}

function renderDots() {
  const quizData = getQuizData();
  questionDotsEl.innerHTML = '';
  quizData.questions.forEach((_, index) => {
    const btn = document.createElement('button');
    btn.className = 'dot';
    if (index === state.current) btn.classList.add('active');
    if (isAnswered(state.answers[index])) btn.classList.add('answered');
    if (state.finished) btn.disabled = true;
    btn.textContent = index + 1;
    btn.addEventListener('click', () => goTo(index));
    questionDotsEl.appendChild(btn);
  });
}

async function toggleSource() {
  state.sourceVisible = !state.sourceVisible;
  if (!state.sourceVisible) {
    renderQuestion();
    return;
  }

  if (sourceCache[state.topicId]) {
    state.sourceError = '';
    renderQuestion();
    return;
  }

  state.sourceLoading = true;
  state.sourceError = '';
  renderQuestion();

  try {
    const response = await fetch(getSourcePath(state.topicId));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    sourceCache[state.topicId] = await response.text();
  } catch (error) {
    state.sourceError = 'Не получилось загрузить исходный текст темы.';
  } finally {
    state.sourceLoading = false;
    renderQuestion();
  }
}

function buildSourcePanel() {
  const panel = document.createElement('section');
  panel.className = 'source-panel';

  const title = document.createElement('div');
  title.className = 'source-panel-title';
  title.textContent = 'Полный текст темы';
  panel.appendChild(title);

  const body = document.createElement('div');
  body.className = 'source-panel-body';

  if (state.sourceLoading) {
    body.innerHTML = '<p class="small">Загружаю текст темы…</p>';
  } else if (state.sourceError) {
    body.innerHTML = `<p class="small">${state.sourceError}</p>`;
  } else {
    const pre = document.createElement('pre');
    pre.className = 'source-text';
    pre.textContent = sourceCache[state.topicId] || 'Текст темы пока пустой.';
    body.appendChild(pre);
  }

  panel.appendChild(body);
  return panel;
}

function renderQuestion() {
  const quizData = getQuizData();
  if (!quizData || state.finished) return;
  const q = quizData.questions[state.current];
  currentQuestionEl.textContent = state.current + 1;
  liveScoreEl.textContent = getScore();
  answeredCountEl.textContent = getAnsweredCount();
  renderDots();

  const card = document.createElement('section');
  card.className = 'question-card';

  const typeLabel = {
    single: 'Один вариант ответа',
    multi: 'Несколько вариантов ответа',
    text: 'Заполнить пропуск'
  }[q.type];

  const prevAnswer = state.answers[state.current];

  card.innerHTML = `
    <div class="question-topline">
      <div class="question-type">${typeLabel}</div>
      <button type="button" class="ghost source-toggle">${state.sourceVisible ? 'Скрыть тему' : 'Показать тему'}</button>
    </div>
    <h2 class="question-title">${q.prompt}</h2>
    ${q.help ? `<p class="question-help">${q.help}</p>` : ''}
    <div class="answer-host"></div>
    <div class="meta-row">
      <span class="small">Можно переключаться между вопросами в любом порядке.</span>
    </div>
  `;

  card.querySelector('.source-toggle').addEventListener('click', toggleSource);

  if (state.sourceVisible) {
    card.appendChild(buildSourcePanel());
  }

  const host = card.querySelector('.answer-host');

  if (q.type === 'single' || q.type === 'multi') {
    const wrap = document.createElement('div');
    wrap.className = 'options';
    q.options.forEach((option, index) => {
      const label = document.createElement('label');
      label.className = 'option';
      const checked = q.type === 'single'
        ? prevAnswer === index
        : Array.isArray(prevAnswer) && prevAnswer.includes(index);
      label.innerHTML = `<input type="${q.type === 'single' ? 'radio' : 'checkbox'}" name="answer" ${checked ? 'checked' : ''}> <span>${option}</span>`;
      label.querySelector('input').addEventListener('change', (e) => {
        state.checked[state.current] = false;
        if (q.type === 'single') {
          state.answers[state.current] = index;
          state.checked[state.current] = true;
          updateAfterAnswer();
          return;
        }

        const current = Array.isArray(state.answers[state.current]) ? [...state.answers[state.current]] : [];
        state.answers[state.current] = e.target.checked
          ? [...new Set([...current, index])]
          : current.filter((v) => v !== index);
        liveScoreEl.textContent = getScore();
        answeredCountEl.textContent = getAnsweredCount();
        renderDots();
      });
      wrap.appendChild(label);
    });
    host.appendChild(wrap);

    if (q.type === 'multi') {
      const checkBtn = document.createElement('button');
      checkBtn.className = 'accent';
      checkBtn.textContent = 'Проверить ответ';
      checkBtn.addEventListener('click', () => {
        state.checked[state.current] = true;
        renderQuestion();
      });
      host.appendChild(checkBtn);
    }
  }

  if (q.type === 'text') {
    const input = document.createElement('input');
    input.className = 'text-answer';
    input.type = 'text';
    input.placeholder = 'Введите ответ';
    input.value = prevAnswer || '';
    input.addEventListener('input', () => {
      state.answers[state.current] = input.value;
      state.checked[state.current] = false;
      liveScoreEl.textContent = getScore();
      answeredCountEl.textContent = getAnsweredCount();
      renderDots();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.checked[state.current] = true;
        renderQuestion();
      }
    });
    host.appendChild(input);

    const checkBtn = document.createElement('button');
    checkBtn.className = 'accent';
    checkBtn.textContent = 'Проверить ответ';
    checkBtn.addEventListener('click', () => {
      state.checked[state.current] = true;
      renderQuestion();
    });
    host.appendChild(checkBtn);
  }

  if (isAnswered(prevAnswer) && state.checked[state.current]) {
    const ok = isCorrect(q, prevAnswer);
    const fb = document.createElement('div');
    fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
    fb.innerHTML = ok ? `✅ Верно. ${q.explanation}` : `❌ Пока неверно. ${q.explanation}`;
    card.appendChild(fb);
  }

  quizEl.innerHTML = '';
  quizEl.appendChild(card);
}

function updateAfterAnswer() {
  liveScoreEl.textContent = getScore();
  answeredCountEl.textContent = getAnsweredCount();
  renderDots();
  renderQuestion();
}

function goTo(index) {
  const quizData = getQuizData();
  if (!quizData || index < 0 || index >= quizData.questions.length || state.finished) return;
  state.current = index;
  renderQuestion();
}

function finishQuiz() {
  const quizData = getQuizData();
  state.finished = true;
  const score = getScore();
  const total = quizData.questions.length;
  const tpl = document.getElementById('resultTemplate');
  const node = tpl.content.cloneNode(true);
  node.getElementById('finalScore').textContent = `${score} из ${total}`;

  let text = 'Неплохо, но тему стоит ещё раз прогнать.';
  if (score === total) text = 'Идеально. Ты эту тему уже хуячишь очень уверенно.';
  else if (score >= total * 0.75) text = 'Очень хорошо. Основа уже крепкая.';
  else if (score >= total * 0.5) text = 'Нормально, но есть дыры — лучше повторить спорные места.';
  node.getElementById('resultText').textContent = text;

  const review = node.getElementById('review');
  quizData.questions.forEach((q, i) => {
    const item = document.createElement('div');
    item.className = 'review-item';
    const ok = isCorrect(q, state.answers[i]);
    item.innerHTML = `<strong>${i + 1}. ${q.prompt}</strong><div class="small">${ok ? 'Верно' : 'Ошибка'} · ${q.explanation}</div>`;
    review.appendChild(item);
  });

  node.getElementById('restartBottom').addEventListener('click', restartQuiz);
  quizEl.innerHTML = '';
  quizEl.appendChild(node);
  liveScoreEl.textContent = score;
  answeredCountEl.textContent = getAnsweredCount();
  renderDots();
}

function restartQuiz() {
  resetStateForTopic(state.topicId, false);
  renderApp();
}

function changeTopic(topicId) {
  resetStateForTopic(topicId);
  renderApp();
}

function renderApp() {
  renderHeader();
  renderQuestion();
}

document.getElementById('prevBtn').addEventListener('click', () => goTo(state.current - 1));
document.getElementById('nextBtn').addEventListener('click', () => goTo(state.current + 1));
document.getElementById('finishBtn').addEventListener('click', finishQuiz);
document.getElementById('restartTop').addEventListener('click', restartQuiz);
topicSelectEl.addEventListener('change', () => changeTopic(topicSelectEl.value));

renderTopicOptions();
resetStateForTopic(state.topicId, false);
renderApp();
