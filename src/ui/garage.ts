import { el, clear } from './dom';
import { icon } from './icons';
import { CATEGORIES, PAINTS, VEHICLES, type CategoryId, type Loadout, type Priced, type VehicleId } from '../data/catalog';
import type { SaveStore } from '../save/save';

export interface GarageActions { preview(vehicle: VehicleId, loadout: Loadout): void; done(): void; sfx(kind: 'click' | 'unlock'): void }

const ALL_TABS: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'vehicles', label: 'Cars', icon: 'car' }, { id: 'paints', label: 'Paint', icon: 'paint' }, { id: 'finishes', label: 'Finish', icon: 'finish' },
  { id: 'wheels', label: 'Wheels', icon: 'wheel' }, { id: 'spoilers', label: 'Spoiler', icon: 'spoiler' }, { id: 'decals', label: 'Decals', icon: 'decal' },
];
/** With a single car there is nothing to choose, so the Cars tab only appears once there are several. */
const TABS = ALL_TABS.filter(t => t.id !== 'vehicles' || VEHICLES.length > 1);
const LOADOUT_KEY: Record<Exclude<CategoryId, 'vehicles'>, keyof Loadout> = { paints: 'paint', finishes: 'finish', wheels: 'wheels', spoilers: 'spoiler', decals: 'decal' };

/** Garage panel: pick a car, then paint / finish / wheels / spoiler / decal. Locked items can be tried on before buying. */
export class Garage {
  readonly root = el('div', { id: 'garage', class: 'screen' });
  private readonly panel = el('div', { class: 'garage-panel panel' });
  private readonly dragArea = el('div', { class: 'drag-area' });
  private readonly rotator = el('div', { class: 'rotator' }, [el('div', { class: 'hint' }, ['Drag to rotate · pinch or scroll to zoom'])]);
  private tab: CategoryId = TABS[0].id;
  private view: VehicleId = 'comet';
  private tryOn: { cat: Exclude<CategoryId, 'vehicles'>; id: string } | null = null;
  private message = '';

  constructor(private readonly save: SaveStore, private readonly a: GarageActions) {
    this.root.append(this.dragArea, this.panel, this.rotator);
    this.root.style.justifyContent = 'flex-start';
  }

  get dragSurface(): HTMLElement { return this.dragArea; }

  open(): void { this.view = this.save.data.selected; this.tab = TABS[0].id; this.tryOn = null; this.message = ''; this.render(); this.pushPreview(); }

  /** The loadout shown in the 3D preview (saved loadout plus any try-on). */
  currentLook(): { vehicle: VehicleId; loadout: Loadout } {
    const loadout = { ...this.save.data.loadouts[this.view] };
    if (this.tryOn) (loadout as unknown as Record<string, string>)[LOADOUT_KEY[this.tryOn.cat]] = this.tryOn.id;
    return { vehicle: this.view, loadout };
  }
  private pushPreview(): void { const l = this.currentLook(); this.a.preview(l.vehicle, l.loadout); }

  private owned(cat: CategoryId, id: string): boolean { return this.save.isUnlocked(cat, id); }
  private equippedId(cat: CategoryId): string {
    return cat === 'vehicles' ? this.view : this.save.data.loadouts[this.view][LOADOUT_KEY[cat]];
  }

  private pick(cat: CategoryId, item: Priced): void {
    this.a.sfx('click'); this.message = '';
    if (cat === 'vehicles') {
      this.view = item.id as VehicleId; this.tryOn = null;
      if (this.owned('vehicles', item.id)) this.save.update(d => { d.selected = this.view; });
    } else if (this.owned(cat, item.id)) {
      this.tryOn = null; this.save.update(d => { (d.loadouts[this.view] as unknown as Record<string, string>)[LOADOUT_KEY[cat]] = item.id; });
    } else this.tryOn = { cat, id: item.id };
    this.render(); this.pushPreview();
  }

  private pendingItem(): { cat: CategoryId; item: Priced } | null {
    if (this.tab === 'vehicles') { const v = VEHICLES.find(x => x.id === this.view)!; return this.owned('vehicles', v.id) ? null : { cat: 'vehicles', item: v }; }
    if (this.tryOn) { const item = CATEGORIES[this.tryOn.cat].find(i => i.id === this.tryOn!.id); return item ? { cat: this.tryOn.cat, item } : null; }
    return null;
  }

