import contain from 'licia/contain'
import random from 'licia/random'

export const JIGSAW_SIZES = [3, 4, 5] as const

export type JigsawSize = (typeof JIGSAW_SIZES)[number]

export function isJigsawSize(value: unknown): value is JigsawSize {
  return contain(JIGSAW_SIZES, value)
}

export interface PieceEdges {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PieceCut {
  id: number
  row: number
  column: number
  edges: PieceEdges
}

function tab() {
  return random(0, 1) === 0 ? -1 : 1
}

export function cutBoard(size: JigsawSize): PieceCut[] {
  const right: number[][] = []
  const bottom: number[][] = []
  for (let row = 0; row < size; row++) {
    right[row] = []
    bottom[row] = []
    for (let column = 0; column < size; column++) {
      right[row][column] = column === size - 1 ? 0 : tab()
      bottom[row][column] = row === size - 1 ? 0 : tab()
    }
  }

  const pieces: PieceCut[] = []
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      pieces.push({
        id: row * size + column,
        row,
        column,
        edges: {
          top: row === 0 ? 0 : -bottom[row - 1][column],
          right: right[row][column],
          bottom: bottom[row][column],
          left: column === 0 ? 0 : -right[row][column - 1],
        },
      })
    }
  }
  return pieces
}
