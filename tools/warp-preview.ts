// Bakes the game's car body (source Car Concept, game parts only, world transforms applied) with and without the body warp
// into plain glTF files so they can be rendered side by side in tools/candidate-viewer.
// Usage: tsx tools/warp-preview.ts <out-dir> [--original] [--param=value ...]   (e.g. --rearDrop=0.15)
import fs from 'node:fs';
import path from 'node:path';
import { REAR_LAYOUTS, SCULPTED, lensEdges, tailRibbonGrid, tailSurfaceZ, warpBuffers, type WarpParams } from '../src/render/bodyWarp';

const SRC = 'assets-src/car-concept/src';
const out = process.argv[2] ?? 'preview'; const original = process.argv.includes('--original');
const params: WarpParams = { ...SCULPTED };
for (const a of process.argv) { const m = /^--(\w+)=([-\d.]+)$/.exec(a); if (m && m[1] in params) (params as unknown as Record<string, number>)[m[1]] = +m[2]; }
const DROP = /^(Interior(Cage|Floor|Floormats|Mid|Pedal|Pillar|Rear|Door|SteeringBase|SteeringCylinder|SteeringEmblem|SteeringDash|SteeringHandle)|Engine|License Plate|BodyWindshieldWipers|BodyHoodInterior|BodyHoodUnder|BodyUnderside|Axles)/;
type J = { nodes: any[]; meshes: any[]; accessors: any[]; bufferViews: any[]; buffers: any[]; scenes: any[]; scene?: number; materials: any[]; [k: string]: any };
const j: J = JSON.parse(fs.readFileSync(`${SRC}/CarConcept.gltf`, 'utf8'));
const bin = fs.readFileSync(`${SRC}/${j.buffers[0].uri}`);
const CT: Record<number, any> = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NC: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function read(i: number): { data: any; n: number; count: number; a: any } {
  const a = j.accessors[i], bv = j.bufferViews[a.bufferView], n = NC[a.type], T = CT[a.componentType];
  const stride = bv.byteStride ?? n * T.BYTES_PER_ELEMENT, off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength); const o = new T(a.count * n);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
    const p = off + k * stride + c * T.BYTES_PER_ELEMENT;
    o[k * n + c] = a.componentType === 5126 ? dv.getFloat32(p, true) : a.componentType === 5125 ? dv.getUint32(p, true) : a.componentType === 5123 ? dv.getUint16(p, true) : dv.getUint8(p);
  }
  return { data: o, n, count: a.count, a };
}
// column-major 4x4 helpers
const mul = (a: number[], b: number[]): number[] => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
function local(n: any): number[] {
  if (n.matrix) return n.matrix;
  const t = n.translation ?? [0, 0, 0], [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], s = n.scale ?? [1, 1, 1];
  return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0, 2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1];
}
const chunks: Buffer[] = []; let byteLen = 0;
const newBV: any[] = [], newAcc: any[] = [], newMeshes: any[] = [], newNodes: any[] = [];
function push(arr: ArrayBufferView, target: number): number {
  const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (b.length % 4)) % 4;
  newBV.push({ buffer: 0, byteOffset: byteLen, byteLength: b.length, target }); chunks.push(b, Buffer.alloc(pad)); byteLen += b.length + pad; return newBV.length - 1;
}
function addAcc(data: ArrayBufferView, count: number, type: string, ct: number, target: number, minmax = false, n = 3): number {
  const bv = push(data, target); const a: any = { bufferView: bv, componentType: ct, count, type };
  if (minmax) { const f = data as Float32Array; const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < f.length; i += n) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], f[i + c]); mx[c] = Math.max(mx[c], f[i + c]); } a.min = mn; a.max = mx; }
  newAcc.push(a); return newAcc.length - 1;
}
function walk(i: number, P: number[], wheel: boolean): void {
  const n = j.nodes[i], W = mul(P, local(n)), nm: string = n.name ?? '';
  const isWheel = wheel || /^Wheel(Front|Rear)/.test(nm);
  if (n.mesh !== undefined && (isWheel || !DROP.test(nm))) {
    for (const pr of j.meshes[n.mesh].primitives) {
      const pos = read(pr.attributes.POSITION), nor = pr.attributes.NORMAL !== undefined ? read(pr.attributes.NORMAL) : null;
      const P3 = new Float32Array(pos.data), N3 = nor ? new Float32Array(nor.data) : undefined;
      for (let v = 0; v < pos.count; v++) {
        const x = P3[v * 3], y = P3[v * 3 + 1], z = P3[v * 3 + 2];
        P3[v * 3] = W[0] * x + W[4] * y + W[8] * z + W[12]; P3[v * 3 + 1] = W[1] * x + W[5] * y + W[9] * z + W[13]; P3[v * 3 + 2] = W[2] * x + W[6] * y + W[10] * z + W[14];
        if (N3) { const a = N3[v * 3], b = N3[v * 3 + 1], c = N3[v * 3 + 2]; N3[v * 3] = W[0] * a + W[4] * b + W[8] * c; N3[v * 3 + 1] = W[1] * a + W[5] * b + W[9] * c; N3[v * 3 + 2] = W[2] * a + W[6] * b + W[10] * c; }
      }
      if (!isWheel && !original) warpBuffers(P3, N3, undefined, 4, params);
      const prim: any = { attributes: { POSITION: addAcc(P3, pos.count, 'VEC3', 5126, 34962, true) }, material: pr.material, mode: 4 };
      if (N3) prim.attributes.NORMAL = addAcc(N3, pos.count, 'VEC3', 5126, 34962);
      if (pr.attributes.TEXCOORD_0 !== undefined) { const uv = read(pr.attributes.TEXCOORD_0); prim.attributes.TEXCOORD_0 = addAcc(new Float32Array(uv.data), uv.count, 'VEC2', 5126, 34962); }
      if (pr.indices !== undefined) { const ix = read(pr.indices); prim.indices = addAcc(new Uint32Array(ix.data), ix.count, 'SCALAR', 5125, 34963); }
      newMeshes.push({ name: nm, primitives: [prim] }); newNodes.push({ name: (isWheel ? 'wheel:' : '') + nm, mesh: newMeshes.length - 1 });
    }
  }
  for (const c of n.children ?? []) walk(c, W, isWheel);
}
for (const r of j.scenes[j.scene ?? 0].nodes) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], false);
// --- rear detail (the same layout functions the game uses; boxes/pipes are simplified stand-ins for the preview) ---
const L = REAR_LAYOUTS[original ? 'original' : 'sculpted'];
const matBase = j.materials.length;
j.materials.push(
  { name: 'pvLens', pbrMetallicRoughness: { baseColorFactor: [0.01, 0.002, 0.004, 1], metallicFactor: 0.1, roughnessFactor: 0.12 } },
  { name: 'pvLed', pbrMetallicRoughness: { baseColorFactor: [0.15, 0.01, 0.015, 1], metallicFactor: 0, roughnessFactor: 0.35 }, emissiveFactor: [1, 0.11, 0.16] },
  { name: 'pvCarbon', pbrMetallicRoughness: { baseColorFactor: [0.01, 0.01, 0.012, 1], metallicFactor: 0.35, roughnessFactor: 0.42 } },
  { name: 'pvChrome', pbrMetallicRoughness: { baseColorFactor: [0.75, 0.78, 0.82, 1], metallicFactor: 0.95, roughnessFactor: 0.22 } });
