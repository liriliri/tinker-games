import * as THREE from 'three'

/**
 * Inverted sky dome — mainly so puddle reflections have a real sky to mirror
 * instead of a flat clear-color. Soft sun glow matches the warm key light.
 */
export function createSkyDome(sunDirection: THREE.Vector3) {
  const material = new THREE.ShaderMaterial({
    name: 'BattleSky',
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x4e74a8) },
      uHorizon: { value: new THREE.Color(0xc8d6e6) },
      uGround: { value: new THREE.Color(0x8a93a0) },
      uSunDir: { value: sunDirection.clone().normalize() },
      uSunColor: { value: new THREE.Color(0xffe8c8) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = normalize(world.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vDir;

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        // Sky above horizon, soft ground wash below (for reflection glances).
        vec3 sky = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.65));
        vec3 col = mix(uGround, sky, smoothstep(-0.15, 0.08, h));

        float sun = pow(max(dot(d, uSunDir), 0.0), 48.0);
        float glow = pow(max(dot(d, uSunDir), 0.0), 4.0);
        col += uSunColor * (sun * 1.4 + glow * 0.22);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1000
  mesh.name = 'sky'
  return mesh
}
