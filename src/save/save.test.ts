import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SaveStore, START_COINS, defaultSave, sanitizeSave, type KeyValueStore } from './save';
import { CATEGORIES, DEFAULT_LOADOUTS, VEHICLES, defaultUnlocked } from '../data/catalog';

class MemStore implements KeyValueStore {
  map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, v); }
  removeItem(k: string): void { this.map.delete(k); }
}

describe('catalogue', () => {
  it('has unique ids, a free default in every category and defaults that are unlocked', () => {
    for (const cat of Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]) {
      const ids = CATEGORIES[cat].map(i => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(CATEGORIES[cat].some(i => i.price === 0)).toBe(true);
    }
    const free = defaultUnlocked();
    for (const v of VEHICLES) {
      const l = DEFAULT_LOADOUTS[v.id];
      expect(free.paints).toContain(l.paint); expect(free.finishes).toContain(l.finish); expect(free.wheels).toContain(l.wheels);
      expect(free.spoilers).toContain(l.spoiler); expect(free.decals).toContain(l.decal);
    }
  });
});

describe('save data', () => {
  it('starts with defaults when nothing is stored', () => {
    const s = new SaveStore(new MemStore());
    expect(s.data.coins).toBe(START_COINS);
    expect(s.data.selected).toBe('comet');
  });
  it('survives corrupt JSON, wrong types and hostile values', () => {
    const m = new MemStore();
    m.setItem(SAVE_KEY, '{not json');
    expect(new SaveStore(m).data).toEqual(defaultSave());
    for (const bad of [null, 5, 'x', [], { coins: 'lots', selected: 'tank', unlocked: 7, loadouts: { comet: { paint: 'neon-unicorn' } }, settings: { quality: 'ultra', laps: 99 } }]) {
      const d = sanitizeSave(bad);
      expect(d.coins).toBeGreaterThanOrEqual(0);
      expect(d.selected).toBe('comet');
      expect(d.loadouts.comet.paint).toBe('sunset');
      expect(d.settings.quality).toBe('auto');
      expect(d.settings.laps).toBe(3);
    }
    expect(sanitizeSave({ coins: -50 }).coins).toBe(0);
    expect(sanitizeSave({ coins: 12.9 }).coins).toBe(12);
  });
  it('refuses to select or equip things that are not unlocked', () => {
    const d = sanitizeSave({ selected: 'ufo', loadouts: { comet: { paint: 'gold', wheels: 'neon' } } });
    expect(d.selected).toBe('comet');
    expect(d.loadouts.comet.paint).toBe('sunset');
    expect(d.loadouts.comet.wheels).toBe('classic');
  });
  it('persists purchases, selection and cosmetics across reloads', () => {
    const m = new MemStore();
    const a = new SaveStore(m);
    a.addCoins(2000);
    expect(a.purchase('wheels', 'turbine')).toBe(true);
    expect(a.purchase('paints', 'violet')).toBe(true);
    a.update(d => { d.loadouts.comet.paint = 'violet'; d.loadouts.comet.wheels = 'turbine'; d.settings.quality = 'low'; });
    const b = new SaveStore(m);
    expect(b.data.loadouts.comet.wheels).toBe('turbine');
    expect(b.data.loadouts.comet.paint).toBe('violet');
    expect(b.data.coins).toBe(START_COINS + 2000 - 250 - 150);
    expect(b.data.settings.quality).toBe('low');
  });
  it('blocks purchases that are unaffordable, owned or unknown', () => {
    const s = new SaveStore(new MemStore());
    expect(s.purchase('wheels', 'neon')).toBe(false);
    expect(s.purchase('paints', 'sunset')).toBe(false);
    expect(s.purchase('paints', 'nope')).toBe(false);
    expect(s.data.coins).toBe(START_COINS);
  });
  it('reset restores a fresh save and clears storage', () => {
    const m = new MemStore();
    const s = new SaveStore(m);
    s.addCoins(999); s.reset();
    expect(s.data).toEqual(defaultSave());
    expect(JSON.parse(m.getItem(SAVE_KEY)!).coins).toBe(START_COINS);
  });
  it('keeps working in memory if storage is unavailable or full', () => {
    const full: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('x'); } };
    const s = new SaveStore(full);
    s.addCoins(10);
    expect(s.data.coins).toBe(START_COINS + 10);
    expect(s.persistent).toBe(false);
    const none = new SaveStore(null);
    none.addCoins(5);
    expect(none.data.coins).toBe(START_COINS + 5);
  });
});
