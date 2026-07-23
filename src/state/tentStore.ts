import { create } from "zustand";
import type {
  AnchorPoint,
  AnchorType,
  LengthUnit,
  PoleJoint,
  PoleJointType,
  PoleSegmentKind,
  TentDesign,
  Vector3,
} from "../types/tent";
import {
  createDefaultTentDesign,
  createHoopPoleTemplate,
  createHubPoleSetTemplate,
  createId,
  createSpreaderPoleTemplate,
  createStraightPoleTemplate,
  generateDefaultTentDesign,
  rescaleTentDesign,
  type TentDimensionsInput,
} from "../geometry/generateTentGeometry";
import { reconcileJointMove, subtract, scale, add, calculateDistance } from "../geometry/measurements";
import { regenerateRoofPanels } from "../geometry/regenerateFlyFabric";
import { useHistoryStore } from "./historyStore";

type Dimensions = TentDesign["dimensions"];

/** Keeps the Length/Width/Ground clearance fields live-accurate to the actual floor corners, so dragging a corner in the 2D view updates the dimension inputs immediately instead of leaving them stale. */
function syncDimensionsFromCorners(anchors: AnchorPoint[], dimensions: Dimensions): Dimensions {
  const corners = anchors.filter((a) => a.type === "corner");
  if (corners.length === 0) return dimensions;
  const xs = corners.map((c) => c.position.x);
  const zs = corners.map((c) => c.position.z);
  const ys = corners.map((c) => c.position.y);
  return {
    ...dimensions,
    length: Math.max(...xs) - Math.min(...xs),
    width: Math.max(...zs) - Math.min(...zs),
    groundClearance: ys.reduce((sum, y) => sum + y, 0) / ys.length,
  };
}

/** Same idea for the eave (wall-top) line: keeps Wall height in sync as those points are dragged. */
function syncWallHeightFromEaves(anchors: AnchorPoint[], dimensions: Dimensions): Dimensions {
  const eaves = anchors.filter((a) => a.type === "eave");
  if (eaves.length === 0) return dimensions;
  const avgY = eaves.reduce((sum, a) => sum + a.position.y, 0) / eaves.length;
  return { ...dimensions, wallHeight: avgY };
}

/** Same idea for Peak height: keeps it in sync with the tallest apex joint as poles are dragged. */
function syncPeakHeightFromApexJoints(joints: PoleJoint[], dimensions: Dimensions): Dimensions {
  const apexes = joints.filter((j) => j.type === "apex");
  if (apexes.length === 0) return dimensions;
  return { ...dimensions, peakHeight: Math.max(...apexes.map((j) => j.position.y)) };
}

