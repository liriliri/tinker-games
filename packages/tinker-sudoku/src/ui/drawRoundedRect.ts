import Phaser from 'phaser'
import { s } from '../lib/scale'

export function fillSmoothRoundedRect(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: number,
) {
  gfx.fillStyle(color, 1)
  gfx.fillRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, radius)
}

export function strokeSmoothRoundedRect(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: number,
  alpha = 1,
  lineWidth = 1,
) {
  gfx.lineStyle(lineWidth, color, alpha)
  gfx.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, radius)
}

export function drawElevatedPanel(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor: number,
  borderColor: number,
  borderWidth = 1.5,
) {
  gfx.fillStyle(0x1e3a5f, 0.08)
  gfx.fillRoundedRect(x + s(1), y + s(2), width, height, radius)

  fillSmoothRoundedRect(gfx, x, y, width, height, radius, fillColor)
  strokeSmoothRoundedRect(
    gfx,
    x,
    y,
    width,
    height,
    radius,
    borderColor,
    1,
    borderWidth,
  )
}
