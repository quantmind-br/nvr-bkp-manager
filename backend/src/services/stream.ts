import { spawn, type ChildProcess } from "child_process";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { getReadStream, type SftpStream } from "./sftp.js";

export interface HlsSession {
  sessionId: string;
  hlsDir: string;
  cleanup: () => void;
  ready: Promise<void>;
}

export async function createHlsSession(fileName: string): Promise<HlsSession> {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (ext !== ".dav" && ext !== ".mp4") {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  const sessionId = randomBytes(8).toString("hex");
  const hlsDir = join(tmpdir(), `nvr-hls-${sessionId}`);
  mkdirSync(hlsDir, { recursive: true });

  const playlistPath = join(hlsDir, "stream.m3u8");

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
    // Clean up HLS temp files after a delay (allow last segment reads)
    setTimeout(() => {
      try {
        if (existsSync(hlsDir)) rmSync(hlsDir, { recursive: true });
      } catch {
        // ignore cleanup errors
      }
    }, 30000);
  }

  sftpHandle = await getReadStream(fileName);

  const inputArgs =
    ext === ".dav" ? ["-f", "hevc", "-i", "pipe:0"] : ["-i", "pipe:0"];

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
      "-hls_flags",
      "append_list",
      "-hls_segment_filename",
      join(hlsDir, "seg_%03d.ts"),
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

  sftpHandle.stream.pipe(ffmpegProcess.stdin!);

  sftpHandle.stream.on("error", (err) => {
    console.error("[SFTP stream error]", err.message);
    cleanup();
  });

  ffmpegProcess.on("close", () => {
    // FFmpeg finished — segments are all written
  });

  ffmpegProcess.stdin?.on("error", () => {
    // broken pipe — FFmpeg exited
  });

  // Wait for the first segment to be written before declaring ready
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("HLS stream timeout — no segments produced"));
      cleanup();
    }, 60000);

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
        reject(new Error(`FFmpeg exited with code ${code} before producing segments`));
      }
    });
  });

  return { sessionId, hlsDir, cleanup, ready };
}

// Track active sessions for cleanup
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
