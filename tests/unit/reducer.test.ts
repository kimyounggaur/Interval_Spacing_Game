import { describe, expect, it } from "vitest";
import { defaultSave, sanitizeSave } from "../../src/infra/storage";
import { createTicket } from "../../src/game/generator";
import { createInitialState, reducer, PHASE_TRANSITIONS } from "../../src/game/reducer";
import { nameKo } from "../../src/theory";
import type { GameState } from "../../src/game/types";

function started(item = "deg:3", route: "intro" | "basic" | "full" = "intro"): GameState {
  let state = reducer(createInitialState(), { type: "START_RUN", route, seed: 12 });
  const ticket = createTicket(item, 12, null, () => 0)!;
  state = reducer(state, { type: "ISSUE", ticket });
  return state;
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
  return value;
}
describe("DR3/DR5 pure state machine", () => {
  it("ST-01 invalid phase actions cannot skip arrival or choose before reaching the flag", () => {
    const state = started("read:m3", "basic");
    expect(state.phase).toBe("drive");
    expect(reducer(state, { type: "CHOOSE", name: nameKo(state.ticket!.iv) }).phase).toBe("drive");
    expect(reducer(state, { type: "FINISH", clean: true }).phase).toBe("drive");
    expect(reducer(state, { type: "NEXT" }).run!.index).toBe(0);
    expect(PHASE_TRANSITIONS.fix).toEqual(["drive", "show"]);
  });
  it("ST-02 reducer does not mutate inputs and same input/action gives same output", () => {
    const state = freezeDeep(started());
    const before = JSON.stringify(state);
    const action = { type: "MOVE" as const, pos: 14 };
    expect(reducer(state, action)).toEqual(reducer(state, action));
    expect(JSON.stringify(state)).toBe(before);
  });
  it("ST-03 second wrong arrival offers a demonstration and records a half stamp", () => {
    let state = started();
    state = reducer(state, { type: "ARRIVE" });
    expect(state.phase).toBe("fix");
    state = reducer(state, { type: "RETRY" });
    expect(state.phase).toBe("drive");
    state = reducer(state, { type: "ARRIVE" });
    state = reducer(state, { type: "RETRY" });
    expect(state.phase).toBe("show");
    state = reducer(state, { type: "REVEAL", k: 2 });
    state = reducer(state, { type: "FINISH", clean: false });
    expect(state.phase).toBe("verify");
    expect(state.run!.results).toEqual([1]);
    expect(state.save.mastery["deg:3"]?.stamp).toBe(1);
    expect(reducer(state, { type: "FINISH", clean: false }).save.stats.tickets).toBe(1);
  });
  it("ST-04 read choices are enabled only at the target and a wrong choice stays in judge", () => {
    let state = started("read:m3", "basic");
    state = reducer(state, { type: "ARRIVE" });
    expect(state.phase).toBe("drive");
    state = reducer(state, { type: "MOVE", pos: state.ticket!.target });
    state = reducer(state, { type: "ARRIVE" });
    expect(state.phase).toBe("judge");
    state = reducer(state, { type: "CHOOSE", name: "없는 음정" });
    expect(state.phase).toBe("judge");
    state = reducer(state, { type: "CHOOSE", name: nameKo(state.ticket!.iv) });
    expect(state.phase).toBe("verify");
    expect(state.run!.results).toEqual([1]);
  });
  it("ST-05 save/restore retains correction, position, help, results and counting assistance", () => {
    let state = started("make:m3", "full");
    state = reducer(state, { type: "USE_RULER" });
    state = reducer(state, { type: "CLOSE" });
    state = reducer(state, { type: "ARRIVE" });
    state = reducer(state, { type: "RETRY" });
    state = reducer(state, { type: "MOVE", pos: 14, fpos: 14.1 });
    const saved = sanitizeSave(JSON.parse(JSON.stringify(state.save)) as unknown);
    const restored = reducer(createInitialState(saved), { type: "RESUME_RUN" });
    for (const key of ["ticket", "phase", "pos", "fpos", "mistakes", "rulerUsed", "run"] as const)
      expect(restored[key]).toEqual(state[key]);
    expect(restored.run!.assistOff).toBe(false);
  });
  it("clean completion records full stamp once; next advances and keeps the arrival spelling", () => {
    let state = started();
    const target = state.ticket!.targetNote;
    state = reducer(state, { type: "MOVE", pos: state.ticket!.target });
    state = reducer(state, { type: "ARRIVE" });
    expect(state.phase).toBe("verify");
    expect(state.run!.results).toEqual([2]);
    expect(state.run!.keepNote).toEqual([target.letter, target.acc, target.octave]);
    state = reducer(state, { type: "NEXT" });
    expect(state.run!.index).toBe(1);
    expect(state.phase).toBe("brief");
  });
  it("ISSUE swaps a feasible later item into place through reducer", () => {
    let state = reducer(createInitialState(), { type: "START_RUN", route: "intro", seed: 1 });
    const later = state.run!.plan[3]!;
    state = reducer(state, { type: "ISSUE", ticket: createTicket(later, 12, null, () => 0)! });
    expect(state.run!.plan[0]).toBe(later);
    expect(new Set(state.run!.plan).size).toBe(7);
  });
  it("settings validate types, assistance cannot restore eligibility within the run, tutorial demo does not add progress", () => {
    let state = started();
    state = reducer(state, { type: "SET", key: "volume", value: 99 });
    expect(state.save.settings.volume).toBe(1);
    state = reducer(state, { type: "TOGGLE_ASSIST" });
    expect(state.run!.assistOff).toBe(false);
    state = reducer(state, { type: "TUTORIAL", step: 0 });
    state = reducer(state, { type: "MOVE", pos: state.ticket!.target });
    state = reducer(state, { type: "ARRIVE" });
    expect(state.save.stats.tickets).toBe(0);
    state = reducer(state, { type: "NEXT" });
    expect(state.save.settings.tutorialSeen).toBe(true);
    expect(state.save.activeRun).toBeNull();
    expect(state.run).toBeNull();
  });
  it("locked routes cannot be started", () => {
    const state = reducer(createInitialState(defaultSave()), {
      type: "START_RUN",
      route: "ear",
      seed: 1,
    });
    expect(state.screen).toBe("title");
    expect(state.run).toBeNull();
  });
});

