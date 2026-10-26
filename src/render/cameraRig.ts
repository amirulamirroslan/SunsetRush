import { PerspectiveCamera, Vector3 } from 'three';
import { angleDiff, clamp, damp, lerp, smoothstep } from '../sim/math';

export type CameraMode = 'chase' | 'intro' | 'orbit';

/**
 * Feel constants for the chase camera. The smoothed position naturally trails a moving target by speed / posRate metres
 * (about 5.6 m at top speed), which made the real chase distance far larger than the `dist` below (13.5 m vs 8.4 m at 62 m/s,
 * 16 m on boost). `lagComp` leads the target by that fraction of the trail: 0 restores the old behaviour, 1 removes the trail.
 */
export const CAMERA_TUNING = { posRate: 11, lagComp: 0.7, boostFov: 9, kickFov: 4, kickShake: 0.03 } as const;

export interface FocusState {
  x: number; y: number; z: number; heading: number; vx: number; vz: number; speed: number;
  boosting: boolean; drifting: boolean; yawRate: number; impact: number;
}

/**
 * Chase camera with a speed-dependent distance and FOV, heading smoothing that follows the direction of travel (so drifts
 * look dramatic without whipping the view), a start-line fly-in and a free orbit for the garage / results.
 * All smoothing is exponential in real time, so it behaves identically at 30 and 144 fps; shake is band-limited sine noise.
 */
export class CameraRig {
  readonly camera = new PerspectiveCamera(60, 1, 0.3, 5000);
  mode: CameraMode = 'orbit';
  reducedMotion = false;
  /** Vertical picture shift while chasing (negative lifts the car up the screen; used in portrait to clear the controls). */
  chaseShiftY = 0;
  // chase state
  private yaw = 0; private fov = 60; private boostK = 0; private roll = 0; private shakeAmp = 0; private kickK = 0;
  private readonly pos = new Vector3(); private readonly look = new Vector3(); private readonly tmp = new Vector3();
  private time = 0;
  // orbit state
  readonly orbit = { target: new Vector3(), yaw: 0.6, pitch: 0.2, dist: 8, auto: 0.25, minDist: 4.5, maxDist: 14 };
  private shiftX = 0; private shiftY = 0; private shiftTX = 0; private shiftTY = 0;
  private w = 1; private h = 1;

  resize(w: number, h: number): void {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.applyShift();
  }

  /** Slide the picture so the focus sits in the free part of the screen (fractions of the viewport). */
  setShift(x: number, y: number, instant = false): void { this.shiftTX = x; this.shiftTY = y; if (instant) { this.shiftX = x; this.shiftY = y; this.applyShift(); } }
  private applyShift(): void {
    if (Math.abs(this.shiftX) < 1e-4 && Math.abs(this.shiftY) < 1e-4) { if (this.camera.view?.enabled) this.camera.clearViewOffset(); }
    else this.camera.setViewOffset(this.w, this.h, -this.shiftX * this.w, -this.shiftY * this.h, this.w, this.h);
  }

  /** A short punch of FOV and shake for boost starts, pads and mini-turbos. `amount` 0..1; overlapping kicks do not stack. */
  kick(amount: number): void { this.kickK = Math.max(this.kickK, clamp(amount, 0, 1)); }
  /** Current transient kick (0..1), for tests. */
  get kickLevel(): number { return this.kickK; }

  snapChase(f: FocusState): void {
    this.mode = 'chase'; this.yaw = f.heading; this.boostK = 0; this.roll = 0; this.kickK = 0;
    this.pos.set(f.x - Math.sin(f.heading) * 6.8, f.y + 2.3, f.z - Math.cos(f.heading) * 6.8);
    this.fov = 60; this.camera.fov = 60; this.camera.updateProjectionMatrix();
  }

  /** `t` is 0..1 progress of the intro fly-in. */
  updateIntro(f: FocusState, t: number): void {
    this.mode = 'intro';
    const e = smoothstep(0, 1, t), e2 = e * e * (3 - 2 * e);
    const a = lerp(0.32 * Math.PI, Math.PI, e2);
    const r = lerp(6.2, 7.4, e), hgt = lerp(1.1, 2.4, e);
    this.camera.position.set(f.x + Math.sin(f.heading + a) * r, f.y + hgt, f.z + Math.cos(f.heading + a) * r);
    this.tmp.set(f.x + Math.sin(f.heading) * lerp(0.8, 3.5, e), f.y + lerp(0.7, 1.15, e), f.z + Math.cos(f.heading) * lerp(0.8, 3.5, e));
    this.camera.lookAt(this.tmp);
    const fv = lerp(46, 60, e); if (Math.abs(this.camera.fov - fv) > 0.01) { this.camera.fov = fv; this.camera.updateProjectionMatrix(); }
    this.yaw = f.heading; this.pos.copy(this.camera.position); this.fov = fv; this.shiftX = this.shiftTX = 0; this.applyShift();
  }

