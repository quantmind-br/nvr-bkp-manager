import type { FastifyInstance } from "fastify";
import type { FileEntry } from "../services/sftp.js";
import {
  deleteFile,
  getFileSize,
  getReadStream,
  listFiles,
  uploadFile,
} from "../services/sftp.js";
import { requireRole } from "../plugins/auth.js";
import { logAction } from "../services/audit.js";
import {
  formatDuration,
  parseNvrFilename,
} from "../services/filenameParser.js";
import archiver from "archiver";

interface FileListQuery {
  path?: string;
  channel?: string;
  startDate?: string;
  endDate?: string;
  minSize?: string;
  maxSize?: string;
}

interface FileFilters {
  channels?: string[];
  startDateTimestamp?: number;
  endDateExclusiveTimestamp?: number;
  minSize?: number;
  maxSize?: number;
}

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function validateFileName(name: string | undefined): string | null {
  if (!name) return null;
  if (name.includes("/") || name.includes("\\") || name.includes(".."))
    return null;
  return name;
}

function buildParsedMetadata(name: string): NonNullable<FileEntry["parsed"]> {
  const parsed = parseNvrFilename(name);

  return {
    channel: parsed.channel,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    duration:
      parsed.duration === null ? null : formatDuration(parsed.duration),
  };
}

function parseDateFilter(
  value: string | undefined,
  boundary: "start" | "end",
): number | undefined | null {
  if (!value) {
    return undefined;
  }

  const match = ISO_DATE_REGEX.exec(value);
  const yearText = match?.[1];
  const monthText = match?.[2];
  const dayText = match?.[3];

  if (!yearText || !monthText || !dayText) {
    return null;
  }

  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if ([year, month, day].some((segment) => Number.isNaN(segment))) {
    return null;
  }

  const startOfDay = Date.UTC(year, month - 1, day);
  const parsedDate = new Date(startOfDay);

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  if (boundary === "start") {
    return startOfDay;
  }

  return Date.UTC(year, month - 1, day + 1);
}

