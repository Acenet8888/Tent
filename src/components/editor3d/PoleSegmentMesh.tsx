import { useMemo } from "react";
import * as THREE from "three";
import type { PoleSegment, Vector3 } from "../../types/tent";
import { sampleArc } from "../../geometry/measurements";
import { useSelectionStore } from "../../state/selectionStore";
import { toSceneVec3, mmToScene } from "./sceneUnits";

const DEFAULT_DIAMETER_MM = 9;

type PoleSegmentMeshProps = {
  segment: PoleSegment;
  jointLookup: Map<string, Vector3>;
};

function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3) {
  const dir = b.clone().sub(a);
  const length = dir.length();
  const midpoint = a.clone().add(b).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize()
  );
  return { midpoint, quaternion, length };
}

export function PoleSegmentMesh({ segment, jointLookup }: PoleSegmentMeshProps) {
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);
  const isSelected = selection?.kind === "segment" && selection.id === segment.id;

  const start = jointLookup.get(segment.startJointId);
  const end = jointLookup.get(segment.endJointId);
  const apex = segment.archJointId ? jointLookup.get(segment.archJointId) : undefined;

  const points = useMemo(() => {
    if (!start || !end) return [];
    if (segment.shape === "arc" && apex) return sampleArc(start, apex, end);
    return [start, end];
  }, [start, end, apex, segment.shape]);

  const radius = mmToScene(segment.diameter ?? DEFAULT_DIAMETER_MM) / 2;
  const color = isSelected ? "#ffb020" : "#8a8f98";

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    select("segment", segment.id);
  };

  if (points.length < 2) return null;

  return (
    <group onClick={handleClick}>
      {points.slice(0, -1).map((p, i) => {
        const a = new THREE.Vector3(...toSceneVec3(p));
        const b = new THREE.Vector3(...toSceneVec3(points[i + 1]));
        const { midpoint, quaternion, length } = cylinderBetween(a, b);
        return (
          <mesh key={i} position={midpoint} quaternion={quaternion} castShadow>
            <cylinderGeometry args={[radius, radius, length, 10]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}
