import { between, nameKo, noteKo, midiOf } from "../theory";
import { defaultSave } from "../infra/storage";
import type { StoredRun } from "../infra/storage";
import type { Action, GameState, Ticket, Phase } from "./types";
import { applyMastery, earLevel, planRun, routeUnlocked, runStars } from "./planner";

export const PHASE_TRANSITIONS: Record<Phase, readonly Phase[]> = {
  brief: ["drive", "judge"],
  drive: ["fix", "judge", "verify"],
  judge: ["judge", "drive", "verify"],
  fix: ["drive", "show"],
  show: ["show", "verify"],
  verify: ["brief"],
};
export function createInitialState(save = defaultSave()): GameState {
  return {
    save,
    screen: "title",
    run: null,
    ticket: null,
    phase: "brief",
    pos: 12,
    fpos: 12,
    mistakes: 0,
    rulerUsed: false,
    hunt: false,
    earDirectionAnswered: false,
    replays: 0,
    reveal: 0,
    message: "",
    modal: null,
    tutorial: null,
  };
}
function freshTicket(state: GameState): GameState {
  return {
    ...state,
    ticket: null,
    phase: "brief",
    mistakes: 0,
    rulerUsed: false,
    hunt: false,
    earDirectionAnswered: false,
    replays: 0,
    reveal: 0,
    message: "",
    modal: null,
  };
}
function stampTicket(state: GameState, clean: boolean): GameState {
  if (!state.run || !state.ticket || state.run.results.length > state.run.index) return state;
  const stamp = clean && state.mistakes === 0 && !state.rulerUsed && !state.hunt ? 2 : 1;
  const ticket = state.ticket;
  const run: StoredRun = {
    ...state.run,
    pos: ticket.target,
    keepNote: [ticket.targetNote.letter, ticket.targetNote.acc, ticket.targetNote.octave],
    results: [...state.run.results, stamp],
    melody: [...(state.run.melody ?? [48 + ticket.start]), 48 + ticket.target],
  };
  const completed = run.results.filter((result) => result === 2).length;
  const save =
    state.tutorial !== null
      ? state.save
      : {
          ...state.save,
          mastery: applyMastery(state.save.mastery, ticket.itemKey, stamp),
          stats: {
            ...state.save.stats,
            tickets: state.save.stats.tickets + 1,
            clean: state.save.stats.clean + (stamp === 2 ? 1 : 0),
            bestStreak: Math.max(state.save.stats.bestStreak, longestStreak(run.results)),
          },
        };
  const iv = between(ticket.startNote, ticket.targetNote);
  const derivation =
    ticket.kind === "degree"
      ? `${noteKo(ticket.startNote)} → ${noteKo(ticket.targetNote)} · 흰 역 ${ticket.num}개 = ${ticket.num}도예요.`
      : `${noteKo(ticket.startNote)} → ${noteKo(ticket.targetNote)} · 글자 ${iv.num}개 = ${iv.num}도 · 반음 ${iv.semis}칸 → ${nameKo(iv)}`;
  return {
    ...state,
    save,
    run,
    pos: ticket.target,
    fpos: ticket.target,
    phase: "verify",
    reveal: 0,
    message: `${stamp === 2 ? "●" : "◐"} ${derivation} (${completed}/${run.results.length})`,
  };
}
function longestStreak(results: readonly number[]): number {
  let best = 0;
  let current = 0;
  for (const result of results) {
    current = result === 2 ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}
function diagnostic(ticket: Ticket, pos: number): string {
  const delta = pos - ticket.start;
  if (delta && Math.sign(delta) !== ticket.dir) return "방향이 반대예요. 화살표를 다시 보세요.";
  if (ticket.kind === "degree") {
    if (
      Math.abs(pos - ticket.target) <= 2 &&
      Math.abs(delta) > Math.abs(ticket.target - ticket.start)
    )
      return "한 역 더 갔어요. 출발역이 ①이에요.";
    if (Math.abs(delta) === ticket.num || Math.abs(delta) === ticket.num - 1)
      return "터널(검은건반)까지 셌어요. 도수는 흰 역만 세요.";
    return "출발역을 ①로 놓고 흰 역을 하나씩 세어 보세요.";
  }
  const naturalTarget = midiOf({ ...ticket.targetNote, acc: 0 }) - 48;
  if (pos === naturalTarget)
    return `글자(${noteKo({ ...ticket.targetNote, acc: 0 })})는 맞았어요. 이제 반음 수를 맞추세요.`;
  if (Math.abs(pos - ticket.target) === 1)
    return "반음 하나 차이예요. 장·단(또는 완전)을 다시 확인하세요.";
  return `먼저 글자를 ${ticket.num}개 세어 도착할 글자를 찾으세요.`;
}
function checkpoint(state: GameState): GameState {
  if (state.tutorial !== null) return { ...state, save: { ...state.save, activeRun: null } };
  if (
    !state.run ||
    state.screen === "terminus" ||
    (state.run.results.length === state.run.plan.length && state.save.activeRun === null)
  )
    return state;
  const run: StoredRun = {
    ...state.run,
    pos: state.pos,
    checkpoint: {
      ticket: state.ticket,
      phase: state.phase,
      mistakes: state.mistakes,
      rulerUsed: state.rulerUsed,
      hunt: state.hunt,
      earDirectionAnswered: state.earDirectionAnswered,
      replays: state.replays,
      reveal: state.reveal,
      message: state.message,
      fpos: state.fpos,
    },
  };
  return { ...state, run, save: { ...state.save, activeRun: run } };
}
function validTicket(value: unknown): value is Ticket {
  if (!value || typeof value !== "object") return false;
  const t = value as Partial<Ticket>;
  const validNote = (note: unknown): boolean => {
    if (!note || typeof note !== "object") return false;
    const n = note as Record<string, unknown>;
    return (
      typeof n.letter === "number" &&
      Number.isInteger(n.letter) &&
      n.letter >= 0 &&
      n.letter <= 6 &&
      typeof n.acc === "number" &&
      Number.isInteger(n.acc) &&
      n.acc >= -2 &&
      n.acc <= 2 &&
      typeof n.octave === "number" &&
      Number.isInteger(n.octave) &&
      n.octave >= 2 &&
      n.octave <= 6
    );
  };
  if (!(
    ["degree", "semitone", "read", "make", "ear"].includes(t.kind ?? "") &&
    Number.isInteger(t.start) &&
    Number.isInteger(t.target) &&
    t.start! >= 0 &&
    t.start! <= 24 &&
    t.target! >= 0 &&
    t.target! <= 24 &&
    Math.abs(t.target! - t.start!) <= 12 &&
    (t.dir === 1 || t.dir === -1) &&
    typeof t.itemKey === "string" &&
    validNote(t.startNote) &&
    validNote(t.targetNote) &&
    !!t.iv &&
    ["P", "M", "m", "A", "d", "AA", "dd"].includes(t.iv.quality) &&
    Number.isInteger(t.iv.num) &&
    Number.isInteger(t.iv.semis) &&
    Array.isArray(t.choices) &&
    t.choices.every((choice) => typeof choice === "string") &&
    typeof t.title === "string" &&
    typeof t.sub === "string" &&
    ["up", "down", "chord"].includes(t.presentation ?? "")
  ))
    return false;
  return (
    midiOf(t.startNote!) === 48 + t.start! &&
    midiOf(t.targetNote!) === 48 + t.target! &&
    t.iv.semis === Math.abs(t.target! - t.start!) &&
    t.num === t.iv.num
  );
}
export function reducer(state: GameState, action: Action): GameState {
  return checkpoint(reduce(state, action));
}
function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START_WARMUP": {
      const run: StoredRun = {
        route: "basic",
        seed: action.seed >>> 0,
        plan: ["semi:1", "semi:2"],
        index: 0,
        pos: 12,
        keepNote: [0, 0, 4],
        results: [],
        assistOff: false,
        melody: [60],
      };
      return freshTicket({
        ...state,
        screen: "run",
        run,
        pos: 12,
        fpos: 12,
        tutorial: 10,
        save: { ...state.save, activeRun: null },
      });
    }
    case "START_TUTORIAL": {
      if (!validTicket(action.ticket)) return state;
      const ticket = action.ticket;
      const run: StoredRun = {
        route: "intro",
        seed: 303,
        plan: ["deg:3"],
        index: 0,
        pos: 12,
        keepNote: [0, 0, 4],
        results: [],
        assistOff: false,
        melody: [60],
      };
      const demonstration = freshTicket({
        ...state,
        screen: "run",
        run,
        pos: 12,
        fpos: 12,
        tutorial: 0,
        save: { ...state.save, activeRun: null },
      });
      return reduce(demonstration, { type: "ISSUE", ticket });
    }
    case "START_RUN": {
      if (!routeUnlocked(action.route, state.save)) return state;
      const run: StoredRun = {
        route: action.route,
        seed: action.seed >>> 0,
        plan: planRun(action.route, action.seed, state.save),
        index: 0,
        pos: 12,
        keepNote: [0, 0, 4],
        results: [],
        assistOff: !state.save.settings.assist,
        melody: [60],
      };
      return freshTicket({ ...state, screen: "run", run, pos: 12, fpos: 12, tutorial: null });
    }
    case "RESUME_RUN": {
      const run = action.saved ?? state.save.activeRun;
      if (!run) return state;
      const next = freshTicket({ ...state, screen: "run", run, pos: run.pos, fpos: run.pos });
      const saved = run.checkpoint;
      if (
        !saved ||
        !validTicket(saved.ticket) ||
        !Object.keys(PHASE_TRANSITIONS).includes(saved.phase)
      )
        return next;
      return {
        ...next,
        ticket: saved.ticket,
        phase: saved.phase as Phase,
        mistakes: saved.mistakes,
        rulerUsed: saved.rulerUsed,
        hunt: saved.hunt,
        earDirectionAnswered: saved.earDirectionAnswered,
        replays: saved.replays,
        reveal: saved.reveal,
        message: saved.message,
        fpos: saved.fpos,
      };
    }
    case "ISSUE": {
      if (!state.run || state.phase !== "brief" || !validTicket(action.ticket)) return state;
      const ticket = action.ticket;
      const plan = [...state.run.plan];
      const scheduled = plan.indexOf(ticket.itemKey, state.run.index);
      if (scheduled >= 0)
        [plan[state.run.index], plan[scheduled]] = [plan[scheduled]!, plan[state.run.index]!];
      else plan[state.run.index] = ticket.itemKey;
      return {
        ...state,
        ticket,
        pos: ticket.start,
        fpos: ticket.start,
        phase: ticket.kind === "ear" ? "judge" : "drive",
        earDirectionAnswered:
          ticket.kind !== "ear" || earLevel(state.save) > 1 || ticket.presentation === "chord",
        run: {
          ...state.run,
          plan,
          pos: ticket.start,
          keepNote: [ticket.startNote.letter, ticket.startNote.acc, ticket.startNote.octave],
        },
        message: ticket.respelled
          ? `${noteKo(ticket.startNote)}으로 이름표를 바꿨어요. 같은 역이에요.`
          : ticket.sub,
      };
    }
    case "MOVE": {
      if (!state.ticket || state.phase !== "drive") return state;
      const pos = Math.max(0, Math.min(24, Math.round(action.pos)));
      const fpos = Math.max(0, Math.min(24, Number.isFinite(action.fpos) ? action.fpos! : pos));
      return { ...state, pos, fpos, message: "" };
    }
    case "ARRIVE": {
      if (!state.ticket || state.phase !== "drive") return state;
      if (state.ticket.kind === "read") {
        return state.pos === state.ticket.target
          ? { ...state, phase: "judge", message: "도착했어요. 두 음 사이의 이름을 골라 주세요." }
          : { ...state, message: "깃발 역까지 운전한 다음 도착을 눌러 주세요." };
      }
      if (state.pos === state.ticket.target) return stampTicket(state, true);
      return {
        ...state,
        phase: "fix",
        mistakes: state.mistakes + 1,
        message: diagnostic(state.ticket, state.pos),
      };
    }
    case "CHOOSE": {
      if (
        !state.ticket ||
        state.phase !== "judge" ||
        (!state.earDirectionAnswered && state.ticket.kind === "ear")
      )
        return state;
      const correct =
        state.ticket.kind === "ear" && state.ticket.iv.semis === 6
          ? "증4도/감5도"
          : nameKo(state.ticket.iv);
      if (action.name === correct) return stampTicket(state, true);
      return {
        ...state,
        mistakes: state.mistakes + 1,
        message: `글자 ${state.ticket.num}개라서 ${state.ticket.num}도, 반음은 ${state.ticket.iv.semis}칸이에요. 다시 골라 보세요.`,
      };
    }
    case "RETRY":
      if (state.phase !== "fix" || !state.ticket) return state;
      return {
        ...state,
        phase: state.mistakes >= 2 ? "show" : "drive",
        pos: state.ticket.start,
        fpos: state.ticket.start,
        reveal: 0,
        message:
          state.mistakes >= 2
            ? "포포와 출발역부터 한 칸씩 검산해요."
            : "출발역부터 다시 운전해 보세요.",
      };
    case "REVEAL": {
      if (!["show", "verify", "judge"].includes(state.phase) || !state.ticket) return state;
      const reveal = Math.max(
        0,
        Math.min(Math.abs(state.ticket.target - state.ticket.start), Math.floor(action.k)),
      );
      if (state.phase !== "show") return { ...state, reveal };
      const pos = state.ticket.start + state.ticket.dir * reveal;
      return { ...state, reveal, pos, fpos: pos };
    }
    case "FINISH":
      return state.phase === "show" ? stampTicket(state, action.clean) : state;
    case "NEXT": {
      if (state.phase !== "verify" || !state.run) return state;
      if (state.tutorial === 10) {
        if (state.run.index + 1 < state.run.plan.length)
          return freshTicket({ ...state, run: { ...state.run, index: state.run.index + 1 } });
        return reduce(
          { ...state, tutorial: null, run: null },
          {
            type: "START_RUN",
            route: "basic",
            seed: state.run.seed,
          },
        );
      }
      if (state.tutorial !== null)
        return {
          ...freshTicket(state),
          screen: "routes",
          tutorial: null,
          run: null,
          save: {
            ...state.save,
            settings: { ...state.save.settings, tutorialSeen: true },
            activeRun: null,
          },
        };
      const run = state.run;
      if (run.index + 1 < run.plan.length)
        return freshTicket({ ...state, run: { ...run, index: run.index + 1 } });
      const stars = runStars(run.results, run.assistOff);
      const previous = state.save.routes[run.route];
      return {
        ...state,
        screen: "terminus",
        save: {
          ...state.save,
          activeRun: null,
          routes: {
            ...state.save.routes,
            [run.route]: { stars: Math.max(previous.stars, stars), runs: previous.runs + 1 },
          },
          stats: { ...state.save.stats, runs: state.save.stats.runs + 1 },
        },
      };
    }
    case "USE_RULER":
      return state.phase === "drive" || state.phase === "judge"
        ? { ...state, rulerUsed: true, modal: "ruler" }
        : state;
    case "TOGGLE_ASSIST": {
      const assist = !state.save.settings.assist;
      return {
        ...state,
        save: { ...state.save, settings: { ...state.save.settings, assist } },
        run: state.run ? { ...state.run, assistOff: state.run.assistOff && !assist } : null,
      };
    }
    case "EAR_PLAY":
      return state.ticket?.kind === "ear" ? { ...state, replays: state.replays + 1 } : state;
    case "EAR_DIRECTION": {
      if (state.ticket?.kind !== "ear" || state.phase !== "judge" || state.earDirectionAnswered)
        return state;
      return action.dir === state.ticket.dir
        ? {
            ...state,
            earDirectionAnswered: true,
            message: "방향을 찾았어요. 이제 음정 이름을 골라 주세요.",
          }
        : {
            ...state,
            mistakes: state.mistakes + 1,
            message: "두 번째 음의 높낮이를 다시 들어 보세요.",
          };
    }
    case "EAR_HUNT":
      return state.ticket?.kind === "ear" && state.phase === "judge"
        ? {
            ...state,
            phase: "drive",
            hunt: true,
            earDirectionAnswered: true,
            pos: state.ticket.start,
            fpos: state.ticket.start,
            message: "역마다 소리를 들어 둘째 음을 찾아 보세요. 이번 승차권은 ◐ 스탬프예요.",
          }
        : state;
    case "GO":
      return { ...state, screen: action.screen, modal: null };
    case "OPEN":
      return { ...state, modal: action.modal };
    case "CLOSE":
      return { ...state, modal: null };
    case "SET": {
      const settings = { ...state.save.settings };
      if (action.key === "volume" && typeof action.value === "number")
        settings.volume = Math.max(0, Math.min(1, action.value));
      if (
        (action.key === "muted" ||
          action.key === "vibration" ||
          action.key === "assist" ||
          action.key === "tutorialSeen") &&
        typeof action.value === "boolean"
      )
        settings[action.key] = action.value;
      if (
        action.key === "motion" &&
        (action.value === "system" || action.value === "reduced" || action.value === "full")
      )
        settings.motion = action.value;
      return {
        ...state,
        save: { ...state.save, settings },
        run:
          state.run && action.key === "assist" && action.value === true
            ? { ...state.run, assistOff: false }
            : state.run,
      };
    }
    case "TUTORIAL":
      return action.step === null && state.tutorial !== null
        ? {
            ...freshTicket(state),
            tutorial: null,
            run: null,
            screen: "routes",
            save: {
              ...state.save,
              activeRun: null,
              settings: { ...state.save.settings, tutorialSeen: true },
            },
          }
        : { ...state, tutorial: action.step };
    case "RESET":
      return createInitialState();
  }
}
