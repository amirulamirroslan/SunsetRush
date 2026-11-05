import { choiceQuestion, fmt, numericQuestion } from '../assessment';
import { metric } from '../objectives';
import type { ConceptId, DriveResult, LearningDifficulty, Question } from '../types';

/** Small helpers shared by the mission files so each question stays a one-liner. */
export const G = 9.8;
export const KMH = 3.6;
export const D1: Record<LearningDifficulty, string> = { easy: 'e', medium: 'm', hard: 'h' };
export const r1 = (n: number): number => Math.round(n * 10) / 10;
export const r2 = (n: number): number => Math.round(n * 100) / 100;
export const m = metric;

export interface QCtx { mission: string; diff: LearningDifficulty; concept: ConceptId }
export type Kind = 'apply' | 'practice';

/** Builds the question factories for one mission/difficulty so ids and scenario ids stay consistent. */
export function factory(c: QCtx, kind: Kind) {
  let n = 0;
  const base = (): { id: string; scenarioId: string; concept: ConceptId } => ({ id: `${c.mission}.${D1[c.diff]}.${kind === 'apply' ? 'a' : 'p'}${++n}`, scenarioId: `${c.mission}.${kind}`, concept: c.concept });
  return {
    choice: (o: { stem: string; right: string; wrong: string[]; explanation: string; hint?: string; formula?: string }): Question => choiceQuestion({ ...base(), ...o }),
    num: (o: { stem: string; answer: number; unit?: string; explanation: string; hint?: string; formula?: string; rel?: number; floor?: number }): Question => numericQuestion({ ...base(), ...o }),
  };
}

export type ApplyBuilder = (r: DriveResult) => Question[];
export { fmt };
