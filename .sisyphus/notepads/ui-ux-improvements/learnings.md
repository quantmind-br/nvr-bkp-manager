## Learnings

### 2026-04-02: Pre-execution analysis
- Project uses React 19 + TypeScript + inline styles only, zero CSS files
- `frontend/index.html` is the only allowed location for global styles
- `FileList.tsx` already has inline bulk-delete confirmation pattern (lines 613-644) that T7 should mirror
- `FileList.tsx` filters already have bordered group boxes (`filterGroupStyle`, lines 370-393) — T6 refines, not rebuilds
- Upload currently uses `fetch` via `apiFetch()` — T3 switches to XHR for progress tracking
- Downloads use `?token=` query param with anchor click — T7 replaces with short-lived `downloadToken` flow
- Backend auth plugin (`auth.ts:34-51`) already accepts both `?token=` AND `Authorization` header for `/api/download`
- Stream token handling must NOT change (HLS architectural requirement)
- No test framework exists; verification is build + agent-executed QA only

### 2026-04-02: Download-token + inline confirm implementation
- Single-file delete can reuse the existing inline bulk-confirm pattern cleanly by tracking a single `confirmingDelete` filename and clearing it on Escape.
- The short-lived single-file download flow works without changing `apiFetch()` by fetching `/api/download-token` with the bearer token, then handing the returned URL to a temporary anchor.
- Fastify JWT typing in `backend/src/plugins/auth.ts` must include optional `scope` and `file` fields, otherwise `app.jwt.sign()` rejects the scoped download-token payload at build time.


### 2026-04-02: Audit findings
- `frontend` and `backend` both build successfully after the UI/UX work.
- UIUX-001 through UIUX-015 are implemented in the current codebase based on the report requirements.
- UIUX-016 is only partially closed because the token system was added but the final hardcoded-palette sweep was not completed across all touched frontend files.
