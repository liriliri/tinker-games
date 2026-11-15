import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { TANK_TRACK_HALF_WIDTH } from '../constants'
import type { TankLevel } from '../types'
import { applyCamoMap } from './camo'
import { TANK_KITS } from './tanks'
import type { TankKitSpec } from './types'
import type { TankPalette } from './world'

/** Fit the longer hull edge inside one Battle City cell (margin so guns clear walls). */
const TARGET_SPAN = 0.76
/** Beam scale vs gameplay tread spacing — keeps the mesh inside the cell. */
const TRACK_SPAN_SCALE = 0.88
/** Real MBTs are low; lift them so the camera can read detail. */
const HEIGHT_BOOST = 1.55
/** Segments along each rounded edge — 2 is enough at this scale. */
const ROUND_SEGMENTS = 2

function standard(
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

/**
 * Rounded box by default so hull / turret read softer from above.
 * Pass radius 0 for sharp detail plates (track pads, ERA tiles, etc.).
 */
function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  radius = -1,
) {
  const minDim = Math.min(w, h, d)
  const r = radius < 0 ? minDim * 0.18 : radius
  const geometry =
    r < 1e-4
      ? new THREE.BoxGeometry(w, h, d)
      : new RoundedBoxGeometry(
          w,
          h,
          d,
          ROUND_SEGMENTS,
          Math.min(r, minDim * 0.45),
        )
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  return mesh
}

function cylX(
  radius: number,
  length: number,
  material: THREE.Material,
  radial = 8,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, radial),
    material,
  )
  mesh.rotation.z = Math.PI / 2
  return mesh
}

function cylY(
  radius: number,
  length: number,
  material: THREE.Material,
  radial = 8,
) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, radial),
    material,
  )
}

function cylZ(
  radius: number,
  length: number,
  material: THREE.Material,
  radial = 8,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, radial),
    material,
  )
  mesh.rotation.x = Math.PI / 2
  return mesh
}

/**
 * Claude-of-tanks style kit build: boxes + cylinders only, facing +Z.
 * Specs come from reference metres; everything is scaled into one cell.
 */
export function createTankModel(level: TankLevel, palette: TankPalette) {
  const spec = TANK_KITS[level]
  const group = new THREE.Group()

  const bodyMat = standard(0xffffff)
  bodyMat.userData.tintRole = 'body'
  applyCamoMap(bodyMat, palette)
  const lightMat = standard(0xffffff, { roughness: 0.55 })
  lightMat.userData.tintRole = 'light'
  applyCamoMap(lightMat, palette)
  const darkMat = standard(0xffffff, { roughness: 0.85 })
  darkMat.userData.tintRole = 'dark'
  applyCamoMap(darkMat, palette)
  const treadMat = standard(0x2a2e34, { roughness: 0.96 })
  const rubberMat = standard(0x0d0f12, { roughness: 0.98 })
  const metalMat = standard(0x4a5560, { roughness: 0.42, metalness: 0.4 })

  const scale = TARGET_SPAN / Math.max(spec.hull.w, spec.hull.l)
  const s = (metres: number) => metres * scale
  const sy = (metres: number) => metres * scale * HEIGHT_BOOST

  const hullH = sy(spec.hull.h)
  const hullL = s(spec.hull.l)
  const widthScale = (spec.widthScale ?? 1) * TRACK_SPAN_SCALE
  const trackX = TANK_TRACK_HALF_WIDTH * widthScale
  const trackThick = 0.055 * Math.min(1, 0.85 + widthScale * 0.15)
  const trackH = 0.15
  const wheelR = level === 'fast' ? 0.05 : 0.055
  // Span to tread inners / slight deck overhang so hull and tracks read as one.
  const lowerW = trackX * 2 - trackThick * 1.15
  const deckW = trackX * 2 + trackThick * 0.35

  addRunningGear(group, {
    trackX,
    trackH,
    hullL,
    wheelR,
    wheels: spec.wheels,
    skirts: spec.style !== 'patton',
    treadMat,
    rubberMat,
    darkMat,
    lightMat,
    metalMat,
  })

  group.add(
    box(
      lowerW,
      hullH * 0.42,
      hullL * 0.92,
      bodyMat,
      0,
      trackH + hullH * 0.22,
      0,
    ),
  )

  const deckH = hullH * 0.38
  const deckY = trackH + hullH * 0.55
  group.add(box(deckW, deckH, hullL * 0.7, lightMat, 0, deckY, -hullL * 0.02))
  // Tilted glacis reads as a front slope from the game camera.
  const glacis = box(
    deckW * 0.94,
    deckH * 0.7,
    hullL * 0.22,
    bodyMat,
    0,
    deckY - deckH * 0.05,
    hullL * 0.38,
  )
  glacis.rotation.x = -0.28
  group.add(glacis)

  group.add(
    box(
      deckW * 0.62,
      0.03,
      hullL * 0.16,
      darkMat,
      0,
      deckY + deckH * 0.45,
      -hullL * 0.32,
    ),
  )
  for (const side of [-1, 1] as const) {
    group.add(
      box(
        0.04,
        0.05,
        hullL * 0.12,
        metalMat,
        side * deckW * 0.32,
        deckY + deckH * 0.5,
        -hullL * 0.34,
      ),
    )
  }

  for (const side of [-1, 1] as const) {
    group.add(
      box(
        0.07,
        hullH * 0.28,
        hullL * 0.35,
        darkMat,
        side * (deckW * 0.48),
        deckY,
        -hullL * 0.05,
      ),
    )
  }

  const turretY = deckY + deckH * 0.55
  const turret = buildTurret(spec, {
    bodyMat,
    lightMat,
    darkMat,
    metalMat,
    scale: s,
    scaleY: sy,
    deckW,
  })
  turret.position.y = turretY
  group.add(turret)
  // Gun tip in tank-local +Z; scene uses this for muzzle flash / shot height.
  const muzzle = turret.userData.muzzleLocal as { y: number; z: number }
  group.userData.muzzleLocal = {
    x: 0,
    y: turretY + muzzle.y,
    z: turret.position.z + muzzle.z,
  }

  if (spec.extras?.era) {
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 4; i += 1) {
        group.add(
          box(
            0.035,
            0.08,
            0.1,
            lightMat,
            side * (deckW * 0.5),
            deckY,
            -hullL * 0.25 + i * (hullL * 0.14),
            0.008,
          ),
        )
      }
    }
  }

  if (spec.extras?.spoiler) {
    group.add(
      box(
        deckW * 0.85,
        0.035,
        0.08,
        darkMat,
        0,
        deckY + deckH * 0.6,
        -hullL * 0.42,
      ),
    )
  }

  group.add(
    box(lowerW * 0.85, 0.035, 0.035, metalMat, 0, trackH * 0.7, hullL * 0.48),
  )

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  return group
}

