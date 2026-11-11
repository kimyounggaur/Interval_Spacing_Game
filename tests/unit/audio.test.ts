import { describe, expect, it, vi } from "vitest";
import { NullAudio, UNLOCK_EVENTS, WebAudioEngine } from "../../src/audio/engine";
import { HARMONICS, lowNoteGain } from "../../src/audio/voice";
import { hz } from "../../src/theory/index";

function parameter() {
  return {
    value: 0,
    setValueAtTime: vi.fn((_value: number, _when: number) => undefined),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
}
function node() {
  return { connect: vi.fn(), disconnect: vi.fn() };
}
function source() {
  const events = new EventTarget();
  return {
    ...node(),
    frequency: parameter(),
    setPeriodicWave: vi.fn(),
    start: vi.fn((_when?: number) => undefined),
    stop: vi.fn((_when?: number) => undefined),
    addEventListener: events.addEventListener.bind(events),
    finish: () => {
      events.dispatchEvent(new Event("ended"));
    },
    buffer: null as AudioBuffer | null,
  };
}
function harness() {
  const oscillators: ReturnType<typeof source>[] = [];
  const noises: ReturnType<typeof source>[] = [];
  const gains: {
    gain: ReturnType<typeof parameter>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const stateEvents = new EventTarget();
  let state: AudioContextState = "suspended";
  const context = {
    currentTime: 10,
    sampleRate: 100,
    destination: node(),
    get state() {
      return state;
    },
    resume: vi.fn(() => {
      state = "running";
      stateEvents.dispatchEvent(new Event("statechange"));
      return Promise.resolve();
    }),
    close: vi.fn(() => {
      state = "closed";
      return Promise.resolve();
    }),
    createGain: vi.fn(() => {
      const value = { ...node(), gain: parameter() };
      gains.push(value);
      return value;
    }),
    createOscillator: vi.fn(() => {
      const value = source();
      oscillators.push(value);
      return value;
    }),
    createBufferSource: vi.fn(() => {
      const value = source();
      noises.push(value);
      return value;
    }),
    createPeriodicWave: vi.fn((_real: Float32Array, _imaginary: Float32Array) => ({})),
    createDynamicsCompressor: vi.fn(() => ({
      ...node(),
      threshold: parameter(),
      knee: parameter(),
      ratio: parameter(),
      attack: parameter(),
      release: parameter(),
    })),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(100) })),
    createBiquadFilter: vi.fn(() => ({
      ...node(),
      type: "",
      frequency: parameter(),
      Q: parameter(),
    })),
    addEventListener: stateEvents.addEventListener.bind(stateEvents),
    removeEventListener: stateEvents.removeEventListener.bind(stateEvents),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  const events = new EventTarget();
  const audio = new WebAudioEngine(factory, events);
  return {
    audio,
    context,
    oscillators,
    noises,
    gains,
    events,
    factory,
    suspend: () => {
      state = "suspended";
      stateEvents.dispatchEvent(new Event("statechange"));
    },
  };
}

