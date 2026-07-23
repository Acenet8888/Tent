import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import { useTentStore } from "../../state/tentStore";
import { buildPointLookup, resolvePanelBoundary, resolveRidgeline } from "../../geometry/generateFabricPanels";
import { CameraControls } from "./CameraControls";
import { PoleMesh } from "./PoleMesh";
import { RidgelineMesh } from "./RidgelineMesh";
import { FabricMesh } from "./FabricMesh";
import { mmToScene } from "./sceneUnits";

export function TentScene() {
  const design = useTentStore((s) => s.design);

  const lookup = useMemo(() => buildPointLookup(design.anchors, design.poles), [design.anchors, design.poles]);

  const gridSize = Math.max(mmToScene(design.dimensions.length), mmToScene(design.dimensions.width)) * 3 + 4;

  return (
    <Canvas shadows camera={{ position: [6, 5, 6], fov: 45 }}>
      <color attach="background" args={["#eef1f5"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 3]} intensity={1.1} castShadow />

      {design.display.showGrid && (
        <Grid
          args={[gridSize, gridSize]}
          cellSize={0.5}
          sectionSize={1}
          cellColor="#c7ccd4"
          sectionColor="#9aa2b1"
          fadeDistance={gridSize}
          infiniteGrid
        />
      )}

      {design.display.showPoles &&
        design.poles.map((pole) => <PoleMesh key={pole.id} pole={pole} />)}

      {design.ridgelines.map((ridgeline) => {
        const resolved = resolveRidgeline(lookup, ridgeline);
        if (!resolved) return null;
        const [start, end] = resolved;
        return <RidgelineMesh key={ridgeline.id} ridgeline={ridgeline} start={start} end={end} />;
      })}

      {design.fabricPanels.map((panel) => (
        <FabricMesh
          key={panel.id}
          panel={panel}
          boundary={resolvePanelBoundary(lookup, panel)}
          wireframe={design.display.showWireframe}
          transparent={design.display.transparentFabric}
        />
      ))}

      <CameraControls />
    </Canvas>
  );
}
