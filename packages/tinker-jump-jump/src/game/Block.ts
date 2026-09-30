import * as THREE from 'three'
import random from 'licia/random'
import randomItem from 'licia/randomItem'
import filter from 'licia/filter'
import contain from 'licia/contain'
import clamp from 'licia/clamp'
import max from 'licia/max'
import { BLOCK, BLOCK_THEMES, COLORS } from './constants'
import { createDropShadow, type ShadowKind } from '../lib/shadow'
import { easeOutBounce, easeOutCubic, tweenProps } from '../lib/tween'

/** Geometric variants matching the original's basic (non-textured) platforms. */
type BlockShape = 'box' | 'cylinder' | 'stool' | 'striped' | 'sandwich'

const SHAPES: BlockShape[] = ['box', 'cylinder', 'stool', 'striped', 'sandwich']

function lambert(color: number) {
  return new THREE.MeshLambertMaterial({ color })
}

export class Block {
  readonly obj = new THREE.Object3D()
  radius: number = BLOCK.radius
  radiusScale = 1
  readonly color: number
  readonly bandColor: number
  status: 'stop' | 'shrink' = 'stop'
  scale = 1

  private readonly body: THREE.Object3D
  private readonly meshes: THREE.Mesh[] = []
  private readonly shadow: THREE.Mesh
  private readonly marker: THREE.Mesh
  private readonly shadowInitZ: number
  private readonly shadowInitScaleY: number
  private readonly hitKind: 'box' | 'circle'

