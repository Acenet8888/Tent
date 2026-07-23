import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTentStore } from "../../state/tentStore";
import { useSelectionStore } from "../../state/selectionStore";
import { buildPointLookup, resolvePanelBoundary } from "../../geometry/generateFabricPanels";
import { calculateDistance } from "../../geometry/measurements";
import { MeasurementGrid } from "./MeasurementGrid";
import { DimensionLine } from "./DimensionLine";
import { PoleJointHandle } from "./PoleJointHandle";
import { PoleSegmentLine } from "./PoleSegmentLine";
import { AnchorHandle } from "./AnchorHandle";
import { planToScreen, type PlanTransform } from "./transform";

const DEFAULT_GRID_MM = 50;
const MIN_SCALE = 0.005;
const MAX_SCALE = 2;

export function FloorPlanEditor() {
  const design = useTentStore((s) => s.design);
  const moveAnchor = useTentStore((s) => s.moveAnchor);
  const clearSelection = useSelectionStore((s) => s.clear);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState<PlanTransform>({ scale: 0.1, offsetX: 400, offsetY: 300 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridMm, setGridMm] = useState(DEFAULT_GRID_MM);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitToView = useCallback(() => {
    const padding = 0.2;
    const spanX = design.dimensions.length * (1 + padding) || 1000;
    const spanZ = design.dimensions.width * (1 + padding) || 1000;
    const scaleX = size.width / spanX;
    const scaleZ = size.height / spanZ;
    const scale = Math.min(scaleX, scaleZ);
    setTransform({
      scale,
      offsetX: size.width / 2,
      offsetY: size.height / 2,
    });
  }, [design.dimensions.length, design.dimensions.width, size.height, size.width]);

  // Fit the view once the container has a real size, and whenever the tent's
  // overall footprint changes (so a resize doesn't leave the tent off-screen).
  const hasFitOnce = useRef(false);
  useEffect(() => {
    if (size.width > 0 && size.height > 0 && !hasFitOnce.current) {
      fitToView();
      hasFitOnce.current = true;
    }
  }, [fitToView, size.width, size.height]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      setTransform((prev) => {
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        const worldX = (mouseX - prev.offsetX) / prev.scale;
        const worldZ = (mouseY - prev.offsetY) / prev.scale;
        return {
          scale: nextScale,
          offsetX: mouseX - worldX * nextScale,
          offsetY: mouseY - worldZ * nextScale,
        };
      });
    },
    []
  );

  const panState = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  const handleBackgroundPointerDown = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      clearSelection();
      event.currentTarget.setPointerCapture(event.pointerId);
      panState.current = {
        startX: event.clientX,
        startY: event.clientY,
        startOffsetX: transform.offsetX,
        startOffsetY: transform.offsetY,
      };
    },
    [clearSelection, transform.offsetX, transform.offsetY]
  );

  const handleBackgroundPointerMove = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    if (!panState.current) return;
    const dx = event.clientX - panState.current.startX;
    const dy = event.clientY - panState.current.startY;
    setTransform((prev) => ({
      ...prev,
      offsetX: panState.current!.startOffsetX + dx,
      offsetY: panState.current!.startOffsetY + dy,
    }));
  }, []);

  const handleBackgroundPointerUp = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    panState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const lookup = useMemo(
    () => buildPointLookup(design.anchors, design.poleJoints),
    [design.anchors, design.poleJoints]
  );

  const panelOutlines = useMemo(
    () =>
      design.fabricPanels.map((panel) => ({
        id: panel.id,
        points: resolvePanelBoundary(lookup, panel),
      })),
    [design.fabricPanels, lookup]
  );

  const cornerAnchors = design.anchors.filter((a) => a.type === "corner");
  const lengthDim =
    cornerAnchors.length >= 2
      ? (() => {
          const a = cornerAnchors[0];
          const b = cornerAnchors.find((c) => Math.abs(c.position.z - a.position.z) < 1e-6 && c.id !== a.id);
          return b ? { a, b } : undefined;
        })()
      : undefined;
  const widthDim =
    cornerAnchors.length >= 2
      ? (() => {
          const a = cornerAnchors[0];
          const b = cornerAnchors.find((c) => Math.abs(c.position.x - a.position.x) < 1e-6 && c.id !== a.id);
          return b ? { a, b } : undefined;
        })()
      : undefined;

  return (
    <div ref={containerRef} className="floor-plan-editor">
      <div className="floor-plan-toolbar">
        <button onClick={fitToView}>Fit View</button>
        <label>
          <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
          Snap to grid
        </label>
        <label>
          Grid (mm)
          <input
            type="number"
            min={1}
            value={gridMm}
            onChange={(e) => setGridMm(Math.max(1, Number(e.target.value) || DEFAULT_GRID_MM))}
            style={{ width: 60 }}
          />
        </label>
      </div>

      <svg width="100%" height="100%" onWheel={handleWheel} style={{ display: "block", touchAction: "none" }}>
        <rect
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          fill="#f8f9fb"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={handleBackgroundPointerUp}
        />

        {design.display.showGrid && (
          <MeasurementGrid
            width={size.width}
            height={size.height}
            scale={transform.scale}
            offsetX={transform.offsetX}
            offsetY={transform.offsetY}
            minorSpacingMm={gridMm}
          />
        )}

        {panelOutlines.map(({ id, points }) =>
          points.length >= 3 ? (
            <polygon
              key={id}
              points={points.map((p) => planToScreen(p.x, p.z, transform).join(",")).join(" ")}
              fill="#d6c7a1"
              fillOpacity={0.12}
              stroke="#b8a276"
              strokeWidth={1}
              pointerEvents="none"
            />
          ) : null
        )}

        {design.display.showDimensions && lengthDim && (
          <DimensionLine
            x1={planToScreen(lengthDim.a.position.x, lengthDim.a.position.z, transform)[0]}
            y1={planToScreen(lengthDim.a.position.x, lengthDim.a.position.z, transform)[1]}
            x2={planToScreen(lengthDim.b.position.x, lengthDim.b.position.z, transform)[0]}
            y2={planToScreen(lengthDim.b.position.x, lengthDim.b.position.z, transform)[1]}
            distanceMm={calculateDistance(lengthDim.a.position, lengthDim.b.position)}
            unit={design.dimensions.unit}
            offset={-24}
          />
        )}

        {design.display.showDimensions && widthDim && (
          <DimensionLine
            x1={planToScreen(widthDim.a.position.x, widthDim.a.position.z, transform)[0]}
            y1={planToScreen(widthDim.a.position.x, widthDim.a.position.z, transform)[1]}
            x2={planToScreen(widthDim.b.position.x, widthDim.b.position.z, transform)[0]}
            y2={planToScreen(widthDim.b.position.x, widthDim.b.position.z, transform)[1]}
            distanceMm={calculateDistance(widthDim.a.position, widthDim.b.position)}
            unit={design.dimensions.unit}
            offset={24}
          />
        )}

        {design.anchors.map((anchor) => (
          <AnchorHandle
            key={anchor.id}
            anchor={anchor}
            transform={transform}
            snapEnabled={snapEnabled}
            gridMm={gridMm}
            onMove={(id, x, z, skipHistory) => {
              const current = design.anchors.find((a) => a.id === id);
              if (!current) return;
              moveAnchor(id, { x, y: current.position.y, z }, { skipHistory });
            }}
          />
        ))}

        {design.display.showPoles &&
          design.poleSegments.map((segment) => (
            <PoleSegmentLine key={segment.id} segment={segment} jointLookup={lookup} transform={transform} />
          ))}

        {design.display.showPoles &&
          design.poleJoints.map((joint) => (
            <PoleJointHandle
              key={joint.id}
              joint={joint}
              transform={transform}
              snapEnabled={snapEnabled}
              gridMm={gridMm}
            />
          ))}
      </svg>
    </div>
  );
}
