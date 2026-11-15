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
  /** -1 for enemy tanks. */
  playerIndex: number
  level: TankLevel
  hp: number
  /** Top-left corner, in cells. */
  x: number
  y: number
  direction: Direction
  moving: boolean
  /** ms until the tank may fire again. */
  cooldown: number
  /** ms while the tank cannot move. */
  frozenTimeout: number
  /** ms of shield protection left. */
  helmetDuration: number
  withPowerUp: boolean
  alive: boolean
  /** Turn / blocking reservation (may differ from x/y mid-move). */
  reservedX: number
  reservedY: number
  /** 0 = materialising, 1 = landed. */
  spawnProgress: number
  /** False while blinking after friendly fire. */
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
  /** Cells / second. */
  speed: number
  power: number
}

export interface PowerUp {
  id: number
  name: PowerUpName
  x: number
  y: number
  visible: boolean
  /** ms until the power-up despawns. */
  lifetime: number
}

export interface PlayerState {
  index: 0 | 1
  /**
   * Tanks waiting to spawn (excludes the active one).
   * Life is consumed at materialise time, matching the reference.
   */
  lives: number
  score: number
  kills: Record<TankLevel, number>
  activeTankId: number
  respawnTimer: number
  isSpawning: boolean
  /**
   * Level carried into the next stage when cleared with a living tank
   * (reference `reservedTank`).
   */
  reservedLevel: TankLevel | null
  /** Extra-life bonuses already granted this run. */
  lifeBonusMilestones: number
}