  constructor(
    shape: BlockShape = 'box',
    color: number = COLORS.blockGreen,
    bandColor: number = COLORS.platformWhite,
    hasRing = false,
    ringColor: number = COLORS.ringGreen,
  ) {
    this.color = color
    this.bandColor = bandColor
    this.hitKind = shape === 'cylinder' || shape === 'stool' ? 'circle' : 'box'

    this.body = new THREE.Object3D()
    this.obj.add(this.body)

    switch (shape) {
      case 'cylinder':
        this.buildCylinder()
        break
      case 'stool':
        this.buildStool()
        break
      case 'striped':
        this.buildStriped()
        break
      case 'sandwich':
        this.buildSandwich()
        break
      default:
        this.buildBox()
    }

    if (hasRing) this.buildTopRing(ringColor)

    for (const mesh of this.meshes) {
      // Original: blocks never cast — only fake PNG drop shadows + bottle→hitObj.
      mesh.castShadow = false
      // Top face only — full-body receive paints a dark rim on the side while squashing.
      mesh.receiveShadow = !!mesh.userData.receiveBottleShadow
      this.body.add(mesh)
    }

    const shadowKind: ShadowKind =
      shape === 'stool' ? 'desk' : shape === 'cylinder' ? 'cylinder' : 'box'
    this.shadow = createDropShadow(shadowKind)
    if (shadowKind === 'cylinder') {
      this.shadow.position.set(0, -BLOCK.height / 2 - 0.001, BLOCK.radius)
      this.shadow.scale.set(1, 1, 1)
      this.shadowInitZ = BLOCK.radius
      this.shadowInitScaleY = 1
    } else if (shadowKind === 'desk') {
      // Match original desk_shadow placement (orders 2 & 7).
      this.shadow.position.set(0, -BLOCK.height / 2 - 0.001, -4.5)
      this.shadow.scale.set(1, 1.2, 1)
      this.shadowInitZ = -4.5
      this.shadowInitScaleY = 1.2
    } else {
      this.shadow.position.set(-0.74, -BLOCK.height / 2 - 0.001, -2.73)
      this.shadow.scale.set(1, 1.4, 1)
      this.shadowInitZ = -2.73
      this.shadowInitScaleY = 1.4
    }
    this.obj.add(this.shadow)

    this.marker = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({
        color: COLORS.pureWhite,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    )
    this.marker.rotation.x = -Math.PI / 2
    this.marker.position.y = BLOCK.height / 2 + 0.04
    this.marker.visible = false
    this.body.add(this.marker)

    this.body.position.y = 0
    this.obj.visible = false
  }

  static createRandom(excludeColors: number[] = []): Block {
    const shape = randomItem(SHAPES) as BlockShape
    // Orders 0–8 all share changeColor() green / gray / black themes.
    const filtered = filter(
      BLOCK_THEMES,
      (t) => !contain(excludeColors, t.color),
    )
    const themes =
      filtered.length > 0 ? filtered : ([...BLOCK_THEMES] as typeof filtered)
    const theme = randomItem(themes)
    const hasRing = shape === 'cylinder'
    const block = new Block(shape, theme.color, theme.band, hasRing, theme.ring)
    block.randomizeScale()
    return block
  }

  static createStarter(): Block {
    // Default green theme like original greenMaterial / whiteMaterial.
    const block = new Block(
      'box',
      COLORS.blockGreen,
      COLORS.platformWhite,
      false,
    )
    block.radiusScale = 1
    block.radius = BLOCK.radius
    block.obj.scale.set(1, 1, 1)
    return block
  }

  randomizeScale() {
    this.radiusScale = random(BLOCK.minRadiusScale, BLOCK.maxRadiusScale, true)
    this.radius = this.radiusScale * BLOCK.radius
    this.obj.scale.set(this.radiusScale, 1, this.radiusScale)
  }

  showAt(x: number, z: number, animate = false) {
    this.resetVisual()
    this.obj.position.set(x, 0, z)
    this.obj.visible = true
    this.marker.visible = true
    if (animate) {
      this.popup()
    } else {
      this.body.position.y = 0
      this.shadow.position.z = this.shadowInitZ
    }
  }

  popup() {
    this.body.position.y = 20
    this.shadow.position.z = -15
    const bodyY = { y: 20 }
    const shadowZ = { z: -15 }
    tweenProps(
      bodyY,
      { y: 0 },
      {
        duration: 500,
        ease: easeOutBounce,
        onUpdate: () => {
          this.body.position.y = bodyY.y
        },
      },
    )
    tweenProps(
      shadowZ,
      { z: this.shadowInitZ },
      {
        duration: 500,
        ease: easeOutBounce,
        onUpdate: () => {
          this.shadow.position.z = shadowZ.z
        },
        onComplete: () => {
          this.shadow.position.z = this.shadowInitZ
        },
      },
    )
  }

  shrink() {
    this.status = 'shrink'
    this.scale = 1
  }

  update(_dt: number) {
    if (this.status !== 'shrink') return
    if (this.scale <= BLOCK.minScale) return
    this.scale = clamp(this.scale - BLOCK.reduction, BLOCK.minScale, 1)
    this.body.scale.y = this.scale
    this.shadow.scale.y = clamp(
      this.shadow.scale.y - BLOCK.reduction / 2,
      0.85,
      this.shadowInitScaleY,
    )
    // Original always does z += delta for shadows parked on −Z. Cylinder sits on +Z,
    // so move toward the block center or the silhouette slides out the side.
    const delta = (BLOCK.reduction / 4) * 11
    const sign = this.shadowInitZ >= 0 ? 1 : -1
    this.shadow.position.z -= sign * delta
    const drop = (BLOCK.reduction / 2) * BLOCK.height
    this.body.position.y -= drop
  }

  rebound() {
    this.status = 'stop'
    const scale = {
      y: this.body.scale.y,
      bodyY: this.body.position.y,
      shadowY: this.shadow.scale.y,
      shadowZ: this.shadow.position.z,
    }
    tweenProps(
      scale,
      {
        y: 1,
        bodyY: 0,
        shadowY: this.shadowInitScaleY,
        shadowZ: this.shadowInitZ,
      },
      {
        duration: 180,
        ease: easeOutCubic,
        onUpdate: () => {
          this.body.scale.y = scale.y
          this.body.position.y = scale.bodyY
          this.shadow.scale.y = scale.shadowY
          this.shadow.position.z = scale.shadowZ
        },
        onComplete: () => {
          this.scale = 1
          this.body.scale.y = 1
          this.body.position.y = 0
          this.shadow.scale.y = this.shadowInitScaleY
          this.shadow.position.z = this.shadowInitZ
        },
      },
    )
  }

  resetVisual() {
    this.status = 'stop'
    this.scale = 1
    this.body.scale.set(1, 1, 1)
    this.body.position.y = 0
    this.shadow.scale.set(1, this.shadowInitScaleY, 1)
    this.shadow.position.z = this.shadowInitZ
    this.shadow.position.y = -BLOCK.height / 2 - 0.001
  }

  containsPoint(x: number, z: number, padding = 0): boolean {
    const dx = x - this.obj.position.x
    const dz = z - this.obj.position.z
    if (this.hitKind === 'circle') {
      return Math.hypot(dx, dz) <= this.radius + padding
    }
    const half = this.radius + padding
    return Math.abs(dx) <= half && Math.abs(dz) <= half
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose()
      const mats = mesh.material
      if (Array.isArray(mats)) {
        for (const m of mats) m.dispose()
      } else {
        mats.dispose()
      }
    }
    ;(this.shadow.material as THREE.Material).dispose()
    this.marker.geometry.dispose()
    ;(this.marker.material as THREE.Material).dispose()
  }

