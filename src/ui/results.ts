import { el, clear } from './dom';
import { icon } from './icons';
import { formatTime, ordinal, type RewardBreakdown } from '../sim/rewards';

export interface ResultRow { name: string; time: number | null; me: boolean }
export interface ResultsData {
  place: number; total: number; time: number; bestLap: number | null; newBestLap: boolean; newBestRace: boolean;
  rows: ResultRow[]; rewards: RewardBreakdown; coinsAfter: number; topSpeedKmh: number; driftSeconds: number; unlockable: string[];
}
export interface ResultsActions { again(): void; garage(): void; menu(): void }

export class Results {
  readonly root = el('div', { id: 'results', class: 'screen' });
  constructor(private readonly a: ResultsActions) {}
  show(d: ResultsData): void {
    clear(this.root);
    const medal = d.place === 1 ? 'g' : d.place === 2 ? 's' : d.place === 3 ? 'b' : 'n';
    const ord = ordinal(d.place);
    const hero = el('div', { class: 'hero' }, [
      el('div', { class: 'label' }, [d.place === 1 ? 'Victory' : d.place <= 3 ? 'Podium finish' : 'Race complete']),
      el('div', { class: 'place' }, [el('div', { class: `medal ${medal}` }, [icon(d.place <= 3 ? 'trophy' : 'flag')]), el('b', {}, [String(d.place), el('sup', {}, [ord.replace(/\d+/, '')])])]),
      el('div', { class: 'stats' }, [
        el('div', { class: 'stat' }, [el('span', { class: 'label' }, ['Race time']), el('b', {}, [formatTime(d.time)]), d.newBestRace ? el('em', {}, ['NEW BEST']) : null]),
        el('div', { class: 'stat' }, [el('span', { class: 'label' }, ['Best lap']), el('b', {}, [d.bestLap ? formatTime(d.bestLap) : '--']), d.newBestLap ? el('em', {}, ['NEW BEST']) : null]),
        el('div', { class: 'stat' }, [el('span', { class: 'label' }, ['Top speed']), el('b', {}, [`${Math.round(d.topSpeedKmh)} km/h`])]),
        el('div', { class: 'stat' }, [el('span', { class: 'label' }, ['Drift time']), el('b', {}, [`${d.driftSeconds.toFixed(1)} s`])]),
      ]),
      el('div', { class: 'table' }, d.rows.map((r, i) => el('div', { class: `tr${r.me ? ' me' : ''}` }, [el('span', {}, [String(i + 1)]), el('span', {}, [r.name]), el('span', {}, [r.time === null ? 'DNF' : formatTime(r.time)])]))),
    ]);
    const lines = d.rewards.lines.map((l, i) => {
      const row = el('div', { class: 'rl', style: `animation-delay:${0.25 + i * 0.11}s` }, [el('span', {}, [l.label]), el('span', {}, [`+${l.amount}`])]); return row;
    });
    const side = el('div', { class: 'hero' }, [
      el('div', { class: 'label' }, ['Rewards']),
      el('div', { class: 'rewards' }, lines),
      el('div', { class: 'total' }, [el('span', {}, ['Total']), el('span', { class: 'coins' }, [icon('coin'), `+${d.rewards.total}`])]),
      el('div', { class: 'hint' }, [`Balance: ${d.coinsAfter.toLocaleString()} coins`]),
      d.unlockable.length ? el('div', { class: 'notice' }, [`You can now afford: ${d.unlockable.join(', ')}. Visit the Garage.`]) : null,
    ]);
    this.root.append(el('div', { class: 'res panel' }, [hero, side, el('div', { class: 'actions' }, [
      el('button', { class: 'btn good', onclick: this.a.again }, [icon('restart'), 'Race again']),
      el('button', { class: 'btn ghost', onclick: this.a.garage }, [icon('car'), 'Garage']),
      el('button', { class: 'btn ghost', onclick: this.a.menu }, [icon('home'), 'Menu']),
    ])]));
    (this.root.querySelector('.btn.good') as HTMLElement | null)?.focus();
  }
}
