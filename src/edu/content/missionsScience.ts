import type { GateLeg, Mission, SectionLeg } from '../types';
import { G, KMH, factory, fmt, m } from './qhelp';

const sec = (l: Omit<SectionLeg, 'kind'>): SectionLeg => ({ kind: 'section', ...l });
const gate = (l: Omit<GateLeg, 'kind'>): GateLeg => ({ kind: 'gate', ...l });
const C4 = { mission: 'm4', concept: 'sci.friction' } as const;
const C5 = { mission: 'm5', concept: 'sci.energy' } as const;
const C6 = { mission: 'm6', concept: 'sci.potential' } as const;

export const SCIENCE_MISSIONS: Mission[] = [
  // ------------------------------------------------------------------ M4
  {
    id: 'm4', order: 4, subject: 'science', concept: 'sci.friction', character: 'lina', lab: 'lab.grip',
    title: 'Grip and Slide', summary: 'Drift, then explain it with friction.',
    discover: [
      { who: 'lina', text: 'See those dark curves on the corner? Rubber left by tyres. The only reason a car turns at all is friction.' },
      { who: 'you', text: 'And drifting?' },
      { who: 'lina', text: 'Drifting is what happens when you ask more of the tyres than they can give. Slide through the bends and I will show you the physics.' },
    ],
    reflect: ['What changed in the way the car felt when it started to slide?', 'Why do drivers slow down on wet or icy roads?'],
    variants: {
      easy: {
        coach: 'Hold Space while turning to start a drift. Keep it up for at least 1.5 seconds in total.',
        understand: [
          { title: 'Friction pulls against sliding', body: 'Friction is a force between two surfaces that resists sliding. Tyres use it to grip, to turn and to brake.' },
          { title: 'Some surfaces grip more', body: 'Dry asphalt grips well. Wet roads grip less. Ice and loose gravel grip very little, so cars slide easily.' },
          { title: 'A drift', body: 'When you drift, the tyres slide sideways and the friction turns motion into heat and tyre smoke.' },
        ],
        practice: [],
        objective: { timeLimit: 90, brief: 'Drift through the bends for at least 1.5 seconds in total.', legs: [sec({ id: 'drift', label: 'Drift section', from: 520, to: 1180, driftSec: 1.5 })] },
        apply: r => {
          const f = factory({ ...C4, diff: 'easy' }, 'apply'), d = m(r, 'drift', 'driftSec', 2), v = m(r, 'drift', 'maxKmh', 150);
          return [
            f.choice({ stem: 'While you drifted, which force between the tyres and the road turned your motion into heat and tyre smoke?', right: 'Friction', wrong: ['Gravity', 'Magnetism', 'Buoyancy'], hint: 'It resists sliding between two surfaces.', explanation: 'Friction resists sliding. It is what heats the tyres and makes smoke.' }),
            f.choice({ stem: 'Which surface would make a car slide the most?', right: 'Ice', wrong: ['Dry asphalt', 'Dry concrete', 'Rough racing tarmac'], hint: 'Think of the surface with the least grip.', explanation: 'Ice has very low friction, so tyres slide easily.' }),
            f.choice({ stem: `You drifted for ${fmt(d, 1)} s and reached ${fmt(v, 0)} km/h. While drifting, the grip of the tyres is…`, right: 'Lower than when driving straight, so the car slides sideways', wrong: ['Higher than when driving straight', 'Exactly the same', 'Zero, so there is no force at all'], hint: 'The tyres are sliding, not rolling.', explanation: 'In a drift the tyres slide, so sideways grip is reduced. Friction still acts, but the car slips.' }),
          ];
        },
      },
      medium: {
        coach: 'Drift for at least 3 seconds in total through the bends.',
        understand: [
          { title: 'Friction force', body: 'Friction force = μ × normal force. For a car on flat ground the normal force equals its weight (mass × g).', formula: 'F = μ × m × g' },
          { title: 'Typical μ values', body: 'Dry asphalt μ ≈ 0.8; wet asphalt μ ≈ 0.5; gravel μ ≈ 0.35; ice μ ≈ 0.15. Use g = 9.8 m/s².' },
          { title: 'Maximum deceleration', body: 'Friction can slow a car by at most a = μ × g. Higher μ means stronger braking.', formula: 'a = μ × g' },
        ],
        practice: [],
        objective: { timeLimit: 90, brief: 'Drift for at least 3 seconds in total.', legs: [sec({ id: 'drift', label: 'Drift section', from: 520, to: 1180, driftSec: 3 })] },
        apply: r => {
          const f = factory({ ...C4, diff: 'medium' }, 'apply'), d = m(r, 'drift', 'driftSec', 3.5), v = m(r, 'drift', 'maxKmh', 160);
          return [
            f.num({ stem: `A 1,200 kg car on dry asphalt (μ = 0.8): what is the maximum friction force in newtons? Use g = 9.8 m/s².`, answer: 0.8 * 1200 * G, unit: 'N', rel: 0.01, hint: 'F = μ × m × g.', formula: 'F = μ × m × g', explanation: `0.8 × 1,200 × 9.8 = ${fmt(0.8 * 1200 * G, 0)} N.` }),
            f.num({ stem: `The same car on wet asphalt (μ = 0.5): maximum friction force in newtons?`, answer: 0.5 * 1200 * G, unit: 'N', rel: 0.01, hint: 'Same formula, lower μ.', explanation: `0.5 × 1,200 × 9.8 = ${fmt(0.5 * 1200 * G, 0)} N.` }),
            f.num({ stem: `You drifted for ${fmt(d, 1)} s, topping ${fmt(v, 0)} km/h. With μ = 0.8, what is the largest deceleration friction can give, in m/s²?`, answer: 0.8 * G, unit: 'm/s²', rel: 0.01, hint: 'a = μ × g.', formula: 'a = μ × g', explanation: `0.8 × 9.8 = ${fmt(0.8 * G, 2)} m/s².` }),
          ];
        },
      },
      hard: {
        coach: 'Drift for at least 4.5 seconds in total and keep the car on the road for most of the section.',
        understand: [
          { title: 'Braking distance', body: 'Friction decelerates the car at a = μ g. Using v² = 2 a d gives the braking distance. Speed must be in m/s.', formula: 'd = v² ÷ (2 μ g)' },
          { title: 'Comparing surfaces', body: 'For the same speed, braking distance is inversely proportional to μ: halve the grip and the distance doubles.' },
        ],
        practice: [],
        objective: { timeLimit: 100, brief: 'Drift for at least 4.5 seconds in total and stay on the road for most of the section.', legs: [sec({ id: 'drift', label: 'Drift section', from: 520, to: 1180, driftSec: 4.5, offRoadMaxSec: 6 })] },
        apply: r => {
          const f = factory({ ...C4, diff: 'hard' }, 'apply'), v = Math.max(60, m(r, 'drift', 'maxKmh', 170)), ms = v / KMH;
          return [
            f.num({ stem: `Your top speed in that section was ${fmt(v, 0)} km/h. On dry asphalt (μ = 0.8), what braking distance would friction alone need from that speed? (metres)`, answer: ms * ms / (2 * 0.8 * G), unit: 'm', rel: 0.02, hint: 'Convert to m/s first (÷ 3.6), then d = v² ÷ (2 μ g).', formula: 'd = v² ÷ (2 μ g)', explanation: `${fmt(v, 0)} km/h = ${fmt(ms, 2)} m/s. d = ${fmt(ms, 2)}² ÷ (2 × 0.8 × 9.8) = ${fmt(ms * ms / (2 * 0.8 * G), 1)} m.` }),
            f.num({ stem: `From the same speed on wet asphalt (μ = 0.5), what braking distance is needed? (metres)`, answer: ms * ms / (2 * 0.5 * G), unit: 'm', rel: 0.02, hint: 'Same formula with μ = 0.5.', explanation: `d = ${fmt(ms, 2)}² ÷ (2 × 0.5 × 9.8) = ${fmt(ms * ms / (2 * 0.5 * G), 1)} m.` }),
            f.num({ stem: 'How many times longer is the wet braking distance than the dry one for the same speed?', answer: 0.8 / 0.5, unit: '×', rel: 0.02, hint: 'Distance is inversely proportional to μ.', explanation: 'd ∝ 1/μ, so the ratio is 0.8 ÷ 0.5 = 1.6.' }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M5
  {
    id: 'm5', order: 5, subject: 'science', concept: 'sci.energy', character: 'lina',
    title: 'Energy of Motion', summary: 'Measure two speeds and see what doubling does to energy.',
    discover: [
      { who: 'lina', text: 'Every moving car carries energy. Today we measure how much more a faster car carries.' },
      { who: 'you', text: 'Twice as fast, twice as much energy?' },
      { who: 'lina', text: 'That is exactly the guess I want you to test. Pass two speed gates and compare.' },
    ],
    reflect: ['Did the energy ratio match your first guess?', 'What does this mean for stopping a faster car?'],
    variants: {
      easy: {
        coach: 'Take gate A slowly (50 to 90 km/h), then speed up and take gate B at 110 to 190 km/h.',
        understand: [
          { title: 'Moving things carry energy', body: 'Energy of motion is called kinetic energy. Heavier and faster things carry more.' },
          { title: 'Speed matters most', body: 'Doubling the speed does not just double the energy. It makes it four times bigger.', formula: 'double speed → 4× energy' },
        ],
        practice: [factory({ ...C5, diff: 'easy' }, 'practice').choice({ stem: 'A car triples its speed. Its kinetic energy becomes…', right: '9 times as much', wrong: ['3 times as much', '6 times as much', 'The same'], hint: 'Energy goes with speed squared: 3 × 3.', explanation: 'Kinetic energy ∝ v². Tripling speed gives 3² = 9 times the energy.' })],
        objective: { timeLimit: 80, brief: 'Pass gate A at 50 to 90 km/h, then gate B at 110 to 190 km/h.', legs: [gate({ id: 'g1', label: 'Gate A', at: 200, minKmh: 50, maxKmh: 90 }), gate({ id: 'g2', label: 'Gate B', at: 380, minKmh: 110, maxKmh: 190 })] },
        apply: r => {
          const f = factory({ ...C5, diff: 'easy' }, 'apply'), a = m(r, 'g1', 'speedKmh', 70), b = m(r, 'g2', 'speedKmh', 140), k = Math.max(1, Math.round(b / a));
          return [
            f.choice({ stem: `You passed gate A at ${fmt(a, 0)} km/h and gate B at ${fmt(b, 0)} km/h. Roughly how many times faster was gate B?`, right: `About ${k} times`, wrong: [`About ${k + 1} times`, `About ${k + 2} times`, `About ${k * 3} times`], hint: 'Divide the second speed by the first.', explanation: `${fmt(b, 0)} ÷ ${fmt(a, 0)} ≈ ${fmt(b / a, 1)}, which is about ${k}.` }),
            f.choice({ stem: 'Kinetic energy grows with the square of speed. If speed doubles, the energy becomes…', right: '4 times as much', wrong: ['2 times as much', 'The same', 'Half as much'], hint: '2 × 2.', formula: 'double speed → 4× energy', explanation: 'Energy ∝ v², and 2² = 4.' }),
            f.choice({ stem: 'Which gate would be harder to stop from?', right: 'Gate B, because the car had more energy there', wrong: ['Gate A, because the car was slower', 'They are the same', 'It depends on the colour'], hint: 'More speed means more energy to remove.', explanation: 'A faster car carries much more energy, so it needs more distance to stop.' }),
          ];
        },
      },
      medium: {
        coach: 'Take gate A at 70 to 100 km/h, then gate B at 140 to 200 km/h.',
        understand: [
          { title: 'Kinetic energy', body: 'Kinetic energy depends on mass and speed. Speed must be in m/s and energy comes out in joules.', formula: 'KE = ½ × m × v²' },
          { title: 'The square matters', body: 'Because speed is squared, a small speed increase gives a large energy increase. Compare energies with the ratio (v₂ ÷ v₁)².', formula: 'KE₂ ÷ KE₁ = (v₂ ÷ v₁)²' },
        ],
        practice: [factory({ ...C5, diff: 'medium' }, 'practice').num({ stem: 'A 900 kg car moves at 20 m/s. What is its kinetic energy in kilojoules?', answer: 180, unit: 'kJ', hint: '½ × 900 × 20² ÷ 1000.', formula: 'KE = ½ m v²', explanation: '½ × 900 × 400 = 180,000 J = 180 kJ.' })],
        objective: { timeLimit: 80, brief: 'Pass gate A at 70 to 100 km/h, then gate B at 140 to 200 km/h.', legs: [gate({ id: 'g1', label: 'Gate A', at: 200, minKmh: 70, maxKmh: 100 }), gate({ id: 'g2', label: 'Gate B', at: 380, minKmh: 140, maxKmh: 200 })] },
        apply: r => {
          const f = factory({ ...C5, diff: 'medium' }, 'apply'), a = m(r, 'g1', 'speedKmh', 85), b = m(r, 'g2', 'speedKmh', 170), vb = b / KMH;
          return [
            f.num({ stem: `Gate A: ${fmt(a, 0)} km/h. Gate B: ${fmt(b, 0)} km/h. By what factor is the speed at B bigger?`, answer: b / a, unit: '×', rel: 0.02, hint: 'Divide B by A.', explanation: `${fmt(b, 0)} ÷ ${fmt(a, 0)} = ${fmt(b / a, 2)}.` }),
            f.num({ stem: `A 1,200 kg car passes gate B at ${fmt(b, 0)} km/h. What is its kinetic energy in kilojoules?`, answer: 0.5 * 1200 * vb * vb / 1000, unit: 'kJ', rel: 0.02, hint: 'Convert to m/s first, then ½ m v².', formula: 'KE = ½ m v²', explanation: `${fmt(b, 0)} km/h = ${fmt(vb, 2)} m/s. ½ × 1,200 × ${fmt(vb, 2)}² = ${fmt(0.5 * 1200 * vb * vb / 1000, 0)} kJ.` }),
            f.num({ stem: 'By what factor is the kinetic energy at gate B bigger than at gate A?', answer: (b / a) ** 2, unit: '×', rel: 0.03, hint: 'Square the speed ratio.', formula: 'KE₂ ÷ KE₁ = (v₂ ÷ v₁)²', explanation: `(${fmt(b / a, 2)})² = ${fmt((b / a) ** 2, 2)}.` }),
          ];
        },
      },
      hard: {
        coach: 'Take gate A at 100 to 130 km/h, then gate B at 190 to 235 km/h.',
        understand: [
          { title: 'Energy change', body: 'The extra energy needed to speed up is the difference in kinetic energies, ½ m (v₂² − v₁²). It is not ½ m (v₂ − v₁)².', formula: 'ΔKE = ½ m (v₂² − v₁²)' },
          { title: 'Link to braking', body: 'Brakes must remove all the kinetic energy. With friction a = μ g the braking distance is v² ÷ (2 μ g), so it also grows with v².', formula: 'd = v² ÷ (2 μ g)' },
        ],
        practice: [factory({ ...C5, diff: 'hard' }, 'practice').num({ stem: 'A car speeds up by 50%. By what percentage does its kinetic energy increase?', answer: 125, unit: '%', hint: '1.5² = 2.25.', explanation: '1.5² = 2.25, so energy rises by 125%.' })],
        objective: { timeLimit: 80, brief: 'Pass gate A at 100 to 130 km/h, then gate B at 190 to 235 km/h.', legs: [gate({ id: 'g1', label: 'Gate A', at: 200, minKmh: 100, maxKmh: 130 }), gate({ id: 'g2', label: 'Gate B', at: 380, minKmh: 190, maxKmh: 235 })] },
        apply: r => {
          const f = factory({ ...C5, diff: 'hard' }, 'apply'), a = m(r, 'g1', 'speedKmh', 115), b = m(r, 'g2', 'speedKmh', 210), va = a / KMH, vb = b / KMH;
          return [
            f.num({ stem: `A 1,100 kg car passes gate A at ${fmt(a, 0)} km/h and gate B at ${fmt(b, 0)} km/h. How much extra kinetic energy (kJ) did it gain between the gates?`, answer: 0.5 * 1100 * (vb * vb - va * va) / 1000, unit: 'kJ', rel: 0.02, hint: 'Convert both speeds to m/s, then ½ m (v₂² − v₁²).', formula: 'ΔKE = ½ m (v₂² − v₁²)', explanation: `½ × 1,100 × (${fmt(vb, 2)}² − ${fmt(va, 2)}²) = ${fmt(0.5 * 1100 * (vb * vb - va * va) / 1000, 0)} kJ.` }),
            f.num({ stem: `On dry asphalt (μ = 0.8), what braking distance does friction alone need from gate B's speed of ${fmt(b, 0)} km/h? (metres)`, answer: vb * vb / (2 * 0.8 * G), unit: 'm', rel: 0.02, hint: 'd = v² ÷ (2 μ g) with v in m/s.', formula: 'd = v² ÷ (2 μ g)', explanation: `${fmt(vb, 2)}² ÷ (2 × 0.8 × 9.8) = ${fmt(vb * vb / (2 * 0.8 * G), 1)} m.` }),
            f.num({ stem: 'If you had passed gate B 10% faster, by what percentage would the kinetic energy have risen?', answer: 21, unit: '%', rel: 0.03, hint: '1.1² − 1.', explanation: '1.1² = 1.21, so energy rises by 21%.' }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M6
  {
    id: 'm6', order: 6, subject: 'science', concept: 'sci.potential', character: 'lina',
    title: 'Cliff Road Energy', summary: 'Climb the cliff road and count the energy you store.',
    discover: [
      { who: 'lina', text: 'The cliff road climbs more than ten metres in a few hundred. Climbing costs energy and stores it.' },
      { who: 'you', text: 'Stored where?' },
      { who: 'lina', text: 'In height. Drive the climb, and on the way down that energy turns back into speed.' },
    ],
    reflect: ['Where did the energy of the climb come from?', 'What happens to the stored energy on the way down?'],
    variants: {
      easy: {
        coach: 'Drive up the climb and keep your average speed above 80 km/h. Stay on the road.',
        understand: [
          { title: 'Height stores energy', body: 'Lifting something up stores energy in it. The higher it goes, the more it stores. We call it gravitational potential energy.' },
          { title: 'Down gives it back', body: 'Driving down a hill turns stored energy back into speed. That is why cars speed up on downhill roads.' },
        ],
        practice: [factory({ ...C6, diff: 'easy' }, 'practice').choice({ stem: 'Two identical cars sit on hills 8 m and 15 m high. Which stores more energy?', right: 'The car on the 15 m hill', wrong: ['The car on the 8 m hill', 'They store the same', 'Neither stores any'], hint: 'Higher means more stored energy.', explanation: 'Potential energy grows with height. The 15 m hill stores more.' })],
        objective: { timeLimit: 80, brief: 'Drive the 300 m climb (rising about 7 m) at 80 km/h or more on average.', legs: [sec({ id: 'climb', label: 'The climb', from: 700, to: 1000, minAvgKmh: 80, offRoadMaxSec: 3 })] },
        apply: r => {
          const f = factory({ ...C6, diff: 'easy' }, 'apply'), dy = m(r, 'climb', 'dy', 6.8);
          return [
            f.choice({ stem: `Between the two gates you climbed ${fmt(dy, 1)} m. Which energy increased as you went up?`, right: 'Gravitational potential energy', wrong: ['Magnetic energy', 'Sound energy', 'No energy changed'], hint: 'It is stored in height.', explanation: 'Height stores gravitational potential energy.' }),
            f.choice({ stem: `Which climb stores more energy in the same car: ${fmt(dy, 1)} m or ${fmt(dy * 2, 1)} m?`, right: `The ${fmt(dy * 2, 1)} m climb`, wrong: [`The ${fmt(dy, 1)} m climb`, 'They store the same', 'Neither stores any'], hint: 'More height, more energy.', explanation: 'Potential energy grows in proportion to height.' }),
            f.choice({ stem: 'When the car rolls back down the hill, the stored energy turns into…', right: 'Kinetic energy (speed)', wrong: ['Magnetic energy', 'More height', 'Nothing at all'], hint: 'Cars speed up downhill.', explanation: 'On the way down the stored energy becomes kinetic energy, so the car speeds up.' }),
          ];
        },
      },
      medium: {
        coach: 'Climb at 120 km/h or more on average.',
        understand: [
          { title: 'Potential energy', body: 'Gravitational potential energy depends on mass, gravity (g = 9.8 m/s²) and height gained.', formula: 'PE = m × g × h' },
          { title: 'Units', body: 'With mass in kg and height in m, energy comes out in joules. Divide by 1,000 for kilojoules.' },
        ],
        practice: [factory({ ...C6, diff: 'medium' }, 'practice').num({ stem: 'An 800 kg car is lifted 6 m up a ramp. How much potential energy does it gain, in kilojoules?', answer: 800 * G * 6 / 1000, unit: 'kJ', rel: 0.01, hint: 'm × g × h ÷ 1000.', formula: 'PE = m g h', explanation: '800 × 9.8 × 6 = 47,040 J = 47.04 kJ.' })],
        objective: { timeLimit: 80, brief: 'Climb the 300 m section at 120 km/h or more on average.', legs: [sec({ id: 'climb', label: 'The climb', from: 700, to: 1000, minAvgKmh: 120, offRoadMaxSec: 3 })] },
        apply: r => {
          const f = factory({ ...C6, diff: 'medium' }, 'apply'), dy = m(r, 'climb', 'dy', 6.8);
          return [
            f.num({ stem: `The road rose ${fmt(dy, 1)} m between the gates. How much potential energy did a 1,000 kg car store, in kilojoules?`, answer: 1000 * G * dy / 1000, unit: 'kJ', rel: 0.01, hint: 'm × g × h ÷ 1000.', formula: 'PE = m g h', explanation: `1,000 × 9.8 × ${fmt(dy, 1)} = ${fmt(1000 * G * dy, 0)} J = ${fmt(G * dy, 1)} kJ.` }),
            f.num({ stem: `A 1,500 kg SUV makes the same ${fmt(dy, 1)} m climb. How much potential energy does it store, in kilojoules?`, answer: 1500 * G * dy / 1000, unit: 'kJ', rel: 0.01, hint: 'Same formula with the new mass.', explanation: `1,500 × 9.8 × ${fmt(dy, 1)} ÷ 1000 = ${fmt(1.5 * G * dy, 1)} kJ.` }),
            f.num({ stem: 'How high must a 1,000 kg car climb to store 100 kJ of potential energy? (metres)', answer: 100000 / (1000 * G), unit: 'm', rel: 0.02, hint: 'Rearrange: h = PE ÷ (m g).', formula: 'h = PE ÷ (m × g)', explanation: 'h = 100,000 ÷ (1,000 × 9.8) = 10.2 m.' }),
          ];
        },
      },
      hard: {
        coach: 'Climb at 150 km/h or more on average, without hitting the barrels.',
        understand: [
          { title: 'Trading speed for height', body: 'If friction is ignored, the kinetic energy at the bottom becomes potential energy at the top: ½ m v² = m g h. Mass cancels, so h = v² ÷ (2 g).', formula: 'h = v² ÷ (2 g)' },
          { title: 'Power', body: 'Power is energy per unit time. Climbing a height h in time t needs at least P = m g h ÷ t.', formula: 'P = m g h ÷ t' },
        ],
        practice: [factory({ ...C6, diff: 'hard' }, 'practice').num({ stem: 'A 1,000 kg car coasting at 30 m/s rolls up a frictionless hill. How high does it get? (metres)', answer: 900 / (2 * G), unit: 'm', rel: 0.02, hint: 'h = v² ÷ (2 g).', formula: 'h = v² ÷ (2 g)', explanation: 'h = 30² ÷ (2 × 9.8) = 45.9 m.' })],
        objective: { timeLimit: 80, brief: 'Climb the 300 m section at 150 km/h or more without hitting a hazard.', legs: [sec({ id: 'climb', label: 'The climb', from: 700, to: 1000, minAvgKmh: 150, noHits: true })] },
        apply: r => {
          const f = factory({ ...C6, diff: 'hard' }, 'apply'), dy = m(r, 'climb', 'dy', 6.8), t = m(r, 'climb', 'time', 5.5), v = m(r, 'climb', 'avgKmh', 190) / KMH;
          return [
            f.num({ stem: `A 1,200 kg car climbs ${fmt(dy, 1)} m. How much potential energy does it store, in kilojoules?`, answer: 1200 * G * dy / 1000, unit: 'kJ', rel: 0.01, hint: 'm g h ÷ 1000.', formula: 'PE = m g h', explanation: `1,200 × 9.8 × ${fmt(dy, 1)} = ${fmt(1200 * G * dy, 0)} J = ${fmt(1.2 * G * dy, 1)} kJ.` }),
            f.num({ stem: `Your average speed on the climb was ${fmt(v, 1)} m/s. Ignoring friction, how high could a car roll up a slope using only that much kinetic energy? (metres)`, answer: v * v / (2 * G), unit: 'm', rel: 0.02, hint: 'h = v² ÷ (2 g).', formula: 'h = v² ÷ (2 g)', explanation: `${fmt(v, 1)}² ÷ (2 × 9.8) = ${fmt(v * v / (2 * G), 1)} m.` }),
            f.num({ stem: `The climb took ${fmt(t, 2)} s and the 1,200 kg car gained ${fmt(dy, 1)} m of height. What minimum power was needed just to gain that height, in kilowatts?`, answer: 1200 * G * dy / t / 1000, unit: 'kW', rel: 0.02, hint: 'Energy ÷ time, then ÷ 1000.', formula: 'P = m g h ÷ t', explanation: `${fmt(1200 * G * dy, 0)} J ÷ ${fmt(t, 2)} s = ${fmt(1200 * G * dy / t, 0)} W = ${fmt(1.2 * G * dy / t, 1)} kW.` }),
          ];
        },
      },
    },
  },
];
