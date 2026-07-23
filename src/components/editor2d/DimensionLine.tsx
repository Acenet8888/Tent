import { formatLength } from "../../units/conversions";
import type { LengthUnit } from "../../types/tent";

type DimensionLineProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  distanceMm: number;
  unit: LengthUnit;
  /** Perpendicular offset (px) so the dimension line doesn't overlap the geometry itself. */
  offset?: number;
};

export function DimensionLine({ x1, y1, x2, y2, distanceMm, unit, offset = 18 }: DimensionLineProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * offset;
  const ny = (dx / len) * offset;

  const ax1 = x1 + nx;
  const ay1 = y1 + ny;
  const ax2 = x2 + nx;
  const ay2 = y2 + ny;
  const midX = (ax1 + ax2) / 2;
  const midY = (ay1 + ay2) / 2;

  return (
    <g className="dimension-line" pointerEvents="none">
      <line x1={x1} y1={y1} x2={ax1} y2={ay1} stroke="#6b7280" strokeWidth={0.75} strokeDasharray="2,2" />
      <line x1={x2} y1={y2} x2={ax2} y2={ay2} stroke="#6b7280" strokeWidth={0.75} strokeDasharray="2,2" />
      <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="#374151" strokeWidth={1} />
      <rect x={midX - 26} y={midY - 9} width={52} height={16} fill="white" opacity={0.85} rx={3} />
      <text x={midX} y={midY + 3} textAnchor="middle" fontSize={10} fill="#111827">
        {formatLength(distanceMm, unit)}
      </text>
    </g>
  );
}
