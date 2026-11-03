import contain from 'licia/contain'
import map from 'licia/map'
import reverse from 'licia/reverse'
import trim from 'licia/trim'
import Cube from 'cubejs'
import { Cube as EasyCube, Faces, solve as solveEasyCube } from './nxn/solve'
import {
  applyMove,
  isSolved,
  layerCoords,
  type Axis,
  type CubeState,
  type Move,
  type Vec3,
} from './model'

/** Our sticker colors R,L,U,D,F,B → EasyCube Right,Left,Top,Bottom,Front,Back. */
const OUR_TO_EASY = [3, 1, 4, 5, 0, 2] as const

const NORMAL_TO_FACE: Record<string, number> = {
  '0,1,0': Faces.Top,
  '0,-1,0': Faces.Bottom,
  '0,0,1': Faces.Front,
  '0,0,-1': Faces.Back,
  '1,0,0': Faces.Right,
  '-1,0,0': Faces.Left,
}

const FACELET_COLOR = ['R', 'L', 'U', 'D', 'F', 'B'] as const

type FaceMove = {
  axis: Axis
  layerSign: 1 | -1
  cw: number
}

const FACE_ALG: Record<string, FaceMove> = {
  R: { axis: 0, layerSign: 1, cw: -1 },
  L: { axis: 0, layerSign: -1, cw: 1 },
  U: { axis: 1, layerSign: 1, cw: -1 },
  D: { axis: 1, layerSign: -1, cw: 1 },
  F: { axis: 2, layerSign: 1, cw: -1 },
  B: { axis: 2, layerSign: -1, cw: 1 },
}

let kociembaReady: Promise<void> | null = null

function invertMove(move: Move): Move {
  return {
    ...move,
    turns: move.turns === 2 ? 2 : -move.turns,
  }
}

/** Fallback path when the solver has no better queue (scramble inverse). */
export function invertScramble(moves: Move[]): Move[] {
  return reverse(map(moves, invertMove))
}

export function prepareSolver(): Promise<void> {
  if (!kociembaReady) {
    kociembaReady = Promise.resolve().then(() => {
      Cube.initSolver()
    })
  }
  return kociembaReady
}

function applyPath(state: CubeState, moves: Move[]): CubeState {
  let next = state
  for (const move of moves) next = applyMove(next, move)
  return next
}

function toFacelets(state: CubeState): string {
  const size = state.size
  const edge = size - 1
  const coords = layerCoords(size)
  const map = new Map(
    state.stickers.map((s) => [`${s.p.join(',')}|${s.n.join(',')}`, s.c]),
  )
  const at = (p: Vec3, n: Vec3) => {
    const c = map.get(`${p.join(',')}|${n.join(',')}`)
    return c === undefined ? '?' : FACELET_COLOR[c]
  }

  const faces: string[] = []
  for (const z of coords) {
    for (const x of coords) faces.push(at([x, edge, z], [0, 1, 0]))
  }
  for (const y of [...coords].reverse()) {
    for (const z of [...coords].reverse()) {
      faces.push(at([edge, y, z], [1, 0, 0]))
    }
  }
  for (const y of [...coords].reverse()) {
    for (const x of coords) faces.push(at([x, y, edge], [0, 0, 1]))
  }
  for (const z of [...coords].reverse()) {
    for (const x of coords) faces.push(at([x, -edge, z], [0, -1, 0]))
  }
  for (const y of [...coords].reverse()) {
    for (const z of coords) faces.push(at([-edge, y, z], [-1, 0, 0]))
  }
  for (const y of [...coords].reverse()) {
    for (const x of [...coords].reverse()) {
      faces.push(at([x, y, -edge], [0, 0, -1]))
    }
  }
  return faces.join('')
}

function parseKociembaAlg(alg: string, size: number): Move[] {
  const edge = size - 1
  const moves: Move[] = []
  for (const token of trim(alg).split(/\s+/)) {
    if (!token) continue
    const face = FACE_ALG[token[0]]
    if (!face) continue
    const suf = token.slice(1)
    const turns = suf === '2' ? 2 : suf === "'" ? -face.cw : face.cw
    moves.push({
      axis: face.axis,
      layer: face.layerSign * edge,
      turns,
    })
  }
  return moves
}

