/**
 * Educational Racing Adventure: shared types.
 * Everything under src/edu is pure TypeScript (no DOM, no three.js) so it can be unit tested headlessly and can never
 * touch the racing physics: the only link to the simulation is a read-only observer (see telemetry.ts).
 */

/** The player's learning preference. Independent of the rival-AI difficulty (easy | normal | hard) used by races. */
export type LearningDifficulty = 'easy' | 'medium' | 'hard';
export const LEARNING_DIFFICULTIES: readonly LearningDifficulty[] = ['easy', 'medium', 'hard'];
export const DIFFICULTY_LABEL: Record<LearningDifficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export type SubjectId = 'math' | 'science' | 'road' | 'auto' | 'geo';
export type ConceptId =
  | 'math.speed' | 'math.pace' | 'math.percent'
  | 'sci.friction' | 'sci.energy' | 'sci.potential'
  | 'road.stopping' | 'road.limits' | 'road.hazards';

/** Mastery ladder. A concept only reaches `mastered` after a correct answer in a scenario it has never seen before. */
export type MasteryLevel = 'unseen' | 'discovered' | 'learning' | 'practised' | 'applied' | 'mastered';
export const MASTERY_ORDER: readonly MasteryLevel[] = ['unseen', 'discovered', 'learning', 'practised', 'applied', 'mastered'];
export const MASTERY_LABEL: Record<MasteryLevel, string> = { unseen: 'Not found yet', discovered: 'Discovered', learning: 'Learning', practised: 'Practised', applied: 'Applied', mastered: 'Mastered' };

export type CharacterId = 'kai' | 'lina' | 'omar';
export interface Character { id: CharacterId; name: string; role: string; subject: SubjectId; color: string; initials: string; bio: string }
export interface DialogueLine { who: CharacterId | 'you'; text: string }

export interface Subject { id: SubjectId; name: string; blurb: string; icon: string; active: boolean; character?: CharacterId }
export interface Concept { id: ConceptId; subject: SubjectId; name: string; summary: string }
export interface Region { id: string; name: string; blurb: string; available: boolean }

// ------------------------------------------------------------------ questions
export interface Question {
  id: string;
  /** Identifies the numbers/situation the question uses; mastery needs a scenario the concept has not seen yet. */
  scenarioId: string;
  concept: ConceptId;
  kind: 'choice' | 'numeric';
  stem: string;
  options?: string[];
  /** index of the right option (choice) */
  correct?: number;
  /** numeric answer, absolute tolerance and unit label */
  answer?: number; tolerance?: number; unit?: string;
  hint?: string; formula?: string; explanation: string;
  transfer?: boolean;
}
export type Answer = { choice: number } | { value: number };
export interface Grade { correct: boolean; message: string }

// ------------------------------------------------------------------ driving objectives (evaluated from telemetry)
export interface SectionLeg {
  kind: 'section'; id: string; label: string;
  /** distance along the lap (m) where timing starts and stops */
  from: number; to: number;
  /** allowed band for the average speed over the section (km/h) */
  minAvgKmh?: number; maxAvgKmh?: number;
  /** speed limit for the section (km/h) and how many seconds over it are tolerated */
  limitKmh?: number; overAllowSec?: number;
  noHits?: boolean; driftSec?: number; meterTo?: number; offRoadMaxSec?: number;
  /** average speed must beat the previous section by this many percent */
  fasterThanPrevPct?: number;
}
export interface GateLeg { kind: 'gate'; id: string; label: string; at: number; minKmh: number; maxKmh: number }
export interface StopLeg {
  kind: 'stop'; id: string; label: string;
  /** the signal turns red here; the player must already be moving at least `minKmhAtSignal` */
  signalAt: number; minKmhAtSignal: number;
  /** the car must come to rest between these two distances (the stop line is zone[1]) */
  zone: [number, number];
}
export type Leg = SectionLeg | GateLeg | StopLeg;
export interface DriveObjective { legs: Leg[]; /** seconds after GO before the attempt is abandoned */ timeLimit: number; brief: string }

export type LegStatus = 'pending' | 'active' | 'passed' | 'failed';
export interface LegResult { id: string; label: string; status: LegStatus; reason?: string; metrics: Record<string, number> }
export interface DriveStats { topSpeedKmh: number; hazardHits: number; driftSeconds: number; offRoadSeconds: number; durationSec: number; distance: number }
export interface DriveResult { passed: boolean; failReason?: string; legs: LegResult[]; stats: DriveStats }

// ------------------------------------------------------------------ missions, labs, challenges
export interface Card { title: string; body: string; formula?: string }
export interface MissionVariant {
  understand: Card[];
  /** guided try-it questions (missions without a lab use these as the EXPERIMENT step) */
  practice: Question[];
  objective: DriveObjective;
  /** questions built from the player's own telemetry (the APPLY step) */
  apply: (r: DriveResult) => Question[];
  coach: string;
}
export interface Mission {
  id: string; order: number; subject: SubjectId; concept: ConceptId; character: CharacterId;
  title: string; summary: string;
  discover: DialogueLine[];
  lab?: string;
  variants: Record<LearningDifficulty, MissionVariant>;
  reflect: string[];
}

export interface LabInput { id: string; label: string; unit: string; min: number; max: number; step: number; value: number; locked?: boolean; options?: { label: string; value: number }[] }
export interface LabOutput { id: string; label: string; unit: string; decimals: number; compute: (v: Record<string, number>) => number }
export interface LabVariant { inputs: LabInput[]; goal: { output: string; min: number; max: number; text: string }; guide: string; showFormula: boolean }
export interface Lab {
  id: string; subject: SubjectId; concept: ConceptId; title: string; intro: string; formula: string;
  outputs: LabOutput[];
  variants: Record<LearningDifficulty, LabVariant>;
}

export interface Challenge {
  id: string; subject: SubjectId; character: CharacterId; title: string; summary: string;
  concepts: [ConceptId, ConceptId, ConceptId];
  objective: Record<LearningDifficulty, DriveObjective>;
}

export interface DiscoveryPoint { id: string; concept: ConceptId; at: number; lat: number; title: string; note: Record<LearningDifficulty, string> }

// ------------------------------------------------------------------ telemetry
/** One read-only observation of the player's car (120 Hz while racing). */
export interface Sample {
  t: number; progress: number; speed: number; braking: boolean; throttle: number;
  offRoad: boolean; drifting: boolean; y: number; hazardHits: number; driftSeconds: number; boostMeter: number;
}
