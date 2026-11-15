import * as THREE from 'three'
import type { PowerUpName } from '../types'
import { standardMaterial } from './camo'

const POWER_UP_COLORS: Record<PowerUpName, number> = {
  tank: 0x35c46a,
  star: 0xf5c542,
  grenade: 0xd94b3d,
  timer: 0x49b7e8,
  helmet: 0xe8eef5,
  shovel: 0xb3742c,
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
}

export function createShieldModel() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xbfe9ff,
    transparent: true,
    opacity: 0.42,
    roughness: 0.1,
    metalness: 0.1,
    side: THREE.DoubleSide,
  })
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 14, 10),
    material,
  )
  shield.position.y = 0.3
  shield.visible = false
  return shield
}

export function createBulletModel() {
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x6a7278,
    roughness: 0.48,
    metalness: 0.55,
  })
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x3e464c,
    roughness: 0.55,
    metalness: 0.4,
  })
  const noseMat = new THREE.MeshStandardMaterial({
    color: 0x9a8a68,
    roughness: 0.4,
    metalness: 0.45,
  })
  const flameCore = new THREE.MeshStandardMaterial({
    color: 0xfff0a0,
    emissive: 0xffcc44,
    emissiveIntensity: 1.8,
    roughness: 1,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  })
  const flameOuter = new THREE.MeshStandardMaterial({
    color: 0xff6a20,
    emissive: 0xff3a00,
    emissiveIntensity: 1.4,
    roughness: 1,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  })

  const group = new THREE.Group()
  // Solid missile facing +Z (matches bullet flight / rotation).
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.05, 0.2, 8),
    bodyMat,
  )
  body.rotation.x = Math.PI / 2
  group.add(body)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 8), noseMat)
  nose.rotation.x = Math.PI / 2
  nose.position.z = 0.14
  group.add(nose)
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.03, 8),
    bandMat,
  )
  band.rotation.x = Math.PI / 2
  band.position.z = -0.02
  group.add(band)
  for (const angle of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
    const fin = box(0.01, 0.07, 0.06, bandMat)
    fin.position.set(Math.cos(angle) * 0.055, Math.sin(angle) * 0.055, -0.08)
    group.add(fin)
  }

  // Exhaust plume — scene animates scale each frame.
  const flame = new THREE.Group()
  flame.name = 'flame'
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.16, 6),
    flameOuter,
  )
  outer.rotation.x = -Math.PI / 2
  outer.position.z = -0.18
  flame.add(outer)
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.12, 6), flameCore)
  core.rotation.x = -Math.PI / 2
  core.position.z = -0.16
  flame.add(core)
  group.add(flame)
  group.userData.flame = flame

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true
    }
  })
  // Flame shouldn't cast heavy shadows.
  outer.castShadow = false
  core.castShadow = false

  return group
}

export function createEagleModel() {
  const group = new THREE.Group()

  const gold = standardMaterial(0xe8b23f, { roughness: 0.42, metalness: 0.15 })
  const light = standardMaterial(0xf0d488, { roughness: 0.5 })
  const dark = standardMaterial(0x9a6d1c, { roughness: 0.6 })
  const beakMaterial = standardMaterial(0xe07b2a, { roughness: 0.5 })

  const base = box(
    0.78,
    0.1,
    0.78,
    standardMaterial(0x59616e, { roughness: 0.7 }),
  )
  base.position.y = 0.05
  group.add(base)

  const baseTrim = box(
    0.62,
    0.06,
    0.62,
    standardMaterial(0x8d949e, { roughness: 0.6 }),
  )
  baseTrim.position.y = 0.13
  group.add(baseTrim)

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), gold)
  body.scale.set(0.85, 0.8, 1.3)
  body.position.set(0, 0.32, -0.04)
  group.add(body)

  for (const side of [-1, 1]) {
    const feather = box(0.1, 0.05, 0.3, dark)
    feather.position.set(side * 0.07, 0.26, -0.3)
    feather.rotation.y = side * 0.18
    group.add(feather)
  }

  // Wings angled up so the silhouette reads from above.
  for (const side of [-1, 1]) {
    const wing = box(0.42, 0.07, 0.3, light)
    wing.position.set(side * 0.31, 0.4, -0.02)
    wing.rotation.z = side * 0.42
    wing.rotation.y = side * -0.16
    group.add(wing)

    const tip = box(0.16, 0.06, 0.2, gold)
    tip.position.set(side * 0.5, 0.5, -0.06)
    tip.rotation.z = side * 0.42
    group.add(tip)
  }

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), light)
  head.position.set(0, 0.44, 0.16)
  group.add(head)

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.16, 4),
    beakMaterial,
  )
  beak.rotation.x = Math.PI / 2
  beak.position.set(0, 0.43, 0.28)
  group.add(beak)

  for (const side of [-1, 1]) {
    const eye = box(
      0.035,
      0.035,
      0.035,
      standardMaterial(0x1a1a1a, { roughness: 0.3 }),
    )
    eye.position.set(side * 0.055, 0.47, 0.23)
    group.add(eye)
  }

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  return group
}

/** Colour encodes the power-up kind. */
export function createPowerUpModel(name: PowerUpName) {
  const group = new THREE.Group()
  const color = POWER_UP_COLORS[name]

  const core = box(
    0.42,
    0.42,
    0.42,
    standardMaterial(color, { roughness: 0.45 }),
  )
  group.add(core)

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.56, 0.56, 0.56)),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    }),
  )
  group.add(frame)

  const marker = box(
    0.16,
    0.16,
    0.16,
    standardMaterial(0xffffff, { roughness: 0.4 }),
  )
  marker.position.y = 0.3
  group.add(marker)

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true
    }
  })

  return group
}