type TentState = {
  design: TentDesign;

  /** Replaces the whole design (used by undo/redo) without touching history. */
  loadDesign: (design: TentDesign) => void;

  /** Regenerates a brand-new default tent, replacing everything and clearing history. */
  resetToDefault: (input: TentDimensionsInput) => void;

  /** Updates one or more dimension fields, proportionally rescaling existing geometry. */
  setDimensions: (
    partial: Partial<Omit<TentDesign["dimensions"], "unit">>,
    unit: LengthUnit
  ) => void;

  /** Changes only the unit used for display/input; stored millimetre values are unchanged. */
  setDisplayUnit: (unit: LengthUnit) => void;

  /**
   * Snapshots the current design onto the undo stack. Call this once when a
   * drag gesture starts; follow with `skipHistory: true` on every move
   * update during that same gesture, so the whole drag undoes in one step
   * instead of one step per pointermove tick.
   */
  beginInteraction: () => void;

  addAnchor: (type: AnchorType, position: Vector3, name?: string) => void;
  moveAnchor: (anchorId: string, position: Vector3, opts?: { skipHistory?: boolean }) => void;
  removeAnchor: (anchorId: string) => void;

  /** Tie-outs are two-ended: a fabric attachment (moved via moveAnchor) and a separate ground stake point. */
  addTieOut: (fabricPosition: Vector3, groundPosition: Vector3, name?: string) => void;
  moveTieOutGround: (anchorId: string, position: Vector3, opts?: { skipHistory?: boolean }) => void;
  /** Explicitly overrides whether the fly pegs out to this anchor (see geometry/regenerateFlyFabric.ts). */
  setAnchorFlyAttachment: (anchorId: string, value: boolean) => void;

  addJoint: (type: PoleJointType, position: Vector3, name?: string) => void;
  moveJoint: (jointId: string, position: Vector3, opts?: { skipHistory?: boolean }) => void;
  removeJoint: (jointId: string) => void;
  /** Welds `removeJointId` into `keepJointId`: every segment/ridgeline/panel referencing it is rewired, then it's deleted. */
  mergeJoints: (keepJointId: string, removeJointId: string) => void;
  /** Explicitly overrides whether the fly drapes over this joint (see geometry/regenerateFlyFabric.ts). */
  setJointFlyAttachment: (jointId: string, value: boolean) => void;

  addSegment: (startJointId: string, endJointId: string, kind: PoleSegmentKind) => void;
  removeSegment: (segmentId: string) => void;
  toggleSegmentLockedLength: (segmentId: string) => void;
  setSegmentLength: (segmentId: string, lengthMm: number) => void;

  addStraightPoleTemplate: (groundPosition: Vector3, apexPosition: Vector3, kind?: PoleSegmentKind) => void;
  addSpreaderPoleTemplate: (hubAPosition: Vector3, hubBPosition: Vector3) => void;
  addHoopPoleTemplate: (groundA: Vector3, apex: Vector3, groundB: Vector3) => void;
  addHubPoleSetTemplate: (
    hubA: Vector3,
    hubB: Vector3,
    legGroundPositions: [Vector3, Vector3, Vector3, Vector3]
  ) => void;

  setDisplayOption: (partial: Partial<TentDesign["display"]>) => void;

  undo: () => void;
  redo: () => void;
};

function withHistory(
  get: () => TentState,
  mutate: (design: TentDesign) => TentDesign,
  skipHistory = false
) {
  const current = get().design;
  if (!skipHistory) useHistoryStore.getState().record(current);
  // Every mutation re-drapes the fly over whatever apex joints currently
  // exist, so the roof never goes stale relative to a pole you just added,
  // moved, or removed.
  return regenerateRoofPanels(mutate(current));
}

