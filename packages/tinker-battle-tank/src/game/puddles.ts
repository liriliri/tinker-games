import * as THREE from 'three'
import clamp from 'licia/clamp'
import extend from 'licia/extend'
import random from 'licia/random'
import { fbm, hash2 } from '../lib/noise'

/**
 * Saltline-style wetness height field (R). Higher = dry plateaus;
 * carved basins go low so the shader can form puddle → soak → damp.
 * Pass a different `seed` each run so puddle layout changes.
 */
function createWetMask(
  size = 256,
  seed = random(0, 1e9),
): {
  texture: THREE.DataTexture
  data: Uint8Array
  size: number
} {
  const s = seed | 0
  // Slightly fewer than the dense layout — still a handful of puddles.
  const basinCount = 8 + ((hash2(s, 1, 11) * 4) | 0)
  const basins: Array<{ x: number; y: number; r: number; depth: number }> = []
  for (let i = 0; i < basinCount; i += 1) {
    basins.push({
      x: 0.12 + hash2(i, 2, s) * 0.76,
      y: 0.12 + hash2(i, 7, s + 3) * 0.76,
      r: 0.026 + hash2(i, 4, s + 5) * 0.045,
      depth: 0.5 + hash2(i, 8, s + 9) * 0.4,
    })
  }

  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      let height =
        fbm(u * 4, v * 4, s + 80, 5) * 0.55 +
        fbm(u * 11, v * 11, s + 81, 3) * 0.28 +
        fbm(u * 29, v * 29, s + 82, 2) * 0.12

      const warp =
        (fbm(u * 8, v * 8, s + 94, 3) - 0.5) * 0.025 +
        (fbm(u * 20, v * 20, s + 95, 2) - 0.5) * 0.012
      for (const basin of basins) {
        const dx = (u - basin.x + warp) / basin.r
        const dy = (v - basin.y - warp * 0.6) / (basin.r * 0.75)
        const d = Math.hypot(dx, dy)
        const carve = (1 - clamp(d * d, 0, 1)) * basin.depth
        height -= carve
      }

      const pixel = (y * size + x) * 4
      const byte = Math.round(clamp(height, 0, 1) * 255)
      data[pixel] = byte
      data[pixel + 1] = byte
      data[pixel + 2] = byte
      data[pixel + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  // Clamp — field maps to 0..1 once; no tiling outside the arena.
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  texture.colorSpace = THREE.NoColorSpace
  return { texture, data, size }
}

const MAX_TANK_RIPPLES = 20
const MAX_TRACK_MARKS = 32

/** Local X offset of each tread from tank center (matches createTankModel). */
const TRACK_HALF_WIDTH = 0.34

/** How long a tread-watermark batch lingers (whole trail fades together). */
const TRACK_MARK_LIFE = 1.85
/** After leaving water, keep stamping for this long (shared birth time). */
const TRACK_MARK_SPAWN_WINDOW = 0.75

export interface WetUniforms {
  uTime: { value: number }
  uWetG: { value: number }
  uMask: { value: THREE.Texture }
  uMaskScale: { value: number }
  /** Nearest cell mask — 1 punches a hole in the arena over river tiles. */
  uRiverMask: { value: THREE.Texture }
  uRiverCut: { value: number }
  /** xy = world XZ, z = birth time (sec), w = strength (0 = unused). */
  uRipples: { value: THREE.Vector4[] }
  /** xy = world XZ, z = birth, w = strength. */
  uTrackMarks: { value: THREE.Vector4[] }
  /** xy = forward direction on XZ for each tread mark. */
  uTrackMarkDir: { value: THREE.Vector4[] }
}

/**
 * Injects saltline-style wetness into a MeshStandardMaterial:
 * translucent damp/soak/puddle albedo, low roughness, soft ripples.
 */
export function augmentWetConcrete(
  material: THREE.MeshStandardMaterial,
  uniforms: WetUniforms,
) {
  material.onBeforeCompile = (shader) => {
    extend(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      varying vec3 vWetWorld;
      `,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      vWetWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform float uTime;
      uniform float uWetG;
      uniform sampler2D uMask;
      uniform float uMaskScale;
      uniform sampler2D uRiverMask;
      uniform float uRiverCut;
      uniform vec4 uRipples[${MAX_TANK_RIPPLES}];
      uniform vec4 uTrackMarks[${MAX_TRACK_MARKS}];
      uniform vec4 uTrackMarkDir[${MAX_TRACK_MARKS}];
      varying vec3 vWetWorld;

      float wsm(float e0, float e1, float x) {
        float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
        return t * t * (3.0 - 2.0 * t);
      }

      float gPuddle;
      float gSoak;
      float gDamp;
      float gFilm;
      float gWetRough;
      vec2 gNxz;
      `,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
      #include <map_fragment>
      {
        vec2 gxz = vWetWorld.xz;
        // Punch river cells out of the slab so the recessed channel shows.
        if (uRiverCut > 0.5) {
          vec2 riverUv = gxz * uMaskScale + 0.5;
          if (texture2D(uRiverMask, riverUv).r > 0.5) discard;
        }
        float mask = texture2D(uMask, gxz * uMaskScale + 0.5).r;
        float sn =
          texture2D(uMask, gxz * uMaskScale * 2.7 + vec2(0.13)).r * 0.45 +
          texture2D(uMask, gxz * uMaskScale * 7.1 + vec2(0.41)).r * 0.35 +
          texture2D(uMask, gxz * uMaskScale * 18.0 + vec2(0.07)).r * 0.2;
        // Low mask = carved basin. Most of the slab stays dry concrete.
        float h = mask + (sn - 0.5) * 0.035;
        float basin = wsm(0.5, 0.3, h);
        gPuddle = wsm(0.42, 0.8, basin) * uWetG;
        gSoak = wsm(0.2, 0.48, basin) * (1.0 - gPuddle) * uWetG;
        gDamp = wsm(0.05, 0.26, basin) * (1.0 - gPuddle - gSoak) * 0.42 * uWetG;
        gFilm = clamp(gSoak * 0.5, 0.0, 1.0);

        // Translucent wet — multiply so cement grain stays visible.
        diffuseColor.rgb *= mix(1.0, 0.82, gDamp);
        diffuseColor.rgb *= mix(1.0, 0.55, gSoak);
        float deep = gPuddle * gPuddle;
        vec3 wetBed =
          diffuseColor.rgb * mix(0.78, 0.36, deep) +
          vec3(0.008, 0.01, 0.012) * deep;
        diffuseColor.rgb = mix(diffuseColor.rgb, wetBed, gPuddle * 0.72);

        // Fading tread watermarks left after driving out of a puddle.
        float markSum = 0.0;
        for (int i = 0; i < ${MAX_TRACK_MARKS}; i++) {
          float str = uTrackMarks[i].w;
          if (str < 0.01) continue;
          float age = uTime - uTrackMarks[i].z;
          if (age < 0.0 || age > ${TRACK_MARK_LIFE.toFixed(1)}) continue;
          float fade = 1.0 - age / ${TRACK_MARK_LIFE.toFixed(1)};
          fade = fade * fade * (3.0 - 2.0 * fade);
          vec2 d = gxz - uTrackMarks[i].xy;
          vec2 fwd = uTrackMarkDir[i].xy;
          vec2 side = vec2(fwd.y, -fwd.x);
          float along = abs(dot(d, fwd));
          float across = abs(dot(d, side));
          float print =
            (1.0 - wsm(0.045, 0.09, across)) *
            (1.0 - wsm(0.1, 0.22, along));
          markSum += print * str * fade;
        }
        markSum = clamp(markSum, 0.0, 1.0);
        // Dark damp tread print — visible on dry slab, fades out.
        diffuseColor.rgb *= 1.0 - markSum * 0.42;
        float markWet = markSum * 0.55;

        gWetRough = mix(0.72, 0.36, gDamp);
        gWetRough = mix(gWetRough, 0.12, gSoak);
        gWetRough = mix(clamp(gWetRough, 0.1, 1.0), 0.04, gPuddle);
        gWetRough = mix(gWetRough, 0.22, markWet);

        // Ripples only in standing water — shallow soak/damp stays still.
        gNxz = vec2(0.0);
        // Gate hard: need a real puddle core, not the soak fringe.
        float deepWater = wsm(0.25, 0.7, gPuddle);
        if (deepWater > 0.02) {
          float t = uTime;
          float p1 = gxz.x * 5.2 + gxz.y * 3.1 + t * 1.8;
          float p2 = gxz.x * -3.6 + gxz.y * 5.8 - t * 1.35;
          float p3 = gxz.x * 7.4 + gxz.y * -4.2 + t * 2.2;
          float wave = sin(p1) * 0.5 + sin(p2) * 0.32 + sin(p3) * 0.18;
          gNxz = vec2(
            cos(p1) * 5.2 * 0.5 + cos(p2) * -3.6 * 0.32 + cos(p3) * 7.4 * 0.18,
            cos(p1) * 3.1 * 0.5 + cos(p2) * 5.8 * 0.32 + cos(p3) * -4.2 * 0.18
          ) * (0.04 * deepWater);
          diffuseColor.rgb *= 1.0 + wave * 0.1 * deepWater;

          // Twin tread wakes — compact rings (scale with local puddle depth).
          float wakeA = 0.0;
          vec2 wakeN = vec2(0.0);
          float wakeMask = deepWater * deepWater;
          // Shallower cores → smaller max radius so tiny puddles aren't flooded.
          float sizeK = mix(0.45, 1.0, deepWater);
          for (int i = 0; i < ${MAX_TANK_RIPPLES}; i++) {
            float str = uRipples[i].w;
            if (str < 0.01) continue;
            float age = t - uRipples[i].z;
            if (age < 0.0 || age > 1.35) continue;
            vec2 d = gxz - uRipples[i].xy;
            float dist = length(d);
            float dirN = 1.0 / max(dist, 1e-4);
            float fade = 1.0 - age / 1.35;
            fade *= fade;
            float amp = str * fade * wakeMask;
            float r0 = age * 0.85 * sizeK;
            float b0 = 0.045 + age * 0.025;
            float x0 = (dist - r0) / b0;
            float ring0 = x0 * exp(-x0 * x0) * 2.2;
            float r1 = age * 0.58 * sizeK;
            float b1 = 0.035 + age * 0.018;
            float x1 = (dist - r1) / b1;
            float ring1 = x1 * exp(-x1 * x1) * 1.5;
            float ring = ring0 + ring1 * 0.55;
            wakeA += ring * amp;
            wakeN += d * dirN * ring * amp;
          }
          gNxz += wakeN * 0.12;
          diffuseColor.rgb *= 1.0 + clamp(wakeA, -1.0, 1.0) * 0.32;
        }
      }
      `,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      /* glsl */ `
      #include <roughnessmap_fragment>
      float wetMix = clamp(gDamp * 0.7 + gSoak * 0.85 + gPuddle, 0.0, 1.0);
      roughnessFactor = mix(roughnessFactor, gWetRough, wetMix);
      `,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `
      #include <normal_fragment_maps>
      if (dot(gNxz, gNxz) > 1e-8) {
        normal = normalize(normal + mat3(viewMatrix) * vec3(-gNxz.x, 0.0, -gNxz.y));
      }
      `,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_physical_fragment>',
      /* glsl */ `
      #include <lights_physical_fragment>
      material.specularColor = mix(
        material.specularColor,
        vec3(0.22),
        max(gPuddle, gSoak * 0.4)
      );
      `,
    )
  }

  material.customProgramCacheKey = () => 'wet-concrete-saltline-28-river'
  material.needsUpdate = true
}

/**
 * High-res river punch mask (sub×sub texels per cell) so the deck can
 * overhang the channel rim instead of cutting flush with the cell edge.
 */
function createRiverMaskTexture(blocks: number, sub = 8) {
  const size = blocks * sub
  const data = new Uint8Array(size * size * 4)
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.flipY = false
  texture.needsUpdate = true
  texture.colorSpace = THREE.NoColorSpace
  return { texture, data, blocks, sub, size }
}

export interface WetGroundSystem {
  uniforms: WetUniforms
  hideMeshes: THREE.Object3D[]
  /** Rebuild puddle layout (call on each stage / game start). */
  reshuffle: () => void
  /** Mark arena cells that should open into the river channel. */
  setRiverCells: (rivers: ArrayLike<boolean | number>) => void
  /** Call each frame a tank moves — spawns twin tread wakes in wet areas. */
  notifyTankMotion: (
    tankId: number,
    worldX: number,
    worldZ: number,
    timeSec: number,
    /** Yaw in radians (same as tank group.rotation.y). */
    yaw: number,
  ) => void
  clearTank: (tankId: number) => void
  update: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    timeSec: number,
  ) => void
  dispose: () => void
}

/**
 * Wet mask covers the playfield once (world XZ ∈ [-half, half] → UV 0..1).
 * Only the arena slab should use the wet shader — apron outside steel stays dry.
 */
export function createWetGroundSystem(fieldSize: number): WetGroundSystem {
  let maskBundle = createWetMask(256)
  let maskData = maskBundle.data
  let maskSize = maskBundle.size
  // Map field world XZ so ±halfField → UV 0..1.
  const maskScale = 1 / fieldSize
  const ripples = Array.from(
    { length: MAX_TANK_RIPPLES },
    () => new THREE.Vector4(0, 0, -10, 0),
  )
  const trackMarks = Array.from(
    { length: MAX_TRACK_MARKS },
    () => new THREE.Vector4(0, 0, -10, 0),
  )
  const trackMarkDir = Array.from(
    { length: MAX_TRACK_MARKS },
    () => new THREE.Vector4(0, 1, 0, 0),
  )
  const riverMask = createRiverMaskTexture(Math.round(fieldSize))
  const uniforms: WetUniforms = {
    uTime: { value: 0 },
    uWetG: { value: 1 },
    uMask: { value: maskBundle.texture },
    uMaskScale: { value: maskScale },
    uRiverMask: { value: riverMask.texture },
    uRiverCut: { value: 0 },
    uRipples: { value: ripples },
    uTrackMarks: { value: trackMarks },
    uTrackMarkDir: { value: trackMarkDir },
  }

  let rippleWrite = 0
  let markWrite = 0
  const lastTank = new Map<
    number,
    {
      x: number
      z: number
      lastRipple: number
      lastMark: number
      wetCarry: number
      /** Shared birth time for one exit trail so it fades as a whole. */
      exitBatchTime: number
      lastTime: number
    }
  >()

  const sampleHeight = (worldX: number, worldZ: number) => {
    let u = worldX * maskScale + 0.5
    let v = worldZ * maskScale + 0.5
    u = ((u % 1) + 1) % 1
    v = ((v % 1) + 1) % 1
    const x = u * maskSize
    const y = v * maskSize
    const x0 = Math.floor(x) % maskSize
    const y0 = Math.floor(y) % maskSize
    const x1 = (x0 + 1) % maskSize
    const y1 = (y0 + 1) % maskSize
    const fx = x - Math.floor(x)
    const fy = y - Math.floor(y)
    const a = maskData[(y0 * maskSize + x0) * 4] / 255
    const b = maskData[(y0 * maskSize + x1) * 4] / 255
    const c = maskData[(y1 * maskSize + x0) * 4] / 255
    const d = maskData[(y1 * maskSize + x1) * 4] / 255
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }

  /** Approximate shader puddle amount from height (low height = wet). */
  const samplePuddle = (worldX: number, worldZ: number) => {
    const h = sampleHeight(worldX, worldZ)
    // Matches shader: basin when h is low; puddle core roughly h < 0.4.
    return clamp((0.48 - h) / 0.28, 0, 1)
  }

  const spawnRipple = (
    x: number,
    z: number,
    timeSec: number,
    strength: number,
  ) => {
    ripples[rippleWrite].set(x, z, timeSec, strength)
    rippleWrite = (rippleWrite + 1) % MAX_TANK_RIPPLES
  }

  const spawnTrackMark = (
    x: number,
    z: number,
    timeSec: number,
    strength: number,
    fwdX: number,
    fwdZ: number,
  ) => {
    trackMarks[markWrite].set(x, z, timeSec, strength)
    trackMarkDir[markWrite].set(fwdX, fwdZ, 0, 0)
    markWrite = (markWrite + 1) % MAX_TRACK_MARKS
  }

  const clearMarks = () => {
    for (let i = 0; i < MAX_TANK_RIPPLES; i += 1) ripples[i].w = 0
    for (let i = 0; i < MAX_TRACK_MARKS; i += 1) trackMarks[i].w = 0
    lastTank.clear()
  }

  return {
    uniforms,
    hideMeshes: [],
    reshuffle() {
      const prev = maskBundle.texture
      maskBundle = createWetMask(256)
      maskData = maskBundle.data
      maskSize = maskBundle.size
      uniforms.uMask.value = maskBundle.texture
      prev.dispose()
      clearMarks()
    },
    setRiverCells(rivers) {
      const n = riverMask.blocks
      const sub = riverMask.sub
      const size = riverMask.size
      const data = riverMask.data
      data.fill(0)
      // Thin deck lip for iron-rail feet (~6% of a cell).
      const inset = Math.max(1, Math.round(sub * 0.06))
      const isRiver = (col: number, row: number) => {
        if (col < 0 || row < 0 || col >= n || row >= n) return false
        return !!rivers[row * n + col]
      }
      let any = 0
      for (let row = 0; row < n; row += 1) {
        for (let col = 0; col < n; col += 1) {
          if (!isRiver(col, row)) continue
          any = 1
          const iL = isRiver(col - 1, row) ? 0 : inset
          const iR = isRiver(col + 1, row) ? 0 : inset
          const iT = isRiver(col, row - 1) ? 0 : inset
          const iB = isRiver(col, row + 1) ? 0 : inset
          for (let sy = iT; sy < sub - iB; sy += 1) {
            for (let sx = iL; sx < sub - iR; sx += 1) {
              const px = col * sub + sx
              const py = row * sub + sy
              const p = (py * size + px) * 4
              data[p] = 255
              data[p + 1] = 255
              data[p + 2] = 255
              data[p + 3] = 255
            }
          }
        }
      }
      riverMask.texture.needsUpdate = true
      uniforms.uRiverCut.value = any
    },
    notifyTankMotion(tankId, worldX, worldZ, timeSec, yaw) {
      let prev = lastTank.get(tankId)
      if (!prev) {
        lastTank.set(tankId, {
          x: worldX,
          z: worldZ,
          lastRipple: -1,
          lastMark: -1,
          wetCarry: 0,
          exitBatchTime: -1,
          lastTime: timeSec,
        })
        return
      }
      const dist = Math.hypot(worldX - prev.x, worldZ - prev.z)
      prev.x = worldX
      prev.z = worldZ
      prev.lastTime = timeSec

      const puddle = samplePuddle(worldX, worldZ)
      if (puddle > 0.35) {
        prev.wetCarry = 1
        prev.exitBatchTime = -1
      }

      if (dist < 0.02) return

      const c = Math.cos(yaw)
      const s = Math.sin(yaw)
      // Local ±X treads → world XZ.
      const ox = TRACK_HALF_WIDTH * c
      const oz = -TRACK_HALF_WIDTH * s
      // Local +Z forward → world XZ.
      const fwdX = s
      const fwdZ = c

      // Deep water: twin tread wake ripples.
      if (puddle > 0.35 && timeSec - prev.lastRipple >= 0.055) {
        const strength = Math.min(1.15, 0.65 + dist * 4.2)
        spawnRipple(worldX - ox, worldZ - oz, timeSec, strength)
        spawnRipple(worldX + ox, worldZ + oz, timeSec, strength)
        prev.lastRipple = timeSec
      }

      // Exit trail: stamp briefly with one shared birth time → fades as a whole.
      if (prev.wetCarry > 0 && puddle < 0.5) {
        if (prev.exitBatchTime < 0) prev.exitBatchTime = timeSec
        const age = timeSec - prev.exitBatchTime
        if (age <= TRACK_MARK_SPAWN_WINDOW && timeSec - prev.lastMark >= 0.06) {
          spawnTrackMark(
            worldX - ox,
            worldZ - oz,
            prev.exitBatchTime,
            1,
            fwdX,
            fwdZ,
          )
          spawnTrackMark(
            worldX + ox,
            worldZ + oz,
            prev.exitBatchTime,
            1,
            fwdX,
            fwdZ,
          )
          prev.lastMark = timeSec
        }
        if (age > TRACK_MARK_SPAWN_WINDOW) prev.wetCarry = 0
      }
    },
    clearTank(tankId) {
      lastTank.delete(tankId)
    },
    update(_renderer, _scene, _camera, timeSec) {
      uniforms.uTime.value = timeSec
      for (let i = 0; i < MAX_TANK_RIPPLES; i += 1) {
        if (ripples[i].w > 0 && timeSec - ripples[i].z > 1.4) {
          ripples[i].w = 0
        }
      }
      for (let i = 0; i < MAX_TRACK_MARKS; i += 1) {
        if (
          trackMarks[i].w > 0 &&
          timeSec - trackMarks[i].z > TRACK_MARK_LIFE
        ) {
          trackMarks[i].w = 0
        }
      }
    },
    dispose() {
      maskBundle.texture.dispose()
      riverMask.texture.dispose()
    },
  }
}
