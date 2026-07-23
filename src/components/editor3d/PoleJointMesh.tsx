import { useMemo } from "react";
import type { PoleJoint } from "../../types/tent";
import { useSelectionStore } from "../../state/selectionStore";
import { toSceneVec3 } from "./sceneUnits";

const JOINT_COLORS: Record<PoleJoint["type"], string> = {
  ground: "#3b6ef0",
  hub: "#8a3fd6",
  apex: "#e0455b",
};

const JOINT_SIZE = 0.05;

type PoleJointMeshProps = {
  joint: PoleJoint;
};

export function PoleJointMesh({ joint }: PoleJointMeshProps) {
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);
  const isSelected = selection?.kind === "joint" && selection.id === joint.id;

  const position = useMemo(() => toSceneVec3(joint.position), [joint.position]);
  const color = isSelected ? "#ffb020" : JOINT_COLORS[joint.type];

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    select("joint", joint.id);
  };

  if (joint.type === "hub") {
    return (
      <mesh position={position} onClick={handleClick}>
        <boxGeometry args={[JOINT_SIZE * 1.6, JOINT_SIZE * 1.6, JOINT_SIZE * 1.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }

  return (
    <mesh position={position} onClick={handleClick}>
      <sphereGeometry args={[JOINT_SIZE, 16, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
