import { useMemo } from "react";
import { useTentStore } from "../../state/tentStore";
import { useCutPatternStore } from "../../state/cutPatternStore";
import { buildPointLookup, resolvePanelBoundary } from "../../geometry/generateFabricPanels";
import { triangulatePanel } from "../../geometry/triangulatePanel";
import { flattenTriangulatedPolygon, polygonArea, type FlatPoint } from "../../geometry/flattenPanel";
import { isFlyPanel } from "../../geometry/regenerateFlyFabric";
import { formatLength, toMillimeters } from "../../units/conversions";
import type { LengthUnit } from "../../types/tent";

const PIECE_BOX_SIZE = 240;
const PIECE_PADDING = 28;
const SHORT_EDGE_THRESHOLD_PX = 28;

type EdgeLabel = { x: number; y: number; text: string; wide?: boolean };

/**
 * A hoop's arc contributes many closely-spaced sample points to a panel's
 * boundary, so labeling every one of those tiny edges individually just
 * produces illegible overlapping text. Runs of consecutive edges shorter
 * than the threshold get collapsed into a single "curve" label (summing
 * their true length) at the run's midpoint instead of one label per edge.
 */
function computeEdgeLabels(points: FlatPoint[], toSvg: (p: FlatPoint) => [number, number], unit: LengthUnit): EdgeLabel[] {
  const n = points.length;
  if (n < 2) return [];

  const edgeScreenLen: number[] = [];
  const edgeMm: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const [x1, y1] = toSvg(a);
    const [x2, y2] = toSvg(b);
    edgeScreenLen.push(Math.hypot(x2 - x1, y2 - y1));
    edgeMm.push(Math.hypot(b.x - a.x, b.y - a.y));
  }

  const labels: EdgeLabel[] = [];
  let i = 0;
  while (i < n) {
    if (edgeScreenLen[i] >= SHORT_EDGE_THRESHOLD_PX) {
      const a = points[i];
      const b = points[(i + 1) % n];
      const [x1, y1] = toSvg(a);
      const [x2, y2] = toSvg(b);
      labels.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, text: formatLength(edgeMm[i], unit) });
      i += 1;
      continue;
    }

    let j = i;
    let totalMm = 0;
    const runIndices: number[] = [];
    while (j < n && edgeScreenLen[j] < SHORT_EDGE_THRESHOLD_PX) {
      totalMm += edgeMm[j];
      runIndices.push(j);
      j += 1;
    }
    const midPoint = points[runIndices[Math.floor(runIndices.length / 2)]];
    const [mx, my] = toSvg(midPoint);
    labels.push({ x: mx, y: my, text: `${formatLength(totalMm, unit)} curve`, wide: true });
    i = j;
  }
  return labels;
}

function PatternPiece({ name, points, unit }: { name: string; points: FlatPoint[]; unit: LengthUnit }) {
  if (points.length < 3) return null;

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const drawable = PIECE_BOX_SIZE - PIECE_PADDING * 2;
  const scale = Math.min(drawable / spanX, drawable / spanY);

  const toSvg = (p: FlatPoint): [number, number] => [
    PIECE_PADDING + (p.x - minX) * scale,
    PIECE_PADDING + (p.y - minY) * scale,
  ];

  const svgPoints = points.map(toSvg);
  const mmPerUnit = toMillimeters(1, unit);
  const areaInUnit2 = polygonArea(points) / (mmPerUnit * mmPerUnit);

  return (
    <div className="pattern-piece">
      <h4>{name}</h4>
      <svg width={PIECE_BOX_SIZE} height={PIECE_BOX_SIZE}>
        <polygon
          points={svgPoints.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="#d6c7a1"
          fillOpacity={0.5}
          stroke="#5b4a2f"
          strokeWidth={1.5}
        />
        {computeEdgeLabels(points, toSvg, unit).map((label, i) => (
          <g key={i}>
            <rect
              x={label.x - (label.wide ? 32 : 22)}
              y={label.y - 7}
              width={label.wide ? 64 : 44}
              height={13}
              fill="white"
              opacity={0.85}
              rx={2}
            />
            <text x={label.x} y={label.y + 3} textAnchor="middle" fontSize={label.wide ? 8 : 9} fill="#374151">
              {label.text}
            </text>
          </g>
        ))}
      </svg>
      <p className="pattern-piece-area">
        ~{areaInUnit2.toFixed(2)} {unit}² · {points.length} pts
      </p>
    </div>
  );
}

export function CutPatternModal() {
  const design = useTentStore((s) => s.design);
  const isOpen = useCutPatternStore((s) => s.isOpen);
  const close = useCutPatternStore((s) => s.close);
  const unit = design.dimensions.unit;

  const pieces = useMemo(() => {
    if (!isOpen) return [];
    const lookup = buildPointLookup(design.anchors, design.poleJoints, design.poleSegments);
    return design.fabricPanels
      .filter(isFlyPanel)
      .map((panel) => {
        const boundary = resolvePanelBoundary(lookup, panel);
        if (boundary.length < 3) return null;
        const { vertices, triangles } = triangulatePanel(boundary);
        const points = flattenTriangulatedPolygon(vertices, triangles);
        return { id: panel.id, name: panel.name, points };
      })
      .filter((p): p is { id: string; name: string; points: FlatPoint[] } => p !== null);
  }, [isOpen, design.anchors, design.poleJoints, design.poleSegments, design.fabricPanels]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Fly cut pattern</h2>
          <button onClick={close}>Close</button>
        </div>
        <p className="hint">
          Each piece is flattened from its 3D shape preserving true edge lengths, so straight
          panels come out exact and curved (hoop-affected) panels come out as a close
          approximation — a genuinely curved surface can't be unrolled perfectly flat without a
          dart or seam. Add seam allowance before cutting; these are finished-size boundaries.
        </p>
        {pieces.length === 0 ? (
          <p className="hint">No fly panels to show — add a pole or recalculate the fly first.</p>
        ) : (
          <div className="pattern-grid">
            {pieces.map((piece) => (
              <PatternPiece key={piece.id} name={piece.name} points={piece.points} unit={unit} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
