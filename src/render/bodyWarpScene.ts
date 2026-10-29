import { BufferAttribute, BufferGeometry, Matrix3, Matrix4, Vector3, type InterleavedBufferAttribute, type Mesh, type Object3D } from 'three';
import { SCULPTED, warpBuffers } from './bodyWarp';

type Attr = BufferAttribute | InterleavedBufferAttribute;

/** Copies any (possibly quantized / interleaved) attribute into a plain Float32Array of `size` components. */
function toFloat(a: Attr, size: number): Float32Array {
  const out = new Float32Array(a.count * size);
  for (let i = 0; i < a.count; i++) {
    out[i * size] = a.getX(i); if (size > 1) out[i * size + 1] = a.getY(i); if (size > 2) out[i * size + 2] = a.getZ(i); if (size > 3) out[i * size + 3] = a.getW(i);
  }
  return out;
}

const underWheel = (o: Object3D): boolean => { for (let p: Object3D | null = o; p; p = p.parent) if (p.name.startsWith('wheel_')) return true; return false; };

/**
 * Bakes the sculpted body shape (bodyWarp.ts) into the template's body meshes: node transforms are folded into the vertices
 * (model space), positions/normals are warped, and the nodes are reset to identity. Wheels are left alone. Geometry is cloned per
 * mesh, so nothing else that shares the loaded buffers is affected. All work is done before anything is committed: if anything throws
 * the template is left untouched. Returns the number of meshes reshaped.
 */
export function applyBodyShape(scene: Object3D): number {
  scene.updateMatrixWorld(true);
  const toScene = new Matrix4().copy(scene.matrixWorld).invert();
  const jobs: { mesh: Mesh; geo: BufferGeometry }[] = [];
  const v = new Vector3();
  scene.traverse(o => {
    const mesh = o as Mesh; if (!mesh.isMesh || underWheel(mesh)) return;
    const posA = mesh.geometry.getAttribute('position') as Attr | undefined; if (!posA) return;
    const m = new Matrix4().multiplyMatrices(toScene, mesh.matrixWorld), nm = new Matrix3().getNormalMatrix(m);
    const pos = toFloat(posA, 3);
    for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(m); pos[i] = v.x; pos[i + 1] = v.y; pos[i + 2] = v.z; }
    const norA = mesh.geometry.getAttribute('normal') as Attr | undefined;
    let nor: Float32Array | undefined;
    if (norA) { nor = toFloat(norA, 3); for (let i = 0; i < nor.length; i += 3) { v.set(nor[i], nor[i + 1], nor[i + 2]).applyMatrix3(nm).normalize(); nor[i] = v.x; nor[i + 1] = v.y; nor[i + 2] = v.z; } }
    const tanA = mesh.geometry.getAttribute('tangent') as Attr | undefined;
    let tan: Float32Array | undefined;
    if (tanA) { tan = toFloat(tanA, 4); for (let i = 0; i < tan.length; i += 4) { v.set(tan[i], tan[i + 1], tan[i + 2]).transformDirection(m); tan[i] = v.x; tan[i + 1] = v.y; tan[i + 2] = v.z; } }
    warpBuffers(pos, nor, tan, 4, SCULPTED);
    for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) throw new Error(`body warp produced a non-finite vertex in ${mesh.name}`);
    const geo = mesh.geometry.clone();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    if (nor) geo.setAttribute('normal', new BufferAttribute(nor, 3));
    if (tan) geo.setAttribute('tangent', new BufferAttribute(tan, 4));
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    jobs.push({ mesh, geo });
  });
  // commit
  for (const { mesh, geo } of jobs) {
    mesh.geometry = geo;
    for (let p: Object3D | null = mesh; p && p !== scene; p = p.parent) { p.position.set(0, 0, 0); p.quaternion.identity(); p.scale.set(1, 1, 1); p.updateMatrix(); }
  }
  scene.updateMatrixWorld(true);
  return jobs.length;
}
