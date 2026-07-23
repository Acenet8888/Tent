import { useMemo } from "react";
import * as THREE from "three";
import type { AnchorPoint } from "../../types/tent";
import { toSceneVec3 } from "./sceneUnits";

const GUY_LINE_COLOR = "#8a5a1f";
const MARKER_SIZE = 0.035;

type TieOutMeshProps = {
  anchor: AnchorPoint & { groundPosition: NonNullable<AnchorPoint["groundPosition"]> };
};

/** Renders a tie-out's guy-line: a thin line from the fabric attachment down to its separate ground stake, with small markers at each end. */
export function TieOutMesh({ anchor }: TieOutMeshProps) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...toSceneVec3(anchor.position)),
      new THREE.Vector3(...toSceneVec3(anchor.groundPosition)),
    ]);
    const material = new THREE.LineDashedMaterial({ color: GUY_LINE_COLOR, dashSize: 0.05, gapSize: 0.03 });
    const obj = new THREE.Line(geometry, material);
    obj.computeLineDistances();
    return obj;
  }, [anchor.position, anchor.groundPosition]);

  const fabricPos = useMemo(() => toSceneVec3(anchor.position), [anchor.position]);
  const groundPos = useMemo(() => toSceneVec3(anchor.groundPosition), [anchor.groundPosition]);

  return (
    <group>
      <primitive object={line} />
      <mesh position={fabricPos}>
        <sphereGeometry args={[MARKER_SIZE, 12, 12]} />
        <meshStandardMaterial color="#c77b17" />
      </mesh>
      <mesh position={groundPos}>
        <sphereGeometry args={[MARKER_SIZE, 12, 12]} />
        <meshStandardMaterial color={GUY_LINE_COLOR} />
      </mesh>
    </group>
  );
}
