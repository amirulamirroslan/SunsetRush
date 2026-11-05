import { el, clear } from './dom';
import { icon } from './icons';
import type { SaveStore } from '../save/save';
import { CHALLENGES, CHARACTERS, CONCEPTS, DISCOVERY_POINTS, REGIONS, SUBJECTS, conceptById, conceptsOf, missionsOf, subjectById } from '../edu/content';
import { PROFILES } from '../edu/difficulty';
import { challengeAvailability, missionAvailability, overallProgress, setDifficulty, subjectSummary } from '../edu/engine';
import { DIFFICULTY_LABEL, LEARNING_DIFFICULTIES, MASTERY_LABEL, MASTERY_ORDER, type LearningDifficulty } from '../edu/types';
import type { LearningReport } from '../edu/state';
import { formatTime } from '../sim/rewards';

export interface AdventureActions {
  mission(id: string): void; challenge(id: string): void; explore(): void; back(): void; report(r: LearningReport): void; sfx(k: 'click' | 'unlock'): void;
}
type Tab = 'missions' | 'journal' | 'profile';

/** The Discovery Coast hub: missions by character, the mission journal, the learning profile and the learning-difficulty choice. */
export class Adventure {
  readonly root = el('div', { id: 'adventure', class: 'screen' });
  private tab: Tab = 'missions';
  private readonly panel = el('div', { class: 'edu-panel panel hub' });

  constructor(private readonly save: SaveStore, private readonly a: AdventureActions) { this.root.append(this.panel); this.render(); }
  refresh(): void { this.render(); }
  openTab(t: Tab): void { this.tab = t; this.render(); }

  private render(): void {
    const e = this.save.data.edu;
    clear(this.panel);
    if (!e.onboarded) { this.panel.append(this.onboarding()); return; }
    const tabBtn = (t: Tab, label: string, ic: string): HTMLElement => el('button', { class: 'tab', role: 'tab', 'aria-selected': String(this.tab === t), onclick: () => { this.tab = t; this.render(); } }, [icon(ic), label]);
    this.panel.append(
      el('div', { class: 'hub-head' }, [
        el('button', { class: 'iconbtn', 'aria-label': 'Back to the main menu', onclick: this.a.back }, [icon('chevL')]),
        el('div', { class: 'lesson-title' }, [el('div', { class: 'label' }, ['Region 1 of 5 · Discovery Coast']), el('h2', { class: 'title' }, ['Learning Adventure'])]),
        this.difficultyPicker(e.difficulty),
        el('div', { class: 'chip', title: 'Coins' }, [icon('coin'), this.save.data.coins.toLocaleString()]),
      ]),
      el('div', { class: 'tabs', role: 'tablist' }, [tabBtn('missions', 'Missions', 'flag'), tabBtn('journal', 'Journal', 'info'), tabBtn('profile', 'Profile', 'star')]),
      el('div', { class: 'hub-body', role: 'tabpanel' }, [this.tab === 'missions' ? this.missions() : this.tab === 'journal' ? this.journal() : this.profile()]),
    );
  }

  // ------------------------------------------------------------------ difficulty
  private difficultyPicker(cur: LearningDifficulty): HTMLElement {
    const wrap = el('div', { class: 'seg', role: 'group', 'aria-label': 'Learning difficulty' });
    for (const d of LEARNING_DIFFICULTIES) wrap.append(el('button', { 'aria-pressed': String(d === cur), title: PROFILES[d].blurb, onclick: () => { this.save.update(s => { s.edu = setDifficulty(s.edu, d); }); this.a.sfx('click'); this.render(); } }, [DIFFICULTY_LABEL[d]]));
    return wrap;
  }

