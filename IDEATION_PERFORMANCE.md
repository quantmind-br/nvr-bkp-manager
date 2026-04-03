# Performance Optimizations Report

## Executive Summary

Analysis of the NVR Backup Manager codebase (Fastify 5 backend + React 19 frontend) reveals **17 optimization opportunities** across network, runtime, database, caching, and rendering categories. The most impactful findings center around **SFTP connection overhead** (every operation opens a fresh SSH connection — including 2 connections per download), **missing nginx compression and static asset caching**, and **synchronous file I/O blocking the event loop** during video transcoding.

Estimated total impact: **~40-60% reduction in API latency for file operations**, **~60-80% reduction in transfer size for JSON/text responses**, and **measurable improvements to frontend load time and responsiveness**.

---

## High Impact Optimizations

### PERF-001: Download Endpoint Opens Two SFTP Connections

**Category:** network
**Impact:** high
**Estimated Effort:** small

**Affected Areas:**
- `backend/src/routes/files.ts` (lines 347-426)
- `backend/src/services/sftp.ts`

**Current State:**
The `/api/download` endpoint calls `getFileSize()` (creates SFTP connection #1, fetches stat, closes), then calls `getReadStream()` (creates SFTP connection #2). Each SSH handshake adds ~50-200ms latency depending on network conditions. Every single file download pays this penalty twice.

```typescript
// Current: Two SFTP connections per download
size = await getFileSize(remoteFilePath);   // Connection #1: connect → stat → disconnect
sftpHandle = await getReadStream(remoteFilePath); // Connection #2: connect → createReadStream
```

**Expected Improvement:**
~50-200ms latency reduction per download (eliminates one full SSH handshake).

**Implementation:**
Add a `getReadStreamWithSize()` function to `sftp.ts` that retrieves both stat and stream on a single connection:

```typescript
// Optimized: Single connection for stat + stream
export async function getReadStreamWithSize(remotePath: string): Promise<SftpStream & { size: number }> {
  const settings = getSftpSettingsOrThrow();
  const sftp = await connectSftp();
  const fullPath = normalizePath(settings.path, remotePath);
  const stats = await sftp.stat(fullPath);
  const stream = sftp.createReadStream(fullPath);
  return { stream, sftp, size: stats.size };
}
```

**Tradeoffs:**
None. Strictly better — fewer connections, less latency, same behavior.

---

### PERF-002: Bulk Delete Uses Sequential SFTP Connections

**Category:** network
**Impact:** high
**Estimated Effort:** medium

**Affected Areas:**
- `backend/src/routes/files.ts` (lines 534-577)
- `backend/src/services/sftp.ts`

**Current State:**
`POST /api/bulk-delete` iterates files and calls `deleteFile()` sequentially. Each call creates a new SFTP connection, deletes one file, and disconnects. For 50 files, that's 50 sequential SSH handshakes (~2.5-10 seconds of pure connection overhead).

```typescript
// Current: 50 files = 50 sequential SSH connections
for (const raw of fileList) {
  await deleteFile(remoteFilePath); // Each: connect → delete → disconnect
}
```

**Expected Improvement:**
~80-95% latency reduction for bulk deletes (50 files: ~10s → ~0.5s). One connection instead of N.

**Implementation:**
Add a `deleteFiles()` batch function to `sftp.ts` that reuses a single connection:

```typescript
export async function deleteFiles(fileNames: string[]): Promise<Map<string, Error | null>> {
  const settings = getSftpSettingsOrThrow();
  const sftp = await connectSftp();
  const results = new Map<string, Error | null>();
  try {
    for (const fileName of fileNames) {
      const fullPath = normalizePath(settings.path, fileName);
      try {
        await sftp.delete(fullPath);
        results.set(fileName, null);
      } catch (err) {
        results.set(fileName, err instanceof Error ? err : new Error(String(err)));
      }
    }
  } finally {
    await sftp.end();
  }
  return results;
}
```

**Tradeoffs:**
If one delete is very slow, it blocks subsequent deletes. Could add parallelism with a concurrency limit (e.g., 5 concurrent deletes over 2-3 connections).

---

### PERF-003: Nginx Missing Gzip Compression

**Category:** network
**Impact:** high
**Estimated Effort:** trivial

**Affected Areas:**
- `docker/nginx.conf`

**Current State:**
Nginx serves all responses uncompressed. JSON API responses, HTML, JS, and CSS files are transferred at full size. A typical file listing response with 100+ entries could be 50-100KB uncompressed but ~10-15KB gzipped.

**Expected Improvement:**
~60-80% transfer size reduction for text-based responses (JSON, HTML, JS, CSS).

**Implementation:**
Add gzip configuration to `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/vnd.apple.mpegurl
        image/svg+xml;

    # ... existing config ...
}
```

**Tradeoffs:**
Marginal CPU cost for compression. Level 6 is a good balance. Do NOT compress video streams (already binary).

---

### PERF-004: Nginx Missing Static Asset Caching

**Category:** caching
**Impact:** high
**Estimated Effort:** trivial

**Affected Areas:**
- `docker/nginx.conf`
- `frontend/vite.config.ts`

**Current State:**
No `Cache-Control` headers on any static assets. Every page navigation re-downloads all JS/CSS bundles. Vite already produces content-hashed filenames by default (e.g., `index-abc123.js`), but nginx doesn't tell browsers to cache them.

**Expected Improvement:**
Eliminates redundant asset downloads on repeat visits. ~200-500ms faster page loads for returning users (depending on connection speed).

**Implementation:**
Add cache rules to nginx for hashed assets:

```nginx
# Cache hashed assets (Vite produces content-hashed filenames)
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Don't cache the HTML shell (must always get latest asset references)
location = /index.html {
    add_header Cache-Control "no-cache";
}
```

**Tradeoffs:**
None with content-hashed filenames — cache invalidation is automatic when content changes.

---

### PERF-005: Synchronous File I/O Blocks Event Loop

**Category:** runtime
**Impact:** high
**Estimated Effort:** medium

**Affected Areas:**
- `backend/src/services/stream.ts` (lines 2, 47, 64-65, 118, 128)
- `backend/src/routes/stream.ts` (lines 86-90, 125, 156, 178, 225, 256)

**Current State:**
The streaming service and routes use synchronous fs APIs extensively: `existsSync()`, `mkdirSync()`, `rmSync()`, `readdirSync()`, `writeFileSync()`, `unlinkSync()`. The HLS readiness check polls `existsSync()` every 500ms in a `setInterval`. Under concurrent requests, these synchronous calls block the Node.js event loop.

```typescript
// Current: Blocking I/O
mkdirSync(hlsDir, { recursive: true });            // Blocks
if (existsSync(hlsDir)) rmSync(hlsDir, { recursive: true }); // Blocks
// Polling loop blocks every 500ms
const check = setInterval(() => {
  if (existsSync(playlistPath)) { ... }             // Blocks
}, 500);
```

**Expected Improvement:**
Eliminates event loop blocking during streaming operations. Under concurrent load (5+ simultaneous streams), could reduce p99 latency for other endpoints by 50-200ms.

**Implementation:**
Replace with async equivalents:

```typescript
import { mkdir, rm, access, readdir } from "fs/promises";
import { constants } from "fs";

await mkdir(hlsDir, { recursive: true });

// For existence checks
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
```

For the HLS readiness check, use `fs.watch()` instead of polling:

```typescript
import { watch } from "fs";

const ready = new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => { reject(new Error("HLS timeout")); }, 120000);
  const watcher = watch(hlsDir, (_, filename) => {
    if (filename === "stream.m3u8") {
      watcher.close();
      clearTimeout(timeout);
      resolve();
    }
  });
});
```

**Tradeoffs:**
`fs.watch()` behavior varies across OS (Linux uses inotify — reliable). The one-time `mkdirSync` in `db.ts` during startup is fine and doesn't need changing.

---

### PERF-006: Stream Start Makes Redundant testConnection() Call

**Category:** network
**Impact:** high
**Estimated Effort:** trivial

**Affected Areas:**
- `backend/src/routes/stream.ts` (lines 48-58)

**Current State:**
`/api/stream/start` calls `testConnection()` before starting the HLS session. `testConnection()` creates a full SFTP connection, runs `sftp.list()`, and disconnects — just to verify the server is reachable. Then `createHlsSession()` opens another SFTP connection for the actual stream. This adds ~100-300ms of wasted latency.

```typescript
// Current: Redundant connection check
const storageConnected = await testConnection(); // Connection #1: connect → list → disconnect
// ... then later:
createHlsSession(remoteFilePath, startSeconds, sessionId); // Connection #2: the real one
```

**Expected Improvement:**
~100-300ms latency reduction per stream start.

**Implementation:**
Remove the `testConnection()` call. If the SFTP server is down, `createHlsSession()` will fail and the error is already handled. The check is purely defensive and doubles the connection overhead.

```typescript
// Optimized: Just try to start the session — handle errors from createHlsSession
try {
  createHlsSession(remoteFilePath, startSeconds, sessionId)
    .then(...)
    .catch(...); // Already handles connection failures
} catch { ... }
```

**Tradeoffs:**
Slightly less specific error message if SFTP is down (generic "stream init error" vs "storage connection failed"). Could add a `StorageNotConfiguredError` check in the catch instead.

---

## Medium Impact Optimizations

### PERF-007: File Listing Parses All Filenames Redundantly

**Category:** runtime
**Impact:** medium
**Estimated Effort:** small

**Affected Areas:**
- `backend/src/routes/files.ts` (lines 265-289)

**Current State:**
The `/api/files` handler calls `buildParsedMetadata()` for every file in the `.map()`, including the `..` directory entry. The `shouldIncludeFile()` filter then may call `buildParsedMetadata()` again via `file.parsed ?? buildParsedMetadata(file.name)`. Additionally, `parseNvrFilename()` uses a regex with named capture groups and creates Date objects — non-trivial work per file.

For a directory with 1000 files, this runs the regex + Date parsing 1000-2000 times.

**Expected Improvement:**
~30-50% reduction in CPU time for file listing on large directories.

**Implementation:**
Parse only once and reuse. Skip directories and the ".." entry:

```typescript
const files = (await listFiles(remotePath)).map((file) => ({
  ...file,
  parsed: file.isDirectory ? undefined : buildParsedMetadata(file.name),
}));
```

The `shouldIncludeFile()` function already checks `file.isDirectory` first and returns early, so this is safe.

**Tradeoffs:**
None.

---

### PERF-008: Bulk Download Loads Entire ZIP Into Browser Memory

**Category:** memory
**Impact:** medium
**Estimated Effort:** small

**Affected Areas:**
- `frontend/src/components/FileList.tsx` (lines 378-404)

**Current State:**
`handleBulkDownload()` calls `await res.blob()` which buffers the entire ZIP file in browser memory before triggering the download. For large selections (e.g., 50 files × 100MB each = 5GB), this will crash the browser tab.

```typescript
// Current: Buffers entire response in memory
const blob = await res.blob();  // 5GB in memory
const url = URL.createObjectURL(blob);
```

**Expected Improvement:**
Eliminates browser OOM crashes for large bulk downloads.

**Implementation:**
Use a download token approach (like the single-file download) or use a streaming download approach:

```typescript
async function handleBulkDownload() {
  setBulkDownloading(true);
  try {
    // Get a short-lived download token
    const res = await apiFetch("/api/bulk-download-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: Array.from(selectedForBulk), path: currentPath }),
    });
    if (!res.ok) throw new Error("Failed to get download token");
    const { downloadUrl } = await res.json() as { downloadUrl: string };

    // Trigger download via anchor tag (browser handles streaming to disk)
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "nvr-recordings.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Bulk download failed");
  } finally {
    setBulkDownloading(false);
  }
}
```

This requires a corresponding `POST /api/bulk-download-token` backend endpoint (similar to the existing download-token pattern).

**Tradeoffs:**
Loses the ability to show download progress in the UI. But avoids OOM for large downloads.

---

### PERF-009: Auth Plugin Hits Database on Every Request

**Category:** database
**Impact:** medium
**Estimated Effort:** small

**Affected Areas:**
- `backend/src/plugins/auth.ts` (lines 40-56)
- `backend/src/services/users.ts` (lines 123-141)

**Current State:**
Every authenticated API request calls `hydrateActiveUser()` → `getActiveUserForToken()` → `findUserById()`, which executes a SQLite query. With few users this is sub-millisecond, but it's still unnecessary overhead for a system with low user churn. JWT tokens are self-contained — the DB lookup is only needed to check if the user was updated/deleted since token issuance.

**Expected Improvement:**
Eliminates ~0.1-0.5ms per request. More impactful under concurrent load.

**Implementation:**
Add a simple in-memory cache with short TTL (e.g., 30 seconds):

```typescript
const userCache = new Map<number, { user: SafeUser; cachedAt: number }>();
const CACHE_TTL_MS = 30_000;

export function getActiveUserForToken(
  userId: number,
  tokenIssuedAtSeconds: number,
): SafeUser | null {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    const updatedAtSeconds = Math.floor(
      new Date(`${/* ... */}`).getTime() / 1000,
    );
    if (tokenIssuedAtSeconds >= updatedAtSeconds) {
      return cached.user;
    }
  }

  const user = findUserById(userId);
  if (!user) return null;
  // ... existing validation ...
  const safe = toSafeUser(user);
  userCache.set(userId, { user: safe, cachedAt: Date.now() });
  return safe;
}
```

Invalidate on user update/delete (already in transaction).

**Tradeoffs:**
30-second staleness window where a deleted/updated user could still authenticate. Acceptable for this use case (admin panel, not high-security).

---

### PERF-010: HLS Session Memory Leak (No TTL/Cleanup)

**Category:** memory
**Impact:** medium
**Estimated Effort:** small

**Affected Areas:**
- `backend/src/services/stream.ts` (lines 137-153)

**Current State:**
`activeSessions` is a `Map<string, HlsSession>` with no maximum size, no TTL, and no automatic cleanup. Sessions are only removed when:
1. The client explicitly calls `DELETE /api/stream/:sessionId`
2. FFmpeg errors trigger cleanup

If a user closes the browser tab without calling delete (common), the session — including FFmpeg process handle, SFTP connection reference, and temp directory — leaks indefinitely. The `cleanup()` function's `setTimeout(..., 30000)` delays temp directory removal but doesn't remove the session from the Map.

**Expected Improvement:**
Prevents unbounded memory growth on long-running servers. Each leaked session holds ~1-5KB of metadata plus temp files on disk.

**Implementation:**
Add a periodic cleanup sweep:

```typescript
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      removeSession(id);
    }
  }
}, 60_000); // Check every minute
```

Add a `createdAt: number` field to `HlsSession`.

**Tradeoffs:**
Users with very long videos (>30 min) would need to re-start the stream. Could increase TTL or reset it on segment access.

---

### PERF-011: Dynamic Imports in Request Handlers

**Category:** runtime
**Impact:** medium
**Estimated Effort:** trivial

**Affected Areas:**
- `backend/src/routes/stream.ts` (lines 73, 86-88, 177-178, 223-226)

**Current State:**
Several request handlers use `await import(...)` for Node.js built-in modules inside the request path:

```typescript
// Inside GET /api/stream/start handler
const { randomBytes } = await import("crypto");
const { mkdirSync } = await import("fs");
const { join } = await import("path");
const { tmpdir } = await import("os");
```

While Node.js caches dynamic imports after the first call, there's still async overhead on every request from the `await` and module resolution. These are all deterministic Node.js builtins that should be static top-level imports.

**Expected Improvement:**
Eliminates ~0.5-2ms of unnecessary async overhead per stream start request.

**Implementation:**
Move to top-level imports (they're already used this way in `services/stream.ts`):

```typescript
import { randomBytes } from "crypto";
import { mkdirSync, existsSync, readdirSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
```

**Tradeoffs:**
None. Strictly better.

---

### PERF-012: VideoPlayer Playlist Polling Without Backoff

**Category:** network
**Impact:** medium
**Estimated Effort:** trivial

**Affected Areas:**
- `frontend/src/components/VideoPlayer.tsx` (lines 73-77)

**Current State:**
The video player polls for HLS playlist readiness with a fixed 2-second interval, up to 60 attempts (2 minutes). Early in transcoding, the playlist isn't ready, yet the client hammers the server every 2 seconds. For `.dav` files (HEVC transcoding), FFmpeg typically needs 5-15 seconds to produce the first segment.

```typescript
// Current: Fixed interval polling
for (let attempt = 0; attempt < 60; attempt++) {
  const check = await fetch(playlistUrl);
  if (check.ok) break;
  await new Promise((r) => setTimeout(r, 2000));
}
```

**Expected Improvement:**
~60-70% fewer polling requests during stream initialization.

**Implementation:**
Use exponential backoff starting at 1s:

```typescript
for (let attempt = 0; attempt < 30; attempt++) {
  const check = await fetch(playlistUrl);
  if (check.ok) break;
  const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000);
  await new Promise((r) => setTimeout(r, delay));
}
```

**Tradeoffs:**
Slightly longer wait before playback starts if the playlist becomes ready between poll intervals. Negligible in practice with 1.5x backoff.

---

### PERF-013: sortedFiles Computed Outside useMemo

**Category:** rendering
**Impact:** medium
**Estimated Effort:** trivial

**Affected Areas:**
- `frontend/src/components/FileList.tsx` (lines 277-300)

**Current State:**
`sortedFiles` is computed directly in the component body — not wrapped in `useMemo`. It creates a new array copy (`[...timeFilteredFiles]`) and sorts it on every render, even when nothing relevant changed. Any state change in this 20+ state component triggers a re-sort.

```typescript
// Current: Runs on every render
const sortedFiles = [...timeFilteredFiles].sort((a, b) => { ... });
```

**Expected Improvement:**
Avoids O(n log n) sorting on unrelated re-renders. For 1000 files, saves ~1-5ms per unnecessary render.

**Implementation:**
```typescript
const sortedFiles = useMemo(() => {
  return [...timeFilteredFiles].sort((a, b) => {
    // ... existing sort logic ...
  });
}, [timeFilteredFiles, sortColumn, sortDirection]);
```

**Tradeoffs:**
None.

---

### PERF-014: login Function Not Memoized in AuthProvider

**Category:** rendering
**Impact:** medium
**Estimated Effort:** trivial

**Affected Areas:**
- `frontend/src/auth.tsx` (lines 64-82)

**Current State:**
The `login` function is defined as a regular async function inside `AuthProvider`, not wrapped in `useCallback`. Because the context value object includes `login`, every render of `AuthProvider` creates a new `login` reference, causing all context consumers to re-render.

```typescript
// Current: New function reference every render
async function login(username: string, password: string): Promise<void> { ... }
```

**Expected Improvement:**
Eliminates unnecessary re-renders of all auth context consumers (every component using `useAuth()`).

**Implementation:**
```typescript
const login = useCallback(async (username: string, password: string): Promise<void> => {
  const res = await fetch("/api/auth/login", { ... });
  // ... existing logic ...
}, []);
```

**Tradeoffs:**
None.

---

## Low Impact Optimizations

### PERF-015: No Code Splitting for Admin Panel

**Category:** bundle_size
**Impact:** low
**Estimated Effort:** small

**Affected Areas:**
- `frontend/src/App.tsx` (lines 1-6)
- `frontend/src/components/admin/AdminPanel.tsx`

**Current State:**
All components are eagerly imported, including the admin panel (`AdminPanel`, `AdminUsersSection`, `AdminServerSection`). Viewer-role users never access admin routes but still download the admin code.

**Expected Improvement:**
~10-20KB reduction in initial bundle for non-admin users (rough estimate based on 3 admin components).

**Implementation:**
```typescript
import { lazy, Suspense } from "react";

const AdminPanel = lazy(() => import("./components/admin/AdminPanel"));

// In Routes:
<Route
  path="/admin"
  element={
    isAdmin ? (
      <Suspense fallback={<div>Loading...</div>}>
        <AdminPanel />
      </Suspense>
    ) : (
      <Navigate to="/" replace />
    )
  }
/>
```

**Tradeoffs:**
Brief loading flash when admin navigates to panel for the first time. Negligible with a small bundle.

---

### PERF-016: Missing Database Indexes on audit_logs

**Category:** database
**Impact:** low
**Estimated Effort:** trivial

**Affected Areas:**
- `backend/src/services/audit.ts` (lines 14-27, 52-56)

**Current State:**
The `audit_logs` table has no explicit indexes. The `getAuditLogs()` query sorts by `created_at DESC` with `LIMIT/OFFSET` pagination. Without an index, SQLite performs a full table scan and filesort. For a small deployment this is fine, but audit logs grow unboundedly.

**Expected Improvement:**
Prevents query degradation as audit logs grow. At 100K+ rows, query time drops from ~50-100ms to <1ms with an index.

**Implementation:**
Add to `initAuditTable()`:

```typescript
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC)
`);
```

**Tradeoffs:**
Tiny write overhead (~1% slower INSERTs). Worthwhile given the read pattern.

---

### PERF-017: Vite Build Missing Manual Chunk Optimization

**Category:** bundle_size
**Impact:** low
**Estimated Effort:** trivial

**Affected Areas:**
- `frontend/vite.config.ts`

**Current State:**
The Vite config is minimal — no `build.rollupOptions.output.manualChunks` configuration. All vendor code (React, React DOM, React Router, hls.js) ships in one chunk. hls.js (~200KB minified) is loaded even on the login page where it's not needed.

**Expected Improvement:**
Better caching granularity. When app code changes, vendor chunks remain cached. hls.js loads only when needed.

**Implementation:**
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          hls: ["hls.js"],
        },
      },
    },
  },
});
```

**Tradeoffs:**
More HTTP requests on initial load (3 chunks vs 1). HTTP/2 multiplexing makes this negligible. Net win for caching.

---

## Dependency Analysis

| Package | Size (approx.) | Usage | Recommendation |
|---------|---------------|-------|----------------|
| `hls.js` | ~200KB min | Video playback only | Lazy-load via dynamic import (only needed in VideoPlayer) |
| `react-router-dom` | ~30KB min | Routing (2 routes) | Keep — essential, well-tree-shaken |
| `archiver` | ~50KB min | Bulk ZIP downloads | Keep — no lighter alternative for streaming ZIP |
| `ssh2-sftp-client` | ~150KB min (incl. ssh2) | Core SFTP functionality | Keep — core dependency |
| `bcryptjs` | ~30KB min | Password hashing | Keep — essential security |
| `better-sqlite3` | ~5MB native | Database | Keep — optimal for embedded SQLite |
| `@fastify/cors` | ~5KB | CORS headers | Keep |
| `@fastify/jwt` | ~10KB | JWT auth | Keep |
| `@fastify/multipart` | ~20KB | File uploads | Keep |

No unnecessary or replaceable dependencies found. The dependency set is lean for the functionality provided.

---

## Summary

| Category | Count |
|----------|-------|
| Network | 5 |
| Runtime | 3 |
| Memory | 2 |
| Database | 2 |
| Caching | 1 |
| Rendering | 3 |
| Bundle Size | 2 |

| Impact | Count |
|--------|-------|
| High | 6 |
| Medium | 8 |
| Low | 3 |

**Estimated Total Savings:**
- **Network:** ~60-80% smaller JSON responses (gzip), ~100-300ms per download/stream (connection reuse), ~80-95% faster bulk deletes
- **Runtime:** Eliminated event loop blocking during transcoding, ~2-4ms per request (dynamic imports, sync I/O)
- **Bundle:** ~10-20KB initial load reduction (code splitting), better cache hit rates (manual chunks)
- **Database:** Prevents degradation at scale (audit index), ~0.1-0.5ms per request (auth cache)
- **Memory:** Prevents unbounded growth (HLS session TTL), eliminates browser OOM (streaming bulk download)

**Total Files Analyzed:** 35

**Recommended Priority Order:**
1. PERF-003 (nginx gzip) — trivial effort, immediate network win
2. PERF-004 (static asset caching) — trivial effort, immediate UX win
3. PERF-001 (download double-connection) — small effort, high per-request impact
4. PERF-006 (redundant testConnection) — trivial effort, latency reduction
5. PERF-011 (dynamic imports) — trivial effort, clean code + minor perf
6. PERF-002 (bulk delete batching) — medium effort, massive bulk operation win
7. PERF-005 (async file I/O) — medium effort, concurrency improvement
8. Everything else in priority order
