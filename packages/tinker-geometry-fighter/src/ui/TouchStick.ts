import clamp from 'licia/clamp'
import $class from 'licia/$class'
import $css from 'licia/$css'
import './style.css'

const DEADZONE = 0.15
const RADIUS = 56

function applyDeadzone(value: number) {
  const abs = Math.abs(value)
  if (abs < DEADZONE) return 0
  return Math.sign(value) * ((abs - DEADZONE) / (1 - DEADZONE))
}

const GRAB = 70

/** Fixed corner stick. Movement is measured from its center, not the finger's first point. */
export class TouchStick {
  private el: HTMLDivElement
  private knob: HTMLDivElement
  private active = false
  shown = false

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'touch-stick'
    this.el.setAttribute('aria-hidden', 'true')
    this.el.innerHTML = `
      <div class="touch-stick-ring touch-stick-ring--outer"></div>
      <div class="touch-stick-cross"></div>
      <div class="touch-stick-knob"><span></span></div>
    `
    this.knob = this.el.querySelector('.touch-stick-knob') as HTMLDivElement
    document.body.appendChild(this.el)
  }

  setShown(shown: boolean) {
    if (this.shown === shown) return
    this.shown = shown
    if (shown) $class.add(this.el, 'is-shown')
    else $class.remove(this.el, 'is-shown')
  }

  hit(x: number, y: number, canvas: HTMLCanvasElement) {
    const center = this.center(canvas)
    return Math.hypot(x - center.x, y - center.y) <= GRAB
  }

  begin() {
    this.active = true
    $class.add(this.el, 'is-active')
  }

  drag(x: number, y: number, canvas: HTMLCanvasElement) {
    const center = this.center(canvas)
    const dx = x - center.x
    const dy = y - center.y
    const len = Math.hypot(dx, dy)
    const scale = len > RADIUS ? RADIUS / len : 1
    const stickX = (dx * scale) / RADIUS
    const stickY = (dy * scale) / RADIUS
    this.moveKnob(stickX * RADIUS, stickY * RADIUS)
    return {
      x: clamp(applyDeadzone(stickX), -1, 1),
      y: clamp(applyDeadzone(stickY), -1, 1),
    }
  }

  end() {
    if (!this.active) return
    this.active = false
    $class.remove(this.el, 'is-active')
    this.moveKnob(0, 0)
  }

  destroy() {
    this.el.remove()
  }

  private center(canvas: HTMLCanvasElement) {
    const stick = this.el.getBoundingClientRect()
    const frame = canvas.getBoundingClientRect()
    return {
      x: stick.left + stick.width / 2 - frame.left,
      y: stick.top + stick.height / 2 - frame.top,
    }
  }

  private moveKnob(offsetX: number, offsetY: number) {
    $css(this.knob, 'transform', `translate(${offsetX}px, ${offsetY}px)`)
  }
}
