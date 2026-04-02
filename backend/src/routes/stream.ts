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

  // Debug: test SFTP + FFmpeg pipeline
  app.get("/api/stream/debug", async () => {
    const { spawn } = await import("child_process");
    const { listFiles, getReadStream } = await import("../services/sftp.js");
    const results: string[] = [];

    // Test 1: SFTP list (same as /api/files)
    try {
      const files = await listFiles("/");
      results.push(`SFTP list: OK (${files.length} files)`);
    } catch (e) {
      results.push(`SFTP list: FAILED - ${e instanceof Error ? e.message : e}`);
    }

    // Test 2: SFTP read stream
    try {
      const handle = await getReadStream("ch0_2026-02-03_07-11-54_2026-02-03_07-13-41.dav");
      results.push("SFTP readStream: connected");
      // Read a small chunk to confirm stream works
      await new Promise<void>((resolve, reject) => {
        let bytes = 0;
        handle.stream.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1024) {
            handle.stream.destroy();
            resolve();
          }
        });
        handle.stream.on("error", reject);
        setTimeout(() => reject(new Error("timeout")), 15000);
      });
      results.push("SFTP readStream: data received");
      handle.sftp.end().catch(() => {});
    } catch (e) {
      results.push(`SFTP readStream: FAILED - ${e instanceof Error ? e.message : e}`);
    }

    // Test 3: FFmpeg pipe test (small)
    try {
      const ver = await new Promise<string>((resolve) => {
        const p = spawn("ffmpeg", ["-version"]);
        let out = "";
        p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
        p.on("close", () => resolve(out.split("\n")[0] ?? "unknown"));
      });
      results.push(`FFmpeg: ${ver}`);
    } catch (e) {
      results.push(`FFmpeg: FAILED - ${e instanceof Error ? e.message : e}`);
    }

    // Test 4: FFmpeg transcode test (pipe SFTP → FFmpeg for 3 seconds)
    try {
      const handle = await getReadStream("ch0_2026-02-03_07-11-54_2026-02-03_07-13-41.dav");
      const ffmpeg = spawn("ffmpeg", [
        "-f", "hevc", "-i", "pipe:0",
        "-t", "3", "-c:v", "libx264", "-preset", "ultrafast",
        "-f", "null", "-",
      ], { stdio: ["pipe", "pipe", "pipe"] });

      handle.stream.pipe(ffmpeg.stdin!);
      let stderr = "";
      ffmpeg.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

      const code = await new Promise<number | null>((resolve) => {
        const timeout = setTimeout(() => { ffmpeg.kill(); resolve(-1); }, 30000);
        ffmpeg.on("close", (c) => { clearTimeout(timeout); resolve(c); });
      });

      handle.sftp.end().catch(() => {});
      const frameMatch = stderr.match(/frame=\s*(\d+)/);
      results.push(`FFmpeg transcode: exit=${code} frames=${frameMatch?.[1] ?? "0"}`);
      if (code !== 0) {
        const errLines = stderr.split("\n").filter(l => l.toLowerCase().includes("error"));
        if (errLines.length) results.push(`FFmpeg errors: ${errLines.join("; ").slice(0, 200)}`);
      }
    } catch (e) {
      results.push(`FFmpeg transcode: FAILED - ${e instanceof Error ? e.message : e}`);
    }

    // Test 5: /tmp writable
    try {
      const { writeFileSync, unlinkSync } = await import("fs");
      const { tmpdir } = await import("os");
      const testFile = `${tmpdir()}/nvr-test-write`;
      writeFileSync(testFile, "test");
      unlinkSync(testFile);
      results.push(`Tmpdir: ${tmpdir()} writable`);
    } catch (e) {
      results.push(`Tmpdir: FAILED - ${e instanceof Error ? e.message : e}`);
    }

    return { results };
  });

  // Stop a session and clean up
  app.delete<{ Params: { sessionId: string } }>(
    "/api/stream/:sessionId",
    async (request) => {
      removeSession(request.params.sessionId);
      return { success: true };
    },
  );
}
