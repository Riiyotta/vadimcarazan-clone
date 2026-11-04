// Tile shading shared by the instanced field and the hi-res close-ups:
// rounded 4:3 corners, dithered near-dissolve, far fade into the background, mip-bias depth of field,
// mean-colour develop, hover tint and edge.

const FRAG_COMMON = /* glsl */ `
  uniform vec3 uBg;
  uniform float uFog;
  uniform float uBias;
  float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  float roundedMask(vec2 uv) {
    vec2 half_ = vec2(1.333333, 1.0) * 0.5;
    vec2 q = abs((uv - 0.5) * vec2(1.333333, 1.0)) - (half_ - 0.06);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.06;
  }
  vec3 shade(vec3 c, float dim, float depth, float hover, vec2 uv) {
    c = mix(uBg, c, dim);
    c = mix(c, uBg, smoothstep(520.0, 1300.0, depth) * uFog);
    if (hover > 0.5) {
      c = mix(c, vec3(1.0), 0.06);
      float e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y) * 0.75);
      if (e < 0.014) c = vec3(1.0);
    }
    return c;
  }
`

export const FIELD_VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute float iSize;
  attribute float iTile;
  attribute float iAlpha;
  attribute float iDim;
  attribute float iHover;
  attribute vec3 iColor;
  attribute float iSeed;
  attribute float iLum;
  uniform vec2 uGrid;
  uniform vec2 uTile;
  uniform vec2 uInset;
  varying vec2 vUv;
  varying vec2 vAtlas;
  varying float vAlpha;
  varying float vDim;
  varying float vHover;
  varying float vDepth;
  varying float vSeed;
  varying vec3 vColor;
  varying float vLum;
  void main() {
    vUv = uv;
    vLum = iLum;
    float col = mod(iTile, uGrid.x);
    float row = floor(iTile / uGrid.x + 0.0001);
    vAtlas = vec2(col * uTile.x + uInset.x + uv.x * (uTile.x - 2.0 * uInset.x),
                  row * uTile.y + uInset.y + (1.0 - uv.y) * (uTile.y - 2.0 * uInset.y));
    vec3 p = iPos + vec3(position.x * iSize * 1.333333, position.y * iSize, 0.0);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vDepth = -mv.z;
    float near = smoothstep(1.1 * iSize, 2.6 * iSize, length(mv.xyz));
    vAlpha = iAlpha * near;
    vDim = iDim;
    vHover = iHover;
    vSeed = iSeed;
    vColor = iColor;
  }
`

export const FIELD_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uDev;
  uniform float uShift;
  varying float vLum;
  varying vec2 vUv;
  varying vec2 vAtlas;
  varying float vAlpha;
  varying float vDim;
  varying float vHover;
  varying float vDepth;
  varying float vSeed;
  varying vec3 vColor;
  ${FRAG_COMMON}
  void main() {
    if (roundedMask(vUv) > 0.0) discard;
    if (vAlpha < 0.999 && ign(gl_FragCoord.xy) >= vAlpha) discard;
    float lod = uFog * pow(smoothstep(45.0, 1150.0, vDepth), 0.75) * 5.0 + uBias;
    vec3 tex = texture2D(uAtlas, vAtlas, lod).rgb;
    float dev = clamp((uDev - vSeed * 0.9) / 0.6, 0.0, 1.0);
    vec3 c = mix(vColor, tex, dev);
    // at the portrait, lean each tile toward its halftone cell's brightness so the face reads through the colours
    c = mix(c, vec3(vLum), uShift);
    gl_FragColor = vec4(shade(c, vDim, vDepth, vHover, vUv), 1.0);
  }
`

export const HI_VERT = /* glsl */ `
  uniform float uSize;
  varying vec2 vUv;
  varying float vDepth;
  varying float vNear;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vDepth = -mv.z;
    vNear = smoothstep(1.1 * uSize, 2.6 * uSize, length(mv.xyz));
  }
`

export const HI_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uAlpha;
  uniform float uDim;
  uniform float uHover;
  varying vec2 vUv;
  varying float vDepth;
  varying float vNear;
  ${FRAG_COMMON}
  void main() {
    if (roundedMask(vUv) > 0.0) discard;
    float a = uAlpha * vNear;
    if (a < 0.999 && ign(gl_FragCoord.xy + 0.5) >= a) discard;
    vec3 tex = texture2D(uMap, vUv, uBias).rgb;
    gl_FragColor = vec4(shade(tex, uDim, vDepth, uHover, vUv), 1.0);
  }
`

export const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// separable 13-tap gaussian (weights from the spec), radius = soft^2 * 3.5 texels of the half-res target
export const BLUR_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    float w[7];
    w[0] = 0.1964; w[1] = 0.1760; w[2] = 0.1255; w[3] = 0.0713; w[4] = 0.0323; w[5] = 0.0117; w[6] = 0.0034;
    vec4 c = texture2D(uTex, vUv) * w[0];
    for (int i = 1; i < 7; i++) {
      vec2 o = uDir * float(i);
      c += (texture2D(uTex, vUv + o) + texture2D(uTex, vUv - o)) * w[i];
    }
    gl_FragColor = c;
  }
`

export const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3 uBg;
  uniform float uSoft;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uTex, vUv);
    float k = 0.35 * uSoft;
    gl_FragColor = vec4(c.rgb * (1.0 - k) + uBg * c.a * k, c.a);
  }
`
