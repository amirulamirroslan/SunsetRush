import {
  ACESFilmicToneMapping, HalfFloatType, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector2, WebGLRenderTarget, WebGLRenderer, type DirectionalLight,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TIERS, type Tier } from './quality';
import { setMaxAnisotropy } from './textures';

/** Owns the WebGL renderer, the optional bloom pipeline and the resolution / tier switches. */
export class Gfx {
  readonly renderer: WebGLRenderer;
  tier: Tier;
  pixelRatio: number;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private width = 1; private height = 1;
  private readonly light: { sun: DirectionalLight | null } = { sun: null };
  private readonly grade: HTMLDivElement;

  constructor(host: HTMLElement, tier: Tier, pixelRatio: number) {
    this.tier = tier;
    this.pixelRatio = Math.min(pixelRatio, TIERS[tier].maxPixelRatio);
    this.renderer = new WebGLRenderer({ antialias: tier !== 'low', powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.className = 'gl-canvas';
    host.appendChild(this.renderer.domElement);
    // cheap screen-space grade (works on every tier): vignette + warm lift, drawn by the compositor, not the GPU scene pass
    this.grade = document.createElement('div'); this.grade.className = 'grade'; host.appendChild(this.grade);
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.applyTier();
  }

  bindSun(sun: DirectionalLight): void { this.light.sun = sun; this.applyShadow(); }

  private applyShadow(): void {
    const sun = this.light.sun; if (!sun) return;
    const t = TIERS[this.tier];
    sun.shadow.mapSize.set(t.shadowMap, t.shadowMap);
    sun.shadow.map?.dispose(); sun.shadow.map = null;
    const r = t.shadowRange, cam = sun.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 1; cam.far = 600; cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35 * (r / 60);
  }

  private applyTier(): void {
    const t = TIERS[this.tier];
    this.pixelRatio = Math.min(this.pixelRatio, t.maxPixelRatio);
    if (t.bloom && !this.composer) this.buildComposer();
    else if (!t.bloom && this.composer) { this.composer.dispose(); this.bloom?.dispose(); this.composer = null; this.bloom = null; this.renderPass = null; }
    this.applyShadow();
    this.resize(this.width, this.height);
  }

  private buildComposer(): void {
    const rt = new WebGLRenderTarget(Math.max(1, this.width), Math.max(1, this.height), { type: HalfFloatType, samples: TIERS[this.tier].msaa ? 4 : 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(new Scene(), new PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new Vector2(this.width, this.height), 0.55, 0.85, 1.0);
    this.composer.addPass(this.renderPass); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
  }

  setTier(tier: Tier): void { this.tier = tier; this.applyTier(); }
  setPixelRatio(pr: number): void { this.pixelRatio = Math.min(pr, TIERS[this.tier].maxPixelRatio); this.resize(this.width, this.height); }
  get usesBloom(): boolean { return this.composer !== null; }

  resize(w: number, h: number): void {
    this.width = Math.max(1, w); this.height = Math.max(1, h);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer?.setPixelRatio(this.pixelRatio);
    this.composer?.setSize(this.width, this.height);
  }

  render(scene: Scene, camera: PerspectiveCamera): void {
    if (this.composer && this.renderPass) { this.renderPass.scene = scene; this.renderPass.camera = camera; this.composer.render(); }
    else this.renderer.render(scene, camera);
  }

  /** Pixels per world unit at distance 1 (for point-sprite sizing). */
  get pointScale(): number { return (this.height * this.pixelRatio) / 2; }

  dispose(): void { this.composer?.dispose(); this.bloom?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); this.grade.remove(); }
}
