import "./styles.css";
import { createAudio } from "./audio/engine";
import { createInitialState, reducer } from "./game/reducer";
import type { Action, Route, Settings } from "./game/types";
import { createTicket } from "./game/generator";
import { createEffects } from "./game/effects";
import { isWhitePc } from "./theory";
import { referenceLabel } from "./theory/examples";
import { LocalStorageAdapter } from "./infra/storage";
import { registerPwa } from "./infra/pwa";
import { createView } from "./view/app";

const root = document.querySelector<HTMLElement>("#app")!;
const view = createView(root);
const audio = createAudio();
const storage = new LocalStorageAdapter();
let state = createInitialState(storage.read());
let offline = false;
let dragging = false;
const effects = createEffects({ audio, storage, dispatch, getState: () => state });
function render() {
  view.render(state, audio.state, offline, dragging);
}
function dispatch(action: Action): void {
  const prev = state;
  state = reducer(state, action);
  render();
  effects.run(prev, action, state);
}
render();
audio.setSettings(state.save.settings);
audio.subscribe(() => render());
void registerPwa((ready) => {
  offline = ready;
  render();
});
window.addEventListener("pagehide", () => effects.flush());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.cancel();
    effects.flush();
  } else render();
});
document.addEventListener("ijs-storage-fallback", () =>
  view.toast("저장 공간을 쓸 수 없어 이번 화면 안에서만 진행을 기억해요."),
);
if (storage.consumeMigrationNotice())
  view.toast("별과 스탬프를 옮겼어요. 진행 중이던 운행은 새 방식으로 다시 시작해요.");
