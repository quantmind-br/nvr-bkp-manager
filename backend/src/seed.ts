import { config } from "./config.js";
import {
  initUsersTable,
  getUserCount,
  createUser,
} from "./services/users.js";

export async function seedDatabase(): Promise<void> {
  initUsersTable();

  if (getUserCount() === 0) {
    const password = config.defaultAdminPassword;
    await createUser("admin", password, "admin");
    console.log("Seeded default admin user (username: admin)");
  }
}
