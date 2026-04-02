# backend/

Fastify 5 API — TypeScript, ESM (`"type": "module"`). SQLite + SFTP + FFmpeg.

## OVERVIEW

REST API for browsing/streaming/managing NVR backup files on a remote SFTP storage box. JWT auth, audit logging, real-time video transcoding.

## STRUCTURE

```
backend/src/
├── index.ts          # App bootstrap — register plugins, routes, seed DB
├── config.ts         # Env vars → typed config object
├── db.ts             # SQLite singleton (WAL, FK on)
├── seed.ts           # Table init + default admin user
├── plugins/
│   └── auth.ts       # JWT plugin + global onRequest hook + requireRole()
├── routes/
│   ├── auth.ts       # POST /api/auth/login, GET /api/auth/me
│   ├── files.ts      # GET /api/files (filter: channel/date/size), GET /api/download, DELETE /api/files, POST /api/upload, POST /api/bulk-delete, POST /api/bulk-download
│   ├── stream.ts     # GET /api/stream (video with FFmpeg transcoding)
│   ├── audit.ts      # GET /api/audit (admin only)
│   └── health.ts     # GET /api/health (public)
└── services/
    ├── sftp.ts       # All SFTP operations (connect/list/read/delete/upload)
    ├── stream.ts     # FFmpeg pipe: .dav→mp4, .mp4 passthrough, HLS session mgmt
    ├── filenameParser.ts # NVR filename regex parser + duration formatter
    ├── users.ts      # User CRUD, bcrypt hashing
    └── audit.ts      # Audit log DB operations
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Add new route | Create in `routes/`, register in `index.ts` |
| Change auth behavior | `plugins/auth.ts` (hook logic, token verification) |
| Change SFTP config | `config.ts` (env vars) |
| Add DB schema | `services/*.ts` init function + call from `seed.ts` |
| Change video transcoding | `services/stream.ts` |
| Parse NVR filenames | `services/filenameParser.ts` — `parseNvrFilename()`, `formatDuration()` |

## CONVENTIONS

- Imports use `.js` extension (ESM requirement): `import { x } from "./config.js"`
- Route functions: `export async function nameRoutes(app: FastifyInstance)` — registered via `app.register()`
- Services are plain functions (no classes). Import `db` from `../db.js`
- SFTP: new `SftpClient()` per call, `sftp.end()` in `finally`
- Streaming routes: use `reply.hijack()` + `reply.raw.writeHead()` — never `.send()`
- Admin-only routes: `{ preHandler: [requireRole("admin")] }`
- Error responses: `{ error: string, details?: string }` with appropriate HTTP status
- All env defaults in `config.ts` via `process.env["KEY"] ?? "default"`
- Bulk download uses `archiver` for streaming zip — also uses `reply.hijack()` + raw pipe
- NVR filename regex: `CHANNEL_YYYY-MM-DD_HH-MM-SS_YYYY-MM-DD_HH-MM-SS.ext`

## ANTI-PATTERNS

- Do NOT use Fastify's `.send()` for streaming — always `hijack()` + raw pipe
- Do NOT reuse SFTP connections between operations
- Do NOT add per-route JWT verification — the global hook handles it
- Do NOT skip `validateFileName()` for user-supplied filenames
