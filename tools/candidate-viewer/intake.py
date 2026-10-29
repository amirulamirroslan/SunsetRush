#!/usr/bin/env python3
"""Intake check for a downloaded car model (GLB or glTF). Offline, needs only numpy + Pillow.
Usage: python3 intake.py model.glb [more models...]
Prints licence metadata found in the file, budget numbers and PASS/WARN/FAIL lines. It does NOT replace reading the licence
text on the model's page; absence of licence metadata is a FAIL for 'provenance' until you record it in assets-src/<name>/LICENSE.md."""
import sys, os, json, struct, io, collections
import numpy as np
from glb_geom import acc, flatten

def load_any(p):
    d = open(p, 'rb').read()
    if d[:4] == b'glTF':
        off = 12; js = b = None
        while off < len(d):
            cl, ct = struct.unpack('<II', d[off:off+8]); c = d[off+8:off+8+cl]
            if ct == 0x4E4F534A: js = json.loads(c)
            elif ct == 0x004E4942: b = c
            off += 8 + cl
        return js, b, len(d)
    js = json.loads(d); base = os.path.dirname(p)
    uri = js['buffers'][0].get('uri', '')
    b = open(os.path.join(base, uri), 'rb').read() if uri and not uri.startswith('data:') else None
    return js, b, len(d) + sum(os.path.getsize(os.path.join(base, x['uri'])) for x in js.get('images', []) + js['buffers'] if 'uri' in x and not x['uri'].startswith('data:') and os.path.exists(os.path.join(base, x['uri'])))

def img_size(j, b, im, base):
    try:
        from PIL import Image
        if 'bufferView' in im:
            bv = j['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0)
            return Image.open(io.BytesIO(b[o:o+bv['byteLength']])).size, bv['byteLength']
        if im.get('uri', '').startswith('data:'): return None, 0
        fp = os.path.join(base, im['uri']); return Image.open(fp).size, os.path.getsize(fp)
    except Exception: return None, 0

def check(p):
    j, b, total = load_any(p); base = os.path.dirname(p)
    res = []; add = lambda lvl, msg: res.append((lvl, msg))
    print('=' * 78); print(os.path.basename(p), f'{total/1e6:.2f} MB')
    a = j.get('asset', {}); ex = a.get('extras') or {}
    print('asset:', json.dumps({k: v for k, v in a.items() if k != 'extras'}), '| extras:', json.dumps(ex)[:400])
    lic = ex.get('license') or ex.get('licence') or a.get('copyright')
    add('PASS' if lic else 'FAIL', f'licence metadata in file: {lic}' if lic else 'no licence metadata in file -> read the licence on the source page and record it in assets-src/<name>/LICENSE.md before use')
    eu = j.get('extensionsUsed', [])
    print('extensions:', eu)
    comp = [e for e in eu if e in ('KHR_draco_mesh_compression', 'EXT_meshopt_compression')]
    if comp: add('WARN', f'compressed geometry {comp}: this tool cannot read the vertices (bounds/tris below are unavailable); the game already has a meshopt decoder')
    if 'KHR_materials_transmission' in eu: add('WARN', 'uses KHR_materials_transmission (extra render pass in three.js): replace with plain alpha glass for low-end PCs')
    if j.get('animations'): add('WARN', f"{len(j['animations'])} animations (the game spins/steers wheels itself; animations are ignored/unneeded)")
    if j.get('skins'): add('WARN', 'skinned meshes: cannot be merged simply')
    nodes, meshes, mats = len(j.get('nodes', [])), len(j.get('meshes', [])), len(j.get('materials', []))
    nprims = sum(len(m['primitives']) for m in j.get('meshes', []))
    print(f'nodes {nodes} meshes {meshes} primitives {nprims} materials {mats} textures {len(j.get("textures", []))} images {len(j.get("images", []))}')
    add('PASS' if nprims <= 60 else ('WARN' if nprims <= 150 else 'FAIL'), f'{nprims} primitives (draw calls as shipped; <=60 ideal, mergeable by material to ~{mats})')
    add('PASS' if mats <= 16 else 'WARN', f'{mats} materials')
    big = 0
    for i, im in enumerate(j.get('images', [])):
        sz, nb = img_size(j, b, im, base)
        if sz: big = max(big, max(sz)); print(f'  image {i}: {sz[0]}x{sz[1]} {nb/1024:.0f} KB')
    if big: add('PASS' if big <= 2048 else 'WARN', f'largest texture {big}px (resize to <=2048; 1024 for low tier)')
    if not comp and b is not None:
        try:
            prims = flatten(j, b); tri = sum(len(q['idx']) for q in prims); allp = np.vstack([q['pos'] for q in prims])
            lo, hi = allp.min(0), allp.max(0); size = hi - lo
            print('triangles', tri, '| bbox size (x,y,z) m', size.round(3), '| min', lo.round(3))
            add('PASS' if tri <= 80000 else ('WARN' if tri <= 150000 else 'FAIL'), f'{tri} triangles (target <=80k high LOD, ~35k mid, ~15k low; decimate if more)')
            ax = int(np.argmax([size[0], size[2]])) * 2  # longest horizontal axis: 0=x, 2=z
            print(f"length axis: {'X' if ax == 0 else 'Z'} ({max(size[0], size[2]):.2f} m), height {size[1]:.2f} m, width {min(size[0], size[2]):.2f} m, ground offset y={lo[1]:.2f}")
            L = max(size[0], size[2]); Wd = min(size[0], size[2]); H = size[1]
            add('PASS' if 1.05 <= H <= 1.35 and 1.8 <= Wd <= 2.1 else 'WARN', f'proportions L{L:.2f} W{Wd:.2f} H{H:.2f} m (modern coupe ~4.4-4.6 / 1.85-2.0 / 1.10-1.30; scale to the game car length 4.34 m)')
            add('PASS' if H / L < 0.29 else 'WARN', f'height/length {H/L:.3f} (low sports coupe < 0.29)')
        except Exception as e: add('WARN', f'geometry read failed: {e}')
    names = ' '.join(n.get('name', '').lower() for n in j.get('nodes', []))
    for key in ('wheel', 'tire', 'tyre', 'light', 'glass', 'brake', 'exhaust', 'interior'):
        if key in names: print(f'  parts mentioning "{key}":', names.count(key))
    print('-' * 78)
    for lvl, msg in res: print(f'[{lvl}] {msg}')
    worst = 'FAIL' if any(l == 'FAIL' for l, _ in res) else ('WARN' if any(l == 'WARN' for l, _ in res) else 'PASS')
    print('OVERALL (numbers only; looks and licence text still need human review):', worst)

if __name__ == '__main__':
    for f in sys.argv[1:]: check(f)
