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

interface FileListQuery {
  path?: string;
  channel?: string;
  startDate?: string;
  endDate?: string;
}

interface FileFilters {
  channel?: string;
  startDateTimestamp?: number;
  endDateExclusiveTimestamp?: number;
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

  if (filters.channel) {
    const parsedChannel = parsed.channel?.toLowerCase();

    if (!parsedChannel || !parsedChannel.includes(filters.channel)) {
      return false;
    }
  }

  const hasDateFilters =
    filters.startDateTimestamp !== undefined ||
    filters.endDateExclusiveTimestamp !== undefined;

  if (!hasDateFilters) {
    return true;
  }

  if (!parsed.startTime) {
    return filters.channel === undefined;
  }

  const fileStartTimestamp = toTimestamp(parsed.startTime);

  if (fileStartTimestamp === null) {
    return filters.channel === undefined;
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
      const channelFilter = request.query.channel?.trim().toLowerCase() || undefined;
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
            channel: channelFilter,
            startDateTimestamp,
            endDateExclusiveTimestamp,
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
}
