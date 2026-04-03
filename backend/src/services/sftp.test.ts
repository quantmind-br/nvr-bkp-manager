import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock settings module before importing sftp
vi.mock("./settings.js", () => ({
  getSftpSettingsOrThrow: () => ({
    host: "test-host",
    port: 22,
    user: "test-user",
    password: "test-pass",
    path: "/remote/base",
  }),
  StorageNotConfiguredError: class extends Error {
    constructor() {
      super("Storage not configured");
      this.name = "StorageNotConfiguredError";
    }
  },
}));

const mockDelete = vi.fn();
const mockEnd = vi.fn();

vi.mock("ssh2-sftp-client", () => {
  return {
    default: class MockSftpClient {
      connect = vi.fn().mockResolvedValue(undefined);
      delete = mockDelete;
      end = mockEnd.mockResolvedValue(undefined);
    },
  };
});

// Import after mocks
const { deleteFiles } = await import("./sftp.js");

describe("deleteFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for successfully deleted files", async () => {
    mockDelete.mockResolvedValue(undefined);

    const results = await deleteFiles(["file1.dav", "file2.dav"]);

    expect(results.size).toBe(2);
    expect(results.get("file1.dav")).toBeNull();
    expect(results.get("file2.dav")).toBeNull();
  });

  it("captures per-file errors without aborting the batch", async () => {
    mockDelete
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Permission denied"))
      .mockResolvedValueOnce(undefined);

    const results = await deleteFiles(["a.dav", "b.dav", "c.dav"]);

    expect(results.size).toBe(3);
    expect(results.get("a.dav")).toBeNull();
    expect(results.get("b.dav")).toBeInstanceOf(Error);
    expect(results.get("b.dav")!.message).toBe("Permission denied");
    expect(results.get("c.dav")).toBeNull();
  });

  it("calls sftp.end() in finally block even when errors occur", async () => {
    mockDelete.mockRejectedValue(new Error("fail"));

    await deleteFiles(["x.dav"]);

    expect(mockEnd).toHaveBeenCalledOnce();
  });

  it("returns empty map for empty input", async () => {
    const results = await deleteFiles([]);

    expect(results.size).toBe(0);
    expect(mockEnd).toHaveBeenCalledOnce();
  });
});
