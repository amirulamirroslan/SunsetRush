import { clamp } from './math';
import { COURSE } from './trackDef';
import { Rng } from './rng';
import { Track } from './Track';
import { AIDriver, buildAiProfile, type Obstacle } from './ai';
import { PHYS, collideTrack, createCar, emit, newInput, placeCar, stepCar, type CarInput, type CarState } from './carPhysics';
import type { Difficulty } from './rewards';

export const FIXED_DT = 1 / 120;
export const INTRO_SECONDS = 2.6;
export const COUNTDOWN_SECONDS = 3;

export interface RaceConfig {
  laps: number;
  difficulty: Difficulty;
  /** total cars including the player */
  cars: number;
  /** 0-based grid slot of the player */
  playerSlot: number;
  seed?: number;
}
export type RaceStage = 'intro' | 'countdown' | 'racing' | 'finished';

/**
 * Headless race simulation: no rendering, no DOM. The renderer, HUD and audio read its state; the tests drive it directly.
 * Car 0 is always the player.
 */
export class RaceSim {
  readonly track: Track;
  readonly cars: CarState[] = [];
  readonly obstacles: Obstacle[] = [];
  readonly boostPads: number[];
  readonly config: RaceConfig;
  stage: RaceStage = 'intro';
  stageTime = 0;
  raceTime = 0;
  /** ranks[carId] = 1-based place */
  readonly ranks: number[] = [];
  /** Set once the player has crossed the line on the last lap. */
  playerFinishedAt = -1;
  playerPlace = 0;
  /** When true the player's car is driven by the autopilot (after finishing, or for tests). */
  autopilot = false;
  readonly playerInput: CarInput = newInput();
  private readonly drivers: (AIDriver | null)[] = [];
  private readonly aiProfile: Float32Array;
  private readonly tmp = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
  private acc = 0;
  /** Fastest single lap of anyone in the race so far (seconds). */
  fastestLap = Infinity;
  fastestLapCar = -1;

  constructor(config: RaceConfig, track: Track = new Track()) {
    this.config = config;
    this.track = track;
    this.boostPads = [...COURSE.boostPads];
    this.aiProfile = buildAiProfile(track);
    for (let i = 0; i < config.cars; i++) {
      this.cars.push(createCar(i, i === 0));
      this.ranks.push(i + 1);
      this.drivers.push(i === 0 ? new AIDriver(track, this.aiProfile, config.difficulty, 99) : new AIDriver(track, this.aiProfile, config.difficulty, i * 7 + 3));
    }
    this.buildObstacles(config.seed ?? 7);
    this.reset();
  }

  private buildObstacles(seed: number): void {
    const rng = new Rng(seed);
    let id = 0;
    for (const c of COURSE.obstacles) {
      for (let k = 0; k < c.count; k++) {
        const s = c.s + (c.kind === 'cone' ? k * 6 : 0);
        const lat = c.kind === 'cone' ? c.lat + (k % 2 ? 0.8 : -0.8) + rng.range(-0.3, 0.3) : c.lat + (k === 0 ? -0.8 : 0.9);
        this.tmp.x = 0;
        this.track.pointAt(s, lat, this.tmp);
        this.obstacles.push({ id: id++, kind: c.kind, x: this.tmp.x, z: this.tmp.z, y: this.tmp.y, r: c.kind === 'cone' ? 0.45 : 0.75, hit: false, kx: 0, kz: 0, spin: 0, age: 0, s, lat });
      }
    }
  }

  /** Put every car on the grid and restart the clock. */
  reset(): void {
    this.stage = 'intro'; this.stageTime = 0; this.raceTime = 0; this.playerFinishedAt = -1; this.playerPlace = 0;
    this.autopilot = false; this.fastestLap = Infinity; this.fastestLapCar = -1; this.acc = 0;
    for (const o of this.obstacles) { o.hit = false; o.kx = o.kz = o.spin = o.age = 0; }
    const slots: number[] = [];
    for (let i = 0; i < this.config.cars; i++) slots.push(i);
    // player takes `playerSlot`, rivals fill the rest in order
    const order: number[] = new Array(this.config.cars).fill(-1);
    order[clamp(this.config.playerSlot, 0, this.config.cars - 1)] = 0;
    let next = 1;
    for (let i = 0; i < order.length; i++) if (order[i] === -1) order[i] = next++;
    order.forEach((carId, slot) => {
      const car = this.cars[carId];
      const row = Math.floor(slot / 2), col = slot % 2;
      const s = -(7 + row * 9 + (col ? 4.5 : 0));
      this.track.pointAt(s, col ? 3.4 : -3.4, this.tmp);
      const fresh = createCar(carId, carId === 0);
      Object.assign(car, fresh);
      placeCar(car, this.tmp.x, this.tmp.y, this.tmp.z, this.tmp.heading);
      this.track.query(car.x, car.z, -1, car.tq);
      car.lastS = car.tq.s; car.progress = s;
    });
    this.updateRanks();
  }

