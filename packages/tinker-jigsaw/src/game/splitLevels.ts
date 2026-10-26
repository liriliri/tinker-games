import max from 'licia/max'
import min from 'licia/min'
import { createCanvas, fitLongSide } from '../lib/util'
import { boardGrid } from './jigsaw'

const MIN_SHORT = 4
const MAX_SHORT = 8
const FLOOR_SHORT = 4
const LEVEL_SHIFT = 2
const CAP_SHORT = 10
const SAMPLE_SIDE = 320
const BLOCKS = 3
// Mean distance from a cell to its nearest lookalike. Calibrated on the gallery.
const DISTINCT = 0.5

// Three short-side counts for this picture. The shift keeps the coarse board past a handful of pieces.
export function splitLevels(source: HTMLCanvasElement) {
  const pixels = samplePicture(source)
  if (!pixels) return spread(raised(FLOOR_SHORT))
  let hard = FLOOR_SHORT
  for (let level = MAX_SHORT; level >= FLOOR_SHORT; level--) {
    const grid = boardGrid(source.width, source.height, level)
    if (meanNearest(pixels, grid.columns, grid.rows) >= DISTINCT) {
      hard = level
      break
    }
  }
  return spread(raised(hard))
}

function raised(level: number) {
  return min(CAP_SHORT, level + LEVEL_SHIFT)
}

function spread(hard: number) {
  const easy = max(MIN_SHORT, Math.round(hard * 0.5))
  let mid = Math.round((easy + hard) / 2)
  if (mid <= easy) mid = easy + 1
  if (mid >= hard) mid = hard - 1
  return [easy, mid, hard]
}

function samplePicture(source: HTMLCanvasElement) {
  const fitted = fitLongSide(source.width, source.height, SAMPLE_SIDE)
  const { canvas, ctx } = createCanvas(fitted.width, fitted.height, {
    willReadFrequently: true,
  })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, fitted.width, fitted.height)
  return ctx.getImageData(0, 0, fitted.width, fitted.height)
}

function meanNearest(pixels: ImageData, columns: number, rows: number) {
  const signatures = cellSignatures(pixels, columns, rows)
  let total = 0
  for (let index = 0; index < signatures.length; index++) {
    let nearest = Number.POSITIVE_INFINITY
    for (let other = 0; other < signatures.length; other++) {
      if (other === index) continue
      const distance = signatureDistance(signatures[index], signatures[other])
      if (distance < nearest) nearest = distance
    }
    total += nearest
  }
  return total / signatures.length
}

function cellSignatures(pixels: ImageData, columns: number, rows: number) {
  const { width, height, data } = pixels
  const signatures: number[][] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x0 = Math.floor((column * width) / columns)
      const x1 = max(x0 + 1, Math.floor(((column + 1) * width) / columns))
      const y0 = Math.floor((row * height) / rows)
      const y1 = max(y0 + 1, Math.floor(((row + 1) * height) / rows))
      signatures.push(cellSignature(data, width, x0, x1, y0, y1))
    }
  }
  return signatures
}

function cellSignature(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  const blocks = BLOCKS * BLOCKS
  const sum = new Float64Array(blocks * 4)
  const sumSq = new Float64Array(blocks)
  const count = new Uint32Array(blocks)
  for (let y = y0; y < y1; y++) {
    const blockY = min(BLOCKS - 1, Math.floor(((y - y0) * BLOCKS) / (y1 - y0)))
    for (let x = x0; x < x1; x++) {
      const blockX = min(
        BLOCKS - 1,
        Math.floor(((x - x0) * BLOCKS) / (x1 - x0)),
      )
      const block = blockY * BLOCKS + blockX
      const pixel = (y * width + x) * 4
      const red = data[pixel] / 255
      const green = data[pixel + 1] / 255
      const blue = data[pixel + 2] / 255
      const offset = block * 4
      sum[offset] += red
      sum[offset + 1] += green
      sum[offset + 2] += blue
      const luminance = 0.299 * red + 0.587 * green + 0.114 * blue
      sum[offset + 3] += luminance
      sumSq[block] += luminance * luminance
      count[block]++
    }
  }

  const signature: number[] = []
  for (let block = 0; block < blocks; block++) {
    const samples = count[block] || 1
    const offset = block * 4
    signature.push(
      sum[offset] / samples,
      sum[offset + 1] / samples,
      sum[offset + 2] / samples,
    )
    const mean = sum[offset + 3] / samples
    signature.push(Math.sqrt(max(0, sumSq[block] / samples - mean * mean)))
  }
  return signature
}

function signatureDistance(left: number[], right: number[]) {
  let sum = 0
  for (let index = 0; index < left.length; index++) {
    const delta = left[index] - right[index]
    sum += delta * delta
  }
  return Math.sqrt(sum)
}
