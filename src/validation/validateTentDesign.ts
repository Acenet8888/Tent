import type { TentDesign, Vector3 } from "../types/tent";
import { calculateDistance, currentSegmentLength } from "../geometry/measurements";
import { buildPointLookup, resolvePoint } from "../geometry/generateFabricPanels";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  id: string;
  severity: ValidationSeverity;
  message: string;
  relatedIds: string[];
};

const MIN_DIMENSION_MM = 300; // 30cm: below this a tent is not physically meaningful
const MAX_DIMENSION_MM = 20000; // 20m: generous upper bound for a single-structure MVP
const DUPLICATE_POINT_EPSILON_MM = 1;
const POLE_LENGTH_EPSILON_MM = 0.5;

export function validateTentDesign(design: TentDesign): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  issues.push(...validateDimensionLimits(design));
  issues.push(...validateSegmentLengths(design));
  issues.push(...validateDuplicatePoints(design));
  issues.push(...validateSelfIntersectingPanels(design));

  return issues;
}

function validateDimensionLimits(design: TentDesign): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { length, width, peakHeight } = design.dimensions;

  const checks: [string, number][] = [
    ["length", length],
    ["width", width],
    ["peak height", peakHeight],
  ];

  for (const [label, value] of checks) {
    if (value < MIN_DIMENSION_MM) {
      issues.push({
        id: `dimension-min-${label}`,
        severity: "error",
        message: `Tent ${label} is below the minimum supported size (${MIN_DIMENSION_MM}mm).`,
        relatedIds: [],
      });
    }
    if (value > MAX_DIMENSION_MM) {
      issues.push({
        id: `dimension-max-${label}`,
        severity: "error",
        message: `Tent ${label} exceeds the maximum supported size (${MAX_DIMENSION_MM}mm).`,
        relatedIds: [],
      });
    }
  }

  return issues;
}

function validateSegmentLengths(design: TentDesign): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const jointLookup = new Map(design.poleJoints.map((j) => [j.id, j.position]));

  for (const segment of design.poleSegments) {
    const actualDistance = currentSegmentLength(segment, jointLookup);
    if (actualDistance === undefined) {
      issues.push({
        id: `segment-missing-joint-${segment.id}`,
        severity: "error",
        message: `${segment.name} references a joint that no longer exists.`,
        relatedIds: [segment.id],
      });
      continue;
    }

    const discrepancy = Math.abs(actualDistance - segment.length);
    // Arc segments never enforce a locked length (see PoleSegment.lockedLength),
    // so a mismatch there just means the stored value hasn't been refreshed
    // rather than a real inconsistency worth flagging.
    if (segment.shape === "straight" && segment.lockedLength && discrepancy > POLE_LENGTH_EPSILON_MM) {
      issues.push({
        id: `segment-length-mismatch-${segment.id}`,
        severity: "error",
        message: `${segment.name}'s locked length (${segment.length.toFixed(1)}mm) does not match its actual span (${actualDistance.toFixed(1)}mm).`,
        relatedIds: [segment.id],
      });
    }

    if (actualDistance < 1) {
      issues.push({
        id: `segment-zero-length-${segment.id}`,
        severity: "error",
        message: `${segment.name} has zero length: its endpoints coincide.`,
        relatedIds: [segment.id],
      });
    }
  }

  return issues;
}

function validateDuplicatePoints(design: TentDesign): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const points: { id: string; name: string; position: Vector3 }[] = [
    ...design.anchors.map((a) => ({ id: a.id, name: a.name, position: a.position })),
    ...design.poleJoints.map((j) => ({ id: j.id, name: j.name, position: j.position })),
  ];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const distance = calculateDistance(points[i].position, points[j].position);
      if (distance < DUPLICATE_POINT_EPSILON_MM) {
        issues.push({
          id: `duplicate-${points[i].id}-${points[j].id}`,
          severity: "warning",
          message: `"${points[i].name}" and "${points[j].name}" are at (nearly) the same position.`,
          relatedIds: [points[i].id, points[j].id],
        });
      }
    }
  }

  return issues;
}

function validateSelfIntersectingPanels(design: TentDesign): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lookup = buildPointLookup(design.anchors, design.poleJoints);

  for (const panel of design.fabricPanels) {
    const points = panel.boundaryPointIds
      .map((id) => resolvePoint(lookup, id))
      .filter((p): p is Vector3 => p !== undefined);

    if (points.length !== panel.boundaryPointIds.length) {
      issues.push({
        id: `panel-missing-points-${panel.id}`,
        severity: "error",
        message: `Panel "${panel.name}" references a point that no longer exists.`,
        relatedIds: [panel.id],
      });
      continue;
    }

    if (points.length === 4 && quadEdgesIntersect(points)) {
      issues.push({
        id: `panel-self-intersecting-${panel.id}`,
        severity: "warning",
        message: `Panel "${panel.name}" appears self-intersecting (its boundary crosses itself).`,
        relatedIds: [panel.id],
      });
    }
  }

  return issues;
}

/**
 * Projects a quad onto the plane that best fits its 4 points (using the
 * dominant pair of axes) and checks whether its two diagonals-adjacent
 * edges (0-1 vs 2-3, and 1-2 vs 3-0) cross. A convex, non-self-intersecting
 * quad never has crossing opposite edges; a "bowtie" quad does.
 */
function quadEdgesIntersect(points: Vector3[]): boolean {
  const projected = projectToDominantPlane(points);
  return (
    segmentsIntersect(projected[0], projected[1], projected[2], projected[3]) ||
    segmentsIntersect(projected[1], projected[2], projected[3], projected[0])
  );
}

function projectToDominantPlane(points: Vector3[]): { x: number; y: number }[] {
  return points.map((p) => ({ x: p.x, y: p.z }));
}

function segmentsIntersect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): boolean {
  const cross = (o: typeof a, p: typeof a, q: typeof a) =>
    (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);

  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);

  return d1 * d2 < 0 && d3 * d4 < 0;
}
