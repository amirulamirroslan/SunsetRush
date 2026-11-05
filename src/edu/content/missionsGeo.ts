import type { GateLeg, Mission, SectionLeg } from '../types';
import { KMH, factory, fmt, m } from './qhelp';

const sec = (l: Omit<SectionLeg, 'kind'>): SectionLeg => ({ kind: 'section', ...l });
const gate = (l: Omit<GateLeg, 'kind'>): GateLeg => ({ kind: 'gate', ...l });
const C13 = { mission: 'm13', concept: 'geo.slope' } as const;
const C14 = { mission: 'm14', concept: 'geo.scale' } as const;
const C15 = { mission: 'm15', concept: 'geo.carbon' } as const;
const f = fmt;

/** Typical petrol-car fuel use by steady speed (km/h to litres per 100 km), shown on the Eco cards and used by the mission questions. */
export const ECO_TABLE: readonly [number, number][] = [[80, 5.5], [100, 6.5], [120, 8.0], [140, 10.0]];
/** The table row nearest to a speed (the lower row wins a tie at the midpoint's lower side). */
export const nearestEco = (kmh: number): [number, number] => ECO_TABLE.reduce((best, row) => (Math.abs(row[0] - kmh) < Math.abs(best[0] - kmh) ? row : best), ECO_TABLE[0]);
const ecoCard = 'Typical petrol car at a steady speed: 80 km/h uses 5.5 litres per 100 km, 100 km/h uses 6.5, 120 km/h uses 8.0 and 140 km/h uses 10.0.';

