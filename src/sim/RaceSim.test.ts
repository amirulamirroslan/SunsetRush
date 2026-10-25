import { describe, expect, it } from 'vitest';
import { FIXED_DT, RaceSim } from './RaceSim';
import { PHYS, createCar, collideTrack, newInput, placeCar, stepCar } from './carPhysics';
import { Track } from './Track';
import { computeRewards, formatTime, ordinal } from './rewards';

const track = new Track();

function runUntil(sim: RaceSim, cond: () => boolean, maxSeconds: number): number {
  let t = 0;
  while (!cond() && t < maxSeconds) { sim.step(FIXED_DT); t += FIXED_DT; }
  return t;
}

describe('car physics', () => {
  const start = (): ReturnType<typeof createCar> => {
    const c = createCar(0, true); const p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
    track.pointAt(200, 0, p); placeCar(c, p.x, p.y, p.z, p.heading); track.query(c.x, c.z, -1, c.tq); return c;
  };
  it('accelerates smoothly, tops out below the boost limit and stays on the road', () => {
    const c = start(); const inp = newInput(); inp.throttle = 1;
    let prev = 0;
    for (let i = 0; i < 120 * 3; i++) { stepCar(c, inp, FIXED_DT, false); collideTrack(c, track); expect(c.speed).toBeGreaterThanOrEqual(prev - 0.01); prev = c.speed; }
    expect(c.speed).toBeGreaterThan(30);
    expect(c.speed).toBeLessThanOrEqual(PHYS.maxSpeed + 0.01);
  });
  it('brakes to a stop and can reverse', () => {
    const c = start(); const inp = newInput(); inp.throttle = 1;
    for (let i = 0; i < 120 * 4; i++) { stepCar(c, inp, FIXED_DT, false); collideTrack(c, track); }
    inp.throttle = 0; inp.brake = 1;
    for (let i = 0; i < 120 * 3; i++) { stepCar(c, inp, FIXED_DT, false); collideTrack(c, track); }
    expect(c.speed).toBeLessThan(0);
    expect(c.speed).toBeGreaterThanOrEqual(-PHYS.reverseMax - 0.01);
  });
  it('is locked on the grid', () => {
    const c = start(); const inp = newInput(); inp.throttle = 1;
    for (let i = 0; i < 240; i++) stepCar(c, inp, FIXED_DT, true);
    expect(Math.abs(c.speed)).toBeLessThan(0.01);
  });
  it('turns the right way and steering authority shrinks with speed', () => {
    const slow = start(), fast = start();
    slow.vx = Math.sin(slow.heading) * 10; slow.vz = Math.cos(slow.heading) * 10;
    fast.vx = Math.sin(fast.heading) * 55; fast.vz = Math.cos(fast.heading) * 55;
    const inp = newInput(); inp.steer = 1; inp.throttle = 1;
    const h0 = slow.heading;
    for (let i = 0; i < 60; i++) { stepCar(slow, inp, FIXED_DT, false); stepCar(fast, inp, FIXED_DT, false); }
    expect(slow.heading).toBeLessThan(h0);          // steering right decreases heading
    expect(Math.abs(slow.heading - h0)).toBeGreaterThan(Math.abs(fast.heading - h0)); // slower car turns faster
  });
  it('charges a drift and pays out a mini-turbo on release', () => {
    const c = start(); const inp = newInput(); inp.throttle = 1;
    for (let i = 0; i < 120 * 4; i++) { stepCar(c, inp, FIXED_DT, false); collideTrack(c, track); }
    inp.handbrake = true; inp.steer = 0.6;
    let tier = 0;
    for (let i = 0; i < 120 * 2.2; i++) { stepCar(c, inp, FIXED_DT, false); c.x = 0; c.z = 0; c.offRoad = false; tier = Math.max(tier, c.driftTier); }
    expect(c.drifting).toBe(true);
    expect(tier).toBeGreaterThanOrEqual(2);
    inp.handbrake = false;
    stepCar(c, inp, FIXED_DT, false);
    expect(c.drifting).toBe(false);
    expect(c.boostTimer).toBeGreaterThan(1);
    expect(c.events).toContain('miniTurbo');
  });
  it('boost raises the speed limit and drains the meter, with a hard limit', () => {
    const c = start(); const inp = newInput(); inp.throttle = 1; inp.boost = true; c.boostMeter = 1;
    let max = 0;
    for (let i = 0; i < 120 * 5; i++) { stepCar(c, inp, FIXED_DT, false); collideTrack(c, track); max = Math.max(max, c.speed); }
    expect(max).toBeGreaterThan(PHYS.maxSpeed);
    expect(max).toBeLessThanOrEqual(PHYS.boostSpeed + 0.01);
    expect(c.boostMeter).toBeLessThan(0.1);
  });
  it('cannot leave the barriers even when driving straight at them', () => {
    const c = start(); const inp = newInput(); inp.throttle = 1; inp.steer = 1;
    let worst = 0;
    for (let i = 0; i < 120 * 20; i++) { stepCar(c, inp, FIXED_DT, false); collideTrack(c, track); worst = Math.max(worst, Math.abs(c.tq.d)); }
    expect(worst).toBeLessThan(track.wallOffset + 0.5);
  });
  it('gives the same result whatever the render frame rate (fixed step)', () => {
    const run = (frames: number): number => {
      const sim = new RaceSim({ laps: 1, difficulty: 'normal', cars: 3, playerSlot: 0 });
      sim.playerInput.throttle = 1;
      const dtFrame = 8 / frames;
      for (let i = 0; i < frames; i++) sim.advance(dtFrame);
      return sim.playerCar.progress;
    };
    // 8 simulated seconds at 30 fps vs 144 fps
    expect(Math.abs(run(240) - run(1152))).toBeLessThan(1.0);
  });
});

