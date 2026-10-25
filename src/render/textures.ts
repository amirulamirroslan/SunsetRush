import { CanvasTexture, ClampToEdgeWrapping, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { fbm2, noise2 } from '../sim/noise';
import { Rng } from '../sim/rng';

/** Procedural canvas textures. Every texture is generated at load time — no external image files. */
let maxAniso = 4;
export const setMaxAnisotropy = (n: number): void => { maxAniso = n; };

function cv(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { c, g: c.getContext('2d')! };
}
function finish(c: HTMLCanvasElement, opts: { repeatU?: boolean; repeatV?: boolean; srgb?: boolean; aniso?: boolean } = {}): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = opts.repeatU ? RepeatWrapping : ClampToEdgeWrapping;
  t.wrapT = opts.repeatV ? RepeatWrapping : ClampToEdgeWrapping;
  if (opts.srgb !== false) t.colorSpace = SRGBColorSpace;
  t.generateMipmaps = true; t.minFilter = LinearMipmapLinearFilter;
  if (opts.aniso !== false) t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

/** Road: u across (0..1 = full width), v along (one tile = 16 m). */
export function makeAsphalt(): { map: Texture; bump: Texture } {
  const W = 512, H = 512;
  const { c, g } = cv(W, H);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = fbm2(x * 0.03, y * 0.03, 3), grain = noise2(x * 1.7, y * 1.7), speck = noise2(x * 0.45 + 40, y * 0.45);
    let v = 62 + n * 20 + grain * 16 + (speck > 0.86 ? 26 : 0);
    // worn rubber lines in the two driving lanes
    const u = x / W;
    const lane = Math.exp(-Math.pow((u - 0.3) / 0.07, 2)) + Math.exp(-Math.pow((u - 0.7) / 0.07, 2));
    v -= lane * 9;
    const i = (y * W + x) * 4;
    img.data[i] = v * 1.0; img.data[i + 1] = v * 1.0; img.data[i + 2] = v * 1.03; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // bump source is the grain only (before markings)
  const bc = cv(W, H); bc.g.drawImage(c, 0, 0);
  // markings: continuous edge lines, dashed centre line
  g.fillStyle = 'rgba(244,244,236,0.93)';
  g.fillRect(W * 0.03, 0, W * 0.018, H); g.fillRect(W * 0.952, 0, W * 0.018, H);
  g.fillStyle = 'rgba(255,214,102,0.92)';
  g.fillRect(W * 0.492, 0, W * 0.016, H * 0.25); g.fillRect(W * 0.492, H * 0.5, W * 0.016, H * 0.25);
  // fade the paint a little so it looks weathered
  const paint = g.getImageData(0, 0, W, H);
  for (let i = 0; i < paint.data.length; i += 4) { const j = ((i / 4) % W) * 0.37 + Math.floor(i / 4 / W) * 0.91; const w = 0.88 + 0.12 * noise2(j, j * 0.3); paint.data[i] *= w; paint.data[i + 1] *= w; paint.data[i + 2] *= w; }
  g.putImageData(paint, 0, 0);
  return { map: finish(c, { repeatV: true }), bump: finish(bc.c, { repeatV: true, srgb: false }) };
}

/** Kerb: red/white stripes along v (one tile = 7.2 m, 4 stripes). */
export function makeKerb(): Texture {
  const { c, g } = cv(64, 128);
  const cols = ['#f5f1e6', '#e4372f', '#f5f1e6', '#e4372f'];
  cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 32, 64, 32); });
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 4, 128);
  return finish(c, { repeatV: true });
}

