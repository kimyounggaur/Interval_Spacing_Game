import type { Ticket } from "./generator";
import type { SaveData, StoredRun, Settings, Route, Mastery } from "../infra/storage";
export type { SaveData, StoredRun, Settings, Route, Mastery, Ticket };
export type Phase = "brief" | "drive" | "judge" | "fix" | "show" | "verify";
export type Screen = "title" | "routes" | "run" | "terminus" | "notebook" | "settings";
export type GameState = {
  save: SaveData;
  screen: Screen;
  run: StoredRun | null;
  ticket: Ticket | null;
  phase: Phase;
  pos: number;
  fpos: number;
  mistakes: number;
  rulerUsed: boolean;
  hunt: boolean;
  earDirectionAnswered: boolean;
  replays: number;
  reveal: number;
  message: string;
  modal: string | null;
  tutorial: number | null;
};
export type Action =
  | { type: "START_WARMUP"; seed: number }
  | { type: "START_TUTORIAL"; ticket: Ticket }
  | { type: "START_RUN"; route: Route; seed: number }
  | { type: "RESUME_RUN"; saved?: StoredRun }
  | { type: "ISSUE"; ticket: Ticket }
  | { type: "MOVE"; pos: number; fpos?: number }
  | { type: "ARRIVE" }
  | { type: "CHOOSE"; name: string }
  | { type: "RETRY" }
  | { type: "REVEAL"; k: number }
  | { type: "FINISH"; clean: boolean }
  | { type: "NEXT" }
  | { type: "USE_RULER" }
  | { type: "TOGGLE_ASSIST" }
  | { type: "EAR_PLAY" }
  | { type: "EAR_DIRECTION"; dir: 1 | -1 }
  | { type: "EAR_HUNT" }
  | { type: "OPEN"; modal: string | null }
  | { type: "CLOSE" }
  | { type: "GO"; screen: Screen }
  | { type: "SET"; key: keyof Settings; value: Settings[keyof Settings] }
  | { type: "TUTORIAL"; step: number | null }
  | { type: "RESET" };
