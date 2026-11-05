import type { Character, CharacterId, Concept, ConceptId, DiscoveryPoint, Region, Subject, SubjectId } from '../types';

export const CHARACTERS: readonly Character[] = [
  { id: 'kai', name: 'Kai Navarro', role: 'Race engineer', subject: 'math', color: '#35d0ff', initials: 'KN', bio: 'Runs the timing wall at Discovery Coast and turns every lap into numbers.' },
  { id: 'lina', name: 'Dr. Lina Corral', role: 'Coastal physicist', subject: 'science', color: '#7cf05a', initials: 'LC', bio: 'Studies how cars, tyres and hills trade energy along the cliff road.' },
  { id: 'omar', name: 'Ranger Omar Bell', role: 'Highway safety ranger', subject: 'road', color: '#ffc23a', initials: 'OB', bio: 'Patrols the coast road and teaches drivers to see trouble before it arrives.' },
  { id: 'mei', name: 'Mei Tanaka', role: 'Pit-lane engineer', subject: 'auto', color: '#ff7a3d', initials: 'MT', bio: 'Runs the pit wall and can read what the gearbox, the air and the brakes are doing from a single lap.' },
  { id: 'nia', name: 'Prof. Nia Okafor', role: 'Coastal geographer', subject: 'geo', color: '#b58cff', initials: 'NO', bio: 'Maps the Discovery Coast, from its cliff gradients to the carbon every journey leaves behind.' },
];
export const characterById = (id: CharacterId): Character => CHARACTERS.find(c => c.id === id)!;

export const SUBJECTS: readonly Subject[] = [
  { id: 'math', name: 'Mathematics', blurb: 'Speed, pace and percentages from your own laps.', icon: 'stopwatch', active: true, character: 'kai' },
  { id: 'science', name: 'Science and Physics', blurb: 'Friction, energy and hills.', icon: 'bolt', active: true, character: 'lina' },
  { id: 'road', name: 'Road Safety and Intelligence', blurb: 'Stopping, limits and hazard awareness.', icon: 'warn', active: true, character: 'omar' },
  { id: 'auto', name: 'Automotive Engineering', blurb: 'Gears, air drag and brakes: the machine behind the lap.', icon: 'wheel', active: true, character: 'mei' },
  { id: 'geo', name: 'Geography and Environment', blurb: 'Slopes, maps and the carbon cost of a drive.', icon: 'compass', active: true, character: 'nia' },
];
export const subjectById = (id: SubjectId): Subject => SUBJECTS.find(s => s.id === id)!;

export const CONCEPTS: readonly Concept[] = [
  { id: 'math.speed', subject: 'math', name: 'Speed, distance and time', summary: 'Speed is distance divided by time.' },
  { id: 'math.pace', subject: 'math', name: 'Averages and comparing times', summary: 'Means, differences and percentage comparisons of lap data.' },
  { id: 'math.percent', subject: 'math', name: 'Percentages and fractions', summary: 'Reading a meter as a percentage and measuring change.' },
  { id: 'sci.friction', subject: 'science', name: 'Friction and grip', summary: 'Friction force depends on the surface and on weight.' },
  { id: 'sci.energy', subject: 'science', name: 'Energy of motion', summary: 'Kinetic energy grows with the square of speed.' },
  { id: 'sci.potential', subject: 'science', name: 'Hills and stored energy', summary: 'Climbing stores energy equal to mass times gravity times height.' },
  { id: 'road.stopping', subject: 'road', name: 'Reaction and stopping distance', summary: 'Stopping distance is reaction distance plus braking distance.' },
  { id: 'road.limits', subject: 'road', name: 'Speed limits and risk', summary: 'Small speed increases make braking distance much longer.' },
  { id: 'road.hazards', subject: 'road', name: 'Hazards and safe gaps', summary: 'Look far ahead and keep a time gap you can brake in.' },
  { id: 'auto.gearing', subject: 'auto', name: 'Gears and engine speed', summary: 'Engine speed is wheel speed times the gear ratio.' },
  { id: 'auto.aero', subject: 'auto', name: 'Air drag', summary: 'Drag grows with the square of speed, and the power to beat it with the cube.' },
  { id: 'auto.brakes', subject: 'auto', name: 'Brakes and heat', summary: 'Braking turns the energy of motion, ½ m v², into heat.' },
  { id: 'geo.slope', subject: 'geo', name: 'Slopes and gradient', summary: 'Gradient is rise divided by run, written as a percentage.' },
  { id: 'geo.scale', subject: 'geo', name: 'Maps and scale', summary: 'On a 1 : N map, 1 cm stands for N cm on the ground.' },
  { id: 'geo.carbon', subject: 'geo', name: 'Fuel, distance and CO₂', summary: 'Fuel used is distance times consumption; each litre of petrol releases about 2.3 kg of CO₂.' },
];
export const conceptById = (id: ConceptId): Concept => CONCEPTS.find(c => c.id === id)!;
export const conceptsOf = (s: SubjectId): Concept[] => CONCEPTS.filter(c => c.subject === s);

