import { fbm2 } from '../sim/noise';
import { smoothstep, lerp } from '../sim/math';
import { newQuery, type Track } from '../sim/Track';

/**
 * Pure height-field description of the island (no three.js). The ground is the natural island blended into the
 * circuit's own height profile, so the road always sits on a believable embankment.
 */
export const ISLAND = { cx: 50, cz: -185, rx: 560, rz: 420, peakX: 95, peakZ: -195 };
export const SEA_LEVEL = 0;
export const TERRAIN = { minX: -800, maxX: 860, minZ: -780, maxZ: 380, cell: 6 };

/** Island terrain without the road: rolling hills, a central mountain and a coastline that fades to the sea floor. */
export function naturalHeight(x: number, z: number): number {
  const dx = (x - ISLAND.cx) / ISLAND.rx, dz = (z - ISLAND.cz) / ISLAND.rz;
  let r = Math.hypot(dx, dz);
  r *= 1 + 0.2 * (fbm2(x * 0.0035 + 3, z * 0.0035 - 5, 3) * 2 - 1) + 0.05 * (fbm2(x * 0.02, z * 0.02, 2) * 2 - 1);
  const land = 1 - smoothstep(0.78, 1.02, r);
  const base = lerp(-10, 6, land);
  const hills = (fbm2(x * 0.007 + 11, z * 0.007 + 4, 4) - 0.35) * 22 * land * smoothstep(0.1, 0.6, land);
  const px = x - ISLAND.peakX, pz = z - ISLAND.peakZ;
  const peak = 46 * Math.exp(-(px * px + pz * pz) / (2 * 80 * 80));
  const ridge = 10 * smoothstep(0.55, 0.85, fbm2(x * 0.012 - 9, z * 0.012 + 2, 3)) * land;
  return base + hills + peak * (0.4 + 0.6 * land) + ridge + reliefDetail(x, z, land, hills + ridge);
}

/**
 * Mid-frequency relief on top of the broad hills: eroded spurs and gullies (ridged noise), knolls and small benches.
 * The 6 m terrain grid can resolve wavelengths down to ~35 m, so this is what gives hillsides a believable silhouette
 * instead of one smooth slope. It fades out toward the coast (beaches stay flat) and is flattened near the road by `groundHeight`.
 */
function reliefDetail(x: number, z: number, land: number, broad: number): number {
  const inland = smoothstep(0.55, 0.95, land);
  if (inland <= 0) return 0;
  const rid = (u: number, v: number, oct: number): number => 1 - Math.abs(fbm2(u, v, oct) * 2 - 1);
  // gullies run down-slope: stretch the noise a little so the ridges read as spurs, not blobs
  const spurs = Math.pow(rid(x * 0.021 + 17, z * 0.017 - 31, 3), 2.2) - 0.35;
  const knolls = fbm2(x * 0.05 + 5, z * 0.05 + 9, 3) - 0.5;
  const bench = Math.sin(broad * 0.55 + fbm2(x * 0.02, z * 0.02, 2) * 4) * 0.5;
  const amp = 0.55 + 0.45 * smoothstep(2, 16, broad);   // taller hills get more relief
  return (spurs * 8.5 + knolls * 5.5 + bench * 0.9) * inland * amp;
}

const q = newQuery();
/** Final ground height: natural terrain blended into the circuit profile near the road. */
export function groundHeight(track: Track, x: number, z: number): number {
  const nat = naturalHeight(x, z);
  const inner = track.wallOffset + 3;
  const outer = track.wallOffset + 50;
  const d = track.nearest(x, z, outer + 4, q);
  if (d < 0 || d > outer) return nat;
  const roadY = q.y - 0.75;
  const k = smoothstep(inner, outer, d);
  // keep the verge under the road, never above it, then ease into the natural land
  const target = lerp(roadY, nat, k);
  return d < inner ? roadY : target;
}
