import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioPort } from "../../src/audio/engine";
import { createEffects } from "../../src/game/effects";
import { createInitialState, reducer } from "../../src/game/reducer";
import type { Action, GameState, Route } from "../../src/game/types";
import { defaultSave, MemoryStorage } from "../../src/infra/storage";
import { nameKo } from "../../src/theory";

function harness(initial?: GameState) {
  const save = defaultSave();
  save.routes.basic.stars = 1;
  save.routes.ear.stars = 1;
  save.settings.motion = "full";
  let state = initial ?? createInitialState(save);
  const audio = {
    state: "running",
    running: true,
    unlock: vi.fn(async () => true),
    setSettings: vi.fn(),
    playTick: vi.fn(),
    playStart: vi.fn(),
    playInterval: vi.fn(),
    playEar: vi.fn(),
    playMelody: vi.fn(),
    sfx: vi.fn(),
    cancel: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(),
  } satisfies AudioPort;
  const storage = new MemoryStorage();
  const write = vi.spyOn(storage, "write");
  const dispatch = (action: Action): void => {
    const previous = state;
    state = reducer(state, action);
    effects.run(previous, action, state);
  };
  const effects = createEffects({ audio, storage, dispatch, getState: () => state });
  return { dispatch, audio, storage, write, effects, getState: () => state };
}
function solve(game: ReturnType<typeof harness>): void {
  const state = game.getState();
  const ticket = state.ticket!;
  if (ticket.kind === "ear") {
    if (!state.earDirectionAnswered) game.dispatch({ type: "EAR_DIRECTION", dir: ticket.dir });
    game.dispatch({
      type: "CHOOSE",
      name: ticket.iv.semis === 6 ? "증4도/감5도" : nameKo(ticket.iv),
    });
  } else {
    game.dispatch({ type: "MOVE", pos: ticket.target });
    game.dispatch({ type: "ARRIVE" });
    if (ticket.kind === "read") game.dispatch({ type: "CHOOSE", name: nameKo(ticket.iv) });
  }
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("DR4–DR6 controller effects", () => {
  it("E-03 keeps the immutable departure for arrival audio and cancels stale reveal timers on NEXT", async () => {
    vi.useFakeTimers();
    const game = harness();
    game.dispatch({ type: "START_RUN", route: "full", seed: 12 });
    await Promise.resolve();
    const ticket = game.getState().ticket!;
    solve(game);
    expect(game.audio.playInterval).toHaveBeenLastCalledWith(
      48 + ticket.start,
      48 + ticket.target,
      0.25 + Math.abs(ticket.target - ticket.start) * 0.06,
    );
    expect(game.getState().pos).toBe(ticket.target);
    game.dispatch({ type: "NEXT" });
    const nextTicket = game.getState().ticket;
    vi.advanceTimersByTime(3000);
    expect(game.getState().ticket).toBe(nextTicket);
    expect(game.getState().phase).toBe("drive");
    expect(game.getState().reveal).toBe(0);
  });

  it("ST-03 pauses a second-error proof behind a modal and stamps exactly once after resuming", () => {
    vi.useFakeTimers();
    const game = harness();
    game.dispatch({ type: "START_RUN", route: "intro", seed: 7 });
    game.dispatch({ type: "ARRIVE" });
    game.dispatch({ type: "RETRY" });
    game.dispatch({ type: "ARRIVE" });
    game.dispatch({ type: "RETRY" });
    expect(game.getState().phase).toBe("show");
    vi.advanceTimersByTime(120);
    const pausedPosition = game.getState().pos;
    game.dispatch({ type: "OPEN", modal: "pause" });
    vi.advanceTimersByTime(5000);
    expect(game.getState().phase).toBe("show");
    expect(game.getState().pos).toBe(pausedPosition);
    game.dispatch({ type: "CLOSE" });
    vi.advanceTimersByTime(5000);
    expect(game.getState().phase).toBe("verify");
    expect(game.getState().run?.results).toEqual([1]);
    expect(game.getState().save.stats.tickets).toBe(1);
  });

  it("tutorial setup and completion never save a rehearsal run or change learning statistics", async () => {
    vi.useFakeTimers();
    const game = harness();
    game.dispatch({ type: "START_RUN", route: "intro", seed: 3 });
    game.dispatch({ type: "TUTORIAL", step: 3 });
    await Promise.resolve();
    expect(game.write).not.toHaveBeenCalled();
    solve(game);
    expect(game.getState().save.stats.tickets).toBe(0);
    game.dispatch({ type: "NEXT" });
    await Promise.resolve();
    expect(game.storage.read().activeRun).toBeNull();
    expect(game.storage.read().settings.tutorialSeen).toBe(true);
    expect(game.storage.read().stats.tickets).toBe(0);
  });

  it("E-12 resumes a partially revealed verified ticket without another stamp or mastery increment", () => {
    vi.useFakeTimers();
    const original = harness();
    original.dispatch({ type: "START_RUN", route: "intro", seed: 12 });
    solve(original);
    vi.advanceTimersByTime(60);
    original.effects.flush();
    const saved = original.storage.read();
    original.dispatch({ type: "GO", screen: "routes" });
    const resumed = harness(createInitialState(saved));
    resumed.dispatch({ type: "RESUME_RUN" });
    vi.advanceTimersByTime(2000);
    expect(resumed.getState().phase).toBe("verify");
    expect(resumed.getState().run?.results).toEqual([2]);
    expect(resumed.getState().save.stats.tickets).toBe(1);
    expect(resumed.audio.sfx).not.toHaveBeenCalledWith("stamp");
  });

  it("every route completes its fixed number of feasible tickets while staying in the MIDI range", () => {
    vi.useFakeTimers();
    for (const route of [
      "intro",
      "basic",
      "full",
      "ear",
      "mixed",
    ] as const satisfies readonly Route[]) {
      const game = harness();
      game.dispatch({ type: "START_RUN", route, seed: 1327 });
      const length = game.getState().run!.plan.length;
      for (let i = 0; i < length; i += 1) {
        const ticket = game.getState().ticket!;
        expect(ticket.target).toBeGreaterThanOrEqual(0);
        expect(ticket.target).toBeLessThanOrEqual(24);
        expect(Math.abs(ticket.target - ticket.start)).toBeLessThanOrEqual(12);
        solve(game);
        expect(game.getState().phase).toBe("verify");
        game.dispatch({ type: "NEXT" });
      }
      expect(game.getState().screen).toBe("terminus");
      expect(game.getState().run?.results).toHaveLength(length);
    }
  });
});
