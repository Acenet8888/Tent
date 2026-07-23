import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useCameraStore, type CameraPreset } from "../../state/cameraStore";
import { useTentStore } from "../../state/tentStore";
import { mmToScene } from "./sceneUnits";

function presetPosition(preset: CameraPreset, halfLength: number, halfWidth: number, height: number) {
  const distance = Math.max(halfLength, halfWidth, height) * 2.5 + 2;
  switch (preset) {
    case "front":
      return { x: 0, y: height / 2, z: distance };
    case "side":
      return { x: distance, y: height / 2, z: 0 };
    case "top":
      return { x: 0, y: distance * 1.4, z: 0.001 };
    case "iso":
    default:
      return { x: distance * 0.8, y: distance * 0.65, z: distance * 0.8 };
  }
}

/**
 * Orbit/pan/zoom controls plus camera presets (front/side/top/iso),
 * triggered from panels/ViewControls.tsx via the shared cameraStore so the
 * 3D view and its control panel don't need to know about each other directly.
 */
export function CameraControls() {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const requestId = useCameraStore((s) => s.requestId);
  const preset = useCameraStore((s) => s.preset);
  const dimensions = useTentStore((s) => s.design.dimensions);

  useEffect(() => {
    const halfLength = mmToScene(dimensions.length) / 2;
    const halfWidth = mmToScene(dimensions.width) / 2;
    const height = mmToScene(dimensions.peakHeight);
    const pos = presetPosition(preset, halfLength, halfWidth, height);

    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(0, height / 3, 0);
    controlsRef.current?.target.set(0, height / 3, 0);
    controlsRef.current?.update();
    // Only re-run when a new preset is explicitly requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.1} />;
}
