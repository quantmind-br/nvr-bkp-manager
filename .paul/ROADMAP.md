# Roadmap: nvr-bkp-manager

## Overview

Do conceito ao deploy: construir uma plataforma web que conecta a Storage Boxes remotas, lista gravacoes de seguranca e permite reproduzir arquivos .dav diretamente no navegador — evoluindo de um MVP focado em streaming para uma solucao completa com CRUD, autenticacao e deploy automatizado.

## Current Milestone

**v0.1 Initial Release** (v0.1.0)
Status: In progress
Phases: 5 of 6 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Project Foundation | 01-01 | Complete | 2026-04-02 |
| 2 | Storage Connection & File Listing | 02-01 | Complete | 2026-04-02 |
| 3 | Video Streaming (.dav Transcoding) | 03-01 | Complete | 2026-04-02 |
| 4 | File Operations (CRUD) | 04-01 | Complete | 2026-04-02 |
| 5 | Authentication & Security | 05-01 | Complete | 2026-04-02 |
| 6 | Audit & Production Deploy | TBD | Not started | - |

## Phase Details

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

---
*Roadmap created: 2026-04-02*
*Phases defined: 2026-04-02*
