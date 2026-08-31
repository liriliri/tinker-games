export const ROWS = 8;
export const COLUMNS = 8;
export const CELL_COUNT = 64;

export const EMPTY = 0;
export const WHITE = 1;
export const BLACK = -1;
export type Side = typeof WHITE | typeof BLACK;

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export type PieceType =
  | typeof PAWN
  | typeof KNIGHT
  | typeof BISHOP
  | typeof ROOK
  | typeof QUEEN
  | typeof KING;
export type Piece = number;

export const WHITE_KINGSIDE = 1;
export const WHITE_QUEENSIDE = 2;
export const BLACK_KINGSIDE = 4;
export const BLACK_QUEENSIDE = 8;

export type Move = {
  from: number;
  to: number;
  piece: Piece;
  captured: Piece;
  promotion?: PieceType;
  enPassant?: boolean;
  castle?: "kingside" | "queenside";
};

export type Position = {
  board: Int8Array;
  turn: Side;
  castling: number;
  enPassant: number;
  halfmove: number;
  fullmove: number;
};

export type GameResult = "playing" | "white" | "black" | "draw";

export const PIECE_GLYPHS: Record<number, { white: string; black: string }> = {
  [PAWN]: { white: "♙", black: "♟" },
  [KNIGHT]: { white: "♘", black: "♞" },
  [BISHOP]: { white: "♗", black: "♝" },
  [ROOK]: { white: "♖", black: "♜" },
  [QUEEN]: { white: "♕", black: "♛" },
  [KING]: { white: "♔", black: "♚" },
};

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
  return piece > 0 ? WHITE : BLACK;
}

export function opposite(side: Side): Side {
  return side === WHITE ? BLACK : WHITE;
}

export function newPosition(): Position {
  const board = new Int8Array(CELL_COUNT);
  const backRank = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];
  backRank.forEach((type, column) => {
    board[index(0, column)] = -type;
    board[index(1, column)] = -PAWN;
    board[index(6, column)] = PAWN;
    board[index(7, column)] = type;
  });
  return {
    board,
    turn: WHITE,
    castling:
      WHITE_KINGSIDE | WHITE_QUEENSIDE | BLACK_KINGSIDE | BLACK_QUEENSIDE,
    enPassant: -1,
    halfmove: 0,
    fullmove: 1,
  };
}

export function clonePosition(position: Position): Position {
  return { ...position, board: new Int8Array(position.board) };
}

function addMove(
  position: Position,
  moves: Move[],
  from: number,
  to: number,
  side: Side,
  extra: Partial<Move> = {},
) {
  if (!inBounds(rowOf(to), columnOf(to))) return;
  const captured = position.board[to];
  if (captured === EMPTY || pieceSide(captured) !== side) {
    moves.push({
      from,
      to,
      piece: position.board[from],
      captured,
      ...extra,
    });
  }
}

function addPawnMove(
  position: Position,
  moves: Move[],
  from: number,
  to: number,
  side: Side,
  extra: Partial<Move> = {},
) {
  const lastRank = side === WHITE ? 0 : 7;
  if (rowOf(to) === lastRank) {
    for (const promotion of [QUEEN, ROOK, BISHOP, KNIGHT] as PieceType[]) {
      addMove(position, moves, from, to, side, { ...extra, promotion });
    }
  } else {
    addMove(position, moves, from, to, side, extra);
  }
}

function rayMoves(
  position: Position,
  moves: Move[],
  from: number,
  side: Side,
  directions: readonly (readonly [number, number])[],
) {
  const row = rowOf(from);
  const column = columnOf(from);
  for (const [dr, dc] of directions) {
    for (let distance = 1; ; distance++) {
      const nextRow = row + dr * distance;
      const nextColumn = column + dc * distance;
      if (!inBounds(nextRow, nextColumn)) break;
      const to = index(nextRow, nextColumn);
      const captured = position.board[to];
      if (captured === EMPTY) {
        moves.push({ from, to, piece: position.board[from], captured: EMPTY });
      } else {
        if (pieceSide(captured) !== side) {
          moves.push({ from, to, piece: position.board[from], captured });
        }
        break;
      }
    }
  }
}

const diagonalDirections = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;
const straightDirections = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
const knightSteps = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
] as const;