/** Geography and Environment with Prof. Nia Okafor: slopes and gradient, maps and scale, fuel and carbon. */
export const GEO_MISSIONS: Mission[] = [
  // ------------------------------------------------------------------ M13
  {
    id: 'm13', order: 13, subject: 'geo', concept: 'geo.slope', character: 'nia', lab: 'lab.slope',
    title: 'Reading the Hills', summary: 'Turn the height you climb into a gradient.',
    discover: [
      { who: 'nia', text: 'Geographers measure land in numbers. For a hill, the number is the gradient: how much it climbs for each step forward.' },
      { who: 'you', text: 'I can see it climbs. How do I put a number on it?' },
      { who: 'nia', text: 'Your car already measures the height change. Drive the cliff road and we will work out its gradient.' },
    ],
    reflect: ['Did the hill feel steeper than the number suggests? Why might it?', 'Where have you seen a gradient sign on a real road?'],
    variants: {
      easy: {
        coach: 'Drive up the 300 m climb at 70 km/h or faster and stay on the road.',
        understand: [
          { title: 'Steep or gentle', body: 'A steep slope climbs a lot over a short distance. A gentle slope climbs only a little over a long distance.' },
          { title: 'Rise and run', body: 'The rise is how much the land goes up. The run is how far you move forward along the ground. Gradient compares the two.', formula: 'gradient = rise ÷ run' },
          { title: 'As a percentage', body: 'Multiply by 100 to write the gradient as a percentage. A 5% gradient rises 5 m for every 100 m forward.', formula: 'gradient % = rise ÷ run × 100' },
        ],
        practice: [],
        objective: { timeLimit: 80, brief: 'Drive the 300 m climb (it rises about 7 m) at 70 km/h or more on average.', legs: [sec({ id: 'climb', label: 'The climb', from: 700, to: 1000, minAvgKmh: 70, offRoadMaxSec: 3 })] },
        apply: r => {
          const q = factory({ ...C13, diff: 'easy' }, 'apply'), dy = m(r, 'climb', 'dy', 6.8), g = dy / 300 * 100;
          return [
            q.choice({ stem: `The climb was 300 m long and you rose ${f(dy, 1)} m. Which sum gives the gradient as a percentage?`, right: `${f(dy, 1)} ÷ 300 × 100`, wrong: [`300 ÷ ${f(dy, 1)} × 100`, `${f(dy, 1)} × 300`, `${f(dy, 1)} + 300`], hint: 'Rise divided by run, times 100.', formula: 'gradient % = rise ÷ run × 100', explanation: `Gradient = rise ÷ run × 100 = ${f(dy, 1)} ÷ 300 × 100 ≈ ${f(g, 1)}%.`, why: { [`300 ÷ ${f(dy, 1)} × 100`]: 'That divides the run by the rise, upside down. The rise goes on top.' } }),
            q.choice({ stem: 'What was the gradient of your climb, to the nearest whole percent?', right: `${f(g, 0)}%`, wrong: [`${f(g * 10, 0)}%`, `${f(dy, 0)}%`, `${f(g / 10, 1)}%`], hint: 'Use the sum from the last question.', explanation: `${f(dy, 1)} ÷ 300 × 100 = ${f(g, 1)}%, which is about ${f(g, 0)}%.`, why: { [`${f(dy, 0)}%`]: 'That is the rise in metres. Divide it by the 300 m run before turning it into a percentage.' } }),
            q.choice({ stem: 'A steep mountain road has a gradient of 12%. For every 100 m you move forward, it rises about…', right: '12 m', wrong: ['1.2 m', '120 m', '8.3 m'], hint: 'Percent means per hundred.', explanation: '12% means 12 out of every 100, so 12 m for every 100 m forward.', why: { '8.3 m': 'You divided 100 by 12. A percentage already says how much it rises per 100 m.' } }),
          ];
        },
      },
      medium: {
        coach: 'Drive the climb at 90 km/h or faster and stay on the road.',
        understand: [
          { title: 'Gradient from your drive', body: 'Your car records its height at the start and end of each section. The rise is the difference, and the run is the section length.', formula: 'gradient % = (rise ÷ run) × 100' },
          { title: 'Working backwards', body: 'If you know a gradient and a distance, the rise is the gradient times the run. This is how road planners work out how much a route climbs.', formula: 'rise = gradient % × run ÷ 100' },
          { title: 'Real roads', body: 'Main roads are usually under 8%. A road of 10% or more is steep, and mountain passes can reach 12% to 15%.' },
        ],
        practice: [],
        objective: { timeLimit: 80, brief: 'Drive the 300 m climb at 90 km/h or more on average, staying on the road.', legs: [sec({ id: 'climb', label: 'The climb', from: 700, to: 1000, minAvgKmh: 90, offRoadMaxSec: 3 })] },
        apply: r => {
          const q = factory({ ...C13, diff: 'medium' }, 'apply'), dy = m(r, 'climb', 'dy', 6.8), g = dy / 300 * 100;
          return [
            q.num({ stem: `You rose ${f(dy, 1)} m over the 300 m climb. What was the gradient as a percentage?`, answer: g, unit: '%', rel: 0.02, hint: 'Rise ÷ run × 100.', formula: 'gradient % = rise ÷ run × 100', explanation: `${f(dy, 1)} ÷ 300 × 100 = ${f(g, 2)}%.` }),
            q.num({ stem: 'A road kept that same gradient for 2 km (2,000 m). How many metres would it rise in total?', answer: g * 20, unit: 'm', rel: 0.02, hint: 'Rise = gradient × run ÷ 100.', formula: 'rise = gradient % × run ÷ 100', explanation: `${f(g, 2)} × 2,000 ÷ 100 = ${f(g * 20, 1)} m.` }),
            q.num({ stem: `A road of 8% gradient would rise 24 m over the same 300 m. How many metres more is that than your climb?`, answer: 24 - dy, unit: 'm', rel: 0.02, hint: '8% of 300 m, then subtract your rise.', explanation: `8% of 300 = 24 m. 24 − ${f(dy, 1)} = ${f(24 - dy, 1)} m.` }),
          ];
        },
      },
      hard: {
        coach: 'Drive up the climb, then down the descent, each at 80 km/h or faster.',
        understand: [
          { title: 'Negative gradients', body: 'Going down, the height change is negative, so the gradient is negative. A descent of 5% loses 5 m of height every 100 m.', formula: 'gradient % = (y₂ − y₁) ÷ run × 100' },
          { title: 'Gradient and angle', body: 'A gradient of g% means tan θ = g ÷ 100. A 10% road has an angle of only about 5.7°, so percentages look bigger than angles.', formula: 'θ = arctan(rise ÷ run)' },
          { title: 'Path length versus run', body: 'The road is slightly longer than the horizontal run. For gentle slopes the difference is tiny, so the section length is a good estimate of the run.' },
        ],
        practice: [],
        objective: { timeLimit: 90, brief: 'Climb section (300 m) and descent section (300 m), each at 80 km/h or more on average.', legs: [sec({ id: 'climb', label: 'The climb', from: 700, to: 1000, minAvgKmh: 80, offRoadMaxSec: 3 }), sec({ id: 'down', label: 'The descent', from: 1100, to: 1400, minAvgKmh: 80, offRoadMaxSec: 3 })] },
        apply: r => {
          const q = factory({ ...C13, diff: 'hard' }, 'apply'), d1 = m(r, 'climb', 'dy', 6.8), d2 = m(r, 'down', 'dy', -7.7), g1 = d1 / 3, g2 = d2 / 3;
          return [
            q.num({ stem: `Your climb rose ${f(d1, 1)} m over 300 m and your descent changed height by ${f(d2, 1)} m over 300 m. What was the gradient of the descent, as a percentage? (Use a negative number for a descent.)`, answer: g2, unit: '%', rel: 0.02, hint: 'Height change ÷ run × 100, keeping the sign.', formula: 'gradient % = (y₂ − y₁) ÷ run × 100', explanation: `${f(d2, 1)} ÷ 300 × 100 = ${f(g2, 2)}%.` }),
            q.num({ stem: 'At the gradient of your climb, how many kilometres of road would you need to rise 100 m?', answer: 100 / g1 * 100 / 1000, unit: 'km', rel: 0.03, hint: 'Run = rise ÷ gradient × 100.', formula: 'run = rise ÷ gradient % × 100', explanation: `Your climb gradient was ${f(g1, 2)}%. 100 ÷ ${f(g1, 2)} × 100 = ${f(100 / g1 * 100, 0)} m = ${f(100 / g1 * 100 / 1000, 2)} km.` }),
            q.choice({ stem: 'A road has a gradient of 10%. Its angle to the horizontal is closest to…', right: '5.7°', wrong: ['10°', '45°', '1°'], hint: 'tan θ = rise ÷ run = 0.10.', formula: 'θ = arctan(0.10)', explanation: 'tan θ = 0.10, so θ = arctan 0.10 ≈ 5.7°. A 100% gradient would be 45°.', why: { '10°': 'The percentage is not the angle. Use tan θ = 0.10.', '45°': '45° is a 100% gradient, a rise equal to the run.' } }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M14
  {
    id: 'm14', order: 14, subject: 'geo', concept: 'geo.scale', character: 'nia',
    title: 'Reading the Map', summary: 'Shrink the coast road onto a map and back again.',
    discover: [
      { who: 'nia', text: 'A map is the world shrunk to fit a page. The scale tells you exactly how much it was shrunk.' },
      { who: 'you', text: 'How do I read it?' },
      { who: 'nia', text: 'A scale of 1 to 10,000 means 1 cm on the map is 10,000 cm on the ground. I will mark two gates on the coast road and we will put them on a map.' },
    ],
    reflect: ['Which is easier to read on a map: a long road or a small village? Why?', 'When would you want a map with a smaller scale number?'],
    variants: {
      easy: {
        coach: 'Pass both gates at any speed between 80 and 200 km/h. They are 500 m apart.',
        understand: [
          { title: 'Maps shrink the world', body: 'A map shows a big place on a small page. Every distance is shrunk by the same amount, called the scale.' },
          { title: 'Reading a scale', body: 'A scale of 1 : 10,000 means 1 cm on the map stands for 10,000 cm, which is 100 m, on the ground.', formula: 'real m = map cm × scale ÷ 100' },
          { title: 'Bigger number, less detail', body: 'A 1 : 50,000 map covers much more ground than a 1 : 5,000 map, but shows less detail.' },
        ],
        practice: [factory({ ...C14, diff: 'easy' }, 'practice').choice({ stem: 'On a 1 : 1,000 map, 1 cm stands for how far on the ground?', right: '10 m', wrong: ['1 m', '100 m', '1,000 m'], hint: '1,000 cm is how many metres?', explanation: '1 cm on the map is 1,000 cm = 10 m on the ground.' })],
        objective: { timeLimit: 80, brief: 'Pass the two blue gates (500 m apart) at 80 to 200 km/h.', legs: [gate({ id: 'g1', label: 'Gate A', at: 300, minKmh: 80, maxKmh: 200 }), gate({ id: 'g2', label: 'Gate B', at: 800, minKmh: 80, maxKmh: 200 })] },
        apply: r => {
          const q = factory({ ...C14, diff: 'easy' }, 'apply'), T = m(r, 'g2', 't', 20) - m(r, 'g1', 't', 8.5);
          return [
            q.choice({ stem: 'Your two gates were 500 m apart. On a map drawn at 1 : 10,000, how far apart would they be?', right: '5 cm', wrong: ['50 cm', '0.5 cm', '500 cm'], hint: '1 cm on this map is 100 m.', explanation: '1 cm stands for 100 m, so 500 m is 500 ÷ 100 = 5 cm.', why: { '50 cm': 'That divides by 10, but 1 cm is 100 m on this map.', '500 cm': 'That treats 1 cm as 1 m. On this map 1 cm is 100 m.' } }),
            q.choice({ stem: 'On a 1 : 50,000 map, 2 cm stands for how much real distance?', right: '1 km', wrong: ['100 m', '10 km', '2 km'], hint: '1 cm is 50,000 cm = 500 m.', explanation: '1 cm is 50,000 cm = 500 m, so 2 cm is 1,000 m = 1 km.' }),
            q.choice({ stem: `You took ${f(T, 1)} s between the gates. Which calculation gives your average speed in m/s?`, right: `500 ÷ ${f(T, 1)}`, wrong: [`${f(T, 1)} ÷ 500`, `500 × ${f(T, 1)}`, `500 − ${f(T, 1)}`], hint: 'Speed = distance ÷ time.', formula: 'speed = distance ÷ time', explanation: `The gates are 500 m apart, so speed = 500 ÷ ${f(T, 1)} = ${f(500 / T, 1)} m/s.` }),
          ];
        },
      },
      medium: {
        coach: 'Pass both gates at 80 to 200 km/h. They are 800 m apart.',
        understand: [
          { title: 'Map to ground', body: 'Multiply a map distance in centimetres by the scale number to get ground centimetres, then divide by 100 for metres.', formula: 'real m = map cm × scale ÷ 100' },
          { title: 'Ground to map', body: 'To draw a real distance, convert it to centimetres and divide by the scale number.', formula: 'map cm = real cm ÷ scale' },
          { title: 'Mixing in speed', body: 'Map distances and the time you took give you a speed. Convert to metres first, then divide by the time.' },
        ],
        practice: [factory({ ...C14, diff: 'medium' }, 'practice').num({ stem: 'Two villages are 6 cm apart on a 1 : 25,000 map. What is the real distance in metres?', answer: 1500, unit: 'm', hint: '6 × 25,000 ÷ 100.', formula: 'real m = map cm × scale ÷ 100', explanation: '6 × 25,000 = 150,000 cm = 1,500 m.' })],
        objective: { timeLimit: 85, brief: 'Pass the two blue gates (800 m apart) at 80 to 200 km/h.', legs: [gate({ id: 'g1', label: 'Gate A', at: 300, minKmh: 80, maxKmh: 200 }), gate({ id: 'g2', label: 'Gate B', at: 1100, minKmh: 80, maxKmh: 200 })] },
        apply: r => {
          const q = factory({ ...C14, diff: 'medium' }, 'apply'), T = m(r, 'g2', 't', 28) - m(r, 'g1', 't', 8.5), v = 800 / T * KMH;
          return [
            q.num({ stem: 'Your two gates were 800 m apart. How many centimetres apart are they on a 1 : 20,000 map?', answer: 4, unit: 'cm', hint: '800 m = 80,000 cm. Divide by 20,000.', formula: 'map cm = real cm ÷ scale', explanation: '800 m = 80,000 cm. 80,000 ÷ 20,000 = 4 cm.' }),
            q.num({ stem: 'On a 1 : 25,000 map your route between the gates measures 5 cm. What is the real distance in metres?', answer: 1250, unit: 'm', hint: '5 × 25,000 ÷ 100.', formula: 'real m = map cm × scale ÷ 100', explanation: '5 × 25,000 = 125,000 cm = 1,250 m.' }),
            q.num({ stem: `You took ${f(T, 1)} s between the gates, 800 m apart. What was your average speed in km/h?`, answer: v, unit: 'km/h', rel: 0.02, hint: '800 ÷ time gives m/s. Then × 3.6.', formula: 'km/h = (distance ÷ time) × 3.6', explanation: `800 ÷ ${f(T, 1)} = ${f(800 / T, 2)} m/s, × 3.6 = ${f(v, 1)} km/h.` }),
          ];
        },
      },
      hard: {
        coach: 'Pass both gates at 100 to 180 km/h. They are 1,200 m apart.',
        understand: [
          { title: 'Finding the scale', body: 'If you know a map distance and the real distance, the scale number is the real distance in cm divided by the map distance in cm.', formula: 'scale = real cm ÷ map cm' },
          { title: 'Speed on the map', body: 'Your speed shrinks by the scale too. A car doing 30 m/s moves across a 1 : 20,000 map at 30 × 1,000 mm ÷ 20,000 = 1.5 mm per second.', formula: 'map speed = real speed ÷ scale' },
          { title: 'Detail and coverage', body: 'A smaller scale number (1 : 5,000) shows more detail but covers less ground per page. Areas shrink by the square of the scale.' },
        ],
        practice: [factory({ ...C14, diff: 'hard' }, 'practice').num({ stem: 'A 3 km stretch of coast measures 12 cm on a map. What is the scale number N in 1 : N?', answer: 25000, unit: '', hint: '3 km = 300,000 cm. Divide by 12.', formula: 'scale = real cm ÷ map cm', explanation: '300,000 ÷ 12 = 25,000, so the scale is 1 : 25,000.' })],
        objective: { timeLimit: 90, brief: 'Pass the two blue gates (1,200 m apart) at 100 to 180 km/h.', legs: [gate({ id: 'g1', label: 'Gate A', at: 300, minKmh: 100, maxKmh: 180 }), gate({ id: 'g2', label: 'Gate B', at: 1500, minKmh: 100, maxKmh: 180 })] },
        apply: r => {
          const q = factory({ ...C14, diff: 'hard' }, 'apply'), T = m(r, 'g2', 't', 40) - m(r, 'g1', 't', 8), v = 1200 / T;
          return [
            q.num({ stem: 'On a map, your gates (1,200 m apart) are 6 cm apart. What is the scale number N in 1 : N?', answer: 20000, unit: '', hint: '1,200 m = 120,000 cm. Divide by 6.', formula: 'scale = real cm ÷ map cm', explanation: '120,000 ÷ 6 = 20,000, so the scale is 1 : 20,000.' }),
            q.num({ stem: `You drove between the gates (1,200 m) in ${f(T, 1)} s. On a 1 : 20,000 map, how fast did your car move across the page, in mm per second?`, answer: v / 20, unit: 'mm/s', rel: 0.03, floor: 0.02, hint: 'Speed in m/s × 1,000 mm, then ÷ 20,000.', formula: 'map speed = real speed ÷ scale', explanation: `${f(v, 2)} m/s = ${f(v * 1000, 0)} mm/s on the ground. ÷ 20,000 = ${f(v / 20, 2)} mm/s.` }),
            q.choice({ stem: 'Two maps cover the same coast, one at 1 : 25,000 and one at 1 : 50,000. Which shows more detail of a small harbour?', right: 'The 1 : 25,000 map, because 1 cm covers less ground', wrong: ['The 1 : 50,000 map, because the number is bigger', 'Both show the same detail', 'Neither: detail depends on paper size only'], hint: 'Which map spends more centimetres on each kilometre?', explanation: 'On the 1 : 25,000 map 1 km takes 4 cm, but on the 1 : 50,000 map it takes 2 cm. More paper per kilometre means more room for detail.', why: { 'The 1 : 50,000 map, because the number is bigger': 'A bigger scale number means more shrinking, so less room for detail.' } }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M15
  {
    id: 'm15', order: 15, subject: 'geo', concept: 'geo.carbon', character: 'nia', lab: 'lab.carbon',
    title: 'The Eco Run', summary: 'Drive smoothly and count the carbon cost of speed.',
    discover: [
      { who: 'nia', text: 'Every litre of petrol burned puts carbon dioxide into the air. Drivers cannot change the chemistry, but they can change how much fuel they burn.' },
      { who: 'you', text: 'By driving slower?' },
      { who: 'nia', text: 'Largely, yes. Steady, moderate speed. Drive the eco section and we will put numbers on what it saves.' },
    ],
    reflect: ['What is one habit that would cut your fuel use on a long trip?', 'Is the fastest route always the cheapest in fuel and carbon?'],
    variants: {
      easy: {
        coach: 'Drive the 600 m eco section at 70 km/h or more, but keep under the 130 km/h limit.',
        understand: [
          { title: 'Burning fuel makes CO₂', body: 'A car engine burns fuel and releases carbon dioxide (CO₂). CO₂ is a gas that traps heat in the atmosphere, so less fuel burned means a smaller climate effect.' },
          { title: 'Speed costs fuel', body: ecoCard, formula: 'litres per 100 km' },
          { title: 'Counting CO₂', body: 'Each litre of petrol burned releases about 2.3 kg of CO₂. So 10 litres makes about 23 kg.', formula: 'CO₂ (kg) = litres × 2.3' },
        ],
        practice: [],
        objective: { timeLimit: 85, brief: 'Drive the 600 m eco section at 70 km/h or more on average, staying under 130 km/h (a few seconds over is forgiven).', legs: [sec({ id: 'eco', label: 'Eco section', from: 560, to: 1160, minAvgKmh: 70, limitKmh: 130, overAllowSec: 3 })] },
        apply: r => {
          const q = factory({ ...C15, diff: 'easy' }, 'apply'), v = m(r, 'eco', 'avgKmh', 98), [rowKmh, cons] = nearestEco(v);
          const others = ECO_TABLE.filter(row => row[0] !== rowKmh).map(row => `${row[1].toFixed(1)} L/100 km`);
          return [
            q.choice({ stem: `You averaged ${f(v, 0)} km/h over the eco section. Using the table (80, 100, 120, 140 km/h), which fuel use is the closest match?`, right: `${cons.toFixed(1)} L/100 km`, wrong: others, hint: 'Find the table speed nearest to your average.', explanation: `${f(v, 0)} km/h is closest to ${rowKmh} km/h, which uses ${cons.toFixed(1)} litres per 100 km.` }),
            q.choice({ stem: 'Burning 1 litre of petrol makes about 2.3 kg of CO₂. How much CO₂ does 10 litres make?', right: '23 kg', wrong: ['2.3 kg', '230 kg', '12.3 kg'], hint: 'Litres × 2.3.', formula: 'CO₂ (kg) = litres × 2.3', explanation: '10 × 2.3 = 23 kg.', why: { '12.3 kg': 'You added. Each litre makes 2.3 kg, so multiply the litres by 2.3.' } }),
            q.choice({ stem: 'Which change cuts fuel burned and CO₂ released on a long motorway journey the most?', right: 'Driving at a lower, steady speed', wrong: ['Driving faster to finish sooner', 'Braking and speeding up often', 'Carrying extra weight'], hint: 'Look at how the table changes with speed.', explanation: 'Fuel use rises quickly with speed, and constant braking and accelerating wastes energy as heat.' }),
          ];
        },
      },
      medium: {
        coach: 'Drive the 600 m eco section at 70 km/h or more, but stay under the 110 km/h limit (1.5 s over is forgiven).',
        understand: [
          { title: 'Fuel for a trip', body: 'Fuel used = distance ÷ 100 × consumption in litres per 100 km.', formula: 'litres = km ÷ 100 × L/100 km' },
          { title: 'Fuel and speed', body: ecoCard },
          { title: 'CO₂ for a trip', body: 'Multiply the fuel by 2.3 kg of CO₂ per litre.', formula: 'CO₂ (kg) = litres × 2.3' },
        ],
        practice: [],
        objective: { timeLimit: 85, brief: 'Drive the 600 m eco section at 70 km/h or more on average, staying under 110 km/h (1.5 s over is forgiven).', legs: [sec({ id: 'eco', label: 'Eco section', from: 560, to: 1160, minAvgKmh: 70, limitKmh: 110, overAllowSec: 1.5 })] },
        apply: r => {
          const q = factory({ ...C15, diff: 'medium' }, 'apply'), v = m(r, 'eco', 'avgKmh', 98), [rowKmh, cons] = nearestEco(v), fuel = 150 * cons / 100, fast = 150 * 10 / 100;
          return [
            q.num({ stem: `At your average of ${f(v, 0)} km/h a car uses about ${cons.toFixed(1)} L/100 km (nearest table row, ${rowKmh} km/h). How much fuel does a 150 km trip need, in litres?`, answer: fuel, unit: 'litres', hint: 'distance ÷ 100 × consumption.', formula: 'litres = km ÷ 100 × L/100 km', explanation: `150 ÷ 100 × ${cons.toFixed(1)} = ${f(fuel, 2)} litres.` }),
            q.num({ stem: 'How much CO₂ does that fuel release, at 2.3 kg per litre? (kg)', answer: fuel * 2.3, unit: 'kg', rel: 0.02, hint: 'Fuel from the last question × 2.3.', formula: 'CO₂ (kg) = litres × 2.3', explanation: `${f(fuel, 2)} × 2.3 = ${f(fuel * 2.3, 1)} kg.` }),
            q.num({ stem: 'Another driver covers the same 150 km at 140 km/h (10.0 L/100 km). How many more kg of CO₂ do they release than you?', answer: (fast - fuel) * 2.3, unit: 'kg', rel: 0.03, hint: 'Fuel difference, then × 2.3.', explanation: `They burn ${f(fast, 1)} litres and you burn ${f(fuel, 2)}. The difference ${f(fast - fuel, 2)} litres × 2.3 = ${f((fast - fuel) * 2.3, 1)} kg.` }),
          ];
        },
      },
      hard: {
        coach: 'Drive the 600 m eco section at 70 km/h or more, but stay under the 100 km/h limit (0.8 s over is forgiven).',
        understand: [
          { title: 'Fuel use and speed', body: ecoCard },
          { title: 'Grams per kilometre', body: 'Car makers quote CO₂ per kilometre. One litre per 100 km is 23 g of CO₂ per km, so multiply the consumption by 23.', formula: 'g/km = L/100 km × 23' },
          { title: 'Comparing choices', body: 'To compare two ways of making a trip, find the fuel for each, convert to CO₂, and subtract. Small differences in consumption add up over long distances.' },
        ],
        practice: [],
        objective: { timeLimit: 85, brief: 'Drive the 600 m eco section at 70 km/h or more on average, staying under 100 km/h (0.8 s over is forgiven).', legs: [sec({ id: 'eco', label: 'Eco section', from: 560, to: 1160, minAvgKmh: 70, limitKmh: 100, overAllowSec: 0.8 })] },
        apply: r => {
          const q = factory({ ...C15, diff: 'hard' }, 'apply'), v = m(r, 'eco', 'avgKmh', 92), [, cons] = nearestEco(v), fuel = 250 * cons / 100, save = 250 * (8.0 - cons) / 100 * 2.3;
          return [
            q.num({ stem: `Your average of ${f(v, 0)} km/h matches about ${cons.toFixed(1)} L/100 km. How much CO₂ does a 250 km trip release at that speed, in kg? (2.3 kg per litre)`, answer: fuel * 2.3, unit: 'kg', rel: 0.02, hint: 'Fuel for 250 km first, then × 2.3.', formula: 'CO₂ = km ÷ 100 × L/100 km × 2.3', explanation: `250 ÷ 100 × ${cons.toFixed(1)} = ${f(fuel, 2)} litres. × 2.3 = ${f(fuel * 2.3, 1)} kg.` }),
            q.num({ stem: 'Compared with driving the same 250 km at 120 km/h (8.0 L/100 km), how many kg of CO₂ does your speed save?', answer: save, unit: 'kg', rel: 0.03, hint: 'Fuel saved, then × 2.3.', explanation: `The fuel difference is 250 ÷ 100 × (8.0 − ${cons.toFixed(1)}) = ${f(250 * (8.0 - cons) / 100, 2)} litres. × 2.3 = ${f(save, 1)} kg.` }),
            q.num({ stem: `A car burning ${cons.toFixed(1)} L/100 km releases how many grams of CO₂ per kilometre?`, answer: cons * 23, unit: 'g/km', rel: 0.02, hint: 'Multiply the consumption by 23.', formula: 'g/km = L/100 km × 23', explanation: `${cons.toFixed(1)} × 23 = ${f(cons * 23, 1)} g/km.` }),
          ];
        },
      },
    },
  },
];
