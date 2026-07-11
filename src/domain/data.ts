export const NOTE_KO = [
  "도",
  "도#",
  "레",
  "레#",
  "미",
  "파",
  "파#",
  "솔",
  "솔#",
  "라",
  "라#",
  "시",
] as const;
export const NOTE_EN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11]);
export const WHITE_CELLS = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24] as const;
export const BASE_MIDI = 48;

export type BoardCell = {
  idx: number;
  midi: number;
  pc: number;
  ko: (typeof NOTE_KO)[number];
  en: (typeof NOTE_EN)[number];
  isWhite: boolean;
  isStart: boolean;
};

export const BOARD: readonly BoardCell[] = Array.from({ length: 25 }, (_, idx) => {
  const pc = idx % 12;
  return {
    idx,
    midi: BASE_MIDI + idx,
    pc,
    ko: NOTE_KO[pc] ?? "도",
    en: NOTE_EN[pc] ?? "C",
    isWhite: WHITE_PC.has(pc),
    isStart: idx === 12,
  };
});

export type Interval = {
  semi: number;
  name: string;
  family: "완전" | "장" | "단" | "증감";
  song: string;
};

export const INTERVALS: readonly Interval[] = [
  { semi: 0, name: "완전1도", family: "완전", song: "같은 음" },
  { semi: 1, name: "단2도", family: "단", song: "죠스 테마" },
  { semi: 2, name: "장2도", family: "장", song: "생일 축하 노래" },
  { semi: 3, name: "단3도", family: "단", song: "그린슬리브스" },
  { semi: 4, name: "장3도", family: "장", song: "개선 행진곡" },
  { semi: 5, name: "완전4도", family: "완전", song: "여행의 시작" },
  { semi: 6, name: "증4도/감5도", family: "증감", song: "트리톤" },
  { semi: 7, name: "완전5도", family: "완전", song: "반짝반짝 작은 별" },
  { semi: 8, name: "단6도", family: "단", song: "스타워즈 주제" },
  { semi: 9, name: "장6도", family: "장", song: "NBC 차임" },
  { semi: 10, name: "단7도", family: "단", song: "웨스트사이드 스토리" },
  { semi: 11, name: "장7도", family: "장", song: "매우 긴장된 도착" },
  { semi: 12, name: "완전8도", family: "완전", song: "무지개 너머" },
] as const;

export type CardType = "green" | "yellow" | "red";
export type Direction = 1 | -1;

export type GreenCard = {
  id: string;
  type: "green";
  degree: 2 | 3 | 4 | 5;
  dir: Direction;
  title: string;
  sub: string;
  back: string;
};

export type YellowCard = {
  id: string;
  type: "yellow";
  semi: number;
  dir: Direction;
  intervalName: string;
  title: string;
  sub: string;
  back: string;
};

export type RedCard = {
  id: string;
  type: "red";
  semi: number;
  intervalName: string;
  title: string;
  sub: string;
  back: string;
};

export type Card = GreenCard | YellowCard | RedCard;

export function buildDeck(): readonly Card[] {
  const deck: Card[] = [];
  let number = 0;
  const nextId = () => String(++number).padStart(3, "0");

  ([2, 2, 3, 3, 4, 4, 5, 5] as const).forEach((degree) => {
    deck.push({
      id: nextId(),
      type: "green",
      degree,
      dir: 1,
      title: `위로 ${degree}도`,
      sub: "흰건반만 / 출발음을 1로 센다",
      back:
        degree === 2
          ? "흰건반 1칸 옆 이동. 검은건반은 지나가되 세지 않는다."
          : `흰건반 ${degree - 1}칸 이동. 검은건반은 지나가되 세지 않는다.`,
    });
  });

  ([2, 3, 4, 5] as const).forEach((degree) => {
    deck.push({
      id: nextId(),
      type: "green",
      degree,
      dir: -1,
      title: `아래로 ${degree}도`,
      sub: "흰건반만 / 출발음을 1로 센다",
      back: "흰건반만·하행. 검은건반은 지나가되 세지 않는다.",
    });
  });

  for (let semi = 1; semi <= 12; semi += 1) {
    for (const dir of [1, -1] as const) {
      const interval = INTERVALS[semi];
      if (!interval) continue;
      deck.push({
        id: nextId(),
        type: "yellow",
        semi,
        dir,
        intervalName: interval.name,
        title: `${interval.name} ${dir > 0 ? "↑" : "↓"}`,
        sub: "검은건반 포함 / 반음 칸 세기",
        back: `정답: ${semi}반음. ${dir > 0 ? "상행" : "하행"}으로 ${semi}칸 이동.`,
      });
    }
  }

  for (let semi = 1; semi <= 12; semi += 1) {
    const interval = INTERVALS[semi];
    if (!interval) continue;
    deck.push({
      id: nextId(),
      type: "red",
      semi,
      intervalName: interval.name,
      title: `소리 미션 ${String(semi).padStart(2, "0")}`,
      sub: "추측자는 뒷면을 보지 않는다",
      back: `지휘자 정답: ${interval.name}, ${semi}반음. 두 음만 들려준다.`,
    });
  }
  return deck;
}

export const CARDS = buildDeck();
export const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

export type Mode = "intro" | "basic" | "full" | "ear" | "mixed";

export const MODE_META: Record<
  Mode,
  { title: string; subtitle: string; icon: string; color: string; goal: string }
> = {
  intro: {
    title: "입문 노선",
    subtitle: "도수를 흰건반으로 익혀요",
    icon: "도",
    color: "green",
    goal: "2·3·4·5도 연습",
  },
  basic: {
    title: "기본 노선",
    subtitle: "반음 칸을 세어 보세요",
    icon: "음",
    color: "yellow",
    goal: "노랑 스탬프 6개",
  },
  full: {
    title: "완주 노선",
    subtitle: "12가지 음정을 모두 찾아요",
    icon: "음",
    color: "yellow",
    goal: "노랑 스탬프 12개",
  },
  ear: {
    title: "청음 노선",
    subtitle: "두 음 사이를 귀로 찾아요",
    icon: "소",
    color: "red",
    goal: "빨강 스탬프 6개",
  },
  mixed: {
    title: "통합 노선",
    subtitle: "이름·거리·소리를 연결해요",
    icon: "★",
    color: "mixed",
    goal: "노랑 6개 + 빨강 3개",
  },
};

export function cardsForMode(mode: Mode): Card[] {
  if (mode === "intro") return CARDS.filter((card): card is GreenCard => card.type === "green");
  if (mode === "basic" || mode === "full")
    return CARDS.filter((card): card is YellowCard => card.type === "yellow");
  if (mode === "ear") return CARDS.filter((card): card is RedCard => card.type === "red");
  return CARDS.filter((card) => card.type !== "green");
}

export function cardForId(id: string): Card {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new Error(`알 수 없는 카드 ID: ${id}`);
  return card;
}
