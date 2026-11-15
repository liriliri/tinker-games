import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

/**
 * Saltline-inspired grade: teal shadows, warm highlights, soft S-curve,
 * lifted blacks, and a light vignette. Applied in linear space before
 * OutputPass runs ACES + sRGB.
 */
const SaltlineGradeShader = {
  name: 'SaltlineGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.28 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    varying vec2 vUv;

    float luma(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
    }

    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float l = luma(col);

      // Split tone — teal in the lows, warm in the highs (saltline post.js).
      vec3 sh = vec3(0.80, 1.01, 1.13);
      vec3 hi = vec3(1.07, 1.00, 0.90);
      col *= mix(sh, hi, smoothstep(0.03, 0.55, l));

      // Gentle contrast S-curve.
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.2);

      // Lifted, slightly teal blacks.
      col = col * 0.988 + vec3(0.006, 0.0085, 0.011);

      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      float vig = smoothstep(0.18, 1.05, r2);
      col *= 1.0 - uVignette * vig * vig;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

export function createGradePass() {
  return new ShaderPass(SaltlineGradeShader)
}