function beginTutorial(): void {
  const demo = createTicket("deg:3", 12, null, () => 0);
  if (demo) dispatch({ type: "START_TUTORIAL", ticket: demo });
  dispatch({ type: "OPEN", modal: "sound-check" });
  audio.playStart(60);
}
function back(): void {
  dispatch({ type: "GO", screen: state.run && state.save.activeRun ? "run" : "title" });
}
function replay(): void {
  const t = state.ticket;
  if (!t) return;
  if (t.kind === "ear" && state.phase !== "verify") dispatch({ type: "EAR_PLAY" });
  else if (state.phase === "verify") audio.playInterval(48 + t.start, 48 + t.target);
  else audio.playStart(48 + t.start);
}
function act(action: string, button?: HTMLElement): void {
  if (action.startsWith("start-")) {
    const route = action.slice(6) as Route;
    if (["intro", "basic", "full", "ear", "mixed"].includes(route)) {
      const seed = Math.floor(Math.random() * 0xffffffff);
      dispatch(
        route === "basic" && state.save.routes.basic.runs < 2
          ? { type: "START_WARMUP", seed }
          : { type: "START_RUN", route, seed },
      );
    }
    return;
  }
  switch (action) {
    case "routes":
      dispatch({ type: "GO", screen: "routes" });
      break;
    case "notebook":
      dispatch({ type: "GO", screen: "notebook" });
      break;
    case "settings":
      dispatch({ type: "GO", screen: "settings" });
      break;
    case "back":
      back();
      break;
    case "resume":
      dispatch({ type: "RESUME_RUN" });
      break;
    case "pause":
      dispatch({ type: "OPEN", modal: "pause" });
      break;
    case "close":
      dispatch({ type: "CLOSE" });
      break;
    case "ruler":
      dispatch({ type: "USE_RULER" });
      break;
    case "assist":
      dispatch({
        type:
          state.ticket?.kind === "ear" && state.phase === "judge" ? "EAR_HUNT" : "TOGGLE_ASSIST",
      });
      break;
    case "replay":
      replay();
      break;
    case "next":
      dispatch({ type: "NEXT" });
      break;
    case "choose":
      dispatch({ type: "CHOOSE", name: button?.dataset.choice ?? "" });
      break;
    case "direction-up":
      dispatch({ type: "EAR_DIRECTION", dir: 1 });
      break;
    case "direction-down":
      dispatch({ type: "EAR_DIRECTION", dir: -1 });
      break;
    case "sound":
      if (state.save.settings.muted) dispatch({ type: "SET", key: "muted", value: false });
      void audio.unlock().then(() => {
        audio.playStart(60);
        render();
      });
      break;
    case "sound-test":
      void audio.unlock().then(() => audio.playStart(60));
      break;
    case "sound-yes":
      dispatch({ type: "CLOSE" });
      if (state.tutorial !== null) dispatch({ type: "TUTORIAL", step: 1 });
      break;
    case "sound-no":
      dispatch({ type: "OPEN", modal: "sound-help" });
      break;
    case "tutorial":
      beginTutorial();
      break;
    case "skip-tutorial":
      dispatch({ type: "TUTORIAL", step: null });
      break;
    case "reset-confirm":
      dispatch({ type: "OPEN", modal: "reset" });
      break;
    case "reset":
      storage.clear();
      dispatch({ type: "RESET" });
      view.refreshScreens();
      render();
      break;
    case "melody":
      audio.playMelody(state.run?.melody ?? []);
      break;
    case "example": {
      const semi = Number(button?.dataset.semi);
      if (semi >= 1 && semi <= 12) {
        audio.playInterval(60, 60 + semi);
        view.toast(referenceLabel(semi));
      }
      break;
    }
  }
}
root.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button");
  if (!button || button.disabled) return;
  if (button.dataset.action) act(button.dataset.action, button);
  else if (button.dataset.control !== undefined) {
    if (button.dataset.choice) {
      dispatch({ type: "CHOOSE", name: button.dataset.choice });
      return;
    }
    const index = Number(button.dataset.control);
    if (index !== 1) step(index === 0 ? -1 : 1);
    else if (state.phase === "fix") dispatch({ type: "RETRY" });
    else if (state.phase === "verify" || (state.ticket?.kind === "ear" && state.phase === "judge"))
      replay();
    else dispatch({ type: "ARRIVE" });
  }
});
root.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement | HTMLSelectElement;
  const key = input.dataset.setting as keyof Settings | undefined;
  if (!key) return;
  const value =
    input instanceof HTMLInputElement && input.type === "checkbox"
      ? input.checked
      : key === "volume"
        ? Number(input.value)
        : input.value;
  dispatch({ type: "SET", key, value: value as Settings[keyof Settings] });
});
const dialog = root.querySelector<HTMLDialogElement>("#modal")!;
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  dispatch({ type: "CLOSE" });
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dispatch({ type: "CLOSE" });
  }
});
function step(dir: 1 | -1): void {
  if (state.screen !== "run" || state.modal || state.phase !== "drive") return;
  let next = state.pos + dir;
  if (state.ticket?.kind === "degree")
    while (next >= 0 && next <= 24 && !isWhitePc(48 + next)) next += dir;
  if (next >= 0 && next <= 24) dispatch({ type: "MOVE", pos: next });
}
window.addEventListener("keydown", (event) => {
  if (state.screen !== "run" || state.modal || event.ctrlKey || event.metaKey || event.altKey)
    return;
  if ((event.target as Element).matches("input,select,textarea")) return;
  // Let the new header button receive its native keyboard activation.
  if (event.key === "Enter" && (event.target as Element).closest("[data-rulebook-open]")) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    step(event.key === "ArrowLeft" ? -1 : 1);
  } else if (event.key === "Enter" && state.phase === "drive") {
    event.preventDefault();
    dispatch({ type: "ARRIVE" });
  } else if (event.key === "Escape") {
    event.preventDefault();
    dispatch({ type: "OPEN", modal: "pause" });
  }
});
let drag: { id: number; x: number; pos: number; dir: 1 | -1 } | null = null;
view.stage.element.addEventListener("pointerdown", (event) => {
  if (state.screen !== "run" || state.phase !== "drive" || state.modal) return;
  drag = { id: event.pointerId, x: event.clientX, pos: state.pos, dir: state.ticket?.dir ?? 1 };
  dragging = true;
  try {
    view.stage.element.setPointerCapture(event.pointerId);
  } catch {
    /* Synthetic pointers have no capture target. */
  }
  render();
});
view.stage.element.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const delta = (event.clientX - drag.x) / view.stage.geometry.W;
  if (delta) drag.dir = delta > 0 ? 1 : -1;
  const fpos = Math.max(0, Math.min(24, drag.pos + delta));
  dispatch({ type: "MOVE", pos: Math.round(fpos), fpos });
});
function endDrag(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.id) return;
  let pos = Math.round(state.fpos);
  if (state.ticket?.kind === "degree" && !isWhitePc(48 + pos)) {
    pos += drag.dir;
    if (pos < 0 || pos > 24) pos -= 2 * drag.dir;
  }
  drag = null;
  dragging = false;
  dispatch({ type: "MOVE", pos });
}
view.stage.element.addEventListener("pointerup", endDrag);
view.stage.element.addEventListener("pointercancel", endDrag);
if (import.meta.env.PROD) {
  let reported = false;
  const fatal = () => {
    if (reported) return;
    reported = true;
    const panel = document.createElement("div");
    panel.className = "fatal";
    panel.setAttribute("role", "alert");
    panel.innerHTML =
      '<p>문제가 생겼어요. 저장된 여행은 다시 이어갈 수 있어요.</p><button class="primary">새로고침</button>';
    panel.querySelector("button")!.onclick = () => location.reload();
    root.prepend(panel);
  };
  window.addEventListener("error", fatal);
  window.addEventListener("unhandledrejection", fatal);
}
