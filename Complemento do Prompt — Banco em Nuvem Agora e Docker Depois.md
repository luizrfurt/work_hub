# Ajuste de Infraestrutura — Banco em Nuvem Agora, Docker Depois

O WorkHub terá duas fases de infraestrutura.

## Fase atual

Neste primeiro momento:

- o PostgreSQL ficará hospedado em nuvem;
- backend e frontend poderão rodar localmente durante o desenvolvimento;
- o backend deverá conectar no PostgreSQL remoto;
- não quero que a aplicação dependa de Docker para funcionar agora.

## Fase futura

Posteriormente:

- backend;
- frontend;
- PostgreSQL;

deverão poder ser executados utilizando Docker / Docker Compose.

A aplicação deve ser preparada desde agora para essa transição, mas **não é necessário colocar Docker como requisito obrigatório do desenvolvimento atual**.

---

# 1. REGRA PRINCIPAL

A aplicação nunca deve possuir configuração de conexão com banco hardcoded.

Toda conexão deve ser realizada exclusivamente por variável de ambiente.

Utilizar:

```env
DATABASE_URL=
```

Exemplo atual, com PostgreSQL em nuvem:

```env
DATABASE_URL=postgresql+psycopg://usuario:senha@host-remoto:5432/workhub
```

Exemplo futuro, dentro do Docker Compose:

```env
DATABASE_URL=postgresql+psycopg://workhub:senha@postgres:5432/workhub
```

Observe que:

```text
host-remoto
```

é substituído futuramente por:

```text
postgres
```

que será o nome do serviço PostgreSQL dentro da rede Docker.

**Nenhuma alteração de código Python deve ser necessária para essa mudança.**

---

# 2. CONFIGURAÇÃO CENTRALIZADA

Criar configuração centralizada utilizando:

```text
pydantic-settings
```

Exemplo conceitual:

```text
app/core/config.py
```

A aplicação deve carregar:

```env
DATABASE_URL=
JWT_SECRET_KEY=
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
UPLOAD_MAX_SIZE_MB=10
UPLOAD_DIRECTORY=
```

Não acessar `os.getenv()` espalhado pelo projeto.

Centralizar as configurações em uma única classe/settings.

---

# 3. AMBIENTES

Preparar a aplicação para pelo menos:

```text
development
production
```

Adicionar variável:

```env
APP_ENV=development
```

Mas não criar infraestrutura excessivamente complexa de environments.

O objetivo é apenas evitar configurações hardcoded.

---

# 4. .ENV

Criar:

```text
.env.example
```

Exemplo:

```env
APP_ENV=development

DATABASE_URL=postgresql+psycopg://user:password@host:5432/workhub

JWT_SECRET_KEY=change-me

ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

UPLOAD_MAX_SIZE_MB=10
UPLOAD_DIRECTORY=./uploads
```

O arquivo:

```text
.env
```

deve estar no:

```text
.gitignore
```

Nunca versionar:

```text
senha do banco
JWT secret
credenciais de cloud
tokens
```

---

# 5. POSTGRESQL

Utilizar obrigatoriamente PostgreSQL.

Não criar fallback automático para:

```text
SQLite
```

Quero que desenvolvimento e produção utilizem o mesmo tipo de banco para reduzir divergências.

Driver:

```text
psycopg
```

Preferencialmente:

```text
psycopg[binary]
```

para simplificar o ambiente de desenvolvimento.

---

# 6. SQLALCHEMY

Utilizar:

```text
SQLAlchemy 2.x
```

A conexão deve ser criada a partir exclusivamente de:

```text
settings.database_url
```

Nunca definir:

```python
host = "localhost"
port = 5432
```

diretamente no código.

---

# 7. POOL DE CONEXÕES

Como o banco inicialmente será remoto, configurar corretamente o pool do SQLAlchemy.

Não abrir uma nova conexão PostgreSQL manualmente para cada chamada.

