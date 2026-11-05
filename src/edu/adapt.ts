import type { EduSave } from './state';
import { LEARNING_DIFFICULTIES, type LearningDifficulty } from './types';

/**
 * Adaptive difficulty. The learning difficulty is always the player's choice, so this only ever makes a suggestion, from the last
 * three reports at the current difficulty: three strong results in a row suggest stepping up, repeated struggles suggest stepping
 * down. Dismissing a suggestion silences it until three newer reports exist.
 */
export interface Suggestion { dir: 'up' | 'down'; to: LearningDifficulty; reason: string }
const STREAK = 3;

export function suggestDifficulty(e: EduSave): Suggestion | null {
  const recent = e.reports.filter(r => r.diff === e.difficulty && r.n > e.suggestSkip).slice(-STREAK);
  if (recent.length < STREAK) return null;
  const i = LEARNING_DIFFICULTIES.indexOf(e.difficulty);
  const strong = recent.every(r => r.passed && r.stars >= 2 && r.total > 0 && r.correct / r.total >= 0.85);
  if (strong && i < LEARNING_DIFFICULTIES.length - 1) return { dir: 'up', to: LEARNING_DIFFICULTIES[i + 1], reason: 'Your last three results were strong. Ready for more of a challenge?' };
  const weak = recent.filter(r => !r.passed || (r.total > 0 && r.correct / r.total < 0.5)).length;
  if (weak >= 2 && i > 0) return { dir: 'down', to: LEARNING_DIFFICULTIES[i - 1], reason: 'The last few missions were tough. A gentler level may help the ideas click, and your progress is kept either way.' };
  return null;
}
/** Records that the player has seen the suggestion (accepted or not), so the next one needs fresh evidence. */
export function dismissSuggestion(e: EduSave): EduSave { const o = JSON.parse(JSON.stringify(e)) as EduSave; o.suggestSkip = o.stats.counter; return o; }
