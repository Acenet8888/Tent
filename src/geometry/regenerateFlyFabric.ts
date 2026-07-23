import type { FabricPanel, TentDesign } from "../types/tent";
import { deriveSeamsFromPanels } from "./generateFabricPanels";

/**
 * Stable ids for the four roof-related panels so regeneration can find and
 * replace exactly these entries (floor and wall panels are untouched here —
 * they're anchored to the fixed corner/eave anchors and don't depend on how
 * many poles exist).
 */
const ROOF_PANEL_IDS = ["roof-front-slope", "roof-back-slope", "roof-left-gable", "roof-right-gable"];

/**
 * Recomputes the fly (roof) panels so they always drape over whatever
 * apex-type pole joints currently exist, rather than staying fixed to
 * whichever two ridge ends the tent started with. Every apex joint (ridge
 * ends, a hoop's peak, an added straight pole's tip) is sorted by x and
 * swept into the roofline; the front/back slopes become a fan from the
 * front/back base line (the eave line if the tent has walls, otherwise the
 * floor corners) up across every apex point, and the two gables connect
 * the outermost apex to the nearest base corners. Hub joints are treated as
 * interior supports and never affect the roofline — only "apex" joints do.
 *
 * This should run after any mutation that could add/remove/reorder apex
 * joints or move the base anchors, which is why it's called from
 * tentStore's shared `withHistory` wrapper rather than from each action.
 */
export function regenerateRoofPanels(design: TentDesign): TentDesign {
  const nonRoofPanels = design.fabricPanels.filter((p) => !ROOF_PANEL_IDS.includes(p.id));

  const hasWalls = design.anchors.some((a) => a.type === "eave");
  const baseAnchors = design.anchors.filter((a) => (hasWalls ? a.type === "eave" : a.type === "corner"));
  const apexJoints = design.poleJoints
    .filter((j) => j.type === "apex")
    .slice()
    .sort((a, b) => a.position.x - b.position.x);

  if (baseAnchors.length === 0 || apexJoints.length === 0) {
    const fabricPanels = nonRoofPanels;
    return { ...design, fabricPanels, seams: deriveSeamsFromPanels(fabricPanels) };
  }

  const minZ = Math.min(...baseAnchors.map((a) => a.position.z));
  const maxZ = Math.max(...baseAnchors.map((a) => a.position.z));
  const frontLine = baseAnchors.filter((a) => a.position.z === minZ).sort((a, b) => a.position.x - b.position.x);
  const backLine = baseAnchors.filter((a) => a.position.z === maxZ).sort((a, b) => a.position.x - b.position.x);

  if (frontLine.length === 0 || backLine.length === 0 || minZ === maxZ) {
    const fabricPanels = nonRoofPanels;
    return { ...design, fabricPanels, seams: deriveSeamsFromPanels(fabricPanels) };
  }

  const apexIdsAsc = apexJoints.map((j) => j.id);
  const apexIdsDesc = [...apexIdsAsc].reverse();

  const roofPanels: FabricPanel[] = [
    {
      id: "roof-front-slope",
      name: "Front Roof Slope",
      boundaryPointIds: [...frontLine.map((a) => a.id), ...apexIdsDesc],
    },
    {
      id: "roof-back-slope",
      name: "Back Roof Slope",
      boundaryPointIds: [...backLine.map((a) => a.id), ...apexIdsAsc],
    },
    {
      id: "roof-left-gable",
      name: "Left Gable",
      boundaryPointIds: [frontLine[0].id, backLine[0].id, apexJoints[0].id],
    },
    {
      id: "roof-right-gable",
      name: "Right Gable",
      boundaryPointIds: [
        frontLine[frontLine.length - 1].id,
        backLine[backLine.length - 1].id,
        apexJoints[apexJoints.length - 1].id,
      ],
    },
  ];

  const fabricPanels = [...nonRoofPanels, ...roofPanels];
  return { ...design, fabricPanels, seams: deriveSeamsFromPanels(fabricPanels) };
}
