import { useCallback } from "react";
import type { AnchorPoint } from "../../types/tent";
import { useSelectionStore } from "../../state/selectionStore";
import { useTentStore } from "../../state/tentStore";
import { planToScreen, screenToPlan, snapToGrid, type PlanTransform } from "./transform";

const ANCHOR_COLORS: Record<AnchorPoint["type"], string> = {
  corner: "#3b6ef0",
  stake: "#2e9e5b",
  "tie-out": "#c77b17",
  eave: "#7a4fd6",
};

const GROUND_STAKE_COLOR = "#8a5a1f";

type AnchorHandleProps = {
  anchor: AnchorPoint;
  transform: PlanTransform;
  snapEnabled: boolean;
  gridMm: number;
  onMove: (id: string, x: number, z: number, skipHistory: boolean) => void;
  onMoveGround?: (id: string, x: number, z: number, skipHistory: boolean) => void;
};

export function AnchorHandle({ anchor, transform, snapEnabled, gridMm, onMove, onMoveGround }: AnchorHandleProps) {
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);
  const beginInteraction = useTentStore((s) => s.beginInteraction);
  const isSelected = selection?.kind === "anchor" && selection.id === anchor.id;

  const [cx, cy] = planToScreen(anchor.position.x, anchor.position.z, transform);

  const makeDragHandler = useCallback(
    (callback?: (id: string, x: number, z: number, skipHistory: boolean) => void) =>
      (event: React.PointerEvent<SVGElement>) => {
        if (!callback) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        select("anchor", anchor.id);
        beginInteraction();

        const svg = event.currentTarget.ownerSVGElement;

        const handleMove = (moveEvent: PointerEvent) => {
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          const px = moveEvent.clientX - rect.left;
          const py = moveEvent.clientY - rect.top;
          let [x, z] = screenToPlan(px, py, transform);
          if (snapEnabled) {
            x = snapToGrid(x, gridMm);
            z = snapToGrid(z, gridMm);
          }
          callback(anchor.id, x, z, true);
        };

        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      },
    [anchor.id, beginInteraction, gridMm, select, snapEnabled, transform]
  );

  const hasGroundEnd = anchor.type === "tie-out" && anchor.groundPosition !== undefined;
  const groundScreen = hasGroundEnd ? planToScreen(anchor.groundPosition!.x, anchor.groundPosition!.z, transform) : null;

  return (
    <g>
      {groundScreen && (
        <>
          <line x1={cx} y1={cy} x2={groundScreen[0]} y2={groundScreen[1]} stroke="#c99a52" strokeDasharray="3,2" strokeWidth={1.25} />
          <circle
            cx={groundScreen[0]}
            cy={groundScreen[1]}
            r={5}
            fill={GROUND_STAKE_COLOR}
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: "grab" }}
            onPointerDown={makeDragHandler(onMoveGround)}
          />
        </>
      )}

      <circle
        cx={cx}
        cy={cy}
        r={isSelected ? 8 : 6}
        fill={ANCHOR_COLORS[anchor.type]}
        stroke={isSelected ? "#111827" : "white"}
        strokeWidth={isSelected ? 2 : 1.5}
        style={{ cursor: "grab" }}
        onPointerDown={makeDragHandler(onMove)}
      />
      <text x={cx + 10} y={cy - 8} fontSize={10} fill="#374151">
        {anchor.name}
      </text>
    </g>
  );
}
