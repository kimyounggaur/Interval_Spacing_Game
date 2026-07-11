import { midiToHz } from "../domain/engine";

export type SfxName = "whistle" | "tick" | "correct" | "wrong" | "flip" | "stamp" | "transfer";
export type AudioChannel = "note" | "interval" | "sfx";

export interface AudioPort {
  unlock(): Promise<"ready" | "needs-gesture" | "failed">;
  playNote(midi: number): Promise<void>;
  playLearningInterval(firstMidi: number, secondMidi: number): Promise<void>;
  playEarInterval(firstMidi: number, secondMidi: number): Promise<void>;
  playSfx(name: SfxName, midi?: number): Promise<void>;
  setVolume(value: number): void;
  setMuted(muted: boolean): void;
  stopChannel(channel: AudioChannel): void;
  suspend(): Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export class NullAudioAdapter implements AudioPort {
  private volume = 0.75;
  private muted = false;
  async unlock(): Promise<"ready"> {
    return "ready";
  }
  async playNote(_midi: number): Promise<void> {
    await wait(80);
  }
  async playLearningInterval(_firstMidi: number, _secondMidi: number): Promise<void> {
    await wait(1750);
  }
  async playEarInterval(_firstMidi: number, _secondMidi: number): Promise<void> {
    await wait(1600);
  }
  async playSfx(_name: SfxName, _midi?: number): Promise<void> {
    await wait(80);
  }
  setVolume(value: number): void {
    this.volume = value;
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
  }
  stopChannel(_channel: AudioChannel): void {
    /* Null adapter intentionally has no voices. */
  }
  async suspend(): Promise<void> {
    await wait(0);
  }
  get config(): { volume: number; muted: boolean } {
    return { volume: this.volume, muted: this.muted };
  }
}

export class WebAudioAdapter implements AudioPort {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.75;
  private muted = false;
  private voices = new Map<AudioChannel, OscillatorNode[]>();

  async unlock(): Promise<"ready" | "needs-gesture" | "failed"> {
    try {
      if (!this.context) {
        const AudioContextCtor = window.AudioContext;
        if (!AudioContextCtor) return "failed";
        this.context = new AudioContextCtor();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.applyMaster();
      }
      if (this.context.state === "suspended") await this.context.resume();
      return this.context.state === "running" ? "ready" : "needs-gesture";
    } catch {
      return "failed";
    }
  }

  async playNote(midi: number): Promise<void> {
    await this.playTone(midiToHz(midi), 1.3, "note");
  }
  async playLearningInterval(firstMidi: number, secondMidi: number): Promise<void> {
    await this.playSequence(firstMidi, secondMidi, 800, 150, "interval");
  }
  async playEarInterval(firstMidi: number, secondMidi: number): Promise<void> {
    await this.playSequence(firstMidi, secondMidi, 700, 200, "interval");
  }
  async playSfx(name: SfxName, midi = 72): Promise<void> {
    const duration = name === "whistle" ? 0.55 : name === "stamp" ? 0.18 : 0.12;
    await this.playTone(midiToHz(midi), duration, "sfx", name === "wrong");
  }
  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.applyMaster();
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMaster();
  }
  stopChannel(channel: AudioChannel): void {
    const active = this.voices.get(channel) ?? [];
    active.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        /* already stopped */
      }
    });
    this.voices.delete(channel);
  }
  async suspend(): Promise<void> {
    if (this.context?.state === "running") await this.context.suspend();
  }

  private async playSequence(
    firstMidi: number,
    secondMidi: number,
    duration: number,
    gap: number,
    channel: AudioChannel,
  ): Promise<void> {
    this.stopChannel(channel);
    await this.playTone(midiToHz(firstMidi), duration / 1000, channel);
    await wait(gap);
    await this.playTone(midiToHz(secondMidi), duration / 1000, channel);
  }

  private async playTone(
    frequency: number,
    duration: number,
    channel: AudioChannel,
    descending = false,
  ): Promise<void> {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    if (descending) oscillator.detune.setValueAtTime(-80, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.32, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    const list = this.voices.get(channel) ?? [];
    list.push(oscillator);
    this.voices.set(channel, list);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
    await wait(duration * 1000 + 40);
    this.voices.set(
      channel,
      (this.voices.get(channel) ?? []).filter((voice) => voice !== oscillator),
    );
  }

  private applyMaster(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }
}

export function createAudioAdapter(): AudioPort {
  return typeof window !== "undefined" && "AudioContext" in window
    ? new WebAudioAdapter()
    : new NullAudioAdapter();
}

export function vibrate(pattern: number | number[], enabled: boolean): void {
  if (!enabled || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* vibration is optional */
  }
}
