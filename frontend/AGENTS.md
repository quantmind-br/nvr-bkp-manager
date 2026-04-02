# frontend/

React 19 SPA — Vite 8, TypeScript, inline styles (no CSS framework).

## OVERVIEW

Single-page app for browsing NVR backup files. Login, file browser with directory navigation, video playback (inline + .dav transcoding), upload, download, delete.

## STRUCTURE

```
frontend/src/
├── main.tsx           # Entry — StrictMode + AuthProvider wrapper
├── App.tsx            # Root — auth gate (login page vs file list)
├── auth.tsx           # AuthProvider context (user, token, login, logout, isAdmin)
├── api.ts             # Fetch wrapper — auto-attaches JWT, handles 401 → logout
└── components/
    ├── LoginPage.tsx   # Login form
    ├── FileList.tsx    # File browser table + directory nav + date/channel filtering + bulk select/delete/download
    ├── VideoPlayer.tsx # Modal video player (uses <video> with ?token= auth)
    └── UploadButton.tsx # Multi-file upload with status feedback
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Add new page/component | Create in `components/`, import in `App.tsx` |
| Change auth flow | `auth.tsx` (AuthProvider) + `api.ts` (fetch wrapper) |
| Change file browsing UI | `components/FileList.tsx` |
| Change video playback | `components/VideoPlayer.tsx` |
| Add API calls | Use `apiFetch()` from `api.ts` — handles JWT + 401 |

## CONVENTIONS

- All styling via inline `style={{}}` objects — no CSS files, no CSS-in-JS libraries
- Auth state via React Context (`useAuth()` hook) — available in any component
- API calls through `apiFetch()` wrapper (auto-attaches Bearer token, auto-logout on 401)
- Stream/download URLs use `?token=` query param (HTML5 elements can't set headers)
- No router — single-page, conditional render based on auth state
- `type: "commonjs"` in package.json (Vite handles ESM transformation)

## NOTES

- Vite dev server proxies `/api` → `http://localhost:3001` (see `vite.config.ts`)
- Production: nginx serves static files + proxies `/api/` to backend container
- No state management library — just React Context + useState
- `FileList.tsx` is the largest component (800+ lines) — contains all file browsing, filtering, and bulk operation logic
