type Axis = [number, number]

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

    return [x, y]
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
