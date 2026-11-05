import { buildAiProfile } from '../sim/ai';
import { angleDiff, clamp } from '../sim/math';
import { FIXED_DT, RaceSim } from '../sim/RaceSim';
import { Track } from '../sim/Track';
import { ObjectiveTracker } from './objectives';
import { observeRacing } from './telemetry';
import type { DriveObjective, DriveResult, Leg } from './types';

/**
 * A scripted "human" for tests and tools: pure-pursuit steering from the rival AI, with the speed held to a plan derived from the
 * objective. It drives the real simulation through the same player input every human uses.
 */
const KMH = 3.6;
interface Seg { from: number; to: number; kmh: number; brake?: boolean }

export function planFor(o: DriveObjective, bias = 0): Seg[] {
  const segs: Seg[] = [];
  let prevKmh = 0;
  for (const l of o.legs) {
    const part = legPlan(l, bias, prevKmh);
    segs.push(...part); prevKmh = part[0]?.kmh ?? prevKmh;
  }
  return segs.sort((a, b) => a.from - b.from);
}
function legPlan(l: Leg, bias: number, prevKmh: number): Seg[] {
  if (l.kind === 'section') {
    let kmh = 150;
    if (l.minAvgKmh !== undefined && l.maxAvgKmh !== undefined) kmh = (l.minAvgKmh + l.maxAvgKmh) / 2;
    else if (l.minAvgKmh !== undefined) kmh = l.minAvgKmh + 28;
    else if (l.limitKmh !== undefined) kmh = l.limitKmh - 9;
    if (l.limitKmh !== undefined) kmh = Math.min(kmh, l.limitKmh - 9);
    if (l.fasterThanPrevPct !== undefined && prevKmh > 0) kmh = prevKmh * (1 + (l.fasterThanPrevPct + 4) / 100);
    return [{ from: l.from - 90, to: l.to + 6, kmh: kmh + bias }];
  }
  if (l.kind === 'gate') return [{ from: l.at - 90, to: l.at + 20, kmh: (l.minKmh + l.maxKmh) / 2 + bias }];
  return [{ from: -50, to: l.signalAt, kmh: l.minKmhAtSignal + 8 + bias }, { from: l.signalAt, to: l.zone[1] + 200, kmh: 0, brake: true }];
}

export interface PilotOptions { reaction?: number; bias?: number; seed?: number; /** speed (km/h) held while drifting */ driftKmh?: number }

/** Drives `objective` and returns what the tracker concluded (plus the final sim for extra assertions). */
export function runObjective(o: DriveObjective, opt: PilotOptions = {}): { result: DriveResult; sim: RaceSim; tracker: ObjectiveTracker; steps: number } {
  const track = new Track();
  const sim = new RaceSim({ laps: 9, difficulty: 'normal', cars: 1, playerSlot: 0, seed: opt.seed ?? 7 }, track);
  const profile = buildAiProfile(track);
  const sp = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
  let lane = 0;
  const tracker = new ObjectiveTracker(o);
  observeRacing(sim, s => tracker.feed(s));
  const plan = planFor(o, opt.bias ?? 0), reaction = opt.reaction ?? 0.3;
  const car = sim.cars[0];
  let steps = 0, brakeAt = -1;
  while (!tracker.done && steps < 120 * (o.timeLimit + 12)) {
    const racing = sim.stage === 'racing';
    const inp = sim.playerInput;
    if (racing) {
      // pure-pursuit steering toward a lane that keeps clear of the obstacle clusters, like a careful human
      const s0 = car.tq.s, look = 10 + Math.max(0, car.speed) * 0.5;
      let want = 0;
      for (const ob of sim.obstacles) {
        if (ob.hit) continue;
        let ds = ob.s - s0; if (ds < -track.length / 2) ds += track.length; if (ds > track.length / 2) ds -= track.length;
        if (ds > -3 && ds < 30 + Math.max(0, car.speed) * 1.3 && Math.abs(ob.lat - lane) < 3.6) want = ob.lat > 0 ? Math.min(want, ob.lat - 4.4) : Math.max(want, ob.lat + 4.4);
      }
      lane += clamp(want - lane, -7 * FIXED_DT, 7 * FIXED_DT);
      track.pointAt(s0 + look, lane, sp);
      const err = angleDiff(car.heading, Math.atan2(sp.x - car.x, sp.z - car.z));
      inp.steer = clamp(-err * 2.2 + -car.slip * 0.02, -1, 1); inp.boost = false;
      const kc = Math.abs(track.curvature[track.wrap(Math.round((s0 + 18) / track.spacing))]);
      const budget = driftBudget(o, car.progress);
      if (budget > 0 && !car.drifting && kc > 0.0009 && Math.abs(inp.steer) < 0.32) inp.steer = (Math.sign(inp.steer) || Math.sign(-err) || 1) * 0.32;
      inp.handbrake = budget > 0 && car.stats.driftSeconds < budget && (car.drifting ? kc > 0.0009 : kc > 0.0009 && Math.abs(inp.steer) > 0.3 && car.speed > 16);
      const p = car.progress, seg = plan.find(sg => p >= sg.from && p < sg.to);
      const idx = track.wrap(Math.round((car.tq.s + Math.max(0, car.speed) * 0.25) / track.spacing));
      const cap = profile[idx] * 0.97;
      if (seg?.brake) {
        if (brakeAt < 0) brakeAt = sim.raceTime;
        if (car.speed < 0.3) { inp.throttle = 0; inp.brake = 0; } else if (sim.raceTime - brakeAt >= reaction) { inp.throttle = 0; inp.brake = 1; } else { inp.throttle = 0.6; inp.brake = 0; }
      } else {
        const drifty = driftBudget(o, p) > 0, target = Math.min((seg ? seg.kmh : lastTarget(plan, p)) / KMH, cap, drifty ? (opt.driftKmh ?? 105) / KMH : 99), over = car.speed - target;
        const nearSignal = o.legs.some(l => l.kind === 'stop' && p > l.signalAt - 60 && p <= l.signalAt + 5);
        if (over > (nearSignal ? 6 : 0.8)) { inp.throttle = 0; inp.brake = Math.min(1, over / 6); } else { inp.throttle = over < -1.5 ? 1 : 0.5; inp.brake = 0; }
      }
    } else { inp.throttle = 0; inp.brake = 0; inp.steer = 0; }
    sim.step(FIXED_DT); steps++;
  }
  if (!tracker.done) tracker.abandon('The pilot ran out of steps.');
  return { result: tracker.result(), sim, tracker, steps };
}
function lastTarget(plan: Seg[], p: number): number {
  let k = plan.length ? plan[0].kmh : 120;
  for (const sg of plan) { if (sg.from <= p) k = sg.kmh || k; }
  return k;
}

/** Seconds of drifting a careful driver would spend in the section containing `p` (0 = do not drift). */
function driftBudget(o: DriveObjective, p: number): number {
  for (const l of o.legs) if (l.kind === 'section' && p >= l.from - 5 && p <= l.to && (l.driftSec !== undefined || l.meterTo !== undefined)) return (l.driftSec ?? 0) + (l.meterTo !== undefined ? 3 : 0) + 1.0;
  return 0;
}
