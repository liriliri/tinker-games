import type { Difficulty } from "./ai";
import { BLACK, newBoard, type Stone } from "./rules";

export type Mode = "pvp" | "pve";
export type Phase = "menu" | "play" | "animating" | "thinking" | "over";

export type GameState = {
  board: ReturnType<typeof newBoard>;
  mode: Mode;
  difficulty: Difficulty;
  phase: Phase;
  turn: Stone;
  cursor: { row: number; column: number };
  sound: boolean;
  passed: boolean;
};

export function createGameState(
  mode: Mode = "pvp",
  difficulty: Difficulty = "normal",
): GameState {
  return {
    board: newBoard(),
    mode,
    difficulty,
    phase: "menu",
    turn: BLACK,
    cursor: { row: 2, column: 3 },
    sound: true,
    passed: false,
  };
}
