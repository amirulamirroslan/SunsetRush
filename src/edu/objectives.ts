import type { DriveObjective, DriveResult, DriveStats, Leg, LegResult, Sample, SectionLeg, StopLeg } from './types';

const KMH = 3.6;
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Linear interpolation of the moment the car crossed distance `x` between two consecutive samples. */
function crossing(prev: Sample, cur: Sample, x: number): Sample | null {
  if (!(prev.progress < x && cur.progress >= x)) return null;
  const f = (x - prev.progress) / Math.max(1e-6, cur.progress - prev.progress);
  const l = (a: number, b: number): number => a + (b - a) * f;
  return { t: l(prev.t, cur.t), progress: x, speed: l(prev.speed, cur.speed), braking: cur.braking, throttle: cur.throttle, offRoad: cur.offRoad, drifting: cur.drifting, y: l(prev.y, cur.y), hazardHits: cur.hazardHits, driftSeconds: l(prev.driftSeconds, cur.driftSeconds), boostMeter: l(prev.boostMeter, cur.boostMeter) };
}

interface SectionState { entered: boolean; t0: number; y0: number; hits0: number; drift0: number; meter0: number; meterPeak: number; over: number; off: number; maxMs: number }
interface StopState { phase: 'approach' | 'signalled' | 'braking'; signalT: number; speedAtSignal: number; brakeT: number; brakeAt: number; speedAtBrake: number; rest: number }

/**
 * Evaluates a driving objective purely from telemetry samples. It reads numbers and reports results; it has no handle on the
 * simulation, so it cannot change how the car drives.
 */
export class ObjectiveTracker {
  readonly results: LegResult[];
  passed = false;
  done = false;
  failReason: string | undefined;
  private idx = 0;
  private prev: Sample | null = null;
  private first: Sample | null = null;
  private sec: SectionState = ObjectiveTracker.freshSection();
  private stop: StopState = ObjectiveTracker.freshStop();
  private top = 0; private offSec = 0;
  private lastSample: Sample | null = null;
  /** The exact crossing of the section boundary that just ended, so a section that starts where the last one ended is entered at the same instant. */
  private carry: Sample | null = null;

  constructor(readonly objective: DriveObjective) {
    this.results = objective.legs.map(l => ({ id: l.id, label: l.label, status: 'pending', metrics: {} }));
    if (this.results.length) this.results[0].status = 'active';
  }

  private static freshSection(): SectionState { return { entered: false, t0: 0, y0: 0, hits0: 0, drift0: 0, meter0: 0, meterPeak: 0, over: 0, off: 0, maxMs: 0 }; }
  private static freshStop(): StopState { return { phase: 'approach', signalT: 0, speedAtSignal: 0, brakeT: 0, brakeAt: 0, speedAtBrake: 0, rest: 0 }; }

  /** The leg the player is working on, for the on-screen helper. */
  get currentLeg(): Leg | null { return this.done ? null : this.objective.legs[this.idx] ?? null; }
  get currentIndex(): number { return this.idx; }
  /** What the on-screen helper shows right now. Pure read of tracker state. */
  live(): LiveInfo | null {
    const leg = this.currentLeg, last = this.lastSample;
    if (!leg || !last) return null;
    const base: LiveInfo = { index: this.idx, count: this.objective.legs.length, label: leg.label, target: legTarget(leg), inside: false, avgKmh: 0, overSec: 0, signal: this.signalLit, timeLeft: Math.max(0, this.objective.timeLimit - last.t) };
    if (leg.kind === 'section') {
      const st = this.sec;
      if (st.entered) { const t = Math.max(0.05, last.t - st.t0); base.inside = true; base.avgKmh = (last.progress - leg.from) / t * KMH; base.overSec = st.over; }
      base.distToStart = Math.max(0, leg.from - last.progress);
    } else if (leg.kind === 'gate') base.distToStart = Math.max(0, leg.at - last.progress);
    else base.distToStart = Math.max(0, leg.signalAt - last.progress);
    return base;
  }
  /** True from the moment the stop signal turns red until the leg ends. */
  get signalLit(): boolean { const l = this.currentLeg; return !!l && l.kind === 'stop' && this.stop.phase !== 'approach'; }

