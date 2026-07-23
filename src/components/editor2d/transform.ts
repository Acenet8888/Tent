export type PlanTransform = {
  /** pixels per millimetre */
  scale: number;
  /** screen-space pixel offset of the world origin (0,0) */
  offsetX: number;
  offsetY: number;
};

/** Maps a top-down (x length, z width) millimetre position to SVG pixel coordinates. */
export function planToScreen(x: number, z: number, t: PlanTransform): [number, number] {
  return [x * t.scale + t.offsetX, z * t.scale + t.offsetY];
}

/** Inverse of planToScreen: converts SVG pixel coordinates back to millimetres. */
export function screenToPlan(px: number, py: number, t: PlanTransform): [number, number] {
  return [(px - t.offsetX) / t.scale, (py - t.offsetY) / t.scale];
}

export function snapToGrid(valueMm: number, gridMm: number): number {
  if (gridMm <= 0) return valueMm;
  return Math.round(valueMm / gridMm) * gridMm;
}
