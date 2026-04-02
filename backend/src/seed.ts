import { config } from "./config.js";
import {
  initUsersTable,
  getUserCount,
  createUser,
} from "./services/users.js";
import { initAuditTable } from "./services/audit.js";
import { initSettingsTable, ensureSettingsRow } from "./services/settings.js";

export async function seedDatabase(): Promise<void> {
  initUsersTable();
  initAuditTable();
  initSettingsTable();
  ensureSettingsRow();

  if (getUserCount() === 0) {
    const password = config.defaultAdminPassword;
    await createUser("admin", password, "admin");
    console.log("Seeded default admin user (username: admin)");
  }
}
