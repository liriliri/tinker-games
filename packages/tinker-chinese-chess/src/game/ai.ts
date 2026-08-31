import {
  applyMove,
  COLUMNS,
  generateLegalMoves,
  generatePseudoMoves,
  findKing,
  index,
  isInCheck,
  pieceSide,
  pieceType,
  resultFor,
  opposite,
  ROWS,
  type Move,
  type Side,
  KING,
  ADVISOR,
  ELEPHANT,
  HORSE,
  ROOK,
  CANNON,
  PAWN,
  RED,
} from "./rules";
import gambitText from "./gambit.txt?raw";

export type Difficulty = "easy" | "normal" | "hard";

const MATE_SCORE = 10_000_000;
const PIECE_VALUE: Record<number, number> = {
  [KING]: 100000,
  [ROOK]: 900,
  [CANNON]: 450,
  [HORSE]: 400,
  [ELEPHANT]: 200,
  [ADVISOR]: 200,
  [PAWN]: 100,
};

const CONFIG: Record<
  Difficulty,
  { depth: number; time: number; randomness: number }
> = {
  easy: { depth: 2, time: 100, randomness: 0.2 },
  normal: { depth: 4, time: 450, randomness: 0 },
  hard: { depth: 5, time: 1000, randomness: 0 },
};

type Bound = "exact" | "lower" | "upper";

type TableEntry = {
  depth: number;
  value: number;
  bound: Bound;
  move: string;
};

type SearchContext = {
  deadline: number;
  table: Map<string, TableEntry>;
  history: Map<string, number>;
  killers: Map<number, string[]>;
  stopped: boolean;
};

function moveKey(move: Move) {
  return `${move.from}:${move.to}`;
}

const GAMBIT_BOOK = gambitText
  .split(/\r?\n/)
  .map((line) => line.replace(/#.*/, "").trim())
  .filter(Boolean)
  .map((line) =>
    line.split(/\s+/).flatMap((token) => {
      const match = token.match(/^(\d+),(\d+)-(\d+),(\d+)$/);
      if (!match) return [];
      const [, fromColumn, fromRow, toColumn, toRow] = match;
      return [
        `${index(Number(fromRow), Number(fromColumn))}:${index(Number(toRow), Number(toColumn))}`,
      ];
    }),
  )
  .filter((line) => line.length > 0);
const GAMBIT_INDEX = new Map<string, Set<string>>();

for (const line of GAMBIT_BOOK) {
  for (let length = 0; length < line.length; length++) {
    const prefix = line.slice(0, length).join(" ");
    const moves = GAMBIT_INDEX.get(prefix) ?? new Set<string>();
    moves.add(line[length]);
    GAMBIT_INDEX.set(prefix, moves);
  }
}

function gambitMove(history: Move[], legal: Move[]) {
  const prefix = history.map(moveKey).join(" ");
  const candidates = GAMBIT_INDEX.get(prefix);
  if (!candidates) return null;
  const available = legal.filter((move) => candidates.has(moveKey(move)));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)] ?? null;
}

function boardKey(board: Int8Array, side: Side) {
  return `${side}:${String.fromCharCode(...board)}`;
}

function rankFor(side: Side, row: number) {
  return side === RED ? ROWS - 1 - row : row;
}

function positionalBonus(piece: number, cell: number) {
  const side = pieceSide(piece);
  const type = pieceType(piece);
  const row = Math.floor(cell / COLUMNS);
  const column = cell % COLUMNS;
  const rank = rankFor(side, row);
  const fileCenter = 4 - Math.abs(column - 4);
  const rankCenter = 4 - Math.abs(4 - Math.min(rank, 8));

  if (type === PAWN) {
    return rank * 9 + (rank >= 5 ? 28 + fileCenter * 5 : 0);
  }
  if (type === HORSE) return fileCenter * 10 + rankCenter * 3;
  if (type === CANNON) return fileCenter * 6 + rankCenter * 2;
  if (type === ROOK) return fileCenter * 3 + rankCenter;
  if (type === KING) return rank < 3 ? 8 : 0;
  return 0;
}

