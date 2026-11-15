import * as THREE from 'three'
import clamp from 'licia/clamp'
import { fbm, smoothstep } from '../../lib/noise'
import { dataToTexture, heightToNormalData } from '../../lib/texture'

/**
 * A flat tile that already lies in the XZ plane.
 *
 * Instanced meshes apply the instance matrix before the object's own
 * transform, so the rotation has to be baked into the geometry; otherwise the
 * instance position would be rotated along with the tile.
 */
export function createGroundPlane() {
  const geometry = new THREE.PlaneGeometry(1, 1)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

export interface ConcreteMaps {
  map: THREE.DataTexture
  roughnessMap: THREE.DataTexture
  normalMap: THREE.DataTexture
}

/**
 * Generates a seamless concrete map set (albedo / roughness / normal).
 * One continuous pour — no slab joints — with tileable noise so UV repeats
 * do not show a grid.
 */
export function createConcreteMaps(size = 512): ConcreteMaps {
  const albedo = new Uint8Array(size * size * 4)
  const rough = new Uint8Array(size * size * 4)
  const height = new Float32Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Sample in period space so every fbm octave wraps cleanly.
      const u = x / size
      const v = y / size
      const index = y * size + x

      // Higher frequencies keep the pour looking fine-grained when UV-tiled.
      const big = fbm(u * 8, v * 8, 1, 4, 8)
      const mid = fbm(u * 22, v * 22, 2, 5, 22)
      const fine = fbm(u * 72, v * 72, 3, 3, 72)
      const form = fbm(u * 14, v * 14, 4, 3, 14)

      const poreCell = fbm(u * 48, v * 48, 5, 2, 48)
      const pore =
        smoothstep(0.78, 0.94, poreCell) * smoothstep(0.35, 0.7, fine)

      // Soft hairline cracks — organic, not a lattice.
      const warpX = u + (fbm(u * 14, v * 14, 7, 3, 14) - 0.5) * 0.035
      const warpY = v + (fbm(u * 14, v * 14, 8, 3, 14) - 0.5) * 0.035
      const ridge = Math.abs(2 * fbm(warpX * 12, warpY * 12, 9, 3, 12) - 1)
      const crack =
        smoothstep(0.05, 0.012, ridge) *
        smoothstep(0.55, 0.75, fbm(u * 10, v * 10, 10, 2, 10)) *
        0.4

      const chipNoise = fbm(u * 64, v * 64, 12, 3, 64)
      const chip = smoothstep(0.84, 0.94, chipNoise + (fine - 0.5) * 0.06) * 0.7
      const stone = smoothstep(0.55, 0.35, fbm(u * 120, v * 120, 13, 2, 120))

      // Height for normals — shallow relief so the slab reads smooth.
      let h =
        0.55 + (mid - 0.5) * 0.12 + (fine - 0.5) * 0.08 + (form - 0.5) * 0.03
      h -= pore * 0.16 + crack * 0.08
      h = h * (1 - chip) + (0.48 + stone * 0.06 + fine * 0.04) * chip
      height[index] = clamp(h, 0, 1)

      let r = 0.46 + big * 0.06 + (mid - 0.5) * 0.04 + (form - 0.5) * 0.015
      let g = 0.45 + big * 0.055 + (mid - 0.5) * 0.035
      let b = 0.43 + big * 0.05 + (mid - 0.5) * 0.03
      const tint = fbm(u * 10, v * 10, 14, 3, 10)
      r *= 0.98 + tint * 0.04
      g *= 0.99 + (1 - tint) * 0.02
      b *= 1.0 + (1 - tint) * 0.03

      const stain = smoothstep(0.62, 0.88, fbm(u * 12, v * 12, 15, 3, 12))
      r *= 1 - stain * 0.1
      g *= 1 - stain * 0.09
      b *= 1 - stain * 0.08

      const eff = smoothstep(0.74, 0.92, fbm(u * 14, v * 14, 16, 3, 14))
      r = r * (1 - eff * 0.07) + 0.58 * eff * 0.07
      g = g * (1 - eff * 0.07) + 0.57 * eff * 0.07
      b = b * (1 - eff * 0.07) + 0.54 * eff * 0.07

      r *= 1 - pore * 0.28 - crack * 0.3
      g *= 1 - pore * 0.28 - crack * 0.3
      b *= 1 - pore * 0.28 - crack * 0.3

      const agR = 0.4 + stone * 0.08 + fine * 0.04
      const agG = 0.38 + stone * 0.07
      const agB = 0.35 + stone * 0.05
      r = r * (1 - chip) + agR * chip
      g = g * (1 - chip) + agG * chip
      b = b * (1 - chip) + agB * chip

      const pixel = index * 4
      albedo[pixel] = Math.round(clamp(r, 0, 1) * 255)
      albedo[pixel + 1] = Math.round(clamp(g, 0, 1) * 255)
      albedo[pixel + 2] = Math.round(clamp(b, 0, 1) * 255)
      albedo[pixel + 3] = 255

      const roughness =
        0.78 +
        (mid - 0.5) * 0.08 -
        (form - 0.5) * 0.04 +
        chip * 0.06 -
        stain * 0.03
      const roughByte = Math.round(clamp(roughness, 0, 1) * 255)
      rough[pixel] = roughByte
      rough[pixel + 1] = roughByte
      rough[pixel + 2] = roughByte
      rough[pixel + 3] = 255
    }
  }

  return {
    map: dataToTexture(albedo, size, true),
    roughnessMap: dataToTexture(rough, size, false),
    // Tiling normals (saltline Lw style) — wrap so UV repeats stay seamless.
    normalMap: dataToTexture(
      heightToNormalData(height, size, 1.8, true),
      size,
      false,
    ),
  }
}

function cloneDataTexture(source: THREE.DataTexture) {
  const texture = source.clone()
  texture.needsUpdate = true
  return texture
}

export function createConcreteMaterial(
  maps: ConcreteMaps,
  options: {
    repeat?: number
    color?: number
    roughness?: number
    metalness?: number
    normalScale?: number
    /** When true, clone maps so each material can use its own UV repeat. */
    exclusive?: boolean
  } = {},
) {
  const repeat = options.repeat ?? 4
  const map = options.exclusive ? cloneDataTexture(maps.map) : maps.map
  const roughnessMap = options.exclusive
    ? cloneDataTexture(maps.roughnessMap)
    : maps.roughnessMap
  const normalMap = options.exclusive
    ? cloneDataTexture(maps.normalMap)
    : maps.normalMap
  const bump = options.normalScale ?? 0.28

  map.repeat.set(repeat, repeat)
  roughnessMap.repeat.set(repeat, repeat)
  normalMap.repeat.set(repeat, repeat)

  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    normalMap,
    normalScale: new THREE.Vector2(bump, bump),
    color: options.color ?? 0xffffff,
    roughness: options.roughness ?? 1,
    metalness: options.metalness ?? 0.02,
  })
}
