import { create } from "zustand";

export type SelectionKind = "anchor" | "pole-ground" | "pole-tip";

export type Selection = {
  kind: SelectionKind;
  id: string;
} | null;

type SelectionState = {
  selection: Selection;
  select: (kind: SelectionKind, id: string) => void;
  clear: () => void;
};

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: null,
  select: (kind, id) => set({ selection: { kind, id } }),
  clear: () => set({ selection: null }),
}));
