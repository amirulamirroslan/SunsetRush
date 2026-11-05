import type { QuestionOutcome } from './assessment';
import { CHALLENGES, DISCOVERY_POINTS, MISSIONS, challengeById, conceptById, missionById, missionsOf, transferQuestion, transferScenarioId, TRANSFER_SCENARIOS } from './content';
import { PROFILES } from './difficulty';
import { applyEvidence, type Evidence } from './mastery';
import { scheduleReady } from './review';
import type { EduSave, JournalEntry, LearningReport, ReportConcept } from './state';
import { MASTERY_LABEL, MASTERY_ORDER, type Challenge, type ConceptId, type DriveResult, type LearningDifficulty, type MasteryLevel, type Mission, type Question, type SubjectId } from './types';

/** All functions here are pure: they take an EduSave and return a changed copy. Nothing touches the race simulation. */
const clone = (e: EduSave): EduSave => JSON.parse(JSON.stringify(e)) as EduSave;
export const levelIndex = (l: MasteryLevel): number => MASTERY_ORDER.indexOf(l);

// ------------------------------------------------------------------ unlocking
export type Availability = 'locked' | 'available' | 'completed';
export function missionAvailability(e: EduSave, m: Mission): Availability {
  if (e.missions[m.id].done[e.difficulty]) return 'completed';
  const list = missionsOf(m.subject), i = list.findIndex(x => x.id === m.id);
  if (i <= 0) return 'available';
  const prev = list[i - 1], p = e.missions[prev.id];
  return p.done.easy || p.done.medium || p.done.hard ? 'available' : 'locked';
}
export const subjectMissionsDone = (e: EduSave, s: SubjectId): number => missionsOf(s).filter(m => { const p = e.missions[m.id]; return p.done.easy || p.done.medium || p.done.hard; }).length;
export function challengeAvailability(e: EduSave, c: Challenge): Availability {
  if (e.challenges[c.id].passed[e.difficulty]) return 'completed';
  return subjectMissionsDone(e, c.subject) >= missionsOf(c.subject).length ? 'available' : 'locked';
}

// ------------------------------------------------------------------ step evidence
function bump(e: EduSave, concept: ConceptId, ev: Evidence): MasteryLevel[] {
  const ch = applyEvidence(e.concepts[concept], ev); e.concepts[concept] = ch.state; return [ch.from, ch.to];
}
function journal(e: EduSave, j: Omit<JournalEntry, 'n'>): void {
  e.stats.counter++; e.journal.push({ ...j, n: e.stats.counter }); if (e.journal.length > 120) e.journal.splice(0, e.journal.length - 120);
}

export function setDifficulty(e: EduSave, d: LearningDifficulty): EduSave { const o = clone(e); o.difficulty = d; o.onboarded = true; return o; }

/** Step 1 (DISCOVER) finished: dialogue read. */
export function recordDiscover(e: EduSave, m: Mission): EduSave { const o = clone(e); bump(o, m.concept, { kind: 'discover' }); o.missions[m.id].attempts = Math.max(o.missions[m.id].attempts, 0); return o; }
/** Step 2 (UNDERSTAND) finished: concept cards read. */
export function recordUnderstood(e: EduSave, m: Mission): EduSave { const o = clone(e); bump(o, m.concept, { kind: 'understood' }); return o; }
/** Step 3 (EXPERIMENT) finished: lab goal reached or guided practice answered. */
export function recordPractised(e: EduSave, m: Mission, labId?: string, diff: LearningDifficulty = e.difficulty): EduSave {
  const o = clone(e); bump(o, m.concept, { kind: 'practised' });
  if (labId && o.labs[labId]) {
    if (!o.labs[labId][diff]) journal(o, { kind: 'lab', ref: labId, diff, title: `Experiment: ${m.title}`, text: `Completed the ${m.title} experiment on ${PROFILES[diff].label}.` });
    o.labs[labId][diff] = true;
  }
  return o;
}
export function recordPracticeOutcome(e: EduSave, o: QuestionOutcome): EduSave {
  const x = clone(e); x.stats.answered++; if (o.correct) x.stats.correct++; if (o.hintUsed) x.stats.hints++;
  bump(x, o.concept, { kind: 'scenario', scenarioId: o.scenarioId, correct: o.correct }); return x;
}
export function recordDriveFail(e: EduSave, m: Mission): EduSave { const o = clone(e); o.missions[m.id].driveFails++; return o; }

/** Records a field note found while exploring. Returns the same object if it was already collected. */
export function collectDiscovery(e: EduSave, id: string, diff: LearningDifficulty = e.difficulty): { edu: EduSave; fresh: boolean } {
  const d = DISCOVERY_POINTS.find(p => p.id === id);
  if (!d || e.discoveries.includes(id)) return { edu: e, fresh: false };
  const o = clone(e); o.discoveries.push(id); bump(o, d.concept, { kind: 'discover' });
  journal(o, { kind: 'discovery', ref: id, diff, title: d.title, text: d.note[diff] });
  return { edu: o, fresh: true };
}

