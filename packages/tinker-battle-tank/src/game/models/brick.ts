import * as THREE from 'three'
import clamp from 'licia/clamp'
import { fbm, smoothstep } from '../../lib/noise'
import { dataToTexture, heightToNormalData } from '../../lib/texture'
import { BRICK_SIZE } from '../constants'

export function createBrickGeometry() {
  const geometry = new THREE.BoxGeometry(
    BRICK_SIZE * 0.94,
    0.3,
    BRICK_SIZE * 0.94,
  )
  // aoMap reads uv2; BoxGeometry only ships with uv.
  geometry.setAttribute('uv2', geometry.attributes.uv.clone())
  return geometry
}

interface BrickMaps {
  map: THREE.DataTexture
  roughnessMap: THREE.DataTexture
  aoMap: THREE.DataTexture
  normalMap: THREE.DataTexture
}

/**
 * Single clay brick face with a deep mortar rim and strong clay mottling.
 * Mid terracotta is baked in; instanceColor supplies per-block hue / value.
 */
export function createBrickMaps(size = 128): BrickMaps {
  const albedo = new Uint8Array(size * size * 4)
  const rough = new Uint8Array(size * size * 4)
  const ao = new Uint8Array(size * size * 4)
  const height = new Float32Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const index = y * size + x

      const edge = Math.min(u, v, 1 - u, 1 - v)
      const mortar = 1 - smoothstep(0.035, 0.12, edge)

      const clay = fbm(u * 14, v * 14, 21, 5, 14)
      const blotch = fbm(u * 7, v * 9, 26, 4, 0)
      const grain = fbm(u * 56, v * 56, 22, 3, 56)
      const streak = fbm(u * 5, v * 32, 23, 3, 0)
      const chip = smoothstep(0.8, 0.94, fbm(u * 36, v * 36, 24, 3, 36))
      const pit =
        smoothstep(0.78, 0.94, fbm(u * 44, v * 44, 25, 2, 44)) *
        (1 - mortar) *
        0.7

      // Deep mortar groove + lumpy clay face.
      let h =
        0.68 +
        (clay - 0.5) * 0.16 +
        (blotch - 0.5) * 0.1 +
        (grain - 0.5) * 0.06 +
        (streak - 0.5) * 0.04
      h = h * (1 - mortar) + 0.16 * mortar
      h -= chip * 0.16 + pit * 0.22
      h -= (1 - smoothstep(0.07, 0.15, edge)) * 0.1 * (1 - mortar)
      height[index] = clamp(h, 0, 1)

      // Wide clay value / hue range: pale peach → deep wine red.
      const value = 0.55 + clay * 0.45 + (blotch - 0.5) * 0.35
      const warmth = 0.35 + blotch * 0.45 + (streak - 0.5) * 0.2
      let r = 0.42 + value * 0.5 + warmth * 0.18
      let g = 0.16 + value * 0.22 + (1 - warmth) * 0.06
      let b = 0.1 + value * 0.1 + (1 - warmth) * 0.04
      const scorch = smoothstep(0.62, 0.88, blotch) * (1 - mortar)
      r *= 1 - scorch * 0.35
      g *= 1 - scorch * 0.4
      b *= 1 - scorch * 0.38
      const pale = smoothstep(0.72, 0.9, 1 - blotch) * (1 - mortar) * 0.55
      r = r * (1 - pale) + 0.9 * pale
      g = g * (1 - pale) + 0.55 * pale
      b = b * (1 - pale) + 0.38 * pale
      r *= 1 - chip * 0.22 - pit * 0.3
      g *= 1 - chip * 0.2 - pit * 0.28
      b *= 1 - chip * 0.18 - pit * 0.26

      // Mortar: light cement so instance tints leave it readable as grout.
      const mr = 0.72 + grain * 0.08
      const mg = 0.7 + grain * 0.07
      const mb = 0.66 + grain * 0.06
      r = r * (1 - mortar) + mr * mortar
      g = g * (1 - mortar) + mg * mortar
      b = b * (1 - mortar) + mb * mortar

      const pixel = index * 4
      albedo[pixel] = Math.round(clamp(r, 0, 1) * 255)
      albedo[pixel + 1] = Math.round(clamp(g, 0, 1) * 255)
      albedo[pixel + 2] = Math.round(clamp(b, 0, 1) * 255)
      albedo[pixel + 3] = 255

      const roughness =
        0.82 +
        (grain - 0.5) * 0.14 +
        mortar * 0.12 +
        scorch * 0.08 -
        chip * 0.06 +
        pit * 0.1
      const roughByte = Math.round(clamp(roughness, 0, 1) * 255)
      rough[pixel] = roughByte
      rough[pixel + 1] = roughByte
      rough[pixel + 2] = roughByte
      rough[pixel + 3] = 255

      const occlude = clamp(1 - mortar * 0.55 - pit * 0.35 - chip * 0.12, 0, 1)
      const aoByte = Math.round(occlude * 255)
      ao[pixel] = aoByte
      ao[pixel + 1] = aoByte
      ao[pixel + 2] = aoByte
      ao[pixel + 3] = 255
    }
  }

  return {
    map: dataToTexture(albedo, size, true),
    roughnessMap: dataToTexture(rough, size, false),
    aoMap: dataToTexture(ao, size, false),
    normalMap: dataToTexture(
      heightToNormalData(height, size, 3.6),
      size,
      false,
    ),
  }
}

/** instanceColor supplies per-block hue / value. */
export function createBrickMaterial(maps: BrickMaps) {
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    aoMap: maps.aoMap,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    aoMapIntensity: 1.15,
    color: 0xffffff,
    roughness: 1,
    metalness: 0.02,
  })
}
