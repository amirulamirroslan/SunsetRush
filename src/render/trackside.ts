import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3, CylinderGeometry,
} from 'three';
import type { Track } from '../sim/Track';
import { Rng } from '../sim/rng';
import { GeoBuilder, xform } from './propGeo';
import { makeBanner, makeBrakeBoards } from './textures';
import type { Terrain } from './terrain';

type Pt = { x: number; y: number; z: number; heading: number; tx: number; tz: number };
const pt = (): Pt => ({ x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 });
const UP = new Vector3(0, 1, 0);

/** Stretches of at least `len` metres whose curvature never exceeds `maxK`, found by scanning the lap. Returns the centre distances. */
export function findStraights(track: Track, len: number, maxK: number, avoid: readonly [number, number][]): number[] {
  const out: number[] = [];
  const half = Math.round(len / 2 / track.spacing);
  for (let s = 0; s < track.length; s += 6) {
    if (avoid.some(([a, b]) => s > a && s < b)) continue;
    const i = Math.round(s / track.spacing);
    let ok = true;
    for (let o = -half; o <= half && ok; o++) if (Math.abs(track.curvature[track.wrap(i + o)]) > maxK) ok = false;
    if (ok) out.push(s);
  }
  return out;
}

/** Local maxima of |curvature| that are tight enough to deserve braking boards and a marshal post. */
export function findCorners(track: Track, minK: number, minGap: number): { s: number; side: 1 | -1; k: number }[] {
  const raw: { s: number; side: 1 | -1; k: number }[] = [];
  for (let i = 0; i < track.n; i++) {
    const k = Math.abs(track.curvature[i]);
    if (k < minK) continue;
    let peak = true; for (let o = -12; o <= 12; o++) if (Math.abs(track.curvature[track.wrap(i + o)]) > k) { peak = false; break; }
    if (peak) raw.push({ s: i * track.spacing, side: track.curvature[i] > 0 ? 1 : -1, k });
  }
  const out: typeof raw = [];
  for (const c of raw.sort((a, b) => b.k - a.k)) if (out.every(o => Math.min(Math.abs(o.s - c.s), track.length - Math.abs(o.s - c.s)) > minGap)) out.push(c);
  return out.sort((a, b) => a.s - b.s);
}

/**
 * Engineered trackside furniture that gives the circuit composition at speed: an overpass that frames the road ahead,
 * braking-distance boards before the tight corners and marshal posts on their outside. All instanced / merged: a handful of draw calls.
 */
