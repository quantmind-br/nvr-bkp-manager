import { useCallback, useEffect, useState } from "react";
import VideoPlayer from "./VideoPlayer";
import UploadButton from "./UploadButton";
import { useAuth } from "../auth";
import { apiFetch } from "../api";

interface FileEntry {
  name: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
}

function formatSize(bytes: number): string {
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

function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function actionBtn(color: string): React.CSSProperties {
  return {
    background: "none",
    border: `1px solid ${color}`,
    color,
    borderRadius: "3px",
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    whiteSpace: "nowrap",
  };
}

function isPlayable(name: string): boolean {
  const ext = getExtension(name);
  return ext === "dav" || ext === "mp4";
}

export default function FileList() {
  const { isAdmin } = useAuth();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/files?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const data: FileEntry[] = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath, fetchFiles]);

  function handleDownload(fileName: string) {
    const token = localStorage.getItem("token") ?? "";
    const a = document.createElement("a");
    a.href = `/api/download?file=${encodeURIComponent(fileName)}&token=${token}`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleDelete(fileName: string) {
    if (!window.confirm(`Delete "${fileName}"? This cannot be undone.`)) return;

    setDeletingFile(fileName);
    try {
      const res = await apiFetch(
        `/api/files?file=${encodeURIComponent(fileName)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      fetchFiles(currentPath);
    } catch (err) {
      alert(
        `Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setDeletingFile(null);
    }
  }

  function navigateTo(name: string) {
    if (name === "..") {
      const parts = currentPath.split("/").filter(Boolean);
      parts.pop();
      setCurrentPath(parts.length > 0 ? `/${parts.join("/")}` : "/");
    } else {
      const next =
        currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
      setCurrentPath(next);
    }
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
          padding: "0.5rem 0.75rem",
          background: "#f0f0f0",
          borderRadius: "4px",
          fontFamily: "monospace",
          fontSize: "0.9rem",
        }}
      >
        <span style={{ fontWeight: 600 }}>Path:</span>
        <span>{currentPath}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: "#666", fontSize: "0.8rem" }}>
            {!loading && `${files.filter((f) => f.name !== "..").length} items`}
          </span>
          {isAdmin && <UploadButton onUploadComplete={() => fetchFiles(currentPath)} />}
        </span>
      </div>

      {loading && (
        <p style={{ color: "#666", padding: "2rem", textAlign: "center" }}>
          Loading files...
        </p>
      )}

      {error && (
        <p
          style={{
            color: "#c00",
            padding: "1rem",
            background: "#fff0f0",
            borderRadius: "4px",
            border: "1px solid #fcc",
          }}
        >
          Error: {error}
        </p>
      )}

      {selectedFile && (
        <VideoPlayer
          fileName={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}

      {!loading && !error && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid #ddd",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "0.5rem" }}>Name</th>
              <th style={{ padding: "0.5rem", width: "100px" }}>Size</th>
              <th style={{ padding: "0.5rem", width: "180px" }}>Modified</th>
              <th style={{ padding: "0.5rem", width: "60px" }}>Type</th>
              <th style={{ padding: "0.5rem", width: "180px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr
                key={file.name}
                style={{
                  borderBottom: "1px solid #eee",
                  cursor: file.isDirectory ? "pointer" : "default",
                }}
                onClick={() => file.isDirectory && navigateTo(file.name)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  file.isDirectory &&
                  navigateTo(file.name)
                }
              >
                <td
                  style={{
                    padding: "0.5rem",
                    color: file.isDirectory ? "#0066cc" : "inherit",
                    fontWeight: file.isDirectory ? 600 : 400,
                  }}
                >
                  {file.isDirectory ? "[DIR] " : ""}
                  {file.name}
                </td>
                <td style={{ padding: "0.5rem", color: "#666" }}>
                  {file.isDirectory ? "-" : formatSize(file.size)}
                </td>
                <td style={{ padding: "0.5rem", color: "#666" }}>
                  {formatDate(file.modifiedAt)}
                </td>
                <td
                  style={{
                    padding: "0.5rem",
                    color: "#999",
                    textTransform: "uppercase",
                    fontSize: "0.8rem",
                  }}
                >
                  {file.isDirectory ? "dir" : getExtension(file.name) || "-"}
                </td>
                <td style={{ padding: "0.5rem", display: "flex", gap: "4px" }}>
                  {!file.isDirectory && isPlayable(file.name) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(file.name);
                      }}
                      style={actionBtn("#0066cc")}
                    >
                      Play
                    </button>
                  )}
                  {!file.isDirectory && file.name !== ".." && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file.name);
                      }}
                      style={actionBtn("#228B22")}
                    >
                      Download
                    </button>
                  )}
                  {isAdmin && !file.isDirectory && file.name !== ".." && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.name);
                      }}
                      disabled={deletingFile === file.name}
                      style={actionBtn("#cc0000")}
                    >
                      {deletingFile === file.name ? "..." : "Delete"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
