import { describe, expect, it } from 'vitest';
import { gradeAnswer, type QuestionOutcome } from './assessment';
import { diagnoseNumeric } from './diagnose';
import { dismissSuggestion, suggestDifficulty } from './adapt';
import { CONCEPTS, MISSIONS, reviewQuestion } from './content';
import { finishMission } from './engine';
import { DAY, INTERVAL_DAYS, buildReview, finishReview, reviewStatus, scheduleReady } from './review';
import { defaultEdu, sanitizeEdu, type EduSave, type LearningReport } from './state';
import { LEARNING_DIFFICULTIES, type DriveResult, type Question } from './types';

const T0 = 1_800_000_000_000;
const ok = (q: Question, hint = false): QuestionOutcome => ({ id: q.id, scenarioId: q.scenarioId, concept: q.concept, correct: true, attempts: 1, hintUsed: hint, transfer: false });
const bad = (q: Question): QuestionOutcome => ({ id: q.id, scenarioId: q.scenarioId, concept: q.concept, correct: false, attempts: 2, hintUsed: false, transfer: false });
const drive: DriveResult = { passed: true, legs: [], stats: { topSpeedKmh: 150, hazardHits: 0, driftSeconds: 0, offRoadSeconds: 0, durationSec: 20, distance: 600 } };

/** An edu save with the given concepts applied (and scheduled) at T0. */
function appliedEdu(ids: string[]): EduSave {
  const e = defaultEdu();
  for (const id of ids) e.concepts[id as keyof typeof e.concepts].level = 'applied';
  scheduleReady(e, ids as never, T0);
  return e;
}
const numeric = (answer: number, unit: string, stem = 'q'): Question => ({ id: 'x', scenarioId: 'x', concept: 'math.speed', kind: 'numeric', stem, answer, tolerance: Math.abs(answer) * 0.015, unit, explanation: 'e' });

describe('wrong-answer diagnosis', () => {
  it('names the unit slip, the missing square, the missing half and the upside-down fraction', () => {
    expect(diagnoseNumeric(numeric(100, 'km/h'), 100 / 3.6)).toMatch(/divided by 3.6/);
    expect(diagnoseNumeric(numeric(25, 'm/s'), 25 * 3.6)).toMatch(/multiplied by 3.6/);
    expect(diagnoseNumeric(numeric(36, '%'), 0.36)).toMatch(/fraction/);
    expect(diagnoseNumeric(numeric(300, 'kJ', 'energy in kJ'), 300000)).toMatch(/1,000 times bigger/);
    expect(diagnoseNumeric(numeric(240, 'kJ'), 480)).toMatch(/double/);
    expect(diagnoseNumeric(numeric(240, 'kJ'), 120)).toMatch(/half/);
    expect(diagnoseNumeric(numeric(40, 'm'), 10)).toMatch(/quarter/);
    expect(diagnoseNumeric(numeric(0.25, 's'), 4)).toMatch(/wrong way round/);
    expect(diagnoseNumeric(numeric(50, 'm'), 53.7 + 1000)).toBeNull();
  });
  it('travels with a wrong numeric answer and with a tempting wrong choice, and never with a right one', () => {
    const q = numeric(100, 'km/h');
    expect(gradeAnswer(q, { value: 100 }).tip).toBeUndefined();
    expect(gradeAnswer(q, { value: 100 / 3.6 }).tip).toMatch(/3.6/);
    const withWhy = MISSIONS.flatMap(m => LEARNING_DIFFICULTIES.flatMap(d => m.variants[d].apply(drive))).find(x => x.kind === 'choice' && x.whyOption?.some(Boolean))!;
    expect(withWhy).toBeDefined();
    const i = withWhy.whyOption!.findIndex(w => !!w);
    expect(gradeAnswer(withWhy, { choice: i }).tip).toBe(withWhy.whyOption![i]);
    expect(gradeAnswer(withWhy, { choice: withWhy.correct! }).tip).toBeUndefined();
  });
  it('is quiet when nothing matches, and the tip never states the answer', () => {
    expect(diagnoseNumeric(numeric(37.3, 'm'), 51)).toBeNull();
    for (const t of [diagnoseNumeric(numeric(100, 'km/h'), 27.78), diagnoseNumeric(numeric(240, 'kJ'), 480)]) expect(t).not.toMatch(/\d{3}/);
  });
});

