export type Direction = 'up' | 'down' | 'left' | 'right'

export type TankLevel = 'basic' | 'fast' | 'power' | 'armor'

export type TankSide = 'player' | 'bot'

export type PowerUpName =
  'tank' | 'star' | 'grenade' | 'timer' | 'helmet' | 'shovel'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Tank {
  id: number
  side: TankSide
  /** Index into the player list, or -1 for enemy tanks. */
  playerIndex: number
  level: TankLevel
  hp: number
  /** Top-left corner of the tank, in cells. */
  x: number
  y: number
  direction: Direction
  moving: boolean
  /** Milliseconds left before the tank may fire again. */
  cooldown: number
  /** Milliseconds left while the tank cannot move. */
  frozenTimeout: number
  /** Milliseconds left of shield protection. */
  helmetDuration: number
  /** Whether this tank drops a power-up when destroyed. */
  withPowerUp: boolean
  alive: boolean
  /** Reserved position used for turning and for blocking other tanks. */
  reservedX: number
  reservedY: number
  /** Spawn animation progress, 0 = hidden, 1 = fully visible. */
  spawnProgress: number
  /** Set while the tank is blinking after being hit by a teammate. */
  visible: boolean
}

export interface Bullet {
  id: number
  ownerId: number
  side: TankSide
  x: number
  y: number
  lastX: number
  lastY: number
  direction: Direction
  /** Cells per second. */
  speed: number
  power: number
}

export interface PowerUp {
  id: number
  name: PowerUpName
  x: number
  y: number
  visible: boolean
  /** Milliseconds left before the power-up disappears on its own. */
  lifetime: number
}

export interface PlayerState {
  index: 0 | 1
  /**
   * Remaining tanks waiting to spawn (excludes the active tank).
   * Matches the reference: life is consumed when a tank materialises.
   */
  lives: number
  score: number
  kills: Record<TankLevel, number>
  /** Id of the tank currently controlled by this player. */
  activeTankId: number
  /** Set while the player waits for a respawn. */
  respawnTimer: number
  /** True while a spawn flicker is in progress. */
  isSpawning: boolean
  /**
   * Level carried into the next stage when the previous stage was cleared
   * with a living tank (reference `reservedTank`).
   */
  reservedLevel: TankLevel | null
  /** How many extra-life bonuses have already been granted. */
  lifeBonusMilestones: number
}
