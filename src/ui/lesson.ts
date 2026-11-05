import { el, clear } from './dom';
import { icon } from './icons';
import { labView, questionView } from './eduViews';
import type { SaveStore } from '../save/save';
import type { QuestionOutcome } from '../edu/assessment';
import { CHALLENGES, characterById, conceptById, labById, missionById, missionsOf, challengeById } from '../edu/content';
import { PROFILES, type DifficultyProfile } from '../edu/difficulty';
import { challengeQuestions, finishChallenge, finishMission, recordDiscover, recordDriveFail, recordPracticeOutcome, recordPractised, recordUnderstood } from '../edu/engine';
import type { LearningReport } from '../edu/state';
import { DIFFICULTY_LABEL, MASTERY_LABEL, type Challenge, type DriveObjective, type DriveResult, type LearningDifficulty, type Mission, type Question } from '../edu/types';

export interface LessonHost {
  /** Leaves the lesson and returns to the adventure hub. */
  exit(): void;
  /** Starts the driving part. The game calls `Lesson.driveFinished` when it ends. */
  drive(objective: DriveObjective, title: string, coach: string): void;
  sfx(kind: 'click' | 'unlock'): void;
}

const STEPS = ['Discover', 'Understand', 'Experiment', 'Apply', 'Reflect', 'Master'] as const;
const TAKEAWAYS = ['I will check my units before I answer.', 'I will read the data before I guess.', 'I will drive smoother to get cleaner numbers.'];

type Ctx =
  | { kind: 'mission'; mission: Mission; diff: LearningDifficulty }
  | { kind: 'challenge'; challenge: Challenge; diff: LearningDifficulty };

/** The guided learning screen: DISCOVER, UNDERSTAND, EXPERIMENT, APPLY (drive then questions), REFLECT, MASTER (the report). */
export class Lesson {
  readonly root = el('div', { id: 'lesson', class: 'screen' });
  private readonly panel = el('div', { class: 'edu-panel panel lesson' });
  private ctx: Ctx | null = null;
  private drive: DriveResult | null = null;
  private questions: Question[] = [];
  private outcomes: QuestionOutcome[] = [];
  private takeaway = '';

  constructor(private readonly save: SaveStore, private readonly host: LessonHost) { this.root.append(this.panel); }

  private get edu() { return this.save.data.edu; }
  private get profile(): DifficultyProfile { return PROFILES[this.ctx?.diff ?? this.edu.difficulty]; }

  // ------------------------------------------------------------------ entry points
  openMission(id: string): void {
    const mission = missionById(id); if (!mission) return;
    this.ctx = { kind: 'mission', mission, diff: this.edu.difficulty }; this.reset();
    this.save.update(d => { d.edu.missions[id].attempts = d.edu.missions[id].attempts; });
    this.discover();
  }
  openChallenge(id: string): void {
    const challenge = challengeById(id); if (!challenge) return;
    this.ctx = { kind: 'challenge', challenge, diff: this.edu.difficulty }; this.reset();
    this.challengeIntro();
  }
  private reset(): void { this.drive = null; this.questions = []; this.outcomes = []; this.takeaway = ''; }

  // ------------------------------------------------------------------ chrome
  private shell(step: number, title: string, who: Mission | Challenge, content: HTMLElement[], foot: HTMLElement[]): void {
    const ch = characterById(who.character), c = this.ctx!;
    clear(this.panel);
    this.panel.append(
      el('div', { class: 'lesson-head' }, [
        el('button', { class: 'iconbtn', 'aria-label': 'Back to the adventure', onclick: () => this.host.exit() }, [icon('chevL')]),
        el('div', { class: 'lesson-title' }, [el('div', { class: 'label' }, [`${ch.name} · ${DIFFICULTY_LABEL[c.diff]}`]), el('h2', { class: 'title' }, [title])]),
        el('span', { class: 'edu-diff' }, [DIFFICULTY_LABEL[c.diff]]),
      ]),
      el('ol', { class: 'steps', 'aria-label': 'Learning steps' }, STEPS.map((s, i) => el('li', { class: i < step ? 'done' : i === step ? 'now' : '', 'aria-current': i === step ? 'step' : null }, [s]))),
      el('div', { class: 'lesson-body' }, content),
      el('div', { class: 'lesson-foot' }, foot),
    );
    (this.panel.querySelector('.lesson-foot .btn') as HTMLElement | null)?.focus();
    this.panel.querySelector('.lesson-body')?.scrollTo?.({ top: 0 });
  }
  private next(label: string, fn: () => void, cls = ''): HTMLElement { return el('button', { class: `btn ${cls}`.trim(), onclick: () => { this.host.sfx('click'); fn(); } }, [icon('chevR'), label]); }
  private seenBefore(m: Mission): boolean { const p = this.edu.missions[m.id]; return p.attempts > 0 || p.done.easy || p.done.medium || p.done.hard; }

