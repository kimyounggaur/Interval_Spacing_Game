import { BOARD, CARD_BY_ID, INTERVALS, MODE_META, cardsForMode } from "./domain/data";
import type { Card, Mode, RedCard } from "./domain/data";
import {
  addUnique,
  diagnoseGreen,
  diagnoseYellow,
  emptyNotebook,
  greenTarget,
  isModeClear,
  makeRng,
  mergeNotebook,
  modeProgress,
  planMove,
  randomSeed,
  redMoveTarget,
  shuffle,
} from "./domain/engine";
import type { MovePlan, Notebook } from "./domain/engine";
import { createAudioAdapter, vibrate } from "./infra/audio";
import type { AudioPort } from "./infra/audio";
import { DEFAULT_SETTINGS, LocalStorageAdapter } from "./infra/storage";
import type { SaveData, Settings, StoredRun } from "./infra/storage";
import "./styles.css";

type Screen = "title" | "routes" | "game" | "notebook" | "result" | "settings";
type Phase = "idle" | "answer" | "earReady" | "earGuess" | "correction" | "feedback";
type Modal = "pause" | "ruler" | "confirm-exit" | "confirm-reset" | "tutorial" | "bonus" | null;

type Feedback = {
  kind: "correct" | "wrong" | "out" | "info";
  title: string;
  body: string;
  reveal: boolean;
  nextLabel: string;
  transfer?: number[];
};

type AppState = {
  screen: Screen;
  mode: Mode | null;
  phase: Phase;
  position: number;
  currentCardId: string | null;
  deckIds: string[];
  discardIds: string[];
  seed: number;
  selected: number | null;
  movePlan: MovePlan | null;
  roundNotebook: Notebook;
  tickets: number;
  streak: number;
  wrongThisRun: number;
  earStart: number | null;
  earReplays: number;
  earAttempts: number;
  feedback: Feedback | null;
  correctionTarget: number | null;
  correctionSelected: number | null;
  modal: Modal;
  pendingMode: Mode | null;
  lastClear: { mode: Mode; stars: number; newStamps: string[] } | null;
};

type Action =
  | { type: "SCREEN"; screen: Screen }
  | { type: "START_RUN"; mode: Mode; deckIds: string[]; seed: number }
  | { type: "RESUME_RUN"; run: StoredRun }
  | { type: "DRAW"; cardId: string; deckIds: string[]; discardIds: string[] }
  | { type: "SELECT"; index: number }
  | {
      type: "SUBMIT_MOVE";
      target: number;
      selected: number;
      plan: MovePlan | null;
      feedback: Feedback;
      correct: boolean;
      retry: boolean;
    }
  | { type: "START_CORRECTION"; target: number; selected: number; feedback: Feedback }
  | { type: "RETRY" }
  | { type: "EAR_READY"; start: number }
  | { type: "EAR_REPLAY" }
  | { type: "SUBMIT_EAR"; correct: boolean; feedback: Feedback; retry: boolean }
  | { type: "NEXT" }
  | { type: "OPEN_MODAL"; modal: Exclude<Modal, null> }
  | { type: "CLOSE_MODAL" }
  | { type: "PENDING_MODE"; mode: Mode }
  | { type: "CLEAR_PENDING" }
  | { type: "CLEAR_RUN"; mode: Mode; stars: number; newStamps: string[] }
  | { type: "RESET" };

function initialState(): AppState {
  return {
    screen: "title",
    mode: null,
    phase: "idle",
    position: 12,
    currentCardId: null,
    deckIds: [],
    discardIds: [],
    seed: 0,
    selected: null,
    movePlan: null,
    roundNotebook: emptyNotebook(),
    tickets: 0,
    streak: 0,
    wrongThisRun: 0,
    earStart: null,
    earReplays: 0,
    earAttempts: 0,
    feedback: null,
    correctionTarget: null,
    correctionSelected: null,
    modal: null,
    pendingMode: null,
    lastClear: null,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SCREEN":
      return { ...state, screen: action.screen, modal: null };
    case "START_RUN":
      return {
        ...state,
        screen: "game",
        mode: action.mode,
        phase: "idle",
        position: 12,
        currentCardId: null,
        deckIds: action.deckIds,
        discardIds: [],
        seed: action.seed,
        selected: null,
        movePlan: null,
        roundNotebook: emptyNotebook(),
        tickets: 0,
        streak: 0,
        wrongThisRun: 0,
        earStart: null,
        earReplays: 0,
        earAttempts: 0,
        feedback: null,
        correctionTarget: null,
        correctionSelected: null,
        modal: null,
        lastClear: null,
      };
    case "RESUME_RUN":
      return {
        ...state,
        screen: "game",
        mode: action.run.mode,
        phase: "idle",
        position: action.run.position,
        currentCardId: null,
        deckIds: [...action.run.deckIds],
        discardIds: [...action.run.discardIds],
        seed: action.run.seed,
        selected: null,
        movePlan: null,
        roundNotebook: action.run.roundNotebook,
        tickets: action.run.tickets,
        streak: action.run.streak,
        wrongThisRun: 0,
        earStart: null,
        earReplays: 0,
        earAttempts: 0,
        feedback: null,
        correctionTarget: null,
        correctionSelected: null,
        modal: null,
      };
    case "DRAW":
      return {
        ...state,
        phase:
          state.mode === "ear" ||
          (state.mode === "mixed" && CARD_BY_ID.get(action.cardId)?.type === "red")
            ? "earReady"
            : "answer",
        currentCardId: action.cardId,
        deckIds: action.deckIds,
        discardIds: action.discardIds,
        selected: null,
        movePlan: null,
        feedback: null,
        correctionTarget: null,
        correctionSelected: null,
        earStart: null,
        earReplays: 0,
        earAttempts: 0,
      };
    case "SELECT":
      return { ...state, selected: action.index };
    case "SUBMIT_MOVE":
      return {
        ...state,
        phase: action.retry ? "correction" : "feedback",
        selected: action.selected,
        movePlan: action.plan,
        feedback: action.feedback,
        position: action.correct ? action.target : state.position,
        correctionTarget: action.retry ? action.target : null,
        correctionSelected: action.retry ? action.selected : null,
      };
    case "START_CORRECTION":
      return {
        ...state,
        phase: "correction",
        selected: action.selected,
        feedback: action.feedback,
        correctionTarget: action.target,
        correctionSelected: action.selected,
      };
    case "RETRY":
      return {
        ...state,
        phase: "answer",
        selected: null,
        feedback: null,
        correctionSelected: null,
      };
    case "EAR_READY":
      return { ...state, phase: "earGuess", earStart: action.start, earAttempts: 0 };
    case "EAR_REPLAY":
      return { ...state, phase: "earGuess", earReplays: state.earReplays + 1 };
    case "SUBMIT_EAR":
      return {
        ...state,
        phase: "feedback",
        feedback: action.feedback,
        earAttempts: state.earAttempts + 1,
      };
    case "NEXT":
      return {
        ...state,
        phase: "idle",
        currentCardId: null,
        selected: null,
        movePlan: null,
        feedback: null,
        correctionTarget: null,
        correctionSelected: null,
        earStart: null,
      };
    case "OPEN_MODAL":
      return { ...state, modal: action.modal };
    case "CLOSE_MODAL":
      return { ...state, modal: null };
    case "PENDING_MODE":
      return { ...state, pendingMode: action.mode, modal: "confirm-exit" };
    case "CLEAR_PENDING":
      return { ...state, pendingMode: null, modal: null };
    case "CLEAR_RUN":
      return {
        ...state,
        screen: "result",
        phase: "idle",
        currentCardId: null,
        modal: null,
        lastClear: { mode: action.mode, stars: action.stars, newStamps: action.newStamps },
      };
    case "RESET":
      return initialState();
  }
}

