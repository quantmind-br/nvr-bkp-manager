import type { FastifyInstance } from "fastify";
import { createReadStream, constants } from "fs";
import { access, mkdir, readdir, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { spawn } from "child_process";
import {
  createHlsSession,
  registerSession,
  getSession,
  removeSession,
} from "../services/stream.js";
import { logAction } from "../services/audit.js";
import {
  StorageNotConfiguredError,
  getReadStream,
  type SftpStream,
} from "../services/sftp.js";
import { buildRemotePath, validatePath } from "./files.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function streamRoutes(app: FastifyInstance) {
  // Start an HLS transcoding session — returns sessionId + duration
  app.get<{ Querystring: { file?: string; path?: string; start?: string } }>(
    "/api/stream/start",
    async (request, reply) => {
      const fileName = request.query.file;
      const remotePath = validatePath(request.query.path);
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

      if (!remotePath) {
        return reply.status(400).send({ error: "Missing or invalid 'path' query parameter" });
      }

      const remoteFilePath = buildRemotePath(remotePath, fileName);

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
      const sessionId = randomBytes(8).toString("hex");

      logAction(
        request.user.sub,
        request.user.username,
        "stream",
        remoteFilePath,
        `session:${sessionId} start:${startSeconds}s`,
        request.ip,
      );

      // Pre-register a placeholder session so playlist polling finds it
      const hlsDir = join(tmpdir(), `nvr-hls-${sessionId}`);
      await mkdir(hlsDir, { recursive: true });
      registerSession({
        sessionId,
        hlsDir,
        startSeconds,
        durationSeconds,
        createdAt: 0,
        cleanup: () => {},
        ready: Promise.resolve(),
      });

      // Start transcoding in background (async, no await)
      createHlsSession(remoteFilePath, startSeconds, sessionId)
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
      if (!(await fileExists(playlistPath))) {
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

      if (!(await fileExists(segmentPath))) {
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

  // Debug: test individual pipeline components
  app.get<{ Querystring: { test?: string } }>("/api/stream/debug", async (request, reply) => {
    const test = request.query.test ?? "info";

    if (test === "info") {
      const tmp = tmpdir();
      const testFile = `${tmp}/nvr-test`;
      await writeFile(testFile, "ok");
      await unlink(testFile);
      const hlsDirs = (await readdir(tmp)).filter(f => f.startsWith("nvr-hls-"));
      return { tmp, writable: true, hlsSessions: hlsDirs.length, hlsDirs };
    }

    if (test === "sftp") {
      let handle: SftpStream | undefined;

      try {
        const activeHandle = await getReadStream("ch0_2026-02-03_07-11-54_2026-02-03_07-13-41.dav");
        handle = activeHandle;
        let bytes = 0;
        await new Promise<void>((resolve, reject) => {
          activeHandle.stream.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 4096) {
              activeHandle.stream.destroy();
              resolve();
            }
          });
          activeHandle.stream.on("error", reject);
          setTimeout(() => {
            activeHandle.stream.destroy();
            resolve();
          }, 10000);
        });

        return { sftp: "ok", bytesRead: bytes };
      } catch (err) {
        if (err instanceof StorageNotConfiguredError) {
          return reply.status(503).send({ error: "Storage not configured" });
        }

        throw err;
      } finally {
        handle?.sftp.end().catch(() => {});
      }
    }

    if (test === "ffmpeg") {
      const testDir = join(tmpdir(), "nvr-hls-debug-test");
      await mkdir(testDir, { recursive: true });

      let handle: SftpStream | undefined;

      try {
        const activeHandle = await getReadStream("ch0_2026-02-03_07-11-54_2026-02-03_07-13-41.dav");
        handle = activeHandle;
        const ffmpeg = spawn("ffmpeg", [
          "-f", "hevc", "-i", "pipe:0",
          "-t", "8", "-c:v", "copy", "-an",
          "-g", "48", "-keyint_min", "48",
          "-f", "hls", "-hls_time", "4", "-hls_list_size", "0",
          "-hls_playlist_type", "event", "-hls_flags", "append_list",
          "-hls_segment_filename", join(testDir, "seg_%04d.ts"),
          join(testDir, "stream.m3u8"),
        ], { stdio: ["pipe", "pipe", "pipe"] });

        activeHandle.stream.pipe(ffmpeg.stdin!);
        let stderr = "";
        ffmpeg.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

        const code = await new Promise<number | null>((resolve) => {
          const timeout = setTimeout(() => { ffmpeg.kill("SIGKILL"); resolve(-1); }, 60000);
          ffmpeg.on("close", (c) => { clearTimeout(timeout); resolve(c); });
        });

        const files = (await fileExists(testDir)) ? await readdir(testDir) : [];
        const errLines = stderr.split("\n").filter(l => l.toLowerCase().includes("error")).slice(0, 3);
        const frameMatch = stderr.match(/frame=\s*(\d+)/);

        return {
          ffmpeg: code === 0 ? "ok" : `exit ${code}`,
          frames: frameMatch?.[1] ?? "0",
          outputFiles: files,
          errors: errLines.length ? errLines : undefined,
        };
      } catch (err) {
        if (err instanceof StorageNotConfiguredError) {
          return reply.status(503).send({ error: "Storage not configured" });
        }

        throw err;
      } finally {
        handle?.sftp.end().catch(() => {});
      }
    }

    return { error: "Unknown test. Use ?test=info|sftp|ffmpeg" };
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
