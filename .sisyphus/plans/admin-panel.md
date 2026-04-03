# Painel de Administração Completo

## TL;DR
> **Summary**: Substituir a configuração SFTP estática do `.env` por uma configuração dinâmica em SQLite, expor APIs administrativas seguras para settings e usuários, e adicionar uma interface `/admin` separada do navegador de arquivos existente.
> **Deliverables**:
> - Tabela `settings` em SQLite + serviço backend para leitura/escrita em tempo de execução
> - Refatoração do fluxo SFTP para usar settings do banco e responder `503 Storage not configured` quando aplicável
> - Endpoints admin-only em `/api/admin/settings` e `/api/admin/users`
> - Revalidação do usuário autenticado contra o banco em cada request para invalidar sessões obsoletas
> - Navegação frontend com `react-router-dom`, botão `Administration` e painel com seções `Users` e `Server`
> **Effort**: Large
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 → 4 → 5 → 8

## Context
### Original Request
- Implementar um painel de administração completo para a aplicação.
- Migrar host/port/user/password/path do SFTP para SQLite e permitir edição em runtime.
- Criar endpoints protegidos para consultar e atualizar settings do servidor.
- Criar CRUD administrativo de usuários com hashing via `bcryptjs`.
- Separar a interface normal (`FileList`) do painel administrativo (`/admin`).
- Adicionar botão `Administração` no cabeçalho visível apenas para `admin`.
- Preservar tratamento de erros e o padrão visual atual.

### Interview Summary
- O repositório real usa **Fastify + SQLite + React/Vite**, não Express; o plano segue os padrões do código existente.
- Decisões confirmadas pelo usuário:
  - bootstrap de settings **manual**, sem seed/fallback do `.env`
  - proteger o **último admin** contra exclusão ou rebaixamento
  - usar **rota real `/admin`** com router simples
  - **não** criar infraestrutura de testes automatizados neste escopo
- Defaults aplicados pelo planejamento:
  - namespace administrativo em `/api/admin/*`
  - tabela `settings` modelada como **linha singleton tipada**, não key/value
  - `GET /api/admin/settings` retorna `hasPassword`/`isConfigured`, nunca a senha em claro
  - `PUT /api/admin/settings` mantém a senha atual quando `password` vier vazio/omitido
  - autenticação passa a consultar o usuário no banco em todo request e invalida tokens emitidos antes de `users.updated_at`

### Metis Review (gaps addressed)
- Fechado o risco crítico de **JWT obsoleto**: exclusão, rebaixamento e troca de senha precisam invalidar a sessão imediatamente.
- Fechado o risco de **exposição da senha SFTP**: a API só expõe estado derivado (`hasPassword`).
- Fechado o risco de **quebra silenciosa de storage**: serviços SFTP passam a lançar erro tipado quando faltarem settings válidas, e rotas convertem isso em `503`.
- Fechado o risco de **acoplamento excessivo no frontend**: o painel admin fica fora de `FileList`, em árvore própria de componentes.

## Work Objectives
### Core Objective
Entregar um fluxo administrativo completo, seguro e consistente com os padrões atuais do projeto, cobrindo configuração SFTP em runtime, gerenciamento de usuários e navegação dedicada no frontend.

### Deliverables
- `backend/src/services/settings.ts` com schema, leitura pública, leitura SFTP e atualização validada.
- Refatoração de `backend/src/services/sftp.ts` e consumidores para usar settings do banco.
- Endpoints `GET/PUT /api/admin/settings`.
- Endpoints `GET/POST/PUT/DELETE /api/admin/users`.
- Revalidação de sessão no auth plugin + `/api/auth/me` refletindo dados atuais do banco.
- `react-router-dom` integrado ao frontend com rota `/admin` protegida.
- Componentes administrativos separados para server settings e user management.

### Definition of Done (verifiable conditions with commands)
- `cd backend && npm run build` conclui sem erros.
- `cd frontend && npm run build` conclui sem erros.
- Um admin autenticado consegue abrir `/admin`, ver as seções `Users` e `Server`, e retornar para `/`.
- `GET /api/admin/settings` e `PUT /api/admin/settings` funcionam com token de admin e rejeitam viewer com `403`.
- `GET /api/admin/users`, `POST /api/admin/users`, `PUT /api/admin/users/:id` e `DELETE /api/admin/users/:id` funcionam com regras de segurança esperadas.
- Um token emitido antes de alteração/exclusão do usuário passa a ser rejeitado em nova chamada autenticada.
- Rotas dependentes de SFTP retornam `503 { error: "Storage not configured" }` quando host/user/password/path válidos ainda não existirem.

