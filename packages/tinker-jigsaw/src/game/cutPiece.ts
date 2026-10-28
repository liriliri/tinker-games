import max from 'licia/max'
import min from 'licia/min'
import { createCanvas } from '../lib/util'
import { TAB_JITTER, TAB_SIZE, type PieceCut, type TabCurve } from './jigsaw'

// Head reaches 3 * TAB_SIZE, jitter adds a little, and the stroke needs room past that.
const TAB_PAD_RATIO = 3 * TAB_SIZE + TAB_JITTER + 0.06

export function pieceTexture(id: number) {
  return `jigsaw-piece-${id}`
}

// Tabs follow the short side. A wide cell would otherwise grow them from the long edge.
function tabPad(cellW: number, cellH: number) {
  return Math.round(min(cellW, cellH) * TAB_PAD_RATIO)
}

export function padRatio(
  columns: number,
  rows: number,
  width: number,
  height: number,
) {
  const cellW = width / columns
  const cellH = height / rows
  const pad = tabPad(cellW, cellH)
  return {
    x: pad / cellW,
    y: pad / cellH,
  }
}

export function cutPiece(
  picture: HTMLCanvasElement,
  piece: PieceCut,
  columns: number,
  rows: number,
) {
  const cellW = picture.width / columns
  const cellH = picture.height / rows
  const pad = tabPad(cellW, cellH)
  const width = Math.round(cellW + pad * 2)
  const height = Math.round(cellH + pad * 2)
  const { canvas, ctx } = createCanvas(width, height)
  if (!ctx) return canvas

  const knob = min(cellW, cellH)
  const trace = () => {
    tracePiece(ctx, pad, pad, cellW, cellH, knob, piece.edges)
  }

  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
  ctx.shadowBlur = max(1, knob * 0.018)
  ctx.shadowOffsetX = max(0.3, knob * 0.006)
  ctx.shadowOffsetY = max(0.45, knob * 0.009)
  trace()
  ctx.fill()
  ctx.restore()

  ctx.save()
  trace()
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

  strokeBevel(ctx, trace, knob)

  return canvas
}

// A narrow cut: light on the upper-left face, shade on the lower-right.
function strokeBevel(
  ctx: CanvasRenderingContext2D,
  trace: () => void,
  knob: number,
) {
  const rim = max(1.15, knob * 0.015)
  const shift = max(0.35, knob * 0.0045)

  ctx.save()
  trace()
  ctx.clip()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  ctx.save()
  ctx.translate(shift, shift)
  ctx.lineWidth = rim
  ctx.strokeStyle = 'rgba(18, 12, 8, 0.42)'
  trace()
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.translate(-shift, -shift)
  ctx.lineWidth = rim * 0.8
  ctx.strokeStyle = 'rgba(255, 250, 244, 0.38)'
  trace()
  ctx.stroke()
  ctx.restore()
  ctx.restore()

  trace()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(32, 22, 16, 0.4)'
  ctx.lineWidth = max(0.6, knob * 0.003)
  ctx.stroke()
}

interface Point {
  x: number
  y: number
}

interface CurvePath {
  lineTo(x: number, y: number): void
  bezierCurveTo(
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ): void
}

interface SeamPath extends CurvePath {
  moveTo(x: number, y: number): void
}

// One stroke per shared edge, in the same curves the pieces use.
function traceSeams(
  path: SeamPath,
  columns: number,
  rows: number,
  cuts: PieceCut[],
  cellW: number,
  cellH: number,
) {
  const knob = min(cellW, cellH)
  for (const piece of cuts) {
    const x = piece.column * cellW
    const y = piece.row * cellH
    if (piece.row < rows - 1) {
      path.moveTo(x, y + cellH)
      traceEdge(
        path,
        x,
        y + cellH,
        x + cellW,
        y + cellH,
        piece.edges.bottom,
        knob,
      )
    }
    if (piece.column < columns - 1) {
      path.moveTo(x + cellW, y)
      traceEdge(
        path,
        x + cellW,
        y,
        x + cellW,
        y + cellH,
        piece.edges.right,
        knob,
      )
    }
  }
}

// Dim the ghost plate, then draw thin light seams so they read on pale and dark areas alike.
export function etchedGhostCanvas(
  picture: CanvasImageSource,
  columns: number,
  rows: number,
  cuts: PieceCut[],
  width: number,
  height: number,
) {
  const w = max(1, Math.round(width))
  const h = max(1, Math.round(height))
  const { canvas, ctx } = createCanvas(w, h)
  if (!ctx) return canvas

  ctx.filter = 'contrast(1.35)'
  ctx.drawImage(picture, 0, 0, w, h)
  ctx.filter = 'none'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
  ctx.fillRect(0, 0, w, h)

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255, 250, 244, 0.78)'
  ctx.lineWidth = 1.35
  ctx.beginPath()
  traceSeams(ctx, columns, rows, cuts, w / columns, h / rows)
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
  edges: PieceCut['edges'],
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
  ctx: CurvePath,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curve: TabCurve | null,
  knob: number,
) {
  if (!curve) {
    ctx.lineTo(x2, y2)
    return
  }

  const points = tabPoints(x1, y1, x2, y2, knob, curve)
  for (let index = 1; index < points.length; index += 3) {
    const c1 = points[index]
    const c2 = points[index + 1]
    const end = points[index + 2]
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y)
  }
}

// Canonical edges run left-to-right or top-to-bottom. The other piece walks the points backwards.
function tabPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  knob: number,
  curve: TabCurve,
) {
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1)
  const forward = horizontal ? x2 > x1 : y2 > y1
  const x0 = forward ? x1 : x2
  const y0 = forward ? y1 : y2
  const edge = horizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1)
  const unit = knob / edge
  const t = TAB_SIZE * unit
  const b = curve.b * unit
  const d = curve.d * unit
  const sign = curve.flip ? -1 : 1
  const at = (along: number, across: number): Point => {
    const delta = across * knob * sign
    if (horizontal) return { x: x0 + along * edge, y: y0 + delta }
    return { x: x0 + delta, y: y0 + along * edge }
  }
  const points = [
    at(0, 0),
    at(0.2, curve.a),
    at(0.5 + b + d, -TAB_SIZE + curve.c),
    at(0.5 - t + b, TAB_SIZE + curve.c),
    at(0.5 - 2 * t + b - d, 3 * TAB_SIZE + curve.c),
    at(0.5 + 2 * t + b - d, 3 * TAB_SIZE + curve.c),
    at(0.5 + t + b, TAB_SIZE + curve.c),
    at(0.5 + b + d, -TAB_SIZE + curve.c),
    at(0.8, curve.e),
    at(1, 0),
  ]
  return forward ? points : points.reverse()
}