class AppController {
  private readonly root: HTMLElement;
  private readonly storage = new LocalStorageAdapter();
  private readonly audio: AudioPort = createAudioAdapter();
  private save: SaveData;
  private state: AppState = initialState();
  private liveMessage = "";
  private focusTarget = "#main-title";
  private settings: Settings;

  public constructor(root: HTMLElement) {
    this.root = root;
    this.save = this.storage.read();
    this.settings = { ...DEFAULT_SETTINGS, ...this.save.settings };
    this.audio.setVolume(this.settings.volume);
    this.audio.setMuted(this.settings.muted);
    root.addEventListener("click", (event) => {
      void this.handleClick(event);
    });
    root.addEventListener("input", (event) => {
      this.handleInput(event);
    });
    root.addEventListener("keydown", (event) => {
      this.handleKeydown(event);
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void this.audio.unlock();
    });
    window.addEventListener("error", (event) => {
      event.preventDefault();
      this.announce("앱이 계속 실행되도록 오류를 복구했습니다.");
    });
    this.render();
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }

  private dispatch(action: Action): void {
    this.state = reducer(this.state, action);
    this.render();
  }

  private get currentCard(): Card | null {
    return this.state.currentCardId ? (CARD_BY_ID.get(this.state.currentCardId) ?? null) : null;
  }
  private get mode(): Mode {
    return this.state.mode ?? "intro";
  }
  private async handleClick(event: Event): Promise<void> {
    const target = event.target as HTMLElement;
    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.action;
    if (!action) return;
    try {
      switch (action) {
        case "start-routes": {
          const unlock = this.audio.unlock();
          await unlock;
          this.focusTarget = "#main-title";
          this.dispatch({ type: "SCREEN", screen: "routes" });
          break;
        }
        case "resume": {
          const unlock = this.audio.unlock();
          await unlock;
          if (this.save.activeRun) this.resumeRun(this.save.activeRun);
          break;
        }
        case "start-mode":
          this.requestMode(actionElement.dataset.mode as Mode);
          break;
        case "confirm-new":
          this.startMode(this.state.pendingMode ?? "intro");
          break;
        case "cancel":
          this.dispatch({ type: "CLOSE_MODAL" });
          break;
        case "cell":
          this.selectCell(Number(actionElement.dataset.index));
          break;
        case "submit":
          await this.submitMove();
          break;
        case "play-note":
          await this.playCurrentNote();
          break;
        case "ear-play":
          await this.playEar();
          break;
        case "ear-replay":
          await this.replayEar();
          break;
        case "choose-ear":
          await this.chooseEar(Number(actionElement.dataset.semi));
          break;
        case "retry":
          this.retryCorrection();
          break;
        case "next":
          this.nextTurn();
          break;
        case "pause":
          this.dispatch({ type: "OPEN_MODAL", modal: "pause" });
          break;
        case "resume-game":
          this.dispatch({ type: "CLOSE_MODAL" });
          break;
        case "open-ruler":
          if (this.state.tickets > 0) {
            this.state.tickets -= 1;
            this.announce("무료 음정 자 티켓을 사용했어요.");
          } else this.announce("음정 자를 열었어요. 이번 판 별 자격에는 힌트 사용이 기록돼요.");
          this.dispatch({ type: "OPEN_MODAL", modal: "ruler" });
          break;
        case "open-notebook":
          this.focusTarget = "#main-title";
          this.dispatch({ type: "SCREEN", screen: "notebook" });
          break;
        case "return-game":
          this.focusTarget = "#main-title";
          this.dispatch({ type: "SCREEN", screen: "game" });
          break;
        case "open-settings":
          this.focusTarget = "#main-title";
          this.dispatch({ type: "SCREEN", screen: "settings" });
          break;
        case "routes":
          this.focusTarget = "#main-title";
          this.dispatch({ type: "SCREEN", screen: "routes" });
          break;
        case "exit-game":
          this.saveCheckpoint();
          this.dispatch({ type: "SCREEN", screen: "routes" });
          break;
        case "confirm-exit":
          this.startMode(this.state.pendingMode ?? "intro");
          break;
        case "finish":
          this.finishRun();
          break;
        case "replay-mode":
          if (this.state.lastClear) this.startMode(this.state.lastClear.mode);
          break;
        case "reset-data":
          this.dispatch({ type: "OPEN_MODAL", modal: "confirm-reset" });
          break;
        case "confirm-reset":
          this.storage.clear();
          this.save = this.storage.read();
          this.settings = { ...DEFAULT_SETTINGS };
          this.audio.setVolume(this.settings.volume);
          this.audio.setMuted(false);
          this.dispatch({ type: "RESET" });
          this.announce("학습 데이터가 초기화되었습니다.");
          break;
        case "tutorial":
          this.dispatch({ type: "OPEN_MODAL", modal: "tutorial" });
          break;
        case "close-modal":
          this.dispatch({ type: "CLOSE_MODAL" });
          break;
        case "sound-guide":
          await this.audio.unlock();
          await this.audio.playLearningInterval(60, 67);
          break;
        case "toggle-mute":
          this.settings.muted = !this.settings.muted;
          this.audio.setMuted(this.settings.muted);
          this.persistSettings();
          break;
        case "toggle-vibration":
          this.settings.vibration = !this.settings.vibration;
          this.persistSettings();
          break;
        case "motion": {
          const motion = actionElement.dataset.motion;
          if (motion === "system" || motion === "reduced" || motion === "full") {
            this.settings.motion = motion;
            this.persistSettings();
          }
          break;
        }
        default:
          break;
      }
    } catch {
      this.announce("잠시 후 다시 시도해 주세요.");
    }
  }

