import * as THREE from 'three'
import clamp from 'licia/clamp'
import sum from 'licia/sum'
import { fbm, smoothstep } from '../lib/noise'
import { dataToTexture } from '../lib/texture'
import { BRICK_SIZE, STEEL_SIZE } from './constants'
import { createRockMaps } from './rocks'
import type { PowerUpName, TankLevel } from './types'

export interface TankPalette {
  body: number
  light: number
  dark: number
}

/**
 * Colours follow the reference's tank colour schemes: players get yellow and
 * green, enemies get silver, blue, orange and red for the four levels.
 */
export const TANK_PALETTES: Record<
  'player' | 'player2' | TankLevel,
  TankPalette
> = {
  player: { body: 0xe79c21, light: 0xe7e794, dark: 0x6b6b00 },
  player2: { body: 0x008c31, light: 0xb5f7ce, dark: 0x005200 },
  basic: { body: 0xadadad, light: 0xffffff, dark: 0x00424a },
  fast: { body: 0x4aa3d8, light: 0xbfe3ff, dark: 0x0b3d5c },
  power: { body: 0xe7792b, light: 0xffd08a, dark: 0x7a3a06 },
  armor: { body: 0xb53121, light: 0xff8f7a, dark: 0x5a007b },
}

/** Reference colour schemes used for bot flashing (silver / red / green / yellow). */
const SCHEME_PALETTES: Record<
  'silver' | 'red' | 'green' | 'yellow',
  TankPalette
> = {
  silver: { body: 0xadadad, light: 0xffffff, dark: 0x00424a },
  red: { body: 0xb53121, light: 0xffffff, dark: 0x5a007b },
  green: { body: 0x008c31, light: 0xb5f7ce, dark: 0x005200 },
  yellow: { body: 0xe79c21, light: 0xe7e794, dark: 0x6b6b00 },
}

/**
 * Resolves the bot palette for the current frame, matching the reference
 * withPowerUp red/silver blink and armor HP colour cycles.
 */
export function resolveBotPalette(
  level: TankLevel,
  hp: number,
  withPowerUp: boolean,
  clockMs: number,
): TankPalette {
  const frameMs = 1000 / 60
  if (withPowerUp) {
    // red f(8) / silver f(8)
    const slot = Math.floor(clockMs / (frameMs * 8)) % 2
    return SCHEME_PALETTES[slot === 0 ? 'red' : 'silver']
  }
  if (level !== 'armor') {
    return TANK_PALETTES[level]
  }
  if (hp >= 4) {
    // silver f(3), green f(1), silver f(1), green f(1) → 6 frames
    const cycle = [3, 1, 1, 1]
    const colors: Array<'silver' | 'green'> = [
      'silver',
      'green',
      'silver',
      'green',
    ]
    return SCHEME_PALETTES[pickTimedColor(clockMs, frameMs, cycle, colors)]
  }
  if (hp === 3) {
    // silver f(3), yellow f(1), silver f(1), yellow f(1)
    const cycle = [3, 1, 1, 1]
    const colors: Array<'silver' | 'yellow'> = [
      'silver',
      'yellow',
      'silver',
      'yellow',
    ]
    return SCHEME_PALETTES[pickTimedColor(clockMs, frameMs, cycle, colors)]
  }
  if (hp === 2) {
    // green f(3), yellow f(1), green f(1), yellow f(1)
    const cycle = [3, 1, 1, 1]
    const colors: Array<'green' | 'yellow'> = [
      'green',
      'yellow',
      'green',
      'yellow',
    ]
    return SCHEME_PALETTES[pickTimedColor(clockMs, frameMs, cycle, colors)]
  }
  return SCHEME_PALETTES.silver
}

function pickTimedColor<T extends string>(
  clockMs: number,
  frameMs: number,
  durations: number[],
  colors: T[],
): T {
  const total = sum(...durations)
  let frame = Math.floor(clockMs / frameMs) % total
  for (let index = 0; index < durations.length; index += 1) {
    frame -= durations[index]
    if (frame < 0) return colors[index]
  }
  return colors[0]
}

const POWER_UP_COLORS: Record<PowerUpName, number> = {
  tank: 0x35c46a,
  star: 0xf5c542,
  grenade: 0xd94b3d,
  timer: 0x49b7e8,
  helmet: 0xe8eef5,
  shovel: 0xb3742c,
}

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

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
}

