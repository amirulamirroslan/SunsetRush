import type { QuestionOutcome } from './assessment';
import { CONCEPTS } from './content';
import { reviewQuestion } from './content/review';
import type { EduSave } from './state';
import { MASTERY_ORDER, type ConceptId, type LearningDifficulty, type Question } from './types';

/**
 * Spaced review ("Refresh"). Mastery never goes down, but remembering does fade, so every concept the player has applied is put on
 * a schedule: it comes back after 1, 3, 7, 14 and then 30 days as each refresh is answered correctly, and falls back to a short gap
 * after a miss. Everything here is pure: the caller passes the current time, so tests need no clock.
 */
export const DAY = 86_400_000;
export const INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export const REVIEW_SIZE = 4;
/** Coins for a due concept answered right (half if a hint was used). Concepts that are not due pay nothing, so it cannot be farmed. */
export const REVIEW_COINS = 10;

const clone = (e: EduSave): EduSave => JSON.parse(JSON.stringify(e)) as EduSave;
const applied = (e: EduSave, c: ConceptId): boolean => MASTERY_ORDER.indexOf(e.concepts[c].level) >= MASTERY_ORDER.indexOf('applied');

/** Puts any newly applied concept on the schedule (in place). Called by the engine right after mastery changes. */
export function scheduleReady(e: EduSave, concepts: readonly ConceptId[], now: number): void {
  for (const c of concepts) { const s = e.concepts[c]; if (s.box === 0 && applied(e, c)) { s.box = 1; s.due = now + INTERVAL_DAYS[0] * DAY; } }
}

/** Scheduled concepts, soonest due first. */
export function reviewPool(e: EduSave): ConceptId[] {
  return CONCEPTS.map(c => c.id).filter(id => e.concepts[id].box >= 1).sort((a, b) => e.concepts[a].due - e.concepts[b].due);
}
export interface ReviewStatus { scheduled: number; due: number; nextDue: number | null }
export function reviewStatus(e: EduSave, now: number): ReviewStatus {
  const pool = reviewPool(e), due = pool.filter(id => e.concepts[id].due <= now).length;
  const later = pool.map(id => e.concepts[id].due).filter(d => d > now);
  return { scheduled: pool.length, due, nextDue: later.length ? Math.min(...later) : null };
}

export interface ReviewSet { concepts: ConceptId[]; questions: Question[] }
/** A refresh set: due concepts first, topped up with the soonest-due others so there is always something to practise. */
export function buildReview(e: EduSave, diff: LearningDifficulty, now: number, size = REVIEW_SIZE): ReviewSet {
  const pool = reviewPool(e), due = pool.filter(id => e.concepts[id].due <= now), rest = pool.filter(id => !due.includes(id));
  const concepts = [...due, ...rest].slice(0, size);
  return { concepts, questions: concepts.map(c => reviewQuestion(c, diff, e.concepts[c].tried + e.stats.reviews * 7 + e.concepts[c].box)) };
}

export interface ReviewResult { concept: ConceptId; correct: boolean; wasDue: boolean; box: number; nextDue: number }
export interface ReviewDone { edu: EduSave; coins: number; results: ReviewResult[] }
export function finishReview(e: EduSave, outcomes: QuestionOutcome[], now: number): ReviewDone {
  const o = clone(e); let coins = 0; const results: ReviewResult[] = [];
  for (const out of outcomes) {
    const s = o.concepts[out.concept]; if (!s || s.box < 1) continue;
    const wasDue = s.due <= now;
    o.stats.answered++; if (out.correct) o.stats.correct++; if (out.hintUsed) o.stats.hints++;
    s.tried++; if (out.correct) s.right++;
    if (out.correct && wasDue) { s.box = Math.min(5, s.box + 1); s.due = now + INTERVAL_DAYS[s.box - 1] * DAY; coins += out.hintUsed ? REVIEW_COINS / 2 : REVIEW_COINS; }
    else if (!out.correct) { s.box = wasDue ? 1 : Math.max(1, s.box - 1); s.due = Math.min(wasDue ? Infinity : s.due, now + INTERVAL_DAYS[0] * DAY); }
    results.push({ concept: out.concept, correct: out.correct, wasDue, box: s.box, nextDue: s.due });
  }
  o.stats.reviews++; o.stats.coinsEarned += coins;
  return { edu: o, coins, results };
}

/** "in 3 days", "in 5 hours" or "any moment now": a plain-language gap for the hub and the refresh summary. */
export function gapLabel(ms: number): string {
  if (ms <= 3_600_000) return 'any moment now';
  if (ms < DAY) { const h = Math.round(ms / 3_600_000); return `in ${h} hour${h === 1 ? '' : 's'}`; }
  const d = Math.round(ms / DAY); return `in ${d} day${d === 1 ? '' : 's'}`;
}
