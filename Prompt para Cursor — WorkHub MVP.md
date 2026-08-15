# WorkHub — MVP

Quero que você atue como um **engenheiro de software sênior e arquiteto full stack**, responsável por estruturar e implementar uma aplicação web chamada **WorkHub**.

O objetivo é criar rapidamente um **MVP funcional**, simples e utilizável, inspirado conceitualmente no Slack e Trello, porém contendo inicialmente apenas duas funcionalidades principais:

1. **Chat por grupo de trabalho**
2. **Lista de tarefas por grupo de trabalho**

Não quero uma aplicação excessivamente complexa neste momento.

Priorize:

- simplicidade;
- funcionamento;
- organização;
- segurança básica adequada;
- código legível;
- arquitetura que permita evolução futura;
- baixo acoplamento;
- ausência de funcionalidades desnecessárias.

---

# 1. REGRA PRINCIPAL DE EXECUÇÃO

Antes de implementar qualquer coisa:

1. Leia todo o projeto existente.
2. Leia todos os arquivos `.md`, caso existam.
3. Analise a estrutura atual.
4. Identifique padrões arquiteturais já existentes.
5. Preserve funcionalidades existentes.
6. Não refatore código que não precise ser alterado.
7. Não altere arquivos sem necessidade.
8. Não introduza abstrações desnecessárias.
9. Não implemente funcionalidades que não estejam descritas neste documento.
10. Evite regressões.

Se o projeto já possuir estrutura definida, adapte a implementação à arquitetura existente em vez de recriar tudo.

Caso o projeto esteja vazio, utilize a arquitetura sugerida neste documento.

---

# 2. NOME DA APLICAÇÃO

**WorkHub**

Aplicação interna para comunicação entre equipes e gerenciamento simples de tarefas.

---

# 3. OBJETIVO DO MVP

Permitir que um administrador:

- cadastre usuários;
- crie grupos de trabalho;
- adicione usuários aos grupos;
- converse com os integrantes;
- compartilhe arquivos;
- crie tarefas;
- atribua tarefas aos integrantes.

Permitir que colaboradores:

- façam login;
- vejam os grupos aos quais pertencem;
- conversem nesses grupos;
- acessem tarefas;
- atualizem tarefas conforme permissões definidas;
- façam logout.

---

# 4. PERFIS DE USUÁRIO

Inicialmente existirão apenas dois papéis:

## ADMIN

Administrador global da plataforma.

Pode:

- fazer login;
- fazer logout;
- renovar autenticação;
- cadastrar usuários;
- visualizar usuários;
- criar grupos;
- adicionar usuários aos grupos;
- remover usuários dos grupos;
- visualizar todos os grupos;
- participar das conversas;
- enviar mensagens;
- anexar arquivos;
- criar tarefas;
- editar tarefas;
- atribuir tarefas;
- alterar status das tarefas.

---

## COLLABORATOR

Usuário comum.

Pode:

- fazer login;
- fazer logout;
- renovar autenticação;
- visualizar somente grupos dos quais participa;
- acessar o chat desses grupos;
- enviar mensagens;
- anexar arquivos;
- visualizar tarefas dos grupos;
- alterar o status das tarefas conforme regras abaixo.

Não pode:

- criar usuários;
- criar grupos;
- gerenciar membros globalmente.

No código, utilize nomes técnicos em inglês.

Exemplo:

```text
ADMIN
COLLABORATOR
```

Na interface, utilize:

```text
Administrador
Colaborador
```

---

# 5. AUTENTICAÇÃO

Backend utilizando:

- FastAPI
- JWT

Implementar dois tokens.

## Access Token

Expiração:

```text
30 minutos
```

Deve ser utilizado para autenticar as requisições.

---

## Refresh Token

Expiração:

```text
30 dias
```

Criar rota específica de refresh.

Exemplo:

```http
POST /auth/refresh
```

O frontend deve utilizar o refresh token para evitar logout constante do usuário.

Fluxo esperado:

```text
Login
 ↓
Access Token — 30 min
Refresh Token — 30 dias
 ↓
Access expira
 ↓
Frontend solicita /auth/refresh
 ↓
Novo Access Token
 ↓
Sessão continua
```

