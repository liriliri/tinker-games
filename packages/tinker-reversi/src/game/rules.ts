export const BOARD_SIZE = 8;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export type Stone = typeof BLACK | typeof WHITE;

export const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export type Move = {
  row: number;
  column: number;
  cell: number;
};

export function index(row: number, column: number) {
  return row * BOARD_SIZE + column;
}

export function inBounds(row: number, column: number) {
  return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE;
}

export function newBoard() {
  const board = new Uint8Array(CELL_COUNT);
  board[index(3, 3)] = WHITE;
  board[index(3, 4)] = BLACK;
  board[index(4, 3)] = BLACK;
  board[index(4, 4)] = WHITE;
  return board;
}

export function opposite(stone: Stone): Stone {
  return stone === BLACK ? WHITE : BLACK;
}

export function getFlips(
  board: Uint8Array,
  row: number,
  column: number,
  stone: Stone,
) {
  if (!inBounds(row, column) || board[index(row, column)] !== EMPTY) return [];

  const other = opposite(stone);
  const flips: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let nextRow = row + dr;
    let nextColumn = column + dc;
    while (
      inBounds(nextRow, nextColumn) &&
      board[index(nextRow, nextColumn)] === other
    ) {
      line.push(index(nextRow, nextColumn));
      nextRow += dr;
      nextColumn += dc;
    }
    if (
      line.length > 0 &&
      inBounds(nextRow, nextColumn) &&
      board[index(nextRow, nextColumn)] === stone
    ) {
      flips.push(...line);
    }
  }
  return flips;
}

export function isLegalMove(
  board: Uint8Array,
  row: number,
  column: number,
  stone: Stone,
) {
  return getFlips(board, row, column, stone).length > 0;
}

export function getLegalMoves(board: Uint8Array, stone: Stone): Move[] {
  const moves: Move[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (board[cell] !== EMPTY) continue;
    const row = Math.floor(cell / BOARD_SIZE);
    const column = cell % BOARD_SIZE;
    if (getFlips(board, row, column, stone).length > 0) {
      moves.push({ row, column, cell });
    }
  }
  return moves;
}

export function applyMove(
  board: Uint8Array,
  row: number,
  column: number,
  stone: Stone,
) {
  const cell = index(row, column);
  const flips = getFlips(board, row, column, stone);
  if (flips.length === 0) return [];
  board[cell] = stone;
  for (const flip of flips) board[flip] = stone;
  return [cell, ...flips];
}

export function countStones(board: Uint8Array) {
  let black = 0;
  let white = 0;
  for (const cell of board) {
    if (cell === BLACK) black++;
    if (cell === WHITE) white++;
  }
  return { black, white };
}

export function isFull(board: Uint8Array) {
  return !board.includes(EMPTY);
}

export function isGameOver(board: Uint8Array) {
  return (
    getLegalMoves(board, BLACK).length === 0 &&
    getLegalMoves(board, WHITE).length === 0
  );
}
