import { Color, DirectionalLight, FogExp2, Group, HemisphereLight, PMREMGenerator, Scene, Vector3, type PerspectiveCamera, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import type { Track } from '../sim/Track';
import type { AsphaltPbr } from './pbr';
import { buildRoad, type RoadMeshes } from './roadMesh';
import { PALETTE, SUN_DIR, Sky, makeEnvironmentSky } from './sky';
import { TIERS, type Tier } from './quality';
import { buildTerrain, type Terrain } from './terrain';
import { Ocean } from './water';
import { buildBackdrop, disposeBackdrop } from './backdrop';

export const FOG_DENSITY = 0.00058;

/**
 * Static scenery of the island circuit: lighting, sky, ocean, ground and road. Props (trees, landmarks) are added by
 * `Scenery` into `props`. The world owns its GPU resources and releases them in `dispose`.
 */
export class World {
  readonly scene = new Scene();
  readonly props = new Group();
  readonly sun: DirectionalLight;
  readonly terrain: Terrain;
  readonly road: RoadMeshes;
  readonly sky: Sky;
  readonly ocean: Ocean;
  private readonly backdrop = buildBackdrop();
  private readonly envRT: WebGLRenderTarget;
  private readonly lightDir = SUN_DIR.clone();
  private readonly right = new Vector3(); private readonly up = new Vector3(); private readonly focus = new Vector3();

  constructor(renderer: WebGLRenderer, readonly track: Track, tier: Tier, pads: readonly number[], asphalt?: AsphaltPbr) {
    const scene = this.scene;
    scene.background = new Color(PALETTE.fog);
    scene.fog = new FogExp2(PALETTE.fog, FOG_DENSITY);

    // image-based lighting from the very same sky, so glossy paint reflects the sunset
    const pmrem = new PMREMGenerator(renderer);
    const envScene = new Scene(); envScene.add(makeEnvironmentSky());
    this.envRT = pmrem.fromScene(envScene, 0.02, 0.1, 200);
    pmrem.dispose();
    scene.environment = this.envRT.texture; scene.environmentIntensity = 1.0;

    this.sun = new DirectionalLight(0xffa55a, 3.6);
    this.sun.castShadow = true;
    scene.add(this.sun, this.sun.target);
    scene.add(new HemisphereLight(0x9fb0ff, 0xe8a077, 1.15));

    this.sky = new Sky(TIERS[tier].cloudOctaves);
    this.terrain = buildTerrain(track);
    this.ocean = new Ocean(this.terrain.heightTexture, FOG_DENSITY);
    this.road = buildRoad(track, pads, asphalt);
    scene.add(this.sky.mesh, this.backdrop, this.ocean.mesh, this.terrain.mesh, this.road.group, this.props);
  }

  setTier(tier: Tier): void { this.sky.setOctaves(TIERS[tier].cloudOctaves); }

  /** Keeps the sky centred on the camera and the shadow frustum centred (and texel-snapped) on the action. */
  update(camera: PerspectiveCamera, time: number, focusX: number, focusY: number, focusZ: number, shadowRange: number, shadowMap: number): void {
    this.sky.update(camera, time);
    this.ocean.update(time);
    this.road.update(time);
    const texel = (2 * shadowRange) / shadowMap;
    this.right.set(0, 1, 0).cross(this.lightDir).normalize();
    this.up.copy(this.lightDir).cross(this.right).normalize();
    this.focus.set(focusX, focusY, focusZ);
    const r = this.focus.dot(this.right), u = this.focus.dot(this.up);
    this.focus.addScaledVector(this.right, Math.round(r / texel) * texel - r).addScaledVector(this.up, Math.round(u / texel) * texel - u);
    this.sun.target.position.copy(this.focus);
    this.sun.position.copy(this.focus).addScaledVector(this.lightDir, 260);
    this.sun.target.updateMatrixWorld();
  }

  dispose(): void {
    this.envRT.dispose(); disposeBackdrop(this.backdrop); this.sky.dispose(); this.ocean.dispose(); this.road.dispose();
    this.terrain.mesh.geometry.dispose(); (this.terrain.mesh.material as { dispose(): void }).dispose(); this.terrain.heightTexture.dispose(); this.terrain.detail.dispose();
  }
}
