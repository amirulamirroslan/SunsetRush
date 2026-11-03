import { BackSide, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import { fbm2 } from '../sim/noise';
import { clamp01, smoothstep } from '../sim/math';
import { sunElevationDeg, type Atmosphere } from './atmosphere';

/**
 * A ring of layered mountain ranges around the island. Fog does the atmospheric perspective: nearer rings are crisper.
 * Each ring is a surface of columns × rows: ridged multi-octave crests give jagged, believable silhouettes, per-row noise cuts
 * vertical gullies into the flanks, and vertex colour carries strata, a darker lee side and a tree-line on the lower slopes.
 */
const CENTRE = { x: 50, z: -185 };

interface RingSpec { radius: number; height: number; seed: number; freq: number; low: number; high: number; crag: number; tree: number; /** snow cover on the upper flanks, 0..1 */ snow: number }

const ridged = (x: number, y: number, oct: number): number => 1 - Math.abs(fbm2(x, y, oct) * 2 - 1);

function ridge(s: RingSpec, N: number, ROWS: number, atm: Atmosphere): BufferGeometry {
  const { radius, height, seed, freq, crag } = s;
  const pos = new Float32Array((N + 1) * ROWS * 3), col = new Float32Array((N + 1) * ROWS * 3), idx: number[] = [];
  const sunAz = Math.atan2(atm.sunDir.z, atm.sunDir.x);
  // only a low sun needs an open gap in the ranges; a high daylight sun never sits behind them
  const gapK = smoothstep(32, 8, sunElevationDeg(atm));
  const tint = new Color(atm.rockTint);
  const lo = new Color(s.low).multiply(tint), hi = new Color(s.high).multiply(tint), tree = new Color(0x2f5a3a).multiply(tint), snowCol = new Color(0xf1f5f9).multiply(tint), c = new Color();
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
    // wrap-safe noise coordinates: sample on a circle so column N joins column 0 exactly
    const n = fbm2(ct * freq + seed, st * freq - seed, 4), n2 = fbm2(ct * freq * 3 + seed * 2, st * freq * 3, 3);
    const spire = Math.pow(ridged(ct * freq * 2.3 + seed * 5, st * freq * 2.3 + 2, 4), 2.4);   // sharp peaks
    const rid = 1 - Math.abs(n * 2 - 1), crest = Math.pow(rid, 1.5) * 0.62 + n2 * 0.3 + spire * 0.34 * crag;
    // low-sun presets keep the glow open: ranges sink where they would cover the sun
    const sunGap = 1 - 0.85 * gapK * smoothstep(0.55, 0.0, Math.abs(Math.atan2(Math.sin(th - sunAz), Math.cos(th - sunAz))));
    const h = Math.max(60, height * crest * sunGap + height * 0.28);
    const R = radius * (1 + 0.1 * (fbm2(ct * 1.3 + seed, st * 1.3, 2) - 0.5));
    // darker where the flank faces away from the sun (the lee), brighter on the sun-facing side
    const facing = Math.cos(th - sunAz);
    for (let r = 0; r < ROWS; r++) {
      const t = r / (ROWS - 1);              // 0 = foot (outside, below sea) .. 1 = crest
      // gullies: vertical striations that deepen toward the crest and swing the surface in and out
      const gully = (ridged(ct * freq * 9 + seed * 3 + r * 0.05, st * freq * 9 - seed, 3) - 0.5) * crag;
      const rad = R + (1 - t) * (260 + h * 0.9) * (1 - 0.18 * n2) + gully * h * 0.42 * t * (1 - t) * 3.2;
      const y = -60 + (h + 60) * Math.pow(t, 0.8) + (r > 0 && r < ROWS - 1 ? (fbm2(ct * 40 + r, st * 40, 2) - 0.5) * h * 0.2 + gully * h * 0.1 : 0);
      const k = (i * ROWS + r) * 3;
      pos[k] = CENTRE.x + ct * rad; pos[k + 1] = y; pos[k + 2] = CENTRE.z + st * rad;
      const strata = 0.9 + 0.1 * Math.sin(y * 0.07 + fbm2(ct * 25, st * 25, 2) * 6);
      c.copy(lo).lerp(hi, clamp01(t * 1.15 + (n2 - 0.5) * 0.35 + gully * 0.55));
      // forested lower flanks: a ragged tree-line instead of a clean colour gradient
      const lineY = (h + 60) * (0.18 + 0.18 * fbm2(ct * 30, st * 30, 2));
      c.lerp(tree, s.tree * (1 - smoothstep(lineY * 0.6, lineY + 25, y + 60)) * 0.8);
      // snow on the upper flanks: a ragged line that sits lower in the gullies and on the lee side
      c.lerp(snowCol, s.snow * smoothstep(0.58, 0.8, t + (n2 - 0.5) * 0.3 - gully * 0.25));
      c.multiplyScalar((0.78 + 0.3 * fbm2(ct * 60 + r * 3, st * 60, 2)) * strata * (0.88 + 0.12 * facing) * (1 - 0.18 * Math.max(0, gully)));
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
  }
  for (let i = 0; i < N; i++) for (let r = 0; r < ROWS - 1; r++) {
    const p = i * ROWS + r, q = (i + 1) * ROWS + r;
    idx.push(p, q, p + 1, q, q + 1, p + 1); // wound to face the island: the ring is only ever seen from inside
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('color', new BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // the surface faces the island but should be lit as a mountain flank (normals up and away from the centre), so flip them back
  const nrm = g.getAttribute('normal') as BufferAttribute; for (let k = 0; k < nrm.array.length; k++) nrm.array[k] = -nrm.array[k];
  return g;
}

export function buildBackdrop(atm: Atmosphere): Group {
  const group = new Group();
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: false });
  // far → near; each range is a little taller and hazier the further out it sits (fog adds the rest)
  const rings: RingSpec[] = [
    { radius: 1450, height: 330, seed: 3, freq: 2.2, low: 0x42613e, high: 0x6a6963, crag: 0.9, tree: 0.9, snow: 0 },
    { radius: 1900, height: 460, seed: 17, freq: 1.7, low: 0x445a4c, high: 0x666a70, crag: 1.0, tree: 0.55, snow: 0.35 },
    { radius: 2450, height: 610, seed: 41, freq: 1.3, low: 0x4c5e70, high: 0x808893, crag: 1.1, tree: 0.25, snow: 0.8 },
    { radius: 3100, height: 520, seed: 73, freq: 1.0, low: 0x5a6e84, high: 0x929daa, crag: 0.8, tree: 0, snow: 0.6 },
  ];
  for (const s of rings) { const m = new Mesh(ridge(s, 520, 9, atm), mat); m.frustumCulled = false; m.userData.own = true; group.add(m); }
  group.add(mistBanks(atm));
  return group;
}

/**
 * Low mist banks hugging the valley floor between the island and the first range. A tileable noise strip fades out vertically, so the
 * layers behind it lose contrast (depth separation) and the base of the mountains melts into the haze instead of ending in a hard line.
 */
function mistBanks(atm: Atmosphere): Mesh {
  const W = 1024, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!, img = g.createImageData(W, H);
  for (let x = 0; x < W; x++) {
    const a = (x / W) * Math.PI * 2, cx = Math.cos(a) * 3.2, cz = Math.sin(a) * 3.2;     // wrap-safe: sample on a circle
    const top = 0.35 + 0.55 * fbm2(cx + 11, cz - 4, 4);                                  // where the bank peaks, 0..1 of the strip height
    const dens = 0.35 + 0.65 * smoothstep(0.35, 0.75, fbm2(cx * 2 + 40, cz * 2, 3));
    for (let y = 0; y < H; y++) {
      const v = 1 - y / (H - 1);                                                         // 1 at the bottom of the strip
      const fall = clamp01(1 - Math.max(0, (1 - v) - (1 - top)) / 0.45);                 // soft upper edge, ragged per column
      const a8 = Math.round(255 * clamp01(Math.pow(v * 0.75 + 0.25, 1.4)) * fall * dens);
      const i = (y * W + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a8;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; tex.wrapS = RepeatWrapping;
  const geo = new CylinderGeometry(1240, 1240, 230, 96, 1, true);
  const mat = new MeshBasicMaterial({ map: tex, color: new Color(atm.fog).lerp(new Color(atm.mist), 0.6), transparent: true, opacity: atm.mistOpacity, depthWrite: false, side: BackSide, fog: false });
  const m = new Mesh(geo, mat); m.position.set(CENTRE.x, 25, CENTRE.z); m.frustumCulled = false; m.renderOrder = -500; m.userData.mist = true;
  return m;
}

export function disposeBackdrop(g: Group): void {
  g.traverse(o => { const m = o as Mesh; if (m.isMesh) { m.geometry.dispose(); if (m.userData.mist) { const mm = m.material as MeshBasicMaterial; mm.map?.dispose(); mm.dispose(); } } });
  const first = g.children[0] as Mesh | undefined; if (first) (first.material as MeshStandardMaterial).dispose();
}
