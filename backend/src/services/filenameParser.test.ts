import { describe, expect, it } from "vitest";
import { parseNvrFilename } from "./filenameParser.js";

describe("parseNvrFilename", () => {
  it("parses a valid NVR filename", () => {
    expect(
      parseNvrFilename("ch0_2026-02-03_07-11-54_2026-02-03_07-13-41.dav"),
    ).toEqual({
      channel: "ch0",
      startTime: "2026-02-03T07:11:54",
      endTime: "2026-02-03T07:13:41",
      duration: 107,
    });
  });

  it("returns null fields for an invalid filename", () => {
    expect(parseNvrFilename("random.mp4")).toEqual({
      channel: null,
      startTime: null,
      endTime: null,
      duration: null,
    });
  });
});
