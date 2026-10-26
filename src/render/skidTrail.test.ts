import { describe, expect, it } from 'vitest';
import { SKID, SkidTrail } from './skidTrail';

/** Drives a wheel along a path at fixed 60 fps and collects every stamped segment. */
function run(path: (t: number) => [number, number], seconds: number): { x: number; z: number; heading: number; length: number }[] {
  const t = new SkidTrail(); const out: { x: number; z: number; heading: number; length: number }[] = [];
  for (let i = 0; i <= seconds * 60; i++) { const [x, z] = path(i / 60); const s = t.update(x, z); if (s) out.push({ ...s }); }
  return out;
}

describe('skid trail', () => {
  it('marks point along the real path, not a fixed heading', () => {
    // travelling diagonally at 40 m/s: 30 degrees off +Z
    const a = 30 * Math.PI / 180;
    const segs = run(tt => [Math.sin(a) * 40 * tt, Math.cos(a) * 40 * tt], 1);
    expect(segs.length).toBeGreaterThan(5);
    for (const s of segs) expect(s.heading).toBeCloseTo(a, 5);
  });

  it('covers the whole path with no gaps at any speed', () => {
    for (const v of [15, 30, 45, 62]) {
      const segs = run(tt => [0, v * tt], 2);
      // sort along z and check each segment starts before the previous one ends
      segs.sort((p, q) => p.z - q.z);
      for (let i = 1; i < segs.length; i++) {
        const prevEnd = segs[i - 1].z + segs[i - 1].length / 2, thisStart = segs[i].z - segs[i].length / 2;
        expect(thisStart).toBeLessThanOrEqual(prevEnd + 1e-6);
      }
    }
  });

  it('uses fewer marks per second when slow (distance based, not timer based)', () => {
    const slow = run(tt => [0, 10 * tt], 2).length, fast = run(tt => [0, 60 * tt], 2).length;
    expect(fast).toBeGreaterThan(slow * 3);
    expect(fast / 2).toBeLessThan(60 / SKID.spacing + 1); // never more than one mark per `spacing` metres
  });

  it('starts a fresh line after reset and after a teleport', () => {
    const t = new SkidTrail();
    expect(t.update(0, 0)).toBeNull();
    expect(t.update(0, 5)).not.toBeNull();
    t.reset();
    expect(t.update(100, 100)).toBeNull(); // would be a 100 m streak if it joined the old line
    expect(t.update(100, 100 + SKID.spacing + 0.1)).not.toBeNull();
    expect(t.update(500, 500)).toBeNull(); // respawn jump larger than maxGap
  });
});
