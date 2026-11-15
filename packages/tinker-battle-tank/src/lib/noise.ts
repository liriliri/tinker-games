import clamp from 'licia/clamp'

/** Deterministic 2D hash in [0, 1). */
export function hash2(x: number, y: number, seed: number) {
  let n =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(seed | 0, 1274126177)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/** Value noise; set `period` for seamless tiling. */
export function valueNoise(x: number, y: number, seed: number, period = 0) {
  const wrap = (v: number) => {
    if (!period) return v
    return ((v % period) + period) % period
  }
  const x0 = wrap(Math.floor(x))
  const y0 = wrap(Math.floor(y))
  const x1 = wrap(x0 + 1)
  const y1 = wrap(y0 + 1)
  const fx = x - Math.floor(x)
  const fy = y - Math.floor(y)
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash2(x0, y0, seed)
  const b = hash2(x1, y0, seed)
  const c = hash2(x0, y1, seed)
  const d = hash2(x1, y1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function fbm(
  x: number,
  y: number,
  seed: number,
  octaves = 4,
  period = 0,
) {
  let amp = 0.5
  let sum = 0
  let norm = 0
  let px = x
  let py = y
  let per = period
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * valueNoise(px, py, seed + i * 17, per)
    norm += amp
    px *= 2
    py *= 2
    per *= 2
    amp *= 0.5
  }
  return sum / norm
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