/** Concrete barrier: alternating white/coral blocks with a dark cap line. u across the profile, v along (one tile = 12 m). */
export function makeBarrier(): Texture {
  // u: 0..1 across the extruded profile (road face, painted rail, top, back); v: 12 m of wall per tile (three 4 m panels)
  const W = 128, Hh = 384, { c, g } = cv(W, Hh);
  const rng = new Rng(5);
  g.fillStyle = '#a4a9b4'; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 2600; i++) { const v = rng.range(0, 1); g.fillStyle = v < 0.5 ? `rgba(60,56,50,${rng.range(0.03, 0.09)})` : `rgba(255,250,240,${rng.range(0.03, 0.08)})`; g.fillRect(rng.range(0, W), rng.range(0, Hh), rng.range(1, 4), rng.range(1, 4)); }
  // painted rail on the upper face (second quarter): alternating red / off-white blocks
  g.fillStyle = '#eceef2'; g.fillRect(W * 0.25, 0, W * 0.25, Hh);
  g.fillStyle = '#c93a2a'; g.fillRect(W * 0.25, Hh * 0.5, W * 0.25, Hh * 0.5);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(W * 0.25, Hh * 0.5 - 2, W * 0.25, 4); g.fillRect(W * 0.25, Hh - 2, W * 0.25, 2);
  // panel joints every 4 m and a grimy foot
  g.fillStyle = 'rgba(30,28,26,0.38)'; for (let k = 0; k < 3; k++) g.fillRect(0, k * (Hh / 3) - 1, W, 3);
  const foot = g.createLinearGradient(0, 0, W * 0.25, 0); foot.addColorStop(0, 'rgba(40,36,30,0.55)'); foot.addColorStop(1, 'rgba(40,36,30,0)');
  g.fillStyle = foot; g.fillRect(0, 0, W * 0.25, Hh);
  for (let i = 0; i < 28; i++) { const x0 = rng.range(0, W * 0.25), y0 = rng.range(0, Hh); g.fillStyle = `rgba(20,18,16,${rng.range(0.05, 0.16)})`; g.fillRect(x0, y0, rng.range(1, 3), rng.range(14, 60)); }
  return finish(c, { repeatV: true });
}
export function makeShoulder(): Texture {
  const { c, g } = cv(256, 256);
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const n = fbm2(x * 0.05, y * 0.05, 3), f = noise2(x * 0.9, y * 0.9);
    const grass = [92 + n * 40 + f * 22, 138 + n * 40 + f * 22, 62 + n * 20];
    const grav = [160 + f * 40, 148 + f * 36, 118 + f * 30];
    const m = noise2(x * 0.08 + 9, y * 0.08) > 0.62 ? 0.7 : 0.0;
    const i = (y * 256 + x) * 4;
    img.data[i] = grass[0] * (1 - m) + grav[0] * m; img.data[i + 1] = grass[1] * (1 - m) + grav[1] * m; img.data[i + 2] = grass[2] * (1 - m) + grav[2] * m; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return finish(c, { repeatU: true, repeatV: true });
}

/** Fine detail multiplied over the terrain vertex colours (8 m per tile). */
export function makeGroundDetail(): Texture {
  const { c, g } = cv(256, 256);
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    // tileable noise: sample on a torus
    const a = (x / 256) * Math.PI * 2, b = (y / 256) * Math.PI * 2;
    const n = fbm2(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + Math.cos(b) * 3, 3) * 0.5 + fbm2(Math.sin(b) * 6, Math.cos(b) * 6 + Math.cos(a) * 6, 2) * 0.5;
    const f = noise2(x * 0.8, y * 0.8);
    const v = 196 + n * 38 + f * 12;
    const i = (y * 256 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, v); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return finish(c, { repeatU: true, repeatV: true });
}

/** Boost pad chevrons (additive). u across, v along. */
export function makeChevron(): Texture {
  const { c, g } = cv(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(20,120,255,0.20)'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3; i++) {
    const y = i * 85 + 10;
    const grd = g.createLinearGradient(0, y, 0, y + 60);
    grd.addColorStop(0, 'rgba(120,240,255,1)'); grd.addColorStop(1, 'rgba(40,160,255,0.5)');
    g.fillStyle = grd; g.beginPath();
    g.moveTo(20, y + 60); g.lineTo(128, y); g.lineTo(236, y + 60); g.lineTo(236, y + 84); g.lineTo(128, y + 26); g.lineTo(20, y + 84); g.closePath(); g.fill();
  }
  g.strokeStyle = 'rgba(160,240,255,0.9)'; g.lineWidth = 6; g.strokeRect(4, 0, 248, 256);
  return finish(c, { repeatV: true });
}

