import type { LearningDifficulty } from './types';

/**
 * Learning-difficulty profiles. They change the educational experience (how guided it is, how many tries a question gets,
 * what the objectives demand) and never the rival AI or the physics.
 */
export interface DifficultyProfile {
  id: LearningDifficulty;
  label: string;
  blurb: string;
  /** tries allowed per question before the answer is revealed */
  attempts: number;
  /** is the formula shown up-front (otherwise only with a hint) */
  showFormula: boolean;
  /** a hint can be asked for (always true; the penalty differs) */
  hintCostsStar: boolean;
  /** fraction of apply questions that must be right for the mission to count */
  passRatio: number;
  coinBase: number;
  /** guided experiments show the goal helper text */
  guidedLab: boolean;
}

export const PROFILES: Record<LearningDifficulty, DifficultyProfile> = {
  easy: { id: 'easy', label: 'Easy', blurb: 'Foundation level: visual explanations, guided experiments, three tries and free hints.', attempts: 3, showFormula: true, hintCostsStar: false, passRatio: 0.66, coinBase: 40, guidedLab: true },
  medium: { id: 'medium', label: 'Medium', blurb: 'Applied level: calculations and independent decisions, two tries, hints on request.', attempts: 2, showFormula: false, hintCostsStar: true, passRatio: 0.66, coinBase: 60, guidedLab: true },
  hard: { id: 'hard', label: 'Hard', blurb: 'Advanced level: multi-step reasoning and technical detail, one try, hints cost a star.', attempts: 1, showFormula: false, hintCostsStar: true, passRatio: 0.66, coinBase: 90, guidedLab: false },
};

export const profileFor = (d: LearningDifficulty): DifficultyProfile => PROFILES[d];
