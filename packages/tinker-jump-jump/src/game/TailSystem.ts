import * as THREE from 'three'
import type { Bottle } from './Bottle'

const LIFETIME_MS = 100
const PLANE_W = 0.5
const PLANE_H = 2
const DOT_GAP = 0.5
const POOL_SIZE = 20

class Tail {
  tickTime = 0
  readonly mesh: THREE.Mesh

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.visible = false
    this.mesh.name = 'tail'
    this.mesh.frustumCulled = false
  }

  reset() {
    this.tickTime = 0
    this.mesh.scale.set(1, 1, 1)
    this.mesh.visible = false
  }
}

/**
 * Jump speed-lines — same approach as the original tailSystem:
 * drop short white planes along the flight path that shrink away quickly.
 */
export class TailSystem {
  private readonly scene: THREE.Scene
  private readonly bottle: Bottle
  private readonly geometry: THREE.PlaneGeometry
  private readonly material: THREE.MeshBasicMaterial
  private readonly remain: Tail[] = []
  private readonly using: Tail[] = []
  private lastDot = new THREE.Vector3()
  private readonly now = new THREE.Vector3()
  private readonly tmpFrom = new THREE.Vector3()
  private readonly tmpTo = new THREE.Vector3()

  constructor(scene: THREE.Scene, bottle: Bottle) {
    this.scene = scene
    this.bottle = bottle
    this.geometry = new THREE.PlaneGeometry(PLANE_W, PLANE_H)
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    })
    for (let i = 0; i < POOL_SIZE; i++) {
      const tail = new Tail(this.geometry, this.material)
      this.scene.add(tail.mesh)
      this.remain.push(tail)
    }
    this.lastDot.copy(this.bottle.obj.position)
  }

  update(dtSec: number) {
    const dtMs = dtSec * 1000
    this.tickActive(dtMs)

    if (this.bottle.status === 'prepare') {
      this.lastDot.copy(this.bottle.obj.position)
      return
    }

    if (this.bottle.status !== 'jump') return

    this.now.copy(this.bottle.obj.position)
    const dist = this.now.distanceTo(this.lastDot)
    if (dist >= 5) {
      // Teleport / large snap — resync without spawning a streak.
      this.lastDot.copy(this.now)
      return
    }
    if (dist < DOT_GAP) return

    const steps = dist / DOT_GAP
    const count = Math.floor(steps)
    let prev = this.lastDot.clone()
    for (let h = 1; h <= count; h++) {
      const t = h / steps
      this.tmpTo.copy(this.lastDot).lerp(this.now, t)
      let scaleY = 1 + (dtMs / LIFETIME_MS) * (t - 1)
      if (scaleY < 0) scaleY = 0
      this.lay(prev, this.tmpTo, scaleY)
      prev = this.tmpTo.clone()
      if (h === count) this.lastDot.copy(this.tmpTo)
    }
  }

  /** Call when the bottle snaps to a new pose so the next jump starts clean. */
  correctPosition() {
    this.lastDot.copy(this.bottle.obj.position)
  }

  reset() {
    while (this.using.length) {
      const tail = this.using.pop()!
      tail.reset()
      this.remain.push(tail)
    }
    this.lastDot.copy(this.bottle.obj.position)
  }

  private tickActive(dtMs: number) {
    const shrink = dtMs / LIFETIME_MS
    for (let i = this.using.length - 1; i >= 0; i--) {
      const tail = this.using[i]
      tail.tickTime += dtMs
      const nextY = tail.mesh.scale.y - shrink
      if (nextY > 0 && tail.tickTime < LIFETIME_MS) {
        tail.mesh.scale.y = nextY
        continue
      }
      tail.reset()
      this.using.splice(i, 1)
      this.remain.push(tail)
    }
  }

  private lay(from: THREE.Vector3, to: THREE.Vector3, scaleY: number) {
    const tail = this.acquire()
    this.using.push(tail)
    this.tmpFrom.copy(from)
    tail.mesh.position.copy(to)
    tail.mesh.scale.set(1, scaleY, 1)
    tail.mesh.lookAt(this.tmpFrom)
    tail.mesh.rotateY(Math.PI / 2)
    tail.mesh.visible = true
  }

  private acquire(): Tail {
    const pooled = this.remain.pop()
    if (pooled) return pooled
    const tail = new Tail(this.geometry, this.material)
    this.scene.add(tail.mesh)
    return tail
  }
}
