# Learnings — ui-modernization

## [2026-04-04] Session Start
- Stack: React 19 + Vite 8 + TypeScript 6 + react-router-dom v7
- Zero CSS framework — all inline style={{}} objects
- 8 components total: App, LoginPage, FileList (976 lines), VideoPlayer, UploadButton, AdminPanel, AdminUsersSection, AdminServerSection
- CSS vars in index.html <style> block — need to migrate/remove
- `"type": "commonjs"` in package.json — validate with Tailwind v4
- No path aliases configured (tsconfig or vite.config)
- No test infrastructure at all

## [2026-04-03] T1 Foundation complete
- shadcn/ui install worked via CLI after manual `components.json` setup; `npx shadcn@latest add ... -y` generated all 15 required ui components successfully.
- No Tailwind v4/Vite 8 peer dependency issue occurred in this repo, so no `overrides` block was needed.
- TypeScript 6 rejects `baseUrl` unless `"ignoreDeprecations": "6.0"` is set; adding that preserved the required `@/*` alias and restored a clean build.
## [2026-04-04] T2: vitest setup
- Vitest ran cleanly with jsdom + globals + setupFiles, and a simple mocked `useAuth()` render test was enough to verify the login form.
- `npm install` updated the lockfile with the testing deps; no config issues showed up in diagnostics.

## [2026-04-04] T4: App.tsx migration
- NavLink className={({ isActive }) => cn(...)} — React Router v7 API
- Button from @/components/ui/button replaces logout button
- Removed navLinkBaseStyle object

## [2026-04-04] T5: LoginPage migration
- Card/CardHeader/CardContent/CardTitle from @/components/ui/card
- Alert variant="destructive" for error messages
- Input + Label from shadcn — IDs preserved (#login-username, #login-password)
