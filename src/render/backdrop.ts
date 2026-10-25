import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { fbm2 } from '../sim/noise';
import { clamp01, smoothstep } from '../sim/math';
import { SUN_DIR } from './sky';

/** A ring of layered mountain ridges around the island. Fog does the atmospheric perspective: nearer rings are crisper. */
const CENTRE = { x: 50, z: -185 };

function ridge(radius: number, height: number, seed: number, freq: number, colA: number, colB: number): BufferGeometry {
  const N = 420, ROWS = 4;
  const pos = new Float32Array((N + 1) * ROWS * 3), col = new Float32Array((N + 1) * ROWS * 3), idx: number[] = [];
  const sunAz = Math.atan2(SUN_DIR.z, SUN_DIR.x);
  const a = new Color(colA), b = new Color(colB), c = new Color();
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
    const n = fbm2(ct * freq + seed, st * freq - seed, 4), n2 = fbm2(ct * freq * 3 + seed * 2, st * freq * 3, 3);
    const rid = 1 - Math.abs(n * 2 - 1), crest = Math.pow(rid, 1.5) * 0.75 + n2 * 0.35;
    // keep the sunset glow open: ridges sink where they would cover the sun
    const sunGap = 1 - 0.85 * smoothstep(0.55, 0.0, Math.abs(Math.atan2(Math.sin(th - sunAz), Math.cos(th - sunAz))));
    const h = Math.max(60, height * crest * sunGap + height * 0.3);
    const R = radius * (1 + 0.1 * (fbm2(ct * 1.3 + seed, st * 1.3, 2) - 0.5));
    for (let r = 0; r < ROWS; r++) {
      const t = r / (ROWS - 1);              // 0 = foot (outside, below sea) .. 1 = crest
      const rad = R + (1 - t) * (260 + h * 0.9) * (1 - 0.18 * n2);
      const y = -60 + (h + 60) * Math.pow(t, 0.8) + (r > 0 && r < ROWS - 1 ? (fbm2(ct * 40 + r, st * 40, 2) - 0.5) * h * 0.18 : 0);
      const k = (i * ROWS + r) * 3;
      pos[k] = CENTRE.x + ct * rad; pos[k + 1] = y; pos[k + 2] = CENTRE.z + st * rad;
      c.copy(a).lerp(b, clamp01(t * 1.15 + (n2 - 0.5) * 0.35));
      c.multiplyScalar(0.82 + 0.28 * fbm2(ct * 60 + r * 3, st * 60, 2));
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

export function buildBackdrop(): Group {
  const group = new Group();
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: false });
  const rings: [number, number, number, number, number, number][] = [
    [1450, 320, 3, 2.2, 0x4d6b4f, 0x8a7a76],
    [1900, 450, 17, 1.7, 0x4a5f6a, 0x8b7488],
    [2450, 600, 41, 1.3, 0x55587a, 0x9a7a96],
  ];
  for (const [r, h, s, f, ca, cb] of rings) { const m = new Mesh(ridge(r, h, s, f, ca, cb), mat); m.frustumCulled = false; m.userData.own = true; group.add(m); }
  return group;
}

export function disposeBackdrop(g: Group): void {
  g.traverse(o => { const m = o as Mesh; if (m.isMesh) { m.geometry.dispose(); } });
  const first = g.children[0] as Mesh | undefined; if (first) (first.material as MeshStandardMaterial).dispose();
}