export const useTentStore = create<TentState>((set, get) => ({
  design: createDefaultTentDesign(),

  loadDesign: (design) => set({ design }),

  resetToDefault: (input) => {
    useHistoryStore.getState().clear();
    set({ design: generateDefaultTentDesign(input) });
  },

  setDimensions: (partial, unit) => {
    const design = withHistory(get, (current) => rescaleTentDesign(current, partial, unit));
    set({ design });
  },

  setDisplayUnit: (unit) => {
    set((state) => ({
      design: { ...state.design, dimensions: { ...state.design.dimensions, unit } },
    }));
  },

  beginInteraction: () => {
    useHistoryStore.getState().record(get().design);
  },

  addAnchor: (type, position, name) => {
    const design = withHistory(get, (current) => {
      const newAnchor: AnchorPoint = {
        id: createId("anchor"),
        name: name ?? `${type} ${current.anchors.filter((a) => a.type === type).length + 1}`,
        type,
        position,
        locked: false,
      };
      return { ...current, anchors: [...current.anchors, newAnchor] };
    });
    set({ design });
  },

  moveAnchor: (anchorId, position, opts) => {
    const design = withHistory(
      get,
      (current) => {
        const anchors = current.anchors.map((a) => (a.id === anchorId ? { ...a, position } : a));
        const moved = anchors.find((a) => a.id === anchorId);
        let dimensions = current.dimensions;
        if (moved?.type === "corner") dimensions = syncDimensionsFromCorners(anchors, dimensions);
        else if (moved?.type === "eave") dimensions = syncWallHeightFromEaves(anchors, dimensions);
        return { ...current, anchors, dimensions };
      },
      opts?.skipHistory
    );
    set({ design });
  },

  removeAnchor: (anchorId) => {
    const design = withHistory(get, (current) => ({
      ...current,
      anchors: current.anchors.filter((a) => a.id !== anchorId),
      fabricPanels: current.fabricPanels.filter(
        (panel) => !panel.boundaryPointIds.includes(anchorId)
      ),
    }));
    set({ design });
  },

  addTieOut: (fabricPosition, groundPosition, name) => {
    const design = withHistory(get, (current) => {
      const newAnchor: AnchorPoint = {
        id: createId("anchor"),
        name: name ?? `Tie-out ${current.anchors.filter((a) => a.type === "tie-out").length + 1}`,
        type: "tie-out",
        position: fabricPosition,
        groundPosition,
        locked: false,
      };
      return { ...current, anchors: [...current.anchors, newAnchor] };
    });
    set({ design });
  },

  moveTieOutGround: (anchorId, position, opts) => {
    const design = withHistory(
      get,
      (current) => ({
        ...current,
        anchors: current.anchors.map((a) => (a.id === anchorId ? { ...a, groundPosition: position } : a)),
      }),
      opts?.skipHistory
    );
    set({ design });
  },

  setAnchorFlyAttachment: (anchorId, value) => {
    const design = withHistory(get, (current) => ({
      ...current,
      anchors: current.anchors.map((a) => (a.id === anchorId ? { ...a, flyAttachment: value } : a)),
    }));
    set({ design });
  },

  addJoint: (type, position, name) => {
    const design = withHistory(get, (current) => {
      const newJoint: PoleJoint = {
        id: createId("joint"),
        name: name ?? `${type} ${current.poleJoints.filter((j) => j.type === type).length + 1}`,
        type,
        position,
      };
      return { ...current, poleJoints: [...current.poleJoints, newJoint] };
    });
    set({ design });
  },

  moveJoint: (jointId, position, opts) => {
    const design = withHistory(
      get,
      (current) => {
        const { joints, segments } = reconcileJointMove(current.poleJoints, current.poleSegments, jointId, position);
        const moved = joints.find((j) => j.id === jointId);
        const dimensions =
          moved?.type === "apex" ? syncPeakHeightFromApexJoints(joints, current.dimensions) : current.dimensions;
        return { ...current, poleJoints: joints, poleSegments: segments, dimensions };
      },
      opts?.skipHistory
    );
    set({ design });
  },

  removeJoint: (jointId) => {
    const design = withHistory(get, (current) => ({
      ...current,
      poleJoints: current.poleJoints.filter((j) => j.id !== jointId),
      poleSegments: current.poleSegments.filter(
        (s) => s.startJointId !== jointId && s.endJointId !== jointId && s.archJointId !== jointId
      ),
      ridgelines: current.ridgelines.filter(
        (r) => r.startPointId !== jointId && r.endPointId !== jointId
      ),
      fabricPanels: current.fabricPanels.filter((panel) => !panel.boundaryPointIds.includes(jointId)),
    }));
    set({ design });
  },

  mergeJoints: (keepJointId, removeJointId) => {
    const design = withHistory(get, (current) => {
      if (keepJointId === removeJointId) return current;
      const remap = (id: string) => (id === removeJointId ? keepJointId : id);
      return {
        ...current,
        poleJoints: current.poleJoints.filter((j) => j.id !== removeJointId),
        poleSegments: current.poleSegments.map((s) => ({
          ...s,
          startJointId: remap(s.startJointId),
          endJointId: remap(s.endJointId),
          archJointId: s.archJointId ? remap(s.archJointId) : s.archJointId,
        })),
        ridgelines: current.ridgelines.map((r) => ({
          ...r,
          startPointId: remap(r.startPointId),
          endPointId: remap(r.endPointId),
        })),
        fabricPanels: current.fabricPanels.map((p) => ({
          ...p,
          boundaryPointIds: p.boundaryPointIds.map(remap),
        })),
      };
    });
    set({ design });
  },

  setJointFlyAttachment: (jointId, value) => {
    const design = withHistory(get, (current) => ({
      ...current,
      poleJoints: current.poleJoints.map((j) => (j.id === jointId ? { ...j, flyAttachment: value } : j)),
    }));
    set({ design });
  },

  addSegment: (startJointId, endJointId, kind) => {
    const design = withHistory(get, (current) => {
      const lookup = new Map(current.poleJoints.map((j) => [j.id, j.position]));
      const start = lookup.get(startJointId);
      const end = lookup.get(endJointId);
      const length = start && end ? calculateDistance(start, end) : 0;
      const newSegment = {
        id: createId("segment"),
        name: `${kind} ${current.poleSegments.length + 1}`,
        kind,
        shape: "straight" as const,
        startJointId,
        endJointId,
        length,
        lockedLength: false,
      };
      return { ...current, poleSegments: [...current.poleSegments, newSegment] };
    });
    set({ design });
  },

  removeSegment: (segmentId) => {
    const design = withHistory(get, (current) => ({
      ...current,
      poleSegments: current.poleSegments.filter((s) => s.id !== segmentId),
    }));
    set({ design });
  },

  toggleSegmentLockedLength: (segmentId) => {
    const design = withHistory(get, (current) => ({
      ...current,
      poleSegments: current.poleSegments.map((s) =>
        s.id === segmentId ? { ...s, lockedLength: !s.lockedLength } : s
      ),
    }));
    set({ design });
  },

  setSegmentLength: (segmentId, lengthMm) => {
    const design = withHistory(get, (current) => {
      const jointMap = new Map(current.poleJoints.map((j) => [j.id, { ...j }]));
      const poleSegments = current.poleSegments.map((segment) => {
        if (segment.id !== segmentId || segment.shape !== "straight") return segment;
        const start = jointMap.get(segment.startJointId);
        const end = jointMap.get(segment.endJointId);
        if (start && end) {
          const distance = calculateDistance(start.position, end.position);
          if (distance > 1e-9) {
            const direction = subtract(end.position, start.position);
            jointMap.set(end.id, { ...end, position: add(start.position, scale(direction, lengthMm / distance)) });
          }
        }
        return { ...segment, length: lengthMm, lockedLength: true };
      });
      return { ...current, poleJoints: Array.from(jointMap.values()), poleSegments };
    });
    set({ design });
  },

  addStraightPoleTemplate: (groundPosition, apexPosition, kind = "straight-pole") => {
    const design = withHistory(get, (current) => {
      const { joints, segments } = createStraightPoleTemplate(groundPosition, apexPosition, kind);
      return {
        ...current,
        poleJoints: [...current.poleJoints, ...joints],
        poleSegments: [...current.poleSegments, ...segments],
      };
    });
    set({ design });
  },

  addSpreaderPoleTemplate: (hubAPosition, hubBPosition) => {
    const design = withHistory(get, (current) => {
      const { joints, segments } = createSpreaderPoleTemplate(hubAPosition, hubBPosition);
      return {
        ...current,
        poleJoints: [...current.poleJoints, ...joints],
        poleSegments: [...current.poleSegments, ...segments],
      };
    });
    set({ design });
  },

  addHoopPoleTemplate: (groundA, apex, groundB) => {
    const design = withHistory(get, (current) => {
      const { joints, segments } = createHoopPoleTemplate(groundA, apex, groundB);
      return {
        ...current,
        poleJoints: [...current.poleJoints, ...joints],
        poleSegments: [...current.poleSegments, ...segments],
      };
    });
    set({ design });
  },

  addHubPoleSetTemplate: (hubA, hubB, legGroundPositions) => {
    const design = withHistory(get, (current) => {
      const { joints, segments } = createHubPoleSetTemplate(hubA, hubB, legGroundPositions);
      return {
        ...current,
        poleJoints: [...current.poleJoints, ...joints],
        poleSegments: [...current.poleSegments, ...segments],
      };
    });
    set({ design });
  },

  setDisplayOption: (partial) => {
    set((state) => ({
      design: { ...state.design, display: { ...state.design.display, ...partial } },
    }));
  },

  undo: () => {
    const current = get().design;
    const previous = useHistoryStore.getState().undo(current);
    if (previous) set({ design: previous });
  },

  redo: () => {
    const current = get().design;
    const next = useHistoryStore.getState().redo(current);
    if (next) set({ design: next });
  },
}));
