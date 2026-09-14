import clamp from 'licia/clamp'
import $class from 'licia/$class'
import $css from 'licia/$css'
import isFn from 'licia/isFn'
import once from 'licia/once'

type Axis = [number, number]

const STICK_DEADZONE = 0.15
const TOUCH_STICK_RADIUS = 56
const ORIENTATION_MAX_DEG = 22

const AXIS_KEYS: Record<string, Axis> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  a: [-1, 0],
  d: [1, 0],
  w: [0, 1],
  s: [0, -1],
}

function normalizeKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key
}

function applyDeadzone(value: number, deadzone: number) {
  const abs = Math.abs(value)
  if (abs < deadzone) {
    return 0
  }
  return Math.sign(value) * ((abs - deadzone) / (1 - deadzone))
}

function pickAxis(a: number, b: number) {
  return Math.abs(a) >= Math.abs(b) ? a : b
}

function mergeAxes(...axes: Axis[]): Axis {
  let x = 0
  let y = 0
  for (const [ax, ay] of axes) {
    x = pickAxis(x, ax)
    y = pickAxis(y, ay)
  }
  return [clamp(x, -1, 1), clamp(y, -1, 1)]
}

function getGamepadAxis(): Axis {
  const gamepads = navigator.getGamepads?.()
  if (!gamepads) {
    return [0, 0]
  }

  let stickX = 0
  let stickY = 0
  let dpadX = 0
  let dpadY = 0

  for (const pad of gamepads) {
    if (!pad) {
      continue
    }

    const nextStickX = applyDeadzone(pad.axes[0] ?? 0, STICK_DEADZONE)
    const nextStickY = applyDeadzone(pad.axes[1] ?? 0, STICK_DEADZONE)

    if (Math.abs(nextStickX) > Math.abs(stickX)) {
      stickX = nextStickX
    }
    if (Math.abs(nextStickY) > Math.abs(stickY)) {
      stickY = nextStickY
    }

    const { buttons } = pad
    if (buttons[14]?.pressed) {
      dpadX = -1
    } else if (buttons[15]?.pressed) {
      dpadX = 1
    }
    if (buttons[12]?.pressed) {
      dpadY = 1
    } else if (buttons[13]?.pressed) {
      dpadY = -1
    }
  }

  return [
    clamp(pickAxis(stickX, dpadX), -1, 1),
    clamp(pickAxis(-stickY, dpadY), -1, 1),
  ]
}

export class AxisInput {
  private active = new Set<string>()
  private touchAxis: Axis = [0, 0]
  private touchPointerId: number | null = null
  private touchOrigin: { x: number; y: number } | null = null
  private orientationAxis: Axis = [0, 0]
  private orientationBase: { beta: number; gamma: number } | null = null
  private stickEl: HTMLDivElement
  private stickKnobEl: HTMLDivElement

  constructor() {
    this.stickEl = document.createElement('div')
    this.stickEl.className = 'touch-stick'
    this.stickEl.setAttribute('aria-hidden', 'true')
    this.stickEl.innerHTML = `
      <div class="touch-stick-ring touch-stick-ring--outer"></div>
      <div class="touch-stick-ring touch-stick-ring--inner"></div>
      <div class="touch-stick-cross"></div>
      <div class="touch-stick-knob"><span></span></div>
    `
    this.stickKnobEl = this.stickEl.querySelector(
      '.touch-stick-knob',
    ) as HTMLDivElement
    document.body.appendChild(this.stickEl)

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
  }

  getAxis(): Axis {
    let x = 0
    let y = 0

    for (const key of this.active) {
      const axis = AXIS_KEYS[key]
      if (!axis) {
        continue
      }
      if (axis[0] !== 0) {
        x = axis[0]
      }
      if (axis[1] !== 0) {
        y = axis[1]
      }
    }

    return mergeAxes(
      [x, y],
      getGamepadAxis(),
      this.touchAxis,
      this.orientationAxis,
    )
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const key = normalizeKey(event.key)
    if (!AXIS_KEYS[key] || this.active.has(key)) {
      return
    }
    this.active.add(key)
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.active.delete(normalizeKey(event.key))
  }

  private onBlur = () => {
    this.active.clear()
    this.clearTouch()
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      return
    }
    if ((event.target as Element | null)?.closest?.('#minimap')) {
      return
    }

    void this.ensureOrientation()

    if (this.touchPointerId !== null) {
      return
    }

    this.touchPointerId = event.pointerId
    this.touchOrigin = { x: event.clientX, y: event.clientY }
    this.touchAxis = [0, 0]
    this.showStick(event.clientX, event.clientY)

    try {
      ;(event.target as Element | null)?.setPointerCapture?.(event.pointerId)
    } catch {
      // Capture can fail on some targets; window listeners still work.
    }
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.touchPointerId || !this.touchOrigin) {
      return
    }

    const dx = event.clientX - this.touchOrigin.x
    const dy = event.clientY - this.touchOrigin.y
    const len = Math.hypot(dx, dy)
    const scale = len > TOUCH_STICK_RADIUS ? TOUCH_STICK_RADIUS / len : 1
    const stickX = (dx * scale) / TOUCH_STICK_RADIUS
    const stickY = (-dy * scale) / TOUCH_STICK_RADIUS

    this.touchAxis = [
      applyDeadzone(stickX, STICK_DEADZONE),
      applyDeadzone(stickY, STICK_DEADZONE),
    ]
    this.updateStickKnob(
      stickX * TOUCH_STICK_RADIUS,
      stickY * -TOUCH_STICK_RADIUS,
    )
  }

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.touchPointerId) {
      return
    }
    this.clearTouch()
  }

  private clearTouch() {
    this.touchPointerId = null
    this.touchOrigin = null
    this.touchAxis = [0, 0]
    $class.remove(this.stickEl, 'is-active')
    this.updateStickKnob(0, 0)
  }

  private showStick(x: number, y: number) {
    // Position while hidden so the stick doesn't jump mid-fade.
    $class.remove(this.stickEl, 'is-active')
    this.stickEl.style.transition = 'none'
    $css(this.stickEl, {
      left: `${x}px`,
      top: `${y}px`,
    })
    this.updateStickKnob(0, 0)
    void this.stickEl.offsetWidth
    this.stickEl.style.removeProperty('transition')
    requestAnimationFrame(() => {
      $class.add(this.stickEl, 'is-active')
    })
  }

  private updateStickKnob(offsetX: number, offsetY: number) {
    $css(this.stickKnobEl, 'transform', `translate(${offsetX}px, ${offsetY}px)`)
  }

  private ensureOrientation = once(async () => {
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    try {
      if (isFn(DOE.requestPermission)) {
        const permission = await DOE.requestPermission()
        if (permission !== 'granted') {
          return
        }
      }
    } catch {
      return
    }

    window.addEventListener('deviceorientation', this.onOrientation)
  })

  private onOrientation = (event: DeviceOrientationEvent) => {
    const { beta, gamma } = event
    if (beta == null || gamma == null) {
      return
    }

    if (!this.orientationBase) {
      this.orientationBase = { beta, gamma }
    }

    const x = (gamma - this.orientationBase.gamma) / ORIENTATION_MAX_DEG
    const y = -(beta - this.orientationBase.beta) / ORIENTATION_MAX_DEG
    this.orientationAxis = [
      applyDeadzone(clamp(x, -1, 1), STICK_DEADZONE),
      applyDeadzone(clamp(y, -1, 1), STICK_DEADZONE),
    ]
  }
}
