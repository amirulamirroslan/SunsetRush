import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, MeshBasicMaterial, Vector3 } from 'three';
import { ChunkedInstances, type Placement } from './vegetation';

function grid(n: number, step: number): Placement[] {
  const items: Placement[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) items.push({ x: i * step, y: 0, z: j * step, s: 1, r: 0, tint: 0xffffff * ((i + j) % 2) });
  return items;
}
const visibleMeshes = (g: Group): InstancedMesh[] => g.children.filter((o): o is InstancedMesh => (o as InstancedMesh).isInstancedMesh && o.visible);

describe('ChunkedInstances far-field batching', () => {
  const items = grid(60, 40);                           // 3600 instances over 2400 x 2400 m
  const build = (cullRange?: number) => new ChunkedInstances(items, new BoxGeometry(2, 2, 2), new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), { hiRange: 150, cullRange, tint: true });

  it('draws every instance exactly once from any camera position (no loss, no double draw)', () => {
    const c = build();
    for (const cam of [new Vector3(0, 5, 0), new Vector3(1200, 5, 1200), new Vector3(2400, 5, 0), new Vector3(-3000, 5, 4000)]) {
      c.update(cam);
      expect(visibleMeshes(c.group).reduce((n, m) => n + m.count, 0)).toBe(items.length);
    }
  });

  it('uses far fewer draw calls than one per chunk when most of the field is far away', () => {
    const c = build();
    c.update(new Vector3(0, 5, 0));
    const chunkCount = new Set(items.map(it => `${Math.floor(it.x / 110)},${Math.floor(it.z / 110)}`)).size;   // draw calls without batching (one per chunk)
    expect(visibleMeshes(c.group).length).toBeLessThan(chunkCount * 0.5);
  });

  it('respects the cull range', () => {
    const c = build(500);
    c.update(new Vector3(0, 5, 0));
    const drawn = visibleMeshes(c.group).reduce((n, m) => n + m.count, 0);
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(items.length);
  });
});