function addGeo(pos: number[], idx: number[], mat: number, name: string, flat = false): void {
  let P = pos, I = idx;
  if (flat) { P = []; I = []; for (let k = 0; k < idx.length; k++) { P.push(pos[idx[k] * 3], pos[idx[k] * 3 + 1], pos[idx[k] * 3 + 2]); I.push(k); } }
  const N = new Float32Array(P.length);
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
    const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(q => q / l);
    if (n[2] > 0) { // the lit side must face the chase camera (behind the car): flip winding
      const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; n = n.map(q => -q);
    }
    for (const q of [I[k], I[k + 1], I[k + 2]]) { N[q * 3] = n[0]; N[q * 3 + 1] = n[1]; N[q * 3 + 2] = n[2]; }
  }
  const Pf = new Float32Array(P);
  const prim: any = { attributes: { POSITION: addAcc(Pf, P.length / 3, 'VEC3', 5126, 34962, true), NORMAL: addAcc(N, P.length / 3, 'VEC3', 5126, 34962) }, indices: addAcc(new Uint32Array(I), I.length, 'SCALAR', 5125, 34963), material: mat, mode: 4 };
  newMeshes.push({ name, primitives: [prim] }); newNodes.push({ name, mesh: newMeshes.length - 1 });
}
const box = (w: number, h: number, d: number, px: number, py: number, pz: number, rx = 0): { pos: number[]; idx: number[] } => {
  const pos: number[] = [], idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 1, 5, 6, 1, 6, 2, 0, 3, 7, 0, 7, 4];
  for (const [sx, sy, sz] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) {
    const y0 = sy * h / 2, z0 = sz * d / 2, c = Math.cos(rx), s = Math.sin(rx); pos.push(px + sx * w / 2, py + y0 * c - z0 * s, pz + y0 * s + z0 * c);
  }
  return { pos, idx };
};
const merge = (parts: { pos: number[]; idx: number[] }[]): { pos: number[]; idx: number[] } => { const pos: number[] = [], idx: number[] = []; for (const p of parts) { const o = pos.length / 3; pos.push(...p.pos); idx.push(...p.idx.map(i => i + o)); } return { pos, idx }; };
const tz = (x: number, y: number): number => tailSurfaceZ(x, y, L);
{
  const e = lensEdges(L), seg = 28, ledLo = (x: number): number => e.lo(x) + 0.03, ledHi = (x: number): number => ledLo(x) + 0.032;
  const lens = merge([tailRibbonGrid(-L.lens.half, -0.1, e.lo, e.top, 0.016, seg, L), tailRibbonGrid(0.1, L.lens.half, e.lo, e.top, 0.016, seg, L)]); addGeo(lens.pos, lens.idx, matBase, 'pvLens');
  const hh = L.lens.half - 0.04;
  const led = merge([tailRibbonGrid(-hh, -0.14, ledLo, ledHi, 0.022, seg, L), tailRibbonGrid(0.14, hh, ledLo, ledHi, 0.022, seg, L), tailRibbonGrid(-0.1, 0.1, () => ledLo(0), () => ledHi(0), 0.02, 2, L), box(0.16, 0.028, 0.012, 0, 0.255, tz(0, 0.255) - 0.024)]); addGeo(led.pos, led.idx, matBase + 1, 'pvLed', true);
  const carbon = [box(1.2, 0.14, 0.02, 0, 0.28, tz(0, 0.28) - 0.012, 0.1), box(1.26, 0.02, 0.04, 0, 0.215, tz(0, 0.215) - 0.018), box(1.2, 0.012, 0.04, 0, 0.352, tz(0, 0.352) - 0.022)];
  for (let i = -3; i <= 3; i++) carbon.push(box(0.014, 0.11, 0.045, i * 0.17, 0.275, tz(i * 0.17, 0.275) - 0.028, 0.1));
  const cm = merge(carbon); addGeo(cm.pos, cm.idx, matBase + 2, 'pvCarbon', true);
  const pipes: { pos: number[]; idx: number[] }[] = [];
  for (const ex of [0.5, -0.5]) { const pos: number[] = [], idx: number[] = [], n = 16, r = 0.055, z0 = L.exhaustZ + 0.12, z1 = L.exhaustZ - 0.008;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pos.push(ex + Math.cos(a) * r, 0.355 + Math.sin(a) * r, z0, ex + Math.cos(a) * r, 0.355 + Math.sin(a) * r, z1); }
    for (let k = 0; k < n; k++) { const a = k * 2, b = ((k + 1) % n) * 2; idx.push(a, a + 1, b, b, a + 1, b + 1); } pipes.push({ pos, idx }); }
  const pm = merge(pipes); addGeo(pm.pos, pm.idx, matBase + 3, 'pvChrome', true);
}
const outJ = { asset: { version: '2.0', generator: 'warp-preview' }, scene: 0, scenes: [{ nodes: newNodes.map((_, i) => i) }], nodes: newNodes, meshes: newMeshes, accessors: newAcc, bufferViews: newBV,
  buffers: [{ uri: 'preview.bin', byteLength: byteLen }], materials: j.materials, textures: j.textures, images: j.images.map((im: any) => ({ ...im, uri: path.relative(out, path.join(SRC, im.uri)) })),
  samplers: j.samplers, extensionsUsed: j.extensionsUsed?.filter((e: string) => !/variants/.test(e)) };
fs.mkdirSync(out, { recursive: true });
const tag = original ? 'original' : 'sculpted';
fs.writeFileSync(path.join(out, `${tag}.bin`), Buffer.concat(chunks)); (outJ.buffers[0] as any).uri = `${tag}.bin`;
fs.writeFileSync(path.join(out, `${tag}.gltf`), JSON.stringify(outJ));
console.log(tag, 'meshes', newMeshes.length, 'bytes', byteLen, original ? '' : JSON.stringify(params));
