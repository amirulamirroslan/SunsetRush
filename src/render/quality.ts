/**
 * Graphics tiers and the performance governor. The same scene runs on every tier; tiers only change how much extra work the
 * GPU is asked to do (resolution, shadows, bloom, scenery density, particles). On "auto" the governor starts from a device
 * guess and steps down when the measured frame rate is poor. It never steps back up (no flip-flopping).
 */
export type Tier = 'high' | 'medium' | 'low';
export const TIER_ORDER: readonly Tier[] = ['high', 'medium', 'low'];

export interface TierSettings {
  /** upper bound for the renderer pixel ratio */ maxPixelRatio: number;
  shadowMap: number; shadowRange: number;
  bloom: boolean; msaa: boolean;
  /** scenery instance multiplier (trees, rocks, props) */ scenery: number;
  /** grass tufts multiplier */ tufts: number;
  /** particle pool multiplier */ particles: number;
  /** extra cloud detail in the sky shader */ cloudOctaves: number;
  /** tyre-mark decal pool */ skidMarks: number;
}

export const TIERS: Readonly<Record<Tier, TierSettings>> = {
  high: { maxPixelRatio: 2, shadowMap: 2048, shadowRange: 70, bloom: true, msaa: true, scenery: 1, tufts: 1, particles: 1, cloudOctaves: 5, skidMarks: 900 },
  medium: { maxPixelRatio: 1.5, shadowMap: 1024, shadowRange: 56, bloom: false, msaa: true, scenery: 0.7, tufts: 0.45, particles: 0.7, cloudOctaves: 4, skidMarks: 500 },
  low: { maxPixelRatio: 1.1, shadowMap: 512, shadowRange: 44, bloom: false, msaa: false, scenery: 0.45, tufts: 0, particles: 0.45, cloudOctaves: 3, skidMarks: 360 },
};

export interface DeviceHints { touch: boolean; cores?: number; memoryGb?: number; devicePixelRatio?: number; width: number; height: number }

export function initialTier(h: DeviceHints, override?: string | null): Tier {
  if (override && (TIER_ORDER as readonly string[]).includes(override)) return override as Tier;
  const cores = h.cores ?? 4, mem = h.memoryGb ?? 4;
  const pixels = h.width * h.height * Math.min(2, h.devicePixelRatio ?? 1) ** 2;
  if (h.touch) {
    if (cores <= 4 || mem <= 3) return 'low';
    return pixels > 2_600_000 ? 'low' : 'medium';
  }
  if (cores <= 2 || mem <= 2) return 'medium';
  return 'high';
}

export const MIN_PIXEL_RATIO = 0.7;

export type GovernorAction = { kind: 'pixelRatio'; value: number } | { kind: 'tier'; value: Tier };

/**
 * Watches frame times in windows and asks for cheaper rendering when the average fps is under `threshold`.
 * First lever: resolution scale (cheap and invisible-ish); second: drop a whole tier and reset the resolution.
 */
export class PerfGovernor {
  private acc = 0; private frames = 0;
  private cooldown = 3; // seconds to ignore after construction / changes (shader compile, texture upload hitches)
  constructor(public tier: Tier, public pixelRatio: number, private readonly threshold = 42, private readonly windowSeconds = 2.5, public enabled = true) {}

  update(dt: number): GovernorAction | null {
    if (!this.enabled) return null;
    if (this.cooldown > 0) { this.cooldown -= dt; return null; }
    if (dt > 0.5) return null; // tab was hidden / paused
    this.acc += dt; this.frames++;
    if (this.acc < this.windowSeconds) return null;
    const fps = this.frames / this.acc;
    this.acc = 0; this.frames = 0;
    if (fps >= this.threshold) return null;
    this.cooldown = 2;
    if (this.pixelRatio > MIN_PIXEL_RATIO + 0.01 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(MIN_PIXEL_RATIO, Math.round((this.pixelRatio - 0.25) * 100) / 100);
      return { kind: 'pixelRatio', value: this.pixelRatio };
    }
    const i = TIER_ORDER.indexOf(this.tier);
    if (i < TIER_ORDER.length - 1) {
      this.tier = TIER_ORDER[i + 1];
      this.pixelRatio = Math.min(this.pixelRatio, TIERS[this.tier].maxPixelRatio);
      return { kind: 'tier', value: this.tier };
    }
    if (this.pixelRatio > MIN_PIXEL_RATIO + 0.01) {
      this.pixelRatio = Math.max(MIN_PIXEL_RATIO, this.pixelRatio - 0.15);
      return { kind: 'pixelRatio', value: this.pixelRatio };
    }
    return null;
  }
}
