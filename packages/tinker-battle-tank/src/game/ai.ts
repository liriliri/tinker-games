import clamp from 'licia/clamp'
import filter from 'licia/filter'
import find from 'licia/find'
import random from 'licia/random'
import sample from 'licia/sample'
import { FIELD_BLOCKS } from './constants'
import { isTerrainBlocking, testCollide } from './battlefield'
import type { Battlefield } from './battlefield'
import type { Bullet, Direction, Tank } from './types'

export interface AiContext {
  field: Battlefield
  tanks: Tank[]
  bullets: Bullet[]
}

interface AiCommand {
  /** Direction the tank should face, or null to keep the current one. */
  direction: Direction | null
  fire: boolean
}

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']

const DIR_VECTORS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

/** How often the bot re-evaluates its plan, in milliseconds. */
const THINK_INTERVAL = 280
/** How long a bot may stay stuck before it looks for a new route. */
const STUCK_TIMEOUT = 700
/** Minimum delay between two shots, in milliseconds. */
const FIRE_COOLDOWN = 420
/** Chance per think tick of firing at nothing in particular. */
const IDLE_FIRE_CHANCE = 0.18
/** How long to keep committing to an axis while approaching a waypoint. */
const AXIS_COMMIT_MS = 320

interface Cell {
  col: number
  row: number
}

/**
 * A simple but effective tank AI.
 *
 * The bot navigates a 13x13 grid of cells: it picks a goal (the eagle base, a
 * player, or a random spot), finds a path with a breadth first search and then
 * walks it, firing whenever a target lines up.
 */
export class BotBrain {
  private path: Cell[] = []
  private pathIndex = 0
  private thinkTimer = 0
  private fireTimer = 0
  private stuckTimer = 0
  private lastX = 0
  private lastY = 0
  /** Held facing while escaping a jam — never re-rolled every frame. */
  private heldDirection: Direction | null = null
  private axisCommit: 'x' | 'y' | null = null
  private axisCommitTimer = 0
  private goal: Cell = { col: 6, row: 6 }

  constructor(private readonly tank: Tank) {
    this.lastX = tank.x
    this.lastY = tank.y
  }

  update(dt: number, ctx: AiContext): AiCommand {
    this.thinkTimer -= dt
    this.fireTimer -= dt
    if (this.axisCommitTimer > 0) this.axisCommitTimer -= dt

    this.updateStuck(dt)

    if (this.stuckTimer > STUCK_TIMEOUT) {
      this.heldDirection = this.pickEscapeDirection(ctx)
      this.path = []
      this.pathIndex = 0
      this.axisCommit = null
      this.stuckTimer = 0
      this.thinkTimer = THINK_INTERVAL
    } else if (this.thinkTimer <= 0) {
      this.thinkTimer = THINK_INTERVAL
      this.replan(ctx)
    }

    const direction = this.steer()
    const fire = this.shouldFire(ctx, direction)

    return { direction, fire }
  }

  /** Resets the plan, e.g. after the tank has been knocked around. */
  reset() {
    this.path = []
    this.pathIndex = 0
    this.stuckTimer = 0
    this.heldDirection = null
    this.axisCommit = null
  }

  private updateStuck(dt: number) {
    const moved =
      Math.abs(this.tank.x - this.lastX) + Math.abs(this.tank.y - this.lastY)
    if (moved < 1e-4) {
      this.stuckTimer += dt
    } else {
      this.stuckTimer = 0
      this.lastX = this.tank.x
      this.lastY = this.tank.y
      // Clear an escape hold only after we actually travelled a bit.
      if (moved > 0.2) {
        this.heldDirection = null
      }
    }
  }

  private replan(ctx: AiContext) {
    const goal = this.pickGoal(ctx)
    this.goal = goal
    const start = this.currentCell()
    const path = findPath(ctx, start, goal, this.tank.id)
    if (path && path.length > 1) {
      this.path = path
      this.pathIndex = 1
      this.heldDirection = null
      this.axisCommit = null
    } else if (!this.heldDirection) {
      this.path = []
      this.pathIndex = 0
      this.heldDirection = this.pickEscapeDirection(ctx)
    }
  }

  private currentCell(): Cell {
    return {
      col: clamp(Math.round(this.tank.x), 0, FIELD_BLOCKS - 1),
      row: clamp(Math.round(this.tank.y), 0, FIELD_BLOCKS - 1),
    }
  }

