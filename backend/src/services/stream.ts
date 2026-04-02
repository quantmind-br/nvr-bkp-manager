import { spawn, type ChildProcess } from "child_process";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { config } from "../config.js";

export interface HlsSession {
  sessionId: string;
  hlsDir: string;
  startSeconds: number;
  durationSeconds: number | null;
  cleanup: () => void;
  ready: Promise<void>;
}

function buildSftpUrl(fileName: string): string {
  const { user, password, host, port, path } = config.storage;
  const encodedPass = encodeURIComponent(password);
  return `sftp://${user}:${encodedPass}@${host}:${port}${path}/${fileName}`;
}

// Parse duration from .dav filename pattern: ch0_YYYY-MM-DD_HH-MM-SS_YYYY-MM-DD_HH-MM-SS.dav
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
): Promise<HlsSession> {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (ext !== ".dav" && ext !== ".mp4") {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  const sessionId = randomBytes(8).toString("hex");
  const hlsDir = join(tmpdir(), `nvr-hls-${sessionId}`);
  mkdirSync(hlsDir, { recursive: true });

  const playlistPath = join(hlsDir, "stream.m3u8");
  const durationSeconds = parseDurationFromFilename(fileName);

  let ffmpegProcess: ChildProcess | null = null;
  let cleaned = false;

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    if (ffmpegProcess && !ffmpegProcess.killed) {
      ffmpegProcess.kill("SIGKILL");
    }
    setTimeout(() => {
      try {
        if (existsSync(hlsDir)) rmSync(hlsDir, { recursive: true });
      } catch {
        // ignore
      }
    }, 30000);
  }

  const sftpUrl = buildSftpUrl(fileName);

  // Build FFmpeg args with native SFTP URL (enables seeking)
  const seekArgs = startSeconds > 0 ? ["-ss", String(startSeconds)] : [];
  const inputArgs =
    ext === ".dav"
      ? [...seekArgs, "-f", "hevc", "-i", sftpUrl]
      : [...seekArgs, "-i", sftpUrl];

  ffmpegProcess = spawn(
    "ffmpeg",
    [
      ...inputArgs,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-g",
      "48",
      "-keyint_min",
      "48",
      "-f",
      "hls",
      "-hls_time",
      "4",
      "-hls_list_size",
      "0",
      "-hls_playlist_type",
      "event",
      "-hls_flags",
      "append_list",
      "-hls_segment_filename",
      join(hlsDir, "seg_%04d.ts"),
      playlistPath,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  ffmpegProcess.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString();
    if (msg.includes("Error") || msg.includes("error")) {
      console.error("[FFmpeg error]", msg.trim());
    }
  });

  ffmpegProcess.on("close", () => {
    // FFmpeg finished
  });

  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("HLS stream timeout — no segments produced"));
      cleanup();
    }, 120000);

    const check = setInterval(() => {
      if (existsSync(playlistPath)) {
        clearInterval(check);
        clearTimeout(timeout);
        resolve();
      }
    }, 500);

    ffmpegProcess!.on("close", (code) => {
      clearInterval(check);
      clearTimeout(timeout);
      if (!existsSync(playlistPath)) {
        reject(
          new Error(
            `FFmpeg exited with code ${code} before producing segments`,
          ),
        );
      }
    });
  });

  return { sessionId, hlsDir, startSeconds, durationSeconds, cleanup, ready };
}

// Track active sessions
const activeSessions = new Map<string, HlsSession>();

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
