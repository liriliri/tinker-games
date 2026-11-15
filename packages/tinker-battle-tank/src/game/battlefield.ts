import trim from 'licia/trim'
import {
  BRICK_GRID,
  BRICK_SIZE,
  FIELD_BLOCKS,
  FIELD_SIZE,
  STEEL_GRID,
  STEEL_SIZE,
} from './constants'
import type { StageDefinition } from './stages'
import type { Rect } from './types'

/** Collision test ported from the reference: symmetric-ish AABB overlap. */
export function testCollide(subject: Rect, object: Rect, threshold = 0) {
  return (
    between(
      subject.x - object.width,
      object.x,
      subject.x + subject.width,
      threshold,
    ) &&
    between(
      subject.y - object.height,
      object.y,
      subject.y + subject.height,
      threshold,
    )
  )
}

function between(min: number, value: number, max: number, threshold = 0) {
  return min - threshold <= value && value <= max + threshold
}

export function isInField(rect: Rect) {
  return (
    between(0, rect.x, FIELD_SIZE - rect.width) &&
    between(0, rect.y, FIELD_SIZE - rect.height)
  )
}

/**
 * Expands the single hex digit used by the original maps into a 16 bit mask
 * describing which quarter cells of a block are filled.
 */
function parseBrickBits(code: string) {
  if (code.length === 1) {
    const short = parseInt(code, 16)
    let long = 0
    if (0b0001 & short) long += 0xf000
    if (0b0010 & short) long += 0x0f00
    if (0b0100 & short) long += 0x00f0
    if (0b1000 & short) long += 0x000f
    return long
  }
  if (code.length === 4) {
    return parseInt(code, 16)
  }
  return 0
}

/**
 * Maps a quarter cell inside a block to its bit index in the 16 bit mask.
 * The layout matches the original Battle City maps.
 */
function brickBitIndex(row: number, col: number) {
  const part = (row >= 2 ? 2 : 0) + (col >= 2 ? 1 : 0)
  const bit = (row % 2) * 2 + (col % 2)
  const base = [12, 8, 4, 0][part]
  return base + bit
}

/**
 * The mutable battlefield: terrain plus the eagle.
 *
 * All coordinates are in cells, with the origin at the top left corner and
 * `y` growing downwards.
 */
export class Battlefield {
  /** Quarter-cell brick tiles, indexed by `row * BRICK_GRID + col`. */
  readonly bricks = new Uint8Array(BRICK_GRID * BRICK_GRID)
  /** Half-cell steel tiles, indexed by `row * STEEL_GRID + col`. */
  readonly steels = new Uint8Array(STEEL_GRID * STEEL_GRID)
  /** Whole-cell terrain layers. */
  readonly rivers = new Uint8Array(FIELD_BLOCKS * FIELD_BLOCKS)
  readonly snows = new Uint8Array(FIELD_BLOCKS * FIELD_BLOCKS)
  readonly forests = new Uint8Array(FIELD_BLOCKS * FIELD_BLOCKS)
  /** Top-left corner of the eagle, in cells. */
  eagle: { x: number; y: number } | null = null

  static fromStage(stage: StageDefinition) {
    const field = new Battlefield()
    field.parseMap(stage.map)
    return field
  }

  private parseMap(map: string[]) {
    for (let row = 0; row < FIELD_BLOCKS; row += 1) {
      const cells = trim(map[row].toLowerCase()).split(/\s+/)
      for (let col = 0; col < FIELD_BLOCKS; col += 1) {
        const item = cells[col] ?? 'X'
        const kind = item[0]
        if (kind === 'b') {
          const bits = parseBrickBits(item.substring(1))
          for (let r = 0; r < 4; r += 1) {
            for (let c = 0; c < 4; c += 1) {
              if ((bits >> brickBitIndex(r, c)) & 1) {
                this.bricks[(row * 4 + r) * BRICK_GRID + (col * 4 + c)] = 1
              }
            }
          }
        } else if (kind === 't') {
          const bits = parseInt(item.substring(1), 16)
          if (bits & 0b0001) this.steels[2 * row * STEEL_GRID + 2 * col] = 1
          if (bits & 0b0010) this.steels[2 * row * STEEL_GRID + 2 * col + 1] = 1
          if (bits & 0b0100)
            this.steels[(2 * row + 1) * STEEL_GRID + 2 * col] = 1
          if (bits & 0b1000)
            this.steels[(2 * row + 1) * STEEL_GRID + 2 * col + 1] = 1
        } else if (kind === 'r') {
          this.rivers[row * FIELD_BLOCKS + col] = 1
        } else if (kind === 'f') {
          this.forests[row * FIELD_BLOCKS + col] = 1
        } else if (kind === 's') {
          this.snows[row * FIELD_BLOCKS + col] = 1
        } else if (kind === 'e') {
          this.eagle = { x: col, y: row }
        }
      }
    }
  }

