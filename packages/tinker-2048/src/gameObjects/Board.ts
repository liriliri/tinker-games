import Phaser from 'phaser'
import {
  GAME_CONTAINER_BORDER_RADIUS,
  GAME_CONTAINER_Y,
  FIELD_WIDTH,
  GRID_SIZE,
  TILE_BORDER_RADIUS,
} from '../lib/layout'
import { s } from '../lib/scale'
import { fillSmoothRoundedRect } from '../lib/util'
import { COLORS } from '../ui/constants'
import { computeTileSize, tilePosition } from './gridLayout'

export class Board {
  readonly tileSize: number
  private gfx: Phaser.GameObjects.Graphics

  constructor(private scene: Phaser.Scene) {
    this.tileSize = computeTileSize()
    this.gfx = scene.add.graphics()
    this.draw()
  }

  destroy() {
    this.gfx.destroy()
  }

  private draw() {
    this.gfx.clear()
    fillSmoothRoundedRect(
      this.gfx,
      0,
      s(GAME_CONTAINER_Y),
      s(FIELD_WIDTH),
      s(FIELD_WIDTH),
      s(GAME_CONTAINER_BORDER_RADIUS),
      COLORS.gameContainer,
    )

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        const pos = tilePosition({ x, y }, this.tileSize)
        fillSmoothRoundedRect(
          this.gfx,
          pos.x,
          pos.y,
          this.tileSize,
          this.tileSize,
          s(TILE_BORDER_RADIUS),
          COLORS.cell,
        )
      }
    }
  }
}
