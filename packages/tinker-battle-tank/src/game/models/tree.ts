import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import clamp from 'licia/clamp'
import each from 'licia/each'
import seedRandom from 'licia/seedRandom'
import { fbm, smoothstep } from '../../lib/noise'
import { dataToTexture } from '../../lib/texture'

/** Local Y of the canopy volume centre (used by the volumetric leaf shader). */
const TREE_CANOPY_CENTER_Y = 0.24

/**
 * Fluffy anime canopy (fluffytree-threejs): leaf cards sprayed over a few
 * overlapping sphere clumps. Origin is the underside (place at groundY).
 */
export function createTreeGeometry() {
  // [radius, x, y, z, leafCount] — Blender-style "NOVA COPA Esfera" clumps.
  const clumps: Array<[number, number, number, number, number]> = [
    [0.18, 0, 0.2, 0, 36],
    [0.14, 0.13, 0.22, 0.06, 24],
    [0.14, -0.12, 0.22, -0.05, 24],
    [0.13, 0.03, 0.24, -0.13, 22],
    [0.13, -0.04, 0.24, 0.12, 22],
    [0.12, 0, 0.36, 0, 20],
  ]

  const rnd = seedRandom(918273, 0, 1, true)
  const parts: THREE.BufferGeometry[] = []
  const outward = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const twist = new THREE.Quaternion()
  const zAxis = new THREE.Vector3(0, 0, 1)

  for (const [radius, cx, cy, cz, count] of clumps) {
    // Fibonacci sphere keeps cards evenly covering each clump.
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1)
      const y = 1 - t * 2
      const ring = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = golden * i
      outward.set(Math.cos(theta) * ring, y, Math.sin(theta) * ring).normalize()

      const r = radius * (0.82 + rnd() * 0.28)
      const px = cx + outward.x * r
      const py = cy + outward.y * r
      const pz = cz + outward.z * r

      const size = 0.07 + rnd() * 0.05
      const leaf = new THREE.PlaneGeometry(size, size)
      quat.setFromUnitVectors(zAxis, outward)
      twist.setFromAxisAngle(outward, rnd() * Math.PI * 2)
      quat.premultiply(twist)
      // Slight random tilt so the volume reads fluffy, not shell-like.
      leaf.rotateX((rnd() - 0.5) * 0.7)
      leaf.rotateY((rnd() - 0.5) * 0.7)
      leaf.applyQuaternion(quat)
      leaf.translate(px, py, pz)
      parts.push(leaf)
    }
  }

  const merged = mergeGeometries(parts)
  each(parts, (geo) => geo.dispose())
  return merged ?? new THREE.PlaneGeometry(0.1, 0.1)
}

/** Jagged leaf-cluster mask (Three.js alphaMap reads the green channel). */
function createLeafAlphaMap(size = 128) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const dx = u - 0.5
      const dy = v - 0.5
      const ang = Math.atan2(dy, dx)
      const dist = Math.sqrt(dx * dx + dy * dy) * 2
      const blotch = fbm(u * 5, v * 5, 81, 4)
      const edge =
        0.7 +
        0.14 * Math.sin(ang * 5 + blotch * 2) +
        0.08 * Math.sin(ang * 11) +
        (blotch - 0.5) * 0.18
      const alpha = smoothstep(edge + 0.1, edge - 0.06, dist)
      const g = clamp(alpha * 255, 0, 255)
      data[i] = g
      data[i + 1] = g
      data[i + 2] = g
      data[i + 3] = 255
    }
  }
  return dataToTexture(data, size, false)
}

/**
 * Fluffytree volumetric canopy: lit/shadow/highlight gradient from tree centre
 * toward the sun, plus camera-facing normals so leaf cards stay full.
 */
