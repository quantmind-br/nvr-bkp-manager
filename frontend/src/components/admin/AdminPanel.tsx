import { useState } from "react";
import AdminUsersSection from "./AdminUsersSection";
import AdminServerSection from "./AdminServerSection";

type Tab = "users" | "server";

const tabBase: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "0.5rem 1rem",
  fontSize: "0.95rem",
  cursor: "pointer",
  borderBottom: "2px solid transparent",
};

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  return (
    <div>
      <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Administration</h2>

      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: "1.5rem",
        }}
      >
        <button
          onClick={() => setActiveTab("users")}
          style={{
            ...tabBase,
            fontWeight: activeTab === "users" ? 600 : 400,
            color: activeTab === "users" ? "var(--color-text)" : "var(--color-text-muted)",
            borderBottom: activeTab === "users"
              ? "2px solid var(--color-primary)"
              : "2px solid transparent",
          }}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab("server")}
          style={{
            ...tabBase,
            fontWeight: activeTab === "server" ? 600 : 400,
            color: activeTab === "server" ? "var(--color-text)" : "var(--color-text-muted)",
            borderBottom: activeTab === "server"
              ? "2px solid var(--color-primary)"
              : "2px solid transparent",
          }}
        >
          Server
        </button>
      </div>

      {activeTab === "users" ? <AdminUsersSection /> : <AdminServerSection />}
    </div>
  );
}
