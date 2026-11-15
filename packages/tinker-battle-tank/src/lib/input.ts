import $class from 'licia/$class'
import each from 'licia/each'
import startWith from 'licia/startWith'
import type { Direction } from '../game/types'

export interface PlayerInput {
  /** Direction the player wants to face, or null when no key is held. */
  direction: Direction | null
  fire: boolean
}

type Action = 'up' | 'down' | 'left' | 'right' | 'fire'

interface KeyBinding {
  player: 0 | 1
  action: Action
}

/**
 * Player 1 uses WASD and fires with J or Space, player 2 uses the arrow keys
 * and fires with Slash. These follow the reference implementation.
 */
const KEY_BINDINGS: Record<string, KeyBinding> = {
  KeyW: { player: 0, action: 'up' },
  KeyA: { player: 0, action: 'left' },
  KeyS: { player: 0, action: 'down' },
  KeyD: { player: 0, action: 'right' },
  KeyJ: { player: 0, action: 'fire' },
  Space: { player: 0, action: 'fire' },
  ArrowUp: { player: 1, action: 'up' },
  ArrowLeft: { player: 1, action: 'left' },
  ArrowDown: { player: 1, action: 'down' },
  ArrowRight: { player: 1, action: 'right' },
  Slash: { player: 1, action: 'fire' },
  ShiftRight: { player: 1, action: 'fire' },
}

const GAMEPAD_DEADZONE = 0.28

/** True on devices with a touch screen. */
function isTouchDevice() {
  return (
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0)
  )
}

interface TouchStick {
  pointerId: number
  player: 0 | 1
  originX: number
  originY: number
  x: number
  y: number
}

