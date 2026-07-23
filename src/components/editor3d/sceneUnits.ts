import type { Vector3 } from "../../types/tent";

/**
 * The design store keeps every measurement in millimetres (see
 * units/conversions.ts). Three.js scenes behave much better with
 * human-scale numbers for camera defaults, light falloff, and grid steps,
 * so the 3D view renders everything in metres. This conversion is purely
 * a rendering detail — it never touches stored design data.
 */
const MM_PER_METER = 1000;

export function toSceneVec3(v: Vector3): [number, number, number] {
  return [v.x / MM_PER_METER, v.y / MM_PER_METER, v.z / MM_PER_METER];
}

export function mmToScene(mm: number): number {
  return mm / MM_PER_METER;
}
