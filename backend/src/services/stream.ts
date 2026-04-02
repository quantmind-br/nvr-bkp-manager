import { spawn, type ChildProcess } from "child_process";
import type { Readable } from "stream";
import { getReadStream, type SftpStream } from "./sftp.js";

export interface VideoStream {
  stream: Readable;
  contentType: string;
  cleanup: () => void;
}

export async function createVideoStream(
  fileName: string,
): Promise<VideoStream> {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

  if (ext === ".dav") {
    return createDavStream(fileName);
  } else if (ext === ".mp4") {
    return createMp4Stream(fileName);
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
}

async function createDavStream(fileName: string): Promise<VideoStream> {
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
  }

  sftpHandle = await getReadStream(fileName);

  ffmpegProcess = spawn(
    "ffmpeg",
    [
      "-f",
      "hevc",
      "-i",
      "pipe:0",
      "-c:v",
      "copy",
      "-f",
      "mp4",
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
      "pipe:1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  // Log FFmpeg errors but don't crash
  ffmpegProcess.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString();
    if (msg.includes("Error") || msg.includes("error")) {
      console.error("[FFmpeg error]", msg.trim());
    }
  });

  // Pipe SFTP stream into FFmpeg stdin
  sftpHandle.stream.pipe(ffmpegProcess.stdin!);

  // Handle SFTP stream errors
  sftpHandle.stream.on("error", (err) => {
    console.error("[SFTP stream error]", err.message);
    cleanup();
  });

  // Handle FFmpeg process exit
  ffmpegProcess.on("close", () => {
    cleanup();
  });

  // Handle FFmpeg stdin errors (broken pipe if FFmpeg exits early)
  ffmpegProcess.stdin?.on("error", () => {
    cleanup();
  });

  return {
    stream: ffmpegProcess.stdout!,
    contentType: "video/mp4",
    cleanup,
  };
}

async function createMp4Stream(fileName: string): Promise<VideoStream> {
  const sftpHandle = await getReadStream(fileName);
  let cleaned = false;

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    sftpHandle.sftp.end().catch(() => {});
  }

  sftpHandle.stream.on("error", (err) => {
    console.error("[SFTP stream error]", err.message);
    cleanup();
  });

  sftpHandle.stream.on("end", () => {
    cleanup();
  });

  return {
    stream: sftpHandle.stream,
    contentType: "video/mp4",
    cleanup,
  };
}
