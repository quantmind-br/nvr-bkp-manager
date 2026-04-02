import type { FastifyInstance } from "fastify";
import {
  findUserByUsername,
  getActiveUserForToken,
  verifyPassword,
  toSafeUser,
} from "../services/users.js";
import { logAction } from "../services/audit.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { username: string; password: string } }>(
    "/api/auth/login",
    async (request, reply) => {
      const { username, password } = request.body ?? {};

      if (!username || !password) {
        return reply
          .status(400)
          .send({ error: "Username and password required" });
      }

      const ip = request.ip;
      const user = findUserByUsername(username);
      if (!user) {
        logAction(null, username, "login_failed", "/api/auth/login", "User not found", ip);
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        logAction(user.id, username, "login_failed", "/api/auth/login", "Wrong password", ip);
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      logAction(user.id, username, "login", "/api/auth/login", undefined, ip);

      const token = app.jwt.sign({
        sub: user.id,
        username: user.username,
        role: user.role,
      });

      return { token, user: toSafeUser(user) };
    },
  );

  app.get("/api/auth/me", async (request, reply) => {
    try {
      const decoded = await request.jwtVerify<{
        sub: number;
        username: string;
        role: "admin" | "viewer";
        scope?: string;
        file?: string;
        path?: string;
        iat?: number;
      }>();
      if (typeof decoded.iat !== "number") {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const activeUser = getActiveUserForToken(decoded.sub, decoded.iat);
      if (!activeUser) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      return {
        id: activeUser.id,
        username: activeUser.username,
        role: activeUser.role,
      };
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}
