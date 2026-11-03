import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { ATMOSPHERES, DAYLIGHT, DEFAULT_ATMOSPHERE, GOLDEN_HOUR, OVERCAST, resolveAtmosphere, sunElevationDeg } from './atmosphere';

const hsl = (hex: number): { h: number; s: number; l: number } => { const o = { h: 0, s: 0, l: 0 }; new Color(hex).getHSL(o); return o; };
/** hue in degrees; orange/pink/purple band = 0..40 and 270..360 */
const sunsetHue = (hex: number): boolean => { const { h, s } = hsl(hex); const d = h * 360; return s > 0.35 && (d < 40 || d > 270); };

describe('lighting presets', () => {
  it('defaults to natural daylight, never sunset', () => {
    expect(DEFAULT_ATMOSPHERE).toBe(DAYLIGHT);
    expect(resolveAtmosphere()).toBe(DAYLIGHT);
    expect(resolveAtmosphere('nonsense')).toBe(DAYLIGHT);
    expect(resolveAtmosphere('golden')).toBe(GOLDEN_HOUR);
  });

  it('daylight has a high sun and a blue sky with no orange/pink/purple anywhere in the atmosphere', () => {
    expect(sunElevationDeg(DAYLIGHT)).toBeGreaterThan(35);
    for (const hex of [DAYLIGHT.fog, DAYLIGHT.sky.zenith, DAYLIGHT.sky.mid, DAYLIGHT.sky.low, DAYLIGHT.sky.horizon, DAYLIGHT.hemiSky, DAYLIGHT.mist]) expect(sunsetHue(hex)).toBe(false);
    const zenith = hsl(DAYLIGHT.sky.zenith); expect(zenith.h * 360).toBeGreaterThan(200); expect(zenith.h * 360).toBeLessThan(240);
    expect(hsl(DAYLIGHT.sunColor).l).toBeGreaterThan(0.8);
  });

  it('every preset is a valid, distinct lighting set-up', () => {
    const ids = new Set<string>();
    for (const a of Object.values(ATMOSPHERES)) {
      ids.add(a.id);
      expect(a.sunDir.length()).toBeCloseTo(1, 5);
      expect(a.sunDir.y).toBeGreaterThan(0);
      expect(a.sunIntensity).toBeGreaterThan(0); expect(a.exposure).toBeGreaterThan(0.5); expect(a.exposure).toBeLessThan(1.6);
      expect(a.fogDensity).toBeGreaterThan(0); expect(a.fogDensity).toBeLessThan(0.002);
      expect(a.vignette).toBeGreaterThanOrEqual(0); expect(a.vignette).toBeLessThanOrEqual(0.6);
    }
    expect(ids.size).toBe(Object.keys(ATMOSPHERES).length);
    expect(sunElevationDeg(GOLDEN_HOUR)).toBeLessThan(20);
    expect(OVERCAST.clouds.cover).toBeGreaterThan(DAYLIGHT.clouds.cover);
    expect(OVERCAST.sunIntensity).toBeLessThan(DAYLIGHT.sunIntensity);
  });
});
