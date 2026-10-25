import { clamp, damp, lerp, smoothstep, angleDiff } from './math';
import { newQuery, type Track, type TrackQuery } from './Track';

/**
 * Arcade car model. One shared tuning for every vehicle (cosmetics never change handling), applied equally to the player
 * and the rivals. Works on a flat 2-D plane (heading + velocity) and reads the height from the track.
 *
 * Conventions: heading 0 faces +Z; forward = (sin h, cos h); "right" = (-cos h, sin h). Increasing heading turns LEFT.
 */
/** The barrier's inner face sits this far inside `wallOffset` (metres). The renderer uses the same number. */
export const BARRIER_FACE = 0.4;

export const PHYS = {
  maxSpeed: 62,        // m/s  (~223 km/h)
  boostSpeed: 80,      // m/s
  accel: 27,
  boostAccelMul: 1.7,
  brakeDecel: 46,
  reverseMax: 12,
  coast: 2.6,
  drag: 0.0008,
  gripNormal: 10,
  gripDrift: 3.3,
  gripOffRoad: 5.5,
  boostDrain: 0.30,    // meter per second while boosting
  boostMeterStart: 0.35,
  driftMeterGain: 0.11,
  padBoost: 1.6,       // seconds of free boost from a pad
  driftTierTimes: [0.8, 1.8, 3.2],
  driftTierBoost: [0.65, 1.15, 1.8],
  carHalfWidth: 1.0,
  carRadius: 1.05,
  carOffset: 1.05,
} as const;

export interface CarInput {
  /** 0..1 */ throttle: number;
  /** 0..1 */ brake: number;
  /** -1 (left) .. +1 (right) */ steer: number;
  handbrake: boolean;
  boost: boolean;
}
export const newInput = (): CarInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false });

export type CarEvent = 'driftStart' | 'driftTier' | 'miniTurbo' | 'boostStart' | 'wall' | 'scrape' | 'car' | 'cone' | 'barrel' | 'pad' | 'respawn';

export interface CarState {
  id: number;
  isPlayer: boolean;
  x: number; y: number; z: number;
  /** state at the start of the latest fixed step, for render interpolation */
  px: number; py: number; pz: number; pheading: number;
  heading: number;
  vx: number; vz: number;
  yawRate: number;
  /** forward speed (m/s, signed) and lateral slip speed after the last step */
  speed: number; slip: number;
  steerVis: number;
  boostMeter: number; boostTimer: number; boosting: boolean;
  drifting: boolean; driftDir: number; driftTime: number; driftTier: number;
  offRoad: boolean; onKerb: boolean;
  /** impact strength (m/s) of the last wall hit; decays — used for effects */
  impact: number;
  /** outward speed (m/s) of the latest light wall scrape, and the cooldown that rate-limits `scrape` events (feedback only) */
  scrape: number; scrapeTimer: number;
  braking: boolean;
  tq: TrackQuery;
  /** accumulated distance around the lap system: lap = floor(progress / length) + 1 */
  progress: number;
  lastS: number;
  /** completed laps */
  lap: number;
  padCooldown: number;
  wrongWay: number;
  stuck: number;
  finished: boolean; finishTime: number;
  lapTimes: number[]; lapStart: number;
  stats: { driftSeconds: number; hits: number; boostPads: number; topSpeed: number };
  events: CarEvent[];
  invulnerable: number;
}

export function createCar(id: number, isPlayer: boolean): CarState {
  return {
    id, isPlayer, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, pheading: 0, heading: 0, vx: 0, vz: 0, yawRate: 0, speed: 0, slip: 0, steerVis: 0,
    boostMeter: PHYS.boostMeterStart, boostTimer: 0, boosting: false,
    drifting: false, driftDir: 0, driftTime: 0, driftTier: 0, offRoad: false, onKerb: false, impact: 0, scrape: 0, scrapeTimer: 0, braking: false,
    tq: newQuery(), progress: 0, lastS: 0, padCooldown: 0, wrongWay: 0, stuck: 0, lap: 0, finished: false, finishTime: 0, lapTimes: [], lapStart: 0,
    stats: { driftSeconds: 0, hits: 0, boostPads: 0, topSpeed: 0 }, events: [], invulnerable: 0,
  };
}

export const emit = (c: CarState, e: CarEvent): void => { if (c.isPlayer) c.events.push(e); };

/** Steering authority (rad/s at full lock) for a given forward speed: nimble when slow, stable when fast. */
export const yawMaxAt = (speed: number): number => lerp(2.5, 0.85, smoothstep(5, 60, Math.abs(speed)));

