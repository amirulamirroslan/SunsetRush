import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3, Vector4, type Camera } from 'three';
import type { Atmosphere } from './atmosphere';

/** sRGB hex -> raw 0..1 components. Sky/water shaders are authored in sRGB and converted once at the very end. */
export const hexToVec3 = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const v3 = (hex: number): Vector3 => new Vector3(...hexToVec3(hex));
const v4 = (hex: number, w: number): Vector4 => new Vector4(...hexToVec3(hex), w);

/** Uniform objects shared (by reference) between the sky dome and the ocean so reflections always match the sky. */
export interface SkyUniforms {
  uSun: { value: Vector3 };
  uSkyZenith: { value: Vector3 }; uSkyMid: { value: Vector3 }; uSkyLow: { value: Vector3 }; uSkyHorizon: { value: Vector3 }; uSkyGround: { value: Vector3 };
  uSkyGlow: { value: Vector4 }; uSkyHalo: { value: Vector4 };
}

export function makeSkyUniforms(a: Atmosphere): SkyUniforms {
  const u = {
    uSun: { value: new Vector3() }, uSkyZenith: { value: new Vector3() }, uSkyMid: { value: new Vector3() }, uSkyLow: { value: new Vector3() },
    uSkyHorizon: { value: new Vector3() }, uSkyGround: { value: new Vector3() }, uSkyGlow: { value: new Vector4() }, uSkyHalo: { value: new Vector4() },
  };
  applySkyUniforms(u, a);
  return u;
}

export function applySkyUniforms(u: SkyUniforms, a: Atmosphere): void {
  u.uSun.value.copy(a.sunDir);
  u.uSkyZenith.value.copy(v3(a.sky.zenith)); u.uSkyMid.value.copy(v3(a.sky.mid)); u.uSkyLow.value.copy(v3(a.sky.low));
  u.uSkyHorizon.value.copy(v3(a.sky.horizon)); u.uSkyGround.value.copy(v3(a.sky.ground));
  u.uSkyGlow.value.copy(v4(a.sky.glow, a.sky.glowStrength)); u.uSkyHalo.value.copy(v4(a.sky.halo, a.sky.haloStrength));
}

/** GLSL shared by sky and water. All colours come from uniforms (see `Atmosphere`); nothing about the time of day lives in the shader. */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uSkyZenith; uniform vec3 uSkyMid; uniform vec3 uSkyLow; uniform vec3 uSkyHorizon; uniform vec3 uSkyGround;
uniform vec4 uSkyGlow; uniform vec4 uSkyHalo;
vec3 skyGradient(vec3 d, vec3 sun) {
  float h = d.y;
  vec3 col = mix(uSkyHorizon, uSkyLow, smoothstep(0.0, 0.16, h));
  col = mix(col, uSkyMid, smoothstep(0.1, 0.5, h));
  col = mix(col, uSkyZenith, smoothstep(0.35, 1.0, h));
  col = mix(col, uSkyGround, smoothstep(0.0, -0.35, h) * step(h, 0.0));
  float sd = max(dot(d, sun), 0.0);
  col += uSkyGlow.rgb * pow(sd, 6.0) * uSkyGlow.a + uSkyHalo.rgb * pow(sd, 48.0) * uSkyHalo.a;
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
uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform vec3 uCloudRim; uniform float uCover; uniform float uCloudDepth; uniform float uDisc;
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
  col += vec3(1.0, 0.97, 0.9) * smoothstep(0.9994, 0.9998, sd) * uDisc;
  if (d.y > 0.01) {
    vec2 p = (d.xz / (d.y + 0.16) * 1.15 + vec2(uTime * 0.006, uTime * 0.002)) * 1.6;
    float n = fbm(p);
    float lo = 0.52 - uCover * 0.3;
    float body = smoothstep(lo, lo + 0.3, n) * smoothstep(0.01, 0.2, d.y);
    float edge = smoothstep(lo, lo + 0.1, n) * (1.0 - smoothstep(lo + 0.1, lo + 0.3, n));
    // self-shadowing: a cloud is darker where there is more cloud between it and the sun (density sampled a step towards the sun)
    vec2 toSun = normalize(uSun.xz + vec2(1e-4)) * 0.16;
    float n2 = fbm(p + toSun);
    float lightK = clamp(0.72 - (n2 - n) * uCloudDepth * 5.0 - smoothstep(0.62, 0.95, n) * 0.28 * uCloudDepth, 0.0, 1.0);
    vec3 cc = mix(uCloudShade, uCloudLit, lightK);
    cc = mix(cc, uCloudRim, edge * (0.25 + pow(sd, 3.0) * 0.75));
    col = mix(col, cc, body * (0.9 - 0.2 * smoothstep(0.0, 0.18, 0.18 - d.y)));
  }
  col = pow(max(col, vec3(0.0)), vec3(2.2));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  readonly mesh: Mesh;
  readonly uniforms: SkyUniforms;
  private readonly mat: ShaderMaterial;
  private readonly cloud = {
    uTime: { value: 0 }, uOctaves: { value: 5 }, uCloudLit: { value: new Vector3() }, uCloudShade: { value: new Vector3() }, uCloudRim: { value: new Vector3() },
    uCover: { value: 0 }, uCloudDepth: { value: 0.5 }, uDisc: { value: 5 },
  };
  constructor(octaves: number, atmosphere: Atmosphere, uniforms?: SkyUniforms) {
    this.uniforms = uniforms ?? makeSkyUniforms(atmosphere);
    this.cloud.uOctaves.value = octaves;
    this.mat = new ShaderMaterial({ vertexShader: vert, fragmentShader: frag, side: BackSide, depthWrite: false, fog: false, uniforms: { ...this.uniforms, ...this.cloud } });
    this.setAtmosphere(atmosphere);
    this.mesh = new Mesh(new SphereGeometry(1, 48, 24), this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -1000; this.mesh.scale.setScalar(2500);
  }
  setAtmosphere(a: Atmosphere): void {
    applySkyUniforms(this.uniforms, a);
    this.cloud.uCloudLit.value.copy(v3(a.clouds.lit)); this.cloud.uCloudShade.value.copy(v3(a.clouds.shade)); this.cloud.uCloudRim.value.copy(v3(a.clouds.rim));
    this.cloud.uCover.value = a.clouds.cover; this.cloud.uCloudDepth.value = a.clouds.depth; this.cloud.uDisc.value = a.sky.disc;
  }
  setOctaves(n: number): void { this.cloud.uOctaves.value = n; }
  update(camera: Camera, time: number): void { this.mesh.position.copy(camera.position); this.cloud.uTime.value = time; }
  dispose(): void { this.mesh.geometry.dispose(); this.mat.dispose(); }
}

/** A flat unlit copy of the sky used only to build the reflection / ambient environment. */
export function makeEnvironmentSky(a: Atmosphere): Mesh {
  const sky = new Sky(3, a);
  sky.mesh.scale.setScalar(50);
  return sky.mesh;
}
