import contain from 'licia/contain'
import { FACE_COUNT, Faces } from './constants'
import { Cube } from './Cube'

export function solveEdges(cube: Cube): void {
  const refCube = new Cube(3)

  if (cube.size % 2 === 1) {
    const edges: [number, number][] = [
      [1, 0],
      [2, 1],
      [1, 2],
      [0, 1],
    ]
    const middle = Math.floor(cube.size / 2)
    const end = cube.size - 1
    for (let i = 0; i < FACE_COUNT; i++) {
      for (const [x, y] of edges) {
        refCube.matrix[i][y][x] =
          cube.matrix[i][y === 1 ? middle : y === 2 ? end : 0][
            x === 1 ? middle : x === 2 ? end : 0
          ]
      }
    }
  }

  const flipMainEdge = "R U R' F R' F' R"

  function parseBoth(text: string): void {
    cube.parse(text)
    refCube.parse(text)
  }
  function turnMiddle(dist = 1): void {
    cube.turn('U', dist, cube.size - 1, cube.size - 2)
    refCube.turn('U', dist, 2, 1)
  }
  function getMainEdgeColors(): [number, number] {
    const e = refCube.getEdge(Faces.Front, Faces.Right)
    return [e.f2c[Faces.Front], e.f2c[Faces.Right]]
  }
  function findPiecesInMainEdge(
    fc: number,
    rc: number,
  ): { oriented: number[]; unoriented: number[] } {
    const oriented: number[] = []
    const unoriented: number[] = []
    for (let i = 1; i < cube.size - 1; i++) {
      if (
        cube.matrix[Faces.Front][i][cube.size - 1] === fc &&
        cube.matrix[Faces.Right][i][0] === rc
      )
        oriented.push(i + 1)
      else if (
        cube.matrix[Faces.Front][i][cube.size - 1] === rc &&
        cube.matrix[Faces.Right][i][0] === fc
      )
        unoriented.push(i + 1)
    }
    return { oriented, unoriented }
  }
  function isMainEdgeSolved(
    fc: number,
    rc: number,
    n = cube.size - 1,
  ): boolean {
    for (let i = 1; i < n; i++) {
      if (
        cube.matrix[Faces.Front][i][cube.size - 1] !== fc ||
        cube.matrix[Faces.Right][i][0] !== rc
      )
        return false
    }
    return true
  }
  function isFrontEdgeSolved(face: number): boolean {
    for (let i = 1; i < cube.size - 1; i++) {
      if (
        cube.matrix[Faces.Front][face === Faces.Top ? 0 : cube.size - 1][i] !==
          refCube.matrix[Faces.Front][face === Faces.Top ? 0 : 2][1] ||
        cube.matrix[face][face === Faces.Top ? cube.size - 1 : 0][i] !==
          refCube.matrix[face][face === Faces.Top ? 2 : 0][1]
      )
        return false
    }
    return true
  }
  function anyPieceInMainEdge(colors: Record<number, number>): boolean {
    for (let i = 1; i < cube.size - 1; i++) {
      if (
        cube.matrix[Faces.Front][i][cube.size - 1] in colors &&
        cube.matrix[Faces.Right][i][0] in colors
      )
        return true
    }
    return false
  }
  function anyPieceInTopEdge(colors: Record<number, number>): boolean {
    for (let i = 1; i < cube.size - 1; i++) {
      if (
        cube.matrix[Faces.Front][0][i] in colors &&
        cube.matrix[Faces.Top][cube.size - 1][i] in colors
      )
        return true
    }
    return false
  }
  function anyPieceInBottomEdge(colors: Record<number, number>): boolean {
    for (let i = 1; i < cube.size - 1; i++) {
      if (
        cube.matrix[Faces.Front][cube.size - 1][i] in colors &&
        cube.matrix[Faces.Bottom][0][i] in colors
      )
        return true
    }
    return false
  }

  const fixCenterMoves = new Int32Array(cube.size - 2)
  for (let i = 0; i < 8; i++) {
    const isTop = i < 4
    const insertEdgeMove = isTop ? "R U' R'" : "R' D R"
    const searchMove = isTop ? 'U' : 'D'
    let [fc, rc] = getMainEdgeColors()
    const colors: Record<number, number> = { [fc]: 1, [rc]: 1 }

    let unoriented = findPiecesInMainEdge(fc, rc).unoriented
    if (unoriented.length > 0) {
      for (const layer of unoriented) cube.turn('U', 1, layer, 1)
      parseBoth(flipMainEdge)
      for (const layer of unoriented) cube.turn('U', -1, layer, 1)
      ;[fc, rc] = [rc, fc]
    }

    while (!isMainEdgeSolved(fc, rc)) {
      const slots: { oriented: number[]; unoriented: number[] }[] = []
      for (let j = 0; j < 3; j++) {
        turnMiddle()
        if (!anyPieceInMainEdge(colors)) {
          for (let k = 0; k < 4; k++) {
            parseBoth('U D')
            if (anyPieceInTopEdge(colors)) {
              parseBoth("R U' R'")
              break
            } else if (anyPieceInBottomEdge(colors)) {
              parseBoth("R' D R")
              break
            }
          }
        }
        slots.push(findPiecesInMainEdge(fc, rc))
      }
      turnMiddle()

      for (let j = 0; j < slots.length; j++) {
        for (const layer of slots[j].oriented) {
          cube.turn('U', j + 1, layer, 1)
          fixCenterMoves[layer - 2] -= j + 1
        }
      }
      parseBoth(flipMainEdge)
      ;[fc, rc] = [rc, fc]
      for (let j = 0; j < slots.length; j++) {
        for (const layer of slots[j].unoriented) {
          cube.turn('U', j + 1, layer, 1)
          fixCenterMoves[layer - 2] -= j + 1
        }
      }
    }
    for (let j = 0; j < 4; j++) {
      parseBoth(searchMove)
      if (!isFrontEdgeSolved(isTop ? Faces.Top : Faces.Bottom)) {
        parseBoth(insertEdgeMove)
        break
      }
    }
  }
  for (let i = 0; i < fixCenterMoves.length; i++)
    if (fixCenterMoves[i]) cube.turn('U', fixCenterMoves[i], i + 2, 1)

  for (let i = 0; i < 3; i++) {
    let [fc, rc] = getMainEdgeColors()
    const unoriented = findPiecesInMainEdge(fc, rc).unoriented
    if (unoriented.length > 0) {
      for (const layer of unoriented) cube.turn('U', 1, layer, 1)
      parseBoth(flipMainEdge)
      for (const layer of unoriented) cube.turn('U', -1, layer, 1)
      ;[fc, rc] = [rc, fc]
    }
    for (let j = 0; j < 2; j++) {
      const halfSize = Math.floor(cube.size / 2)
      while (!isMainEdgeSolved(fc, rc, halfSize)) {
        const slots: number[][] = []
        for (let k = 0; k < 3; k++) {
          turnMiddle()
          slots.push(findPiecesInMainEdge(fc, rc).unoriented)
        }
        turnMiddle()
        for (let k = 0; k < slots.length; k++) {
          const topUnoriented = slots[k].filter((x) => x > halfSize)
          for (const layer of topUnoriented)
            cube.turn('U', -(k + 1), cube.size + 1 - layer, 1)
          turnMiddle(k + 1)
          parseBoth(flipMainEdge)
          turnMiddle(-(k + 1))
          for (const layer of topUnoriented)
            cube.turn('U', k + 1, cube.size + 1 - layer, 1)
        }
      }
      parseBoth(flipMainEdge)
      ;[fc, rc] = [rc, fc]
    }
    turnMiddle()
  }

  // Even-order OLL parity: flip paired wings before the 3×3 stage.
  let [fc, rc] = getMainEdgeColors()
  const parityEdges = findPiecesInMainEdge(fc, rc).unoriented
  const numParityEdges = parityEdges.length / 2
  parseBoth("F'")
  const parityEdgesA = parityEdges.slice(0, numParityEdges)
  const parityEdgesB = parityEdges.slice(numParityEdges)
  for (const lay of parityEdgesB) cube.turn('L', -1, lay, 1)
  parseBoth('U2 x')
  for (const dist of [-1, -1, 1]) {
    for (const lay of parityEdgesB) cube.turn('L', dist, lay, 1)
    parseBoth('U2')
  }
  for (const lay of parityEdgesA) cube.turn('L', 1, lay, 1)
  parseBoth('U2')
  for (let i = 2; i < cube.size; i++) {
    if (!contain(parityEdgesA, i)) cube.turn('L', 1, i, 1)
  }
  parseBoth('U2')
  refCube.turn('L', 1, 2, 1)
  for (const dist of [-1, 1, 1]) {
    for (const lay of parityEdgesB) cube.turn('L', dist, lay, 1)
    parseBoth('U2')
  }
}