  private pickGoal(ctx: AiContext): Cell {
    const roll = random(0, 1, true)

    if (roll < 0.35 && ctx.field.eagle) {
      // Head for the eagle base.
      const spot = pickCellNear(ctx, ctx.field.eagle, 3, this.tank.id)
      if (spot) return spot
    }

    if (roll < 0.65) {
      // Hunt down a player tank.
      const target = find(
        ctx.tanks,
        (t) => t.side === 'player' && t.alive && t.id !== this.tank.id,
      )
      if (target) {
        const spot = pickCellNear(
          ctx,
          { x: target.x, y: target.y },
          2,
          this.tank.id,
          target.id,
        )
        if (spot) return spot
      }
    }

    return pickRandomCell(ctx, this.tank.id)
  }

  /** Prefers open neighbours; falls back to a random facing when boxed in. */
  private pickEscapeDirection(ctx: AiContext): Direction {
    const start = this.currentCell()
    const open = filter(DIRECTIONS, (direction) => {
      const [dx, dy] = DIR_VECTORS[direction]
      return isCellPassable(ctx, start.col + dx, start.row + dy, this.tank.id)
    })
    // Prefer not reversing immediately so we don't flicker on the same wall.
    const preferred = filter(
      open,
      (direction) => direction !== opposite(this.tank.direction),
    )
    const pool =
      preferred.length > 0
        ? preferred
        : open.length > 0
          ? open
          : filter(DIRECTIONS, (direction) => direction !== this.tank.direction)
    return sample(pool.length > 0 ? pool : DIRECTIONS, 1)[0]
  }

  /** Chooses the direction that advances the bot along its path. */
  private steer(): Direction | null {
    if (this.heldDirection) {
      return this.heldDirection
    }

    if (this.path.length === 0) {
      // Keep current facing until the next think/stuck tick assigns a hold.
      return this.tank.direction
    }

    const next = this.path[this.pathIndex]
    if (!next) {
      this.path = []
      return this.tank.direction
    }

    const dx = next.col - this.tank.x
    const dy = next.row - this.tank.y

    // Snap to the next waypoint when we are close enough.
    if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08) {
      this.pathIndex += 1
      this.axisCommit = null
      if (this.pathIndex >= this.path.length) {
        this.path = []
        return this.tank.direction
      }
      return this.steer()
    }

    // Commit to one axis so near-diagonal waypoints don't flip facing each frame.
    if (!this.axisCommit || this.axisCommitTimer <= 0) {
      this.axisCommit = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      this.axisCommitTimer = AXIS_COMMIT_MS
    } else if (this.axisCommit === 'x' && Math.abs(dx) < 0.08) {
      this.axisCommit = 'y'
      this.axisCommitTimer = AXIS_COMMIT_MS
    } else if (this.axisCommit === 'y' && Math.abs(dy) < 0.08) {
      this.axisCommit = 'x'
      this.axisCommitTimer = AXIS_COMMIT_MS
    }

    if (this.axisCommit === 'x') {
      return dx > 0 ? 'right' : 'left'
    }
    return dy > 0 ? 'down' : 'up'
  }

  private shouldFire(ctx: AiContext, direction: Direction | null): boolean {
    if (this.fireTimer > 0) return false

    const facing = direction ?? this.tank.direction
    const target = this.findTargetInLine(ctx, facing)

    if (target) {
      this.fireTimer = FIRE_COOLDOWN
      return true
    }

    // Shoot at the wall we are stuck against so that we can break through.
    if (this.stuckTimer > STUCK_TIMEOUT * 0.6) {
      this.fireTimer = FIRE_COOLDOWN
      return true
    }

    if (random(0, 1, true) < IDLE_FIRE_CHANCE) {
      this.fireTimer = FIRE_COOLDOWN
      return true
    }

    return false
  }

  /**
   * Looks for a player tank that sits in the same row or column with a clear
   * line of fire.
   */
  private findTargetInLine(ctx: AiContext, facing: Direction) {
    const [vx, vy] = DIR_VECTORS[facing]
    const tank = this.tank

    return (
      find(ctx.tanks, (other) => {
        if (!other.alive || other.side !== 'player' || other.id === tank.id) {
          return false
        }
        const dx = other.x - tank.x
        const dy = other.y - tank.y
        const aligned =
          (vx === 0 && Math.abs(dx) < 0.6 && Math.sign(dy) === vy) ||
          (vy === 0 && Math.abs(dy) < 0.6 && Math.sign(dx) === vx)
        return aligned && hasClearLine(ctx, tank.x, tank.y, other.x, other.y)
      }) ?? null
    )
  }
}