export class GameInput {
  private readonly pressed = new Set<string>()
  private readonly touchSticks = new Map<number, TouchStick>()
  private readonly touchFire = new Set<number>()
  private readonly stickElements: HTMLElement[] = []
  private readonly fireButtons: HTMLElement[] = []
  private enabled = false

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    window.addEventListener('contextmenu', (event) => {
      if ((event.target as Element | null)?.closest?.('.touch-controls')) {
        event.preventDefault()
      }
    })
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) {
      this.pressed.clear()
      this.touchSticks.clear()
      this.touchFire.clear()
      this.hideSticks()
    }
  }

  /** True when the player asked to pause. */
  consumePauseRequest() {
    const requested = this.pressed.has('pause')
    this.pressed.delete('pause')
    return requested
  }

  getInput(player: 0 | 1): PlayerInput {
    const directions: Direction[] = []
    let fire = false

    for (const key of this.pressed) {
      const binding = KEY_BINDINGS[key]
      if (!binding || binding.player !== player) continue
      if (binding.action === 'fire') {
        fire = true
      } else {
        directions.push(binding.action as Direction)
      }
    }

    const gamepad = this.readGamepad(player)
    if (gamepad) {
      if (gamepad.direction) directions.push(gamepad.direction)
      fire = fire || gamepad.fire
    }

    for (const stick of this.touchSticks.values()) {
      if (stick.player !== player) continue
      const dx = stick.x - stick.originX
      const dy = stick.y - stick.originY
      const length = Math.hypot(dx, dy)
      if (length < 8) continue
      const normalised = Math.min(length, 56)
      if (Math.abs(dx) > Math.abs(dy)) {
        directions.push(dx > 0 ? 'right' : 'left')
      } else {
        directions.push(dy > 0 ? 'down' : 'up')
      }
      void normalised
    }

    for (const id of this.touchFire) {
      const button = this.fireButtons[id]
      if (button && $class.has(button, 'is-active')) {
        fire = true
      }
    }

    return { direction: pickDirection(directions), fire }
  }

  /** Creates the on-screen controls; call once the game starts. */
  createTouchControls(playerCount: number) {
    each(document.querySelectorAll('.touch-controls'), (element) => {
      element.remove()
    })
    this.stickElements.length = 0
    this.fireButtons.length = 0

    // Only offer on-screen controls on devices that actually have a touch
    // screen, so the desktop layout stays clean.
    if (!isTouchDevice()) return

    for (let player = 0; player < playerCount; player += 1) {
      const container = document.createElement('div')
      container.className = `touch-controls touch-controls--p${player + 1}`
      container.innerHTML = `
        <div class="touch-stick" aria-hidden="true">
          <div class="touch-stick-ring"></div>
          <div class="touch-stick-knob"></div>
        </div>
        <button class="touch-fire" type="button" aria-label="Fire">FIRE</button>
      `
      document.body.appendChild(container)
      this.stickElements[player] = container.querySelector(
        '.touch-stick',
      ) as HTMLElement
      this.fireButtons[player] = container.querySelector(
        '.touch-fire',
      ) as HTMLElement
    }
  }

  removeTouchControls() {
    each(document.querySelectorAll('.touch-controls'), (element) => {
      element.remove()
    })
    this.stickElements.length = 0
    this.fireButtons.length = 0
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape' || event.code === 'KeyP') {
      this.pressed.add('pause')
      return
    }
    if (event.code === 'Space' || startWith(event.code, 'Arrow')) {
      event.preventDefault()
    }
    this.pressed.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.pressed.delete(event.code)
  }

  private onBlur = () => {
    this.pressed.clear()
    this.touchSticks.clear()
    this.touchFire.clear()
    this.hideSticks()
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return

    const target = event.target as Element | null
    if (target?.closest?.('.touch-fire')) {
      const index = Number((target as HTMLElement).dataset.player ?? '0')
      this.touchFire.add(index)
      $class.add(target as HTMLElement, 'is-active')
      return
    }
    if (target?.closest?.('.touch-controls')) return

    const player: 0 | 1 = event.clientX < window.innerWidth / 2 ? 0 : 1
    if (player === 1 && this.stickElements.length < 2) return

    const stick: TouchStick = {
      pointerId: event.pointerId,
      player,
      originX: event.clientX,
      originY: event.clientY,
      x: event.clientX,
      y: event.clientY,
    }
    this.touchSticks.set(event.pointerId, stick)
    this.showStick(player, event.clientX, event.clientY)
  }

  private onPointerMove = (event: PointerEvent) => {
    const stick = this.touchSticks.get(event.pointerId)
    if (!stick) return
    stick.x = event.clientX
    stick.y = event.clientY
    this.updateStickKnob(stick)
  }

  private onPointerUp = (event: PointerEvent) => {
    this.touchSticks.delete(event.pointerId)
    each([...this.touchFire], (index) => {
      const button = this.fireButtons[index]
      if (button) $class.remove(button, 'is-active')
    })
    this.touchFire.clear()
    this.hideSticks()
  }

  private showStick(player: 0 | 1, x: number, y: number) {
    const element = this.stickElements[player]
    if (!element) return
    element.style.left = `${x}px`
    element.style.top = `${y}px`
    $class.add(element, 'is-active')
  }

  private updateStickKnob(stick: TouchStick) {
    const element = this.stickElements[stick.player]
    if (!element) return
    const knob = element.querySelector('.touch-stick-knob') as HTMLElement
    const dx = stick.x - stick.originX
    const dy = stick.y - stick.originY
    const length = Math.hypot(dx, dy)
    const scale = length > 56 ? 56 / length : 1
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`
  }

  private hideSticks() {
    each(this.stickElements, (element) => {
      $class.remove(element, 'is-active')
      const knob = element.querySelector(
        '.touch-stick-knob',
      ) as HTMLElement | null
      if (knob) knob.style.transform = 'translate(0px, 0px)'
    })
  }

  private readGamepad(player: 0 | 1) {
    const pads = navigator.getGamepads?.()
    if (!pads) return null

    for (const pad of pads) {
      if (!pad) continue
      const isPlayerTwo = player === 1
      const matches = isPlayerTwo ? pad.index % 2 === 1 : pad.index % 2 === 0
      if (!matches) continue

      let x = pad.axes[0] ?? 0
      let y = pad.axes[1] ?? 0
      if (Math.abs(x) < GAMEPAD_DEADZONE) x = 0
      if (Math.abs(y) < GAMEPAD_DEADZONE) y = 0

      const buttons = pad.buttons
      if (buttons[14]?.pressed) x = -1
      if (buttons[15]?.pressed) x = 1
      if (buttons[12]?.pressed) y = -1
      if (buttons[13]?.pressed) y = 1

      let direction: Direction | null = null
      if (x !== 0 || y !== 0) {
        direction =
          Math.abs(x) > Math.abs(y)
            ? x > 0
              ? 'right'
              : 'left'
            : y > 0
              ? 'down'
              : 'up'
      }

      const fire = Boolean(
        buttons[0]?.pressed ||
        buttons[1]?.pressed ||
        buttons[2]?.pressed ||
        buttons[5]?.pressed,
      )

      return { direction, fire }
    }

    return null
  }
}

/**
 * Picks a single direction when several are held at once; the most recently
 * pressed horizontal direction wins over the vertical one, matching how the
 * original game handles diagonal input.
 */
function pickDirection(directions: Direction[]): Direction | null {
  if (directions.length === 0) return null
  const last = directions[directions.length - 1]
  return last
}
