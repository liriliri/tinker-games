import contain from 'licia/contain'
import trim from 'licia/trim'
import Cube from 'cubejs'
import {
  parseTpr444Alg,
  prepareTpr444,
  solveTpr444Facelets,
} from './tpr/tpr444'
import {
  applyMove,
  FACE_TURN,
  isSolved,
  layerCoords,
  type CubeState,
  type Move,
  type Vec3,
} from './model'

const FACELET_COLOR = ['R', 'L', 'U', 'D', 'F', 'B'] as const

let ready: Promise<void> | null = null

/** Build 3×3 + 4×4 pruning tables (runs inside the solver worker). */
export function prepareSolver(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      Cube.initSolver()
      // 4×4 warm-up is best-effort; 3×3 still usable if TPR init fails.
      try {
        await prepareTpr444()
      } catch {
        // Keep 3×3 solver available when TPR table build fails.
      }
    })()
  }
  return ready
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
    const face = FACE_TURN[token[0]]
    if (!face) continue
    const suf = token.slice(1)
    const turns = suf === '2' ? 2 : suf === "'" ? -face.cw : face.cw
    moves.push({
      axis: face.axis,
      layer: face.sign * edge,
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

async function solve4x4(state: CubeState): Promise<Move[] | null> {
  try {
    const facelets = toFacelets(state)
    if (facelets.length !== 96 || contain(facelets, '?')) return null
    const alg = await solveTpr444Facelets(facelets)
    if (!trim(alg)) return []
    const moves = parseTpr444Alg(alg, 4)
    if (!moves.length) return null
    return isSolved(applyPath(state, moves)) ? moves : null
  } catch {
    return null
  }
}

export async function findSolution(state: CubeState): Promise<Move[] | null> {
  if (isSolved(state)) return []
  if (state.size === 3) return solve3x3(state)
  if (state.size === 4) return solve4x4(state)
  return null
}