// ------------------------------------------------------------------ scoring
export function starsFor(outcomes: QuestionOutcome[], diff: LearningDifficulty): number {
  if (!outcomes.length) return 0;
  const right = outcomes.filter(o => o.correct).length, ratio = right / outcomes.length;
  if (ratio < PROFILES[diff].passRatio) return 0;
  const clean = outcomes.every(o => o.correct && o.attempts === 1 && !o.hintUsed);
  return clean ? 3 : ratio >= 0.99 ? 2 : 1;
}
export const coinsFor = (diff: LearningDifficulty, stars: number, firstTime: boolean): number => (stars <= 0 ? 0 : Math.round(PROFILES[diff].coinBase * (0.5 + stars * 0.5) * (firstTime ? 1 : 0.4)));

function telemetryOf(r: DriveResult): LearningReport['telemetry'] {
  return { topSpeedKmh: r.stats.topSpeedKmh, hazardHits: r.stats.hazardHits, driftSeconds: r.stats.driftSeconds, offRoadSeconds: r.stats.offRoadSeconds, durationSec: r.stats.durationSec };
}
function reviewOf(questions: Question[], outcomes: QuestionOutcome[]): LearningReport['review'] {
  return outcomes.filter(o => !o.correct || o.hintUsed).map(o => { const q = questions.find(x => x.id === o.id); return q ? { concept: q.concept, stem: q.stem, explanation: q.explanation } : null; }).filter((x): x is NonNullable<typeof x> => x !== null).slice(0, 4);
}

// ------------------------------------------------------------------ mission completion (APPLY, REFLECT)
export interface MissionDone { edu: EduSave; report: LearningReport }
export function finishMission(e: EduSave, m: Mission, diff: LearningDifficulty, drive: DriveResult, questions: Question[], outcomes: QuestionOutcome[], takeaway: string, now: number = Date.now()): MissionDone {
  const o = clone(e), prog = o.missions[m.id], first = !prog.done[diff] && !(prog.done.easy || prog.done.medium || prog.done.hard);
  prog.attempts++;
  const stars = drive.passed ? starsFor(outcomes, diff) : 0;
  const passed = drive.passed && stars > 0;
  const from = o.concepts[m.concept].level;
  for (const out of outcomes) { o.stats.answered++; if (out.correct) o.stats.correct++; if (out.hintUsed) o.stats.hints++; bump(o, out.concept, { kind: 'scenario', scenarioId: out.scenarioId, correct: out.correct }); }
  if (passed) bump(o, m.concept, { kind: 'applied' });
  scheduleReady(o, [m.concept], now);
  const to = o.concepts[m.concept].level;
  let coins = 0;
  if (passed) { coins = coinsFor(diff, stars, first); prog.done[diff] = true; prog.stars[diff] = Math.max(prog.stars[diff], stars); o.stats.coinsEarned += coins; journal(o, { kind: 'mission', ref: m.id, diff, title: m.title, text: `${PROFILES[diff].label}: ${stars} star${stars === 1 ? '' : 's'}. ${takeaway}`.slice(0, 400) }); }
  else prog.driveFails += drive.passed ? 0 : 1;
  if (takeaway) journal(o, { kind: 'reflection', ref: m.id, diff, title: `Takeaway: ${m.title}`, text: takeaway });
  const right = outcomes.filter(x => x.correct).length;
  const concepts: ReportConcept[] = [{ concept: m.concept, from, to }];
  const strengths: string[] = [];
  if (drive.passed) strengths.push('You completed the driving objective and produced real data to work with.');
  if (right === outcomes.length && outcomes.length) strengths.push('Every question was answered correctly.');
  if (outcomes.some(x => x.correct && x.attempts === 1 && !x.hintUsed) && right !== outcomes.length) strengths.push('Some answers were right first time without any hint.');
  if (drive.stats.hazardHits === 0 && drive.passed) strengths.push('Clean driving with no hazard hits.');
  const next = passed ? nextStep(m) : drive.passed ? 'Review the explanations below, then try the mission again to earn a star.' : 'Read the driving feedback, then drive the objective again. Your reading and experiment progress is kept.';
  const report: LearningReport = { n: ++o.stats.counter, kind: 'mission', ref: m.id, title: m.title, diff, passedDrive: drive.passed, passed, correct: right, total: outcomes.length, stars, coins, concepts, strengths, review: reviewOf(questions, outcomes), telemetry: telemetryOf(drive), next };
  o.reports.push(report); if (o.reports.length > 15) o.reports.shift();
  return { edu: o, report };
}

function nextStep(m: Mission): string {
  const list = missionsOf(m.subject), i = list.findIndex(x => x.id === m.id);
  if (i >= 0 && i < list.length - 1) return `Next: "${list[i + 1].title}".`;
  const ch = CHALLENGES.find(c => c.subject === m.subject);
  return ch ? `All three missions done. The mastery challenge "${ch.title}" is open: show you can use these ideas in new situations.` : 'Well done.';
}

