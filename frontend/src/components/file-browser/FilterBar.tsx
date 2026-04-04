import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FilterBarProps {
  availableChannels: string[];
  availableTypes: string[];
  selectedChannels: Set<string>;
  selectedTypes: Set<string>;
  dateFilter: string;
  startDateFilter: string;
  endDateFilter: string;
  timeFrom: string;
  timeTo: string;
  minSizeMB: string;
  maxSizeMB: string;
  hasActiveFilters: boolean;
  onChannelToggle: (ch: string) => void;
  onTypeToggle: (ext: string) => void;
  onDateFilterChange: (val: string) => void;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onTimeFromChange: (val: string) => void;
  onTimeToChange: (val: string) => void;
  onMinSizeChange: (val: string) => void;
  onMaxSizeChange: (val: string) => void;
  onClearFilters: () => void;
}

export default function FilterBar({
  availableChannels,
  availableTypes,
  selectedChannels,
  selectedTypes,
  dateFilter,
  startDateFilter,
  endDateFilter,
  timeFrom,
  timeTo,
  minSizeMB,
  maxSizeMB,
  hasActiveFilters,
  onChannelToggle,
  onTypeToggle,
  onDateFilterChange,
  onStartDateChange,
  onEndDateChange,
  onTimeFromChange,
  onTimeToChange,
  onMinSizeChange,
  onMaxSizeChange,
  onClearFilters,
}: FilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-stretch gap-2">
      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Channel
        </span>
        <div className="flex flex-wrap gap-1">
          {availableChannels.length === 0 ? (
            <span className="text-xs text-muted-foreground">-</span>
          ) : (
            availableChannels.map((ch) => {
              const active = selectedChannels.has(ch);
              return (
                <Badge
                  key={ch}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => onChannelToggle(ch)}
                >
                  {ch.toUpperCase()}
                </Badge>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Date
        </span>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <span className="min-w-[62px] text-[0.7rem] text-muted-foreground">
              Single day
            </span>
            <Input
              id="dateFilter"
              type="date"
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value)}
              className="h-7 w-auto px-2 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="min-w-[62px] text-[0.7rem] text-muted-foreground">
              Date range
            </span>
            <Input
              id="startDateFilter"
              type="date"
              value={startDateFilter}
              placeholder="From"
              onChange={(e) => onStartDateChange(e.target.value)}
              className="h-7 w-auto px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              id="endDateFilter"
              type="date"
              value={endDateFilter}
              placeholder="To"
              onChange={(e) => onEndDateChange(e.target.value)}
              className="h-7 w-auto px-2 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Time
        </span>
        <div className="flex items-center gap-1">
          <Input
            type="time"
            value={timeFrom}
            onChange={(e) => onTimeFromChange(e.target.value)}
            className="h-7 w-24 px-2 text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="time"
            value={timeTo}
            onChange={(e) => onTimeToChange(e.target.value)}
            className="h-7 w-24 px-2 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Size (MB)
        </span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="Min"
            value={minSizeMB}
            onChange={(e) => onMinSizeChange(e.target.value)}
            className="h-7 w-20 px-2 text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="Max"
            value={maxSizeMB}
            onChange={(e) => onMaxSizeChange(e.target.value)}
            className="h-7 w-20 px-2 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          File Type
        </span>
        <div className="flex flex-wrap gap-1">
          {availableTypes.length === 0 ? (
            <span className="text-xs text-muted-foreground">-</span>
          ) : (
            availableTypes.map((ext) => {
              const active = selectedTypes.has(ext);
              return (
                <Badge
                  key={ext}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => onTypeToggle(ext)}
                >
                  .{ext.toUpperCase()}
                </Badge>
              );
            })
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2 self-end pb-2">
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear Filters
          </Button>
          <span className="text-xs text-muted-foreground">(filtered)</span>
        </div>
      )}
    </div>
  );
}
