import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "../api";
import { useAuth } from "../auth";
import Breadcrumb from "./file-browser/Breadcrumb";
import BulkActionsBar from "./file-browser/BulkActionsBar";
import FileTable from "./file-browser/FileTable";
import FilterBar from "./file-browser/FilterBar";
import type { FileEntry, SortColumn } from "./file-browser/types";
import { getExtension } from "./file-browser/utils";
import UploadButton from "./UploadButton";
import VideoPlayer from "./VideoPlayer";

export default function FileList() {
  const { isAdmin } = useAuth();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
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
  const [sortColumn, setSortColumn] = useState<SortColumn>("start");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [knownChannels, setKnownChannels] = useState<Set<string>>(new Set());
  const [knownTypes, setKnownTypes] = useState<Set<string>>(new Set());

  const fetchFiles = useCallback(async (path: string, date: string, startDate: string, endDate: string, channels: Set<string>, minSize: string, maxSize: string, types: Set<string>) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.append("path", path);
      if (date) { params.append("startDate", date); params.append("endDate", date); } else {
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
      }
      if (channels.size > 0) params.append("channel", Array.from(channels).join(","));
      if (types.size > 0) params.append("fileType", Array.from(types).join(","));
      const minBytes = minSize ? Math.round(parseFloat(minSize) * 1024 * 1024) : 0;
      const maxBytes = maxSize ? Math.round(parseFloat(maxSize) * 1024 * 1024) : 0;
      if (minBytes > 0) params.append("minSize", String(minBytes));
      if (maxBytes > 0) params.append("maxSize", String(maxBytes));
      const res = await apiFetch(`/api/files?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setFiles(await res.json() as FileEntry[]); setSelectedForBulk(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files"); setFiles([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { setSelectedChannels(new Set()); setSelectedTypes(new Set()); setDateFilter(""); setStartDateFilter(""); setEndDateFilter(""); setTimeFrom(""); setTimeTo(""); setMinSizeMB(""); setMaxSizeMB(""); setSelectedForBulk(new Set()); }, [currentPath]);
  useEffect(() => { fetchFiles(currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB, selectedTypes); }, [currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB, selectedTypes, fetchFiles]);
  useEffect(() => {
    const newChannels = new Set(knownChannels), newTypes = new Set(knownTypes); let changed = false;
    for (const f of files) {
      if (f.parsed?.channel && !newChannels.has(f.parsed.channel)) { newChannels.add(f.parsed.channel); changed = true; }
      if (!f.isDirectory) {
        const ext = getExtension(f.name);
        if (ext && !newTypes.has(ext)) { newTypes.add(ext); changed = true; }
      }
    }
    if (changed) { setKnownChannels(newChannels); setKnownTypes(newTypes); }
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setKnownChannels(new Set()); setKnownTypes(new Set()); }, [currentPath]);
  const availableChannels = useMemo(() => Array.from(knownChannels).sort(), [knownChannels]);
  const availableTypes = useMemo(() => Array.from(knownTypes).sort(), [knownTypes]);
  const timeFilteredFiles = useMemo(() => {
    if (!timeFrom && !timeTo) return files;
    return files.filter((f) => {
      if (f.isDirectory || !f.parsed?.startTime) return true;
      const timePart = f.parsed.startTime.slice(11, 16);
      if (!timePart) return true;
      const from = timeFrom || "00:00";
      const to = timeTo || "23:59";
      return from <= to ? timePart >= from && timePart <= to : timePart >= from || timePart <= to;
    });
  }, [files, timeFrom, timeTo]);
  const sortedFiles = useMemo(() => [...timeFilteredFiles].sort((a, b) => {
    if (a.name === "..") return -1; if (b.name === "..") return 1;
    if (a.isDirectory && !b.isDirectory) return -1; if (!a.isDirectory && b.isDirectory) return 1;
    const valA = sortColumn === "channel" ? a.parsed?.channel || a.name : sortColumn === "start" ? a.parsed?.startTime || a.modifiedAt : a.parsed?.endTime || a.modifiedAt;
    const valB = sortColumn === "channel" ? b.parsed?.channel || b.name : sortColumn === "start" ? b.parsed?.startTime || b.modifiedAt : b.parsed?.endTime || b.modifiedAt;
    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  }), [timeFilteredFiles, sortColumn, sortDirection]);
  const hasActiveFilters = selectedChannels.size > 0 || selectedTypes.size > 0 || !!dateFilter || !!startDateFilter || !!endDateFilter || !!timeFrom || !!timeTo || !!minSizeMB || !!maxSizeMB;
  const selectableFiles = useMemo(() => sortedFiles.filter((f) => !f.isDirectory && f.name !== ".."), [sortedFiles]);
  const allSelected = selectableFiles.length > 0 && selectableFiles.every((f) => selectedForBulk.has(f.name));
  const someSelected = selectableFiles.some((f) => selectedForBulk.has(f.name));
  const selectedTotalSize = useMemo(() => files.reduce((total, f) => total + (selectedForBulk.has(f.name) ? f.size : 0), 0), [files, selectedForBulk]);
  useEffect(() => { if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected && !allSelected; }, [someSelected, allSelected]);
  async function handleDownload(fileName: string) {
    setDownloadingFile(fileName);
    try {
      const res = await apiFetch(`/api/download-token?file=${encodeURIComponent(fileName)}&path=${encodeURIComponent(currentPath)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { downloadUrl: string };
      const a = document.createElement("a");
      a.href = data.downloadUrl; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally { setDownloadingFile(null); }
  }

  async function handleDelete(fileName: string) {
    setDeletingFile(fileName);
    setConfirmingDelete(null);
    try {
      const res = await apiFetch(
        `/api/files?file=${encodeURIComponent(fileName)}&path=${encodeURIComponent(currentPath)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      fetchFiles(currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB, selectedTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally { setDeletingFile(null); }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    setBulkDeleteResult(null);
    try {
      const res = await apiFetch("/api/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: Array.from(selectedForBulk), path: currentPath }),
      });
      const data = (await res.json()) as {
        results: { file: string; success: boolean; error?: string }[];
      };
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
      fetchFiles(currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB, selectedTypes);
    } catch (err) {
      setBulkDeleteResult(err instanceof Error ? err.message : "Bulk delete failed");
    } finally { setBulkDeleting(false); }
  }

  async function handleBulkDownload() {
    if (selectedForBulk.size > 100) {
      setError("Cannot bulk download more than 100 files at once");
      return;
    }
    setBulkDownloading(true);
    try {
      const res = await apiFetch("/api/bulk-download-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: Array.from(selectedForBulk), path: currentPath }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { downloadUrl: string };
      const a = document.createElement("a");
      a.href = data.downloadUrl; a.download = "nvr-recordings.zip"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk download failed");
    } finally { setBulkDownloading(false); }
  }

  function navigateTo(name: string) {
    if (name === "/" || name.startsWith("/")) return setCurrentPath(name || "/");
    if (name === "..") {
      const parts = currentPath.split("/").filter(Boolean); parts.pop();
      return setCurrentPath(parts.length > 0 ? `/${parts.join("/")}` : "/");
    }
    setCurrentPath(currentPath === "/" ? `/${name}` : `${currentPath}/${name}`);
  }

  function handleSort(col: SortColumn) { if (sortColumn === col) setSortDirection(sortDirection === "asc" ? "desc" : "asc"); else { setSortColumn(col); setSortDirection("desc"); } }
  function toggleSelectAll() { setSelectedForBulk(allSelected ? new Set() : new Set(selectableFiles.map((f) => f.name))); }
  function toggleFileSelect(name: string) { const next = new Set(selectedForBulk); if (next.has(name)) next.delete(name); else next.add(name); setSelectedForBulk(next); }
  const clearFilters = () => { setSelectedChannels(new Set()); setSelectedTypes(new Set()); setDateFilter(""); setStartDateFilter(""); setEndDateFilter(""); setTimeFrom(""); setTimeTo(""); setMinSizeMB(""); setMaxSizeMB(""); };
  const refreshFiles = () => fetchFiles(currentPath, dateFilter, startDateFilter, endDateFilter, selectedChannels, minSizeMB, maxSizeMB, selectedTypes);
  const itemCount = sortedFiles.filter((f) => f.name !== "..").length;

  return (
    <div className="mt-4">
      <Breadcrumb currentPath={currentPath} onNavigate={navigateTo} itemCount={itemCount} loading={loading} isAdmin={isAdmin} uploadSlot={isAdmin ? <UploadButton currentPath={currentPath} onUploadComplete={refreshFiles} /> : null} />
      <FilterBar
        availableChannels={availableChannels}
        availableTypes={availableTypes}
        selectedChannels={selectedChannels}
        selectedTypes={selectedTypes}
        dateFilter={dateFilter}
        startDateFilter={startDateFilter}
        endDateFilter={endDateFilter}
        timeFrom={timeFrom}
        timeTo={timeTo}
        minSizeMB={minSizeMB}
        maxSizeMB={maxSizeMB}
        hasActiveFilters={hasActiveFilters}
        onChannelToggle={(ch) => { const next = new Set(selectedChannels); if (next.has(ch)) next.delete(ch); else next.add(ch); setSelectedChannels(next); }}
        onTypeToggle={(ext) => { const next = new Set(selectedTypes); if (next.has(ext)) next.delete(ext); else next.add(ext); setSelectedTypes(next); }}
        onDateFilterChange={(value) => { setDateFilter(value); setStartDateFilter(""); setEndDateFilter(""); }}
        onStartDateChange={(value) => { setStartDateFilter(value); setDateFilter(""); }}
        onEndDateChange={(value) => { setEndDateFilter(value); setDateFilter(""); }}
        onTimeFromChange={setTimeFrom}
        onTimeToChange={setTimeTo}
        onMinSizeChange={setMinSizeMB}
        onMaxSizeChange={setMaxSizeMB}
        onClearFilters={clearFilters}
      />
      {selectedForBulk.size > 0 && (
        <BulkActionsBar selectedCount={selectedForBulk.size} selectedTotalSize={selectedTotalSize} isAdmin={isAdmin} bulkDownloading={bulkDownloading} bulkDeleting={bulkDeleting} confirmBulkDelete={confirmBulkDelete} bulkDeleteResult={bulkDeleteResult} onClearSelection={() => setSelectedForBulk(new Set())} onBulkDownload={handleBulkDownload} onRequestBulkDelete={() => setConfirmBulkDelete(true)} onConfirmBulkDelete={handleBulkDelete} onCancelBulkDelete={() => setConfirmBulkDelete(false)} />
      )}
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="mb-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-destructive"
        >
          Error: {error}
        </p>
      )}
      {selectedFile && <VideoPlayer fileName={selectedFile} currentPath={currentPath} onClose={() => setSelectedFile(null)} />}
      {!error && (
        <>
          <FileTable files={sortedFiles} loading={loading} sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} selectedForBulk={selectedForBulk} allSelected={allSelected} someSelected={someSelected} headerCheckboxRef={headerCheckboxRef} onToggleSelectAll={toggleSelectAll} onToggleFileSelect={toggleFileSelect} onPlay={setSelectedFile} onDownload={handleDownload} onDelete={handleDelete} onNavigate={navigateTo} isAdmin={isAdmin} downloadingFile={downloadingFile} deletingFile={deletingFile} confirmingDelete={confirmingDelete} onSetConfirmingDelete={setConfirmingDelete} />
          {!loading && itemCount === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              No files found.{hasActiveFilters ? " Try adjusting your filters." : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
