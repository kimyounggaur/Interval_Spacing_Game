import { describe, expect, it } from "vitest";
import { defaultSave } from "../../src/infra/storage";
import { createInitialState, reducer } from "../../src/game/reducer";
import { createTicket } from "../../src/game/generator";
import { earLevel, routeItems, ROUTE_IDS, ROUTES, rngFromSeed } from "../../src/game/planner";
import { nameKo } from "../../src/theory";
import type { Note } from "../../src/theory";

describe("DR5/DR6 seeded route completion audit", () => {
  it("all five routes finish at all listening stages using feasible scheduled-item fallback", () => {
    for (let seed = 0; seed < 100; seed++)
      for (const route of ROUTE_IDS) {
        const save = defaultSave();
        save.settings.tutorialSeen = true;
        save.routes.basic.stars = 1;
        save.routes.ear.stars = 1;
        save.routes.basic.runs = seed % 2;
        const mastered =
          seed % 3 === 0
            ? []
            : seed % 3 === 1
              ? ["M3", "P5", "P8"]
              : ["M3", "P5", "P8", "m2", "M2", "m3", "P4"];
        for (const key of mastered)
          save.mastery[`ear:${key}`] = { box: 1, stamp: 2, seen: 1, clean: 1 };
        let state = reducer(createInitialState(save), { type: "START_RUN", route, seed });
        let completed = 0;
        while (state.screen === "run") {
          const run = state.run!;
          const rng = rngFromSeed(run.seed + run.index * 65537);
          const keep = run.keepNote
            ? ({ letter: run.keepNote[0], acc: run.keepNote[1], octave: run.keepNote[2] } as Note)
            : null;
          const options = {
            earLevel: earLevel(state.save),
            level: route === "basic" ? ("L1" as const) : ("L2" as const),
          };
          const candidateKeys = [...run.plan.slice(run.index), ...routeItems(route, state.save)];
          const ticket = candidateKeys
            .map((key) => createTicket(key, state.pos, keep, rng, options))
            .find(Boolean);
          expect(ticket, `${route} seed=${seed} pos=${state.pos} index=${run.index}`).toBeTruthy();
          state = reducer(state, { type: "ISSUE", ticket: ticket! });
          expect(state.ticket!.target).toBeGreaterThanOrEqual(0);
          expect(state.ticket!.target).toBeLessThanOrEqual(24);
          if (ticket!.kind === "ear") {
            if (!state.earDirectionAnswered)
              state = reducer(state, { type: "EAR_DIRECTION", dir: ticket!.dir });
            state = reducer(state, {
              type: "CHOOSE",
              name: ticket!.iv.semis === 6 ? "증4도/감5도" : nameKo(ticket!.iv),
            });
          } else {
            state = reducer(state, { type: "MOVE", pos: ticket!.target });
            state = reducer(state, { type: "ARRIVE" });
            if (ticket!.kind === "read")
              state = reducer(state, { type: "CHOOSE", name: nameKo(ticket!.iv) });
          }
          expect(state.phase).toBe("verify");
          completed++;
          expect(completed).toBeLessThanOrEqual(ROUTES[route].length);
          state = reducer(state, { type: "NEXT" });
        }
        expect(state.screen).toBe("terminus");
        expect(completed).toBe(ROUTES[route].length);
        expect(state.save.activeRun).toBeNull();
        state = reducer(state, { type: "GO", screen: "routes" });
        expect(state.save.activeRun).toBeNull();
      }
  });
});
