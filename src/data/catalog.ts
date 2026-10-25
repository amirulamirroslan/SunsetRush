/**
 * Garage catalogue. Everything here is cosmetic: handling is identical for every vehicle (see sim/carPhysics.ts), so
 * a player never has to buy performance. Prices are in race coins earned on the track — there is no real-money currency.
 */
export type VehicleId = 'comet';
export type FinishId = 'gloss' | 'metallic' | 'matte';
export type WheelId = 'classic' | 'turbine' | 'mesh' | 'neon';
export type SpoilerId = 'none' | 'lip' | 'wing' | 'gt';
export type DecalId = 'none' | 'stripe' | 'twin' | 'checker' | 'flame';

export interface Priced { id: string; name: string; price: number }
export interface VehicleDef extends Priced { id: VehicleId; tagline: string }
export interface PaintDef extends Priced { color: number; accent: number }
export interface FinishDef extends Priced { id: FinishId; metalness: number; roughness: number; clearcoat: number }

export const VEHICLES: readonly VehicleDef[] = [
  { id: 'comet', name: 'Comet', tagline: 'Concept GT coupe', price: 0 },
];

export const PAINTS: readonly PaintDef[] = [
  { id: 'sunset', name: 'Sunset Orange', color: 0xff6a2b, accent: 0xffe3a3, price: 0 },
  { id: 'lagoon', name: 'Lagoon Teal', color: 0x12c2c9, accent: 0xfff4c2, price: 0 },
  { id: 'cherry', name: 'Cherry Red', color: 0xe02a3c, accent: 0xffffff, price: 0 },
  { id: 'sunbeam', name: 'Sunbeam Yellow', color: 0xffc61a, accent: 0x1b2038, price: 0 },
  { id: 'ocean', name: 'Ocean Blue', color: 0x2b6bff, accent: 0xffffff, price: 0 },
  { id: 'pearl', name: 'Coral Pearl', color: 0xf3ece4, accent: 0xff6a2b, price: 0 },
  { id: 'violet', name: 'Violet Dusk', color: 0x8a4dff, accent: 0xffd0f0, price: 150 },
  { id: 'lime', name: 'Lime Zest', color: 0x7bd62b, accent: 0x1b2038, price: 150 },
  { id: 'bubblegum', name: 'Bubblegum', color: 0xff4fa3, accent: 0xffffff, price: 150 },
  { id: 'midnight', name: 'Midnight', color: 0x1b2038, accent: 0x31e0ff, price: 250 },
  { id: 'graphite', name: 'Graphite', color: 0x4a4f5c, accent: 0xff6a2b, price: 250 },
  { id: 'gold', name: 'Champion Gold', color: 0xd9a520, accent: 0xffffff, price: 250 },
];

export const FINISHES: readonly FinishDef[] = [
  { id: 'gloss', name: 'Gloss', price: 0, metalness: 0.25, roughness: 0.32, clearcoat: 1 },
  { id: 'metallic', name: 'Metallic', price: 200, metalness: 0.85, roughness: 0.28, clearcoat: 1 },
  { id: 'matte', name: 'Satin Matte', price: 300, metalness: 0.15, roughness: 0.7, clearcoat: 0.15 },
];

export const WHEELS: readonly Priced[] = [
  { id: 'classic', name: 'Classic Five-Spoke', price: 0 },
  { id: 'turbine', name: 'Turbine', price: 250 },
  { id: 'mesh', name: 'Mesh', price: 350 },
  { id: 'neon', name: 'Neon Ring', price: 500 },
];
export const SPOILERS: readonly Priced[] = [
  { id: 'none', name: 'No Spoiler', price: 0 },
  { id: 'lip', name: 'Duck-tail Lip', price: 0 },
  { id: 'wing', name: 'Racing Wing', price: 300 },
  { id: 'gt', name: 'Tall GT Wing', price: 450 },
];
export const DECALS: readonly Priced[] = [
  { id: 'none', name: 'Clean', price: 0 },
  { id: 'stripe', name: 'Racing Stripe', price: 0 },
  { id: 'twin', name: 'Twin Stripes', price: 200 },
  { id: 'checker', name: 'Checker Flash', price: 300 },
  { id: 'flame', name: 'Flame Fade', price: 450 },
];

/** Cosmetic choices for one vehicle. */
export interface Loadout { paint: string; finish: FinishId; wheels: WheelId; spoiler: SpoilerId; decal: DecalId }
export const DEFAULT_LOADOUT: Loadout = { paint: 'sunset', finish: 'gloss', wheels: 'classic', spoiler: 'lip', decal: 'stripe' };
export const DEFAULT_LOADOUTS: Record<VehicleId, Loadout> = {
  comet: { ...DEFAULT_LOADOUT },
};

export type CategoryId = 'vehicles' | 'paints' | 'finishes' | 'wheels' | 'spoilers' | 'decals';
export const CATEGORIES: Record<CategoryId, readonly Priced[]> = {
  vehicles: VEHICLES, paints: PAINTS, finishes: FINISHES, wheels: WHEELS, spoilers: SPOILERS, decals: DECALS,
};

export const findPaint = (id: string): PaintDef => PAINTS.find(p => p.id === id) ?? PAINTS[0];
export const findFinish = (id: string): FinishDef => FINISHES.find(f => f.id === id) ?? FINISHES[0];
export const isVehicleId = (v: unknown): v is VehicleId => VEHICLES.some(x => x.id === v);

/** Items that are free from the start. */
export function defaultUnlocked(): Record<CategoryId, string[]> {
  const out = {} as Record<CategoryId, string[]>;
  (Object.keys(CATEGORIES) as CategoryId[]).forEach(k => { out[k] = CATEGORIES[k].filter(i => i.price === 0).map(i => i.id); });
  return out;
}

/** Rival drivers. Their looks come from the same catalogue as the player's. */
export interface RivalDef { name: string; vehicle: VehicleId; loadout: Loadout }
export const RIVALS: readonly RivalDef[] = [
  { name: 'Nova', vehicle: 'comet', loadout: { paint: 'ocean', finish: 'metallic', wheels: 'turbine', spoiler: 'wing', decal: 'twin' } },
  { name: 'Mango', vehicle: 'comet', loadout: { paint: 'sunbeam', finish: 'gloss', wheels: 'classic', spoiler: 'none', decal: 'checker' } },
  { name: 'Zed', vehicle: 'comet', loadout: { paint: 'midnight', finish: 'metallic', wheels: 'mesh', spoiler: 'gt', decal: 'stripe' } },
  { name: 'Pixel', vehicle: 'comet', loadout: { paint: 'bubblegum', finish: 'gloss', wheels: 'neon', spoiler: 'lip', decal: 'none' } },
  { name: 'Juno', vehicle: 'comet', loadout: { paint: 'lime', finish: 'gloss', wheels: 'mesh', spoiler: 'lip', decal: 'flame' } },
];
