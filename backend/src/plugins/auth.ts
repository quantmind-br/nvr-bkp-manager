import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { config } from "../config.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: number; username: string; role: "admin" | "viewer" };
    user: { sub: number; username: string; role: "admin" | "viewer" };
  }
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: config.jwt.secret,
    sign: { expiresIn: config.jwt.expiresIn },
  });

  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const url = request.url.split("?")[0]!;

      // Public routes
      if (url === "/api/health" || url.startsWith("/api/auth/")) {
        return;
      }

      // Only protect /api/* routes
      if (!url.startsWith("/api/")) {
        return;
      }

      // Accept token as query param for stream/download/HLS (HTML5 video/a can't set headers)
      const query = request.query as Record<string, string | undefined>;
      if (
        (url.startsWith("/api/stream") || url === "/api/download") &&
        query["token"]
      ) {
        try {
          const decoded = app.jwt.verify<{
            sub: number;
            username: string;
            role: "admin" | "viewer";
          }>(query["token"]);
          request.user = decoded;
          return;
        } catch {
          return reply.status(401).send({ error: "Unauthorized" });
        }
      }

      // Standard JWT verification via Authorization header
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    },
  );
}

export default fp(authPlugin, { name: "auth" });

export function requireRole(...roles: Array<"admin" | "viewer">) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.user.role)) {
      return reply
        .status(403)
        .send({ error: "Forbidden: insufficient permissions" });
    }
  };
}
