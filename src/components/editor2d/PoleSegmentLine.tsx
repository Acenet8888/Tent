import type { PoleSegment, Vector3 } from "../../types/tent";
import { sampleArc } from "../../geometry/measurements";
import { useSelectionStore } from "../../state/selectionStore";
import { planToScreen, type PlanTransform } from "./transform";

type PoleSegmentLineProps = {
  segment: PoleSegment;
  jointLookup: Map<string, Vector3>;
  transform: PlanTransform;
};

const SEGMENT_COLOR = "#5b636e";

export function PoleSegmentLine({ segment, jointLookup, transform }: PoleSegmentLineProps) {
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);
  const isSelected = selection?.kind === "segment" && selection.id === segment.id;

  const start = jointLookup.get(segment.startJointId);
  const end = jointLookup.get(segment.endJointId);
  if (!start || !end) return null;

  const points: Vector3[] =
    segment.shape === "arc" && segment.archJointId && jointLookup.get(segment.archJointId)
      ? sampleArc(start, jointLookup.get(segment.archJointId)!, end)
      : [start, end];

  const path = points.map((p) => planToScreen(p.x, p.z, transform).join(",")).join(" ");

  return (
    <polyline
      points={path}
      fill="none"
      stroke={isSelected ? "#111827" : SEGMENT_COLOR}
      strokeWidth={isSelected ? 3 : 2}
      style={{ cursor: "pointer" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        select("segment", segment.id);
      }}
    />
  );
}
