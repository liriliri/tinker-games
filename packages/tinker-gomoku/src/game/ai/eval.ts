import some from "licia/some";
import sortBy from "licia/sortBy";
import filter from "licia/filter";
import { BLACK, type Stone } from "../rules";

export type AiRole = 1 | -1;

export function stoneToRole(stone: Stone): AiRole {
  return stone === BLACK ? 1 : -1;
}

export const config = {
  enableCache: true,
  pointsLimit: 20,
  rootPointsLimit: 32,
  deepPointsLimit: 12,
  onlyInLine: false,
  inlineCount: 4,
  inLineDistance: 5,
};

function position2Coordinate(position: number, size: number) {
  return [Math.floor(position / size), position % size] as const;
}

export function coordinate2Position(x: number, y: number, size: number) {
  return x * size + y;
}

function isLine(a: number, b: number, size: number) {
  const maxDistance = config.inLineDistance;
  const [x1, y1] = position2Coordinate(a, size);
  const [x2, y2] = position2Coordinate(b, size);
  return (
    (x1 === x2 && Math.abs(y1 - y2) < maxDistance) ||
    (y1 === y2 && Math.abs(x1 - x2) < maxDistance) ||
    (Math.abs(x1 - x2) === Math.abs(y1 - y2) && Math.abs(x1 - x2) < maxDistance)
  );
}

function hasInLine(p: number, arr: number[], size: number) {
  return some(arr, (point) => isLine(p, point, size));
}

export const shapes = {
  FIVE: 5,
  BLOCK_FIVE: 50,
  FOUR: 4,
  FOUR_FOUR: 44,
  FOUR_THREE: 43,
  THREE_THREE: 33,
  BLOCK_FOUR: 40,
  THREE: 3,
  BLOCK_THREE: 30,
  TWO_TWO: 22,
  TWO: 2,
  NONE: 0,
} as const;

export type Shape = (typeof shapes)[keyof typeof shapes];

type PaddedBoard = number[][];

const countShape = (
  board: PaddedBoard,
  x: number,
  y: number,
  offsetX: number,
  offsetY: number,
  role: AiRole,
) => {
  const opponent = -role as AiRole;
  let innerEmptyCount = 0;
  let tempEmptyCount = 0;
  let selfCount = 0;
  let totalLength = 0;
  let sideEmptyCount = 0;
  let noEmptySelfCount = 0;
  let oneEmptySelfCount = 0;

  for (let i = 1; i <= 5; i++) {
    const nx = x + i * offsetX + 1;
    const ny = y + i * offsetY + 1;
    const currentRole = board[nx]![ny]!;
    if (currentRole === 2 || currentRole === opponent) break;
    if (currentRole === role) {
      selfCount++;
      sideEmptyCount = 0;
      if (tempEmptyCount) {
        innerEmptyCount += tempEmptyCount;
        tempEmptyCount = 0;
      }
      if (innerEmptyCount === 0) {
        noEmptySelfCount++;
        oneEmptySelfCount++;
      } else if (innerEmptyCount === 1) {
        oneEmptySelfCount++;
      }
    }
    totalLength++;
    if (currentRole === 0) {
      tempEmptyCount++;
      sideEmptyCount++;
    }
    if (sideEmptyCount >= 2) break;
  }
  if (!innerEmptyCount) oneEmptySelfCount = 0;
  return {
    selfCount,
    totalLength,
    noEmptySelfCount,
    oneEmptySelfCount,
    innerEmptyCount,
    sideEmptyCount,
  };
};

