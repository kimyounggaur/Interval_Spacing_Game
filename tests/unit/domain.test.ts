import { describe, expect, it } from "vitest";
import { BOARD, CARDS, INTERVALS, WHITE_CELLS } from "../../src/domain/data";
import {
  greenTarget,
  isModeClear,
  makeRng,
  mergeNotebook,
  planMove,
  redMoveTarget,
  shuffle,
} from "../../src/domain/engine";

describe("[DAT-BOARD] 보드 정본", () => {
  it("25칸이며 중앙 도는 MIDI 60이다", () => {
    expect(BOARD).toHaveLength(25);
    expect(BOARD[12]).toMatchObject({ idx: 12, midi: 60, ko: "도", en: "C", isStart: true });
    expect(WHITE_CELLS).toHaveLength(15);
  });

  it("[DAT-DECK] 48장 분포와 고정 ID를 보존한다", () => {
    expect(CARDS).toHaveLength(48);
    expect(CARDS.filter((card) => card.type === "green")).toHaveLength(12);
    expect(CARDS.filter((card) => card.type === "yellow")).toHaveLength(24);
    expect(CARDS.filter((card) => card.type === "red")).toHaveLength(12);
    expect(CARDS.map((card) => card.id)).toEqual(
      Array.from({ length: 48 }, (_, index) => String(index + 1).padStart(3, "0")),
    );
    expect(CARDS[0]?.back).toContain("옆");
    expect(CARDS[22]).toMatchObject({
      type: "yellow",
      semi: 6,
      dir: 1,
      intervalName: "증4도/감5도",
    });
    expect(CARDS[23]).toMatchObject({ type: "yellow", semi: 6, dir: -1 });
    expect(CARDS[34]).toMatchObject({ type: "yellow", semi: 12, dir: 1 });
    expect(CARDS[35]).toMatchObject({ type: "yellow", semi: 12, dir: -1 });
    expect(CARDS[36]).toMatchObject({ type: "red", title: "소리 미션 01" });
    expect(CARDS[47]).toMatchObject({ type: "red", title: "소리 미션 12" });
  });

  it("[DAT-INTERVAL] 12개 음정은 1~12 반음을 덮는다", () => {
    expect(INTERVALS.slice(1).map((interval) => interval.semi)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
  });
});

describe("[ENG-GREEN] 초록 도수 엔진", () => {
  it("출발음을 1로 세며 흰건반만 이동한다", () => {
    expect(greenTarget(12, 5, 1)).toBe(19);
    expect(greenTarget(12, 3, -1)).toBe(9);
    expect(greenTarget(12, 2, 1)).toBe(14);
    expect(greenTarget(23, 3, 1)).toBeNull();
    expect(greenTarget(0, 2, -1)).toBeNull();
    expect(greenTarget(13, 2, 1)).toBeNull();
  });
});

describe("[ENG-YELLOW] 노랑 환승 엔진", () => {
  it("모듈러 랩어라운드가 아니라 옥타브 환승 후 다시 센다", () => {
    expect(planMove(12, 7)).toEqual({ originalFrom: 12, from: 12, target: 19, transfers: [] });
    expect(planMove(24, 12)).toEqual({ originalFrom: 24, from: 0, target: 12, transfers: [0] });
    expect(planMove(14, 12)).toEqual({ originalFrom: 14, from: 2, target: 14, transfers: [2] });
    expect(planMove(0, -1)).toEqual({ originalFrom: 0, from: 24, target: 23, transfers: [24] });
    expect(planMove(2, -6)).toEqual({ originalFrom: 2, from: 14, target: 8, transfers: [14] });
  });

  it("25×24 유효 입력의 결과는 항상 보드 안이다", () => {
    for (let position = 0; position <= 24; position += 1) {
      for (let delta = -12; delta <= 12; delta += 1) {
        if (delta === 0) continue;
        const result = planMove(position, delta);
        expect(result.from).toBeGreaterThanOrEqual(0);
        expect(result.from).toBeLessThanOrEqual(24);
        expect(result.target).toBeGreaterThanOrEqual(0);
        expect(result.target).toBeLessThanOrEqual(24);
        expect(result.transfers.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("[ENG-RED] 빨강 이동과 결정론", () => {
  it("보드 끝에서는 하행으로 돌아온다", () => {
    expect(redMoveTarget(20, 7)).toBe(13);
    expect(redMoveTarget(5, 7)).toBe(12);
  });

  it("같은 seed의 셔플은 같은 카드 순서를 만든다", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect(shuffle(items, makeRng(42))).toEqual(shuffle(items, makeRng(42)));
    expect(shuffle(items, makeRng(42)).sort()).toEqual(items);
  });
});

describe("[NBK-MERGE] 수첩과 승리", () => {
  it("red full은 redAux를 정규화하고 merge는 멱등이다", () => {
    const first = mergeNotebook(
      { greenDegrees: [], yellow: [], red: [3], redAux: [3, 4] },
      { greenDegrees: [], yellow: [2], red: [4], redAux: [4, 5] },
    );
    expect(first.red).toEqual([3, 4]);
    expect(first.redAux).toEqual([5]);
    expect(mergeNotebook(first, first)).toEqual(first);
  });

  it("모드별 승리 조건을 round notebook으로 판정한다", () => {
    expect(
      isModeClear("intro", { greenDegrees: [2, 3, 4, 5], yellow: [], red: [], redAux: [] }),
    ).toBe(true);
    expect(
      isModeClear("basic", { greenDegrees: [], yellow: [1, 2, 3, 4, 5, 6], red: [], redAux: [] }),
    ).toBe(true);
    expect(
      isModeClear("ear", { greenDegrees: [], yellow: [], red: [1, 2, 3, 4, 5, 6], redAux: [] }),
    ).toBe(true);
    expect(
      isModeClear("mixed", {
        greenDegrees: [],
        yellow: [1, 2, 3, 4, 5, 6],
        red: [1, 2, 3],
        redAux: [],
      }),
    ).toBe(true);
  });
});
