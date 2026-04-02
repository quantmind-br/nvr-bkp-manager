interface VideoPlayerProps {
  fileName: string;
  onClose: () => void;
}

export default function VideoPlayer({ fileName, onClose }: VideoPlayerProps) {
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

      <video
        src={`/api/stream?file=${encodeURIComponent(fileName)}&token=${localStorage.getItem("token") ?? ""}`}
        controls
        autoPlay
        style={{
          maxWidth: "90vw",
          maxHeight: "80vh",
          background: "#000",
          borderRadius: "4px",
        }}
      >
        Your browser does not support video playback.
      </video>
    </div>
  );
}
