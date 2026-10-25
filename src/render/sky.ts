import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3, type Camera } from 'three';

/** Golden-hour palette shared by the sky dome, the ocean and the scene fog (sRGB hex). */
export const PALETTE = {
  fog: 0xf2a77c,
  horizon: 0xffb872,
  sun: 0xffa95c,
  zenith: 0x1c2a6b,
};
export const SUN_DIR = new Vector3(0.78, 0.17, 0.42).normalize();

/** GLSL shared by sky and water so reflections match the sky exactly. Colours are authored in sRGB and converted at the end. */
export const SKY_GLSL = /* glsl */ `
vec3 skyGradient(vec3 d, vec3 sun) {
  float h = d.y;
  vec3 zenith = vec3(0.09, 0.15, 0.45);
  vec3 mid = vec3(0.50, 0.31, 0.66);
  vec3 low = vec3(0.98, 0.46, 0.43);
  vec3 horizon = vec3(1.0, 0.74, 0.45);
  vec3 col = mix(horizon, low, smoothstep(0.0, 0.14, h));
  col = mix(col, mid, smoothstep(0.1, 0.4, h));
  col = mix(col, zenith, smoothstep(0.32, 0.9, h));
  col = mix(col, vec3(0.78, 0.4, 0.32), smoothstep(0.0, -0.45, h) * step(h, 0.0));
  float sd = max(dot(d, sun), 0.0);
  col += vec3(1.0, 0.55, 0.22) * pow(sd, 6.0) * 0.34 + vec3(1.0, 0.8, 0.5) * pow(sd, 48.0) * 0.85;
  return col;
}
`;

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w;
}`;

const frag = /* glsl */ `
uniform vec3 uSun; uniform float uTime; uniform int uOctaves;
varying vec3 vDir;
${SKY_GLSL}
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { if (i >= uOctaves) break; s += vnoise(p) * a; p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyGradient(d, uSun);
  float sd = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.95, 0.8) * smoothstep(0.9994, 0.9998, sd) * 5.0;
  if (d.y > 0.01) {
    vec2 p = d.xz / (d.y + 0.16) * 1.15 + vec2(uTime * 0.006, uTime * 0.002);
    float n = fbm(p * 1.6);
    float body = smoothstep(0.5, 0.82, n) * smoothstep(0.01, 0.2, d.y);
    float edge = smoothstep(0.5, 0.62, n) * (1.0 - smoothstep(0.62, 0.82, n));
    vec3 shade = mix(vec3(0.42, 0.26, 0.5), vec3(1.0, 0.6, 0.38), clamp(0.25 + pow(sd, 1.5) * 1.1 + d.y * 0.0, 0.0, 1.0));
    vec3 rim = vec3(1.0, 0.82, 0.55) * (0.55 + pow(sd, 3.0) * 1.2);
    vec3 cc = mix(shade, rim, edge * 0.8);
    col = mix(col, cc, body * 0.88);
  }
  col = pow(max(col, vec3(0.0)), vec3(2.2));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  constructor(octaves = 5) {
    this.mat = new ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: BackSide, depthWrite: false, fog: false,
      uniforms: { uSun: { value: SUN_DIR.clone() }, uTime: { value: 0 }, uOctaves: { value: octaves } },
    });
    this.mesh = new Mesh(new SphereGeometry(1, 48, 24), this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -1000; this.mesh.scale.setScalar(2500);
  }
  setOctaves(n: number): void { this.mat.uniforms.uOctaves.value = n; }
  update(camera: Camera, time: number): void { this.mesh.position.copy(camera.position); this.mat.uniforms.uTime.value = time; }
  dispose(): void { this.mesh.geometry.dispose(); this.mat.dispose(); }
}

/** A flat unlit copy of the sky used only to build the reflection environment. */
export function makeEnvironmentSky(): Mesh {
  const sky = new Sky(3);
  sky.mesh.scale.setScalar(50);
  return sky.mesh;
}

export const hexToVec3 = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
export const fogColor = (): Color => new Color(PALETTE.fog);
