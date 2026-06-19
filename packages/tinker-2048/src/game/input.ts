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

const SWIPE_THRESHOLD = 10
const STICK_THRESHOLD = 0.5

export interface SwipeBinding {
  updateBounds(bounds: Phaser.Geom.Rectangle): void
  destroy(): void
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
): SwipeBinding {
  const zone = scene.add
    .zone(bounds.x, bounds.y, bounds.width, bounds.height)
    .setOrigin(0)
    .setDepth(1)
    .setInteractive()

  const onPointerUp = (pointer: Phaser.Input.Pointer) => {
    const dx = pointer.upX - pointer.downX
    const dy = pointer.upY - pointer.downY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (Math.max(absDx, absDy) <= SWIPE_THRESHOLD) return

    const direction: Direction =
      absDx > absDy ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0
    onMove(direction)
  }

  zone.on('pointerup', onPointerUp)

  return {
    updateBounds(nextBounds) {
      zone.setPosition(nextBounds.x, nextBounds.y)
      zone.setSize(nextBounds.width, nextBounds.height)
    },
    destroy() {
      zone.off('pointerup', onPointerUp)
      zone.destroy()
    },
  }
}

interface GamepadMenuCallbacks {
  onNavigate: (direction: 0 | 2) => void
  onConfirm: () => void
  onCancel: () => void
}

export interface GamepadBinding {
  setMenuCallbacks(callbacks: GamepadMenuCallbacks | null): void
  destroy(): void
}

export function bindGamepad(
  scene: Phaser.Scene,
  onMove: (direction: Direction) => void,
  onSelect?: () => void,
): GamepadBinding {
  let prevUp = false
  let prevDown = false
  let prevLeft = false
  let prevRight = false
  let prevA = false
  let prevB = false
  let prevSelect = false
  let prevStickActive = false
  let menuCallbacks: GamepadMenuCallbacks | null = null

  const pollGamepad = () => {
    if (!scene.sys.isActive()) return
    const pad = scene.input.gamepad?.pad1
    if (!pad) return

    // Select button (button index 8)
    const selectPressed = !!(pad.buttons[8] && pad.buttons[8].pressed)
    if (selectPressed && !prevSelect && onSelect) {
      onSelect()
    }
    prevSelect = selectPressed

    // Menu mode
    if (menuCallbacks) {
      if (pad.up && !prevUp) menuCallbacks.onNavigate(0)
      else if (pad.down && !prevDown) menuCallbacks.onNavigate(2)

      prevUp = pad.up
      prevDown = pad.down

      if (pad.A && !prevA) menuCallbacks.onConfirm()
      if (pad.B && !prevB) menuCallbacks.onCancel()

      prevA = pad.A
      prevB = !!pad.B
      return
    }

    // Game mode
    if (pad.up && !prevUp) onMove(0)
    else if (pad.down && !prevDown) onMove(2)
    else if (pad.left && !prevLeft) onMove(3)
    else if (pad.right && !prevRight) onMove(1)

    prevUp = pad.up
    prevDown = pad.down
    prevLeft = pad.left
    prevRight = pad.right

    const absX = Math.abs(pad.leftStick.x)
    const absY = Math.abs(pad.leftStick.y)
    const stickActive =
      Math.max(absX, absY) >= STICK_THRESHOLD &&
      !pad.up &&
      !pad.down &&
      !pad.left &&
      !pad.right

    if (stickActive && !prevStickActive) {
      const direction: Direction =
        absX > absY
          ? pad.leftStick.x > 0
            ? 1
            : 3
          : pad.leftStick.y > 0
            ? 2
            : 0
      onMove(direction)
    }

    prevStickActive = stickActive
  }

  scene.events.on(Phaser.Scenes.Events.UPDATE, pollGamepad)

  return {
    setMenuCallbacks(callbacks: GamepadMenuCallbacks | null) {
      menuCallbacks = callbacks
      // Reset edge detection when switching modes
      prevUp = false
      prevDown = false
      prevLeft = false
      prevRight = false
      prevA = false
      prevB = false
      prevSelect = false
      prevStickActive = false
    },
    destroy() {
      scene.events.off(Phaser.Scenes.Events.UPDATE, pollGamepad)
    },
  }
}
