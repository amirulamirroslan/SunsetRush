import { clamp } from '../sim/math';

/**
 * Fully synthesised audio (Web Audio API): engine, wind, tyre squeal and effects are generated at runtime, so there are no
 * audio files to license or load. The context is created lazily on the first user gesture (browser autoplay rules).
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engineGain!: GainNode; private osc1!: OscillatorNode; private osc2!: OscillatorNode; private engineFilter!: BiquadFilterNode;
  private windGain!: GainNode; private squealGain!: GainNode; private squealFilter!: BiquadFilterNode;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;
  private started = false;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.enabled) return;
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return; }
      this.build();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private noise(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const c = this.ctx!, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (this.noiseBuf = b);
  }

  private build(): void {
    const c = this.ctx!;
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 0.55 : 0; this.master.connect(c.destination);
    this.engineFilter = c.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 600;
    this.engineGain = c.createGain(); this.engineGain.gain.value = 0;
    this.osc1 = c.createOscillator(); this.osc1.type = 'sawtooth'; this.osc2 = c.createOscillator(); this.osc2.type = 'square';
    const g2 = c.createGain(); g2.gain.value = 0.4;
    this.osc1.connect(this.engineFilter); this.osc2.connect(g2); g2.connect(this.engineFilter); this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.osc1.start(); this.osc2.start();
    const wind = c.createBufferSource(); wind.buffer = this.noise(); wind.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 900; wf.Q.value = 0.4;
    this.windGain = c.createGain(); this.windGain.gain.value = 0; wind.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master); wind.start();
    const sq = c.createBufferSource(); sq.buffer = this.noise(); sq.loop = true;
    this.squealFilter = c.createBiquadFilter(); this.squealFilter.type = 'bandpass'; this.squealFilter.frequency.value = 2400; this.squealFilter.Q.value = 6;
    this.squealGain = c.createGain(); this.squealGain.gain.value = 0; sq.connect(this.squealFilter); this.squealFilter.connect(this.squealGain); this.squealGain.connect(this.master); sq.start();
    this.started = true;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
    else if (on && this.started) this.unlock();
  }

  /** Per-frame engine state. `speed01` 0..1.3, `throttle` 0..1. */
  setEngine(active: boolean, speed01: number, throttle: number, boosting: boolean, drifting: boolean, slip: number): void {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime;
    const rpm = 0.12 + (speed01 % 0.34) / 0.34 * 0.55 + clamp(speed01, 0, 1.3) * 0.3; // simple 3-gear sawtooth rise
    const f = 55 + rpm * 150 + (boosting ? 22 : 0);
    this.osc1.frequency.setTargetAtTime(f, t, 0.05); this.osc2.frequency.setTargetAtTime(f * 0.502, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(380 + rpm * 1500 + throttle * 600, t, 0.08);
    this.engineGain.gain.setTargetAtTime(active ? 0.09 + throttle * 0.08 + (boosting ? 0.05 : 0) : 0, t, 0.08);
    this.windGain.gain.setTargetAtTime(active ? clamp(speed01, 0, 1.3) * 0.16 : 0, t, 0.1);
    this.squealGain.gain.setTargetAtTime(active && drifting ? clamp(Math.abs(slip) / 14, 0.05, 0.14) : 0, t, 0.05);
    this.squealFilter.frequency.setTargetAtTime(2100 + Math.abs(slip) * 40, t, 0.1);
  }

  silenceEngine(): void { if (this.ctx && this.started) { const t = this.ctx.currentTime; this.engineGain.gain.setTargetAtTime(0, t, 0.05); this.windGain.gain.setTargetAtTime(0, t, 0.05); this.squealGain.gain.setTargetAtTime(0, t, 0.05); } }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  private burst(dur: number, f0: number, f1: number, vol = 0.25, delay = 0): void {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(); s.buffer = this.noise();
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  beep(final: boolean): void { this.tone(final ? 880 : 440, final ? 0.5 : 0.18, 'square', 0.18); }
  boost(): void { this.burst(0.7, 400, 3200, 0.3); this.tone(180, 0.5, 'sawtooth', 0.12, 520); }
  miniTurbo(tier: number): void { this.burst(0.5, 600, 4000, 0.25); this.tone(300 + tier * 120, 0.3, 'triangle', 0.18, 900 + tier * 200); }
  driftTier(tier: number): void { this.tone(520 + tier * 180, 0.12, 'triangle', 0.14); }
  hit(strength: number): void { this.burst(0.25, 500, 90, clamp(strength / 25, 0.12, 0.45)); this.tone(90, 0.2, 'sine', clamp(strength / 30, 0.1, 0.3), 45); }
  /** Light wall scrape: a short, quiet metallic rasp (rate-limited by the caller). */
  scrape(strength: number): void { const k = clamp(strength / 3, 0.3, 1); this.burst(0.16, 2400, 1200, 0.05 + 0.07 * k); this.tone(140 + k * 60, 0.12, 'sawtooth', 0.03 + 0.03 * k, 90); }
  cone(): void { this.tone(700, 0.1, 'square', 0.1, 300); this.burst(0.1, 1800, 600, 0.12); }
  pad(): void { this.tone(400, 0.35, 'sawtooth', 0.12, 1300); this.burst(0.4, 800, 3000, 0.15); }
  lap(final: boolean): void { this.tone(660, 0.14, 'triangle', 0.2); this.tone(final ? 990 : 880, 0.22, 'triangle', 0.2, undefined, 0.12); }
  click(): void { this.tone(520, 0.06, 'triangle', 0.1); }
  unlockChime(): void { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, undefined, i * 0.08)); }
  fanfare(win: boolean): void { (win ? [523, 659, 784, 1047, 1319] : [440, 523, 659]).forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, undefined, i * 0.11)); }
}
