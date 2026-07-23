import { create } from "zustand";
import type { TentDesign } from "../types/tent";

const MAX_HISTORY = 50;

type HistoryState = {
  past: TentDesign[];
  future: TentDesign[];
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Records `current` as the state to return to if the next change is undone. */
  record: (current: TentDesign) => void;
  /** Pops the last recorded state, pushes `current` onto the redo stack, returns what to restore (or undefined if nothing to undo). */
  undo: (current: TentDesign) => TentDesign | undefined;
  /** Pops the last undone state, pushes `current` back onto the undo stack, returns what to restore (or undefined if nothing to redo). */
  redo: (current: TentDesign) => TentDesign | undefined;
  clear: () => void;
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  record: (current) => {
    set((state) => ({
      past: [...state.past, current].slice(-MAX_HISTORY),
      future: [],
    }));
  },

  undo: (current) => {
    const { past } = get();
    if (past.length === 0) return undefined;
    const previous = past[past.length - 1];
    set((state) => ({
      past: state.past.slice(0, -1),
      future: [current, ...state.future],
    }));
    return previous;
  },

  redo: (current) => {
    const { future } = get();
    if (future.length === 0) return undefined;
    const next = future[0];
    set((state) => ({
      past: [...state.past, current],
      future: state.future.slice(1),
    }));
    return next;
  },

  clear: () => set({ past: [], future: [] }),
}));
