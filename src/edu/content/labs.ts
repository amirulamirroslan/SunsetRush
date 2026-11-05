import type { Challenge, DriveObjective, GateLeg, Lab, LabInput, LearningDifficulty, SectionLeg } from '../types';

const G = 9.8;
const inp = (o: LabInput): LabInput => o;

const SURFACES = [{ label: 'Dry asphalt (μ 0.8)', value: 0.8 }, { label: 'Wet asphalt (μ 0.5)', value: 0.5 }, { label: 'Gravel (μ 0.35)', value: 0.35 }, { label: 'Ice (μ 0.15)', value: 0.15 }];

/** Experiments: interactive labs with a measurable goal. The result of each is deterministic and needs no randomness. */
export const LABS: Lab[] = [
  {
    id: 'lab.pace', subject: 'math', concept: 'math.speed', title: 'Pace Lab', formula: 'speed = distance ÷ time',
    intro: 'Kai has wired the timing wall to a calculator. Change the distance and the time and watch the speed respond.',
    outputs: [
      { id: 'ms', label: 'Speed', unit: 'm/s', decimals: 1, compute: v => v.dist / v.time },
      { id: 'kmh', label: 'Speed', unit: 'km/h', decimals: 0, compute: v => v.dist / v.time * 3.6 },
    ],
    variants: {
      easy: { showFormula: true, guide: 'Make the speed 30 m/s. Try 300 m in 10 s, or any other pair that gives 30.', goal: { output: 'ms', min: 28.5, max: 31.5, text: 'Reach a speed of 30 m/s (±1.5).' },
        inputs: [inp({ id: 'dist', label: 'Distance', unit: 'm', min: 100, max: 1000, step: 50, value: 400 }), inp({ id: 'time', label: 'Time', unit: 's', min: 2, max: 40, step: 0.5, value: 20 })] },
      medium: { showFormula: false, guide: 'Make the average speed 126 km/h using any distance and time. Convert carefully.', goal: { output: 'kmh', min: 124, max: 128, text: 'Reach 126 km/h (±2).' },
        inputs: [inp({ id: 'dist', label: 'Distance', unit: 'm', min: 100, max: 1000, step: 50, value: 400 }), inp({ id: 'time', label: 'Time', unit: 's', min: 2, max: 40, step: 0.5, value: 20 })] },
      hard: { showFormula: false, guide: 'The distance is fixed at 840 m. Find the time that gives an average speed of 168 km/h.', goal: { output: 'kmh', min: 166, max: 170, text: 'Reach 168 km/h over 840 m (±2).' },
        inputs: [inp({ id: 'dist', label: 'Distance', unit: 'm', min: 840, max: 840, step: 1, value: 840, locked: true }), inp({ id: 'time', label: 'Time', unit: 's', min: 5, max: 40, step: 0.5, value: 25 })] },
    },
  },
  {
    id: 'lab.grip', subject: 'science', concept: 'sci.friction', title: 'Grip Lab', formula: 'braking distance = v² ÷ (2 μ g)',
    intro: 'Lina\'s test rig stops a car on different surfaces. Choose a surface and a speed and see how far it slides.',
    outputs: [
      { id: 'dist', label: 'Braking distance', unit: 'm', decimals: 1, compute: v => (v.speed / 3.6) ** 2 / (2 * v.mu * G) },
      { id: 'decel', label: 'Deceleration', unit: 'm/s²', decimals: 1, compute: v => v.mu * G },
    ],
    variants: {
      easy: { showFormula: true, guide: 'On dry asphalt, find a speed that stops the car in between 26 and 30 m.', goal: { output: 'dist', min: 26, max: 30, text: 'Stop in 26 to 30 m on dry asphalt.' },
        inputs: [inp({ id: 'mu', label: 'Surface', unit: '', min: 0.8, max: 0.8, step: 1, value: 0.8, locked: true, options: [SURFACES[0]] }), inp({ id: 'speed', label: 'Speed', unit: 'km/h', min: 20, max: 160, step: 1, value: 100 })] },
      medium: { showFormula: false, guide: 'On wet asphalt, find a speed that stops the car in 40 to 45 m.', goal: { output: 'dist', min: 40, max: 45, text: 'Stop in 40 to 45 m on wet asphalt.' },
        inputs: [inp({ id: 'mu', label: 'Surface', unit: '', min: 0.5, max: 0.5, step: 1, value: 0.5, locked: true, options: [SURFACES[1]] }), inp({ id: 'speed', label: 'Speed', unit: 'km/h', min: 20, max: 160, step: 1, value: 100 })] },
      hard: { showFormula: false, guide: 'Choose any surface and any speed that stops the car in exactly 20 to 22 m on the slipperiest surface offered.', goal: { output: 'dist', min: 20, max: 22, text: 'Stop in 20 to 22 m on ice.' },
        inputs: [inp({ id: 'mu', label: 'Surface', unit: '', min: 0.15, max: 0.15, step: 1, value: 0.15, locked: true, options: [SURFACES[3]] }), inp({ id: 'speed', label: 'Speed', unit: 'km/h', min: 5, max: 120, step: 1, value: 60 })] },
    },
  },
  {
    id: 'lab.stopping', subject: 'road', concept: 'road.stopping', title: 'Stopping Distance Lab', formula: 'stopping distance = reaction distance + braking distance',
    intro: 'Omar\'s rig splits a stop into its two halves. Move the speed and the reaction time and watch which half grows.',
    outputs: [
      { id: 'react', label: 'Reaction distance', unit: 'm', decimals: 1, compute: v => v.speed / 3.6 * v.reaction },
      { id: 'brake', label: 'Braking distance', unit: 'm', decimals: 1, compute: v => (v.speed / 3.6) ** 2 / (2 * v.mu * G) },
      { id: 'total', label: 'Total stopping distance', unit: 'm', decimals: 1, compute: v => v.speed / 3.6 * v.reaction + (v.speed / 3.6) ** 2 / (2 * v.mu * G) },
    ],
    variants: {
      easy: { showFormula: true, guide: 'Reaction time is 1.0 s on dry road. Find a speed where the total stopping distance is 35 to 40 m.', goal: { output: 'total', min: 35, max: 40, text: 'Total stopping distance of 35 to 40 m.' },
        inputs: [inp({ id: 'mu', label: 'Road', unit: '', min: 0.7, max: 0.7, step: 1, value: 0.7, locked: true, options: [{ label: 'Dry road (μ 0.7)', value: 0.7 }] }), inp({ id: 'reaction', label: 'Reaction time', unit: 's', min: 1, max: 1, step: 0.1, value: 1, locked: true }), inp({ id: 'speed', label: 'Speed', unit: 'km/h', min: 10, max: 140, step: 1, value: 80 })] },
      medium: { showFormula: false, guide: 'On a wet road (μ 0.4) with a 1.0 s reaction, find a speed with a total stopping distance of 40 to 45 m.', goal: { output: 'total', min: 40, max: 45, text: 'Total stopping distance of 40 to 45 m on a wet road.' },
        inputs: [inp({ id: 'mu', label: 'Road', unit: '', min: 0.4, max: 0.4, step: 1, value: 0.4, locked: true, options: [{ label: 'Wet road (μ 0.4)', value: 0.4 }] }), inp({ id: 'reaction', label: 'Reaction time', unit: 's', min: 1, max: 1, step: 0.1, value: 1, locked: true }), inp({ id: 'speed', label: 'Speed', unit: 'km/h', min: 10, max: 140, step: 1, value: 80 })] },
      hard: { showFormula: false, guide: 'A distracted driver reacts in 1.5 s on a wet road (μ 0.4). Find a speed with a total stopping distance of 50 to 55 m.', goal: { output: 'total', min: 50, max: 55, text: 'Total stopping distance of 50 to 55 m with a 1.5 s reaction.' },
        inputs: [inp({ id: 'mu', label: 'Road', unit: '', min: 0.4, max: 0.4, step: 1, value: 0.4, locked: true, options: [{ label: 'Wet road (μ 0.4)', value: 0.4 }] }), inp({ id: 'reaction', label: 'Reaction time', unit: 's', min: 0.5, max: 2.5, step: 0.1, value: 1.5 }), inp({ id: 'speed', label: 'Speed', unit: 'km/h', min: 10, max: 140, step: 1, value: 80 })] },
    },
  },
];
export const labById = (id: string): Lab | undefined => LABS.find(l => l.id === id);

