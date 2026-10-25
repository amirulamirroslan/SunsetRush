import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, DoubleSide, Euler, Group, LatheGeometry, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, TorusGeometry, CylinderGeometry, Vector2, Vector3, type Material, type Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { findFinish, findPaint, type Loadout, type VehicleId, type WheelId } from '../data/catalog';
import { clamp, damp } from '../sim/math';
import type { Texture as ThreeTexture } from 'three';
import { makeBlob, makeGlow } from './textures';
import type { CarAssets, CarLod } from './carAssets';

/** Everything the car visuals need from the simulation for one frame (already interpolated). */
export interface CarSnapshot {
  x: number; y: number; z: number; heading: number;
  speed: number; slip: number; yawRate: number; steer: number;
  braking: boolean; boosting: boolean; drifting: boolean; driftTier: number;
  impact: number; onKerb: boolean; offRoad: boolean;
  /** road gradient along the car (rise / run) */ grade: number;
}

/** Measurements of the car model (metres; +z is the nose, y is up). */
export const CAR = { length: 4.34, wheelR: 0.384, wheelW: 0.28, wheelX: 0.98, frontZ: 1.486, rearZ: -1.314, exhaust: [{ x: 0.48, y: 0.5, z: -1.98 }, { x: -0.48, y: 0.5, z: -1.98 }], glow: { w: 1.9, l: 3.8 } };
const WHEEL_KEYS = ['FL', 'FR', 'RL', 'RR'] as const;

const shared = {
  blob: null as CanvasTexture | null,
  rim: new MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.22, metalness: 0.95 }),
  rimDark: new MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.45, metalness: 0.8 }),
  trim: new MeshStandardMaterial({ color: 0x1b1d25, roughness: 0.6, metalness: 0.2 }),
  glass: new MeshPhysicalMaterial({ color: 0x04070d, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, transparent: true, opacity: 0.86 }),
  rimGeo: new Map<string, { rim: BufferGeometry; glow?: BufferGeometry }>(),
  decalTex: new Map<string, CanvasTexture>(),
};

/** Alternative rim designs (procedural; the model's own five-spoke alloy is the 'classic' style). */
function rimGeometry(style: WheelId): { rim: BufferGeometry; glow?: BufferGeometry } {
  const hit = shared.rimGeo.get(style); if (hit) return hit;
  const R = 0.315, face = CAR.wheelW / 2 - 0.04;
  const parts: BufferGeometry[] = [];
  const disc = new CylinderGeometry(R * 0.97, R * 0.97, 0.03, 40); disc.rotateZ(Math.PI / 2); disc.translate(face - 0.045, 0, 0); parts.push(disc);
  const hub = new CylinderGeometry(R * 0.16, R * 0.16, 0.07, 18); hub.rotateZ(Math.PI / 2); hub.translate(face, 0, 0); parts.push(hub);
  const lip = new TorusGeometry(R * 0.93, R * 0.045, 10, 40); lip.rotateY(Math.PI / 2); lip.translate(face - 0.01, 0, 0); parts.push(lip);
  const spoke = (len: number, thick: number, wide: number, a: number, twist = 0, off = 0.5): BufferGeometry => {
    const g = new BoxGeometry(thick, len, wide); g.rotateY(twist); g.translate(0, R * off, 0); g.rotateX(a); g.translate(face - 0.01, 0, 0); return g;
  };
  let glow: BufferGeometry | undefined;
  if (style === 'turbine') for (let i = 0; i < 12; i++) parts.push(spoke(R * 0.72, 0.03, R * 0.16, (i / 12) * Math.PI * 2, 0.75, 0.52));
  else if (style === 'mesh') { for (let i = 0; i < 20; i++) parts.push(spoke(R * 0.78, 0.025, R * 0.045, (i / 20) * Math.PI * 2, 0, 0.5)); const r2 = new TorusGeometry(R * 0.5, R * 0.03, 6, 28); r2.rotateY(Math.PI / 2); r2.translate(face - 0.01, 0, 0); parts.push(r2); }
  else if (style === 'neon') { for (let i = 0; i < 5; i++) parts.push(spoke(R * 0.6, 0.04, R * 0.1, (i / 5) * Math.PI * 2, 0, 0.38)); glow = new TorusGeometry(R * 0.72, R * 0.05, 8, 40); glow.rotateY(Math.PI / 2); glow.translate(face + 0.0, 0, 0); }
  const rim = mergeGeometries(parts)!; parts.forEach(p => p.dispose());
  const out = { rim, glow }; shared.rimGeo.set(style, out); return out;
}

