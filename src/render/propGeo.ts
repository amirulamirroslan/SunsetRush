import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CatmullRomCurve3, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm2 } from '../sim/noise';
import { Rng } from '../sim/rng';

/** Collects primitive parts into one vertex-coloured, non-indexed geometry (one draw call, one material). */
export class GeoBuilder {
  private readonly parts: BufferGeometry[] = [];
  add(g: BufferGeometry, color: number | ((x: number, y: number, z: number) => Color), m?: Matrix4): this {
    const x = g.index ? g.toNonIndexed() : g.clone();
    x.deleteAttribute('uv');
    if (m) x.applyMatrix4(m);
    const pos = x.getAttribute('position'), col = new Float32Array(pos.count * 3);
    const c = new Color(typeof color === 'number' ? color : 0xffffff);
    for (let i = 0; i < pos.count; i++) {
      const cc = typeof color === 'number' ? c : color(pos.getX(i), pos.getY(i), pos.getZ(i));
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    x.setAttribute('color', new BufferAttribute(col, 3));
    this.parts.push(x);
    return this;
  }
  build(): BufferGeometry {
    const g = mergeGeometries(this.parts)!;
    this.parts.forEach(p => p.dispose());
    g.computeBoundingSphere();
    return g;
  }
}

const M = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0): Matrix4 =>
  new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationY(ry)).multiply(new Matrix4().makeRotationX(rx))
    .multiply(new Matrix4().makeRotationZ(rz)).multiply(new Matrix4().makeScale(sx, sy, sz));
export { M as xform };

const lerpC = (a: number, b: number, t: number): Color => new Color(a).lerp(new Color(b), Math.min(1, Math.max(0, t)));

/** A curved leaf blade (palm frond) as a smooth strip. */
function frond(len: number, width: number, droop: number, segs = 5): BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.06)), 0.8);
    const y = t * 0.9 - droop * t * t, z = t * len;
    pos.push(-w, y, z, w, y - 0.04, z);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function palmGeometry(seed = 1): BufferGeometry {
  const rng = new Rng(seed), b = new GeoBuilder();
  const lean = 1.3, H = 7.2;
  const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(lean * 0.15, H * 0.35, 0), new Vector3(lean * 0.55, H * 0.7, 0), new Vector3(lean, H, 0)]);
  const trunk = new TubeGeometry(curve, 7, 0.24, 6, false);
  b.add(trunk, (_x, y) => lerpC(0x5e6068, 0x8c8f98, (Math.sin(y * 5) * 0.5 + 0.5) * 0.7 + y / H * 0.3));
  const top = new Vector3(lean, H, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rng.range(-0.15, 0.15), up = rng.range(-0.1, 0.55);
    const f = frond(rng.range(3.0, 3.9), 0.62, rng.range(1.4, 2.4), 5);
    const m = new Matrix4().makeTranslation(top.x, top.y + 0.1, top.z).multiply(new Matrix4().makeRotationY(a)).multiply(new Matrix4().makeRotationX(-up));
    b.add(f, (_x, y, z) => lerpC(0x1f7040, 0x5cb25c, z / 4 * 0.8 + y * 0.1 + 0.15), m);
  }
  for (let i = 0; i < 3; i++) b.add(new SphereGeometry(0.2, 7, 5), 0x4a3d2e, new Matrix4().makeTranslation(top.x + Math.cos(i * 2.1) * 0.3, top.y - 0.2, Math.sin(i * 2.1) * 0.3));
  return b.build();
}

export function broadleafGeometry(seed = 2): BufferGeometry {
  const rng = new Rng(seed), b = new GeoBuilder();
  b.add(new CylinderGeometry(0.22, 0.36, 3.2, 6), 0x5a4c3e, M(0, 1.6, 0));
  for (let i = 0; i < 4; i++) {
    const r = rng.range(1.5, 2.1), x = rng.range(-0.9, 0.9), z = rng.range(-0.9, 0.9), y = 3.6 + i * 0.5 + rng.range(-0.2, 0.4);
    const ico = new IcosahedronGeometry(r, 1);
    b.add(ico, (_px, py) => lerpC(0x22703f, 0x62b560, (py + r) / (2 * r) * 0.9), M(x, y, z, 1, 0.85, 1));
  }
  return b.build();
}

export function pineGeometry(): BufferGeometry {
  const b = new GeoBuilder();
  b.add(new CylinderGeometry(0.15, 0.25, 1.6, 6), 0x4a3d2e, M(0, 0.8, 0));
  for (let i = 0; i < 4; i++) {
    const r = 1.9 - i * 0.38, h = 2.4 - i * 0.2;
    b.add(new ConeGeometry(r, h, 8), (_x, y) => lerpC(0x1f5f3a, 0x3f8f4a, (y + h / 2) / h), M(0, 1.9 + i * 1.15, 0));
  }
  return b.build();
}

export function rockGeometry(seed = 3): BufferGeometry {
  const g = new IcosahedronGeometry(1, 1);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 0.78 + fbm2(x * 1.7 + seed, z * 1.7 + y * 1.3, 2) * 0.55;
    pos.setXYZ(i, x * n, y * n * 0.8, z * n);
  }
  g.computeVertexNormals();
  const b = new GeoBuilder();
  b.add(g, (x, y, z) => lerpC(0x5a5e68, 0x9a9da8, (y + 0.8) / 1.6 * 0.6 + fbm2(x * 3, z * 3, 2) * 0.4));
  const out = b.build();
  return out;
}

