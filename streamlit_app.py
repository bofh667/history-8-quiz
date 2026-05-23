from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import streamlit as st

BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / 'data' / 'quiz-data.json'
SOURCE_DIR = BASE_DIR / 'source'


def load_quiz_payload() -> dict[str, Any]:
    with DATA_PATH.open('r', encoding='utf-8') as fh:
        return json.load(fh)


PAYLOAD = load_quiz_payload()
TOPICS = PAYLOAD['topics']
QUIZ_DATA = PAYLOAD['data']
TOPIC_IDS = [topic['id'] for topic in TOPICS]
TOPIC_INDEX = {topic['id']: topic for topic in TOPICS}

st.set_page_config(page_title='История — онлайн-тесты', page_icon='📚', layout='wide')

st.markdown(
    """
    <style>
      .stApp {
        background: linear-gradient(180deg, #020617 0%, #0f172a 38%);
      }
      .block-container {
        max-width: 920px;
        padding-top: 1.2rem;
        padding-bottom: 2rem;
      }
      h1, h2, h3, p, label {
        word-break: break-word;
      }
      [data-testid="stMetric"] {
        background: rgba(17, 24, 39, 0.92);
        border: 1px solid #1f2937;
        border-radius: 16px;
        padding: 0.8rem 0.9rem;
      }
      [data-testid="stButton"] > button,
      [data-testid="stDownloadButton"] > button {
        border-radius: 12px;
        min-height: 2.8rem;
        white-space: normal;
      }
      [data-testid="stRadio"] label,
      [data-testid="stMultiSelect"] label,
      [data-testid="stTextInput"] label,
      [data-testid="stSelectbox"] label {
        font-weight: 600;
      }
      [data-testid="stRadio"] [role="radiogroup"] > label,
      [data-testid="stCheckbox"] label {
        padding: 0.35rem 0;
      }
      .quiz-card {
        background: rgba(17, 24, 39, 0.92);
        border: 1px solid #1f2937;
        border-radius: 18px;
        padding: 1rem 1rem 0.5rem;
        margin: 0.75rem 0 1rem;
      }
      .quiz-muted {
        color: #94a3b8;
        font-size: 0.95rem;
      }
      @media (max-width: 640px) {
        .block-container {
          padding-left: 0.85rem;
          padding-right: 0.85rem;
          padding-top: 0.75rem;
        }
        h1 { font-size: 1.65rem; }
        h2 { font-size: 1.25rem; }
        .quiz-card {
          padding: 0.85rem 0.8rem 0.35rem;
          border-radius: 16px;
        }
      }
    </style>
    """,
    unsafe_allow_html=True,
)


def normalize_text(value: str) -> str:
    return ' '.join(str(value).strip().lower().replace('ё', 'е').split())


def init_topic_state(topic_id: str) -> None:
    key = f'quiz_state_{topic_id}'
    if key not in st.session_state:
        total = len(QUIZ_DATA[topic_id]['questions'])
        st.session_state[key] = {
            'current': 0,
            'answers': [None] * total,
            'checked': [False] * total,
            'finished': False,
            'show_source': False,
        }


def reset_topic_state(topic_id: str) -> None:
    total = len(QUIZ_DATA[topic_id]['questions'])
    st.session_state[f'quiz_state_{topic_id}'] = {
        'current': 0,
        'answers': [None] * total,
        'checked': [False] * total,
        'finished': False,
        'show_source': False,
    }


def get_state(topic_id: str) -> dict[str, Any]:
    init_topic_state(topic_id)
    return st.session_state[f'quiz_state_{topic_id}']


def is_answered(answer: Any) -> bool:
    return answer is not None and (not isinstance(answer, list) or len(answer) > 0) and answer != ''


def is_correct(question: dict[str, Any], answer: Any) -> bool:
    if answer is None:
        return False
    if question['type'] == 'single':
        return answer == question['correct']
    if question['type'] == 'multi':
        return sorted(answer) == sorted(question['correct'])
    if question['type'] == 'text':
        normalized = normalize_text(answer)
        return any(normalize_text(v) == normalized for v in question['answers'])
    return False


def get_score(topic_id: str) -> int:
    state = get_state(topic_id)
    questions = QUIZ_DATA[topic_id]['questions']
    return sum(1 for idx, question in enumerate(questions) if is_correct(question, state['answers'][idx]))


def load_source_text(topic_id: str) -> str:
    path = SOURCE_DIR / f'{topic_id}.txt'
    return path.read_text(encoding='utf-8') if path.exists() else 'Текст темы пока недоступен.'


def jump_to_question(topic_id: str, index: int) -> None:
    state = get_state(topic_id)
    state['current'] = index


def next_question(topic_id: str) -> None:
    state = get_state(topic_id)
    max_index = len(QUIZ_DATA[topic_id]['questions']) - 1
    state['current'] = min(max_index, state['current'] + 1)


def prev_question(topic_id: str) -> None:
    state = get_state(topic_id)
    state['current'] = max(0, state['current'] - 1)


def finish_quiz(topic_id: str) -> None:
    state = get_state(topic_id)
    state['finished'] = True


def restart_quiz(topic_id: str) -> None:
    reset_topic_state(topic_id)