  feed(s: Sample): void {
    if (this.done) return;
    this.lastSample = s;
    if (!this.prev || !this.first) { this.prev = s; this.first = s; return; }
    const prev = this.prev;
    const dt = Math.max(0, s.t - prev.t);
    this.top = Math.max(this.top, Math.abs(s.speed) * KMH);
    if (s.offRoad) this.offSec += dt;
    if (s.t > this.objective.timeLimit) { this.fail('Time ran out before the objective was finished.'); this.prev = s; return; }
    const leg = this.objective.legs[this.idx];
    if (leg) {
      if (leg.kind === 'section') this.feedSection(leg, prev, s, dt);
      else { this.carry = null; if (leg.kind === 'gate') this.feedGate(leg, prev, s); else this.feedStop(leg, prev, s); }
    }
    this.prev = s;
  }

  // ---------------------------------------------------------------- legs
  private passLeg(metrics: Record<string, number>): void {
    const r = this.results[this.idx]; r.status = 'passed'; r.metrics = metrics;
    this.idx++; this.sec = ObjectiveTracker.freshSection(); this.stop = ObjectiveTracker.freshStop();
    if (this.idx >= this.results.length) { this.passed = true; this.done = true; } else this.results[this.idx].status = 'active';
  }
  private failLeg(reason: string, metrics: Record<string, number> = {}): void {
    const r = this.results[this.idx]; if (r) { r.status = 'failed'; r.reason = reason; r.metrics = metrics; }
    this.fail(reason);
  }
  private fail(reason: string): void {
    if (this.done) return;
    this.done = true; this.passed = false; this.failReason = reason;
    const r = this.results[this.idx]; if (r && r.status === 'active') { r.status = 'failed'; r.reason = reason; }
  }

  private feedGate(leg: Leg & { kind: 'gate' }, prev: Sample, s: Sample): void {
    const c = crossing(prev, s, leg.at); if (!c) return;
    const kmh = Math.abs(c.speed) * KMH;
    const m = { speedKmh: r1(kmh), speedMs: r1(Math.abs(c.speed)), t: c.t, y: r1(c.y) };
    if (kmh < leg.minKmh) this.failLeg(`${leg.label}: ${Math.round(kmh)} km/h was too slow (needed ${leg.minKmh} to ${leg.maxKmh} km/h).`, m);
    else if (kmh > leg.maxKmh) this.failLeg(`${leg.label}: ${Math.round(kmh)} km/h was too fast (needed ${leg.minKmh} to ${leg.maxKmh} km/h).`, m);
    else this.passLeg(m);
  }

  private feedSection(leg: SectionLeg, prev: Sample, s: Sample, dt: number): void {
    const st = this.sec;
    if (!st.entered) {
      const c = this.carry && Math.abs(this.carry.progress - leg.from) < 0.01 ? this.carry : crossing(prev, s, leg.from);
      this.carry = null;
      if (!c) return;
      st.entered = true; st.t0 = c.t; st.y0 = c.y; st.hits0 = c.hazardHits; st.drift0 = c.driftSeconds; st.meter0 = c.boostMeter; st.meterPeak = c.boostMeter;
      st.maxMs = Math.abs(c.speed);
    }
    const kmh = Math.abs(s.speed) * KMH;
    st.maxMs = Math.max(st.maxMs, Math.abs(s.speed)); st.meterPeak = Math.max(st.meterPeak, s.boostMeter);
    if (leg.limitKmh !== undefined && kmh > leg.limitKmh + 3) st.over += dt;
    if (s.offRoad) st.off += dt;
    const x = crossing(prev, s, leg.to); if (!x) return;
    const time = Math.max(0.01, x.t - st.t0), dist = leg.to - leg.from, avgMs = dist / time, avg = avgMs * KMH;
    const m: Record<string, number> = {
      time: Math.round(time * 100) / 100, dist, avgMs: r1(avgMs), avgKmh: r1(avg), dy: r1(x.y - st.y0), y0: r1(st.y0), y1: r1(x.y),
      maxKmh: r1(st.maxMs * KMH), overSec: Math.round(st.over * 100) / 100, driftSec: Math.round((x.driftSeconds - st.drift0) * 10) / 10,
      meterStart: Math.round(st.meter0 * 100), meterPeak: Math.round(st.meterPeak * 100), hits: x.hazardHits - st.hits0, offRoadSec: Math.round(st.off * 100) / 100,
    };
    const bad = this.sectionProblem(leg, m);
    if (bad) this.failLeg(bad, m); else { this.passLeg(m); this.carry = x; }
  }

