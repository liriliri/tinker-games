import * as THREE from 'three'
import clamp from 'licia/clamp'

/** RGBA DataTexture with repeat + mipmaps for procedural albedo / maps. */
export function dataToTexture(data: Uint8Array, size: number, srgb: boolean) {
  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  )
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.needsUpdate = true
  texture.flipY = false
  return texture
}

/**
 * Tangent-space normals from a height field.
 * `wrap` for seamless tiles; otherwise edges clamp.
 */
export function heightToNormalData(
  height: Float32Array,
  size: number,
  strength: number,
  wrap = false,
) {
  const normals = new Uint8Array(size * size * 4)
  const at = (x: number, y: number) => {
    if (wrap) {
      const sx = ((x % size) + size) % size
      const sy = ((y % size) + size) % size
      return height[sy * size + sx]
    }
    const sx = x < 0 ? 0 : x > size - 1 ? size - 1 : x
    const sy = y < 0 ? 0 : y > size - 1 ? size - 1 : y
    return height[sy * size + sx]
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const invLen = 1 / Math.hypot(dx, dy, 1)
      const pixel = (y * size + x) * 4
      normals[pixel] = Math.round(clamp(0.5 - dx * invLen * 0.5, 0, 1) * 255)
      normals[pixel + 1] = Math.round(
        clamp(0.5 - dy * invLen * 0.5, 0, 1) * 255,
      )
      normals[pixel + 2] = Math.round(clamp(0.5 + 0.5 * invLen, 0, 1) * 255)
      normals[pixel + 3] = 255
    }
  }
  return normals
}
