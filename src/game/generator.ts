import {
  between, commonBySemis, dstep, intervalOf, isSimple, isWhitePc, LETTER_KO,
  midiOf, nameKo, natural, noteKo, qualityOffset, refSemis, spellings, transpose,
} from "../theory/index";
import type { Direction, Interval, Note, Quality } from "../theory/index";

export const BASE = 48;
export const CELLS = 25;
export const TOP = BASE + CELLS - 1;
export const WHITES: readonly number[] = Array.from({ length: CELLS }, (_, i) => i).filter((i) => isWhitePc(BASE + i));
export const COMMON: readonly Interval[] = Array.from({ length: 12 }, (_, i) => i + 1).flatMap(commonBySemis);
export type TicketKind = "degree" | "semitone" | "read" | "make" | "ear";
export type Level = "L1" | "L2";
export type Presentation = "up" | "down" | "chord";
export type Ticket = {
  kind: TicketKind;
  start: number;
  target: number;
  dir: Direction;
  num: number;
  startNote: Note;
  targetNote: Note;
  iv: Interval;
  title: string;
  sub: string;
  itemKey: string;
  choices: string[];
  respelled: boolean;
  presentation: Presentation;
};
export type MakeOption = { startNote: Note; targetNote: Note; iv: Interval; dir: Direction; target: number };
export type GreenOption = { num: number; dir: Direction; target: number };
export type GeneratorOptions = { earLevel?: 1 | 2 | 3; level?: Level; earPresentation?: Presentation };
const sameNote = (a: Note, b: Note): boolean => a.letter === b.letter && a.acc === b.acc && a.octave === b.octave;
const pick = <T>(items: readonly T[], rng: () => number): T | undefined => items[Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)))];
export function startSpellings(pos: number, keep: Note | null = null): Note[] {
  if (!Number.isInteger(pos) || pos < 0 || pos >= CELLS) return [];
  if (keep && midiOf(keep) === BASE + pos && isSimple(keep)) return [{ ...keep }];
  return spellings(BASE + pos, 1).filter(isSimple);
}
export function makeOptions(pos: number, starts = startSpellings(pos), pool: readonly Interval[] = COMMON, level: Level = "L2"): MakeOption[] {
  if (!Number.isInteger(pos) || pos < 0 || pos >= CELLS) return [];
  const out: MakeOption[] = [];
  for (const startNote of starts) {
    if (midiOf(startNote) !== BASE + pos || !isSimple(startNote) || (level === "L1" && startNote.acc !== 0)) continue;
    for (const iv of pool) for (const dir of [1, -1] as const) {
      const targetNote = transpose(startNote, iv.num, iv.quality, dir);
      if (!targetNote || !isSimple(targetNote) || (level === "L1" && targetNote.acc !== 0)) continue;
      const midi = midiOf(targetNote);
      if (midi < BASE || midi > TOP || iv.semis < 1 || iv.semis > 12) continue;
      out.push({ startNote: { ...startNote }, targetNote, iv: { ...iv }, dir, target: midi - BASE });
    }
  }
  return out;
}
export function greenOptions(pos: number): GreenOption[] {
  const whiteIndex = WHITES.indexOf(pos);
  if (whiteIndex < 0) return [];
  const out: GreenOption[] = [];
  for (let num = 2; num <= 8; num++) for (const dir of [1, -1] as const) {
    const target = WHITES[whiteIndex + dir * (num - 1)];
    if (target !== undefined) out.push({ num, dir, target });
  }
  return out;
}
export function intervalCode(iv: Pick<Interval, "num" | "quality">): string { return `${iv.quality}${iv.num}`; }
export function intervalFromCode(code: string): Interval | null {
  const match = /^(AA|dd|P|M|m|A|d)([1-8])$/.exec(code);
  return match ? intervalOf(Number(match[2]), match[1] as Quality) : null;
}
export const commonName = (semis: number): string => commonBySemis(semis).map(nameKo).join("/");
export function choicesFor(iv: Interval, rng: () => number = Math.random): string[] {
  const flip: Record<Quality, Quality> = { M: "m", m: "M", P: iv.num === 4 ? "A" : "d", A: "P", d: "P", AA: "A", dd: "d" };
  const sameNum = intervalOf(iv.num, flip[iv.quality]);
  const near = commonBySemis(iv.semis + (iv.semis >= 11 ? -1 : 1))[0];
  const names = [nameKo(iv), ...(sameNum ? [nameKo(sameNum)] : []), ...(near ? [nameKo(near)] : [])];
  for (const fallback of COMMON) {
    if (new Set(names).size >= 3) break;
    names.push(nameKo(fallback));
  }
  const unique = [...new Set(names)].slice(0, 3);
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
    [unique[i], unique[j]] = [unique[j]!, unique[i]!];
  }
  return unique;
}
export function earPool(level: 1 | 2 | 3): Interval[] {
  const semis = level === 1 ? [4, 7, 12] : level === 2 ? [1, 2, 3, 4, 5, 7, 12] : Array.from({ length: 12 }, (_, i) => i + 1);
  return semis.map((semi) => commonBySemis(semi)[0]!);
}
/** Returns null for an unavailable planned item; the run planner can then try its next item. */
export function createTicket(
  item: string, pos: number, keepNote: Note | null = null, rng: () => number = Math.random, options: GeneratorOptions = {},
): Ticket | null {
  if (!Number.isInteger(pos) || pos < 0 || pos >= CELLS) return null;
  const split = item.split(":");
  const category = split[0];
  const code = split[1] ?? "";
  if (category === "deg") {
    const selected = pick(greenOptions(pos).filter((candidate) => candidate.num === Number(code)), rng);
    if (!selected) return null;
    const startNote = spellings(BASE + pos, 0)[0]!;
    const targetNote = spellings(BASE + selected.target, 0)[0]!;
    return {
      kind: "degree", start: pos, target: selected.target, dir: selected.dir, num: selected.num,
      startNote, targetNote, iv: between(startNote, targetNote), itemKey: item, choices: [], respelled: false,
      presentation: selected.dir === 1 ? "up" : "down", title: `${selected.dir === 1 ? "위로" : "아래로"} ${selected.num}도`, sub: "흰 역만 세요 · 출발역이 ①",
    };
  }
  if (category === "semi") {
    const semis = Number(code);
    if (!Number.isInteger(semis) || semis < 1 || semis > 12) return null;
    const directions = ([1, -1] as const).filter((dir) => pos + dir * semis >= 0 && pos + dir * semis < CELLS);
    const dir = pick(directions, rng);
    if (!dir) return null;
    const startNote = startSpellings(pos, keepNote)[0]!;
    const target = pos + dir * semis;
    const targetNote = startSpellings(target)[0]!;
    return {
      kind: "semitone", start: pos, target, dir, num: between(startNote, targetNote).num,
      startNote, targetNote, iv: between(startNote, targetNote), itemKey: item, choices: [], respelled: false,
      presentation: dir === 1 ? "up" : "down", title: `${dir === 1 ? "위로" : "아래로"} ${semis}반음`, sub: "칸 사이를 세요 · 온음은 반음 둘이에요",
    };
  }
  if (category !== "read" && category !== "make" && category !== "ear") return null;
  const iv = intervalFromCode(code);
  if (!iv || iv.semis < 1 || iv.semis > 12) return null;
  const pool = (category === "ear" || category === "make") && iv.semis === 6 ? commonBySemis(6) : [iv];
  const level = options.level ?? (category === "read" ? "L1" : "L2");
  let candidates = makeOptions(pos, startSpellings(pos, keepNote), pool, level);
  if (!candidates.length && keepNote) candidates = makeOptions(pos, startSpellings(pos), pool, level);
  const presentation = options.earPresentation ?? (options.earLevel === 1 ? "up" : undefined);
  if (category === "ear" && presentation && presentation !== "chord") {
    const direction = presentation === "up" ? 1 : -1;
    const preferred = candidates.filter((candidate) => candidate.dir === direction);
    if (preferred.length) candidates = preferred;
  }
  const selected = pick(candidates, rng);
  if (!selected) return null;
  const actualPresentation: Presentation = presentation === "chord" ? "chord" : selected.dir === 1 ? "up" : "down";
  return {
    ...selected, kind: category, start: pos, num: selected.iv.num, itemKey: item,
    title: category === "make" ? `${nameKo(selected.iv)} ${selected.dir === 1 ? "↑" : "↓"}` : category === "read" ? `${noteKo(selected.startNote)} → ${noteKo(selected.targetNote)}` : "소리 승차권",
    sub: category === "make" ? "글자를 세고, 반음 수를 맞추세요" : category === "read" ? "깃발까지 운전하고 음정 이름을 고르세요" : actualPresentation === "chord" ? "두 음을 함께 듣고 이름을 골라요" : "두 음을 듣고 이름을 골라요",
    choices: category === "read" ? choicesFor(selected.iv, rng) : category === "ear" ? earPool(options.earLevel ?? 1).map((candidate) => commonName(candidate.semis)) : [],
    respelled: Boolean(keepNote && !sameNote(keepNote, selected.startNote)), presentation: actualPresentation,
  };
}
export function lettersOf(ticket: Pick<Ticket, "num" | "startNote" | "dir">): string[] {
  return Array.from({ length: ticket.num }, (_, k) => LETTER_KO[natural(dstep(ticket.startNote) + ticket.dir * k).letter]);
}
export function derivation(ticket: Ticket): string {
  if (ticket.kind === "degree") return `${lettersOf(ticket).join("·")} → 흰 역 ${ticket.num}개 = ${ticket.num}도`;
  if (ticket.kind === "semitone") return `${noteKo(ticket.startNote)}→${noteKo(ticket.targetNote)} · 반음 ${Math.abs(ticket.target - ticket.start)}칸`;
  return `${noteKo(ticket.startNote)}→${noteKo(ticket.targetNote)} · 글자 ${ticket.num}개(${lettersOf(ticket).join("·")}) = ${ticket.num}도 · 반음 ${ticket.iv.semis}칸 → ${nameKo(ticket.iv)}`;
}
/** Contextual ruler exposes only this ticket's degree, never the full answer table. */
export function rulerFor(ticket: Ticket): string {
  if (ticket.kind === "degree") return "출발역이 ①이에요. 터널을 지나 흰 역만 세어요.";
  if (ticket.kind === "semitone") return "한 칸 사이가 반음이에요. 온음은 반음 둘이에요.";
  const qualities: Quality[] = ["P", "M", "m", "A", "d"];
  return `${ticket.num}도 — ` + qualities.flatMap((quality) => {
    const offset = qualityOffset(ticket.num, quality);
    if (offset === null) return [];
    const semis = refSemis(ticket.num) + offset;
    return semis >= 0 && semis <= 12 ? [`${nameKo({ num: ticket.num, quality })} ${semis}칸`] : [];
  }).join(", ");
}
