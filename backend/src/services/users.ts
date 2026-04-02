import bcrypt from "bcryptjs";
import db from "../db.js";

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
  const result = db
    .prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)")
    .run(username, hashed, role);

  const user = findUserById(Number(result.lastInsertRowid))!;
  return toSafeUser(user);
}

export function toSafeUser(user: User): SafeUser {
  const { password: _, ...safe } = user;
  return safe;
}
