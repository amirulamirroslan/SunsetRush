import type { Mission, SectionLeg } from '../types';
import { G, KMH, factory, fmt, m, r1, r2 } from './qhelp';

const sec = (l: Omit<SectionLeg, 'kind'>): SectionLeg => ({ kind: 'section', ...l });
const C1 = { mission: 'm1', concept: 'math.speed' } as const;
const C2 = { mission: 'm2', concept: 'math.pace' } as const;
const C3 = { mission: 'm3', concept: 'math.percent' } as const;
void G;

export const MATH_MISSIONS: Mission[] = [
  // ------------------------------------------------------------------ M1
  {
    id: 'm1', order: 1, subject: 'math', concept: 'math.speed', character: 'kai', lab: 'lab.pace',
    title: 'Speed Trap', summary: 'Turn a timed drive into a speed.',
    discover: [
      { who: 'kai', text: 'Welcome to the timing wall. Every number on these screens starts with three questions: how far, how long, how fast?' },
      { who: 'you', text: 'How do you get speed from a stopwatch?' },
      { who: 'kai', text: 'Distance divided by time. I will put two gates on the coast straight and you will drive through them. Your own drive becomes the data.' },
    ],
    reflect: ['Which gate time surprised you, and why?', 'How could you check a speed reading without the dashboard?'],
    variants: {
      easy: {
        coach: 'Pass both blue gates at a steady, comfortable speed. You do not need to hurry.',
        understand: [
          { title: 'Speed is distance per second', body: 'If you cover 100 m in 10 s, you move 10 m every second. We call that 10 metres per second, written 10 m/s.', formula: 'speed = distance ÷ time' },
          { title: 'Two ways to say it', body: 'Racing screens use km/h. Science uses m/s. To change m/s into km/h, multiply by 3.6.', formula: 'km/h = m/s × 3.6' },
          { title: 'Your timing section', body: 'The two blue gates are 300 m apart. The time you take between them gives your average speed.' },
        ],
        practice: [],
        objective: { timeLimit: 70, brief: 'Drive through the two blue timing gates (300 m apart) between 90 and 190 km/h on average.', legs: [sec({ id: 'trap', label: 'Timing section', from: 100, to: 400, minAvgKmh: 90, maxAvgKmh: 190 })] },
        apply: r => {
          const f = factory({ ...C1, diff: 'easy' }, 'apply'), t = m(r, 'trap', 'time', 8), v = r1(300 / t), k = Math.round(v * KMH);
          return [
            f.choice({ stem: `Your timing section was 300 m long and you took ${fmt(t, 2)} s. Which calculation gives your average speed?`, right: `300 ÷ ${fmt(t, 2)}`, wrong: [`${fmt(t, 2)} ÷ 300`, `300 × ${fmt(t, 2)}`, `300 + ${fmt(t, 2)}`], hint: 'Speed = distance ÷ time. The distance goes on top.', formula: 'speed = distance ÷ time', explanation: `Speed is distance divided by time: 300 ÷ ${fmt(t, 2)} ≈ ${fmt(v)} m/s.` }),
            f.choice({ stem: `What was your average speed in m/s?`, right: `${fmt(v)} m/s`, wrong: [`${fmt(v * KMH, 0)} m/s`, `${fmt(v / KMH)} m/s`, `${fmt(t / 300, 3)} m/s`], hint: '300 divided by your time.', explanation: `300 ÷ ${fmt(t, 2)} ≈ ${fmt(v)} m/s.` }),
            f.choice({ stem: `Your average speed was ${fmt(v)} m/s. What is that in km/h?`, right: `${k} km/h`, wrong: [`${fmt(v, 0)} km/h`, `${fmt(v / KMH, 0)} km/h`, `${fmt(v * 36, 0)} km/h`], hint: 'Multiply metres per second by 3.6.', formula: 'km/h = m/s × 3.6', explanation: `${fmt(v)} × 3.6 ≈ ${k} km/h.` }),
          ];
        },
      },
      medium: {
        coach: 'Hold a speed between 110 and 170 km/h over the section, then do the maths from your own time.',
        understand: [
          { title: 'Average speed', body: 'Divide the distance by the time taken. Use metres and seconds to get m/s.', formula: 'v = d ÷ t' },
          { title: 'Converting units', body: 'm/s to km/h: × 3.6. km/h to m/s: ÷ 3.6. Always check the unit your answer needs.', formula: '1 m/s = 3.6 km/h' },
          { title: 'Average, not instant', body: 'Distance ÷ time gives your average over the section. Your speed at any single moment may have been higher or lower.' },
        ],
        practice: [],
        objective: { timeLimit: 70, brief: 'Average between 110 and 170 km/h through the 300 m timing section.', legs: [sec({ id: 'trap', label: 'Timing section', from: 100, to: 400, minAvgKmh: 110, maxAvgKmh: 170 })] },
        apply: r => {
          const f = factory({ ...C1, diff: 'medium' }, 'apply'), t = m(r, 'trap', 'time', 8), v = 300 / t;
          return [
            f.num({ stem: `You covered the 300 m section in ${fmt(t, 2)} s. What was your average speed in m/s?`, answer: v, unit: 'm/s', hint: 'Distance ÷ time.', formula: 'v = d ÷ t', explanation: `300 ÷ ${fmt(t, 2)} = ${fmt(v, 2)} m/s.` }),
            f.num({ stem: `Give that average speed in km/h.`, answer: v * KMH, unit: 'km/h', hint: 'Multiply the m/s value by 3.6.', formula: 'km/h = m/s × 3.6', explanation: `${fmt(v, 2)} × 3.6 = ${fmt(v * KMH, 1)} km/h.` }),
            f.num({ stem: `To average 10% faster over the same 300 m, what time would you need to beat? (Speed up 10% means time ÷ 1.1.)`, answer: t / 1.1, unit: 's', hint: 'New time = old time ÷ 1.1.', explanation: `${fmt(t, 2)} ÷ 1.1 = ${fmt(t / 1.1, 2)} s.` }),
          ];
        },
      },
      hard: {
        coach: 'Drive the first section slowly (90 to 140 km/h) and the second quickly (150 to 215 km/h). Total distance over total time, not the mean of two speeds.',
        understand: [
          { title: 'Average speed over several legs', body: 'Average speed is total distance ÷ total time. It is not the simple mean of the leg speeds unless every leg takes the same time.', formula: 'v̄ = (d₁ + d₂) ÷ (t₁ + t₂)' },
          { title: 'Units and dimensional checking', body: 'Carry units through the calculation. Metres ÷ seconds gives m/s; multiply by 3.6 for km/h. If your result has the wrong unit, the method is wrong.' },
          { title: 'Why slow legs weigh more', body: 'At low speed a leg takes longer, so it contributes more time to the total. Slow stretches pull the overall average down harder than fast stretches lift it.' },
        ],
        practice: [],
        objective: { timeLimit: 80, brief: 'Leg A (300 m): average 90 to 140 km/h. Leg B (300 m): average 150 to 215 km/h.', legs: [sec({ id: 'a', label: 'Leg A', from: 100, to: 400, minAvgKmh: 90, maxAvgKmh: 140 }), sec({ id: 'b', label: 'Leg B', from: 560, to: 860, minAvgKmh: 150, maxAvgKmh: 215 })] },
        apply: r => {
          const f = factory({ ...C1, diff: 'hard' }, 'apply'), ta = m(r, 'a', 'time', 8), tb = m(r, 'b', 'time', 6), va = 300 / ta * KMH, vb = 300 / tb * KMH, overall = 600 / (ta + tb) * KMH;
          return [
            f.num({ stem: `Leg A (300 m) took ${fmt(ta, 2)} s and leg B (300 m) took ${fmt(tb, 2)} s. What was your overall average speed over the 600 m in km/h?`, answer: overall, unit: 'km/h', hint: 'Add the distances, add the times, then divide.', explanation: `Total distance 600 m ÷ total time ${fmt(ta + tb, 2)} s = ${fmt(overall / KMH, 2)} m/s = ${fmt(overall, 1)} km/h.` }),
            f.choice({ stem: `Your leg speeds were ${fmt(va, 0)} km/h and ${fmt(vb, 0)} km/h. Their simple mean is ${fmt((va + vb) / 2, 0)} km/h but your overall average was ${fmt(overall, 0)} km/h. Why is the overall average lower?`, right: 'You spent more time at the lower speed, so it counts for more.', wrong: ['The timing gates lose a little time.', 'Average speed always equals the slower leg.', 'The second leg was shorter.'], hint: 'Compare how many seconds each leg took.', explanation: `Leg A took ${fmt(ta, 2)} s and leg B took ${fmt(tb, 2)} s. More seconds were spent at the slower speed, so it weighs more in the average.` }),
            f.num({ stem: `You want an overall average of exactly 120 km/h over 600 m. Given your leg A time of ${fmt(ta, 2)} s, how long must leg B take, in seconds?`, answer: 600 / (120 / KMH) - ta, unit: 's', rel: 0.02, hint: 'Find the total time allowed for 600 m at 120 km/h, then subtract leg A.', explanation: `600 ÷ (120 ÷ 3.6) = 18 s in total. 18 − ${fmt(ta, 2)} = ${fmt(18 - ta, 2)} s.` }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M2
  {
    id: 'm2', order: 2, subject: 'math', concept: 'math.pace', character: 'kai',
    title: 'Pace Comparison', summary: 'Compare two timed sections with averages and percentages.',
    discover: [
      { who: 'kai', text: 'One number is a fact. Two numbers are a story. Today you will drive two back-to-back sections and compare them.' },
      { who: 'you', text: 'How do I tell which one was better?' },
      { who: 'kai', text: 'By the difference, the mean and, for the sharp-eyed, a percentage. Drive it and we will see.' },
    ],
    reflect: ['Was the faster section the one that felt faster?', 'When is a percentage a fairer comparison than a difference?'],
    variants: {
      easy: {
        coach: 'Just drive both 250 m sections cleanly; stay on the road.',
        understand: [
          { title: 'Comparing two times', body: 'The smaller time is the faster one. The difference between the times tells you by how much.', formula: 'difference = bigger time − smaller time' },
          { title: 'Total and mean', body: 'Add the times for the total. Divide the total by how many sections for the mean (the average).', formula: 'mean = total ÷ number of sections' },
        ],
        practice: [factory({ ...C2, diff: 'easy' }, 'practice').choice({ stem: 'Lap A took 62 s and lap B took 58 s. Which was faster, and by how much?', right: 'Lap B, by 4 s', wrong: ['Lap A, by 4 s', 'Lap B, by 120 s', 'They were equal'], hint: 'The smaller time is faster.', explanation: 'The smaller time (58 s) is faster. 62 − 58 = 4 s.' })],
        objective: { timeLimit: 90, brief: 'Drive both 250 m sections without spending more than 3 s off the road.', legs: [sec({ id: 'pa', label: 'Section A', from: 560, to: 810, offRoadMaxSec: 3 }), sec({ id: 'pb', label: 'Section B', from: 810, to: 1060, offRoadMaxSec: 3 })] },
        apply: r => {
          const f = factory({ ...C2, diff: 'easy' }, 'apply'), a = m(r, 'pa', 'time', 7), b = m(r, 'pb', 'time', 7.5), tot = a + b;
          return [
            f.choice({ stem: `Section A took ${fmt(a, 2)} s and section B took ${fmt(b, 2)} s. Which section was faster?`, right: a < b ? 'Section A' : 'Section B', wrong: [a < b ? 'Section B' : 'Section A', 'They took exactly the same time', 'You cannot tell'], hint: 'Smaller time = faster.', explanation: `${a < b ? 'Section A' : 'Section B'} took less time, so it was faster.` }),
            f.choice({ stem: 'What was the total time for both sections?', right: `${fmt(tot, 2)} s`, wrong: [`${fmt(Math.abs(a - b), 2)} s`, `${fmt(tot / 2, 2)} s`, `${fmt(tot * 2, 2)} s`], hint: 'Add the two times.', explanation: `${fmt(a, 2)} + ${fmt(b, 2)} = ${fmt(tot, 2)} s.` }),
            f.choice({ stem: 'What was the mean (average) time per section?', right: `${fmt(tot / 2, 2)} s`, wrong: [`${fmt(tot, 2)} s`, `${fmt(Math.abs(a - b), 2)} s`, `${fmt(Math.max(a, b), 2)} s`], hint: 'Total ÷ 2 sections.', formula: 'mean = total ÷ 2', explanation: `${fmt(tot, 2)} ÷ 2 = ${fmt(tot / 2, 2)} s.` }),
          ];
        },
      },
      medium: {
        coach: 'Drive both sections without hitting anything. The numbers from your run feed the questions.',
        understand: [
          { title: 'Mean and difference', body: 'Mean time = total ÷ count. The difference between two times shows the gap.', formula: 'mean = (t₁ + t₂) ÷ 2' },
          { title: 'Mean speed over equal sections', body: 'For equal distances, average speed = total distance ÷ total time.', formula: 'v = (d₁ + d₂) ÷ (t₁ + t₂)' },
        ],
        practice: [factory({ ...C2, diff: 'medium' }, 'practice').num({ stem: 'Three laps took 64.2 s, 61.8 s and 63.0 s. What was the mean lap time?', answer: 63, unit: 's', hint: 'Add them and divide by 3.', formula: 'mean = total ÷ count', explanation: '(64.2 + 61.8 + 63.0) ÷ 3 = 189 ÷ 3 = 63.0 s.' })],
        objective: { timeLimit: 90, brief: 'Drive both 250 m sections without hitting any hazard.', legs: [sec({ id: 'pa', label: 'Section A', from: 560, to: 810, noHits: true }), sec({ id: 'pb', label: 'Section B', from: 810, to: 1060, noHits: true })] },
        apply: r => {
          const f = factory({ ...C2, diff: 'medium' }, 'apply'), a = m(r, 'pa', 'time', 7), b = m(r, 'pb', 'time', 7.5);
          return [
            f.num({ stem: `Your two section times were ${fmt(a, 2)} s and ${fmt(b, 2)} s. What was the mean time?`, answer: (a + b) / 2, unit: 's', hint: 'Add and divide by 2.', formula: 'mean = (t₁ + t₂) ÷ 2', explanation: `(${fmt(a, 2)} + ${fmt(b, 2)}) ÷ 2 = ${fmt((a + b) / 2, 2)} s.` }),
            f.num({ stem: 'By how many seconds did the faster section beat the slower one?', answer: Math.abs(a - b), unit: 's', floor: 0.03, hint: 'Subtract the smaller time from the larger.', explanation: `|${fmt(a, 2)} − ${fmt(b, 2)}| = ${fmt(Math.abs(a - b), 2)} s.` }),
            f.num({ stem: `Both sections were 250 m. What was your average speed over the full 500 m in km/h?`, answer: 500 / (a + b) * KMH, unit: 'km/h', hint: 'Total distance ÷ total time, then × 3.6.', explanation: `500 ÷ ${fmt(a + b, 2)} = ${fmt(500 / (a + b), 2)} m/s = ${fmt(500 / (a + b) * KMH, 1)} km/h.` }),
          ];
        },
      },
      hard: {
        coach: 'Make section B at least 5% faster than section A: save energy for the end, like a negative split.',
        understand: [
          { title: 'Percentage comparison', body: 'Speed gain in % = (old time ÷ new time − 1) × 100 for equal distances. Percentages compare sections of different sizes fairly.', formula: 'gain% = (tₐ ÷ t_b − 1) × 100' },
          { title: 'Planning with averages', body: 'If you know two times, you can predict a third that matches their mean and forecast a total. Averages are tools for planning, not just reporting.' },
        ],
        practice: [factory({ ...C2, diff: 'hard' }, 'practice').num({ stem: 'Lap 1 took 80 s and lap 2 took 72 s over the same distance. By what percentage was the average speed higher in lap 2?', answer: (80 / 72 - 1) * 100, unit: '%', rel: 0.03, hint: 'Use old time ÷ new time − 1.', formula: 'gain% = (tₐ ÷ t_b − 1) × 100', explanation: '80 ÷ 72 = 1.111, so the gain is about 11.1%.' })],
        objective: { timeLimit: 100, brief: 'Both 250 m sections hazard-free, and section B at least 5% faster than section A.', legs: [sec({ id: 'pa', label: 'Section A', from: 560, to: 810, noHits: true }), sec({ id: 'pb', label: 'Section B', from: 810, to: 1060, noHits: true, fasterThanPrevPct: 5 })] },
        apply: r => {
          const f = factory({ ...C2, diff: 'hard' }, 'apply'), a = m(r, 'pa', 'time', 7.5), b = m(r, 'pb', 'time', 7);
          return [
            f.num({ stem: `Section A took ${fmt(a, 2)} s and section B took ${fmt(b, 2)} s over equal distances. By what percentage was your average speed higher in section B?`, answer: (a / b - 1) * 100, unit: '%', rel: 0.04, floor: 0.4, hint: 'Old time ÷ new time − 1, times 100.', formula: 'gain% = (tₐ ÷ t_b − 1) × 100', explanation: `${fmt(a, 2)} ÷ ${fmt(b, 2)} = ${fmt(a / b, 3)}, so the gain is ${fmt((a / b - 1) * 100, 1)}%.` }),
            f.num({ stem: `A third section C is planned to take exactly the mean of A and B. What would the total time for A, B and C be?`, answer: 1.5 * (a + b), unit: 's', hint: 'C = (A + B) ÷ 2, so the total is A + B + C.', explanation: `C = ${fmt((a + b) / 2, 2)} s, so the total is ${fmt(a + b, 2)} + ${fmt((a + b) / 2, 2)} = ${fmt(1.5 * (a + b), 2)} s.` }),
            f.num({ stem: `If you could cut section B's time by a further 5%, what would the new time be?`, answer: b * 0.95, unit: 's', hint: 'Multiply by 0.95.', explanation: `${fmt(b, 2)} × 0.95 = ${fmt(b * 0.95, 2)} s.` }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M3
  {
    id: 'm3', order: 3, subject: 'math', concept: 'math.percent', character: 'kai',
    title: 'The Boost Gauge', summary: 'Read, add and compare percentages on the boost meter.',
    discover: [
      { who: 'kai', text: 'That boost meter on your dash is a percentage in disguise. Full is 100%, empty is 0%.' },
      { who: 'you', text: 'How do I fill it?' },
      { who: 'kai', text: 'Drift through the bends. Charge it past the target and you will have real numbers to work with.' },
    ],
    reflect: ['Why is a rise from 35% to 70% both 35 points and a 100% increase?', 'Where else do you see percentage meters in everyday life?'],
    variants: {
      easy: {
        coach: 'Hold Space while turning through the bends. Drift for 2 seconds in total and reach 55% on the meter.',
        understand: [
          { title: 'Percent means "out of 100"', body: 'A meter at 50% is half full; 25% is a quarter; 100% is completely full.', formula: '50% = 50/100 = ½' },
          { title: 'Percentage points', body: 'If the meter goes from 35% to 60% it gained 25 percentage points: just subtract.', formula: 'gain = new % − old %' },
        ],
        practice: [factory({ ...C3, diff: 'easy' }, 'practice').choice({ stem: 'A meter reads 40%. What fraction of the full meter is that?', right: '2/5', wrong: ['1/4', '4/10 of the empty part', '40/1'], hint: '40% = 40/100. Simplify.', explanation: '40/100 simplifies to 2/5.' })],
        objective: { timeLimit: 90, brief: 'Drift through the bends for at least 2 seconds and charge the boost meter to at least 55%.', legs: [sec({ id: 'meter', label: 'Charge the meter', from: 520, to: 1180, meterTo: 0.55, driftSec: 2 })] },
        apply: r => {
          const f = factory({ ...C3, diff: 'easy' }, 'apply'), m0 = m(r, 'meter', 'meterStart', 35), m1 = m(r, 'meter', 'meterPeak', 60);
          return [
            f.choice({ stem: `At the start of the section your boost meter read ${m0}% and at its peak it read ${m1}%. How many percentage points did it gain?`, right: `${m1 - m0} points`, wrong: [`${m1 + m0} points`, `${m1} points`, `${m0} points`], hint: 'Subtract the start from the peak.', formula: 'gain = new % − old %', explanation: `${m1} − ${m0} = ${m1 - m0} percentage points.` }),
            f.choice({ stem: `At its peak the meter was ${m1}% full. How much of the meter was still empty?`, right: `${100 - m1}%`, wrong: [`${m1}%`, `${m1 - 50}%`, `${100 + m1}%`], hint: 'The full meter is 100%.', explanation: `100% − ${m1}% = ${100 - m1}% was still empty.` }),
            f.choice({ stem: `${m1}% written as a fraction out of 100 is…`, right: `${m1}/100`, wrong: [`100/${m1}`, `${m1}/10`, `1/${m1}`], hint: 'Percent means "out of 100".', explanation: `${m1}% means ${m1} out of 100, so ${m1}/100.` }),
          ];
        },
      },
      medium: {
        coach: 'Drift for 3 seconds in total through the bends and reach 65% on the meter.',
        understand: [
          { title: 'Percentage of an amount', body: 'To find a percentage of a quantity, multiply the quantity by the percentage divided by 100.', formula: 'part = total × (p ÷ 100)' },
          { title: 'What is left', body: 'The part still missing is 100% minus what you have. Percentage points are simple differences.' },
        ],
        practice: [factory({ ...C3, diff: 'medium' }, 'practice').num({ stem: 'A 250-unit boost tank is 64% full. How many units is that?', answer: 160, unit: 'units', hint: '250 × 64 ÷ 100.', formula: 'part = total × p ÷ 100', explanation: '250 × 0.64 = 160 units.' })],
        objective: { timeLimit: 90, brief: 'Drift for at least 3 seconds and charge the boost meter to at least 65%.', legs: [sec({ id: 'meter', label: 'Charge the meter', from: 520, to: 1180, meterTo: 0.65, driftSec: 3 })] },
        apply: r => {
          const f = factory({ ...C3, diff: 'medium' }, 'apply'), m0 = m(r, 'meter', 'meterStart', 35), m1 = m(r, 'meter', 'meterPeak', 66);
          return [
            f.num({ stem: `Your meter went from ${m0}% to a peak of ${m1}%. How many percentage points did it gain?`, answer: m1 - m0, unit: 'points', floor: 0.01, hint: 'Peak minus start.', explanation: `${m1} − ${m0} = ${m1 - m0}.` }),
            f.num({ stem: `A full boost meter holds 200 units. How many units were in it at your ${m1}% peak?`, answer: 2 * m1, unit: 'units', floor: 0.01, hint: '200 × (peak ÷ 100).', formula: 'part = total × p ÷ 100', explanation: `200 × ${m1} ÷ 100 = ${2 * m1} units.` }),
            f.num({ stem: `How many more percentage points would you need to fill the meter from your ${m1}% peak?`, answer: 100 - m1, unit: 'points', floor: 0.01, hint: '100 minus the peak.', explanation: `100 − ${m1} = ${100 - m1}.` }),
          ];
        },
      },
      hard: {
        coach: 'Drift for 4 seconds in total and reach 75% or more on the meter.',
        understand: [
          { title: 'Percentage change', body: 'Percentage points and percentage change are different. A meter rising from 35% to 70% gains 35 points, which is a 100% increase relative to where it started.', formula: 'change % = (new − old) ÷ old × 100' },
          { title: 'Rates', body: 'The meter fills at a steady rate while drifting (11 points per second in this game). Time needed = points needed ÷ rate.', formula: 'time = points ÷ rate' },
        ],
        practice: [factory({ ...C3, diff: 'hard' }, 'practice').num({ stem: 'A meter rises from 25% to 60%. By what percentage did it increase relative to its starting value?', answer: 140, unit: '%', hint: '(new − old) ÷ old × 100.', formula: 'change % = (new − old) ÷ old × 100', explanation: '(60 − 25) ÷ 25 = 1.4, so a 140% increase.' })],
        objective: { timeLimit: 100, brief: 'Drift for at least 4 seconds and charge the boost meter to at least 75%.', legs: [sec({ id: 'meter', label: 'Charge the meter', from: 520, to: 1180, meterTo: 0.75, driftSec: 4 })] },
        apply: r => {
          const f = factory({ ...C3, diff: 'hard' }, 'apply'), m0 = Math.max(5, m(r, 'meter', 'meterStart', 35)), m1 = m(r, 'meter', 'meterPeak', 76);
          return [
            f.num({ stem: `Your meter went from ${m0}% to ${m1}%. By what percentage did it increase relative to its starting value?`, answer: (m1 - m0) / m0 * 100, unit: '%', rel: 0.02, floor: 0.5, hint: 'Gain ÷ starting value × 100.', formula: 'change % = (new − old) ÷ old × 100', explanation: `(${m1} − ${m0}) ÷ ${m0} = ${fmt((m1 - m0) / m0, 3)}, so ${fmt((m1 - m0) / m0 * 100, 1)}%.` }),
            f.num({ stem: `Boosting drains 30% of the current meter. Starting from your ${m1}% peak, what level is left after that drain?`, answer: m1 * 0.7, unit: '%', rel: 0.01, floor: 0.2, hint: 'Keep 70% of what you have.', explanation: `${m1} × 0.7 = ${fmt(m1 * 0.7, 1)}%.` }),
            f.num({ stem: `Drifting adds 11 percentage points per second. How many seconds of drifting does it take to go from ${m0}% to ${m1}%?`, answer: (m1 - m0) / 11, unit: 's', rel: 0.02, floor: 0.1, hint: 'Points needed ÷ 11.', formula: 'time = points ÷ rate', explanation: `(${m1} − ${m0}) ÷ 11 = ${fmt((m1 - m0) / 11, 2)} s.` }),
          ];
        },
      },
    },
  },
];
void r2;
