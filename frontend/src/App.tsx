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
          padding: "2rem",
          textAlign: "center",
          color: "#666",
        }}
      >
        Loading...
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
          borderBottom: "1px solid #ddd",
          paddingBottom: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>NVR Backup Manager</h1>
        <div
          style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
        >
          <span style={{ fontSize: "0.8rem", color: "#666" }}>
            {user.username} ({user.role})
          </span>
          <button
            onClick={logout}
            style={{
              background: "none",
              border: "1px solid #999",
              borderRadius: "3px",
              padding: "3px 10px",
              fontSize: "0.8rem",
              cursor: "pointer",
              color: "#666",
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
