/** Pure helpers for the start splash (no DOM, so they can be unit-tested). */

/**
 * The splash is a human-facing intro. It is skipped for automated browsers (the e2e / screenshot tools drive the menu
 * directly), for the `?debug` hooks and when `?nosplash` is in the URL.
 */
export function shouldSkipSplash(search: string, webdriver: boolean): boolean {
  if (webdriver) return true;
  const q = new URLSearchParams(search);
  return q.has('nosplash') || q.has('debug');
}

/** Call-to-action wording: touch screens have no "key". */
export function ctaText(coarsePointer: boolean): string {
  return coarsePointer ? 'Tap to start' : 'Press any key';
}

/** Splash phases: loading (progress bar) -> ready (call to action) -> leaving (fade out). */
export type SplashPhase = 'loading' | 'ready' | 'leaving';

/** The prompt may be dismissed only once loading has finished and the intro has played for `minMs`. */
export function canDismiss(phase: SplashPhase, elapsedMs: number, minMs = 900): boolean {
  return phase === 'ready' && elapsedMs >= minMs;
}

export interface Star { x: number; y: number; size: number; delay: number; dur: number; }

/** Deterministic star field in the upper sky (x in 0..100 %, y in 0..`maxY` %). */
export function starField(count: number, seed = 7, maxY = 52): Star[] {
  let s = seed >>> 0;
  const rnd = (): number => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    const y = rnd() * maxY;
    out.push({ x: rnd() * 100, y, size: 1 + rnd() * 1.8 * (1 - y / (maxY * 1.6)), delay: rnd() * 4, dur: 2 + rnd() * 3 });
  }
  return out;
}

/** Progress label that never goes backwards or past 100 %. */
export function progressPercent(p: number): number { return Math.round(Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0)) * 100); }