Utilizar pool do SQLAlchemy.

Configuração inicial razoável:

```text
pool_pre_ping=True
```

para validar conexões antes do uso.

Evitar valores exagerados de:

```text
pool_size
max_overflow
```

O banco em nuvem pode possuir limite pequeno de conexões.

Os valores devem poder ser configurados por ambiente futuramente.

Adicionar opcionalmente:

```env
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800
```

Valores são configurações iniciais, não regras absolutas.

---

# 8. CONEXÃO SSL

Como o PostgreSQL estará em nuvem, considerar que o provedor poderá exigir SSL.

A `DATABASE_URL` deve aceitar parâmetros como:

```text
sslmode=require
```

quando necessário.

Exemplo:

```env
DATABASE_URL=postgresql+psycopg://user:password@host:5432/workhub?sslmode=require
```

Não desabilitar SSL programaticamente.

A aplicação deve respeitar as opções contidas na URL de conexão.

---

# 9. ALEMBIC

Toda estrutura do banco deve ser gerenciada por:

```text
Alembic
```

Criar migrations para:

```text
users
refresh_tokens
groups
group_members
messages
message_attachments
tasks
```

O Alembic também deve utilizar:

```text
DATABASE_URL
```

da configuração da aplicação.

Não duplicar URL do banco em:

```text
alembic.ini
```

com credenciais reais.

Preferencialmente, no:

```text
alembic/env.py
```

carregar a URL a partir dos settings.

---

# 10. NÃO CRIAR TABELAS AUTOMATICAMENTE

Não utilizar:

```python
Base.metadata.create_all()
```

durante inicialização da aplicação.

O processo correto será:

```text
configurar DATABASE_URL
        ↓
executar Alembic
        ↓
iniciar aplicação
```

Exemplo:

```bash
alembic upgrade head
```

---

# 11. BANCO REMOTO NO DESENVOLVIMENTO

Durante a fase atual, o fluxo esperado será:

```text
Máquina do desenvolvedor
│
├── React/Vite
│
├── FastAPI
│
└──────────────┐
               │ TLS / Internet
               ▼
       PostgreSQL em nuvem
```

Portanto, garantir que:

- nenhum código suponha que PostgreSQL esteja em `localhost`;
- nenhuma migration dependa de Docker;
- nenhum startup dependa da existência de container;
- o host seja totalmente definido pela `DATABASE_URL`.

---

# 12. PREPARAÇÃO PARA DOCKER

Mesmo sem Docker obrigatório agora, organizar o projeto de forma compatível com containerização futura.

Evitar:

```text
paths absolutos da máquina
dependência de localhost
dependência de arquivos fora do projeto
estado permanente dentro do processo
configuração específica de Windows
```

Arquivos enviados localmente devem utilizar diretório configurável:

```env
UPLOAD_DIRECTORY=
```

Isso permitirá posteriormente montar um Docker Volume.

---

# 13. LOCALHOST

Regra importante:

Dentro de Docker:

```text
localhost
```

significa o próprio container.

Portanto, não utilizar `localhost` hardcoded para comunicação entre serviços.

Futuramente o Docker Compose poderá possuir:

```yaml
services:

  postgres:
    ...

  backend:
    ...

  frontend:
    ...
```

O backend utilizará:

```text
postgres
```

como hostname do banco através da `DATABASE_URL`.

---

# 14. DOCKER FUTURO

Estruturar o projeto para futuramente adicionar:

```text
backend/Dockerfile
frontend/Dockerfile
docker-compose.yml
```

O futuro Docker Compose deverá conceitualmente suportar:

```text
frontend
backend
postgres
```

e eventualmente:

```text
reverse proxy
```

Não implementar componentes adicionais desnecessários agora.

---

# 15. POSTGRESQL DOCKER FUTURO

Quando migrarmos do banco em nuvem para PostgreSQL dentro de Docker, a alteração deverá ser apenas de configuração.

