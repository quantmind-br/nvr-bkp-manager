import { lazy, Suspense } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth";
import LoginPage from "./components/LoginPage";
import FileList from "./components/FileList";

const AdminPanel = lazy(() => import("./components/admin/AdminPanel"));

export default function App() {
  const { user, loading, logout, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-muted-foreground font-sans">
        <h1 className="text-xl font-semibold mb-4 text-foreground">NVR Backup Manager</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-4 font-sans">
      <header className="flex justify-between items-center border-b border-border pb-3 mb-4">
        <h1 className="text-xl font-semibold m-0">NVR Backup Manager</h1>
        <nav className="flex justify-center items-center gap-4 flex-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn(
                "text-sm pb-1 border-b-2 transition-colors duration-150 no-underline",
                isActive
                  ? "text-foreground font-semibold border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )
            }
          >
            Files
          </NavLink>
          {isAdmin ? (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  "text-sm pb-1 border-b-2 transition-colors duration-150 no-underline",
                  isActive
                    ? "text-foreground font-semibold border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                )
              }
            >
              Administration
            </NavLink>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user.username} ({user.role})</span>
          <Button variant="outline" size="sm" onClick={logout} className="transition-colors duration-150">Logout</Button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<FileList />} />
        <Route
          path="/admin"
          element={isAdmin ? <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}><AdminPanel /></Suspense> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
