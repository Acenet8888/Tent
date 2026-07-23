import { useMemo } from "react";
import * as THREE from "three";
import type { Ridgeline, Vector3 } from "../../types/tent";
import { toSceneVec3 } from "./sceneUnits";

type RidgelineMeshProps = {
  ridgeline: Ridgeline;
  start: Vector3;
  end: Vector3;
};

export function RidgelineMesh({ start, end }: RidgelineMeshProps) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...toSceneVec3(start)),
      new THREE.Vector3(...toSceneVec3(end)),
    ]);
    const material = new THREE.LineBasicMaterial({ color: "#222831" });
    return new THREE.Line(geometry, material);
  }, [start, end]);

  return <primitive object={line} />;
}