/**
 * Builds a low-poly tank facing +Z (downwards on screen).
 *
 * Every level gets a slightly different silhouette so enemies can be told
 * apart at a glance.
 */
export function createTankModel(level: TankLevel, palette: TankPalette) {
  const group = new THREE.Group()

  const treadMaterial = standard(0x2b2f36, { roughness: 0.95 })
  const bodyMaterial = standard(palette.body)
  bodyMaterial.userData.tintRole = 'body'
  const lightMaterial = standard(palette.light, { roughness: 0.6 })
  lightMaterial.userData.tintRole = 'light'
  const darkMaterial = standard(palette.dark, { roughness: 0.85 })
  darkMaterial.userData.tintRole = 'dark'

  const wide = level === 'armor' || level === 'power'
  const bodyWidth = wide ? 0.66 : 0.56
  const bodyLength = level === 'fast' ? 0.7 : 0.8

  for (const side of [-1, 1]) {
    const tread = box(0.16, 0.2, bodyLength + 0.08, treadMaterial)
    tread.position.set(side * (bodyWidth / 2 + 0.08), 0.1, 0)
    group.add(tread)
  }

  const hull = box(bodyWidth, 0.18, bodyLength, bodyMaterial)
  hull.position.y = 0.2
  group.add(hull)

  // Upper deck, slightly shorter so the turret reads clearly from above.
  const deck = box(bodyWidth * 0.82, 0.1, bodyLength * 0.74, lightMaterial)
  deck.position.y = 0.33
  group.add(deck)

  const turret = box(0.34, 0.14, 0.34, bodyMaterial)
  turret.position.set(0, 0.43, -0.04)
  group.add(turret)

  const hatch = box(0.16, 0.06, 0.16, darkMaterial)
  hatch.position.set(0, 0.52, -0.04)
  group.add(hatch)

  const barrel = box(0.09, 0.09, 0.44, darkMaterial)
  barrel.position.set(0, 0.41, 0.3)
  group.add(barrel)

  if (level === 'power') {
    const secondBarrel = box(0.09, 0.09, 0.44, darkMaterial)
    secondBarrel.position.set(0.14, 0.41, 0.3)
    group.add(secondBarrel)
  }

  if (level === 'fast') {
    const spoiler = box(bodyWidth * 0.9, 0.07, 0.12, darkMaterial)
    spoiler.position.set(0, 0.44, -bodyLength / 2 + 0.02)
    group.add(spoiler)
  }

  if (level === 'armor') {
    for (const side of [-1, 1]) {
      const plate = box(0.07, 0.16, bodyLength * 0.8, lightMaterial)
      plate.position.set(side * (bodyWidth / 2 + 0.03), 0.28, 0)
      group.add(plate)
    }
    const crest = box(0.22, 0.08, 0.22, lightMaterial)
    crest.position.set(0, 0.55, -0.04)
    group.add(crest)
  }

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  return group
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
  const material = new THREE.MeshStandardMaterial({
    color: 0xfff2b0,
    emissive: 0xffb347,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  })
  const group = new THREE.Group()
  const core = box(0.11, 0.11, 0.26, material)
  group.add(core)
  return group
}

export function createEagleModel() {
  const group = new THREE.Group()

  const gold = standard(0xe8b23f, { roughness: 0.42, metalness: 0.15 })
  const light = standard(0xf0d488, { roughness: 0.5 })
  const dark = standard(0x9a6d1c, { roughness: 0.6 })
  const beakMaterial = standard(0xe07b2a, { roughness: 0.5 })

  // Pedestal the eagle stands on.
  const base = box(0.78, 0.1, 0.78, standard(0x59616e, { roughness: 0.7 }))
  base.position.y = 0.05
  group.add(base)

  const baseTrim = box(0.62, 0.06, 0.62, standard(0x8d949e, { roughness: 0.6 }))
  baseTrim.position.y = 0.13
  group.add(baseTrim)

  // Body, tapering towards the tail.
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
    const eye = box(0.035, 0.035, 0.035, standard(0x1a1a1a, { roughness: 0.3 }))
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

/** A floating cube used for every power-up; the colour tells them apart. */
export function createPowerUpModel(name: PowerUpName) {
  const group = new THREE.Group()
  const color = POWER_UP_COLORS[name]

  const core = box(0.42, 0.42, 0.42, standard(color, { roughness: 0.45 }))
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

  const marker = box(0.16, 0.16, 0.16, standard(0xffffff, { roughness: 0.4 }))
  marker.position.y = 0.3
  group.add(marker)

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true
    }
  })

  return group
}

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

