import { BufferAttribute, BufferGeometry, Color, DataTexture, DataUtils, HalfFloatType, LinearFilter, Mesh, MeshStandardMaterial, RedFormat, type Texture } from 'three';
import { fbm2, noise2 } from '../sim/noise';
import { smoothstep } from '../sim/math';
import { newQuery, type Track } from '../sim/Track';
import { SEA_LEVEL, TERRAIN, groundHeight } from './terrainField';
import { makeGroundDetail } from './textures';

export interface Terrain {
  mesh: Mesh;
  nx: number; nz: number;
  heights: Float32Array;
  heightAt(x: number, z: number): number;
  /** Half-float height texture for the ocean shader. */
  heightTexture: DataTexture;
  detail: Texture;
}

const C = {
  wetSand: new Color(0xb8956a), sand: new Color(0xf3d9a2), dry: new Color(0xc9c286), grassSun: new Color(0x62b25a), grassA: new Color(0x4aa052),
  grassB: new Color(0x347f4a), forest: new Color(0x276445), rock: new Color(0x8f8d8a), rock2: new Color(0x9b8f86), peak: new Color(0xaea8a4), gravel: new Color(0x85807a), dryGrass: new Color(0x93a86a),
};

const GROUND_GLSL = /* glsl */ `
varying vec3 vWPos;
float th(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1.0, 0.0)), f.x), mix(th(i + vec2(0.0, 1.0)), th(i + vec2(1.0, 1.0)), f.x), f.y); }
float tf(vec2 p) { return tn(p) * 0.5 + tn(p * 2.03 + 7.1) * 0.3 + tn(p * 4.1 + 3.3) * 0.2; }
`;
const GROUND_COLOR = /* glsl */ `
{
  float vd = length(vViewPosition);
  float fineK = smoothstep(150.0, 25.0, vd);
  vec2 w = vWPos.xz;
  float n1 = tf(w * 0.7), n2 = tf(w * 0.16 + 5.0), n3 = tn(w * 0.035 + 11.0);
  float blades = tn(w * vec2(9.0, 11.0)) * tn(w * 3.1 + 2.0);
  float lum = 0.76 + 0.36 * (n1 * 0.35 + n2 * 0.4 + n3 * 0.25) + (blades - 0.25) * 0.24 * fineK;
  vec3 col = diffuseColor.rgb;
  float grass = smoothstep(0.0, 0.07, col.g - max(col.r * 0.92, col.b));
  col = mix(col, col * vec3(1.08, 1.02, 0.84), smoothstep(0.55, 0.85, n3) * 0.4 * grass);
  col = mix(col, col * vec3(0.78, 0.95, 0.86), smoothstep(0.6, 0.9, n2) * 0.35 * grass);
  diffuseColor.rgb = col * lum;
}
`;
const GROUND_NORMAL = /* glsl */ `
{
  vec2 w = vWPos.xz; float e = 0.1;
  float nearK = smoothstep(95.0, 12.0, length(vViewPosition));
  float h0 = tf(w * 2.3), hx = tf((w + vec2(e, 0.0)) * 2.3), hz = tf((w + vec2(0.0, e)) * 2.3);
  vec3 g = (viewMatrix * vec4((h0 - hx) / e, 0.0, (h0 - hz) / e, 0.0)).xyz;
  normal = normalize(normal + g * 0.055 * nearK);
}
`;

