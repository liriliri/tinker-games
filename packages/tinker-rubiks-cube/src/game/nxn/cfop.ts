import { Colors, Faces, SideEdges, SideFaces } from './constants'
import { Cube } from './Cube'
import type { FaceId } from './types'

function orient(cube: Cube): void {
  let face: FaceId | undefined
  for (let i = 0; i < Faces.length; i++) {
    if (cube.getCenterColor(i) === Colors.White) {
      face = i
      break
    }
  }
  if (face === Faces.Bottom) return
  switch (face) {
    case Faces.Right:
      cube.turn('F', 1, 2, 1)
      break
    case Faces.Left:
      cube.turn('F', -1, 2, 1)
      break
    case Faces.Front:
      cube.turn('R', -1, 2, 1)
      break
    case Faces.Back:
      cube.turn('R', 1, 2, 1)
      break
    case Faces.Top:
      cube.turn('R', 2, 2, 1)
      break
  }
}

function solveWhiteCross(cube: Cube): void {
  function allEdgesWhite(face: FaceId): boolean {
    const list: [number, number][] = [
      [1, 0],
      [0, 1],
      [2, 1],
      [1, 2],
    ]
    for (const [x, y] of list) {
      if (cube.matrix[face][y][x] !== Colors.White) return false
    }
    return true
  }
  while (!allEdgesWhite(Faces.Top)) {
    let topFrontEdge = cube.getEdge(Faces.Front, Faces.Top)
    while (topFrontEdge.f2c[Faces.Top] === Colors.White) {
      cube.turn('U', 1, 1, 1)
      topFrontEdge = cube.getEdge(Faces.Front, Faces.Top)
    }
    if (topFrontEdge.f2c[Faces.Front] === Colors.White) {
      cube.parse("F U' R")
    } else
      block: {
        for (let i = 0; i < SideEdges.length; i++) {
          if (Colors.White in cube.getEdge(...SideEdges[i]).c2f) {
            cube.turn('U', i, 2, 1)
            if (
              cube.getEdge(Faces.Front, Faces.Left).f2c[Faces.Left] ===
              Colors.White
            ) {
              cube.turn('F', 1, 1, 1)
            } else {
              cube.parse("2U' F'")
            }
            break block
          }
        }
        for (let i = 0; i < SideFaces.length; i++) {
          if (Colors.White in cube.getEdge(Faces.Bottom, SideFaces[i]).c2f) {
            cube.turn('D', -i, 1, 1)
            if (
              cube.getEdge(Faces.Front, Faces.Bottom).f2c[Faces.Bottom] ===
              Colors.White
            ) {
              cube.turn('F', 2, 1, 1)
            } else {
              cube.parse("F' U' R")
            }
            break block
          }
        }
      }
  }
  while (!allEdgesWhite(Faces.Bottom)) {
    let topFrontEdge = cube.getEdge(Faces.Front, Faces.Top)
    while (topFrontEdge.f2c[Faces.Top] !== Colors.White) {
      cube.turn('U', 1, 1, 1)
      topFrontEdge = cube.getEdge(Faces.Front, Faces.Top)
    }
    while (topFrontEdge.f2c[Faces.Front] !== cube.matrix[Faces.Front][1][1]) {
      cube.turn('D', 1, 2, 2)
    }
    cube.turn('F', 2, 1, 1)
  }
}

