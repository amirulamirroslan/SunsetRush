import { describe, expect, it } from 'vitest';
import { collideTrack, createCar, newInput, placeCar, stepCar, type CarState } from './carPhysics';
import { Track } from './Track';

const track = new Track();
const FIXED_DT = 1 / 120;

/** A car at `speed` riding the right-hand wall with its nose `deg` degrees into it. */
function atWall(speed: number, deg: number, isPlayer = true): CarState {
  const p = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
  track.pointAt(60, 0, p);
  const c = createCar(0, isPlayer); placeCar(c, p.x, p.y, p.z, p.heading, speed); track.query(c.x, c.z, -1, c.tq);
  const rx = -c.tq.tz, rz = c.tq.tx, lim = track.wallOffset - 0.4 - 1.0;
  c.x += rx * (lim - 0.05); c.z += rz * (lim - 0.05);
  const h = p.heading - deg * Math.PI / 180; c.heading = h; c.vx = Math.sin(h) * speed; c.vz = Math.cos(h) * speed;
  return c;
}
function run(c: CarState, seconds: number): { scrapes: number; walls: number } {
  const inp = newInput(); inp.throttle = 1; let scrapes = 0, walls = 0;
  for (let i = 0; i < seconds * 120; i++) {
    stepCar(c, inp, FIXED_DT, false); collideTrack(c, track);
    for (const e of c.events) { if (e === 'scrape') scrapes++; if (e === 'wall') walls++; }
    c.events.length = 0;
  }
  return { scrapes, walls };
}

describe('wall scrape feedback', () => {
  it('a light scrape produces rate-limited scrape events (it used to be silent) and no wall hit', () => {
    const c = atWall(45, 2);
    const r = run(c, 1.5);
    expect(r.walls).toBe(0);
    expect(r.scrapes).toBeGreaterThanOrEqual(1);
    expect(r.scrapes).toBeLessThanOrEqual(1.5 / 0.12 + 1);
    expect(c.scrape).toBeGreaterThan(0.5);
  });

  it('is feedback only: the speed lost to the same scrape is unchanged from before this pass', () => {
    const c = atWall(45, 2);
    run(c, 1.5);
    // measured on the pre-change code: 45 -> 37.0 m/s
    expect(c.speed).toBeGreaterThan(36);
    expect(c.speed).toBeLessThan(38);
  });

  it('does not double up with the hard-hit event, and rivals never emit events', () => {
    const hard = atWall(55, 25);
    const r = run(hard, 0.3);
    expect(r.walls).toBe(1);
    expect(r.scrapes).toBe(0); // the wall event starts the cooldown
    const rival = atWall(45, 2, false);
    expect(run(rival, 1.5)).toEqual({ scrapes: 0, walls: 0 });
  });
});