function decalTexture(kind: 'checker' | 'flame'): CanvasTexture {
  const hit = shared.decalTex.get(kind); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d')!;
  if (kind === 'checker') {
    const s = 32;
    for (let y = 0; y < 256 / s; y++) for (let x = 0; x < 512 / s; x++) { g.fillStyle = (x + y) % 2 ? '#ffffff' : '#101218'; g.fillRect(x * s, y * s, s, s); }
  } else {
    // flames licking back from the nose (u across the car, v along it: nose at v = 1)
    for (let i = 0; i < 7; i++) {
      const cx = 36 + i * 73, h = 120 + (i % 3) * 36;
      const grd = g.createLinearGradient(0, 256, 0, 256 - h); grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(cx - 34, 256); g.quadraticCurveTo(cx - 6, 256 - h * 0.5, cx + (i % 2 ? 14 : -10), 256 - h); g.quadraticCurveTo(cx + 18, 256 - h * 0.45, cx + 34, 256); g.fill();
    }
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; shared.decalTex.set(kind, t); return t;
}

/** Nose-to-tail dummy vectors reused by the decal projector. */
const projEuler = new Euler(Math.PI / 2, 0, 0);

export class CarView {
  readonly root = new Group();
  private readonly tilt = new Group();
  private model: Group | null = null;
  private lod: CarLod = 'mid';
  private builtLod: CarLod | null = null;
  private readonly flames: Mesh[] = [];
  private readonly flameMat = new MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  private readonly coreMat = new MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false });
  private readonly glowMat = new MeshBasicMaterial({ map: makeGlow(), color: 0x35d0ff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  private readonly neonMat = new MeshBasicMaterial({ color: 0x35e6ff });
  private paintMain: MeshPhysicalMaterial | null = null;
  private paintAccent: MeshPhysicalMaterial | null = null;
  private brake: MeshStandardMaterial | null = null;
  private head: MeshStandardMaterial | null = null;
  private owned: BufferGeometry[] = [];
  private ownedMats: Material[] = [];
  private wheels: { pivot: Group; spin: Group; front: boolean; rim: Object3D | null; extra: Object3D[]; key: string }[] = [];
  private decals = new Group();
  private spoilerGroup = new Group();
  private loadout: Loadout | null = null;
  private spin = 0; private roll = 0; private pitch = 0; private bounce = 0; private lastSpeed = 0; private accel = 0; private flick = 0;
  private readonly blob: Mesh;
  private readonly glowQuad: Mesh;

  constructor(private readonly assets: CarAssets) {
    if (!shared.blob) shared.blob = makeBlob();
    this.blob = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shared.blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.04; this.blob.renderOrder = 1; this.blob.scale.set(CAR.wheelX * 2 + 1.3, CAR.length + 0.9, 1);
    this.glowQuad = new Mesh(new PlaneGeometry(1, 1), this.glowMat); this.glowQuad.rotation.x = -Math.PI / 2; this.glowQuad.position.y = 0.06; this.glowQuad.renderOrder = 3;
    this.glowQuad.scale.set(CAR.glow.w, CAR.glow.l, 1);
    this.root.rotation.order = 'YXZ';
    this.root.add(this.blob, this.glowQuad, this.tilt);
    this.tilt.add(this.decals, this.spoilerGroup);
  }

  /** Switches detail level; takes effect on the next setLook. */
  setLod(lod: CarLod): void { this.lod = lod; }

  setLook(_vehicle: VehicleId, loadout: Loadout): void {
    if (this.builtLod !== this.lod) this.rebuild();
    this.loadout = { ...loadout };
    const paint = findPaint(loadout.paint), fin = findFinish(loadout.finish);
    const m = this.paintMain!, a = this.paintAccent!;
    m.color.set(paint.color); m.metalness = fin.metalness; m.roughness = fin.roughness; m.clearcoat = fin.clearcoat; m.clearcoatRoughness = 0.05;
    a.color.set(new Color(0x0b0d12).lerp(new Color(paint.color), 0.1));
    this.neonMat.color.set(new Color(paint.accent).lerp(new Color(0x35e6ff), 0.4));
    this.applyWheels(); this.buildSpoiler(); this.buildDecals();
  }

  private clearModel(): void {
    if (this.model) this.tilt.remove(this.model);
    this.model = null; this.wheels = [];
    for (const f of this.flames) this.tilt.remove(f);
    this.flames.length = 0;
    this.owned.forEach(g => g.dispose()); this.owned = [];
    this.ownedMats.forEach(x => x.dispose()); this.ownedMats = [];
  }

  private rebuild(): void {
    this.clearModel();
    const tpl = this.assets.template(this.lod);
    const model = tpl.clone(true);
    this.model = model; this.builtLod = this.lod;
    // per-car paint and light materials; everything else (tyres, rims, glass) stays shared with the template
    const cache = new Map<Material, Material>();
    const own = <T extends Material>(m: T): T => { const c = cache.get(m) as T | undefined; if (c) return c; const n = m.clone() as T; cache.set(m, n); this.ownedMats.push(n); return n; };
    model.traverse(o => {
      const mesh = o as Mesh; if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = false;
      const mat = mesh.material as Material;
      switch (mat.name) {
        case 'paintMain': mesh.material = own(mat); break;
        case 'paintAccent': mesh.material = own(mat); break;
        case 'brakelight': mesh.material = own(mat); break;
        case 'headlight': mesh.material = own(mat); break;
        case 'glass': mesh.material = shared.glass; mesh.castShadow = false; break;
        default: break;
      }
    });
    const find = (n: string): Material | null => { let r: Material | null = null; model.traverse(o => { const mm = (o as Mesh).material as Material | undefined; if (!r && mm && mm.name === n) r = mm; }); return r; };
    this.paintMain = find('paintMain') as MeshPhysicalMaterial; this.paintAccent = find('paintAccent') as MeshPhysicalMaterial;
    this.brake = find('brakelight') as MeshStandardMaterial; this.head = find('headlight') as MeshStandardMaterial;
    if (this.head) this.head.emissiveIntensity = 2.2;
    for (const mat of [this.paintMain, this.paintAccent]) { mat.envMapIntensity = 1.15; mat.side = 0; }
    this.applyEnv();
    this.tilt.add(model);
    // wheel pivots: steer (pivot) -> spin
    for (const key of WHEEL_KEYS) {
      const g = model.getObjectByName(`wheel_${key}`); if (!g) continue;
      const pivot = new Group(); pivot.position.copy(g.position);
      const spin = new Group(); pivot.add(spin);
      let rim: Object3D | null = null; const extra: Object3D[] = [];
      for (const c of [...g.children]) { spin.add(c); if (c.name.startsWith('rim')) rim = c; else if (c.name.startsWith('disc') || c.name.startsWith('pad')) extra.push(c); }
      g.removeFromParent(); model.add(pivot);
      this.wheels.push({ pivot, spin, front: key[0] === 'F', rim, extra, key });
    }
    // boost flames at the diffuser
    for (const e of CAR.exhaust) {
      const outer = new Mesh(new ConeGeometry(0.16, 1.6, 10, 1, true), this.flameMat); this.owned.push(outer.geometry); outer.rotation.x = -Math.PI / 2; outer.position.set(e.x, e.y, e.z - 0.8);
      const core = new Mesh(new ConeGeometry(0.08, 1.0, 8, 1, true), this.coreMat); this.owned.push(core.geometry); core.rotation.x = -Math.PI / 2; core.position.set(e.x, e.y, e.z - 0.5);
      outer.visible = core.visible = false; outer.frustumCulled = core.frustumCulled = false;
      this.tilt.add(outer, core); this.flames.push(outer, core);
    }
  }

  private applyWheels(): void {
    const style = this.loadout!.wheels;
    for (const w of this.wheels) {
      for (const x of [...w.spin.children]) if (x.userData.custom) { w.spin.remove(x); }
      if (w.rim) w.rim.visible = style === 'classic';
      if (style !== 'classic') {
        const g = rimGeometry(style); const side = w.key[1] === 'L' ? 1 : -1;
        const flip = new Group(); flip.userData.custom = true; if (side === -1) flip.rotation.y = Math.PI;
        flip.add(new Mesh(g.rim, style === 'neon' ? shared.rimDark : shared.rim));
        if (g.glow) flip.add(new Mesh(g.glow, this.neonMat));
        w.spin.add(flip);
      }
    }
  }

  private buildSpoiler(): void {
    this.tilt.remove(this.spoilerGroup); this.spoilerGroup = new Group();
    const kind = this.loadout!.spoiler, halfW = 0.74, y = 1.0, z = -1.62;
    const box = (w: number, h: number, d: number, px: number, py: number, pz: number, rx = 0): BufferGeometry => { const g = new BoxGeometry(w, h, d); g.rotateX(rx); g.translate(px, py, pz); this.owned.push(g); return g; };
    const add = (geo: BufferGeometry, mat: Material): void => { const x = new Mesh(geo, mat); x.castShadow = true; this.spoilerGroup.add(x); };
    const merge = (l: BufferGeometry[]): BufferGeometry => { const r = mergeGeometries(l)!; this.owned.push(r); return r; };
    const paint = this.paintMain!, dark = shared.trim;
    if (kind === 'lip') add(box(halfW * 2 * 0.86, 0.045, 0.3, 0, y - 0.03, z - 0.08, 0.16), paint);
    else if (kind === 'wing') {
      add(merge([box(0.05, 0.3, 0.12, halfW * 0.5, y + 0.12, z), box(0.05, 0.3, 0.12, -halfW * 0.5, y + 0.12, z)]), dark);
      add(merge([box(halfW * 2 * 1.02, 0.045, 0.46, 0, y + 0.3, z - 0.08, 0.1), box(0.04, 0.18, 0.5, halfW * 1.02, y + 0.31, z - 0.08), box(0.04, 0.18, 0.5, -halfW * 1.02, y + 0.31, z - 0.08)]), paint);
    } else if (kind === 'gt') {
      add(merge([box(0.06, 0.5, 0.15, halfW * 0.5, y + 0.22, z, -0.12), box(0.06, 0.5, 0.15, -halfW * 0.5, y + 0.22, z, -0.12)]), dark);
      add(merge([box(halfW * 2 * 1.08, 0.065, 0.62, 0, y + 0.5, z - 0.1, 0.08), box(0.05, 0.28, 0.66, halfW * 1.08, y + 0.5, z - 0.1), box(0.05, 0.28, 0.66, -halfW * 1.08, y + 0.5, z - 0.1)]), paint);
      add(box(halfW * 2 * 1.08, 0.06, 0.07, 0, y + 0.58, z - 0.38, -0.5), dark);
    }
    this.tilt.add(this.spoilerGroup);
  }

  /** Decals are projected onto the real body panels so they follow the model's surface. */
  private buildDecals(): void {
    this.tilt.remove(this.decals);
    this.decals.children.forEach(c => (c as Mesh).geometry.dispose());
    this.decals = new Group(); this.tilt.add(this.decals);
    const kind = this.loadout!.decal; if (kind === 'none' || !this.model) return;
    const paint = findPaint(this.loadout!.paint), accent = new Color(paint.accent);
    // project with the car at the origin so decal geometry is generated in model space
    const saved = { p: this.root.position.clone(), r: this.root.rotation.clone(), tp: this.tilt.position.clone(), tr: this.tilt.rotation.clone() };
    this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0); this.tilt.position.set(0, 0, 0); this.tilt.rotation.set(0, 0, 0);
    this.root.updateMatrixWorld(true);
    const targets: Mesh[] = [];
    this.model.traverse(o => { const m = o as Mesh; if (m.isMesh && ['BodyHood', 'BodyRearPanelsColor1'].includes(m.name)) targets.push(m); });
    const mat = new MeshPhysicalMaterial({ color: accent, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false });
    if (kind === 'checker') { mat.map = decalTexture('checker'); mat.color.set(0xffffff); }
    if (kind === 'flame') { mat.map = decalTexture('flame'); mat.color.copy(accent); }
    this.ownedMats.push(mat);
    const strip = (cx: number, width: number, len: number, cz: number): void => {
      for (const t of targets) {
        const g = new DecalGeometry(t, new Vector3(cx, 1.0, cz), projEuler, new Vector3(width, len, 3));
        if (g.getAttribute('position').count === 0) { g.dispose(); continue; }
        const m = new Mesh(g, mat); m.renderOrder = 2; this.decals.add(m);
      }
    };
    if (kind === 'stripe') strip(0, 0.36, 5.2, 0);
    else if (kind === 'twin') { strip(-0.2, 0.085, 5.2, 0); strip(0.2, 0.085, 5.2, 0); }
    else if (kind === 'checker') strip(0, 1.9, 0.52, 1.25);
    else if (kind === 'flame') strip(0, 1.9, 1.35, 1.65);
    this.root.position.copy(saved.p); this.root.rotation.copy(saved.r); this.tilt.position.copy(saved.tp); this.tilt.rotation.copy(saved.tr);
  }

  /** Rear wheel contact points, for tyre marks and smoke. */
  rearWheelWorld(side: 0 | 1, out: Vector3): Vector3 {
    this.root.updateMatrixWorld();
    out.set((side === 0 ? 1 : -1) * CAR.wheelX, 0.02, CAR.rearZ);
    return this.root.localToWorld(out);
  }
  exhaustWorld(i: number, out: Vector3): Vector3 {
    const e = CAR.exhaust[i % CAR.exhaust.length];
    this.root.updateMatrixWorld(); out.set(e.x, e.y, e.z - 0.2); return this.root.localToWorld(out);
  }
  get exhaustCount(): number { return CAR.exhaust.length; }
  get dimensions(): { length: number; width: number } { return { length: CAR.length, width: CAR.wheelX * 2 + CAR.wheelW }; }

  update(s: CarSnapshot, dt: number, time: number): void {
    this.root.position.set(s.x, s.y, s.z);
    this.root.rotation.set(-Math.atan(s.grade), s.heading, 0);
    const ax = dt > 0 ? (s.speed - this.lastSpeed) / dt : 0; this.lastSpeed = s.speed;
    this.accel += (clamp(ax, -40, 40) - this.accel) * damp(8, dt);
    const rollT = clamp(s.yawRate * Math.max(0, s.speed) * 0.0022, -0.1, 0.1) + (s.drifting ? clamp(s.slip * 0.004, -0.05, 0.05) : 0);
    const pitchT = clamp(-this.accel * 0.0032, -0.07, 0.07);
    this.roll += (rollT - this.roll) * damp(9, dt); this.pitch += (pitchT - this.pitch) * damp(9, dt);
    const bumpT = (s.onKerb ? Math.sin(time * 70) * 0.012 : 0) + (s.offRoad ? Math.sin(time * 45) * 0.02 : 0) - Math.min(0.08, s.impact * 0.006);
    this.bounce += (bumpT - this.bounce) * damp(20, dt);
    this.tilt.rotation.set(this.pitch, 0, this.roll);
    this.tilt.position.y = this.bounce;
    this.spin += (s.speed / CAR.wheelR) * dt;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.spin;
      if (w.front) w.pivot.rotation.y = s.steer * 0.5;
    }
    if (this.brake) this.brake.emissiveIntensity = s.braking ? 6 : 1.4;
    this.flick += dt * 40;
    const on = s.boosting;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i]; f.visible = on;
      if (on) { const fl = 0.85 + 0.3 * Math.sin(this.flick + i * 1.7) + 0.1 * Math.sin(this.flick * 2.3); f.scale.set(1, fl * (i % 2 ? 0.8 : 1.15), 1); }
    }
    const tierCol = [0x35d0ff, 0x35a0ff, 0xff9a3a, 0xc060ff][s.driftTier] ?? 0x35d0ff;
    this.flameMat.color.setHex(on ? 0x58b8ff : 0xff9a3a);
    this.glowMat.color.setHex(s.drifting ? tierCol : 0x35d0ff);
    this.glowMat.opacity += ((on ? 0.55 : s.drifting && s.driftTier > 0 ? 0.35 : 0) * (0.85 + 0.15 * Math.sin(time * 30)) - this.glowMat.opacity) * damp(14, dt);
    this.blob.position.y = 0.04;
  }

  setVisible(v: boolean): void { this.root.visible = v; }

  /** Optional reflection environment for paint and glass only (null = use the scene's procedural sky). */
  setEnvMap(tex: ThreeTexture | null, rotationY = 0): void { this.envTex = tex; this.envRot = rotationY; this.applyEnv(); }
  private envTex: ThreeTexture | null = null; private envRot = 0;
  private applyEnv(): void {
    for (const m of [this.paintMain, this.paintAccent, shared.glass]) {
      if (!m) continue;
      if ((m.envMap ?? null) !== this.envTex) { m.envMap = this.envTex; m.needsUpdate = true; }
      m.envMapRotation.set(0, this.envRot, 0);
    }
  }

  dispose(): void {
    this.clearModel();
    this.decals.children.forEach(c => (c as Mesh).geometry.dispose());
    this.flameMat.dispose(); this.coreMat.dispose(); this.glowMat.dispose(); this.neonMat.dispose();
    this.blob.geometry.dispose(); (this.blob.material as MeshBasicMaterial).dispose(); this.glowQuad.geometry.dispose();
  }
}
void LatheGeometry; void Vector2;
