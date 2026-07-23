import type {
  AnchorPoint,
  LengthUnit,
  PoleJoint,
  PoleSegment,
  PoleSegmentKind,
  Ridgeline,
  TentDesign,
  Vector3,
} from "../types/tent";
import { calculateDistance, currentSegmentLength } from "./measurements";
import { generateFabricPanels, deriveSeamsFromPanels, type PanelSpec } from "./generateFabricPanels";
import { toMillimeters } from "../units/conversions";

export type TentDimensionsInput = {
  length: number;
  width: number;
  peakHeight: number;
  wallHeight?: number;
  groundClearance: number;
  unit: LengthUnit;
};

let idCounter = 0;
export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Date.now().toString(36)}`;
}

function makeJoint(name: string, type: PoleJoint["type"], position: Vector3): PoleJoint {
  return { id: createId("joint"), name, type, position };
}

function makeStraightSegment(
  name: string,
  kind: PoleSegmentKind,
  start: PoleJoint,
  end: PoleJoint
): PoleSegment {
  return {
    id: createId("segment"),
    name,
    kind,
    shape: "straight",
    startJointId: start.id,
    endJointId: end.id,
    length: calculateDistance(start.position, end.position),
    lockedLength: false,
  };
}

/**
 * Builds a default rectangular A-frame/ridge tent: four floor corners, a
 * single adjustable ridgeline, and one straight pole (ground joint → apex
 * joint) at each ridge end. All inputs are converted to millimetres
 * immediately so every downstream value is unit-independent (see
 * units/conversions.ts).
 */
export function generateDefaultTentDesign(input: TentDimensionsInput): TentDesign {
  const lengthMm = toMillimeters(input.length, input.unit);
  const widthMm = toMillimeters(input.width, input.unit);
  const peakHeightMm = toMillimeters(input.peakHeight, input.unit);
  const wallHeightMm =
    input.wallHeight !== undefined ? toMillimeters(input.wallHeight, input.unit) : undefined;
  const groundClearanceMm = toMillimeters(input.groundClearance, input.unit);

  const halfLength = lengthMm / 2;
  const halfWidth = widthMm / 2;

  const cornerA: AnchorPoint = {
    id: createId("anchor"),
    name: "Front-Left Corner",
    type: "corner",
    locked: false,
    position: { x: -halfLength, y: groundClearanceMm, z: -halfWidth },
  };
  const cornerB: AnchorPoint = {
    id: createId("anchor"),
    name: "Front-Right Corner",
    type: "corner",
    locked: false,
    position: { x: halfLength, y: groundClearanceMm, z: -halfWidth },
  };
  const cornerC: AnchorPoint = {
    id: createId("anchor"),
    name: "Back-Right Corner",
    type: "corner",
    locked: false,
    position: { x: halfLength, y: groundClearanceMm, z: halfWidth },
  };
  const cornerD: AnchorPoint = {
    id: createId("anchor"),
    name: "Back-Left Corner",
    type: "corner",
    locked: false,
    position: { x: -halfLength, y: groundClearanceMm, z: halfWidth },
  };

  const groundLeft = makeJoint("Left Pole Base", "ground", { x: -halfLength, y: 0, z: 0 });
  const apexLeft = makeJoint("Left Ridge End", "apex", { x: -halfLength, y: peakHeightMm, z: 0 });
  const groundRight = makeJoint("Right Pole Base", "ground", { x: halfLength, y: 0, z: 0 });
  const apexRight = makeJoint("Right Ridge End", "apex", { x: halfLength, y: peakHeightMm, z: 0 });

  const poleLeft = makeStraightSegment("Left Ridge Pole", "straight-pole", groundLeft, apexLeft);
  const poleRight = makeStraightSegment("Right Ridge Pole", "straight-pole", groundRight, apexRight);

  const anchors = [cornerA, cornerB, cornerC, cornerD];
  const poleJoints = [groundLeft, apexLeft, groundRight, apexRight];
  const poleSegments = [poleLeft, poleRight];

  const ridgelines: Ridgeline[] = [
    {
      id: createId("ridgeline"),
      startPointId: apexLeft.id,
      endPointId: apexRight.id,
    },
  ];

  let panelSpecs: PanelSpec[];

  if (wallHeightMm && wallHeightMm > 0) {
    const wallTopA: AnchorPoint = { id: createId("anchor"), name: "Eave (Front-Left)", type: "eave", locked: false, position: { x: -halfLength, y: wallHeightMm, z: -halfWidth } };
    const wallTopB: AnchorPoint = { id: createId("anchor"), name: "Eave (Front-Right)", type: "eave", locked: false, position: { x: halfLength, y: wallHeightMm, z: -halfWidth } };
    const wallTopC: AnchorPoint = { id: createId("anchor"), name: "Eave (Back-Right)", type: "eave", locked: false, position: { x: halfLength, y: wallHeightMm, z: halfWidth } };
    const wallTopD: AnchorPoint = { id: createId("anchor"), name: "Eave (Back-Left)", type: "eave", locked: false, position: { x: -halfLength, y: wallHeightMm, z: halfWidth } };
    anchors.push(wallTopA, wallTopB, wallTopC, wallTopD);

    panelSpecs = [
      { name: "Floor", boundaryPointIds: [cornerA.id, cornerB.id, cornerC.id, cornerD.id] },
      { name: "Front Wall", boundaryPointIds: [cornerA.id, cornerB.id, wallTopB.id, wallTopA.id] },
      { name: "Right End Wall", boundaryPointIds: [cornerB.id, cornerC.id, wallTopC.id, wallTopB.id] },
      { name: "Back Wall", boundaryPointIds: [cornerC.id, cornerD.id, wallTopD.id, wallTopC.id] },
      { name: "Left End Wall", boundaryPointIds: [cornerD.id, cornerA.id, wallTopA.id, wallTopD.id] },
      { name: "Front Roof Slope", boundaryPointIds: [wallTopA.id, wallTopB.id, apexRight.id, apexLeft.id] },
      { name: "Back Roof Slope", boundaryPointIds: [wallTopD.id, wallTopC.id, apexRight.id, apexLeft.id] },
      { name: "Left Gable", boundaryPointIds: [wallTopA.id, wallTopD.id, apexLeft.id] },
      { name: "Right Gable", boundaryPointIds: [wallTopB.id, wallTopC.id, apexRight.id] },
    ];
  } else {
    panelSpecs = [
      { name: "Floor", boundaryPointIds: [cornerA.id, cornerB.id, cornerC.id, cornerD.id] },
      { name: "Front Roof Slope", boundaryPointIds: [cornerA.id, cornerB.id, apexRight.id, apexLeft.id] },
      { name: "Back Roof Slope", boundaryPointIds: [cornerD.id, cornerC.id, apexRight.id, apexLeft.id] },
      { name: "Left Gable", boundaryPointIds: [cornerA.id, cornerD.id, apexLeft.id] },
      { name: "Right Gable", boundaryPointIds: [cornerB.id, cornerC.id, apexRight.id] },
    ];
  }

  const fabricPanels = generateFabricPanels(panelSpecs);
  const seams = deriveSeamsFromPanels(fabricPanels);

  return {
    id: createId("tent"),
    dimensions: {
      length: lengthMm,
      width: widthMm,
      peakHeight: peakHeightMm,
      wallHeight: wallHeightMm,
      groundClearance: groundClearanceMm,
      unit: input.unit,
    },
    poleJoints,
    poleSegments,
    anchors,
    ridgelines,
    seams,
    fabricPanels,
    display: {
      showDimensions: true,
      showGrid: true,
      showPoles: true,
      showWireframe: false,
      transparentFabric: false,
    },
  };
}

/**
 * Applies a dimension change to an existing design by scaling every point
 * along the relevant axis, rather than regenerating the tent from scratch.
 * This keeps custom poles/anchors/stakes the user has added (Milestone 4)
 * intact across a resize instead of discarding them.
 */
export function rescaleTentDesign(
  design: TentDesign,
  newDimensions: Partial<Omit<TentDesign["dimensions"], "unit">>,
  unit: LengthUnit
): TentDesign {
  const current = design.dimensions;
  const nextLengthMm =
    newDimensions.length !== undefined ? toMillimeters(newDimensions.length, unit) : current.length;
  const nextWidthMm =
    newDimensions.width !== undefined ? toMillimeters(newDimensions.width, unit) : current.width;
  const nextPeakHeightMm =
    newDimensions.peakHeight !== undefined
      ? toMillimeters(newDimensions.peakHeight, unit)
      : current.peakHeight;
  const nextWallHeightMm =
    newDimensions.wallHeight !== undefined
      ? toMillimeters(newDimensions.wallHeight, unit)
      : current.wallHeight;
  const nextGroundClearanceMm =
    newDimensions.groundClearance !== undefined
      ? toMillimeters(newDimensions.groundClearance, unit)
      : current.groundClearance;

  const scaleX = current.length > 0 ? nextLengthMm / current.length : 1;
  const scaleZ = current.width > 0 ? nextWidthMm / current.width : 1;
  const scaleY = current.peakHeight > 0 ? nextPeakHeightMm / current.peakHeight : 1;

  const rescalePoint = (p: Vector3): Vector3 => ({
    x: p.x * scaleX,
    y: p.y * scaleY,
    z: p.z * scaleZ,
  });

  const anchors = design.anchors.map((anchor) => ({
    ...anchor,
    position: rescalePoint(anchor.position),
  }));

  const poleJoints = design.poleJoints.map((joint) => ({
    ...joint,
    position: rescalePoint(joint.position),
  }));

  const jointLookup = new Map(poleJoints.map((j) => [j.id, j.position]));
  const poleSegments = design.poleSegments.map((segment) => ({
    ...segment,
    length: currentSegmentLength(segment, jointLookup) ?? segment.length,
  }));

  return {
    ...design,
    dimensions: {
      length: nextLengthMm,
      width: nextWidthMm,
      peakHeight: nextPeakHeightMm,
      wallHeight: nextWallHeightMm,
      groundClearance: nextGroundClearanceMm,
      unit,
    },
    anchors,
    poleJoints,
    poleSegments,
  };
}

export function createDefaultTentDesign(): TentDesign {
  return generateDefaultTentDesign({
    length: 2400,
    width: 1800,
    peakHeight: 1400,
    groundClearance: 0,
    unit: "mm",
  });
}

export type PoleTemplateResult = { joints: PoleJoint[]; segments: PoleSegment[] };

/** A single straight ground-to-tip pole (the common case: trekking pole, straight pole, support pole). */
export function createStraightPoleTemplate(
  groundPosition: Vector3,
  apexPosition: Vector3,
  kind: PoleSegmentKind = "straight-pole"
): PoleTemplateResult {
  const ground = makeJoint("Pole Base", "ground", groundPosition);
  const apex = makeJoint("Pole Tip", "apex", apexPosition);
  const segment = makeStraightSegment("Pole", kind, ground, apex);
  return { joints: [ground, apex], segments: [segment] };
}

/** A hoop pole: ground → arc through peak → ground, as one continuously-curved segment. */
export function createHoopPoleTemplate(
  groundA: Vector3,
  apexPosition: Vector3,
  groundB: Vector3
): PoleTemplateResult {
  const jointA = makeJoint("Hoop Base A", "ground", groundA);
  const apex = makeJoint("Hoop Peak", "apex", apexPosition);
  const jointB = makeJoint("Hoop Base B", "ground", groundB);

  const segment: PoleSegment = {
    id: createId("segment"),
    name: "Hoop Pole",
    kind: "hoop-pole",
    shape: "arc",
    startJointId: jointA.id,
    endJointId: jointB.id,
    archJointId: apex.id,
    length: currentSegmentLength(
      { startJointId: jointA.id, endJointId: jointB.id, archJointId: apex.id, shape: "arc" } as PoleSegment,
      new Map([
        [jointA.id, jointA.position],
        [jointB.id, jointB.position],
        [apex.id, apex.position],
      ])
    ) ?? calculateDistance(groundA, groundB),
    lockedLength: false,
  };

  return { joints: [jointA, apex, jointB], segments: [segment] };
}

/**
 * A hubbed pole set: two hubs joined by a spreader, each hub splitting into
 * two legs down to the ground — "one pole with a hub on each end reaching
 * the ground in four places."
 */
export function createHubPoleSetTemplate(
  hubAPosition: Vector3,
  hubBPosition: Vector3,
  legGroundPositions: [Vector3, Vector3, Vector3, Vector3]
): PoleTemplateResult {
  const hubA = makeJoint("Hub A", "hub", hubAPosition);
  const hubB = makeJoint("Hub B", "hub", hubBPosition);
  const legJoints = legGroundPositions.map((pos, i) => makeJoint(`Hub Leg ${i + 1}`, "ground", pos));

  const spreader = makeStraightSegment("Hub Spreader", "spreader-pole", hubA, hubB);
  const legs = [
    makeStraightSegment("Hub A Leg 1", "support-pole", hubA, legJoints[0]),
    makeStraightSegment("Hub A Leg 2", "support-pole", hubA, legJoints[1]),
    makeStraightSegment("Hub B Leg 1", "support-pole", hubB, legJoints[2]),
    makeStraightSegment("Hub B Leg 2", "support-pole", hubB, legJoints[3]),
  ];

  return {
    joints: [hubA, hubB, ...legJoints],
    segments: [spreader, ...legs],
  };
}
