import * as THREE from 'three'

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
