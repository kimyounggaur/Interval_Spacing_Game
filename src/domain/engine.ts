import { BOARD, WHITE_CELLS } from "./data";
import type { Card, Direction, GreenCard, Mode } from "./data";

export type MovePlan = {
  originalFrom: number;
  from: number;
  target: number;
  transfers: number[];
};

export function greenTarget(startIdx: number, degree: number, dir: Direction): number | null {
  const whiteIndex = (WHITE_CELLS as readonly number[]).indexOf(startIdx);
  if (whiteIndex < 0) return null;
  const targetWhiteIndex = whiteIndex + dir * (degree - 1);
  if (targetWhiteIndex < 0 || targetWhiteIndex >= WHITE_CELLS.length) return null;
  return WHITE_CELLS[targetWhiteIndex] ?? null;
}

export function planMove(pos: number, delta: number): MovePlan {
  if (!Number.isInteger(pos) || pos < 0 || pos > 24)
    throw new RangeError("pos는 0~24 정수여야 합니다");
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 12)
    throw new RangeError("delta는 -12~-1 또는 1~12 정수여야 합니다");
  const direct = pos + delta;
  if (direct >= 0 && direct <= 24)
    return { originalFrom: pos, from: pos, target: direct, transfers: [] };

  const candidates: number[] = [];
  for (let candidate = pos % 12; candidate <= 24; candidate += 12) {
    if (candidate !== pos) candidates.push(candidate);
  }
  const alternate = delta > 0 ? Math.min(...candidates) : Math.max(...candidates);
  const afterTransfer = alternate + delta;
  if (afterTransfer >= 0 && afterTransfer <= 24)
    return { originalFrom: pos, from: alternate, target: afterTransfer, transfers: [alternate] };

  const centerTarget = 12 + delta;
  if (centerTarget < 0 || centerTarget > 24) throw new Error("중앙 도 환승 불변식 위반");
  return { originalFrom: pos, from: 12, target: centerTarget, transfers: [alternate, 12] };
}

export function redMoveTarget(pos: number, semi: number): number {
  return pos + semi <= 24 ? pos + semi : pos - semi;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function directionLabel(dir: Direction): string {
  return dir > 0 ? "상행" : "하행";
}

export function diagnoseGreen(start: number, selected: number, target: number | null): string {
  if (target === null) return "같이 다시 세어 볼까요?";
  if (selected === target + 1 || selected === target - 1)
    return "출발역도 정거장이에요! 도수는 출발음부터 1로 세요.";
  if (BOARD[selected]?.isWhite === false) return "초록 카드에서 검은 터널은 세지 않아요 — 통과!";
  if (Math.abs(selected - start) > Math.abs(target - start))
    return "출발음부터 하나씩, 흰건반만 세어 보세요.";
  return "같이 다시 세어 볼까요?";
}

export function diagnoseYellow(selected: number, target: number, semi: number): string {
  const selectedDistance = Math.abs(selected - target);
  if (selectedDistance === 1) return "장과 단의 차이는 반음 하나!";
  if ((selected - target) % 2 === 0 && Math.abs(selected - target) <= 4)
    return "반음 세기에서는 모든 칸이 한 정거장!";
  if (Math.abs(selected - target) === semi - 1) return "반음은 검은건반도 포함해 하나씩 세어요.";
  return "출발점에서 반음 칸을 다시 세어 볼까요?";
}

export type Notebook = {
  greenDegrees: number[];
  yellow: number[];
  red: number[];
  redAux: number[];
};

export function emptyNotebook(): Notebook {
  return { greenDegrees: [], yellow: [], red: [], redAux: [] };
}

export function addUnique(values: readonly number[], value: number): number[] {
  return values.includes(value) ? [...values] : [...values, value].sort((a, b) => a - b);
}

export function mergeNotebook(persistent: Notebook, round: Notebook): Notebook {
  const red = [...new Set([...persistent.red, ...round.red])].sort((a, b) => a - b);
  const redAux =
    red.length > 0
      ? [...new Set([...persistent.redAux, ...round.redAux])]
          .filter((semi) => !red.includes(semi))
          .sort((a, b) => a - b)
      : [...new Set([...persistent.redAux, ...round.redAux])].sort((a, b) => a - b);
  return {
    greenDegrees: [...new Set([...persistent.greenDegrees, ...round.greenDegrees])].sort(
      (a, b) => a - b,
    ),
    yellow: [...new Set([...persistent.yellow, ...round.yellow])].sort((a, b) => a - b),
    red,
    redAux,
  };
}

export function isModeClear(mode: Mode, notebook: Notebook): boolean {
  if (mode === "intro")
    return [2, 3, 4, 5].every((degree) => notebook.greenDegrees.includes(degree));
  if (mode === "basic") return notebook.yellow.length >= 6;
  if (mode === "full") return notebook.yellow.length >= 12;
  if (mode === "ear") return notebook.red.length >= 6;
  return notebook.yellow.length >= 6 && notebook.red.length >= 3;
}

export function modeProgress(mode: Mode, notebook: Notebook): { current: number; total: number } {
  if (mode === "intro")
    return {
      current: notebook.greenDegrees.filter((degree) => [2, 3, 4, 5].includes(degree)).length,
      total: 4,
    };
  if (mode === "basic") return { current: Math.min(notebook.yellow.length, 6), total: 6 };
  if (mode === "full") return { current: Math.min(notebook.yellow.length, 12), total: 12 };
  if (mode === "ear") return { current: Math.min(notebook.red.length, 6), total: 6 };
  return {
    current: Math.min(notebook.yellow.length, 6) + Math.min(notebook.red.length, 3),
    total: 9,
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

export function cardForMode(card: Card, mode: Mode): boolean {
  return mode === "mixed"
    ? card.type === "yellow" || card.type === "red"
    : card.type === cardTypeForMode(mode);
}

function cardTypeForMode(mode: Mode): Card["type"] {
  if (mode === "intro") return "green";
  if (mode === "basic" || mode === "full") return "yellow";
  return "red";
}

export function asGreen(card: Card): GreenCard | null {
  return card.type === "green" ? card : null;
}
