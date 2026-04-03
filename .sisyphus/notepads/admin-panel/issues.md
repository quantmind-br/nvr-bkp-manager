# Admin Panel — Issues

(No issues yet)

## 2026-04-02 F3 QA
- `GET /api/admin/users` returns rows from `listUsers()` with SQLite column names `created_at` / `updated_at`, but `AdminUsersSection.tsx` reads `createdAt` / `updatedAt`; created/updated timestamps will render as `-`.
- Duplicate username creation path is not mapped cleanly: `createUser()` inserts directly without translating SQLite unique errors into `UserConflictError`, while `POST /api/admin/users` only catches `UserConflictError`, so duplicate creates likely surface as uncaught 500s instead of a 409/API message.

## 2026-04-02 F4 Scope Fidelity Audit
- Scope constraints 1-8 passed: no `config.storage` runtime fallback, no extra roles, no test infrastructure, no Docker/nginx diff, admin routes live under `/api/admin/*`, no admin CSS/framework additions, `FileList.tsx` has no admin CRUD/settings code, and package manifest diff only adds `react-router-dom` in `frontend/package.json`.
- Additional audit failure outside constraints 1-8: `backend/src/config.ts` still hardcodes sensitive defaults for `JWT_SECRET` (`"dev-secret-change-in-production"`) and `DEFAULT_ADMIN_PASSWORD` fallback (`"admin"`), so the overall security check should reject approval until those defaults are removed or justified.
