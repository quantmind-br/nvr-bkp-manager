import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { apiFetch } from "../api";

interface VideoPlayerProps {
  fileName: string;
  onClose: () => void;
}

export default function VideoPlayer({ fileName, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<string>("Preparing stream...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startStream() {
      try {
        const token = localStorage.getItem("token") ?? "";

        // Start HLS session
        const res = await apiFetch(
          `/api/stream/start?file=${encodeURIComponent(fileName)}`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `HTTP ${res.status}`,
          );
        }

        const { sessionId } = (await res.json()) as { sessionId: string };
        if (cancelled) return;

        sessionIdRef.current = sessionId;
        const playlistUrl = `/api/stream/${sessionId}/stream.m3u8?token=${token}`;

        if (!videoRef.current) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            xhrSetup: (xhr, url) => {
              // Append token to segment requests
              if (!url.includes("token=")) {
                const sep = url.includes("?") ? "&" : "?";
                xhr.open("GET", `${url}${sep}token=${token}`, true);
              }
            },
          });
          hlsRef.current = hls;

          hls.loadSource(playlistUrl);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) {
              setStatus("");
              videoRef.current?.play().catch(() => {});
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal && !cancelled) {
              setError(`Playback error: ${data.details}`);
            }
          });
        } else if (
          videoRef.current.canPlayType("application/vnd.apple.mpegurl")
        ) {
          // Safari native HLS
          videoRef.current.src = playlistUrl;
          videoRef.current.addEventListener("loadedmetadata", () => {
            if (!cancelled) {
              setStatus("");
              videoRef.current?.play().catch(() => {});
            }
          });
        } else {
          setError("Your browser does not support HLS video playback.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to start stream",
          );
        }
      }
    }

    startStream();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      // Stop the session on cleanup
      if (sessionIdRef.current) {
        const token = localStorage.getItem("token") ?? "";
        fetch(
          `/api/stream/${sessionIdRef.current}?token=${token}`,
          { method: "DELETE" },
        ).catch(() => {});
      }
    };
  }, [fileName]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "90vw",
          maxWidth: "1200px",
          marginBottom: "0.5rem",
        }}
      >
        <span
          style={{
            color: "#fff",
            fontSize: "0.9rem",
            fontFamily: "monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {fileName}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: "1.5rem",
            cursor: "pointer",
            padding: "0.25rem 0.5rem",
            lineHeight: 1,
          }}
          aria-label="Close player"
        >
          X
        </button>
      </div>

      {status && (
        <p style={{ color: "#aaa", fontSize: "0.9rem", margin: "1rem 0" }}>
          {status}
        </p>
      )}

      {error && (
        <p style={{ color: "#f66", fontSize: "0.9rem", margin: "1rem 0" }}>
          {error}
        </p>
      )}

      <video
        ref={videoRef}
        controls
        style={{
          maxWidth: "90vw",
          maxHeight: "80vh",
          background: "#000",
          borderRadius: "4px",
          display: error ? "none" : "block",
        }}
      />
    </div>
  );
}