function buildTurret(
  spec: TankKitSpec,
  mats: {
    bodyMat: THREE.Material
    lightMat: THREE.Material
    darkMat: THREE.Material
    metalMat: THREE.Material
    scale: (m: number) => number
    scaleY: (m: number) => number
    deckW: number
  },
) {
  const {
    bodyMat,
    lightMat,
    darkMat,
    metalMat,
    scale: s,
    scaleY: sy,
    deckW,
  } = mats
  const pivot = new THREE.Group()
  pivot.position.z = s(spec.turret.z)

  // Keep kit turret/hull width ratio against the (possibly narrowed) deck.
  const tw = deckW * (spec.turret.w / spec.hull.w)
  const th = sy(spec.turret.h)
  const tl = s(spec.turret.l)

  if (spec.style === 'abrams') {
    pivot.add(box(tw, th * 0.85, tl * 0.7, bodyMat, 0, th * 0.42, -tl * 0.05))
    pivot.add(
      box(tw * 0.85, th * 0.7, tl * 0.45, lightMat, 0, th * 0.38, tl * 0.28),
    )
    pivot.add(
      box(tw * 0.9, th * 0.35, tl * 0.22, darkMat, 0, th * 0.55, -tl * 0.42),
    )
  } else if (spec.style === 'challenger') {
    pivot.add(box(tw * 0.92, th, tl * 0.95, bodyMat, 0, th * 0.5, 0))
    for (const side of [-1, 1] as const) {
      pivot.add(
        box(
          0.06,
          th * 0.7,
          tl * 0.7,
          lightMat,
          side * (tw * 0.48),
          th * 0.45,
          0,
        ),
      )
    }
    pivot.add(
      box(tw * 0.7, th * 0.25, tl * 0.2, darkMat, 0, th * 0.95, -tl * 0.35),
    )
  } else {
    pivot.add(box(tw * 0.85, th * 0.7, tl * 0.85, bodyMat, 0, th * 0.35, 0))
    const drum = cylY(tw * 0.38, th * 0.45, lightMat, 10)
    drum.position.y = th * 0.55
    pivot.add(drum)
  }

  pivot.add(
    box(
      tw * 0.28,
      th * 0.22,
      tw * 0.28,
      darkMat,
      -tw * 0.15,
      th * 1.05,
      -tl * 0.05,
    ),
  )
  pivot.add(
    box(tw * 0.18, 0.03, tw * 0.18, lightMat, tw * 0.18, th * 0.95, tl * 0.05),
  )

  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 3; i += 1) {
      const tube = cylZ(0.018, 0.08, metalMat, 5)
      tube.position.set(side * (tw * 0.42), th * 0.55, tl * 0.35 - i * 0.05)
      tube.rotation.x = -0.4
      pivot.add(tube)
    }
  }

  const antenna = cylY(0.01, th * 1.6, metalMat, 4)
  antenna.position.set(tw * 0.3, th * 1.5, -tl * 0.25)
  pivot.add(antenna)

  // Fixed gun scale (not hull scale) so barrels stay short of the cell edge.
  const gunY = th * 0.45
  const gunWorld = TARGET_SPAN / 5.6
  const gunR = spec.gun.radius * gunWorld * 2.1
  const gunLen = spec.gun.length * gunWorld
  const boreZ = tl * 0.42 + gunLen * 0.92
  pivot.add(box(gunR * 4.2, gunR * 3.6, gunR * 3, lightMat, 0, gunY, tl * 0.42))
  const sleeve = cylZ(gunR * 1.3, gunLen * 0.22, darkMat, 10)
  sleeve.position.set(0, gunY, tl * 0.42 + gunLen * 0.12)
  pivot.add(sleeve)
  const barrel = cylZ(gunR, gunLen * 0.75, darkMat, 10)
  barrel.position.set(0, gunY, tl * 0.42 + gunLen * 0.52)
  pivot.add(barrel)
  const bore = cylZ(gunR * 1.25, gunLen * 0.07, metalMat, 10)
  bore.position.set(0, gunY, boreZ)
  pivot.add(bore)

  if (spec.style === 'challenger') {
    const mg = cylZ(0.012, 0.2, metalMat, 5)
    mg.position.set(-tw * 0.15, th * 1.2, tl * 0.05)
    pivot.add(mg)
  }

  pivot.userData.muzzleLocal = {
    y: gunY,
    z: boreZ + gunLen * 0.035,
  }

  return pivot
}

