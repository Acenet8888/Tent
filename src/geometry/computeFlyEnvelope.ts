import * as THREE from "three";
import { ConvexHull } from "three-stdlib";
import type { FabricPanel, TentDesign } from "../types/tent";
import { deriveSeamsFromPanels } from "./generateFabricPanels";
import { HULL_FLY_PREFIX, stripFlyPanels } from "./regenerateFlyFabric";

/**
 * Faces whose upward tilt is below this are treated as wall-like rather
 * than roof-like and excluded from the recomputed fly (this also throws
 * out the hull's downward-facing floor faces, which have negative y).
 */
const UPWARD_NORMAL_THRESHOLD = 0.05;

/**
 * The explicit "Recalculate Fly" action: unlike regenerateRoofPanels (which
 * runs after every edit using a fixed front/back-slope topology), this
 * computes the actual 3D convex hull of the base perimeter plus every
 * hub/apex pole joint, then keeps only the hull's upward-facing faces as
 * fly panels — the fly ends up draped over the true outermost envelope of
 * whatever poles currently exist, tall or short, centered or off to one
 * side, without needing any per-point flyAttachment flag. It ignores those
 * flags entirely (this is a distinct, on-demand alternative to the
 * incremental sweep, not a replacement for it — the next edit reverts to
 * the incremental method until this is run again).
 *
 * A convex hull can't represent a concave roofline (e.g. a valley between
 * two peaks) — every included point ends up on the outer envelope by
 * construction — which is the tradeoff for being fully automatic instead
 * of requiring the user to mark points by hand.
 */
export function computeConvexFlyEnvelope(design: TentDesign): TentDesign {
  const nonFlyPanels = stripFlyPanels(design.fabricPanels);

  const hasWalls = design.anchors.some((a) => a.type === "eave");
  const baseAnchors = design.anchors.filter((a) => a.type === (hasWalls ? "eave" : "corner"));
  const supportJoints = design.poleJoints.filter((j) => j.type === "hub" || j.type === "apex");

  const points: { id: string; vector: THREE.Vector3 }[] = [
    ...baseAnchors.map((a) => ({ id: a.id, vector: new THREE.Vector3(a.position.x, a.position.y, a.position.z) })),
    ...supportJoints.map((j) => ({ id: j.id, vector: new THREE.Vector3(j.position.x, j.position.y, j.position.z) })),
  ];

  if (points.length < 4) {
    return { ...design, fabricPanels: nonFlyPanels, seams: deriveSeamsFromPanels(nonFlyPanels) };
  }

  const idByVector = new Map<THREE.Vector3, string>(points.map((p) => [p.vector, p.id]));

  let hull: ConvexHull;
  try {
    hull = new ConvexHull().setFromPoints(points.map((p) => p.vector));
  } catch {
    // Degenerate point set (e.g. everything coplanar/coincident): leave the
    // fly as-is rather than crashing on a bad recompute.
    return design;
  }

  const flyPanels: FabricPanel[] = [];
  for (const face of hull.faces) {
    if (face.normal.y <= UPWARD_NORMAL_THRESHOLD) continue;

    const boundaryPointIds: string[] = [];
    let edge = face.edge;
    do {
      const id = idByVector.get(edge.head().point);
      if (id) boundaryPointIds.push(id);
      edge = edge.next;
    } while (edge !== face.edge);

    if (boundaryPointIds.length >= 3) {
      flyPanels.push({
        id: `${HULL_FLY_PREFIX}${flyPanels.length}`,
        name: `Fly Panel ${flyPanels.length + 1}`,
        boundaryPointIds,
      });
    }
  }

  const fabricPanels = [...nonFlyPanels, ...flyPanels];
  return { ...design, fabricPanels, seams: deriveSeamsFromPanels(fabricPanels) };
}