export function bushGeometry(): BufferGeometry {
  const b = new GeoBuilder();
  for (const [x, z, r] of [[0, 0, 0.9], [0.6, 0.3, 0.6], [-0.5, 0.35, 0.55]] as [number, number, number][])
    b.add(new IcosahedronGeometry(r, 1), (_x, y) => lerpC(0x226b3f, 0x5aae5e, (y + r) / (2 * r)), M(x, r * 0.6, z, 1, 0.75, 1));
  return b.build();
}

export function tuftGeometry(): BufferGeometry {
  const b = new GeoBuilder();
  for (let i = 0; i < 3; i++) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array([-0.18, 0, 0, 0.18, 0, 0, 0.05, 0.55, 0, -0.1, 0.38, 0.0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
    b.add(g, (_x, y) => lerpC(0x3b7d34, 0xb4d95c, y / 0.55), new Matrix4().makeRotationY((i / 3) * Math.PI));
  }
  return b.build();
}

export function umbrellaGeometry(): BufferGeometry {
  const b = new GeoBuilder();
  b.add(new CylinderGeometry(0.035, 0.035, 2.3, 5), 0xf0e8d8, M(0, 1.15, 0));
  const cone = new ConeGeometry(1.15, 0.5, 12, 1, true); const pos = cone.getAttribute('position');
  b.add(cone, (x, _y, z) => ((Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 6)) % 2) ? new Color(0xffffff) : new Color(0xff5a4a)), M(0, 2.5, 0));
  void pos;
  return b.build();
}

export function tyreStackGeometry(): BufferGeometry {
  const b = new GeoBuilder();
  for (let i = 0; i < 3; i++) b.add(new TorusGeometry(0.34, 0.15, 8, 14), 0x1a1b20, M(0, 0.16 + i * 0.3, 0, 1, 1, 1, 0, Math.PI / 2));
  b.add(new CylinderGeometry(0.36, 0.36, 0.06, 14), 0xffffff, M(0, 0.62, 0));
  return b.build();
}

export function coneGeometry(): BufferGeometry {
  const b = new GeoBuilder();
  b.add(new BoxGeometry(0.62, 0.05, 0.62), 0x22232a, M(0, 0.025, 0));
  b.add(new ConeGeometry(0.22, 0.75, 12), (_x, y) => (y > 0.0 && y < 0.15 ? new Color(0xffffff) : new Color(0xff6a1a)), M(0, 0.43, 0));
  b.add(new CylinderGeometry(0.13, 0.17, 0.12, 12), 0xffffff, M(0, 0.4, 0));
  return b.build();
}

export function barrelGeometry(): BufferGeometry {
  const b = new GeoBuilder();
  b.add(new CylinderGeometry(0.55, 0.55, 1.1, 14), (_x, y) => (Math.abs(y) < 0.14 ? new Color(0xffffff) : new Color(0x2b7bff)), M(0, 0.55, 0));
  b.add(new CylinderGeometry(0.58, 0.58, 0.06, 14), 0xdfe6f2, M(0, 1.1, 0));
  b.add(new CylinderGeometry(0.58, 0.58, 0.06, 14), 0xdfe6f2, M(0, 0.02, 0));
  return b.build();
}

export function villaGeometry(): BufferGeometry {
  const b = new GeoBuilder();
  b.add(new BoxGeometry(7, 3.4, 5.6), 0xf6efe2, M(0, 1.7, 0));
  b.add(new BoxGeometry(3.4, 2.6, 4.2), 0xf6efe2, M(3.6, 1.3, 0.5));
  // roof prism
  const roof = new CylinderGeometry(0.01, 4.2, 1.7, 4, 1); roof.rotateY(Math.PI / 4);
  b.add(roof, 0xc8582c, M(0, 4.25, 0, 1.05, 1, 0.85));
  const roof2 = new CylinderGeometry(0.01, 2.6, 1.3, 4, 1); roof2.rotateY(Math.PI / 4);
  b.add(roof2, 0xc8582c, M(3.6, 3.2, 0.5, 1.0, 1, 0.9));
  for (const x of [-2, 0, 2]) b.add(new BoxGeometry(0.9, 1.1, 0.12), 0x35506e, M(x, 2.0, 2.85));
  b.add(new BoxGeometry(1.0, 2.0, 0.12), 0x7a4a2a, M(-2.6, 1.0, 2.85));
  b.add(new BoxGeometry(0.6, 1.6, 0.6), 0xe8dccb, M(-2.3, 5.0, -0.8));
  return b.build();
}

export function lampGeometry(): BufferGeometry {
  const b = new GeoBuilder();
  b.add(new CylinderGeometry(0.08, 0.12, 6.4, 6), 0x2a2d36, M(0, 3.2, 0));
  b.add(new BoxGeometry(0.1, 0.1, 1.5), 0x2a2d36, M(0, 6.4, 0.7));
  return b.build();
}
