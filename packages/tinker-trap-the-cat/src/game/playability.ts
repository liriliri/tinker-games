import {
  getCatBestDirection,
  getCatEscapeDistance,
  isCatTrapped,
} from './boardAnalysis'
import { GRID_H, GRID_W } from './constants'
import { getNeighbours } from './grid'
import cloneDeep from 'licia/cloneDeep'

export const MIN_CAT_ESCAPE_DISTANCE = 4
export const MAX_RANDOM_WALL_ATTEMPTS = 64
export const GREEDY_SIMULATION_ROUNDS = 12

export function isFairRandomStart(
  blocksIsWall: boolean[][],
  catI: number,
  catJ: number,
): boolean {
  if (isCatTrapped(blocksIsWall, catI, catJ, GRID_W, GRID_H)) {
    return false
  }

  const escapeDistance = getCatEscapeDistance(blocksIsWall, catI, catJ)
  if (escapeDistance < MIN_CAT_ESCAPE_DISTANCE) {
    return false
  }

  return isLikelyWinnable(blocksIsWall, catI, catJ)
}

function isLikelyWinnable(
  blocksIsWall: boolean[][],
  catI: number,
  catJ: number,
): boolean {
  const blocks = cloneDeep(blocksIsWall)
  let i = catI
  let j = catJ

  for (let round = 0; round < GREEDY_SIMULATION_ROUNDS; round++) {
    if (isCatTrapped(blocks, i, j, GRID_W, GRID_H)) {
      return true
    }

    const playerMove = findBestPlayerMove(blocks, i, j)
    if (!playerMove) {
      return false
    }

    blocks[playerMove.i][playerMove.j] = true
    if (isCatTrapped(blocks, i, j, GRID_W, GRID_H)) {
      return true
    }

    const direction = getCatBestDirection(blocks, i, j)
    if (direction < 0) {
      return true
    }

    const next = getNeighbours(i, j)[direction]
    if (
      next.i < 0 ||
      next.i >= GRID_W ||
      next.j < 0 ||
      next.j >= GRID_H ||
      blocks[next.i][next.j]
    ) {
      return true
    }

    i = next.i
    j = next.j

    if (isCatOnEdge(i, j)) {
      return false
    }
  }

  return getCatEscapeDistance(blocks, i, j) >= MIN_CAT_ESCAPE_DISTANCE
}

function findBestPlayerMove(
  blocks: boolean[][],
  catI: number,
  catJ: number,
): { i: number; j: number } | null {
  let best: { i: number; j: number } | null = null
  let bestDistance = Infinity

  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      if (blocks[i][j] || (i === catI && j === catJ)) {
        continue
      }

      blocks[i][j] = true
      const distance = getCatEscapeDistance(blocks, catI, catJ)
      blocks[i][j] = false

      if (distance < bestDistance) {
        bestDistance = distance
        best = { i, j }
      }
    }
  }

  return best
}

function isCatOnEdge(i: number, j: number) {
  return i <= 0 || i >= GRID_W - 1 || j <= 0 || j >= GRID_H - 1
}
