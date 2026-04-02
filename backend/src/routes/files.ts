import type { FastifyInstance } from "fastify";
import {
  listFiles,
  getReadStream,
  getFileSize,
  deleteFile,
  uploadFile,
} from "../services/sftp.js";
import { requireRole } from "../plugins/auth.js";
import { logAction } from "../services/audit.js";

function validateFileName(name: string | undefined): string | null {
  if (!name) return null;
  if (name.includes("/") || name.includes("\\") || name.includes(".."))
    return null;
  return name;
}

export async function fileRoutes(app: FastifyInstance) {
  // List files
  app.get<{ Querystring: { path?: string } }>(
    "/api/files",
    async (request, reply) => {
      const remotePath = request.query.path ?? "/";

      try {
        const files = await listFiles(remotePath);

        if (remotePath !== "/" && remotePath !== "") {
          files.unshift({
            name: "..",
            size: 0,
            modifiedAt: "",
            isDirectory: true,
          });
        }

        return files;
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
