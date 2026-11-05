import type { Character, CharacterId, Concept, ConceptId, DiscoveryPoint, Region, Subject, SubjectId } from '../types';

export const CHARACTERS: readonly Character[] = [
  { id: 'kai', name: 'Kai Navarro', role: 'Race engineer', subject: 'math', color: '#35d0ff', initials: 'KN', bio: 'Runs the timing wall at Discovery Coast and turns every lap into numbers.' },
  { id: 'lina', name: 'Dr. Lina Corral', role: 'Coastal physicist', subject: 'science', color: '#7cf05a', initials: 'LC', bio: 'Studies how cars, tyres and hills trade energy along the cliff road.' },
  { id: 'omar', name: 'Ranger Omar Bell', role: 'Highway safety ranger', subject: 'road', color: '#ffc23a', initials: 'OB', bio: 'Patrols the coast road and teaches drivers to see trouble before it arrives.' },
];
export const characterById = (id: CharacterId): Character => CHARACTERS.find(c => c.id === id)!;

export const SUBJECTS: readonly Subject[] = [
  { id: 'math', name: 'Mathematics', blurb: 'Speed, pace and percentages from your own laps.', icon: 'stopwatch', active: true, character: 'kai' },
  { id: 'science', name: 'Science and Physics', blurb: 'Friction, energy and hills.', icon: 'bolt', active: true, character: 'lina' },
  { id: 'road', name: 'Road Safety and Intelligence', blurb: 'Stopping, limits and hazard awareness.', icon: 'warn', active: true, character: 'omar' },
  { id: 'auto', name: 'Automotive Engineering', blurb: 'Engines, tyres and aerodynamics. Coming in a later region.', icon: 'wheel', active: false },
  { id: 'geo', name: 'Geography and Environment', blurb: 'Coasts, climate and landscapes. Coming in a later region.', icon: 'compass', active: false },
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
];
