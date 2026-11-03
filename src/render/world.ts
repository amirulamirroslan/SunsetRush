import { Color, DirectionalLight, FogExp2, Group, HemisphereLight, PMREMGenerator, Scene, Vector3, type PerspectiveCamera, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import type { Track } from '../sim/Track';
import type { AsphaltPbr } from './pbr';
import { buildRoad, type RoadMeshes } from './roadMesh';
import { Sky, makeEnvironmentSky } from './sky';
import { DEFAULT_ATMOSPHERE, type Atmosphere } from './atmosphere';
import { TIERS, type Tier } from './quality';
import { buildTerrain, type Terrain } from './terrain';
import { Ocean } from './water';
import { buildBackdrop, disposeBackdrop } from './backdrop';

/**
 * Static scenery of the island circuit: lighting, sky, ocean, ground and road. All time-of-day / weather identity comes from an
 * `Atmosphere` preset (see atmosphere.ts) and can be swapped with `setAtmosphere`. Props (trees, landmarks) are added by
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
  private backdrop: Group;
  private envRT: WebGLRenderTarget;
  private readonly hemi: HemisphereLight;
  private readonly lightDir = new Vector3();
  atmosphere: Atmosphere;
  private readonly right = new Vector3(); private readonly up = new Vector3(); private readonly focus = new Vector3();

  constructor(private readonly renderer: WebGLRenderer, readonly track: Track, tier: Tier, pads: readonly number[], asphalt?: AsphaltPbr, atmosphere: Atmosphere = DEFAULT_ATMOSPHERE) {
    const scene = this.scene;
    this.atmosphere = atmosphere;
    this.lightDir.copy(atmosphere.sunDir);
    this.backdrop = buildBackdrop(atmosphere);
    scene.background = new Color(atmosphere.fog);
    scene.fog = new FogExp2(atmosphere.fog, atmosphere.fogDensity);

    // image-based lighting from the very same sky dome, so ambient light and glossy paint always agree with what is overhead
    this.envRT = this.bakeEnvironment(atmosphere);
    scene.environment = this.envRT.texture; scene.environmentIntensity = atmosphere.envIntensity;

    this.sun = new DirectionalLight(atmosphere.sunColor, atmosphere.sunIntensity);
    this.sun.castShadow = true;
    this.hemi = new HemisphereLight(atmosphere.hemiSky, atmosphere.hemiGround, atmosphere.hemiIntensity);
    scene.add(this.sun, this.sun.target, this.hemi);

    this.sky = new Sky(TIERS[tier].cloudOctaves, atmosphere);
    this.terrain = buildTerrain(track);
    this.ocean = new Ocean(this.terrain.heightTexture, atmosphere, this.sky.uniforms);
    this.road = buildRoad(track, pads, asphalt);
    scene.add(this.sky.mesh, this.backdrop, this.ocean.mesh, this.terrain.mesh, this.road.group, this.props);
  }

  private bakeEnvironment(a: Atmosphere): WebGLRenderTarget {
    const pmrem = new PMREMGenerator(this.renderer);
    const envScene = new Scene(); const envSky = makeEnvironmentSky(a); envScene.add(envSky);
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 200);
    pmrem.dispose(); envSky.geometry.dispose(); (envSky.material as { dispose(): void }).dispose();
    return rt;
  }

  /** Switches lighting + atmosphere at runtime (debug `?light=` and future per-track presets). Rebuilds the environment map and mountains. */
  setAtmosphere(a: Atmosphere): void {
    this.atmosphere = a; this.lightDir.copy(a.sunDir);
    const scene = this.scene;
    (scene.background as Color).set(a.fog); (scene.fog as FogExp2).color.set(a.fog); (scene.fog as FogExp2).density = a.fogDensity;
    this.sun.color.set(a.sunColor); this.sun.intensity = a.sunIntensity;
    this.hemi.color.set(a.hemiSky); this.hemi.groundColor.set(a.hemiGround); this.hemi.intensity = a.hemiIntensity;
    this.sky.setAtmosphere(a); this.ocean.setAtmosphere(a);
    this.envRT.dispose(); this.envRT = this.bakeEnvironment(a);
    scene.environment = this.envRT.texture; scene.environmentIntensity = a.envIntensity;
    scene.remove(this.backdrop); disposeBackdrop(this.backdrop); this.backdrop = buildBackdrop(a); scene.add(this.backdrop);
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
