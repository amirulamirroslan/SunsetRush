import {
  BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3, type Material,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm2, noise2 } from '../sim/noise';
import { clamp01, smoothstep } from '../sim/math';
import { Rng } from '../sim/rng';
import { newQuery, type Track } from '../sim/Track';
import type { Terrain } from './terrain';
import { GeoBuilder, xform } from './propGeo';

/**
 * Hand-built vegetation and rock meshes (procedural, vertex-coloured, with ambient occlusion baked into the colours),
 * the clustered placement that decides where they grow, and a chunked instancing helper with distance LOD.
 * Everything is deterministic (seeded) so the circuit looks the same on every run.
 */

const lerpC = (a: number, b: number, t: number): Color => new Color(a).lerp(new Color(b), clamp01(t));

/** A noise-displaced, smooth-shaded blob: the building block of foliage, bushes and boulders. */
function lobe(r: number, seed: number, detail: number, bump: number): BufferGeometry {
  let g: BufferGeometry = new IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + (fbm2(x * 2.4 + seed * 7.1, z * 2.4 + y * 2.1 + seed * 3.3, 3) - 0.5) * bump;
    p.setXYZ(i, x * r * n, y * r * n, z * r * n);
  }
  g.computeVertexNormals();
  return g;
}

/** Leaf colour with a dark, shaded interior and a sun-lit crown; `cx/cy/cz` is the canopy centre, `reach` its radius. */
function leafColor(x: number, y: number, z: number, cx: number, cy: number, cz: number, reach: number, dark: number, light: number, warm = 0): Color {
  const dx = x - cx, dy = y - cy, dz = z - cz;
  const out = clamp01(Math.hypot(dx, dz) / reach);
  const top = clamp01(0.5 + dy / (reach * 1.4));
  const t = clamp01(top * 0.7 + out * 0.2 + (noise2(x * 2.6 + 4, z * 2.6 + y * 1.9) - 0.5) * 0.28);
  const c = lerpC(dark, light, t);
  if (warm > 0) c.lerp(new Color(0xc2ad52), warm * smoothstep(0.55, 1, t) * 0.5);
  const ao = 0.62 + 0.38 * clamp01(0.25 + top * 0.55 + out * 0.45);
  return c.multiplyScalar(ao);
}

export function broadleafMesh(seed: number, lod: 0 | 1): BufferGeometry {
  const rng = new Rng(seed), b = new GeoBuilder();
  const H = rng.range(3.4, 4.3);
  b.add(new CylinderGeometry(0.2, 0.4, H, lod ? 5 : 8, lod ? 1 : 3), (_x, y) => lerpC(0x34383e, 0x5e6068, y / H), xform(0, H / 2, 0));
  if (!lod) {
    b.add(new CylinderGeometry(0.42, 0.78, 0.55, 8, 1), 0x30281f, xform(0, 0.27, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rng.range(-0.4, 0.4);
      b.add(new CylinderGeometry(0.07, 0.15, 2.3, 5, 1), 0x544636, xform(Math.cos(a) * 0.55, H + 0.45, Math.sin(a) * 0.55, 1, 1, 1, 0, Math.sin(a) * 0.62, -Math.cos(a) * 0.62));
    }
  }
  const cy = H + 1.5, reach = 2.7;
  const n = lod ? 3 : 12;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + rng.range(-0.3, 0.3);
    const rad = i === 0 ? 0 : rng.range(0.7, reach - 0.5) * (i > 5 ? 1.05 : 0.8);
    const lx = Math.cos(a) * rad, lz = Math.sin(a) * rad;
    const ly = cy + (i === 0 ? 0.9 : rng.range(-1.2, 1.4)) - rad * 0.12;
    const r = (i === 0 ? 1.95 : rng.range(1.0, 1.7)) * (lod ? 1.25 : 1);
    const g = lobe(r, seed * 31 + i, lod ? 1 : 2, 0.62);
    b.add(g, (x, y, z) => leafColor(x, y, z, 0, cy + 0.4, 0, reach, 0x174a33, 0x62b560, 0.22), xform(lx, ly, lz, 1, 0.82, 1));
  }
  return b.build();
}