export function createTreeMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uLightDirection: { value: new THREE.Vector3(11, 13, 7).normalize() },
  }
  const alphaMap = createLeafAlphaMap()
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    alphaMap,
    side: THREE.DoubleSide,
    alphaTest: 0.5,
    depthWrite: true,
  })

  material.onBeforeCompile = (shader) => {
    material.userData.shader = shader
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uLightDirection = uniforms.uLightDirection
    shader.uniforms.uGradientStart = { value: -1 }
    shader.uniforms.uGradientEnd = { value: 2.7 }
    shader.uniforms.uLitColor = { value: new THREE.Color(0x21ff08) }
    shader.uniforms.uShadowColor = { value: new THREE.Color(0x001d33) }
    shader.uniforms.uHighlightColor = { value: new THREE.Color(0x8cff00) }
    shader.uniforms.uHighlightStart = { value: 0.5 }
    shader.uniforms.uHighlightEnd = { value: 1.8 }
    shader.uniforms.uLeafShadowDarkness = { value: 0.2 }
    shader.uniforms.uCanopyCenterY = { value: TREE_CANOPY_CENTER_Y }
    // Middle ground — readable sway without looking frantic.
    shader.uniforms.uWindStrength = { value: 0.048 }
    shader.uniforms.uWindFrequency = { value: 7.5 }
    shader.uniforms.uWindSpeed = { value: 0.75 }

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform float uTime;
      uniform float uCanopyCenterY;
      uniform float uWindStrength;
      uniform float uWindFrequency;
      uniform float uWindSpeed;
      varying vec3 vWorldPosition;
      varying vec3 vTreeCenter;
      `,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      {
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.1;
        #else
          float phase = 0.0;
        #endif
        float t = uTime * uWindSpeed + phase;
        float gust =
          sin(position.x * uWindFrequency + t) * 0.55 +
          sin(position.z * uWindFrequency * 0.7 + t * 1.3) * 0.45;
        // Higher leaves sway more; keep the underside planted.
        float amp = uWindStrength * (0.2 + max(position.y, 0.0) * 1.8);
        transformed.x += gust * amp;
        transformed.z += cos(position.y * uWindFrequency + t * 0.9) * amp * 0.85;
        transformed.y += sin(t * 1.8 + phase) * amp * 0.12;

        vec3 localCenter = vec3(0.0, uCanopyCenterY, 0.0);
        #ifdef USE_INSTANCING
          vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vTreeCenter = (modelMatrix * instanceMatrix * vec4(localCenter, 1.0)).xyz;
        #else
          vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vTreeCenter = (modelMatrix * vec4(localCenter, 1.0)).xyz;
        #endif
      }
      `,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      varying vec3 vWorldPosition;
      varying vec3 vTreeCenter;
      uniform vec3 uLightDirection;
      uniform float uGradientStart;
      uniform float uGradientEnd;
      uniform vec3 uLitColor;
      uniform vec3 uShadowColor;
      uniform vec3 uHighlightColor;
      uniform float uHighlightStart;
      uniform float uHighlightEnd;
      uniform float uLeafShadowDarkness;
      `,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
      #include <color_fragment>
      {
        float shadow = 1.0;
        #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
          shadow = getShadow(
            directionalShadowMap[0],
            directionalLightShadows[0].shadowMapSize,
            directionalLightShadows[0].shadowIntensity,
            directionalLightShadows[0].shadowBias,
            directionalLightShadows[0].shadowRadius,
            vDirectionalShadowCoord[0]
          );
        #endif
        vec3 fromCenter = normalize(vWorldPosition - vTreeCenter);
        float lightAlignment = dot(fromCenter, uLightDirection);
        float baseFactor = smoothstep(uGradientStart, uGradientEnd, lightAlignment);
        vec3 baseColor = mix(uShadowColor, uLitColor, baseFactor);
        float highlightFactor = smoothstep(uHighlightStart, uHighlightEnd, lightAlignment);
        vec3 gradientColor = mix(baseColor, uHighlightColor, highlightFactor);
        diffuseColor.rgb = mix(
          gradientColor * uLeafShadowDarkness,
          gradientColor,
          shadow
        );
      }
      `,
    )
    // Face cards toward view-up so thin planes stay full instead of going dark.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      /* glsl */ `
      #include <normal_fragment_begin>
      {
        vec3 worldUp = vec3(0.0, 1.0, 0.0);
        normal = normalize(mat3(viewMatrix) * worldUp);
      }
      `,
    )
  }
  material.customProgramCacheKey = () => 'battle-tank-fluffy-canopy-5'

  return { material, uniforms }
}
