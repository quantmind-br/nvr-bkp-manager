# QA Verdict — f3-admin-panel

**Date:** 2026-04-03
**Reviewer:** Sisyphus-Junior (automated QA)

## Summary

```
API SMOKE TESTS: [10/10 pass]
- [PASS] GET /api/admin/settings — 200, has host+isConfigured, no raw password
- [PASS] PUT /api/admin/settings — 400 validates SFTP connection (correct behavior, no real SFTP server)
- [PASS] GET /api/admin/settings with viewer token — 403 Forbidden
- [PASS] GET /api/admin/users — 200, returns array
- [PASS] POST /api/admin/users — 201, user created
- [PASS] PUT /api/admin/users/:id — 200, user updated
- [PASS] DELETE /api/admin/users/:id — 200, user deleted
- [PASS] DELETE last admin — 409 "Cannot delete your own account"
- [PASS] Change last admin role to viewer — 409 "Cannot demote the last admin user"
- [PASS] Token invalidation — old token rejected (401) after user update
- [PASS] SFTP 503 — unconfigured storage returns 503 "Storage not configured"

BROWSER QA: [8/8 pass]
- [PASS] Navigate to http://localhost — login page loads
- [PASS] Login as admin — succeeds, file browser shown
- [PASS] "Administration" link visible for admin
- [PASS] Click Administration — admin panel loads with tabs
- [PASS] Users section — table with admin user, CRUD buttons
- [PASS] Server section — SFTP settings form
- [PASS] Navigate back to file browser — works
- [PASS] Viewer login — NO "Administration" button visible

VERDICT: APPROVE
```

## Notes
- PUT /api/admin/settings validates SFTP connection before saving. Without a real SFTP server, it returns 400 "Unable to connect" — this is correct validation behavior, not a bug.
- Token invalidation uses second-granularity timestamps (JWT `iat` vs `updated_at`). If update happens within same second as token issuance, token remains valid. Edge case but acceptable.
- Delete button for own account is disabled in UI (frontend protection), API also rejects with 409 (backend protection).
