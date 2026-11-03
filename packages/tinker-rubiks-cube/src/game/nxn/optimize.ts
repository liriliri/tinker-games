import type { FaceMove, RawMove, Rel2Abs } from './types'

export function applyRotationToRel2Abs(
  rel2abs: Rel2Abs,
  move: FaceMove,
  dist: number,
): Rel2Abs {
  const d = ((dist % 4) + 4) % 4
  let next = { ...rel2abs }
  for (let i = 0; i < d; i++) {
    const cur = { ...next }
    if (move === 'R') {
      next.U = cur.F
      next.B = cur.U
      next.D = cur.B
      next.F = cur.D
    } else if (move === 'L') {
      next.U = cur.B
      next.B = cur.D
      next.D = cur.F
      next.F = cur.U
    } else if (move === 'U') {
      next.F = cur.R
      next.L = cur.F
      next.B = cur.L
      next.R = cur.B
    } else if (move === 'D') {
      next.F = cur.L
      next.L = cur.B
      next.B = cur.R
      next.R = cur.F
    } else if (move === 'F') {
      next.U = cur.L
      next.R = cur.U
      next.D = cur.R
      next.L = cur.D
    } else if (move === 'B') {
      next.U = cur.R
      next.R = cur.D
      next.D = cur.L
      next.L = cur.U
    }
  }
  return next
}

/** Merge cancelling / parallel-axis turns (U∥D, L∥R, F∥B). */
export function astOptimizeMoves(
  movesList: Pick<RawMove, 'move' | 'dist' | 'layer' | 'width' | 'n'>[],
): Pick<RawMove, 'move' | 'dist' | 'layer' | 'width' | 'n'>[] {
  if (!movesList || movesList.length === 0) return []
  const stack: Pick<RawMove, 'move' | 'dist' | 'layer' | 'width' | 'n'>[] = []
  const axisMap: Record<FaceMove, string> = {
    U: 'y',
    D: 'y',
    L: 'x',
    R: 'x',
    F: 'z',
    B: 'z',
  }

  for (const curr of movesList) {
    if (curr.dist === 0) continue
    let merged = false

    for (let i = stack.length - 1; i >= 0; i--) {
      const top = stack[i]
      if (
        top.move === curr.move &&
        top.layer === curr.layer &&
        top.width === curr.width
      ) {
        const newDist = (top.dist + curr.dist) % 4
        if (newDist === 0) stack.splice(i, 1)
        else top.dist = newDist
        merged = true
        break
      }
      if (axisMap[top.move] === axisMap[curr.move]) continue
      break
    }

    if (!merged) stack.push({ ...curr })
  }
  return stack
}
