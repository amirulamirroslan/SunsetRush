import { choiceQuestion, fmt, numericQuestion } from '../assessment';
import { CHALLENGES } from './labs';
import { G, KMH, m } from './qhelp';
import type { ConceptId, DriveResult, LearningDifficulty, Question } from '../types';

/**
 * Mastery questions. Each concept has two fresh scenarios (v0, v1) that no mission uses, in a new setting. A concept can only be
 * mastered by answering one of them correctly for the first time, so a second try gets a different scenario.
 */
type Spec = { stem: string; answer?: number; unit?: string; rel?: number; floor?: number; right?: string; wrong?: string[]; explanation: string; hint?: string; formula?: string };
type Row = Record<LearningDifficulty, Spec>;
type Gen = (r: DriveResult) => Row;

const build = (concept: ConceptId, scenarioId: string, id: string, s: Spec): Question => {
  const base = { id, scenarioId, concept, transfer: true, stem: s.stem, explanation: s.explanation, hint: s.hint, formula: s.formula };
  if (s.right !== undefined) return choiceQuestion({ ...base, right: s.right, wrong: s.wrong ?? [] });
  return numericQuestion({ ...base, answer: s.answer ?? 0, unit: s.unit, rel: s.rel, floor: s.floor });
};

const GENS: Record<ConceptId, [Gen, Gen]> = {
  'math.speed': [
    () => ({
      easy: { stem: `A cyclist rides 1.2 km in 4 minutes. What is the speed in km/h?`, right: '18 km/h', wrong: ['4.8 km/h', '300 km/h', '30 km/h'], hint: '4 minutes is 1/15 of an hour.', explanation: '1.2 km ÷ (4 ÷ 60 h) = 18 km/h.' },
      medium: { stem: `A cyclist rides 1.2 km in 4 minutes. What is the speed in km/h?`, answer: 18, unit: 'km/h', hint: 'Convert minutes to hours first.', explanation: '4 min = 1/15 h, and 1.2 ÷ (1/15) = 18 km/h.' },
      hard: { stem: `A road is covered in two equal halves, the first at 60 km/h and the second at 90 km/h. What is the average speed over the whole road? (km/h)`, answer: 72, unit: 'km/h', rel: 0.01, hint: 'Take a 180 km road: find the time for each half.', formula: 'v̄ = total distance ÷ total time', explanation: 'For 180 km: 90 km at 60 km/h takes 1.5 h and 90 km at 90 km/h takes 1 h. 180 ÷ 2.5 = 72 km/h.' } }),
    () => ({
      easy: { stem: 'A train covers 150 km in 2 hours. What is its average speed?', right: '75 km/h', wrong: ['300 km/h', '152 km/h', '48 km/h'], hint: 'Distance ÷ time.', explanation: '150 ÷ 2 = 75 km/h.' },
      medium: { stem: 'A boat travels 45 km in 90 minutes. What is its average speed in km/h?', answer: 30, unit: 'km/h', hint: '90 minutes = 1.5 hours.', explanation: '45 ÷ 1.5 = 30 km/h.' },
      hard: { stem: 'A runner covers 400 m in 50 s, then 600 m in 100 s. What is the average speed over the whole 1,000 m in m/s?', answer: 1000 / 150, unit: 'm/s', rel: 0.01, hint: 'Add both distances and both times.', explanation: '1,000 ÷ 150 = 6.67 m/s.' } }),
  ],
  'math.pace': [
    () => ({
      easy: { stem: 'Three laps took 61 s, 59 s and 63 s. What was the mean lap time?', right: '61 s', wrong: ['59 s', '63 s', '183 s'], hint: 'Add them and divide by 3.', explanation: '(61 + 59 + 63) ÷ 3 = 61 s.' },
      medium: { stem: 'Four laps took 62.5 s, 60.5 s, 61.0 s and 60.0 s. What was the mean lap time in seconds?', answer: 61, unit: 's', hint: 'Total ÷ 4.', explanation: '(62.5 + 60.5 + 61.0 + 60.0) ÷ 4 = 244 ÷ 4 = 61 s.' },
      hard: { stem: 'A driver improves a 90 s lap to 80 s over the same distance. By what percentage did the average speed increase?', answer: (90 / 80 - 1) * 100, unit: '%', rel: 0.03, hint: 'Old time ÷ new time − 1.', formula: 'gain% = (tₐ ÷ t_b − 1) × 100', explanation: '90 ÷ 80 = 1.125, so a 12.5% increase.' } }),
    r => { const t = m(r, 'tt', 'time', 5); return {
      easy: { stem: `Your time-trial run took ${fmt(t, 2)} s. A friend took ${fmt(t + 1.5, 2)} s. Who was faster, and by how many seconds?`, right: `You, by 1.5 s`, wrong: ['Your friend, by 1.5 s', `You, by ${fmt(t + 1.5, 2)} s`, 'Nobody'], hint: 'Smaller time wins; subtract.', explanation: 'The smaller time is faster. The difference is 1.5 s.' },
      medium: { stem: `Your run took ${fmt(t, 2)} s. Your next run took ${fmt(t - 0.5, 2)} s. What was the mean of the two runs in seconds?`, answer: t - 0.25, unit: 's', floor: 0.03, hint: 'Add and divide by 2.', explanation: `(${fmt(t, 2)} + ${fmt(t - 0.5, 2)}) ÷ 2 = ${fmt(t - 0.25, 2)} s.` },
      hard: { stem: `Your run took ${fmt(t, 2)} s. If a rival's average speed over the same 600 m was 8% higher, what was the rival's time in seconds?`, answer: t / 1.08, unit: 's', rel: 0.015, floor: 0.04, hint: 'Higher speed means time ÷ 1.08.', explanation: `${fmt(t, 2)} ÷ 1.08 = ${fmt(t / 1.08, 2)} s.` } }; },
  ],
  'math.percent': [
    () => ({
      easy: { stem: 'A 60-litre fuel tank is 50% full. How many litres are in it?', right: '30 litres', wrong: ['50 litres', '60 litres', '10 litres'], hint: '50% is half.', explanation: 'Half of 60 is 30.' },
      medium: { stem: 'A 80-litre tank is 35% full. How many litres of fuel are in it?', answer: 28, unit: 'litres', hint: '80 × 35 ÷ 100.', formula: 'part = total × p ÷ 100', explanation: '80 × 0.35 = 28 litres.' },
      hard: { stem: 'A battery is at 20% and charges to 80%. By what percentage did the charge increase relative to where it started?', answer: 300, unit: '%', hint: '(new − old) ÷ old × 100.', formula: 'change % = (new − old) ÷ old × 100', explanation: '(80 − 20) ÷ 20 = 3, so a 300% increase.' } }),
    () => ({
      easy: { stem: 'A gauge went from 25% to 75%. How many percentage points did it gain?', right: '50 points', wrong: ['75 points', '25 points', '100 points'], hint: 'Subtract.', explanation: '75 − 25 = 50 points.' },
      medium: { stem: 'A 150-unit tank holds 105 units. What percentage is full?', answer: 70, unit: '%', hint: 'part ÷ total × 100.', explanation: '105 ÷ 150 = 0.7, so 70%.' },
      hard: { stem: 'A meter drops from 80% to 60%. By what percentage did it decrease relative to its starting value?', answer: 25, unit: '%', hint: '(old − new) ÷ old × 100.', explanation: '(80 − 60) ÷ 80 = 0.25, so 25%.' } }),
  ],
  'sci.friction': [
    () => ({
      easy: { stem: 'On which surface does a car need the longest distance to stop?', right: 'Ice', wrong: ['Dry asphalt', 'Dry concrete', 'Racing tarmac'], hint: 'Lowest grip.', explanation: 'Ice has the lowest friction, so the braking distance is longest.' },
      medium: { stem: 'A 1,000 kg car sits on gravel (μ = 0.35). What is the greatest friction force in newtons? (g = 9.8)', answer: 0.35 * 1000 * G, unit: 'N', rel: 0.01, hint: 'F = μ m g.', formula: 'F = μ × m × g', explanation: `0.35 × 1,000 × 9.8 = ${fmt(0.35 * 1000 * G, 0)} N.` },
      hard: { stem: 'A car brakes from 72 km/h (20 m/s) on dry asphalt (μ = 0.8). What is its braking distance in metres?', answer: 400 / (2 * 0.8 * G), unit: 'm', rel: 0.02, hint: 'd = v² ÷ (2 μ g).', formula: 'd = v² ÷ (2 μ g)', explanation: `400 ÷ (2 × 0.8 × 9.8) = ${fmt(400 / (2 * 0.8 * G), 1)} m.` } }),
    () => ({
      easy: { stem: 'Why do tyres leave marks when a car skids?', right: 'Friction heats and wears the rubber as it slides', wrong: ['Gravity pulls rubber off', 'Magnets in the road', 'The wind blows it off'], hint: 'Think of rubbing your hands together.', explanation: 'Sliding friction produces heat and wear, leaving rubber on the road.' },
      medium: { stem: 'What is the largest deceleration friction can give on ice (μ = 0.15)? Use g = 9.8 m/s².', answer: 0.15 * G, unit: 'm/s²', rel: 0.01, hint: 'a = μ g.', formula: 'a = μ × g', explanation: `0.15 × 9.8 = ${fmt(0.15 * G, 2)} m/s².` },
      hard: { stem: 'A car needs 30 m to stop from a given speed on dry asphalt (μ = 0.8). How far does it need from the same speed on wet asphalt (μ = 0.5)? (metres)', answer: 30 * 0.8 / 0.5, unit: 'm', rel: 0.02, hint: 'Distance ∝ 1/μ.', explanation: '30 × (0.8 ÷ 0.5) = 48 m.' } }),
  ],
  'sci.energy': [
    () => ({
      easy: { stem: 'A cyclist speeds up from 10 km/h to 30 km/h. How many times larger is their energy of motion?', right: '9 times', wrong: ['3 times', '6 times', '30 times'], hint: 'Speed is tripled: 3 × 3.', explanation: 'Energy ∝ v², so 3² = 9.' },
      medium: { stem: 'A 1,000 kg car moves at 25 m/s. What is its kinetic energy in kilojoules?', answer: 0.5 * 1000 * 625 / 1000, unit: 'kJ', rel: 0.01, hint: '½ m v².', formula: 'KE = ½ m v²', explanation: '½ × 1,000 × 25² = 312,500 J = 312.5 kJ.' },
      hard: { stem: 'A car travelling at 15 m/s speeds up to 30 m/s. By what factor does its kinetic energy increase?', answer: 4, unit: '×', rel: 0.01, hint: '(30 ÷ 15)².', formula: 'KE₂ ÷ KE₁ = (v₂ ÷ v₁)²', explanation: '(30 ÷ 15)² = 4.' } }),
    () => ({
      easy: { stem: 'Two identical cars drive at 40 km/h and 80 km/h. Which one carries more energy?', right: 'The 80 km/h car, and by far more than double', wrong: ['The 40 km/h car', 'Exactly the same', 'The 80 km/h car, by exactly double'], hint: 'Energy goes with speed squared.', explanation: 'Doubling the speed makes the energy four times bigger, not just double.' },
      medium: { stem: 'A 60 kg cyclist rides at 10 m/s. What is their kinetic energy in joules?', answer: 3000, unit: 'J', rel: 0.01, hint: '½ × 60 × 10².', formula: 'KE = ½ m v²', explanation: '½ × 60 × 100 = 3,000 J.' },
      hard: { stem: 'A 1,200 kg car speeds up from 20 m/s to 30 m/s. How much extra kinetic energy does it need, in kilojoules?', answer: 0.5 * 1200 * (900 - 400) / 1000, unit: 'kJ', rel: 0.01, hint: '½ m (v₂² − v₁²).', formula: 'ΔKE = ½ m (v₂² − v₁²)', explanation: '½ × 1,200 × (900 − 400) = 300,000 J = 300 kJ.' } }),
  ],
  'sci.potential': [
    r => { const dy = m(r, 'climb', 'dy', 6.8); return {
      easy: { stem: 'A hill is 20 m high. Which would store more energy at the top: a bicycle or a truck?', right: 'The truck, because it is heavier', wrong: ['The bicycle', 'They store the same', 'Neither stores energy'], hint: 'Energy grows with mass.', explanation: 'PE = m g h grows with mass and with height.' },
      medium: { stem: 'A 900 kg car is driven up a 12 m hill. How much potential energy does it gain, in kilojoules? (g = 9.8)', answer: 900 * G * 12 / 1000, unit: 'kJ', rel: 0.01, hint: 'm g h ÷ 1000.', formula: 'PE = m g h', explanation: `900 × 9.8 × 12 = ${fmt(900 * G * 12, 0)} J = ${fmt(900 * G * 12 / 1000, 1)} kJ.` },
      hard: { stem: `Your climb gained ${fmt(dy, 1)} m. How many metres must a 900 kg car rise to store twice as much energy as it did over that climb?`, answer: dy * 2, unit: 'm', rel: 0.02, floor: 0.1, hint: 'PE doubles when height doubles.', explanation: `PE ∝ h, so ${fmt(dy, 1)} × 2 = ${fmt(dy * 2, 1)} m.` } }; },
    () => ({
      easy: { stem: 'A ball rolls down a hill. What happens to its stored height energy?', right: 'It turns into energy of motion', wrong: ['It disappears', 'It turns into height', 'It stays exactly the same'], hint: 'The ball speeds up.', explanation: 'Potential energy becomes kinetic energy as the ball rolls down.' },
      medium: { stem: 'How high must a 500 kg object be lifted to store 49 kJ? (g = 9.8, answer in metres)', answer: 49000 / (500 * G), unit: 'm', rel: 0.02, hint: 'h = PE ÷ (m g).', formula: 'h = PE ÷ (m g)', explanation: '49,000 ÷ (500 × 9.8) = 10 m.' },
      hard: { stem: 'A car coasting at 20 m/s rolls up a frictionless hill. How high does it get? (g = 9.8, answer in metres)', answer: 400 / (2 * G), unit: 'm', rel: 0.02, hint: 'h = v² ÷ (2 g).', formula: 'h = v² ÷ (2 g)', explanation: `400 ÷ 19.6 = ${fmt(400 / (2 * G), 1)} m.` } }),
  ],
  'road.stopping': [
    () => ({
      easy: { stem: 'Which two things add up to the total stopping distance?', right: 'Reaction distance and braking distance', wrong: ['Braking distance and engine power', 'Reaction time and fuel', 'Speed and tyre size'], hint: 'Before and after the brakes.', explanation: 'Total stopping distance = reaction distance + braking distance.' },
      medium: { stem: 'A driver travelling at 90 km/h (25 m/s) has a reaction time of 0.8 s. How far does the car go before braking starts? (metres)', answer: 20, unit: 'm', hint: 'Speed × time.', formula: 'd_react = v × t', explanation: '25 × 0.8 = 20 m.' },
      hard: { stem: 'A car at 72 km/h (20 m/s) has a 1.0 s reaction and brakes at 6 m/s². What is the total stopping distance in metres?', answer: 20 + 400 / 12, unit: 'm', rel: 0.02, hint: 'Reaction distance plus v² ÷ (2a).', formula: 'd = v t + v² ÷ (2a)', explanation: `20 + 400 ÷ 12 = ${fmt(20 + 400 / 12, 1)} m.` } }),
    () => ({
      easy: { stem: 'A driver is tired and slow to react. What gets longer?', right: 'The reaction distance', wrong: ['The braking force', 'The tyre grip', 'The speed limit'], hint: 'The car keeps moving while they react.', explanation: 'A longer reaction time means a longer reaction distance.' },
      medium: { stem: 'At 54 km/h (15 m/s), how far does a car travel in a 1.2 s reaction time? (metres)', answer: 18, unit: 'm', hint: '15 × 1.2.', explanation: '15 × 1.2 = 18 m.' },
      hard: { stem: 'A car at 30 m/s brakes at 7.5 m/s² after a 0.8 s reaction. What is the total stopping distance in metres?', answer: 24 + 900 / 15, unit: 'm', rel: 0.02, hint: 'v t + v² ÷ (2a).', formula: 'd = v t + v² ÷ (2a)', explanation: '24 + 900 ÷ 15 = 84 m.' } }),
  ],
  'road.limits': [
    () => ({
      easy: { stem: 'Doubling your speed makes your braking distance…', right: 'Four times longer', wrong: ['Twice as long', 'The same', 'Half as long'], hint: 'Speed squared.', explanation: 'Braking distance ∝ v². 2² = 4.' },
      medium: { stem: 'A car needs 12 m to brake from 30 km/h. How far does it need from 90 km/h? (metres)', answer: 108, unit: 'm', hint: '(90 ÷ 30)² = 9.', formula: 'd₂ = d₁ × (v₂ ÷ v₁)²', explanation: '12 × 9 = 108 m.' },
      hard: { stem: 'A driver goes 20% over the limit. By what percentage is their braking distance longer than at the limit?', answer: 44, unit: '%', hint: '1.2² − 1.', explanation: '1.2² = 1.44, so 44% longer.' } }),
    () => ({
      easy: { stem: 'Which is the main reason limits are lower on busy streets?', right: 'Slower cars can stop in a shorter distance', wrong: ['Slower cars use less fuel only', 'Roads are narrower, so cars shrink', 'Tyres are different'], hint: 'Think about people and stopping.', explanation: 'Shorter stopping distances give more time and space to avoid collisions.' },
      medium: { stem: 'A car brakes in 20 m from 50 km/h. How far does it brake from 75 km/h? (metres)', answer: 45, unit: 'm', hint: '(75 ÷ 50)² = 2.25.', explanation: '20 × 2.25 = 45 m.' },
      hard: { stem: 'A driver reduces speed from 100 km/h to 80 km/h. By what percentage does braking distance fall?', answer: 36, unit: '%', hint: '1 − (80 ÷ 100)².', explanation: '0.8² = 0.64, so braking distance falls by 36%.' } }),
  ],
  'road.hazards': [
    () => ({
      easy: { stem: 'How many metres is a 3-second gap at 20 m/s?', right: '60 m', wrong: ['23 m', '20 m', '6.7 m'], hint: 'Speed × 3.', explanation: '20 × 3 = 60 m.' },
      medium: { stem: 'How many metres is a 3-second gap at 108 km/h? (metres)', answer: 90, unit: 'm', hint: '108 km/h = 30 m/s.', formula: 'gap = v × 3', explanation: '108 ÷ 3.6 = 30 m/s. 30 × 3 = 90 m.' },
      hard: { stem: 'A car follows 36 m behind another at 72 km/h. What is the gap in seconds?', answer: 1.8, unit: 's', rel: 0.02, hint: 'Gap time = distance ÷ speed.', formula: 't = d ÷ v', explanation: '72 km/h = 20 m/s. 36 ÷ 20 = 1.8 s.' } }),
    () => ({
      easy: { stem: 'Why should a driver look far ahead?', right: 'To spot hazards early and have time to react', wrong: ['To drive faster', 'To avoid using mirrors', 'To save fuel only'], hint: 'More warning, more time.', explanation: 'Seeing hazards early leaves time to slow down and steer.' },
      medium: { stem: 'You travel at 15 m/s. How many metres is a 2-second gap?', answer: 30, unit: 'm', hint: '15 × 2.', explanation: '15 × 2 = 30 m.' },
      hard: { stem: 'At 90 km/h a driver wants a 3-second gap. How many extra metres of gap are needed if the speed rises to 126 km/h?', answer: (126 - 90) / KMH * 3, unit: 'm', rel: 0.02, hint: 'Find the difference in speed (m/s) and multiply by 3.', explanation: '36 km/h = 10 m/s. 10 × 3 = 30 m extra.' } }),
  ],
};

/** Number of fresh scenarios available per concept. */
export const TRANSFER_SCENARIOS = 2;

export const transferScenarioId = (concept: ConceptId, variant: number): string => `x.${concept}.v${variant}`;

/** The fresh question for `concept` on its `variant`-th scenario, in the player's chosen learning difficulty. */
export function transferQuestion(concept: ConceptId, variant: number, diff: LearningDifficulty, r: DriveResult): Question {
  const v = Math.max(0, Math.min(TRANSFER_SCENARIOS - 1, variant));
  const spec = GENS[concept][v](r)[diff];
  return build(concept, transferScenarioId(concept, v), `x.${concept}.v${v}.${diff[0]}`, spec);
}
void CHALLENGES;
