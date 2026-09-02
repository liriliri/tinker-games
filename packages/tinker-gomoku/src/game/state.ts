import { type Difficulty } from "./ai";
import { BLACK, newBoard, type Stone } from "./rules";

export type Mode = "pvp" | "pve";
export type Phase = "menu" | "play" | "thinking" | "over";

export type MoveRecord = {
  row: number;
  column: number;
  stone: Stone;
};

export type GameState = {
  board: ReturnType<typeof newBoard>;
  history: MoveRecord[];
  mode: Mode;
  difficulty: Difficulty;
  phase: Phase;
  turn: Stone;
  cursor: { row: number; column: number };
  sound: boolean;
};

export function createGameState(
  mode: Mode = "pvp",
  difficulty: Difficulty = "normal",
): GameState {
  return {
    board: newBoard(),
    history: [],
    mode,
    difficulty,
    phase: "menu",
    turn: BLACK,
    cursor: { row: 7, column: 7 },
    sound: true,
  };
}
