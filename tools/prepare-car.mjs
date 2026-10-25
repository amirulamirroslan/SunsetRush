// Builds the in-game car models from the Khronos "Car Concept" source (CC-BY-4.0, based on a CC0 model by Unity Fan).
// Usage: node tools/prepare-car.mjs   ->  public/models/car-{high,mid,low}.glb
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { transformMesh, weld, simplify, prune, dedup, textureCompress, meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
const SRC = 'assets-src/car-concept/src/CarConcept.gltf';
const OUT = 'public/models';
fs.mkdirSync(OUT, { recursive: true });

// parts we never need in a racing view
const DROP = /^(Interior(Cage|Floor|Floormats|Mid|Pedal|Pillar|Rear|Door|SteeringBase|SteeringCylinder|SteeringEmblem|SteeringDash|SteeringHandle)|Engine|License Plate|BodyWindshieldWipers|BodyHoodInterior|BodyHoodUnder|BodyUnderside|Axles)/;
const ROT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; // the source's root node already converts to Y-up with the nose at +Z

const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };

async function build(name, ratio, texSize) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  // 1. world matrices, drop unwanted parts, flatten the hierarchy
  const items = [];
  for (const n of root.listNodes()) {
    const nm = n.getName() || '';
    const world = n.getWorldMatrix();
    items.push({ n, nm, world, hasMesh: !!n.getMesh() });
  }
  const wheelOf = nm => { const m = /^Wheel(Front|Rear)(L|R)/.exec(nm); return m ? (m[1] === 'Front' ? 'F' : 'R') + m[2] : null; };
  const wheelNodes = {};
  for (const it of items) {
    if (!it.hasMesh) continue;
    const mesh = it.n.getMesh();
    // unnamed mesh nodes under wheel groups are the tyres: find via parent name
    const parentName = it.n.getParentNode()?.getName() || '';
    let wheelKey = wheelOf(it.nm) || wheelOf(parentName);
    if (!wheelKey && /^Wheel/.test(parentName)) wheelKey = wheelOf(parentName);
    if (!wheelKey && DROP.test(it.nm)) continue;
    const m = mul(ROT, it.world);
    // meshes can be shared; clone before baking
    const clone = mesh.clone(); clone.setName(it.nm || `${parentName}Tyre`);
    for (const prim of clone.listPrimitives()) for (const sem of ['POSITION', 'NORMAL', 'TANGENT']) { const a = prim.getAttribute(sem); if (a) prim.setAttribute(sem, a.clone()); }
    it.n.setMesh(clone);
    transformMesh(clone, m);
    if (wheelKey) (wheelNodes[wheelKey] ??= []).push(it);
    it.baked = clone; it.wheelKey = wheelKey;
  }
  // 2. rebuild a flat scene
  for (const c of scene.listChildren()) scene.removeChild(c);
  const keep = items.filter(i => i.hasMesh && i.baked && (i.wheelKey || !DROP.test(i.nm)));
  const bodyRoot = doc.createNode('Body');
  scene.addChild(bodyRoot);
  for (const it of keep.filter(i => !i.wheelKey)) {
    const nn = doc.createNode(it.nm).setMesh(it.baked); bodyRoot.addChild(nn);
  }
  const tyreCentres = {};
  for (const key of Object.keys(wheelNodes)) {
    const parts = keep.filter(i => i.wheelKey === key);
    // wheel centre = centre of the tyre (the widest-radius part)
    const tyre = parts.find(p => /Tyre$/.test(p.baked.getName())) ?? parts[0];
    const bb = getBoundsOfMesh(tyre.baked);
    const c = [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2];
    tyreCentres[key] = c.map(v => +v.toFixed(3)); tyreCentres[key + 'bb'] = [bb.min, bb.max].map(a => a.map(v => +v.toFixed(2)));
    const g = doc.createNode(`wheel_${key}`).setTranslation(c);
    scene.addChild(g);
    // the source shows the front wheels turned: undo the yaw so every axle lies along X
    const tw = mul(ROT, parts.find(p => /Tyre$/.test(p.baked.getName())).world);
    const phi = Math.atan2(tw[2], tw[0]); const cs = Math.cos(phi), sn = Math.sin(phi);
    for (const p of parts) {
      transformMesh(p.baked, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -c[0], -c[1], -c[2], 1]);
      transformMesh(p.baked, [cs, 0, -sn, 0, 0, 1, 0, 0, sn, 0, cs, 0, 0, 0, 0, 1]);
      const role = /Tyre$/.test(p.baked.getName()) ? 'tyre' : /Rim/.test(p.baked.getName()) ? 'rim' : /Disc/.test(p.baked.getName()) ? 'disc' : 'pad';
      g.addChild(doc.createNode(`${role}`).setMesh(p.baked));
    }
  }
  // 3. materials: friendly names, drop heavy extensions
  const rename = { 'Paint 1 Carmine': 'paintMain', 'Paint 2 Carmine': 'paintAccent', Glass: 'glass', Headlight: 'headlight', Brakelight: 'brakelight', Signallight: 'signal', Tireside: 'tireSide', Tiretread: 'tireTread', Rim1: 'rim1', Rim2: 'rim2', Brake: 'brakePad', Disc: 'disc', Mirror: 'mirror', Mechanical: 'mechanical', Hardware: 'hardware', Dashboard: 'dash', 'Interior 1': 'interior1', 'Interior 2': 'interior2', 'Interior 3 Carmine': 'interior3', 'Panel Sides': 'panel' };
  for (const m of root.listMaterials()) {
    const nm = m.getName(); if (rename[nm]) m.setName(rename[nm]);
    for (const ext of m.listExtensions()) if (/iridescence|transmission|variants/.test(ext.extensionName)) m.setExtension(ext.extensionName, null);
  }
  // 4. clean up, decimate, shrink textures, compress
  for (const e of root.listExtensionsUsed()) if (/variants/.test(e.extensionName)) e.dispose();
  await doc.transform(
    weld({ tolerance: 0.0001 }),
    ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: ratio < 0.1 ? 0.02 : 0.008, lockBorder: false })] : []),
    dedup(), prune({ keepLeaves: false }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const file = `${OUT}/car-${name}.glb`;
  await io.write(file, doc);
  let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  console.log(name, 'tris', Math.round(tris), 'size', (fs.statSync(file).size / 1024).toFixed(0) + ' KB', 'wheelCentres', JSON.stringify(tyreCentres));
}

function getBoundsOfMesh(mesh) {
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9], v = [0, 0, 0];
  for (const p of mesh.listPrimitives()) { const pos = p.getAttribute('POSITION'); for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); } } }
  return { min, max };
}

await build('high', 0.34, 1024);
await build('mid', 0.13, 512);
await build('low', 0.045, 256);
