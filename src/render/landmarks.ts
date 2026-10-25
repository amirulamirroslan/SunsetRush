import {
  AdditiveBlending, BoxGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { Rng } from '../sim/rng';
import type { Track } from '../sim/Track';
import { GeoBuilder, xform } from './propGeo';
import { makeBanner, type BannerSpec } from './textures';
import type { Terrain } from './terrain';
import { findHeadland } from './scenery';
import type { Tier } from './quality';
import { TIERS } from './quality';

type Pt = { x: number; y: number; z: number; heading: number; tx: number; tz: number };
const pt = (): Pt => ({ x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 });

const BRANDS: BannerSpec[] = [
  { text: 'COCO FIZZ', sub: 'TASTE THE SUNSET', bg: ['#ff5a3c', '#ffb03a'], fg: '#ffffff', accent: '#ffffff' },
  { text: 'SOLARIS', sub: 'POWER FROM THE SUN', bg: ['#1b2a6b', '#4a3fa8'], fg: '#ffd35a', accent: '#ff8a3a' },
  { text: 'WAVECREST', sub: 'SURF · SAIL · SPLASH', bg: ['#0b8fb0', '#20d6c0'], fg: '#ffffff', accent: '#ffffff' },
  { text: 'TURBO TUNA', sub: 'FAST FOOD, FASTER', bg: ['#e8334a', '#ff7a59'], fg: '#fff3dc', accent: '#ffd35a' },
  { text: 'ISLE AIR', sub: 'FLY THE COVE', bg: ['#f4efe6', '#d8e6f0'], fg: '#1b2a6b', accent: '#2b6bff' },
  { text: 'NEON NOODLE', sub: 'OPEN LATE', bg: ['#2b0a4a', '#7a1fa8'], fg: '#7cf0ff', accent: '#ff4fa3' },
];

/** Gantry, grandstand, arch, billboards and lighthouse: the landmarks that give the circuit its identity. */
export class Landmarks {
  readonly group = new Group();
  readonly lighthouse: { x: number; y: number; z: number };
  private readonly disposables: { dispose(): void }[] = [];
  private readonly lights: MeshBasicMaterial[] = [];
  private readonly beam: Group;
  private readonly crowdTime = { value: 0 };
  private readonly keep = <T extends { dispose(): void }>(x: T): T => { this.disposables.push(x); return x; };

  constructor(readonly track: Track, terrain: Terrain, tier: Tier) {
    const rng = new Rng(77), wall = track.wallOffset;
    const T = TIERS[tier];
    const std = (c: number, rough = 0.6, metal = 0.1): MeshStandardMaterial => this.keep(new MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }));

    // ------------------------------------------------ start / finish gantry
    {
      const p = pt(); track.pointAt(0, 0, p);
      const g = new Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.heading;
      const postX = wall + 1.8;
      for (const s of [-1, 1]) {
        const post = new Mesh(this.keep(new BoxGeometry(1.3, 12, 1.3)), std(0x2a2d3a, 0.5, 0.5)); post.position.set(s * postX, 5, 0); post.castShadow = true; g.add(post);
        const foot = new Mesh(this.keep(new BoxGeometry(2.4, 1.6, 2.4)), std(0xe9e1d3)); foot.position.set(s * postX, -0.2, 0); g.add(foot);
      }
      const beam = new Mesh(this.keep(new BoxGeometry(postX * 2 + 1.6, 2.6, 1.5)), std(0x24283a, 0.5, 0.4)); beam.position.set(0, 11.2, 0); beam.castShadow = true; g.add(beam);
      const mkBanner = (spec: BannerSpec, flip: boolean): Mesh => {
        const tex = this.keep(makeBanner(spec, 1024, 128));
        const m = new Mesh(this.keep(new BoxGeometry(postX * 2 - 1, 2.2, 0.05)), this.keep(new MeshBasicMaterial({ map: tex, toneMapped: false })));
        m.position.set(0, 11.2, flip ? 0.8 : -0.8); if (flip) m.rotation.y = Math.PI; return m;
      };
      g.add(mkBanner({ text: 'SUNSET RUSH  ·  CORAL COVE CIRCUIT', bg: ['#ff6a3a', '#ff3f8a'], fg: '#ffffff', accent: '#ffd35a' }, false));
      g.add(mkBanner({ text: 'CHEQUERED FLAG  ·  WELL DRIVEN', bg: ['#1b2a6b', '#4a3fa8'], fg: '#ffd35a', accent: '#ff8a3a' }, true));
      // checker valance
      const checker = new Mesh(this.keep(new BoxGeometry(postX * 2 - 1, 0.5, 0.06)), this.keep(new MeshBasicMaterial({ color: 0xffffff }))); checker.position.set(0, 9.7, -0.8); g.add(checker);
      // start lights: three reds that count down, then green
      const housing = new Mesh(this.keep(new BoxGeometry(7.6, 1.5, 0.6)), std(0x101218, 0.7, 0.2)); housing.position.set(0, 8.7, -0.75); g.add(housing);
      for (let i = 0; i < 3; i++) {
        const m = this.keep(new MeshBasicMaterial({ color: 0x2a0a0a, toneMapped: false })); this.lights.push(m);
        const l = new Mesh(this.keep(new SphereGeometry(0.5, 16, 12)), m); l.position.set(-2.4 + i * 2.4, 8.7, -1.12); g.add(l);
      }
      this.group.add(g);
    }

    // ------------------------------------------------ Sun Gate arch
    {
      const p = pt(); track.pointAt(720, 0, p);
      const g = new Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.heading;
      const R = wall + 3.4;
      const ring = new Mesh(this.keep(new TorusGeometry(R, 0.85, 12, 48, Math.PI)), this.keep(new MeshBasicMaterial({ color: new Color(1.0, 0.45, 0.15).multiplyScalar(2.4), toneMapped: false })));
      ring.position.y = 0.4; g.add(ring);
      const outer = new Mesh(this.keep(new TorusGeometry(R, 1.5, 8, 48, Math.PI)), std(0x2b2f45, 0.5, 0.5)); outer.position.set(0, 0.4, -0.4); outer.scale.set(1, 1, 0.5); g.add(outer);
      for (const s of [-1, 1]) { const b = new Mesh(this.keep(new BoxGeometry(3.4, 2, 3.4)), std(0xe9e1d3)); b.position.set(s * R, -0.2, 0); g.add(b); }
      const sunBadge = new Mesh(this.keep(new CylinderGeometry(2.6, 2.6, 0.3, 24)), this.keep(new MeshBasicMaterial({ color: new Color(1, 0.75, 0.3).multiplyScalar(2.2), toneMapped: false }))); sunBadge.rotation.x = Math.PI / 2; sunBadge.position.set(0, R + 1.2, 0); g.add(sunBadge);
      this.group.add(g);
    }

    // ------------------------------------------------ grandstand with a bobbing crowd
    {
      const sMid = 190, p = pt(); track.pointAt(sMid, 0, p);
      const g = new Group(); g.position.set(p.x, p.y - 0.9, p.z); g.rotation.y = p.heading;
      const len = 130, tiers = 5, x0 = -(wall + 3.2), depth = 2.8, rise = 1.35;
      const b = new GeoBuilder();
      for (let t = 0; t < tiers; t++) {
        const top = (t + 1) * rise;
        b.add(new BoxGeometry(depth, top + 8, len), 0x59607a, xform(x0 - depth * (t + 0.5), (top - 8) / 2, 0));
        b.add(new BoxGeometry(depth * 0.96, 0.08, len * 0.995), t % 2 ? 0xff7a59 : 0xffc23a, xform(x0 - depth * (t + 0.5), top + 0.04, 0));
      }
      const roofY = tiers * rise + 4.6;
      b.add(new BoxGeometry(depth * tiers + 3, 0.3, len + 4), 0xf4efe6, xform(x0 - depth * tiers / 2 - 0.2, roofY, 0, 1, 1, 1, 0, 0, 0.0));
      for (let z = -len / 2; z <= len / 2; z += len / 6) b.add(new BoxGeometry(0.3, roofY, 0.3), 0x2a2d3a, xform(x0 + 0.4, roofY / 2 - 2, z));
      for (let z = -len / 2; z <= len / 2; z += len / 6) b.add(new BoxGeometry(0.3, roofY, 0.3), 0x2a2d3a, xform(x0 - depth * tiers, roofY / 2 - 2, z));
      const stand = new Mesh(this.keep(b.build()), this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }))); stand.castShadow = true; stand.receiveShadow = true; g.add(stand);
      const crowdGeo = this.keep(new BoxGeometry(0.46, 0.9, 0.36));
      const crowdMat = this.keep(new MeshStandardMaterial({ roughness: 0.9 }));
      crowdMat.onBeforeCompile = sh => {
        sh.uniforms.uTime = this.crowdTime;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>',
          '#include <begin_vertex>\nfloat ph = instanceMatrix[3].z * 3.7 + instanceMatrix[3].x * 1.3;\ntransformed.y += step(0.0, position.y) * abs(sin(uTime * (3.0 + fract(ph) * 2.0) + ph)) * 0.16;');
      };
      const seats: Vector3[] = [];
      for (let t = 0; t < tiers; t++) for (let z = -len / 2 + 1; z < len / 2 - 1; z += 0.95) { if (rng.next() < 0.12) continue; seats.push(new Vector3(x0 - depth * (t + 0.5) + rng.range(-0.3, 0.3), (t + 1) * rise + 0.55, z + rng.range(-0.2, 0.2))); }
      const keepCount = Math.round(seats.length * (T.scenery > 0.8 ? 1 : 0.6));
      const crowd = new InstancedMesh(crowdGeo, crowdMat, keepCount); const e = new Object3D(); const col = new Color();
      const pal = [0xff5a4a, 0xffc23a, 0x35d0ff, 0x7cf05a, 0xff5ad0, 0xffffff, 0x2b6bff, 0xff8a3a];
      for (let i = 0; i < keepCount; i++) { e.position.copy(seats[i]); e.rotation.y = rng.range(-0.3, 0.3); e.updateMatrix(); crowd.setMatrixAt(i, e.matrix); crowd.setColorAt(i, col.setHex(rng.pick(pal))); }
      crowd.castShadow = false; g.add(crowd);
      this.group.add(g);
    }

    // ------------------------------------------------ billboards
    {
      const mats = BRANDS.map(spec => this.keep(new MeshBasicMaterial({ map: this.keep(makeBanner(spec)), toneMapped: false, side: DoubleSide })));
      const panel = this.keep(new BoxGeometry(11, 4.1, 0.2)); const post = this.keep(new BoxGeometry(0.3, 3.4, 0.3)); const postMat = std(0x2a2d3a, 0.6, 0.4);
      let i = 0;
      for (let s = 260; s < track.length - 60; s += 138) {
        const side = i % 2 ? 1 : -1; const p = pt(); track.pointAt(s, side * (wall + 5.2), p);
        const base = terrain.heightAt(p.x, p.z);
        const toRoad = Math.atan2(side * p.tz, -side * p.tx);
        const g = new Group(); g.position.set(p.x, Math.max(base, p.y - 1.2), p.z); g.rotation.y = toRoad;
        const m = new Mesh(panel, mats[i % mats.length]); m.position.y = 4.2; g.add(m);
        for (const dx of [-3.6, 3.6]) { const pp = new Mesh(post, postMat); pp.position.set(dx, 1.5, -0.2); pp.castShadow = true; g.add(pp); }
        this.group.add(g); i++;
      }
    }

    // ------------------------------------------------ lighthouse with a sweeping beam
    {
      const h = this.lighthouse = findHeadland(track, terrain);
      const g = new Group(); g.position.set(h.x, h.y - 0.5, h.z);
      const b = new GeoBuilder();
      b.add(new CylinderGeometry(2.1, 3.3, 24, 16), (_x, y) => (Math.floor((y + 12) / 4.2) % 2 ? new Color(0xe8402f) : new Color(0xf7f1e6)), xform(0, 12, 0));
      b.add(new CylinderGeometry(3.2, 3.2, 0.5, 16), 0x2a2d3a, xform(0, 24.2, 0));
      b.add(new CylinderGeometry(2.0, 2.4, 0.35, 16), 0x2a2d3a, xform(0, 24.0, 0));
      b.add(new ConeGeometry(2.4, 2.4, 16), 0xe8402f, xform(0, 28.2, 0));
      b.add(new BoxGeometry(6, 3.2, 5), 0xf7f1e6, xform(5.4, 1.2, 1.5));
      b.add(new BoxGeometry(6.6, 0.4, 5.6), 0xc8582c, xform(5.4, 3.0, 1.5, 1, 1, 1, 0, 0, 0));
      for (let i = 0; i < 9; i++) b.add(new SphereGeometry(rng.range(2, 4), 6, 4), 0x7d6f66, xform(Math.cos(i * 0.7) * 6, -0.2, Math.sin(i * 0.7) * 6, 1, 0.5, 1));
      const tower = new Mesh(this.keep(b.build()), this.keep(new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }))); tower.castShadow = true; g.add(tower);
      const lamp = new Mesh(this.keep(new CylinderGeometry(1.5, 1.5, 2.5, 14)), this.keep(new MeshBasicMaterial({ color: new Color(1, 0.85, 0.5).multiplyScalar(3), toneMapped: false })));
      lamp.position.y = 25.6; g.add(lamp);
      this.beam = new Group(); this.beam.position.y = 25.6;
      const cone = this.keep(new ConeGeometry(7, 160, 16, 1, true)); cone.rotateZ(-Math.PI / 2); cone.translate(80, 0, 0);
      const bm = this.keep(new MeshBasicMaterial({ color: new Color(1, 0.8, 0.45), transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }));
      this.beam.add(new Mesh(cone, bm)); const m2 = new Mesh(cone, bm); m2.rotation.y = Math.PI; this.beam.add(m2);
      g.add(this.beam);
      this.group.add(g);
    }
  }

  /** `lit` = number of red lights on (0..3); `go` turns them green. */
  setStartLights(lit: number, go: boolean): void {
    this.lights.forEach((m, i) => {
      if (go) m.color.setRGB(0.1, 1.6, 0.35);
      else if (i < lit) m.color.setRGB(2.2, 0.1, 0.08);
      else m.color.setRGB(0.16, 0.04, 0.04);
    });
  }

  update(time: number): void { this.crowdTime.value = time; this.beam.rotation.y = time * 0.7; }

  dispose(): void { this.disposables.forEach(d => d.dispose()); this.group.removeFromParent(); }
}

