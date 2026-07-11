import type { Notebook } from "../domain/engine";
import type { Mode } from "../domain/data";

export const SAVE_KEY = "ijs_save_v2";
export const LEGACY_SAVE_KEY = "ijs_save_v1";
export const SAVE_VERSION = 2;

export type Settings = {
  volume: number;
  muted: boolean;
  vibration: boolean;
  motion: "system" | "reduced" | "full";
  tutorialSeen: boolean;
};

export type Stats = {
  totalTurns: number;
  totalBonusTurns: number;
  correctAttempts: number;
  wrongAttempts: number;
  bestStreak: number;
  seen: Record<string, number>;
  solved: Record<string, number>;
};

export type StoredRun = {
  mode: Mode;
  position: number;
  deckIds: string[];
  discardIds: string[];
  seed: number;
  roundNotebook: Notebook;
  tickets: number;
  streak: number;
};

export type SaveData = {
  version: 2;
  settings: Settings;
  notebook: Notebook;
  stars: Partial<Record<Mode, number>>;
  clearedModes: Mode[];
  stats: Stats;
  activeRun: StoredRun | null;
};

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.75,
  muted: false,
  vibration: true,
  motion: "system",
  tutorialSeen: false,
};
export const DEFAULT_STATS: Stats = {
  totalTurns: 0,
  totalBonusTurns: 0,
  correctAttempts: 0,
  wrongAttempts: 0,
  bestStreak: 0,
  seen: {},
  solved: {},
};

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    notebook: { greenDegrees: [], yellow: [], red: [], redAux: [] },
    stars: {},
    clearedModes: [],
    stats: { ...DEFAULT_STATS, seen: {}, solved: {} },
    activeRun: null,
  };
}

export interface StoragePort {
  read(): SaveData;
  write(save: SaveData): void;
  clear(): void;
  readonly persistent: boolean;
}

class MemoryStorage implements StoragePort {
  private value = defaultSave();
  public readonly persistent = false;
  read(): SaveData {
    return cloneSave(this.value);
  }
  write(save: SaveData): void {
    this.value = cloneSave(save);
  }
  clear(): void {
    this.value = defaultSave();
  }
}

export class LocalStorageAdapter implements StoragePort {
  public readonly persistent = true;
  private fallback = new MemoryStorage();
  private warned = false;

  read(): SaveData {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) {
        const legacy = window.localStorage.getItem(LEGACY_SAVE_KEY);
        if (!legacy) return defaultSave();
        const migrated = migrateV1ToV2(JSON.parse(legacy) as unknown);
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return sanitizeSave(JSON.parse(raw) as unknown);
    } catch {
      this.persistentFallback();
      return this.fallback.read();
    }
  }

  write(save: SaveData): void {
    const safe = sanitizeSave(save);
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(safe));
    } catch {
      this.persistentFallback();
      this.fallback.write(safe);
    }
  }

  clear(): void {
    try {
      window.localStorage.removeItem(SAVE_KEY);
      window.localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      this.persistentFallback();
      this.fallback.clear();
    }
  }

  private persistentFallback(): void {
    this.fallback = this.fallback ?? new MemoryStorage();
    if (!this.warned) {
      this.warned = true;
      document.dispatchEvent(new CustomEvent("ijs-storage-fallback"));
    }
  }
}

export function sanitizeSave(input: unknown): SaveData {
  const base = defaultSave();
  if (!isRecord(input)) return base;
  if (input.version !== SAVE_VERSION) return base;
  const candidate = input as Partial<SaveData>;
  return {
    version: 2,
    settings: sanitizeSettings(candidate.settings),
    notebook: sanitizeNotebook(candidate.notebook),
    stars: sanitizeStars(candidate.stars),
    clearedModes: sanitizeModes(candidate.clearedModes),
    stats: sanitizeStats(candidate.stats),
    activeRun: sanitizeRun(candidate.activeRun),
  };
}

export function migrateV1ToV2(input: unknown): SaveData {
  if (!isRecord(input)) return defaultSave();
  const v1 = input;
  const migrated = defaultSave();
  const sourceNotebook = isRecord(v1.notebook) ? v1.notebook : {};
  migrated.notebook = sanitizeNotebook({
    greenDegrees: sourceNotebook.greenDegrees,
    yellow: sourceNotebook.yellow,
    red: sourceNotebook.red,
    redAux: sourceNotebook.redAux,
  });
  migrated.stats = sanitizeStats(v1.stats);
  migrated.settings = sanitizeSettings(v1.settings);
  migrated.stars = sanitizeStars(v1.stars);
  migrated.clearedModes = sanitizeModes(v1.clearedModes);
  return migrated;
}