function toTimestamp(isoDateTime: string): number | null {
  const timestamp = Date.parse(`${isoDateTime}Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function shouldIncludeFile(file: FileEntry, filters: FileFilters): boolean {
  if (file.isDirectory) {
    return true;
  }

  const parsed = file.parsed ?? buildParsedMetadata(file.name);

  // Channel filter (multi-channel: match ANY)
  if (filters.channels && filters.channels.length > 0) {
    const parsedChannel = parsed.channel?.toLowerCase();

    if (!parsedChannel || !filters.channels.some((ch) => parsedChannel.includes(ch))) {
      return false;
    }
  }

  // Size filter
  if (filters.minSize !== undefined && file.size < filters.minSize) {
    return false;
  }
  if (filters.maxSize !== undefined && file.size > filters.maxSize) {
    return false;
  }

  // Date filter
  const hasDateFilters =
    filters.startDateTimestamp !== undefined ||
    filters.endDateExclusiveTimestamp !== undefined;

  if (!hasDateFilters) {
    return true;
  }

  if (!parsed.startTime) {
    return (filters.channels === undefined || filters.channels.length === 0);
  }

  const fileStartTimestamp = toTimestamp(parsed.startTime);

  if (fileStartTimestamp === null) {
    return (filters.channels === undefined || filters.channels.length === 0);
  }

  if (
    filters.startDateTimestamp !== undefined &&
    fileStartTimestamp < filters.startDateTimestamp
  ) {
    return false;
  }

  if (
    filters.endDateExclusiveTimestamp !== undefined &&
    fileStartTimestamp >= filters.endDateExclusiveTimestamp
  ) {
    return false;
  }

  return true;
}

export async function fileRoutes(app: FastifyInstance) {
  // List files
  app.get<{ Querystring: FileListQuery }>(
    "/api/files",
    async (request, reply) => {
      const remotePath = request.query.path ?? "/";
      const channelRaw = request.query.channel?.trim().toLowerCase();
      const channels = channelRaw
        ? channelRaw.split(",").map((c) => c.trim()).filter(Boolean)
        : undefined;

      const minSizeRaw = request.query.minSize;
      const maxSizeRaw = request.query.maxSize;
      const minSize = minSizeRaw ? Number.parseInt(minSizeRaw, 10) : undefined;
      const maxSize = maxSizeRaw ? Number.parseInt(maxSizeRaw, 10) : undefined;

      if (minSize !== undefined && (Number.isNaN(minSize) || minSize < 0)) {
        return reply
          .status(400)
          .send({ error: "Invalid 'minSize' parameter" });
      }
      if (maxSize !== undefined && (Number.isNaN(maxSize) || maxSize < 0)) {
        return reply
          .status(400)
          .send({ error: "Invalid 'maxSize' parameter" });
      }

      const startDateTimestamp = parseDateFilter(request.query.startDate, "start");

      if (startDateTimestamp === null) {
        return reply
          .status(400)
          .send({ error: "Missing or invalid 'startDate' parameter" });
      }

      const endDateExclusiveTimestamp = parseDateFilter(request.query.endDate, "end");

      if (endDateExclusiveTimestamp === null) {
        return reply
          .status(400)
          .send({ error: "Missing or invalid 'endDate' parameter" });
      }

      try {
        const files = (await listFiles(remotePath)).map((file) => ({
          ...file,
          parsed: buildParsedMetadata(file.name),
        }));

        if (remotePath !== "/" && remotePath !== "") {
          files.unshift({
            name: "..",
            size: 0,
            modifiedAt: "",
            isDirectory: true,
            parsed: buildParsedMetadata(".."),
          });
        }

        return files.filter((file) =>
          shouldIncludeFile(file, {
            channels,
            startDateTimestamp,
            endDateExclusiveTimestamp,
            minSize,
            maxSize,
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply
          .status(502)
          .send({ error: "Storage connection failed", details: message });
      }
    },
  );

  app.get<{ Querystring: { file?: string } }>(
    "/api/download-token",
    async (request, reply) => {
      const fileName = validateFileName(request.query.file);
      if (!fileName) {
        return reply
          .status(400)
          .send({ error: "Missing or invalid 'file' parameter" });
      }

      const downloadToken = app.jwt.sign(
        {
          sub: request.user.sub,
          username: request.user.username,
          role: request.user.role,
          scope: "download",
          file: fileName,
        },
        { expiresIn: "30s" },
      );

      const downloadUrl = `/api/download?file=${encodeURIComponent(fileName)}&downloadToken=${downloadToken}`;
      return { downloadUrl, expiresInSeconds: 30 };
    },
  );

  // Download file
  app.get<{ Querystring: { file?: string } }>(
    "/api/download",
    async (request, reply) => {
      const fileName = validateFileName(request.query.file);
      if (!fileName) {
        return reply
          .status(400)
          .send({ error: "Missing or invalid 'file' parameter" });
      }

      let size: number;
      try {
        size = await getFileSize(fileName);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply
          .status(502)
          .send({ error: "File not found", details: message });
      }

      let sftpHandle;
      try {
        sftpHandle = await getReadStream(fileName);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply
          .status(502)
          .send({ error: "Download failed", details: message });
      }

      const { stream, sftp } = sftpHandle;

      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": size,
      });

      stream.pipe(raw);

      function cleanup() {
        sftp.end().catch(() => {});
      }

      stream.on("end", () => {
        cleanup();
        if (!raw.writableEnded) raw.end();
      });

      stream.on("error", (err) => {
        console.error("[Download error]", err.message);
        cleanup();
        if (!raw.writableEnded) raw.end();
      });

      request.raw.on("close", () => {
        cleanup();
        stream.destroy();
      });

      return reply.hijack();
    },
  );

  // Delete file (admin only)
  app.delete<{ Querystring: { file?: string } }>(
    "/api/files",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const fileName = validateFileName(request.query.file);
      if (!fileName) {
        return reply
          .status(400)
          .send({ error: "Missing or invalid 'file' parameter" });
      }

      try {
        await deleteFile(fileName);
        logAction(request.user.sub, request.user.username, "delete", fileName, undefined, request.ip);
        return { success: true, deleted: fileName };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply
          .status(502)
          .send({ error: "Delete failed", details: message });
      }
    },
  );

  // Upload file(s) (admin only)
  app.post(
    "/api/upload",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
    const parts = request.parts();
    const uploaded: string[] = [];

    try {
      for await (const part of parts) {
        if (part.type === "file" && part.filename) {
          const safeName = validateFileName(part.filename);
          if (!safeName) {
            return reply
              .status(400)
              .send({ error: `Invalid filename: ${part.filename}` });
          }
          await uploadFile(safeName, part.file);
          uploaded.push(safeName);
        }
      }

      if (uploaded.length === 0) {
        return reply.status(400).send({ error: "No files provided" });
      }

      logAction(request.user.sub, request.user.username, "upload", uploaded.join(", "), undefined, request.ip);
      return { success: true, uploaded };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply
        .status(502)
        .send({ error: "Upload failed", details: message });
    }
  },
  );

  // Bulk delete (admin only)
  app.post<{ Body: { files: string[] } }>(
    "/api/bulk-delete",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const fileList = request.body?.files;
      if (!Array.isArray(fileList) || fileList.length === 0) {
        return reply
          .status(400)
          .send({ error: "Missing or empty 'files' array" });
      }

      const results: { file: string; success: boolean; error?: string }[] = [];

      for (const raw of fileList) {
        const safe = validateFileName(raw);
        if (!safe) {
          results.push({ file: raw, success: false, error: "Invalid filename" });
          continue;
        }
        try {
          await deleteFile(safe);
          logAction(request.user.sub, request.user.username, "delete", safe, undefined, request.ip);
          results.push({ file: safe, success: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          results.push({ file: safe, success: false, error: message });
        }
      }

      return { results };
    },
  );

  // Bulk download as zip
  app.post<{ Body: { files: string[] } }>(
    "/api/bulk-download",
    async (request, reply) => {
      const fileList = request.body?.files;
      if (!Array.isArray(fileList) || fileList.length === 0) {
        return reply
          .status(400)
          .send({ error: "Missing or empty 'files' array" });
      }

      if (fileList.length > 50) {
        return reply
          .status(400)
          .send({ error: "Maximum 50 files per bulk download" });
      }

      for (const raw of fileList) {
        if (!validateFileName(raw)) {
          return reply
            .status(400)
            .send({ error: `Invalid filename: ${raw}` });
        }
      }

      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="nvr-recordings.zip"',
        "Transfer-Encoding": "chunked",
      });

      const archive = archiver("zip", { zlib: { level: 1 } });
      const sftpClients: Array<{ end: () => Promise<unknown> }> = [];

      archive.on("error", (err) => {
        console.error("[Bulk download] Archive error:", err.message);
        for (const sftp of sftpClients) sftp.end().catch(() => {});
        if (!raw.writableEnded) raw.end();
      });

      archive.pipe(raw);

      try {
        for (const fileName of fileList) {
          const handle = await getReadStream(fileName);
          sftpClients.push(handle.sftp);
          archive.append(handle.stream, { name: fileName });

          handle.stream.on("error", () => {
            handle.sftp.end().catch(() => {});
          });
          handle.stream.on("end", () => {
            handle.sftp.end().catch(() => {});
          });
        }

        await archive.finalize();
      } catch (err) {
        console.error("[Bulk download] Error:", err instanceof Error ? err.message : err);
        for (const sftp of sftpClients) sftp.end().catch(() => {});
        if (!raw.writableEnded) raw.end();
      }

      request.raw.on("close", () => {
        archive.abort();
        for (const sftp of sftpClients) sftp.end().catch(() => {});
      });

      return reply.hijack();
    },
  );
}
