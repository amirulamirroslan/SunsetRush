import { Vector3 } from 'three';

/**
 * Lighting + atmosphere presets. Everything that used to be hardcoded "sunset" (sky gradient, sun, fog, hemisphere fill,
 * exposure, water glitter, mountain tint, mist, screen vignette) lives in one data object, so a track only has to pick a preset
 * (alpine morning, tropical noon, desert haze, snow overcast, ...). `World.setAtmosphere` applies one at runtime.
 * Colours are sRGB hex, exactly as authored; shaders convert them to linear on output.
 */
export interface SkyColours {
  zenith: number; mid: number; low: number; horizon: number;
  /** colour of the "ground" half of the dome below the horizon (only seen through gaps and in reflections) */ ground: number;
  /** broad warm/white glow around the sun */ glow: number; glowStrength: number;
  /** tight sun halo */ halo: number; haloStrength: number;
  /** sun disc intensity (HDR) */ disc: number;
}

export interface CloudStyle {
  /** sun-facing colour of the cloud body */ lit: number;
  /** shadowed underside */ shade: number;
  /** thin bright edge where sunlight shines through */ rim: number;
  /** 0 = clear sky .. 1 = heavy overcast */ cover: number;
  /** how strongly the cloud darkens away from the sun (self-shadowing) */ depth: number;
}

export interface Atmosphere {
  id: string;
  name: string;
  /** direction TOWARDS the sun (unit vector) */ sunDir: Vector3;
  sunColor: number; sunIntensity: number;
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  /** strength of the image-based light taken from the sky dome */ envIntensity: number;
  fog: number; fogDensity: number;
  exposure: number;
  sky: SkyColours;
  clouds: CloudStyle;
  /** colour of the sun's glitter on water */ sparkle: number;
  /** tint of the low valley mist banks (blended with the fog colour) */ mist: number; mistOpacity: number;
  /** multiplies the mountain vertex colours (cool haze in daylight, warm in golden hour) */ rockTint: number;
  bloomStrength: number;
  /** screen-edge darkening, 0..1 (neutral black) */ vignette: number;
  /** Poly Haven HDRI (via @pmndrs/assets) used only for the optional `?hdri` car reflections */ hdri: 'park' | 'forest' | 'sunset' | 'dawn' | 'city';
}

const dir = (az: number, el: number): Vector3 => {
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  return new Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).normalize();
};

/** Natural mid-morning daylight, sun about 46° up: the neutral reference for judging terrain, asphalt, vegetation and shadows. */
export const DAYLIGHT: Atmosphere = {
  id: 'daylight', name: 'Natural daylight',
  sunDir: dir(28, 46),
  sunColor: 0xfff0dc, sunIntensity: 3.8,
  hemiSky: 0xb4cff2, hemiGround: 0x7d7566, hemiIntensity: 0.46,
  envIntensity: 0.72,
  fog: 0xb4cbe2, fogDensity: 0.00036,
  exposure: 0.96,
  sky: { zenith: 0x2f6fc4, mid: 0x5b9be0, low: 0x93c0ee, horizon: 0xd6e6f3, ground: 0x8c9aa4, glow: 0xfff0d8, glowStrength: 0.16, halo: 0xfff6e6, haloStrength: 0.55, disc: 5 },
  clouds: { lit: 0xffffff, shade: 0x9fb0c8, rim: 0xffffff, cover: 0.04, depth: 0.55 },
  sparkle: 0xfff6e8,
  mist: 0xdde9f4, mistOpacity: 0.5,
  rockTint: 0xffffff,
  bloomStrength: 0.22,
  vignette: 0.26,
  hdri: 'park',
};

/** Low warm sun, kept as proof that the pipeline is not tied to one look. Select with `?light=golden`. */
export const GOLDEN_HOUR: Atmosphere = {
  id: 'golden', name: 'Golden hour',
  sunDir: dir(24, 12),
  sunColor: 0xffb070, sunIntensity: 3.4,
  hemiSky: 0xa9bcea, hemiGround: 0xc99a78, hemiIntensity: 0.8,
  envIntensity: 0.9,
  fog: 0xe8b894, fogDensity: 0.00052,
  exposure: 1.0,
  sky: { zenith: 0x27458f, mid: 0x6f86c4, low: 0xe9a98a, horizon: 0xffd2a0, ground: 0xb08a78, glow: 0xffa55c, glowStrength: 0.3, halo: 0xffd09a, haloStrength: 0.8, disc: 5 },
  clouds: { lit: 0xfff0e0, shade: 0x8d86a8, rim: 0xffe0b0, cover: 0.0, depth: 0.7 },
  sparkle: 0xffc88a,
  mist: 0xffe0c8, mistOpacity: 0.5,
  rockTint: 0xffe6d4,
  bloomStrength: 0.4,
  vignette: 0.3,
  hdri: 'sunset',
};

/** Flat soft light for forests, snow and wet-weather tracks: no hard shadows, desaturated sky. Select with `?light=overcast`. */
export const OVERCAST: Atmosphere = {
  id: 'overcast', name: 'Overcast',
  sunDir: dir(28, 58),
  sunColor: 0xf2f4f8, sunIntensity: 1.5,
  hemiSky: 0xc9d3e0, hemiGround: 0x8d8f8a, hemiIntensity: 1.15,
  envIntensity: 0.9,
  fog: 0xc3ccd6, fogDensity: 0.00062,
  exposure: 1.0,
  sky: { zenith: 0x7f8fa5, mid: 0x9eacbd, low: 0xb8c3cf, horizon: 0xd2d9e0, ground: 0x8f979f, glow: 0xffffff, glowStrength: 0.06, halo: 0xffffff, haloStrength: 0.1, disc: 0.4 },
  clouds: { lit: 0xe9edf2, shade: 0x8d9aab, rim: 0xf4f6f9, cover: 0.55, depth: 0.5 },
  sparkle: 0xffffff,
  mist: 0xd0d8e0, mistOpacity: 0.62,
  rockTint: 0xf0f4f8,
  bloomStrength: 0.12,
  vignette: 0.22,
  hdri: 'forest',
};

export const ATMOSPHERES: Readonly<Record<string, Atmosphere>> = { daylight: DAYLIGHT, golden: GOLDEN_HOUR, overcast: OVERCAST };
export const DEFAULT_ATMOSPHERE = DAYLIGHT;

export function resolveAtmosphere(id?: string | null): Atmosphere {
  return (id && ATMOSPHERES[id]) || DEFAULT_ATMOSPHERE;
}

/** Elevation of the sun above the horizon in degrees (used e.g. to decide whether mountains should open a gap for it). */
export const sunElevationDeg = (a: Atmosphere): number => (Math.asin(a.sunDir.y) * 180) / Math.PI;
