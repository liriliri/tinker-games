import max from 'licia/max'
import min from 'licia/min'
import { PICTURE_HEIGHT, PICTURE_WIDTH } from './paintPicture'
import type { PieceCut, PieceEdges } from './Jigsaw'

const TAB_PAD_RATIO = 0.34

export function pieceTexture(id: number) {
  return `jigsaw-piece-${id}`
}

// Tabs follow the short side. A 16:9 cell would otherwise grow them from the long edge.
function tabPad(cellW: number, cellH: number) {
  return Math.round(min(cellW, cellH) * TAB_PAD_RATIO)
}

export function padRatio(grid: number) {
  const cellW = PICTURE_WIDTH / grid
  const cellH = PICTURE_HEIGHT / grid
  const pad = tabPad(cellW, cellH)
  return {
    x: pad / cellW,
    y: pad / cellH,
  }
}

export function cutPiece(
  picture: HTMLCanvasElement,
  piece: PieceCut,
  grid: number,
) {
  const cellW = picture.width / grid
  const cellH = picture.height / grid
  const pad = tabPad(cellW, cellH)
  const width = Math.round(cellW + pad * 2)
  const height = Math.round(cellH + pad * 2)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const knob = min(cellW, cellH)
  ctx.save()
  tracePiece(ctx, pad, pad, cellW, cellH, knob, piece.edges)
  ctx.clip()
  ctx.drawImage(
    picture,
    piece.column * cellW - pad,
    piece.row * cellH - pad,
    width,
    height,
    0,
    0,
    width,
    height,
  )
  ctx.restore()

  tracePiece(ctx, pad, pad, cellW, cellH, knob, piece.edges)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(26, 16, 14, 0.88)'
  ctx.lineWidth = max(1.5, knob * 0.01)
  ctx.stroke()

  return canvas
}

function tracePiece(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  knob: number,
  edges: PieceEdges,
) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  traceEdge(ctx, x, y, x + cellW, y, edges.top, knob)
  traceEdge(ctx, x + cellW, y, x + cellW, y + cellH, edges.right, knob)
  traceEdge(ctx, x + cellW, y + cellH, x, y + cellH, edges.bottom, knob)
  traceEdge(ctx, x, y + cellH, x, y, edges.left, knob)
  ctx.closePath()
}

function traceEdge(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  edge: number,
  knob: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  if (edge === 0) {
    ctx.lineTo(x2, y2)
    return
  }

  // Clockwise edges use (dy, -dx) as the outward normal, so a positive tab sticks out.
  const length = Math.hypot(dx, dy)
  const ox = (dy / length) * edge
  const oy = (-dx / length) * edge
  const at = (t: number) => ({
    x: x1 + dx * t,
    y: y1 + dy * t,
  })
  const radius = knob * 0.16
  const center = {
    x: x1 + dx * 0.5 + ox * knob * 0.18,
    y: y1 + dy * 0.5 + oy * knob * 0.18,
  }
  const ux = dx / length
  const uy = dy / length
  const spread = 2.15
  const side = (turn: number) => ({
    x:
      center.x +
      (ox * Math.cos(spread) + ux * turn * Math.sin(spread)) * radius,
    y:
      center.y +
      (oy * Math.cos(spread) + uy * turn * Math.sin(spread)) * radius,
  })
  const start = side(-1)
  const end = side(1)
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x)
  const tipAngle = Math.atan2(oy, ox)
  const anticlockwise = !sweepHas(startAngle, endAngle, tipAngle, false)
  // Neck meets the arc, so the piece tracing this edge backwards shares the seam.
  const neck = (radius * Math.sin(spread)) / length

  ctx.lineTo(at(0.5 - neck).x, at(0.5 - neck).y)
  ctx.lineTo(start.x, start.y)
  ctx.arc(center.x, center.y, radius, startAngle, endAngle, anticlockwise)
  ctx.lineTo(at(0.5 + neck).x, at(0.5 + neck).y)
  ctx.lineTo(x2, y2)
}

function sweepHas(
  start: number,
  end: number,
  tip: number,
  anticlockwise: boolean,
) {
  const wrap = (angle: number) => {
    const turn = angle % (Math.PI * 2)
    return turn < 0 ? turn + Math.PI * 2 : turn
  }
  const from = wrap(start)
  const to = wrap(end)
  const target = wrap(tip)
  if (!anticlockwise) {
    return from <= to
      ? target >= from && target <= to
      : target >= from || target <= to
  }
  return from >= to
    ? target <= from && target >= to
    : target <= from || target >= to
}
