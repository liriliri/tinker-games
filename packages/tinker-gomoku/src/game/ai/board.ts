import Evaluate, { FIVE, type AiRole } from "./eval";

const enableCache = true;

export class Cache<T = unknown> {
  private capacity: number;
  private cache: bigint[] = [];
  private map = new Map<bigint, T>();
  private nextEviction = 0;

  constructor(capacity = 1_000_000) {
    this.capacity = capacity;
  }

  get(key: bigint): T | null {
    if (!enableCache) return null;
    return this.map.get(key) ?? null;
  }

  put(key: bigint, value: T) {
    if (!enableCache) return;
    if (this.map.has(key)) {
      this.map.set(key, value);
      return;
    }
    if (this.cache.length < this.capacity) {
      this.cache.push(key);
    } else {
      const oldestKey = this.cache[this.nextEviction]!;
      this.map.delete(oldestKey);
      this.cache[this.nextEviction] = key;
      this.nextEviction = (this.nextEviction + 1) % this.capacity;
    }
    this.map.set(key, value);
  }
}

class Zobrist {
  private zobristTable: Record<AiRole, bigint>[][];
  hash = 0n;

  constructor(private size: number) {
    this.zobristTable = this.initializeZobristTable(size);
  }

  private randomBitString(length: number) {
    let str = "0b";
    for (let i = 0; i < length; i++) {
      str += Math.round(Math.random()).toString();
    }
    return str;
  }

  private initializeZobristTable(size: number) {
    const table: Record<AiRole, bigint>[][] = [];
    for (let i = 0; i < size; i++) {
      table[i] = [];
      for (let j = 0; j < size; j++) {
        table[i]![j] = {
          1: BigInt(this.randomBitString(64)),
          [-1]: BigInt(this.randomBitString(64)),
        };
      }
    }
    return table;
  }

  togglePiece(x: number, y: number, role: AiRole) {
    this.hash ^= this.zobristTable[x]![y]![role];
  }

  getHash() {
    return this.hash;
  }
}

const WIN_DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;
const WIN_SIGNS = [-1, 1] as const;

export default class Board {
  size: number;
  board: number[][];
  firstRole: AiRole;
  role: AiRole;
  history: { i: number; j: number; role: AiRole; previousRole: AiRole }[] = [];
  emptyCount: number;
  winner = 0;
  private zobrist: Zobrist;
  private evaluateCache = new Cache<{ role: AiRole; score: number }>();
  private valuableMovesCache = new Cache<{
    role: AiRole;
    moves: [number, number][];
    depth: number;
    onlyThree: boolean;
    onlyFour: boolean;
  }>();
  evaluator: Evaluate;

  constructor(size = 15, firstRole: AiRole = 1) {
    this.size = size;
    this.board = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => 0),
    );
    this.firstRole = firstRole;
    this.role = firstRole;
    this.emptyCount = size * size;
    this.zobrist = new Zobrist(size);
    this.evaluator = new Evaluate(size);
  }

  isGameOver() {
    return this.winner !== 0 || this.emptyCount === 0;
  }

  getWinner() {
    return this.winner;
  }

  hasFiveAt(i: number, j: number, role: AiRole) {
    for (const [di, dj] of WIN_DIRECTIONS) {
      let count = 1;
      for (const sign of WIN_SIGNS) {
        for (let step = 1; step < 5; step++) {
          const x = i + sign * step * di;
          const y = j + sign * step * dj;
          if (
            x < 0 ||
            x >= this.size ||
            y < 0 ||
            y >= this.size ||
            this.board[x]![y] !== role
          )
            break;
          count++;
        }
      }
      if (count >= 5) return true;
    }
    return false;
  }

  put(i: number, j: number, role?: AiRole) {
    const stone = role ?? this.role;
    if (this.board[i]![j] !== 0) return false;

    this.board[i]![j] = stone;
    this.history.push({ i, j, role: stone, previousRole: this.role });
    this.zobrist.togglePiece(i, j, stone);
    this.evaluator.move(i, j, stone);
    this.emptyCount--;
    this.winner = this.hasFiveAt(i, j, stone) ? stone : 0;
    this.role = -stone as AiRole;
    return true;
  }

  undo() {
    const lastMove = this.history.pop();
    if (!lastMove) return false;

    this.board[lastMove.i]![lastMove.j] = 0;
    this.role = lastMove.previousRole;
    this.zobrist.togglePiece(lastMove.i, lastMove.j, lastMove.role);
    this.evaluator.undo(lastMove.i, lastMove.j);
    this.emptyCount++;
    this.winner = 0;
    return true;
  }

  getValuableMoves(
    role: AiRole,
    depth = 0,
    onlyThree = false,
    onlyFour = false,
  ) {
    const hash = this.hash();
    const prev = this.valuableMovesCache.get(hash);
    if (
      prev &&
      prev.role === role &&
      prev.depth === depth &&
      prev.onlyThree === onlyThree &&
      prev.onlyFour === onlyFour
    ) {
      return prev.moves;
    }

    const moves = this.evaluator.getMoves(role, depth, onlyThree, onlyFour);
    if (!onlyThree && !onlyFour) {
      const center = Math.floor(this.size / 2);
      if (this.board[center]![center] === 0) {
        moves.push([center, center]);
      }
    }

    this.valuableMovesCache.put(hash, {
      role,
      moves,
      depth,
      onlyThree,
      onlyFour,
    });
    return moves;
  }

  hash() {
    return this.zobrist.getHash();
  }

  evaluate(role: AiRole) {
    const hash = this.hash();
    const prev = this.evaluateCache.get(hash);
    if (prev?.role === role) return prev.score;

    const winner = this.getWinner();
    const score =
      winner !== 0 ? FIVE * winner * role : this.evaluator.evaluate(role);
    this.evaluateCache.put(hash, { role, score });
    return score;
  }
}
