import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { config } from "../config.js";
import { getActiveUserForToken } from "../services/users.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: number;
      username: string;
      role: "admin" | "viewer";
      scope?: string;
      file?: string;
      path?: string;
      iat?: number;
    };
    user: {
      sub: number;
      username: string;
      role: "admin" | "viewer";
      scope?: string;
      file?: string;
      path?: string;
      iat?: number;
    };
  }
}

type AuthenticatedUser = {
  sub: number;
  username: string;
  role: "admin" | "viewer";
  scope?: string;
  file?: string;
  path?: string;
  iat?: number;
};

function hydrateActiveUser(decoded: AuthenticatedUser): AuthenticatedUser | null {
  if (typeof decoded.iat !== "number") {
    return null;
  }

  const activeUser = getActiveUserForToken(decoded.sub, decoded.iat);
  if (!activeUser) {
    return null;
  }

  return {
    ...decoded,
    sub: activeUser.id,
    username: activeUser.username,
    role: activeUser.role,
  };
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
            const decoded = app.jwt.verify<AuthenticatedUser>(query["token"]);
            request.user = decoded;

            const hydratedUser = hydrateActiveUser(request.user);
            if (!hydratedUser) {
              return reply.status(401).send({ error: "Unauthorized" });
            }

            request.user = hydratedUser;
            return;
        } catch {
          return reply.status(401).send({ error: "Unauthorized" });
        }
      }

      if (
        url === "/api/download" &&
        query["downloadToken"]
      ) {
        try {
          const decoded = app.jwt.verify<AuthenticatedUser>(query["downloadToken"]);
          if (decoded.scope !== "download") {
            return reply.status(403).send({ error: "Invalid download token scope" });
          }
          if (decoded.file !== query["file"]) {
            return reply.status(403).send({ error: "File mismatch" });
          }
          if (decoded.path !== query["path"]) {
            return reply.status(403).send({ error: "Path mismatch" });
          }
          request.user = decoded;

          const hydratedUser = hydrateActiveUser(request.user);
          if (!hydratedUser) {
            return reply.status(401).send({ error: "Unauthorized" });
          }

          request.user = hydratedUser;
          return;
        } catch {
          return reply.status(401).send({ error: "Invalid download token" });
        }
      }

      // Standard JWT verification via Authorization header
      try {
        const decoded = await request.jwtVerify<AuthenticatedUser>();
        request.user = decoded;

        const hydratedUser = hydrateActiveUser(request.user);
        if (!hydratedUser) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        request.user = hydratedUser;
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
