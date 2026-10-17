/** OpenGW enemy pools and polygon templates (radii in map pixels). */

export type EnemyKind =
  | 'wanderer'
  | 'grunt'
  | 'spinner'
  | 'tinySpinner'
  | 'weaver'
  | 'mayfly'
  | 'snake'
  | 'blackHole'
  | 'repulsor'
  | 'proton'
  | 'cruiser'

/** Death sparks and noise loudness (dB). Cruiser plays explode.mp3 instead. */
export const EXPLOSION: Record<
  EnemyKind,
  { n: number; scale: number; volume: number }
> = {
  proton: { n: 5, scale: 0.5, volume: -10 },
  mayfly: { n: 6, scale: 0.7, volume: -6 },
  tinySpinner: { n: 7, scale: 0.85, volume: -2 },
  snake: { n: 9, scale: 1.05, volume: 2 },
  wanderer: { n: 10, scale: 1.2, volume: 4 },
  weaver: { n: 12, scale: 1.4, volume: 6 },
  grunt: { n: 13, scale: 1.55, volume: 8 },
  spinner: { n: 16, scale: 1.8, volume: 10 },
  repulsor: { n: 18, scale: 2.1, volume: 13 },
  blackHole: { n: 24, scale: 2.5, volume: 16 },
  cruiser: { n: 40, scale: 3.6, volume: 8 },
}

export const POOL: Record<EnemyKind, number> = {
  wanderer: 100,
  grunt: 200,
  spinner: 100,
  tinySpinner: 100,
  weaver: 200,
  mayfly: 400,
  snake: 50,
  blackHole: 8,
  repulsor: 4,
  proton: 200,
  cruiser: 2,
}

interface EnemyPart {
  x: number[]
  y: number[]
}

interface EnemyDef {
  kind: EnemyKind
  radius: number
  score: number
  /** Index into COLORS palette (Evil Glitch style). */
  color: number
  /** Closed polygon in local space (−1…1). */
  shapeX: number[]
  shapeY: number[]
  parts?: EnemyPart[]
}

function ring(n: number, r: number): EnemyPart {
  const x: number[] = []
  const y: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    x.push(Math.cos(a) * r)
    y.push(Math.sin(a) * r)
  }
  return { x, y }
}

function line(x0: number, y0: number, x1: number, y1: number): EnemyPart {
  return { x: [x0, x1], y: [y0, y1] }
}

function blade(deg: number): EnemyPart {
  const a = (deg * Math.PI) / 180
  const spread = 2.2
  return {
    x: [
      Math.cos(a) * 1.05,
      Math.cos(a + spread) * 0.34,
      Math.cos(a - spread) * 0.34,
    ],
    y: [
      Math.sin(a) * 1.05,
      Math.sin(a + spread) * 0.34,
      Math.sin(a - spread) * 0.34,
    ],
  }
}