export function createSteelGeometry() {
  return new THREE.BoxGeometry(STEEL_SIZE * 0.96, 0.38, STEEL_SIZE * 0.96)
}

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

export function createTreeGeometry() {
  return new THREE.ConeGeometry(0.26, 0.52, 5)
}

/** How deep the river channel sits below the concrete deck. */
export const RIVER_DEPTH = 0.42
/** Water surface height relative to deck (below ground, above the bed). */
export const RIVER_WATER_OFFSET = -0.24
const RIVER_CURB_HEIGHT = 0.07
const RIVER_CURB_THICK = 0.06

/**
 * Unit concrete curb (length 1 along local X). Scale X to span a merged edge.
 * Centered on the perimeter line so corners butt flush without a stacked cap.
 */
export function createRiverCurbGeometry(
  length = 1,
  height = RIVER_CURB_HEIGHT,
  thick = RIVER_CURB_THICK,
): THREE.BufferGeometry {
  const curb = new THREE.BoxGeometry(length, height, thick)
  curb.translate(0, height / 2, 0)
  return curb
}

/** Pale stone curb — lighter than the wet concrete deck. */
export function createRiverCurbMaterial() {
  const maps = createRockMaps(256)
  maps.map.repeat.set(2.2, 2.2)
  maps.roughnessMap.repeat.copy(maps.map.repeat)
  maps.normalMap.repeat.copy(maps.map.repeat)
  return new THREE.MeshStandardMaterial({
    color: 0xf2f4f6,
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.9,
    metalness: 0.02,
  })
}

/** Channel floor — darker concrete; soft fill so it isn’t a void. */
export function createRiverFloorMaterial(maps: ConcreteMaps) {
  const mat = createConcreteMaterial(maps, {
    repeat: 4,
    color: 0x7e8792,
    roughness: 0.95,
    normalScale: 0.14,
    exclusive: true,
  })
  mat.emissive = new THREE.Color(0x2c3238)
  mat.emissiveIntensity = 0.28
  return mat
}

/**
 * Battlefield river water — one continuous Seascape sheet, masked to river
 * cells so adjacent tiles join with no seams.
 */
