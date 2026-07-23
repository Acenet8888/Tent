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

type AnchorHandleProps = {
  anchor: AnchorPoint;
  transform: PlanTransform;
  snapEnabled: boolean;
  gridMm: number;
  onMove: (id: string, x: number, z: number, skipHistory: boolean) => void;
};

export function AnchorHandle({ anchor, transform, snapEnabled, gridMm, onMove }: AnchorHandleProps) {
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);
  const beginInteraction = useTentStore((s) => s.beginInteraction);
  const isSelected = selection?.kind === "anchor" && selection.id === anchor.id;

  const [cx, cy] = planToScreen(anchor.position.x, anchor.position.z, transform);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGCircleElement>) => {
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
        onMove(anchor.id, x, z, true);
      };

      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [anchor.id, beginInteraction, gridMm, onMove, select, snapEnabled, transform]
  );

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={isSelected ? 8 : 6}
        fill={ANCHOR_COLORS[anchor.type]}
        stroke={isSelected ? "#111827" : "white"}
        strokeWidth={isSelected ? 2 : 1.5}
        style={{ cursor: "grab" }}
        onPointerDown={handlePointerDown}
      />
      <text x={cx + 10} y={cy - 8} fontSize={10} fill="#374151">
        {anchor.name}
      </text>
    </g>
  );
}
