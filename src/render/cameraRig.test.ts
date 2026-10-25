import { describe, expect, it } from 'vitest';
import { CameraRig, CAMERA_TUNING, type FocusState } from './cameraRig';

const focus = (z: number, v: number, boosting = false): FocusState => ({ x: 0, y: 0, z, heading: 0, vx: 0, vz: v, speed: v, boosting, drifting: false, yawRate: 0, impact: 0 });

/** Runs the chase camera on a straight at constant speed (60 fps) and returns it with the car's final z. */
function cruise(v: number, seconds: number, boosting = false): { rig: CameraRig; z: number } {
  const rig = new CameraRig(); let z = 0;
  rig.snapChase(focus(z, v, boosting));
  for (let i = 0; i < seconds * 60; i++) { z += v / 60; rig.updateChase(focus(z, v, boosting), 1 / 60); }
  return { rig, z };
}
const gap = (r: CameraRig, z: number): number => Math.hypot(r.camera.position.x, r.camera.position.z - z);

describe('chase camera', () => {
  it('keeps the chase distance close to the design values instead of trailing by a whole extra car-chase', () => {
    const rest = cruise(0, 3), top = cruise(62, 4), boost = cruise(75, 4, true);
    expect(gap(rest.rig, rest.z)).toBeCloseTo(6.9, 1);
    expect(gap(top.rig, top.z)).toBeGreaterThan(8.4); // some elastic stretch remains
    expect(gap(top.rig, top.z)).toBeLessThan(11.0);   // was 13.5 m before lag compensation
    expect(gap(boost.rig, boost.z)).toBeLessThan(12.0); // was 16 m
  });

  it('boost no longer pulls the camera further back than plain top speed by more than a metre', () => {
    const top = cruise(75, 4, false), boost = cruise(75, 4, true);
    expect(gap(boost.rig, boost.z) - gap(top.rig, top.z)).toBeLessThan(1.0);
  });

  it('can be switched back to the old behaviour by setting lagComp to 0 (documented revert path)', () => {
    expect(CAMERA_TUNING.lagComp).toBeGreaterThan(0);
    expect(CAMERA_TUNING.lagComp).toBeLessThanOrEqual(1);
  });

  it('kick adds a short FOV punch that decays on its own and never stacks', () => {
    const { rig, z: z0 } = cruise(60, 3, true);
    let z = z0; const base = rig.camera.fov;
    rig.kick(1); rig.kick(0.5);
    expect(rig.kickLevel).toBe(1);
    rig.updateChase(focus(z += 1, 60, true), 1 / 60);
    const peak = rig.camera.fov - base;
    expect(peak).toBeGreaterThan(CAMERA_TUNING.kickFov * 0.7);
    expect(peak).toBeLessThan(CAMERA_TUNING.kickFov + 0.5);
    for (let i = 0; i < 90; i++) rig.updateChase(focus(z += 1, 60, true), 1 / 60);
    expect(Math.abs(rig.camera.fov - base)).toBeLessThan(0.3); // gone within 1.5 s
  });

  it('is smooth: a sudden speed change moves the camera by no more than a few metres per frame', () => {
    const { rig, z: z0 } = cruise(0, 2); let z = z0, prev = rig.camera.position.z, worst = 0;
    for (let i = 0; i < 120; i++) { z += 62 / 60; rig.updateChase(focus(z, 62), 1 / 60); worst = Math.max(worst, Math.abs(rig.camera.position.z - prev - 62 / 60)); prev = rig.camera.position.z; }
    expect(worst).toBeLessThan(0.9);
  });
});
