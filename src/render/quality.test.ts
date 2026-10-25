import { describe, expect, it } from 'vitest';
import { PerfGovernor, TIERS, initialTier } from './quality';

describe('quality tiers', () => {
  it('picks sensible starting tiers', () => {
    expect(initialTier({ touch: false, cores: 12, memoryGb: 16, width: 1920, height: 1080, devicePixelRatio: 1 })).toBe('high');
    expect(initialTier({ touch: true, cores: 8, memoryGb: 6, width: 390, height: 844, devicePixelRatio: 3 })).toBe('medium');
    expect(initialTier({ touch: true, cores: 4, memoryGb: 2, width: 390, height: 844, devicePixelRatio: 2 })).toBe('low');
    expect(initialTier({ touch: false, width: 1, height: 1 }, 'low')).toBe('low');
    expect(initialTier({ touch: false, width: 1, height: 1 }, 'bogus')).toBe('high');
  });
  it('tiers get strictly cheaper', () => {
    expect(TIERS.high.shadowMap).toBeGreaterThan(TIERS.medium.shadowMap);
    expect(TIERS.medium.shadowMap).toBeGreaterThan(TIERS.low.shadowMap);
    expect(TIERS.high.scenery).toBeGreaterThan(TIERS.low.scenery);
  });
  it('governor leaves a healthy frame rate alone and ignores warm-up hitches', () => {
    const g = new PerfGovernor('high', 2);
    for (let i = 0; i < 2000; i++) expect(g.update(1 / 60)).toBeNull();
    const slow = new PerfGovernor('high', 2);
    for (let i = 0; i < 100; i++) slow.update(0.2); // first 3 s ignored
    expect(slow.tier).toBe('high');
  });
  it('governor lowers resolution first, then the tier, and never goes up', () => {
    const g = new PerfGovernor('high', 2);
    const actions: string[] = [];
    for (let i = 0; i < 4000; i++) { const a = g.update(1 / 20); if (a) actions.push(`${a.kind}:${a.value}`); }
    expect(actions[0]).toBe('pixelRatio:1.75');
    expect(actions.some(a => a === 'tier:medium')).toBe(true);
    expect(g.tier).toBe('low');
    expect(g.pixelRatio).toBeGreaterThanOrEqual(0.7);
  });
});
