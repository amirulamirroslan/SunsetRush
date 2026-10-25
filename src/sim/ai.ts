import { clamp, angleDiff } from './math';
import { PHYS, cornerSpeed, type CarInput, type CarState, newInput } from './carPhysics';
import type { Track } from './Track';
import type { Difficulty } from './rewards';

export interface Obstacle {
  id: number; kind: 'cone' | 'barrel';
  x: number; z: number; y: number; r: number;
  /** cones only: knocked over by a car */
  hit: boolean; kx: number; kz: number; spin: number; age: number;
  s: number; lat: number;
}

const SKILL: Record<Difficulty, [number, number]> = { easy: [0.72, 0.8], normal: [0.84, 0.91], hard: [0.93, 0.985] };

/** Shared per-track speed profile used by all rivals (the same limits a human driver faces). */
export function buildAiProfile(track: Track): Float32Array {
  return track.speedProfile(PHYS.maxSpeed, k => cornerSpeed(k, 0.8), 30);
}

/** Rival driver: pure-pursuit steering along a personal racing line, speed from the corner profile, light avoidance. */
export class AIDriver {
  readonly input: CarInput = newInput();
  private lane: number;
  private laneTarget: number;
  private boostHold = 0;
  private readonly skill: number;
  private readonly preferredLane: number;
  private wobble: number;

  constructor(private readonly track: Track, private readonly profile: Float32Array, difficulty: Difficulty, seed: number) {
    const [lo, hi] = SKILL[difficulty];
    const u = ((Math.sin(seed * 91.7) + 1) / 2 + seed * 0.37) % 1;
    this.skill = lo + (hi - lo) * u;
    this.preferredLane = ((seed % 5) - 2) * 1.5;
    this.lane = this.laneTarget = this.preferredLane;
    this.wobble = seed * 1.7;
  }

  update(car: CarState, dt: number, cars: readonly CarState[], obstacles: readonly Obstacle[], rubber: number, racing: boolean): CarInput {
    const t = this.track, inp = this.input;
    if (!racing) { inp.throttle = 0; inp.brake = 1; inp.steer = 0; inp.boost = false; inp.handbrake = false; return inp; }
    const speed = Math.max(0, car.speed);
    const s = car.tq.s;
    const look = 10 + speed * 0.5;

    // ---- lane choice: inside of the upcoming bend, personal preference, avoid obstacles & cars ahead
    const ia = t.wrap(Math.round((s + look * 1.5) / t.spacing));
    const k = t.curvature[ia];
    let want = this.preferredLane;
    want += clamp(-Math.sign(k) * Math.abs(k) * 70, -3.2, 3.2) * 0.6;
    for (const o of obstacles) {
      if (o.hit) continue;
      let ds = o.s - s; if (ds < -t.length / 2) ds += t.length; if (ds > t.length / 2) ds -= t.length;
      if (ds > -2 && ds < 28 + speed * 1.1 && Math.abs(o.lat - this.lane) < (o.kind === 'barrel' ? 3.2 : 2.3)) want = o.lat > 0 ? Math.min(want, o.lat - 3.6) : Math.max(want, o.lat + 3.6);
    }
    for (const o of cars) {
      if (o === car) continue;
      let ds = o.tq.s - s; if (ds < -t.length / 2) ds += t.length; if (ds > t.length / 2) ds -= t.length;
      if (ds > 0 && ds < 14 && Math.abs(o.tq.d - this.lane) < 2.6) want = o.tq.d > 0 ? o.tq.d - 3.2 : o.tq.d + 3.2;
    }
    const maxLane = t.halfWidth - 2.4;
    this.laneTarget = clamp(want, -maxLane, maxLane);
    this.lane += clamp(this.laneTarget - this.lane, -7 * dt, 7 * dt);

    // ---- steering (pure pursuit; right = positive)
    const sp = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
    t.pointAt(s + look, this.lane, sp);
    const desired = Math.atan2(sp.x - car.x, sp.z - car.z);
    const err = angleDiff(car.heading, desired);
    let steer = clamp(-err * 2.2, -1, 1);
    // keep the nose pointing along the car's travel when sliding (lets the AI recover quickly)
    steer = clamp(steer + (-car.slip * 0.02), -1, 1);
    inp.steer = steer;

    // ---- speed
    this.wobble += dt;
    const idx = t.wrap(Math.round((s + speed * 0.25) / t.spacing));
    const target = this.profile[idx] * this.skill * (1 + rubber) * (1 + 0.012 * Math.sin(this.wobble * 0.7));
    const over = speed - target;
    if (over > 1.5) { inp.throttle = 0; inp.brake = clamp(over / 9, 0, 1); }
    else { inp.throttle = speed < target ? 1 : 0.35; inp.brake = 0; }
    if (Math.abs(err) > 0.9 && speed > 18) { inp.throttle *= 0.4; }

    // ---- boost on clear straights
    inp.handbrake = false;
    if (this.boostHold > 0) { this.boostHold -= dt; inp.boost = true; }
    else {
      inp.boost = false;
      const kAhead = Math.max(Math.abs(t.curvature[ia]), Math.abs(t.curvature[t.wrap(ia + 20)]), Math.abs(t.curvature[t.wrap(ia + 40)]));
      if (car.boostMeter > 0.5 && kAhead < 0.0025 && over < -4 && Math.abs(err) < 0.1) this.boostHold = 1.6;
    }
    return inp;
  }
}
