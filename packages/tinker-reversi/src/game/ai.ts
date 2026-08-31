import {
  BOARD_SIZE,
  EMPTY,
  getFlips,
  getLegalMoves,
  countLegalMoves,
  opposite,
  type Move,
  type Stone,
} from "./rules";
import randomItem from "licia/randomItem";

export type Difficulty = "easy" | "normal" | "hard";

const POSITION_VALUES = [
  120, -25, 20, 5, 5, 20, -25, 120, -25, -45, 1, 1, 1, 1, -45, -25, 20, 1, 5, 2,
  2, 5, 1, 20, 5, 1, 2, 1, 1, 2, 1, 5, 5, 1, 2, 1, 1, 2, 1, 5, 20, 1, 5, 2, 2,
  5, 1, 20, -25, -45, 1, 1, 1, 1, -45, -25, 120, -25, 20, 5, 5, 20, -25, 120,
];
const CORNERS = [
  0,
  BOARD_SIZE - 1,
  BOARD_SIZE * (BOARD_SIZE - 1),
  BOARD_SIZE * BOARD_SIZE - 1,
];

type OrderedMove = { move: Move; flips: number[] };

function orderedMoves(board: Uint8Array, stone: Stone): OrderedMove[] {
  const moves: OrderedMove[] = [];
  for (let cell = 0; cell < board.length; cell++) {
    if (board[cell] !== EMPTY) continue;
    const row = Math.floor(cell / BOARD_SIZE);
    const column = cell % BOARD_SIZE;
    const flips = getFlips(board, row, column, stone);
    if (flips.length > 0) {
      moves.push({ move: { row, column, cell }, flips });
    }
  }
  return moves.sort((a, b) => {
    const valueA = POSITION_VALUES[a.move.cell] + a.flips.length * 2;
    const valueB = POSITION_VALUES[b.move.cell] + b.flips.length * 2;
    return valueB - valueA;
  });
}

function evaluate(board: Uint8Array, me: Stone) {
  const them = opposite(me);
  let positional = 0;
  let mine = 0;
  let theirs = 0;
  for (let cell = 0; cell < board.length; cell++) {
    if (board[cell] === me) {
      mine++;
      positional += POSITION_VALUES[cell];
    } else if (board[cell] === them) {
      theirs++;
      positional -= POSITION_VALUES[cell];
    }
  }

  const myMoves = countLegalMoves(board, me);
  const theirMoves = countLegalMoves(board, them);
  const mobility = (myMoves - theirMoves) * 7;
  const cornerScore = CORNERS.reduce(
    (score, cell) =>
      score + (board[cell] === me ? 1 : board[cell] === them ? -1 : 0),
    0,
  );
  return positional + mobility + cornerScore * 80 + (mine - theirs) * 0.5;
}

function search(
  board: Uint8Array,
  me: Stone,
  turn: Stone,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth === 0) return evaluate(board, me);

  const moves = orderedMoves(board, turn);
  if (moves.length === 0) {
    if (countLegalMoves(board, opposite(turn)) === 0) {
      return evaluate(board, me);
    }
    return search(board, me, opposite(turn), depth - 1, alpha, beta);
  }

  const maximizing = turn === me;
  if (maximizing) {
    let best = -Infinity;
    for (const { move, flips } of moves) {
      board[move.cell] = turn;
      for (const flip of flips) board[flip] = turn;
      best = Math.max(
        best,
        search(board, me, opposite(turn), depth - 1, alpha, beta),
      );
      board[move.cell] = 0;
      for (const flip of flips) board[flip] = opposite(turn);
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = Infinity;
  for (const { move, flips } of moves) {
    board[move.cell] = turn;
    for (const flip of flips) board[flip] = turn;
    best = Math.min(
      best,
      search(board, me, opposite(turn), depth - 1, alpha, beta),
    );
    board[move.cell] = 0;
    for (const flip of flips) board[flip] = opposite(turn);
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(
  board: Uint8Array,
  me: Stone,
  difficulty: Difficulty,
): Move | null {
  const moves = orderedMoves(board, me);
  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    const safeMoves = moves.filter(
      ({ move }) => POSITION_VALUES[move.cell] >= 20,
    );
    const pool = safeMoves.length > 0 ? safeMoves : moves;
    return randomItem(pool.slice(0, 5)).move;
  }

  const depth = difficulty === "hard" ? 5 : 3;
  let best = moves[0].move;
  let bestValue = -Infinity;
  for (const { move, flips } of moves) {
    board[move.cell] = me;
    for (const flip of flips) board[flip] = me;
    const value = search(
      board,
      me,
      opposite(me),
      depth - 1,
      -Infinity,
      Infinity,
    );
    board[move.cell] = 0;
    for (const flip of flips) board[flip] = opposite(me);
    if (value > bestValue) {
      bestValue = value;
      best = move;
    }
  }
  return best;
}