export function createRiverMaterial(
  sunDirection: THREE.Vector3,
  fieldSize: number,
) {
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDirection.clone().normalize() },
    uEye: { value: new THREE.Vector3(0, 24, 8) },
    uRiverMask: { value: null as THREE.Texture | null },
    uMaskScale: { value: 1 / fieldSize },
    uRiverCut: { value: 0 },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;

      const int ITER = 3;
      const float SEA_HEIGHT = 0.017;
      const float SEA_CHOPPY = 2.2;
      const float SEA_SPEED = 0.88;
      const float SEA_FREQ = 5.2;
      const mat2 octave_m = mat2(1.6, 1.2, -1.2, 1.6);

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(in vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return -1.0 + 2.0 * mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float sea_octave(vec2 uv, float choppy) {
        uv += noise(uv);
        vec2 wv = 1.0 - abs(sin(uv));
        vec2 swv = abs(cos(uv));
        wv = mix(wv, swv, wv);
        return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
      }

      float seaHeight(vec2 p) {
        vec2 uv = p;
        uv.x *= 0.75;
        float freq = SEA_FREQ;
        float amp = SEA_HEIGHT;
        float choppy = SEA_CHOPPY;
        float seaTime = uTime * SEA_SPEED;
        float h = 0.0;
        for (int i = 0; i < ITER; i++) {
          float d = sea_octave((uv + seaTime) * freq, choppy);
          d += sea_octave((uv - seaTime) * freq, choppy);
          h += d * amp;
          uv *= octave_m;
          freq *= 1.9;
          amp *= 0.22;
          choppy = mix(choppy, 1.0, 0.2);
        }
        return h;
      }

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        float h = seaHeight(world.xz);
        float eps = 0.05;
        float hx = seaHeight(world.xz + vec2(eps, 0.0));
        float hz = seaHeight(world.xz + vec2(0.0, eps));
        vNormal = normalize(vec3(h - hx, eps, h - hz));
        vCrest = clamp(h / max(SEA_HEIGHT, 1e-3), 0.0, 1.0);
        world.y += h;
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;

      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uEye;
      uniform sampler2D uRiverMask;
      uniform float uMaskScale;
      uniform float uRiverCut;

      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;

      const vec3 SEA_BASE = vec3(0.02, 0.04, 0.08);
      const vec3 SEA_WATER_COLOR = vec3(0.04, 0.09, 0.18);

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(in vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return -1.0 + 2.0 * mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float sea_octave(vec2 uv, float choppy) {
        uv += noise(uv);
        vec2 wv = 1.0 - abs(sin(uv));
        vec2 swv = abs(cos(uv));
        wv = mix(wv, swv, wv);
        return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
      }

      void main() {
        if (uRiverCut < 0.5) discard;

        vec2 riverUv = vWorld.xz * uMaskScale + 0.5;
        float cell = texture2D(uRiverMask, riverUv).r;
        if (cell < 0.5) discard;

        // Hairline foam only where the mask meets dry deck.
        float texel = uMaskScale * 0.05;
        float n = texture2D(uRiverMask, riverUv + vec2(0.0, texel)).r;
        float s = texture2D(uRiverMask, riverUv - vec2(0.0, texel)).r;
        float e = texture2D(uRiverMask, riverUv + vec2(texel, 0.0)).r;
        float w = texture2D(uRiverMask, riverUv - vec2(texel, 0.0)).r;
        float rim = step(0.5, cell) * (1.0 - step(0.5, min(min(n, s), min(e, w))));

        vec3 p = vWorld;
        vec3 eye = normalize(p - uEye);
        vec3 nor = normalize(vNormal);
        vec3 light = normalize(uSunDir);

        float crest = vCrest;
        float slope = clamp(1.0 - nor.y, 0.0, 1.0);
        float shade =
          crest * 0.4 - slope * 1.0 +
          (pow(dot(nor, light) * 0.4 + 0.6, 18.0) - 0.55) * 0.4;
        // Fine ripple bands under the glitter.
        float band =
          sea_octave(p.xz * 3.4 + uTime * 0.35, 2.2) *
          mix(0.65, 1.0, sea_octave(p.zx * 4.2 - uTime * 0.28, 2.0));

        float fresnel = pow(1.0 - max(dot(nor, -eye), 0.0), 3.0) * 0.08;
        vec3 sky = vec3(0.04, 0.07, 0.12) * (0.4 + max(reflect(eye, nor).y, 0.0) * 0.35);
        vec3 color = SEA_BASE + SEA_WATER_COLOR * (0.75 + shade);
        color = mix(color, SEA_BASE * 1.5 + SEA_WATER_COLOR * 0.52, 0.7);
        color = mix(color, sky, fresnel);
        color *= mix(0.71, 1.03, band) * 0.65;

        // Medium glitter — cool-white flecks on grey-blue water.
        vec3 halfDir = normalize(light + (-eye));
        float spec = pow(max(dot(nor, halfDir), 0.0), 220.0);
        vec3 lightL = normalize(vec3(-light.x, light.y, light.z));
        float specL = pow(max(dot(nor, normalize(lightL + (-eye))), 0.0), 170.0);
        float sparkle = 0.0;
        sparkle += pow(clamp(noise(p.xz * 34.0 + vec2(uTime * 1.85, -uTime * 1.35)), 0.0, 1.0), 15.0);
        sparkle += pow(clamp(noise(p.xz * 52.0 + vec2(-uTime * 2.3, uTime * 1.65) + 8.0), 0.0, 1.0), 20.0);
        sparkle *= smoothstep(0.5, 0.95, nor.y) * (0.32 + slope * 1.25);
        sparkle *= mix(0.44, 1.0, crest);
        color += vec3(0.92, 0.94, 0.96) *
          (spec * 0.42 + specL * 0.32 + sparkle * 0.78);

        float thread =
          sea_octave(p.xz * 72.0 + vec2(uTime * 2.4, -uTime * 1.7), 3.4);
        float foam = rim * smoothstep(0.78, 0.95, thread) * 0.4;
        color = mix(color, vec3(0.98, 1.05, 1.12), foam * 0.55);

        float alpha = mix(0.88, 0.92, foam);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    fog: false,
    toneMapped: false,
  })

  return {
    material,
    uniforms,
    dispose() {
      material.dispose()
    },
  }
}