describe('refresh question bank', () => {
  it('has a valid, answerable question for every concept, difficulty and number seed', () => {
    expect(CONCEPTS.length).toBe(15);
    const stems = new Map<string, Set<string>>();
    for (const c of CONCEPTS) for (const d of LEARNING_DIFFICULTIES) for (let k = 0; k < 10; k++) {
      const q = reviewQuestion(c.id, d, k);
      expect(q.concept).toBe(c.id); expect(q.scenarioId).toBe(`rv.${c.id}`); expect(q.transfer).toBeFalsy();
      expect(q.explanation.length).toBeGreaterThan(5);
      if (q.kind === 'choice') {
        expect(new Set(q.options).size, q.id).toBe(q.options!.length); expect(q.options!.length, q.id).toBeGreaterThanOrEqual(3);
        expect(gradeAnswer(q, { choice: q.correct! }).correct).toBe(true);
      } else {
        expect(Number.isFinite(q.answer), q.id).toBe(true); expect(gradeAnswer(q, { value: q.answer! }).correct, q.id).toBe(true);
        expect(gradeAnswer(q, { value: q.answer! * 3 + 7 }).correct).toBe(false);
        const txt = q.explanation.replace(/,/g, ''), a = q.answer!;
        expect([a, Math.round(a), Math.round(a * 10) / 10, Math.round(a * 100) / 100, Math.round(a * 1000) / 1000].some(x => txt.includes(String(x))), `${q.id}: ${a} vs ${q.explanation}`).toBe(true);
      }
      const key = `${c.id}.${d}`; (stems.get(key) ?? stems.set(key, new Set()).get(key)!).add(q.stem);
    }
    for (const [k, s] of stems) expect(s.size, k).toBeGreaterThanOrEqual(4); // the numbers really change from one refresh to the next
  });
  it('is deterministic and never touches the mastery challenge scenarios', () => {
    expect(reviewQuestion('auto.brakes', 'medium', 3)).toEqual(reviewQuestion('auto.brakes', 'medium', 3));
    for (const c of CONCEPTS) expect(reviewQuestion(c.id, 'easy', 1).scenarioId.startsWith('x.')).toBe(false);
  });
});

