import trim from "licia/trim";
import map from "licia/map";
import filter from "licia/filter";
import compact from "licia/compact";
import sortBy from "licia/sortBy";
import clamp from "licia/clamp";
import toInt from "licia/toInt";
import gambitText from "./gambit.txt?raw";
import Board, { Cache } from "./board";
import { BLOCK_FOUR, FIVE, THREE } from "./eval";
import type { AiRole } from "./eval";

type GambitMove = { move: [number, number]; weight: number };

const gambitKey = (row: number, column: number) => `${row},${column}`;

const parseGambitLine = (line: string): [number, number][] =>
  compact(
    map(line.split(/\s+/), (token) => {
      const match = token.match(/^(\d+),(\d+)$/);
      return match
        ? ([toInt(match[1]), toInt(match[2])] as [number, number])
        : undefined;
    }),
  );

const GAMBIT_BOOK = filter(
  map(gambitText.split(/\r?\n/), (line) =>
    parseGambitLine(trim(line.replace(/#.*/, ""))),
  ),
  (line) => line.length > 0,
);

const GAMBIT_INDEX = new Map<string, Map<string, number>>();

for (const line of GAMBIT_BOOK) {
  for (let length = 0; length < line.length; length++) {
    const prefix = map(line.slice(0, length), ([row, column]) =>
      gambitKey(row, column),
    ).join(" ");
    const next = line[length];
    if (!next) continue;
    const key = gambitKey(next[0], next[1]);
    const bucket = GAMBIT_INDEX.get(prefix) ?? new Map<string, number>();
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
    GAMBIT_INDEX.set(prefix, bucket);
  }
}

function getGambitMoves(board: Board): GambitMove[] {
  const prefix = map(board.history, ({ i, j }) => gambitKey(i, j)).join(" ");
  const candidates = GAMBIT_INDEX.get(prefix);
  if (!candidates) return [];

  return sortBy(
    filter(
      map([...candidates.entries()], ([key, weight]) => {
        const [row, column] = map(key.split(","), toInt) as [number, number];
        return { move: [row, column] as [number, number], weight };
      }),
      ({ move: [row, column] }) => board.board[row]![column] === 0,
    ),
    ({ weight, move: [row, column] }) => -weight * 10_000 + row * 15 + column,
  );
}

function gambitMove(board: Board): [number, number] | null {
  return getGambitMoves(board)[0]?.move ?? null;
}

const MAX = 1_000_000_000;
const onlyThreeThreshold = 6;
const QUIESCENCE_DEPTH = 2;
const QUIESCENCE_THREE_LIMIT = 2;
const QUIESCENCE_THREE_TIED_LIMIT = 3;
const SEARCH_TIMEOUT = Symbol("search-timeout");

export const TT_FLAG = {
  EXACT: "exact",
  LOWER: "lower",
  UPPER: "upper",
} as const;

type TtFlag = (typeof TT_FLAG)[keyof typeof TT_FLAG];

type SearchResult = {
  score: number;
  move: [number, number] | null;
  pv: [number, number][];
  flag: TtFlag;
};

type SearchContext = {
  deadline: number;
  experimentalPvs: boolean;
  disableTtCutoffs: boolean;
  exactTtOnly: boolean;
  disableTt: boolean;
  disableQuiescence: boolean;
  experimentalMoveOrdering: boolean;
  useKillers: boolean;
  useHistory: boolean;
  killers: number[][] | null;
  history: Uint16Array | null;
  openingBookRanks: Uint16Array | null;
};

type SearchOptions = {
  timeLimitMs?: number;
  deadline?: number;
  disableOpeningBook?: boolean;
  experimentalPvs?: boolean;
  disablePvs?: boolean;
  disableMoveOrdering?: boolean;
  experimentalMoveOrdering?: boolean;
  experimentalMoveOrderingMode?: "killer" | "history" | "combined" | null;
  disableTt?: boolean;
  disableTtCutoffs?: boolean;
  exactTtOnly?: boolean;
  disableQuiescence?: boolean;
};

let boardTables = new WeakMap<
  Board,
  Cache<{
    depth: number;
    score: number;
    move: [number, number] | null;
    pv: [number, number][];
    role: AiRole;
    mode: string;
    flag: TtFlag;
  }>
>();

const getTable = (board: Board) => {
  let table = boardTables.get(board);
  if (!table) {
    table = new Cache();
    boardTables.set(board, table);
  }
  return table;
};

export const clearSearchCache = (board?: Board) => {
  if (board) boardTables.delete(board);
  else boardTables = new WeakMap();
};

const modeKey = (onlyThree: boolean, onlyFour: boolean) =>
  `${onlyThree ? 1 : 0}:${onlyFour ? 1 : 0}`;

const classifyFlag = (score: number, alpha: number, beta: number): TtFlag => {
  if (score <= alpha) return TT_FLAG.UPPER;
  if (score >= beta) return TT_FLAG.LOWER;
  return TT_FLAG.EXACT;
};

const normalizeScore = (score: number) =>
  Math.abs(score) >= FIVE ? Math.sign(score) * FIVE : score;

const pointScore = (board: Board, role: AiRole, [x, y]: [number, number]) => {
  const selfScores =
    role === 1 ? board.evaluator.blackScores : board.evaluator.whiteScores;
  const opponentScores =
    role === 1 ? board.evaluator.whiteScores : board.evaluator.blackScores;
  return selfScores[x]![y]! * 2 + opponentScores[x]![y]!;
};

const sameMove = (
  left: [number, number] | null | undefined,
  right: [number, number] | null | undefined,
) => left && right && left[0] === right[0] && left[1] === right[1];

const moveIndex = (size: number, [x, y]: [number, number]) => x * size + y;

const compareBookMoves = (
  context: SearchContext,
  board: Board,
  ply: number,
  left: [number, number],
  right: [number, number],
) => {
  if (ply !== 0 || !context.openingBookRanks) return 0;
  return (
    context.openingBookRanks[moveIndex(board.size, right)]! -
    context.openingBookRanks[moveIndex(board.size, left)]!
  );
};

const orderingBonus = (
  context: SearchContext,
  ply: number,
  point: [number, number],
  size: number,
) => {
  const index = moveIndex(size, point);
  if (context.useKillers) {
    const killers = context.killers?.[ply];
    if (index === killers?.[0]) return 768;
    if (index === killers?.[1]) return 512;
  }
  return context.useHistory ? context.history![index]! : 0;
};

const recordCutoffMove = (
  context: SearchContext,
  ply: number,
  remainingDepth: number,
  point: [number, number],
  size: number,
) => {
  if (!context.experimentalMoveOrdering) return;
  const index = moveIndex(size, point);
  if (context.useKillers) {
    const killers = context.killers?.[ply] ?? [];
    if (index !== killers[0]) {
      context.killers![ply] = [index, killers[0] ?? index];
    }
  }
  if (context.useHistory) {
    context.history![index] = clamp(
      context.history![index]! + remainingDepth ** 2,
      0,
      255,
    );
  }
};

const hasThreatAtLeast = (board: Board, threshold: number) =>
  board.evaluator.hasThreatAtLeast(threshold);

const quiescence = (
  board: Board,
  role: AiRole,
  ply: number,
  remainingDepth: number,
  alpha: number,
  beta: number,
  context: SearchContext,
  allowThree: boolean,
): { score: number; flag: TtFlag } => {
  const originalAlpha = alpha;
  const originalBeta = beta;
  if (context.deadline && performance.now() >= context.deadline) {
    throw SEARCH_TIMEOUT;
  }

  const staticScore = board.evaluate(role);
  if (!remainingDepth || board.isGameOver()) {
    return { score: staticScore, flag: TT_FLAG.EXACT };
  }

  const hasFourThreat = hasThreatAtLeast(board, BLOCK_FOUR);
  if (!hasFourThreat && (!allowThree || !hasThreatAtLeast(board, THREE))) {
    return { score: staticScore, flag: TT_FLAG.EXACT };
  }

  let forcingMoves = board.getValuableMoves(
    role,
    ply,
    !hasFourThreat,
    hasFourThreat,
  );
  if (!hasFourThreat) {
    const includeTiedThird =
      forcingMoves.length > QUIESCENCE_THREE_LIMIT &&
      pointScore(board, role, forcingMoves[QUIESCENCE_THREE_LIMIT - 1]!) ===
        pointScore(board, role, forcingMoves[QUIESCENCE_THREE_LIMIT]!);
    const limit = includeTiedThird
      ? QUIESCENCE_THREE_TIED_LIMIT
      : QUIESCENCE_THREE_LIMIT;
    forcingMoves = forcingMoves.slice(0, limit);
  }
  if (!forcingMoves.length) return { score: staticScore, flag: TT_FLAG.EXACT };

  let bestScore = -MAX;
  for (const point of forcingMoves) {
    if (!board.put(point[0], point[1], role)) continue;
    let childScore: number;
    try {
      childScore = quiescence(
        board,
        -role as AiRole,
        ply + 1,
        remainingDepth - 1,
        -beta,
        -alpha,
        context,
        allowThree,
      ).score;
    } finally {
      board.undo();
    }
    bestScore = Math.max(bestScore, -childScore);
    alpha = Math.max(alpha, bestScore);
    if (alpha >= beta || alpha >= FIVE) break;
  }

  const score = bestScore === -MAX ? staticScore : bestScore;
  return { score, flag: classifyFlag(score, originalAlpha, originalBeta) };
};

const factory = (onlyThree = false, onlyFour = false) => {
  const enableQuiescence = !onlyThree && !onlyFour;

  const search = (
    board: Board,
    role: AiRole,
    depth: number,
    ply: number,
    alpha: number,
    beta: number,
    context: SearchContext,
    isScout = false,
  ): SearchResult => {
    if (context.deadline && performance.now() >= context.deadline) {
      throw SEARCH_TIMEOUT;
    }

    if (ply >= depth || board.isGameOver()) {
      const leaf =
        !board.isGameOver() && enableQuiescence && !context.disableQuiescence
          ? quiescence(
              board,
              role,
              ply,
              QUIESCENCE_DEPTH,
              alpha,
              beta,
              context,
              depth <= 2,
            )
          : { score: board.evaluate(role), flag: TT_FLAG.EXACT as TtFlag };
      const { score } = leaf;
      const distanceScore =
        Math.abs(score) >= FIVE
          ? Math.sign(score) * (FIVE + depth - ply)
          : score;
      return { score: distanceScore, move: null, pv: [], flag: leaf.flag };
    }

    const table = getTable(board);
    const key = board.hash();
    const originalAlpha = alpha;
    const originalBeta = beta;
    const remainingDepth = depth - ply;
    const mode = modeKey(onlyThree, onlyFour);
    const previous = table.get(key);

    if (
      !context.disableTt &&
      !context.disableTtCutoffs &&
      previous &&
      previous.role === role &&
      previous.mode === mode &&
      previous.depth >= remainingDepth
    ) {
      if (previous.flag === TT_FLAG.EXACT) {
        return {
          score: previous.score,
          move: previous.move,
          pv: previous.pv,
          flag: previous.flag,
        };
      }
      if (!context.exactTtOnly && previous.flag === TT_FLAG.LOWER) {
        alpha = Math.max(alpha, previous.score);
      }
      if (!context.exactTtOnly && previous.flag === TT_FLAG.UPPER) {
        beta = Math.min(beta, previous.score);
      }
      if (alpha >= beta) {
        return {
          score: previous.score,
          move: previous.move,
          pv: previous.pv,
          flag: previous.flag,
        };
      }
    }

    const points = [
      ...board.getValuableMoves(
        role,
        ply,
        onlyThree || ply > onlyThreeThreshold,
        onlyFour,
      ),
    ];
    if (!points.length) {
      return {
        score: board.evaluate(role),
        move: null,
        pv: [],
        flag: TT_FLAG.EXACT,
      };
    }

    const sortPoints = (left: [number, number], right: [number, number]) => {
      if (sameMove(left, previous?.move)) return -1;
      if (sameMove(right, previous?.move)) return 1;
      const leftScore = pointScore(board, role, left);
      const rightScore = pointScore(board, role, right);
      if (leftScore !== rightScore) return rightScore - leftScore;
      const bookOrder = compareBookMoves(context, board, ply, left, right);
      if (bookOrder) return bookOrder;
      if (context.experimentalMoveOrdering) {
        return (
          orderingBonus(context, ply, right, board.size) -
          orderingBonus(context, ply, left, board.size)
        );
      }
      return 0;
    };
    points.sort(sortPoints);

    let bestScore = -MAX;
    let bestMove: [number, number] | null = null;
    let bestPv: [number, number][] = [];
    let searchedMoves = 0;

    for (const point of points) {
      if (!board.put(point[0], point[1], role)) continue;
      let child: SearchResult;
      try {
        if (context.experimentalPvs && ply === 0 && searchedMoves > 0) {
          const scout = search(
            board,
            -role as AiRole,
            depth,
            ply + 1,
            -alpha - 1,
            -alpha,
            context,
            true,
          );
          const scoutScore = -scout.score;
          child =
            scoutScore > alpha && scoutScore < beta
              ? search(
                  board,
                  -role as AiRole,
                  depth,
                  ply + 1,
                  -beta,
                  -alpha,
                  context,
                  false,
                )
              : scout;
        } else {
          child = search(
            board,
            -role as AiRole,
            depth,
            ply + 1,
            -beta,
            -alpha,
            context,
            isScout,
          );
        }
      } finally {
        board.undo();
      }

      searchedMoves++;
      const score = -child.score;
      if (score > bestScore) {
        bestScore = score;
        bestMove = point;
        bestPv = [point, ...child.pv];
      }
      alpha = Math.max(alpha, bestScore);
      if (alpha >= beta || alpha >= FIVE) {
        recordCutoffMove(context, ply, remainingDepth, point, board.size);
        break;
      }
    }

    if (!bestMove) {
      return {
        score: board.evaluate(role),
        move: null,
        pv: [],
        flag: TT_FLAG.EXACT,
      };
    }

    const flag = classifyFlag(bestScore, originalAlpha, originalBeta);
    if (!context.disableTt && !isScout) {
      table.put(key, {
        depth: remainingDepth,
        score: bestScore,
        move: bestMove,
        pv: bestPv,
        role,
        mode,
        flag,
      });
    }

    return { score: bestScore, move: bestMove, pv: bestPv, flag };
  };

  return (
    board: Board,
    role: AiRole,
    maxDepth = 4,
    options: SearchOptions = {},
  ): [number, [number, number] | null, [number, number][], number] => {
    let completed: SearchResult | null = null;
    let completedDepth = 0;
    const fixedDepthPvs = !options.timeLimitMs && !options.deadline;
    const usePvs =
      !onlyThree &&
      !onlyFour &&
      options.experimentalPvs !== false &&
      options.disablePvs !== true &&
      (fixedDepthPvs || options.experimentalPvs === true);
    const moveOrderingMode =
      options.experimentalMoveOrderingMode ??
      (options.experimentalMoveOrdering === true
        ? "combined"
        : options.disableMoveOrdering === true
          ? null
          : "killer");

    const bookMoves =
      !onlyThree && !onlyFour && options.disableOpeningBook !== true
        ? getGambitMoves(board)
        : [];
    const openingBookRanks = bookMoves.length
      ? new Uint16Array(board.size * board.size)
      : null;
    bookMoves.forEach(({ move }, index) => {
      openingBookRanks![moveIndex(board.size, move)] = bookMoves.length - index;
    });

    const context: SearchContext = {
      deadline:
        options.deadline ??
        (options.timeLimitMs ? performance.now() + options.timeLimitMs : 0),
      experimentalPvs: usePvs,
      disableTtCutoffs: options.disableTtCutoffs === true,
      exactTtOnly: options.exactTtOnly === true || usePvs,
      disableTt: options.disableTt === true,
      disableQuiescence: options.disableQuiescence === true,
      experimentalMoveOrdering: Boolean(moveOrderingMode),
      useKillers:
        moveOrderingMode === "killer" || moveOrderingMode === "combined",
      useHistory:
        moveOrderingMode === "history" || moveOrderingMode === "combined",
      killers: moveOrderingMode ? [] : null,
      history: moveOrderingMode
        ? new Uint16Array(board.size * board.size)
        : null,
      openingBookRanks,
    };

    const firstDepth = maxDepth < 2 ? maxDepth : 2;
    for (let depth = firstDepth; depth <= maxDepth; depth += 2) {
      let result: SearchResult;
      try {
        result = search(board, role, depth, 0, -MAX, MAX, context);
      } catch (error) {
        if (error === SEARCH_TIMEOUT) break;
        throw error;
      }
      if (result.move || board.isGameOver()) {
        completed = result;
        completedDepth = depth;
      }
      if (result.score >= FIVE) break;
    }

    if (!completed) {
      const fallback =
        board.getValuableMoves(role, 0, onlyThree, onlyFour)[0] ?? null;
      return [board.evaluate(role), fallback, fallback ? [fallback] : [], 0];
    }

    return [
      normalizeScore(completed.score),
      completed.move,
      completed.pv,
      completedDepth,
    ];
  };
};

const normal = factory();
export const candidateVct = factory(true);
export const candidateVcf = factory(false, true);

export const candidateMinmax = (
  board: Board,
  role: AiRole,
  depth = 4,
  enableVCT = true,
  options: SearchOptions = {},
): [number, [number, number] | null, [number, number][], number] => {
  if (options.disableOpeningBook !== true && !hasThreatAtLeast(board, THREE)) {
    const move = gambitMove(board);
    if (move) {
      return [board.evaluate(role), move, [move], 0];
    }
  }

  if (!enableVCT || !hasThreatAtLeast(board, THREE)) {
    return normal(board, role, depth, options);
  }

  const startedAt = performance.now();
  const timeLimitMs = Number(options.timeLimitMs) || 0;
  const phaseOptions = (fraction: number): SearchOptions =>
    timeLimitMs
      ? {
          ...options,
          timeLimitMs: 0,
          deadline: startedAt + timeLimitMs * fraction,
        }
      : options;

  const vctDepth = depth + 8;
  let [score, move, bestPath, completedDepth] = candidateVct(
    board,
    role,
    vctDepth,
    phaseOptions(0.35),
  );
  if (score >= FIVE) return [score, move, bestPath, completedDepth];

  const [threatScore, threatMove] = candidateVct(
    board,
    -role as AiRole,
    vctDepth,
    phaseOptions(0.6),
  );
  if (
    threatScore >= FIVE &&
    threatMove &&
    board.board[threatMove[0]]![threatMove[1]] === 0
  ) {
    board.put(threatMove[0], threatMove[1], role);
    let afterBlock: [
      number,
      [number, number] | null,
      [number, number][],
      number,
    ];
    try {
      afterBlock = candidateVct(
        board,
        -role as AiRole,
        vctDepth,
        phaseOptions(0.75),
      );
    } finally {
      board.undo();
    }
    if (afterBlock[0] < FIVE) {
      return [
        board.evaluate(role),
        threatMove,
        [threatMove, ...afterBlock[2]],
        completedDepth,
      ];
    }
  }

  [score, move, bestPath, completedDepth] = normal(
    board,
    role,
    depth,
    phaseOptions(0.9),
  );
  if (!move) return [score, move, bestPath, completedDepth];
  if (!board.put(move[0], move[1], role))
    return [score, move, bestPath, completedDepth];

  let opponentResult: [
    number,
    [number, number] | null,
    [number, number][],
    number,
  ];
  try {
    opponentResult = candidateVct(
      board,
      -role as AiRole,
      vctDepth,
      phaseOptions(1),
    );
  } finally {
    board.undo();
  }

  const [opponentScore, opponentMove, opponentPath] = opponentResult;
  if (
    score < FIVE &&
    opponentScore === FIVE &&
    opponentPath.length > bestPath.length
  ) {
    const [, , originalOpponentPath] = candidateVct(
      board,
      -role as AiRole,
      vctDepth,
      phaseOptions(1),
    );
    if (opponentPath.length <= originalOpponentPath.length && opponentMove) {
      return [score, opponentMove, opponentPath, completedDepth];
    }
  }

  return [score, move, bestPath, completedDepth];
};
