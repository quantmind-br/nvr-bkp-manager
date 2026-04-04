import type { ReactNode } from "react";

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  itemCount: number;
  loading: boolean;
  isAdmin: boolean;
  uploadSlot: ReactNode;
}

export default function Breadcrumb({
  currentPath,
  onNavigate,
  itemCount,
  loading,
  isAdmin,
  uploadSlot,
}: BreadcrumbProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "0.75rem",
        padding: "0.5rem 0.75rem",
        background: "var(--color-bg-subtle)",
        borderRadius: "var(--radius-md)",
        fontFamily: "monospace",
        fontSize: "0.9rem",
      }}
    >
      <span style={{ fontWeight: 600 }}>Path:</span>
      <span>
        <span
          onClick={() => onNavigate("/")}
          style={{ cursor: "pointer", color: "var(--color-primary)" }}
        >
          /
        </span>
        {currentPath.split("/").filter(Boolean).map((seg, i, arr) => {
          const path = `/${arr.slice(0, i + 1).join("/")}`;
          const isLast = i === arr.length - 1;
          return (
            <span key={path}>
              {isLast ? (
                <span style={{ fontWeight: 600 }}>{seg}</span>
              ) : (
                <span
                  onClick={() => onNavigate(path)}
                  style={{ cursor: "pointer", color: "var(--color-primary)" }}
                >
                  {seg}
                </span>
              )}
              {" / "}
            </span>
          );
        })}
      </span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
          {!loading && `${itemCount} items`}
        </span>
        {isAdmin && uploadSlot}
      </span>
    </div>
  );
}
