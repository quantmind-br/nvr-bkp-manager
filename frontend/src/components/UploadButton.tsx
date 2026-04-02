import { useRef, useState } from "react";

interface UploadButtonProps {
  onUploadComplete: () => void;
}

export default function UploadButton({ onUploadComplete }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  async function uploadFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);

      xhr.open("POST", "/api/upload");

      const token = localStorage.getItem("token");
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 401) {
          localStorage.removeItem("token");
          window.location.reload();
          return;
        }

        if (xhr.status >= 400) {
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            reject(new Error(body.error ?? `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
          return;
        }

        setUploadProgress(100);
        resolve();
      };

      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(form);
    });
  }

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!file) continue;

      setStatus(
        `Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`,
      );
      setUploadProgress(0);

      try {
        await uploadFile(file);
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : "Upload failed"}`);
        setUploadProgress(null);
        setTimeout(() => {
          setStatus(null);
          setUploadProgress(null);
        }, 5000);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }

    setStatus(`Uploaded ${files.length} file(s)`);
    setUploadProgress(null);
    onUploadComplete();
    setTimeout(() => {
      setStatus(null);
      setUploadProgress(null);
    }, 3000);

    if (inputRef.current) inputRef.current.value = "";
  }

  const isError = status?.startsWith("Error:") ?? false;

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
      {uploadProgress !== null && (
        <div
          style={{
            width: "120px",
            height: "6px",
            background: "var(--color-border, #ddd)",
            borderRadius: "var(--radius-sm, 3px)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${uploadProgress}%`,
              height: "100%",
              background: "var(--color-primary, #0066cc)",
              transition: "width 0.2s",
            }}
          />
        </div>
      )}
      {status && (
        <span
          aria-live={isError ? "assertive" : "polite"}
          role={isError ? "alert" : undefined}
          style={{
            fontSize: "0.8rem",
            color: isError
              ? "var(--color-danger, #c00)"
              : "var(--color-text-muted, #666)",
          }}
        >
          {status}
        </span>
      )}
    </div>
  );
}
