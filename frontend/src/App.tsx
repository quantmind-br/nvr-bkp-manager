import { useEffect, useState } from "react";
import FileList from "./components/FileList";

export default function App() {
  const [health, setHealth] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d.status))
      .catch(() => setHealth("offline"));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: "1200px", margin: "0 auto", padding: "1rem 2rem" }}>
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
        <span
          style={{
            fontSize: "0.8rem",
            color: health === "ok" ? "#090" : "#c00",
          }}
        >
          Backend: {health}
        </span>
      </header>
      <FileList />
    </div>
  );
}
