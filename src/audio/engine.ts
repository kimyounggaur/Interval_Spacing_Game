import { Sequencer } from "./sequencer";
import type { AudioGroup, Presentation } from "./sequencer";
import { createNoiseBuffer } from "./sfx";
import type { SfxName } from "./sfx";
import { createStationWave, MASTER_GAIN } from "./voice";

export type { AudioGroup, Presentation, SfxName };
export type AudioState = "locked" | "running" | "suspended" | "unavailable";
export type AudioSettings = { volume: number; muted: boolean };
export const UNLOCK_EVENTS = [
  "pointerdown",
  "pointerup",
  "touchstart",
  "touchend",
  "keydown",
  "click",
] as const;

export interface AudioPort {
  readonly state: AudioState;
  readonly running: boolean;
  unlock(): Promise<boolean>;
  setSettings(settings: AudioSettings): void;
  playTick(midi: number, delay?: number, tunnel?: boolean): void;
  playStart(midi: number): void;
  playInterval(fromMidi: number, toMidi: number, delay?: number, presentation?: Presentation): void;
  playEar(fromMidi: number, toMidi: number, presentation?: Presentation): void;
  playMelody(midis: readonly number[]): void;
  sfx(name: SfxName): void;
  cancel(group?: AudioGroup): void;
  subscribe(listener: (state: AudioState) => void): () => void;
  dispose(): void;
}

export class NullAudio implements AudioPort {
  readonly state: AudioState = "unavailable";
  readonly running = false;
  async unlock(): Promise<boolean> {
    return false;
  }
  setSettings(_settings: AudioSettings): void {
    /* Visual play remains available. */
  }
  playTick(_midi: number, _delay?: number, _tunnel?: boolean): void {
    /* no audio API */
  }
  playStart(_midi: number): void {
    /* no audio API */
  }
  playInterval(_from: number, _to: number, _delay?: number, _presentation?: Presentation): void {
    /* no audio API */
  }
  playEar(_from: number, _to: number, _presentation?: Presentation): void {
    /* no audio API */
  }
  playMelody(_midis: readonly number[]): void {
    /* no audio API */
  }
  sfx(_name: SfxName): void {
    /* no audio API */
  }
  cancel(_group?: AudioGroup): void {
    /* no audio API */
  }
  subscribe(listener: (state: AudioState) => void): () => void {
    listener(this.state);
    return () => {
      /* no subscription is retained */
    };
  }
  dispose(): void {
    /* no audio API */
  }
}

export class WebAudioEngine implements AudioPort {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sequencer: Sequencer | null = null;
  private settings: AudioSettings = { volume: 0.75, muted: false };
  private listeners = new Set<(state: AudioState) => void>();
  private resuming: Promise<boolean> | null = null;
  private disposed = false;
  private failed = false;
  private readonly gesture = () => {
    void this.unlock();
  };
  private readonly statechange = () => {
    this.notify();
  };

  constructor(
    private readonly contextFactory: () => AudioContext,
    private readonly eventTarget?: EventTarget,
  ) {
    for (const name of UNLOCK_EVENTS) {
      eventTarget?.addEventListener(name, this.gesture, { capture: true, passive: true });
    }
  }

  get state(): AudioState {
    if (this.disposed || this.failed) return "unavailable";
    if (!this.context) return "locked";
    return this.context.state === "running"
      ? "running"
      : this.context.state === "closed"
        ? "unavailable"
        : "suspended";
  }

  get running(): boolean {
    return this.state === "running";
  }

  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    if (this.resuming) return this.resuming;
    try {
      if (!this.context || this.context.state === "closed") {
        this.context?.removeEventListener("statechange", this.statechange);
        this.context = this.contextFactory();
        this.failed = false;
        this.master = this.context.createGain();
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 12;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.18;
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
        this.applySettings();
        this.sequencer = new Sequencer(
          this.context,
          this.master,
          createStationWave(this.context),
          createNoiseBuffer(this.context),
        );
        this.context.addEventListener("statechange", this.statechange);
      }
      if (this.context.state === "running") {
        this.notify();
        return true;
      }
      this.resuming = this.context.resume().then(
        () => {
          this.notify();
          return this.running;
        },
        () => {
          // Gesture policies may refuse a resume. A later gesture can retry.
          this.notify();
          return false;
        },
      );
      return await this.resuming;
    } catch {
      // Audio API construction can be disabled by the browser or device.
      this.failed = true;
      this.notify();
      return false;
    } finally {
      this.resuming = null;
    }
  }

  setSettings(settings: AudioSettings): void {
    this.settings = {
      volume: Number.isFinite(settings.volume) ? Math.max(0, Math.min(1, settings.volume)) : 0.75,
      muted: settings.muted,
    };
    this.applySettings();
  }

  playTick(midi: number, delay = 0, tunnel = false): void {
    if (this.running) this.sequencer?.playTick(midi, delay, tunnel);
  }
  playStart(midi: number): void {
    if (this.running) this.sequencer?.playStart(midi);
  }
  playInterval(
    fromMidi: number,
    toMidi: number,
    delay = 0,
    presentation: Presentation = "melody",
  ): void {
    if (this.running) this.sequencer?.playInterval(fromMidi, toMidi, delay, presentation);
  }
  playEar(fromMidi: number, toMidi: number, presentation: Presentation = "melody"): void {
    if (this.running) this.sequencer?.playEar(fromMidi, toMidi, presentation);
  }
  playMelody(midis: readonly number[]): void {
    if (this.running) this.sequencer?.playMelody(midis);
  }
  sfx(name: SfxName): void {
    if (this.running) this.sequencer?.sfx(name);
  }
  cancel(group?: AudioGroup): void {
    this.sequencer?.cancel(group);
  }

  subscribe(listener: (state: AudioState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
    for (const name of UNLOCK_EVENTS) {
      this.eventTarget?.removeEventListener(name, this.gesture, { capture: true });
    }
    this.context?.removeEventListener("statechange", this.statechange);
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {
        /* browser may already have closed it */
      });
    this.notify();
    this.listeners.clear();
  }

  private applySettings(): void {
    if (this.master && this.context) {
      this.master.gain.setValueAtTime(
        this.settings.muted ? 0 : MASTER_GAIN * this.settings.volume,
        this.context.currentTime,
      );
    }
  }
  private notify(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}

export function createAudio(): AudioPort {
  if (typeof window === "undefined") return new NullAudio();
  const audioWindow = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  return Context ? new WebAudioEngine(() => new Context(), window) : new NullAudio();
}