/** Builds the island ground: height-field mesh with baked colour variation, plus the half-float height texture used by the water. */
export function buildTerrain(track: Track): Terrain {
  const { minX, maxX, minZ, maxZ, cell } = TERRAIN;
  const nx = Math.round((maxX - minX) / cell) + 1, nz = Math.round((maxZ - minZ) / cell) + 1;
  const heights = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = minX + i * cell, z = minZ + j * cell;
    let h = groundHeight(track, x, z);
    const edge = Math.min(i, j, nx - 1 - i, nz - 1 - j);
    if (edge < 6) h = h * (edge / 6) + -14 * (1 - edge / 6); // sink the border below the sea
    heights[j * nx + i] = h;
  }
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  const c = new Color(), tq = newQuery();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const x = minX + i * cell, z = minZ + j * cell, h = heights[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    uv[k * 2] = x / 10; uv[k * 2 + 1] = z / 10;
    // slope from neighbours
    const hl = heights[j * nx + Math.max(0, i - 1)], hr = heights[j * nx + Math.min(nx - 1, i + 1)];
    const hd = heights[Math.max(0, j - 1) * nx + i], hu = heights[Math.min(nz - 1, j + 1) * nx + i];
    const slope = Math.hypot(hr - hl, hu - hd) / (2 * cell);
    const patch = fbm2(x * 0.012, z * 0.012, 3), fine = noise2(x * 0.15, z * 0.15), macro = fbm2(x * 0.0035 + 40, z * 0.0035, 2);
    // beach → dry grass → lush grass
    c.copy(C.grassA).lerp(C.grassB, smoothstep(0.4, 0.75, patch)).lerp(C.grassSun, smoothstep(0.55, 0.9, macro) * 0.7).lerp(C.forest, smoothstep(0.6, 0.85, fbm2(x * 0.02 + 7, z * 0.02 - 3, 3)) * 0.55);
    c.lerp(C.dry, smoothstep(3.5, 1.4, h + (fine - 0.5) * 1.2) * 0.9);
    c.lerp(C.sand, smoothstep(2.0, 0.9, h + (fine - 0.5) * 0.9));
    c.lerp(C.wetSand, smoothstep(0.9, 0.1, h));
    c.lerp(C.rock, smoothstep(0.55, 0.95, slope + (fine - 0.5) * 0.12));
    c.lerp(C.rock2, smoothstep(0.55, 0.9, fbm2(x * 0.03, z * 0.03, 2)) * smoothstep(0.5, 0.9, slope) * 0.6);
    c.lerp(C.peak, smoothstep(36, 54, h) * 0.8);
    // engineered verge: ragged gravel and dust beside the barrier that fades into the natural ground
    const dd = track.nearest(x, z, 40, tq);
    if (dd >= 0) {
      const rag = (fine - 0.5) * 3.2 + (fbm2(x * 0.09, z * 0.09, 2) - 0.5) * 5;
      c.lerp(C.dryGrass, smoothstep(track.wallOffset + 24, track.wallOffset + 6, dd + rag * 2) * 0.32);
      c.lerp(C.gravel, smoothstep(track.wallOffset + 7.5, track.wallOffset + 0.5, dd + rag) * 0.88);
    }
    if (h < SEA_LEVEL) c.lerp(C.wetSand, 0.7);
    const shade = 0.93 + fine * 0.14;
    col[k * 3] = c.r * shade; col[k * 3 + 1] = c.g * shade; col[k * 3 + 2] = c.b * shade;
  }
  let t = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    // alternate the diagonal to avoid visible grain
    if ((i + j) & 1) { idx[t++] = a; idx[t++] = d; idx[t++] = e; idx[t++] = a; idx[t++] = e; idx[t++] = b; }
    else { idx[t++] = a; idx[t++] = d; idx[t++] = b; idx[t++] = b; idx[t++] = d; idx[t++] = e; }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setIndex(new BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const detail = makeGroundDetail();
  const mat = new MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.96, metalness: 0 });
  // world-space multi-scale detail on top of the baked colours: mottled grass, sun-dried patches, blade grain and micro-relief
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GROUND_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + GROUND_COLOR)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GROUND_NORMAL);
  };
  mat.customProgramCacheKey = () => 'terrain-detail-v2';
  const mesh = new Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix();

  const half = new Uint16Array(nx * nz);
  for (let k = 0; k < heights.length; k++) half[k] = DataUtils.toHalfFloat(heights[k]);
  const heightTexture = new DataTexture(half, nx, nz, RedFormat, HalfFloatType);
  heightTexture.minFilter = heightTexture.magFilter = LinearFilter; heightTexture.needsUpdate = true;

  const heightAt = (x: number, z: number): number => {
    const fx = (x - minX) / cell, fz = (z - minZ) / cell;
    const i = Math.max(0, Math.min(nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(nz - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - i)), tz = Math.max(0, Math.min(1, fz - j));
    const a = heights[j * nx + i], b = heights[j * nx + i + 1], d = heights[(j + 1) * nx + i], e = heights[(j + 1) * nx + i + 1];
    return a + (b - a) * tx + (d - a) * tz + (a - b - d + e) * tx * tz;
  };
  return { mesh, nx, nz, heights, heightAt, heightTexture, detail };
}
