import { clamp } from './math';
import { COURSE, type Course } from './trackDef';

/** Result of projecting a world position onto the circuit. Reused by callers to avoid allocations. */
export interface TrackQuery {
  /** Index of the sample at the start of the closest segment. */
  i: number;
  /** Signed lateral offset from the centre line in metres (positive = driver's right). */
  d: number;
  /** Distance along the lap in metres (0..length). */
  s: number;
  /** Centre-line height at the projected point. */
  y: number;
  /** Unit tangent at the projected point. */
  tx: number; tz: number;
}
export const newQuery = (): TrackQuery => ({ i: 0, d: 0, s: 0, y: 0, tx: 0, tz: 1 });

/**
 * A closed circuit resampled at (almost) uniform spacing. Pure data + queries — no rendering dependencies — so the
 * simulation, the AI, the scenery generator and the unit tests all share one source of truth.
 */
export class Track {
  readonly n: number;
  readonly length: number;
  readonly spacing: number;
  readonly halfWidth: number;
  readonly kerb: number;
  readonly wallOffset: number;
  readonly name: string;
  readonly x: Float32Array; readonly y: Float32Array; readonly z: Float32Array;
  /** Unit tangent (direction of travel) in the ground plane. */
  readonly tx: Float32Array; readonly tz: Float32Array;
  /** Unit "right" normal in the ground plane: (-tz, tx). */
  readonly nx: Float32Array; readonly nz: Float32Array;
  /** Cumulative distance of each sample from sample 0. */
  readonly s: Float32Array;
  /** Signed curvature (1/m). Positive = turning left (anticlockwise seen from above). */
  readonly curvature: Float32Array;
  readonly course: Course;
  private readonly cell = 32;
  private readonly grid = new Map<number, number[]>();