  private sectionProblem(leg: SectionLeg, m: Record<string, number>): string | null {
    const L = leg.label;
    if (leg.minAvgKmh !== undefined && m.avgKmh < leg.minAvgKmh) return `${L}: your average of ${Math.round(m.avgKmh)} km/h was below the target of ${leg.minAvgKmh} to ${leg.maxAvgKmh ?? '...'} km/h.`;
    if (leg.maxAvgKmh !== undefined && m.avgKmh > leg.maxAvgKmh) return `${L}: your average of ${Math.round(m.avgKmh)} km/h was above the target of ${leg.minAvgKmh ?? 0} to ${leg.maxAvgKmh} km/h.`;
    if (leg.limitKmh !== undefined && m.overSec > (leg.overAllowSec ?? 0)) return `${L}: you were over the ${leg.limitKmh} km/h limit for ${m.overSec.toFixed(1)} s (allowed ${(leg.overAllowSec ?? 0).toFixed(1)} s).`;
    if (leg.noHits && m.hits > 0) return `${L}: you hit ${m.hits} hazard${m.hits === 1 ? '' : 's'}. Look ahead and pick a clear line.`;
    if (leg.driftSec !== undefined && m.driftSec < leg.driftSec) return `${L}: you drifted for ${m.driftSec.toFixed(1)} s but ${leg.driftSec} s were needed.`;
    if (leg.meterTo !== undefined && m.meterPeak < Math.round(leg.meterTo * 100)) return `${L}: the boost meter peaked at ${m.meterPeak}% but ${Math.round(leg.meterTo * 100)}% was needed.`;
    if (leg.offRoadMaxSec !== undefined && m.offRoadSec > leg.offRoadMaxSec) return `${L}: you spent ${m.offRoadSec.toFixed(1)} s off the road.`;
    if (leg.fasterThanPrevPct !== undefined) {
      const prevLeg = [...this.results].slice(0, this.idx).reverse().find(r => r.metrics.avgKmh !== undefined);
      if (prevLeg) {
        const gain = (m.avgKmh / prevLeg.metrics.avgKmh - 1) * 100; m.gainPct = r1(gain);
        if (gain < leg.fasterThanPrevPct) return `${L}: this section was only ${gain.toFixed(1)}% faster than the last one but ${leg.fasterThanPrevPct}% was needed.`;
      }
    }
    return null;
  }

  private feedStop(leg: StopLeg, prev: Sample, s: Sample): void {
    const st = this.stop;
    const kmh = Math.abs(s.speed) * KMH;
    if (st.phase === 'approach') {
      const c = crossing(prev, s, leg.signalAt); if (!c) return;
      const sk = Math.abs(c.speed) * KMH;
      if (sk < leg.minKmhAtSignal) { this.failLeg(`${leg.label}: you were doing only ${Math.round(sk)} km/h at the signal (at least ${leg.minKmhAtSignal} km/h is needed for a real test).`, { signalKmh: r1(sk) }); return; }
      if (s.braking && prev.braking) { this.failLeg(`${leg.label}: you were already braking when the signal turned red, so your reaction could not be measured. Keep your foot off the brake until it flashes.`, { signalKmh: r1(sk) }); return; }
      st.phase = 'signalled'; st.signalT = c.t; st.speedAtSignal = Math.abs(c.speed);
      return;
    }
    if (s.progress > leg.zone[1] && s.speed >= 0.5) { this.failLeg(`${leg.label}: you went past the stop line at ${Math.round(kmh)} km/h. Brake sooner.`, this.stopMetrics(leg, s)); return; }
    if (st.phase === 'signalled') {
      if (s.braking) { st.phase = 'braking'; st.brakeT = s.t; st.brakeAt = s.progress; st.speedAtBrake = Math.abs(s.speed); }
      return;
    }
    // braking: the stop counts the moment forward speed falls below 0.5 m/s (holding the brake afterwards would only reverse the car)
    if (s.speed < 0.5) {
      const m = this.stopMetrics(leg, s);
      if (s.progress < leg.zone[0]) this.failLeg(`${leg.label}: you stopped ${Math.round(leg.zone[0] - s.progress)} m before the marked box.`, m);
      else this.passLeg(m);
    }
  }

