import Phaser from 'phaser'
import { COLORS } from '../game/constants'

export const STAR_OUTER = 4.2
export const STAR_INNER = 1.7
export const STAR_GAP = 9

export function traceStar(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  outer: number,
  inner: number,
) {
  graphics.beginPath()
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (point * Math.PI) / 5
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (point === 0) graphics.moveTo(px, py)
    else graphics.lineTo(px, py)
  }
  graphics.closePath()
}

export function fillStar(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  outer: number,
  inner: number,
  lineWidth: number,
  lineAlpha: number,
  fillColor = COLORS.star,
) {
  traceStar(graphics, x, y, outer, inner)
  graphics.fillStyle(fillColor, 1)
  graphics.fillPath()
  traceStar(graphics, x, y, outer, inner)
  graphics.lineStyle(lineWidth, COLORS.inkMark, lineAlpha)
  graphics.strokePath()
}