  // ------------------------------------------------------------------ 1. DISCOVER
  private discover(): void {
    const c = this.ctx as Extract<Ctx, { kind: 'mission' }>, m = c.mission, ch = characterById(m.character);
    let i = 0;
    const lines = m.discover;
    const bubble = el('div', { class: 'dlg' });
    const show = (): void => {
      clear(bubble);
      for (let k = 0; k <= i; k++) { const l = lines[k], mine = l.who === 'you'; const who = l.who === 'you' ? null : characterById(l.who); bubble.append(el('div', { class: `msg${mine ? ' you' : ''}` }, [mine ? null : avatar(ch.initials, ch.color), el('div', { class: 'bubble' }, [el('b', {}, [mine ? 'You' : who!.name]), el('p', {}, [l.text])])])); }
      foot();
    };
    const foot = (): void => {
      const f = this.panel.querySelector('.lesson-foot'); if (!f) return; clear(f);
      if (this.seenBefore(m)) f.append(el('button', { class: 'btn ghost small', onclick: () => this.driveStep() }, ['Skip to the drive']));
      f.append(i < lines.length - 1 ? this.next('Continue', () => { i++; show(); }) : this.next('Understand the idea', () => { this.save.update(d => { d.edu = recordDiscover(d.edu, m); }); this.understand(); }));
    };
    this.shell(0, m.title, m, [el('p', { class: 'hint lesson-sub' }, [m.summary]), bubble], []);
    show();
  }

  // ------------------------------------------------------------------ 2. UNDERSTAND
  private understand(): void {
    const c = this.ctx as Extract<Ctx, { kind: 'mission' }>, m = c.mission, v = m.variants[c.diff];
    const cards = v.understand.map(k => el('div', { class: 'u-card' }, [el('h3', {}, [k.title]), el('p', {}, [k.body]), k.formula ? el('div', { class: 'q-formula' }, [k.formula]) : null]));
    this.shell(1, m.title, m, [el('div', { class: 'label' }, [conceptById(m.concept).name]), ...cards],
      [this.next(m.lab || v.practice.length ? 'Try it yourself' : 'Drive', () => { this.save.update(d => { d.edu = recordUnderstood(d.edu, m); }); this.experiment(); })]);
  }

  // ------------------------------------------------------------------ 3. EXPERIMENT
  private experiment(): void {
    const c = this.ctx as Extract<Ctx, { kind: 'mission' }>, m = c.mission, v = m.variants[c.diff], lab = m.lab ? labById(m.lab) : undefined;
    const finish = (): void => { this.save.update(d => { d.edu = recordPractised(d.edu, m, lab?.id, c.diff); }); this.driveStep(); };
    if (lab) { this.shell(2, lab.title, m, [el('div', { class: 'label' }, ['Experiment']), labView(lab, c.diff, this.profile, finish)], []); return; }
    if (!v.practice.length) { finish(); return; }
    let i = 0;
    const run = (): void => {
      const q = v.practice[i];
      this.shell(2, m.title, m, [el('div', { class: 'label' }, ['Guided practice']), questionView(q, this.profile, o => { this.save.update(d => { d.edu = recordPracticeOutcome(d.edu, o); }); i++; if (i < v.practice.length) run(); else finish(); }, i, v.practice.length)], []);
    };
    run();
  }

  // ------------------------------------------------------------------ 4. APPLY: drive
  private driveStep(): void {
    const c = this.ctx!, who = c.kind === 'mission' ? c.mission : c.challenge;
    const objective = c.kind === 'mission' ? c.mission.variants[c.diff].objective : c.challenge.objective[c.diff];
    const coach = c.kind === 'mission' ? c.mission.variants[c.diff].coach : 'Complete the driving objective, then answer fresh questions in new situations.';
    this.shell(3, c.kind === 'mission' ? c.mission.title : c.challenge.title, who, [
      el('div', { class: 'label' }, ['Your driving objective']),
      el('p', { class: 'obj-brief' }, [objective.brief]),
      el('ul', { class: 'obj-list' }, objective.legs.map(l => el('li', {}, [icon('flag'), l.label]))),
      el('p', { class: 'hint' }, [coach]),
      el('p', { class: 'hint' }, ['Your own driving becomes the data for the questions that follow. You can pause and quit at any time.']),
    ], [this.next('Start driving', () => this.host.drive(objective, who.title, coach), 'good')]);
  }

