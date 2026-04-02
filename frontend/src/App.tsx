import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import LoginPage from "./components/LoginPage";
import FileList from "./components/FileList";
import AdminPanel from "./components/admin/AdminPanel";

const navLinkBaseStyle = {
  textDecoration: "none",
  fontSize: "0.95rem",
  paddingBottom: "0.35rem",
  borderBottom: "2px solid transparent",
};

export default function App() {
  const { user, loading, logout, isAdmin } = useAuth();

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
        <nav
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem",
            flex: 1,
          }}
        >
          <NavLink
            to="/"
            style={({ isActive }) => ({
              ...navLinkBaseStyle,
              color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
              fontWeight: isActive ? 600 : 400,
              borderBottomColor: isActive ? "var(--color-primary)" : "transparent",
            })}
          >
            Files
          </NavLink>
          {isAdmin ? (
            <NavLink
              to="/admin"
              style={({ isActive }) => ({
                ...navLinkBaseStyle,
                color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                fontWeight: isActive ? 600 : 400,
                borderBottomColor: isActive ? "var(--color-primary)" : "transparent",
              })}
            >
              Administration
            </NavLink>
          ) : null}
        </nav>
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
      <Routes>
        <Route path="/" element={<FileList />} />
        <Route
          path="/admin"
          element={isAdmin ? <AdminPanel /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
