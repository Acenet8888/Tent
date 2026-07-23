import { useMemo } from "react";
import * as THREE from "three";
import type { Pole } from "../../types/tent";
import { useSelectionStore } from "../../state/selectionStore";
import { toSceneVec3, mmToScene } from "./sceneUnits";

const DEFAULT_DIAMETER_MM = 9;

type PoleMeshProps = {
  pole: Pole;
};

export function PoleMesh({ pole }: PoleMeshProps) {
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);

  const groundVec = useMemo(() => new THREE.Vector3(...toSceneVec3(pole.groundPosition)), [pole.groundPosition]);
  const topVec = useMemo(() => new THREE.Vector3(...toSceneVec3(pole.topPosition)), [pole.topPosition]);

  const { midpoint, quaternion, length } = useMemo(() => {
    const dir = topVec.clone().sub(groundVec);
    const len = dir.length();
    const mid = groundVec.clone().add(topVec).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    return { midpoint: mid, quaternion: quat, length: len };
  }, [groundVec, topVec]);

  const radius = mmToScene(pole.diameter ?? DEFAULT_DIAMETER_MM) / 2;
  const isGroundSelected = selection?.kind === "pole-ground" && selection.id === pole.id;
  const isTipSelected = selection?.kind === "pole-tip" && selection.id === pole.id;

  return (
    <group>
      <mesh position={midpoint} quaternion={quaternion} castShadow>
        <cylinderGeometry args={[radius, radius, length, 12]} />
        <meshStandardMaterial color="#8a8f98" metalness={0.3} roughness={0.5} />
      </mesh>

      <mesh
        position={groundVec}
        onClick={(e) => {
          e.stopPropagation();
          select("pole-ground", pole.id);
        }}
      >
        <sphereGeometry args={[Math.max(radius * 2, 0.03), 16, 16]} />
        <meshStandardMaterial color={isGroundSelected ? "#ffb020" : "#3b6ef0"} />
      </mesh>

      <mesh
        position={topVec}
        onClick={(e) => {
          e.stopPropagation();
          select("pole-tip", pole.id);
        }}
      >
        <sphereGeometry args={[Math.max(radius * 2, 0.03), 16, 16]} />
        <meshStandardMaterial color={isTipSelected ? "#ffb020" : "#e0455b"} />
      </mesh>
    </group>
  );
}
