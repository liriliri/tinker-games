import type { Difficulty } from "./ai";
import {
  DARK,
  LIGHT,
  DEFAULT_CURSOR_CELL,
  newGame,
  type CheckersGame,
  type EngineSnapshot,
  type Move,
  type Side,
} from "./rules";

export type Mode = "pvp" | "pve";
export type Phase = "menu" | "play" | "thinking" | "over";

export type GameState = {
  draughts: CheckersGame;
  mode: Mode;
  difficulty: Difficulty;
  phase: Phase;
  cursor: number;
  selected: number | null;
  selectedMoves: Move[];
  history: EngineSnapshot[];
  moves: Move[];
  sound: boolean;
};

export function createGameState(
  mode: Mode = "pvp",
  difficulty: Difficulty = "normal",
): GameState {
  return {
    draughts: newGame(),
    mode,
    difficulty,
    phase: "menu",
    cursor: DEFAULT_CURSOR_CELL,
    selected: null,
    selectedMoves: [],
    history: [],
    moves: [],
    sound: true,
  };
}

/** Human plays Dark (near camera, moves first); computer plays Light. */
export const computerSide: Side = LIGHT;
export const humanSide: Side = DARK;
