import type { AnchorPoint, FabricPanel, PoleJoint, PoleSegment, Ridgeline, Seam, Vector3 } from "../types/tent";
import { sampleArc } from "./measurements";

export type PointLookup = Map<string, Vector3>;

/** Number of points sampled along an arc segment's curve for both rendering and fly-panel boundaries. */
export const ARC_SAMPLE_STEPS = 16;

/** The synthetic point id for the i-th sample along an arc segment's curve (see buildPointLookup). */
export function arcSamplePointId(segmentId: string, index: number): string {
  return `${segmentId}:arc:${index}`;
}

/**
 * Builds a lookup from every point id (anchors, pole joints, and synthetic
 * per-sample points along each arc segment's curve) to its 3D position, so
 * panel/seam generation can resolve boundary ids without caring whether a
 * point comes from an anchor, a pole joint, or a point along a hoop's bend.
 * Joints are addressable directly by their own id (unlike the old
 * ground/tip pole pair, there's no synthetic suffix to reconstruct there);
 * arc segments additionally get `arcSamplePointId(segment.id, i)` entries
 * so a fabric panel can trace the actual curve instead of just its two
 * ground ends and peak.
 */
export function buildPointLookup(anchors: AnchorPoint[], joints: PoleJoint[], segments: PoleSegment[] = []): PointLookup {
  const lookup: PointLookup = new Map();
  for (const anchor of anchors) {
    lookup.set(anchor.id, anchor.position);
  }
  for (const joint of joints) {
    lookup.set(joint.id, joint.position);
  }

  const jointPositions = new Map(joints.map((j) => [j.id, j.position]));
  for (const segment of segments) {
    if (segment.shape !== "arc" || !segment.archJointId) continue;
    const start = jointPositions.get(segment.startJointId);
    const apex = jointPositions.get(segment.archJointId);
    const end = jointPositions.get(segment.endJointId);
    if (!start || !apex || !end) continue;
    const points = sampleArc(start, apex, end, ARC_SAMPLE_STEPS);
    points.forEach((point, i) => lookup.set(arcSamplePointId(segment.id, i), point));
  }

  return lookup;
}

export function resolvePoint(lookup: PointLookup, pointId: string): Vector3 | undefined {
  return lookup.get(pointId);
}

/** Resolves a panel's boundary point ids into their current 3D positions. */
export function resolvePanelBoundary(lookup: PointLookup, panel: FabricPanel): Vector3[] {
  return panel.boundaryPointIds
    .map((id) => resolvePoint(lookup, id))
    .filter((p): p is Vector3 => p !== undefined);
}

/** Resolves a ridgeline's two endpoint ids into their current 3D positions. */
export function resolveRidgeline(
  lookup: PointLookup,
  ridgeline: Ridgeline
): [Vector3, Vector3] | undefined {
  const start = resolvePoint(lookup, ridgeline.startPointId);
  const end = resolvePoint(lookup, ridgeline.endPointId);
  if (!start || !end) return undefined;
  return [start, end];
}

export type PanelSpec = {
  name: string;
  boundaryPointIds: string[];
  materialId?: string;
};

/**
 * Stage 1 (deterministic panel geometry): wraps flat panel specs into
 * FabricPanel records. The actual 3D boundary is resolved later, at render
 * time, via buildPointLookup + resolvePoint so panels always reflect the
 * current pole/anchor positions instead of a stale snapshot.
 */
export function generateFabricPanels(specs: PanelSpec[]): FabricPanel[] {
  return specs.map((spec, index) => ({
    id: `panel-${index}-${spec.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: spec.name,
    boundaryPointIds: spec.boundaryPointIds,
    materialId: spec.materialId,
  }));
}

/**
 * Derives fabric seams from the edges shared by two or more panels. Each
 * shared edge becomes a Seam so the sewing/assembly view can show seam
 * allowances without the panel generator having to hardcode which edges
 * are structural.
 */
export function deriveSeamsFromPanels(panels: FabricPanel[]): Seam[] {
  const edgeOwners = new Map<string, string[]>();

  for (const panel of panels) {
    const ids = panel.boundaryPointIds;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % ids.length];
      const key = [a, b].sort().join("::");
      const owners = edgeOwners.get(key) ?? [];
      owners.push(panel.id);
      edgeOwners.set(key, owners);
    }
  }

  const seams: Seam[] = [];
  for (const [key, owners] of edgeOwners.entries()) {
    if (owners.length < 2) continue;
    const [a, b] = key.split("::");
    seams.push({
      id: `seam-${a}-${b}`,
      pointIds: [a, b],
    });
  }
  return seams;
}
