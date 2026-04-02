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
  // Start an HLS transcoding session — returns sessionId + duration
  app.get<{ Querystring: { file?: string; start?: string } }>(
    "/api/stream/start",
    async (request, reply) => {
      const fileName = request.query.file;
      const startSeconds = parseInt(request.query.start ?? "0", 10) || 0;

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

      // Parse duration from filename (no I/O needed)
      const durationMatch = fileName.match(
        /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/,
      );
      let durationSeconds: number | null = null;
      if (durationMatch) {
        const s = new Date(`${durationMatch[1]}-${durationMatch[2]}-${durationMatch[3]}T${durationMatch[4]}:${durationMatch[5]}:${durationMatch[6]}`);
        const e = new Date(`${durationMatch[7]}-${durationMatch[8]}-${durationMatch[9]}T${durationMatch[10]}:${durationMatch[11]}:${durationMatch[12]}`);
        const diff = (e.getTime() - s.getTime()) / 1000;
        if (diff > 0) durationSeconds = diff;
      }

      // Generate session ID immediately and return — no I/O blocking
      const { randomBytes } = await import("crypto");
      const sessionId = randomBytes(8).toString("hex");

      logAction(
        request.user.sub,
        request.user.username,
        "stream",
        fileName,
        `session:${sessionId} start:${startSeconds}s`,
        request.ip,
      );

      // Pre-register a placeholder session so playlist polling finds it
      const { mkdirSync } = await import("fs");
      const { join } = await import("path");
      const { tmpdir } = await import("os");
      const hlsDir = join(tmpdir(), `nvr-hls-${sessionId}`);
      mkdirSync(hlsDir, { recursive: true });
      registerSession({
        sessionId,
        hlsDir,
        startSeconds,
        durationSeconds,
        cleanup: () => {},
        ready: Promise.resolve(),
      });

      // Start transcoding in background (async, no await)
      createHlsSession(fileName, startSeconds, sessionId)
        .then((session) => {
          registerSession(session); // Replace placeholder with real session
          session.ready.catch(() => removeSession(sessionId));
        })
        .catch((err) => {
          console.error("[Stream init error]", err instanceof Error ? err.message : err);
          removeSession(sessionId);
        });

      return { sessionId, startSeconds, durationSeconds };
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
