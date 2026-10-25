import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
let tris = 0;
for (const n of root.listNodes()) {
  const m = n.getMesh(); if (!m) { console.log(n.getName(), 'GROUP', n.getTranslation().map(v => +v.toFixed(3))); continue; }
  let t = 0; let bb = [1e9,1e9,1e9,-1e9,-1e9,-1e9];
  for (const p of m.listPrimitives()) { t += p.getIndices().getCount() / 3; const pos = p.getAttribute('POSITION'); const v = [0,0,0]; for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], v[k]); bb[3+k] = Math.max(bb[3+k], v[k]); } } }
  tris += t; console.log(n.getName() ?? '(unnamed)', Math.round(t), 'mats:', m.listPrimitives().map(p => p.getMaterial()?.getName()).join('|'), 'bb', bb.map(v => +v.toFixed(2)).join(','));
}
console.log('total tris', Math.round(tris));
for (const t of root.listTextures()) console.log('tex', t.getName(), t.getMimeType(), t.getSize());
