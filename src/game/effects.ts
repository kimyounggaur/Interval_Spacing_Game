import type { AudioPort } from "../audio/engine";
import type { StoragePort } from "../infra/storage";
import type { Note } from "../theory";
import { isWhitePc } from "../theory";
import { BASE, createTicket } from "./generator";
import type { GeneratorOptions } from "./generator";
import { earLevel, rngFromSeed, routeItems } from "./planner";
import type { Action, GameState, Ticket } from "./types";

type EffectPorts = {
  audio: AudioPort;
  storage: StoragePort;
  dispatch: (action: Action) => void;
  getState: () => GameState;
};

/** Side effects live here; every gameplay change returns through dispatch. */
export function createEffects({ audio, storage, dispatch, getState }: EffectPorts): {
  run(prev: GameState, action: Action, next: GameState): void;
  flush(): void;
} {
  let animationToken = 0;
  const animationTimers = new Set<ReturnType<typeof setTimeout>>();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let queuedSave = false;
  let saveToken = 0;

  function persist(): void {
    const state = getState();
    if (state.tutorial === null) storage.write(state.save);
  }
  function flush(): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = null;
    queuedSave = false;
    saveToken += 1;
    persist();
  }
  function saveSoon(debounce: boolean): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = null;
    if (debounce) {
      saveTimer = setTimeout(() => {
        saveTimer = null;
        persist();
      }, 150);
      return;
    }
    if (queuedSave) return;
    queuedSave = true;
    const token = saveToken;
    // Persist the final state of an input event, including synchronous ISSUE/tutorial actions.
    queueMicrotask(() => {
      if (token !== saveToken) return;
      queuedSave = false;
      persist();
    });
  }
  function cancelAnimation(): void {
    animationToken += 1;
    for (const timer of animationTimers) clearTimeout(timer);
    animationTimers.clear();
  }
  function reduced(state: GameState): boolean {
    return (
      state.save.settings.motion === "reduced" ||
      (state.save.settings.motion === "system" &&
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches)
    );
  }
  function animate(state: GameState): void {
    cancelAnimation();
    const ticket = state.ticket;
    if (!ticket || state.screen !== "run" || state.modal) return;
    if (
      state.phase !== "show" &&
      state.phase !== "verify" &&
      !(state.phase === "judge" && ticket.kind === "read")
    )
      return;
    const token = animationToken;
    const phase = state.phase;
    const distance = Math.abs(ticket.target - ticket.start);
    const already = Math.min(distance, state.reveal);
    const step = phase === "show" ? 120 : 60;
    const active = (): boolean => {
      const current = getState();
      return (
        token === animationToken &&
        current.screen === "run" &&
        !current.modal &&
        current.ticket === ticket &&
        current.phase === phase
      );
    };
    if (reduced(state)) {
      if (already < distance) dispatch({ type: "REVEAL", k: distance });
      if (phase === "show" && active()) dispatch({ type: "FINISH", clean: false });
      return;
    }
    // Proof tones are all reserved now, never chained from animation timers.
    if (phase === "show") {
      audio.cancel("interval");
      audio.cancel("tick");
      for (let k = already + 1; k <= distance; k += 1) {
        const cell = ticket.start + ticket.dir * k;
        audio.playTick(
          BASE + cell,
          ((k - already) * step) / 1000,
          ticket.kind === "degree" && !isWhitePc(BASE + cell),
        );
      }
    }
    const later = (delay: number, callback: () => void): void => {
      const timer = setTimeout(() => {
        animationTimers.delete(timer);
        if (active()) callback();
      }, delay);
      animationTimers.add(timer);
    };
    for (let k = already + 1; k <= distance; k += 1) {
      later((k - already) * step, () => dispatch({ type: "REVEAL", k }));
    }
    if (phase === "show") {
      later((distance - already) * step + 380, () => dispatch({ type: "FINISH", clean: false }));
    }
  }
  function issue(state: GameState): void {
    const run = state.run;
    if (!run || state.phase !== "brief" || state.screen !== "run" || state.modal) return;
    const tuple = run.keepNote;
    const keep: Note | null = tuple
      ? {
          letter: tuple[0] as Note["letter"],
          acc: tuple[1] as Note["acc"],
          octave: tuple[2],
        }
      : null;
    const rng = rngFromSeed(run.seed + run.index);
    const stage = earLevel(state.save);
    const presentation =
      stage === 1
        ? "up"
        : stage === 2
          ? run.index % 2 === 0
            ? "up"
            : "down"
          : (["up", "down", "chord"] as const)[run.index % 3];
    const planned = run.plan.slice(run.index);
    const fallback = routeItems(run.route, state.save);
    const previous = run.index > 0 ? run.plan[run.index - 1] : null;
    const candidates = [...new Set([...planned, ...fallback])];
    // Try the remaining plan before any route fallback; avoid consecutive repeats where feasible.
    const ordered = [
      ...candidates.filter((item) => item !== previous),
      ...candidates.filter((item) => item === previous),
    ];
    for (const item of ordered) {
      const options: GeneratorOptions = {
        earLevel: stage,
        earPresentation: presentation,
        level: run.route === "mixed" || !item.startsWith("read:") ? "L2" : "L1",
      };
      const ticket = createTicket(item, state.pos, keep, rng, options);
      if (ticket) {
        dispatch({ type: "ISSUE", ticket });
        return;
      }
    }
    // This indicates an invariant failure, rather than silently issuing an impossible ticket.
    throw new Error("지금 역에서 출발할 수 있는 승차권이 없어요.");
  }
  function onTicket(ticket: Ticket): void {
    void audio.unlock().then((ready) => {
      const current = getState();
      if (!ready || current.ticket !== ticket || current.screen !== "run" || current.modal) return;
      if (ticket.kind === "ear")
        audio.playEar(
          BASE + ticket.start,
          BASE + ticket.target,
          ticket.presentation === "chord" ? "chord" : "melody",
        );
      else audio.playStart(BASE + ticket.start);
    });
  }
  function vibrate(enabled: boolean): void {
    if (!enabled || typeof navigator === "undefined" || typeof navigator.vibrate !== "function")
      return;
    try {
      navigator.vibrate(8);
    } catch {
      /* Vibration is an optional device capability. */
    }
  }

  audio.setSettings(getState().save.settings);
  return {
    flush,
    run(prev, action, next): void {
      if (prev.save.settings !== next.save.settings) audio.setSettings(next.save.settings);
      const visible = next.screen === "run" && !next.modal;
      const wasVisible = prev.screen === "run" && !prev.modal;
      const boundary =
        next.ticket !== prev.ticket || next.phase !== prev.phase || visible !== wasVisible;
      if (boundary) {
        cancelAnimation();
        audio.cancel("interval");
        audio.cancel("tick");
        if (!visible) audio.cancel();
      }
      if (visible && boundary) animate(next);

      if (
        action.type === "MOVE" &&
        visible &&
        prev.phase === "drive" &&
        next.phase === "drive" &&
        prev.pos !== next.pos
      ) {
        const direction = next.pos > prev.pos ? 1 : -1;
        const distance = Math.abs(next.pos - prev.pos);
        for (let k = 1; k <= distance; k += 1) {
          const cell = prev.pos + direction * k;
          audio.playTick(
            BASE + cell,
            Math.min((k - 1) * 0.045, 0.3),
            next.ticket?.kind === "degree" && !isWhitePc(BASE + cell),
          );
        }
        vibrate(next.save.settings.vibration);
      }
      if (action.type === "ISSUE" && next.ticket && visible) onTicket(next.ticket);
      if (
        visible &&
        next.phase === "verify" &&
        prev.phase !== "verify" &&
        action.type !== "RESUME_RUN" &&
        next.ticket
      ) {
        audio.sfx("stamp");
        const departure = prev.ticket?.start ?? next.ticket.start;
        const distance = Math.abs(next.ticket.target - departure);
        audio.playInterval(
          BASE + departure,
          BASE + next.ticket.target,
          0.25 + (reduced(next) ? 0 : distance * 0.06),
        );
      }
      if (
        visible &&
        (next.mistakes > prev.mistakes ||
          (action.type === "ARRIVE" &&
            prev.ticket?.kind === "read" &&
            prev.pos !== prev.ticket.target))
      ) {
        audio.sfx("wrong");
      }
      if (visible && action.type === "EAR_PLAY" && next.ticket?.kind === "ear") {
        audio.playEar(
          BASE + next.ticket.start,
          BASE + next.ticket.target,
          next.ticket.presentation === "chord" ? "chord" : "melody",
        );
      }
      if (
        visible &&
        next.phase === "drive" &&
        (action.type === "RETRY" || action.type === "EAR_HUNT") &&
        next.ticket
      ) {
        audio.playStart(BASE + next.ticket.start);
      }
      if (action.type === "RESET") {
        cancelAnimation();
        audio.cancel();
        storage.clear();
      }
      if (next.phase === "brief" && next.screen === "run" && next.run && !next.modal) issue(next);
      if (next.save !== prev.save || action.type === "RESET") {
        saveSoon(action.type === "MOVE" || action.type === "REVEAL");
      }
    },
  };
}
