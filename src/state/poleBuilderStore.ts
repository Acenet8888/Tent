import { create } from "zustand";

/**
 * Tracks the "connect two existing joints" flow: pick a joint as the
 * connection start, then pick a second (different) joint to link it to
 * with a new PoleSegment. This is how a spreader pole (or any custom
 * strut) gets attached to two points that already exist, as opposed to
 * the one-click templates which create their own fresh joints.
 */
type PoleBuilderState = {
  pendingJointId: string | null;
  startConnection: (jointId: string) => void;
  cancelConnection: () => void;
};

export const usePoleBuilderStore = create<PoleBuilderState>((set) => ({
  pendingJointId: null,
  startConnection: (jointId) => set({ pendingJointId: jointId }),
  cancelConnection: () => set({ pendingJointId: null }),
}));
