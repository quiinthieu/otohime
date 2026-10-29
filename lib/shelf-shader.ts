/** Pure shader contract. No DOM, GPU or Three.js dependency: also executable in Node. */
export const SHELF_THRESHOLDS = Object.freeze({ depth: 0.018, normal: 0.3, minNdv: 0.2 });
export const HATCH_BANDS = Object.freeze([0.25, 0.5, 0.75] as const);
export type OutlineParams = { debug: boolean; kd: number; kn: number; ndvCutoff: number };

export function grazingDepthThreshold(baseThreshold: number, ndv: number, minNdv: number = SHELF_THRESHOLDS.minNdv): number {
  const facing = Math.min(1, Math.abs(ndv));
  return facing < minNdv ? Infinity : baseThreshold / Math.max(facing, minNdv);
}

export function sobelEdgeWeight(depthEdge: number, normalEdge: number, kd: number, kn: number): number {
  return Math.max(kd * depthEdge, kn * normalEdge);
}

/** 0 = bare paper, 1 = diagonal, 2 = cross hatch, 3 = dense cross hatch. */
export function hatchDensityBand(luminance: number): number {
  return luminance < HATCH_BANDS[0] ? 3 : luminance < HATCH_BANDS[1] ? 2 : luminance < HATCH_BANDS[2] ? 1 : 0;
}

