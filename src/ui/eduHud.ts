import { el } from './dom';
import { icon } from './icons';
import type { LiveInfo } from '../edu/objectives';

/** The compact objective strip shown while driving a mission. It only displays; nothing here can touch the race. */
export class EduHud {
  readonly root = el('div', { id: 'eduhud', 'aria-live': 'off' });
  private readonly title = el('div', { class: 'eh-title' });
  private readonly target = el('div', { class: 'eh-target' });
  private readonly live = el('div', { class: 'eh-live' });
  private readonly dots = el('div', { class: 'eh-dots' });
  private readonly signal = el('div', { class: 'eh-signal', hidden: true }, ['STOP']);
  private cache = '';
  constructor() { this.root.append(el('div', { class: 'eh-box' }, [this.dots, this.title, this.target, this.live]), this.signal, this.noteBox); }

  show(on: boolean): void { this.root.classList.toggle('on', on); if (!on) this.cache = ''; }
  update(li: LiveInfo | null): void {
    if (!li) return;
    const key = `${li.index}|${li.inside}|${Math.round(li.avgKmh)}|${li.signal}|${Math.round(li.overSec * 10)}|${Math.round(li.timeLeft)}|${Math.round((li.distToStart ?? 0) / 10)}`;
    if (key === this.cache) return; this.cache = key;
    this.title.textContent = li.label; this.target.textContent = li.target;
    this.dots.replaceChildren(...Array.from({ length: li.count }, (_, i) => el('i', { class: i < li.index ? 'done' : i === li.index ? 'now' : '' })));
    let txt = '';
    if (li.inside) txt = `In section · average ${Math.round(li.avgKmh)} km/h${li.overSec > 0.05 ? ` · over limit ${li.overSec.toFixed(1)} s` : ''}`;
    else if (li.distToStart !== undefined) txt = li.distToStart > 1 ? `Next gate in ${Math.round(li.distToStart)} m` : '';
    this.live.replaceChildren(icon('stopwatch'), ` ${txt}`.trimEnd(), el('span', { class: 'eh-time' }, [`${Math.ceil(li.timeLeft)} s left`]));
    this.signal.hidden = !li.signal;
  }
  private readonly noteBox = el('div', { class: 'eh-note', hidden: true });
  /** A field note card that stays out of the way of the road. Pass null to hide it. */
  note(title: string | null, text = ''): void {
    if (title === null) { this.noteBox.hidden = true; return; }
    this.noteBox.replaceChildren(el('b', {}, [title]), el('p', {}, [text])); this.noteBox.hidden = false;
  }
  /** Explore mode has no objective; show a small progress line instead. */
  exploreInfo(text: string): void {
    if (this.cache === 'explore:' + text) return; this.cache = 'explore:' + text;
    this.title.textContent = 'Explore the coast'; this.target.textContent = 'Drive through the green beacons to find field notes.';
    this.dots.replaceChildren(); this.live.replaceChildren(icon('info'), ` ${text}`); this.signal.hidden = true;
  }
  clearSignal(): void { this.signal.hidden = true; }
}
