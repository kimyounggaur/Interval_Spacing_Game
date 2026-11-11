import { describe, expect, it } from "vitest";
import {
  between,
  commonBySemis,
  dstep,
  hz,
  invert,
  isSimple,
  LETTER_PC,
  letterCells,
  MAJOR_STEPS,
  midiOf,
  nameKo,
  natural,
  noteEn,
  noteKo,
  refSemis,
  spellings,
  transpose,
} from "../../src/theory/index";
import type { Note, Quality } from "../../src/theory/index";
const C: Note = { letter: 0, acc: 0, octave: 4 };
const N = (letter: Note["letter"], acc: Note["acc"] = 0, octave = 4): Note => ({
  letter,
  acc,
  octave,
});

describe("DR1 spelling-aware theory", () => {
  it("TH-01 major steps generate letter pitch classes", () => {
    const generated = [0];
    for (const step of MAJOR_STEPS.slice(0, 6))
      generated.push(generated[generated.length - 1]! + step);
    expect(LETTER_PC).toEqual(generated);
    expect(Array.from({ length: 8 }, (_, i) => refSemis(i + 1))).toEqual([
      0, 2, 4, 5, 7, 9, 11, 12,
    ]);
  });
  it("TH-02 MIDI and frequency anchors", () => {
    expect(midiOf(C)).toBe(60);
    expect(hz(69)).toBe(440);
    expect(hz(60)).toBeCloseTo(261.625565, 5);
    expect(hz(48)).toBeCloseTo(130.812783, 5);
  });
  it("TH-03 locked 7x7 white-station interval table", () => {
    const expected = [
      ["M2", "M3", "P4", "P5", "M6", "M7", "P8"],
      ["M2", "m3", "P4", "P5", "M6", "m7", "P8"],
      ["m2", "m3", "P4", "P5", "m6", "m7", "P8"],
      ["M2", "M3", "A4", "P5", "M6", "M7", "P8"],
      ["M2", "M3", "P4", "P5", "M6", "m7", "P8"],
      ["M2", "m3", "P4", "P5", "m6", "m7", "P8"],
      ["m2", "m3", "P4", "d5", "m6", "m7", "P8"],
    ];
    for (let letter = 0; letter < 7; letter++)
      for (let num = 2; num <= 8; num++) {
        const a = N(letter as Note["letter"]);
        const iv = between(a, natural(dstep(a) + num - 1));
        expect(`${iv.quality}${iv.num}`, `${noteKo(a)},${num}`).toBe(expected[letter]![num - 2]);
      }
  });
  it("TH-04 locked spelling distinctions (9 cases)", () => {
    const cases: [Note, Note, number, number, string][] = [
      [C, N(1, 1), 2, 3, "증2도"],
      [C, N(2, -1), 3, 3, "단3도"],
      [C, N(3, 1), 4, 6, "증4도"],
      [C, N(4, -1), 5, 6, "감5도"],
      [C, N(0, 1), 1, 1, "증1도"],
      [C, N(1, -1), 2, 1, "단2도"],
      [N(6), N(3, 0, 5), 5, 6, "감5도"],
      [N(2), C, 3, 4, "장3도"],
      [C, N(6, -2), 7, 9, "감7도"],
    ];
    for (const [a, b, num, semis, name] of cases) {
      const iv = between(a, b);
      expect(iv).toMatchObject({ num, semis });
      expect(nameKo(iv)).toBe(name);
    }
  });
  it("TH-05 locked transpositions (17 cases)", () => {
    const cases: [Note, number, Quality, 1 | -1, string | null][] = [
      [N(1), 3, "M", 1, "파♯"],
      [C, 3, "m", 1, "미♭"],
      [N(3), 4, "P", 1, "시♭"],
      [N(6), 5, "P", 1, "파♯"],
      [N(2), 6, "M", 1, "도♯"],
      [C, 7, "m", 1, "시♭"],
      [N(1), 7, "M", 1, "도♯"],
      [C, 5, "P", -1, "파"],
      [C, 3, "M", -1, "라♭"],
      [C, 3, "m", -1, "라"],
      [C, 4, "A", 1, "파♯"],
      [C, 5, "d", 1, "솔♭"],
      [C, 2, "A", 1, "레♯"],
      [N(0, 1), 3, "M", 1, "미♯"],
      [N(1, -1), 3, "M", 1, "파"],
      [C, 8, "P", 1, "도"],
      [C, 5, "M", 1, null],
    ];
    for (const [a, num, q, dir, expected] of cases) {
      const note = transpose(a, num, q, dir);
      expect(note ? noteKo(note) : null).toBe(expected);
    }
  });
  it("TH-08 common interval names from 0 to 12 semitones", () => {
    expect(Array.from({ length: 13 }, (_, s) => commonBySemis(s).map(nameKo).join("/"))).toEqual([
      "완전1도",
      "단2도",
      "장2도",
      "단3도",
      "장3도",
      "완전4도",
      "증4도/감5도",
      "완전5도",
      "단6도",
      "장6도",
      "단7도",
      "장7도",
      "완전8도",
    ]);
  });
  it("TH-09 black keys have two simple spellings with the same pitch", () => {
    for (const midi of [49, 51, 54, 56, 58, 61, 63, 66, 68, 70]) {
      const names = spellings(midi).filter(isSimple);
      expect(names).toHaveLength(2);
      for (const n of names) expect(midiOf(n)).toBe(midi);
    }
  });
  it("TH-10 excludes exotic white-key accidentals and double accidentals", () => {
    for (const n of [N(2, 1), N(3, -1), N(6, 1), N(0, -1), N(1, -2)])
      expect(isSimple(n)).toBe(false);
    for (const n of [C, N(1, -1), N(3, 1)]) expect(isSimple(n)).toBe(true);
  });
  it("TH-11 locked letter badge positions (6 cases)", () => {
    const cases: [Note, 1 | -1, number, number, { cell: number; n: number }[]][] = [
      [
        C,
        1,
        12,
        16,
        [
          { cell: 12, n: 1 },
          { cell: 14, n: 2 },
          { cell: 16, n: 3 },
        ],
      ],
      [
        C,
        1,
        12,
        15,
        [
          { cell: 12, n: 1 },
          { cell: 14, n: 2 },
        ],
      ],
      [
        N(2, -1),
        1,
        15,
        19,
        [
          { cell: 15, n: 1 },
          { cell: 17, n: 2 },
          { cell: 19, n: 3 },
        ],
      ],
      [
        N(1, 1),
        1,
        15,
        17,
        [
          { cell: 15, n: 1 },
          { cell: 16, n: 2 },
          { cell: 17, n: 3 },
        ],
      ],
      [
        N(2, -1),
        -1,
        15,
        12,
        [
          { cell: 15, n: 1 },
          { cell: 14, n: 2 },
          { cell: 12, n: 3 },
        ],
      ],
      [
        N(1, 1),
        -1,
        15,
        12,
        [
          { cell: 15, n: 1 },
          { cell: 12, n: 2 },
        ],
      ],
    ];
    for (const [n, dir, start, to, expected] of cases)
      expect(letterCells(n, dir, start, to)).toEqual(expected);
  });
  it("TH-12 uses musical Unicode and spelling-aware names", () => {
    expect(noteKo(N(2, -1))).toBe("미♭");
    expect(noteEn(N(3, 1))).toBe("F♯4");
    expect(nameKo({ num: 4, quality: "A" })).toBe("증4도");
  });
  it("validates impossible degree and spelling requests", () => {
    expect(transpose(C, 0, "P", 1)).toBeNull();
    expect(() => refSemis(0)).toThrow();
    expect(commonBySemis(13)).toEqual([]);
    expect(invert({ num: 1, quality: "P" })).toEqual({ num: 8, quality: "P", semis: 12 });
  });
});
