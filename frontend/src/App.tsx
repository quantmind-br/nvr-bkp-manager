import { useAuth } from "./auth";
import LoginPage from "./components/LoginPage";
import FileList from "./components/FileList";

export default function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          fontFamily: "system-ui",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "var(--color-text-muted)",
        }}
      >
        <h1 style={{ fontSize: "1.3rem", marginBottom: "1rem", color: "var(--color-text)" }}>
          NVR Backup Manager
        </h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div
      style={{
        fontFamily: "system-ui",
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "1rem 2rem",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>NVR Backup Manager</h1>
        <div
          style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {user.username} ({user.role})
          </span>
          <button
            onClick={logout}
            style={{
              background: "none",
              border: "1px solid var(--color-text-faint)",
              borderRadius: "var(--radius-sm)",
              padding: "3px 10px",
              fontSize: "0.8rem",
              cursor: "pointer",
              color: "var(--color-text-muted)",
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <FileList />
    </div>
  );
}
