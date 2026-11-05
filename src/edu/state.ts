import { CHALLENGES, CONCEPTS, DISCOVERY_POINTS, LABS, MISSIONS } from './content';
import { newConcept, type ConceptState } from './mastery';
import { LEARNING_DIFFICULTIES, MASTERY_ORDER, type ConceptId, type LearningDifficulty, type MasteryLevel } from './types';

/** Version of the education block inside the save. Bump when its shape changes and add a step to `migrateEdu`. */
export const EDU_VERSION = 2;

export type PerDiff<T> = Record<LearningDifficulty, T>;
export interface MissionProgress { done: PerDiff<boolean>; stars: PerDiff<number>; attempts: number; driveFails: number }
export interface JournalEntry { n: number; kind: 'discovery' | 'mission' | 'lab' | 'challenge' | 'reflection'; ref: string; diff: LearningDifficulty; title: string; text: string }
export interface ReportConcept { concept: ConceptId; from: MasteryLevel; to: MasteryLevel }
export interface LearningReport {
  n: number; kind: 'mission' | 'challenge'; ref: string; title: string; diff: LearningDifficulty; passedDrive: boolean; passed: boolean;
  correct: number; total: number; stars: number; coins: number; concepts: ReportConcept[];
  strengths: string[]; review: { concept: ConceptId; stem: string; explanation: string }[];
  telemetry: { topSpeedKmh: number; hazardHits: number; driftSeconds: number; offRoadSeconds: number; durationSec: number };
  next: string;
}
export interface EduSave {
  version: number;
  difficulty: LearningDifficulty;
  onboarded: boolean;
  concepts: Record<ConceptId, ConceptState>;
  missions: Record<string, MissionProgress>;
  labs: Record<string, PerDiff<boolean>>;
  challenges: Record<string, { passed: PerDiff<boolean>; attempts: number }>;
  discoveries: string[];
  journal: JournalEntry[];
  reports: LearningReport[];
  stats: { answered: number; correct: number; hints: number; coinsEarned: number; counter: number; reviews: number };
  /** report counter value when the player last dismissed (or took) a difficulty suggestion; only newer reports count toward the next one */
  suggestSkip: number;
}

const pd = <T>(v: T): PerDiff<T> => ({ easy: v, medium: v, hard: v });

export function defaultEdu(): EduSave {
  const concepts = {} as Record<ConceptId, ConceptState>;
  for (const c of CONCEPTS) concepts[c.id] = newConcept();
  const missions: Record<string, MissionProgress> = {};
  for (const m of MISSIONS) missions[m.id] = { done: pd(false), stars: pd(0), attempts: 0, driveFails: 0 };
  const labs: Record<string, PerDiff<boolean>> = {};
  for (const l of LABS) labs[l.id] = pd(false);
  const challenges: EduSave['challenges'] = {};
  for (const c of CHALLENGES) challenges[c.id] = { passed: pd(false), attempts: 0 };
  return { version: EDU_VERSION, difficulty: 'easy', onboarded: false, concepts, missions, labs, challenges, discoveries: [], journal: [], reports: [], stats: { answered: 0, correct: 0, hints: 0, coinsEarned: 0, counter: 0, reviews: 0 }, suggestSkip: 0 };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number, fb: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(Math.min(hi, Math.max(lo, v))) : fb);
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const bool = (v: unknown, fb = false): boolean => (typeof v === 'boolean' ? v : fb);
const isDiff = (v: unknown): v is LearningDifficulty => LEARNING_DIFFICULTIES.includes(v as LearningDifficulty);
const isLevel = (v: unknown): v is MasteryLevel => MASTERY_ORDER.includes(v as MasteryLevel);
const perDiff = <T>(raw: unknown, f: (v: unknown) => T, fb: T): PerDiff<T> => { const o = isObj(raw) ? raw : {}; return { easy: f(o.easy) ?? fb, medium: f(o.medium) ?? fb, hard: f(o.hard) ?? fb }; };

/** Brings an older education block up to the current shape. v1 -> v2 adds the spaced-review schedule on each concept, `stats.reviews` and `suggestSkip`; the sanitiser fills those from defaults, so progress is kept as is. */
export function migrateEdu(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  let v = typeof raw.version === 'number' ? raw.version : 0;
  const out: Record<string, unknown> = { ...raw };
  // v0 -> v1: the block did not exist; sanitising from defaults is the whole migration.
  if (v < 1) v = 1;
  // v1 -> v2: new optional fields only; sanitizeEdu supplies their defaults.
  if (v < 2) v = 2;
  out.version = v;
  return out;
}

