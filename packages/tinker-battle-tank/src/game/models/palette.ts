import sum from 'licia/sum'
import type { TankLevel } from '../types'

export interface TankPalette {
  body: number
  light: number
  dark: number
}

/**
 * Muted field paints — still map to Battle City roles (P1 sand, P2 olive,
 * bots grey / slate / rust / maroon) but read as real armour, not arcade neon.
 */
export const TANK_PALETTES: Record<
  'player' | 'player2' | TankLevel,
  TankPalette
> = {
  // Desert sand / warm drab (was bright yellow).
  player: { body: 0xb89a56, light: 0xd2c08a, dark: 0x5a4828 },
  // NATO olive drab (was bright green).
  player2: { body: 0x4e5c3a, light: 0x7a8a5c, dark: 0x2a3420 },
  // Weathered armour grey-green (was chrome silver).
  basic: { body: 0x7a7e72, light: 0xa4a89c, dark: 0x3a3e38 },
  // Cold blue-grey (was toy cyan).
  fast: { body: 0x5a6e78, light: 0x8a9ea8, dark: 0x2a3840 },
  // Burnt sienna / rust drab (was neon orange).
  power: { body: 0x8a5a34, light: 0xb88858, dark: 0x3e2814 },
  // Dark maroon drab (was arcade red/purple).
  armor: { body: 0x6e3c34, light: 0x9a6a58, dark: 0x2e1a18 },
}

/** Flash schemes reuse the same muted paints so HP colour cycles stay readable. */
const SCHEME_PALETTES: Record<'silver' | 'green' | 'yellow', TankPalette> = {
  silver: TANK_PALETTES.basic,
  green: TANK_PALETTES.player2,
  yellow: TANK_PALETTES.player,
}

/** Hot power-up flash — brighter than armour maroon so the red pulse reads. */
const POWER_UP_RED: TankPalette = {
  body: 0xe22424,
  light: 0xff7a5c,
  dark: 0x6e0c0c,
}

const POWER_UP_SILVER: TankPalette = {
  body: 0x9aa0a6,
  light: 0xd0d4d8,
  dark: 0x4a5056,
}

/** Half-period of the power-up red/silver pulse, in ms (8 frames @ 60fps). */
const POWER_UP_FLASH_HALF_MS = (1000 / 60) * 8

/** 0 = silver, 1 = full red — smooth sine, not a hard blink. */
export function powerUpFlashAmount(clockMs: number) {
  return 0.5 + 0.5 * Math.sin((clockMs * Math.PI) / POWER_UP_FLASH_HALF_MS)
}

/**
 * Resolves the bot palette for the current frame, matching the reference
 * withPowerUp red/silver pulse and armor HP colour cycles.
 */
export function resolveBotPalette(
  level: TankLevel,
  hp: number,
  withPowerUp: boolean,
  clockMs: number,
): TankPalette {
  const frameMs = 1000 / 60
  if (withPowerUp) {
    return lerpPalette(
      POWER_UP_SILVER,
      POWER_UP_RED,
      powerUpFlashAmount(clockMs),
    )
  }
  if (level !== 'armor') {
    return TANK_PALETTES[level]
  }
  if (hp >= 4) {
    // silver f(3), green f(1), silver f(1), green f(1) → 6 frames
    const cycle = [3, 1, 1, 1]
    const colors: Array<'silver' | 'green'> = [
      'silver',
      'green',
      'silver',
      'green',
    ]
    return SCHEME_PALETTES[pickTimedColor(clockMs, frameMs, cycle, colors)]
  }
  if (hp === 3) {
    // silver f(3), yellow f(1), silver f(1), yellow f(1)
    const cycle = [3, 1, 1, 1]
    const colors: Array<'silver' | 'yellow'> = [
      'silver',
      'yellow',
      'silver',
      'yellow',
    ]
    return SCHEME_PALETTES[pickTimedColor(clockMs, frameMs, cycle, colors)]
  }
  if (hp === 2) {
    // green f(3), yellow f(1), green f(1), yellow f(1)
    const cycle = [3, 1, 1, 1]
    const colors: Array<'green' | 'yellow'> = [
      'green',
      'yellow',
      'green',
      'yellow',
    ]
    return SCHEME_PALETTES[pickTimedColor(clockMs, frameMs, cycle, colors)]
  }
  return SCHEME_PALETTES.silver
}

function lerpChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function lerpHex(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  return (
    (lerpChannel(ar, br, t) << 16) |
    (lerpChannel(ag, bg, t) << 8) |
    lerpChannel(ab, bb, t)
  )
}

function lerpPalette(a: TankPalette, b: TankPalette, t: number): TankPalette {
  return {
    body: lerpHex(a.body, b.body, t),
    light: lerpHex(a.light, b.light, t),
    dark: lerpHex(a.dark, b.dark, t),
  }
}

function pickTimedColor<T extends string>(
  clockMs: number,
  frameMs: number,
  durations: number[],
  colors: T[],
): T {
  const total = sum(...durations)
  let frame = Math.floor(clockMs / frameMs) % total
  for (let index = 0; index < durations.length; index += 1) {
    frame -= durations[index]
    if (frame < 0) return colors[index]
  }
  return colors[0]
}