function solveFirstLayerCorners(cube: Cube): void {
  function isCornerSolved(
    a: FaceId,
    b: FaceId,
  ): { permutated: boolean; oriented: boolean } {
    const corner = cube.getCorner(a, b, Faces.Bottom)
    const centerA = cube.getCenterColor(a)
    const centerB = cube.getCenterColor(b)
    return {
      permutated:
        Colors.White in corner.c2f &&
        centerA in corner.c2f &&
        centerB in corner.c2f,
      oriented:
        corner.f2c[Faces.Bottom] === Colors.White &&
        corner.f2c[a] === centerA &&
        corner.f2c[b] === centerB,
    }
  }
  function allCornersSolved(): boolean {
    for (const [a, b] of SideEdges) {
      const corner = isCornerSolved(a, b)
      if (!corner.permutated || !corner.oriented) return false
    }
    return true
  }
  function isCornerMatched(
    a: FaceId,
    b: FaceId,
    c: FaceId,
    colorA: number,
    colorB: number,
    colorC: number,
  ): boolean {
    const corner = cube.getCorner(a, b, c)
    return colorA in corner.c2f && colorB in corner.c2f && colorC in corner.c2f
  }

  while (!allCornersSolved()) {
    let cornerSolved = isCornerSolved(Faces.Front, Faces.Right)
    while (cornerSolved.permutated && cornerSolved.oriented) {
      cube.turn('D', 1, 2, 2)
      cornerSolved = isCornerSolved(Faces.Front, Faces.Right)
    }
    if (cornerSolved.permutated) {
      const corner = cube.getCorner(Faces.Front, Faces.Right, Faces.Bottom)
      switch (corner.c2f[Colors.White]) {
        case Faces.Right:
          cube.parse("R U R' U' R U R' U'")
          break
        case Faces.Front:
          cube.parse("U R U' R' U R U' R'")
          break
        default:
          throw new Error(`Impossible scramble.`)
      }
    }
    for (let i = 0; i < SideEdges.length; i++) {
      if (
        isCornerMatched(
          Faces.Bottom,
          ...SideEdges[i],
          Colors.White,
          cube.getCenterColor(Faces.Front),
          cube.getCenterColor(Faces.Right),
        )
      ) {
        const dist = i - 1
        cube.turn('D', -dist, 1, 1)
        cube.parse("R U R' U'")
        cube.turn('D', dist, 1, 1)
        break
      }
    }
    for (let i = 0; i < SideEdges.length; i++) {
      if (
        isCornerMatched(
          Faces.Top,
          ...SideEdges[i],
          Colors.White,
          cube.getCenterColor(Faces.Front),
          cube.getCenterColor(Faces.Right),
        )
      ) {
        cube.turn('U', i - 1, 1, 1)
        const corner = cube.getCorner(Faces.Front, Faces.Right, Faces.Top)
        switch (corner.c2f[Colors.White]) {
          case Faces.Front:
            cube.parse("U R U' R'")
            break
          case Faces.Right:
            cube.parse("R U R' U'")
            break
          case Faces.Top:
            cube.parse("R U2 R' U' R U R' U'")
            break
          default:
            throw new Error(`Impossible scramble.`)
        }
        break
      }
    }
  }
}

function solveSecondLayerEdges(cube: Cube): void {
  function isEdgeSolved(a: FaceId, b: FaceId): boolean {
    const edge = cube.getEdge(a, b)
    return (
      edge.f2c[a] === cube.getCenterColor(a) &&
      edge.f2c[b] === cube.getCenterColor(b)
    )
  }
  function allEdgesSolved(): boolean {
    for (const [a, b] of SideEdges) if (!isEdgeSolved(a, b)) return false
    return true
  }
  function isEdgeMatched(a: FaceId, b: FaceId): boolean {
    const edge = cube.getEdge(a, b)
    return (
      cube.getCenterColor(Faces.Front) in edge.c2f &&
      cube.getCenterColor(Faces.Right) in edge.c2f
    )
  }

  const swapEdge = "R U R' U' y L' U' L U y'"
  while (!allEdgesSolved()) {
    while (isEdgeSolved(Faces.Front, Faces.Right)) cube.turn('D', 1, 2, 2)
    if (isEdgeMatched(Faces.Front, Faces.Right)) {
      cube.parse(`${swapEdge} U2 ${swapEdge}`)
    }
    for (let i = 0; i < SideEdges.length; i++) {
      if (isEdgeMatched(...SideEdges[i])) {
        const dist = i - 1
        cube.turn('D', -dist, 2, 2)
        cube.parse(swapEdge)
        cube.turn('D', dist, 2, 2)
        break
      }
    }
    for (let i = 0; i < SideFaces.length; i++) {
      if (isEdgeMatched(Faces.Top, SideFaces[i])) {
        cube.turn('U', i, 1, 1)
        const edge = cube.getEdge(Faces.Top, Faces.Front)
        if (edge.f2c[Faces.Front] === cube.getCenterColor(Faces.Front)) {
          cube.parse(`U ${swapEdge}`)
        } else {
          cube.parse("y U2 L' U' L U y' R U R' U'")
        }
        break
      }
    }
  }
}