describe('spaced review schedule', () => {
  it('schedules a concept one day after it is first applied, and not before', () => {
    const e = defaultEdu(); e.concepts['math.speed'].level = 'practised';
    scheduleReady(e, ['math.speed'], T0); expect(e.concepts['math.speed'].box).toBe(0);
    e.concepts['math.speed'].level = 'applied'; scheduleReady(e, ['math.speed'], T0);
    expect(e.concepts['math.speed']).toMatchObject({ box: 1, due: T0 + DAY });
    scheduleReady(e, ['math.speed'], T0 + 5 * DAY); expect(e.concepts['math.speed'].due).toBe(T0 + DAY); // never rescheduled
  });
  it('finishing a mission schedules its concept (using the clock it is given)', () => {
    const m = MISSIONS[0], qs = m.variants.easy.apply(drive), e = defaultEdu();
    for (const lvl of ['discover', 'understood', 'practised'] as const) void lvl;
    e.concepts[m.concept].level = 'practised';
    const done = finishMission(e, m, 'easy', drive, qs, qs.map(q => ok(q)), '', T0);
    expect(done.edu.concepts[m.concept]).toMatchObject({ level: 'applied', box: 1, due: T0 + DAY });
  });
  it('lists due and upcoming reviews', () => {
    const e = appliedEdu(['math.speed', 'sci.energy']);
    expect(reviewStatus(e, T0)).toEqual({ scheduled: 2, due: 0, nextDue: T0 + DAY });
    expect(reviewStatus(e, T0 + DAY)).toMatchObject({ scheduled: 2, due: 2, nextDue: null });
    expect(reviewStatus(defaultEdu(), T0)).toEqual({ scheduled: 0, due: 0, nextDue: null });
  });
  it('puts due concepts first, tops up with the soonest others, and varies the numbers between refreshes', () => {
    const e = appliedEdu(['math.speed', 'sci.energy', 'geo.slope']);
    e.concepts['geo.slope'].due = T0 - 1000; // overdue
    const set = buildReview(e, 'medium', T0, 2);
    expect(set.concepts[0]).toBe('geo.slope'); expect(set.concepts.length).toBe(2); expect(set.questions.length).toBe(2);
    expect(buildReview(defaultEdu(), 'easy', T0).questions).toEqual([]);
    const again = finishReview(e, set.questions.map(q => ok(q)), T0).edu;
    expect(buildReview(again, 'medium', T0, 2).questions[0].id).not.toBe(set.questions[0].id);
  });
  it('a correct refresh of a due concept climbs a box, widens the gap and pays coins; hints halve the coins', () => {
    const e = appliedEdu(['math.speed', 'sci.energy']), now = T0 + DAY;
    const qs = [reviewQuestion('math.speed', 'easy', 0), reviewQuestion('sci.energy', 'easy', 0)];
    const r = finishReview(e, [ok(qs[0]), ok(qs[1], true)], now);
    expect(r.coins).toBe(15);
    expect(r.edu.concepts['math.speed']).toMatchObject({ box: 2, due: now + INTERVAL_DAYS[1] * DAY });
    expect(r.edu.stats).toMatchObject({ reviews: 1, answered: 2, correct: 2, hints: 1, coinsEarned: 15 });
    expect(r.results.every(x => x.wasDue)).toBe(true);
    expect(e.concepts['math.speed'].box).toBe(1); // the input save is not changed
  });
  it('a miss falls back to the short gap; box 5 stays at the longest gap', () => {
    const e = appliedEdu(['math.speed']), now = T0 + DAY, q = reviewQuestion('math.speed', 'easy', 0);
    e.concepts['math.speed'].box = 4;
    const miss = finishReview(e, [bad(q)], now).edu.concepts['math.speed'];
    expect(miss).toMatchObject({ box: 1, due: now + DAY });
    e.concepts['math.speed'].box = 5; e.concepts['math.speed'].due = now - 1;
    expect(finishReview(e, [ok(q)], now).edu.concepts['math.speed']).toMatchObject({ box: 5, due: now + INTERVAL_DAYS[4] * DAY });
  });
  it('practising early pays nothing and cannot push a concept further out, but a miss still pulls it back', () => {
    const e = appliedEdu(['math.speed']), q = reviewQuestion('math.speed', 'easy', 0);
    const early = finishReview(e, [ok(q)], T0 + 1000);
    expect(early.coins).toBe(0); expect(early.edu.concepts['math.speed']).toMatchObject({ box: 1, due: T0 + DAY });
    e.concepts['math.speed'].box = 3; e.concepts['math.speed'].due = T0 + 7 * DAY;
    const miss = finishReview(e, [bad(q)], T0 + 1000).edu.concepts['math.speed'];
    expect(miss.box).toBe(2); expect(miss.due).toBe(T0 + 1000 + DAY);
  });
  it('never lowers mastery and ignores concepts that were never scheduled', () => {
    const e = appliedEdu(['math.speed']); e.concepts['math.speed'].level = 'mastered';
    const q = reviewQuestion('math.speed', 'easy', 0), other = reviewQuestion('road.limits', 'easy', 0);
    const r = finishReview(e, [bad(q), ok(other)], T0 + DAY);
    expect(r.edu.concepts['math.speed'].level).toBe('mastered'); expect(r.results.length).toBe(1);
  });
});

