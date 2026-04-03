import db from "../db.js";

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  resource: string;
  details: string | null;
  ip: string | null;
  created_at: string;
}

export function initAuditTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      username   TEXT    NOT NULL,
      action     TEXT    NOT NULL,
      resource   TEXT    NOT NULL,
      details    TEXT,
      ip         TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC)
  `);
}

export function logAction(
  userId: number | null,
  username: string,
  action: string,
  resource: string,
  details?: string,
  ip?: string,
): void {
  db.prepare(
    "INSERT INTO audit_logs (user_id, username, action, resource, details, ip) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(userId, username, action, resource, details ?? null, ip ?? null);
}

export function getAuditLogs(
  limit = 100,
  offset = 0,
): { logs: AuditLog[]; total: number } {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM audit_logs").get() as {
      count: number;
    }
  ).count;

  const logs = db
    .prepare(
      "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .all(limit, offset) as AuditLog[];

  return { logs, total };
}
