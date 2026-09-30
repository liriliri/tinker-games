export type GameState = 'ready' | 'charging' | 'jumping' | 'gameover'

/** Palette from the original WeChat jump-jump config. */
export const COLORS = {
  pureWhite: 0xffffff,
  /** Pedestal bands from original block.js changeColor themes. */
  platformWhite: 0xeeeeee,
  platformGray: 0x9e9e9e,
  platformLightGray: 0xcbcbcb,
  /** Block body green from changeColor (not config COLORS.green). */
  blockGreen: 0x619066,
  blockGray: 0x6d6d6d,
  ringGreen: 0x74a379,
  ringLight: 0xbbbbbb,
  ringDark: 0x888888,
} as const

/**
 * Platform themes in the spirit of original changeColor() green / gray / black:
 * muted body + light (or inverted) band + mid-tone ring (ring used on cylinders only).
 */
export const BLOCK_THEMES = [
  // Original three
  {
    color: COLORS.blockGreen,
    band: COLORS.platformWhite,
    ring: COLORS.ringGreen,
  },
  {
    color: COLORS.platformWhite,
    band: COLORS.platformGray,
    ring: COLORS.ringLight,
  },
  {
    color: COLORS.blockGray,
    band: COLORS.platformLightGray,
    ring: COLORS.ringDark,
  },
  // Extensions — same structure, dusty / desaturated cousins
  { color: 0x5b7c9a, band: 0xeeeeee, ring: 0x7a9ab8 }, // dusty blue
  { color: 0x9a6b7c, band: 0xeeeeee, ring: 0xb58898 }, // dusty rose
  { color: 0x8a7355, band: 0xeeeeee, ring: 0xa89070 }, // warm brown
  { color: 0x6b6a9a, band: 0xeeeeee, ring: 0x8887b8 }, // dusty purple
  { color: 0x5a8f8a, band: 0xeeeeee, ring: 0x74a9a3 }, // teal
  { color: 0xb8956a, band: 0xeeeeee, ring: 0xc9a87e }, // sand
  { color: 0xc5d0dc, band: 0x7a8a9a, ring: 0xa8b4c0 }, // mist on slate
  { color: 0xd4c4b0, band: 0x8a7a68, ring: 0xbba890 }, // cream on taupe
] as const

export const BOTTLE = {
  bodyHeight: 3.2,
  bodyWidth: 2.34,
  reduction: 0.005,
  minScale: 0.5,
  velocityY: 135,
  velocityYIncrement: 15,
  velocityZIncrement: 70,
  maxVelocityZ: 150,
  maxVelocityY: 180,
} as const

export const BLOCK = {
  radius: 5,
  height: 5.5,
  minRadiusScale: 0.78,
  maxRadiusScale: 1,
  minDistance: 4,
  maxDistance: 17,
  reduction: 0.005,
  minScale: 0.5,
  perfectDistance: 0.72,
} as const

export const GAME = {
  gravity: 720,
  /** World Y where the bottle rests after a miss (just under block bottoms). */
  groundY: -BLOCK.height / 2 - 0.3,
} as const

/** World units visible vertically; wider landscape just expands X coverage. */
export const FRUSTUM_HEIGHT = 38

/**
 * Camera offset from the focus point. Original jump-jump looks along (1,-1,-1)
 * (camera − lookAt = (−30, 30, 30)), so a world-axis box top reads as a
 * diamond with its vertical diagonal on screen.
 */
export const CAMERA_OFFSET = { x: -30, y: 30, z: 30 } as const

export const WAVE = {
  innerRadius: 2.2,
  outerRadius: 3,
  thetaSeg: 32,
} as const

/** Exact RGB stops from the original ground.js palettes. */
export const GROUND_PALETTES = [
  { top: 0xd7dbe6, bottom: 0xbcbec7 },
  { top: 0xfcebe3, bottom: 0xe3bec3 },
  { top: 0xd9edf5, bottom: 0xbcdabf },
  { top: 0xf8e4bd, bottom: 0xe7c088 },
  { top: 0xd6e6f9, bottom: 0x99b7d0 },
  { top: 0xfffacc, bottom: 0xefe898 },
  { top: 0xd9daf6, bottom: 0xa4acd4 },
] as const
