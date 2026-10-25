/** Small, allocation-free maths helpers shared by the simulation and the renderer. */
export const TAU = Math.PI * 2;
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Wraps an angle to (-PI, PI]. */
export const wrapAngle = (a: number): number => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
/** Frame-rate independent exponential smoothing factor: `x += (target - x) * damp(rate, dt)`. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
/** Shortest signed angular difference b - a. */
export const angleDiff = (a: number, b: number): number => wrapAngle(b - a);
