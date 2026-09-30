import * as THREE from 'three'
import { COLORS, WAVE } from './constants'
import { easeOutCubic, tweenProps } from '../lib/tween'

export class Wave {
  readonly obj: THREE.Mesh
  private readonly material: THREE.MeshBasicMaterial

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      color: COLORS.pureWhite,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.obj = new THREE.Mesh(
      new THREE.RingGeometry(WAVE.innerRadius, WAVE.outerRadius, WAVE.thetaSeg),
      this.material,
    )
    this.obj.rotation.x = -Math.PI / 2
    this.obj.visible = false
    this.obj.renderOrder = 2
  }

  play(x: number, y: number, z: number, index: number) {
    window.setTimeout(() => {
      this.obj.visible = true
      this.obj.position.set(x, y, z)
      this.obj.scale.set(1, 1, 1)
      this.material.opacity = 0.9
      const scale = { v: 1 }
      const opacity = { v: 0.9 }
      const duration = (2 / (index / 2.5 + 2)) * 500
      tweenProps(
        scale,
        { v: 4 },
        {
          duration,
          ease: easeOutCubic,
          onUpdate: () => {
            this.obj.scale.setScalar(scale.v)
          },
        },
      )
      tweenProps(
        opacity,
        { v: 0 },
        {
          duration,
          onUpdate: () => {
            this.material.opacity = opacity.v
          },
          onComplete: () => this.reset(),
        },
      )
    }, 200 * index)
  }

  reset() {
    this.obj.scale.set(1, 1, 1)
    this.material.opacity = 1
    this.obj.visible = false
  }
}