  constructor(course: Course = COURSE) {
    this.course = course;
    this.name = course.name;
    this.halfWidth = course.roadHalfWidth;
    this.kerb = course.kerbWidth;
    this.wallOffset = course.wallOffset;
    const dense = sampleSpline(course.points, 40);
    // cumulative length of dense polyline
    const m = dense.length;
    const cum = new Float64Array(m + 1);
    for (let i = 0; i < m; i++) {
      const a = dense[i], b = dense[(i + 1) % m];
      cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.z - a.z);
    }
    const total = cum[m];
    this.n = Math.max(64, Math.round(total / 3));
    this.length = total;
    this.spacing = total / this.n;
    this.x = new Float32Array(this.n); this.y = new Float32Array(this.n); this.z = new Float32Array(this.n);
    this.tx = new Float32Array(this.n); this.tz = new Float32Array(this.n);
    this.nx = new Float32Array(this.n); this.nz = new Float32Array(this.n);
    this.s = new Float32Array(this.n); this.curvature = new Float32Array(this.n);
    let j = 0;
    for (let i = 0; i < this.n; i++) {
      const target = i * this.spacing;
      while (j < m - 1 && cum[j + 1] < target) j++;
      const a = dense[j], b = dense[(j + 1) % m];
      const seg = cum[j + 1] - cum[j];
      const t = seg > 1e-9 ? (target - cum[j]) / seg : 0;
      this.x[i] = a.x + (b.x - a.x) * t; this.z[i] = a.z + (b.z - a.z) * t; this.y[i] = a.y + (b.y - a.y) * t;
      this.s[i] = target;
    }
    for (let i = 0; i < this.n; i++) {
      const p = this.wrap(i - 1), q = this.wrap(i + 1);
      let dx = this.x[q] - this.x[p], dz = this.z[q] - this.z[p];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      this.tx[i] = dx; this.tz[i] = dz; this.nx[i] = -dz; this.nz[i] = dx;
    }
    // curvature from heading change, lightly smoothed
    const raw = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const p = this.wrap(i - 2), q = this.wrap(i + 2);
      const h0 = Math.atan2(this.tx[p], this.tz[p]), h1 = Math.atan2(this.tx[q], this.tz[q]);
      let dh = h1 - h0; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      raw[i] = dh / (4 * this.spacing);
    }
    for (let i = 0; i < this.n; i++) {
      let sum = 0; for (let k = -2; k <= 2; k++) sum += raw[this.wrap(i + k)];
      this.curvature[i] = sum / 5;
    }
    for (let i = 0; i < this.n; i++) {
      const key = this.cellKey(Math.floor(this.x[i] / this.cell), Math.floor(this.z[i] / this.cell));
      const arr = this.grid.get(key); if (arr) arr.push(i); else this.grid.set(key, [i]);
    }
  }

  wrap(i: number): number { return ((i % this.n) + this.n) % this.n; }
  private cellKey(cx: number, cz: number): number { return (cx + 512) * 1024 + (cz + 512); }

  /** Distance along the lap wrapped to [0, length). */
  wrapS(s: number): number { return ((s % this.length) + this.length) % this.length; }

  /** Projects (px, pz) onto segment i..i+1. Writes into `out`; returns squared distance to the centre line. */
  private project(px: number, pz: number, i: number, out: TrackQuery): number {
    const j = this.wrap(i + 1);
    const ax = this.x[i], az = this.z[i];
    const sx = this.x[j] - ax, sz = this.z[j] - az;
    const len2 = sx * sx + sz * sz || 1;
    const t = clamp(((px - ax) * sx + (pz - az) * sz) / len2, 0, 1);
    const cx = ax + sx * t, cz = az + sz * t;
    // interpolated tangent / normal
    let tx = this.tx[i] + (this.tx[j] - this.tx[i]) * t, tz = this.tz[i] + (this.tz[j] - this.tz[i]) * t;
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const dx = px - cx, dz = pz - cz;
    out.i = i; out.d = dx * -tz + dz * tx;
    out.s = this.s[i] + t * this.spacing;
    out.y = this.y[i] + (this.y[j] - this.y[i]) * t;
    out.tx = tx; out.tz = tz;
    return dx * dx + dz * dz;
  }

  /**
   * Closest point on the circuit. With a `hint` index only a window around it is searched (cheap, continuous),
   * falling back to a global search if the position has moved far from the hint (respawn, teleport).
   */
  query(px: number, pz: number, hint: number, out: TrackQuery): TrackQuery {
    if (hint >= 0) {
      let best = Infinity; const tmp = newQuery();
      const W = 14;
      for (let k = -W; k <= W; k++) {
        const d2 = this.project(px, pz, this.wrap(hint + k), tmp);
        if (d2 < best) { best = d2; out.i = tmp.i; out.d = tmp.d; out.s = tmp.s; out.y = tmp.y; out.tx = tmp.tx; out.tz = tmp.tz; }
      }
      if (best < 30 * 30) return out;
    }
    let best = Infinity; const tmp = newQuery();
    for (let i = 0; i < this.n; i++) {
      const d2 = this.project(px, pz, i, tmp);
      if (d2 < best) { best = d2; out.i = tmp.i; out.d = tmp.d; out.s = tmp.s; out.y = tmp.y; out.tx = tmp.tx; out.tz = tmp.tz; }
    }
    return out;
  }

  /**
   * Spatial-hash nearest search used for terrain and scenery generation. Returns null when nothing is within `maxDist`.
   * `out.d` is the *absolute* distance in this variant's `dist` return value; use `query` for signed offsets.
   */
  nearest(px: number, pz: number, maxDist: number, out: TrackQuery): number {
    const cx = Math.floor(px / this.cell), cz = Math.floor(pz / this.cell);
    const r = Math.ceil(maxDist / this.cell) + 1;
    let best = Infinity; const tmp = newQuery();
    for (let ix = cx - r; ix <= cx + r; ix++) for (let iz = cz - r; iz <= cz + r; iz++) {
      const arr = this.grid.get(this.cellKey(ix, iz)); if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const base = arr[k];
        for (let o = -1; o <= 0; o++) {
          const d2 = this.project(px, pz, this.wrap(base + o), tmp);
          if (d2 < best) { best = d2; out.i = tmp.i; out.d = tmp.d; out.s = tmp.s; out.y = tmp.y; out.tx = tmp.tx; out.tz = tmp.tz; }
        }
      }
    }
    return best === Infinity ? -1 : Math.sqrt(best);
  }

  /** World position and heading at distance `s` along the lap, offset `lat` metres to the right. */
  pointAt(s: number, lat: number, out: { x: number; y: number; z: number; heading: number; tx: number; tz: number }): void {
    const f = this.wrapS(s) / this.spacing;
    const i = Math.floor(f) % this.n, j = (i + 1) % this.n, t = f - Math.floor(f);
    let tx = this.tx[i] + (this.tx[j] - this.tx[i]) * t, tz = this.tz[i] + (this.tz[j] - this.tz[i]) * t;
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    out.x = this.x[i] + (this.x[j] - this.x[i]) * t - tz * lat;
    out.z = this.z[i] + (this.z[j] - this.z[i]) * t + tx * lat;
    out.y = this.y[i] + (this.y[j] - this.y[i]) * t;
    out.heading = Math.atan2(tx, tz); out.tx = tx; out.tz = tz;
  }

  /**
   * Highest safe speed (m/s) per sample. `cornerSpeed(k)` gives the cornering limit for an absolute curvature `k`; a backwards
   * pass (run twice around the loop) then makes sure a car can always slow down in time for the corner ahead.
   */
  speedProfile(vTop: number, cornerSpeed: (k: number) => number, aBrake: number): Float32Array {
    const v = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      let k = 0; for (let o = -3; o <= 3; o++) k = Math.max(k, Math.abs(this.curvature[this.wrap(i + o)]));
      v[i] = Math.min(vTop, cornerSpeed(k));
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = this.n * 2 - 1; i >= 0; i--) {
        const a = this.wrap(i), b = this.wrap(i + 1);
        const lim = Math.sqrt(v[b] * v[b] + 2 * aBrake * this.spacing);
        if (v[a] > lim) v[a] = lim;
      }
    }
    return v;
  }
}