async function solve3x3(state: CubeState): Promise<Move[] | null> {
  await prepareSolver()
  const facelets = toFacelets(state)
  if (facelets.length !== 54 || contain(facelets, '?')) return null
  try {
    const alg = Cube.fromString(facelets).solve()
    if (!trim(alg ?? '')) return null
    const moves = parseKociembaAlg(alg, 3)
    if (!moves.length) return null
    return isSolved(applyPath(state, moves)) ? moves : null
  } catch {
    return null
  }
}

function stateToEasyCube(state: CubeState) {
  const n = state.size
  const edge = n - 1
  const cube = new EasyCube(n)

  for (const sticker of state.stickers) {
    const face = NORMAL_TO_FACE[sticker.n.join(',')]
    if (face === undefined) continue
    const color = OUR_TO_EASY[sticker.c]
    const ix = (sticker.p[0] + edge) / 2
    const iy = (sticker.p[1] + edge) / 2
    const iz = (sticker.p[2] + edge) / 2
    let mx = ix
    let my = iy

    switch (face) {
      case Faces.Front:
        my = n - 1 - iy
        break
      case Faces.Back:
        mx = n - 1 - ix
        my = n - 1 - iy
        break
      case Faces.Right:
        mx = n - 1 - iz
        my = n - 1 - iy
        break
      case Faces.Left:
        mx = iz
        my = n - 1 - iy
        break
      case Faces.Top:
        my = iz
        break
      case Faces.Bottom:
        my = n - 1 - iz
        break
    }

    cube.matrix[face][my][mx] = color
  }

  return cube
}

function easyTurnToMoves(
  move: string,
  dist: number,
  layer: number,
  width: number,
  n: number,
): Move[] {
  let d = dist % 4
  if (d < 0) d += 4
  if (d === 0) return []
  if (layer === n && width === n) return []

  let axis: Axis = 0
  const indices: number[] = []
  for (let i = 0; i < width; i++) {
    let index: number
    switch (move) {
      case 'U':
        axis = 1
        index = n - layer + i
        break
      case 'D':
        axis = 1
        index = layer - 1 - i
        break
      case 'F':
        axis = 2
        index = n - layer + i
        break
      case 'B':
        axis = 2
        index = layer - 1 - i
        break
      case 'R':
        axis = 0
        index = n - layer + i
        break
      case 'L':
        axis = 0
        index = layer - 1 - i
        break
      default:
        return []
    }
    indices.push(index)
  }

  let turns: number
  switch (move) {
    case 'U':
    case 'F':
    case 'R':
      turns = d === 3 ? 1 : d === 2 ? 2 : -1
      break
    case 'D':
    case 'B':
    case 'L':
      turns = d === 3 ? -1 : d === 2 ? 2 : 1
      break
    default:
      return []
  }

  return map(indices, (index) => ({
    axis,
    layer: 2 * index - (n - 1),
    turns,
  }))
}

async function solveNxN(state: CubeState): Promise<Move[] | null> {
  await prepareSolver()
  try {
    const easy = stateToEasyCube(state)
    if (easy.isSolved()) return []

    const moves: Move[] = []
    solveEasyCube(easy, (_text, move, dist, layer, width) => {
      moves.push(...easyTurnToMoves(move, dist, layer, width, state.size))
    })

    if (!moves.length) return null
    return isSolved(applyPath(state, moves)) ? moves : null
  } catch {
    return null
  }
}

/** 3×3: cubejs Kociemba. 4×4 / 5×5: reduction + Kociemba on the 3×3 core. */
export async function findSolution(state: CubeState): Promise<Move[] | null> {
  if (isSolved(state)) return []
  if (state.size === 3) return solve3x3(state)
  if (state.size === 4 || state.size === 5) return solveNxN(state)
  return null
}