Se o refresh token estiver inválido ou expirado:

```text
usuário deve voltar para a tela de login
```

---

# 6. SENHAS

Nunca salvar senha em texto puro.

Utilizar hashing seguro.

Preferência:

```text
Argon2
```

Biblioteca sugerida:

```text
pwdlib[argon2]
```

O administrador define inicialmente:

```text
username
password
```

para cada usuário.

---

# 7. LOGIN

Criar tela:

```text
/login
```

Campos:

```text
Usuário
Senha
```

Botão:

```text
Entrar
```

A mesma tela deverá autenticar:

- ADMIN
- COLLABORATOR

O backend determina o papel do usuário.

---

# 8. LOGOUT

Disponibilizar logout na interface.

Criar rota:

```http
POST /auth/logout
```

O logout deve invalidar/remover os dados da sessão utilizados pelo frontend.

Se houver persistência ou rotação de refresh tokens, garantir que o refresh correspondente também seja invalidado.

---

# 9. USUÁRIOS

O administrador precisa cadastrar usuários.

Dados mínimos:

```text
id
username
name
password_hash
role
is_active
created_at
updated_at
```

O campo:

```text
username
```

deve ser único.

Não implementar neste MVP:

- cadastro público;
- recuperação de senha;
- confirmação por e-mail;
- autenticação social;
- MFA.

---

# 10. DASHBOARD

Após autenticação, direcionar para:

```text
/dashboard
```

O dashboard deve exibir os grupos de trabalho.

Exemplo visual conceitual:

```text
WorkHub

Meus grupos

[ Desenvolvimento ]
[ Financeiro ]
[ Comercial ]
[ Diretoria ]
```

O ADMIN visualiza todos os grupos.

O COLLABORATOR visualiza somente os grupos aos quais pertence.

---

# 11. CRIAÇÃO DE GRUPOS

Somente ADMIN pode criar grupos.

Dados mínimos:

```text
id
name
description
created_by
created_at
updated_at
```

Exemplo:

```text
Nome:
Desenvolvimento

Descrição:
Equipe responsável pelo desenvolvimento dos sistemas internos.
```

---

# 12. MEMBROS DOS GRUPOS

Um grupo possui vários usuários.

Um usuário pode participar de vários grupos.

Relacionamento:

```text
User
 N
 |
 |
 N
Group
```

Criar estrutura intermediária como:

```text
group_members
```

Contendo pelo menos:

```text
group_id
user_id
joined_at
```

O ADMIN pode:

```text
adicionar usuário ao grupo
remover usuário do grupo
```

---

# 13. ACESSO AO GRUPO

Ao clicar em um grupo no dashboard:

```text
/group/:id
```

Deve abrir o grupo.

A tela terá duas abas:

```text
[ Conversa ] [ To Do ]
```

Por padrão:

```text
Conversa
```

deve estar selecionada.

---

# 14. ABA CONVERSA

Criar um chat simples por grupo.

Cada grupo possui seu próprio histórico.

Uma mensagem precisa conter:

```text
id
group_id
user_id
content
created_at
```

Exibir:

```text
nome do usuário
mensagem
horário/data
```

Exemplo:

```text
Gustavo
Precisamos finalizar essa atividade hoje.
14:32
```

---

# 15. CHAT EM TEMPO REAL

Como se trata de chat, implementar comunicação em tempo real.

Preferencialmente:

```text
WebSocket
```

no FastAPI.

Fluxo:

```text
usuário entra no grupo
        ↓
frontend conecta ao WebSocket daquele grupo
        ↓
usuário envia mensagem
        ↓
backend salva no PostgreSQL
        ↓
backend transmite aos usuários conectados
```

A persistência da mensagem deve acontecer antes ou de forma consistente com sua distribuição.

Não depender apenas do WebSocket para guardar mensagens.

O banco é a fonte de verdade.

---

# 16. HISTÓRICO DO CHAT

Ao abrir um grupo:

```http
GET /groups/{group_id}/messages
```

Retornar histórico.

Implementar paginação simples.

Exemplo:

```text
limit
offset
```

ou cursor pagination, caso a arquitetura existente já utilize.

Evitar carregar milhares de mensagens de uma única vez.

---

# 17. ANEXOS

O chat deve permitir:

