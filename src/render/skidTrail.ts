/**
 * Lays tyre marks along the *actual* path of a contact patch.
 *
 * Each mark is a segment from the previous mark point to the current one: it is centred between them, rotated to the
 * direction of travel and as long as the gap plus a little overlap, so consecutive marks join into a continuous line at
 * any speed. (The old version stamped a fixed 0.9 m decal on a timer, oriented from heading and slip with the wrong
 * sign, which left dashes that pointed away from the path.) Pure maths, no rendering, unit-tested.
 */
export interface SkidSegment { x: number; z: number; heading: number; length: number }

export const SKID = { spacing: 1.8, overlap: 0.3, maxGap: 12 } as const;

export class SkidTrail {
  private lx = 0; private lz = 0; private active = false;
  private readonly seg: SkidSegment = { x: 0, z: 0, heading: 0, length: 0 };

  /** Call every frame the wheel is skidding. Returns a segment to stamp, or null while still within `spacing`. */
  update(x: number, z: number): SkidSegment | null {
    if (!this.active) { this.lx = x; this.lz = z; this.active = true; return null; }
    const dx = x - this.lx, dz = z - this.lz;
    const d = Math.hypot(dx, dz);
    if (d > SKID.maxGap) { this.lx = x; this.lz = z; return null; } // teleport (respawn): start a new line
    if (d < SKID.spacing) return null;
    const s = this.seg;
    s.x = (x + this.lx) / 2; s.z = (z + this.lz) / 2; s.heading = Math.atan2(dx, dz); s.length = d + SKID.overlap;
    this.lx = x; this.lz = z;
    return s;
  }

  /** The wheel stopped skidding: the next skid starts a fresh line instead of joining to the old one. */
  reset(): void { this.active = false; }
}