const getShapeFast = (
  board: PaddedBoard,
  x: number,
  y: number,
  offsetX: number,
  offsetY: number,
  role: AiRole,
): [Shape, number] => {
  if (
    board[x + offsetX + 1]![y + offsetY + 1] === 0 &&
    board[x - offsetX + 1]![y - offsetY + 1] === 0 &&
    board[x + 2 * offsetX + 1]![y + 2 * offsetY + 1] === 0 &&
    board[x - 2 * offsetX + 1]![y - 2 * offsetY + 1] === 0
  ) {
    return [shapes.NONE, 1];
  }

  let shape: Shape = shapes.NONE;
  const left = countShape(board, x, y, -offsetX, -offsetY, role);
  const right = countShape(board, x, y, offsetX, offsetY, role);

  const selfCount = left.selfCount + right.selfCount + 1;
  const totalLength = left.totalLength + right.totalLength + 1;
  const noEmptySelfCount = left.noEmptySelfCount + right.noEmptySelfCount + 1;
  const oneEmptySelfCount =
    Math.max(
      left.oneEmptySelfCount + right.noEmptySelfCount,
      left.noEmptySelfCount + right.oneEmptySelfCount,
    ) + 1;
  const rightEmpty = right.sideEmptyCount;
  const leftEmpty = left.sideEmptyCount;

  if (totalLength < 5) return [shape, selfCount];

  if (noEmptySelfCount >= 5) {
    return rightEmpty > 0 && leftEmpty > 0
      ? [shapes.FIVE, selfCount]
      : [shapes.BLOCK_FIVE, selfCount];
  }
  if (noEmptySelfCount === 4) {
    if (
      (rightEmpty >= 1 || right.oneEmptySelfCount > right.noEmptySelfCount) &&
      (leftEmpty >= 1 || left.oneEmptySelfCount > left.noEmptySelfCount)
    ) {
      return [shapes.FOUR, selfCount];
    }
    if (!(rightEmpty === 0 && leftEmpty === 0)) {
      return [shapes.BLOCK_FOUR, selfCount];
    }
  }
  if (oneEmptySelfCount === 4) return [shapes.BLOCK_FOUR, selfCount];

  if (noEmptySelfCount === 3) {
    if (
      (rightEmpty >= 2 && leftEmpty >= 1) ||
      (rightEmpty >= 1 && leftEmpty >= 2)
    ) {
      return [shapes.THREE, selfCount];
    }
    return [shapes.BLOCK_THREE, selfCount];
  }
  if (oneEmptySelfCount === 3) {
    return rightEmpty >= 1 && leftEmpty >= 1
      ? [shapes.THREE, selfCount]
      : [shapes.BLOCK_THREE, selfCount];
  }
  if ((noEmptySelfCount === 2 || oneEmptySelfCount === 2) && totalLength > 5) {
    shape = shapes.TWO;
  }

  return [shape, selfCount];
};

const isFive = (shape: Shape) =>
  shape === shapes.FIVE || shape === shapes.BLOCK_FIVE;

const isFour = (shape: Shape) =>
  shape === shapes.FOUR || shape === shapes.BLOCK_FOUR;

type ShapeCache = Record<AiRole, Record<number, Shape[][]>>;

const getAllShapesOfPoint = (
  shapeCache: ShapeCache,
  x: number,
  y: number,
  role?: AiRole,
) => {
  const roles: AiRole[] = role ? [role] : [1, -1];
  const result: Shape[] = [];
  for (const r of roles) {
    for (const d of [0, 1, 2, 3]) {
      const shape = shapeCache[r][d]![x]![y]!;
      if (shape > 0) result.push(shape);
    }
  }
  return result;
};

export const FIVE = 10_000_000;
export const BLOCK_FIVE = FIVE;
export const FOUR = 100_000;
export const FOUR_FOUR = FOUR;
export const FOUR_THREE = FOUR;
export const THREE_THREE = FOUR / 2;
export const BLOCK_FOUR = 1500;
export const THREE = 1000;
export const BLOCK_THREE = 150;
export const TWO_TWO = 200;
export const TWO = 100;
export const BLOCK_TWO = 15;
export const ONE = 10;
export const BLOCK_ONE = 1;

const allDirections = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

const createShapePoints = () => {
  const points: Record<number, Set<number>> = {};
  for (const key of Object.keys(shapes)) {
    points[shapes[key as keyof typeof shapes]] = new Set();
  }
  return points;
};

