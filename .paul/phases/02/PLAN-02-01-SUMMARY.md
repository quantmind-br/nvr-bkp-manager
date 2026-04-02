---
phase: 02-storage-connection
plan: 01
subsystem: api
tags: [sftp, ssh2-sftp-client, fastify, react, file-browser]

requires:
  - phase: 01-project-foundation
    provides: Fastify server, config.ts with STORAGE_* env vars, React frontend shell
provides:
  - SFTP service layer for Storage Box connectivity
  - GET /api/files endpoint with subdirectory navigation
  - React file browser component with path navigation
affects: [03-video-streaming, 04-file-operations]

tech-stack:
  added: [ssh2-sftp-client, @types/ssh2-sftp-client]
  patterns: [connect-per-request SFTP (no pooling), path traversal prevention in sftp.ts]

key-files:
  created: [backend/src/services/sftp.ts, backend/src/routes/files.ts, frontend/src/components/FileList.tsx]
  modified: [backend/src/index.ts, backend/src/config.ts, frontend/src/App.tsx, backend/package.json]

key-decisions:
  - "Connect-per-request SFTP: simple and correct, no pooling yet"
  - "dotenv loads .env from project root via path resolution (not CWD)"
  - "Directory traversal prevention via normalizePath stripping .."

patterns-established:
  - "SFTP service as thin wrapper: connect, operate, disconnect in finally block"
  - "API error returns 502 with { error, details } for storage failures"
  - "Frontend components manage own state (no global state library yet)"

duration: ~10min
started: 2026-04-02T11:20:00Z
completed: 2026-04-02T11:27:00Z
---

# Phase 2 Plan 01: Storage Connection & File Listing Summary

**SFTP service connecting to real Storage Box (2147 files), REST API with subdirectory navigation, and React file browser — end-to-end verified via Docker.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10min |
| Started | 2026-04-02T11:20:00Z |
| Completed | 2026-04-02T11:27:00Z |
| Tasks | 3 completed |
| Files modified | 8 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: SFTP connection to Storage Box | Pass | Connects and lists 2147 files |
| AC-2: File listing API returns metadata | Pass | JSON array with name, size, modifiedAt, isDirectory |
| AC-3: Subdirectory navigation | Pass | ?path= param works, ".." entry prepended when not at root |
| AC-4: Frontend displays file list | Pass | Table with clickable directories, size/date formatting |

## Accomplishments

- SFTP service with connection lifecycle management (connect/operate/disconnect in finally block)
- Path traversal prevention (strips `..` from remote paths before SFTP call)
- GET /api/files with optional ?path= query param and 502 error handling
- React FileList component with directory navigation, human-readable sizes, and date formatting
- Full end-to-end verified: browser → nginx → frontend → API → SFTP → Storage Box

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| All tasks (1-3) | `682729b` | feat | SFTP service, files API, file browser component |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `backend/src/services/sftp.ts` | Created | SFTP connection and file listing service |
| `backend/src/routes/files.ts` | Created | GET /api/files endpoint with subdir support |
| `frontend/src/components/FileList.tsx` | Created | File browser with directory navigation |
| `backend/src/index.ts` | Modified | Register fileRoutes |
| `backend/src/config.ts` | Modified | Fix dotenv path to load from project root |
| `frontend/src/App.tsx` | Modified | Integrate FileList component, add header layout |
| `backend/package.json` | Modified | Added ssh2-sftp-client dependency |
| `backend/package-lock.json` | Modified | Lock file update |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Connect-per-request SFTP | Simplicity first — no connection pool complexity | May revisit if concurrent requests become bottleneck |
| dotenv path resolution from __dirname | .env lives in project root, not backend/ | Config works both in dev (tsx) and Docker |
| Path traversal prevention in normalizePath | Security — prevent accessing files outside STORAGE_PATH | All remote paths sanitized before SFTP call |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Essential fix |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** One essential config fix, no scope creep.

### Auto-fixed Issues

**1. [Config] dotenv not loading .env from project root**
- **Found during:** Task 1 (SFTP service testing)
- **Issue:** `import "dotenv/config"` loads .env from CWD, but backend/ is the CWD — .env is in project root
- **Fix:** Changed to explicit `config({ path: resolve(__dirname, "../../.env") })` with path resolution
- **Files:** backend/src/config.ts
- **Verification:** Env vars confirmed loaded, SFTP connection succeeded
- **Commit:** Part of 682729b

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| dotenv CWD mismatch | Fixed path resolution in config.ts |
| Port 3001 conflict during Docker test | Killed leftover process, restarted clean |

## Next Phase Readiness

**Ready:**
- SFTP service ready for Phase 3 to add file streaming (sftp.ts can be extended with readStream)
- File listing API ready for Phase 4 to add download/upload/delete routes
- Frontend component pattern established for Phase 3 video player

**Concerns:**
- SFTP connect-per-request takes ~9s for 2147 files — acceptable for now but may need caching or pagination for very large directories

**Blockers:**
- None

---
*Phase: 02-storage-connection, Plan: 01*
*Completed: 2026-04-02*
