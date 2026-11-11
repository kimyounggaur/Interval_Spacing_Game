import { commonBySemis } from "../theory/index";

export const SAVE_KEY = "ijs_save_v3";
export const PREVIOUS_SAVE_KEY = "ijs_save_v2";
export const LEGACY_SAVE_KEY = "ijs_save_v1";
export const BACKUP_KEY = "ijs_save_v3_backup";
export const SAVE_VERSION = 3;
export const ROUTE_IDS = ["intro", "basic", "full", "ear", "mixed"] as const;
export type Route = (typeof ROUTE_IDS)[number];
export type Settings = {
  volume: number;
  muted: boolean;
  vibration: boolean;
  motion: "system" | "reduced" | "full";
  assist: boolean;
  tutorialSeen: boolean;
};
export type Mastery = {
  box: 0 | 1 | 2 | 3 | 4;
  stamp: 0 | 1 | 2;
  seen: number;
  clean: number;
};
export type RouteRecord = { stars: 0 | 1 | 2 | 3; runs: number };
export type Stats = { runs: number; tickets: number; clean: number; bestStreak: number };
export type PersistedTicketState = {
  ticket: unknown;
  phase: string;
  mistakes: number;
  rulerUsed: boolean;
  hunt: boolean;
  earDirectionAnswered: boolean;
  replays: number;
  reveal: number;
  message: string;
  fpos: number;
};
export type StoredRun = {
  route: Route;
  seed: number;
  plan: string[];
  index: number;
  pos: number;
  keepNote: [number, number, number] | null;
  results: (1 | 2)[];
  assistOff: boolean;
  melody?: number[];
  checkpoint?: PersistedTicketState;
};
export type SaveData = {
  version: 3;
  settings: Settings;
  mastery: Record<string, Mastery>;
  routes: Record<Route, RouteRecord>;
  stats: Stats;
  activeRun: StoredRun | null;
};
export const DEFAULT_SETTINGS: Settings = {
  volume: 0.75,
  muted: false,
  vibration: true,
  motion: "system",
  assist: true,
  tutorialSeen: false,
};
export const DEFAULT_STATS: Stats = { runs: 0, tickets: 0, clean: 0, bestStreak: 0 };
export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    mastery: {},
    routes: Object.fromEntries(
      ROUTE_IDS.map((route) => [route, { stars: 0, runs: 0 }]),
    ) as SaveData["routes"],
    stats: { ...DEFAULT_STATS },
    activeRun: null,
  };
}
export interface StoragePort {
  read(): SaveData;
  write(save: SaveData): void;
  clear(): void;
  readonly persistent: boolean;
}
export class MemoryStorage implements StoragePort {
  private value = defaultSave();
  readonly persistent = false;
  read(): SaveData {
    return clone(this.value);
  }
  write(save: SaveData): void {
    this.value = sanitizeSave(save);
  }
  clear(): void {
    this.value = defaultSave();
  }
}
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export class LocalStorageAdapter implements StoragePort {
  private fallback = new MemoryStorage();
  private available = true;
  private migrationNotice = false;
  constructor(private readonly suppliedStorage?: StorageLike) {}
  get persistent(): boolean {
    return this.available;
  }
  consumeMigrationNotice(): boolean {
    const value = this.migrationNotice;
    this.migrationNotice = false;
    return value;
  }
  read(): SaveData {
    if (!this.available) return this.fallback.read();
    try {
      const storage = this.storage();
      const raw = storage.getItem(SAVE_KEY);
      let result: SaveData;
      if (raw !== null) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch {
          storage.setItem(BACKUP_KEY, raw);
          result = defaultSave();
          this.fallback.write(result);
          return result;
        }
        if (!validV3Root(parsed)) {
          storage.setItem(BACKUP_KEY, raw);
          result = defaultSave();
        } else result = sanitizeSave(parsed);
      } else {
        const v2 = storage.getItem(PREVIOUS_SAVE_KEY);
        const v1 = v2 === null ? storage.getItem(LEGACY_SAVE_KEY) : null;
        const legacyRaw = v2 ?? v1;
        if (legacyRaw === null) result = defaultSave();
        else {
          let legacy: unknown;
          try {
            legacy = JSON.parse(legacyRaw) as unknown;
          } catch {
            storage.setItem(BACKUP_KEY, legacyRaw);
            legacy = null;
          }
          this.migrationNotice =
            isRecord(legacy) && legacy.activeRun !== null && legacy.activeRun !== undefined;
          result = migrateV2ToV3(v2 === null ? migrateV1ToV2(legacy) : legacy);
          this.write(result);
        }
      }
      this.fallback.write(result);
      return clone(result);
    } catch {
      this.useFallback();
      return this.fallback.read();
    }
  }
  write(save: SaveData): void {
    const safe = sanitizeSave(save);
    this.fallback.write(safe);
    if (!this.available) return;
    try {
      const storage = this.storage();
      const raw = JSON.stringify(safe);
      storage.setItem(SAVE_KEY, raw);
      if (storage.getItem(SAVE_KEY) !== raw) this.useFallback();
    } catch {
      this.useFallback();
    }
  }
  clear(): void {
    // A v3 empty record prevents the preserved v2 data from being migrated again after reset.
    this.write(defaultSave());
  }
  private storage(): StorageLike {
    if (this.suppliedStorage) return this.suppliedStorage;
    return globalThis.localStorage;
  }
  private useFallback(): void {
    if (!this.available) return;
    this.available = false;
    if (typeof document !== "undefined" && typeof CustomEvent !== "undefined") {
      document.dispatchEvent(new CustomEvent("ijs-storage-fallback"));
    }
  }
}
export function isMasteryKey(key: string): boolean {
  return (
    /^deg:[2-8]$/.test(key) ||
    /^(?:read|make|ear):(?:P[1458]|[Mm][2367]|A4|d5)$/.test(key) ||
    /^semi:[12]$/.test(key)
  );
}
export function sanitizeSave(input: unknown): SaveData {
  const base = defaultSave();
  if (!isRecord(input) || input.version !== SAVE_VERSION) return base;
  base.settings = sanitizeSettings(input.settings);
  if (isRecord(input.mastery)) {
    for (const [key, item] of Object.entries(input.mastery)) {
      if (!isMasteryKey(key) || !isRecord(item)) continue;
      const seen = safeInt(item.seen);
      base.mastery[key] = {
        box: Math.min(4, safeInt(item.box)) as Mastery["box"],
        stamp: Math.min(2, safeInt(item.stamp)) as Mastery["stamp"],
        seen,
        clean: Math.min(seen, safeInt(item.clean)),
      };
    }
  }
  if (isRecord(input.routes)) {
    for (const route of ROUTE_IDS) {
      const data = input.routes[route];
      if (isRecord(data))
        base.routes[route] = {
          stars: Math.min(3, safeInt(data.stars)) as RouteRecord["stars"],
          runs: safeInt(data.runs),
        };
    }
  }
  if (isRecord(input.stats))
    base.stats = {
      runs: safeInt(input.stats.runs),
      tickets: safeInt(input.stats.tickets),
      clean: safeInt(input.stats.clean),
      bestStreak: safeInt(input.stats.bestStreak),
    };
  base.activeRun = sanitizeRun(input.activeRun);
  return base;
}
function sanitizeRun(input: unknown): StoredRun | null {
  if (!isRecord(input) || !isRoute(input.route) || !Array.isArray(input.plan)) return null;
  if (
    input.plan.length === 0 ||
    input.plan.length > 24 ||
    !input.plan.every((key) => typeof key === "string" && isMasteryKey(key))
  )
    return null;
  if (!integerIn(input.pos, 0, 24) || !integerIn(input.index, 0, input.plan.length - 1))
    return null;
  if (
    !Array.isArray(input.results) ||
    input.results.length > input.plan.length ||
    !input.results.every((stamp) => stamp === 1 || stamp === 2)
  )
    return null;
  // A verified current ticket may already have one result; a pending ticket may not.
  if (input.results.length < input.index || input.results.length > input.index + 1) return null;
  let keepNote: StoredRun["keepNote"] = null;
  if (input.keepNote !== null) {
    if (
      !Array.isArray(input.keepNote) ||
      input.keepNote.length !== 3 ||
      !integerIn(input.keepNote[0], 0, 6) ||
      !integerIn(input.keepNote[1], -2, 2) ||
      !integerIn(input.keepNote[2], 2, 6)
    )
      return null;
    keepNote = [input.keepNote[0], input.keepNote[1], input.keepNote[2]];
  }
  const run: StoredRun = {
    route: input.route,
    seed: safeInt(input.seed) >>> 0,
    plan: [...input.plan] as string[],
    index: input.index,
    pos: input.pos,
    keepNote,
    results: [...input.results] as (1 | 2)[],
    assistOff: input.assistOff === true,
  };
  if (
    Array.isArray(input.melody) &&
    input.melody.length <= 25 &&
    input.melody.every((midi) => integerIn(midi, 48, 72))
  )
    run.melody = [...input.melody] as number[];
  if (isRecord(input.checkpoint)) {
    const cp = input.checkpoint;
    const phases = ["brief", "drive", "judge", "fix", "show", "verify"];
    if (typeof cp.phase === "string" && phases.includes(cp.phase) && isRecord(cp.ticket)) {
      run.checkpoint = {
        ticket: clone(cp.ticket),
        phase: cp.phase,
        mistakes: Math.min(2, safeInt(cp.mistakes)),
        rulerUsed: cp.rulerUsed === true,
        hunt: cp.hunt === true,
        earDirectionAnswered: cp.earDirectionAnswered === true,
        replays: safeInt(cp.replays),
        reveal: Math.min(25, safeInt(cp.reveal)),
        message: typeof cp.message === "string" ? cp.message.slice(0, 500) : "",
        fpos: clampNumber(cp.fpos, 0, 24, run.pos),
      };
    }
  }
  return run;
}
type LegacyNotebook = { greenDegrees: number[]; yellow: number[]; red: number[]; redAux: number[] };
type LegacySaveV2 = {
  version: 2;
  settings: Settings;
  notebook: LegacyNotebook;
  stars: Partial<Record<Route, number>>;
  clearedModes: Route[];
  stats: {
    totalTurns: number;
    totalBonusTurns: number;
    correctAttempts: number;
    wrongAttempts: number;
    bestStreak: number;
    seen: Record<string, number>;
    solved: Record<string, number>;
  };
  activeRun: unknown;
};
export function migrateV1ToV2(input: unknown): LegacySaveV2 {
  const data = isRecord(input) ? input : {};
  const notebook = isRecord(data.notebook) ? data.notebook : {};
  const stats = isRecord(data.stats) ? data.stats : {};
  const stars = isRecord(data.stars) ? data.stars : {};
  return {
    version: 2,
    settings: sanitizeSettings(data.settings),
    notebook: {
      greenDegrees: uniqueNumbers(notebook.greenDegrees, 2, 5),
      yellow: uniqueNumbers(notebook.yellow, 1, 12),
      red: uniqueNumbers(notebook.red, 1, 12),
      redAux: uniqueNumbers(notebook.redAux, 1, 12),
    },
    stars: Object.fromEntries(
      ROUTE_IDS.filter((route) => route in stars).map((route) => [
        route,
        Math.min(3, safeInt(stars[route])),
      ]),
    ),
    clearedModes: Array.isArray(data.clearedModes) ? data.clearedModes.filter(isRoute) : [],
    stats: {
      totalTurns: safeInt(stats.totalTurns),
      totalBonusTurns: safeInt(stats.totalBonusTurns),
      correctAttempts: safeInt(stats.correctAttempts),
      wrongAttempts: safeInt(stats.wrongAttempts),
      bestStreak: safeInt(stats.bestStreak),
      seen: {},
      solved: {},
    },
    activeRun: data.activeRun ?? null,
  };
}
export function migrateV2ToV3(input: unknown): SaveData {
  if (!isRecord(input) || (input.version !== 1 && input.version !== 2)) return defaultSave();
  const old = migrateV1ToV2(input);
  const next = defaultSave();
  next.settings = { ...old.settings, assist: true };
  const stamp = (key: string, value: 1 | 2) => {
    const previous = next.mastery[key];
    const best = Math.max(previous?.stamp ?? 0, value) as 1 | 2;
    next.mastery[key] = {
      box: best === 2 ? 1 : 0,
      stamp: best,
      seen: 1,
      clean: best === 2 ? 1 : 0,
    };
  };
  const intervalKey = (semi: number): string => {
    const interval = commonBySemis(semi)[0];
    return interval ? `${interval.quality}${interval.num}` : "P1";
  };
  old.notebook.greenDegrees.forEach((degree) => stamp(`deg:${degree}`, 2));
  old.notebook.yellow.forEach((semi) => stamp(`make:${intervalKey(semi)}`, 2));
  old.notebook.redAux.forEach((semi) => stamp(`ear:${intervalKey(semi)}`, 1));
  old.notebook.red.forEach((semi) => stamp(`ear:${intervalKey(semi)}`, 2));
  for (const route of ROUTE_IDS) {
    const stars = Math.max(
      old.stars[route] ?? 0,
      old.clearedModes.includes(route) ? 1 : 0,
    ) as RouteRecord["stars"];
    next.routes[route] = { stars, runs: stars > 0 ? 1 : 0 };
  }
  next.stats = {
    runs: Object.values(next.routes).reduce((sum, route) => sum + route.runs, 0),
    tickets: old.stats.totalTurns,
    clean: old.stats.correctAttempts,
    bestStreak: old.stats.bestStreak,
  };
  return next;
}
function sanitizeSettings(input: unknown): Settings {
  if (!isRecord(input)) return { ...DEFAULT_SETTINGS };
  return {
    volume: clampNumber(input.volume, 0, 1, DEFAULT_SETTINGS.volume),
    muted: input.muted === true,
    vibration: input.vibration !== false,
    motion: input.motion === "reduced" || input.motion === "full" ? input.motion : "system",
    assist: input.assist !== false,
    tutorialSeen: input.tutorialSeen === true,
  };
}
function validV3Root(input: unknown): input is Record<string, unknown> {
  return (
    isRecord(input) &&
    input.version === SAVE_VERSION &&
    isRecord(input.settings) &&
    isRecord(input.mastery) &&
    isRecord(input.routes) &&
    isRecord(input.stats) &&
    (input.activeRun === null || isRecord(input.activeRun))
  );
}
function isRoute(input: unknown): input is Route {
  return typeof input === "string" && ROUTE_IDS.includes(input as Route);
}
function integerIn(input: unknown, min: number, max: number): input is number {
  return typeof input === "number" && Number.isInteger(input) && input >= min && input <= max;
}
function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
function safeInt(input: unknown): number {
  return typeof input === "number" && Number.isFinite(input)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(input)))
    : 0;
}
function clampNumber(input: unknown, min: number, max: number, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input)
    ? Math.max(min, Math.min(max, input))
    : fallback;
}
function uniqueNumbers(input: unknown, min: number, max: number): number[] {
  return Array.isArray(input)
    ? [...new Set(input.filter((value): value is number => integerIn(value, min, max)))].sort(
        (a, b) => a - b,
      )
    : [];
}
function clone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}
