import Phaser from 'phaser'

function fillTriangle(
  gfx: Phaser.GameObjects.Graphics,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  color: number,
) {
  gfx.fillStyle(color, 1)
  gfx.fillTriangle(ax, ay, bx, by, cx, cy)
}

/** Split a b×b corner square on the BL→TR diagonal into two triangles. */
function drawCornerSquare(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  b: number,
  upperLeftColor: number,
  lowerRightColor: number,
) {
  fillTriangle(gfx, x, y, x + b, y, x, y + b, upperLeftColor)
  fillTriangle(gfx, x + b, y + b, x + b, y, x, y + b, lowerRightColor)
}

export function drawBevelBorder(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  bevel: number,
  fillColor: number,
  lightColor: number,
  darkColor: number,
  raised: boolean,
  drawFill = true,
) {
  const b = Math.max(1, Math.round(bevel))
  const x2 = x + width
  const y2 = y + height
  const hi = raised ? lightColor : darkColor
  const lo = raised ? darkColor : lightColor

  if (width <= b * 2 || height <= b * 2) {
    if (drawFill) {
      gfx.fillStyle(fillColor, 1)
      gfx.fillRect(x, y, width, height)
    }
    return
  }

  drawCornerSquare(gfx, x, y, b, hi, hi)
  drawCornerSquare(gfx, x2 - b, y, b, hi, lo)
  drawCornerSquare(gfx, x, y2 - b, b, hi, lo)
  drawCornerSquare(gfx, x2 - b, y2 - b, b, lo, lo)

  gfx.fillStyle(hi, 1)
  gfx.fillRect(x + b, y, width - b * 2, b)
  gfx.fillRect(x, y + b, b, height - b * 2)

  gfx.fillStyle(lo, 1)
  gfx.fillRect(x + b, y2 - b, width - b * 2, b)
  gfx.fillRect(x2 - b, y + b, b, height - b * 2)

  if (drawFill) {
    gfx.fillStyle(fillColor, 1)
    gfx.fillRect(x + b, y + b, width - b * 2, height - b * 2)
  }
}

export function drawCoverCell(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  fillColor: number,
  lightColor: number,
  darkColor: number,
  border: number,
) {
  drawBevelBorder(
    gfx,
    x,
    y,
    size,
    size,
    border,
    fillColor,
    lightColor,
    darkColor,
    true,
  )
}

export function drawOpenCell(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  fillColor: number,
  darkColor: number,
  border: number,
  edges: { top?: boolean; left?: boolean } = {},
) {
  const b = Math.max(1, Math.round(border))
  const half = b / 2

  gfx.fillStyle(fillColor, 1)
  gfx.fillRect(x, y, size, size)

  gfx.fillStyle(darkColor, 1)
  if (edges.top) {
    gfx.fillRect(x, y - half, size, b)
  }
  if (edges.left) {
    gfx.fillRect(x - half, y, b, size)
  }
}