  private onboarding(): HTMLElement {
    const cards = LEARNING_DIFFICULTIES.map(d => el('button', { class: 'diff-card', onclick: () => { this.save.update(s => { s.edu = setDifficulty(s.edu, d); }); this.a.sfx('click'); this.render(); } }, [el('b', {}, [DIFFICULTY_LABEL[d]]), el('span', {}, [PROFILES[d].blurb])]));
    return el('div', { class: 'onboard' }, [
      el('div', { class: 'label' }, ['Welcome to Discovery Coast']),
      el('h2', { class: 'title' }, ['How would you like to learn?']),
      el('p', { class: 'hint' }, ['This is your learning preference, not an age. It changes the explanations, the help you get and what each mission asks of you. You can change it at any time and keep all your progress.']),
      el('div', { class: 'diff-cards' }, cards),
      el('button', { class: 'btn ghost small', onclick: this.a.back }, [icon('chevL'), 'Back']),
    ]);
  }

  // ------------------------------------------------------------------ missions
  private missions(): HTMLElement {
    const e = this.save.data.edu, d = e.difficulty, found = e.discoveries.length;
    const stars = (n: number): HTMLElement => el('span', { class: 'mstars', 'aria-label': `${n} stars` }, [0, 1, 2].map(i => el('i', { class: i < n ? 'on' : '' }, [icon('star')])));
    const cols = CHARACTERS.map(ch => {
      const rows = missionsOf(ch.subject).map(m => {
        const av = missionAvailability(e, m), p = e.missions[m.id];
        const row = el('button', { class: `mrow ${av}`, disabled: av === 'locked', onclick: () => { this.a.sfx('click'); this.a.mission(m.id); } }, [
          icon(av === 'locked' ? 'lock' : av === 'completed' ? 'check' : 'play'),
          el('div', { class: 'mtxt' }, [el('b', {}, [m.title]), el('span', {}, [av === 'locked' ? 'Finish the previous mission first' : m.summary])]),
          av === 'completed' ? stars(p.stars[d]) : null,
        ]);
        return row;
      });
      const c = CHALLENGES.find(x => x.subject === ch.subject)!, cav = challengeAvailability(e, c), done = Object.values(e.challenges[c.id].passed).some(Boolean);
      rows.push(el('button', { class: `mrow challenge ${cav}`, disabled: cav === 'locked', onclick: () => { this.a.sfx('click'); this.a.challenge(c.id); } }, [
        icon(cav === 'locked' ? 'lock' : done ? 'trophy' : 'trophy'),
        el('div', { class: 'mtxt' }, [el('b', {}, [`Mastery: ${c.title}`]), el('span', {}, [cav === 'locked' ? 'Opens after all three missions' : done && cav === 'completed' ? 'Passed at this difficulty. Replay for new scenarios.' : c.summary])]),
      ]));
      const s = subjectSummary(e, ch.subject);
      return el('section', { class: 'char-col' }, [
        el('header', {}, [el('span', { class: 'avatar', style: `--c:${ch.color}`, 'aria-hidden': 'true' }, [ch.initials]), el('div', {}, [el('b', {}, [ch.name]), el('span', {}, [`${subjectById(ch.subject).name} · ${s.missionsDone}/${s.missionsTotal}`])])]),
        el('p', { class: 'hint' }, [ch.bio]), ...rows,
      ]);
    });
    const explore = el('button', { class: 'explore-card', onclick: () => { this.a.sfx('click'); this.a.explore(); } }, [icon('speed'), el('div', {}, [el('b', {}, ['Explore the coast']), el('span', {}, [`Drive freely and find field notes · ${found}/${DISCOVERY_POINTS.length} found`])])]);
    const later = el('div', { class: 'later' }, [el('span', { class: 'label' }, ['Coming later']), ...REGIONS.filter(r => !r.available).map(r => el('span', { class: 'pill' }, [r.name])), ...SUBJECTS.filter(s => !s.active).map(s => el('span', { class: 'pill' }, [s.name]))]);
    return el('div', {}, [explore, el('div', { class: 'char-cols' }, cols), later]);
  }

