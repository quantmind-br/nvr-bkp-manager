import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { apiFetch } from "../api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface VideoPlayerProps {
  fileName: string;
  currentPath: string;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoPlayer({ fileName, currentPath, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<string>("Preparing stream...");
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [startOffset, setStartOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const destroyCurrentSession = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (sessionIdRef.current) {
      apiFetch(`/api/stream/${sessionIdRef.current}`, {
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
          `/api/stream/start?file=${encodeURIComponent(fileName)}&path=${encodeURIComponent(currentPath)}&start=${seekTo}`,
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

        // Poll until playlist is ready (FFmpeg may still be starting)
        setStatus(seekTo > 0 ? `Transcoding from ${formatTime(seekTo)}...` : "Transcoding...");
        for (let attempt = 0; attempt < 30; attempt++) {
          const check = await fetch(playlistUrl);
          if (check.ok) break;
          const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000);
          await new Promise((r) => setTimeout(r, delay));
        }

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
    [currentPath, fileName, destroyCurrentSession],
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
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-[92vw] w-full border-0 bg-black/95 p-4 text-white [&>button]:hidden"
        onEscapeKeyDown={onClose}
        onInteractOutside={onClose}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate overflow-hidden font-mono text-sm text-gray-300">{fileName}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Close player"
          >
            ×
          </Button>
        </div>

        {status && (
          <p aria-live="polite" className="my-4 text-center text-sm text-gray-400">
            {status}
          </p>
        )}

        {error && (
          <p role="alert" aria-live="assertive" className="my-4 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <video
          ref={videoRef}
          controls
          className={`mx-auto block max-h-[70vh] max-w-full rounded-md bg-black ${error ? "hidden" : ""}`}
        />

        {durationSeconds && (
          (() => {
            const progressStyle = { width: `${(currentTime / durationSeconds) * 100}%` };
            const hoverStyle =
              hoverTime !== null
                ? { left: `${(hoverTime / durationSeconds) * 100}%` }
                : undefined;

            return (
              <div className="mt-3 w-full">
                <div className="mb-1 flex justify-between text-xs text-gray-400">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-gray-500">Click to jump to any point</span>
                  <span>{formatTime(durationSeconds)}</span>
                </div>
                <div
                  onClick={handleSeekBarClick}
                  onKeyDown={(e) => {
                    if (!durationSeconds) return;
                    const step = Math.max(1, Math.floor(durationSeconds * 0.05));
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      startStream(Math.min(durationSeconds, currentTime + step));
                    }
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      startStream(Math.max(0, currentTime - step));
                    }
                  }}
                  onMouseMove={(e) => {
                    if (!durationSeconds) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    setHoverTime(Math.floor(ratio * durationSeconds));
                  }}
                  onMouseLeave={() => setHoverTime(null)}
                  tabIndex={0}
                  role="slider"
                  aria-label="Seek position"
                  aria-valuemin={0}
                  aria-valuemax={durationSeconds}
                  aria-valuenow={Math.floor(currentTime)}
                  className="relative h-6 w-full cursor-pointer overflow-hidden rounded-md bg-gray-700"
                >
                  <div
                    className="absolute left-0 top-0 h-full rounded-l-md bg-primary transition-[width] duration-300"
                    style={progressStyle}
                  />
                  {Array.from(
                    { length: Math.min(Math.floor(durationSeconds / 600), 11) },
                    (_, i) => {
                      const markerTime = (i + 1) * 600;
                      const pct = (markerTime / durationSeconds) * 100;
                      const markerStyle = { left: `${pct}%` };

                      return (
                        <div
                          key={i}
                          className="absolute top-0 h-full w-px bg-white/15"
                          style={markerStyle}
                        />
                      );
                    },
                  )}
                  {hoverTime !== null && hoverStyle && (
                    <div
                      className="pointer-events-none absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-xs text-white"
                      style={hoverStyle}
                    >
                      {formatTime(hoverTime)}
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </DialogContent>
    </Dialog>
  );
}