/** The speed at which a corner of curvature `k` (1/m) can still be taken at `usage` of full steering lock. */
export function cornerSpeed(k: number, usage = 0.82): number {
  if (k < 1e-4) return PHYS.boostSpeed;
  let lo = 4, hi: number = PHYS.maxSpeed;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (mid * k <= yawMaxAt(mid) * usage) lo = mid; else hi = mid;
  }
  return lo;
}

export function placeCar(c: CarState, x: number, y: number, z: number, heading: number, speed = 0): void {
  c.x = x; c.y = y; c.z = z; c.heading = heading;
  c.vx = Math.sin(heading) * speed; c.vz = Math.cos(heading) * speed;
  c.yawRate = 0; c.speed = speed; c.slip = 0; c.drifting = false; c.driftTime = 0; c.driftTier = 0; c.boosting = false; c.boostTimer = 0;
  c.impact = 0; c.steerVis = 0; c.px = x; c.py = y; c.pz = z; c.pheading = heading;
}

/** Advances one car by a fixed step. `grip` is false while the race is locked (grid / countdown). */
export function stepCar(c: CarState, inp: CarInput, dt: number, locked: boolean): void {
  const hs = Math.sin(c.heading), hc = Math.cos(c.heading);
  let vf = c.vx * hs + c.vz * hc;
  let vr = c.vx * -hc + c.vz * hs;
  const sp = Math.abs(vf);
  const throttle = locked ? 0 : clamp(inp.throttle, 0, 1);
  const brake = locked ? 1 : clamp(inp.brake, 0, 1);
  const steer = locked ? 0 : clamp(inp.steer, -1, 1);

  // ---- drift state machine
  const wantDrift = inp.handbrake && !locked;
  if (!c.drifting && wantDrift && sp > 16 && Math.abs(steer) > 0.25 && !c.offRoad) {
    c.drifting = true; c.driftDir = Math.sign(steer); c.driftTime = 0; c.driftTier = 0;
    emit(c, 'driftStart');
  }
  if (c.drifting) {
    if (!wantDrift || sp < 12 || c.offRoad) {
      if (c.driftTier > 0) {
        c.boostTimer += PHYS.driftTierBoost[c.driftTier - 1];
        emit(c, 'miniTurbo');
      }
      c.drifting = false; c.driftTime = 0; c.driftTier = 0;
    } else {
      const inward = clamp(steer * c.driftDir, 0, 1);
      c.driftTime += dt * (0.7 + 0.3 * inward);
      c.stats.driftSeconds += dt;
      c.boostMeter = Math.min(1, c.boostMeter + PHYS.driftMeterGain * dt);
      let tier = 0; for (let i = 0; i < 3; i++) if (c.driftTime >= PHYS.driftTierTimes[i]) tier = i + 1;
      if (tier > c.driftTier) { c.driftTier = tier; emit(c, 'driftTier'); }
    }
  }

  // ---- boost
  let boostPower = 0;
  const wasBoosting = c.boosting;
  if (!locked && inp.boost && c.boostMeter > 0.001) { c.boostMeter = Math.max(0, c.boostMeter - PHYS.boostDrain * dt); boostPower = 1; }
  if (c.boostTimer > 0) { c.boostTimer = Math.max(0, c.boostTimer - dt); boostPower = 1; }
  c.boosting = boostPower > 0;
  if (c.boosting && !wasBoosting) emit(c, 'boostStart');
  if (!c.boosting && !locked) c.boostMeter = Math.min(1, c.boostMeter + 0.012 * dt);

  // ---- longitudinal
  const surface = c.offRoad ? 0.62 : 1;
  const vmax = (boostPower ? PHYS.boostSpeed : PHYS.maxSpeed) * surface;
  const thr = boostPower ? 1 : throttle;
  if (thr > 0) {
    const ratio = clamp(vf / vmax, 0, 1);
    vf += PHYS.accel * (1 + boostPower * (PHYS.boostAccelMul - 1)) * thr * (1 - ratio * ratio) * dt * (c.offRoad ? 0.75 : 1);
  }
  c.braking = false;
  if (brake > 0 && !boostPower) {
    if (vf > 1) { vf = Math.max(0, vf - PHYS.brakeDecel * brake * dt); c.braking = true; }
    else if (!locked) { vf = Math.max(-PHYS.reverseMax, vf - 14 * brake * dt); c.braking = true; }
  } else if (wantDrift && !c.drifting && vf > 1) vf = Math.max(0, vf - 14 * dt); // handbrake without a drift scrubs speed
  if (thr === 0 && brake === 0 && vf > 0) vf = Math.max(0, vf - (PHYS.coast + PHYS.drag * vf * vf) * dt);
  if (vf > vmax) vf -= (vf - vmax) * Math.min(1, 2.2 * dt);
  if (c.offRoad && vf > 0) vf -= 3.5 * dt;

  // ---- steering → yaw rate
  const dirSign = vf < -0.5 ? -1 : 1;
  const auth = clamp(sp / 5, 0, 1);
  const yawMax = yawMaxAt(sp);
  let yawTarget: number;
  if (c.drifting) {
    const inward = steer * c.driftDir; // -1..1
    yawTarget = -c.driftDir * yawMax * 1.2 * (0.72 + 0.4 * inward);
  } else yawTarget = -steer * yawMax * auth * dirSign;
  c.yawRate += (yawTarget - c.yawRate) * damp(c.drifting ? 7 : 11, dt);
  c.heading += c.yawRate * dt;
  c.steerVis += (steer - c.steerVis) * damp(14, dt);

  // ---- grip: rotate the velocity into the new heading, then bleed lateral slip
  const ns = Math.sin(c.heading), nc = Math.cos(c.heading);
  vr = c.vx * -nc + c.vz * ns; // lateral part relative to the *new* heading
  const vfNew = c.vx * ns + c.vz * nc;
  // vf was modified by forces above; keep its change
  const dvf = vf - (c.vx * hs + c.vz * hc);
  vf = vfNew + dvf;
  const grip = c.drifting ? PHYS.gripDrift : c.offRoad ? PHYS.gripOffRoad : PHYS.gripNormal;
  const slipLoss = Math.abs(vr) * (c.drifting ? 0.1 : 0.3) * dt;
  vr *= Math.exp(-grip * dt);
  if (vf > 0) vf = Math.max(0, vf - slipLoss * (vr * vr > 400 ? 1.5 : 1));

  c.vx = ns * vf - nc * vr;
  c.vz = nc * vf + ns * vr;
  c.x += c.vx * dt; c.z += c.vz * dt;
  c.speed = vf; c.slip = vr;
  if (vf > c.stats.topSpeed) c.stats.topSpeed = vf;
  c.impact = Math.max(0, c.impact - 18 * dt);
  if (c.invulnerable > 0) c.invulnerable -= dt;
  if (c.scrapeTimer > 0) c.scrapeTimer -= dt;
}