export const DEFS: Record<EnemyKind, EnemyDef> = {
  wanderer: {
    kind: 'wanderer',
    radius: 16,
    score: 25,
    color: 27,
    shapeX: [0, 1, 1, 1, 0, -1, -1, -1],
    shapeY: [1, 1, 0, -1, -1, -1, 0, 1],
    // Four corner wedges from the center, so it reads as a pinwheel rather than a blank octagon.
    parts: [
      { x: [0, 0, 1], y: [0, 1, 1] },
      { x: [0, 1, 1], y: [0, 0, -1] },
      { x: [0, 0, -1], y: [0, -1, -1] },
      { x: [0, -1, -1], y: [0, 0, 1] },
    ],
  },
  grunt: {
    kind: 'grunt',
    radius: 18,
    score: 50,
    color: 15,
    shapeX: [0, 1, 0, -1],
    shapeY: [1, 0, -1, 0],
    parts: [
      { x: [0, 1, 0, -1], y: [1, 0, -1, 0] },
      { x: [0, 0.45, 0, -0.45], y: [0.45, 0, -0.45, 0] },
    ],
  },
  spinner: {
    kind: 'spinner',
    radius: 19,
    score: 100,
    color: 16,
    shapeX: [0, 0.4, 1.2, 0.4, 0, -0.4, -1.2, -0.4],
    shapeY: [1.2, 0.4, 0, -0.4, -1.2, -0.4, 0, 0.4],
    parts: [
      {
        x: [0, 0.4, 1.2, 0.4, 0, -0.4, -1.2, -0.4],
        y: [1.2, 0.4, 0, -0.4, -1.2, -0.4, 0, 0.4],
      },
      { x: [0, 0.32, 0, -0.32], y: [0.32, 0, -0.32, 0] },
    ],
  },
  tinySpinner: {
    kind: 'tinySpinner',
    radius: 10,
    score: 50,
    color: 26,
    shapeX: [0, 0.91, -0.91],
    shapeY: [-1.05, 0.52, 0.52],
    parts: [blade(-90), blade(30), blade(150)],
  },
  weaver: {
    kind: 'weaver',
    radius: 17,
    score: 100,
    color: 19,
    shapeX: ring(6, 1).x,
    shapeY: ring(6, 1).y,
    // Hex web: outer ring, inner ring, three diameters. Not a square.
    parts: [
      ring(6, 1),
      ring(6, 0.48),
      line(1, 0, -1, 0),
      line(0.5, 0.866, -0.5, -0.866),
      line(-0.5, 0.866, 0.5, -0.866),
    ],
  },
  mayfly: {
    kind: 'mayfly',
    radius: 9,
    score: 50,
    color: 24,
    shapeX: [0, 0.96, -0.96],
    shapeY: [1, -0.4, -0.4],
    // OpenGW mayfly: three separate wing strokes, not a filled triangle.
    parts: [
      line(-0.2, 1, 0.8, -0.72),
      line(0.2, 1, -0.8, -0.72),
      line(0.96, -0.4, -0.96, -0.4),
    ],
  },
  snake: {
    kind: 'snake',
    radius: 15,
    score: 50,
    color: 13,
    shapeX: [0, 0.7, -0.7],
    shapeY: [1, -0.35, -0.35],
    // Head chevron, and a smaller one for the tail. Middle segments reuse the head.
    parts: [
      { x: [0, 0.72, -0.72], y: [1, -0.2, -0.2] },
      { x: [0, 0.48, -0.48], y: [-0.05, -1, -1] },
    ],
  },
  blackHole: {
    kind: 'blackHole',
    radius: 24,
    score: 150,
    color: 4,
    shapeX: ring(12, 1).x,
    shapeY: ring(12, 1).y,
    parts: [ring(12, 1)],
  },
  repulsor: {
    kind: 'repulsor',
    radius: 21,
    score: 100,
    color: 10,
    shapeX: [0.53, 0.53, 0.77, 1, 1, 0.33, -0.33, -1, -1, -0.77, -0.53, -0.53],
    shapeY: [
      -0.07, 0.53, 0.8, 0.53, -0.33, -0.93, -0.93, -0.33, 0.53, 0.8, 0.53,
      -0.07,
    ],
    // Wide bowl. Shoulder bars stay; the two crossing braces are omitted.
    parts: [
      {
        x: [0.53, 0.53, 0.77, 1, 1, 0.33, -0.33, -1, -1, -0.77, -0.53, -0.53],
        y: [
          -0.07, 0.53, 0.8, 0.53, -0.33, -0.93, -0.93, -0.33, 0.53, 0.8, 0.53,
          -0.07,
        ],
      },
      line(0.53, 0.53, 1, 0.53),
      line(-1, 0.53, -0.53, 0.53),
    ],
  },
  proton: {
    kind: 'proton',
    radius: 8,
    score: 50,
    color: 11,
    shapeX: ring(12, 1).x,
    shapeY: ring(12, 1).y,
    parts: [ring(12, 1)],
  },
  // Outer triangle split by three spokes, like Evil Glitch's divided triangle. Nose is +X.
  cruiser: {
    kind: 'cruiser',
    radius: 56,
    score: 600,
    color: 16,
    shapeX: [1.2, -1.05, -1.05],
    shapeY: [0, 0.85, -0.85],
    parts: [
      { x: [1.2, -1.05, 0.08], y: [0, 0.85, 0] },
      { x: [1.2, 0.08, -1.05], y: [0, 0, -0.85] },
      { x: [-1.05, -1.05, 0.08], y: [0.85, -0.85, 0] },
    ],
  },
}

type EnemyState = 'inactive' | 'spawn' | 'running'

export interface Enemy {
  genId: number
  kind: EnemyKind
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  aggression: number
  state: EnemyState
  spawnTimer: number
  anim: number
  /** Black hole strength. */
  strength: number
  heading: number
  /** Body behind the head. Snake only. */
  body: { x: number; y: number }[]
  /** Recent head positions, oldest first. Snake only. */
  trail: { x: number; y: number }[]
  /** eachNear visit stamp so a snake in several cells is hit once. */
  nearStamp: number
  /** Spinner death already spawned tinies. */
  split: boolean
  /** Hits left. Most enemies die in one. */
  hp: number
  fireCd: number
  /** Shots left in the current nose burst. Cruiser only. */
  fireLeft: number
  /** Frames until the next wing launch. Cruiser only. */
  wingCd: number
  /** Tiny spinners left in the current burst. Cruiser only. */
  wingLeft: number
  /** Index in the live list, or -1 when inactive. */
  liveIndex: number
}
