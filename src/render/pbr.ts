import { LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';

/** Poly Haven "asphalt_02" (CC0, Rob Tuytel) as WebP maps in public/textures. */
export interface AsphaltPbr { map: Texture; normal: Texture; roughness: Texture; ao: Texture }

export async function loadAsphalt(base: string, maxAniso: number): Promise<AsphaltPbr> {
  const loader = new TextureLoader();
  const get = async (file: string, srgb: boolean): Promise<Texture> => {
    const t = await loader.loadAsync(`${base}textures/${file}`);
    t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = maxAniso; t.generateMipmaps = true; t.minFilter = LinearMipmapLinearFilter;
    if (srgb) t.colorSpace = SRGBColorSpace;
    return t;
  };
  const [map, normal, roughness, ao] = await Promise.all([get('asphalt_diff.webp', true), get('asphalt_nor.webp', false), get('asphalt_rough.webp', false), get('asphalt_ao.webp', false)]);
  return { map, normal, roughness, ao };
}