const selectTopPoints = (
  values: Iterable<number>,
  limit: number,
  getScore: (point: number) => number,
) =>
  sortBy([...values], (point) => -getScore(point) * 1e6 + point).slice(
    0,
    limit,
  );

const direction2index = (ox: number, oy: number) => {
  if (ox === 0) return 0;
  if (oy === 0) return 1;
  if (ox === oy) return 2;
  return 3;
};

export default class Evaluate {
  size: number;
  board: number[][];
  blackScores: number[][];
  whiteScores: number[][];
  shapeCache!: Record<AiRole, Record<number, Shape[][]>>;
  activePoints!: Record<AiRole, Set<number>>;
  history: [number, AiRole][] = [];

  constructor(size = 15) {
    this.size = size;
    this.board = Array.from({ length: size + 2 }, (_, i) =>
      Array.from({ length: size + 2 }, (_, j) =>
        i === 0 || j === 0 || i === size + 1 || j === size + 1 ? 2 : 0,
      ),
    );
    this.blackScores = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => 0),
    );
    this.whiteScores = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => 0),
    );
    this.initPoints();
  }

  move(x: number, y: number, role: AiRole) {
    for (const d of [0, 1, 2, 3]) {
      this.shapeCache[role][d]![x]![y] = shapes.NONE;
      this.shapeCache[-role as AiRole][d]![x]![y] = shapes.NONE;
    }
    this.activePoints[role].delete(coordinate2Position(x, y, this.size));
    this.activePoints[-role as AiRole].delete(
      coordinate2Position(x, y, this.size),
    );
    this.blackScores[x]![y] = 0;
    this.whiteScores[x]![y] = 0;

    this.board[x + 1]![y + 1] = role;
    this.updatePoint(x, y);
    this.history.push([coordinate2Position(x, y, this.size), role]);
  }

  undo(x: number, y: number) {
    this.board[x + 1]![y + 1] = 0;
    this.updatePoint(x, y);
    this.history.pop();
  }

  initPoints() {
    this.shapeCache = { 1: {}, [-1]: {} };
    for (const role of [1, -1] as AiRole[]) {
      for (const direction of [0, 1, 2, 3]) {
        this.shapeCache[role][direction] = Array.from(
          { length: this.size },
          () => Array.from({ length: this.size }, () => shapes.NONE),
        );
      }
    }
    this.activePoints = { 1: new Set(), [-1]: new Set() };
  }

  getPoints(role: AiRole, depth: number, vct: boolean, vcf: boolean) {
    const first = depth % 2 === 0 ? role : (-role as AiRole);
    const points = createShapePoints();
    const lastPoints = this.history.slice(-4).map(([position]) => position);

    for (const r of [role, -role as AiRole]) {
      for (const activePoint of this.activePoints[r]) {
        const i = Math.floor(activePoint / this.size);
        const j = activePoint % this.size;
        let fourCount = 0;
        let blockFourCount = 0;
        let threeCount = 0;

        for (const direction of [0, 1, 2, 3]) {
          const shape = this.shapeCache[r][direction]![i]![j]!;
          if (!shape) continue;

          if (vcf) {
            if (r === first && !isFour(shape) && !isFive(shape)) continue;
            if (r === -first && isFive(shape)) continue;
          }

          if (vct) {
            if (depth % 2 === 0) {
              if (depth === 0 && r !== first) continue;
              if (shape !== shapes.THREE && !isFour(shape) && !isFive(shape))
                continue;
              if (shape === shapes.THREE && r !== first) continue;
              if (depth > 0) {
                if (
                  shape === shapes.THREE &&
                  getAllShapesOfPoint(this.shapeCache, i, j, r).length === 1
                )
                  continue;
                if (
                  shape === shapes.BLOCK_FOUR &&
                  getAllShapesOfPoint(this.shapeCache, i, j, r).length === 1
                )
                  continue;
              }
            } else {
              if (shape !== shapes.THREE && !isFour(shape) && !isFive(shape))
                continue;
              if (shape === shapes.THREE && r === -first) continue;
              if (depth > 1) {
                if (
                  shape === shapes.BLOCK_FOUR &&
                  getAllShapesOfPoint(this.shapeCache, i, j).length === 1
                )
                  continue;
                if (
                  shape === shapes.BLOCK_FOUR &&
                  !hasInLine(activePoint, lastPoints, this.size)
                )
                  continue;
              }
            }
          }

          if (vcf && !isFour(shape) && !isFive(shape)) continue;

          if (
            depth > 2 &&
            (shape === shapes.TWO ||
              shape === shapes.TWO_TWO ||
              shape === shapes.BLOCK_THREE) &&
            !hasInLine(activePoint, lastPoints, this.size)
          )
            continue;

          points[shape]!.add(activePoint);
          if (shape === shapes.FOUR) fourCount++;
          else if (shape === shapes.BLOCK_FOUR) blockFourCount++;
          else if (shape === shapes.THREE) threeCount++;

          let unionShape: Shape | undefined;
          if (fourCount >= 2) unionShape = shapes.FOUR_FOUR;
          else if (blockFourCount && threeCount) unionShape = shapes.FOUR_THREE;
          else if (threeCount >= 2) unionShape = shapes.THREE_THREE;
          if (unionShape) points[unionShape]!.add(activePoint);
        }
      }
    }

    return points;
  }

  updatePoint(x: number, y: number) {
    this.updateSinglePoint(x, y, 1);
    this.updateSinglePoint(x, y, -1);

    for (const [ox, oy] of allDirections) {
      for (const sign of [1, -1]) {
        for (let step = 1; step <= 5; step++) {
          let reachEdge = false;
          for (const role of [1, -1] as AiRole[]) {
            const nx = x + sign * step * ox + 1;
            const ny = y + sign * step * oy + 1;
            if (this.board[nx]![ny] === 2) {
              reachEdge = true;
              break;
            }
            if (this.board[nx]![ny] === -role) continue;
            if (this.board[nx]![ny] === 0) {
              this.updateSinglePoint(nx - 1, ny - 1, role, [
                sign * ox,
                sign * oy,
              ]);
            }
          }
          if (reachEdge) break;
        }
      }
    }
  }

  updateSinglePoint(
    x: number,
    y: number,
    role: AiRole,
    direction?: readonly [number, number],
  ) {
    if (this.board[x + 1]![y + 1] !== 0) return;

    this.board[x + 1]![y + 1] = role;
    const directions = direction ? [direction] : allDirections;
    const shapeCache = this.shapeCache[role];

    for (const [ox, oy] of directions) {
      shapeCache[direction2index(ox, oy)]![x]![y] = shapes.NONE;
    }

    for (const [ox, oy] of directions) {
      const intDirection = direction2index(ox, oy);
      const [shape] = getShapeFast(this.board, x, y, ox, oy, role);
      shapeCache[intDirection]![x]![y] = shape || shapes.NONE;
    }

    let score = 0;
    let blockfourCount = 0;
    let threeCount = 0;
    let twoCount = 0;
    for (const intDirection of [0, 1, 2, 3]) {
      let shape = shapeCache[intDirection]![x]![y]!;
      if (!shape) continue;
      if (shape === shapes.BLOCK_FOUR) blockfourCount++;
      else if (shape === shapes.THREE) threeCount++;
      else if (shape === shapes.TWO) twoCount++;
      if (blockfourCount >= 2) shape = shapes.FOUR_FOUR;
      else if (blockfourCount && threeCount) shape = shapes.FOUR_THREE;
      else if (threeCount >= 2) shape = shapes.THREE_THREE;
      else if (twoCount >= 2) shape = shapes.TWO_TWO;
      score += getRealShapeScore(shape);
    }

    this.board[x + 1]![y + 1] = 0;

    const position = coordinate2Position(x, y, this.size);
    const hasShape = [0, 1, 2, 3].some(
      (intDirection) => shapeCache[intDirection]![x]![y] !== shapes.NONE,
    );
    if (hasShape) this.activePoints[role].add(position);
    else this.activePoints[role].delete(position);

    if (role === 1) this.blackScores[x]![y] = score;
    else this.whiteScores[x]![y] = score;

    return score;
  }

  evaluate(role: AiRole) {
    let blackScore = 0;
    let whiteScore = 0;
    for (let i = 0; i < this.blackScores.length; i++) {
      for (let j = 0; j < this.blackScores[i]!.length; j++) {
        blackScore += this.blackScores[i]![j]!;
        whiteScore += this.whiteScores[i]![j]!;
      }
    }
    return role === 1 ? blackScore - whiteScore : whiteScore - blackScore;
  }

  hasThreatAtLeast(threshold: number) {
    for (const role of [1, -1] as AiRole[]) {
      const scores = role === 1 ? this.blackScores : this.whiteScores;
      for (const point of this.activePoints[role]) {
        const x = Math.floor(point / this.size);
        const y = point % this.size;
        if (scores[x]![y]! >= threshold) return true;
      }
    }
    return false;
  }

  getMoves(role: AiRole, depth: number, onThree = false, onlyFour = false) {
    return Array.from(
      this.getMovePositions(role, depth, onThree, onlyFour),
    ).map(
      (move) =>
        [Math.floor(move / this.size), move % this.size] as [number, number],
    );
  }

  private getMovePositions(
    role: AiRole,
    depth: number,
    onlyThree = false,
    onlyFour = false,
  ) {
    const points = this.getPoints(role, depth, onlyThree, onlyFour);
    const selfScores = role === 1 ? this.blackScores : this.whiteScores;
    const opponentScores = role === 1 ? this.whiteScores : this.blackScores;
    const pointScore = (point: number) => {
      const x = Math.floor(point / this.size);
      const y = point % this.size;
      return selfScores[x]![y]! * 2 + opponentScores[x]![y]!;
    };
    const sortPoints = (values: Iterable<number>) =>
      [...values].sort(
        (left, right) => pointScore(right) - pointScore(left) || left - right,
      );
    const orderedSet = (...groups: number[][]) =>
      new Set(groups.flatMap(sortPoints));

    const shapesAt = (point: number, targetRole: AiRole) => {
      const x = Math.floor(point / this.size);
      const y = point % this.size;
      return [0, 1, 2, 3].map(
        (direction) => this.shapeCache[targetRole][direction]![x]![y]!,
      );
    };

    const hasShape = (
      point: number,
      targetRole: AiRole,
      targetShape: Shape,
    ) => {
      const pointShapes = shapesAt(point, targetRole);
      if (targetShape === shapes.FIVE) return pointShapes.some(isFive);
      if (targetShape === shapes.FOUR_FOUR) {
        return pointShapes.filter((shape) => shape === shapes.FOUR).length >= 2;
      }
      if (targetShape === shapes.FOUR_THREE) {
        return (
          pointShapes.includes(shapes.BLOCK_FOUR) &&
          pointShapes.includes(shapes.THREE)
        );
      }
      if (targetShape === shapes.THREE_THREE) {
        return (
          pointShapes.filter((shape) => shape === shapes.THREE).length >= 2
        );
      }
      return pointShapes.includes(targetShape);
    };

    const forRole = (
      values: Set<number>,
      targetRole: AiRole,
      targetShape: Shape,
    ) =>
      filter([...values], (point) => hasShape(point, targetRole, targetShape));

    const bySide = (values: Set<number>, targetShape: Shape) => [
      forRole(values, role, targetShape),
      forRole(values, -role as AiRole, targetShape),
    ];

    const fives = new Set([
      ...points[shapes.FIVE]!,
      ...points[shapes.BLOCK_FIVE]!,
    ]);
    if (fives.size) {
      const [selfFives, opponentFives] = bySide(fives, shapes.FIVE);
      return orderedSet(selfFives, opponentFives);
    }

    const fours = points[shapes.FOUR]!;
    const blockFours = points[shapes.BLOCK_FOUR]!;
    if (onlyFour || fours.size) {
      const [selfFours, opponentFours] = bySide(fours, shapes.FOUR);
      const [selfBlockFours, opponentBlockFours] = bySide(
        blockFours,
        shapes.BLOCK_FOUR,
      );
      return orderedSet(
        selfFours,
        opponentFours,
        selfBlockFours,
        opponentBlockFours,
      );
    }

    const fourFours = points[shapes.FOUR_FOUR]!;
    if (fourFours.size) {
      const [selfFourFours, opponentFourFours] = bySide(
        fourFours,
        shapes.FOUR_FOUR,
      );
      const [selfBlockFours, opponentBlockFours] = bySide(
        blockFours,
        shapes.BLOCK_FOUR,
      );
      return orderedSet(
        selfFourFours,
        opponentFourFours,
        selfBlockFours,
        opponentBlockFours,
      );
    }

    const threes = points[shapes.THREE]!;
    const fourThrees = points[shapes.FOUR_THREE]!;
    if (fourThrees.size) {
      const [selfFourThrees, opponentFourThrees] = bySide(
        fourThrees,
        shapes.FOUR_THREE,
      );
      const [selfBlockFours, opponentBlockFours] = bySide(
        blockFours,
        shapes.BLOCK_FOUR,
      );
      const [selfThrees, opponentThrees] = bySide(threes, shapes.THREE);
      return orderedSet(
        selfFourThrees,
        opponentFourThrees,
        selfBlockFours,
        opponentBlockFours,
        selfThrees,
        opponentThrees,
      );
    }

    const threeThrees = points[shapes.THREE_THREE]!;
    if (threeThrees.size) {
      const [selfThreeThrees, opponentThreeThrees] = bySide(
        threeThrees,
        shapes.THREE_THREE,
      );
      const [selfBlockFours, opponentBlockFours] = bySide(
        blockFours,
        shapes.BLOCK_FOUR,
      );
      const [selfThrees, opponentThrees] = bySide(threes, shapes.THREE);
      return orderedSet(
        selfThreeThrees,
        opponentThreeThrees,
        selfBlockFours,
        opponentBlockFours,
        selfThrees,
        opponentThrees,
      );
    }

    if (onlyThree) {
      const [selfBlockFours, opponentBlockFours] = bySide(
        blockFours,
        shapes.BLOCK_FOUR,
      );
      const [selfThrees, opponentThrees] = bySide(threes, shapes.THREE);
      return orderedSet(
        selfBlockFours,
        opponentBlockFours,
        selfThrees,
        opponentThrees,
      );
    }

    const candidates = new Set([
      ...points[shapes.BLOCK_FOUR]!,
      ...points[shapes.THREE]!,
      ...points[shapes.BLOCK_THREE]!,
      ...points[shapes.TWO_TWO]!,
      ...points[shapes.TWO]!,
    ]);
    const limit =
      depth === 0
        ? config.rootPointsLimit
        : depth >= 3
          ? config.deepPointsLimit
          : config.pointsLimit;
    return new Set(selectTopPoints(candidates, limit, pointScore));
  }
}

export const getRealShapeScore = (shape: Shape) => {
  switch (shape) {
    case shapes.FIVE:
      return FOUR;
    case shapes.BLOCK_FIVE:
      return BLOCK_FOUR;
    case shapes.FOUR:
    case shapes.FOUR_FOUR:
    case shapes.FOUR_THREE:
      return THREE;
    case shapes.BLOCK_FOUR:
      return BLOCK_THREE;
    case shapes.THREE:
      return TWO;
    case shapes.THREE_THREE:
      return THREE_THREE / 10;
    case shapes.BLOCK_THREE:
      return BLOCK_TWO;
    case shapes.TWO:
      return ONE;
    case shapes.TWO_TWO:
      return TWO_TWO / 10;
    default:
      return 0;
  }
};
