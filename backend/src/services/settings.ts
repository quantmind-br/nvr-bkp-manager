import db from "../db.js";

export interface StoredSettings {
  id: number;
  sftp_host: string;
  sftp_port: number;
  sftp_user: string;
  sftp_password: string;
  sftp_path: string;
  updated_at: string;
}

export interface PublicSettings {
  host: string;
  port: number;
  user: string;
  path: string;
  hasPassword: boolean;
  isConfigured: boolean;
  updatedAt: string;
}

export interface SftpSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  path: string;
}

export interface UpdateSettingsInput {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  path?: string;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage not configured");
    this.name = "StorageNotConfiguredError";
  }
}

function getExistingSettingsRow(): StoredSettings {
  ensureSettingsRow();

  const row = getSettingsRow();
  if (!row) {
    throw new Error("Settings row missing");
  }

  return row;
}

export function initSettingsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id            INTEGER PRIMARY KEY CHECK(id = 1),
      sftp_host     TEXT    NOT NULL DEFAULT '',
      sftp_port     INTEGER NOT NULL DEFAULT 23,
      sftp_user     TEXT    NOT NULL DEFAULT '',
      sftp_password TEXT    NOT NULL DEFAULT '',
      sftp_path     TEXT    NOT NULL DEFAULT '/home/backups/nvr',
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function ensureSettingsRow(): void {
  db.prepare("INSERT OR IGNORE INTO settings (id) VALUES (1)").run();
}

export function getSettingsRow(): StoredSettings | undefined {
  return db.prepare("SELECT * FROM settings WHERE id = 1").get() as
    | StoredSettings
    | undefined;
}

export function getStoredPassword(): string {
  return getSettingsRow()?.sftp_password ?? "";
}

export function getPublicSettings(): PublicSettings {
  const row = getExistingSettingsRow();
  const hasPassword = row.sftp_password.length > 0;

  return {
    host: row.sftp_host,
    port: row.sftp_port,
    user: row.sftp_user,
    path: row.sftp_path,
    hasPassword,
    isConfigured:
      row.sftp_host.length > 0 &&
      row.sftp_user.length > 0 &&
      hasPassword &&
      row.sftp_path.length > 0,
    updatedAt: row.updated_at,
  };
}

export function getSftpSettingsOrThrow(): SftpSettings {
  const row = getExistingSettingsRow();
  const isConfigured =
    row.sftp_host.length > 0 &&
    row.sftp_user.length > 0 &&
    row.sftp_password.length > 0 &&
    row.sftp_path.length > 0;

  if (!isConfigured) {
    throw new StorageNotConfiguredError();
  }

  return {
    host: row.sftp_host,
    port: row.sftp_port,
    user: row.sftp_user,
    password: row.sftp_password,
    path: row.sftp_path,
  };
}

export function saveSettings(
  input: UpdateSettingsInput & {
    host: string;
    port: number;
    user: string;
    path: string;
  },
): void {
  ensureSettingsRow();

  if (input.password && input.password.length > 0) {
    db.prepare(
      `
        UPDATE settings
        SET sftp_host = ?,
            sftp_port = ?,
            sftp_user = ?,
            sftp_password = ?,
            sftp_path = ?,
            updated_at = datetime('now')
        WHERE id = 1
      `,
    ).run(input.host, input.port, input.user, input.password, input.path);

    return;
  }

  db.prepare(
    `
      UPDATE settings
      SET sftp_host = ?,
          sftp_port = ?,
          sftp_user = ?,
          sftp_path = ?,
          updated_at = datetime('now')
      WHERE id = 1
    `,
  ).run(input.host, input.port, input.user, input.path);
}
