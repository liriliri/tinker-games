import * as THREE from 'three'
import clamp from 'licia/clamp'
import lpad from 'licia/lpad'
import now from 'licia/now'
import { GROUND_PALETTES } from './constants'

function paintGradient(
  ctx: CanvasRenderingContext2D,
  topHex: string,
  bottomHex: string,
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, `#${topHex}`)
  gradient.addColorStop(1, `#${bottomHex}`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 2, 256)
}

function makeGradientTexture(top: number, bottom: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  paintGradient(
    ctx,
    lpad(top.toString(16), 6, '0'),
    lpad(bottom.toString(16), 6, '0'),
  )
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  return texture
}

/**
 * Gradient backdrop only. Bottle realtime shadow uses a ShadowMaterial plane
 * parented to the key light (same as original index.js addLight) — not a world floor,
 * so it won't stack with the blocks' fake drop-shadow planes.
 */
export class Ground {
  private current = 0
  private texture: THREE.CanvasTexture
  private readonly scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const palette = GROUND_PALETTES[0]
    this.texture = makeGradientTexture(palette.top, palette.bottom)
    this.scene.background = this.texture
  }

  changeColor() {
    this.current = (this.current + 1) % GROUND_PALETTES.length
    const next = GROUND_PALETTES[this.current]
    const from =
      GROUND_PALETTES[
        (this.current + GROUND_PALETTES.length - 1) % GROUND_PALETTES.length
      ]
    const start = now()
    const duration = 2800
    const fromTop = new THREE.Color(from.top)
    const fromBottom = new THREE.Color(from.bottom)
    const toTop = new THREE.Color(next.top)
    const toBottom = new THREE.Color(next.bottom)
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    const tick = () => {
      const t = clamp((now() - start) / duration, 0, 1)
      const top = fromTop.clone().lerp(toTop, t)
      const bottom = fromBottom.clone().lerp(toBottom, t)
      paintGradient(ctx, top.getHexString(), bottom.getHexString())
      this.texture.image = canvas
      this.texture.needsUpdate = true
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
}