```text
imagens
arquivos .txt
```

Não implementar outros formatos inicialmente.

Tipos inicialmente aceitos:

```text
image/jpeg
image/png
image/webp
text/plain
```

Definir limite de tamanho configurável por variável de ambiente.

Sugestão inicial:

```text
10 MB
```

Não armazenar arquivo binário dentro do PostgreSQL.

Criar uma abstração de storage.

Para ambiente local, pode ser utilizado armazenamento local.

Estruture de forma que futuramente seja possível substituir por:

```text
S3
Cloudflare R2
MinIO
```

sem alterar regras de negócio.

Persistir apenas metadados.

Exemplo:

```text
id
message_id
original_name
storage_key
mime_type
size
created_at
```

Validar extensão e MIME type.

Não confiar apenas na extensão informada pelo cliente.

---

# 18. ABA TO DO

Cada grupo possui sua própria lista de tarefas.

Uma tarefa contém:

```text
id
group_id
title
description
due_date
assigned_user_id
status
created_by
created_at
updated_at
```

Campos obrigatórios:

```text
title
assigned_user_id
```

Campos opcionais:

```text
description
due_date
```

---

# 19. STATUS DAS TAREFAS

Inicialmente utilizar apenas:

```text
TODO
IN_PROGRESS
DONE
```

Na interface:

```text
A fazer
Em andamento
Concluído
```

Não criar workflow complexo.

---

# 20. VISUALIZAÇÃO DO TO DO

Não precisa implementar um Trello completo.

Criar inicialmente uma interface simples.

Pode ser em cards organizados por status:

```text
A FAZER

[ Corrigir documentação ]
Responsável: Gabriel
Prazo: 20/08/2026
```

```text
EM ANDAMENTO

[ Criar nova tela ]
Responsável: Ariel
Prazo: 21/08/2026
```

```text
CONCLUÍDO

[ Criar autenticação ]
Responsável: Gabriel
```

---

# 21. RESPONSÁVEL DA TAREFA

O responsável precisa obrigatoriamente participar do grupo.

Não permitir:

```text
atribuir tarefa a usuário que não pertence ao grupo
```

Essa validação deve existir no backend.

Nunca confiar somente na validação do frontend.

---

# 22. CRIAÇÃO DE TAREFA

Permitir criação dentro da aba:

```text
To Do
```

Campos:

```text
Título
Descrição
Prazo
Responsável
```

O campo responsável deve listar apenas membros daquele grupo.

---

# 23. EDIÇÃO DE TAREFAS

Neste MVP:

ADMIN pode editar:

```text
título
descrição
prazo
responsável
status
```

COLLABORATOR pode:

```text
visualizar tarefas do grupo
alterar o status de tarefas atribuídas a ele
```

Não permitir que um colaborador altere tarefas de outro colaborador.

Centralizar essa regra no backend.

---

# 24. REGRAS DE AUTORIZAÇÃO

Nunca confiar apenas no frontend.

Toda autorização deve ser validada no backend.

Exemplos:

Um usuário não pode acessar:

```text
GET /groups/123
```

se não fizer parte do grupo.

Um usuário não pode utilizar:

```text
WebSocket /groups/123/chat
```

se não fizer parte do grupo.

Um usuário não pode consultar mensagens de grupo que não pertence.

Um usuário não pode consultar tarefas de grupo que não pertence.

Somente ADMIN pode:

```text
criar grupos
gerenciar membros
cadastrar usuários
```

---

# 25. BACKEND

Utilizar:

```text
Python
FastAPI
SQLAlchemy 2
PostgreSQL
Alembic
Pydantic v2
JWT
Argon2
WebSocket
```

Preferencialmente:

```text
psycopg
```

em vez de dependências PostgreSQL antigas.

---

# 26. ARQUITETURA DO BACKEND

Caso não exista arquitetura no projeto, utilizar algo próximo de:

```text
backend/
│
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── groups.py
│   │   │   ├── messages.py
│   │   │   ├── tasks.py
│   │   │   └── websocket.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── permissions.py
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── group.py
│   │   ├── group_member.py
│   │   ├── message.py
│   │   ├── attachment.py
│   │   └── task.py
│   │
│   ├── schemas/
│   │
│   ├── repositories/
│   │
│   ├── services/
│   │
│   ├── database/
│   │   ├── connection.py
│   │   └── base.py
│   │
│   └── storage/
│
├── alembic/
│
├── main.py
├── requirements.txt
├── .env.example
└── README.md
```

