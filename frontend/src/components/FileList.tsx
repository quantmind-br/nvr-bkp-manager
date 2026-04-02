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
  parsed?: {
    channel: string | null;
    startTime: string | null;
    endTime: string | null;
    duration: string | null;
  };
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

  const [channelFilter, setChannelFilter] = useState("");
  const [debouncedChannel, setDebouncedChannel] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const [sortColumn, setSortColumn] = useState<"channel" | "start" | "end">("start");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedChannel(channelFilter), 300);
    return () => clearTimeout(timer);
  }, [channelFilter]);

  useEffect(() => {
    setChannelFilter("");
    setDebouncedChannel("");
    setStartDateFilter("");
    setEndDateFilter("");
  }, [currentPath]);

  const fetchFiles = useCallback(async (path: string, channel: string, start: string, end: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("path", path);
      if (channel) params.append("channel", channel);
      if (start) params.append("startDate", start);
      if (end) params.append("endDate", end);

      const res = await apiFetch(`/api/files?${params.toString()}`);
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
    fetchFiles(currentPath, debouncedChannel, startDateFilter, endDateFilter);
  }, [currentPath, debouncedChannel, startDateFilter, endDateFilter, fetchFiles]);

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
      fetchFiles(currentPath, debouncedChannel, startDateFilter, endDateFilter);
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

  const sortedFiles = [...files].sort((a, b) => {
    if (a.name === "..") return -1;
    if (b.name === "..") return 1;
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    let valA: any = "";
    let valB: any = "";

    if (sortColumn === "channel") {
      valA = a.parsed?.channel || a.name;
      valB = b.parsed?.channel || b.name;
    } else if (sortColumn === "start") {
      valA = a.parsed?.startTime || a.modifiedAt;
      valB = b.parsed?.startTime || b.modifiedAt;
    } else if (sortColumn === "end") {
      valA = a.parsed?.endTime || a.modifiedAt;
      valB = b.parsed?.endTime || b.modifiedAt;
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (col: "channel" | "start" | "end") => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  };

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
            {!loading && `${sortedFiles.filter((f) => f.name !== "..").length} items`}
          </span>
          {isAdmin && <UploadButton onUploadComplete={() => fetchFiles(currentPath, debouncedChannel, startDateFilter, endDateFilter)} />}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1rem",
          padding: "0.75rem",
          background: "#f0f0f0",
          borderRadius: "4px",
          fontSize: "0.9rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="channelFilter" style={{ fontWeight: 600 }}>Channel:</label>
          <input
            id="channelFilter"
            type="text"
            placeholder="e.g. ch0"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            style={{ padding: "0.25rem 0.5rem", borderRadius: "3px", border: "1px solid #ccc" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="startDateFilter" style={{ fontWeight: 600 }}>From:</label>
          <input
            id="startDateFilter"
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            style={{ padding: "0.25rem 0.5rem", borderRadius: "3px", border: "1px solid #ccc" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="endDateFilter" style={{ fontWeight: 600 }}>To:</label>
          <input
            id="endDateFilter"
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            style={{ padding: "0.25rem 0.5rem", borderRadius: "3px", border: "1px solid #ccc" }}
          />
        </div>
        {(channelFilter || startDateFilter || endDateFilter) && (
          <button
            onClick={() => {
              setChannelFilter("");
              setStartDateFilter("");
              setEndDateFilter("");
            }}
            style={{
              background: "none",
              border: "1px solid #999",
              borderRadius: "3px",
              padding: "0.25rem 0.5rem",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            Clear Filters
          </button>
        )}
        {(channelFilter || startDateFilter || endDateFilter) && (
          <span style={{ color: "#666", fontSize: "0.8rem", marginLeft: "auto" }}>
            (filtered)
          </span>
        )}
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
              <th style={{ padding: "0.5rem", cursor: "pointer" }} onClick={() => handleSort("channel")}>
                Channel {sortColumn === "channel" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
              </th>
              <th style={{ padding: "0.5rem", cursor: "pointer" }} onClick={() => handleSort("start")}>
                Start {sortColumn === "start" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
              </th>
              <th style={{ padding: "0.5rem", cursor: "pointer" }} onClick={() => handleSort("end")}>
                End {sortColumn === "end" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
              </th>
              <th style={{ padding: "0.5rem" }}>Duration</th>
              <th style={{ padding: "0.5rem", width: "100px" }}>Size</th>
              <th style={{ padding: "0.5rem", width: "180px" }}>Modified</th>
              <th style={{ padding: "0.5rem", width: "60px" }}>Type</th>
              <th style={{ padding: "0.5rem", width: "180px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.map((file) => (
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
                title={file.name}
              >
                {file.parsed?.channel != null ? (
                  <>
                    <td style={{ padding: "0.5rem" }}>
                      <span style={{ background: "#0066cc", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: "bold" }}>
                        {file.parsed.channel?.toUpperCase() || "-"}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem" }}>{formatDate(file.parsed.startTime || "")}</td>
                    <td style={{ padding: "0.5rem" }}>{formatDate(file.parsed.endTime || "")}</td>
                    <td style={{ padding: "0.5rem" }}>{file.parsed.duration || "-"}</td>
                  </>
                ) : (
                  <td
                    colSpan={4}
                    style={{
                      padding: "0.5rem",
                      color: file.isDirectory ? "#0066cc" : "inherit",
                      fontWeight: file.isDirectory ? 600 : 400,
                    }}
                  >
                    {file.isDirectory ? "[DIR] " : ""}
                    {file.name}
                  </td>
                )}
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
