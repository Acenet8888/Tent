export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type LengthUnit = "mm" | "cm" | "m" | "in" | "ft";

export type TentDesign = {
  id: string;

  dimensions: {
    length: number;
    width: number;
    peakHeight: number;
    wallHeight?: number;
    groundClearance: number;
    unit: LengthUnit;
  };

  poleJoints: PoleJoint[];
  poleSegments: PoleSegment[];
  anchors: AnchorPoint[];
  ridgelines: Ridgeline[];
  seams: Seam[];
  fabricPanels: FabricPanel[];

  display: {
    showDimensions: boolean;
    showGrid: boolean;
    showPoles: boolean;
    showWireframe: boolean;
    transparentFabric: boolean;
  };
};

/**
 * A pole system is a graph: joints are the connection points (where a pole
 * meets the ground, where two or more pole pieces meet at a hub, or the
 * free-floating peak a hoop pole bows through), and PoleSegments are the
 * physical pole material joining two joints. This lets a "pole" be a plain
 * ground-to-tip strut, a spreader between two other points, or an
 * arbitrarily branching hub tree, all with the same two primitives.
 */
export type PoleJointType =
  | "ground" // touches the ground; conceptually like an anchor but owned by the pole system
  | "hub" // a junction where two or more segments meet, floating above the ground
  | "apex"; // a high point: a ridge/tip end, or the peak a hoop's arc bows through

export type PoleJoint = {
  id: string;
  name: string;
  type: PoleJointType;
  position: Vector3;
};

export type PoleSegmentShape = "straight" | "arc";

export type PoleSegmentKind =
  | "trekking-pole"
  | "straight-pole"
  | "support-pole"
  | "hoop-pole"
  | "spreader-pole";

export type PoleSegment = {
  id: string;
  name: string;
  kind: PoleSegmentKind;
  shape: PoleSegmentShape;

  startJointId: string;
  endJointId: string;
  /**
   * Required when shape is "arc": the id of the (usually "apex") joint the
   * curve bows through, so the segment reads as ground → peak → ground
   * rather than two straight pieces meeting at a sharp angle.
   */
  archJointId?: string;

  length: number;
  diameter?: number;

  /**
   * Only meaningful for "straight" segments: dragging one joint keeps the
   * other exactly `length` away (see geometry/measurements.ts:reconcileJointMove).
   * Arc segments always recompute their length live instead of enforcing
   * it, since preserving arc length while repositioning an endpoint or the
   * peak is an inverse elastica problem outside this MVP's scope.
   */
  lockedLength: boolean;
};

export type AnchorType = "corner" | "stake" | "tie-out" | "eave";

export type AnchorPoint = {
  id: string;
  name: string;
  position: Vector3;

  type: AnchorType;

  locked: boolean;
};

export type Ridgeline = {
  id: string;
  startPointId: string;
  endPointId: string;
};

export type Seam = {
  id: string;
  pointIds: string[];
  seamAllowance?: number;
};

export type FabricPanel = {
  id: string;
  name: string;
  boundaryPointIds: string[];
  materialId?: string;
};

/**
 * Any point in the design that geometry can reference by id: an anchor or
 * a pole joint. Panels/ridgelines/seams store ids so moving the underlying
 * anchor/joint keeps every dependent shape in sync.
 */
export type ResolvablePointId = string;
