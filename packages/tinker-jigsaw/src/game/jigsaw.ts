import max from 'licia/max'
import random from 'licia/random'

interface BoardGrid {
  columns: number
  rows: number
}

// `level` is the cell count along the shorter side.
export function boardGrid(
  width: number,
  height: number,
  level: number,
): BoardGrid {
  const aspect = width / height
  if (aspect >= 1) {
    return { columns: max(level, Math.round(level * aspect)), rows: level }
  }
  return { columns: level, rows: max(level, Math.round(level / aspect)) }
}

// Fractions of the short cell side, so a wide cell does not grow the tab from its long edge.
export const TAB_SIZE = 0.1
export const TAB_JITTER = 0.04

export interface TabCurve {
  flip: boolean
  a: number
  b: number
  c: number
  d: number
  e: number
}

interface PieceEdges {
  top: TabCurve | null
  right: TabCurve | null
  bottom: TabCurve | null
  left: TabCurve | null
}

export interface PieceCut {
  id: number
  row: number
  column: number
  edges: PieceEdges
}

function jitter() {
  return random(-TAB_JITTER, TAB_JITTER, true)
}

// Carry the previous edge's end into the next start so a cut line does not kink.
function seam(count: number): TabCurve[] {
  const curves: TabCurve[] = []
  let prevE = jitter()
  let prevFlip: boolean | undefined
  for (let index = 0; index < count; index++) {
    const flip = random(0, 1) === 0
    const e = jitter()
    curves.push({
      flip,
      a: flip === prevFlip ? -prevE : prevE,
      b: jitter(),
      c: jitter(),
      d: jitter(),
      e,
    })
    prevFlip = flip
    prevE = e
  }
  return curves
}

export function cutBoard(columns: number, rows: number): PieceCut[] {
  const vertical: (TabCurve | null)[][] = []
  const horizontal: (TabCurve | null)[][] = []
  for (let row = 0; row < rows; row++) {
    vertical[row] = []
    horizontal[row] = []
    for (let column = 0; column < columns; column++) {
      vertical[row][column] = null
      horizontal[row][column] = null
    }
  }

  for (let row = 0; row < rows - 1; row++) {
    const curves = seam(columns)
    for (let column = 0; column < columns; column++) {
      horizontal[row][column] = curves[column]
    }
  }
  for (let column = 0; column < columns - 1; column++) {
    const curves = seam(rows)
    for (let row = 0; row < rows; row++) {
      vertical[row][column] = curves[row]
    }
  }

  const pieces: PieceCut[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      pieces.push({
        id: row * columns + column,
        row,
        column,
        edges: {
          // One object per seam. The neighbor traces the same curve backwards.
          top: row === 0 ? null : horizontal[row - 1][column],
          right: vertical[row][column],
          bottom: horizontal[row][column],
          left: column === 0 ? null : vertical[row][column - 1],
        },
      })
    }
  }
  return pieces
}
