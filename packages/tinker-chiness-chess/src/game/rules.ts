export const ROWS = 10;
export const COLUMNS = 9;
export const CELL_COUNT = ROWS * COLUMNS;

export const EMPTY = 0;
export const RED = 1;
export const BLACK = -1;
export type Side = typeof RED | typeof BLACK;

export const KING = 1;
export const ADVISOR = 2;
export const ELEPHANT = 3;
export const HORSE = 4;
export const ROOK = 5;
export const CANNON = 6;
export const PAWN = 7;
export type PieceType =
  | typeof KING
  | typeof ADVISOR
  | typeof ELEPHANT
  | typeof HORSE
  | typeof ROOK
  | typeof CANNON
  | typeof PAWN;
export type Piece = number;

export type Move = {
  from: number;
  to: number;
  piece: Piece;
  captured: Piece;
};

export type GameResult = "playing" | "red" | "black" | "draw";

export const PIECE_LABELS: Record<number, { red: string; black: string }> = {
  [KING]: { red: "帥", black: "將" },
  [ADVISOR]: { red: "仕", black: "士" },
  [ELEPHANT]: { red: "相", black: "象" },
  [HORSE]: { red: "馬", black: "馬" },
  [ROOK]: { red: "車", black: "車" },
  [CANNON]: { red: "炮", black: "砲" },
  [PAWN]: { red: "兵", black: "卒" },
};

const directions = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
const advisorDirections = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;
const elephantDirections = [
  [-2, -2],
  [-2, 2],
  [2, -2],
  [2, 2],
] as const;
const horseSteps = [
  [-2, -1, -1, 0],
  [-2, 1, -1, 0],
  [2, -1, 1, 0],
  [2, 1, 1, 0],
  [-1, -2, 0, -1],
  [1, -2, 0, -1],
  [-1, 2, 0, 1],
  [1, 2, 0, 1],
] as const;

export function index(row: number, column: number) {
  return row * COLUMNS + column;
}

export function rowOf(cell: number) {
  return Math.floor(cell / COLUMNS);
}

export function columnOf(cell: number) {
  return cell % COLUMNS;
}

export function inBounds(row: number, column: number) {
  return row >= 0 && row < ROWS && column >= 0 && column < COLUMNS;
}

export function pieceType(piece: Piece): PieceType {
  return Math.abs(piece) as PieceType;
}

export function pieceSide(piece: Piece): Side {
  return piece > 0 ? RED : BLACK;
}

export function opposite(side: Side): Side {
  return side === RED ? BLACK : RED;
}

export function newBoard() {
  const board = new Int8Array(CELL_COUNT);
  const backRank = [
    ROOK,
    HORSE,
    ELEPHANT,
    ADVISOR,
    KING,
    ADVISOR,
    ELEPHANT,
    HORSE,
    ROOK,
  ];
  backRank.forEach((type, column) => {
    board[index(0, column)] = -type;
    board[index(9, column)] = type;
  });
  board[index(2, 1)] = -CANNON;
  board[index(2, 7)] = -CANNON;
  board[index(7, 1)] = CANNON;
  board[index(7, 7)] = CANNON;
  for (const column of [0, 2, 4, 6, 8]) {
    board[index(3, column)] = -PAWN;
    board[index(6, column)] = PAWN;
  }
  return board;
}

export function cloneBoard(board: Int8Array) {
  return new Int8Array(board);
}

function inPalace(side: Side, row: number, column: number) {
  return column >= 3 && column <= 5 && (side === RED ? row >= 7 : row <= 2);
}

function crossedRiver(side: Side, row: number) {
  return side === RED ? row <= 4 : row >= 5;
}

function addIfReachable(
  board: Int8Array,
  moves: Move[],
  from: number,
  row: number,
  column: number,
  side: Side,
) {
  if (!inBounds(row, column)) return;
  const to = index(row, column);
  const captured = board[to];
  if (captured === EMPTY || pieceSide(captured) !== side) {
    moves.push({ from, to, piece: board[from], captured });
  }
}

function rayMoves(
  board: Int8Array,
  moves: Move[],
  from: number,
  side: Side,
  cannon: boolean,
) {
  const row = rowOf(from);
  const column = columnOf(from);
  for (const [dr, dc] of directions) {
    let jumped = false;
    for (let distance = 1; ; distance++) {
      const nextRow = row + dr * distance;
      const nextColumn = column + dc * distance;
      if (!inBounds(nextRow, nextColumn)) break;
      const to = index(nextRow, nextColumn);
      const captured = board[to];
      if (!jumped) {
        if (captured === EMPTY) {
          moves.push({ from, to, piece: board[from], captured: EMPTY });
        } else if (cannon) {
          jumped = true;
        } else {
          if (pieceSide(captured) !== side) {
            moves.push({ from, to, piece: board[from], captured });
          }
          break;
        }
      } else if (captured !== EMPTY) {
        if (pieceSide(captured) !== side) {
          moves.push({ from, to, piece: board[from], captured });
        }
        break;
      }
    }
  }
}

