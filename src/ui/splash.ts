import './splash.css';
import { canDismiss, ctaText, progressPercent, shouldSkipSplash, starField, type SplashPhase } from './splashLogic';

export interface Splash {
  /** Loading progress 0..1 with an optional label (the same numbers the plain loading screen gets). */
  progress(p: number, text?: string): void;
  /** Loading has finished: after the intro has played the splash asks the player to start. */
  ready(): void;
  /** Removes the splash immediately (used for fatal errors). */
  remove(): void;
}

/** Everything is static markup written here (no user data), so innerHTML is safe. */
const CAR_SVG = `
<svg class="sp-car" viewBox="0 0 400 190" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="spBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a52"/><stop offset=".45" stop-color="#e2461f"/><stop offset="1" stop-color="#6e1424"/></linearGradient>
    <linearGradient id="spGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2552"/><stop offset="1" stop-color="#150d2b"/></linearGradient>
    <linearGradient id="spLed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff2f5a"/><stop offset=".5" stop-color="#ff6a4a"/><stop offset="1" stop-color="#ff2f5a"/></linearGradient>
    <linearGradient id="spRim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd08a" stop-opacity="0"/><stop offset=".5" stop-color="#ffe2b0"/><stop offset="1" stop-color="#ffd08a" stop-opacity="0"/></linearGradient>
  </defs>
  <ellipse cx="200" cy="177" rx="176" ry="9" fill="rgba(8,3,22,.6)"/>
  <rect x="38" y="116" width="48" height="58" rx="11" fill="#0a0712"/>
  <rect x="314" y="116" width="48" height="58" rx="11" fill="#0a0712"/>
  <path d="M104 102 C112 68 140 48 174 44 L226 44 C260 48 288 68 296 102 Z" fill="url(#spBody)"/>
  <path d="M118 96 C125 70 148 56 177 52 L223 52 C252 56 275 70 282 96 Z" fill="url(#spGlass)"/>
  <path d="M34 130 C34 112 62 104 94 101 L306 101 C338 104 366 112 366 130 L366 160 C366 168 358 173 350 173 L50 173 C42 173 34 168 34 160 Z" fill="url(#spBody)"/>
  <path d="M96 101 C128 97 272 97 304 101" fill="none" stroke="url(#spRim)" stroke-width="2.2" stroke-linecap="round"/>
  <rect x="54" y="108" width="292" height="21" rx="9" fill="#12070f"/>
  <rect class="sp-led" x="62" y="114" width="276" height="8" rx="4" fill="url(#spLed)"/>
  <rect x="170" y="131" width="60" height="17" rx="3" fill="#f3e8d6" opacity=".92"/>
  <rect x="92" y="148" width="216" height="22" rx="4" fill="#0d0a14"/>
  <path d="M120 150 V168 M150 150 V168 M180 150 V168 M220 150 V168 M250 150 V168 M280 150 V168" stroke="#2a2438" stroke-width="3"/>
  <circle cx="142" cy="158" r="9" fill="#06040a" stroke="#d3d7e4" stroke-width="3"/>
  <circle cx="258" cy="158" r="9" fill="#06040a" stroke="#d3d7e4" stroke-width="3"/>
</svg>`;

const MOUNTAINS = `
<svg class="sp-mtn sp-mtn-far" viewBox="0 0 1600 260" preserveAspectRatio="none" aria-hidden="true"><path d="M0 260 V170 L110 120 L190 168 L300 84 L420 172 L540 110 L650 176 L780 70 L900 168 L1020 104 L1150 180 L1270 96 L1400 170 L1500 124 L1600 172 V260 Z" fill="#4b1f6f"/></svg>
<svg class="sp-mtn sp-mtn-near" viewBox="0 0 1600 260" preserveAspectRatio="none" aria-hidden="true"><path d="M0 260 V190 L140 150 L260 196 L400 138 L520 200 L690 128 L820 200 L960 150 L1100 204 L1240 140 L1380 198 L1500 160 L1600 196 V260 Z" fill="#2b1252"/></svg>`;

