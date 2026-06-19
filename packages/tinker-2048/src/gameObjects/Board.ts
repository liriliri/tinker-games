import Phaser from 'phaser'
import {
  COLORS,
  GRID_SIZE,
  TILE_BORDER_RADIUS,
  GAME_CONTAINER_BORDER_RADIUS,
} from '../game/constants'
import { GAME_CONTAINER_Y, FIELD_WIDTH } from '../layout'
import { s } from '../scale'
import { fillSmoothRoundedRect } from '../ui/drawRoundedRect'
import { boardBounds, computeTileSize, tilePosition } from './gridLayout'

export class Board {
  readonly tileSize: number
  readonly bounds: Phaser.Geom.Rectangle
  private gfx: Phaser.GameObjects.Graphics

  constructor(private scene: Phaser.Scene) {
    this.tileSize = computeTileSize()
    this.bounds = boardBounds()
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