/** Keeps a car inside the barriers, updates surface flags and height. Returns nothing; sets `impact` and emits events. */
export function collideTrack(c: CarState, track: Track): void {
  track.query(c.x, c.z, c.tq.i, c.tq);
  const q = c.tq;
  const rx = -q.tz, rz = q.tx; // right normal
  const limit = track.wallOffset - BARRIER_FACE - PHYS.carHalfWidth;
  const ad = Math.abs(q.d);
  c.offRoad = ad > track.halfWidth + track.kerb;
  c.onKerb = ad > track.halfWidth - 0.2 && !c.offRoad;
  if (ad > limit) {
    const sgn = Math.sign(q.d);
    const pen = ad - limit;
    c.x -= rx * sgn * pen; c.z -= rz * sgn * pen;
    const vn = (c.vx * rx + c.vz * rz) * sgn; // outward speed
    if (vn > 0) {
      const e = 0.22;
      c.vx -= (1 + e) * vn * rx * sgn; c.vz -= (1 + e) * vn * rz * sgn;
      // scrape: lose some along-wall speed, scaled by how square-on the hit was
      const scrape = clamp(vn / 30, 0, 0.4) * 0.5;
      c.vx *= 1 - scrape; c.vz *= 1 - scrape;
      // nudge the nose to run along the wall (not for head-on hits)
      const hd = angleDiff(c.heading, Math.atan2(q.tx, q.tz));
      const along = Math.abs(hd) < Math.PI / 2 ? hd : angleDiff(c.heading, Math.atan2(-q.tx, -q.tz));
      c.heading += clamp(along, -0.5, 0.5) * clamp(vn / 12, 0, 1) * 0.35;
      if (vn > 3 && c.invulnerable <= 0) { c.impact = Math.max(c.impact, vn); c.stats.hits++; emit(c, 'wall'); c.invulnerable = 0.25; c.scrapeTimer = Math.max(c.scrapeTimer, 0.2); }
      // lighter contact still costs speed (above), so it must be seen and heard: rate-limited, player-only event, no physics change
      else if (vn > 0.5 && c.scrapeTimer <= 0) { c.scrape = vn; c.scrapeTimer = 0.12; emit(c, 'scrape'); }
      if (c.drifting && vn > 6) c.driftTier = 0;
    }
  }
  c.y = q.y;
}
