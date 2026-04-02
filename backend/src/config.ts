import "dotenv/config";

export const config = {
  port: parseInt(process.env["PORT"] ?? "3001", 10),
  host: process.env["HOST"] ?? "0.0.0.0",
  nodeEnv: process.env["NODE_ENV"] ?? "development",

  storage: {
    host: process.env["STORAGE_HOST"] ?? "",
    port: parseInt(process.env["STORAGE_PORT"] ?? "23", 10),
    user: process.env["STORAGE_USER"] ?? "",
    password: process.env["STORAGE_PASSWORD"] ?? "",
    path: process.env["STORAGE_PATH"] ?? "/home/backups/nvr",
  },
};
