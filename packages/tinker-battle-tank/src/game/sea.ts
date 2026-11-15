import * as THREE from 'three'
import { createBeachRocks } from './rocks'

/**
 * Harbour sea around the sand island. Water shading follows
 * `references/sea-water-effect-three-js-main` (TDM Seascape / sea_octave),
 * adapted to a displaced mesh that respects the beach shore line.
 */

const SAND_GRAIN_DENSITY = 0.09
const SURFACE_SEGMENTS = 256
const SAND_SEGMENTS = 128

/** Plateau height of the sand island the arena sits on. */
export const ISLAND_TOP_Y = 0.42
/**
 * How far above the sand plateau the concrete deck / steel / tanks sit.
 * Keeps dune noise from poking through the wet slab.
 */
export const DECK_CLEARANCE = 0.62
/** Seabed depth under open water. */
const SEABED_Y = -0.45
/** Mean water height (between island top and seabed). */
const WATER_Y = 0.0
/** How far the beach slopes out past the steel quay. */
const BEACH_WIDTH = 5.4
/** Corner fillet on the sand island — keeps a clear quad with soft arcs. */
const ISLAND_CORNER_R = 2.35

/**
 * Vertex + fragment from the reference Seascape shader, rewritten for a
 * world-space water plane (ortho top-down friendly, deep blue base).
 */
