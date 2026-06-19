import Phaser from 'phaser'
import { COLORS, FRAME_BEVEL_SIZE } from '../game/constants'
import { s } from '../scale'
import { drawSunkenBorder, drawSunkenRect } from '../ui/drawRoundedRect'
import { boardBounds, boardFrameRect, computeCellSize } from './gridLayout'

const FRAME_BORDER_DEPTH = 5

export class BoardFrame {
  readonly cellSize: number
  readonly bounds: Phaser.Geom.Rectangle
  private fillGfx: Phaser.GameObjects.Graphics
  private borderGfx: Phaser.GameObjects.Graphics

  constructor(private scene: Phaser.Scene) {
    this.cellSize = computeCellSize()
    this.bounds = boardBounds(this.cellSize)
    this.fillGfx = scene.add.graphics()
    this.borderGfx = scene.add.graphics().setDepth(FRAME_BORDER_DEPTH)
    this.draw()
  }

  destroy() {
    this.fillGfx.destroy()
    this.borderGfx.destroy()
  }

  private draw() {
    const frame = boardFrameRect(this.cellSize)
    const bevel = s(FRAME_BEVEL_SIZE)

    this.fillGfx.clear()
    this.borderGfx.clear()

    drawSunkenRect(
      this.fillGfx,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      COLORS.gameContainer,
      COLORS.borderLight,
      COLORS.borderDark,
      bevel,
    )

    drawSunkenBorder(
      this.borderGfx,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      COLORS.borderLight,
      COLORS.borderDark,
      bevel,
    )
  }
}
