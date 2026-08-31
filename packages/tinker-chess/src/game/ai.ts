import {
  BISHOP,
  generateLegalMoves,
  isInCheck,
  KING,
  KNIGHT,
  makeMove,
  PAWN,
  pieceSide,
  pieceType,
  positionKey,
  QUEEN,
  ROOK,
  type Move,
  type Position,
  type Side,
  WHITE,
} from "./rules";

export type Difficulty = "easy" | "normal" | "hard";

const MATE_SCORE = 10_000_000;
const VALUES: Record<number, number> = {
  [PAWN]: 100,
  [KNIGHT]: 320,
  [BISHOP]: 330,
  [ROOK]: 500,
  [QUEEN]: 900,
  [KING]: 20_000,
};
const CONFIG: Record<
  Difficulty,
  { depth: number; time: number; randomness: number }
> = {
  easy: { depth: 2, time: 120, randomness: 0.22 },
  normal: { depth: 3, time: 520, randomness: 0 },
  hard: { depth: 4, time: 1_400, randomness: 0 },
};

type CacheEntry = {
  depth: number;
  value: number;
  move: string;
  bound: "exact" | "lower" | "upper";
};
type SearchContext = {
  deadline: number;
  stopped: boolean;
  table: Map<string, CacheEntry>;
  killers: Map<number, string[]>;
  history: Map<string, number>;
};

const CENTER_CELLS = [27, 28, 35, 36];
function moveKey(move: Move) {
  return `${move.from}:${move.to}:${move.promotion ?? 0}`;
}

function rankFromSide(side: Side, cell: number) {
  const row = Math.floor(cell / 8);
  return side === WHITE ? 7 - row : row;
}

function positionalBonus(piece: number, cell: number) {
  const type = pieceType(piece);
  const side = pieceSide(piece);
  const column = cell % 8;
  const rank = rankFromSide(side, cell);
  const center = 4 - Math.abs(column - 3.5);
  if (type === PAWN) return rank * 9 + (rank >= 4 ? center * 5 : 0);
  if (type === KNIGHT) return center * 12 + (6 - Math.abs(rank - 3)) * 3;
  if (type === BISHOP) return center * 7 + rank * 2;
  if (type === ROOK) return (rank === 6 ? 18 : 0) + center * 3;
  if (type === QUEEN) return center * 3;
  if (type === KING) return rank < 2 ? 18 : -Math.max(0, rank - 2) * 4;
  return 0;
}

function evaluate(position: Position, perspective: Side) {
  let score = 0;
  let ownBishops = 0;
  let enemyBishops = 0;
  const pawnFiles = new Map<number, number>();
  for (let cell = 0; cell < 64; cell++) {
    const piece = position.board[cell];
    if (!piece) continue;
    const side = pieceSide(piece);
    const type = pieceType(piece);
    const signedValue =
      VALUES[type] + (side === perspective ? positionalBonus(piece, cell) : 0);
    score += side === perspective ? signedValue : -VALUES[type];
    if (side === perspective && type === BISHOP) ownBishops++;
    if (side !== perspective && type === BISHOP) enemyBishops++;
    if (type === PAWN && side === perspective) {
      const file = cell % 8;
      pawnFiles.set(file, (pawnFiles.get(file) ?? 0) + 1);
    }
  }
  for (const count of pawnFiles.values()) {
    if (count > 1) score -= (count - 1) * 14;
  }
  if (ownBishops >= 2) score += 28;
  if (enemyBishops >= 2) score -= 28;
  score +=
    (generateLegalMoves(position, perspective).length -
      generateLegalMoves(position, perspective === WHITE ? -1 : 1).length) *
    3;
  for (const cell of CENTER_CELLS) {
    const piece = position.board[cell];
    if (piece !== 0 && pieceSide(piece) === perspective) score += 4;
  }
  if (position.castling & (perspective === WHITE ? 3 : 12)) score += 18;
  if (isInCheck(position, perspective)) score -= 35;
  if (isInCheck(position, perspective === WHITE ? -1 : 1)) score += 35;
  return score;
}

function stopped(context: SearchContext) {
  if (performance.now() >= context.deadline) context.stopped = true;
  return context.stopped;
}