st.title('📚 История — онлайн-тесты')
st.caption('Темы 24–31: единый интерфейс, проверка ответов и исходные тексты тем.')

selected_topic = st.selectbox(
    'Тема',
    options=TOPIC_IDS,
    format_func=lambda topic_id: TOPIC_INDEX[topic_id]['title'],
)

quiz_data = QUIZ_DATA[selected_topic]
state = get_state(selected_topic)
questions = quiz_data['questions']
current_index = state['current']
question = questions[current_index]

col_title, col_action = st.columns([4, 1])
with col_title:
    st.subheader(quiz_data['topic'])
    st.caption(quiz_data.get('subtitle', ''))
with col_action:
    if st.button('Начать заново', use_container_width=True):
        restart_quiz(selected_topic)
        st.rerun()

score = get_score(selected_topic)
answered_count = sum(1 for answer in state['answers'] if is_answered(answer))
stat1, stat2, stat3 = st.columns(3)
stat1.metric('Вопрос', f'{current_index + 1} / {len(questions)}')
stat2.metric('Текущий счёт', score)
stat3.metric('Отвечено', answered_count)

if not state['finished']:
    jump_options = list(range(len(questions)))
    jump_value = st.selectbox(
        'Навигация по вопросам',
        options=jump_options,
        index=current_index,
        format_func=lambda idx: f'Вопрос {idx + 1} — {questions[idx]["prompt"]}',
        key=f'jump_select_{selected_topic}',
    )
    if jump_value != current_index:
        jump_to_question(selected_topic, jump_value)
        st.rerun()

    st.markdown('<div class="quiz-card">', unsafe_allow_html=True)
    st.markdown(f'**{question["prompt"]}**')
    if question.get('help'):
        st.caption(question['help'])

    label = 'Скрыть тему' if state['show_source'] else 'Показать тему'
    if st.button(label, use_container_width=True):
        state['show_source'] = not state['show_source']
        st.rerun()

    if state['show_source']:
        with st.expander('Полный текст темы', expanded=True):
            st.text(load_source_text(selected_topic))

    answer_key = f'answer_{selected_topic}_{current_index}'

    if question['type'] == 'single':
        previous_answer = state['answers'][current_index]
        selected = st.radio(
            'Выбери один вариант',
            options=list(range(len(question['options']))),
            format_func=lambda idx: question['options'][idx],
            index=previous_answer if previous_answer is not None else None,
            key=answer_key,
        )
        if selected is not None:
            state['answers'][current_index] = selected
            state['checked'][current_index] = True

    elif question['type'] == 'multi':
        previous_answer = state['answers'][current_index] or []
        selected_labels = st.multiselect(
            'Выбери все подходящие варианты',
            options=question['options'],
            default=[question['options'][idx] for idx in previous_answer],
            key=answer_key,
        )
        selected_indices = [question['options'].index(option) for option in selected_labels]
        state['answers'][current_index] = selected_indices
        if st.button('Проверить ответ', key=f'check_{selected_topic}_{current_index}', use_container_width=True):
            state['checked'][current_index] = True

    elif question['type'] == 'text':
        previous_answer = state['answers'][current_index] or ''
        text_value = st.text_input('Введи ответ', value=previous_answer, key=answer_key)
        state['answers'][current_index] = text_value
        if st.button('Проверить ответ', key=f'check_{selected_topic}_{current_index}', use_container_width=True):
            state['checked'][current_index] = True

    current_answer = state['answers'][current_index]
    if is_answered(current_answer) and state['checked'][current_index]:
        if is_correct(question, current_answer):
            st.success(f'Верно. {question["explanation"]}')
        else:
            st.error(f'Пока неверно. {question["explanation"]}')

    st.markdown('<p class="quiz-muted">Можно переключаться между вопросами в любом порядке.</p>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

    nav1, nav2, nav3 = st.columns(3)
    with nav1:
        if st.button('← Назад', use_container_width=True, disabled=current_index == 0):
            prev_question(selected_topic)
            st.rerun()
    with nav2:
        if st.button('Далее →', use_container_width=True, disabled=current_index == len(questions) - 1):
            next_question(selected_topic)
            st.rerun()
    with nav3:
        if st.button('Завершить тест', use_container_width=True):
            finish_quiz(selected_topic)
            st.rerun()

else:
    total = len(questions)
    st.success(f'Готово. Результат: {score} из {total}')
    if score == total:
        st.write('Идеально. Ты эту тему уже хуячишь очень уверенно.')
    elif score >= total * 0.75:
        st.write('Очень хорошо. Основа уже крепкая.')
    elif score >= total * 0.5:
        st.write('Нормально, но есть дыры — лучше повторить спорные места.')
    else:
        st.write('Неплохо, но тему стоит ещё раз прогнать.')

    if st.button('Пройти заново', type='primary', use_container_width=True):
        restart_quiz(selected_topic)
        st.rerun()

    st.markdown('### Разбор')
    for idx, item in enumerate(questions, start=1):
        ok = is_correct(item, state['answers'][idx - 1])
        icon = '✅' if ok else '❌'
        st.write(f'{icon} **{idx}. {item["prompt"]}**')
        st.caption(item['explanation'])