export function generatePseudoMoves(board: Int8Array, side: Side) {
  const moves: Move[] = [];
  for (let from = 0; from < CELL_COUNT; from++) {
    const piece = board[from];
    if (piece === EMPTY || pieceSide(piece) !== side) continue;
    const type = pieceType(piece);
    const row = rowOf(from);
    const column = columnOf(from);

    if (type === KING) {
      for (const [dr, dc] of directions) {
        const nextRow = row + dr;
        const nextColumn = column + dc;
        if (inPalace(side, nextRow, nextColumn)) {
          addIfReachable(board, moves, from, nextRow, nextColumn, side);
        }
      }
      for (const step of [-1, 1]) {
        for (
          let nextRow = row + step;
          nextRow >= 0 && nextRow < ROWS;
          nextRow += step
        ) {
          const target = board[index(nextRow, column)];
          if (target === EMPTY) continue;
          if (pieceType(target) === KING && pieceSide(target) !== side) {
            moves.push({
              from,
              to: index(nextRow, column),
              piece,
              captured: target,
            });
          }
          break;
        }
      }
    } else if (type === ADVISOR) {
      for (const [dr, dc] of advisorDirections) {
        if (inPalace(side, row + dr, column + dc)) {
          addIfReachable(board, moves, from, row + dr, column + dc, side);
        }
      }
    } else if (type === ELEPHANT) {
      for (const [dr, dc] of elephantDirections) {
        const eyeRow = row + dr / 2;
        const eyeColumn = column + dc / 2;
        const nextRow = row + dr;
        const nextColumn = column + dc;
        if (
          inBounds(nextRow, nextColumn) &&
          !crossedRiver(side, nextRow) &&
          board[index(eyeRow, eyeColumn)] === EMPTY
        ) {
          addIfReachable(board, moves, from, nextRow, nextColumn, side);
        }
      }
    } else if (type === HORSE) {
      for (const [dr, dc, lr, lc] of horseSteps) {
        if (
          inBounds(row + dr, column + dc) &&
          board[index(row + lr, column + lc)] === EMPTY
        ) {
          addIfReachable(board, moves, from, row + dr, column + dc, side);
        }
      }
    } else if (type === ROOK) {
      rayMoves(board, moves, from, side, false);
    } else if (type === CANNON) {
      rayMoves(board, moves, from, side, true);
    } else if (type === PAWN) {
      const forward = side === RED ? -1 : 1;
      addIfReachable(board, moves, from, row + forward, column, side);
      if (crossedRiver(side, row)) {
        addIfReachable(board, moves, from, row, column - 1, side);
        addIfReachable(board, moves, from, row, column + 1, side);
      }
    }
  }
  return moves;
}

export function applyMove(board: Int8Array, move: Move) {
  board[move.to] = move.piece;
  board[move.from] = EMPTY;
}

export function findKing(board: Int8Array, side: Side) {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (board[cell] === side * KING) return cell;
  }
  return -1;
}

export function isInCheck(board: Int8Array, side: Side) {
  const king = findKing(board, side);
  if (king < 0) return true;
  return generatePseudoMoves(board, opposite(side)).some(
    (move) => move.to === king,
  );
}

export function generateLegalMoves(board: Int8Array, side: Side) {
  const legal: Move[] = [];
  for (const move of generatePseudoMoves(board, side)) {
    const next = cloneBoard(board);
    applyMove(next, move);
    if (!isInCheck(next, side)) legal.push(move);
  }
  return legal;
}

export function resultFor(
  board: Int8Array,
  sideToMove: Side,
  legalMoves = generateLegalMoves(board, sideToMove),
): GameResult {
  const redKing = findKing(board, RED);
  const blackKing = findKing(board, BLACK);
  if (redKing < 0) return "black";
  if (blackKing < 0) return "red";
  if (legalMoves.length > 0) return "playing";
  if (isInCheck(board, sideToMove)) return sideToMove === RED ? "black" : "red";
  return "draw";
}

export function moveLabel(move: Move) {
  const side = pieceSide(move.piece);
  const labels = PIECE_LABELS[pieceType(move.piece)];
  return side === RED ? labels.red : labels.black;
}
