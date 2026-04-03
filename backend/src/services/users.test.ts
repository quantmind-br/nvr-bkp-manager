import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const statementMock = vi.hoisted(() => ({
  get: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  prepare: vi.fn(() => statementMock),
  exec: vi.fn(),
  transaction: vi.fn((fn: unknown) => fn),
}));

vi.mock("../db.js", () => ({ default: dbMock }));

import { CACHE_TTL_MS, getActiveUserForToken, userCache } from "./users.js";

const userRow = {
  id: 1,
  username: "admin",
  password: "hash",
  role: "admin" as const,
  created_at: "2026-02-03 06:00:00",
  updated_at: "2026-02-03 06:30:00",
};

describe("getActiveUserForToken cache", () => {
  beforeEach(() => {
    userCache.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-03T07:00:00Z"));
    statementMock.get.mockReset();
    statementMock.run.mockReset();
    statementMock.all.mockReset();
    dbMock.prepare.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hits the cache for repeated lookups", () => {
    statementMock.get.mockReturnValue(userRow);

    const issuedAt = Math.floor(Date.parse("2026-02-03T06:30:00Z") / 1000);

    expect(getActiveUserForToken(1, issuedAt)).toEqual({
      id: 1,
      username: "admin",
      role: "admin",
      created_at: "2026-02-03 06:00:00",
      updated_at: "2026-02-03 06:30:00",
    });

    expect(getActiveUserForToken(1, issuedAt)).toEqual({
      id: 1,
      username: "admin",
      role: "admin",
      created_at: "2026-02-03 06:00:00",
      updated_at: "2026-02-03 06:30:00",
    });

    expect(dbMock.prepare).toHaveBeenCalledTimes(1);
    expect(statementMock.get).toHaveBeenCalledTimes(1);
  });

  it("re-queries after the cache TTL expires", () => {
    statementMock.get.mockReturnValue(userRow);

    const issuedAt = Math.floor(Date.parse("2026-02-03T06:30:00Z") / 1000);

    getActiveUserForToken(1, issuedAt);
    vi.advanceTimersByTime(CACHE_TTL_MS + 1);
    getActiveUserForToken(1, issuedAt);

    expect(statementMock.get).toHaveBeenCalledTimes(2);
  });

  it("allows cache invalidation by deleting the entry", () => {
    statementMock.get.mockReturnValue(userRow);

    const issuedAt = Math.floor(Date.parse("2026-02-03T06:30:00Z") / 1000);

    getActiveUserForToken(1, issuedAt);
    userCache.delete(1);
    getActiveUserForToken(1, issuedAt);

    expect(statementMock.get).toHaveBeenCalledTimes(2);
  });
});
