import type { Atmosphere } from './atmosphere';
import { DataUtils, EquirectangularReflectionMapping, HalfFloatType, PMREMGenerator, type DataTexture, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/**
 * Optional car-reflection environment: a Poly Haven HDRI (CC0) as shipped, downsized to 512px, by `@pmndrs/assets`. Which one comes from
 * the lighting preset (`Atmosphere.hdri`: park for daylight, forest for overcast, sunset for golden hour).
 * 512px is far too soft to be a backdrop or scene lighting, so it is only ever used as the `envMap` of car paint and glass.
 * Enabled with `?hdri` (off by default); the code and the ~150 KB image load lazily and nothing is fetched otherwise.
 */
export interface CarEnvironment { texture: Texture; rotationY: number; dispose(): void }

/** Azimuth (atan2(z, x), the same convention as three's equirect mapping) of the brightest texel. */
export function brightestAzimuth(data: ArrayLike<number>, width: number, height: number, half: boolean, channels = 4): number {
  const f = (v: number): number => (half ? DataUtils.fromHalfFloat(v) : v);
  let best = -1, bx = 0;
  for (let y = 0; y < height; y++) {
    // weight by cos(latitude) so the crowded pixels near the poles cannot win on count alone; v = 0 is the bottom row in three
    const lat = ((y + 0.5) / height - 0.5) * Math.PI;
    const w = Math.max(0.05, Math.cos(lat));
    for (let x = 0; x < width; x++) {
      const k = (y * width + x) * channels;
      const l = (0.2126 * f(data[k]) + 0.7152 * f(data[k + 1]) + 0.0722 * f(data[k + 2])) * w;
      if (l > best) { best = l; bx = x; }
    }
  }
  return ((bx + 0.5) / width - 0.5) * Math.PI * 2;
}

/** Y rotation to give `Material.envMapRotation` so the HDRI's sun appears at `sceneSunAzimuth` (sampled direction = R(theta) * world direction). */
export const alignRotationY = (sceneSunAzimuth: number, hdriSunAzimuth: number): number => sceneSunAzimuth - hdriSunAzimuth;

const HDRI_SOURCES: Record<Atmosphere['hdri'], () => Promise<{ default: string }>> = {
  park: () => import('@pmndrs/assets/hdri/park.exr'),
  forest: () => import('@pmndrs/assets/hdri/forest.exr'),
  sunset: () => import('@pmndrs/assets/hdri/sunset.exr'),
  dawn: () => import('@pmndrs/assets/hdri/dawn.exr'),
  city: () => import('@pmndrs/assets/hdri/city.exr'),
};

export async function loadCarEnvironment(renderer: WebGLRenderer, sceneSunAzimuth: number, kind: Atmosphere['hdri'] = 'park'): Promise<CarEnvironment> {
  const [{ EXRLoader }, hdri] = await Promise.all([import('three/addons/loaders/EXRLoader.js'), HDRI_SOURCES[kind]()]);
  const src = await new EXRLoader().setDataType(HalfFloatType).loadAsync(hdri.default) as DataTexture;
  src.mapping = EquirectangularReflectionMapping;
  const img = src.image as { data: ArrayLike<number>; width: number; height: number };
  const sunAz = brightestAzimuth(img.data, img.width, img.height, true);
  const pmrem = new PMREMGenerator(renderer);
  const rt: WebGLRenderTarget = pmrem.fromEquirectangular(src);
  pmrem.dispose(); src.dispose();
  return { texture: rt.texture, rotationY: alignRotationY(sceneSunAzimuth, sunAz), dispose: () => rt.dispose() };
}
