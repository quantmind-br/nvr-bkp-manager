import type { RefObject } from "react";

import type { FileEntry, SortColumn, SortDirection } from "./types";
import { actionBtn, formatDate, formatSize, getExtension, isPlayable } from "./utils";

interface FileTableProps {
  files: FileEntry[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (col: SortColumn) => void;
  selectedForBulk: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  headerCheckboxRef: RefObject<HTMLInputElement | null>;
  onToggleSelectAll: () => void;
  onToggleFileSelect: (name: string) => void;
  onPlay: (name: string) => void;
  onDownload: (name: string) => void;
  onDelete: (name: string) => void;
  onNavigate: (name: string) => void;
  isAdmin: boolean;
  downloadingFile: string | null;
  deletingFile: string | null;
  confirmingDelete: string | null;
  onSetConfirmingDelete: (name: string | null) => void;
}

export default function FileTable({
  files,
  sortColumn,
  sortDirection,
  onSort,
  selectedForBulk,
  allSelected,
  someSelected,
  headerCheckboxRef,
  onToggleSelectAll,
  onToggleFileSelect,
  onPlay,
  onDownload,
  onDelete,
  onNavigate,
  isAdmin,
  downloadingFile,
  deletingFile,
  confirmingDelete,
  onSetConfirmingDelete,
}: FileTableProps) {
  void someSelected;

  return (
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
              borderBottom: "2px solid var(--color-border)",
              textAlign: "left",
            }}
          >
            <th style={{ padding: "0.5rem", width: "40px" }}>
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                style={{ cursor: "pointer" }}
              />
            </th>
            <th style={{ padding: "0.5rem", cursor: "pointer" }} onClick={() => onSort("channel")}>
              Channel {sortColumn === "channel" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
            </th>
            <th style={{ padding: "0.5rem", cursor: "pointer" }} onClick={() => onSort("start")}>
              Start {sortColumn === "start" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
            </th>
            <th style={{ padding: "0.5rem", cursor: "pointer" }} onClick={() => onSort("end")}>
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
          {files.map((file) => (
            <tr
              key={file.name}
              tabIndex={file.isDirectory ? 0 : undefined}
              data-dir-row={file.isDirectory ? "true" : undefined}
              style={{
                borderBottom: "1px solid #eee",
                cursor: file.isDirectory ? "pointer" : "default",
              }}
              onClick={() => file.isDirectory && onNavigate(file.name)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onSetConfirmingDelete(null);
                if (e.key === "Enter" && file.isDirectory) {
                  onNavigate(file.name);
                }
              }}
              title={file.name}
            >
              <td style={{ padding: "0.5rem" }}>
                {!file.isDirectory && file.name !== ".." && (
                  <input
                    type="checkbox"
                    checked={selectedForBulk.has(file.name)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleFileSelect(file.name);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: "pointer" }}
                  />
                )}
              </td>
              {file.parsed?.channel != null ? (
                <>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        background: "var(--color-primary)",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "10px",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                      }}
                    >
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
                    color: file.isDirectory ? "var(--color-primary)" : "inherit",
                    fontWeight: file.isDirectory ? 600 : 400,
                  }}
                >
                  {file.isDirectory ? "[DIR] " : ""}
                  {file.name}
                </td>
              )}
              <td style={{ padding: "0.5rem", color: "var(--color-text-muted)" }}>
                {file.isDirectory ? "-" : formatSize(file.size)}
              </td>
              <td style={{ padding: "0.5rem", color: "var(--color-text-muted)" }}>
                {formatDate(file.modifiedAt)}
              </td>
              <td
                style={{
                  padding: "0.5rem",
                  color: "var(--color-text-faint)",
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
                      onPlay(file.name);
                    }}
                    style={actionBtn("var(--color-primary)")}
                  >
                    Play
                  </button>
                )}
                {!file.isDirectory && file.name !== ".." && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(file.name);
                    }}
                    disabled={downloadingFile === file.name}
                    style={{
                      ...actionBtn("var(--color-success)"),
                      opacity: downloadingFile === file.name ? 0.6 : 1,
                    }}
                  >
                    {downloadingFile === file.name ? "Downloading..." : "Download"}
                  </button>
                )}
                {isAdmin && !file.isDirectory && file.name !== ".." &&
                  (confirmingDelete === file.name ? (
                    <span style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "0.8rem" }}>
                      <span style={{ color: "var(--color-danger)", fontWeight: 600, fontSize: "0.8rem" }}>
                        Delete?
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(file.name);
                        }}
                        disabled={deletingFile === file.name}
                        style={{
                          ...actionBtn("var(--color-danger)"),
                          opacity: deletingFile === file.name ? 0.6 : 1,
                        }}
                      >
                        {deletingFile === file.name ? "Deleting..." : "Yes"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetConfirmingDelete(null);
                        }}
                        style={actionBtn("var(--color-text-muted)")}
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetConfirmingDelete(file.name);
                      }}
                      disabled={deletingFile === file.name}
                      style={actionBtn("var(--color-danger)")}
                    >
                      {deletingFile === file.name ? "..." : "Delete"}
                    </button>
                  ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