export function pineMesh(seed: number, lod: 0 | 1): BufferGeometry {
  const rng = new Rng(seed), b = new GeoBuilder();
  const tiers = lod ? 3 : 7, H = rng.range(7.4, 9.4);
  b.add(new CylinderGeometry(0.14, 0.32, H * 0.5, lod ? 5 : 7, 1), 0x463a2e, xform(0, H * 0.25, 0));
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1 || 1);
    const r = (2.35 - f * 1.7) * rng.range(0.92, 1.08), h = (lod ? 3.6 : 2.5) - f * 0.7;
    const y = 1.5 + f * (H - 3.0);
    const g = new CylinderGeometry(0.03, r, h, lod ? 7 : 11, 1, false);
    g.deleteAttribute('uv');
    const p = g.getAttribute('position');
    for (let k = 0; k < p.count; k++) {
      if (p.getY(k) < 0) { // jagged, drooping rim
        const x = p.getX(k), z = p.getZ(k), ang = Math.atan2(z, x);
        const jag = 0.78 + noise2(ang * 2.2 + seed * 3 + i * 5, i * 1.7) * 0.5;
        p.setXYZ(k, x * jag, p.getY(k) - 0.18 * r * jag, z * jag);
      }
    }
    g.computeVertexNormals();
    b.add(g, (x, py, z) => {
      const t = clamp01((py - (y - h / 2)) / h);
      const c = lerpC(0x113b2d, 0x3f8f58, t * 0.8 + (noise2(x * 2.3, z * 2.3 + py) - 0.5) * 0.3);
      return c.multiplyScalar(0.58 + 0.42 * clamp01(0.3 + f * 0.5 + Math.hypot(x, z) / 3.4 * 0.4));
    }, xform(0, y + h / 2, 0, 1, 1, 1, rng.range(0, 6.28)));
  }
  return b.build();
}

export function rockMesh(seed: number, lod: 0 | 1): BufferGeometry {
  const g = lobe(1, seed, lod ? 1 : 2, 1.05);
  const b = new GeoBuilder();
  b.add(g, (x, y, z) => {
    const band = 0.86 + 0.14 * Math.sin(y * 9 + fbm2(x * 2, z * 2, 2) * 5);
    const c = lerpC(0x555a64, 0x9a9ca6, 0.5 + y * 0.28 + (fbm2(x * 3.1 + seed, z * 3.1, 3) - 0.5) * 0.6).multiplyScalar(band);
    const moss = smoothstep(0.1, 0.6, y) * clamp01(0.3 + (fbm2(x * 4 + 9, z * 4 - 2, 2) - 0.35) * 2.2);
    c.lerp(new Color(0x3f6a45), moss * 0.7);
    return c.multiplyScalar(0.7 + 0.3 * clamp01((y + 0.8) / 1.4));
  }, xform(0, 0.12, 0, 1, 0.74, 1));
  return b.build();
}

export function bushMesh(seed: number, lod: 0 | 1): BufferGeometry {
  const rng = new Rng(seed), b = new GeoBuilder();
  const n = lod ? 1 : 5;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, rad = i === 0 ? 0 : rng.range(0.35, 0.75), r = i === 0 ? (lod ? 1.0 : 0.85) : rng.range(0.4, 0.62);
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    b.add(lobe(r, seed * 13 + i, lod ? 0 : 1, 0.5), (px, py, pz) => leafColor(px, py, pz, 0, 0.55, 0, 1.0, 0x1b5532, 0x5aae5e), xform(x, r * 0.62, z, 1, 0.78, 1));
  }
  return b.build();
}