export function createSplash(): Splash | null {
  if (typeof document === 'undefined') return null;
  if (shouldSkipSplash(location.search, !!(navigator as Navigator & { webdriver?: boolean }).webdriver)) return null;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  const root = document.createElement('div');
  root.id = 'splash'; root.className = 'splash';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Sunset Rush');
  root.innerHTML = `
    <div class="sp-sky"></div>
    <div class="sp-stars" aria-hidden="true"></div>
    <div class="sp-sun" aria-hidden="true"></div>
    <div class="sp-haze" aria-hidden="true"></div>
    <div class="sp-mtns" aria-hidden="true">${MOUNTAINS}</div>
    <div class="sp-ground" aria-hidden="true"><div class="sp-plane"><div class="sp-tile"><i class="r-asph"></i><i class="r-kl"></i><i class="r-kr"></i><i class="r-dash"></i><i class="r-el"></i><i class="r-er"></i></div></div><div class="sp-fog"></div></div>
    <div class="sp-carwrap">${CAR_SVG}</div>
    <div class="sp-vignette" aria-hidden="true"></div>
    <header class="sp-head">
      <h1 class="logo title sp-logo">Sunset Rush</h1>
      <p class="sp-sub">Coral Cove Circuit</p>
      <p class="sp-tag">Drift. Boost. Chase the sunset.</p>
    </header>
    <div class="sp-foot">
      <div class="sp-load" role="status" aria-live="polite"><div class="bar"><i></i></div><div class="sp-loadlabel">Loading</div></div>
      <button type="button" class="btn sp-cta" tabindex="-1">${ctaText(coarse)}</button>
      <div class="sp-note">Sound on for the full ride</div>
    </div>`;

  const stars = root.querySelector('.sp-stars') as HTMLElement;
  for (const s of starField(46)) {
    const i = document.createElement('i');
    i.style.cssText = `left:${s.x.toFixed(2)}%;top:${s.y.toFixed(2)}%;width:${s.size.toFixed(2)}px;height:${s.size.toFixed(2)}px;animation-delay:${s.delay.toFixed(2)}s;animation-duration:${s.dur.toFixed(2)}s`;
    stars.appendChild(i);
  }
  const bar = root.querySelector('.bar > i') as HTMLElement, label = root.querySelector('.sp-loadlabel') as HTMLElement, cta = root.querySelector('.sp-cta') as HTMLButtonElement;
  document.body.appendChild(root);

  const born = performance.now(), MIN_INTRO_MS = 1500;
  let phase: SplashPhase = 'loading', loaded = false, readyAt = 0, timer = 0, gone = false;

  const finish = (): void => { if (gone) return; gone = true; clearTimeout(timer); removeEventListener('keydown', onKey, true); root.removeEventListener('pointerdown', onPointer); root.remove(); };
  const leave = (): void => {
    if (phase === 'leaving') return; phase = 'leaving';
    removeEventListener('keydown', onKey, true); root.removeEventListener('pointerdown', onPointer);
    root.classList.add('sp-leave'); timer = window.setTimeout(finish, 750);
  };
  const tryDismiss = (): void => { if (canDismiss(phase, performance.now() - readyAt, 350)) leave(); };
  const IGNORED = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'NumLock', 'ScrollLock', 'F5', 'F11', 'F12']);
  // The game's own "first key / first tap unlocks audio" listeners live on window, so nothing here stops propagation.
  const onKey = (e: KeyboardEvent): void => { if (IGNORED.has(e.key) || e.ctrlKey || e.metaKey || e.altKey) return; if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); tryDismiss(); };
  const onPointer = (): void => tryDismiss();
  addEventListener('keydown', onKey, true); root.addEventListener('pointerdown', onPointer);

  const goReady = (): void => {
    if (gone || phase !== 'loading') return;
    phase = 'ready'; readyAt = performance.now(); root.classList.add('is-ready');
    cta.tabIndex = 0; cta.focus({ preventScroll: true });
    label.textContent = 'Ready';
  };

  return {
    progress(p, text) { if (gone) return; bar.style.width = `${progressPercent(p)}%`; if (text) label.textContent = text; },
    ready() {
      if (gone) return; loaded = true; bar.style.width = '100%';
      const wait = Math.max(0, MIN_INTRO_MS - (performance.now() - born));
      window.setTimeout(() => { if (loaded) goReady(); }, wait);
    },
    remove() { finish(); },
  };
}
