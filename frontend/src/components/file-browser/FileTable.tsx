import type { RefObject } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { FileEntry, SortColumn, SortDirection } from "./types";
import { formatDate, formatSize, getExtension, isPlayable } from "./utils";

interface FileTableProps {
  files: FileEntry[];
  loading?: boolean;
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
  loading = false,
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
    <div className="overflow-x-auto">
      <Table className="min-w-[960px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="cursor-pointer"
              />
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => onSort("channel")}>
              Channel {sortColumn === "channel" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => onSort("start")}>
              Start {sortColumn === "start" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => onSort("end")}>
              End {sortColumn === "end" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
            </TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="w-24">Size</TableHead>
            <TableHead className="w-44">Modified</TableHead>
            <TableHead className="w-16">Type</TableHead>
            <TableHead className="w-44">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                </TableRow>
              ))
            : files.map((file) => (
            <TableRow
              key={file.name}
              tabIndex={file.isDirectory ? 0 : undefined}
              data-dir-row={file.isDirectory ? "true" : undefined}
              className={file.isDirectory ? "cursor-pointer transition-colors hover:bg-muted/50" : ""}
              onClick={() => file.isDirectory && onNavigate(file.name)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onSetConfirmingDelete(null);
                if (e.key === "Enter" && file.isDirectory) {
                  onNavigate(file.name);
                }
              }}
              title={file.name}
            >
              <TableCell>
                {!file.isDirectory && file.name !== ".." && (
                  <Checkbox
                    checked={selectedForBulk.has(file.name)}
                    onCheckedChange={() => {
                      onToggleFileSelect(file.name);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer"
                  />
                )}
              </TableCell>
              {file.parsed?.channel != null ? (
                <>
                  <TableCell>
                    <Badge variant="default" className="text-xs font-bold">
                      {file.parsed.channel?.toUpperCase() || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(file.parsed.startTime || "")}</TableCell>
                  <TableCell className="text-sm">{formatDate(file.parsed.endTime || "")}</TableCell>
                  <TableCell className="text-sm">{file.parsed.duration || "-"}</TableCell>
                </>
              ) : (
                <TableCell
                  colSpan={4}
                  className={file.isDirectory ? "font-semibold text-primary" : ""}
                >
                  {file.isDirectory ? "📁 " : ""}
                  {file.name}
                </TableCell>
              )}
              <TableCell className="text-sm text-muted-foreground">
                {file.isDirectory ? "-" : formatSize(file.size)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(file.modifiedAt)}
              </TableCell>
              <TableCell className="text-xs uppercase text-muted-foreground">
                {file.isDirectory ? "dir" : getExtension(file.name) || "-"}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                {!file.isDirectory && isPlayable(file.name) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-primary text-xs text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(file.name);
                    }}
                  >
                    Play
                  </Button>
                )}
                {!file.isDirectory && file.name !== ".." && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-green-600 text-xs text-green-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(file.name);
                    }}
                    disabled={downloadingFile === file.name}
                  >
                    {downloadingFile === file.name ? "..." : "Download"}
                  </Button>
                )}
                {isAdmin && !file.isDirectory && file.name !== ".." &&
                  (confirmingDelete === file.name ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-destructive">
                        Delete?
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(file.name);
                        }}
                        disabled={deletingFile === file.name}
                      >
                        {deletingFile === file.name ? "..." : "Yes"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetConfirmingDelete(null);
                        }}
                      >
                        No
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 border-destructive text-xs text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetConfirmingDelete(file.name);
                      }}
                      disabled={deletingFile === file.name}
                    >
                      {deletingFile === file.name ? "..." : "Delete"}
                    </Button>
                  ))}
                </div>
              </TableCell>
            </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