Separar corretamente:

```text
route/controller
service
repository
model
schema
```

Não colocar regra de negócio diretamente nas rotas.

---

# 27. BANCO DE DADOS

Utilizar:

```text
PostgreSQL
```

Entidades mínimas:

```text
users
groups
group_members
messages
message_attachments
tasks
refresh_tokens
```

---

# 28. RELACIONAMENTOS

Estrutura conceitual:

```text
User
 |
 | N:N
 |
Group
 |
 +---- Messages
 |
 +---- Tasks
 |
 +---- Members
```

Uma mensagem:

```text
pertence a um grupo
pertence a um usuário
```

Uma tarefa:

```text
pertence a um grupo
possui um criador
pode possuir um responsável
```

---

# 29. ÍNDICES IMPORTANTES

Criar índices pelo menos para:

```text
users.username

group_members.group_id
group_members.user_id

messages.group_id
messages.created_at

tasks.group_id
tasks.assigned_user_id
tasks.status
tasks.due_date
```

Criar constraint única para:

```text
group_members(group_id, user_id)
```

---

# 30. TRANSAÇÕES E CONSISTÊNCIA

As regras críticas precisam ser protegidas no backend.

Exemplo:

Ao atribuir uma tarefa:

```text
1. validar grupo
2. validar usuário
3. validar membership
4. criar/atualizar tarefa
5. commit
```

Não permitir estado inconsistente em caso de erro intermediário.

---

# 31. FRONTEND

Utilizar:

```text
React
Vite
TypeScript
React Router
Axios
```

Sugestão de estrutura:

```text
frontend/
│
├── src/
│   ├── api/
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   │   ├── Login/
│   │   ├── Dashboard/
│   │   └── Group/
│   │
│   ├── services/
│   ├── types/
│   └── utils/
```

---

# 32. CLIENT HTTP

Criar uma única instância Axios.

Centralizar:

```text
baseURL
headers
autenticação
refresh
tratamento de erro
```

Não espalhar chamadas HTTP aleatoriamente pelos componentes.

Implementar interceptor de resposta.

Quando API retornar:

```text
401
```

por access token expirado:

```text
1. tentar refresh uma vez
2. obter novo access token
3. repetir request original
```

Evitar loop infinito de refresh.

Também evitar múltiplas requisições simultâneas disparando vários refreshes ao mesmo tempo.

Implementar mecanismo de fila/single-flight para refresh concorrente.

---

# 33. ROTAS DO FRONTEND

Criar pelo menos:

```text
/login

/dashboard

/groups/:groupId
```

Rotas autenticadas devem possuir proteção.

Usuário não autenticado:

```text
→ /login
```

---

# 34. INTERFACE DO GRUPO

Estrutura:

```text
------------------------------------------------
WorkHub
------------------------------------------------

Grupo: Desenvolvimento

[ Conversa ] [ To Do ]

------------------------------------------------
conteúdo
------------------------------------------------
```

---

# 35. CHAT NO FRONTEND

Na aba Conversa:

```text
histórico
campo de mensagem
botão enviar
botão anexar
```

O histórico deve ser atualizado em tempo real pelo WebSocket.

Ao receber mensagem:

```text
não recarregar página inteira
```

Atualizar somente o estado local do chat.

---

# 36. RECONEXÃO WEBSOCKET

Implementar reconexão simples.

Se a conexão cair:

```text
tentar reconectar
```

com pequeno backoff.

Não criar infraestrutura exageradamente complexa.

---

# 37. SEGURANÇA DO WEBSOCKET

O backend precisa autenticar a conexão WebSocket.

Além disso:

```text
validar membership do grupo
```

antes de adicionar a conexão à sala.

Nunca confiar no:

```text
groupId
```

enviado pelo frontend.

---

# 38. VARIÁVEIS DE AMBIENTE

Criar `.env.example`.

Backend:

