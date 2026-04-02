import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { fileRoutes } from "./routes/files.js";

const app = Fastify({ logger: true });

await app.register(cors);
await app.register(healthRoutes);
await app.register(fileRoutes);

try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`Server running on http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
