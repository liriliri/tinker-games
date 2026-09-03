import {
  DraughtsPlayer,
  DraughtsStatus,
  type DraughtsMove1D,
} from "rapid-draughts";
import {
  EnglishDraughts,
  type EnglishDraughtsEngineData,
  type EnglishDraughtsGame,
} from "rapid-draughts/english";
import filter from "licia/filter";

export const BOARD_SIZE = 8;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const ROWS = BOARD_SIZE;
export const COLUMNS = BOARD_SIZE;

/** Dark (black) pieces — move first in English draughts. */
export const DARK = -1;
/** Light (white) pieces. */
export const LIGHT = 1;

export type Side = typeof DARK | typeof LIGHT;
export type Piece = number; // ±1 man, ±2 king, 0 empty
export type Move = DraughtsMove1D;
export type EngineSnapshot = EnglishDraughtsEngineData;

export type CheckersGame = EnglishDraughtsGame;

export function index(row: number, column: number) {
  return row * COLUMNS + column;
}

export function rowOf(cell: number) {
  return Math.floor(cell / COLUMNS);
}

export function columnOf(cell: number) {
  return cell % COLUMNS;
}

/** Playable dark squares are those with (row + column) odd. */
export function isDarkSquare(row: number, column: number) {
  return (row + column) % 2 === 1;
}

export function darkPosToCell(position: number): number {
  const row = Math.floor(position / 4);
  const file = position % 4;
  const column = row % 2 === 0 ? file * 2 + 1 : file * 2;
  return index(row, column);
}

/** Default cursor: dark square 20 (near the human side). */
export const DEFAULT_CURSOR_CELL = darkPosToCell(20);

export function cellToDarkPos(cell: number): number | null {
  const row = rowOf(cell);
  const column = columnOf(cell);
  if (!isDarkSquare(row, column)) return null;
  return row * 4 + Math.floor(column / 2);
}

export function newGame(): CheckersGame {
  return EnglishDraughts.setup();
}

export function cloneSnapshot(data: EngineSnapshot): EngineSnapshot {
  return {
    player: data.player,
    board: { ...data.board },
    stats: { ...data.stats },
  };
}

export function snapshotOf(game: CheckersGame): EngineSnapshot {
  return cloneSnapshot(game.engine.serialize());
}

export function restoreGame(data: EngineSnapshot): CheckersGame {
  return EnglishDraughts.setup(cloneSnapshot(data));
}

export function playerToSide(player: DraughtsPlayer): Side {
  return player === DraughtsPlayer.DARK ? DARK : LIGHT;
}

export function boardFromGame(game: CheckersGame): Int8Array {
  const board = new Int8Array(CELL_COUNT);
  for (const square of game.board) {
    if (!square.dark || square.position === undefined) continue;
    const cell = darkPosToCell(square.position);
    if (!square.piece) {
      board[cell] = 0;
      continue;
    }
    const side = square.piece.player === DraughtsPlayer.DARK ? DARK : LIGHT;
    board[cell] = square.piece.king ? side * 2 : side;
  }
  return board;
}

export function pieceSide(piece: Piece): Side {
  return piece > 0 ? LIGHT : DARK;
}

export function isKing(piece: Piece) {
  return Math.abs(piece) === 2;
}

export function movesFrom(game: CheckersGame, darkPos: number): Move[] {
  return filter(game.moves, (move) => move.origin === darkPos);
}

export function resultFor(
  game: CheckersGame,
): "dark" | "light" | "draw" | "playing" {
  switch (game.status) {
    case DraughtsStatus.PLAYING:
      return "playing";
    case DraughtsStatus.DRAW:
      return "draw";
    case DraughtsStatus.DARK_WON:
      return "dark";
    case DraughtsStatus.LIGHT_WON:
      return "light";
  }
}

/** Intermediate landing squares for multi-jump animation (dark positions). */
export function movePath(move: Move): number[] {
  if (move.captures.length === 0) {
    return [move.origin, move.destination];
  }

  const captureSet = new Set(move.captures);
  type Node = {
    pos: number;
    remaining: Set<number>;
    path: number[];
  };
  const queue: Node[] = [
    { pos: move.origin, remaining: captureSet, path: [move.origin] },
  ];
  const directions: Array<[number, number]> = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.remaining.size === 0) {
      if (current.pos === move.destination) return current.path;
      continue;
    }
    const originCell = darkPosToCell(current.pos);
    const row = rowOf(originCell);
    const column = columnOf(originCell);
    for (const [dr, dc] of directions) {
      const captureCell = index(row + dr, column + dc);
      const landCell = index(row + 2 * dr, column + 2 * dc);
      if (
        row + 2 * dr < 0 ||
        row + 2 * dr >= ROWS ||
        column + 2 * dc < 0 ||
        column + 2 * dc >= COLUMNS
      ) {
        continue;
      }
      const capturePos = cellToDarkPos(captureCell);
      const landPos = cellToDarkPos(landCell);
      if (
        capturePos === null ||
        landPos === null ||
        !current.remaining.has(capturePos)
      ) {
        continue;
      }
      const remaining = new Set(current.remaining);
      remaining.delete(capturePos);
      queue.push({
        pos: landPos,
        remaining,
        path: [...current.path, landPos],
      });
    }
  }

  return [move.origin, move.destination];
}

export { DraughtsPlayer, DraughtsStatus };