function addRunningGear(
  group: THREE.Group,
  opts: {
    trackX: number
    trackH: number
    hullL: number
    wheelR: number
    wheels: number
    skirts: boolean
    treadMat: THREE.Material
    rubberMat: THREE.Material
    darkMat: THREE.Material
    lightMat: THREE.Material
    metalMat: THREE.Material
  },
) {
  const {
    trackX,
    trackH,
    hullL,
    wheelR,
    wheels,
    skirts,
    treadMat,
    rubberMat,
    darkMat,
    lightMat,
    metalMat,
  } = opts
  const trackLen = hullL * 0.98
  const padCount = wheels + 5
  const thick = 0.055

  for (const side of [-1, 1] as const) {
    group.add(
      box(
        thick * 1.6,
        trackH * 0.7,
        trackLen,
        treadMat,
        side * trackX,
        trackH * 0.4,
        0,
      ),
    )

    for (let i = 0; i < padCount; i += 1) {
      const z = -trackLen * 0.5 + ((i + 0.5) / padCount) * trackLen
      group.add(
        box(
          thick * 2,
          0.028,
          trackLen / padCount - 0.006,
          rubberMat,
          side * trackX,
          0.018,
          z,
          0,
        ),
      )
      group.add(
        box(
          thick * 1.85,
          0.022,
          trackLen / padCount - 0.008,
          rubberMat,
          side * (trackX + 0.008),
          trackH + 0.008,
          z,
          0,
        ),
      )
    }

    if (skirts) {
      const panels = 4
      for (let i = 0; i < panels; i += 1) {
        const z = -trackLen * 0.38 + ((i + 0.5) / panels) * trackLen * 0.76
        group.add(
          box(
            0.03,
            0.1,
            (trackLen * 0.76) / panels - 0.012,
            lightMat,
            side * (trackX + thick + 0.015),
            trackH * 0.65,
            z,
          ),
        )
      }
    }

    for (let i = 0; i < wheels; i += 1) {
      const t = i / (wheels - 1)
      const z = -hullL * 0.38 + t * hullL * 0.76
      const tire = cylX(wheelR, thick * 1.5, rubberMat, 9)
      tire.position.set(side * trackX, wheelR + 0.01, z)
      group.add(tire)
      const hub = cylX(wheelR * 0.5, thick * 1.7, darkMat, 7)
      hub.position.set(side * trackX, wheelR + 0.01, z)
      group.add(hub)
    }

    for (const z of [-hullL * 0.46, hullL * 0.46]) {
      const sprocket = cylX(wheelR * 0.95, thick * 1.4, darkMat, 8)
      sprocket.position.set(side * trackX, wheelR * 1.05 + 0.015, z)
      group.add(sprocket)
      group.add(
        box(
          thick * 0.45,
          wheelR * 0.3,
          wheelR * 0.3,
          metalMat,
          side * (trackX + thick * 0.55),
          wheelR * 1.05 + 0.015,
          z,
        ),
      )
    }

    group.add(
      box(thick * 2, 0.07, 0.03, darkMat, side * trackX, 0.06, -hullL * 0.5),
    )
  }
}
