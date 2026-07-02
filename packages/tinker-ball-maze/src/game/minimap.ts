const MINIMAP_SIZE = 84
const MINIMAP_PADDING = 8

export class Minimap {
  private ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = MINIMAP_SIZE
    canvas.height = MINIMAP_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Minimap canvas context unavailable')
    }
    this.ctx = ctx
  }

  draw(dimension: number, ballX: number, ballY: number) {
    const ctx = this.ctx
    const inner = MINIMAP_SIZE - MINIMAP_PADDING * 2
    const max = Math.max(dimension - 1, 1)
    const tX = Math.min(Math.max(ballX / max, 0), 1)
    const tY = Math.min(Math.max(ballY / max, 0), 1)

    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

    ctx.strokeStyle = 'rgba(255, 246, 234, 0.42)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(
      MINIMAP_PADDING + 0.5,
      MINIMAP_PADDING + 0.5,
      inner - 1,
      inner - 1,
    )

    const dotX = MINIMAP_PADDING + tX * inner
    const dotY = MINIMAP_PADDING + (1 - tY) * inner

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.beginPath()
    ctx.arc(dotX, dotY + 1, 3.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(255, 246, 234, 0.95)'
    ctx.beginPath()
    ctx.arc(dotX, dotY, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(184, 135, 74, 0.95)'
    ctx.beginPath()
    ctx.arc(dotX, dotY, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}
