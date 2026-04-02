# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-02)

**Core value:** Centralizar, simplificar e democratizar o acesso ao gerenciamento de backups de videos de seguranca
**Current focus:** Phase 2 complete — ready for Phase 3

## Current Position

Milestone: v0.1 Initial Release
Phase: 2 of 6 — Complete
Plan: PLAN-02-01 — Complete
Status: Phase 2 done, ready for Phase 3
Last activity: 2026-04-02 — Phase 2 unified and closed

Progress:
- Milestone: [██░░░░░░░░] ~33%
- Phase 2:   [██████████] 100%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop closed — ready for next phase]
```

## Accumulated Context

### Key Stack Decisions (2026-04-02)
- **Frontend:** React + Vite (no SSR needed, lighter than Next.js)
- **Backend:** Node.js + Fastify (native Streams for FFmpeg piping, faster than Express)
- **Database:** SQLite (minimal data, zero infra overhead)
- **Storage:** SFTP via ssh2-sftp-client (connect-per-request)
- **Deploy:** Docker Compose + Dokploy at https://nvr.quantmind.com.br

### Decisions
- FFmpeg required for .dav transcoding (core technical risk)
- Docker Compose for full orchestration via Dokploy
- File metadata read at runtime from remote storage (no local duplication)
- Storage credentials encrypted at rest in database
- Fastify over Express for performance
- ESM modules throughout
- nginx proxy_buffering off for streaming readiness
- Connect-per-request SFTP (no pooling — simplicity first)
- dotenv loads from project root via path resolution
- Path traversal prevention in SFTP service

### Deferred Issues
- README.md not yet created (low priority)
- SFTP listing ~9s for 2147 files — may need caching/pagination for large dirs

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-04-02
Stopped at: Phase 2 complete, transition done
Next action: /paul:plan for Phase 3 (Video Streaming / .dav Transcoding)
Resume file: .paul/phases/02/PLAN-02-01-SUMMARY.md

---
*STATE.md — Updated after every significant action*