  get countdownRemaining(): number { return this.stage === 'countdown' ? COUNTDOWN_SECONDS - this.stageTime : 0; }
  get playerCar(): CarState { return this.cars[0]; }
  get totalLength(): number { return this.track.length * this.config.laps; }

  /** Advance by real elapsed time; runs as many fixed steps as needed. Returns the interpolation alpha for rendering. */
  advance(dtReal: number): number {
    this.acc += Math.min(dtReal, 0.1);
    while (this.acc >= FIXED_DT) { this.step(FIXED_DT); this.acc -= FIXED_DT; }
    return this.acc / FIXED_DT;
  }

  step(dt: number): void {
    this.stageTime += dt;
    if (this.stage === 'intro' && this.stageTime >= INTRO_SECONDS) { this.stage = 'countdown'; this.stageTime = 0; }
    else if (this.stage === 'countdown' && this.stageTime >= COUNTDOWN_SECONDS) { this.stage = 'racing'; this.stageTime = 0; this.raceTime = 0; for (const c of this.cars) c.lapStart = 0; }
    const locked = this.stage === 'intro' || this.stage === 'countdown';
    if (!locked) this.raceTime += dt;

    const player = this.cars[0];
    const leaderProgress = player.progress;
    for (const car of this.cars) {
      car.px = car.x; car.py = car.y; car.pz = car.z; car.pheading = car.heading;
      let inp: CarInput;
      if (car.id === 0 && !this.autopilot) inp = this.playerInput;
      else {
        const rubber = car.id === 0 ? 0 : clamp((leaderProgress - car.progress) / 260, -0.035, 0.045);
        inp = this.drivers[car.id]!.update(car, dt, this.cars, this.obstacles, rubber, !locked);
      }
      stepCar(car, inp, dt, locked);
      collideTrack(car, this.track);
      this.collideObstacles(car);
      this.updateProgress(car);
      this.checkPads(car, dt);
      this.checkStuck(car, dt, locked);
    }
    this.collideCars();
    for (const o of this.obstacles) if (o.hit) { o.age += dt; const k = Math.exp(-2.2 * dt); o.kx *= k; o.kz *= k; o.x += o.kx * dt; o.z += o.kz * dt; }
    this.updateRanks();

    if (this.stage === 'racing' && player.finished && this.playerFinishedAt < 0) {
      this.playerFinishedAt = this.raceTime;
      this.playerPlace = this.ranks[0];
      this.autopilot = true;
      this.stage = 'finished'; this.stageTime = 0;
    }
  }

  private updateProgress(car: CarState): void {
    const L = this.track.length;
    let delta = car.tq.s - car.lastS;
    if (delta > L / 2) delta -= L; else if (delta < -L / 2) delta += L;
    car.lastS = car.tq.s;
    const prevLaps = Math.floor(car.progress / L);
    car.progress += delta;
    const laps = Math.floor(car.progress / L);
    if (laps > prevLaps && laps >= 1 && !car.finished && this.stage !== 'intro' && this.stage !== 'countdown') {
      const lapTime = this.raceTime - car.lapStart;
      car.lapTimes.push(lapTime); car.lapStart = this.raceTime; car.lap = laps;
      if (lapTime < this.fastestLap) { this.fastestLap = lapTime; this.fastestLapCar = car.id; }
      if (laps >= this.config.laps) { car.finished = true; car.finishTime = this.raceTime; }
    }
  }

  private checkPads(car: CarState, dt: number): void {
    car.padCooldown = Math.max(0, car.padCooldown - dt);
    if (car.padCooldown > 0 || Math.abs(car.tq.d) > this.track.halfWidth) return;
    for (const p of this.boostPads) {
      if (Math.abs(car.tq.s - p) < 3.2) {
        car.boostTimer = Math.max(car.boostTimer, PHYS.padBoost);
        car.stats.boostPads++; car.padCooldown = 2.5; emit(car, 'pad');
        break;
      }
    }
  }

