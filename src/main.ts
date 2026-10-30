import './ui/styles.css';
import { Game } from './app/Game';
import { createSplash } from './ui/splash';

const host = document.getElementById('app') as HTMLElement;
const bar = document.querySelector('#loading .bar > i') as HTMLElement | null;
const label = document.querySelector('#loading .loadlabel') as HTMLElement | null;
/** Start splash (skipped for ?nosplash, ?debug and automated browsers); it also shows the loading progress. */
const splash = createSplash();

function fatal(message: string): void {
  splash?.remove();
  const f = document.getElementById('fatal'); if (!f) return;
  const p = f.querySelector('p'); if (p) p.textContent = message;
  f.style.display = 'grid'; document.getElementById('loading')?.remove();
}

function webglOk(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (!webglOk()) fatal('This browser or device does not support WebGL, which Sunset Rush needs to draw the game. Try an up-to-date Chrome, Safari, Firefox or Edge.');
else {
  // the start-gantry banners are drawn to canvas once, so the display face must be ready first (capped wait)
  Promise.race([Promise.all([document.fonts.load('italic 800 40px "Barlow Condensed"'), document.fonts.load('700 20px "Barlow Condensed"')]), new Promise(r => setTimeout(r, 1500))]).catch(() => undefined)
    .then(() => Game.create(host, (p, text) => { if (bar) bar.style.width = `${Math.round(p * 100)}%`; if (label) label.textContent = text; splash?.progress(p, text); }))
    .then(() => { splash?.ready(); })
    .catch(err => { console.error(err); fatal('The game could not start. Please reload the page. If it keeps happening, try a different browser.'); });
}
addEventListener('error', e => { console.error(e.error ?? e.message); });
