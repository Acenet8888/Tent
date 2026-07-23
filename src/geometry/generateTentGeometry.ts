import type { AnchorPoint, LengthUnit, Pole, Ridgeline, TentDesign } from "../types/tent";
import { calculateDistance } from "./measurements";
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

/**
 * Builds a default rectangular A-frame/ridge tent: four floor corners, a
 * single adjustable ridgeline, and one pole at each ridge end. All inputs
 * are converted to millimetres immediately so every downstream value is
 * unit-independent (see units/conversions.ts).
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

  const poleLeft: Pole = {
    id: createId("pole"),
    name: "Left Ridge Pole",
    groundPosition: { x: -halfLength, y: 0, z: 0 },
    topPosition: { x: -halfLength, y: peakHeightMm, z: 0 },
    length: calculateDistance(
      { x: -halfLength, y: 0, z: 0 },
      { x: -halfLength, y: peakHeightMm, z: 0 }
    ),
    type: "straight-pole",
    lockedLength: false,
  };
  const poleRight: Pole = {
    id: createId("pole"),
    name: "Right Ridge Pole",
    groundPosition: { x: halfLength, y: 0, z: 0 },
    topPosition: { x: halfLength, y: peakHeightMm, z: 0 },
    length: calculateDistance(
      { x: halfLength, y: 0, z: 0 },
      { x: halfLength, y: peakHeightMm, z: 0 }
    ),
    type: "straight-pole",
    lockedLength: false,
  };

  // Ridge endpoints and panel corners at the ridge are the poles' tips
  // (referenced via the `${poleId}:tip` convention from
  // generateFabricPanels.buildPointLookup) rather than duplicate anchors,
  // so dragging a pole tip can never desynchronize the ridgeline or roof
  // panels from the pole itself.
  const ridgeStartId = `${poleLeft.id}:tip`;
  const ridgeEndId = `${poleRight.id}:tip`;

  const anchors = [cornerA, cornerB, cornerC, cornerD];
  const poles = [poleLeft, poleRight];

  const ridgelines: Ridgeline[] = [
    {
      id: createId("ridgeline"),
      startPointId: ridgeStartId,
      endPointId: ridgeEndId,
    },
  ];

  let panelSpecs: PanelSpec[];

  if (wallHeightMm && wallHeightMm > 0) {
    const wallTopA = { id: createId("anchor"), name: "Wall Top (Front-Left)", type: "corner" as const, locked: false, position: { x: -halfLength, y: wallHeightMm, z: -halfWidth } };
    const wallTopB = { id: createId("anchor"), name: "Wall Top (Front-Right)", type: "corner" as const, locked: false, position: { x: halfLength, y: wallHeightMm, z: -halfWidth } };
    const wallTopC = { id: createId("anchor"), name: "Wall Top (Back-Right)", type: "corner" as const, locked: false, position: { x: halfLength, y: wallHeightMm, z: halfWidth } };
    const wallTopD = { id: createId("anchor"), name: "Wall Top (Back-Left)", type: "corner" as const, locked: false, position: { x: -halfLength, y: wallHeightMm, z: halfWidth } };
    anchors.push(wallTopA, wallTopB, wallTopC, wallTopD);

    panelSpecs = [
      { name: "Floor", boundaryPointIds: [cornerA.id, cornerB.id, cornerC.id, cornerD.id] },
      { name: "Front Wall", boundaryPointIds: [cornerA.id, cornerB.id, wallTopB.id, wallTopA.id] },
      { name: "Right End Wall", boundaryPointIds: [cornerB.id, cornerC.id, wallTopC.id, wallTopB.id] },
      { name: "Back Wall", boundaryPointIds: [cornerC.id, cornerD.id, wallTopD.id, wallTopC.id] },
      { name: "Left End Wall", boundaryPointIds: [cornerD.id, cornerA.id, wallTopA.id, wallTopD.id] },
      { name: "Front Roof Slope", boundaryPointIds: [wallTopA.id, wallTopB.id, ridgeEndId, ridgeStartId] },
      { name: "Back Roof Slope", boundaryPointIds: [wallTopD.id, wallTopC.id, ridgeEndId, ridgeStartId] },
      { name: "Left Gable", boundaryPointIds: [wallTopA.id, wallTopD.id, ridgeStartId] },
      { name: "Right Gable", boundaryPointIds: [wallTopB.id, wallTopC.id, ridgeEndId] },
    ];
  } else {
    panelSpecs = [
      { name: "Floor", boundaryPointIds: [cornerA.id, cornerB.id, cornerC.id, cornerD.id] },
      { name: "Front Roof Slope", boundaryPointIds: [cornerA.id, cornerB.id, ridgeEndId, ridgeStartId] },
      { name: "Back Roof Slope", boundaryPointIds: [cornerD.id, cornerC.id, ridgeEndId, ridgeStartId] },
      { name: "Left Gable", boundaryPointIds: [cornerA.id, cornerD.id, ridgeStartId] },
      { name: "Right Gable", boundaryPointIds: [cornerB.id, cornerC.id, ridgeEndId] },
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
    poles,
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

  const rescalePoint = (p: { x: number; y: number; z: number }) => ({
    x: p.x * scaleX,
    y: p.y * scaleY,
    z: p.z * scaleZ,
  });

  const anchors = design.anchors.map((anchor) => ({
    ...anchor,
    position: rescalePoint(anchor.position),
  }));

  const poles = design.poles.map((pole) => {
    const groundPosition = rescalePoint(pole.groundPosition);
    const topPosition = rescalePoint(pole.topPosition);
    return {
      ...pole,
      groundPosition,
      topPosition,
      length: calculateDistance(groundPosition, topPosition),
    };
  });

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
    poles,
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
