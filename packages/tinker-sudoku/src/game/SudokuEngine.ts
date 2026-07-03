export type Grid = number[][]
export type CellPos = { row: number; col: number }

function shuffle<T>(array: T[]): T[] {
  let counter = array.length
  while (counter > 0) {
    const index = Math.floor(Math.random() * counter)
    counter--
    const temp = array[counter]
    array[counter] = array[index]
    array[index] = temp
  }
  return array
}

export function createEmptyGrid(): Grid {
  return Array.from({ length: 9 }, () => new Array(9).fill(0))
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row])
}

function allowed(grid: Grid, row: number, col: number): number[] {
  const result: number[] = []
  const available = new Array(10).fill(true)
  if (grid[row][col] > 0) return result

  for (let i = 0; i < 9; i++) available[grid[row][i]] = false
  for (let i = 0; i < 9; i++) available[grid[i][col]] = false
  for (let i = 0; i < 9; i++) {
    available[
      grid[row - (row % 3) + Math.floor(i / 3)][col - (col % 3) + (i % 3)]
    ] = false
  }

  for (let i = 1; i < 10; i++) {
    if (available[i]) result.push(i)
  }
  return result
}

function bestHypothesis(grid: Grid): [number[], number, number] {
  let bestScore = 10
  let bestRow = 9
  let bestCol = 9
  let bestAll: number[] = []

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        const options = allowed(grid, row, col)
        if (options.length < bestScore) {
          bestScore = options.length
          bestRow = row
          bestCol = col
          bestAll = options
        }
      }
    }
  }

  return [bestAll, bestRow, bestCol]
}

function findCompleteGrid(grid: Grid): void {
  function solve(): boolean {
    const [options, row, col] = bestHypothesis(grid)
    if (row === 9) return true
    if (options.length === 0) return false

    for (const value of shuffle([...options])) {
      grid[row][col] = value
      if (solve()) return true
    }

    grid[row][col] = 0
    return false
  }

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      grid[row][col] = 0
    }
  }

  while (!solve()) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        grid[row][col] = 0
      }
    }
  }
}

function countSolutionClasses(grid: Grid): number {
  function solve(copy: Grid): number {
    const [options, row, col] = bestHypothesis(copy)
    if (row === 9) return 1
    if (options.length === 0) return -1

    let solutionCount = -1
    for (const value of options) {
      copy[row][col] = value
      const result = solve(copy)
      copy[row][col] = 0
      if (result >= 0) {
        if (solutionCount >= 0) return -2
        solutionCount = options.length * result
      } else if (result === -2) {
        return -2
      }
    }
    return solutionCount
  }

  return solve(cloneGrid(grid))
}

function carvePuzzle(solution: Grid, removalSteps: number): Grid {
  const puzzle = cloneGrid(solution)
  let score = -2
  const emptyCells: CellPos[] = []
  const remaining: CellPos[] = []

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      remaining.push({ row, col })
    }
  }

  for (let step = 0; step < removalSteps; step++) {
    if (remaining.length === 0) break

    let index = Math.floor(Math.random() * remaining.length)
    let row = remaining[index].row
    let col = remaining[index].col
    puzzle[row][col] = 0

    let validity = countSolutionClasses(puzzle)
    if (validity < 0) {
      puzzle[row][col] = solution[row][col]
    } else {
      score = validity
      emptyCells.push({ row, col })
      remaining[index] = remaining[remaining.length - 1]
      remaining.pop()
    }

    if (remaining.length === 0 || emptyCells.length === 0) continue

    index = Math.floor(Math.random() * remaining.length)
    row = remaining[index].row
    col = remaining[index].col
    const swapIndex = Math.floor(Math.random() * emptyCells.length)
    const swapRow = emptyCells[swapIndex].row
    const swapCol = emptyCells[swapIndex].col

    puzzle[row][col] = 0
    puzzle[swapRow][swapCol] = solution[swapRow][swapCol]
    validity = countSolutionClasses(puzzle)

    if (validity < score) {
      puzzle[row][col] = solution[row][col]
      puzzle[swapRow][swapCol] = 0
    } else {
      score = validity
      emptyCells[swapIndex] = { row, col }
      remaining[index] = { row: swapRow, col: swapCol }
    }
  }

  return puzzle
}

export function generateSudoku(removalSteps: number): {
  puzzle: Grid
  solution: Grid
} {
  const solution = createEmptyGrid()
  findCompleteGrid(solution)
  const puzzle = carvePuzzle(solution, removalSteps)
  return { puzzle, solution: cloneGrid(solution) }
}

export function isGridComplete(grid: Grid, solution: Grid): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== solution[row][col]) return false
    }
  }
  return true
}

export function buildEditableMask(puzzle: Grid): boolean[][] {
  return puzzle.map((row) => row.map((value) => value === 0))
}
