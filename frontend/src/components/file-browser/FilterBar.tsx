import type { CSSProperties } from "react";

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

const filterGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  padding: "0.5rem",
  border: "1px solid var(--color-border)",
  borderRadius: "6px",
  background: "var(--color-bg-panel)",
};

const filterLabelStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: "0.7rem",
  color: "var(--color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const filterInputStyle: CSSProperties = {
  padding: "0.2rem 0.4rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  fontSize: "0.8rem",
};

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
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        marginBottom: "1rem",
        flexWrap: "wrap",
        alignItems: "stretch",
      }}
    >
      <div style={filterGroupStyle}>
        <span style={filterLabelStyle}>Channel</span>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {availableChannels.length === 0 ? (
            <span style={{ color: "var(--color-text-faint)", fontSize: "0.8rem" }}>-</span>
          ) : (
            availableChannels.map((ch) => {
              const active = selectedChannels.has(ch);
              return (
                <button
                  key={ch}
                  onClick={() => onChannelToggle(ch)}
                  style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    border: active
                      ? "1px solid var(--color-primary)"
                      : "1px solid var(--color-border)",
                    background: active ? "var(--color-primary)" : "#fff",
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

      <div style={filterGroupStyle}>
        <span style={filterLabelStyle}>Date</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", minWidth: "62px" }}>
              Single day
            </span>
            <input
              id="dateFilter"
              type="date"
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value)}
              style={filterInputStyle}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", minWidth: "62px" }}>
              Date range
            </span>
            <input
              id="startDateFilter"
              type="date"
              value={startDateFilter}
              placeholder="From"
              onChange={(e) => onStartDateChange(e.target.value)}
              style={filterInputStyle}
            />
            <span style={{ color: "var(--color-text-faint)", fontSize: "0.7rem" }}>-</span>
            <input
              id="endDateFilter"
              type="date"
              value={endDateFilter}
              placeholder="To"
              onChange={(e) => onEndDateChange(e.target.value)}
              style={filterInputStyle}
            />
          </div>
        </div>
      </div>

      <div style={filterGroupStyle}>
        <span style={filterLabelStyle}>Time</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <input
            type="time"
            value={timeFrom}
            onChange={(e) => onTimeFromChange(e.target.value)}
            style={{ ...filterInputStyle, width: "90px" }}
          />
          <span style={{ color: "var(--color-text-faint)", fontSize: "0.7rem" }}>-</span>
          <input
            type="time"
            value={timeTo}
            onChange={(e) => onTimeToChange(e.target.value)}
            style={{ ...filterInputStyle, width: "90px" }}
          />
        </div>
      </div>

      <div style={filterGroupStyle}>
        <span style={filterLabelStyle}>Size (MB)</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Min"
            value={minSizeMB}
            onChange={(e) => onMinSizeChange(e.target.value)}
            style={{ ...filterInputStyle, width: "70px" }}
          />
          <span style={{ color: "var(--color-text-faint)", fontSize: "0.7rem" }}>-</span>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Max"
            value={maxSizeMB}
            onChange={(e) => onMaxSizeChange(e.target.value)}
            style={{ ...filterInputStyle, width: "70px" }}
          />
        </div>
      </div>

      <div style={filterGroupStyle}>
        <span style={filterLabelStyle}>File Type</span>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {availableTypes.length === 0 ? (
            <span style={{ color: "var(--color-text-faint)", fontSize: "0.8rem" }}>-</span>
          ) : (
            availableTypes.map((ext) => {
              const active = selectedTypes.has(ext);
              return (
                <button
                  key={ext}
                  onClick={() => onTypeToggle(ext)}
                  style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    border: active
                      ? "1px solid var(--color-primary)"
                      : "1px solid var(--color-border)",
                    background: active ? "var(--color-primary)" : "#fff",
                    color: active ? "#fff" : "#333",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  .{ext.toUpperCase()}
                </button>
              );
            })
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            alignSelf: "flex-end",
            paddingBottom: "0.5rem",
          }}
        >
          <button
            onClick={onClearFilters}
            style={{
              background: "none",
              border: "1px solid var(--color-text-faint)",
              borderRadius: "var(--radius-sm)",
              padding: "0.25rem 0.5rem",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            Clear Filters
          </button>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>(filtered)</span>
        </div>
      )}
    </div>
  );
}
