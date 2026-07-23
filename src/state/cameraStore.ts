import { create } from "zustand";

export type CameraPreset = "iso" | "front" | "side" | "top";

type CameraState = {
  /** Bumped on every preset request so CameraControls can react even if the same preset is chosen twice in a row. */
  requestId: number;
  preset: CameraPreset;
  requestPreset: (preset: CameraPreset) => void;
};

export const useCameraStore = create<CameraState>((set) => ({
  requestId: 0,
  preset: "iso",
  requestPreset: (preset) => set((state) => ({ preset, requestId: state.requestId + 1 })),
}));
