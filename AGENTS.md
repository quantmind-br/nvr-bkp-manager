# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-02
**Commit:** 78ec31a
**Branch:** master

## OVERVIEW

NVR (Network Video Recorder) backup file manager. Browse, stream, download, upload, and delete video recordings stored on a remote SFTP storage box. Fastify API + React SPA, deployed via Docker Compose with nginx reverse proxy.

## STRUCTURE

```
.
├── backend/          # Fastify 5 API (TypeScript, Node.js)
├── frontend/         # React 19 SPA (Vite, TypeScript)
├── docker/           # Dockerfiles + nginx.conf
├── docker-compose.yml          # Base compose
├── docker-compose.dev.yml      # Dev overrides (hot reload, volume mounts)
├── docker-compose.prod.yml     # Prod overrides (no exposed ports, restart policies)
└── .env                        # Secrets (SFTP creds, JWT secret, admin password)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add an API endpoint | `backend/src/routes/` | Register in `backend/src/index.ts` |
| Add SFTP/storage logic | `backend/src/services/sftp.ts` | All SFTP ops go here |
| Add video transcoding | `backend/src/services/stream.ts` | FFmpeg .dav→mp4 pipe |
| Change auth/JWT | `backend/src/plugins/auth.ts` | JWT plugin + `requireRole()` |
| Add DB table/migration | `backend/src/services/` + `seed.ts` | Schema in `init*Table()`, seed in `seedDatabase()` |
| Add/change frontend page | `frontend/src/components/` | Auth-gated via `useAuth()` |
| Change auth flow (client) | `frontend/src/auth.tsx` | AuthProvider context + `apiFetch` wrapper |
| Configure nginx proxy | `docker/nginx.conf` | `/api/` proxied to backend:3001 |
| Docker build changes | `docker/Dockerfile.*` | Backend needs ffmpeg+build-tools |

## CONVENTIONS

- **Backend ESM**: `"type": "module"` — use `.js` extensions in imports (e.g., `import { x } from "./config.js"`)
- **Frontend CJS**: `"type": "commonjs"` — standard Vite/React setup
- **All API routes** prefixed `/api/` — public: `/api/health`, `/api/auth/*`; protected: everything else under `/api/`
- **Auth hook**: JWT verification runs on every `/api/*` request (except health/auth) via `onRequest` hook in auth plugin
- **Token passthrough**: Stream/download endpoints accept `?token=` query param (HTML5 video/anchor tags can't set headers)
- **Roles**: `admin` (full CRUD) and `viewer` (read-only: browse, stream, download). Enforced via `requireRole()` preHandler
- **Filename validation**: All file operations validate against path traversal (`/`, `\\`, `..` in filenames)
- **Streaming**: Routes use `reply.hijack()` for raw Node.js streaming (bypass Fastify serialization)
- **Inline styles**: Frontend uses no CSS framework — all components use inline `style={{}}` objects
- **DB**: SQLite via better-sqlite3, WAL mode, foreign keys ON. File at `backend/data/nvr.db` (gitignored, Docker volume)
- **Config**: Single `config.ts` reads from `.env` (loaded from project root, two levels up from `src/`)
- **SFTP**: New connection per operation (no pooling). Always `sftp.end()` in `finally` block
- **FFmpeg**: `.dav` files transcoded on-the-fly via `spawn("ffmpeg")` pipe (HEVC→MP4 fragmented). Must be available in PATH

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** commit `.env`, `*.db`, `*.sqlite` files
- **NEVER** remove `reply.hijack()` from streaming routes — Fastify will double-respond
- **NEVER** pool/reuse SFTP connections — each operation creates and destroys its own client
- **NEVER** skip filename validation in routes — path traversal is the #1 attack vector
- **NEVER** add route-level JWT checks — the auth plugin hook handles it globally
- **DO NOT** use Fastify's `.send()` for streaming responses — use raw `reply.raw.writeHead()` + pipe

## COMMANDS

```bash
# Backend
cd backend && npm run dev       # tsx watch (hot reload)
cd backend && npm run build     # tsc → dist/
cd backend && npm start         # node dist/index.js

# Frontend
cd frontend && npm run dev      # Vite dev server (port 5173, proxies /api → :3001)
cd frontend && npm run build    # tsc + vite build → dist/

# Docker (from project root)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up    # Dev
docker compose -f docker-compose.yml -f docker-compose.prod.yml up   # Prod
```

## NOTES

- Default admin seeded on first run (username: `admin`, password from `DEFAULT_ADMIN_PASSWORD` env var, defaults to `admin`)
- Upload limit: 2GB (`@fastify/multipart` config in `index.ts`)
- Backend Docker image includes `ffmpeg` (required for .dav transcoding) and `python3 make g++` (for native module builds)
- No test suite exists yet
- No migration system — schema created via `CREATE TABLE IF NOT EXISTS` on startup
- Uses [PAUL](/.paul/) for project management (phases, roadmap)