describe('adaptive difficulty suggestion', () => {
  const rep = (n: number, over: Partial<LearningReport>): LearningReport => ({ n, kind: 'mission', ref: 'm1', title: 'M', diff: 'medium', passedDrive: true, passed: true, correct: 3, total: 3, stars: 3, coins: 0, concepts: [], strengths: [], review: [], telemetry: { topSpeedKmh: 0, hazardHits: 0, driftSeconds: 0, offRoadSeconds: 0, durationSec: 0 }, next: '', ...over });
  const withReports = (diff: 'easy' | 'medium' | 'hard', rs: LearningReport[]): EduSave => { const e = defaultEdu(); e.difficulty = diff; e.reports = rs; e.stats.counter = rs.length ? rs[rs.length - 1].n : 0; return e; };
  it('suggests stepping up after three strong results in a row, but never above hard', () => {
    const rs = [1, 2, 3].map(n => rep(n, { diff: 'medium' }));
    expect(suggestDifficulty(withReports('medium', rs))).toMatchObject({ dir: 'up', to: 'hard' });
    expect(suggestDifficulty(withReports('hard', rs.map(r => ({ ...r, diff: 'hard' as const }))))).toBeNull();
    expect(suggestDifficulty(withReports('medium', rs.slice(1)))).toBeNull(); // only two
    expect(suggestDifficulty(withReports('medium', [rep(1, {}), rep(2, { stars: 1, correct: 2 }), rep(3, {})]))).toBeNull(); // not all strong
  });
  it('suggests stepping down after repeated struggles, but never below easy', () => {
    const rs = [rep(1, { passed: false, stars: 0, correct: 1 }), rep(2, {}), rep(3, { passed: false, passedDrive: false, stars: 0, correct: 0 })];
    expect(suggestDifficulty(withReports('medium', rs))).toMatchObject({ dir: 'down', to: 'easy' });
    expect(suggestDifficulty(withReports('easy', rs.map(r => ({ ...r, diff: 'easy' as const }))))).toBeNull();
  });
  it('only counts reports at the current difficulty, and dismissing silences it until newer evidence arrives', () => {
    const rs = [rep(1, { diff: 'easy' }), rep(2, {}), rep(3, {}), rep(4, {})];
    expect(suggestDifficulty(withReports('medium', rs))).not.toBeNull();
    const e = dismissSuggestion(withReports('medium', rs));
    expect(e.suggestSkip).toBe(4); expect(suggestDifficulty(e)).toBeNull();
    e.reports = [...rs, rep(5, {}), rep(6, {}), rep(7, {})]; e.stats.counter = 7;
    expect(suggestDifficulty(e)).toMatchObject({ dir: 'up' });
  });
});

describe('save version 2', () => {
  it('upgrades a version 1 learning block without losing progress and fills the new fields', () => {
    const v1 = { version: 1, difficulty: 'hard', onboarded: true, concepts: { 'math.speed': { level: 'mastered', seen: ['a'], right: 3, tried: 4 } }, discoveries: ['d.speed'], stats: { answered: 4, correct: 3, hints: 1, coinsEarned: 50, counter: 6 } };
    const e = sanitizeEdu(v1);
    expect(e.version).toBe(2); expect(e.difficulty).toBe('hard');
    expect(e.concepts['math.speed']).toEqual({ level: 'mastered', seen: ['a'], right: 3, tried: 4, box: 0, due: 0 });
    expect(e.stats).toMatchObject({ answered: 4, coinsEarned: 50, reviews: 0 }); expect(e.suggestSkip).toBe(0);
    expect(e.concepts['geo.carbon'].level).toBe('unseen'); expect(e.missions['m15']).toBeDefined(); expect(e.labs['lab.carbon']).toBeDefined(); expect(e.challenges['c.geo']).toBeDefined();
  });
  it('repairs hostile schedule values', () => {
    const e = sanitizeEdu({ concepts: { 'math.speed': { level: 'applied', box: 99, due: -5 }, 'sci.energy': { level: 'applied', box: 'x', due: 'y' } }, suggestSkip: 'no', stats: { reviews: -4 } });
    expect(e.concepts['math.speed']).toMatchObject({ box: 5, due: 0 }); expect(e.concepts['sci.energy']).toMatchObject({ box: 0, due: 0 });
    expect(e.suggestSkip).toBe(0); expect(e.stats.reviews).toBe(0);
  });
});
