import { AdditiveBlending, BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, SphereGeometry, TorusGeometry } from 'three';
import type { Track } from '../sim/Track';
import type { DiscoveryPoint, DriveObjective } from '../edu/types';

const P = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
const C = { start: 0x35d0ff, end: 0xffc23a, gate: 0xb58cff, stop: 0xff4a5a, go: 0x7cf05a, note: 0x7cf05a, noteDone: 0x6b7a88 };

/**
 * Lightweight 3D guides for the learning layer: timing gates, the stop line and signal, and discovery beacons.
 * Pure decoration: simple unlit meshes, no physics, no colliders, so they can never touch the racing.
 */
export class EduMarkers {
  readonly group = new Group();
  private readonly mats: MeshBasicMaterial[] = [];
  private readonly geos: { dispose(): void }[] = [];
  private signal: MeshBasicMaterial | null = null;
  private beacons: { mesh: Mesh; ring: Mesh; mat: MeshBasicMaterial; id: string; base: number }[] = [];
  private t = 0;

  constructor(private readonly track: Track) { this.group.visible = false; }

  private mat(color: number, opacity = 1, additive = false): MeshBasicMaterial {
    const m = new MeshBasicMaterial({ color, transparent: opacity < 1 || additive, opacity, side: DoubleSide, depthWrite: !additive && opacity >= 1, blending: additive ? AdditiveBlending : undefined });
    this.mats.push(m); return m;
  }
  private geo<T extends { dispose(): void }>(g: T): T { this.geos.push(g); return g; }

  /** A timing gate: a glowing strip on the asphalt, two posts and a beam across the road. */
  private gate(s: number, color: number): void {
    const t = this.track; t.pointAt(s, 0, P);
    const hw = t.halfWidth + 1.4, g = new Group(); g.position.set(P.x, P.y, P.z); g.rotation.y = P.heading;
    const strip = new Mesh(this.geo(new BoxGeometry(hw * 2, 0.04, 1.1)), this.mat(color, 0.55, true)); strip.position.y = 0.09; g.add(strip);
    const postGeo = this.geo(new BoxGeometry(0.5, 7, 0.5)), post = this.mat(color);
    for (const side of [-1, 1]) { const m = new Mesh(postGeo, post); m.position.set(side * hw, 3.5, 0); g.add(m); }
    const beam = new Mesh(this.geo(new BoxGeometry(hw * 2 + 0.5, 0.55, 0.55)), post); beam.position.y = 7; g.add(beam);
    const glow = new Mesh(this.geo(new BoxGeometry(hw * 2, 6.5, 0.06)), this.mat(color, 0.12, true)); glow.position.y = 3.6; g.add(glow);
    this.group.add(g);
  }

  /** Shows the gates of an objective. Section legs get a start and an end gate; shared boundaries are drawn once. */
  setObjective(o: DriveObjective): void {
    this.clear();
    const drawn = new Set<number>();
    const once = (s: number, c: number): void => { const k = Math.round(s); if (drawn.has(k)) return; drawn.add(k); this.gate(s, c); };
    for (const l of o.legs) {
      if (l.kind === 'section') { once(l.from, C.start); once(l.to, C.end); }
      else if (l.kind === 'gate') once(l.at, C.gate);
      else this.stopBox(l.signalAt, l.zone);
    }
    this.group.visible = true;
  }

  private stopBox(signalAt: number, zone: [number, number]): void {
    const t = this.track, hw = t.halfWidth;
    // the marked box the car must stop inside
    t.pointAt((zone[0] + zone[1]) / 2, 0, P);
    const box = new Mesh(this.geo(new BoxGeometry(hw * 1.7, 0.03, zone[1] - zone[0])), this.mat(C.stop, 0.22, true));
    box.position.set(P.x, P.y + 0.1, P.z); box.rotation.y = P.heading; this.group.add(box);
    this.gate(zone[1], C.stop);
    // the signal on a tall pole at the side of the road
    t.pointAt(signalAt, hw + 2.2, P);
    const g = new Group(); g.position.set(P.x, P.y, P.z); g.rotation.y = P.heading;
    const pole = new Mesh(this.geo(new CylinderGeometry(0.18, 0.22, 7.5, 8)), this.mat(0x262a33)); pole.position.y = 3.75; g.add(pole);
    const head = new Mesh(this.geo(new BoxGeometry(1.6, 1.6, 0.6)), this.mat(0x14161c)); head.position.y = 8.2; g.add(head);
    this.signal = this.mat(C.go);
    const lamp = new Mesh(this.geo(new SphereGeometry(0.55, 14, 10)), this.signal); lamp.position.set(0, 8.2, -0.38); g.add(lamp);
    const back = new Mesh(this.geo(new SphereGeometry(0.55, 14, 10)), this.signal); back.position.set(0, 8.2, 0.38); g.add(back);
    this.group.add(g);
    this.gate(signalAt, C.start);
  }

  /** Turns the signal red (or back to green). */
  setSignal(red: boolean): void { this.signal?.color.setHex(red ? C.stop : C.go); }

  /** Discovery beacons for free exploration; collected ones go grey. */
  setBeacons(points: readonly DiscoveryPoint[], collected: readonly string[]): void {
    this.clear();
    for (const d of points) {
      this.track.pointAt(d.at, d.lat, P);
      const done = collected.includes(d.id), mat = this.mat(done ? C.noteDone : C.note, done ? 0.25 : 0.4, true);
      const beam = new Mesh(this.geo(new CylinderGeometry(1.6, 1.6, 22, 18, 1, true)), mat); beam.position.set(P.x, P.y + 11, P.z);
      const ring = new Mesh(this.geo(new TorusGeometry(2.6, 0.18, 8, 28)), this.mat(done ? C.noteDone : C.note)); ring.rotation.x = Math.PI / 2; ring.position.set(P.x, P.y + 1.4, P.z);
      this.group.add(beam, ring); this.beacons.push({ mesh: beam, ring, mat, id: d.id, base: P.y + 1.4 });
    }
    this.group.visible = true;
  }
  markCollected(id: string): void {
    const b = this.beacons.find(x => x.id === id); if (!b) return;
    b.mat.color.setHex(C.noteDone); b.mat.opacity = 0.25; (b.ring.material as MeshBasicMaterial).color.setHex(C.noteDone);
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;
    for (const b of this.beacons) { b.ring.position.y = b.base + Math.sin(this.t * 2 + b.base) * 0.35; b.ring.rotation.z += dt * 1.4; }
  }

  clear(): void {
    this.group.clear(); this.beacons = []; this.signal = null; this.group.visible = false;
    for (const g of this.geos) g.dispose(); this.geos.length = 0;
    for (const m of this.mats) m.dispose(); this.mats.length = 0;
  }
  dispose(): void { this.clear(); }
}
