# Admin Panel — Learnings

## 2026-04-02 Session Start
- Plan: `.sisyphus/plans/admin-panel.md`
- Preceding plan `ui-ux-improvements` had 8/8 implementation tasks done; F1-F4 verification was pending but skipped to avoid file conflicts with admin-panel.
- Key codebase facts confirmed during planning:
  - Backend: Fastify 5, ESM (`.js` extensions in imports), SQLite via better-sqlite3, JWT auth with roles admin/viewer
  - Frontend: React 19, Vite 8, inline styles only, no router yet
  - SFTP config currently from `.env` via `config.storage.*` in `backend/src/config.ts`
  - Auth hook in `backend/src/plugins/auth.ts` does JWT-only verification (no DB lookup)
  - nginx already has SPA fallback for client-side routing

## 2026-04-02 Frontend Routing
- Added `react-router-dom` to the frontend and wrapped `AuthProvider` inside `BrowserRouter` in `src/main.tsx`.
- `App.tsx` now keeps the existing auth/loading shell while using `Routes` with `/` for `FileList`, `/admin` for an admin-only placeholder, and a wildcard redirect back to `/`.
- Header navigation fits the existing inline-style pattern; the Administration `NavLink` is rendered only when `isAdmin` is true.
- `npm run build` passes after the router change; Vite still reports a non-failing large-chunk warning for the existing bundle.

## 2026-04-02 Admin Panel UI (Task 8)
- Replaced placeholder `AdminPanel.tsx` with tab-based layout (Users | Server) using simple `useState<Tab>` switching.
- `AdminUsersSection.tsx`: Full CRUD with inline forms. Key patterns:
  - Inline edit replaces the row with a `colSpan={5}` form (same pattern as FileList confirm-delete but for editing)
  - `forceRelogin` from PUT response triggers immediate `logout()` — no need to check conditions, API decides
  - Self-delete protection via `disabled={currentUser?.id === u.id}` on the Delete button
  - Role badges styled consistently with channel badges from FileList (pill shape, colored background)
- `AdminServerSection.tsx`: Settings form with:
  - Password field `required={!settings?.hasPassword}` — only required when no password is stored
  - Yellow banner for unconfigured state, success message for saves
  - Port stored as string in form state, parsed to int on submit (matches API contract `port: number`)
  - After save: clear password field + re-fetch to update `hasPassword`/`updatedAt` display
- Style tokens reused: `cardStyle`, `labelStyle`, `inputStyle`, `primaryBtnStyle`, `actionBtn()` — all match LoginPage and FileList patterns
- `npm run build` passes, zero LSP errors across all three files
