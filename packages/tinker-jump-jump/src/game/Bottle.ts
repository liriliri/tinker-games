import * as THREE from 'three'
import random from 'licia/random'
import clamp from 'licia/clamp'
import { BLOCK, BOTTLE, GAME } from './constants'
import { easeOutBounce, easeOutCubic, tweenProps } from '../lib/tween'

type BottleStatus = 'stop' | 'prepare' | 'jump' | 'fall' | 'showup'

type ParticleMesh = THREE.Mesh & {
  gathering?: boolean
  scattering?: boolean
}

export class Bottle {
  readonly obj = new THREE.Object3D()
  status: BottleStatus = 'stop'
  direction: 'straight' | 'left' = 'straight'
  velocity = { vy: 0, vz: 0 }
  flyingTime = 0
  scale = 1
  destination: [number, number] = [0, 0]

  private readonly bottle: THREE.Object3D
  private readonly human: THREE.Object3D
  private readonly body: THREE.Object3D
  private readonly head: THREE.Mesh
  private readonly bottom: THREE.Mesh
  private readonly middle: THREE.Object3D
  private readonly particles: ParticleMesh[] = []
  private axis = new THREE.Vector3(1, 0, 0)
  private gatherTimer: number | null = null
  private readonly headRestY = 4.725

  constructor() {
    this.obj.name = 'bottle'
    // Match original bottle scale: h = 2.1 * 0.45
    const h = 2.1 * 0.45

    const glass = (color: number) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.16,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        reflectivity: 0.85,
        envMapIntensity: 1.15,
        ior: 1.5,
      })

    // Two-tone dark blue glass.
    const headMat = glass(0x1e4a8c)
    const bodyMat = glass(0x0f2d5c)

    this.head = new THREE.Mesh(new THREE.SphereGeometry(h, 20, 16), headMat)
    this.head.position.y = this.headRestY
    this.head.castShadow = true

    this.bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88 * h, 1.27 * h, 2.68 * h, 20),
      bodyMat,
    )
    this.bottom.rotation.y = 4.7
    this.bottom.castShadow = true

    const midCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(h, 0.88 * h, 1.2 * h, 16),
      bodyMat,
    )
    midCylinder.position.y = 1.94 * h
    midCylinder.rotation.y = 4.7
    midCylinder.castShadow = true

    const midCap = new THREE.Mesh(new THREE.SphereGeometry(h, 16, 12), bodyMat)
    midCap.scale.set(1, 0.54, 1)
    midCap.position.y = 2.54 * h
    midCap.castShadow = true

    this.middle = new THREE.Object3D()
    this.middle.add(midCylinder)
    this.middle.add(midCap)

    this.body = new THREE.Object3D()
    this.body.add(this.bottom)
    this.body.add(this.middle)

    this.human = new THREE.Object3D()
    this.human.add(this.body)
    this.human.add(this.head)

    this.bottle = new THREE.Object3D()
    this.bottle.add(this.human)
    this.bottle.position.y = BOTTLE.bodyHeight / 2 - 0.25
    this.obj.add(this.bottle)

    this.createParticles()
    this.obj.position.y = BLOCK.height / 2
  }

  prepare() {
    this.status = 'prepare'
    this.scale = 1
    this.gatherParticles()
  }

  update(dt: number) {
    if (this.status === 'prepare') {
      this.charge()
    } else if (this.status === 'jump') {
      this.fly(dt)
    }
  }

  jump(axis: THREE.Vector3) {
    this.resetParticles()
    this.status = 'jump'
    this.axis.copy(axis).normalize()
    this.flyingTime = 0
    this.body.scale.set(1, 1, 1)
    this.head.position.set(0, this.headRestY, 0)
    this.scale = 1
    this.playJumpSquash()
  }

  stop() {
    this.status = 'stop'
    this.flyingTime = 0
    this.scale = 1
    this.velocity = { vy: 0, vz: 0 }
    this.body.scale.set(1, 1, 1)
    this.head.position.set(0, this.headRestY, 0)
    this.human.rotation.set(0, 0, 0)
    this.obj.position.y = BLOCK.height / 2
  }

  /** Drop onto the ground plane and stay there (like the original). */
  fall() {
    if (this.status === 'fall') return
    this.status = 'fall'
    this.resetParticles()
    const pos = { y: this.obj.position.y }
    tweenProps(
      pos,
      { y: GAME.groundY },
      {
        duration: 400,
        onUpdate: () => {
          this.obj.position.y = pos.y
        },
        onComplete: () => {
          this.obj.position.y = GAME.groundY
        },
      },
    )
  }

  lookAt(dir: 'straight' | 'left') {
    this.direction = dir
  }

  squeeze() {
    const scale = { x: 1, y: 1, z: 1 }
    tweenProps(
      scale,
      { x: 1.07, y: 0.9, z: 1.07 },
      {
        duration: 150,
        onUpdate: () => this.body.scale.set(scale.x, scale.y, scale.z),
      },
    )
    tweenProps(
      scale,
      { x: 1, y: 1, z: 1 },
      {
        duration: 150,
        delay: 150,
        onUpdate: () => {
          if (this.status === 'stop') {
            this.body.scale.set(scale.x, scale.y, scale.z)
          }
        },
      },
    )
    const headY = { y: this.head.position.y }
    tweenProps(
      headY,
      { y: this.headRestY },
      {
        duration: 150,
        delay: 150,
        onUpdate: () => {
          this.head.position.y = headY.y
        },
      },
    )
  }

  showup(onDone?: () => void) {
    this.status = 'showup'
    this.human.rotation.set(0, 0, 0)
    this.body.scale.set(1, 1, 1)
    this.head.position.set(0, this.headRestY, 0)
    this.obj.position.y = 25
    const pos = { y: 25 }
    tweenProps(
      pos,
      { y: BLOCK.height / 2 },
      {
        duration: 520,
        ease: easeOutBounce,
        onUpdate: () => {
          this.obj.position.y = pos.y
        },
        onComplete: () => {
          this.status = 'stop'
          this.obj.position.y = BLOCK.height / 2
          onDone?.()
        },
      },
    )
  }

  scatterParticles() {
    for (let i = 0; i < 10; i++) {
      const p = this.particles[i]
      p.scattering = true
      p.gathering = false
      this.runScatter(p)
    }
  }

  private createParticles() {
    const whiteMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    const greenMat = new THREE.MeshBasicMaterial({
      color: 0x7dffb0,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    const geo = new THREE.PlaneGeometry(0.55, 0.55)

    for (let i = 0; i < 15; i++) {
      const mesh = new THREE.Mesh(geo, whiteMat.clone()) as ParticleMesh
      mesh.rotation.set(-Math.PI / 5, -Math.PI / 4, -Math.PI / 5)
      mesh.visible = false
      this.particles.push(mesh)
      this.obj.add(mesh)
    }
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(geo, greenMat.clone()) as ParticleMesh
      mesh.rotation.set(-Math.PI / 5, -Math.PI / 4, -Math.PI / 5)
      mesh.visible = false
      this.particles.push(mesh)
      this.obj.add(mesh)
    }
  }

  private gatherParticles() {
    this.resetParticles()
    for (let i = 10; i < 20; i++) {
      const p = this.particles[i]
      p.gathering = true
      p.scattering = false
      this.runGather(p)
    }
    this.gatherTimer = window.setTimeout(
      () => {
        for (let i = 0; i < 10; i++) {
          const p = this.particles[i]
          p.gathering = true
          p.scattering = false
          this.runGather(p)
        }
      },
      500 + random(0, 1000),
    )
  }

  private resetParticles() {
    if (this.gatherTimer != null) {
      clearTimeout(this.gatherTimer)
      this.gatherTimer = null
    }
    for (const p of this.particles) {
      p.gathering = false
      p.scattering = false
      p.visible = false
    }
  }

  private runGather(p: ParticleMesh) {
    if (!p.gathering) return
    const half = BOTTLE.bodyWidth / 2
    const sign = () => (random(0, 1) === 0 ? -1 : 1)
    const x = random(1.2, 2.4, true) * sign()
    const z = random(1.2, 2.4, true) * sign()
    p.position.set(x, random(2.2, 3.2, true), z)
    p.scale.setScalar(random(0.15, 0.35, true))
    p.visible = true
    const pos = { x: p.position.x, y: p.position.y, z: p.position.z }
    const scale = { v: p.scale.x }
    const dur = random(480, 760, true)
    tweenProps(
      pos,
      { x: 0, y: half * 0.35, z: 0 },
      {
        duration: dur,
        ease: easeOutCubic,
        onUpdate: () => {
          if (!p.gathering) return
          p.position.set(pos.x, pos.y, pos.z)
        },
        onComplete: () => {
          if (p.gathering) {
            p.visible = false
            this.runGather(p)
          }
        },
      },
    )
    tweenProps(
      scale,
      { v: 0.05 },
      {
        duration: dur,
        onUpdate: () => {
          if (p.gathering) p.scale.setScalar(scale.v)
        },
      },
    )
  }

  private runScatter(p: ParticleMesh) {
    const half = BOTTLE.bodyWidth / 2
    const x = random(half, 2, true) * (1 - 2 * random(0, 1, true))
    const z = random(half, 2, true) * (1 - 2 * random(0, 1, true))
    p.scale.set(1, 1, 1)
    p.visible = false
    p.position.set(x, -0.5, z)
    window.setTimeout(() => {
      if (!p.scattering) return
      p.visible = true
      const dur = random(300, 500, true)
      const scale = { v: 1 }
      const pos = { x, y: -0.5, z }
      tweenProps(
        scale,
        { v: 0.2 },
        {
          duration: dur,
          onUpdate: () => p.scale.setScalar(scale.v),
        },
      )
      tweenProps(
        pos,
        { x: 2 * x, y: random(2, 4.5, true), z: 2 * z },
        {
          duration: dur,
          onUpdate: () => p.position.set(pos.x, pos.y, pos.z),
          onComplete: () => {
            p.scattering = false
            p.visible = false
          },
        },
      )
    }, 0)
  }

  private playJumpSquash() {
    const intensity = clamp(this.velocity.vz / 35, 1.2, 1.4)
    const rot = { v: 0 }
    const axis = this.direction === 'straight' ? 'z' : 'x'
    tweenProps(
      rot,
      { v: -Math.PI },
      {
        duration: 140,
        onUpdate: () => {
          this.human.rotation[axis] = rot.v
        },
      },
    )
    tweenProps(
      rot,
      { v: -Math.PI * 2 },
      {
        duration: 180,
        delay: 140,
        onUpdate: () => {
          this.human.rotation[axis] = rot.v
        },
        onComplete: () => {
          this.human.rotation[axis] = 0
        },
      },
    )

    const head = {
      y: this.headRestY,
      side: 0,
    }
    const headTo =
      this.direction === 'straight'
        ? { y: this.headRestY + 0.9 * intensity, side: 0.45 * intensity }
        : { y: this.headRestY + 0.9 * intensity, side: -0.45 * intensity }
    tweenProps(head, headTo, {
      duration: 100,
      onUpdate: () => {
        this.head.position.y = head.y
        if (this.direction === 'straight') {
          this.head.position.x = head.side
        } else {
          this.head.position.z = head.side
        }
      },
    })
    tweenProps(
      head,
      { y: this.headRestY - 0.9 * intensity, side: -headTo.side },
      {
        duration: 100,
        delay: 100,
        onUpdate: () => {
          this.head.position.y = head.y
          if (this.direction === 'straight') {
            this.head.position.x = head.side
          } else {
            this.head.position.z = head.side
          }
        },
      },
    )
    tweenProps(
      head,
      { y: this.headRestY, side: 0 },
      {
        duration: 150,
        delay: 250,
        onUpdate: () => {
          this.head.position.y = head.y
          this.head.position.x = 0
          this.head.position.z = 0
        },
      },
    )
  }

  private charge() {
    if (this.scale <= BOTTLE.minScale) return
    this.scale = clamp(this.scale - BOTTLE.reduction, BOTTLE.minScale, 1)
    this.body.scale.y = this.scale
    this.body.scale.x = clamp(this.body.scale.x + 0.007, 0, 1.35)
    this.body.scale.z = clamp(this.body.scale.z + 0.007, 0, 1.35)
    this.head.position.y -= 0.018
    this.obj.position.y -= ((BLOCK.reduction / 2) * BLOCK.height) / 2 + 0.027
  }

  private fly(dt: number) {
    const dz = this.velocity.vz * dt
    const dy =
      this.velocity.vy * dt -
      (GAME.gravity / 2) * dt * dt -
      GAME.gravity * this.flyingTime * dt
    this.flyingTime += dt
    this.obj.position.y += dy
    this.obj.position.x += this.axis.x * dz
    this.obj.position.z += this.axis.z * dz
  }
}
