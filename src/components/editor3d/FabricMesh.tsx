import { useMemo } from "react";
import * as THREE from "three";
import type { FabricPanel, Vector3 } from "../../types/tent";
import { triangulatePanel } from "../../geometry/triangulatePanel";
import { toSceneVec3 } from "./sceneUnits";

type FabricMeshProps = {
  panel: FabricPanel;
  boundary: Vector3[];
  wireframe: boolean;
  transparent: boolean;
};

/**
 * Renders Stage 1 (deterministic) panel geometry: a flat triangulated
 * surface between the panel's current boundary points. Because this
 * rebuilds directly from live pole/anchor positions every render, dragging
 * a point in the 2D or 3D view updates the fabric immediately with exact
 * dimensions — no relaxation pass required for the MVP.
 */
export function FabricMesh({ panel, boundary, wireframe, transparent }: FabricMeshProps) {
  const geometry = useMemo(() => {
    if (boundary.length < 3) return null;

    const { vertices, triangles } = triangulatePanel(boundary);
    const positions = new Float32Array(vertices.length * 3);
    vertices.forEach((v, i) => {
      const [x, y, z] = toSceneVec3(v);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setIndex(triangles.flat());
    geom.computeVertexNormals();
    return geom;
  }, [boundary]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} name={panel.name}>
      <meshStandardMaterial
        color="#d6c7a1"
        side={THREE.DoubleSide}
        wireframe={wireframe}
        transparent={transparent}
        opacity={transparent ? 0.45 : 1}
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  );
}
