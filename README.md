# History Quiz — Streamlit

Небольшое Streamlit-приложение для онлайн-опросника по истории (темы 24–31).

## Локальный запуск

```bash
cd history-quiz
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## Структура

- `streamlit_app.py` — Streamlit-версия приложения
- `data/quiz-data.json` — собранные данные всех тем для Python-приложения
- `source/topicNN.txt` — исходные тексты тем
- `index.html`, `script.js`, `styles.css` — исходная веб-версия

## Деплой

Для Streamlit Community Cloud обычно достаточно репозитория с:
- `streamlit_app.py`
- `requirements.txt`
- папками `data/` и `source/`
