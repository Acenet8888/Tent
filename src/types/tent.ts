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

  poles: Pole[];
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

export type PoleType = "trekking-pole" | "straight-pole" | "support-pole";

export type Pole = {
  id: string;
  name: string;

  groundPosition: Vector3;
  topPosition: Vector3;

  length: number;
  diameter?: number;

  type: PoleType;

  lockedLength: boolean;
};

export type AnchorType = "corner" | "stake" | "tie-out" | "pole-tip" | "ridge-end";

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
 * Any point in the design that geometry can reference by id: an anchor,
 * a pole's ground contact, or a pole's tip. Panels/ridgelines/seams store
 * ids so moving the underlying pole/anchor keeps every dependent shape in sync.
 */
export type ResolvablePointId = string;