describe("DR2 clock-scheduled audio", () => {
  it("AU-01 uses equal temperament and the requested 1–6 harmonics", async () => {
    const { audio, oscillators, context } = harness();
    await audio.unlock();
    audio.playStart(69);
    expect(hz(69)).toBe(440);
    expect(hz(48)).toBeCloseTo(130.81278265, 6);
    expect(oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(440, 10.03);
    const imaginary = context.createPeriodicWave.mock.calls[0]?.[1];
    expect(imaginary).toEqual(new Float32Array(HARMONICS));
    expect(oscillators[0]?.setPeriodicWave).toHaveBeenCalledOnce();
  });

  it("AU-02 reserves departure, arrival and both chord notes immediately", async () => {
    const { audio, oscillators } = harness();
    await audio.unlock();
    audio.playInterval(60, 67, 0.25);
    expect(oscillators).toHaveLength(4);
    expect(oscillators.map((voice) => voice.start.mock.calls[0]?.[0])).toEqual([
      10.3, 10.92, 11.72, 11.72,
    ]);
    expect(oscillators.map((voice) => voice.frequency.setValueAtTime.mock.calls[0]?.[0])).toEqual([
      hz(60),
      hz(67),
      hz(60),
      hz(67),
    ]);
  });

  it("AU-03 boosts C3 by 24% and never boosts notes above C4", async () => {
    const { audio, gains } = harness();
    expect(lowNoteGain(48)).toBe(1.24);
    expect(lowNoteGain(60)).toBe(1);
    expect(lowNoteGain(72)).toBe(1);
    await audio.unlock();
    audio.playTick(48);
    expect(gains[1]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.34 * 1.24, 10.008);
  });

  it("E-07 cancels all preceding interval and tick voices before replay", async () => {
    const { audio, oscillators } = harness();
    await audio.unlock();
    audio.playTick(60);
    audio.playInterval(60, 64);
    const old = [...oscillators];
    audio.playInterval(62, 67);
    for (const voice of old)
      expect(voice.stop.mock.calls.some((call) => call.length === 0)).toBe(true);
    expect(oscillators).toHaveLength(9);
    audio.cancel();
    expect(
      oscillators.every((voice) => voice.stop.mock.calls.some((call) => call.length === 0)),
    ).toBe(true);
  });

  it("K4 sound effects and degree tunnels use noise without pitched oscillators", async () => {
    const { audio, oscillators, noises } = harness();
    await audio.unlock();
    audio.playTick(61, 0.09, true);
    audio.sfx("stamp");
    audio.sfx("wrong");
    expect(oscillators).toHaveLength(0);
    expect(noises).toHaveLength(6);
    expect(noises[0]?.start).toHaveBeenCalledWith(10.09);
  });

  it("ear questions reserve two notes; chord questions reserve both simultaneously", async () => {
    const { audio, oscillators } = harness();
    await audio.unlock();
    audio.playEar(60, 64);
    expect(oscillators).toHaveLength(2);
    expect(oscillators[1]?.start).toHaveBeenCalledWith(10.67);
    audio.playEar(60, 64, "chord");
    expect(oscillators.slice(2).map((voice) => voice.start.mock.calls[0]?.[0])).toEqual([
      10.05, 10.05,
    ]);
  });

  it("all six gestures unlock and state subscribers observe suspend/recovery", async () => {
    for (const eventName of UNLOCK_EVENTS) {
      const { audio, events, factory } = harness();
      events.dispatchEvent(new Event(eventName));
      await Promise.resolve();
      expect(factory).toHaveBeenCalledOnce();
      expect(audio.running).toBe(true);
      audio.dispose();
    }
    const { audio, suspend } = harness();
    const states: string[] = [];
    const unsubscribe = audio.subscribe((state) => states.push(state));
    await audio.unlock();
    suspend();
    expect(audio.state).toBe("suspended");
    await audio.unlock();
    expect(audio.running).toBe(true);
    expect(states).toContain("locked");
    expect(states).toContain("suspended");
    unsubscribe();
  });

  it("repeated running unlocks emit no duplicate state notifications during native input events", async () => {
    const { audio, events, suspend } = harness();
    const first = vi.fn();
    audio.subscribe(first);
    expect(first.mock.calls).toEqual([["locked"]]);
    await audio.unlock();
    expect(first.mock.calls).toEqual([["locked"], ["running"]]);
    for (const name of UNLOCK_EVENTS) events.dispatchEvent(new Event(name));
    await audio.unlock();
    expect(first.mock.calls).toEqual([["locked"], ["running"]]);
    const second = vi.fn();
    audio.subscribe(second);
    expect(second.mock.calls).toEqual([["running"]]);
    await audio.unlock();
    expect(second).toHaveBeenCalledOnce();
    suspend();
    await audio.unlock();
    expect(first.mock.calls).toEqual([["locked"], ["running"], ["suspended"], ["running"]]);
    expect(second.mock.calls).toEqual([["running"], ["suspended"], ["running"]]);
  });

  it("volume and mute update the master; disposed gestures cannot recreate audio", async () => {
    const { audio, gains, factory, events } = harness();
    audio.setSettings({ volume: 0.5, muted: false });
    await audio.unlock();
    expect(gains[0]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0.425, 10);
    audio.setSettings({ volume: 0.5, muted: true });
    expect(gains[0]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10);
    audio.dispose();
    events.dispatchEvent(new Event("pointerdown"));
    await audio.unlock();
    expect(factory).toHaveBeenCalledOnce();
    expect(audio.state).toBe("unavailable");
  });

  it("gesture-policy rejection can recover and absent audio never blocks play", async () => {
    const { audio, context } = harness();
    context.resume.mockRejectedValueOnce(new Error("gesture required"));
    expect(await audio.unlock()).toBe(false);
    expect(audio.state).toBe("suspended");
    expect(await audio.unlock()).toBe(true);
    const fallback = new NullAudio();
    expect(await fallback.unlock()).toBe(false);
    expect(() => {
      fallback.playInterval(60, 64);
      fallback.playTick(61);
      fallback.sfx("stamp");
      fallback.cancel();
    }).not.toThrow();
  });

  it("ended voices disconnect, and a run melody is scheduled every 300ms", async () => {
    const { audio, oscillators } = harness();
    await audio.unlock();
    audio.playMelody([60, 64, 67]);
    expect(oscillators.map((voice) => voice.start.mock.calls[0]?.[0])).toEqual([
      10.05, 10.350000000000001, 10.65,
    ]);
    oscillators[0]?.finish();
    expect(oscillators[0]?.disconnect).toHaveBeenCalledOnce();
  });
});
