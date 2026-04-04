import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { formatSize } from "./utils";

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
      <div className="animate-in slide-in-from-top-1 fade-in mb-3 flex flex-wrap items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm duration-200">
        <span className="font-semibold">
          {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
          <span className="ml-1 font-normal text-muted-foreground">
            ({formatSize(selectedTotalSize)})
          </span>
        </span>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Clear selection
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkDownload}
            disabled={bulkDownloading}
            className="border-green-600 text-green-600 hover:bg-green-50"
          >
            {bulkDownloading ? "Preparing zip..." : "Download Selected"}
          </Button>
          {isAdmin && !confirmBulkDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestBulkDelete}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              Delete Selected
            </Button>
          )}
          {isAdmin && confirmBulkDelete && (
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-destructive">
                Delete {selectedCount} files?
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={onConfirmBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? "Deleting..." : "Yes"}
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancelBulkDelete}>
                No
              </Button>
            </span>
          )}
        </div>
      </div>

      {bulkDeleteResult && (
        <Alert variant="destructive" className="mb-3" role="alert" aria-live="assertive">
          <AlertDescription>{bulkDeleteResult}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