### Must Have
- Manter imports ESM com extensão `.js` no backend.
- Registrar novos serviços/tabelas via `seed.ts` e novas rotas via `backend/src/index.ts`.
- Reusar `requireRole("admin")` como padrão de proteção das rotas administrativas.
- Manter `bcryptjs` como mecanismo de hashing.
- Preservar inline styles no frontend.
- Preservar `FileList` como tela de navegação de arquivos, sem transformá-lo em painel admin.
- Auditar mutações administrativas sem registrar senhas nem hashes.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Não reintroduzir fallback para `config.storage` ou `STORAGE_*` em runtime.
- Não adicionar novos papéis além de `admin` e `viewer`.
- Não criar infraestrutura de testes automatizados, linting ou mudanças em CI neste escopo.
- Não editar Docker Compose/nginx além do que já existe; `docker/nginx.conf` já suporta SPA fallback.
- Não colocar novas rotas admin sob `/api/auth/*`.
- Não adicionar CSS files ou framework visual.
- Não mover a lógica administrativa nova para dentro de `FileList.tsx`.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: **none** — não há framework de testes; validação será por builds, smoke tests HTTP e QA com navegador automatizado.
- QA policy: Cada tarefa inclui cenários happy path e failure path executáveis por agente.
- Token setup for API smoke tests: obter `ADMIN_TOKEN`/`VIEWER_TOKEN` via `POST /api/auth/login` antes de rodar `curl` protegido; quando o viewer ainda não existir, criá-lo pelo fluxo do Task 6.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: fundação de dados/usuários/storage + shell de navegação (`1`, `2`, `4`, `7`)
Wave 2: revalidação auth + superfícies administrativas backend/frontend (`3`, `5`, `6`, `8`)

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1. Settings persistence | — | 4, 5 |
| 2. User service expansion | — | 3, 6 |
| 3. Live auth revalidation | 2 | 5, 6, 8 |
| 4. SFTP runtime settings | 1 | 5, final storage QA |
| 5. Admin settings API | 1, 3, 4 | 8 |
| 6. Admin user API | 2, 3 | 8 |
| 7. Frontend router shell | — | 8 |
| 8. Admin panel UI | 5, 6, 7 | Final verification |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 4 tasks → `unspecified-high` x3, `visual-engineering` x1
- Wave 2 → 4 tasks → `unspecified-high` x3, `visual-engineering` x1
- Final Verification → 4 review tasks in parallel

## TODOs

- [x] 1. Criar persistência de settings SFTP no SQLite

  **What to do**: Criar `backend/src/services/settings.ts` como a fonte de verdade para configuração SFTP em runtime. Definir schema singleton `settings` com colunas `id`, `sftp_host`, `sftp_port`, `sftp_user`, `sftp_password`, `sftp_path`, `updated_at`, usando `id = 1` e defaults seguros (`host/user/password` vazios, `port = 23`, `path = '/home/backups/nvr'`). Exportar tipos explícitos (`StoredSettings`, `PublicSettings`, `SftpSettings`, `UpdateSettingsInput`), erro tipado `StorageNotConfiguredError`, e funções `initSettingsTable()`, `ensureSettingsRow()`, `getSettingsRow()`, `getPublicSettings()`, `getSftpSettingsOrThrow()` e `saveSettings()` com `UPSERT` + `updated_at = datetime('now')`. Atualizar `backend/src/seed.ts` para inicializar a tabela e garantir a linha singleton sem semear credenciais do `.env`.
  **Must NOT do**: Não usar key/value genérico; não copiar `STORAGE_*` do `.env`; não expor `sftp_password` fora do serviço; não alterar deploy/Docker.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: envolve schema SQLite, serviço novo e integração de bootstrap.
  - Skills: `[]` — o padrão existente de Fastify/SQLite é suficiente.
  - Omitted: [`frontend-ui-ux`] — tarefa 100% backend.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `backend/src/services/users.ts:17-28` — modelo atual de `CREATE TABLE IF NOT EXISTS` em serviço.
  - Pattern: `backend/src/services/audit.ts:14-40` — estrutura de serviço simples sobre `db` com helpers de leitura/escrita.
  - Pattern: `backend/src/seed.ts:9-17` — ponto único de inicialização de tabelas/seed antes do servidor subir.
  - API/Type: `backend/src/db.ts:11-15` — singleton SQLite compartilhado com WAL e foreign keys.
  - Existing defaults: `backend/src/config.ts:22-28` — origem dos defaults atuais de `port` e `path`; usar apenas como referência de valores, não como fallback runtime.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd backend && npm run build`
  - [ ] `cd backend && node --input-type=module -e "import { seedDatabase } from './dist/seed.js'; await seedDatabase(); const Database = (await import('better-sqlite3')).default; const db = new Database('./data/nvr.db'); console.log(JSON.stringify(db.prepare('SELECT id, sftp_host, sftp_port, sftp_user, sftp_path FROM settings').all()));"` prints exactly one row with `id = 1`, empty `sftp_host`/`sftp_user`, `sftp_port = 23`, and `sftp_path = '/home/backups/nvr'`.
  - [ ] Running the same seed command a second time still leaves exactly one `settings` row.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Settings singleton row is created and readable
    Tool: Bash
    Steps: Build backend; run seedDatabase from dist; inspect `settings` table with a one-off better-sqlite3 script.
    Expected: One row exists with `id=1`; no runtime credentials are seeded; `updated_at` is populated.
    Evidence: .sisyphus/evidence/task-1-settings-persistence.txt

  Scenario: Seed remains idempotent
    Tool: Bash
    Steps: Execute the same dist seed command twice; query `SELECT COUNT(*) FROM settings`.
    Expected: Count remains `1`; no duplicate or extra rows are introduced.
    Evidence: .sisyphus/evidence/task-1-settings-idempotency.txt
  ```

  **Commit**: YES | Message: `feat(settings): add persistent sftp configuration store` | Files: [`backend/src/services/settings.ts`, `backend/src/seed.ts`]

