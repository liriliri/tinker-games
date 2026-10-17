import { setContextAttribute } from './colors'
import { getFontFamily } from '../lib/i18n'

const MAP_LETTERS = "0123456789?abcdefghijklmnopqrstuvwxyz .-'/"
const LETTERS = [
  8767, 518, 1115, 1039, 1126, 1133, 1149, 7, 1151, 1135, 5123, 1143, 5391, 57,
  4367, 121, 113, 1085, 1142, 4361, 30, 2672, 56, 694, 2230, 63, 1139, 2111,
  3187, 1133, 4353, 62, 8752, 10294, 10880, 4736, 8713, 0, 16, 1088, 256, 8704,
]

function drawSegment(
  ctx: CanvasRenderingContext2D,
  xi: number,
  yi: number,
  offsetX: number,
  offsetY: number,
) {
  ctx.moveTo(xi, yi)
  ctx.lineTo(xi + offsetX, yi + offsetY)
}

function drawLetter(
  ctx: CanvasRenderingContext2D,
  letter: number,
  x: number,
  y: number,
  size: number,
) {
  const size4 = size - 4
  const size24 = size / 2 - 4
  if (letter & 1) drawSegment(ctx, x + 2, y - 1, size4, 0)
  if (letter & 2) drawSegment(ctx, size + x + 1, y, 0, size - 1)
  if (letter & 4) drawSegment(ctx, size + x + 1, size + y + 1, 0, size - 1)
  if (letter & 8) drawSegment(ctx, x + 2, size * 2 + y + 1, size4, 0)
  if (letter & 16) drawSegment(ctx, x - 1, y + size + 1, 0, size - 1)
  if (letter & 32) drawSegment(ctx, x - 1, y, 0, size - 1)
  if (letter & 64) drawSegment(ctx, x + 2, size + y, size24, 0)
  if (letter & 128) drawSegment(ctx, x + 2, y + 2, size24, size4)
  if (letter & 256) drawSegment(ctx, size / 2 + x, y + 2, 0, size4)
  if (letter & 512) drawSegment(ctx, size + x - 2, y + 2, -size24, size4)
  if (letter & 1024) drawSegment(ctx, size / 2 + x + 2, size + y, size24, 0)
  if (letter & 2048)
    drawSegment(ctx, size / 2 + x + 2, size + y + 2, size24, size4)
  if (letter & 4096) drawSegment(ctx, size / 2 + x, size + y + 2, 0, size4)
  if (letter & 8192) drawSegment(ctx, x + 2, size * 2 + y - 2, size24, 4 - size)
}

function drawWordRight(
  ctx: CanvasRenderingContext2D,
  word: string,
  x: number,
  y: number,
  size: number,
  colorIndex: number,
  spacing: number,
) {
  ctx.save()
  ctx.beginPath()
  setContextAttribute(ctx, colorIndex)
  for (let i = 0; i < word.length; i++) {
    const glyph = LETTERS[MAP_LETTERS.indexOf(word[i])] ?? 0
    drawLetter(ctx, glyph, x - (size + spacing) * (word.length - i), y, size)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function drawWordCenter(
  ctx: CanvasRenderingContext2D,
  word: string,
  x: number,
  y: number,
  size: number,
  colorIndex: number,
  spacing: number,
) {
  drawWordRight(
    ctx,
    word,
    x + ((size + spacing) * word.length) / 2,
    y,
    size,
    colorIndex,
    spacing,
  )
}

function canUseSegmentFont(word: string) {
  const lower = word.toLowerCase()
  for (let i = 0; i < lower.length; i++) {
    if (MAP_LETTERS.indexOf(lower[i]) === -1) return false
  }
  return true
}

/** Light CJK HUD text — thin weight, soft accent fringe. */
function displayCanvasWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  x: number,
  y: number,
  size: number,
  colorIndexes: number[],
  side: number,
) {
  const fontSize = Math.max(16, Math.round(size * 2))
  const tracking = size >= 24 ? 0.12 : size >= 14 ? 0.08 : 0.05
  const ty = y + size * 1.05
  const accent = colorIndexes.some((c) => c === 16 || c === 10 || c === 2)
    ? 'rgba(255,107,138,0.35)'
    : colorIndexes.some((c) => c === 13 || c === 6)
      ? 'rgba(72,255,206,0.35)'
      : 'rgba(126,200,255,0.35)'

  ctx.save()
  ctx.font = `300 ${fontSize}px ${getFontFamily()}`
  ctx.textAlign = side === 1 ? 'right' : 'center'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = `${tracking}em`
  ctx.lineJoin = 'round'

  ctx.strokeStyle = accent
  ctx.lineWidth = Math.max(0.5, size * 0.025)
  ctx.strokeText(word, x, ty)

  ctx.fillStyle = 'rgba(230,240,255,0.92)'
  ctx.fillText(word, x, ty)

  ctx.restore()
}

/** Title, score, and multiplier stay on the segment face. */
export function displaySegmentWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  x: number,
  y: number,
  size: number,
  colorIndexes: number[],
  side = 0,
) {
  if (!canUseSegmentFont(word)) {
    displayCanvasWord(ctx, word, x, y, size, colorIndexes, side)
    return
  }

  const spacing = size < 25 ? 10 : size * 0.5
  const width = colorIndexes.length
  const align = side === 1 ? drawWordRight : drawWordCenter
  const lower = word.toLowerCase()
  for (let i = 0; i < width; i++) {
    align(
      ctx,
      lower,
      x + i,
      y + i,
      size,
      colorIndexes[i] || colorIndexes[0],
      spacing,
    )
  }
}

/** HUD copy. Same canvas face for English and CJK. */
export function displayWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  x: number,
  y: number,
  size: number,
  colorIndexes: number[],
  side = 0,
) {
  displayCanvasWord(ctx, word, x, y, size, colorIndexes, side)
}
