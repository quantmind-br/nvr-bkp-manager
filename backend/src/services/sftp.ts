import SftpClient from "ssh2-sftp-client";
import type { Readable } from "stream";
import {
  getSftpSettingsOrThrow,
  type SftpSettings,
  StorageNotConfiguredError,
} from "./settings.js";

export { StorageNotConfiguredError } from "./settings.js";

export interface SftpStream {
  stream: Readable;
  sftp: SftpClient;
}

export interface FileEntry {
  name: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
  parsed?: {
    channel: string | null;
    startTime: string | null;
    endTime: string | null;
    duration: string | null;
  };
}

async function connectSftpWithSettings(settings: SftpSettings): Promise<SftpClient> {
  const sftp = new SftpClient();
  await sftp.connect({
    host: settings.host,
    port: settings.port,
    username: settings.user,
    password: settings.password,
  });
  return sftp;
}

async function connectSftp(): Promise<SftpClient> {
  const settings = getSftpSettingsOrThrow();
  return connectSftpWithSettings(settings);
}

export async function listFiles(remotePath = "/"): Promise<FileEntry[]> {
  const settings = getSftpSettingsOrThrow();
  const sftp = await connectSftp();
  try {
    const fullPath = normalizePath(settings.path, remotePath);
    const listing = await sftp.list(fullPath);

    return listing.map((item) => ({
      name: item.name,
      size: item.size,
      modifiedAt: new Date(item.modifyTime).toISOString(),
      isDirectory: item.type === "d",
    }));
  } finally {
    await sftp.end();
  }
}

export async function testConnection(candidate?: SftpSettings): Promise<boolean> {
  let sftp: SftpClient | null = null;
  try {
    const settings = candidate ?? getSftpSettingsOrThrow();
    sftp = candidate
      ? await connectSftpWithSettings(settings)
      : await connectSftp();
    await sftp.list(settings.path);
    return true;
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      throw err;
    }
    return false;
  } finally {
    if (sftp) {
      await sftp.end();
    }
  }
}

export async function getReadStream(remotePath: string): Promise<SftpStream> {
  const settings = getSftpSettingsOrThrow();
  const sftp = await connectSftp();

  const fullPath = normalizePath(settings.path, remotePath);
  const stream = sftp.createReadStream(fullPath);

  return { stream, sftp };
}

export async function deleteFile(fileName: string): Promise<void> {
  const settings = getSftpSettingsOrThrow();
  const sftp = await connectSftp();
  try {
    const fullPath = normalizePath(settings.path, fileName);
    await sftp.delete(fullPath);
  } finally {
    await sftp.end();
  }
}

export async function uploadFile(
  fileName: string,
  dataStream: Readable,
): Promise<void> {
  const settings = getSftpSettingsOrThrow();
  const sftp = await connectSftp();
  try {
    const fullPath = normalizePath(settings.path, fileName);
    await sftp.put(dataStream, fullPath);
  } finally {
    await sftp.end();
  }
}

export async function getFileSize(fileName: string): Promise<number> {
  const settings = getSftpSettingsOrThrow();
  const sftp = await connectSftp();
  try {
    const fullPath = normalizePath(settings.path, fileName);
    const stats = await sftp.stat(fullPath);
    return stats.size;
  } finally {
    await sftp.end();
  }
}

function normalizePath(basePath: string, relativePath: string): string {
  // Prevent directory traversal outside base path
  const cleaned = relativePath.replace(/\.\./g, "").replace(/\/+/g, "/");
  const combined = `${basePath}/${cleaned}`.replace(/\/+/g, "/");
  return combined;
}
