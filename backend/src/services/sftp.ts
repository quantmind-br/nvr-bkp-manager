import SftpClient from "ssh2-sftp-client";
import type { Readable } from "stream";
import { config } from "../config.js";

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

export async function listFiles(remotePath = "/"): Promise<FileEntry[]> {
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: config.storage.host,
      port: config.storage.port,
      username: config.storage.user,
      password: config.storage.password,
    });

    const fullPath = normalizePath(config.storage.path, remotePath);
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

export async function testConnection(): Promise<boolean> {
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: config.storage.host,
      port: config.storage.port,
      username: config.storage.user,
      password: config.storage.password,
    });
    await sftp.list(config.storage.path);
    return true;
  } catch {
    return false;
  } finally {
    await sftp.end();
  }
}

export async function getReadStream(remotePath: string): Promise<SftpStream> {
  const sftp = new SftpClient();
  await sftp.connect({
    host: config.storage.host,
    port: config.storage.port,
    username: config.storage.user,
    password: config.storage.password,
  });

  const fullPath = normalizePath(config.storage.path, remotePath);
  const stream = sftp.createReadStream(fullPath);

  return { stream, sftp };
}

export async function deleteFile(fileName: string): Promise<void> {
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: config.storage.host,
      port: config.storage.port,
      username: config.storage.user,
      password: config.storage.password,
    });
    const fullPath = normalizePath(config.storage.path, fileName);
    await sftp.delete(fullPath);
  } finally {
    await sftp.end();
  }
}

export async function uploadFile(
  fileName: string,
  dataStream: Readable,
): Promise<void> {
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: config.storage.host,
      port: config.storage.port,
      username: config.storage.user,
      password: config.storage.password,
    });
    const fullPath = normalizePath(config.storage.path, fileName);
    await sftp.put(dataStream, fullPath);
  } finally {
    await sftp.end();
  }
}

export async function getFileSize(fileName: string): Promise<number> {
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: config.storage.host,
      port: config.storage.port,
      username: config.storage.user,
      password: config.storage.password,
    });
    const fullPath = normalizePath(config.storage.path, fileName);
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
