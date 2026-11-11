import { commonBySemis } from "../theory";
import type { Interval } from "../theory";
import type { Mastery, Route, SaveData } from "../infra/storage";

export const ROUTES: Record<
  Route,
  { title: string; subtitle: string; length: number; color: string; landscape: string }
> = {
  intro: {
    title: "입문 노선",
    subtitle: "출발역이 ①, 흰 역으로 도수를 세요",
    length: 7,
    color: "green",
    landscape: "meadow",
  },
  basic: {
    title: "기본 노선",
    subtitle: "글자와 반음을 이어 음정을 읽어요",
    length: 6,
    color: "navy",
    landscape: "village",
  },
  full: {
    title: "완주 노선",
    subtitle: "♯·♭ 이름표로 12가지 음정을 만들어요",
    length: 12,
    color: "yellow",
    landscape: "bridge",
  },
  ear: {
    title: "청음 노선",
    subtitle: "두 음 사이를 귀로 찾아요",
    length: 6,
    color: "red",
    landscape: "tunnel",
  },
  mixed: {
    title: "통합 노선",
    subtitle: "읽기·만들기·듣기를 함께 써요",
    length: 9,
    color: "mixed",
    landscape: "night",
  },
};
export const ROUTE_IDS = Object.keys(ROUTES) as Route[];
export function rngFromSeed(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
export function intervalKey(iv: Interval): string {
  return `${iv.quality}${iv.num}`;
}
export function commonKeys(): string[] {
  return Array.from({ length: 12 }, (_, i) => intervalKey(commonBySemis(i + 1)[0]!));
}
export function earLevel(save: SaveData): 1 | 2 | 3 {
  const first = ["M3", "P5", "P8"];
  const second = [...first, "m2", "M2", "m3", "P4"];
  const clean = (key: string) => save.mastery[`ear:${key}`]?.stamp === 2;
  return second.every(clean) ? 3 : first.every(clean) ? 2 : 1;
}
export function earKeys(level: 1 | 2 | 3): string[] {
  if (level === 1) return ["M3", "P5", "P8"];
  if (level === 2) return ["m2", "M2", "m3", "M3", "P4", "P5", "P8"];
  return commonKeys();
}
export function routeUnlocked(route: Route, save: SaveData): boolean {
  if (route === "ear") return save.routes.basic.stars >= 1;
  if (route === "mixed") return save.routes.basic.stars >= 1 && save.routes.ear.stars >= 1;
  return true;
}
export function routeItems(route: Route, save: SaveData): string[] {
  if (route === "intro") return Array.from({ length: 7 }, (_, i) => `deg:${i + 2}`);
  if (route === "basic") return [...commonKeys(), "d5"].map((key) => `read:${key}`);
  if (route === "full") return commonKeys().map((key) => `make:${key}`);
  if (route === "ear") return earKeys(earLevel(save)).map((key) => `ear:${key}`);
  return [
    ...routeItems("basic", save),
    ...routeItems("full", save),
    ...earKeys(earLevel(save)).map((key) => `ear:${key}`),
  ];
}
function weightedPick(pool: string[], mastery: Record<string, Mastery>, rng: () => number): string {
  const weights = pool.map((key) => [8, 5, 3, 2, 1][mastery[key]?.box ?? 0] ?? 1);
  let threshold = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    threshold -= weights[i]!;
    if (threshold < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}
function choose(
  pool: string[],
  count: number,
  mastery: Record<string, Mastery>,
  rng: () => number,
): string[] {
  if (!pool.length) return [];
  const available = [...pool];
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    if (!available.length) available.push(...pool);
    const selected = weightedPick(available, mastery, rng);
    result.push(selected);
    available.splice(available.indexOf(selected), 1);
  }
  return result;
}
function ordered(items: string[]): string[] {
  const remaining = [...items];
  const result: string[] = [];
  const degree = (key: string) => Number(key.match(/\d+$/)?.[0] ?? 0);
  while (remaining.length) {
    const previous = result[result.length - 1];
    const candidates = [...new Set(remaining)].filter((key) => key !== previous);
    const feasible = candidates.filter((candidate) => {
      const rest = remaining.filter((_, index) => index !== remaining.indexOf(candidate));
      return [...new Set(rest)].every(
        (key) =>
          rest.filter((item) => item === key).length <=
          (key === candidate ? Math.floor(rest.length / 2) : Math.ceil(rest.length / 2)),
      );
    });
    const options = feasible.length ? feasible : candidates.length ? candidates : remaining;
    options.sort((a, b) => {
      const previousMatch = previous?.match(/^([^:]+):([Mm])(\d+)$/);
      const partner = previousMatch
        ? `${previousMatch[1]}:${previousMatch[2] === "M" ? "m" : "M"}${previousMatch[3]}`
        : null;
      const pairedA = a === partner ? 0 : previous && degree(a) === degree(previous) ? 1 : 2;
      const pairedB = b === partner ? 0 : previous && degree(b) === degree(previous) ? 1 : 2;
      return pairedA - pairedB || degree(a) - degree(b) || a.localeCompare(b);
    });
    const selected = options[0]!;
    result.push(selected);
    remaining.splice(remaining.indexOf(selected), 1);
  }
  return result;
}
function planPool(
  pool: string[],
  count: number,
  mastery: Record<string, Mastery>,
  rng: () => number,
): string[] {
  const unseen = pool.filter((key) => mastery[key]?.stamp !== 2);
  const review = pool.filter((key) => mastery[key]?.stamp === 2);
  const freshCount = Math.min(Math.ceil((count * 2) / 3), unseen.length);
  const selected = choose(unseen, freshCount, mastery, rng);
  const reviewCount = Math.min(count - selected.length, review.length);
  selected.push(...choose(review, reviewCount, mastery, rng));
  while (selected.length < count) {
    const remaining = pool.filter((key) => !selected.includes(key));
    selected.push(
      ...choose(
        remaining.length ? remaining : pool,
        Math.min(count - selected.length, remaining.length || pool.length),
        mastery,
        rng,
      ),
    );
  }
  return ordered(selected);
}
export function planRun(route: Route, seed: number, save: SaveData): string[] {
  const rng = rngFromSeed(seed);
  if (route === "basic" && save.routes.basic.runs === 0)
    return ["read:M2", "read:m2", "read:M3", "read:m3", "read:P4", "read:P5"];
  if (route === "mixed")
    return ordered(
      (["basic", "full", "ear"] as const).flatMap((part) =>
        planPool(routeItems(part, save), 3, save.mastery, rng),
      ),
    );
  return planPool(routeItems(route, save), ROUTES[route].length, save.mastery, rng);
}
export function applyMastery(
  mastery: Record<string, Mastery>,
  key: string,
  stamp: 1 | 2,
): Record<string, Mastery> {
  if (key.startsWith("semi:")) return mastery;
  const prev = mastery[key] ?? { box: 0, stamp: 0, seen: 0, clean: 0 };
  const box = Math.max(0, Math.min(4, prev.box + (stamp === 2 ? 1 : -1))) as Mastery["box"];
  return {
    ...mastery,
    [key]: {
      box,
      stamp: Math.max(prev.stamp, stamp) as Mastery["stamp"],
      seen: prev.seen + 1,
      clean: prev.clean + (stamp === 2 ? 1 : 0),
    },
  };
}
export function runStars(results: readonly (1 | 2)[], assistOff: boolean): 0 | 1 | 2 | 3 {
  if (!results.length) return 0;
  const clean = results.filter((result) => result === 2).length;
  if (clean === results.length && assistOff) return 3;
  return clean >= Math.ceil(results.length * 0.8) ? 2 : 1;
}
export function routeMastered(route: Route, save: SaveData): boolean {
  return routeItems(route, save).every((key) => save.mastery[key]?.stamp === 2);
}
