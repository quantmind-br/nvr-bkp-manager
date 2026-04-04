import { actionBtn, formatSize } from "./utils";

interface BulkActionsBarProps {
  selectedCount: number;
  selectedTotalSize: number;
  isAdmin: boolean;
  bulkDownloading: boolean;
  bulkDeleting: boolean;
  confirmBulkDelete: boolean;
  bulkDeleteResult: string | null;
  onClearSelection: () => void;
  onBulkDownload: () => void;
  onRequestBulkDelete: () => void;
  onConfirmBulkDelete: () => void;
  onCancelBulkDelete: () => void;
}

export default function BulkActionsBar({
  selectedCount,
  selectedTotalSize,
  isAdmin,
  bulkDownloading,
  bulkDeleting,
  confirmBulkDelete,
  bulkDeleteResult,
  onClearSelection,
  onBulkDownload,
  onRequestBulkDelete,
  onConfirmBulkDelete,
  onCancelBulkDelete,
}: BulkActionsBarProps) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.75rem",
          padding: "0.5rem 0.75rem",
          background: "#e8f0fe",
          border: "1px solid #b3d4fc",
          borderRadius: "var(--radius-md)",
          fontSize: "0.85rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600 }}>
          {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
          <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "0.25rem" }}>
            ({formatSize(selectedTotalSize)})
          </span>
        </span>
        <button
          onClick={onClearSelection}
          style={{ ...actionBtn("var(--color-text-muted)"), fontSize: "0.75rem" }}
        >
          Clear selection
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button
            onClick={onBulkDownload}
            disabled={bulkDownloading}
            style={{
              ...actionBtn("var(--color-success)"),
              opacity: bulkDownloading ? 0.6 : 1,
              cursor: bulkDownloading ? "wait" : "pointer",
            }}
          >
            {bulkDownloading ? "Preparing zip..." : "Download Selected"}
          </button>
          {isAdmin && !confirmBulkDelete && (
            <button onClick={onRequestBulkDelete} style={actionBtn("var(--color-danger)")}>
              Delete Selected
            </button>
          )}
          {isAdmin && confirmBulkDelete && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ color: "var(--color-danger)", fontWeight: 600, fontSize: "0.8rem" }}>
                Delete {selectedCount} files?
              </span>
              <button
                onClick={onConfirmBulkDelete}
                disabled={bulkDeleting}
                style={{
                  ...actionBtn("var(--color-danger)"),
                  opacity: bulkDeleting ? 0.6 : 1,
                  cursor: bulkDeleting ? "wait" : "pointer",
                }}
              >
                {bulkDeleting ? "Deleting..." : "Yes"}
              </button>
              <button onClick={onCancelBulkDelete} style={actionBtn("var(--color-text-muted)")}>
                No
              </button>
            </span>
          )}
        </div>
      </div>

      {bulkDeleteResult && (
        <p
          role="alert"
          aria-live="assertive"
          style={{
            color: "var(--color-danger)",
            padding: "0.5rem 0.75rem",
            background: "#FFF0F0",
            borderRadius: "var(--radius-md)",
            border: "1px solid #FCC",
            marginBottom: "0.75rem",
            fontSize: "0.85rem",
          }}
        >
          {bulkDeleteResult}
        </p>
      )}
    </>
  );
}
