export const BOARD_SIZE = 15;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export type Stone = typeof BLACK | typeof WHITE;

export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

export function index(row: number, column: number) {
  return row * BOARD_SIZE + column;
}

export function inBounds(row: number, column: number) {
  return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE;
}

export function newBoard() {
  return new Uint8Array(CELL_COUNT);
}

export function opposite(stone: Stone): Stone {
  return stone === BLACK ? WHITE : BLACK;
}

export function isFull(board: Uint8Array) {
  for (const cell of board) {
    if (cell === EMPTY) return false;
  }
  return true;
}

export function winningLine(
  board: Uint8Array,
  row: number,
  column: number,
): [number, number][] | null {
  const stone = board[index(row, column)];
  if (stone === EMPTY) return null;

  for (const [dr, dc] of DIRECTIONS) {
    const line: [number, number][] = [[row, column]];
    for (let step = 1; step < BOARD_SIZE; step++) {
      const nextRow = row + dr * step;
      const nextColumn = column + dc * step;
      if (
        !inBounds(nextRow, nextColumn) ||
        board[index(nextRow, nextColumn)] !== stone
      )
        break;
      line.push([nextRow, nextColumn]);
    }
    for (let step = 1; step < BOARD_SIZE; step++) {
      const nextRow = row - dr * step;
      const nextColumn = column - dc * step;
      if (
        !inBounds(nextRow, nextColumn) ||
        board[index(nextRow, nextColumn)] !== stone
      )
        break;
      line.unshift([nextRow, nextColumn]);
    }
    if (line.length >= 5) return line;
  }
  return null;
}