describe('race simulation', () => {
  it('runs a full 3-lap race with autopilot: everyone finishes, ranks are unique, cars stay on the circuit', () => {
    const sim = new RaceSim({ laps: 3, difficulty: 'normal', cars: 6, playerSlot: 3 });
    sim.autopilot = true;
    let worst = 0;
    const t = runUntil(sim, () => { for (const c of sim.cars) worst = Math.max(worst, Math.abs(c.tq.d)); return sim.allFinished; }, 600);
    expect(sim.allFinished).toBe(true);
    expect(worst).toBeLessThan(track.wallOffset);
    const ranks = [...sim.ranks].sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6]);
    const lap = sim.cars[0].lapTimes;
    expect(lap.length).toBe(3);
    expect(Math.min(...lap)).toBeGreaterThan(45);   // a believable lap, not a shortcut
    expect(Math.max(...lap)).toBeLessThan(110);
    expect(t).toBeLessThan(400);
    // finishing order must equal rank order
    const byTime = [...sim.cars].sort((a, b) => a.finishTime - b.finishTime).map(c => c.id);
    const byRank = [...sim.cars].sort((a, b) => sim.ranks[a.id] - sim.ranks[b.id]).map(c => c.id);
    expect(byTime).toEqual(byRank);
  });
  it('rivals are tough on hard and gentler on easy', () => {
    const lapOf = (d: 'easy' | 'hard'): number => {
      const sim = new RaceSim({ laps: 2, difficulty: d, cars: 4, playerSlot: 3 });
      runUntil(sim, () => sim.cars[1].finished, 400);
      return sim.cars[1].finishTime;
    };
    expect(lapOf('hard')).toBeLessThan(lapOf('easy'));
  });
  it('counts down then releases the cars; the player finishing ends the race stage', () => {
    const sim = new RaceSim({ laps: 1, difficulty: 'easy', cars: 3, playerSlot: 2 });
    expect(sim.stage).toBe('intro');
    runUntil(sim, () => sim.stage === 'countdown', 10);
    expect(sim.countdownRemaining).toBeGreaterThan(2.5);
    runUntil(sim, () => sim.stage === 'racing', 10);
    sim.autopilot = true;
    runUntil(sim, () => sim.stage === 'finished', 300);
    expect(sim.playerPlace).toBeGreaterThanOrEqual(1);
    expect(sim.playerFinishedAt).toBeGreaterThan(30);
  });
  it('counts a lap only when the line is crossed, and not when driving backwards', () => {
    const sim = new RaceSim({ laps: 3, difficulty: 'easy', cars: 2, playerSlot: 0 });
    runUntil(sim, () => sim.stage === 'racing', 10);
    sim.playerInput.brake = 1; // reverse over the line
    runUntil(sim, () => false, 6);
    expect(sim.cars[0].lap).toBe(0);
    expect(sim.cars[0].progress).toBeLessThan(0);
  });
  it('boost pads give a free boost', () => {
    const sim = new RaceSim({ laps: 1, difficulty: 'easy', cars: 2, playerSlot: 0 });
    const car = sim.cars[0]; const p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
    sim.track.pointAt(sim.boostPads[0] - 1.5, 0, p); placeCar(car, p.x, p.y, p.z, p.heading, 30);
    track.query(car.x, car.z, -1, car.tq);
    runUntil(sim, () => false, 0.3);
    expect(car.stats.boostPads).toBeGreaterThanOrEqual(0);
    sim.stage = 'racing';
    for (let i = 0; i < 120; i++) sim.step(FIXED_DT);
    expect(car.stats.boostPads).toBe(1);
  });
});

describe('rewards', () => {
  it('itemises and totals consistently', () => {
    const r = computeRewards({ place: 1, laps: 3, difficulty: 'hard', driftSeconds: 12.4, wallHits: 0, fastestLapOfRace: true });
    expect(r.total).toBe(r.lines.reduce((a, l) => a + l.amount, 0));
    expect(r.lines.map(l => l.id)).toEqual(['laps', 'place', 'drift', 'clean', 'fastest', 'difficulty']);
    expect(r.lines.every(l => l.amount > 0)).toBe(true);
  });
  it('pays more for better places and never pays nothing', () => {
    const t = (place: number): number => computeRewards({ place, laps: 3, difficulty: 'normal', driftSeconds: 0, wallHits: 9, fastestLapOfRace: false }).total;
    expect(t(1)).toBeGreaterThan(t(2)); expect(t(2)).toBeGreaterThan(t(6)); expect(t(6)).toBeGreaterThan(0);
  });
  it('formats times and ordinals', () => {
    expect(formatTime(65.4321)).toBe('1:05.43');
    expect(formatTime(NaN)).toBe('--:--.--');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});
