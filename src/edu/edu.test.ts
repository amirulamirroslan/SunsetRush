import { describe, expect, it } from 'vitest';
import { RaceSim, FIXED_DT } from '../sim/RaceSim';
import { SAVE_KEY, SaveStore, sanitizeSave, type KeyValueStore } from '../save/save';
import { gradeAnswer, type QuestionOutcome } from './assessment';
import { CHALLENGES, CONCEPTS, DISCOVERY_POINTS, LABS, MISSIONS, challengeById, labDefaults, labGoalMet, labOutputs, missionsOf } from './content';
import { challengeAvailability, challengeQuestions, coinsFor, collectDiscovery, finishChallenge, finishMission, missionAvailability, overallProgress, recordDiscover, recordPractised, recordUnderstood, setDifficulty, starsFor, subjectSummary } from './engine';
import { applyEvidence } from './mastery';
import { ObjectiveTracker } from './objectives';
import { PROFILES } from './difficulty';
import { defaultEdu, sanitizeEdu } from './state';
import { observeRacing } from './telemetry';
import { runObjective } from './testPilot';
import { LEARNING_DIFFICULTIES, type DriveResult, type LearningDifficulty, type Question, type Sample } from './types';

class Mem implements KeyValueStore { m = new Map<string, string>(); getItem(k: string): string | null { return this.m.get(k) ?? null; } setItem(k: string, v: string): void { this.m.set(k, v); } removeItem(k: string): void { this.m.delete(k); } }

const okDrive: DriveResult = { passed: true, legs: [], stats: { topSpeedKmh: 200, hazardHits: 0, driftSeconds: 2, offRoadSeconds: 0, durationSec: 20, distance: 600 } };
/** A DriveResult filled in by actually driving the objective (so question numbers come from real telemetry). */
function driven(o: Parameters<typeof runObjective>[0]): DriveResult { return runObjective(o).result; }
const answerRight = (q: Question): QuestionOutcome => ({ id: q.id, scenarioId: q.scenarioId, concept: q.concept, correct: true, attempts: 1, hintUsed: false, transfer: !!q.transfer });
const answerWrong = (q: Question): QuestionOutcome => ({ id: q.id, scenarioId: q.scenarioId, concept: q.concept, correct: false, attempts: 3, hintUsed: true, transfer: !!q.transfer });

