import { el, clear } from './dom';
import { icon } from './icons';
import { Hud } from './hud';
import { DIFFICULTIES, formatTime, type Difficulty } from '../sim/rewards';
import type { SaveStore } from '../save/save';
import type { Track } from '../sim/Track';
import { VEHICLES } from '../data/catalog';

export interface MenuActions { race(): void; garage(): void; settings(): void; help(): void; toggleSound(): void }

export class Menu {
  readonly root = el('div', { id: 'menu', class: 'screen' });
  private readonly col = el('div', { class: 'menu-col' });
  private readonly coins = el('span');
  private readonly soundBtn: HTMLButtonElement;
  private readonly carName = el('div', { class: 'carname' });
  private setupOpen = false;

  constructor(private readonly save: SaveStore, private readonly track: Track, private readonly a: MenuActions) {
    this.soundBtn = el('button', { class: 'iconbtn', 'aria-label': 'Toggle sound', onclick: () => a.toggleSound() });
    this.root.append(this.col,
      el('div', { class: 'menu-top' }, [el('div', { class: 'chip', title: 'Race coins' }, [icon('coin'), this.coins]), this.soundBtn]),
      el('div', { class: 'menu-foot' }, ['Sunset Rush · Coral Cove Circuit']), this.carName);
    this.render();
  }

  refresh(): void { this.render(); }

  private render(): void {
    const d = this.save.data;
    this.coins.textContent = d.coins.toLocaleString();
    clear(this.soundBtn); this.soundBtn.append(icon(d.settings.sound ? 'sound' : 'mute'));
    const v = VEHICLES.find(x => x.id === d.selected)!;
    clear(this.carName); this.carName.append(el('span', { class: 'label' }, ['Your car']), el('b', {}, [v.name]));
    this.root.classList.toggle('setup-open', this.setupOpen);
    clear(this.col);
    this.col.append(el('h1', { class: 'logo title' }, ['Sunset', ' ', el('br'), 'Rush', el('small', {}, ['Coral Cove Circuit'])]));
    if (this.setupOpen) this.col.append(this.setup());
    else {
      this.col.append(el('div', { class: 'menu-btns' }, [
        el('button', { class: 'btn', onclick: () => { this.setupOpen = true; this.render(); (this.col.querySelector('.btn.good, .btn') as HTMLElement | null)?.focus(); } }, [icon('play'), 'Race']),
        el('button', { class: 'btn ghost', onclick: this.a.garage }, [icon('car'), 'Garage']),
        el('button', { class: 'btn ghost', onclick: this.a.settings }, [icon('sliders'), 'Settings']),
        el('button', { class: 'btn ghost small', onclick: this.a.help }, [icon('help'), 'How to play']),
      ]));
      const best = d.best.race ? `Best lap ${formatTime(d.best.lap ?? 0)} · Best race ${formatTime(d.best.race)}` : 'Win races to earn coins and unlock new cars and parts.';
      this.col.append(el('div', { class: 'hint' }, [best]));
    }
  }

  private setup(): HTMLElement {
    const s = this.save.data.settings;
    const canvas = el('canvas', { 'aria-label': 'Track map' });
    queueMicrotask(() => Hud.drawTrackCard(canvas, this.track));
    const seg = <T extends string | number>(items: readonly T[], value: T, label: (v: T) => string, on: (v: T) => void): HTMLElement => {
      const wrap = el('div', { class: 'seg', role: 'group' });
      items.forEach(v => wrap.append(el('button', { 'aria-pressed': String(v === value), onclick: () => { on(v); Array.from(wrap.children).forEach((c, i) => c.setAttribute('aria-pressed', String(items[i] === v))); } }, [label(v)])));
      return wrap;
    };
    const b = this.save.data.best;
    return el('div', { class: 'setup panel' }, [
      el('div', { class: 'track-card' }, [canvas, el('div', {}, [el('b', {}, ['Coral Cove Circuit']), el('span', {}, [`${(this.track.length / 1000).toFixed(1)} km · coastal climb`]), b.lap ? el('div', { class: 'hint' }, [`Best lap ${formatTime(b.lap)}`]) : null])]),
      el('div', { class: 'row' }, [el('div', { class: 'label' }, ['Laps']), seg([2, 3, 5] as const, s.laps as 2 | 3 | 5, v => String(v), v => this.save.update(d => { d.settings.laps = v; }))]),
      el('div', { class: 'row' }, [el('div', { class: 'label' }, ['Rivals']), seg<Difficulty>(DIFFICULTIES, s.difficulty, v => v[0].toUpperCase() + v.slice(1), v => this.save.update(d => { d.settings.difficulty = v; }))]),
      el('div', { class: 'hint' }, ['Harder rivals pay up to 50% more coins.']),
      el('div', { class: 'setup-actions' }, [
        el('button', { class: 'btn good', onclick: this.a.race }, [icon('flag'), 'Start race']),
        el('button', { class: 'btn ghost small', onclick: () => { this.setupOpen = false; this.render(); } }, ['Back']),
      ]),
    ]);
  }

  closeSetup(): void { this.setupOpen = false; }
}
