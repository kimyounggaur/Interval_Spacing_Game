import { rngFromSeed } from "./planner";

/** Preserve the original seeded random/shuffle contract without retaining the old deck. */
export const makeRng = rngFromSeed;
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
