import { hz } from "../theory/index";

/** Harmonics are shared by every station; no samples or network requests. */
export const HARMONICS = [0, 1, 0.55, 0.32, 0.17, 0.09, 0.05] as const;
export const MASTER_GAIN = 0.85;

export type Voice = {
  source: AudioScheduledSourceNode;
  disconnect(): void;
};

export function lowNoteGain(midi: number): number {
  return 1 + Math.max(0, 60 - midi) * 0.02;
}

export function createStationWave(context: AudioContext): PeriodicWave {
  return context.createPeriodicWave(
    new Float32Array(HARMONICS.length),
    new Float32Array(HARMONICS),
  );
}

export function createNoteVoice(
  context: AudioContext,
  output: AudioNode,
  wave: PeriodicWave,
  midi: number,
  when: number,
  duration: number,
  peak: number,
): Voice {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.setPeriodicWave(wave);
  oscillator.frequency.setValueAtTime(hz(midi), when);
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.linearRampToValueAtTime(peak * lowNoteGain(midi), when + 0.008);
  envelope.gain.setTargetAtTime(0.0001, when + 0.008, duration / 4);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.05);
  return {
    source: oscillator,
    disconnect: () => {
      oscillator.disconnect();
      envelope.disconnect();
    },
  };
}
