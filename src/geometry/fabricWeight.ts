import type { TentDesign, Vector3 } from "../types/tent";
import { buildPointLookup, resolvePanelBoundary } from "./generateFabricPanels";
import { triangulatePanel } from "./triangulatePanel";
import { isFlyPanel } from "./regenerateFlyFabric";
import { subtract } from "./measurements";

const MM2_PER_M2 = 1_000_000;

function cross(a: Vector3, b: Vector3): Vector3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function vectorLength(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function triangleAreaMm2(a: Vector3, b: Vector3, c: Vector3): number {
  return vectorLength(cross(subtract(b, a), subtract(c, a))) / 2;
}

export type FabricType = "dcf" | "silnylon-20d";

export const FABRIC_LABELS: Record<FabricType, string> = {
  dcf: "DCF",
  "silnylon-20d": "SilNylon 20D",
};

/**
 * Areal density isn't tracked per-panel (fabricPanels has no material
 * field), so — same spirit as the pole weight estimate — this picks one
 * representative weight per fabric rather than modeling the range each
 * actually spans:
 * - DCF: ~1.0 oz/yd^2 (e.g. Dyneema CT2E.08), a common mid-weight tent-fly
 *   grade; lighter (0.55-0.75 oz) and heavier (1.43 oz) grades exist.
 * - SilNylon 20D: ~1.1 oz/yd^2 double-sided silicone-coated nylon, a
 *   typical tent-fly weight; single-side coatings and denier variants shift
 *   this some.
 */
export const FABRIC_DENSITY_G_PER_M2: Record<FabricType, number> = {
  dcf: 34,
  "silnylon-20d": 40,
};

/** True 3D surface area of every current fly panel, summed from its triangulation (not the flattened cut-pattern approximation, so a hoop-affected curved panel's area isn't distorted by unrolling it flat). */
export function computeFlyAreaMm2(design: TentDesign): number {
  const lookup = buildPointLookup(design.anchors, design.poleJoints, design.poleSegments);
  let totalMm2 = 0;
  for (const panel of design.fabricPanels) {
    if (!isFlyPanel(panel)) continue;
    const boundary = resolvePanelBoundary(lookup, panel);
    if (boundary.length < 3) continue;
    const { vertices, triangles } = triangulatePanel(boundary);
    for (const [i, j, k] of triangles) {
      totalMm2 += triangleAreaMm2(vertices[i], vertices[j], vertices[k]);
    }
  }
  return totalMm2;
}

export function estimateFlyWeightGrams(areaMm2: number, fabricType: FabricType): number {
  const areaM2 = areaMm2 / MM2_PER_M2;
  return areaM2 * FABRIC_DENSITY_G_PER_M2[fabricType];
}
