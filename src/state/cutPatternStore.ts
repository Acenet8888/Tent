import { create } from "zustand";

type CutPatternState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

export const useCutPatternStore = create<CutPatternState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
