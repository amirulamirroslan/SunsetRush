import { el, html, clear } from './dom';
import { icon } from './icons';
import { formatTime, ordinal } from '../sim/rewards';
import type { Track } from '../sim/Track';
import type { TouchState } from '../input/Controls';

export interface HudData {
  kmh: number; place: number; total: number; lap: number; laps: number; time: number; bestLap: number | null;
  boost: number; boosting: boolean; driftTier: number; drifting: boolean; wrongWay: boolean; stuck: boolean;
}
export interface MapDot { x: number; z: number; color: string; player: boolean }

const ARC = 'M 12 92 A 52 52 0 1 1 108 92';

/** In-race overlay: position, laps, timer, minimap, speed gauge, boost meter, drift pips, toasts, countdown and touch controls. */
export class Hud {
  readonly root = el('div', { id: 'hud', 'aria-live': 'off' });
  readonly touchRoot = el('div', { class: 'touch' });
  private readonly posNum = el('b'); private readonly posOf = el('span'); private readonly posSuffix = el('small');
  private readonly lap = el('div', { class: 'lapbox' });
  private readonly timer = el('div', { class: 'timer' }); private readonly best = el('div', { class: 'best' });
  private readonly map = el('canvas', { id: 'minimap' });
  private readonly speedNum = el('b'); private readonly gaugeFill: SVGElement;
  private readonly boostFill = el('div', { class: 'fill' }); private readonly boostBar = el('div', { class: 'boostbar' });
  private readonly pips = el('div', { class: 'driftpips' }, [el('i'), el('i'), el('i')]);
  private readonly center = el('div', { class: 'center-msg' });
  private readonly toastHost = el('div');
  private readonly wrong = el('div', { class: 'wrongway' }, [icon('warn'), 'Wrong way']);
  private readonly stuck = el('div', { class: 'stuckhint' }, ['Stuck? Press ', el('kbd', {}, ['R']), ' or tap Respawn']);
  readonly keyhint = el('div', { class: 'keyhint' });
  private readonly cache: Record<string, string | number | boolean> = {};
  private mapStatic: HTMLCanvasElement | null = null; private mapW = 0; private mapH = 0;
  private bounds = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };
  private track: Track | null = null;
  readonly pauseBtn: HTMLButtonElement;
  readonly respawnBtn: HTMLButtonElement;

  constructor(private readonly touch: TouchState, onPause: () => void, onRespawn: () => void) {
    this.pauseBtn = el('button', { class: 'iconbtn', 'aria-label': 'Pause', onclick: onPause }, [icon('pause')]);
    this.respawnBtn = el('button', { class: 'iconbtn', 'aria-label': 'Respawn on track', onclick: onRespawn }, [icon('reset')]);
    const arcBg = html(`<svg viewBox="0 0 120 110" aria-hidden="true"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#35d0ff"/><stop offset="0.55" stop-color="#ffc23a"/><stop offset="1" stop-color="#ff3f8a"/></linearGradient></defs>
      <path d="${ARC}" fill="none" stroke="rgba(12,8,32,.7)" stroke-width="13" stroke-linecap="round" pathLength="100"/>
      <path d="${ARC}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="9" stroke-linecap="round" pathLength="100"/>
      <path class="gf" d="${ARC}" fill="none" stroke="url(#gg)" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>
      <path d="M 12 92 A 52 52 0 1 1 108 92" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="4" pathLength="100" stroke-dasharray="0.7 9.3" stroke-dashoffset="0.35" transform="scale(0.86) translate(9.7 14)" opacity=".7"/></svg>`);
    this.gaugeFill = arcBg.querySelector('.gf') as SVGElement;
    const gauge = el('div', { class: 'gauge' }, [arcBg, el('div', { class: 'num' }, [this.speedNum, el('span', {}, ['KM/H'])]),
      el('div', { class: 'boostbar' }, [])]);
    this.boostBar.append(icon('bolt'), el('div', { class: 'track' }, [this.boostFill]));
    gauge.replaceChild(this.boostBar, gauge.lastChild as Node);
    this.root.append(
      el('div', { class: 'hud-tl' }, [el('div', { class: 'pos' }, [this.posNum, this.posSuffix, this.posOf]), this.lap]),
      el('div', { class: 'hud-tc' }, [this.timer, this.best]),
      el('div', { class: 'hud-tr' }, [this.map, el('div', { style: 'display:grid;gap:8px' }, [this.pauseBtn, this.respawnBtn])]),
      gauge, this.pips, this.center, this.toastHost, this.wrong, this.stuck, this.keyhint, this.touchRoot,
      el('div', { class: 'rotate-hint' }, [el('div', {}, [icon('rotate'), 'Landscape gives you a wider view'])]),
    );
    this.buildKeyHint();
    this.buildTouch();
  }

  private buildKeyHint(): void {
    const k = (t: string): HTMLElement => el('kbd', {}, [t]);
    this.keyhint.append(el('span', {}, [k('W'), k('A'), k('S'), k('D'), ' drive']), el('span', {}, [k('Space'), ' drift']), el('span', {}, [k('Shift'), ' boost']), el('span', {}, [k('P'), ' pause']));
  }

  private buildTouch(): void {
    const t = this.touch;
    const knob = el('div', { class: 'knob' });
    const pad = el('div', { class: 'pad' }, [icon('chevL'), icon('chevR'), knob]);
    const zone = el('div', { class: 'steer' }, [pad]);
    let active = -1;
    const setSteer = (cx: number): void => {
      const r = pad.getBoundingClientRect(); const half = r.width / 2 - 28;
      const v = Math.max(-1, Math.min(1, (cx - (r.left + r.width / 2)) / half));
      t.steer = Math.abs(v) < 0.06 ? 0 : v; knob.style.transform = `translateX(${v * half}px)`;
    };
    zone.addEventListener('pointerdown', e => { active = e.pointerId; zone.setPointerCapture(e.pointerId); setSteer(e.clientX); e.preventDefault(); });
    zone.addEventListener('pointermove', e => { if (e.pointerId === active) setSteer(e.clientX); });
    const end = (e: PointerEvent): void => { if (e.pointerId !== active) return; active = -1; t.steer = 0; knob.style.transform = ''; };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    const btn = (cls: string, label: string, ic: string, key: 'gas' | 'brake' | 'drift' | 'boost'): HTMLElement => {
      const b = el('button', { class: `tbtn ${cls}`, 'aria-label': label }, [icon(ic), el('span', {}, [label])]);
      const set = (v: boolean): void => { t[key] = v; b.classList.toggle('on', v); };
      b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); set(true); e.preventDefault(); });
      for (const n of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) b.addEventListener(n, () => set(false));
      b.addEventListener('contextmenu', e => e.preventDefault());
      return b;
    };
    this.touchRoot.append(zone, el('div', { class: 'cluster' }, [btn('gas', 'Gas', 'gas', 'gas'), btn('brake', 'Brake', 'brake', 'brake'), btn('drift', 'Drift', 'drift', 'drift'), btn('boost', 'Boost', 'bolt', 'boost')]));
  }

  setTrack(track: Track): void {
    this.track = track;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < track.n; i++) { minX = Math.min(minX, track.x[i]); maxX = Math.max(maxX, track.x[i]); minZ = Math.min(minZ, track.z[i]); maxZ = Math.max(maxZ, track.z[i]); }
    this.bounds = { minX, maxX, minZ, maxZ }; this.mapStatic = null;
  }

  /** Draws a standalone track outline (used by the race-setup card). */
  static drawTrackCard(canvas: HTMLCanvasElement, track: Track): void {
    const dpr = Math.min(2, devicePixelRatio || 1), w = (canvas.width = 120 * dpr), h = (canvas.height = 84 * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const b = trackBounds(track); const pt = project(b, w, h, 10 * dpr);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; strokeLoop(ctx, track, pt, 'rgba(255,255,255,.95)', 5 * dpr); strokeLoop(ctx, track, pt, '#ff5a3c', 2.2 * dpr);
    const [sx, sy] = pt(track.x[0], track.z[0]); ctx.fillStyle = '#ffc23a'; ctx.beginPath(); ctx.arc(sx, sy, 3.5 * dpr, 0, 7); ctx.fill();
  }

  private ensureMap(): void {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(40, Math.round(this.map.clientWidth * dpr)), h = Math.max(40, Math.round(this.map.clientHeight * dpr));
    if (this.mapStatic && w === this.mapW && h === this.mapH) return;
    if (!this.track) return;
    this.mapW = this.map.width = w; this.mapH = this.map.height = h;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); if (!ctx) return;
    const pt = project(this.bounds, w, h, 9 * dpr);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    strokeLoop(ctx, this.track, pt, 'rgba(10,6,30,.7)', 6.5 * dpr); strokeLoop(ctx, this.track, pt, 'rgba(255,255,255,.92)', 3.6 * dpr);
    const [sx, sy] = pt(this.track.x[0], this.track.z[0]); ctx.fillStyle = '#ffc23a'; ctx.fillRect(sx - 2.5 * dpr, sy - 5 * dpr, 5 * dpr, 10 * dpr);
    this.mapStatic = c;
  }

  drawMap(dots: readonly MapDot[]): void {
    this.ensureMap(); if (!this.mapStatic) return;
    const ctx = this.map.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    ctx.clearRect(0, 0, this.mapW, this.mapH); ctx.drawImage(this.mapStatic, 0, 0);
    const pt = project(this.bounds, this.mapW, this.mapH, 9 * dpr);
    for (const d of [...dots].sort((a, b) => Number(a.player) - Number(b.player))) {
      const [x, y] = pt(d.x, d.z); ctx.beginPath(); ctx.arc(x, y, (d.player ? 4.6 : 3.4) * dpr, 0, 7);
      ctx.fillStyle = d.color; ctx.fill(); ctx.lineWidth = (d.player ? 2 : 1.2) * dpr; ctx.strokeStyle = d.player ? '#fff' : 'rgba(0,0,0,.6)'; ctx.stroke();
    }
  }

  private set(key: string, v: string | number | boolean, fn: () => void): void { if (this.cache[key] !== v) { this.cache[key] = v; fn(); } }

  update(d: HudData): void {
    const p = d.place;
    this.set('place', p, () => { this.posNum.textContent = String(p); this.posSuffix.textContent = ordinal(p).replace(/\d+/, ''); });
    this.set('of', d.total, () => { this.posOf.textContent = `/ ${d.total}`; });
    this.set('lap', `${d.lap}/${d.laps}`, () => { clear(this.lap); this.lap.append(el('em', {}, ['Lap']), el('b', {}, [`${d.lap}/${d.laps}`])); });
    const t = Math.max(0, d.time);
    this.set('time', Math.floor(t * 100), () => { this.timer.textContent = formatTime(t); });
    this.set('best', d.bestLap ?? -1, () => { this.best.textContent = d.bestLap ? `Best lap ${formatTime(d.bestLap)}` : ''; });
    const kmh = Math.round(Math.max(0, d.kmh));
    this.set('kmh', kmh, () => { this.speedNum.textContent = String(kmh); this.gaugeFill.setAttribute('stroke-dasharray', `${Math.min(100, (kmh / 290) * 100).toFixed(1)} 100`); });
    const b = Math.round(Math.min(1, Math.max(0, d.boost)) * 50);
    this.set('boost', b, () => { this.boostFill.style.width = `${b * 2}%`; });
    this.set('boosting', d.boosting, () => this.boostBar.classList.toggle('on', d.boosting));
    this.set('drift', d.drifting ? d.driftTier + 1 : 0, () => {
      this.pips.classList.toggle('on', d.drifting);
      Array.from(this.pips.children).forEach((c, i) => { c.className = d.drifting && d.driftTier >= i + 1 ? `l${i + 1}` : ''; });
    });
    this.set('wrong', d.wrongWay, () => this.wrong.classList.toggle('on', d.wrongWay));
    this.set('stuck', d.stuck, () => this.stuck.classList.toggle('on', d.stuck));
  }

  placeChanged(dir: 1 | -1): void { this.posNum.classList.remove('gain', 'loss'); void this.posNum.offsetWidth; this.posNum.classList.add(dir > 0 ? 'gain' : 'loss'); }

  showCount(text: string, go = false): void {
    clear(this.center); if (!text) return;
    this.center.append(el('div', { class: `count${go ? ' go' : ''}` }, [text]));
  }
  toast(text: string, kind: 'cyan' | 'gold' | 'warn' | 'good' = 'gold'): void {
    clear(this.toastHost); this.toastHost.append(el('div', { class: `toast ${kind}` }, [text]));
  }
  fadeKeyHint(): void { this.keyhint.style.opacity = '0'; }
  resetHint(): void { this.keyhint.style.opacity = '1'; clear(this.center); clear(this.toastHost); }
  setTouchUi(on: boolean): void { this.touchRoot.classList.toggle('on', on); }
}

