# WorkHub backend

API FastAPI do WorkHub.

```bash
copy .env.example .env
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.scripts.create_admin
uvicorn main:app --reload --host 0.0.0.0
```

Consulte o README na raiz do repositório para variáveis de ambiente, PostgreSQL em nuvem e testes.