  private checkStuck(car: CarState, dt: number, locked: boolean): void {
    if (locked || car.finished) { car.stuck = 0; return; }
    const dir = car.vx * car.tq.tx + car.vz * car.tq.tz;
    car.wrongWay = dir < -4 ? car.wrongWay + dt : 0;
    car.stuck = Math.abs(car.speed) < 2 ? car.stuck + dt : 0;
    if ((car.id !== 0 || this.autopilot) && car.stuck > 2.5) this.respawn(car);
  }

  /** Puts a car back on the centre line, facing the right way. */
  respawn(car: CarState): void {
    this.track.pointAt(car.tq.s, 0, this.tmp);
    placeCar(car, this.tmp.x, this.tmp.y, this.tmp.z, this.tmp.heading, 8);
    car.tq.i = -1; this.track.query(car.x, car.z, -1, car.tq);
    car.lastS = car.tq.s; car.invulnerable = 1.2; car.stuck = 0; car.wrongWay = 0;
    emit(car, 'respawn');
  }

  private collideObstacles(car: CarState): void {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    for (const o of this.obstacles) {
      if (o.hit) continue;
      if (Math.abs(o.s - car.tq.s) > 8 && Math.abs(o.s - car.tq.s) < this.track.length - 8) continue;
      for (const off of [-PHYS.carOffset, 0, PHYS.carOffset]) {
        const cx = car.x + fx * off, cz = car.z + fz * off;
        const dx = o.x - cx, dz = o.z - cz;
        const rr = o.r + PHYS.carRadius * 0.85;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001, nx = dx / d, nz = dz / d;
        if (o.kind === 'cone') {
          o.hit = true; const sp = Math.max(6, Math.hypot(car.vx, car.vz)) * 0.8;
          o.kx = car.vx * 0.9 + nx * 4; o.kz = car.vz * 0.9 + nz * 4; o.spin = sp * 0.5;
          car.vx *= 0.95; car.vz *= 0.95; car.stats.hits += 0; emit(car, 'cone');
        } else {
          car.x -= nx * (rr - d); car.z -= nz * (rr - d);
          const vn = car.vx * nx + car.vz * nz;
          if (vn > 0) {
            car.vx -= 1.4 * vn * nx; car.vz -= 1.4 * vn * nz; car.vx *= 0.82; car.vz *= 0.82;
            if (vn > 3) { car.impact = Math.max(car.impact, vn); car.stats.hits++; emit(car, 'barrel'); }
          }
        }
        break;
      }
    }
  }

  private collideCars(): void {
    const n = this.cars.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = this.cars[i], b = this.cars[j];
      if (Math.abs(a.x - b.x) > 6 || Math.abs(a.z - b.z) > 6) continue;
      const ax = Math.sin(a.heading), az = Math.cos(a.heading), bx = Math.sin(b.heading), bz = Math.cos(b.heading);
      for (const oa of [-PHYS.carOffset, PHYS.carOffset]) for (const ob of [-PHYS.carOffset, PHYS.carOffset]) {
        const pax = a.x + ax * oa, paz = a.z + az * oa, pbx = b.x + bx * ob, pbz = b.z + bz * ob;
        const dx = pbx - pax, dz = pbz - paz;
        const rr = PHYS.carRadius * 2;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001, nx = dx / d, nz = dz / d;
        const pen = (rr - d) * 0.5;
        a.x -= nx * pen; a.z -= nz * pen; b.x += nx * pen; b.z += nz * pen;
        const rvn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rvn < 0) {
          const j2 = -(1 + 0.28) * rvn * 0.5;
          a.vx -= nx * j2; a.vz -= nz * j2; b.vx += nx * j2; b.vz += nz * j2;
          if (-rvn > 3) { for (const c of [a, b]) { c.impact = Math.max(c.impact, -rvn); emit(c, 'car'); } if (a.isPlayer || b.isPlayer) (a.isPlayer ? a : b).stats.hits += (-rvn > 5 ? 1 : 0); }
        }
      }
    }
  }

  private updateRanks(): void {
    const order = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    order.forEach((c, i) => { this.ranks[c.id] = i + 1; });
  }

  /** Every car that has crossed the line, ordered by finishing time. */
  get allFinished(): boolean { return this.cars.every(c => c.finished); }
}
