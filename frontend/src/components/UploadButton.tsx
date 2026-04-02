import { useRef, useState } from "react";
import { apiFetch } from "../api";

interface UploadButtonProps {
  onUploadComplete: () => void;
}

export default function UploadButton({ onUploadComplete }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setStatus(`Uploading ${files.length} file(s)...`);

    try {
      for (const file of files) {
        setStatus(
          `Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`,
        );
        const form = new FormData();
        form.append("file", file);

        const res = await apiFetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `HTTP ${res.status}`,
          );
        }
      }

      setStatus(`Uploaded ${files.length} file(s)`);
      onUploadComplete();
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus(
        `Error: ${err instanceof Error ? err.message : "Upload failed"}`,
      );
      setTimeout(() => setStatus(null), 5000);
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          background: "#0066cc",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "4px 12px",
          cursor: "pointer",
          fontSize: "0.8rem",
          fontWeight: 600,
        }}
      >
        Upload
      </button>
      {status && (
        <span
          style={{
            fontSize: "0.8rem",
            color: status.startsWith("Error") ? "#c00" : "#666",
          }}
        >
          {status}
        </span>
      )}
    </div>
  );
}
