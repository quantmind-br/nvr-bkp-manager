import type { FastifyInstance } from "fastify";
import { getAuditLogs } from "../services/audit.js";
import { requireRole } from "../plugins/auth.js";

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/api/audit",
    { preHandler: [requireRole("admin")] },
    async (request) => {
      const limit = Math.min(
        parseInt(request.query.limit ?? "100", 10) || 100,
        500,
      );
      const offset = parseInt(request.query.offset ?? "0", 10) || 0;
      return getAuditLogs(limit, offset);
    },
  );
}
