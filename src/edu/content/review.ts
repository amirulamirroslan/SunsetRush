import { choiceQuestion, fmt, numericQuestion } from '../assessment';
import type { ConceptId, LearningDifficulty, Question } from '../types';
import { G } from './qhelp';

/**
 * Spaced-review questions ("Refresh"). Each concept has a generator that turns a small integer `k` into a fresh, deterministic set of
 * numbers, so repeated refreshes never show the same question twice in a row and nothing here is random. These questions use scenario
 * ids of their own (`rv.<concept>`), so they never use up the fresh scenarios that the mastery challenges rely on.
 */
type Spec = { stem: string; answer?: number; unit?: string; rel?: number; floor?: number; right?: string; wrong?: string[]; explanation: string; hint?: string; formula?: string };
type Row = Record<LearningDifficulty, Spec>;
const pick = <T,>(a: readonly T[], k: number): T => a[k % a.length];
const f = fmt;

const GENS: Record<ConceptId, (k: number) => Row> = {
  'math.speed': k => {
    const [d, t] = pick([[240, 12], [360, 15], [450, 18], [540, 20], [720, 24]] as const, k), v = d / t;
    const [a, b] = pick([[60, 90], [40, 60], [80, 120], [30, 45], [50, 75]] as const, k), h = 2 * a * b / (a + b);
    return {
      easy: { stem: `A car covers ${d} m in ${t} s. What is its speed in m/s?`, right: `${f(v)} m/s`, wrong: [`${f(t / d, 3)} m/s`, `${f(v * 3.6, 0)} m/s`, `${f(d * t, 0)} m/s`], hint: 'Distance ÷ time.', explanation: `${d} ÷ ${t} = ${f(v)} m/s.` },
      medium: { stem: `A car covers ${d} m in ${t} s. What is its average speed in km/h?`, answer: v * 3.6, unit: 'km/h', hint: 'Find m/s first, then multiply by 3.6.', formula: 'km/h = m/s × 3.6', explanation: `${d} ÷ ${t} = ${f(v, 2)} m/s, and × 3.6 = ${f(v * 3.6, 1)} km/h.` },
      hard: { stem: `A road is covered in two equal halves, the first at ${a} km/h and the second at ${b} km/h. What is the average speed over the whole road in km/h?`, answer: h, unit: 'km/h', rel: 0.012, hint: 'Take a distance that divides evenly and add the two times.', formula: 'v̄ = total distance ÷ total time', explanation: `Equal distances take different times. The average is 2ab ÷ (a + b) = ${f(h, 1)} km/h, not the simple mean ${f((a + b) / 2, 1)}.` },
    };
  },
  'math.pace': k => {
    const base = pick([58, 60, 62, 64, 66], k), [o, n] = pick([[90, 80], [84, 70], [75, 60], [72, 60], [96, 80]] as const, k), g = (o / n - 1) * 100;
    return {
      easy: { stem: `Three laps took ${base} s, ${base + 2} s and ${base + 1} s. What was the mean lap time?`, right: `${base + 1} s`, wrong: [`${base} s`, `${base + 2} s`, `${3 * base + 3} s`], hint: 'Add them up, then divide by 3.', explanation: `(${base} + ${base + 2} + ${base + 1}) ÷ 3 = ${base + 1} s.` },
      medium: { stem: `Four laps took ${base} s, ${base + 1} s, ${base + 2} s and ${base + 5} s. What was the mean lap time in seconds?`, answer: base + 2, unit: 's', hint: 'Total ÷ 4.', explanation: `(${4 * base + 8}) ÷ 4 = ${base + 2} s.` },
      hard: { stem: `A driver improves a ${o} s lap to ${n} s over the same distance. By what percentage did the average speed increase?`, answer: g, unit: '%', rel: 0.03, hint: 'Old time ÷ new time − 1.', formula: 'gain % = (old ÷ new − 1) × 100', explanation: `${o} ÷ ${n} = ${f(o / n, 3)}, so the speed rose by ${f(g, 1)}%.` },
    };
  },
  'math.percent': k => {
    const [tot, pc] = pick([[80, 25], [60, 50], [120, 75], [50, 40], [200, 15]] as const, k), part = tot * pc / 100;
    const [oldP, newP] = pick([[20, 50], [40, 60], [80, 100], [25, 40], [60, 75]] as const, k), ch = (newP - oldP) / oldP * 100;
    return {
      easy: { stem: `A ${tot}-litre tank is ${pc}% full. How many litres are in it?`, right: `${f(part)} litres`, wrong: [`${f(pc)} litres`, `${f(tot - part)} litres`, `${f(tot * pc)} litres`], hint: 'Percent means per hundred.', explanation: `${tot} × ${pc} ÷ 100 = ${f(part)} litres.` },
      medium: { stem: `A ${tot}-litre tank holds ${f(part)} litres. What percentage is full?`, answer: pc, unit: '%', hint: 'part ÷ total × 100.', formula: 'p = part ÷ total × 100', explanation: `${f(part)} ÷ ${tot} × 100 = ${pc}%.` },
      hard: { stem: `A battery charges from ${oldP}% to ${newP}%. By what percentage did the charge increase relative to where it started?`, answer: ch, unit: '%', rel: 0.02, hint: '(new − old) ÷ old × 100.', formula: 'change % = (new − old) ÷ old × 100', explanation: `(${newP} − ${oldP}) ÷ ${oldP} × 100 = ${f(ch, 1)}%.` },
    };
  },
  'sci.friction': k => {
    const [mu, m] = pick([[0.8, 1000], [0.5, 1200], [0.35, 900], [0.15, 1500], [0.7, 800]] as const, k), F = mu * m * G;
    const [kmh, mu2] = pick([[72, 0.8], [90, 0.8], [108, 0.5], [54, 0.8], [36, 0.5]] as const, k), d = (kmh / 3.6) ** 2 / (2 * mu2 * G);
    return {
      easy: { stem: `A ${m} kg car sits on a surface with μ = ${mu}. What is the largest friction force in kilonewtons? (g = 9.8)`, right: `${f(F / 1000, 1)} kN`, wrong: [`${f(F / 1000 / mu, 1)} kN`, `${f(m * G / 1000, 1)} kN`, `${f(F, 0)} kN`], hint: 'F = μ × m × g.', formula: 'F = μ × m × g', explanation: `${mu} × ${m} × 9.8 = ${f(F, 0)} N = ${f(F / 1000, 1)} kN.` },
      medium: { stem: `A ${m} kg car sits on a surface with μ = ${mu}. What is the largest friction force in newtons? (g = 9.8)`, answer: F, unit: 'N', rel: 0.01, hint: 'F = μ × m × g.', formula: 'F = μ × m × g', explanation: `${mu} × ${m} × 9.8 = ${f(F, 0)} N.` },
      hard: { stem: `A car brakes from ${kmh} km/h on a surface with μ = ${mu2}. What is its braking distance in metres? (g = 9.8)`, answer: d, unit: 'm', rel: 0.02, hint: 'Convert to m/s first, then d = v² ÷ (2 μ g).', formula: 'd = v² ÷ (2 μ g)', explanation: `${kmh} km/h = ${f(kmh / 3.6, 1)} m/s. d = ${f((kmh / 3.6) ** 2, 1)} ÷ (2 × ${mu2} × 9.8) = ${f(d, 1)} m.` },
    };
  },
  'sci.energy': k => {
    const [m, v] = pick([[1000, 20], [800, 25], [1200, 10], [900, 30], [1100, 15]] as const, k), KE = 0.5 * m * v * v / 1000;
    const [v1, v2] = pick([[10, 20], [15, 25], [20, 30], [12, 24], [10, 30]] as const, k), x = 0.5 * 1200 * (v2 * v2 - v1 * v1) / 1000, fac = v2 / v1;
    return {
      easy: { stem: `A car's speed goes from ${v1} m/s to ${v2} m/s. How many times larger is its energy of motion?`, right: `${f(fac * fac, 2)} times`, wrong: [`${f(fac, 2)} times`, `${f(fac * 2, 2)} times`, `${f(fac * fac * fac, 2)} times`], hint: 'Energy goes with speed squared.', explanation: `Energy ∝ v², so (${v2} ÷ ${v1})² = ${f(fac * fac, 2)}.` },
      medium: { stem: `A ${m} kg car moves at ${v} m/s. What is its kinetic energy in kilojoules?`, answer: KE, unit: 'kJ', rel: 0.01, hint: '½ m v² in joules, then ÷ 1000.', formula: 'KE = ½ m v²', explanation: `½ × ${m} × ${v}² = ${f(KE * 1000, 0)} J = ${f(KE, 1)} kJ.` },
      hard: { stem: `A 1,200 kg car speeds up from ${v1} m/s to ${v2} m/s. How much extra kinetic energy does it need, in kilojoules?`, answer: x, unit: 'kJ', rel: 0.01, hint: '½ m (v₂² − v₁²).', formula: 'ΔKE = ½ m (v₂² − v₁²)', explanation: `½ × 1,200 × (${v2 * v2} − ${v1 * v1}) = ${f(x * 1000, 0)} J = ${f(x, 1)} kJ.` },
    };
  },
  'sci.potential': k => {
    const [m, h] = pick([[900, 10], [1200, 8], [500, 20], [1000, 15], [800, 12]] as const, k), PE = m * G * h / 1000;
    return {
      easy: { stem: `A ${m} kg car is driven up a ${h} m hill. How much potential energy does it gain, in kilojoules? (g = 9.8)`, right: `${f(PE, 1)} kJ`, wrong: [`${f(PE * 10, 1)} kJ`, `${f(m * h / 1000, 1)} kJ`, `${f(PE / 2, 1)} kJ`], hint: 'm × g × h.', formula: 'PE = m g h', explanation: `${m} × 9.8 × ${h} = ${f(PE * 1000, 0)} J = ${f(PE, 1)} kJ.` },
      medium: { stem: `A ${m} kg car is driven up a ${h} m hill. How much potential energy does it gain, in joules? (g = 9.8)`, answer: PE * 1000, unit: 'J', rel: 0.01, hint: 'm × g × h.', formula: 'PE = m g h', explanation: `${m} × 9.8 × ${h} = ${f(PE * 1000, 0)} J.` },
      hard: { stem: `A ${m} kg car gains ${f(PE, 1)} kJ of potential energy on a climb. How high did it climb, in metres? (g = 9.8)`, answer: h, unit: 'm', rel: 0.02, hint: 'h = PE ÷ (m g), with PE in joules.', formula: 'h = PE ÷ (m g)', explanation: `${f(PE * 1000, 0)} ÷ (${m} × 9.8) = ${h} m.` },
    };
  },
  'road.stopping': k => {
    const [v, t] = pick([[20, 1.0], [25, 0.8], [15, 1.2], [30, 0.6], [10, 1.5]] as const, k), a = pick([6, 5, 7.5, 8, 5], k), rd = v * t, tot = rd + v * v / (2 * a);
    return {
      easy: { stem: `A driver at ${v} m/s reacts in ${t} s. How far does the car travel before braking starts?`, right: `${f(rd)} m`, wrong: [`${f(v / t)} m`, `${f(v + t)} m`, `${f(rd * 2)} m`], hint: 'Speed × time.', explanation: `${v} × ${t} = ${f(rd)} m.` },
      medium: { stem: `A driver at ${v} m/s reacts in ${t} s. How many metres does the car travel during the reaction?`, answer: rd, unit: 'm', hint: 'Speed × time.', formula: 'd_react = v × t', explanation: `${v} × ${t} = ${f(rd)} m.` },
      hard: { stem: `A car at ${v} m/s has a ${t} s reaction and then brakes at ${a} m/s². What is the total stopping distance in metres?`, answer: tot, unit: 'm', rel: 0.02, hint: 'Reaction distance plus v² ÷ (2a).', formula: 'd = v t + v² ÷ (2a)', explanation: `${f(rd)} + ${v * v} ÷ ${2 * a} = ${f(tot, 1)} m.` },
    };
  },
  'road.limits': k => {
    const [d1, v1, v2] = pick([[10, 30, 60], [12, 30, 90], [20, 50, 75], [15, 40, 60], [9, 30, 60]] as const, k), d2 = d1 * (v2 / v1) ** 2, p = pick([10, 20, 30, 15, 25], k), inc = ((1 + p / 100) ** 2 - 1) * 100;
    return {
      easy: { stem: `Speed goes from ${v1} km/h to ${v2} km/h. How many times longer does the braking distance become?`, right: `${f((v2 / v1) ** 2, 2)} times`, wrong: [`${f(v2 / v1, 2)} times`, `${f((v2 / v1) * 2, 2)} times`, `${f((v2 / v1) ** 3, 2)} times`], hint: 'Braking distance goes with speed squared.', explanation: `(${v2} ÷ ${v1})² = ${f((v2 / v1) ** 2, 2)}.` },
      medium: { stem: `A car needs ${d1} m to brake from ${v1} km/h. How far does it need from ${v2} km/h? (metres)`, answer: d2, unit: 'm', hint: 'Multiply by (new speed ÷ old speed)².', formula: 'd₂ = d₁ × (v₂ ÷ v₁)²', explanation: `${d1} × ${f((v2 / v1) ** 2, 2)} = ${f(d2, 1)} m.` },
      hard: { stem: `A driver goes ${p}% over the limit. By what percentage is their braking distance longer than at the limit?`, answer: inc, unit: '%', rel: 0.03, hint: '(1 + p ÷ 100)² − 1.', explanation: `${f(1 + p / 100, 2)}² = ${f((1 + p / 100) ** 2, 3)}, so the distance is ${f(inc, 1)}% longer.` },
    };
  },
  'road.hazards': k => {
    const [v, t] = pick([[20, 3], [25, 2], [30, 3], [15, 4], [10, 3]] as const, k), [kmh, tg] = pick([[72, 3], [90, 2], [108, 3], [54, 4], [36, 3]] as const, k), [dd, kk] = pick([[36, 72], [50, 90], [45, 108], [30, 54], [24, 36]] as const, k);
    return {
      easy: { stem: `How many metres is a ${t}-second gap at ${v} m/s?`, right: `${v * t} m`, wrong: [`${f(v / t)} m`, `${v + t} m`, `${v * t * 2} m`], hint: 'Speed × time.', explanation: `${v} × ${t} = ${v * t} m.` },
      medium: { stem: `How many metres is a ${tg}-second gap at ${kmh} km/h?`, answer: kmh / 3.6 * tg, unit: 'm', hint: 'Convert to m/s, then × time.', formula: 'gap = v × t', explanation: `${kmh} ÷ 3.6 = ${f(kmh / 3.6, 1)} m/s, × ${tg} = ${f(kmh / 3.6 * tg, 1)} m.` },
      hard: { stem: `A car follows ${dd} m behind another at ${kk} km/h. What is the gap in seconds?`, answer: dd / (kk / 3.6), unit: 's', rel: 0.02, hint: 'Gap time = distance ÷ speed in m/s.', formula: 't = d ÷ v', explanation: `${kk} km/h = ${f(kk / 3.6, 1)} m/s. ${dd} ÷ ${f(kk / 3.6, 1)} = ${f(dd / (kk / 3.6), 2)} s.` },
    };
  },
  'auto.gearing': k => {
    const v = pick([20, 24, 30, 16, 36], k), [kmh, R] = pick([[108, 4], [90, 3.5], [72, 3], [144, 5], [126, 2.5]] as const, k), wr = kmh / 3.6 * 30;
    return {
      easy: { stem: `Each turn of a 2 m wheel moves the car 2 m. At ${v} m/s, how many wheel turns happen every second?`, right: `${f(v / 2)} turns`, wrong: [`${f(v * 2)} turns`, `${f(v)} turns`, `${f(v / 4)} turns`], hint: 'Speed ÷ distance per turn.', explanation: `${v} ÷ 2 = ${f(v / 2)} turns per second.` },
      medium: { stem: `A car with 2 m wheels travels at ${v} m/s. How many wheel revolutions per minute is that?`, answer: v * 30, unit: 'rpm', hint: 'Turns per second × 60.', formula: 'wheel rpm = (v ÷ circumference) × 60', explanation: `${v} ÷ 2 = ${f(v / 2)} turns per second, × 60 = ${f(v * 30, 0)} rpm.` },
      hard: { stem: `At ${kmh} km/h on 2 m wheels with a total gear ratio of ${R} : 1, what is the engine speed in rpm?`, answer: wr * R, unit: 'rpm', rel: 0.015, hint: 'Wheel rpm first, then × ratio.', formula: 'engine rpm = wheel rpm × ratio', explanation: `${kmh} km/h = ${f(kmh / 3.6, 1)} m/s, wheel rpm = ${f(wr, 0)}, × ${R} = ${f(wr * R, 0)} rpm.` },
    };
  },
  'auto.aero': k => {
    const fa = pick([2, 3, 2, 3, 4], k), [F1, v1] = pick([[300, 20], [400, 25], [250, 15], [500, 30], [350, 20]] as const, k), cd = pick([0.3, 0.32, 0.28, 0.35, 0.3], k), vv = pick([30, 25, 40, 20, 35], k), F = 0.5 * 1.2 * cd * 2 * vv * vv;
    return {
      easy: { stem: `A car speeds up from ${v1} m/s to ${v1 * fa} m/s. How many times larger is the air drag?`, right: `${fa * fa} times`, wrong: [`${fa} times`, `${fa * 2} times`, `${fa ** 3} times`], hint: 'Drag grows with speed squared.', explanation: `Drag ∝ v², so ${fa}² = ${fa * fa}.` },
      medium: { stem: `The drag on a car at ${v1} m/s is ${F1} N. What is the drag at ${v1 * fa} m/s, in newtons?`, answer: F1 * fa * fa, unit: 'N', hint: 'Multiply by the speed factor squared.', formula: 'F₂ = F₁ × (v₂ ÷ v₁)²', explanation: `${F1} × ${fa}² = ${F1 * fa * fa} N.` },
      hard: { stem: `Find the drag in newtons at ${vv} m/s with air density 1.2 kg/m³, Cd = ${cd} and frontal area 2.0 m².`, answer: F, unit: 'N', rel: 0.02, hint: '½ × 1.2 × Cd × A × v².', formula: 'F = ½ ρ Cd A v²', explanation: `0.5 × 1.2 × ${cd} × 2.0 × ${vv}² = ${f(F, 1)} N.` },
    };
  },
  'auto.brakes': k => {
    const v = pick([20, 25, 30, 15, 35], k), KE = 0.5 * 1200 * v * v;
    return {
      easy: { stem: `A 1,200 kg car brakes to a stop from ${v} m/s. How much energy of motion is turned into heat, in kilojoules?`, right: `${f(KE / 1000, 1)} kJ`, wrong: [`${f(KE / 2000, 1)} kJ`, `${f(1200 * v / 1000, 1)} kJ`, `${f(KE, 0)} kJ`], hint: '½ m v² in joules, then ÷ 1000.', formula: 'KE = ½ m v²', explanation: `½ × 1,200 × ${v}² = ${f(KE, 0)} J = ${f(KE / 1000, 1)} kJ.` },
      medium: { stem: `A 1,200 kg car brakes to a stop from ${v} m/s. How much heat energy is made, in kilojoules?`, answer: KE / 1000, unit: 'kJ', rel: 0.01, hint: '½ m v².', formula: 'KE = ½ m v²', explanation: `½ × 1,200 × ${v}² = ${f(KE, 0)} J = ${f(KE / 1000, 1)} kJ.` },
      hard: { stem: `A 1,200 kg car stops from ${v} m/s. The heat is shared by 4 discs of 4 kg each (c = 500 J/kg°C), with no cooling. By how many °C does each disc warm up?`, answer: KE / 4 / (4 * 500), unit: '°C', rel: 0.02, hint: 'Heat per disc ÷ (mass × 500).', formula: 'ΔT = Q ÷ (m c)', explanation: `Each disc takes ${f(KE / 4, 0)} J. ΔT = ${f(KE / 4, 0)} ÷ (4 × 500) = ${f(KE / 8000, 1)} °C.` },
    };
  },
  'geo.slope': k => {
    const [rise, run] = pick([[5, 100], [12, 200], [9, 300], [6, 150], [8, 400]] as const, k), g = rise / run * 100, [gg, rr] = pick([[8, 450], [6, 500], [5, 800], [10, 300], [4, 625]] as const, k);
    return {
      easy: { stem: `A road rises ${rise} m over a horizontal run of ${run} m. What is its gradient?`, right: `${f(g, 1)}%`, wrong: [`${f(run / rise, 1)}%`, `${f(g * 10, 1)}%`, `${f(g / 10, 2)}%`], hint: 'Rise ÷ run × 100.', explanation: `${rise} ÷ ${run} × 100 = ${f(g, 1)}%.` },
      medium: { stem: `A road rises ${rise} m over a horizontal run of ${run} m. What is its gradient as a percentage?`, answer: g, unit: '%', hint: 'Rise ÷ run × 100.', formula: 'gradient % = rise ÷ run × 100', explanation: `${rise} ÷ ${run} × 100 = ${f(g, 1)}%.` },
      hard: { stem: `A ${gg}% slope runs for ${rr} m horizontally. How many metres does it rise?`, answer: gg * rr / 100, unit: 'm', rel: 0.02, hint: 'Rise = gradient × run ÷ 100.', formula: 'rise = gradient % × run ÷ 100', explanation: `${gg} × ${rr} ÷ 100 = ${f(gg * rr / 100, 1)} m.` },
    };
  },
  'geo.scale': k => {
    const N = pick([10000, 25000, 50000, 5000, 20000], k), cm = pick([6, 4, 3, 12, 5], k), real = cm * N / 100, [km, N2] = pick([[2.5, 50000], [1.2, 20000], [3, 25000], [0.75, 5000], [4, 100000]] as const, k), mc = km * 100000 / N2;
    return {
      easy: { stem: `On a 1 : ${N.toLocaleString('en-US')} map two points are ${cm} cm apart. How far apart are they in real life?`, right: `${f(real, 0)} m`, wrong: [`${f(cm * N, 0)} m`, `${f(real / 10, 1)} m`, `${f(cm * N / 1000, 0)} m`], hint: '1 cm on the map is N ÷ 100 metres.', explanation: `1 cm = ${N / 100} m, so ${cm} cm = ${f(real, 0)} m.` },
      medium: { stem: `On a 1 : ${N.toLocaleString('en-US')} map two points are ${cm} cm apart. What is the real distance in metres?`, answer: real, unit: 'm', hint: 'cm × scale ÷ 100.', formula: 'real (m) = map cm × scale ÷ 100', explanation: `${cm} × ${N} ÷ 100 = ${f(real, 0)} m.` },
      hard: { stem: `Two places are ${km} km apart. How many centimetres apart are they on a 1 : ${N2.toLocaleString('en-US')} map?`, answer: mc, unit: 'cm', rel: 0.02, hint: 'km → cm is × 100,000, then ÷ scale.', formula: 'map cm = real cm ÷ scale', explanation: `${km} km = ${f(km * 100000, 0)} cm. ${f(km * 100000, 0)} ÷ ${N2} = ${f(mc, 2)} cm.` },
    };
  },
  'geo.carbon': k => {
    const L = pick([10, 25, 40, 8, 60], k), [km, c] = pick([[100, 6], [250, 8], [50, 7], [400, 5.5], [150, 9]] as const, k), fuel = km * c / 100;
    return {
      easy: { stem: `Burning 1 litre of petrol releases about 2.3 kg of CO₂. How much CO₂ comes from ${L} litres?`, right: `${f(L * 2.3, 1)} kg`, wrong: [`${f(L / 2.3, 1)} kg`, `${f(L + 2.3, 1)} kg`, `${f(L * 23, 0)} kg`], hint: 'Litres × 2.3.', explanation: `${L} × 2.3 = ${f(L * 2.3, 1)} kg.` },
      medium: { stem: `A car uses ${c} litres per 100 km. How much fuel does a ${km} km trip need, in litres?`, answer: fuel, unit: 'litres', hint: 'distance ÷ 100 × consumption.', formula: 'fuel = distance ÷ 100 × L/100 km', explanation: `${km} ÷ 100 × ${c} = ${f(fuel, 2)} litres.` },
      hard: { stem: `A car uses ${c} litres per 100 km. How much CO₂ (at 2.3 kg per litre) does a ${km} km trip release, in kg?`, answer: fuel * 2.3, unit: 'kg', rel: 0.02, hint: 'Fuel first, then × 2.3.', formula: 'CO₂ = fuel × 2.3', explanation: `${km} ÷ 100 × ${c} = ${f(fuel, 2)} L, × 2.3 = ${f(fuel * 2.3, 1)} kg.` },
    };
  },
};

const build = (concept: ConceptId, id: string, s: Spec): Question => {
  const base = { id, scenarioId: `rv.${concept}`, concept, stem: s.stem, explanation: s.explanation, hint: s.hint, formula: s.formula };
  if (s.right !== undefined) return choiceQuestion({ ...base, right: s.right, wrong: s.wrong ?? [] });
  return numericQuestion({ ...base, answer: s.answer ?? 0, unit: s.unit, rel: s.rel, floor: s.floor });
};

/** The refresh question for `concept`, in the learning difficulty `diff`; `k` picks the numbers (any integer, deterministic). */
export function reviewQuestion(concept: ConceptId, diff: LearningDifficulty, k: number): Question {
  const kk = Math.abs(Math.floor(k)) % 1000;
  return build(concept, `rv.${concept}.${diff[0]}.${kk}`, GENS[concept](kk)[diff]);
}