function orderedMoves(
  position: Position,
  moves: Move[],
  context: SearchContext,
  ply: number,
  preferred = "",
) {
  const killers = context.killers.get(ply) ?? [];
  return moves
    .map((move) => {
      const key = moveKey(move);
      const capture =
        move.captured !== 0
          ? VALUES[pieceType(move.captured)] * 12 -
            VALUES[pieceType(move.piece)]
          : move.enPassant
            ? 900
            : 0;
      const promotion = move.promotion ? VALUES[move.promotion] : 0;
      const killer = killers.includes(key) ? 1_200 : 0;
      return {
        move,
        score:
          capture +
          promotion +
          killer +
          (key === preferred ? 50_000 : 0) +
          (context.history.get(key) ?? 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ move }) => move);
}

function search(
  position: Position,
  depth: number,
  alpha: number,
  beta: number,
  context: SearchContext,
  ply: number,
): number {
  if (stopped(context)) return evaluate(position, position.turn);
  const legal = generateLegalMoves(position);
  if (!legal.length) {
    return isInCheck(position, position.turn) ? -MATE_SCORE + ply : 0;
  }
  if (depth === 0) return evaluate(position, position.turn);

  const key = positionKey(position);
  const originalAlpha = alpha;
  const originalBeta = beta;
  const cached = context.table.get(key);
  if (cached && cached.depth >= depth) {
    if (cached.bound === "exact") return cached.value;
    if (cached.bound === "lower") alpha = Math.max(alpha, cached.value);
    if (cached.bound === "upper") beta = Math.min(beta, cached.value);
    if (alpha >= beta) return cached.value;
  }
  let best = -Infinity;
  let bestMove = legal[0];
  for (const move of orderedMoves(
    position,
    legal,
    context,
    ply,
    cached?.move,
  )) {
    const value = -search(
      makeMove(position, move),
      depth - 1,
      -beta,
      -alpha,
      context,
      ply + 1,
    );
    if (value > best) {
      best = value;
      bestMove = move;
    }
    alpha = Math.max(alpha, value);
    if (alpha >= beta) {
      if (!move.captured) {
        const current = context.killers.get(ply) ?? [];
        if (current[0] !== moveKey(move)) {
          context.killers.set(ply, [moveKey(move), current[0]].filter(Boolean));
        }
        context.history.set(
          moveKey(move),
          (context.history.get(moveKey(move)) ?? 0) + depth * depth,
        );
      }
      break;
    }
    if (stopped(context)) break;
  }
  const bound =
    best <= originalAlpha
      ? "upper"
      : best >= originalBeta
        ? "lower"
        : "exact";
  context.table.set(key, {
    depth,
    value: best,
    move: moveKey(bestMove),
    bound,
  });
  return best;
}

function searchRoot(
  position: Position,
  depth: number,
  context: SearchContext,
  previousMove = "",
) {
  const moves = orderedMoves(
    position,
    generateLegalMoves(position),
    context,
    0,
    previousMove,
  );
  let bestMove = moves[0];
  let bestValue = -Infinity;
  let alpha = -Infinity;
  for (const move of moves) {
    if (stopped(context)) break;
    const value = -search(
      makeMove(position, move),
      depth - 1,
      -Infinity,
      -alpha,
      context,
      1,
    );
    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
    alpha = Math.max(alpha, value);
  }
  return { move: bestMove, value: bestValue };
}

export function chooseMove(
  position: Position,
  difficulty: Difficulty,
): Move | null {
  const legal = generateLegalMoves(position);
  if (!legal.length) return null;
  const config = CONFIG[difficulty];
  const context: SearchContext = {
    deadline: performance.now() + config.time,
    stopped: false,
    table: new Map(),
    killers: new Map(),
    history: new Map(),
  };
  let best = orderedMoves(position, legal, context, 0)[0];
  let previousMove = "";
  for (let depth = 1; depth <= config.depth; depth++) {
    context.stopped = false;
    const result = searchRoot(position, depth, context, previousMove);
    if (context.stopped) break;
    best = result.move;
    previousMove = moveKey(best);
  }
  if (config.randomness && Math.random() < config.randomness) {
    const alternatives = orderedMoves(position, legal, context, 0).filter(
      (move) => moveKey(move) !== moveKey(best),
    );
    if (alternatives.length) return alternatives[0];
  }
  return best;
}
