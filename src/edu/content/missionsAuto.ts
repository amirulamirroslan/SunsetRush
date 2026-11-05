import type { Mission, SectionLeg, StopLeg } from '../types';
import { KMH, factory, fmt, m } from './qhelp';

const sec = (l: Omit<SectionLeg, 'kind'>): SectionLeg => ({ kind: 'section', ...l });
const stop = (l: Omit<StopLeg, 'kind'>): StopLeg => ({ kind: 'stop', ...l });
const C10 = { mission: 'm10', concept: 'auto.gearing' } as const;
const C11 = { mission: 'm11', concept: 'auto.aero' } as const;
const C12 = { mission: 'm12', concept: 'auto.brakes' } as const;
const f = fmt;

/** Automotive Engineering with Mei Tanaka: gears and engine speed, air drag, brakes and heat. Wheels are 2 m round in every gearing question. */
export const AUTO_MISSIONS: Mission[] = [
  // ------------------------------------------------------------------ M10
  {
    id: 'm10', order: 10, subject: 'auto', concept: 'auto.gearing', character: 'mei', lab: 'lab.gearbox',
    title: 'Gears and Revs', summary: 'Link wheel speed to engine speed through the gearbox.',
    discover: [
      { who: 'mei', text: 'Welcome to the pit wall. The engine only works well in a narrow band of revs, but the car has to cover every speed from a standing start to flat out. The gearbox is the translator.' },
      { who: 'you', text: 'So how do the revs and the road speed connect?' },
      { who: 'mei', text: 'Through the wheels and a ratio. Drive the timing sections and I will turn your speed into engine revs.' },
    ],
    reflect: ['Which section needed the higher gear ratio, and why?', 'What would the engine sound like if the car stayed in first gear at top speed?'],
    variants: {
      easy: {
        coach: 'Drive the section at a steady speed between 90 and 190 km/h. Your speed becomes the wheel speed.',
        understand: [
          { title: 'Wheels turn, the car moves', body: 'Every full turn of a wheel moves the car forward by the wheel\'s circumference. In these lessons the wheels are 2 m round, so one turn is 2 m.' },
          { title: 'The gearbox is a translator', body: 'A gear ratio of 3 : 1 means the engine turns 3 times for every 1 turn of the wheel. A high ratio (low gear) pulls hard. A low ratio (high gear) lets the car go fast without over-revving.', formula: 'engine turns = wheel turns × ratio' },
          { title: 'Turns per second', body: 'To find how often the wheel turns, divide the speed in m/s by 2 m.', formula: 'wheel turns per second = speed ÷ 2' },
        ],
        practice: [],
        objective: { timeLimit: 70, brief: 'Drive through the 300 m timing section at 90 to 190 km/h on average.', legs: [sec({ id: 'run', label: 'Gear run', from: 100, to: 400, minAvgKmh: 90, maxAvgKmh: 190 })] },
        apply: r => {
          const q = factory({ ...C10, diff: 'easy' }, 'apply'), v = m(r, 'run', 'avgMs', 30);
          return [
            q.choice({ stem: `You averaged ${f(v, 1)} m/s. With 2 m wheels, about how many wheel turns happen every second?`, right: `${f(v / 2, 1)} turns`, wrong: [`${f(v * 2, 1)} turns`, `${f(v, 1)} turns`, `${f(v / 4, 1)} turns`], hint: 'Divide the speed by the distance each turn covers.', formula: 'turns per second = speed ÷ 2', explanation: `Each turn moves the car 2 m, so ${f(v, 1)} ÷ 2 = ${f(v / 2, 1)} turns per second.`, why: { [`${f(v * 2, 1)} turns`]: 'You multiplied by 2. Each turn covers 2 m, so a given speed needs fewer turns, not more: divide.', [`${f(v, 1)} turns`]: 'That would be 1 m per turn. Our wheels cover 2 m per turn.' } }),
            q.choice({ stem: 'The gearbox ratio is 3 : 1. The wheels turn 10 times a second. How many times a second does the engine turn?', right: '30 times', wrong: ['3.3 times', '13 times', '10 times'], hint: 'The engine turns 3 times for every wheel turn.', formula: 'engine turns = wheel turns × ratio', explanation: 'The engine turns 3 times for each wheel turn: 10 × 3 = 30 turns per second.', why: { '3.3 times': 'You divided by the ratio. The engine turns faster than the wheels here, so multiply.', '13 times': 'You added the ratio. The engine turns 3 times for each wheel turn, so multiply.' } }),
            q.choice({ stem: 'Which gear is best for pulling away from a standstill?', right: 'A low gear with a high ratio', wrong: ['A high gear with a low ratio', 'Neutral', 'It makes no difference'], hint: 'Think of the easiest gear on a bicycle for a steep hill.', explanation: 'A high ratio multiplies the engine\'s turning force, which is what you need to get moving.', why: { 'A high gear with a low ratio': 'High gears are for speed once you are moving. They give less pulling force.' } }),
          ];
        },
      },
      medium: {
        coach: 'Drive a slow section (60 to 110 km/h) and then a fast one (120 to 170 km/h). The same engine has to cover both.',
        understand: [
          { title: 'From speed to wheel revs', body: 'Wheel revolutions per minute (rpm) = turns per second × 60, and turns per second = speed (m/s) ÷ wheel circumference.', formula: 'wheel rpm = (v ÷ C) × 60' },
          { title: 'From wheel revs to engine revs', body: 'The total gear ratio multiplies the wheel revs to give the engine revs.', formula: 'engine rpm = wheel rpm × ratio' },
          { title: 'Engines have a limit', body: 'Every engine has a maximum safe speed, the rev limit. The gear ratio sets the road speed at which you reach it.' },
        ],
        practice: [],
        objective: { timeLimit: 80, brief: 'Slow section (300 m): average 60 to 110 km/h. Fast section (300 m): average 120 to 170 km/h.', legs: [sec({ id: 'lo', label: 'Low-gear section', from: 100, to: 400, minAvgKmh: 60, maxAvgKmh: 110 }), sec({ id: 'hi', label: 'High-gear section', from: 560, to: 860, minAvgKmh: 120, maxAvgKmh: 170 })] },
        apply: r => {
          const q = factory({ ...C10, diff: 'medium' }, 'apply'), vh = m(r, 'hi', 'avgMs', 38);
          return [
            q.num({ stem: `On your fast section you averaged ${f(vh, 1)} m/s. With 2 m wheels, how many wheel revolutions per minute is that?`, answer: vh * 30, unit: 'rpm', hint: 'Turns per second, then × 60.', formula: 'wheel rpm = (v ÷ 2) × 60', explanation: `${f(vh, 1)} ÷ 2 = ${f(vh / 2, 2)} turns per second, and × 60 = ${f(vh * 30, 0)} rpm.` }),
            q.num({ stem: 'The total gear ratio on that section was 4.0 : 1. What engine speed did your fast section need, in rpm?', answer: vh * 120, unit: 'rpm', hint: 'Use the wheel rpm you just found.', formula: 'engine rpm = wheel rpm × ratio', explanation: `${f(vh * 30, 0)} × 4 = ${f(vh * 120, 0)} rpm.` }),
            q.num({ stem: 'An engine has a rev limit of 6,500 rpm and the total ratio is 4.0 : 1. What is the greatest speed in km/h on 2 m wheels?', answer: 6500 / 4 * 2 / 60 * KMH, unit: 'km/h', rel: 0.012, hint: 'Wheel rpm = 6,500 ÷ 4, then work out the speed in m/s and convert.', formula: 'v = (wheel rpm × 2 ÷ 60) × 3.6', explanation: '6,500 ÷ 4 = 1,625 wheel rpm = 54.17 m/s = 195 km/h.' }),
          ];
        },
      },
      hard: {
        coach: 'Drive the slow section at 80 to 100 km/h, then the fast section at 150 to 200 km/h. Then work backwards from your speed to the gearing.',
        understand: [
          { title: 'Total ratio', body: 'The total ratio is the gear ratio multiplied by the final drive. A fourth gear of 1.3 with a final drive of 3.0 gives a total of 3.9 : 1.', formula: 'total = gear × final drive' },
          { title: 'Choosing a ratio', body: 'Rearranged, the ratio that holds the engine at a target speed is the target engine rpm divided by the wheel rpm.', formula: 'ratio = engine rpm ÷ wheel rpm' },
          { title: 'The trade-off', body: 'A lower total ratio keeps revs down at speed, which saves fuel and noise. But it multiplies the engine\'s turning force less, so pulling away and climbing get harder.' },
        ],
        practice: [],
        objective: { timeLimit: 85, brief: 'Slow section (300 m): average 80 to 100 km/h. Fast section (300 m): average 150 to 200 km/h.', legs: [sec({ id: 'lo', label: 'Low-gear section', from: 100, to: 400, minAvgKmh: 80, maxAvgKmh: 100 }), sec({ id: 'hi', label: 'High-gear section', from: 560, to: 860, minAvgKmh: 150, maxAvgKmh: 200 })] },
        apply: r => {
          const q = factory({ ...C10, diff: 'hard' }, 'apply'), vb = m(r, 'hi', 'avgKmh', 160), wr = vb / KMH * 30;
          return [
            q.num({ stem: `On 2 m wheels, with a total ratio of 3.9 : 1, what engine speed does your fast-section average of ${f(vb, 0)} km/h need, in rpm?`, answer: wr * 3.9, unit: 'rpm', rel: 0.02, hint: 'km/h to m/s, then wheel rpm, then × ratio.', formula: 'engine rpm = (v ÷ 2 × 60) × ratio', explanation: `${f(vb, 0)} km/h = ${f(vb / KMH, 1)} m/s, wheel rpm = ${f(wr, 0)}, × 3.9 = ${f(wr * 3.9, 0)} rpm.` }),
            q.num({ stem: `What total ratio would hold the engine at exactly 5,500 rpm at your fast-section speed of ${f(vb, 0)} km/h?`, answer: 5500 / wr, unit: ': 1', rel: 0.02, hint: 'Ratio = engine rpm ÷ wheel rpm.', formula: 'ratio = engine rpm ÷ wheel rpm', explanation: `Wheel rpm is ${f(wr, 0)}, so 5,500 ÷ ${f(wr, 0)} = ${f(5500 / wr, 2)} : 1.` }),
            q.choice({ stem: 'Why does a car use a much lower total ratio in top gear than in first gear?', right: 'So the engine turns slowly at high road speed, saving fuel and noise, at the cost of pulling force', wrong: ['So the wheels turn faster than the road allows', 'Because top gear needs more engine torque', 'To make the engine heavier at speed'], hint: 'What happens to revs if the ratio stays high at 150 km/h?', explanation: 'A low ratio keeps engine revs reasonable at high speed. First gear needs a high ratio to multiply turning force for pulling away.', why: { 'Because top gear needs more engine torque': 'It is the other way round: first gear needs the extra turning force, top gear needs revs kept down.' } }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M11
  {
    id: 'm11', order: 11, subject: 'auto', concept: 'auto.aero', character: 'mei',
    title: 'Fighting the Air', summary: 'See how air drag explodes as you go faster.',
    discover: [
      { who: 'mei', text: 'At 50 km/h you hardly notice the air. At 200 km/h it feels like a wall. Nothing about the air changed. Only your speed did.' },
      { who: 'you', text: 'Why does it get so much worse?' },
      { who: 'mei', text: 'Because the drag grows with the square of your speed. Drive a slow section and a fast one, and we will measure the difference.' },
    ],
    reflect: ['Where on the coast road does air drag matter most?', 'Why do racing cars have wings if wings add drag?'],
    variants: {
      easy: {
        coach: 'Drive the slow section at 70 to 110 km/h, then the fast section at least 20% faster.',
        understand: [
          { title: 'Air pushes back', body: 'As a car moves, it has to push air out of the way. The air pushes back on the car. We call that push air drag.' },
          { title: 'Faster means much more drag', body: 'Drag does not grow in step with speed. When you double your speed, the drag becomes four times bigger.' },
          { title: 'Shape matters', body: 'Low, smooth, pointed shapes let the air slip past. Tall boxy shapes push the air hard, so they have more drag.' },
        ],
        practice: [factory({ ...C11, diff: 'easy' }, 'practice').choice({ stem: 'A car goes from 20 km/h to 40 km/h. The speed doubled. The drag became…', right: 'Four times bigger', wrong: ['Twice as big', 'The same', 'Half as big'], hint: 'Double the speed: four times the drag.', explanation: 'Drag grows with speed squared, so doubling the speed makes it four times bigger.' })],
        objective: { timeLimit: 85, brief: 'Slow section (300 m): average 70 to 110 km/h. Fast section (300 m): at least 100 km/h and at least 20% faster than the slow one.', legs: [sec({ id: 'slow', label: 'Slow section', from: 100, to: 400, minAvgKmh: 70, maxAvgKmh: 110 }), sec({ id: 'fast', label: 'Fast section', from: 560, to: 860, minAvgKmh: 100, fasterThanPrevPct: 20 })] },
        apply: r => {
          const q = factory({ ...C11, diff: 'easy' }, 'apply'), va = m(r, 'slow', 'avgKmh', 90), vb = m(r, 'fast', 'avgKmh', 112);
          return [
            q.choice({ stem: `You drove ${f(va, 0)} km/h on the slow section and ${f(vb, 0)} km/h on the fast one. Which section had more air drag pushing back on the car?`, right: 'The fast section', wrong: ['The slow section', 'Both the same', 'Neither: air only matters over 300 km/h'], hint: 'Drag grows with speed.', explanation: 'Drag grows quickly with speed, so the faster section had more drag.', why: { 'The slow section': 'Drag grows with speed, so the faster section has more.', 'Neither: air only matters over 300 km/h': 'Air drag acts at every speed. It just becomes dominant at high speed.' } }),
            q.choice({ stem: 'If you doubled your speed, the air drag would become…', right: 'Four times bigger', wrong: ['Twice as big', 'Eight times bigger', 'The same'], hint: 'Drag follows the square of the speed.', formula: 'drag ∝ speed²', explanation: 'Drag ∝ speed², so doubling the speed gives 2² = 4 times the drag.', why: { 'Twice as big': 'That is what you would get if drag grew in step with speed. It grows with speed squared.', 'Eight times bigger': 'Eight times is for the power needed (speed cubed), not the drag force.' } }),
            q.choice({ stem: 'Race cars use wings to press the car down onto the road. What is the price of that extra downforce?', right: 'More drag, so a lower top speed', wrong: ['Less grip in corners', 'A heavier engine', 'Less fuel needed'], hint: 'Anything that pushes the air also gets pushed back.', explanation: 'Wings push the car down and also push against the air, adding drag. Teams trade downforce for top speed.', why: { 'Less grip in corners': 'Downforce increases grip. The cost shows up on the straights instead.' } }),
          ];
        },
      },
      medium: {
        coach: 'Drive the slow section at 70 to 110 km/h, then the fast section at least 35% faster.',
        understand: [
          { title: 'Drag grows with speed squared', body: 'If speed goes up by a factor k, drag goes up by k². Going 1.5 times faster means 2.25 times the drag.', formula: 'F₂ = F₁ × (v₂ ÷ v₁)²' },
          { title: 'Power grows even faster', body: 'The power the engine spends pushing through the air is force × speed, so it grows with the cube of speed.', formula: 'P = F × v' },
          { title: 'Units', body: 'Force in newtons, speed in m/s gives power in watts. Divide by 1,000 for kilowatts.' },
        ],
        practice: [factory({ ...C11, diff: 'medium' }, 'practice').num({ stem: 'The drag on a car is 200 N at 10 m/s. What is the drag at 30 m/s, in newtons?', answer: 1800, unit: 'N', hint: 'Speed × 3, so drag × 3².', formula: 'F₂ = F₁ × (v₂ ÷ v₁)²', explanation: '200 × 3² = 200 × 9 = 1800 N.' })],
        objective: { timeLimit: 85, brief: 'Slow section (300 m): average 70 to 110 km/h. Fast section (300 m): at least 120 km/h and at least 35% faster than the slow one.', legs: [sec({ id: 'slow', label: 'Slow section', from: 100, to: 400, minAvgKmh: 70, maxAvgKmh: 110 }), sec({ id: 'fast', label: 'Fast section', from: 560, to: 860, minAvgKmh: 120, fasterThanPrevPct: 35 })] },
        apply: r => {
          const q = factory({ ...C11, diff: 'medium' }, 'apply'), va = m(r, 'slow', 'avgKmh', 90), vb = m(r, 'fast', 'avgKmh', 125), k2 = (vb / va) ** 2, F = 300 * k2, v = vb / KMH;
          return [
            q.num({ stem: `Your fast section averaged ${f(vb, 1)} km/h and your slow section ${f(va, 1)} km/h. How many times larger was the air drag on the fast section?`, answer: k2, unit: '×', rel: 0.02, hint: 'Divide the speeds, then square the result.', formula: 'drag ratio = (v₂ ÷ v₁)²', explanation: `(${f(vb, 1)} ÷ ${f(va, 1)})² = ${f(k2, 2)}.` }),
            q.num({ stem: 'On the slow section the drag was 300 N. What was the drag on the fast section, in newtons?', answer: F, unit: 'N', rel: 0.02, hint: '300 × the drag ratio you just found.', formula: 'F₂ = F₁ × (v₂ ÷ v₁)²', explanation: `300 × ${f(k2, 2)} = ${f(F, 0)} N.` }),
            q.num({ stem: `The drag on the fast section was ${f(F, 0)} N at ${f(v, 1)} m/s. How much power does it take to push through the air at that speed, in kilowatts?`, answer: F * v / 1000, unit: 'kW', rel: 0.02, hint: 'Power = force × speed, then ÷ 1,000.', formula: 'P = F × v', explanation: `${f(F, 0)} × ${f(v, 1)} = ${f(F * v, 0)} W = ${f(F * v / 1000, 1)} kW.` }),
          ];
        },
      },
      hard: {
        coach: 'Drive the slow section at 80 to 100 km/h, then the fast section at least 55% faster (140 to 175 km/h).',
        understand: [
          { title: 'The drag equation', body: 'F = ½ ρ Cd A v², where ρ is air density (about 1.2 kg/m³), Cd is the drag coefficient (about 0.3 for a sleek car), A is the frontal area in m² and v is the speed in m/s.', formula: 'F = ½ ρ Cd A v²' },
          { title: 'Power and the cube law', body: 'Power to overcome drag P = F × v = ½ ρ Cd A v³. Doubling the speed needs eight times the power, which is why top speed is so expensive.', formula: 'P = ½ ρ Cd A v³' },
          { title: 'Percentage effects', body: 'A 10% speed increase raises drag by 1.1² − 1 = 21% and the power needed by 1.1³ − 1 = 33%.' },
        ],
        practice: [factory({ ...C11, diff: 'hard' }, 'practice').num({ stem: 'A car needs 10 kW to beat the air at 20 m/s. How many kW does it need at 40 m/s?', answer: 80, unit: 'kW', hint: 'Power goes with the cube of the speed.', formula: 'P ∝ v³', explanation: 'Speed doubles, so power rises by 2³ = 8: 10 × 8 = 80 kW.' })],
        objective: { timeLimit: 90, brief: 'Slow section (300 m): average 80 to 100 km/h. Fast section (300 m): average 140 to 175 km/h and at least 55% faster than the slow one.', legs: [sec({ id: 'slow', label: 'Slow section', from: 100, to: 400, minAvgKmh: 80, maxAvgKmh: 100 }), sec({ id: 'fast', label: 'Fast section', from: 560, to: 860, minAvgKmh: 140, maxAvgKmh: 175, fasterThanPrevPct: 55 })] },
        apply: r => {
          const q = factory({ ...C11, diff: 'hard' }, 'apply'), vb = m(r, 'fast', 'avgKmh', 143), v = vb / KMH, F = 0.5 * 1.2 * 0.32 * 2 * v * v;
          return [
            q.num({ stem: `Using F = ½ ρ Cd A v² with ρ = 1.2 kg/m³, Cd = 0.32 and A = 2.0 m², find the drag at your fast-section average of ${f(vb, 1)} km/h, in newtons.`, answer: F, unit: 'N', rel: 0.02, hint: 'Convert km/h to m/s first.', formula: 'F = ½ ρ Cd A v²', explanation: `${f(vb, 1)} km/h = ${f(v, 2)} m/s. F = 0.5 × 1.2 × 0.32 × 2.0 × ${f(v, 2)}² = ${f(F, 0)} N.` }),
            q.num({ stem: 'At that speed, how much power is spent pushing through the air, in kilowatts?', answer: F * v / 1000, unit: 'kW', rel: 0.02, hint: 'Power = force × speed.', formula: 'P = F × v', explanation: `${f(F, 0)} × ${f(v, 2)} = ${f(F * v, 0)} W = ${f(F * v / 1000, 1)} kW.` }),
            q.num({ stem: 'You now drive 10% faster than that, with the same car. By what percentage does the power needed to beat the air increase?', answer: 33.1, unit: '%', rel: 0.02, hint: 'Power goes with speed cubed: 1.1³ − 1.', formula: 'P₂ ÷ P₁ = (v₂ ÷ v₁)³', explanation: '1.1³ = 1.331, so the power rises by 33.1%.' }),
          ];
        },
      },
    },
  },
  // ------------------------------------------------------------------ M12
  {
    id: 'm12', order: 12, subject: 'auto', concept: 'auto.brakes', character: 'mei',
    title: 'Brakes and Heat', summary: 'Find where all the energy of motion goes when you stop.',
    discover: [
      { who: 'mei', text: 'See how those brake discs glow orange after a hard stop? That glow is your speed, converted into heat.' },
      { who: 'you', text: 'So brakes do not remove the energy?' },
      { who: 'mei', text: 'Energy cannot vanish. Brakes change it from motion into heat. Run the stopping test and I will show you how much heat you made.' },
    ],
    reflect: ['Why would brakes fade on a long mountain descent?', 'How would you change the answers for a heavier truck?'],
    variants: {
      easy: {
        coach: 'Drive past the signal at 90 km/h or more with your foot off the brake. When it flashes, brake and stop in the box.',
        understand: [
          { title: 'Energy of motion', body: 'A moving car carries energy of motion. The faster and the heavier it is, the more energy it carries.' },
          { title: 'Brakes make heat', body: 'When you brake, friction between the pads and the discs turns that energy of motion into heat. The discs get hot and can even glow.' },
          { title: 'Speed matters most', body: 'Stopping from twice the speed makes four times as much heat, so the brakes have a lot more work to do.' },
        ],
        practice: [factory({ ...C12, diff: 'easy' }, 'practice').choice({ stem: 'Two identical cars stop, one from 50 km/h and one from 100 km/h. Which one makes more heat in its brakes?', right: 'The 100 km/h car, much more', wrong: ['The 50 km/h car', 'Both the same', 'Neither: brakes do not make heat'], hint: 'Faster means more energy of motion to remove.', explanation: 'The faster car has far more energy of motion, so its brakes turn far more of it into heat.' })],
        objective: { timeLimit: 80, brief: 'Pass the signal at 90 km/h or more without braking before it. When it flashes red, brake and stop in the box.', legs: [stop({ id: 'stop', label: 'Stopping test', signalAt: 120, minKmhAtSignal: 90, zone: [120, 215] })] },
        apply: r => {
          const q = factory({ ...C12, diff: 'easy' }, 'apply'), bk = m(r, 'stop', 'brakeKmh', 130);
          return [
            q.choice({ stem: `You began braking at ${f(bk, 0)} km/h. Where did most of your car's energy of motion go when you stopped?`, right: 'Into heat in the brakes and tyres', wrong: ['It was destroyed', 'Into the engine', 'Into the fuel tank'], hint: 'Energy changes form. It is never lost.', explanation: 'Energy is never destroyed. Friction in the brakes and tyres changed it into heat.', why: { 'It was destroyed': 'Energy cannot be destroyed, only changed into another form. Here it became heat.' } }),
            q.choice({ stem: `Your stop began at ${f(bk, 0)} km/h. A stop from double that speed would make…`, right: 'Four times as much heat', wrong: ['Twice as much heat', 'The same heat', 'Eight times as much heat'], hint: 'Energy of motion follows speed squared.', formula: 'energy ∝ speed²', explanation: 'Energy of motion grows with speed squared, so double the speed means four times the energy to turn into heat.', why: { 'Twice as much heat': 'Heat grows with speed squared, not in step with speed.' } }),
            q.choice({ stem: 'Why do racing brake discs have air vents?', right: 'To carry heat away so the brakes do not overheat', wrong: ['To make the car lighter only', 'To make a whistling sound', 'To hold the wheel on'], hint: 'Think about what the brakes make a lot of.', explanation: 'Vents let air flow through and carry away the heat that braking makes.' }),
          ];
        },
      },
      medium: {
        coach: 'Pass the signal at 120 km/h or more, then stop within 70 m after it.',
        understand: [
          { title: 'Kinetic energy', body: 'The energy of motion of a car of mass m at speed v is half of m times v squared, in joules.', formula: 'KE = ½ m v²' },
          { title: 'Energy becomes heat', body: 'When the car stops, all of that energy ends up as heat in the brakes. Four discs share it, so each takes about a quarter.' },
          { title: 'Work and force', body: 'The braking force acts over the braking distance. Energy removed = force × distance, so the average force is the energy divided by the distance.', formula: 'KE = F × d' },
        ],
        practice: [factory({ ...C12, diff: 'medium' }, 'practice').num({ stem: 'A 1,200 kg car is moving at 20 m/s. What is its energy of motion, in kilojoules?', answer: 240, unit: 'kJ', hint: '½ × 1,200 × 20², then ÷ 1,000.', formula: 'KE = ½ m v²', explanation: '½ × 1,200 × 20² = 240,000 J = 240 kJ.' })],
        objective: { timeLimit: 80, brief: 'Pass the signal at 120 km/h or more without braking before it. Stop within 70 m after it.', legs: [stop({ id: 'stop', label: 'Stopping test', signalAt: 120, minKmhAtSignal: 120, zone: [120, 190] })] },
        apply: r => {
          const q = factory({ ...C12, diff: 'medium' }, 'apply'), bm = m(r, 'stop', 'brakeMs', 43), bd = m(r, 'stop', 'brakeDist', 20), KE = 0.5 * 1200 * bm * bm, F = KE / bd;
          return [
            q.num({ stem: `You began braking at ${f(bm, 1)} m/s. How much energy of motion did a 1,200 kg car have then, in kilojoules?`, answer: KE / 1000, unit: 'kJ', rel: 0.02, hint: '½ × mass × speed², then ÷ 1,000.', formula: 'KE = ½ m v²', explanation: `½ × 1,200 × ${f(bm, 1)}² = ${f(KE, 0)} J = ${f(KE / 1000, 1)} kJ.` }),
            q.num({ stem: 'If that energy became heat shared equally by 4 brake discs, how much heat did each disc take, in kilojoules?', answer: KE / 4000, unit: 'kJ', rel: 0.02, hint: 'Divide the energy by 4.', explanation: `${f(KE / 1000, 1)} ÷ 4 = ${f(KE / 4000, 1)} kJ.` }),
            q.num({ stem: `You braked over ${f(bd, 1)} m. What was the average braking force in newtons? (Energy removed = force × distance.)`, answer: F, unit: 'N', rel: 0.03, hint: 'Force = energy in joules ÷ distance.', formula: 'F = KE ÷ d', explanation: `${f(KE, 0)} ÷ ${f(bd, 1)} = ${f(F, 0)} N.` }),
          ];
        },
      },
      hard: {
        coach: 'Pass the signal at 150 km/h or more without braking before it. Stop between 15 and 80 m after it.',
        understand: [
          { title: 'Heat and temperature', body: 'Heat energy raises temperature by ΔT = Q ÷ (m c), where m is the mass heated and c the specific heat capacity (about 500 J/kg°C for cast iron).', formula: 'ΔT = Q ÷ (m c)' },
          { title: 'Average deceleration', body: 'From speed v stopping over distance d, the average deceleration is v² ÷ (2d). Race brakes manage far more than road brakes.', formula: 'a = v² ÷ (2d)' },
          { title: 'Why discs are vented and big', body: 'More disc mass and more airflow mean the same heat gives a smaller temperature rise, which keeps the brakes working.' },
        ],
        practice: [factory({ ...C12, diff: 'hard' }, 'practice').num({ stem: 'A 1,200 kg car has 540 kJ of energy of motion. At what speed is it travelling, in m/s?', answer: 30, unit: 'm/s', hint: 'v = √(2 × KE ÷ m).', formula: 'v = √(2 KE ÷ m)', explanation: '2 × 540,000 ÷ 1,200 = 900, and √900 = 30 m/s.' })],
        objective: { timeLimit: 80, brief: 'Pass the signal at 150 km/h or more without braking before it. Stop between 15 and 80 m after it.', legs: [stop({ id: 'stop', label: 'Stopping test', signalAt: 120, minKmhAtSignal: 150, zone: [135, 200] })] },
        apply: r => {
          const q = factory({ ...C12, diff: 'hard' }, 'apply'), bm = m(r, 'stop', 'brakeMs', 50), bd = m(r, 'stop', 'brakeDist', 28), KE = 0.5 * 1200 * bm * bm, a = bm * bm / (2 * bd);
          return [
            q.num({ stem: `A 1,200 kg car stops from your braking speed of ${f(bm, 1)} m/s. Four discs of 4 kg each (c = 500 J/kg°C) share the heat equally, with no cooling. By how many °C does each disc warm?`, answer: KE / 4 / (4 * 500), unit: '°C', rel: 0.03, hint: 'Heat per disc = KE ÷ 4, then ÷ (4 × 500).', formula: 'ΔT = Q ÷ (m c)', explanation: `KE = ${f(KE, 0)} J. Each disc takes ${f(KE / 4, 0)} J. ΔT = ${f(KE / 4, 0)} ÷ (4 × 500) = ${f(KE / 8000, 1)} °C.` }),
            q.num({ stem: `You braked from ${f(bm, 1)} m/s over ${f(bd, 1)} m. What was your average deceleration in m/s²?`, answer: a, unit: 'm/s²', rel: 0.03, hint: 'a = v² ÷ (2d).', formula: 'a = v² ÷ (2d)', explanation: `${f(bm, 1)}² ÷ (2 × ${f(bd, 1)}) = ${f(a, 1)} m/s².` }),
            q.num({ stem: 'A road car brakes at about 8 m/s². How many times longer would its braking distance be than yours from the same speed?', answer: a / 8, unit: '×', rel: 0.03, hint: 'Distance = v² ÷ (2a), so it scales as 1 ÷ a.', formula: 'd ∝ 1 ÷ a', explanation: `Same speed, so the distances are in the ratio of the decelerations: ${f(a, 1)} ÷ 8 = ${f(a / 8, 2)}.` }),
          ];
        },
      },
    },
  },
];
