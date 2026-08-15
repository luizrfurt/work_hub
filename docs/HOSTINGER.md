# Deploy em produção (Hostinger / Docker + Caddy)

Guia para subir o **WorkHub** no VPS Zioncor, no mesmo padrão do Clock (`bufalo_face_embed`): Compose na rede do Caddy, HTTPS automático, sem portas públicas no host.

O site público é um único domínio:

| Função | URL | Container |
|--------|-----|-----------|
| Interface | `https://workhub.zioncor.com.br` | `workhub-web:80` (nginx + build Vite) |
| API REST | `https://workhub.zioncor.com.br/api/...` | `workhub-api:8000` (Caddy remove o prefixo `/api`) |
| WebSocket | `wss://workhub.zioncor.com.br/ws/...` | `workhub-api:8000` |
| Postgres | **não** público | `workhub-db` |

- Código no servidor: `/opt/work_hub`
- Rede Docker externa (Caddy): `zioncor-prod_zioncor`
No desenvolvimento, o Postgres sobe com `docker-compose.dev.yml` em `localhost:5432`. No VPS ele entra neste Compose, sem porta pública.

---

## 1) Pré-requisitos

- SSH no VPS
- Docker + Docker Compose
- Rede `zioncor-prod_zioncor` já existente (Caddy do Zioncor)
- DNS `workhub.zioncor.com.br` apontando para o VPS

```bash
curl -4 ifconfig.me
```

Use esse valor no lugar de `<IP_DO_VPS>`.

---

## 2) DNS

Na zona do domínio (ex.: Locaweb), um registro A:

```text
workhub      A    <IP_DO_VPS>
```

Conferir:

```bash
nslookup workhub.zioncor.com.br
```

Não é necessário um subdomínio `workhub-api`: a API entra pelo mesmo host em `/api` e `/ws`.

---

## 3) Primeiro deploy — código e `.env`

```bash
mkdir -p /opt/work_hub
cd /opt/work_hub
git clone https://github.com/luizrfurt/work_hub.git .
cp backend/.env.example backend/.env
nano backend/.env
chmod 600 backend/.env
```

O Compose **sobrescreve** `DATABASE_URL`, `UPLOAD_DIRECTORY` e `FRONTEND_URL` em runtime para o Postgres interno e o domínio de produção. O `.env` ainda precisa do JWT.

Modelo (troque o secret):

```env
APP_ENV=production

DATABASE_URL=postgresql+psycopg://workhub:workhub@workhub-db:5432/work_hub

JWT_SECRET_KEY=<SECRET_KEY_LONGA_E_ALEATORIA>

ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

UPLOAD_MAX_SIZE_MB=10
UPLOAD_DIRECTORY=/app/uploads

DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800

FRONTEND_URL=https://workhub.zioncor.com.br
```

| Variável | Observação |
|----------|------------|
| `JWT_SECRET_KEY` | String longa e aleatória. Nunca use `change-me`. |
| `backend/.env` | `chmod 600`. **Nunca** commit no Git. |

Default do Postgres no Compose: usuário/senha `workhub`, banco `work_hub`. São valores de bootstrap — troque a senha em produção se o VPS for compartilhado.

---

## 4) Subir stack + migration + admin

```bash
cd /opt/work_hub
docker compose up -d --build
docker compose ps
```

Espere o Postgres ficar healthy. Depois:

```bash
docker compose exec workhub-api alembic upgrade head
docker compose exec -it workhub-api python -m app.scripts.create_admin
```

Informe nome, usuário, senha e (opcional) o nome da organização. Se omitir a organização, o sistema usa `Organização de <nome>`.

Isso cria a **organização** e o administrador dela. Os usuários que esse admin cadastrar na interface entram na mesma organização.

Health interno:

```bash
docker exec workhub-api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read())"
```

---

## 5) Caddy (proxy HTTPS)

Edite o Caddyfile do infra Zioncor:

```bash
nano /opt/zioncor/zioncor-infra/caddy/Caddyfile
```

Inclua **um** bloco (não precisa de `workhub-api`):

```
workhub.zioncor.com.br {
        encode gzip

        handle /ws/* {
                reverse_proxy workhub-api:8000
        }

        handle_path /api/* {
                reverse_proxy workhub-api:8000
        }

        handle {
                reverse_proxy workhub-web:80
        }
}
```

`handle_path` remove `/api` antes de encaminhar: `/api/auth/login` chega na API como `/auth/login`.

Recarregue o Caddy:

```bash
cd /opt/zioncor/zioncor-infra
docker compose -f docker-compose.prod.yml --env-file .env.prod exec caddy caddy reload --config /etc/caddy/Caddyfile
```

---

## 6) Verificar se está no ar

