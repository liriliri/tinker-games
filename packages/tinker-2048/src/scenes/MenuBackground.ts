import Phaser from 'phaser'
import { TILE_BORDER_RADIUS, getTileStyle } from '../game/constants'
import { FIELD_WIDTH, GAME_HEIGHT } from '../layout'
import { s, sf } from '../scale'
import { fillSmoothRoundedRect } from '../ui/drawRoundedRect'
import { sharpTextStyle } from '../ui/sharpText'

const MAX_TILES = 14
const MIN_TILES = 9
const MAX_VALUE = 128
const TILE_DESIGN_SIZE = 36
const SPEEDS = [42, 52, 62, 72]

type Direction = 0 | 1 | 2 | 3 // up, right, down, left

interface BackgroundTile {
  container: Phaser.GameObjects.Container
  value: number
  direction: Direction
  speed: number
  half: number
  dead: boolean
}

export class MenuBackground {
  private tiles: BackgroundTile[] = []
  private width = 0
  private height = 0
  private spawnTimer = 0

  constructor(private scene: Phaser.Scene) {
    this.width = s(FIELD_WIDTH)
    this.height = s(GAME_HEIGHT)

    for (let i = 0; i < MIN_TILES; i++) {
      this.spawnTile()
    }

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this)
  }

  private randomValue() {
    return Math.random() < 0.88 ? 2 : 4
  }

  private randomDirection(): Direction {
    return Phaser.Math.Between(0, 3) as Direction
  }

  private velocity(direction: Direction, speed: number) {
    const map: Record<Direction, { vx: number; vy: number }> = {
      0: { vx: 0, vy: -speed },
      1: { vx: speed, vy: 0 },
      2: { vx: 0, vy: speed },
      3: { vx: -speed, vy: 0 },
    }
    return map[direction]
  }

  private isHorizontal(direction: Direction) {
    return direction === 1 || direction === 3
  }

  private isVertical(direction: Direction) {
    return direction === 0 || direction === 2
  }

  private reverseHorizontal(direction: Direction): Direction {
    if (direction === 1) return 3
    if (direction === 3) return 1
    return direction
  }

  private reverseVertical(direction: Direction): Direction {
    if (direction === 0) return 2
    if (direction === 2) return 0
    return direction
  }

  private createTileVisual(
    value: number,
    x: number,
    y: number,
    size: number,
    alpha: number,
  ) {
    const style = getTileStyle(value)
    const half = size / 2
    const container = this.scene.add.container(x, y)
    container.setDepth(-10)
    container.setAlpha(alpha)

    const bg = this.scene.add.graphics()
    fillSmoothRoundedRect(
      bg,
      -half,
      -half,
      size,
      size,
      s(TILE_BORDER_RADIUS),
      style.bg,
    )

    const fontDesign = Math.max(
      11,
      Math.round((style.fontSize * TILE_DESIGN_SIZE) / 110),
    )
    const text = this.scene.add
      .text(
        0,
        -1,
        String(value),
        sharpTextStyle(fontDesign, {
          color: style.text,
          fontStyle: 'bold',
          padding: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      )
      .setOrigin(0.5)

    container.add([bg, text])
    return container
  }

  private spawnTile(
    value = this.randomValue(),
    x?: number,
    y?: number,
    animate = false,
  ) {
    if (this.aliveTiles().length >= MAX_TILES) return

    const size = s(TILE_DESIGN_SIZE)
    const half = size / 2
    const margin = half + s(4)
    const spawnX = x ?? Phaser.Math.Between(margin, this.width - margin)
    const spawnY = y ?? Phaser.Math.Between(margin, this.height - margin)
    const direction = this.randomDirection()
    const speed = sf(Phaser.Math.RND.pick(SPEEDS))

    const container = this.createTileVisual(
      value,
      spawnX,
      spawnY,
      size,
      0.18 + Math.random() * 0.14,
    )

    const tile: BackgroundTile = {
      container,
      value,
      direction,
      speed,
      half,
      dead: false,
    }
    this.tiles.push(tile)

    if (animate) {
      container.setScale(0.4)
      this.scene.tweens.add({
        targets: container,
        scale: 1,
        duration: 180,
        ease: 'Back.easeOut',
      })
    }
  }

  private aliveTiles() {
    return this.tiles.filter((tile) => !tile.dead)
  }

  private cleanupDead() {
    for (const tile of this.tiles) {
      if (tile.dead) tile.container.destroy()
    }
    this.tiles = this.tiles.filter((tile) => !tile.dead)
  }

  private boundsOverlap(a: BackgroundTile, b: BackgroundTile) {
    const dx = Math.abs(a.container.x - b.container.x)
    const dy = Math.abs(a.container.y - b.container.y)
    return dx < a.half + b.half && dy < a.half + b.half
  }

  private separate(a: BackgroundTile, b: BackgroundTile) {
    const dx = b.container.x - a.container.x
    const dy = b.container.y - a.container.y
    if (dx === 0 && dy === 0) {
      a.container.x -= 1
      return
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      const push = a.half + b.half - Math.abs(dx) + 1
      const dir = dx > 0 ? -1 : 1
      a.container.x += dir * push * 0.5
      b.container.x -= dir * push * 0.5
      return
    }

    const push = a.half + b.half - Math.abs(dy) + 1
    const dir = dy > 0 ? -1 : 1
    a.container.y += dir * push * 0.5
    b.container.y -= dir * push * 0.5
  }

  private bounce(a: BackgroundTile, b: BackgroundTile) {
    this.separate(a, b)

    const dx = Math.abs(a.container.x - b.container.x)
    const dy = Math.abs(a.container.y - b.container.y)
    const horizontalHit = dx >= dy

    if (horizontalHit) {
      if (this.isHorizontal(a.direction)) {
        a.direction = this.reverseHorizontal(a.direction)
      } else {
        a.direction = a.container.x < b.container.x ? 3 : 1
      }

      if (this.isHorizontal(b.direction)) {
        b.direction = this.reverseHorizontal(b.direction)
      } else {
        b.direction = b.container.x < a.container.x ? 3 : 1
      }
      return
    }

    if (this.isVertical(a.direction)) {
      a.direction = this.reverseVertical(a.direction)
    } else {
      a.direction = a.container.y < b.container.y ? 0 : 2
    }

    if (this.isVertical(b.direction)) {
      b.direction = this.reverseVertical(b.direction)
    } else {
      b.direction = b.container.y < a.container.y ? 0 : 2
    }
  }

  private merge(a: BackgroundTile, b: BackgroundTile) {
    const x = (a.container.x + b.container.x) / 2
    const y = (a.container.y + b.container.y) / 2
    const mergedValue = a.value * 2
    const alpha = Math.min(
      0.42,
      Math.max(a.container.alpha, b.container.alpha) + 0.04,
    )

    a.dead = true
    b.dead = true
    a.container.destroy()
    b.container.destroy()

    const size = s(TILE_DESIGN_SIZE + Math.log2(mergedValue) * 2)
    const half = size / 2
    const container = this.createTileVisual(mergedValue, x, y, size, alpha)
    const direction = this.randomDirection()
    const speed = sf(Phaser.Math.RND.pick(SPEEDS))

    container.setScale(0.5)
    this.scene.tweens.add({
      targets: container,
      scale: 1.08,
      duration: 120,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => container.setScale(1),
    })

    this.tiles.push({
      container,
      value: mergedValue,
      direction,
      speed,
      half,
      dead: false,
    })
  }

  private handleCollisions() {
    const alive = this.aliveTiles()

    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]
      if (a.dead) continue

      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j]
        if (b.dead || !this.boundsOverlap(a, b)) continue

        if (a.value === b.value && a.value * 2 <= MAX_VALUE) {
          this.merge(a, b)
          this.cleanupDead()
          return
        }

        this.bounce(a, b)
      }
    }
  }

  private moveTile(tile: BackgroundTile, delta: number) {
    const dt = delta / 1000
    const { vx, vy } = this.velocity(tile.direction, tile.speed)
    let x = tile.container.x + vx * dt
    let y = tile.container.y + vy * dt

    const min = tile.half
    const maxX = this.width - tile.half
    const maxY = this.height - tile.half

    if (x < min) {
      x = min
      if (tile.direction === 3) tile.direction = 1
    } else if (x > maxX) {
      x = maxX
      if (tile.direction === 1) tile.direction = 3
    }

    if (y < min) {
      y = min
      if (tile.direction === 0) tile.direction = 2
    } else if (y > maxY) {
      y = maxY
      if (tile.direction === 2) tile.direction = 0
    }

    tile.container.setPosition(x, y)
  }

  private update(_time: number, delta: number) {
    for (const tile of this.aliveTiles()) {
      this.moveTile(tile, delta)
    }

    this.handleCollisions()

    this.spawnTimer += delta
    if (this.spawnTimer > 1800 && this.aliveTiles().length < MIN_TILES) {
      this.spawnTimer = 0
      this.spawnTile(this.randomValue(), undefined, undefined, true)
    }

    if (Math.random() < 0.0008 * delta) {
      const alive = this.aliveTiles()
      if (alive.length > 0) {
        const tile = Phaser.Math.RND.pick(alive)
        tile.direction = this.randomDirection()
      }
    }
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this)
    for (const tile of this.tiles) {
      tile.container.destroy()
    }
    this.tiles = []
  }
}