/** True when no terrain blocks the straight line between two points. */
function hasClearLine(
  ctx: AiContext,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  const steps = Math.ceil(
    Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)) * 4,
  )
  if (steps === 0) return true
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const x = fromX + (toX - fromX) * t
    const y = fromY + (toY - fromY) * t
    if (!isTerrainFree(ctx.field, x, y)) return false
  }
  return true
}

/** True when the single point (x, y) is not inside any solid terrain. */
function isTerrainFree(field: Battlefield, x: number, y: number) {
  return !isTerrainBlocking(field, {
    x,
    y,
    width: 0.001,
    height: 0.001,
  })
}

/** True when a tank can stand with its top-left corner at (col, row). */
function isCellPassable(
  ctx: AiContext,
  col: number,
  row: number,
  selfId: number,
  ignoreId = -1,
) {
  if (col < 0 || col >= FIELD_BLOCKS || row < 0 || row >= FIELD_BLOCKS)
    return false

  const rect = { x: col, y: row, width: 1, height: 1 }
  if (isTerrainBlocking(ctx.field, rect)) return false

  for (const tank of ctx.tanks) {
    if (!tank.alive || tank.id === selfId || tank.id === ignoreId) continue
    if (testCollide({ x: tank.x, y: tank.y, width: 1, height: 1 }, rect))
      return false
  }

  return true
}

/**
 * Breadth first search over the cell grid.
 *
 * Returns the path from `start` to `goal` (both included) or null when no
 * route exists.
 */
function findPath(
  ctx: AiContext,
  start: Cell,
  goal: Cell,
  selfId: number,
): Cell[] | null {
  if (start.col === goal.col && start.row === goal.row) return [start]

  const key = (col: number, row: number) => row * FIELD_BLOCKS + col
  const previous = new Int32Array(FIELD_BLOCKS * FIELD_BLOCKS).fill(-1)
  const visited = new Uint8Array(FIELD_BLOCKS * FIELD_BLOCKS)

  const queue: Cell[] = [start]
  visited[key(start.col, start.row)] = 1

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.col === goal.col && current.row === goal.row) {
      const path: Cell[] = []
      let node: Cell | undefined = current
      while (node) {
        path.unshift(node)
        if (node.col === start.col && node.row === start.row) break
        const prev: number = previous[key(node.col, node.row)]
        if (prev < 0) break
        node = {
          col: prev % FIELD_BLOCKS,
          row: Math.floor(prev / FIELD_BLOCKS),
        }
      }
      return path
    }

    for (const direction of DIRECTIONS) {
      const [dx, dy] = DIR_VECTORS[direction]
      const col = current.col + dx
      const row = current.row + dy
      if (col < 0 || col >= FIELD_BLOCKS || row < 0 || row >= FIELD_BLOCKS)
        continue
      const cellKey = key(col, row)
      if (visited[cellKey]) continue
      if (!isCellPassable(ctx, col, row, selfId)) continue
      visited[cellKey] = 1
      previous[cellKey] = key(current.col, current.row)
      queue.push({ col, row })
    }
  }

  return null
}

function opposite(direction: Direction): Direction {
  switch (direction) {
    case 'up':
      return 'down'
    case 'down':
      return 'up'
    case 'left':
      return 'right'
    default:
      return 'left'
  }
}

/** Picks a passable cell within `radius` of the given point. */
function pickCellNear(
  ctx: AiContext,
  point: { x: number; y: number },
  radius: number,
  selfId: number,
  ignoreId = -1,
): Cell | null {
  const centreCol = Math.round(point.x)
  const centreRow = Math.round(point.y)
  const candidates: Cell[] = []

  for (let row = centreRow - radius; row <= centreRow + radius; row += 1) {
    for (let col = centreCol - radius; col <= centreCol + radius; col += 1) {
      if (col < 0 || col >= FIELD_BLOCKS || row < 0 || row >= FIELD_BLOCKS)
        continue
      if (!isCellPassable(ctx, col, row, selfId, ignoreId)) continue
      candidates.push({ col, row })
    }
  }

  if (candidates.length === 0) return null
  return sample(candidates, 1)[0]
}

/** Picks a random passable cell. */
function pickRandomCell(ctx: AiContext, selfId: number): Cell {
  const candidates: Cell[] = []
  for (let row = 0; row < FIELD_BLOCKS; row += 1) {
    for (let col = 0; col < FIELD_BLOCKS; col += 1) {
      if (!isCellPassable(ctx, col, row, selfId)) continue
      candidates.push({ col, row })
    }
  }
  if (candidates.length === 0) return { col: 6, row: 6 }
  return sample(candidates, 1)[0]
}