export const REGIONS: readonly Region[] = [
  { id: 'coast', name: 'Discovery Coast', blurb: 'Cliff roads, harbour lights and a timing wall. Where every driver starts.', available: true },
  { id: 'forest', name: 'Emerald Forest', blurb: 'Coming soon.', available: false },
  { id: 'alpine', name: 'Alpine Frontier', blurb: 'Coming soon.', available: false },
  { id: 'city', name: 'Velocity City', blurb: 'Coming soon.', available: false },
  { id: 'desert', name: 'Frontier Desert', blurb: 'Coming soon.', available: false },
];

/** Field notes the player finds by exploring. Non-blocking: collecting one shows a toast and writes to the journal. */
export const DISCOVERY_POINTS: readonly DiscoveryPoint[] = [
  { id: 'd.speed', concept: 'math.speed', at: 230, lat: 0, title: 'The timing wall', note: {
    easy: 'Speed tells you how far you go every second. 100 m in 10 s is 10 m/s.',
    medium: 'Average speed = distance ÷ time. Multiply m/s by 3.6 for km/h.',
    hard: 'Average speed is total distance over total time, so a slow segment weighs more than a fast one of equal length.' } },
  { id: 'd.pace', concept: 'math.pace', at: 640, lat: 0, title: 'Lap board', note: {
    easy: 'To compare two laps, look at the difference between their times.',
    medium: 'The mean lap time is the sum of the lap times divided by the number of laps.',
    hard: 'Compare pace as a percentage: (old time ÷ new time − 1) × 100 gives the speed gain.' } },
  { id: 'd.percent', concept: 'math.percent', at: 980, lat: 0, title: 'Boost gauge', note: {
    easy: 'A meter at 50% is half full. 100% is completely full.',
    medium: 'Percentage change in points = new % − old %. A fraction is a percentage divided by 100.',
    hard: 'A rise from 35% to 70% is 35 percentage points but a 100% increase relative to where you started.' } },
  { id: 'd.friction', concept: 'sci.friction', at: 1230, lat: 0, title: 'Skid marks', note: {
    easy: 'Rubber grips dry road best. Ice and gravel let tyres slide.',
    medium: 'Friction force = μ × weight. Dry asphalt has μ ≈ 0.8, ice only ≈ 0.15.',
    hard: 'Braking distance d = v² ÷ (2 μ g). Halving μ doubles the distance needed to stop.' } },
  { id: 'd.energy', concept: 'sci.energy', at: 1480, lat: 0, title: 'Wind sock', note: {
    easy: 'A fast car carries much more energy than a slow one.',
    medium: 'Kinetic energy = ½ × mass × speed². Double the speed and you get four times the energy.',
    hard: 'Because energy scales with v², a 20% speed increase adds 44% more energy to dissipate when braking.' } },
  { id: 'd.potential', concept: 'sci.potential', at: 1900, lat: 0, title: 'Cliff top', note: {
    easy: 'Driving uphill stores energy. Driving down gives it back as speed.',
    medium: 'Potential energy = mass × g × height, with g ≈ 9.8 m/s².',
    hard: 'Ignoring losses, v²/2 = g h: the speed you start with sets how high you can roll up a hill.' } },
  { id: 'd.stopping', concept: 'road.stopping', at: 160, lat: 5, title: 'Test strip', note: {
    easy: 'You travel a long way before your foot even reaches the brake.',
    medium: 'Stopping distance = reaction distance (speed × reaction time) + braking distance.',
    hard: 'Reaction distance grows linearly with speed, braking distance with its square, so total stopping distance accelerates upward.' } },
  { id: 'd.limits', concept: 'road.limits', at: 860, lat: -5, title: 'Limit sign', note: {
    easy: 'Limits exist because slower cars can stop sooner.',
    medium: 'Doubling speed makes braking distance four times longer.',
    hard: 'Going 10% over the limit lengthens braking distance by 21%, since the distance scales with speed squared.' } },
  { id: 'd.hazards', concept: 'road.hazards', at: 1330, lat: 5, title: 'Lookout post', note: {
    easy: 'Look far ahead. Spot the problem early and you have time to avoid it.',
    medium: 'The 3-second rule: stay at least 3 seconds behind the car ahead. Gap (m) = speed (m/s) × 3.',
    hard: 'A fixed time gap means the distance gap must grow with speed: at 108 km/h a 3 s gap is 90 m.' } },
  { id: 'd.gearing', concept: 'auto.gearing', at: 330, lat: -4, title: 'Gearbox display', note: {
    easy: 'Gears trade speed for pulling power. Low gears pull hard; high gears let you go fast.',
    medium: 'Engine rpm = wheel rpm × total gear ratio. A wheel of 2 m circumference turns v ÷ 2 times per second at v m/s.',
    hard: 'Total ratio = gear ratio × final drive. At a fixed road speed a lower total ratio means fewer engine revolutions, which saves fuel and noise but gives less pulling force.' } },
  { id: 'd.aero', concept: 'auto.aero', at: 760, lat: 4, title: 'Wind-tunnel board', note: {
    easy: 'The faster you go, the harder the air pushes back on the car.',
    medium: 'Drag grows with speed squared: double the speed and the drag becomes four times bigger.',
    hard: 'Power needed to beat drag is force × speed, so it grows with the cube of speed: double the speed needs eight times the power.' } },
  { id: 'd.brakes', concept: 'auto.brakes', at: 1130, lat: -4, title: 'Glowing discs', note: {
    easy: 'Brakes turn the energy of motion into heat. That is why brake discs glow after hard stops.',
    medium: 'Heat made when stopping = ½ m v². Stopping from twice the speed makes four times the heat.',
    hard: 'With Q = m c ΔT, the same heat warms a lighter disc more: a disc with half the mass gets twice as hot. Real cars add cooling vents for that reason.' } },
  { id: 'd.slope', concept: 'geo.slope', at: 1780, lat: 4, title: 'Gradient sign', note: {
    easy: 'A steep road climbs a lot in a short distance. A gentle road climbs slowly.',
    medium: 'Gradient % = rise ÷ run × 100. A 5% road rises 5 m for every 100 m you travel along it.',
    hard: 'A descent has a negative gradient. For gentle slopes the road length and the horizontal run are almost equal, so rise ÷ road length is a good estimate.' } },
  { id: 'd.scale', concept: 'geo.scale', at: 2150, lat: -4, title: 'Map board', note: {
    easy: 'A map shrinks the world. A short distance on the map is a long distance on the ground.',
    medium: 'On a 1 : 10,000 map, 1 cm is 100 m. Real distance (m) = map cm × scale ÷ 100.',
    hard: 'A scale of 1 : N shrinks lengths by N but areas by N². A map with half the denominator shows twice the detail but needs four times the paper for the same area.' } },
  { id: 'd.carbon', concept: 'geo.carbon', at: 2300, lat: 4, title: 'Fuel pump', note: {
    easy: 'Burning fuel makes carbon dioxide, a gas that traps heat in the atmosphere.',
    medium: 'Petrol makes about 2.3 kg of CO₂ per litre. Fuel used = distance ÷ 100 × consumption in L/100 km.',
    hard: 'Fuel use rises quickly with speed, mostly because of air drag. Driving 130 km/h instead of 100 km/h can burn about a third more fuel over the same trip.' } },
];
