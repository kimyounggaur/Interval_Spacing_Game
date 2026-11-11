import { describe, expect, it } from "vitest";
import { defaultSave, migrateV1ToV2, sanitizeSave } from "../../src/infra/storage";

describe("[SAV-V3] 저장 위생 (기존 3개 유지)", () => {
  it("손상 JSON과 미래 버전은 안전한 기본값으로 돌아온다", () => {
    expect(sanitizeSave("not-json").version).toBe(3);
    expect(sanitizeSave({ version: 99 }).activeRun).toBeNull();
  });
  it("[SAV-MIG] v1 데이터의 수첩과 통계를 v2로 옮긴다", () => {
    const save = migrateV1ToV2({
      version: 1,
      notebook: { yellow: [1, 1, 13], red: [6] },
      stats: { totalTurns: 7 },
    });
    expect(save.version).toBe(2);
    expect(save.notebook.yellow).toEqual([1]);
    expect(save.notebook.red).toEqual([6]);
    expect(save.stats.totalTurns).toBe(7);
  });
  it("기본 저장값은 빈 진행으로 시작한다", () => {
    expect(defaultSave()).toMatchObject({
      version: 3,
      activeRun: null,
      mastery: {},
      stats: { tickets: 0, clean: 0 },
    });
  });
});