function sanitizeSettings(input: unknown): Settings {
  if (!isRecord(input)) return { ...DEFAULT_SETTINGS };
  const motion =
    input.motion === "reduced" || input.motion === "full" || input.motion === "system"
      ? input.motion
      : DEFAULT_SETTINGS.motion;
  return {
    volume: clampNumber(input.volume, 0, 1, DEFAULT_SETTINGS.volume),
    muted: Boolean(input.muted),
    vibration: input.vibration !== false,
    motion,
    tutorialSeen: Boolean(input.tutorialSeen),
  };
}

function sanitizeNotebook(input: unknown): Notebook {
  if (!isRecord(input)) return { greenDegrees: [], yellow: [], red: [], redAux: [] };
  return {
    greenDegrees: uniqueNumbers(input.greenDegrees, 2, 5),
    yellow: uniqueNumbers(input.yellow, 1, 12),
    red: uniqueNumbers(input.red, 1, 12),
    redAux: uniqueNumbers(input.redAux, 1, 12),
  };
}

function sanitizeStars(input: unknown): Partial<Record<Mode, number>> {
  if (!isRecord(input)) return {};
  const modes: Mode[] = ["intro", "basic", "full", "ear", "mixed"];
  return Object.fromEntries(
    modes
      .filter((mode) => input[mode] !== undefined)
      .map((mode) => [
        mode,
        Math.max(0, Math.min(3, Math.floor(clampNumber(input[mode], 0, 3, 0)))),
      ]),
  );
}

function sanitizeModes(input: unknown): Mode[] {
  if (!Array.isArray(input)) return [];
  const modes: Mode[] = ["intro", "basic", "full", "ear", "mixed"];
  return [
    ...new Set(
      input.filter(
        (mode): mode is Mode => typeof mode === "string" && modes.includes(mode as Mode),
      ),
    ),
  ];
}

function sanitizeStats(input: unknown): Stats {
  if (!isRecord(input)) return { ...DEFAULT_STATS, seen: {}, solved: {} };
  return {
    totalTurns: safeInt(input.totalTurns),
    totalBonusTurns: safeInt(input.totalBonusTurns),
    correctAttempts: safeInt(input.correctAttempts),
    wrongAttempts: safeInt(input.wrongAttempts),
    bestStreak: safeInt(input.bestStreak),
    seen: sanitizeNumberRecord(input.seen),
    solved: sanitizeNumberRecord(input.solved),
  };
}

function sanitizeRun(input: unknown): StoredRun | null {
  if (!isRecord(input) || typeof input.mode !== "string") return null;
  const modes: Mode[] = ["intro", "basic", "full", "ear", "mixed"];
  if (!modes.includes(input.mode as Mode)) return null;
  return {
    mode: input.mode as Mode,
    position: Math.max(0, Math.min(24, safeInt(input.position, 12))),
    deckIds: sanitizeIds(input.deckIds),
    discardIds: sanitizeIds(input.discardIds),
    seed: safeInt(input.seed),
    roundNotebook: sanitizeNotebook(input.roundNotebook),
    tickets: Math.max(0, safeInt(input.tickets)),
    streak: Math.max(0, safeInt(input.streak)),
  };
}

function sanitizeIds(input: unknown): string[] {
  return Array.isArray(input)
    ? input.filter((id): id is string => typeof id === "string" && /^\d{3}$/.test(id))
    : [];
}
function sanitizeNumberRecord(input: unknown): Record<string, number> {
  if (!isRecord(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => /^\d+$/.test(key) && typeof value === "number")
      .map(([key, value]) => [key, safeInt(value)]),
  );
}
function uniqueNumbers(input: unknown, min: number, max: number): number[] {
  return Array.isArray(input)
    ? [
        ...new Set(
          input.filter(
            (value): value is number =>
              typeof value === "number" && Number.isInteger(value) && value >= min && value <= max,
          ),
        ),
      ].sort((a, b) => a - b)
    : [];
}
function safeInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function cloneSave(save: SaveData): SaveData {
  return JSON.parse(JSON.stringify(save)) as SaveData;
}
