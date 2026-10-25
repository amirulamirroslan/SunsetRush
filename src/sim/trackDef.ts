/**
 * Course definition for "Coral Cove Circuit": control points of a closed Catmull-Rom spline in metres
 * (x, z on the ground plane, y = height above sea level). Everything else (road, walls, scenery, AI speed profile,
 * mini-map) is derived from this list, so editing the circuit means editing only these numbers.
 */
export interface ControlPoint { x: number; z: number; y: number }

/** Uniform scale applied to the hand-placed layout below (plan view and heights) to reach a ~2.5 km lap. */
const K = 1.38;
const scaled = (pts: ControlPoint[]): ControlPoint[] => pts.map(p => ({ x: p.x * K, z: p.z * K, y: p.y * 1.25 }));

export const COURSE = {
  name: 'Coral Cove Circuit',
  roadHalfWidth: 8,       // drivable asphalt: 16 m wide
  kerbWidth: 1.3,         // striped kerb outside the asphalt
  wallOffset: 12.5,       // solid barrier distance from the centre line
  points: scaled([
    { x: -90, z: 0, y: 1.0 },
    { x: 80, z: 0, y: 1.0 },
    { x: 230, z: -6, y: 1.5 },
    { x: 330, z: -60, y: 3.5 },
    { x: 372, z: -150, y: 6.5 },
    { x: 330, z: -240, y: 9.5 },
    { x: 235, z: -275, y: 11 },
    { x: 150, z: -235, y: 9 },
    { x: 85, z: -285, y: 6 },
    { x: 10, z: -335, y: 4 },
    { x: -85, z: -325, y: 3 },
    { x: -165, z: -270, y: 4.5 },
    { x: -175, z: -185, y: 7.5 },
    { x: -235, z: -135, y: 10 },
    { x: -305, z: -80, y: 8.5 },
    { x: -300, z: 5, y: 5 },
    { x: -235, z: 70, y: 2.5 },
    { x: -160, z: 62, y: 1.2 },
  ]),
  /** Distance (m) along the lap where boost pads sit. */
  boostPads: [430, 1180, 1960] as number[],
  /** Distance (m) along the lap and lateral offset for obstacle clusters (traffic cones / barrels). */
  obstacles: [
    { s: 300, lat: 5.2, kind: 'cone' as const, count: 4 },
    { s: 760, lat: -5.4, kind: 'barrel' as const, count: 2 },
    { s: 1050, lat: 4.6, kind: 'cone' as const, count: 5 },
    { s: 1500, lat: -4.8, kind: 'cone' as const, count: 4 },
    { s: 1760, lat: 5.0, kind: 'barrel' as const, count: 2 },
    { s: 2250, lat: -5.0, kind: 'cone' as const, count: 4 },
  ],
};
export type Course = typeof COURSE;
