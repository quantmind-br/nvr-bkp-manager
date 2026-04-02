# Roadmap: nvr-bkp-manager

## Overview

Do conceito ao deploy: construir uma plataforma web que conecta a Storage Boxes remotas, lista gravacoes de seguranca e permite reproduzir arquivos .dav diretamente no navegador — evoluindo de um MVP focado em streaming para uma solucao completa com CRUD, autenticacao e deploy automatizado.

## Milestones

| Version | Name | Phases | Status | Completed |
|---------|------|--------|--------|-----------|
| v0.1 | Initial Release | 1-6 | ✅ Shipped | 2026-04-02 |
| v0.2 | Filtering & Bulk Operations | 7-8 | ✅ Shipped | 2026-04-02 |

## 🚧 Active Milestone: v0.2 Filtering & Bulk Operations

**Goal:** Enable users to efficiently find and act on multiple files at once — select, delete, and download in bulk.
**Status:** Phase 2 of 2 — COMPLETE
**Progress:** [██████████] 100%

### Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 7 | Enhanced Filtering | 07-01 | Complete | 2026-04-02 |
| 8 | Selection & Bulk Operations | 08-01 | Complete | 2026-04-02 |

### Phase 7: Enhanced Filtering

**Goal:** Upgrade filtering to support multi-channel select, time-of-day range, file size range, and improved filter UX with better visual grouping.
**Depends on:** Phase 6 (production deploy complete)
**Research:** Unlikely (internal UI patterns)

**Scope:**
- Multi-channel select (replace single dropdown)
- Time-of-day range filter
- File size range filter
- Improved filter controls layout and visual grouping

**Plans:**
- [ ] 07-01: TBD (defined during /paul:plan)

### Phase 8: Selection & Bulk Operations

**Goal:** Add multi-select checkboxes, selection status bar, bulk delete with confirmation, and bulk download via server-side zip streaming.
**Depends on:** Phase 7 (enhanced filtering makes bulk selection more useful)
**Research:** Likely (server-side zip streaming, archiver library choice)
**Research topics:** Streaming zip generation in Node.js without buffering entire archive in memory

**Scope:**
- Multi-select checkboxes (individual, select all visible, select all filtered)
- Selection status bar ("X files selected (Y MB)")
- Bulk delete with single confirmation, partial failure handling
- Bulk download via server-side zip streaming with progress feedback

**Plans:**
- [ ] 08-01: TBD (defined during /paul:plan)

## ✅ Completed Milestones

<details>
<summary>v0.1 Initial Release (Phases 1-6) — Shipped 2026-04-02</summary>

### Phase 1: Project Foundation
Scaffolding, Docker Compose, dev environment. Finalize tech stack decisions (React vs Next.js, Node.js vs FastAPI, SQLite vs PostgreSQL). Establish project structure, linting, and basic CI.

### Phase 2: Storage Connection & File Listing
SFTP connection to Storage Box using configured credentials. Backend API to list remote files with metadata. Basic frontend UI to browse recordings.

### Phase 3: Video Streaming (.dav Transcoding)
FFmpeg integration for .dav → web-friendly format transcoding. Streaming pipeline from Storage Box through backend to browser player. **Core technical risk — MVP proof-of-concept.**

### Phase 4: File Operations (CRUD)
Upload new recordings to Storage Box. Download files to local machine. Delete recordings from remote storage. All operations via web interface.

### Phase 5: Authentication & Security
JWT-based auth with login/logout. User management (admin/viewer roles). Bcrypt/Argon2 password hashing. Encrypted storage credentials in database. Route protection on all API endpoints.

### Phase 6: Audit & Production Deploy
Activity logging (who did what, when). Docker Compose production configuration. Deploy via Dokploy to https://nvr.quantmind.com.br. Security hardening and LGPD compliance checks.

</details>

---
*Roadmap created: 2026-04-02*
*Last updated: 2026-04-02*
