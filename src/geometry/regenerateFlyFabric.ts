import type { AnchorPoint, FabricPanel, PoleJoint, PoleSegment, TentDesign, Vector3 } from "../types/tent";
import { ARC_SAMPLE_STEPS, arcSamplePointId, deriveSeamsFromPanels } from "./generateFabricPanels";

/**
 * Stable ids for the four roof-related panels so regeneration can find and
 * replace exactly these entries (floor and wall panels are untouched here —
 * they're anchored to the fixed corner/eave anchors and don't depend on how
 * many poles exist).
 */
const ROOF_PANEL_IDS = ["roof-front-slope", "roof-back-slope", "roof-left-gable", "roof-right-gable"];

/** Id prefix used by computeFlyEnvelope.ts's convex-hull "Recalculate Fly" panels. */
export const HULL_FLY_PREFIX = "hull-fly-";

/**
 * Strips out fly/roof panels regardless of which method produced them, so
 * the incremental per-edit sweep (regenerateRoofPanels) and the one-shot
 * convex-hull recompute (computeFlyEnvelope.ts) never leave each other's
 * output lying around as duplicate/overlapping fabric — each one fully
 * owns replacing the other's prior result alongside its own.
 */
export function stripFlyPanels(panels: FabricPanel[]): FabricPanel[] {
  return panels.filter((p) => !ROOF_PANEL_IDS.includes(p.id) && !p.id.startsWith(HULL_FLY_PREFIX));
}

/** True for a fly/roof panel produced by either regenerateRoofPanels or computeConvexFlyEnvelope. */
export function isFlyPanel(panel: FabricPanel): boolean {
  return ROOF_PANEL_IDS.includes(panel.id) || panel.id.startsWith(HULL_FLY_PREFIX);
}

/** True if the fly drapes over this joint, honoring an explicit override or falling back to "apex only". */
export function isFlyAttachedJoint(joint: PoleJoint): boolean {
  return joint.flyAttachment ?? joint.type === "apex";
}

/** True if the fly pegs out to this anchor, honoring an explicit override or falling back to "corner/eave only". */
export function isFlyAttachedAnchor(anchor: AnchorPoint): boolean {
  return anchor.flyAttachment ?? (anchor.type === "corner" || anchor.type === "eave");
}

function inclusiveRange(from: number, to: number): number[] {
  const result: number[] = [];
  if (from <= to) {
    for (let i = from; i <= to; i++) result.push(i);
  } else {
    for (let i = from; i >= to; i--) result.push(i);
  }
  return result;
}

/**
 * If `joint` is the peak of a hoop (the archJointId of an arc segment),
 * returns the sampled-curve point ids from the peak down to each of the
 * hoop's two ground ends — one sequence per side of the tent (front/back,
 * split by which ground end is on which side of centroidZ) — so the fly can
 * follow the hoop's actual bend instead of cutting a straight chord from a
 * single peak vertex down to the baseline. Returns undefined for a plain
 * (non-hoop) joint, which keeps contributing just its own id as before.
 */
function hoopArcHalves(
  joint: PoleJoint,
  segments: PoleSegment[],
  jointPositions: Map<string, Vector3>,
  centroidZ: number
): { front: string[]; back: string[] } | undefined {
  const segment = segments.find((s) => s.shape === "arc" && s.archJointId === joint.id);
  if (!segment) return undefined;

  const startPos = jointPositions.get(segment.startJointId);
  const endPos = jointPositions.get(segment.endJointId);
  if (!startPos || !endPos) return undefined;

  const peakIndex = ARC_SAMPLE_STEPS / 2;
  const startIsFront = startPos.z <= centroidZ;
  const frontGroundIndex = startIsFront ? 0 : ARC_SAMPLE_STEPS;
  const backGroundIndex = startIsFront ? ARC_SAMPLE_STEPS : 0;

  return {
    front: inclusiveRange(peakIndex, frontGroundIndex).map((i) => arcSamplePointId(segment.id, i)),
    back: inclusiveRange(peakIndex, backGroundIndex).map((i) => arcSamplePointId(segment.id, i)),
  };
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
 * apex/hub joint (sorted by x); a hoop's peak contributes the sampled
 * points along its actual curve (see hoopArcHalves) instead of a single
 * vertex, so the fly follows the hoop's full bend down to the ground on
 * both sides rather than cutting a straight chord to it. The two gables
 * connect the outermost attached joint to the nearest base points (using
 * just the peak, not the curve, since gables are end caps). This should
 * run after any mutation that could add/remove/reorder attachment points
 * or move the base anchors, which is why it's called from tentStore's
 * shared `withHistory` wrapper rather than from each action.
 */
export function regenerateRoofPanels(design: TentDesign): TentDesign {
  const nonRoofPanels = stripFlyPanels(design.fabricPanels);

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

  const jointPositions = new Map(design.poleJoints.map((j) => [j.id, j.position]));
  const flyJointsDescendingX = [...flyJoints].sort((a, b) => b.position.x - a.position.x);

  function ridgeIds(side: "front" | "back"): string[] {
    const ids: string[] = [];
    for (const joint of flyJointsDescendingX) {
      const halves = hoopArcHalves(joint, design.poleSegments, jointPositions, centroidZ);
      ids.push(...(halves ? halves[side] : [joint.id]));
    }
    return ids;
  }

  const roofPanels: FabricPanel[] = [
    {
      id: "roof-front-slope",
      name: "Front Roof Slope",
      boundaryPointIds: [...frontLine.map((a) => a.id), ...ridgeIds("front")],
    },
    {
      id: "roof-back-slope",
      name: "Back Roof Slope",
      boundaryPointIds: [...backLine.map((a) => a.id), ...ridgeIds("back")],
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
