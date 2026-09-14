import clamp from 'licia/clamp'
import $class from 'licia/$class'
import type { MazeGrid } from '../game/maze'

const MINIMAP_SIZE = 84
const MINIMAP_REVEAL_SIZE = 280
const MINIMAP_PADDING = 8

function cellRect(
  i: number,
  j: number,
  dimension: number,
  padding: number,
  cell: number,
) {
  const x0 = Math.round(padding + i * cell)
  const y0 = Math.round(padding + (dimension - 1 - j) * cell)
  const x1 = Math.round(padding + (i + 1) * cell)
  const y1 = Math.round(padding + (dimension - j) * cell)
  return { x0, y0, x1, y1 }
}

export class Minimap {
  private canvas: HTMLCanvasElement
  private panel: HTMLElement
  private ctx: CanvasRenderingContext2D
  private revealed = false
  private revealPointerId: number | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.panel = canvas.closest('#minimap') ?? canvas.parentElement!
    canvas.width = MINIMAP_SIZE
    canvas.height = MINIMAP_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Minimap canvas context unavailable')
    }
    this.ctx = ctx

    this.panel.addEventListener('pointerdown', this.onPointerDown)
    this.panel.addEventListener('contextmenu', this.onContextMenu)
    this.panel.addEventListener('touchstart', this.onTouchStart, {
      passive: false,
    })
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    window.addEventListener('blur', this.clearReveal)
  }

  draw(maze: MazeGrid, ballX: number, ballY: number) {
    const size = this.revealed ? MINIMAP_REVEAL_SIZE : MINIMAP_SIZE
    if (this.canvas.width !== size) {
      this.canvas.width = size
      this.canvas.height = size
    }

    const ctx = this.ctx
    const padding = MINIMAP_PADDING
    const inner = size - padding * 2
    const dimension = maze.dimension
    // Match wall-cell mapping: world (i, j) cell center → ((i+0.5)/dim, (j+0.5)/dim).
    const dotX =
      padding + (clamp(ballX + 0.5, 0, dimension) / dimension) * inner
    const dotY =
      padding + (1 - clamp(ballY + 0.5, 0, dimension) / dimension) * inner

    ctx.clearRect(0, 0, size, size)

    if (this.revealed) {
      this.drawMazeMap(maze, padding, inner)
    }

    ctx.strokeStyle = this.revealed
      ? 'rgba(196, 152, 82, 0.7)'
      : 'rgba(255, 246, 234, 0.42)'
    ctx.lineWidth = this.revealed ? 2 : 1.5
    ctx.strokeRect(padding + 0.5, padding + 0.5, inner - 1, inner - 1)

    const dotR = this.revealed ? 5.5 : 3

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.beginPath()
    ctx.arc(dotX, dotY + 1.2, dotR + 1, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255, 246, 234, 0.95)'
    ctx.lineWidth = this.revealed ? 2 : 1.5
    ctx.beginPath()
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = 'rgba(232, 176, 72, 1)'
    ctx.beginPath()
    ctx.arc(dotX, dotY, dotR - (this.revealed ? 1.5 : 1), 0, Math.PI * 2)
    ctx.fill()
  }

  private drawMazeMap(maze: MazeGrid, padding: number, inner: number) {
    const ctx = this.ctx
    const dimension = maze.dimension
    const cell = inner / dimension

    ctx.fillStyle = '#efe4d2'
    ctx.fillRect(padding, padding, inner, inner)

    ctx.fillStyle = '#1c1611'
    ctx.imageSmoothingEnabled = false
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (!maze[i][j]) {
          continue
        }
        const { x0, y0, x1, y1 } = cellRect(i, j, dimension, padding, cell)
        ctx.fillRect(x0, y0, Math.max(x1 - x0, 1), Math.max(y1 - y0, 1))
      }
    }

    if (cell < 2.5) {
      return
    }

    ctx.strokeStyle = 'rgba(239, 228, 210, 0.22)'
    ctx.lineWidth = Math.min(cell * 0.18, 1.2)
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (maze[i][j]) {
          continue
        }
        const { x0, y0, x1, y1 } = cellRect(i, j, dimension, padding, cell)
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1)
      }
    }
  }

  private onContextMenu = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  private onTouchStart = (event: TouchEvent) => {
    // Prevents iOS/Android long-press callout and tap highlight flash.
    event.preventDefault()
    event.stopPropagation()
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    this.revealPointerId = event.pointerId
    this.setRevealed(true)
    try {
      this.panel.setPointerCapture(event.pointerId)
    } catch {
      // Capture is optional; window pointerup still clears reveal.
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    if (
      this.revealPointerId === null ||
      event.pointerId !== this.revealPointerId
    ) {
      return
    }
    this.clearReveal()
  }

  private clearReveal = () => {
    this.revealPointerId = null
    this.setRevealed(false)
  }

  private setRevealed(revealed: boolean) {
    if (this.revealed === revealed) {
      return
    }
    this.revealed = revealed
    if (revealed) {
      $class.add(this.panel, 'is-revealed')
    } else {
      $class.remove(this.panel, 'is-revealed')
    }
  }
}
