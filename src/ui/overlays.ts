import { el, clear } from './dom';
import { icon } from './icons';
import type { QualitySetting, SaveStore } from '../save/save';
import { QUALITY_SETTINGS } from '../save/save';

/** A modal overlay host that owns focus: Escape and the backdrop close it, focus returns to the opener. */
export class Modal {
  readonly root = el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' });
  private opener: Element | null = null;
  private onClose: (() => void) | null = null;
  constructor() {
    this.root.addEventListener('pointerdown', e => { if (e.target === this.root) this.hide(); });
    this.root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); this.hide(); } });
  }
  get isOpen(): boolean { return this.root.classList.contains('on'); }
  show(content: HTMLElement, onClose?: () => void): void {
    this.opener = document.activeElement; this.onClose = onClose ?? null;
    clear(this.root); this.root.append(content); this.root.classList.add('on');
    (content.querySelector('button, [tabindex]') as HTMLElement | null)?.focus();
  }
  hide(): void {
    if (!this.isOpen) return;
    this.root.classList.remove('on'); clear(this.root);
    const cb = this.onClose; this.onClose = null; cb?.();
    if (this.opener instanceof HTMLElement && document.contains(this.opener)) this.opener.focus();
  }
}

export function confirmDialog(m: Modal, o: { title: string; text: string; confirm: string; danger?: boolean }): Promise<boolean> {
  return new Promise(resolve => {
    let done = false;
    const finish = (v: boolean): void => { if (done) return; done = true; resolve(v); m.hide(); };
    const box = el('div', { class: 'dialog panel' }, [
      el('h2', { class: 'title' }, [o.title]), el('p', { class: 'hint', style: 'font-size:15px;margin:0' }, [o.text]),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn ghost small', onclick: () => finish(false) }, ['Cancel']),
        el('button', { class: `btn small ${o.danger ? 'danger' : ''}`, onclick: () => finish(true) }, [o.confirm]),
      ]),
    ]);
    m.show(box, () => finish(false));
  });
}

export interface SettingsHooks { onChange(): void; onReset(): void; touch: boolean }

export function settingsDialog(save: SaveStore, hooks: SettingsHooks, close: () => void): HTMLElement {
  const s = save.data.settings;
  const seg = <T extends string>(items: readonly T[], value: T, label: (v: T) => string, on: (v: T) => void): HTMLElement => {
    const wrap = el('div', { class: 'seg', role: 'group' });
    items.forEach(v => {
      const b = el('button', { 'aria-pressed': String(v === value), onclick: () => { on(v); Array.from(wrap.children).forEach((c, i) => c.setAttribute('aria-pressed', String(items[i] === v))); } }, [label(v)]);
      wrap.append(b);
    });
    return wrap;
  };
  const toggle = (label: string, value: boolean, on: (v: boolean) => void, hint?: string): HTMLElement => {
    const sw = el('button', { class: 'switch', role: 'switch', 'aria-checked': String(value), 'aria-label': label });
    sw.addEventListener('click', () => { const v = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(v)); on(v); });
    return el('div', { class: 'row' }, [el('div', {}, [el('b', {}, [label]), hint ? el('div', { class: 'hint' }, [hint]) : null]), sw]);
  };
  const persistNote = save.persistent ? null : el('div', { class: 'notice' }, ['Progress cannot be saved in this browser (storage is blocked). It will be kept only until you close the page.']);
  return el('div', { class: 'dialog panel' }, [
    el('div', { class: 'row' }, [el('h2', { class: 'title' }, ['Settings']), el('button', { class: 'iconbtn', 'aria-label': 'Close', onclick: close }, [icon('close')])]),
    el('div', { class: 'stack' }, [
      el('div', { class: 'label' }, ['Graphics quality']),
      seg<QualitySetting>(QUALITY_SETTINGS, s.quality, v => v[0].toUpperCase() + v.slice(1), v => { save.update(d => { d.settings.quality = v; }); hooks.onChange(); }),
      el('div', { class: 'hint' }, ['Auto starts from a guess for your device and lowers detail if the frame rate drops.']),
    ]),
    toggle('Sound', s.sound, v => { save.update(d => { d.settings.sound = v; }); hooks.onChange(); }),
    hooks.touch ? toggle('Auto-accelerate', s.autoAccelerate, v => { save.update(d => { d.settings.autoAccelerate = v; }); hooks.onChange(); }, 'Touch only. Hold Brake to slow down.') : null,
    persistNote,
    el('div', { class: 'stack' }, [
      el('div', { class: 'label' }, ['Progress']),
      el('button', { class: 'btn danger small block', onclick: () => hooks.onReset() }, [icon('reset'), 'Reset all progress']),
    ]),
  ]);
}

