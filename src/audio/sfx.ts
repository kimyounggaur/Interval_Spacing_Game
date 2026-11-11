import type { Voice } from "./voice";

export type SfxName = "wheel" | "tunnel" | "stamp" | "wrong" | "punch" | "window" | "star";
export type NoiseBurst = {
  offset: number;
  duration: number;
  frequency: number;
  q: number;
  peak: number;
};

/** Filter frequencies colour white noise; these are never pitched oscillators. */
export function noiseBursts(name: SfxName): NoiseBurst[] {
  const burst = (offset: number, duration: number, frequency: number, q: number, peak: number) => ({
    offset,
    duration,
    frequency,
    q,
    peak,
  });
  switch (name) {
    case "wheel":
      return [burst(0, 0.06, 950, 1.1, 0.07)];
    case "tunnel":
      return [burst(0, 0.09, 320, 0.8, 0.2)];
    case "stamp":
      return [burst(0, 0.05, 2400, 0.7, 0.22), burst(0.02, 0.12, 180, 0.9, 0.5)];
    case "wrong":
      return [burst(0, 0.07, 520, 1.2, 0.2), burst(0.11, 0.07, 420, 1.2, 0.2)];
    case "punch":
      return [burst(0, 0.045, 1600, 0.8, 0.19)];
    case "window":
      return [burst(0, 0.16, 640, 0.6, 0.08)];
    case "star":
      return [burst(0, 0.07, 2800, 0.5, 0.16), burst(0.08, 0.1, 3600, 0.4, 0.12)];
  }
}

export function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
  return noise;
}

export function createNoiseVoice(
  context: AudioContext,
  output: AudioNode,
  noise: AudioBuffer,
  when: number,
  burst: NoiseBurst,
): Voice {
  const source = context.createBufferSource();
  source.buffer = noise;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = burst.frequency;
  filter.Q.value = burst.q;
  const envelope = context.createGain();
  const start = when + burst.offset;
  envelope.gain.setValueAtTime(burst.peak, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + burst.duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(output);
  source.start(start);
  source.stop(start + burst.duration + 0.02);
  return {
    source,
    disconnect: () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    },
  };
}