describe("playable tutorial initialization", () => {
  it("START_TUTORIAL enters an isolated single-ticket demonstration", () => {
    const ticket = createTicket("deg:3", 12, null, () => 0)!;
    const state = reducer(createInitialState(), { type: "START_TUTORIAL", ticket });
    expect(state).toMatchObject({
      screen: "run",
      phase: "drive",
      tutorial: 0,
      pos: 12,
      run: { seed: 303, plan: ["deg:3"] },
    });
    expect(state.save.activeRun).toBeNull();
    const arrived = reducer(reducer(state, { type: "MOVE", pos: ticket.target }), {
      type: "ARRIVE",
    });
    expect(arrived.save.mastery).toEqual({});
    expect(arrived.save.stats.tickets).toBe(0);
    expect(arrived.save.activeRun).toBeNull();
  });
});

describe("basic semitone preparation", () => {
  it("two unstamped warmups lead into the unchanged six-ticket basic route", () => {
    let state = reducer(createInitialState(), { type: "START_WARMUP", seed: 808 });
    expect(state).toMatchObject({
      screen: "run",
      phase: "brief",
      tutorial: 10,
      run: { route: "basic", plan: ["semi:1", "semi:2"] },
    });
    expect(state.save.activeRun).toBeNull();
    for (const item of ["semi:1", "semi:2"]) {
      const ticket = createTicket(item, state.pos, null, () => 0)!;
      state = reducer(state, { type: "ISSUE", ticket });
      state = reducer(state, { type: "MOVE", pos: ticket.target });
      state = reducer(state, { type: "ARRIVE" });
      expect(state.phase).toBe("verify");
      expect(state.save.mastery).toEqual({});
      expect(state.save.stats.tickets).toBe(0);
      expect(state.save.activeRun).toBeNull();
      state = reducer(state, { type: "NEXT" });
    }
    expect(state).toMatchObject({
      screen: "run",
      phase: "brief",
      tutorial: null,
      pos: 12,
      run: { route: "basic", seed: 808, index: 0, results: [] },
    });
    expect(state.run!.plan).toEqual([
      "read:M2",
      "read:m2",
      "read:M3",
      "read:m3",
      "read:P4",
      "read:P5",
    ]);
    expect(state.save.activeRun).not.toBeNull();
    expect(state.save.routes.basic.runs).toBe(0);
  });
});
