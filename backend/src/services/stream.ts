import { spawn, type ChildProcess } from "child_process";
import { watch, constants, createWriteStream } from "fs";
import { access, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { getReadStream, type SftpStream } from "./sftp.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export interface HlsSession {
  sessionId: string;
  hlsDir: string;
  startSeconds: number;
  durationSeconds: number | null;
  createdAt: number;
  cleanup: () => void;
  ready: Promise<void>;
}

export const SESSION_TTL_MS = 30 * 60 * 1000;

// Always use pipe-based SFTP streaming (FFmpeg's native SFTP has auth issues with special chars in passwords)

// Parse duration from .dav filename: ch0_YYYY-MM-DD_HH-MM-SS_YYYY-MM-DD_HH-MM-SS.dav
function parseDurationFromFilename(fileName: string): number | null {
  const match = fileName.match(
    /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/,
  );
  if (!match) return null;
  const start = new Date(
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`,
  );
  const end = new Date(
    `${match[7]}-${match[8]}-${match[9]}T${match[10]}:${match[11]}:${match[12]}`,
  );
  const seconds = (end.getTime() - start.getTime()) / 1000;
  return seconds > 0 ? seconds : null;
}

export async function createHlsSession(
  fileName: string,
  startSeconds = 0,
  sessionId?: string,
): Promise<HlsSession> {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (ext !== ".dav" && ext !== ".mp4") {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  if (!sessionId) sessionId = randomBytes(8).toString("hex");
  const hlsDir = join(tmpdir(), `nvr-hls-${sessionId}`);
  await mkdir(hlsDir, { recursive: true });

  const playlistPath = join(hlsDir, "stream.m3u8");
  const durationSeconds = parseDurationFromFilename(fileName);

  let sftpHandle: SftpStream | null = null;
  let ffmpegProcess: ChildProcess | null = null;
  let cleaned = false;

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    if (ffmpegProcess && !ffmpegProcess.killed) {
      ffmpegProcess.kill("SIGKILL");
    }
    sftpHandle?.sftp.end().catch(() => {});
    setTimeout(async () => {
      try {
        if (await fileExists(hlsDir)) await rm(hlsDir, { recursive: true });
      } catch { /* ignore */ }
    }, 30000);
  }

  // Use pipe-based SFTP streaming with -ss for seeking
  const seekArgs = startSeconds > 0 ? ["-ss", String(startSeconds)] : [];
  const hlsMuxerArgs = [
    "-f", "hls",
    "-hls_time", "4",
    "-hls_list_size", "0",
    "-hls_playlist_type", "event",
    "-hls_flags", "append_list",
    "-hls_segment_filename", join(hlsDir, "seg_%04d.ts"),
    playlistPath,
  ];

  sftpHandle = await getReadStream(fileName);

  function spawnFfmpeg(args: string[]): ChildProcess {
    const proc = spawn(
      "ffmpeg",
      [...args, ...hlsMuxerArgs],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    proc.stderr?.on("data", (chunk: Buffer) => {
      const msg = chunk.toString();
      if (msg.includes("Error") || msg.includes("error")) {
        console.error("[FFmpeg error]", msg.trim());
      }
    });
    proc.stdin?.on("error", () => { /* broken pipe */ });
    proc.on("close", () => { /* finished */ });
    return proc;
  }

  function waitForPlaylist(proc: ChildProcess): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let watcher: ReturnType<typeof watch> | undefined;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        watcher?.close();
        reject(new Error("HLS stream timeout — no segments produced"));
        cleanup();
      }, 120000);

      fileExists(playlistPath).then((exists) => {
        if (settled) return;
        if (exists) {
          settled = true;
          clearTimeout(timeout);
          resolve();
          return;
        }

        watcher = watch(hlsDir, (_, filename) => {
          if (settled) return;
          if (filename === "stream.m3u8") {
            settled = true;
            clearTimeout(timeout);
            watcher?.close();
            resolve();
          }
        });
      });

      proc.on("close", (code) => {
        fileExists(playlistPath).then((exists) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          watcher?.close();
          if (exists) {
            resolve();
          } else {
            reject(new Error(`FFmpeg exited with code ${code} before producing segments`));
          }
        });
      });
    });
  }

  let ready: Promise<void>;

  if (ext === ".dav") {
    // Raw HEVC: pipe directly from SFTP to FFmpeg (no container, no seeking needed)
    ffmpegProcess = spawnFfmpeg([...seekArgs, "-f", "hevc", "-i", "pipe:0", "-c:v", "copy", "-an"]);
    sftpHandle.stream.pipe(ffmpegProcess.stdin!);
    sftpHandle.stream.on("error", (err) => {
      console.error("[SFTP stream error]", err.message);
      cleanup();
    });
    ready = waitForPlaylist(ffmpegProcess);
  } else {
    // MP4: buffer to temp file first — MP4 container requires seekable input
    // (moov atom may be at end of file, which FFmpeg can't read from a pipe)
    const tempMp4Path = join(hlsDir, "input.mp4");
    ready = new Promise<void>((resolve, reject) => {
      let downloadDone = false;
      const ws = createWriteStream(tempMp4Path);
      sftpHandle!.stream.pipe(ws);

      sftpHandle!.stream.on("error", (err) => {
        if (downloadDone) return;
        downloadDone = true;
        console.error("[SFTP stream error]", err.message);
        ws.destroy();
        cleanup();
        reject(new Error(`SFTP download failed: ${err.message}`));
      });

      ws.on("error", (err) => {
        if (downloadDone) return;
        downloadDone = true;
        console.error("[MP4 temp write error]", err.message);
        cleanup();
        reject(new Error(`Failed to write temp MP4: ${err.message}`));
      });

      ws.on("finish", () => {
        if (downloadDone) return;
        downloadDone = true;
        sftpHandle?.sftp.end().catch(() => {});
        sftpHandle = null;
        if (cleaned) {
          reject(new Error("Session cleaned up during download"));
          return;
        }

        ffmpegProcess = spawnFfmpeg([...seekArgs, "-i", tempMp4Path, "-c:v", "libx264",  "-preset", "ultrafast", "-crf", "23", "-an"]);
        waitForPlaylist(ffmpegProcess).then(resolve, reject);
      });
    });
  }

  return { sessionId, hlsDir, startSeconds, durationSeconds, createdAt: Date.now(), cleanup, ready };
}

export const activeSessions = new Map<string, HlsSession>();

export function registerSession(session: HlsSession): void {
  activeSessions.set(session.sessionId, session);
}

export function getSession(sessionId: string): HlsSession | undefined {
  return activeSessions.get(sessionId);
}

export function removeSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.cleanup();
    activeSessions.delete(sessionId);
  }
}

export function purgeExpiredSessions(now = Date.now()): void {
  for (const [id, session] of activeSessions) {
    if (session.createdAt === 0) continue;
    if (now - session.createdAt > SESSION_TTL_MS) {
      removeSession(id);
    }
  }
}

const sessionCleanupInterval = setInterval(() => {
  purgeExpiredSessions();
}, 60_000);

sessionCleanupInterval.unref?.();