const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uShore;
  uniform float uQuayHalf;
  uniform float uCornerR;
  varying vec3 vWorld;
  varying float vShoreDist;

  // Seascape chop — lower frequency so wave cells read larger / less grid-like.
  const int ITER_GEOMETRY = 3;
  const float SEA_HEIGHT = 0.18;
  const float SEA_CHOPPY = 2.8;
  const float SEA_SPEED = 1.15;
  const float SEA_FREQ = 0.42;
  const mat2 octave_m = mat2(1.6, 1.2, -1.2, 1.6);

  float hash(vec2 p) {
    float h = dot(p, vec2(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
  }

  float noise(in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return -1.0 +
      2.0 *
        mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
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
    for (int i = 0; i < ITER_GEOMETRY; i++) {
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

  float edgeWarp(vec2 p) {
    return sin(p.x * 0.62 + p.y * 0.41) * 0.38 +
      sin(p.x * 1.28 - p.y * 0.92) * 0.24 +
      sin(p.x * 2.15 + p.y * 1.65) * 0.14 +
      sin(p.x * 3.4 - p.y * 2.8) * 0.08;
  }

  float islandDist(vec2 p) {
    vec2 a = abs(p);
    float r = min(uCornerR, uQuayHalf * 0.45);
    float inner = uQuayHalf - r;
    float d;
    if (a.x > inner && a.y > inner) {
      d = inner + length(a - vec2(inner));
    } else {
      d = max(a.x, a.y);
    }
    // Irregular shoreline — wobble the contour without breaking the quad.
    return d - edgeWarp(p);
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    // Match TS islandDist() — filleted quad with irregular edge.
    float d = islandDist(world.xz);
    vShoreDist = d - uShore;
    // Calm waves far onto the beach so displacement doesn't cliff at the join.
    float open = smoothstep(-0.8, 3.2, vShoreDist);
    world.y += seaHeight(world.xz) * open;
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const waterFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uEye;
  uniform float uShore;
  uniform sampler2D uSandMap;
  uniform vec2 uSandRepeat;
  uniform float uSeaSize;

  varying vec3 vWorld;
  varying float vShoreDist;

  const int ITER_FRAGMENT = 4;
  const float SEA_HEIGHT = 0.18;
  const float SEA_CHOPPY = 2.8;
  const float SEA_SPEED = 1.15;
  const float SEA_FREQ = 0.42;
  // Pre-ACES values: grade + OutputPass lift these into deep blue.
  const vec3 SEA_BASE = vec3(0.001, 0.02, 0.11);
  const vec3 SEA_WATER_COLOR = vec3(0.005, 0.08, 0.28);
  const float WATER_LEVEL = 0.0;
  const mat2 octave_m = mat2(1.6, 1.2, -1.2, 1.6);

  float hash(vec2 p) {
    float h = dot(p, vec2(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
  }

  float noise(in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return -1.0 +
      2.0 *
        mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
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
    for (int i = 0; i < ITER_FRAGMENT; i++) {
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

  float map_detailed(vec3 p) {
    return p.y - seaHeight(p.xz) * 1.15;
  }

  vec3 getNormal(vec3 p, float eps) {
    vec3 n;
    n.y = map_detailed(p);
    n.x = map_detailed(vec3(p.x + eps, p.y, p.z)) - n.y;
    n.z = map_detailed(vec3(p.x, p.y, p.z + eps)) - n.y;
    n.y = eps;
    return normalize(n);
  }

  float diffuse(vec3 n, vec3 l, float p) {
    return pow(dot(n, l) * 0.4 + 0.6, p);
  }

  vec3 getSkyColor(vec3 e) {
    e.y = max(e.y, 0.0);
    return vec3(0.01, 0.05, 0.14) * (0.4 + e.y * 0.3);
  }

  void main() {
    // Wide wash onto the beach — no hard waterline cut.
    float shoreFade = smoothstep(-1.4, 1.8, vShoreDist);
    if (shoreFade < 0.008) discard;

    vec3 p = vWorld;
    vec3 eye = normalize(p - uEye);
    vec3 dist = p - uEye;
    float eps = max(0.02, length(dist) * 0.0012);
    vec3 n = getNormal(p, eps);
    vec3 light = normalize(uSunDir);

    float fresnel = 1.0 - max(dot(n, -eye), 0.0);
    fresnel = pow(fresnel, 3.0) * 0.08;

    float crest = clamp((p.y - WATER_LEVEL) / max(SEA_HEIGHT, 1e-3), 0.0, 1.0);
    float slope = clamp(1.0 - n.y, 0.0, 1.0);
    float waveShade =
      crest * 0.55 - slope * 1.4 + (diffuse(n, light, 22.0) - 0.55) * 0.55;
    float band =
      sea_octave(p.xz * 1.1 + uTime * 0.4, 2.3) *
      mix(0.55, 1.0, sea_octave(p.zx * 1.5 - uTime * 0.32, 2.0));

    vec3 refracted = SEA_BASE + SEA_WATER_COLOR * (0.75 + waveShade);
    vec3 reflected = getSkyColor(reflect(eye, n)) * 0.35;
    vec3 waterCol = mix(refracted, reflected, fresnel);

    // Shallow shoal — sand near shore, deepen to blue outward.
    vec2 sandUv = (p.xz / uSeaSize + 0.5) * uSandRepeat + n.xz * 0.35;
    vec3 sand = texture2D(uSandMap, sandUv).rgb;
    float nearShore = 1.0 - smoothstep(-0.6, 5.5, vShoreDist);
    float deep = smoothstep(0.4, 7.0, vShoreDist);
    waterCol = mix(waterCol, SEA_BASE * 1.6 + SEA_WATER_COLOR * 0.55, deep * 0.7);
    vec3 sandDry = sand * vec3(1.06, 0.96, 0.76);
    vec3 sandWet = mix(sand * vec3(1.0, 0.92, 0.7), vec3(0.12, 0.32, 0.44), 0.22);
    sandWet = mix(sandDry, sandWet, smoothstep(-1.0, 0.8, vShoreDist));
    float sandShow = mix(0.14, 0.9, nearShore);
    vec3 color = mix(waterCol, sandWet, sandShow);

    float ripple = mix(0.55, 1.05, band) + crest * 0.15 - slope * 0.25;
    color *= mix(clamp(ripple, 0.45, 1.1), 1.0, sandShow * 0.4);
    color *= 0.68;

    // 波光粼粼 — sun specular + left/overhead fill so glitter isn't pinned to one corner.
    vec3 halfDir = normalize(light + (-eye));
    float spec = pow(max(dot(n, halfDir), 0.0), 160.0);
    // Mirror sun across X so the left side gets a matching lobe under top-down view.
    vec3 lightL = normalize(vec3(-light.x, light.y, light.z));
    vec3 halfL = normalize(lightL + (-eye));
    float specL = pow(max(dot(n, halfL), 0.0), 120.0);
    vec3 halfUp = normalize(vec3(0.0, 1.0, 0.0) + (-eye));
    float specUp = pow(max(dot(n, halfUp), 0.0), 48.0);
    float sparkle = 0.0;
    sparkle += pow(clamp(noise(p.xz * 14.0 + vec2(uTime * 2.0, -uTime * 1.4)), 0.0, 1.0), 12.0);
    sparkle += pow(clamp(noise(p.xz * 22.0 + vec2(-uTime * 2.6, uTime * 1.8) + 8.0), 0.0, 1.0), 16.0);
    sparkle *= smoothstep(0.5, 0.95, n.y) * (0.4 + slope * 1.5);
    sparkle *= mix(0.5, 1.0, crest);
    vec3 glitter =
      vec3(0.85, 0.95, 1.1) *
      (spec * 0.55 + specL * 0.5 + specUp * 0.35 + sparkle * 0.8);
    color += glitter;

    // Shore foam — mostly fine lace; density = more threads, not thick blobs.
    float along = atan(p.z, p.x);
    float foamPatch =
      sea_octave(vec2(along * 1.4, length(p.xz) * 0.1) + uTime * 0.1, 1.4);
    float density = smoothstep(0.28, 0.72, foamPatch);
    // Keep the band narrow; dense arcs only a little wider.
    float foamOuter = mix(0.55, 0.9, density);
    float foamMask =
      smoothstep(-0.05, 0.12, vShoreDist) *
      (1.0 - smoothstep(0.18, foamOuter, vShoreDist));
    // High-frequency filaments — thin white threads.
    float threadA =
      sea_octave(p.xz * 42.0 + vec2(uTime * 2.2, -uTime * 1.5), 3.2);
    float threadB =
      sea_octave(p.zx * 58.0 + vec2(-uTime * 2.8, uTime * 1.9), 3.4);
    float threadC =
      sea_octave(p.xz * 78.0 + vec2(uTime * 3.4, uTime * 2.1) + along * 2.0, 3.6);
    // Sharp ridges → hairline foam; raise threshold in sparse zones.
    float thrLo = mix(0.62, 0.48, density);
    float thrHi = mix(0.88, 0.72, density);
    float lace =
      smoothstep(thrLo, thrHi, threadA) *
      mix(0.35, 1.0, smoothstep(thrLo, thrHi, threadB));
    float laceFine =
      smoothstep(0.7, 0.92, threadC) * mix(0.25, 0.85, density);
    // Soft waterline film under the threads (subtle, not a white slab).
    float film =
      foamMask * 0.18 * mix(0.35, 0.75, density) *
      (0.55 + 0.45 * sea_octave(p.xz * 8.0 + uTime * 0.6, 1.8));
    float foamFlick =
      mix(0.75, 1.15, smoothstep(0.35, 0.85, sea_octave(p.xz * 14.0 - uTime * 3.6, 2.4)));
    float foam = clamp(
      foamMask * (film + lace * 0.95 + laceFine * 0.7) * foamFlick,
      0.0,
      1.0
    );
    vec3 foamColor = mix(vec3(0.98, 1.05, 1.12), vec3(1.2, 1.24, 1.28), laceFine);
    color = mix(color, foamColor, foam * 0.88);

    // Near shore stays translucent over sand; farther out more opaque blue.
    float alpha = mix(0.3, 0.82, smoothstep(-1.0, 6.0, vShoreDist));
    alpha = mix(alpha, 0.95, foam * 0.85);
    alpha *= mix(shoreFade, 1.0, foam * 0.85);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
  }
`

export interface SeaSystem {
  mesh: THREE.Object3D
  /** World Y of the island plateau (arena / steel sit here). */
  islandTopY: number
  update: (camera: THREE.Camera) => void
  dispose: () => void
}

/** Shoreline wobble — keeps the quad, breaks the perfect outline. */
function edgeWarp(x: number, z: number): number {
  return (
    Math.sin(x * 0.62 + z * 0.41) * 0.38 +
    Math.sin(x * 1.28 - z * 0.92) * 0.24 +
    Math.sin(x * 2.15 + z * 1.65) * 0.14 +
    Math.sin(x * 3.4 - z * 2.8) * 0.08
  )
}

/**
 * Distance whose iso-contours are axis-aligned squares with circular fillets,
 * then lightly warped so the beach edge reads irregular.
 */
function islandDist(x: number, z: number, quayHalf: number): number {
  const ax = Math.abs(x)
  const az = Math.abs(z)
  const r = Math.min(ISLAND_CORNER_R, quayHalf * 0.45)
  const inner = quayHalf - r
  let d: number
  if (ax > inner && az > inner) {
    d = inner + Math.hypot(ax - inner, az - inner)
  } else {
    d = Math.max(ax, az)
  }
  return d - edgeWarp(x, z)
}

/** Smooth beach falloff from the quay into the seabed. */
function islandHeight(x: number, z: number, quayHalf: number): number {
  const d = islandDist(x, z, quayHalf)
  const n =
    Math.sin(x * 0.55 + z * 0.31) * 0.016 +
    Math.sin(x * 1.1 - z * 0.85) * 0.01 +
    Math.sin(x * 2.3 + z * 1.6) * 0.006
  if (d <= quayHalf) return ISLAND_TOP_Y + n * 0.01
  if (d >= quayHalf + BEACH_WIDTH) return SEABED_Y
  const t = (d - quayHalf) / BEACH_WIDTH
  // Smootherstep — longer ease through the waterline, less of a cliff.
  const s = t * t * t * (t * (t * 6 - 15) + 10)
  return THREE.MathUtils.lerp(ISLAND_TOP_Y, SEABED_Y, s) + n * (1 - s) * 0.28
}

/** Chebyshev distance where the beach crosses the waterline. */
function shoreDistance(quayHalf: number): number {
  let lo = quayHalf
  let hi = quayHalf + BEACH_WIDTH
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    const h = islandHeight(mid, 0, quayHalf)
    if (h > WATER_Y) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function createSea(options: {
  size: number
  quayHalf: number
  sunDirection: THREE.Vector3
  /** Kept for call-site compatibility; no longer used for RT sim. */
  renderer?: THREE.WebGLRenderer
}): SeaSystem {
  const { size, quayHalf, sunDirection } = options
  const shore = shoreDistance(quayHalf)

  const group = new THREE.Group()
  group.name = 'sea'

  // ---- Sand island ---------------------------------------------------
  const sandLoader = new THREE.TextureLoader()
  const sandMap = sandLoader.load('images/sand.jpg')
  sandMap.colorSpace = THREE.SRGBColorSpace
  sandMap.wrapS = sandMap.wrapT = THREE.RepeatWrapping
  sandMap.anisotropy = 4
  sandMap.repeat.set(size * SAND_GRAIN_DENSITY, size * SAND_GRAIN_DENSITY)

  const sandNormal = sandLoader.load('images/sand_normal.jpg')
  sandNormal.wrapS = sandNormal.wrapT = THREE.RepeatWrapping
  sandNormal.anisotropy = 4
  sandNormal.repeat.copy(sandMap.repeat)

  const sandMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: sandMap,
    normalMap: sandNormal,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughness: 0.96,
    metalness: 0,
    fog: false,
    vertexColors: true,
    // Soft fill — beach stays warm; underwater verts are darkened below.
    emissive: new THREE.Color(0x2e2418),
    emissiveIntensity: 0.12,
  })

  const sandGeometry = new THREE.PlaneGeometry(
    size,
    size,
    SAND_SEGMENTS,
    SAND_SEGMENTS,
  )
  sandGeometry.rotateX(-Math.PI / 2)
  {
    const pos = sandGeometry.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const dry = new THREE.Color(0xe8d4a8)
    const wet = new THREE.Color(0xd4bc8e)
    const tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const y = islandHeight(x, z, quayHalf)
      pos.setY(i, y)
      // Height wetness only — keep underwater sand warm so the shoal reads.
      const above = THREE.MathUtils.smoothstep(y, WATER_Y - 0.2, WATER_Y + 0.1)
      tmp.copy(wet).lerp(dry, above)
      tmp.toArray(colors, i * 3)
    }
    pos.needsUpdate = true
    sandGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    sandGeometry.computeVertexNormals()
  }
  const sand = new THREE.Mesh(sandGeometry, sandMaterial)
  sand.name = 'sand'
  sand.receiveShadow = true
  sand.castShadow = false
  sand.frustumCulled = false
  sand.renderOrder = 0
  group.add(sand)

  // ---- Seascape water mesh -------------------------------------------
  const uniforms = {
    uTime: { value: 0 },
    uShore: { value: shore },
    uQuayHalf: { value: quayHalf },
    uCornerR: { value: ISLAND_CORNER_R },
    uSunDir: { value: sunDirection.clone().normalize() },
    uEye: { value: new THREE.Vector3(0, 24, 8) },
    uSandMap: { value: sandMap },
    uSandRepeat: { value: sandMap.repeat.clone() },
    uSeaSize: { value: size },
  }

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  })

  const waterGeometry = new THREE.PlaneGeometry(
    size,
    size,
    SURFACE_SEGMENTS,
    SURFACE_SEGMENTS,
  )
  waterGeometry.rotateX(-Math.PI / 2)
  const water = new THREE.Mesh(waterGeometry, waterMaterial)
  water.name = 'sea-surface'
  water.position.y = WATER_Y
  water.frustumCulled = false
  water.renderOrder = 2
  group.add(water)

  // Beach rubble — aquarium-style shapes, procedural stone maps.
  const rocks = createBeachRocks({
    quayHalf,
    beachWidth: BEACH_WIDTH,
    islandDist: (x, z) => islandDist(x, z, quayHalf),
    islandHeight: (x, z) => islandHeight(x, z, quayHalf),
  })
  group.add(rocks.group)

  let elapsed = 0

  return {
    mesh: group,
    islandTopY: ISLAND_TOP_Y,
    update(camera) {
      elapsed += 1 / 60
      uniforms.uTime.value = elapsed
      uniforms.uEye.value.copy(camera.position)
    },
    dispose() {
      rocks.dispose()
      sandGeometry.dispose()
      sandMaterial.dispose()
      sandMap.dispose()
      sandNormal.dispose()
      waterGeometry.dispose()
      waterMaterial.dispose()
    },
  }
}
