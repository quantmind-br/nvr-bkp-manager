---
phase: 03-video-streaming
plan: 01
subsystem: api
tags: [ffmpeg, hevc, h265, streaming, fmp4, sftp, video-player]

requires:
  - phase: 02-storage-connection
    provides: sftp.ts connection pattern, FileList.tsx for play button integration
provides:
  - SFTP read stream function for remote files
  - FFmpeg remux pipeline (.dav H.265 → fragmented MP4)
  - GET /api/stream endpoint with resource lifecycle management
  - Direct .mp4 proxy streaming without FFmpeg
  - VideoPlayer modal component with HTML5 native controls
affects: [04-file-operations, 06-deploy]

tech-stack:
  added: []
  patterns: [SFTP stream → FFmpeg stdin pipe → HTTP chunked response, reply.hijack() for raw streaming in Fastify, fragmented MP4 with frag_keyframe+empty_moov+default_base_moof]

key-files:
  created: [backend/src/services/stream.ts, backend/src/routes/stream.ts, frontend/src/components/VideoPlayer.tsx]
  modified: [backend/src/services/sftp.ts, backend/src/index.ts, frontend/src/components/FileList.tsx]

key-decisions:
  - ".dav = raw H.265/HEVC — remux only (-c:v copy), no CPU transcoding needed"
  - "FFmpeg input format forced with -f hevc for .dav files"
  - "reply.hijack() + reply.raw for streaming — bypasses Fastify buffering"
  - "Cleanup function pattern for deterministic resource release (FFmpeg + SFTP)"

patterns-established:
  - "VideoStream interface: { stream, contentType, cleanup } for all streaming paths"
  - "Client disconnect triggers cleanup via request.raw 'close' event"
  - "Separate code paths for .dav (FFmpeg remux) and .mp4 (direct proxy)"

duration: ~15min
started: 2026-04-02T11:35:00Z
completed: 2026-04-02T11:43:00Z
---

# Phase 3 Plan 01: Video Streaming (.dav Transcoding) Summary

**FFmpeg remux pipeline streams .dav files (raw H.265) as fragmented MP4 to browser — MVP proof-of-concept validated with real 1920x1080 recordings from Storage Box.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Started | 2026-04-02T11:35:00Z |
| Completed | 2026-04-02T11:43:00Z |
| Tasks | 3 completed |
| Files modified | 6 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: SFTP read stream | Pass | getReadStream() returns Readable + SftpClient handle |
| AC-2: .dav streams as playable fMP4 | Pass | 9.3MB output, H.265 1920x1080, 1:47 duration via Docker |
| AC-3: .mp4 streams directly | Pass | Direct SFTP proxy, no FFmpeg involved |
| AC-4: Video player in frontend | Pass | Modal overlay with HTML5 native controls, Play button in FileList |

## Accomplishments

- **Core MVP validated:** .dav files play in the browser without any proprietary software
- Discovered .dav = raw H.265 HEVC — **remux only** (`-c:v copy`), minimal CPU usage, no transcoding
- Complete resource lifecycle: FFmpeg process + SFTP connection cleaned up on stream end, error, or client disconnect
- Two streaming paths: .dav (FFmpeg remux) and .mp4 (direct proxy) — extensible for future formats
- nginx already configured with `proxy_buffering off` from Phase 1 — streaming works through Docker with zero changes

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| All tasks (1-3) | `e2482fd` | feat | FFmpeg remux pipeline, stream API, video player |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `backend/src/services/stream.ts` | Created | FFmpeg remux pipeline + direct .mp4 proxy |
| `backend/src/routes/stream.ts` | Created | GET /api/stream with filename validation and raw HTTP pipe |
| `frontend/src/components/VideoPlayer.tsx` | Created | Modal overlay with HTML5 video, close on backdrop/Escape |
| `backend/src/services/sftp.ts` | Modified | Added getReadStream() + SftpStream interface |
| `backend/src/index.ts` | Modified | Register streamRoutes |
| `frontend/src/components/FileList.tsx` | Modified | Added Play button, selectedFile state, VideoPlayer integration |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Remux only (-c:v copy) | .dav contains H.265 already browser-compatible — no transcoding needed | Massive CPU savings, near-instant start |
| Force -f hevc input format | FFmpeg's dhav autodetect fails with low confidence | Reliable parsing of all .dav files |
| reply.hijack() for streaming | Fastify's reply.send() buffers responses | True chunked streaming to client |
| Cleanup function pattern | Resources (FFmpeg + SFTP) must be released deterministically | No zombie processes or leaked connections |
| HTML5 native video controls | No video.js or third-party player needed | Zero extra dependencies, browser-native |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | None |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** Plan executed exactly as written. Technical discovery during planning de-risked all implementation.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| FFmpeg failed with dhav autodetect on truncated samples | Forced `-f hevc` input format — works on complete files via pipe |
| SFTP createReadStream with start/end options unreliable | Used full stream without byte limits — works for remux |

## Next Phase Readiness

**Ready:**
- Streaming infrastructure ready for Phase 4 (download can reuse getReadStream)
- FileList component ready for Phase 4 (add download/delete buttons alongside Play)
- Video player can be enhanced later (seek, progress, thumbnails) without architectural changes

**Concerns:**
- No seek/range-request support yet — full file streams from beginning (acceptable for MVP)
- Large files (300-400MB) stream duration depends on network between app server and Storage Box

**Blockers:**
- None

---
*Phase: 03-video-streaming, Plan: 01*
*Completed: 2026-04-02*
