import bcrypt from "bcryptjs";
import db from "../db.js";

export class UserNotFoundError extends Error {
  constructor(id: number) {
    super(`User not found: ${id}`);
    this.name = "UserNotFoundError";
  }
}

export class UserConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserConflictError";
  }
}

export class UserProtectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserProtectionError";
  }
}

export interface User {
  id: number;
  username: string;
  password: string;
  role: "admin" | "viewer";
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<User, "password">;

const SALT_ROUNDS = 10;
export const CACHE_TTL_MS = 30_000;
export const userCache = new Map<number, { user: SafeUser; cachedAt: number }>();

export function initUsersTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin', 'viewer')),
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function findUserByUsername(username: string): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as User | undefined;
}

export function findUserById(id: number): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | User
    | undefined;
}

export function getUserCount(): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM users")
    .get() as { count: number };
  return row.count;
}

export async function createUser(
  username: string,
  plainPassword: string,
  role: "admin" | "viewer",
): Promise<SafeUser> {
  const hashed = await hashPassword(plainPassword);

  try {
    const result = db
      .prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)")
      .run(username, hashed, role);

    const user = findUserById(Number(result.lastInsertRowid))!;
    return toSafeUser(user);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      throw new UserConflictError("Username already exists");
    }
    throw err;
  }
}

export function toSafeUser(user: User): SafeUser {
  const { password: _, ...safe } = user;
  return safe;
}

export function listUsers(): SafeUser[] {
  return db
    .prepare(
      "SELECT id, username, role, created_at, updated_at FROM users ORDER BY username COLLATE NOCASE ASC, id ASC",
    )
    .all() as SafeUser[];
}

export function countAdmins(): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
    .get() as { count: number };
  return row.count;
}

export function getActiveUserForToken(
  userId: number,
  tokenIssuedAtSeconds: number,
): SafeUser | null {
  const cachedEntry = userCache.get(userId);
  if (cachedEntry && Date.now() - cachedEntry.cachedAt < CACHE_TTL_MS) {
    const updatedAtSeconds = Math.floor(
      new Date(
        `${cachedEntry.user.updated_at.replace(" ", "T")}Z`,
      ).getTime() / 1000,
    );

    if (tokenIssuedAtSeconds >= updatedAtSeconds) {
      return cachedEntry.user;
    }
  }

  const user = findUserById(userId);
  if (!user) {
    return null;
  }

  const updatedAtSeconds = Math.floor(
    new Date(`${user.updated_at.replace(" ", "T")}Z`).getTime() / 1000,
  );

  if (tokenIssuedAtSeconds < updatedAtSeconds) {
    return null;
  }

  const safeUser = toSafeUser(user);
  userCache.set(userId, { user: safeUser, cachedAt: Date.now() });
  return safeUser;
}

export async function updateUserByAdmin(
  targetUserId: number,
  actorUserId: number,
  input: { username?: string; role?: "admin" | "viewer"; password?: string },
): Promise<SafeUser> {
  void actorUserId;

  // Hash password before transaction (async, no DB access)
  let hashedPassword: string | undefined;
  if (input.password !== undefined && input.password !== "") {
    hashedPassword = await hashPassword(input.password);
  }

  const updatedUser = db.transaction(() => {
    const targetUser = findUserById(targetUserId);
    if (!targetUser) {
      throw new UserNotFoundError(targetUserId);
    }

    if (
      input.role !== undefined &&
      input.role !== targetUser.role &&
      targetUser.role === "admin" &&
      input.role === "viewer" &&
      countAdmins() === 1
    ) {
      throw new UserProtectionError("Cannot demote the last admin user");
    }

    const setClauses: string[] = [];
    const params: Array<string | number> = [];

    if (input.username !== undefined) {
      const username = input.username.trim();
      const existingUser = db
        .prepare("SELECT id FROM users WHERE username = ? AND id != ?")
        .get(username, targetUserId) as { id: number } | undefined;

      if (existingUser) {
        throw new UserConflictError("Username already exists");
      }

      setClauses.push("username = ?");
      params.push(username);
    }

    if (input.role !== undefined) {
      setClauses.push("role = ?");
      params.push(input.role);
    }

    if (hashedPassword !== undefined) {
      setClauses.push("password = ?");
      params.push(hashedPassword);
    }

    setClauses.push("updated_at = datetime('now')");
    params.push(targetUserId);

    db.prepare(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`).run(
      ...params,
    );

    return toSafeUser(findUserById(targetUserId)!);
  })();

  userCache.delete(targetUserId);
  return updatedUser;
}

const deleteUserByAdminTransaction = db.transaction(
  (targetUserId: number, actorUserId: number): void => {
    if (targetUserId === actorUserId) {
      throw new UserProtectionError("Cannot delete your own account");
    }

    const targetUser = findUserById(targetUserId);
    if (!targetUser) {
      throw new UserNotFoundError(targetUserId);
    }

    if (targetUser.role === "admin" && countAdmins() === 1) {
      throw new UserProtectionError("Cannot delete the last admin user");
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(targetUserId);
  },
);

export function deleteUserByAdmin(
  targetUserId: number,
  actorUserId: number,
): void {
  deleteUserByAdminTransaction(targetUserId, actorUserId);
  userCache.delete(targetUserId);
}