  /** Called by the game when a drive ends (objective met, failed, timed out or abandoned). */
  driveFinished(r: DriveResult): void {
    const c = this.ctx; if (!c) return;
    this.drive = r;
    if (!r.passed) { if (c.kind === 'mission') this.save.update(d => { d.edu = recordDriveFail(d.edu, c.mission); }); this.driveFailed(r); return; }
    this.questions = c.kind === 'mission' ? c.mission.variants[c.diff].apply(r) : challengeQuestions(this.edu, c.challenge, c.diff, r);
    this.outcomes = []; this.askQuestion(0);
  }

  private driveFailed(r: DriveResult): void {
    const c = this.ctx!, who = c.kind === 'mission' ? c.mission : c.challenge;
    const rows = r.legs.map(l => el('li', { class: l.status }, [icon(l.status === 'passed' ? 'check' : l.status === 'failed' ? 'warn' : 'dot'), el('div', {}, [el('b', {}, [l.label]), l.reason ? el('div', { class: 'hint' }, [l.reason]) : null])]));
    this.shell(3, 'Not quite yet', who, [
      el('p', { class: 'obj-brief' }, [r.failReason ?? 'The objective was not completed.']),
      el('ul', { class: 'leg-list' }, rows),
      el('p', { class: 'hint' }, ['Missions are not lost: your reading and experiment progress is kept. Adjust and drive it again.']),
    ], [el('button', { class: 'btn ghost small', onclick: () => this.host.exit() }, [icon('home'), 'Back']), this.next('Try again', () => this.driveStep(), 'good')]);
  }

  // ------------------------------------------------------------------ 4. APPLY: questions
  private askQuestion(i: number): void {
    const c = this.ctx!, who = c.kind === 'mission' ? c.mission : c.challenge, q = this.questions[i];
    const dataNote = this.drive ? el('div', { class: 'data-note' }, [icon('stopwatch'), c.kind === 'mission' ? 'These questions use numbers from your own drive.' : 'New situations: show you can use the idea somewhere new.']) : null;
    this.shell(3, c.kind === 'mission' ? c.mission.title : c.challenge.title, who, [dataNote, questionView(q, this.profile, o => {
      this.outcomes.push(o);
      if (i + 1 < this.questions.length) this.askQuestion(i + 1);
      else if (c.kind === 'mission') this.reflect(); else this.finish();
    }, i, this.questions.length)].filter((x): x is HTMLElement => x !== null), []);
  }

  // ------------------------------------------------------------------ 5. REFLECT
  private reflect(): void {
    const c = this.ctx as Extract<Ctx, { kind: 'mission' }>, m = c.mission;
    const note = el('input', { class: 'q-input wide', type: 'text', maxlength: 140, placeholder: 'Or write your own takeaway (optional)', 'aria-label': 'Your own takeaway' }) as HTMLInputElement;
    note.addEventListener('keydown', e => e.stopPropagation()); note.addEventListener('keyup', e => e.stopPropagation());
    let pick = '';
    const chips = TAKEAWAYS.map(t => { const b = el('button', { class: 'chipbtn', 'aria-pressed': 'false', onclick: () => { pick = pick === t ? '' : t; chips.forEach(x => x.setAttribute('aria-pressed', String(x.textContent === pick))); } }, [t]); return b; });
    this.shell(4, m.title, m, [el('div', { class: 'label' }, ['Reflect']), ...m.reflect.map(r => el('p', { class: 'reflect-q' }, [r])), el('div', { class: 'label' }, ['My takeaway']), el('div', { class: 'chips' }, chips), note],
      [this.next('See my report', () => { this.takeaway = (note.value.trim() || pick).slice(0, 140); this.finish(); }, 'good')]);
  }

  // ------------------------------------------------------------------ 6. MASTER: report
  private finish(): void {
    const c = this.ctx!, drive = this.drive!;
    let report!: LearningReport;
    if (c.kind === 'mission') this.save.update(d => { const r = finishMission(d.edu, c.mission, c.diff, drive, this.questions, this.outcomes, this.takeaway); d.edu = r.edu; report = r.report; d.coins += r.report.coins; });
    else this.save.update(d => { const r = finishChallenge(d.edu, c.challenge, c.diff, drive, this.questions, this.outcomes); d.edu = r.edu; report = r.report; d.coins += r.report.coins; });
    if (report.passed) this.host.sfx('unlock');
    this.showReport(report);
  }

