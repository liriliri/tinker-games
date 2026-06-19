import Phaser from 'phaser'
import type { Direction } from '../game/GameManager'

const KEY_MAP: Record<number, Direction> = {
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

export function bindKeyboard(
  scene: Phaser.Scene,
  onMove: (direction: Direction) => void,
  onRestart: () => void,
) {
  scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
    const modifiers =
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    const mapped = KEY_MAP[event.which]

    if (!modifiers && mapped !== undefined) {
      event.preventDefault()
      onMove(mapped)
    }

    if (!modifiers && event.which === 82) {
      event.preventDefault()
      onRestart()
    }
  })
}

export function bindSwipe(
  scene: Phaser.Scene,
  bounds: Phaser.Geom.Rectangle,
  onMove: (direction: Direction) => void,
) {
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
      onMove(direction)
    }
  })
}