- [x] 2. Expandir serviço de usuários com regras administrativas

  **What to do**: Ampliar `backend/src/services/users.ts` mantendo compatibilidade com `findUserByUsername`, `findUserById`, `createUser`, `verifyPassword` e `toSafeUser`. Adicionar `listUsers()`, `countAdmins()`, `getActiveUserForToken(userId, issuedAtSeconds)`, `updateUserByAdmin(targetUserId, actorUserId, input)` e `deleteUserByAdmin(targetUserId, actorUserId)`, além de erros tipados (`UserNotFoundError`, `UserConflictError`, `UserProtectionError`). `updateUserByAdmin()` deve aceitar `username`, `role` e `password` opcionais; fazer trim do username sem mudar casing/login semantics; exigir ao menos um campo útil na rota chamadora; hashear senha nova apenas quando vier preenchida; atualizar `updated_at` em qualquer mutação. `deleteUserByAdmin()` deve rodar em transação e bloquear autoexclusão e exclusão do último admin. O serviço também deve bloquear rebaixamento do último admin em transação e expor dados sempre como `SafeUser` para listagem/retorno.
  **Must NOT do**: Não inventar nova política de senha mínima; não remover `bcryptjs`; não deixar regras de último admin só no frontend; não retornar `password`/hash em nenhum helper novo.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: lógica de domínio + transações + compatibilidade com auth/login.
  - Skills: `[]` — padrões existentes cobrem a implementação.
  - Omitted: [`frontend-ui-ux`] — sem trabalho visual.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3, 6 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `backend/src/services/users.ts:4-77` — estrutura base, tipos `User`/`SafeUser` e helpers já usados pelo login.
  - Pattern: `backend/src/routes/auth.ts:21-42` — login depende de `findUserByUsername`, `verifyPassword` e `toSafeUser` permanecerem corretos.
  - Pattern: `backend/src/services/audit.ts:29-40` — auditoria será feita na camada de rota; serviço de usuários deve focar regras/transações.
  - API/Type: `backend/src/plugins/auth.ts:108-116` — papéis continuam limitados a `admin | viewer`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd backend && npm run build`
  - [ ] `cd backend && node --input-type=module -e "import { seedDatabase } from './dist/seed.js'; await seedDatabase(); const users = await import('./dist/services/users.js'); const admin = users.findUserByUsername('admin'); console.log(JSON.stringify({ listHasPasswords: users.listUsers().some((u) => 'password' in u), adminCount: users.countAdmins(), adminId: admin?.id }));"` reports `listHasPasswords: false` and `adminCount >= 1`.
  - [ ] `cd backend && node --input-type=module -e "import { seedDatabase } from './dist/seed.js'; await seedDatabase(); const users = await import('./dist/services/users.js'); const admin = users.findUserByUsername('admin'); try { await users.deleteUserByAdmin(admin.id, admin.id); console.log('unexpected-success'); } catch (error) { console.log(error.constructor.name); }"` prints `UserProtectionError`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Admin-safe user helpers work for normal CRUD inputs
    Tool: Bash
    Steps: Build backend; seed DB; call service helpers from dist to create a viewer, list users, and update that viewer's role/password.
    Expected: Returned objects never include `password`; `updated_at` changes after update; role change persists.
    Evidence: .sisyphus/evidence/task-2-user-service.txt

  Scenario: Last-admin and self-delete rules are enforced in service layer
    Tool: Bash
    Steps: Seed DB with only the default admin; invoke `deleteUserByAdmin()` and `updateUserByAdmin()` attempting self-delete and demotion to `viewer`.
    Expected: Service throws typed protection errors and leaves DB state unchanged.
    Evidence: .sisyphus/evidence/task-2-user-protection.txt
  ```

  **Commit**: YES | Message: `feat(users): add admin-safe user service operations` | Files: [`backend/src/services/users.ts`]

