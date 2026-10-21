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

const SWIPE_THRESHOLD_PX = 40
const WHEEL_THRESHOLD = 64
const WHEEL_GAP_MS = 140
const STICK_THRESHOLD = 0.5

export interface SwipeBinding {
  updateBounds(bounds: Phaser.Geom.Rectangle): void
  destroy(): void
}

export interface KeyboardBinding {
  destroy(): void
}

export function bindKeyboard(
  scene: Phaser.Scene,
  onMove: (direction: Direction) => void,
  onRestart: () => void,
): KeyboardBinding {
  const onKeyDown = (event: KeyboardEvent) => {
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
  }

  scene.input.keyboard?.on('keydown', onKeyDown)

  return {
    destroy() {
      scene.input.keyboard?.off('keydown', onKeyDown)
    },
  }
}

function swipeDirection(dx: number, dy: number, threshold: number) {
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (Math.max(absDx, absDy) <= threshold) return

  const direction: Direction = absDx > absDy ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0
  return direction
}

export function bindSwipe(
  scene: Phaser.Scene,
  bounds: Phaser.Geom.Rectangle,
  onMove: (direction: Direction) => void,
): SwipeBinding {
  const area = new Phaser.Geom.Rectangle(
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
  )
  let gesture: { id: number; x: number; y: number; fired: boolean } | undefined
  let wheelX = 0
  let wheelY = 0
  let wheelLockUntil = 0

  const commit = (dx: number, dy: number, threshold: number) => {
    const direction = swipeDirection(dx, dy, threshold)
    if (direction === undefined) return false
    onMove(direction)
    return true
  }

  const pointerThreshold = () =>
    SWIPE_THRESHOLD_PX * (scene.scale.displayScale.x || 1)

  // Object pointerup only fires when the pointer is released over that object,
  // so a swipe that leaves the board is dropped. Follow the gesture on the scene
  // and commit as soon as it clears the threshold.
  const onPointerDown = (
    pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ) => {
    if (currentlyOver.length > 0) {
      gesture = undefined
      return
    }
    if (!pointer.wasTouch && pointer.button !== 0) return
    if (!area.contains(pointer.x, pointer.y)) return

    gesture = { id: pointer.id, x: pointer.x, y: pointer.y, fired: false }
  }

  const onPointerMove = (pointer: Phaser.Input.Pointer) => {
    if (
      !gesture ||
      gesture.id !== pointer.id ||
      gesture.fired ||
      !pointer.isDown
    ) {
      return
    }
    if (
      commit(pointer.x - gesture.x, pointer.y - gesture.y, pointerThreshold())
    ) {
      gesture.fired = true
    }
  }

  const onPointerUp = (pointer: Phaser.Input.Pointer) => {
    if (!gesture || gesture.id !== pointer.id) return
    if (!gesture.fired) {
      commit(pointer.x - gesture.x, pointer.y - gesture.y, pointerThreshold())
    }
    gesture = undefined
  }

  const onWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ) => {
    const now = scene.time.now
    if (now < wheelLockUntil) {
      wheelLockUntil = now + WHEEL_GAP_MS
      wheelX = 0
      wheelY = 0
      return
    }

    const wheel = pointer.event as WheelEvent | undefined
    const unit =
      wheel?.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : wheel?.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? scene.scale.height
          : 1

    wheelX += deltaX * unit
    wheelY += deltaY * unit
    if (!commit(wheelX, wheelY, WHEEL_THRESHOLD)) return

    wheelX = 0
    wheelY = 0
    wheelLockUntil = now + WHEEL_GAP_MS
  }

  scene.input.on('pointerdown', onPointerDown)
  scene.input.on('pointermove', onPointerMove)
  scene.input.on('pointerup', onPointerUp)
  scene.input.on('pointerupoutside', onPointerUp)
  scene.input.on('wheel', onWheel)

  return {
    updateBounds(nextBounds) {
      area.setTo(
        nextBounds.x,
        nextBounds.y,
        nextBounds.width,
        nextBounds.height,
      )
    },
    destroy() {
      scene.input.off('pointerdown', onPointerDown)
      scene.input.off('pointermove', onPointerMove)
      scene.input.off('pointerup', onPointerUp)
      scene.input.off('pointerupoutside', onPointerUp)
      scene.input.off('wheel', onWheel)
    },
  }
}

export interface GamepadBinding {
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
  let prevSelect = false
  let prevStickActive = false

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
      const direction = swipeDirection(pad.leftStick.x, pad.leftStick.y, 0)
      if (direction !== undefined) onMove(direction)
    }

    prevStickActive = stickActive
  }

  scene.events.on(Phaser.Scenes.Events.UPDATE, pollGamepad)

  return {
    destroy() {
      scene.events.off(Phaser.Scenes.Events.UPDATE, pollGamepad)
    },
  }
}
