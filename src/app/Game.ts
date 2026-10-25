import { Vector3 } from 'three';
import { SUN_DIR } from '../render/sky';
import { Gfx } from '../render/gfx';
import { World } from '../render/world';
import { CarView, type CarSnapshot } from '../render/carModel';
import { loadAsphalt } from '../render/pbr';
import { CarAssets, type CarLod } from '../render/carAssets';
import { CameraRig, type FocusState } from '../render/cameraRig';
import { Effects } from '../render/effects';
import { Landmarks } from '../render/landmarks';
import { Obstacles, Scenery } from '../render/scenery';
import { PerfGovernor, TIERS, initialTier, type Tier } from '../render/quality';
import { Track } from '../sim/Track';
import { COURSE } from '../sim/trackDef';
import { FIXED_DT, INTRO_SECONDS, RaceSim } from '../sim/RaceSim';
import type { CarState } from '../sim/carPhysics';
import { computeRewards } from '../sim/rewards';
import { angleDiff, clamp, lerp } from '../sim/math';
import { CATEGORIES, RIVALS, findPaint, type CategoryId, type Loadout, type VehicleId } from '../data/catalog';
import { SaveStore } from '../save/save';
import { Controls } from '../input/Controls';
import { GameAudio } from '../audio/GameAudio';
import { UI } from '../ui/UI';
import { SpeedLines } from '../ui/speedlines';
import type { MapDot } from '../ui/hud';

type Mode = 'menu' | 'garage' | 'race' | 'results';
const RACE_CARS = 6;
const PLAYER_SLOT = 4;
const tmp = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };
const tmp2 = { x: 0, y: 0, z: 0, heading: 0, tx: 0, tz: 0 };

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** Wires the pure simulation, the renderer, input, audio, save data and UI together. */
export class Game {
  readonly save = new SaveStore();
  private readonly audio = new GameAudio();
  private readonly track = new Track();
  private gfx!: Gfx; private world!: World; private scenery!: Scenery; private landmarks!: Landmarks; private effects!: Effects;
  private readonly rig = new CameraRig();
  private views: CarView[] = [];
  private assets = new CarAssets(import.meta.env.BASE_URL);
  private obstacles: Obstacles | null = null;
  private sim: RaceSim | null = null;
  private ui!: UI; private speedLines!: SpeedLines; private controls!: Controls;
  private governor!: PerfGovernor;
  private tier: Tier = 'high';
  private mode: Mode = 'menu';
  private paused = false;
  private time = 0; private last = 0; private alpha = 0;
  private readonly snaps: CarSnapshot[] = [];
  private readonly smokeT: number[] = []; private readonly skidT: number[] = [];
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private touch = false;
  private fatalShown = false;
  // race bookkeeping
  private lastCount = -1; private lastStage = ''; private lastLap = 0; private lastPlace = 0; private goTimer = 0; private hintTimer = 0;
  private finishHandled = false; private finishAt = 0; private maxTier = 0;
  private readonly host: HTMLElement;

  private constructor(host: HTMLElement) { this.host = host; }

  static async create(host: HTMLElement, progress: (p: number, label: string) => void): Promise<Game> {
    const g = new Game(host);
    await g.init(progress);
    return g;
  }

