import { useCallback } from "react";
import type { PoleJoint } from "../../types/tent";
import { useSelectionStore } from "../../state/selectionStore";
import { useTentStore } from "../../state/tentStore";
import { planToScreen, screenToPlan, snapToGrid, type PlanTransform } from "./transform";

const JOINT_COLORS: Record<PoleJoint["type"], string> = {
  ground: "#3b6ef0",
  hub: "#8a3fd6",
  apex: "#e0455b",
};

type PoleJointHandleProps = {
  joint: PoleJoint;
  transform: PlanTransform;
  snapEnabled: boolean;
  gridMm: number;
};

export function PoleJointHandle({ joint, transform, snapEnabled, gridMm }: PoleJointHandleProps) {
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);
  const beginInteraction = useTentStore((s) => s.beginInteraction);
  const moveJoint = useTentStore((s) => s.moveJoint);
  const isSelected = selection?.kind === "joint" && selection.id === joint.id;

  const [cx, cy] = planToScreen(joint.position.x, joint.position.z, transform);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      select("joint", joint.id);
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
        moveJoint(joint.id, { x, y: joint.position.y, z }, { skipHistory: true });
      };

      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [beginInteraction, gridMm, joint.id, joint.position.y, moveJoint, select, snapEnabled, transform]
  );

  const color = JOINT_COLORS[joint.type];
  const stroke = isSelected ? "#111827" : "white";
  const strokeWidth = isSelected ? 2 : 1.5;
  const size = isSelected ? 8 : 6;

  return (
    <g>
      {joint.type === "ground" && (
        <circle cx={cx} cy={cy} r={size} fill={color} stroke={stroke} strokeWidth={strokeWidth} style={{ cursor: "grab" }} onPointerDown={handlePointerDown} />
      )}
      {joint.type === "hub" && (
        <rect
          x={cx - size}
          y={cy - size}
          width={size * 2}
          height={size * 2}
          fill={color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          style={{ cursor: "grab" }}
          onPointerDown={handlePointerDown}
        />
      )}
      {joint.type === "apex" && (
        <rect
          x={cx - size}
          y={cy - size}
          width={size * 2}
          height={size * 2}
          transform={`rotate(45 ${cx} ${cy})`}
          fill={color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          style={{ cursor: "grab" }}
          onPointerDown={handlePointerDown}
        />
      )}
      <text x={cx + 10} y={cy - 8} fontSize={10} fill="#374151">
        {joint.name}
      </text>
    </g>
  );
}
