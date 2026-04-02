import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { apiFetch } from "../api";

interface VideoPlayerProps {
  fileName: string;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoPlayer({ fileName, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<string>("Preparing stream...");
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [startOffset, setStartOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const destroyCurrentSession = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (sessionIdRef.current) {
      const token = localStorage.getItem("token") ?? "";
      fetch(`/api/stream/${sessionIdRef.current}?token=${token}`, {
        method: "DELETE",
      }).catch(() => {});
      sessionIdRef.current = null;
    }
  }, []);

  const startStream = useCallback(
    async (seekTo: number) => {
      destroyCurrentSession();
      setStatus(seekTo > 0 ? `Seeking to ${formatTime(seekTo)}...` : "Preparing stream...");
      setError(null);
      setStartOffset(seekTo);

      try {
        const token = localStorage.getItem("token") ?? "";
        const res = await apiFetch(
          `/api/stream/start?file=${encodeURIComponent(fileName)}&start=${seekTo}`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `HTTP ${res.status}`,
          );
        }

        const data = (await res.json()) as {
          sessionId: string;
          startSeconds: number;
          durationSeconds: number | null;
        };

        sessionIdRef.current = data.sessionId;
        if (data.durationSeconds) setDurationSeconds(data.durationSeconds);

        const playlistUrl = `/api/stream/${data.sessionId}/stream.m3u8?token=${token}`;

        if (!videoRef.current) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            xhrSetup: (xhr, url) => {
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
            setStatus("");
            videoRef.current?.play().catch(() => {});
          });

          hls.on(Hls.Events.ERROR, (_event, errData) => {
            if (errData.fatal) {
              setError(`Playback error: ${errData.details}`);
            }
          });
        } else if (
          videoRef.current.canPlayType("application/vnd.apple.mpegurl")
        ) {
          videoRef.current.src = playlistUrl;
          videoRef.current.addEventListener("loadedmetadata", () => {
            setStatus("");
            videoRef.current?.play().catch(() => {});
          });
        } else {
          setError("Your browser does not support HLS video playback.");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to start stream",
        );
      }
    },
    [fileName, destroyCurrentSession],
  );

  // Start initial stream
  useEffect(() => {
    startStream(0);
    return () => destroyCurrentSession();
  }, [startStream, destroyCurrentSession]);

  // Track current playback time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onTimeUpdate() {
      setCurrentTime(startOffset + (video?.currentTime ?? 0));
    }
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [startOffset]);

  function handleSeekBarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!durationSeconds) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSeconds = Math.floor(ratio * durationSeconds);
    startStream(targetSeconds);
  }

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
          maxHeight: "75vh",
          background: "#000",
          borderRadius: "4px",
          display: error ? "none" : "block",
        }}
      />

      {/* Custom seek bar for full video duration */}
      {durationSeconds && (
        <div style={{ width: "90vw", maxWidth: "1200px", marginTop: "0.75rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#aaa",
              fontSize: "0.75rem",
              marginBottom: "0.25rem",
            }}
          >
            <span>{formatTime(currentTime)}</span>
            <span style={{ color: "#666" }}>
              Click to jump to any point in the recording
            </span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
          <div
            onClick={handleSeekBarClick}
            style={{
              width: "100%",
              height: "24px",
              background: "#333",
              borderRadius: "4px",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Progress indicator */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${(currentTime / durationSeconds) * 100}%`,
                background: "#0066cc",
                borderRadius: "4px 0 0 4px",
                transition: "width 0.3s",
              }}
            />
            {/* Time markers */}
            {Array.from(
              { length: Math.min(Math.floor(durationSeconds / 600), 11) },
              (_, i) => {
                const markerTime = (i + 1) * 600;
                const pct = (markerTime / durationSeconds) * 100;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${pct}%`,
                      top: 0,
                      height: "100%",
                      width: "1px",
                      background: "rgba(255,255,255,0.15)",
                    }}
                  />
                );
              },
            )}
          </div>
        </div>
      )}
    </div>
  );
}