```env
DATABASE_URL=

JWT_SECRET_KEY=

ACCESS_TOKEN_EXPIRE_MINUTES=30

REFRESH_TOKEN_EXPIRE_DAYS=30

UPLOAD_MAX_SIZE_MB=10

UPLOAD_DIRECTORY=
```

Frontend:

```env
VITE_API_URL=
VITE_WS_URL=
```

Não versionar secrets reais.

---

# 39. MIGRATIONS

Utilizar Alembic.

Não utilizar:

```python
Base.metadata.create_all()
```

como mecanismo principal de produção.

Todas as alterações de schema precisam possuir migration.

---

# 40. PRIMEIRO ADMIN

Como não existe cadastro público, precisamos de um mecanismo simples para criar o primeiro administrador.

Implementar uma das opções:

```text
CLI/script de bootstrap
```

Preferencialmente:

```text
python -m app.scripts.create_admin
```

Solicitando:

```text
nome
username
password
```

ou lendo valores explicitamente informados.

Não criar usuário ADMIN automaticamente com senha hardcoded.

---

# 41. ERROS DA API

Padronizar respostas de erro.

Exemplo:

```json
{
  "message": "Usuário ou senha inválidos."
}
```

Evitar expor:

```text
stack trace
SQL
estrutura interna
detalhes sensíveis
```

No frontend, exibir mensagens legíveis.

---

# 42. VALIDAÇÕES

Implementar pelo menos:

## Usuário

```text
username obrigatório
username único
senha mínima
```

## Grupo

```text
nome obrigatório
```

## Mensagem

Não permitir mensagem totalmente vazia se não houver anexo.

## Anexo

Validar:

```text
tipo
tamanho
```

## Tarefa

```text
título obrigatório
responsável precisa pertencer ao grupo
status válido
```

---

# 43. CONCORRÊNCIA

Considerar situações como:

```text
dois usuários enviando mensagem simultaneamente

várias chamadas recebendo 401 simultaneamente

usuário removido de grupo enquanto está conectado no WebSocket

dois administradores tentando adicionar o mesmo usuário ao grupo
```

Utilizar constraints no banco como última camada de proteção.

Não depender exclusivamente de:

```text
if exists
```

no Python para garantir unicidade.

---

# 44. ESCOPO FORA DO MVP

NÃO implementar agora:

```text
threads
reações
emoji reactions
mensagem privada
DM
menções
status online avançado
typing indicator
áudio
vídeo
chamadas
screen sharing
push notifications
e-mail
kanban drag-and-drop avançado
subtarefas
tags
prioridades
comentários em tarefas
auditoria completa
busca global
editar mensagens
apagar mensagens
multi-tenant
workspaces
integrações externas
SSO
MFA
OAuth
recuperação de senha
cadastro público
```

Essas funcionalidades podem ser adicionadas posteriormente.

Não implemente antecipadamente.

---

# 45. API ESPERADA

Estruture aproximadamente:

## Auth

```http
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

## Users

```http
POST /users
GET  /users
GET  /users/{id}
```

Somente ADMIN para gerenciamento.

## Groups

```http
POST /groups
GET  /groups
GET  /groups/{id}
POST /groups/{id}/members
DELETE /groups/{id}/members/{user_id}
GET /groups/{id}/members
```

## Messages

```http
GET /groups/{id}/messages
POST /groups/{id}/messages
```

Se o envio principal for pelo WebSocket, manter a arquitetura consistente e evitar duplicar lógica de negócio.

## Attachments

```http
POST /groups/{id}/attachments
```

ou fluxo equivalente bem estruturado.

## Tasks

```http
GET    /groups/{id}/tasks
POST   /groups/{id}/tasks
GET    /groups/{id}/tasks/{task_id}
PATCH  /groups/{id}/tasks/{task_id}
```

## WebSocket

Algo conceitualmente semelhante:

```text
WS /ws/groups/{group_id}
```

---

# 46. TESTES

Criar testes principalmente para regras críticas.

No mínimo:

```text
login válido

login inválido

refresh válido

refresh expirado/inválido

colaborador não cria grupo

usuário fora do grupo não acessa mensagens

usuário fora do grupo não acessa tarefas

usuário fora do grupo não conecta no WebSocket

não atribuir tarefa para usuário fora do grupo

