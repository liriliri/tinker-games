import { Faces } from './constants'
import { Cube } from './Cube'
import { solveCenters } from './centers'
import { solveCorners } from './corners'
import { solveEdges } from './edges'
import { applyRotationToRel2Abs, astOptimizeMoves } from './optimize'
import type { FaceMove, RawMove, Rel2Abs } from './types'

export { Faces, Cube }

interface ShortTurn {
  m: FaceMove
  d: number
  l: number
  w: number
}

function findShortSolution(cube: Cube): ShortTurn[] | null {
  if (cube.isSolved()) return []
  const possible: ShortTurn[] = []
  for (const m of ['F', 'B', 'U', 'D', 'L', 'R'] as FaceMove[]) {
    for (const d of [1, 2, 3]) {
      for (let l = 1; l <= cube.size; l++) possible.push({ m, d, l, w: 1 })
    }
  }

  const sandbox = new Cube(cube.size)
  sandbox.matrix = cube.copy()

  for (const t of possible) {
    sandbox.turn(t.m, t.d, t.l, t.w)
    if (sandbox.isSolved()) return [t]
    sandbox.turn(t.m, 4 - t.d, t.l, t.w)
  }
  return null
}

export function solve(
  cube: Cube,
  onMove?: (
    text: string,
    move: FaceMove,
    dist: number,
    layer: number,
    width: number,
  ) => void,
): string[] {
  if (cube.size !== 4 && cube.size !== 5) {
    throw new Error('NxN solver supports 4×4 and 5×5 only')
  }

  const rawMoves: RawMove[] = []
  const originalOnTurn = cube.onTurn

  const sandbox = new Cube(cube.size)
  sandbox.matrix = cube.copy()

  sandbox.onTurn = function (move, dist, layer, width) {
    rawMoves.push({
      move,
      dist: ((dist % 4) + 4) % 4,
      layer,
      width,
      n: cube.size,
    })
  }

  const shortSolution = findShortSolution(sandbox)
  if (shortSolution) {
    for (const t of shortSolution) sandbox.turn(t.m, t.d, t.l, t.w)
  } else {
    solveCenters(sandbox)
    solveEdges(sandbox)
    solveCorners(sandbox)
  }

  sandbox.onTurn = null

  let rel2abs: Rel2Abs = { U: 'U', D: 'D', F: 'F', B: 'B', L: 'L', R: 'R' }
  const absMoves: RawMove[] = []

  for (const m of rawMoves) {
    if (m.layer === m.n && m.width === m.n) {
      rel2abs = applyRotationToRel2Abs(rel2abs, m.move, m.dist)
    } else {
      absMoves.push({
        move: rel2abs[m.move],
        dist: m.dist,
        layer: m.layer,
        width: m.width,
        n: m.n,
      })
    }
  }

  const finalObjects = astOptimizeMoves(absMoves)
  cube.onTurn = originalOnTurn

  const outTextArray: string[] = []
  for (const obj of finalObjects) {
    const d = obj.dist === 3 ? -1 : obj.dist
    const text = cube.turnToText(obj.move, d, obj.layer, obj.width)
    outTextArray.push(text)
    cube.turn(obj.move, d, obj.layer, obj.width)
    onMove?.(text, obj.move, d, obj.layer, obj.width)
  }

  return outTextArray
}
