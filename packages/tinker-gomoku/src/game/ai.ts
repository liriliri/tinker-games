import {
  BOARD_SIZE,
  CELL_COUNT,
  EMPTY,
  DIRECTIONS,
  index,
  inBounds,
  opposite,
  type Stone,
} from "./rules";

const SHAPE_SCORE: Record<string, number> = {
  five: 10_000_000,
  "4-open": 200_000,
  "4-closed": 12_000,
  "3-open": 9_000,
  "3-closed": 800,
  "2-open": 600,
  "2-closed": 90,
  "1-open": 40,
  "1-closed": 6,
};

type Candidate = {
  row: number;
  column: number;
  cell: number;
  attack: number;
  defense: number;
  weight: number;
};

function pointScore(
  board: Uint8Array,
  row: number,
  column: number,
  stone: Stone,
) {
  let score = 0;

  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    let openEnds = 0;

    for (const direction of [1, -1]) {
      for (let step = 1; step < 5; step++) {
        const nextRow = row + dr * step * direction;
        const nextColumn = column + dc * step * direction;
        if (!inBounds(nextRow, nextColumn)) break;
        const next = board[index(nextRow, nextColumn)];
        if (next === stone) {
          count++;
          continue;
        }
        if (next === EMPTY) openEnds++;
        break;
      }
    }

    if (count >= 5) {
      score += SHAPE_SCORE.five;
      continue;
    }
    const openness =
      openEnds >= 2 ? "open" : openEnds === 1 ? "closed" : "blocked";
    score += SHAPE_SCORE[`${count}-${openness}`] ?? 0;
  }

  return score;
}

function candidates(
  board: Uint8Array,
  limit: number,
  stone: Stone,
): Candidate[] {
  const seen = new Uint8Array(CELL_COUNT);
  const result: Candidate[] = [];
  let hasStone = false;

  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (board[cell] === EMPTY) continue;
    hasStone = true;
    const row = Math.floor(cell / BOARD_SIZE);
    const column = cell % BOARD_SIZE;

    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nextRow = row + dr;
        const nextColumn = column + dc;
        if (!inBounds(nextRow, nextColumn)) continue;
        const nextCell = index(nextRow, nextColumn);
        if (board[nextCell] !== EMPTY || seen[nextCell]) continue;

        seen[nextCell] = 1;
        const attack = pointScore(board, nextRow, nextColumn, stone);
        const defense = pointScore(board, nextRow, nextColumn, opposite(stone));
        result.push({
          row: nextRow,
          column: nextColumn,
          cell: nextCell,
          attack,
          defense,
          weight: attack + defense * 0.95,
        });
      }
    }
  }

  if (!hasStone) {
    const middle = Math.floor(BOARD_SIZE / 2);
    return [
      {
        row: middle,
        column: middle,
        cell: index(middle, middle),
        attack: 0,
        defense: 0,
        weight: 0,
      },
    ];
  }

  result.sort((a, b) => b.weight - a.weight);
  return result.slice(0, limit);
}

function evaluate(board: Uint8Array, me: Stone) {
  let score = 0;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const stone = board[cell];
    if (stone === EMPTY) continue;
    const row = Math.floor(cell / BOARD_SIZE);
    const column = cell % BOARD_SIZE;
    board[cell] = EMPTY;
    const value = pointScore(board, row, column, stone as Stone);
    board[cell] = stone;
    score += stone === me ? value : -value * 1.15;
  }
  return score;
}

function search(
  board: Uint8Array,
  me: Stone,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  if (depth === 0) return evaluate(board, me);
  const turn = maximizing ? me : opposite(me);
  const moves = candidates(board, 6, turn);
  if (moves.length === 0) return evaluate(board, me);

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      board[move.cell] = turn;
      const value =
        move.attack >= SHAPE_SCORE.five
          ? 9_000_000 + depth * 1_000
          : search(board, me, depth - 1, alpha, beta, false);
      board[move.cell] = EMPTY;
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    board[move.cell] = turn;
    const value =
      move.attack >= SHAPE_SCORE.five
        ? -9_000_000 - depth * 1_000
        : search(board, me, depth - 1, alpha, beta, true);
    board[move.cell] = EMPTY;
    best = Math.min(best, value);
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export type Difficulty = "easy" | "normal" | "hard";

export function chooseMove(
  board: Uint8Array,
  me: Stone,
  difficulty: Difficulty,
): Candidate | null {
  const moves = candidates(board, difficulty === "easy" ? 14 : 12, me);
  if (moves.length === 0) return null;

  const winningMove = moves.find((move) => move.attack >= SHAPE_SCORE.five);
  if (winningMove) return winningMove;
  const blockingMove = moves.find((move) => move.defense >= SHAPE_SCORE.five);
  if (blockingMove) return blockingMove;

  if (difficulty === "easy") {
    const shuffled = moves.map((move) => ({
      move,
      score: move.attack * 0.9 + move.defense * 0.45 + Math.random() * 900,
    }));
    shuffled.sort((a, b) => b.score - a.score);
    return shuffled[0].move;
  }

  if (difficulty === "normal") {
    const scored = moves.map((move) => ({
      move,
      score: move.attack * 1.05 + move.defense + Math.random() * 60,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].move;
  }

  const openFour = moves.find((move) => move.attack >= SHAPE_SCORE["4-open"]);
  if (openFour) return openFour;
  const defendFour = moves.find(
    (move) => move.defense >= SHAPE_SCORE["4-open"],
  );
  if (defendFour) return defendFour;

  let best = moves[0];
  let bestValue = -Infinity;
  for (const move of moves.slice(0, 8)) {
    board[move.cell] = me;
    const value =
      search(board, me, 2, -Infinity, Infinity, false) + move.weight * 0.02;
    board[move.cell] = EMPTY;
    if (value > bestValue) {
      bestValue = value;
      best = move;
    }
  }
  return best;
}