export function generatePseudoMoves(
  position: Position,
  side: Side = position.turn,
) {
  const moves: Move[] = [];
  const board = position.board;
  for (let from = 0; from < CELL_COUNT; from++) {
    const piece = board[from];
    if (piece === EMPTY || pieceSide(piece) !== side) continue;
    const type = pieceType(piece);
    const row = rowOf(from);
    const column = columnOf(from);

    if (type === PAWN) {
      const forward = side === WHITE ? -1 : 1;
      const oneStep = index(row + forward, column);
      if (inBounds(row + forward, column) && board[oneStep] === EMPTY) {
        addPawnMove(position, moves, from, oneStep, side);
        const startRow = side === WHITE ? 6 : 1;
        const twoStep = index(row + forward * 2, column);
        if (row === startRow && board[twoStep] === EMPTY) {
          moves.push({
            from,
            to: twoStep,
            piece,
            captured: EMPTY,
          });
        }
      }
      for (const dc of [-1, 1]) {
        const targetRow = row + forward;
        const targetColumn = column + dc;
        if (!inBounds(targetRow, targetColumn)) continue;
        const to = index(targetRow, targetColumn);
        if (board[to] !== EMPTY && pieceSide(board[to]) !== side) {
          addPawnMove(position, moves, from, to, side);
        } else if (to === position.enPassant) {
          const capturedCell = index(row, targetColumn);
          if (board[capturedCell] === -side * PAWN) {
            addPawnMove(position, moves, from, to, side, { enPassant: true });
          }
        }
      }
    } else if (type === KNIGHT) {
      for (const [dr, dc] of knightSteps) {
        if (inBounds(row + dr, column + dc)) {
          addMove(position, moves, from, index(row + dr, column + dc), side);
        }
      }
    } else if (type === BISHOP) {
      rayMoves(position, moves, from, side, diagonalDirections);
    } else if (type === ROOK) {
      rayMoves(position, moves, from, side, straightDirections);
    } else if (type === QUEEN) {
      rayMoves(position, moves, from, side, [
        ...straightDirections,
        ...diagonalDirections,
      ]);
    } else if (type === KING) {
      for (const [dr, dc] of [...straightDirections, ...diagonalDirections]) {
        if (inBounds(row + dr, column + dc)) {
          addMove(position, moves, from, index(row + dr, column + dc), side);
        }
      }

      const home = side === WHITE ? 7 : 0;
      const kingStart = index(home, 4);
      if (
        from === kingStart &&
        !isSquareAttacked(position, from, opposite(side))
      ) {
        const kingsideRight = side === WHITE ? WHITE_KINGSIDE : BLACK_KINGSIDE;
        const queensideRight =
          side === WHITE ? WHITE_QUEENSIDE : BLACK_QUEENSIDE;
        if (
          position.castling & kingsideRight &&
          board[index(home, 5)] === EMPTY &&
          board[index(home, 6)] === EMPTY &&
          board[index(home, 7)] === side * ROOK &&
          !isSquareAttacked(position, index(home, 5), opposite(side)) &&
          !isSquareAttacked(position, index(home, 6), opposite(side))
        ) {
          moves.push({
            from,
            to: index(home, 6),
            piece,
            captured: EMPTY,
            castle: "kingside",
          });
        }
        if (
          position.castling & queensideRight &&
          board[index(home, 1)] === EMPTY &&
          board[index(home, 2)] === EMPTY &&
          board[index(home, 3)] === EMPTY &&
          board[index(home, 0)] === side * ROOK &&
          !isSquareAttacked(position, index(home, 3), opposite(side)) &&
          !isSquareAttacked(position, index(home, 2), opposite(side))
        ) {
          moves.push({
            from,
            to: index(home, 2),
            piece,
            captured: EMPTY,
            castle: "queenside",
          });
        }
      }
    }
  }
  return moves;
}