/** Turns anything into a valid education block. Never throws, never loses valid progress, drops unknown ids. */
export function sanitizeEdu(rawIn: unknown): EduSave {
  const out = defaultEdu();
  const raw = migrateEdu(rawIn);
  if (!isObj(raw)) return out;
  if (isDiff(raw.difficulty)) out.difficulty = raw.difficulty;
  out.onboarded = bool(raw.onboarded);
  const cs = isObj(raw.concepts) ? raw.concepts : {};
  for (const c of CONCEPTS) {
    const r = cs[c.id]; if (!isObj(r)) continue;
    out.concepts[c.id] = { level: isLevel(r.level) ? r.level : 'unseen', seen: Array.isArray(r.seen) ? r.seen.filter((x): x is string => typeof x === 'string').map(x => x.slice(0, 40)).slice(-60) : [], right: int(r.right, 0, 1e6, 0), tried: int(r.tried, 0, 1e6, 0), box: int(r.box, 0, 5, 0), due: int(r.due, 0, 1e14, 0) };
  }
  const ms = isObj(raw.missions) ? raw.missions : {};
  for (const m of MISSIONS) {
    const r = ms[m.id]; if (!isObj(r)) continue;
    out.missions[m.id] = { done: perDiff(r.done, v => (typeof v === 'boolean' ? v : undefined), false) as PerDiff<boolean>, stars: perDiff(r.stars, v => (typeof v === 'number' ? int(v, 0, 3, 0) : undefined), 0) as PerDiff<number>, attempts: int(r.attempts, 0, 1e6, 0), driveFails: int(r.driveFails, 0, 1e6, 0) };
  }
  const ls = isObj(raw.labs) ? raw.labs : {};
  for (const l of LABS) if (ls[l.id] !== undefined) out.labs[l.id] = perDiff(ls[l.id], v => (typeof v === 'boolean' ? v : undefined), false) as PerDiff<boolean>;
  const chs = isObj(raw.challenges) ? raw.challenges : {};
  for (const c of CHALLENGES) { const r = chs[c.id]; if (isObj(r)) out.challenges[c.id] = { passed: perDiff(r.passed, v => (typeof v === 'boolean' ? v : undefined), false) as PerDiff<boolean>, attempts: int(r.attempts, 0, 1e6, 0) }; }
  const valid = new Set(DISCOVERY_POINTS.map(d => d.id));
  out.discoveries = Array.isArray(raw.discoveries) ? Array.from(new Set(raw.discoveries.filter((x): x is string => typeof x === 'string' && valid.has(x)))) : [];
  const kinds = ['discovery', 'mission', 'lab', 'challenge', 'reflection'];
  out.journal = Array.isArray(raw.journal) ? raw.journal.filter(isObj).filter(j => kinds.includes(j.kind as string) && isDiff(j.diff)).slice(-120).map(j => ({ n: int(j.n, 0, 1e9, 0), kind: j.kind as JournalEntry['kind'], ref: str(j.ref, 40), diff: j.diff as LearningDifficulty, title: str(j.title, 80), text: str(j.text, 400) })) : [];
  out.reports = Array.isArray(raw.reports) ? raw.reports.filter(isObj).slice(-15).map(sanitizeReport).filter((r): r is LearningReport => r !== null) : [];
  if (isObj(raw.stats)) out.stats = { answered: int(raw.stats.answered, 0, 1e7, 0), correct: int(raw.stats.correct, 0, 1e7, 0), hints: int(raw.stats.hints, 0, 1e7, 0), coinsEarned: int(raw.stats.coinsEarned, 0, 1e9, 0), counter: int(raw.stats.counter, 0, 1e9, 0), reviews: int(raw.stats.reviews, 0, 1e7, 0) };
  out.suggestSkip = int(raw.suggestSkip, 0, 1e9, 0);
  out.stats.correct = Math.min(out.stats.correct, out.stats.answered);
  return out;
}

function sanitizeReport(r: Record<string, unknown>): LearningReport | null {
  if (!isDiff(r.diff) || (r.kind !== 'mission' && r.kind !== 'challenge')) return null;
  const ids = new Set(CONCEPTS.map(c => c.id));
  const t = isObj(r.telemetry) ? r.telemetry : {};
  return {
    n: int(r.n, 0, 1e9, 0), kind: r.kind, ref: str(r.ref, 40), title: str(r.title, 80), diff: r.diff, passedDrive: bool(r.passedDrive), passed: bool(r.passed),
    correct: int(r.correct, 0, 99, 0), total: int(r.total, 0, 99, 0), stars: int(r.stars, 0, 3, 0), coins: int(r.coins, 0, 1e6, 0),
    concepts: Array.isArray(r.concepts) ? r.concepts.filter(isObj).filter(c => ids.has(c.concept as ConceptId) && isLevel(c.from) && isLevel(c.to)).map(c => ({ concept: c.concept as ConceptId, from: c.from as MasteryLevel, to: c.to as MasteryLevel })) : [],
    strengths: Array.isArray(r.strengths) ? r.strengths.filter((x): x is string => typeof x === 'string').slice(0, 6).map(x => x.slice(0, 200)) : [],
    review: Array.isArray(r.review) ? r.review.filter(isObj).slice(0, 6).map(x => ({ concept: (ids.has(x.concept as ConceptId) ? x.concept : 'math.speed') as ConceptId, stem: str(x.stem, 300), explanation: str(x.explanation, 400) })) : [],
    telemetry: { topSpeedKmh: int(t.topSpeedKmh, 0, 999, 0), hazardHits: int(t.hazardHits, 0, 999, 0), driftSeconds: Number.isFinite(t.driftSeconds) ? Math.max(0, Math.min(9999, t.driftSeconds as number)) : 0, offRoadSeconds: Number.isFinite(t.offRoadSeconds) ? Math.max(0, Math.min(9999, t.offRoadSeconds as number)) : 0, durationSec: Number.isFinite(t.durationSec) ? Math.max(0, Math.min(9999, t.durationSec as number)) : 0 },
    next: str(r.next, 300),
  };
}
