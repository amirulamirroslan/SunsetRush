import { describe, expect, it } from 'vitest';
import { Track, newQuery } from './Track';

const track = new Track();

describe('Track', () => {
  it('is a closed circuit of sensible length', () => {
    expect(track.length).toBeGreaterThan(1800);
    expect(track.length).toBeLessThan(3600);
    const dx = track.x[0] - track.x[track.n - 1], dz = track.z[0] - track.z[track.n - 1];
    expect(Math.hypot(dx, dz)).toBeLessThan(track.spacing * 1.2);
  });
  it('has no tight corners and no steep slopes', () => {
    let maxK = 0, maxSlope = 0;
    for (let i = 0; i < track.n; i++) {
      maxK = Math.max(maxK, Math.abs(track.curvature[i]));
      maxSlope = Math.max(maxSlope, Math.abs(track.y[track.wrap(i + 1)] - track.y[i]) / track.spacing);
    }
    expect(1 / maxK).toBeGreaterThan(track.halfWidth * 1.6); // tightest radius leaves room to drive
    expect(maxSlope).toBeLessThan(0.12);
  });
  it('never comes close to crossing itself', () => {
    const minGap = track.wallOffset * 2 + 8;
    for (let i = 0; i < track.n; i += 2) for (let j = i + 1; j < track.n; j += 2) {
      const along = Math.min(j - i, track.n - (j - i)) * track.spacing;
      if (along < 160) continue;
      expect(Math.hypot(track.x[i] - track.x[j], track.z[i] - track.z[j])).toBeGreaterThan(minGap);
    }
  });
  it('projects points back onto the centre line with correct signed offset', () => {
    const q = newQuery(); const out = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
    for (const s of [10, 400, 900, 1700, 2300]) for (const lat of [-6, 0, 4.5]) {
      track.pointAt(s, lat, out);
      track.query(out.x, out.z, -1, q);
      expect(q.d).toBeCloseTo(lat, 0);
      expect(Math.abs(q.s - s)).toBeLessThan(1.5);
    }
  });
  it('hinted queries match global queries', () => {
    const a = newQuery(), b = newQuery(); const out = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
    track.pointAt(1234, 3, out);
    track.query(out.x, out.z, -1, a);
    track.query(out.x, out.z, a.i - 3, b);
    expect(b.i).toBe(a.i);
  });
  it('speed profile is slower in corners and always brakeable', () => {
    const v = track.speedProfile(70, k => (k > 1e-4 ? Math.sqrt(24 / k) : 70), 30);
    for (let i = 0; i < track.n; i++) {
      const next = v[track.wrap(i + 1)];
      expect(v[i]).toBeLessThanOrEqual(Math.sqrt(next * next + 2 * 30 * track.spacing) + 0.01);
    }
    expect(Math.min(...v)).toBeLessThan(45);
    expect(Math.max(...v)).toBeGreaterThan(65);
  });
});
