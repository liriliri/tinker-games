import max from 'licia/max'
import min from 'licia/min'

export function motionDuration(ms: number) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0
  return ms
}

export function fitLongSide(width: number, height: number, maxSide: number) {
  const scale = min(1, maxSide / max(width, height))
  return {
    width: max(1, Math.round(width * scale)),
    height: max(1, Math.round(height * scale)),
  }
}

export function createCanvas(
  width: number,
  height: number,
  options?: CanvasRenderingContext2DSettings,
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return { canvas, ctx: canvas.getContext('2d', options) }
}
