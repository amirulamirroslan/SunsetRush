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
  'auto.gearing': [
    () => ({
      easy: { stem: 'A bicycle wheel turns 5 times a second and each turn moves the bike 2 m. How fast is the bike going?', right: '10 m/s', wrong: ['2.5 m/s', '7 m/s', '0.4 m/s'], hint: 'Turns per second × metres per turn.', explanation: '5 × 2 = 10 m/s.' },
      medium: { stem: 'A train wheel with a circumference of 3.0 m turns 8 times a second. What is the speed in km/h?', answer: 8 * 3 * 3.6, unit: 'km/h', rel: 0.01, hint: '8 × 3 gives m/s.', formula: 'v = turns per second × circumference', explanation: `8 × 3.0 = 24 m/s = ${fmt(8 * 3 * 3.6, 1)} km/h.` },
      hard: { stem: 'A truck has 3.0 m wheels and a total gear ratio of 5.0 : 1. The engine turns at 2,400 rpm. What is the truck\'s speed in km/h?', answer: 2400 / 5 * 3 / 60 * 3.6, unit: 'km/h', rel: 0.015, hint: 'Wheel rpm = engine rpm ÷ ratio.', formula: 'v = (engine rpm ÷ ratio) × C ÷ 60', explanation: `Wheel rpm = 2,400 ÷ 5 = 480. Speed = 480 × 3 ÷ 60 = 24 m/s = ${fmt(2400 / 5 * 3 / 60 * 3.6, 1)} km/h.` } }),
    () => ({
      easy: { stem: 'An engine turns 3,000 times a minute and the gear ratio is 3 : 1. How many times a minute do the wheels turn?', right: '1,000 times', wrong: ['9,000 times', '3,000 times', '300 times'], hint: 'The wheels turn slower than the engine.', explanation: '3,000 ÷ 3 = 1,000.' },
      medium: { stem: 'An engine runs at 4,500 rpm with a total ratio of 4.5 : 1. How many revolutions per minute do the wheels make?', answer: 1000, unit: 'rpm', hint: 'Divide by the ratio.', formula: 'wheel rpm = engine rpm ÷ ratio', explanation: '4,500 ÷ 4.5 = 1,000 rpm.' },
      hard: { stem: 'A car with 1.8 m wheels does 90 km/h with the engine at 3,000 rpm. What is the total ratio?', answer: 3000 / (25 / 1.8 * 60), unit: ': 1', rel: 0.02, hint: 'Find the wheel rpm first.', formula: 'ratio = engine rpm ÷ wheel rpm', explanation: `90 km/h = 25 m/s. Wheel rpm = 25 ÷ 1.8 × 60 = 833.3. Ratio = 3,000 ÷ 833.3 = ${fmt(3000 / (25 / 1.8 * 60), 2)}.` } }),
  ],
  'auto.aero': [
    () => ({
      easy: { stem: 'A cyclist doubles their speed from 10 km/h to 20 km/h. The air drag on them becomes…', right: 'Four times bigger', wrong: ['Twice as big', 'The same', 'Eight times bigger'], hint: 'Speed squared.', explanation: 'Drag ∝ v², so doubling the speed gives four times the drag.' },
      medium: { stem: 'The drag on a car is 200 N at 15 m/s. What is the drag at 30 m/s, in newtons?', answer: 800, unit: 'N', hint: '(30 ÷ 15)² = 4.', formula: 'F₂ = F₁ × (v₂ ÷ v₁)²', explanation: '200 × 4 = 800 N.' },
      hard: { stem: 'A lorry has Cd = 0.6, frontal area 8 m² and air density 1.2 kg/m³. What is the drag at 25 m/s, in kilonewtons?', answer: 0.5 * 1.2 * 0.6 * 8 * 625 / 1000, unit: 'kN', rel: 0.02, hint: '½ ρ Cd A v², then ÷ 1,000.', formula: 'F = ½ ρ Cd A v²', explanation: '0.5 × 1.2 × 0.6 × 8 × 25² = 1,800 N = 1.8 kN.' } }),
    () => ({
      easy: { stem: 'Which shape has the least air drag?', right: 'A low, smooth, pointed shape', wrong: ['A tall, flat-fronted box', 'A wide open frame', 'A shape with a big flat roof rack'], hint: 'Think of a fish or a bullet train.', explanation: 'Smooth, pointed shapes let air slip past, so they have a lower drag coefficient.' },
      medium: { stem: 'A cyclist feels a drag of 30 N at 6 m/s. How much power does it take to overcome it, in watts?', answer: 180, unit: 'W', hint: 'Power = force × speed.', formula: 'P = F × v', explanation: '30 × 6 = 180 W.' },
      hard: { stem: 'A car needs 15 kW to beat the air at 100 km/h. How many kW does it need at 130 km/h?', answer: 15 * 1.3 ** 3, unit: 'kW', rel: 0.02, hint: 'Power goes with speed cubed.', formula: 'P₂ = P₁ × (v₂ ÷ v₁)³', explanation: `15 × 1.3³ = 15 × 2.197 = ${fmt(15 * 1.3 ** 3, 1)} kW.` } }),
  ],
  'auto.brakes': [
    () => ({
      easy: { stem: 'A bicycle and a heavy truck move at the same speed. Which has more energy of motion to turn into heat when it stops?', right: 'The truck, because it has more mass', wrong: ['The bicycle', 'They have the same', 'Neither has any'], hint: 'Energy grows with mass.', explanation: 'KE = ½ m v², so at the same speed the heavier vehicle carries more.' },
      medium: { stem: 'A 1,500 kg car stops from 20 m/s. How much heat is made in the brakes, in kilojoules?', answer: 300, unit: 'kJ', hint: '½ × 1,500 × 20².', formula: 'KE = ½ m v²', explanation: '½ × 1,500 × 400 = 300,000 J = 300 kJ.' },
      hard: { stem: 'A 1,500 kg car stops from 108 km/h. How much heat is made in the brakes, in kilojoules?', answer: 675, unit: 'kJ', rel: 0.01, hint: '108 km/h = 30 m/s.', formula: 'KE = ½ m v²', explanation: '108 ÷ 3.6 = 30 m/s. ½ × 1,500 × 900 = 675,000 J = 675 kJ.' } }),
    () => ({
      easy: { stem: 'On a long downhill the brakes get so hot that they work badly. Why does this happen?', right: 'The brakes keep turning motion into heat faster than they can cool', wrong: ['The tyres get heavier', 'The engine pushes back', 'Gravity switches off'], hint: 'Think about what braking produces.', explanation: 'Braking turns energy into heat. If it builds up faster than the air carries it away, the brakes overheat and fade.' },
      medium: { stem: 'The same 1,500 kg car now stops from 10 m/s. How much heat is made, in kilojoules?', answer: 75, unit: 'kJ', hint: '½ × 1,500 × 10².', formula: 'KE = ½ m v²', explanation: '½ × 1,500 × 100 = 75,000 J = 75 kJ. Half the speed gives a quarter of the heat.' },
      hard: { stem: 'A 5 kg brake disc (c = 500 J/kg°C) absorbs 200 kJ of heat. By how many °C does it warm?', answer: 200000 / (5 * 500), unit: '°C', rel: 0.02, hint: 'ΔT = Q ÷ (m c).', formula: 'ΔT = Q ÷ (m c)', explanation: '200,000 ÷ (5 × 500) = 80 °C.' } }),
  ],
  'geo.slope': [
    () => ({
      easy: { stem: 'Which road is steeper: one that rises 10 m over 100 m or one that rises 5 m over 100 m?', right: 'The one that rises 10 m', wrong: ['The one that rises 5 m', 'They are the same', 'You cannot tell'], hint: 'Same run, so compare the rise.', explanation: 'With the same run, the bigger rise is steeper: 10% against 5%.' },
      medium: { stem: 'A track rises 45 m over a horizontal distance of 900 m. What is its gradient as a percentage?', answer: 5, unit: '%', hint: '45 ÷ 900 × 100.', formula: 'gradient % = rise ÷ run × 100', explanation: '45 ÷ 900 = 0.05, so 5%.' },
      hard: { stem: 'A cyclist climbs a 7% road for 2.5 km. How many metres does the road rise?', answer: 175, unit: 'm', hint: '7% of 2,500 m.', formula: 'rise = gradient % × run ÷ 100', explanation: '7 × 2,500 ÷ 100 = 175 m.' } }),
    () => ({
      easy: { stem: 'A road has a gradient of 20%. For every 100 m forward it…', right: 'Rises 20 m', wrong: ['Rises 2 m', 'Rises 200 m', 'Rises 5 m'], hint: 'Percent means per hundred.', explanation: '20% means 20 m of rise for every 100 m of run.' },
      medium: { stem: 'A ramp rises 1.2 m over a run of 10 m. What is its gradient as a percentage?', answer: 12, unit: '%', hint: '1.2 ÷ 10 × 100.', formula: 'gradient % = rise ÷ run × 100', explanation: '1.2 ÷ 10 = 0.12, so 12%.' },
      hard: { stem: 'A mountain railway rises 800 m over 12 km of horizontal distance. What is its average gradient as a percentage?', answer: 800 / 12000 * 100, unit: '%', rel: 0.02, hint: 'Both distances in metres: 12 km = 12,000 m.', formula: 'gradient % = rise ÷ run × 100', explanation: `800 ÷ 12,000 × 100 = ${fmt(800 / 120, 2)}%.` } }),
  ],
  'geo.scale': [
    () => ({
      easy: { stem: 'On a 1 : 1,000 map, 1 cm stands for how far on the ground?', right: '10 m', wrong: ['1 m', '100 m', '1,000 m'], hint: '1,000 cm is how many metres?', explanation: '1 cm → 1,000 cm = 10 m.' },
      medium: { stem: 'Two towns are 8 cm apart on a 1 : 50,000 map. What is the real distance in kilometres?', answer: 4, unit: 'km', hint: '8 × 50,000 = 400,000 cm.', formula: 'real cm = map cm × scale', explanation: '8 × 50,000 = 400,000 cm = 4 km.' },
      hard: { stem: 'A 3 km beach is drawn on a 1 : 25,000 map. How many centimetres long is it on the map?', answer: 12, unit: 'cm', hint: '3 km = 300,000 cm. Divide by 25,000.', formula: 'map cm = real cm ÷ scale', explanation: '300,000 ÷ 25,000 = 12 cm.' } }),
    () => ({
      easy: { stem: 'Which map scale shows the most detail?', right: '1 : 5,000', wrong: ['1 : 50,000', '1 : 500,000', '1 : 5,000,000'], hint: 'Smaller scale number, less shrinking.', explanation: 'A smaller scale number shrinks the world less, so there is room for more detail.' },
      medium: { stem: 'A path is 12 km long. How many centimetres long is it on a 1 : 100,000 map?', answer: 12, unit: 'cm', hint: '12 km = 1,200,000 cm.', formula: 'map cm = real cm ÷ scale', explanation: '1,200,000 ÷ 100,000 = 12 cm.' },
      hard: { stem: 'A line of 5 cm on a map stands for 2.5 km on the ground. What is the scale number N in 1 : N?', answer: 50000, unit: '', hint: '2.5 km = 250,000 cm. Divide by 5.', formula: 'scale = real cm ÷ map cm', explanation: '250,000 ÷ 5 = 50,000, so the scale is 1 : 50,000.' } }),
  ],
  'geo.carbon': [
    () => ({
      easy: { stem: 'A full 50-litre tank of petrol is burned. About how much CO₂ does that release?', right: '115 kg', wrong: ['11.5 kg', '52 kg', '21.7 kg'], hint: 'Litres × 2.3.', explanation: '50 × 2.3 = 115 kg.' },
      medium: { stem: 'A car uses 7.5 litres per 100 km. How much fuel does a 240 km trip need, in litres?', answer: 18, unit: 'litres', hint: '240 ÷ 100 × 7.5.', formula: 'litres = km ÷ 100 × L/100 km', explanation: '240 ÷ 100 × 7.5 = 18 litres.' },
      hard: { stem: 'A 100 km trip is made by one car using 6.0 L/100 km and another using 8.5 L/100 km. How many more kg of CO₂ does the second release? (2.3 kg per litre)', answer: 2.5 * 2.3, unit: 'kg', rel: 0.02, hint: 'Fuel difference first.', explanation: 'The second burns 2.5 litres more. 2.5 × 2.3 = 5.75 kg.' } }),
    () => ({
      easy: { stem: 'Which habit lowers a car\'s fuel use the most on a long trip?', right: 'Smooth, steady driving at a moderate speed', wrong: ['Hard acceleration between bends', 'Driving as fast as possible', 'Carrying extra heavy luggage'], hint: 'Think about drag and wasted braking.', explanation: 'Steady, moderate speed cuts drag and avoids wasting energy as heat in the brakes.' },
      medium: { stem: 'A car emits 120 g of CO₂ per km. How many kg does a 350 km trip release?', answer: 42, unit: 'kg', hint: '120 × 350 ÷ 1,000.', formula: 'kg = g/km × km ÷ 1,000', explanation: '120 × 350 = 42,000 g = 42 kg.' },
      hard: { stem: 'A car uses 6.0 L/100 km. How many grams of CO₂ does it release per kilometre? (2.3 kg per litre)', answer: 138, unit: 'g/km', rel: 0.02, hint: 'Litres per km × 2,300 g.', formula: 'g/km = L/100 km × 23', explanation: '6.0 × 23 = 138 g/km.' } }),
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
