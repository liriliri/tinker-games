import type { Difficulty } from "./ai";
import { BLACK, newBoard, RED, type Move, type Side } from "./rules";

export type Mode = "pvp" | "pve";
export type Phase = "menu" | "play" | "thinking" | "over";

export type GameState = {
  board: Int8Array;
  mode: Mode;
  difficulty: Difficulty;
  phase: Phase;
  turn: Side;
  cursor: { row: number; column: number };
  selected: number | null;
  legalTargets: number[];
  history: Move[];
  sound: boolean;
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
    turn: RED,
    cursor: { row: 6, column: 4 },
    selected: null,
    legalTargets: [],
    history: [],
    sound: true,
  };
}

export const computerSide = BLACK;
