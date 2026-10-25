import { describe, expect, it } from 'vitest';
import { FIXED_DT, RaceSim } from './RaceSim';
import type { Difficulty } from './rewards';

/** Headless racing-quality benchmark: how the field spreads out, how often positions change, and how rough the rivals are. */
export function benchmark(difficulty: Difficulty, laps = 3): { finish: number[]; spread: number; rivalSpread: number; posChanges: number; rivalHits: number; bestLap: number; maxGap: number } {
  const sim = new RaceSim({ laps, difficulty, cars: 6, playerSlot: 4 });
  sim.autopilot = true; // the autopilot is a stand-in for a competent human
  let steps = 0, posChanges = 0, prev = [...sim.ranks], maxGap = 0;
  while (!sim.allFinished && steps < 120 * 500) {
    sim.step(FIXED_DT); steps++;
    if (sim.stage === 'racing') {
      for (let i = 0; i < prev.length; i++) if (sim.ranks[i] !== prev[i]) posChanges++;
      prev = [...sim.ranks];
      if (steps % 120 === 0) { const p = sim.cars.map(c => c.progress); maxGap = Math.max(maxGap, Math.max(...p) - Math.min(...p)); }
    }
  }
  const finish = sim.cars.map(c => c.finishTime);
  const rivals = finish.slice(1);
  return {
    finish, spread: Math.max(...finish) - Math.min(...finish), rivalSpread: Math.max(...rivals) - Math.min(...rivals), posChanges,
    rivalHits: sim.cars.slice(1).reduce((n, c) => n + c.stats.hits, 0), bestLap: Math.min(...sim.cars.slice(1).flatMap(c => c.lapTimes)), maxGap,
  };
}

describe('racing quality (headless, autopilot as the player)', () => {
  it('every difficulty finishes cleanly', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const b = benchmark(d, 2);
      expect(b.finish.every(t => t > 0)).toBe(true);
    }
  });
  it('strings the field out on normal instead of running a convoy, without changing rival pace much', () => {
    const e = benchmark('easy', 3), n = benchmark('normal', 3), h = benchmark('hard', 3);
    // rivals finish apart from each other (the old build finished all six within 0.9 s on normal)
    expect(n.rivalSpread).toBeGreaterThan(2.5);
    expect(n.rivalSpread).toBeLessThan(12);
    // ...but nobody is left stranded: the biggest gap between first and last car stays within ~9 s of road
    expect(n.maxGap).toBeLessThan(450);
    // difficulty still orders the pace (best rival lap)
    expect(e.bestLap).toBeGreaterThan(n.bestLap * 1.05);
    expect(h.bestLap).toBeLessThan(n.bestLap);
    // and rivals are not a demolition derby: a handful of wall contacts per race across five cars
    for (const b of [e, n, h]) expect(b.rivalHits).toBeLessThan(25);
  });
});
