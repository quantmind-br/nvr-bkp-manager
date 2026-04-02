# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-02)

**Core value:** Centralizar, simplificar e democratizar o acesso ao gerenciamento de backups de videos de seguranca
**Current focus:** Phase 3 complete — MVP validated. Ready for Phase 4.

## Current Position

Milestone: v0.1 Initial Release
Phase: 3 of 6 — Complete
Plan: PLAN-03-01 — Complete
Status: Phase 3 done, ready for Phase 4
Last activity: 2026-04-02 — Phase 3 unified and closed

Progress:
- Milestone: [█████░░░░░] 50%
- Phase 3:   [██████████] 100%

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

### Technical Discovery (Phase 3)
- .dav files = raw H.265/HEVC — remux only (-c:v copy), no CPU transcoding
- FFmpeg input forced with -f hevc, output as fMP4
- reply.hijack() + reply.raw for true chunked streaming in Fastify
- Cleanup function pattern for deterministic FFmpeg + SFTP resource release

### Decisions
- FFmpeg remux only for .dav (no transcoding needed)
- Docker Compose for full orchestration via Dokploy
- File metadata read at runtime from remote storage (no local duplication)
- Storage credentials encrypted at rest in database
- Fastify over Express for performance
- ESM modules throughout
- nginx proxy_buffering off for streaming readiness
- Connect-per-request SFTP (no pooling)
- HTML5 native video player (no third-party library)

### Deferred Issues
- README.md not yet created (low priority)
- SFTP listing ~9s for 2147 files — may need caching/pagination
- No seek/range-request support for video — full stream only

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-04-02
Stopped at: Phase 3 complete, transition done
Next action: /paul:plan for Phase 4 (File Operations — CRUD)
Resume file: .paul/phases/03/PLAN-03-01-SUMMARY.md

---
*STATE.md — Updated after every significant action*
