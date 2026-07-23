import type { PoleSegment } from "../types/tent";

/**
 * Tent poles are hollow tubing, not solid rod — using a solid cross-section
 * would overestimate weight by roughly 3-5x for typical wall thicknesses.
 * Neither wall thickness nor alloy is tracked per-segment (PoleSegment has
 * no such field), so this is a labeled estimate against fixed assumptions
 * rather than a precise, per-pole calculation:
 *
 * - Diameter: `segment.diameter` if set, else the same default used for
 *   rendering (see editor3d/PoleSegmentMesh.tsx).
 * - Wall thickness: a flat assumption typical of aluminium tent pole
 *   tubing (DAC/Easton-style poles run roughly 0.4-1.2mm depending on
 *   diameter; this picks a single representative value rather than
 *   modeling that curve).
 * - Alloy: 6061-T6 aluminium, the common tent-pole temper/alloy the user
 *   asked for ("T6 aluminium"), density ~2.70 g/cm^3. 7075-T6 (a stiffer,
 *   pricier alloy some poles use) is denser at ~2.81 g/cm^3 — swap
 *   ALUMINUM_T6_DENSITY_G_PER_MM3 below if that's the intended alloy.
 */
export const DEFAULT_POLE_DIAMETER_MM = 9;
export const DEFAULT_POLE_WALL_THICKNESS_MM = 0.9;
export const ALUMINUM_T6_DENSITY_G_PER_MM3 = 0.0027; // 6061-T6, ~2.70 g/cm^3

const GRAMS_PER_OUNCE = 28.349523125;

export type WeightUnit = "g" | "oz";

/** Estimated mass of a single pole segment's tubing, in grams. Arc segments use their live curve length. */
export function estimatePoleWeightGrams(segment: PoleSegment): number {
  const outerRadius = (segment.diameter ?? DEFAULT_POLE_DIAMETER_MM) / 2;
  const wallThickness = Math.min(DEFAULT_POLE_WALL_THICKNESS_MM, outerRadius);
  const innerRadius = Math.max(outerRadius - wallThickness, 0);
  const crossSectionAreaMm2 = Math.PI * (outerRadius ** 2 - innerRadius ** 2);
  return crossSectionAreaMm2 * segment.length * ALUMINUM_T6_DENSITY_G_PER_MM3;
}

export function formatWeight(grams: number, unit: WeightUnit): string {
  const value = unit === "oz" ? grams / GRAMS_PER_OUNCE : grams;
  return `${value.toFixed(value < 10 ? 2 : 1)} ${unit}`;
}