Antes:

```env
DATABASE_URL=postgresql+psycopg://user:password@cloud-host:5432/workhub
```

Depois:

```env
DATABASE_URL=postgresql+psycopg://workhub:password@postgres:5432/workhub
```

O código da aplicação deve continuar exatamente o mesmo.

---

# 16. MIGRAÇÃO DO BANCO FUTURAMENTE

Não assumir que migrar para Docker significa recriar dados.

Quando chegar essa etapa, deverá ser possível realizar:

```text
PostgreSQL Cloud
       ↓
pg_dump
       ↓
PostgreSQL Docker
       ↓
pg_restore
```

As migrations Alembic continuarão representando a estrutura oficial do banco.

---

# 17. HEALTH CHECK

Criar endpoint simples:

```http
GET /health
```

Resposta da aplicação saudável:

```json
{
  "status": "ok"
}
```

Criar também, se fizer sentido dentro da arquitetura:

```http
GET /health/db
```

que verifique uma operação mínima no PostgreSQL.

Exemplo:

```sql
SELECT 1
```

Não retornar:

```text
DATABASE_URL
senha
host sensível
credenciais
stack trace
```

em caso de erro.

---

# 18. STARTUP

Não fazer migrations automaticamente no startup por padrão.

Fluxo recomendado:

```text
alembic upgrade head

uvicorn main:app
```

Futuramente, no Docker/deploy, poderemos decidir explicitamente se migrations serão executadas:

- por comando de deploy;
- entrypoint;
- job separado.

Não acoplar isso agora à inicialização do FastAPI.

---

# 19. README

Documentar no README duas formas de utilização.

## Atualmente

```text
1. Criar PostgreSQL na nuvem
2. Copiar .env.example para .env
3. Definir DATABASE_URL
4. Instalar dependências
5. Executar migrations
6. Criar primeiro admin
7. Iniciar FastAPI
8. Iniciar React
```

Exemplo:

```bash
alembic upgrade head
python -m app.scripts.create_admin
uvicorn main:app --reload
```

---

## Futuramente

Adicionar seção:

```text
Docker — planejado
```

Explicando que a aplicação já utiliza configuração externa e poderá ser containerizada sem alteração das regras de negócio.

Não é necessário implementar Docker completo nesta fase, salvo se já houver arquivos Docker no projeto.

---

# 20. CRITÉRIO ARQUITETURAL

A seguinte troca deve funcionar sem alteração de código:

```text
PostgreSQL Cloud
       ↓
PostgreSQL local
       ↓
PostgreSQL Docker
       ↓
PostgreSQL gerenciado em produção
```

Alterando apenas:

```text
DATABASE_URL
```

e demais variáveis específicas de infraestrutura.

Toda a aplicação deve seguir o princípio:

```text
configuração pertence ao ambiente
código pertence à aplicação
```

---

# 21. IMPORTANTE PARA O CURSOR

Antes de implementar:

1. Leia todo o projeto.
2. Verifique se já existe configuração de banco.
3. Verifique se já existe `.env`.
4. Verifique se SQLAlchemy já está configurado.
5. Verifique se Alembic já está configurado.
6. Preserve a arquitetura existente se ela estiver correta.
7. Não refatore módulos não relacionados.
8. Não introduza Docker como dependência obrigatória neste momento.
9. Não hardcode credenciais ou hosts.
10. Faça apenas as alterações necessárias para garantir portabilidade entre PostgreSQL remoto e PostgreSQL via Docker.

Ao finalizar, informe:

- arquivos criados;
- arquivos alterados;
- variáveis de ambiente adicionadas;
- configuração de SQLAlchemy utilizada;
- configuração de pool;
- configuração do Alembic;
- migrations criadas;
- como conectar no PostgreSQL em nuvem agora;
- quais pontos já estão preparados para Docker futuramente.