import { describe, expect, it } from "vitest";
import {
  BACKUP_KEY,
  LEGACY_SAVE_KEY,
  LocalStorageAdapter,
  PREVIOUS_SAVE_KEY,
  SAVE_KEY,
  defaultSave,
  migrateV1ToV2,
  migrateV2ToV3,
  sanitizeSave,
} from "../../src/infra/storage";

function store() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
describe("v3 저장 및 이전", () => {
  const legacy = {
    version: 2,
    settings: { volume: 0.4, muted: true, motion: "reduced", tutorialSeen: true },
    notebook: { greenDegrees: [2, 5], yellow: [3, 6], red: [4, 6], redAux: [4, 5] },
    stars: { intro: 3, basic: 2 },
    clearedModes: ["full"],
    stats: { totalTurns: 18, correctAttempts: 14, bestStreak: 5 },
    activeRun: { mode: "intro", deckIds: ["001"] },
  };
  it("SV-01 v2 별, 스탬프, 통계를 옮기며 완전 스탬프가 반쪽보다 우선한다", () => {
    const next = migrateV2ToV3(legacy);
    expect(next.mastery["deg:5"]?.stamp).toBe(2);
    expect(next.mastery["make:m3"]?.stamp).toBe(2);
    expect(next.mastery["make:A4"]?.stamp).toBe(2);
    expect(next.mastery["ear:M3"]?.stamp).toBe(2);
    expect(next.mastery["ear:P4"]?.stamp).toBe(1);
    expect(next.routes.intro.stars).toBe(3);
    expect(next.routes.full.stars).toBe(1);
    expect(next.stats).toMatchObject({ tickets: 18, clean: 14, bestStreak: 5 });
    expect(next.settings).toMatchObject({ volume: 0.4, muted: true, assist: true });
    expect(next.activeRun).toBeNull();
  });
  it("SV-02 v1→v2→v3 보존", () => {
    const next = migrateV2ToV3(migrateV1ToV2({ ...legacy, version: 1 }));
    expect(next.routes.basic.stars).toBe(2);
    expect(next.mastery["ear:A4"]?.stamp).toBe(2);
  });
  it.each([
    "{broken",
    JSON.stringify({ version: 99 }),
    JSON.stringify({ version: 3, mastery: [] }),
  ])("SV-03 손상/미래 저장의 원문을 백업한다: %s", (raw) => {
    const storage = store();
    storage.setItem(SAVE_KEY, raw);
    const adapter = new LocalStorageAdapter(storage);
    expect(adapter.read()).toEqual(defaultSave());
    expect(storage.getItem(BACKUP_KEY)).toBe(raw);
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });
  it("SV-04 v2와 v1 원본을 지우거나 덮어쓰지 않고 활성운행 안내는 한 번만 낸다", () => {
    const storage = store();
    const v2 = JSON.stringify(legacy);
    storage.setItem(PREVIOUS_SAVE_KEY, v2);
    storage.setItem(LEGACY_SAVE_KEY, "preserved");
    const adapter = new LocalStorageAdapter(storage);
    expect(adapter.read().version).toBe(3);
    expect(adapter.consumeMigrationNotice()).toBe(true);
    expect(adapter.consumeMigrationNotice()).toBe(false);
    adapter.clear();
    expect(adapter.read().mastery).toEqual({});
    expect(storage.getItem(PREVIOUS_SAVE_KEY)).toBe(v2);
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe("preserved");
  });
  it("SV-05 숙련도 키와 운행 전체가 저장 왕복된다", () => {
    const storage = store();
    const adapter = new LocalStorageAdapter(storage);
    const save = defaultSave();
    save.mastery["read:m3"] = { box: 2, stamp: 2, seen: 5, clean: 3 };
    save.mastery["make:M6"] = { box: 1, stamp: 1, seen: 3, clean: 1 };
    save.activeRun = {
      route: "full",
      seed: 42,
      plan: ["make:M6", "make:m3"],
      index: 1,
      pos: 16,
      keepNote: [2, 0, 4],
      results: [1],
      assistOff: false,
      melody: [60, 64],
      checkpoint: {
        ticket: { kind: "make", id: "current" },
        phase: "fix",
        mistakes: 1,
        rulerUsed: true,
        hunt: false,
        earDirectionAnswered: false,
        replays: 2,
        reveal: 0,
        message: "다시 세어요",
        fpos: 16.1,
      },
    };
    adapter.write(save);
    expect(adapter.read()).toEqual(save);
    expect(adapter.persistent).toBe(true);
  });
  it("SV-06 저장소 거부 시 마지막 진행을 인메모리로 보존한다", () => {
    const storage = store();
    const adapter = new LocalStorageAdapter(storage);
    const save = defaultSave();
    save.routes.intro.stars = 2;
    adapter.write(save);
    storage.setItem = () => {
      throw new Error("quota");
    };
    save.stats.tickets = 7;
    adapter.write(save);
    expect(adapter.persistent).toBe(false);
    expect(adapter.read().stats.tickets).toBe(7);
    expect(adapter.read().routes.intro.stars).toBe(2);
  });
  it("SV-06 조용히 쓰기를 무시하는 저장소도 감지한다", () => {
    const storage = store();
    storage.setItem = () => {};
    const adapter = new LocalStorageAdapter(storage);
    const save = defaultSave();
    save.stats.tickets = 4;
    adapter.write(save);
    expect(adapter.persistent).toBe(false);
    expect(adapter.read().stats.tickets).toBe(4);
  });
  it("손상 운행과 임의 숙련 키는 복원하지 않는다", () => {
    const save = defaultSave();
    const result = sanitizeSave({
      ...save,
      mastery: {
        "semi-4": { box: 99, stamp: 9 },
        "read:m3": { box: 8, stamp: 9, seen: 2, clean: 9 },
      },
      activeRun: { route: "full", plan: ["make:M3"], index: 8, pos: 12, results: [] },
    });
    expect(result.mastery).toEqual({ "read:m3": { box: 4, stamp: 2, seen: 2, clean: 2 } });
    expect(result.activeRun).toBeNull();
  });
});
