import type { Question } from './types';

/**
 * Names the most likely mistake behind a wrong numeric answer, by checking whether the answer is the right one times a classic
 * slip factor (a forgotten unit conversion, a missing square, a missing one half, a flipped fraction ...). Pure and deterministic;
 * it only ever returns a short tip, never the answer itself.
 */
export function diagnoseNumeric(q: Question, value: number): string | null {
  const a = q.answer;
  if (a === undefined || !Number.isFinite(a) || !Number.isFinite(value) || a === 0 || value === 0) return null;
  const text = `${q.stem} ${q.unit ?? ''}`.toLowerCase();
  // a slip makes the answer land almost exactly on the slipped value, so the window is narrow; wide windows would blame a random guess
  const near = (x: number): boolean => Number.isFinite(x) && Math.abs(value - x) <= Math.max(Math.abs(x) * 0.04, (q.tolerance ?? 0) * 2, 0.02);
  const speedUnits = /km\/h|m\/s/.test(text), percent = /%|percent/.test(text), prefix = /\b(kj|kw|kg|km|joule|newton|j\b|n\b|w\b)/.test(text);
  if (speedUnits && near(a / 3.6)) return 'Check the speed units: it looks like you divided by 3.6 where you needed to multiply (km/h = m/s × 3.6).';
  if (speedUnits && near(a * 3.6)) return 'Check the speed units: it looks like you multiplied by 3.6 where you needed to divide (m/s = km/h ÷ 3.6).';
  if (percent && near(a / 100)) return 'It looks like you stopped at a fraction: multiply by 100 to turn it into a percentage.';
  if (percent && near(a * 100)) return 'It looks like you multiplied by 100 twice: the value was already a percentage.';
  if (prefix && near(a * 1000)) return 'Check the size of the unit: your answer is 1,000 times bigger than the right one (kilo means thousand).';
  if (prefix && near(a / 1000)) return 'Check the size of the unit: your answer is 1,000 times smaller than the right one (kilo means thousand).';
  if (near(1 / a) && Math.abs(a - 1 / a) > 0.2 * Math.abs(a)) return 'It looks like the division is the wrong way round. Which quantity goes on top?';
  if (near(a * 2)) return 'Your answer is double the right one. Does the formula have a ½ in it?';
  if (near(a / 2)) return 'Your answer is half of the right one. Did you leave out a factor of 2?';
  if (a > 1.5 && near(Math.sqrt(a))) return 'It looks like you took a square root where the formula uses a square (or the reverse). Check which quantity is squared.';
  if (a > 1.5 && a < 30 && near(a * a)) return 'It looks like you squared something that is not squared in this formula.';
  if (near(a * 4)) return 'Your answer is four times the right one. Check whether you squared something that should not be squared.';
  if (near(a / 4)) return 'Your answer is a quarter of the right one. Is a quantity squared in the formula?';
  return null;
}