// --- Procedural concrete (inspired by references/saltline materials) ---

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

      // Sparse pore pits.
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

      // Aggregate chips / stone flecks.
      const chipNoise = fbm(u * 64, v * 64, 12, 3, 64)
      const chip = smoothstep(0.84, 0.94, chipNoise + (fine - 0.5) * 0.06) * 0.7
      const stone = smoothstep(0.55, 0.35, fbm(u * 120, v * 120, 13, 2, 120))

      // Height for normals — shallow relief so the slab reads smooth.
      let h =
        0.55 + (mid - 0.5) * 0.12 + (fine - 0.5) * 0.08 + (form - 0.5) * 0.03
      h -= pore * 0.16 + crack * 0.08
      h = h * (1 - chip) + (0.48 + stone * 0.06 + fine * 0.04) * chip
      height[index] = clamp(h, 0, 1)

      // Albedo — cool grey concrete with soft mottling (low contrast).
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

      // Exposed aggregate.
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

  // Derive a tiling normal map from the height field (saltline Lw style).
  const normals = new Uint8Array(size * size * 4)
  const wrap = (i: number) => ((i % size) + size) % size
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx =
        (height[y * size + wrap(x + 1)] - height[y * size + wrap(x - 1)]) * 1.8
      const dy =
        (height[wrap(y + 1) * size + x] - height[wrap(y - 1) * size + x]) * 1.8
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

  return {
    map: dataToTexture(albedo, size, true),
    roughnessMap: dataToTexture(rough, size, false),
    normalMap: dataToTexture(normals, size, false),
  }
}

function cloneDataTexture(source: THREE.DataTexture) {
  const texture = source.clone()
  texture.needsUpdate = true
  return texture
}

/** Standard material wired to the procedural concrete maps. */
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

export interface BrickMaps {
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
      // Scorched / darker patches.
      const scorch = smoothstep(0.62, 0.88, blotch) * (1 - mortar)
      r *= 1 - scorch * 0.35
      g *= 1 - scorch * 0.4
      b *= 1 - scorch * 0.38
      // Pale under-fired spots.
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

  const normals = new Uint8Array(size * size * 4)
  const clampIndex = (i: number) => (i < 0 ? 0 : i > size - 1 ? size - 1 : i)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx =
        (height[y * size + clampIndex(x + 1)] -
          height[y * size + clampIndex(x - 1)]) *
        3.6
      const dy =
        (height[clampIndex(y + 1) * size + x] -
          height[clampIndex(y - 1) * size + x]) *
        3.6
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

  return {
    map: dataToTexture(albedo, size, true),
    roughnessMap: dataToTexture(rough, size, false),
    aoMap: dataToTexture(ao, size, false),
    normalMap: dataToTexture(normals, size, false),
  }
}

/** Clay brick material; instanceColor varies per-block hue and value. */
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

export interface SteelMaps {
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

      // Cool armour grey with brush streaks.
      let r = 0.72 + (brush - 0.5) * 0.06 + (wear - 0.5) * 0.05
      let g = 0.76 + (brush - 0.5) * 0.05 + (wear - 0.5) * 0.04
      let b = 0.82 + (brush - 0.5) * 0.04 + (wear - 0.5) * 0.03
      r = r * (1 - rim * 0.18) + 0.45 * rim * 0.18
      g = g * (1 - rim * 0.18) + 0.48 * rim * 0.18
      b = b * (1 - rim * 0.18) + 0.52 * rim * 0.18
      r = r * (1 - scratch * 0.12) + 0.88 * scratch * 0.12
      g = g * (1 - scratch * 0.12) + 0.9 * scratch * 0.12
      b = b * (1 - scratch * 0.12) + 0.92 * scratch * 0.12
      // Rivet heads: slightly darker, bluer steel.
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

  const normals = new Uint8Array(size * size * 4)
  const clampIndex = (i: number) => (i < 0 ? 0 : i > size - 1 ? size - 1 : i)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx =
        (height[y * size + clampIndex(x + 1)] -
          height[y * size + clampIndex(x - 1)]) *
        2.8
      const dy =
        (height[clampIndex(y + 1) * size + x] -
          height[clampIndex(y - 1) * size + x]) *
        2.8
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

  return {
    map: dataToTexture(albedo, size, true),
    roughnessMap: dataToTexture(rough, size, false),
    metalnessMap: dataToTexture(metal, size, false),
    normalMap: dataToTexture(normals, size, false),
  }
}

/** Brushed steel plate; instanceColor should be a light grayscale shade. */
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