function solveOllEdges(cube: Cube): void {
  let sum = 0
  const solved: Record<number, boolean> = {}
  for (const face of SideFaces) {
    if (cube.getEdge(Faces.Top, face).f2c[Faces.Top] === Colors.Yellow) {
      sum++
      solved[face] = true
    }
  }
  const changeShape = "F R U R' U' F'"
  switch (sum) {
    case 0:
      cube.parse(`${changeShape} ${changeShape} U ${changeShape}`)
      break
    case 2:
      if (!(solved[Faces.Left] && solved[Faces.Right])) {
        if (solved[Faces.Front] && solved[Faces.Back]) cube.turn('U', 1, 1, 1)
        else {
          if (solved[Faces.Front]) {
            if (solved[Faces.Left]) cube.parse("U'")
          } else {
            if (solved[Faces.Right]) cube.parse('U')
            else cube.parse('U2')
          }
          cube.parse(`${changeShape} U`)
        }
      }
      cube.parse(changeShape)
      break
    case 4:
      break
    default:
      throw new Error(`Impossible shape.`)
  }
}

function solveOllCorners(cube: Cube): void {
  cube.parse('x2')
  for (let i = 0; i < SideEdges.length; i++) {
    if (
      cube.getCorner(Faces.Bottom, ...SideEdges[i]).f2c[Faces.Bottom] !==
      Colors.Yellow
    ) {
      const dist = i - 1
      cube.turn('D', -dist, 1, 1)
      switch (
        cube.getCorner(Faces.Front, Faces.Right, Faces.Bottom).c2f[
          Colors.Yellow
        ]
      ) {
        case Faces.Front:
          cube.parse("U R U' R' U R U' R'")
          break
        case Faces.Right:
          cube.parse("R U R' U' R U R' U'")
          break
        default:
          throw new Error(`Impossible scramble.`)
      }
      cube.turn('D', dist, 1, 1)
    }
  }
  cube.parse('x2')
}

function solvePllCorners(cube: Cube): void {
  function edgeDiff(face: FaceId): number {
    return Math.abs(cube.matrix[face][0][2] - cube.matrix[face][0][0])
  }
  const frontDiff = edgeDiff(Faces.Front)
  const backDiff = edgeDiff(Faces.Back)
  const perm = "R U R' U' R' F R2 U' R' U' R U R' F'"
  if (frontDiff === backDiff) {
    if (frontDiff === 0) return
    else if (frontDiff === 2) {
      cube.parse(`${perm} y y ${perm}`)
      return
    }
  }
  if (frontDiff === 2) cube.turn('U', -1, 1, 1)
  else if (backDiff === 2) cube.turn('U', 1, 1, 1)
  else if (edgeDiff(Faces.Left) === 2) cube.turn('U', 2, 1, 1)
  cube.parse(perm)
}

function solvePllEdges(cube: Cube): void {
  const swapEdge = "R U R' U' L' U' L U U R U' R' U' L' U L"
  for (let i = 0; i < 2; i++) {
    let unsolvedCount = 0
    let solvedIndex = -1
    for (let j = 0; j < SideFaces.length; j++) {
      const face = SideFaces[j]
      if (cube.matrix[face][0][1] !== cube.matrix[face][0][0]) unsolvedCount++
      else if (solvedIndex === -1) solvedIndex = j
    }
    switch (unsolvedCount) {
      case 0:
        i = Infinity
        break
      case 2:
        throw new Error('Parity detected.')
      case 4:
        cube.parse(swapEdge)
        break
      case 3:
        cube.turn('U', solvedIndex, 1, 1)
        if (
          Math.abs(
            cube.matrix[Faces.Left][0][1] - cube.matrix[Faces.Left][0][0],
          ) === 2
        ) {
          cube.parse(swapEdge)
        } else {
          cube.parse(`${swapEdge} ${swapEdge}`)
        }
        break
    }
  }
}

export function solve3Base(cube: Cube): void {
  orient(cube)
  solveWhiteCross(cube)
  solveFirstLayerCorners(cube)
  solveSecondLayerEdges(cube)
  solveOllEdges(cube)
  solveOllCorners(cube)
  solvePllCorners(cube)
  solvePllEdges(cube)
}
