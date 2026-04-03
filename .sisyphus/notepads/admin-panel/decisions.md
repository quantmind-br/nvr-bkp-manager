# Admin Panel — Decisions

## 2026-04-02 Planning
- Settings table: singleton row with `id=1`, not key/value
- SFTP bootstrap: manual only, no env seed/fallback
- Admin routes: `/api/admin/*` (NOT under `/api/auth/*`)
- GET settings: expose `hasPassword`/`isConfigured`, never raw password
- PUT settings: blank password = keep current; test connection before saving
- Auth revalidation: DB lookup per request + invalidate tokens older than `users.updated_at`
- Frontend: `react-router-dom` with real `/admin` route
- Last-admin protection: enforced in service layer transactions, not just UI
- Self-edit: allowed; self-delete: blocked
- forceRelogin: when admin edits own user, API returns `{ forceRelogin: true }` and frontend calls `logout()`
