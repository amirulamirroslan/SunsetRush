import type { Mission, MissionVariant, LearningDifficulty, SubjectId } from '../types';
import { MATH_MISSIONS } from './missionsMath';
import { SCIENCE_MISSIONS } from './missionsScience';
import { ROAD_MISSIONS } from './missionsRoad';
import { AUTO_MISSIONS } from './missionsAuto';
import { GEO_MISSIONS } from './missionsGeo';

export { CHARACTERS, CONCEPTS, DISCOVERY_POINTS, REGIONS, SUBJECTS, characterById, conceptById, conceptsOf, subjectById } from './world';
export { CHALLENGES, LABS, challengeById, labById, labDefaults, labGoalMet, labOutputs } from './labs';
export { TRANSFER_SCENARIOS, transferQuestion, transferScenarioId } from './transfer';

export const MISSIONS: readonly Mission[] = [...MATH_MISSIONS, ...SCIENCE_MISSIONS, ...ROAD_MISSIONS, ...AUTO_MISSIONS, ...GEO_MISSIONS];
export const missionById = (id: string): Mission | undefined => MISSIONS.find(m => m.id === id);
export const missionsOf = (s: SubjectId): Mission[] => MISSIONS.filter(m => m.subject === s).sort((a, b) => a.order - b.order);
export const variantOf = (m: Mission, d: LearningDifficulty): MissionVariant => m.variants[d];
export { reviewQuestion } from './review';
export { ECO_TABLE, nearestEco } from './missionsGeo';
