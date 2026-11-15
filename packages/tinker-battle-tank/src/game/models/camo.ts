import * as THREE from 'three'
import clamp from 'licia/clamp'
import { fbm, smoothstep } from '../../lib/noise'
import { dataToTexture } from '../../lib/texture'
import type { TankPalette } from './palette'

/** Dull armour / prop paint — metalness stays low so camo reads. */
export function standardMaterial(
  color: number,
  options: Partial<THREE.MeshStandardMaterialParameters> = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.05,
    ...options,
  })
}

/** Shared grayscale blotch map — multiplies with each panel's solid colour. */
let maskTexture: THREE.DataTexture | null = null

/**
 * Soft luminance mask so body / light / dark panels keep their palette
 * colours. Large NATO-style islands with enough contrast to read at cell size.
 */
function getCamoMask(size = 128) {
  if (maskTexture) return maskTexture

  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      // Low frequency → big patches across a panel.
      const island = fbm(u * 2.2, v * 2.2, 41, 4, 2.2)
      const blotch = fbm(u * 3.4 + 1.7, v * 3.4 - 0.9, 73, 3, 3.4)
      const grit = fbm(u * 10, v * 10, 97, 2, 10)

      const darkW = smoothstep(0.48, 0.62, island + (grit - 0.5) * 0.06)
      const lightW =
        (1 - darkW) * smoothstep(0.46, 0.6, blotch + (grit - 0.5) * 0.05)

      let luma = 0.9
      luma = luma * (1 - darkW) + 0.62 * darkW
      luma = luma * (1 - lightW) + 1.05 * lightW
      luma += (grit - 0.5) * 0.03
      const byte = Math.round(clamp(luma * 255, 0, 255))

      const i = (y * size + x) * 4
      data[i] = byte
      data[i + 1] = byte
      data[i + 2] = byte
      data[i + 3] = 255
    }
  }

  maskTexture = dataToTexture(data, size, false)
  // Fewer repeats so each blotch covers more of the hull / turret.
  maskTexture.repeat.set(1.15, 1.15)
  return maskTexture
}

type TintRole = 'body' | 'light' | 'dark'

export function applyCamoMap(
  material: THREE.MeshStandardMaterial,
  palette: TankPalette,
  /** 0–1 red power-up glow; 0 clears emissive. */
  glow = 0,
) {
  const role = material.userData.tintRole as TintRole | undefined
  const hex =
    role === 'light'
      ? palette.light
      : role === 'dark'
        ? palette.dark
        : palette.body
  material.map = getCamoMask()
  material.color.setHex(hex)
  if (glow > 0.01) {
    // Light panels take more glow so the pulse reads on the silhouette.
    const weight = role === 'light' ? 1 : role === 'dark' ? 0.45 : 0.75
    material.emissive.setHex(0xff2a12)
    material.emissiveIntensity = glow * glow * 1.15 * weight
  } else {
    material.emissive.setHex(0x000000)
    material.emissiveIntensity = 0
  }
  material.needsUpdate = true
}
