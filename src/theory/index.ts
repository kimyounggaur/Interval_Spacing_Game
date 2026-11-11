/** Spelling-aware interval arithmetic. The major-scale steps generate all pitch data. */
export const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1] as const;
export const LETTER_PC: readonly number[] = MAJOR_STEPS.slice(0, 6).reduce<number[]>(
  (pitches, step) => [...pitches, pitches[pitches.length - 1]! + step],
  [0],
);
export const LETTER_KO = ["도", "레", "미", "파", "솔", "라", "시"] as const;
export const LETTER_EN = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type Letter = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Accidental = -2 | -1 | 0 | 1 | 2;
export type Direction = 1 | -1;
export type Note = { letter: Letter; acc: Accidental; octave: number };
export type Quality = "P" | "M" | "m" | "A" | "d" | "AA" | "dd";
export type Interval = { num: number; quality: Quality; semis: number };
export type DirectedInterval = Interval & { dir: Direction };
const ACC: Record<Accidental, string> = { "-2": "♭♭", "-1": "♭", 0: "", 1: "♯", 2: "♯♯" };
const Q_KO: Record<Quality, string> = {
  P: "완전",
  M: "장",
  m: "단",
  A: "증",
  d: "감",
  AA: "겹증",
  dd: "겹감",
};
const mod = (value: number, base: number): number => ((value % base) + base) % base;
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
export const midiOf = (note: Note): number =>
  12 * (note.octave + 1) + LETTER_PC[note.letter]! + note.acc;
export const dstep = (note: Note): number => 7 * note.octave + note.letter;
export const natural = (step: number): Note => ({
  letter: mod(step, 7) as Letter,
  acc: 0,
  octave: Math.floor(step / 7),
});
export const isPerfectClass = (num: number): boolean => [0, 3, 4].includes(mod(num - 1, 7));
export function refSemis(num: number): number {
  if (!Number.isInteger(num) || num < 1) throw new RangeError("도수는 1 이상의 정수여야 해요.");
  return 12 * Math.floor((num - 1) / 7) + LETTER_PC[(num - 1) % 7]!;
}
export function qualityOf(num: number, semis: number): Quality | null {
  const delta = semis - refSemis(num);
  const offsets: Partial<Record<number, Quality>> = isPerfectClass(num)
    ? { 0: "P", 1: "A", "-1": "d", 2: "AA", "-2": "dd" }
    : { 0: "M", "-1": "m", 1: "A", "-2": "d", 2: "AA", "-3": "dd" };
  return offsets[delta] ?? null;
}
export function qualityOffset(num: number, quality: Quality): number | null {
  const offsets: Partial<Record<Quality, number>> = isPerfectClass(num)
    ? { P: 0, A: 1, d: -1, AA: 2, dd: -2 }
    : { M: 0, m: -1, A: 1, d: -2, AA: 2, dd: -3 };
  return offsets[quality] ?? null;
}
export function intervalOf(num: number, quality: Quality): Interval | null {
  const offset = qualityOffset(num, quality);
  return offset === null ? null : { num, quality, semis: refSemis(num) + offset };
}
export function between(a: Note, b: Note): DirectedInterval {
  const up = dstep(b) > dstep(a) || (dstep(b) === dstep(a) && midiOf(b) >= midiOf(a));
  const lo = up ? a : b;
  const hi = up ? b : a;
  const num = dstep(hi) - dstep(lo) + 1;
  const semis = midiOf(hi) - midiOf(lo);
  const quality = qualityOf(num, semis);
  if (quality === null) throw new RangeError("겹증·겹감 범위를 벗어난 음정이에요.");
  return { num, semis, quality, dir: up ? 1 : -1 };
}
export function transpose(a: Note, num: number, quality: Quality, dir: Direction = 1): Note | null {
  if (!Number.isInteger(num) || num < 1) return null;
  const offset = qualityOffset(num, quality);
  if (offset === null) return null;
  const target = natural(dstep(a) + dir * (num - 1));
  const acc = midiOf(a) + dir * (refSemis(num) + offset) - midiOf(target);
  return Math.abs(acc) <= 2 ? { ...target, acc: acc as Accidental } : null;
}
export function invert(iv: Pick<Interval, "num" | "quality">): Interval {
  if (iv.num < 1 || iv.num > 8) throw new RangeError("자리바꿈은 1~8도에서 할 수 있어요.");
  const quality: Record<Quality, Quality> = {
    P: "P",
    M: "m",
    m: "M",
    A: "d",
    d: "A",
    AA: "dd",
    dd: "AA",
  };
  return intervalOf(9 - iv.num, quality[iv.quality])!;
}
export const noteKo = (note: Note): string => LETTER_KO[note.letter] + ACC[note.acc];
export const noteEn = (note: Note): string => LETTER_EN[note.letter] + ACC[note.acc] + note.octave;
export const nameKo = (iv: Pick<Interval, "num" | "quality">): string =>
  Q_KO[iv.quality] + iv.num + "도";
export function spellings(midi: number, maxAcc = 1): Note[] {
  const center = Math.floor(((midi - 12) / 12) * 7);
  const notes: Note[] = [];
  for (let step = center - 3; step <= center + 4; step++) {
    const n = natural(step);
    const acc = midi - midiOf(n);
    if (Number.isInteger(acc) && Math.abs(acc) <= Math.min(2, maxAcc))
      notes.push({ ...n, acc: acc as Accidental });
  }
  return notes;
}
export function commonBySemis(semis: number): Interval[] {
  if (!Number.isInteger(semis) || semis < 0 || semis > 12) return [];
  const intervals: Interval[] = [];
  for (let num = 1; num <= 8; num++) {
    const quality = qualityOf(num, semis);
    if (quality) intervals.push({ num, quality, semis });
  }
  const basic = intervals.filter((iv) => ["P", "M", "m"].includes(iv.quality));
  return basic.length ? basic : intervals.filter((iv) => iv.quality === "A" || iv.quality === "d");
}
export const isWhitePc = (midi: number): boolean => LETTER_PC.includes(mod(midi, 12));
export const isSimple = (note: Note): boolean =>
  Math.abs(note.acc) <= 1 && (note.acc === 0 || !isWhitePc(midiOf(note)));
/** Badge positions follow letter steps, not chromatic keyboard cells. */
export function letterCells(
  startNote: Note,
  dir: Direction,
  start: number,
  to: number,
): { cell: number; n: number }[] {
  const cells = [{ cell: start, n: 1 }];
  if ((to - start) * dir < 0) return cells;
  for (let k = 1; k < 16; k++) {
    const cell = midiOf(natural(dstep(startNote) + dir * k)) - 48;
    if (cell < 0 || cell > 24 || (cell - start) * dir > (to - start) * dir) break;
    cells.push({ cell, n: k + 1 });
  }
  return cells;
}