export function makeChecker(cols: number, rows: number, a = '#ffffff', b = '#15161c'): Texture {
  const { c, g } = cv(cols * 32, rows * 32);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { g.fillStyle = (x + y) % 2 ? b : a; g.fillRect(x * 32, y * 32, 32, 32); }
  return finish(c, { repeatU: true, repeatV: true });
}

export function makeGlow(): CanvasTexture {
  const { c, g } = cv(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return finish(c, { aniso: false });
}

/** Soft elliptical contact shadow under each car. */
export function makeBlob(): CanvasTexture {
  const { c, g } = cv(128, 128);
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return finish(c, { aniso: false });
}

/** Tyre-mark stamp. */
export function makeSkid(): CanvasTexture {
  const { c, g } = cv(32, 64);
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(10,10,12,0)'); gr.addColorStop(0.2, 'rgba(10,10,12,0.75)'); gr.addColorStop(0.8, 'rgba(10,10,12,0.75)'); gr.addColorStop(1, 'rgba(10,10,12,0)');
  g.fillStyle = gr; g.fillRect(6, 0, 20, 64);
  return finish(c, { aniso: false });
}

export interface BannerSpec { text: string; sub?: string; bg: [string, string]; fg: string; accent: string }
export function makeBanner(s: BannerSpec, w = 512, h = 192): CanvasTexture {
  const { c, g } = cv(w, h);
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, s.bg[0]); gr.addColorStop(1, s.bg[1]);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = s.accent; g.beginPath(); g.moveTo(w * 0.62, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(w * 0.5, h); g.closePath(); g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1;
  g.fillStyle = s.fg; g.font = `italic 800 ${Math.round(h * 0.5)}px "Barlow Condensed", "Avenir Next", "Segoe UI", system-ui, sans-serif`; g.textBaseline = 'middle';
  g.fillText(s.text, w * 0.06, h * (s.sub ? 0.4 : 0.52));
  if (s.sub) { g.font = `700 ${Math.round(h * 0.17)}px "Barlow Condensed", "Avenir Next", "Segoe UI", system-ui, sans-serif`; g.globalAlpha = 0.85; g.fillText(s.sub, w * 0.065, h * 0.78); g.globalAlpha = 1; }
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  return finish(c);
}

/** Transparent overlay with the lane markings and worn-rubber lines (u across the road, v along: one tile = 16 m). */
export function makeRoadMarkings(): Texture {
  const W = 512, H = 512;
  const { c, g } = cv(W, H);
  // darker, slightly shiny rubbered-in racing lines
  for (const u of [0.3, 0.7]) {
    const grd = g.createLinearGradient(W * (u - 0.1), 0, W * (u + 0.1), 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(8,8,10,0.2)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(W * (u - 0.1), 0, W * 0.2, H);
  }
  g.fillStyle = 'rgba(244,244,236,0.95)';
  g.fillRect(W * 0.03, 0, W * 0.018, H); g.fillRect(W * 0.952, 0, W * 0.018, H);
  g.fillStyle = 'rgba(255,208,92,0.95)';
  g.fillRect(W * 0.492, 0, W * 0.016, H * 0.25); g.fillRect(W * 0.492, H * 0.5, W * 0.016, H * 0.25);
  // chip the paint so it reads as worn, not printed
  const img = g.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (img.data[i + 3] < 200) continue;
    const w = noise2(x * 0.55, y * 0.55) * 0.5 + noise2(x * 0.09 + 7, y * 0.09) * 0.5;
    if (w < 0.3) img.data[i + 3] *= 0.35 + w;
  }
  g.putImageData(img, 0, 0);
  return finish(c, { repeatV: true });
}

/**
 * Road wear overlay (alpha map for a near-black, slightly glossy layer): worn rubber in the two wheel tracks, grime along the edges,
 * resurfaced patches with sealed outlines, crack lines and oil drips. u across the road (0..1), v along it, one tile = 24 m; tiles seamlessly in v.
 */
export function makeRoadWear(): Texture {
  const W = 256, H = 512, TAU = Math.PI * 2;
  const { c, g } = cv(W, H);
  const img = g.createImageData(W, H);
  // v-periodic noise: walk a circle in noise space so the tile joins itself
  const pn = (u: number, v: number, sc: number, o: number): number => fbm2(u * sc + Math.cos(v * TAU) * sc * 0.8 + o, Math.sin(v * TAU) * sc * 0.8 + o * 0.5, 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const mott = pn(u * 3, v, 2.2, 5);
    const track = (cx: number): number => Math.exp(-Math.pow((u - cx) / 0.055, 2));
    const wheel = (track(0.3) + track(0.7)) * (0.22 + 0.2 * mott);
    const between = Math.exp(-Math.pow((u - 0.5) / 0.09, 2)) * 0.05 * mott;
    const edge = (Math.pow(Math.max(0, 0.1 - u) / 0.1, 1.6) + Math.pow(Math.max(0, u - 0.9) / 0.1, 1.6)) * (0.25 + 0.2 * pn(u, v, 6, 9));
    const grain = (noise2(x * 0.9, y * 0.9) - 0.5) * 0.04;
    const a = Math.max(0, Math.min(1, wheel + between + edge + grain));
    const i = (y * W + x) * 4; const b = Math.round(a * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const rng = new Rng(404);
  // resurfaced patches: slightly darker rectangles with a harder, sealed edge
  for (let k = 0; k < 5; k++) {
    const w = rng.range(0.16, 0.38) * W, h = rng.range(0.05, 0.12) * H, x = rng.range(0.05, 0.9) * W - w / 2, y = rng.range(0, 1) * H;
    for (const oy of [0, -H, H]) {
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x, y + oy, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.6; g.strokeRect(x, y + oy, w, h);
    }
  }
  // sealed cracks running across the road
  g.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const y0 = rng.range(0, 1) * H, x0 = rng.range(0.0, 0.6) * W, len = rng.range(0.25, 0.7) * W; let x = x0, y = y0;
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = rng.range(1.1, 2);
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 14; s++) { x += len / 14; y += rng.range(-5, 5); g.lineTo(x, y); }
    g.stroke();
  }
  // oil drips in the wheel tracks
  for (let k = 0; k < 9; k++) {
    const x = (rng.next() < 0.5 ? 0.3 : 0.7) * W + rng.range(-14, 14), y = rng.range(0, 1) * H, r = rng.range(4, 11);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  return finish(c, { repeatV: true, srgb: false });
}

/** Braking-distance boards: three cells (1, 2, 3 red bars on white), 128 x 256 each. */
export function makeBrakeBoards(): Texture {
  const { c, g } = cv(384, 256);
  for (let n = 1; n <= 3; n++) {
    const x0 = (n - 1) * 128;
    g.fillStyle = '#f6f2ea'; g.fillRect(x0, 0, 128, 256);
    g.fillStyle = '#d4272b';
    for (let k = 0; k < n; k++) { g.beginPath(); const bx = x0 + 128 - 26 - k * 34; g.moveTo(bx + 24, 0); g.lineTo(bx + 24 - 42, 256); g.lineTo(bx - 18, 256); g.lineTo(bx + 24 - 24, 0); g.closePath(); g.fill(); }
    g.strokeStyle = '#1b1d28'; g.lineWidth = 8; g.strokeRect(x0 + 4, 4, 120, 248);
  }
  return finish(c, {});
}
