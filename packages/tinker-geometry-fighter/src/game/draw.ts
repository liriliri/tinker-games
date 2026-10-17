export function path(
  ctx: CanvasRenderingContext2D,
  xpts: number[],
  ypts: number[],
  size: number,
) {
  ctx.moveTo(xpts[0] * size, ypts[0] * size)
  for (let i = 1; i < xpts.length; i++) {
    ctx.lineTo(xpts[i] * size, ypts[i] * size)
  }
  ctx.lineTo(xpts[0] * size, ypts[0] * size)
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  vertical = false,
) {
  ctx.moveTo(x, y)
  ctx.lineTo(x + (vertical ? 0 : width), y + (vertical ? width : 0))
}

export function getAngle(
  p1: [number, number] | number[],
  p2: [number, number] | number[],
) {
  return Math.atan2(p2[1] - p1[1], p2[0] - p1[0])
}