  private buy(): void {
    const p = this.pendingItem(); if (!p) return;
    if (!this.save.purchase(p.cat, p.item.id)) { this.message = `Not enough coins: you need ${p.item.price - this.save.data.coins} more.`; this.render(); return; }
    this.a.sfx('unlock');
    if (p.cat === 'vehicles') this.save.update(d => { d.selected = this.view; });
    else { this.save.update(d => { (d.loadouts[this.view] as unknown as Record<string, string>)[LOADOUT_KEY[p.cat as Exclude<CategoryId, 'vehicles'>]] = p.item.id; }); this.tryOn = null; }
    this.message = `${p.item.name} unlocked.`; this.render(); this.pushPreview();
  }

  render(): void {
    const d = this.save.data;
    const v = VEHICLES.find(x => x.id === this.view)!;
    clear(this.panel);
    const tabs = el('div', { class: 'tabs', role: 'tablist' }, TABS.map(t => el('button', { class: 'tab', role: 'tab', 'aria-selected': String(this.tab === t.id), onclick: () => { this.tab = t.id; this.tryOn = null; this.message = ''; this.render(); this.pushPreview(); } }, [icon(t.icon), t.label])));
    const grid = el('div', { class: 'grid', role: 'list' });
    const equipped = this.equippedId(this.tab);
    for (const item of CATEGORIES[this.tab]) {
      const own = this.owned(this.tab, item.id);
      const isTry = this.tryOn?.cat === this.tab && this.tryOn.id === item.id;
      const pressed = own ? equipped === item.id && !this.tryOn : isTry;
      const pict = this.tab === 'paints'
        ? el('div', { class: 'sw', style: `background:#${PAINTS.find(p => p.id === item.id)!.color.toString(16).padStart(6, '0')}` })
        : el('div', { class: 'pict' }, [icon(TABS.find(t => t.id === this.tab)!.icon)]);
      const sub = this.tab === 'vehicles' ? (VEHICLES.find(x => x.id === item.id)!.tagline) : null;
      grid.append(el('button', { class: 'card', role: 'listitem', 'aria-pressed': String(pressed), 'aria-label': `${item.name}${own ? '' : `, locked, ${item.price} coins`}`, onclick: () => this.pick(this.tab, item) }, [
        pict, el('div', { class: 'nm' }, [item.name]), sub ? el('div', { class: 'sub' }, [sub]) : null,
        own ? (equipped === item.id ? el('span', { class: 'badge eq' }, [icon('check')]) : null) : el('span', { class: 'badge lock' }, [icon('lock')]),
        own ? null : el('span', { class: 'price' }, [icon('coin'), String(item.price)]),
      ]));
    }
    const pend = this.pendingItem();
    const afford = pend ? d.coins >= pend.item.price : true;
    const foot = el('div', { class: 'garage-foot' }, [
      this.message ? el('div', { class: 'notice' }, [this.message]) : null,
      pend ? el('button', { class: 'btn good block', disabled: !afford, onclick: () => this.buy() }, [icon('coin'), `Buy ${pend.item.name} · ${pend.item.price}`]) : null,
      pend && !afford ? el('div', { class: 'garage-note' }, [icon('info'), 'Earn coins by racing. Try-on is free.']) : null,
      this.tab === 'vehicles' ? el('div', { class: 'garage-note' }, [icon('info'), 'Every car handles the same. Only the look changes.']) : null,
      !d.unlocked.vehicles.includes(this.view) ? el('div', { class: 'garage-note' }, [icon('lock'), 'Locked car: buy it to race with it.']) : null,
    ]);
    this.panel.append(
      el('div', { class: 'garage-head' }, [el('h2', { class: 'title' }, [v.name]), el('span', { class: 'chip' }, [icon('coin'), d.coins.toLocaleString()]),
        el('button', { class: 'btn small', onclick: () => this.a.done() }, [icon('check'), 'Done'])]),
      tabs, grid, foot);
  }
}
