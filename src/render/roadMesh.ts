import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, CylinderGeometry, InstancedMesh, Matrix4, SRGBColorSpace, Vector2, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm2 } from '../sim/noise';
import { BARRIER_FACE } from '../sim/carPhysics';
import type { Track } from '../sim/Track';
import type { AsphaltPbr } from './pbr';
import { makeAsphalt, makeRoadMarkings, makeRoadWear, makeBarrier, makeChecker, makeChevron, makeKerb, makeShoulder } from './textures';

export interface RoadMeshes {
  group: Group;
  pads: Mesh[];
  update(time: number): void;
  dispose(): void;
}

interface RibbonOpts {
  latA: number; latB: number; yOff: number; vScale: number; uRepeat?: number; s0?: number; s1?: number; colorNoise?: number; worldUv?: boolean; worldScale?: number;
}

/** A strip along the circuit between two lateral offsets. Rows are spaced at the track sample spacing; closed loops wrap. */
function ribbon(track: Track, o: RibbonOpts): BufferGeometry {
  const n = track.n;
  const s0 = o.s0 ?? 0, s1 = o.s1 ?? track.length;
  const closed = o.s0 === undefined && o.s1 === undefined;
  const rows = closed ? n + 1 : Math.max(2, Math.ceil((s1 - s0) / track.spacing) + 1);
  const pos = new Float32Array(rows * 2 * 3), nor = new Float32Array(rows * 2 * 3), uv = new Float32Array(rows * 2 * 2), col = new Float32Array(rows * 2 * 3);
  const p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
  const pn = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
  for (let r = 0; r < rows; r++) {
    const s = closed ? r * track.spacing : s0 + ((s1 - s0) * r) / (rows - 1);
    track.pointAt(s, 0, p); track.pointAt(s + 0.5, 0, pn);
    const slope = (pn.y - p.y) / 0.5;
    // surface normal for a laterally flat road that climbs along the tangent
    const nl = Math.hypot(slope, 1);
    const nxv = -p.tx * slope / nl, nyv = 1 / nl, nzv = -p.tz * slope / nl;
    const tone = o.colorNoise ? 1 + (fbm2(s * 0.012, 3.1, 3) - 0.5) * o.colorNoise : 1;
    for (let side = 0; side < 2; side++) {
      const lat = side === 0 ? o.latA : o.latB;
      const k = (r * 2 + side);
      pos[k * 3] = p.x - p.tz * lat; pos[k * 3 + 1] = p.y + o.yOff; pos[k * 3 + 2] = p.z + p.tx * lat;
      nor[k * 3] = nxv; nor[k * 3 + 1] = nyv; nor[k * 3 + 2] = nzv;
      uv[k * 2] = o.worldUv ? pos[k * 3] / (o.worldScale ?? 4) : side * (o.uRepeat ?? 1);
      uv[k * 2 + 1] = o.worldUv ? pos[k * 3 + 2] / (o.worldScale ?? 4) : s / o.vScale;
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = tone;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    const a = r * 2, b = a + 1, c = a + 2, d = a + 3;
    // winding so the face looks up when latA < latB (left→right)
    idx.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2)); g.setAttribute('color', new BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Extruded barrier with a concrete-style profile along one side. Each profile segment is flat shaded. */
function barrier(track: Track, side: 1 | -1): BufferGeometry {
  // (distance from wall centre toward the track [negative = toward road], height)
  const W = track.wallOffset;
  const prof: [number, number][] = [[-BARRIER_FACE, 0], [-BARRIER_FACE + 0.12, 0.42], [-BARRIER_FACE + 0.3, 1.05], [-BARRIER_FACE + 0.95, 1.05], [-BARRIER_FACE + 1.15, 0]];
  const rows = track.n + 1;
  const segs = prof.length - 1;
  const pos = new Float32Array(rows * segs * 2 * 3), nor = new Float32Array(rows * segs * 2 * 3), uv = new Float32Array(rows * segs * 2 * 2);
  const p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
  const idx: number[] = [];
  for (let r = 0; r < rows; r++) {
    track.pointAt(r * track.spacing, 0, p);
    for (let sg = 0; sg < segs; sg++) {
      const [ax, ay] = prof[sg], [bx, by] = prof[sg + 1];
      // outward-facing 2-D normal of the segment (lateral, vertical)
      let ln = (by - ay), vn = -(bx - ax);
      const l = Math.hypot(ln, vn) || 1; ln /= l; vn /= l;
      if (ln * side < 0 && sg < segs) { /* keep as computed; profile is ordered road → outside */ }
      for (let e = 0; e < 2; e++) {
        const [lx, ly] = e === 0 ? [ax, ay] : [bx, by];
        const lat = side * (W + lx);
        const k = (r * segs + sg) * 2 + e;
        pos[k * 3] = p.x - p.tz * lat; pos[k * 3 + 1] = p.y + ly; pos[k * 3 + 2] = p.z + p.tx * lat;
        // normal: lateral component along the track "right" direction * side
        const nlat = -ln * side;
        nor[k * 3] = -p.tz * nlat; nor[k * 3 + 1] = vn; nor[k * 3 + 2] = p.tx * nlat;
        uv[k * 2] = (sg + e) / segs; uv[k * 2 + 1] = (r * track.spacing) / 12;
      }
    }
  }
  for (let r = 0; r < rows - 1; r++) for (let sg = 0; sg < segs; sg++) {
    const a = (r * segs + sg) * 2, b = a + 1, c = ((r + 1) * segs + sg) * 2, d = c + 1;
    if (side === 1) idx.push(a, b, c, b, d, c); else idx.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('normal', new BufferAttribute(nor, 3)); g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}


/** Catch fence behind the barrier: a vertical wire-mesh strip (alpha-tested diamond pattern) plus posts every 6 m. One strip per side. */
function fenceStrip(track: Track, side: 1 | -1, height: number): BufferGeometry {
  const rows = track.n + 1, lat = side * (track.wallOffset - BARRIER_FACE + 1.7);
  const pos = new Float32Array(rows * 2 * 3), nor = new Float32Array(rows * 2 * 3), uv = new Float32Array(rows * 2 * 2);
  const p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
  for (let r = 0; r < rows; r++) {
    const s = r * track.spacing; track.pointAt(s, 0, p);
    for (let e = 0; e < 2; e++) {
      const k = r * 2 + e;
      pos[k * 3] = p.x - p.tz * lat; pos[k * 3 + 1] = p.y + (e ? height : -0.3); pos[k * 3 + 2] = p.z + p.tx * lat;
      nor[k * 3] = -p.tz * side; nor[k * 3 + 1] = 0; nor[k * 3 + 2] = p.tx * side;
      uv[k * 2] = s / 0.55; uv[k * 2 + 1] = e;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rows - 1; r++) { const a = r * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('normal', new BufferAttribute(nor, 3)); g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function makeFenceTexture(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#ffffff'; g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-4, 32); g.lineTo(32, -4); g.lineTo(68, 32); g.lineTo(32, 68); g.closePath(); g.stroke();
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

export function buildRoad(track: Track, pads: readonly number[], asphalt?: AsphaltPbr): RoadMeshes {
  const group = new Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x; };
  const hw = track.halfWidth;
  let road: Mesh;
  if (asphalt) {
    // real PBR asphalt tiled every 3 m, with the lane markings on a thin overlay
    for (const t of [asphalt.map, asphalt.normal, asphalt.roughness, asphalt.ao]) keep(t);
    road = new Mesh(keep(ribbon(track, { latA: -hw, latB: hw, yOff: 0.0, vScale: 3, uRepeat: (hw * 2) / 3, colorNoise: 0.22 })),
      keep(new MeshStandardMaterial({ map: asphalt.map, normalMap: asphalt.normal, normalScale: new Vector2(0.9, 0.9), roughnessMap: asphalt.roughness, roughness: 1, aoMap: asphalt.ao, aoMapIntensity: 0.8, metalness: 0, vertexColors: true, color: 0xffffff })));
    const marks = keep(makeRoadMarkings());
    const lines = new Mesh(keep(ribbon(track, { latA: -hw, latB: hw, yOff: 0.012, vScale: 16 })),
      keep(new MeshStandardMaterial({ map: marks, transparent: true, depthWrite: false, roughness: 0.78, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
    lines.receiveShadow = true; lines.renderOrder = 1; group.add(lines);
  } else {
    const { map, bump } = makeAsphalt(); keep(map); keep(bump);
    road = new Mesh(keep(ribbon(track, { latA: -hw, latB: hw, yOff: 0.0, vScale: 16, colorNoise: 0.16 })),
      keep(new MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.86, metalness: 0.02, vertexColors: true })));
  }
  road.receiveShadow = true; group.add(road);

  // wear layer: rubbered wheel tracks, edge grime, resurfaced patches, sealed cracks and oil drips (one extra draw call)
  {
    const wearTex = keep(makeRoadWear());
    const wear = new Mesh(keep(ribbon(track, { latA: -hw, latB: hw, yOff: 0.006, vScale: 24, uRepeat: 1 })),
      keep(new MeshStandardMaterial({ color: 0x07070a, alphaMap: wearTex, transparent: true, opacity: 0.85, depthWrite: false, roughness: 0.5, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
    wear.receiveShadow = true; wear.renderOrder = 0; group.add(wear);
  }

  const kerbTex = keep(makeKerb());
  const kerbMat = keep(new MeshStandardMaterial({ map: kerbTex, roughness: 0.7 }));
  for (const side of [-1, 1]) {
    const a = side * hw, b = side * (hw + track.kerb);
    const m = new Mesh(keep(ribbon(track, { latA: Math.min(a, b), latB: Math.max(a, b), yOff: 0.035, vScale: 7.2 })), kerbMat);
    m.receiveShadow = true; group.add(m);
  }

  const shoulderTex = keep(makeShoulder());
  // runoff apron: the same real asphalt, lighter and rougher, so the edge of the track reads as engineered tarmac
  const shoulderMat = asphalt
    ? keep(new MeshStandardMaterial({ map: asphalt.map, normalMap: asphalt.normal, normalScale: new Vector2(0.7, 0.7), roughness: 1, color: 0xbfbfcb, metalness: 0 }))
    : keep(new MeshStandardMaterial({ map: shoulderTex, roughness: 0.95 }));
  const wallIn = track.wallOffset - BARRIER_FACE;
  for (const side of [-1, 1]) {
    const a = side * (hw + track.kerb - 0.05), b = side * (wallIn + 1.2);
    const m = new Mesh(keep(ribbon(track, { latA: Math.min(a, b), latB: Math.max(a, b), yOff: -0.02, vScale: 4, worldUv: true, worldScale: asphalt ? 3 : 4 })), shoulderMat);
    m.receiveShadow = true; group.add(m);
  }

  const barTex = keep(makeBarrier());
  const barMat = keep(new MeshStandardMaterial({ map: barTex, roughness: 0.78, metalness: 0.02 }));
  for (const side of [-1, 1] as const) {
    const m = new Mesh(keep(barrier(track, side)), barMat);
    m.castShadow = true; m.receiveShadow = true; group.add(m);
  }


  // catch fence behind the barrier: gives the track edge a clear engineered boundary against the hillside
  const FENCE_H = 3.2;
  const fenceTex = keep(makeFenceTexture()); fenceTex.repeat.set(1, 3.2 / 0.55);
  const fenceMat = keep(new MeshStandardMaterial({ map: fenceTex, color: 0x5d6370, alphaTest: 0.45, side: DoubleSide, roughness: 0.5, metalness: 0.6 }));
  const postGeo = keep(new CylinderGeometry(0.055, 0.07, FENCE_H + 0.4, 6));
  const postMat = keep(new MeshStandardMaterial({ color: 0x4a4e58, roughness: 0.6, metalness: 0.5 }));
  const pstep = 6, per = Math.floor(track.length / pstep);
  const posts = new InstancedMesh(postGeo, postMat, per * 2);
  const mtx = new Matrix4(), pp = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
  let pi = 0;
  for (const side of [-1, 1] as const) {
    const m = new Mesh(keep(fenceStrip(track, side, FENCE_H)), fenceMat); group.add(m);
    const lat = side * (track.wallOffset - BARRIER_FACE + 1.7);
    for (let i = 0; i < per; i++) { track.pointAt(i * pstep, 0, pp); mtx.makeTranslation(pp.x - pp.tz * lat, pp.y + FENCE_H / 2 - 0.1, pp.z + pp.tx * lat); posts.setMatrixAt(pi++, mtx); }
  }
  posts.castShadow = true; posts.frustumCulled = false; group.add(posts); disposables.push({ dispose: () => posts.dispose() });

  // start / finish line and grid boxes
  const checker = keep(makeChecker(16, 2)); checker.wrapS = checker.wrapT = RepeatWrapping;
  const line = new Mesh(keep(ribbon(track, { latA: -hw, latB: hw, yOff: 0.03, vScale: 1.2, s0: -0.6, s1: 0.6, uRepeat: 1 })),
    keep(new MeshStandardMaterial({ map: checker, roughness: 0.8 })));
  line.receiveShadow = true; group.add(line);
  const gridMat = keep(new MeshBasicMaterial({ color: 0xf2f2ea }));
  const gridParts: BufferGeometry[] = [];
  for (let slot = 0; slot < 6; slot++) {
    const row = Math.floor(slot / 2), col = slot % 2;
    const s = -(7 + row * 9 + (col ? 4.5 : 0)), lat = col ? 3.4 : -3.4;
    const r: [number, number, number, number][] = [[lat - 1.3, lat - 1.1, s - 2.6, s + 2.6], [lat + 1.1, lat + 1.3, s - 2.6, s + 2.6], [lat - 1.3, lat + 1.3, s - 2.6, s - 2.4]];
    for (const [la, lb, s0, s1] of r) gridParts.push(ribbon(track, { latA: la, latB: lb, yOff: 0.034, vScale: 100, s0, s1 }));
  }
  const gridGeo = keep(mergeGeometries(gridParts)!);
  gridParts.forEach(g => g.dispose());
  group.add(new Mesh(gridGeo, gridMat));

  // boost pads
  const chevron = keep(makeChevron());
  const padMats: MeshBasicMaterial[] = [];
  const padMeshes: Mesh[] = [];
  for (const s of pads) {
    const mat = keep(new MeshBasicMaterial({ map: chevron, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    padMats.push(mat);
    const m = new Mesh(keep(ribbon(track, { latA: -5.6, latB: 5.6, yOff: 0.06, vScale: 6.4, s0: s - 3.2, s1: s + 3.2, uRepeat: 1 })), mat);
    m.renderOrder = 2; group.add(m); padMeshes.push(m);
  }

  return {
    group, pads: padMeshes,
    update(time: number) { chevron.offset.y = -time * 1.1; },
    dispose() { disposables.forEach(d => d.dispose()); },
  };
}

