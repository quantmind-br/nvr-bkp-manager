# Browser QA — f3-admin-panel

**Date:** 2026-04-03
**Tool:** agent-browser (Chromium CDP)
**Env:** Docker Compose base (nginx:80 + backend:3001)

## Results: 8/8 PASS

### B1: Navigate to http://localhost
- **[PASS]** Login page loads with "NVR Backup Manager" heading, username/password fields, Login button

### B2: Login as admin
- **[PASS]** Login with admin/admin succeeds, redirects to file browser

### B3: "Administration" button visible for admin
- **[PASS]** Navigation shows: `link "Files"`, `link "Administration"`, `button "Logout"`, "admin (admin)" label

### B4: Click Administration -> /admin route loads
- **[PASS]** Clicking "Administration" loads admin panel with "Administration" heading (h2)

### B5: Users section visible with admin user
- **[PASS]** Users table shows admin user with columns: Username, Role, Created, Updated, Actions
- Edit button available, Delete button disabled (self-delete protection)
- "Create User" button visible

### B6: Server section visible with SFTP settings form
- **[PASS]** "Server Settings" heading with form fields: host, port (23), user, password, path (/home/backups/nvr), "Save Server Settings" button

### B7: Navigate back to file browser
- **[PASS]** Clicking "Files" returns to file browser with path "/", filters, upload button

### B8: Viewer sees NO Administration button
- **[PASS]** After logout and login as viewer:
  - Only `link "Files"` visible in navigation (no "Administration")
  - No "Upload" button (read-only viewer)
  - Shows "viewer (viewer)" label

## Screenshots
- `01-admin-logged-in.png` - Admin logged in, file browser
- `02-admin-panel-users.png` - Admin panel, Users section
- `03-admin-panel-server.png` - Admin panel, Server section
- `04-viewer-no-admin.png` - Viewer logged in, no admin button
