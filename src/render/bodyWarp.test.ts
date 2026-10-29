import { describe, expect, it } from 'vitest';
import { REAR_LAYOUTS, SCULPTED, lensEdges, setBodyShape, bodyShape, rearLayout, tailRibbonGrid, tailSurfaceZ, warpBuffers, warpPoint } from './bodyWarp';

const w = (x: number, y: number, z: number): [number, number, number] => { const o: [number, number, number] = [0, 0, 0]; warpPoint(x, y, z, o); return o; };

describe('body warp', () => {
  it('is mirror-symmetric and leaves the centre plane in place', () => {
    for (const [y, z] of [[0.4, -1.8], [0.9, -0.9], [1.1, 0.3], [0.6, 1.5]]) {
      const a = w(0.7, y, z), b = w(-0.7, y, z);
      expect(b[0]).toBeCloseTo(-a[0], 9); expect(b[1]).toBeCloseTo(a[1], 9); expect(b[2]).toBeCloseTo(a[2], 9);
      expect(w(0, y, z)[0]).toBe(0);
    }
  });
  it('leaves the lower mid body alone, so doors, sills and the floor line up', () => {
    const p = w(0.3, 0.3, 0.2);
    expect(p[0]).toBeCloseTo(0.3, 6); expect(p[1]).toBeCloseTo(0.3, 6); expect(p[2]).toBeCloseTo(0.2, 6);
  });
  it('narrows and lowers the greenhouse and drops the rear deck', () => {
    expect(w(0.88, 1.13, 0.9)[0]).toBeLessThan(0.88 * 0.9);          // windshield header tucks in
    expect(w(0.5, 1.15, -0.1)[1]).toBeLessThan(1.15 - 0.04);          // roof lowered
    expect(w(0.5, 1.0, -1.6)[1]).toBeLessThan(1.0 - 0.1);             // deck falls away to the tail
    expect(w(0.5, 0.35, -1.94)[2]).toBeLessThan(-1.94);               // lower valance pushed rearwards
  });
  it('never folds the surface over: the Jacobian determinant stays positive everywhere on the body', () => {
    const h = 1e-3, o1: [number, number, number] = [0, 0, 0], o2: [number, number, number] = [0, 0, 0];
    let min = Infinity;
    for (let x = -1.2; x <= 1.2; x += 0.2) for (let y = 0.1; y <= 1.2; y += 0.1) for (let z = -2.0; z <= 2.5; z += 0.25) {
      const J: number[] = [];
      for (let c = 0; c < 3; c++) {
        const p = [x, y, z], q = [x, y, z]; p[c] += h; q[c] -= h; warpPoint(p[0], p[1], p[2], o1); warpPoint(q[0], q[1], q[2], o2);
        for (let k = 0; k < 3; k++) J[k * 3 + c] = (o1[k] - o2[k]) / (2 * h);
      }
      const det = J[0] * (J[4] * J[8] - J[5] * J[7]) - J[1] * (J[3] * J[8] - J[5] * J[6]) + J[2] * (J[3] * J[7] - J[4] * J[6]);
      min = Math.min(min, det);
    }
    expect(min).toBeGreaterThan(0.3);
  });
  it('keeps the body at least as wide as the tyres over the wheels (no poke-through)', () => {
    for (const zw of [1.486, -1.314]) for (const y of [0.35, 0.5, 0.65]) expect(w(1.11, y, zw)[0]).toBeGreaterThanOrEqual(1.11 - 1e-6);
  });
  it('transforms normals so they stay perpendicular to the warped surface', () => {
    // a small patch of the rear deck, normal +y
    const c = [0.5, 0.95, -1.4], h = 0.01;
    const pts = new Float32Array([...c, c[0] + h, c[1], c[2], c[0], c[1], c[2] + h]);
    const nrm = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    warpBuffers(pts, nrm);
    const e1 = [pts[3] - pts[0], pts[4] - pts[1], pts[5] - pts[2]], e2 = [pts[6] - pts[0], pts[7] - pts[1], pts[8] - pts[2]];
    const n = [nrm[0], nrm[1], nrm[2]], dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 5);
    expect(Math.abs(dot(n, e1)) / Math.hypot(e1[0], e1[1], e1[2])).toBeLessThan(1e-2);
    expect(Math.abs(dot(n, e2)) / Math.hypot(e2[0], e2[1], e2[2])).toBeLessThan(1e-2);
    expect(n[1]).toBeGreaterThan(0.9);
  });
  it('has sane default parameters', () => { expect(SCULPTED.rearDrop).toBeGreaterThan(0); expect(SCULPTED.tumble).toBeLessThan(0.3); });
});

describe('rear layout', () => {
  const old = (x: number, y: number): number => {
    const ys = [0.15, 0.25, 0.35, 0.55, 0.65, 0.75, 0.85, 0.95], zs = [-1.89, -1.91, -1.93, -1.94, -1.93, -1.91, -1.87, -1.78];
    const yc = Math.min(Math.max(y, ys[0]), ys[ys.length - 1]); let i = 0; while (i < ys.length - 2 && yc > ys[i + 1]) i++;
    const t = (yc - ys[i]) / (ys[i + 1] - ys[i]), zc = zs[i] + (zs[i + 1] - zs[i]) * t, ax = Math.abs(x), top = Math.min(Math.max((y - 0.55) / 0.4, 0), 1);
    return zc + 0.085 * ax * ax + (0.5 + 2.5 * top) * Math.max(0, ax - 0.8) ** 2;
  };
  it('the original layout reproduces the previous tailZ exactly (fallback is unchanged)', () => {
    for (const x of [0, 0.3, 0.7, 0.95]) for (const y of [0.15, 0.28, 0.5, 0.8, 0.93]) expect(tailSurfaceZ(x, y, REAR_LAYOUTS.original)).toBeCloseTo(old(x, y), 9);
  });
  it('the sculpted tail surface agrees with the warped original surface (layout and warp are consistent)', () => {
    let worst = 0;
    for (const x of [0, 0.25, 0.5, 0.75, 0.9]) for (const y of [0.2, 0.3, 0.45, 0.55, 0.65, 0.72]) {
      const [wx, wy, wz] = w(x, y, old(x, y));
      worst = Math.max(worst, Math.abs(tailSurfaceZ(wx, wy, REAR_LAYOUTS.sculpted) - wz));
    }
    expect(worst).toBeLessThan(0.05);
  });
  it('the sculpted lens band is a positive-height band that stays on the deck below the sculpted top edge', () => {
    const e = lensEdges(REAR_LAYOUTS.sculpted);
    for (let x = 0.1; x <= REAR_LAYOUTS.sculpted.lens.half; x += 0.1) { expect(e.top(x) - e.lo(x)).toBeGreaterThan(0.02); expect(e.top(x)).toBeLessThan(0.8); expect(e.lo(x)).toBeGreaterThan(0.55); }
  });
  it('the ribbon grid has 3 rows per column and valid indices', () => {
    const g = tailRibbonGrid(-0.5, 0.5, () => 0.6, () => 0.7, 0.02, 8);
    expect(g.pos.length).toBe((8 + 1) * 3 * 3); expect(Math.max(...g.idx)).toBeLessThan(g.pos.length / 3); expect(g.idx.length).toBe(8 * 2 * 6);
  });
  it('switches shape explicitly and defaults to the stock layout', () => {
    expect(bodyShape()).toBe('original'); expect(rearLayout().exhaustZ).toBe(-1.985);
    setBodyShape('sculpted'); expect(rearLayout().exhaustZ).toBe(-2.01); setBodyShape('original');
  });
});