colaborador não altera tarefa de outro usuário

admin consegue gerenciar tarefa

username único
```

Não é necessário buscar cobertura de 100%.

Priorizar regras de negócio e autorização.

---

# 47. DOCUMENTAÇÃO

Criar ou atualizar:

```text
README.md
```

Com:

```text
descrição do WorkHub
stack
estrutura
configuração
variáveis de ambiente
como iniciar backend
como iniciar frontend
como rodar migrations
como criar primeiro admin
como executar testes
```

Se o projeto possuir:

```text
docs/
```

respeitar a organização existente.

---

# 48. EXPERIÊNCIA VISUAL

Quero uma interface:

```text
simples
moderna
limpa
corporativa
responsiva
```

Não quero gastar muito tempo inicialmente com design sofisticado.

Priorizar usabilidade.

Estrutura conceitual do dashboard:

```text
---------------------------------------------------
WorkHub                         Usuário | Sair
---------------------------------------------------

Grupos de trabalho

+--------------------------------+
| Desenvolvimento                |
| 5 membros                      |
+--------------------------------+

+--------------------------------+
| Financeiro                     |
| 3 membros                      |
+--------------------------------+
```

Para ADMIN:

```text
[ + Novo grupo ]
```

---

# 49. ORDEM DE IMPLEMENTAÇÃO

Execute em etapas.

## Etapa 1

Estrutura do backend.

## Etapa 2

Banco e migrations.

## Etapa 3

Usuários.

## Etapa 4

Autenticação JWT + refresh.

## Etapa 5

Grupos e memberships.

## Etapa 6

Tarefas.

## Etapa 7

Mensagens.

## Etapa 8

WebSocket.

## Etapa 9

Upload de arquivos.

## Etapa 10

Frontend e autenticação.

## Etapa 11

Dashboard.

## Etapa 12

Tela do grupo.

## Etapa 13

Chat.

## Etapa 14

To Do.

## Etapa 15

Tratamento de erros e testes.

---

# 50. CRITÉRIO DE CONCLUSÃO DO MVP

O MVP estará funcional quando for possível executar o fluxo:

```text
ADMIN faz login
        ↓
cria usuário
        ↓
cria grupo
        ↓
adiciona usuários
        ↓
usuários fazem login
        ↓
visualizam seus grupos
        ↓
entram em um grupo
        ↓
conversam em tempo real
        ↓
enviam imagens/TXT
        ↓
acessam aba To Do
        ↓
ADMIN cria tarefa
        ↓
atribui a um usuário
        ↓
usuário altera status
        ↓
sessão continua funcionando através do refresh token
        ↓
usuário pode fazer logout
```

---

# 51. DECISÕES DE ENGENHARIA

Durante a implementação:

- priorize simplicidade;
- mantenha responsabilidades separadas;
- mantenha regras de autorização no backend;
- não confie em validações exclusivamente no frontend;
- considere concorrência;
- considere integridade do banco;
- trate erros;
- evite N+1 queries;
- evite queries desnecessárias;
- utilize paginação onde houver crescimento potencial;
- não carregue todo o histórico do chat de uma vez;
- não armazene arquivos binários no PostgreSQL;
- não coloque secrets no código;
- não crie abstrações sem necessidade real.

---

# 52. ENTREGA

Antes de começar a alterar arquivos, apresente:

```text
1. diagnóstico da estrutura atual;
2. arquitetura que será utilizada;
3. entidades identificadas;
4. relacionamentos;
5. regras de negócio;
6. riscos técnicos;
7. arquivos que pretende criar ou alterar;
8. ordem de implementação.
```

Depois disso, faça a implementação progressivamente.

Após cada etapa relevante:

```text
- informe o que foi implementado;
- informe os arquivos alterados;
- informe migrations criadas;
- informe testes executados;
- informe problemas encontrados;
- informe pendências.
```

Não considere uma implementação concluída apenas porque o código foi escrito.

Sempre valide:

```text
imports
tipagem
migrations
testes
integração entre camadas
rotas
permissões
fluxo de autenticação
```

O resultado final deve ser um **WorkHub MVP simples, funcional e pronto para utilização real**, sem tentar antecipar funcionalidades de uma plataforma completa como Slack ou Trello.