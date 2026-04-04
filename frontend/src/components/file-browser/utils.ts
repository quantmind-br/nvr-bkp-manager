import type { CSSProperties } from "react";

export function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

export function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function actionBtn(color: string): CSSProperties {
  return {
    background: "none",
    border: `1px solid ${color}`,
    color,
    borderRadius: "var(--radius-sm)",
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    whiteSpace: "nowrap",
  };
}

export function isPlayable(name: string): boolean {
  const ext = getExtension(name);
  return ext === "dav" || ext === "mp4";
}
