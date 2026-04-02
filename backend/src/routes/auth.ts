import type { FastifyInstance } from "fastify";
import {
  findUserByUsername,
  verifyPassword,
  toSafeUser,
} from "../services/users.js";

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

      const user = findUserByUsername(username);
      if (!user) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

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
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    return {
      id: request.user.sub,
      username: request.user.username,
      role: request.user.role,
    };
  });
}
