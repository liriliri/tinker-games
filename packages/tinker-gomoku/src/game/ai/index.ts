import each from "licia/each";
import { BOARD_SIZE, type Stone } from "../rules";
import type { Difficulty, MoveRecord } from "../state";
import Board from "./board";
import { stoneToRole } from "./eval";
import { clearSearchCache, candidateMinmax } from "./search";

type AiMove = {
  row: number;
  column: number;
};

const SEARCH_DEPTH: Record<Difficulty, number> = {
  easy: 2,
  normal: 4,
  hard: 6,
};

const TIME_LIMIT_MS: Partial<Record<Difficulty, number>> = {
  hard: 3000,
};

function buildBoard(history: readonly MoveRecord[]) {
  const firstRole = history.length > 0 ? stoneToRole(history[0]!.stone) : 1;
  const board = new Board(BOARD_SIZE, firstRole);
  each(history, ({ row, column, stone }) => {
    board.put(row, column, stoneToRole(stone));
  });
  return board;
}

export function chooseMove(
  history: readonly MoveRecord[],
  me: Stone,
  difficulty: Difficulty,
): AiMove | null {
  const board = buildBoard(history);
  const role = stoneToRole(me);
  if (board.role !== role) return null;

  clearSearchCache(board);
  const depth = SEARCH_DEPTH[difficulty];
  const enableVCT = difficulty !== "easy";
  const timeLimitMs = TIME_LIMIT_MS[difficulty];

  const [, move] = candidateMinmax(board, role, depth, enableVCT, {
    timeLimitMs,
  });

  if (!move) return null;
  return { row: move[0], column: move[1] };
}
