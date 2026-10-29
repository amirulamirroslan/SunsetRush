/**
 * "Sculpted" body reshaping for the stock Car Concept shell.
 *
 * The source body is as wide at the roof as at the hips and its rear deck is a flat, high slab, which reads as an arcade
 * blob from the chase camera. This smooth, monotonic warp (model space: +z nose, y up, metres) adds shoulder tumblehome,
 * a lower roof, a rear deck that falls away to the tail, a narrower tail plan, a deeper lower rear valance and slight
 * fender flares over the wheels. It is applied once to the loaded template geometry (see bodyWarpScene.ts), so every
 * level of detail, rival and garage preview gets the same shape. No three.js here so it can be tested in isolation.
 *
 * The wheels are never warped. `BODY_SHAPES.original` is the untouched model (rollback / fallback).
 */

export type BodyShapeId = 'original' | 'sculpted';

export interface WarpParams {
  /** metres the roof line drops (applies above the beltline) */ roofDrop: number;
  /** metres the rear deck drops towards the tail */ rearDrop: number;
  /** fractional narrowing of the upper body at the roof */ tumble: number;
  /** fractional narrowing of the tail plan */ taper: number;
  /** metres the lower rear valance is pushed rearwards */ lip: number;
  /** metres of fender flare over the wheels */ flare: number;
}

export const SCULPTED: WarpParams = { roofDrop: 0.05, rearDrop: 0.13, tumble: 0.15, taper: 0.13, lip: 0.05, flare: 0.045 };

const WHEEL_Z = [1.486, -1.314];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number): number => { const t = clamp01(v); return t * t * (3 - 2 * t); };

/** Warps one model-space point. `out` may alias nothing. */
export function warpPoint(x: number, y: number, z: number, out: [number, number, number], p: WarpParams = SCULPTED): void {
  const u = smooth((y - 0.7) / 0.45);               // upper body / greenhouse
  const yw = smooth((y - 0.45) / 0.45);             // deck-height weighting
  const rt = smooth((-1.45 - z) / 0.5);             // 0 over the rear axle, 1 at the tail (keeps the haunches over the wheels)
  const rd = smooth((-0.45 - z) / 1.45);            // behind the rear glass
  const lowTail = smooth((-1.45 - z) / 0.5);
  const lowBody = smooth((0.6 - y) / 0.45);
  const dy = p.roofDrop * u + p.rearDrop * rd * yw;
  const sx = 1 - p.tumble * Math.pow(u, 1.3) - p.taper * rt * smooth((y - 0.3) / 0.4);
  const ax = Math.abs(x);
  let flare = 0;
  if (p.flare > 0) {
    const edge = smooth((ax - 0.8) / 0.2), band = Math.exp(-(((y - 0.55) / 0.22) ** 2));
    for (const zw of WHEEL_Z) flare += Math.exp(-(((z - zw) / 0.55) ** 2));
    flare *= p.flare * edge * band;
  }
  out[0] = Math.sign(x) * (ax * sx + flare);
  out[1] = y - dy;
  out[2] = z - p.lip * lowTail * lowBody;
}

/** Jacobian of warpPoint (central differences), row-major: J[k*3+c] = d out_k / d in_c. */
function jacobian(x: number, y: number, z: number, p: WarpParams, J: number[]): void {
  const h = 1e-3, a: [number, number, number] = [0, 0, 0], b: [number, number, number] = [0, 0, 0];
  const P = [x, y, z];
  for (let c = 0; c < 3; c++) {
    const q = [x, y, z], r = [x, y, z]; q[c] = P[c] + h; r[c] = P[c] - h;
    warpPoint(q[0], q[1], q[2], a, p); warpPoint(r[0], r[1], r[2], b, p);
    for (let k = 0; k < 3; k++) J[k * 3 + c] = (a[k] - b[k]) / (2 * h);
  }
}

/** (J^-1)^T written to `out` (row-major) = cofactor matrix / determinant; false if J is (near) singular. */
function invTranspose(J: number[], out: number[]): boolean {
  const [a, b, c, d, e, f, g, h, i] = J;
  const det = a * (e * i - f * h) + b * (f * g - d * i) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-9) return false;
  const s = 1 / det;
  out[0] = (e * i - f * h) * s; out[1] = (f * g - d * i) * s; out[2] = (d * h - e * g) * s;
  out[3] = (c * h - b * i) * s; out[4] = (a * i - c * g) * s; out[5] = (b * g - a * h) * s;
  out[6] = (b * f - c * e) * s; out[7] = (c * d - a * f) * s; out[8] = (a * e - b * d) * s;
  return true;
}

/**
 * Warps interleaved xyz arrays in place. Normals are transformed with the inverse transpose of the Jacobian, tangents
 * (xyz of xyzw) with the Jacobian itself. Arrays must be Float32/Float64 in model space.
 */