// ------------------------------------------------------------------ mastery challenges (MASTER)
/** Picks, per concept, the first fresh scenario the player has not been tested on (or the last one when all have been seen). */
export function challengeQuestions(e: EduSave, c: Challenge, diff: LearningDifficulty, drive: DriveResult): Question[] {
  return c.concepts.map(concept => {
    const seen = e.concepts[concept].seen;
    let v = 0; while (v < TRANSFER_SCENARIOS - 1 && seen.includes(transferScenarioId(concept, v))) v++;
    return transferQuestion(concept, v, diff, drive);
  });
}
export function finishChallenge(e: EduSave, c: Challenge, diff: LearningDifficulty, drive: DriveResult, questions: Question[], outcomes: QuestionOutcome[], now: number = Date.now()): MissionDone {
  const o = clone(e), rec = o.challenges[c.id]; rec.attempts++;
  const before = new Map<ConceptId, MasteryLevel>(c.concepts.map(x => [x, o.concepts[x].level]));
  for (const out of outcomes) {
    o.stats.answered++; if (out.correct) o.stats.correct++; if (out.hintUsed) o.stats.hints++;
    // mastery needs a driven, passed attempt and a correct answer in a scenario never seen before; hints cancel the claim
    if (drive.passed && !out.hintUsed) bump(o, out.concept, { kind: 'transfer', scenarioId: out.scenarioId, correct: out.correct });
    else bump(o, out.concept, { kind: 'scenario', scenarioId: out.scenarioId, correct: out.correct });
  }
  scheduleReady(o, c.concepts, now);
  const right = outcomes.filter(x => x.correct).length;
  const stars = drive.passed ? starsFor(outcomes, diff) : 0, passed = drive.passed && stars > 0;
  const first = !Object.values(rec.passed).some(Boolean);
  let coins = 0;
  if (passed) { rec.passed[diff] = true; coins = Math.round(coinsFor(diff, stars, first) * 1.5); o.stats.coinsEarned += coins; journal(o, { kind: 'challenge', ref: c.id, diff, title: c.title, text: `${PROFILES[diff].label}: ${right} of ${outcomes.length} fresh scenarios correct.` }); }
  const concepts: ReportConcept[] = c.concepts.map(x => ({ concept: x, from: before.get(x)!, to: o.concepts[x].level }));
  const mastered = concepts.filter(x => x.to === 'mastered' && x.from !== 'mastered').map(x => conceptById(x.concept).name);
  const strengths: string[] = [];
  if (drive.passed) strengths.push('You completed the driving challenge.');
  if (mastered.length) strengths.push(`Newly mastered: ${mastered.join(', ')}.`);
  const unmet = concepts.filter(x => levelIndex(x.to) < levelIndex('applied'));
  const next = unmet.length ? `Finish the missions for ${unmet.map(x => conceptById(x.concept).name).join(', ')} first: mastery needs a concept to be applied before a fresh scenario can master it.`
    : concepts.every(x => x.to === 'mastered') ? 'Every concept in this subject is mastered. Try a higher learning difficulty for a deeper version.' : 'Retry the challenge for a new set of fresh scenarios on any concept that is not mastered yet.';
  const report: LearningReport = { n: ++o.stats.counter, kind: 'challenge', ref: c.id, title: c.title, diff, passedDrive: drive.passed, passed, correct: right, total: outcomes.length, stars, coins, concepts, strengths, review: reviewOf(questions, outcomes), telemetry: telemetryOf(drive), next };
  o.reports.push(report); if (o.reports.length > 15) o.reports.shift();
  return { edu: o, report };
}

// ------------------------------------------------------------------ profile
export interface SubjectSummary { subject: SubjectId; concepts: { id: ConceptId; level: MasteryLevel }[]; mastered: number; total: number; missionsDone: number; missionsTotal: number }
export function subjectSummary(e: EduSave, s: SubjectId): SubjectSummary {
  const ids = MISSIONS.filter(m => m.subject === s).map(m => m.concept);
  const concepts = ids.map(id => ({ id, level: e.concepts[id].level }));
  return { subject: s, concepts, mastered: concepts.filter(c => c.level === 'mastered').length, total: concepts.length, missionsDone: subjectMissionsDone(e, s), missionsTotal: missionsOf(s).length };
}
export const levelLabel = (l: MasteryLevel): string => MASTERY_LABEL[l];
export function overallProgress(e: EduSave): { missions: number; missionsTotal: number; mastered: number; conceptsTotal: number; accuracy: number; challenges: number } {
  const missions = MISSIONS.filter(m => { const p = e.missions[m.id]; return p.done.easy || p.done.medium || p.done.hard; }).length;
  const mastered = Object.values(e.concepts).filter(c => c.level === 'mastered').length;
  return { missions, missionsTotal: MISSIONS.length, mastered, conceptsTotal: Object.keys(e.concepts).length, accuracy: e.stats.answered ? Math.round(e.stats.correct / e.stats.answered * 100) : 0, challenges: CHALLENGES.filter(c => Object.values(e.challenges[c.id].passed).some(Boolean)).length };
}
void missionById; void challengeById;
