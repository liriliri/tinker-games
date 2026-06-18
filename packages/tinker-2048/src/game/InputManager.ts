import type { Direction } from './GameManager'

type EventMap = {
  move: Direction
  restart: void
  keepPlaying: void
}

export class InputManager {
  private events: {
    [K in keyof EventMap]?: Array<(data: EventMap[K]) => void>
  } = {}

  on<K extends keyof EventMap>(
    event: K,
    callback: (data: EventMap[K]) => void,
  ) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event]!.push(callback)
  }

  emitRestart() {
    this.emit('restart', undefined as void)
  }

  emitKeepPlaying() {
    this.emit('keepPlaying', undefined as void)
  }

  private emit<K extends keyof EventMap>(event: K, data: EventMap[K]) {
    this.events[event]?.forEach((callback) => callback(data))
  }

  bindKeyboard(scene: Phaser.Scene) {
    const map: Record<number, Direction> = {
      38: 0,
      39: 1,
      40: 2,
      37: 3,
      75: 0,
      76: 1,
      74: 2,
      72: 3,
      87: 0,
      68: 1,
      83: 2,
      65: 3,
    }

    scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const modifiers =
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      const mapped = map[event.which]

      if (!modifiers && mapped !== undefined) {
        event.preventDefault()
        this.emit('move', mapped)
      }

      if (!modifiers && event.which === 82) {
        event.preventDefault()
        this.emit('restart', undefined as void)
      }
    })
  }

  bindSwipe(scene: Phaser.Scene, bounds: Phaser.Geom.Rectangle) {
    let startX = 0
    let startY = 0

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!bounds.contains(pointer.x, pointer.y)) return
      startX = pointer.x
      startY = pointer.y
    })

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!bounds.contains(startX, startY)) return

      const dx = pointer.x - startX
      const dy = pointer.y - startY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (Math.max(absDx, absDy) > 10) {
        const direction: Direction =
          absDx > absDy ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0
        this.emit('move', direction)
      }
    })
  }
}
