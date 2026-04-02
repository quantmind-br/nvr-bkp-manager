import type { FastifyInstance } from "fastify";
import { createVideoStream } from "../services/stream.js";

export async function streamRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { file?: string } }>(
    "/api/stream",
    async (request, reply) => {
      const fileName = request.query.file;

      if (!fileName) {
        return reply.status(400).send({ error: "Missing 'file' query parameter" });
      }

      // Security: only allow filenames, no path traversal
      if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
        return reply.status(400).send({ error: "Invalid file name" });
      }

      let videoStream;
      try {
        videoStream = await createVideoStream(fileName);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply.status(502).send({ error: "Stream failed", details: message });
      }

      const { stream, contentType, cleanup } = videoStream;

      // Use raw Node.js response for streaming
      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": contentType,
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      stream.pipe(raw);

      stream.on("end", () => {
        cleanup();
        if (!raw.writableEnded) raw.end();
      });

      stream.on("error", (err) => {
        console.error("[Stream error]", err.message);
        cleanup();
        if (!raw.writableEnded) raw.end();
      });

      // Client disconnected — clean up resources
      request.raw.on("close", () => {
        cleanup();
        stream.destroy();
      });

      // Prevent Fastify from sending its own response
      return reply.hijack();
    },
  );
}
