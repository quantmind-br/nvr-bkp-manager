import type { FastifyInstance } from "fastify";
import { listFiles } from "../services/sftp.js";

export async function fileRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { path?: string } }>(
    "/api/files",
    async (request, reply) => {
      const remotePath = request.query.path ?? "/";

      try {
        const files = await listFiles(remotePath);

        // Add parent navigation entry if not at root
        if (remotePath !== "/" && remotePath !== "") {
          files.unshift({
            name: "..",
            size: 0,
            modifiedAt: "",
            isDirectory: true,
          });
        }

        return files;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        return reply.status(502).send({
          error: "Storage connection failed",
          details: message,
        });
      }
    },
  );
}
