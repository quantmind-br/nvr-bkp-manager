import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync } from "fs";
import { join } from "path";
import {
  createHlsSession,
  registerSession,
  getSession,
  removeSession,
} from "../services/stream.js";
import { logAction } from "../services/audit.js";

export async function streamRoutes(app: FastifyInstance) {
  // Start an HLS transcoding session — returns sessionId
  app.get<{ Querystring: { file?: string } }>(
    "/api/stream/start",
    async (request, reply) => {
      const fileName = request.query.file;

      if (!fileName) {
        return reply
          .status(400)
          .send({ error: "Missing 'file' query parameter" });
      }

      if (
        fileName.includes("/") ||
        fileName.includes("\\") ||
        fileName.includes("..")
      ) {
        return reply.status(400).send({ error: "Invalid file name" });
      }

      try {
        const session = await createHlsSession(fileName);
        registerSession(session);

        logAction(
          request.user.sub,
          request.user.username,
          "stream",
          fileName,
          `session:${session.sessionId}`,
          request.ip,
        );

        // Wait for first segment before returning
        await session.ready;

        return { sessionId: session.sessionId };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply
          .status(502)
          .send({ error: "Stream failed", details: message });
      }
    },
  );

  // Serve HLS playlist (.m3u8)
  app.get<{ Params: { sessionId: string } }>(
    "/api/stream/:sessionId/stream.m3u8",
    async (request, reply) => {
      const session = getSession(request.params.sessionId);
      if (!session) {
        return reply.status(404).send({ error: "Session not found" });
      }

      const playlistPath = join(session.hlsDir, "stream.m3u8");
      if (!existsSync(playlistPath)) {
        return reply.status(404).send({ error: "Playlist not ready" });
      }

      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      });

      createReadStream(playlistPath).pipe(raw);
      return reply.hijack();
    },
  );

  // Serve HLS segments (.ts)
  app.get<{ Params: { sessionId: string; segment: string } }>(
    "/api/stream/:sessionId/:segment",
    async (request, reply) => {
      const session = getSession(request.params.sessionId);
      if (!session) {
        return reply.status(404).send({ error: "Session not found" });
      }

      const segmentPath = join(session.hlsDir, request.params.segment);

      // Security: prevent path traversal
      if (!segmentPath.startsWith(session.hlsDir)) {
        return reply.status(400).send({ error: "Invalid segment" });
      }

      if (!existsSync(segmentPath)) {
        return reply.status(404).send({ error: "Segment not found" });
      }

      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "video/mp2t",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      });

      createReadStream(segmentPath).pipe(raw);
      return reply.hijack();
    },
  );

  // Stop a session and clean up
  app.delete<{ Params: { sessionId: string } }>(
    "/api/stream/:sessionId",
    async (request) => {
      removeSession(request.params.sessionId);
      return { success: true };
    },
  );
}