function kingSafety(board: Int8Array, side: Side, opponentMoves: Move[]) {
  let score = 0;
  const king = findKing(board, side);
  if (king < 0) return -MATE_SCORE;
  if (opponentMoves.some((move) => move.to === king)) score -= 1800;

  for (let cell = 0; cell < board.length; cell++) {
    if (!board[cell]) continue;
    if (pieceSide(board[cell]) !== side) continue;
    if (pieceType(board[cell]) === ADVISOR) score += 38;
    if (pieceType(board[cell]) === ELEPHANT) score += 22;
  }
  const kingColumn = king % COLUMNS;
  if (kingColumn === 4) score += 12;
  return score;
}

function evaluate(board: Int8Array, perspective: Side) {
  const ownKing = findKing(board, perspective);
  const enemyKing = findKing(board, opposite(perspective));
  if (ownKing < 0) return -MATE_SCORE;
  if (enemyKing < 0) return MATE_SCORE;

  let score = 0;
  for (let cell = 0; cell < board.length; cell++) {
    const piece = board[cell];
    if (!piece) continue;
    const value = PIECE_VALUE[pieceType(piece)] + positionalBonus(piece, cell);
    score += pieceSide(piece) === perspective ? value : -value;
  }

  const opponent = opposite(perspective);
  const ownMoves = generatePseudoMoves(board, perspective);
  const opponentMoves = generatePseudoMoves(board, opponent);
  score += (ownMoves.length - opponentMoves.length) * 2;
  score +=
    kingSafety(board, perspective, opponentMoves) -
    kingSafety(board, opponent, ownMoves);
  return score;
}

function isCheckingMove(board: Int8Array, move: Move) {
  const next = new Int8Array(board);
  applyMove(next, move);
  return isInCheck(next, opposite(pieceSide(move.piece)));
}

function undoMove(board: Int8Array, move: Move) {
  board[move.from] = move.piece;
  board[move.to] = move.captured;
}

function rememberKiller(context: SearchContext, ply: number, move: Move) {
  const key = moveKey(move);
  const killers = context.killers.get(ply) ?? [];
  if (killers[0] !== key) {
    context.killers.set(ply, [key, killers[0]].filter(Boolean) as string[]);
  }
}

function orderMoves(
  board: Int8Array,
  moves: Move[],
  context: SearchContext,
  ply: number,
  preferred = "",
  checkingMoves?: Set<string>,
) {
  const killers = context.killers.get(ply) ?? [];
  return moves
    .map((move) => {
      const key = moveKey(move);
      const captureValue = move.captured
        ? PIECE_VALUE[pieceType(move.captured)] * 16 -
          PIECE_VALUE[pieceType(move.piece)]
        : 0;
      const checkValue =
        (checkingMoves?.has(key) ?? isCheckingMove(board, move)) ? 5000 : 0;
      const preferredValue = key === preferred ? 100000 : 0;
      const killerValue = killers.includes(key) ? 1800 : 0;
      const historyValue = context.history.get(key) ?? 0;
      return {
        move,
        score:
          preferredValue +
          captureValue +
          checkValue +
          killerValue +
          historyValue +
          Math.random() * 0.01,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ move }) => move);
}

function hasStopped(context: SearchContext) {
  if (performance.now() >= context.deadline) context.stopped = true;
  return context.stopped;
}

function quiescence(
  board: Int8Array,
  sideToMove: Side,
  alpha: number,
  beta: number,
  remaining: number,
  context: SearchContext,
  ply: number,
): number {
  if (hasStopped(context)) return evaluate(board, sideToMove);
  if (findKing(board, sideToMove) < 0) return -MATE_SCORE + ply;
  if (findKing(board, opposite(sideToMove)) < 0) return MATE_SCORE - ply;

  const inCheck = isInCheck(board, sideToMove);
  const standPat = inCheck ? -Infinity : evaluate(board, sideToMove);
  if (!inCheck && standPat >= beta) return standPat;
  if (remaining === 0) {
    return inCheck ? evaluate(board, sideToMove) : standPat;
  }

  const legal = generateLegalMoves(board, sideToMove);
  const checkingMoves = inCheck ? undefined : new Set<string>();
  const tactical = inCheck
    ? legal
    : legal.filter((move) => {
        if (move.captured) return true;
        const checking = isCheckingMove(board, move);
        if (checking) checkingMoves?.add(moveKey(move));
        return checking;
      });
  if (!tactical.length) return standPat;

  let best = standPat;
  for (const move of orderMoves(
    board,
    tactical,
    context,
    ply,
    "",
    checkingMoves,
  )) {
    applyMove(board, move);
    const value = -quiescence(
      board,
      opposite(sideToMove),
      -beta,
      -alpha,
      remaining - 1,
      context,
      ply + 1,
    );
    undoMove(board, move);
    best = Math.max(best, value);
    alpha = Math.max(alpha, value);
    if (alpha >= beta || hasStopped(context)) break;
  }
  return best;
}