  showReport(r: LearningReport, fromJournal = false): void {
    const c = this.ctx;
    const mission = r.kind === 'mission' ? missionById(r.ref) : undefined, challenge = r.kind === 'challenge' ? CHALLENGES.find(x => x.id === r.ref) : undefined;
    const who = mission ?? challenge ?? CHALLENGES[0];
    if (!c) this.ctx = { kind: 'mission', mission: mission ?? missionsOf('math')[0], diff: r.diff };
    const stars = el('div', { class: 'stars', 'aria-label': `${r.stars} of 3 stars` }, [0, 1, 2].map(i => el('span', { class: i < r.stars ? 'on' : '' }, [icon('star')])));
    const list = (items: string[]): HTMLElement => el('ul', { class: 'rep-list' }, items.map(t => el('li', {}, [t])));
    const nextMission = mission && r.passed ? missionsOf(mission.subject).find(x => x.order === mission.order + 1) : undefined;
    this.shell(5, r.passed ? (r.kind === 'challenge' ? 'Challenge complete' : 'Mission complete') : 'Learning report', who, [
      el('div', { class: 'rep-top' }, [stars, el('div', {}, [el('b', { class: 'rep-big' }, [`${r.correct} of ${r.total} correct`]), el('div', { class: 'hint' }, [r.passed ? 'Well done. Your progress is saved.' : r.passedDrive ? 'The drive worked, but more answers need to be right to count.' : 'The driving objective was not completed.'])]), r.coins ? el('span', { class: 'chip' }, [icon('coin'), `+${r.coins}`]) : null]),
      el('div', { class: 'label' }, ['Concepts']),
      el('div', { class: 'rep-concepts' }, r.concepts.map(x => el('div', { class: `rc ${x.to}` }, [el('b', {}, [conceptById(x.concept).name]), el('span', {}, [x.from === x.to ? MASTERY_LABEL[x.to] : `${MASTERY_LABEL[x.from]} → ${MASTERY_LABEL[x.to]}`])]))),
      r.strengths.length ? el('div', { class: 'label' }, ['What went well']) : null, r.strengths.length ? list(r.strengths) : null,
      r.review.length ? el('div', { class: 'label' }, ['Worth another look']) : null,
      ...r.review.map(x => el('div', { class: 'review' }, [el('b', {}, [x.stem]), el('p', {}, [x.explanation])])),
      el('div', { class: 'label' }, ['Your drive']),
      el('div', { class: 'rep-stats' }, [stat('Top speed', `${r.telemetry.topSpeedKmh} km/h`), stat('Hazard hits', String(r.telemetry.hazardHits)), stat('Drift time', `${r.telemetry.driftSeconds.toFixed(1)} s`), stat('Off road', `${r.telemetry.offRoadSeconds.toFixed(1)} s`)]),
      el('p', { class: 'rep-next' }, [icon('flag'), ' ', r.next]),
    ].filter((x): x is HTMLElement => x !== null), [
      el('button', { class: 'btn ghost small', onclick: () => this.host.exit() }, [icon('home'), fromJournal ? 'Close' : 'Adventure']),
      !fromJournal && !r.passed ? this.next('Try again', () => (this.ctx!.kind === 'mission' ? this.discover() : this.challengeIntro()), 'good') : null,
      !fromJournal && nextMission ? this.next(`Next: ${nextMission.title}`, () => this.openMission(nextMission.id), 'good') : null,
    ].filter((x): x is HTMLElement => x !== null));
  }

  // ------------------------------------------------------------------ challenge intro
  private challengeIntro(): void {
    const c = this.ctx as Extract<Ctx, { kind: 'challenge' }>, ch = c.challenge, who = characterById(ch.character);
    this.shell(5, ch.title, ch, [
      el('div', { class: 'msg' }, [avatar(who.initials, who.color), el('div', { class: 'bubble' }, [el('b', {}, [who.name]), el('p', {}, [ch.summary]), el('p', {}, ['This is where an idea becomes yours: you will answer questions in situations you have not seen before. Hints weaken a mastery claim, so try without.'])])]),
      el('div', { class: 'label' }, ['Concepts on the line']),
      el('div', { class: 'rep-concepts' }, ch.concepts.map(x => el('div', { class: `rc ${this.edu.concepts[x].level}` }, [el('b', {}, [conceptById(x).name]), el('span', {}, [MASTERY_LABEL[this.edu.concepts[x].level]])]))),
    ], [this.next('Take the challenge', () => this.driveStep(), 'good')]);
  }
}

function avatar(initials: string, color: string): HTMLElement { return el('span', { class: 'avatar', style: `--c:${color}`, 'aria-hidden': 'true' }, [initials]); }
function stat(label: string, value: string): HTMLElement { return el('div', { class: 'stat' }, [el('span', { class: 'label' }, [label]), el('b', {}, [value])]); }
