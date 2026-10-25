import { clamp } from '../sim/math';
import type { CarInput } from '../sim/carPhysics';

/** What the touch HUD reports each frame (all values already normalised). */
export interface TouchState { steer: number; gas: boolean; brake: boolean; drift: boolean; boost: boolean }

export interface ControlEvents { onPause(): void; onRespawn(): void; onRestart(): void }

const KEYS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  drift: ['Space'], boost: ['ShiftLeft', 'ShiftRight', 'KeyB'], pause: ['KeyP', 'Escape'], respawn: ['KeyR'], restart: ['KeyT'],
} as const;

/**
 * Merges keyboard and touch into the single `CarInput` the simulation consumes. Keyboard steering ramps in and out
 * (so a tap is a gentle nudge, a hold is full lock); touch steering is analogue.
 */
export class Controls {
  readonly touch: TouchState = { steer: 0, gas: false, brake: false, drift: false, boost: false };
  autoAccelerate = false;
  enabled = false;
  private readonly down = new Set<string>();
  private steerKb = 0;
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) { if (this.enabled && this.isGameKey(e.code)) e.preventDefault(); return; }
    this.down.add(e.code);
    if ((KEYS.pause as readonly string[]).includes(e.code)) this.events.onPause();
    else if (this.enabled && (KEYS.respawn as readonly string[]).includes(e.code)) this.events.onRespawn();
    else if (this.enabled && (KEYS.restart as readonly string[]).includes(e.code) && e.shiftKey) this.events.onRestart();
    if (this.enabled && this.isGameKey(e.code)) e.preventDefault();
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => { this.down.delete(e.code); };
  private readonly onBlur = (): void => { this.down.clear(); };

  constructor(private readonly events: ControlEvents) {
    addEventListener('keydown', this.onKeyDown); addEventListener('keyup', this.onKeyUp); addEventListener('blur', this.onBlur);
  }

  private isGameKey(code: string): boolean { return Object.values(KEYS).some(list => (list as readonly string[]).includes(code)); }
  private pressed(list: readonly string[]): boolean { return list.some(k => this.down.has(k)); }

  /** Fills `out` for this frame. `dt` is real elapsed seconds. */
  read(out: CarInput, dt: number): CarInput {
    const kbTarget = (this.pressed(KEYS.right) ? 1 : 0) - (this.pressed(KEYS.left) ? 1 : 0);
    const rate = kbTarget === 0 || Math.sign(kbTarget) !== Math.sign(this.steerKb) ? 9 : 4.5;
    this.steerKb += clamp(kbTarget - this.steerKb, -rate * dt, rate * dt);
    const steer = Math.abs(this.touch.steer) > 0.001 ? this.touch.steer : this.steerKb;
    const kbThrottle = this.pressed(KEYS.up), kbBrake = this.pressed(KEYS.down);
    out.throttle = kbThrottle || this.touch.gas || (this.autoAccelerate && !this.touch.brake && !kbBrake) ? 1 : 0;
    out.brake = kbBrake || this.touch.brake ? 1 : 0;
    out.steer = clamp(steer, -1, 1);
    out.handbrake = this.pressed(KEYS.drift) || this.touch.drift;
    out.boost = this.pressed(KEYS.boost) || this.touch.boost;
    return out;
  }

  reset(): void { this.down.clear(); this.steerKb = 0; this.touch.steer = 0; this.touch.gas = this.touch.brake = this.touch.drift = this.touch.boost = false; }
  dispose(): void { removeEventListener('keydown', this.onKeyDown); removeEventListener('keyup', this.onKeyUp); removeEventListener('blur', this.onBlur); }
}
