import type { RaceSim } from '../sim/RaceSim';
import type { Sample } from './types';

/**
 * Read-only bridge from the racing simulation to the educational layer. It copies numbers out of the player's car and
 * never writes anything back, so learning can observe the race without ever influencing the physics.
 */
export function sampleFromSim(sim: RaceSim): Sample {
  const c = sim.cars[0];
  let cones = 0;
  for (const o of sim.obstacles) if (o.hit) cones++;
  return {
    t: sim.raceTime, progress: c.progress, speed: c.speed, braking: c.braking, throttle: sim.playerInput.throttle,
    offRoad: c.offRoad, drifting: c.drifting, y: c.y, hazardHits: c.stats.hits + cones, driftSeconds: c.stats.driftSeconds, boostMeter: c.boostMeter,
  };
}

/** Subscribes `fn` to every fixed simulation step that happens while the race clock is running. Returns an unsubscribe. */
export function observeRacing(sim: RaceSim, fn: (s: Sample) => void): () => void {
  const o = (r: RaceSim): void => { if (r.stage === 'racing') fn(sampleFromSim(r)); };
  sim.observers.push(o);
  return () => { const i = sim.observers.indexOf(o); if (i >= 0) sim.observers.splice(i, 1); };
}