  private handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.dataset.setting === "volume") {
      this.settings.volume = Number(target.value) / 100;
      this.persistSettings();
      this.audio.setVolume(this.settings.volume);
      this.announce(`소리 크기 ${Math.round(this.settings.volume * 100)}%`);
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (
      event.key === "Escape" &&
      this.state.modal &&
      this.state.modal !== "confirm-reset" &&
      this.state.modal !== "confirm-exit"
    ) {
      this.dispatch({ type: "CLOSE_MODAL" });
      return;
    }
    if (
      this.state.screen === "game" &&
      this.state.phase === "answer" &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      const next =
        this.state.selected === null
          ? this.state.position
          : this.state.selected + (event.key === "ArrowRight" ? 1 : -1);
      if (next >= 0 && next <= 24) {
        event.preventDefault();
        this.selectCell(next);
      }
    }
  }

  private requestMode(mode: Mode): void {
    if (!this.isUnlocked(mode)) {
      this.announce(this.unlockReason(mode));
      return;
    }
    if (this.save.activeRun && this.save.activeRun.mode !== mode) {
      this.dispatch({ type: "PENDING_MODE", mode });
      return;
    }
    if (this.save.activeRun?.mode === mode) {
      this.resumeRun(this.save.activeRun);
      return;
    }
    this.startMode(mode);
  }

  private startMode(mode: Mode): void {
    const seed = randomSeed();
    const ids = shuffle(
      cardsForMode(mode).map((card) => card.id),
      makeRng(seed),
    );
    this.save.activeRun = null;
    this.persist();
    this.dispatch({ type: "START_RUN", mode, deckIds: ids, seed });
    this.focusTarget = "#main-title";
    if (mode === "intro" && !this.settings.tutorialSeen)
      this.dispatch({ type: "OPEN_MODAL", modal: "tutorial" });
    this.drawNextCard();
  }

  private resumeRun(run: StoredRun): void {
    this.dispatch({ type: "RESUME_RUN", run });
    this.drawNextCard();
    this.announce("마지막 안전 checkpoint에서 운행을 이어갑니다.");
  }

  private drawNextCard(): void {
    if (this.state.mode === null) return;
    let deck = [...this.state.deckIds];
    let discard = [...this.state.discardIds];
    if (deck.length === 0) {
      deck = shuffle(discard, makeRng(this.state.seed + discard.length + this.state.streak + 1));
      discard = [];
    }
    const next = deck.shift();
    if (!next) return;
    this.dispatch({ type: "DRAW", cardId: next, deckIds: deck, discardIds: discard });
    const card = CARD_BY_ID.get(next);
    if (card?.type === "green") void this.playCurrentNote();
  }

  private selectCell(index: number): void {
    if (this.state.phase !== "answer" || !this.currentCard || this.currentCard.type === "red")
      return;
    if (index < 0 || index > 24) return;
    if (this.currentCard.type === "green" && !BOARD[index]?.isWhite) {
      this.announce("터널은 통과만! 초록 카드에서는 흰건반만 골라요.");
      return;
    }
    this.dispatch({ type: "SELECT", index });
    this.announce(`${index}번 ${BOARD[index]?.ko ?? "정거장"}을 선택했습니다.`);
  }

  private async submitMove(): Promise<void> {
    const card = this.currentCard;
    const selected = this.state.selected;
    if (!card || selected === null || (card.type !== "green" && card.type !== "yellow")) return;
    const plan = card.type === "green" ? null : planMove(this.state.position, card.dir * card.semi);
    const target =
      card.type === "green"
        ? greenTarget(this.state.position, card.degree, card.dir)
        : plan!.target;
    if (target === null) {
      this.updateAttempt(card, false);
      this.moveToDiscard(card.id);
      this.dispatch({
        type: "SUBMIT_MOVE",
        target: this.state.position,
        selected,
        plan,
        correct: false,
        retry: false,
        feedback: {
          kind: "out",
          title: "선로가 끊겼어요",
          body: "이번 카드는 버리고 다른 카드를 뽑아 볼게요.",
          reveal: true,
          nextLabel: "다음 카드",
        },
      });
      this.announce("선로가 끊겼어요. 다른 카드를 뽑아 볼게요.");
      return;
    }
    const correct = selected === target;
    const retry = this.state.correctionTarget !== null;
    if (correct) {
      this.completeAttempt(card, target, plan, retry);
      this.dispatch({
        type: "SUBMIT_MOVE",
        target,
        selected,
        plan,
        correct: true,
        retry: false,
        feedback: this.correctFeedback(card, target, plan),
      });
      await this.playSuccess(card, target);
      return;
    }
    this.updateAttempt(card, false);
    const message =
      card.type === "green"
        ? diagnoseGreen(this.state.position, selected, target)
        : diagnoseYellow(selected, target, card.semi);
    const feedback: Feedback = {
      kind: "wrong",
      title: "포포가 함께 다시 세어 봐요",
      body: message,
      reveal: false,
      nextLabel: "교정 시작",
    };
    this.state = reducer(this.state, { type: "START_CORRECTION", target, selected, feedback });
    this.state.wrongThisRun += 1;
    this.render();
    vibrate(60, this.settings.vibration);
    await this.audio.playSfx("wrong", 54);
  }

  private retryCorrection(): void {
    if (this.state.phase !== "correction") return;
    this.dispatch({ type: "RETRY" });
    this.announce("같은 카드를 다시 풀어 보세요.");
  }

  private async chooseEar(semi: number): Promise<void> {
    const card = this.currentCard;
    if (!card || card.type !== "red" || this.state.phase !== "earGuess") return;
    const correct = card.semi === semi;
    if (correct) {
      const target = redMoveTarget(this.state.position, semi);
      this.completeAttempt(card, target, null, false);
      const feedback = this.correctFeedback(card, target, null);
      this.dispatch({ type: "SUBMIT_EAR", correct: true, feedback, retry: false });
      await this.playEarReveal(card);
      return;
    }
    this.updateAttempt(card, false);
    this.state.wrongThisRun += 1;
    const firstWrong = this.state.earAttempts === 0;
    const feedback: Feedback = firstWrong
      ? {
          kind: "wrong",
          title: "한 번 더 들어 볼까요?",
          body: "정답은 아직 공개하지 않아요. 두 음의 간격을 다시 들어 보세요.",
          reveal: false,
          nextLabel: "다시 듣고 도전",
        }
      : {
          kind: "wrong",
          title: "지휘자 정답을 확인해요",
          body: `${INTERVALS[card.semi]?.name ?? "음정"} · ${card.semi}반음`,
          reveal: true,
          nextLabel: "다음 카드",
        };
    if (!firstWrong) this.moveToDiscard(card.id);
    this.dispatch({ type: "SUBMIT_EAR", correct: false, feedback, retry: firstWrong });
    vibrate(70, this.settings.vibration);
    await this.audio.playSfx("wrong", 54);
  }

  private async playEar(): Promise<void> {
    const card = this.currentCard;
    if (!card || card.type !== "red" || this.state.phase !== "earReady") return;
    const unlock = this.audio.unlock();
    const start = Math.floor(
      makeRng(this.state.seed + Number(card.id) * 31)() * (25 - card.semi + 1),
    );
    this.dispatch({ type: "EAR_READY", start });
    await unlock;
    await this.audio.playEarInterval(48 + start, 48 + start + card.semi);
    this.announce("두 음을 들었어요. 음정을 골라 주세요.");
  }

  private async replayEar(): Promise<void> {
    const card = this.currentCard;
    if (
      !card ||
      card.type !== "red" ||
      this.state.earStart === null ||
      this.state.phase !== "feedback"
    )
      return;
    this.dispatch({ type: "EAR_REPLAY" });
    await this.audio.playEarInterval(
      48 + this.state.earStart,
      48 + this.state.earStart + card.semi,
    );
    this.dispatch({ type: "SCREEN", screen: "game" });
    this.state = { ...this.state, phase: "earGuess", feedback: null };
    this.render();
  }

  private async playCurrentNote(): Promise<void> {
    if (this.state.position >= 0 && this.state.position <= 24)
      await this.audio.playNote(BOARD[this.state.position]?.midi ?? 60);
  }

  private nextTurn(): void {
    const card = this.currentCard;
    if (!card) {
      this.drawNextCard();
      return;
    }
    if (
      this.state.feedback?.kind === "correct" &&
      isModeClear(this.mode, this.state.roundNotebook)
    ) {
      this.finishRun();
      return;
    }
    this.moveToDiscard(card.id);
    this.saveCheckpoint();
    this.dispatch({ type: "NEXT" });
    this.drawNextCard();
  }

  private moveToDiscard(id: string): void {
    if (!this.state.discardIds.includes(id)) this.state.discardIds = [...this.state.discardIds, id];
  }

  private completeAttempt(card: Card, target: number, plan: MovePlan | null, retry: boolean): void {
    this.updateAttempt(card, true);
    if (card.type === "green")
      this.state.roundNotebook.greenDegrees = addUnique(
        this.state.roundNotebook.greenDegrees,
        card.degree,
      );
    if (card.type === "yellow")
      this.state.roundNotebook.yellow = addUnique(this.state.roundNotebook.yellow, card.semi);
    if (card.type === "red")
      this.state.roundNotebook.red = addUnique(this.state.roundNotebook.red, card.semi);
    this.state.position = target;
    this.state.streak = retry ? 1 : this.state.streak + 1;
    if (retry) {
      this.state.tickets += 1;
      this.announce("차장 보너스! 음정 자 무료 티켓 +1");
    }
    this.save.stats.totalTurns += 1;
    if (this.state.streak > (this.save.stats.bestStreak ?? 0))
      this.save.stats.bestStreak = this.state.streak;
    if (plan?.transfers.length)
      this.announce(`옥타브 환승 ${plan.transfers.join(" → ")} 후 이동했습니다.`);
    this.moveToDiscard(card.id);
  }

  private updateAttempt(card: Card, correct: boolean): void {
    const key = card.type === "green" ? `degree-${card.degree}` : `semi-${card.semi}`;
    this.save.stats.seen[key] = (this.save.stats.seen[key] ?? 0) + 1;
    if (correct) {
      this.save.stats.correctAttempts += 1;
      this.save.stats.solved[key] = (this.save.stats.solved[key] ?? 0) + 1;
    } else this.save.stats.wrongAttempts += 1;
    this.persist();
  }

  private correctFeedback(card: Card, target: number, plan: MovePlan | null): Feedback {
    const detail =
      card.type === "green"
        ? `${BOARD[target]?.ko ?? "정거장"}에 도착! 출발음을 1로 센 ${card.degree}도예요.`
        : card.type === "yellow"
          ? `${card.intervalName} · ${card.semi}반음 · ${card.dir > 0 ? "상행" : "하행"}`
          : `${card.intervalName}을 귀로 찾았어요.`;
    return {
      kind: "correct",
      title: "정답! 도착했어요",
      body: detail,
      reveal: true,
      nextLabel: isModeClear(this.mode, this.state.roundNotebook) ? "여행 완료" : "다음 카드",
      transfer: plan?.transfers,
    };
  }

  private async playSuccess(card: Card, target: number): Promise<void> {
    await this.audio.playSfx("correct", 72);
    if (card.type !== "red")
      await this.audio.playLearningInterval(
        BOARD[this.state.position]?.midi ?? 60,
        BOARD[target]?.midi ?? 60,
      );
    vibrate([30, 40, 50], this.settings.vibration);
  }

  private async playEarReveal(card: RedCard): Promise<void> {
    const start = this.state.earStart ?? 0;
    await this.audio.playEarInterval(48 + start, 48 + start + card.semi);
    await this.audio.playSfx("stamp", 76);
    vibrate([30, 40, 70], this.settings.vibration);
  }

  private saveCheckpoint(): void {
    if (!this.state.mode || this.state.screen !== "game") return;
    this.save.activeRun = {
      mode: this.mode,
      position: this.state.position,
      deckIds: [...this.state.deckIds],
      discardIds: [...this.state.discardIds],
      seed: this.state.seed,
      roundNotebook: this.state.roundNotebook,
      tickets: this.state.tickets,
      streak: this.state.streak,
    };
    this.persist();
  }

  private finishRun(): void {
    if (!this.state.mode) return;
    const mode = this.state.mode;
    const old = this.save.notebook;
    const merged = mergeNotebook(old, this.state.roundNotebook);
    const newStamps = this.collectNewStamps(old, merged);
    const stars = this.state.wrongThisRun === 0 ? 3 : this.state.wrongThisRun <= 2 ? 2 : 1;
    this.save.notebook = merged;
    this.save.stars[mode] = Math.max(this.save.stars[mode] ?? 0, stars);
    this.save.clearedModes = [...new Set([...this.save.clearedModes, mode])];
    this.save.activeRun = null;
    this.settings.tutorialSeen = true;
    this.persist();
    this.dispatch({ type: "CLEAR_RUN", mode, stars, newStamps });
    this.focusTarget = "#main-title";
  }

  private collectNewStamps(before: Notebook, after: Notebook): string[] {
    const result: string[] = [];
    after.greenDegrees
      .filter((value) => !before.greenDegrees.includes(value))
      .forEach((value) => result.push(`도수 ${value}도`));
    after.yellow
      .filter((value) => !before.yellow.includes(value))
      .forEach((value) => result.push(INTERVALS[value]?.name ?? `${value}반음`));
    after.red
      .filter((value) => !before.red.includes(value))
      .forEach((value) => result.push(`소리 ${INTERVALS[value]?.name ?? `${value}반음`}`));
    return result;
  }

  private persist(): void {
    this.save.settings = { ...this.settings };
    this.storage.write(this.save);
  }

  private persistSettings(): void {
    this.persist();
    this.render();
  }
  private isUnlocked(mode: Mode): boolean {
    if (mode === "ear") return Boolean(this.save.stars.basic);
    if (mode === "mixed") return Boolean(this.save.stars.basic && this.save.stars.ear);
    return true;
  }
  private unlockReason(mode: Mode): string {
    if (mode === "ear") return "기본 노선을 먼저 완주하면 청음 노선이 열려요.";
    return "기본 노선과 청음 노선을 모두 완주하면 통합 노선이 열려요.";
  }

  private announce(message: string): void {
    this.liveMessage = message;
    this.render();
  }

  private render(): void {
    const screen = this.renderScreen();
    const modal = this.state.modal ? this.renderModal(this.state.modal) : "";
    this.root.innerHTML = `${screen}${modal}<div id="live-status" class="sr-only" role="status" aria-live="polite">${escapeHtml(this.liveMessage)}</div><div class="orientation-note" role="status">세로 화면으로 돌려 주세요</div>`;
    const focus = this.root.querySelector<HTMLElement>(this.focusTarget);
    if (focus) {
      window.setTimeout(() => focus.focus(), 0);
    }
    document.title =
      this.state.screen === "title"
        ? "음정 정거장: 도레미 기차 여행"
        : `${this.screenTitle()} · 음정 정거장`;
  }

  private screenTitle(): string {
    return this.state.screen === "routes"
      ? "노선을 고르세요"
      : this.state.screen === "game"
        ? MODE_META[this.mode].title
        : this.state.screen === "notebook"
          ? "여행 수첩"
          : this.state.screen === "result"
            ? "여행 완료"
            : "설정";
  }

  private renderScreen(): string {
    switch (this.state.screen) {
      case "title":
        return this.renderTitle();
      case "routes":
        return this.renderRoutes();
      case "game":
        return this.renderGame();
      case "notebook":
        return this.renderNotebook();
      case "result":
        return this.renderResult();
      case "settings":
        return this.renderSettings();
    }
  }

  private renderTitle(): string {
    const hasSave = Boolean(this.save.activeRun);
    return `<main class="screen title-screen" aria-labelledby="main-title"><div class="sky-art" aria-hidden="true"><span class="sun"></span><span class="mountain mountain-one"></span><span class="mountain mountain-two"></span><span class="mountain mountain-three"></span></div><section class="title-card"><p class="eyebrow">음악 이론 모험 학습 게임</p><h1 id="main-title" tabindex="-1">음정<br />정거장</h1><div class="wood-sign">도레미 기차 여행</div><div class="train-hero" aria-label="레일 위를 달리는 주황색 기차" role="img"><span class="smoke smoke-one"></span><span class="smoke smoke-two"></span><div class="train-body"><span class="train-window"></span><span class="train-lamp"></span></div><div class="train-wheel wheel-one"></div><div class="train-wheel wheel-two"></div></div></section><section class="title-lower"><div class="concept-row" aria-label="학습 표상"><div class="concept concept-green"><b>도</b><span>초록 도수</span></div><div class="concept concept-yellow"><b>음</b><span>노랑 반음</span></div><div class="concept concept-red"><b>소</b><span>빨강 청음</span></div></div><button class="primary-button hero-cta" data-action="start-routes">출발하기 <span aria-hidden="true">→</span></button><button class="secondary-button ${hasSave ? "" : "is-disabled"}" data-action="resume" ${hasSave ? "" : "disabled"} aria-describedby="resume-help">${hasSave ? "이어 운행하기" : "이어하기"}</button><p id="resume-help" class="button-help">${hasSave ? "마지막 안전 checkpoint에서 시작해요" : "저장된 운행이 없어요"}</p><div class="quick-actions"><button class="ghost-button" data-action="open-notebook">여행 수첩</button><button class="ghost-button" data-action="open-settings">설정</button></div></section></main>`;
  }

  private renderRoutes(): string {
    const modes: Mode[] = ["intro", "basic", "full", "ear", "mixed"];
    return `<main class="screen route-screen" aria-labelledby="main-title"><header class="screen-header"><button class="icon-button" data-action="${this.save.activeRun ? "resume" : "start-routes"}" aria-label="뒤로">←</button><div class="wood-sign small-sign"><h1 id="main-title" tabindex="-1">노선을 고르세요</h1></div><button class="icon-button" data-action="open-settings" aria-label="설정">⚙</button></header><p class="screen-intro">도·음·소 순서로 달리며 음정 감각을 키워요.</p><div class="route-list">${modes.map((mode, index) => this.renderRouteCard(mode, index)).join("")}</div><button class="bottom-link" data-action="open-notebook">내 여행 수첩 보기 →</button></main>`;
  }

  private renderRouteCard(mode: Mode, index: number): string {
    const meta = MODE_META[mode];
    const locked = !this.isUnlocked(mode);
    const star = this.save.stars[mode] ?? 0;
    const active = this.save.activeRun?.mode === mode;
    return `<button class="route-card route-${meta.color} ${locked ? "is-locked" : ""}" data-action="start-mode" data-mode="${mode}" ${locked ? "disabled" : ""} aria-describedby="route-help-${mode}"><span class="route-number">${String(index + 1).padStart(2, "0")}</span><span class="route-token">${meta.icon}</span><span class="route-copy"><strong>${meta.title}</strong><span>${meta.subtitle}</span><small id="route-help-${mode}">${locked ? this.unlockReason(mode) : active ? "진행 중인 운행을 이어가요" : meta.goal}</small></span><span class="route-stars" aria-label="최고 별 ${star}개">${"★".repeat(star)}${"☆".repeat(3 - star)}</span>${locked ? '<span class="lock-mark" aria-hidden="true">🔒</span>' : active ? '<span class="active-mark">이어 운행</span>' : ""}</button>`;
  }

  private renderGame(): string {
    const card = this.currentCard;
    const meta = MODE_META[this.mode];
    const progress = modeProgress(this.mode, this.state.roundNotebook);
    return `<main class="screen game-screen route-${meta.color}" aria-labelledby="main-title"><header class="game-hud"><div class="hud-sign">${meta.title}</div><div class="hud-progress" aria-label="${progress.total}개 중 ${progress.current}개 해결"><span>${progress.current}</span><span class="progress-slash">/</span><span>${progress.total}</span></div><div class="hud-actions"><button class="hud-button" data-action="open-notebook" aria-label="수첩">▦</button><button class="hud-button" data-action="pause" aria-label="일시정지">Ⅱ</button></div></header><h1 id="main-title" class="sr-only" tabindex="-1">${meta.title}</h1>${this.renderBoard(card)}<section class="play-panel" aria-label="현재 카드와 입력">${this.renderCard(card)}${this.renderControls(card)}</section></main>`;
  }

  private renderBoard(card: Card | null): string {
    const ear =
      card?.type === "red" && (this.state.phase === "earReady" || this.state.phase === "earGuess");
    return `<section class="board-section ${ear ? "board-muted" : ""}" aria-label="${ear ? "청음 미션 보드" : "25칸 음정 보드"}"><div class="board-caption">${ear ? "" : "<span>한 칸 = 반음</span><span>12번 = 중앙 도 · C4</span>"}</div><div class="board-scroll"><div class="board-track"><div class="rail-line" aria-hidden="true"></div>${BOARD.map(
      (cell) => {
        const selected = this.state.selected === cell.idx;
        const current = this.state.position === cell.idx;
        const disabled = card?.type === "green" && !cell.isWhite;
        return `<button class="board-cell ${cell.isWhite ? "is-white" : "is-black"} ${selected ? "is-selected" : ""} ${current ? "is-current" : ""} ${cell.isStart ? "is-start" : ""}" data-action="cell" data-index="${cell.idx}" ${disabled || ear ? "disabled" : ""} aria-label="${cell.idx}번 ${cell.ko} ${cell.en}${cell.isStart ? " 중앙 도 출발역" : ""}${disabled ? " 터널, 통과만" : ""}">${current ? "🚂" : ""}<b>${cell.idx}</b><span>${cell.ko}</span><small>${cell.en}</small></button>`;
      },
    ).join(
      "",
    )}</div></div>${ear ? '<p class="board-lock-note">청음 중에는 보드를 보지 않고 귀로 찾아요.</p>' : ""}<div class="count-strip" aria-label="학습 정보"><span class="count-chip">${card?.type === "green" ? "① 출발음을 1로" : card?.type === "yellow" ? "반음 칸을 세어요" : "두 음의 간격을 들어요"}</span><span class="count-chip quiet">${this.state.position}번 정거장</span></div></section>`;
  }

  private renderCard(card: Card | null): string {
    if (!card)
      return `<div class="card-empty"><div class="deck-stack"></div><p>카드를 준비하는 중…</p></div>`;
    const publicRed = card.type === "red" && !this.state.feedback?.reveal;
    const label = publicRed
      ? "소리 미션"
      : card.type === "green"
        ? `도수 열차 · ${card.degree}단계`
        : card.type === "yellow"
          ? "음정 역 · 반음 세기"
          : "소리 미션 · 지휘자 공개";
    const title = publicRed ? "소리 미션" : card.title;
    const sub = publicRed ? "두 음을 듣고 12개 음정 중 골라요" : card.sub;
    return `<article class="mission-card card-${card.type} ${publicRed ? "card-secret" : ""}" aria-label="${label}"><div class="card-topline"><span>${card.type === "green" ? "●" : card.type === "yellow" ? "▥" : "◖◗"}</span><span>${label}</span></div><div class="card-illustration" aria-hidden="true">${card.type === "green" ? "👣" : card.type === "yellow" ? "▤" : "♫"}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(sub)}</p>${!publicRed && this.state.feedback?.reveal ? `<div class="card-back-reveal">${escapeHtml(card.back)}</div>` : ""}<div class="card-footer"><span>${publicRed ? "정답은 공개되지 않아요" : `카드 ${card.id}`}</span><span class="card-corner">${card.type === "green" ? "도" : card.type === "yellow" ? "음" : "소"}</span></div></article>`;
  }

  private renderControls(card: Card | null): string {
    if (!card) return "";
    if (this.state.phase === "correction") return this.renderCorrection();
    if (this.state.phase === "feedback" && this.state.feedback) return this.renderFeedback(card);
    if (card.type === "red") return this.renderEarControls(card);
    const selectedText =
      this.state.selected === null
        ? "도착할 정거장을 골라 주세요"
        : `${this.state.selected}번 ${BOARD[this.state.selected]?.ko ?? "정거장"} 선택`;
    return `<div class="answer-controls"><p class="selection-preview"><span class="preview-dot"></span>${selectedText}</p><div class="action-row"><button class="primary-button" data-action="submit" ${this.state.selected === null ? "disabled" : ""}>출발 확정 <span aria-hidden="true">→</span></button><button class="secondary-button small" data-action="open-ruler">음정 자</button></div><p class="microcopy">${card.type === "green" ? "검은 터널은 세지 않고 지나가요." : "보드의 모든 칸은 반음 한 칸이에요."}</p></div>`;
  }

  private renderEarControls(card: RedCard): string {
    if (this.state.phase === "earReady")
      return `<div class="ear-controls"><p class="ear-guide">카드를 뒤집지 않고, 두 음만 들어요.</p><button class="primary-button ear-button" data-action="ear-play">▶ 두 음 듣기</button><p class="microcopy">첫 재생은 다시 듣기 횟수에 포함되지 않아요.</p></div>`;
    if (this.state.phase === "earGuess")
      return `<div class="ear-controls"><div class="ear-heading"><span>어떤 음정일까요?</span><button class="secondary-button small" data-action="ear-replay">↻ 다시 듣기 <b>${this.state.earReplays}</b></button></div><div class="interval-grid" role="group" aria-label="12개 음정 선택">${INTERVALS.slice(
        1,
      )
        .map(
          (interval) =>
            `<button class="interval-choice" data-action="choose-ear" data-semi="${interval.semi}"><span class="interval-number">${interval.semi}</span><span>${interval.name}</span></button>`,
        )
        .join(
          "",
        )}</div>${this.state.earReplays > 3 ? '<p class="assist-note">많이 들었어요. 다음 문제에서는 첫 소리에 집중해 볼까요?</p>' : ""}</div>`;
    return this.renderFeedback(card);
  }

  private renderCorrection(): string {
    const target = this.state.correctionTarget;
    const selected = this.state.correctionSelected;
    return `<div class="correction-panel" aria-labelledby="correction-title"><div class="popo" aria-hidden="true">🐻</div><div><h3 id="correction-title">포포의 다시 세기</h3><p>${escapeHtml(this.state.feedback?.body ?? "같이 한 칸씩 세어 봐요.")}</p><div class="correction-path"><span class="path-start">${this.state.position}</span><span class="path-dots">···</span><span class="path-wrong">${selected ?? "?"}</span><span class="path-arrow">→</span><span class="path-target">${target ?? "?"}</span></div><p class="microcopy">회색 기차가 선택한 길로 가 보고, 정답 경로를 한 번 더 보여 줄게요.</p><button class="primary-button" data-action="retry">다시 도전하기</button></div></div>`;
  }

  private renderFeedback(card: Card): string {
    const feedback = this.state.feedback;
    if (!feedback) return "";
    const correct = feedback.kind === "correct";
    const reveal =
      feedback.reveal && card.type === "red"
        ? `<div class="revealed-answer"><strong>${card.intervalName}</strong><span>${card.semi}반음 · ${INTERVALS[card.semi]?.song ?? "대표 소리"}</span></div>`
        : "";
    const isFirstRedWrong = card.type === "red" && !correct && this.state.earAttempts === 1;
    const action = isFirstRedWrong
      ? "ear-replay"
      : feedback.kind === "correct" && isModeClear(this.mode, this.state.roundNotebook)
        ? "finish"
        : "next";
    const label = isFirstRedWrong ? "다시 듣고 도전" : feedback.nextLabel;
    return `<div class="feedback-panel ${feedback.kind}" role="status"><div class="feedback-icon" aria-hidden="true">${correct ? "✓" : feedback.kind === "out" ? "↗" : "↺"}</div><div class="feedback-copy"><h3>${escapeHtml(feedback.title)}</h3><p>${escapeHtml(feedback.body)}</p>${feedback.transfer?.length ? `<small>환승: ${feedback.transfer.join(" → ")}</small>` : ""}${reveal}</div><button class="primary-button" data-action="${action}">${label} <span aria-hidden="true">→</span></button></div>`;
  }

  private renderNotebook(): string {
    const nb = this.save.notebook;
    const totalSolved = nb.yellow.length + nb.red.length;
    const modeStars = Object.values(this.save.stars).reduce((sum, value) => sum + (value ?? 0), 0);
    return `<main class="screen notebook-screen" aria-labelledby="main-title"><header class="screen-header"><button class="icon-button" data-action="${this.state.mode ? "return-game" : "routes"}" aria-label="뒤로">←</button><div class="wood-sign small-sign"><h1 id="main-title" tabindex="-1">여행 수첩</h1></div><button class="icon-button" data-action="open-settings" aria-label="설정">⚙</button></header><div class="notebook-tabs"><button class="tab is-active">스탬프</button><span class="notebook-summary">${totalSolved}개 해결 · ${modeStars}별</span></div><section class="degree-sheet"><div class="sheet-heading"><span>도</span><h2>도수 연습</h2><small>출발음을 1로 세기</small></div><div class="degree-grid">${[2, 3, 4, 5].map((degree) => `<div class="degree-stamp ${nb.greenDegrees.includes(degree) ? "is-full" : ""}"><span>${nb.greenDegrees.includes(degree) ? "✓" : "·"}</span><b>${degree}도</b></div>`).join("")}</div></section><section class="interval-sheet"><div class="sheet-heading"><span>음 · 소</span><h2>음정 연결표</h2><small>이름 · 거리 · 소리</small></div><div class="interval-head"><span>반음</span><span>도수</span><span>음정 이름</span><span>소리</span></div>${INTERVALS.slice(
      1,
    )
      .map(
        (interval) =>
          `<div class="interval-row"><span class="semi-badge">${interval.semi}</span><span class="unused-cell">도수는 위에서</span><span class="interval-name-cell ${nb.yellow.includes(interval.semi) ? "is-full" : ""}">${interval.name}</span><span class="sound-cell ${nb.red.includes(interval.semi) ? "is-full" : nb.redAux.includes(interval.semi) ? "is-half" : ""}">${nb.red.includes(interval.semi) ? "●" : nb.redAux.includes(interval.semi) ? "◐" : "○"}</span></div>`,
      )
      .join(
        "",
      )}</section><section class="stats-card"><h2>운행 통계</h2><div class="stat-grid"><div><b>${this.save.stats.totalTurns}</b><span>완료 카드</span></div><div><b>${this.save.stats.correctAttempts}</b><span>정답 시도</span></div><div><b>${this.save.stats.bestStreak}</b><span>최고 연속</span></div></div><p class="microcopy">이번 운행의 승리 조건은 현재 판에서 새로 해결한 스탬프로만 계산해요.</p></section></main>`;
  }

  private renderResult(): string {
    const clear = this.state.lastClear;
    if (!clear) return this.renderRoutes();
    const meta = MODE_META[clear.mode];
    return `<main class="screen result-screen route-${meta.color}" aria-labelledby="main-title"><div class="result-confetti" aria-hidden="true">✦ ✧ ✦</div><header class="screen-header result-header"><div class="wood-sign"><h1 id="main-title" tabindex="-1">여행 완료!</h1></div></header><p class="result-kicker">${meta.title} 종착역 도착</p><div class="result-train" aria-hidden="true">🚂</div><section class="result-card"><div class="star-row" aria-label="${clear.stars}별">${[1, 2, 3].map((star) => `<span class="${star <= clear.stars ? "lit" : ""}">★</span>`).join("")}</div><h2>새로 찍은 스탬프</h2><div class="new-stamps">${clear.newStamps.length ? clear.newStamps.map((stamp) => `<span>✓ ${escapeHtml(stamp)}</span>`).join("") : "<span>이번 운행의 기록을 확인했어요.</span>"}</div><div class="result-metrics"><div><b>${this.save.stats.correctAttempts}</b><span>정답 시도</span></div><div><b>${this.save.stats.bestStreak}</b><span>최고 연속</span></div><div><b>${this.save.notebook.yellow.length + this.save.notebook.red.length}</b><span>누적 음정</span></div></div></section><div class="result-actions"><button class="primary-button" data-action="replay-mode">다시 타기</button><button class="secondary-button" data-action="routes">다른 노선 보기</button><button class="ghost-button" data-action="open-notebook">수첩에서 복습하기</button></div></main>`;
  }

  private renderSettings(): string {
    return `<main class="screen settings-screen" aria-labelledby="main-title"><header class="screen-header"><button class="icon-button" data-action="${this.state.mode ? "return-game" : "routes"}" aria-label="뒤로">←</button><div class="wood-sign small-sign"><h1 id="main-title" tabindex="-1">설정</h1></div><span class="header-spacer"></span></header><section class="settings-card"><div class="setting-row"><div><strong>소리 크기</strong><small>음정과 효과음의 전체 크기</small></div><output>${Math.round(this.settings.volume * 100)}%</output><input type="range" min="0" max="100" value="${Math.round(this.settings.volume * 100)}" data-setting="volume" aria-label="소리 크기" /></div><div class="setting-row"><div><strong>음소거</strong><small>소리를 끄고 글자 피드백만 사용</small></div><button class="toggle ${this.settings.muted ? "is-on" : ""}" data-action="toggle-mute" aria-pressed="${this.settings.muted}">${this.settings.muted ? "켜짐" : "꺼짐"}</button></div><div class="setting-row"><div><strong>진동</strong><small>정답·오답 신호에 짧은 진동 사용</small></div><button class="toggle ${this.settings.vibration ? "is-on" : ""}" data-action="toggle-vibration" aria-pressed="${this.settings.vibration}">${this.settings.vibration ? "켜짐" : "꺼짐"}</button></div><div class="setting-row setting-column"><div><strong>모션</strong><small>기차 이동과 장식 애니메이션</small></div><div class="segmented"><button class="${this.settings.motion === "system" ? "is-selected" : ""}" data-action="motion" data-motion="system">시스템</button><button class="${this.settings.motion === "reduced" ? "is-selected" : ""}" data-action="motion" data-motion="reduced">줄이기</button><button class="${this.settings.motion === "full" ? "is-selected" : ""}" data-action="motion" data-motion="full">전체</button></div></div><button class="secondary-button full-width" data-action="sound-guide">소리 안내 다시 듣기</button><button class="secondary-button full-width" data-action="tutorial">튜토리얼 다시 보기</button></section><section class="settings-card danger-card"><h2>학습 데이터</h2><p>누적 수첩, 별, 통계와 진행 중인 운행을 기기에서 삭제합니다.</p><button class="danger-button" data-action="reset-data">데이터 초기화</button></section><p class="app-version">음정 정거장 v2.0 · 오프라인 준비 완료</p></main>`;
  }

  private renderModal(modal: Exclude<Modal, null>): string {
    const content =
      modal === "pause"
        ? `<h2>잠깐 쉬어 갈까요?</h2><p>현재 운행은 안전하게 멈춰 있어요.</p><button class="primary-button full-width" data-action="resume-game">이어 운행</button><button class="secondary-button full-width" data-action="open-notebook">수첩 보기</button><button class="ghost-button full-width" data-action="exit-game">노선으로 나가기</button>`
        : modal === "ruler"
          ? `<h2>음정 자</h2><p>답을 제출한 뒤 음정 이름과 반음 수를 연결해 보세요.</p><div class="ruler-grid">${INTERVALS.slice(
              1,
            )
              .map((interval) => `<span><b>${interval.semi}</b>${interval.name}</span>`)
              .join(
                "",
              )}</div><button class="primary-button full-width" data-action="close-modal">닫기</button>`
          : modal === "confirm-exit"
            ? `<h2>다른 운행을 시작할까요?</h2><p>현재 운행은 안전 checkpoint에 저장됩니다. 새 노선으로 바꾸면 이번 운행만 초기화돼요.</p><button class="primary-button full-width" data-action="confirm-new">새 운행 시작</button><button class="secondary-button full-width" data-action="cancel">계속 머무르기</button>`
            : modal === "confirm-reset"
              ? `<h2>정말 초기화할까요?</h2><p>누적 수첩과 별, 통계, 이어하기가 모두 삭제됩니다. 앱 자체는 삭제되지 않아요.</p><button class="danger-button full-width" data-action="confirm-reset">초기화하기</button><button class="secondary-button full-width" data-action="cancel">취소</button>`
              : modal === "tutorial"
                ? `<h2>포포의 3단계 실습</h2><ol class="tutorial-list"><li><b>카드 뽑기</b><span>카드의 색이 오늘 배울 표상을 알려 줘요.</span></li><li><b>정거장 고르기</b><span>초록은 흰건반, 노랑은 모든 반음 칸을 세어요.</span></li><li><b>도착·복습</b><span>틀려도 포포와 다시 세어 보고, 수첩에 기록해요.</span></li></ol><button class="primary-button full-width" data-action="close-modal">알겠어요, 출발!</button>`
                : `<h2>보너스!</h2><p>학습을 이어 갈수록 수첩에 새로운 연결이 쌓여요.</p><button class="primary-button full-width" data-action="close-modal">계속</button>`;
    return `<div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span class="modal-deco" aria-hidden="true">✦</span>${content.replace("<h2>", '<h2 id="modal-title">')}</section></div>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char,
  );
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("앱 루트를 찾을 수 없습니다.");
new AppController(root);
