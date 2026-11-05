import { el } from './dom';
import { icon } from './icons';
import { gradeAnswer, type QuestionOutcome } from '../edu/assessment';
import { labGoalMet, labOutputs } from '../edu/content';
import type { DifficultyProfile } from '../edu/difficulty';
import type { Lab, LearningDifficulty, Question } from '../edu/types';

/**
 * One question at a time. The player gets the tries of their learning difficulty, an optional hint, and a plain explanation after the
 * final answer. Calls `done` once with how it went; that outcome is the evidence the mastery system uses.
 */
export function questionView(q: Question, p: DifficultyProfile, done: (o: QuestionOutcome) => void, index = 0, total = 1): HTMLElement {
  let attempts = 0, hintUsed = false, finished = false;
  const feedback = el('div', { class: 'q-feedback', role: 'status', 'aria-live': 'polite' });
  const hint = el('div', { class: 'q-hint' });
  const body = el('div', { class: 'q-body' });
  const finish = (correct: boolean): void => {
    finished = true; actions.replaceChildren();
    if (q.kind === 'choice') Array.from(body.children).forEach((c, i) => { const b = c as HTMLButtonElement; b.disabled = true; if (i === q.correct) b.classList.add('ok'); });
    root.classList.add(correct ? 'right' : 'wrong');
    feedback.replaceChildren(el('b', {}, [correct ? 'Correct.' : 'Not this time.']), ' ', q.explanation);
    if (q.formula) feedback.append(el('div', { class: 'q-formula' }, [q.formula]));
    actions.append(el('button', { class: 'btn small good', onclick: () => done({ id: q.id, scenarioId: q.scenarioId, concept: q.concept, correct, attempts: Math.max(1, attempts), hintUsed, transfer: !!q.transfer }) }, [icon('chevR'), index + 1 >= total ? 'Continue' : 'Next question']));
    (actions.querySelector('button') as HTMLElement | null)?.focus();
  };
  const miss = (msg: string): void => {
    attempts++;
    if (attempts >= p.attempts) return finish(false);
    feedback.replaceChildren(`${msg} ${p.attempts - attempts} ${p.attempts - attempts === 1 ? 'try' : 'tries'} left.`);
  };
  const showHint = (): void => {
    if (hintUsed || finished) return; hintUsed = true;
    hint.replaceChildren(el('b', {}, ['Hint: ']), q.hint ?? 'Re-read the Understand cards.');
    if (q.formula && !p.showFormula) hint.append(el('div', { class: 'q-formula' }, [q.formula]));
    hintBtn.disabled = true;
  };
  const hintBtn = el('button', { class: 'btn ghost small', onclick: showHint }, [icon('info'), p.hintCostsStar ? 'Hint (costs a star)' : 'Hint']);
  const actions = el('div', { class: 'q-actions' });

  if (q.kind === 'choice') {
    const opts = q.options ?? [];
    opts.forEach((text, i) => {
      const b = el('button', { class: 'q-opt', onclick: () => {
        if (finished || b.disabled) return;
        const g = gradeAnswer(q, { choice: i });
        if (g.correct) { b.classList.add('ok'); attempts++; finish(true); }
        else { b.classList.add('no'); b.disabled = true; miss(g.message); if (!finished) b.setAttribute('aria-disabled', 'true'); else b.classList.add('no'); }
      } }, [el('span', { class: 'q-key' }, [String.fromCharCode(65 + i)]), text]);
      body.append(b);
    });
    actions.append(hintBtn);
  } else {
    const input = el('input', { class: 'q-input', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Your answer', placeholder: 'Type a number' }) as HTMLInputElement;
    const check = (): void => {
      if (finished) return;
      const v = Number(input.value.replace(/,/g, '').trim());
      if (input.value.trim() === '' || !Number.isFinite(v)) { feedback.replaceChildren('Type a number first.'); return; }
      const g = gradeAnswer(q, { value: v });
      if (g.correct) { attempts++; finish(true); } else miss(g.message);
      if (!finished) { input.select(); }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } e.stopPropagation(); });
    input.addEventListener('keyup', e => e.stopPropagation());
    body.append(el('div', { class: 'q-num' }, [input, q.unit ? el('span', { class: 'q-unit' }, [q.unit]) : null]));
    actions.append(el('button', { class: 'btn small', onclick: check }, [icon('check'), 'Check']), hintBtn);
  }
  const root = el('div', { class: 'edu-q' }, [
    el('div', { class: 'label' }, [`Question ${index + 1} of ${total}`]),
    el('p', { class: 'q-stem' }, [q.stem]),
    p.showFormula && q.formula ? el('div', { class: 'q-formula' }, [q.formula]) : null,
    body, hint, feedback, actions,
  ]);
  return root;
}

