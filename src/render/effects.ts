import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Group, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, Points, ShaderMaterial, type Scene,
} from 'three';
import { Rng } from '../sim/rng';
import { makeSkid } from './textures';

const vert = /* glsl */ `
attribute float aSize; attribute vec4 aColor;
uniform float uScale;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.5), 0.0, 220.0);
}`;
const frag = /* glsl */ `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.15, d) * vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Pooled soft-point particles: one draw call per blend mode, CPU simulated, zero allocations per frame. */
export class ParticlePool {
  readonly points: Points;
  private readonly n: number;
  private readonly pos: Float32Array; private readonly vel: Float32Array; private readonly col: Float32Array; private readonly size: Float32Array;
  private readonly life: Float32Array; private readonly maxLife: Float32Array; private readonly s0: Float32Array; private readonly s1: Float32Array;
  private readonly a0: Float32Array; private readonly grav: Float32Array; private readonly drag: Float32Array;
  private readonly aSize: BufferAttribute; private readonly aColor: BufferAttribute; private readonly aPos: BufferAttribute;
  private head = 0;
  private readonly mat: ShaderMaterial;

  constructor(count: number, additive: boolean) {
    this.n = Math.max(8, Math.floor(count));
    const n = this.n;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.life = new Float32Array(n); this.maxLife = new Float32Array(n).fill(1); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n);
    this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new BufferGeometry();
    this.aPos = new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage);
    this.aSize = new BufferAttribute(this.size, 1).setUsage(DynamicDrawUsage);
    this.aColor = new BufferAttribute(this.col, 4).setUsage(DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aSize', this.aSize); g.setAttribute('aColor', this.aColor);
    this.mat = new ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, fog: false,
      blending: additive ? AdditiveBlending : 1, uniforms: { uScale: { value: 500 } },
    });
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = additive ? 6 : 5;
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -1000;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, c: Color, alpha: number, gravity = 0, drag = 1): void {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = alpha; this.grav[i] = gravity; this.drag[i] = drag;
    this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = alpha; this.size[i] = s0;
  }

  update(dt: number, pointScale: number): void {
    this.mat.uniforms.uScale.value = pointScale;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.col[i * 4 + 3] = this.life[i] > 0 ? this.a0[i] * (1 - t) * Math.min(1, t * 12) : 0;
    }
    this.aPos.needsUpdate = true; this.aSize.needsUpdate = true; this.aColor.needsUpdate = true;
  }

  clear(): void { this.life.fill(0); this.col.fill(0); this.aColor.needsUpdate = true; }
  dispose(): void { this.points.geometry.dispose(); this.mat.dispose(); }
}

/** Tyre marks: a ring buffer of flat decals laid on the road. */
export class SkidMarks {
  readonly mesh: InstancedMesh;
  private head = 0;
  private readonly dummy = new Object3D();
  private readonly count: number;
  constructor(count: number) {
    this.count = Math.max(16, count);
    const g = new PlaneGeometry(0.3, 0.9); g.rotateX(-Math.PI / 2);
    const m = new MeshBasicMaterial({ map: makeSkid(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.mesh = new InstancedMesh(g, m, this.count);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    this.dummy.position.set(0, -1000, 0); this.dummy.updateMatrix();
    for (let i = 0; i < this.count; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  }
  add(x: number, y: number, z: number, heading: number, strength = 1): void {
    this.dummy.position.set(x, y + 0.045, z); this.dummy.rotation.set(0, heading, 0); this.dummy.scale.set(strength, 1, 1.0 + (strength > 1 ? 0.2 : 0)); this.dummy.updateMatrix();
    this.mesh.setMatrixAt(this.head, this.dummy.matrix); this.head = (this.head + 1) % this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear(): void { this.dummy.position.set(0, -1000, 0); this.dummy.updateMatrix(); for (let i = 0; i < this.count; i++) this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.instanceMatrix.needsUpdate = true; }
  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as MeshBasicMaterial).map?.dispose(); (this.mesh.material as MeshBasicMaterial).dispose(); this.mesh.dispose(); }
}

/** All gameplay particle effects and decals in one place. */
export class Effects {
  readonly group = new Group();
  readonly smoke: ParticlePool; readonly spark: ParticlePool; readonly skids: SkidMarks;
  private readonly rng = new Rng(11);
  private readonly c = new Color();
  constructor(scene: Scene, particleScale: number, skidCount: number) {
    this.smoke = new ParticlePool(520 * particleScale, false);
    this.spark = new ParticlePool(420 * particleScale, true);
    this.skids = new SkidMarks(skidCount);
    this.group.add(this.skids.mesh, this.smoke.points, this.spark.points);
    scene.add(this.group);
  }
  tyreSmoke(x: number, y: number, z: number, vx: number, vz: number, intensity: number, dust = false): void {
    const r = this.rng;
    if (dust) this.c.setRGB(0.55, 0.42, 0.28); else this.c.setRGB(0.92, 0.9, 0.9);
    this.smoke.emit(x + r.range(-0.2, 0.2), y + 0.2, z + r.range(-0.2, 0.2), vx * 0.25 + r.range(-0.6, 0.6), r.range(0.4, 1.4), vz * 0.25 + r.range(-0.6, 0.6), r.range(0.7, 1.3), 0.5 * intensity, 2.6 + intensity, this.c, dust ? 0.5 : 0.42, -0.1, 1.5);
  }
  sparks(x: number, y: number, z: number, dirX: number, dirZ: number, n: number, hex = 0xffb040): void {
    const r = this.rng; this.c.set(hex).multiplyScalar(2.4);
    for (let i = 0; i < n; i++) this.spark.emit(x, y + 0.3, z, dirX * r.range(0.2, 1) * 8 + r.range(-4, 4), r.range(1, 6), dirZ * r.range(0.2, 1) * 8 + r.range(-4, 4), r.range(0.25, 0.6), 0.28, 0.05, this.c, 1, 18, 0.4);
  }
  boostBurst(x: number, y: number, z: number, vx: number, vz: number, hex: number): void {
    const r = this.rng; this.c.set(hex).multiplyScalar(2.2);
    this.spark.emit(x, y, z, vx * 0.1 + r.range(-0.5, 0.5), r.range(-0.2, 0.5), vz * 0.1 + r.range(-0.5, 0.5), r.range(0.25, 0.45), 0.55, 0.05, this.c, 0.9, 0, 3);
  }
  confetti(x: number, y: number, z: number, n: number): void {
    const r = this.rng; const hues = [0xff5a4a, 0xffc23a, 0x35d0ff, 0x7cf05a, 0xff5ad0, 0xffffff];
    for (let i = 0; i < n; i++) {
      this.c.set(hues[i % hues.length]);
      const a = r.range(0, Math.PI * 2), sp = r.range(3, 11);
      this.smoke.emit(x, y, z, Math.cos(a) * sp, r.range(8, 18), Math.sin(a) * sp, r.range(2.2, 3.6), 0.35, 0.3, this.c, 1, 12, 0.6);
    }
  }
  update(dt: number, pointScale: number): void { this.smoke.update(dt, pointScale); this.spark.update(dt, pointScale); }
  clear(): void { this.smoke.clear(); this.spark.clear(); this.skids.clear(); }
  dispose(): void { this.smoke.dispose(); this.spark.dispose(); this.skids.dispose(); this.group.removeFromParent(); }
}