/** Curved blades of grass; double-sided material expected. */
export function grassMesh(seed: number): BufferGeometry {
  const rng = new Rng(seed);
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const a = rng.range(0, 6.28), off = rng.range(0, 0.22), bx = Math.cos(a) * off, bz = Math.sin(a) * off;
    const h = rng.range(0.45, 0.85), w = rng.range(0.05, 0.085), lean = rng.range(0.1, 0.4), dir = rng.range(0, 6.28);
    const dx = Math.cos(dir), dz = Math.sin(dir), px = -dz, pz = dx;
    const base = pos.length / 3;
    for (let k = 0; k <= 3; k++) {
      const t = k / 3, ww = w * (1 - t * 0.92), bend = lean * t * t * h;
      const cx = bx + dx * bend, cz = bz + dz * bend, cy = h * t;
      for (const s of [-1, 1]) {
        pos.push(cx + px * ww * s, cy, cz + pz * ww * s);
        const c = lerpC(0x1f5a34, 0x7cc46a, t * 0.9 + rng.range(-0.05, 0.1)).multiplyScalar(0.7 + 0.3 * t);
        col.push(c.r, c.g, c.b);
      }
      if (k < 3) { const a0 = base + k * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function flowerMesh(): BufferGeometry {
  const b = new GeoBuilder();
  b.add(new CylinderGeometry(0.012, 0.012, 0.38, 3, 1), 0x3f8a4a, xform(0, 0.19, 0));
  b.add(new IcosahedronGeometry(0.085, 0), 0xffffff, xform(0, 0.4, 0, 1, 0.6, 1));
  return b.build();
}

// ---------------------------------------------------------------------------------------------------------------- placement

export interface Placement { x: number; y: number; z: number; s: number; r: number; sy?: number; tint?: number }

export interface VegetationPlan {
  oaks: Placement[]; pines: Placement[]; bushes: Placement[]; rocks: Placement[]; tufts: Placement[]; flowers: Placement[];
}

const LEAF_TINTS = [0xffffff, 0xe6fbe8, 0xd2eed6, 0xffffff, 0xdcf5e0, 0xf0fff0, 0xc8e8d0];
const FLOWERS = [0xffffff, 0xffd34a, 0xff7aa8, 0xff8a3a, 0xc9a3ff, 0xfff0a0];

/** Groves of trees (not uniform noise), a sparse understory, rock outcrops on slopes and meadow flowers near the road. */
export function planVegetation(track: Track, terrain: Terrain, density: number, tufts: number): VegetationPlan {
  const rng = new Rng(9121), q = newQuery();
  const wall = track.wallOffset;
  const plan: VegetationPlan = { oaks: [], pines: [], bushes: [], rocks: [], tufts: [], flowers: [] };
  const slope = (x: number, z: number): number => Math.hypot(terrain.heightAt(x + 3, z) - terrain.heightAt(x - 3, z), terrain.heightAt(x, z + 3) - terrain.heightAt(x, z - 3)) / 6;
  const dist = (x: number, z: number): number => { const d = track.nearest(x, z, 170, q); return d < 0 ? 999 : d; };
  const forest = (x: number, z: number): number => smoothstep(0.5, 0.66, fbm2(x * 0.0065 + 31, z * 0.0065 - 9, 3));
  const meadow = (x: number, z: number): number => smoothstep(0.58, 0.74, fbm2(x * 0.021 + 5, z * 0.021 + 17, 3));
  const A = { x0: -720, x1: 800, z0: -740, z1: 340 };

  // trees: jittered grid so trunks never overlap, density follows the grove field and thins out next to the road
  const cell = 9;
  for (let gx = A.x0; gx < A.x1; gx += cell) for (let gz = A.z0; gz < A.z1; gz += cell) {
    const x = gx + rng.range(0, cell), z = gz + rng.range(0, cell);
    const h = terrain.heightAt(x, z);
    if (h < 1.7 || h > 40) continue;
    const f = forest(x, z), pr = (0.07 + f * 0.9) * density;
    if (rng.next() > pr) continue;
    const d = dist(x, z); if (d < wall + 6) continue;
    const road = smoothstep(wall + 6, wall + 24, d);
    if (rng.next() > road) continue;
    const sl = slope(x, z); if (sl > 0.62) continue;
    const pineBias = smoothstep(9, 22, h + (fbm2(x * 0.02, z * 0.02, 2) - 0.5) * 10);
    const it: Placement = { x, y: h - 0.12, z, s: rng.range(0.85, 1.55) * (0.85 + f * 0.25), r: rng.range(0, 6.28), tint: rng.pick(LEAF_TINTS) };
    (rng.next() < pineBias ? plan.pines : plan.oaks).push(it);
  }

  // understory + roadside shrubs
  for (let gx = A.x0; gx < A.x1; gx += 6) for (let gz = A.z0; gz < A.z1; gz += 6) {
    const x = gx + rng.range(0, 6), z = gz + rng.range(0, 6);
    const h = terrain.heightAt(x, z); if (h < 1.5 || h > 34) continue;
    const f = forest(x, z), edge = f > 0.05 && f < 0.95 ? 0.35 : 0;
    if (rng.next() > (0.04 + f * 0.3 + edge * 0.2) * density) continue;
    const d = dist(x, z); if (d < wall + 3.5) continue;
    plan.bushes.push({ x, y: h - 0.1, z, s: rng.range(0.7, 1.7), r: rng.range(0, 6.28), sy: rng.range(0.8, 1.2), tint: rng.pick(LEAF_TINTS) });
  }
  for (let s = 0; s < track.length; s += 9 / Math.max(0.5, density)) {
    const side = rng.sign(), p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
    track.pointAt(s + rng.range(0, 6), side * (wall + rng.range(3.2, 12)), p);
    const h = terrain.heightAt(p.x, p.z); if (h < 0.4) continue;
    plan.bushes.push({ x: p.x, y: h - 0.1, z: p.z, s: rng.range(0.7, 1.5), r: rng.range(0, 6.28), tint: rng.pick(LEAF_TINTS) });
  }

  // rock outcrops: clusters on steep ground and along the road cuttings, plus shoreline boulders
  const outcrops = Math.round(120 * density);
  for (let t = 0, got = 0; got < outcrops && t < outcrops * 120; t++) {
    const x = rng.range(A.x0, A.x1), z = rng.range(A.z0, A.z1), h = terrain.heightAt(x, z);
    const shore = h > -0.8 && h < 1.6 && rng.next() < 0.35;
    if (!shore && slope(x, z) < 0.42) continue;
    if (dist(x, z) < wall + 5) continue;
    got++;
    const n = rng.int(3, 7), base = rng.range(1.0, 2.8);
    for (let k = 0; k < n; k++) {
      const rx = x + rng.range(-4, 4), rz = z + rng.range(-4, 4), s = base * rng.range(0.35, 1.2);
      plan.rocks.push({ x: rx, y: terrain.heightAt(rx, rz) - s * 0.25, z: rz, s, sy: rng.range(0.7, 1.25), r: rng.range(0, 6.28) });
    }
  }
  for (let s = 0; s < track.length; s += 38 / Math.max(0.5, density)) {
    const side = rng.sign(), p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
    track.pointAt(s + rng.range(0, 20), side * (wall + rng.range(4, 14)), p);
    if (terrain.heightAt(p.x, p.z) < 0.6) continue;
    const s0 = rng.range(0.6, 1.5);
    plan.rocks.push({ x: p.x, y: terrain.heightAt(p.x, p.z) - s0 * 0.25, z: p.z, s: s0, sy: rng.range(0.7, 1.2), r: rng.range(0, 6.28) });
  }

  // grass and flowers hugging the road, where the eye reads speed
  const nTufts = Math.round(7500 * tufts);
  for (let i = 0; i < nTufts; i++) {
    const s = rng.range(0, track.length), side = rng.sign(), p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
    track.pointAt(s, side * (wall + rng.range(1.2, 38)), p);
    const h = terrain.heightAt(p.x, p.z); if (h < 1.5) continue;
    plan.tufts.push({ x: p.x, y: h - 0.03, z: p.z, s: rng.range(0.8, 2.0), r: rng.range(0, 6.28), tint: rng.pick(LEAF_TINTS) });
  }
  const nFlowers = Math.round(4200 * tufts);
  for (let i = 0; i < nFlowers; i++) {
    const s = rng.range(0, track.length), side = rng.sign(), p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
    track.pointAt(s, side * (wall + rng.range(2, 40)), p);
    const h = terrain.heightAt(p.x, p.z); if (h < 2 || meadow(p.x, p.z) < rng.next()) continue;
    plan.flowers.push({ x: p.x, y: h - 0.02, z: p.z, s: rng.range(0.8, 1.5), r: 0, tint: rng.pick(FLOWERS) });
  }
  return plan;
}

// ---------------------------------------------------------------------------------------------------------------- chunked instancing

const tmpM = new Matrix4(), tmpQ = new Quaternion(), tmpP = new Vector3(), tmpS = new Vector3(), tmpC = new Color(), UP = new Vector3(0, 1, 0);

interface Chunk { cx: number; cz: number; radius: number; hi: InstancedMesh; lo: InstancedMesh | null }
export interface ChunkOpts { cell?: number; hiRange: number; cullRange?: number; shadow?: boolean; tint?: boolean }

/**
 * Splits instances into spatial chunks. Each chunk is frustum-culled by three.js; near chunks draw the detailed mesh and
 * far chunks the cheap one (sharing one instance buffer), and chunks beyond `cullRange` are skipped entirely.
 */
export class ChunkedInstances {
  readonly group = new Group();
  private readonly chunks: Chunk[] = [];
  constructor(items: readonly Placement[], hiGeo: BufferGeometry, loGeo: BufferGeometry | null, mat: Material, private readonly o: ChunkOpts) {
    const cell = o.cell ?? 110, map = new Map<string, Placement[]>();
    for (const it of items) { const k = `${Math.floor(it.x / cell)},${Math.floor(it.z / cell)}`; let a = map.get(k); if (!a) map.set(k, a = []); a.push(it); }
    for (const list of map.values()) {
      let sx = 0, sz = 0; for (const it of list) { sx += it.x; sz += it.z; }
      const cx = sx / list.length, cz = sz / list.length;
      let radius = 0; for (const it of list) radius = Math.max(radius, Math.hypot(it.x - cx, it.z - cz));
      const hi = new InstancedMesh(hiGeo, mat, list.length);
      list.forEach((it, i) => {
        tmpQ.setFromAxisAngle(UP, it.r); tmpP.set(it.x, it.y, it.z); tmpS.set(it.s, it.s * (it.sy ?? 1), it.s);
        tmpM.compose(tmpP, tmpQ, tmpS); hi.setMatrixAt(i, tmpM);
        if (o.tint) hi.setColorAt(i, tmpC.setHex(it.tint ?? 0xffffff));
      });
      hi.instanceMatrix.needsUpdate = true; if (hi.instanceColor) hi.instanceColor.needsUpdate = true;
      hi.castShadow = !!o.shadow; hi.receiveShadow = true; hi.computeBoundingSphere();
      this.group.add(hi);
      let lo: InstancedMesh | null = null;
      if (loGeo) {
        lo = new InstancedMesh(loGeo, mat, list.length);
        lo.instanceMatrix = hi.instanceMatrix; if (hi.instanceColor) lo.instanceColor = hi.instanceColor;
        lo.count = list.length; lo.castShadow = false; lo.receiveShadow = true; lo.boundingSphere = hi.boundingSphere?.clone() ?? null;
        lo.visible = false; this.group.add(lo);
      }
      this.chunks.push({ cx, cz, radius: radius + 6, hi, lo });
    }
  }
  get instanceCount(): number { return this.chunks.reduce((n, c) => n + c.hi.count, 0); }
  update(cam: Vector3): void {
    const { hiRange, cullRange } = this.o;
    for (const c of this.chunks) {
      const d = Math.hypot(c.cx - cam.x, c.cz - cam.z) - c.radius;
      if (c.lo) { const near = d < hiRange; c.hi.visible = near; c.lo.visible = !near && (cullRange === undefined || d < cullRange); }
      else c.hi.visible = d < (cullRange ?? hiRange);
    }
  }
  dispose(): void { for (const c of this.chunks) { c.hi.dispose(); c.lo?.dispose(); } this.group.removeFromParent(); }
}