/** The interactive experiment: sliders in, live readouts out, a measurable goal. */
export function labView(lab: Lab, diff: LearningDifficulty, p: DifficultyProfile, onDone: () => void): HTMLElement {
  const v = lab.variants[diff];
  const values: Record<string, number> = {};
  for (const i of v.inputs) values[i.id] = i.options ? i.options[0].value : i.value;
  const readouts = new Map<string, HTMLElement>();
  const status = el('div', { class: 'lab-goal' });
  const doneBtn = el('button', { class: 'btn small good', disabled: true, onclick: onDone }, [icon('check'), 'Experiment complete']);
  const guide = el('div', { class: 'lab-guide' });
  const showGuide = (): void => { guide.replaceChildren(el('b', {}, ['Guide: ']), v.guide); guideBtn.disabled = true; };
  const guideBtn = el('button', { class: 'btn ghost small', onclick: showGuide }, [icon('info'), 'Show a guide']);
  if (p.guidedLab) showGuide();
  const refresh = (): void => {
    const out = labOutputs(lab, values);
    for (const o of lab.outputs) readouts.get(o.id)!.textContent = `${out[o.id].toFixed(o.decimals)} ${o.unit}`;
    const met = labGoalMet(lab, diff, values);
    status.className = `lab-goal${met ? ' met' : ''}`;
    status.replaceChildren(icon(met ? 'check' : 'flag'), met ? ` Goal reached: ${v.goal.text}` : ` Goal: ${v.goal.text}`);
    doneBtn.disabled = !met;
  };
  const controls = v.inputs.map(i => {
    const out = el('output', { class: 'lab-val' }, [i.options ? i.options[0].label : `${i.value} ${i.unit}`]);
    if (i.locked || i.options) return el('div', { class: 'lab-in locked' }, [el('label', {}, [i.label]), el('div', { class: 'lab-fixed' }, [i.options ? i.options[0].label : `${i.value} ${i.unit}`])]);
    const r = el('input', { type: 'range', min: i.min, max: i.max, step: i.step, value: i.value, 'aria-label': i.label }) as HTMLInputElement;
    r.addEventListener('input', () => { values[i.id] = Number(r.value); out.textContent = `${r.value} ${i.unit}`; refresh(); });
    r.addEventListener('keydown', e => e.stopPropagation()); r.addEventListener('keyup', e => e.stopPropagation());
    return el('div', { class: 'lab-in' }, [el('label', {}, [i.label, ' ', out]), r]);
  });
  const outs = lab.outputs.map(o => { const r = el('b', {}, ['-']); readouts.set(o.id, r); return el('div', { class: 'lab-out' }, [el('span', { class: 'label' }, [o.label]), r]); });
  const root = el('div', { class: 'edu-lab' }, [
    el('p', { class: 'hint' }, [lab.intro]),
    p.showFormula || v.showFormula ? el('div', { class: 'q-formula' }, [lab.formula]) : null,
    el('div', { class: 'lab-grid' }, [el('div', { class: 'lab-ins' }, controls), el('div', { class: 'lab-outs' }, outs)]),
    status, guide, el('div', { class: 'q-actions' }, [guideBtn, doneBtn]),
  ]);
  refresh();
  return root;
}
