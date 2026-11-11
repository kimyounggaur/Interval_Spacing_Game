import { isWhitePc, LETTER_EN, noteKo, spellings } from "../theory";
import { BASE, CELLS } from "./generator";

export type BoardCell = {
  idx: number;
  midi: number;
  pc: number;
  ko: string;
  en: string;
  isWhite: boolean;
  isStart: boolean;
};
export const BOARD: readonly BoardCell[] = Array.from({ length: CELLS }, (_, idx) => {
  const midi = BASE + idx;
  const names = spellings(midi).filter((note) => note.acc === 0 || !isWhitePc(midi));
  return {
    idx, midi, pc: midi % 12,
    ko: names.map(noteKo).join(" / "),
    en: names.map((note) => LETTER_EN[note.letter] + (note.acc === 1 ? "♯" : note.acc === -1 ? "♭" : "")).join(" / "),
    isWhite: isWhitePc(midi), isStart: idx === 12,
  };
});
export const WHITE_CELLS: readonly number[] = BOARD.filter((cell) => cell.isWhite).map((cell) => cell.idx);
