import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [minSizeMB, setMinSizeMB] = useState("");
  const [maxSizeMB, setMaxSizeMB] = useState("");

  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const [sortColumn, setSortColumn] = useState<"channel" | "start" | "end">("start");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setSelectedChannels(new Set());
    setDateFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setTimeFrom("");
    setTimeTo("");
    setMinSizeMB("");
    setMaxSizeMB("");
    setSelectedForBulk(new Set());
  }, [currentPath]);

  const fetchFiles = useCallback(async (
    path: string,
    date: string,
    startDate: string,
    endDate: string,
    channels: Set<string>,
    minSize: string,
    maxSize: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("path", path);
      if (date) {
        params.append("startDate", date);
        params.append("endDate", date);
      } else {
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
      }
      if (channels.size > 0) {
        params.append("channel", Array.from(channels).join(","));
      }
      const minBytes = minSize ? Math.round(parseFloat(minSize) * 1024 * 1024) : 0;
      const maxBytes = maxSize ? Math.round(parseFloat(maxSize) * 1024 * 1024) : 0;
      if (minBytes > 0) params.append("minSize", String(minBytes));
      if (maxBytes > 0) params.append("maxSize", String(maxBytes));

      const res = await apiFetch(`/api/files?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const data: FileEntry[] = await res.json();
      setFiles(data);
      setSelectedForBulk(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB);
  }, [currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB, fetchFiles]);

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
      fetchFiles(currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB);
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

  const [knownChannels, setKnownChannels] = useState<Set<string>>(new Set());

  // Accumulate channels from all responses (don't shrink when filtering)
  useEffect(() => {
    const newChannels = new Set(knownChannels);
    let changed = false;
    for (const f of files) {
      if (f.parsed?.channel && !newChannels.has(f.parsed.channel)) {
        newChannels.add(f.parsed.channel);
        changed = true;
      }
    }
    if (changed) setKnownChannels(newChannels);
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset known channels when path changes
  useEffect(() => {
    setKnownChannels(new Set());
  }, [currentPath]);

  const availableChannels = useMemo(() => {
    return Array.from(knownChannels).sort();
  }, [knownChannels]);

  const timeFilteredFiles = useMemo(() => {
    if (!timeFrom && !timeTo) return files;
    return files.filter((f) => {
      if (f.isDirectory) return true;
      if (!f.parsed?.startTime) return true;
      const timePart = f.parsed.startTime.slice(11, 16); // "HH:MM"
      if (!timePart) return true;
      const from = timeFrom || "00:00";
      const to = timeTo || "23:59";
      if (from <= to) {
        // Normal range (e.g., 08:00 - 18:00)
        return timePart >= from && timePart <= to;
      }
      // Overnight range (e.g., 22:00 - 06:00)
      return timePart >= from || timePart <= to;
    });
  }, [files, timeFrom, timeTo]);

  const sortedFiles = [...timeFilteredFiles].sort((a, b) => {
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

  const hasActiveFilters = selectedChannels.size > 0 || dateFilter || startDateFilter || endDateFilter || timeFrom || timeTo || minSizeMB || maxSizeMB;

  // Selection helpers
  const selectableFiles = useMemo(
    () => sortedFiles.filter((f) => !f.isDirectory && f.name !== ".."),
    [sortedFiles],
  );

  const allSelected = selectableFiles.length > 0 && selectableFiles.every((f) => selectedForBulk.has(f.name));
  const someSelected = selectableFiles.some((f) => selectedForBulk.has(f.name));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(selectableFiles.map((f) => f.name)));
    }
  }

  function toggleFileSelect(name: string) {
    const next = new Set(selectedForBulk);
    if (next.has(name)) next.delete(name); else next.add(name);
    setSelectedForBulk(next);
  }

  const selectedTotalSize = useMemo(() => {
    let total = 0;
    for (const f of files) {
      if (selectedForBulk.has(f.name)) total += f.size;
    }
    return total;
  }, [files, selectedForBulk]);

  async function handleBulkDelete() {
    setBulkDeleting(true);
    setBulkDeleteResult(null);
    try {
      const res = await apiFetch("/api/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: Array.from(selectedForBulk) }),
      });
      const data = await res.json() as { results: { file: string; success: boolean; error?: string }[] };
      const failed = data.results.filter((r) => !r.success);
      if (failed.length === 0) {
        setSelectedForBulk(new Set());
        setBulkDeleteResult(null);
      } else {
        const failedNames = new Set(failed.map((r) => r.file));
        setSelectedForBulk(failedNames);
        setBulkDeleteResult(`${failed.length} file(s) failed to delete: ${failed.map((r) => r.file).join(", ")}`);
      }
      setConfirmBulkDelete(false);
      fetchFiles(currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB);
    } catch (err) {
      setBulkDeleteResult(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleBulkDownload() {
    setBulkDownloading(true);
    try {
      const res = await apiFetch("/api/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: Array.from(selectedForBulk) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nvr-recordings.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk download failed");
    } finally {
      setBulkDownloading(false);
    }
  }

  const filterGroupStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    padding: "0.5rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "#f8f8f8",
  };

  const filterLabelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: "0.7rem",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const filterInputStyle: React.CSSProperties = {
    padding: "0.2rem 0.4rem",
    borderRadius: "3px",
    border: "1px solid #ccc",
    fontSize: "0.8rem",
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
          {isAdmin && <UploadButton onUploadComplete={() => fetchFiles(currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB)} />}

        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
          alignItems: "stretch",
        }}
      >
        {/* Channel filter group */}
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>Channel</span>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {availableChannels.length === 0 ? (
              <span style={{ color: "#999", fontSize: "0.8rem" }}>-</span>
            ) : (
              availableChannels.map((ch) => {
                const active = selectedChannels.has(ch);
                return (
                  <button
                    key={ch}
                    onClick={() => {
                      const next = new Set(selectedChannels);
                      if (active) next.delete(ch); else next.add(ch);
                      setSelectedChannels(next);
                    }}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "10px",
                      border: active ? "1px solid #0066cc" : "1px solid #ccc",
                      background: active ? "#0066cc" : "#fff",
                      color: active ? "#fff" : "#333",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {ch.toUpperCase()}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Date filter group */}
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>Date</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }}>
            <input
              id="dateFilter"
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setStartDateFilter(""); setEndDateFilter(""); }}
              style={filterInputStyle}
            />
            <span style={{ color: "#999", fontSize: "0.7rem" }}>or</span>
            <input
              id="startDateFilter"
              type="date"
              value={startDateFilter}
              placeholder="From"
              onChange={(e) => { setStartDateFilter(e.target.value); setDateFilter(""); }}
              style={filterInputStyle}
            />
            <span style={{ color: "#999", fontSize: "0.7rem" }}>-</span>
            <input
              id="endDateFilter"
              type="date"
              value={endDateFilter}
              placeholder="To"
              onChange={(e) => { setEndDateFilter(e.target.value); setDateFilter(""); }}
              style={filterInputStyle}
            />
          </div>
        </div>

        {/* Time-of-day filter group */}
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>Time</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <input
              type="time"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
              style={{ ...filterInputStyle, width: "90px" }}
            />
            <span style={{ color: "#999", fontSize: "0.7rem" }}>-</span>
            <input
              type="time"
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              style={{ ...filterInputStyle, width: "90px" }}
            />
          </div>
        </div>

        {/* Size filter group */}
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>Size (MB)</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Min"
              value={minSizeMB}
              onChange={(e) => setMinSizeMB(e.target.value)}
              style={{ ...filterInputStyle, width: "70px" }}
            />
            <span style={{ color: "#999", fontSize: "0.7rem" }}>-</span>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Max"
              value={maxSizeMB}
              onChange={(e) => setMaxSizeMB(e.target.value)}
              style={{ ...filterInputStyle, width: "70px" }}
            />
          </div>
        </div>

        {/* Clear / status */}
        {hasActiveFilters && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-end", paddingBottom: "0.5rem" }}>
            <button
              onClick={() => {
                setSelectedChannels(new Set());
                setDateFilter("");
                setStartDateFilter("");
                setEndDateFilter("");
                setTimeFrom("");
                setTimeTo("");
                setMinSizeMB("");
                setMaxSizeMB("");
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
            <span style={{ color: "#666", fontSize: "0.8rem" }}>(filtered)</span>
          </div>
        )}
      </div>

      {selectedForBulk.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.75rem",
            padding: "0.5rem 0.75rem",
            background: "#e8f0fe",
            border: "1px solid #b3d4fc",
            borderRadius: "4px",
            fontSize: "0.85rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {selectedForBulk.size} file{selectedForBulk.size !== 1 ? "s" : ""} selected
            <span style={{ fontWeight: 400, color: "#666", marginLeft: "0.25rem" }}>
              ({formatSize(selectedTotalSize)})
            </span>
          </span>
          <button
            onClick={() => setSelectedForBulk(new Set())}
            style={{ ...actionBtn("#666"), fontSize: "0.75rem" }}
          >
            Clear selection
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handleBulkDownload()}
              disabled={bulkDownloading}
              style={{
                ...actionBtn("#228B22"),
                opacity: bulkDownloading ? 0.6 : 1,
                cursor: bulkDownloading ? "wait" : "pointer",
              }}
            >
              {bulkDownloading ? "Preparing zip..." : "Download Selected"}
            </button>
            {isAdmin && !confirmBulkDelete && (
              <button
                onClick={() => setConfirmBulkDelete(true)}
                style={actionBtn("#cc0000")}
              >
                Delete Selected
              </button>
            )}
            {isAdmin && confirmBulkDelete && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ color: "#cc0000", fontWeight: 600, fontSize: "0.8rem" }}>
                  Delete {selectedForBulk.size} files?
                </span>
                <button
                  onClick={() => handleBulkDelete()}
                  disabled={bulkDeleting}
                  style={{
                    ...actionBtn("#cc0000"),
                    opacity: bulkDeleting ? 0.6 : 1,
                    cursor: bulkDeleting ? "wait" : "pointer",
                  }}
                >
                  {bulkDeleting ? "Deleting..." : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  style={actionBtn("#666")}
                >
                  No
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {bulkDeleteResult && (
        <p role="alert" aria-live="assertive" style={{ color: "#c00", padding: "0.5rem 0.75rem", background: "#fff0f0", borderRadius: "4px", border: "1px solid #fcc", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
          {bulkDeleteResult}
        </p>
      )}

      {loading && (
        <p aria-live="polite" style={{ color: "#666", padding: "2rem", textAlign: "center" }}>
          Loading files...
        </p>
      )}

      {error && (
        <p
          role="alert"
          aria-live="assertive"
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
        <>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
                minWidth: "960px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid #ddd",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "0.5rem", width: "40px" }}>
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
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
                    tabIndex={file.isDirectory ? 0 : undefined}
                    data-dir-row={file.isDirectory ? "true" : undefined}
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
                    <td style={{ padding: "0.5rem" }}>
                      {!file.isDirectory && file.name !== ".." && (
                        <input
                          type="checkbox"
                          checked={selectedForBulk.has(file.name)}
                          onChange={(e) => { e.stopPropagation(); toggleFileSelect(file.name); }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: "pointer" }}
                        />
                      )}
                    </td>
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
          </div>
          {!loading && !error && sortedFiles.filter(f => f.name !== "..").length === 0 && (
            <p style={{ color: "var(--color-text-faint)", textAlign: "center", padding: "3rem 1rem" }}>
              No files found.{hasActiveFilters ? " Try adjusting your filters." : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
