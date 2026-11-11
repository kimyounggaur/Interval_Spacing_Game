import { createNoteVoice } from "./voice";
import type { Voice } from "./voice";
import { createNoiseVoice, noiseBursts } from "./sfx";
import type { SfxName } from "./sfx";

export type AudioGroup = "tick" | "interval" | "sfx" | "melody";
export type Presentation = "melody" | "chord";
export const INTERVAL_OFFSETS = [0, 0.62, 1.42, 1.42] as const;

/** Every note is scheduled against currentTime in the same event turn. */
export class Sequencer {
  private groups = new Map<AudioGroup, Set<Voice>>();

  constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
    private readonly wave: PeriodicWave,
    private readonly noise: AudioBuffer,
  ) {}

  private keep(voice: Voice, group: AudioGroup): void {
    const voices = this.groups.get(group) ?? new Set<Voice>();
    voices.add(voice);
    this.groups.set(group, voices);
    voice.source.addEventListener(
      "ended",
      () => {
        voices.delete(voice);
        voice.disconnect();
      },
      { once: true },
    );
  }

  private note(
    midi: number,
    when: number,
    duration: number,
    peak: number,
    group: AudioGroup,
  ): void {
    if (!Number.isFinite(midi)) return;
    this.keep(
      createNoteVoice(this.context, this.output, this.wave, midi, when, duration, peak),
      group,
    );
  }

  private noiseAt(name: SfxName, when: number, group: AudioGroup): void {
    for (const burst of noiseBursts(name)) {
      this.keep(createNoiseVoice(this.context, this.output, this.noise, when, burst), group);
    }
  }

  cancel(group?: AudioGroup): void {
    const groups = group ? [group] : [...this.groups.keys()];
    for (const key of groups) {
      const voices = this.groups.get(key);
      if (!voices) continue;
      for (const voice of voices) {
        try {
          voice.source.stop();
        } catch {
          /* Source may have ended already. */
        }
      }
      voices.clear();
    }
  }

  playTick(midi: number, delay = 0, tunnel = false): void {
    const when = this.context.currentTime + Math.max(0, delay);
    if (tunnel) this.noiseAt("tunnel", when, "tick");
    else this.note(midi, when, 0.22, 0.34, "tick");
    this.noiseAt("wheel", when, "tick");
  }

  playStart(midi: number): void {
    this.cancel("interval");
    this.note(midi, this.context.currentTime + 0.03, 0.9, 0.4, "interval");
  }

  playInterval(from: number, to: number, delay = 0, presentation: Presentation = "melody"): void {
    this.cancel("interval");
    this.cancel("tick");
    this.cancel("melody");
    const start = this.context.currentTime + 0.05 + Math.max(0, delay);
    if (presentation === "chord") {
      this.note(from, start, 1.1, 0.3, "interval");
      this.note(to, start, 1.1, 0.3, "interval");
      return;
    }
    const midis = [from, to, from, to];
    for (let index = 0; index < INTERVAL_OFFSETS.length; index += 1) {
      this.note(
        midis[index] as number,
        start + INTERVAL_OFFSETS[index]!,
        index < 2 ? 0.7 : 1.1,
        index < 2 ? 0.4 : 0.3,
        "interval",
      );
    }
  }

  playEar(from: number, to: number, presentation: Presentation = "melody"): void {
    this.cancel("interval");
    this.cancel("tick");
    this.cancel("melody");
    const start = this.context.currentTime + 0.05;
    this.note(from, start, presentation === "chord" ? 1.1 : 0.7, 0.4, "interval");
    this.note(
      to,
      start + (presentation === "chord" ? 0 : 0.62),
      presentation === "chord" ? 1.1 : 0.7,
      0.4,
      "interval",
    );
  }

  playMelody(midis: readonly number[]): void {
    this.cancel("interval");
    this.cancel("tick");
    this.cancel("melody");
    const start = this.context.currentTime + 0.05;
    midis.forEach((midi, index) => this.note(midi, start + index * 0.3, 0.4, 0.3, "melody"));
  }

  sfx(name: SfxName): void {
    this.noiseAt(name, this.context.currentTime, "sfx");
  }
}
