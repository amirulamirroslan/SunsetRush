import { Rng } from '../sim/rng';
import { diagnoseNumeric } from './diagnose';
import type { Answer, Grade, Question } from './types';

/** Stable 32-bit hash so shuffles and scenario numbers are deterministic (no runtime randomness anywhere in the curriculum). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Rounds to `d` decimals and drops trailing zeros: fmt(2.50) = "2.5", fmt(3) = "3". */
export const fmt = (n: number, d = 1): string => String(Math.round(n * 10 ** d) / 10 ** d);

/** A multiple-choice question whose option order is a fixed function of its id. */
export function choiceQuestion(q: Omit<Question, 'kind' | 'options' | 'correct' | 'whyOption'> & { right: string; wrong: string[]; /** tempting-wrong-answer notes, keyed by the exact wrong option text */ why?: Record<string, string> }): Question {
  const rng = new Rng(hash(q.id));
  const all = [q.right, ...Array.from(new Set(q.wrong.filter(w => w !== q.right)))];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  const { right, wrong, why, ...rest } = q; void wrong;
  const out: Question = { ...rest, kind: 'choice', options: all, correct: all.indexOf(right) };
  if (why) out.whyOption = all.map(o => (o === right ? null : why[o] ?? null));
  return out;
}

/** A numeric question; the tolerance is relative (default 1.5%) with an absolute floor. */
export function numericQuestion(q: Omit<Question, 'kind' | 'tolerance'> & { answer: number; rel?: number; floor?: number }): Question {
  const { rel = 0.015, floor = 0.05, ...rest } = q;
  return { ...rest, kind: 'numeric', tolerance: Math.max(floor, Math.abs(q.answer) * rel) };
}

export function gradeAnswer(q: Question, a: Answer): Grade {
  if (q.kind === 'choice') {
    if (!('choice' in a)) return { correct: false, message: 'Pick one of the answers.' };
    if (a.choice === q.correct) return { correct: true, message: 'Correct.' };
    const tip = q.whyOption?.[a.choice];
    return tip ? { correct: false, message: 'Not quite.', tip } : { correct: false, message: 'Not quite.' };
  }
  if (!('value' in a) || !Number.isFinite(a.value)) return { correct: false, message: 'Type a number.' };
  const err = Math.abs(a.value - (q.answer ?? NaN));
  if (err <= (q.tolerance ?? 0)) return { correct: true, message: 'Correct.' };
  if (err <= Math.max(Math.abs(q.answer ?? 0) * 0.15, (q.tolerance ?? 0) * 4)) return { correct: false, message: 'Close. Check your rounding and units.' };
  const tip = diagnoseNumeric(q, a.value);
  return tip ? { correct: false, message: 'Not quite.', tip } : { correct: false, message: 'Not quite.' };
}

/** What the player did with one question; this is the evidence the mastery system consumes. */
export interface QuestionOutcome { id: string; scenarioId: string; concept: Question['concept']; correct: boolean; attempts: number; hintUsed: boolean; transfer: boolean }
