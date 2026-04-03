# Performance Optimizations — NVR Backup Manager

## TL;DR

> **Quick Summary**: Implement all 17 performance optimizations from the IDEATION_PERFORMANCE.md audit — SFTP connection reuse, nginx compression/caching, async I/O, React memoization, auth caching, bundle splitting, and a new streaming bulk download endpoint. Then set up vitest and write tests for the key behavioral changes.
> 
> **Deliverables**:
> - SFTP batch operations: single-connection downloads, batch deletes
> - Nginx: gzip compression + static asset caching
> - Backend: async file I/O, HLS session TTL cleanup, auth user cache, static imports
> - Frontend: useMemo, useCallback, exponential backoff polling, code splitting, Vite chunk optimization
> - New endpoint: `/api/bulk-download-token` + streaming bulk download via anchor tag
> - Test infrastructure (vitest) + optimization test suite
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 5 waves (7→4→1→2 tasks + final verification)
> **Critical Path**: T2 (SFTP functions) → T9 (file routes) → T12 (bulk download token) → T13 (test setup) → T14 (tests) → F1-F4

---

## Context

### Original Request
Implement all 17 performance optimizations documented in `IDEATION_PERFORMANCE.md`. The audit covers network (SFTP connection reuse, nginx), runtime (async I/O, static imports), memory (HLS session TTL, bulk download streaming), database (auth cache, audit indexes), rendering (useMemo, useCallback), and bundle size (code splitting, Vite chunks).

### Interview Summary
**Key Discussions**:
- Scope: All 17 PERF items (PERF-001 through PERF-017) — no subset
- Tests: After implementation (not TDD) — no test suite exists yet
- PERF-008: Confirmed — includes new backend endpoint + frontend flow change
- All 17 items validated against current codebase — all confirmed still applicable

**Research Findings**:
- Every claim in the ideation doc was validated via explore agent
- Backend uses TypeScript strict mode (`noUnusedLocals: true`) — all import changes must be clean
- `testConnection()` is used by both `routes/stream.ts` (to be removed) and `routes/admin.ts` (to keep) — function in sftp.ts must stay
- Debug endpoint (`/api/stream/debug`) uses sync I/O and dynamic imports — needs updating alongside PERF-005/011
- `react-router-dom@7.14.0` with `BrowserRouter` supports `React.lazy()` + `Suspense` — no compatibility issues
- Existing download-token pattern in `files.ts:303-343` can be followed for PERF-008
- `useCallback` already imported in `auth.tsx` (used for `logout`) — just wrap `login` too

### Metis Review
**Identified Gaps** (addressed):
- **fs.watch race condition**: Must check file existence BEFORE attaching watcher — addressed in T8 QA
- **testConnection import cleanup**: Removing call requires removing import from routes/stream.ts (noUnusedLocals) — addressed in T8
- **getFileSize import**: May become unused in files.ts after PERF-001 — addressed in T9
- **PERF-009 cache invalidation**: Must add explicit `userCache.delete()` in update/delete functions — addressed in T10
- **Debug endpoint**: `/api/stream/debug` needs sync→async + dynamic→static import changes — addressed in T8
- **PERF-008 auth hook**: Auth plugin needs `downloadToken` handling for bulk-download URL pattern — addressed in T12
- **PERF-010 placeholder sessions**: TTL cleanup must skip sessions still initializing — addressed in T8
- **Build gates**: Every task must verify `npm run build` for both backend and frontend — addressed in all tasks

---

## Work Objectives

### Core Objective
Eliminate the top performance bottlenecks in the NVR Backup Manager — connection overhead, missing compression, sync I/O blocking, memory leaks, and unnecessary re-renders — while adding test infrastructure for ongoing quality.

### Concrete Deliverables
- Modified: `backend/src/services/sftp.ts` — new `getReadStreamWithSize()` and `deleteFiles()` exports
- Modified: `backend/src/routes/files.ts` — use batch SFTP functions, optimize parsing
- Modified: `backend/src/routes/stream.ts` — remove testConnection, static imports, async I/O
- Modified: `backend/src/services/stream.ts` — async I/O, fs.watch, HLS session TTL
- Modified: `backend/src/services/users.ts` — auth user cache with TTL
- Modified: `backend/src/plugins/auth.ts` — use cached user lookup + bulk-download token support
- Modified: `backend/src/services/audit.ts` — add index on `created_at`
- Modified: `docker/nginx.conf` — gzip + static asset caching
- Modified: `frontend/src/components/FileList.tsx` — useMemo + streaming bulk download
- Modified: `frontend/src/components/VideoPlayer.tsx` — exponential backoff polling
- Modified: `frontend/src/auth.tsx` — useCallback for login
- Modified: `frontend/src/App.tsx` — lazy-load AdminPanel
- Modified: `frontend/vite.config.ts` — manualChunks config
- New: `POST /api/bulk-download-token` endpoint
- New: `GET /api/bulk-download` handler (token-based)
- New: Test infrastructure (vitest config, example tests)
- New: Optimization test suite

### Definition of Done
- [ ] All 17 PERF items implemented
- [ ] `cd backend && npm run build` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] Test suite passes: `cd backend && npx vitest run` exits 0
- [ ] No regressions: file browse, download, stream, bulk operations all functional

### Must Have
- All 17 PERF optimizations implemented as specified in IDEATION_PERFORMANCE.md
- TypeScript compilation clean (no errors, no unused imports)
- Existing API behavior preserved (no breaking changes)
- Test infrastructure set up and initial test suite passing

### Must NOT Have (Guardrails)
- **DO NOT** remove `testConnection()` function from `sftp.ts` — only remove the call in `routes/stream.ts` (admin route still uses it)
- **DO NOT** remove or change existing `POST /api/bulk-download` endpoint behavior — add new token-based GET alongside it
- **DO NOT** add SFTP connection pooling — each operation still gets its own connection (except batch operations)
- **DO NOT** add concurrency/parallelism to bulk delete — keep sequential within single connection
- **DO NOT** add Brotli compression — gzip only
- **DO NOT** lazy-load VideoPlayer — only AdminPanel
- **DO NOT** add Redis or external cache for auth — simple in-memory Map only
- **DO NOT** add download progress bar to bulk download — accepted trade-off
- **DO NOT** change startup-time `mkdirSync` in `db.ts` — only change request-path sync I/O
- **DO NOT** add session activity tracking/analytics — only `createdAt` field + TTL sweep
- **DO NOT** leave unused imports after changes — TypeScript strict mode will fail the build
- **DO NOT** change any features, UI, or business logic — these are pure performance optimizations

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (will be set up in Wave 4)
- **Automated tests**: YES — tests after implementation
- **Framework**: vitest (works for both backend and frontend, integrates with Vite)
- **Build gates**: `cd backend && npm run build` + `cd frontend && npm run build` for EVERY task

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend route changes**: Use Bash (curl) — send requests, assert status + response
- **Backend service changes**: Use Bash (build + inspection) — verify compilation, inspect output
- **Frontend changes**: Use Bash (build + bundle inspection) — verify build succeeds, check chunk names
- **Nginx changes**: Use Bash (curl with headers) — verify compression, caching headers
- **Config changes**: Use Bash (build) — verify compilation succeeds

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 7 parallel trivial tasks):
├── Task 1: Nginx gzip + static asset caching (PERF-003 + PERF-004) [quick]
├── Task 2: SFTP service batch functions (PERF-001 + PERF-002 service) [quick]
├── Task 3: Auth login useCallback (PERF-014) [quick]
├── Task 4: VideoPlayer polling backoff (PERF-012) [quick]
├── Task 5: Audit log indexes (PERF-016) [quick]
├── Task 6: Vite manual chunks (PERF-017) [quick]
└── Task 7: FileList useMemo (PERF-013) [quick]

Wave 2 (After Wave 1 — 4 parallel core optimizations):
├── Task 8: Stream routes + service overhaul (PERF-005 + PERF-006 + PERF-010 + PERF-011) [unspecified-high]
├── Task 9: File routes optimization (PERF-001 route + PERF-002 route + PERF-007) (depends: T2) [unspecified-high]
├── Task 10: Auth user cache (PERF-009) [quick]
└── Task 11: Admin code splitting (PERF-015) [quick]

Wave 3 (After Wave 2 — 1 task, most invasive change):
└── Task 12: Bulk download token endpoint + frontend (PERF-008) (depends: T7, T9) [unspecified-high]