export type Buf = Float32Array | Float64Array;
export function warpBuffers(pos: Buf, nrm?: Buf, tan?: Buf, tanStride = 4, p: WarpParams = SCULPTED): void {
  const n = pos.length / 3, o: [number, number, number] = [0, 0, 0], J = new Array<number>(9).fill(0), M = new Array<number>(9).fill(0);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    if (nrm || tan) jacobian(x, y, z, p, J);
    if (nrm && invTranspose(J, M)) {
      const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
      let tx = M[0] * nx + M[1] * ny + M[2] * nz, ty = M[3] * nx + M[4] * ny + M[5] * nz, tz = M[6] * nx + M[7] * ny + M[8] * nz;
      const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
      nrm[v * 3] = tx; nrm[v * 3 + 1] = ty; nrm[v * 3 + 2] = tz;
    }
    if (tan) {
      const k = v * tanStride, tx0 = tan[k], ty0 = tan[k + 1], tz0 = tan[k + 2];
      let tx = J[0] * tx0 + J[1] * ty0 + J[2] * tz0, ty = J[3] * tx0 + J[4] * ty0 + J[5] * tz0, tz = J[6] * tx0 + J[7] * ty0 + J[8] * tz0;
      const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l; tan[k] = tx; tan[k + 1] = ty; tan[k + 2] = tz;
    }
    warpPoint(x, y, z, o, p);
    pos[v * 3] = o[0]; pos[v * 3 + 1] = o[1]; pos[v * 3 + 2] = o[2];
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Rear layout: where the tail surface is, and where the procedural tail lights, diffuser, pipes and spoilers sit on it.
// Measured from the model (original) and from the warped model (sculpted, tools/warp-preview.ts + a least-squares fit,
// rms error 1.1 cm / max 3.3 cm). `activeShape` is switched to 'sculpted' only after the warp has really been applied.
// ---------------------------------------------------------------------------------------------------------------------

export interface RearLayout {
  /** tail surface z at x = 0, sampled at heights ys */ ys: number[]; zs: number[];
  /** z(x,y) = zc + a*x^2 + (b + c*top) * max(0,|x|-x0)^2, top = clamp((y - topY0) / topSpan) */ a: number; b: number; c: number; x0: number; topY0: number; topSpan: number;
  /** smoked lens band: top/bottom edge at the centre, how much they close in towards the corners, ramp start and half width */
  lens: { top: number; topFall: number; lo: number; loRise: number; rampFrom: number; rampLen: number; half: number };
  /** z of the tailpipe tips */ exhaustZ: number;
  /** vertical offset applied to the stock spoiler mounts */ spoilerDy: number;
}

export const REAR_LAYOUTS: Record<BodyShapeId, RearLayout> = {
  original: {
    ys: [0.15, 0.25, 0.35, 0.55, 0.65, 0.75, 0.85, 0.95], zs: [-1.89, -1.91, -1.93, -1.94, -1.93, -1.91, -1.87, -1.78],
    a: 0.085, b: 0.5, c: 2.5, x0: 0.8, topY0: 0.55, topSpan: 0.4,
    lens: { top: 0.93, topFall: 0.05, lo: 0.8, loRise: 0.035, rampFrom: 0.55, rampLen: 0.4, half: 0.9 },
    exhaustZ: -1.985, spoilerDy: 0,
  },
  sculpted: {
    ys: [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.82], zs: [-1.933, -1.934, -1.953, -1.953, -1.944, -1.915, -1.833, -1.734],
    a: 0.09, b: -0.021, c: 0.929, x0: 0.6, topY0: 0.45, topSpan: 0.4,
    lens: { top: 0.725, topFall: 0.06, lo: 0.6, loRise: 0.03, rampFrom: 0.55, rampLen: 0.35, half: 0.88 },
    exhaustZ: -2.01, spoilerDy: -0.14,
  },
};

let activeShape: BodyShapeId = 'original';
export function setBodyShape(id: BodyShapeId): void { activeShape = id; }
export function bodyShape(): BodyShapeId { return activeShape; }
export function rearLayout(id: BodyShapeId = activeShape): RearLayout { return REAR_LAYOUTS[id]; }

/** Rear surface of the body shell: z of the tail panel at height y and lateral offset x (nose is +z). */
export function tailSurfaceZ(x: number, y: number, L: RearLayout = rearLayout()): number {
  const ys = L.ys, zs = L.zs;
  const yc = Math.min(Math.max(y, ys[0]), ys[ys.length - 1]); let i = 0; while (i < ys.length - 2 && yc > ys[i + 1]) i++;
  const t = (yc - ys[i]) / (ys[i + 1] - ys[i]), zc = zs[i] + (zs[i + 1] - zs[i]) * t;
  const ax = Math.abs(x), top = clamp01((y - L.topY0) / L.topSpan);
  return zc + L.a * ax * ax + (L.b + L.c * top) * Math.max(0, ax - L.x0) ** 2;
}

/** Smoked-lens band edges as functions of x. */
export function lensEdges(L: RearLayout = rearLayout()): { top: (x: number) => number; lo: (x: number) => number } {
  const s = L.lens, ramp = (x: number): number => Math.max(0, Math.abs(x) - s.rampFrom) / s.rampLen;
  return { top: x => s.top - s.topFall * ramp(x), lo: x => s.lo + s.loRise * ramp(x) };
}

/** Grid for a ribbon that hugs the tail panel (`off` metres proud of it), three rows high; faces rearwards. */
export function tailRibbonGrid(x0: number, x1: number, lo: (x: number) => number, hi: (x: number) => number, off: number, seg: number, L: RearLayout = rearLayout()): { pos: number[]; idx: number[] } {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const x = x0 + (x1 - x0) * (i / seg), yl = lo(x), yh = hi(x);
    for (const y of [yl, (yl + yh) / 2, yh]) pos.push(x, y, tailSurfaceZ(x, y, L) - off);
  }
  for (let i = 0; i < seg; i++) for (let r = 0; r < 2; r++) { const a = i * 3 + r, b = (i + 1) * 3 + r; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  return { pos, idx };
}