- [x] 3. Revalidar usuários autenticados contra o banco em cada request

  **What to do**: Atualizar `backend/src/plugins/auth.ts` para, após qualquer `jwtVerify()` ou `app.jwt.verify()` bem-sucedido, consultar `getActiveUserForToken(decoded.sub, decoded.iat)` e rejeitar o request com `401` quando o usuário não existir mais ou quando o token tiver sido emitido antes de `users.updated_at`. Reidratar `request.user` com `username` e `role` vindos do banco, preservando `scope`, `file` e `path` em tokens de download/stream. Atualizar `backend/src/routes/auth.ts` para que `GET /api/auth/me` use o mesmo critério de frescor do token e devolva dados atuais do banco, não os campos antigos do JWT. Manter formato do token de login (`sub`, `username`, `role`) e `expiresIn` atuais.
  **Must NOT do**: Não mover rotas admin para `/api/auth/*`; não alterar `requireRole()`; não mudar o formato do login response; não desabilitar query-token para streaming/download.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: mexe no fluxo de autenticação global e precisa preservar compatibilidade dos fluxos especiais.
  - Skills: `[]` — o código atual já define claramente o ponto de extensão.
  - Omitted: [`frontend-ui-ux`] — backend-only.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5, 6, 8 | Blocked By: 2

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `backend/src/plugins/auth.ts:27-103` — hook global atual para `/api/*`, header JWT e query-token.
  - Pattern: `backend/src/plugins/auth.ts:108-116` — `requireRole()` continua sendo o gate de autorização.
  - Pattern: `backend/src/routes/auth.ts:46-58` — `/api/auth/me` hoje confia apenas no JWT; precisa passar a refletir o DB.
  - API/Type: `backend/src/routes/auth.ts:36-42` — payload de login que deve continuar compatível.
  - API/Type: `backend/src/services/users.ts:41-50` — lookup por ID já existe e será expandido pelo Task 2.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd backend && npm run build`
  - [ ] With a token issued before the corresponding `users.updated_at`, `curl -s -o /tmp/auth-me.json -w '%{http_code}' -H "Authorization: Bearer $STALE_TOKEN" http://localhost:3001/api/auth/me` returns `401`.
  - [ ] With a valid fresh token, `GET /api/auth/me` returns the current `username` and `role` from the database.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Fresh token resolves to live DB user data
    Tool: Bash
    Steps: Start backend; log in as admin; update that user's `username` or `role` directly via service helper or admin API; log in again; call `/api/auth/me` with the fresh token.
    Expected: Response matches the latest DB record, not stale JWT copies.
    Evidence: .sisyphus/evidence/task-3-auth-fresh-token.txt

  Scenario: Stale or deleted user token is rejected
    Tool: Bash
    Steps: Log in to get a token; mutate `updated_at` or delete the user; call `/api/auth/me` and an admin-only endpoint with the old token.
    Expected: Both requests return `401 Unauthorized`; no stale privileges remain active.
    Evidence: .sisyphus/evidence/task-3-auth-stale-token.txt
  ```

  **Commit**: YES | Message: `fix(auth): revalidate users against live database state` | Files: [`backend/src/plugins/auth.ts`, `backend/src/routes/auth.ts`]

- [x] 4. Refatorar SFTP e rotas dependentes para settings em runtime

  **What to do**: Refatorar `backend/src/services/sftp.ts` para parar de importar `config.storage` e passar a obter settings via `getSftpSettingsOrThrow()`. Extrair helper interno `connectSftp(settings: SftpSettings)` e manter o padrão de uma conexão nova por operação. Exportar `testConnection(candidate: SftpSettings)` aceitando settings explícitas para o Task 5 validar antes de salvar. Atualizar `listFiles`, `getReadStream`, `deleteFile`, `uploadFile`, `getFileSize` e `testConnection` para usar as settings do banco. Atualizar `backend/src/routes/files.ts` para converter `StorageNotConfiguredError` em `503 { error: 'Storage not configured' }` em list/download/delete/upload/bulk-delete/bulk-download, preservando `502` para falhas reais de conexão/remoto. Atualizar `backend/src/routes/stream.ts` para checar storage configurado antes de iniciar `/api/stream/start` e para mapear o mesmo erro tipado nos endpoints de debug baseados em SFTP. Remover `storage` de `backend/src/config.ts` somente depois que nenhuma referência restante depender dele.
  **Must NOT do**: Não reutilizar/poolar conexões SFTP; não mexer em `reply.hijack()` ou streaming raw; não reintroduzir fallback para `.env`; não mudar o contrato de `downloadToken`.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: toca serviço central de storage e múltiplas rotas sensíveis.
  - Skills: `[]` — padrões atuais são suficientes.
  - Omitted: [`frontend-ui-ux`] — backend-only.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, final storage QA | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `backend/src/services/sftp.ts:23-137` — todos os pontos atuais que leem `config.storage.*` e precisam migrar.
  - Pattern: `backend/src/routes/files.ts:217-295` — listagem atual converte exceções de storage em `502`.
  - Pattern: `backend/src/routes/files.ts:341-444` — download/delete já separam validação local de erro remoto.
  - Pattern: `backend/src/routes/files.ts:448-633` — upload/bulk-delete/bulk-download usam o mesmo serviço SFTP e precisam mapear `503` de forma consistente.
  - Pattern: `backend/src/routes/stream.ts:13-93` — `/api/stream/start` precisa preflight antes de criar sessão placeholder.
  - Pattern: `backend/src/routes/stream.ts:154-229` — endpoints de debug também invocam SFTP.
  - Existing config: `backend/src/config.ts:10-29` — `storage` deve deixar de existir quando a migração estiver completa.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd backend && npm run build`
  - [ ] With the singleton `settings` row still unconfigured, `curl -s -o /tmp/files-unconfigured.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:3001/api/files?path=/"` returns `503`.
  - [ ] With the same unconfigured state, `curl -s -o /tmp/stream-unconfigured.json -w '%{http_code}' -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:3001/api/stream/start?file=test.mp4&path=/"` returns `503` before creating a session.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Storage-dependent routes fail clearly when settings are missing
    Tool: Bash
    Steps: Start backend with the default empty `settings` row; call `/api/files` and `/api/stream/start` with a valid admin token.
    Expected: Both return `503` with `Storage not configured`; no generic ssh/sftp stack trace is exposed to the client.
    Evidence: .sisyphus/evidence/task-4-storage-unconfigured.txt

  Scenario: Runtime storage uses DB-backed settings only
    Tool: Bash
    Steps: Populate the `settings` row directly in SQLite with a known-good SFTP target; call a storage route without modifying `.env`.
    Expected: The route uses the DB values successfully, proving `config.storage` is no longer a runtime dependency.
    Evidence: .sisyphus/evidence/task-4-storage-runtime.txt
  ```

  **Commit**: YES | Message: `refactor(storage): load sftp settings from sqlite` | Files: [`backend/src/services/sftp.ts`, `backend/src/routes/files.ts`, `backend/src/routes/stream.ts`, `backend/src/config.ts`]

- [x] 5. Expor API administrativa de settings do servidor

  **What to do**: Criar `backend/src/routes/admin.ts` com `export async function adminRoutes(app: FastifyInstance)` e registrar esse módulo em `backend/src/index.ts`. Implementar `GET /api/admin/settings` e `PUT /api/admin/settings`, ambos com `{ preHandler: [requireRole('admin')] }`. `GET` deve retornar exatamente `{ host, port, user, path, hasPassword, isConfigured, updatedAt }` vindos de `getPublicSettings()`. `PUT` deve aceitar `{ host, port, user, path, password? }`, validar `host/user/path` como strings trimmed não vazias, `port` como inteiro entre `1..65535`, e validar `path` reaproveitando `validatePath()` de `backend/src/routes/files.ts` para bloquear `..`, `\` e caminhos relativos. Se `password` vier omitido ou vazio, manter a senha atual; se ainda não houver senha configurada, responder `400`. Antes de persistir, montar `candidateSettings` e chamar `testConnection(candidateSettings)`; só salvar no banco se a conexão/listagem do path funcionar. Auditar sucesso com ação `settings_update` e details sem senha/hash.
  **Must NOT do**: Não retornar senha em claro nem máscara fake; não salvar settings inválidas; não criar endpoint sob `/api/auth/*`; não persistir detalhes sensíveis na auditoria.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: contrato HTTP novo + validação + integração com storage e auditoria.
  - Skills: `[]` — padrões de rota existentes bastam.
  - Omitted: [`frontend-ui-ux`] — tarefa backend.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1, 3, 4

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `backend/src/routes/audit.ts:5-16` — exemplo mínimo de rota admin-only com `requireRole('admin')`.
  - Pattern: `backend/src/index.ts:21-26` — ponto de registro central de rotas Fastify.
  - Pattern: `backend/src/routes/files.ts:56-76` — `validatePath()` já implementa as regras de path traversal que devem ser reaproveitadas.
  - Pattern: `backend/src/services/audit.ts:29-40` — `logAction()` já aceita `userId`, `username`, `action`, `resource`, `details`, `ip`.
  - API/Type: `backend/src/services/sftp.ts` — Task 4 define `testConnection(candidateSettings)` para validação pré-save.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd backend && npm run build`
  - [ ] `curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/api/admin/settings` returns JSON with keys `host`, `port`, `user`, `path`, `hasPassword`, `isConfigured`, `updatedAt` and does not include a `password` field.
  - [ ] `curl -s -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"host":"bad host","port":70000,"user":"","path":"relative/path"}' http://localhost:3001/api/admin/settings` returns `400`.
  - [ ] `curl -s -H "Authorization: Bearer $VIEWER_TOKEN" http://localhost:3001/api/admin/settings` returns `403`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Admin can save valid server settings without exposing password
    Tool: Bash
    Steps: Start backend; send `PUT /api/admin/settings` with valid SFTP credentials/path; follow with `GET /api/admin/settings`.
    Expected: PUT succeeds only after connection test passes; GET reports `hasPassword: true` and `isConfigured: true` while never returning `password`.
    Evidence: .sisyphus/evidence/task-5-settings-api.txt

  Scenario: Invalid or unreachable SFTP settings are rejected without replacing the last good config
    Tool: Bash
    Steps: Save a known-good config; send a second PUT with bad credentials or invalid path; fetch settings again.
    Expected: Second PUT fails with validation/connection error; subsequent GET still shows the previous valid config metadata.
    Evidence: .sisyphus/evidence/task-5-settings-api-reject.txt
  ```

  **Commit**: YES | Message: `feat(admin): add server settings endpoints` | Files: [`backend/src/routes/admin.ts`, `backend/src/index.ts`]

- [x] 6. Expor API administrativa de CRUD de usuários

  **What to do**: Estender `backend/src/routes/admin.ts` com `GET /api/admin/users`, `POST /api/admin/users`, `PUT /api/admin/users/:id` e `DELETE /api/admin/users/:id`, todos protegidos por `requireRole('admin')`. `GET` deve retornar `SafeUser[]` ordenados por `username COLLATE NOCASE ASC, id ASC`. `POST` aceita `{ username, password, role }`, exige todos os campos, usa `createUser()`, responde `201`, e audita `user_create`. `PUT` aceita `{ username?, password?, role? }`, exige pelo menos um campo útil, trata `password` vazio como “não alterar”, chama `updateUserByAdmin()`, e responde `{ user: SafeUser, forceRelogin: boolean }` com `forceRelogin = true` quando `request.user.sub === targetId`. `DELETE` chama `deleteUserByAdmin()` e responde `{ success: true, deletedId }`. Mapear erros do serviço para `404` (usuário inexistente) e `409` (username duplicado, autoexclusão, último admin, tentativa inválida de rebaixamento). Auditar `user_update` e `user_delete` sem incluir senhas/hashes em `details`.
  **Must NOT do**: Não permitir autoexclusão; não retornar hashes; não deixar conflitos de último admin dependentes só do frontend; não adicionar endpoint separado de password reset fora deste contrato.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: novo CRUD protegido, status codes específicos e integração com serviço/transações.
  - Skills: `[]` — padrões de Fastify existentes são suficientes.
  - Omitted: [`frontend-ui-ux`] — backend-only.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 2, 3

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `backend/src/routes/audit.ts:5-16` — shape das rotas admin-only.
  - Pattern: `backend/src/routes/auth.ts:10-43` — exemplo de validação de body e resposta JSON em rota simples.
  - Pattern: `backend/src/services/users.ts:60-72` — `createUser()` atual já retorna `SafeUser` e deve continuar sendo reaproveitado.
  - API/Type: `backend/src/services/users.ts` — Task 2 define `listUsers()`, `updateUserByAdmin()`, `deleteUserByAdmin()` e erros tipados.
  - API/Type: `backend/src/services/audit.ts:29-40` — registrar `user_create`, `user_update`, `user_delete`.
  - Security: `backend/src/plugins/auth.ts:108-116` — autorização continua centralizada em `requireRole()`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd backend && npm run build`
  - [ ] `curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/api/admin/users` returns an array of users without a `password` field.
  - [ ] `curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"username":"viewer-admin-plan","password":"secret123","role":"viewer"}' http://localhost:3001/api/admin/users` returns `201` and the created safe user.
  - [ ] Attempting to delete or demote the only remaining admin returns `409`.
  - [ ] `curl -s -H "Authorization: Bearer $VIEWER_TOKEN" http://localhost:3001/api/admin/users` returns `403`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Admin can create, edit, and delete non-protected users
    Tool: Bash
    Steps: Start backend; POST a viewer user; PUT that user to change username/role/password; DELETE the same user.
    Expected: Create returns `201`; update returns `{ user, forceRelogin: false }`; delete returns `{ success: true, deletedId }`; list endpoint reflects each state transition.
    Evidence: .sisyphus/evidence/task-6-user-api.txt

  Scenario: Protected user mutations are rejected with conflict responses
    Tool: Bash
    Steps: Attempt self-delete as the logged-in admin; attempt to demote/delete the last remaining admin.
    Expected: Each request returns `409` with a specific protection error message; no unintended DB mutation occurs.
    Evidence: .sisyphus/evidence/task-6-user-api-protection.txt
  ```

  **Commit**: YES | Message: `feat(admin): add user management endpoints` | Files: [`backend/src/routes/admin.ts`]

- [x] 7. Adicionar shell de navegação frontend com rota `/admin`

  **What to do**: Adicionar `react-router-dom` ao `frontend/package.json`, envolver a aplicação com `BrowserRouter` em `frontend/src/main.tsx`, e refatorar `frontend/src/App.tsx` para usar `Routes`, `Route`, `Navigate` e `NavLink`. Manter a gate atual de `loading` e `login`, mas quando houver usuário autenticado renderizar um shell único com header persistente. Esse header deve manter título, usuário e logout, além de navegação textual com botões/links `Files` e `Administration`. O link `Administration` aparece **somente** quando `user.role === 'admin'`. A rota `/` continua renderizando `FileList`; `/admin` renderiza o painel admin; qualquer usuário não-admin acessando `/admin` deve ser redirecionado para `/`; qualquer rota desconhecida deve redirecionar para `/`. Preservar largura máxima, paddings e borda inferior do header já existente.
  **Must NOT do**: Não mover lógica administrativa para dentro de `FileList`; não trocar para hash routing; não criar sidebar complexa; não remover o fallback de login/loading existente.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: altera shell da SPA, navegação e estados visuais mantendo o estilo atual.
  - Skills: [`frontend-ui-ux`] — manter consistência visual sem framework adicional.
  - Omitted: [`playwright`] — QA browser ficará nos cenários, não na implementação.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/src/main.tsx:6-12` — ponto atual de bootstrap com `AuthProvider`.
  - Pattern: `frontend/src/App.tsx:33-76` — header atual, largura máxima e logout button style.
  - Pattern: `frontend/src/auth.tsx:33-98` — `user`, `loading`, `logout` e `isAdmin` vêm do contexto existente.
  - Pattern: `frontend/src/components/FileList.tsx:43-54` — helper de botão inline usado como referência para estado visual simples.
  - SPA support: `docker/nginx.conf:26-29` — `try_files ... /index.html` já permite `BrowserRouter` em produção.
  - Dev routing: `frontend/vite.config.ts:6-14` — proxy `/api` já existe e não precisa mudar.
  - Dependencies: `frontend/package.json:15-19` — adicionar apenas `react-router-dom`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd frontend && npm run build`
  - [ ] An admin session visiting `/admin` renders the admin shell instead of a blank page or 404.
  - [ ] A viewer session visiting `/admin` is redirected to `/` and does not see an `Administration` link/button in the header.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Admin can navigate between Files and Administration routes
    Tool: Playwright
    Steps: Log in as admin; assert header contains `Files`, `Administration`, username/role, and `Logout`; click `Administration`; verify URL becomes `/admin`; click `Files`; verify URL returns to `/`.
    Expected: Navigation is client-side, stable after refresh, and uses the existing shell styling.
    Evidence: .sisyphus/evidence/task-7-router-shell.png

  Scenario: Non-admin cannot access `/admin`
    Tool: Playwright
    Steps: Log in as viewer; manually navigate to `/admin` in the address bar.
    Expected: App redirects to `/`; header does not render `Administration`; no admin content flashes briefly.
    Evidence: .sisyphus/evidence/task-7-router-guard.png
  ```

  **Commit**: YES | Message: `feat(ui): add admin routing shell` | Files: [`frontend/package.json`, `frontend/src/main.tsx`, `frontend/src/App.tsx`]

- [x] 8. Construir painel administrativo de usuários e servidor

  **What to do**: Criar uma árvore dedicada em `frontend/src/components/admin/` com `AdminPanel.tsx`, `AdminUsersSection.tsx` e `AdminServerSection.tsx`. `AdminPanel` deve controlar abas locais `Users` e `Server`, defaultando para `Users`, e renderizar tudo dentro de cards inline consistentes com o resto da app. `AdminUsersSection` deve usar `apiFetch` para consumir `/api/admin/users`, exibir tabela com colunas `Username`, `Role`, `Created`, `Updated`, `Actions`, e oferecer um card de formulário reutilizado para criar/editar usuários com labels `Username`, `Password`, `Role`. Em criação, senha é obrigatória; em edição, senha em branco significa “manter atual”. Mostrar botões `Create User`, `Save Changes`, `Cancel`, `Edit`, `Delete`, `Confirm Delete`. Desabilitar delete do usuário logado e desabilitar rebaixamento/exclusão do último admin no UI quando isso puder ser inferido pela lista — sempre mantendo o backend como fonte final de verdade. Se o `PUT /api/admin/users/:id` responder `forceRelogin: true`, chamar `logout()` imediatamente após mostrar sucesso local mínimo e deixar a próxima autenticação ocorrer normalmente. `AdminServerSection` deve carregar `/api/admin/settings`, popular `Host`, `Port`, `User`, `Path`, deixar o campo `Password` sempre vazio, mostrar helper `Leave password blank to keep the current password.` quando `hasPassword === true`, e exibir banner `Storage is not configured yet.` quando `isConfigured === false`. O botão principal da seção deve ser `Save Server Settings`; após sucesso, manter o campo de senha vazio e refazer GET para refletir `hasPassword`/`updatedAt`.
  **Must NOT do**: Não usar `fetch` direto; não criar modal complexo ou CSS externo; não preencher o input de senha com máscara fake; não depender apenas de optimistic updates — sempre refazer GET/lista após mutações bem-sucedidas.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: tarefa centrada em UX administrativa, formulários, tabelas e estados inline.
  - Skills: [`frontend-ui-ux`] — necessário para manter a aparência coesa com `LoginPage` e `FileList`.
  - Omitted: [`playwright`] — usado somente para QA final.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Final verification | Blocked By: 5, 6, 7

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/src/api.ts:1-20` — todas as chamadas autenticadas devem passar por `apiFetch()`.
  - Pattern: `frontend/src/auth.tsx:40-44` — `logout()` já limpa token/usuário e deve ser reutilizado quando `forceRelogin` vier da API.
  - Pattern: `frontend/src/App.tsx:42-74` — header atual e espaçamento geral.
  - Pattern: `frontend/src/components/LoginPage.tsx:24-129` — padrão visual de formulário, labels, inputs e feedback de erro.
  - Pattern: `frontend/src/components/FileList.tsx:43-54` — estilo dos botões de ação inline.
  - Pattern: `frontend/src/components/FileList.tsx:115-153` — fetch + loading + error handling via `apiFetch`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd frontend && npm run build`
  - [ ] In `/admin`, the `Users` section lists all users and supports create/edit/delete flows using only `/api/admin/users`.
  - [ ] In `/admin`, the `Server` section shows `Host`, `Port`, `User`, `Password`, and `Path`, preserves the stored password when the input is left blank, and shows the configured/unconfigured status correctly.
  - [ ] If the logged-in admin edits their own username/role/password, the UI logs them out after the successful response.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Admin manages users end-to-end from the UI
    Tool: Playwright
    Steps: Log in as admin; open `/admin`; stay on `Users`; click `Create User`; submit `Username=viewer-ui`, `Password=secret123`, `Role=viewer`; confirm row appears; click `Edit` on that row; change role to `admin` and leave password blank; save; trigger delete confirmation and delete the same row.
    Expected: Table refreshes after each mutation; no password value is ever shown; delete requires explicit confirmation; backend error messages surface inline if any step fails.
    Evidence: .sisyphus/evidence/task-8-admin-users.png

  Scenario: Admin updates server settings and sees validation feedback
    Tool: Playwright
    Steps: Log in as admin; open `/admin`; switch to `Server`; verify unconfigured banner when applicable; fill invalid data and submit; then fill valid `Host`, `Port`, `User`, `Password`, `Path` and submit again.
    Expected: Invalid submission shows inline error without clearing the form; valid submission shows success feedback, keeps the password field blank afterward, and updates the status metadata from the follow-up GET.
    Evidence: .sisyphus/evidence/task-8-admin-server.png
  ```

  **Commit**: YES | Message: `feat(ui): add administration panel screens` | Files: [`frontend/src/components/admin/AdminPanel.tsx`, `frontend/src/components/admin/AdminUsersSection.tsx`, `frontend/src/components/admin/AdminServerSection.tsx`, `frontend/src/App.tsx`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Prefer one commit per numbered task when the diff stays isolated.
- If a task naturally spans backend + frontend contract changes, keep it as a single commit only when both sides are required for a buildable state; otherwise commit backend first.
- Do not commit verification-only artifacts under `.sisyphus/evidence/`.
- Suggested commit messages are specified inside each task and should be used unless the actual diff forces a more accurate scope label.

## Success Criteria
- Admins can manage users and SFTP settings end-to-end from `/admin` without editing `.env`.
- Storage operations use DB-backed settings only.
- Viewer users never see or access admin UI/API functionality.
- Last-admin and self-delete safety rules are enforced server-side.
- Session invalidation happens on the next authenticated request after user mutation.
- The file browser remains intact and visually consistent with the existing application.
