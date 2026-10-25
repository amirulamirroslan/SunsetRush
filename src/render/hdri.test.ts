import { describe, expect, it } from 'vitest';
import { Euler, Vector3 } from 'three';
import { alignRotationY, brightestAzimuth } from './hdri';

/** A dark 64x32 float equirect with one bright texel at column `cx`, row `cy`. */
const sky = (cx: number, cy: number): Float32Array => {
  const w = 64, h = 32, d = new Float32Array(w * h * 4).fill(0.01);
  const k = (cy * w + cx) * 4; d[k] = d[k + 1] = d[k + 2] = 50; d[k + 3] = 1;
  return d;
};
const az = (v: Vector3): number => Math.atan2(v.z, v.x);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

describe('car environment alignment', () => {
  it('finds the sun column as an azimuth', () => {
    expect(brightestAzimuth(sky(32, 20), 64, 32, false)).toBeCloseTo(((32.5 / 64) - 0.5) * Math.PI * 2, 6);
    expect(brightestAzimuth(sky(8, 20), 64, 32, false)).toBeLessThan(0);
    expect(brightestAzimuth(sky(56, 20), 64, 32, false)).toBeGreaterThan(0);
  });
  it('rotating the environment puts the HDRI sun where the scene sun is', () => {
    for (const [hdri, scene] of [[0.4, -2.1], [-3.0, 1.2], [2.5, 2.5], [-0.7, 0.9]]) {
      const theta = alignRotationY(scene, hdri);
      // the shader samples the environment at R(theta) * worldDirection; the world sun direction must land on the HDRI sun
      const sampled = new Vector3(Math.cos(scene), 0, Math.sin(scene)).applyEuler(new Euler(0, theta, 0));
      expect(wrap(az(sampled) - hdri)).toBeCloseTo(0, 6);
    }
  });
});
