import { describe, expect, it } from "vitest";
import {
  COMMON,
  createTicket,
  greenOptions,
  makeOptions,
  startSpellings,
} from "../../src/game/generator";
import { commonBySemis, isSimple, isWhitePc, midiOf, spellings } from "../../src/theory/index";

describe("DR4 bounded ticket generation", () => {
  it("GN-01 every white station offers a degree ticket", () => {
    for (let pos = 0; pos < 25; pos++) {
      const options = greenOptions(pos);
      if (isWhitePc(48 + pos)) {
        expect(options.length).toBeGreaterThanOrEqual(7);
        expect(options.length).toBeLessThanOrEqual(14);
      } else expect(options).toEqual([]);
    }
  });
  it("GN-02 every simple spelling offers construction tickets", () => {
    let spellingsCount = 0;
    for (let pos = 0; pos < 25; pos++)
      for (const n of startSpellings(pos)) {
        expect(makeOptions(pos, [n]).length).toBeGreaterThan(0);
        spellingsCount++;
      }
    expect(spellingsCount).toBe(35);
  });
  it("GN-03 every white station supports all twelve semitone classes", () => {
    for (let pos = 0; pos < 25; pos++)
      if (isWhitePc(48 + pos)) {
        const semis = new Set(makeOptions(pos).map((o) => o.iv.semis));
        expect(semis.size).toBe(12);
      }
  });
  it("GN-04 longest movement is twelve cells", () => {
    const distances = [];
    for (let pos = 0; pos < 25; pos++)
      for (const o of makeOptions(pos)) distances.push(Math.abs(o.target - pos));
    expect(Math.max(...distances)).toBe(12);
    expect(Math.min(...distances)).toBe(1);
  });
  it("GN-05 every candidate stays in bounds and honors L1/L2", () => {
    for (let pos = 0; pos < 25; pos++)
      for (const level of ["L1", "L2"] as const)
        for (const o of makeOptions(pos, undefined, COMMON, level)) {
          expect(o.target).toBeGreaterThanOrEqual(0);
          expect(o.target).toBeLessThanOrEqual(24);
          expect(isSimple(o.startNote)).toBe(true);
          expect(isSimple(o.targetNote)).toBe(true);
          expect(midiOf(o.targetNote)).toBe(48 + o.target);
          if (level === "L1") {
            expect(o.startNote.acc).toBe(0);
            expect(o.targetNote.acc).toBe(0);
          }
        }
  });
  it("GN-06 preserves name when available and respells only when required", () => {
    let kept = 0,
      flipped = 0;
    for (let pos = 0; pos < 25; pos++)
      for (const n of startSpellings(pos))
        for (const iv of COMMON) {
          const item = `make:${iv.quality}${iv.num}`;
          const available = makeOptions(pos, [n], iv.semis === 6 ? commonBySemis(6) : [iv]);
          const ticket = createTicket(item, pos, n, () => 0);
          if (available.length) {
            expect(ticket?.startNote).toEqual(n);
            expect(ticket?.respelled).toBe(false);
            kept++;
          } else if (ticket) {
            expect(ticket.respelled).toBe(true);
            flipped++;
          }
        }
    expect(kept).toBeGreaterThan(300);
    expect(flipped).toBeGreaterThan(0);
  });
  it("AU-04 all listening tickets stay between MIDI 48 and 72", () => {
    for (let pos = 0; pos < 25; pos++)
      for (const iv of COMMON) {
        const ticket = createTicket(`ear:${iv.quality}${iv.num}`, pos, null, () => 0, {
          earLevel: 3,
        });
        if (ticket) {
          expect(midiOf(ticket.startNote)).toBeGreaterThanOrEqual(48);
          expect(midiOf(ticket.targetNote)).toBeLessThanOrEqual(72);
          expect(ticket.choices.length).toBe(12);
        }
      }
  });
  it("tickets reject invalid positions and unavailable white-key reading", () => {
    expect(createTicket("make:M3", 25)).toBeNull();
    expect(createTicket("deg:4", 13)).toBeNull();
    expect(createTicket("read:m3", 13)).toBeNull();
    expect(createTicket("bad:M3", 12)).toBeNull();
    expect(createTicket("make:M5", 12)).toBeNull();
    expect(spellings(60)).not.toHaveLength(0);
  });
});