  // ------------------------------------------------------------------ journal
  private journal(): HTMLElement {
    const e = this.save.data.edu, items = [...e.journal].reverse();
    const kindLabel: Record<string, string> = { discovery: 'Field note', mission: 'Mission', lab: 'Experiment', challenge: 'Mastery challenge', reflection: 'Takeaway' };
    const notes = DISCOVERY_POINTS.map(p => el('div', { class: `note ${e.discoveries.includes(p.id) ? 'found' : ''}` }, [el('b', {}, [e.discoveries.includes(p.id) ? p.title : '???']), el('span', {}, [conceptById(p.concept).name])]));
    const reports = [...e.reports].reverse().slice(0, 6).map(r => el('button', { class: 'jr', onclick: () => this.a.report(r) }, [icon(r.passed ? 'check' : 'warn'), el('div', { class: 'mtxt' }, [el('b', {}, [r.title]), el('span', {}, [`${DIFFICULTY_LABEL[r.diff]} · ${r.correct}/${r.total} correct${r.stars ? ` · ${r.stars} star${r.stars === 1 ? '' : 's'}` : ''}`])])]));
    return el('div', { class: 'journal' }, [
      el('div', { class: 'label' }, ['Field notes']), el('div', { class: 'notes' }, notes),
      el('div', { class: 'label' }, ['Learning reports']), reports.length ? el('div', { class: 'jrs' }, reports) : el('p', { class: 'hint' }, ['Finish a mission to get your first learning report.']),
      el('div', { class: 'label' }, ['Mission journal']),
      items.length ? el('div', { class: 'entries' }, items.map(j => el('article', { class: `entry ${j.kind}` }, [el('div', { class: 'label' }, [`${kindLabel[j.kind]} · ${DIFFICULTY_LABEL[j.diff]}`]), el('b', {}, [j.title]), el('p', {}, [j.text])]))) : el('p', { class: 'hint' }, ['Nothing here yet. Explore the coast or start a mission.']),
    ]);
  }

  // ------------------------------------------------------------------ profile
  private profile(): HTMLElement {
    const d = this.save.data, e = d.edu, o = overallProgress(e);
    const bars = SUBJECTS.filter(s => s.active).map(s => {
      const sum = subjectSummary(e, s.id);
      return el('section', { class: 'subj' }, [
        el('header', {}, [el('b', {}, [s.name]), el('span', {}, [`${sum.mastered}/${sum.total} mastered`])]),
        ...conceptsOf(s.id).map(c => { const lv = e.concepts[c.id].level, i = MASTERY_ORDER.indexOf(lv); return el('div', { class: 'cbar' }, [el('span', {}, [c.name]), el('div', { class: 'pips', role: 'img', 'aria-label': MASTERY_LABEL[lv] }, [1, 2, 3, 4, 5].map(k => el('i', { class: k <= i ? 'on' : '' }))), el('em', { class: lv }, [MASTERY_LABEL[lv]])]); }),
      ]);
    });
    const stat = (label: string, v: string): HTMLElement => el('div', { class: 'stat' }, [el('span', { class: 'label' }, [label]), el('b', {}, [v])]);
    return el('div', { class: 'profile' }, [
      el('div', { class: 'prof-stats' }, [stat('Missions', `${o.missions}/${o.missionsTotal}`), stat('Concepts mastered', `${o.mastered}/${o.conceptsTotal}`), stat('Answer accuracy', e.stats.answered ? `${o.accuracy}%` : '--'), stat('Hints used', String(e.stats.hints)), stat('Challenges passed', `${o.challenges}/${CHALLENGES.length}`), stat('Coins from learning', e.stats.coinsEarned.toLocaleString())]),
      el('div', { class: 'label' }, ['Mastery by subject']), ...bars,
      el('div', { class: 'label' }, ['Racing record (separate from learning)']),
      el('div', { class: 'prof-stats' }, [stat('Races', String(d.stats.races)), stat('Wins', String(d.stats.wins)), stat('Best lap', d.best.lap ? formatTime(d.best.lap) : '--'), stat('Coins', d.coins.toLocaleString())]),
      el('p', { class: 'hint' }, [`${CONCEPTS.length} concepts so far. Racing and learning keep separate progress; coins you earn by learning can be spent in the Garage, and your driving feeds your learning data.`]),
    ]);
  }
}