```bash
curl -s https://workhub.zioncor.com.br/api/health
curl -sI https://workhub.zioncor.com.br
```

Abra https://workhub.zioncor.com.br e entre com o admin criado no passo 4.

---

## 7) Atualizar depois de mudanças no código

Sem apagar dados:

```bash
cd /opt/work_hub
git pull
docker compose up -d --build
docker compose exec workhub-api alembic upgrade head
```

O schema atual está em **uma única** revision `001_initial` (inclui organizações). Se o banco já existia com o schema antigo, recrie o volume (passo de reset) e rode `alembic upgrade head` de novo.

### Reset completo (perigoso)

Apaga o Postgres e os anexos deste stack.

```bash
cd /opt/work_hub
git pull
docker compose down
docker volume rm workhub_pgdata workhub_uploads
docker compose up -d --build
docker compose exec workhub-api alembic upgrade head
docker compose exec -it workhub-api python -m app.scripts.create_admin
```

---

## 8) DBeaver (PC → Postgres no Docker)

O Postgres **não** fica aberto na internet. No VPS ele escuta só em `127.0.0.1:5434`. O DBeaver no seu PC usa o **túnel SSH embutido**.

No desenvolvimento local (`docker-compose.dev.yml`) o banco já está em `localhost:5432`: conecte direto, **sem** SSH.

### 8.1) No servidor — porta só em localhost

O `docker-compose.yml` de produção publica:

```yaml
    ports:
      - "127.0.0.1:5434:5432"
```

A porta **5434** evita conflito com o Clock (`5433`) e com outro Postgres na `5432` do VPS. Confirme:

```bash
cd /opt/work_hub
docker compose up -d workhub-db
docker port workhub-db
# esperado: 127.0.0.1:5434->5432/tcp
ss -tlnp | grep 5434
```

Teste no próprio servidor:

```bash
docker run --rm --network host postgres:16-alpine \
  psql "postgresql://workhub:workhub@127.0.0.1:5434/work_hub" -c 'SELECT 1'
```

Deve retornar `1`.

### 8.2) No DBeaver (produção via SSH)

Não precisa deixar `ssh -L` aberto no terminal.

Nova conexão → PostgreSQL.

**Aba Principal**

| Campo | Valor |
|--------|--------|
| Host | `127.0.0.1` |
| Port | `5434` |
| Database | `work_hub` |
| User | `workhub` |
| Password | `workhub` (ou a senha que você tiver trocado no Compose) |

Host e porta são os do **servidor** (destino do túnel), não o IP público do VPS.

**Aba SSH** (ative em `+ SSH, SSL, ...` se não aparecer)

| Campo | Valor |
|--------|--------|
| Usar túnel SSH | ligado |
| Host/IP | IP público do VPS |
| Port | `22` |
| User | usuário SSH do VPS (ex.: `root`) |
| Autenticação | Chave pública → arquivo **privado** `C:\Users\<SEU_USUARIO>\.ssh\id_ed25519` (sem `.pub`), **ou** senha SSH |

Clique em **Configuração de túnel de teste** → deve aparecer `Connected!`.

**Aba SSL** → modo `disable`.

Depois: **Testar conexão**.

### 8.3) Fluxo (produção)

```text
DBeaver (PC)
  → SSH → VPS
  → 127.0.0.1:5434 no servidor
  → container workhub-db:5432
```

### 8.4) DBeaver no desenvolvimento local

Sem túnel SSH.

| Campo | Valor |
|--------|--------|
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `work_hub` |
| User / Password | `workhub` / `workhub` |
| SSH | desligado |
| SSL | `disable` |

### 8.5) Problemas comuns

| Sintoma | Causa típica |
|---------|----------------|
| Senha inválida em `127.0.0.1:5432` no VPS | Outro Postgres na 5432; o WorkHub é **5434** |
| “A tentativa de conexão falhou” | Porta `5434` não publicada — `docker compose up -d` depois do `ports` |
| Túnel SSH falha | Chave/senha SSH; teste só o botão de túnel primeiro |
| Host `localhost` no Windows | Prefira `127.0.0.1` (IPv6) |

---

## 9) Segurança (resumo)

- Nunca commitar `backend/.env` nem `JWT_SECRET_KEY`.
- API e web: sem porta publicada no host; só o Caddy na rede Docker.
- Postgres: no máximo `127.0.0.1:<porta>` — nunca `0.0.0.0:5432` na internet.
- Cada `create_admin` cria uma organização isolada. Admins não listam usuários de outras organizações.

---

## Notas operacionais

- Rede: `zioncor-prod_zioncor`
- Volumes: `pgdata`, `uploads`
- Containers: `workhub-db`, `workhub-api`, `workhub-web`
- Setup local de desenvolvimento: [README.md](../README.md)
