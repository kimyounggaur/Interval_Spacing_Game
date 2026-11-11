import { describe, expect, it } from "vitest";
import { BOARD, WHITE_CELLS } from "../../src/game/track";
import { makeRng, shuffle } from "../../src/game/random";
import { createTicket, greenOptions, makeOptions } from "../../src/game/generator";
import { applyMastery, planRun, ROUTES, runStars } from "../../src/game/planner";
import { commonBySemis, isWhitePc, midiOf } from "../../src/theory";
import { defaultSave } from "../../src/infra/storage";

// The design §11.1 retains DAT-BOARD and seeded shuffle verbatim in meaning.
// The other eight contracts are explicitly replaced below and mapped in decision-log.md.
describe("[DAT-BOARD] 보드 정본", () => {
  it("25칸이며 중앙 도는 MIDI 60이다", () => {
    expect(BOARD).toHaveLength(25);
    expect(BOARD[12]).toMatchObject({ idx: 12, midi: 60, ko: "도", en: "C", isStart: true });
    expect(WHITE_CELLS).toHaveLength(15);
  });

  it("[DAT-DECK → RN-01] 고정 덱 대신 노선마다 정해진 K장의 운행을 만든다", () => {
    const save = defaultSave();
    for (const route of ["intro", "basic", "full", "ear", "mixed"] as const) {
      const plan = planRun(route, 42, save);
      expect(plan).toHaveLength(ROUTES[route].length);
      expect(plan.every((key) => /^(deg|read|make|ear):/.test(key))).toBe(true);
    }
  });

  it("[DAT-INTERVAL → TH-08] 계산한 흔한 음정이 1~12 반음을 덮는다", () => {
    expect(Array.from({ length: 12 }, (_, index) => commonBySemis(index + 1)[0]!.semis)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(commonBySemis(6).map((iv) => `${iv.quality}${iv.num}`)).toEqual(["A4", "d5"]);
  });
});

describe("[ENG-GREEN → GN-01/GN-05] 흰 역 도수 승차권", () => {
  it("출발음을 1로 세며 풀 수 있는 흰 역만 목적지로 낸다", () => {
    expect(greenOptions(12)).toContainEqual({ num: 5, dir: 1, target: 19 });
    expect(greenOptions(12)).toContainEqual({ num: 3, dir: -1, target: 9 });
    expect(greenOptions(12)).toContainEqual({ num: 2, dir: 1, target: 14 });
    expect(greenOptions(23)).not.toContainEqual(expect.objectContaining({ num: 3, dir: 1 }));
    expect(greenOptions(0)).not.toContainEqual(expect.objectContaining({ num: 2, dir: -1 }));
    expect(greenOptions(13)).toEqual([]);
  });
});

describe("[ENG-YELLOW → GN-04/GN-05] 환승 없는 만들기", () => {
  it("환승 대신 현재 위치에서 낼 수 있는 방향과 철자만 선택한다", () => {
    const ticket = createTicket("make:P8", 24, null, () => 0);
    expect(ticket).toMatchObject({ start: 24, target: 12, dir: -1 });
    expect(ticket).not.toHaveProperty("transfers");
    expect(createTicket("make:M3", 12, null, () => 0)).toMatchObject({ start: 12, target: 16 });
  });

  it("25칸의 모든 생성 후보가 선로 안이며 이동은 최대 12칸이다", () => {
    for (let position = 0; position <= 24; position++) {
      const candidates = makeOptions(position);
      expect(candidates.length).toBeGreaterThan(0);
      for (const candidate of candidates) {
        expect(candidate.target).toBeGreaterThanOrEqual(0);
        expect(candidate.target).toBeLessThanOrEqual(24);
        expect(Math.abs(candidate.target - position)).toBeLessThanOrEqual(12);
        expect(midiOf(candidate.targetNote)).toBe(48 + candidate.target);
      }
    }
  });
});

describe("[ENG-RED → AU-04/RN-03] 청음 이동과 결정론", () => {
  it("두 청음 음을 선로 안에서 생성하고 도착한 철자를 보존한다", () => {
    const ticket = createTicket("ear:P5", 20, null, () => 0, { earLevel: 3 });
    expect(ticket).toMatchObject({ start: 20, target: 13, dir: -1 });
    expect(ticket!.targetNote).toBeDefined();
    for (const position of [0, 12, 24]) {
      const octave = createTicket("ear:P8", position, null, () => 0, { earLevel: 3 });
      expect(octave!.target).toBeGreaterThanOrEqual(0);
      expect(octave!.target).toBeLessThanOrEqual(24);
    }
    expect(isWhitePc(60)).toBe(true);
  });

  it("같은 seed의 셔플은 같은 카드 순서를 만든다", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect(shuffle(items, makeRng(42))).toEqual(shuffle(items, makeRng(42)));
    expect(shuffle(items, makeRng(42)).sort()).toEqual(items);
  });
});

describe("[NBK-MERGE/WIN → RN-04/RN-05] 숙련도와 운행 완료", () => {
  it("반쪽 스탬프가 기존 ●를 지우지 않고 상자는 성과에 따라 움직인다", () => {
    const full = applyMastery({}, "ear:m3", 2);
    expect(full["ear:m3"]).toMatchObject({ stamp: 2, box: 1, seen: 1, clean: 1 });
    const assisted = applyMastery(full, "ear:m3", 1);
    expect(assisted["ear:m3"]).toMatchObject({ stamp: 2, box: 0, seen: 2, clean: 1 });
    expect(full["ear:m3"]!.box).toBe(1);
  });

  it("서로 다른 수첩 개수 대신 완료한 K장과 자력 정답 비율로 별을 계산한다", () => {
    expect(runStars([2, 2, 2, 2, 2, 2, 2], true)).toBe(3);
    expect(runStars([2, 2, 2, 2, 2, 2, 1], false)).toBe(2);
    expect(runStars([2, 2, 2, 1, 1, 1], false)).toBe(1);
    expect(runStars([], true)).toBe(0);
    expect(planRun("basic", 9, defaultSave())).toHaveLength(6);
  });
});
