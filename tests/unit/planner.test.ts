import { describe, expect, it } from "vitest";
import { defaultSave } from "../../src/infra/storage";
import {
  applyMastery,
  commonKeys,
  earLevel,
  planRun,
  ROUTES,
  ROUTE_IDS,
  routeItems,
  routeMastered,
  routeUnlocked,
  runStars,
} from "../../src/game/planner";

describe("DR5 deterministic route planning", () => {
  it("RN-01 has fixed route length and the mixed route has three of each kind", () => {
    const save = defaultSave();
    for (const route of ROUTE_IDS)
      expect(planRun(route, 10, save)).toHaveLength(ROUTES[route].length);
    const mixed = planRun("mixed", 10, save);
    for (const kind of ["read:", "make:", "ear:"])
      expect(mixed.filter((key) => key.startsWith(kind))).toHaveLength(3);
    expect(planRun("basic", 1, save)).toEqual([
      "read:M2",
      "read:m2",
      "read:M3",
      "read:m3",
      "read:P4",
      "read:P5",
    ]);
  });
  it("RN-02 allocates two thirds to unmastered items and reviews mastered items", () => {
    const save = defaultSave();
    save.routes.basic.runs = 1;
    for (const key of routeItems("basic", save).slice(0, 7))
      save.mastery[key] = { box: 4, stamp: 2, seen: 3, clean: 3 };
    const plan = planRun("basic", 10, save);
    expect(plan.filter((key) => save.mastery[key]?.stamp !== 2)).toHaveLength(4);
    expect(plan.filter((key) => save.mastery[key]?.stamp === 2)).toHaveLength(2);
  });
  it("RN-03 the same seed gives the same plan", () => {
    const save = defaultSave();
    save.routes.basic.runs = 1;
    expect(planRun("basic", 1234, save)).toEqual(planRun("basic", 1234, save));
    const variants = new Set(
      Array.from({ length: 20 }, (_, seed) => JSON.stringify(planRun("basic", seed, save))),
    );
    expect(variants.size).toBeGreaterThan(1);
  });
  it("RN-04 boxes stay between zero and four, full stamps persist through corrections", () => {
    let mastery = defaultSave().mastery;
    for (let i = 0; i < 9; i++) mastery = applyMastery(mastery, "read:m3", 2);
    expect(mastery["read:m3"]).toEqual({ box: 4, stamp: 2, seen: 9, clean: 9 });
    for (let i = 0; i < 9; i++) mastery = applyMastery(mastery, "read:m3", 1);
    expect(mastery["read:m3"]).toEqual({ box: 0, stamp: 2, seen: 18, clean: 9 });
    expect(applyMastery(mastery, "semi:1", 2)).toBe(mastery);
  });
  it("RN-05 stars use this run clean stamps and counting assistance", () => {
    expect(runStars([], false)).toBe(0);
    expect(runStars([2, 2, 2, 2, 2, 2, 2], true)).toBe(3);
    expect(runStars([2, 2, 2, 2, 2, 2, 2], false)).toBe(2);
    expect(runStars([2, 2, 2, 2, 2, 2, 1], true)).toBe(2);
    expect(runStars([2, 2, 2, 2, 2, 1, 1], true)).toBe(1);
  });
  it("RN-06 no consecutive identical items, adjacent major/minor partners when selected", () => {
    const save = defaultSave();
    save.routes.basic.runs = 1;
    for (let seed = 0; seed < 100; seed++)
      for (const route of ROUTE_IDS) {
        const plan = planRun(route, seed, save);
        expect(
          plan.every((key, i) => i === 0 || plan[i - 1] !== key),
          `${route} ${seed}: ${plan.join(",")}`,
        ).toBe(true);
      }
    const full = planRun("full", 10, save);
    for (const degree of [2, 3, 6, 7])
      expect(Math.abs(full.indexOf(`make:M${degree}`) - full.indexOf(`make:m${degree}`))).toBe(1);
  });
  it("DR6 unlocks listening stages and route gates from earned full stamps", () => {
    const save = defaultSave();
    expect(routeUnlocked("ear", save)).toBe(false);
    expect(routeUnlocked("mixed", save)).toBe(false);
    save.routes.basic.stars = 1;
    expect(routeUnlocked("ear", save)).toBe(true);
    save.routes.ear.stars = 1;
    expect(routeUnlocked("mixed", save)).toBe(true);
    expect(earLevel(save)).toBe(1);
    for (const key of ["M3", "P5", "P8"])
      save.mastery[`ear:${key}`] = { box: 1, stamp: 2, seen: 1, clean: 1 };
    expect(earLevel(save)).toBe(2);
    for (const key of ["m2", "M2", "m3", "P4"])
      save.mastery[`ear:${key}`] = { box: 1, stamp: 2, seen: 1, clean: 1 };
    expect(earLevel(save)).toBe(3);
    expect(commonKeys()).toHaveLength(12);
    expect(routeMastered("ear", save)).toBe(false);
  });
});
