import * as THREE from 'three'
import clamp from 'licia/clamp'
import { fbm, smoothstep } from '../../lib/noise'
import { dataToTexture, heightToNormalData } from '../../lib/texture'
import { STEEL_SIZE } from '../constants'

export function createSteelGeometry() {
  return new THREE.BoxGeometry(STEEL_SIZE * 0.96, 0.38, STEEL_SIZE * 0.96)
}

interface SteelMaps {
  map: THREE.DataTexture
  roughnessMap: THREE.DataTexture
  metalnessMap: THREE.DataTexture
  normalMap: THREE.DataTexture
}

/**
 * Armored steel plate: beveled rim, corner rivets, and brushed wear.
 * Cool grey is baked in; instance colors should stay near-white shades.
 */
export function createSteelMaps(size = 128): SteelMaps {
  const albedo = new Uint8Array(size * size * 4)
  const rough = new Uint8Array(size * size * 4)
  const metal = new Uint8Array(size * size * 4)
  const height = new Float32Array(size * size)

  const rivets: Array<[number, number]> = [
    [0.18, 0.18],
    [0.82, 0.18],
    [0.18, 0.82],
    [0.82, 0.82],
  ]

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const index = y * size + x

      const edge = Math.min(u, v, 1 - u, 1 - v)
      const rim = 1 - smoothstep(0.05, 0.12, edge)
      const bevel =
        smoothstep(0.02, 0.08, edge) * (1 - smoothstep(0.1, 0.16, edge))

      const brush = fbm(u * 4, v * 64, 31, 3, 64)
      const wear = fbm(u * 14, v * 14, 32, 4, 14)
      const scratch =
        smoothstep(0.78, 0.92, fbm(u * 8, v * 48, 33, 2, 48)) *
        smoothstep(0.45, 0.7, wear)

      let rivet = 0
      let rivetH = 0
      for (const [rx, ry] of rivets) {
        const d = Math.hypot(u - rx, v - ry)
        const head = 1 - smoothstep(0.035, 0.055, d)
        const dome = Math.max(0, 1 - d / 0.05)
        rivet = Math.max(rivet, head)
        rivetH = Math.max(rivetH, dome * dome * 0.22)
      }

      let h =
        0.52 +
        (brush - 0.5) * 0.04 +
        (wear - 0.5) * 0.03 +
        bevel * 0.1 -
        rim * 0.06
      h += rivetH
      h -= scratch * 0.05
      height[index] = clamp(h, 0, 1)

      let r = 0.72 + (brush - 0.5) * 0.06 + (wear - 0.5) * 0.05
      let g = 0.76 + (brush - 0.5) * 0.05 + (wear - 0.5) * 0.04
      let b = 0.82 + (brush - 0.5) * 0.04 + (wear - 0.5) * 0.03
      r = r * (1 - rim * 0.18) + 0.45 * rim * 0.18
      g = g * (1 - rim * 0.18) + 0.48 * rim * 0.18
      b = b * (1 - rim * 0.18) + 0.52 * rim * 0.18
      r = r * (1 - scratch * 0.12) + 0.88 * scratch * 0.12
      g = g * (1 - scratch * 0.12) + 0.9 * scratch * 0.12
      b = b * (1 - scratch * 0.12) + 0.92 * scratch * 0.12
      r = r * (1 - rivet) + 0.42 * rivet
      g = g * (1 - rivet) + 0.46 * rivet
      b = b * (1 - rivet) + 0.52 * rivet

      const pixel = index * 4
      albedo[pixel] = Math.round(clamp(r, 0, 1) * 255)
      albedo[pixel + 1] = Math.round(clamp(g, 0, 1) * 255)
      albedo[pixel + 2] = Math.round(clamp(b, 0, 1) * 255)
      albedo[pixel + 3] = 255

      const roughness = clamp(
        0.28 +
          (brush - 0.5) * 0.12 +
          wear * 0.1 +
          rim * 0.12 +
          rivet * 0.08 -
          scratch * 0.1,
        0,
        1,
      )
      const roughByte = Math.round(roughness * 255)
      rough[pixel] = roughByte
      rough[pixel + 1] = roughByte
      rough[pixel + 2] = roughByte
      rough[pixel + 3] = 255

      const metalness = clamp(
        0.82 - wear * 0.12 - rim * 0.08 + scratch * 0.06 - rivet * 0.05,
        0,
        1,
      )
      const metalByte = Math.round(metalness * 255)
      metal[pixel] = metalByte
      metal[pixel + 1] = metalByte
      metal[pixel + 2] = metalByte
      metal[pixel + 3] = 255
    }
  }

  return {
    map: dataToTexture(albedo, size, true),
    roughnessMap: dataToTexture(rough, size, false),
    metalnessMap: dataToTexture(metal, size, false),
    normalMap: dataToTexture(
      heightToNormalData(height, size, 2.8),
      size,
      false,
    ),
  }
}

/** Keep instanceColor near-white so baked rivets / wear stay readable. */
export function createSteelMaterial(maps: SteelMaps) {
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    color: 0xffffff,
    roughness: 1,
    metalness: 1,
  })
}
