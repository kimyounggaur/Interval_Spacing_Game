import { between, commonBySemis, nameKo } from "./index";
import type { Note } from "./index";

export type SoundExample = {
  title: string;
  position: string;
  notes: readonly [Note, Note];
  semis: number;
  review: "pending";
  playback: "interval-only";
};
const note = (letter: Note["letter"], acc: Note["acc"] = 0, octave = 4): Note => ({ letter, acc, octave });
/** Proposed references from the design. Only the isolated two-note interval plays.
 * Three-note melodies remain disabled pending instructor/source review. */
export const SOUND_EXAMPLES: readonly SoundExample[] = [
  { title: "엘리제를 위하여", position: "1→2번째 음", notes: [note(2), note(1,1)], semis: 1, review: "pending", playback: "interval-only" },
  { title: "생일 축하 노래", position: "2→3번째 음", notes: [note(4),note(5)], semis: 2, review: "pending", playback: "interval-only" },
  { title: "비행기", position: "1→2번째 음", notes: [note(2),note(1)], semis: 2, review: "pending", playback: "interval-only" },
  { title: "나비야", position: "1→2번째 음", notes: [note(4),note(2)], semis: 3, review: "pending", playback: "interval-only" },
  { title: "브람스 자장가", position: "2→3번째 음", notes: [note(2),note(4)], semis: 3, review: "pending", playback: "interval-only" },
  { title: "베토벤 교향곡 5번", position: "3→4번째 음", notes: [note(4),note(2,-1)], semis: 4, review: "pending", playback: "interval-only" },
  { title: "비발디 ‘봄’", position: "1→2번째 음", notes: [note(0),note(2)], semis: 4, review: "pending", playback: "interval-only" },
  { title: "결혼행진곡", position: "1→2번째 음", notes: [note(4,0,3),note(0)], semis: 5, review: "pending", playback: "interval-only" },
  { title: "반짝반짝 작은 별", position: "2→3번째 음", notes: [note(0),note(4)], semis: 7, review: "pending", playback: "interval-only" },
  { title: "엔터테이너", position: "3→4번째 음", notes: [note(2),note(0,0,5)], semis: 8, review: "pending", playback: "interval-only" },
  { title: "징글벨", position: "‘흰 눈 사이로’ 1→2번째 음", notes: [note(4,0,3),note(2)], semis: 9, review: "pending", playback: "interval-only" },
];
export function exampleLabel(example: SoundExample): string {
  return `${example.title} · ${example.position} · ${nameKo(between(...example.notes))} · 검수 대기`;
}
export function examplesFor(semis: number): readonly SoundExample[] {
  return SOUND_EXAMPLES.filter((example) => example.semis === semis);
}
export function referenceLabel(semis: number): string {
  const example = examplesFor(semis)[0];
  return example ? exampleLabel(example) : `${commonBySemis(semis).map(nameKo).join("/")} · 두 음으로 들어요`;
}