/** Computes every lab output for the current input values. */
export function labOutputs(lab: Lab, values: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of lab.outputs) out[o.id] = o.compute(values);
  return out;
}
export function labDefaults(lab: Lab, d: LearningDifficulty): Record<string, number> {
  const v: Record<string, number> = {};
  for (const i of lab.variants[d].inputs) v[i.id] = i.options ? i.options[0].value : i.value;
  return v;
}
/** Does the current lab state satisfy the goal of this difficulty? */
export function labGoalMet(lab: Lab, d: LearningDifficulty, values: Record<string, number>): boolean {
  const g = lab.variants[d].goal, o = labOutputs(lab, values)[g.output];
  return Number.isFinite(o) && o >= g.min && o <= g.max;
}

// ------------------------------------------------------------------ mastery challenges
const sec = (l: Omit<SectionLeg, 'kind'>): SectionLeg => ({ kind: 'section', ...l });
const gate = (l: Omit<GateLeg, 'kind'>): GateLeg => ({ kind: 'gate', ...l });
const obj = (brief: string, legs: DriveObjective['legs'], timeLimit = 100): DriveObjective => ({ brief, legs, timeLimit });

export const CHALLENGES: Challenge[] = [
  {
    id: 'c.math', subject: 'math', character: 'kai', title: 'Coastal Time Trial', summary: 'One timed run, then new numbers: speed, pace and percentages in situations you have never seen.',
    concepts: ['math.speed', 'math.pace', 'math.percent'],
    objective: {
      easy: obj('Drive the 600 m time-trial section at 100 to 190 km/h on average.', [sec({ id: 'tt', label: 'Time trial', from: 1250, to: 1850, minAvgKmh: 100, maxAvgKmh: 190 })]),
      medium: obj('Drive the 600 m time-trial section at 130 to 180 km/h on average.', [sec({ id: 'tt', label: 'Time trial', from: 1250, to: 1850, minAvgKmh: 130, maxAvgKmh: 180 })]),
      hard: obj('Drive the 600 m time-trial section at 150 to 175 km/h on average without a hazard hit.', [sec({ id: 'tt', label: 'Time trial', from: 1250, to: 1850, minAvgKmh: 150, maxAvgKmh: 175, noHits: true })]),
    },
  },
  {
    id: 'c.science', subject: 'science', character: 'lina', title: 'Energy Run', summary: 'Hit a speed gate, climb the cliff road, then explain it with friction, energy and height in fresh scenarios.',
    concepts: ['sci.friction', 'sci.energy', 'sci.potential'],
    objective: {
      easy: obj('Pass the gate at 100 to 160 km/h, then climb the cliff road at 90 km/h or more on average.', [gate({ id: 'gate', label: 'Speed gate', at: 1350, minKmh: 100, maxKmh: 160 }), sec({ id: 'climb', label: 'Cliff climb', from: 1700, to: 1950, minAvgKmh: 90 })]),
      medium: obj('Pass the gate at 120 to 160 km/h, then climb the cliff road at 120 km/h or more on average.', [gate({ id: 'gate', label: 'Speed gate', at: 1350, minKmh: 120, maxKmh: 160 }), sec({ id: 'climb', label: 'Cliff climb', from: 1700, to: 1950, minAvgKmh: 120 })]),
      hard: obj('Pass the gate at 130 to 150 km/h, then climb the cliff road at 140 km/h or more without a hazard hit.', [gate({ id: 'gate', label: 'Speed gate', at: 1350, minKmh: 130, maxKmh: 150 }), sec({ id: 'climb', label: 'Cliff climb', from: 1700, to: 1950, minAvgKmh: 140, noHits: true })]),
    },
  },
  {
    id: 'c.road', subject: 'road', character: 'omar', title: 'Safe Driver Challenge', summary: 'Two limit zones with a cone hazard in between, then new stopping, limit and hazard scenarios.',
    concepts: ['road.stopping', 'road.limits', 'road.hazards'],
    objective: {
      easy: obj('Keep to 150 km/h then 120 km/h in two 200 m zones. No hazard hits.', [sec({ id: 'za', label: 'First zone (150 km/h)', from: 1400, to: 1600, limitKmh: 150, overAllowSec: 3, noHits: true }), sec({ id: 'zb', label: 'Second zone (120 km/h)', from: 1600, to: 1800, limitKmh: 120, overAllowSec: 3, noHits: true })]),
      medium: obj('Keep to 120 km/h then 90 km/h in two 200 m zones. No hazard hits.', [sec({ id: 'za', label: 'First zone (120 km/h)', from: 1400, to: 1600, limitKmh: 120, overAllowSec: 1.5, noHits: true }), sec({ id: 'zb', label: 'Second zone (90 km/h)', from: 1600, to: 1800, limitKmh: 90, overAllowSec: 1.5, noHits: true })]),
      hard: obj('Keep to 100 km/h then 70 km/h in two 200 m zones. No hazard hits.', [sec({ id: 'za', label: 'First zone (100 km/h)', from: 1400, to: 1600, limitKmh: 100, overAllowSec: 0.6, noHits: true }), sec({ id: 'zb', label: 'Second zone (70 km/h)', from: 1600, to: 1800, limitKmh: 70, overAllowSec: 0.6, noHits: true })]),
    },
  },
];
export const challengeById = (id: string): Challenge | undefined => CHALLENGES.find(c => c.id === id);
