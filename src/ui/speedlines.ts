/** Cheap radial streak overlay for speed and boost. Skipped entirely under reduced motion. */
export class SpeedLines {
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1; private h = 1;
  private readonly seeds: { a: number; r0: number; len: number; ph: number }[] = [];
  private t = 0; private lastIntensity = 0;
  constructor(private readonly canvas: HTMLCanvasElement, public enabled = true) {
    this.ctx = canvas.getContext('2d');
    for (let i = 0; i < 46; i++) this.seeds.push({ a: (i / 46) * Math.PI * 2 + (i % 3) * 0.05, r0: 0.45 + ((i * 37) % 17) / 40, len: 0.12 + ((i * 53) % 11) / 60, ph: (i * 0.37) % 1 });
  }
  resize(cssW: number, cssH: number): void {
    this.w = this.canvas.width = Math.max(2, Math.round(cssW * 0.6)); this.h = this.canvas.height = Math.max(2, Math.round(cssH * 0.6));
  }
  /** `intensity` 0..1. */
  update(dt: number, intensity: number, boost: boolean): void {
    const c = this.ctx; if (!c) return;
    const k = this.enabled ? intensity : 0;
    if (k < 0.02) { if (this.lastIntensity >= 0.02) c.clearRect(0, 0, this.w, this.h); this.lastIntensity = k; return; }
    this.lastIntensity = k; this.t += dt * (1.5 + k * 3);
    c.clearRect(0, 0, this.w, this.h);
    const cx = this.w / 2, cy = this.h * 0.46, R = Math.hypot(this.w, this.h) / 2;
    c.lineCap = 'round';
    for (const s of this.seeds) {
      const p = (s.ph + this.t) % 1;
      const r1 = R * (s.r0 + p * 0.55), r2 = r1 + R * s.len * (0.4 + k);
      const al = Math.sin(p * Math.PI) * k * 0.55;
      c.strokeStyle = boost ? `rgba(160,225,255,${al})` : `rgba(255,255,255,${al * 0.7})`; c.lineWidth = 1 + k * 2;
      c.beginPath(); c.moveTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1 * 0.8); c.lineTo(cx + Math.cos(s.a) * r2, cy + Math.sin(s.a) * r2 * 0.8); c.stroke();
    }
  }
}