Wave 4 (After Wave 3 — 2 sequential tasks):
├── Task 13: Test infrastructure setup (vitest config) [quick]
└── Task 14: Optimization test suite (depends: T13) [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T2 → T9 → T12 → T13 → T14 → F1-F4 → user okay
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 7 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1 | — | — | 1 |
| T2 | — | T9 | 1 |
| T3 | — | — | 1 |
| T4 | — | — | 1 |
| T5 | — | — | 1 |
| T6 | — | — | 1 |
| T7 | — | T12 | 1 |
| T8 | — | — | 2 |
| T9 | T2 | T12 | 2 |
| T10 | — | — | 2 |
| T11 | — | — | 2 |
| T12 | T7, T9 | T13 | 3 |
| T13 | T12 | T14 | 4 |
| T14 | T13 | F1-F4 | 4 |

### Agent Dispatch Summary

- **Wave 1**: **7** — T1-T7 → all `quick`
- **Wave 2**: **4** — T8 → `unspecified-high`, T9 → `unspecified-high`, T10 → `quick`, T11 → `quick`
- **Wave 3**: **1** — T12 → `unspecified-high`
- **Wave 4**: **2** — T13 → `quick`, T14 → `unspecified-high`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. Nginx Gzip Compression + Static Asset Caching (PERF-003 + PERF-004)

  **What to do**:
  - Add gzip compression to `docker/nginx.conf` inside the `server` block:
    - `gzip on;` with `gzip_vary on;`, `gzip_proxied any;`, `gzip_comp_level 6;`, `gzip_min_length 256;`
    - `gzip_types`: `text/plain text/css text/javascript application/javascript application/json application/vnd.apple.mpegurl image/svg+xml`
  - Add static asset caching rules:
    - `location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }` — for Vite content-hashed assets
    - `location = /index.html { add_header Cache-Control "no-cache"; }` — HTML shell must always fetch fresh
  - Do NOT compress video streams (already binary — gzip_types list excludes video/* deliberately)

  **Must NOT do**:
  - Do NOT add Brotli compression
  - Do NOT change any existing location blocks or proxy settings
  - Do NOT add caching for API responses (only static assets)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file edit, well-defined nginx config additions
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None — pure config file edit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `docker/nginx.conf` — Current nginx config. Add gzip block inside the existing `server { }` block, before the `location` directives. Add asset caching as new `location` blocks.

  **External References**:
  - `IDEATION_PERFORMANCE.md:124-148` — Exact gzip config to add (PERF-003)
  - `IDEATION_PERFORMANCE.md:172-185` — Exact caching config to add (PERF-004)

  **WHY Each Reference Matters**:
  - `docker/nginx.conf` — You need to see the existing server block structure to know WHERE to insert the new directives
  - Ideation doc sections provide the exact config snippets — copy them, don't invent

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Nginx config is syntactically valid
    Tool: Bash
    Preconditions: Docker nginx image available
    Steps:
      1. Run: docker run --rm -v $(pwd)/docker/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t
      2. Assert: output contains "syntax is ok" and "test is successful"
    Expected Result: Exit code 0, config validates
    Failure Indicators: "emerg" or "error" in output
    Evidence: .sisyphus/evidence/task-1-nginx-syntax.txt

  Scenario: Gzip directives present in config
    Tool: Bash
    Preconditions: nginx.conf has been edited
    Steps:
      1. Run: grep -c "gzip on" docker/nginx.conf
      2. Assert: output is "1" (exactly one gzip on directive)
      3. Run: grep "gzip_types" docker/nginx.conf
      4. Assert: output contains "application/json" and "text/javascript"
    Expected Result: All gzip directives present
    Failure Indicators: grep returns 0 matches
    Evidence: .sisyphus/evidence/task-1-gzip-check.txt

  Scenario: Cache-Control headers present for assets
    Tool: Bash
    Preconditions: nginx.conf has been edited
    Steps:
      1. Run: grep -A2 "location /assets/" docker/nginx.conf
      2. Assert: output contains "immutable" and "expires 1y"
      3. Run: grep -A1 'location = /index.html' docker/nginx.conf
      4. Assert: output contains "no-cache"
    Expected Result: Asset caching rules correctly configured
    Failure Indicators: Missing location blocks or wrong Cache-Control values
    Evidence: .sisyphus/evidence/task-1-cache-headers.txt
  ```

  **Commit**: YES
  - Message: `perf(nginx): add gzip compression and static asset caching`
  - Files: `docker/nginx.conf`

- [ ] 2. SFTP Service Batch Functions (PERF-001 + PERF-002 service layer)

  **What to do**:
  - Add `getReadStreamWithSize()` function to `backend/src/services/sftp.ts`:
    - Creates a single SFTP connection
    - Calls `sftp.stat()` to get file size, then `sftp.createReadStream()` on the SAME connection
    - Returns `{ stream, sftp, size }` — caller is responsible for `sftp.end()` (same lifecycle as existing `getReadStream()`)
    - Do NOT call `sftp.end()` inside the function — the stream would be dead before the pipe completes
  - Add `deleteFiles()` batch function to `backend/src/services/sftp.ts`:
    - Creates a single SFTP connection
    - Iterates through filenames, calling `sftp.delete()` for each on the SAME connection
    - Returns `Map<string, Error | null>` (null = success, Error = per-file failure)
    - `sftp.end()` in `finally` block
    - Keep deletes SEQUENTIAL within the single connection (no concurrency)
  - Export both new functions

  **Must NOT do**:
  - Do NOT modify existing functions (`getFileSize`, `getReadStream`, `deleteFile`) — they may be used elsewhere
  - Do NOT add SFTP connection pooling
  - Do NOT add parallel/concurrent deletes within `deleteFiles()`
  - Do NOT remove `testConnection()` — it's used by admin routes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding 2 new functions to an existing service file. Pattern is clear from existing functions.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-7)
  - **Blocks**: Task 9 (file routes need these new functions)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `backend/src/services/sftp.ts` — ALL of this file. Study the existing `getReadStream()` function (connection lifecycle: connect → operation → caller closes) and `deleteFile()` function (connect → delete → end in finally). The new functions follow the same patterns but combine operations on a single connection.

  **API/Type References**:
  - `backend/src/services/sftp.ts:getReadStream()` — Return type pattern: `Promise<SftpStream>`. New `getReadStreamWithSize()` returns `Promise<{ stream: ReadStream; sftp: SftpClient; size: number }>` (or however the existing types work — match them)
  - `backend/src/services/sftp.ts:getSftpSettingsOrThrow()` — Required for getting connection settings
  - `backend/src/services/sftp.ts:connectSftp()` — Required for creating the connection
  - `backend/src/services/sftp.ts:normalizePath()` — Required for path construction

  **External References**:
  - `IDEATION_PERFORMANCE.md:39-47` — Exact `getReadStreamWithSize()` implementation (PERF-001)
  - `IDEATION_PERFORMANCE.md:82-101` — Exact `deleteFiles()` implementation (PERF-002)

  **WHY Each Reference Matters**:
  - `sftp.ts` existing functions — You MUST match the exact connection lifecycle pattern (how `connectSftp()` is called, how paths are normalized, how errors are handled)
  - Ideation snippets — They provide the target implementation, but adapt to match existing code style and types

  **Acceptance Criteria**:

  - [ ] `cd backend && npm run build` exits 0
  - [ ] New functions exported: `getReadStreamWithSize`, `deleteFiles`

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Backend compiles with new SFTP functions
    Tool: Bash
    Preconditions: sftp.ts has been modified
    Steps:
      1. Run: cd backend && npm run build
      2. Assert: exit code 0, no TypeScript errors
      3. Run: grep "export async function getReadStreamWithSize" backend/src/services/sftp.ts
      4. Assert: exactly 1 match
      5. Run: grep "export async function deleteFiles" backend/src/services/sftp.ts
      6. Assert: exactly 1 match
    Expected Result: Build succeeds, both functions exported
    Failure Indicators: TypeScript errors, missing exports
    Evidence: .sisyphus/evidence/task-2-build.txt

  Scenario: New functions follow connection lifecycle pattern
    Tool: Bash
    Preconditions: sftp.ts has been modified
    Steps:
      1. Run: grep -A30 "async function getReadStreamWithSize" backend/src/services/sftp.ts
      2. Assert: contains "connectSftp()" and "stat(" and "createReadStream" but does NOT contain "sftp.end()" (caller closes)
      3. Run: grep -A30 "async function deleteFiles" backend/src/services/sftp.ts
      4. Assert: contains "connectSftp()" and "finally" and "sftp.end()" (batch function manages own lifecycle)
    Expected Result: getReadStreamWithSize leaves connection open (caller closes), deleteFiles closes in finally
    Failure Indicators: getReadStreamWithSize has sftp.end() inside, or deleteFiles missing finally block
    Evidence: .sisyphus/evidence/task-2-lifecycle.txt
  ```

  **Commit**: YES
  - Message: `perf(sftp): add batch functions for single-connection operations`
  - Files: `backend/src/services/sftp.ts`

- [ ] 3. Auth Login useCallback Memoization (PERF-014)

  **What to do**:
  - In `frontend/src/auth.tsx`, wrap the `login` function with `useCallback`:
    - Change `async function login(username: string, password: string): Promise<void> { ... }` to `const login = useCallback(async (username: string, password: string): Promise<void> => { ... }, []);`
    - Empty dependency array `[]` is correct: the function uses `setToken`, `setUser` (stable React state setters), `fetch` (global), and `localStorage` (global)
  - `useCallback` is already imported in `auth.tsx` (used for `logout`) — no new import needed

  **Must NOT do**:
  - Do NOT change any other functions in auth.tsx
  - Do NOT modify the login logic itself — only wrap it
  - Do NOT add dependencies to the useCallback array (empty is correct)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single function wrap, minimal change
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2, 4-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `frontend/src/auth.tsx:40-44` — Existing `useCallback` usage for `logout` function. Follow the same pattern for `login`.
  - `frontend/src/auth.tsx:64-82` — Current `login` function to wrap

  **External References**:
  - `IDEATION_PERFORMANCE.md:626-629` — Target implementation (PERF-014)

  **WHY Each Reference Matters**:
  - `auth.tsx` logout useCallback — Shows the exact pattern already used in this file. Mirror it for login.
  - Current login function — You need to see the full function body to correctly convert it from a function declaration to a const arrow function wrapped in useCallback

  **Acceptance Criteria**:

  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Frontend compiles with memoized login
    Tool: Bash
    Preconditions: auth.tsx has been modified
    Steps:
      1. Run: cd frontend && npm run build
      2. Assert: exit code 0, no TypeScript errors
    Expected Result: Build succeeds
    Failure Indicators: TypeScript errors about useCallback types or missing dependencies
    Evidence: .sisyphus/evidence/task-3-build.txt

  Scenario: login is wrapped in useCallback
    Tool: Bash
    Preconditions: auth.tsx has been modified
    Steps:
      1. Run: grep "useCallback" frontend/src/auth.tsx | wc -l
      2. Assert: output is "2" or more (import line + at least 2 useCallback usages: login + logout)
      3. Run: grep "const login = useCallback" frontend/src/auth.tsx
      4. Assert: exactly 1 match
    Expected Result: login wrapped in useCallback alongside existing logout pattern
    Failure Indicators: login still declared as regular function, or useCallback count unchanged
    Evidence: .sisyphus/evidence/task-3-usecallback.txt
  ```

  **Commit**: YES
  - Message: `perf(auth): memoize login function with useCallback`
  - Files: `frontend/src/auth.tsx`

- [ ] 4. VideoPlayer Exponential Backoff Polling (PERF-012)

  **What to do**:
  - In `frontend/src/components/VideoPlayer.tsx`, replace the fixed 2-second polling interval for HLS playlist readiness with exponential backoff:
    - Current: `for (let attempt = 0; attempt < 60; attempt++) { ... await new Promise(r => setTimeout(r, 2000)); }`
    - New: `for (let attempt = 0; attempt < 30; attempt++) { ... const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000); await new Promise(r => setTimeout(r, delay)); }`
    - Starts at 1s, grows by 1.5x, caps at 10s, max 30 attempts (~2.5 min total vs current 2 min)

  **Must NOT do**:
  - Do NOT change any other VideoPlayer logic
  - Do NOT lazy-load VideoPlayer itself
  - Do NOT add WebSocket-based notification (polling is fine, just smarter)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single loop modification
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `frontend/src/components/VideoPlayer.tsx:73-77` — Current fixed-interval polling loop to replace

  **External References**:
  - `IDEATION_PERFORMANCE.md:557-562` — Target exponential backoff implementation (PERF-012)

  **WHY Each Reference Matters**:
  - Current loop — You need to see the exact for-loop structure and what's inside it (fetch + check) to preserve the logic while changing the timing

  **Acceptance Criteria**:

  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Frontend compiles with exponential backoff
    Tool: Bash
    Preconditions: VideoPlayer.tsx has been modified
    Steps:
      1. Run: cd frontend && npm run build
      2. Assert: exit code 0
    Expected Result: Build succeeds
    Failure Indicators: TypeScript errors
    Evidence: .sisyphus/evidence/task-4-build.txt

  Scenario: Polling uses exponential backoff pattern
    Tool: Bash
    Preconditions: VideoPlayer.tsx has been modified
    Steps:
      1. Run: grep "Math.pow" frontend/src/components/VideoPlayer.tsx
      2. Assert: at least 1 match
      3. Run: grep "Math.min" frontend/src/components/VideoPlayer.tsx
      4. Assert: at least 1 match (cap at 10000ms)
      5. Run: grep -c "setTimeout(r, 2000)" frontend/src/components/VideoPlayer.tsx
      6. Assert: output is "0" (fixed 2s interval removed)
    Expected Result: Exponential backoff present, fixed interval removed
    Failure Indicators: Math.pow/Math.min missing, or fixed 2000ms still present
    Evidence: .sisyphus/evidence/task-4-backoff.txt
  ```

  **Commit**: YES
  - Message: `perf(video): use exponential backoff for HLS playlist polling`
  - Files: `frontend/src/components/VideoPlayer.tsx`

- [ ] 5. Audit Log Database Index (PERF-016)

  **What to do**:
  - In `backend/src/services/audit.ts`, add an index on `created_at DESC` in the `initAuditTable()` function:
    - Add after the `CREATE TABLE IF NOT EXISTS` statement: `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);`
    - This optimizes the `getAuditLogs()` query which sorts by `created_at DESC` with `LIMIT/OFFSET`

  **Must NOT do**:
  - Do NOT add any other indexes
  - Do NOT modify the table schema itself
  - Do NOT change the `getAuditLogs()` query

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single SQL statement addition
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `backend/src/services/audit.ts:14-27` — `initAuditTable()` function where the index creation should be added
  - `backend/src/services/audit.ts:52-56` — `getAuditLogs()` query that benefits from this index (ORDER BY created_at DESC)

  **External References**:
  - `IDEATION_PERFORMANCE.md:697-704` — Target implementation (PERF-016)

  **WHY Each Reference Matters**:
  - `initAuditTable()` — You need to see where to add the `CREATE INDEX` statement (after the CREATE TABLE)
  - `getAuditLogs()` — Shows the query pattern being optimized (ORDER BY + LIMIT/OFFSET)

  **Acceptance Criteria**:

  - [ ] `cd backend && npm run build` exits 0

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Backend compiles with new index
    Tool: Bash
    Preconditions: audit.ts has been modified
    Steps:
      1. Run: cd backend && npm run build
      2. Assert: exit code 0
    Expected Result: Build succeeds
    Failure Indicators: TypeScript or SQL syntax errors
    Evidence: .sisyphus/evidence/task-5-build.txt

  Scenario: Index creation SQL is present
    Tool: Bash
    Preconditions: audit.ts has been modified
    Steps:
      1. Run: grep "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at" backend/src/services/audit.ts
      2. Assert: exactly 1 match
      3. Run: grep "created_at DESC" backend/src/services/audit.ts
      4. Assert: at least 2 matches (index creation + existing query ORDER BY)
    Expected Result: Index definition present in initAuditTable
    Failure Indicators: Missing index, wrong column name, or missing DESC
    Evidence: .sisyphus/evidence/task-5-index.txt
  ```

  **Commit**: YES
  - Message: `perf(db): add index on audit_logs.created_at`
  - Files: `backend/src/services/audit.ts`

- [ ] 6. Vite Manual Chunk Splitting (PERF-017)

  **What to do**:
  - In `frontend/vite.config.ts`, add `build.rollupOptions.output.manualChunks` configuration:
    - `vendor: ["react", "react-dom", "react-router-dom"]` — Framework code in one chunk
    - `hls: ["hls.js"]` — HLS player in separate chunk (~200KB, only loaded when needed)
  - This separates vendor code from app code, improving cache granularity

  **Must NOT do**:
  - Do NOT add minification or optimization plugins
  - Do NOT change existing Vite config settings (plugins, outDir, etc.)
  - Do NOT add more chunk groups beyond vendor and hls

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple config addition to existing Vite config
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `frontend/vite.config.ts` — Current config file. Add `build.rollupOptions.output.manualChunks` to the existing `defineConfig()` call.

  **External References**:
  - `IDEATION_PERFORMANCE.md:728-743` — Exact Vite config to add (PERF-017)

  **WHY Each Reference Matters**:
  - `vite.config.ts` — You need to see the current structure to know where to merge in the new `build` options without overwriting existing settings

  **Acceptance Criteria**:

  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Frontend builds with chunk splitting
    Tool: Bash
    Preconditions: vite.config.ts has been modified
    Steps:
      1. Run: cd frontend && npm run build
      2. Assert: exit code 0
      3. Run: ls frontend/dist/assets/ | grep -E "vendor|hls"
      4. Assert: at least 2 matches (vendor-*.js and hls-*.js)
    Expected Result: Build produces separate vendor and hls chunks
    Failure Indicators: Build fails, or only one chunk output
    Evidence: .sisyphus/evidence/task-6-chunks.txt

  Scenario: manualChunks config is present
    Tool: Bash
    Preconditions: vite.config.ts has been modified
    Steps:
      1. Run: grep "manualChunks" frontend/vite.config.ts
      2. Assert: at least 1 match
      3. Run: grep "hls.js" frontend/vite.config.ts
      4. Assert: at least 1 match
    Expected Result: Manual chunks configured for vendor and hls
    Failure Indicators: Missing manualChunks config
    Evidence: .sisyphus/evidence/task-6-config.txt
  ```

  **Commit**: YES
  - Message: `perf(build): add Vite manual chunk splitting`
  - Files: `frontend/vite.config.ts`

- [ ] 7. FileList Sorted Files useMemo (PERF-013)

  **What to do**:
  - In `frontend/src/components/FileList.tsx`, wrap the `sortedFiles` computation with `useMemo`:
    - Current: `const sortedFiles = [...timeFilteredFiles].sort((a, b) => { ... });` — runs on every render
    - New: `const sortedFiles = useMemo(() => [...timeFilteredFiles].sort((a, b) => { ... }), [timeFilteredFiles, sortColumn, sortDirection]);`
    - Add `useMemo` to the React imports if not already imported

  **Must NOT do**:
  - Do NOT change the sort logic itself
  - Do NOT modify `handleBulkDownload` (that's Task 12)
  - Do NOT refactor any other part of FileList

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single useMemo wrap
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6)
  - **Blocks**: Task 12 (FileList.tsx must be stable before PERF-008 frontend changes)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `frontend/src/components/FileList.tsx:277-300` — Current `sortedFiles` computation to wrap in useMemo

  **External References**:
  - `IDEATION_PERFORMANCE.md:592-596` — Target useMemo implementation (PERF-013)

  **WHY Each Reference Matters**:
  - Current sortedFiles — You need to see the exact sort logic and which variables it depends on to set correct dependency array

  **Acceptance Criteria**:

  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Frontend compiles with useMemo
    Tool: Bash
    Preconditions: FileList.tsx has been modified
    Steps:
      1. Run: cd frontend && npm run build
      2. Assert: exit code 0
    Expected Result: Build succeeds
    Failure Indicators: TypeScript errors, missing useMemo import
    Evidence: .sisyphus/evidence/task-7-build.txt

  Scenario: sortedFiles wrapped in useMemo
    Tool: Bash
    Preconditions: FileList.tsx has been modified
    Steps:
      1. Run: grep "useMemo" frontend/src/components/FileList.tsx | wc -l
      2. Assert: at least 1 (may be more if other useMemos exist)
      3. Run: grep -A1 "sortedFiles = useMemo" frontend/src/components/FileList.tsx
      4. Assert: at least 1 match
    Expected Result: sortedFiles uses useMemo
    Failure Indicators: sortedFiles still computed directly
    Evidence: .sisyphus/evidence/task-7-usememo.txt
  ```

  **Commit**: YES
  - Message: `perf(filelist): memoize sorted files computation`
  - Files: `frontend/src/components/FileList.tsx`

- [ ] 8. Stream Routes + Service Overhaul (PERF-005 + PERF-006 + PERF-010 + PERF-011)

  **What to do**:
  This task consolidates 4 PERF items that all touch `routes/stream.ts` and/or `services/stream.ts`. They MUST be done together to avoid file conflicts.

  **Part A — Static imports (PERF-011)** in `backend/src/routes/stream.ts`:
  - Move all `await import(...)` calls to static top-level imports:
    - `import { randomBytes } from "crypto";`
    - `import { existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync } from "fs";` (temporary — will be replaced by async in Part C)
    - `import { join } from "path";`
    - `import { tmpdir } from "os";`
    - `import { spawn } from "child_process";` (used by debug endpoint)
  - Also add `getReadStream` to the static import from `sftp.js` (currently only dynamically imported by the debug endpoint at ~line 188)
  - Remove all `await import(...)` calls from handler bodies

  **Part B — Remove redundant testConnection (PERF-006)** in `backend/src/routes/stream.ts`:
  - Remove the `testConnection()` call before `createHlsSession()` in the stream start handler (~line 48-58)
  - Remove `testConnection` from the import at line 13: `import { StorageNotConfiguredError, testConnection, type SftpStream }` → `import { StorageNotConfiguredError, type SftpStream, getReadStream }` (add getReadStream from Part A, remove testConnection)
  - Keep the `StorageNotConfiguredError` check that comes before it (if SFTP settings aren't configured, that check still applies)
  - The error handling in `createHlsSession()` already handles SFTP connection failures

  **Part C — Async file I/O (PERF-005)** in `backend/src/routes/stream.ts`:
  - Replace sync fs calls with async equivalents in ALL route handlers AND the debug endpoint:
    - `mkdirSync(...)` → `await mkdir(...)` (from `fs/promises`)
    - `existsSync(...)` → use `await access(path, constants.F_OK)` wrapped in try/catch helper
    - `rmSync(...)` → `await rm(...)`
    - `readdirSync(...)` → `await readdir(...)`
    - `writeFileSync(...)` → `await writeFile(...)`
    - `unlinkSync(...)` → `await unlink(...)`
  - Update imports: replace `fs` imports with `fs/promises` equivalents + `constants` from `fs`
  - Create a local `fileExists()` async helper function

  **Part D — Async file I/O (PERF-005)** in `backend/src/services/stream.ts`:
  - Replace sync fs calls:
    - `mkdirSync(...)` → `await mkdir(...)` (from `fs/promises`)
    - `existsSync(...)` → async `fileExists()` helper
    - `rmSync(...)` → `await rm(...)`
  - Replace HLS readiness polling (setInterval + existsSync) with `fs.watch()`:
    - **CRITICAL**: Check if file exists FIRST before attaching watcher (race condition — FFmpeg may write before watcher is ready)
    - Pattern:
      ```
      if (await fileExists(playlistPath)) { resolve(); return; }
      const watcher = watch(hlsDir, (_, filename) => { if (filename === "stream.m3u8") { ... } });
      ```
    - Add 120s timeout that cleans up watcher on failure
  - Update imports: add `mkdir, rm, access, readdir` from `fs/promises`, `watch, constants` from `fs`

  **Part E — HLS Session TTL (PERF-010)** in `backend/src/services/stream.ts`:
  - Add `createdAt: number` field to `HlsSession` type (set to `Date.now()`)
  - Add a `setInterval` cleanup sweep every 60 seconds:
    - Check all sessions in `activeSessions` Map
    - Remove sessions where `Date.now() - session.createdAt > SESSION_TTL_MS` (30 minutes)
    - Call `removeSession(id)` for expired sessions
    - **IMPORTANT**: Skip sessions where `createdAt === 0` (sentinel for sessions still initializing / placeholder phase)
  - Set `createdAt` when the session is fully initialized (after the placeholder is replaced with actual session data)
  - Define `const SESSION_TTL_MS = 30 * 60 * 1000;`

  **Must NOT do**:
  - Do NOT remove `testConnection()` function from `sftp.ts` — only remove the call and import in routes/stream.ts
  - Do NOT change startup-time `mkdirSync` in `db.ts`
  - Do NOT add external file watcher libraries — use built-in `fs.watch()`
  - Do NOT add session activity tracking or analytics
  - Do NOT add parallel file operations in the debug endpoint

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-part changes across 2 files, async conversion requires careful handling, fs.watch race condition needs attention
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-11)
  - **Blocks**: None
  - **Blocked By**: None (Wave 1 completion, but no specific Task dependency)

  **References**:

  **Pattern References**:
  - `backend/src/routes/stream.ts` — ENTIRE FILE. Study all handler functions, all dynamic imports (lines 73, 86-88, 177-178, 223-226), the testConnection call (line 48), and the debug endpoint (lines 172-277). All of these are modified.
  - `backend/src/services/stream.ts` — ENTIRE FILE. Study sync fs calls (lines 2, 47, 64-65, 118, 128), the setInterval polling loop (lines 117-123), the HlsSession type definition, and the `activeSessions` Map.

  **API/Type References**:
  - `backend/src/services/stream.ts:HlsSession` — Type to extend with `createdAt: number`
  - `backend/src/services/stream.ts:activeSessions` — Map to iterate in cleanup sweep
  - `backend/src/services/stream.ts:removeSession()` — Existing cleanup function to call for expired sessions

  **External References**:
  - `IDEATION_PERFORMANCE.md:219-253` — Async I/O patterns and fs.watch implementation (PERF-005)
  - `IDEATION_PERFORMANCE.md:283-292` — testConnection removal (PERF-006)
  - `IDEATION_PERFORMANCE.md:469-480` — Session TTL cleanup (PERF-010)
  - `IDEATION_PERFORMANCE.md:517-523` — Static imports target (PERF-011)

  **WHY Each Reference Matters**:
  - `routes/stream.ts` full file — Every handler in this file is affected. You need to see the full structure to convert all sync→async without missing any
  - `services/stream.ts` full file — The polling loop replacement and TTL addition need deep understanding of how sessions are created, tracked, and cleaned up
  - Ideation doc sections — Provide exact code patterns for each change

  **Acceptance Criteria**:

  - [ ] `cd backend && npm run build` exits 0
  - [ ] No `existsSync`, `mkdirSync`, `rmSync`, `readdirSync`, `writeFileSync`, `unlinkSync` calls remain in routes/stream.ts
  - [ ] No `await import(` calls remain in routes/stream.ts
  - [ ] No `testConnection` in routes/stream.ts imports
  - [ ] HlsSession type includes `createdAt` field
  - [ ] Cleanup interval registered in services/stream.ts

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Backend compiles after stream overhaul
    Tool: Bash
    Preconditions: Both stream files modified
    Steps:
      1. Run: cd backend && npm run build
      2. Assert: exit code 0, no TypeScript errors
    Expected Result: Build succeeds with all async conversions
    Failure Indicators: TypeScript errors about missing awaits, wrong types, unused imports
    Evidence: .sisyphus/evidence/task-8-build.txt

  Scenario: No sync fs calls in request paths
    Tool: Bash
    Preconditions: routes/stream.ts modified
    Steps:
      1. Run: grep -n "existsSync\|mkdirSync\|rmSync\|readdirSync\|writeFileSync\|unlinkSync" backend/src/routes/stream.ts
      2. Assert: 0 matches (no sync fs calls remain)
      3. Run: grep -n "existsSync\|mkdirSync\|rmSync" backend/src/services/stream.ts
      4. Assert: 0 matches (no sync fs calls remain)
    Expected Result: All sync fs calls replaced with async equivalents
    Failure Indicators: Any sync fs call still present
    Evidence: .sisyphus/evidence/task-8-no-sync.txt

  Scenario: No dynamic imports in handlers
    Tool: Bash
    Preconditions: routes/stream.ts modified
    Steps:
      1. Run: grep "await import(" backend/src/routes/stream.ts
      2. Assert: 0 matches
    Expected Result: All imports are static top-level
    Failure Indicators: Any await import() remaining
    Evidence: .sisyphus/evidence/task-8-no-dynamic-imports.txt

  Scenario: testConnection removed from stream routes
    Tool: Bash
    Preconditions: routes/stream.ts modified
    Steps:
      1. Run: grep "testConnection" backend/src/routes/stream.ts
      2. Assert: 0 matches (removed from both import and usage)
      3. Run: grep "testConnection" backend/src/services/sftp.ts
      4. Assert: at least 1 match (function still exists in sftp.ts)
    Expected Result: testConnection call removed from stream routes but function preserved in sftp service
    Failure Indicators: testConnection still referenced in stream routes, or removed from sftp service
    Evidence: .sisyphus/evidence/task-8-testconnection.txt

  Scenario: HLS session TTL cleanup registered
    Tool: Bash
    Preconditions: services/stream.ts modified
    Steps:
      1. Run: grep "SESSION_TTL_MS" backend/src/services/stream.ts
      2. Assert: at least 1 match
      3. Run: grep "setInterval" backend/src/services/stream.ts
      4. Assert: at least 1 match (cleanup interval)
      5. Run: grep "createdAt" backend/src/services/stream.ts
      6. Assert: at least 2 matches (type definition + assignment)
    Expected Result: TTL constant defined, cleanup interval registered, createdAt field added
    Failure Indicators: Missing TTL, missing interval, missing createdAt
    Evidence: .sisyphus/evidence/task-8-ttl.txt

  Scenario: fs.watch with race condition guard
    Tool: Bash
    Preconditions: services/stream.ts modified
    Steps:
      1. Run: grep "watch(" backend/src/services/stream.ts
      2. Assert: at least 1 match (fs.watch for HLS readiness)
      3. Run: grep -B5 "watch(" backend/src/services/stream.ts | grep -E "access|fileExists|exists"
      4. Assert: at least 1 match (existence check before watch setup)
    Expected Result: fs.watch is used with existence pre-check to prevent race condition
    Failure Indicators: watch without preceding existence check
    Evidence: .sisyphus/evidence/task-8-fswatch.txt
  ```

  **Commit**: YES
  - Message: `perf(stream): async I/O, remove redundant testConnection, static imports, session TTL`
  - Files: `backend/src/routes/stream.ts`, `backend/src/services/stream.ts`

- [ ] 9. File Routes Optimization — SFTP Reuse + Batch Delete + Parsing (PERF-001 route + PERF-002 route + PERF-007)

  **What to do**:
  This task applies the new SFTP batch functions (from Task 2) in the file routes and optimizes filename parsing.

  **Part A — Single-connection download (PERF-001 route)** in `backend/src/routes/files.ts`:
  - Replace the two separate calls in the download handler (~lines 347-426):
    - Old: `size = await getFileSize(remoteFilePath);` then `sftpHandle = await getReadStream(remoteFilePath);`
    - New: `const { stream, sftp, size } = await getReadStreamWithSize(remoteFilePath);`
  - Update imports: add `getReadStreamWithSize` from `../services/sftp.js`
  - Clean up `getFileSize` import if it becomes unused (TypeScript `noUnusedLocals` will fail). Check if `getFileSize` is used elsewhere in this file — if not, remove from import.
  - Ensure `sftp.end()` call happens in the same place as current cleanup (likely in `finally` block or stream end/error handler)

  **Part B — Batch delete (PERF-002 route)** in `backend/src/routes/files.ts`:
  - Replace the sequential loop in `POST /api/bulk-delete` (~lines 534-577):
    - Old: `for (const raw of fileList) { await deleteFile(remoteFilePath); }`
    - New: `const results = await deleteFiles(validatedFileNames);`
  - Update imports: add `deleteFiles` from `../services/sftp.js`
  - Clean up `deleteFile` import if it becomes unused
  - Translate `Map<string, Error | null>` results back to existing response format: `{ results: [{ file, success, error }] }`
  - IMPORTANT: Still call `logAction()` for each successfully deleted file individually (audit trail must be preserved)

  **Part C — Optimize filename parsing (PERF-007)** in `backend/src/routes/files.ts`:
  - In the `/api/files` handler (~lines 265-289), optimize the `.map()`:
    - Only call `buildParsedMetadata()` for non-directory entries: `parsed: file.isDirectory ? undefined : buildParsedMetadata(file.name)`
    - This avoids parsing the ".." entry and directory names
  - Verify `shouldIncludeFile()` doesn't call `buildParsedMetadata()` again redundantly — if it does, ensure it uses the already-parsed value

  **Must NOT do**:
  - Do NOT modify the existing `POST /api/bulk-download` endpoint (that's Task 12 / PERF-008)
  - Do NOT change the response format of any endpoint
  - Do NOT add SFTP connection pooling
  - Do NOT change filename validation logic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple changes across a large route file, import management with noUnusedLocals
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 10-11)
  - **Blocks**: Task 12 (files.ts must be stable before adding PERF-008 endpoint)
  - **Blocked By**: Task 2 (needs `getReadStreamWithSize` and `deleteFiles` from sftp.ts)

  **References**:

  **Pattern References**:
  - `backend/src/routes/files.ts:347-426` — Download handler. Find the `getFileSize()` and `getReadStream()` calls to replace with `getReadStreamWithSize()`
  - `backend/src/routes/files.ts:534-577` — Bulk delete handler. Find the sequential `deleteFile()` loop to replace with `deleteFiles()` batch
  - `backend/src/routes/files.ts:265-289` — File listing handler. Find the `.map()` call with `buildParsedMetadata()`
  - `backend/src/routes/files.ts:303-343` — Existing download-token pattern (useful context for understanding download flow)

  **API/Type References**:
  - `backend/src/services/sftp.ts:getReadStreamWithSize()` — New function from Task 2. Returns `{ stream, sftp, size }`
  - `backend/src/services/sftp.ts:deleteFiles()` — New function from Task 2. Returns `Map<string, Error | null>`

  **External References**:
  - `IDEATION_PERFORMANCE.md:27-47` — PERF-001 download optimization
  - `IDEATION_PERFORMANCE.md:69-101` — PERF-002 bulk delete batching
  - `IDEATION_PERFORMANCE.md:316-329` — PERF-007 parsing optimization

  **WHY Each Reference Matters**:
  - Download handler — Exact location of the two SFTP calls and how stream/size are used downstream
  - Bulk delete handler — Response format construction and `logAction()` calls to preserve
  - File listing handler — `.map()` to add `isDirectory` guard
  - New SFTP functions — Return types to correctly destructure results

  **Acceptance Criteria**:

  - [ ] `cd backend && npm run build` exits 0
  - [ ] No unused imports (getFileSize, deleteFile removed if not used elsewhere)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Backend compiles with optimized file routes
    Tool: Bash
    Preconditions: files.ts modified, Task 2 completed
    Steps:
      1. Run: cd backend && npm run build
      2. Assert: exit code 0, no TypeScript errors
    Expected Result: Build succeeds
    Failure Indicators: TypeScript errors, unused import errors
    Evidence: .sisyphus/evidence/task-9-build.txt

  Scenario: Download handler uses getReadStreamWithSize
    Tool: Bash
    Preconditions: files.ts modified
    Steps:
      1. Run: grep "getReadStreamWithSize" backend/src/routes/files.ts
      2. Assert: at least 1 match
      3. Run: grep -c "await getFileSize(" backend/src/routes/files.ts
      4. Assert: output is "0" (no more separate getFileSize calls in download)
    Expected Result: Download uses single-connection function
    Failure Indicators: getReadStreamWithSize missing, getFileSize still called
    Evidence: .sisyphus/evidence/task-9-download.txt

  Scenario: Bulk delete uses batch function
    Tool: Bash
    Preconditions: files.ts modified
    Steps:
      1. Run: grep "deleteFiles" backend/src/routes/files.ts
      2. Assert: at least 1 match
      3. Run: grep -c "await deleteFile(" backend/src/routes/files.ts
      4. Assert: output is "0" (no individual deleteFile in bulk handler)
    Expected Result: Bulk delete uses batch function
    Failure Indicators: Individual deleteFile calls still present
    Evidence: .sisyphus/evidence/task-9-bulk-delete.txt

  Scenario: File listing skips directory parsing
    Tool: Bash
    Preconditions: files.ts modified
    Steps:
      1. Run: grep "isDirectory" backend/src/routes/files.ts
      2. Assert: at least 1 match in the mapping context
    Expected Result: Parsing skipped for directory entries
    Failure Indicators: No isDirectory check in mapping
    Evidence: .sisyphus/evidence/task-9-parsing.txt
  ```

  **Commit**: YES
  - Message: `perf(files): use batch SFTP functions and optimize filename parsing`
  - Files: `backend/src/routes/files.ts`

- [ ] 10. Auth User Cache with TTL (PERF-009)

  **What to do**:
  - In `backend/src/services/users.ts`, add an in-memory user cache:
    - Create `const userCache = new Map<number, { user: SafeUser; cachedAt: number }>();`
    - Define `const CACHE_TTL_MS = 30_000;` (30 seconds)
    - Modify `getActiveUserForToken()` to check cache first:
      1. If cached entry exists AND `Date.now() - cachedAt < CACHE_TTL_MS` AND token `iat` >= user `updatedAt` → return cached user
      2. Otherwise, query DB as before, then cache the result
    - Add cache invalidation: call `userCache.delete(userId)` inside `updateUserByAdmin()` and `deleteUserByAdmin()` (or wherever users are modified)
    - Export a `clearUserCache()` function for testing (optional but recommended)

  **Must NOT do**:
  - Do NOT add Redis or any external cache
  - Do NOT increase TTL beyond 30 seconds
  - Do NOT cache failed lookups (null results)
  - Do NOT change the auth plugin itself (plugin calls `getActiveUserForToken` which is where caching lives)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple in-memory cache addition
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-9, 11)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `backend/src/services/users.ts:123-141` — `getActiveUserForToken()` to add caching to
  - `backend/src/services/users.ts` — Find `updateUserByAdmin()` and `deleteUserByAdmin()` for cache invalidation

  **API/Type References**:
  - `backend/src/services/users.ts:SafeUser` — Type stored in cache
  - `backend/src/plugins/auth.ts:40-56` — `hydrateActiveUser()` calls `getActiveUserForToken()`

  **External References**:
  - `IDEATION_PERFORMANCE.md:414-437` — Target cache implementation (PERF-009)

  **WHY Each Reference Matters**:
  - `getActiveUserForToken()` — Function to wrap with caching. Understand current DB lookup + token `iat` validation
  - User modification functions — MUST add `userCache.delete()` here. Without invalidation, deleted users stay authenticated for up to 30s

  **Acceptance Criteria**:

  - [ ] `cd backend && npm run build` exits 0
  - [ ] Cache invalidation present in user update/delete functions

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Backend compiles with user cache
    Tool: Bash
    Preconditions: users.ts modified
    Steps:
      1. Run: cd backend && npm run build
      2. Assert: exit code 0
    Expected Result: Build succeeds
    Failure Indicators: TypeScript errors
    Evidence: .sisyphus/evidence/task-10-build.txt

  Scenario: Cache implementation present
    Tool: Bash
    Preconditions: users.ts modified
    Steps:
      1. Run: grep "userCache" backend/src/services/users.ts | wc -l
      2. Assert: at least 3
      3. Run: grep "CACHE_TTL_MS" backend/src/services/users.ts
      4. Assert: at least 1 match
    Expected Result: Cache with TTL implemented
    Failure Indicators: Missing cache or TTL
    Evidence: .sisyphus/evidence/task-10-cache.txt

  Scenario: Cache invalidation on user changes
    Tool: Bash
    Preconditions: users.ts modified
    Steps:
      1. Run: grep "userCache.delete" backend/src/services/users.ts
      2. Assert: at least 2 matches (update + delete functions)
    Expected Result: Cache cleared on user modifications
    Failure Indicators: No invalidation calls
    Evidence: .sisyphus/evidence/task-10-invalidation.txt
  ```

  **Commit**: YES
  - Message: `perf(auth): add in-memory user cache with TTL`
  - Files: `backend/src/services/users.ts`

- [ ] 11. Admin Panel Code Splitting (PERF-015)

  **What to do**:
  - In `frontend/src/App.tsx`:
    - Replace static import of `AdminPanel` with `React.lazy()`:
      - Old: `import AdminPanel from "./components/admin/AdminPanel";`
      - New: `const AdminPanel = lazy(() => import("./components/admin/AdminPanel"));`
    - Add `lazy` and `Suspense` to React imports
    - Wrap `<AdminPanel />` usage in `<Suspense fallback={<div>Loading...</div>}>`:
      ```tsx
      <Suspense fallback={<div>Loading...</div>}>
        <AdminPanel />
      </Suspense>
      ```
  - Verify AdminPanel uses `export default` (required for React.lazy)

  **Must NOT do**:
  - Do NOT lazy-load other components (VideoPlayer, FileList, etc.)
  - Do NOT add a custom loading spinner
  - Do NOT change routing structure

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard React.lazy pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-10)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `frontend/src/App.tsx:1-6` — Current imports (eager AdminPanel import to replace)
  - `frontend/src/App.tsx` — Find where `<AdminPanel />` is rendered
  - `frontend/src/components/admin/AdminPanel.tsx` — Verify `export default`

  **External References**:
  - `IDEATION_PERFORMANCE.md:657-674` — Target implementation (PERF-015)

  **WHY Each Reference Matters**:
  - `App.tsx` imports — Which import to replace
  - AdminPanel render location — Where to add Suspense wrapper
  - AdminPanel export — React.lazy requires default export

  **Acceptance Criteria**:

  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Frontend compiles with lazy-loaded admin
    Tool: Bash
    Preconditions: App.tsx modified
    Steps:
      1. Run: cd frontend && npm run build
      2. Assert: exit code 0
    Expected Result: Build succeeds
    Failure Indicators: TypeScript errors
    Evidence: .sisyphus/evidence/task-11-build.txt

  Scenario: AdminPanel is lazy-loaded
    Tool: Bash
    Preconditions: App.tsx modified
    Steps:
      1. Run: grep "lazy(" frontend/src/App.tsx
      2. Assert: at least 1 match
      3. Run: grep "Suspense" frontend/src/App.tsx
      4. Assert: at least 1 match
      5. Run: grep 'import AdminPanel from' frontend/src/App.tsx
      6. Assert: 0 matches (static import removed)
    Expected Result: AdminPanel lazy-loaded with Suspense
    Failure Indicators: Static import still present
    Evidence: .sisyphus/evidence/task-11-lazy.txt

  Scenario: Separate admin chunk in build
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run: cd frontend && npm run build 2>&1
      2. Run: ls frontend/dist/assets/*.js | wc -l
      3. Assert: at least 3 files (main + vendor + lazy chunk)
    Expected Result: Separate chunk for AdminPanel
    Failure Indicators: Only 1-2 JS chunks
    Evidence: .sisyphus/evidence/task-11-chunks.txt
  ```

  **Commit**: YES
  - Message: `perf(admin): lazy-load admin panel with React.lazy`
  - Files: `frontend/src/App.tsx`

- [ ] 12. Bulk Download Token Endpoint + Streaming Frontend (PERF-008)

  **What to do**:
  This is the most invasive optimization — adds a new backend endpoint and changes the frontend download flow.

  **Part A — New `POST /api/bulk-download-token` endpoint** in `backend/src/routes/files.ts`:
  - Follow the EXISTING download-token pattern at lines 303-343 of files.ts:
    - Accept: `{ files: string[], path: string }` in request body
    - Validate all filenames (same validation as existing bulk-delete: no path traversal)
    - Generate a short-lived JWT (e.g., 60 seconds) containing the file list + path
    - Return: `{ downloadUrl: "/api/bulk-download?downloadToken=<jwt>" }`
  - Register the route with `requireRole(["admin", "viewer"])` (same as existing bulk-download)

  **Part B — New `GET /api/bulk-download` handler** in `backend/src/routes/files.ts`:
  - Add a GET handler alongside the existing POST handler for `/api/bulk-download`
  - GET handler accepts `?downloadToken=<jwt>` query parameter
  - Decode JWT to extract file list and path
  - Stream ZIP response (reuse the existing POST handler's ZIP logic with `archiver`)
  - The existing POST `/api/bulk-download` with Authorization header MUST continue working unchanged

  **Part C — Auth hook update** in `backend/src/plugins/auth.ts`:
  - The auth hook currently handles `?token=` for the single-file download endpoint
  - Extend it to also handle `?downloadToken=` for the `/api/bulk-download` GET endpoint
  - Follow the same pattern: check URL path, extract token from query, verify JWT, set request user
  - Alternatively, if the auth hook already handles this generically, just verify it works for the new endpoint

  **Part D — Frontend update** in `frontend/src/components/FileList.tsx`:
  - Replace `handleBulkDownload()` to use the token approach:
    - POST to `/api/bulk-download-token` to get a `{ downloadUrl }` response
    - Create an `<a>` element with `href = downloadUrl`, `download = "nvr-recordings.zip"`, click it programmatically
    - This lets the browser stream the download to disk instead of buffering in memory
  - Keep the same error handling and loading state (`setBulkDownloading`)
  - Add a size guard: if more than 50 files selected, the JWT might get large. Add a reasonable limit (100 files max) with an error message.

  **Must NOT do**:
  - Do NOT remove or modify the existing `POST /api/bulk-download` handler
  - Do NOT add download progress indicators
  - Do NOT add SFTP connection pooling for the ZIP stream
  - Do NOT change the ZIP generation logic itself (archiver is fine)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: New endpoint + auth hook changes + frontend change. Most complex single task.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (solo)
  - **Blocks**: Task 13 (testing wave)
  - **Blocked By**: Task 7 (FileList.tsx useMemo done first), Task 9 (files.ts route changes done first)

  **References**:

  **Pattern References**:
  - `backend/src/routes/files.ts:303-343` — **CRITICAL**: Existing download-token pattern. This is your template for Part A. It shows: JWT creation with file info, short expiry, response format. Copy this pattern.
  - `backend/src/routes/files.ts:347-426` — Existing single-file download handler that reads the token. Shows how the token-based flow works end-to-end.
  - `backend/src/routes/files.ts:468-530` — Existing `POST /api/bulk-download` handler. The ZIP streaming logic here will be reused/shared with the new GET handler. Study how `archiver` is set up and how SFTP streams are piped.
  - `backend/src/plugins/auth.ts` — Auth hook. Find where `?token=` is handled for download URLs. Extend this pattern for `?downloadToken=` on bulk-download.
  - `frontend/src/components/FileList.tsx:378-404` — Current `handleBulkDownload()` to replace with token approach.

  **API/Type References**:
  - `@fastify/jwt` — JWT sign/verify methods available on the Fastify instance

  **External References**:
  - `IDEATION_PERFORMANCE.md:356-386` — Target implementation concept (PERF-008)

  **WHY Each Reference Matters**:
  - Existing download-token pattern — **This is the blueprint.** Don't invent a new pattern — copy the working one.
  - Existing bulk-download POST — You need the ZIP logic to share with the new GET handler
  - Auth hook — You need to understand how token-based auth bypass works to extend it
  - Current handleBulkDownload — You need to see the current flow to know what to replace

  **Acceptance Criteria**:

  - [ ] `cd backend && npm run build` exits 0
  - [ ] `cd frontend && npm run build` exits 0
  - [ ] New `POST /api/bulk-download-token` endpoint exists
  - [ ] New `GET /api/bulk-download` handler exists (alongside existing POST)
  - [ ] Existing `POST /api/bulk-download` still works unchanged
  - [ ] Frontend uses token-based download flow

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Both backend and frontend compile
    Tool: Bash
    Preconditions: files.ts, auth.ts, FileList.tsx modified
    Steps:
      1. Run: cd backend && npm run build
      2. Assert: exit code 0
      3. Run: cd frontend && npm run build
      4. Assert: exit code 0
    Expected Result: Both build successfully
    Failure Indicators: TypeScript errors in any file
    Evidence: .sisyphus/evidence/task-12-build.txt

  Scenario: Bulk download token endpoint exists
    Tool: Bash
    Preconditions: files.ts modified
    Steps:
      1. Run: grep "bulk-download-token" backend/src/routes/files.ts
      2. Assert: at least 1 match (route registration)
      3. Run: grep "downloadUrl" backend/src/routes/files.ts
      4. Assert: at least 1 match (response format)
    Expected Result: Token endpoint registered and returns downloadUrl
    Failure Indicators: Missing route or response format
    Evidence: .sisyphus/evidence/task-12-token-endpoint.txt

  Scenario: GET handler for bulk-download exists
    Tool: Bash
    Preconditions: files.ts modified
    Steps:
      1. Run: grep -c "bulk-download" backend/src/routes/files.ts
      2. Assert: at least 3 matches (POST handler + GET handler + token endpoint)
      3. Run: grep "downloadToken" backend/src/routes/files.ts
      4. Assert: at least 1 match (query param handling)
    Expected Result: GET handler accepts downloadToken query param
    Failure Indicators: Missing GET handler or downloadToken handling
    Evidence: .sisyphus/evidence/task-12-get-handler.txt

  Scenario: Frontend uses token-based bulk download
    Tool: Bash
    Preconditions: FileList.tsx modified
    Steps:
      1. Run: grep "bulk-download-token" frontend/src/components/FileList.tsx
      2. Assert: at least 1 match (POST to token endpoint)
      3. Run: grep "res.blob()" frontend/src/components/FileList.tsx
      4. Assert: 0 matches (blob buffering removed)
      5. Run: grep "createElement.*a" frontend/src/components/FileList.tsx
      6. Assert: at least 1 match (anchor tag for streaming download)
    Expected Result: Frontend uses token approach, no blob buffering
    Failure Indicators: blob() still used, or missing token fetch
    Evidence: .sisyphus/evidence/task-12-frontend.txt

  Scenario: Existing POST bulk-download preserved
    Tool: Bash
    Preconditions: files.ts modified
    Steps:
      1. Run: grep -B2 "POST.*bulk-download\b" backend/src/routes/files.ts | head -5
      2. Assert: POST handler registration still present
    Expected Result: Original POST endpoint unchanged
    Failure Indicators: POST handler removed or modified
    Evidence: .sisyphus/evidence/task-12-post-preserved.txt
  ```

  **Commit**: YES
  - Message: `perf(download): add bulk download token endpoint for streaming downloads`
  - Files: `backend/src/routes/files.ts`, `backend/src/plugins/auth.ts`, `frontend/src/components/FileList.tsx`

- [ ] 13. Test Infrastructure Setup (vitest)

  **What to do**:
  - Install vitest as a dev dependency in backend: `npm install -D vitest`
  - Create `backend/vitest.config.ts` with TypeScript + ESM support:
    - Set `test.include` to `["src/**/*.test.ts"]`
    - Configure `resolve.extensions` for `.ts` files
    - Set `test.globals` to `true` if desired
  - Add `"test": "vitest run"` script to `backend/package.json`
  - Create one simple smoke test to verify the setup works:
    - `backend/src/services/filenameParser.test.ts` — Test `parseNvrFilename()` with known inputs:
      - Valid filename: `ch0_2026-02-03_07-11-54_2026-02-03_07-13-41.dav` → verify parsed fields
      - Invalid filename: `random.mp4` → verify returns null
    - This tests the infrastructure and validates an existing pure function

  **Must NOT do**:
  - Do NOT install vitest in frontend (only backend for now)
  - Do NOT add test coverage requirements
  - Do NOT add complex test utilities or helpers beyond what vitest provides
  - Do NOT write tests for all optimizations here (that's Task 14)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Package install + config file + one test file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential with Task 14)
  - **Blocks**: Task 14
  - **Blocked By**: Task 12 (all implementation complete)

  **References**:

  **Pattern References**:
  - `backend/package.json` — Add test script here
  - `backend/tsconfig.json` — TypeScript config to understand compiler settings for test config
  - `backend/src/services/filenameParser.ts` — Pure function to write smoke test against

  **External References**:
  - vitest docs: https://vitest.dev/config/ — Configuration reference

  **WHY Each Reference Matters**:
  - `package.json` — Need to add scripts and devDependencies
  - `tsconfig.json` — vitest config should align with existing TS settings
  - `filenameParser.ts` — Pure function, no mocking needed, perfect for a smoke test

  **Acceptance Criteria**:

  - [ ] `cd backend && npx vitest run` exits 0 with at least 1 test passing
  - [ ] `cd backend && npm run build` still exits 0

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Vitest runs and passes
    Tool: Bash
    Preconditions: vitest installed, config created, smoke test written
    Steps:
      1. Run: cd backend && npx vitest run
      2. Assert: exit code 0
      3. Assert: output contains "pass" and at least "1 passed" or "2 passed"
    Expected Result: Test suite runs with passing tests
    Failure Indicators: vitest not found, config errors, test failures
    Evidence: .sisyphus/evidence/task-13-vitest.txt

  Scenario: Backend build unaffected by test setup
    Tool: Bash
    Preconditions: vitest config added
    Steps:
      1. Run: cd backend && npm run build
      2. Assert: exit code 0
    Expected Result: Build still succeeds (test files excluded from build)
    Failure Indicators: Build errors from test files or vitest config
    Evidence: .sisyphus/evidence/task-13-build.txt
  ```

  **Commit**: YES (grouped with Task 14)
  - Message: `test: add vitest infrastructure and optimization test suite`
  - Files: `backend/vitest.config.ts`, `backend/package.json`, `backend/src/services/filenameParser.test.ts`

- [ ] 14. Optimization Test Suite

  **What to do**:
  Write tests for the key behavioral changes introduced by the optimizations. Focus on testable logic, not config changes.

  **Tests to write**:
  1. `backend/src/services/sftp.test.ts` — Test `deleteFiles()` result format:
     - Verify it returns a Map with correct structure
     - Note: Actual SFTP testing requires mocking — mock `connectSftp()` to return a fake client
     - Test that `sftp.end()` is called in the finally block (spy)
     - Test that individual file errors don't abort the batch

  2. `backend/src/services/users.test.ts` — Test auth cache behavior:
     - Test cache hit: call `getActiveUserForToken()` twice, verify DB is hit only once
     - Test cache miss after TTL: advance time past 30s, verify DB is hit again
     - Test cache invalidation: call update, then verify cache miss
     - Mock `findUserById()` and use `vi.useFakeTimers()` for time control

  3. `backend/src/services/stream.test.ts` — Test session TTL logic:
     - Test that sessions with `createdAt` older than TTL are cleaned up
     - Test that sessions with `createdAt: 0` (placeholder) are NOT cleaned up
     - This may require extracting the cleanup logic into a testable function

  **Must NOT do**:
  - Do NOT write integration tests requiring running SFTP/Docker
  - Do NOT write frontend tests (no frontend test infra yet)
  - Do NOT aim for 100% coverage — test the behavioral changes only
  - Do NOT add snapshot tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Writing tests requires understanding mocking patterns and the code under test
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Task 13)
  - **Blocks**: F1-F4 (verification wave)
  - **Blocked By**: Task 13 (test infrastructure must be set up)

  **References**:

  **Pattern References**:
  - `backend/src/services/filenameParser.test.ts` — Smoke test from Task 13. Follow the same test file structure.
  - `backend/src/services/sftp.ts` — Functions to test: `deleteFiles()`, `getReadStreamWithSize()`
  - `backend/src/services/users.ts` — Functions to test: `getActiveUserForToken()`, cache invalidation
  - `backend/src/services/stream.ts` — Session TTL cleanup logic to test

  **External References**:
  - vitest docs: https://vitest.dev/api/vi.html — Mocking API (`vi.fn()`, `vi.mock()`, `vi.useFakeTimers()`)

  **WHY Each Reference Matters**:
  - Smoke test — Pattern for how tests are structured in this project
  - Service files — Understand the actual function signatures and dependencies to mock
  - vitest API — For mocking and timer control

  **Acceptance Criteria**:

  - [ ] `cd backend && npx vitest run` exits 0 with all tests passing
  - [ ] At least 6 test cases across the 3 test files

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All optimization tests pass
    Tool: Bash
    Preconditions: All test files written, Task 13 complete
    Steps:
      1. Run: cd backend && npx vitest run
      2. Assert: exit code 0
      3. Assert: output shows 0 failures
      4. Assert: output mentions at least 3 test files
    Expected Result: Full test suite passes
    Failure Indicators: Any test failure, missing test files
    Evidence: .sisyphus/evidence/task-14-tests.txt

  Scenario: Tests cover key optimization behaviors
    Tool: Bash
    Preconditions: Test files written
    Steps:
      1. Run: grep -r "describe\|it(" backend/src/services/*.test.ts | wc -l
      2. Assert: at least 6 (minimum test cases)
      3. Run: ls backend/src/services/*.test.ts
      4. Assert: at least 3 test files (sftp, users, stream)
    Expected Result: Sufficient test coverage for optimization behaviors
    Failure Indicators: Too few tests or missing test files
    Evidence: .sisyphus/evidence/task-14-coverage.txt
  ```

  **Commit**: YES (grouped with Task 13)
  - Message: `test: add vitest infrastructure and optimization test suite`
  - Files: `backend/src/services/sftp.test.ts`, `backend/src/services/users.test.ts`, `backend/src/services/stream.test.ts`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan. Verify all 17 PERF items are addressed.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | PERF Items [17/17] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `cd backend && npm run build` + `cd frontend && npm run build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports (critical with `noUnusedLocals: true`). Check AI slop: excessive comments, over-abstraction, generic names. Verify no sync fs calls remain in request paths (PERF-005 compliance).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start dev environment (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up`). Execute EVERY QA scenario from EVERY task. Test cross-task integration: download a file (PERF-001), bulk delete files (PERF-002), start a stream (PERF-005/006/010/011), check nginx headers (PERF-003/004). Test edge cases: empty file list, invalid bulk download token, expired session. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Specifically verify: `testConnection()` still in sftp.ts, existing `POST /api/bulk-download` unchanged, no connection pooling, no Brotli, no VideoPlayer lazy-loading. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Creep [CLEAN/N issues] | Must-NOT [CLEAN/N violations] | VERDICT`

---

## Commit Strategy

| Commit | Tasks | Message | Files |
|--------|-------|---------|-------|
| 1 | T1 | `perf(nginx): add gzip compression and static asset caching` | `docker/nginx.conf` |
| 2 | T2 | `perf(sftp): add batch functions for single-connection operations` | `backend/src/services/sftp.ts` |
| 3 | T3 | `perf(auth): memoize login function with useCallback` | `frontend/src/auth.tsx` |
| 4 | T4 | `perf(video): use exponential backoff for HLS playlist polling` | `frontend/src/components/VideoPlayer.tsx` |
| 5 | T5 | `perf(db): add index on audit_logs.created_at` | `backend/src/services/audit.ts` |
| 6 | T6 | `perf(build): add Vite manual chunk splitting` | `frontend/vite.config.ts` |
| 7 | T7 | `perf(filelist): memoize sorted files computation` | `frontend/src/components/FileList.tsx` |
| 8 | T8 | `perf(stream): async I/O, remove redundant testConnection, static imports, session TTL` | `backend/src/routes/stream.ts`, `backend/src/services/stream.ts` |
| 9 | T9 | `perf(files): use batch SFTP functions and optimize filename parsing` | `backend/src/routes/files.ts` |
| 10 | T10 | `perf(auth): add in-memory user cache with TTL` | `backend/src/services/users.ts`, `backend/src/plugins/auth.ts` |
| 11 | T11 | `perf(admin): lazy-load admin panel with React.lazy` | `frontend/src/App.tsx` |
| 12 | T12 | `perf(download): add bulk download token endpoint for streaming downloads` | `backend/src/routes/files.ts`, `backend/src/plugins/auth.ts`, `frontend/src/components/FileList.tsx` |
| 13 | T13+T14 | `test: add vitest infrastructure and optimization test suite` | `backend/vitest.config.ts`, `backend/src/**/*.test.ts` |

---

## Success Criteria

### Verification Commands
```bash
cd backend && npm run build           # Expected: exit 0, no TypeScript errors
cd frontend && npm run build          # Expected: exit 0, no TypeScript errors
cd backend && npx vitest run          # Expected: all tests pass
ls frontend/dist/assets/              # Expected: separate vendor-*.js, hls-*.js chunks
```

### Final Checklist
- [ ] All 17 PERF items implemented (PERF-001 through PERF-017)
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Backend builds cleanly (strict mode, no unused imports)
- [ ] Frontend builds cleanly with correct chunk splitting
- [ ] Test suite passes
- [ ] No regressions in core functionality (browse, download, stream, bulk ops)
