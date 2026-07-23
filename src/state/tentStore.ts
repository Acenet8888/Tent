import { create } from "zustand";
import type { AnchorPoint, AnchorType, LengthUnit, Pole, TentDesign, Vector3 } from "../types/tent";
import {
  createDefaultTentDesign,
  createId,
  generateDefaultTentDesign,
  rescaleTentDesign,
  type TentDimensionsInput,
} from "../geometry/generateTentGeometry";
import { reconcilePole, reconcilePoleForGroundMove } from "../geometry/measurements";
import { useHistoryStore } from "./historyStore";

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

  updatePoleGroundPosition: (poleId: string, positionMm: Vector3, opts?: { skipHistory?: boolean }) => void;
  updatePoleTipPosition: (poleId: string, positionMm: Vector3, opts?: { skipHistory?: boolean }) => void;
  toggleLockedLength: (poleId: string) => void;
  setPoleLength: (poleId: string, lengthMm: number) => void;
  addPole: (groundPosition: Vector3, topPosition: Vector3) => void;
  removePole: (poleId: string) => void;

  addAnchor: (type: AnchorType, position: Vector3, name?: string) => void;
  moveAnchor: (anchorId: string, position: Vector3, opts?: { skipHistory?: boolean }) => void;
  removeAnchor: (anchorId: string) => void;

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
  return mutate(current);
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

  updatePoleGroundPosition: (poleId, positionMm, opts) => {
    const design = withHistory(
      get,
      (current) => ({
        ...current,
        poles: current.poles.map((pole) =>
          pole.id === poleId ? reconcilePoleForGroundMove(pole, positionMm) : pole
        ),
      }),
      opts?.skipHistory
    );
    set({ design });
  },

  updatePoleTipPosition: (poleId, positionMm, opts) => {
    const design = withHistory(
      get,
      (current) => ({
        ...current,
        poles: current.poles.map((pole) =>
          pole.id === poleId ? reconcilePole(pole, positionMm) : pole
        ),
      }),
      opts?.skipHistory
    );
    set({ design });
  },

  toggleLockedLength: (poleId) => {
    const design = withHistory(get, (current) => ({
      ...current,
      poles: current.poles.map((pole) =>
        pole.id === poleId ? { ...pole, lockedLength: !pole.lockedLength } : pole
      ),
    }));
    set({ design });
  },

  setPoleLength: (poleId, lengthMm) => {
    const design = withHistory(get, (current) => ({
      ...current,
      poles: current.poles.map((pole) => {
        if (pole.id !== poleId) return pole;
        const locked = { ...pole, length: lengthMm, lockedLength: true };
        return reconcilePole(locked, pole.topPosition);
      }),
    }));
    set({ design });
  },

  addPole: (groundPosition, topPosition) => {
    const design = withHistory(get, (current) => {
      const newPole: Pole = {
        id: createId("pole"),
        name: `Pole ${current.poles.length + 1}`,
        groundPosition,
        topPosition,
        length: Math.hypot(
          topPosition.x - groundPosition.x,
          topPosition.y - groundPosition.y,
          topPosition.z - groundPosition.z
        ),
        type: "support-pole",
        lockedLength: false,
      };
      return { ...current, poles: [...current.poles, newPole] };
    });
    set({ design });
  },

  removePole: (poleId) => {
    const design = withHistory(get, (current) => ({
      ...current,
      poles: current.poles.filter((p) => p.id !== poleId),
      ridgelines: current.ridgelines.filter(
        (r) => r.startPointId !== poleId && r.endPointId !== poleId
      ),
    }));
    set({ design });
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
      (current) => ({
        ...current,
        anchors: current.anchors.map((a) => (a.id === anchorId ? { ...a, position } : a)),
      }),
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
