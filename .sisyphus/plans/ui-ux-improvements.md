# Implement IDEATION_UI_UX.md Improvements

## TL;DR
> **Summary**: Implement all 16 UI/UX improvements from `IDEATION_UI_UX.md` across the existing React SPA, while preserving the current inline-style architecture and avoiding new test infrastructure.
> **Deliverables**:
> - Shared design-token and interaction-style foundation in `frontend/index.html`
> - Updated `App.tsx`, `LoginPage.tsx`, `UploadButton.tsx`, `FileList.tsx`, and `VideoPlayer.tsx`
> - Minimal backend support for safer single-file downloads without exposing the long-lived session JWT in the URL
> - Agent-executed build + UI QA evidence for every task
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 → Tasks 4/5/6 → Task 7 → Task 8

## Context
### Original Request
- `implemente @IDEATION_UI_UX.md`

### Interview Summary
- Implement the full report scope: all 16 items from `IDEATION_UI_UX.md`
- Use the minimal mobile fix: horizontal scrolling around the file table, not a card-layout redesign
- Do not add frontend test infrastructure; verification remains build checks plus agent-executed QA evidence
- Keep the current inline-style approach, but allow a minimal shared styling surface in `frontend/index.html` for tokens, hover/focus rules, and accessibility helpers

### Metis Review (gaps addressed)
- Rejected `fetch(...).blob()` as the single-file download solution because NVR files can be large and browser-side buffering would be unsafe
- Replaced UIUX-014 with a safer short-lived, file-scoped download-token flow that preserves browser streaming while removing the long-lived session JWT from download URLs
- Confirmed `FileList.tsx` already has partial filter grouping, so UIUX-013 is a refinement of the date-filter presentation rather than a brand-new grouping system
- Standardized delete failures to the existing top-of-list error banner instead of adding a second inline error pattern

## Work Objectives
### Core Objective
Ship the entire UI/UX report as one coherent, low-regression update that improves accessibility, responsiveness, navigation, feedback, and visual consistency without introducing new dependencies or changing the core SPA architecture.

### Deliverables
- Shared `:root` design tokens and global interaction rules in `frontend/index.html`
- Branded loading screen and accessible login form labels
- Upload progress bar with live status announcements
- File list empty state, responsive scroll container, keyboard-accessible directory rows, breadcrumb navigation, inline delete confirmation, refined date-filter grouping, and safer download handling
- Video player close-button polish, live regions, keyboard-accessible seek bar, and hover seek preview
- Consistent color-token adoption across touched components

### Definition of Done (verifiable conditions with commands)
- `cd frontend && npm run build` exits 0 after all frontend changes
- `cd backend && npm run build` exits 0 after the download-token backend change
- `grep -n "window.confirm\\|alert(" frontend/src/components/FileList.tsx` returns no matches
- `grep -n "id=\"login-username\"\|id=\"login-password\"\|htmlFor=\"login-username\"\|htmlFor=\"login-password\"" frontend/src/components/LoginPage.tsx` returns the expected label/input bindings
- `grep -n "downloadToken" backend/src/plugins/auth.ts backend/src/routes/files.ts frontend/src/components/FileList.tsx` returns the new file-scoped download path
- `.sisyphus/evidence/` contains the task evidence files referenced below

