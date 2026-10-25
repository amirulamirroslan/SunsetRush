import { describe, expect, it } from 'vitest';
import { Track } from '../sim/Track';
import { findCorners, findStraights } from './trackside';
import { ISLAND, naturalHeight } from './terrainField';

const track = new Track();

describe('trackside placement', () => {
  it('finds well-separated tight corners in lap order', () => {
    const c = findCorners(track, 0.011, 160);
    expect(c.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < c.length; i++) {
      expect(c[i].s).toBeGreaterThanOrEqual(0); expect(c[i].s).toBeLessThan(track.length);
      expect(Math.abs(c[i].k)).toBeGreaterThanOrEqual(0.011);
      if (i) expect(c[i].s).toBeGreaterThan(c[i - 1].s);
    }
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
      const d = Math.abs(c[i].s - c[j].s);
      expect(Math.min(d, track.length - d)).toBeGreaterThan(160);
    }
  });

  it('only reports straights whose whole window is calm, and honours the avoid ranges', () => {
    const maxK = 0.0042, len = 60;
    const spots = findStraights(track, len, maxK, [[-80, 300]]);
    expect(spots.length).toBeGreaterThan(0);
    const half = Math.round(len / 2 / track.spacing);
    for (const s of spots) {
      expect(s).toBeGreaterThanOrEqual(300);
      const i = Math.round(s / track.spacing);
      for (let o = -half; o <= half; o++) expect(Math.abs(track.curvature[track.wrap(i + o)])).toBeLessThanOrEqual(maxK);
    }
  });
});

describe('terrain relief', () => {
  it('is finite, deterministic and bounded over the island', () => {
    let hi = -Infinity, lo = Infinity;
    for (let x = -700; x <= 800; x += 37) for (let z = -700; z <= 330; z += 37) {
      const h = naturalHeight(x, z); expect(Number.isFinite(h)).toBe(true);
      expect(naturalHeight(x, z)).toBe(h);
      hi = Math.max(hi, h); lo = Math.min(lo, h);
    }
    expect(hi).toBeLessThan(110); expect(lo).toBeGreaterThan(-40);
  });

  it('leaves the open sea and the shoreline flat (no relief outside the land)', () => {
    expect(naturalHeight(ISLAND.cx + ISLAND.rx * 1.6, ISLAND.cz)).toBeLessThanOrEqual(-8);
    expect(naturalHeight(ISLAND.cx - ISLAND.rx * 1.6, ISLAND.cz + 30)).toBeLessThanOrEqual(-8);
  });
});