function search(
  board: Int8Array,
  sideToMove: Side,
  depth: number,
  alpha: number,
  beta: number,
  context: SearchContext,
  ply: number,
): number {
  if (hasStopped(context)) return evaluate(board, sideToMove);
  if (findKing(board, sideToMove) < 0) return -MATE_SCORE + ply;
  if (findKing(board, opposite(sideToMove)) < 0) return MATE_SCORE - ply;
  if (depth === 0) {
    return quiescence(board, sideToMove, alpha, beta, 2, context, ply);
  }

  const key = boardKey(board, sideToMove);
  const cached = context.table.get(key);
  const originalAlpha = alpha;
  if (cached && cached.depth >= depth) {
    if (cached.bound === "exact") return cached.value;
    if (cached.bound === "lower") alpha = Math.max(alpha, cached.value);
    if (cached.bound === "upper") beta = Math.min(beta, cached.value);
    if (alpha >= beta) return cached.value;
  }

  const legal = generateLegalMoves(board, sideToMove);
  if (!legal.length) {
    return isInCheck(board, sideToMove) ? -MATE_SCORE + ply : 0;
  }

  const moves = orderMoves(board, legal, context, ply, cached?.move);
  let best = -Infinity;
  let bestMove = moves[0];
  for (const move of moves) {
    applyMove(board, move);
    const value = -search(
      board,
      opposite(sideToMove),
      depth - 1,
      -beta,
      -alpha,
      context,
      ply + 1,
    );
    undoMove(board, move);
    if (value > best) {
      best = value;
      bestMove = move;
    }
    alpha = Math.max(alpha, value);
    if (alpha >= beta) {
      if (!move.captured) {
        rememberKiller(context, ply, move);
        context.history.set(
          moveKey(move),
          (context.history.get(moveKey(move)) ?? 0) + depth * depth,
        );
      }
      break;
    }
    if (hasStopped(context)) break;
  }

  const bound: Bound =
    best <= originalAlpha ? "upper" : best >= beta ? "lower" : "exact";
  context.table.set(key, {
    depth,
    value: best,
    bound,
    move: moveKey(bestMove),
  });
  return best;
}

function searchRoot(
  board: Int8Array,
  side: Side,
  depth: number,
  context: SearchContext,
  previousMove = "",
) {
  const moves = orderMoves(
    board,
    generateLegalMoves(board, side),
    context,
    0,
    previousMove,
  );
  let bestMove = moves[0];
  let bestValue = -Infinity;
  let alpha = -Infinity;
  for (const move of moves) {
    if (hasStopped(context)) break;
    applyMove(board, move);
    const value = -search(
      board,
      opposite(side),
      depth - 1,
      -Infinity,
      -alpha,
      context,
      1,
    );
    undoMove(board, move);
    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
    alpha = Math.max(alpha, value);
  }
  return { move: bestMove, value: bestValue };
}

export function chooseMove(
  board: Int8Array,
  me: Side,
  difficulty: Difficulty,
  history: Move[] = [],
): Move | null {
  const legal = generateLegalMoves(board, me);
  if (!legal.length || resultFor(board, me, legal) !== "playing") return null;
  const bookMove = gambitMove(history, legal);
  if (bookMove) return bookMove;

  const config = CONFIG[difficulty];
  const context: SearchContext = {
    deadline: performance.now() + config.time,
    table: new Map(),
    history: new Map(),
    killers: new Map(),
    stopped: false,
  };
  let best = orderMoves(board, legal, context, 0)[0];
  let previousMove = "";

  for (let depth = 1; depth <= config.depth; depth++) {
    context.stopped = false;
    const result = searchRoot(board, me, depth, context, previousMove);
    if (context.stopped) break;
    best = result.move;
    previousMove = moveKey(best);
  }

  if (
    config.randomness &&
    !best.captured &&
    Math.random() < config.randomness
  ) {
    const alternatives = orderMoves(board, legal, context, 0)
      .filter((move) => moveKey(move) !== moveKey(best))
      .slice(0, 2);
    if (alternatives.length) {
      return alternatives[Math.floor(Math.random() * alternatives.length)];
    }
  }
  return best;
}