export function makeMove(position: Position, move: Move): Position {
  const next = clonePosition(position);
  const side = position.turn;
  const board = next.board;
  board[move.from] = EMPTY;
  if (move.enPassant) {
    const captureRow = rowOf(move.from);
    const captureColumn = columnOf(move.to);
    board[index(captureRow, captureColumn)] = EMPTY;
  }
  board[move.to] = move.promotion ? side * move.promotion : move.piece;

  const home = side === WHITE ? 7 : 0;
  if (pieceType(move.piece) === KING) {
    next.castling &=
      side === WHITE
        ? ~(WHITE_KINGSIDE | WHITE_QUEENSIDE)
        : ~(BLACK_KINGSIDE | BLACK_QUEENSIDE);
    if (move.castle) {
      const rookFrom = index(home, move.castle === "kingside" ? 7 : 0);
      const rookTo = index(home, move.castle === "kingside" ? 5 : 3);
      board[rookTo] = board[rookFrom];
      board[rookFrom] = EMPTY;
    }
  }
  if (pieceType(move.piece) === ROOK) {
    if (move.from === index(7, 0)) next.castling &= ~WHITE_QUEENSIDE;
    if (move.from === index(7, 7)) next.castling &= ~WHITE_KINGSIDE;
    if (move.from === index(0, 0)) next.castling &= ~BLACK_QUEENSIDE;
    if (move.from === index(0, 7)) next.castling &= ~BLACK_KINGSIDE;
  }
  if (pieceType(move.captured) === ROOK) {
    if (move.to === index(7, 0)) next.castling &= ~WHITE_QUEENSIDE;
    if (move.to === index(7, 7)) next.castling &= ~WHITE_KINGSIDE;
    if (move.to === index(0, 0)) next.castling &= ~BLACK_QUEENSIDE;
    if (move.to === index(0, 7)) next.castling &= ~BLACK_KINGSIDE;
  }

  next.enPassant = -1;
  if (pieceType(move.piece) === PAWN && Math.abs(move.to - move.from) === 16) {
    next.enPassant = (move.to + move.from) / 2;
  }
  next.halfmove =
    pieceType(move.piece) === PAWN || move.captured !== EMPTY
      ? 0
      : position.halfmove + 1;
  next.fullmove = side === BLACK ? position.fullmove + 1 : position.fullmove;
  next.turn = opposite(side);
  return next;
}

export function findKing(position: Position, side: Side) {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (position.board[cell] === side * KING) return cell;
  }
  return -1;
}

export function isSquareAttacked(
  position: Position,
  target: number,
  bySide: Side,
) {
  const board = position.board;
  const row = rowOf(target);
  const column = columnOf(target);
  const pawnRow = row + (bySide === WHITE ? 1 : -1);
  for (const pawnColumn of [column - 1, column + 1]) {
    if (
      inBounds(pawnRow, pawnColumn) &&
      board[index(pawnRow, pawnColumn)] === bySide * PAWN
    ) {
      return true;
    }
  }
  for (const [dr, dc] of knightSteps) {
    const sourceRow = row + dr;
    const sourceColumn = column + dc;
    if (
      inBounds(sourceRow, sourceColumn) &&
      board[index(sourceRow, sourceColumn)] === bySide * KNIGHT
    ) {
      return true;
    }
  }
  for (const [dr, dc] of [...straightDirections, ...diagonalDirections]) {
    for (let distance = 1; ; distance++) {
      const sourceRow = row + dr * distance;
      const sourceColumn = column + dc * distance;
      if (!inBounds(sourceRow, sourceColumn)) break;
      const piece = board[index(sourceRow, sourceColumn)];
      if (piece === EMPTY) continue;
      if (pieceSide(piece) === bySide) {
        const type = pieceType(piece);
        if (
          (distance === 1 && type === KING) ||
          type === QUEEN ||
          (type === ROOK && (dr === 0 || dc === 0)) ||
          (type === BISHOP && dr !== 0 && dc !== 0)
        ) {
          return true;
        }
      }
      break;
    }
  }
  return false;
}

export function isInCheck(position: Position, side: Side) {
  const king = findKing(position, side);
  return king < 0 || isSquareAttacked(position, king, opposite(side));
}

export function generateLegalMoves(
  position: Position,
  side: Side = position.turn,
) {
  return generatePseudoMoves(position, side).filter(
    (move) => !isInCheck(makeMove({ ...position, turn: side }, move), side),
  );
}

function insufficientMaterial(position: Position) {
  const minorPieces: { type: PieceType; cell: number }[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const piece = position.board[cell];
    if (!piece || pieceType(piece) === KING) continue;
    const type = pieceType(piece);
    if (type === PAWN || type === ROOK || type === QUEEN) return false;
    minorPieces.push({ type, cell });
  }
  if (minorPieces.length <= 1) return true;
  return (
    minorPieces.every(({ type }) => type === BISHOP) &&
    new Set(minorPieces.map(({ cell }) => (rowOf(cell) + columnOf(cell)) % 2))
      .size === 1
  );
}

export function positionKey(position: Position) {
  return `${position.board.join(",")}|${position.turn}|${position.castling}|${position.enPassant}`;
}

export function resultFor(
  position: Position,
  repetitionCount = 1,
  legalMoves = generateLegalMoves(position),
): GameResult {
  if (legalMoves.length === 0) {
    if (isInCheck(position, position.turn)) {
      return position.turn === WHITE ? "black" : "white";
    }
    return "draw";
  }
  if (
    position.halfmove >= 100 ||
    repetitionCount >= 3 ||
    insufficientMaterial(position)
  ) {
    return "draw";
  }
  return "playing";
}
