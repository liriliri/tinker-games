precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 resolution;
varying vec2 outTexCoord;

// Modern OLED bloom + light RGB fringe and cool/warm bias (not CRT).
void main() {
  vec2 uv = outTexCoord;
  vec4 col = texture2D(uMainSampler, uv);
  vec2 px = 1.0 / resolution;

  float fringe = 1.35 * px.x;
  float r = texture2D(uMainSampler, uv + vec2(fringe, 0.0)).r;
  float g = col.g;
  float b = texture2D(uMainSampler, uv - vec2(fringe, 0.0)).b;
  vec3 base = vec3(r, g, b);

  vec4 blur = vec4(0.0);
  blur += texture2D(uMainSampler, uv + vec2(-2.0, -1.0) * px) * 0.04;
  blur += texture2D(uMainSampler, uv + vec2(-1.0, -2.0) * px) * 0.04;
  blur += texture2D(uMainSampler, uv + vec2(1.0, -2.0) * px) * 0.04;
  blur += texture2D(uMainSampler, uv + vec2(2.0, -1.0) * px) * 0.04;
  blur += texture2D(uMainSampler, uv + vec2(-2.0, 1.0) * px) * 0.04;
  blur += texture2D(uMainSampler, uv + vec2(-1.0, 2.0) * px) * 0.04;
  blur += texture2D(uMainSampler, uv + vec2(1.0, 2.0) * px) * 0.04;
  blur += texture2D(uMainSampler, uv + vec2(2.0, 1.0) * px) * 0.04;
  blur += texture2D(uMainSampler, uv + vec2(-3.0, 0.0) * px) * 0.05;
  blur += texture2D(uMainSampler, uv + vec2(3.0, 0.0) * px) * 0.05;
  blur += texture2D(uMainSampler, uv + vec2(0.0, -3.0) * px) * 0.05;
  blur += texture2D(uMainSampler, uv + vec2(0.0, 3.0) * px) * 0.05;
  blur += texture2D(uMainSampler, uv + vec2(-1.0, -1.0) * px) * 0.07;
  blur += texture2D(uMainSampler, uv + vec2(1.0, -1.0) * px) * 0.07;
  blur += texture2D(uMainSampler, uv + vec2(-1.0, 1.0) * px) * 0.07;
  blur += texture2D(uMainSampler, uv + vec2(1.0, 1.0) * px) * 0.07;
  blur += texture2D(uMainSampler, uv) * 0.18;

  float luma = dot(blur.rgb, vec3(0.2126, 0.7152, 0.0722));
  float bloomMask = smoothstep(0.1, 0.5, luma);
  vec3 bloomTint = vec3(0.85, 1.05, 1.2);
  vec3 bloom = blur.rgb * bloomTint * bloomMask * 0.62;

  vec3 outCol = base + bloom;
  outCol.r *= 1.02;
  outCol.g *= 0.98;
  outCol.b *= 1.06;
  outCol = (outCol - 0.5) * 1.06 + 0.5;
  outCol = clamp(outCol, 0.0, 1.0);

  gl_FragColor = vec4(outCol, col.a);
}