export function parseOutlineDebugParams(searchParams: Pick<URLSearchParams, "get">): OutlineParams {
  const bounded = (key: string, fallback: number, min: number, max: number) => {
    const raw = searchParams.get(key);
    if (raw === null || raw.trim() === "") return fallback;
    const number = Number(raw);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  return {
    debug: searchParams.get("outlineDebug") === "1",
    kd: bounded("kd", 1, 0, 8), kn: bounded("kn", 1, 0, 8),
    ndvCutoff: bounded("ndvCutoff", SHELF_THRESHOLDS.minNdv, 0.2, 1),
  };
}

export function buildShelfUniforms(params: OutlineParams) {
  return {
    uKd: { value: params.kd }, uKn: { value: params.kn },
    uNdvCutoff: { value: params.ndvCutoff }, uDebug: { value: params.debug ? 1 : 0 },
    uDepthThreshold: { value: SHELF_THRESHOLDS.depth }, uNormalThreshold: { value: SHELF_THRESHOLDS.normal },
  };
}

// Embed the same constants used by the CPU references, avoiding drifting thresholds.
const tonalHatching = /* glsl */`
float hatchDensityBand(float luminance) {
  return luminance < ${HATCH_BANDS[0]} ? 3.0 : luminance < ${HATCH_BANDS[1]} ? 2.0 : luminance < ${HATCH_BANDS[2]} ? 1.0 : 0.0;
}
float hatchLine(float coordinate) {
  float width = max(fwidth(coordinate), 0.035);
  float distanceToLine = abs(fract(coordinate) - 0.5);
  return 1.0 - smoothstep(0.045, 0.045 + width, distanceToLine);
}
float objectHatching(vec3 objectPosition, vec3 objectNormal, float luminance) {
  // Triplanar object-space coordinates: lines stay attached to books under parallax/lift.
  vec3 n = abs(objectNormal);
  vec2 p = n.z > max(n.x, n.y) ? objectPosition.xy : (n.x > n.y ? objectPosition.zy : objectPosition.xz);
  float band = hatchDensityBand(luminance);
  float ink = band >= 1.0 ? hatchLine((p.x + p.y * 0.72) * 16.0) : 0.0;
  if (band >= 2.0) ink = max(ink, hatchLine((p.x - p.y * 0.72) * 16.0));
  if (band >= 3.0) ink = max(ink, hatchLine((p.x + p.y * 0.72) * 32.0));
  return ink;
}`;

export const shelfObjectVertex = /* glsl */`
varying vec2 vUv;
varying vec3 vObjectPosition;
varying vec3 vObjectNormal;
varying vec3 vViewNormal;
varying vec3 vViewPosition;
void main() {
  vUv = uv;
  vObjectPosition = position;
  vObjectNormal = normal;
  vViewNormal = normalize(normalMatrix * normal);
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = viewPosition.xyz;
  gl_Position = projectionMatrix * viewPosition;
}`;

export const shelfObjectFragment = /* glsl */`
uniform sampler2D uSpine;
uniform float uHasSpine;
uniform float uWood;
uniform float uHighlight;
uniform vec3 uPaper;
uniform vec3 uInk;
varying vec2 vUv;
varying vec3 vObjectPosition;
varying vec3 vObjectNormal;
varying vec3 vViewNormal;
${tonalHatching}
void main() {
  float luminance = 0.22 + 0.74 * max(0.0, dot(normalize(vViewNormal), normalize(vec3(-0.4, 0.65, 1.0))));
  float tone = luminance < 0.4 ? 0.62 : luminance < 0.72 ? 0.82 : 1.0;
  vec3 paper = mix(uPaper, vec3(0.67, 0.48, 0.29), uWood * 0.32);
  vec3 colour = paper * tone;
  if (uHasSpine > 0.5 && vObjectNormal.z > 0.5) colour *= texture2D(uSpine, vUv).rgb;
  float hatch = objectHatching(vObjectPosition, vObjectNormal, luminance);
  float grain = uWood * (0.5 + 0.5 * sin(vObjectPosition.y * 130.0 + sin(vObjectPosition.x * 3.0)));
  colour = mix(colour, uInk, hatch * 0.26 + grain * 0.09);
  colour = mix(colour, mix(uPaper, vec3(0.92, 0.66, 0.27), 0.4), uHighlight * 0.28);
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;

export const shelfNormalFragment = /* glsl */`
varying vec3 vViewNormal;
varying vec3 vViewPosition;
void main() {
  vec3 N = normalize(vViewNormal);
  vec3 V = normalize(-vViewPosition);
  float ndv = abs(dot(N, V));
  gl_FragColor = vec4(N * 0.5 + 0.5, ndv);
}`;

export const shelfCompositeVertex = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const shelfCompositeFragment = /* glsl */`
uniform sampler2D uColour;
uniform sampler2D uDepth;
uniform sampler2D uNormal;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uKd;
uniform float uKn;
uniform float uNdvCutoff;
uniform float uDepthThreshold;
uniform float uNormalThreshold;
uniform float uDebug;
uniform vec3 uPaper;
uniform vec3 uInk;
varying vec2 vUv;
float brushNoise(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float linearDepth(float depth) { return (uNear * uFar) / (uFar - depth * (uFar - uNear)); }
void main() {
  vec2 texel = 1.0 / uResolution;
  float brush = brushNoise(floor(vUv * uResolution * 0.5));
  // Static paper wobble, never a time uniform or an idle animation.
  vec2 uv = clamp(vUv + vec2(brush - 0.5, sin(vUv.y * 900.0) * 0.3) * texel * 0.32, texel, 1.0 - texel);
  float centreRaw = texture2D(uDepth, uv).r;
  float centreDepth = linearDepth(centreRaw);
  vec4 normalSample = texture2D(uNormal, uv);
  float ndv = normalSample.a; // abs(dot(N, V)), evaluated per fragment in the normal target
  float depthX = 0.0, depthY = 0.0, silhouette = 0.0;
  vec3 normalX = vec3(0.0), normalY = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      float raw = texture2D(uDepth, uv + offset).r;
      float occupied = 1.0 - step(0.99999, raw);
      float centreOccupied = 1.0 - step(0.99999, centreRaw);
      silhouette = max(silhouette, abs(occupied - centreOccupied));
      float sx = float(x) * (y == 0 ? 2.0 : 1.0);
      float sy = float(y) * (x == 0 ? 2.0 : 1.0);
      float depth = (linearDepth(raw) - centreDepth) / max(centreDepth, 1.0);
      depthX += sx * depth; depthY += sy * depth;
      vec3 normal = texture2D(uNormal, uv + offset).rgb * 2.0 - 1.0;
      normalX += sx * normal; normalY += sy * normal;
    }
  }
  float threshold = uDepthThreshold / max(ndv, ${SHELF_THRESHOLDS.minNdv});
  float depthGradient = length(vec2(depthX, depthY)) * 0.25;
  // Suppress steep plank/book-top depth gradients, but preserve true silhouettes.
  float depthEdge = ndv < uNdvCutoff ? 0.0 : smoothstep(threshold, threshold * 2.0, depthGradient);
  depthEdge = max(depthEdge, silhouette);
  float normalGradient = sqrt(dot(normalX, normalX) + dot(normalY, normalY)) * 0.25;
  float normalEdge = smoothstep(uNormalThreshold, uNormalThreshold * 2.0, normalGradient);
  float edge = max(uKd * depthEdge, uKn * normalEdge);
  if (uDebug > 0.5) {
    // red=depth/silhouette, green=normal, blue=depth suppressed by grazing cutoff
    gl_FragColor = vec4(depthEdge, normalEdge, ndv < uNdvCutoff && centreRaw < 0.99999 ? 1.0 : 0.0, 1.0);
    return;
  }
  vec3 colour = texture2D(uColour, uv).rgb;
  colour *= 0.985 + brush * 0.015;
  gl_FragColor = vec4(mix(colour, uInk, clamp(edge * (0.72 + brush * 0.28), 0.0, 1.0)), 1.0);
  #include <colorspace_fragment>
}`;
