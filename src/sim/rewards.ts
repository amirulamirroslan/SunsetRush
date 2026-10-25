/** Race rewards: deterministic, itemised and easy to understand. No randomness, no purchasable currency. */
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
/** Extra reward percentage per difficulty. */
export const DIFFICULTY_BONUS: Record<Difficulty, number> = { easy: 0, normal: 0.2, hard: 0.5 };
export const POSITION_REWARD = [250, 170, 120, 80, 50, 30] as const;
export const COINS_PER_LAP = 25;

export interface RewardLine { id: string; label: string; amount: number }
export interface RewardBreakdown { lines: RewardLine[]; total: number }
export interface RewardInput {
  /** 1-based finishing place */ place: number;
  laps: number;
  difficulty: Difficulty;
  driftSeconds: number;
  wallHits: number;
  fastestLapOfRace: boolean;
}

export function computeRewards(r: RewardInput): RewardBreakdown {
  const lines: RewardLine[] = [];
  lines.push({ id: 'laps', label: `Race completed · ${r.laps} laps`, amount: COINS_PER_LAP * r.laps });
  lines.push({ id: 'place', label: `Finished ${ordinal(r.place)}`, amount: POSITION_REWARD[Math.min(POSITION_REWARD.length, Math.max(1, r.place)) - 1] });
  const drift = Math.min(40, Math.floor(r.driftSeconds)) * 3;
  if (drift > 0) lines.push({ id: 'drift', label: 'Drift bonus', amount: drift });
  if (r.wallHits === 0) lines.push({ id: 'clean', label: 'Clean racing', amount: 60 });
  else if (r.wallHits <= 2) lines.push({ id: 'clean', label: 'Tidy racing', amount: 25 });
  if (r.fastestLapOfRace) lines.push({ id: 'fastest', label: 'Fastest lap of the race', amount: 50 });
  const sub = lines.reduce((a, l) => a + l.amount, 0);
  const bonus = Math.round(sub * DIFFICULTY_BONUS[r.difficulty]);
  if (bonus > 0) lines.push({ id: 'difficulty', label: `${r.difficulty === 'hard' ? 'Hard' : 'Normal'} difficulty +${Math.round(DIFFICULTY_BONUS[r.difficulty] * 100)}%`, amount: bonus });
  return { lines, total: sub + bonus };
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10] ?? 'th'}`;
}

/** m:ss.cc */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--.--';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
