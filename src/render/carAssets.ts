import { Group, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export type CarLod = 'high' | 'mid' | 'low';

/**
 * Loads the car model (see tools/prepare-car.mjs for how it is produced from the Khronos "Car Concept" source) once per
 * level of detail and hands out cheap clones. Geometry and textures are shared between clones.
 */
export class CarAssets {
  private readonly templates = new Map<CarLod, Group>();
  private readonly loader = new GLTFLoader();
  constructor(private readonly base: string) { this.loader.setMeshoptDecoder(MeshoptDecoder); }

  async load(lod: CarLod): Promise<Group> {
    const hit = this.templates.get(lod); if (hit) return hit;
    const gltf = await this.loader.loadAsync(`${this.base}models/car-${lod}.glb`);
    this.templates.set(lod, gltf.scene);
    return gltf.scene;
  }
  has(lod: CarLod): boolean { return this.templates.has(lod); }
  template(lod: CarLod): Group {
    const t = this.templates.get(lod); if (!t) throw new Error(`car model ${lod} not loaded`);
    return t;
  }
  dispose(): void {
    for (const t of this.templates.values()) t.traverse((o: Object3D) => {
      const m = o as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
      m.geometry?.dispose(); if (Array.isArray(m.material)) m.material.forEach(x => x.dispose()); else m.material?.dispose();
    });
    this.templates.clear();
  }
}
