import { MASTERY_ORDER, type MasteryLevel } from './types';

export interface ConceptState {
  level: MasteryLevel; /** scenario ids this concept has already been tested on */ seen: string[]; right: number; tried: number;
  /** spaced-review box: 0 = not scheduled yet, 1 to 5 = how many successful refreshes in a row (longer gaps in higher boxes) */
  box: number;
  /** when the next refresh is due (ms since epoch); 0 = not scheduled */
  due: number;
}
export const newConcept = (): ConceptState => ({ level: 'unseen', seen: [], right: 0, tried: 0, box: 0, due: 0 });

export type Evidence =
  | { kind: 'discover' } | { kind: 'understood' } | { kind: 'practised' } | { kind: 'applied' }
  | { kind: 'scenario'; scenarioId: string; correct: boolean }
  | { kind: 'transfer'; scenarioId: string; correct: boolean };

const idx = (l: MasteryLevel): number => MASTERY_ORDER.indexOf(l);
const TARGET: Record<'discover' | 'understood' | 'practised' | 'applied', MasteryLevel> = { discover: 'discovered', understood: 'learning', practised: 'practised', applied: 'applied' };

export interface MasteryChange { state: ConceptState; from: MasteryLevel; to: MasteryLevel }

/**
 * The mastery ladder: unseen > discovered > learning > practised > applied > mastered.
 * A step is only taken when the step before it is done, levels never go down, and `mastered` needs a correct answer in a
 * scenario this concept has never been tested on (so repeating a known question can never master anything).
 */
export function applyEvidence(state: ConceptState, ev: Evidence): MasteryChange {
  const s: ConceptState = { level: state.level, seen: [...state.seen], right: state.right, tried: state.tried, box: state.box, due: state.due };
  const from = s.level;
  if (ev.kind === 'scenario') {
    if (!s.seen.includes(ev.scenarioId)) s.seen.push(ev.scenarioId);
    s.tried++; if (ev.correct) s.right++;
  } else if (ev.kind === 'transfer') {
    const fresh = !s.seen.includes(ev.scenarioId);
    if (fresh) s.seen.push(ev.scenarioId);
    s.tried++; if (ev.correct) s.right++;
    if (fresh && ev.correct && idx(s.level) >= idx('applied')) s.level = 'mastered';
  } else {
    const target = TARGET[ev.kind];
    if (idx(s.level) === idx(target) - 1) s.level = target;
  }
  if (s.seen.length > 60) s.seen = s.seen.slice(-60);
  return { state: s, from, to: s.level };
}