  private async init(progress: (p: number, label: string) => void): Promise<void> {
    const step = async (p: number, label: string): Promise<void> => { progress(p, label); await new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0))); };
    const q = new URLSearchParams(location.search);
    const touchParam = q.get('touch');
    this.touch = touchParam ? touchParam === '1' : matchMedia('(pointer: coarse)').matches;
    await step(0.05, 'Starting graphics');
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.tier = this.resolveTier(q.get('q'));
    const pr = Math.min(devicePixelRatio || 1, TIERS[this.tier].maxPixelRatio);
    this.gfx = new Gfx(this.host, this.tier, pr);
    this.gfx.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); this.fatal('The graphics context was lost. Please reload the page.'); });
    await step(0.2, 'Building the island');
    const asphalt = await loadAsphalt(import.meta.env.BASE_URL, Math.min(8, this.gfx.renderer.capabilities.getMaxAnisotropy())).catch(() => undefined);
    this.world = new World(this.gfx.renderer, this.track, this.tier, COURSE.boostPads, asphalt);
    this.gfx.bindSun(this.world.sun);
    await step(0.45, 'Planting palms');
    this.scenery = new Scenery(this.track, this.world.terrain, this.tier);
    this.landmarks = new Landmarks(this.track, this.world.terrain, this.tier);
    this.world.props.add(this.scenery.group, this.landmarks.group);
    await step(0.6, 'Loading cars');
    await Promise.all(this.lodsFor(this.tier).map(l => this.assets.load(l)));
    await step(0.75, 'Tuning engines');
    for (let i = 0; i < RACE_CARS; i++) {
      const v = new CarView(this.assets); v.setVisible(false); this.world.scene.add(v.root); this.views.push(v);
      this.snaps.push({ x: 0, y: 0, z: 0, heading: 0, speed: 0, slip: 0, yawRate: 0, steer: 0, braking: false, boosting: false, drifting: false, driftTier: 0, impact: 0, onKerb: false, offRoad: false, grade: 0 });
      this.smokeT.push(0); this.skidT.push(0);
    }
    this.effects = new Effects(this.world.scene, TIERS[this.tier].particles, TIERS[this.tier].skidMarks);
    // optional: Poly Haven sunset HDRI as the car-only reflection environment (`?hdri`)
    if (q.has('hdri')) void import('../render/hdri').then(m => m.loadCarEnvironment(this.gfx.renderer, Math.atan2(SUN_DIR.z, SUN_DIR.x)))
      .then(env => { for (const v of this.views) v.setEnvMap(env.texture, env.rotationY); }).catch(e => console.warn('HDRI unavailable, using the procedural sky', e));
    this.rig.reducedMotion = this.reduced;
    await step(0.85, 'Painting the cars');
    this.controls = new Controls({ onPause: () => this.togglePause(), onRespawn: () => this.respawnPlayer(), onRestart: () => { if (this.mode === 'race') this.startRace(); } });
    this.ui = new UI(this.host, this.save, this.track, this.controls.touch, {
      race: () => this.startRace(), garage: () => this.openGarage(), settings: () => this.ui.openSettings(), help: () => this.ui.openHelp(), toggleSound: () => { this.save.update(d => { d.settings.sound = !d.settings.sound; }); this.applySettings(); this.ui.menu.refresh(); },
      preview: (v, l) => this.previewCar(v, l), done: () => this.showMenu(), sfx: k => (k === 'click' ? this.audio.click() : this.audio.unlockChime()),
      again: () => this.startRace(), menu: () => this.showMenu(),
      pause: () => this.togglePause(), resume: () => this.resume(), restart: () => this.startRace(), quit: () => this.showMenu(), respawn: () => this.respawnPlayer(),
      settingsChanged: () => this.applySettings(), resetProgress: () => { this.save.reset(); this.applySettings(); this.ui.menu.refresh(); },
    });
    this.ui.setTouch(this.touch);
    this.speedLines = new SpeedLines(this.ui.fx, !this.reduced);
    const quality = this.save.data.settings.quality;
    this.governor = new PerfGovernor(this.tier, pr, 42, 2.5, quality === 'auto' && !q.get('q'));
    this.applySettings();
    this.bindGlobal();
    this.resize(w, h);
    this.showMenu();
    await step(1, 'Ready');
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
    if (q.has('debug')) (window as unknown as { __rush: Game }).__rush = this;
  }

  // ------------------------------------------------------------------ setup helpers
  private resolveTier(override: string | null): Tier {
    const q = this.save.data.settings.quality;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const hints = { touch: this.touch, cores: navigator.hardwareConcurrency, memoryGb: nav.deviceMemory, devicePixelRatio: devicePixelRatio, width: this.host.clientWidth, height: this.host.clientHeight };
    return initialTier(hints, override ?? (q === 'auto' ? null : q));
  }

  private bindGlobal(): void {
    const ro = new ResizeObserver(() => this.resize(this.host.clientWidth, this.host.clientHeight));
    ro.observe(this.host);
    addEventListener('orientationchange', () => setTimeout(() => this.resize(this.host.clientWidth, this.host.clientHeight), 120));
    const unlock = (): void => { this.audio.unlock(); this.audio.setEnabled(this.save.data.settings.sound); };
    addEventListener('pointerdown', unlock, { once: true }); addEventListener('keydown', unlock, { once: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'race' && !this.paused) this.pause(); this.last = performance.now(); });
    addEventListener('blur', () => { if (this.mode === 'race' && !this.paused) this.pause(); });
    // garage: drag to orbit, wheel / pinch to zoom
    const area = this.ui.garage.dragSurface; const ptrs = new Map<number, { x: number; y: number }>(); let pinch = 0;
    area.addEventListener('pointerdown', e => { area.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.rig.orbit.auto = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    area.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) this.rig.nudgeOrbit(-dx * 0.0085, dy * 0.005);
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.rig.nudgeOrbit(0, 0, (pinch - d) * 0.02); pinch = d; }
    });
    const up = (e: PointerEvent): void => { ptrs.delete(e.pointerId); if (ptrs.size === 0) this.rig.orbit.auto = 0.2; };
    area.addEventListener('pointerup', up); area.addEventListener('pointercancel', up);
    area.addEventListener('wheel', e => { this.rig.nudgeOrbit(0, 0, e.deltaY * 0.004); e.preventDefault(); }, { passive: false });
  }

  private resize(w: number, h: number): void {
    if (w < 2 || h < 2) return;
    this.gfx.resize(w, h); this.rig.resize(w, h); this.speedLines.resize(w, h);
    this.applyCameraShift(true);
  }

  private applySettings(): void {
    const s = this.save.data.settings;
    this.audio.setEnabled(s.sound);
    this.controls.autoAccelerate = this.touch && s.autoAccelerate;
    const want = this.resolveTier(new URLSearchParams(location.search).get('q'));
    if (want !== this.tier) this.setTier(want);
    this.governor.enabled = s.quality === 'auto' && !new URLSearchParams(location.search).get('q');
  }

  /** Car detail levels a tier needs: [player, rivals]. */
  private lodPair(tier: Tier): [CarLod, CarLod] { return tier === 'high' ? ['high', 'mid'] : tier === 'medium' ? ['mid', 'low'] : ['low', 'low']; }
  private lodsFor(tier: Tier): CarLod[] { return [...new Set(this.lodPair(tier))]; }
  private applyLods(): void {
    const [p, r] = this.lodPair(this.tier);
    this.views.forEach((v, i) => v.setLod(this.assets.has(i === 0 ? p : r) ? (i === 0 ? p : r) : 'low'));
  }

  private setTier(tier: Tier): void {
    this.tier = tier;
    void Promise.all(this.lodsFor(tier).map(l => this.assets.load(l))).then(() => { this.applyLods(); if (this.mode !== 'race') this.refreshShowcase(); }); this.gfx.setTier(tier); this.world.setTier(tier);
    this.scenery.dispose(); this.scenery = new Scenery(this.track, this.world.terrain, tier); this.world.props.add(this.scenery.group);
    this.governor.tier = tier;
  }

  private fatal(msg: string): void {
    if (this.fatalShown) return; this.fatalShown = true;
    const f = document.getElementById('fatal'); if (!f) return;
    const p = f.querySelector('p'); if (p) p.textContent = msg; f.style.display = 'grid';
  }

  // ------------------------------------------------------------------ modes
  private applyCameraShift(instant = false): void {
    const portrait = this.host.clientHeight > this.host.clientWidth;
    this.rig.chaseShiftY = portrait && this.touch ? -0.16 : portrait ? -0.08 : 0;
    if (this.mode === 'menu') this.rig.setShift(portrait ? 0 : 0.2, portrait ? -0.2 : 0, instant);
    else if (this.mode === 'garage') this.rig.setShift(portrait ? 0 : 0.2, portrait ? -0.25 : 0, instant);
    else this.rig.setShift(0, 0, instant);
  }

  private showcasePose(): void {
    this.track.pointAt(12, 0, tmp);
    const sn = this.snaps[0];
    Object.assign(sn, { x: tmp.x, y: tmp.y, z: tmp.z, heading: tmp.heading, speed: 0, slip: 0, yawRate: 0, steer: 0, braking: false, boosting: false, drifting: false, driftTier: 0, impact: 0, onKerb: false, offRoad: false, grade: 0 });
    this.rig.orbit.target.set(tmp.x, tmp.y + 0.75, tmp.z);
  }

  private showMenu(): void {
    this.mode = 'menu'; this.paused = false; this.sim = null; this.ui.modal.hide();
    this.controls.enabled = false; this.controls.reset(); this.audio.silenceEngine();
    this.views.forEach((v, i) => v.setVisible(i === 0));
    this.landmarks.setStartLights(0, false); this.effects.clear(); this.obstacles?.dispose(); this.obstacles = null;
    this.applyLods(); this.refreshShowcase(); this.showcasePose();
    this.setOrbit({ yaw: 2.5, pitch: 0.17, dist: 9.2, auto: 0.14, minDist: 5.5, maxDist: 14 });
    this.ui.show('menu'); this.applyCameraShift();
    this.speedLines.update(0, 0, false);
  }

  /** Orbit settings, with distances widened on narrow (portrait) screens so the whole car still fits. */
  private setOrbit(o: { yaw: number; pitch: number; dist: number; auto: number; minDist: number; maxDist: number }): void {
    const aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight);
    const k = clamp(0.95 / aspect, 1, 2.4);
    Object.assign(this.rig.orbit, o, { dist: o.dist * k, minDist: o.minDist * k, maxDist: o.maxDist * k });
  }

  private openGarage(): void {
    this.mode = 'garage';
    this.views.forEach((v, i) => v.setVisible(i === 0));
    this.showcasePose();
    this.setOrbit({ yaw: 2.6, pitch: 0.2, dist: 7.6, auto: 0.2, minDist: 4.8, maxDist: 11 });
    this.ui.show('garage'); this.applyCameraShift();
  }

  private previewCar(v: VehicleId, l: Loadout): void { this.applyLods(); this.views[0].setLook(v, l); }
  private refreshShowcase(): void { const d = this.save.data; this.views[0].setLook(d.selected, d.loadouts[d.selected]); }

  private startRace(): void {
    this.ui.modal.hide();
    const s = this.save.data.settings;
    this.sim = new RaceSim({ laps: s.laps, difficulty: s.difficulty, cars: RACE_CARS, playerSlot: PLAYER_SLOT, seed: 7 }, this.track);
    this.obstacles?.dispose(); this.obstacles = new Obstacles(this.sim.obstacles); this.world.props.add(this.obstacles.group);
    this.applyLods();
    const d = this.save.data;
    const playerPaint = d.loadouts[d.selected].paint;
    this.views.forEach((v, i) => {
      v.setVisible(true);
      if (i === 0) v.setLook(d.selected, d.loadouts[d.selected]);
      else { const r = RIVALS[(i - 1) % RIVALS.length]; v.setLook(r.vehicle, r.loadout.paint === playerPaint ? { ...r.loadout, paint: playerPaint === 'cherry' ? 'ocean' : 'cherry' } : r.loadout); }
    });
    this.effects.clear(); this.landmarks.setStartLights(0, false);
    this.paused = false; this.mode = 'race'; this.finishHandled = false; this.lastCount = -1; this.lastStage = ''; this.lastLap = 0; this.lastPlace = this.sim.ranks[0]; this.goTimer = 0; this.hintTimer = 0; this.maxTier = 0;
    this.controls.reset(); this.controls.enabled = false;
    this.ui.hud.resetHint(); this.ui.show('hud'); this.applyCameraShift(true);
    this.sim.step(0); this.snapshotAll(1);
    this.rig.mode = 'intro'; this.audio.unlock();
  }

  private togglePause(): void {
    if (this.mode !== 'race') return;
    if (this.paused) this.ui.modal.hide(); else this.pause();
  }
  private pause(): void {
    if (this.mode !== 'race' || this.paused) return;
    this.paused = true; this.controls.reset(); this.audio.silenceEngine();
    this.ui.openPause(() => this.resume());
  }
  private resume(): void { if (this.mode === 'race') { this.paused = false; this.last = performance.now(); } }

  private respawnPlayer(): void {
    if (this.mode !== 'race' || this.paused || !this.sim || this.sim.stage !== 'racing') return;
    this.sim.respawn(this.sim.cars[0]);
  }

  // ------------------------------------------------------------------ frame
  private snapshotAll(alpha: number): void {
    const sim = this.sim; if (!sim) return;
    for (let i = 0; i < sim.cars.length; i++) {
      const c = sim.cars[i], s = this.snaps[i];
      s.x = lerp(c.px, c.x, alpha); s.y = lerp(c.py, c.y, alpha); s.z = lerp(c.pz, c.z, alpha);
      s.heading = c.pheading + angleDiff(c.pheading, c.heading) * alpha;
      s.speed = c.speed; s.slip = c.slip; s.yawRate = c.yawRate; s.steer = c.steerVis; s.braking = c.braking;
      s.boosting = c.boosting || c.boostTimer > 0; s.drifting = c.drifting; s.driftTier = c.driftTier; s.impact = c.impact; s.onKerb = c.onKerb; s.offRoad = c.offRoad;
      this.track.pointAt(c.tq.s + 2, 0, tmp); this.track.pointAt(c.tq.s - 2, 0, tmp2);
      s.grade = clamp((tmp.y - tmp2.y) / 4, -0.3, 0.3);
    }
  }

  private frame(now: number): void {
    requestAnimationFrame(t => this.frame(t));
    if (this.fatalShown) return;
    const dt = clamp((now - this.last) / 1000, 0.0001, 0.1); this.last = now; this.time += dt;
    try { this.tick(dt); } catch (e) { console.error(e); this.fatal('Something went wrong while drawing the game. Please reload the page.'); }
  }

  private tick(dt: number): void {
    const sim = this.sim;
    const racing = (this.mode === 'race' || this.mode === 'results') && sim;
    if (racing && sim && !this.paused) {
      const live = this.mode === 'race' && sim.stage === 'racing' && !sim.autopilot;
      this.controls.enabled = live;
      if (live) this.controls.read(sim.playerInput, dt); else { sim.playerInput.throttle = 0; sim.playerInput.brake = 0; sim.playerInput.steer = 0; sim.playerInput.handbrake = false; sim.playerInput.boost = false; }
      this.alpha = sim.advance(dt);
      if (this.mode === 'race') this.raceFlow(sim, dt);
    }
    if (racing && sim) { this.snapshotAll(this.paused ? this.alpha : this.alpha); this.updateRaceVisuals(sim, dt); }
    else this.updateShowcase(dt);

    this.landmarks.update(this.time); this.scenery.update(this.time, this.rig.camera.position); this.obstacles?.update(this.time);
    const fx = this.snaps[0];
    this.world.update(this.rig.camera, this.time, fx.x, fx.y, fx.z, TIERS[this.tier].shadowRange, TIERS[this.tier].shadowMap);
    this.effects.update(dt, this.gfx.pointScale);
    this.gfx.render(this.world.scene, this.rig.camera);
    if (this.mode === 'race') {
      const act = this.governor.update(dt);
      if (act?.kind === 'pixelRatio') { this.gfx.setPixelRatio(act.value); }
      else if (act?.kind === 'tier') { this.setTier(act.value); this.gfx.setPixelRatio(this.governor.pixelRatio); }
    }
    const bootEl = document.getElementById('loading');
    if (bootEl) { bootEl.classList.add('done'); setTimeout(() => bootEl.remove(), 450); }
  }

  private updateShowcase(dt: number): void {
    const s = this.snaps[0];
    this.views[0].update(s, dt, this.time);
    this.rig.updateOrbit(dt);
    this.speedLines.update(dt, 0, false);
    this.ui.hud.drawMap([]);
  }

  private focusOf(c: CarState, s: CarSnapshot): FocusState {
    return { x: s.x, y: s.y, z: s.z, heading: s.heading, vx: c.vx, vz: c.vz, speed: Math.abs(c.speed), boosting: s.boosting, drifting: c.drifting, yawRate: c.yawRate, impact: c.impact };
  }

  private raceFlow(sim: RaceSim, dt: number): void {
    const p = sim.cars[0];
    // stage transitions
    if (sim.stage !== this.lastStage) {
      if (sim.stage === 'countdown') { this.rig.snapChase(this.focusOf(p, this.snaps[0])); }
      if (sim.stage === 'racing') { this.ui.hud.showCount('GO', true); this.audio.beep(true); this.landmarks.setStartLights(3, true); this.goTimer = 0.9; this.hintTimer = 6; }
      if (sim.stage === 'finished' && !this.finishHandled) {
        this.finishHandled = true; this.finishAt = this.time + 2.8;
        this.ui.hud.toast('Finish!', 'gold'); this.audio.lap(true); this.audio.fanfare(sim.playerPlace <= 3);
        this.effects.confetti(this.snaps[0].x, this.snaps[0].y + 3, this.snaps[0].z, 160);
      }
      this.lastStage = sim.stage;
    }
    if (sim.stage === 'countdown') {
      const n = Math.max(1, Math.ceil(sim.countdownRemaining));
      if (n !== this.lastCount) { this.lastCount = n; this.ui.hud.showCount(String(n)); this.audio.beep(false); this.landmarks.setStartLights(4 - n, false); }
    }
    if (this.goTimer > 0) { this.goTimer -= dt; if (this.goTimer <= 0) this.ui.hud.showCount(''); }
    if (this.hintTimer > 0) { this.hintTimer -= dt; if (this.hintTimer <= 0) this.ui.hud.fadeKeyHint(); }
    // laps and places
    if (p.lap !== this.lastLap && !p.finished) { this.lastLap = p.lap; const final = p.lap === sim.config.laps - 1; this.ui.hud.toast(final ? 'Final lap' : `Lap ${p.lap + 1}`, final ? 'warn' : 'cyan'); this.audio.lap(final); }
    const place = sim.ranks[0];
    if (place !== this.lastPlace && sim.stage === 'racing') { this.ui.hud.placeChanged(place < this.lastPlace ? 1 : -1); this.lastPlace = place; }
    // player events
    for (const e of p.events) this.playerEvent(e, p);
    p.events.length = 0;
    if (this.finishHandled && this.time >= this.finishAt) this.showResults(sim);
  }

  private playerEvent(e: string, p: CarState): void {
    const s = this.snaps[0];
    switch (e) {
      case 'driftTier': this.audio.driftTier(p.driftTier); this.maxTier = Math.max(this.maxTier, p.driftTier); break;
      case 'miniTurbo': this.audio.miniTurbo(Math.max(0, this.maxTier - 1)); this.effects.boostBurst(s.x, s.y + 0.6, s.z, p.vx, p.vz, [0x35a0ff, 0xff9a3a, 0xc060ff][clamp(this.maxTier - 1, 0, 2)]); this.ui.hud.toast('Mini-turbo!', 'cyan'); this.maxTier = 0; break;
      case 'driftStart': this.maxTier = 0; break;
      case 'boostStart': this.audio.boost(); break;
      case 'pad': this.audio.pad(); this.ui.hud.toast('Boost pad!', 'gold'); this.effects.boostBurst(s.x, s.y + 0.5, s.z, p.vx, p.vz, 0xffc23a); break;
      case 'wall': { this.audio.hit(p.impact); const side = Math.sign(p.tq.d) || 1; this.effects.sparks(s.x + p.tq.tz * side * 1.1, s.y + 0.4, s.z - p.tq.tx * side * 1.1, p.tq.tx, p.tq.tz, 14 + Math.min(20, p.impact)); break; }
      case 'car': case 'barrel': this.audio.hit(p.impact); this.effects.sparks(s.x, s.y + 0.5, s.z, Math.sin(s.heading), Math.cos(s.heading), 10); break;
      case 'cone': this.audio.cone(); break;
      case 'respawn': this.ui.hud.toast('Back on track', 'good'); break;
      default: break;
    }
  }

  private updateRaceVisuals(sim: RaceSim, dt: number): void {
    const dots: MapDot[] = [];
    for (let i = 0; i < sim.cars.length; i++) {
      const c = sim.cars[i], s = this.snaps[i], v = this.views[i];
      v.update(s, dt, this.time);
      // tyre smoke + skid marks + off-road dust
      if (c.drifting && !c.offRoad && Math.abs(c.speed) > 12) {
        this.smokeT[i] -= dt; this.skidT[i] -= dt;
        for (const side of [0, 1] as const) {
          v.rearWheelWorld(side, tmpV);
          if (this.smokeT[i] <= 0) this.effects.tyreSmoke(tmpV.x, tmpV.y + 0.1, tmpV.z, c.vx, c.vz, 0.6 + c.driftTier * 0.15);
          if (this.skidT[i] <= 0) this.effects.skids.add(tmpV.x, tmpV.y + 0.02, tmpV.z, s.heading + clamp(c.slip * 0.02, -0.4, 0.4), 1);
        }
        if (this.smokeT[i] <= 0) this.smokeT[i] = 0.035; if (this.skidT[i] <= 0) this.skidT[i] = 0.05;
      } else if (c.offRoad && Math.abs(c.speed) > 10 && i <= 5) {
        this.smokeT[i] -= dt;
        if (this.smokeT[i] <= 0) { this.smokeT[i] = 0.06; v.rearWheelWorld(0, tmpV); this.effects.tyreSmoke(tmpV.x, tmpV.y + 0.1, tmpV.z, c.vx, c.vz, 0.5, true); }
      }
      const paint = i === 0 ? findPaint(this.save.data.loadouts[this.save.data.selected].paint) : findPaint(RIVALS[(i - 1) % RIVALS.length].loadout.paint);
      dots.push({ x: s.x, z: s.z, color: hex(paint.color), player: i === 0 });
    }
    const p = sim.cars[0], ps = this.snaps[0];
    // camera
    const f = this.focusOf(p, ps);
    if (this.mode === 'results') { this.rig.orbit.target.set(ps.x, ps.y + 0.8, ps.z); this.rig.updateOrbit(dt); }
    else if (sim.stage === 'intro') this.rig.updateIntro(f, clamp(sim.stageTime / INTRO_SECONDS, 0, 1));
    else this.rig.updateChase(f, dt);
    // hud
    const best = p.lapTimes.length ? Math.min(...p.lapTimes) : null;
    this.ui.hud.update({
      kmh: Math.abs(p.speed) * 3.6, place: sim.ranks[0], total: sim.cars.length, lap: Math.min(sim.config.laps, p.lap + 1), laps: sim.config.laps,
      time: sim.playerFinishedAt >= 0 ? sim.playerFinishedAt : sim.stage === 'racing' ? sim.raceTime : 0, bestLap: best,
      boost: p.boostMeter, boosting: ps.boosting, driftTier: p.driftTier, drifting: p.drifting, wrongWay: p.wrongWay > 1.0, stuck: p.stuck > 2.2 && sim.stage === 'racing' && !sim.autopilot,
    });
    this.ui.hud.drawMap(dots);
    this.speedLines.update(dt, clamp((Math.abs(p.speed) - 42) / 36, 0, 1) * (this.mode === 'race' ? 1 : 0), ps.boosting);
    this.audio.setEngine(this.mode === 'race' && !this.paused && sim.stage !== 'intro', Math.abs(p.speed) / 62, this.sim?.playerInput.throttle ?? 0, ps.boosting, p.drifting, p.slip);
  }

  // ------------------------------------------------------------------ results
  private showResults(sim: RaceSim): void {
    this.mode = 'results'; this.controls.enabled = false; this.audio.silenceEngine();
    // let the rivals finish so the table has real times (bounded)
    for (let i = 0; i < 120 * 90 && !sim.allFinished; i++) sim.step(FIXED_DT);
    for (const c of sim.cars) c.events.length = 0;
    const p = sim.cars[0];
    const d = this.save.data;
    const place = sim.playerPlace || sim.ranks[0];
    const bestLap = p.lapTimes.length ? Math.min(...p.lapTimes) : null;
    const raceTime = sim.playerFinishedAt;
    const rewards = computeRewards({ place, laps: sim.config.laps, difficulty: sim.config.difficulty, driftSeconds: p.stats.driftSeconds, wallHits: p.stats.hits, fastestLapOfRace: sim.fastestLapCar === 0 });
    const newBestLap = bestLap !== null && (d.best.lap === null || bestLap < d.best.lap);
    const newBestRace = raceTime > 0 && sim.config.laps === 3 && (d.best.race === null || raceTime < d.best.race);
    const before = d.coins;
    this.save.update(s => {
      s.coins += rewards.total; s.stats.races++; if (place === 1) s.stats.wins++; if (place <= 3) s.stats.podiums++;
      if (newBestLap) s.best.lap = bestLap; if (newBestRace) s.best.race = raceTime;
    });
    const after = this.save.data.coins;
    const unlockable: string[] = [];
    (Object.keys(CATEGORIES) as CategoryId[]).forEach(cat => CATEGORIES[cat].forEach(it => { if (it.price > before && it.price <= after && !this.save.isUnlocked(cat, it.id)) unlockable.push(it.name); }));
    const order = [...sim.cars].sort((a, b) => sim.ranks[a.id] - sim.ranks[b.id]);
    this.ui.results.show({
      place, total: sim.cars.length, time: raceTime, bestLap, newBestLap, newBestRace: newBestRace && sim.config.laps === 3,
      rows: order.map(c => ({ name: c.id === 0 ? 'You' : RIVALS[(c.id - 1) % RIVALS.length].name, time: c.finished ? c.finishTime : null, me: c.id === 0 })),
      rewards, coinsAfter: after, topSpeedKmh: p.stats.topSpeed * 3.6, driftSeconds: p.stats.driftSeconds, unlockable: unlockable.slice(0, 3),
    });
    Object.assign(this.rig.orbit, { yaw: this.snaps[0].heading + 2.4, pitch: 0.22, dist: 9, auto: 0.18 });
    this.ui.show('results'); this.applyCameraShift();
    this.rig.setShift(window.innerHeight > window.innerWidth ? 0 : 0.0, 0);
    this.ui.hud.resetHint();
  }

  // ------------------------------------------------------------------ debug hooks (only exposed with ?debug)
  debugState(): Record<string, unknown> {
    const s = this.sim, p = s?.cars[0];
    return { mode: this.mode, tier: this.tier, paused: this.paused, stage: s?.stage, lap: p?.lap, place: s?.ranks[0], speed: p?.speed, raceTime: s?.raceTime, coins: this.save.data.coins, frames: this.time };
  }
  debugFastForward(seconds: number, autopilot = true): void {
    if (!this.sim) return;
    if (autopilot) this.sim.autopilot = true;
    for (let i = 0; i < seconds * 120; i++) this.sim.step(FIXED_DT);
    for (const c of this.sim.cars) c.events.length = 0;
    for (const c of this.sim.cars) { c.px = c.x; c.py = c.y; c.pz = c.z; c.pheading = c.heading; }
    this.snapshotAll(1); this.rig.snapChase(this.focusOf(this.sim.cars[0], this.snaps[0]));
  }
}
const tmpV = new Vector3();