describe('curriculum content', () => {
  it('has the curriculum shape: 5 subjects / characters, 15 missions, 6 experiments, 5 challenges, 3 difficulties', () => {
    expect(new Set(MISSIONS.map(m => m.subject)).size).toBe(5);
    expect(new Set(MISSIONS.map(m => m.character)).size).toBe(5);
    expect(MISSIONS.length).toBe(15); expect(LABS.length).toBe(6); expect(CHALLENGES.length).toBe(5);
    for (const s of ['math', 'science', 'road', 'auto', 'geo'] as const) expect(missionsOf(s).length).toBe(3);
    for (const m of MISSIONS) for (const d of LEARNING_DIFFICULTIES) expect(m.variants[d]).toBeDefined();
    expect(new Set(CONCEPTS.map(c => c.id)).size).toBe(CONCEPTS.length);
    for (const m of MISSIONS) expect(CONCEPTS.some(c => c.id === m.concept)).toBe(true);
  });
  it('every difficulty has its own explanations, objective and questions (not just a harder opponent)', () => {
    for (const m of MISSIONS) {
      const v = m.variants;
      expect(new Set(LEARNING_DIFFICULTIES.map(d => JSON.stringify(v[d].understand))).size).toBe(3);
      expect(new Set(LEARNING_DIFFICULTIES.map(d => v[d].objective.brief)).size).toBe(3);
      expect(new Set(LEARNING_DIFFICULTIES.map(d => v[d].coach)).size).toBe(3);
      for (const d of LEARNING_DIFFICULTIES) {
        expect(v[d].understand.length).toBeGreaterThanOrEqual(2);
        expect(m.lab || v[d].practice.length > 0).toBeTruthy();
        const qs = v[d].apply(okDrive).map(q => q.stem);
        expect(new Set(qs).size).toBe(3);
      }
      const stems = new Set(LEARNING_DIFFICULTIES.map(d => v[d].apply(okDrive).map(q => q.stem).join('|')));
      expect(stems.size).toBe(3);
    }
  });
  it('every question is well formed, answerable and has an explanation, for fresh and real telemetry', () => {
    const ids = new Set<string>();
    const check = (q: Question): void => {
      expect(q.stem.length).toBeGreaterThan(10); expect(q.explanation.length).toBeGreaterThan(5);
      if (q.kind === 'choice') {
        expect(q.options!.length).toBeGreaterThanOrEqual(3); expect(new Set(q.options).size).toBe(q.options!.length);
        expect(q.correct).toBeGreaterThanOrEqual(0); expect(q.options![q.correct!]).toBeDefined();
        expect(gradeAnswer(q, { choice: q.correct! }).correct).toBe(true);
        expect(gradeAnswer(q, { choice: (q.correct! + 1) % q.options!.length }).correct).toBe(false);
      } else {
        expect(Number.isFinite(q.answer)).toBe(true); expect(q.tolerance!).toBeGreaterThan(0);
        expect(gradeAnswer(q, { value: q.answer! }).correct).toBe(true);
        expect(gradeAnswer(q, { value: q.answer! * 2 + 10 }).correct).toBe(false);
        expect(gradeAnswer(q, { value: NaN }).correct).toBe(false);
      }
    };
    for (const m of MISSIONS) for (const d of LEARNING_DIFFICULTIES) {
      for (const q of m.variants[d].practice) { check(q); expect(ids.has(q.id)).toBe(false); ids.add(q.id); }
      for (const drive of [okDrive, driven(m.variants[d].objective)]) for (const q of m.variants[d].apply(drive)) { check(q); expect(q.concept).toBe(m.concept); }
    }
    for (const c of CHALLENGES) for (const d of LEARNING_DIFFICULTIES) {
      const e = defaultEdu();
      for (let pass = 0; pass < 2; pass++) { const qs = challengeQuestions(e, c, d, driven(c.objective[d])); qs.forEach(check); expect(qs.every(q => q.transfer)).toBe(true); }
    }
  });
  it('every answer in the explanations agrees with the numeric answer (no contradicting hand-written numbers)', () => {
    // numeric answers must be printed, to the shown precision, inside their own explanation where the explanation states a result
    const bad: string[] = [];
    for (const m of MISSIONS) for (const d of LEARNING_DIFFICULTIES) for (const q of m.variants[d].apply(okDrive)) {
      if (q.kind !== 'numeric') continue;
      const a = q.answer!, txt = q.explanation.replace(/,/g, '');
      const cands = [a, Math.round(a), Math.round(a * 10) / 10, Math.round(a * 100) / 100, Math.round(a * 1000) / 1000];
      if (!cands.some(c => txt.includes(String(c)))) bad.push(`${q.id}: answer ${a} not found in "${q.explanation}"`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('driving objectives and telemetry', () => {
  it('each of the 60 objectives is achievable on the real physics by a careful scripted driver', () => {
    const fails: string[] = [];
    for (const m of MISSIONS) for (const d of LEARNING_DIFFICULTIES) { const r = driven(m.variants[d].objective); if (!r.passed) fails.push(`${m.id}/${d}: ${r.failReason}`); }
    for (const c of CHALLENGES) for (const d of LEARNING_DIFFICULTIES) { const r = driven(c.objective[d]); if (!r.passed) fails.push(`${c.id}/${d}: ${r.failReason}`); }
    expect(fails).toEqual([]);
  }, 180000);
  it('fails with a readable reason when the player is outside the band', () => {
    const o = MISSIONS[0].variants.medium.objective; // 110 to 170 km/h average
    const slow = runObjective(o, { bias: -60 }).result, fast = runObjective(o, { bias: 70 }).result;
    expect(slow.passed).toBe(false); expect(slow.failReason).toMatch(/below the target/);
    expect(fast.passed).toBe(false); expect(fast.failReason).toMatch(/above the target/);
    expect(slow.legs[0].status).toBe('failed');
  });
  it('times out when the car just sits there', () => {
    const t = new ObjectiveTracker(MISSIONS[0].variants.easy.objective);
    const s = (t0: number): Sample => ({ t: t0, progress: 5, speed: 0, braking: false, throttle: 0, offRoad: false, drifting: false, y: 1, hazardHits: 0, driftSeconds: 0, boostMeter: 0.35 });
    for (let i = 0; i < 100; i += 5) t.feed(s(i));
    expect(t.done).toBe(true); expect(t.passed).toBe(false); expect(t.failReason).toMatch(/Time ran out/);
  });
  it('measures a section exactly: interpolated crossing times give the true average speed', () => {
    const t = new ObjectiveTracker({ timeLimit: 60, brief: '', legs: [{ kind: 'section', id: 's', label: 'S', from: 100, to: 400 }] });
    // constant 40 m/s sampled at an awkward step so the gates fall between samples
    for (let i = 0; i < 20; i++) { const time = i * 0.55; t.feed({ t: time, progress: -10 + 40 * time, speed: 40, braking: false, throttle: 1, offRoad: false, drifting: false, y: 2, hazardHits: 0, driftSeconds: 0, boostMeter: 0.4 }); }
    expect(t.passed).toBe(true);
    const m = t.result().legs[0].metrics;
    expect(m.time).toBeCloseTo(7.5, 1); expect(m.avgMs).toBeCloseTo(40, 0); expect(m.avgKmh).toBeCloseTo(144, 0);
  });
  it('a stop test: needs real speed at the signal, a stop inside the box, and rejects overshoot or stopping early', () => {
    const o = MISSIONS[6].variants.easy.objective;
    expect(runObjective(o).result.passed).toBe(true);
    const slow = runObjective(o, { bias: -50 }).result; expect(slow.passed).toBe(false); expect(slow.failReason).toMatch(/at the signal/);
    const late = runObjective(o, { reaction: 2.5 }).result; expect(late.passed).toBe(false); expect(late.failReason).toMatch(/past the stop line/);
    const m = runObjective(o).result.legs[0].metrics, slowReact = runObjective(o, { reaction: 1.0 }).result.legs[0].metrics;
    expect(m.reactionSec).toBeGreaterThan(0.2); expect(m.reactionSec).toBeLessThan(0.45);
    expect(slowReact.reactionSec).toBeGreaterThan(0.9); expect(slowReact.reactionSec).toBeLessThan(1.15);
    expect(Math.abs(m.reactionDist - m.reactionSec * m.brakeMs)).toBeLessThan(1); // distance covered while reacting, at about the braking speed
    expect(slowReact.totalDist).toBeGreaterThan(m.totalDist);
    expect(m.totalDist).toBeCloseTo(m.reactionDist + m.brakeDist, 0);
  });
  it('educational evaluation never changes the racing: an observed run is bit-for-bit the same as an unobserved one', () => {
    const run = (observe: boolean): number[] => {
      const sim = new RaceSim({ laps: 3, difficulty: 'normal', cars: 6, playerSlot: 4, seed: 7 }); sim.autopilot = true;
      if (observe) { const t = new ObjectiveTracker(MISSIONS[0].variants.hard.objective); observeRacing(sim, s => t.feed(s)); }
      for (let i = 0; i < 120 * 40; i++) sim.step(FIXED_DT);
      return sim.cars.flatMap(c => [c.x, c.z, c.heading, c.vx, c.vz, c.progress]);
    };
    expect(run(true)).toEqual(run(false));
  });
});

describe('mastery', () => {
  const walk = (): ReturnType<typeof applyEvidence> => { let st = defaultEdu().concepts['math.speed']; for (const k of ['discover', 'understood', 'practised', 'applied'] as const) st = applyEvidence(st, { kind: k }).state as typeof st; return { state: st, from: 'unseen', to: st.level }; };
  it('climbs one step at a time and never skips', () => {
    let st = defaultEdu().concepts['math.speed'];
    expect(applyEvidence(st, { kind: 'applied' }).to).toBe('unseen');
    expect(applyEvidence(st, { kind: 'practised' }).to).toBe('unseen');
    const lv: string[] = [];
    for (const k of ['discover', 'understood', 'practised', 'applied'] as const) { st = applyEvidence(st, { kind: k }).state; lv.push(st.level); }
    expect(lv).toEqual(['discovered', 'learning', 'practised', 'applied']);
    expect(applyEvidence(st, { kind: 'discover' }).to).toBe('applied'); // levels never go down
  });
  it('cannot be mastered by repeating a scenario it has already seen, only by a correct answer in a new one', () => {
    const st0 = walk().state;
    const seen = applyEvidence(st0, { kind: 'scenario', scenarioId: 'x.math.speed.v0', correct: true }).state;
    expect(applyEvidence(seen, { kind: 'transfer', scenarioId: 'x.math.speed.v0', correct: true }).to).toBe('applied');
    expect(applyEvidence(st0, { kind: 'transfer', scenarioId: 'x.math.speed.v0', correct: false }).to).toBe('applied');
    expect(applyEvidence(st0, { kind: 'transfer', scenarioId: 'x.math.speed.v0', correct: true }).to).toBe('mastered');
  });
  it('is not reachable from below applied, even with a correct fresh answer', () => {
    const st = applyEvidence(defaultEdu().concepts['math.speed'], { kind: 'discover' }).state;
    expect(applyEvidence(st, { kind: 'transfer', scenarioId: 'z', correct: true }).to).toBe('discovered');
  });
});

describe('the full learning loop (DISCOVER, UNDERSTAND, EXPERIMENT, APPLY, REFLECT, MASTER)', () => {
  const m1 = MISSIONS[0];
  function playMission(e: ReturnType<typeof defaultEdu>, mi: typeof m1, d: LearningDifficulty, right: boolean) {
    let x = recordDiscover(e, mi); x = recordUnderstood(x, mi); x = recordPractised(x, mi, mi.lab, d);
    const drive = driven(mi.variants[d].objective), qs = mi.variants[d].apply(drive);
    return { drive, qs, ...finishMission(x, mi, d, drive, qs, qs.map(right ? answerRight : answerWrong), 'I will check my units.') };
  }
  it('a mission walks the concept to applied and pays stars and coins; a wrong set earns nothing and keeps the mission open', () => {
    const lose = playMission(defaultEdu(), m1, 'medium', false);
    expect(lose.report.passed).toBe(false); expect(lose.report.stars).toBe(0); expect(lose.report.coins).toBe(0);
    expect(lose.edu.missions.m1.done.medium).toBe(false); expect(lose.edu.concepts['math.speed'].level).toBe('practised');
    expect(lose.report.review.length).toBeGreaterThan(0);
    const win = playMission(lose.edu, m1, 'medium', true);
    expect(win.report.passed).toBe(true); expect(win.report.stars).toBe(3); expect(win.report.coins).toBe(coinsFor('medium', 3, true));
    expect(win.edu.concepts['math.speed'].level).toBe('applied');
    expect(win.edu.concepts['math.speed'].level).not.toBe('mastered');
    expect(win.edu.stats.coinsEarned).toBe(win.report.coins);
    expect(win.edu.journal.some(j => j.kind === 'mission')).toBe(true);
  });
  it('a failed drive is a failed mission: no stars, nothing applied, but reading and experiment progress is kept', () => {
    const failed: DriveResult = { ...okDrive, passed: false, failReason: 'nope' };
    let x = recordPractised(recordUnderstood(recordDiscover(defaultEdu(), m1), m1), m1, m1.lab, 'easy');
    const qs = m1.variants.easy.apply(failed), r = finishMission(x, m1, 'easy', failed, qs, qs.map(answerRight), '');
    expect(r.report.passedDrive).toBe(false); expect(r.report.passed).toBe(false); expect(r.report.stars).toBe(0);
    expect(r.edu.missions.m1.done.easy).toBe(false); expect(r.edu.concepts['math.speed'].level).toBe('practised'); expect(r.edu.missions.m1.driveFails).toBe(1);
    x = r.edu;
  });
  it('stars: three for clean first-try answers, fewer with hints or retries, none below the pass ratio', () => {
    const qs = m1.variants.easy.apply(okDrive);
    const clean = qs.map(answerRight);
    expect(starsFor(clean, 'easy')).toBe(3);
    expect(starsFor([{ ...clean[0], hintUsed: true }, clean[1], clean[2]], 'easy')).toBe(2);
    expect(starsFor([clean[0], clean[1], answerWrong(qs[2])], 'easy')).toBe(1);
    expect(starsFor([clean[0], answerWrong(qs[1]), answerWrong(qs[2])], 'easy')).toBe(0);
    expect(starsFor([], 'easy')).toBe(0);
  });
  it('missions unlock in order within a subject and the challenge opens after all three', () => {
    let e = defaultEdu();
    const [a, b, c] = missionsOf('math');
    expect(missionAvailability(e, a)).toBe('available'); expect(missionAvailability(e, b)).toBe('locked'); expect(missionAvailability(e, challengeById('c.math')!.subject === 'math' ? a : a)).toBe('available');
    expect(challengeAvailability(e, CHALLENGES[0])).toBe('locked');
    for (const mi of [a, b, c]) { e = playMission(e, mi, 'easy', true).edu; }
    expect(missionAvailability(e, b)).toBe('completed'); expect(challengeAvailability(e, CHALLENGES[0])).toBe('available'); expect(challengeAvailability(e, CHALLENGES[1])).toBe('locked');
  });
  it('MASTER: the challenge masters concepts only through fresh scenarios, and a second attempt uses new scenarios', () => {
    let e = defaultEdu();
    for (const mi of missionsOf('math')) e = playMission(e, mi, 'medium', true).edu;
    for (const cid of ['math.speed', 'math.pace', 'math.percent'] as const) expect(e.concepts[cid].level).toBe('applied');
    const ch = CHALLENGES[0], drive = driven(ch.objective.medium);
    const q1 = challengeQuestions(e, ch, 'medium', drive);
    expect(q1.map(q => q.scenarioId)).toEqual(['x.math.speed.v0', 'x.math.pace.v0', 'x.math.percent.v0']);
    // first try: miss one, hit two
    const first = finishChallenge(e, ch, 'medium', drive, q1, [answerRight(q1[0]), answerWrong(q1[1]), answerRight(q1[2])]);
    expect(first.edu.concepts['math.speed'].level).toBe('mastered'); expect(first.edu.concepts['math.pace'].level).toBe('applied'); expect(first.edu.concepts['math.percent'].level).toBe('mastered');
    // second try serves a different scenario for the concept that is not mastered, so it can still be mastered
    const q2 = challengeQuestions(first.edu, ch, 'medium', drive);
    expect(q2[1].scenarioId).toBe('x.math.pace.v1'); expect(q2[1].id).not.toBe(q1[1].id);
    const second = finishChallenge(first.edu, ch, 'medium', drive, q2, [answerRight(q2[0]), answerRight(q2[1]), answerRight(q2[2])]);
    expect(second.edu.concepts['math.pace'].level).toBe('mastered');
    expect(second.report.concepts.find(x => x.concept === 'math.pace')).toMatchObject({ from: 'applied', to: 'mastered' });
    // a hint cancels the mastery claim
    const hinted = finishChallenge(e, ch, 'medium', drive, q1, q1.map(q => ({ ...answerRight(q), hintUsed: true })));
    expect(hinted.edu.concepts['math.speed'].level).toBe('applied');
    // not driven = not mastered
    const nodrive = finishChallenge(e, ch, 'medium', { ...drive, passed: false }, q1, q1.map(answerRight));
    expect(nodrive.edu.concepts['math.speed'].level).toBe('applied');
  });
  it('a challenge cannot master a concept the player has not applied yet', () => {
    const ch = CHALLENGES[0], drive = driven(ch.objective.easy), e = defaultEdu();
    const qs = challengeQuestions(e, ch, 'easy', drive), r = finishChallenge(e, ch, 'easy', drive, qs, qs.map(answerRight));
    for (const c of ch.concepts) expect(r.edu.concepts[c].level).toBe('unseen');
    expect(r.report.next).toMatch(/Finish the missions/);
  });
  it('exploring collects each field note once, discovers the concept and writes a difficulty-specific journal entry', () => {
    const e0 = defaultEdu();
    const a = collectDiscovery(e0, 'd.friction', 'hard'); expect(a.fresh).toBe(true);
    expect(a.edu.concepts['sci.friction'].level).toBe('discovered');
    expect(a.edu.journal[0].text).toBe(DISCOVERY_POINTS.find(d => d.id === 'd.friction')!.note.hard);
    const b = collectDiscovery(a.edu, 'd.friction', 'easy'); expect(b.fresh).toBe(false); expect(b.edu).toBe(a.edu);
    expect(collectDiscovery(a.edu, 'nope').fresh).toBe(false);
  });
});

describe('difficulty profiles and learning difficulty changes', () => {
  it('three profiles with distinct tries, hints and rewards', () => {
    expect(PROFILES.easy.attempts).toBeGreaterThan(PROFILES.medium.attempts); expect(PROFILES.medium.attempts).toBeGreaterThan(PROFILES.hard.attempts);
    expect(PROFILES.easy.coinBase).toBeLessThan(PROFILES.hard.coinBase);
    expect(PROFILES.easy.hintCostsStar).toBe(false); expect(PROFILES.hard.hintCostsStar).toBe(true);
  });
  it('changing difficulty keeps every bit of progress; each difficulty is completed separately', () => {
    let e = defaultEdu();
    const m1 = MISSIONS[0], drive = driven(m1.variants.easy.objective), qs = m1.variants.easy.apply(drive);
    e = finishMission(recordPractised(recordUnderstood(recordDiscover(e, m1), m1), m1, m1.lab, 'easy'), m1, 'easy', drive, qs, qs.map(answerRight), '').edu;
    const before = JSON.stringify({ ...e, difficulty: 0, onboarded: 0 });
    const hard = setDifficulty(e, 'hard');
    expect(hard.difficulty).toBe('hard'); expect(JSON.stringify({ ...hard, difficulty: 0, onboarded: 0 })).toBe(before);
    expect(missionAvailability(hard, m1)).toBe('available'); // not yet done at Hard, but the next mission is already open
    expect(missionAvailability(hard, MISSIONS[1])).toBe('available');
    expect(missionAvailability(setDifficulty(hard, 'easy'), m1)).toBe('completed');
    expect(hard.concepts['math.speed'].level).toBe('applied');
  });
  it('labs: the goal is reachable on every difficulty and not met by the starting values', () => {
    for (const lab of LABS) for (const d of LEARNING_DIFFICULTIES) {
      const v = labDefaults(lab, d), g = lab.variants[d].goal;
      expect(labGoalMet(lab, d, v)).toBe(false);
      const inputs = lab.variants[d].inputs.filter(i => !i.locked);
      const free = inputs[inputs.length - 1]; let hit = false;
      for (let x = free.min; x <= free.max + 1e-9; x += free.step / 2) { if (labGoalMet(lab, d, { ...v, [free.id]: x })) { hit = true; break; } }
      expect(hit, `${lab.id}/${d} ${g.text}`).toBe(true);
      expect(Object.keys(labOutputs(lab, v)).length).toBe(lab.outputs.length);
    }
  });
});

describe('save, reload and migration', () => {
  it('a racing-only (v1) save keeps every racing field and gains a fresh learning profile', () => {
    const m = new Mem();
    m.setItem(SAVE_KEY, JSON.stringify({ version: 1, coins: 1234, selected: 'comet', best: { lap: 61.2, race: 190.5 }, stats: { races: 9, wins: 4, podiums: 6 }, settings: { quality: 'low', sound: false, autoAccelerate: false, laps: 5, difficulty: 'hard' } }));
    const s = new SaveStore(m);
    expect(s.data.coins).toBe(1234); expect(s.data.best).toEqual({ lap: 61.2, race: 190.5 }); expect(s.data.stats).toEqual({ races: 9, wins: 4, podiums: 6 });
    expect(s.data.settings).toMatchObject({ quality: 'low', sound: false, laps: 5, difficulty: 'hard' });
    expect(s.data.version).toBe(2); expect(s.data.edu.onboarded).toBe(false); expect(s.data.edu.difficulty).toBe('easy');
    expect(Object.values(s.data.edu.concepts).every(c => c.level === 'unseen')).toBe(true);
  });
  it('learning progress survives a reload, and racing coins/edit never disturb it', () => {
    const m = new Mem(), a = new SaveStore(m), mi = MISSIONS[2];
    a.update(d => { d.edu = setDifficulty(d.edu, 'medium'); d.edu = recordDiscover(d.edu, mi); d.edu = collectDiscovery(d.edu, 'd.speed').edu; });
    a.addCoins(500);
    const b = new SaveStore(m);
    expect(b.data.edu.difficulty).toBe('medium'); expect(b.data.edu.concepts['math.percent'].level).toBe('discovered'); expect(b.data.edu.discoveries).toEqual(['d.speed']);
    expect(b.data.coins).toBe(600);
    b.update(d => { d.settings.difficulty = 'hard'; }); // rival AI difficulty is independent of learning difficulty
    expect(b.data.edu.difficulty).toBe('medium');
  });
  it('hostile or damaged learning data is repaired, never thrown on, and valid parts are kept', () => {
    for (const bad of [null, 5, 'x', [], { concepts: 7, missions: [], difficulty: 'impossible', journal: 'no', reports: [1, 2], stats: { answered: -5, correct: 99 }, discoveries: ['d.speed', 'bogus', 3] }]) {
      const e = sanitizeEdu(bad);
      expect(['easy', 'medium', 'hard']).toContain(e.difficulty); expect(e.stats.answered).toBeGreaterThanOrEqual(0); expect(e.stats.correct).toBeLessThanOrEqual(e.stats.answered);
      expect(Object.keys(e.concepts).length).toBe(CONCEPTS.length);
    }
    expect(sanitizeEdu({ discoveries: ['d.speed', 'bogus', 3] }).discoveries).toEqual(['d.speed']);
    const d = sanitizeSave({ coins: 5, edu: { concepts: { 'math.speed': { level: 'mastered', seen: ['a', 4], right: 3, tried: 4 }, 'math.pace': { level: 'wizard' } } } });
    expect(d.edu.concepts['math.speed']).toEqual({ box: 0, due: 0, level: 'mastered', seen: ['a'], right: 3, tried: 4 }); expect(d.edu.concepts['math.pace'].level).toBe('unseen');
  });
  it('profile numbers add up', () => {
    let e = defaultEdu(); const mi = MISSIONS[0], drive = driven(mi.variants.easy.objective), qs = mi.variants.easy.apply(drive);
    e = finishMission(e, mi, 'easy', drive, qs, qs.map(answerRight), 'x').edu;
    const p = overallProgress(e), s = subjectSummary(e, 'math');
    expect(p.missions).toBe(1); expect(p.accuracy).toBe(100); expect(s.missionsDone).toBe(1); expect(s.total).toBe(3);
  });
});
