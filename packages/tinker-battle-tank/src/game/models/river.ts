import * as THREE from 'three'
import { createRockMaps } from '../rocks'
import { createConcreteMaterial, type ConcreteMaps } from './concrete'

/** Channel depth below the concrete deck. */
export const RIVER_DEPTH = 0.42
/** Water Y relative to deck (below ground, above the bed). */
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

/** Lighter than the wet concrete deck so the rim reads. */
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

/** Darker fill so the recessed channel isn’t a void. */
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
