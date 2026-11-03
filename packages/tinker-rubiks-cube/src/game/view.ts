import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import clamp from 'licia/clamp'
import max from 'licia/max'
import min from 'licia/min'
import {
  applyMove,
  type Axis,
  type CubeState,
  type Move,
  type Vec3,
} from './model'

const QUARTER = Math.PI / 2
const AXIS_VEC = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
]

const PALETTE = [
  '#e0282e',
  '#ff5a00',
  '#f7f8fc',
  '#ffe44d',
  '#12b85c',
  '#1a6ef5',
]

export type MoveTag = 'user' | 'scramble'

export interface CubeViewCallbacks {
  onMove: (move: Move, state: CubeState, tag: MoveTag) => void
  onTurnStart: () => void
  onDoubleTap: () => void
}

interface HitInfo {
  normal: Vec3
  p: Vec3
  point: THREE.Vector3
}

interface DragRot {
  axis: Axis
  layer: number | null
  sign: number
  dir: THREE.Vector2
  pxPerRad: number
}

interface DragState {
  id: number
  touch: boolean
  x0: number
  y0: number
  t0: number
  hit: HitInfo | null
  rot: DragRot | null
  angle: number
  vel: number
  lastT: number
  lastA: number
}

interface AnimState {
  axis: Axis
  layer: number | null
  from: number
  to: number
  start: number
  dur: number
  turns: number
  tag: MoveTag
  done?: () => void
}

interface QueueItem {
  axis: Axis
  layer: number | null
  to: number
  dur: number
  turns: number
  tag: MoveTag
  done?: () => void
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function snapTurns(
  angleTurns: number,
  velocity: number,
  fresh: boolean,
): number {
  const nearest = Math.round(angleTurns)
  const frac = angleTurns - nearest
  if (
    !fresh ||
    Math.abs(frac) < 0.22 ||
    Math.sign(velocity) !== Math.sign(frac) ||
    Math.abs(velocity) < 0.25
  ) {
    return nearest
  }
  return nearest + Math.sign(frac)
}

function dominantAxis(v: THREE.Vector3): Vec3 {
  const abs = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)]
  const axis =
    abs[0] >= abs[1] && abs[0] >= abs[2] ? 0 : abs[1] >= abs[2] ? 1 : 2
  const out: Vec3 = [0, 0, 0]
  out[axis] = Math.sign([v.x, v.y, v.z][axis]) || 1
  return out
}

function axisOf(n: Vec3): Axis {
  return n[0] !== 0 ? 0 : n[1] !== 0 ? 1 : 2
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function makeStickerGeometry(): THREE.ExtrudeGeometry {
  const size = 0.88
  const r = 0.02
  const half = size / 2
  const shape = new THREE.Shape()
  shape.moveTo(-half + r, -half)
  shape.lineTo(half - r, -half)
  shape.quadraticCurveTo(half, -half, half, -half + r)
  shape.lineTo(half, half - r)
  shape.quadraticCurveTo(half, half, half - r, half)
  shape.lineTo(-half + r, half)
  shape.quadraticCurveTo(-half, half, -half, half - r)
  shape.lineTo(-half, -half + r)
  shape.quadraticCurveTo(-half, -half, -half + r, -half)
  return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false })
}

function makeGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
  grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.03)')
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class CubeView {
  locked = false

  private el: HTMLElement
  private cb: CubeViewCallbacks
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200)
  private root = new THREE.Group()
  private cubies = new THREE.Group()
  private pivot = new THREE.Object3D()
  private glow: THREE.Mesh
  private raycaster = new THREE.Raycaster()
  private ro: ResizeObserver
  private raf = 0
  private w = 1
  private h = 1
  private insets = { top: 0, bottom: 0 }
  private bodyGeo = new THREE.BoxGeometry(0.98, 0.98, 0.98)
  private stickerGeo = makeStickerGeometry()
  private bodyMat = new THREE.MeshStandardMaterial({
    color: '#1c1f2a',
    roughness: 0.45,
    metalness: 0.25,
  })
  private mats: THREE.MeshPhysicalMaterial[]
  private state: CubeState
  private anim: AnimState | null = null
  private queue: QueueItem[] = []
  private drag: DragState | null = null
  private lastTap = { t: 0, x: 0, y: 0, onCube: false }
  private spin: { start: number } | null = null

  constructor(el: HTMLElement, state: CubeState, cb: CubeViewCallbacks) {
    this.el = el
    this.cb = cb
    this.state = state

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(min(window.devicePixelRatio || 1, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)

    const canvas = this.renderer.domElement
    canvas.style.display = 'block'
    canvas.style.touchAction = 'none'
    el.appendChild(canvas)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.scene.environment = pmrem.fromScene(room, 0.04).texture
    this.scene.environmentIntensity = 0.62
    room.dispose()
    pmrem.dispose()

    this.scene.add(new THREE.HemisphereLight('#f5f5f7', '#16171a', 0.8))
    const key = new THREE.DirectionalLight('#ffffff', 1.45)
    key.position.set(4, 9, 6)
    const fill = new THREE.DirectionalLight('#d7dbe6', 0.45)
    fill.position.set(-7, 2, -5)
    const rim = new THREE.DirectionalLight('#ffffff', 0.25)
    rim.position.set(-3, -6, 5)
    this.scene.add(key, fill, rim)

    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: makeGlowTexture(),
        transparent: true,
        depthWrite: false,
      }),
    )
    this.glow.rotation.x = -Math.PI / 2
    this.scene.add(this.glow)

    this.mats = PALETTE.map(
      (color) =>
        new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.3,
          metalness: 0,
          clearcoat: 0.7,
          clearcoatRoughness: 0.22,
        }),
    )

    this.root.add(this.cubies, this.pivot)
    this.scene.add(this.root)
    this.build(state)

    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMoveEvt)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onUp)
    canvas.addEventListener('contextmenu', this.prevent)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(el)
    this.resize()
    this.raf = requestAnimationFrame(this.loop)
  }

  setState(state: CubeState): void {
    this.anim = null
    this.queue = []
    this.drag = null
    this.state = state
    this.build(state)
    this.resize()
  }

  getState(): CubeState {
    return this.state
  }

  setInsets(top: number, bottom: number): void {
    if (top === this.insets.top && bottom === this.insets.bottom) return
    this.insets = { top, bottom }
    this.resize()
  }

  play(moves: Move[], tag: MoveTag, dur: number): Promise<void> {
    return new Promise((resolve) => {
      if (!moves.length) {
        resolve()
        return
      }
      if (tag === 'user' && moves.some((m) => m.layer !== null)) {
        this.cb.onTurnStart()
      }
      moves.forEach((move, i) => {
        this.queue.push({
          axis: move.axis,
          layer: move.layer,
          to: move.turns * QUARTER,
          dur,
          turns: move.turns,
          tag,
          done: i === moves.length - 1 ? resolve : undefined,
        })
      })
    })
  }

  celebrate(): void {
    this.spin = { start: performance.now() }
  }

  private build(state: CubeState): void {
    while (this.cubies.children.length) {
      this.cubies.remove(this.cubies.children[0])
    }
    while (this.pivot.children.length) {
      this.pivot.remove(this.pivot.children[0])
    }
    this.pivot.rotation.set(0, 0, 0)

    const byPos = new Map<string, THREE.Group>()
    for (const sticker of state.stickers) {
      const key = sticker.p.join(',')
      let cubie = byPos.get(key)
      if (!cubie) {
        cubie = new THREE.Group()
        cubie.position.set(sticker.p[0] / 2, sticker.p[1] / 2, sticker.p[2] / 2)
        cubie.userData.p = [...sticker.p]
        cubie.add(new THREE.Mesh(this.bodyGeo, this.bodyMat))
        byPos.set(key, cubie)
        this.cubies.add(cubie)
      }
      const face = new THREE.Mesh(this.stickerGeo, this.mats[sticker.c])
      const normal = new THREE.Vector3(...sticker.n)
      face.position.copy(normal).multiplyScalar(0.491)
      face.quaternion.setFromUnitVectors(AXIS_VEC[2], normal)
      cubie.add(face)
    }

    this.glow.scale.setScalar(state.size * 1.9)
    this.glow.position.y = -state.size * 0.5 - 0.35
    ;(this.glow.material as THREE.MeshBasicMaterial).opacity = 0.9
  }

  private resize = (): void => {
    const w = max(1, this.el.clientWidth)
    const h = max(1, this.el.clientHeight)
    this.w = w
    this.h = h
    this.renderer.setSize(w, h)

    const cam = this.camera
    cam.aspect = w / h
    const size = this.state.size
    const yaw = THREE.MathUtils.degToRad(36)
    const pitch = THREE.MathUtils.degToRad(28)
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    )
    const look = new THREE.Vector3(0, -size * 0.12, 0)
    const half = size / 2
    const lift = 0.05 * size
    const corners = [-1, 1].flatMap((x) =>
      [-1, 1].flatMap((y) =>
        [-1, 1].map(
          (z) => new THREE.Vector3(x * half, y * (half + lift), z * half),
        ),
      ),
    )
    const topFit = 1 - min(0.35, (2 * this.insets.top) / h)
    const bottomFit = 1 - min(0.35, (2 * this.insets.bottom) / h)

    let distance = size * 4
    for (let i = 0; i < 6; i++) {
      cam.position.copy(dir).multiplyScalar(distance).add(look)
      cam.lookAt(look)
      cam.updateMatrixWorld()
      cam.updateProjectionMatrix()
      let maxNdc = 0
      for (const corner of corners) {
        const ndc = corner.clone().project(cam)
        maxNdc = max(
          maxNdc,
          Math.abs(ndc.x) / 0.94,
          ndc.y / topFit,
          -ndc.y / bottomFit,
        )
      }
      distance *= maxNdc
    }
    cam.position.copy(dir).multiplyScalar(distance).add(look)
    cam.lookAt(look)
    cam.updateProjectionMatrix()
  }

  private begin(axis: Axis, layer: number | null): void {
    this.pivot.rotation.set(0, 0, 0)
    this.pivot.updateMatrixWorld()
    for (const child of [...this.cubies.children]) {
      if (layer === null || (child.userData.p as Vec3)[axis] === layer) {
        this.pivot.attach(child)
      }
    }
  }

  private setAngle(axis: Axis, angle: number): void {
    this.pivot.rotation.set(
      axis === 0 ? angle : 0,
      axis === 1 ? angle : 0,
      axis === 2 ? angle : 0,
    )
  }

  private bake(
    anim: AnimState | (QueueItem & { from: number; start: number }),
  ): void {
    this.setAngle(anim.axis, anim.to)
    this.pivot.updateMatrixWorld()
    const mat = new THREE.Matrix4()

    for (const child of [...this.pivot.children]) {
      this.cubies.attach(child)
      child.position.set(
        Math.round(child.position.x * 2) / 2,
        Math.round(child.position.y * 2) / 2,
        Math.round(child.position.z * 2) / 2,
      )
      child.userData.p = [
        Math.round(child.position.x * 2),
        Math.round(child.position.y * 2),
        Math.round(child.position.z * 2),
      ]
      mat.makeRotationFromQuaternion(child.quaternion)
      for (let i = 0; i < 16; i++) mat.elements[i] = Math.round(mat.elements[i])
      child.quaternion.setFromRotationMatrix(mat)
    }

    this.pivot.rotation.set(0, 0, 0)
    const turns = ((anim.turns % 4) + 4) % 4
    if (turns !== 0) {
      const move: Move = {
        axis: anim.axis,
        layer: anim.layer,
        turns: turns === 3 ? -1 : turns,
      }
      this.state = applyMove(this.state, move)
      this.cb.onMove(move, this.state, anim.tag)
    }
    anim.done?.()
  }

  private flush(): void {
    if (this.anim) {
      const anim = this.anim
      this.anim = null
      this.bake(anim)
    }
    while (this.queue.length) {
      const item = this.queue.shift()!
      this.begin(item.axis, item.layer)
      this.bake({ ...item, from: 0, start: 0 })
    }
  }

  private step(now: number): void {
    let t = now
    for (;;) {
      if (!this.anim && this.queue.length && !this.drag?.rot) {
        const item = this.queue.shift()!
        this.begin(item.axis, item.layer)
        this.anim = { ...item, from: 0, start: t }
      }
      const anim = this.anim
      if (!anim) return
      const progress =
        anim.dur > 0 ? min(1, (now - anim.start) / (anim.dur * 1000)) : 1
      this.setAngle(
        anim.axis,
        anim.from + (anim.to - anim.from) * easeOutCubic(progress),
      )
      if (progress < 1) return
      this.anim = null
      this.bake(anim)
      t = min(now, anim.start + anim.dur * 1000)
    }
  }

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop)
    this.step(now)

    if (this.spin) {
      const p = min(1, (now - this.spin.start) / 1400)
      this.root.rotation.y = easeOutCubic(p) * Math.PI * 2
      if (p >= 1) {
        this.root.rotation.y = 0
        this.spin = null
      }
    }

    this.renderer.render(this.scene, this.camera)
  }

  private prevent = (e: Event): void => {
    e.preventDefault()
  }

  private ndc(x: number, y: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect()
    return new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1,
    )
  }

  private toScreen(point: THREE.Vector3): THREE.Vector2 {
    const ndc = point.clone().project(this.camera)
    return new THREE.Vector2(
      ((ndc.x + 1) / 2) * this.w,
      ((1 - ndc.y) / 2) * this.h,
    )
  }

  private pick(x: number, y: number): HitInfo | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera)
    const hit = this.raycaster.intersectObjects(this.cubies.children, true)[0]
    if (!hit?.face) return null

    let obj: THREE.Object3D | null = hit.object
    while (obj && !obj.userData.p) obj = obj.parent
    if (!obj) return null

    return {
      normal: dominantAxis(
        hit.face.normal.clone().transformDirection(hit.object.matrixWorld),
      ),
      p: [...(obj.userData.p as Vec3)] as Vec3,
      point: hit.point.clone(),
    }
  }

  private pickNear(x: number, y: number, touch: boolean): HitInfo | null {
    const hit = this.pick(x, y)
    if (hit || !touch) return hit
    for (const radius of [8, 16]) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const near = this.pick(
          x + Math.cos(a) * radius,
          y + Math.sin(a) * radius,
        )
        if (near) return near
      }
    }
    return null
  }

  private decide(
    drag: DragState,
    dx: number,
    dy: number,
    committed: boolean,
  ): void {
    const half = this.state.size / 2
    let normal: Vec3
    let point: THREE.Vector3

    if (drag.hit) {
      normal = drag.hit.normal
      point = drag.hit.point
    } else {
      const center = this.toScreen(
        this.root.getWorldPosition(new THREE.Vector3()),
      )
      const rect = this.renderer.domElement.getBoundingClientRect()
      normal = drag.x0 - rect.left < center.x ? [0, 0, 1] : [1, 0, 0]
      point = this.root.localToWorld(
        new THREE.Vector3(...normal).multiplyScalar(half),
      )
    }

    const faceAxis = axisOf(normal)
    const origin = this.toScreen(point)
    const dragVec = new THREE.Vector2(dx, dy)
    let best: {
      t: Vec3
      dir: THREE.Vector2
      px: number
      dot: number
    } | null = null

    for (const axis of [0, 1, 2] as Axis[]) {
      if (axis === faceAxis) continue
      const projected = this.toScreen(
        point.clone().addScaledVector(AXIS_VEC[axis], 0.5),
      ).sub(origin)
      const px = projected.length() * 2
      if (px < 0.001) continue
      const dir = projected.normalize()
      const dot = dragVec.dot(dir) / dragVec.length()
      if (!best || Math.abs(dot) > Math.abs(best.dot)) {
        const t: Vec3 = [0, 0, 0]
        t[axis] = Math.sign(dot) || 1
        best = {
          t,
          dir: dir.multiplyScalar(Math.sign(dot) || 1),
          px,
          dot,
        }
      }
    }

    if (!best || (!committed && Math.abs(best.dot) < 0.82)) return

    const rotAxisVec = cross(normal, best.t)
    const rotAxis = axisOf(rotAxisVec)
    const layer = drag.hit ? drag.hit.p[rotAxis] : null
    drag.rot = {
      axis: rotAxis,
      layer,
      sign: rotAxisVec[rotAxis],
      dir: best.dir,
      pxPerRad: best.px * max(0.75, half) * (drag.touch ? 0.62 : 1),
    }
    if (layer !== null) this.cb.onTurnStart()
    this.begin(rotAxis, layer)
  }

  private onDown = (e: PointerEvent): void => {
    if (this.drag || this.spin || (e.pointerType === 'mouse' && e.button !== 0))
      return
    if (this.locked) {
      this.drag = null
      return
    }

    this.flush()
    this.renderer.domElement.setPointerCapture?.(e.pointerId)

    const now = performance.now()
    const touch = e.pointerType !== 'mouse'
    this.drag = {
      id: e.pointerId,
      touch,
      x0: e.clientX,
      y0: e.clientY,
      t0: now,
      hit: this.pickNear(e.clientX, e.clientY, touch),
      rot: null,
      angle: 0,
      vel: 0,
      lastT: now,
      lastA: 0,
    }
  }

  private onMoveEvt = (e: PointerEvent): void => {
    const drag = this.drag
    if (!drag || e.pointerId !== drag.id) return

    const dx = e.clientX - drag.x0
    const dy = e.clientY - drag.y0
    if (!drag.rot) {
      const dist = Math.hypot(dx, dy)
      if (dist < (drag.touch ? 14 : 6)) return
      this.decide(drag, dx, dy, dist >= (drag.touch ? 36 : 20))
      if (!drag.rot) return
    }

    const { axis, sign, dir, pxPerRad } = drag.rot
    const angle = (sign * (dx * dir.x + dy * dir.y)) / pxPerRad
    const now = performance.now()
    const dt = max(1, now - drag.lastT)
    drag.vel = drag.vel * 0.6 + ((angle - drag.lastA) / dt) * 0.4
    drag.lastT = now
    drag.lastA = angle
    drag.angle = angle
    this.setAngle(axis, angle)
  }

  private onUp = (e: PointerEvent): void => {
    const drag = this.drag
    if (!drag || e.pointerId !== drag.id) return
    this.drag = null

    if (!drag.rot) {
      const now = performance.now()
      const dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0)
      if (e.type === 'pointerup' && now - drag.t0 < 300 && dist < 10) {
        const prev = this.lastTap
        const onCube = !!drag.hit
        if (
          onCube &&
          prev.onCube &&
          now - prev.t < 320 &&
          Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30
        ) {
          this.lastTap = { t: 0, x: 0, y: 0, onCube: false }
          this.cb.onDoubleTap()
        } else {
          this.lastTap = { t: now, x: e.clientX, y: e.clientY, onCube }
        }
      } else {
        this.lastTap = { t: 0, x: 0, y: 0, onCube: false }
      }
      return
    }

    const { axis, layer } = drag.rot
    const turns = snapTurns(
      drag.angle / QUARTER,
      (drag.vel * 140) / QUARTER,
      performance.now() - drag.lastT < 80,
    )
    const to = turns * QUARTER
    const dur = clamp(
      0.07 + (Math.abs(to - drag.angle) / QUARTER) * 0.18,
      0.07,
      0.28,
    )
    this.anim = {
      axis,
      layer,
      from: drag.angle,
      to,
      start: performance.now(),
      dur,
      turns,
      tag: 'user',
    }
  }
}
