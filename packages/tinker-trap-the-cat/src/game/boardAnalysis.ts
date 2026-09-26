import each from 'licia/each'
import map from 'licia/map'
import some from 'licia/some'
import { getNeighbours } from './grid'

class BoardAnalysis {
  readonly w: number
  readonly h: number
  private blocks: AnalysisBlock[][]

  constructor(blocksIsWall: boolean[][]) {
    this.w = blocksIsWall.length
    if (this.w <= 0) {
      throw new Error('empty blocks')
    }
    this.h = blocksIsWall[0].length
    this.blocks = map(blocksIsWall, (col, i) =>
      map(col, (isWall, j) => new AnalysisBlock(this, i, j, isWall)),
    )
  }

  getBlock(i: number, j: number): AnalysisBlock | null {
    if (!(i >= 0 && i < this.w && j >= 0 && j < this.h)) {
      return null
    }
    return this.blocks[i][j]
  }

  calcAllDistances() {
    const queue: AnalysisBlock[] = []
    const queued = new Set<AnalysisBlock>()
    each(this.blocks, (col) => {
      each(col, (block) => {
        if (block.isEdge && !block.isWall) {
          block.distance = 0
          queue.push(block)
          queued.add(block)
        }
      })
    })

    while (queue.length > 0) {
      const block = queue.shift()!
      queued.delete(block)
      each(block.neighbours, (neighbour) => {
        if (neighbour !== null && !neighbour.isEdge && !neighbour.isWall) {
          if (neighbour.distance > block.distance + 1) {
            neighbour.distance = block.distance + 1
            if (!queued.has(neighbour)) {
              queued.add(neighbour)
              queue.push(neighbour)
            }
          }
        }
      })
    }
  }
}

class AnalysisBlock {
  readonly i: number
  readonly j: number
  readonly isWall: boolean
  readonly isEdge: boolean
  distance = Infinity
  private parent: BoardAnalysis
  private _routesCount?: number
  private _neighbours?: (AnalysisBlock | null)[]

  constructor(parent: BoardAnalysis, i: number, j: number, isWall: boolean) {
    this.parent = parent
    this.i = i
    this.j = j
    this.isWall = isWall
    this.isEdge =
      this.i <= 0 ||
      this.i >= this.parent.w - 1 ||
      this.j <= 0 ||
      this.j >= this.parent.h - 1
  }

  get routesCount(): number {
    if (this._routesCount === undefined) {
      if (this.isEdge) {
        this._routesCount = 1
      } else {
        let routesCount = 0
        each(this.neighbours, (neighbour) => {
          if (neighbour !== null && !neighbour.isWall) {
            if (neighbour.distance < this.distance) {
              routesCount += neighbour.routesCount
            }
          }
        })
        this._routesCount = routesCount
      }
    }
    return this._routesCount
  }

  get neighbours(): (AnalysisBlock | null)[] {
    if (this._neighbours === undefined) {
      this._neighbours = map(getNeighbours(this.i, this.j), (neighbour) =>
        this.parent.getBlock(neighbour.i, neighbour.j),
      )
    }
    return this._neighbours
  }

  get directions(): number[] {
    const result: number[] = []
    each(this.neighbours, (neighbour, direction) => {
      if (neighbour !== null && !neighbour.isWall) {
        if (neighbour.distance < this.distance) {
          result.push(direction)
        }
      }
    })
    return result
  }

  get bestDirection(): number {
    let maxRoutesCount = 0
    let result = -1
    each(this.directions, (direction) => {
      const neighbour = this.neighbours[direction]
      if (neighbour && neighbour.routesCount > maxRoutesCount) {
        maxRoutesCount = neighbour.routesCount
        result = direction
      }
    })
    return result
  }
}

export function isCatTrapped(
  blocksIsWall: boolean[][],
  i: number,
  j: number,
  w: number,
  h: number,
): boolean {
  return !some(getNeighbours(i, j), ({ i: ni, j: nj }) => {
    if (ni < 0 || ni >= w || nj < 0 || nj >= h) {
      return false
    }
    return !blocksIsWall[ni][nj]
  })
}

function analyzeBoard(blocksIsWall: boolean[][]): BoardAnalysis {
  const board = new BoardAnalysis(blocksIsWall)
  board.calcAllDistances()
  return board
}

export function getCatEscapeDistance(
  blocksIsWall: boolean[][],
  i: number,
  j: number,
): number {
  return analyzeBoard(blocksIsWall).getBlock(i, j)?.distance ?? Infinity
}

export function getCatBestDirection(
  blocksIsWall: boolean[][],
  i: number,
  j: number,
): number {
  return analyzeBoard(blocksIsWall).getBlock(i, j)?.bestDirection ?? -1
}
