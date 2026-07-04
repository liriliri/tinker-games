type Axis = [number, number]

const STICK_DEADZONE = 0.15

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

function clampAxis(value: number) {
  return Math.max(-1, Math.min(1, value))
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

  const x = pickAxis(stickX, dpadX)
  const y = pickAxis(-stickY, dpadY)
  return [clampAxis(x), clampAxis(y)]
}

function pickAxis(a: number, b: number) {
  return Math.abs(a) >= Math.abs(b) ? a : b
}

export class AxisInput {
  private active = new Set<string>()

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
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

    const [gamepadX, gamepadY] = getGamepadAxis()
    return [pickAxis(x, gamepadX), pickAxis(y, gamepadY)]
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
  }
}
