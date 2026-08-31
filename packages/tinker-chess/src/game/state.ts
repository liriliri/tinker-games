import type { Difficulty } from "./ai";
import {
  BLACK,
  clonePosition,
  newPosition,
  type Move,
  type Position,
  type Side,
  WHITE,
} from "./rules";

export type Mode = "pvp" | "pve";
export type Phase = "menu" | "play" | "thinking" | "over";

export type GameState = {
  position: Position;
  mode: Mode;
  difficulty: Difficulty;
  phase: Phase;
  cursor: number;
  selected: number | null;
  legalTargets: number[];
  history: Position[];
  moves: Move[];
  sound: boolean;
};

export function createGameState(
  mode: Mode = "pvp",
  difficulty: Difficulty = "normal",
): GameState {
  return {
    position: newPosition(),
    mode,
    difficulty,
    phase: "menu",
    cursor: 52,
    selected: null,
    legalTargets: [],
    history: [],
    moves: [],
    sound: true,
  };
}

export const computerSide: Side = BLACK;

export function savePosition(state: GameState) {
  state.history.push(clonePosition(state.position));
}
