import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./sftp.js", () => ({
  getReadStream: vi.fn(),
}));

import {
  activeSessions,
  purgeExpiredSessions,
  removeSession,
  SESSION_TTL_MS,
} from "./stream.js";

describe("stream session cleanup", () => {
  beforeEach(() => {
    activeSessions.clear();
  });

  it("removes sessions older than the TTL", () => {
    const cleanup = vi.fn();
    activeSessions.set("expired", {
      sessionId: "expired",
      hlsDir: "/tmp/expired",
      startSeconds: 0,
      durationSeconds: null,
      createdAt: Date.now() - SESSION_TTL_MS - 1,
      cleanup,
      ready: Promise.resolve(),
    });

    purgeExpiredSessions();

    expect(activeSessions.has("expired")).toBe(false);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("does not remove placeholder sessions", () => {
    const cleanup = vi.fn();
    activeSessions.set("placeholder", {
      sessionId: "placeholder",
      hlsDir: "/tmp/placeholder",
      startSeconds: 0,
      durationSeconds: null,
      createdAt: 0,
      cleanup,
      ready: Promise.resolve(),
    });

    purgeExpiredSessions();

    expect(activeSessions.has("placeholder")).toBe(true);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("removes sessions through the explicit remover", () => {
    const cleanup = vi.fn();
    activeSessions.set("manual", {
      sessionId: "manual",
      hlsDir: "/tmp/manual",
      startSeconds: 0,
      durationSeconds: null,
      createdAt: Date.now(),
      cleanup,
      ready: Promise.resolve(),
    });

    removeSession("manual");

    expect(activeSessions.has("manual")).toBe(false);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
