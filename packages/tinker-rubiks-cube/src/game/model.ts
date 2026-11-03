import filter from 'licia/filter'
import isStr from 'licia/isStr'
import lpad from 'licia/lpad'
import map from 'licia/map'
import range from 'licia/range'

export type Axis = 0 | 1 | 2
export type CubeSize = 3 | 4 | 5
export type Vec3 = [number, number, number]

export interface Sticker {
  p: Vec3
  n: Vec3
  c: number
}

export interface CubeState {
  size: number
  stickers: Sticker[]
}

export interface Move {
  axis: Axis
  layer: number | null
  turns: number
}

export const CUBE_SIZES: CubeSize[] = [3, 4, 5]

const SCRAMBLE_MOVES: Record<number, number> = {
  3: 22,
  4: 36,
  5: 50,
}

const FACE_KEYS: Record<string, { axis: Axis; sign: number }> = {
  r: { axis: 0, sign: 1 },
  l: { axis: 0, sign: -1 },
  u: { axis: 1, sign: 1 },
  d: { axis: 1, sign: -1 },
  f: { axis: 2, sign: 1 },
  b: { axis: 2, sign: -1 },
}

const WHOLE_KEYS: Record<string, Axis> = { x: 0, y: 1, z: 2 }

export function layerCoords(size: number): number[] {
  return map(range(size), (i) => 2 * i - (size - 1))
}

function colorFromNormal(n: Vec3): number {
  const axis = n[0] !== 0 ? 0 : n[1] !== 0 ? 1 : 2
  return axis * 2 + (n[axis] > 0 ? 0 : 1)
}

export function createSolved(size: number): CubeState {
  const coords = layerCoords(size)
  const edge = size - 1
  const stickers: Sticker[] = []

  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [1, -1] as const) {
      const normal: Vec3 = [0, 0, 0]
      normal[axis] = sign
      const [u, v] = ([0, 1, 2] as const).filter((a) => a !== axis)

      for (const cu of coords) {
        for (const cv of coords) {
          const p: Vec3 = [0, 0, 0]
          p[axis] = sign * edge
          p[u] = cu
          p[v] = cv
          stickers.push({
            p,
            n: [...normal] as Vec3,
            c: colorFromNormal(normal),
          })
        }
      }
    }
  }

  return { size, stickers }
}

function rotateVec(v: Vec3, axis: Axis, turns: number): Vec3 {
  let [x, y, z] = v
  const count = ((turns % 4) + 4) % 4
  for (let i = 0; i < count; i++) {
    if (axis === 0) [y, z] = [-z, y]
    else if (axis === 1) [x, z] = [z, -x]
    else [x, y] = [-y, x]
  }
  return [x, y, z]
}

export function applyMove(state: CubeState, move: Move): CubeState {
  return {
    size: state.size,
    stickers: state.stickers.map((sticker) => {
      if (move.layer !== null && sticker.p[move.axis] !== move.layer) {
        return sticker
      }
      return {
        p: rotateVec(sticker.p, move.axis, move.turns),
        n: rotateVec(sticker.n, move.axis, move.turns),
        c: sticker.c,
      }
    }),
  }
}

export function isSolved(state: CubeState): boolean {
  const faceColor = new Map<string, number>()
  for (const sticker of state.stickers) {
    const key = sticker.n.join(',')
    const existing = faceColor.get(key)
    if (existing === undefined) faceColor.set(key, sticker.c)
    else if (existing !== sticker.c) return false
  }
  return true
}

export function generateScramble(
  size: number,
  random: () => number = Math.random,
): Move[] {
  const coords = layerCoords(size)
  // 3×3: outer faces only so centers stay fixed (needed for the Kociemba solver).
  const layers =
    size === 3 ? filter(coords, (c) => Math.abs(c) === size - 1) : coords
  const count = SCRAMBLE_MOVES[size] ?? 25
  const moves: Move[] = []
  let prev: { axis: Axis; layer: number } | null = null

  while (moves.length < count) {
    const axis = Math.floor(random() * 3) as Axis
    const layer = layers[Math.floor(random() * layers.length)]
    if (prev && prev.axis === axis && prev.layer === layer) continue

    const r = random()
    const turns = r < 0.4 ? 1 : r < 0.8 ? -1 : 2
    moves.push({ axis, layer, turns })
    prev = { axis, layer }
  }

  return moves
}

function stickerKey(p: Vec3, n: Vec3): string {
  return `${p.join(',')}|${n.join(',')}`
}

export function serializeColors(state: CubeState): string {
  const map = new Map(state.stickers.map((s) => [stickerKey(s.p, s.n), s.c]))
  return createSolved(state.size)
    .stickers.map((s) => map.get(stickerKey(s.p, s.n)) ?? s.c)
    .join('')
}

export function deserializeColors(
  size: number,
  colors: string,
): CubeState | null {
  const base = createSolved(size)
  if (
    !isStr(colors) ||
    colors.length !== base.stickers.length ||
    !/^[0-5]+$/.test(colors)
  ) {
    return null
  }

  const counts = [0, 0, 0, 0, 0, 0]
  for (const ch of colors) counts[Number(ch)]++
  if (counts.some((c) => c !== size * size)) return null

  return {
    size,
    stickers: map(base.stickers, (s, i) => ({ ...s, c: Number(colors[i]) })),
  }
}

export function parseKeyMove(
  key: string,
  size: number,
  shift: boolean,
): Move | null {
  const lower = key.toLowerCase()
  const face = FACE_KEYS[lower]
  if (face) {
    return {
      axis: face.axis,
      layer: face.sign * (size - 1),
      turns: shift ? face.sign : -face.sign,
    }
  }
  if (lower in WHOLE_KEYS) {
    return {
      axis: WHOLE_KEYS[lower],
      layer: null,
      turns: shift ? 1 : -1,
    }
  }
  return null
}

export function formatTime(ms: number): string {
  if (!(ms > 0)) return '—'
  const centis = Math.floor(ms / 10)
  const minutes = Math.floor(centis / 6000)
  const seconds = Math.floor((centis % 6000) / 100)
  const frac = lpad(String(centis % 100), 2, '0')
  if (minutes > 0) {
    return `${minutes}:${lpad(String(seconds), 2, '0')}.${frac}`
  }
  return `${seconds}.${frac}`
}
