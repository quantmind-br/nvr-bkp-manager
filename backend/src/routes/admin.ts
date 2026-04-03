import type { FastifyInstance } from "fastify";
import { requireRole } from "../plugins/auth.js";
import { logAction } from "../services/audit.js";
import {
  buildCandidateSettings,
  getPublicSettings,
  saveSettings,
} from "../services/settings.js";
import { testConnection } from "../services/sftp.js";
import {
  createUser,
  deleteUserByAdmin,
  listUsers,
  updateUserByAdmin,
  UserConflictError,
  UserNotFoundError,
  UserProtectionError,
} from "../services/users.js";
import { validatePath } from "./files.js";

function parsePort(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    return null;
  }

  return value;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/admin/settings",
    { preHandler: [requireRole("admin")] },
    async () => getPublicSettings(),
  );

  app.put<{
    Body: {
      host?: string;
      port?: number;
      user?: string;
      path?: string;
      password?: string;
    };
  }>(
    "/api/admin/settings",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const { host, port, user, path, password } = request.body ?? {};

      const trimmedHost = host?.trim();
      if (!trimmedHost) {
        return reply.status(400).send({ error: "Host is required" });
      }

      const validatedPort = parsePort(port);
      if (validatedPort === null) {
        return reply.status(400).send({ error: "Port must be an integer between 1 and 65535" });
      }

      const trimmedUser = user?.trim();
      if (!trimmedUser) {
        return reply.status(400).send({ error: "User is required" });
      }

      const trimmedPath = path?.trim();
      if (!trimmedPath) {
        return reply.status(400).send({ error: "Path is required" });
      }

      const validatedPath = validatePath(trimmedPath);
      if (!validatedPath) {
        return reply.status(400).send({ error: "Path must be absolute and cannot contain traversal segments" });
      }

      const candidate = buildCandidateSettings({
        host: trimmedHost,
        port: validatedPort,
        user: trimmedUser,
        path: validatedPath,
        password,
      });
      if (!candidate) {
        return reply.status(400).send({ error: "Password is required until one is configured" });
      }

      const canConnect = await testConnection(candidate);

      if (!canConnect) {
        return reply.status(400).send({ error: "Unable to connect with the provided settings" });
      }

      saveSettings({
        host: trimmedHost,
        port: validatedPort,
        user: trimmedUser,
        path: validatedPath,
        password,
      });

      logAction(
        request.user.sub,
        request.user.username,
        "settings_update",
        "/api/admin/settings",
        `host=${trimmedHost} port=${validatedPort} user=${trimmedUser} path=${validatedPath}`,
        request.ip,
      );

      return getPublicSettings();
    },
  );

  app.get(
    "/api/admin/users",
    { preHandler: [requireRole("admin")] },
    async () => listUsers(),
  );

  app.post<{
    Body: { username?: string; password?: string; role?: string };
  }>(
    "/api/admin/users",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const { username, password, role } = request.body ?? {};

      if (!username?.trim()) {
        return reply.status(400).send({ error: "Username is required" });
      }
      if (!password) {
        return reply.status(400).send({ error: "Password is required" });
      }
      if (role !== "admin" && role !== "viewer") {
        return reply.status(400).send({ error: "Role must be 'admin' or 'viewer'" });
      }

      try {
        const user = await createUser(username.trim(), password, role);
        logAction(
          request.user.sub,
          request.user.username,
          "user_create",
          `/api/admin/users/${user.id}`,
          `username=${user.username} role=${user.role}`,
          request.ip,
        );
        return reply.status(201).send(user);
      } catch (err) {
        if (err instanceof UserConflictError) {
          return reply.status(409).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.put<{
    Params: { id: string };
    Body: { username?: string; password?: string; role?: string };
  }>(
    "/api/admin/users/:id",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const targetId = parseInt(request.params.id, 10);
      if (Number.isNaN(targetId)) {
        return reply.status(400).send({ error: "Invalid user ID" });
      }

      const { username, password, role } = request.body ?? {};
      const trimmedUsername = username?.trim();

      if (username !== undefined && !trimmedUsername) {
        return reply.status(400).send({ error: "Username is required" });
      }

      if (!trimmedUsername && !password && !role) {
        return reply.status(400).send({ error: "At least one field (username, password, role) is required" });
      }

      if (role !== undefined && role !== "admin" && role !== "viewer") {
        return reply.status(400).send({ error: "Role must be 'admin' or 'viewer'" });
      }

      try {
        const user = await updateUserByAdmin(targetId, request.user.sub, {
          username: trimmedUsername,
          role: role as "admin" | "viewer" | undefined,
          password,
        });

        const forceRelogin = request.user.sub === targetId;
        logAction(
          request.user.sub,
          request.user.username,
          "user_update",
          `/api/admin/users/${targetId}`,
          `username=${user.username} role=${user.role}`,
          request.ip,
        );

        return { user, forceRelogin };
      } catch (err) {
        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        if (err instanceof UserConflictError) {
          return reply.status(409).send({ error: err.message });
        }
        if (err instanceof UserProtectionError) {
          return reply.status(409).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.delete<{
    Params: { id: string };
  }>(
    "/api/admin/users/:id",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const targetId = parseInt(request.params.id, 10);
      if (Number.isNaN(targetId)) {
        return reply.status(400).send({ error: "Invalid user ID" });
      }

      try {
        deleteUserByAdmin(targetId, request.user.sub);
        logAction(
          request.user.sub,
          request.user.username,
          "user_delete",
          `/api/admin/users/${targetId}`,
          undefined,
          request.ip,
        );
        return { success: true, deletedId: targetId };
      } catch (err) {
        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        if (err instanceof UserProtectionError) {
          return reply.status(409).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
