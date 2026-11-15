/**
 * Tuning constants ported from the Battle City reference implementation.
 *
 * The reference works in pixels (one cell = 16 px). This port works in cells,
 * where one cell is one world unit, so every length below is expressed in
 * cells and every speed in cells per second.
 */

export const FIELD_BLOCKS = 13
export const FIELD_SIZE = FIELD_BLOCKS
export const HALF_FIELD = FIELD_SIZE / 2

/** Bricks are quarter-cell; steel walls are half-cell. */
export const BRICK_GRID = 52
export const STEEL_GRID = 26
export const BRICK_SIZE = 1 / 4
export const STEEL_SIZE = 1 / 2

export const TANK_SIZE = 1
/** Local X of each tread centreline (matches createTankModel running gear). */
export const TANK_TRACK_HALF_WIDTH = 0.3
/** Reference bullet is 3 px wide → 3/16 of a cell. */
export const BULLET_SIZE = 3 / 16

/** Minimum power needed to break a steel wall. */
export const STEEL_POWER = 3

/** Reference speeds are px/ms; convert to cells/s. */
const PX_PER_CELL = 16
const toCellsPerSecond = (pxPerMs: number) => (pxPerMs * 1000) / PX_PER_CELL

export const MOVE_SPEED = {
  player: toCellsPerSecond(0.045),
  botBasic: toCellsPerSecond(0.03),
  botFast: toCellsPerSecond(0.06),
  botPower: toCellsPerSecond(0.045),
  botArmor: toCellsPerSecond(0.03),
} as const

export const BULLET_SPEED = {
  playerBasic: toCellsPerSecond(0.12),
  playerUpgraded: toCellsPerSecond(0.18),
  botBasic: toCellsPerSecond(0.12),
  botPower: toCellsPerSecond(0.24),
  botOther: toCellsPerSecond(0.18),
} as const

export const BULLET_INTERVAL = {
  basic: 300,
  upgraded: 200,
} as const

/** Sideways spread when a bullet breaks terrain, in cells. */
export const BULLET_EXPLOSION_SPREAD = 4 / PX_PER_CELL
export const BULLET_EXPLOSION_THRESHOLD = 0.01 / PX_PER_CELL

/** Slight permissiveness matching the reference collider. */
export const COLLIDE_THRESHOLD = -0.01 / PX_PER_CELL

/** Reference frame helper: 60 ticks/s. */
const frame = (frames: number) => (1000 / 60) * frames

export const HELMET_DURATION = frame(630)
/** Brief shield when a player tank materialises. */
export const SPAWN_HELMET_DURATION = frame(135)
export const SHOVEL_DURATION = frame(1076)
export const SHOVEL_FLASH_INTERVAL = frame(16)
export const SHOVEL_FLASH_COUNT = 6
export const BOT_FREEZE_DURATION = 5000
export const PLAYER_FREEZE_DURATION = 1000
export const POWER_UP_BLINK_INTERVAL = frame(8)
export const STAGE_CLEAR_DELAY = 4000
export const GAME_OVER_DELAY = 3000
export const PLAYER_RESPAWN_DELAY = 1200
/** Flash + drop before a tank becomes active (≈0.7s). */
export const SPAWN_FLICKER_DURATION = frame(42)
export const MAX_BOTS_SINGLE = 2
export const MAX_BOTS_MULTI = 4

export const TANK_KILL_SCORE = {
  basic: 100,
  fast: 200,
  power: 300,
  armor: 400,
} as const

export const POWER_UP_SCORE = 500
export const STAR_PICKED_BY_ARMOR_TANK_SCORE = 5000
export const LIFE_BONUS_SCORE = 10000

/** Spawn rate multiplier by stage difficulty. */
export const AI_SPAWN_SPEED = {
  1: 0.7,
  2: 0.85,
  3: 1,
  4: 1.15,
} as const

/**
 * Power-up carriers, counted from the start of the wave (0-based).
 * Index 0 is the first tank of the wave.
 */
export const POWER_UP_TANK_INDEXES = [3, 7, 12, 17]

/** Order matches the reference power-up table. */
export const POWER_UP_NAMES = [
  'tank',
  'star',
  'grenade',
  'timer',
  'helmet',
  'shovel',
] as const

export const PLAYER_SPAWNS = [
  { x: 4, y: 12 },
  { x: 8, y: 12 },
]

export const BOT_SPAWN_X = [0, 6, 12]
export const BOT_SPAWN_Y = 0

export const TANK_LEVELS = ['basic', 'fast', 'power', 'armor'] as const

export const PLAYER_START_LIVES = 3
