import type { AnchorPoint, FabricPanel, PoleJoint, TentDesign } from "../types/tent";
import { deriveSeamsFromPanels } from "./generateFabricPanels";

/**
 * Stable ids for the four roof-related panels so regeneration can find and
 * replace exactly these entries (floor and wall panels are untouched here —
 * they're anchored to the fixed corner/eave anchors and don't depend on how
 * many poles exist).
 */
const ROOF_PANEL_IDS = ["roof-front-slope", "roof-back-slope", "roof-left-gable", "roof-right-gable"];

/** True if the fly drapes over this joint, honoring an explicit override or falling back to "apex only". */
export function isFlyAttachedJoint(joint: PoleJoint): boolean {
  return joint.flyAttachment ?? joint.type === "apex";
}

/** True if the fly pegs out to this anchor, honoring an explicit override or falling back to "corner/eave only". */
export function isFlyAttachedAnchor(anchor: AnchorPoint): boolean {
  return anchor.flyAttachment ?? (anchor.type === "corner" || anchor.type === "eave");
}

/**
 * Recomputes the fly (roof) panels from whichever points are currently
 * flagged as fly attachments, rather than a fixed set decided at creation
 * time. By default that's every "apex" pole joint (ridge ends, a hoop's
 * peak, an added straight pole's tip) plus the base perimeter (the eave
 * line if the tent has walls, otherwise the floor corners) — but any joint
 * or anchor's `flyAttachment` flag can override that default, so a hub
 * meant to carry the fabric can opt in, an apex that shouldn't kink the
 * roof can opt out, and an extra stake can pull the fly's edge out to it
 * (an awning-style peg point). This is deliberately an explicit mechanism
 * rather than an automatic "wrap the outermost points" solver: figuring out
 * which points are "on the outside" for an arbitrary 3D pole arrangement is
 * a hard problem in general, so the user marks it instead.
 *
 * The front/back slopes fan from the base line up across every attached
 * apex/hub joint (sorted by x); the two gables connect the outermost
 * attached joint to the nearest base points. This should run after any
 * mutation that could add/remove/reorder attachment points or move the
 * base anchors, which is why it's called from tentStore's shared
 * `withHistory` wrapper rather than from each action.
 */
export function regenerateRoofPanels(design: TentDesign): TentDesign {
  const nonRoofPanels = design.fabricPanels.filter((p) => !ROOF_PANEL_IDS.includes(p.id));

  const hasWalls = design.anchors.some((a) => a.type === "eave");
  const structuralBase = design.anchors.filter((a) => a.type === (hasWalls ? "eave" : "corner"));
  const extraPegs = design.anchors.filter(
    (a) => (a.type === "stake" || a.type === "tie-out") && isFlyAttachedAnchor(a)
  );
  const baseAnchors = [...structuralBase, ...extraPegs];

  const flyJoints = design.poleJoints
    .filter(isFlyAttachedJoint)
    .slice()
    .sort((a, b) => a.position.x - b.position.x);

  if (baseAnchors.length === 0 || flyJoints.length === 0) {
    const fabricPanels = nonRoofPanels;
    return { ...design, fabricPanels, seams: deriveSeamsFromPanels(fabricPanels) };
  }

  const centroidZ = baseAnchors.reduce((sum, a) => sum + a.position.z, 0) / baseAnchors.length;
  const frontLine = baseAnchors.filter((a) => a.position.z <= centroidZ).sort((a, b) => a.position.x - b.position.x);
  const backLine = baseAnchors.filter((a) => a.position.z > centroidZ).sort((a, b) => a.position.x - b.position.x);

  if (frontLine.length === 0 || backLine.length === 0) {
    const fabricPanels = nonRoofPanels;
    return { ...design, fabricPanels, seams: deriveSeamsFromPanels(fabricPanels) };
  }

  // Both slopes trace their own base line ascending by x, then the ridge
  // descending by x, so the loop closes without crossing itself (tracing
  // the ridge in the "same" ascending direction as the base line would
  // produce a self-intersecting bowtie quad instead of a simple trapezoid).
  const flyIdsDesc = flyJoints.map((j) => j.id).reverse();

  const roofPanels: FabricPanel[] = [
    {
      id: "roof-front-slope",
      name: "Front Roof Slope",
      boundaryPointIds: [...frontLine.map((a) => a.id), ...flyIdsDesc],
    },
    {
      id: "roof-back-slope",
      name: "Back Roof Slope",
      boundaryPointIds: [...backLine.map((a) => a.id), ...flyIdsDesc],
    },
    {
      id: "roof-left-gable",
      name: "Left Gable",
      boundaryPointIds: [frontLine[0].id, backLine[0].id, flyJoints[0].id],
    },
    {
      id: "roof-right-gable",
      name: "Right Gable",
      boundaryPointIds: [
        frontLine[frontLine.length - 1].id,
        backLine[backLine.length - 1].id,
        flyJoints[flyJoints.length - 1].id,
      ],
    },
  ];

  const fabricPanels = [...nonRoofPanels, ...roofPanels];
  return { ...design, fabricPanels, seams: deriveSeamsFromPanels(fabricPanels) };
}