### Must Have
- Preserve existing SPA structure (`App.tsx` + `AuthProvider` + inline component styles)
- Keep stream token handling unchanged for HLS playback
- Keep backend changes limited to what is strictly required for safer single-file downloads
- Keep upload behavior sequential across selected files; add progress feedback but no pause/retry/cancel scope
- Reuse existing UI patterns where the repo already has them (especially bulk-delete confirmation in `FileList.tsx`)

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT add a CSS framework, component library, router, or state-management library
- Must NOT add a standalone CSS file; all shared global styles must live in `frontend/index.html`
- Must NOT convert downloads to a full in-memory blob flow for all file sizes
- Must NOT redesign the mobile table into cards
- Must NOT change stream session/token mechanics or HLS playback architecture
- Must NOT broaden upload work into retry/cancel/resume features
- Must NOT replace the existing filter system or table structure beyond the approved report scope

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: none (no new automated test framework) + `npm run build` for frontend/backend
- QA policy: every task includes agent-executed scenarios using Playwright and/or shell commands
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`
- Browser QA assumptions: run the app through the existing dev stack; use seeded/admin credentials when admin-only UI is required
- Mocking policy: if environment data is insufficient for a scenario, Playwright may intercept API responses for that scenario instead of requiring a human to stage data

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. Remaining waves are intentionally smaller because the rest of the work serializes through `FileList.tsx` and the download-auth path.

Wave 1: shared style foundation + isolated component upgrades (`T1`, `T2`, `T3`, `T4`, `T5`)

Wave 2: serialized `FileList` interaction and navigation work (`T6`, `T7`)

Wave 3: cross-component consistency sweep (`T8`)

### Dependency Matrix (full, all tasks)
| Task | Depends On | Notes |
|---|---|---|
| T1 | — | Establishes the shared token/interaction vocabulary used everywhere else |
| T2 | — | Can proceed in parallel because token names are predetermined in the plan |
| T3 | — | Isolated to `UploadButton.tsx`; no shared-file conflicts |
| T4 | T1 | Uses shared tokens/focus selectors and touches `FileList.tsx` |
| T5 | T1 | Uses shared tokens/focus selectors and touches `VideoPlayer.tsx` |
| T6 | T4 | Serializes further `FileList.tsx` work after baseline table/accessibility updates |
| T7 | T4, T6 | Needs the stabilized `FileList.tsx` UI plus backend auth/download changes |
| T8 | T1, T2, T3, T4, T5, T6, T7 | Final sweep to remove leftover hardcoded palette drift |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 5 tasks → `visual-engineering` ×4, `unspecified-high` ×1
- Wave 2 → 2 tasks → `visual-engineering` ×1, `deep` ×1
- Wave 3 → 1 task → `visual-engineering` ×1

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Establish the shared style/token foundation

  **What to do**: Add a single `<style>` block to `frontend/index.html` that defines the shared palette as CSS custom properties and the only global interaction rules this plan is allowed to introduce. Define these exact tokens: `--color-primary`, `--color-success`, `--color-danger`, `--color-text`, `--color-text-muted`, `--color-text-faint`, `--color-border`, `--color-bg-subtle`, `--color-bg-panel`, `--radius-sm`, and `--radius-md`. Add these exact selectors: `button:hover:not(:disabled)`, `button:active:not(:disabled)`, `button:focus-visible`, `input:focus-visible`, `tr[data-dir-row="true"]:hover`, and `tr[data-dir-row="true"]:focus-visible`. Use `filter: brightness(0.92)` for hover, `transform: scale(0.97)` for active, and a `2px solid var(--color-primary)` outline with `outline-offset: 2px` for focus-visible.
  **Must NOT do**: Do not add a CSS file, CSS framework, CSS module, or component-library dependency. Do not move existing component styles out of inline objects. Do not add animations beyond a simple active-state scale/hover brightness treatment.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: this task defines the visual system and shared interaction affordances
  - Skills: [`frontend-ui-ux`] — shared color/token and accessibility-focused interaction polish
  - Omitted: [`playwright`] — implementation task; Playwright is reserved for QA execution only

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [4, 5, 8] | Blocked By: []

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/index.html:1-12` — only allowed location for new global styles in this plan
  - Pattern: `frontend/src/App.tsx:53-65` — existing plain button styling that should inherit shared hover/focus rules
  - Pattern: `frontend/src/components/FileList.tsx:43-54` — current shared action-button shape and radius values to normalize via tokens
  - Pattern: `frontend/src/components/FileList.tsx:723-829` — clickable row area that needs directory-row hover/focus treatment
  - Pattern: `frontend/src/components/VideoPlayer.tsx:191-205` — close button that should inherit the shared focus system
  - Report: `IDEATION_UI_UX.md:90-129` — focus-visibility requirement
  - Report: `IDEATION_UI_UX.md:194-237` — hover/active-state requirements
  - Report: `IDEATION_UI_UX.md:533-565` — design-token requirement and suggested token set

  **Acceptance Criteria** (agent-executable only):
  - [ ] `frontend/index.html` contains a single `<style>` block with the agreed `:root` tokens and shared interaction selectors
  - [ ] No new `.css` file is added anywhere under `frontend/`
  - [ ] Directory-row selectors are attribute-scoped (for example `tr[data-dir-row="true"]`) rather than generic `table tbody tr:hover`
  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Shared hover and focus styles render on existing buttons
    Tool: Playwright
    Steps: Launch the app, log in, hover the Logout button in the header, press Tab until the Logout button is focused, then capture screenshots of both states.
    Expected: Hover visibly darkens the button without layout shift; keyboard focus shows a clearly visible ring.
    Evidence: .sisyphus/evidence/task-1-shared-style-foundation.png

  Scenario: Disabled buttons are excluded from hover/active rules
    Tool: Bash
    Steps: Run `grep -n "button:hover:not(:disabled)\|button:active:not(:disabled)" frontend/index.html`.
    Expected: Both selectors are present in the new style block exactly as disabled-safe selectors.
    Evidence: .sisyphus/evidence/task-1-shared-style-foundation.txt
  ```

  **Commit**: YES | Message: `feat(ui): add shared tokens and interaction styles` | Files: [`frontend/index.html`]

- [x] 2. Polish the app shell and login form accessibility

  **What to do**: Update `frontend/src/App.tsx` so the loading state is a centered branded panel with the exact title text `NVR Backup Manager` and the exact loading copy `Loading...` instead of bare text. Update `frontend/src/components/LoginPage.tsx` to use visible labels above the username and password inputs with exact IDs `login-username` and `login-password`, exact label text `Username` and `Password`, keep placeholders only as secondary hints if desired, and migrate touched colors/radii to the new `var(--color-...)` tokens. Keep the current form structure and authentication flow unchanged.
  **Must NOT do**: Do not add a new page, routing layer, auth provider changes, or password reveal toggle. Do not hide the labels visually.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: this is a focused UI/accessibility polish task
  - Skills: [`frontend-ui-ux`] — precise label, spacing, and loading-state polish
  - Omitted: [`playwright`] — QA only, not needed for editing

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [8] | Blocked By: []

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/src/App.tsx:8-20` — current bare loading state to replace
  - Pattern: `frontend/src/App.tsx:27-68` — existing app-shell spacing, typography, and logout placement to preserve
  - Pattern: `frontend/src/components/LoginPage.tsx:49-114` — login form controls that need visible labels and tokenized styling
  - Pattern: `frontend/src/components/LoginPage.tsx:85-96` — existing inline error rendering to preserve
  - Report: `IDEATION_UI_UX.md:134-159` — label requirement
  - Report: `IDEATION_UI_UX.md:356-383` — branded loading requirement

  **Acceptance Criteria** (agent-executable only):
  - [ ] `App.tsx` loading branch renders the app title plus loading copy in a centered layout
  - [ ] `LoginPage.tsx` renders visible `<label>` elements associated to both inputs via `htmlFor`/`id`
  - [ ] Touched App/Login colors use the shared CSS variables instead of new hex literals
  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Login screen shows visible labels and preserved error handling
    Tool: Playwright
    Steps: Open the app while logged out, capture the login form, attempt login with invalid credentials, and capture the resulting error state.
    Expected: Username and Password labels remain visible before and after submission; the existing error message still appears without overlapping the form.
    Evidence: .sisyphus/evidence/task-2-app-login-accessibility.png

  Scenario: Branded loading screen appears during auth bootstrap
    Tool: Playwright
    Steps: Seed `localStorage.token` with any value, intercept `/api/auth/me` with an artificial delay, open the app, and capture the loading state before the delayed response resolves.
    Expected: The loading view shows “NVR Backup Manager” plus loading copy in a centered branded layout instead of bare text.
    Evidence: .sisyphus/evidence/task-2-app-login-loading.png
  ```

  **Commit**: YES | Message: `feat(ui): improve app loading and login accessibility` | Files: [`frontend/src/App.tsx`, `frontend/src/components/LoginPage.tsx`]

- [x] 3. Upgrade upload feedback, progress, and status announcements

  **What to do**: Refactor `frontend/src/components/UploadButton.tsx` so uploads use `XMLHttpRequest` per file instead of `fetch`, enabling `upload.onprogress` updates. Preserve sequential multi-file uploads, show a compact progress bar next to the status text, expose progress/status through `aria-live="polite"`, and expose failures through `role="alert"`/`aria-live="assertive"`. Because `apiFetch()` cannot drive upload progress, manually attach `Authorization: Bearer ${localStorage.getItem("token")}` to each XHR request and mirror `apiFetch()`’s 401 handling by removing the token and reloading the app before stopping the queue.
  **Must NOT do**: Do not add cancel/retry/pause controls, drag-and-drop upload, or concurrent uploads. Do not remove the hidden file input pattern.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: this task mixes UI polish with imperative upload/auth logic
  - Skills: []
  - Omitted: [`frontend-ui-ux`] — the hard part is transport/progress behavior, not visual invention

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [8] | Blocked By: []

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/src/components/UploadButton.tsx:12-46` — current sequential upload flow to preserve
  - Pattern: `frontend/src/components/UploadButton.tsx:48-81` — current hidden-input/button/status UI to extend
  - Pattern: `frontend/src/api.ts:1-20` — 401 behavior that must be mirrored manually in XHR mode
  - Pattern: `frontend/src/components/FileList.tsx:416-418` — upload button integration point that must keep working unchanged
  - Report: `IDEATION_UI_UX.md:255-284` — live-region requirement
  - Report: `IDEATION_UI_UX.md:288-312` — upload progress requirement

  **Acceptance Criteria** (agent-executable only):
  - [ ] Uploads still process selected files sequentially, one file at a time
  - [ ] Progress percentage/width updates while an upload is in flight
  - [ ] Success status uses `aria-live="polite"`; error status uses `role="alert"` and/or `aria-live="assertive"`
  - [ ] XHR requests send the bearer token manually and mirror `apiFetch()`’s 401 logout behavior
  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Upload shows in-flight progress and success feedback
    Tool: Playwright
    Steps: Log in as admin, choose a representative file through the hidden input, start an upload, wait for the progress bar to appear, and capture the in-flight and completed states.
    Expected: Progress bar width increases during upload, status text names the active file, and success feedback replaces the in-flight message when complete.
    Evidence: .sisyphus/evidence/task-3-upload-progress.png

  Scenario: Server failure is announced accessibly
    Tool: Playwright
    Steps: Intercept the upload request to return HTTP 500, trigger an upload, and capture the resulting error state.
    Expected: The component renders an error message in an assertive/alert status container, clears the progress bar, and keeps the UI usable for a later retry.
    Evidence: .sisyphus/evidence/task-3-upload-progress-error.png
  ```

  **Commit**: YES | Message: `feat(ui): add upload progress feedback` | Files: [`frontend/src/components/UploadButton.tsx`]

- [x] 4. Refine file-list feedback, responsiveness, and keyboard entry points

  **What to do**: Update `frontend/src/components/FileList.tsx` to add the empty-state message described by UIUX-001, wrap the table in a horizontal-scroll container for narrow screens, and make the list’s async messaging accessible. Specifically: (1) render an empty-state panel when `!loading && !error` and the displayed items excluding `..` are zero, with exact copy `No files found.` and conditional suffix ` Try adjusting your filters.` whenever any file filter is active; (2) move the table inside a wrapper with `overflowX: "auto"` and a fixed `minWidth` of `960px`; (3) apply `aria-live="polite"` to loading and non-error status text and `role="alert"` plus `aria-live="assertive"` to error-style banners; and (4) make directory rows keyboard-focusable with `tabIndex={0}`, `data-dir-row="true"`, and Enter-key navigation. Use the new shared tokens for touched colors and borders.
  **Must NOT do**: Do not convert the table into cards, change the existing sort/filter query behavior, or touch delete/download logic in this task.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: responsive layout and accessibility improvements within the existing table UI
  - Skills: [`frontend-ui-ux`] — useful for accessible empty states and keyboard-entry affordances
  - Omitted: [`playwright`] — implementation only; browser checks happen in QA

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [6, 7, 8] | Blocked By: [1]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/src/components/FileList.tsx:275-281` — displayed-file logic already excludes directories for selection and can inspire the empty-state count logic
  - Pattern: `frontend/src/components/FileList.tsx:395-419` — top path/status bar above the table
  - Pattern: `frontend/src/components/FileList.tsx:649-673` — existing loading, bulk-delete-result, and error banners to upgrade with live-region semantics
  - Pattern: `frontend/src/components/FileList.tsx:682-829` — table structure, row click handling, and existing widths that justify the `minWidth` wrapper
  - Report: `IDEATION_UI_UX.md:16-43` — empty-state requirement
  - Report: `IDEATION_UI_UX.md:90-129` — keyboard-accessible row requirement
  - Report: `IDEATION_UI_UX.md:163-189` — mobile scroll-wrapper requirement
  - Report: `IDEATION_UI_UX.md:255-284` — live-region requirement

  **Acceptance Criteria** (agent-executable only):
  - [ ] Empty-state copy appears whenever the visible file count excluding `..` is zero
  - [ ] The table sits inside a scroll wrapper with `overflow-x: auto` and `minWidth: 960px`
  - [ ] Loading/bulk-result text is polite live content; error banners are assertive alert content
  - [ ] Directory rows are focusable and Enter triggers the same navigation as click
  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Empty state and responsive table wrapper work on narrow screens
    Tool: Playwright
    Steps: Intercept `/api/files` once with an empty array, load the file list at a mobile viewport (390x844), and capture the rendered list region.
    Expected: The empty-state message is visible, the table container does not break the page width, and the wrapper still exists for future non-empty renders.
    Evidence: .sisyphus/evidence/task-4-filelist-feedback-mobile.png

  Scenario: Directory rows are keyboard navigable
    Tool: Playwright
    Steps: Intercept `/api/files` with one directory entry and one file entry, press Tab until the directory row is focused, press Enter, and capture the resulting path bar.
    Expected: Focus lands on the directory row with visible focus treatment and Enter updates `currentPath` exactly as a click would.
    Evidence: .sisyphus/evidence/task-4-filelist-feedback-keyboard.png
  ```

  **Commit**: YES | Message: `feat(ui): improve file list empty states and responsiveness` | Files: [`frontend/src/components/FileList.tsx`]

- [x] 5. Improve video-player accessibility and seek interactions

  **What to do**: Update `frontend/src/components/VideoPlayer.tsx` to polish the close control and make the custom seek bar keyboard-accessible. Replace the plain `X` with `×`, add a subtle hover background and tokenized colors, expose status/error copy through live regions, and enhance the seek bar with `tabIndex={0}`, `role="slider"`, `aria-label="Seek position"`, `aria-valuemin={0}`, `aria-valuemax={durationSeconds ?? 0}`, `aria-valuenow={Math.floor(currentTime)}`, and ArrowLeft/ArrowRight key handling that calls `startStream()` with a step of `Math.max(1, Math.floor(durationSeconds * 0.05))` seconds after `e.preventDefault()`. Also add a hover-preview tooltip showing the formatted target time without implementing drag-to-seek.
  **Must NOT do**: Do not change the HLS startup flow, stream token usage, modal layout structure, or add drag scrubbing, preview thumbnails, or a focus trap.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: this is a UI/accessibility-heavy media-control task
  - Skills: [`frontend-ui-ux`] — interaction polish and accessible control semantics
  - Omitted: [`playwright`] — QA only

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [8] | Blocked By: [1]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/src/components/VideoPlayer.tsx:22-27` — existing playback state available for hover/keyboard logic
  - Pattern: `frontend/src/components/VideoPlayer.tsx:40-120` — `startStream()` entry point that all seek actions must continue to use
  - Pattern: `frontend/src/components/VideoPlayer.tsx:142-148` — current click-only seek implementation to extend
  - Pattern: `frontend/src/components/VideoPlayer.tsx:191-205` — close button to restyle and relabel visually
  - Pattern: `frontend/src/components/VideoPlayer.tsx:208-218` — status and error messaging that needs live-region semantics
  - Pattern: `frontend/src/components/VideoPlayer.tsx:232-296` — seek-bar rendering area for keyboard semantics and hover tooltip
  - Report: `IDEATION_UI_UX.md:90-129` — seek-bar keyboard accessibility requirement
  - Report: `IDEATION_UI_UX.md:255-284` — live-region requirement
  - Report: `IDEATION_UI_UX.md:316-352` — close-button polish requirement
  - Report: `IDEATION_UI_UX.md:489-529` — hover-time preview requirement

  **Acceptance Criteria** (agent-executable only):
  - [ ] Close button renders `×`, keeps `aria-label="Close player"`, and shows hover/focus treatment
  - [ ] Status text is polite live content; error text is alert/assertive content
  - [ ] The custom seek bar is keyboard-focusable and ArrowLeft/ArrowRight trigger 5%-step seeks through `startStream()`
  - [ ] Hovering the seek bar shows a formatted target-time tooltip that disappears on mouse leave
  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Seek bar exposes keyboard and hover affordances
    Tool: Playwright
    Steps: Open any playable file in the video modal, focus the custom seek bar with Tab, press ArrowRight once, hover near the 75% point on the bar, and capture the control area.
    Expected: The seek bar shows visible focus, ArrowRight triggers a seek request based on a 5% step, and the hover tooltip displays a formatted target time.
    Evidence: .sisyphus/evidence/task-5-video-player-controls.png

  Scenario: Error messaging remains accessible when playback fails
    Tool: Playwright
    Steps: Intercept the stream-start request to return an error, open the player, and capture the error state.
    Expected: The modal shows an alert-style error message, hides unusable playback content, and keeps the close button available.
    Evidence: .sisyphus/evidence/task-5-video-player-controls-error.png
  ```

  **Commit**: YES | Message: `feat(ui): improve video player accessibility` | Files: [`frontend/src/components/VideoPlayer.tsx`]

- [x] 6. Add breadcrumb navigation and clarify date-filter modes

  **What to do**: Continue in `frontend/src/components/FileList.tsx` after Task 4 and replace the static path text with clickable breadcrumbs. Render `/` as the root button, render each path segment as a button-like breadcrumb, and render only the current segment as non-clickable current text. Keep the existing monospace path-bar styling. In the same task, refine the Date filter group so it explicitly distinguishes `Single day` from `Date range` while preserving the existing mutual-exclusion logic (`dateFilter` clears range inputs and vice versa). Use two stacked mini-sections inside the existing date filter group with exact labels `Single day`, `Date range`, `From`, and `To` rather than inventing a new filter system.
  **Must NOT do**: Do not change filter query parameter names, sorting behavior, or the path state shape. Do not add icons, chips, or a breadcrumb dropdown.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: this is navigation and form-clarity work inside an existing component
  - Skills: [`frontend-ui-ux`] — breadcrumb semantics and filter grouping polish
  - Omitted: [`playwright`] — QA only

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [7, 8] | Blocked By: [4]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/src/components/FileList.tsx:64-65` — `currentPath` state already drives navigation
  - Pattern: `frontend/src/components/FileList.tsx:187-197` — existing `navigateTo()` behavior that breadcrumb clicks must reuse instead of duplicating path logic
  - Pattern: `frontend/src/components/FileList.tsx:395-419` — current path-bar layout to preserve structurally
  - Pattern: `frontend/src/components/FileList.tsx:466-495` — existing Date filter controls and mutual-clearing logic to retain
  - Pattern: `frontend/src/components/FileList.tsx:370-393` — current filter grouping baseline; refine rather than replace
  - Report: `IDEATION_UI_UX.md:389-420` — breadcrumb requirement
  - Report: `IDEATION_UI_UX.md:424-450` — filter-grouping clarification requirement

  **Acceptance Criteria** (agent-executable only):
  - [ ] The path bar renders clickable root and intermediate breadcrumb segments, while the active leaf is non-clickable text
  - [ ] Breadcrumb clicks reuse the existing `currentPath` navigation behavior without changing path semantics
  - [ ] The Date filter visibly distinguishes `Single day` and `Date range` modes while preserving current state-clearing behavior
  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Breadcrumbs jump to parent directories directly
    Tool: Playwright
    Steps: Intercept `/api/files` with nested directory navigation data, navigate into at least two levels, click the root breadcrumb and then an intermediate breadcrumb, and capture both resulting path states.
    Expected: Clicking `/` returns to root immediately and clicking an intermediate segment jumps directly to that ancestor path.
    Evidence: .sisyphus/evidence/task-6-breadcrumbs-and-filters.png

  Scenario: Date filter modes remain mutually exclusive
    Tool: Playwright
    Steps: Enter a `Single day` value, then enter a `Date range` start/end, and capture the filter controls after each step.
    Expected: Entering range values clears the single-day field, and entering a single-day value clears the range inputs while the new labels remain visible.
    Evidence: .sisyphus/evidence/task-6-breadcrumbs-and-filters-modes.png
  ```

  **Commit**: YES | Message: `feat(ui): add breadcrumbs and clarify date filters` | Files: [`frontend/src/components/FileList.tsx`]

- [x] 7. Replace blocking delete dialogs and harden single-file download links

  **What to do**: Finish the remaining `FileList.tsx` interaction work and add the minimal backend support required by UIUX-014. In `frontend/src/components/FileList.tsx`, introduce `confirmingDelete: string | null` and `downloadingFile: string | null` state, replace the `window.confirm()`/`alert()` delete flow with the existing inline Yes/No pattern already used for bulk delete, and route delete/download failures through the top-level `error` banner via `setError(...)`. Also change single-file downloads to a two-step flow: call a new authenticated backend endpoint to mint a short-lived, file-scoped download token, then trigger a normal anchor download using the returned streaming URL. In `backend/src/routes/files.ts`, add exact route `GET /api/download-token?file=...` that validates the filename and returns `{ downloadUrl: string, expiresInSeconds: 30 }`, where `downloadUrl` is `/api/download?file=<encoded>&downloadToken=<jwt>`. Sign the JWT with the current user claims plus `scope: "download"`, `file`, and a strict `30s` expiry. In `backend/src/plugins/auth.ts`, extend `/api/download` auth to accept `downloadToken` in addition to the legacy `token`, verify that `scope === "download"`, and require the token’s `file` claim to match the requested `file` parameter before allowing the stream.
  **Must NOT do**: Do not use `fetch(...).blob()` or object URLs for single-file downloads. Do not change bulk-download behavior. Do not remove legacy `?token=` support for `/api/download`; keep it as a backward-compatible fallback while the frontend migrates to `downloadToken`.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this task crosses frontend UI, backend auth, and download streaming behavior
  - Skills: []
  - Omitted: [`frontend-ui-ux`] — the critical work is auth/download correctness rather than visual invention

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [8] | Blocked By: [4, 6]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/src/components/FileList.tsx:152-160` — current direct anchor download flow to replace
  - Pattern: `frontend/src/components/FileList.tsx:162-185` — current blocking delete flow to replace
  - Pattern: `frontend/src/components/FileList.tsx:613-644` — existing inline bulk-delete confirmation pattern to mirror for single-file delete
  - Pattern: `frontend/src/components/FileList.tsx:661-673` — existing top-of-list error banner that should receive delete/download failures
  - Pattern: `frontend/src/components/FileList.tsx:789-823` — action-cell buttons where new delete/download states must render
  - Pattern: `frontend/src/api.ts:1-20` — authenticated request wrapper to use when requesting the short-lived download token
  - API/Type: `backend/src/plugins/auth.ts:6-10` — JWT typing that must allow optional download-scope claims
  - API/Type: `backend/src/plugins/auth.ts:34-58` — current download/stream query-token logic to extend for `downloadToken`
  - API/Type: `backend/src/routes/files.ts:242-305` — existing streaming download route that must stay browser-streamed
  - Report: `IDEATION_UI_UX.md:46-87` — inline delete-confirmation requirement
  - Report: `IDEATION_UI_UX.md:454-485` — token-exposure reduction requirement

  **Acceptance Criteria** (agent-executable only):
  - [ ] `FileList.tsx` contains no `window.confirm()` or `alert()` calls
  - [ ] Single-file delete uses inline confirm/cancel controls in the actions cell and clears the confirmation state after success or cancellation
  - [ ] `GET /api/download-token?file=...` exists, requires normal bearer auth, and returns a `downloadUrl` that uses `downloadToken=` rather than the long-lived session token
  - [ ] `/api/download` accepts the new `downloadToken`, rejects mismatched file claims, and still preserves legacy `token` compatibility
  - [ ] `cd frontend && npm run build` and `cd backend && npm run build` both exit 0

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Inline delete confirmation and short-lived download links work together
    Tool: Playwright
    Steps: Intercept `/api/files` with one downloadable file row, intercept `/api/download-token` with a success payload containing a fake `downloadUrl`, click Delete then No, click Delete again then Yes with a successful DELETE response, click Download, and capture the action cell plus resulting anchor target.
    Expected: Delete uses inline Yes/No controls with no browser dialog, successful delete refreshes the list, and the generated download URL contains `downloadToken=` but not the long-lived session JWT.
    Evidence: .sisyphus/evidence/task-7-file-actions-and-downloads.png

  Scenario: Delete/download failures surface in the existing error banner
    Tool: Playwright
    Steps: Intercept DELETE `/api/files*` with HTTP 500 and `/api/download-token*` with HTTP 500, trigger both actions from the file list, and capture the top-of-list error banner.
    Expected: Failures appear in the shared error banner area, no `alert()`/`confirm()` dialog appears, and action buttons return to an interactive idle state after the failure.
    Evidence: .sisyphus/evidence/task-7-file-actions-and-downloads-error.png
  ```

  **Commit**: YES | Message: `feat(ui): replace blocking dialogs and secure downloads` | Files: [`frontend/src/components/FileList.tsx`, `backend/src/plugins/auth.ts`, `backend/src/routes/files.ts`]

- [x] 8. Sweep remaining magic colors into the shared token system

  **What to do**: After Tasks 1-7 are merged, do one final consistency pass across `frontend/src/App.tsx`, `frontend/src/components/LoginPage.tsx`, `frontend/src/components/UploadButton.tsx`, `frontend/src/components/FileList.tsx`, and `frontend/src/components/VideoPlayer.tsx`. Replace remaining report-listed palette literals with `var(--color-...)` references, keep only intentional `rgba(...)` overlay colors and any semantically clearer black/white usages that were explicitly left alone, and normalize border-radius/border colors to the shared variables. This task is not allowed to change layout or behavior; it is a mechanical consistency sweep that closes UIUX-016 fully.
  **Must NOT do**: Do not introduce new token names after Task 1 unless a previously planned token is truly missing. Do not restyle components beyond color/radius/border consistency. Do not touch backend files.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: this is a pure consistency and design-system cleanup pass
  - Skills: [`frontend-ui-ux`] — keeps the sweep visually coherent without scope creep
  - Omitted: [`playwright`] — QA only

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [F1, F2, F3, F4] | Blocked By: [1, 2, 3, 4, 5, 6, 7]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `frontend/src/App.tsx:10-68` — remaining shell colors/radii after earlier tasks
  - Pattern: `frontend/src/components/LoginPage.tsx:24-117` — panel/input/button styling that should now use tokens
  - Pattern: `frontend/src/components/UploadButton.tsx:48-81` — upload status and button colors that should use tokens
  - Pattern: `frontend/src/components/FileList.tsx:370-829` — file-list filters, banners, table cells, and action buttons that should use tokens after prior tasks land
  - Pattern: `frontend/src/components/VideoPlayer.tsx:150-299` — modal text/control colors to normalize where appropriate
  - Pattern: `frontend/index.html:1-12` — the canonical token names introduced in Task 1
  - Report: `IDEATION_UI_UX.md:533-565` — design-token objective driving this sweep

  **Acceptance Criteria** (agent-executable only):
  - [ ] The touched frontend components use shared `var(--color-...)` tokens for the report-listed palette instead of repeated magic hex literals
  - [ ] Residual raw color literals are limited to intentional `rgba(...)`, `transparent`, and explicitly justified black/white usages only
  - [ ] `grep -n "#0066cc\|#228B22\|#cc0000\|#666\|#999\|#ddd\|#f0f0f0\|#f8f8f8\|#fff0f0" frontend/src/App.tsx frontend/src/components/LoginPage.tsx frontend/src/components/UploadButton.tsx frontend/src/components/FileList.tsx frontend/src/components/VideoPlayer.tsx` returns no matches
  - [ ] `cd frontend && npm run build` exits 0

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Token sweep leaves a visually consistent app surface
    Tool: Playwright
    Steps: Capture the login screen, authenticated file-list screen, and video-player modal after the sweep.
    Expected: Primary, success, danger, muted-text, and border colors are visually consistent across all three screenshots with no one-off palette drift.
    Evidence: .sisyphus/evidence/task-8-token-sweep.png

  Scenario: No targeted palette hex literals remain in touched components
    Tool: Bash
    Steps: Run `grep -n "#0066cc\|#228B22\|#cc0000\|#666\|#999\|#ddd\|#f0f0f0\|#f8f8f8\|#fff0f0" frontend/src/App.tsx frontend/src/components/LoginPage.tsx frontend/src/components/UploadButton.tsx frontend/src/components/FileList.tsx frontend/src/components/VideoPlayer.tsx`.
    Expected: The command returns no matches.
    Evidence: .sisyphus/evidence/task-8-token-sweep.txt
  ```

  **Commit**: YES | Message: `refactor(ui): normalize remaining palette usage` | Files: [`frontend/src/App.tsx`, `frontend/src/components/LoginPage.tsx`, `frontend/src/components/UploadButton.tsx`, `frontend/src/components/FileList.tsx`, `frontend/src/components/VideoPlayer.tsx`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Create one commit per implementation task (`T1`-`T8`) in task order
- Do not combine `FileList.tsx` tasks across waves; keep them atomic to simplify rollback
- Keep the backend download-token change in the same commit as the frontend download-link change (`T7`) so the app never lands in a half-wired state

## Success Criteria
- All 16 report items are either fully implemented or explicitly satisfied by a safer in-scope refinement decision recorded in this plan
- Frontend and backend both build successfully
- No browser-native `alert()`/`confirm()` calls remain in the file list delete flow
- Keyboard users can operate login, file navigation, and the custom video seek bar with visible focus treatment
- Mobile-width file browsing remains usable through horizontal scroll instead of layout breakage
- Single-file downloads no longer expose the long-lived session JWT in the URL
- Remaining palette usage is normalized to shared tokens instead of scattered magic hex values