  updateChase(f: FocusState, dt: number, shakeBoost = 1): void {
    this.mode = 'chase'; this.time += dt;
    const sp = clamp(f.speed / 62, 0, 1.3);
    const velDir = f.speed > 6 ? Math.atan2(f.vx, f.vz) : f.heading;
    const target = f.heading + clamp(angleDiff(f.heading, velDir), -0.7, 0.7) * 0.5;
    this.yaw += angleDiff(this.yaw, target) * damp(f.speed < 6 ? 3 : 6, dt);
    this.boostK += ((f.boosting ? 1 : 0) - this.boostK) * damp(3, dt);
    const m = this.reducedMotion ? 0.35 : 1;
    this.kickK += (0 - this.kickK) * damp(6, dt);
    const dist = 6.9 + sp * 1.5; // no extra pull-back on boost: thrust should feel closer and faster, not further away
    const height = 2.3 + sp * 0.4;
    const lead = CAMERA_TUNING.lagComp / CAMERA_TUNING.posRate; // seconds of velocity the target is led by, cancelling most of the steady trail
    const dx = f.x - Math.sin(this.yaw) * dist + f.vx * lead, dz = f.z - Math.cos(this.yaw) * dist + f.vz * lead;
    this.pos.x += (dx - this.pos.x) * damp(CAMERA_TUNING.posRate, dt); this.pos.z += (dz - this.pos.z) * damp(CAMERA_TUNING.posRate, dt);
    this.pos.y += (f.y + height - this.pos.y) * damp(5.5, dt);
    if (this.pos.y < f.y + 1.0) this.pos.y = f.y + 1.0;
    const ahead = 3.5 + sp * 3.2;
    this.look.set(f.x + Math.sin(this.yaw) * ahead, f.y + 1.15, f.z + Math.cos(this.yaw) * ahead);
    // band-limited shake: boost rumble + impacts
    const amp = (this.boostK * 0.035 + this.kickK * CAMERA_TUNING.kickShake + clamp(f.impact * 0.01, 0, 0.18)) * shakeBoost * m;
    this.shakeAmp += (amp - this.shakeAmp) * damp(18, dt);
    const t = this.time;
    const sx = (Math.sin(t * 37.1) + Math.sin(t * 23.7 + 1.3)) * 0.5 * this.shakeAmp, sy = (Math.sin(t * 31.3 + 2.1) + Math.sin(t * 19.9)) * 0.5 * this.shakeAmp;
    this.camera.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z);
    this.camera.lookAt(this.look);
    const rollT = clamp(-f.yawRate * 0.035, -0.05, 0.05) * m + (f.drifting ? clamp(-f.yawRate * 0.02, -0.04, 0.04) * m : 0);
    this.roll += (rollT - this.roll) * damp(5, dt);
    this.camera.rotateZ(this.roll);
    const fovT = 58 + sp * 15 * m + this.boostK * CAMERA_TUNING.boostFov * m;
    this.fov += (fovT - this.fov) * damp(3.5, dt);
    const fovNow = this.fov + this.kickK * CAMERA_TUNING.kickFov * m; // the kick bypasses the slow FOV smoothing so it reads as a punch
    if (Math.abs(this.camera.fov - fovNow) > 0.02) { this.camera.fov = fovNow; this.camera.updateProjectionMatrix(); }
    this.shiftX = this.shiftTX = 0; this.shiftY += (this.chaseShiftY - this.shiftY) * damp(6, dt); this.shiftTY = this.chaseShiftY; this.applyShift();
  }

  updateOrbit(dt: number): void {
    this.mode = 'orbit';
    const o = this.orbit;
    o.yaw += o.auto * dt;
    const cp = Math.cos(o.pitch);
    this.camera.position.set(o.target.x + Math.sin(o.yaw) * cp * o.dist, o.target.y + Math.sin(o.pitch) * o.dist, o.target.z + Math.cos(o.yaw) * cp * o.dist);
    this.camera.lookAt(o.target);
    if (Math.abs(this.camera.fov - 40) > 0.01) { this.camera.fov = 40; this.camera.updateProjectionMatrix(); }
    this.shiftX += (this.shiftTX - this.shiftX) * damp(7, dt); this.shiftY += (this.shiftTY - this.shiftY) * damp(7, dt);
    this.applyShift();
  }

  /** Drag / pinch from the garage. */
  nudgeOrbit(dyaw: number, dpitch: number, ddist = 0): void {
    const o = this.orbit;
    o.yaw += dyaw; o.pitch = clamp(o.pitch + dpitch, 0.02, 1.1); o.dist = clamp(o.dist + ddist, o.minDist, o.maxDist);
  }
}