function trackBounds(t: Track): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < t.n; i++) { minX = Math.min(minX, t.x[i]); maxX = Math.max(maxX, t.x[i]); minZ = Math.min(minZ, t.z[i]); maxZ = Math.max(maxZ, t.z[i]); }
  return { minX, maxX, minZ, maxZ };
}
function project(b: { minX: number; maxX: number; minZ: number; maxZ: number }, w: number, h: number, pad: number): (x: number, z: number) => [number, number] {
  const sx = (w - pad * 2) / (b.maxX - b.minX), sz = (h - pad * 2) / (b.maxZ - b.minZ), s = Math.min(sx, sz);
  const ox = (w - (b.maxX - b.minX) * s) / 2, oz = (h - (b.maxZ - b.minZ) * s) / 2;
  // x to the right, +z down the screen (matches the overhead view of the world with +z "south")
  return (x, z) => [ox + (x - b.minX) * s, oz + (z - b.minZ) * s];
}
function strokeLoop(ctx: CanvasRenderingContext2D, t: Track, pt: (x: number, z: number) => [number, number], style: string, width: number): void {
  ctx.beginPath();
  for (let i = 0; i <= t.n; i += 3) { const k = i % t.n; const [x, y] = pt(t.x[k], t.z[k]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath(); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke();
}