  brickRect(index: number): Rect {
    const row = Math.floor(index / BRICK_GRID)
    const col = index % BRICK_GRID
    return {
      x: col * BRICK_SIZE,
      y: row * BRICK_SIZE,
      width: BRICK_SIZE,
      height: BRICK_SIZE,
    }
  }

  steelRect(index: number): Rect {
    const row = Math.floor(index / STEEL_GRID)
    const col = index % STEEL_GRID
    return {
      x: col * STEEL_SIZE,
      y: row * STEEL_SIZE,
      width: STEEL_SIZE,
      height: STEEL_SIZE,
    }
  }

  cellRect(index: number): Rect {
    const row = Math.floor(index / FIELD_BLOCKS)
    const col = index % FIELD_BLOCKS
    return { x: col, y: row, width: 1, height: 1 }
  }

  eagleRect(): Rect | null {
    if (!this.eagle) return null
    return { x: this.eagle.x, y: this.eagle.y, width: 1, height: 1 }
  }

  forEachBrick(rect: Rect, visit: (index: number) => void) {
    const col1 = Math.max(0, Math.floor(rect.x / BRICK_SIZE))
    const col2 = Math.min(
      BRICK_GRID - 1,
      Math.floor((rect.x + rect.width) / BRICK_SIZE),
    )
    const row1 = Math.max(0, Math.floor(rect.y / BRICK_SIZE))
    const row2 = Math.min(
      BRICK_GRID - 1,
      Math.floor((rect.y + rect.height) / BRICK_SIZE),
    )
    for (let row = row1; row <= row2; row += 1) {
      for (let col = col1; col <= col2; col += 1) {
        visit(row * BRICK_GRID + col)
      }
    }
  }

  forEachSteel(rect: Rect, visit: (index: number) => void) {
    const col1 = Math.max(0, Math.floor(rect.x / STEEL_SIZE))
    const col2 = Math.min(
      STEEL_GRID - 1,
      Math.floor((rect.x + rect.width) / STEEL_SIZE),
    )
    const row1 = Math.max(0, Math.floor(rect.y / STEEL_SIZE))
    const row2 = Math.min(
      STEEL_GRID - 1,
      Math.floor((rect.y + rect.height) / STEEL_SIZE),
    )
    for (let row = row1; row <= row2; row += 1) {
      for (let col = col1; col <= col2; col += 1) {
        visit(row * STEEL_GRID + col)
      }
    }
  }

  forEachCell(rect: Rect, visit: (index: number) => void) {
    const col1 = Math.max(0, Math.floor(rect.x))
    const col2 = Math.min(FIELD_BLOCKS - 1, Math.floor(rect.x + rect.width))
    const row1 = Math.max(0, Math.floor(rect.y))
    const row2 = Math.min(FIELD_BLOCKS - 1, Math.floor(rect.y + rect.height))
    for (let row = row1; row <= row2; row += 1) {
      for (let col = col1; col <= col2; col += 1) {
        visit(row * FIELD_BLOCKS + col)
      }
    }
  }

  destroyBrick(index: number) {
    this.bricks[index] = 0
  }

  /**
   * The region the shovel power-up fortifies: a 2×2 cell window centred on the
   * eagle (reference: 32×32 px minus 1 px so edges do not spill).
   */
  eagleSurroundingBox() {
    if (!this.eagle) return null
    return {
      x: this.eagle.x - 0.5,
      y: this.eagle.y - 0.5,
      width: 2 - 1 / 16,
      height: 2 - 1 / 16,
    }
  }
}

export function tankRect(x: number, y: number): Rect {
  return { x, y, width: 1, height: 1 }
}

export function bulletRect(x: number, y: number): Rect {
  return { x, y, width: 3 / 16, height: 3 / 16 }
}