  private buildBox() {
    const topH = BLOCK.height * 0.38
    const botH = BLOCK.height - topH
    const w = BLOCK.radius * 2
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(w, topH, w),
      lambert(this.color),
    )
    top.position.y = botH / 2
    top.userData.receiveBottleShadow = true
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.02, botH, w + 0.02),
      lambert(this.bandColor),
    )
    base.position.y = -topH / 2
    this.meshes.push(top, base)
  }

  private buildCylinder() {
    const topH = BLOCK.height * 0.32
    const botH = BLOCK.height - topH
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(BLOCK.radius, BLOCK.radius, topH, 48),
      lambert(this.color),
    )
    top.position.y = botH / 2
    top.userData.receiveBottleShadow = true
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(
        BLOCK.radius + 0.02,
        BLOCK.radius + 0.02,
        botH,
        48,
      ),
      lambert(this.bandColor),
    )
    base.position.y = -topH / 2
    this.meshes.push(top, base)
  }

  /**
   * Desk / stool from the original (orders 2 & 7):
   * thin tapered stem + flat colored top disk.
   */
  private buildStool() {
    const unit = BLOCK.height / 21
    const topH = unit * 1.5
    const stemH = BLOCK.height - topH
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(BLOCK.radius, BLOCK.radius, topH, 48),
      lambert(this.color),
    )
    top.position.y = (BLOCK.height - topH) / 2
    top.userData.receiveBottleShadow = true
    // Original: radius-4 … radius-2 with radius=5 → 1 … 3
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(
        max(0.8, BLOCK.radius - 4),
        max(1.2, BLOCK.radius - 2),
        stemH,
        48,
      ),
      lambert(this.bandColor),
    )
    stem.position.y = -topH / 2
    this.meshes.push(top, stem)
  }

  /** Horizontal stripe layers (original orders 1 & 8). */
  private buildStriped() {
    const layers = 5
    const h = BLOCK.height / layers
    const w = BLOCK.radius * 2
    for (let i = 0; i < layers; i++) {
      const isColor = i % 2 === 0
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        lambert(isColor ? this.color : this.bandColor),
      )
      slab.position.y = -BLOCK.height / 2 + h / 2 + i * h
      if (i === layers - 1) slab.userData.receiveBottleShadow = true
      this.meshes.push(slab)
    }
  }

  /** Colored–band–colored sandwich (original orders 0 / 5 / 6). */
  private buildSandwich() {
    const midH = 3
    const capH = (BLOCK.height - midH) / 2
    const w = BLOCK.radius * 2
    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(w, capH, w),
      lambert(this.color),
    )
    bottom.position.y = -midH / 2 - capH / 2
    const mid = new THREE.Mesh(
      new THREE.BoxGeometry(w, midH, w),
      lambert(this.bandColor),
    )
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(w, capH, w),
      lambert(this.color),
    )
    top.position.y = midH / 2 + capH / 2
    top.userData.receiveBottleShadow = true
    this.meshes.push(bottom, mid, top)
  }

  /**
   * Flat single RingGeometry on cylinder tops — original order 3
   * (inner 0.6R … outer 0.8R, rotateX −π/2, y = height/2 + 0.01).
   */
  private buildTopRing(color: number) {
    const r = BLOCK.radius
    const geom = new THREE.RingGeometry(0.6 * r, 0.8 * r, 30)
    geom.rotateX(-Math.PI / 2)
    const ring = new THREE.Mesh(geom, lambert(color))
    ring.position.y = BLOCK.height / 2 + 0.01
    // Landing surface — must receive the bottle shadow like the top disk.
    ring.userData.receiveBottleShadow = true
    this.meshes.push(ring)
  }
}
