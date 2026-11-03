import contain from 'licia/contain'
import isStr from 'licia/isStr'
import CubeJS from 'cubejs'
import { Faces, SideFaces } from './constants'
import { Cube } from './Cube'
import { solve3Base } from './cfop'
import type { FaceMove } from './types'

let kociembaReady = false

function ensureKociemba(): void {
  if (!kociembaReady) {
    CubeJS.initSolver()
    kociembaReady = true
  }
}

export function solveCorners(cube: Cube): void {
  const refCube = new Cube(3)
  const end = cube.size - 1

  function syncRefCube(): void {
    const mid = Math.floor(cube.size / 2)
    for (let i = 0; i < Faces.length; i++) {
      refCube.matrix[i][1][1] = cube.getCenterColor(i)
      refCube.matrix[i][0][0] = cube.matrix[i][0][0]
      refCube.matrix[i][0][2] = cube.matrix[i][0][end]
      refCube.matrix[i][2][2] = cube.matrix[i][end][end]
      refCube.matrix[i][2][0] = cube.matrix[i][end][0]
      refCube.matrix[i][0][1] = cube.matrix[i][0][mid]
      refCube.matrix[i][1][2] = cube.matrix[i][mid][end]
      refCube.matrix[i][2][1] = cube.matrix[i][end][mid]
      refCube.matrix[i][1][0] = cube.matrix[i][mid][0]
    }
  }

  syncRefCube()

  refCube.onTurn = function (move, dist, layer, width) {
    let w = width
    if (layer === 2) {
      layer = cube.size - 1
      if (w === 1) width = cube.size - 2
    } else if (layer === 3) layer = cube.size
    if (w === 3) width = cube.size
    else if (w === 2) width = cube.size - 1
    cube.turn(move, dist, layer, width)
  }

  function faceletsFromRef(): string | null {
    const faceOrder = [
      Faces.Top,
      Faces.Right,
      Faces.Front,
      Faces.Bottom,
      Faces.Left,
      Faces.Back,
    ]
    const colorToChar: Record<number, string> = {
      [refCube.matrix[Faces.Top][1][1]]: 'U',
      [refCube.matrix[Faces.Right][1][1]]: 'R',
      [refCube.matrix[Faces.Front][1][1]]: 'F',
      [refCube.matrix[Faces.Bottom][1][1]]: 'D',
      [refCube.matrix[Faces.Left][1][1]]: 'L',
      [refCube.matrix[Faces.Back][1][1]]: 'B',
    }
    let stateStr = ''
    for (const face of faceOrder) {
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          const ch = colorToChar[refCube.matrix[face][y][x]]
          if (!ch) return null
          stateStr += ch
        }
      }
    }
    return stateStr
  }

  function mapRefTurnToNxN(
    move: FaceMove,
    dist: number,
    layer: number,
    width: number,
  ): { move: FaceMove; dist: number; layer: number; width: number } {
    let w = width
    let l = layer
    if (l === 2) {
      l = cube.size - 1
      if (w === 1) w = cube.size - 2
    } else if (l === 3) {
      l = cube.size
    }
    if (w === 3) w = cube.size
    else if (w === 2) w = cube.size - 1
    return { move, dist, layer: l, width: w }
  }

  // Dry-run Kociemba; only commit when the full NxN ends solved.
  function tryKociemba(): boolean {
    ensureKociemba()
    const stateStr = faceletsFromRef()
    if (!stateStr) return false
    let solution: string
    try {
      solution = CubeJS.fromString(stateStr).solve()
    } catch {
      return false
    }
    if (!isStr(solution) || contain(solution, 'Error')) {
      return false
    }

    const test = new Cube(cube.size)
    test.matrix = cube.copy()
    const testRef = new Cube(3)
    testRef.matrix = refCube.copy()
    testRef.onTurn = function (move, dist, layer, width) {
      const t = mapRefTurnToNxN(move, dist, layer, width)
      test.turn(t.move, t.dist, t.layer, t.width)
    }
    try {
      testRef.parse(solution)
    } catch {
      return false
    }
    if (!test.isSolved()) return false

    refCube.parse(solution)
    return true
  }

  function applyEvenParityFix(): boolean {
    const a = Math.floor(cube.size / 2)
    const b = a - 1
    if (b < 1 || cube.size % 2 !== 0) return false
    cube.turn('R', 2, a, b)
    cube.turn('U', 2, 1, 1)
    cube.turn('R', 2, a, b)
    cube.turn('U', 2, a, a)
    cube.turn('R', 2, a, b)
    cube.turn('U', 2, a, b)
    return true
  }

  function undoEvenParityFix(): void {
    const a = Math.floor(cube.size / 2)
    const b = a - 1
    cube.turn('U', 2, a, b)
    cube.turn('R', 2, a, b)
    cube.turn('U', 2, a, a)
    cube.turn('R', 2, a, b)
    cube.turn('U', 2, 1, 1)
    cube.turn('R', 2, a, b)
  }

  let solvedByKociemba = tryKociemba()

  if (!solvedByKociemba && applyEvenParityFix()) {
    syncRefCube()
    solvedByKociemba = tryKociemba()
    if (!solvedByKociemba) {
      undoEvenParityFix()
      syncRefCube()
    }
  }

  if (!solvedByKociemba) {
    try {
      solve3Base(refCube)
    } catch {
      /* CFOP may hit parity; fall through to even-parity fix */
    }

    let unsolvedCount = 0
    const unsolved: Record<number, boolean> = {}
    for (const face of SideFaces) {
      unsolved[face] = cube.matrix[face][0][0] !== cube.matrix[face][0][1]
      if (unsolved[face]) unsolvedCount++
    }
    if (unsolvedCount > 0) {
      let finalMove: string | undefined
      if (!(unsolved[Faces.Front] && unsolved[Faces.Back])) {
        if (unsolved[Faces.Left] && unsolved[Faces.Right]) cube.parse('U')
        else {
          if (unsolved[Faces.Front]) {
            if (unsolved[Faces.Left]) cube.parse("U'")
          } else {
            if (unsolved[Faces.Right]) cube.parse('U')
            else cube.parse('U2')
          }
          cube.parse("R2 D' x")
          finalMove = "x' D R2"
        }
      }
      applyEvenParityFix()
      if (finalMove) cube.parse(finalMove)
    }
  }

  while (cube.getCenterColor(Faces.Front) !== cube.matrix[Faces.Front][0][0])
    cube.turn('U', 1, 1, 1)
}
