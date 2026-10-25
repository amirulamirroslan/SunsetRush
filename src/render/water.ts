import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector4, type DataTexture } from 'three';
import { PALETTE, SKY_GLSL, SUN_DIR, hexToVec3 } from './sky';
import { TERRAIN } from './terrainField';

const vert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform float uTime; uniform sampler2D uHeight; uniform vec4 uBounds;
uniform vec3 uSun; uniform vec3 uFog; uniform float uFogDensity; uniform float uSparkle;
varying vec3 vWorld;
${SKY_GLSL}
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  // layered travelling waves → gradient used as a bump
  vec2 g = vec2(0.0);
  g += vec2(cos(p.x * 0.09 + t * 0.8), 0.4 * cos(p.y * 0.11 - t * 0.6)) * 0.10;
  g += vec2(cos((p.x + p.y) * 0.21 + t * 1.3), cos((p.x + p.y) * 0.21 + t * 1.3)) * 0.05;
  g += vec2(cos(p.x * 0.45 - t * 1.9 + p.y * 0.2), cos(p.y * 0.5 + t * 1.6)) * 0.03;
  g += (vec2(vnoise(p * 0.8 + t * 0.35), vnoise(p * 0.8 - t * 0.3 + 7.0)) - 0.5) * 0.12;
  float camDist = length(cameraPosition - vWorld);
  g *= 1.0 / (1.0 + camDist * 0.006); // fade ripples with distance: no moire at the horizon
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(cameraPosition - vWorld);
  vec2 huv = (p - uBounds.xy) / uBounds.zw;
  float ground = texture2D(uHeight, huv).r;
  float depth = max(-ground, 0.0);
  if (huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0) depth = 30.0;

  vec3 shallow = vec3(0.36, 0.95, 0.80), mid = vec3(0.06, 0.62, 0.78), deep = vec3(0.03, 0.20, 0.46);
  vec3 body = mix(shallow, mid, smoothstep(0.2, 4.5, depth));
  body = mix(body, deep, smoothstep(3.0, 26.0, depth));
  body = mix(body, vec3(0.93, 0.82, 0.58), (1.0 - smoothstep(0.0, 0.9, depth)) * 0.55); // sand showing through
  float sunUp = smoothstep(-0.1, 0.4, uSun.y);
  body *= 0.75 + 0.35 * sunUp;

  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 r = reflect(-v, n); r.y = abs(r.y);
  vec3 refl = skyGradient(r, uSun);
  vec3 col = mix(body, refl, clamp(fres * 0.95, 0.0, 1.0));

  // sun glitter
  vec3 rr = reflect(-uSun, n);
  float spec = pow(max(dot(rr, v), 0.0), 220.0) * 6.0 + pow(max(dot(rr, v), 0.0), 22.0) * 0.35;
  float sparkle = 0.55 + 0.45 * vnoise(p * 1.7 + t * 2.1);
  col += vec3(1.0, 0.78, 0.48) * spec * sparkle * uSparkle;

  // foam along the shoreline (animated surf line)
  float surf = 0.35 + 0.3 * sin(t * 0.9 + vnoise(p * 0.07) * 6.0);
  float foam = (1.0 - smoothstep(0.0, 0.55, abs(depth - surf * 0.5))) * 0.55 + (1.0 - smoothstep(0.0, 0.35, depth)) * 0.85;
  foam *= 0.55 + 0.45 * vnoise(p * 1.3 + t * 0.6);
  col = mix(col, vec3(1.0, 0.97, 0.9), clamp(foam, 0.0, 1.0) * 0.9);

  float dist = length(cameraPosition - vWorld);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFog, clamp(f, 0.0, 1.0));
  col = pow(max(col, vec3(0.0)), vec3(2.2));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Ocean {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  constructor(heightTexture: DataTexture, fogDensity: number) {
    const { minX, maxX, minZ, maxZ } = TERRAIN;
    this.mat = new ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: DoubleSide, fog: false,
      uniforms: {
        uTime: { value: 0 }, uHeight: { value: heightTexture }, uBounds: { value: new Vector4(minX, minZ, maxX - minX, maxZ - minZ) },
        uSun: { value: SUN_DIR.clone() }, uFog: { value: new Color(...hexToVec3(PALETTE.fog)) }, uFogDensity: { value: fogDensity }, uSparkle: { value: 1 },
      },
    });
    const geo = new PlaneGeometry(9000, 9000, 1, 1); geo.rotateX(-Math.PI / 2);
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -10;
  }
  update(time: number): void { this.mat.uniforms.uTime.value = time; }
  dispose(): void { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
