import type { Mission, SectionLeg, StopLeg } from '../types';
import { G, KMH, factory, fmt, m } from './qhelp';

const sec = (l: Omit<SectionLeg, 'kind'>): SectionLeg => ({ kind: 'section', ...l });
const stop = (l: Omit<StopLeg, 'kind'>): StopLeg => ({ kind: 'stop', ...l });
const C7 = { mission: 'm7', concept: 'road.stopping' } as const;
const C8 = { mission: 'm8', concept: 'road.limits' } as const;
const C9 = { mission: 'm9', concept: 'road.hazards' } as const;

/** Limit zones of mission 8 per difficulty (km/h) and the seconds over the limit that are forgiven per zone. */
export const M8_LIMITS = { easy: [170, 130, 170], medium: [150, 110, 150], hard: [130, 90, 130] } as const;
const M8_ALLOW = { easy: 3, medium: 1.5, hard: 0.6 } as const;
const zones = (d: 'easy' | 'medium' | 'hard'): SectionLeg[] => M8_LIMITS[d].map((limit, i) => sec({ id: `z${i}`, label: `${['First', 'Second', 'Third'][i]} zone (${limit} km/h)`, from: 560 + i * 200, to: 760 + i * 200, limitKmh: limit, overAllowSec: M8_ALLOW[d], noHits: d === 'hard' }));