export function buildTrackside(track: Track, terrain: Terrain, keep: <T extends { dispose(): void }>(x: T) => T): Group {
  const group = new Group();
  const wall = track.wallOffset, rng = new Rng(311);
  const concrete = keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 }));

  // ------------------------------------------------------------------ overpasses on two straights, away from the start area and the Sun Gate
  // preferred sites: the end of the start straight (frames the first corner) and the coastal run; each snaps to the calmest nearby stretch
  const spots = findStraights(track, 60, 0.0042, [[-80, 300], [680, 770]]);
  const picked: number[] = [];
  for (const target of [345, 1545]) {
    const near = spots.filter(s => Math.abs(s - target) < 140).sort((x, y) => Math.abs(x - target) - Math.abs(y - target));
    if (near.length) picked.push(near[0]);
  }
  const span = wall + 3.4, deckY = 8.2;
  const bb = new GeoBuilder();
  const shade = (base: number, bottom = 0.62): ((x: number, y: number, z: number) => Color) => (_x, y) => new Color(base).multiplyScalar(bottom + (1 - bottom) * Math.min(1, Math.max(0, (y + 3) / 12)));
  // deck with thicker haunches over the piers, parapets, and a light-coloured fascia
  bb.add(new BoxGeometry(span * 2 + 3.4, 0.9, 5.2), shade(0xcfc8bc, 0.9), xform(0, deckY, 0));
  for (const s of [-1, 1]) {
    bb.add(new BoxGeometry(8, 0.9, 4.6), shade(0xb9b2a6, 0.8), xform(s * (span - 3.2), deckY - 0.85, 0, 1, 1, 1, 0, 0, s * 0.045));
    bb.add(new BoxGeometry(span * 2 + 3.4, 1.25, 0.28), 0xe6dfd2, xform(0, deckY + 1.05, 2.5));
    bb.add(new BoxGeometry(span * 2 + 3.4, 1.25, 0.28), 0xe6dfd2, xform(0, deckY + 1.05, -2.5));
  }
  bb.add(new BoxGeometry(span * 2 + 3.6, 0.3, 5.6), 0x3b3f4d, xform(0, deckY - 0.55, 0));
  // twin piers per side, each with a wide footing
  for (const s of [-1, 1]) for (const z of [-1.7, 1.7]) {
    bb.add(new BoxGeometry(1.5, 12.5, 1.2), shade(0xc9c1b4), xform(s * (span - 0.5), deckY - 6.5, z));
    bb.add(new BoxGeometry(2.3, 1.6, 2.0), shade(0xb3ab9f, 0.8), xform(s * (span - 0.5), 0.2 - 1.2, z));
  }
  // lamp-style handrail uprights along the parapet tops
  for (let x = -span - 1.2; x <= span + 1.3; x += 2.4) for (const z of [-2.5, 2.5]) bb.add(new BoxGeometry(0.1, 1.0, 0.1), 0x2a2d3a, xform(x, deckY + 2.1, z));
  const bridgeGeo = keep(bb.build());
  const bannerMats = keep(new MeshBasicMaterial({ map: keep(makeBanner({ text: 'ISLE AIR', sub: 'FLY THE COVE', bg: ['#f4efe6', '#d8e6f0'], fg: '#1b2a6b', accent: '#2b6bff' }, 1024, 128)), toneMapped: false, side: DoubleSide }));
  const bannerGeo = keep(new PlaneGeometry(span * 2 - 2, 1.0));
  for (const s of picked) {
    const p = pt(); track.pointAt(s, 0, p);
    const g = new Group(); g.position.set(p.x, p.y - 0.4, p.z); g.rotation.y = p.heading;
    const m = new Mesh(bridgeGeo, concrete); m.castShadow = true; m.receiveShadow = true; g.add(m);
    const b = new Mesh(bannerGeo, bannerMats); b.position.set(0, deckY + 0.95, -2.68); b.rotation.y = Math.PI; g.add(b);
    group.add(g);
  }

  // ------------------------------------------------------------------ braking boards (3, 2, 1 bars) on the approach to the tightest corners
  const corners = findCorners(track, 0.011, 160);
  const boardTex = keep(makeBrakeBoards());
  const boardMat = keep(new MeshStandardMaterial({ map: boardTex, roughness: 0.6, side: DoubleSide }));
  const boardCells: BufferGeometry[] = [1, 2, 3].map(n => {
    const g = keep(new PlaneGeometry(1.15, 2.3));
    const uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setX(i, ((n - 1) + uv.getX(i)) / 3);
    g.translate(0, 2.35, 0); return g;
  });
  const postGeo = keep(new CylinderGeometry(0.05, 0.05, 2.6, 6)); postGeo.translate(0, 1.3, 0);
  const postMat = keep(new MeshStandardMaterial({ color: 0x33363f, roughness: 0.6, metalness: 0.4 }));
  const boardItems: Matrix4[][] = [[], [], []];
  const q = new Quaternion(), sc = new Vector3(1, 1, 1);
  const marshals: Matrix4[] = [];
  const tmp = pt();
  for (const c of corners) {
    const outside = c.side; // outside of a left turn is the right-hand side
    for (let b = 0; b < 3; b++) {
      const s = track.wrapS(c.s - 175 + b * 50 - 20);
      track.pointAt(s, outside * (wall + 1.6), tmp);
      // faces the oncoming driver: normal pointing back along the track
      q.setFromAxisAngle(UP, Math.atan2(-tmp.tx, -tmp.tz));
      boardItems[2 - b].push(new Matrix4().compose(new Vector3(tmp.x, Math.max(terrain.heightAt(tmp.x, tmp.z), tmp.y - 0.9), tmp.z), q, sc));
    }
    const s = track.wrapS(c.s + 18); track.pointAt(s, outside * (wall + 3.0), tmp);
    q.setFromAxisAngle(UP, outside === 1 ? Math.atan2(tmp.tz, -tmp.tx) : Math.atan2(-tmp.tz, tmp.tx)); // window faces the road
    marshals.push(new Matrix4().compose(new Vector3(tmp.x, Math.max(terrain.heightAt(tmp.x, tmp.z), tmp.y - 0.9), tmp.z), q, sc));
  }
  boardItems.forEach((list, k) => {
    if (!list.length) return;
    const bm = new InstancedMesh(boardCells[k], boardMat, list.length), pm = new InstancedMesh(postGeo, postMat, list.length);
    list.forEach((m, i) => { bm.setMatrixAt(i, m); pm.setMatrixAt(i, m); });
    bm.castShadow = true; bm.frustumCulled = false; pm.frustumCulled = false; group.add(bm, pm); keep({ dispose: () => { bm.dispose(); pm.dispose(); } });
  });

  // ------------------------------------------------------------------ marshal posts: hut, roof, flag pole
  if (marshals.length) {
    const mb = new GeoBuilder();
    mb.add(new BoxGeometry(2.4, 2.3, 2.0), 0xf0ebe0, xform(0, 1.15, 0));
    mb.add(new BoxGeometry(2.9, 0.18, 2.5), 0xe8662c, xform(0, 2.4, 0.15));
    mb.add(new BoxGeometry(1.5, 0.9, 0.06), 0x24303e, xform(0, 1.45, 1.03));          // window facing the road
    mb.add(new BoxGeometry(0.06, 3.6, 0.06), 0x2a2d3a, xform(1.5, 1.8, -0.6));
    mb.add(new BoxGeometry(0.8, 0.5, 0.04), 0xffc23a, xform(1.9, 3.35, -0.6));
    const marshalGeo = keep(mb.build());
    const mm = new InstancedMesh(marshalGeo, concrete, marshals.length);
    marshals.forEach((m, i) => mm.setMatrixAt(i, m));
    mm.castShadow = true; mm.receiveShadow = true; mm.frustumCulled = false; group.add(mm); keep({ dispose: () => mm.dispose() });
  }
  void rng;
  return group;
}
