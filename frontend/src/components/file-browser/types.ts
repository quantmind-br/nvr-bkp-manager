export interface FileEntry {
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

export type SortColumn = "channel" | "start" | "end";
export type SortDirection = "asc" | "desc";