export function helpDialog(close: () => void, touch: boolean): HTMLElement {
  const k = (t: string): HTMLElement => el('span', { class: 'kbd' }, [t]);
  return el('div', { class: 'dialog panel' }, [
    el('div', { class: 'row' }, [el('h2', { class: 'title' }, ['How to play']), el('button', { class: 'iconbtn', 'aria-label': 'Close', onclick: close }, [icon('close')])]),
    touch
      ? el('dl', { class: 'keys' }, [el('dt', {}, ['Steer']), el('dd', {}, ['Slide on the pad (bottom left)']), el('dt', {}, ['Drift']), el('dd', {}, ['Hold DRIFT while turning']), el('dt', {}, ['Boost']), el('dd', {}, ['Hold BOOST to spend the meter']), el('dt', {}, ['Brake']), el('dd', {}, ['BRAKE / reverse'])])
      : el('dl', { class: 'keys' }, [
        el('dt', {}, [k('W'), ' ', k('↑')]), el('dd', {}, ['Accelerate']), el('dt', {}, [k('S'), ' ', k('↓')]), el('dd', {}, ['Brake / reverse']),
        el('dt', {}, [k('A'), ' ', k('D'), ' ', k('←'), ' ', k('→')]), el('dd', {}, ['Steer']), el('dt', {}, [k('Space')]), el('dd', {}, ['Drift (hold while turning)']),
        el('dt', {}, [k('Shift'), ' / ', k('B')]), el('dd', {}, ['Boost (uses the meter)']), el('dt', {}, [k('R')]), el('dd', {}, ['Respawn on the track']),
        el('dt', {}, [k('P'), ' / ', k('Esc')]), el('dd', {}, ['Pause']), el('dt', {}, [k('Shift'), '+', k('T')]), el('dd', {}, ['Restart race']),
      ]),
    el('div', { class: 'stack hint' }, [
      el('div', {}, ['Hold drift through a corner to charge a mini-turbo: blue, orange, then purple. Release to blast out of the turn.']),
      el('div', {}, ['Boost pads give a free burst. Cones are harmless; barrels and barriers slow you down.']),
      el('div', {}, ['Coins come from finishing high, drifting and clean laps. Spend them in the Garage; cosmetics never change handling.']),
    ]),
    el('button', { class: 'btn small block', onclick: close }, ['Got it']),
  ]);
}

export function pauseDialog(a: { resume(): void; restart(): void; settings(): void; quit(): void }): HTMLElement {
  return el('div', { class: 'dialog panel' }, [
    el('h2', { class: 'title' }, ['Paused']),
    el('div', { class: 'stack' }, [
      el('button', { class: 'btn block', onclick: a.resume }, [icon('play'), 'Resume']),
      el('button', { class: 'btn ghost block', onclick: a.restart }, [icon('restart'), 'Restart race']),
      el('button', { class: 'btn ghost block', onclick: a.settings }, [icon('sliders'), 'Settings']),
      el('button', { class: 'btn ghost block', onclick: a.quit }, [icon('home'), 'Quit to menu']),
    ]),
  ]);
}
