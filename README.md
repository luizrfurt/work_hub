# WorkHub

Aplicação interna para comunicação entre equipes e gerenciamento simples de tarefas.

O MVP inclui:

- autenticação JWT com access token (30 min) e refresh token (30 dias);
- cadastro de usuários somente pelo administrador;
- projetos e membership (somente o administrador adiciona e remove pessoas);
- dashboard para administradores (tarefas ativas, concluídas e por pessoa);
- chat em tempo real por projeto (WebSocket);
- aviso de nova mensagem mesmo fora do projeto (som, badge em Projetos e no card);
- anexos de imagem (JPEG, PNG, WEBP) e TXT;
- lista de tarefas por projeto, com ordem livre e status A fazer / Em andamento / Concluído.

## Stack

- Backend: Python, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (`psycopg`), Pydantic v2, JWT, Argon2
- Frontend: React, Vite, TypeScript, React Router, Axios

## Estrutura

```text
work_hub/
├── backend/                 API FastAPI, migrations e testes
├── frontend/                Interface React
├── docker-compose.dev.yml   PostgreSQL local
├── docker-compose.yml       Stack de produção (VPS)
└── README.md
```

## Configuração

A aplicação **não possui host de banco hardcoded**. Toda conexão sai de variáveis de ambiente.

### Backend

```bash
cd backend
copy .env.example .env
```

Edite o `.env` e defina pelo menos:

```env
APP_ENV=development
DATABASE_URL=postgresql+psycopg://workhub:workhub@localhost:5432/work_hub
JWT_SECRET_KEY=uma-chave-longa-e-secreta
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
UPLOAD_MAX_SIZE_MB=10
UPLOAD_DIRECTORY=./uploads
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800
FRONTEND_URL=http://localhost:5173
```

O arquivo `.env` não deve ser versionado.

A aplicação **não possui host de banco hardcoded**. Em desenvolvimento o Postgres sobe no Docker (`localhost:5432`). Em produção o Compose aponta para o serviço `workhub-db`.

### Frontend

```bash
cd frontend
copy .env.example .env
```

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## PostgreSQL no Docker (desenvolvimento)

```powershell
cd C:\Dev\work_hub
docker compose -f docker-compose.dev.yml up -d
```

Isso sobe o Postgres 16 em `localhost:5432` (usuário/senha `workhub`, banco `work_hub`). Os dados ficam no volume Docker `workhub-dev_pgdata`.

```env
DATABASE_URL=postgresql+psycopg://workhub:workhub@localhost:5432/work_hub
```

Para parar: `docker compose -f docker-compose.dev.yml down` (o volume permanece). Para apagar os dados: `docker compose -f docker-compose.dev.yml down -v`.

## Como iniciar

Fluxo local (Vite + FastAPI na máquina, PostgreSQL no Docker):

1. Subir o Postgres (`docker compose -f docker-compose.dev.yml up -d`)
2. Copiar `.env.example` para `.env` no backend e no frontend
3. Definir `JWT_SECRET_KEY` (o `DATABASE_URL` do example já aponta para o Docker)
4. Instalar dependências
5. Executar migrations
6. Criar o primeiro admin
7. Iniciar FastAPI
8. Iniciar React

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.scripts.create_admin --name "Administrador" --username admin --organization "Minha empresa" --password "sua-senha-segura"
uvicorn main:app --reload --host 0.0.0.0
```

Há **uma única migration** (`001_initial`), com organizações, usuários, projetos, chat e tarefas. Os IDs das tabelas são inteiros autoincrementais, não UUID.

Ao criar o primeiro administrador, o sistema cria automaticamente uma **organização** e coloca esse usuário como administrador dela. Os usuários que ele cadastrar passam a pertencer à mesma organização. Administradores não veem usuários nem projetos de outras organizações.

Se o banco já existia com o schema antigo, recrie o banco (ou apague todas as tabelas, incluindo `alembic_version`) e rode `alembic upgrade head` de novo. Depois recrie o admin. Dados anteriores não são migrados.

O script de admin também aceita entrada interativa se os argumentos forem omitidos.

Não existe senha de administrador hardcoded.

Para redefinir a senha de um usuário (incluindo o admin):

```bash
python -m app.scripts.reset_password --username admin --password "nova-senha-segura"
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host
```

Acesse `http://localhost:5173` nesta máquina.

## Acessar de outro computador

Sim: outro PC na mesma rede pode abrir o frontend, mas **não use `localhost`**. `localhost` só funciona na máquina que está rodando o projeto.

1. Descubra o IPv4 local:

```powershell
ipconfig
```

Exemplo: `192.168.18.32`.

2. Ajuste `frontend/.env` para apontar a API e o WebSocket para esse IP:

```env
VITE_API_URL=http://SEU_IP:8000
VITE_WS_URL=ws://SEU_IP:8000
```

3. Ajuste `backend/.env` para o CORS aceitar a origem do frontend:

```env
FRONTEND_URL=http://localhost:5173,http://SEU_IP:5173
```

Se precisar das duas origens (localhost e IP), separe por vírgula.

4. Reinicie backend e frontend depois de alterar os `.env`.

5. Suba os serviços escutando na rede:

```powershell
cd C:\Dev\work_hub\backend
.\.venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0
```

```powershell
cd C:\Dev\work_hub\frontend
npm run dev -- --host
```

6. No outro PC, abra:

```text
http://SEU_IP:5173
```

Os dois computadores precisam estar na mesma rede. Se não abrir, libere as portas **5173** e **8000** no Firewall do Windows.

## Health check

- `GET /health` — aplicação no ar
- `GET /health/db` — `SELECT 1` no PostgreSQL (sem expor credenciais)

## Testes

Os testes de regras críticas exigem `DATABASE_URL` apontando para PostgreSQL.

Eles criam usuários com prefixo `wh_` (não apagam o banco). Use um banco de desenvolvimento/teste, não produção.

```bash
cd backend
pytest
```

Cobertura mínima:

- login válido e inválido
- refresh válido e inválido
- colaborador não cadastra usuário
- colaborador não adiciona nem remove membros
- admin vê o dashboard geral dos projetos
- colaborador cria projeto
- usuário fora do projeto não acessa mensagens, tarefas ou WebSocket
- não atribuir tarefa a quem não é membro
- colaborador gerencia tarefas do projeto
- admin gerencia tarefa
- ordem livre dos cards
- username único
- alteração da própria senha
- administrador altera senha de outro usuário
- admin cria organização automaticamente
- usuários criados entram na organização do admin
- admin não lista usuários de outra organização

## Perfis

| Código         | Interface      |
| -------------- | -------------- |
| `ADMIN`        | Administrador  |
| `COLLABORATOR` | Colaborador    |

O administrador vê os projetos da **própria organização**, cadastra usuários dessa organização, gerencia membros e acompanha o andamento geral (tarefas ativas, concluídas e por pessoa).

O colaborador vê os projetos dos quais participa e, nesses projetos, pode criar projetos e gerenciar tarefas. Só o administrador adiciona ou remove pessoas. Qualquer pessoa altera a própria senha (e entra de novo em seguida).

## Docker e produção

No desenvolvimento: só o Postgres vai no Docker (`docker-compose.dev.yml`). FastAPI e Vite continuam na máquina.

No VPS: o stack completo (web + api + Postgres) segue o padrão do Clock. Guia: [docs/HOSTINGER.md](docs/HOSTINGER.md).

Resumo em produção: `workhub.zioncor.com.br` → nginx do frontend; `/api` e `/ws` → FastAPI; Postgres só na rede Docker, sem porta pública.