  private stopMetrics(leg: StopLeg, s: Sample): Record<string, number> {
    const st = this.stop;
    const braked = st.phase === 'braking';
    return {
      signalKmh: r1(st.speedAtSignal * KMH), signalMs: r1(st.speedAtSignal), reactionSec: braked ? Math.round((st.brakeT - st.signalT) * 100) / 100 : 0,
      reactionDist: braked ? r1(st.brakeAt - leg.signalAt) : 0, brakeMs: r1(st.speedAtBrake), brakeKmh: r1(st.speedAtBrake * KMH),
      brakeDist: braked ? r1(Math.max(0, s.progress - st.brakeAt)) : 0, totalDist: r1(Math.max(0, s.progress - leg.signalAt)), stopAt: r1(s.progress),
    };
  }

  /** Ends the attempt early (player left the drive). Anything unfinished counts as not completed. */
  abandon(reason = 'The drive was ended early.'): void { this.fail(reason); }

  result(): DriveResult {
    const a = this.first, b = this.lastSample;
    const stats: DriveStats = {
      topSpeedKmh: Math.round(this.top), hazardHits: a && b ? b.hazardHits - a.hazardHits : 0, driftSeconds: a && b ? Math.round((b.driftSeconds - a.driftSeconds) * 10) / 10 : 0,
      offRoadSeconds: Math.round(this.offSec * 10) / 10, durationSec: a && b ? Math.round((b.t - a.t) * 10) / 10 : 0, distance: a && b ? Math.round(b.progress - a.progress) : 0,
    };
    return { passed: this.passed, failReason: this.failReason, legs: this.results.map(r => ({ ...r, metrics: { ...r.metrics } })), stats };
  }
}

/** Convenience: metric of a finished leg (or a fallback when that leg was never completed). */
export function metric(r: DriveResult, legId: string, key: string, fallback: number): number {
  const v = r.legs.find(l => l.id === legId)?.metrics[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export interface LiveInfo { index: number; count: number; label: string; target: string; inside: boolean; avgKmh: number; overSec: number; signal: boolean; timeLeft: number; distToStart?: number }

/** One plain sentence describing what a leg asks for. */
export function legTarget(l: Leg): string {
  if (l.kind === 'gate') return `Pass at ${l.minKmh} to ${l.maxKmh} km/h`;
  if (l.kind === 'stop') return `Pass the signal at ${l.minKmhAtSignal}+ km/h, then stop in the box`;
  const p: string[] = [];
  if (l.minAvgKmh !== undefined && l.maxAvgKmh !== undefined) p.push(`average ${l.minAvgKmh} to ${l.maxAvgKmh} km/h`);
  else if (l.minAvgKmh !== undefined) p.push(`average ${l.minAvgKmh}+ km/h`);
  if (l.limitKmh !== undefined) p.push(`stay under ${l.limitKmh} km/h`);
  if (l.fasterThanPrevPct !== undefined) p.push(`${l.fasterThanPrevPct}% faster than the last section`);
  if (l.driftSec !== undefined) p.push(`drift ${l.driftSec} s`);
  if (l.meterTo !== undefined) p.push(`boost meter ${Math.round(l.meterTo * 100)}%`);
  if (l.noHits) p.push('no hits');
  if (l.offRoadMaxSec !== undefined) p.push(`under ${l.offRoadMaxSec} s off the road`);
  const t = p.length ? p.join(', ') : 'drive through';
  return t[0].toUpperCase() + t.slice(1);
}
