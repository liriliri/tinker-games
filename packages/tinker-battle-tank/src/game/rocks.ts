import * as THREE from 'three'
import clamp from 'licia/clamp'
import each from 'licia/each'
import random from 'licia/random'
import seedRandom from 'licia/seedRandom'
import some from 'licia/some'
import { fbm, smoothstep } from '../lib/noise'
import { dataToTexture, heightToNormalData } from '../lib/texture'

/**
 * Beach rubble inspired by tinker-aquarium `createRubble`, with procedural
 * stone albedo / roughness / normals (same style as the arena concrete maps).
 */

const tmp = new THREE.Vector3()

/** Layered sines — same irregularity trick as aquarium reef rubble. */
function wobble(x: number, y: number, z: number, freq: number) {
  return (
    (Math.sin(x * freq) * Math.cos(z * freq * 1.31) +
      0.5 * Math.sin(y * freq * 1.87 + x * 0.7) * Math.cos(x * freq * 2.11) +
      0.25 * Math.sin(z * freq * 3.07 + y * 1.3)) /
    1.75
  )
}

interface RockMaps {
  map: THREE.DataTexture
  roughnessMap: THREE.DataTexture
  normalMap: THREE.DataTexture
}

/** Light cool-grey stone — soft mottling only, no hairline cracks. */
export function createRockMaps(size = 256): RockMaps {
  const albedo = new Uint8Array(size * size * 4)
  const rough = new Uint8Array(size * size * 4)
  const height = new Float32Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const index = y * size + x

      const big = fbm(u * 4, v * 4, 41, 4, 4)
      const mid = fbm(u * 12, v * 12, 42, 3, 12)
      const fine = fbm(u * 28, v * 28, 43, 2, 28)
      const form = fbm(u * 7, v * 7, 44, 3, 7)

      // Soft pits only — no crack ridges.
      const pore =
        smoothstep(0.82, 0.95, fbm(u * 28, v * 28, 45, 2, 28)) *
        smoothstep(0.35, 0.75, fine) *
        0.55

      let h =
        0.55 + (mid - 0.5) * 0.1 + (fine - 0.5) * 0.04 + (form - 0.5) * 0.05
      h -= pore * 0.1
      height[index] = clamp(h, 0, 1)

      const shade = 0.72 + big * 0.08 + (mid - 0.5) * 0.05 + (form - 0.5) * 0.02
      let r = shade * (0.98 + (fine - 0.5) * 0.02)
      let g = shade * (0.99 + (fine - 0.5) * 0.015)
      let b = shade * (1.02 + (mid - 0.5) * 0.02)
      r *= 1 - pore * 0.12
      g *= 1 - pore * 0.12
      b *= 1 - pore * 0.1

      const pixel = index * 4
      albedo[pixel] = Math.round(clamp(r, 0, 1) * 255)
      albedo[pixel + 1] = Math.round(clamp(g, 0, 1) * 255)
      albedo[pixel + 2] = Math.round(clamp(b, 0, 1) * 255)
      albedo[pixel + 3] = 255

      const roughness = 0.88 + (mid - 0.5) * 0.06 + pore * 0.04
      const rb = Math.round(clamp(roughness, 0, 1) * 255)
      rough[pixel] = rb
      rough[pixel + 1] = rb
      rough[pixel + 2] = rb
      rough[pixel + 3] = 255
    }
  }

  return {
    map: dataToTexture(albedo, size, true),
    roughnessMap: dataToTexture(rough, size, false),
    normalMap: dataToTexture(
      heightToNormalData(height, size, 1.4, true),
      size,
      false,
    ),
  }
}

/**
 * Aquarium-style rubble: subdivided icosahedron with wobble displacement,
 * spherical UVs, base at y=0.
 */
function createRubbleGeometry(
  seed = random(0, 1e9, true),
): THREE.BufferGeometry {
  const rnd = seedRandom(seed, 0, 1, true)
  const geometry = new THREE.IcosahedronGeometry(0.5, 2)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i += 1) {
    tmp.fromBufferAttribute(position, i)
    tmp.multiplyScalar(1 + 0.22 * wobble(tmp.x, tmp.y, tmp.z, 4.5))
    tmp.y *= 0.45 + rnd() * 0.12
    position.setXYZ(i, tmp.x, tmp.y, tmp.z)
  }
  const uvs = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i += 1) {
    tmp.fromBufferAttribute(position, i).normalize()
    uvs[i * 2] = 0.5 + Math.atan2(tmp.z, tmp.x) / (Math.PI * 2)
    uvs[i * 2 + 1] = 0.5 + Math.asin(clamp(tmp.y, -1, 1)) / Math.PI
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  geometry.translate(0, -box.min.y, 0)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

interface BeachRocks {
  group: THREE.Group
  dispose: () => void
}

/** Scatter irregular stones on the sand between the quay and open water. */
export function createBeachRocks(options: {
  quayHalf: number
  beachWidth: number
  islandDist: (x: number, z: number) => number
  islandHeight: (x: number, z: number) => number
  count?: number
}): BeachRocks {
  const { quayHalf, beachWidth, islandDist, islandHeight, count = 9 } = options

  const maps = createRockMaps(256)
  maps.map.repeat.set(1.4, 1.4)
  maps.roughnessMap.repeat.copy(maps.map.repeat)
  maps.normalMap.repeat.copy(maps.map.repeat)

  const material = new THREE.MeshStandardMaterial({
    color: 0xe4e6e8,
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.92,
    metalness: 0.02,
    fog: false,
  })

  const group = new THREE.Group()
  group.name = 'beach-rocks'
  const geometries: THREE.BufferGeometry[] = []
  const placed: { x: number; z: number; r: number }[] = []

  const inner = quayHalf + 0.45
  const outer = quayHalf + beachWidth * 0.72
  let attempts = 0
  while (placed.length < count && attempts < count * 40) {
    attempts += 1
    const ang = random(0, Math.PI * 2, true)
    const rad = random(inner, outer, true)
    // Soft jitter so stones don't sit on a perfect ring.
    const x = Math.cos(ang) * rad + random(-0.6, 0.6, true)
    const z = Math.sin(ang) * rad + random(-0.6, 0.6, true)
    const d = islandDist(x, z)
    if (d < inner || d > outer) continue

    const scale =
      random(0, 1, true) < 0.2
        ? random(0.22, 0.34, true)
        : random(0, 1, true) < 0.15
          ? random(0.55, 0.8, true)
          : random(0.32, 0.54, true)
    const radius = scale * 0.55
    if (
      some(
        placed,
        (p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (p.r + radius + 0.35) ** 2,
      )
    ) {
      continue
    }

    const geo = createRubbleGeometry(random(0, 1e9, true))
    geometries.push(geo)
    const mesh = new THREE.Mesh(geo, material)
    const y = islandHeight(x, z)
    // Sink slightly so the base meets the sand instead of floating.
    mesh.position.set(x, y - scale * 0.12, z)
    mesh.rotation.set(
      random(-0.175, 0.175, true),
      random(0, Math.PI * 2, true),
      random(-0.175, 0.175, true),
    )
    mesh.scale.set(
      scale * random(0.85, 1.15, true),
      scale * random(0.7, 1.05, true),
      scale * random(0.85, 1.15, true),
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    placed.push({ x, z, r: radius })
  }

  return {
    group,
    dispose() {
      each(geometries, (geo) => geo.dispose())
      material.dispose()
      maps.map.dispose()
      maps.roughnessMap.dispose()
      maps.normalMap.dispose()
    },
  }
}