export const ROAD_MISSIONS: Mission[] = [
  // ------------------------------------------------------------------ M7
  {
    id: 'm7', order: 7, subject: 'road', concept: 'road.stopping', character: 'omar', lab: 'lab.stopping',
    title: 'Reaction and Stopping', summary: 'A real stopping test: signal, reaction, brakes.',
    discover: [
      { who: 'omar', text: 'Every crash report starts with the same question: could the driver stop in time?' },
      { who: 'you', text: 'Is it just about the brakes?' },
      { who: 'omar', text: 'No. Before the brakes, there is your reaction. I will flash a stop signal on the test strip and we will measure both. Race brakes are far stronger than a road car, so remember that when we compare.' },
    ],
    reflect: ['How long did it take you to react? Could that change on a tired day?', 'What would you do differently on a wet road?'],
    variants: {
      easy: {
        coach: 'Drive past the signal at 80 km/h or more with your foot off the brake. When it turns red, brake and stop before the line.',
        understand: [
          { title: 'Two parts to stopping', body: 'First you react: the car keeps moving while you notice and move your foot. Then you brake: the car slows to a halt.', formula: 'stopping distance = reaction distance + braking distance' },
          { title: 'Reaction distance', body: 'During your reaction time the car does not slow down at all. A faster car covers a longer distance in the same time.', formula: 'reaction distance = speed × reaction time' },
          { title: 'Test track brakes', body: 'Race brakes slow a car much faster than ordinary road brakes. On the road, braking distances are much longer.' },
        ],
        practice: [],
        objective: { timeLimit: 80, brief: 'Pass the signal at 80 km/h or more without braking before it. When it flashes red, brake and stop within 100 m after it.', legs: [stop({ id: 'stop', label: 'Stopping test', signalAt: 120, minKmhAtSignal: 80, zone: [120, 220] })] },
        apply: r => {
          const f = factory({ ...C7, diff: 'easy' }, 'apply'), rt = m(r, 'stop', 'reactionSec', 0.5), v = m(r, 'stop', 'brakeMs', 25), rd = r1(rt * v), total = m(r, 'stop', 'totalDist', 30);
          return [
            f.choice({ stem: `You reacted in ${fmt(rt, 2)} s while travelling at ${fmt(v, 1)} m/s. How far did the car travel before you even started braking?`, right: `${fmt(rd, 1)} m`, wrong: [`${fmt(v / Math.max(0.05, rt), 1)} m`, `${fmt(v + rt, 1)} m`, `${fmt(v, 1)} m`], hint: 'Distance = speed × time.', formula: 'reaction distance = speed × reaction time', explanation: `${fmt(v, 1)} × ${fmt(rt, 2)} = ${fmt(rd, 1)} m travelled before braking began.` }),
            f.choice({ stem: 'Total stopping distance is…', right: 'reaction distance + braking distance', wrong: ['braking distance only', 'reaction time × braking time', 'half the braking distance'], hint: 'There are two parts.', explanation: 'You travel during the reaction and then more while braking. Both count.' }),
            f.choice({ stem: `Your stop took ${fmt(total, 1)} m from the signal. If you had reacted 1 second later at ${fmt(v, 1)} m/s, how far would you have gone?`, right: `${fmt(total + v, 1)} m`, wrong: [`${fmt(total, 1)} m`, `${fmt(Math.max(0, total - v), 1)} m`, `${fmt(total * 2, 1)} m`], hint: 'One more second at the same speed adds one more second of distance.', explanation: `One extra second of reaction adds ${fmt(v, 1)} m (the speed × 1 s), so ${fmt(total + v, 1)} m.` }),
          ];
        },
      },
      medium: {
        coach: 'Be doing 110 km/h or more at the signal, then stop within 70 m of it.',
        understand: [
          { title: 'Reaction distance', body: 'During your reaction time the car keeps its speed. Speed must be in m/s.', formula: 'd_react = v × t_react' },
          { title: 'Braking distance', body: 'After you brake, the car slows steadily. The distance depends on the brakes and the road, and grows quickly with speed.' },
          { title: 'Total', body: 'Total stopping distance is the reaction distance plus the braking distance.', formula: 'd_stop = d_react + d_brake' },
        ],
        practice: [],
        objective: { timeLimit: 80, brief: 'Pass the signal at 110 km/h or more without braking before it. When it flashes red, stop within 70 m after it.', legs: [stop({ id: 'stop', label: 'Stopping test', signalAt: 120, minKmhAtSignal: 110, zone: [120, 190] })] },
        apply: r => {
          const f = factory({ ...C7, diff: 'medium' }, 'apply'), rt = m(r, 'stop', 'reactionSec', 0.5), v = m(r, 'stop', 'brakeMs', 30), bd = m(r, 'stop', 'brakeDist', 14);
          return [
            f.num({ stem: `You were doing ${fmt(v, 1)} m/s when you started braking and your reaction time was ${fmt(rt, 2)} s. What was your reaction distance in metres?`, answer: v * rt, unit: 'm', floor: 0.3, hint: 'Speed × reaction time.', formula: 'd_react = v × t_react', explanation: `${fmt(v, 1)} × ${fmt(rt, 2)} = ${fmt(v * rt, 1)} m.` }),
            f.num({ stem: `Your braking distance was ${fmt(bd, 1)} m. Using your reaction distance from before (${fmt(v * rt, 1)} m), what was the total stopping distance?`, answer: v * rt + bd, unit: 'm', floor: 0.4, hint: 'Reaction distance + braking distance.', formula: 'd_stop = d_react + d_brake', explanation: `${fmt(v * rt, 1)} + ${fmt(bd, 1)} = ${fmt(v * rt + bd, 1)} m.` }),
            f.num({ stem: `A tired driver at the same speed (${fmt(v, 1)} m/s) has a reaction time of 1.5 s. What is their reaction distance in metres?`, answer: v * 1.5, unit: 'm', floor: 0.4, hint: 'Speed × 1.5 s.', explanation: `${fmt(v, 1)} × 1.5 = ${fmt(v * 1.5, 1)} m.` }),
          ];
        },
      },
      hard: {
        coach: 'Be doing 140 km/h or more at the signal and stop within 55 m, without stopping more than 15 m after the signal.',
        understand: [
          { title: 'Scaling with speed', body: 'Reaction distance grows in proportion to speed. Braking distance grows with the square of speed. Double the speed: reaction distance × 2, braking distance × 4.', formula: 'd_stop = v t + v² ÷ (2 a)' },
          { title: 'Real roads', body: 'A good road car on dry asphalt brakes at about 7 m/s², much less than a race car. Wet roads are worse. That is why real stopping distances are far longer than the test strip.' },
        ],
        practice: [],
        objective: { timeLimit: 80, brief: 'Pass the signal at 140 km/h or more without braking before it. Stop between 15 and 55 m after it.', legs: [stop({ id: 'stop', label: 'Stopping test', signalAt: 120, minKmhAtSignal: 140, zone: [135, 175] })] },
        apply: r => {
          const f = factory({ ...C7, diff: 'hard' }, 'apply'), rt = m(r, 'stop', 'reactionSec', 0.5), v = m(r, 'stop', 'brakeMs', 40), bd = m(r, 'stop', 'brakeDist', 17);
          return [
            f.num({ stem: `You were travelling at ${fmt(v, 1)} m/s with a reaction time of ${fmt(rt, 2)} s. At twice that speed with the same reaction time, what would the reaction distance be, in metres?`, answer: 2 * v * rt, unit: 'm', floor: 0.4, hint: 'Reaction distance is proportional to speed.', formula: 'd_react = v × t_react', explanation: `2 × ${fmt(v, 1)} × ${fmt(rt, 2)} = ${fmt(2 * v * rt, 1)} m.` }),
            f.num({ stem: `Your braking distance was ${fmt(bd, 1)} m. At twice the speed (same brakes), what total stopping distance would you expect, in metres? Use your reaction time of ${fmt(rt, 2)} s.`, answer: 2 * v * rt + 4 * bd, unit: 'm', rel: 0.02, floor: 0.6, hint: 'Reaction distance doubles; braking distance quadruples.', formula: 'd_stop = v t + v² ÷ (2 a)', explanation: `Reaction: 2 × ${fmt(v, 1)} × ${fmt(rt, 2)} = ${fmt(2 * v * rt, 1)} m. Braking: 4 × ${fmt(bd, 1)} = ${fmt(4 * bd, 1)} m. Total ${fmt(2 * v * rt + 4 * bd, 1)} m.` }),
            f.num({ stem: `A real road car brakes at 7 m/s². From your braking speed of ${fmt(v, 1)} m/s, what braking distance would it need, in metres?`, answer: v * v / (2 * 7), unit: 'm', rel: 0.02, hint: 'd = v² ÷ (2a).', formula: 'd = v² ÷ (2a)', explanation: `${fmt(v, 1)}² ÷ (2 × 7) = ${fmt(v * v / 14, 1)} m.` }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M8
  {
    id: 'm8', order: 8, subject: 'road', concept: 'road.limits', character: 'omar',
    title: 'Limits and Risk', summary: 'Drive three limit zones and see why limits matter.',
    discover: [
      { who: 'omar', text: 'Limits are not suggestions. Each one comes from asking: how fast can a car be and still stop where it needs to?' },
      { who: 'you', text: 'A few km/h cannot matter that much.' },
      { who: 'omar', text: 'It matters more than you think. Drive the three limit zones and I will show you the numbers.' },
    ],
    reflect: ['Which zone was hardest to keep to, and what did you do to manage it?', 'Why are limits lower near schools and in towns?'],
    variants: {
      easy: {
        coach: 'Slow down for the middle zone (130 km/h). A small amount of time over the limit is forgiven.',
        understand: [
          { title: 'Why limits exist', body: 'A slower car can stop in a shorter distance and gives everyone more time to react. Limits are set for what the road, the traffic and the people around it can handle.' },
          { title: 'Big effect of speed', body: 'When speed doubles, the braking distance does not double. It becomes four times longer.' },
        ],
        practice: [factory({ ...C8, diff: 'easy' }, 'practice').choice({ stem: 'A car needs 5 m to brake from 30 km/h. About how far does it need from 60 km/h?', right: '20 m', wrong: ['10 m', '5 m', '15 m'], hint: 'Double the speed: four times the distance.', explanation: 'Double the speed gives four times the braking distance: 5 × 4 = 20 m.' })],
        objective: { timeLimit: 90, brief: 'Keep to the limits: 170, 130, then 170 km/h across three 200 m zones.', legs: zones('easy') },
        apply: r => {
          const f = factory({ ...C8, diff: 'easy' }, 'apply'), lb = M8_LIMITS.easy[1], ms = r1(lb / KMH);
          void r;
          return [
            f.choice({ stem: 'Why are speed limits lower near schools?', right: 'Slower cars stop in a shorter distance', wrong: ['Cars are heavier near schools', 'Brakes work better at low speed only', 'To make the road more fun'], hint: 'Think about how far a car needs to stop.', explanation: 'Slower cars need less distance to stop, which protects people who may step out.' }),
            f.choice({ stem: `The middle zone limit was ${lb} km/h. What is that in m/s?`, right: `${fmt(ms)} m/s`, wrong: [`${fmt(lb * KMH, 0)} m/s`, `${fmt(lb, 0)} m/s`, `${fmt(ms * 2)} m/s`], hint: 'Divide km/h by 3.6.', formula: 'm/s = km/h ÷ 3.6', explanation: `${lb} ÷ 3.6 ≈ ${fmt(ms)} m/s.` }),
            f.choice({ stem: 'Braking distance at 60 km/h is about 18 m. At 120 km/h it is about…', right: '72 m', wrong: ['36 m', '54 m', '18 m'], hint: 'Double the speed: four times the distance.', explanation: 'Braking distance scales with speed squared: 18 × 4 = 72 m.' }),
          ];
        },
      },
      medium: {
        coach: 'Zone limits are 150, 110 and 150 km/h. You may be over by 1.5 s in each zone.',
        understand: [
          { title: 'Time at the limit', body: 'The time to cover a distance at a steady speed is distance ÷ speed. Convert km/h to m/s by dividing by 3.6.', formula: 't = d ÷ v' },
          { title: 'Braking distance and speed', body: 'Braking distance is proportional to speed squared. Going 1.5 times faster makes braking distance 1.5² = 2.25 times longer.', formula: 'd₂ = d₁ × (v₂ ÷ v₁)²' },
        ],
        practice: [factory({ ...C8, diff: 'medium' }, 'practice').num({ stem: 'A car needs 8 m to brake from 40 km/h. How many metres does it need from 80 km/h?', answer: 32, unit: 'm', hint: 'Speed × 2 means distance × 4.', formula: 'd₂ = d₁ × (v₂ ÷ v₁)²', explanation: '8 × (80 ÷ 40)² = 8 × 4 = 32 m.' })],
        objective: { timeLimit: 90, brief: 'Keep to the limits: 150, 110, then 150 km/h across three 200 m zones.', legs: zones('medium') },
        apply: r => {
          const f = factory({ ...C8, diff: 'medium' }, 'apply'), lb = M8_LIMITS.medium[1], tb = m(r, 'z1', 'time', 7);
          return [
            f.num({ stem: `How long (seconds) does it take to cover 200 m at the middle zone's limit of ${lb} km/h?`, answer: 200 / (lb / KMH), unit: 's', rel: 0.02, hint: 'Convert to m/s, then t = d ÷ v.', formula: 't = d ÷ v', explanation: `${lb} km/h = ${fmt(lb / KMH, 2)} m/s. 200 ÷ ${fmt(lb / KMH, 2)} = ${fmt(200 / (lb / KMH), 2)} s.` }),
            f.num({ stem: 'Braking distance at 60 km/h is 18 m. How far does the same car need to brake from 90 km/h? (metres)', answer: 18 * 2.25, unit: 'm', rel: 0.02, hint: '(90 ÷ 60)² = 2.25.', formula: 'd₂ = d₁ × (v₂ ÷ v₁)²', explanation: '18 × 1.5² = 18 × 2.25 = 40.5 m.' }),
            f.num({ stem: `You covered the 200 m middle zone in ${fmt(tb, 2)} s. What was your average speed in km/h?`, answer: 200 / tb * KMH, unit: 'km/h', rel: 0.015, hint: 'Distance ÷ time, then × 3.6.', explanation: `200 ÷ ${fmt(tb, 2)} = ${fmt(200 / tb, 2)} m/s = ${fmt(200 / tb * KMH, 1)} km/h.` }),
          ];
        },
      },
      hard: {
        coach: 'Zone limits are 130, 90 and 130 km/h. Only 0.6 s over is forgiven per zone and hazards are not allowed.',
        understand: [
          { title: 'Risk grows faster than speed', body: 'Braking distance and crash energy both grow with v². A 10% speed increase gives about 21% more braking distance and 21% more kinetic energy.', formula: 'Δ% = ((v₂ ÷ v₁)² − 1) × 100' },
          { title: 'Limits as engineering', body: 'Authorities pick limits so the braking distance at the limit plus reaction distance is shorter than the distance a driver can see ahead.' },
        ],
        practice: [factory({ ...C8, diff: 'hard' }, 'practice').num({ stem: 'By what percentage is the braking distance longer at 60 km/h than at 50 km/h?', answer: ((60 / 50) ** 2 - 1) * 100, unit: '%', rel: 0.03, hint: '(60 ÷ 50)² − 1.', formula: 'Δ% = ((v₂ ÷ v₁)² − 1) × 100', explanation: '1.2² = 1.44, so 44% longer.' })],
        objective: { timeLimit: 90, brief: 'Keep to the limits: 130, 90, then 130 km/h across three 200 m zones with no hazard hits.', legs: zones('hard') },
        apply: r => {
          const f = factory({ ...C8, diff: 'hard' }, 'apply'), lb = M8_LIMITS.hard[1], mx = m(r, 'z1', 'maxKmh', lb);
          const lim = lb / KMH;
          return [
            f.num({ stem: `A driver does ${lb + 20} km/h in a ${lb} km/h zone. By what percentage is their braking distance longer than at the limit?`, answer: (((lb + 20) / lb) ** 2 - 1) * 100, unit: '%', rel: 0.02, floor: 0.4, hint: '((v₂ ÷ v₁)² − 1) × 100.', formula: 'Δ% = ((v₂ ÷ v₁)² − 1) × 100', explanation: `(${lb + 20} ÷ ${lb})² = ${fmt(((lb + 20) / lb) ** 2, 3)}, so ${fmt((((lb + 20) / lb) ** 2 - 1) * 100, 1)}% longer.` }),
            f.num({ stem: `Your fastest speed in the ${lb} km/h zone was ${fmt(mx, 0)} km/h. By what percentage was your kinetic energy higher than at exactly ${lb} km/h? (A negative number means lower.)`, answer: ((mx / lb) ** 2 - 1) * 100, unit: '%', rel: 0.03, floor: 0.6, hint: 'Energy ∝ v², so use (v ÷ limit)² − 1.', explanation: `(${fmt(mx, 0)} ÷ ${lb})² = ${fmt((mx / lb) ** 2, 3)}, so ${fmt(((mx / lb) ** 2 - 1) * 100, 1)}%.` }),
            f.num({ stem: `On dry asphalt (μ = 0.7), how far does a car need to brake from exactly ${lb} km/h? (metres)`, answer: lim * lim / (2 * 0.7 * G), unit: 'm', rel: 0.02, hint: 'Convert to m/s, then d = v² ÷ (2 μ g).', formula: 'd = v² ÷ (2 μ g)', explanation: `${fmt(lim, 2)}² ÷ (2 × 0.7 × 9.8) = ${fmt(lim * lim / (2 * 0.7 * G), 1)} m.` }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M9
  {
    id: 'm9', order: 9, subject: 'road', concept: 'road.hazards', character: 'omar',
    title: 'Hazards and Safe Gaps', summary: 'Read the road ahead and keep a gap you can brake in.',
    discover: [
      { who: 'omar', text: 'The best drivers are not the quickest. They are the ones who saw the problem three seconds earlier than everyone else.' },
      { who: 'you', text: 'Three seconds?' },
      { who: 'omar', text: 'That is the gap you keep so you can react. Today the hazards are barrels and cones on the coast road. Spot them early.' },
    ],
    reflect: ['How far ahead were you looking when you spotted the first hazard?', 'What would you do if the gap to the car ahead shrank suddenly?'],
    variants: {
      easy: {
        coach: 'Look well ahead. Steer smoothly around the barrels and cones. Do not hit any.',
        understand: [
          { title: 'Look far ahead', body: 'Scan the road well in front of the car, not just at the bonnet. The earlier you see a hazard, the more time you have to deal with it.' },
          { title: 'The 3-second rule', body: 'Keep at least 3 seconds between you and the car ahead. At higher speed the gap in metres must be bigger.', formula: 'gap (m) = speed (m/s) × 3' },
        ],
        practice: [factory({ ...C9, diff: 'easy' }, 'practice').choice({ stem: 'You travel at 36 km/h (10 m/s). How many metres is a 3-second gap?', right: '30 m', wrong: ['10 m', '13 m', '3 m'], hint: '10 m every second for 3 seconds.', formula: 'gap = speed × 3', explanation: '10 m/s × 3 s = 30 m.' })],
        objective: { timeLimit: 90, brief: 'Drive the 400 m hazard zone without hitting a barrel, cone or wall.', legs: [sec({ id: 'scan', label: 'Hazard zone', from: 700, to: 1100, noHits: true })] },
        apply: r => {
          const f = factory({ ...C9, diff: 'easy' }, 'apply'), ms = r1(m(r, 'scan', 'avgMs', 50)), kmh = Math.round(ms * KMH);
          return [
            f.choice({ stem: 'A cone appears ahead. What is the best first reaction?', right: 'Look further ahead and steer smoothly around it', wrong: ['Stare at the cone', 'Brake hard in the middle of the bend', 'Speed up to pass it quickly'], hint: 'Early, smooth, and eyes up.', explanation: 'Spotting hazards early lets you steer smoothly and safely.' }),
            f.choice({ stem: 'What does the 3-second rule describe?', right: 'The time gap you keep to the car in front', wrong: ['How long to hold the brake', 'How long a green light lasts', 'The time a drift takes'], hint: 'It is about space between cars.', explanation: 'It is the minimum time gap to the vehicle ahead.' }),
            f.choice({ stem: `Your average speed in the hazard zone was ${fmt(ms)} m/s (${kmh} km/h). How many metres is a 3-second gap at that speed?`, right: `${fmt(ms * 3)} m`, wrong: [`${fmt(ms)} m`, `${fmt(ms * 2)} m`, `${fmt(ms + 3)} m`], hint: 'Speed × 3.', formula: 'gap = speed × 3', explanation: `${fmt(ms)} × 3 = ${fmt(ms * 3)} m.` }),
          ];
        },
      },
      medium: {
        coach: 'Clear the 500 m hazard zone with no hits and an average of at least 90 km/h.',
        understand: [
          { title: 'Time gap to distance', body: 'A time gap becomes a distance by multiplying by speed in m/s.', formula: 'gap (m) = speed (m/s) × gap time (s)' },
          { title: 'Hazard awareness', body: 'Scan, identify, decide, act. Seeing early beats reacting hard. Smooth inputs also keep the car stable.' },
        ],
        practice: [factory({ ...C9, diff: 'medium' }, 'practice').num({ stem: 'You travel at 72 km/h. How many metres is a 3-second gap?', answer: 60, unit: 'm', hint: '72 ÷ 3.6 = 20 m/s, times 3.', formula: 'gap = v × 3', explanation: '72 km/h = 20 m/s. 20 × 3 = 60 m.' })],
        objective: { timeLimit: 90, brief: 'Drive the 500 m hazard zone with no hits and an average of at least 90 km/h.', legs: [sec({ id: 'scan', label: 'Hazard zone', from: 700, to: 1200, noHits: true, minAvgKmh: 90 })] },
        apply: r => {
          const f = factory({ ...C9, diff: 'medium' }, 'apply'), ms = r1(m(r, 'scan', 'avgMs', 50));
          return [
            f.num({ stem: `Your average speed in the zone was ${fmt(ms)} m/s. How many metres is a 3-second gap at that speed?`, answer: ms * 3, unit: 'm', floor: 0.3, hint: 'Speed × 3.', formula: 'gap = v × t', explanation: `${fmt(ms)} × 3 = ${fmt(ms * 3, 1)} m.` }),
            f.num({ stem: `At the same speed, how many metres is a 2-second gap?`, answer: ms * 2, unit: 'm', floor: 0.3, hint: 'Speed × 2.', explanation: `${fmt(ms)} × 2 = ${fmt(ms * 2, 1)} m.` }),
            f.num({ stem: `At ${fmt(ms)} m/s, how many seconds does it take to cover 100 m?`, answer: 100 / ms, unit: 's', rel: 0.02, hint: 'Distance ÷ speed.', formula: 't = d ÷ v', explanation: `100 ÷ ${fmt(ms)} = ${fmt(100 / ms, 2)} s.` }),
          ];
        },
      },
      hard: {
        coach: 'Clear the 900 m hazard zone without a hit, averaging at least 120 km/h.',
        understand: [
          { title: 'Gap in seconds', body: 'To judge a gap, convert it to time: gap time = distance ÷ speed. A gap that is safe at 50 km/h may be dangerous at 120 km/h.', formula: 't_gap = d ÷ v' },
          { title: 'Planning for the worst', body: 'Plan for the car ahead braking hard. You need reaction distance plus braking distance within your gap. Speed matters twice: once in reaction distance, once in braking distance.' },
        ],
        practice: [factory({ ...C9, diff: 'hard' }, 'practice').num({ stem: 'A car follows 25 m behind another at 90 km/h. How many seconds of gap is that?', answer: 1, unit: 's', rel: 0.03, hint: '90 km/h = 25 m/s.', formula: 't_gap = d ÷ v', explanation: '90 ÷ 3.6 = 25 m/s. 25 ÷ 25 = 1 s.' })],
        objective: { timeLimit: 100, brief: 'Drive the 900 m hazard zone with no hits and an average of at least 120 km/h.', legs: [sec({ id: 'scan', label: 'Hazard zone', from: 700, to: 1600, noHits: true, minAvgKmh: 120 })] },
        apply: r => {
          const f = factory({ ...C9, diff: 'hard' }, 'apply'), ms = r1(m(r, 'scan', 'avgMs', 50));
          return [
            f.num({ stem: `You follow another car at 40 m while travelling at your zone average of ${fmt(ms)} m/s. How many seconds of gap is that?`, answer: 40 / ms, unit: 's', rel: 0.02, hint: 'Distance ÷ speed.', formula: 't_gap = d ÷ v', explanation: `40 ÷ ${fmt(ms)} = ${fmt(40 / ms, 2)} s.` }),
            f.num({ stem: `At ${fmt(ms)} m/s, how far does the car travel during a 1.0 s reaction time? (metres)`, answer: ms, unit: 'm', floor: 0.3, hint: 'Speed × 1 s.', explanation: `${fmt(ms)} m/s × 1 s = ${fmt(ms)} m.` }),
            f.num({ stem: 'To keep a 3-second gap, how many extra metres of gap are needed if speed rises by 20 km/h?', answer: 20 / KMH * 3, unit: 'm', rel: 0.03, hint: 'Convert 20 km/h to m/s, then × 3.', explanation: '20 ÷ 3.6 = 5.56 m/s. 5.56 × 3 = 16.7 m.' }),
          ];
        },
      },
    },
  },
];
const r1 = (n: number): number => Math.round(n * 10) / 10;
