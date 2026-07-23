import { useCallback } from "react";
import type { Pole } from "../../types/tent";
import { useSelectionStore } from "../../state/selectionStore";
import { useTentStore } from "../../state/tentStore";
import { planToScreen, screenToPlan, snapToGrid, type PlanTransform } from "./transform";

type PoleHandleProps = {
  pole: Pole;
  transform: PlanTransform;
  snapEnabled: boolean;
  gridMm: number;
  onMoveGround: (id: string, x: number, z: number, skipHistory: boolean) => void;
  onMoveTip: (id: string, x: number, z: number, skipHistory: boolean) => void;
};

const OVERLAP_THRESHOLD_PX = 10;
const TIP_OFFSET_PX = 16;

export function PoleHandle({ pole, transform, snapEnabled, gridMm, onMoveGround, onMoveTip }: PoleHandleProps) {
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);
  const beginInteraction = useTentStore((s) => s.beginInteraction);

  const [gx, gy] = planToScreen(pole.groundPosition.x, pole.groundPosition.z, transform);
  const [tx, ty] = planToScreen(pole.topPosition.x, pole.topPosition.z, transform);

  const overlapDistance = Math.hypot(tx - gx, ty - gy);
  const nearlyVertical = overlapDistance < OVERLAP_THRESHOLD_PX;
  const tipRenderX = nearlyVertical ? gx + TIP_OFFSET_PX : tx;
  const tipRenderY = nearlyVertical ? gy - TIP_OFFSET_PX : ty;

  const makeDragHandler = useCallback(
    (kind: "pole-ground" | "pole-tip", onMove: (id: string, x: number, z: number, skipHistory: boolean) => void) =>
      (event: React.PointerEvent<SVGElement>) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        select(kind, pole.id);
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
          onMove(pole.id, x, z, true);
        };

        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      },
    [beginInteraction, gridMm, pole.id, select, snapEnabled, transform]
  );

  const isGroundSelected = selection?.kind === "pole-ground" && selection.id === pole.id;
  const isTipSelected = selection?.kind === "pole-tip" && selection.id === pole.id;

  return (
    <g>
      {nearlyVertical && (
        <line x1={gx} y1={gy} x2={tipRenderX} y2={tipRenderY} stroke="#9ca3af" strokeDasharray="2,2" strokeWidth={1} />
      )}
      <line x1={gx} y1={gy} x2={nearlyVertical ? gx : tx} y2={nearlyVertical ? gy : ty} stroke="#5b636e" strokeWidth={2} />

      <circle
        cx={gx}
        cy={gy}
        r={isGroundSelected ? 8 : 6}
        fill="#3b6ef0"
        stroke={isGroundSelected ? "#111827" : "white"}
        strokeWidth={isGroundSelected ? 2 : 1.5}
        style={{ cursor: "grab" }}
        onPointerDown={makeDragHandler("pole-ground", onMoveGround)}
      />

      <rect
        x={tipRenderX - 6}
        y={tipRenderY - 6}
        width={12}
        height={12}
        transform={`rotate(45 ${tipRenderX} ${tipRenderY})`}
        fill="#e0455b"
        stroke={isTipSelected ? "#111827" : "white"}
        strokeWidth={isTipSelected ? 2 : 1.5}
        style={{ cursor: "grab" }}
        onPointerDown={makeDragHandler("pole-tip", onMoveTip)}
      />

      <text x={gx + 10} y={gy + 16} fontSize={10} fill="#374151">
        {pole.name}
      </text>
    </g>
  );
}
