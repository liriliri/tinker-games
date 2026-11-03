import max from 'licia/max'
import trim from 'licia/trim'
import { FACE_TURN, type Move } from '../model'
import { initTpr, solveFacelets } from './search'

let initPromise: Promise<void> | null = null

/** Warm up pruning tables (several seconds on first call). */
export async function prepareTpr444(): Promise<void> {
  if (!initPromise) {
    initPromise = Promise.resolve().then(() => {
      initTpr()
    })
  }
  return initPromise
}

export async function solveTpr444Facelets(facelets: string): Promise<string> {
  await prepareTpr444()
  return trim(solveFacelets(facelets))
}

/** Wide turns expand to stacked layers (Rw → outer + inner). */
export function parseTpr444Alg(alg: string, size = 4): Move[] {
  const edge = size - 1
  const moves: Move[] = []
  for (const raw of trim(alg).split(/\s+/)) {
    if (!raw) continue
    const m = /^(?<wide>[2-9])?(?<face>[URFDLB])(?<w>w)?(?<suf>2|')?$/.exec(raw)
    if (!m?.groups) continue
    const face = FACE_TURN[m.groups.face]
    if (!face) continue
    const depth = m.groups.w
      ? max(2, Number(m.groups.wide || 2))
      : max(1, Number(m.groups.wide || 1))
    const suf = m.groups.suf
    const turns = suf === '2' ? 2 : suf === "'" ? -face.cw : face.cw
    for (let i = 0; i < depth; i++) {
      const index = face.sign > 0 ? size - 1 - i : i
      moves.push({
        axis: face.axis,
        layer: 2 * index - edge,
        turns,
      })
    }
  }
  return moves
}
