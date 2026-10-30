import { describe, expect, it } from 'vitest';
import { canDismiss, ctaText, progressPercent, shouldSkipSplash, starField } from './splashLogic';

describe('splash skip rules', () => {
  it('shows the splash for a normal visit', () => { expect(shouldSkipSplash('', false)).toBe(false); expect(shouldSkipSplash('?q=low', false)).toBe(false); });
  it('is skipped with ?nosplash and ?debug (the e2e and screenshot tools use ?debug)', () => {
    expect(shouldSkipSplash('?nosplash', false)).toBe(true); expect(shouldSkipSplash('?debug&q=low', false)).toBe(true);
  });
  it('is skipped for automated browsers', () => { expect(shouldSkipSplash('', true)).toBe(true); });
});

describe('splash prompt and phases', () => {
  it('words the prompt for touch and keyboard', () => { expect(ctaText(true)).toBe('Tap to start'); expect(ctaText(false)).toBe('Press any key'); });
  it('only lets the player dismiss once loaded and after the short guard time', () => {
    expect(canDismiss('loading', 5000)).toBe(false);
    expect(canDismiss('ready', 100, 350)).toBe(false);
    expect(canDismiss('ready', 400, 350)).toBe(true);
    expect(canDismiss('leaving', 5000)).toBe(false);
  });
  it('clamps the progress percentage', () => {
    expect(progressPercent(0.426)).toBe(43); expect(progressPercent(-1)).toBe(0); expect(progressPercent(7)).toBe(100); expect(progressPercent(Number.NaN)).toBe(0);
  });
});

describe('star field', () => {
  it('is deterministic and respects its bounds', () => {
    const a = starField(46), b = starField(46), c = starField(46, 99);
    expect(a.length).toBe(46);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a) === JSON.stringify(c)).toBe(false);
    for (const s of a) { expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThan(100); expect(s.y).toBeLessThan(52); expect(s.size).toBeGreaterThan(0); expect(s.delay).toBeLessThan(4); expect(s.dur).toBeGreaterThan(1.99); }
  });
});
