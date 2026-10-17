export const FW = 800
export const FH = 600

/**
 * OpenGW-style grid: major cells ×4 + edge.
 * Base GW is 33×22 → 133×89; we use a larger 52×34 field.
 * UNIT = pixels per grid unit (keeps speeds/radii in screen space).
 */
export const OG_W = 209
export const OG_H = 137
export const UNIT = 8

/** Playable map in pixels (span between first and last grid points). */
export const MAP_W = (OG_W - 1) * UNIT
export const MAP_H = (OG_H - 1) * UNIT

/** One major GW cell (4 OpenGW units) — neon grid spacing. */
export const TILESET = 4 * UNIT

/** Gameplay coords = map pixels. */
export const GRID_W = MAP_W
export const GRID_H = MAP_H

/** OpenGW spawn distances × UNIT. */
export const SPAWN_MARGIN = 15 * UNIT
/** Min distance from fighter for random top-up / corner swarm spawns. */
export const SPAWN_CLEAR_RADIUS = 28 * UNIT
export const RUSH_RADIUS = 40 * UNIT
export const RUSH_RADIUS_BH = 80 * UNIT
export const SWARM_MARGIN = 2 * UNIT

export const MAX_SPAWN_INDEX = 40
export const SPAWN_INDEX_RATE = 0.0005

export const PLAYER_LIVES = 5
export const PLAYER_BOMBS = 5
export const PLAYER_SHIELD_FRAMES = 250
export const RESPAWN_FRAMES = 50

/** Kills needed to reach the next multiplier: x2, x3, x4, x5. */
export const MULT_KILL_STEPS = [35, 120, 320, 800]
export const EXTRA_LIFE_SCORE = 150000
export const EXTRA_BOMB_SCORE = 100000

/** ~60fps: next weapon pickup after 30–60s; the ceiling falls to 40s at max difficulty. */
export const WEAPON_PICKUP_INTERVAL_MIN = 30 * 60
export const WEAPON_PICKUP_INTERVAL_MAX = 60 * 60
export const WEAPON_PICKUP_INTERVAL_MAX_LATE = 40 * 60
export const WEAPON_PICKUP_LIFE = 8 * 60

/** ~60fps. A wave of 1–2 cruisers about every 90s. */
export const CRUISER_INTERVAL_MIN = 80 * 60
export const CRUISER_INTERVAL_MAX = 100 * 60
export const CRUISER_HP = 40
/** Frames the cruiser spends warping in before it can act. */
export const CRUISER_SPAWN_FRAMES = 75
/** ~60fps. Rapid nose burst, then a pause. */
export const CRUISER_FIRE_GAP = 6
export const CRUISER_FIRE_PAUSE = 2 * 60
export const CRUISER_FIRE_COUNT = 8
export const CRUISER_BULLET_SPEED = 0.65 * UNIT
/** ~60fps. After a pause, launch a short burst from both flanks. */
export const CRUISER_WING_PAUSE = 4 * 60
export const CRUISER_WING_GAP = 10
export const CRUISER_WING_COUNT = 4

/** ~OpenGW 0.8 / 1.2 grid-units per frame. */
export const PLAYER_SPEED = 0.8 * UNIT
export const BULLET_SPEED = 1.2 * UNIT
export const HERO_RADIUS = 1.75 * UNIT
