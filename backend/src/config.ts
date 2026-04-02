import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root (parent of backend/)
loadEnv({ path: resolve(__dirname, "../../.env") });

export const config = {
  port: parseInt(process.env["PORT"] ?? "3001", 10),
  host: process.env["HOST"] ?? "0.0.0.0",
  nodeEnv: process.env["NODE_ENV"] ?? "development",

  jwt: {
    secret: process.env["JWT_SECRET"] ?? "dev-secret-change-in-production",
    expiresIn: "24h",
  },

  defaultAdminPassword: process.env["DEFAULT_ADMIN_PASSWORD"] ?? "admin",
};
