export type MazeGrid = boolean[][] & { dimension: number }

export type LevelLayout = {
  startX: number
  startY: number
  escapeX: number
  escapeY: number
}

function randomOddCell(dimension: number): [number, number] {
  const coords: number[] = []
  for (let i = 1; i < dimension - 1; i += 2) {
    coords.push(i)
  }
  const x = coords[Math.floor(Math.random() * coords.length)]
  const y = coords[Math.floor(Math.random() * coords.length)]
  return [x, y]
}

export function generateSquareMaze(dimension: number): MazeGrid {
  function iterate(field: MazeGrid, x: number, y: number): MazeGrid {
    field[x][y] = false
    while (true) {
      const directions: [number, number][] = []
      if (x > 1 && field[x - 2][y]) {
        directions.push([-1, 0])
      }
      if (x < field.dimension - 2 && field[x + 2][y]) {
        directions.push([1, 0])
      }
      if (y > 1 && field[x][y - 2]) {
        directions.push([0, -1])
      }
      if (y < field.dimension - 2 && field[x][y + 2]) {
        directions.push([0, 1])
      }
      if (directions.length === 0) {
        return field
      }
      const dir = directions[Math.floor(Math.random() * directions.length)]
      field[x + dir[0]][y + dir[1]] = false
      field = iterate(field, x + dir[0] * 2, y + dir[1] * 2)
    }
  }

  const field = Array.from({ length: dimension }, () =>
    Array.from({ length: dimension }, () => true),
  ) as MazeGrid
  field.dimension = dimension

  const [seedX, seedY] = randomOddCell(dimension)
  return iterate(field, seedX, seedY)
}

export const BRAID_CHANCE = 0.1

function isSeparatorWall(field: MazeGrid, i: number, j: number) {
  const left = field[i - 1][j] === false
  const right = field[i + 1][j] === false
  const up = field[i][j - 1] === false
  const down = field[i][j + 1] === false

  return (left && right) || (up && down)
}

export function braidMaze(field: MazeGrid, braidChance: number) {
  for (let i = 1; i < field.dimension - 1; i++) {
    for (let j = 1; j < field.dimension - 1; j++) {
      if (!field[i][j]) {
        continue
      }

      if (isSeparatorWall(field, i, j) && Math.random() < braidChance) {
        field[i][j] = false
      }
    }
  }
}

function getPassages(field: MazeGrid) {
  const passages: [number, number][] = []
  for (let i = 0; i < field.dimension; i++) {
    for (let j = 0; j < field.dimension; j++) {
      if (!field[i][j]) {
        passages.push([i, j])
      }
    }
  }
  return passages
}

function manhattan(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

function isBorderPassage(x: number, y: number, dimension: number) {
  return x === 1 || x === dimension - 2 || y === 1 || y === dimension - 2
}

function getOutwardDirection(
  x: number,
  y: number,
  dimension: number,
): [number, number] {
  const distEast = dimension - 1 - x
  const distWest = x
  const distNorth = dimension - 1 - y
  const distSouth = y
  const min = Math.min(distEast, distWest, distNorth, distSouth)

  if (min === distEast) {
    return [1, 0]
  }
  if (min === distWest) {
    return [-1, 0]
  }
  if (min === distNorth) {
    return [0, 1]
  }
  return [0, -1]
}

function carveExit(field: MazeGrid, exitX: number, exitY: number) {
  const dimension = field.dimension
  const [dx, dy] = getOutwardDirection(exitX, exitY, dimension)

  field[exitX][exitY] = false

  if (dx > 0) {
    field[dimension - 1][exitY] = false
    return { escapeX: dimension, escapeY: exitY }
  }
  if (dx < 0) {
    field[0][exitY] = false
    return { escapeX: 0, escapeY: exitY }
  }
  if (dy > 0) {
    field[exitX][dimension - 1] = false
    return { escapeX: exitX, escapeY: dimension }
  }
  field[exitX][0] = false
  return { escapeX: exitX, escapeY: 0 }
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

export function pickLevelLayout(field: MazeGrid): LevelLayout {
  const passages = getPassages(field)
  const minDistance = Math.max(4, Math.floor(field.dimension / 3))
  const start = pickRandom(passages)

  let exitCandidates = passages.filter(
    ([x, y]) =>
      isBorderPassage(x, y, field.dimension) &&
      (x !== start[0] || y !== start[1]) &&
      manhattan([x, y], start) >= minDistance,
  )

  if (exitCandidates.length === 0) {
    exitCandidates = passages.filter(
      ([x, y]) =>
        isBorderPassage(x, y, field.dimension) &&
        (x !== start[0] || y !== start[1]),
    )
  }

  if (exitCandidates.length === 0) {
    exitCandidates = passages.filter(
      ([x, y]) => x !== start[0] || y !== start[1],
    )
  }

  exitCandidates.sort((a, b) => manhattan(b, start) - manhattan(a, start))
  const farCount = Math.max(1, Math.ceil(exitCandidates.length * 0.25))
  const [exitX, exitY] = pickRandom(exitCandidates.slice(0, farCount))
  const { escapeX, escapeY } = carveExit(field, exitX, exitY)

  return {
    startX: start[0],
    startY: start[1],
    escapeX,
    escapeY,
  }
}
