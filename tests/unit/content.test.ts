import { describe, expect, it } from "vitest";
import { SOUND_EXAMPLES, examplesFor, referenceLabel } from "../../src/theory/examples";
import { between } from "../../src/theory/index";

describe("DR7 representative sound content", () => {
  it("CT-01 all proposed examples match their stored semitone intervals", () => {
    for (const e of SOUND_EXAMPLES) {
      expect(between(...e.notes).semis, e.title).toBe(e.semis);
    }
  });
  it("unreviewed melodies remain isolated two-note examples", () => {
    for (const e of SOUND_EXAMPLES) {
      expect(e.notes).toHaveLength(2);
      expect(e.playback).toBe("interval-only");
      expect(e.review).toBe("pending");
    }
  });
  it("unassigned references use explicit two-note practice labels", () => {
    expect(examplesFor(6)).toEqual([]);
    expect(referenceLabel(6)).toContain("두 음으로 들어요");
    expect(referenceLabel(3)).toContain("검수 대기");
  });
});
