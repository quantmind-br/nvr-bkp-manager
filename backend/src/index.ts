import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { config } from "./config.js";
import { seedDatabase } from "./seed.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { fileRoutes } from "./routes/files.js";
import { streamRoutes } from "./routes/stream.js";
import { auditRoutes } from "./routes/audit.js";

const app = Fastify({ logger: true });

await seedDatabase();

await app.register(cors);
await app.register(multipart, {
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
});
await app.register(authPlugin);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(fileRoutes);
await app.register(streamRoutes);
await app.register(auditRoutes);

try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`Server running on http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
