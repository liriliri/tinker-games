import Phaser from 'phaser'

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
