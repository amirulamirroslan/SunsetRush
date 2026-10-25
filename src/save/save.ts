import { CATEGORIES, DEFAULT_LOADOUTS, defaultUnlocked, isVehicleId, type CategoryId, type Loadout, type VehicleId } from '../data/catalog';
import { DIFFICULTIES, type Difficulty } from '../sim/rewards';

export const SAVE_KEY = 'sunset-rush.save.v1';
export const SAVE_VERSION = 1;
export const START_COINS = 100;

export type QualitySetting = 'auto' | 'high' | 'medium' | 'low';
export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', 'high', 'medium', 'low'];

export interface SaveData {
  version: number;
  coins: number;
  selected: VehicleId;
  loadouts: Record<VehicleId, Loadout>;
  unlocked: Record<CategoryId, string[]>;
  best: { lap: number | null; race: number | null };
  stats: { races: number; wins: number; podiums: number };
  settings: { quality: QualitySetting; sound: boolean; autoAccelerate: boolean; laps: number; difficulty: Difficulty };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION, coins: START_COINS, selected: 'comet',
    loadouts: JSON.parse(JSON.stringify(DEFAULT_LOADOUTS)) as Record<VehicleId, Loadout>,
    unlocked: defaultUnlocked(),
    best: { lap: null, race: null },
    stats: { races: 0, wins: 0, podiums: 0 },
    settings: { quality: 'auto', sound: true, autoAccelerate: true, laps: 3, difficulty: 'normal' },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const posOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 1 && v < 36000 ? v : null);

/** Turns anything (corrupt JSON, an older version, hand-edited data) into a valid save. Never throws. */
export function sanitizeSave(raw: unknown): SaveData {
  const out = defaultSave();
  if (!isObj(raw)) return out;
  out.coins = Math.floor(num(raw.coins, 0, 9_999_999, START_COINS));
  const unlockedRaw = isObj(raw.unlocked) ? raw.unlocked : {};
  (Object.keys(CATEGORIES) as CategoryId[]).forEach(cat => {
    const valid = new Set(CATEGORIES[cat].map(i => i.id));
    const list = Array.isArray(unlockedRaw[cat]) ? (unlockedRaw[cat] as unknown[]).filter((x): x is string => typeof x === 'string' && valid.has(x)) : [];
    out.unlocked[cat] = Array.from(new Set([...out.unlocked[cat], ...list]));
  });
  const loadRaw = isObj(raw.loadouts) ? raw.loadouts : {};
  (Object.keys(DEFAULT_LOADOUTS) as VehicleId[]).forEach(v => {
    const l = isObj(loadRaw[v]) ? (loadRaw[v] as Record<string, unknown>) : {};
    const pick = (cat: CategoryId, key: keyof Loadout): void => {
      const val = l[key];
      if (typeof val === 'string' && out.unlocked[cat].includes(val)) (out.loadouts[v] as unknown as Record<string, string>)[key] = val;
    };
    pick('paints', 'paint'); pick('finishes', 'finish'); pick('wheels', 'wheels'); pick('spoilers', 'spoiler'); pick('decals', 'decal');
  });
  if (isVehicleId(raw.selected) && out.unlocked.vehicles.includes(raw.selected)) out.selected = raw.selected;
  if (isObj(raw.best)) { out.best.lap = posOrNull(raw.best.lap); out.best.race = posOrNull(raw.best.race); }
  if (isObj(raw.stats)) {
    out.stats.races = Math.floor(num(raw.stats.races, 0, 1e7, 0));
    out.stats.wins = Math.floor(num(raw.stats.wins, 0, 1e7, 0));
    out.stats.podiums = Math.floor(num(raw.stats.podiums, 0, 1e7, 0));
  }
  if (isObj(raw.settings)) {
    const s = raw.settings;
    if (QUALITY_SETTINGS.includes(s.quality as QualitySetting)) out.settings.quality = s.quality as QualitySetting;
    if (typeof s.sound === 'boolean') out.settings.sound = s.sound;
    if (typeof s.autoAccelerate === 'boolean') out.settings.autoAccelerate = s.autoAccelerate;
    if ([2, 3, 5].includes(s.laps as number)) out.settings.laps = s.laps as number;
    if (DIFFICULTIES.includes(s.difficulty as Difficulty)) out.settings.difficulty = s.difficulty as Difficulty;
  }
  return out;
}

/** Minimal subset of the Web Storage API, so tests (and private-mode browsers) can supply their own. */
export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function browserStorage(): KeyValueStore | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** Local progress store. Falls back to memory when storage is blocked or full; `persistent` tells the UI. */
export class SaveStore {
  data: SaveData;
  persistent = true;
  private readonly listeners = new Set<(d: SaveData) => void>();

  constructor(private readonly storage: KeyValueStore | null = browserStorage()) {
    this.data = this.read();
  }

  private read(): SaveData {
    if (!this.storage) { this.persistent = false; return defaultSave(); }
    try {
      const text = this.storage.getItem(SAVE_KEY);
      if (!text) return defaultSave();
      return sanitizeSave(JSON.parse(text));
    } catch { return defaultSave(); }
  }

  private write(): void {
    if (!this.storage) { this.persistent = false; return; }
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); this.persistent = true; } catch { this.persistent = false; }
  }

  /** Mutates the save through `fn`, re-validates, persists and notifies listeners. */
  update(fn: (d: SaveData) => void): void {
    fn(this.data);
    this.data = sanitizeSave(this.data);
    this.write();
    this.listeners.forEach(l => l(this.data));
  }

  onChange(l: (d: SaveData) => void): () => void { this.listeners.add(l); return () => this.listeners.delete(l); }

  isUnlocked(cat: CategoryId, id: string): boolean { return this.data.unlocked[cat].includes(id); }

  /** Spends coins and unlocks an item. Returns false (and changes nothing) if it is unknown, already owned or unaffordable. */
  purchase(cat: CategoryId, id: string): boolean {
    const item = CATEGORIES[cat].find(i => i.id === id);
    if (!item || this.isUnlocked(cat, id) || this.data.coins < item.price) return false;
    this.update(d => { d.coins -= item.price; d.unlocked[cat].push(id); });
    return true;
  }

  addCoins(n: number): void { this.update(d => { d.coins += Math.max(0, Math.floor(n)); }); }

  reset(): void {
    this.data = defaultSave();
    try { this.storage?.removeItem(SAVE_KEY); } catch { /* ignore */ }
    this.write();
    this.listeners.forEach(l => l(this.data));
  }
}
