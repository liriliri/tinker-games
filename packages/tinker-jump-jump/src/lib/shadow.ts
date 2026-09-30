import * as THREE from 'three'
import { BLOCK } from '../game/constants'

export type ShadowKind = 'box' | 'cylinder' | 'desk'

const shared: Record<ShadowKind, THREE.BufferGeometry | null> = {
  box: null,
  cylinder: null,
  desk: null,
}

function boxShadowShape(): THREE.Shape {
  // Chamfered square.
  const s = 5.5
  const shape = new THREE.Shape()
  shape.moveTo(-s, s)
  shape.lineTo(s, s)
  shape.lineTo(s, -s)
  shape.lineTo(-4.37, -s)
  shape.lineTo(-s, -1.85)
  shape.lineTo(-s, s)
  return shape
}

/**
 * Full capsule: width = cylinder diameter, both ends rounded.
 * Near tip at y=0; Block places it under the cylinder when settled so only
 * the far arc shows, while the drop-in tween reveals both arcs.
 */
function cylinderShadowShape(): THREE.Shape {
  const r = BLOCK.radius
  const body = 6
  const yNear = r
  const yFar = r + body
  const shape = new THREE.Shape()
  const segs = 24

  shape.moveTo(-r, yNear)
  shape.lineTo(-r, yFar)
  for (let i = 1; i <= segs; i++) {
    const a = Math.PI - (i / segs) * Math.PI // π → 0 (far tip)
    shape.lineTo(Math.cos(a) * r, yFar + Math.sin(a) * r)
  }
  shape.lineTo(r, yNear)
  for (let i = 1; i <= segs; i++) {
    const a = 0 - (i / segs) * Math.PI // 0 → −π (near tip at y=0)
    shape.lineTo(Math.cos(a) * r, yNear + Math.sin(a) * r)
  }
  return shape
}

/**
 * Desk / stool shadow — traced from original desk_shadow.png (11×11 plane).
 * Top: elliptical cap; bottom: thinner half-capsule stem.
 */
const DESK_SHADOW_OUTLINE: [number, number][] = [
  [-0.651, 5.5],
  [-2.228, 5.197],
  [-3.016, 4.894],
  [-3.608, 4.591],
  [-4.041, 4.287],
  [-4.396, 3.984],
  [-4.711, 3.681],
  [-4.948, 3.378],
  [-5.145, 3.075],
  [-5.303, 2.772],
  [-5.382, 2.469],
  [-5.461, 2.165],
  [-5.5, 1.862],
  [-5.5, 1.559],
  [-5.461, 1.256],
  [-5.342, 0.953],
  [-5.145, 0.65],
  [-4.909, 0.346],
  [-4.554, 0.043],
  [-4.12, -0.26],
  [-3.647, -0.563],
  [-3.095, -0.866],
  [-2.78, -1.169],
  [-2.74, -1.472],
  [-2.74, -1.776],
  [-2.78, -2.079],
  [-2.78, -2.382],
  [-2.78, -2.685],
  [-2.74, -2.988],
  [-2.661, -3.291],
  [-2.582, -3.594],
  [-2.464, -3.898],
  [-2.306, -4.201],
  [-2.07, -4.504],
  [-1.794, -4.807],
  [-1.4, -5.11],
  [-0.729, -5.413],
  [0.966, -5.327],
  [1.518, -5.024],
  [1.873, -4.72],
  [2.149, -4.417],
  [2.346, -4.114],
  [2.504, -3.811],
  [2.622, -3.508],
  [2.701, -3.205],
  [2.74, -2.902],
  [2.78, -2.598],
  [2.78, -2.295],
  [2.74, -1.992],
  [2.74, -1.689],
  [2.74, -1.386],
  [2.819, -1.083],
  [3.253, -0.78],
  [3.805, -0.476],
  [4.278, -0.173],
  [4.672, 0.13],
  [4.987, 0.433],
  [5.224, 0.736],
  [5.382, 1.039],
  [5.461, 1.343],
  [5.5, 1.646],
  [5.5, 1.949],
  [5.461, 2.252],
  [5.382, 2.555],
  [5.263, 2.858],
  [5.106, 3.161],
  [4.869, 3.465],
  [4.633, 3.768],
  [4.317, 4.071],
  [3.923, 4.374],
  [3.45, 4.677],
  [2.819, 4.98],
  [1.912, 5.283],
  [0.651, 5.5],
]

function deskShadowShape(): THREE.Shape {
  const shape = new THREE.Shape()
  const [x0, y0] = DESK_SHADOW_OUTLINE[0]
  shape.moveTo(x0, y0)
  for (let i = 1; i < DESK_SHADOW_OUTLINE.length; i++) {
    const [x, y] = DESK_SHADOW_OUTLINE[i]
    shape.lineTo(x, y)
  }
  return shape
}

function geometryFor(kind: ShadowKind): THREE.BufferGeometry {
  if (shared[kind]) return shared[kind]!
  const shape =
    kind === 'cylinder'
      ? cylinderShadowShape()
      : kind === 'desk'
        ? deskShadowShape()
        : boxShadowShape()
  shared[kind] = new THREE.ShapeGeometry(shape)
  return shared[kind]!
}

export function createDropShadow(kind: ShadowKind = 'box'): THREE.Mesh {
  const mesh = new THREE.Mesh(
    geometryFor(kind),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = -1
  return mesh
}