interface P3 { x: number; y: number; z: number }

/** Centripetal Catmull-Rom through a closed list of control points (avoids loops and overshoot). */
function sampleSpline(pts: readonly P3[], perSegment: number): P3[] {
  const out: P3[] = [];
  const n = pts.length;
  const alpha = 0.5;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const t0 = 0;
    const t1 = t0 + Math.pow(Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1, alpha);
    const t2 = t1 + Math.pow(Math.hypot(p2.x - p1.x, p2.z - p1.z) || 1, alpha);
    const t3 = t2 + Math.pow(Math.hypot(p3.x - p2.x, p3.z - p2.z) || 1, alpha);
    for (let k = 0; k < perSegment; k++) {
      const t = t1 + ((t2 - t1) * k) / perSegment;
      const ev = (c: 'x' | 'y' | 'z'): number => {
        const a1 = ((t1 - t) / (t1 - t0)) * p0[c] + ((t - t0) / (t1 - t0)) * p1[c];
        const a2 = ((t2 - t) / (t2 - t1)) * p1[c] + ((t - t1) / (t2 - t1)) * p2[c];
        const a3 = ((t3 - t) / (t3 - t2)) * p2[c] + ((t - t2) / (t3 - t2)) * p3[c];
        const b1 = ((t2 - t) / (t2 - t0)) * a1 + ((t - t0) / (t2 - t0)) * a2;
        const b2 = ((t3 - t) / (t3 - t1)) * a2 + ((t - t1) / (t3 - t1)) * a3;
        return ((t2 - t) / (t2 - t1)) * b1 + ((t - t1) / (t2 - t1)) * b2;
      };
      out.push({ x: ev('x'), y: ev('y'), z: ev('z') });
    }
  }
  return out;
}
