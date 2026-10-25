import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Vector3, type Material,
} from 'three';
import { Rng } from '../sim/rng';
import { newQuery, type Track } from '../sim/Track';
import { TIERS, type Tier } from './quality';
import { barrelGeometry, coneGeometry, lampGeometry, palmGeometry, tyreStackGeometry, umbrellaGeometry, villaGeometry } from './propGeo';
import { ChunkedInstances, bushMesh, broadleafMesh, flowerMesh, grassMesh, pineMesh, planVegetation, rockMesh, type ChunkOpts, type Placement } from './vegetation';
import type { Terrain } from './terrain';
import type { Obstacle } from '../sim/ai';

interface Item { x: number; y: number; z: number; s: number; r: number; sy?: number; sx?: number; tint?: number }

/** Adds a wind sway to an instanced vertex-coloured material (height-weighted so trunks stay planted). */
function withSway(mat: MeshStandardMaterial, time: { value: number }, strength: number): void {
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sw = max(position.y - 1.0, 0.0);
        float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.11;
        transformed.x += sin(uTime * 1.6 + ph) * sw * ${strength.toFixed(4)};
        transformed.z += cos(uTime * 1.25 + ph * 1.3) * sw * ${(strength * 0.8).toFixed(4)};`);
  };
  mat.customProgramCacheKey = () => `sway${strength}`;
}

const tmpM = new Matrix4(), tmpQ = new Quaternion(), tmpP = new Vector3(), tmpS = new Vector3(), tmpC = new Color(), UP = new Vector3(0, 1, 0);

function instanced(geo: BufferGeometry, mat: Material, items: Item[], opts: { shadow?: boolean; tint?: boolean } = {}): InstancedMesh {
  const m = new InstancedMesh(geo, mat, Math.max(1, items.length));
  m.count = items.length;
  items.forEach((it, i) => {
    tmpQ.setFromAxisAngle(UP, it.r);
    tmpP.set(it.x, it.y, it.z); tmpS.set((it.sx ?? 1) * it.s, (it.sy ?? 1) * it.s, (it.sx ?? 1) * it.s);
    tmpM.compose(tmpP, tmpQ, tmpS); m.setMatrixAt(i, tmpM);
    if (opts.tint) { tmpC.setHex(it.tint ?? 0xffffff); m.setColorAt(i, tmpC); }
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = opts.shadow ?? false; m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

/** Dynamic traffic cones and barrels driven by the simulation's obstacle list. */
export class Obstacles {
  readonly group = new Group();
  private readonly cones: InstancedMesh; private readonly barrels: InstancedMesh;
  private readonly coneIdx: number[] = []; private readonly barrelIdx: number[] = [];
  private readonly list: readonly Obstacle[];
  private readonly geos: BufferGeometry[] = [];
  private readonly mats: Material[] = [];
  constructor(list: readonly Obstacle[]) {
    this.list = list;
    list.forEach((o, i) => (o.kind === 'cone' ? this.coneIdx : this.barrelIdx).push(i));
    const cg = coneGeometry(), bg = barrelGeometry();
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
    this.geos.push(cg, bg); this.mats.push(mat);
    this.cones = new InstancedMesh(cg, mat, Math.max(1, this.coneIdx.length)); this.barrels = new InstancedMesh(bg, mat, Math.max(1, this.barrelIdx.length));
    this.cones.count = this.coneIdx.length; this.barrels.count = this.barrelIdx.length;
    for (const m of [this.cones, this.barrels]) { m.castShadow = true; m.frustumCulled = false; this.group.add(m); }
    this.update(0);
  }
  update(_t: number): void {
    const e = new Object3D();
    this.coneIdx.forEach((li, i) => {
      const o = this.list[li];
      if (!o.hit) { e.position.set(o.x, o.y, o.z); e.rotation.set(0, 0, 0); }
      else {
        const t = Math.min(o.age, 1.6);
        const hop = Math.max(0, 2.6 * t - 4.9 * t * t);
        e.position.set(o.x, o.y + hop, o.z);
        e.rotation.set(Math.min(Math.PI / 2, t * (o.spin * 0.6 + 4)), Math.atan2(o.kx, o.kz), 0, 'YXZ');
        if (o.age > 0.5) e.position.y = o.y + 0.22;
      }
      e.scale.setScalar(1); e.updateMatrix(); this.cones.setMatrixAt(i, e.matrix);
    });
    this.barrelIdx.forEach((li, i) => { const o = this.list[li]; e.position.set(o.x, o.y, o.z); e.rotation.set(0, li * 1.3, 0); e.updateMatrix(); this.barrels.setMatrixAt(i, e.matrix); });
    this.cones.instanceMatrix.needsUpdate = true; this.barrels.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.geos.forEach(g => g.dispose()); this.mats.forEach(m => m.dispose()); this.cones.dispose(); this.barrels.dispose(); this.group.removeFromParent(); }
}

/** Where the lighthouse / landmarks go, found by searching the finished terrain rather than hard-coding a spot. */
export function findHeadland(track: Track, terrain: Terrain): { x: number; z: number; y: number } {
  const q = newQuery(); let best = { x: 600, z: -60, y: 8 }, bestScore = -Infinity;
  for (let x = 380; x < 760; x += 10) for (let z = -320; z < 220; z += 10) {
    const h = terrain.heightAt(x, z);
    if (h < 5 || h > 22) continue;
    const d = track.nearest(x, z, 160, q); if (d < 0 || d < 70) continue;
    const coast = terrain.heightAt(x + 90, z) < 0 || terrain.heightAt(x, z + 90) < 0 || terrain.heightAt(x + 60, z + 60) < 0;
    const score = x * 0.6 - Math.abs(z + 40) * 0.5 + (coast ? 60 : 0) - d * 0.1;
    if (score > bestScore) { bestScore = score; best = { x, z, y: h }; }
  }
  return best;
}

export class Scenery {
  readonly group = new Group();
  readonly time = { value: 0 };
  private readonly disposables: { dispose(): void }[] = [];
  private readonly boats: { m: Object3D; base: Vector3; phase: number }[] = [];
  private readonly chunked: ChunkedInstances[] = [];
  private readonly keep = <T extends { dispose(): void }>(x: T): T => { this.disposables.push(x); return x; };

  constructor(readonly track: Track, readonly terrain: Terrain, tier: Tier) {
    const T = TIERS[tier];
    const rng = new Rng(2024);
    const q = newQuery();
    const wall = track.wallOffset;
    const place = (count: number, test: (x: number, z: number, h: number, d: number) => boolean, area: [number, number, number, number], mk: (x: number, y: number, z: number) => Item, maxTry = 80): Item[] => {
      const out: Item[] = [];
      for (let t = 0; out.length < count && t < count * maxTry; t++) {
        const x = rng.range(area[0], area[1]), z = rng.range(area[2], area[3]);
        const d = track.nearest(x, z, 400, q); const dist = d < 0 ? 999 : d;
        const h = terrain.heightAt(x, z);
        if (dist < wall + 5 || !test(x, z, h, dist)) continue;
        out.push(mk(x, h - 0.05, z));
      }
      return out;
    };
    const area: [number, number, number, number] = [-720, 800, -740, 340];
    const slopeAt = (x: number, z: number): number => Math.hypot(terrain.heightAt(x + 3, z) - terrain.heightAt(x - 3, z), terrain.heightAt(x, z + 3) - terrain.heightAt(x, z - 3)) / 6;
    const sc = (a: number, b: number): number => rng.range(a, b);

    // ---------- palms: beaches and coast, plus avenues lining the start straight
    const palmMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: DoubleSide }));
    withSway(palmMat, this.time, 0.012);
    const palms = place(Math.round(260 * T.scenery), (_x, _z, h) => h > 0.7 && h < 7, area, (x, y, z) => ({ x, y, z, s: sc(0.85, 1.35), r: rng.range(0, 6.28) }));
    for (let s = -60; s < 420; s += 24) for (const side of [-1, 1]) {
      if (side === -1 && s % 48 !== 0) continue;
      const p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 }; track.pointAt(s, side * (wall + 6), p);
      palms.push({ x: p.x, y: p.y - 0.8, z: p.z, s: sc(1.1, 1.4), r: rng.range(0, 6.28) });
    }
    const palmMesh = instanced(this.keep(palmGeometry(3)), palmMat, palms, { shadow: tier !== 'low' });
    this.group.add(palmMesh);

    // ---------- groves, understory, rock outcrops and meadow: planned as clusters, then chunked with distance LOD
    const plan = planVegetation(track, terrain, T.scenery, T.tufts);
    const leafMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
    withSway(leafMat, this.time, 0.006);
    const bushMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    const rockMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true }));
    const tuftMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide }));
    const flowerMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    const addChunks = (items: Placement[], hi: BufferGeometry, lo: BufferGeometry | null, mat: Material, o: ChunkOpts): void => {
      if (!items.length) return;
      const c = new ChunkedInstances(items, this.keep(hi), lo ? this.keep(lo) : null, mat, o); this.chunked.push(c); this.group.add(c.group);
    };
    const shadow = tier !== 'low';
    for (const [seed, k] of [[11, 0], [23, 1], [37, 2]] as const) {
      addChunks(plan.oaks.filter((_, i) => i % 3 === k), broadleafMesh(seed, 0), broadleafMesh(seed, 1), leafMat, { hiRange: 150, cullRange: 2600, shadow, tint: true });
      addChunks(plan.pines.filter((_, i) => i % 3 === k), pineMesh(seed, 0), pineMesh(seed, 1), leafMat, { hiRange: 150, cullRange: 2600, shadow, tint: true });
    }
    addChunks(plan.bushes, bushMesh(5, 0), bushMesh(5, 1), bushMat, { hiRange: 90, cullRange: 1400, tint: true });
    for (const [seed, k] of [[3, 0], [8, 1]] as const) addChunks(plan.rocks.filter((_, i) => i % 2 === k), rockMesh(seed, 0), rockMesh(seed, 1), rockMat, { hiRange: 120, cullRange: 1800, shadow });
    addChunks(plan.tufts, grassMesh(5), null, tuftMat, { cell: 70, hiRange: 120, tint: true });
    addChunks(plan.flowers, flowerMesh(), null, flowerMat, { cell: 70, hiRange: 95, tint: true });

    // ---------- villas on the hillsides, umbrellas on the sand
    const villas = place(Math.round(16 * Math.max(0.5, T.scenery)), (x, z, h, d) => h > 4 && h < 20 && slopeAt(x, z) < 0.18 && d > 40 && d < 240, area, (x, y, z) => ({ x, y: y - 0.2, z, s: sc(0.9, 1.2), r: rng.pick([0, 1.57, 3.14, 4.71]) + rng.range(-0.3, 0.3) }), 400);
    const villaMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    this.group.add(instanced(this.keep(villaGeometry()), villaMat, villas, { shadow: true }));
    const umbrellas = place(Math.round(26 * Math.max(0.4, T.scenery)), (_x, _z, h, d) => h > 0.9 && h < 1.9 && d > 24, area, (x, y, z) => ({ x, y, z, s: sc(0.9, 1.2), r: rng.range(0, 6.28) }), 600);
    const umbMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: DoubleSide }));
    this.group.add(instanced(this.keep(umbrellaGeometry()), umbMat, umbrellas, { shadow: false }));

    // ---------- tyre walls on the outside of tight corners
    const tyres: Item[] = [];
    for (let s = 0; s < track.length; s += 2.2) {
      const i = Math.round(s / track.spacing) % track.n; const k = track.curvature[i];
      if (Math.abs(k) < 0.0105) continue;
      const side = k > 0 ? 1 : -1; // outside of a left turn is the right-hand side
      const p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 }; track.pointAt(s, side * (wall - 0.4 - 0.55), p);
      tyres.push({ x: p.x, y: p.y, z: p.z, s: 1, r: s, tint: Math.floor(s / 6.6) % 2 ? 0xffffff : 0xff5a3c });
    }
    const tyreMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    this.group.add(instanced(this.keep(tyreStackGeometry()), tyreMat, tyres, { shadow: true, tint: true }));

    // ---------- lamp posts along the start straight and the long coastal run; glowing bulbs for the bloom pass
    const lamps: Item[] = [];
    for (let s = -120; s < 520; s += 40) lamps.push(this.lampAt(s, 1));
    for (let s = 1180; s < 1500; s += 40) lamps.push(this.lampAt(s, -1));
    const lampMat = this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
    this.group.add(instanced(this.keep(lampGeometry()), lampMat, lamps, { shadow: false }));
    const bulbGeo = this.keep(new BoxGeometry(0.55, 0.14, 0.38)); const bulbMat = this.keep(new MeshBasicMaterial({ color: new Color(1, 0.82, 0.5).multiplyScalar(2.6) }));
    const bulbs = new InstancedMesh(bulbGeo, bulbMat, lamps.length);
    lamps.forEach((l, i) => {
      tmpQ.setFromAxisAngle(UP, l.r); tmpP.set(0, 6.3, 1.35); tmpP.applyQuaternion(tmpQ).add(new Vector3(l.x, l.y, l.z));
      tmpM.compose(tmpP, tmpQ, tmpS.set(1, 1, 1)); bulbs.setMatrixAt(i, tmpM);
    });
    this.group.add(bulbs);

    // ---------- sailboats and distant islands for depth
    const hullMat = this.keep(new MeshStandardMaterial({ color: 0xf6efe2, roughness: 0.6 })), sailMat = this.keep(new MeshStandardMaterial({ color: 0xfff3dc, roughness: 0.9, side: DoubleSide }));
    for (let i = 0; i < 7; i++) {
      const ang = rng.range(0, Math.PI * 2);
      let x = 0, z = 0, tries = 0;
      do { const r = rng.range(60, 520); x = 50 + Math.cos(ang) * (560 + r); z = -185 + Math.sin(ang) * (420 + r); tries++; } while (terrain.heightAt(x, z) > -3 && tries < 40);
      const boat = new Group();
      const hull = new Mesh(this.keep(new BoxGeometry(1.6, 0.7, 5)), hullMat); hull.position.y = 0.2; hull.castShadow = true;
      const sail = new Mesh(this.keep(new BoxGeometry(0.05, 6, 3.2)), sailMat); sail.position.set(0, 3.5, -0.4); sail.castShadow = true;
      const sail2 = new Mesh(this.keep(new BoxGeometry(0.05, 4, 1.8)), new MeshStandardMaterial({ color: [0xff6a4a, 0xffc23a, 0x35b6ff][i % 3], roughness: 0.9, side: DoubleSide })); sail2.position.set(0, 2.9, 1.7);
      boat.add(hull, sail, sail2); boat.position.set(x, 0, z); boat.rotation.y = rng.range(0, 6.28);
      this.boats.push({ m: boat, base: boat.position.clone(), phase: rng.range(0, 6) }); this.group.add(boat);
    }
  }

  private lampAt(s: number, side: number): Item {
    const p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 }; this.track.pointAt(s, side * (this.track.wallOffset + 3.2), p);
    // arm points back over the road: rotate so +z of the lamp faces the road
    const toRoad = Math.atan2(-(-p.tz * side), -(p.tx * side));
    return { x: p.x, y: p.y - 0.8, z: p.z, s: 1, r: toRoad, sy: side };
  }

  update(time: number, cam?: Vector3): void {
    this.time.value = time;
    if (cam) for (const c of this.chunked) c.update(cam);
    for (const b of this.boats) { b.m.position.y = Math.sin(time * 0.9 + b.phase) * 0.25; b.m.rotation.z = Math.sin(time * 0.7 + b.phase) * 0.05; b.m.rotation.x = Math.cos(time * 0.6 + b.phase) * 0.03; }
  }

  dispose(): void { this.chunked.forEach(c => c.dispose()); this.disposables.forEach(d => d.dispose()); this.group.removeFromParent(); }
}

